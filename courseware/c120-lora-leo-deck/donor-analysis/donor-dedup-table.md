# BeamShift donor deduplication and disposition

Status: `READ-ONLY AUDIT COMPLETE / DONORS UNMODIFIED`

This is a topic-level donor audit for the C-120 deck. It does not authorize
copying a donor slide, formula, number, screenshot, command, speaker note, or
claim into the classroom deck. The current course package identity is
`https://github.com/cedarwud/lora-energy-lab`, root `lora-energy-lab/`, Python
module `lora_energy_lab`. No obsolete C-120 package ZIP, server path, URL, or
checksum is used here.

## Exact donor inventory

| Donor | Exact path | Bytes | SHA-256 | Slides | Non-empty notes | Canvas | Source role |
|---|---|---:|---|---:|---:|---|---|
| `e2` | `/home/u24/papers/beamshift/e2.pptx` | 2,065,216 | `60ba796c908387cdfe06c2b82e592bcce3205e2472c42566467bbbd89dcad024` | 114 | 114/114 | 13.3333 × 7.5 in, 16:9 | content and notes donor |
| `delivery-variant` | `/home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx` | 1,657,236 | `7dbdc23e17d7a3c6dc8d6ed76823100da6aa7f14512a8128201a42c59f5ddd34` | 114 | 0/114 | 13.3333 × 7.5 in, 16:9 | visual/provenance comparison only |

Both paths were readable at audit time. Neither donor was edited.

## Method and re-derived findings

The audit used the repository's read-only OOXML extractor, the PPTX skill's
LibreOffice conversion path, `pdftoppm`, and labelled contact sheets:

1. Hash each source file with `sha256sum`; count slides, notes, dimensions,
   slide XML parts, text shapes, media relationships, and layouts with
   `python-pptx` plus direct OOXML package reads.
2. Extract title/body/notes text in shape order. Normalize Unicode case and
   whitespace, then compare same-number pages with a sequence-similarity
   score. Exact visible-text, normalized-text, title, and slide-XML hashes are
   retained in the audit output.
3. Convert each donor to a 114-page PDF, render all pages at 96 dpi, and
   inspect six contact sheets per deck. Semantic duplicate groups below use
   text/title/layout evidence plus this rendered comparison; a high text score
   alone is not treated as proof of equivalence.

Recheck results:

| Finding | Result |
|---|---:|
| Same-number titles matching across donors | 114/114 |
| Same-number pairs with exact visible text | 1/114 |
| Same-number pairs with exact normalized text | 1/114 |
| Same-number pairs with normalized similarity ≥ 0.99 | 89/114 |
| Same-number pairs with normalized similarity ≥ 0.98 | 111/114 |
| Same-number pairs with normalized similarity ≥ 0.97 | 113/114 |
| Lowest same-number normalized similarity | 0.9680 (slide 28) |
| Unique direct slide XML hashes | 114/114 in each donor |
| Slides containing PNG relationships | 50 (`e2`), 13 (`delivery-variant`) |
| PNG relationships | 63 (`e2`), 18 (`delivery-variant`) |

The one exact same-number page is the title page. The delivery variant has no
speaker notes and therefore cannot independently supply narration or notes.
`e2` notes are present on all pages, but they are historical source material:
only 16 notes have a `Slide N:` header matching the current page; 38 headers
use an earlier page number (17–37 and the restarted 98–114 sequence), and 60
notes have no such header. Any adopted idea needs a new page ID, current
Traditional Chinese wording, current notes, and current evidence labels.

## Disposition of `e2.pptx`

`ADOPT` means retain a causal/topic idea and redraw or rewrite it for the
current endpoint-energy course. `APPENDIX` means optional source or vocabulary
deepening; one concept may survive per new page. `RETIRE` means do not carry
the donor page's workflow, semantics, evidence, or visual as a current page.

| `e2` slides | Decision | Topic-level rationale and required rewrite |
|---|---|---|
| 2, 4–6, 12 | **ADOPT → opening/core or Lab B branch** | Use the changing service-window, overlap, visibility/qualification, and slow/fast switch ideas. Reframe around an IoT endpoint choosing send/wait/sleep; LEO remains a worked example, not the course destination. |
| 14, 16 | **ADOPT → model bridge** | Keep the distinction between rate/throughput, power, and energy. Rebuild with `W`, `J`, `bit/s`, delivered bits, endpoint service, and current units. |
| 17 | **RETIRE / DEDUPE with 16** | Same title/concept as 16; no additional teaching capacity. Keep one rewritten unit/causal explanation only. |
| 19–21 | **ADOPT → model/evidence bridge** | Keep service reactions, same-window A/B, and the explicit power-to-time accounting boundary. Replace satellite payload accounting with the current endpoint ledger and never alias endpoint J to system consumed J. |
| 36–39 | **ADOPT → fair-comparison/debrief** | Keep the four-part evidence alignment and control → intermediate state → observable result chain. Rebuild around one marked `student_policy.py` change and current runner/replay artifacts. |
| 70–75 | **ADOPT → evidence clinic** | Keep comparison qualification, accumulated numerator/denominator, and the warning that one energy number is insufficient. Use current artifact identity, service gate, units, and claim ceiling. |
| 96–97 | **ADOPT → evidence clinic/exit** | Keep the claim-boundary and evidence-record structure. Rewrite around source mode, scenario identity, policy hash, result/replay pair, limitation, and `SIMULATED TEACHING DATA`. |
| 113 | **ADOPT → appendix or evidence clinic** | Keep measured/derived/assumed/simulated classification. Current runner and endpoint replay remain simulated teaching evidence unless a future owner gate raises the claim. |
| 7–10, 98–110 | **APPENDIX ONLY** | Select a single TLE/OMM/SGP4/coordinate/provenance path. Slides 7 and 98 are alternate TLE openings; choose one concept, do not show both. No satellite derivation is required for the IoT energy labs. |
| 13, 15, 22–35, 111–112, 114 | **APPENDIX ONLY** | Select only the minimum SINR, dB/linear, angle, PA, power-boundary, and source-detail vocabulary. Use one concept per page and redraw with current symbols and units. |
| 1, 3, 11, 18 | **RETIRE / REWRITE FROM ZERO** | Satellite-first title, platform/payload framing, specialist geometry, and old opening order conflict with the endpoint-first smart-energy/IoT promise. |
| 40–69 | **RETIRE** | Old controls, T1–T3 buttons, producer states, blank/filled observation tables, and session semantics do not describe the current runner or `student_policy.py` contract. |
| 76–95 | **RETIRE** | Old T4–T6 operations, legacy Run EE, producer-state screens, and old tables are not current C-120 endpoint evidence. Rebuild any needed evidence lesson from the current import/replay/workbook path. |

