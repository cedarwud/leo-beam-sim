# WI-03 Golden Flow truth contract

Status: **PASS_WI-03**  
Prerequisite token: `PASS_WI-02`  
Independent fresh-context reviewer: **PASS**  
Controller decision: **PASS_WI-03**  
Next work-item stop: `WAITING_FOR_REVIEW_WI-04`

This work item freezes one truthful 84-second / 12-beat Golden Flow contract
and records its acceptance for WI-04 authoring/review. The PASS accepts only
the WI-03 structure/truth contract: scene-defined observable events for every
beat, one guided prediction/action, counterfactual isolation, and fail-closed
restore/source-handover evidence. It does not accept product pixels, the
current compositor, candidate screenshots/video, the WI-09 full scientific
source-backed event lesson, route cutover, EE experiment readiness, platform
readiness, commit, or push. Owner/compositor pixel acceptance remains WI-04.

## Changed paths

- `docs/sdd/VISUAL-FIRST-GOLDEN-FLOW-STORYBOARD.md`
- `src/prototype/golden-flow/goldenFlowDirector.ts`
- `src/prototype/golden-flow/goldenFlowDirector.test.ts`
- `docs/reviews/TEACHING-SIMULATOR-WI-03-TRUTH-CONTRACT-2026-08-24.md`

No compositor TSX/SCSS, route, package, App/main, scientific formula, platform,
Global/TLE implementation, or backlog implementation was changed by WI-03;
the controller's publication-only gate synchronizes the WI-03/WI-04 status in
the hierarchical backlog.

## Contract delivered

The director now exposes a machine-readable contract for all 12 ordered beats
and exactly 84 seconds. Every beat declares the learning question, visible
phenomenon, camera pose/target/transition, speed and slow-motion state, allowed
controls, hidden/unmounted surfaces, freeze state, primary cue, at-most-two
captions, truth namespace/source/evidence IDs, capture/slide status, learner
action, expected observation, causal explanation, misconception guard,
unavailable/failure/recovery/reset behavior, and one canonical
`completion.evidenceKey`.

The guided state exists only at `interaction`. It carries a mandatory
prediction prompt, an optional one-gesture beam-axis response with a limit of
one, and a prediction evidence key. Runtime progress records an explicit
`'gesture' | 'skip' | null` response: a gesture requires exactly one gesture
plus response/action evidence, while skip requires zero gestures plus explicit
skip response evidence. An implicit null/zero-gesture response cannot
complete. All other beats are autoplay with nullable guided fields and their
own canonical `completion.evidenceKey`; guidance does not duplicate that key.

Control timing is typed rather than inferred from the presence of a control
ID. The guided-pause controls are available at elapsed time zero only for
`interaction`; every other beat exposes no controls, and beat 12 mounts
`replay`/`next` only at its six-second stable hold. The director also asserts
that legacy `camera`/`speed` fields equal `cameraSpec.pose`/`playback.speed`.

The controlled comparison is explicitly namespaced as
`teaching-counterfactual`. It fixes time, satellite, UE, and elevation, permits
only beam-axis movement, allows only off-axis/approved angle-aware-link changes,
and forbids replay, handover, or platform persistence. The restore check covers:

```text
sourceFrameId
replayIdentity
servingSatelliteId
candidateSatelliteId
handoverManagerState
eventCount
platformSampleCount
platformRecordCount
persistedCounterfactualSampleCount === 0
```

Source-backed beats carry exact event/action/source/target/offset/TTT/trace
evidence locators. Commit requires `action=inter-handover` and non-null source
evidence. The typed trace contract binds `expectedCount=2`,
`qualification.anchors[0]` and `[1]` in strictly increasing index/instant
order, `phase=qualification-to-commit`, `connector=none`, and the non-empty
`selection.traceDigest`; the loader fails closed when those source anchors or
the digest are unavailable. The restore helper likewise fails closed for empty
identities (including a nullable candidate), non-finite/negative/non-integer
counts, or any non-zero persisted counterfactual count. Forbidden claims
include counterfactual-to-handover causality, brightness-as-measured-SINR,
full ranking, continuous traces, interruption or signalling claims,
energy/policy/optimization success, platform saved/uploaded/persisted claims,
live telemetry, attach/stay/intra or TLE-as-handover claims, and legacy
required-SINR/requested-power/cap semantics.

The storyboard additionally records the fixture ledger, director/evidence
state split, unavailable/failure/recovery/reset/completion paths, forbidden
claim list, and the twelve-frame capture matrix. It explicitly says that these
internal paragraphs are not student pixels; the student surface remains a
scene-first animation with transient captions.

## Evidence and known gaps

**Verified by this work item:**

- 12 exhaustive beat IDs in the required order and total nominal duration of
  84 seconds;
- one and only one guided beat (`interaction`);
- controls match the beat allowlist;
- guided-pause controls are available immediately, all other beats expose none,
  and beat-12 replay/next unlock only at `stableHoldSec >= 6`;
- one unique primary cue per beat and candidate → qualification → TTT → trace
  → commit → receipt cue order;
- all required director fields and one non-empty canonical
  `completion.evidenceKey` per beat;
- legacy camera/speed aliases remain equal to their typed camera/playback
  fields, and new-normal capture/stable-hold metadata is asserted;
- guided progress accepts only an explicit gesture or skip response, with the
  required gesture/response/action evidence for each path;
- separate counterfactual namespace and explicit restore equality fields;
- restore equality is valid only when identities and finite non-negative
  integer counts are present and persisted counterfactual samples are zero;
- source-backed inter event/action and offset/TTT evidence locators;
- exactly two strictly ordered pinned qualification anchors, the typed
  qualification-to-commit trace locators, and a non-empty trace digest in the
  loaded source fixture;
- captions remain at most two lines and only actual eyebrow/caption copy is
  checked against the Traditional-Chinese positive forbidden-claim list; and
- pure restore-equality and guided-progress helpers exercise both passing and
  failing cases.

**Known gaps, intentionally not hidden:**

1. Existing Golden UI/artifacts remain candidate visual donors. This WI does not
   implement or accept the scene-first compositor; WI-04 owns browser pixels,
   video, and owner acceptance after `PASS_WI-03`.
2. The current runtime does not yet expose a complete director geometry frame or
   production beam-axis transaction. The contract therefore defines an honest
   unavailable/fail-closed path for those fields.
3. The pinned teaching-window event is a candidate fixture. WI-09 must validate
   the complete source-backed inter lesson and event evidence before any full
   handover claim is accepted.
4. Intra-handover, TLE raw→parse→SGP4 animation, the EE experiment, platform
   upload, and slide/video production remain downstream work items.

## Checks

```text
node --import tsx/esm src/prototype/golden-flow/goldenFlowDirector.test.ts  PASS
npx tsc --noEmit                                                   PASS
```

The focused test is a pure model/contract test. It is not a browser-pixel,
video, scientific-event, or owner compositor acceptance gate. WI-09 still owns
full scientific source-backed event acceptance.

The exact next stop is:

```text
WAITING_FOR_REVIEW_WI-04
```
