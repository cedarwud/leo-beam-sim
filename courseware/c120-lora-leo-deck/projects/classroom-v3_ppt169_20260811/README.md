# C-120 classroom deck v3

- Final editable deck: `exports/c120-lora-leo-classroom-v3-editable.pptx`
- Source template: `/home/u24/ppt-master/template/educate.pptx`
- Slide count: 108 (within the accepted 98–116 range)
- Content donor: `sources/full-deck-v2-classroom-script.md`, rewritten into varied native layouts
- Native master/layout/footer/logo/background: preserved from `educate.pptx`; no master/layout reserialization or footer stripping
- Formula slides P033/P034: named native-equation hooks only; no formula PNG/SVG and no raw LaTeX on slide. Controller inserts OMML later.
- Evidence: `evidence/browser-live-course-20260811/` is the current live-course capture set; P085 preserves the explicit HTTP `SHA256_UNAVAILABLE` blocker and no old success screenshot is reused.
- Speaker notes: 108 notes slides; exact forbidden word and duration labels are rejected by the builder.
- QA: `validation/qa_report.json` (`PASS`); render evidence under `validation/render-status.md` and `renders/`.

Every operation page carries exact action, purpose/mechanism, expected observable output, and interpretation/recovery. The operation treatment varies between split action/why panels, command ribbons, code-focus views, receipt paths, evidence comparisons and recovery branches.
