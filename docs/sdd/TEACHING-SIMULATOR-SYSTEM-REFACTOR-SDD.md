# Teaching Simulator System Refactor SDD

Status: **ACTIVE — implementation authority**  
Baseline: `c12b67c827c598dcd9a680c55f8ef69b2b571a53`  
Branch: `refactor/teaching-simulator-system-v1`  
Started: 2026-09-11

## 1. Product north star

Build a classroom-ready LEO satellite handover and energy-efficiency simulator:

- an instructor can run deterministic, repeatable teaching stories;
- a student can complete a guided predict → operate → observe → explain flow;
- live/replay/teaching inputs share one presentation pipeline;
- a simple rendering request reaches one named policy instead of many sinks;
- a wrong edit fails with a specific executable signal instead of a false green.

The refactor exists to reduce the cost and uncertainty of developing that product.
File size reduction alone is not an acceptance criterion.

## 2. Two tracks run in parallel

### Track T — teaching design and slides

Track T may discuss lesson structure, write slide decks, captions, storyboards, and
scenario requirements. It writes only courseware/design/documentation locations.
It does not edit production rendering, simulation, or decision code.
### Track R — system refactor

Track R starts immediately in an isolated worktree. It establishes source, story,
composition, appearance, and renderer ownership without waiting for Track T.
It does not redesign lesson content or tune scientific outputs.

### The only integration boundary

Track T supplies a versioned `TeachingScenarioContract`: learning objective,
allowed student controls, deterministic inputs, phase sequence, required evidence,
and captions. Track R supplies the runtime schema and presentation capabilities.
Neither track reaches across this boundary by editing the other track's internals.

## 3. Authority of this document

This is the only active execution plan for the system refactor. Existing SDDs,
audits, handoffs, and worker reports remain evidence and constraints; they are not
parallel implementation authorities. An ADR may supersede a named product decision.
Progress lives in `teaching-simulator-system-current-state.yaml`, not in competing
status appendices.

Every work item must map to:

```text
product capability → SDD requirement → active phase → allowed files → executable gate
```

A red result does not authorize repairing unrelated nearby failures.
## 4. Fixed architectural direction

```text
source / deterministic fixture / replay
                ↓
        canonical story frame
                ↓
      scene composition plan
                ↓
 scene projection + rail projection + captions
                ↓
       mechanical renderers
```

The target rules are:

1. one owner for source time and commands;
2. one primary handover decision frame;
3. one accepted story boundary for scene, rail, and captions;
4. one identity/appearance composition policy;
5. one scene composition plan that names every mounted surface and why;
6. renderers paint supplied records and do not infer story, winner, or fallback;
7. teaching and live events differ at the input adapter, not at the renderer.

## 5. Immediate scope

The first migration seam is the final scene composition boundary, because that is
where otherwise-correct policies are recombined into dozens of JSX booleans.
The first slice covers the core beam/handover surfaces only and preserves current
visual behavior byte-for-byte where practical.

It explicitly does **not** change geometry, palette, EE values, candidate ranking,
TTT, commit logic, lesson copy, or route behavior.
## 6. Phases and gates

| Phase | Deliverable | Exit condition |
|---|---|---|
| R0 | isolated worktree, baseline, active SDD/current-state | parent WIP untouched; known baseline failures recorded |
| R1 | exhaustive scene surface registry and pure core surface plan | current mount semantics reproduced by table tests; production reads the plan |
| R2 | normalized `HandoverStoryFrame` adapters | live, teaching fixture, and replay use one vocabulary; no renderer-specific story truth |
| R3 | full `SceneRenderPlan` | every user-visible surface has owner/source/reason and render identity |
| R4 | scene/rail/caption projections share one accepted frame | same story/source/snapshot IDs across all three surfaces |
| R5 | deterministic instructor vertical slices | 7-beam Intra then Inter can reset, pause, replay, and survive speed changes |
| R6 | student guided-flow pilot | one complete predict → operate → observe → explain → reset activity |
| R7 | legacy retirement and shell decomposition | duplicate renderers/fallbacks removed; shells split only along proven contracts |
| R8 | maintainability holdout | fresh-context agent completes an unseen small render change or gets a precise red gate |

No phase is allowed to become a general repository cleanup campaign.

## 7. R1 exact acceptance

R1 migrates these decisions out of `MainScene` JSX without changing their truth:

