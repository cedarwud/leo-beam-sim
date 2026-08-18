# Part C P064–P080 teaching acceptance

Scope: `latest/LoRaEnergySim-LEO-ALT-PART-C-V2-P064-P080-REVIEW.pptx`

## Completed teaching moves

| Move | Visible coverage |
|---|---|
| Locate the exact source | Locate page names `student_policy.py`, `lab-c-batch-urgent`, `URGENT_MARGIN_S`, and fixed `BATCH_SIZE = 3`. |
| Baseline meaning | Enlarged baseline code shows `URGENT_MARGIN_S = 20`, the `urgent_due_in_s <= URGENT_MARGIN_S` condition, and the action order. |
| Candidate edit | Separate enlarged before/after code page shows only 20 → 5 highlighted; command is kept on the run page. |
| Candidate run/read | Linux/macOS/WSL and Windows PowerShell/Command Prompt commands are shown; stdout `result_path`, paired JSON files, import, and service-first reading are explicit. |
| Revision edit | Separate enlarged before/after code page shows only 5 → 30 highlighted; unchanged scope is named. |
| Revision/surprise run | Exact revision `--freeze` and surprise commands, freeze receipt, paired JSON files, and no further edit are explicit. |
| Three-way comparison | 20／5／30 timeline separates mechanism from observed result and states the fixed-primary-case null contrast. |
| Surprise boundary | Current evidence shows 1／4 delivered, 3 retries, 2 collisions, 3 expired, 5.41 J, with service/deadline failure. |
| Website boundary | Runner produces JSON; website validates, materializes replay, and stores workbook; website does not execute Python. |
| Replay/workbook/reopen | Queue → action → state → packet → endpoint J, four-role lineage, and fail-closed reopen state are covered. |

## Current result evidence shown

- Baseline 20: service/deadline `true/true`; delivered `4/4`; expired `0`; endpoint `10.66 J`.
- Candidate 5: service/deadline `false/false`; delivered `3/4`; expired `1`; endpoint `9.74 J`.
- Revision 30: service/deadline `true/true`; delivered `4/4`; expired `0`; endpoint `10.66 J`.
- Surprise frozen 30: service/deadline `false/false`; delivered `1/4`; retries `3`; collisions `2`; expired `3`; endpoint `5.41 J`.

The candidate saves `0.92 J` but fails service and deadline. Matching 20 and 30 results in the fixed primary case are recorded as a null contrast, not as evidence that 30 is universally best. Surprise narrows the claim boundary.

## Structural and visual gates

- 18 slides and 18 speaker-notes slides; all authored slides target `slideLayout2.xml`.
- Visible titles contain no P-number or internal ID prefix.
- No visible POSIX label; platform wording is Linux/macOS/WSL and Windows PowerShell/Command Prompt.
- Shared QA: `qa_v2_latest.json` PASS; minimum explicit font 17 pt and no forbidden terms.
- Builder structural QA: `part-c-v2-p064-p080/qa/structural-qa.json` PASS; ZIP/XML/relationships/background/layout2/notes checks pass.
- LibreOffice PDF: `render-final/LoRaEnergySim-LEO-ALT-PART-C-V2-P064-P080-REVIEW.pdf`.
- Original-size PNG count: 18 under `render-final/png/`; contact sheet: `render-final/contact.png`.
- Full-size review completed for locate, baseline, run, edit, revision, three-way, and surprise pages; no visible overlap, clipping, or footer collision remains.
