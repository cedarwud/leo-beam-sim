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
