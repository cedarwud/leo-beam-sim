import assert from 'node:assert/strict';

import type { HandoverEvent } from '../../../engine/handover/types';
import type { SinrLiveCellHandoverEvent } from '../../../scene/sinrLiveCellModel';
import type { CanonicalTleServingChangeEvidence } from '../../../simulator/canonicalTleHandover';
import {
  assertVisualLabSemanticCommand,
  createInterHandoverReplayDescriptor,
  createIntraHandoverReplayDescriptor,
  createVisualLabFigureCaptureManifest,
  createVisualLabPresentationState,
  type AcceptedCanonicalBeamIdentityTrace,
  type VisualLabFigureProfile,
} from './visualLabPresentationContract';

const profile: VisualLabFigureProfile = {
  profileId: 'figure-handover-v1',
  theme: 'dark',
  locale: 'zh-Hant',
  viewport: { width: 1600, height: 900, devicePixelRatio: 1 },
  cameraPreset: 'handover-focus',
  layerPreset: 'energy-story',
};

const evidence = {
  runId: 'analysis-run-1',
  frameId: 'frame-42',
  instantUtc: '2026-08-16T00:00:00.000Z',
};

const manifest = createVisualLabFigureCaptureManifest({ profile, evidence });
assert.equal(manifest.schema, 'visual-lab-capture-manifest-v1');
assert.equal(manifest.evidence.runId, evidence.runId);
assert.equal(manifest.evidence.frameId, evidence.frameId);
assert.equal(manifest.evidence.instantUtc, evidence.instantUtc);
assert.equal(manifest.evidence.contractVersion, 'visual-lab-presentation-v1');
assert.equal(manifest.lockedPresentation.theme, 'dark');
assert.equal(manifest.lockedPresentation.locale, 'zh-Hant');
assert.equal(Object.isFrozen(manifest), true);
assert.equal(Object.isFrozen(manifest.lockedPresentation), true);
assert.equal(Object.isFrozen(manifest.evidence), true);

const lightManifest = createVisualLabFigureCaptureManifest({
  profile: { ...profile, theme: 'light', locale: 'en' },
  evidence,
});
assert.equal(lightManifest.evidence.identityDigest, manifest.evidence.identityDigest);
assert.notEqual(lightManifest.lockedPresentation.theme, manifest.lockedPresentation.theme);
assert.notEqual(lightManifest.lockedPresentation.locale, manifest.lockedPresentation.locale);
assert.equal(createVisualLabPresentationState({ theme: 'light', locale: 'en', experience: 'figure' }).experience, 'figure');

const canonicalInterEvidence: CanonicalTleServingChangeEvidence = {
  eventId: 'event-inter-1',
  analysisRunId: evidence.runId,
  geometryRunId: 'geometry-1',
  traceDigest: 'trace-digest-1',
  sourceEvent: 'inter-handover',
  fromSatelliteId: 'sat-a',
  toSatelliteId: 'sat-b',
  targetSelection: {
    selectionKind: 'pass-plan',
    passId: 'pass-b',
    satelliteId: 'sat-b',
    sourceLocator: 'accepted-pass-plan',
  },
  triggerAnchorIndex: 4,
  triggerInstantUtc: evidence.instantUtc,
  preCommit: {
    servingSatelliteId: 'sat-a',
    candidateSatelliteId: 'sat-b',
    servingVisible: true,
    candidateVisible: true,
    servingSinrDb: 8,
    candidateSinrDb: 12,
    deltaDb: 4,
  },
  postCommit: {
    servingSatelliteId: 'sat-b',
    anchorIndex: 5,
    instantUtc: evidence.instantUtc,
  },
  reason: 'accepted offset and TTT policy',
  decision: { offsetDb: 3, tttSec: 30 },
  qualificationAnchors: [],
};
const interDescriptor = createInterHandoverReplayDescriptor({ evidence: canonicalInterEvidence });
assert.equal(interDescriptor.kind, 'inter-handover');
assert.equal(interDescriptor.availability.status, 'available');
if (interDescriptor.source.kind !== 'inter-handover') throw new Error('inter descriptor source kind drifted');
assert.equal(interDescriptor.source.fromSatelliteId, 'sat-a');
assert.equal(interDescriptor.source.toSatelliteId, 'sat-b');

