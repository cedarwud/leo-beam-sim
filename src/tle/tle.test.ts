import assert from 'node:assert/strict';

import {
  TLE_SOURCE_KIND,
  asiaTaipeiToUtc,
  computeTleChecksum,
  createTlePropagationFrame,
  isTleArchiveError,
  parseTleEpoch,
  propagateTleSnapshot,
  resolveTleSnapshot,
  taipeiLocalToUtc,
  utcToAsiaTaipei,
  utcToTaipeiLocal,
  validateTleArchiveManifest,
  validateTleChecksum,
  type TleArchiveEntry,
} from './index';

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
  assert.equal(epochField.length, 14);
  return checksumLine(`${BASE_LINE_1.slice(0, 18)}${epochField}${BASE_LINE_1.slice(32, 68)}`);
}

function line2WithChange(change: string): string {
  assert.equal(change.length, 4);
  return checksumLine(`${BASE_LINE_2.slice(0, 18)}${change}${BASE_LINE_2.slice(22, 68)}`);
}

function entry(epochField: string, sourcePath = `archive/${epochField}.tle`, line2 = BASE_LINE_2): TleArchiveEntry {
  const line1 = line1WithEpoch(epochField);
  return {
    satelliteId: 'ONEWEB-0012',
    satelliteName: 'ONEWEB-0012',
    epochUtc: parseTleEpoch(line1).epochUtc,
    line1,
    line2,
    sourcePath,
    sourceKind: TLE_SOURCE_KIND,
  };
}

function epochFieldForDayOffset(dayOffset: number): string {
  const epochMs = Date.UTC(2026, 0, 1) + dayOffset * 86_400_000;
  const date = new Date(epochMs);
  const yearStartMs = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((epochMs - yearStartMs) / 86_400_000) + 1;
  return `${String(date.getUTCFullYear() % 100).padStart(2, '0')}${String(dayOfYear).padStart(3, '0')}.00000000`;
}

function largeManifestEntry(satelliteId: string, dayOffset: number): TleArchiveEntry {
  const epochField = epochFieldForDayOffset(dayOffset);
  return {
    ...entry(epochField, `archive/${satelliteId}/${epochField}.tle`),
    satelliteId,
    satelliteName: satelliteId,
  };
}

const first = entry('26001.00000000');
const middle = entry('26032.00000000');
const last = entry('26060.00000000');
const manifest = validateTleArchiveManifest({
  archiveId: 'test-archive',
  maxPropagationAgeMs: 45 * 86_400_000,
  entries: [last, first, middle],
});

assert.equal(manifest.entries.length, 3, 'manifest normalizes and sorts injected entries');
assert.deepEqual(manifest.entries.map((item) => item.epochUtc), [first.epochUtc, middle.epochUtc, last.epochUtc]);

const firstBoundary = resolveTleSnapshot(manifest, first.epochUtc, 'ONEWEB-0012');
assert.equal(firstBoundary.epochUtc, first.epochUtc, 'first archive boundary resolves');
const betweenFirstAndMiddle = resolveTleSnapshot(manifest, '2026-01-20T00:00:00Z', 'ONEWEB-0012');
assert.equal(betweenFirstAndMiddle.epochUtc, first.epochUtc, 'middle interval resolves to prior epoch');
const middleBoundary = resolveTleSnapshot(manifest, middle.epochUtc, 'ONEWEB-0012');
assert.equal(middleBoundary.epochUtc, middle.epochUtc, 'middle archive boundary resolves');
const lastBoundary = resolveTleSnapshot(manifest, '2026-03-01T00:00:00Z', 'ONEWEB-0012');
assert.equal(lastBoundary.epochUtc, last.epochUtc, 'last archive boundary resolves to latest prior epoch');

assert.throws(
  () => resolveTleSnapshot(manifest, '2025-12-31T23:59:59Z', 'ONEWEB-0012'),
  (error: unknown) => isTleArchiveError(error) && error.code === 'NO_PRIOR_SNAPSHOT',
);
assert.throws(
  () => resolveTleSnapshot(manifest, '2026-04-20T00:00:00Z', 'ONEWEB-0012'),
  (error: unknown) => isTleArchiveError(error) && error.code === 'STALE_SNAPSHOT',
);

const exactDuplicate = validateTleArchiveManifest({
  maxPropagationAgeMs: 86_400_000,
  entries: [first, { ...first, sourcePath: 'archive/duplicate.tle' }],
});
assert.equal(exactDuplicate.entries.length, 1, 'identical duplicate epochs collapse deterministically');
assert.throws(
  () => validateTleArchiveManifest({
    maxPropagationAgeMs: 86_400_000,
    entries: [first, { ...first, line2: line2WithChange('2599') }],
  }),
  (error: unknown) => isTleArchiveError(error) && error.code === 'CONFLICTING_EPOCH',
);

