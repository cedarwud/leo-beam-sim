# Part A expanded deck — final QA

Final output:

- `../../latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pptx`
- 16 slides; visible titles contain no `Pxxx｜` page ID. Internal source map keeps: `P001`, `P001A`–`P001D`, `P008B`–`P008D`, `P002`–`P008`, `P008A`.
- Opening chunk visibly covers the simulator definition, source-backed upstream capability boundary, course packaging, competition evidence ceiling, run-only artifact creation, `/course` import boundary, and baseline→candidate→withheld reading order.

Machine checks:

- `part-a-v2/qa/preview-qa.json`: `PASS`; 16 slides, 16 notes, layout2-only, no authored slide background, unique creation IDs, minimum authored size 16 pt, forbidden-term hits zero.
- Host Office validator: all XML well formed; references, layouts, content types, notes relationships, and slide layout references all passed.
- Notes: 16/16 non-empty formal notes.
- Fonts: 277 authored font-property nodes; all have Latin `Times New Roman` and East Asian `標楷體` properties.
- OOXML package: `unzip -t` passed with no compressed-data errors.
- Final SHA-256: `408c659ee36a0b8885bb15ea4140259f84d140b74e06b658801e7459f2348a4f`.

Render and visual checks:

- `render-fixed/LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pdf`: LibreOffice open/convert passed; 16 pages; page size `960.009 x 540 pt`.
- `render-fixed/slide-01.png` … `slide-16.png`: all 16 original-size renders present at 150 dpi.
- `render-fixed/contact-sheet.png`: all pages checked for inherited footer/background, clipping, overlap, and card readability.
- Original-size spot checks covered the repaired P001C import card, P008B run-only artifact gate, P008C local-runner versus `/course` boundary, and P008D freeze/import-order card. The final render includes the visible-title-ID removal and the upstream/policy-slot clarification.
- `render-original/RENDER-STATUS.json` is marked `SUPERSEDED` because it records the earlier 13-page pre-artifact-boundary baseline; `render-fixed/` is the authoritative final 16-page render.
