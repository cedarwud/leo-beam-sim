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

Current implementation update:

- In `tuning` and `diagnostics` UI modes, the right panel owns the current
  physical-serving SINR formula readout. It shows the `γ` result plus
  `computeLinkBudget()` terms for the physical serving source:
  `P_t·H·G^T·G^R`, effective `P_t`, `G^T`, `G^R`, path loss, scan loss,
  `I^a`, `I^b`, `σ²`, and the denominator.
- The left tuning rail no longer repeats serving/candidate satellite status or
  the full formula-term evidence. This avoids showing the same operational
  values in both sidebars and leaves the left rail focused on editable
  formula-owned controls.

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

Phase 9A planning note:

- `P_t` and `σ²` are both power-domain scalar controls, but they occupy
  opposite sides of the SINR ratio. The current combined `P_t / σ²` tab is a
  compact grouping, not an ideal formula-ownership model. Phase 9A below
  supersedes that UI grouping direction by separating numerator signal-power
  controls from denominator thermal-noise controls.

Not covered yet:

- `G^R`: not implemented as a configurable profile field. The current link
  budget assumes UE receiver gain is approximately `0 dBi`.
- `antenna.efficiency`: exists in profile but is not used by live SINR.
- atmospheric zenith loss / gas-loss scale, scintillation scale, and the
  deterministic shadow-fading margin are currently hard-coded inside
  `path-loss.ts`.
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
- Internal docs, validation, and optional Diagnostics copy must preserve that
  the HOBS paper parameter table does not provide a receiver / UE antenna gain
  value. Phase 10 supersedes the older requirement to show that caveat in the
  primary Tuning scan path.

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
- Top-left: compact playback controls using the same dark telemetry material
  as the sidebars.
- Right rail: a single `Signal snapshot` section owns the operational status
  instead of rendering two detached status cards. It contains two compact
  side-by-side tiles:
  - Active serving / HO source
  - Candidate / pending / HO target
- Right rail below the snapshot: `SINR Formula Terms`, grouped as scan-friendly
  two-column rows under `Signal path`, `Loss`, and `Interference + noise`.
- Bottom or small status strip:
  - beam hopping state
  - handover trigger progress only when pending
  - concise alert if serving beam is not active this slot

### Left Tuning Rail

- Default collapsed to a compact `SINR Controls` affordance.
- Expanded rail uses compact formula tabs directly under the SINR expression:
  - Power / `P_t`
  - Loss / `H(L)`
  - Beam / `G^T(θ)`
  - Receiver / `G^R`
  - Interference / `I^a, I^b`
  - Noise / `σ²`
- `Fixed Terms` should show, until Phase 4B implements the approved research
  override:
  - `G^R = 0 dBi`
  - receiver / UE antenna gain source caveat, collapsed or moved to
    Diagnostics after Phase 10
  - TR 38.811 environment
  - NLoS clutter loss
  - antenna efficiency not wired
- The expanded rail puts the HOBS SINR expression first, then the compact
  formula tab row immediately below it. The active tab's local formula fragment
  and controls follow before long explanatory or audit content.
- Numeric sliders must show visible `Min ...` and `Max ...` endpoint badges
  immediately above the track, not only inside ARIA labels.
- Formula-map and coverage material stay discoverable but low-prominence below
  the active controls, so users can start from the equation and adjust the
  corresponding term without scrolling through live readouts first.

### Visual Hierarchy For Beginner Use

- Use a dark orbital cockpit palette as the default tuning/diagnostics
  surface: deep navy/black panel fills, bright readable text, and restrained
  semantic color. Do not switch sidebars to pale panels on an otherwise dark
  site.
- Use color to separate meaning, not decoration:
  - teal for desired signal / numerator controls
  - blue for loss/noise terms
  - amber for candidate / fixed / research sensitivity surfaces
  - muted red-orange for interference
- Avoid long undifferentiated text stacks in the first visible region. Put
  operational values in the right rail, formula controls in the left rail, and
  audit/provenance text behind low-prominence disclosures.
- Compact tab buttons should look clickable through borders, active underlines,
  hover/focus affordance, and clear selected state.

### Diagnostics Drawer

Move the following out of the main right panel:

- Slot index and slot duration.
- Serving/pending active beam ID lists.
- Recent HO count and last reason.
- Runtime override list and extended formula-map/audit details. The compact
  current formula terms remain in the right panel during tuning/diagnostics.

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

### Phase 6: Handover Policy Research Controls

#### Phase 6A: Handover Policy Research Controls Plan

This is an SDD-only planning slice for deciding how handover policy parameters
may become adjustable research controls. It does not approve runtime
implementation by itself.

Current coverage:

- `docs/sinr-runtime-parameter-contract.md` already states that
  `handover.*` must not be mixed into the SINR parameter panel because these
  fields affect target qualification and switching logic, not the SINR formula.
- Phase 5A already classifies `handover.*` as policy / scheduler-adjacent
  controls that require a separate research/policy section plus reset/state
  contract before any editable promotion.
- The missing contract is the handover-specific control set, placement,
  draft/apply/reset behavior, naming guardrails, and Phase 6B implementation
  stub.

Decision:

- Handover policy parameters may be promoted as `Handover Policy Research
  Controls`.
- These controls are not paper-backed SINR formula controls and must not appear
  inside the existing formula-guided `Power`, `Loss`, `Beam`, or
  `Interference` tabs.
- The active policy remains `sinr-offset` for this phase. A policy-family
  selector is not approved by Phase 6A.
- Editable controls require explicit apply/reset behavior because changing
  handover policy fields changes state-machine interpretation. Executor agents
  must not invent different live-edit behavior.

Placement contract:

- Tuning mode must expose `Handover Policy Research Controls` as an independent
  top-level tab / page within Tuning mode, separate from the SINR formula
  tuning surface.
- Recommended Tuning sub-tabs are:
  - `SINR Formula`
  - `Handover Policy`
- A section appended below the SINR formula controls inside the same
  `HOBS SINR Tuning` panel is not sufficient. It still reads as part of SINR
  tuning even if it is technically outside the `Power`, `Loss`, `Beam`, and
  `Interference` formula tablist.
- Presentation mode must hide editable handover policy controls. It may keep
  existing primary handover status such as delta and trigger progress.
- Diagnostics mode may show read-only effective handover policy values and raw
  state-machine evidence such as pending target, trigger progress, guard state,
  HO count, and raw reason.
- The existing SINR formula controls remain formula-owned. Handover policy
  copy may reference SINR as the decision metric, but must not imply that these
  fields directly change `P_t · H · G^T · G^R / (I^a + I^b + σ²)`.

Proposed control set:

| UI label | Internal field | Unit | Initial UI range | Copy / effect |
|---|---|---:|---:|---|
| Handover offset margin | `handover.offsetDb` | dB | `0` to `10` | Candidate target must beat the current link by this margin before inter-satellite handover can progress. Lower is more aggressive; higher is stickier. |
| Inter-HO trigger time | `handover.triggerTimeSec` | s | `0` to `15` | Stable pending-target dwell before inter-satellite handover commits. |
| Ping-pong guard window | `handover.pingPongGuardSec` | s | `0` to `30` | Cooldown after inter-satellite handover to reduce immediate switching back. |
| Handover SINR smoothing | `handover.sinrSmoothingSec` | s | `0` to `5` | Decision-path smoothing for candidate SINR. `0` means use the raw per-frame SINR sample. |
| Same-satellite beam dwell | `handover.intraSwitchTimeSec` | s | `0` to `5` | Dwell before same-satellite beam switching. |
| Pending target hold | `handover.pendingTargetHoldSec` | s | `0` to `10` | Grace window before replacing a still-qualified pending target. |
| Handover attach threshold | `handover.sinrThresholdDb` | dB | `-20` to `10` | Minimum attach / reattach eligibility threshold for the handover manager. UI must not label this simply as `SINR threshold`; distinguish it from DPC `beamPowerControl.sinrThresholdDb`. |

Draft / apply / reset behavior:

- Phase 6B must use draft edits plus an explicit `Apply policy changes`
  action, not continuous reset on every slider tick.
- Phase 6B must provide `Reset to profile defaults` for the handover policy
  group.
- Applied handover policy overrides must remain separate from paper/profile
  defaults and from SINR formula overrides.
- Phase 6B should not persist handover policy overrides across reloads unless
  a later SDD phase explicitly approves persistence.
- Profile changes should reset handover policy overrides back to the selected
  profile defaults unless a later phase defines cross-profile override
  migration.

Reset / state contract:

- Applying any handover policy override must reset the handover manager state:
  current serving state, pending target, trigger progress, ping-pong guard
  window, pending hold timer, intra-switch target, smoothed SINR map, and
  event log / HO count.
- Applying any handover policy override must clear recent-HO display evidence,
  stale panel latches, stale trigger/delta text, and stale formula/source
  display values until the next recomputed frame is published.
- Applying handover-only policy changes must publish a fresh frame even when
  the scene is paused.
- Applying handover-only policy changes must not rebuild orbit trajectory
  caches.
- Applying handover-only policy changes must not reset the replay clock unless
  the user explicitly requests deterministic replay restart.
- Applying handover-only policy changes must not change SINR formula terms
  directly.
- Applying handover-only policy changes must not create DPC editable controls.
  If an implementation discovers unavoidable DPC coupling, it must report the
  deviation instead of silently broadening reset scope.

Non-goals:

