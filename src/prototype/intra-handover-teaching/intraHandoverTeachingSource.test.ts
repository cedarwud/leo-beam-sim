import assert from 'node:assert/strict';

import {
  buildIntraHandoverTeachingSource,
  sourceIdentityIsTruthful,
} from './intraHandoverTeachingSource';

const result = buildIntraHandoverTeachingSource();
assert.equal(result.available, true, result.available ? '' : result.reason);
if (result.available) {
  assert.equal(result.sourceOwner, 'live-walker');
  assert.equal(result.claimKind, 'live-truth');
  assert.equal(result.intraEvent.kind, 'intra');
  assert.equal(result.intraEvent.fromSatId, result.intraEvent.toSatId);
  assert.notEqual(result.intraEvent.fromBeamId, result.intraEvent.toBeamId);
  assert.ok(Number.isFinite(result.intraEvent.fromSinrDb));
  assert.ok(Number.isFinite(result.intraEvent.toSinrDb));
  assert.ok(Number.isFinite(result.intraEvent.deltaDb));
  assert.equal(result.tttSec, null, 'TTT is fail-closed when not published by the source event');
  assert.equal(result.eeBitsPerJ, null, 'EE is fail-closed because Walker event index is not canonical EE');
  assert.equal(sourceIdentityIsTruthful(result), true);

  const replay = buildIntraHandoverTeachingSource();
  assert.equal(replay.available, true);
  if (replay.available) {
    assert.equal(replay.intraEvent.id, result.intraEvent.id, 'selection is deterministic');
    assert.equal(replay.intraEvent.fromSatId, result.intraEvent.fromSatId);
    assert.equal(replay.intraEvent.fromBeamId, result.intraEvent.fromBeamId);
    assert.equal(replay.intraEvent.toBeamId, result.intraEvent.toBeamId);
  }
}

console.log('intraHandoverTeachingSource tests pass');
