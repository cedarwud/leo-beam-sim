# Paper-Faithful Mode Split Mini-SDD

Status: draft for PR-beta / PR-gamma
Date: 2026-05-25
Owner: `leo-beam-sim` visual/UI shell
Target repo: `/home/u24/papers/project/leo-beam-sim`

## 1. Purpose

This SDD anchors the next paper-faithful slices after PR-alpha. It covers:

1. PR-beta: add a paper-faithful MODQN 4-satellite / 7-beam live scene
   profile.
2. PR-gamma: split the app shell into two visible entry points:
   `SINR experiment` and `MODQN demo`.
3. The mode-default profile coupling and localStorage contract needed so each
   entry point reopens on its own last-used profile.
4. The `sceneScale` concept that will later support paper-faithful scale vs
   demo-readability scale.

The goal is to move the product toward the user's core demo vision without
turning `leo-beam-sim` into a second MODQN trainer or research-truth owner.

## 2. Authority and Boundaries

Read before implementing these slices:

1. `AGENTS.md` in this repo.
2. `.agent-memory/project_paper_faithful_vision.md`.
3. `.agent-memory/project_dev_drift_audit_2026-05-25.md`.
4. `docs/modqn-omega-handover-sdd.md` for the current MODQN decision-overlay
   state.
5. `docs/sinr-runtime-parameter-contract.md` for SINR parameter UI labels.

Hard boundaries:

- `leo-beam-sim` owns visual profiles, camera, materials, labels, panels,
  mode selection, profile selection, and demo packaging.
- It does not own MODQN training truth, rewards, selected actions,
  effectiveness claims, replay bundle mutation, or visual-showcase artifact
  validation.
- Replay/offline MODQN truth must continue to come from immutable producer
  artifacts validated through `ntn-sim-core`.
- Live-sim rigor-critical truth must come from existing code or
  vendor-on-demand `ntn-sim-core/src/core` modules; do not rewrite academic
  models locally.
- Do not change `FOOTPRINT_RADIUS_WORLD` in PR-beta.
- Do not fork `MainScene` or duplicate `<scene/>` layer code by mode.

## 3. Current State

Relevant current implementation:

- `src/App.tsx` has a single app shell and stores a `selectedProfileId`.
- `DEFAULT_PROFILE_ID` is `hobs-2024-candidate-rich`.
- `RuntimeHandoverMode` currently has:
  - `sinr-offset`
  - `decision-overlay-on-live-sinr`
  - `omega-heuristic`
- The top `ControlBar` currently exposes the handover mode buttons.
- The sidebars already narrow their tabs by handover mode:
  - SINR path: left `signal` + `handover`; right `live`.
  - MODQN path: left `objective` + `handover`; right `live` + `modqn`.
- `MainScene` is already shared between live and replay paths.
- `FOOTPRINT_RADIUS_WORLD = 56` in `src/scene/beam-geometry-pure.ts`; current
  visuals keep footprint world radius fixed and scale km-to-world from profile
  physical footprint.

## 4. PR-beta: Paper-Faithful 4-Sat Profile

### 4.1 Intent

PR-beta adds a profile for the PAP-2024-MORL-MULTIBEAM baseline topology:

- 4 satellites.
- 7 beams per satellite.
- 100 users in the paper baseline.
- 780 km LEO altitude.
- 20 GHz carrier.
- 500 MHz bandwidth.
- 33 dBm per-beam transmit power.
- 9000 training episodes.

This profile is a live scene/profile surface, not a trainer and not a replay
artifact. It lets the MODQN entry point open on the paper-shaped scene while
future slices wire validated training artifacts and training triggers.

### 4.2 File Shape

Add:

- `src/profiles/modqn-4sat-7beam-paper-faithful.json`

Update:

- `src/profiles/index.ts`
- Any label map that exposes profile names.

Recommended exported id:

```ts
export const MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID =
  'modqn-4sat-7beam-paper-faithful' as const;
```

Recommended label:

```text
MODQN paper-faithful 4-sat 7-beam
```

### 4.3 Profile Values

Profile fields:

