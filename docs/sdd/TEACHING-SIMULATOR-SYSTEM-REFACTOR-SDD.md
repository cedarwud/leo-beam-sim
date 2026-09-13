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

## 19. R6 student guided-flow pilot — 2026-09-13

R6 was implemented in the isolated child worktree
`/home/u24/demo/leo-beam-sim-r6` on
`refactor/teaching-simulator-r6-guided-flow`, rooted at the verified R5
integration rehearsal commit `1d1564e7b4c5238c76bef0b818ea0ef0ffe8a2ec`.
R6 did not reset, stash, check out, merge, cherry-pick, or modify the
protected parent, refactor, integration-rehearsal, or eight-act worktrees. The
final audit found independent uncommitted work already present in the eight-act
worktree; it was left untouched and was not incorporated into R6.

### 19.1 Versioned activity contract

The production contract is
`src/homepage/teaching/studentHandoverActivityContract.ts`:

```text
schema version: 1
activity ID: r6-intra-guided-flow-v1
activity version: 1
R5 scenario: homepage-seven-beam-intra-inter-v1 @ version 1
segment / entry point: Intra / 0 s
steps: Predict -> Operate -> Observe -> Explain -> Complete -> Reset
bounded checkpoints: 20 s, 40 s, 52 s
reset identity: r6-intra-guided-flow-v1:predict:clean
```

Predict offers `stay-serving`, `switch-target`, and
`insufficient-evidence`. Entering Operate assigns a per-run activity ID and
locks the prediction; subsequent prediction changes and second locks are
rejected. Operate exposes one bounded action only. Observe advances in declared
order through candidate comparison, conditions/hold, and commit receipt.
Explain uses a finite choice set and requires at least one observed,
comparable evidence claim. Complete emits an immutable receipt carrying schema,
activity, scenario, segment, run, prediction, explanation, evidence, checkpoint,
and receipt identity.

The reducer is pure and rejects every illegal step transition, out-of-order
checkpoint, malformed observation, unobserved evidence claim, incomplete
observation sequence, missing explanation, missing comparable claim, and reset
before Complete. It owns no source time, phase, winner, accepted snapshot,
scenario frame, timer, or simulation input.

### 19.2 R5 transport and scientific ownership

The R5 instructor transport remains the only source-time owner. The student
state machine can only place a pending bounded-checkpoint command. App then:

1. pauses the existing R5 transport;
2. seeks that transport to the checkpoint's declared source time;
3. waits for the exact R4/R5 projection to land; and
4. records evidence claims from that shared projection.

There is no second clock, interval, animation timer, copied source time, local
winner selection, local phase derivation, local source/target reconstruction,
or alternate accepted snapshot. `studentHandoverActivityEvidence.ts` fails
closed unless scenario/version, Intra entry, paused transport, source time,
teaching phase, story phase, and shared projection all agree. It reads the
existing teaching EE floor constant and never writes power, TTT, offset,
ranking, topology, EE, physics, or commit state.

The production activity contract deliberately contains no checkpoint answer
key. The separately maintained oracle in
`scripts/lib/student-handover-acceptance.ts` imports no production activity
reducer, evidence projector, R4 projection composer, telemetry composer, or UI.
That oracle owns the acceptance truth used by focused and browser mutation
gates.

### 19.3 Student-safe control boundary

The R6 inventory found these pre-existing control groups on the teaching
homepage:

- shell visibility controls;
- six-acts entry, simulation-source switching, direct Intra/Inter instructor
  entry, and SINR quick controls;
- general `ControlBar` camera/display controls;
- left-side signal, handover-policy, power, TTT, offset, topology, candidate,
  and scientific controls;
- bottom timeline seek, step, play/pause, and speed controls;
- R5 instructor rail play/pause, restart, seek, speed, close, and direct Inter
  workflow.

While student mode is active, the shell visibility controller, six-acts entry,
simulation-source switch, SINR quick controls, `ControlBar`, direct instructor
Intra/Inter controls, and R5 instructor rail are not mounted. The scientific
left sidebar is hidden and `aria-hidden`. The existing bottom timeline may
remain in layout, but its seek, step, play/pause, speed, and scrubber controls
are disabled by the active R5 transport. The right rail is forced visible and
contains only the student allow-list. Inter remains intact for instructor mode
and R5 regression coverage, but student mode cannot enter it.

Preserved student-safe surfaces are the shared scene, shared caption, bounded
student activity panel, locale switch, and teacher-led/group-vote prompt. The
allow-list is limited to prediction selection/lock, starting and advancing the
bounded observation, choosing an explanation and observed evidence, completing,
resetting after Complete, and exiting from clean Predict. No account,
leaderboard, persistent score, multi-user state, or network synchronization was
introduced.

