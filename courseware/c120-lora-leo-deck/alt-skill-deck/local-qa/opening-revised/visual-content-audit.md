# Revised opening deck：visual and content audit

## Scope and evidence

- Deck: `LoRaEnergySim-LEO-ALT-OPENING-V2-REVIEW.pptx`
- Render: `render/LoRaEnergySim-LEO-ALT-OPENING-V2-REVIEW.pdf`
- Raster inspection: `render/slide-01.png` through `render/slide-11.png`
- Raster geometry: 1921 × 1080 px at 144 dpi for all 11 pages; this is the 16:9 page geometry produced by the original-size PDF render.
- `validate.py`: PASS before visual inspection.
- LibreOffice PDF conversion: PASS; 11-page PDF produced.
- This audit is read-only with respect to the deck. No PPTX edit was made.

## Overall result

The revised opening has a coherent visual language and the first four pages now establish the intended story: LoRaEnergySim is a bounded, deterministic endpoint-policy package; LEO changes the service window; the package already contains the runner/evidence path; and the three labs change one policy control at a time. O001–O004 are visually usable for a narrated opening, with no title wrapping or obvious content overflow.

The workflow and evidence pages are not yet visually safe to deliver as-is. O005, O006, O007, O008, O010, and O011 contain visible clipping, title wrapping, text collision, or dense fields that reduce direct readability. The most severe pages are O010 and O011: multiple text boxes overlap inside cards and the lower field/claim areas collide with each other. O009 is visually usable and communicates the paired `result.json` / `endpoint-replay.json` run-directory rule.

## Per-page audit

### O001 — why use LoRaEnergySim

Status: **PASS with minor density note**.

- Title stays on one line; no title overflow.
- The three-part visual sequence is legible: fixed context/window/flow/units → local package runner → Leo `/course` result artifact and workbook.
- The endpoint evidence strip names queue, packet, radio state, service, and J, which makes the endpoint boundary visible.
- The lower `scenario_id` field provides first-use name, source, purpose, unit, and interpretation.
- The page visibly answers why this package fits smart-energy/IoT-style service-window decisions and what the package already handles.
- Minor note: the right-hand `workbook` line sits close to the lower edge of its card, but it remains readable in the original render.

### O002 — why LEO changes the service window

Status: **PASS**.

- Title and lead stay within the title/lead region.
- The open → quality change → close → reopen trace is clear, and the endpoint policy consequence is visible.
- `service_window` is introduced with source, purpose, unit, and interpretation.
- The page clearly explains that a closed window forces the runner into a safe wait path and that an open window permits policy evaluation.
- No visible overflow or collision found.

### O003 — what the package already implements

Status: **PASS with minor density note**.

- Title stays on one line.
- The three cards visibly separate fixed setup, policy/runner, and evidence/recovery.
- The bottom operation strip gives the intended sequence: edit active marked block → exact run → upload artifact → explain evidence.
- `.venv` is introduced with source, purpose, unit, and interpretation; the POSIX/Windows setup distinction is visible.
- No visible overflow; the lower field box is close to the footer but remains inside its border.

### O004 — three experiments and evidence goals

Status: **PASS**.

- Title stays on one line.
- The three exact controls are visible: A `SLEEP → WAIT`, B `STABLE_STEPS 2 → 1`, and C `URGENT_MARGIN_S 20 → 5 → 30`.
- Each card names the primary evidence to inspect; the common method makes the before/after comparison legible.
- The lower rule gives the intended reading order: service gate → events → endpoint J, while the KPI claim is bounded by event evidence.
- `prediction` is introduced with source, purpose, unit, and interpretation.
- No visible overflow or collision found.

### O005 — release to exact run workflow

Status: **FAIL — repair required**.

- Title stays on one line and the five-step sequence is understandable.
- The POSIX/WSL command block visibly overflows its small label/box region: `PYTHON_BIN=python3.11 bash setup.sh` and `bash course.sh verify` cross the box boundary and collide with nearby elements.
- The Windows command block similarly extends below its box; `set "PYTHON_BIN=py -3.11"` and the `setup.cmd → course.cmd verify` text are not contained cleanly.
- The exact workflow is present, but the command evidence is not directly readable at presentation scale because the platform-specific command boxes are too short.
- `READY` is explained with source, purpose, unit, and interpretation; this lower field remains legible.

### O006 — result artifact to workbook workflow

Status: **FAIL — repair required**.

- Title wraps: `workflow` is forced onto a second line and sits against/over the title divider and lead region.
- The five-step locate → upload → validate → replay → compare/save sequence is visible.
- The lower right `workbook / compare / save / reopen` card has visible heading/body collision and text extends outside the card, especially `workbook` and `reopen`.
- The page does communicate that the runner produces the artifact and `/course` validates/imports/replays it, but the final workbook action is not visually reliable.
- `result_path` is introduced with source, purpose, unit, and interpretation and is readable.

