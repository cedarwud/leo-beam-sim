# Parallel classroom-deck build contract

This file coordinates parallel slide production. It does not replace the ADR,
SDD, handoff, package contracts, or the original `educate.pptx` template.

## Shared presentation contract

- Template: `/home/u24/ppt-master/template/educate.pptx`.
- Preserve the template background, logo, bottom rule, footer text, and page
  number placeholders. Do not add a slide-level background fill.
- Keep authored content above the template footer reserve.
- Chinese font: 標楷體. Latin text and numerals: Times New Roman.
- Slide title: 28 pt. Body: normally 24 pt. Exact command text: at least
  18 pt.
- Main teaching statements should normally be 24–28 pt and exact commands
  should normally be 20–22 pt. Use 18 pt only for necessary evidence labels;
  never shrink teaching content to make an overcrowded page fit.
- Do not use bright orange or bright yellow-orange for authored text. Use the
  template navy, black, or a restrained muted gold with adequate contrast;
  leave the original template artwork unchanged.
- Variables and mathematical symbols are italic; prose is upright.
- Equations must remain editable PowerPoint math objects. Do not use equation
  screenshots.
- Do not show minutes or a repeated teaching-question rail. Put narration in
  actual speaker notes, not in a visible bottom strip.
- The exact Chinese word forbidden by the owner must not occur in slide text
  or notes. The required filename `student_policy.py` is allowed.
- Every installation, run, and policy-edit operation must visibly provide the
  exact action, its causal purpose/mechanism, the expected output, and how to
  interpret or recover. The layout must vary with the operation.
- The visible slide must be understandable without opening speaker notes.
  Concept slides need complete explanatory sentences; operation slides need
  the exact edit/command and a plain-language success/interpretation cue.
- Text-on-text overlap, equation/frame overlap, connector lines crossing text,
  and authored content entering the footer reserve are release blockers.
  Rerender at original size after every repair; split or simplify a slide
  instead of shrinking the text.
- Missing Windows, browser, KPI, or public-release evidence stays an explicit
  placeholder. Never upgrade an implementation claim into verified evidence.

## Current package identity

- Repository: `https://github.com/cedarwud/lora-energy-lab`
- Commit: `32cc7230904113e635cc591191243d7b72b4e9aa`
- Root: `lora-energy-lab/`
- Python package: `lora_energy_lab`
- Scenario: `ntpu-energy-decision-01`
- Policy API: `lora-energy-policy-v1`
- Local release candidate: `lora-energy-lab-v1.zip`
- Size: `121139` bytes
- SHA256: `047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c`
- Public GitHub Release URL: `RELEASE_ASSET_PENDING`

The obsolete archive names, server URLs, and checksum must not appear in new
slides.

## Module ownership

- Part A: opening, download boundary, Windows/WSL, Python 3.11, `.venv`,
  setup/verify, and bounded policy reading. Eventual P001-P027.
- Part B: Lab A and Lab B baseline/edit/freeze/withheld workflows. Eventual
  P028-P063.
- Part C: Lab C, evidence import, workbook, browser evidence, interpretation,
  recovery, and transfer. Eventual P064-P097. Controller-owned.
- Donor lane: BeamShift `e2.pptx` and 114-page comparison, duplicate clusters,
  adoption decisions, insertion map, and P098-P116 outline.

Writers must stay inside their assigned build script and project workspace.
They must not edit application source, authority documents, package source, or
another writer's module.

## Integration method

Modules are content and layout sources, not independent final decks. The final
deck is rebuilt by one controller-owned canonical assembler from the same
template. Do not concatenate arbitrary PPTX masters or copy donor masters into
the final file.

The controller performs the final gates:

1. Merge narrative and remove cross-module repetition.
2. Insert only donor slides classified as Adopt; route Appendix items to the
   appendix and omit Retire items.
3. Validate fonts, title/body/command sizes, notes, formula editability, and
   template-part preservation.
4. Open, save, close, and reopen in Microsoft PowerPoint without a repair
   prompt.
5. Render every slide at original size, inspect overflow, overlap, cropping,
   whitespace, and footer clearance, repair once, and re-render.
