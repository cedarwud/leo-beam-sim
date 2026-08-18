#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { NTPU_TLE_OBSERVER } from '../src/simulator/observer';
import {
  DEFAULT_TLE_ANALYSIS_PASS_POLICY,
  buildTleAnalysisRun,
} from '../src/simulator/tleAnalysisRun';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CONTRACT_VERSION,
  type LoadedTleSnapshotSelection,
  type SimulatorConstellation,
} from '../src/simulator/types';
import {
  DEFAULT_CANONICAL_TLE_HANDOVER_POLICY,
} from '../src/simulator/canonicalTleHandover';
import {
  TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS,
  TLE_RUN_ANCHOR_COUNT,
  buildTleRunBundle,
  type TleRunPropagationMode,
} from '../src/tle/run';
import {
  TLE_EVENT_ATLAS_EXACT_SGP4_REVISION,
  TLE_EVENT_ATLAS_RESOLVER_REVISION,
  TLE_EVENT_ATLAS_SCHEMA_VERSION,
  TLE_EVENT_ATLAS_VISIBILITY_REVISION,
  TLE_EVENT_ATLAS_WINDOW_SCHEMA_VERSION,
  aggregateTleEventAtlas,
  buildTleEventAtlasWindowReceipt,
  type CanonicalTleEventAtlas,
  type TleEventAtlasEvidenceClass,
  type TleEventAtlasRejectedWindowReceipt,
  type TleEventAtlasSearchRange,
  type TleEventAtlasSourceReceipt,
  type TleEventAtlasWindowReceipt,
} from '../src/tle/eventAtlas';
import {
  prepareTleEventAtlasArchive,
} from './lib/tle-event-atlas-archive';

interface CliOptions {
  readonly sourceRoot: string;
  readonly constellation: SimulatorConstellation;
  readonly cacheDir: string;
  readonly outputDir: string | null;
  readonly startUtc: string | null;
  readonly endUtcExclusive: string | null;
  readonly days: number | null;
  readonly propagationMode: TleRunPropagationMode;
  readonly windowStepSec: number;
  readonly shardCount: number;
  readonly shardIndex: number;
  readonly aggregateOnly: boolean;
  readonly prepareCatalogOnly: boolean;
  readonly rebuildCatalog: boolean;
  readonly resume: boolean;
}

function usage(): never {
  throw new Error([
    'Usage: npm run mine:tle:event-atlas --',
    '  --source-root /home/sat/satellite/tle_data',
    '  --constellation starlink|oneweb',
    '  --cache-dir /home/sat/tle-event-atlas-cache',
    '  --output-dir artifacts/tle-event-atlas/<run>',
    '  --start-utc 2026-08-10T00:00:00Z (--days 7 | --end-utc <UTC>)',
    '  [--propagation-mode full-reference|staged-coarse-to-fine]',
    '  [--shard-count 4 --shard-index 0]',
    '  [--aggregate-only] [--prepare-catalog-only] [--rebuild-catalog] [--no-resume]',
  ].join('\n'));
}