The ranges above partition all 114 `e2` pages: 23 topic-level Adopt pages, 36
Appendix pages, and 55 Retire pages.

## Disposition of the delivery variant

The delivery variant follows the same chapter order and has the same 114 title
strings, but has no notes. It is never a second content donor:

| Delivery-variant page set | Decision | Meaning |
|---|---|---|
| 2, 4–6, 12, 14, 16, 19–21, 36–39, 70–75, 96–97, 113 | **APPENDIX / visual comparison only** | Compare composition, formula treatment, or source/provenance differences while adopting the corresponding `e2` topic only after rewrite. |
| 7–10, 13, 15, 22–35, 98–110, 111–112, 114 | **APPENDIX / visual comparison only** | Optional visual reference for the technical appendix; it contributes no narration and no current evidence. |
| 1, 3, 11, 17–18, 40–69, 76–95 | **RETIRE** | Do not carry its old framing or workflow. |

This gives 59 visual-comparison Appendix pages and 55 Retire pages. There are
zero delivery-variant Adopt pages because the current deck must not inherit
its bytes or notes.

## Duplicate and near-duplicate groups

| Group | Evidence seen in the rendered/text audit | Decision |
|---|---|---|
| 7 / 98 | Both are a TLE opening; 98 adds the original two-line string and fixed-position explanation. | Keep one optional TLE source page; prefer the richer source card only after current source/licence review. |
| 16 / 17 | Exact title duplicate and the same throughput → power → energy explanation. | Keep one rewritten unit/causal page; retire the second. |
| 45 / 46 | T1 blank observation table followed by the same table with values. | Retire both; current labs use generated runner artifacts, not donor tables. |
| 54 / 55 | T2 blank/filled continuous-power table pair. | Retire both; do not count blank and filled states as separate lessons. |
| 57 / 58 | T2 blank/filled event-energy/window table pair. | Retire both; replace with current result/replay evidence. |
| 64 / 65 | T3 blank/filled control/window table pair. | Retire both; fixed comparisons belong to the current policy loop. |
| 67 / 68 | T3 blank/filled quality/load/rate table pair. | Retire both; do not import legacy RF values or producer state. |
| 78–80 | T4 parameter table, readout, and interpretation repeat one old button/session operation. | Retire the sequence as one old workflow cluster. |
| 83–86 | T5 blank/readout/interpretation pages repeat a legacy RF-setting operation. | Retire the sequence; no old measured-looking values enter C-120. |
| 92–95 | T6 table/readout/interpretation/producer-state sequence repeats legacy Run EE semantics. | Retire the sequence; use current endpoint/system boundary and workbook evidence instead. |
| `e2` 1–114 ↔ delivery 1–114 | Same-number title order is identical; 89/114 text pairs score ≥0.99, but slide XML and many formulas/media differ. | Treat as correspondence, not license to concatenate or copy. `e2` supplies topic/notes; delivery supplies visual comparison only. |

## Reproducibility commands

The following commands were used or are sufficient to reproduce the audit; the
output directory is outside the repository so the donor workspace remains
untouched:

```bash
sha256sum /home/u24/papers/beamshift/e2.pptx \
  /home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx
python3 courseware/c120-lora-leo-deck/donor-audit-v2/extract_pptx_inventory.py \
  --output /tmp/beamshift-donor-analysis-recheck
python3 /home/u24/.codex/skills/pptx/scripts/office/soffice.py --headless \
  --convert-to pdf --outdir /tmp/beamshift-donor-analysis-recheck/renders/e2-pdf \
  /home/u24/papers/beamshift/e2.pptx
python3 /home/u24/.codex/skills/pptx/scripts/office/soffice.py --headless \
  --convert-to pdf --outdir /tmp/beamshift-donor-analysis-recheck/renders/delivery-pdf \
  /home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx
pdftoppm -png -r 96 <donor.pdf> <owned-render-prefix>
python3 courseware/c120-lora-leo-deck/donor-audit-v2/make_contact_sheets.py \
  --root /tmp/beamshift-donor-analysis-recheck
```

Authority for the course boundary is ADR-004, the C-120 integration SDD §13.5,
the 2026-08-10 controller handoff, and
`courseware/c120-lora-leo-deck/PARALLEL-BUILD-CONTRACT.md`. These authorities
also require the final deck to be rebuilt from the current `educate.pptx`
template by one controller-owned assembler; donor masters are not concatenated.
