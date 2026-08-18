import assert from 'node:assert/strict';

import {
  TLE_RUN_ANCHOR_COUNT,
  TLE_RUN_DURATION_S,
  TLE_RUN_STEP_S,
  TleRunError,
  buildTleRunBundle,
  isTleRunError,
  type TleRunSelection,
} from './index';
import { TLE_SOURCE_KIND, parseTleEpoch, type TleArchiveEntry } from '../index';

const LINE_1 = '1 44057U 19010A   26015.11930051  .00000099  00000+0  22629-3 0  9996';
const LINE_2 = '2 44057  87.9018 259.2641 0001826  72.2132 287.9198 13.16594815331428';
const RECENT_LINE_1 = '1 44057U 19010A   26205.11930051  .00000099  00000+0  22629-3 0  9997';
const INVALID_INIT_LINE_1 = '1 44058U 19010A   26205.11930051  .00000099  00000+0  22629-3 0  9998';
const INVALID_INIT_LINE_2 = '2 44058  87.9018 259.2641 9999999  72.2132 287.9198 13.16594815331425';
const INVALID_PROPAGATION_LINE_1 = '1 46052U 20055AB  26205.71420644  .11230242  12472-4  37607-3 0  9993';
const INVALID_PROPAGATION_LINE_2 = '2 46052  53.1359 157.6174 0004616 266.0662  93.9860 16.44481002330574';

function entry(epochLine: string, sourcePath: string): TleArchiveEntry {
  return {
    satelliteId: 'ONEWEB-0012',
    satelliteName: 'ONEWEB-0012',
    epochUtc: parseTleEpoch(epochLine).epochUtc,
    line1: epochLine,
    line2: LINE_2,
    sourcePath,
    sourceKind: TLE_SOURCE_KIND,
  };
}

const t0Utc = parseTleEpoch(LINE_1).epochUtc;
const selection: TleRunSelection = {
  catalog: { archiveId: 'oneweb-test-archive' },
  snapshot: { sha256: 'a'.repeat(64) },
  manifest: {
    archiveId: 'oneweb-test-archive',
    maxPropagationAgeMs: 1_000,
    entries: [entry(LINE_1, 'archive/oneweb-test.tle')],
  },
};

const progress: number[] = [];
const statuses: string[] = [];
const buildStart = performance.now();
const bundle = await buildTleRunBundle({
  selection,
  t0Utc,
  onProgress: async (event) => {
    progress.push(event.completedAnchors);
    statuses.push(event.status);
  },
});
const buildElapsedMs = performance.now() - buildStart;

assert.equal(bundle.anchorCount, TLE_RUN_ANCHOR_COUNT);
assert.equal(bundle.durationS, TLE_RUN_DURATION_S);
assert.equal(bundle.stepS, TLE_RUN_STEP_S);
assert.equal(progress[progress.length - 1], TLE_RUN_ANCHOR_COUNT, 'progress must reach all anchors');
assert.equal(statuses[statuses.length - 1], 'complete', 'progress must publish complete');
assert.equal(bundle.getAnchorUtc(0), t0Utc);
assert.equal(bundle.getAnchorUtc(TLE_RUN_ANCHOR_COUNT - 1), new Date(Date.parse(t0Utc) + TLE_RUN_DURATION_S * 1_000).toISOString());
assert.equal(bundle.getSatelliteIndex('ONEWEB-0012'), 0);
assert.equal(bundle.satelliteCount, 1);
assert.equal(bundle.resolvedSnapshots.length, 1);
assert.equal(bundle.resolvedSnapshots[0]?.sourcePath, 'archive/oneweb-test.tle');
assert.equal(bundle.publicationSha256, 'a'.repeat(64));
assert.ok(bundle.runId.includes('oneweb-test-archive'));
assert.ok(bundle.runId.includes('a'.repeat(64)));
assert.ok(bundle.runId.includes(String(TLE_RUN_DURATION_S)));
assert.ok(bundle.runId.includes(String(TLE_RUN_STEP_S)));
assert.ok(Object.isFrozen(bundle));
assert.ok(Object.isFrozen(bundle.manifest));
assert.ok(Object.isFrozen(bundle.resolvedSnapshots[0]));

const firstState = bundle.readState(0, 'ONEWEB-0012');
const lastState = bundle.readState(TLE_RUN_ANCHOR_COUNT - 1, 0);
assert.equal(firstState.requestedInstantUtc, t0Utc);
assert.equal(lastState.requestedInstantUtc, bundle.getAnchorUtc(TLE_RUN_ANCHOR_COUNT - 1));
assert.ok(Number.isFinite(firstState.positionTemeKm.x));
assert.notDeepEqual(firstState.positionTemeKm, lastState.positionTemeKm);
assert.ok(Object.isFrozen(firstState));
assert.ok(Object.isFrozen(firstState.positionTemeKm));

const frame = bundle.materializeFrame(bundle.getAnchorUtc(0));
assert.equal(frame.requestedInstantUtc, t0Utc);
assert.equal(frame.satellites.length, 1);
assert.deepEqual(frame.satellites[0]?.positionTemeKm, firstState.positionTemeKm);
assert.ok(Object.isFrozen(frame));

const repeat = await buildTleRunBundle(selection, t0Utc, { yieldEveryAnchors: 241 });
assert.equal(repeat.runId, bundle.runId, 'same archive/publication/time/config has deterministic identity');

await assert.rejects(
  () => buildTleRunBundle(selection, t0Utc, { durationS: 7_201 }),
  (error: unknown) => isTleRunError(error) && error.code === 'INVALID_CONFIG',
);
await assert.rejects(
  () => buildTleRunBundle(selection, t0Utc, { stepS: 15 }),
  (error: unknown) => isTleRunError(error) && error.code === 'INVALID_CONFIG',
);

