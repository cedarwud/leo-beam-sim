# Direct-teaching module build interface

This contract lets three disjoint PPTX workers build Part A, Part B, and Part C
without sharing a builder or output file.  The controller alone merges accepted
modules and renumbers the final deck.

## Shared native template

- Source: `/home/u24/ppt-master/template/educate.pptx`
- SHA-256: `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`
- Clone the native cover or content shell.  Preserve the original master,
  layouts, theme, logo, footer line, footer wording, and slide-number carrier.
- Do not add a slide-level background fill.  Authored shapes may use restrained
  light fills only when they do not cover the template footer or the soft native
  background motif.
- Safe authored-content zone: `x = 0.68..12.58 in`, `y = 0.18..6.18 in` on a
  `13.333 x 7.5 in` canvas.  The native footer owns everything below the safe
  bottom boundary.

## Shared typography

- Traditional Chinese: `DFKai-SB` / 標楷體.
- English, numerals, variables, and formula glyphs: `Times New Roman`.
- Slide title: exactly `28 pt`, bold, upright.
- Main teaching sentences: normally `24–28 pt`.
- Commands and code: normally `20–22 pt`.
- Essential provenance/evidence labels: minimum `18 pt`.
- Variables and formula symbols are italic; prose and units are upright.
- Native Office Math / OMML is required for equations.  No equation images and
  no duplicate text fallback may remain in the final PPTX.

## Shared visual language

- Text colors: template navy, near-black, deep teal, deep purple, restrained
  muted gold, and deep red only for failure/recovery.
- Bright orange and bright yellow-orange authored text are prohibited.
- One dominant visual per slide.  Use varied families: hero, annotated code,
  state timeline, decision tree, before/after compare, result ledger, command
  ribbon, recovery map, website screenshot, and transfer map.
- Do not repeat a fixed four-card or five-question rail.
- Lines and arrows must terminate before text/formula bounds and keep at least
  `0.12 in` clearance.  Content blocks normally keep at least `0.24 in` between
  neighboring text or shape bounds.

## Direct-teaching lab pattern

The runner normally completes quickly.  Each lab spends its slide count on the
code and the evidence, not on waiting:

1. concrete problem and success gate;
2. original marked code and original behavior;
3. branch/mechanism walkthrough;
4. exact one-line edit;
5. directional prediction;
6. one compact run/receipt slide (Lab C may use two because it has one allowed
   evidence-driven revision);
7. aligned before/after evidence;
8. causal explanation from policy to state/packet/service/J;
9. frozen withheld case and what did or did not generalize;
10. recovery or debrief.

Exact values:

- Lab A: `REST_DURING_GAP = SLEEP` → `WAIT`.
- Lab B: `STABLE_STEPS = 2` → `1`.
- Lab C first edit: `URGENT_MARGIN_S = 20` → `5`.
- Lab C revision: `URGENT_MARGIN_S = 5` → `30`.

## Module ownership and outputs

Each worker owns only its own new builder, project folder, editable PPTX,
speaker-note export, renders, and QA report:

- Part A: `projects/direct-teaching-part-a_ppt169_20260811/**`
- Part B: `projects/direct-teaching-part-b_ppt169_20260811/**`
- Part C: `projects/direct-teaching-part-c_ppt169_20260811/**`

Workers may read shared contracts and existing builders but must not modify
another worker's files.  A module is eligible for integration only after:

1. PPTX opens and renders without repair;
2. native footer/logo/background remain visible on every slide;
3. notes exist for every slide;
4. no exact Chinese forbidden term, no minute label, no bright-orange text;
5. no authored text below `18 pt`;
6. all equations are editable Office Math;
7. original-size slide renders receive one fix-and-rerender pass;
8. overlap, crop, footer intrusion, line-through-text, and placeholder checks are
   all clear.

## Controller-only integration

The controller merges only accepted module PPTX files, preserves each slide's
notes and relationships, removes repeated bridge/divider pages, renumbers the
deck, exports a fresh editable PPTX, and runs a complete original-size render
audit.  Page count is not an acceptance metric; a page survives only when it
adds motivation, code understanding, prediction, evidence comparison, causal
interpretation, recovery, or transfer.
