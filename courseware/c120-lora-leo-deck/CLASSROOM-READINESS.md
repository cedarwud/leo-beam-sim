# C-120 LoRaEnergySim × Leo classroom readiness

Date: 2026-08-11

Status: **NOT CLASSROOM-READY — OPERATION PATH MISSING**

## Controller conclusion

The current 108-slide PPTX is a presentation-production WIP, not a deck that a
lecturer can safely teach from.  It must not be described as classroom-ready.
Its first pass overused one native text layout, exposed production metadata and
raw LaTeX source, repeated a rigid action checklist, and did not give the
lecturer a verified click/run/edit/import sequence.

The more important blocker is operational, not visual: the current checkout
does not yet contain the course-packaged LoRaEnergySim runner, the bounded
`student_policy.py`, the frozen LoRa scenario/result/freeze contracts, or the
Leo LoRa-result importer and endpoint replay.  A deck cannot truthfully teach
those actions before the implementation and evidence exist.

## Verified current capability

- `npm run test:c120` passes in the current checkout.
- `/course/c120` exists as the current fixture-first C-120 browser route.
- The route has coherent simulated fixtures, provider-bound replay, learner
  choices, recovery, evidence/trial ledgers, and workbook state.
- This verified route does **not** provide the selected local
  install/edit/run/import LoRaEnergySim workflow.

## Missing selected-course capability

- No course runner package or named release is present in this checkout.
- No `student_policy.py` exists outside the presentation WIP.
- No `contracts/c120-lora-v1/**` package exists.
- No `src/course/c120/loraEnergySim/**` strict importer exists.
- No `src/course/c120/loraIntegration/**` endpoint replay/workbook adapter
  exists.
- No current baseline/candidate/withheld runner artifacts, import receipts,
  browser pixels, or consequential endpoint-energy evidence are frozen.

## Consequence for teaching

The lecturer currently cannot rehearse or demonstrate this promised sequence:

1. obtain and verify the named course package;
2. run an unchanged baseline;
3. edit the bounded policy surface;
4. run candidate and held-out cases;
5. import validated JSON into Leo;
6. read queue, packet, radio-state, endpoint-energy and service consequences;
7. recover and reopen the same scenario.

Slides that pretend this sequence is available would be fabricated teaching
evidence.  Reformatting them does not close the gap.

## Two honest delivery routes

### Route A — teach the current fixture-first C-120 course

Build the classroom deck around the currently executable `/course/c120`
interaction.  Do not claim local LoRaEnergySim installation,
`student_policy.py` editing, or imported endpoint replay.

### Route B — keep the selected LoRaEnergySim edit/run/import course

First freeze and implement the runner, contracts, importer, endpoint replay and
recovery artifacts under the controller gates.  Then run an instructor
rehearsal and capture current evidence before completing the classroom deck.

Choosing between Route A and Route B is an owner scope decision.  Presentation
work alone cannot turn Route B into an executable course.

## Presentation rules retained for the next valid deck

- Use the native `/home/u24/ppt-master/template/educate.pptx` background,
  master, logo and colors; add no slide background fill.
- Use varied editable layouts instead of cloning one text page.
- Title 28 pt; body starts at 24 pt and changes only after render evidence.
- Chinese: 標楷體. English and numerals: Times New Roman.
- Render formulas from LaTeX; do not expose raw LaTeX commands on the slide.
- Italicize mathematical variables; keep prose roman.
- Remove visible production authority/source footer text.
- Remove all visible duration labels and rigid five-question framing.
- Write lecturer notes as a speakable script: opening, explanation, visual cue,
  learner question and transition.  Keep provenance unspoken.
- Do not use the exact Chinese word forbidden by the owner in learner-facing
  slide text or notes.

