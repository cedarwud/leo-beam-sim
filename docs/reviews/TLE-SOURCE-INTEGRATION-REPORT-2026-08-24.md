# Archived TLE / Walker source integration report

Date: 2026-08-24  
Checkout: `feat/six-acts-p0-vertical-slice` at `2d127b2`  
Result: **feature complete; focused implementation, atomic Apply, and browser gates pass; unrelated repository reds remain separately recorded**

## Scope and checkout boundary

The handoff's checkout description was stale. It reported branch
`wip/tle-event-atlas-20260818`, 27 modified tracked files, and no untracked files.
The actual checkout was `feat/six-acts-p0-vertical-slice` with unrelated tracked and
untracked Six Acts, global-constellation, visual-lab, package, symbol, and review work.
The owner explicitly instructed this session to proceed without a commit or stash
checkpoint. No commit, push, reset, checkout, stash, restore, clean, profile edit, or
scientific validator relaxation was performed. One browser validator's sampling cadence
was tightened to observe the same short-lived pulse criterion reliably at 20x.

The implementation kept the handoff's projection-only boundary, explicit source choice,
runtime reversibility, persistence, accepted canonical trace ownership, and Event Atlas
exclusion. It changed the stale plan only where the real checkout required it: the source
control is mounted directly in the actual top-row composition in `App.tsx`, and source
activation is passed explicitly to `MainScene` instead of being inferred from whether a
canonical frame happens to exist.

## Implemented change

- Added a native, labelled `TLE / Walker` segmented control in the top row.
- Added SSR-safe, versioned local persistence under
  `leo-beam-sim.simulation-source-mode.v1`. Walker is the fail-closed default for missing,
  invalid, or unavailable storage.
- Replaced implicit `canonicalAnalysisFrame !== undefined` activation with the explicit
  `simulationSource` contract.
- Mounts exactly one scientific producer. Selecting TLE unmounts `useSimulation`, the
  Walker handover runtime, and the legacy cell scheduler. Returning to Walker performs one
  deterministic seek to the last published Walker source time, reconstructing serving and
  timeline continuity without hidden background execution.
- Added visible loading and error states for selected TLE; there is no silent Walker
  fallback.
- Projected the immutable `frame.handover` trace into the existing `SimFrame` surface.
  The adapter still performs no propagation, link-budget calculation, handover decision,
  or runtime advance.
- Passed producer identity explicitly through the normalized projection seam. Archived-TLE
  pending target/SINR/TTT and committed transition fields can no longer be erased by the
  Walker cell-truth override.
- Preserved selected/candidate/event-endpoint TLE identities through the bounded scene
  projection. Candidate beams remain comparison/display-only and never enter active
  service ownership.
- Added source-specific forced-continuity wording to the scene cue and right rail, so a
  horizon-loss continuity change is not mislabeled as a successful Offset+TTT handover.
- Added an explicit visible N/A boundary for Walker-only manual handovers, Walker event
  jumps, intra-satellite events, and background per-UE markers. The accepted canonical
  trace covers one representative link.
- Mounted the real constellation/time source disclosure in the production Scenario tab and
  removed the canonical page's duplicate local-preview controls. Draft edits preserve the
  accepted run; explicit Apply immediately clears centre, right rail, evaluation, and
  timeline, and no first frame is exposed before the complete replacement run publishes.

Owned implementation paths:

- `src/App.tsx`
- `src/app/simulationSourceMode.ts`
- `src/app/simulationSourceMode.test.ts`
- `src/app/simulationSourceIntegration.test.ts`
- `src/app/timelineRailAuthority.ts`
- `src/app/timelineRailAuthority.test.ts`
- `src/scene/MainScene.tsx`
- `src/scene/NormalizedSceneFrame.ts`
- `src/scene/archivedTleMainSceneSource.test.ts`
- `src/scene/archivedTleSimFrameAdapter.ts`
- `src/scene/archivedTleSimFrameAdapter.test.ts`
- `src/scene/homepageTleSceneAdapter.ts`
- `src/scene/homepageTleSceneAdapter.test.ts`
- `src/scene/sceneLaneRenderPlan.ts`
- `src/scene/sceneLaneRenderPlan.archivedTle.test.ts`
- `src/scene/useCellSchedule.ts`
- `src/showcase/liveSimToScene.ts`
- `src/showcase/liveSimToScene.intra-handover.test.ts`
- `src/styles/main.scss`
- `src/ui/SimulationSourceToggle.tsx`
- `src/ui/SimulationSourceToggle.test.tsx`
- `src/ui/signal-tuning/HomepageCanonicalFormula.test.tsx`
- `src/ui/signal-tuning/HomepageCanonicalServingComparison.tsx`
- `src/ui/signal-tuning/HomepageCanonicalControls.tsx`
- `src/ui/signal-tuning/HomepageCanonicalOwnership.test.tsx`
- `src/ui/signal-tuning/ScenarioDataTab.tsx`
- `src/ui/signal-tuning/useHomepageCanonicalAnalysis.ts`
- `src/ui/signal-tuning/useHomepageCanonicalAnalysis.test.ts`
- `src/viz/HandoverToastOverlay.tsx`
- `scripts/validate-phase-c-sinr-live-cell-beams-browser.ts` (sampling cadence only;
  unchanged pulse pass criterion)

All other dirty paths were treated as unrelated concurrent WIP and left untouched.

## Surface-by-surface completion checklist

| Surface | TLE behavior | Evidence |
|---|---|---|
| Source activation | Explicit `walker` / `archived-tle`; never inferred from frame presence | root `data-simulation-source`, toggle tests, browser switch |
| Persistence | Choice survives reload; invalid storage fails to Walker | persistence tests and browser reload with TLE pressed |
| Missing/error source | TLE loading and `role=alert` error; no fallback | `MainScene` source contract test |
| Source/date Apply | Production disclosure owns draft source/time; Apply stays empty until the complete replacement run | hook contract test and browser empty-boundary probe |
| Timeline authority | Accepted TLE run owns 7,200 s / 30 s axis, playback, speed and scrub; transport locks while incomplete | root `timelineSourceOwner=archived-tle-run`, pending reload probe, playback tests |
| Runtime reversibility | TLE run remains accepted while Walker is selected; Walker is unmounted under TLE and deterministically reconstructed on return | browser restore request `472.422 s`, landed/advanced to `482.15 s`; TLE reported zero active Walker canvases |
| Propagation/provenance | Archived TLE, SGP4, archive/run/frame identities remain visible | `homepage-tle-center` browser probe |
| Satellite projection | selected, candidate, bounded context and event endpoints retained | adapter tests and event screenshot |
| Serving ownership | exactly seven selected-satellite active assignments; candidate is display-only | adapter tests and browser canvas probe |
| Cell/UE truth | seven served cells and 100 UEs; representative UE carries canonical trace | adapter/placement tests and browser probe |
| Serving/candidate link values | SINR, Power, Throughput and EE read from the same accepted frame | canonical formula test and right-rail browser readout |
| Pending decision | pending target satellite/beam/SINR and TTT progress projected | adapter tests |
| Completed decision | last/recent event, source/target IDs, inter event, per-frame and cumulative counts projected | adapter tests and `T+390 s` browser event |
| Forced continuity | remains distinct from Offset+TTT in cue, reason and right rail | forced-continuity screenshot and probe |
| Scene handover presentation | source-owned pair/fans/footprints, isolation, auto-slow and cue use the canonical event | event canvas probe: `handoverPresentationSource=tle`, `kind=inter`, `active=1` |
| Intra events | N/A: accepted TLE trace contains no intra-satellite event contract | visible TLE source-boundary disclosure |
| Walker manual/event-index/Director controls | N/A and removed from the TLE surface; not allowed to seek/reset Walker state | visible boundary plus source integration test |
| Background per-UE events | N/A: canonical trace is representative-link truth, not aggregate per-UE truth | visible boundary; background records do not receive invented events |
| Event Atlas | intentionally not consumed | handoff scope preserved |

## Focused and browser gate results

The following are exact result excerpts from the final checkout.