- No runtime code changes in Phase 6A.
- No SINR formula math changes.
- No handover algorithm changes beyond planning the existing `sinr-offset`
  control surface.
- No orbit propagation or trajectory-cache changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain changes.
- No policy-family selector.
- No SDD status change; this document remains `Status: Proposed`.

Phase 6B implementation stub:

- Implement only after this SDD delta has been reconciled.
- Add Tuning-mode-only `Handover Policy Research Controls` as an independent
  Tuning sub-tab / page, not as a section inside `SignalTuningPanel`'s SINR
  formula surface.
- Keep SINR formula tuning under a separate `SINR Formula` tab / page.
- Keep `policy: sinr-offset` read-only.
- Add draft/apply/reset-to-profile-defaults behavior exactly as specified
  above.
- Apply overrides through an effective handover policy / effective profile
  boundary while preserving separation from SINR formula overrides.
- Reset handover manager state and stale panel evidence on apply according to
  the reset/state contract.
- Keep Presentation free of editable policy controls and keep Diagnostics
  read-only for effective policy values.
- Add focused validation for placement, copy, policy wiring, and reset
  behavior. Placement validation must prove that handover policy controls live
  in an independent Tuning tab / page, not merely after the SINR formula tablist
  inside the same SINR panel.

Phase 6B reconciliation note:

- A reported Phase 6B implementation placed `HandoverPolicyControls` after the
  SINR formula tabs inside `SignalTuningPanel`. That satisfies only the weaker
  "outside formula tabs" wording and is now considered a placement deviation.
- The desired IA is an independent Tuning tab / page. Handover policy controls
  must not share the `HOBS SINR Tuning` page body because that makes policy
  parameters look like SINR tuning controls.
- Existing Phase 6B behavior such as draft/apply/reset, effective policy
  wiring, and Diagnostics read-only policy values may be retained if already
  correct. The corrective phase should be limited to IA placement, copy, and
  validation hardening unless review finds a related blocker.

#### Phase 6C: Handover Policy Independent Tab Correction

This corrective phase fixes the Phase 6B placement deviation without reopening
the handover policy runtime behavior.

Scope:

- Split Tuning mode into independent sub-tabs / pages for `SINR Formula` and
  `Handover Policy`.
- Move editable `Handover Policy Research Controls` out of the `HOBS SINR
  Tuning` page body.
- Preserve the existing handover draft/apply/reset-to-profile-defaults behavior
  if it already matches Phase 6A.
- Preserve the existing effective profile / handover reset behavior if it
  already matches Phase 6A.
- Update validation so it fails when handover policy controls are merely
  appended after `data-testid="sinr-formula-tabs"` inside the same SINR
  surface.
- Keep Presentation hidden and Diagnostics read-only for handover policy
  controls.

Non-goals:

- No SINR formula math changes.
- No handover algorithm changes.
- No orbit propagation or trajectory-cache changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain changes.
- No policy-family selector.
- No rewrite of the Phase 6B reset/wiring path unless a placement blocker makes
  a tiny prop movement unavoidable.

Acceptance:

- Tuning mode has clearly separate `SINR Formula` and `Handover Policy`
  top-level tabs / pages.
- `Handover Policy Research Controls` are not rendered inside the `HOBS SINR
  Tuning` page body or as part of the SINR formula control stack.
- The handover policy tab still shows `policy: sinr-offset` as read-only and
  preserves draft/apply/reset-to-profile-defaults behavior.
- Presentation mode hides editable handover policy controls.
- Diagnostics mode shows only read-only effective handover policy values.
- Phase 6C validation proves independent-tab placement, not only DOM ordering
  after the SINR formula tabs.

Phase 6C validation evidence:

- `npm run validate:phase6c:handover-policy-placement` passed during
  controller reconciliation.
- The validation asserts independent `SINR Formula` and `Handover Policy` tab
  panels, rejects handover policy controls inside the SINR formula page, and
  preserves the Phase 6B draft/apply/reset and reset-state expectations.
- Execution reported that `npm run validate:phase6b:handover-policy-controls`,
  `npm run validate:phase1a:recent-ho-ui`,
  `npm run validate:phase5b:diagnostics-dpc-status`, `npm run lint`, and
  `npm run build` passed, with only the existing Vite bundle-size warning.

Phase 6C closure:

- The Phase 6B placement deviation is corrected.
- `Handover Policy Research Controls` now belong to an independent Tuning
  `Handover Policy` page rather than the `HOBS SINR Tuning` page body.
- No Phase 6 runtime-policy behavior remains open after this correction.

Phase 6A acceptance:

- The SDD records handover policy parameters as research controls, not SINR
  formula controls.
- The SDD names the approved control set and requires UI copy that distinguishes
  `handover.sinrThresholdDb` from DPC `beamPowerControl.sinrThresholdDb`.
- The SDD states placement for Presentation, Tuning, and Diagnostics modes.
- The SDD requires `Handover Policy Research Controls` to be an independent
  Tuning tab / page, not an appended section inside the SINR formula tuning
  page.
- The SDD requires draft/apply/reset-to-profile-defaults behavior before any
  implementation prompt can be issued.
- The SDD records a handover-specific reset/state contract that preserves orbit
  cache and replay clock unless the user explicitly restarts replay.
- No runtime implementation prompt is considered approved until Phase 6A is
  reconciled.

Risks / open questions:

- Handover policy edits are disruptive because they invalidate pending target,
  smoothing, guard, recent-HO, and event-count evidence; UI copy must make the
  reset explicit.
- The `sinrThresholdDb` name appears both in handover and DPC contexts. UI copy
  must consistently call the handover field `Handover attach threshold` or
  equivalent, never an ambiguous standalone `SINR threshold`.
- If Phase 6B cannot reset handover manager state without also resetting other
  simulation runtime state, the implementation agent must report the deviation
  before broadening scope.

### Phase 7: Tuning-Mode SINR Display Ownership

#### Phase 7A: Serving SINR Display De-duplication Plan

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

Proposed Phase 7B implementation scope:

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

Phase 7B implementation evidence:

- `SignalTuningPanel` now labels its SINR number as `selected source formula
  result` under `Formula Verification`, not as active serving status.
- The left formula verification card marks the final result as secondary
  formula-verification output and marks formula terms as the primary evidence.
- The promoted term grid includes `signalDbm` / numerator, effective `P_t`,
  `G^T`, `G^R`, path loss, scan loss, intra/interference, `noiseDbm`, and the
  denominator.
- The right `InfoPanel` primary and comparison SINR blocks keep operational
  status ownership and expose validation markers without changing user-facing
  copy.
- `npm run validate:phase7b:sinr-display-ownership` verifies Tuning-mode
  ownership, left-panel copy / hierarchy markers, active runtime override
  evidence, and recent-HO source separation.

Phase 7B validation evidence:

- `npm run validate:phase7b:sinr-display-ownership` passed during controller
  reconciliation.
- The validation asserts that Tuning-mode `InfoPanel` owns operational serving
  and candidate SINR status, while `SignalTuningPanel` labels SINR as a
  selected-source formula result.
- The validation asserts that formula terms are primary evidence, the final
  formula result is secondary, active runtime overrides are shown as
  `computeLinkBudget()` inputs, and recent-HO formula source remains
  `physicalServing` rather than the HO source.
- Execution reported that `npm run validate:phase1a:recent-ho-ui`,
  `npm run validate:phase2d:forced-role-state-visuals`,
  `npm run validate:phase4b:receiver-gain`,
  `npm run validate:phase5b:diagnostics-dpc-status`,
  `npm run validate:phase6c:handover-policy-placement`, `npm run lint`, and
  `npm run build` passed, with only the existing Vite bundle-size warning.

Phase 7B closure:

- The Tuning-mode SINR display ownership conflict is resolved.
- The right `InfoPanel` remains the operational serving / comparison SINR
  owner.
- The left `SignalTuningPanel` is now formula-verification evidence, not a
  duplicate operational status surface.
- No Phase 7 implementation work remains open after this closure.

Risks / open questions:

- If the current component API does not expose enough provenance for the left
  formula source, Phase 7B may need a tiny prop/type addition before copy can be
  made precise.
- The left panel must still give users immediate feedback that tuning changed
  the formula; de-emphasizing the final SINR should not hide the result
  entirely.
- Mobile or narrow Tuning layouts may need careful spacing so promoted formula
  terms do not push primary status out of reach.

### Phase 8: Path-Loss / H-Term Research Controls

#### Phase 8A: Path-Loss / H-Term Research Controls Plan

This is an SDD-only planning slice for deciding how `H` / path-loss controls
may expand beyond the current Loss tab. It does not approve runtime
implementation by itself.

Current understanding:

- The current `SINR Formula > Loss` tab owns `f_c` plus the component toggles
  `L_{fs}`, `L_g`, `L_{sc}`, and `L_{sf}`.
- The live implementation still hard-codes several loss/model values:
  - atmospheric zenith loss / gas-loss scale: `0.1 dB` at zenith, scaled by
    elevation through the current `1 / sin(elevation)` approximation;
  - scintillation scale: `0.05 dB`, scaled by the same elevation guard;
  - deterministic shadow-fading margin: `2 dB`;
  - `TR38811_ENVIRONMENT = suburban`;
  - `TR38811_NLOS_CLUTTER_LOSS_DB = 20`.
- `H` is derived from the loss sum, conceptually `H ~= 10^{-L/10}`. The UI
  should keep controls phrased around path-loss terms because the live budget
  reports `pathLossDb`.
