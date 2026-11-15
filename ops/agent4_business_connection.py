"""Chat Automation adapter for the EXISTING Agent4 Bot API consumer.

Not a bot, poller, worker or sender. All chats fail closed unless the owner
and the other participant have explicitly authorized this exact chat.
Private message contents never leave the local Agent4 queue in this module.
"""
from __future__ import annotations
import hashlib
import json
import re
import time

CONNECTION_ID = re.compile(r"^[A-Za-z0-9_-]{6,256}$")
CONTROLLERS = frozenset({"OSVC", "DRUZINA_MORAVY_ZS"})
BUSINESS_UPDATES = ("business_connection", "business_message",
                    "edited_business_message", "deleted_business_messages")
ALLOWED_UPDATES = ("message",) + BUSINESS_UPDATES
REPLY_WINDOW_SECONDS = 86400
MAX_TEXT = 6000


def digest(value):
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def key(name, cid, peer=None):
    suffix = digest(cid)[:32]
    return f"agent4_biz_{name}:{suffix}" + (f":{peer}" if peer is not None else "")


def out(status, **kw):
    return {"status": status, "external_send": False, **kw}


def is_id(v):
    return type(v) is int and v > 0


def connection(db, cid, get):
    if not isinstance(cid, str) or not CONNECTION_ID.fullmatch(cid):
        return None
    try:
        row = json.loads(get(db, key("connection", cid), ""))
    except (TypeError, ValueError):
        return None
    return row if isinstance(row, dict) and row.get("id") == cid else None


def permitted(db, cid, peer, get, c):
    if not c or not c.get("enabled") or not c.get("can_reply"):
        return None
    if get(db, key("optout", cid, peer), "0") == "1":
        return None
    if get(db, key("consent", cid, peer), "") != "AFFIRMATIVE":
        return None
    controller = get(db, key("controller", cid, peer), "")
    return controller if controller in CONTROLLERS else None


def event_once(db, event, job_id, value):
    row = db.execute("SELECT 1 FROM events WHERE job=? AND state=? LIMIT 1",
                     (job_id, value)).fetchone()
    if not row:
        event(db, job_id, value)


def redact(db, cid, peer, mids, event):
    if not (isinstance(cid, str) and CONNECTION_ID.fullmatch(cid) and
            is_id(peer) and isinstance(mids, list) and
            0 < len(mids) <= 100 and all(is_id(m) for m in mids)):
        return out("BLOCKED_REDACTION_BAD_INPUT")
    if not {"text", "draft"}.issubset(
            {r[1] for r in db.execute("PRAGMA table_info(jobs)").fetchall()}):
        return out("BLOCKED_REDACTION_SCHEMA")
    changed = 0
    for mid in mids:
        row = db.execute("SELECT id FROM jobs WHERE source=? AND peer=? AND external_id=?",
                         ("telegram-agent4", str(peer), f"biz:{digest(cid)[:32]}:{mid}")).fetchone()
        if row:
            with db:
                db.execute("UPDATE jobs SET text='',draft=NULL WHERE id=?", (row[0],))
                event_once(db, event, row[0], "BUSINESS_MESSAGE_REDACTED")
            changed += 1
    return out("BUSINESS_REDACTED", redacted=changed)