const forcedContinuity = {
  ...canonicalInterEvidence,
  eventId: 'event-forced-1',
  sourceEvent: 'forced-continuity' as const,
  qualificationAnchors: [] as const,
  continuity: {
    servingVisible: false as const,
    targetVisible: true as const,
    targetSatelliteId: 'sat-b',
    reasonCode: 'serving-lost-visibility' as const,
    reason: 'serving satellite left the visibility window',
  },
};
const forcedDescriptor = createInterHandoverReplayDescriptor({ evidence: forcedContinuity });
assert.equal(forcedDescriptor.availability.status, 'unavailable');
if (forcedDescriptor.availability.status === 'unavailable') {
  assert.equal(forcedDescriptor.availability.reasonCode, 'wrong-event-kind');
}

const canonicalIntraTrace: AcceptedCanonicalBeamIdentityTrace = {
  adapter: 'accepted-canonical-beam-identity-trace-v1',
  sourceKind: 'real-tle-canonical',
  traceId: 'trace-intra-1',
  analysisRunId: evidence.runId,
  geometryRunId: 'geometry-run-intra-1',
  frameId: evidence.frameId,
  instantUtc: evidence.instantUtc,
  traceDigest: 'intra-digest-1',
  beforeAnchorIndex: 0,
  decisionAnchorIndex: 1,
  afterAnchorIndex: 2,
  beforeFrameId: 'frame-intra-before',
  decisionFrameId: evidence.frameId,
  afterFrameId: 'frame-intra-after',
  beforeInstantUtc: '2026-08-08T11:59:30.000Z',
  decisionInstantUtc: evidence.instantUtc,
  afterInstantUtc: '2026-08-08T12:00:30.000Z',
  from: { satelliteId: 'sat-a', beamId: 1, userIndex: 3, userId: 'ue-3' },
  to: { satelliteId: 'sat-a', beamId: 2, userIndex: 3, userId: 'ue-3' },
};
const intraDescriptor = createIntraHandoverReplayDescriptor({
  source: { kind: 'accepted-canonical-beam-identity', trace: canonicalIntraTrace },
});
assert.equal(intraDescriptor.kind, 'intra-handover');
assert.equal(intraDescriptor.availability.status, 'available');
if (intraDescriptor.source.kind !== 'intra-handover') throw new Error('intra descriptor source kind drifted');
assert.equal(intraDescriptor.source.traceId, canonicalIntraTrace.traceId);

const legacyEngineEvent: HandoverEvent = {
  timeMs: 1000,
  action: 'intra-switch',
  fromSatId: 'sat-a',
  fromBeamId: 1,
  fromSinrDb: 5,
  toSatId: 'sat-a',
  toBeamId: 2,
  toSinrDb: 7,
  deltaDb: 2,
};
const legacyEngineDescriptor = createIntraHandoverReplayDescriptor({
  source: { kind: 'legacy-engine-event', event: legacyEngineEvent },
});
assert.equal(legacyEngineDescriptor.availability.status, 'unavailable');
if (legacyEngineDescriptor.availability.status === 'unavailable') {
  assert.equal(legacyEngineDescriptor.availability.reasonCode, 'non-canonical-source');
}

const legacySinrEvent: SinrLiveCellHandoverEvent = {
  ueId: 'ue-3',
  kind: 'intra',
  sourceTimeSec: 30,
  fromSatId: 'sat-a',
  fromCellId: 1,
  toSatId: 'sat-a',
  toCellId: 2,
};
const legacySinrDescriptor = createIntraHandoverReplayDescriptor({
  source: { kind: 'legacy-sinr-live-event', event: legacySinrEvent },
});
assert.equal(legacySinrDescriptor.availability.status, 'unavailable');

assert.doesNotThrow(() => assertVisualLabSemanticCommand({ type: 'pause' }));
assert.doesNotThrow(() => assertVisualLabSemanticCommand({ type: 'inspect', target: 'energy-efficiency' }));
assert.doesNotThrow(() => assertVisualLabSemanticCommand({ type: 'fork-to-explore' }));
assert.throws(() => assertVisualLabSemanticCommand({ type: 'inspect', target: '.result-card' }));
assert.throws(() => assertVisualLabSemanticCommand({ type: 'next', result: 42 }));

console.log('visual-lab presentation contract passed');
