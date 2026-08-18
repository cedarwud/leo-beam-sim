# BeamShift donor insertion map

Status: `TOPIC-LEVEL INSERTIONS ONLY / CURRENT CONTENT MUST BE REGENERATED`

The proposed deck has a 97-page course-owned teaching route (`P001–P097`) and
an optional donor-owned tail (`P098–P116`). That 116-page maximum is inside the
accepted 98–116 range; the normal lecture may omit appendix/fast-branch pages.
The donor is never concatenated into the deck. Every insertion is a new native
page or a redrawn visual using the current `educate.pptx` template, the current
course package, and current claim labels.

Current package identity for all rewritten content:

- Repository: `https://github.com/cedarwud/lora-energy-lab`
- Root: `lora-energy-lab/`
- Python module: `lora_energy_lab`
- Permitted learner edit: the marked region of `student_policy.py`
- LEO role: a changing-service-window example, not the specialist learning
  destination

## Interleaving schedule

| Current deck location | Donor topic pages | What to use | How to interleave without repetition | Status/guardrail |
|---|---|---|---|---|
| P001–P004 opening | `e2` 2, 4–6 | The changing opportunity, visible service window, overlap, and the first control-to-service question. | Make one endpoint-first causal hero and one moving-window example. Do not add a satellite-first title or repeat the endpoint causal chain in a second opening page. | **Adopt after rewrite**; LEO remains an example. |
| P028–P038 model bridge | `e2` 14, 16/17, 19–21 | Rate/throughput, power, energy, service reactions, same-window comparison, and ledger boundary. | Put the donor-inspired accounting strip beside the existing endpoint state/packet pages; merge 16/17 into one unit explanation. Do not add a second W/J lesson after the current unit page. | **Adopt after rewrite**; endpoint J and system consumed J remain separate. |
| P037 fair baseline | `e2` 20, 36–37 | Fixed job/window/boundary and four evidence dimensions. | Use one A/B gate before Lab A; point every later lab back to it instead of repeating a new fair-comparison introduction. | **Adopt after rewrite**; current scenario and policy hash are required. |
| P051–P062 Lab B | `e2` 11–12 | Margin/hold timing, too-slow switching, and ping-pong counterexample. | Add one short counterexample visual before the existing `ENTER_QUALITY`/`EXIT_QUALITY`/`STABLE_STEPS` pages; let the current runner traces supply all observations. | **Adopt as optional branch**; no old buttons, session state, or donor event counts. |
| P077–P088 import/recovery | `e2` 70–75 | Evidence qualification, complete fields, same-window comparison, and missing-value discipline. | Use a single validation ladder beside current schema/identity/unit/policy/provenance gates; do not retain donor blank/filled observation tables. | **Adopt after rewrite**; rejected imports leave session/workbook unchanged. |
| P089–P093 evidence clinic | `e2` 96–97, 113 | Evidence record, claim boundary, and measured/derived/assumed/simulated classification. | Use one source-to-claim record and one four-class legend. Do not repeat the endpoint/system boundary page; reference it and classify the scope of each value. | **Adopt after rewrite**; course ceiling remains simulated teaching data. |
| P094–P096 transfer/hypothesis | `e2` 2, 4, 19, 36–39 | Transfer the causal mechanism from a changing window to another IoT domain. | Add only a filled transfer example and a falsifier; do not replay satellite formulas or import the donor's scenario values. | **Adopt as transfer prompt**; domain boundary must be redefined. |
| P098–P116 optional tail | `e2` 7–10, 13, 15, 22–35, 98–114 | Minimal TLE/SGP4/coordinate/quality/power/provenance vocabulary plus evidence deepening. | One concept per page; route pages to optional source or fast branches. Keep the normal path at P001–P097 unless a learner needs the concept. | **Appendix/fast only**; no donor image is current evidence. |

## Donor-owned tail routing (`P098–P116`)

