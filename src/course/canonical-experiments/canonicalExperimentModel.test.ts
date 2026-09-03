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
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import {
  acceptCanonicalExperimentObservation,
  canonicalExperimentComplete,
  canonicalExperimentObservation,
} from './canonicalExperimentModel';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);
const instantUtc = '2026-08-08T03:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog('/tle-archive/starlink/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const tleState = createSimulatorTleState(selection, instantUtc);

const oneBeam = canonicalExperimentObservation(
  buildSimulationAnalysisFrame(tleState, DEFAULT_SIMULATOR_PARAMETERS, undefined, { beamLayoutCount: 1 }),
  'beam-layout',
);
const nineteenBeams = canonicalExperimentObservation(
  buildSimulationAnalysisFrame(tleState, DEFAULT_SIMULATOR_PARAMETERS, undefined, { beamLayoutCount: 19 }),
  'beam-layout',
);
const layoutObservations = acceptCanonicalExperimentObservation(
  acceptCanonicalExperimentObservation([], oneBeam, 1),
  nineteenBeams,
  19,
);
assert.equal(canonicalExperimentComplete(layoutObservations, [1, 19]), true);
assert.equal(oneBeam.receipt.ueSubstrateId, 'canonical-ground-ue-substrate-v1');
assert.equal(oneBeam.receipt.invariantKey, nineteenBeams.receipt.invariantKey);
assert.notEqual(oneBeam.servedUeCount, nineteenBeams.servedUeCount);

const reuseFrame = (frequencyReuse: number) => buildSimulationAnalysisFrame(
  tleState,
  { ...DEFAULT_SIMULATOR_PARAMETERS, frequencyReuse },
  undefined,
  { beamLayoutCount: 19 },
);
const reuseOne = canonicalExperimentObservation(reuseFrame(1), 'frequency-reuse');
const reuseThree = canonicalExperimentObservation(reuseFrame(3), 'frequency-reuse');
const reuseSeven = canonicalExperimentObservation(reuseFrame(7), 'frequency-reuse');
const reuseObservations = [reuseOne, reuseThree, reuseSeven].reduce(
  (accepted, observation) => acceptCanonicalExperimentObservation(accepted, observation, observation.condition),
  [] as readonly ReturnType<typeof canonicalExperimentObservation>[],
);
assert.equal(canonicalExperimentComplete(reuseObservations, [1, 3, 7]), true);
assert.equal(reuseOne.receipt.invariantKey, reuseSeven.receipt.invariantKey);
assert.ok(reuseSeven.representativeSinrDb > reuseOne.representativeSinrDb);
assert.notEqual(reuseSeven.totalRateMbps, reuseOne.totalRateMbps);

const changedCarrier = canonicalExperimentObservation(
  buildSimulationAnalysisFrame(
    tleState,
    { ...DEFAULT_SIMULATOR_PARAMETERS, frequencyReuse: 7, carrierFrequencyGHz: 30 },
    undefined,
    { beamLayoutCount: 19 },
  ),
  'frequency-reuse',
);
assert.throws(
  () => acceptCanonicalExperimentObservation([reuseOne], changedCarrier, 7),
  /invariant changed/,
);

console.log('canonical Act 5/6 experiment observations stay on one immutable comparison boundary');