const brokenChecksum = `${BASE_LINE_1.slice(0, 30)}${BASE_LINE_1[30] === '0' ? '1' : '0'}${BASE_LINE_1.slice(31)}`;
assert.throws(
  () => validateTleChecksum(brokenChecksum, 'broken line 1'),
  (error: unknown) => isTleArchiveError(error) && error.code === 'CHECKSUM_MISMATCH',
);

assert.equal(asiaTaipeiToUtc('2026-08-11T12:34:56'), '2026-08-11T04:34:56.000Z');
assert.equal(taipeiLocalToUtc('2026-08-11T12:34:56'), '2026-08-11T04:34:56.000Z');
assert.equal(utcToAsiaTaipei('2026-08-11T04:34:56Z'), '2026-08-11T12:34:56.000');
assert.equal(utcToTaipeiLocal('2026-08-11T04:34:56.000Z'), '2026-08-11T12:34:56.000');
assert.throws(
  () => asiaTaipeiToUtc('2026-08-11T12:34:56Z'),
  (error: unknown) => isTleArchiveError(error) && error.code === 'AMBIGUOUS_LOCAL_TIME',
);
assert.throws(
  () => resolveTleSnapshot(manifest, '2026-08-11T12:34:56'),
  (error: unknown) => isTleArchiveError(error) && error.code === 'REQUESTED_INSTANT_INVALID',
);

const frameAtEpoch = createTlePropagationFrame(manifest, first.epochUtc, { satelliteIds: ['ONEWEB-0012'] });
const frameLater = createTlePropagationFrame(manifest, '2026-01-02T00:00:00Z', { satelliteIds: ['ONEWEB-0012'] });
assert.equal(frameAtEpoch.sourceKind, 'ARCHIVED_TLE');
assert.equal(frameAtEpoch.propagationModel, 'SGP4');
assert.notEqual(frameAtEpoch.frameId, frameLater.frameId, 'frame identity changes with requested instant');
assert.notDeepEqual(
  frameAtEpoch.satellites[0]?.positionTemeKm,
  frameLater.satellites[0]?.positionTemeKm,
  'SGP4 coordinates change at different instants',
);
assert.equal(frameAtEpoch.resolvedEpochsUtc['ONEWEB-0012'], first.epochUtc);
assert.equal(frameAtEpoch.satellites[0]?.provenance.archiveId, 'test-archive');
assert.ok(Object.isFrozen(frameAtEpoch));
assert.ok(Object.isFrozen(frameAtEpoch.satellites));
assert.ok(Object.isFrozen(frameAtEpoch.satellites[0]?.positionTemeKm));

const oneDayManifest = validateTleArchiveManifest({
  maxPropagationAgeMs: 86_400_000,
  entries: [first],
});
const acceptedAtWindowEnd = resolveTleSnapshot(oneDayManifest, '2026-01-02T00:00:00Z', 'ONEWEB-0012');
assert.doesNotThrow(
  () => propagateTleSnapshot(acceptedAtWindowEnd, '2026-01-02T00:29:59Z'),
  'a trajectory point within the +/-30 minute playback window remains allowed',
);
assert.throws(
  () => propagateTleSnapshot(acceptedAtWindowEnd, '2026-01-02T00:30:01Z'),
  (error: unknown) => isTleArchiveError(error) && error.code === 'STALE_SNAPSHOT',
  'propagation outside max age and the +/-30 minute window fails closed',
);

const largeManifestEntries = ['ONEWEB-A', 'ONEWEB-B'].flatMap((satelliteId) => (
  Array.from({ length: 651 }, (_, dayOffset) => largeManifestEntry(satelliteId, dayOffset))
));
const largeManifest = validateTleArchiveManifest({
  archiveId: '2x651-performance',
  maxPropagationAgeMs: 2 * 86_400_000,
  entries: largeManifestEntries,
});
const largeRequest = largeManifest.entries[largeManifest.entries.length - 1]!.epochUtc;
const perfStart = performance.now();
const largeFrame = createTlePropagationFrame(largeManifest, largeRequest);
const perfElapsedMs = performance.now() - perfStart;
assert.equal(largeFrame.satellites.length, 2);
assert.ok(perfElapsedMs < 1_000, `2x651 all-satellite frame should resolve in under 1s (measured ${perfElapsedMs.toFixed(2)} ms)`);
console.log(`2x651 all-satellite TLE frame: ${perfElapsedMs.toFixed(2)} ms`);

console.log('Archived TLE validation, resolution, timezone, and SGP4 tests passed');
