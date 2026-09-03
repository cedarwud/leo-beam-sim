# WI-01 authority and WIP preflight

Status: `CANDIDATE_EVIDENCE` — ready for independent review; not a controller
`PASS` and does not unlock WI-02.

Capture date: 2026-08-24 (Asia/Taipei). The quiescence evidence below is the
current stable checkpoint observed for more than two minutes and confirmed by an
additional five-second pair. PID 20159 remains resident with Vite/Playwright
validation, but no current source write or `apply_patch` is active; the report
therefore remains candidate evidence pending independent reviewer confirmation.

## 1. Checkout identity and preservation boundary

- Branch: `feat/six-acts-p0-vertical-slice`
- HEAD: `2d127b251e2125a60492fdb4f1745931b7a933e7`
- HEAD subject: `fix(ui): add hideable shell chrome`
- No reset, restore, stash, cleanup, stage, commit, or push was performed.
- All listed dirty WIP is preserved. Within the WI-01 report-writer/reviewer
  scope, this report is the only added file; other-session WIP exists and is
  not owned or adopted by this writer.

Current stable status fingerprint, stable for more than two minutes and matched
again in a five-second pair:

```text
git status --porcelain=v2 -z --untracked-files=all | sha256sum
35bffd1641540f3af4e46612b35196be663e81b6891c7b228da63233476a67e0
```

The checkpoint contained 42 default porcelain records and 47 records with
untracked files expanded. No `.git` lock file was present.

### Current tracked modifications (preserve; not accepted product)

```text
docs/SYMBOL-SOURCE-OF-TRUTH.md
package.json
src/course/nav/SixActsLauncher.tsx
src/course/nav/sixActsRoutes.test.ts
src/course/nav/sixActsRoutes.ts
src/main.tsx
src/prototype/global-constellation/GlobalConstellationPrototype.scss
src/prototype/global-constellation/GlobalConstellationPrototype.tsx
src/App.tsx
src/scene/MainScene.tsx
src/scene/NormalizedSceneFrame.ts
src/scene/archivedTleMainSceneSource.test.ts
src/scene/archivedTleSimFrameAdapter.test.ts
src/scene/archivedTleSimFrameAdapter.ts
src/scene/homepageTleSceneAdapter.test.ts
src/scene/homepageTleSceneAdapter.ts
src/scene/sceneLaneRenderPlan.ts
src/styles/main.scss
src/ui/signal-tuning/HomepageCanonicalFormula.test.tsx
src/ui/signal-tuning/HomepageCanonicalServingComparison.tsx
src/viz/HandoverToastOverlay.tsx
```

### Current untracked paths (preserve; no cleanup)

```text
docs/sdd/TEACHING-SIMULATOR-HIERARCHICAL-BACKLOG.md
docs/sdd/VISUAL-FIRST-GLOBAL-CONSTELLATION-STORYBOARD.md
docs/sdd/VISUAL-FIRST-GOLDEN-FLOW-STORYBOARD.md
scripts/record-global-constellation-video.ts
scripts/record-golden-flow-video.ts
scripts/validate-global-constellation-browser.ts
scripts/validate-golden-flow-browser.ts
scripts/validate-golden-flow-course-segments-browser.ts
src/app/simulationSourceMode.test.ts
src/app/simulationSourceMode.ts
src/prototype/global-constellation/GlobalConstellationScene.tsx
src/prototype/global-constellation/globalConstellationCamera.ts
src/prototype/global-constellation/globalConstellationDirector.test.ts
src/prototype/global-constellation/globalConstellationDirector.ts
src/prototype/global-constellation/globalConstellationGeometry.ts
src/prototype/golden-flow/GoldenFlowPrototype.scss
src/prototype/golden-flow/GoldenFlowPrototype.tsx
src/prototype/golden-flow/GoldenFlowScene.tsx
src/prototype/golden-flow/goldenFlowDirector.test.ts
src/prototype/golden-flow/goldenFlowDirector.ts
src/prototype/golden-flow/goldenFlowRoutes.ts
src/ui/SimulationSourceToggle.test.tsx
src/ui/SimulationSourceToggle.tsx
docs/reviews/TEACHING-SIMULATOR-WI-01-PREFLIGHT-2026-08-24.md
src/app/simulationSourceIntegration.test.ts
src/scene/sceneLaneRenderPlan.archivedTle.test.ts
```

