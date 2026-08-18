import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSimulationAnalysisFrame,
  createSimulationAnalysisRunId,
  createSimulatorTleState,
} from './analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from './archive';
import { deriveSatelliteAltitudeKm } from '../tle/propagation';
import { DEFAULT_SIMULATOR_PARAMETERS } from './types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog(
  '/tle-archive/oneweb/catalog.json',
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
const state = createSimulatorTleState(selection, '2026-08-07T23:59:59.000Z');
const frame = buildSimulationAnalysisFrame(state, DEFAULT_SIMULATOR_PARAMETERS);
const link = frame.links[0]!;
const selectedAltitudeKm = deriveSatelliteAltitudeKm(
  state.selectedSatellite.positionTemeKm,
  state.requestedInstantUtc,
);
assert.ok(frame.scenario.selectedLink.satelliteAltitudeKm !== undefined);
assert.ok(
  Math.abs(frame.scenario.selectedLink.satelliteAltitudeKm - selectedAltitudeKm) < 1e-9,
  'serving canonical channel must receive the propagated WGS-84 altitude',
);
assert.notEqual(
  frame.scenario.selectedLink.satelliteAltitudeKm,
  780,
  'TLE-backed OneWeb analysis must not force the shared 780 km fallback',
);
if (state.candidateSatellite !== null && frame.candidateScenario !== null) {
  const candidateAltitudeKm = deriveSatelliteAltitudeKm(
    state.candidateSatellite.positionTemeKm,
    state.requestedInstantUtc,
  );
  assert.ok(frame.candidateScenario.selectedLink.satelliteAltitudeKm !== undefined);
  assert.ok(
    Math.abs(frame.candidateScenario.selectedLink.satelliteAltitudeKm - candidateAltitudeKm) < 1e-9,
    'candidate canonical channel must receive its own propagated WGS-84 altitude',
  );
}
const expectedUserIndex = frame.inputs.frame.servingBeamU.reduce(
  (selected, servingBeam, userIndex) => {
    if (servingBeam < 0) return selected;
    if (selected < 0) return userIndex;
    return (frame.power.pReqUW[userIndex] ?? -Infinity)
      > (frame.power.pReqUW[selected] ?? -Infinity)
      ? userIndex
      : selected;
  },
  -1,
);

assert.equal(link.userId, `ue-${expectedUserIndex + 1}`);
assert.equal(link.userIndex, expectedUserIndex);
assert.equal(link.beamId, frame.inputs.frame.servingBeamU[expectedUserIndex]);
assert.equal(link.requestedPowerW, frame.power.pReqUW[expectedUserIndex]);
assert.equal(link.beforeSatelliteCapPowerW, frame.power.pDlBeforeSatelliteCapBW[link.beamId]);
assert.equal(link.actualPowerW, frame.power.pDlActualBW[link.beamId]);
assert.equal(link.instantaneousEeBitsPerJ, frame.canonical.ee.systemEeBitsPerJ);
assert.ok(frame.candidateLink !== null);
assert.ok(Number.isFinite(frame.candidateLink?.beforeSatelliteCapPowerW));
assert.ok((frame.candidateLink?.beforeSatelliteCapPowerW ?? -1) >= 0);
assert.equal(frame.candidateLink?.userIndex, link.userIndex);
assert.equal(frame.candidateLink?.userId, link.userId);
assert.equal(frame.candidateLink?.beamId, link.beamId);
assert.equal(frame.candidateLink?.instantaneousEeBitsPerJ, null);
assert.deepEqual(frame.candidateComparison, {
  role: 'single-link-comparison',
  activeBeamOwnership: false,
  contributesToServingInterference: false,
  status: 'available',
  satelliteId: frame.candidateLink?.satelliteId,
  beamId: link.beamId,
  userIndex: link.userIndex,
  userId: link.userId,
  candidateIdentityMatch: true,
});

// A serving/candidate layout override uses the same fixed ground substrate,
// while each satellite is free to reassociate the representative UE in its
// own local beam index space.  This is a counterfactual single-link pair, not
// a joint-interference frame.
const heterogeneousFrame = buildSimulationAnalysisFrame(
  state,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  {
    beamLayoutCount: 19,
    perSatelliteBeamLayoutCount: {
      [state.candidateSatellite!.satelliteId]: 1,
    },
    representativeUserIndex: 50,
  },
);
assert.equal(heterogeneousFrame.scenario.beamLayout.beamCount, 19);
assert.equal(heterogeneousFrame.candidateScenario?.beamLayout.beamCount, 1);
assert.equal(heterogeneousFrame.scenario.ueSubstrateId, heterogeneousFrame.candidateScenario?.ueSubstrateId);
assert.deepEqual(
  heterogeneousFrame.scenario.users.map(user => ({ userId: user.userId, positionKm: user.positionKm })),
  heterogeneousFrame.candidateScenario?.users.map(user => ({ userId: user.userId, positionKm: user.positionKm })),
);
assert.equal(heterogeneousFrame.candidateLink?.userId, heterogeneousFrame.links[0]?.userId);
assert.notEqual(heterogeneousFrame.candidateLink?.beamId, heterogeneousFrame.links[0]?.beamId);
assert.notDeepEqual(heterogeneousFrame.scenario.beamLoadB, frame.scenario.beamLoadB);
assert.ok(heterogeneousFrame.candidateScenario?.beamActiveB.every((active, beamId) => active === ((heterogeneousFrame.candidateScenario?.beamLoadB[beamId] ?? 0) > 0)));
assert.equal(heterogeneousFrame.candidateComparison.activeBeamOwnership, false);
assert.equal(heterogeneousFrame.candidateComparison.contributesToServingInterference, false);

