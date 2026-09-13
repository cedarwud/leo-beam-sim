import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  CANONICAL_HANDOVER_TEACHING_PATH,
  RETIRED_INTRA_HANDOVER_TEACHING_PATH,
  resolveLegacyRouteRetirement,
} from './legacyRouteRetirement';

test('the retired Intra prototype URL resolves to the canonical R5/R6 shell', () => {
  assert.equal(
    resolveLegacyRouteRetirement(
      RETIRED_INTRA_HANDOVER_TEACHING_PATH,
      '?controls=1',
      '#checkpoint',
    ),
    `${CANONICAL_HANDOVER_TEACHING_PATH}?controls=1&retiredSurface=intra-handover-teaching#checkpoint`,
  );
  assert.equal(resolveLegacyRouteRetirement('/prototype/global-constellation', '', ''), null);
});

test('main router cannot dynamically import the retired renderer', async () => {
  const source = await readFile(new URL('../main.tsx', import.meta.url), 'utf8');
  assert.match(source, /resolveLegacyRouteRetirement/);
  assert.doesNotMatch(source, /IntraHandoverTeachingPrototype/);
  assert.doesNotMatch(source, /isIntraHandoverTeachingRoute/);
});
