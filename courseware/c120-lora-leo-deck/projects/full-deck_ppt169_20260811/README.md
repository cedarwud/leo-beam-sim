# C-120 full deck native-template project

- Template: `/home/u24/ppt-master/template/educate.pptx`
- Target: 108 slides (`70 core + 22 contingency + 16 appendix`)
- Lifecycle: ppt-master native template fill, then OOXML-only typography pass
- Background: original template background/master/colors; no added fill
- Typography: 標楷體 Chinese, Times New Roman English/numerals, 28 pt titles,
  italic variables/raw LaTeX formulas, roman prose
- Evidence: runtime/API/command/code-line/browser/KPI fields remain explicit
  placeholders until frozen
- Commit/push: not authorized

Content fragments live in `courseware/c120-lora-leo-deck/full-content/` and are
merged by `build-full-deck-plan.py`.  Native/readback QA must pass before the
build path is treated as deliverable; owner visual acceptance remains separate.
