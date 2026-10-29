"""IMPERION LinkedIn: private OAuth-protected MCP server for member text posts.

The remote MCP endpoint is /mcp. Only Share on LinkedIn (text) is implemented.
No scraping, bulk messages, connection requests, or analytics are supported.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import json
import os
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

OAUTH_SCOPES = "linkedin:post offline_access"
LINKEDIN_SCOPES = "openid profile email w_member_social"
LI_AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization"
LI_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken"
LI_USERINFO = "https://api.linkedin.com/v2/userinfo"
LI_POSTS = "https://api.linkedin.com/v2/ugcPosts"
SUPPORTED_VERSIONS = {"2025-03-26", "2025-06-18", "2025-11-25"}
PREVIEW_TTL = 24 * 3600
MAX_POST_CHARS = 3000
MAX_REQUEST_BYTES = 32 * 1024


@dataclass(frozen=True)
class Settings:
    base_url: str
    client_id: str
    client_secret: str
    owner_email: str
    fernet_key: str
    db_path: str = "/data/imperion_linkedin.sqlite"
    allowed_origins: tuple[str, ...] = ()
    dcr_redirect_hosts: tuple[str, ...] = ("chatgpt.com",)

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            base_url=os.environ["PUBLIC_BASE_URL"].rstrip("/"),
            client_id=os.environ["LINKEDIN_CLIENT_ID"],
            client_secret=os.environ["LINKEDIN_CLIENT_SECRET"],
            owner_email=os.environ["LINKEDIN_OWNER_EMAIL"],
            fernet_key=os.environ["MCP_FERNET_KEY"],
            db_path=os.getenv("DB_PATH", "/data/imperion_linkedin.sqlite"),
            allowed_origins=tuple(v.strip() for v in os.getenv("ALLOWED_ORIGINS", "").split(",") if v.strip()),
            dcr_redirect_hosts=tuple(v.strip().lower() for v in os.getenv("DCR_REDIRECT_HOSTS", "chatgpt.com").split(",") if v.strip()),
        )

    def validate(self) -> None:
        u = urlparse(self.base_url)
        if u.scheme != "https" and not (u.scheme == "http" and u.hostname in {"localhost", "127.0.0.1", "testserver"}):
            raise ValueError("PUBLIC_BASE_URL must use HTTPS except on local loopback")
        if not u.netloc or u.path not in {"", "/"} or u.query or u.fragment or u.username or u.password:
            raise ValueError("PUBLIC_BASE_URL must be an origin, without path or credentials")
        if not self.client_id.strip() or not self.client_secret.strip():
            raise ValueError("LinkedIn app credentials are required")
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", self.owner_email):
            raise ValueError("Set LINKEDIN_OWNER_EMAIL to the email of the authorized LinkedIn account")
        if not self.dcr_redirect_hosts or any(not re.fullmatch(r"[a-z0-9.-]+", host) for host in self.dcr_redirect_hosts):
            raise ValueError("DCR_REDIRECT_HOSTS must specify valid exact HTTPS hostnames")
        Fernet(self.fernet_key.encode())


@contextmanager
def db(s: Settings):
    connection = sqlite3.connect(s.db_path, timeout=15)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database(s: Settings) -> None:
    Path(s.db_path).parent.mkdir(parents=True, exist_ok=True)
    with db(s) as conn:
        conn.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS oauth_clients (
            client_id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS oauth_flows (
            flow_id TEXT PRIMARY KEY, client_id TEXT NOT NULL, redirect_uri TEXT NOT NULL,
            state TEXT NOT NULL, challenge TEXT NOT NULL, browser_hash TEXT NOT NULL,
            csrf_hash TEXT NOT NULL, linkedin_state TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL, created_at INTEGER NOT NULL,
            auth_code_hash TEXT UNIQUE, upstream_token TEXT, subject TEXT, email TEXT,
            upstream_expires INTEGER
        );
        CREATE TABLE IF NOT EXISTS mcp_tokens (
            access_hash TEXT PRIMARY KEY, refresh_hash TEXT UNIQUE NOT NULL,
            client_id TEXT NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL,
            upstream_token TEXT NOT NULL, upstream_expires INTEGER NOT NULL,
            access_expires INTEGER NOT NULL, refresh_expires INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS drafts (
            draft_id TEXT PRIMARY KEY, subject TEXT NOT NULL, text TEXT NOT NULL,
            visibility TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL, post_id TEXT, receipt_url TEXT,
            response_status INTEGER, error TEXT
        );
        """)


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def valid_redirect(uri: str, allowed_https_hosts: tuple[str, ...] = ("chatgpt.com",)) -> bool:
    try:
        u = urlparse(uri)
        if u.username or u.password or u.fragment or not u.hostname:
            return False
        if u.scheme == "https":
            return u.hostname.lower() in allowed_https_hosts
        return u.scheme == "http" and u.hostname in {"localhost", "127.0.0.1", "::1"} and u.hostname in allowed_https_hosts
    except Exception:
        return False


