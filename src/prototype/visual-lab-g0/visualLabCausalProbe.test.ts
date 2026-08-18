import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../simulator/analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
} from '../../simulator/types';
import {
  visualLabAcceptedReplayEvidenceReady,
  visualLabCausalComparisonReady,
  visualLabCausalProbeValue,
} from './useVisualLabCausalReplay';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);
const instantUtc = '2026-08-12T12:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.starlink,
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const tleState = createSimulatorTleState(selection, instantUtc);
const frameOptions = {
  beamLayoutCount: 7 as const,
  perSatelliteBeamLayoutCount: {},
  beamIlluminationMode: 'fixed' as const,
  userPositionOverridesKm: [],
};
const baseline = buildSimulationAnalysisFrame(
  tleState,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  frameOptions,
);
const theta3dbRad = visualLabCausalProbeValue(
  'beamwidth',
  DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad,
);
const candidate = buildSimulationAnalysisFrame(
  tleState,
  { ...DEFAULT_SIMULATOR_PARAMETERS, theta3dbRad },
  undefined,
  frameOptions,
);
const beamPowerCapW = visualLabCausalProbeValue(
  'power-cap',
  DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW,
);
const powerCandidate = buildSimulationAnalysisFrame(
  tleState,
  { ...DEFAULT_SIMULATOR_PARAMETERS, beamPowerCapW },
  undefined,
  frameOptions,
);

assert.ok(Math.abs(
  (theta3dbRad - DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad) * 180 / Math.PI - .3,
) < 1e-12);
assert.deepEqual(
  baseline.links[0] === undefined ? null : {
    satelliteId: baseline.links[0].satelliteId,
    beamId: baseline.links[0].beamId,
    userId: baseline.links[0].userId,
  },
  candidate.links[0] === undefined ? null : {
    satelliteId: candidate.links[0].satelliteId,
    beamId: candidate.links[0].beamId,
    userId: candidate.links[0].userId,
  },
  'the default guided A/B intervention must preserve the compared link identity',
);
assert.notEqual(candidate.power.systemPowerW, baseline.power.systemPowerW);
assert.notEqual(candidate.throughput.totalRateBps, baseline.throughput.totalRateBps);
assert.notEqual(candidate.ee.instantaneousBitsPerJ, baseline.ee.instantaneousBitsPerJ);
assert.notEqual(beamPowerCapW, DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW);
assert.notEqual(powerCandidate.power.systemPowerW, baseline.power.systemPowerW);
assert.ok(Number.isFinite(powerCandidate.throughput.totalRateBps));
assert.notEqual(powerCandidate.ee.instantaneousBitsPerJ, baseline.ee.instantaneousBitsPerJ);

const acceptedSourceGateFixture = {
  phase: 'ready',
  accepted: {
    runReady: true,
    canonical: { isMock: false },
    timeline: {
      isMock: false,
      availability: 'available',
      analysisRunId: 'analysis-a',
      geometryRunId: 'geometry-a',
    },
    analysisRunId: 'analysis-a',
    geometryRunId: 'geometry-a',
    identity: { sourceKind: 'ARCHIVED_TLE', propagationModel: 'SGP4' },
  },
} as Record<string, unknown>;
assert.equal(visualLabAcceptedReplayEvidenceReady(acceptedSourceGateFixture as never), true);
assert.equal(visualLabCausalComparisonReady({
  ...acceptedSourceGateFixture,
  comparison: {
    availability: 'available',
    classification: 'causal',
    baseline: {},
    candidate: {},
    frame: {
      availability: 'available',
      deltas: {
        totalThroughputBps: { baseline: 1, candidate: 2 },
        systemPowerW: { baseline: 3, candidate: 4 },
        instantaneousEeBitsPerJ: { baseline: 5, candidate: 6 },
      },
    },
  },
} as never), true);
assert.equal(visualLabCausalComparisonReady({
  ...acceptedSourceGateFixture,
  comparison: {
    availability: 'available',
    classification: 'causal',
    baseline: {},
    candidate: {},
    frame: {
      availability: 'available',
      deltas: {
        totalThroughputBps: { baseline: null, candidate: 2 },
        systemPowerW: { baseline: 3, candidate: 4 },
        instantaneousEeBitsPerJ: { baseline: 5, candidate: 6 },
      },
    },
  },
} as never), false, 'missing throughput evidence must remain unavailable');
assert.equal(visualLabAcceptedReplayEvidenceReady({
  ...acceptedSourceGateFixture,
  accepted: {
    ...(acceptedSourceGateFixture.accepted as Record<string, unknown>),
    canonical: { isMock: true },
  },
} as never), false, 'mock canonical projections must never be replay evidence');

console.log('visual-lab causal beamwidth probe preserves one matched archived-TLE link');
