import {
  C120ContractError,
  type C120CourseDataProvider,
  type C120Scenario,
} from './contract';
import {
  C120_SCENARIO_ID,
  createC120ProviderFromScenario,
} from './fixtures';
import { validateC120PinnedTleImport } from './tleImport';

export const C120_BUNDLED_PROVIDER_ROOT = '/course/c120/real-data' as const;
export const C120_BUNDLED_MANIFEST_FILE = 'c120-class-bundle-manifest.json' as const;
export const C120_BUNDLED_MANIFEST_VERSION = 'c120-class-bundle-manifest-v1' as const;

const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_SCENARIO_BYTES = 512 * 1024;
const MAX_TLE_BYTES = 16 * 1024;

export interface C120BrowserBundleFetchResponse {
  readonly status: number;
  text(): Promise<string>;
}

export type C120BrowserBundleFetcher = (
  url: string,
) => Promise<C120BrowserBundleFetchResponse>;

interface PlainRecord {
  readonly [key: string]: unknown;
}

function fail(message: string): never {
  throw new C120ContractError(`bundled provider: ${message}`);
}

function record(value: unknown, label: string): PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(`${label} must be an object`);
  }
  return value as PlainRecord;
}

function exactKeys(value: PlainRecord, expected: readonly string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    return fail(`${label} has unknown or missing fields`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') return fail(`${label} must be non-empty text`);
  return value;
}

function sha(value: unknown, label: string): string {
  const checked = text(value, label);
  if (!/^[0-9a-f]{64}$/.test(checked)) return fail(`${label} must be lowercase SHA-256`);
  return checked;
}

function utc(value: unknown, label: string): string {
  const checked = text(value, label);
  if (!checked.endsWith('Z') || !Number.isFinite(Date.parse(checked))) return fail(`${label} must be UTC`);
  return checked;
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fail('manifest has non-finite numeric data');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  const candidate = record(value, 'manifest value');
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(candidate).sort()) {
    if (candidate[key] !== undefined) output[key] = canonicalize(candidate[key]);
  }
  return output;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

async function sha256Utf8(value: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
    return fail('Web Crypto SHA-256 is unavailable');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchBoundedText(
  url: string,
  maximumBytes: number,
  fetcher: C120BrowserBundleFetcher,
): Promise<string> {
  let response: C120BrowserBundleFetchResponse;
  try { response = await fetcher(url); } catch (error) {
    return fail(`fetch failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
    return fail(`HTTP ${response.status} for ${url}`);
  }
  const body = await response.text();
  const bytes = new TextEncoder().encode(body).byteLength;
  if (bytes <= 0 || bytes > maximumBytes) return fail(`${url} is empty or exceeds ${maximumBytes} bytes`);
  return body;
}

function safeSnapshotId(value: string): string {
  if (!/^[0-9a-f]{64}$/.test(value)) return fail('snapshot query must be one lowercase SHA-256');
  return value;
}

function fileEntry(files: PlainRecord, key: 'omm' | 'tle' | 'snapshot' | 'scenario'): {
  readonly name: string;
  readonly sha256: string;
  readonly bytes: number;
} {
  const entry = record(files[key], `manifest files.${key}`);
  exactKeys(entry, ['name', 'sha256', 'bytes'], `manifest files.${key}`);
  const name = text(entry.name, `manifest files.${key}.name`);
  if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    return fail(`manifest files.${key}.name is unsafe`);
  }
  const bytes = entry.bytes;
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) {
    return fail(`manifest files.${key}.bytes is invalid`);
  }
  return { name, sha256: sha(entry.sha256, `manifest files.${key}.sha256`), bytes };
}

interface ValidatedManifest {
  readonly providerId: string;
  readonly scenarioId: string;
  readonly snapshotId: string;
  readonly scenarioTargetUtc: string;
  readonly source: {
    readonly tleEpochUtc: string;
    readonly tleRawSha256: string;
  };
  readonly files: {
    readonly tle: ReturnType<typeof fileEntry>;
    readonly scenario: ReturnType<typeof fileEntry>;
  };
}

async function validateManifest(value: unknown, requestedSnapshot: string): Promise<ValidatedManifest> {
  const manifest = record(value, 'manifest');
  exactKeys(manifest, [
    'schemaVersion', 'bundleId', 'contentSha256', 'scenarioId', 'providerId', 'artifactId',
    'snapshotId', 'generatedAt', 'retrievedAt', 'scenarioTargetUtc', 'source', 'files', 'truth',
  ], 'manifest');
  if (manifest.schemaVersion !== C120_BUNDLED_MANIFEST_VERSION
    || manifest.scenarioId !== C120_SCENARIO_ID) return fail('manifest course/scenario identity mismatch');
  const contentSha256 = sha(manifest.contentSha256, 'manifest contentSha256');
  if (manifest.bundleId !== `sha256:${contentSha256}`
    || manifest.snapshotId !== `sha256:${requestedSnapshot}`
    || typeof manifest.artifactId !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(manifest.artifactId)) {
    return fail('manifest content/snapshot address mismatch');
  }
  const { bundleId: _bundleId, contentSha256: _contentSha256, ...payload } = manifest;
  if (await sha256Utf8(canonicalJson(payload)) !== contentSha256) return fail('manifest content hash mismatch');
  const providerId = text(manifest.providerId, 'manifest providerId');
  if (!/^c120-canonical-adapter-[0-9a-f]{64}$/.test(providerId)) return fail('manifest providerId is invalid');
  const generatedAt = utc(manifest.generatedAt, 'manifest generatedAt');
  const retrievedAt = utc(manifest.retrievedAt, 'manifest retrievedAt');
  if (Date.parse(generatedAt) < Date.parse(retrievedAt)) return fail('manifest generatedAt predates retrieval');
  const scenarioTargetUtc = utc(manifest.scenarioTargetUtc, 'manifest scenarioTargetUtc');

  const source = record(manifest.source, 'manifest source');
  exactKeys(source, [
    'objectName', 'catalogId', 'ommEpochUtc', 'tleEpochUtc', 'epochDeltaMs',
    'ommRawSha256', 'tleRawSha256',
  ], 'manifest source');
  if (source.objectName !== 'ONEWEB-0314' || source.catalogId !== 49100
    || typeof source.epochDeltaMs !== 'number' || !Number.isFinite(source.epochDeltaMs)
    || source.epochDeltaMs < 0 || source.epochDeltaMs > 2_000) {
    return fail('manifest source identity/epoch mismatch');
  }
  utc(source.ommEpochUtc, 'manifest OMM epoch');
  const tleEpochUtc = utc(source.tleEpochUtc, 'manifest TLE epoch');
  const ommRawSha256 = sha(source.ommRawSha256, 'manifest OMM SHA-256');
  const tleRawSha256 = sha(source.tleRawSha256, 'manifest TLE SHA-256');

  const files = record(manifest.files, 'manifest files');
  exactKeys(files, ['omm', 'tle', 'snapshot', 'scenario'], 'manifest files');
  const omm = fileEntry(files, 'omm');
  const tle = fileEntry(files, 'tle');
  const snapshot = fileEntry(files, 'snapshot');
  const scenario = fileEntry(files, 'scenario');
  if (omm.name !== 'oneweb-0314-current.json' || omm.sha256 !== ommRawSha256
    || tle.name !== 'oneweb-0314-current.tle' || tle.sha256 !== tleRawSha256
    || snapshot.name !== 'c120-class-snapshot.json'
    || scenario.name !== 'c120-materialized-scenario.json') {
    return fail('manifest file/source binding mismatch');
  }
  const truth = record(manifest.truth, 'manifest truth');
  exactKeys(truth, [
    'measured', 'wholeSatelliteCanonical', 'energyScope', 'browserScientificFormula',
  ], 'manifest truth');
  if (truth.measured !== false || truth.wholeSatelliteCanonical !== false
    || truth.energyScope !== 'GOLDEN_VECTOR_PARITY_ONLY'
    || truth.browserScientificFormula !== false) {
    return fail('manifest truth boundary mismatch');
  }
  return {
    providerId,
    scenarioId: C120_SCENARIO_ID,
    snapshotId: `sha256:${requestedSnapshot}`,
    scenarioTargetUtc,
    source: { tleEpochUtc, tleRawSha256 },
    files: { tle, scenario },
  };
}

/**
 * Load one explicit, content-addressed pre-class bundle. There is deliberately
 * no fallback here: a requested source snapshot either verifies or is rejected.
 */
export async function loadC120BundledProvider(
  snapshotId: string,
  fetcher: C120BrowserBundleFetcher = url => fetch(url),
): Promise<C120CourseDataProvider> {
  const snapshot = safeSnapshotId(snapshotId);
  const root = `${C120_BUNDLED_PROVIDER_ROOT}/${snapshot}`;
  const manifestText = await fetchBoundedText(`${root}/${C120_BUNDLED_MANIFEST_FILE}`, MAX_MANIFEST_BYTES, fetcher);
  let parsedManifest: unknown;
  try { parsedManifest = JSON.parse(manifestText); } catch { return fail('manifest is invalid JSON'); }
  const manifest = await validateManifest(parsedManifest, snapshot);
  const [scenarioText, tleText] = await Promise.all([
    fetchBoundedText(`${root}/${manifest.files.scenario.name}`, MAX_SCENARIO_BYTES, fetcher),
    fetchBoundedText(`${root}/${manifest.files.tle.name}`, MAX_TLE_BYTES, fetcher),
  ]);
  if (new TextEncoder().encode(scenarioText).byteLength !== manifest.files.scenario.bytes
    || await sha256Utf8(scenarioText) !== manifest.files.scenario.sha256
    || new TextEncoder().encode(tleText).byteLength !== manifest.files.tle.bytes
    || await sha256Utf8(tleText) !== manifest.files.tle.sha256) {
    return fail('bundled scenario/TLE byte receipt mismatch');
  }
  let scenarioValue: unknown;
  try { scenarioValue = JSON.parse(scenarioText); } catch { return fail('bundled scenario is invalid JSON'); }
  const provider = createC120ProviderFromScenario(
    'canonical-adapter',
    manifest.providerId,
    scenarioValue as C120Scenario,
  );
  const scenario = provider.getScenario();
  if (scenario.manifest.scenario.scenarioId !== manifest.scenarioId
    || scenario.manifest.scenario.targetUtc !== manifest.scenarioTargetUtc
    || scenario.tle.sourceEpochUtc !== manifest.source.tleEpochUtc
    || scenario.tle.recordSha256 !== manifest.source.tleRawSha256
    || scenario.tle.downloadPath !== `${root}/${manifest.files.tle.name}`) {
    return fail('bundled scenario does not bind to manifest/source path');
  }
  validateC120PinnedTleImport(tleText, manifest.files.tle.name, scenario.tle);
  return provider;
}
