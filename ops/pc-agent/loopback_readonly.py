"""IMPERION Agent5: bounded temporary localhost-only diagnostic bridge.

This server is NOT a remote administration endpoint and cannot perform writes.
It accepts two fixed GET paths on 127.0.0.1, exposes a whitelisted summary
only, rejects mismatched Host headers and terminates automatically.
"""
import html
import json
import sys
import tempfile
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from restricted_executor import executor

ROUTES = {
    "/a5-status": "machine_status",
    "/a5-watchdog": "read_watchdog",
}


def make_server(root, port=0, accepted_limit=2):
    class SafeHandler(BaseHTTPRequestHandler):
        server_version = "ImperionAgent5-ReadOnly"
        sys_version = ""

        def log_message(self, fmt, *args):
            # Never log URL-supplied tokens or personal information.
            return

        def send_plain(self, status, message):
            body = (message + "\n").encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", "default-src 'none'")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            self.send_plain(405, "METHOD_NOT_ALLOWED")

        def do_GET(self):
            allowed_host = "127.0.0.1:" + str(self.server.server_address[1])
            if self.client_address[0] != "127.0.0.1" or self.headers.get("Host") != allowed_host:
                self.send_plain(403, "HOST_DENIED")
                return
            url = urlsplit(self.path)
            if url.query or url.fragment or url.path not in ROUTES:
                self.send_plain(404, "ROUTE_DENIED")
                return
            action = ROUTES[url.path]
            result = executor(
                {"action": action, "key": "AUD-LOCALBRIDGE-" + action},
                root=root
            )
            if result.get("status") != "DONE":
                self.send_plain(503, "DIAGNOSTIC_UNAVAILABLE")
                return
            safe_payload = json.dumps(result, ensure_ascii=True, sort_keys=True)
            title = "IMPERION Agent5 " + action + " DONE"
            body = (
                "<!doctype html><html lang='en'><head>"
                "<meta charset='utf-8'><title>" + html.escape(title) + "</title>"
                "</head><body><h1>" + html.escape(title) + "</h1>"
                "<pre id='a5-result'>" + html.escape(safe_payload) + "</pre>"
                "</body></html>"
            ).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'none'")
            self.send_header("X-Frame-Options", "DENY")
            self.end_headers()
            self.wfile.write(body)
            self.server.accepted += 1

    httpd = HTTPServer(("127.0.0.1", port), SafeHandler)
    httpd.timeout = 1.5
    httpd.accepted = 0
    httpd.accepted_limit = accepted_limit
    return httpd


def bounded_run(seconds=110):
    with tempfile.TemporaryDirectory(prefix="imperion-a5-local-") as tmp:
        root = Path(tmp) / "jobs"
        server = make_server(root)
        url = "http://127.0.0.1:" + str(server.server_address[1])
        print(json.dumps({"state": "LISTENING_LOOPBACK_ONLY", "base_url": url,
                          "routes": sorted(ROUTES), "max_results": 2,
                          "timeout_seconds": seconds}), flush=True)
        start = time.monotonic()
        try:
            while server.accepted < server.accepted_limit and time.monotonic() - start < seconds:
                server.handle_request()
        finally:
            server.server_close()
        print(json.dumps({"state": "STOPPED", "success_responses": server.accepted,
                          "temporary_sandbox_cleaned_on_exit": True}), flush=True)
        return 0 if server.accepted == server.accepted_limit else 4


def selftest():
    import threading
    import urllib.error
    import urllib.request
    with tempfile.TemporaryDirectory(prefix="imperion-a5-httpqa-") as tmp:
        root = Path(tmp) / "sandbox"
        server = make_server(root)
        base = "http://127.0.0.1:" + str(server.server_address[1])
        thread = threading.Thread(target=lambda: [server.handle_request() for _ in range(6)], daemon=True)
        thread.start()
        results = []
        try:
            def request(url, method="GET", host=None):
                headers = {"Host": host} if host else {}
                req = urllib.request.Request(url, headers=headers, method=method)
                try:
                    with urllib.request.urlopen(req, timeout=3) as response:
                        return response.status, response.read().decode("utf-8"), response.headers
                except urllib.error.HTTPError as exc:
                    return exc.code, exc.read().decode("utf-8"), exc.headers
            r = request(base + "/a5-status")
            results.append(("status_ok", r[0] == 200 and "machine_status DONE" in r[1]))
            results.append(("csp_and_no_cors", r[2].get("Content-Security-Policy") is not None and r[2].get("Access-Control-Allow-Origin") is None))
            r = request(base + "/a5-watchdog")
            expected = executor({"action": "read_watchdog", "key": "AUD-LOCALBRIDGE-read_watchdog"}, root=root)
            safe = ((r[0] == 200 and "read_watchdog DONE" in r[1]) if expected.get("status") == "DONE"
                    else (r[0] == 503 and "DIAGNOSTIC_UNAVAILABLE" in r[1]))
            results.append(("watchdog_sanitized", safe))
            results.append(("post_denied", request(base + "/a5-status", "POST")[0] == 405))
            results.append(("host_denied", request(base + "/a5-status", host="malicious.local")[0] == 403))
            results.append(("wrong_route_denied", request(base + "/other")[0] == 404))
            results.append(("query_injection_denied", request(base + "/a5-status?cmd=whoami")[0] == 404))
        finally:
            server.server_close()
        good = all(ok for _, ok in results)
    return {"status": "PASS" if good else "FAIL", "passed": sum(ok for _, ok in results),
            "total": len(results), "checks": results,
            "temporary_sandbox_removed": not Path(tmp).exists()}


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        outcome = selftest()
        print(json.dumps(outcome))
        sys.exit(0 if outcome["status"] == "PASS" else 1)
    if len(sys.argv) == 2 and sys.argv[1] == "--once":
        sys.exit(bounded_run())
    print("USAGE: --selftest OR --once")
    sys.exit(2)
