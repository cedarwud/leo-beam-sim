#!/usr/bin/env bash
# THE acceptance drill for the rendering-convergence work.
#
# The owner's criterion is not lines of code and not module count. It is:
#
#     "改一件渲染決策要動幾個檔案" — to change ONE rendering decision, how many
#     files do I have to open?
#
# `appearance-change-cost.ts` answers that statically, by counting the sites a
# decision is spread across. This script answers it EMPIRICALLY: it performs each
# change for real, one owner-phrased prompt at a time, and reports
#
#   - how many files the edit touched,
#   - whether the change actually reached the rendered output (proved by rows of
#     the 270-row characterization photograph moving),
#   - and that reverting restores the exact prior state.
#
# The middle check is the one that matters and the one a file count alone cannot
# give you. A one-file edit that changes nothing on screen is not a win — it is
# the same "I changed it and nothing happened" the owner already reports. So each
# drill asserts BOTH that the blast radius was one file AND that pixels moved.
#
# Usage:  bash scripts/audit/appearance-change-drill.sh
# Exit 0 only if every drill matches its expectation (expect_pass passes, expect_fail fails).
# Exit non-zero if a drill regresses OR if an expect_fail drill unexpectedly passes (stale board).

set -uo pipefail
cd "$(dirname "$0")/../.."

TEST="src/scene/appearanceCharacterization.test.ts"
MODIFIERS="src/appearance/handoverAppearanceModifiers.ts"
SHADE="src/appearance/intraHandoverShade.ts"
SERVING="src/constants/servingColour.ts"
VISIBILITY="src/appearance/beamVisibilityContract.ts"
GEOMETRY="src/appearance/coneGeometryContract.ts"
TIMING="src/appearance/handoverTimingEnvelope.ts"
MARKERS="src/scene/renderedLiveSatelliteMarkers.ts"
RAIL="src/homepage/controller/railProjection.ts"
FINAL_COLOUR="src/appearance/resolveBeamAppearance.ts"
SHADE_MAPPING="src/viz/HandoverLinks.tsx"

VISIBILITY_TEST="src/appearance/beamVisibilityCharacterization.test.ts"
GEOMETRY_TEST="src/appearance/coneGeometryCharacterization.test.ts"
TIMING_TEST="src/appearance/handoverTimingEnvelopeCharacterization.test.ts"
SINK_TEST="src/appearance/sinkAppearanceCharacterization.test.ts"
RAIL_TEST="src/appearance/railPresentationCharacterization.test.ts"
FINAL_COLOUR_TEST="src/appearance/beamColourPrecedenceCharacterization.test.ts"
SHADE_MAPPING_TEST="src/appearance/satelliteIdentityChannelCharacterization.test.ts"

total_drills=0
converged_count=0
frontier_count=0
regressions=0
unexpected_passes=0
# A drill that could not be APPLIED measured nothing. It is neither a pass nor a
# fail, and bucketing it as either is how a board starts lying: an unappliable
# expect_fail drill was being reported as "unexpectedly passed — decision has
# converged", which invites flipping it to expect_pass and permanently recording
# a convergence that was never observed. Invalid is its own outcome.
invalid_count=0
mismatches=0

converged_prompts=()
frontier_prompts=()
regression_prompts=()
unexpected_pass_prompts=()
invalid_prompts=()

# How many rows of the pinned photograph differ. 0 means the edit was inert.
# Did the edit actually reach the rendered output?
#
# This used to count deepEqual array-diff lines (^ [+-] '...'), because the
# original characterization was one 284-row string array. The per-axis
# characterizations added later use assert.equal, whose failure output has a
# completely different shape — so a test that genuinely went RED reported ZERO
# rows moved, and the drill called a working seam "decorative". Four drills were
# misreported that way before it was caught.
#
# Count FAILING ASSERTIONS instead: that is the property actually being asked
# about ("did the pinned behaviour move"), and it is independent of which
# assertion style the test happens to use.
changed_rows() {
  local out
  out=$(node --import tsx/esm --test "$1" 2>&1)
  local failed
  failed=$(printf '%s' "$out" | grep -oE "^# fail [0-9]+|^ℹ fail [0-9]+" | grep -oE "[0-9]+$" | head -1)
  [ -z "$failed" ] && failed=0
  if [ "$failed" -gt 0 ]; then
    # Prefer the row count when the test IS a row-diff photograph, since it is
    # the more informative number; otherwise report the failing-assertion count.
    local rows
    rows=$(printf '%s' "$out" | grep -cE "^\s*[+-]\s+'" || true)
    [ "$rows" -gt 0 ] && echo "$rows" || echo "$failed"
  else
    echo 0
  fi
}