| Field | Value | Notes |
|---|---:|---|
| `id` | `modqn-4sat-7beam-paper-faithful` | Stable id for PR-gamma default coupling. |
| `profileClass` | `paper-default` | Do not widen the union unless needed. |
| `formulaFamily` | `hobs-legacy` | Existing live engine family; no new SINR truth in PR-beta. |
| `orbit.shells[0].id` | `modqn-paper-780km` | Stable prefix for generated sat ids. |
| `orbit.shells[0].altitudeKm` | `780` | Paper baseline. |
| `orbit.shells[0].inclinationDeg` | `53` | Current simulator default unless paper source overrides. |
| `orbit.shells[0].planes` | `1` | Produces 4 sats via one shell. |
| `orbit.shells[0].satsPerPlane` | `4` | Total satellites = 4. |
| `orbit.observerLatDeg` | `40` | Keep current observer convention. |
| `orbit.observerLonDeg` | `116` | Keep current observer convention. |
| `antenna.model` | `bessel-j1-j3` | Existing beam-gain model. |
| `antenna.beamwidth3dBRad` | `0.058` | Gives radius `780*tan(0.029)=22.6 km`. |
| `antenna.maxGainDbi` | `40` | Current simulator default if paper source absent. |
| `antenna.maxSteeringAngleDeg` | `12` | Current simulator default if paper source absent. |
| `channel.frequencyGHz` | `20` | Paper baseline. |
| `channel.bandwidthMHz` | `500` | Paper baseline. |
| `channel.maxTxPowerDbm` | `33` | Paper baseline, 2 W. |
| `channel.noisePsdDbmHz` | `-174` | Existing thermal-noise convention. |
| `beams.perSatellite` | `7` | Paper baseline. |
| `beams.maxActivePerSat` | `7` | All seven visible by default. |
| `beams.frequencyReuse` | `3` | Current visual/SINR convention unless paper source overrides. |
| `beamHopping.enabled` | `false` | Do not introduce hopping behavior in PR-beta. |
| `handover.policy` | `sinr-offset` | Existing mechanism; MODQN overlay remains mode-level. |
| `handover.modqnWeights` | `0.4 / 0.3 / 0.3` | Paper-faithful default omega. |
| `handover.modqnNetworkParams.episodes` | `9000` | Paper baseline training length. |

Keep other handover timing fields aligned with the current MODQN / HOBS
defaults unless a cited paper value is available before implementation.

### 4.4 UE Count Handling

PR-beta must not invent a 100-UE live mobility/training truth source.

Allowed:

- Mention `100 UEs` in profile metadata, labels, or sidebar text as a paper
  baseline fact.
- Use existing replay/artifact display filtering for producer-owned multi-UE
  artifacts.

Not allowed in PR-beta:

- Add a local random 100-UE generator and present it as paper truth.
- Derive MODQN load balance, rewards, or action validity from display-only UE
  markers.
- Change live `HandoverManager` semantics to support multi-UE training.

If a later live 100-UE simulator is needed, vendor or validate the relevant
core module first.

### 4.5 PR-beta Acceptance

- `loadProfile('modqn-4sat-7beam-paper-faithful')` succeeds.
- `profileList` exposes the new profile.
- The profile creates four satellites and seven beams per satellite through
  the existing live scene path.
- Carrier, bandwidth, tx power, altitude, beam count, and episode default match
  §4.3.
- No `FOOTPRINT_RADIUS_WORLD` edit.
- No `src/scene/MainScene.tsx` fork or mode-specific scene layer fork.
- `npm run lint` passes for the PR-beta implementation.

## 5. PR-gamma: L1.5 App-Shell Mode Split

### 5.1 Intent

PR-gamma turns the buried handover mode control into two visible app entry
points:

1. `SINR experiment`
2. `MODQN demo`

This is an L1.5 split:

- No `react-router`.
- No URL-state contract.
- No second scene tree.
- No independent MODQN page.
- One shared `MainScene` and one shared rendering pipeline.

### 5.2 New App Mode

Add an app-shell mode type in the UI layer:

```ts
export type AppExperienceMode = 'sinr-experiment' | 'modqn-demo';
```

This is distinct from:

- `UiMode` (`presentation`, `tuning`, `diagnostics`).
- `RuntimeHandoverMode` (`sinr-offset`, `decision-overlay-on-live-sinr`,
  `omega-heuristic`).
