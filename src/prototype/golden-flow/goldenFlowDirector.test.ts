import assert from 'node:assert/strict';

import {
  GOLDEN_FLOW_BEATS,
  GOLDEN_FLOW_BEAT_IDS,
  GOLDEN_FLOW_COUNTERFACTUAL_BARRIER,
  GOLDEN_FLOW_FORBIDDEN_CLAIMS,
  GOLDEN_FLOW_INTERACTION_BEAT_INDEX,
  GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC,
  GOLDEN_FLOW_INTERACTION_END_COURSE_TIME_SEC,
  GOLDEN_FLOW_INTERACTION_START_COURSE_TIME_SEC,
  GOLDEN_FLOW_NAMESPACE_TRANSITIONS,
  GOLDEN_FLOW_NOMINAL_DURATION_SEC,
  GOLDEN_FLOW_RESTORE_EQUALITY_FIELDS,
  GOLDEN_FLOW_REVIEW_FRAME_OFFSET_SEC,
  GOLDEN_FLOW_SEGMENTS,
  GOLDEN_FLOW_TRACE_EVIDENCE,
  GOLDEN_FLOW_VISIBLE_COPY_FORBIDDEN_CLAIMS,
  assertGoldenFlowContract,
  assertGoldenFlowVisibleCopySafe,
  beatToCourseTime,
  courseTimeToBeat,
  goldenFlowBeatIndex,
  goldenFlowBeatHasAuthoredMotionHold,
  goldenFlowCheckRestoreEquality,
  goldenFlowControlsAvailable,
  goldenFlowGuidedProgressComplete,
  goldenFlowInteractionStateForCourseTime,
  goldenFlowMotionState,
  goldenFlowReplayBeatIndex,
  goldenFlowReviewFrameCourseTime,
  goldenFlowSegmentDurationSec,
  goldenFlowSegmentForAct,
  goldenFlowShouldStopAtEnd,
  loadGoldenFlowTruth,
  type GoldenFlowEvidenceState,
} from './goldenFlowDirector';

// This is a contract gate, not a visual or owner acceptance claim.
assertGoldenFlowContract();

assert.equal(GOLDEN_FLOW_BEATS.length, 12);
assert.deepEqual(GOLDEN_FLOW_BEATS.map(beat => beat.id), GOLDEN_FLOW_BEAT_IDS);
assert.equal(GOLDEN_FLOW_NOMINAL_DURATION_SEC, 108);
assert.equal(new Set(GOLDEN_FLOW_BEATS.map(beat => beat.primaryCue)).size, 12);
assert.equal(GOLDEN_FLOW_BEATS.filter(beat => beat.guidance.mode === 'guided').length, 1);
assert.equal(GOLDEN_FLOW_BEATS.find(beat => beat.guidance.mode === 'guided')?.id, 'interaction');
assert.ok(GOLDEN_FLOW_BEATS.every(beat => beat.caption.length <= 2));
assert.ok(GOLDEN_FLOW_BEATS.every(beat => beat.capture.screenshot === 'required'));
assert.ok(GOLDEN_FLOW_BEATS.every(beat => beat.capture.status === 'candidate-evidence'));
assert.ok(GOLDEN_FLOW_BEATS.every(beat => beat.completion.evidenceKey.length > 0));
assert.ok(GOLDEN_FLOW_BEATS.every(beat => beat.camera === beat.cameraSpec.pose));
assert.ok(GOLDEN_FLOW_BEATS.every(beat => beat.speed === beat.playback.speed));

const interaction = GOLDEN_FLOW_BEATS.find(beat => beat.id === 'interaction')!;
const restore = GOLDEN_FLOW_BEATS.find(beat => beat.id === 'restore')!;
assert.deepEqual(interaction.controls, ['ue-drag']);
assert.equal(interaction.eyebrow, '03 · 拖動 UE，觀察理想補償功率需求與相對 EE');
assert.equal(interaction.learningQuestion, 'UE 離開波束中心後，理想補償功率需求與相對 EE 如何改變？');
assert.equal(
  interaction.guidance.predictionPrompt,
  'UE 離開波束中心後，理想補償功率需求與相對 EE 會如何改變？',
);
assert.equal(interaction.guidance.optionalGesture?.gestureLimit, 1);
assert.equal(interaction.guidance.predictionEvidenceKey, 'golden.counterfactual.prediction-recorded');
assert.equal(interaction.completion.evidenceKey, 'golden.counterfactual.action-complete');
assert.deepEqual(goldenFlowControlsAvailable(interaction, 0), interaction.controls);
assert.deepEqual(goldenFlowControlsAvailable(interaction, Number.NaN), []);
assert.equal(interaction.freeze.time, 'frozen');
assert.equal(interaction.freeze.satellite, 'fixed');
assert.equal(interaction.freeze.ue, 'moving');
assert.equal(interaction.freeze.beamAxis, 'source');
assert.equal(interaction.truth.namespace, 'teaching-counterfactual');
assert.equal(goldenFlowBeatHasAuthoredMotionHold(interaction), true);
assert.equal(goldenFlowBeatHasAuthoredMotionHold(restore), true);
assert.equal(goldenFlowMotionState(true, true), 'frozen');
assert.equal(goldenFlowMotionState(false, false), 'frozen');
assert.equal(goldenFlowMotionState(true, false), 'moving');

