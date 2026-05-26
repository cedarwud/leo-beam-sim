# SINR Runtime Parameter Contract

## Status
Accepted

## Purpose

This document is the repo-local contract for the shipped and future left-side
runtime tuning panel for the SINR path.

Use this file before:

- adding user-adjustable SINR controls
- naming UI labels for paper-facing parameters
- deciding whether a parameter may change live at runtime
- deciding whether a parameter belongs to SINR, handover, beam hopping, or
  research-only overrides

The goal is to keep paper-facing UI labels mathematically correct while still
mapping cleanly onto the current engineering implementation.

## Authority

For this topic, use the following order:

1. source paper notation and equations
2. this contract
3. current implementation in:
   - `src/engine/signal/link-budget.ts`
   - `src/engine/signal/path-loss.ts`
   - `src/engine/signal/beam-gain.ts`
   - `src/engine/signal/power-control.ts`
   - `src/scene/useSimulation.ts`
   - `src/scene/MainScene.tsx`

If a control has no verified paper symbol yet, do not invent one for the main
UI label. Mark it as a `Research Override` or `Simulation Setting` until a paper
source is cited.

## Current Live SINR Path

The current implementation computes per-beam link quality using the HOBS-shaped
outer ratio:

- `γ = P_t · H · G^T · G^R / (I^a + I^b + σ²)`

Earlier UI drafts used `S` as a shorthand for the desired received signal term.
Do not use `S` as the primary formula in the front end unless screen space is
severely constrained. The default paper-facing UI should show the expanded
numerator so users can see where tunable parameters enter the formula.

The current code path is:

1. beam center to UE distance -> off-axis angle
2. off-axis angle + beam pattern -> beam gain
3. steering angle -> steering loss
4. range + frequency + enabled path-loss components -> path loss
5. transmit power + gain - losses -> `RSRP`
6. co-frequency active beams -> intra/inter-satellite interference
7. signal / interference + noise -> `SINR`

Implementation references:

- `src/engine/signal/link-budget.ts`
- `src/engine/signal/path-loss.ts`
- `src/engine/signal/beam-gain.ts`
- `src/utils/beamFrequency.ts`

Important current implementation facts:

- UE receive antenna gain is profile-backed as `ueAntenna.maxGainDbi` and
  defaults to `0 dBi` to preserve the pre-override numeric behavior.
- `G^R` / `ueAntenna.maxGainDbi` is an approved bounded research override /
  teaching control only. It is not a paper-backed HOBS parameter because the
  HOBS paper parameter table does not provide a receiver / UE antenna gain
  value.
- `TR 38.811` LoS environment remains read-only / profile-defaulted to
  `suburban` in Phase 8B.
- NLoS clutter loss is runtime-adjustable as a TR 38.811-gated
  `Research Override`, default `20 dB`.
- Gas-loss, scintillation, and deterministic shadow-fading constants are
  runtime-adjustable `Research Override` / teaching controls, with defaults
  matching the pre-Phase-8B hard-coded values.
- `antenna.efficiency` exists in profiles but is not currently used by the live
  SINR calculation.
- The right-side tuning/diagnostics status panel should show the live
  physical-serving SINR readout and current formula terms so users can verify
  that controls feed the calculation without duplicating serving/candidate
  status in the left tuning rail.
- Right-side operational status should be grouped for beginner scanning:
  `Signal snapshot` for serving/candidate state, then `SINR Formula Terms`
  grouped as two-column rows under `Signal path`, `Loss`, and
  `Interference + noise`.
- The UI should expose the current serving formula terms:
  `P_t · H · G^T · G^R`, `I^a`, `I^b`, and `σ²`. A parameter can be wired
  correctly even when the final SINR barely moves, for example when thermal
  noise is far below co-channel interference.

## UI Labeling Contract

When a parameter is exposed in the front end:

1. The primary label must use paper-facing notation when the notation is
   verified.
2. The secondary label may use human-readable text.
3. The engineering field name must not be shown as the primary label.
4. Units must be explicit.
5. If the parameter is not part of the paper formula itself, label it as
   `Research Override` or `Simulation Setting`.

