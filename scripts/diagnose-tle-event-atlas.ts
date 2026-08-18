#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import {
  selectTleEventAtlasLogicalSelection,
  type TleEventAtlasEventVariant,
  type TleEventAtlasLinkSample,
  type TleEventAtlasWindowReceipt,
} from '../src/tle/eventAtlas';
import type { SimulatorConstellation } from '../src/simulator/types';

type EventKind = 'inter-handover' | 'forced-continuity';

interface CliOptions {
  readonly cacheDir: string;
  readonly constellation: SimulatorConstellation;
  readonly configDigest: string;
  readonly outputDir: string;
  readonly startUtc: string;
  readonly days: number;
}

interface NumericDistribution {
  readonly count: number;
  readonly min: number | null;
  readonly p25: number | null;
  readonly median: number | null;
  readonly p75: number | null;
  readonly max: number | null;
}

interface DiagnosticEvent {
  readonly event: TleEventAtlasEventVariant;
  readonly decisionCandidate: TleEventAtlasLinkSample | null;
  readonly decisionServing: TleEventAtlasLinkSample | null;
  readonly decisionDeltaDb: number | null;
  readonly maxQualificationDeltaDb: number | null;
}

interface EventKindDiagnostic {
  readonly count: number;
  readonly candidateVisibleAtPreCommitCount: number;
  readonly candidateVisibleAtDecisionCount: number;
  readonly hasQualificationAnchorCount: number;
  readonly preCommitDeltaAtLeastOffsetCount: number;
  readonly maxQualificationDeltaAtLeastOffsetCount: number;
  readonly candidateDecisionPowerLimitedCount: number;
  readonly servingDecisionPowerLimitedCount: number;
  readonly candidateDecisionElevationAtLeast45DegCount: number;
  readonly candidateDecisionElevationAtLeast60DegCount: number;
  readonly candidateDecisionElevationAtLeast75DegCount: number;
  readonly minimumEventElevationAtLeast45DegCount: number;
  readonly minimumEventElevationAtLeast60DegCount: number;
  readonly minimumEventElevationAtLeast75DegCount: number;
  readonly preCommitDeltaDb: NumericDistribution;
  readonly maxQualificationDeltaDb: NumericDistribution;
  readonly decisionDeltaDb: NumericDistribution;
  readonly minimumEventElevationDeg: NumericDistribution;
  readonly candidateDecisionElevationDeg: NumericDistribution;
  readonly servingDecisionElevationDeg: NumericDistribution;
  readonly candidateResidualVisibilitySec: NumericDistribution;
  readonly candidateRequestedPowerW: NumericDistribution;
  readonly candidateActualPowerW: NumericDistribution;
  readonly servingRequestedPowerW: NumericDistribution;
  readonly servingActualPowerW: NumericDistribution;
}

interface NearMiss {
  readonly requestedT0Utc: string;
  readonly triggerInstantUtc: string;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly preCommitDeltaDb: number | null;
  readonly maxQualificationDeltaDb: number | null;
  readonly qualificationAnchorCount: number;
  readonly decisionDeltaDb: number | null;
  readonly minimumEventElevationDeg: number | null;
  readonly candidateDecisionElevationDeg: number | null;
  readonly servingDecisionElevationDeg: number | null;
  readonly candidateResidualVisibilitySec: number | null;
  readonly candidateDecisionPowerLimited: boolean | null;
  readonly servingDecisionPowerLimited: boolean | null;
  readonly candidateRequestedPowerW: number | null;
  readonly candidateActualPowerW: number | null;
}

interface DiagnosticReport {
  readonly schema: 'canonical-tle-event-atlas-diagnostics-v1';
  readonly generatedAtUtc: string;
  readonly constellation: SimulatorConstellation;
  readonly search: {
    readonly startUtc: string;
    readonly endUtcExclusive: string;
    readonly windowStepSec: number;
  };
  readonly configDigest: string;
  readonly coverage: {
    readonly expectedWindowCount: number;
    readonly acceptedWindowCount: number;
    readonly rejectedWindowCount: number;
    readonly eventVariantCount: number;
    readonly uniqueServingChangeCount: number;
    readonly coverageComplete: boolean;
  };
  readonly byEventType: Record<EventKind, EventKindDiagnostic>;
  readonly nearMisses: readonly NearMiss[];
}

