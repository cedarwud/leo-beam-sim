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
# Exit 0 only if every drill is a single-file, visibly-effective change.

set -uo pipefail
cd "$(dirname "$0")/../.."

TEST="src/scene/appearanceCharacterization.test.ts"
MODIFIERS="src/appearance/handoverAppearanceModifiers.ts"

fail=0

# How many rows of the pinned photograph differ. 0 means the edit was inert.
changed_rows() {
  node --import tsx/esm --test "$TEST" 2>&1 \
    | grep -cE "^\s*[+-]\s+'" || true
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
  node --import tsx/esm --test "$TEST" 2>&1 | grep -qE "^ℹ fail 0$"
}

# Refuse only on a TRACKED file with unstaged edits — those are work the drill
# would destroy. An untracked module is fine: the drill backs it up and restores
# it byte-exactly. (Checking porcelain alone would see "??" and refuse forever.)
for guarded in "$MODIFIERS" "src/appearance/intraHandoverShade.ts"; do
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
  local target="$1" prompt="$2" old="$3" new="$4"
  echo "────────────────────────────────────────────────────────────"
  echo "PROMPT: $prompt"

  if ! is_green; then
    echo "  ✗ SKIP — characterization test is not green before the drill;"
    echo "           a drill against a red baseline proves nothing."
    fail=1
    return
  fi

  local before_tree backup
  before_tree=$(tree_fingerprint)
  backup=$(mktemp)
  cp "$target" "$backup"

  if ! apply_edit "$target" "$old" "$new"; then
    echo "  ✗ FAIL — could not apply the edit (see above)."
    fail=1
    return
  fi

  # Blast radius is measured RELATIVE to the pre-drill working tree, not against
  # a clean checkout. The tree legitimately carries other in-progress work, and
  # counting that as "files this change touched" would inflate every drill and
  # make the metric useless exactly when it is most needed.
  local touched rows
  touched=$(comm -13 <(printf '%s\n' "$before_tree") <(tree_fingerprint) | wc -l)
  rows=$(changed_rows)

  echo "  files touched to make the change : $touched"
  echo "  characterization rows that moved : $rows"

  if [ "$touched" -ne 1 ]; then
    echo "  ✗ FAIL — the change was not confined to one file."
    fail=1
  elif [ "$rows" -eq 0 ]; then
    echo "  ✗ FAIL — one file, but nothing on screen changed. The seam is decorative."
    fail=1
  else
    echo "  ✓ PASS — one file, $rows rendered rows moved."
  fi

  # Restore byte-exactly. `git checkout --` would fail silently on an
  # untracked file and leave the drill's edit in place, poisoning every
  # subsequent drill in the run.
  cp "$backup" "$target"
  rm -f "$backup"
}

echo "APPEARANCE CHANGE DRILL"
echo "one owner-phrased prompt at a time; each must be single-file AND visible"
echo

drill "$MODIFIERS" "inter 換手的 target 也要有強調（原本完全沒有）" \
"    target: {
      shade: null,
      opacityFactor: 1,
      rationale: 'different satellites already differ in hue; the hue jump IS the inter cue'," \
"    target: {
      shade: 'target',
      opacityFactor: 1,
      rationale: 'owner asked for an explicit incoming-beam cue on inter as well as intra',"

drill "$MODIFIERS" "intra 換手的 source 不要再變暗了" \
"    source: {
      shade: 'source',
      opacityFactor: 1," \
"    source: {
      shade: null,
      opacityFactor: 1,"

drill "$MODIFIERS" "換手兩側的透明度對比再拉開一點" \
"export const HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR = 0.62;" \
"export const HANDOVER_TRANSITION_SOURCE_OPACITY_FACTOR = 0.40;"

SHADE="src/appearance/intraHandoverShade.ts"

# This one is here because "把 intra target 改亮一點" was measured as a TWO-file
# change while emphasizeIntraHandoverColor still lived in constants/servingColour.ts:
# the table said WHICH shade applied, a different directory said what it MEANT.
# It is a single-file change only because the implementation moved beside the table.
drill "$SHADE" "把 intra 換手的 target 再亮一點" \
"    : Math.min(0.94, Math.max(0.74, hsl.lightness * 0.50 + 0.48));" \
"    : Math.min(0.98, Math.max(0.86, hsl.lightness * 0.50 + 0.60));"

echo "────────────────────────────────────────────────────────────"
if [ "$fail" -ne 0 ]; then
  echo "DRILL FAILED — at least one rendering decision is not yet single-file-and-effective."
  exit 1
fi
echo "DRILL PASSED — every listed rendering decision is one file and visibly effective."