All projection-facing activity copy, the mode banner, progress labels, teacher
prompt, choices, evidence labels, receipt, reset, and exit controls support
zh-TW and English. The production browser gate changes locale in Predict and
proves the projected title, prompt, banner, and progress labels update without
changing activity identity or progress.

### 19.4 Raw-state, fallback-truth, and residual-state audit

The student panel does not read raw simulation state. Launch admission reuses
the existing shell lane/source and exact seven-beam R5 admission predicate;
scientific evidence comes only from the shell-owned R4/R5 projection. No
student renderer or component infers winner, phase, source/target, pair key,
commit state, or checkpoint truth. There is no fallback scientific truth in the
production contract or reducer.

The teaching caption is stateless with respect to chapter hold: it renders the
current R5 projection directly and owns no queue, timer, ref, or alternate
presentation clock. The student panel also owns no timer or caption queue. Its
only ref is a monotonically increasing activity run sequence, which is an
identity token rather than a source-time owner.

Reset is accepted only from Complete. It reconstructs the normalized active
Predict state, clears prediction, lock, activity run ID, pending checkpoint,
observations, temporary selections, explanation, evidence selections, receipt,
and activity telemetry, then restarts and pauses the R5 transport at Intra
source time 0. Scene, rail, caption, activity, story ID, pair key, phase,
committed state, scenario, and source time return to the same initial identity.
The R5 instructor run ID intentionally increments, proving that a real restart
occurred. No previous Inter identity, checkpoint, receipt, evidence selection,
or presentation owner survives.

### 19.5 Acceptance and mutation evidence

Focused R6 tests cover the full legal and illegal transition matrix, prediction
lock negatives, checkpoint order and malformed observations, evidence support,
completion receipt, source-time determinism, reset deep equivalence, source/DOM
control ownership, production answer-key absence, and acceptance-oracle
independence: 17/17 pass.

The production browser gate exercises the real UI and completes:

```text
Predict -> Operate -> Observe(20 s -> 40 s -> 52 s)
        -> Explain -> Complete -> Reset -> clean exit
```

It proves the teacher-led prompt has a readable projected box and typography;
zh-TW and English copy switch in place; unsafe controls are absent, hidden, or
disabled; the same source time yields the same R5 story; root, scene, rail,
caption, and activity publish comparable activity/story/scenario telemetry;
and reset returns to the initial normalized identity while the instructor run
ID changes from 1 to 2.

Mutation proof is independently RED then GREEN for activity step, activity run
ID, prediction lock, story ID, pair key, source time, checkpoint, explanation
evidence claims, reset identity, and checkpoint scientific evidence. The
production implementation does not define the oracle's expected values.

Final phase evidence:

- `npm run lint`: PASS;
- `npm run test:student-handover`: 17/17 PASS;
- `npm run test:all`: PASS, including R1-R6 aggregates;
- `npm run validate:architecture:boundaries`: 6/6 PASS with no new ratchet
  violations;
- `npm run build`: PASS, 1254 modules transformed; only the pre-existing large
  chunk advisory remains;
- R1 core scene-surface browser gate: 12/12 PASS;
- R2 normalized handover-story browser gate: PASS;
- R3 full scene-render-plan browser gate: 31/31 PASS;
- R4 shared identity and production mutation browser gate: PASS;
- R5 deterministic instructor Intra-to-Inter browser gate: PASS;
- R6 student guided-flow browser gate: PASS, including bilingual projection,
  full flow, deterministic reset, and ten production mutation cases.

`npm run check:baseline` remains exactly the known baseline difference: 127
tests, 126 pass, one failure at the obsolete
`src/app/homepageHandoverControlsOwnership.test.ts` source-text regex pin, and
zero new failure signatures.

R6 is complete and is a formal product merge candidate. The protected target
`/home/u24/demo/leo-beam-sim` remains unchanged. R7 legacy retirement has not
started; any formal integration or later R7 decision requires a separate
owner-directed phase.

## 20. R6 formal integration — 2026-09-13

The owner authorized the separate formal-integration phase after accepting the
R6 product merge candidate. Integration was performed in the isolated worktree
`/home/u24/demo/leo-beam-sim-r6-formal-integration` on
`integration/teaching-simulator-r6-formal`; the protected target was not changed
until the merged product tree completed every release gate.

The lineage is explicit:

```text
target before integration:
  wip/ee-handover-authority-2026-09-05
  d66b816b998d591005eccaf4bdcd159f20489314

R6 product candidate:
  refactor/teaching-simulator-r6-guided-flow
  ffd87e454dd4c0d74029462267d26dc8a7cfd1df

formal merge:
  a48f307c961d2c62ed619ef8704fc23d19da6985
  parents: d66b816b998d591005eccaf4bdcd159f20489314
           ffd87e454dd4c0d74029462267d26dc8a7cfd1df
```