- Orbit truth, slant range, trajectory cache, elevation, and propagated
  satellite state are not Loss tuning controls. They must not be exposed as
  `H` controls.

SDD coverage gap:

- Earlier phases identify the hard-coded TR 38.811 environment and NLoS clutter
  loss, but the UX SDD did not yet classify all hard-coded path-loss constants
  by UI ownership.
- The SDD did not define safe ranges, copy guardrails, stale formula-frame
  handling, or handover reset expectations for future path-loss research
  controls.

Phase 8A placement decision:

- Keep `SINR Formula > Loss` formula-guided. It may contain:
  - paper-facing formula controls for sourced formula terms already represented
    in the HOBS loss expression;
  - a clearly separated `Research Override` block for simulator sensitivity
    values that scale or replace current hard-coded loss constants.
- Do not put TR 38.811 LoS environment selection into the paper-facing Loss
  controls. It is a `Simulation Setting` because it selects the LoS probability
  table and channel-state model, not a scalar `L` term.
- Do not add orbit, range, observer, shell, elevation, trajectory-cache, beam
  hopping, handover, DPC, receiver gain, or handover-policy controls to the
  Loss tab.
- Numeric controls for hard-coded gas, scintillation, shadow-fading, and NLoS
  clutter values are not paper-backed parameters unless a later source audit
  cites exact paper values. They must be labeled as `Research Override` /
  teaching or sensitivity controls.

Proposed control set:

| Class | UI label | Internal field / future field | Default | Safe UI range | Runtime effect | Copy guardrail |
|---|---|---|---:|---:|---|---|
| Paper-facing formula control | `f_c` / Carrier frequency | `channel.frequencyGHz` | profile value, currently `28 GHz` in HOBS profiles | `10` to `40 GHz` | next-frame recompute; changes FSPL and therefore path-loss-derived received power | Paper-facing frequency control. Do not imply it changes orbit range. |
| Paper-facing formula control | `L_{fs}` / Free-space loss term | `channel.pathLossComponents` includes `fspl` | on | on/off | next-frame recompute; includes or removes the FSPL term | Usually stays on for physical runs. |
| Paper-facing formula control | `L_g` / Gas absorption term | `channel.pathLossComponents` includes `atmospheric` | on | on/off | next-frame recompute; includes or removes gas absorption | Toggle is formula-facing; numeric gas scale remains an override. |
| Paper-facing formula control | `L_{sc}` / Scintillation term | `channel.pathLossComponents` includes `scintillation` | on | on/off | next-frame recompute; includes or removes scintillation loss | Toggle is formula-facing; numeric scintillation scale remains an override. |
| Paper-facing formula control | `L_{sf}` / Shadow fading margin term | `channel.pathLossComponents` includes `shadow-fading` | on | on/off | next-frame recompute; includes or removes the deterministic shadow margin | Current implementation is deterministic, not random shadow fading. |
| Research Override | `L_{g,z}` / Atmospheric zenith loss | proposed `channel.lossOverrides.atmosphericZenithLossDb` | `0.1 dB` | `0` to `1 dB` | next-frame recompute; scales current `L_g(elevation)` approximation when `L_g` is enabled | Simulator sensitivity value, not a HOBS paper parameter range. |
| Research Override | `L_{sc,scale}` / Scintillation scale | proposed `channel.lossOverrides.scintillationScaleDb` | `0.05 dB` | `0` to `1 dB` | next-frame recompute; scales current `L_{sc}(elevation)` approximation when `L_{sc}` is enabled | Do not present as a stochastic fading model. It is the current deterministic margin scale. |
| Research Override | `L_{sf,margin}` / Shadow fading margin | proposed `channel.lossOverrides.shadowFadingMarginDb` | `2 dB` | `0` to `10 dB` | next-frame recompute; adds deterministic margin when `L_{sf}` is enabled | Label as deterministic simulator margin, not a random draw. |
| Research Override, TR 38.811-gated | `L_{cl,NLoS}` / NLoS clutter loss | proposed `channel.tr38811.nlosClutterLossDb` | `20 dB` | `0` to `40 dB` | next-frame recompute; applies only when the seeded TR 38.811 LoS sample is NLoS | Assumption-backed suburban clutter proxy, not a full environment/elevation table. |
| Simulation Setting, not Loss tuning | `TR 38.811 LoS environment` | proposed `channel.tr38811.environment` | `suburban` | enum: `suburban`, `dense-urban` | changes LoS probability table if separately promoted | Do not place in paper-facing Loss controls. Editable promotion needs a separate simulation-setting plan. |

Placement / UI contract:

- `SINR Formula > Loss` should show the existing formula fragment:
  `H ~= 10^{-L/10}`, `L = L_{fs} + L_g + L_{sc} + L_{sf}`.
- The tab should be divided into:
  - `Formula controls`: `f_c` and the four loss-term toggles;
  - `Research Override`: numeric gas, scintillation, shadow-margin, and
    TR 38.811 NLoS clutter sensitivity controls.
- Research Override controls should sit in a visually distinct subsection with
  non-paper copy. They must not use the same affordance language as sourced
  paper parameters.
- If `L_g`, `L_{sc}`, or `L_{sf}` is toggled off, its numeric override should
  either be disabled or marked `inactive while term is off`.
- `L_{cl,NLoS}` should be visible only for `formulaFamily === 'hobs-tr38811'`
  or shown as read-only inactive copy outside that mode.
- `TR 38.811 LoS environment` may be shown as a read-only current simulation
  setting near the Loss tab, but Phase 8A does not approve it as an editable
  Loss control.
- Active override summaries should distinguish:
  - formula controls changed from the profile;
  - Research Override values changed from default;
  - Simulation Settings that are read-only or separately owned.

Reset / state contract:

- Phase 8B path-loss controls should use the same live-edit posture as current
  scalar SINR formula controls: profile-derived override update followed by
  next-frame recompute.
- The next recomputed frame must be published even when the scene is paused.
- The UI must clear or mark stale formula verification values after a Loss
  control changes and before a recomputed frame arrives. Stale `pathLossDb`,
  numerator, interference, denominator, and formula-result values must not be
  displayed as if they already reflect the new override.
- No handover reset is required for Phase 8B Loss controls. These edits change
  per-frame link-budget samples, not handover policy parameters, orbit truth,
  beam layout, beam hopping scheduler policy, or DPC policy state.
- Phase 8B Loss-only edits must not rebuild trajectory caches, reset replay
  time, reset DPC buckets, create DPC editable controls, or create handover
  policy controls.
- If an implementation cannot clear stale formula frames without resetting the
  handover manager, it must report that deviation instead of silently broadening
  reset scope.
- Editable TR 38.811 environment selection is not included in Phase 8B. If a
  later phase promotes it as a Simulation Setting, that phase must revisit
  draft/apply behavior and whether LoS-state changes require handover reset.

Non-goals:

- No runtime code changes in Phase 8A.
- No SINR math implementation changes in Phase 8A.
- No orbit propagation, range, observer, shell, or trajectory-cache changes.
- No handover policy changes or handover policy UI changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain changes.
- No editable TR 38.811 environment selector in Phase 8A.
- No SDD status change; this document remains `Status: Proposed`.

Phase 8B implementation stub:

- Implement only after this SDD delta is reconciled.
- Promote the hard-coded path-loss constants into a profile/default-backed
  runtime override boundary while preserving existing defaults exactly:
  `0.1 dB` atmospheric zenith loss, `0.05 dB` scintillation scale,
  `2 dB` shadow-fading margin, and `20 dB` NLoS clutter loss.
- Add the Loss-tab UI sections defined above without moving orbit, handover,
  DPC, receiver-gain, or scheduler controls into the SINR formula surface.
- Wire overrides so disabled terms stay disabled: a numeric `L_g`, `L_{sc}`,
  or `L_{sf}` override must not contribute while its corresponding component
  toggle is off.
- Keep `TR 38.811 LoS environment` read-only or out of the Phase 8B UI unless a
  later SDD phase explicitly promotes it as a Simulation Setting.
- Update `docs/sinr-runtime-parameter-contract.md` in the same implementation
  change set if Phase 8B adds new runtime-adjustable fields.
- Add focused validation for placement, copy, default preservation, paused
  next-frame recompute, stale formula-frame clearing, TR 38.811 gating, and
  reset behavior.

Acceptance:

- Phase 8A records the path-loss coverage gap and classifies each proposed
  control as paper-facing formula control, `Research Override`, or
  `Simulation Setting`.
- The proposed Loss tab keeps paper-facing controls and research overrides
  visually and textually distinct.
- The SDD explicitly prevents orbit truth / range from being represented as
  Loss tuning controls.
- The SDD explicitly prevents research overrides from being described as
  paper-backed parameter values.
- The SDD defines safe ranges, runtime effect, copy guardrails, stale frame
  handling, and handover reset expectations for Phase 8B.
- Phase 8B is the first implementation phase; Phase 8A itself changes only this
  SDD and keeps `Status: Proposed`.

Phase 8A validation evidence:

- Controller reconciliation confirmed that the Phase 8A SDD delta matches the
  current hard-coded loss constants in `path-loss.ts` and `link-budget.ts`.
- `git diff --check -- docs/frontend-ux-redesign-sdd.md` passed with no
  whitespace errors.
- No runtime code, SINR math, orbit, handover, beam hopping, DPC, receiver
  gain, or `sinr-runtime-parameter-contract.md` changes were made for Phase 8A.