- non-serving, serving, cinema-source-fan, and candidate cone mounts;
- natural pulse, triggered-intra, cinema-pair, and authority-pair cone mounts;
- serving and candidate footprint mounts;
- beam callouts;
- teaching handover cones.

The plan must record `mounted`, effective `visible`, story owner, source class,
and a stable reason code. Browser telemetry must expose the active owner and mounted
surface IDs. Table-driven tests must cover steady, candidate review, handover,
teaching, hidden-stage, empty-inventory, and isolation cases.
## 8. Execution protocol

The controller owns scope, acceptance, diff review, and phase advancement.
Implementation workers may edit only an explicit production allow-list. They may
not edit acceptance contracts, goldens, or gates unless the work item specifically
assigns that responsibility to an independent evaluator.

Each change must:

1. begin from this isolated branch or its own child worktree;
2. preserve the protected parent checkout;
3. name the SDD requirement and current phase;
4. state intended and preserved surfaces before editing;
5. prove the relevant test can fail before relying on its green result;
6. compare the actual diff, not the worker's report;
7. commit one concern after focused and baseline-difference validation.

A source-text pin that fails because code moved is a baseline/governance problem.
It must not be re-pinned to the new file merely to make a refactor green.

## 9. Stop and anti-drift rules

Stop the current work item when its phase gate is met. Do not automatically repair:

- unrelated browser failures;
- product-entry decisions;
- scientific-model discrepancies;
- obsolete prototype routes;
- visual polish outside the active scenario;
- neighboring technical debt that does not block the active contract.
A finding outside the active gate is recorded in current-state with evidence and
an owner/blocker classification. A red finding is an outcome, not repair authority.

## 10. Definition of done for the programme

The programme is complete only when:

- instructor Intra and Inter stories are deterministic, resettable, pausable, and
  share the same renderer as live/replay inputs;
- one student guided activity can be completed without exposing unsafe controls;
- scene, rail, and captions carry the same story/snapshot identity;
- every visible surface is registered and explained by the production render plan;
- identity, role, metric intensity, and transition effects each have one owner;
- leaf renderers do not read raw simulation/decision state or invent fallback truth;
- legacy duplicate paths are deleted after replacement parity, not merely hidden;
- large React shells are reduced along those proven boundaries rather than by
  moving closure state into wide, untestable hooks;
- an unseen small rendering request reaches one policy and updates all applicable
  surfaces without editing renderer sinks or acceptance rules.

## 11. Current known baseline exception

At clean baseline `c12b67c`, `npm run lint` and all 85 appearance tests pass.
`npm run check:baseline` is red because
`src/app/homepageHandoverControlsOwnership.test.ts` pins an obsolete literal JSX
shape inside `App.tsx`. R1 records this as a pre-existing source-pin failure and
must not divert into repairing it unless it blocks the focused R1 evidence.

## 12. R1 execution record — 2026-09-11

R1 is implemented in the isolated worktree. The first production boundary now
contains an exhaustive top-level surface registry and a pure plan for twelve
core beam/handover surfaces. `MainScene` no longer decides those twelve mount
conditions inline; it consumes the plan output and publishes story owner,
mounted/visible surface IDs, and reason codes on the live canvas.

Evidence:

- `npm run lint`: PASS;
- `npm run test:scene-surfaces`: 11/11 PASS, including 4,096 migrated-gate parity samples;
- `npm run test:appearance`: 85/85 PASS;
- `npm run test:multi-candidate`: 182/182 PASS;
- `npm run validate:architecture:boundaries`: 6/6 PASS, no new ratchet violations;
- `validate:scene-surface-plan:browser`: PASS, 12/12 reasons published;
- mutation proof: deleting the reason publication makes the browser gate RED;
  byte-exact restoration returns it to GREEN.

Known baseline reds remain unchanged: the App ownership source-text pin, the
scene-presentation motion-guide source-text pin, two pre-existing orphan tests,
and the pre-existing `validate-frame-plan.ts` scripts type error. None belongs
to R1 and none was repaired or re-pinned in this checkpoint.

## 13. Stage 0 checkpoint integration — 2026-09-11

The complete pre-refactor WIP was first committed and pushed as `d66b816` on
`wip/ee-handover-authority-2026-09-05`; the parent worktree is now clean.
This branch then merged that checkpoint before starting R2.