The merge used `--no-ff --no-commit`, completed with zero conflicts, and was
validated before commit. Its pre-receipt index tree was
`8ac21d80dbf963e69877e19e5924141d0ea2e705`, byte-identical to the R6 candidate
tree. Therefore the integration introduced no production, test, package, or
control-document drift before this receipt was added.

`git diff --cached --check` reported only the three existing Markdown hard-break
spaces on SDD lines 3–5. The exact same output and exit code occur for the source
candidate diff `d66b816..ffd87e4`; no integration-only whitespace signature was
introduced, and the validated candidate tree was not rewritten to remove it.

The exact merged product tree independently repeated the complete release
matrix from the formal-integration worktree:

- `npm run lint`: PASS;
- `npm run test:student-handover`: 17/17 PASS;
- `npm run test:all`: PASS;
- `npm run validate:architecture:boundaries`: 6/6 PASS, no new ratchet
  violations;
- `npm run build`: PASS, 1,254 modules transformed; only the inherited large
  chunk advisory remains;
- R1 scene-surface browser gate: 12/12 PASS;
- R2 normalized handover-story browser gate: PASS;
- R3 full scene-render-plan browser gate: 31/31 PASS;
- R4 shared-identity browser gate: PASS with production mutation red→green;
- R5 deterministic instructor Intra-to-Inter and direct-Inter browser gate:
  PASS;
- R6 student Predict → Operate → Observe → Explain → Complete → Reset browser
  gate: PASS, including bilingual projection, teacher-led prompt readability,
  safe-control enforcement, deterministic reset, and ten mutation cases.

`npm run check:baseline` remains the sealed baseline difference: 127 tests,
126 pass, and one failure at the obsolete
`src/app/homepageHandoverControlsOwnership.test.ts` source-text regex pin. There
are zero new failure signatures.

After this docs-only receipt, the protected target is advanced only by
fast-forward to the receipt commit and pushed without reset, stash, force,
cherry-pick, or history rewriting. The R6 candidate branch and formal-integration
branch remain as audit lineages. The eight-act worktree is not merged or
modified. R7 legacy retirement has not started and requires a new owner gate.

## 21. R7 owner gate and exact scope — 2026-09-13

The owner authorized R7 from the formally integrated target at
`4013420bd249c6770ca6acba83d8c59a79cebf45`. Work occurs only in
`/home/u24/demo/leo-beam-sim-r7` on
`refactor/teaching-simulator-r7-legacy-retirement`; the integrated target and
the independent eight-act worktree remain protected.

R7 is not a general cleanup or file-size campaign. It retires only duplicate
truth and renderer paths that R1–R6 already replaced, then splits the App shell
along those proven contracts. The exact authorized slice is:

1. make the App-owned R4 `HandoverSurfaceBindingSet` mandatory for production
   scene composition and remove `MainScene` reconstruction of accepted,
   teaching, or replay truth; only the existing scene-local presentation frame
   may augment a live lane;
2. retire the standalone `/prototype/intra-handover-teaching` SVG renderer and
   its private clock/transport, preserving the old URL as a compatibility
   redirect to the canonical homepage R5/R6 experience;
3. extract R5/R6 teaching transport, activity, projection, telemetry, and reset
   orchestration from `App.tsx` into named app boundaries without moving raw
   simulation state or decision ownership into those modules.

R7 must not delete the scientific service-continuity fallback, change the live
manual handover behavior used by non-homepage lanes, alter route-independent
course prototypes, merge eight-act work, or change physics, EE, ranking, TTT,
commit semantics, palette, geometry, camera, or lesson copy.

Acceptance must independently prove that the retired route cannot mount its old
renderer, `MainScene` cannot recreate shell-owned story truth, the extracted
App boundaries own no source clock or decision state, R1–R6 browser gates remain
green, and the known baseline difference remains exactly 126 pass / one sealed
source-text regex pin.

## 22. R7 execution record — 2026-09-13

R7 was completed in the isolated worktree
`/home/u24/demo/leo-beam-sim-r7` on
`refactor/teaching-simulator-r7-legacy-retirement`, rooted at the formally
integrated target commit `4013420bd249c6770ca6acba83d8c59a79cebf45`.
The integrated target and the independent eight-act worktree were not reset,
stashed, checked out, merged, cherry-picked, or modified.

### 22.1 Mandatory App-owned story authority

`MainScene` and `SceneHandoverStoryCanvasTelemetry` now require a non-null
`MutableRefObject<HandoverSurfaceBindingSet>`. Production can no longer omit the
shell boundary and trigger a renderer-local reconstruction. Accepted, teaching,
and replay bindings retain the exact objects composed by App. The only frame a
live or archived-TLE scene may add is its existing presentation-animation frame;
artifact replay accepts only the shell-owned replay binding.

