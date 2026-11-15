#!/usr/bin/env bash
# Existing Developer #1: publish ONE independently verified milestone as Draft PR.
# Never merge, change permissions, spend money, deploy or grant model shell access.
set -euo pipefail
cd "$GITHUB_WORKSPACE"
: "${RUNNER_TEMP:?}"
: "${GITHUB_EVENT_PATH:?}"
: "${GH_TOKEN:?}"
: "${GITHUB_ENV:?}"
proof_dir="$RUNNER_TEMP/imperion-dev-cloud-proof"
stage_proof="$proof_dir/imperion-dev-project-stage-proof.json"
test -s "$stage_proof"
test -s "$proof_dir/imperion-dev-project-plan.json"
test -s "$proof_dir/imperion-dev-department-plan.json"
test -s "$proof_dir/imperion-dev-autonomous-proposal.json"
test -s "$proof_dir/imperion-dev-autonomous-receipt.json"
test -s "$proof_dir/imperion-dev-department-review.json"
cp -- "$stage_proof" "$RUNNER_TEMP/imperion-dev-project-stage-proof.json"
export IMPERION_DEV_PROJECT_STAGE_PROOF="$RUNNER_TEMP/imperion-dev-project-stage-proof.json"
stage="$(node -e 'const p=require(process.argv[1]);if(!Number.isInteger(p.stage)||p.stage<1||p.stage>4)process.exit(9);process.stdout.write(String(p.stage))' "$stage_proof")"
base="$(node -e 'const p=require(process.argv[1]),c=require("./scripts/imperion-dev-project-control.cjs");process.stdout.write(c.stageSpec(p.plan,p.stage).base)' "$stage_proof")"
head="$(node -e 'const p=require(process.argv[1]),c=require("./scripts/imperion-dev-project-control.cjs");process.stdout.write(c.stageSpec(p.plan,p.stage).head)' "$stage_proof")"
project_id="$(node -e 'const p=require(process.argv[1]);process.stdout.write(p.plan.project_id)' "$stage_proof")"
marker="$(node -e 'const p=require(process.argv[1]),c=require("./scripts/imperion-dev-project-control.cjs");process.stdout.write(c.stageSpec(p.plan,p.stage).marker)' "$stage_proof")"
model="$(node -e 'const p=require(process.argv[1]);process.stdout.write(p.plan.model)' "$stage_proof")"
stage_count="$(node -e 'const p=require(process.argv[1]);process.stdout.write(String(p.plan.milestones.length))' "$stage_proof")"
if [ "$stage" -gt 1 ]; then
  predecessor_sha="$(node -e 'const p=require(process.argv[1]);process.stdout.write(p.readback.at(-1).sha)' "$stage_proof")"
  predecessor_branch="$(node -e 'const p=require(process.argv[1]),c=require("./scripts/imperion-dev-project-control.cjs");process.stdout.write(c.stageSpec(p.plan,p.stage-1).head)' "$stage_proof")"
  git fetch --no-tags --depth=1 origin "refs/heads/$predecessor_branch"
  test "$(git rev-parse FETCH_HEAD)" = "$predecessor_sha" || {
    echo "BLOCKED_PREDECESSOR_HEAD_CHANGED" >&2; exit 9;
  }
  git switch --detach "$predecessor_sha"
else
  test "$base" = 'main'
fi
node scripts/imperion-dev-project-publish.cjs --verify "$proof_dir"
target="$RUNNER_TEMP/imperion-dev-project-publish-target.json"
test -s "$target"
node -e 'const x=require(process.argv[1]);if(x.publisher!=="GITHUB_ACTIONS_DRAFT_ONLY"||
 x.review_status!=="DEPARTMENT_REVIEW_PASS"||x.auto_merge!==false||
 x.head!==process.argv[2]||x.base!==process.argv[3])process.exit(9)' "$target" "$head" "$base"
