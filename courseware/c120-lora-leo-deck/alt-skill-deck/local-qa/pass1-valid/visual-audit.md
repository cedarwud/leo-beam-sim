# Pass 1 visual audit — validator-passing chunks

Date: 2026-08-11

This is a first visual QA pass only. It is not final acceptance and it does not
replace the content-contract, editable-formula, or human presentation review.

## Scope and method

The following eight validator-passing chunk decks were rendered read-only at
their original slide geometry:

| Chunk | PDF pages | PNG pages | First-pass result |
|---|---:|---:|---|
| Opening V2 | 11 | 11 | No obvious visual defect observed |
| Part A V2 preview | 8 | 8 | No obvious visual defect observed |
| Part A P009–P018 | 10 | 10 | Repair required: P010; minor overflow on P013, P018 |
| Part A P019–P027B | 15 | 15 | Repair required: P019, P020, P024A–P027B |
| Part B P028–P045 | 18 | 18 | Repair required: P034, P040, P041, P044, P045 |
| Part B P046–P063 | 18 | 18 | Repair required: P046, P051 |
| Part C P064–P080 | 17 | 17 | Repair required: P064–P068, P070, P078, P079 |
| Appendix P098–P107 | 10 | 10 | Repair required: P099–P107; systematic bottom-strip overflow |

PDF conversion used the local Office renderer
(`/home/u24/.codex/skills/pptx/scripts/office/soffice.py`); PNGs were produced
from each PDF with `pdftoppm -png -r 144`. Each chunk directory contains its
PDF, page PNGs, and a modest contact sheet. The individual PNGs were inspected
at original render size in addition to contact-sheet review.

## Cross-deck observations

- All eight requested renders completed, and each PDF page count matches its
  expected chunk length.
- The template footer is present in the reviewed renders. No obvious footer
  collision with the template shell was observed.
- No obvious source-slide-1 middle divider or other horizontal divider was
  visible in this pass; reviewed pages use the same content-shell treatment.
- No visible SHA/checksum-like identifier was found in the reviewed pages.
- The main recurring defect is text-frame sizing: headings and body copy are
  often placed outside rounded cards, or the final lines run through a card
  border into the next field strip. This is visible at presentation size even
  where the text remains technically present in the file.
- Screenshots and code captures are present where expected. Opening P007/P010
  and several later evidence pages are small at contact-sheet scale; their
  legibility should receive a second, full-slide human check after layout
  repair.

## Detailed findings

### Opening V2 — P001–P011

No obvious overflow, overlap, title loss, screenshot clipping, or footer
collision was found in this first pass. P007 and P010 contain relatively small
code/screenshot material; it is visible, but should be checked at projected
presentation size before acceptance.

### Part A V2 preview — P001–P008

No obvious first-pass visual defect was found. The eight pages have a coherent
card-based composition, intact titles, and intact footer shell.

### Part A V2 P009–P018

- **P010 — repair required:** the top subtitle/card-header area is crowded.
  `release asset` text runs into the body copy; package-root tiles have
  label/body collisions (including the `README.zh-TW.md` tile); the final
  `boundary` line extends below its rounded card.
- **P013 — minor repair:** the bottom purple causal/explanation ribbon is too
  short for its copy; the final `gate` line touches or falls below the ribbon
  boundary.
- **P018 — minor repair:** the left `apt` card's final `tool` line extends
  below its rounded card; the bottom field legend is also close to the frame
  edge.

P009, P011, P012, P014, P015, P016, and P017 had no obvious first-pass visual
defect.

### Part A V2 P019–P027B

- **P019 — repair required:** text in the four setup cards collides with card
  titles/borders, especially the Windows/WSL cards; the lower-right red card
  body extends outside its card.
- **P020 — repair required:** the subtitle wraps into the setup cards; both
  setup cards run below their rounded frames, and the lower purple card title
  and body overlap and spill below.
- **P024A and P024B — repair required:** the observation-field blocks overlap
  the heading/subtitle and extend below their rounded cards.
- **P025A and P025B — repair required:** the Lab A/B cards and the
  `BATCH_SIZE` card have heading/body collisions and text below card bounds.
- **P026A and P026B — repair required:** the urgent-deadline, `SLEEP`, and
  `SEND_*` cards are crowded; heading/body text overlaps and spills outside
  the cards.
