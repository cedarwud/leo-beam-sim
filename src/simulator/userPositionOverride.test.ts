import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from './analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from './archive';
import { DEFAULT_SIMULATOR_PARAMETERS } from './types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
const state = createSimulatorTleState(selection, '2026-08-07T23:59:59.000Z');

const defaultFrame = buildSimulationAnalysisFrame(state, DEFAULT_SIMULATOR_PARAMETERS);
const explicitEmptyFrame = buildSimulationAnalysisFrame(
  state,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  { userPositionOverridesKm: [] },
);
assert.equal(explicitEmptyFrame.frameId, defaultFrame.frameId);
assert.deepEqual(explicitEmptyFrame.scenario.users, defaultFrame.scenario.users);

const movedFrame = buildSimulationAnalysisFrame(
  state,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  {
    userPositionOverridesKm: [{ userIndex: 0, positionKm: [12, 8] }],
    representativeUserIndex: 0,
  },
);
assert.notEqual(movedFrame.frameId, defaultFrame.frameId);
assert.deepEqual(movedFrame.scenario.users[0]?.positionKm, [12, 8]);
assert.notEqual(
  movedFrame.inputs.frame.thetaRadUb[0]?.[0],
  defaultFrame.inputs.frame.thetaRadUb[0]?.[0],
);
assert.deepEqual(movedFrame.inputs.frame.servingBeamU, defaultFrame.inputs.frame.servingBeamU);
assert.deepEqual(movedFrame.inputs.frame.beamLoadB, defaultFrame.inputs.frame.beamLoadB);
assert.equal(movedFrame.links[0]?.userIndex, 0);
assert.equal(movedFrame.candidateLink?.userIndex, 0);
assert.notEqual(movedFrame.candidateLink?.offAxisAngleRad, defaultFrame.candidateLink?.offAxisAngleRad);

const pinnedFrame = buildSimulationAnalysisFrame(
  state,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  { representativeUserIndex: 1 },
);
assert.notEqual(pinnedFrame.frameId, defaultFrame.frameId);
assert.equal(pinnedFrame.links[0]?.userIndex, 1);
assert.equal(pinnedFrame.candidateLink?.userIndex, 1);

for (const options of [
  { representativeUserIndex: -1 },
  { representativeUserIndex: 100 },
  { representativeUserIndex: 0.5 },
  { userPositionOverridesKm: [{ userIndex: -1, positionKm: [0, 0] }] },
  { userPositionOverridesKm: [{ userIndex: 0, positionKm: [Number.NaN, 0] }] },
] as const) {
  assert.throws(
    () => buildSimulationAnalysisFrame(state, DEFAULT_SIMULATOR_PARAMETERS, undefined, options),
    RangeError,
  );
}

console.log('Canonical frame UE-position overrides preserve assignment/load and candidate identity.');
