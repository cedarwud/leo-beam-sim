import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSixActsProvenanceBadge } from './provenanceBadge';

test('focused-link projection receives a provenance disclosure', () => {
  const fallbackBadge = resolveSixActsProvenanceBadge({
    provenance: 'focused-link-projection',
    provenanceErrorCode: 'LIVE_POWER_MISMATCH',
  });

  assert.ok(fallbackBadge);
  assert.equal(fallbackBadge.message, 'canonical 聚合不可用；目前顯示單一鏈路投影（非全系統聚合）');
  assert.equal(fallbackBadge.canonicalErrorCode, 'LIVE_POWER_MISMATCH');
});

test('canonical aggregate does not receive a provenance disclosure', () => {
  const canonicalBadge = resolveSixActsProvenanceBadge({
    provenance: 'canonical-aggregate',
    provenanceErrorCode: null,
  });

  assert.equal(canonicalBadge, null);
});