Phase 8A closure:

- The Path-Loss / `H` research-control planning gap is closed.
- Phase 8B is now the next implementation candidate for Loss-tab formula
  controls plus clearly labeled path-loss Research Overrides.
- Editable TR 38.811 environment selection remains future-only and is not part
  of Phase 8B.

Phase 8B validation criteria:

- Default-preservation validation proves that enabling Phase 8B fields at their
  defaults does not change `pathLossDb`, `signalDbm`, denominator terms, or
  SINR relative to the pre-Phase-8B behavior beyond floating-point tolerance.
- Placement validation proves the Loss tab contains `Formula controls` and
  `Research Override` sections, and that TR 38.811 environment is not an
  editable paper-facing Loss control.
- Copy validation proves non-paper values include `Research Override`,
  `teaching`, `sensitivity`, or equivalent non-paper wording, and do not claim
  a HOBS paper-backed range.
- Runtime validation proves that changing each Loss override while paused
  publishes a next-frame recompute and clears or marks stale formula evidence
  until the new frame arrives.
- Runtime validation proves `L_g`, `L_{sc}`, and `L_{sf}` numeric overrides are
  inactive while their corresponding component toggles are off.
- TR 38.811 validation proves `L_{cl,NLoS}` is gated to the research formula
  family and only affects samples whose seeded LoS state is NLoS.
- Reset validation proves Loss-only edits do not reset replay time, rebuild
  orbit trajectory caches, reset DPC buckets, or reset handover policy state.
- Existing validation should continue to pass after Phase 8B, especially
  Phase 1A truth-source, Phase 4B receiver gain, Phase 5B Diagnostics DPC,
  Phase 6C handover-policy placement, and Phase 7B SINR display ownership.

Phase 8B implementation evidence:

- The hard-coded path-loss constants are now profile/default-backed runtime
  fields while preserving existing defaults: `0.1 dB` atmospheric zenith loss,
  `0.05 dB` scintillation scale, `2 dB` shadow-fading margin, and `20 dB`
  TR 38.811 NLoS clutter loss.
- The final runtime fields align with the Phase 8A proposed boundary:
  `channel.lossOverrides.atmosphericZenithLossDb`,
  `channel.lossOverrides.scintillationScaleDb`,
  `channel.lossOverrides.shadowFadingMarginDb`, and
  `channel.tr38811.nlosClutterLossDb`.
- The wiring follows the approved path:
  `SignalTuningState` -> effective profile -> `computeLinkBudget()` ->
  `computePathLossDb()`.
- `SINR Formula > Loss` now separates `Formula controls` from
  `Research Override` numeric controls. `TR 38.811 LoS environment` is shown as
  read-only context rather than an editable Loss control.
- `L_g`, `L_{sc}`, and `L_{sf}` numeric overrides are inactive while their
  corresponding formula-term toggles are off. `L_{cl,NLoS}` is gated to
  `hobs-tr38811` and seeded NLoS samples.
- Loss-only edits use next-frame recompute, mark formula evidence stale between
  edit and recomputed frame, and do not enter the structural reset key.

Phase 8B validation evidence:

- Controller reconciliation reran
  `npm run validate:phase8b:path-loss-controls`; it passed.
- The focused validation asserts default preservation, Loss-tab placement and
  non-paper copy, stale formula-evidence handling, disabled-term behavior,
  TR 38.811 NLoS gating, and exclusion of Loss-only edits from the structural
  reset key.
- Executor-reported regression validation passed for Phase 1A, Phase 4B,
  Phase 5B, Phase 6C, Phase 7B, lint, and build. Build retained only the
  existing Vite large-chunk warning.

Phase 8B closure:

- The `H` / Loss surface is no longer toggle-only: scalar `Research Override`
  controls for gas, scintillation, deterministic shadow margin, and TR 38.811
  NLoS clutter are implemented under `SINR Formula > Loss`.
- Phase 8B has no remaining work. Editable TR 38.811 environment selection
  remains a future Simulation Setting question and is still out of Loss tuning
  scope.

#### Phase 8C: L_cl,NLoS Gating UX Clarification Plan

This is an SDD-only correction slice for the Phase 8B `L_{cl,NLoS}` control
affordance. It does not approve SINR math changes or TR 38.811 environment
editing.

Current issue:

- Phase 8B correctly gates `L_{cl,NLoS}` to `formulaFamily ===
  'hobs-tr38811'`.
- In non-TR 38.811 profiles, the current UI can appear as a disabled numeric
  slider. That is technically consistent with gating but UX-confusing: users
  may read it as a broken or unavailable Loss control rather than a profile-
  scoped Research Override.
- `L_{cl,NLoS}` should be understandable without knowing profile internals:
  editable in TR 38.811 research mode, clearly unavailable outside it, and
  clearly sample-gated to seeded NLoS states even when editable.

Phase 8C placement / UI contract:

- In `hobs-tr38811` profiles, `L_{cl,NLoS}` must render as an editable numeric
  Research Override with the Phase 8B range `0` to `40 dB` and default
  `20 dB`.
- Outside `hobs-tr38811`, do not present `L_{cl,NLoS}` as a normal disabled
  slider. Use one of these clearer patterns:
  - hide the numeric slider and show an inactive explanatory row; or
  - render a read-only inactive callout that names the required profile family.
- The inactive copy must say that `L_{cl,NLoS}` belongs to TR 38.811 NLoS
  clutter and is editable only in the TR 38.811 research profile / formula
  family.
- The editable-state copy must still say that the value affects only seeded
  NLoS samples; seeded LoS samples do not change when the value changes.
- The profile/header area may continue to show the active profile and formula
  family, but Phase 8C must not rely on that header alone to explain why the
  control is inactive.

Phase 8C reset / state contract:

- No reset contract changes from Phase 8B.
- Changing `L_{cl,NLoS}` in `hobs-tr38811` remains a Loss-only edit:
  next-frame recompute, stale formula-evidence marking, no handover reset, no
  replay reset, no orbit cache rebuild, and no DPC bucket reset.
- Switching profiles continues to use the existing profile-change behavior.
  Phase 8C does not add draft/apply behavior for profile selection.

Phase 8C non-goals:

- No SINR formula math changes.
- No handover algorithm or handover policy changes.
- No orbit, range, shell, trajectory-cache, or observer changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain changes.
- No editable TR 38.811 environment selector.
- No policy-family selector.
- No SDD status change; this document remains `Status: Proposed`.

Phase 8C implementation stub:

- Adjust only the `L_{cl,NLoS}` UI affordance / copy and focused validation.
- Preserve Phase 8B runtime semantics and defaults.
- In validation, assert both profile states:
  - `hobs-tr38811` profile: `L_{cl,NLoS}` is editable and changing it updates
    the tuning override path;
  - legacy profiles: `L_{cl,NLoS}` is not shown as a regular disabled slider
    and includes clear TR 38.811-only inactive copy.
- Preserve existing Phase 8B validation for NLoS-only runtime effect, reset-key
  exclusion, stale evidence, and default preservation.

Phase 8C acceptance:

- A user can tell from the Loss tab why `L_{cl,NLoS}` is not editable in legacy
  profiles.
- A user can edit `L_{cl,NLoS}` in the TR 38.811 research profile.
- The UI does not imply that `L_{cl,NLoS}` affects legacy HOBS formulas or
  seeded LoS samples.
- Phase 8B path-loss validation continues to pass, or is renamed/split with
  equivalent coverage.

#### Phase 8D: Hide TR 38.811-only L_cl,NLoS Until Profile Access Exists

This is an SDD-only correction to the Phase 8C UX decision. Phase 8C improved
the inactive affordance, but the broader app currently hides profile selection
from normal users. With no visible path into the TR 38.811 research profile,
showing a TR-only inactive control still reads as "this parameter cannot be
adjusted" rather than "switch profile first."

Current issue:

- `L_{cl,NLoS}` is editable only when `formulaFamily === 'hobs-tr38811'`.
- The default app profile remains legacy, and the profile selector is not
  visible in the normal control bar.
- Therefore a legacy-mode inactive callout is still too noisy and misleading:
  it exposes a research-only control that the current UI does not let the user
  activate.

Phase 8D placement / UI contract:

- In legacy / non-`hobs-tr38811` profiles, hide `L_{cl,NLoS}` from the Loss
  tab entirely. Do not show a disabled slider, inactive callout, or read-only
  pseudo-control for this value.
- In `hobs-tr38811` profiles, keep `L_{cl,NLoS}` visible and editable as a
  numeric `Research Override` with the Phase 8B range `0` to `40 dB` and
  default `20 dB`.
- The editable-state copy must still say the value affects only seeded NLoS
  samples and does not affect seeded LoS samples.
- The `TR 38.811 LoS environment` read-only context may remain visible only if
  it does not imply that an unavailable profile can be edited from the current
  surface. If needed, hide or scope that context to `hobs-tr38811` as well.
- Do not add profile switching in Phase 8D. Profile / formula-family access is
  a separate future UX phase.

Phase 8D reset / state contract:

- No reset contract changes from Phase 8B.
- Changing `L_{cl,NLoS}` in `hobs-tr38811` remains a Loss-only edit:
  next-frame recompute, stale formula-evidence marking, no handover reset, no
  replay reset, no orbit cache rebuild, and no DPC bucket reset.
- Hiding the control in legacy profiles is presentation-only; it must not alter
  runtime defaults, profile JSON, path-loss math, or effective-profile
  construction.

