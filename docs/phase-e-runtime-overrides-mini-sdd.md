# Phase E Runtime Topology Overrides Mini-SDD

Status: draft for Phase E (post Phase D ship to branches).
Date: 2026-05-25
Owner: `leo-beam-sim` SINR-experiment runtime tuning panel.
Target repo: `/home/u24/papers/project/leo-beam-sim`.
Cross-repo dependencies: NONE for E-S1 / E-S2. E-S3 (UE-count) depends on a live-path multi-UE generator that does not yet exist.

## 0. Reading Order

Read before changing this SDD or starting implementation:

1. `.agent-memory/project_paper_faithful_vision.md` — user vision Phase E
   bullet (`衛星數量 / 波束數量 / ue 數量等等，在 sinr 的分頁也新增這些數量
   可調整`). Phase E is the literal answer to that quote.
2. `.agent-memory/project_dev_drift_audit_2026-05-25.md` Rule 4 — mini-SDD
   釘 priority 才開 slice; this SDD is the priority anchor for Phase E.
3. `docs/sinr-runtime-parameter-contract.md` — the existing SINR runtime
   tuning contract. Phase E AMENDS §"Parameters That Should Not Be In The
   SINR Panel" because the user vision explicitly places sat-count /
   beam-count / UE-count in the SINR tab. See §9 of this SDD.
4. `docs/phase-b-training-pipeline-mini-sdd.md` — structural template for
   this SDD (§0..§15 layout) and reference for the "one slice per PR"
   discipline.
5. `docs/paper-faithful-mini-sdd.md` — Phase A mode-rail context. Phase E
   surfaces only inside the `sinr-experiment` app mode; `modqn-demo`
   keeps the fixed paper-faithful 4-sat 7-beam profile untouched.
6. `CLAUDE.md` §5 (boundaries) and §3 (artifact immutability). Phase E
   does not touch replay artifacts; the topology overrides are live-sim
   only.

## 1. Purpose

User vision verbatim:

> 如果有跟現在不一樣的地方，例如衛星數量、波束數量、ue 數量等等，那就在 sinr 的
> 分頁也新增這些數量可調整

Phase A locked the paper-faithful baseline (4 sats × 7 beams × 100 UEs,
780 km / 20 GHz / 500 MHz / 33 dBm) inside the `modqn-demo` app mode.
Phase E makes the **sinr-experiment** app mode let the user sweep these
structural numbers away from the paper baseline so they can observe how
the live SINR / handover behavior changes when the topology differs.

Concretely Phase E ships:

- A new `Topology` tab inside the existing `SignalTuningPanel`,
  visible only in `sinr-experiment` app mode.
- A `sat-count` runtime override (E-S1) that rewrites
  `effectiveProfile.orbit.shells[0].satsPerPlane` and forces a
  trajectory cache rebuild + simulation reset.
- A `beam-count` runtime override (E-S2) that rewrites
  `effectiveProfile.beams.perSatellite` (+ `maxActivePerSat`) and forces
  a beam layout rebuild.
- A documented UE-count slot (E-S3) recorded as deferred until the live
  scene has a multi-UE generator; the slider does not ship until that
  generator exists.

Phase E does NOT introduce a second scene tree. Both modes still share
`MainScene` (per `paper_faithful_vision` constraint 1). Phase E does
NOT edit any profile JSON; it only overlays values on top of the
selected base profile.

## 2. Authority and Boundaries

### 2.1 Owned by Phase E

- New `Topology` tab in `SignalTuningPanel`, gated on
  `appMode === 'sinr-experiment'`.
- New `SceneTopologyState` (sat-count + beam-count + optional UE-count
  override) and the symmetrical `apply` / `has-overrides` / `evidence-key`
  helpers that the existing `signalTuning.ts` already exposes for SINR.
- New `applySceneTopology(profile, topology)` composing on top of
  `applySignalTuning` so the App-level `effectiveProfile` becomes:
  `applySceneTopology(applySignalTuning(baseProfile, signalTuning), topology)`.
- Reset semantics for the two parameter classes (next-frame recompute vs
  full trajectory cache rebuild vs beam layout rebuild).
- localStorage persistence of the topology overrides, scoped by app mode
  (modqn-demo never reads or writes the key).