# Green means ZERO failures, not "pass N" for a hard-coded N. Pinning the count
# meant the guard silently broke the moment a third test was added, and reported
# "not green" for a green suite — a false negative that would have made every
# drill below skip while looking like a considered result.
# Blast radius by CONTENT, not by git status.
#
# `git status --porcelain` reports an untracked file as "??" whether or not you
# just edited it, so a drill against a not-yet-committed module measured ZERO
# files touched and failed for the wrong reason. Hashing the tree is independent
# of what is committed, which is what a measurement of "how many files did this
# change touch" has to be.
tree_fingerprint() {
  find src scripts -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.sh' \) -print0 \
    | sort -z | xargs -0 md5sum | sort
}

is_green() {
  # `fail 0` alone is not enough: node exits non-zero on a missing file or a
  # crash after the summary without ever printing `fail`, so check its exit code
  # too. Cross-family review (a Gemini pass over this harness) raised both that
  # case and a nested-subtest one; the subtest case does NOT reproduce on this
  # node version, which prints exactly one `ℹ fail` line. Verified, not assumed.
  #
  # KNOWN LIMIT, not fixed: a test file containing NO tests still prints
  # `ℹ pass 1 / ℹ fail 0`, because node counts the file itself as a pass. So an
  # emptied or fully-skipped suite still reads as a green baseline here. The
  # `pass >= 1` check below does not catch it and is kept only for the crash
  # case. Measured consequence: such a drill then reports 0 rows moved, i.e. it
  # lands in FALSE FAIL (a converged decision misread as frontier), not false
  # pass — the safe direction. Closing it properly needs a baseline pass-count
  # recorded per drill and compared, which is a larger change than this guard.
  local out status
  out=$(node --import tsx/esm --test "$1" 2>&1); status=$?
  [ "$status" -eq 0 ] || return 1
  echo "$out" | grep -qE "^ℹ fail 0$" || return 1
  echo "$out" | grep -qE "^ℹ pass [1-9][0-9]*$"
}

# Refuse only on a TRACKED file with unstaged edits — those are work the drill
# would destroy. An untracked module is fine: the drill backs it up and restores
# it byte-exactly. (Checking porcelain alone would see "??" and refuse forever.)
for guarded in "$MODIFIERS" "$SHADE" "$SERVING"; do
  if git ls-files --error-unmatch "$guarded" >/dev/null 2>&1 \
     && ! git diff --quiet -- "$guarded"; then
    echo "REFUSING TO RUN: $guarded has uncommitted changes; the drill would destroy them." >&2
    exit 2
  fi
done

# Each drill edits exactly one structural anchor, applied with python so the
# anchor can span lines and so a miss is LOUD. A silent no-op edit would make a
# drill "pass" for the wrong reason — the single most common way a measurement
# in this repo has lied.
apply_edit() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
path, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
if text.count(old) != 1:
    sys.exit(f"ANCHOR MATCHED {text.count(old)} TIMES, EXPECTED EXACTLY 1 — drill is invalid, not passing")
open(path, "w").write(text.replace(old, new))
PY
}

