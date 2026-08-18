import assert from 'node:assert/strict';
import {
  buildVisualLabCaptureBundle,
  CaptureBundleError,
  type CaptureBundleBuildOptions,
  type VisualLabCaptureBundle,
} from './captureBundle';
import type {
  LabSnapshot,
  VisualLabSession,
} from '../session/visualLabSession';
import type { VisualLabCanonicalSnapshot } from '../../prototype/visual-lab-g0/visualLabCanonicalSnapshotAdapter';
import type { VisualLabCanonicalTimeline } from '../../prototype/visual-lab-g0/visualLabCanonicalTimelineAdapter';
import type { VisualLabFigureProfile } from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';

const PROFILE: VisualLabFigureProfile = {
  profileId: 'figure-method-light-en',
  theme: 'light',
  locale: 'en',
  viewport: { width: 1600, height: 1000, devicePixelRatio: 2 },
  cameraPreset: 'global-overview',
  layerPreset: 'full',
};

const IDENTITY = {
  frameId: 'frame-0042',
  tleFrameId: 'tle-frame-0042',
  runId: 'run-20260816',
  analysisRunId: 'analysis-20260816',
  geometryRunId: 'geometry-20260816',
  instantUtc: '2026-08-16T00:00:00.000Z',
  instantTaipei: '2026-08-16T08:00:00+08:00',
  tleEpochUtc: '2026-08-15T23:59:00.000Z',
  constellation: 'starlink' as const,
  archiveId: 'starlink-archive-20260816',
  archiveDate: '2026-08-16',
  selectedSatelliteId: 'STARLINK-1001',
  candidateSatelliteId: 'STARLINK-1002',
  selectedTlePath: '/tle-archive/starlink/starlink_20260816.tle',
  sourceKind: 'ARCHIVED_TLE' as const,
  propagationModel: 'SGP4' as const,
    contractVersion: 'family-b-thesis-3.13-3.17-v1' as const,
};

const CANONICAL: VisualLabCanonicalSnapshot = {
  schemaVersion: 'visual-lab-canonical-snapshot-v1',
  isMock: false,
  source: {
    frameId: IDENTITY.frameId,
    tleFrameId: IDENTITY.tleFrameId,
    instantUtc: IDENTITY.instantUtc,
    instantTaipei: IDENTITY.instantTaipei,
    tleEpochUtc: IDENTITY.tleEpochUtc,
    selectedSatelliteId: IDENTITY.selectedSatelliteId,
    constellation: IDENTITY.constellation,
    archiveId: IDENTITY.archiveId,
    archiveDate: IDENTITY.archiveDate,
    selectedTlePath: IDENTITY.selectedTlePath,
    sourceKind: IDENTITY.sourceKind,
    propagationModel: IDENTITY.propagationModel,
    contractVersion: IDENTITY.contractVersion,
  },
  timeline: {
    availability: 'available',
    instantUtc: IDENTITY.instantUtc,
    anchorIndex: 42,
    anchorCount: 241,
    elapsedSec: 1260,
    durationSec: 7200,
    stepSec: 30,
    servingSatelliteId: IDENTITY.selectedSatelliteId,
    candidateSatelliteId: IDENTITY.candidateSatelliteId,
    servingPassId: 'pass-serving',
    candidatePassId: 'pass-candidate',
  },
  serving: {
    availability: 'available',
    satelliteId: IDENTITY.selectedSatelliteId,
    beamId: 2,
    userId: 'UE-0002',
    sinrLinear: 20,
    sinrDb: 13.0103,
    requestedPowerW: 12,
    actualPowerW: 10,
    throughputBps: 3_000_000,
    instantaneousEeBitsPerJ: 1200,
    distanceKm: 650,
    elevationDeg: 45,
    reason: null,
  },
  candidate: {
    availability: 'available',
    satelliteId: IDENTITY.candidateSatelliteId,
    beamId: 3,
    userId: 'UE-0002',
    sinrLinear: 18,
    sinrDb: 12.5527,
    requestedPowerW: 13,
    actualPowerW: 11,
    throughputBps: 2_700_000,
    instantaneousEeBitsPerJ: 900,
    distanceKm: 680,
    elevationDeg: 42,
    reason: null,
  },
  deltaSinrDb: -0.4576,
  throughput: {
    servingRateBps: 3_000_000,
    candidateRateBps: 2_700_000,
    totalRateBps: 3_000_000,
    cumulativeDeliveredBits: 1_000_000_000,
  },
  power: {
    servingActualPowerW: 10,
    candidateActualPowerW: 11,
    systemPowerW: 20,
    cumulativeConsumedEnergyJ: 100_000,
  },
  ee: {
    instantaneousBitsPerJ: 150_000,
    cumulativeBitsPerJ: 10_000,
  },
  evaluation: {
    availability: 'available',
    source: 'homepage-canonical-evaluation',
    deliveredBits: 1_000_000_000,
    consumedEnergyJ: 100_000,
    energyEfficiencyBitsPerJ: 10_000,
    durationSec: 7200,
  },
  handover: {
    availability: 'available',
    state: 'attached',
    event: 'none',
    offsetDb: 3,
    tttSec: 30,
    progressSec: 0,
    ratio: 0,
    cumulativeCount: 1,
    reason: null,
    servingSatelliteId: IDENTITY.selectedSatelliteId,
    candidateSatelliteId: IDENTITY.candidateSatelliteId,
    deltaDb: -0.4576,
    eventFromSatelliteId: null,
    eventToSatelliteId: null,
  },
};

