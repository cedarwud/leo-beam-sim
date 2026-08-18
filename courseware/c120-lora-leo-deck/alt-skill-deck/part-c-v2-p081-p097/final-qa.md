# Part C V2 P081–P097 QA

Output after release: `courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-PART-C-V2-P081-P097-REVIEW.pptx`

- Scope: P081–P097, 17 slides, 17 speaker-notes slides.
- Construction: managed PptxGenJS 4.0.1 through the writable `/tmp` runtime mirror, then exact `educate.pptx` template overlay.
- Shell: all authored slide relationships target `slideLayout2.xml`; no slide-level background fills; inherited footer/logo preserved.
- Typography: title 28 pt; preferred body 24 pt; compact field/code labels 16–20 pt; CJK `標楷體`; Latin/numerals `Times New Roman`.
- Structural QA: PASS — ZIP integrity, recursive slide/notes XML, relationship targets, slide/notes counts, unique creation IDs, 16 pt authored-font floor, forbidden-language scan, and placeholder scan.
- Shared `qa_v2_deck.py`: PASS — 17 slides, 17 notes, no errors or warnings.
- Geometry QA: PASS — no authored shape crosses the footer boundary, no text-box intersections, and no title/logo collision.
- Render QA: PASS — LibreOffice 24.2.7.2 `oosplash` produced 17 PDF pages and 17 original-proportion PNGs at 144 dpi in `/tmp/c120-style-c081-p097/render-pass5-png/`; all pages were inspected in contact sheets and full-size samples.
- Evidence: only the three identifier-free current clean crops are embedded; unavailable current panels remain labelled `待補`; no fabricated screenshot or KPI is used.
- Teaching boundary: service → delivery → endpoint J → endpoint bit/J; provider, endpoint, system, and canonical energy remain distinct; read/write/unchanged states are stated on the website/control pages.
- Evidence-based visual correction: P084 lineage card uses intentional three-line grouping to prevent renderer splitting `revision`.
- Microsoft PowerPoint native reopen: not run in the current sandbox; Python package reopen and recursive XML validation passed.

No commit or push was performed. No other writer lane was modified.
