import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  reopenC120ClassSnapshot,
} from '../src/course/c120/backend/index';
import type { C120AuthoritativeReplay, C120Scenario } from '../src/course/c120/contract';
import {
  C120_FIXTURE_SCENARIO,
  createC120ProviderFromScenario,
} from '../src/course/c120/fixtures';
import { validateC120PinnedTleImport } from '../src/course/c120/tleImport';
import {
  C120_CLASS_BUNDLE_FILENAMES,
  materializeC120ClassBundle,
  reopenC120ClassBundleManifest,
} from './c120-materialize-class-snapshot';

const RETRIEVED_AT = '2026-08-09T10:00:00Z';
const OMM_BODY = '[{"OBJECT_NAME":"ONEWEB-0314","OBJECT_ID":"2021-075AB","EPOCH":"2026-08-09T09:20:51.128160","MEAN_MOTION":13.17651252,"ECCENTRICITY":0.0001589,"INCLINATION":87.9189,"RA_OF_ASC_NODE":355.279,"ARG_OF_PERICENTER":86.873,"MEAN_ANOMALY":273.2584,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","NORAD_CAT_ID":49100,"ELEMENT_SET_NO":999,"REV_AT_EPOCH":24057,"BSTAR":9.4634e-5,"MEAN_MOTION_DOT":5.0e-7,"MEAN_MOTION_DDOT":0}]\r\n';
const TLE_LINE_0 = 'ONEWEB-0314'.padEnd(24, ' ');
const TLE_LINE_1 = '1 49100U 21075AB  26221.38948065  .00000050  00000+0  94634-4 0  9999';
const TLE_LINE_2 = '2 49100  87.9189 355.2790 0001589  86.8730 273.2584 13.17651252240576';
const TLE_BODY = [TLE_LINE_0, TLE_LINE_1, TLE_LINE_2].join('\r\n') + '\r\n';

