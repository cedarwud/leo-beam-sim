# S1 — Coordinate Authority (frontend consolidation slice)

**Parent:** [frontend-consolidation-program.md](./frontend-consolidation-program.md) §3 S1 ·
[governance-lock-strategy.md](./governance-lock-strategy.md).
**Basis:** 11-agent read-only coordinate map + 4 adversarial verdicts (2026-06-11),
all file:line-cited.

## 1. What the audit found (the coordinate disease)

There was **no coordinate authority** in the live truth→pixel path:

- **Frame punning.** `useBeamViz.ts:233-241` guessed a satellite's coordinate
  frame from its **magnitude** (`mag > 1000`): live satellites are a sky-dome
  az/el projection (small world-units, `trajectoryFrame.ts` →
  `createWorldPosition`, radii 700×400); replay satellites are `ecef-km`
  (`coordToWorld`, magnitude ~6878). The guess existed because the live adapter
  **tags its dome coordinates as `'ecef-km'`** (`liveSimToScene.ts:105`) — a type
  lie. `coordFrameKind` is never read by the renderer (dead for decisions).
- **Magic divisor.** `satPosScaleFactor = visualSatelliteAltitude / 400`; the
  bare `400` is `SKY_DOME_V_RADIUS`, hidden as a literal.
- **6× `111.32`.** `EARTH_KM_PER_DEG` was redeclared in 6 modules.
- **One missing `cos(lat)`.** `modqnReplaySceneVisuals.ts:236`
  (`satelliteSubpointToScenePoint`) omits the longitude cosine factor the other
  5 sites apply — a latent bug in the modqn-replay layer.

## 2. The "satellites above nadir" reality (why it is a SEPARATE visual slice)

The program lists "satellites rendered above their nadir." A probe of the
`hobs-2024-candidate-rich` profile (the gate profile) shows this **cannot be
done at true scale** without scattering the constellation off-screen:

| satellites | elevation | nadir dist | `nadir × worldUnitsPerKm` | current dome |
|---|---|---|---|---|
| serving (78°) | high | 119 km | 818 wu (off edge) | 131 wu |
| ~50 sats | 11–35° | 700–1 728 km | **5 000–12 000 wu** | 510–618 wu |

Map half-width ≈ **688 wu**. A 13°-elevation LEO satellite is genuinely
~1 600 km horizontally from the observer while the UE patch spans ±100 km. The
sky-dome (`700·cos(el)`) is a **deliberate compression** so all 69 visible
satellites stay in frame, and it is already azimuth-faithful. Moving satellites
"above nadir" therefore requires choosing a *compression function* and deciding
its interaction with the approved UE-anchor — a **visual-design decision** that
needs screenshot iteration with the user. It is deferred to its own slice and
is **not** bundled into this type refactor.

## 3. Scope of THIS slice (Option A — coordinate TYPE authority, zero visual change)

Display output is held **byte-identical** (the live geometry-trace golden diffs
clean with no re-baseline). Delivered:

1. **Typed frame discriminator.** `NormalizedSatellite.worldFrame:
   'live-enu' | 'replay-worldpos'` (set by the adapter). `useBeamViz` projects
   via the new pure authority `satelliteRenderProjection.ts`
   (`projectSatelliteRenderWorld`) selecting by **type**, not magnitude. The
   `mag > 1000` guess is **retired for the live lane**.
2. **De-punned divisor.** `satPosScaleFactor = visualSatelliteAltitude /
   SKY_DOME_V_RADIUS` (`sceneScale.ts`).
3. **Single-source constants.** `EARTH_KM_PER_DEG` → `engine/orbit/earth-constants.ts`
   (engine-side so `cellLayout` imports it without crossing engine→scene);
   `SKY_DOME_{H,V}_RADIUS` → `scene/sceneScale.ts`. All 6 `111.32` sites and the
   `trajectoryFrame` dome radii now import the one source. (The stale
   "duplicated so the validator regex can match" comments are removed; no
   validator references these constants.)
4. **Replacement gate** `validate:s1:coordinate-authority` — the behavior gate
   that retires the heuristic (positive control: a `'live-enu'` coordinate with
   magnitude > 1000 is still *scaled*, not normalized) + dedup value checks +
   an end-to-end live-pipeline check.

### Why altitude is NOT unified onto `kmToWorldScale`
Verdict 4: `visualSatelliteAltitude` is a deliberate visual compression. Unifying
it (550 km × 6.879 = 3 784 wu) would render satellites ~10× higher, off-screen,
breaking the frozen look and camera presets. Only horizontal scale is shared
(`kmToWorldScale == worldUnitsPerKm == UE scale` in the real app); the satellite
Y stays the separate visual constant.

## 4. Deferred (own commits)

- **S1b — replay typed fold.** The replay branch is held byte-identical here
  because the geometry-trace gate covers only the live lane (Verdict 3: a naive
  swap would silently misscale ecef-km replay satellites, unguarded). S1b folds
  replay onto the typed discriminator **and** extends the gate with a replay
  golden trace first.
- **S1c — `cos(lat)` fix** at `modqnReplaySceneVisuals.ts:236` (a real
  behavior change to the modqn-replay lane; own commit + note).
- **Satellite "above nadir" visual placement** (§2) — its own visual slice with
  user screenshot review.

## 5. Truth-trace discipline
Truth (`sim.satellites[].world`, the sky-dome value built once in
`trajectoryFrame.ts:172`) is never mutated downstream (Verdict 1) and physics
never reads it (Verdict 2 — link budget uses `rangeKm`, handover uses `topo`).
This slice touches only the display projection, and its output is value-identical,
so `validate:s0:geometry-trace` passes with **zero diffs** — no `S0_TRACE_IGNORE`,
no re-baseline.