`resolveBoundSceneHandoverSurfaceBindingSet` expresses this rule directly. It
preserves exact accepted, teaching, and replay binding references, creates at
most one local presentation binding, and resolves the active binding without
re-normalizing shell-owned story truth. Focused tests prove both the live and
artifact lanes preserve the exact shared binding objects. The R7 acceptance
oracle turns red if MainScene or canvas telemetry makes the ref optional, reads
it through optional chaining, or imports a local binding-set composer.

### 22.2 Standalone renderer retirement

The standalone `/prototype/intra-handover-teaching` surface duplicated the
canonical R5/R6 experience with its own SVG renderer and private teaching
transport. R7 deletes:

```text
src/prototype/intra-handover-teaching/IntraHandoverTeachingPrototype.tsx
src/prototype/intra-handover-teaching/IntraHandoverTeachingPrototype.scss
scripts/validate-intra-handover-teaching-browser.ts
```

The reusable pure teaching director and source tests remain because they are not
a renderer or competing runtime owner. Old bookmarks are preserved by
`src/app/legacyRouteRetirement.ts`: before route classification, the old path is
replaced with `/`, existing query parameters and the hash are retained, and
`retiredSurface=intra-handover-teaching` records the compatibility transition.
The production browser gate opens the real retired URL and proves that the
canonical homepage and R6 launcher mount while all old renderer test IDs remain
absent.

### 22.3 App shell decomposition

Two named boundaries now own only the policies already proven by R4–R6:

- `useAppHandoverTeachingStage` mounts the existing R5 transport and R6 activity,
  latches the deterministic fixture, freezes/restores playback, and exposes the
  bounded open, close, reset, and clean-exit commands;
- `useAppHandoverSurfaceRuntime` composes the App-owned story/binding set,
  accepted and teaching projections, comparable telemetry refs/attributes, and
  the bounded student checkpoint/evidence effect.

`App.tsx` no longer contains the fixture latch, playback-restore ref, scenario
frame resolver, story/binding/projection composers, telemetry composers, or
checkpoint seek/evidence effect. App fell from 3,164 to 2,884 lines, a net
reduction of 280 lines along proven contracts rather than an arbitrary file-size
split. The extracted modules contain no `useState`, private timer, animation
frame, wall-clock read, raw `SimState` owner, candidate ranking, or decision
state. R5 remains the only source-time owner.

R7 does not remove the scientific service-continuity fallback or the
non-homepage manual handover path. It changes no physics, EE value, candidate
ranking, TTT, commit semantics, palette, geometry, camera, or lesson copy.

### 22.4 Independent acceptance and mutation proof

`scripts/lib/r7-legacy-retirement-acceptance.ts` imports no production module.
It checks source ownership and deletion contracts independently. Six focused
tests pass, including file-absence and compatibility-route contracts. Nine
independent mutations turn the gate red when they reintroduce an old renderer,
remove an App boundary, restore inline App ownership, make a binding optional,
restore local scene composition, or add a clock/decision owner to an extracted
module.

The full production matrix passes from an R7-specific server:

- `npm run lint`: PASS;
- `npm run test:r7-retirement`: 6/6 PASS;
- handover-surface binding tests: 24/24 PASS;
- instructor handover tests: 33/33 PASS;
- student handover tests: 17/17 PASS;
- `npm run test:all`: PASS, including the R7 aggregate;
- `npm run validate:architecture:boundaries`: 6/6 PASS with no new ratchet
  violations;
- `npm run build`: PASS, 1,253 modules transformed versus 1,254 at R6; only the
  inherited large-chunk advisory remains;
- R1 scene-surface browser gate: 12/12 PASS;
- R2 normalized handover-story browser gate: PASS;
- R3 full scene-render-plan browser gate: 31/31 PASS;
- R4 shared-identity and production mutation browser gate: PASS;
- R5 deterministic instructor Intra-to-Inter and direct-Inter gate: PASS;
- R6 student guided-flow and ten production mutations: PASS;
- R7 retired-route compatibility gate: PASS, with the old renderer DOM absent.

The broken-script-reference audit is green across 220 scripts. Two unrelated
static ratchets remain byte-for-byte equivalent to the integrated target:
`validate:test-orphans` has the same three orphan signatures, and
`validate:unreferenced-components` has the same seven red signatures within 22
unreferenced modules. R7 scans one fewer component because the retired renderer
was deleted; it introduces no new static-red signature and does not repair
unrelated baseline debt.

`npm run check:baseline` remains exactly 127 tests, 126 pass, and the single
sealed `src/app/homepageHandoverControlsOwnership.test.ts` source-text regex pin
failure. There are zero new failure signatures.

R7 is complete and is a product merge candidate. The protected target remains
at `4013420bd249c6770ca6acba83d8c59a79cebf45`. Formal R7 integration requires a
separate owner-authorized phase. The eight-act workstream remains independent,
and R8 maintainability holdout has not started.