function valueAfter(argv: readonly string[], index: number, token: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${token} requires a value`);
  return value;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let sourceRoot: string | null = null;
  let constellation: SimulatorConstellation | null = null;
  let cacheDir: string | null = null;
  let outputDir: string | null = null;
  let startUtc: string | null = null;
  let endUtcExclusive: string | null = null;
  let days: number | null = null;
  let propagationMode: TleRunPropagationMode = 'full-reference';
  let windowStepSec = 1_800;
  let shardCount = 1;
  let shardIndex = 0;
  let aggregateOnly = false;
  let prepareCatalogOnly = false;
  let rebuildCatalog = false;
  let resume = true;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    const take = (): string => {
      const value = valueAfter(argv, index, token);
      index += 1;
      return value;
    };
    if (token === '--source-root') sourceRoot = take();
    else if (token === '--constellation') {
      const value = take();
      if (value !== 'starlink' && value !== 'oneweb') throw new Error('--constellation must be starlink or oneweb');
      constellation = value;
    } else if (token === '--cache-dir') cacheDir = take();
    else if (token === '--output-dir') outputDir = take();
    else if (token === '--start-utc') startUtc = take();
    else if (token === '--end-utc') endUtcExclusive = take();
    else if (token === '--days') {
      days = Number(take());
      if (!Number.isFinite(days) || days <= 0) throw new Error('--days must be positive');
    } else if (token === '--propagation-mode') {
      const value = take();
      if (value !== 'full-reference' && value !== 'staged-coarse-to-fine') {
        throw new Error('--propagation-mode must be full-reference or staged-coarse-to-fine');
      }
      propagationMode = value;
    } else if (token === '--window-step-min') {
      windowStepSec = parsePositiveInteger(take(), '--window-step-min') * 60;
    } else if (token === '--shard-count') shardCount = parsePositiveInteger(take(), '--shard-count');
    else if (token === '--shard-index') {
      shardIndex = Number(take());
      if (!Number.isSafeInteger(shardIndex) || shardIndex < 0) throw new Error('--shard-index must be a non-negative integer');
    } else if (token === '--aggregate-only') aggregateOnly = true;
    else if (token === '--prepare-catalog-only') prepareCatalogOnly = true;
    else if (token === '--rebuild-catalog') rebuildCatalog = true;
    else if (token === '--no-resume') resume = false;
    else if (token === '--help' || token === '-h') usage();
    else throw new Error(`unknown option ${token}`);
  }
  if (sourceRoot === null || constellation === null || cacheDir === null) usage();
  if (!prepareCatalogOnly && (outputDir === null || startUtc === null || (days === null && endUtcExclusive === null))) usage();
  if (days !== null && endUtcExclusive !== null) throw new Error('use either --days or --end-utc, not both');
  if (windowStepSec !== 1_800) throw new Error('the canonical Event Atlas search grid is fixed at 30 minutes');
  if (shardIndex >= shardCount) throw new Error('--shard-index must be smaller than --shard-count');
  if (aggregateOnly && shardCount !== 1) throw new Error('--aggregate-only reads all shards and must not declare shard options');
  return {
    sourceRoot: resolve(sourceRoot),
    constellation,
    cacheDir: resolve(cacheDir),
    outputDir: outputDir === null ? null : resolve(outputDir),
    startUtc,
    endUtcExclusive,
    days,
    propagationMode,
    windowStepSec,
    shardCount,
    shardIndex,
    aggregateOnly,
    prepareCatalogOnly,
    rebuildCatalog,
    resume,
  };
}

function normalizedUtc(value: string, label: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error(`${label} must include an explicit UTC offset`);
  return new Date(ms).toISOString();
}

function searchRange(options: CliOptions): TleEventAtlasSearchRange {
  if (options.startUtc === null) throw new Error('--start-utc is required');
  const startUtc = normalizedUtc(options.startUtc, '--start-utc');
  const startMs = Date.parse(startUtc);
  const endUtcExclusive = options.days === null
    ? normalizedUtc(options.endUtcExclusive!, '--end-utc')
    : new Date(startMs + options.days * 86_400_000).toISOString();
  const endMs = Date.parse(endUtcExclusive);
  if (endMs <= startMs || (endMs - startMs) % (options.windowStepSec * 1_000) !== 0) {
    throw new Error('search range must be positive and divisible by the 30-minute grid');
  }
  return Object.freeze({
    startUtc,
    endUtcExclusive,
    windowStepSec: options.windowStepSec,
    physicalDurationSec: (endMs - startMs) / 1_000,
  });
}

function windowInstants(search: TleEventAtlasSearchRange): readonly string[] {
  const startMs = Date.parse(search.startUtc);
  const count = search.physicalDurationSec / search.windowStepSec;
  return Object.freeze(Array.from(
    { length: count },
    (_unused, index) => new Date(startMs + index * search.windowStepSec * 1_000).toISOString(),
  ));
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableDigest(value: unknown): string {
  return sha256(JSON.stringify(value));
}

function snapshotDigest(selection: LoadedTleSnapshotSelection): string {
  return stableDigest(selection.manifest.entries.map(entry => [
    entry.satelliteId,
    entry.epochUtc,
    entry.sourcePath,
    entry.line1,
    entry.line2,
  ]));
}

async function atomicWrite(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, text, 'utf8');
  await rename(temporaryPath, path);
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function atomicWriteCompactJson(path: string, value: unknown): Promise<void> {
  await atomicWrite(path, `${JSON.stringify(value)}\n`);
}

function safeInstant(instantUtc: string): string {
  return instantUtc.replace(/[:.]/g, '-');
}

function windowCachePath(options: CliOptions, configDigest: string, instantUtc: string): string {
  return join(options.cacheDir, 'windows', options.constellation, configDigest, `${safeInstant(instantUtc)}.json`);
}

function parseCachedWindow(
  value: unknown,
  options: CliOptions,
  configDigest: string,
  instantUtc: string,
): TleEventAtlasWindowReceipt {
  if (value === null || typeof value !== 'object') throw new Error('cached Event Atlas window must be an object');
  const candidate = value as Partial<TleEventAtlasWindowReceipt>;
  if (
    candidate.schema !== TLE_EVENT_ATLAS_WINDOW_SCHEMA_VERSION
    || candidate.constellation !== options.constellation
    || candidate.requestedT0Utc !== instantUtc
    || candidate.configDigest !== configDigest
    || candidate.propagationMode !== options.propagationMode
    || (candidate.status !== 'accepted' && candidate.status !== 'rejected')
  ) throw new Error(`cached Event Atlas window identity mismatch for ${instantUtc}`);
  return candidate as TleEventAtlasWindowReceipt;
}

async function readWindowCache(
  options: CliOptions,
  configDigest: string,
  instantUtc: string,
): Promise<TleEventAtlasWindowReceipt | null> {
  try {
    const raw = JSON.parse(await readFile(windowCachePath(options, configDigest, instantUtc), 'utf8')) as unknown;
    return parseCachedWindow(raw, options, configDigest, instantUtc);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function rejectedWindow(
  options: CliOptions,
  configDigest: string,
  instantUtc: string,
  evidenceClass: TleEventAtlasEvidenceClass,
  error: unknown,
): TleEventAtlasRejectedWindowReceipt {
  const candidate = error as { readonly name?: unknown; readonly code?: unknown; readonly message?: unknown };
  return Object.freeze({
    schema: TLE_EVENT_ATLAS_WINDOW_SCHEMA_VERSION,
    status: 'rejected',
    constellation: options.constellation,
    requestedT0Utc: instantUtc,
    evidenceClass,
    propagationMode: options.propagationMode,
    configDigest,
    error: Object.freeze({
      name: typeof candidate?.name === 'string' ? candidate.name : 'Error',
      code: typeof candidate?.code === 'string' ? candidate.code : null,
      message: typeof candidate?.message === 'string' ? candidate.message : String(error),
    }),
  });
}

function formatMetric(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(digits);
}

function summaryMarkdown(atlas: CanonicalTleEventAtlas): string {
  const ranked = new Map(atlas.preferredEvents.map(event => [event.variantId, event]));
  const rows = atlas.rankedPreferredVariantIds.slice(0, 20).map((variantId, index) => {
    const event = ranked.get(variantId)!;
    return `| ${index + 1} | ${event.triggerInstantUtc} | ${event.sourceEvent} | ${event.fromSatelliteId} → ${event.toSatelliteId} | ${formatMetric(event.quality.minimumEventElevationDeg)} | ${formatMetric(event.quality.deltaSinrDynamicRangeDb)} | ${formatMetric(event.quality.candidateResidualVisibilitySec, 0)} |`;
  });
  const rate = atlas.summary.validInterHandoversPerPhysicalHour === null
    ? 'n/a (incomplete window coverage)'
    : formatMetric(atlas.summary.validInterHandoversPerPhysicalHour, 3);
  return `${[
    `# NTPU ${atlas.constellation} real-TLE Event Atlas`,
    '',
    `- Atlas ID: \`${atlas.atlasId}\``,
    `- Evidence: \`${atlas.evidenceClass}\` / \`${atlas.propagationMode}\``,
    `- Search: ${atlas.search.startUtc} to ${atlas.search.endUtcExclusive} (exclusive)`,
    `- Source archive digest: \`${atlas.sourceArchiveContentSha256}\``,
    `- Window coverage: ${atlas.summary.acceptedWindowCount}/${atlas.summary.expectedWindowCount} accepted; ${atlas.summary.rejectedWindowCount} rejected`,
    `- Population claims allowed: ${atlas.summary.populationClaimsAllowed ? 'yes' : 'no'}`,
    `- Valid Offset+TTT events: ${atlas.summary.validInterHandoverCount}`,
    `- Forced continuity events: ${atlas.summary.forcedContinuityCount}`,
    `- Valid events per physical hour: ${rate}`,
    `- Complete clips: ${atlas.summary.completeClipCount}`,
    `- Valid events at >=45/60/75 deg: ${atlas.summary.validAtLeast45DegCount}/${atlas.summary.validAtLeast60DegCount}/${atlas.summary.validAtLeast75DegCount}`,
    '',
    '## Ranked source-backed events',
    '',
    '| # | Decision UTC | Type | Satellite pair | Min elevation (deg) | Delta-SINR range (dB) | Candidate residual (s) |',
    '|---:|---|---|---|---:|---:|---:|',
    ...(rows.length === 0 ? ['| - | - | - | - | - | - | - |'] : rows),
    '',
    'Ranking is a presentation-only lexicographic order. Handover validity remains the canonical 3 dB offset and 30 s TTT trace.',
  ].join('\n')}\n`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const archive = await prepareTleEventAtlasArchive({
    sourceRoot: options.sourceRoot,
    constellation: options.constellation,
    cachePath: join(options.cacheDir, 'catalogs', `${options.constellation}.json`),
    rebuild: options.rebuildCatalog,
    onProgress: message => process.stdout.write(`${message}\n`),
  });
  process.stdout.write(`${JSON.stringify({
    phase: 'catalog-ready',
    constellation: options.constellation,
    snapshots: archive.catalog.snapshotCount,
    exclusions: archive.catalog.excludedSnapshots?.length ?? 0,
    archiveContentSha256: archive.catalog.archiveContentSha256,
  })}\n`);
  if (options.prepareCatalogOnly) return;

  const search = searchRange(options);
  const evidenceClass: TleEventAtlasEvidenceClass = options.propagationMode === 'full-reference'
    ? 'canonical-research'
    : 'provisional-candidate-pool';
  const canonicalParameterDigest = stableDigest(DEFAULT_SIMULATOR_PARAMETERS);
  const canonicalScenarioDigest = stableDigest({
    simulatorContractVersion: SIMULATOR_CONTRACT_VERSION,
    passPolicy: DEFAULT_TLE_ANALYSIS_PASS_POLICY,
    handoverPolicy: DEFAULT_CANONICAL_TLE_HANDOVER_POLICY,
  });
  const configDigest = stableDigest({
    eventAtlasSchema: TLE_EVENT_ATLAS_SCHEMA_VERSION,
    constellation: options.constellation,
    sourceArchiveContentSha256: archive.catalog.archiveContentSha256,
    evidenceClass,
    propagationMode: options.propagationMode,
    observer: NTPU_TLE_OBSERVER,
    resolverRevision: TLE_EVENT_ATLAS_RESOLVER_REVISION,
    visibilityRevision: TLE_EVENT_ATLAS_VISIBILITY_REVISION,
    exactSgp4Revision: TLE_EVENT_ATLAS_EXACT_SGP4_REVISION,
    canonicalParameterDigest,
    canonicalScenarioDigest,
  });
  const instants = windowInstants(search);
  const assignedInstants = instants.filter((_instant, index) => index % options.shardCount === options.shardIndex);

  if (!options.aggregateOnly) {
    for (let localIndex = 0; localIndex < assignedInstants.length; localIndex += 1) {
      const instantUtc = assignedInstants[localIndex]!;
      const cached = options.resume ? await readWindowCache(options, configDigest, instantUtc) : null;
      if (cached !== null) {
        process.stdout.write(`${JSON.stringify({ phase: 'window-cached', instantUtc, status: cached.status })}\n`);
        continue;
      }
      const startedAt = performance.now();
      let receipt: TleEventAtlasWindowReceipt;
      try {
        const selection = await archive.loadSelection(instantUtc);
        const resolvedSnapshotDigest = snapshotDigest(selection);
        const source: TleEventAtlasSourceReceipt = Object.freeze({
          archiveId: selection.catalog.archiveId,
          archiveDate: selection.snapshot.metadata.archiveDate,
          publicationPath: selection.snapshot.metadata.path,
          publicationSha256: selection.snapshot.sha256,
          publicationByteLength: selection.snapshot.byteLength,
          publicationRecordCount: selection.snapshot.metadata.recordCount,
          admittedRecordCount: selection.manifest.entries.length,
          resolvedSnapshotDigest,
        });
        const geometryRun = await buildTleRunBundle({
          selection,
          t0Utc: instantUtc,
          candidatePool: options.propagationMode === 'full-reference'
            ? { mode: 'full-reference' }
            : TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS,
          yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT,
        });
        const analysisRun = buildTleAnalysisRun({
          selection,
          geometryRun,
          parameters: DEFAULT_SIMULATOR_PARAMETERS,
        });
        receipt = buildTleEventAtlasWindowReceipt({
          constellation: options.constellation,
          selection,
          analysisRun,
          source,
          evidenceClass,
          propagationMode: options.propagationMode,
          configDigest,
          canonicalParameterDigest,
          canonicalScenarioDigest,
        });
      } catch (error) {
        receipt = rejectedWindow(options, configDigest, instantUtc, evidenceClass, error);
      }
      await atomicWriteJson(windowCachePath(options, configDigest, instantUtc), receipt);
      process.stdout.write(`${JSON.stringify({
        phase: 'window-complete',
        shard: `${options.shardIndex + 1}/${options.shardCount}`,
        completed: localIndex + 1,
        total: assignedInstants.length,
        instantUtc,
        status: receipt.status,
        events: receipt.status === 'accepted' ? receipt.events.length : 0,
        wallTimeMs: Math.round(performance.now() - startedAt),
        ...(receipt.status === 'rejected' ? { error: receipt.error.message } : {}),
      })}\n`);
    }
  }

  if (options.shardCount > 1) {
    process.stdout.write(`${JSON.stringify({
      phase: 'shard-complete',
      shardIndex: options.shardIndex,
      shardCount: options.shardCount,
      processedWindowCount: assignedInstants.length,
      configDigest,
    })}\n`);
    return;
  }

  const windows: TleEventAtlasWindowReceipt[] = [];
  for (const instantUtc of instants) {
    const cached = await readWindowCache(options, configDigest, instantUtc);
    if (cached === null) throw new Error(`cannot aggregate: missing cached window ${instantUtc}`);
    windows.push(cached);
  }
  const atlasId = `tle-event-atlas:${sha256(JSON.stringify({
    configDigest,
    search,
  }))}`;
  const atlas = aggregateTleEventAtlas({
    atlasId,
    generatedAtUtc: new Date().toISOString(),
    constellation: options.constellation,
    evidenceClass,
    propagationMode: options.propagationMode,
    sourceArchiveContentSha256: archive.catalog.archiveContentSha256!,
    configDigest,
    search,
    observer: NTPU_TLE_OBSERVER,
    canonicalParameterDigest,
    canonicalScenarioDigest,
    windows,
  });
  const outputDir = options.outputDir!;
  await atomicWriteCompactJson(join(outputDir, `${options.constellation}-atlas.json`), atlas);
  await atomicWrite(join(outputDir, `${options.constellation}-summary.md`), summaryMarkdown(atlas));
  await atomicWriteJson(join(outputDir, `${options.constellation}-run-manifest.json`), {
    schema: 'tle-event-atlas-run-manifest-v1',
    atlasId: atlas.atlasId,
    atlasSchema: atlas.schema,
    generatedAtUtc: atlas.generatedAtUtc,
    sourceRoot: options.sourceRoot,
    sourceDirectory: archive.sourceDirectory,
    sourceArchiveContentSha256: atlas.sourceArchiveContentSha256,
    catalogCachePath: join(options.cacheDir, 'catalogs', `${options.constellation}.json`),
    configDigest,
    search,
    observer: NTPU_TLE_OBSERVER,
    propagationMode: options.propagationMode,
    evidenceClass,
    canonicalParameterDigest,
    canonicalScenarioDigest,
    resolverRevision: atlas.resolverRevision,
    visibilityRevision: atlas.visibilityRevision,
    exactSgp4Revision: atlas.exactSgp4Revision,
    windowCacheDirectory: join(options.cacheDir, 'windows', options.constellation, configDigest),
    outputFiles: [
      `${options.constellation}-atlas.json`,
      `${options.constellation}-summary.md`,
      `${options.constellation}-run-manifest.json`,
    ],
  });
  process.stdout.write(`${JSON.stringify({
    phase: 'atlas-complete',
    atlasId: atlas.atlasId,
    outputDir,
    summary: atlas.summary,
  })}\n`);
  if (!atlas.summary.coverageComplete) process.exitCode = 2;
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
