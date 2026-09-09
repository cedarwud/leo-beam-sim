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
#   - whether the decision has exactly ONE authority (check A),
#   - whether the change actually reached the rendered output (check B),
#   - whether it reached ALL of it, not just some of it (check C),
#   - and that reverting restores the exact prior state.
#
# ## Why the file-count check was replaced (2026-09-09)
#
# This script used to compute a "blast radius":
#
#     touched=$(comm -13 <(printf '%s\n' "$before_tree") <(tree_fingerprint) | wc -l)
#     if [ "$touched" -ne 1 ]; then echo "not confined to one file"; fi
#
# `apply_edit` opens exactly one path for writing, so `touched` was 1 BY
# CONSTRUCTION. "The change was confined to one file" was a guarantee that could
# not fail, and therefore could not detect the one thing it existed to detect: a
# change that NEEDS a second file. It proved itself empty in the field — the
# board reported `intra-handover-shade` as converged and single-file while
# `npm run audit:appearance-cost` reported FILES TO EDIT: 2 for the same
# decision, because `emphasizeIntraHandoverColor` had been COPIED into
# `appearance/intraHandoverShade.ts` and never deleted from
# `constants/servingColour.ts`. Two live definitions of the same 12 lines.
#
# Check A replaces it with the property the old check was pretending to assert:
# the symbol each drill perturbs must be DECLARED EXACTLY ONCE under src/.
#
# ## Why "at least one row moved" was replaced (2026-09-09)
#
# The old effect check was `rows -eq 0` means fail — i.e. "at least one
# characterization row moved". "At least one" is satisfied by a HALF-applied
# change, which is exactly the shape of the bug above: edit the owner, half the
# surfaces move, half keep the old colour, and the drill says PASS. Check C
# demands TOTALITY instead: every pinned occurrence of a row that moved must
# have moved. A row that still carries the old value somewhere in the same
# photograph is a partial move and fails.
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
# Check C cannot observe totality on every test. A table-driven `assert.equal`
# loop THROWS on its first mismatch, so node reports one failure no matter how
# many rows moved, and "did every pinned occurrence move" is not answerable from
# that output. Those drills are counted here, by name, so the board states how
# much of itself has a total-effect check rather than implying all of it does.
totality_unobservable=0

converged_prompts=()
frontier_prompts=()
regression_prompts=()
unexpected_pass_prompts=()
invalid_prompts=()
totality_unobservable_prompts=()

# ---------------------------------------------------------------------------
# CHECK A — does this decision have exactly ONE authority?
#
# Counts DECLARATIONS of the perturbed symbol under src/, exported or not. Not
# exported-only: the three-way `hslToHex` split that motivated this check was one
# export plus two PRIVATE copies, and an exported-only count reported 1 — green,
# and wrong. Test files are excluded: a local helper in a test is not a rendering
# authority.
#
# Zero declarations is INVALID, never a pass. The documented worst measurement
# bug in this repo is a query that quietly returns the empty set which is then
# read as a fact (NEXT-SESSION-RENDERING-CONVERGENCE.md, 教訓 #5).
# ---------------------------------------------------------------------------
authority_declarations() {
  grep -rnE "^[[:space:]]*(export[[:space:]]+)?(default[[:space:]]+)?(async[[:space:]]+)?(function|const|let|var|class)[[:space:]]+$1[[:space:]]*[(:=<]" src \
    --include='*.ts' --include='*.tsx' 2>/dev/null \
    | grep -v '\.test\.ts:' | grep -v '\.test\.tsx:'
}

# Blast radius by CONTENT, not by git status.
#
# `git status --porcelain` reports an untracked file as "??" whether or not you
# just edited it, so a drill against a not-yet-committed module measured ZERO
# files touched and failed for the wrong reason. Hashing the tree is independent
# of what is committed, which is what a measurement of "how many files did this
# change touch" has to be.
#
# This is now an INTEGRITY check, not a metric: it names the paths that differ
# and asserts the drill's own edit is the only one, so a concurrent worker
# writing to src/ during a run is reported instead of being silently folded into
# the measurement. It is deliberately no longer reported as "files touched to
# make the change" — that number was always 1 and meant nothing.
tree_fingerprint() {
  find src scripts -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.sh' \) -print0 \
    | sort -z | xargs -0 md5sum | sort
}