def handle_update(db, update, get, put, enqueue, event, now=None):
    """Dispatch inside the ONE existing getUpdates consumer. No outbound."""
    now = int(time.time()) if now is None else int(now)
    if not isinstance(update, dict):
        return out("IGNORED_MALFORMED_UPDATE")
    if "business_connection" in update:
        obj = update["business_connection"]
        if not isinstance(obj, dict):
            return out("IGNORED_INVALID_CONNECTION")
        cid = obj.get("id")
        user = obj.get("user") or {}
        rights = obj.get("rights") or {}
        if (not isinstance(cid, str) or not CONNECTION_ID.fullmatch(cid) or
                not isinstance(user, dict) or not is_id(user.get("id")) or
                not isinstance(rights, dict)):
            return out("IGNORED_INVALID_CONNECTION")
        # Compare ONLY with the owner's already-enrolled Telegram self-test hash.
        # Never authorize a stranger merely because they connected this bot.
        trusted = get(db, "agent4_owner_test_peer_sha256", "")
        if not trusted or trusted != digest(user["id"]):
            return out("BLOCKED_BUSINESS_OWNER_UNVERIFIED")
        old = connection(db, cid, get)
        if old and old.get("owner_id") != user["id"]:
            return out("BLOCKED_BUSINESS_OWNER_CHANGED")
        c = {"id": cid, "owner_id": user["id"],
             "enabled": obj.get("is_enabled") is True,
             "can_reply": rights.get("can_reply") is True,
             "updated_at": now}
        put(db, key("connection", cid), json.dumps(c, separators=(",", ":")))
        # On disconnect, erase locally stored message text/drafts for that connection.
        if not c["enabled"]:
            rows = db.execute("SELECT id FROM jobs WHERE source='telegram-agent4' "
                              "AND external_id LIKE ?", (f"biz:{digest(cid)[:32]}:%",)).fetchall()
            if {"text", "draft"}.issubset(
                    {r[1] for r in db.execute("PRAGMA table_info(jobs)").fetchall()}):
                for r in rows:
                    with db:
                        db.execute("UPDATE jobs SET text='',draft=NULL WHERE id=?", (r[0],))
                        event_once(db, event, r[0], "BUSINESS_CONNECTION_DISCONNECTED_REDACTED")
            return out("BUSINESS_CONNECTION_DISABLED")
        return out("BUSINESS_CONNECTION_RECORDED", can_reply=c["can_reply"])
    if "deleted_business_messages" in update:
        obj = update["deleted_business_messages"]
        if not isinstance(obj, dict):
            return out("BLOCKED_DELETE_SHAPE")
        return redact(db, obj.get("business_connection_id"),
                      (obj.get("chat") or {}).get("id"),
                      obj.get("message_ids"), event)
    if "edited_business_message" in update:
        obj = update["edited_business_message"]
        if not isinstance(obj, dict):
            return out("BLOCKED_EDIT_SHAPE")
        return redact(db, obj.get("business_connection_id"),
                      (obj.get("chat") or {}).get("id"),
                      [obj.get("message_id")], event)
    if "business_message" not in update:
        return out("IGNORED_NOT_BUSINESS")
    msg = update["business_message"]
    if not isinstance(msg, dict):
        return out("IGNORED_BAD_MESSAGE")
    cid = msg.get("business_connection_id")
    c = connection(db, cid, get)
    if not c or get(db, "agent4_owner_test_peer_sha256", "") != digest(c.get("owner_id")):
        return out("BLOCKED_CONNECTION_NOT_VERIFIED")
    chat = msg.get("chat") or {}
    sender = msg.get("from") or {}
    if not isinstance(chat, dict) or not isinstance(sender, dict):
        return out("IGNORED_NOT_INCOMING_DM")
    peer = chat.get("id")
    mid = msg.get("message_id")
    stamp = msg.get("date")
    if (chat.get("type") != "private" or not is_id(peer) or
            not is_id(mid) or not is_id(stamp) or
            sender.get("id") != peer or sender.get("is_bot") or
            peer == c.get("owner_id") or
            stamp > now + 300 or stamp < now - 48 * 3600):
        return out("IGNORED_NOT_INCOMING_DM")
    message = msg.get("text")
    if not isinstance(message, str) or not message.strip() or len(message) > MAX_TEXT:
        return out("IGNORED_EMPTY_OR_OVERSIZE")
    if message.strip().casefold() in {"/stop", "stop", "unsubscribe", "odhlasit", "odhlasit se"}:
        put(db, key("optout", cid, peer), "1")
        return out("CHAT_OPTED_OUT")
    controller = permitted(db, cid, peer, get, c)
    if not controller:
        # Optional owner-enabled discovery: record just the numeric peer ID
        # locally, never their message body/name. No AI, sends or CRM before
        # affirmative per-chat permission. OFF unless explicitly enabled.
        if get(db, "agent4_biz_discovery_enabled", "0") == "1":
            put(db, key("candidate", cid, peer), str(now))
        return out("BLOCKED_CHAT_SCOPE_OR_CONSENT")
    ext = f"biz:{digest(cid)[:32]}:{mid}"
    job_id = enqueue(db, "telegram-agent4", str(peer), ext, message)
    if not is_id(job_id):
        return out("BLOCKED_ENQUEUE_NO_ACK")
    event_once(db, event, job_id, "BUSINESS_CONNECTION_SHA256:" + digest(cid)[:32])
    event_once(db, event, job_id, "CRM_REVIEW_REQUIRED:" + controller)
    # The first Pasha pilot must NOT be counted as a paying customer.
    if digest(peer) == get(db, "agent4_biz_test_peer_sha256", ""):
        event_once(db, event, job_id, "OWNER_SELFTEST_ONLY")
    last = int(get(db, key("last_inbound", cid, peer), "0") or "0")
    if stamp > last:
        put(db, key("last_inbound", cid, peer), str(stamp))
    return out("BUSINESS_MESSAGE_QUEUED_DRAFT_ONLY", job_id=job_id, controller=controller)


