import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  parse as parsePath,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  C120_DEFAULT_ORBIT_MAX_RESPONSE_BYTES,
  C120_MAX_TLE_RESPONSE_BYTES,
  createC120BundledFallbackReceipt,
  createC120CanonicalRuntimeAdapter,
  createC120RealDataArtifact,
  fetchC120CurrentTle,
  materializeC120CanonicalScenario,
  materializeC120ClassSnapshot,
  reopenC120ClassSnapshot,
  serializeC120ClassSnapshot,
  type C120CanonicalRuntimeAdapter,
  type C120OrbitPropagationRequest,
} from '../src/course/c120/backend/index';
import {
  C120_FIXTURE_ID,
  C120_FIXTURE_SCENARIO,
  C120_FIXTURE_VERSION,
  createC120ProviderFromScenario,
} from '../src/course/c120/fixtures';
import { validateC120PinnedTleImport } from '../src/course/c120/tleImport';

export const C120_CLASS_BUNDLE_MANIFEST_VERSION = 'c120-class-bundle-manifest-v1' as const;
export const C120_CLASS_BUNDLE_PROVIDER_ID = 'c120-real-data-backend-v2' as const;

const SNAPSHOT_FILE = 'c120-class-snapshot.json';
const SCENARIO_FILE = 'c120-materialized-scenario.json';
const MANIFEST_FILE = 'c120-class-bundle-manifest.json';
const OMM_FILE = 'oneweb-0314-current.json';
const MAX_MANIFEST_BYTES = 64 * 1024;

export interface C120ClassBundleRequest {
  readonly outDir: string;
  readonly ommFile: string;
  readonly tleFile: string;
  readonly retrievedAt: string;
  readonly generatedAt?: string;
  readonly lastRetrievedAt?: string;
  readonly previousManifest?: string;
  readonly downloadPath: string;
  readonly propagation?: C120OrbitPropagationRequest;
}

export interface C120ClassBundleDependencies {
  readonly canonical?: C120CanonicalRuntimeAdapter;
}

export interface C120ClassBundleManifest {
  readonly schemaVersion: typeof C120_CLASS_BUNDLE_MANIFEST_VERSION;
  readonly bundleId: string;
  readonly contentSha256: string;
  readonly scenarioId: string;
  readonly providerId: string;
  readonly artifactId: string;
  readonly snapshotId: string;
  readonly generatedAt: string;
  readonly retrievedAt: string;
  readonly scenarioTargetUtc: string;
  readonly source: Readonly<{
    readonly objectName: 'ONEWEB-0314';
    readonly catalogId: 49100;
    readonly ommEpochUtc: string;
    readonly tleEpochUtc: string;
    readonly epochDeltaMs: number;
    readonly ommRawSha256: string;
    readonly tleRawSha256: string;
  }>;
  readonly files: Readonly<Record<'omm' | 'tle' | 'snapshot' | 'scenario', Readonly<{
    readonly name: string;
    readonly sha256: string;
    readonly bytes: number;
  }>>>;
  readonly truth: Readonly<{
    readonly measured: false;
    readonly wholeSatelliteCanonical: false;
    readonly energyScope: 'GOLDEN_VECTOR_PARITY_ONLY';
    readonly browserScientificFormula: false;
  }>;
}

function fail(message: string): never {
  throw new Error(`C-120 class materializer: ${message}`);
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fail('cannot serialize non-finite numeric data');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === undefined) return fail('cannot serialize unsupported data');
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== undefined) output[key] = canonicalize(child);
  }
  return output;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    return fail(`${label} has unknown or missing fields`);
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function utc(value: string, label: string): string {
  if (typeof value !== 'string' || !value.endsWith('Z') || !Number.isFinite(Date.parse(value))) {
    return fail(`${label} must be parseable UTC ending in Z`);
  }
  return new Date(Date.parse(value)).toISOString();
}