Recommended UI pattern:

- primary label: math symbol such as `f_c`, `P_t`, `N_0`, `θ_3dB`
- secondary label: short explanation such as `Carrier frequency`
- tooltip/help text: code path, unit, and paper note
- parameter groups should follow the SINR formula, not the internal profile
  object shape

Bad examples:

- `frequencyGHz`
- `maxTxPowerDbm`
- `noisePsdDbmHz`

Good examples:

- `f_c` — Carrier frequency
- `P_t` — Per-beam transmit power
- `N_0` — Noise power spectral density

## Formula-Guided Tab Model

The left-side runtime UI should stay compact by grouping controls directly under
the HOBS SINR expression according to where each parameter enters the formula:

- `Power`: controls numerator transmit power. This tab owns `P_t`.
- `Loss`: controls path gain / path loss `H` and `L`. This tab owns `f_c`,
  `L_{fs}`, `L_g`, `L_{sc}`, `L_{sf}` toggles, and a separated
  `Research Override` section for simulator sensitivity constants.
- `Beam`: controls the transmit antenna pattern and scan loss `G(θ)` /
  `L_{scan}`. This tab owns `θ_{3dB}`, `G(θ)`, `θ_{max}`, and
  `L_{scan,max}`.
- `Receiver`: controls the receive-side numerator gain `G^R`.
- `Interference`: controls co-channel interference terms `I^a` and `I^b`.
  This tab owns the frequency reuse factor `K`.
- `Noise`: controls the thermal-noise term `σ²`. This tab owns `B`, `N_0`,
  and the read-only computed noise-floor evidence.

Each tab should include:

- the local formula fragment it controls
- one short explanation of when the user should adjust that group
- per-control impact text that explains the qualitative effect of increasing
  or decreasing the value
- compact controls directly under the formula tab row
- visible `Min ...` and `Max ...` endpoint labels around every slider

The current formula-term inspector belongs in the right-side tuning/diagnostics
status panel. Do not place a long live formula-term grid above the editable tab
controls in the left rail.

Do not add new controls by appending them to a long single-column list. Place
them in the tab that corresponds to their formula term. If no formula term is
clear, classify the control as a `Research Override` or `Simulation Setting`
instead of adding it to the paper-facing tabs.

## Current Coverage

The current V1 panel covers every profile-backed field that directly feeds the
live `computeLinkBudget()` path:

- `P_t`: `channel.maxTxPowerDbm`
- `H` / `L`: `channel.frequencyGHz`, `channel.pathLossComponents`,
  `channel.lossOverrides.*`, and `channel.tr38811.nlosClutterLossDb`
- `G^T`: `antenna.maxGainDbi`, `antenna.beamwidth3dBRad`,
  `antenna.model`, `antenna.maxSteeringAngleDeg`,
  `antenna.scanLossAtMaxSteeringDb`
- `G^R`: `ueAntenna.maxGainDbi`, default `0 dBi`, approved only as a bounded
  research override / teaching control
- `I^a` / `I^b`: `beams.frequencyReuse`
- `σ²`: `channel.bandwidthMHz`, `channel.noisePsdDbmHz`

Fields still not covered by V1 are intentionally excluded because they are not
currently profile-backed live controls in the SINR path:

- TR 38.811 environment: read-only / profile-defaulted to `suburban`
- `antenna.efficiency`: profile field exists but is not used by the live SINR
  calculation
- `formulaFamily`: research / mode control rather than a scalar paper-facing
  formula parameter
- `beamPowerControl.*`: a DPC policy surface that can override effective
  per-beam `P_t`; it should be promoted as a separate research-control group
  only after the UI owns reset semantics and paper-symbol mapping

## V1 Paper-Facing Runtime Controls

These are the recommended first-wave controls for a live SINR panel.