The only content conflict was the twelve R1 mount gates in `MainScene.tsx`.
Resolution kept the typed surface plan and moved the newer WIP semantics into
that plan instead of restoring JSX exceptions:

- a teaching lecture suppresses the four independent live event-cone surfaces;
- turning Beam Info off keeps callouts off during handover instead of a hidden
  handover state forcing them back on;
- all twelve surfaces still publish owner, source, mount and visibility reasons.

Post-integration evidence: TypeScript PASS; scene-surface 11/11; appearance
96/96; multi-candidate 182/182; browser plan 12/12 reasons; TLE, first-frame,
full-run artifact, global-constellation and homepage-projection checks PASS.
The known source-text pin failures remain recorded, not re-pinned.
## 14. R2 execution record — 2026-09-12

R2 establishes one immutable, renderer-neutral `HandoverStoryFrame` vocabulary
for four existing source classes without changing their scientific or visual
ownership:

- accepted Walker or archived-TLE decision evidence;
- natural, manual, or cinema presentation events;
- authored teaching fixtures;
- recorded artifact-replay frames.

The public seam remains `src/scene/handoverStoryFrame.ts`. Its implementation is
split under `src/scene/handover-story/` into contracts, validation/freezing,
source adapters, and source-set arbitration; the largest production module is
182 lines. The authored teaching scene descriptor moved out of the cone renderer
and into this contract layer, so a visual sink no longer declares story truth.

Every normalized frame carries exact source/target identity, phase, source clock,
claim class, and provenance. Accepted EE keeps snapshot, episode, and source-frame
identity; authored EE remains explicitly authored; replay preserves source-native
beam tokens and fails closed on missing transition truth. Every frame fixes
`decisionInputAllowed` to `false`.
Production now publishes this boundary read-only on both the live/TLE scene and
the artifact-replay scene. Canvas telemetry exposes the active source, available
sources, story/pair identity, claim class, producer, accepted identity fields,
and clock basis. It does not change a decision, advance a clock, select a winner,
or alter any renderer input.

R2 changes no simulation physics, EE values, candidate ranking, TTT, commit
behavior, palette, geometry, camera, or lesson copy.

Evidence:

- `npm run lint`: PASS;
- `npm run test:all`: PASS;
- `npm run test:handover-story`: 14/14 PASS;
- `npm run test:scene-surfaces`: 11/11 PASS;
- `npm run test:appearance`: 96/96 PASS;
- `npm run test:multi-candidate`: 182/182 PASS;
- `npm run validate:architecture:boundaries`: 6/6 PASS, no new ratchet violations;
- both scene-surface and handover-story production browser gates: PASS;
- mutation proof: corrupting authored provenance makes focused tests RED, and
  corrupting the canvas active-source publication makes the browser gate RED;
  byte-exact restoration returns both gates to GREEN.

`npm run check:baseline` remains RED only at the pre-existing obsolete
`homepageHandoverControlsOwnership.test.ts` source-text pin encountered at the
same location as before R2. It was not re-pinned or weakened in this phase.

## 15. R3 execution record — 2026-09-12

R3 replaces the remaining top-level scene mount decisions with one exhaustive
`SceneRenderPlan`. The plan is produced for the live, archived-TLE, and
artifact-replay lanes and contains one decision for every registered
user-visible surface.

The registry now contains 31 surfaces. In addition to the twelve R1 core
beam/handover surfaces, R3 explicitly registers the cinematic spotlight,
campus, horizon boundary, and narrative caption that were previously outside
the composition inventory. Each decision carries:

```text
mounted · visible · owner · source · reasonCode
renderIdentity · storyId · storyPairKey
```

The public seam is `src/scene/sceneRenderPlan.ts`; implementation is split under
`src/scene/scene-render-plan/` into contracts, decisions, composition, and
formatting. `src/scene/sceneHandoverStoryFrameSet.ts` is the one raw-input adapter
shared by production and later audit callers.

Both production scene paths now consume the plan mechanically. The live/TLE
path reads it for the campus/floor, spotlight, horizon cue, UAV/UEs, motion
layers, satellite markers, candidate views, accepted cue, all core beam layers,
caption, shockwave, toast, and diagnostics. The artifact-replay path uses the
same vocabulary for its campus/floor, UE, satellite, and diagnostics surfaces.
No scientific producer, candidate ranking, TTT, commit, palette, geometry,
camera, or lesson value was changed.

