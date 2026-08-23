import assert from 'node:assert/strict';
import {
  advanceSixActsSubtitleState,
  createSixActsSubtitleState,
  type SixActsSubtitlePolicy,
} from './subtitleStateMachine';
import type { SixActsFrameFacts } from './liveReplayBridge';

const policy: SixActsSubtitlePolicy = { offsetDb: 3, tttSec: 30 };

function facts(overrides: Partial<SixActsFrameFacts> = {}): SixActsFrameFacts {
  return {
    simTimeSec: 0,
    servingSatelliteId: 'from',
    servingSinrDb: 10,
    candidateSatelliteId: null,
    candidateSinrDb: null,
    triggerProgressSec: 0,
    lastCommittedHandover: null,
    ratesMbps: [10],
    systemPowerW: 40,
    provenance: 'canonical-aggregate',
    provenanceErrorCode: null,
    ...overrides,
  };
}

let state = createSixActsSubtitleState(facts(), policy);
assert.equal(state.beat, 'service');

state = advanceSixActsSubtitleState(state, facts({ simTimeSec: 1, servingSinrDb: 9.5 }), policy);
assert.equal(state.beat, 'decline');

state = advanceSixActsSubtitleState(state, facts({
  simTimeSec: 2,
  servingSinrDb: 9.5,
  candidateSatelliteId: 'to',
  candidateSinrDb: 10,
}), policy);
assert.equal(state.beat, 'elimination');

state = advanceSixActsSubtitleState(state, facts({
  simTimeSec: 3,
  servingSinrDb: 9.5,
  candidateSatelliteId: 'to',
  candidateSinrDb: 13,
  triggerProgressSec: 1,
}), policy);
assert.equal(state.beat, 'ttt');

state = advanceSixActsSubtitleState(state, facts({
  simTimeSec: 4,
  servingSatelliteId: 'to',
  servingSinrDb: 13,
  lastCommittedHandover: {
    timeMs: 4_000,
    action: 'inter-handover',
    fromSatelliteId: 'from',
    toSatelliteId: 'to',
    deltaDb: 3.5,
  },
}), policy);
assert.equal(state.beat, 'execute');

state = advanceSixActsSubtitleState(state, facts({
  simTimeSec: 6,
  servingSatelliteId: 'to',
  servingSinrDb: 13,
  lastCommittedHandover: {
    timeMs: 4_000,
    action: 'inter-handover',
    fromSatelliteId: 'from',
    toSatelliteId: 'to',
    deltaDb: 3.5,
  },
}), policy);
assert.equal(state.beat, 'receipt');

state = advanceSixActsSubtitleState(state, facts({
  simTimeSec: 10,
  servingSatelliteId: 'to',
  servingSinrDb: 12,
  lastCommittedHandover: {
    timeMs: 4_000,
    action: 'inter-handover',
    fromSatelliteId: 'from',
    toSatelliteId: 'to',
    deltaDb: 3.5,
  },
}), policy);
assert.equal(state.beat, 'new-normal');

state = advanceSixActsSubtitleState(state, facts({
  simTimeSec: 11,
  servingSatelliteId: 'to',
  servingSinrDb: 12,
  candidateSatelliteId: 'next',
  candidateSinrDb: 16,
}), policy);
assert.equal(state.beat, 'candidate');

console.log('SixActs subtitle FSM covers service, decline, candidate, elimination, TTT, execute, receipt, and new-normal.');