const controller = new AbortController();
await assert.rejects(
  () => buildTleRunBundle({
    selection,
    t0Utc,
    signal: controller.signal,
    yieldEveryAnchors: 1,
    onProgress: (event) => {
      if (event.completedAnchors === 2) controller.abort();
    },
  }),
  (error: unknown) => isTleRunError(error) && error.code === 'CANCELLED',
  'a cancelled run must not return a partial bundle',
);

let current = true;
await assert.rejects(
  () => buildTleRunBundle({
    selection,
    t0Utc,
    isCurrent: () => current,
    yieldEveryAnchors: 1,
    onProgress: (event) => {
      if (event.completedAnchors === 2) current = false;
    },
  }),
  (error: unknown) => isTleRunError(error) && error.code === 'STALE',
  'a superseded run must not return a partial bundle',
);

assert.ok(TleRunError, 'the typed run error remains part of the public seam');
console.log(`archived-TLE run bundle: ${bundle.satelliteCount} satellite × ${bundle.anchorCount} anchors in ${buildElapsedMs.toFixed(2)} ms`);

const mixedSelection: TleRunSelection = {
  catalog: { archiveId: 'mixed-test-archive' },
  snapshot: { sha256: 'b'.repeat(64) },
  manifest: {
    archiveId: 'mixed-test-archive',
    maxPropagationAgeMs: 7 * 24 * 60 * 60 * 1_000,
    entries: [
      {
        satelliteId: '44057',
        satelliteName: 'ONEWEB-VALID-44057',
        epochUtc: parseTleEpoch(RECENT_LINE_1).epochUtc,
        line1: RECENT_LINE_1,
        line2: LINE_2,
        sourcePath: 'archive/valid.tle',
        sourceKind: TLE_SOURCE_KIND,
      },
      {
        satelliteId: '46052',
        satelliteName: 'STARLINK-1541',
        epochUtc: parseTleEpoch(INVALID_PROPAGATION_LINE_1).epochUtc,
        line1: INVALID_PROPAGATION_LINE_1,
        line2: INVALID_PROPAGATION_LINE_2,
        sourcePath: 'archive/invalid-propagation.tle',
        sourceKind: TLE_SOURCE_KIND,
      },
      {
        satelliteId: '44058',
        satelliteName: 'SYNTHETIC-INIT-FAILURE',
        epochUtc: parseTleEpoch(INVALID_INIT_LINE_1).epochUtc,
        line1: INVALID_INIT_LINE_1,
        line2: INVALID_INIT_LINE_2,
        sourcePath: 'archive/invalid-init.tle',
        sourceKind: TLE_SOURCE_KIND,
      },
    ],
  },
};
const mixedT0Utc = '2026-07-27T12:00:00.000Z';
const mixedBundle = await buildTleRunBundle({
  selection: mixedSelection,
  t0Utc: mixedT0Utc,
  yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
});
assert.equal(mixedBundle.satelliteCount, 1, 'one invalid satellite must not remove valid satellites');
assert.equal(mixedBundle.satellites[0]?.satelliteId, '44057');
assert.equal(mixedBundle.exclusionProvenance.sourceCount, 3);
assert.equal(mixedBundle.exclusionProvenance.resolvedCount, 3);
assert.equal(mixedBundle.exclusionProvenance.includedCount, 1);
assert.equal(mixedBundle.exclusionProvenance.excludedCount, 2);
const initExclusion = mixedBundle.exclusionProvenance.exclusions.find(item => item.satelliteId === '44058');
assert.ok(initExclusion);
assert.equal(initExclusion.reason, 'SGP4_INIT_FAILED');
assert.equal(initExclusion.satrecError, 4);
const exclusion = mixedBundle.exclusionProvenance.exclusions.find(item => item.satelliteId === '46052');
assert.ok(exclusion);
assert.equal(exclusion.satelliteId, '46052');
assert.equal(exclusion.firstFailingAnchorIndex, 0);
assert.equal(exclusion.firstFailingAnchorUtc, mixedT0Utc);
assert.equal(exclusion.reason, 'SGP4_PROPAGATION_FAILED');
assert.equal(exclusion.satrecError, 1);
assert.equal(mixedBundle.getSatelliteIndex('46052'), undefined);
assert.equal(mixedBundle.materializeFrame(0).satellites.length, 1);
assert.ok(Object.isFrozen(mixedBundle.exclusionProvenance));
assert.ok(Object.isFrozen(mixedBundle.exclusionProvenance.exclusions));
assert.ok(Object.isFrozen(exclusion));

const validOnlyBundle = await buildTleRunBundle({
  selection: {
    ...mixedSelection,
    manifest: {
      ...mixedSelection.manifest,
      entries: [mixedSelection.manifest.entries[0]!],
    },
  },
  t0Utc: mixedT0Utc,
  yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
});
assert.notEqual(
  mixedBundle.runIdentity,
  validOnlyBundle.runIdentity,
  'run identity must include the effective exclusion set',
);

const onlyInvalidSelection: TleRunSelection = {
  ...mixedSelection,
  manifest: {
    ...mixedSelection.manifest,
    entries: [mixedSelection.manifest.entries[1]!],
  },
};
await assert.rejects(
  () => buildTleRunBundle({
    selection: onlyInvalidSelection,
    t0Utc: mixedT0Utc,
    yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
  }),
  (error: unknown) => isTleRunError(error)
    && error.code === 'PROPAGATION_FAILED'
    && error.details?.excludedCount === 1
    && error.details?.resolvedCount === 1,
  'a run with no valid satellite must fail closed',
);

console.log('Archived-TLE RunBundle tests passed');
