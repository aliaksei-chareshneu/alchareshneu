#!/usr/bin/env bash
# Public test-first new module: baseline must fail due to missing module;
# the patched module + generated advisory must pass independent no-network Docker.
set -euo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP_REQUIRED}" "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE_REQUIRED}"
node scripts/imperion-dev-bootstrap.cjs --event
proof="$RUNNER_TEMP/imperion-dev-bootstrap-proposal.json"
test -s "$proof"
trusted="$(node -e 'process.stdout.write(require(process.argv[1]).task.test)' "$proof")"
target="$(node -e 'process.stdout.write(require(process.argv[1]).task.file)' "$proof")"
advisory="$(node -e 'process.stdout.write(require(process.argv[1]).generated_file)' "$proof")"
baseline="$RUNNER_TEMP/imperion-dev-bootstrap-baseline.log"
if timeout 65s docker run --rm --network none --read-only --cap-drop ALL \
   --security-opt no-new-privileges --pids-limit 64 --memory 512m \
   --cpus 1 --user 10001:10001 --tmpfs /tmp:rw,noexec,nosuid,size=64m \
   -e IMPERION_DEV_BOOTSTRAP_ACCEPTANCE=1 \
   -v "$GITHUB_WORKSPACE:/work:ro" -w /work node:22-alpine \
   node --test "$trusted" > "$baseline" 2>&1; then
 echo 'BLOCKED: BOOTSTRAP_TRUSTED_TEST_ALREADY_GREEN' >> "$GITHUB_STEP_SUMMARY"
 exit 9
fi
# An unrelated failing test, invalid command or timeout does NOT count as red.
grep -Eq 'Cannot find module|MODULE_NOT_FOUND' "$baseline" || {
 echo 'BLOCKED: BOOTSTRAP_TEST_FAILED_FOR_WRONG_REASON' >> "$GITHUB_STEP_SUMMARY"
 exit 9
}
sandbox="$RUNNER_TEMP/imperion-dev-bootstrap-sandbox"
mkdir -p "$sandbox"
git ls-files -z | tar --null -T - -cf - | tar -C "$sandbox" -xf -
node scripts/imperion-dev-bootstrap.cjs --apply "$proof" "$sandbox"
node --check "$sandbox/$target"
node --check "$sandbox/$advisory"
timeout 75s docker run --rm --network none --read-only --cap-drop ALL \
   --security-opt no-new-privileges --pids-limit 64 --memory 512m \
   --cpus 1 --user 10001:10001 --tmpfs /tmp:rw,noexec,nosuid,size=64m \
   -e IMPERION_DEV_BOOTSTRAP_ACCEPTANCE=1 \
   -v "$sandbox:/work:ro" -w /work node:22-alpine \
   node --test "$trusted" "$advisory" > "$RUNNER_TEMP/imperion-dev-bootstrap-green.log" 2>&1 || {
 tail -n 25 "$RUNNER_TEMP/imperion-dev-bootstrap-green.log"
 exit 9
}
grep -Eq '^# tests [1-9][0-9]*$' "$RUNNER_TEMP/imperion-dev-bootstrap-green.log"
grep -Fxq '# fail 0' "$RUNNER_TEMP/imperion-dev-bootstrap-green.log"
node -e 'const fs=require("node:fs"),p=require(process.argv[1]);
 const B=require("./scripts/imperion-dev-bootstrap.cjs");
 B.verifyManifest(p,process.cwd());
 if(p.status!=="BOOTSTRAP_MODEL_PROPOSAL_ONLY"||p.auto_merge!==false||
    p.generated_test_not_independent!==true||p.paid_api_czk!==0)process.exit(9);
 const r={status:"BOOTSTRAP_TRUSTED_AND_ADVISORY_TESTS_PASS",
  issue:p.task.issue,comment:p.task.comment,model:p.model,
  source:p.task.file,source_sha256:p.source_sha256,
  trusted_test:p.task.test,trusted_test_sha256:p.trusted_test_sha256,
  advisory:p.generated_file,advisory_sha256:p.generated_sha256,
  advisory_not_independent:true,auto_merge:false,paid_api_czk:0,
  independent_original:"MISSING_MODULE_BASELINE_FAIL",
  independent_patched:"TRUSTED_AND_ADVISORY_GREEN",review_only:true};
 fs.writeFileSync(process.argv[2],JSON.stringify(r,null,2)+"\n",{flag:"wx"});' \
 "$proof" "$RUNNER_TEMP/imperion-dev-bootstrap-receipt.json"
echo 'BOOTSTRAP_TRUSTED_AND_ADVISORY_TESTS_PASS_OWNER_REVIEW_ONLY' >> "$GITHUB_STEP_SUMMARY"
