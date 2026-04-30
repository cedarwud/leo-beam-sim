# Frontend UX Redesign SDD

## Status
Proposed

## Context

The current simulator has grown from a research/debug surface into a live demo
surface. The UI now exposes simulation controls, SINR tuning, serving/candidate
status, beam hopping diagnostics, formula inspection, and 3D beam visualization
at the same time.

This creates several concrete problems:

- The visual system is mostly dark gray glass panels with small text, so the
  hierarchy is weak and hard to read.
- The left SINR panel and right signal panel are both correct in many states,
  but the naming is not always precise. During recent handover linger, the
  right top block is `HO SOURCE`, while the left panel still says live/current
  serving.
- The HOBS formula displays `G^R`, but the current implementation assumes UE
  receive gain is approximately `0 dBi`; there is no profile field or control
  for it yet.
- The right panel mixes primary operator information with debug data such as
  slot IDs, active beam IDs, last handover reason, and historical counters.
- Beam colors are not enough to distinguish semantic roles under additive
  blending. Frequency colors, serving blue, candidate amber, prepared beams,
  approach beams, inactive beams, dashed lines, and opacity states compete.
- Users cannot reliably tell whether a parameter changed the formula unless
  formula terms are shown, because a correctly wired parameter may be masked by
  interference or smoothing.

This SDD uses the local `ui-ux-pro-max` reference skill and the installed
`frontend-skill` guidance. The relevant design conclusions are:

- Treat the app as a space-tech/scientific simulation dashboard, not a generic
  glassmorphism control panel.
- Use strong semantic color, readable type, visible focus states, and clear
  data provenance.
- Keep primary operational status separate from diagnostics.
- Do not convey beam role by color alone.

## Goals

1. Make the first glance answer obvious:
   - Which satellite/beam is serving?
   - Is a handover candidate active, prepared, or only approaching?
   - Is beam hopping currently supporting or failing the link?
   - Which SINR formula term changed when the user adjusts a parameter?
2. Replace gray-on-black sameness with a purposeful space-tech visual system.
3. Keep all shown values truthful by labeling them as live, latched, derived, or
   debug.
4. Decide how to handle formula terms that are visible but not adjustable,
   especially `G^R`.
5. Give future agents a phased implementation plan with objective acceptance
   criteria.

## Non-Goals

- Do not change orbit propagation, handover policy, beam hopping scheduling, or
  SINR formulas as part of the visual redesign unless explicitly called out in a
  phase.
- Do not add every possible debug field to the main viewport.
- Do not hide research/debug data permanently; move it behind an intentional
  diagnostics mode.

## Current Data Truth Audit

### Left SINR Tuning Panel

Current state:

- Formula controls are profile-backed and flow through `applySignalTuning()`
  into `MainScene` and `useSimulation`.
- The formula inspector reads `servingBudget` from the same `SimState` emitted
  by `MainScene`.
- `Current formula terms` are real `computeLinkBudget()` terms:
  - numerator received signal power: `signalDbm`
  - same-satellite interference: `intraInterferenceDbm`
  - other-satellite interference: `interInterferenceDbm`
  - thermal noise: `noiseDbm`

Known issue:

- The panel says live/current serving, but `SimState.servingSatId` is sometimes
  a panel-normalized top block, not necessarily the physical current serving
  satellite. In `recent-ho` state, the right top block is intentionally relabeled
  `HO SOURCE`; the left panel must not imply that this is still the active
  serving link.

Required fix:

- Split `SimState` into:
  - `physicalServing`: current handover manager serving state
  - `panelPrimary`: what the right top block is showing
  - `panelComparison`: candidate/pending/recent target
- Rename the left inspector to match the selected source:
  - `Serving formula terms` only when it is physical serving
  - `Displayed signal formula terms` when it follows right-panel primary
  - show a small status badge: `live`, `latched`, or `recent HO`

### Right Signal Panel

Current values and recommended destination:

| Surface | Truth source | Truth status | Main UI? | Notes |
|---|---|---:|---:|---|
| Signal profile | loaded profile metadata | real | secondary | useful but should be compact or in diagnostics |
| Serving / HO source block | `SimState.serving*` after panel normalization | real but sometimes relabeled | yes | must show semantic state clearly |
| Candidate / pending / HO target block | `SimState.comparison*` | real or none | yes | label must distinguish `candidate`, `pending`, `recent target` |
| Elevation | `VisibleSat.topo.elevationDeg`, latched for UI stability | real/latched | yes, secondary | label as current or last-known if latched |
| Slant range | `linkRangeKmBySatId` or topo fallback | real/derived | yes, secondary | TR 38.811 range may be formula-specific |
| SINR Delta | comparison SINR minus primary SINR | derived | yes during comparison | hide or de-emphasize when no comparison |
| Need Offset | profile handover offset | real config | yes during comparison | should be near delta |
| Trigger Time | handover manager trigger progress | real | yes during pending only | hide when no pending target |
| Recent HO | recent handover refs | real event history | diagnostics or small footer | not primary after linger |
| HO Count | event log length | real counter | diagnostics | useful for validation, not first-glance demo |
| Beam Hopping ON/OFF | profile beam hopping state | real config | yes as compact status | detailed IDs should move to diagnostics |
| Slot index / slot seconds | scheduler state | real | diagnostics | too low-level for main panel |
| Serving beam active this slot | scheduler state | real | yes if phrased as alert/status | important because it explains missing beams |
| Active beam ID lists | scheduler state | real | diagnostics | useful for debug, too verbose in main UI |
| Last HO reason | handover manager reason | real debug string | diagnostics | should not be unstructured bottom text |

## SINR Parameter Coverage

The current tuning panel covers every profile-backed field that directly feeds
`computeLinkBudget()`:

- `P_t`: `channel.maxTxPowerDbm`
- `H` / `L`: `channel.frequencyGHz`, `channel.pathLossComponents`
- `G^T`: `antenna.maxGainDbi`, `antenna.beamwidth3dBRad`,
  `antenna.model`, `antenna.maxSteeringAngleDeg`,
  `antenna.scanLossAtMaxSteeringDb`
- `I^a` / `I^b`: `beams.frequencyReuse`
- `σ²`: `channel.bandwidthMHz`, `channel.noisePsdDbmHz`

Not covered yet:

- `G^R`: not implemented as a configurable profile field. The current link
  budget assumes UE receiver gain is approximately `0 dBi`.
- `antenna.efficiency`: exists in profile but is not used by live SINR.
- TR 38.811 environment and NLoS clutter loss: hard-coded in
  `link-budget.ts`.
- `beamPowerControl.*`: DPC policy fields can affect effective per-beam power
  in TR 38.811 mode, but they are not scalar paper-facing formula controls.

Phase 4A decision, documented below:

- `G^R` promotion is approved only as a bounded research override / teaching
  control, not as a paper-backed parameter.
- Use `ueAntenna.maxGainDbi` as the recommended implementation field, with
  default `0`.
- Do not show `G^R` as adjustable until Phase 4B implements the field,
  `computeLinkBudget()` wiring, UI control, contract update, and validation.
  Until then, show it as a fixed formula term: `G^R = 0 dBi`.
- UI copy must explicitly say the HOBS paper parameter table does not provide
  a receiver / UE antenna gain value.

## Proposed Visual Direction

Visual thesis:

- A high-contrast orbital telemetry console: deep space background, luminous
  semantic accents, large numeric readouts, and minimal chrome around the 3D
  scene.

Palette intent:

- Background: near-black navy, not flat gray.
- Serving: electric cyan/blue, matching the right serving block.
- Handover candidate / pending: amber/gold, matching the right candidate block.
- Approach / pre-illumination: violet or magenta, visually distinct from both
  serving and candidate.
- Other frequency beams: use a color-blind-aware categorical set with lower
  saturation and clear labels.
- Inactive / unscheduled beams: slate with dashed pattern and low opacity.

Typography intent:

- Minimum body text: `16px`.
- Primary numeric readouts: `30px` or larger.
- Technical formulas: math-capable serif or math font, but avoid tiny
  superscripts/subscripts.
- Labels should be short and scannable; explanations should be optional or
  collapsed on small screens.