def approved_send(db, job_id, exact_go, get, api, existing_sender, now=None):
    """Never invoked by listener. Single owner-approved, provider-receipted send."""
    now = int(time.time()) if now is None else int(now)
    row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
    if (not row or row["source"] != "telegram-agent4" or
            row["state"] != "approved" or
            not str(row["external_id"]).startswith("biz:")):
        raise ValueError("Expected one approved personal business job")
    peer = int(row["peer"])
    if exact_go != f"SEND:{job_id}:{str(peer)[-4:]}":
        raise ValueError("Missing exact owner send GO")
    proof = db.execute("SELECT state FROM events WHERE job=? "
                       "AND state LIKE 'BUSINESS_CONNECTION_SHA256:%'", (job_id,)).fetchall()
    if len(proof) != 1:
        raise ValueError("No unique connection proof")
    d = proof[0][0].split(":", 1)[1]
    try:
        c = json.loads(get(db, "agent4_biz_connection:" + d, ""))
    except (ValueError, TypeError):
        raise ValueError("Missing business connection") from None
    cid = c.get("id")
    if not isinstance(cid, str) or digest(cid)[:32] != d:
        raise ValueError("Connection mismatched")
    if get(db, "agent4_owner_test_peer_sha256", "") != digest(c.get("owner_id")):
        raise ValueError("Business owner not verified")
    controller = permitted(db, cid, peer, get, c)
    if not controller:
        raise ValueError("Revoked chat rights or consent")
    scope = db.execute("SELECT state FROM events WHERE job=? "
                       "AND state LIKE 'CRM_REVIEW_REQUIRED:%'", (job_id,)).fetchall()
    if len(scope) != 1 or scope[0][0] != "CRM_REVIEW_REQUIRED:" + controller:
        raise ValueError("Controller mismatched")
    stamp = int(get(db, key("last_inbound", cid, peer), "0") or "0")
    if not (0 <= now - stamp < REPLY_WINDOW_SECONDS):
        raise ValueError("Reply window closed")
    if db.execute("SELECT 1 FROM events WHERE job=? AND state='OWNER_SELFTEST_ONLY'",
                  (job_id,)).fetchone() and get(db, "agent4_selftest_send_go", "") != "EXPLICIT_TEST_GO":
        raise ValueError("Test send requires separate GO")

    # The cached connection update may be stale after rights were revoked.
    # Check the current official Telegram connection just before provider egress.
    live = api("getBusinessConnection", {"business_connection_id": cid})
    rights = live.get("rights") if isinstance(live, dict) else None
    live_user = live.get("user") if isinstance(live, dict) else None
    if (not isinstance(live, dict) or live.get("id") != cid
            or not isinstance(live_user, dict) or live_user.get("id") != c["owner_id"]
            or live.get("is_enabled") is not True or not isinstance(rights, dict)
            or rights.get("can_reply") is not True):
        raise ValueError("Telegram business rights no longer valid")

    def send(method, payload):
        if method != "sendMessage" or "business_connection_id" in payload:
            raise ValueError("Provider call unsafe")
        return api(method, {**payload, "business_connection_id": cid})

    return existing_sender(db, job_id, {str(peer)}, send_fn=send)
