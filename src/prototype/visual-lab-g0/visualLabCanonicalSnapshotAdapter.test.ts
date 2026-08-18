import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { buildSimulationAnalysisFrame, createSimulatorTleState } from '../../simulator/analysis';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  type SimulationAnalysisFrame,
} from '../../simulator/types';
import { adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const instantUtc = '2026-08-08T12:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.oneweb, fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const state = createSimulatorTleState(selection, instantUtc);
const frame = buildSimulationAnalysisFrame(state, DEFAULT_SIMULATOR_PARAMETERS);

const evaluation = Object.freeze({
  deliveredBits: 1_200,
  consumedEnergyJ: 30,
  energyEfficiencyBitsPerJ: 40,
  durationSec: 60,
});
const snapshot = adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot({ frame, evaluation });

assert.equal(snapshot.schemaVersion, 'visual-lab-canonical-snapshot-v1');
assert.equal(snapshot.isMock, false);
assert.equal(snapshot.source.frameId, frame.frameId);
assert.equal(snapshot.source.tleFrameId, frame.tleFrameId);
assert.equal(snapshot.source.constellation, frame.provenance.constellation);
assert.equal(snapshot.source.archiveId, frame.provenance.archiveId);
assert.equal(snapshot.source.selectedTlePath, frame.provenance.selectedTlePath);
assert.equal(snapshot.timeline.instantUtc, frame.instantUtc);
assert.equal(snapshot.serving.availability, 'available');
assert.equal(snapshot.serving.satelliteId, frame.links[0]?.satelliteId);
assert.equal(snapshot.serving.sinrDb, frame.links[0]?.sinrDb);
assert.equal(snapshot.serving.actualPowerW, frame.links[0]?.actualPowerW);
assert.equal(snapshot.serving.signalW, frame.links[0]?.signalW);
assert.equal(snapshot.serving.interferenceW, frame.links[0]?.interferenceW);
assert.equal(snapshot.serving.noiseW, frame.links[0]?.noiseW);
assert.equal(snapshot.serving.offAxisAngleRad, frame.links[0]?.offAxisAngleRad);
assert.equal(
  snapshot.serving.intraSatelliteInterferenceW,
  frame.links[0] === undefined ? null : frame.canonical.intraSatelliteInterferenceUW[frame.links[0].userIndex],
);
assert.equal(
  snapshot.serving.interSatelliteInterferenceW,
  frame.links[0] === undefined ? null : frame.canonical.interSatelliteInterferenceUW[frame.links[0].userIndex],
);
assert.equal(snapshot.serving.throughputBps, frame.links[0]?.rateBps);
assert.equal(snapshot.ee.instantaneousBitsPerJ, frame.ee.instantaneousBitsPerJ);
assert.equal(snapshot.evaluation.availability, 'available');
assert.equal(snapshot.evaluation.deliveredBits, evaluation.deliveredBits);
assert.equal(snapshot.evaluation.consumedEnergyJ, evaluation.consumedEnergyJ);
assert.equal(snapshot.evaluation.energyEfficiencyBitsPerJ, evaluation.energyEfficiencyBitsPerJ);
assert.equal(snapshot.power.systemPowerW, frame.power.systemPowerW);
assert.equal(snapshot.power.servingRequestedPowerW, frame.links[0] === undefined ? null : frame.power.pReqBW[frame.links[0].beamId]);
assert.equal(snapshot.power.servingPaInputPowerW, frame.links[0] === undefined ? null : frame.power.pPaBW[frame.links[0].beamId]);
assert.equal(snapshot.throughput.systemBandwidthHz, frame.parameters.systemBandwidthHz);
assert.equal(snapshot.throughput.frequencyReuse, frame.parameters.frequencyReuse);
assert.equal(snapshot.throughput.beamBandwidthHz, frame.parameters.systemBandwidthHz / frame.parameters.frequencyReuse);
assert.equal(snapshot.throughput.totalRateBps, frame.throughput.totalRateBps);
assert.equal(snapshot.handover.availability, 'unavailable');
assert.equal(snapshot.handover.state, null);
assert.equal(snapshot.handover.event, null);
assert.equal(snapshot.handover.cumulativeCount, null);
assert.equal(Object.isFrozen(snapshot), true);
assert.equal(Object.isFrozen(snapshot.serving), true);
assert.equal(Object.isFrozen(snapshot.evaluation), true);

// A candidate can have a real identity in the accepted frame while its
// counterfactual link is unavailable.  The adapter must preserve the identity
// only as known provenance and keep every candidate metric nullable.
const unavailableCandidateFrame: SimulationAnalysisFrame = {
  ...frame,
  candidateLink: null,
  candidateComparison: {
    role: 'single-link-comparison',
    activeBeamOwnership: false,
    contributesToServingInterference: false,
    status: 'unavailable',
    satelliteId: frame.tleState.candidateSatellite?.satelliteId ?? null,
    candidateIdentityMatch: null,
    reason: 'candidate scenario cannot preserve the serving representative UE and beam',
  },
};
const unavailableSnapshot = adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot({
  frame: unavailableCandidateFrame,
  evaluation: null,
});
assert.equal(unavailableSnapshot.candidate.availability, 'unavailable');
assert.equal(
  unavailableSnapshot.candidate.satelliteId,
  frame.tleState.candidateSatellite?.satelliteId ?? null,
);
assert.equal(unavailableSnapshot.candidate.sinrDb, null);
assert.equal(unavailableSnapshot.candidate.actualPowerW, null);
assert.equal(unavailableSnapshot.candidate.throughputBps, null);
assert.equal(unavailableSnapshot.candidate.instantaneousEeBitsPerJ, null);
assert.equal(unavailableSnapshot.deltaSinrDb, null);
assert.equal(unavailableSnapshot.evaluation.availability, 'unavailable');
assert.equal(unavailableSnapshot.evaluation.deliveredBits, null);
assert.equal(unavailableSnapshot.evaluation.consumedEnergyJ, null);
assert.equal(unavailableSnapshot.evaluation.energyEfficiencyBitsPerJ, null);

// No candidate identity is exposed when the source frame has no candidate at
// all; this prevents a UI from fabricating a placeholder satellite ID.
const noCandidateFrame: SimulationAnalysisFrame = {
  ...unavailableCandidateFrame,
  tleState: { ...frame.tleState, candidateSatellite: null },
  candidateComparison: {
    role: 'single-link-comparison',
    activeBeamOwnership: false,
    contributesToServingInterference: false,
    status: 'unavailable',
    satelliteId: null,
    candidateIdentityMatch: null,
    reason: 'same-instant candidate satellite is unavailable',
  },
};
const noCandidateSnapshot = adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot({
  frame: noCandidateFrame,
  evaluation: null,
});
assert.equal(noCandidateSnapshot.candidate.availability, 'unavailable');
assert.equal(noCandidateSnapshot.candidate.satelliteId, null);
assert.equal(noCandidateSnapshot.candidate.reason, 'same-instant candidate satellite is unavailable');
assert.equal(noCandidateSnapshot.timeline.candidateSatelliteId, null);

// Handover data is copied from the accepted trace, not inferred from the
// candidate SINR delta.  The synthetic object is only a mapping fixture; the
// production source remains frame.handover.
const trace = Object.freeze({
  anchorIndex: 4,
  instantUtc: frame.instantUtc,
  offsetDb: 3,
  tttSec: 30,
  progressSec: 15,
  ratio: 0.5,
  cumulativeCount: 2,
  state: 'pending' as const,
  event: 'inter-handover' as const,
  reason: 'candidate satisfies the accepted offset and TTT policy',
  servingSatelliteId: frame.selectedSatelliteId,
  candidateSatelliteId: frame.tleState.candidateSatellite?.satelliteId ?? null,
  servingVisible: true,
  candidateVisible: true,
  servingSinrDb: frame.links[0]?.sinrDb ?? null,
  candidateSinrDb: frame.candidateLink?.sinrDb ?? null,
  deltaDb: frame.candidateLink?.sinrDb === undefined || frame.links[0]?.sinrDb === undefined
    ? null
    : frame.candidateLink.sinrDb - frame.links[0].sinrDb,
  eventFromSatelliteId: frame.selectedSatelliteId,
  eventToSatelliteId: frame.tleState.candidateSatellite?.satelliteId ?? null,
});
const traceFrame = { ...frame, handover: trace };
const traceSnapshot = adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot({
  frame: traceFrame,
  evaluation,
});
assert.equal(traceSnapshot.handover.availability, 'available');
assert.equal(traceSnapshot.handover.state, 'pending');
assert.equal(traceSnapshot.handover.event, 'inter-handover');
assert.equal(traceSnapshot.handover.progressSec, 15);
assert.equal(traceSnapshot.handover.cumulativeCount, 2);
assert.equal(traceSnapshot.timeline.anchorIndex, 4);
assert.equal(traceSnapshot.timeline.anchorCount, null);
assert.equal(traceSnapshot.timeline.instantUtc, frame.instantUtc);

console.log('visual-lab canonical snapshot adapter passed');