- `sceneSource` (`live-sim`, `artifact-replay`).

Mapping:

| App mode | Runtime handover mode | Default profile | Left sidebar | Right sidebar |
|---|---|---|---|---|
| `sinr-experiment` | `sinr-offset` | `hobs-2024-candidate-rich` | `signal`, `handover` | `live` |
| `modqn-demo` | `decision-overlay-on-live-sinr` | `modqn-4sat-7beam-paper-faithful` | `objective`, `handover` | `live`, `modqn` |

`omega-heuristic` stays an internal/dev affordance. It must not become a third
app-shell entry point in PR-gamma.

### 5.3 Shell Layout Contract

Add a slim left vertical mode picker outside the existing left sidebar:

```text
┌ mode rail ┐┌ left sidebar ┐┌ shared MainScene ┐┌ right sidebar ┐
│ SINR      ││ mode content ││ one scene tree   ││ mode content  │
│ MODQN     ││              ││                  ││               │
└───────────┘└──────────────┘└──────────────────┘└───────────────┘
```

Required behavior:

- The active app mode is visible before the user opens any tab.
- Mode switching changes sidebar content and selected/default profile.
- Mode switching resets live sim state through existing profile/reset flows.
- Mode switching does not remount a separate scene implementation.
- The top `ControlBar` should no longer be the primary place where users find
  "MODQN". Keep playback, camera, beam density, callouts, spotlight, HO slow,
  and speed controls there.

Suggested test ids:

- `app-mode-rail`
- `app-mode-sinr-experiment`
- `app-mode-modqn-demo`
- `leo-app-shell[data-app-mode="sinr-experiment"]`
- `leo-app-shell[data-app-mode="modqn-demo"]`

### 5.4 Sidebar Split Contract

Reuse the existing tab content where possible.

SINR experiment:

- Left sidebar starts on `signal`.
- Left sidebar includes `SignalTuningPanel`.
- Left sidebar includes `HandoverPolicyControls`.
- Left sidebar does not show `ModqnObjectiveTab`.
- Right sidebar shows live claim boundary, `InfoPanel`, and
  `DiagnosticsDrawer`.
- Right sidebar does not show MODQN evidence by default.

MODQN demo:

- Left sidebar starts on `objective`.
- Left sidebar includes `ModqnObjectiveTab`.
- Left sidebar includes `HandoverPolicyControls` only if the current
  decision-overlay still needs timing gates exposed.
- Left sidebar does not show the SINR formula tuning panel by default.
- Right sidebar shows live status plus the existing `ModqnEvidenceTab`.
- All MODQN copy must clearly distinguish paper bundle/replay truth from
  live decision-overlay behavior.

Do not add training progress UI, artifact pickers, reward curves, or free
satellite/user-count controls in PR-gamma. Those belong to later phases.

### 5.5 Mode-Default Profile Coupling

Mode controls profile defaults.

Rules:

1. On first app load, read `appMode` from storage.
2. If absent or invalid, default to `sinr-experiment`.
3. Resolve the profile for that app mode:
   - mode-specific stored profile if valid
   - otherwise the mode default in §5.2
4. On app mode switch:
   - persist the outgoing mode's current profile
   - load the incoming mode's stored valid profile or default
   - set the mapped runtime handover mode
   - reset signal tuning, handover tuning, sim state, omega fallback count, and
     auto-slow dismissal through existing reset flows
   - set left/right sidebar active tabs to that mode's defaults
5. On profile change inside a mode, persist only that mode's profile.

The mode-profile relation is default coupling, not a hard lock. Advanced users
may later choose another valid profile inside each mode, and that choice must
not overwrite the other mode's last profile.

### 5.6 localStorage Contract

New keys:

```ts
const APP_MODE_STORAGE_KEY = 'leo-beam-sim.app-mode.v1';
const PROFILE_BY_MODE_STORAGE_KEY =
  'leo-beam-sim.profile-by-app-mode.v1';
```

Recommended shape for `PROFILE_BY_MODE_STORAGE_KEY`:

```json
{
  "sinr-experiment": "hobs-2024-candidate-rich",
  "modqn-demo": "modqn-4sat-7beam-paper-faithful"
}
```