- A one-section amendment to `docs/sinr-runtime-parameter-contract.md`
  recording that `Topology` is a `Simulation Setting` tab class — not a
  paper-facing SINR formula tab — and explaining why it lives inside the
  same left-side panel rather than its own container.

### 2.2 Not owned by Phase E

- Live multi-UE generator. The live scene currently renders one UE
  (`src/viz/GroundScene.tsx` "exactly 1 UE we render only the primary
  mesh — keeps the live single-UE path visually identical to pre-P2").
  Phase E does NOT ship a generator; E-S3 is gated on that generator
  existing.
- MODQN-demo mode topology. `modqn-demo` keeps the fixed
  `modqn-4sat-7beam-paper-faithful` profile; Phase E never overlays the
  topology state in this mode (user vision constraint).
- Replay artifact topology. `phase-03a-replay-bundle-v1` artifacts ship
  with their own `userCount` / `satelliteCount` / `beamCountPerSatellite`
  fields (per D-S2 work). Phase E does NOT override them — replay topology
  is producer-owned and immutable.
- Profile JSON edits. `src/profiles/*.json` stays untouched.
- `FOOTPRINT_RADIUS_WORLD` and any scene visual scale work — Phase C
  concern.
- Backend / training pipeline — Phase B / Phase D concern.

### 2.3 Hard bans (PR-level, all Phase E slices)

- Do NOT edit `src/profiles/*.json`.
- Do NOT expose the `Topology` tab in `modqn-demo` app mode.
- Do NOT mutate the producer-owned `userCount` / `satelliteCount` /
  `beamCountPerSatellite` carried by replay envelopes.
- Do NOT add a second `MainScene` instance or fork the scene tree.
- Do NOT silently widen `applySignalTuning` to also carry topology
  fields — Phase E ships a distinct `applySceneTopology` so SINR formula
  controls and topology controls have separate reset semantics.
- Do NOT change `FOOTPRINT_RADIUS_WORLD` to make a larger sat count
  visually "fit" — beam render radius stays at the documented 56 world
  units. Visual scale is a Phase C concern (per
  `paper_faithful_vision` Decided rejections).
- Do NOT auto-restore topology overrides on app reload without surfacing
  the override badge — the user must always be able to see when the
  scene is running away from the base profile's natural topology.

## 3. Current State

Relevant existing code:

- `src/signalTuning.ts` — `SignalTuningState` interface +
  `createSignalTuningState(profile)` + `applySignalTuning(profile, state)`
  + `hasSignalTuningOverrides` + `getSignalTuningEvidenceKey` +
  `getSignalTuningResetKey`. The `Reset key` is currently keyed on
  `beamwidth3dBDeg` + `maxSteeringAngleDeg` because these two changes
  invalidate beam layout. Phase E follows the same key-bumping pattern.
- `src/App.tsx:324-350` —
  `baseProfile = loadProfile(selectedProfileId)`,
  `effectiveProfile = applySignalTuning(baseProfile, signalTuning)`.
  Phase E wraps the result in `applySceneTopology(..., topology)`.
- `src/ui/SignalTuningPanel.tsx` — host of the tab strip. Tabs today:
  `signal-power`, `receiver-gain`, `thermal-noise`, `loss`, `beam`,
  `interference`. Phase E adds `topology` (sinr-experiment only).
- `src/ui/appMode.ts` — `AppExperienceMode = 'sinr-experiment' |
  'modqn-demo'`. The mode rail decides which left tabs are visible.
- `src/profiles/types.ts:52-58` — `Shell { satsPerPlane: number; ... }`.
  Phase E only rewrites `satsPerPlane` for the primary shell; multi-shell
  candidate-rich profiles (e.g. `hobs-2024-candidate-rich`) are out of
  scope (sat-count override applies to `shells[0]` only, matching the
  paper baseline which has one shell).
- `src/profiles/types.ts:131-135` —
  `beams { perSatellite, maxActivePerSat, frequencyReuse }`. Phase E
  rewrites both `perSatellite` and `maxActivePerSat` together so the
  override doesn't accidentally cap active beams below the new total.
- `src/scene/runtimeFrameStep.ts:132` reads `profile.beams.perSatellite`
  as `maxBeams`. `:499` reads `profile.orbit.shells[0]` for trajectory
  generation.
- `src/scene/useSimulation.ts:192` reads `profile.beams.perSatellite`.
- `src/scene/MainScene.tsx:171` reads `profile.orbit.shells[0]?.altitudeKm`.
- `src/viz/GroundScene.tsx` UE marker source: replay path = artifact-supplied
  array (`NormalizedSceneFrame.ues`), live path = single primary marker.
  No live multi-UE generator exists today.
- `docs/sinr-runtime-parameter-contract.md` §"Parameters That Should Not
  Be In The SINR Panel" explicitly excludes `orbit.*` and `shells[]`
  from the SINR panel. Phase E amends this section because the user
  vision is the authority on entry-point placement.

Existing reset key pattern in `signalTuning.ts:178-183`:

```ts
export function getSignalTuningResetKey(tuning: SignalTuningState): string {
  return [
    tuning.beamwidth3dBDeg.toFixed(3),
    tuning.maxSteeringAngleDeg.toFixed(3),
  ].join('|');
}
```

Phase E adds a parallel `getSceneTopologyResetKey(topology)` returning a
key that includes `satsPerPlane` + `beamCountPerSatellite`. The
`effectiveProfile` consumer in App.tsx joins both keys.

## 4. Slice Plan

Phase E is sized at 2 shippable slices + 1 deferred-pending-dependency
stretch. One slice per PR.

| Slice | Subject | Touches | Cross-repo dep? |
|---|---|---|---|
| PR-π (E-S1) | sat-count runtime override + trajectory cache reset | new `src/sceneTopology.ts`, `src/App.tsx` (compose), `src/ui/signal-tuning/TopologyTab.tsx` (new), `src/ui/SignalTuningPanel.tsx` (register tab), one `data-testid` source-grep validator | none |
| PR-ρ (E-S2) | beam-count runtime override + beam layout reset | extend `src/sceneTopology.ts`, extend `TopologyTab.tsx`, extend reset key, validator | none |
| PR-σ (E-S3, DEFERRED) | UE-count runtime override slider | depends on a separate live multi-UE generator slice that does not yet exist | yes, intra-repo: needs a `Phase F` live-UE generator first |

Each slice is one PR. PR-π and PR-ρ stack (ρ extends π's state
machinery). PR-σ is recorded but does NOT ship in Phase E.

### 4.1 Slice ordering rationale

PR-π first because sat-count is the higher-impact lever (trajectory cache
rebuild + simState reset). Getting the reset semantics right under
sat-count proves the override pattern under the harder of the two cases.
PR-ρ then layers beam-count on top with a lighter reset (beam layout
recompute only).

### 4.2 E-S1 ranges and defaults

- Paper baseline (`modqn-4sat-7beam-paper-faithful`): 4 sats /
  satsPerPlane.
- Paper sensitivity range stated in `paper_faithful_vision`:
  `sat_count [2, 8]`.
- Phase E E-S1 slider range: `[2, 8]`, integer steps.
- Default (no override): the value from `baseProfile.orbit.shells[0]
  .satsPerPlane`. For `hobs-2024-candidate-rich` (the
  `sinr-experiment` default) that is `20`; the slider clamps the
  displayed value to `[2, 8]` and the slider position shows
  `current → 8` until the user moves it.
- The Topology tab shows a "No override" pill when
  `topology.satsPerPlane === null` (the override is unset, the base
  profile value is used).

### 4.3 E-S2 ranges and defaults

- Paper baseline: 7 beams per satellite (hex 1-center + 6-ring).
- Common hex layouts: 7, 19, 37 (per `paper_faithful_vision` Phase E
  bullet).
- Phase E E-S2 slider snaps to `{ 7, 19, 37 }` (discrete radio control,
  not free integer slider). Free-integer values are explicitly out of
  scope for E-S2 because the beam layout generator only ships hex rings
  at these three counts.
- Default (no override): `baseProfile.beams.perSatellite`. When the user
  toggles a value that differs from the base, `topology.beamCountPerSatellite
  = chosen` and `maxActivePerSat = chosen`.
- If a future slice adds non-hex layouts (square grid, paper-irregular,
  etc), E-S2 can promote to a free slider in a follow-up PR; the SDD
  records the snap-to-{7,19,37} as a v1 design intent, not a permanent
  constraint.

### 4.4 E-S3 deferral

The user vision lists UE-count as part of the Topology overrides. The
current live scene has exactly one UE marker (per `GroundScene.tsx`).
Shipping an E-S3 slider that only changes a number with no visible
effect is anti-feature; the SDD records UE-count as PR-σ DEFERRED until
a Phase F slice introduces a live multi-UE generator. Phase E ships
without E-S3.

If user feedback after E-S1 / E-S2 lands and asks for UE-count first,
the priority order can flip: ship a live multi-UE generator as a new
mini-SDD (Phase F), then ship E-S3 as a 1-tab-extension PR. Phase E SDD
does not block on that ordering.

## 5. UI Placement

The Topology tab lives inside `SignalTuningPanel` as a new sibling of
the existing `signal-power` / `receiver-gain` / `thermal-noise` / `loss`
/ `beam` / `interference` tabs. It is conditionally rendered only when
`appMode === 'sinr-experiment'`.

Reasons for picking "new tab in existing panel" over "new panel" or
"bottom row":

- The user vision literal wording is "在 sinr 的分頁也新增這些數量可調整" —
  the SINR sidebar is the host the user is pointing at.
- The existing `SignalTuningPanel` already has a tab strip + drawer
  collapse/expand affordance; adding one tab is a 2-line change in
  `FormulaTabList` + a new `<TopologyTab>` panel.
- A new panel container would require new collapse / drawer state, new
  app-shell grid row, and a third left rail (currently the rail
  already hosts SignalTuningPanel + HandoverPolicyControls; adding a
  third rail panel was rejected during Phase A as visual clutter).
- Placing Topology in the bottom panel was already rejected for the
  training form in Phase B SDD §5 — same reasoning applies here.

Tab order in `SignalTuningPanel` after Phase E:

```
[ signal-power ] [ receiver-gain ] [ thermal-noise ] [ loss ] [ beam ] [ interference ] [ topology* ]
```

(`*` = sinr-experiment only)

The Topology tab is visually grouped under a tab label
`Topology / sim setting` (NOT `Topology / formula`) to signal that its
controls are `Simulation Setting` class per the contract amendment
(§9), not paper-facing SINR formula tabs.

## 6. SceneTopologyState Contract

New file `src/sceneTopology.ts` (sibling to `signalTuning.ts`):

```ts
import type { Profile } from './profiles/types';

export interface SceneTopologyState {
  /** null = no override; use baseProfile.orbit.shells[0].satsPerPlane */
  satsPerPlane: number | null;
  /** null = no override; use baseProfile.beams.perSatellite */
  beamCountPerSatellite: number | null;
  /** Phase E DEFERRED. Always null until a live multi-UE generator ships. */
  ueCount: number | null;
}

export function createSceneTopologyState(): SceneTopologyState {
  return {
    satsPerPlane: null,
    beamCountPerSatellite: null,
    ueCount: null,
  };
}

export function applySceneTopology(
  profile: Profile,
  topology: SceneTopologyState,
): Profile {
  const primaryShell = profile.orbit.shells[0];
  const overriddenShells = topology.satsPerPlane !== null && primaryShell
    ? [
        { ...primaryShell, satsPerPlane: topology.satsPerPlane },
        ...profile.orbit.shells.slice(1),
      ]
    : profile.orbit.shells;

  const overriddenBeams = topology.beamCountPerSatellite !== null
    ? {
        ...profile.beams,
        perSatellite: topology.beamCountPerSatellite,
        maxActivePerSat: topology.beamCountPerSatellite,
      }
    : profile.beams;

  return {
    ...profile,
    orbit: { ...profile.orbit, shells: overriddenShells },
    beams: overriddenBeams,
  };
}

export function hasSceneTopologyOverrides(
  topology: SceneTopologyState,
): boolean {
  return topology.satsPerPlane !== null
    || topology.beamCountPerSatellite !== null
    || topology.ueCount !== null;
}

export function getSceneTopologyResetKey(
  topology: SceneTopologyState,
): string {
  return [
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
  ].join('|');
}

export function getSceneTopologyEvidenceKey(
  topology: SceneTopologyState,
): string {
  return [
    topology.satsPerPlane ?? 'base',
    topology.beamCountPerSatellite ?? 'base',
    topology.ueCount ?? 'base',
  ].join('|');
}
```

`App.tsx` composition:

```ts
const [signalTuning, setSignalTuning] = useState(...);
const [sceneTopology, setSceneTopology] = useState(createSceneTopologyState);

const sinrTuned = useMemo(
  () => applySignalTuning(baseProfile, signalTuning),
  [baseProfile, signalTuning],
);
const effectiveProfile = useMemo(
  () => applySceneTopology(sinrTuned, sceneTopology),
  [sinrTuned, sceneTopology],
);

const resetKey = useMemo(
  () => [
    getSignalTuningResetKey(signalTuning),
    getSceneTopologyResetKey(sceneTopology),
  ].join('|'),
  [signalTuning, sceneTopology],
);
```

E-S1 ships the `satsPerPlane` field + UI; E-S2 ships the
`beamCountPerSatellite` field + UI. E-S3 (UE-count) is intentionally
declared in the interface but stays null in Phase E; the UI does not
expose it.

## 7. State and Persistence

One new localStorage key, versioned `.v1`:

```ts
const SCENE_TOPOLOGY_OVERRIDES_KEY =
  'leo-beam-sim.scene-topology.v1';
```

Behavior:

- Stored shape: `SceneTopologyState` JSON, with nulls preserved.
- Read on App init AFTER the appMode is resolved. If
  `appMode === 'modqn-demo'`, the saved overrides are loaded into
  state but NOT applied (the modqn-demo profile is paper-faithful
  fixed). When the user flips to `sinr-experiment` the overrides
  activate again.
- Writes happen on every state change (same throttling as SignalTuning).
- A `Reset topology` button in the Topology tab calls
  `setSceneTopology(createSceneTopologyState())` and removes the key.

Per `paper_faithful_vision` constraint 1 the topology overrides do not
fork the scene; the same MainScene re-renders with the new
`effectiveProfile`.

## 8. Reset Semantics

The `sinr-runtime-parameter-contract.md` "Runtime Integration Notes For
Future Agents" section already classifies parameter changes into three
tiers. Phase E maps onto those tiers as follows:

| Topology parameter | Tier | What rebuilds |
|---|---|---|
| `satsPerPlane` | full trajectory cache rebuild | trajectory frame cache (per shell), satellite identity map, simState reset (per `getSignalTuningResetKey` pattern but stronger) |
| `beamCountPerSatellite` | recompute + beam layout rebuild | `runtimeFrameStep:maxBeams`, beam-geometry-pure layout, useSimulation memo invalidation |
| `ueCount` (deferred) | full trajectory cache rebuild (when the live UE generator exists) | per-UE trajectory cache, UE marker mesh array reset |

Implementation:

- `App.tsx` already keys `useSimulation` indirectly via
  `effectiveProfile` (which changes when `satsPerPlane` or
  `beamCountPerSatellite` changes). React's referential-equality memo
  will refire useSimulation's `useMemo`/`useEffect` chain naturally.
- The existing `getSignalTuningResetKey` is wired into a top-level
  remount-key pattern: when the key changes, the simulation effects
  unmount and remount with fresh state. Phase E joins
  `getSceneTopologyResetKey` into the same remount-key string.
- For `satsPerPlane` the join causes a hard re-init of
  `useSimulation`, `useBeamViz`, and the trajectory cache. This is the
  same pattern as a `beamwidth3dBDeg` change today; Phase E does not
  invent a new reset mechanism.
- For `beamCountPerSatellite` the join causes the same hard re-init.
  The beam layout pure module re-runs on the next render with the new
  `perSatellite` count.

Phase E does NOT introduce a manual "Restart simulation" button. The
override sliders fire the re-init implicitly, identical to how
changing beamwidth already does so today. If the re-init proves visibly
disruptive in browser smoke testing, a follow-up slice can add a
debounce or a confirmation toast — Phase E v1 ships without it.

The sim restart is intentional and matches the user-vision wording
"sat 數量改變沒辦法 hot-reload，要砍重建". The Topology tab shows a
small banner under the sat-count slider: `Adjusting sat count restarts
the simulation` so the behavior is not a surprise.

## 9. SINR Contract Amendment

`docs/sinr-runtime-parameter-contract.md` §"Parameters That Should Not
Be In The SINR Panel" lists `Orbit geometry (orbit.* and shells[])` as
explicitly excluded from the SINR panel.

Phase E amends this section by adding a new short subsection:

> ### Topology Overrides (Phase E)
>
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

The amendment is shipped in PR-π alongside the E-S1 implementation. The
contract's existing "Should Not Be In The SINR Panel" row is updated
with a back-reference: "Topology overrides for sat-count /
beam-count / UE-count are exposed in a separate `Topology` tab; see
Phase E SDD §5 + §9."

This keeps the SINR formula-tab boundary intact (the formula tabs still
only host paper-symbol parameters) while making the user's mental model
("the SINR sidebar is the place to change things") match the UI.

## 10. Acceptance Per Slice

### 10.1 PR-π (E-S1, sat-count override)

- New file `src/sceneTopology.ts` exports `SceneTopologyState`,
  `createSceneTopologyState`, `applySceneTopology`,
  `hasSceneTopologyOverrides`, `getSceneTopologyResetKey`,
  `getSceneTopologyEvidenceKey`.
- New file `src/ui/signal-tuning/TopologyTab.tsx` rendering the
  sat-count slider (`[2, 8]`, integer), `No override` toggle, current
  effective value readout, and the restart-on-change banner.
- `src/ui/SignalTuningPanel.tsx` registers `topology` as a tab,
  conditionally rendered when the new `appMode` prop equals
  `'sinr-experiment'`.
- `src/ui/signal-tuning/FormulaTabList.tsx` (or `tuningConfig.ts` if
  that's where tab list lives) adds the `topology` entry, hidden in
  modqn-demo.
- `src/ui/signal-tuning/tuningConfig.ts` adds a `topology` tab descriptor
  with `tabClass: 'simulation-setting'` (new optional field; existing
  paper-facing tabs keep their current shape).
- `src/App.tsx` adds `sceneTopology` state + `applySceneTopology`
  composition + `getSceneTopologyResetKey` join + persistence.
- `src/App.tsx` passes `appMode` prop into `SignalTuningPanel`.
- localStorage `leo-beam-sim.scene-topology.v1` persists + restores.
- Override flipping triggers simulation re-init (verified by remount key
  change in browser smoke).
- Override hides in `modqn-demo` mode but the state persists; flipping
  back to `sinr-experiment` re-applies.
- `docs/sinr-runtime-parameter-contract.md` gains §"Topology Overrides
  (Phase E)" subsection per §9.
- New `scripts/validate-phase-e-sat-count-override.tsx` validator
  asserts:
  - `sceneTopology.ts` exports the named functions.
  - `applySceneTopology` rewrites `shells[0].satsPerPlane` only when
    `satsPerPlane !== null`; leaves shape unchanged otherwise.
  - `applySceneTopology` does NOT touch `shells[1..]` for multi-shell
    profiles (regression guard against accidentally clobbering
    candidate-rich shells).
  - `applySceneTopology` does NOT mutate the input profile (returns a
    new object; immutability check).
  - `App.tsx` composes `applySceneTopology(applySignalTuning(...), ...)`
    in that order.
  - `App.tsx` joins `getSceneTopologyResetKey` into the remount key.
  - `SignalTuningPanel` source contains the conditional tab gate on
    `appMode === 'sinr-experiment'`.
  - `TopologyTab` source contains the restart-on-change banner copy +
    `data-testid="topology-tab-sat-count-slider"` +
    `data-testid="topology-tab-restart-banner"`.
  - Contract md file contains the new "Topology Overrides (Phase E)"
    subsection.
- `npm run lint` clean.
- Regression: S3 omega validator + all Phase B / Phase D validators
  still pass.

### 10.2 PR-ρ (E-S2, beam-count override)

- `sceneTopology.ts` already declared `beamCountPerSatellite`; PR-ρ
  exercises the path end-to-end.
- `TopologyTab.tsx` gains the beam-count discrete radio control
  (`{ 7, 19, 37 }`).
- `applySceneTopology` already rewrites `perSatellite` +
  `maxActivePerSat` together; PR-ρ adds the regression test for this.
- `getSceneTopologyResetKey` already includes `beamCountPerSatellite`;
  PR-ρ asserts the join.
- `getSceneTopologyEvidenceKey` similar.
- New `scripts/validate-phase-e-beam-count-override.tsx` validator
  asserts:
  - The discrete radio renders `7 / 19 / 37` options with default
    selection driven by `baseProfile.beams.perSatellite` when override
    is null.
  - `applySceneTopology({ beamCountPerSatellite: 19, ... })` returns a
    profile where both `beams.perSatellite === 19` and
    `beams.maxActivePerSat === 19`.
  - Free-integer values outside `{ 7, 19, 37 }` are NOT accepted by the
    UI (radio control, no free text input).
  - `data-testid="topology-tab-beam-count-radio"` exists.
  - Switching the radio triggers the same remount key bump as
    sat-count, proving the reset semantics are unified.
- `npm run lint` clean.
- Regression: PR-π validator + S3 omega + Phase B / D validators still
  pass.

### 10.3 PR-σ (E-S3, UE-count override — DEFERRED)

Does NOT ship in Phase E.

Will ship after a separate Phase F mini-SDD lands a live multi-UE
generator. The Phase F SDD owns:

- A live-path UE generator (positions + mobility model).
- A `userCount: number` field in `SceneTopologyState` becoming
  user-facing.
- `applySceneTopology` extension to feed the override into the
  generator.
- A slider control `[40, 200]` with the paper range as min / max.
- Re-use of the trajectory-cache-rebuild reset tier so the per-UE
  trajectory cache invalidates on UE-count change.

Phase E SDD reserves the `ueCount: null` field in the interface so the
type contract is forwards-compatible.

## 11. Cross-Repo Dependencies

### 11.1 Required for Phase E v1

NONE. PR-π and PR-ρ are self-contained inside `leo-beam-sim`. No
backend or sibling-repo change is required.

### 11.2 Required for PR-σ (E-S3)

A separate `leo-beam-sim` mini-SDD (`phase-f-live-ue-generator-mini-sdd.md`)
must ship first. That SDD lives in this repo (no cross-repo edit needed).

### 11.3 No replay artifact impact

Phase E does NOT change any field on `phase-03a-replay-bundle-v1`
artifacts. The `userCount` / `satelliteCount` / `beamCountPerSatellite`
fields on a replay envelope continue to come from the producer
(modqn-paper-reproduction). When the user is in `sinr-experiment` mode
the topology override is live-sim only and does not affect any
artifact-replay path.

## 12. Out of Scope

Not in Phase E:

- A live multi-UE generator (deferred to Phase F).
- Multi-shell sat-count overrides (only `shells[0]` is rewritten;
  candidate-rich profiles' secondary shells stay untouched).
- Non-hex beam layouts (square / paper-irregular).
- Per-satellite-individual beam-count override (Phase E ships the same
  beam-count across all sats; per-sat differences would require profile
  schema changes).
- Visual scale changes (`FOOTPRINT_RADIUS_WORLD`, beam render radius) —
  Phase C concern.
- Camera preset switching as a function of sat-count — Phase C concern.
- Profile JSON edits to enshrine the override as a new "preset profile".
  Phase E overlays only; a future slice can promote a popular preset
  to a new JSON profile entry but that is a separate decision.
- Streaming / cross-tab sync of topology overrides.
- URL state for sharing a topology setting (rejected per
  `paper_faithful_vision` Decided rejection of L2 / react-router).

## 13. Risks

- **Trajectory cache rebuild visible cost**. Changing sat-count under
  the existing remount-key pattern unmounts and remounts the simulation.
  On the candidate-rich profile (20 sats baseline) the rebuild may
  cause a perceptible jank. Browser smoke for PR-π must verify the
  jank window is acceptable; if not, a follow-up debounce or "Apply"
  button can be added (Phase E v1 ships without it).
- **Multi-shell silent override**. `applySceneTopology` rewrites
  `shells[0]` only. If a user picks a multi-shell base profile (e.g.
  `hobs-2024-candidate-rich`) and overrides sat-count, only the first
  shell changes. The Topology tab readout shows
  "shells[0]: 4 (override) · other shells unchanged" so the partial
  scope is visible. Regression test in PR-π enforces this.
- **localStorage key collisions across tabs**. Two browser tabs of the
  same app share the key. Whichever tab writes last wins. This is
  acceptable for v1 — same model as the Phase B `submitted-job-ids`
  key.
- **Override re-activates silently on mode flip**. When the user flips
  from `modqn-demo` → `sinr-experiment`, the saved overrides re-apply.
  This is the desired behavior per user vision ("sinr 分頁可調") but
  can surprise. The Topology tab always shows an explicit
  `Override active: sats=N, beams=M` pill so the state is never
  invisible.
- **Beam-count = 37 may stress the beam-layout pure module**. The hex
  3-ring layout is implemented but not tested at scale. Browser smoke
  on PR-ρ should exercise the 37-beam path.

## 14. Validation Plan (per Phase E slice)

Each slice's PR runs:

- `npm run lint`.
- The relevant focused validator script (`validate-phase-e-sat-count-override.tsx`
  for PR-π, `validate-phase-e-beam-count-override.tsx` for PR-ρ).
- The S3 omega regression validator
  (`validate-modqn-omega-s3-replay-mode-wiring.tsx`) to prove the L1.5
  mode-rail contract still holds.
- Phase B / Phase D validators (all 434 named assertions from D-S7
  ship state) re-run to prove no regression.
- Manual source-grep: no `MainScene` fork, no `FOOTPRINT_RADIUS_WORLD`
  edit, no profile JSON edit, no Phase A / B / C / D file unexpectedly
  touched outside the documented composition points (`App.tsx` +
  `SignalTuningPanel.tsx` + new files).
- Browser smoke for PR-π and PR-ρ: open dev server, switch app mode to
  sinr-experiment, open Topology tab, change sat-count and beam-count,
  observe sim restarts cleanly and the override pill shows.

Per `feedback-validator-canvas-vs-react-attr` rule, any validator
assertion against a re-rendered React-DOM attribute (e.g. the override
pill text) gates on the same DOM element's own attr, not a sibling
canvas attr.

Per `feedback-modqn-demo-subagent-verify` rule, codex sub-agent PASS
reports for E-S1 / E-S2 are re-verified in the controller main thread
(`npm run lint`, `npm run validate:phase-e-*`, source grep) before
PR push.

## 15. Assumptions To Verify Before PR-π Lands

- `effectiveProfile = applySceneTopology(applySignalTuning(baseProfile,
  signalTuning), sceneTopology)` is the correct composition order
  (SINR first because SINR overrides change channel / antenna fields
  that the topology rewrite does NOT touch; topology last because it
  rewrites `orbit.shells[0]` and `beams` independently). If a future
  agent finds a parameter where the order matters semantically, the
  composition order needs a rationale update here.
- The remount key currently joined to drive
  `useSimulation`/`useBeamViz` reset is the single source of truth.
  Phase E adds `getSceneTopologyResetKey` to that join string. If the
  current code uses a different reset mechanism (e.g. explicit
  `<MainScene key={...}>`) the same key string still works.
- The `Topology` tab does NOT need to publish to
  `getSignalTuningEvidenceKey` because the evidence-key is consumed by
  the SINR formula-evidence freshness gate, and topology overrides do
  not invalidate that gate. If a future Phase wants the
  formula-evidence panel to also flag "topology was overridden" then
  the evidence key composition can be widened.
- The `hobs-2024-candidate-rich` profile (sinr-experiment default) has
  5 shells, but only `shells[0]` is overridden. This is acceptable
  because the user vision targets the paper-baseline single-shell case
  (`modqn-4sat-7beam-paper-faithful` has 1 shell). Multi-shell users
  see the partial override and the Topology tab is explicit about it.
- No CI / lint config blocks the new `tabClass: 'simulation-setting'`
  optional field on the tuning tab descriptor. If a TypeScript
  exhaustiveness check requires updates, those are in scope of PR-π.

If any assumption is contradicted before implementation, update this
SDD rather than patching display behavior around it.
