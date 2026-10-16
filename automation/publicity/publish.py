"""Instagram publisher with explicit approval, fail-closed safety and duplicate checks.

Only handles approved scheduled IG photo posts, not Stories, reels or FB posts.
Uses the official Instagram Graph API; no token is stored in source.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "https://graph.facebook.com/v21.0"
QUEUE = HERE / "queue.json"

def parse_date(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)

def eligible(post, now, enabled=False, insurance=False):
    """Return publish/hold/skip and reason. Fail closed by default."""
    if post.get("platform") != "instagram":
        return "skip", "Only instagram posts are supported; FB remains in Metricool."
    if not post.get("approved", False):
        return "hold", "Post has not been approved."
    if not post.get("safety_cleared", False):
        return "hold", "Safety/organiser approval is missing."
    if post.get("requires_insurance", False) and not insurance:
        return "hold", "Insurance documentation has not been verified."
    if parse_date(post["expires_at"]) <= now:
        return "skip", "Event promotion has expired."
    if parse_date(post["publish_not_before"]) > now:
        return "hold", "Publication date has not arrived."
    if not enabled:
        return "hold", "Publisher disabled (PUBLICITY_ENABLED != true)."
    return "publish", "All gates passed."

def graph(endpoint, token, params, post=False):
    args = dict(params)
    args["access_token"] = token
    data = urllib.parse.urlencode(args).encode("utf-8")
    if post:
        req = urllib.request.Request(API + endpoint, data=data, method="POST")
    else:
        req = urllib.request.Request(API + endpoint + "?" + data.decode("utf-8"), method="GET")
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))

def published_marker_present(ig_id, token, marker):
    """Check recent IG media to prevent republishing when a previous run succeeded."""
    result = graph("/" + ig_id + "/media", token, {"fields": "id,caption", "limit": "100"})
    return any(marker in (item.get("caption") or "") for item in result.get("data", []))

def publish_post(ig_id, token, item):
    marker = item["marker"]
    if published_marker_present(ig_id, token, marker):
        print(item["id"], "SKIPPED: marker already found in IG media.")
        return
    caption = item["caption"].rstrip() + "\n\n" + marker
    result = graph("/" + ig_id + "/media", token, {
        "image_url": item["image_url"],
        "caption": caption
    }, post=True)
    container = result.get("id")
    if not container:
        raise ValueError("No media container returned")
    # Instagram requires the media container to finish processing first.
    import time
    for _ in range(8):
        status = graph("/" + container, token, {"fields": "status_code"}).get("status_code")
        if status == "FINISHED":
            break
        if status in ("ERROR", "EXPIRED"):
            raise RuntimeError("Instagram media container status: " + status)
        time.sleep(5)
    else:
        raise RuntimeError("Instagram media container not ready; do not retry blindly.")
    response = graph("/" + ig_id + "/media_publish", token, {"creation_id": container}, post=True)
    if not response.get("id"):
        raise RuntimeError("Instagram did not return a published media ID.")
    print(item["id"], "PUBLISHED", response["id"])

def self_test():
    now = parse_date("2026-10-17T08:00:00+02:00")
    baseline = dict(
        platform="instagram", approved=True, safety_cleared=True,
        requires_insurance=True,
        publish_not_before="2026-10-16T00:00:00+02:00",
        expires_at="2026-10-18T09:30:00+02:00"
    )
    assert eligible(baseline, now, enabled=True, insurance=True)[0] == "publish"
    assert eligible(baseline, now, enabled=True, insurance=False)[0] == "hold"
    assert eligible(baseline, now, enabled=False, insurance=True)[0] == "hold"
    assert eligible(dict(baseline, approved=False), now, True, True)[0] == "hold"
    assert eligible(baseline, parse_date("2026-10-18T10:00:00+02:00"), True, True)[0] == "skip"
    print("Self-test PASSED: safety, approval, expiry, disabled mode.")

def main():
    if "--self-test" in sys.argv:
        self_test()
        return
    posts = json.loads(QUEUE.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    enabled = os.getenv("PUBLICITY_ENABLED", "").lower() == "true"
    insurance = os.getenv("PUBLICITY_INSURANCE_VERIFIED", "").lower() == "true"
    id_ = os.getenv("IG_BUSINESS_ID", "")
    token = os.getenv("IG_GRAPH_TOKEN", "")
    if not isinstance(posts, list):
        raise ValueError("queue.json must be an array")
    seen = set()
    for item in posts:
        if item["id"] in seen or not item.get("marker") or not item.get("image_url", "").startswith("https://"):
            raise ValueError("Duplicate/missing ID, marker or public image URL")
        seen.add(item["id"])
        action, why = eligible(item, now, enabled, insurance)
        print(item["id"], action.upper() + ":", why)
        if action != "publish":
            continue
        if not id_ or not token:
            raise RuntimeError("IG_BUSINESS_ID / IG_GRAPH_TOKEN GitHub secrets not configured")
        try:
            publish_post(id_, token, item)
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError) as err:
            # Avoid printing credentials, raw requests, authorization headers.
            raise RuntimeError(f"Meta publish failed (HTTP/network/format): {type(err).__name__}") from None

if __name__ == "__main__":
    main()
