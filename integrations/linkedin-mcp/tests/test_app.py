import json
import re
import sqlite3
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app import Settings, create_app, code_challenge, publish_body, safe_post_url


class FakeLinkedIn:
    def __init__(self, email="owner@example.org", status_code=201):
        self.email = email
        self.status_code = status_code
        self.email_verified = True
        self.publish_count = 0
        self.published_payloads = []

    def post(self, url, **kwargs):
        if url.endswith("accessToken"):
            data = kwargs["data"]
            assert data["client_secret"] == "dummy-secret"
            return httpx.Response(200, json={"access_token":"upstream-linkedin-secret", "expires_in":3600}, request=httpx.Request("POST",url))
        assert url == "https://api.linkedin.com/v2/ugcPosts"
        self.publish_count += 1
        self.published_payloads.append(kwargs["json"])
        return httpx.Response(self.status_code, headers={"X-RestLi-Id":"urn:li:ugcPost:1234567890123"} if self.status_code == 201 else {}, request=httpx.Request("POST",url))

    def get(self,url,**kwargs):
        assert url.endswith("/userinfo")
        assert kwargs["headers"]["Authorization"] == "Bearer upstream-linkedin-secret"
        return httpx.Response(200,json={"sub":"testperson7","email":self.email,"email_verified":self.email_verified},request=httpx.Request("GET",url))


@pytest.fixture
def harness(tmp_path):
    settings=Settings(base_url="http://testserver",client_id="dummy-id", client_secret="dummy-secret",owner_email="owner@example.org",
        fernet_key=Fernet.generate_key().decode(), db_path=str(tmp_path/"test.sqlite"))
    fake=FakeLinkedIn()
    app=create_app(settings,fake)
    with TestClient(app,base_url="http://testserver") as client:
        yield client,settings,fake


def authorize(client):
    resp=client.post("/oauth/register",json={"client_name":"ChatGPT","redirect_uris":["https://chatgpt.com/connector_platform_oauth_redirect"]})
    assert resp.status_code == 201,resp.text
    client_id=resp.json()["client_id"]
    verifier="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~"
    challenge=code_challenge(verifier)
    start=client.get("/oauth/authorize",params={"response_type":"code","client_id":client_id,
        "redirect_uri":"https://chatgpt.com/connector_platform_oauth_redirect", "code_challenge":challenge,
        "code_challenge_method":"S256","scope":"linkedin:post offline_access", "resource":"http://testserver/mcp","state":"chatgpt-state"})
    assert start.status_code == 200,start.text
    flow_id=re.search(r"name='flow_id' value='([^']+)'",start.text).group(1)
    csrf=re.search(r"name='csrf' value='([^']+)'",start.text).group(1)
    cont=client.post("/oauth/consent",data={"flow_id":flow_id,"csrf":csrf}, follow_redirects=False)
    assert cont.status_code == 303,cont.text
    query=parse_qs(urlsplit(cont.headers["location"]).query)
    assert query["scope"][0] == "openid profile email w_member_social"
    linkedin_state=query["state"][0]
    callback=client.get("/auth/linkedin/callback",params={"code":"fake-code", "state":linkedin_state},follow_redirects=False)
    return client_id,verifier,callback


def get_bearer(client):
    client_id,verifier,callback=authorize(client)
    assert callback.status_code == 303,callback.text
    query=parse_qs(urlsplit(callback.headers["location"]).query)
    assert query["state"] == ["chatgpt-state"]
    exchange=client.post("/oauth/token",data={"grant_type":"authorization_code","client_id":client_id,
        "code":query["code"][0], "redirect_uri":"https://chatgpt.com/connector_platform_oauth_redirect", "code_verifier":verifier})
    assert exchange.status_code == 200,exchange.text
    return client_id,exchange.json()


def mcp(client,access,method,params=None,version=None):
    h={"Authorization":"Bearer "+access,"Accept":"application/json, text/event-stream"}
    if version:
        h["MCP-Protocol-Version"]=version
    return client.post("/mcp",json={"jsonrpc":"2.0","id":1,"method":method,"params":params or {}},headers=h)


def unpack_tool(resp):
    assert resp.status_code == 200,resp.text
    data=resp.json()["result"]
    return json.loads(data["content"][0]["text"]),data["isError"]