if git ls-remote --exit-code --heads origin "$head" >/dev/null 2>&1; then
  gh pr list --state open --head "$head" --base "$base" --limit 3 \
    --json number,isDraft,headRefName,baseRefName,body \
    > "$RUNNER_TEMP/imperion-dev-project-existing.json"
  node -e 'const x=require(process.argv[1]);
    if(x.length!==1||x[0].isDraft!==true||x[0].headRefName!==process.argv[2]||
       x[0].baseRefName!==process.argv[3]||
       typeof x[0].body!=="string"||!x[0].body.includes(process.argv[4]))
      process.exit(9)' "$RUNNER_TEMP/imperion-dev-project-existing.json" "$head" "$base" "$marker"
  echo "PROJECT_EXISTING_DRAFT_PR_NO_DUPLICATE" >> "$GITHUB_STEP_SUMMARY"
  exit 0
fi
node scripts/imperion-dev-autonomous.cjs --apply \
  "$proof_dir/imperion-dev-autonomous-proposal.json" "$GITHUB_WORKSPACE"
node scripts/imperion-dev-project-publish.cjs --plan-file "$proof_dir" "$stage"
git diff --check
mapfile -t expected < <(node -e 'const p=require(process.argv[1]);for(const s of p.expected_paths)console.log(s)' "$target")
mapfile -t actual < <( { git diff --name-only; git ls-files --others --exclude-standard; } | LC_ALL=C sort)
node scripts/imperion-dev-project-publish.cjs --check-diff "$proof_dir" "${actual[@]}"
test "${#actual[@]}" -eq "${#expected[@]}"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git switch -c "$head"
git add -- "${expected[@]}"
git diff --cached --check
mapfile -t staged < <(git diff --cached --name-only | LC_ALL=C sort)
test "$(printf '%s\n' "${staged[@]}")" = "$(printf '%s\n' "${expected[@]}")"
git commit -m "feat(dev): project $project_id milestone $stage review-only"
git push --set-upstream origin "$head"
head_sha="$(git rev-parse HEAD)"
plan_sha="$(node -e 'const p=require(process.argv[1]);process.stdout.write(p.plan.plan_sha256)' "$stage_proof")"
receipt_line="GitHub workflow receipt: run=$GITHUB_RUN_ID stage=$stage sha=$head_sha plan=$plan_sha"
summary="$(node scripts/imperion-dev-department.cjs --summary "$proof_dir")"
body="$(printf '%s\n\n%s\n\n%s\n\n%s\n\n%s\n' \
  "$marker"$'\n'"Planned stages: $stage_count" \
  "Developer #1: verified project $project_id milestone $stage. Provider Groq Free model $model. Existing trusted tests and isolated no-network Docker QA: PASS. Same-provider independent-role reviewer: PASS, not independent correctness proof. Generated advisory: NOT independent. Human review required." \
  "$summary" \
  "$receipt_line" \
  "No auto-merge, deployment, paid fallback, customer data, private source or repo settings changes. FOLLOW-UP STAGES REQUIRE EXACT PREDECESSOR CI EVIDENCE.")"
gh pr create --draft --base "$base" --head "$head" \
  --title "DRAFT: IMPERION DEV project $project_id stage $stage ($model)" \
  --body "$body"
gh pr list --state open --head "$head" --base "$base" --limit 3 \
  --json number,isDraft,headRefName,baseRefName,body \
  > "$RUNNER_TEMP/imperion-dev-project-created.json"
node -e 'const x=require(process.argv[1]);
  if(x.length!==1||!x[0].isDraft||x[0].headRefName!==process.argv[2]||
     x[0].baseRefName!==process.argv[3]||
     typeof x[0].body!=="string"||!x[0].body.includes(process.argv[4]))process.exit(9)' \
   "$RUNNER_TEMP/imperion-dev-project-created.json" "$head" "$base" "$marker"
receipt_name="$(node -e 'const p=require(process.argv[1]),P=require("./scripts/imperion-dev-project-control.cjs");process.stdout.write(P.stageArtifactName(p.plan,p.stage,process.argv[2]))' "$stage_proof" "$head_sha")"
echo "IMPERION_DEV_PROJECT_STAGE_ARTIFACT_NAME=$receipt_name" >> "$GITHUB_ENV"
echo "PROJECT_REVIEW_ONLY_DRAFT_PR_OPENED_AND_READBACK_VERIFIED" >> "$GITHUB_STEP_SUMMARY"
