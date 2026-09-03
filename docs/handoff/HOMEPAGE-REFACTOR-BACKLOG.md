# Homepage `/` Refactor Backlog

Date: 2026-09-03  
Scope: `/` only; browser acceptance is fixed to `http://127.0.0.1:3000/`.

This is the current traceability ledger for the homepage requests in the
controller conversation. Repeated requests are intentionally consolidated into
one acceptance criterion, but each request family is represented below. This
file is a checklist, not proof of completion: `done` requires module evidence
and, where the item is visual or interactive, port-3000 browser evidence.

## Mandatory alignment gate at every checkpoint

Before moving from one refactor seam to the next, rerun the same four checks;
a green module test alone never advances a visual criterion to `done`:

1. Source truth: the real homepage cell-truth path must produce an intra first
   with the same satellite, the same geographic cell, and a distinct beam; the
   later inter must change satellite and remain on the same primary UE.
2. Decision truth: the accepted decision, not a rail or scene projection, must
   select the qualifying candidate with the highest same-frame EE evidence.
3. Projection truth: scene and rail must carry the same accepted
   `snapshotId`, `sourceFrameId`, phase, and join keys; the scene must retain
   one serving/target solid link.
4. Browser truth: repeat the relevant flow on `http://127.0.0.1:3000/` and
   record pixels/DOM, phase, speed, canvas health, and console/page errors.

The 1/7/19 cell controls are display fan-out examples. They must not create
three decision policies or change the intra/inter geometry above. If any check
fails, keep the item in progress and fix the smallest owner seam before
starting the next visual change.

### Recheck cadence

Run the alignment gate again at each of these boundaries: after a source,
decision, snapshot, scene, rail, transport, or render-gate change; after any
1/7/19 configuration change; and immediately before each frontend checkpoint
is reported. The repeatable source-side command is:

```bash
npm run validate:homepage:alignment
npm run test:homepage:alignment
```

The first command must continue to report the same natural source pair unless
the source configuration was intentionally changed and its new pair is
reviewed. The second command must remain green. Neither command replaces the
required browser gate on `http://127.0.0.1:3000/`.

### Latest periodic recheck — 2026-09-03 03:40 (Asia/Taipei)

- Source/decision: **PASS** — `466–626 s`, intra `476 s` stays on one
  satellite/geographic cell and changes `B1 → B421`; its accepted target EE
  is higher than the serving EE; inter `606 s` changes satellite; both targets
  are checked against same-frame EE evidence.
- Module: **PASS** — `test:homepage:alignment` is `17/17`, now including the
  scene projection, rail projection, and shared EE metrics tests; TypeScript
  and `git diff --check` are green.
- Port 3000 spot gate: **PARTIAL PASS** — fresh CLI browser loads the homepage
  with title `LEO Beam Sim` and zero console errors; a ready accepted frame
  joined the scene/rail host on the same snapshot/source/phase. A separate
  18-second fresh run remained in the initial build/evaluating state before
  natural markers and rendered-link telemetry appeared, so the full interactive
  flow is still not a browser PASS.
- Full browser harness: **OPEN** — direct Chromium launch in this environment
  exits with `SIGTRAP` before the page assertion phase; this is an environment
  receipt, not a product PASS. The existing legacy-manager/raw-vs-accepted
  publication seam and generic non-homepage transition semantics remain open
  risks and must not be silently folded into the homepage acceptance claim.
- Workers: **2 Luna-max read-only audits dispatched** for this checkpoint, one
  for source/module alignment and one for port-3000 acceptance; they have no
  write access and no agy worker is used. Their reports remain advisory and do
  not replace the module/browser gates above.

## Status summary

| Status | Count | Meaning |
|---|---:|---|
| done | 3 | Evidence is sufficient for the narrow criterion listed. |
| in progress | 20 | Code or tests exist, but integration, browser proof, or a remaining edge case is open. |
| pending | 0 | Not implemented or intentionally waiting on an upstream decision/seam. |
| unverified | 2 | The implementation may exist, but the required current-runtime proof is missing. |
| **total** | **25** | Repeated wording is counted once by acceptance criterion. |

## Requirement ledger

