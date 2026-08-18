import type { SimulatorConstellation } from '../../simulator/types';
import type { TleRunPropagationMode } from '../run';
import {
  TLE_EVENT_ATLAS_EXACT_SGP4_REVISION,
  TLE_EVENT_ATLAS_MAX_FULL_CLIPS,
  TLE_EVENT_ATLAS_RESOLVER_REVISION,
  TLE_EVENT_ATLAS_SCHEMA_VERSION,
  TLE_EVENT_ATLAS_VISIBILITY_REVISION,
  type CanonicalTleEventAtlas,
  type TleEventAtlasEventVariant,
  type TleEventAtlasEventVariantReceipt,
  type TleEventAtlasEvidenceClass,
  type TleEventAtlasLogicalEvent,
  type TleEventAtlasNumericDistribution,
  type TleEventAtlasObserverReceipt,
  type TleEventAtlasSearchRange,
  type TleEventAtlasSummary,
  type TleEventAtlasWindowReceipt,
} from './types';

export interface AggregateTleEventAtlasInput {
  readonly atlasId: string;
  readonly generatedAtUtc: string;
  readonly constellation: SimulatorConstellation;
  readonly evidenceClass: TleEventAtlasEvidenceClass;
  readonly propagationMode: TleRunPropagationMode;
  readonly sourceArchiveContentSha256: string;
  readonly configDigest: string;
  readonly search: TleEventAtlasSearchRange;
  readonly observer: TleEventAtlasObserverReceipt;
  readonly canonicalParameterDigest: string;
  readonly canonicalScenarioDigest: string;
  readonly windows: readonly TleEventAtlasWindowReceipt[];
}

function parseUtc(value: string, label: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || !value.endsWith('Z')) throw new Error(`${label} must be an ISO UTC instant`);
  return ms;
}

function expectedWindowInstants(search: TleEventAtlasSearchRange): readonly string[] {
  const startMs = parseUtc(search.startUtc, 'search.startUtc');
  const endMs = parseUtc(search.endUtcExclusive, 'search.endUtcExclusive');
  if (endMs <= startMs) throw new Error('Event Atlas search range must be increasing');
  if (!Number.isSafeInteger(search.windowStepSec) || search.windowStepSec <= 0) {
    throw new Error('Event Atlas windowStepSec must be a positive safe integer');
  }
  const stepMs = search.windowStepSec * 1_000;
  if ((endMs - startMs) % stepMs !== 0) {
    throw new Error('Event Atlas search range must be divisible by windowStepSec');
  }
  if (search.physicalDurationSec !== (endMs - startMs) / 1_000) {
    throw new Error('Event Atlas physicalDurationSec disagrees with the UTC range');
  }
  return Object.freeze(Array.from(
    { length: (endMs - startMs) / stepMs },
    (_unused, index) => new Date(startMs + index * stepMs).toISOString(),
  ));
}

function validateWindows(
  input: AggregateTleEventAtlasInput,
  expectedInstants: readonly string[],
): readonly TleEventAtlasWindowReceipt[] {
  const byInstant = new Map<string, TleEventAtlasWindowReceipt>();
  for (const window of input.windows) {
    if (window.constellation !== input.constellation) throw new Error('Event Atlas window constellation mismatch');
    if (window.evidenceClass !== input.evidenceClass) throw new Error('Event Atlas window evidence class mismatch');
    if (window.propagationMode !== input.propagationMode) throw new Error('Event Atlas window propagation mode mismatch');
    if (window.configDigest !== input.configDigest) throw new Error('Event Atlas window config digest mismatch');
    if (byInstant.has(window.requestedT0Utc)) throw new Error(`duplicate Event Atlas window ${window.requestedT0Utc}`);
    byInstant.set(window.requestedT0Utc, window);
  }
  const missing = expectedInstants.filter(instant => !byInstant.has(instant));
  const unexpected = [...byInstant.keys()].filter(instant => !expectedInstants.includes(instant));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(`Event Atlas window coverage is incomplete (missing=${missing.length}, unexpected=${unexpected.length})`);
  }
  return Object.freeze(expectedInstants.map(instant => byInstant.get(instant)!));
}

function finiteMetric(value: number | null): number {
  return value === null || !Number.isFinite(value) ? -Infinity : value;
}