Interaction intent:

- A `Presentation` mode for clean demo visuals.
- A `Diagnostics` mode for active beam IDs, slot indexes, event reasons, and
  formula internals.
- A `Tuning` mode for the left-side parameter controls.

## Proposed Information Architecture

### Primary Viewport

- 3D scene remains central.
- Top-left: compact playback controls.
- Top-right: primary signal status with two dominant blocks:
  - Active serving / HO source
  - Candidate / pending / HO target
- Bottom or small status strip:
  - beam hopping state
  - handover trigger progress only when pending
  - concise alert if serving beam is not active this slot

### Left Tuning Rail

- Default collapsed to a compact `SINR Controls` affordance.
- Expanded rail uses formula tabs:
  - Power / Noise
  - Loss
  - Beam
  - Interference
  - Fixed Terms
- `Fixed Terms` should show, until Phase 4B implements the approved research
  override:
  - `G^R = 0 dBi`
  - HOBS paper parameter table does not provide a receiver / UE antenna gain
    value
  - TR 38.811 environment
  - NLoS clutter loss
  - antenna efficiency not wired

### Diagnostics Drawer

Move the following out of the main right panel:

- Slot index and slot duration.
- Serving/pending active beam ID lists.
- Recent HO count and last reason.
- Full formula terms and override list, unless tuning rail is open.

## Beam Color And Encoding Requirements

Color alone is insufficient. Each beam role must have at least two encodings:

| Role | Color | Secondary encoding |
|---|---|---|
| Serving | serving cyan/blue | solid thick line, filled endpoint, `SERVING` badge |
| Pending handover | candidate amber | dashed-to-solid transition, `PENDING` badge |
| Approach/pre-illumination | violet/magenta | thin dashed line, `APPROACH` badge |
| Recent HO source | muted cyan/slate | fading dashed line, `SOURCE` badge |
| Other active beams | categorical frequency colors | `F1/F2/F3...` label |
| Inactive/unscheduled | slate | low opacity dashed outline |

Acceptance:

- Serving and candidate beams must remain distinguishable in grayscale
  screenshots.
- Other beams must not use colors close to serving cyan or candidate amber.
- Frequency labels must remain readable at desktop and laptop resolutions.

## Phased Plan

### Phase 1: Truth And Semantics

- Split physical serving state from panel display state in `SimState`.
- Rename left `Current formula terms` according to the actual source.
- Add visible `live`, `latched`, `recent HO`, or `derived` badges.
- Add `G^R = 0 dBi fixed` to the UI until receiver gain is implemented.
- Move verbose debug strings behind a diagnostics toggle.

Acceptance:

- During recent handover linger, the left panel no longer calls the old source
  the active serving beam.
- The right panel explains whether each visible block is serving, pending,
  candidate, or recent handover.
- Every displayed metric is classed as live, latched, derived, config, or debug
  in code or UI copy.

#### Phase 1A: Truth-Source Contract And Copy Alignment

This is the first executable slice of Phase 1. It narrows Phase 1 to truthful
state/source labeling and avoids the larger visual-system and mode-architecture
work.

Scope:

- Clarify the UI/state contract for:
  - `physicalServing`: the current handover-manager serving state.
  - `panelPrimary`: the primary object displayed in the right signal panel.
  - `panelComparison`: the candidate, pending target, or recent handover target
    displayed for comparison.
- Correct left/right panel labels so recent handover linger never describes the
  old handover source as the active/live serving link.
- Show `G^R = 0 dBi fixed` until receiver gain is implemented.
- De-emphasize, group, or explicitly mark debug-only data such as slot IDs,
  active beam ID lists, HO count, and raw last reason. Prefer relabeling and
  grouping over deletion in this slice.

Non-goals:

- No full visual redesign.
- No beam color overhaul.
- No Presentation/Tuning/Diagnostics full mode architecture.
- No orbit propagation changes.
- No handover policy changes.
- No beam hopping scheduler changes.
- No SINR formula math changes.
- No receiver gain model wiring.

Implementation guidance:

- Data provenance can be represented as UI/state contract fields and copy. A
  complete enum is not required for this slice.
- Styling changes should stay minimal and only support truth labels, fixed
  `G^R`, and debug marking.

Acceptance:

- During recent-HO linger, the left formula inspector does not call the old HO
  source the active/live serving link.
- The right panel distinguishes serving, pending, candidate, HO source, and HO
  target.
- `G^R` is visible as fixed at `0 dBi` and is not adjustable.
- Debug-only data is visually secondary, grouped, or explicitly marked as debug.

Validation evidence:

- `npm run validate:phase1a:recent-ho-ui` verifies deterministic recent-HO UI
  labeling through a HandoverManager replay and React server-render assertions.
- Recent-HO linger status: passed.
- Browser validation was not used for this slice.

### Phase 2: Visual System

- Replace ad-hoc inline colors with design tokens.
- Define semantic beam colors and role encodings in one constants module.
- Increase minimum type sizes and establish a small type scale.
- Reduce gray glass surfaces; use purposeful dark navy panels and stronger
  role accents.
- Add visible focus styles for all controls.

#### Phase 2A: Visual Token Foundation

This is the first executable slice of Phase 2. It establishes shared visual
tokens and accessibility baselines without redesigning the full interface.

Scope:

- Add or consolidate shared UI constants for existing semantic panel colors,
  neutral surfaces, borders, text colors, focus rings, spacing, and type scale.
- Replace small, duplicated inline color/type/focus values in the existing
  control and panel surfaces with those tokens where the replacement is
  mechanical and low risk.
- Preserve the Phase 1A truth-source labels and `G^R = 0 dBi fixed` copy.
- Add visible focus styles for existing buttons, selects, sliders, and toggles
  when they can be done without changing component behavior.
- Keep the UI layout and information hierarchy equivalent to the current
  Phase 1A implementation.

Non-goals:

- No beam color overhaul.
- No full visual redesign.
- No Presentation/Tuning/Diagnostics full mode architecture.
- No new panels, drawers, or viewport layout changes.
- No orbit propagation changes.
- No handover policy changes.
- No beam hopping scheduler changes.
- No SINR formula math changes.
- No receiver gain model wiring.

Acceptance:

- Shared tokens exist for the repeated panel/status/control styling used by
  the current UI.
- Phase 1A labels and recent-HO validation remain intact.
- Focus states are visibly present on existing interactive controls touched by
  this slice.
- `npm run validate:phase1a:recent-ho-ui`, `npm run lint`, and
  `npm run build` pass.
- Any visual changes are limited to tokenized equivalents or minor focus/readability
  fixes; no beam role/color redesign is included.

Validation evidence:

- `npm run validate:phase1a:recent-ho-ui` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Vite large chunk warning.
- Browser validation was not used for this slice.

#### Phase 2B: Panel Readability And Viewport Fit

This slice applies the Phase 2A token foundation to readability and viewport-fit
issues in the existing panels. It does not change the information architecture.

Scope:

- Apply the existing type scale so body/control explanatory text in touched
  panel surfaces is not below `16px`, except compact badges or metadata labels
  where the UI already uses them as secondary chrome.
- Add low-risk responsive constraints such as `max-height`, overflow handling,
  stable panel widths, and spacing adjustments to prevent obvious panel overlap
  at the validation viewports.
- Preserve Phase 1A truth-source labels, Phase 1A recent-HO validation, and
  Phase 2A token/focus behavior.
- Use browser validation to inspect `1440x900`, `1366x768`, `768x1024`, and
  `390x844`.

Non-goals:

- No beam color overhaul.
- No full visual redesign.
- No Presentation/Tuning/Diagnostics full mode architecture.
- No new panels, drawers, or major viewport layout changes.
- No orbit propagation changes.
- No handover policy changes.
- No beam hopping scheduler changes.
- No SINR formula math changes.
- No receiver gain model wiring.

Acceptance:

- The validation viewports have no incoherent panel overlap or clipped primary
  controls.
- Touched body/control explanatory text follows the Phase 2 minimum-size
  direction, while compact badges/metadata may remain visually secondary.
- Phase 1A recent-HO UI validation still passes.
- `npm run validate:phase1a:recent-ho-ui`, `npm run lint`, and
  `npm run build` pass.