```text
> npm run lint
> tsc --noEmit
[exit 0]

> npm run test:tle
Archived-TLE RunBundle tests passed
TLE Worker transport request/abort/stale guards passed
[exit 0]

> npm run test:canonical-ee
tests 8; pass 8; fail 0
[exit 0]

> npm run test:scene-presentation
tests 2; pass 2; fail 0
archived TLE MainScene source contract tests passed
[exit 0]

> npm run test:tle:event-atlas
filesystem TLE Event Atlas archive tests passed
canonical TLE Event Atlas window and aggregation tests passed
[exit 0]

> npm run test:homepage-projections
timelineRailAuthority.test.ts: all assertions passed
Homepage canonical parameter acceptance keeps rejected inputs and frames atomic.
homepage TLE scene adapter tests passed
homepage TLE visual interpolation tests passed
[exit 0]

> node --import tsx/esm src/showcase/liveSimToScene.intra-handover.test.ts
[liveSimToScene.intra-handover] regression checks passed
[exit 0]

> focused source/adapter/UI test group
tests 7; pass 7; fail 0
[exit 0]

> node --import tsx/esm src/scene/archivedTleSevenCellPlacement.test.ts
archived TLE seven-cell placement tests passed

> node --import tsx/esm src/scene/homepageTleVisualInterpolation.test.ts
homepage TLE visual interpolation tests passed

> git diff --check
[exit 0]
```

The repository browser validators initially could not launch Chromium inside the restricted
sandbox (`sandbox_host_linux.cc:41 ... Operation not permitted`). They were rerun unchanged
with browser-process permission:

```text
> APP_URL=http://127.0.0.1:4177 npm run validate:phase-h:sinr-live-render:browser
[sinr-live-render] live-engine render OK: 12 satellites, 7 beam cones, 1 beam-sats
[sinr-live-render] PASS (DATA SOURCE = live SINR engine)

> APP_URL=http://127.0.0.1:4177 npm run validate:phase-c:sinr-live-cells:render:browser
[sinr-live-cell-beams] healthy frame: cones=7, served=7, sats=1, offAxisMax=3.907°
[sinr-live-cell-beams] live pulse: count=2, meshRendered=2 fired with NO director arm
[sinr-live-cell-beams] PASS — cell-truth cones at fixed cell centres + UEs off-axis + decoupled live-handover pulse on sinr-live (DATA SOURCE = live SINR engine)
```

The pulse validator keeps the same hard requirement (`pulse > 0` and rendered mesh
`> 0`). Its sampling was changed from 700 ms to 50 ms because the four-simulation-second
retention window lasts only about 200 ms at the validator's 20x playback rate; the old
cadence could alias over a genuine pulse. The final run passed without changing runtime
or scientific criteria.

## Browser inspection

The application was served at `http://127.0.0.1:4177/` and inspected with a real Chromium
session at 1600 x 1000 and 430 x 900.

- Fresh storage selected Walker. Its canvas reported `sceneSource=live-sim`,
  `liveSimulationEnabled=1`, seven beam cones and 100 rendered UEs.
- Selecting TLE changed the same canvas to `sceneSource=archived-tle`,
  `liveSimulationEnabled=0`, `sceneLaneSourceCompatible=1`, with seven canonical cells and
  100 UEs. The final post-contract probe reported 241 anchors, 7,200 s duration, 30 s
  steps, an empty legacy cell-schedule slot, and zero active Walker canvases. No page
  reload was used.
- A reload with persisted TLE selected the TLE button again. While the complete run was
  building, `timelineDisabled=true`; after atomic publication it became false.
- The current accepted run's first serving-change was found at `T+390 s`
  (`2026-08-12T12:06:30Z`): `forced-continuity`, old serving NORAD 66446, new serving
  NORAD 56708, reason `serving TLE satellite 66446 left the NTPU horizon`, cumulative
  count 1. The scene showed the source-owned inter pair/fans, isolation and auto-slow,
  while the right rail said `服務可見性中斷切換` rather than claiming Offset+TTT success.
- A final Walker → TLE → Walker run captured the Walker restore target at `472.422 s`.
  The remounted Walker consumed the `source-restore` seek and had advanced to `482.15 s`
  when read, with `sceneSource=live-sim` and `liveSimulationEnabled=1`.