const TIMELINE: VisualLabCanonicalTimeline = {
  schemaVersion: 'visual-lab-canonical-timeline-v1',
  isMock: false,
  availability: 'available',
  analysisRunId: IDENTITY.analysisRunId,
  geometryRunId: IDENTITY.geometryRunId,
  durationSec: 7200,
  stepSec: 30,
  anchorCount: 241,
  points: [
    {
      anchorIndex: 0,
      timeSec: 0,
      instantUtc: IDENTITY.instantUtc,
      servingSatelliteId: IDENTITY.selectedSatelliteId,
      candidateSatelliteId: IDENTITY.candidateSatelliteId,
      servingSinrDb: 13,
      candidateSinrDb: 12,
      throughputBps: 3_000_000,
      powerW: 20,
      instantaneousEeBitsPerJ: 150_000,
      deliveredBits: 0,
      energyJ: 0,
      cumulativeEeBitsPerJ: 0,
      handoverCount: 0,
    },
  ],
  markers: [],
};

function snapshot(overrides: Partial<LabSnapshot> = {}): LabSnapshot {
  const accepted = {
    identity: IDENTITY,
    frameId: IDENTITY.frameId,
    tleFrameId: IDENTITY.tleFrameId,
    runId: IDENTITY.runId,
    analysisRunId: IDENTITY.analysisRunId,
    geometryRunId: IDENTITY.geometryRunId,
    instantUtc: IDENTITY.instantUtc,
    canonical: CANONICAL,
    timeline: TIMELINE,
    global: null,
    local: null,
    beamScheduleTrace: null,
    intraHandoverEvidence: null,
    runReady: true,
  };
  return {
    phase: 'ready',
    accepted,
    draft: {} as LabSnapshot['draft'],
    presentation: { theme: PROFILE.theme, locale: PROFILE.locale, experience: 'figure', view: 'earth', density: 'full', focus: 'geometry' },
    scenePlan: null,
    results: {} as LabSnapshot['results'],
    energy: {} as LabSnapshot['energy'],
    comparison: {} as LabSnapshot['comparison'],
    capture: {} as LabSnapshot['capture'],
    computation: { status: 'complete', completedAnchors: 241, totalAnchors: 241, fraction: 1 },
    error: null,
    canonical: CANONICAL,
    timeline: TIMELINE,
    globalScene: null,
    localScene: null,
    ...overrides,
  };
}

function build(extra: Partial<CaptureBundleBuildOptions> = {}): VisualLabCaptureBundle {
  return buildVisualLabCaptureBundle(snapshot(), {
    figureProfile: PROFILE,
    caption: 'A deterministic caption.',
    altText: 'A deterministic alt text.',
    longDescription: 'A deterministic long description.',
    ...extra,
  });
}