def test_discovery_protection_and_redirect_validation(harness):
    c,s,_=harness
    auth=c.post("/mcp",json={"jsonrpc":"2.0","id":1,"method":"initialize"},headers={"Accept":"application/json, text/event-stream"})
    assert auth.status_code == 401
    assert "oauth-protected-resource" in auth.headers["www-authenticate"]
    assert c.get("/healthz").json()["status"] == "ok"
    meta=c.get("/.well-known/oauth-protected-resource/mcp").json()
    assert meta["resource"] == "http://testserver/mcp"
    assert c.get("/.well-known/oauth-authorization-server").json()["code_challenge_methods_supported"] == ["S256"]
    invalid=c.post("/oauth/register",json={"client_name":"Evil","redirect_uris":["javascript:alert(1)"]})
    assert invalid.status_code == 400
    external=c.post("/oauth/register",json={"client_name":"Untrusted redirect","redirect_uris":["https://example.net/callback"]})
    assert external.status_code == 400
    assert c.get("/mcp").status_code == 405
    assert c.post("/mcp",headers={"Origin":"https://evil.example"}).status_code == 403


def test_oauth_mcp_prepare_publish_readback_and_no_duplicates(harness):
    c,s,fake=harness
    client_id,tokens=get_bearer(c)
    access=tokens["access_token"]
    init=mcp(c,access,"initialize",{"protocolVersion":"2025-11-25"})
    assert init.json()["result"]["serverInfo"]["name"] == "imperion-linkedin-mcp"
    tools=mcp(c,access,"tools/list")
    assert len(tools.json()["result"]["tools"]) == 4
    who,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_connection_status","arguments":{}}))
    assert not error and who["member_sub"] == "testperson7"
    text="Expert post: data quality first. #Bioinformatics"
    preview,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_prepare_post","arguments":{"text":text}}))
    assert not error and preview["status"] == "PREPARED"
    assert fake.publish_count == 0
    draft=preview["draft_id"]
    refused,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_publish_post","arguments":{"draft_id":draft}}))
    assert error and refused["error"] == "explicit_confirmation_required"
    assert fake.publish_count == 0
    receipt,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_publish_post","arguments":{"draft_id":draft,"confirm":"PUBLISH"}}))
    assert not error and receipt["status"] == "PUBLISHED_API_ACCEPTED"
    assert receipt["post_url"] == "https://www.linkedin.com/feed/update/urn:li:ugcPost:1234567890123/"
    assert fake.publish_count == 1
    assert fake.published_payloads[0]["author"] == "urn:li:person:testperson7"
    assert fake.published_payloads[0]["specificContent"]["com.linkedin.ugc.ShareContent"]["shareCommentary"]["text"] == text
    duplicate,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_publish_post","arguments":{"draft_id":draft,"confirm":"PUBLISH"}}))
    assert error and fake.publish_count == 1
    readback,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_post_readback","arguments":{"draft_id":draft}}))
    assert not error and readback["linkedin_api_status"] == 201
    assert readback["independent_live_page_verification"] is False
    with sqlite3.connect(s.db_path) as connection:
        record=connection.execute("SELECT upstream_token FROM mcp_tokens").fetchone()[0]
        assert "upstream-linkedin-secret" not in record
    old_access=access
    renewed=c.post("/oauth/token",data={"grant_type":"refresh_token", "client_id":client_id,
        "refresh_token":tokens["refresh_token"]})
    assert renewed.status_code == 200
    assert mcp(c,old_access,"ping").status_code == 401
    assert mcp(c,renewed.json()["access_token"],"ping").status_code == 200
    assert c.post("/oauth/token",data={"grant_type":"refresh_token","client_id":client_id,
        "refresh_token":tokens["refresh_token"]}).status_code == 400


def test_wrong_linkedin_account_denied(harness):
    c,_,fake=harness
    fake.email="someone-else@example.org"
    _,_,callback=authorize(c)
    assert callback.status_code == 403
    assert callback.json()["error"] == "linkedin_account_not_allowed"


def test_unverified_linkedin_email_denied(harness):
    c,_,fake=harness
    fake.email_verified=False
    _,_,callback=authorize(c)
    assert callback.status_code == 502
    assert callback.json()["error"] == "linkedin_oauth_exchange_failed"


def test_unconfirmed_publication_never_retried(harness):
    c,_,fake=harness
    _,tokens=get_bearer(c)
    access=tokens["access_token"]
    preview,_=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_prepare_post","arguments":{"text":"Test 429"}}))
    fake.status_code=429
    args={"draft_id":preview["draft_id"],"confirm":"PUBLISH"}
    first,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_publish_post","arguments":args}))
    assert error and first["status"] == "REVIEW_REQUIRED"
    retry,error=unpack_tool(mcp(c,access,"tools/call",{"name":"linkedin_publish_post","arguments":args}))
    assert error and retry["status"] == "REVIEW_REQUIRED"
    assert fake.publish_count == 1


def test_helpers_validation():
    assert not safe_post_url("javascript:alert(1)")
    assert not safe_post_url("urn:li:person:123")
    assert publish_body("hello","xyz","PUBLIC")["lifecycleState"] == "PUBLISHED"
