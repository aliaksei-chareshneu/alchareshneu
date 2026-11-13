#!/usr/bin/env bash
# Existing IMPERION DEV Agent #1: optional advisory mutation witness, review-only.
# The model supplies JSON test data; trusted controller owns executable test code.
set -euo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP_REQUIRED}" "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE_REQUIRED}"
proof="${1:?MANIFEST_REQUIRED}"
test "$proof" = "$RUNNER_TEMP/imperion-dev-autonomous-proposal.json"
behavior="$(node -e 'const A=require("./scripts/imperion-dev-autonomous.cjs");const p=require(process.argv[1]);
 process.stdout.write(A.requiresBehaviorWitness(p,process.cwd())?"yes":"no")' "$proof")"
if [ "$behavior" = "no" ]; then
  echo 'ADVISORY_BEHAVIOR_WITNESS_NOT_REQUIRED' >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi
test "$behavior" = "yes"
draft="$(node -e 'process.stdout.write(require(process.argv[1]).generated_file)' "$proof")"
case "$draft" in tests/generated/imperion-dev-auto-*.test.cjs|tests/generated/imperion-dev-autonomous-preview.test.cjs) ;; *) exit 9 ;; esac
original="$RUNNER_TEMP/imperion-dev-advisory-original"
mkdir -p "$original"
git ls-files -z | tar --null -T - -cf - | tar -C "$original" -xf -
mkdir -p "$original/$(dirname "$draft")"
for attempt in 1 2; do
  node -e 'const fs=require("node:fs"),A=require("./scripts/imperion-dev-autonomous.cjs");
    const p=require(process.argv[1]);A.verifyManifest(p,process.cwd());
    fs.writeFileSync(process.argv[2],A.renderTest(p.task,p.test_draft),"utf8")' \
    "$proof" "$original/$draft"
  log="$RUNNER_TEMP/imperion-dev-advisory-baseline-$attempt.log"
  if docker run --rm --network none --read-only --cap-drop ALL \
     --security-opt no-new-privileges --pids-limit 64 --memory 512m \
     --cpus 1 --user 10001:10001 --tmpfs /tmp:rw,noexec,nosuid,size=64m \
     -v "$original:/work:ro" -w /work node:22-alpine \
     node --test "$draft" > "$log" 2>&1; then
    if [ "$attempt" -eq 2 ]; then
      echo 'BLOCKED: ADVISORY_DID_NOT_DETECT_NEW_BEHAVIOR' >> "$GITHUB_STEP_SUMMARY"
      exit 9
    fi
    node scripts/imperion-dev-autonomous.cjs --retry-advisory "$proof"
  else
    grep -Eq '^# tests [1-9][0-9]*$' "$log"
    grep -Eq '^# fail [1-9][0-9]*$' "$log"
    echo 'ADVISORY_BASELINE_BEHAVIOR_WITNESS_PASS' >> "$GITHUB_STEP_SUMMARY"
    exit 0
  fi
done
exit 9