- Browser validation records runtime cleanup according to `AGENTS.md`.

Validation evidence:

- `npm run validate:phase1a:recent-ho-ui` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Vite large chunk warning.
- Browser validation passed at `1440x900`, `1366x768`, `768x1024`, and
  `390x844` with no panel overlap, offscreen panels, or horizontal overflow.
- Runtime cleanup stopped the temporary Vite PID tree and Playwright browser
  session started for the slice; pre-existing MCP processes were retained.

#### Phase 2C: Beam Role Encoding Plan

This is a planning-only slice for the beam-role visual language. It should
produce a concrete encoding contract before any beam color overhaul begins.

Scope:

- Audit current beam role surfaces in `useBeamViz`, `HandoverLinks`,
  `SatelliteMarker`, `SatelliteBeams`, and related constants.
- Define a role-encoding matrix for serving, pending handover, approach /
  pre-illumination, recent HO source, other active beams, and inactive /
  unscheduled beams.
- For each role, specify color intent plus at least one secondary encoding such
  as line weight, dash pattern, endpoint fill, label text, opacity, or fade.
- Define conflict rules for event role color versus frequency reuse color so
  serving/candidate semantics stay clear without losing frequency identity.
- Define validation expectations for grayscale distinguishability and desktop /
  laptop label readability.

Non-goals:

- No runtime implementation of the new beam colors or role encodings.
- No full visual redesign.
- No Presentation/Tuning/Diagnostics full mode architecture.
- No orbit propagation changes.
- No handover policy changes.
- No beam hopping scheduler changes.
- No SINR formula math changes.
- No receiver gain model wiring.

Current beam-role surface audit:

- `src/scene/useBeamViz.ts` currently derives event roles from simulation state
  and approach lookahead. The live role vocabulary is `serving`, `prepared`,
  `approach`, `secondary`, and `post-ho`; `prepared` maps to pending handover,
  while `secondary` is currently used for recent HO source in the event-role
  map.
- `src/viz/HandoverLinks.tsx` has hard-coded role colors and line styles, but
  only renders `serving` and `post-ho` links to the UE anchor. It does not yet
  expose pending, approach, or recent-source link semantics as a complete visual
  language.
- `src/viz/SatelliteMarker.tsx` uses hard-coded role colors, marker scale, and
  labels such as `(<eventRole>)`. The label text is code-facing rather than
  operator-facing for `prepared`, `secondary`, and `post-ho`.
- `src/viz/SatelliteBeams.tsx` is the main beam-cone surface. It uses serving
  and candidate panel accents for serving / primary prepared beams, then falls
  back to frequency-reuse colors for most other beams. It already varies line
  width, dash, opacity, endpoint size, callout size, and active-slot opacity,
  but those encodings are not yet documented as a stable role contract.
- Related constants are split across `src/constants/uiTokens.ts`,
  `src/constants/signalPanelColors.ts`, `src/utils/beamFrequency.ts`, and local
  `FREQUENCY_COLORS` inside `SatelliteBeams.tsx`. A follow-up implementation
  should consolidate role tokens before changing runtime behavior.

Beam role encoding matrix:

| Role | Current source / mapping | Color intent | Secondary encodings | Label / badge expectation |
|---|---|---|---|---|
| Serving | `sim.serving.satId` + `sim.serving.beamId`; current event role `serving`, or `post-ho` only when the new target is still in recent-HO linger | Serving cyan/blue from the semantic serving token; must be the strongest event color in the scene | Solid line, thickest beam spine, highest endpoint fill, high cone/disc opacity, no dash when scheduled active; if serving beam is unscheduled this slot, keep cyan but switch to dashed line and reduced cone opacity | Beam callout starts with `SERVING`, then `F# B#`; satellite/link badge uses `SERVING`; if unscheduled, add compact `UNSCHEDULED` or `SLOT OFF` badge |
| Pending handover | `sim.pendingTargetSatId` + `sim.pendingTargetBeamId`; current event role `prepared` | Candidate amber/gold from the semantic candidate token; second strongest event color | Medium-thick line, dashed pattern while trigger is accumulating, optional dash-to-solid transition only after handover is committed, filled endpoint smaller than serving, high label contrast | Beam callout starts with `PENDING`, then `F# B#`; satellite/link badge uses `PENDING`; trigger-progress text stays in panel, not inside the beam label |
| Approach / pre-illumination | Approach lookahead in `useBeamViz`; current event role `approach` | Violet/magenta event color distinct from serving cyan, candidate amber, and frequency-reuse green/pink/purple; avoid yellow-green because it is weak in grayscale and may imply signal quality | Thin dashed line, low-to-medium cone opacity, hollow or lower-opacity endpoint, optional fade-in by lookahead slot distance; primary preview beam can be slightly heavier than non-primary preview beams | Beam callout starts with `APPROACH`, then `F# B#`; satellite badge uses `APPROACH`; no implication that it is already eligible for handover |
| Recent HO source | `sim.recentHoSourceSatId` + `sim.recentHoSourceBeamId`; currently encoded as event role `secondary` when not serving/pending | Muted cyan/slate: visually related to the former serving link but clearly de-emphasized below active serving | Fading dashed line, declining opacity over linger time, endpoint outline or partially filled endpoint, no strongest glow; if still scheduled active, keep the fade stronger than inactive beams but below pending | Beam callout starts with `SOURCE`, then `F# B#`; satellite/link badge uses `HO SOURCE` or `SOURCE`; must not read as current active serving |
| Other active beams | Scheduled active beams from `sim.beamHopStatesBySatId.activeBeamIds` that are not the primary event beam | Frequency-reuse categorical colors; colors must be lower-saturation than event-role colors and must not be close to serving cyan or candidate amber | Medium or thin solid line when scheduled active, moderate endpoint fill, lower cone opacity than event beams; label remains compact | Beam callout starts with `F# B#`; optional small `ACTIVE` badge only in diagnostics or when needed to explain scheduler state |
| Inactive / unscheduled beams | Beams shown for context but absent from the current active slot, including primary role beams when `isScheduledActive` is false | Slate/neutral or frequency color heavily desaturated; role color may remain only as a thin outline if needed for serving/pending truth | Low opacity, dashed outline/spine, hollow or low-fill endpoint, no glow, optional fade-out after role relevance expires | Beam callout starts with `OFF SLOT` or `UNSCHEDULED` only for primary event beams; non-primary inactive beams may show only `F# B#` or hide labels to reduce clutter |

Event role color vs frequency-reuse color conflict rules:

1. Event role has priority for the primary beam of serving, pending handover,
   approach, and recent HO source. The beam body, endpoint, spine, and badge use
   the event role color because first-glance handover semantics are more
   important than reuse identity.
2. Frequency identity is preserved as text for all beams using `F# B#`. For
   event-role beams, the label includes both the role and frequency, for example
   `SERVING F2 B5` or `PENDING F1 B2`.
3. Other active beams keep frequency-reuse color as their primary color because
   they are not event-critical. Their line weight, opacity, and label hierarchy
   must stay below serving and pending beams.
4. If a frequency-reuse color is visually close to serving cyan or candidate
   amber, the implementation must shift that frequency color or reduce its
   saturation. Frequency colors must not compete with the semantic serving and
   pending palette.
5. Inactive / unscheduled state can override both event and frequency color by
   reducing opacity and using dash/hollow endpoint encodings. For serving or
   pending beams that are unscheduled this slot, keep the event hue visible but
   make the inactive state unmistakable with dash, lower fill, and `SLOT OFF`
   or `UNSCHEDULED` copy.
6. Recent HO source must never reuse the full-strength serving style. It may
   share the cyan family only through a muted/faded variant plus source-specific
   copy.

Validation expectations for the follow-up implementation:

- Grayscale screenshots at desktop/laptop sizes must distinguish serving,
  pending, approach, recent source, other active, and inactive beams using line
  weight, dash, fill, opacity, fade, and label text, not hue alone.
- Desktop `1440x900` and laptop `1366x768` validation must show readable beam
  callouts for the event set without overlapping the primary signal panel,
  left tuning rail when open, or adjacent beam labels.
