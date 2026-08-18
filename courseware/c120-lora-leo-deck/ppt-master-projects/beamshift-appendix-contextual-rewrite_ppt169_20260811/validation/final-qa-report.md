# P098–P116 contextual appendix final QA

Date: 2026-08-11

## Outcome

- Status: PASS after the content-clarity revision, covering package integrity, template/layout contract, notes presence, text policy, semantic correctness, and rendered visual review.
- Slides: 19.
- Speaker notes: 19/19 embedded.
- Template contract: all 19 slides resolve to `slideLayout2.xml` from `/home/u24/ppt-master/template/educate.pptx`.
- Authored slide background nodes: 0; the template master background and footer remain active.
- Titles: 28 pt on all 19 slides.
- Authored fonts: 標楷體 for Chinese and Times New Roman for English. Cambria Math is limited to native Office Math.
- Variable and field tokens: 154 authored runs audited; every listed variable/field run is italic. Non-variable prose remains upright.

## Content-clarity correction

- P112 now identifies `result.json` as the `/course` file-selector input. The paired `endpoint-replay.json` remains in the same run directory as event/pairing evidence and is not presented as a second upload action.
- P113 is explicitly a field-reading map and routes current browser screenshots and control details to Part C P085–P099; it no longer presents an obsolete browser placeholder as a current screen.
- P114 separates terminal `verify` READY receipt from the `/course` browser-local "record READY" state. Neither is described as a run, upload, or result.
- P100, P103, P105, P106, P108, P109, P113, P114, and P115 were revised to remove conversational sequencing and keep source, mechanism, result, and scope statements formal.

## Native equation

- Logical slide 8 contains one editable `a14:m` Office Math object and one OMML equation.
- Exact LaTeX source metadata: `E_{\mathrm{endpoint}} = \sum_{s \in S} P_s t_s`.
- No formula image fallback is embedded.
- `native-equation-report.json`: PASS; notes, master, layout, and target background preserved.

## Structural checks

- Office XML validator: PASS.
- ZIP/CRC test: PASS.
- LibreOffice headless open/export: PASS.
- Slide count: 19.
- Notes count: 19.
- Layout relationships: 19 × `slideLayout2`.
- Forbidden visible/notes scan: no matches for 學生、老師、講師、全班、你、分鐘、SHA, donor/e2/BeamShift provenance, or rejected meta phrases.

## Visual checks

- Every page was rendered at 144 dpi and inspected individually and as a 19-page contact sheet.
- No crop, overflow, overlap, broken English word wrap, custom slide background, footer loss, or bright-orange authored text was found.
- The visible lead on every page now contains two explanatory sentences: the page purpose plus the required reading or interpretation order.
- The expanded explanations were re-rendered and checked for collisions against the title rule and the main visual.
- Final visual render set: `renders/content-clarity-pass2/` (19 original-size PNG pages, PDF, and contact sheet).

## Explicit limitation

LibreOffice does not reliably render PowerPoint native Office Math. Visual QA therefore uses the formula-surrogate preview while native editability is checked structurally in the delivery PPTX. Microsoft PowerPoint open/edit/save/reopen remains the authoritative application-level equation check.