The initial migration exposed one real parity defect before acceptance: the
first draft of the horizon-boundary decision omitted the existing
`sceneLane === 'sinr-live'` restriction. R3 now carries that restriction as an
explicit `showHorizonBoundary` control. The 4,096-case parity test was also
corrected to sample a non-correlated pseudo-random bit; the earlier low-bit LCG
sequence could make a mutation vacuously green.

`SceneRenderPlanCanvasTelemetry` publishes the complete plan on the production
canvas: lane and story identity; mounted and visible sets; and one owner,
source, reason, and render identity for each of the 31 surfaces. The browser
gate cross-checks the twelve R1 core decisions against the R3 plan and enters a
real authored Intra lecture, where it requires actual teaching cone geometry
before accepting the teaching surface as mounted.

Evidence:

- `npm run lint`: PASS;
- `npm run test:all`: PASS, including the new R3 aggregate;
- `npm run test:scene-render-plan`: 6/6 PASS, including 4,096 mount-parity samples;
- R2 handover-story tests: 14/14 PASS;
- R1 scene-surface tests: 11/11 PASS;
- appearance tests: 96/96 PASS;
- multi-candidate tests: 182/182 PASS;
- architecture boundary checks: 6/6 PASS, no new ratchet violations;
- core surface browser gate: 12/12 PASS;
- handover-story browser gate: PASS;
- full scene-render browser gate: 31/31 PASS, including R1/R3 parity and real
  teaching geometry;
- mutation proof: removing the horizon lane gate makes the parity test RED;
  removing the owner publication makes the browser gate RED; byte-exact
  restoration returns both to GREEN.

`npm run check:baseline` still has exactly the known obsolete
`homepageHandoverControlsOwnership.test.ts` source-text pin failure: 126 tests
pass and that one test fails. R3 did not re-pin, weaken, or hide it. R4 may now
begin at the scene/rail/caption identity boundary.

## 16. R4 execution record — 2026-09-12

R4 establishes one accepted handover identity projection for the production
scene, homepage rail, narrative caption, authored teaching rail/caption, and
teaching cone renderer. The shell now normalizes the accepted, teaching, and
replay inputs once, composes immutable `HandoverSurfaceBinding` records once,
and passes those exact records to each surface. The scene may still add its
existing local presentation animation frame, but it cannot replace or repair
the accepted, teaching, or replay identity supplied by the shell.

The pre-migration inventory found four independent interpretation points:

- `MainScene` could rebuild accepted and teaching frames from raw props and use a
  scene-local fallback when a shared publication was absent;
- `HomepageBeamRail` read `projection.handoverStory`, remapped the engine phase,
  rebuilt source/target identity, and inferred accepted provenance locally;
- the authored teaching rail, caption, and cone renderer consumed overlapping
  script/story inputs and could reconstruct the same lecture independently;
- the narrative caption intentionally held chapter text, but that hold also left
  its identity telemetry on an older accepted snapshot for one to three seconds.

These paths created duplicate projection, local phase inference, fallback truth,
and identity loss at component boundaries even though the underlying decision
and teaching sources were valid.
The public seam is `src/scene/handoverSurfaceBinding.ts`, with implementation
split under `src/scene/handover-surface-binding/` into contracts, resolution,
DOM attributes, and contract status. The shell-owned projection composers are:

- `resolveHandoverAcceptedSurfaceProjection` for accepted scene/rail/caption
  identity and rail-root consistency;
- `resolveHandoverTeachingSurfaceProjection` for one authored lecture frame,
  phase, clock, and fixture provenance;
- `resolveBoundSceneHandoverStoryFrameSet` for mechanically combining the shared
  accepted/teaching/replay frames with the existing scene-local presentation.

Every comparable surface publishes the same complete identity record:

```text
story source · story ID · handover kind · source/target pair key · phase
committed state · snapshot ID · episode ID · source-frame ID
clock basis/current/duration · producer · claim class
decision-evidence class · disclosure · decision-input permission
teaching-fixture or accepted-decision provenance · canonical identity key
```