Phase 8D non-goals:

- No SINR formula math changes.
- No handover algorithm or handover policy changes.
- No orbit, range, shell, trajectory-cache, or observer changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain changes.
- No editable TR 38.811 environment selector.
- No profile selector, policy-family selector, or formula-family switching UI.
- No SDD status change; this document remains `Status: Proposed`.

Phase 8D implementation stub:

- Remove the legacy-profile `L_{cl,NLoS}` inactive callout / pseudo-control
  from the Loss tab.
- Preserve the `hobs-tr38811` editable numeric control and existing runtime
  semantics.
- Update focused validation so it asserts:
  - legacy profiles do not render `L_{cl,NLoS}` as a slider, callout, read-only
    pseudo-control, or inactive control in the Loss tab;
  - `hobs-tr38811` profile still renders `L_{cl,NLoS}` as editable and changing
    it updates the tuning override / stale-evidence path;
  - Phase 8B runtime validation still covers NLoS-only effect, reset-key
    exclusion, stale evidence, and default preservation.

Phase 8D acceptance:

- In the default legacy UI, users no longer see an uneditable
  `L_{cl,NLoS}` control.
- In `hobs-tr38811`, users can still edit `L_{cl,NLoS}`.
- The UI no longer implies that a hidden TR 38.811-only value is available in
  legacy HOBS formulas.
- No runtime behavior changes outside the presentation of this control.

Phase 8D implementation evidence:

- The legacy / non-`hobs-tr38811` Loss tab no longer renders the
  `L_{cl,NLoS}` slider, inactive callout, or read-only pseudo-control.
- The `hobs-tr38811` Loss tab preserves the editable `L_{cl,NLoS}` numeric
  Research Override with the existing `0` to `40 dB` range.
- The read-only `TR 38.811 LoS environment` context is scoped to
  `hobs-tr38811`, so the default legacy UI no longer exposes unavailable
  TR-only Loss controls.
- No SINR math, handover, orbit/cache, beam hopping, DPC, receiver gain,
  profile selector, or formula-family selector behavior changed.

Phase 8D validation evidence:

- Controller reconciliation reran
  `npm run validate:phase8b:path-loss-controls`; it passed and now reports
  Phase 8B/8D path-loss research controls coverage.
- The focused validation asserts legacy profiles hide `L_{cl,NLoS}` entirely,
  `hobs-tr38811` renders it as editable, edits flow into the tuning override /
  stale-evidence path, NLoS-only runtime behavior remains gated, and Loss-only
  edits remain excluded from the structural reset key.
- Executor-reported regression validation passed for Phase 1A, Phase 4B,
  Phase 5B, Phase 6C, Phase 7B, lint, and build. Build retained only the
  existing Vite large-chunk warning.

Phase 8D closure:

- Phase 8D is accepted with no SDD deviations.
- In the current default legacy UI, `L_{cl,NLoS}` is intentionally hidden until
  a future phase provides explicit TR 38.811 profile / formula-family access.
- Phase 8 has no remaining work on the Loss-tab `L_{cl,NLoS}` visibility
  issue.

### Phase 9: Formula-Side Control Ownership

#### Phase 9A: P_t / sigma^2 Formula-Side Separation Plan

This is an SDD-only planning slice for separating numerator signal-power
controls from denominator thermal-noise controls in the Tuning-mode SINR
formula surface. It does not approve runtime implementation by itself.

Current issue:

- The current `SINR Formula` tablist includes a combined `P_t / σ²` tab titled
  `Power`.
- The combined tab contains numerator controls (`P_t`, `G_{t,max}`, and the
  approved `G^R` Research Override) and denominator noise controls (`B` and
  `N_0`, which define `σ² = N_0 B`).
- This grouping is compact, but it makes denominator noise controls look like
  transmit-power controls. That weakens the formula mental model because
  increasing `P_t` raises the numerator while increasing `B` or `N_0` raises
  the denominator and usually lowers SINR.

Phase 9A ownership decision:

- Do not treat `P_t` and `σ²` as one semantic control group.
- Separate the UI ownership by formula side:
  - `Signal Power` / numerator: `P_t`, `G_{t,max}`, and `G^R` Research
    Override.
  - `Thermal Noise` / denominator: `B`, `N_0`, and a read-only computed
    `σ²` / noise floor readout when formula evidence is available.
- Keep `G^T(θ)`, `H(L)`, and `I^a / I^b` ownership unchanged unless a later
  phase explicitly revisits them.
- Do not move handover policy, beam hopping scheduler, DPC policy, orbit,
  receiver-gain assumptions beyond the existing `G^R` override, or TR 38.811
  environment selection into this slice.

Proposed placement:

- Preferred compact layout: keep one top-level `SINR Formula` page, but replace
  the combined `P_t / σ²` tab with two formula-side groups:
  - `Signal Power` tab or section with formula fragment
    `S = P_t · H · G^T · G^R`;
  - `Thermal Noise` tab or section with formula fragment
    `σ² = N_0 B`.
- If viewport pressure makes two tabs too wide, one `Power / Noise` tab may
  remain only if it contains two clearly separated subsections with independent
  headings, formula fragments, and visual hierarchy. The tab label must not
  imply `B` / `N_0` are transmit-power controls.
- The `Thermal Noise` group should show a read-only computed noise floor when a
  current formula frame exists, using the same stale-evidence convention as the
  formula verification card.
- The `Signal Power` group should keep the existing `G^R` non-paper /
  Research Override copy and must not imply receiver gain is a HOBS paper-table
  parameter.

Reset / state contract:

- Phase 9B UI regrouping should not change runtime math.
- `P_t`, `G_{t,max}`, `G^R`, `B`, and `N_0` remain live-edit
  next-frame-recompute controls.
- Edits must continue to mark formula evidence stale until a recomputed frame
  arrives.
- No handover reset is required for these scalar formula edits.
- No replay reset, orbit trajectory-cache rebuild, DPC bucket reset, handover
  policy reset, or beam hopping scheduler reset is allowed for Phase 9B.

Non-goals:

- No SINR formula math changes.
- No new runtime parameters.
- No handover algorithm or handover policy changes.
- No orbit, range, shell, trajectory-cache, or observer changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain behavior change beyond preserving existing `G^R`.
- No editable TR 38.811 environment selector.
- No profile selector, policy-family selector, or formula-family switching UI.
- No SDD status change; this document remains `Status: Proposed`.

Phase 9B implementation stub:

- Rename or split the current combined `P_t / σ²` control surface so the
  numerator signal-power controls and denominator thermal-noise controls are
  visually and semantically distinct.
- Preserve existing field wiring, ranges, defaults, and stale-evidence behavior.
- Add focused validation that proves:
  - `P_t`, `G_{t,max}`, and `G^R` are grouped under Signal Power / numerator
    copy;
  - `B`, `N_0`, and the computed `σ²` / noise floor readout are grouped under
    Thermal Noise / denominator copy;
  - the old combined label does not make `B` / `N_0` look like transmit-power
    controls;
  - edits to all affected controls still update the same tuning state and
    evidence key as before;
  - existing Phase 4B receiver-gain, Phase 7B SINR display ownership, and
    Phase 8B/8D path-loss validation remain passing.

Acceptance:

- A user can identify which controls raise the numerator and which controls
  raise the denominator.
- `P_t` and `σ²` are no longer presented as one semantic control group.
- The UI preserves compactness without hiding formula-side ownership.
- No runtime behavior changes outside the presentation and grouping of existing
  controls.

#### Phase 9C: Formula Term Evidence Stability Plan

This is an SDD-only planning slice for stabilizing the Tuning-mode formula-term
evidence block when formula evidence is stale or temporarily unavailable. It
does not approve SINR math changes.

Current issue:

- The current formula verification card suppresses the formula-term grid when
  `formulaBudget` is missing or when formula evidence is marked stale after a
  runtime edit.
- This avoids showing stale numbers as current truth, but the whole evidence
  grid can visually disappear and collapse the layout.
- Users experience that as an unreliable evidence surface even though the
  underlying behavior may be correct.

Phase 9C UX decision:

- The formula-term evidence shell must remain visible in Tuning mode whenever
  the formula verification card is visible.
- Evidence state should be expressed inside the shell, not by removing the
  shell:
  - `current`: show current formula terms normally;
  - `stale`: keep the term grid structure visible, mark the values as stale, and
    avoid presenting them as current;
  - `waiting`: keep the term grid structure visible, show placeholder values or
    per-term waiting copy until a selected formula source / budget exists.
- The block may use last-known values only if they are visibly labeled as stale.
  If last-known values are not available, each term should keep a stable
  placeholder cell instead of removing the grid.
- Formula result and formula-term evidence should use consistent state language:
  `current`, `stale after edit`, or `waiting for selected formula source`.

Required term coverage:

- The stable grid should preserve the same conceptual terms already used by
  Phase 7B / Phase 9A:
  - numerator / `signalDbm`;
  - effective `P_t`;
  - `G^T`;
  - `G^R`;
  - path loss `L`;
  - scan loss `L_scan`;
  - `I^a`;
  - `I^b`;
  - noise `σ²`;
  - denominator `I^a + I^b + σ²`.
- If Phase 9B has separated Signal Power and Thermal Noise controls, the
  evidence grid should align labels with those formula-side names but should not
  duplicate controls.

Reset / state contract:

- Phase 9C is a presentation-state change only.
- Runtime edits still mark formula evidence stale until a recomputed frame
  arrives.