- **P027A and P027B — repair required:** the `indentation`, `return`,
  baseline/status, and replay cards have heading/body collisions and bottom
  text overflow.

P021A, P021B, P021C, P022, and P023 had no obvious first-pass visual defect.

### Part B V2 P028–P045

- **P034 — repair required:** `D_delivered`/`E_endpoint` labels collide with
  the upper boxes/title area; card copy extends below the cards; the bottom
  field legend touches the border.
- **P040 — repair required:** the subtitle is crowded over the cards; the
  large control card runs close to or beyond its lower boundary.
- **P041 — repair required:** subtitle, candidate-edit/Mechanism cards, and
  command boxes are crowded; the bottom field legend is close to the edge.
- **P044 — repair required:** the subtitle overlaps the top state boxes; the
  lower state-interval copy and red causal sentence collide with lower content
  and the field legend.
- **P045 — minor-to-major repair:** the lower causal sentence collides with
  the field legend and sits too close to the frame edge.

P028–P033, P035–P039, and P042–P043 had no obvious first-pass visual defect.

### Part B V2 P046–P063

- **P046 — repair required:** the central `freeze receipt` explanation is a
  dense multi-column text block with visible text collisions and copy below
  the card boundary.
- **P051 — repair required:** the right yellow `INTERPRET` card has a
  title/body collision; the final hysteresis-related lines extend below the
  rounded card.

The remaining pages had no obvious first-pass overflow or overlap in the
contact-sheet review. A second full-size pass is still needed after repair.

### Part C V2 P064–P080

- **P064 — repair required:** the bottom `queue_age`, `deadline`, and endpoint
  field cards run below their rounded boundaries into the footer/next area;
  final lines are clipped or visibly outside the cards.
- **P065 — repair required:** the code block's final lines are clipped at the
  lower boundary (including the return/action line).
- **P066 — repair required:** bottom field cards are too short; final lines
  extend past their rounded frames.
- **P067 — repair required:** the title wraps into the shell; `AFTER candidate`
  and `BATCH_SIZE` copy collide; lower `branch` copy spills below cards.
- **P068 — repair required:** several top field cards, especially
  `urgent_due_in_s` and `endpoint_energy_j`, exceed their rounded-box bounds;
  the lower field legend is also over-dense.
- **P069 — minor repair candidate:** subtitle and top-card boundary are too
  close; verify after adjacent-page repair.
- **P070 — repair required:** `AFTER revision` overlaps body copy and
  `SEND_URGENT` spills below its card; the title is crowded.
- **P077 — minor repair candidate:** title wrapping and the lower `FAIL
  CLOSED`/field legend area are dense and close to the frame edge.
- **P078 — repair required:** the wrapped `packet` title competes with the
  shell underline, creating title crowding.
- **P079 — repair required:** the yellow save-field card has heading/body
  overlap and text below its frame; the workbook field legend is also too
  close to or beyond the lower boundary.
- **P080 — minor repair candidate:** the bottom field legend is dense and
  should be checked at projected size.

P071–P076 had no obvious first-pass visual defect.

### Appendix V2 P098–P107

- **P099–P101 — repair required:** the bottom field legend text extends below
  the blue rounded frame and is clipped/visibly outside the intended card.
- **P102 — repair required:** the `quality_band`/`decision_context` cards have
  heading/body collisions; the bottom field legend is clipped.
- **P103–P104 — repair required:** bottom field legend text extends below the
  frame.
- **P105 — repair required:** the `endpoint boundary` card's text collides
  with its vertical line; the bottom field legend is clipped.
- **P106 — repair required:** bottom field legend text extends below the
  rounded frame.
- **P107 — repair required:** top-row labels/body copy collide in the
  `student_policy`/action/radio-state/packet cards; bottom field legend text
  extends below the frame.

P098 had no obvious first-pass visual defect.

## Repair priority

For the next layout pass, repair the visibly broken card geometry before
rechecking screenshots or content semantics. The highest-density clusters are
Part A P019–P027B, Part C P064–P070, and Appendix P099–P107. After the repairs,
rerender every affected chunk and repeat original-size inspection; this record
does not constitute final acceptance.
