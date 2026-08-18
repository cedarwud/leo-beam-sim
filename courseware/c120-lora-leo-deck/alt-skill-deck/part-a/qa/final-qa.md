# Part A interim deck QA

Status: machine/render checks pass for the interim editable review artifact. Human acceptance remains with the controller lane.

- Output: `/home/u24/demo/leo-beam-sim/courseware/c120-lora-leo-deck/alt-skill-deck/LoRaEnergySim-LEO-ALT-PART-A-REVIEW.pptx`
- Source record: `../slides.json` (33 ordered entries with title, body, layout, notes, and donor-source fields)
- Template: `/home/u24/pptx-wrap/assets/templates/educate.pptx`
- Template SHA-256: `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`
- Shell: every slide is cloned from source slide 2 and every slide relationship targets `slideLayout2.xml`.
- Structure: 33 slides, 33 notes slides, 33 notes relationships; all notes are directly readable through MarkItDown.
- Native template preservation: `slideLayouts/`, `slideMasters/`, `theme/`, `media/`, and `notesMasters/` match the source template after the post-pack overlay.
- Typography readback: title 28 pt; body/card runs are 16–20 pt with no run below 16 pt; CJK uses `標楷體`, Latin/numerals use `Times New Roman`; variable/code runs are italic where marked.
- Formula policy: Part A contains no formulas, Office Math, or raster formula previews.
- Background policy: slide XML has no author `<p:bg>` fill; inherited template footer/background remains visible in the final render.
- Rendering: `qa/renders/final/` contains the PDF and 33 original-size PNG pages; contact sheets are `contact-01.png` and `contact-02.png`.
- Content scan: `qa/markitdown-final.txt` contains 33 titles and embedded notes; forbidden classroom terms and production/checksum/ZIP-test language scan clean.
- Pack log: `qa/rebuild-final.log`; pack validation passed, with only 8 template-master whitespace repairs before the exact-part overlay.

Donor mapping is limited to the relevant BeamShift concept pages and is recorded in `donor-source-map.md`; donor slide bytes, masters, screenshots, old KPI claims, and legacy evidence are not concatenated.