Read behavior:

- If `window` is unavailable, use defaults.
- If JSON parse fails, use defaults.
- If a stored profile id is unknown to `profiles`, ignore it for that mode.
- If `APP_MODE_STORAGE_KEY` is absent, optionally migrate from the existing
  `HANDOVER_MODE_STORAGE_KEY`:
  - `decision-overlay-on-live-sinr` -> `modqn-demo`
  - anything else -> `sinr-experiment`

Write behavior:

- Persist app mode whenever the mode picker changes.
- Persist profile map whenever active mode's profile changes.
- Do not persist `omega-heuristic` as an app mode.
- Keep existing `UI_MODE_STORAGE_KEY` unchanged.

## 6. sceneScale Concept

`sceneScale` is a future renderer-scale policy, not a PR-beta requirement.

Problem:

- Current beam visuals use `FOOTPRINT_RADIUS_WORLD = 56`.
- This keeps beam footprints readable but decouples visual footprint radius
  from paper physical footprint differences.
- For the 780 km / 0.058 rad profile, physical footprint radius is about
  22.6 km, but the rendered footprint radius still appears as 56 world units.

Future concept:

```ts
export type SceneScaleMode = 'paper-faithful' | 'demo-readability';
```

Meaning:

- `demo-readability`: preserve the current visual grammar and keep footprints
  readable for demos.
- `paper-faithful`: make physical footprint / UE / camera scale visibly reflect
  the paper baseline, with explicit camera presets and marker-size safeguards.

Likely future implementation:

1. Add `sceneScale` to a renderer-owned config surface, either profile metadata
   or `RuntimeConfig`.
2. Replace direct `FOOTPRINT_RADIUS_WORLD` reads in `useBeamViz` with a
   resolver that returns a mode-specific `footprintRadiusWorld`.
3. Keep `computeBeamGeometry()` physical km math unchanged.
4. Keep SINR, handover, MODQN actions, rewards, provenance, and replay truth
   unchanged.
5. Add camera/marker presets so `paper-faithful` does not make UEs unreadable.

Explicit non-work for PR-beta / PR-gamma:

- Do not edit `FOOTPRINT_RADIUS_WORLD`.
- Do not add a profile field unless the implementation slice explicitly owns
  sceneScale type plumbing.
- Do not resize replay artifacts or mutate artifact geometry truth.
- Do not claim visual scale equals training truth until a sceneScale slice
  implements and validates it.

## 7. Out of Scope

Not in PR-beta or PR-gamma:

- Phase D training visualization.
- Phase D reward curves, Q-value views, or training-state replay mode.
- Phase E free satellite-count runtime override.
- Phase E free beam-count runtime override.
- Browser-triggered backend training UI.
- Artifact picker.
- 100-UE live training simulator.
- New MODQN policy inference in `leo-beam-sim`.
- `react-router` or URL state.
- NTPU asset changes from PR-alpha.

## 8. Validation Plan for Implementing PRs

PR-beta:

- `npm run lint`.
- Unit/grep check that the new profile id is registered.
- Manual code audit: no `FOOTPRINT_RADIUS_WORLD` diff.
- Manual code audit: no `MainScene` fork.

PR-gamma:

- `npm run lint`.
- Unit tests or focused runtime tests for:
  - default app mode resolution
  - storage fallback on invalid JSON
  - per-mode profile persistence
  - mode switch resets to correct profile and sidebars
  - legacy handover-mode migration if implemented
- Browser smoke can be done in the implementation PR, not while drafting this
  SDD.

## 9. Assumptions to Verify Before PR-beta Merge

- `53 deg` inclination is acceptable for the paper-faithful profile until a
  paper-cited value is loaded.
- `frequencyReuse: 3`, antenna gain `40 dBi`, steering angle `12 deg`, scan
  loss `4 dB`, and current handover timing defaults remain simulator defaults
  where the current memory entry does not provide paper constants.
- The profile's 100-UE baseline is documented but not represented as live
  multi-UE engine truth in PR-beta.

If any assumption is contradicted by paper source or validated producer
artifact data, update the profile spec before implementation rather than
patching display behavior around it.