- No handover reset is required.
- No replay reset, orbit trajectory-cache rebuild, DPC bucket reset, handover
  policy reset, or beam hopping scheduler reset is allowed.
- The UI must not fake current values. Any stale or placeholder values must be
  visually and semantically marked.

Non-goals:

- No SINR formula math changes.
- No new runtime parameters.
- No changes to formula source ownership from Phase 7B.
- No handover algorithm or handover policy changes.
- No orbit, range, shell, trajectory-cache, or observer changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain behavior change.
- No editable TR 38.811 environment selector.
- No profile selector, policy-family selector, or formula-family switching UI.
- No SDD status change; this document remains `Status: Proposed`.

Phase 9D implementation stub:

- Keep the formula-term evidence container mounted in Tuning mode.
- Render stable term cells for current, stale, and waiting states.
- Add visible and machine-testable state markers, for example
  `data-formula-evidence-status="current|stale|waiting"` on the shell and/or
  term cells.
- If using last-known values during stale state, label them as stale and ensure
  validation proves they are not presented as current.
- Add focused validation that proves:
  - the `formula-term-evidence` shell remains present in current, stale, and
    waiting states;
  - stale runtime edits do not collapse the evidence grid;
  - waiting/no-source states keep the same shell and term-cell structure;
  - current evidence still shows real `computeLinkBudget()` terms;
  - existing Phase 7B SINR display ownership and Phase 9B formula-side grouping
    validation remain passing.

Acceptance:

- The formula-term evidence area no longer disappears or causes a large layout
  jump during stale/waiting states.
- Users can distinguish current values from stale or waiting evidence.
- The UI remains truthful: stale or placeholder terms are never labeled as
  current formula evidence.
- No runtime behavior changes outside the presentation of formula evidence.

Phase 9D implementation evidence:

- `SignalTuningPanel` keeps `formula-term-evidence` mounted for `current`,
  `stale`, and `waiting` evidence states.
- The shell and term cells expose `data-formula-evidence-status` with the
  state value, and the ten conceptual cells stay present across all states.
- Current cells show `LinkBudgetTerms` from the live `computeLinkBudget()` path;
  stale cells show last-known values only with stale labeling; waiting cells
  show per-term placeholders.
- `npm run validate:phase9d:formula-evidence-stability` covers current, stale,
  and waiting SSR states. Phase 7B SINR ownership and Phase 9B formula-side
  grouping validations remain part of the relevant validation set.

Phase 9D validation evidence:

- Controller reconciliation reran
  `npm run validate:phase9d:formula-evidence-stability`; it passed.
- Controller reconciliation reran
  `npm run validate:phase9b:power-noise-separation`; it passed, confirming
  formula-side grouping still holds after the evidence-stability change.
- Executor-reported regression validation passed for Phase 7B, Phase 8B, Phase
  1A, Phase 5B, lint, and build. Build retained only the existing Vite
  large-chunk warning.
- No dev server or browser automation was started for Phase 9D.

Phase 9D closure:

- Phase 9D is accepted with no SDD deviations.
- The `Formula term evidence` shell now remains mounted across current, stale,
  and waiting states, preserving the same ten conceptual term cells.
- Phase 9D has no remaining work.

#### Phase 9E: Formula Map / G^R Placement Plan

This is an SDD-only planning slice for clarifying the visual arrangement of the
SINR formula controls after Phase 9A. It does not approve runtime
implementation by itself.

Current issue:

- Phase 9A correctly separates numerator signal-power controls from denominator
  thermal-noise controls, but its `Signal Power` group can still make `G^R`
  look like it belongs inside `P_t` rather than as a separate receiver-side term.
- `G^R` is mathematically part of the numerator, but it is not a transmit-power
  control and it is not part of `G^T`.
- A visually tidy two-row layout that places `G^R` beside `I` and `σ²` would be
  misleading because `I^a / I^b` and `σ²` are denominator terms.

Phase 9E formula-map decision:

- Use a formula-map layout or equivalent visual hierarchy that first separates
  numerator from denominator:
  - `Numerator / Signal Path`: `P_t`, `H/L`, `G^T`, `G^R`;
  - `Denominator / Impairments`: `I^a + I^b`, `σ²`.
- `G^R` must be an independent numerator tile / group, not nested inside `P_t`
  copy and not visually grouped with denominator terms.
- `G^R` copy must continue to state that it is a receiver / UE gain
  `Research Override` / teaching control, not a HOBS paper-backed parameter.
- `G^T` remains the transmit antenna / satellite beam gain group. Do not merge
  `G^R` into `G^T`; they are separate formula factors and separate runtime
  fields.
- If horizontal space is limited, the numerator can wrap as a 2x2 grid:
  `P_t`, `H/L`, `G^T`, `G^R`. The denominator should remain visually below or
  otherwise clearly separated from the numerator.

Recommended visual order:

```text
Numerator / Signal Path
P_t  ->  H/L  ->  G^T  ->  G^R

Denominator / Impairments
I^a + I^b        σ²
```

Compact fallback:

```text
Numerator / Signal Path
P_t        H/L
G^T        G^R

Denominator / Impairments
I^a+I^b    σ²
```

Reset / state contract:

- Phase 9F UI regrouping should not change runtime math.
- `P_t`, `H/L`, `G^T`, `G^R`, `I^a / I^b`, and `σ²` controls keep their
  existing field wiring, ranges, defaults, and stale-evidence behavior.
- No handover reset is required for this presentation change.
- No replay reset, orbit trajectory-cache rebuild, DPC bucket reset, handover
  policy reset, or beam hopping scheduler reset is allowed.

Non-goals:

- No SINR formula math changes.
- No new runtime parameters.
- No changes to `G^R` runtime semantics or range.
- No changes to `G^T` runtime semantics or range.
- No handover algorithm or handover policy changes.
- No orbit, range, shell, trajectory-cache, or observer changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain behavior change beyond presentation.
- No editable TR 38.811 environment selector.
- No profile selector, policy-family selector, or formula-family switching UI.
- No SDD status change; this document remains `Status: Proposed`.

Phase 9F implementation stub:

- Add or refactor the SINR Formula surface so users can see the formula-map
  ownership: numerator signal path above/separate from denominator impairments.
- Ensure `G^R` is rendered as its own numerator tile / group with independent
  `Research Override` copy.
- Ensure `G^R` is not visually grouped under `P_t`, not merged into `G^T`, and
  not placed with `I^a / I^b` or `σ²`.
- Preserve Phase 9A's `P_t` / `σ²` separation and Phase 9C's formula-term
  evidence stability requirements if those implementations have landed.
- Add focused validation that proves:
  - numerator map includes `P_t`, `H/L`, `G^T`, and independent `G^R`;
  - denominator map includes `I^a + I^b` and `σ²`;
  - `G^R` carries `Research Override` / receiver / UE gain copy;
  - `G^R` is not inside the `P_t` control group and not in the denominator map;
  - existing Phase 4B receiver-gain, Phase 7B SINR display ownership, Phase 9A
    formula-side separation, and Phase 9C evidence stability validations remain
    passing where implemented.

Acceptance:

- A user can scan the formula surface and identify the numerator path as
  `P_t -> H/L -> G^T -> G^R`.
- A user can identify denominator impairments as `I^a + I^b` and `σ²`.
- `G^R` reads as an independent receiver-side numerator Research Override, not
  as transmit power, transmit antenna gain, or denominator impairment.
- No runtime behavior changes outside formula-map presentation.

Phase 9F implementation evidence:

- `SignalTuningPanel` now renders a SINR formula map with numerator / signal
  path tiles for `P_t`, `H/L`, `G^T`, and independent `G^R`.
- The denominator / impairments map renders separate tiles for `I^a + I^b` and
  `σ²`.
- `G^R` carries receiver / UE gain and `Research Override` / teaching-control
  copy, and is not nested under `P_t`, merged into `G^T`, or placed in the
  denominator map.
- The implementation preserved existing control wiring, ranges, defaults,
  SINR math, stale-evidence behavior, and handover / orbit / scheduler
  behavior.
- Focused validation exists as `npm run validate:phase9f:formula-map`; executor
  evidence reports Phase 4B, Phase 7B, Phase 9B, Phase 9D, lint, and build
  checks passing with no SDD deviations.

Phase 9F closure:

- Phase 9F is accepted with no SDD deviations.
- Phase 9F has no remaining work.

#### Phase 9G: Coverage Audit Demotion Plan

This is an SDD-only planning slice for demoting the always-visible
`Coverage audit` block at the bottom of the Tuning-mode SINR Formula surface.
It does not approve runtime implementation by itself.

Current issue:

- `SignalTuningPanel` still renders a permanent `Coverage audit` block after
  the SINR formula controls.
- The block was useful earlier as a controller / executor audit aid while
  `G^R`, path-loss overrides, and fixed terms were being clarified.
- After Phases 4, 8, and 9, the same information is now mostly represented by
  dedicated controls, formula-map ownership, Research Override copy,
  Diagnostics, or docs.
- As a permanent bottom block, it reads like workflow UI even though it is
  mostly static documentation. It also competes with the primary Tuning task:
  changing controls and reading formula evidence.

Phase 9G UX decision:

- Do not show `Coverage audit` as an always-visible Tuning-mode block.
- Preferred behavior:
  - Presentation: hidden.
  - Tuning: hidden by default or collapsed behind a low-emphasis
    `Coverage / assumptions` disclosure.
  - Diagnostics: allowed as read-only coverage / assumptions summary.