- Beam callouts should use compact operator-facing text: role first for event
  beams, then `F# B#`, then SINR when available. Labels must avoid raw code
  role names such as `prepared`, `secondary`, or `post-ho`.
- Long labels must stay single-line only when they fit; otherwise the role and
  `F# B#` may split across two short lines. Text must not be allowed to resize
  beam layout or push the viewport.
- Validation should include at least one pending-handover frame, one approach /
  pre-illumination frame, one recent-HO linger frame, and one beam-hopping slot
  where the relevant primary beam is unscheduled or inactive.

Acceptance:

- The SDD contains a concrete role-encoding matrix and conflict rules ready for
  a follow-up implementation phase.
- The plan preserves the Phase 1A truth-source contract and Phase 2A/2B panel
  improvements.
- No runtime code changes are required for this planning slice.

#### Phase 2D: Beam Role Token And Component Encoding

This is the implementation slice for the Phase 2C beam-role plan. It should
centralize beam role visual tokens and apply them to the existing visualization
components without changing simulation truth or event selection.

Scope:

- Add or consolidate beam role tokens for serving, pending handover, approach /
  pre-illumination, recent HO source, other active beams, and inactive /
  unscheduled beams.
- Keep frequency-reuse identity visible through `F# B#` labels, while applying
  event-role colors to primary serving, pending, approach, and recent-source
  beams according to the Phase 2C conflict rules.
- Update `HandoverLinks`, `SatelliteMarker`, and `SatelliteBeams` so operator
  labels use `SERVING`, `PENDING`, `APPROACH`, `SOURCE`, `F# B#`,
  `UNSCHEDULED`, or `SLOT OFF` instead of raw code-facing role names such as
  `prepared`, `secondary`, or `post-ho`.
- Apply secondary encodings from the Phase 2C matrix using line weight, dash,
  endpoint fill, opacity, fade, and label text.
- Preserve `useBeamViz` role derivation and existing event set selection unless
  a tiny mapping helper is needed to translate code roles into operator-facing
  visual roles.

Non-goals:

- No changes to orbit propagation.
- No changes to handover policy.
- No changes to beam hopping scheduler behavior.
- No SINR formula math changes.
- No receiver gain model wiring.
- No Presentation/Tuning/Diagnostics full mode architecture.
- No full visual redesign or panel layout redesign.
- No new satellite density, synthetic beams, or fabricated handover candidates.

Acceptance:

- Role styling and labels are centralized enough that `HandoverLinks`,
  `SatelliteMarker`, and `SatelliteBeams` no longer carry unrelated hard-coded
  role palettes.
- Event-role beams follow the Phase 2C conflict rules while preserving
  frequency identity through `F# B#` labels.
- Raw code role labels such as `prepared`, `secondary`, and `post-ho` are not
  shown to users.
- Grayscale / non-color distinguishability is supported through at least one
  secondary encoding per role.
- `npm run validate:phase1a:recent-ho-ui`, `npm run lint`, and
  `npm run build` pass.
- Browser validation includes desktop `1440x900` and laptop `1366x768`, and
  records runtime cleanup according to `AGENTS.md`.

#### Phase 2D Validation Closure: Forced Role-State Visual Harness

This closure verifies the Phase 2D role encodings that may not appear naturally
in a short browser run. It should use isolated fixtures or component-level
rendering rather than changing production simulation truth.

Scope:

- Add a narrow validation harness that forces or renders representative beam
  role states for pending handover, approach / pre-illumination, recent HO
  source, and inactive / unscheduled primary beams.
- Verify user-facing labels do not include raw code roles such as `prepared`,
  `secondary`, or `post-ho`.
- Verify each rendered event role preserves frequency identity through `F# B#`.
- Verify each role has at least one non-color encoding difference such as line
  weight, dash, endpoint fill, opacity, fade, or label text.
- Prefer server-render, isolated component render, or deterministic fixture
  validation. Browser validation is optional unless the harness exercises real
  canvas/HTML overlay behavior.

Non-goals:

- No changes to production simulation truth.
- No synthetic density, fake runtime satellites, or fabricated handover
  candidates in the shipped app path.
- No changes to orbit propagation, handover policy, beam hopping scheduler,
  SINR formula math, or receiver gain model.
- No Presentation/Tuning/Diagnostics full mode architecture.
- No full visual redesign or panel layout redesign.

Acceptance:

- The harness explicitly covers pending, approach, recent-source, and
  inactive/unscheduled role states.
- The harness fails if user-facing output contains `prepared`, `secondary`, or
  `post-ho`.
- The harness confirms `F# B#` labels remain present for event-role beams.
- The harness confirms non-color encodings are present for each covered role.
- `npm run validate:phase1a:recent-ho-ui`, `npm run lint`, and
  `npm run build` pass.

Validation evidence:

- `npm run validate:phase2d:forced-role-state-visuals` passed.
- `npm run validate:phase1a:recent-ho-ui` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Vite large chunk warning.
- No browser, dev server, Playwright, Chrome, or MCP runtime was started for
  this closure.

Phase 2 completion evidence:

- Phase 2A established shared UI tokens and focus-state foundations.
- Phase 2B validated panel readability and viewport fit at `1440x900`,
  `1366x768`, `768x1024`, and `390x844`.
- Phase 2C documented the beam role encoding matrix and event-role /
  frequency-reuse conflict rules.
- Phase 2D implemented role tokens and component encoding, then closed the
  non-natural role-state validation gap with a forced-state harness.
- Remaining visual-system work should move through later explicit phases rather
  than expanding Phase 2 further by implication.

Acceptance:

- No body/control explanatory text below `16px`.
- Desktop `1440x900`, laptop `1366x768`, tablet `768x1024`, and mobile
  `390x844` have no panel overlap.
- Beam roles are distinguishable without reading long labels.

### Phase 3: Information Architecture

- Introduce `Presentation`, `Tuning`, and `Diagnostics` UI modes.
- Keep primary status visible while hiding low-level debug fields by default.
- Add a compact beam-hopping health indicator instead of raw beam ID lists.
- Keep formula inspector available in tuning mode.

#### Phase 3A: Mode Architecture Plan

This is a planning-only slice for the Presentation / Tuning / Diagnostics
information architecture. It should define the mode contract before any runtime
mode implementation begins.

Scope:

- Define the intended UI mode model for `Presentation`, `Tuning`, and
  `Diagnostics`, including whether the implementation should use one explicit
  mode state, independent toggles, or a small state machine.
- Define the default mode for demo/readability runs and whether profile or
  presentation presets should influence the initial mode.
- Map each current information surface to a mode:
  - primary signal blocks
  - SINR delta and trigger progress
  - beam hopping health
  - formula inspector and runtime overrides
  - slot index and slot duration
  - active beam ID lists
  - recent HO count and raw reason
  - profile/formula metadata
- Define which surfaces remain globally visible across modes and which are
  hidden, collapsed, or moved to diagnostics.
- Define transition and persistence expectations such as whether mode selection
  resets on profile change, persists in local state, or follows runtime presets.
- Define validation expectations for desktop, laptop, tablet, and mobile
  layouts after the future implementation.

Mode model decision:

- Use one explicit UI mode state:
  `UiMode = 'presentation' | 'tuning' | 'diagnostics'`.
- Do not model these as independent toggles. Independent toggles would allow
  conflicting states such as tuning controls and diagnostics details both
  occupying the same viewport, which would undermine the purpose of separating
  primary demo status from debug surfaces.
- Do not introduce a larger state machine for this phase. The three modes are
  mutually exclusive top-level information-architecture states. Any future
  panel collapsed/expanded state should be derived from the selected mode or
  tracked as secondary local UI state inside that mode, not as competing
  top-level mode truth.
- Keep this UI mode distinct from the existing runtime
  `PresentationMode` values `research-default`, `candidate-rich`, and
  `demo-readability`. Runtime presentation presets describe simulation / replay
  policy; `UiMode` describes what information is exposed in the UI.

Mode contracts:

