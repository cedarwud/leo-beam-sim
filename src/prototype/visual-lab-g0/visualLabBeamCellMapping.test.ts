import assert from 'node:assert/strict';

import { cellIndexForBeamId } from './visualLabBeamCellMapping';

const targets = [
  { beamId: 18, cellIndex: 2 },
  { beamId: 41, cellIndex: 6 },
] as const;

assert.equal(cellIndexForBeamId(targets, 18), 2);
assert.equal(cellIndexForBeamId(targets, 41), 6);
assert.equal(cellIndexForBeamId(targets, 2), null, 'a cell index cannot be mistaken for a beam ID');
assert.equal(cellIndexForBeamId(targets, null), null);

console.log('visual-lab beam identity maps to cells without equating namespaces');