function withChecksum(prefix: string): string {
  assert.equal(prefix.length, 68);
  let sum = 0;
  for (const character of prefix) {
    if (character >= '0' && character <= '9') sum += character.charCodeAt(0) - 48;
    else if (character === '-') sum += 1;
  }
  return `${prefix}${sum % 10}`;
}

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().filter(key => object[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

function readdress(value: Record<string, unknown>): Record<string, unknown> {
  const { bundleId: _bundleId, contentSha256: _contentSha256, ...payload } = value;
  const contentSha256 = createHash('sha256').update(canonicalJson(payload)).digest('hex');
  return { ...payload, bundleId: `sha256:${contentSha256}`, contentSha256 };
}

function replayProjection(replay: C120AuthoritativeReplay): unknown {
  return {
    replayId: replay.replayId,
    input: replay.input,
    frames: replay.frames.map(frame => ({ elapsedSec: frame.elapsedSec, evidence: frame.evidence })),
    outcome: replay.outcome,
    cardLedger: replay.cardLedger,
  };
}

function assertReplayParity(actual: C120Scenario, donor: C120Scenario): void {
  for (const surface of ['labA', 'labB', 'labC', 'clinic'] as const) {
    assert.deepEqual(
      actual[surface].replays.map(replayProjection),
      donor[surface].replays.map(replayProjection),
      `${surface} evidence consequences must stay donor-authored until the course producer is integrated`,
    );
    for (const [replayIndex, replay] of actual[surface].replays.entries()) {
      const donorReplay = donor[surface].replays[replayIndex]!;
      for (const [frameIndex, frame] of replay.frames.entries()) {
        assert.notDeepEqual(
          frame.scene.satellitePosition,
          donorReplay.frames[frameIndex]!.scene.satellitePosition,
          `${surface} replay geometry must be materialized from the SGP4 trajectory`,
        );
      }
    }
  }
}

const root = await mkdtemp(join(tmpdir(), 'c120-class-materializer-test-'));
try {
  const inputDir = join(root, 'input');
  await mkdir(inputDir);
  const ommFile = join(inputDir, 'source.json');
  const tleFile = join(inputDir, 'source.tle');
  await writeFile(ommFile, OMM_BODY, 'utf8');
  await writeFile(tleFile, TLE_BODY, 'utf8');
  const propagation = {
    observer: { latitudeDeg: 24.944, longitudeDeg: 121.371, heightKm: 0.05 },
    startUtc: '2026-08-09T18:20:00Z',
    endUtc: '2026-08-09T18:50:00Z',
    sampleStepSec: 10,
    minimumElevationDeg: 10,
  } as const;
  const outDir = join(root, 'published', 'class-a');
  const request = {
    outDir,
    ommFile,
    tleFile,
    retrievedAt: RETRIEVED_AT,
    generatedAt: '2026-08-09T10:00:01Z',
    downloadPath: '/course/c120/real-data/oneweb-0314-current.tle',
    propagation,
  } as const;
  const manifest = await materializeC120ClassBundle(request);
  assert.match(manifest.bundleId, /^sha256:[0-9a-f]{64}$/);
  assert.match(manifest.providerId, /^c120-canonical-adapter-[0-9a-f]{64}$/);
  assert.equal(manifest.scenarioId, C120_FIXTURE_SCENARIO.manifest.scenario.scenarioId);
  assert.equal(manifest.source.epochDeltaMs, 0);
  assert.equal(manifest.truth.measured, false);
  assert.equal(manifest.truth.wholeSatelliteCanonical, false);
  assert.equal(manifest.truth.energyScope, 'GOLDEN_VECTOR_PARITY_ONLY');
  assert.equal(manifest.truth.browserScientificFormula, false);

  const manifestText = await readFile(join(outDir, C120_CLASS_BUNDLE_FILENAMES.manifest), 'utf8');
  assert.deepEqual(JSON.parse(manifestText), manifest);
  assert.equal(reopenC120ClassBundleManifest(manifestText).bundleId, manifest.bundleId);
  const upgraded = readdress({
    ...manifest,
    truth: { ...manifest.truth, measured: true },
  });
  assert.throws(() => reopenC120ClassBundleManifest(JSON.stringify(upgraded)), /truth boundary/);
  const unknown = readdress({ ...manifest, live: true });
  assert.throws(() => reopenC120ClassBundleManifest(JSON.stringify(unknown)), /unknown or missing/);
  const snapshotText = await readFile(join(outDir, C120_CLASS_BUNDLE_FILENAMES.snapshot), 'utf8');
  const reopenedSnapshot = reopenC120ClassSnapshot(snapshotText);
  assert.equal(reopenedSnapshot.snapshotId, manifest.snapshotId);
  assert.ok(reopenedSnapshot.artifact.orbit.pass.trajectory.length >= 2);
  assert.deepEqual(reopenedSnapshot.artifact.orbit.pass.trajectory[0], reopenedSnapshot.artifact.orbit.pass.aos);
  const scenario = JSON.parse(
    await readFile(join(outDir, C120_CLASS_BUNDLE_FILENAMES.scenario), 'utf8'),
  ) as C120Scenario;
  const provider = createC120ProviderFromScenario('canonical-adapter', manifest.providerId, scenario);
  assert.equal(provider.getScenario().manifest.scenario.scenarioId, manifest.scenarioId);
  assert.equal(provider.getScenario().manifest.scenario.targetUtc, manifest.scenarioTargetUtc);
  assert.equal(
    provider.getScenario().tle.downloadPath,
    `/course/c120/real-data/${manifest.snapshotId.slice('sha256:'.length)}/oneweb-0314-current.tle`,
  );
  assertReplayParity(provider.getScenario(), C120_FIXTURE_SCENARIO);
  const bundledTle = await readFile(join(outDir, manifest.files.tle.name), 'utf8');
  const imported = validateC120PinnedTleImport(bundledTle, manifest.files.tle.name, scenario.tle);
  assert.equal(imported.recordSha256, manifest.source.tleRawSha256);

  const before = manifestText;
  await assert.rejects(() => materializeC120ClassBundle(request), /output already exists/);
  assert.equal(await readFile(join(outDir, C120_CLASS_BUNDLE_FILENAMES.manifest), 'utf8'), before);

  const tooSoonOut = join(root, 'published', 'too-soon');
  await assert.rejects(() => materializeC120ClassBundle({
    ...request,
    outDir: tooSoonOut,
    lastRetrievedAt: '2026-08-09T09:00:01Z',
  }), /SOURCE_REFRESH_TOO_SOON/);
  assert.equal(await exists(tooSoonOut), false);
  const previousManifestOut = join(root, 'published', 'previous-manifest-too-soon');
  await assert.rejects(() => materializeC120ClassBundle({
    ...request,
    outDir: previousManifestOut,
    retrievedAt: '2026-08-09T11:00:00Z',
    generatedAt: '2026-08-09T11:00:01Z',
    previousManifest: join(outDir, C120_CLASS_BUNDLE_FILENAMES.manifest),
  }), /SOURCE_REFRESH_TOO_SOON/);
  assert.equal(await exists(previousManifestOut), false);

  const mismatchTle = join(inputDir, 'mismatched.tle');
  const mismatchLine1 = withChecksum(TLE_LINE_1.slice(0, 18) + '26221.48948065' + TLE_LINE_1.slice(32, 68));
  const epochMismatch = [TLE_LINE_0, mismatchLine1, TLE_LINE_2].join('\r\n') + '\r\n';
  await writeFile(mismatchTle, epochMismatch, 'utf8');
  const mismatchOut = join(root, 'published', 'epoch-mismatch');
  await assert.rejects(() => materializeC120ClassBundle({
    ...request,
    outDir: mismatchOut,
    tleFile: mismatchTle,
  }));
  assert.equal(await exists(mismatchOut), false);

  await assert.rejects(() => materializeC120ClassBundle({ ...request, outDir: '/' }), /protected broad path/);
  await assert.rejects(
    () => materializeC120ClassBundle({ ...request, outDir: `${root}/published/../escape` }),
    /must not contain/,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('C-120 class materializer operator tests passed');