| ID | Request family / acceptance criterion | Status | Evidence or next gate |
|---|---|---|---|
| H-01 | Read the three homepage authority documents; preserve dirty WIP; keep other routes read-only; no reset/stash/clean/commit/push. | done | Authority docs were read; current branch/WIP and route boundary remain preserved. |
| H-02 | Read-only preflight: identify unique writers, duplicate clocks/decisions/snapshots/render gates, actual `/` runtime/source, safe seams, and the port-3000 baseline. | in progress | Source authority and the natural-story mismatch are now evidenced; stale browser validators and a final port-3000 gate receipt still need closure. |
| H-03 | Establish one pipeline: `PlaybackTransport → SourceFrameAdapter → HandoverDecision → AcceptedHandoverPresentationSnapshot → SceneProjection + RailProjection`. | in progress | Controller modules/tests exist and the live scene/event index now share one homepage source-trajectory input; final App/MainScene acceptance receipt remains. |
| H-04 | Dispatch parallel non-heavy workers A–F with explicit file allow/deny lists, no second clock/decision/presentation flag, and one integration owner. | in progress | The latest two non-heavy Luna-max read-only rechecks have ended; active=0 at the latest checkpoint. agy remains unavailable after execution-environment failures. Integration owner is the only writer of shared App/MainScene seams; reports remain evidence, not completion. |
| H-05 | Fix main-screen acceleration and selected/effective speed so speed changes actually affect the homepage runtime without a competing clock. | in progress | Root-cause audit is active; needs port-3000 proof of requested speed, effective speed, and motion over time. |
| H-06 | `Next Intra` must produce a visible same-satellite intra choreography, not only dim/jog/switch. | done | Port-3000 spot check observed `handoverPresentationActive=1`, source `manual`, kind `intra`, releasing phase, and a rendered triggered cone. Full phase-envelope QA remains under H-23. |
| H-07 | `Next Inter` must produce the corresponding cross-satellite presentation and not be a dead/index-only control. | unverified | Current code has the indexed/replay path; current live port-3000 inter click and rendered-pair receipt still need capture. |
| H-08 | Changing configured serving/candidate satellite or beam counts must rebuild/invalidate stale event data and correctly enable/disable Next Intra/Inter. | in progress | Gate/index code is under audit; needs a browser sequence: change counts, wait for rebuild, then click both controls. |
| H-09 | Make the two-hour window deterministic and identify one or more demo windows that can explain intra first and inter second. | in progress | Shared source trajectory is now deterministic; after restricting primary decisions to the primary geographic cell, the 2 s/100-UE diagnostic gives intra at `t=476 s` followed by inter at `t=606 s` (`primaryJogEastKm=10`). Port-3000 natural playback/replay still needs acceptance. |
| H-10 | Reduce the homepage satellite palette from 16 colors to six; remove red and purple/blue mixing; keep the blue family blue. | in progress | Six hue families and no red/purple are covered by module tests; runtime contrast and every rendered layer still need browser proof. |
| H-11 | Add a separate tab/page showing the six color families. | in progress | Root-only `衛星顏色 / Satellite colors` tab and `HomepagePaletteTab` module/test are wired; current port-3000 visual/tab proof remains open. |
| H-12 | Guarantee one satellite = one hue family across all beams and the serving-beam outer frame, with primary beam darker/stronger and other beams much paler; stacked beams must not drift to another hue or white. | in progress | Shared visual-identity projection and pale context tiers are implemented/tested; dense overlap and all scene layers need visual acceptance. |
| H-13 | Keep serving/candidate colors sufficiently far apart during inter handover, and keep a candidate’s primary hue stable after commit. | in progress | Stable source-slot family mapping and candidate-primary tier are implemented; pair-distance and post-commit browser proof remain. |
| H-14 | Compute EE live for all displayed satellite/beam records and use EE strength for beam shade. | in progress | `beamMetrics`/snapshot paths expose EE and drive color tiers; formula/source audit and runtime sampling for every displayed row remain. |
| H-15 | Redesign the right rail around only serving/candidate satellites and beams; show Power, EE, SINR and Throughput; counts follow scene configuration; no independent candidate/handover calculation. | in progress | `HomepageBeamRail` consumes one rail projection and renders serving/candidates with per-beam metrics; browser count/identity/empty-state checks remain. |
| H-16 | Provide one-click expand/collapse for all displayed satellite groups; remove the old bottom four folded details and redundant full-beam detail area. | in progress | `homepage-beam-rail-toggle-groups` and bounded groups exist; port-3000 expand/collapse and absence of retired blocks need proof. |
| H-17 | Keep the right rail dark, readable, numeric-first, and avoid oversized raw numbers by using `k/M/G` units. | in progress | Dark tokens, compact numeric formatter, and larger numeric layout exist; visual/browser readability and all metric fields still need checking. |
| H-18 | Remove unnecessary top blocks: Beam values, selected speed, observation, actual speed/status, qualification blocks, and snapshot/source/phase block. | in progress | Homepage auxiliary UI is disabled and the new rail test rejects several retired blocks; full DOM audit of `/` is still required. |
| H-19 | Localization/content cleanup: zh must actually localize; use `Power` and English `Throughput`; remove duplicate “即時”; do not show “walker”. | in progress | Rail labels/tests cover `Power`, `Throughput`, no duplicate `即時`, and no visible `Walker`; formula/left-panel and full zh browser audit remain. |
| H-20 | Use exact active TLE satellite names in the center and right rail; Starlink/OneWeb changes must stay synchronized. | in progress | Homepage name-map seam now feeds center and rail; exact archived-TLE source switching is not yet browser-accepted on `/`. |
| H-21 | Verify every displayed value has a defensible symbol-table/paper formula and that left-side symbols match `docs/SYMBOL-SOURCE-OF-TRUTH.md`. | unverified | The agy runner could not start the formula audit; no completion claim until a read-only report and focused tests are reviewed. |
| H-22 | Scene and rail must consume the same snapshot identity, sourceFrameId, phase, speed, EE and join keys; one solid data link and candidate visibility must hold through handover. | in progress | Shared snapshot metadata/datasets and scene telemetry exist; current browser identity/phase/link receipt is still being collected. |
| H-23 | Browser QA on port 3000: scene/rail identity, phase, speed, intra/inter rendering, one-solid-link, candidate visibility, dark rail, zh/en, names, expand/collapse, compact values, and console errors. | in progress | Port 3000 is running; a focused intra spot check passed, while the complete matrix is still open. |
| H-24 | Update or replace stale homepage browser validators so they target the current rail/telemetry contract rather than removed selectors. | in progress | `src/app/homepageHandoverControlsOwnership.test.ts` now matches the current single-owner fallback; other validators still wait for retired selectors such as `walker-results-rail`. |
| H-25 | Keep all edits scoped to the homepage refactor and preserve the existing WIP while workers report files, commands, results and unresolved issues. | done | Current work has not reset/stashed/cleaned/committed/pushed; worker prompts enforce the shared-file and route boundaries. |