for (const beat of GOLDEN_FLOW_BEATS.filter(currentBeat => currentBeat.id !== 'interaction')) {
  assert.equal(beat.guidance.mode, 'autoplay', `${beat.id} must remain autoplay`);
  assert.equal(beat.guidance.predictionPrompt, null, `${beat.id} has no prediction prompt`);
  assert.equal(beat.guidance.predictionEvidenceKey, null, `${beat.id} has no prediction evidence`);
  assert.equal(beat.guidance.optionalGesture, null, `${beat.id} has no learner gesture`);
  assert.equal(beat.learnerAction, null, `${beat.id} has no learner action`);
}

const handoverBeats = GOLDEN_FLOW_BEATS.filter(beat => beat.truth.namespace === 'source-backed-handover');
assert.equal(handoverBeats.length, 7);
for (const beat of handoverBeats) {
  assert.equal(beat.truth.sourceEvent?.eventIdEvidence, 'selection.logicalEventKey');
  assert.equal(beat.truth.sourceEvent?.action, 'inter-handover', `${beat.id} has source event action`);
  assert.equal(beat.truth.sourceEvent?.sourceSatelliteEvidence, 'pair.from.satelliteId');
  assert.equal(beat.truth.sourceEvent?.targetSatelliteEvidence, 'pair.to.satelliteId');
  assert.equal(beat.truth.sourceEvent?.offsetEvidence, 'window.handoverPolicy.offsetDb');
  assert.equal(beat.truth.sourceEvent?.tttEvidence, 'window.handoverPolicy.tttSec');
  assert.deepEqual(beat.truth.sourceEvent?.traceEvidence, GOLDEN_FLOW_TRACE_EVIDENCE);
}
const newNormal = GOLDEN_FLOW_BEATS.find(beat => beat.id === 'new-normal')!;
assert.equal(newNormal.playback.stableHoldSec, 6);
assert.deepEqual(goldenFlowControlsAvailable(newNormal, 5.999), []);
assert.deepEqual(goldenFlowControlsAvailable(newNormal, 6), ['replay', 'next']);
assert.deepEqual(goldenFlowControlsAvailable({
  ...newNormal,
  playback: { ...newNormal.playback, stableHoldSec: 5 },
}, 5), [], 'unstable beat-12 cannot expose replay/next');
assert.deepEqual(goldenFlowControlsAvailable(GOLDEN_FLOW_BEATS[0]!, 999), []);

const cueOrder = ['candidate-arrival', 'qualification-mark', 'ttt-ring', 'delta-trace', 'commit-pulse', 'event-receipt'];
assert.deepEqual(
  GOLDEN_FLOW_BEATS
    .filter(beat => cueOrder.includes(beat.primaryCue))
    .map(beat => beat.primaryCue),
  cueOrder,
);
assert.deepEqual(
  [
    GOLDEN_FLOW_NAMESPACE_TRANSITIONS[0]!.beatId,
    GOLDEN_FLOW_NAMESPACE_TRANSITIONS[1]!.beatId,
    GOLDEN_FLOW_NAMESPACE_TRANSITIONS[2]!.beatId,
    GOLDEN_FLOW_NAMESPACE_TRANSITIONS[3]!.beatId,
  ],
  ['angles', 'interaction', 'restore', 'candidate'],
);
assert.deepEqual(GOLDEN_FLOW_COUNTERFACTUAL_BARRIER.fixedDimensions, ['time', 'satellite', 'beam-axis', 'elevation']);
assert.equal(GOLDEN_FLOW_COUNTERFACTUAL_BARRIER.mutableDimension, 'ue-ground-position');
assert.deepEqual(GOLDEN_FLOW_COUNTERFACTUAL_BARRIER.forbiddenPersistence, ['replay', 'handover', 'platform']);
assert.deepEqual(GOLDEN_FLOW_COUNTERFACTUAL_BARRIER.equalityFields, GOLDEN_FLOW_RESTORE_EQUALITY_FIELDS);

