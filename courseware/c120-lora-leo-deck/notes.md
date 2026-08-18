# C-120 opening checkpoint notes

Status: `NATIVE CHECKPOINT GENERATED / FULL-DECK CONTINUATION AUTHORIZED 2026-08-11`

## Source precedence used

1. Latest explicit owner direction in the current request.
2. `docs/decisions/ADR-004-c120-course-packaged-loraenergysim-leo.md`.
3. `docs/sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md`.
4. `docs/handoff/C120-LORA-LEO-NEXT-CONTROLLER-2026-08-10.md`.
5. Current planning entry, issue 11, ADR-C-003, angle-aware EE binding README, competition intro, repo `DESIGN.md` and `PRODUCT.md` where not superseded.

## Authority conflicts kept visible

- `CURRENT-C120-HANDOFF.md`, issue 11 and `PRODUCT.md` still preserve the older no-install/no-source-edit rule and old eight-segment clock.
- ADR-004 and the draft integration SDD carry the newer owner amendment: install the prepared runner, edit only `student_policy.py`, and use the proposed ten-segment exact-120 flow.
- The checkpoint follows the latest amendment but labels the ten-segment clock `PROPOSED / OWNER REVIEW`; it does not claim simultaneous conformance to the unsynchronized planning entry.

## Claim ceiling

Stable learner-surface string:

`SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`

Highest current release claim:

`COURSE-PACKAGED SIMULATED LORA ENDPOINT-ENERGY LAB INTEGRATED WITH LEO FOR BOUNDED NOVICE VALIDATION`

Do not claim classroom-ready, a 20-seat pass, live satellite/network data, measured energy, canonical parity, whole-system/wall-plug energy, or validated LoRa-to-LEO equivalence.

## Current evidence placeholders

- Release URL/tag: unresolved.
- Supported Python minor version: candidate only, not frozen.
- Setup/run commands, case names, output paths and line numbers: SDD proposal, not released API.
- `student_policy.py` screenshot/line references: not source-stable.
- Runner receipt/result JSON: no current frozen artifact supplied to this deck lane.
- Leo import/browser screenshot: no current LoRa endpoint replay pixel evidence supplied to this deck lane.
- KPI/delta values: prohibited until current deterministic artifacts exist.

## Template route decision

The user selected the actual native
`/home/u24/ppt-master/template/educate.pptx` background, master and colors.
The deck therefore uses ppt-master Fill Native PPTX: the original cover is
cloned once and the original title/body/footer slide is cloned for content.

The white background, abstract artwork, logo and footer strip remain native.
No background fill or dark adaptation is added.  An OOXML-only text pass sets
標楷體, Times New Roman, 28 pt titles, roman prose and italic raw LaTeX/variable
runs without adding shapes or changing template assets.

## Continuation rule

The user explicitly authorized continuing beyond the opening checkpoint on
2026-08-11.  Full-deck production may proceed, but unfrozen setup/API/code/
command/browser/KPI material remains an explicit evidence placeholder.  Do not
commit or push without separate authorization.