# Run one characterization test and keep its full output, so the effect count
# and the totality analysis are derived from the SAME observation instead of two
# separate runs that could disagree.
run_test_capture() {
  node --import tsx/esm --test "$1" > "$2" 2>&1
}

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
changed_rows_from() {
  local out failed rows
  out=$(cat "$1")
  failed=$(printf '%s' "$out" | grep -oE "^# fail [0-9]+|^ℹ fail [0-9]+" | grep -oE "[0-9]+$" | head -1)
  [ -z "$failed" ] && failed=0
  if [ "$failed" -gt 0 ]; then
    # Prefer the row count when the test IS a row-diff photograph, since it is
    # the more informative number; otherwise report the failing-assertion count.
    rows=$(printf '%s' "$out" | grep -cE "^\s*[+-]\s+'" || true)
    [ "$rows" -gt 0 ] && echo "$rows" || echo "$failed"
  else
    echo 0
  fi
}

# ---------------------------------------------------------------------------
# CHECK C — did the change reach ALL of the surface, or only part of it?
#
# The baseline is green, so every string literal in the test file is a value the
# code produces TODAY. After the perturbation, node's deepEqual diff prints each
# changed row once as `- 'old'` / `+ 'new'`; unchanged runs are elided, which is
# safe here because elided means "did not move".
#
# So for each distinct row that moved, compare
#   how many times it appears on the `-` side  (occurrences that moved)
# against
#   how many times it is pinned in the test file (occurrences that exist).
# A shortfall means some surface produced that exact row before the edit and
# still produces it after — a PARTIAL move. That is the duplicate-definition bug
# expressed in pixels, and "at least one row moved" cannot see it.
#
# Rows, not colour tokens: a bare `#aee726` also appears in this file's prose
# header, and counting tokens reported phantom shortfalls. A whole row is a long,
# quoted, unambiguous literal.
#
# Every REMOVED value in the failure output is read, whatever shape it arrives
# in — an element of an array diff (`-   'row'`), a property of an object diff
# (`-   key: 'value'`), or the expected side of a scalar `assert.equal`
# (`- '#5d80e9'`). They are all occurrences of a pinned value that moved, and
# they are all compared against the same corpus: every string literal in the test
# file. Mixing shapes is not sloppiness, it is required for correctness — the
# first version of this check counted array elements only while still counting
# ALL literals in the corpus, and reported two phantom PARTIAL moves
# (`#5d80e9`, `#bee561`) whose "missing" occurrences had in fact moved through a
# shape the scan was ignoring. Both were run by hand to confirm the code was
# innocent before the check was corrected.
#
# A value that the test file does not pin at all (corpus 0) is never flagged: it
# is a computed value passing through the diff, not a photograph row.
#
# ONLY SELF-IDENTIFYING ROWS ARE COMPARED. The rule behind check C — "two
# occurrences of the same recorded value describe the same decision, so they must
# move together" — holds for a row that names its own situation
# (`{"satId":...,"color":"#eaf9c8"}`, `LOOKUP sat=x key=1 serving=1`,
# `GRID: case=y -> phase=z`) and is FALSE for a bare token. Measured: perturbing
# `HANDOVER_CONE_PHASE_END.serving` moves one probe from `'measuring'` to
# `'serving'` and correctly leaves four other `'measuring'` probes alone; reading
# those as a partial move was wrong, and was verified wrong by hand before this
# filter was added. So a value qualifies only if it is >= 20 chars AND carries a
# structural marker (`{`, `=`, or `->`). Everything else is reported NA rather
# than judged.
#
# KNOWN LIMIT, stated rather than hidden: two identical rows under different
# section labels are two different observations, and a change that legitimately
# reaches only one of them would be reported as PARTIAL. No drill does that today
# (all five photograph drills report TOTAL). If one ever does, adjudicate it by
# hand — the message names the exact row.
# ---------------------------------------------------------------------------
totality_report() {
  python3 - "$1" "$2" <<'PY'
import sys, re, ast
from collections import Counter

test_path, out_path = sys.argv[1], sys.argv[2]
out = open(out_path, encoding="utf-8", errors="replace").read()
src = open(test_path, encoding="utf-8").read()

STRTOK = r"\"(?:[^\"\\\n]|\\.)*\"|'(?:[^'\\\n]|\\.)*'"
# `-   'row',`  |  `-   key: 'value',`  |  `- 'scalar'`
REMOVED = re.compile(r"^\s*-\s+(?:[A-Za-z_$][A-Za-z0-9_$]*\s*:\s*)?(" + STRTOK + r")\s*,?\s*$")
STACK = re.compile(r"^\s+at ")


def lit(tok):
    try:
        return ast.literal_eval(tok)
    except Exception:
        return None


def is_record(value):
    """A row that names its own situation, so two equal rows mean one decision."""
    return len(value) >= 20 and ("{" in value or "=" in value or "->" in value)


moved = Counter()
in_diff = False
for line in out.splitlines():
    if "+ actual - expected" in line:
        in_diff = True
        continue
    if not in_diff:
        continue
    # The stack trace ends the diff. Everything after it (node's own
    # `actual:` / `expected:` object dump) is a TRUNCATED re-print of the same
    # data — reading it would double-count the head of the array and silently
    # drop its tail.
    if STACK.match(line) or line.startswith("test at ") or line.startswith("\u2716"):
        in_diff = False
        continue
    match = REMOVED.match(line)
    if match is None:
        continue
    value = lit(match.group(1))
    if value is not None and is_record(value):
        moved[value] += 1

if not moved:
    # Nothing string-shaped moved (a purely numeric diff, or no diff at all).
    # Say so; never report an unobservable property as satisfied.
    print("NA")
    sys.exit(0)

corpus = Counter()
for tok in re.findall(STRTOK, src):
    value = lit(tok)
    if value is not None:
        corpus[value] += 1

short = [(corpus.get(value, 0) - n, value)
         for value, n in sorted(moved.items())
         if corpus.get(value, 0) > n]

if short:
    print("PARTIAL")
    for missing, value in short:
        print(f"      {missing} pinned occurrence(s) of this value did NOT move:")
        print(f"        {value[:150]}")
else:
    print(f"TOTAL {len(moved)} distinct value(s), {sum(moved.values())} pinned occurrence(s), all moved")
PY
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
  echo "$out" | grep -qE "^(ℹ|#) fail 0$" || return 1
  echo "$out" | grep -qE "^(ℹ|#) pass [1-9][0-9]*$"
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

# drill [expect_pass|expect_fail] TARGET PROMPT SYMBOL OLD NEW [TEST]
#
# SYMBOL is the declaration the perturbation edits (or the one that encloses it).
# It is stated per drill rather than inferred, because the whole point of check A
# is that the answer must be derivable from the code — and a symbol name guessed
# by regex from an anchor is neither derivable nor auditable.
drill() {
  local expect="expect_pass"
  if [ "$1" = "expect_pass" ] || [ "$1" = "expect_fail" ]; then
    expect="$1"
    shift
  fi
  local target="$1" prompt="$2" symbol="$3" old="$4" new="$5" drill_test="${6:-$TEST}"

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

  # CHECK A runs on the pristine tree, before the edit: it is a static property
  # of the code, and a drill whose symbol cannot be found measured nothing.
  local declarations authority_files
  declarations=$(authority_declarations "$symbol")
  authority_files=$(printf '%s' "$declarations" | grep -c . || true)

  if [ "$authority_files" -eq 0 ]; then
    echo "  ✗ INVALID — no declaration of '$symbol' found under src/."
    echo "           An empty query is not evidence that a decision converged."
    echo "           Repair the drill's symbol; do not read this as a result."
    mismatches=$((mismatches + 1))
    invalid_count=$((invalid_count + 1))
    invalid_prompts+=("$prompt (symbol '$symbol' resolved to zero declarations)")
    return
  fi

  # A drill pointed at a test that cannot observe its edit reports a working
  # seam as decorative. That misread FOUR drills in this session before it was
  # caught, every time by a human noticing the number looked wrong. So the drill
  # now proves its own pin first: make the edit, confirm the chosen test goes
  # RED, and only then trust anything it says. A drill whose test stays green
  # under its own perturbation is a BROKEN DRILL, reported as such — never as a
  # finding about the code.
  local before_tree backup out_file
  before_tree=$(tree_fingerprint)
  backup=$(mktemp)
  out_file=$(mktemp)
  cp "$target" "$backup"

  if ! apply_edit "$target" "$old" "$new"; then
    echo "  ✗ FAIL — could not apply the edit (see above)."
    cp "$backup" "$target"
    rm -f "$backup" "$out_file"
    mismatches=$((mismatches + 1))
    invalid_count=$((invalid_count + 1))
    invalid_prompts+=("$prompt (anchor did not match — the drill is stale, not the code)")
    return
  fi

  # Integrity, measured RELATIVE to the pre-drill working tree, not against a
  # clean checkout: the tree legitimately carries other in-progress work.
  local changed_paths outcome rows totality
  changed_paths=$(comm -13 <(printf '%s\n' "$before_tree") <(tree_fingerprint) | awk '{print $2}')
  run_test_capture "$drill_test" "$out_file"
  rows=$(changed_rows_from "$out_file")
  totality=$(totality_report "$drill_test" "$out_file")

  echo "  A. declarations of '$symbol' under src/ : $authority_files"
  echo "  B. characterization rows that moved     : $rows"
  echo "  C. totality of the move                 : $(printf '%s' "$totality" | head -1)"

  outcome="pass"

  if [ "$authority_files" -ne 1 ]; then
    outcome="fail"
    echo "  ✗ FAIL (A) — '$symbol' is declared in $authority_files places, so this"
    echo "           decision has no single authority. Editing one of them changes"
    echo "           only the surfaces that route through it:"
    printf '%s\n' "$declarations" | sed 's/^/             /'
  fi

  if [ -n "$changed_paths" ] && [ "$(printf '%s\n' "$changed_paths" | grep -c .)" -ne 1 ]; then
    outcome="fail"
    echo "  ✗ FAIL — more than the drill's own file changed during the run;"
    echo "           another writer touched the tree and this measurement is void:"
    printf '%s\n' "$changed_paths" | sed 's/^/             /'
  fi

  if [ "$rows" -eq 0 ]; then
    outcome="fail"
    echo "  ✗ FAIL (B) — $drill_test did not move."
    echo "           Either the seam is decorative, OR this drill is checking a test"
    echo "           that cannot see its edit. Confirm which before believing it:"
    echo "           apply the edit by hand and run the whole suite."
  fi

  case "$totality" in
    PARTIAL*)
      outcome="fail"
      echo "  ✗ FAIL (C) — PARTIAL MOVE. Some surfaces adopted the new value and"
      echo "           others kept the old one, from a single-file edit. That is the"
      echo "           'I changed the owner and nothing happened' bug, half-visible:"
      printf '%s\n' "$totality" | tail -n +2
      ;;
    NA*)
      totality_unobservable=$((totality_unobservable + 1))
      totality_unobservable_prompts+=("$prompt [$drill_test]")
      echo "     (C is not observable here: this test's failures are scalar"
      echo "      assertions, which abort at the first mismatch. Check A still applies.)"
      ;;
  esac

  if [ "$outcome" = "pass" ]; then
    echo "  ✓ PASS — one authority, $rows rendered rows moved, and every pinned"
    echo "           occurrence of every moved row moved with it."
  fi

  # Restore byte-exactly. `git checkout --` would fail silently on an
  # untracked file and leave the drill's edit in place, poisoning every
  # subsequent drill in the run.
  cp "$backup" "$target"
  rm -f "$backup" "$out_file"

  # Evaluate against expectation
  if [ "$expect" = "expect_pass" ]; then
    if [ "$outcome" = "pass" ]; then
      converged_count=$((converged_count + 1))
      converged_prompts+=("$prompt ($rows rows moved)")
      echo "  Expectation: MATCH (converged decision)"
    else
      regressions=$((regressions + 1))
      mismatches=$((mismatches + 1))
      regression_prompts+=("$prompt ($rows rows moved; $authority_files declaration(s) of '$symbol')")
      echo "  Expectation: MISMATCH — REGRESSION! Expected single-authority effective pass, but drill failed."
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
echo "one owner-phrased prompt at a time; each must have ONE authority, be visible, and move ALL of its surface"
echo