The four late simulation-source files are explicitly quarantined and
unintegrated: `src/app/simulationSourceMode.{ts,test.ts}` and
`src/ui/SimulationSourceToggle.{tsx,test.tsx}`. They are not adopted by
WI-01.

The following current TLE/homepage integration paths are other-session WIP.
They are preserved and `QUARANTINE`d for WI-01; none receives route or
scientific adoption:

```text
src/App.tsx
src/scene/MainScene.tsx
src/scene/NormalizedSceneFrame.ts
src/scene/archivedTleMainSceneSource.test.ts
src/scene/archivedTleSimFrameAdapter.ts
src/scene/archivedTleSimFrameAdapter.test.ts
src/scene/homepageTleSceneAdapter.ts
src/scene/homepageTleSceneAdapter.test.ts
src/scene/sceneLaneRenderPlan.ts
src/styles/main.scss
src/ui/signal-tuning/HomepageCanonicalFormula.test.tsx
src/ui/signal-tuning/HomepageCanonicalServingComparison.tsx
src/viz/HandoverToastOverlay.tsx
src/app/simulationSourceIntegration.test.ts
src/app/simulationSourceMode.ts
src/app/simulationSourceMode.test.ts
src/ui/SimulationSourceToggle.tsx
src/ui/SimulationSourceToggle.test.tsx
src/scene/sceneLaneRenderPlan.archivedTle.test.ts
```

## 2. Writer-quiescence evidence

At the current checkpoint, the read-only controller was PID `15658`, cwd
`/home/u24/demo/leo-beam-sim`. PID `20159` remains resident in the same
repo and is running Vite on port `4177` plus Playwright browser validation,
but has no current `apply_patch` or source-write child.

| Observation | Classification |
|---|---|
| Resident Codex process with Vite/Playwright but no current mutation child | Active read-only validation; no implementation-writer child |
| Source write, `apply_patch`, git mutation, recorder, validator, or active child in this checkout | Active writer; blocks a new baseline |
| Vite PID `88570` under mcrl-figures | Other repository; not a Leo writer |
| Vite PID `256146` under /tmp prototype checkout | Other checkout; not a Leo writer |

The more-than-two-minute stable hash, additional five-second pair, no `.git`
lock, and unchanged protected-WIP state are the machine evidence. Active
read-only validation does not prove current browser execution, current pixels,
or owner acceptance. Independent review must still confirm writer quiescence.

## 3. Authority and scientific boundaries

Active simulator precedence is:

1. Newer explicit controller/scientific rulings.
2. [ADR-005](../decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md)
   for archived TLE, SGP4, atomic publication, one immutable frame, and EE
   boundary.
3. [TLE-CANONICAL-EE-SIMULATOR-SDD.md](../sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md)
   for implementation structure.
4. [LEO-SIM-CURRENT-HANDOFF-2026-08-11.md](../handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md)
   for runtime handoff.
5. [ADR-007](../decisions/ADR-007-scientific-experience-and-figure-mode.md)
   for evidence/presentation separation.
6. [ADR-009](../decisions/ADR-009-unified-composable-energy-visualization-scene.md)
   for one composable scene/session and causal presentation.

The chain is recorded in
`docs/sdd/TEACHING-SIMULATOR-HIERARCHICAL-BACKLOG.md:104-130`; the
scene-first correction ledger is at `:212-230` and the hard visual contract
at `:274-295`.

External ADR-003 is `SUPERSEDED / ARCHIVED IN PLACE` from 2026-08-19. It is
not current formula authority. Use the active simplified EE presentation
spec, formal symbol table, and current `thesis-mc` authority instead. The
supersession is explicit in ADR-003's header and the symbol table's
`...simplified-ee-symbol-table.md:311-318`.

Local ADR-005 lines 13-14 and 40-45, and active TLE SDD lines 237-251, still
point to the archived ADR-003 path. This is a formula-authority conflict:
`BLOCKED_OWNER`, deferred to WI-13. No worker may adopt either formula chain
until the synchronized active authority is explicitly frozen.

WI-13 must resolve, not this preflight: the presentation spec still contains a
`segment-start 2 W` phrase (`...simplified-ee-presentation-spec.md:58`),
while the active symbol table defines `p⁰ = pmax/2 = 0.825 W`
(`...simplified-ee-symbol-table.md:23,149,530`). The controller ruling also
contains older 2 W wording. No UI or worker may choose this value here.