const first = build();
const second = build();
assert.equal(first.supportingData.json, second.supportingData.json, 'JSON data is deterministic');
assert.equal(first.supportingData.csv, second.supportingData.csv, 'CSV data is deterministic');
assert.deepEqual(first.manifest, second.manifest, 'manifest is deterministic');
assert.deepEqual(first.artifacts.map(item => item.sha256), second.artifacts.map(item => item.sha256));
assert.equal(Object.isFrozen(first), true, 'bundle is immutable at the public boundary');
assert.equal(Object.isFrozen(first.manifest), true, 'manifest is immutable');
assert.equal(first.manifest.lockedPresentation.theme, 'light');
assert.equal(first.manifest.lockedPresentation.locale, 'en');
assert.equal(first.manifest.figureProfile.profileId, PROFILE.profileId);
assert.equal(first.manifest.evidence.frameId, IDENTITY.frameId);
assert.equal(first.manifest.evidence.identityDigest.startsWith('visual-lab-evidence-v1:'), true);
assert.match(first.csv, /serving_sinr_db/);
assert.match(first.csv, /dB/);
assert.match(first.csv, /bit\/s/);
assert.match(first.csv, /bit\/J/);
assert.match(first.csv, /,W,/);
assert.match(first.csv, /,J,/);

const sessionSnapshot = snapshot();
let snapshotCalls = 0;
const session: VisualLabSession = {
  snapshot: () => {
    snapshotCalls += 1;
    return sessionSnapshot;
  },
  subscribe: () => () => undefined,
  dispatch: async () => {
    throw new Error('capture builder must not dispatch');
  },
};
buildVisualLabCaptureBundle(session, {
  figureProfile: PROFILE,
  caption: 'Session caption',
  altText: 'Session alt',
  longDescription: 'Session long description',
});
assert.equal(snapshotCalls, 1, 'session source is consumed only through snapshot()');

const mismatched = snapshot({
  accepted: {
    ...snapshot().accepted!,
    canonical: {
      ...CANONICAL,
      source: { ...CANONICAL.source, frameId: 'other-frame' },
    },
  },
});
assert.throws(
  () => buildVisualLabCaptureBundle(mismatched, { figureProfile: PROFILE }),
  (error: unknown) => error instanceof CaptureBundleError && error.code === 'IDENTITY_MISMATCH',
);

const provenanceMismatch = snapshot({
  accepted: {
    ...snapshot().accepted!,
    canonical: {
      ...CANONICAL,
      source: { ...CANONICAL.source, archiveId: 'other-archive' },
    },
  },
});
assert.throws(
  () => buildVisualLabCaptureBundle(provenanceMismatch, { figureProfile: PROFILE }),
  (error: unknown) => error instanceof CaptureBundleError && error.code === 'IDENTITY_MISMATCH',
);

const mockCanonical = { ...CANONICAL, isMock: true } as unknown as VisualLabCanonicalSnapshot;
const mock = snapshot({ accepted: { ...snapshot().accepted!, canonical: mockCanonical } });
assert.throws(
  () => buildVisualLabCaptureBundle(mock, { figureProfile: PROFILE }),
  (error: unknown) => error instanceof CaptureBundleError && error.code === 'MOCK_EVIDENCE',
);

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const svg = '<svg viewBox="0 0 1 1"></svg>';
const withAssets = build({ assets: { png: { bytes: png, mediaType: 'image/png' }, svg: { bytes: svg, mediaType: 'image/svg+xml' } } });
assert.equal(withAssets.artifacts.some(item => item.role === 'composed-png'), true);
assert.equal(withAssets.artifacts.some(item => item.role === 'vector-overlay'), true);
assert.throws(
  () => build({ assets: { png: { bytes: [1, 2, 3], mediaType: 'image/png' } } }),
  (error: unknown) => error instanceof CaptureBundleError && error.code === 'INVALID_ASSET',
);

console.log('visual-lab capture bundle tests passed');
