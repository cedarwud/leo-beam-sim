import assert from 'node:assert/strict';

import {
  compileScenePlan,
  type ScenePlanAcceptedInput,
} from './scenePlanCompiler';

const identity = Object.freeze({
  frameId: 'frame-001',
  tleFrameId: 'tle-001',
  runId: 'run-001',
  analysisRunId: 'analysis-001',
  geometryRunId: 'geometry-001',
  instantUtc: '2026-08-24T00:00:00.000Z',
  instantTaipei: '2026-08-24T08:00:00',
  tleEpochUtc: '2026-08-23T00:00:00.000Z',
  constellation: 'starlink' as const,
  archiveId: 'archive-001',
  archiveDate: '2026-08-23',
  selectedSatelliteId: 'STARLINK-001',
  candidateSatelliteId: 'STARLINK-002',
  selectedTlePath: '/tle-archive/starlink/2026-08-23.tle',
  sourceKind: 'ARCHIVED_TLE' as const,
  propagationModel: 'SGP4' as const,
  contractVersion: 'tle-canonical-ee-v1',
});

const global = Object.freeze({ frameId: 'frame-001', kind: 'global' });
const local = Object.freeze({ frameId: 'frame-001', kind: 'local' });

const accepted = {
  identity,
  global,
  local,
} as unknown as ScenePlanAcceptedInput;

const presentation = {
  view: 'service' as const,
  density: 'clean' as const,
  focus: 'geometry' as const,
};

const plan = compileScenePlan(accepted, presentation);
assert.notEqual(plan, null);
assert.equal(plan?.identity, identity);
assert.equal(plan?.global, global);
assert.equal(plan?.local, local);
assert.equal(plan?.view, presentation.view);
assert.equal(plan?.density, presentation.density);
assert.equal(plan?.focus, presentation.focus);
assert.equal(plan?.availability, 'available');
assert.equal(plan?.reason, null);
assert.equal(Object.isFrozen(plan), true);

// Local views intentionally publish only the local projection.  They remain
// available without inventing a global frame.
const serviceOnly = compileScenePlan({ ...accepted, global: null }, presentation);
assert.equal(serviceOnly?.availability, 'available');
assert.equal(serviceOnly?.reason, null);
assert.equal(serviceOnly?.global, null);
assert.equal(serviceOnly?.local, local);

const skyOnly = compileScenePlan({ ...accepted, global: null }, {
  ...presentation,
  view: 'sky',
});
assert.equal(skyOnly?.availability, 'available');
assert.equal(skyOnly?.reason, null);

// The Earth/system projection has the inverse requirement: a global frame is
// sufficient even when no local-service projection is published.
const globalOnly = compileScenePlan({ ...accepted, local: null }, {
  ...presentation,
  view: 'earth',
});
assert.equal(globalOnly?.availability, 'available');
assert.equal(globalOnly?.reason, null);
assert.equal(globalOnly?.global, global);
assert.equal(globalOnly?.local, null);

// The compiler must not invent a frame, source, or scene when the accepted
// publication is unavailable.
assert.equal(compileScenePlan(null, presentation), null);

const missingLocal = compileScenePlan({ ...accepted, local: null }, presentation);
assert.notEqual(missingLocal, null);
assert.equal(missingLocal?.availability, 'unavailable');
assert.equal(missingLocal?.reason, 'local scene projection is unavailable for the selected local view');
assert.equal(missingLocal?.identity, identity);
assert.equal(missingLocal?.global, global);
assert.equal(missingLocal?.local, null);

const missingGlobal = compileScenePlan({ ...accepted, global: null }, {
  ...presentation,
  view: 'earth',
});
assert.equal(missingGlobal?.availability, 'unavailable');
assert.equal(missingGlobal?.reason, 'global scene projection is unavailable for the earth view');
assert.equal(missingGlobal?.global, null);
assert.equal(missingGlobal?.local, local);

const noProjection = compileScenePlan({ ...accepted, global: null, local: null }, presentation);
assert.equal(noProjection?.availability, 'unavailable');
assert.equal(noProjection?.reason, 'local scene projection is unavailable for the selected local view');

console.log('scenePlanCompiler.test.ts: PASS');
