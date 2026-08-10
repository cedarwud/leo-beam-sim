import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  C120_BUNDLED_MANIFEST_FILE,
  C120_BUNDLED_PROVIDER_ROOT,
  loadC120BundledProvider,
  type C120BrowserBundleFetcher,
} from './bundledProvider';

const SNAPSHOT = '703f0e3ae9224c58ca8e77e9f535c06a3d71789b7a3bd07707ac7f5844201421';
const here = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(here, '../../..', 'public');
const bundleRoot = resolve(publicRoot, `course/c120/real-data/${SNAPSHOT}`);
const manifestText = await readFile(resolve(bundleRoot, C120_BUNDLED_MANIFEST_FILE), 'utf8');
const scenarioText = await readFile(resolve(bundleRoot, 'c120-materialized-scenario.json'), 'utf8');
const tleText = await readFile(resolve(bundleRoot, 'oneweb-0314-current.tle'), 'utf8');

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().filter(key => candidate[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalJson(candidate[key])}`).join(',')}}`;
}

function readdress(value: Record<string, unknown>): string {
  const { bundleId: _bundleId, contentSha256: _contentSha256, ...payload } = value;
  const contentSha256 = createHash('sha256').update(canonicalJson(payload)).digest('hex');
  return canonicalJson({ ...payload, bundleId: `sha256:${contentSha256}`, contentSha256 });
}

function fetcherWith(overrides: Readonly<Record<string, string | null>> = {}): C120BrowserBundleFetcher {
  const prefix = `${C120_BUNDLED_PROVIDER_ROOT}/${SNAPSHOT}/`;
  const bodies: Record<string, string> = {
    [C120_BUNDLED_MANIFEST_FILE]: manifestText,
    'c120-materialized-scenario.json': scenarioText,
    'oneweb-0314-current.tle': tleText,
  };
  return async url => {
    const name = url.startsWith(prefix) ? url.slice(prefix.length) : '';
    const override = overrides[name];
    const body = override === undefined ? bodies[name] : override;
    return body === undefined || body === null
      ? { status: 404, text: async () => 'not found' }
      : { status: 200, text: async () => body };
  };
}

const provider = await loadC120BundledProvider(SNAPSHOT, fetcherWith());
const scenario = provider.getScenario();
assert.equal(provider.kind, 'canonical-adapter');
assert.equal(provider.providerId, 'c120-canonical-adapter-e15d090b36f80995b9fc0f3d8d284563102c56e961cbf43feb3628e157462c3a');
assert.equal(scenario.manifest.scenario.scenarioId, 'c120-ntpu-energy-decision-01');
assert.equal(scenario.manifest.scenario.targetUtc, '2026-08-10T06:10:42.000Z');
assert.match(scenario.manifest.scenario.fixtureVersion, /^c120-materialized-canonical-adapter-v2-/);
assert.notDeepEqual(
  scenario.labA.replays[0]?.frames[0]?.scene.satellitePosition,
  scenario.labA.replays[0]?.frames[1]?.scene.satellitePosition,
);
assert.equal(scenario.tle.recordSha256, '0c2bd04e980a99b25819a0f41120fbf4a10ec9cb1afbd938f93a2942c782ea29');
assert.equal(scenario.tle.downloadPath, `${C120_BUNDLED_PROVIDER_ROOT}/${SNAPSHOT}/oneweb-0314-current.tle`);
assert.equal(scenario.manifest.claimBoundary, 'SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED');

let fetchCalls = 0;
await assert.rejects(
  () => loadC120BundledProvider('../fixture', async () => {
    fetchCalls += 1;
    return { status: 200, text: async () => manifestText };
  }),
  /snapshot query/,
);
assert.equal(fetchCalls, 0);

await assert.rejects(
  () => loadC120BundledProvider(SNAPSHOT, fetcherWith({ 'c120-materialized-scenario.json': null })),
  /HTTP 404/,
);
await assert.rejects(
  () => loadC120BundledProvider(SNAPSHOT, fetcherWith({ 'oneweb-0314-current.tle': tleText.replace('ONEWEB-0314', 'ONEWEB-0315') })),
  /byte receipt mismatch/,
);

const manifest = JSON.parse(manifestText) as Record<string, unknown>;
const upgradedManifest = readdress({
  ...manifest,
  truth: { ...(manifest.truth as Record<string, unknown>), measured: true },
});
await assert.rejects(
  () => loadC120BundledProvider(SNAPSHOT, fetcherWith({ [C120_BUNDLED_MANIFEST_FILE]: upgradedManifest })),
  /truth boundary/,
);
const unknownManifest = readdress({ ...manifest, live: true });
await assert.rejects(
  () => loadC120BundledProvider(SNAPSHOT, fetcherWith({ [C120_BUNDLED_MANIFEST_FILE]: unknownManifest })),
  /unknown or missing/,
);

const loaderSource = await readFile(resolve(here, 'bundledProvider.ts'), 'utf8');
assert.doesNotMatch(loaderSource, /\/backend\//);
assert.doesNotMatch(loaderSource, /satellite\.js|angle_aware_ee|power\s*\*|energy\s*=/i);

console.log('C-120 bundled browser provider tests passed');