function usage(): never {
  throw new Error([
    'Usage: npm run diagnose:tle:event-atlas --',
    '  --cache-dir /home/sat/tle-event-atlas-cache/20260818',
    '  --constellation starlink|oneweb',
    '  --config-digest <sha256>',
    '  --output-dir artifacts/tle-event-atlas/<run>',
    '  --start-utc 2026-05-19T00:00:00Z --days 90',
  ].join('\n'));
}

function valueAfter(argv: readonly string[], index: number, token: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${token} requires a value`);
  return value;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let cacheDir: string | null = null;
  let constellation: SimulatorConstellation | null = null;
  let configDigest: string | null = null;
  let outputDir: string | null = null;
  let startUtc: string | null = null;
  let days: number | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    const take = (): string => {
      const value = valueAfter(argv, index, token);
      index += 1;
      return value;
    };
    if (token === '--cache-dir') cacheDir = take();
    else if (token === '--constellation') {
      const value = take();
      if (value !== 'starlink' && value !== 'oneweb') throw new Error('--constellation must be starlink or oneweb');
      constellation = value;
    } else if (token === '--config-digest') configDigest = take();
    else if (token === '--output-dir') outputDir = take();
    else if (token === '--start-utc') startUtc = take();
    else if (token === '--days') {
      days = Number(take());
      if (!Number.isSafeInteger(days) || days <= 0) throw new Error('--days must be a positive integer');
    } else if (token === '--help' || token === '-h') usage();
    else throw new Error(`unknown option ${token}`);
  }
  if (cacheDir === null || constellation === null || configDigest === null || outputDir === null || startUtc === null || days === null) usage();
  const startMs = Date.parse(startUtc);
  if (!Number.isFinite(startMs) || !startUtc.endsWith('Z')) throw new Error('--start-utc must be an ISO UTC instant ending in Z');
  return {
    cacheDir: resolve(cacheDir),
    constellation,
    configDigest,
    outputDir: resolve(outputDir),
    startUtc: new Date(startMs).toISOString(),
    days,
  };
}

function safeInstant(instantUtc: string): string {
  return instantUtc.replace(/[:.]/g, '-');
}

function instants(options: CliOptions): readonly string[] {
  const startMs = Date.parse(options.startUtc);
  return Object.freeze(Array.from(
    { length: options.days * 48 },
    (_unused, index) => new Date(startMs + index * 1_800_000).toISOString(),
  ));
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function quantile(sortedValues: readonly number[], fraction: number): number | null {
  if (sortedValues.length === 0) return null;
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex]!;
  const upper = sortedValues[upperIndex]!;
  return lower + (upper - lower) * (position - lowerIndex);
}

function distribution(values: readonly (number | null)[]): NumericDistribution {
  const sorted = values.filter(finite).sort((left, right) => left - right);
  return {
    count: sorted.length,
    min: sorted[0] ?? null,
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? null,
  };
}

function atLeast(value: number | null, threshold: number): boolean {
  return value !== null && value >= threshold;
}

function diagnosticEvent(event: TleEventAtlasEventVariant): DiagnosticEvent {
  const decision = event.anchors.find(anchor => anchor.role === 'decision');
  const qualificationDeltas = event.qualificationAnchors.map(anchor => anchor.deltaDb).filter(finite);
  return {
    event,
    decisionCandidate: decision?.candidate ?? null,
    decisionServing: decision?.serving ?? null,
    decisionDeltaDb: decision?.deltaSinrDb ?? null,
    maxQualificationDeltaDb: qualificationDeltas.length === 0 ? null : Math.max(...qualificationDeltas),
  };
}

function countWhere(events: readonly DiagnosticEvent[], predicate: (event: DiagnosticEvent) => boolean): number {
  return events.reduce((count, event) => count + (predicate(event) ? 1 : 0), 0);
}

function eventKindDiagnostic(events: readonly DiagnosticEvent[], offsetDb: number): EventKindDiagnostic {
  const candidateElevations = events.map(event => event.decisionCandidate?.elevationDeg ?? null);
  const servingElevations = events.map(event => event.decisionServing?.elevationDeg ?? null);
  const minElevations = events.map(event => event.event.quality.minimumEventElevationDeg);
  return {
    count: events.length,
    candidateVisibleAtPreCommitCount: countWhere(events, event => event.event.preCommit.candidateVisible),
    candidateVisibleAtDecisionCount: countWhere(events, event => event.decisionCandidate !== null),
    hasQualificationAnchorCount: countWhere(events, event => event.event.qualificationAnchors.length > 0),
    preCommitDeltaAtLeastOffsetCount: countWhere(events, event => atLeast(event.event.preCommit.deltaDb, offsetDb)),
    maxQualificationDeltaAtLeastOffsetCount: countWhere(events, event => atLeast(event.maxQualificationDeltaDb, offsetDb)),
    candidateDecisionPowerLimitedCount: countWhere(events, event => event.decisionCandidate?.powerLimited === true),
    servingDecisionPowerLimitedCount: countWhere(events, event => event.decisionServing?.powerLimited === true),
    candidateDecisionElevationAtLeast45DegCount: countWhere(events, event => atLeast(event.decisionCandidate?.elevationDeg ?? null, 45)),
    candidateDecisionElevationAtLeast60DegCount: countWhere(events, event => atLeast(event.decisionCandidate?.elevationDeg ?? null, 60)),
    candidateDecisionElevationAtLeast75DegCount: countWhere(events, event => atLeast(event.decisionCandidate?.elevationDeg ?? null, 75)),
    minimumEventElevationAtLeast45DegCount: countWhere(events, event => atLeast(event.event.quality.minimumEventElevationDeg, 45)),
    minimumEventElevationAtLeast60DegCount: countWhere(events, event => atLeast(event.event.quality.minimumEventElevationDeg, 60)),
    minimumEventElevationAtLeast75DegCount: countWhere(events, event => atLeast(event.event.quality.minimumEventElevationDeg, 75)),
    preCommitDeltaDb: distribution(events.map(event => event.event.preCommit.deltaDb)),
    maxQualificationDeltaDb: distribution(events.map(event => event.maxQualificationDeltaDb)),
    decisionDeltaDb: distribution(events.map(event => event.decisionDeltaDb)),
    minimumEventElevationDeg: distribution(minElevations),
    candidateDecisionElevationDeg: distribution(candidateElevations),
    servingDecisionElevationDeg: distribution(servingElevations),
    candidateResidualVisibilitySec: distribution(events.map(event => event.event.quality.candidateResidualVisibilitySec)),
    candidateRequestedPowerW: distribution(events.map(event => event.decisionCandidate?.requestedPowerW ?? null)),
    candidateActualPowerW: distribution(events.map(event => event.decisionCandidate?.actualPowerW ?? null)),
    servingRequestedPowerW: distribution(events.map(event => event.decisionServing?.requestedPowerW ?? null)),
    servingActualPowerW: distribution(events.map(event => event.decisionServing?.actualPowerW ?? null)),
  };
}

function nearMiss(event: DiagnosticEvent): NearMiss {
  return {
    requestedT0Utc: event.event.requestedT0Utc,
    triggerInstantUtc: event.event.triggerInstantUtc,
    fromSatelliteId: event.event.fromSatelliteId,
    toSatelliteId: event.event.toSatelliteId,
    preCommitDeltaDb: event.event.preCommit.deltaDb,
    maxQualificationDeltaDb: event.maxQualificationDeltaDb,
    qualificationAnchorCount: event.event.qualificationAnchors.length,
    decisionDeltaDb: event.decisionDeltaDb,
    minimumEventElevationDeg: event.event.quality.minimumEventElevationDeg,
    candidateDecisionElevationDeg: event.decisionCandidate?.elevationDeg ?? null,
    servingDecisionElevationDeg: event.decisionServing?.elevationDeg ?? null,
    candidateResidualVisibilitySec: event.event.quality.candidateResidualVisibilitySec,
    candidateDecisionPowerLimited: event.decisionCandidate?.powerLimited ?? null,
    servingDecisionPowerLimited: event.decisionServing?.powerLimited ?? null,
    candidateRequestedPowerW: event.decisionCandidate?.requestedPowerW ?? null,
    candidateActualPowerW: event.decisionCandidate?.actualPowerW ?? null,
  };
}

function metric(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(digits);
}

function markdown(report: DiagnosticReport): string {
  const formatBucket = (kind: EventKind): string => {
    const bucket = report.byEventType[kind];
    return [
      `### ${kind}`,
      '',
      `- Count: ${bucket.count}`,
      `- Candidate visible at pre-commit: ${bucket.candidateVisibleAtPreCommitCount}/${bucket.count}`,
      `- Candidate visible at decision: ${bucket.candidateVisibleAtDecisionCount}/${bucket.count}`,
      `- Has qualification anchor: ${bucket.hasQualificationAnchorCount}/${bucket.count}`,
      `- Max qualification ΔSINR ≥ offset: ${bucket.maxQualificationDeltaAtLeastOffsetCount}/${bucket.count}`,
      `- Candidate decision power-limited: ${bucket.candidateDecisionPowerLimitedCount}/${bucket.count}`,
      `- Candidate decision elevation ≥45/60/75°: ${bucket.candidateDecisionElevationAtLeast45DegCount}/${bucket.candidateDecisionElevationAtLeast60DegCount}/${bucket.candidateDecisionElevationAtLeast75DegCount} of ${bucket.count}`,
      `- Minimum event elevation p25/median/max: ${metric(bucket.minimumEventElevationDeg.p25)} / ${metric(bucket.minimumEventElevationDeg.median)} / ${metric(bucket.minimumEventElevationDeg.max)}°`,
      `- Max qualification ΔSINR p25/median/max: ${metric(bucket.maxQualificationDeltaDb.p25)} / ${metric(bucket.maxQualificationDeltaDb.median)} / ${metric(bucket.maxQualificationDeltaDb.max)} dB`,
      `- Candidate residual visibility p25/median/max: ${metric(bucket.candidateResidualVisibilitySec.p25, 0)} / ${metric(bucket.candidateResidualVisibilitySec.median, 0)} / ${metric(bucket.candidateResidualVisibilitySec.max, 0)} s`,
    ].join('\n');
  };
  const nearMissRows = report.nearMisses.map((event, index) => (
    `| ${index + 1} | ${event.triggerInstantUtc} | ${event.fromSatelliteId} → ${event.toSatelliteId} | ${metric(event.maxQualificationDeltaDb)} | ${metric(event.minimumEventElevationDeg)} | ${metric(event.candidateResidualVisibilitySec, 0)} | ${event.candidateDecisionPowerLimited === true ? 'yes' : 'no'} |`
  ));
  return [
    `# NTPU ${report.constellation} real-TLE diagnostic report`,
    '',
    `- Search: ${report.search.startUtc} to ${report.search.endUtcExclusive} (exclusive)`,
    `- Coverage: ${report.coverage.acceptedWindowCount}/${report.coverage.expectedWindowCount} accepted; ${report.coverage.rejectedWindowCount} rejected`,
    `- Event variants: ${report.coverage.eventVariantCount}`,
    `- Unique serving changes: ${report.coverage.uniqueServingChangeCount}`,
    `- Config digest: \`${report.configDigest}\``,
    '',
    formatBucket('inter-handover'),
    '',
    formatBucket('forced-continuity'),
    '',
    '## Forced-continuity near misses',
    '',
    '| # | Trigger UTC | Pair | Max qualification ΔSINR (dB) | Min elevation (°) | Residual visibility (s) | Candidate power-limited |',
    '|---:|---|---|---:|---:|---:|---|',
    ...(nearMissRows.length === 0 ? ['| - | - | - | - | - | - | - |'] : nearMissRows),
    '',
    'This report is a projection of accepted canonical Event Atlas receipts. It does not recompute SINR, power, throughput, EE, visibility, or handover decisions.',
    '',
  ].join('\n');
}

