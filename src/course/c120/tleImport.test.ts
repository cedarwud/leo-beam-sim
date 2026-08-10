import assert from 'node:assert/strict';
import { C120ContractError } from './contract';
import { C120_FIXTURE_PROVIDER } from './fixtures';
import { validateC120PinnedTleImport } from './tleImport';

const anchor = C120_FIXTURE_PROVIDER.getScenario().tle;
const receipt = validateC120PinnedTleImport(`${anchor.lines.join('\r\n')}\r\n`, 'oneweb-0314-pinned.tle', anchor);
assert.equal(receipt.recordSha256, anchor.recordSha256);
assert.deepEqual(receipt.importedLines, anchor.lines);

assert.throws(
  () => validateC120PinnedTleImport(anchor.lines.join('\n').replace('49100', '99999'), 'wrong.tle', anchor),
  (error: unknown) => error instanceof C120ContractError && /does not match/.test(error.message),
);

console.log('C-120 pinned TLE import tests passed');