- If retained in Tuning as a collapsed disclosure, it must be visually lower
  priority than formula map, formula controls, formula evidence, and active
  overrides.
- The information may remain available, but it should not be part of the main
  scan path for every tuning action.
- Do not remove the underlying documentation from
  `docs/sinr-runtime-parameter-contract.md`; the change is UI placement /
  prominence only.

Placement / content contract:

- The demoted summary may include:
  - current adjustable formula groups;
  - `G^R` advanced / sensitivity copy, with provenance details only if the
    summary is Diagnostics-oriented;
  - path-loss advanced / sensitivity or model-assumption copy;
  - fixed / future-only assumptions such as `antenna.efficiency` and TR 38.811
    environment.
- The summary must not duplicate full formula controls or make fixed/future
  assumptions look editable.
- If moved to Diagnostics, it should be read-only and should not expose editable
  controls.

Reset / state contract:

- Phase 9H UI demotion should not change runtime math.
- No signal tuning state, profile state, reset key, evidence key, handover
  state, DPC bucket state, replay clock, orbit cache, or scheduler state should
  change.

Non-goals:

- No SINR formula math changes.
- No new runtime parameters.
- No changes to formula source ownership from Phase 7B.
- No changes to `G^R`, path-loss override, or noise control behavior.
- No handover algorithm or handover policy changes.
- No orbit, range, shell, trajectory-cache, or observer changes.
- No beam hopping scheduler changes.
- No DPC editable controls.
- No receiver gain behavior change.
- No editable TR 38.811 environment selector.
- No profile selector, policy-family selector, or formula-family switching UI.
- No SDD status change; this document remains `Status: Proposed`.

Phase 9H implementation stub:

- Remove the always-visible bottom `Coverage audit` block from the primary
  Tuning SINR Formula scan path.
- Either:
  - hide it from Tuning entirely and move/keep equivalent read-only facts in
    Diagnostics; or
  - convert it to a collapsed, low-emphasis `Coverage / assumptions`
    disclosure after the primary formula surface.
- Update any validation that currently requires `sinr-coverage-audit` to render
  after formula tabs. That old assertion no longer represents the intended UX.
- Add focused validation that proves:
  - `Coverage audit` is not always visible in the primary Tuning scan path;
  - the demoted summary, if present, is collapsed or Diagnostics-only;
  - advanced / sensitivity copy for `G^R` and path-loss values still exists in
    primary controls, with paper/source provenance limited to Diagnostics or
    docs by Phase 10A;
  - existing Phase 6C handover-policy placement, Phase 7B SINR display
    ownership, Phase 9B formula-side separation, Phase 9D evidence stability,
    and Phase 9F formula-map placement validations remain passing where
    implemented.

Acceptance:

- The main Tuning SINR Formula surface no longer ends with a permanent static
  `Coverage audit` block.
- Users can still find coverage / assumptions information when needed, but it is
  not competing with active tuning and evidence workflows.
- No runtime behavior changes outside UI placement / prominence of the coverage
  summary.

Phase 9H implementation evidence:

- The always-visible `Coverage audit` block was removed from the Tuning-mode
  SINR Formula scan path.
- Coverage / assumptions facts remain available behind a collapsed,
  low-emphasis, read-only disclosure after the active formula controls.
- Presentation remains hidden for coverage audit content, and no editable
  assumptions or new tuning parameters were added.
- The implementation updated the older Phase 6 placement validation so it no
  longer expects a permanent coverage-audit block after the formula tabs.
- Focused validation exists as
  `npm run validate:phase9h:coverage-audit-demotion`; executor evidence reports
  Phase 9D, Phase 9B, Phase 8B, Phase 7B, Phase 6C, Phase 9F, lint, and build
  checks passing, with only the existing Vite large-chunk warning.

Phase 9H reconciliation note:

- Phase 9H is accepted with no Phase 9G SDD deviations.
- The Phase 9H implementation still preserves older user-visible provenance
  copy such as `Research Override` and `HOBS paper` in primary Tuning-adjacent
  surfaces and validation assertions. That is not a Phase 9H placement
  deviation, but Phase 10A supersedes that user-facing copy. Phase 10B must
  update those labels and validations.
- Phase 9H has no remaining placement work.

### Phase 10: User-Facing Research Provenance Copy Demotion

#### Phase 10A: User-Facing Paper Copy Demotion Plan

This is an SDD-only planning slice for separating internal research provenance
from user-facing simulator copy. It supersedes earlier user-visible copy
requirements that asked primary UI surfaces to say `HOBS`, `paper-backed`,
`non-paper`, or `Research Override`, but it does not remove those distinctions
from SDD / runtime-contract documentation.

Current issue:

- Earlier phases intentionally used provenance-heavy copy to prevent executor
  agents from presenting simulator assumptions as sourced paper parameters.
- That guardrail is useful in SDD, validation, and Diagnostics, but it is too
  verbose and too paper-centric for normal simulator users.
- Users see the product as a simulator, not as a paper-comparison tool. Terms
  such as `HOBS`, `paper-backed`, `non-paper`, and `Research Override` create
  avoidable cognitive load in Presentation and Tuning mode.
- `G^R` is the clearest example: the control should read as a receive-side gain
  parameter, not as a warning about a missing HOBS table value.

Phase 10A copy decision:

- User-facing Presentation and primary Tuning surfaces should use
  simulator-native language.
- The primary scan path should prioritize editable controls, current values,
  short effect labels, and simulator-native status labels. Detailed
  provenance, source caveats, and claim-boundary explanations belong in
  collapsed disclosures, Diagnostics, SDDs, contract docs, or validators.
- Do not show the following provenance terms in primary user workflows:
  - `HOBS`;
  - `paper-backed`;
  - `paper table`;
  - `non-paper`;
  - `Research Override`;
  - paper IDs or paper/source caveats.
- Replace provenance-heavy labels with neutral simulator labels:
  - `Research Override` -> `Advanced parameter` or `Sensitivity control`;
  - `paper-backed formula control` -> `Formula parameter`;
  - `non-paper assumption` -> `Model assumption`;
  - `HOBS SINR Tuning` -> `SINR Formula Tuning` or `SINR Model Tuning`.
- Keep formula notation where useful. Symbols such as `G^R`, `P_t`, `G^T`,
  `H/L`, `I^a`, `I^b`, and `σ²` remain appropriate because they help users map
  controls to the formula.

`G^R` user-facing copy contract:

- Preferred label: `Receiver gain (G^R)` or `Terminal receiver gain (G^R)`.
- Preferred helper text: `Receive-side antenna gain in the SINR signal path.`
- Preferred classification: `Advanced parameter` or `Sensitivity control`.
- Do not show user-facing copy that says the HOBS paper parameter table does
  not provide a receiver / UE gain value.
- Do not call `G^R` a `Research Override` in primary Tuning UI.
- Do not remove the internal classification: SDD and
  `docs/sinr-runtime-parameter-contract.md` may continue to classify `G^R` as
  an approved research / simulator sensitivity parameter rather than a sourced
  paper value.

Mode contract:

- Presentation:
  - no paper/source/provenance jargon;
  - no `HOBS`, `paper-backed`, `non-paper`, or `Research Override` copy.
- Tuning:
  - primary controls use simulator-native labels and short effect text;
  - advanced / sensitivity labels are allowed;
  - paper/source caveats and detailed claim-boundary copy should not be part
    of the normal scan path.
- Diagnostics:
  - may show read-only provenance in a low-priority `Model source` /
    `Assumptions` area;
  - must not make provenance notes look like editable controls;
  - should keep any paper/source wording clearly secondary to runtime evidence.
- SDD / contract / validation:
  - keep internal provenance distinctions so executor agents do not broaden
    source claims or convert assumptions into sourced parameters.

Affected copy surfaces for Phase 10B:

- `G^R` control / formula-map tile / formula evidence copy.
- `HOBS SINR Tuning` or equivalent page headings.
- Loss-tab Research Override labels for atmospheric zenith loss, scintillation
  scale, shadow-fading margin, and TR 38.811 NLoS clutter.
- Coverage / assumptions summaries introduced or demoted by Phase 9H.
- Any validation assertions that require user-visible `Research Override`,
  `HOBS paper`, `paper-backed`, or `non-paper` copy in primary Presentation or
  Tuning surfaces.
- In particular, `validate:phase9h:coverage-audit-demotion` currently preserves
  the old provenance-heavy copy and must be updated in Phase 10B.

Reset / state contract:

- Phase 10B is copy / IA only.
- No signal tuning values, profile values, reset keys, stale-evidence behavior,
  handover state, DPC bucket state, replay clock, orbit cache, or scheduler
  state should change.
- Existing runtime parameter classifications remain unchanged.

Non-goals:

- No SINR formula math changes.
- No new runtime parameters.
- No changes to `G^R`, path-loss override, noise, handover, DPC, receiver-gain,
  orbit, range, trajectory-cache, shell, or scheduler behavior.
- No profile selector, policy-family selector, or formula-family switching UI.
- No deletion of paper/provenance language from this SDD or from
  `docs/sinr-runtime-parameter-contract.md`.
- No SDD status change; this document remains `Status: Proposed`.

Phase 10B implementation stub:

- Remove paper-centric copy from primary Presentation and Tuning UI surfaces.
- Update `G^R` user-facing copy to `Receiver gain (G^R)` / receive-side gain /
  `Advanced parameter` or `Sensitivity control`.
