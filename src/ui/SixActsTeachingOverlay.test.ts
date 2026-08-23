import assert from 'node:assert/strict';

import {
  buildSixActsShadowBandPath,
  buildSixActsTracePath,
  resolveSixActsTraceDomain,
  sixActsCandidateDecision,
  sixActsCandidateDeltaDb,
  sixActsTttProgress,
} from './SixActsTeachingOverlay';
import type { SixActsFrameFacts } from '../course/sixActs/liveReplayBridge';

function facts(overrides: Partial<SixActsFrameFacts> = {}): SixActsFrameFacts {
  return {
    simTimeSec: 0,
    servingSatelliteId: 'from',
    servingSinrDb: 10,
    candidateSatelliteId: 'to',
    candidateSinrDb: 13.4,
    triggerProgressSec: 0,
    lastCommittedHandover: null,
    ratesMbps: [10],
    systemPowerW: 40,
    provenance: 'canonical-aggregate',
    provenanceErrorCode: null,
    ...overrides,
  };
}

const trace = [
  facts({ simTimeSec: 0, servingSinrDb: 10, candidateSinrDb: 11 }),
  facts({ simTimeSec: 1, servingSinrDb: 9.5, candidateSinrDb: 12.8 }),
  facts({ simTimeSec: 2, servingSinrDb: 9, candidateSinrDb: null }),
];

assert.ok(Math.abs((sixActsCandidateDeltaDb(facts()) ?? 0) - 3.4) < 1e-9);
assert.equal(sixActsCandidateDecision(facts({ candidateSinrDb: 12 }), 3), 'eliminated');
assert.equal(sixActsCandidateDecision(facts({ triggerProgressSec: 4 }), 3), 'ttt');
assert.equal(sixActsCandidateDecision(facts({ candidateSinrDb: 13 }), 3), 'qualified');
assert.equal(sixActsCandidateDecision(facts({ candidateSatelliteId: null }), 3), 'none');
assert.equal(sixActsTttProgress(45, 30), 1);

const domain = resolveSixActsTraceDomain(trace, 3);
assert.ok(domain.minDb < 9);
assert.ok(domain.maxDb > 13);
assert.match(buildSixActsTracePath(trace, 'serving', 3, { domain }), /^M /);
assert.match(buildSixActsTracePath(trace, 'candidate', 3, { domain }), /^M /);
assert.match(buildSixActsShadowBandPath(trace, 3, { domain }), /^M /);

console.log('SixActs teaching overlay derives candidate decisions, TTT progress, and trace geometry from frame facts.');