function safeOutDir(value: string): string {
  if (typeof value !== 'string' || value.trim() === '' || !isAbsolute(value)) {
    return fail('--out-dir must be an explicit absolute path');
  }
  if (value.split(/[\\/]+/).includes('..')) return fail('--out-dir must not contain ..');
  const output = resolve(value);
  const root = parsePath(output).root;
  const forbidden = [root, resolve(homedir()), resolve(process.cwd())];
  if (forbidden.includes(output) || output.length <= root.length + 1) {
    return fail('--out-dir is a protected broad path');
  }
  return output;
}

function safeDownloadPath(value: string): string {
  if (typeof value !== 'string' || !value.startsWith('/course/c120/')
    || value.includes('..') || /[\r\n?#]/.test(value)) {
    return fail('--download-path must be a safe /course/c120 file path');
  }
  const name = basename(value);
  if (!name.endsWith('.tle') || name === '.tle') return fail('--download-path must name a .tle file');
  return value;
}

function bindDownloadPathToSnapshot(value: string, snapshotId: string): string {
  const address = snapshotId.startsWith('sha256:') ? snapshotId.slice('sha256:'.length) : '';
  if (!/^[0-9a-f]{64}$/.test(address)) return fail('snapshotId is not a SHA-256 content address');
  const name = basename(value);
  const generic = `/course/c120/real-data/${name}`;
  const exact = `/course/c120/real-data/${address}/${name}`;
  if (value !== generic && value !== exact) {
    return fail('--download-path must be the generic real-data TLE path or the exact current snapshot path');
  }
  return exact;
}

async function readBoundedUtf8(path: string, maximumBytes: number, label: string): Promise<string> {
  const resolved = resolve(path);
  const metadata = await stat(resolved).catch(() => fail(`${label} is unavailable`));
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maximumBytes) {
    return fail(`${label} must be a non-empty regular file <= ${maximumBytes} bytes`);
  }
  const bytes = await readFile(resolved);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return fail(`${label} must be valid UTF-8`);
  }
}

async function priorRetrievedAt(request: C120ClassBundleRequest): Promise<string | undefined> {
  if (request.previousManifest === undefined) return request.lastRetrievedAt;
  const text = await readBoundedUtf8(request.previousManifest, MAX_MANIFEST_BYTES, 'previous manifest');
  const candidate = reopenC120ClassBundleManifest(text);
  const previous = utc(candidate.retrievedAt, 'previous manifest retrievedAt');
  if (request.lastRetrievedAt !== undefined
    && utc(request.lastRetrievedAt, 'lastRetrievedAt') !== previous) {
    return fail('lastRetrievedAt contradicts previous manifest');
  }
  return previous;
}