Production surfaces use `handoverSurfaceIdentityAttributes` for this telemetry.
The accepted rail receives only the shell-composed projection and owns no local
phase or identity composer. The teaching rail, teaching caption, and teaching
cones receive the same `HandoverTeachingSurfaceProjection`. Renderer code no
longer chooses a winner or guesses source/target, phase, or provenance.
The caption defect discovered by the production gate was corrected without
changing caption timing or copy. `SceneNarrativeCaption` still uses the existing
chapter hold policy for visible text, but its audit attributes follow the live
App-owned accepted binding on the canvas render loop. This prevents a held
chapter from publishing a stale snapshot, source frame, or clock identity.

Acceptance is intentionally separated from implementation. The independent
contract in `scripts/lib/handover-surface-acceptance.ts` does not import the
production composer. It compares every required field across scene, rail, and
caption, and separately cross-checks accepted canvas telemetry against the root
accepted snapshot publication. The production browser gate covers live accepted
identity plus real authored Intra and Inter fixtures.

Mutation proof is non-vacuous at both levels:

- focused tests independently mutate every comparable scene/rail/caption field,
  plus accepted root snapshot, episode, source-frame, phase, and clock fields;
- the browser gate pauses the real timeline, corrupts the story ID on the scene,
  rail, and caption one at a time, requires RED for each mutation, restores the
  attribute, and requires GREEN again.

R4 changes no simulation physics, EE value, candidate order, TTT, commit behavior,
palette, geometry, camera, or course copy. It creates no second clock, winner
selection, or accepted snapshot.

Evidence:

- `npm run lint`: PASS;
- `npm run test:all`: PASS;
- `npm run test:handover-surface-binding`: 20/20 PASS;
- handover-story tests: 14/14 PASS;
- scene-surface tests: 11/11 PASS;
- scene-render-plan tests: 6/6 PASS;
- appearance tests: 97/97 PASS;
- multi-candidate tests: 182/182 PASS;
- `npm run validate:architecture:boundaries`: 6/6 PASS, no new ratchet
  violations;
- core scene-surface browser gate: 12/12 PASS;
- handover-story browser gate: PASS;
- full scene-render browser gate: 31/31 PASS;
- R4 production browser gate: accepted, authored Intra, authored Inter, and DOM
  mutation red→green proof PASS.

`npm run check:baseline` remains RED only at the pre-existing obsolete
`src/app/homepageHandoverControlsOwnership.test.ts` source-text regex pin: 126
pass and one fails. R4 did not re-pin, weaken, or hide that failure. R5 may now
begin from the shared projection boundary.

## 17. R5 execution record — 2026-09-12

R5 turns the R4 identity boundary into one deterministic instructor-controlled
vertical slice. The versioned scenario is
`homepage-seven-beam-intra-inter-v1`: a 72-second same-satellite Intra story
followed on the same source-time axis by a 72-second cross-satellite Inter story.
A direct Inter entry begins at source time 72 seconds but still consumes the
same scenario contract, transport, story vocabulary, projection composer, and
renderers.

The public scenario and transport seams are:

- `src/homepage/teaching/instructorHandoverScenario.ts`;
- `src/homepage/teaching/instructorHandoverTransport.ts`;
- `src/homepage/teaching/useInstructorHandoverTransport.ts`;
- `src/homepage/teaching/instructorHandoverTelemetry.ts`.

The scenario contract fixes the schema/version, exact seven-beam admission,
Intra-then-Inter segment order, phase markers, allowed instructor controls, and
required scene/rail/caption surfaces. The pure transport owns source time,
entry window, play/pause, restart, reversible seek, completion, and the
`1x/2x/5x/10x/20x` speed set. It contains no browser or wall-clock API. The React
adapter is the only runtime ticker and advances that pure state with animation
frame deltas; story resolution remains a pure function of scenario source time.

Opening an authored scenario freezes the live scientific producer and disables
its timeline/rail controls. The live pause and speed values are restored on
close. A fixture is latched per scenario run and segment, so live roster
re-ranking cannot change the same replayed source-time frame. Admission fails
closed unless both serving and candidate topology counts are exactly seven.

During implementation, the first draft still armed the older manual handover
presentation when the authored script reached `switching`. That path had its own
wall-clock lifetime and endpoint reconstruction, which would have introduced a
second transition clock and a second source/target authority. R5 removes that
teaching-only trigger. The existing non-teaching manual Intra fallback remains
unchanged; authored teaching cones now paint only the shell-owned R4 projection.