const studentText = GOLDEN_FLOW_BEATS
  .flatMap(beat => [beat.eyebrow, ...beat.caption])
  .join(' ')
  .toLowerCase();
for (const forbiddenClaim of GOLDEN_FLOW_FORBIDDEN_CLAIMS) {
  assert.equal(studentText.includes(forbiddenClaim), false, `student copy contains forbidden claim: ${forbiddenClaim}`);
}
assertGoldenFlowVisibleCopySafe();
assert.ok(GOLDEN_FLOW_VISIBLE_COPY_FORBIDDEN_CLAIMS.length >= 20);
assert.equal(
  GOLDEN_FLOW_BEATS.some(beat => beat.causalExplanation.toLowerCase().includes('drag caused')),
  false,
);

const cleanRestoreState: GoldenFlowEvidenceState = {
  sourceFrameId: 'frame-before',
  replayIdentity: 'replay-before',
  servingSatelliteId: '49194',
  candidateSatelliteId: '55159',
  handoverManagerState: 'pending:55159:progress=30',
  eventCount: 4,
  platformSampleCount: 12,
  platformRecordCount: 1,
  persistedCounterfactualSampleCount: 0,
};
assert.equal(goldenFlowCheckRestoreEquality(cleanRestoreState, { ...cleanRestoreState }).equal, true);
assert.equal(goldenFlowCheckRestoreEquality(cleanRestoreState, { ...cleanRestoreState }).validBefore, true);
assert.equal(goldenFlowCheckRestoreEquality(cleanRestoreState, { ...cleanRestoreState }).validAfter, true);
assert.ok(Object.keys(goldenFlowCheckRestoreEquality(cleanRestoreState, { ...cleanRestoreState }).fields).length >= 9);
assert.equal(
  goldenFlowCheckRestoreEquality(cleanRestoreState, { ...cleanRestoreState, eventCount: 5 }).equal,
  false,
);
assert.equal(
  goldenFlowCheckRestoreEquality(cleanRestoreState, { ...cleanRestoreState, persistedCounterfactualSampleCount: 1 }).equal,
  false,
);
for (const invalidState of [
  { ...cleanRestoreState, sourceFrameId: '' },
  { ...cleanRestoreState, replayIdentity: '' },
  { ...cleanRestoreState, servingSatelliteId: null },
  { ...cleanRestoreState, candidateSatelliteId: null },
  { ...cleanRestoreState, handoverManagerState: '' },
  { ...cleanRestoreState, eventCount: Number.NaN },
  { ...cleanRestoreState, platformSampleCount: -1 },
  { ...cleanRestoreState, platformRecordCount: 1.5 },
]) {
  const result = goldenFlowCheckRestoreEquality(cleanRestoreState, invalidState);
  assert.equal(result.equal, false);
  assert.equal(result.validAfter, false);
}

assert.equal(goldenFlowGuidedProgressComplete({
  predictionShown: true,
  predictionRecorded: true,
  response: 'gesture',
  gestureCount: 1,
  responseEvidenceRecorded: true,
  actionEvidenceRecorded: true,
  completionEvidenceRecorded: true,
}), true);
assert.equal(goldenFlowGuidedProgressComplete({
  predictionShown: true,
  predictionRecorded: true,
  response: 'skip',
  gestureCount: 0,
  responseEvidenceRecorded: true,
  actionEvidenceRecorded: false,
  completionEvidenceRecorded: true,
}), true);
assert.equal(goldenFlowGuidedProgressComplete({
  predictionShown: true,
  predictionRecorded: true,
  response: null,
  gestureCount: 0,
  responseEvidenceRecorded: false,
  actionEvidenceRecorded: false,
  completionEvidenceRecorded: true,
}), false);
assert.equal(goldenFlowGuidedProgressComplete({
  predictionShown: true,
  predictionRecorded: true,
  response: 'gesture',
  gestureCount: 2,
  responseEvidenceRecorded: true,
  actionEvidenceRecorded: true,
  completionEvidenceRecorded: true,
}), false);

assert.deepEqual(
  GOLDEN_FLOW_BEATS.map(beat => beat.id),
  ['establish', 'angles', 'interaction', 'consequence', 'restore', 'candidate', 'qualification', 'ttt', 'trace', 'commit', 'receipt', 'new-normal'],
);
assert.equal(goldenFlowBeatIndex('commit'), 9);
assert.equal(goldenFlowBeatIndex('unknown'), null);