/** Prefer a neutral, well-centered source window before any teaching score. */
function compareVariantsForSameLogicalEvent(
  left: TleEventAtlasEventVariant,
  right: TleEventAtlasEventVariant,
): number {
  const leftCenteredContext = Math.min(
    left.decisionAnchorIndex - left.beforeAnchorIndex,
    left.afterAnchorIndex - left.decisionAnchorIndex,
    left.triggerAnchorIndex,
    240 - left.triggerAnchorIndex,
  );
  const rightCenteredContext = Math.min(
    right.decisionAnchorIndex - right.beforeAnchorIndex,
    right.afterAnchorIndex - right.decisionAnchorIndex,
    right.triggerAnchorIndex,
    240 - right.triggerAnchorIndex,
  );
  return Number(right.quality.complete) - Number(left.quality.complete)
    || rightCenteredContext - leftCenteredContext
    || left.requestedT0Utc.localeCompare(right.requestedT0Utc)
    || left.source.publicationSha256.localeCompare(right.source.publicationSha256)
    || left.variantId.localeCompare(right.variantId);
}

function compareTeachingRank(
  left: TleEventAtlasEventVariant,
  right: TleEventAtlasEventVariant,
): number {
  return Number(right.sourceEvent === 'inter-handover') - Number(left.sourceEvent === 'inter-handover')
    || Number(right.quality.complete) - Number(left.quality.complete)
    || finiteMetric(right.quality.minimumEventElevationDeg) - finiteMetric(left.quality.minimumEventElevationDeg)
    || finiteMetric(right.quality.deltaSinrDynamicRangeDb) - finiteMetric(left.quality.deltaSinrDynamicRangeDb)
    || finiteMetric(right.quality.candidateResidualVisibilitySec) - finiteMetric(left.quality.candidateResidualVisibilitySec)
    || right.quality.concurrentVisibleSatelliteCount - left.quality.concurrentVisibleSatelliteCount
    || left.triggerInstantUtc.localeCompare(right.triggerInstantUtc)
    || left.logicalEventKey.localeCompare(right.logicalEventKey);
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

function distribution(values: readonly (number | null)[]): TleEventAtlasNumericDistribution {
  const sorted = values
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((left, right) => left - right);
  return Object.freeze({
    count: sorted.length,
    min: sorted[0] ?? null,
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? null,
  });
}

function summary(
  windows: readonly TleEventAtlasWindowReceipt[],
  logicalEvents: readonly TleEventAtlasLogicalEvent[],
  preferredById: ReadonlyMap<string, TleEventAtlasEventVariant>,
  physicalDurationSec: number,
  eventVariantCount: number,
): TleEventAtlasSummary {
  const preferred = logicalEvents.map(event => preferredById.get(event.preferredVariantId)!);
  const valid = preferred.filter(event => event.sourceEvent === 'inter-handover');
  const forced = preferred.filter(event => event.sourceEvent === 'forced-continuity');
  const servingChangeCount = preferred.length;
  const rejectedWindowCount = windows.filter(window => window.status === 'rejected').length;
  const coverageComplete = rejectedWindowCount === 0;
  return Object.freeze({
    coverageComplete,
    populationClaimsAllowed: coverageComplete,
    expectedWindowCount: windows.length,
    acceptedWindowCount: windows.filter(window => window.status === 'accepted').length,
    rejectedWindowCount,
    eventVariantCount,
    uniqueServingChangeCount: servingChangeCount,
    validInterHandoverCount: valid.length,
    forcedContinuityCount: forced.length,
    forcedFractionOfServingChanges: servingChangeCount === 0 ? null : forced.length / servingChangeCount,
    validInterHandoversPerPhysicalHour: !coverageComplete
      ? null
      : physicalDurationSec === 0
        ? 0
        : valid.length / (physicalDurationSec / 3_600),
    completeClipCount: preferred.filter(event => event.quality.complete).length,
    validAtLeast45DegCount: valid.filter(event => event.quality.eventTimeMinimumElevationAtLeast45Deg).length,
    validAtLeast60DegCount: valid.filter(event => event.quality.eventTimeMinimumElevationAtLeast60Deg).length,
    validAtLeast75DegCount: valid.filter(event => event.quality.eventTimeMinimumElevationAtLeast75Deg).length,
    uniqueSatellitePairCount: new Set(preferred.map(event => (
      `${event.fromSatelliteId}|${event.toSatelliteId}`
    ))).size,
    minimumEventElevationDeg: distribution(valid.map(event => event.quality.minimumEventElevationDeg)),
    deltaSinrDynamicRangeDb: distribution(valid.map(event => event.quality.deltaSinrDynamicRangeDb)),
    candidateResidualVisibilitySec: distribution(valid.map(event => event.quality.candidateResidualVisibilitySec)),
    concurrentVisibleSatelliteCount: distribution(valid.map(event => event.quality.concurrentVisibleSatelliteCount)),
  });
}

/**
 * Publish a fail-closed bounded atlas from complete window receipts. Event
 * variants are retained; population counts use one neutral preferred variant
 * per physical UTC/from/to event to avoid overlapping-window inflation.
 */
export function aggregateTleEventAtlas(
  input: AggregateTleEventAtlasInput,
): CanonicalTleEventAtlas {
  const expectedInstants = expectedWindowInstants(input.search);
  const windows = validateWindows(input, expectedInstants);
  const startMs = parseUtc(input.search.startUtc, 'search.startUtc');
  const endMs = parseUtc(input.search.endUtcExclusive, 'search.endUtcExclusive');
  const eventVariants = Object.freeze(windows.flatMap(window => (
    window.status === 'accepted'
      ? window.events.filter(event => {
          const eventMs = parseUtc(event.triggerInstantUtc, 'event.triggerInstantUtc');
          return eventMs >= startMs && eventMs < endMs;
        })
      : []
  )).sort((left, right) => (
    left.triggerInstantUtc.localeCompare(right.triggerInstantUtc)
    || left.logicalEventKey.localeCompare(right.logicalEventKey)
    || left.variantId.localeCompare(right.variantId)
  )));

  const grouped = new Map<string, TleEventAtlasEventVariant[]>();
  for (const variant of eventVariants) {
    const bucket = grouped.get(variant.logicalEventKey) ?? [];
    bucket.push(variant);
    grouped.set(variant.logicalEventKey, bucket);
  }
  const logicalEvents = Object.freeze([...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([logicalEventKey, variants]): TleEventAtlasLogicalEvent => {
      const ordered = [...variants].sort(compareVariantsForSameLogicalEvent);
      const preferred = ordered[0]!;
      return Object.freeze({
        logicalEventKey,
        sourceEvent: preferred.sourceEvent,
        triggerInstantUtc: preferred.triggerInstantUtc,
        fromSatelliteId: preferred.fromSatelliteId,
        toSatelliteId: preferred.toSatelliteId,
        preferredVariantId: preferred.variantId,
        variantIds: Object.freeze(ordered.map(variant => variant.variantId)),
      });
    }));
  const preferredById = new Map(eventVariants.map(event => [event.variantId, event]));
  const allPreferredEvents = logicalEvents
    .map(event => preferredById.get(event.preferredVariantId)!)
    .sort(compareTeachingRank);
  const rankedPreferredVariantIds = Object.freeze(allPreferredEvents.map(event => event.variantId));
  const retainedFullClipIds = new Set(rankedPreferredVariantIds.slice(0, TLE_EVENT_ATLAS_MAX_FULL_CLIPS));
  const preferredEvents = Object.freeze(allPreferredEvents
    .filter(event => retainedFullClipIds.has(event.variantId))
    .sort((left, right) => left.triggerInstantUtc.localeCompare(right.triggerInstantUtc)
      || left.logicalEventKey.localeCompare(right.logicalEventKey)));
  const publishedWindows = Object.freeze(windows.map(window => {
    if (window.status === 'rejected') return window;
    const { events, ...receipt } = window;
    return Object.freeze({ ...receipt, eventVariantCount: events.length });
  }));
  const eventVariantReceipts = Object.freeze(eventVariants.map((event): TleEventAtlasEventVariantReceipt => Object.freeze({
    variantId: event.variantId,
    logicalEventKey: event.logicalEventKey,
    sourceEvent: event.sourceEvent,
    requestedT0Utc: event.requestedT0Utc,
    triggerInstantUtc: event.triggerInstantUtc,
    fromSatelliteId: event.fromSatelliteId,
    toSatelliteId: event.toSatelliteId,
    traceDigest: event.traceDigest,
    geometryRunId: event.geometryRunId,
    analysisRunId: event.analysisRunId,
    preCommit: event.preCommit,
    postCommit: event.postCommit,
    source: event.source,
    quality: event.quality,
  })));

  return Object.freeze({
    schema: TLE_EVENT_ATLAS_SCHEMA_VERSION,
    atlasId: input.atlasId,
    generatedAtUtc: input.generatedAtUtc,
    constellation: input.constellation,
    evidenceClass: input.evidenceClass,
    propagationMode: input.propagationMode,
    sourceArchiveContentSha256: input.sourceArchiveContentSha256,
    configDigest: input.configDigest,
    search: Object.freeze({ ...input.search }),
    observer: Object.freeze({ ...input.observer }),
    canonicalParameterDigest: input.canonicalParameterDigest,
    canonicalScenarioDigest: input.canonicalScenarioDigest,
    resolverRevision: TLE_EVENT_ATLAS_RESOLVER_REVISION,
    visibilityRevision: TLE_EVENT_ATLAS_VISIBILITY_REVISION,
    exactSgp4Revision: TLE_EVENT_ATLAS_EXACT_SGP4_REVISION,
    windows: publishedWindows,
    eventVariants: eventVariantReceipts,
    preferredEvents,
    logicalEvents,
    rankedPreferredVariantIds,
    summary: summary(
      windows,
      logicalEvents,
      preferredById,
      input.search.physicalDurationSec,
      eventVariants.length,
    ),
  });
}