| Primary label | Human label | Internal field | Unit shown in UI | Recommended control | Safe UI range | Runtime effect | Notes |
|---|---|---|---|---|---|---|---|
| `f_c` | Carrier frequency | `channel.frequencyGHz` | GHz | slider / numeric input | `10` to `40` | next-frame recompute | feeds FSPL and composite path loss |
| `B` | Channel bandwidth | `channel.bandwidthMHz` | MHz | slider / numeric input | `5` to `400` | next-frame recompute | feeds `σ²` through `N = N_0 + 10log10(B)` |
| `P_t` | Per-beam transmit power | `channel.maxTxPowerDbm` | dBm | slider / numeric input | `30` to `60` | next-frame recompute | base Tx power before any DPC override |
| `N_0` | Noise PSD | `channel.noisePsdDbmHz` | dBm/Hz | slider / numeric input | `-180` to `-160` | next-frame recompute | directly changes noise floor |
| `G_{t,max}` | Max transmit gain | `antenna.maxGainDbi` | dBi | slider / numeric input | `20` to `60` | next-frame recompute | directly shifts received signal power |
| `θ_{3dB}` | 3 dB beamwidth | `antenna.beamwidth3dBRad` | degrees in UI, radians internally | slider / numeric input | `1°` to `8°` | recompute + layout-sensitive | affects beam gain pattern and beam footprint geometry |
| `G(θ)` | Beam gain model | `antenna.model` | enum | select | `bessel-j1-j3`, `bessel-j1`, `flat` | next-frame recompute | use paper-facing description, not raw enum as label |
| `θ_{max}` | Max steering angle | `antenna.maxSteeringAngleDeg` | degrees | slider / numeric input | `1°` to `20°` | recompute + layout-sensitive | affects steering-valid beam set and steering loss |
| `L_{scan,max}` | Max scan loss | `antenna.scanLossAtMaxSteeringDb` | dB | slider / numeric input | `0` to `10` | next-frame recompute | feeds steering loss model |
| `K` | Frequency reuse factor | `beams.frequencyReuse` | integer | stepper / select | `1` to `7` | next-frame recompute | changes co-frequency interference grouping |
| `L_{fs}` | Enable FSPL term | `channel.pathLossComponents` includes `fspl` | toggle | checkbox | on/off | next-frame recompute | base path-loss term; normally should remain on |
| `L_g` | Enable atmospheric gas loss | `channel.pathLossComponents` includes `atmospheric` | toggle | checkbox | on/off | next-frame recompute | propagation component |
| `L_{sc}` | Enable scintillation loss | `channel.pathLossComponents` includes `scintillation` | toggle | checkbox | on/off | next-frame recompute | propagation component |
| `L_{sf}` | Enable shadow fading margin | `channel.pathLossComponents` includes `shadow-fading` | toggle | checkbox | on/off | next-frame recompute | deterministic margin in current implementation |
| `L_{g,z}` | Atmospheric zenith loss | `channel.lossOverrides.atmosphericZenithLossDb` | dB | slider / numeric input | `0` to `1` | next-frame recompute | `Research Override`; inactive while `L_g` is off; default `0.1 dB` |
| `L_{sc,scale}` | Scintillation scale | `channel.lossOverrides.scintillationScaleDb` | dB | slider / numeric input | `0` to `1` | next-frame recompute | `Research Override`; inactive while `L_{sc}` is off; default `0.05 dB` |
| `L_{sf,margin}` | Shadow fading margin | `channel.lossOverrides.shadowFadingMarginDb` | dB | slider / numeric input | `0` to `10` | next-frame recompute | deterministic `Research Override`; inactive while `L_{sf}` is off; default `2 dB` |
| `L_{cl,NLoS}` | NLoS clutter loss | `channel.tr38811.nlosClutterLossDb` | dB | slider / numeric input | `0` to `40` | next-frame recompute | TR 38.811-gated `Research Override`; applies only in `hobs-tr38811` and only to seeded NLoS samples; default `20 dB` |

## Approved Research Override / Teaching Control

`G^R` is visible in the HOBS SINR expression, but the HOBS paper parameter
table does not provide a receiver / UE antenna gain value. The simulator may
therefore expose `G^R` only as the bounded override below, not as a
paper-backed parameter.

