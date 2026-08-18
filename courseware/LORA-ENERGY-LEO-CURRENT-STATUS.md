# LoRaEnergySim × LEO classroom deck — current status

Updated: 2026-08-11

## Easy-to-find current files

- `lora-energy-leo-classroom-current-preview.pptx` — current editable P001–P027 preview; not the final deck.
- `lora-energy-leo-classroom-P028-P063-current-preview.pptx` — current editable Lab A / B module; structural QA passed, visual QA pending.
- `lora-energy-leo-classroom-current-speaker-notes.md` — notes for the current preview.
- `lora-energy-leo-classroom-current-qa.json` — structural QA for the current preview.
- `beamshift-donor-dedup-table.md` — verified donor adopt / appendix / retire table.
- `beamshift-donor-insertion-map.md` — donor-to-course insertion map.
- `full-deck-outline-98-116.md` — current full-deck outline.

## Progress

- P001–P027: REJECTED as a classroom deliverable. The latest render still uses an evidence-card narrative, insufficient visible teaching explanation, low-contrast status text, and overly small supporting content. A direct-teaching rewrite is in progress.
- P028–P063: REJECTED as a classroom deliverable after controller rendering. Native equation pages overlap placeholder shapes and lines; one operation title is cropped; status labels invade the title area; several commands are not release-ZIP-compatible; visible teaching explanation is insufficient. Representative failures are under `evidence/part2-visual-audit-20260811/`.
- BeamShift donor audit: complete; both 114-slide donors were re-rendered and deduplicated.
- P064 onward and final integration: controller-owned work remains.

## Acceptance boundary

The current preview is available for inspection, but it is not labeled classroom-ready until all modules are assembled, every slide is rendered and inspected, native equations are verified, and Microsoft PowerPoint open/save/reopen succeeds without repair.

## Current classroom-operability gate

The current P001–P063 files are not yet a self-contained end-to-end classroom deck:

- Lab A / B pages name the editable blocks but do not yet show the exact candidate values needed to reproduce the packaged fallback lineage (`REST_DURING_GAP = WAIT`, then `STABLE_STEPS = 1`).
- Lab C, current `/course` import, workbook save/reopen, and transfer/debrief pages are not yet assembled.
- Windows-native Python 3.11 setup and all exact cases still lack a clean current Windows evidence run.
- Live browser recheck on 2026-08-11: the public `/course` built-in same-scenario fallback loads, but uploading the current package fallback `baseline-A/result.json` is rejected with `schema:UNKNOWN_FIELD $.scenario_anchor_sha256`. The package-to-Leo contract is therefore not end-to-end compatible yet.

Do not claim classroom-ready or use slide count as a duration guarantee while these gates remain.