## 4. Route/source inventory

Static route reachability is recorded from `src/main.tsx:21-56,139-220` and
`src/course/nav/sixActsRoutes.ts:33-75`. These presentation classifications
are not owner visual acceptance.

| Route | Current surface/role | Classification |
|---|---|---|
| `/` | Historical Walker/legacy App shell | Reject student compositor; retain model donors |
| `/course/six-acts` | Six-act index/launcher and route WIP | Reject text/card base; WIP |
| `/course/tle-journey` | Text-heavy TLE lesson | Reject presentation; retain runtime donors |
| `/course/energy-lab` | Text/chart/reveal energy surface | Reject presentation; retain model donors |
| `/prototype/scientific-explain-legacy-3d` | Legacy 3D | Visual donor only; old semantics rejected |
| `/prototype/global-constellation` | Global scene | Candidate evidence only |
| `/prototype/visual-first-golden-flow` | Golden scene | Candidate evidence only |
| `/simulator`, `/visual-lab`, `/explain` | Unified Visual Lab aliases | Runtime/session donor; compositor not accepted |
| `/prototype/scientific-explain`, `/prototype/scientific-explain-3d`, `/prototype/visual-lab-g0` | Compatibility aliases | Same donor/runtime boundary; no owner pixel PASS |

## 5. Current-state classification

| Surface/evidence | Classification | Decision |
|---|---|---|
| Canonical TLE/SGP4, immutable-frame model, session/runtime, source traces, export/provenance helpers | KEEP | Retain through named current seams |
| Golden screenshots/video/manifest/source | CANDIDATE | Scene-first artifacts exist; event proof and owner PASS absent |
| Global screenshots/video/manifest/source | CANDIDATE | Geometry/count/height candidate; journey and owner PASS absent |
| Four simulation-source toggle files | QUARANTINE | Unintegrated late WIP; preserve, do not import |
| MULTIBEAM SDD machine/runtime checkpoint and model/export donors | KEEP donor / QUARANTINE presentation | Machine checkpoint says owner visual acceptance remains pending (`docs/sdd/MULTIBEAM-LEO-ENERGY-VISUAL-LAB-SDD.md:1-3,162-178,1325-1335`) |
| Fixed three-column compositor, persistent rails/chrome, all-beats-mounted overlay, dashboard shell | REJECT | Contradicts scene-first correction |
| Text-heavy TLE/Energy pages and course cards | REJECT presentation | Model/data donors may survive; reading-wall UI may not |

The backlog current-state table records the same boundary at
`docs/sdd/TEACHING-SIMULATOR-HIERARCHICAL-BACKLOG.md:1086-1106`.

## 6. Evidence taxonomy and claim ceiling

| Claim | Evidence class |
|---|---|
| Branch, HEAD, stable hash, dirty inventory, route/source references | VERIFIED at the named checkpoint; static/read-only only |
| Prior recorder/browser commands, candidate manifests, screenshots/video | PROBABLE machine candidate evidence; not fresh execution or owner approval |
| Current browser execution of every route/beat | UNVERIFIED |
| Current pixels meeting stage/occlusion/caption thresholds | UNVERIFIED for acceptance; candidate pixels exist |
| Owner/controller visual or video acceptance | UNVERIFIED; no self-PASS |
| Platform API, live registration, persistence, query-back, credentials | UNVERIFIED / NOT PERFORMED |

No tests, browser run, API upload, route repair, scientific decision, or source
code change is claimed by this report. Within the WI-01 report-writer/reviewer
scope, the only write is this documentation record; other-session WIP exists
and is preserved separately. Machine green and prior browser claims remain
separate from current browser execution, current pixels, and human/controller
acceptance.

## 7. Conclusion and stop boundary

WI-01 has a preserved, independently reviewable preflight snapshot with the
stable `35bffd1…` quiescence evidence, route inventory, authority map, and
KEEP/CANDIDATE/QUARANTINE/REJECT classification. It is
**CANDIDATE_EVIDENCE**, not self-`PASS`.

Required next review: independent read-only review of this file against the
current checkout and the stable-checkpoint caveat. The backlog stop token
remains `WAITING_FOR_REVIEW_WI-01`; only the controller may record
`PASS_WI-01` and unlock WI-02. No commit or push is authorized.
