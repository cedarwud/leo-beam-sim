# C-120 four-slide style test — QA report

Status: **OWNER-REVIEW / STYLE TEST**

This checkpoint stops at four slides. It is a visual-extension test for the accepted `2slides + edu` direction, not a complete nine-slide Phase 0 deck and not classroom-readiness evidence.

## Authoritative owner-review artifacts

- PPTX: `leo-energy-course-c120-style-test-4slides-owner-review.pptx`
  - Size: 856,780 bytes
  - SHA-256: `77d76d5ce3575813959385afc035599e0e153ce93a731ddd919137cdceac8846`
- PDF: `leo-energy-course-c120-style-test-4slides-owner-review.pdf`
  - Size: 361,312 bytes
  - SHA-256: `6e69009e2b0660408bb842f5395b434d89d76b09ba9a0067a601b1dd8eaf73d3`
- Renders: `renders-c120-style-test-4slides-owner-review/`
  - `slide-1.png`: `5af5c8a83c2dd1275851aa1c44c005fd4bb1fd8d5205c41c1cf3a687bec437d0`
  - `slide-2.png`: `0c446ef59c29c7493131d13016394e36a1479aec018f25ce2d053c0f7cf612f4`
  - `slide-3.png`: `96be39bc568903f4ab97f398760e3041bae2e553035af9a33ac4bc41e455d0e3`
  - `slide-4.png`: `8a53e1cef4d7d0985a489df445f17043c8b70ceb5debbf79f259cddc3df862e2`
  - All four renders: 2000 x 1125 px, full-page.

Only the artifacts named above are authoritative for this owner review. Earlier `donor-extension` and similarly named `style-checkpoint` files are superseded.

## What failed in the previous four-slide attempt

1. Delivery naming was ambiguous. The PowerPoint instance reported by the owner matched an older 857,255-byte artifact rather than the intended later build; too many near-identical filenames made the handoff unsafe.
2. The previous manual OOXML merge introduced duplicate non-visual property IDs on Slides 3 and 4: both `Text 23` and `Slide Number Placeholder 0` used `p:cNvPr/@id="25"`. That package defect could trigger PowerPoint's repair workflow.
3. The earlier hidden COM open check was not a valid red-capable test for the visible repair prompt and must not be treated as PASS evidence.
4. The previous visual extension copied the donor's borders but not its grouping logic. Slides 3 and 4 therefore had too many white outline boxes and too little semantic fill, producing the sparse wireframe appearance the owner rejected.

## Corrected construction route

- Slides 1–2 came from the accepted `leo-energy-course-donor-transplant-2slides-edu.pptx` baseline.
- Slides 3–4 were authored as editable shapes and text with the managed PptxGenJS runner.
- The four-slide package was assembled and saved through native PowerPoint using the edu no-placeholder layout.
- No manual OOXML slide merge was used in the final package.
- Slides 3–4 now use a small number of large, pale semantic fields plus stronger filled anchors; they do not revert to an all-page pastel fill and do not repeat a grid of empty outline cards.

## Verification results

### Package and pagination

- PASS — PPTX contains exactly 4 slides, 1 slide master, and 2 layouts.
- PASS — PDF contains exactly 4 pages at 960 x 540 pt.
- PASS — Every slide uses `PPTX_WRAP_EDUCATE_CONTENT_NO_PLACEHOLDERS`.
- PASS — Placeholder count is zero on every slide.
- PASS — No duplicate `cNvPr` IDs on any slide.
- PASS — Office package validation: well-formed XML, namespaces, unique IDs, references, content types, slide-layout references, and XSD regression checks all passed.

### Accepted first-two-slide preservation

- PASS — The accepted two-slide baseline and the new four-slide file were exported by the same native PowerPoint renderer at the same resolution.
- PASS — Final Slide 1 is pixel-identical to donor Slide 1: both hash to `5af5c8a83c2dd1275851aa1c44c005fd4bb1fd8d5205c41c1cf3a687bec437d0`.
- PASS — Final Slide 2 is pixel-identical to donor Slide 2: both hash to `0c446ef59c29c7493131d13016394e36a1479aec018f25ce2d053c0f7cf612f4`.

### Repair-prompt regression

- PASS — Confirmed no pre-existing PowerPoint process, then opened the final PPTX visibly with native PowerPoint.
- PASS — Windows UI Automation observed the presentation window and found zero repair/recovery/problem-with-content/unreadable signals: `REPAIR_SIGNALS=0`, `VISIBLE_OPEN_NO_REPAIR_PASS`.

### Typography and visual inspection

- PASS — All authored slide text is at least 16 pt.
- PASS — Slides 3–4 were fixed and re-rendered after the first extension was found too outline-heavy; the wrapped `BALANCED` label and missing page-number details were also corrected.
- PASS — Direct inspection found no overflow, unintended overlap, cropping, weak contrast, template-boundary intrusion, or illegible text.
- PASS — Fresh visual reviewer found no blocking issue on any slide. It confirmed Slides 1–2 preserve the donor baseline and Slides 3–4 use larger filled groups with fewer fragmented frames without becoming fully pastel-filled.
- PASS — The visual reviewer also found the `active time`, prediction, and simulated/non-live/non-measured/pending-validation boundaries legible and distinct.

## Remaining unknowns

- UNKNOWN — Whether the owner accepts Slides 3–4 as the visual grammar for later stages; machine and reviewer checks cannot substitute for owner taste approval.
- UNKNOWN — Slides 1–2 preserve the accepted donor visual content, but their current wording is not approval of final C-120 course content.
- UNKNOWN — Activity durations remain design estimates and have not been validated with novice learners.
- UNKNOWN — Simulated teaching data remain non-live, non-measured, and not yet verified for canonical parity.

## Owner approval gate

**STOP.** Do not extend this direction to the remaining slides or a full deck until the owner explicitly approves the Slides 3–4 visual extension. If approved, treat `2slides + edu` as one reusable style family, not as the only permitted visual style.