| UI label class | Internal field | Default | Unit shown in UI | Recommended control | Simulator guardrail | Runtime effect | Paper note |
|---|---|---:|---|---|---|---|---|
| `Research Override` / teaching control | `ueAntenna.maxGainDbi` | `0` | dBi | slider / numeric input | `-10` to `20` | next-frame recompute; shifts `signalDbm` / numerator by the same dB amount | not paper-backed; HOBS parameter table does not provide receiver / UE gain |
| `Research Override` / teaching control | `channel.lossOverrides.atmosphericZenithLossDb` | `0.1` | dB | slider / numeric input | `0` to `1` | next-frame recompute; scales the deterministic gas-loss approximation when `L_g` is enabled | simulator sensitivity value; not a HOBS paper-backed range |
| `Research Override` / teaching control | `channel.lossOverrides.scintillationScaleDb` | `0.05` | dB | slider / numeric input | `0` to `1` | next-frame recompute; scales the deterministic scintillation approximation when `L_{sc}` is enabled | simulator sensitivity value; not a stochastic fading model |
| `Research Override` / teaching control | `channel.lossOverrides.shadowFadingMarginDb` | `2` | dB | slider / numeric input | `0` to `10` | next-frame recompute; adds deterministic margin when `L_{sf}` is enabled | deterministic simulator margin; not a random shadow-fading draw |
| `Research Override` / teaching control, TR 38.811-gated | `channel.tr38811.nlosClutterLossDb` | `20` | dB | slider / numeric input | `0` to `40` | next-frame recompute; applies only when `formulaFamily === 'hobs-tr38811'` and the seeded LoS state is NLoS | assumption-backed suburban clutter proxy, not a full environment/elevation table |

## Research Overrides With No Stable Paper Symbol Mapping Yet

These can still be made adjustable, but they must not be presented as if the
symbol mapping is already verified from the paper set.

| UI label class | Internal field | Why not a primary paper symbol yet | Runtime effect |
|---|---|---|---|
| `G^R` receiver / UE gain | `ueAntenna.maxGainDbi` | HOBS includes `G^R` in the expression, but its parameter table does not provide receiver / UE antenna gain | next-frame recompute; numerator-only teaching override in this simulator |
| `Formula family` | `formulaFamily` | codebase-level mode switch, not one stable scalar parameter | next-frame recompute |
| `Beam power control` | `channel.beamPowerControl.*` | DPC terms exist, but the repo does not yet maintain a verified UI symbol map for every field | next-frame recompute plus DPC state reset recommended |
| `TR 38.811 environment` | `channel.tr38811.environment` | LoS probability table selector rather than one scalar `L` term | read-only / profile-defaulted in Phase 8B; editable selector remains out of scope |

## Parameters That Should Not Be In The SINR Panel

These may still be adjustable elsewhere, but not inside the SINR-parameter UI.

| Area | Internal fields | Why not part of the SINR panel |
|---|---|---|
| Handover policy | `handover.*` | affects target qualification and switching logic, not the SINR formula itself |
| Beam hopping scheduler | `beamHopping.*` | affects which beams are active and therefore available/interfering, but belongs to scheduler control |
| Orbit geometry | `orbit.*` and `shells[]` | changes constellation truth and trajectory cache, not just the link formula. Topology overrides for sat-count / beam-count / UE-count are exposed in a separate `Topology` tab; see Phase E SDD §5 + §9. |

### Topology Overrides (Phase E)

> User vision (recorded in `.agent-memory/project_paper_faithful_vision.md`)
> places sat-count, beam-count, and UE-count overrides inside the
> SINR-mode left sidebar. To satisfy this without reverting the
> formula-tab classification, Phase E ships a `Topology` tab inside
> `SignalTuningPanel` classed as `Simulation Setting`, NOT as a
> paper-facing SINR formula tab. The tab is gated on
> `appMode === 'sinr-experiment'`; it never appears in `modqn-demo`.
>
> Parameters in the Topology tab follow `Simulation Setting` semantics
> (no paper symbol mapping; reset implications documented in
> `docs/phase-e-runtime-overrides-mini-sdd.md` §8).

### Scene Scale (Phase C)