def code_challenge(code_verifier: str) -> str:
    import base64
    return base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode("ascii")).digest()).decode().rstrip("=")


def tool_result(data: dict[str, Any], error: bool = False) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(data, ensure_ascii=False)}],
        "isError": error,
    }


TOOLS = [
    {
        "name": "linkedin_connection_status",
        "description": "Read the authenticated LinkedIn member identity and token expiry. No publication.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "linkedin_prepare_post",
        "description": "Prepare a LinkedIn text post without publishing it. Returns a draft_id and preview.",
        "inputSchema": {"type": "object", "properties": {
            "text": {"type": "string", "minLength": 1, "maxLength": MAX_POST_CHARS},
            "visibility": {"type": "string", "enum": ["PUBLIC", "CONNECTIONS"]},
        }, "required": ["text"], "additionalProperties": False},
        "annotations": {"readOnlyHint": False, "openWorldHint": False},
    },
    {
        "name": "linkedin_publish_post",
        "description": "Irreversible external action. Publish a PREPARED draft to LinkedIn only after the user explicitly approves publication. Requires confirm='PUBLISH'. Never auto-retry uncertain results.",
        "inputSchema": {"type": "object", "properties": {
            "draft_id": {"type": "string"},
            "confirm": {"type": "string", "enum": ["PUBLISH"]},
        }, "required": ["draft_id", "confirm"], "additionalProperties": False},
        "annotations": {"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True},
    },
    {
        "name": "linkedin_post_readback",
        "description": "Read stored publication receipt, response code, and status for one draft. No new publication.",
        "inputSchema": {"type": "object", "properties": {
            "draft_id": {"type": "string"},
        }, "required": ["draft_id"], "additionalProperties": False},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
]


def publish_body(text: str, subject: str, visibility: str) -> dict[str, Any]:
    return {
        "author": f"urn:li:person:{subject}",
        "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": {
            "shareCommentary": {"text": text}, "shareMediaCategory": "NONE",
        }},
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": visibility},
    }


def safe_post_url(post_id: str | None) -> str | None:
    if post_id and re.fullmatch(r"urn:li:(?:ugcPost|share):\d+", post_id):
        return f"https://www.linkedin.com/feed/update/{post_id}/"
    return None


def create_app(settings: Settings | None = None, linkedin_client: Any | None = None) -> FastAPI:
    s = settings or Settings.from_env()
    s.validate()
    initialize_database(s)
    cipher = Fernet(s.fernet_key.encode())
    api = linkedin_client or httpx.Client(timeout=httpx.Timeout(12.0, connect=5.0), follow_redirects=False)
    app = FastAPI(title="IMPERION LinkedIn MCP", docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        origin = request.headers.get("origin")
        allowed = {s.base_url, *s.allowed_origins}
        if origin and origin not in allowed:
            return Response(status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response

    def oauth_error(status: int, error: str) -> JSONResponse:
        return JSONResponse({"error": error}, status_code=status, headers={"Cache-Control": "no-store"})

    def metadata_resource() -> dict[str, Any]:
        return {"resource": f"{s.base_url}/mcp", "authorization_servers": [s.base_url], "scopes_supported": OAUTH_SCOPES.split()}

    @app.get("/.well-known/oauth-protected-resource")
    @app.get("/.well-known/oauth-protected-resource/mcp")
    def resource_metadata():
        return metadata_resource()

    @app.get("/.well-known/oauth-authorization-server")
    def authorization_metadata():
        return {
            "issuer": s.base_url,
            "authorization_endpoint": f"{s.base_url}/oauth/authorize",
            "token_endpoint": f"{s.base_url}/oauth/token",
            "registration_endpoint": f"{s.base_url}/oauth/register",
            "scopes_supported": OAUTH_SCOPES.split(),
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "token_endpoint_auth_methods_supported": ["none"],
            "code_challenge_methods_supported": ["S256"],
            "client_id_metadata_document_supported": False,
        }

    @app.post("/oauth/register", status_code=201)
    async def register(request: Request):
        raw = await request.body()
        if len(raw) > MAX_REQUEST_BYTES:
            return oauth_error(413, "request_too_large")
        try:
            payload = json.loads(raw)
            name = payload.get("client_name", "MCP Client")
            redirects = payload["redirect_uris"]
            if not isinstance(name, str) or not 1 <= len(name) <= 100:
                raise ValueError("client_name")
            if not isinstance(redirects, list) or not 1 <= len(redirects) <= 5 or any(not isinstance(v, str) or not valid_redirect(v, s.dcr_redirect_hosts) for v in redirects):
                raise ValueError("redirect_uris")
            if payload.get("token_endpoint_auth_method", "none") != "none":
                raise ValueError("public clients only")
        except (ValueError, TypeError, KeyError, json.JSONDecodeError, AttributeError):
            return oauth_error(400, "invalid_client_metadata")
        client_id = secrets.token_urlsafe(24)
        with db(s) as conn:
            conn.execute("INSERT INTO oauth_clients VALUES (?,?,?,?)", (client_id, name, json.dumps(redirects), int(time.time())))
        return {"client_id": client_id, "client_name": name, "redirect_uris": redirects,
                "token_endpoint_auth_method": "none", "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"], "scope": OAUTH_SCOPES}

    @app.get("/oauth/authorize")
    def authorize(request: Request):
        q = request.query_params
        client_id, redirect, challenge = q.get("client_id", ""), q.get("redirect_uri", ""), q.get("code_challenge", "")
        scopes = set(q.get("scope", OAUTH_SCOPES).split())
        if q.get("response_type") != "code" or q.get("code_challenge_method") != "S256" or not re.fullmatch(r"[A-Za-z0-9_-]{43,128}", challenge):
            return oauth_error(400, "invalid_request")
        if not scopes or not scopes.issubset(set(OAUTH_SCOPES.split())) or "linkedin:post" not in scopes:
            return oauth_error(400, "invalid_scope")
        if q.get("resource") not in (None, f"{s.base_url}/mcp"):
            return oauth_error(400, "invalid_target")
        with db(s) as conn:
            c = conn.execute("SELECT * FROM oauth_clients WHERE client_id=?", (client_id,)).fetchone()
        if not c or redirect not in json.loads(c["redirect_uris"]):
            return oauth_error(400, "invalid_client")
        now = int(time.time())
        flow_id, browser, csrf, upstream_state = (secrets.token_urlsafe(32) for _ in range(4))
        with db(s) as conn:
            conn.execute("""INSERT INTO oauth_flows
                (flow_id,client_id,redirect_uri,state,challenge,browser_hash,csrf_hash,linkedin_state,status,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (flow_id,client_id,redirect,q.get("state", ""),challenge,token_hash(browser),token_hash(csrf),upstream_state,"AWAITING_CONSENT",now))
        markup = f"""<!doctype html><html><head><meta charset='UTF-8'><title>IMPERION LinkedIn authorization</title></head>
          <body><main><h1>IMPERION LinkedIn</h1>
          <p>Client: <strong>{html.escape(c['name'])}</strong></p>
          <p>Redirect destination: <code>{html.escape(redirect)}</code></p>
          <p>Approve access to prepare and publish posts on your LinkedIn profile. Never approve an unfamiliar client.</p>
          <form action='/oauth/consent' method='POST'>
            <input type='hidden' name='flow_id' value='{html.escape(flow_id)}'>
            <input type='hidden' name='csrf' value='{html.escape(csrf)}'>
            <button type='submit'>Continue to LinkedIn</button>
          </form></main></body></html>"""
        resp = HTMLResponse(markup, headers={"Content-Security-Policy": "default-src 'none'; style-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"})
        resp.set_cookie("imperion_oauth_browser", browser, httponly=True, secure=s.base_url.startswith("https:"),
                        samesite="lax", max_age=600, path="/")
        return resp

    @app.post("/oauth/consent")
    def consent(request: Request, flow_id: str = Form(), csrf: str = Form()):
        browser = request.cookies.get("imperion_oauth_browser", "")
        with db(s) as conn:
            flow = conn.execute("SELECT * FROM oauth_flows WHERE flow_id=?", (flow_id,)).fetchone()
            if not flow or flow["status"] != "AWAITING_CONSENT" or int(time.time())-flow["created_at"] > 600:
                return oauth_error(400, "invalid_flow")
            if not hmac.compare_digest(flow["csrf_hash"], token_hash(csrf)) or not browser or not hmac.compare_digest(flow["browser_hash"],token_hash(browser)):
                return oauth_error(403, "invalid_consent")
            conn.execute("UPDATE oauth_flows SET status='AWAITING_LINKEDIN' WHERE flow_id=? AND status='AWAITING_CONSENT'", (flow_id,))
        params = {"response_type":"code", "client_id":s.client_id,
                  "redirect_uri":f"{s.base_url}/auth/linkedin/callback", "state":flow["linkedin_state"], "scope":LINKEDIN_SCOPES}
        return RedirectResponse(f"{LI_AUTHORIZE}?{urlencode(params)}", status_code=303)

    @app.get("/auth/linkedin/callback")
    def linkedin_callback(request: Request):
        state, code = request.query_params.get("state", ""), request.query_params.get("code", "")
        browser = request.cookies.get("imperion_oauth_browser", "")
        with db(s) as conn:
            flow = conn.execute("SELECT * FROM oauth_flows WHERE linkedin_state=?", (state,)).fetchone()
        if not flow or flow["status"] != "AWAITING_LINKEDIN" or int(time.time())-flow["created_at"] > 600:
            return oauth_error(400, "invalid_oauth_state")
        if not browser or not hmac.compare_digest(flow["browser_hash"], token_hash(browser)):
            return oauth_error(403, "invalid_browser")
        if not code or request.query_params.get("error"):
            return oauth_error(403, "linkedin_authorization_denied")
        try:
            token_resp = api.post(LI_TOKEN, data={"grant_type":"authorization_code", "code":code,
                    "client_id":s.client_id, "client_secret":s.client_secret,
                    "redirect_uri":f"{s.base_url}/auth/linkedin/callback"},
                    headers={"Accept":"application/json"})
            token_resp.raise_for_status()
            token_data = token_resp.json()
            upstream_token = token_data["access_token"]
            expires_in = int(token_data.get("expires_in", 0))
            if not isinstance(upstream_token, str) or not upstream_token or expires_in < 120:
                raise ValueError("missing access token or expiry")
            user_resp = api.get(LI_USERINFO, headers={"Authorization":f"Bearer {upstream_token}"})
            user_resp.raise_for_status()
            user = user_resp.json()
            email, sub = user.get("email"), user.get("sub")
            if not isinstance(email, str) or not isinstance(sub,str) or not sub:
                raise ValueError("invalid userinfo")
            if user.get("email_verified") is not True:
                raise ValueError("linkedIn_email_not_verified")
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            return oauth_error(502, "linkedin_oauth_exchange_failed")
        if not hmac.compare_digest(email.lower(), s.owner_email.lower()):
            return oauth_error(403, "linkedin_account_not_allowed")
        auth_code = secrets.token_urlsafe(32)
        with db(s) as conn:
            update = conn.execute("""UPDATE oauth_flows
              SET status='READY_TO_REDEEM', auth_code_hash=?, upstream_token=?, subject=?, email=?, upstream_expires=?
              WHERE flow_id=? AND status='AWAITING_LINKEDIN'""",
              (token_hash(auth_code),cipher.encrypt(upstream_token.encode()).decode(),sub,email,int(time.time())+expires_in,flow["flow_id"]))
            if update.rowcount != 1:
                return oauth_error(409, "oauth_flow_already_used")
        dest = flow["redirect_uri"]
        separator = "&" if "?" in dest else "?"
        return RedirectResponse(dest+separator+urlencode({"code":auth_code,"state":flow["state"]}),status_code=303)

    @app.post("/oauth/token")
    async def exchange_token(request: Request):
        form = await request.form()
        kind, client_id = form.get("grant_type", ""), str(form.get("client_id", ""))
        now = int(time.time())
        if kind == "authorization_code":
            verifier = str(form.get("code_verifier", ""))
            provided_code = str(form.get("code", ""))
            if not 43 <= len(verifier) <= 128 or not re.fullmatch(r"[A-Za-z0-9_.~-]+",verifier):
                return oauth_error(400, "invalid_grant")
            with db(s) as conn:
                flow = conn.execute("SELECT * FROM oauth_flows WHERE auth_code_hash=? AND client_id=?",
                                    (token_hash(provided_code), client_id)).fetchone()
                if not flow or flow["status"] != "READY_TO_REDEEM" or form.get("redirect_uri") != flow["redirect_uri"] or not hmac.compare_digest(code_challenge(verifier), flow["challenge"]):
                    return oauth_error(400, "invalid_grant")
                if now-flow["created_at"] > 900 or flow["upstream_expires"] <= now+30:
                    return oauth_error(400, "invalid_grant")
                update=conn.execute("UPDATE oauth_flows SET status='REDEEMED', auth_code_hash=NULL WHERE flow_id=? AND status='READY_TO_REDEEM'",(flow["flow_id"],))
                if update.rowcount != 1:
                    return oauth_error(400, "invalid_grant")
                upstream, expires, subject, email = flow["upstream_token"],flow["upstream_expires"],flow["subject"],flow["email"]
                access, refresh = secrets.token_urlsafe(48), secrets.token_urlsafe(48)
                access_expires = min(now+3600,expires-30)
                conn.execute("INSERT INTO mcp_tokens VALUES (?,?,?,?,?,?,?,?,?)",
                     (token_hash(access),token_hash(refresh),client_id,subject,email,upstream,expires,access_expires,expires-30))
        elif kind == "refresh_token":
            supplied = str(form.get("refresh_token", ""))
            with db(s) as conn:
                old = conn.execute("SELECT * FROM mcp_tokens WHERE refresh_hash=? AND client_id=?",
                                   (token_hash(supplied),client_id)).fetchone()
                if not old or old["refresh_expires"] < now+30 or old["upstream_expires"] < now+30:
                    return oauth_error(400, "invalid_grant")
                access,refresh=secrets.token_urlsafe(48),secrets.token_urlsafe(48)
                access_expires=min(now+3600,old["upstream_expires"]-30)
                updated=conn.execute("UPDATE mcp_tokens SET access_hash=?,refresh_hash=?,access_expires=? WHERE refresh_hash=?",
                    (token_hash(access),token_hash(refresh),access_expires,token_hash(supplied)))
                if updated.rowcount != 1:
                    return oauth_error(400, "invalid_grant")
        else:
            return oauth_error(400, "unsupported_grant_type")
        return {"access_token":access,"token_type":"Bearer","expires_in":max(1,access_expires-now),
                "refresh_token":refresh,"scope":OAUTH_SCOPES}

    def oauth_challenge() -> Response:
        return JSONResponse({"error":"authorization_required"}, status_code=401, headers={
            "WWW-Authenticate": f'Bearer resource_metadata="{s.base_url}/.well-known/oauth-protected-resource/mcp", scope="linkedin:post"'})

    @app.get("/healthz")
    def health():
        return {"status": "ok", "service": "imperion-linkedin-mcp"}

    @app.get("/mcp")
    @app.delete("/mcp")
    def unsupported_stream():
        return Response(status_code=405, headers={"Allow":"POST"})

    @app.post("/mcp")
    async def mcp(request: Request):
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or len(auth) > 512:
            return oauth_challenge()
        with db(s) as conn:
            record = conn.execute("SELECT * FROM mcp_tokens WHERE access_hash=?", (token_hash(auth[7:]),)).fetchone()
        if not record or record["access_expires"] < int(time.time()) or record["upstream_expires"] < int(time.time()):
            return oauth_challenge()
        version = request.headers.get("mcp-protocol-version")
        if version and version not in SUPPORTED_VERSIONS:
            return oauth_error(400,"unsupported_protocol_version")
        if "application/json" not in request.headers.get("accept", "") or "text/event-stream" not in request.headers.get("accept", ""):
            return oauth_error(406,"not_acceptable")
        raw = await request.body()
        if len(raw) > MAX_REQUEST_BYTES:
            return oauth_error(413, "request_too_large")
        try:
            req = json.loads(raw)
            if not isinstance(req, dict) or req.get("jsonrpc") != "2.0" or not isinstance(req.get("method"),str):
                raise ValueError()
        except (ValueError, json.JSONDecodeError):
            return oauth_error(400,"invalid_jsonrpc")
        method, request_id = req["method"],req.get("id")
        if request_id is None:
            return Response(status_code=202)

        def rpc(result: Any | None = None, error: dict | None = None):
            payload={"jsonrpc":"2.0","id":request_id}
            if error is None:
                payload["result"]=result
            else:
                payload["error"]=error
            return JSONResponse(payload)

        if method == "initialize":
            return rpc({"protocolVersion":"2025-11-25", "capabilities":{"tools":{"listChanged":False}},
                        "serverInfo":{"name":"imperion-linkedin-mcp","version":"0.1.0"}})
        if method == "ping":
            return rpc({})
        if method == "tools/list":
            return rpc({"tools":TOOLS})
        if method != "tools/call":
            return rpc(error={"code":-32601,"message":"Unknown method"})
        params=req.get("params") or {}
        if not isinstance(params,dict) or not isinstance(params.get("name"),str):
            return rpc(error={"code":-32602,"message":"Invalid params"})
        name, args = params["name"],params.get("arguments",{})
        if not isinstance(args, dict):
            return rpc(result=tool_result({"error":"arguments_must_be_object"},True))
        subject = record["subject"]
        if name == "linkedin_connection_status":
            return rpc(result=tool_result({"connected":True,"member_sub":subject,
                "email":record["email"],"upstream_token_expires_at":record["upstream_expires"],
                "can_publish_text":True,"can_read_analytics":False}))
        if name == "linkedin_prepare_post":
            content=args.get("text")
            visibility=args.get("visibility","PUBLIC")
            if not isinstance(content,str) or not content.strip() or len(content)>MAX_POST_CHARS or visibility not in ("PUBLIC","CONNECTIONS"):
                return rpc(result=tool_result({"error":"invalid_text_or_visibility","max_characters":MAX_POST_CHARS},True))
            draft_id=secrets.token_urlsafe(20)
            now=int(time.time())
            with db(s) as conn:
                conn.execute("INSERT INTO drafts (draft_id,subject,text,visibility,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                            (draft_id,subject,content,visibility,"PREPARED",now,now))
            return rpc(result=tool_result({"draft_id":draft_id,"status":"PREPARED","text":content,
                    "characters":len(content),"visibility":visibility,
                    "instruction":"Only publish after explicit user confirmation using linkedin_publish_post."}))
        if name in ("linkedin_post_readback", "linkedin_publish_post"):
            draft_id=args.get("draft_id")
            if not isinstance(draft_id,str) or not 4 <= len(draft_id) <= 100:
                return rpc(result=tool_result({"error":"invalid_draft_id"},True))
            with db(s) as conn:
                draft=conn.execute("SELECT * FROM drafts WHERE draft_id=? AND subject=?",(draft_id,subject)).fetchone()
            if draft is None:
                return rpc(result=tool_result({"error":"draft_not_found"},True))
            if name == "linkedin_post_readback":
                return rpc(result=tool_result({"draft_id":draft_id,"status":draft["status"],
                   "post_id":draft["post_id"],"post_url":draft["receipt_url"],
                   "linkedin_api_status":draft["response_status"],"note":draft["error"],
                   "independent_live_page_verification":False}))
            if args.get("confirm") != "PUBLISH":
                return rpc(result=tool_result({"error":"explicit_confirmation_required","status":draft["status"]},True))
            if draft["status"] != "PREPARED":
                return rpc(result=tool_result({"error":"draft_not_publishable_again", "status":draft["status"],
                    "post_id":draft["post_id"],"post_url":draft["receipt_url"]},True))
            if draft["created_at"] < int(time.time())-PREVIEW_TTL:
                return rpc(result=tool_result({"error":"draft_expired_prepare_again"},True))
            with db(s) as conn:
                claimed=conn.execute("UPDATE drafts SET status='PROCESSING',updated_at=? WHERE draft_id=? AND status='PREPARED' AND subject=?",
                        (int(time.time()),draft_id,subject))
                if claimed.rowcount != 1:
                    return rpc(result=tool_result({"error":"already_processing_or_published"},True))
            try:
                upstream_token = cipher.decrypt(record["upstream_token"].encode()).decode()
                published=api.post(LI_POSTS,json=publish_body(draft["text"],subject,draft["visibility"]),
                        headers={"Authorization":f"Bearer {upstream_token}",
                                 "X-Restli-Protocol-Version":"2.0.0", "Content-Type":"application/json"})
                # An HTTP 201 with an ID is an API receipt; it is not independent feed readback.
                if published.status_code == 201:
                    post_id=published.headers.get("X-RestLi-Id")
                    if not post_id:
                        try:
                            post_id=published.json().get("id")
                        except (ValueError,AttributeError):
                            post_id=None
                    url=safe_post_url(post_id)
                    with db(s) as conn:
                        conn.execute("""UPDATE drafts SET status='PUBLISHED_API_ACCEPTED',updated_at=?,post_id=?,receipt_url=?,response_status=201
                          WHERE draft_id=?""",(int(time.time()),post_id,url,draft_id))
                    return rpc(result=tool_result({"draft_id":draft_id,"status":"PUBLISHED_API_ACCEPTED",
                        "post_id":post_id,"post_url":url,"linkedin_api_status":201,
                        "independent_live_page_verification":False}))
                # Fail-closed: no automatic retry even for 4xx/5xx. A partial failure may have posted.
                with db(s) as conn:
                    conn.execute("UPDATE drafts SET status='REVIEW_REQUIRED',updated_at=?,response_status=?,error=? WHERE draft_id=?",
                         (int(time.time()),published.status_code, "LinkedIn API did not confirm HTTP 201; inspect manually before retry",draft_id))
                return rpc(result=tool_result({"draft_id":draft_id,"status":"REVIEW_REQUIRED",
                    "linkedin_api_status":published.status_code,"error":"Not confirmed. Do not automatically retry."},True))
            except (httpx.HTTPError,InvalidToken,UnicodeDecodeError):
                with db(s) as conn:
                    conn.execute("UPDATE drafts SET status='REVIEW_REQUIRED',updated_at=?,error=? WHERE draft_id=?",
                         (int(time.time()),"Request outcome uncertain; check LinkedIn manually",draft_id))
                return rpc(result=tool_result({"draft_id":draft_id,"status":"REVIEW_REQUIRED",
                     "error":"Outcome uncertain. Check LinkedIn manually; automatic retry disabled."},True))
        return rpc(error={"code":-32602,"message":"Unknown tool"})

    return app


# Render uses environment only at runtime; tests instantiate create_app with known dummy credentials.
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(create_app(), host="127.0.0.1", port=int(os.getenv("PORT", "8000")))
