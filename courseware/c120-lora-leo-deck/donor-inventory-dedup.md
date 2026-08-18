# BeamShift donor inventory and semantic dedup

Status: `READ-ONLY AUDIT COMPLETE / DONORS UNMODIFIED`

## Inventory

| Artifact | Bytes | SHA-256 | Slides | Speaker notes | Role |
|---|---:|---|---:|---:|---|
| `/home/u24/papers/beamshift/e2.pptx` | 2,065,216 | `60ba796c908387cdfe06c2b82e592bcce3205e2472c42566467bbbd89dcad024` | 114 | 114/114 non-empty | content and notes donor |
| `/home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx` | 1,657,236 | `7dbdc23e17d7a3c6dc8d6ed76823100da6aa7f14512a8128201a42c59f5ddd34` | 114 | 0 | visual/provenance comparison only |

Verified with `sha256sum` and OOXML package counts. Both are 16:9 and preserve the same 114-title order. They are not byte-identical: only slide 1 has the same direct `slideN.xml` hash. After normalizing visible text, 94/114 pages are identical; the remaining 20 differ by shape-text order or small wording edits.

Do not concatenate either donor into the new deck and do not clone their chapter rhythm as the new house style.

## Notes caveat

`e2.pptx` has non-empty notes on all 114 slides, but historical numbering drift makes them semantic source material rather than reusable final notes:

- only 16 notes carry a `Slide N:` header matching the current page number;
- slides 17–37 use an older numbering sequence;
- slides 98–114 restart with old 1–17 numbering;
- 60 notes have no `Slide N:` header;
- 10 notes in slides 98–114 do not exactly match the current slide title.

All adopted ideas therefore require new page IDs, new titles, new narration and current claim language.

## Adopt / appendix / retire

| Donor slides | Decision | Concept retained | Required rewrite |
|---|---|---|---|
| 2, 4–6 | `ADOPT → core/contingency` | changing service window, visibility, handover opportunity | endpoint IoT service/energy first; LEO only as example |
| 12 | `ADOPT → core` | too-slow switching versus ping-pong | policy/action consequence; no old session semantics |
| 14, 16/17 | `ADOPT + DEDUPE` | throughput, power and energy distinction | collapse 16/17 into one concept; separate W, J, bit/s and bit/J |
| 19–21 | `ADOPT → core` | service reaction, same-window A/B, W→J accounting boundary | current endpoint ledger and runner evidence only |
| 36–39 | `ADOPT → core` | fair A/B; control → intermediate state → observable evidence | new bounded policy loop; no legacy browser control screenshot |
| 70–75 | `ADOPT → evidence clinic` | evidence qualification, two accumulated quantities, why one energy number is insufficient, validity gates | current artifact identity/provenance and endpoint/system boundary |
| 96–97 | `ADOPT → evidence clinic` | claim boundary and evidence record | current exact claim ceiling |
| 113 | `ADOPT → evidence/appendix` | measured / derived / assumed / simulated | simulated teaching data cannot become measured KPI |
| 7–10, 98–110 | `APPENDIX ONLY` | selected TLE, SGP4, coordinate and provenance concepts | one concept per slide; 7 and 98 are alternate TLE openings, so merge or choose one |
| 13, 15, 22–35, 111–114 | `APPENDIX ONLY` | selected SINR, dB, PA, angle, system-boundary and source detail | optional vocabulary/deepening; never required derivation |
| 1, 3, 11, 18 | `RETIRE / REWRITE FROM ZERO` | satellite-first opening, platform/payload and specialist geometry framing | new deck opens with endpoint smart-energy/IoT relevance |
| 40–69, 76–95 | `RETIRE` | old buttons, T1–T6 operations, blank/filled tables, producer/session semantics | cannot become current course semantics |

## Duplicate clusters to collapse

- Exact title duplicate: 16/17.
- High-overlap pairs/groups: 7/98; 45/46; 54/55; 57/58; 64/65; 67/68; 78–80; 83–86; 92–95.
- Repeated blank/filled/readout table sequences and duplicated formulas are retired rather than counted as new teaching capacity.

## Donor-to-new-deck routing

- Core conceptual donors: service window, fair A/B, W/J, evidence boundary and claim classification.
- Contingency donors: ping-pong/slow-switch counterexample and source/model/assumption recovery.
- Appendix donors: minimal TLE/SGP4/SINR/dB/angle vocabulary.
- No donor supplies current runner commands, `student_policy.py` line numbers, current result artifact, endpoint replay screenshot or KPI.

Authority: `docs/sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md`, presentation production specification §13.5.