# ==================== Converged decisions (expect_pass) ====================

drill expect_pass "$MODIFIERS" "inter 換手的 target 也要有強調（原本完全沒有）" \
"HANDOVER_APPEARANCE_MODIFIERS" \
"    target: {
      shade: null,
      rationale: 'different satellites already differ in hue; the hue jump IS the inter cue'," \
"    target: {
      shade: 'target',
      rationale: 'owner asked for an explicit incoming-beam cue on inter as well as intra',"

drill expect_pass "$MODIFIERS" "intra 換手的 source 不要再變暗了" \
"HANDOVER_APPEARANCE_MODIFIERS" \
"    source: {
      shade: 'source'," \
"    source: {
      shade: null,"

drill expect_pass "$MODIFIERS" "換手兩側的透明度對比再拉開一點" \
"HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR" \
"export const HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR = 0.62;" \
"export const HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR = 0.40;"

# This one is here because "把 intra target 改亮一點" was measured as a TWO-file
# change while emphasizeIntraHandoverColor still lived in constants/servingColour.ts:
# the table said WHICH shade applied, a different directory said what it MEANT.
# It is a single-file change only because the implementation moved beside the table.
#
# 2026-09-09: and it was still a two-file change after that "move", because the
# move was a COPY — the constants/ definition was never deleted. Check A is the
# reason that is now visible here instead of only in audit:appearance-cost.
drill expect_pass "$SHADE" "把 intra 換手的 target 再亮一點" \
"emphasizeIntraHandoverColor" \
"    : Math.min(0.94, Math.max(0.74, hsl.lightness * 0.50 + 0.48));" \
"    : Math.min(0.98, Math.max(0.86, hsl.lightness * 0.50 + 0.60));"

drill expect_pass "$SERVING" "改同一顆衛星裡不同 beam 的深淺階梯" \
"SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS" \
"const SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS = [0.56, 0.64, 0.72, 0.80, 0.87, 0.92, 0.96, 0.99] as const;" \
"const SERVING_IDENTITY_BEAM_LIGHTNESS_LEVELS = [0.50, 0.60, 0.70, 0.80, 0.87, 0.92, 0.96, 0.99] as const;"

# ==================== Frontier decisions (expect_fail) ====================

HUE_TEST="src/appearance/satelliteIdentityHueCharacterization.test.ts"
drill expect_pass "$SERVING" "換掉衛星身分色的調色盤" \
"SERVING_IDENTITY_PALETTE" \
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
"resolveHandoverSide" \
"  if (renderKey.endsWith('-from')) return 'source';" \
"  if (renderKey.endsWith('-from')) return 'target';" \
"$SIDE_TEST"

# ==================== Newly covered decisions ====================

drill expect_pass "$VISIBILITY" "改哪些波束/錐體要顯示在畫面上，最近一次換手的 target 也要保留" \
"resolveHomepageBeamVisibility" \
"  addBeamIdentity(identities, input.recentToBeam);" \
"  addBeamIdentity(identities, input.recentFromBeam);" \
"$VISIBILITY_TEST"

drill expect_pass "$GEOMETRY" "把波束錐體的寬度放大一點，讓底面投影更容易讀" \
"MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER" \
"export const MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER = 1;" \
"export const MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER = 1.05;" \
"$GEOMETRY_TEST"

drill expect_pass "$TIMING" "換手動畫的 serving 階段再多留一點時間" \
"HANDOVER_CONE_PHASE_END" \
"  serving: 0.1875," \
"  serving: 0.20," \
"$TIMING_TEST"

drill expect_pass "$MARKERS" "把衛星標記的 fallback 身分色換成另一個穩定色" \
"markerColor" \
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
"shouldRetainCandidateRoster" \
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
"resolveBaseIdentityColorWithRung" \
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
"markerColorForBeam" \
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
echo "  Drills with NO observable totality check    : $totality_unobservable"
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
if [ "${#totality_unobservable_prompts[@]}" -gt 0 ]; then
  echo "Totality NOT observable on these drills ($totality_unobservable) — their tests fail"
  echo "through scalar assertions, which abort at the first mismatch, so 'did EVERY"
  echo "pinned occurrence move' has no answer in the output. Check A still guards them."
  echo "Giving one of these a row-diff photograph is what converts it to a real check:"
  for item in "${totality_unobservable_prompts[@]}"; do
    echo "  ~ $item"
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