### O007 — `student_policy.py` observation to action

Status: **FAIL — repair required**.

- Title wraps: `→ action` is pushed onto a second line and overlaps the title divider/lead area.
- The left policy code is too dense for its card. The lower branch text and `return WAIT` region visibly collide with the explanatory text at the bottom of the card.
- The right field table has multiple cell overflows and collisions: long interpretations extend across cell boundaries; `count` is broken into an unreadable narrow cell; the final `FLUSH_BATCH` interpretation is crowded into the row edge.
- The legal action enum line is pressed into the bottom field region and competes with the card/table content.
- The conceptual content is correct and valuable—observation fields, source, purpose, unit, interpretation, and the mapping to action tokens are all present—but it is not directly teachable in this layout.

### O008 — marked blocks and protected contract

Status: **FAIL — repair required**.

- Title stays on one line.
- The left code card is mostly readable, but the final code lines and the explanatory text below it collide; the lower `policy identity`/provenance text extends into the yellow field box.
- The yellow lower box is visibly clipped/overlapped at its top and bottom by the preceding explanatory text and the footer area.
- The green `可編輯：active block` heading wraps inside a short box and sits too close to the border.
- The right-side active-block and course-contract bullets are conceptually clear, but the left code/field area needs a larger vertical budget or fewer lines.

### O009 — exact run and paired artifacts

Status: **PASS**.

- Title stays on one line; the lead wraps to two lines but remains separated from the command cards.
- POSIX/WSL and Windows commands are legible and visually paired.
- The page clearly states the same case, package root, and run identity rule, then connects stdout `result_path` to the generated run directory and paired replay artifact.
- `run_id` is introduced with source, purpose, unit, and interpretation.
- No visible overflow or collision found.

### O010 — `/course` import, replay, ledger, workbook

Status: **FAIL — severe repair required**.

- Title wraps: `evidence` is forced onto a second line and overlaps the title divider/lead area.
- The three right-side cards have severe internal text collision. The headings (`validate / import`, `endpoint replay`, `ledger / workbook`) overlap their body text and are not cleanly separated.
- The lower yellow endpoint-scope card overlaps the lower `service` field box.
- The lower service field text crosses the field/card boundary and is close to or under the footer region.
- The screenshot/evidence panel is useful and the page names the correct website responsibilities, but the card collisions make the workflow difficult to read aloud or follow.

### O011 — result-reading order and claim boundary

Status: **FAIL — severe repair required**.

- Title wraps: `endpoint J / bit per J` is forced onto a second line and overlaps the title divider/lead area.
- The left service → packet/radio state → endpoint energy sequence is understandable, though the middle heading is dense.
- The right red claim-boundary card has severe heading/body collision and text extends beyond the card's intended reading area.
- The lower `radio_state` field overlaps the claim card and the claim-ceiling line; the bottom qualification line is pressed into the footer region.
- The page contains the correct gate-first reading order and claim ceiling, but its current geometry is not acceptable for direct classroom explanation.

## Content coverage decision

| Requirement | Visible coverage | Audit result |
|---|---|---|
| Why LoRaEnergySim fits smart-energy/IoT application | O001 fixed context, endpoint decision inputs, bounded package runner; O002 service-window behavior | Covered and visually clear |
| What the package already implements | O001–O003 runner, deterministic events, endpoint model, setup, evidence/recovery, `/course` path | Covered; O003 is clear |
| What remains to operate | O003 fixed environment/runner/evidence boundary; O005 setup/verify/inspect/edit→run | Covered, but O005 command layout needs repair |
| Three exact lab edits | O004 A `SLEEP→WAIT`, B `STABLE_STEPS 2→1`, C `URGENT_MARGIN_S 20→5→30` | Covered and clear |
| Before/after evidence goals | O004 reading order and prediction; O007 action/field mapping; O009 paired result/replay | Present, but O007 is too dense |
| Exact operation and upload flow | O005, O006, O009, O010 | Present; O005/O006/O010 need visual repair |
| Website responsibility and field interpretation | O006/O010/O011; `result_path`, `service`, `radio_state`, `endpoint bit/J` definitions | Semantically present; O010/O011 need visual repair |

## Required repair priority

1. **O010 and O011:** separate heading/body text, move lower field boxes upward or reduce content, and keep claim/qualification text inside bounded cards.
2. **O007 and O008:** reduce code/table density and give the field explanations their own vertical space; prevent lower explanatory text from entering the code/card region.
3. **O005 and O006:** enlarge platform command boxes and the workbook card; prevent command and `reopen` text from leaving their containers.
4. **O006, O007, O010, O011 titles:** shorten or resize titles so they remain on one line within the template title shell.

