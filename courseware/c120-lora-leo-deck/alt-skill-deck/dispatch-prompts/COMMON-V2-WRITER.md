# C-120 V2 deck writer contract

Classification: **non-heavy presentation implementation**. Stay in the current environment.

The workspace is shared by several writers. Work only in the exact owned directory and root-level PPTX named in the task prompt. Do not modify, revert, rename, or clean any other lane. Do not commit or push.

Before writing, read completely:

1. `courseware/c120-lora-leo-deck/ALT-SKILL-AUTHORING-HANDOFF.md`
2. `/home/u24/.codex/skills/pptx-wrap/SKILL.md` and every reference it requires for this external exact-layout route
3. `/home/u24/.codex/skills/pptx/SKILL.md` and its relevant mandatory authoring/QA references
4. The task's visible-content source and current authority documents named in the handoff
5. `courseware/c120-lora-leo-deck/alt-skill-deck/part-a-v2/build_preview.py`
6. `courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pptx`

The eight-page Part A V2 preview is the approved visual and teaching standard. Reuse its visual grammar, not its literal page layouts:

- one primary teaching proposition per page;
- one dominant editable diagram, comparison, timeline, code anatomy, screenshot, or evidence path;
- sparse visible text; complete formal explanation in speaker notes;
- visual cause-and-effect, not disconnected label cards;
- varied composition while preserving a consistent hierarchy and palette;
- titles at 28 pt; primary teaching text near 24 pt; labels generally 18–22 pt; never below 16 pt;
- Chinese uses 標楷體; English and numerals use Times New Roman; variables, field names, code, and formulas are italic; other text is upright;
- native editable shapes and text; formulas use native Office Math, never images.

Template and package contract:

- exact template: `/home/u24/pptx-wrap/assets/templates/educate.pptx`;
- every authored page must use source slide 2 / `slideLayout2.xml`; never use slide 1 / `slideLayout1.xml`;
- preserve the template background, logo, divider, footer, and slide-number system;
- do not add a slide-level background fill;
- use a clean `python-pptx` layout2 creation route or another known-good host-pptx route; do not clone malformed XML from the rejected Part A deck;
- all speaker notes must be directly readable formal narration, not production commentary;
- create a first valid PPTX early at the task's root-level output path, then continue rendering and corrections without delaying the first export.

Content and language contract:

- follow Part A/B/C visible-content, authority, BeamShift insertion/deduplication, venv platform, current `/course` evidence, provenance, and claim ceilings from the handoff;
- the first visible occurrence of an English field must include its Chinese name, source, purpose, unit, and interpretation; introduce fields gradually rather than as a wall;
- do not use unexplained arrow chains; every connector must express a stated mechanism;
- do not use a fixed five-question framework across the deck;
- do not use 學生、老師、講師、你; `student_policy.py` is the only filename exception;
- do not use 分鐘, SHA, checksum, ZIP test, production notes, or conversational slogans;
- if current evidence is missing, state `待補` and never fabricate a screenshot, UI state, measurement, or KPI;
- keep endpoint energy distinct from LEO/system/canonical energy.

Lab teaching sequence contract:

For every lab, spread the sequence across enough pages to make each step immediately understandable:

1. Before edit: frozen scenario/input, baseline behavior, service gate, and a falsifiable prediction.
2. Why edit: the causal hypothesis and why this specific constant or branch is selected.
3. Exact edit: precise filename, marked block, original value/branch, changed value/branch, allowed boundary, and code meaning.
4. Exact run: platform-correct command and generated artifact path.
5. Observe: exact fields/panels, field source, purpose, unit, and interpretation order.
6. Explain after run: action -> state/packet event -> service -> endpoint energy, including how to read a counterexample or failed service gate.

Do not compress these into one text-heavy slide. Use code anatomy, before/after diff, trace, screenshot callouts, and result comparisons.

Current evidence assets are read-only under:

`courseware/c120-lora-leo-deck/alt-skill-deck/current-evidence/course-20260811/`

Only use screenshots that do not display SHA/checksum-like identifiers. Clean currently available element images include the A metrics, replay-frame panel, and ledger under `.playwright-cli/element-2026-08-11T03-06-45-152Z.png`, `element-2026-08-11T03-06-47-569Z.png`, and `element-2026-08-11T03-06-50-920Z.png`. Label same-scenario fallback honestly.

Verification required before final handoff:

- ZIP integrity and relationship targets;
- recursive schema/structure checks for every slide and notes slide, not only top-level XML;
- slide count and notes count;
- all slide relationships point to `slideLayout2.xml`;
- no authored slide background;
- no duplicate creation IDs;
- font floor and forbidden-language scan;
- LibreOffice open/convert without repair indication;
- render every page at original proportion and inspect it; correct obvious overflow, overlap, clipping, low contrast, and footer/logo collisions.

Deliver the root-level PPTX plus owned sources/renders/QA. In the final message, state exact output path, slide count, completed QA, and remaining unknowns. No commit and no push.