// A public caller may supply only a satellite override.  That must opt the
// whole comparison into the explicit default complete-ring substrate instead
// of mixing an explicit candidate substrate with the legacy serving path.
const implicitGlobalDefaultFrame = buildSimulationAnalysisFrame(
  state,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  {
    perSatelliteBeamLayoutCount: {
      [state.candidateSatellite!.satelliteId]: 1,
    },
    representativeUserIndex: 50,
  },
);
assert.equal(implicitGlobalDefaultFrame.scenario.beamLayout.beamCount, 7);
assert.equal(implicitGlobalDefaultFrame.candidateScenario?.beamLayout.beamCount, 1);
assert.equal(
  implicitGlobalDefaultFrame.scenario.ueSubstrateId,
  implicitGlobalDefaultFrame.candidateScenario?.ueSubstrateId,
);
const reorderedHeterogeneousFrame = buildSimulationAnalysisFrame(
  state,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  {
    beamLayoutCount: 19,
    perSatelliteBeamLayoutCount: {
      [state.selectedSatelliteId]: 19,
      [state.candidateSatellite!.satelliteId]: 1,
    },
    representativeUserIndex: 50,
  },
);
const sameIdentityDifferentInsertionOrder = buildSimulationAnalysisFrame(
  state,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  {
    beamLayoutCount: 19,
    perSatelliteBeamLayoutCount: {
      [state.candidateSatellite!.satelliteId]: 1,
      [state.selectedSatelliteId]: 19,
    },
    representativeUserIndex: 50,
  },
);
assert.equal(reorderedHeterogeneousFrame.frameId, sameIdentityDifferentInsertionOrder.frameId);

const canonicalRunIdentityA = createSimulationAnalysisRunId(
  'geometry-test',
  'policy-test',
  DEFAULT_SIMULATOR_PARAMETERS,
  {
    representativeUserIndex: 50,
    perSatelliteBeamLayoutCount: {
      [state.candidateSatellite!.satelliteId]: 1,
      [state.selectedSatelliteId]: 19,
    },
    beamLayoutCount: 7,
  },
);
const canonicalRunIdentityB = createSimulationAnalysisRunId(
  'geometry-test',
  'policy-test',
  DEFAULT_SIMULATOR_PARAMETERS,
  {
    beamLayoutCount: 7,
    perSatelliteBeamLayoutCount: {
      [state.selectedSatelliteId]: 19,
      [state.candidateSatellite!.satelliteId]: 1,
    },
    representativeUserIndex: 50,
  },
);
assert.equal(canonicalRunIdentityA, canonicalRunIdentityB);
assert.equal(
  createSimulationAnalysisRunId('geometry-test', 'policy-test', DEFAULT_SIMULATOR_PARAMETERS, {
    beamLayoutCount: 7,
    perSatelliteBeamLayoutCount: {},
  }),
  createSimulationAnalysisRunId('geometry-test', 'policy-test', DEFAULT_SIMULATOR_PARAMETERS, {
    beamLayoutCount: 7,
  }),
);

const mismatchSelection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-10T18:00:00.000Z',
  fetchFromPublic,
);
const mismatchState = createSimulatorTleState(
  mismatchSelection,
  '2026-08-10T18:00:00.000Z',
);
const mismatchFrame = buildSimulationAnalysisFrame(mismatchState, {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  theta3dbRad: 0.02,
  minimumRateBps: 1_000,
});
const mismatchServing = mismatchFrame.links[0]!;
const mismatchCandidate = mismatchFrame.candidateLink;
assert.ok(mismatchCandidate !== null, 'the regression fixture must retain a real candidate');
assert.equal(mismatchCandidate.userIndex, mismatchServing.userIndex);
assert.equal(mismatchCandidate.userId, mismatchServing.userId);
assert.equal(mismatchCandidate.beamId, mismatchServing.beamId);
assert.equal(mismatchFrame.candidateComparison.candidateIdentityMatch, true);

const noCandidateFrame = buildSimulationAnalysisFrame({
  ...state,
  candidateSatellite: null,
}, DEFAULT_SIMULATOR_PARAMETERS);
assert.equal(noCandidateFrame.candidateLink, null);
assert.equal(noCandidateFrame.candidateComparison.status, 'unavailable');
assert.equal(noCandidateFrame.candidateComparison.satelliteId, null);
assert.equal(noCandidateFrame.candidateComparison.candidateIdentityMatch, null);
assert.ok(noCandidateFrame.candidateComparison.reason.length > 0);

const duplicateCandidateFrame = buildSimulationAnalysisFrame({
  ...state,
  candidateSatellite: state.selectedSatellite,
}, DEFAULT_SIMULATOR_PARAMETERS);
assert.equal(duplicateCandidateFrame.candidateLink, null);
assert.equal(duplicateCandidateFrame.candidateComparison.status, 'unavailable');
assert.match(
  duplicateCandidateFrame.candidateComparison.reason,
  /same satellite identity/,
);

console.log('Canonical link results publish each link ledger pre-cap power and global limiting-UE identity.');
