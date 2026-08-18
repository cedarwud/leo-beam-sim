# C-120 classroom deck v2 native-template project

- Input: `sources/full-deck-v2-classroom-script.md` (P001–P108)
- Native template-fill source: `sources/educate-layout-sampler-v2.pptx`
- Fill Native plan/check/apply evidence: `analysis/fill_plan.json`, `analysis/check_report.json`, `analysis/apply_report.txt`
- Post-compose editable deck: `c120-lora-leo-classroom-v2-editable.pptx`
- Speaker notes: 108 embedded notes slides, generated from each page's Notes + Recovery fields
- Template boundary: original master/theme/media/background retained; no slide-level background or footer/page-number shapes
- Evidence images: only the four current files under `evidence/browser-server-preview/`, labeled `SERVER PREVIEW / FIXTURE HOST ONLY` on matching import/replay/workbook/mismatch pages
- QA: `validation/qa_report.json`; PDF and contact sheets under `validation/render-final/` and `validation/contact-sheets/`

The final editable PPTX is the authoritative artifact.  Native Office Math is
present on the formula pages with exact LaTeX metadata and an SVG fallback for
rendering.  Human visual acceptance remains a separate gate.
