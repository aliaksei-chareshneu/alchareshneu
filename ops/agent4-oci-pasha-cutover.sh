#!/usr/bin/env bash
# Apply to the ONE existing OCI Agent4 service only. NO Telegram send.
set -euo pipefail
UNIT="imperion-agent4-telegram.service"
if [[ "$#" -gt 1 ]]; then echo "BLOCKED: expected --dry-run or --apply" >&2; exit 2; fi
if [[ "$#" -eq 0 ]]; then MODE="--dry-run"; else MODE="$1"; fi
if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "BLOCKED: use --dry-run or --apply" >&2
  exit 2
fi
for tool in curl python3 systemctl; do
  command -v "$tool" >/dev/null || { echo "BLOCKED: missing $tool" >&2; exit 2; }
done
exec_line="$(systemctl show "$UNIT" -p ExecStart --value)"
if [[ -z "$exec_line" ]]; then
  echo "BLOCKED: existing Agent4 service not found" >&2
  exit 2
fi
TARGET="$(printf '%s' "$exec_line" | python3 -c '
import sys,re
data=sys.stdin.read()
found=set(re.findall(r"(/[A-Za-z0-9_./+-]+/agent4_telegram\.py)(?=[ ;}])",data))
if len(found)!=1:sys.exit(2)
print(next(iter(found)))
')" || { echo "BLOCKED: unable to prove the one deployed Agent4 listener path" >&2; exit 2; }
if [[ ! -f "$TARGET" ]]; then
  echo "BLOCKED: listener file absent" >&2
  exit 2
fi
ROOT="$(dirname "$TARGET")"
if [[ ! -f "$ROOT/net.py" ]]; then
  echo "BLOCKED: existing Agent4 net.py absent" >&2
  exit 2
fi
# Pinned reviewed source: no moving main branch or supply-chain surprises.
REV="3594bdfccb0115db8015b42b195c8a64f5b728a5"
BASE="https://raw.githubusercontent.com/aliaksei-chareshneu/alchareshneu/$REV/ops"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
curl --fail --silent --show-error --location --retry 2 --connect-timeout 10 \
  "$BASE/agent4_business_connection.py" -o "$STAGE/agent4_business_connection.py"
curl --fail --silent --show-error --location --retry 2 --connect-timeout 10 \
  "$BASE/install-agent4-chat-automation.py" -o "$STAGE/install-agent4-chat-automation.py"
python3 - "$STAGE" <<'PY'
from pathlib import Path
from hashlib import sha1
import sys
p=Path(sys.argv[1])
proof={
 "agent4_business_connection.py":"25dc7d14e0b21e536a81b05b88bfa24a22cb423b",
 "install-agent4-chat-automation.py":"7e0f3245dbf3764838f60ce61cf6fe9f7a055f72"
}
for name,expected in proof.items():
 b=(p/name).read_bytes()
 h=sha1(b"blob "+str(len(b)).encode()+b"\x00"+b).hexdigest()
 if h!=expected:raise SystemExit("BLOCKED: source content SHA mismatch")
print("SOURCE_BLOB_HASHES_VERIFIED")
PY
python3 -B "$STAGE/install-agent4-chat-automation.py" --target "$TARGET"
if [[ "$MODE" == "--dry-run" ]]; then
  echo "DRY_RUN_OK: no service stopped, no database changes, no sends"
  exit 0
fi
if ! systemctl is-active --quiet "$UNIT"; then
  echo "BLOCKED: source service was already inactive; diagnose first" >&2
  exit 2
fi
systemctl stop "$UNIT"
if ! APPLY_RESULT="$(python3 -B "$STAGE/install-agent4-chat-automation.py" \
  --target "$TARGET" --apply --go GO_AGENT4_CHAT_AUTOMATION_TECH_ONLY 2>&1)"; then
  echo "BLOCKED: install rejected, restarting unchanged service" >&2
  systemctl start "$UNIT" || true
  exit 2
fi
BACKUP="$(printf '%s\n' "$APPLY_RESULT" | sed -n 's/^BACKUP=//p' | tail -n 1)"
if ! systemctl start "$UNIT"; then
  echo "ERROR: service restart failed; restoring source" >&2
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    cp -p "$BACKUP" "$TARGET"
    rm -f "$ROOT/agent4_business_connection.py"
    systemctl start "$UNIT" || true
  fi
  exit 2
fi
sleep 3
if ! systemctl is-active --quiet "$UNIT"; then
  echo "ERROR: service inactive after start; restoring source" >&2
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    systemctl stop "$UNIT" || true
    cp -p "$BACKUP" "$TARGET"
    rm -f "$ROOT/agent4_business_connection.py"
    systemctl start "$UNIT" || true
  fi
  exit 2
fi
if ! grep -Fq '"business_message"' "$TARGET"; then
  echo "ERROR: listener source missing business updates; restoring source" >&2
  if [[ -n "$BACKUP" && -f "$BACKUP" ]]; then
    systemctl stop "$UNIT" || true
    cp -p "$BACKUP" "$TARGET"
    rm -f "$ROOT/agent4_business_connection.py"
    systemctl start "$UNIT" || true
  fi
  exit 2
fi
echo "OCI_SOURCE_INSTALLED_AND_SERVICE_ACTIVE"
echo "NO_PROVIDER_INCOMING_RECEIPT_VERIFIED"
echo "NO_TELEGRAM_SEND_AND_NO_NEW_CONSUMER"
echo "NEXT: verify Telegram connection rights and one allowed Pasha update"
