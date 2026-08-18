# LoRaEnergySim × LEO classroom deck — current status

Updated: 2026-08-11

## Easy-to-find current files

- `../LoRaEnergySim-LEO-Part-A-REVIEW-WIP.pptx` — 32-slide editable review snapshot; controller visual repair remains active.
- `../LoRaEnergySim-LEO-Part-B-REVIEW-WIP.pptx` — 36-slide editable review snapshot with native Office Math; controller visual repair remains active.
- `lora-energy-leo-classroom-current-preview.pptx` — rejected historical P001–P027 preview; do not teach from it.
- `lora-energy-leo-classroom-P028-P063-current-preview.pptx` — rejected historical Lab A / B preview; do not teach from it.
- `lora-energy-leo-classroom-current-speaker-notes.md` — notes for the current preview.
- `lora-energy-leo-classroom-current-qa.json` — structural QA for the current preview.
- `teaching-rewrite/course-story-contract.md` — current direct-teaching story and the edit-before/after rule.
- `teaching-rewrite/part-a-visible-content.md` — current P001–P027 visible teaching content.
- `teaching-rewrite/part-b-visible-content.md` — current Lab A / B visible teaching content; command pages are being consolidated.
- `teaching-rewrite/part-c-visible-content.md` — current Lab C, `/course`, workbook, and transfer teaching content; current field walkthrough is being expanded.
- `teaching-rewrite/module-build-interface.md` — shared template, typography, output, and module integration contract.
- `evidence/browser-field-inventory-20260811/field-interpretation.md` — controller-verified current `/course` field-by-field teaching contract after upload or fallback.
- `beamshift-donor-dedup-table.md` — verified donor adopt / appendix / retire table.
- `beamshift-donor-insertion-map.md` — donor-to-course insertion map.
- `full-deck-outline-98-116.md` — current full-deck outline.

## Progress

- P001–P027 old preview: REJECTED. Direct-teaching visible content is complete; a new isolated Part A PPTX build is active.
- P028–P063 old preview: REJECTED. Formula overlap and title-crop repairs were proven mechanically, but the evidence-first page content remains unsuitable. Lab A / B content is being consolidated so each lab uses one compact run/receipt page and spends the remaining pages on original code, exact edit, prediction, before/after evidence, causality, and withheld interpretation.
- BeamShift donor audit: complete; both 114-slide donors were re-rendered and deduplicated.
- Part C field walkthrough and isolated PPTX build are active. Final module merge and full render acceptance remain open.

## Acceptance boundary

No current PPTX is labeled classroom-ready.  The next review artifact will be a
new direct-teaching Part A module, not another repair of the rejected preview.
Final acceptance still requires all modules to be assembled, every slide to be
rendered and inspected, native equations to be verified, and Microsoft
PowerPoint open/save/reopen to succeed without repair.

The two outer `REVIEW-WIP` files are intentionally available for early owner
inspection. They are snapshots, not acceptance claims, and will be replaced by
new filenames after the controller's visual repair and rerender cycle passes.

## Current classroom-operability gate

The current P001–P063 files are not yet a self-contained end-to-end classroom deck:

- Lab A / B pages name the editable blocks but do not yet show the exact candidate values needed to reproduce the packaged fallback lineage (`REST_DURING_GAP = WAIT`, then `STABLE_STEPS = 1`).
- Lab C, current `/course` field walkthrough, workbook save/reopen, and transfer/debrief pages are not yet assembled into the final deck.
- Windows-native Python 3.11 setup and all exact cases still lack a clean current Windows evidence run.
- Live browser recheck on 2026-08-11: both the public `/course` built-in same-scenario fallback and an actual upload of `courseware/lora-energy-lab-fresh-run-A-baseline-result.json` are accepted in a clean browser session. The actual upload is labeled `實驗 A／baseline · 實際執行`, run identity `sha256:e0c3827c2a2479962e5a97aa6f86b00ad1795634f951a2c02a6aa57007bb3bf4`, with `服務 FAIL`, `6.92 J`, `4800 bit`, and `693.641618 bit/J`.
- The same browser inspection found `503` requests for MODQN provider bundles in Evidence view. Endpoint result interpretation is available, but the provider view must not be claimed console-clean or browser-PASS.

Do not claim classroom-ready or use slide count as a duration guarantee while these gates remain.
