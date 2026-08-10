# C-120 learner route design system

## Redesign audit

- Mode: redesign-preserve. Keep `/course/c120`, all hash targets, form names,
  evidence identities, provider behavior, and the eight-segment information architecture.
- Existing brand tokens: blue-black `#020912`, lifted navy panels, aqua `#76ead7`,
  cool off-white type, restrained 8 px corners, and the real WebGL scene as the visual anchor.
- Preserve: the dark simulator atmosphere, semantic teal/amber/red status language,
  scene-driven cause and effect, keyboard focus, bilingual control, and replay evidence.
- Retire: the warm light page, beige classroom cards, an oversized pill language switch,
  card-inside-card repetition, tiny cockpit typography, and copy that tells learners what
  background they do or do not have.
- Existing simulator dial reading: variance 3, motion 2, density 8. C-120 target:
  `DESIGN_VARIANCE 4 / MOTION_INTENSITY 2 / VISUAL_DENSITY 5`.
- SEO and route boundary: no route, hash, title, or deep-link changes in this redesign.

## Experience

A first-time learner opens C-120 on a 13–15 inch laptop in a bright classroom,
while also listening to an instructor. The interface should feel like a focused
decision instrument inside the existing simulator: atmospheric and dark, but not
a dense spacecraft control room.

## Theme and colour strategy

Use the simulator's dark navy visual identity. Deep blue-black carries the page,
slightly lifted navy surfaces establish hierarchy, teal identifies the primary
learner action, and amber is reserved for caution and data-scope disclosure. Avoid
neon spectacle, glass-heavy decoration, and low-contrast grey-on-grey text.

```css
--c120-bg: #020912;
--c120-surface: #081923;
--c120-surface-soft: #0c202b;
--c120-surface-raised: #102a36;
--c120-text: #edfafa;
--c120-muted: #b6ced3;
--c120-line: rgba(157, 202, 218, 0.24);
--c120-accent: #76ead7;
--c120-accent-strong: #a8fff1;
--c120-warning-bg: rgba(255, 190, 69, 0.10);
--c120-warning-text: #ffda91;
--c120-danger: #ff8c8c;
--c120-focus: #8fc0ff;
```

Status always includes text or a symbol in addition to colour.

## Typography

- UI family: `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`.
- Body: 18 px desktop, 17 px narrow, line-height 1.6, maximum reading measure 68ch.
- Helper and metadata text: never below 14 px; form controls never below 16 px.
- Page title: 32–40 px; segment title: 28–34 px; subsection: 21–24 px.
- Use 400, 600, and 750 weights. Do not use a display serif in product controls.
- Use tabular numerals for clocks, power, energy, rates, and evidence tables.

## Information architecture

1. Persistent compact header: course name, progress, and language switch.
2. Current segment: one plain-language learning question and a short “what to do” line.
3. Learner action: a linear form with one primary action.
4. Result: service consequence first, energy evidence second.
5. Visual replay and detailed ledger: available beside the task on wide screens and
   below or inside disclosure controls on narrow screens.
6. Instructor/session tools, scenario identity, and provenance: collapsed under
   clearly named secondary disclosures.

Do not show the full eight-step navigation, provider identity table, timer controls,
workbook controls, worked trace, and replay ledger at equal visual weight.

## Language

Traditional Chinese (`zh-Hant`) is the default. English (`en`) is selectable in the
header and the preference persists locally. Every learner-facing heading, instruction,
button, field label, error, empty state, and disclosure label is translated. Scientific
units, stable IDs, exported evidence, and provider payloads remain unchanged.

## Components

- Primary button: one filled teal action per decision group, at least 44 px high, with dark readable text.
- Secondary action: quiet bordered button; classroom maintenance actions live in a disclosure.
- Form groups: visible legend/label, brief instruction before the control, inline recovery after errors.
- Result summary: plain-language sentence followed by a short separated evidence list.
- Advanced details: native `details/summary`, keyboard accessible, never required for core completion unless the course contract says so.
- Dialog: only for destructive reset, with focus trap and focus restoration.

Avoid nested cards, coloured side stripes, excessive glass effects, decorative
gradients, sci-fi ornament, and all-uppercase paragraphs. Depth should come from
surface tone, spacing, and one restrained atmospheric background treatment.

## Responsive and accessibility behaviour

- Test at 320, 390, 768, 1024, and 1440 CSS px plus 200% browser zoom.
- Preserve a single-column learner path through 980 px; optional evidence may move below it.
- No horizontal page scroll. Wide evidence tables get their own labelled scroll region.
- All controls use native keyboard semantics and visible focus.
- Respect `prefers-reduced-motion`; replay may be paused and stepped manually.
- The exact simulated/not-live/not-measured claim remains visible, but explanatory
  learner wording may accompany the stable contract string.