async function readWindow(options: CliOptions, instantUtc: string): Promise<TleEventAtlasWindowReceipt> {
  const path = join(
    options.cacheDir,
    'windows',
    options.constellation,
    options.configDigest,
    `${safeInstant(instantUtc)}.json`,
  );
  return JSON.parse(await readFile(path, 'utf8')) as TleEventAtlasWindowReceipt;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const searchInstants = instants(options);
  const startMs = Date.parse(options.startUtc);
  const endMs = startMs + options.days * 86_400_000;
  const variants: TleEventAtlasEventVariant[] = [];
  let acceptedWindowCount = 0;
  let rejectedWindowCount = 0;
  for (const instantUtc of searchInstants) {
    const window = await readWindow(options, instantUtc);
    if (window.configDigest !== options.configDigest) throw new Error(`window config digest mismatch at ${instantUtc}`);
    if (window.status === 'rejected') {
      rejectedWindowCount += 1;
      continue;
    }
    acceptedWindowCount += 1;
    variants.push(...window.events.filter(event => {
      const eventMs = Date.parse(event.triggerInstantUtc);
      return eventMs >= startMs && eventMs < endMs;
    }));
  }
  const selection = selectTleEventAtlasLogicalSelection(variants);
  const diagnostics = selection.preferredEvents.map(diagnosticEvent);
  const byEventType = {
    'inter-handover': diagnostics.filter(event => event.event.sourceEvent === 'inter-handover'),
    'forced-continuity': diagnostics.filter(event => event.event.sourceEvent === 'forced-continuity'),
  } satisfies Record<EventKind, readonly DiagnosticEvent[]>;
  const nearMisses = byEventType['forced-continuity']
    .slice()
    .sort((left, right) => (
      (right.maxQualificationDeltaDb ?? -Infinity) - (left.maxQualificationDeltaDb ?? -Infinity)
      || (right.event.quality.minimumEventElevationDeg ?? -Infinity) - (left.event.quality.minimumEventElevationDeg ?? -Infinity)
      || left.event.triggerInstantUtc.localeCompare(right.event.triggerInstantUtc)
    ))
    .slice(0, 20)
    .map(nearMiss);
  const endUtcExclusive = new Date(endMs).toISOString();
  const report: DiagnosticReport = {
    schema: 'canonical-tle-event-atlas-diagnostics-v1',
    generatedAtUtc: new Date().toISOString(),
    constellation: options.constellation,
    search: { startUtc: options.startUtc, endUtcExclusive, windowStepSec: 1_800 },
    configDigest: options.configDigest,
    coverage: {
      expectedWindowCount: searchInstants.length,
      acceptedWindowCount,
      rejectedWindowCount,
      eventVariantCount: variants.length,
      uniqueServingChangeCount: diagnostics.length,
      coverageComplete: rejectedWindowCount === 0 && acceptedWindowCount === searchInstants.length,
    },
    byEventType: {
      'inter-handover': eventKindDiagnostic(byEventType['inter-handover'], 3),
      'forced-continuity': eventKindDiagnostic(byEventType['forced-continuity'], 3),
    },
    nearMisses,
  };
  await mkdir(options.outputDir, { recursive: true });
  await writeFile(join(options.outputDir, `${options.constellation}-diagnostics.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(join(options.outputDir, `${options.constellation}-diagnostics.md`), markdown(report), 'utf8');
  process.stdout.write(`${JSON.stringify({ phase: 'diagnostics-complete', outputDir: options.outputDir, coverage: report.coverage })}\n`);
  if (!report.coverage.coverageComplete) process.exitCode = 2;
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