const act3 = goldenFlowSegmentForAct('3');
assert.deepEqual(
  [act3.startBeatId, act3.endBeatId, act3.startBeatIndex, act3.endBeatIndex],
  ['establish', 'restore', 0, 4],
);
assert.equal(goldenFlowSegmentDurationSec(act3), 36);
assert.equal(goldenFlowReplayBeatIndex(act3), 0);
assert.equal(goldenFlowShouldStopAtEnd(act3, 4), true);
assert.equal(goldenFlowShouldStopAtEnd(act3, 3), false);
assert.equal(act3.nextHref, '/course/handover-theater');

const act4 = goldenFlowSegmentForAct('4');
assert.deepEqual(
  [act4.startBeatId, act4.endBeatId, act4.startBeatIndex, act4.endBeatIndex],
  ['candidate', 'new-normal', 5, 11],
);
assert.equal(goldenFlowSegmentDurationSec(act4), 72);
assert.equal(goldenFlowReplayBeatIndex(act4), 5);
assert.equal(goldenFlowShouldStopAtEnd(act4, 11), true);
assert.equal(goldenFlowShouldStopAtEnd(act4, 10), false);
assert.equal(act4.nextHref, null);
assert.strictEqual(goldenFlowSegmentForAct(null), GOLDEN_FLOW_SEGMENTS.full);

const truth = loadGoldenFlowTruth();
assert.equal(truth.constellation, 'starlink');
assert.equal(truth.eventKind, 'teaching-handover');
assert.equal(truth.sourceSatelliteName, 'STARLINK A');
assert.equal(truth.targetSatelliteName, 'STARLINK B');
assert.equal(truth.sourceAction, 'teaching-handover');
assert.equal(truth.sourceEventId.length > 0, true);
assert.equal(truth.offsetDb, 3);
assert.equal(truth.tttSec, 30);
assert.equal(truth.qualification.length, 2, 'controlled Starlink lesson carries the threshold and TTT endpoints');
assert.equal(truth.traceDigest.length > 0, true);
assert.ok(truth.deltaSinrDb !== null && truth.deltaSinrDb >= truth.offsetDb);
assert.ok(truth.sourceSinrDb !== null);
assert.ok(truth.targetSinrDb !== null);
assert.equal(truth.sourceVisibleAtEvent, true);
assert.equal(truth.targetVisibleAtEvent, true);
assert.equal(truth.continuityReason, null);
assert.ok(truth.servingOffAxisDeg > 0);

const oneWebTruth = loadGoldenFlowTruth('oneweb');
assert.equal(oneWebTruth.constellation, 'oneweb');
assert.equal(oneWebTruth.eventKind, 'inter-handover');
assert.equal(oneWebTruth.sourceSatelliteId, '49194');
assert.equal(oneWebTruth.targetSatelliteId, '55159');
assert.equal(oneWebTruth.sourceAction, 'inter-handover');
assert.equal(oneWebTruth.qualification.length, 2, 'optional OneWeb comparison keeps two source anchors');
assert.ok(oneWebTruth.deltaSinrDb !== null && oneWebTruth.deltaSinrDb >= oneWebTruth.offsetDb);

// Deterministic Course Time Mapping & Segment Time Tests
assert.equal(GOLDEN_FLOW_INTERACTION_BEAT_INDEX, 2);
assert.equal(GOLDEN_FLOW_INTERACTION_START_COURSE_TIME_SEC, 13);
assert.equal(GOLDEN_FLOW_INTERACTION_END_COURSE_TIME_SEC, 23);
assert.equal(GOLDEN_FLOW_INTERACTION_CHECKPOINT_COURSE_TIME_SEC, 22.95);
assert.equal(GOLDEN_FLOW_REVIEW_FRAME_OFFSET_SEC, 1);

// Full Segment Mapping
const t0 = courseTimeToBeat(0);
assert.equal(t0.beatIndex, 0);
assert.equal(t0.beat.id, 'establish');
assert.equal(t0.beatElapsedSec, 0);
assert.equal(t0.beatProgress, 0);

const t5 = courseTimeToBeat(5);
assert.equal(t5.beatIndex, 1);
assert.equal(t5.beat.id, 'angles');
assert.equal(t5.beatElapsedSec, 0);

const t13 = courseTimeToBeat(13);
assert.equal(t13.beatIndex, 2);
assert.equal(t13.beat.id, 'interaction');
assert.equal(t13.beatElapsedSec, 0);