| Mode | Contract | Must remain visible | Must not dominate |
|---|---|---|---|
| Presentation | Clean demo/readability view for first-glance status and handover storytelling | Primary serving / comparison blocks, relevant SINR delta / trigger progress, compact beam-hopping health, concise profile/preset identity | Formula controls, raw IDs, slot internals, raw handover reasons, full override lists |
| Tuning | Formula-aware research control view for changing SINR parameters and verifying formula-term effects | Primary serving / comparison blocks, current formula inspector, active runtime overrides, compact beam-hopping health | Scheduler raw ID lists, raw event reasons, long diagnostics history |
| Diagnostics | Debug and validation view for scheduler, handover, and provenance details | Primary serving / comparison blocks, slot index / duration, active beam ID lists, recent HO count, raw reason, profile/formula metadata | Editable formula controls unless the user explicitly switches to Tuning |

Default mode behavior:

- Demo/readability runs default to `presentation`.
- `research-default` and `candidate-rich` runtime presentation presets also
  default to `presentation` unless a persisted user selection or explicit test /
  URL override exists.
- Paper/profile selection must not directly control initial mode. Profiles
  define physical and formula parameters; they must not silently open tuning or
  diagnostics surfaces.
- Runtime presentation presets may provide the initial fallback only when no
  persisted UI mode exists. After the user selects a mode, preset changes should
  not force-reset that choice. A dedicated future "start demo" action may
  intentionally switch to `presentation`, but that should be an explicit command
  rather than an implicit profile side effect.

Mode surface map:

| Surface | Presentation | Tuning | Diagnostics | Notes |
|---|---|---|---|---|
| Primary signal blocks | Visible | Visible | Visible | Global anchor. Preserve Phase 1 semantics for serving, pending, candidate, HO source, and HO target. |
| SINR delta and trigger progress | Visible when comparison or pending state exists | Visible when comparison or pending state exists | Visible with optional raw timing/detail expansion | Delta remains derived; trigger progress remains config/runtime truth. |
| Beam hopping health | Visible as compact health / alert | Visible as compact health / alert | Visible with scheduler detail | Presentation should say whether beam hopping supports or blocks the link without listing raw beam IDs. |
| Formula inspector and runtime overrides | Hidden or collapsed behind the mode switch | Primary Tuning surface | Read-only summary allowed, but editable controls stay in Tuning | Tuning owns formula tabs, changed overrides, and the current `G^R` explanation: fixed `0 dBi` before Phase 4B, then research override / teaching control after Phase 4B. |
| Slot index and slot duration | Hidden | Hidden or collapsed as non-primary metadata | Visible | Scheduler timing is diagnostics data unless a primary slot-off alert is needed. |
| Active beam ID lists | Hidden except for concise slot-off alert | Hidden except for concise slot-off alert | Visible | Lists belong in diagnostics; Presentation/Tuning may show only a semantic health summary. |
| Recent HO count and raw reason | Hidden; semantic recent-HO state remains in primary blocks | Hidden or collapsed | Visible | Raw reason strings are debug evidence, not demo copy. |
| Profile/formula metadata | Compact chip or collapsed label | Visible as context for controls | Visible with full provenance/details | Keep paper/profile identity available without making it the main demo surface. |

Transition and persistence rules:

- Mode changes are user-initiated through one top-level mode selector or
  equivalent explicit command.
- Profile changes do not reset `UiMode`.
- Runtime presentation preset changes do not reset `UiMode` after a user has
  made an explicit mode choice.
- Persist the last selected valid `UiMode` in local browser state using a
  versioned key so stale values can fall back safely to `presentation`.
- Invalid, missing, or unsupported persisted values fall back to
  `presentation`.
- Validation harnesses may use an explicit URL/query/test override to open a
  specific mode. Such overrides should be treated as test/session input, not as
  paper profile metadata.
- Mode selection must not change orbit propagation, handover policy, beam
  hopping scheduler behavior, SINR formula math, receiver gain assumptions, or
  beam role encoding. It only changes which already-truthful surfaces are shown,
  hidden, collapsed, or moved to diagnostics.

Future implementation validation expectations:

- Desktop `1440x900`: all three modes render without panel overlap; Tuning
  keeps primary handover status visible while formula controls are open;
  Diagnostics can show raw scheduler/event detail without covering the primary
  signal blocks.
- Laptop `1366x768`: Tuning controls scroll within their rail/surface; primary
  status, delta/trigger, and beam-hopping health remain readable; Diagnostics
  avoids horizontal overflow and keeps raw lists contained.
- Tablet `768x1024`: only one secondary surface should dominate at a time;
  mode switching remains reachable; primary signal blocks stack or dock without
  obscuring the 3D scene or each other.
- Mobile `390x844`: default Presentation view shows the primary signal blocks,
  relevant delta/trigger, and compact beam-hopping health without requiring
  horizontal scrolling. Tuning and Diagnostics may use a full-height sheet or
  single-column layout, but primary status must remain reachable and text must
  not overflow controls or badges.

Non-goals:

- No runtime mode implementation.
- No new drawers, panels, or controls in this planning slice.
- No changes to orbit propagation.
- No changes to handover policy.
- No changes to beam hopping scheduler behavior.
- No SINR formula math changes.
- No receiver gain model wiring.
- No beam role color or encoding changes.

Acceptance:

- The SDD contains a concrete mode surface map for Presentation, Tuning, and
  Diagnostics.
- The plan states the default mode behavior and mode persistence/reset rules.
- The plan preserves Phase 1 truth-source semantics and Phase 2 visual-system
  work.
- No runtime code changes are required for this planning slice.

#### Phase 3B: UiMode State And Surface Gating

This is the first runtime implementation slice for Phase 3. It should add the
explicit UI mode state and use it to gate existing surfaces according to the
Phase 3A mode contract, without introducing a new drawer architecture or
changing simulator behavior.

Scope:

- Add `UiMode = 'presentation' | 'tuning' | 'diagnostics'` as explicit UI state
  in the app shell or a small local helper module.
- Add one compact top-level mode selector or equivalent explicit controls.
- Persist the last selected valid mode in versioned local browser state, with
  invalid or missing values falling back to `presentation`.
- Keep `UiMode` separate from runtime `PresentationMode`; profile and runtime
  preset changes must not reset mode after the user has selected one.
- Gate existing surfaces according to the Phase 3A mode surface map:
  - Presentation: show primary signal blocks, relevant delta/trigger, compact
    beam-hopping health, and compact profile identity; hide formula controls
    and raw diagnostics.
  - Tuning: show primary signal blocks and SINR tuning / formula inspector;
    hide raw scheduler ID lists and raw reasons.
  - Diagnostics: show primary signal blocks plus raw scheduler/event/profile
    diagnostics; hide editable formula controls unless the user switches to
    Tuning.
- Preserve Phase 1 truth-source labels, Phase 2 visual tokens, Phase 2 beam
  role encodings, and existing validation commands.

Non-goals:

- No new large drawer/panel architecture.
- No full information-architecture redesign beyond gating existing surfaces.
- No changes to orbit propagation.
- No changes to handover policy.
- No changes to beam hopping scheduler behavior.
- No SINR formula math changes.
- No receiver gain model wiring.
- No beam role color or encoding changes.

Acceptance:

- Mode selector can switch between Presentation, Tuning, and Diagnostics.
- Valid mode persists across reloads; invalid/missing persisted values fall
  back to `presentation`.
- Profile changes do not reset `UiMode`.
- Presentation hides formula controls and raw diagnostics while keeping primary
  status readable.
- Tuning shows formula controls while keeping primary handover status visible.
- Diagnostics shows raw scheduler/event/profile diagnostics and hides editable
  formula controls.
- `npm run validate:phase1a:recent-ho-ui`,
  `npm run validate:phase2d:forced-role-state-visuals`, `npm run lint`, and
  `npm run build` pass.
- Browser validation covers desktop `1440x900`, laptop `1366x768`, tablet
  `768x1024`, and mobile `390x844`, and records runtime cleanup according to
  `AGENTS.md`.

Validation evidence:

- `UiMode = 'presentation' | 'tuning' | 'diagnostics'` was implemented as
  explicit UI state with a compact top-level selector.
- Versioned local browser persistence uses `leo-beam-sim.ui-mode.v1`; missing
  or invalid persisted values fall back to `presentation`.