- Opening the production source disclosure, changing the draft instant, and clicking
  Apply cleared the centre, right-rail, and serving-comparison frame IDs to empty strings,
  reset the EE evaluation, locked the timeline, and showed `TLE 場景計算中`. No stale or
  first-frame result was visible; browser console errors remained zero.
- At 430 px the document width equaled the viewport width (`430`), both source buttons
  remained inside the viewport, and the TLE button remained visibly pressed.
- Browser console: zero application errors. Remaining messages were software-WebGL
  `ReadPixels` performance warnings and the existing GLTF
  `KHR_materials_pbrSpecularGlossiness` warning.

Screenshots:

| Evidence | SHA-256 |
|---|---|
| `output/playwright/walker-source.png` | `324a7dee16381eb3f12c599a4f1765ff198c2800af8daa3f27dd54e57bfb3ed9` |
| `output/playwright/tle-source.png` | `a2de35a91e1d91dcb76a31b448aa7ca553a8e7b03837806589a46fa7a990fec8` |
| `output/playwright/tle-source-forced-continuity.png` | `016feb612419016614f59cb671c7f0dd424b14881681a0d36ca4bceb4b7c470f` |
| `output/playwright/tle-source-mobile.png` | `96e6e83da4c9ecc0a6f9a80b757e0b705a0ea1b233af63db7c8550c38311650d` |
| `output/playwright/tle-source-post-contract.png` | `a0a882c283af91f0e0801e4976de5a04bd3e71a91367267e3b740f19bea02264` |
| `output/playwright/tle-apply-empty.png` | `161466a1a9aac3d1f88a869d307d60f21800d70f470d5bdb20fec36afb0a879f` |

## Reproduced pre-existing red gates

These signatures were captured before implementation and reproduced after it. No
validator or research profile was changed.

```text
> npm run test:simulator
tests 3; pass 0; fail 3
actual: canonical-seven-cell-fixed-load
expected: canonical-complete-hex-fixed-load
[exit 1]

> npm run check:tle-archive
Error: catalog.json is stale
[OneWeb check, exit 1]

> npm run validate:s4:serving-equivalence
AssertionError: V6: cell count is 37 (producer hex parity, S-cells-4e)
7 !== 37

> npm run validate:s4:cell-served-survives-wrap
AssertionError: B POSITIVE CONTROL FAILED: reset()-on-seek did not drop served (reset=100, rebase=100, gap=0)

> npm run validate:phase-f:per-ue-handover
[validate-phase-f-per-ue-handover] 55 passed, 1 failed
[FAIL] primary hoManager still uses S3HandoverManager

> npm run validate:live-walker:handover-event-focus
AssertionError: App live Walker rail source-time seek request missing setLiveTimelineSeekRequest({

> npm run validate:phase-f:ue-distribution-mode
[validate-phase-f-ue-distribution-mode] 72 passed, 14 failed

> npm run validate:other-handover-ues:runtime
tests 1; pass 0; fail 1

> APP_URL=http://127.0.0.1:4177 npm run validate:live-walker:handover-event-focus:browser
locator.waitFor: Timeout 30000ms exceeded.
waiting for locator('[data-testid="handover-event-rail"]') to be visible
```

## Known remaining gaps

1. The canonical runtime is still a single-satellite RF frame. Its honest event
   population is therefore dominated by horizon-loss forced continuity. A multi-satellite
   joint-interference runtime is a separate scientific/product decision and was not
   fabricated here.
2. Event Atlas remains offline and has no UI consumer, exactly as scoped by the handoff.
3. The checked-in default full-run artifact has an older catalog archive identity than the
   current catalog, so it fails closed and the current complete run is rebuilt in a Worker.
   This affects startup latency, not correctness or source availability; the accepted run
   remains atomic and the timeline stays locked until publication.
4. The reproduced repository reds above remain maintenance work outside this feature.
   The stale homepage full-run opt-in assertion was in this feature's direct test path and
   was synchronized to the current default-artifact/explicit-opt-out contract; that suite
   now passes.
5. Unrelated dirty WIP remains in the checkout and has not been checkpointed or committed.
