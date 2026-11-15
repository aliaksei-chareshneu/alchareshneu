#!/usr/bin/env bash
# ONLY GitHub Actions bot publisher for a verified owner-controlled public source.
# Never auto-merge, deploy, modify trusted tests or publish model-generated output.
set -euo pipefail
: "${RUNNER_TEMP:?RUNNER_TEMP_REQUIRED}" "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE_REQUIRED}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN_REQUIRED}" "${GH_TOKEN:?GH_TOKEN_REQUIRED}"
test "$GITHUB_EVENT_NAME" = "issue_comment"
node scripts/imperion-dev-bootstrap.cjs --check-event
proof="$RUNNER_TEMP/imperion-dev-cloud-proof/imperion-dev-bootstrap-proposal.json"
receipt="$RUNNER_TEMP/imperion-dev-cloud-proof/imperion-dev-bootstrap-receipt.json"
test -s "$proof" && test -s "$receipt"
node -e 'const p=require(process.argv[1]),r=require(process.argv[2]);
 const B=require("./scripts/imperion-dev-bootstrap.cjs");
 const policy=require("./scripts/imperion-dev-model-policy.cjs");
 B.verifyManifest(p,process.cwd());
 if(p.model!==policy.selectedModel()||
    r.status!=="BOOTSTRAP_TRUSTED_AND_ADVISORY_TESTS_PASS"||
    r.source!==p.task.file||r.source_sha256!==p.source_sha256||
    r.advisory!==p.generated_file||r.advisory_sha256!==p.generated_sha256||
    r.trusted_test!==p.task.test||r.trusted_test_sha256!==p.trusted_test_sha256||
    r.issue!==p.task.issue||r.comment!==p.task.comment||r.model!==p.model||
    r.advisory_not_independent!==true||r.auto_merge!==false||
    r.paid_api_czk!==0||r.review_only!==true||p.paid_api_czk!==0)process.exit(9)' \
 "$proof" "$receipt"
file="$(node -e 'process.stdout.write(require(process.argv[1]).task.file)' "$proof")"
advisory="$(node -e 'process.stdout.write(require(process.argv[1]).generated_file)' "$proof")"
model="$(node -e 'process.stdout.write(require(process.argv[1]).model)' "$proof")"
provider="$(node -e 'process.stdout.write(require("./scripts/imperion-dev-model-policy.cjs").selectedProvider())')"
issue="$(node -e 'process.stdout.write(String(require(process.argv[1]).task.issue))' "$proof")"
comment="$(node -e 'process.stdout.write(String(require(process.argv[1]).task.comment))' "$proof")"
review="agent/imperion-dev-bootstrap-$issue-$comment"
if git ls-remote --exit-code --heads origin "$review" >/dev/null 2>&1; then
 gh pr list --head "$review" --base main --state open \
   --json number,isDraft --limit 3 > "$RUNNER_TEMP/bootstrap-existing-pr.json"
 node -e 'const a=require(process.argv[1]);if(a.length!==1||a[0].isDraft!==true)process.exit(9)' \
   "$RUNNER_TEMP/bootstrap-existing-pr.json"
 echo 'BOOTSTRAP_DRAFT_PR_ALREADY_EXISTS_NO_DUPLICATE' >> "$GITHUB_STEP_SUMMARY"
 exit 0
fi
node scripts/imperion-dev-bootstrap.cjs --apply "$proof" "$GITHUB_WORKSPACE"
git diff --check
expected="$(printf '%s\n' "$file" "$advisory" | LC_ALL=C sort)"
actual="$(git diff --name-only && git ls-files --others --exclude-standard)"
test "$(printf '%s\n' "$actual" | LC_ALL=C sort)" = "$expected"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git switch -c "$review"
git add -- "$file" "$advisory"
git diff --cached --check
test "$(git diff --cached --name-only | LC_ALL=C sort)" = "$expected"
git commit -m "feat(dev): test-first public module issue $issue comment $comment"
git push --set-upstream origin "$review"
gh pr create --draft --base main --head "$review" \
 --title "DRAFT: $model test-first new public module, issue $issue comment $comment" \
 --body "Owner public Issue $issue, comment $comment. Provider: $provider, exact verified model: $model. NEW public module created from EXISTING committed independent trusted test. Baseline fails due to missing module; patched trusted test and generated DATA-ONLY advisory pass in no-network non-root read-only Docker. Advisory test is NOT independent acceptance. No private source, subscriptions, paid fallback, test replacement, auto-merge or deployment. OWNER REVIEW REQUIRED."
gh pr list --head "$review" --base main --state open \
  --json number,isDraft --limit 3 > "$RUNNER_TEMP/bootstrap-created-pr.json"
node -e 'const a=require(process.argv[1]);if(a.length!==1||a[0].isDraft!==true)process.exit(9)' \
 "$RUNNER_TEMP/bootstrap-created-pr.json"
echo 'BOOTSTRAP_GITHUB_DRAFT_PR_CREATED_OWNER_REVIEW_REQUIRED' >> "$GITHUB_STEP_SUMMARY"