- `UiMode` is separate from runtime `PresentationMode`; profile and runtime
  preset reset paths do not reset the selected UI mode.
- Presentation, Tuning, and Diagnostics gate only existing UI surfaces. No
  simulation, SINR math, scheduler, handover, orbit, receiver-gain, or beam
  role encoding behavior changed.
- Browser validation passed all three modes, reload persistence, invalid
  fallback, and no overlap / horizontal overflow at `1440x900`, `1366x768`,
  `768x1024`, and `390x844`.
- `npm run validate:phase1a:recent-ho-ui` passed.
- `npm run validate:phase2d:forced-role-state-visuals` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Vite large chunk warning.
- Runtime cleanup stopped the temporary Vite server, esbuild process, and
  Playwright browser session started for this slice; only pre-existing
  Codex/Claude MCP browser processes were retained.

Acceptance:

- In presentation mode, the right panel shows only signal blocks, delta/trigger
  when relevant, and concise beam hopping health.
- Diagnostics mode shows slot index, active beam IDs, HO count, and raw reason.
- Tuning mode shows formulas and runtime overrides without covering the main
  handover status on common desktop sizes.

### Phase 4: Optional Receiver Gain Promotion

#### Phase 4A: Receiver Gain Promotion Decision / Contract Plan

This is a planning gate before any receiver-gain implementation. The simulator
currently treats `G^R` as a fixed `0 dBi` term. Phase 4A approves promotion
only as a research override / teaching control; it does not approve `G^R` as a
paper-backed HOBS parameter.

Scope:

- Decide whether `G^R` should remain fixed for paper fidelity or be promoted to
  a configurable receiver / UE antenna parameter.
- If promoted, define whether the promotion is paper-backed or only a research
  override / teaching control.
- Define the canonical field name and where it belongs in the profile/model
  contract.
- Define required updates to `docs/sinr-runtime-parameter-contract.md`,
  `computeLinkBudget()`, tuning UI copy, and validation checks before runtime
  implementation begins.
- Preserve current default behavior until implementation ships.

Phase 4A decision:

- Promote `G^R` only as an explicitly bounded research override / teaching
  control in the current UX redesign track.
- Do not describe `G^R` as a paper-backed parameter or place it alongside
  sourced paper-parameter controls without a `Research Override` / teaching
  label.
- Default remains `0 dBi`. Until Phase 4B is implemented, the UI may continue
  to display `G^R = 0 dBi fixed`.
- Recommended implementation field: `ueAntenna.maxGainDbi`.
- Current truth check:
  - the tuning UI already labels `G^R` as fixed at `0 dBi`;
  - `computeLinkBudget()` still has no receiver-gain input and assumes UE
    antenna gain is approximately `0 dBi`;
  - the profile/model surface has no receiver or UE antenna gain field.
- Rationale:
  - PAP-2024-HOBS includes `G^R` in the SINR expression, but the simulation
    parameter table does not provide a receiver / UE antenna gain value.
  - The paper-backed profile already exposes the sourced transmit antenna
    parameter `G_0 = 40 dBi`; presenting receiver gain as a sourced
    paper-facing control would make an unsourced assumption look equally
    authoritative.
  - A bounded research override is still useful for teaching the numerator
    effect of `G^R` and for local sensitivity studies.
  - Default `0 dBi` preserves current numerical behavior unless a user
    intentionally applies the override.
- Required UI copy:
  - the HOBS paper parameter table does not provide a receiver / UE antenna
    gain value;
  - nonzero `G^R` values are simulator research overrides / teaching controls,
    not paper-backed HOBS parameter values;
  - before Phase 4B implementation, `G^R` remains displayed as fixed
    `0 dBi`.

Non-goals:

- No runtime code changes in this decision slice.
- No receiver-gain model wiring.
- No SINR formula math runtime implementation changes.
- No profile schema implementation.
- No orbit propagation, handover policy, or beam hopping scheduler changes.

Acceptance:

- The SDD records `G^R` as approved for promotion only as a research override /
  teaching control.
- The SDD names `ueAntenna.maxGainDbi`, default `0`, affected docs/runtime/UI
  surfaces, and validation requirements for Phase 4B.
- The SDD explicitly prevents treating `G^R` as a paper-backed parameter and
  requires HOBS parameter-table absence copy.

#### Phase 4B: G^R Research Override Implementation

This is the follow-up implementation stub for the Phase 4A decision. It should
implement only the approved research override / teaching control and must keep
paper-backed parameter copy separate from override copy.

Scope:

- Add `ueAntenna.maxGainDbi` as the receiver / UE antenna gain field for
  `G^R`, with default `0`.
- Wire `ueAntenna.maxGainDbi` into `computeLinkBudget()` as the current
  `G^R` value.
- Expose a bounded Tuning mode control for `G^R`.
  - Recommended initial UI guardrail: `-10` to `20 dBi`.
  - The range is a simulator guardrail, not a HOBS paper range.
  - Label the control as `Research Override` / teaching control.
- Update the formula inspector so it displays the current `G^R` value and
  source state instead of always showing `fixed`.
- Update `docs/sinr-runtime-parameter-contract.md` so `G^R` is classified as
  an approved research override / teaching control, default `0`, not a
  paper-backed parameter.
- Ensure UI copy states that the HOBS paper parameter table does not provide a
  receiver / UE antenna gain value.

Non-goals:

- No orbit propagation changes.
- No handover policy changes.
- No beam hopping scheduler changes.
- No unrelated SINR formula math runtime implementation changes.
- No DPC / beam power control promotion.
- No unrelated profile schema implementation beyond the `ueAntenna.maxGainDbi`
  field needed for `G^R`.

Acceptance:

- `G^R` defaults to `0 dBi`, preserving current behavior with no override.
- The Tuning mode control is bounded and labeled as a research override /
  teaching control, not as a paper-backed parameter.
- The formula inspector shows the current `G^R` value and no longer displays
  `fixed` after the Phase 4B field is wired.
- `docs/sinr-runtime-parameter-contract.md` is updated in the same
  implementation change set.
- Validation confirms that changing only `G^R` by `X dB` changes `signalDbm`
  and the numerator by the same `X dB` amount.
- Validation confirms denominator terms are not directly changed by a
  `G^R`-only override, apart from the resulting SINR ratio change.

Validation evidence:

- Phase 4B is complete for the approved `G^R` research override / teaching
  control.
- `ueAntenna.maxGainDbi` was added as the receiver / UE antenna gain field for
  `G^R`, with default `0 dBi`.
- `G^R` is wired into `computeLinkBudget()` on the numerator / desired signal
  path.
- Denominator terms are unchanged for a `G^R`-only override, apart from the
  resulting SINR ratio change.
- Tuning mode exposes a bounded `G^R` control from `-10` to `20 dBi`.
- Tuning copy labels nonzero `G^R` as a `Research Override` / teaching control,
  not as a paper-backed HOBS parameter.
- The formula inspector shows the current `G^R` value.
- `docs/sinr-runtime-parameter-contract.md` was updated for the `G^R` research
  override contract.
- `npm run validate:phase1a:recent-ho-ui` passed.
- `npm run validate:phase2d:forced-role-state-visuals` passed.
- `npm run validate:phase4b:receiver-gain` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Vite large chunk warning.
- Browser validation passed for Tuning / Presentation copy and showed no
  obvious overflow.

### Phase 5: DPC Research Controls Placement Plan

This is a planning-only UX slice for deciding whether the landed dynamic power
control / beam power control surface should become user-facing UI.

Scope:

- Audit the current `beamPowerControl` truth in docs and code.
- Decide whether DPC controls belong in the existing Tuning mode, Diagnostics,
  or a separate research tab / section gated by TR 38.811 mode.
- Define copy that distinguishes paper-backed formula controls from research
  overrides or policy controls.
- Identify the smallest follow-up implementation surface, if DPC controls are
  approved for promotion.

Current truth check:

- Profile fields: `beamPowerControl` is optional under `channel` and currently
  exists only on `hobs-2024-tr38811-research`. The config fields are
  `mode: 'dpc'`, `updatePeriodSec`, `stepDb`, `minTxPowerDbm`, and
  `sinrThresholdDb`. The upper clamp is the profile's
  `channel.maxTxPowerDbm`; legacy profiles do not define `beamPowerControl`.