## Conversation coverage notes

These earlier messages are indexed here so they are not mistaken for missing
features or counted repeatedly as separate tickets:

| Earlier topic | Recorded under |
|---|---|
| Why acceleration appears to fail; selected versus effective speed and auto-slow behavior | H-05 |
| Why `Next Intra`/`Next Inter` can look inert, and why count changes affect their availability | H-06–H-08 |
| Whether `B3/C3/F2` are beam identity labels and how beam naming should be explained | H-15/H-20 content contract; no separate render owner |
| Whether the serving-beam outline should share the beam hue | H-12 |
| `Power` versus Chinese translation, English `Throughput`, and removal of duplicate `即時` | H-19 |
| Removing snapshot/source/phase, speed/status, beam-values, observation, and qualification blocks | H-18 |
| How many workers are active, why file seams matter, Codex versus agy, and the no-stop/WIP rules | H-04/H-25 |

## Current dependency order

1. Finish H-02/H-04 audits and collect worker reports.
2. Close H-05/H-07/H-08 around the single transport, decision and presentation
   gates.
3. Finish H-10/H-12/H-13 visual identity acceptance and H-14 formula-backed EE.
4. Complete H-15–H-20 rail/content cleanup, including the pending palette tab.
5. Update H-24 validators, then run H-23 as the final port-3000 gate.

## Evidence commands used for the current snapshot

```text
node --import tsx/esm src/homepage/controller/homepageSatelliteVisualIdentity.test.ts
node --import tsx/esm src/homepage/controller/homepageSatelliteDisplayName.test.ts
node --import tsx/esm src/homepage/controller/beamMetrics.test.ts
node --import tsx/esm src/app/homepageHandoverControlsOwnership.test.ts
node --import tsx/esm src/scene/multiCandidateMainSceneIntegration.test.ts
node --import tsx/esm src/viz/MultiCandidateBeamScene.test.ts
node --import tsx/esm src/scene/manualHandoverDemo.test.ts
npx tsc --noEmit --pretty false
git diff --check
```

The commands above are module/type/style checks only. They do not substitute
for H-23’s browser acceptance.
