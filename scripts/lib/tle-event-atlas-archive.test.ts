import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { prepareTleEventAtlasArchive } from './tle-event-atlas-archive';

const BASE_LINE_1 = '1 44057U 19010A   26015.11930051  .00000099  00000+0  22629-3 0  9996';
const BASE_LINE_2 = '2 44057  87.9018 259.2641 0001826  72.2132 287.9198 13.16594815331428';

function checksumLine(prefix: string): string {
  let sum = 0;
  for (const character of prefix) {
    if (character >= '0' && character <= '9') sum += Number(character);
    else if (character === '-') sum += 1;
  }
  return `${prefix}${sum % 10}`;
}

function line1WithEpoch(epochField: string): string {
  return checksumLine(`${BASE_LINE_1.slice(0, 18)}${epochField}${BASE_LINE_1.slice(32, 68)}`);
}

function publication(epochField: string): string {
  return `ONEWEB-TEST\n${line1WithEpoch(epochField)}\n${BASE_LINE_2}\n`;
}

const root = await mkdtemp(join(tmpdir(), 'tle-event-atlas-archive-'));
try {
  const sourceDirectory = join(root, 'source', 'oneweb', 'tle');
  const cachePath = join(root, 'cache', 'oneweb.json');
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(join(sourceDirectory, 'oneweb_20260101.tle'), publication('26001.00000000'));
  await writeFile(join(sourceDirectory, 'oneweb_20260102.tle'), publication('26002.00000000'));

  const first = await prepareTleEventAtlasArchive({
    sourceRoot: join(root, 'source'),
    constellation: 'oneweb',
    cachePath,
  });
  assert.equal(first.catalog.snapshotCount, 2);
  assert.equal(first.catalog.excludedSnapshots?.length, 0);
  assert.match(first.catalog.archiveContentSha256 ?? '', /^[0-9a-f]{64}$/);
  const selection = await first.loadSelection('2026-01-02T12:00:00.000Z');
  assert.equal(selection.snapshot.metadata.archiveDate, '20260102');
  assert.equal(selection.manifest.entries.length, 1);
  assert.equal(selection.manifest.entries[0]?.epochUtc, '2026-01-02T00:00:00.000Z');

  const reused = await prepareTleEventAtlasArchive({
    sourceRoot: join(root, 'source'),
    constellation: 'oneweb',
    cachePath,
  });
  assert.equal(reused.cache.generatedAtUtc, first.cache.generatedAtUtc, 'unchanged inventory must reuse the catalog cache');

  await writeFile(join(sourceDirectory, 'oneweb_20260103.tle'), 'not a 3LE publication\n');
  const rebuilt = await prepareTleEventAtlasArchive({
    sourceRoot: join(root, 'source'),
    constellation: 'oneweb',
    cachePath,
  });
  assert.equal(rebuilt.catalog.snapshotCount, 2);
  assert.equal(rebuilt.catalog.sourceSnapshotCount, 3);
  assert.equal(rebuilt.catalog.excludedSnapshots?.length, 1);
  assert.equal(rebuilt.catalog.excludedSnapshots?.[0]?.fileName, 'oneweb_20260103.tle');
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('filesystem TLE Event Atlas archive tests passed');