- Rename `HOBS SINR Tuning`-style headings to simulator-native headings such as
  `SINR Formula Tuning` or `SINR Model Tuning`.
- Replace visible `Research Override` labels in primary controls with
  `Advanced parameter`, `Sensitivity control`, or `Model assumption`, while
  preserving internal validation coverage that the fields are not represented
  as sourced paper values.
- Keep low-priority provenance available only in Diagnostics or demoted
  assumptions summaries where appropriate.
- Update focused validations so they assert simulator-native user copy and no
  primary-surface paper jargon, while retaining internal/source guardrail
  assertions where needed.

Acceptance:

- A non-paper-aware user can use Presentation and Tuning without encountering
  `HOBS`, `paper-backed`, `non-paper`, or `Research Override` in the primary
  workflow.
- `G^R` reads as a normal receive-side simulator parameter and remains
  formula-correct as an independent numerator term.
- Advanced controls still communicate that they are sensitivity / model
  parameters without invoking paper provenance.
- Diagnostics or docs still preserve enough provenance for executor agents and
  technical reviewers to distinguish sourced formula parameters from simulator
  assumptions.
- No runtime behavior changes outside user-facing copy and placement.

Phase 10B partial implementation evidence:

- A direct user-requested UI change split `G^R` out of the former
  `Signal Power` / `P_t` control surface.
- The SINR Formula control tabs now separate the numerator controls as:
  `Transmit Power` for `P_t`, `Transmit Gain` for `G^T`, and `Receiver Gain`
  for `G^R`.
- The `Receiver Gain` tab owns the `G^R` slider and labels it as receive-side
  antenna gain in the SINR signal path.
- The implementation preserved the existing `ueAntenna.maxGainDbi` field
  wiring, range, defaults, evidence-stale behavior, reset behavior, and SINR
  math.
- Focused validation was updated so it now rejects `G^R` inside the transmit
  power controls and verifies the dedicated receiver-gain tab.
- This is not full Phase 10B closure: broader user-facing paper/provenance copy
  cleanup remains open for other primary controls, especially Loss-tab copy.

Phase 10C control-first status checkpoint:

- Current copy direction is control-first, not provenance-first. The primary
  Presentation and Tuning paths should make simulator controls, current values,
  and runtime status scannable before any research-source explanation.
- Detailed provenance and claim-boundary copy remains required internally, but
  should be collapsed or moved to Diagnostics / docs-level surfaces unless it
  is a concise safety label needed to prevent an unsupported visible claim.
- MODQN replay evidence labels may remain visible when they are short boundary
  labels, but long-form artifact provenance, producer limitations, and
  forbidden-claim detail should not dominate the primary scan path.
- This status does not delete or weaken provenance guardrails in this SDD,
  `docs/sinr-runtime-parameter-contract.md`, MODQN phase docs, validation
  scripts, or Diagnostics-level read-only surfaces.
- No runtime, SINR, handover, replay, scene, sidebar, or artifact behavior is
  authorized by this Phase 10C status note.

Risks / open questions:

- Phase 8B resolved the runtime field-name question by aligning final names
  with `docs/sinr-runtime-parameter-contract.md`.
- `f_c` currently affects FSPL in `path-loss.ts`; making gas or scintillation
  truly frequency-dependent would be a separate SINR math change and is not
  approved by Phase 8A.
- Editable TR 38.811 environment selection may invalidate pending target,
  smoothing, and recent-HO evidence more strongly than scalar Loss overrides.
  It remains a future Simulation Setting question.

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
  already implemented / validated. `G^R` must not be described internally as a
  paper-backed parameter; default remains `0 dBi`. Phase 10 supersedes the
  older primary-UI requirement to state the HOBS paper-table caveat inline:
  keep that caveat in docs, validation, or Diagnostics-level provenance.
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
- Phase 6A records the handover policy research-control plan: `handover.*`
  controls may become editable only in an independent Tuning-mode
  `Handover Policy` tab / page, not in the `HOBS SINR Tuning` page body or
  SINR formula tabs; Phase 6B implements draft/apply/reset-to-defaults
  behavior, reset-on-apply handover state handling, and the required
  `Handover attach threshold` copy for `handover.sinrThresholdDb`; Phase 6C
  corrects the independent-tab placement and hardens validation so the controls
  cannot be confused with SINR formula controls or DPC
  `beamPowerControl.sinrThresholdDb`.
- Phase 7B resolves Tuning-mode SINR display ownership: the right `InfoPanel`
  is the operational SINR status owner, while the left `SignalTuningPanel`
  labels SINR as selected-source formula result and emphasizes formula-term
  evidence over the final SINR value.
- Phase 8A records the path-loss / `H` control plan: existing `f_c` and
  `L_{fs}` / `L_g` / `L_{sc}` / `L_{sf}` toggles remain paper-facing Loss
  controls, hard-coded gas / scintillation / shadow / NLoS clutter constants may
  be promoted only as clearly labeled Research Overrides, TR 38.811 environment
  remains a Simulation Setting rather than Loss tuning, orbit truth / range are
  excluded from Loss controls, and Phase 8B must use next-frame recompute plus
  stale formula-frame clearing without handover reset for Loss-only edits.
- Phase 8B implements the path-loss / `H` Research Overrides under
  `SINR Formula > Loss`: gas zenith loss, scintillation scale, deterministic
  shadow-fading margin, and TR 38.811 NLoS clutter are editable as non-paper
  sensitivity controls, while `TR 38.811 LoS environment` remains read-only and
  future-only as a Simulation Setting.
- Phase 8C records the `L_{cl,NLoS}` gating UX correction: the control remains
  editable only in `hobs-tr38811`, but legacy profiles must show clear
  TR 38.811-only inactive copy rather than a normal disabled slider that looks
  broken or unexplained.
- Phase 8D supersedes the legacy-profile visible inactive treatment from
  Phase 8C: while normal profile access is hidden, `L_{cl,NLoS}` should be
  hidden entirely in legacy profiles and shown only when the active profile is
  `hobs-tr38811`.
- Phase 8D is implemented and validated: the default legacy UI hides
  `L_{cl,NLoS}` entirely, `hobs-tr38811` preserves the editable control, and
  the remaining question is whether a future phase should expose explicit
  TR 38.811 profile / formula-family access.
- Phase 9A records the `P_t` / `σ²` formula-side separation plan: numerator
  signal-power controls and denominator thermal-noise controls should no longer
  be presented as one semantic `Power` group, even if the final UI keeps a
  compact tab structure.
- Phase 9C records the formula-term evidence stability plan: the evidence shell
  should stay mounted in current, stale, and waiting states, with truthful state
  labels instead of removing the grid and causing a layout jump.
- Phase 9D implements and validates formula-term evidence stability: current,
  stale, and waiting states keep the same mounted shell and ten conceptual term
  cells, with stale or placeholder values clearly labeled.
- Phase 9E records the formula-map / `G^R` placement plan: `G^R` should be an
  independent receiver-side numerator tile in the signal path, not nested under
  `P_t`, not merged into `G^T`, and not grouped with denominator terms.
- Phase 9F implements and validates the formula map: numerator / signal path is
  shown as `P_t -> H/L -> G^T -> G^R`, denominator / impairments are shown as
  `I^a + I^b` and `σ²`, and `G^R` remains an independent receiver / UE gain
  tile. Phase 10A supersedes the user-facing `Research Override` wording while
  preserving the internal provenance classification.
- Phase 9G records the Coverage audit demotion plan: the static coverage /
  assumptions summary should no longer be an always-visible bottom block in the
  primary Tuning SINR Formula scan path; it should be hidden, collapsed, or moved
  to read-only Diagnostics.
- Phase 9H implements and validates Coverage audit demotion: Tuning no longer
  shows a permanent bottom `Coverage audit` block and instead keeps coverage /
  assumptions behind a collapsed, low-emphasis, read-only disclosure. Phase 10A
  supersedes any provenance-heavy copy that Phase 9H preserved.
- Phase 10A records the user-facing paper-copy demotion plan: primary
  Presentation and Tuning surfaces should use simulator-native copy, avoid
  `HOBS`, `paper-backed`, `non-paper`, and `Research Override` jargon, and
  present `G^R` as `Receiver gain (G^R)` / receive-side signal-path gain while
  keeping source/provenance distinctions in SDD, contract docs, validation, and
  optional low-priority Diagnostics.
- Phase 10B has a partial direct implementation for receiver-gain IA:
  `G^R` now has a dedicated `Receiver Gain` tab, separate from `P_t` /
  `Transmit Power` and `G^T` / `Transmit Gain`. Broader paper/provenance copy
  cleanup remains open.
- Phase 10C records the control-first copy status: primary Presentation and
  Tuning should prioritize simulator-native controls, values, and labels, while
  detailed provenance and claim-boundary text remains collapsed or
  Diagnostics/docs-level. Internal provenance guardrails remain required.

## Open Questions

- Editable DPC remains future-only: what additional teaching acceptance
  criteria, reset behavior, and validation evidence would be required before a
  separate `TR 38.811`-gated research power-policy editing surface could be
  reconsidered?
- Should a future DPC parity slice add per-satellite `Pmax` normalization or
  wider energy-model coupling before any editable UI is exposed?
- Should TR 38.811 LoS environment ever become editable, and if so should it
  live in a separate Simulation Settings page with draft/apply and handover
  reset semantics rather than in `SINR Formula > Loss`?