export function verifyC120ClassBundleManifest(
  value: unknown,
): asserts value is C120ClassBundleManifest {
  const manifest = record(value, 'bundle manifest');
  exactKeys(manifest, [
    'schemaVersion', 'bundleId', 'contentSha256', 'scenarioId', 'providerId', 'artifactId',
    'snapshotId', 'generatedAt', 'retrievedAt', 'scenarioTargetUtc', 'source', 'files', 'truth',
  ], 'bundle manifest');
  if (manifest.schemaVersion !== C120_CLASS_BUNDLE_MANIFEST_VERSION
    || manifest.scenarioId !== C120_FIXTURE_SCENARIO.manifest.scenario.scenarioId
    || typeof manifest.providerId !== 'string'
    || !/^c120-canonical-adapter-[0-9a-f]{64}$/.test(manifest.providerId)) {
    return fail('bundle manifest identity is invalid');
  }
  if (!isSha256(manifest.contentSha256)
    || manifest.bundleId !== `sha256:${manifest.contentSha256}`
    || typeof manifest.artifactId !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(manifest.artifactId)
    || typeof manifest.snapshotId !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(manifest.snapshotId)) {
    return fail('bundle manifest content address is invalid');
  }
  const { bundleId: _bundleId, contentSha256: _contentSha256, ...payload } = manifest;
  if (sha256(canonicalJson(payload)) !== manifest.contentSha256) {
    return fail('bundle manifest content hash mismatch');
  }
  const generatedAt = utc(String(manifest.generatedAt), 'manifest generatedAt');
  const retrievedAt = utc(String(manifest.retrievedAt), 'manifest retrievedAt');
  utc(String(manifest.scenarioTargetUtc), 'manifest scenarioTargetUtc');
  if (Date.parse(generatedAt) < Date.parse(retrievedAt)) return fail('manifest generatedAt predates retrievedAt');

  const source = record(manifest.source, 'manifest source');
  exactKeys(source, [
    'objectName', 'catalogId', 'ommEpochUtc', 'tleEpochUtc', 'epochDeltaMs',
    'ommRawSha256', 'tleRawSha256',
  ], 'manifest source');
  if (source.objectName !== 'ONEWEB-0314' || source.catalogId !== 49100
    || typeof source.epochDeltaMs !== 'number' || !Number.isFinite(source.epochDeltaMs)
    || source.epochDeltaMs < 0 || source.epochDeltaMs > 2_000
    || !isSha256(source.ommRawSha256) || !isSha256(source.tleRawSha256)) {
    return fail('manifest source identity is invalid');
  }
  utc(String(source.ommEpochUtc), 'manifest OMM epoch');
  utc(String(source.tleEpochUtc), 'manifest TLE epoch');

  const files = record(manifest.files, 'manifest files');
  exactKeys(files, ['omm', 'tle', 'snapshot', 'scenario'], 'manifest files');
  const expectedNames: Readonly<Record<string, string | undefined>> = {
    omm: OMM_FILE,
    tle: undefined,
    snapshot: SNAPSHOT_FILE,
    scenario: SCENARIO_FILE,
  };
  for (const key of ['omm', 'tle', 'snapshot', 'scenario'] as const) {
    const entry = record(files[key], `manifest files.${key}`);
    exactKeys(entry, ['name', 'sha256', 'bytes'], `manifest files.${key}`);
    if (typeof entry.name !== 'string' || basename(entry.name) !== entry.name
      || (expectedNames[key] !== undefined && entry.name !== expectedNames[key])
      || (key === 'tle' && !entry.name.endsWith('.tle'))
      || !isSha256(entry.sha256)
      || typeof entry.bytes !== 'number' || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0) {
      return fail(`manifest files.${key} is invalid`);
    }
  }
  const omm = record(files.omm, 'manifest files.omm');
  const tle = record(files.tle, 'manifest files.tle');
  if (omm.sha256 !== source.ommRawSha256 || tle.sha256 !== source.tleRawSha256) {
    return fail('manifest source/file hashes disagree');
  }

  const truth = record(manifest.truth, 'manifest truth');
  exactKeys(truth, [
    'measured', 'wholeSatelliteCanonical', 'energyScope', 'browserScientificFormula',
  ], 'manifest truth');
  if (truth.measured !== false || truth.wholeSatelliteCanonical !== false
    || truth.energyScope !== 'GOLDEN_VECTOR_PARITY_ONLY'
    || truth.browserScientificFormula !== false) {
    return fail('manifest truth boundary is invalid');
  }
}

export function reopenC120ClassBundleManifest(serialized: string): C120ClassBundleManifest {
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { return fail('bundle manifest is invalid JSON'); }
  verifyC120ClassBundleManifest(parsed);
  return parsed;
}

function defaultPropagation(retrievedAt: string): C120OrbitPropagationRequest {
  return {
    observer: { latitudeDeg: 24.944, longitudeDeg: 121.371, heightKm: 0.05 },
    startUtc: retrievedAt,
    endUtc: new Date(Date.parse(retrievedAt) + 24 * 60 * 60 * 1_000).toISOString(),
    sampleStepSec: 10,
    minimumElevationDeg: 10,
  };
}