> Phase C adds a second `Simulation Setting` sub-section to the
> `Topology` tab covering visual scale and UE marker size. Like
> Topology, these controls are NOT paper-facing SINR formula
> parameters; they only change the km → world-units rendering
> mapping (`sceneScale`) and the GroundScene marker cylinder
> geometry (`ueMarkerScale`). They do NOT alter SINR, link budget,
> handover decisions, or any physical computation. Replay artifacts
> are rendered with multiplier = 1.0 regardless of the live
> selector (artifacts were baked at paper-faithful scale per
> Phase 7 contract). See Phase C SDD §6 + §8.

### UE Count (Phase F)

> Phase F activates the Phase E DEFERRED `ueCount` field in
> `SceneTopologyState`. The slider sits in the Topology tab alongside
> sat-count and beam-count overrides as a `Simulation Setting`. The
> UE-count override extends the live engine to maintain N independent
> per-UE state vectors with per-UE SINR + per-UE handover state. The
> override is gated on `appMode === 'sinr-experiment'`; in
> `modqn-demo` the paper-faithful 100-UE baseline applies.

### UE Mobility (Phase G)

> Phase G activates per-tick UE position update so secondary UEs move
> through the primary observer footprint each simulation tick.
> Selector lives in the Topology tab as a `Simulation Setting`
> alongside Phase F sat/beam/UE-count overrides. Modes:
>
> - `static` (default; zero-drift with Phase F).
> - `random-walk` (uniform direction per tick, fixed speed).
> - `waypoints` (per-UE circular waypoint tour).
> - `manhattan` (axis-aligned grid streets).
>
> Replay artifacts continue to consume producer-baked positions
> (mobility values inside artifacts are immutable per Phase 7
> contract). Primary UE remains static for backward compat with
> single-UE narratives.

## Not Yet Wired Or Not Safe To Expose As-Is

| Internal field / behavior | Current state | Guidance |
|---|---|---|
| `antenna.efficiency` | profile field exists but not used in the live SINR path | do not expose until implementation is added |
| `channel.tr38811.environment` | profile/default-backed but read-only in Phase 8B | do not expose an editable environment selector without a separate Simulation Setting plan |

## Runtime Integration Notes For Future Agents

Current architecture is still `profileId -> loadProfile(profileId)`:

- `App.tsx` loads a fixed profile from `selectedProfileId`
- `MainScene.tsx` passes that profile into `useSimulation`
- `useSimulation` recomputes live SINR every frame from the passed profile

For the left-side runtime tuning panel, future agents should:

1. keep a base profile selected by `profileId`
2. maintain a separate runtime override state
3. derive an `effectiveProfile = baseProfile + overrides`
4. pass `effectiveProfile` into `MainScene` / `useSimulation`
5. reset state intentionally when structural parameters change

The handover manager smooths SINR over simulation time. When the scene is
paused (`dt <= 0`), runtime tuning must bypass smoothing for the displayed
sample so formula changes remain visible without advancing handover timers.

Recommended reset policy:

- next-frame recompute only:
  - `frequencyGHz`
  - `bandwidthMHz`
  - `maxTxPowerDbm`
  - `noisePsdDbmHz`
  - `maxGainDbi`
  - `ueAntenna.maxGainDbi`
  - `antenna.model`
  - `scanLossAtMaxSteeringDb`
  - `frequencyReuse`
  - `pathLossComponents`
- recompute plus handover / DPC state reset recommended:
  - `beamwidth3dBRad`
  - `maxSteeringAngleDeg`
  - `formulaFamily`
  - any future `beamPowerControl.*` runtime override
- full trajectory cache rebuild required:
  - `orbit.observerLatDeg`
  - `orbit.observerLonDeg`
  - `orbit.shells[]`

## Future-Agent Rule

If a future agent adds a runtime tuning UI:

1. consult this document first
2. use the paper symbol as the primary label only when verified
3. do not expose raw engineering field names as end-user labels
4. do not mix SINR controls with handover controls in one undifferentiated panel
5. keep a visible distinction between:
   - paper-facing parameters
   - research overrides
   - simulation settings