drill() {
  local expect="expect_pass"
  if [ "$1" = "expect_pass" ] || [ "$1" = "expect_fail" ]; then
    expect="$1"
    shift
  fi
  local target="$1" prompt="$2" old="$3" new="$4" drill_test="${5:-$TEST}"

  total_drills=$((total_drills + 1))
  echo "────────────────────────────────────────────────────────────"
  echo "PROMPT: $prompt [$expect]"

  if ! is_green "$drill_test"; then
    echo "  ✗ SKIP — characterization test is not green before the drill;"
    echo "           a drill against a red baseline proves nothing."
    mismatches=$((mismatches + 1))
    invalid_count=$((invalid_count + 1))
    invalid_prompts+=("$prompt (baseline red — nothing was measured)")
    return
  fi

  # A drill pointed at a test that cannot observe its edit reports a working
  # seam as decorative. That misread FOUR drills in this session before it was
  # caught, every time by a human noticing the number looked wrong. So the drill
  # now proves its own pin first: make the edit, confirm the chosen test goes
  # RED, and only then trust anything it says. A drill whose test stays green
  # under its own perturbation is a BROKEN DRILL, reported as such — never as a
  # finding about the code.
  local before_tree backup
  before_tree=$(tree_fingerprint)
  backup=$(mktemp)
  cp "$target" "$backup"

  if ! apply_edit "$target" "$old" "$new"; then
    echo "  ✗ FAIL — could not apply the edit (see above)."
    cp "$backup" "$target"
    rm -f "$backup"
    mismatches=$((mismatches + 1))
    invalid_count=$((invalid_count + 1))
    invalid_prompts+=("$prompt (anchor did not match — the drill is stale, not the code)")
    return
  fi

  # Blast radius is measured RELATIVE to the pre-drill working tree, not against
  # a clean checkout. The tree legitimately carries other in-progress work, and
  # counting that as "files this change touched" would inflate every drill and
  # make the metric useless exactly when it is most needed.
  local touched rows outcome
  touched=$(comm -13 <(printf '%s\n' "$before_tree") <(tree_fingerprint) | wc -l)
  rows=$(changed_rows "$drill_test")

  echo "  files touched to make the change : $touched"
  echo "  characterization rows that moved : $rows"

  if [ "$touched" -ne 1 ]; then
    outcome="fail"
    echo "  ✗ FAIL — the change was not confined to one file."
  elif [ "$rows" -eq 0 ]; then
    outcome="fail"
    echo "  ✗ FAIL — one file, but $drill_test did not move."
    echo "           Either the seam is decorative, OR this drill is checking a test"
    echo "           that cannot see its edit. Confirm which before believing it:"
    echo "           apply the edit by hand and run the whole suite."
  else
    outcome="pass"
    echo "  ✓ PASS — one file, $rows rendered rows moved."
  fi

  # Restore byte-exactly. `git checkout --` would fail silently on an
  # untracked file and leave the drill's edit in place, poisoning every
  # subsequent drill in the run.
  cp "$backup" "$target"
  rm -f "$backup"

  # Evaluate against expectation
  if [ "$expect" = "expect_pass" ]; then
    if [ "$outcome" = "pass" ]; then
      converged_count=$((converged_count + 1))
      converged_prompts+=("$prompt ($rows rows moved)")
      echo "  Expectation: MATCH (converged decision)"
    else
      regressions=$((regressions + 1))
      mismatches=$((mismatches + 1))
      regression_prompts+=("$prompt ($rows rows moved)")
      echo "  Expectation: MISMATCH — REGRESSION! Expected single-file effective pass, but drill failed."
    fi
  else
    if [ "$outcome" = "fail" ]; then
      frontier_count=$((frontier_count + 1))
      frontier_prompts+=("$prompt (rows moved: $rows)")
      echo "  Expectation: MATCH (known frontier: unconverged decision)"
    else
      unexpected_passes=$((unexpected_passes + 1))
      mismatches=$((mismatches + 1))
      unexpected_pass_prompts+=("$prompt ($rows rows moved)")
      echo "  Expectation: MISMATCH — UNEXPECTED PASS! Drill was expected to fail as frontier, but passed ($rows rows moved). Decision has converged; board is stale!"
    fi
  fi
}

echo "APPEARANCE CHANGE DRILL"
echo "one owner-phrased prompt at a time; each must be single-file AND visible"
echo

# ==================== Converged decisions (expect_pass) ====================

