#!/usr/bin/env bash
# Reuse existing Stage11 trusted tests for ONE code revision after a real failure.
set -euo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP_REQUIRED}" "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE_REQUIRED}"
proof="${1:?PROOF_REQUIRED}"
trusted="${2:?TRUSTED_TEST_REQUIRED}"
draft="${3:?ADVISORY_TEST_REQUIRED}"
test "$proof" = "$RUNNER_TEMP/imperion-dev-autonomous-proposal.json"
node scripts/imperion-dev-autonomous.cjs --retry-code "$proof"
sandbox="$RUNNER_TEMP/imperion-dev-autonomous-code-repair"
mkdir -p "$sandbox"
git ls-files -z | tar --null -T - -cf - | tar -C "$sandbox" -xf -
# The new proposal must independently meet the baseline witness condition.
bash scripts/imperion-dev-witness.sh "$proof"
node scripts/imperion-dev-autonomous.cjs --apply "$proof" "$sandbox"
node -e 'const p=require(process.argv[1]);if(p.task.test!==process.argv[2]||
  p.generated_file!==process.argv[3]||p.code_retry_done!==true)process.exit(9)' \
  "$proof" "$trusted" "$draft"
for f in $(node -e 'process.stdout.write(require(process.argv[1]).selected.join(" "))' "$proof"); do
  node --check "$sandbox/$f"
done
node --check "$sandbox/$draft"
docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit 64 --memory 512m \
  --cpus 1 --user 10001:10001 --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -v "$sandbox:/work:ro" -w /work node:22-alpine \
  node --test "$trusted" "$draft" > "$RUNNER_TEMP/imperion-dev-auto-repaired-tests.log" 2>&1 || {
    tail -n 35 "$RUNNER_TEMP/imperion-dev-auto-repaired-tests.log"
    exit 9
  }
grep -Eq '^# tests [1-9][0-9]*$' "$RUNNER_TEMP/imperion-dev-auto-repaired-tests.log"
grep -Fxq '# fail 0' "$RUNNER_TEMP/imperion-dev-auto-repaired-tests.log"
echo 'AUTO_CODE_REPAIR_ONE_ATTEMPT_PASS_REVIEW_ONLY' >> "$GITHUB_STEP_SUMMARY"