const t18 = courseTimeToBeat(18);
assert.equal(t18.beatIndex, 2);
assert.equal(t18.beat.id, 'interaction');
assert.equal(t18.beatElapsedSec, 5);
assert.equal(t18.beatProgress, 0.5);

const t23 = courseTimeToBeat(23);
assert.equal(t23.beatIndex, 3);
assert.equal(t23.beat.id, 'consequence');
assert.equal(t23.beatElapsedSec, 0);

const t108 = courseTimeToBeat(108);
assert.equal(t108.beatIndex, 11);
assert.equal(t108.beat.id, 'new-normal');
assert.equal(t108.beatElapsedSec, 10);
assert.equal(t108.beatProgress, 1);

// Out of bounds clamping
const tNeg = courseTimeToBeat(-10);
assert.equal(tNeg.beatIndex, 0);
assert.equal(tNeg.beatElapsedSec, 0);

const tOver = courseTimeToBeat(200);
assert.equal(tOver.beatIndex, 11);
assert.equal(tOver.beatElapsedSec, 10);
assert.equal(tOver.beatProgress, 1);

// beatToCourseTime
assert.equal(beatToCourseTime(0, 0), 0);
assert.equal(beatToCourseTime(0, 2.5), 2.5);
assert.equal(beatToCourseTime(1, 0), 5);
assert.equal(beatToCourseTime(2, 0), 13);
assert.equal(beatToCourseTime(2, 10), 23);
assert.equal(beatToCourseTime(11, 10), 108);

// Review Frame Time
assert.equal(goldenFlowReviewFrameCourseTime(0), 1);
assert.equal(goldenFlowReviewFrameCourseTime(1), 6);
assert.equal(goldenFlowReviewFrameCourseTime(2), 14);

// Interaction Checkpoint States
assert.equal(goldenFlowInteractionStateForCourseTime(0), 'awaiting');
assert.equal(goldenFlowInteractionStateForCourseTime(13), 'awaiting');
assert.equal(goldenFlowInteractionStateForCourseTime(22.9), 'awaiting');
assert.equal(goldenFlowInteractionStateForCourseTime(23), 'completed');
assert.equal(goldenFlowInteractionStateForCourseTime(30), 'completed');
assert.equal(goldenFlowInteractionStateForCourseTime(108), 'completed');
assert.equal(goldenFlowInteractionStateForCourseTime(10, act4), 'not-applicable');

// Act 3 Segment Time Mapping
const act3_0 = courseTimeToBeat(0, act3);
assert.equal(act3_0.beatIndex, 0);
assert.equal(act3_0.beat.id, 'establish');

const act3_36 = courseTimeToBeat(36, act3);
assert.equal(act3_36.beatIndex, 4);
assert.equal(act3_36.beat.id, 'restore');
assert.equal(act3_36.beatElapsedSec, 5);
assert.equal(act3_36.beatProgress, 1);

assert.equal(beatToCourseTime(4, 5, act3), 36);

// Act 4 Segment Time Mapping
const act4_0 = courseTimeToBeat(0, act4);
assert.equal(act4_0.beatIndex, 5);
assert.equal(act4_0.beat.id, 'candidate');
assert.equal(act4_0.beatElapsedSec, 0);

const act4_72 = courseTimeToBeat(72, act4);
assert.equal(act4_72.beatIndex, 11);
assert.equal(act4_72.beat.id, 'new-normal');
assert.equal(act4_72.beatElapsedSec, 10);
assert.equal(act4_72.beatProgress, 1);

assert.equal(beatToCourseTime(5, 0, act4), 0);
assert.equal(beatToCourseTime(11, 10, act4), 72);

// Act 4 must keep both spacecraft on the same transport clock, including the
// 30-second trace/commit boundary; only authored holds or transport pause may
// freeze the pair.
const act4AtThirtySeconds = courseTimeToBeat(30, act4);
assert.equal(act4AtThirtySeconds.beat.id, 'ttt');
assert.equal(goldenFlowBeatHasAuthoredMotionHold(act4AtThirtySeconds.beat), false);
assert.equal(goldenFlowMotionState(true, goldenFlowBeatHasAuthoredMotionHold(act4AtThirtySeconds.beat)), 'moving');
for (const beat of GOLDEN_FLOW_BEATS.filter(currentBeat => currentBeat.truth.namespace === 'source-backed-handover')) {
  assert.equal(goldenFlowBeatHasAuthoredMotionHold(beat), false, `${beat.id} should remain transport-driven`);
}

console.log('Golden flow director contract: 12 beats, 108 seconds, one guided action, separated truth namespaces, and restore evidence gate PASS.');