- Runtime effect surface: `useSimulation` enables DPC only when
  `formulaFamily === 'hobs-tr38811'` and `channel.beamPowerControl` exists.
  DPC state is bucketed in simulation time, reset on profile/replay/signal
  reset paths, and converted into a per-beam transmit-power override map before
  `computeLinkBudget()` runs. The override changes effective beam `P_t`,
  desired received power, and co-frequency interference. It is a policy surface,
  not a scalar formula control.
- Current UI exposure: there are no explicit user-facing DPC controls. The
  profile selector exposes the `HOBS + TR 38.811 Research` profile, Tuning mode
  labels `P_t` as base transmit power before dynamic power-control overrides,
  and the formula budget carries effective `txPowerDbm` internally. The UI does
  not yet show a DPC enabled/disabled badge, current per-beam DPC power, DPC
  bucket state, or DPC config values as diagnostics.
- TR 38.811 relation: DPC is intentionally research-profile-scoped. Only the
  `HOBS + TR 38.811` formula family may opt into it; legacy HOBS profiles
  remain uniform-power profiles unless a separate future plan changes that.

Phase 5 placement decision:

- Defer editable DPC controls. The approved current placement is option A:
  no user-facing editable controls; retain DPC as diagnostics/read-only only.
- If a future DPC teaching or power-policy contract explicitly approves
  editable controls, use option D: a `TR 38.811`-gated research power-policy
  tab / section. Do not add editable DPC controls to the existing paper-formula
  Tuning tabs, and do not make Diagnostics the owner of editable policy.

Rationale:

- The existing Tuning mode is formula-guided. It owns paper-backed formula
  controls plus the already-approved `G^R` research override / teaching control.
  DPC changes effective per-beam `P_{n,m}(t)` through a bucketed policy and can
  mask the apparent effect of the base `P_t` control, so placing it beside
  scalar paper terms would make the model harder to read.
- The DPC implementation is intentionally simplified relative to full HOBS-P:
  it uses a single-UE local energy-efficiency proxy, omits per-satellite
  `Pmax` normalization, and clamps beam power to a bounded local range. These
  are acceptable research-path deviations, but they are not ready to be
  presented as paper-backed formula controls.
- Diagnostics may show read-only DPC facts because those explain why effective
  transmit power differs from base `P_t`. Editable policy belongs behind an
  explicit `HOBS + TR 38.811` research gate if it is ever promoted.

Control taxonomy:

| Class | Examples | UI ownership |
|---|---|---|
| Paper-backed formula controls | `f_c`, `B`, base `P_t`, `N_0`, `G_{t,max}`, `θ_{3dB}`, `G(θ)`, `θ_{max}`, `L_{scan,max}`, `K`, path-loss toggles | Existing Tuning formula tabs |
| Approved research overrides | `G^R` / `ueAntenna.maxGainDbi` | Existing Tuning power tab, labeled `Research Override` / teaching control |
| Policy / scheduler-adjacent controls | `beamPowerControl.*`, `beamHopping.*`, `handover.*` | Read-only Diagnostics by default; editable controls require a separate policy/research section and reset contract |

Retained read-only / diagnostic copy:

- Presentation mode: no DPC details beyond the existing profile / formula-family
  identity.
- Tuning mode: keep `P_t` copy clear that it is base transmit power before DPC
  overrides. If effective per-beam power is shown in the formula inspector, it
  must be read-only and labeled `effective P_t after DPC`.
- Diagnostics mode: future read-only copy may show:
  - `DPC: research power policy`
  - `enabled only for HOBS + TR 38.811 research profile`
  - update period, step size, min/max effective beam power, and SINR threshold
  - current physical-serving effective `P_t` if available from `LinkBudgetTerms`
  - a note that base `P_t` remains the Tuning control and DPC may override
    `P_{n,m}(t)` per beam

Non-goals:

- No runtime code changes in this planning slice.
- No beam power control, scheduler, SINR formula, handover, or orbit behavior
  changes.
- No new full information-architecture redesign.

Follow-up implementation scope if approved:

- Minimal read-only follow-up: add a Diagnostics-only DPC status block gated by
  `profile.formulaFamily === 'hobs-tr38811'` and
  `profile.channel.beamPowerControl`, using existing profile config plus the
  existing effective serving `txPowerDbm` where available. This should not add
  DPC edit controls or change simulation behavior.
- Editable follow-up, if separately approved later: add a TR 38.811-gated
  research power-policy tab / section, maintain separate runtime policy
  overrides, reset DPC and handover state when policy fields change, and keep
  copy explicit that the controls are simplified research policy controls, not
  paper-backed formula parameters.

#### Phase 5A: DPC Teaching / Power-Policy Contract

This is the reconciliation delta for the Phase 5 planning result. It does not
approve editable DPC controls. It only records the contract needed before any
future DPC teaching surface can be considered.

Phase 5A decision:

- Editable DPC controls remain deferred.
- DPC is a `TR 38.811`-gated research power-policy surface. It may be surfaced
  only when the active profile uses `formulaFamily === 'hobs-tr38811'` and
  defines `channel.beamPowerControl`.
- DPC is not a scalar paper-backed formula control. It changes effective
  per-beam transmit power through a bucketed runtime policy, so it must not be
  placed beside formula controls such as base `P_t`, bandwidth, frequency,
  antenna gain, or path-loss terms as if it were a sourced paper parameter.
- The next allowed implementation is only a read-only Diagnostics status block.
  That block may explain whether DPC is enabled, which research profile gates
  it, the configured update period / step / min power / SINR threshold, and the
  current effective serving `P_t` when already available. It must not add DPC
  edit controls, runtime policy overrides, or simulation behavior changes.

Control taxonomy reaffirmed by Phase 5A:

| Class | Examples | UI contract |
|---|---|---|
| Paper-backed formula controls | `f_c`, `B`, base `P_t`, `N_0`, transmit antenna terms, path-loss toggles, reuse factor `K` | Existing Tuning formula tabs; each control should map to a sourced scalar formula/profile term. |
| Approved research overrides | `G^R` / `ueAntenna.maxGainDbi` | Existing Tuning power tab only because Phase 4A approved it as a bounded research override / teaching control with explicit non-paper copy. |
| Policy / scheduler-adjacent controls | `beamPowerControl.*`, `beamHopping.*`, `handover.*` | Read-only Diagnostics by default. Editable controls require a separate research/policy section, explicit gate, and reset/state contract. |

Reset / state contract for any future editable DPC policy:

- Changing DPC policy fields must reset DPC runtime bucket state so stale
  per-beam power buckets cannot survive a policy edit.
- Changing DPC policy fields must reset handover runtime state, including
  pending handover target/progress, smoothing state, and recent-HO evidence,
  because effective transmit power can change candidate ranking and trigger
  progress.
- Changing DPC policy fields must clear stale frame data, formula terms, and
  effective `txPowerDbm` display values before the next recomputed frame is
  shown.
- DPC-only edits do not require rebuilding orbit trajectory caches, because
  the policy affects link budget / scheduling-adjacent state rather than orbit
  propagation.
- DPC-only edits should not silently reset the replay clock. Replay time should
  restart only when the user explicitly requests deterministic replay restart.

Acceptance:

- The SDD records that editable DPC controls are deferred.
- The SDD records that read-only DPC facts belong in Diagnostics if surfaced.
- The SDD records that any future editable DPC promotion must be a
  `TR 38.811`-gated research power-policy section, not part of the existing
  paper-formula Tuning tabs.
- Any future implementation prompt is limited to the approved placement, gate,
  reset expectations, and copy contract.
- Phase 5A preserves Phase 5's placement decision and allows only the read-only
  Diagnostics DPC status block as the next implementation prompt.

#### Phase 5B: Diagnostics DPC Status Completion Closure

This is the reconciliation closure for the approved Phase 5 / Phase 5A
read-only Diagnostics follow-up. It records completed validation evidence only.
This closure does not approve editable DPC controls and does not change runtime
code.

Implemented scope:

- Phase 5B completed the Diagnostics-only, read-only DPC status block.
- The block is gated by `formulaFamily === 'hobs-tr38811'` and
  `channel.beamPowerControl`.
- Diagnostics shows the research power-policy copy, update period, step size,
  minimum effective `P_t`, maximum/base `P_t` clamp, SINR threshold, and the
  current effective serving `P_t` when available.
- Presentation mode hides DPC details.
- Tuning mode has no editable DPC controls.
- Legacy and non-DPC profiles do not render the full DPC block.

Validation evidence:

- `npm run validate:phase1a:recent-ho-ui` passed.
- `npm run validate:phase2d:forced-role-state-visuals` passed.
- `npm run validate:phase4b:receiver-gain` passed.
- `npm run validate:phase5b:diagnostics-dpc-status` passed.
- `npm run lint` passed.
- `npm run build` passed with the existing Vite large chunk warning.
- Browser validation passed at desktop `1440x900` and mobile `390x844`.

Closure:

- The read-only Diagnostics DPC status block is implemented and validated for
  the current UX redesign track.
- No approved DPC runtime implementation phase remains after Phase 5B.
- Editable DPC remains future-only and requires a separate `TR 38.811`-gated
  research power-policy approval, reset/state contract, and validation plan.

### Phase 6: Tuning-Mode SINR Display Ownership

#### Phase 6A: Serving SINR Display De-duplication Plan

This is a planning-only UX slice for resolving duplicated serving-SINR emphasis
in Tuning mode. It does not change simulation truth, SINR math, or runtime
policy. The current data may be correct when the right `InfoPanel` and left
`SignalTuningPanel` both show serving SINR, but the duplicated visual emphasis
can make the left panel read like a second status panel instead of a formula /
tuning verification surface.

Display ownership decision:

- Right `InfoPanel` owns the primary serving, candidate, and pending SINR
  status. It remains the first-glance operational status surface for active
  serving, comparison, pending target, SINR delta, and trigger progress.
- Left `SignalTuningPanel` owns formula source, formula result, active formula
  overrides, and term breakdown. It is the verification surface for why the
  selected formula result changed after tuning.
- Tuning mode may keep both panels visible, but only the right panel should
  visually present serving SINR as the primary operational status value.

Left-panel de-emphasis rules:

- Do not present serving SINR in `SignalTuningPanel` as the main status number
  or as a competing first-glance readout.
- If SINR is shown in `SignalTuningPanel`, label it as a formula result for the
  selected formula source, for example `formula result` or `selected source
  result`, not as the active serving-status owner.
- Shift the main visual weight in `SignalTuningPanel` to formula terms and
  provenance: `signalDbm`, intra/interference, `noiseDbm`, `G^T`, `G^R`, path
  loss, and any active runtime overrides that explain the calculation.
- Formula terms should be easier to scan than the final SINR value in the left
  panel. The left panel may still show the final result as context, but the
  numerator / denominator / gain / loss terms are the primary tuning evidence.

Truth-source guardrails:

- Preserve the Phase 1 truth-source split: `physicalServing`, `panelPrimary`,
  and `panelComparison` must not be conflated in copy, props, tests, or UI
  labels.
- During recent-HO linger, the left panel must not describe the HO source as
  active serving. If the selected formula source follows a latched or recent-HO
  object, the label must say so.
- If the left formula inspector follows `panelPrimary` rather than
  `physicalServing`, its copy must name the selected source and provenance
  explicitly.
- The right `InfoPanel` remains the owner of primary serving / candidate /
  pending status even when the left panel is open in Tuning mode.

Non-goals:

- No SINR math changes.
- No handover policy changes.
- No beam hopping scheduler changes.
- No orbit propagation changes.
- No receiver gain changes.
- No DPC changes.
- No large visual redesign.
- No new mode architecture beyond the existing Presentation / Tuning /
  Diagnostics contract.

Proposed Phase 6B implementation scope:

- Rename or restyle the left-panel SINR readout so it is clearly a formula
  result tied to the selected formula source.
- Reduce the visual hierarchy of the left final-SINR value relative to formula
  terms.
- Promote the formula-term breakdown in `SignalTuningPanel`, especially
  `signalDbm`, interference, `noiseDbm`, `G^T`, `G^R`, and path loss.
- Keep the right `InfoPanel` primary SINR blocks unchanged as the operational
  status owner unless tiny copy alignment is required for consistency.
- Add or update focused validation so Tuning mode proves the right panel owns
  primary status while the left panel owns formula verification.

Acceptance:

- In Tuning mode, the right `InfoPanel` is the only surface that presents
  serving / candidate / pending SINR as primary operational status.
- The left `SignalTuningPanel` labels any displayed SINR as a formula result or
  selected-source result, not as a duplicate active-serving status block.
- The left panel visually emphasizes formula terms over final serving SINR.
- Recent-HO linger still passes the Phase 1 truth-source expectation: the left
  panel never calls the HO source active serving unless it is actually
  `physicalServing`.
- `physicalServing`, `panelPrimary`, and `panelComparison` remain distinct in
  implementation and tests.
- Existing Phase 1, Phase 2D, Phase 4B, and Phase 5B validation commands should
  continue to pass after the follow-up implementation.

Risks / open questions:

- If the current component API does not expose enough provenance for the left
  formula source, Phase 6B may need a tiny prop/type addition before copy can be
  made precise.
- The left panel must still give users immediate feedback that tuning changed
  the formula; de-emphasizing the final SINR should not hide the result
  entirely.
- Mobile or narrow Tuning layouts may need careful spacing so promoted formula
  terms do not push primary status out of reach.

## Validation Plan

- `npm run lint`
- `npm run build`
- Browser validation at:
  - `1440x900`
  - `1366x768`
  - `768x1024`
  - `390x844`
- Manual visual checks:
  - serving/candidate/approach beams distinguishable
  - left inspector and right panel refer to the same semantic object
  - debug fields are hidden in presentation mode
  - tuning changes update formula terms immediately while paused

## Resolved Questions

- Beam color priority is resolved by Phase 2C. Event role has priority for
  primary serving, pending handover, approach / pre-illumination, and recent HO
  source beams, while frequency identity remains visible through `F# B#`
  labels. Other active beams keep frequency-reuse color below event-role
  hierarchy.
- Demo default is resolved by Phase 3A. Demo/readability runs and runtime
  presentation presets fall back to `presentation` unless a persisted user
  selection or explicit test / URL override exists.
- Receiver gain promotion is resolved by Phase 4A for the current UX redesign
  track as an approved research override / teaching control; Phase 4B is
  already implemented / validated. `G^R` must not be described as a
  paper-backed parameter;
  default remains `0 dBi`, and UI copy must state that the HOBS paper parameter
  table does not provide a receiver / UE antenna gain value.
- DPC controls placement is resolved by Phase 5 for the current UX redesign
  track: editable DPC controls are deferred; read-only DPC facts may be shown in
  Diagnostics; any future editable promotion must be a `TR 38.811`-gated
  research power-policy tab / section rather than an existing formula Tuning
  tab.
- Phase 5A records the DPC teaching / power-policy contract for the current
  plan: DPC is not a scalar paper-backed formula control, the only next
  implementation allowed is a read-only Diagnostics status block, and any
  future editable DPC policy must reset DPC runtime bucket state, handover
  runtime state, stale frame/formula/effective-power displays, while preserving
  orbit trajectory caches and replay clock unless the user explicitly restarts
  deterministic replay.
- Phase 5B implements and validates the read-only DPC Diagnostics status block:
  it is gated by `hobs-tr38811` plus `channel.beamPowerControl`, shows the
  research power-policy copy and configured/effective power facts, hides DPC
  details in Presentation, exposes no editable DPC controls in Tuning, and does
  not render the full DPC block for legacy or non-DPC profiles. Editable DPC
  remains future-only.

## Open Questions

- Editable DPC remains future-only: what additional teaching acceptance
  criteria, reset behavior, and validation evidence would be required before a
  separate `TR 38.811`-gated research power-policy editing surface could be
  reconsidered?
- Should a future DPC parity slice add per-satellite `Pmax` normalization or
  wider energy-model coupling before any editable UI is exposed?