async function pathExists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function publishAtomically(
  outDir: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  if (await pathExists(outDir)) return fail(`output already exists: ${outDir}`);
  const parent = dirname(outDir);
  await mkdir(parent, { recursive: true });
  const temp = `${outDir}.tmp-${randomUUID()}`;
  await mkdir(temp, { recursive: false });
  try {
    for (const [name, contents] of Object.entries(files)) {
      if (basename(name) !== name || name.includes(sep)) return fail(`unsafe output filename ${name}`);
      await writeFile(resolve(temp, name), contents, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
    }
    await rename(temp, outDir);
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}

export async function materializeC120ClassBundle(
  request: C120ClassBundleRequest,
  dependencies: C120ClassBundleDependencies = {},
): Promise<C120ClassBundleManifest> {
  const outDir = safeOutDir(request.outDir);
  if (await pathExists(outDir)) return fail(`output already exists: ${outDir}`);
  const requestedDownloadPath = safeDownloadPath(request.downloadPath);
  const retrievedAt = utc(request.retrievedAt, 'retrievedAt');
  const generatedAt = utc(
    request.generatedAt ?? new Date(Date.parse(retrievedAt) + 1_000).toISOString(),
    'generatedAt',
  );
  if (Date.parse(generatedAt) < Date.parse(retrievedAt)) return fail('generatedAt predates retrievedAt');
  const lastRetrievedAt = await priorRetrievedAt(request);
  const [ommBody, tleBody] = await Promise.all([
    readBoundedUtf8(request.ommFile, C120_DEFAULT_ORBIT_MAX_RESPONSE_BYTES, 'OMM file'),
    readBoundedUtf8(request.tleFile, C120_MAX_TLE_RESPONSE_BYTES, 'TLE file'),
  ]);
  const scenarioId = C120_FIXTURE_SCENARIO.manifest.scenario.scenarioId;
  const artifact = await createC120RealDataArtifact({
    providerId: C120_CLASS_BUNDLE_PROVIDER_ID,
    scenarioId,
    orbit: { retrievedAt, lastRetrievedAt, now: generatedAt },
    propagation: request.propagation ?? defaultPropagation(retrievedAt),
  }, {
    fetchOrbit: async () => ({ status: 200, body: ommBody }),
    canonical: dependencies.canonical ?? createC120CanonicalRuntimeAdapter(),
  });
  const currentTle = await fetchC120CurrentTle(artifact.source, {
    retrievedAt,
    lastRetrievedAt,
    now: generatedAt,
  }, async () => ({ status: 200, body: tleBody }));
  const fallbackBytes = canonicalJson(C120_FIXTURE_SCENARIO);
  const fallbackSha256 = sha256(fallbackBytes);
  const fallbackReceipt = createC120BundledFallbackReceipt(artifact, {
    bundleId: C120_FIXTURE_ID,
    bundleVersion: C120_FIXTURE_VERSION,
    bundleContentSha256: fallbackSha256,
    fallbackArtifactId: `sha256:${fallbackSha256}`,
    fallbackArtifactContentSha256: fallbackSha256,
  });
  const snapshot = materializeC120ClassSnapshot({ artifact, generatedAt, fallbackReceipt });
  const downloadPath = bindDownloadPathToSnapshot(requestedDownloadPath, snapshot.snapshotId);
  const snapshotJson = serializeC120ClassSnapshot(snapshot);
  const reopened = reopenC120ClassSnapshot(snapshotJson);
  if (reopened.snapshotId !== snapshot.snapshotId) return fail('snapshot reopen identity mismatch');
  const scenario = materializeC120CanonicalScenario({
    snapshot,
    currentTle,
    donor: C120_FIXTURE_SCENARIO,
    downloadPath,
  });
  const provider = createC120ProviderFromScenario('canonical-adapter', scenario.manifest.providerId, scenario);
  const importReceipt = validateC120PinnedTleImport(tleBody, basename(downloadPath), scenario.tle);
  if (importReceipt.recordSha256 !== currentTle.rawContentSha256
    || provider.getScenario().manifest.scenario.scenarioId !== scenarioId) {
    return fail('provider or TLE import identity mismatch');
  }

  // The frozen browser contract compares tuple-like object fields in their
  // declared insertion order. Preserve the already-validated scenario's JSON
  // order so a parse/reopen remains accepted by the same provider validator.
  const scenarioJson = JSON.stringify(scenario);
  const tleName = basename(downloadPath);
  const filePayloads = {
    [OMM_FILE]: ommBody,
    [tleName]: tleBody,
    [SNAPSHOT_FILE]: snapshotJson,
    [SCENARIO_FILE]: scenarioJson,
  } as const;
  const fileReceipt = (name: string, contents: string) => ({
    name,
    sha256: sha256(contents),
    bytes: new TextEncoder().encode(contents).byteLength,
  });
  const manifestPayload = {
    schemaVersion: C120_CLASS_BUNDLE_MANIFEST_VERSION,
    scenarioId,
    providerId: provider.providerId,
    artifactId: artifact.artifactId,
    snapshotId: snapshot.snapshotId,
    generatedAt,
    retrievedAt,
    scenarioTargetUtc: scenario.manifest.scenario.targetUtc,
    source: {
      objectName: 'ONEWEB-0314' as const,
      catalogId: 49100 as const,
      ommEpochUtc: artifact.source.sourceEpoch,
      tleEpochUtc: currentTle.epochUtc,
      epochDeltaMs: currentTle.matchedOmm.epochDeltaMs,
      ommRawSha256: artifact.source.rawContentSha256,
      tleRawSha256: currentTle.rawContentSha256,
    },
    files: {
      omm: fileReceipt(OMM_FILE, ommBody),
      tle: fileReceipt(tleName, tleBody),
      snapshot: fileReceipt(SNAPSHOT_FILE, snapshotJson),
      scenario: fileReceipt(SCENARIO_FILE, scenarioJson),
    },
    truth: {
      measured: false as const,
      wholeSatelliteCanonical: false as const,
      energyScope: 'GOLDEN_VECTOR_PARITY_ONLY' as const,
      browserScientificFormula: false as const,
    },
  };
  const contentSha256 = sha256(canonicalJson(manifestPayload));
  const manifest: C120ClassBundleManifest = {
    ...manifestPayload,
    bundleId: `sha256:${contentSha256}`,
    contentSha256,
  };
  verifyC120ClassBundleManifest(manifest);
  const manifestJson = canonicalJson(manifest);
  if (reopenC120ClassBundleManifest(manifestJson).bundleId !== manifest.bundleId) {
    return fail('bundle manifest reopen identity mismatch');
  }
  await publishAtomically(outDir, { ...filePayloads, [MANIFEST_FILE]: manifestJson });
  return manifest;
}

interface ParsedArgs {
  readonly [key: string]: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      return fail('arguments must be --name value pairs');
    }
    if (result[key] !== undefined) return fail(`duplicate argument ${key}`);
    result[key] = value;
  }
  const allowed = new Set([
    '--out-dir', '--omm-file', '--tle-file', '--retrieved-at', '--generated-at',
    '--last-retrieved-at', '--previous-manifest', '--download-path',
  ]);
  for (const key of Object.keys(result)) if (!allowed.has(key)) return fail(`unknown argument ${key}`);
  for (const key of ['--out-dir', '--omm-file', '--tle-file', '--retrieved-at', '--download-path']) {
    if (result[key] === undefined) return fail(`missing required ${key}`);
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await materializeC120ClassBundle({
    outDir: args['--out-dir']!,
    ommFile: args['--omm-file']!,
    tleFile: args['--tle-file']!,
    retrievedAt: args['--retrieved-at']!,
    generatedAt: args['--generated-at'],
    lastRetrievedAt: args['--last-retrieved-at'],
    previousManifest: args['--previous-manifest'],
    downloadPath: args['--download-path']!,
  });
  process.stdout.write(`${canonicalJson(manifest)}\n`);
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  void main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export const C120_CLASS_BUNDLE_FILENAMES = Object.freeze({
  manifest: MANIFEST_FILE,
  omm: OMM_FILE,
  scenario: SCENARIO_FILE,
  snapshot: SNAPSHOT_FILE,
});

// Referenced by tests and operator diagnostics without exporting a local path.
export const C120_CLASS_MATERIALIZER_SOURCE = fileURLToPath(import.meta.url);