drill expect_pass "$MODIFIERS" "inter 換手的 target 也要有強調（原本完全沒有）" \
"    target: {
      shade: null,
      rationale: 'different satellites already differ in hue; the hue jump IS the inter cue'," \
"    target: {
      shade: 'target',
      rationale: 'owner asked for an explicit incoming-beam cue on inter as well as intra',"

drill expect_pass "$MODIFIERS" "intra 換手的 source 不要再變暗了" \
"    source: {
      shade: 'source'," \
"    source: {
      shade: null,"

drill expect_pass "$MODIFIERS" "換手兩側的透明度對比再拉開一點" \
"export const HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR = 0.62;" \
"export const HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR = 0.40;"

# This one is here because "把 intra target 改亮一點" was measured as a TWO-file
# change while emphasizeIntraHandoverColor still lived in constants/servingColour.ts:
# the table said WHICH shade applied, a different directory said what it MEANT.
# It is a single-file change only because the implementation moved beside the table.
drill expect_pass "$SHADE" "把 intra 換手的 target 再亮一點" \
"    : Math.min(0.94, Math.max(0.74, hsl.lightness * 0.50 + 0.48));" \
"    : Math.min(0.98, Math.max(0.86, hsl.lightness * 0.50 + 0.60));"

drill expect_pass "$SERVING" "改同一顆衛星裡不同 beam 的深淺階梯" \
"const SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS = [0.56, 0.64, 0.72, 0.80, 0.87, 0.92, 0.96, 0.99] as const;" \
"const SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS = [0.50, 0.60, 0.70, 0.80, 0.87, 0.92, 0.96, 0.99] as const;"

# ==================== Frontier decisions (expect_fail) ====================

HUE_TEST="src/appearance/satelliteIdentityHueCharacterization.test.ts"
drill expect_pass "$SERVING" "換掉衛星身分色的調色盤" \
"  { hueDegrees: 48, baseLightness: 0.60 },  // gold" \
"  { hueDegrees: 52, baseLightness: 0.60 },  // gold" \
"$HUE_TEST"

# Checked against the side characterization, not the default cone photograph:
# the side rule is exercised by renderKey-only items, which the 284-row cone
# grid does not contain. Pointing a drill at a test that cannot observe its edit
# reports a working seam as decorative — that misread three drills before it was
# caught.
SIDE_TEST="src/appearance/handoverSideCharacterization.test.ts"
drill expect_pass "$MODIFIERS" "改 handover source/target 的判定" \
"  if (renderKey.endsWith('-from')) return 'source';" \
"  if (renderKey.endsWith('-from')) return 'target';" \
"$SIDE_TEST"

# ==================== Newly covered decisions ====================

drill expect_pass "$VISIBILITY" "改哪些波束/錐體要顯示在畫面上，最近一次換手的 target 也要保留" \
"  addBeamIdentity(identities, input.recentToBeam);" \
"  addBeamIdentity(identities, input.recentFromBeam);" \
"$VISIBILITY_TEST"

drill expect_pass "$GEOMETRY" "把波束錐體的寬度放大一點，讓底面投影更容易讀" \
"export const MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER = 1;" \
"export const MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER = 1.05;" \
"$GEOMETRY_TEST"

drill expect_pass "$TIMING" "換手動畫的 serving 階段再多留一點時間" \
"  serving: 0.1875," \
"  serving: 0.20," \
"$TIMING_TEST"

drill expect_pass "$MARKERS" "把衛星標記的 fallback 身分色換成另一個穩定色" \
"  return resolveSatelliteIdentityColor(satelliteId, {});" \
"  return resolveSatelliteIdentityColor(satelliteId + '-marker', {});" \
"$SINK_TEST"

# expect_fail on purpose, and NOT because the seam is missing — railProjection
# does own this decision in one file. It is here because NOTHING PINS IT: flipping
# `shouldRetainCandidateRoster` leaves railPresentationCharacterization at fail 0
# and the whole appearance suite at fail 0. A single-file change nobody can see is
# not a converged decision, it is an unguarded one.
#
# 2026-09-08: FLIPPED to expect_pass. The rail characterization now does cover the
# roster-retention rule — the drill moves 2 rows in one file, measured, not assumed.
# The paragraph above is kept because it records why this was ever a frontier, and
# what specifically had to become true for it to stop being one.
drill expect_pass "$RAIL" "候選軌有換手故事時要保留那一組候選卡片" \
"  const shouldRetainCandidateRoster = handoverStory !== null;" \
"  const shouldRetainCandidateRoster = handoverStory === null;" \
"$RAIL_TEST"

# Anchor repaired 2026-09-09, and the TARGET moved with it. The old anchor was an
# inline precedence ternary inside MultiCandidateBeamScene.tsx; that lane has since
# been routed through the ladder's single owner, so the decision now lives in
# resolveBeamAppearance.ts. Two workers landed at once here — one repointed this
# drill at the old anchor while the other removed it — and the `invalid` bucket
# caught the collision instead of reporting a converged decision or a regression.
# That bucket exists for exactly this, and this is the first time it has fired
# on a real conflict rather than on a drill I broke myself.
drill expect_pass "$FINAL_COLOUR" "改一支波束最終顏色的 precedence 順序" \
"  if (homepage !== undefined && homepage.length > 0) {
    return { color: homepage, rung: '1-homepage' };
  }

  const accepted = sources.acceptedColorFor?.(satId, beamId);
  if (accepted !== undefined && accepted.length > 0) {
    return { color: accepted, rung: '2-accepted' };
  }" \
"  const accepted = sources.acceptedColorFor?.(satId, beamId);
  if (accepted !== undefined && accepted.length > 0) {
    return { color: accepted, rung: '2-accepted' };
  }

  if (homepage !== undefined && homepage.length > 0) {
    return { color: homepage, rung: '1-homepage' };
  }" \
"$FINAL_COLOUR_TEST"

# The link's named beam-id rung is now characterized through its exported pure
# seam. The test photograph includes literal rung outputs, so a one-file mapping
# perturbation is visible rather than being mistaken for a decorative edit.
drill expect_pass "$SHADE_MAPPING" "改 beam id 怎麼對應到深淺階，handover link 也要跟著換" \
"  return colorForServingBeam(satId, beamId).markerColor;" \
"  return colorForServingBeam(satId, beamId + 1).markerColor;" \
"$SHADE_MAPPING_TEST"

echo "────────────────────────────────────────────────────────────"
echo "APPEARANCE CONVERGENCE FRONTIER SUMMARY"
echo "────────────────────────────────────────────────────────────"
echo "Total drills: $total_drills"
echo "  Converged decisions (expected pass, passed) : $converged_count"
echo "  Frontier decisions  (expected fail, failed) : $frontier_count"
echo "  Expectation mismatches                      : $mismatches"
if [ "$unexpected_passes" -gt 0 ]; then
  echo "    - Unexpected passes (board is stale!)     : $unexpected_passes"
fi
if [ "$regressions" -gt 0 ]; then
  echo "    - Regressions (expected pass, failed!)    : $regressions"
fi
if [ "$invalid_count" -gt 0 ]; then
  echo "    - INVALID (measured nothing, fix drill)   : $invalid_count"
fi
echo
if [ "${#converged_prompts[@]}" -gt 0 ]; then
  echo "Converged decisions ($converged_count):"
  for item in "${converged_prompts[@]}"; do
    echo "  ✓ $item"
  done
  echo
fi
if [ "${#frontier_prompts[@]}" -gt 0 ]; then
  echo "Frontier decisions — unconverged ($frontier_count):"
  for item in "${frontier_prompts[@]}"; do
    echo "  ✗ $item"
  done
  echo
fi
if [ "${#unexpected_pass_prompts[@]}" -gt 0 ]; then
  echo "Unexpectedly passing decisions ($unexpected_passes) — FINDING: frontier moved, board is stale:"
  for item in "${unexpected_pass_prompts[@]}"; do
    echo "  ⚡ $item"
  done
  echo
fi
if [ "${#invalid_prompts[@]}" -gt 0 ]; then
  echo "INVALID drills ($invalid_count) — these measured NOTHING; do not read them as"
  echo "either converged or frontier, and do not update expectations from them:"
  for item in "${invalid_prompts[@]}"; do
    echo "  ⁇ $item"
  done
  echo
fi
if [ "${#regression_prompts[@]}" -gt 0 ]; then
  echo "Regressions ($regressions):"
  for item in "${regression_prompts[@]}"; do
    echo "  ❌ $item"
  done
  echo
fi
echo "────────────────────────────────────────────────────────────"

if [ "$mismatches" -ne 0 ]; then
  echo "DRILL FAILED — $mismatches expectation mismatch(es) detected."
  if [ "$unexpected_passes" -gt 0 ]; then
    echo "  Notice: $unexpected_passes drill(s) expected to fail actually passed."
    echo "          The frontier has moved; update expectations once confirmed."
  fi
  if [ "$invalid_count" -gt 0 ]; then
    echo "  Notice: $invalid_count drill(s) could not be applied at all."
    echo "          Their anchors have drifted from the code. Repair the anchor;"
    echo "          do NOT reinterpret an unmeasured drill as a result."
  fi
  if [ "$regressions" -gt 0 ]; then
    echo "  Notice: $regressions drill(s) expected to pass failed. This is a regression."
  fi
  exit 1
fi

echo "DRILL PASSED — every listed rendering decision matched its expectation."
exit 0