The production root, scene canvas, teaching rail, and teaching caption publish
one comparable instructor telemetry envelope: scenario/version, beam count,
run and entry identity, segment, status, pause and speed, source and local time,
entry window, completion, story and pair identity, phase, and committed state.
The independent contract in
`scripts/lib/instructor-handover-acceptance.ts` does not import production
scenario or projection composers.

The R5 browser gate exercises the actual production controls. It proves pause
freezes source time, all five speeds preserve the story at fixed source time,
seek works at every major phase and both commit boundaries, restart reconstructs
the same story with a new run ID, Intra crosses into early Inter without phase
skipping, direct Inter uses the 72–144 second window, switching geometry carries
the shared story ID, the live timeline remains locked, and closing restores the
prior live pause/speed state.

Mutation proof is non-vacuous at both levels:

- focused acceptance tests mutate every comparable scene/rail/caption field and
  root source time, and require RED;
- the production browser gate corrupts scene, rail, and caption story identity
  independently, restores each DOM attribute, and requires GREEN again.

R5 changes no simulation physics, EE values, candidate ranking, TTT, commit
behavior, palette, geometry, camera, or lesson copy. It adds no second winner,
accepted snapshot, source clock, or renderer-local story inference.

Evidence:

- `npm run lint`: PASS;
- `npm run test:all`: PASS, including the R5 aggregate;
- `npm run test:instructor-handover`: 33/33 PASS;
- handover-surface-binding tests: 22/22 PASS;
- handover-story tests: 14/14 PASS;
- scene-surface tests: 11/11 PASS;
- scene-render-plan tests: 6/6 PASS;
- appearance tests: 97/97 PASS;
- multi-candidate tests: 182/182 PASS;
- `npm run validate:architecture:boundaries`: 6/6 PASS, no new ratchet
  violations;
- R1 core scene-surface browser gate: 12/12 PASS;
- R2 handover-story browser gate: PASS;
- R3 full scene-render browser gate: 31/31 PASS;
- R4 shared identity browser gate: PASS;
- R5 deterministic instructor browser gate: PASS, including production mutation
  red→green and live transport restoration.

`npm run check:baseline` remains RED only at the pre-existing obsolete
`src/app/homepageHandoverControlsOwnership.test.ts` source-text regex pin: 126
pass and one fails. The queueability assertions in that same file remain green;
R5 introduces zero new failure signatures.

R5 is now a merge-candidate checkpoint. The next action is an isolated
integration rehearsal rooted at the current target branch; it must not modify
the protected parent checkout. R6 product work begins only after that rehearsal
proves the checkpoint can be integrated with the same aggregate, architecture,
browser, mutation, and baseline-difference evidence.

## 18. R5 integration rehearsal — 2026-09-12

The first integration rehearsal was performed in a new worktree and branch,
without checking out, resetting, stashing, or modifying the protected parent
checkout:

```text
worktree: /home/u24/demo/leo-beam-sim-integration-rehearsal
branch: integration/teaching-simulator-r5-rehearsal
target: wip/ee-handover-authority-2026-09-05 @ d66b816
R5 checkpoint: 7c6259625d91f61dd889a30c34e70727b621526d
rehearsal merge: 7a8a6e9690a3376a24a8a695d48af51430ecea2e
```

The target commit is an ancestor of the R5 checkpoint. The rehearsal used an
explicit two-parent merge commit rather than advancing the protected checkout.
It completed with zero conflicts, and the merge commit's tree was byte-identical
to the R5 checkpoint before this rehearsal record was added.

The rehearsal independently repeated the release evidence from the integration
worktree:

- `npm run lint`: PASS;
- `npm run test:all`: PASS;
- `npm run validate:architecture:boundaries`: 6/6 PASS with no new ratchet
  violations;
- R1 core scene-surface browser gate: 12/12 PASS;
- R2 handover-story browser gate: PASS;
- R3 full scene-render browser gate: 31/31 PASS;
- R4 shared identity and production mutation gate: PASS;
- R5 instructor Intra-to-Inter and production mutation gate: PASS;
- `npm run check:baseline`: exactly 126 PASS and the one pre-existing obsolete
  `homepageHandoverControlsOwnership.test.ts` source-text pin failure.

The browser suite was served from the integration worktree on its own port, so
it did not consume a server rooted in the refactor worktree. The integration
branch is therefore a verified R5 merge candidate and the recommended base for
R6. This rehearsal is not the final merge into the protected target branch;
that branch remains unchanged at `d66b816`.