The detailed page-level outline is in
[`full-deck-98-116-outline.md`](full-deck-98-116-outline.md). The sequence is
deliberately sparse:

| New page(s) | Donor source | New teaching job |
|---|---|---|
| P098 | 7 or 98 (choose one) | Read a pinned TLE/source record without treating it as a live position. |
| P099 | 8 or 107 | Explain the minimum `TLE/GP + target time → SGP4 → state` transformation. |
| P100 | 9–10 or 108–109 | Distinguish a model reference frame from a ground-observer direction. |
| P101 | 5, 11, 30–31, 110–111 | Separate elevation, angle, distance, and quality gates. |
| P102 | 13, 15, 22–24 | Read quality/dB as context without importing a legacy link-budget derivation. |
| P103 | 14, 32, 37 | Separate rate, delivered service, and a service-qualified comparison. |
| P104 | 12 | Use one slow-switch/ping-pong counterexample with the frozen current policy. |
| P105 | 16/17, 21, 25–29, 112 | Read an explicit power-to-energy ledger and scope. |
| P106 | 20, 36–37, 70–75 | Qualify a fair A/B comparison without donor tables. |
| P107 | 38–39 | Trace one control through an intermediate state to an observable field. |
| P108 | 70–75 | Reject a low-energy-only claim when service or quality changes. |
| P109 | 96–97 | Build a self-explaining evidence record. |
| P110 | 113 | Classify each value as measured, derived, assumed, or simulated. |
| P111 | 19–21, 28–29, 32–33 | Keep endpoint and system accounting boundaries explicit. |
| P112 | 96–97 plus current package contract | Follow `student_policy.py` → policy identity → result/replay → Leo import. |
| P113 | 70–75 plus current SDD | Read the scenario/result/receipt/replay/workbook contract as one chain. |
| P114 | 113–114 plus current ADR-004 | Separate source, model, course assumption, license, and result. |
| P115 | 2, 4, 19 | Reframe one changing-window mechanism for another IoT application. |
| P116 | 96–97, 113–114 | Close with the Adopt/Appendix/Retire map and claim-safe handoff. |

## Explicit non-insertions

Do not interleave these as current course pages:

- `e2` 1, 3, 11, 18: satellite-first framing or specialist context;
- `e2` 40–69: old T1–T3 buttons, tables, producer states, and session
  semantics;
- `e2` 76–95: old T4–T6 workflow and legacy Run EE accounting;
- `e2` 17 as a second copy of 16;
- `e2` 98 when the selected TLE appendix already uses 7 (or vice versa);
- any donor screenshot, donor KPI, donor formula value, donor button, or donor
  result as current C-120 evidence.

The delivery variant is visual/provenance comparison only and has no speaker
notes. It may help compare spacing, formula treatment, or alternate media, but
it does not supply course content, evidence, or narration.

## Redraw and acceptance rules

1. Preserve the native `educate.pptx` master, background, logo, footer rule,
   and page-number placeholders. Do not copy a donor master or concatenate
   decks.
2. Rewrite every adopted topic around the current `lora-energy-lab` runner,
   `student_policy.py`, scenario identity, endpoint replay, and workbook. Keep
   release URLs, API versions, line numbers, run IDs, screenshots, and KPIs as
   explicit placeholders until current evidence is frozen.
3. Keep endpoint energy, service, delivered bits, system consumed energy, and
   canonical/system `bit/J` as distinct fields. Similar names or units do not
   authorize aliasing.
4. Every operation or policy-edit page must say what the learner does, why it
   matters, which mechanism changes, what evidence should appear, and how to
   recover. The pages may vary layout; a repeated donor table is not a lesson.
5. A donor visual can be a redraw reference only after its source and licence
   are understood. No embedded donor PNG is accepted as current evidence merely
   because it renders attractively.
6. The controller-owned final assembler decides whether each optional page is
   shown in the normal 120-minute route. Donor analysis does not decide the
   final classroom order or human visual acceptance.
