import {
  candidateLinkKey,
  candidateLinkKeyString,
  sameCandidateLinkKey,
  type CandidateLinkKey,
} from '../../engine/handover/candidateDecisionContract';
import { computeAngleAwareEnergyEfficiency } from '../../engine/signal/angle-aware-ee';
import type { LinkSample } from '../../engine/signal/types';
import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetric,
  HomepageBeamMetricRole,
  HomepageBeamMetricsProjection,
  HomepageSourceFrame,
} from './contracts';
import { projectHomepageHandoverStory } from './homepageHandoverStoryProjection';
import {
  homepageEeColorNormalized,
  homepageSatelliteColorForBeam,
} from './homepageSatelliteVisualIdentity';
import {
  hasContinuousHomepageMetricTimeline,
  stabilizeHomepageMetricValues,
  type HomepageLiveMetricValues,
} from './homepageMetricStability';
import {
  SINR_LIVE_CANDIDATE_PROBE_PROVENANCE,
  SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE,
  decodeCellLinkBudgetBeamId,
} from '../../scene/sinrLiveCellModel';
import { homepageDemoEeSatelliteFactor } from '../../engine/handover/homepageDemoEe';
import type {
  SinrLiveCandidateProbeEvidence,
  SinrLivePrimaryBeamMetricEvidence,
} from '../../scene/sinrLiveCellModel';

/**
 * Inputs for the homepage's per-beam readout.  All values are already owned by
 * the live source-frame and accepted-snapshot authorities; this module only
 * joins and projects them.
 */
export interface BuildHomepageBeamMetricsInput {
  readonly sourceFrame: HomepageSourceFrame;
  readonly snapshot: HomepageAcceptedSnapshot | null;
  readonly servingBeamCount: number;
  readonly candidateBeamCount: number;
  /** Physical beam budgets after mapping a focused-cell control to its seven-beam satellite. */
  readonly physicalServingBeamCount?: number;
  readonly physicalCandidateBeamCount?: number;
  readonly beamCountBySatellite?: Readonly<Record<string, number>>;
  /** Optional prior projection used only for same-role finite-value retention. */
  readonly previousMetrics?: HomepageBeamMetricsProjection | null;
  /**
   * Homepage-only display contract. It never feeds the decision engine: it
   * makes the service beam the visual EE baseline and permits an EE lead only
   * for the accepted handover target (and accepted inter candidates).
   */
  readonly eeDisplayPolicy?: 'source' | 'handover-hierarchy';
}

type PairFlags = {
  primary: boolean;
  candidate: boolean;
  active: boolean;
  snapshot: boolean;
};

interface PairRecord extends PairFlags {
  readonly key: CandidateLinkKey;
}

interface LiveAggregate {
  readonly throughputBps: number[];
  readonly powerW: number[];
  readonly sinrDb: number[];
  /** Same-frame canonical P_sys carried by every angle-aware sample. */
  readonly systemPowerW: number[];
}

interface DraftMetric {
  readonly key: CandidateLinkKey;
  readonly joinKey: string;
  readonly sourceFrameId: string;
  readonly snapshotId: string | null;
  readonly satelliteId: string;
  readonly beamId: number;
  readonly role: HomepageBeamMetricRole;
  readonly availability: HomepageBeamMetric['availability'];
  readonly sinrDb: number | null;
  readonly powerW: number | null;
  readonly throughputBps: number | null;
  readonly energyEfficiencyBitsPerJoule: number | null;
  readonly eeNormalized: number | null;
  readonly eeBasis: HomepageBeamMetric['eeBasis'];
  readonly provenance?: HomepageBeamMetric['provenance'];
  readonly reason: string | null;
  readonly isPrimaryServing: boolean;
}

const HOMEPAGE_EE_HIERARCHY_PROVENANCE = 'homepage-ee-hierarchy-display-only' as const;
const HOMEPAGE_EE_HIERARCHY_BASIS = 'homepage-handover-hierarchy-display' as const;
const HOMEPAGE_DEMO_EE_PROVENANCE = 'homepage-demo-ee-display-only' as const;
const HOMEPAGE_DEMO_EE_BASIS = 'homepage-demo-stable' as const;

const CANDIDATE_PROBE_UNAVAILABLE_REASON =
  'candidate display-only power, rate, and instantaneous EE are unavailable: no finite same-frame angle-aware candidate-probe evidence exists';
const ACTIVE_SAMPLE_UNAVAILABLE_REASON =
  'live servingLinkSample.angleAware has no complete finite throughput and positive power for this active pair';
const SERVING_SAMPLE_UNAVAILABLE_REASON =
  'primary servingLinkSample.angleAware is unavailable for this source frame';
const IDLE_BEAM_REASON =
  'no live servingLinkSample.angleAware is available for this configured beam';

function fail(message: string): never {
  throw new TypeError(`homepage beam metrics: ${message}`);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBeamId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Read the four handover-story values from one primary-UE LinkSample.
 * Serving and candidate rows must enter through this same function; otherwise
 * the rail silently compares a UE-level counterfactual with a beam population
 * aggregate. The sample's published EE is checked against the same C8 ratio
 * before it is exposed.
 */
function readAngleAwareMetricValues(
  sample: LinkSample | null | undefined,
): HomepageLiveMetricValues | null {
  if (sample === null || sample === undefined) return null;
  const terms = sample.angleAware;
  if (terms === undefined) return null;
  const sinrDb = finiteOrNull(sample.sinrDb);
  const gammaDb = finiteOrNull(terms.gammaDb);
  const thetaRad = finiteOrNull(terms.thetaRad);
  const distanceM = finiteOrNull(terms.distanceM);
  const powerOutputW = finiteOrNull(terms.powerW);
  const transmitGainLinear = finiteOrNull(terms.transmitGainLinear);
  const channelGainLinear = finiteOrNull(terms.channelGainLinear);
  const desiredSignalW = finiteOrNull(terms.desiredSignalW);
  const interferenceW = finiteOrNull(terms.interferenceW);
  const noiseW = finiteOrNull(terms.noiseW);
  const gammaLinear = finiteOrNull(terms.gammaLinear);
  const bandwidthHz = finiteOrNull(terms.bandwidthHz);
  const beamLoad = finiteOrNull(terms.beamLoad);
  const powerW = finiteOrNull(terms.powerConsumptionW);
  const throughputBps = finiteOrNull(terms.throughputBps);
  const conversionEfficiency = finiteOrNull(terms.conversionEfficiency);
  const systemPowerW = finiteOrNull(terms.systemPowerW);
  const rawSourceEe = finiteOrNull(terms.energyEfficiencyBitsPerJoule);
  const homepageDemoEe = finiteOrNull(terms.homepageDemoEeBitsPerJoule);
  // The homepage candidate lane publishes a bounded, temporally continuous
  // projection alongside the raw formula. Prefer that projection when it is
  // present so the serving row and the replacement rows share one readable
  // threshold basis; rawSourceEe remains validated and available on the sample.
  const sourceEe = homepageDemoEe ?? rawSourceEe;
  if (
    sinrDb === null
    || gammaDb === null
    || thetaRad === null
    || distanceM === null
    || distanceM <= 0
    || powerOutputW === null
    || powerOutputW <= 0
    || transmitGainLinear === null
    || transmitGainLinear <= 0
    || channelGainLinear === null
    || channelGainLinear <= 0
    || desiredSignalW === null
    || desiredSignalW < 0
    || interferenceW === null
    || interferenceW < 0
    || noiseW === null
    || noiseW <= 0
    || gammaLinear === null
    || gammaLinear < 0
    || bandwidthHz === null
    || bandwidthHz <= 0
    || beamLoad === null
    || beamLoad <= 0
    || powerW === null
    || powerW <= 0
    || throughputBps === null
    || throughputBps < 0
    || conversionEfficiency === null
    || conversionEfficiency <= 0
    || systemPowerW === null
    || systemPowerW <= 0
    || rawSourceEe === null
    || (terms.homepageDemoEeBitsPerJoule !== undefined && homepageDemoEe === null)
  ) return null;
  // The public EE contract is system EE: the denominator is the same-frame
  // canonical P_sys, not the candidate link's own RF/supply power. Recompute
  // only as an integrity check, then retain the producer-published value so a
  // multi-link frame cannot silently turn into link-local EE in the rail.
  const canonicalEe = computeAngleAwareEnergyEfficiency(
    throughputBps,
    systemPowerW,
  );
  if (
    !Number.isFinite(canonicalEe)
    || Math.abs(rawSourceEe - canonicalEe) > Math.max(1e-9, Math.abs(canonicalEe) * 1e-9)
  ) return null;
  return { sinrDb, powerW, throughputBps, energyEfficiencyBitsPerJoule: sourceEe! };
}

function readCandidateProbeMetricValues(
  probe: SinrLiveCandidateProbeEvidence | undefined,
): HomepageLiveMetricValues | null {
  if (probe?.status !== 'available') return null;
  return readAngleAwareMetricValues(probe.sample);
}

function readPrimaryBeamMetricValues(
  evidence: SinrLivePrimaryBeamMetricEvidence | undefined,
): HomepageLiveMetricValues | null {
  if (evidence?.status !== 'available') return null;
  return readAngleAwareMetricValues(evidence.sample);
}

function usableCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return null;
  return Math.floor(value);
}

function compareSatelliteId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareBeamId(left: number, right: number): number {
  return left - right;
}

function comparePairRecord(left: PairRecord, right: PairRecord): number {
  if (left.primary !== right.primary) return left.primary ? -1 : 1;
  if (left.candidate !== right.candidate) return left.candidate ? -1 : 1;
  if (left.active !== right.active) return left.active ? -1 : 1;
  if (left.snapshot !== right.snapshot) return left.snapshot ? -1 : 1;
  return compareBeamId(left.key.beamId, right.key.beamId);
}

/** Stable display-only contrast for the seven physical beams in one cell. */
const HOMEPAGE_ROSTER_EE_FACTORS = Object.freeze([
  0.98,
  1.06,
  0.88,
  1.02,
  0.84,
  0.96,
  0.90,
] as const);

function homepageRosterEeFactor(beamId: number): number {
  const variantIndex = decodeCellLinkBudgetBeamId(beamId).variantIndex;
  return HOMEPAGE_ROSTER_EE_FACTORS[variantIndex] ?? 0.94;
}

/**
 * Keep a seven-beam candidate roster readable when a live frame publishes
 * only B1. This is a homepage display fallback; it never enters the decision
 * engine, the active RF assignments, or the canonical raw EE field.
 */
function fillHomepageRosterMetricGaps(
  drafts: readonly DraftMetric[],
  input: BuildHomepageBeamMetricsInput,
): readonly DraftMetric[] {
  if (input.eeDisplayPolicy !== 'source') return drafts;

  const baselineBySatellite = new Map<string, DraftMetric>();
  for (const draft of drafts) {
    if (positiveFinite(draft.energyEfficiencyBitsPerJoule) === null) continue;
    const current = baselineBySatellite.get(draft.satelliteId);
    if (
      current === undefined
      || decodeCellLinkBudgetBeamId(draft.beamId).variantIndex === 0
    ) baselineBySatellite.set(draft.satelliteId, draft);
  }

  const globalBaseline = drafts.find(draft => (
    draft.role === 'candidate'
    && positiveFinite(draft.energyEfficiencyBitsPerJoule) !== null
  )) ?? drafts.find(draft => (
    draft.role !== 'serving'
    && positiveFinite(draft.energyEfficiencyBitsPerJoule) !== null
  )) ?? drafts.find(draft => positiveFinite(draft.energyEfficiencyBitsPerJoule) !== null);
  const globalBaselineEe = positiveFinite(globalBaseline?.energyEfficiencyBitsPerJoule);

  return drafts.map(draft => {
    if (draft.role !== 'observed' && draft.role !== 'candidate') return draft;
    const sameSatelliteBaseline = baselineBySatellite.get(draft.satelliteId);
    const baseline = sameSatelliteBaseline ?? globalBaseline;
    const rawEe = positiveFinite(draft.energyEfficiencyBitsPerJoule);
    const baselineEe = positiveFinite(baseline?.energyEfficiencyBitsPerJoule)
      ?? globalBaselineEe;
    // Finite values are already the model/source evidence used by the
    // handover decision. Do not decorate them again here: a second
    // satellite/beam multiplier can both suppress the whole roster and make
    // the accepted target appear worse than the serving beam.
    if (rawEe !== null) return draft;
    if (baseline === undefined || baselineEe === null) return draft;

    // Only synthesized rows need a deterministic fallback value. The
    // fallback stays close to the same-satellite baseline while making the
    // seven physical beams legible in the rail.
    const satelliteFactor = homepageDemoEeSatelliteFactor(draft.satelliteId);
    const sourceEe = baselineEe;
    const displayedEe = Math.max(
      80_000,
      Math.min(
        180_000,
        sourceEe * satelliteFactor * homepageRosterEeFactor(draft.beamId),
      ),
    );
    const powerW = positiveFinite(draft.powerW)
      ?? positiveFinite(baseline?.powerW)
      ?? 1;
    const sinrDb = finiteOrNull(draft.sinrDb)
      ?? finiteOrNull(baseline?.sinrDb)
      ?? 0;
    return {
      ...draft,
      availability: 'available',
      sinrDb,
      powerW,
      throughputBps: displayedEe * powerW,
      energyEfficiencyBitsPerJoule: displayedEe,
      eeBasis: HOMEPAGE_DEMO_EE_BASIS,
      provenance: HOMEPAGE_DEMO_EE_PROVENANCE,
      reason: null,
    };
  });
}

function sumFinite(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let total = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const next = total + value;
    if (!Number.isFinite(next)) return null;
    total = next;
  }
  return total;
}

function meanFinite(values: readonly number[]): number | null {
  const total = sumFinite(values);
  return total === null ? null : total / values.length;
}

function maxFinite(values: readonly number[]): number | null {
  const finiteValues = values.filter(value => Number.isFinite(value));
  return finiteValues.length === 0 ? null : Math.max(...finiteValues);
}

function availableEvidenceValue(
  evidence: { readonly status: string; readonly value: number | null } | undefined,
): number | null {
  if (evidence?.status !== 'available') return null;
  return finiteOrNull(evidence.value);
}

function assertEvidenceSourceFrame(
  evidence: { readonly sourceFrameId: string | null } | undefined,
  sourceFrameId: string,
  label: string,
): void {
  if (evidence !== undefined && evidence.sourceFrameId !== null && evidence.sourceFrameId !== sourceFrameId) {
    fail(`${label}/sourceFrameId mismatch`);
  }
}

function assertCandidateOpportunityFrame(
  opportunity: {
    readonly sourceFrameId: string;
    readonly sinr: { readonly sourceFrameId: string | null };
  },
  sourceFrameId: string,
  label: string,
): void {
  if (opportunity.sourceFrameId !== sourceFrameId) fail(`${label}/sourceFrameId mismatch`);
  assertEvidenceSourceFrame(opportunity.sinr, sourceFrameId, `${label}.sinr`);
}

function assertSourceFrameIdentity(
  sourceFrame: HomepageSourceFrame,
  snapshot: HomepageAcceptedSnapshot | null,
): void {
  if (!isNonEmptyString(sourceFrame.sourceFrameId)) fail('sourceFrame.sourceFrameId must be non-empty');
  if (sourceFrame.frame === null || typeof sourceFrame.frame !== 'object') {
    fail('sourceFrame.frame must be an object');
  }
  if (snapshot !== null && snapshot.sourceFrameId !== sourceFrame.sourceFrameId) {
    fail('snapshot/sourceFrameId mismatch');
  }
  if (
    sourceFrame.opportunitySet !== null
    && sourceFrame.opportunitySet.sourceFrameId !== sourceFrame.sourceFrameId
  ) {
    fail('opportunitySet/sourceFrameId mismatch');
  }
  const cellFrame = sourceFrame.frame.sinrLiveCells;
  if (cellFrame?.sourceFrameId !== undefined && cellFrame.sourceFrameId !== sourceFrame.sourceFrameId) {
    fail('sinrLiveCells/sourceFrameId mismatch');
  }
  if (cellFrame?.primaryUeId !== undefined && cellFrame.primaryUeId !== sourceFrame.primaryUeId) {
    fail('sinrLiveCells/primaryUeId mismatch');
  }
  if (cellFrame !== undefined && cellFrame.simTimeSec !== sourceFrame.simTimeSec) {
    fail('sinrLiveCells/simTimeSec mismatch');
  }
  const sourceDecision = sourceFrame.decision ?? null;
  if (sourceDecision !== null) {
    if (sourceDecision.sourceFrameId !== sourceFrame.sourceFrameId) {
      fail('decision/sourceFrameId mismatch');
    }
    if (sourceDecision.simTimeMs !== sourceFrame.simTimeMs) {
      fail('decision/simTimeMs mismatch');
    }
    if (
      sourceDecision.epochToken !== undefined
      && sourceDecision.epochToken !== sourceFrame.epochToken
    ) {
      fail('decision/epochToken mismatch');
    }
  }
  const snapshotDecision = snapshot?.decision ?? null;
  if (snapshotDecision !== null) {
    if (snapshotDecision.sourceFrameId !== sourceFrame.sourceFrameId) {
      fail('snapshot decision/sourceFrameId mismatch');
    }
    if (snapshotDecision.simTimeMs !== sourceFrame.simTimeMs) {
      fail('snapshot decision/simTimeMs mismatch');
    }
  }
}

function assertCandidateProbeFrame(
  probe: SinrLiveCandidateProbeEvidence,
  sourceFrame: HomepageSourceFrame,
  label: string,
): void {
  if (probe.sourceFrameId !== sourceFrame.sourceFrameId) fail(`${label}/sourceFrameId mismatch`);
  if (probe.simTimeSec !== sourceFrame.simTimeSec) fail(`${label}/simTimeSec mismatch`);
  if (probe.primaryUeId !== sourceFrame.primaryUeId) fail(`${label}/primaryUeId mismatch`);
  if (probe.provenance !== SINR_LIVE_CANDIDATE_PROBE_PROVENANCE) {
    fail(`${label}/provenance mismatch`);
  }
  if (probe.eeBasis !== 'candidate-probe') fail(`${label}/eeBasis mismatch`);
  const joinKey = candidateLinkKeyString(probe.key);
  if (probe.sample !== null) {
    if (probe.sample.satId !== probe.key.satelliteId || probe.sample.beamId !== probe.key.beamId) {
      fail(`${label}/sample/key mismatch`);
    }
    if (probe.sample.ueId !== probe.primaryUeId) fail(`${label}/sample/ueId mismatch`);
    if (
      probe.status === 'available'
      && probe.sample.angleAware?.timeSec !== sourceFrame.simTimeSec
    ) {
      fail(`${label}/sample/timeSec mismatch`);
    }
  }
  if (joinKey.length === 0) fail(`${label}/key must be non-empty`);
}

function assertPrimaryBeamMetricFrame(
  evidence: SinrLivePrimaryBeamMetricEvidence,
  sourceFrame: HomepageSourceFrame,
  label: string,
): void {
  if (evidence.sourceFrameId !== sourceFrame.sourceFrameId) fail(`${label}/sourceFrameId mismatch`);
  if (evidence.simTimeSec !== sourceFrame.simTimeSec) fail(`${label}/simTimeSec mismatch`);
  if (evidence.primaryUeId !== sourceFrame.primaryUeId) fail(`${label}/primaryUeId mismatch`);
  if (evidence.provenance !== SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE) {
    fail(`${label}/provenance mismatch`);
  }
  const joinKey = candidateLinkKeyString(evidence.key);
  if (evidence.sample !== null) {
    if (
      evidence.sample.satId !== evidence.key.satelliteId
      || evidence.sample.beamId !== evidence.key.beamId
    ) fail(`${label}/sample/key mismatch`);
    if (evidence.sample.ueId !== evidence.primaryUeId) fail(`${label}/sample/ueId mismatch`);
    if (
      evidence.status === 'available'
      && evidence.sample.angleAware?.timeSec !== sourceFrame.simTimeSec
    ) {
      fail(`${label}/sample/timeSec mismatch`);
    }
  }
  if (joinKey.length === 0) fail(`${label}/key must be non-empty`);
}

function snapshotLinks(snapshot: HomepageAcceptedSnapshot) {
  return [
    snapshot.serving ?? null,
    ...(snapshot.candidates ?? []),
    ...snapshot.plan.groups.flatMap(group => group.links ?? []),
  ].filter((link): link is NonNullable<typeof link> => link !== null);
}

function resolveIlluminatedBeamId(
  satId: string,
  cellId: number,
  beamCellsBySatId: ReadonlyMap<string, readonly { readonly beamId: number; readonly coreLocalBeamIndex?: number }[]>,
): number | null {
  if (!Number.isInteger(cellId) || cellId < 0) return null;
  const cells = beamCellsBySatId.get(satId) ?? [];

  // The live cell lane carries the core local index when it is available. This
  // avoids treating a geographic cell id as a beam id in an arbitrary layout.
  const byCoreIndex = cells.find(cell => cell.coreLocalBeamIndex === cellId);
  if (byCoreIndex !== undefined && isBeamId(byCoreIndex.beamId)) return byCoreIndex.beamId;

  // The active cell producer's typed link-budget identity is cellId + 1. The
  // direct id fallback keeps older/archive fixtures with zero-based cells
  // usable when their configured beam map is the only identity source.
  const oneBased = cells.find(cell => cell.beamId === cellId + 1);
  if (oneBased !== undefined && isBeamId(oneBased.beamId)) return oneBased.beamId;
  const direct = cells.find(cell => cell.beamId === cellId);
  if (direct !== undefined && isBeamId(direct.beamId)) return direct.beamId;
  return cellId + 1;
}

function configuredBeamIds(
  satId: string,
  sourceFrame: HomepageSourceFrame,
  snapshotBeamIdsBySatellite: ReadonlyMap<string, readonly number[]>,
): number[] {
  const ids = new Set<number>();
  for (const cell of sourceFrame.frame.beamCellsBySatId.get(satId) ?? []) {
    if (isBeamId(cell.beamId)) ids.add(cell.beamId);
  }
  if (ids.size === 0) {
    for (const beamId of snapshotBeamIdsBySatellite.get(satId) ?? []) {
      if (isBeamId(beamId)) ids.add(beamId);
    }
  }
  return [...ids].sort(compareBeamId);
}

function rosterBeamIds(
  pairs: readonly PairRecord[],
  configuredIds: readonly number[],
  requestedCount: number | null,
): readonly number[] {
  const selected = new Set<number>();
  const pairIds = [...pairs].sort(comparePairRecord).map(pair => pair.key.beamId);

  const addUntilFull = (beamIds: readonly number[]): void => {
    for (const beamId of beamIds) {
      if (!isBeamId(beamId)) continue;
      if (requestedCount !== null && selected.size >= requestedCount) return;
      selected.add(beamId);
    }
  };

  // Required source-frame pairs are selected first so a count override does
  // not hide the accepted serving/candidate/active identity. The final set is
  // still bounded by the configured role count.
  addUntilFull(pairIds);
  addUntilFull(configuredIds);

  // The left scenario control is a configured display budget, not a count of
  // beams that happen to be geometrically reachable in this frame. Complete
  // the one-based roster when the source map is sparse so the rail still shows
  // every configured row; these added rows remain idle/N/A because no source
  // measurement is synthesized for them.
  if (requestedCount !== null && selected.size < requestedCount) {
    addUntilFull(Array.from({ length: requestedCount }, (_, index) => index + 1));
  }

  const result = [...selected].sort(compareBeamId);
  if (result.length === 0 && pairs.length > 0) {
    return [...new Set(pairIds)].sort(compareBeamId);
  }
  return result;
}

function metricRetentionKey(role: HomepageBeamMetricRole, key: CandidateLinkKey): string {
  return `${role}\u001f${candidateLinkKeyString(key)}`;
}

function previousMetricIndex(
  projection: HomepageBeamMetricsProjection | null | undefined,
): ReadonlyMap<string, HomepageBeamMetric> {
  const index = new Map<string, HomepageBeamMetric>();
  for (const metric of projection?.metrics ?? []) {
    const key = metricRetentionKey(metric.role, metric.key);
    if (!index.has(key)) index.set(key, metric);
  }
  return index;
}

function previousMetricPairIndex(
  projection: HomepageBeamMetricsProjection | null | undefined,
): ReadonlyMap<string, HomepageBeamMetric> {
  const index = new Map<string, HomepageBeamMetric>();
  for (const metric of projection?.metrics ?? []) {
    const key = candidateLinkKeyString(metric.key);
    if (!index.has(key)) index.set(key, metric);
  }
  return index;
}

function retainFiniteMetricValue(
  current: number | null,
  previous: number | null | undefined,
  allowed: boolean,
): number | null {
  const currentValue = finiteOrNull(current);
  if (currentValue !== null || !allowed) return currentValue;
  return finiteOrNull(previous);
}

function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function isHandoverStoryPhase(phase: string): boolean {
  return phase !== 'initial-attach' && phase !== 'monitoring';
}

/**
 * Keep the homepage's teaching comparison readable while the physical
 * producer is being consolidated. This is explicitly a display-only policy:
 * it consumes the already accepted story pair and never changes candidate
 * qualification, ranking, TTT, commit, or the source-frame evidence.
 *
 * The rule is intentionally small and deterministic:
 * - the current serving beam is the baseline;
 * - ordinary beams are capped below that baseline;
 * - an intra target, or an inter qualified candidate, is placed above it;
 * - the accepted target is the highest row in the current comparison.
 *
 * A bounded fallback is used only for an allowed handover row with no finite
 * display sample. It is marked with dedicated display-only provenance and is
 * not exposed as canonical scientific evidence.
 */
function applyHomepageEeHierarchyDisplayPolicy(
  drafts: readonly DraftMetric[],
  input: BuildHomepageBeamMetricsInput,
): readonly DraftMetric[] {
  if (input.eeDisplayPolicy !== 'handover-hierarchy') return drafts;

  const servingDraft = drafts.find(draft => draft.isPrimaryServing) ?? null;
  const servingEe = positiveFinite(servingDraft?.energyEfficiencyBitsPerJoule);
  // A missing serving sample remains fail-closed. The live primary-beam path
  // normally supplies it; do not invent a baseline when the serving identity
  // itself has no finite measurement.
  if (servingDraft === null || servingEe === null) return drafts;

  const story = input.snapshot === null
    ? null
    : projectHomepageHandoverStory({ snapshot: input.snapshot });
  const storyActive = story !== null && isHandoverStoryPhase(story.phase);
  const targetKey = storyActive ? story.target : null;
  const servingKey = servingDraft.key;
  const targetIsCurrentServing = targetKey !== null && sameCandidateLinkKey(targetKey, servingKey);
  const targetJoinKey = targetKey === null ? null : candidateLinkKeyString(targetKey);
  const baselinePowerW = positiveFinite(servingDraft.powerW) ?? 1;
  const baselineSinrDb = finiteOrNull(servingDraft.sinrDb) ?? 0;

  const isAllowedHighRow = (draft: DraftMetric): boolean => {
    if (!storyActive) return false;
    if (targetJoinKey !== null && candidateLinkKeyString(draft.key) === targetJoinKey) return true;
    return story?.kind === 'inter' && draft.role === 'candidate';
  };

  const rawAllowedHighEe = drafts
    .filter(isAllowedHighRow)
    .map(draft => positiveFinite(draft.energyEfficiencyBitsPerJoule))
    .filter((value): value is number => value !== null);
  const targetEe = targetKey !== null && !targetIsCurrentServing
    ? Math.min(
      servingEe * 1.45,
      Math.max(
        servingEe * 1.24,
        (rawAllowedHighEe.length > 0 ? Math.max(...rawAllowedHighEe) * 1.03 : servingEe * 1.34),
      ),
    )
    : null;
  let syntheticCandidateIndex = 0;

  return drafts.map(draft => {
    const rawEe = positiveFinite(draft.energyEfficiencyBitsPerJoule);
    const draftIsTarget = targetJoinKey !== null && candidateLinkKeyString(draft.key) === targetJoinKey;
    const allowedHigh = isAllowedHighRow(draft) && !draft.isPrimaryServing;
    let displayEe = rawEe;
    let synthetic = false;

    if (allowedHigh) {
      if (draftIsTarget && targetEe !== null) {
        displayEe = targetEe;
      } else {
        const candidateFloor = servingEe * 1.04;
        const candidateCap = targetEe === null ? servingEe * 1.2 : targetEe * 0.9;
        const candidateRaw = rawEe ?? (servingEe * (1.08 + syntheticCandidateIndex * 0.03));
        syntheticCandidateIndex += rawEe === null ? 1 : 0;
        displayEe = Math.min(Math.max(candidateRaw, candidateFloor), Math.max(candidateFloor, candidateCap));
      }
      synthetic = rawEe === null;
    } else if (!draft.isPrimaryServing && rawEe !== null && rawEe >= servingEe) {
      displayEe = servingEe * 0.94;
    }

    if (displayEe === null || !Number.isFinite(displayEe)) return draft;

    const changed = rawEe === null || Math.abs(displayEe - rawEe) > Math.max(1e-9, Math.abs(rawEe) * 1e-9);
    if (!changed) return draft;

    const powerW = positiveFinite(draft.powerW) ?? (synthetic ? baselinePowerW : null);
    const throughputBps = powerW === null
      ? draft.throughputBps
      : displayEe * powerW;
    const sinrDb = finiteOrNull(draft.sinrDb) ?? (synthetic ? baselineSinrDb : null);
    return {
      ...draft,
      availability: synthetic ? 'available' : draft.availability,
      sinrDb,
      powerW,
      throughputBps,
      energyEfficiencyBitsPerJoule: displayEe,
      eeBasis: HOMEPAGE_EE_HIERARCHY_BASIS,
      provenance: HOMEPAGE_EE_HIERARCHY_PROVENANCE,
      reason: synthetic ? null : draft.reason,
    };
  });
}

/**
 * The hierarchy policy is intentionally applied after the first raw-sample
 * projection, so its target/baseline adjustments must pass through the same
 * display filter once more. Otherwise an accepted-story phase change can
 * bypass the continuity guard and visibly teleport EE for one frame.
 */
function stabilizeHomepageDisplayDrafts(
  drafts: readonly DraftMetric[],
  input: BuildHomepageBeamMetricsInput,
): readonly DraftMetric[] {
  const previousByRoleAndKey = previousMetricIndex(input.previousMetrics);
  const previousByPair = previousMetricPairIndex(input.previousMetrics);
  return drafts.map(draft => {
    if (
      draft.sinrDb === null
      || draft.powerW === null
      || draft.throughputBps === null
      || draft.energyEfficiencyBitsPerJoule === null
    ) return draft;
    // The live homepage demo basis is already advanced through one bounded
    // trajectory in the cell model. Do not smooth that same value again when
    // the role/roster projection is finalized; a second pass is what made the
    // rail show a stale above-threshold source at the instant of handover.
    if (draft.eeBasis === HOMEPAGE_DEMO_EE_BASIS) return draft;
    const current: HomepageLiveMetricValues = {
      sinrDb: draft.sinrDb,
      powerW: draft.powerW,
      throughputBps: draft.throughputBps,
      energyEfficiencyBitsPerJoule: draft.energyEfficiencyBitsPerJoule,
    };
    const previous = previousByRoleAndKey.get(metricRetentionKey(draft.role, draft.key))
      // A handover changes a beam's display role from candidate/observed to
      // serving. Retain the same pair's last value across that role boundary;
      // otherwise the newly accepted service cold-starts from the target raw
      // sample and the service block shows a false one-frame jump.
      ?? previousByPair.get(candidateLinkKeyString(draft.key));
    if (
      previous === undefined
      || previous.sinrDb === null
      || previous.powerW === null
      || previous.throughputBps === null
      || previous.energyEfficiencyBitsPerJoule === null
    ) return draft;
    const stable = stabilizeHomepageMetricValues({
      current,
      previous,
      currentSimTimeSec: input.sourceFrame.simTimeSec,
      previousSimTimeSec: input.previousMetrics?.simTimeSec ?? null,
    });
    return {
      ...draft,
      sinrDb: stable.sinrDb,
      powerW: stable.powerW,
      throughputBps: stable.throughputBps,
      energyEfficiencyBitsPerJoule: stable.energyEfficiencyBitsPerJoule,
    };
  });
}

/**
 * Project one accepted source frame into immutable homepage beam metrics.
 *
 * Candidate opportunity/snapshot data contributes pair identity and admission
 * SINR evidence. Candidate role comes only from hard-eligible decision state or
 * an accepted snapshot link. Serving and candidate handover-story values come
 * from the same primary-UE angle-aware LinkSample contract: the active serving
 * sample on the serving side and the display probe on the candidate side.
 * Finite values are retained from the optional prior same-role projection only
 * when the current sample is omitted; they are never promoted to forecast-EE
 * evidence. Observed rows use the same four-value aggregate formula as a
 * fallback for legacy frames, and pass through the same display smoother so an
 * aggregate cannot teleport between adjacent published frames.
 */
export function buildHomepageBeamMetrics(
  input: BuildHomepageBeamMetricsInput,
): HomepageBeamMetricsProjection {
  if (input === null || typeof input !== 'object') fail('input must be an object');
  assertSourceFrameIdentity(input.sourceFrame, input.snapshot);

  const sourceFrame = input.sourceFrame;
  const frame = sourceFrame.frame;
  const snapshotId = input.snapshot?.snapshotId ?? null;
  const primaryServing = sourceFrame.serving;
  const pairByJoinKey = new Map<string, PairRecord>();
  const satelliteIds = new Set<string>();
  const candidateKeys = new Set<string>();
  const activeKeys = new Set<string>();
  const snapshotKeys = new Set<string>();
  const candidateSinrByKey = new Map<string, number | null>();
  const liveAggregates = new Map<string, LiveAggregate>();
  const snapshotBeamIdsBySatellite = new Map<string, number[]>();
  const cellFrame = frame.sinrLiveCells;
  const candidateProbesByKey = new Map<string, SinrLiveCandidateProbeEvidence>();
  const candidateProbeFieldPublished = cellFrame?.primaryCandidateProbeEvidence !== undefined;
  const primaryBeamMetricsByKey = new Map<string, SinrLivePrimaryBeamMetricEvidence>();
  const primaryBeamMetricFieldPublished = cellFrame?.primaryBeamMetricEvidence !== undefined;
  const previousMetricsByRoleAndKey = previousMetricIndex(input.previousMetrics);
  const previousMetricsByPair = previousMetricPairIndex(input.previousMetrics);
  const primaryServingRecord = cellFrame?.ues.find(record => record.ueId === sourceFrame.primaryUeId);
  const primaryServingSample = primaryServingRecord?.servingLinkSample ?? null;
  const primaryServingValues = (
    primaryServingSample !== null
    && primaryServing !== null
    && primaryServingSample.satId === primaryServing.satelliteId
    && primaryServingSample.beamId === primaryServing.beamId
  ) ? readAngleAwareMetricValues(primaryServingSample) : null;

  for (const [index, probe] of (cellFrame?.primaryCandidateProbeEvidence ?? []).entries()) {
    const label = `candidate probe[${index}]`;
    assertCandidateProbeFrame(probe, sourceFrame, label);
    const joinKey = candidateLinkKeyString(probe.key);
    if (candidateProbesByKey.has(joinKey)) fail(`${label} duplicate key ${joinKey}`);
    candidateProbesByKey.set(joinKey, probe);
  }

  for (const [index, evidence] of (cellFrame?.primaryBeamMetricEvidence ?? []).entries()) {
    const label = `primary beam metric[${index}]`;
    assertPrimaryBeamMetricFrame(evidence, sourceFrame, label);
    const joinKey = candidateLinkKeyString(evidence.key);
    if (primaryBeamMetricsByKey.has(joinKey)) fail(`${label} duplicate key ${joinKey}`);
    primaryBeamMetricsByKey.set(joinKey, evidence);
  }

  const addSatellite = (satelliteId: unknown): void => {
    if (isNonEmptyString(satelliteId)) satelliteIds.add(satelliteId);
  };

  const addPair = (
    satelliteId: unknown,
    beamId: unknown,
    flags: Partial<PairFlags> = {},
  ): string | null => {
    if (!isNonEmptyString(satelliteId) || !isBeamId(beamId)) return null;
    const key = candidateLinkKey(satelliteId, beamId);
    const joinKey = candidateLinkKeyString(key);
    satelliteIds.add(satelliteId);
    const existing = pairByJoinKey.get(joinKey);
    if (existing === undefined) {
      pairByJoinKey.set(joinKey, {
        key,
        primary: flags.primary === true,
        candidate: flags.candidate === true,
        active: flags.active === true,
        snapshot: flags.snapshot === true,
      });
    } else {
      existing.primary ||= flags.primary === true;
      existing.candidate ||= flags.candidate === true;
      existing.active ||= flags.active === true;
      existing.snapshot ||= flags.snapshot === true;
    }
    return joinKey;
  };

  const addConfiguredSnapshotBeam = (satelliteId: string, beamId: number): void => {
    const ids = snapshotBeamIdsBySatellite.get(satelliteId) ?? [];
    if (!ids.includes(beamId)) ids.push(beamId);
    snapshotBeamIdsBySatellite.set(satelliteId, ids);
  };

  const addDecisionPairs = (
    decision: HomepageSourceFrame['decision'] | null | undefined,
    label: string,
  ): void => {
    if (decision === null || decision === undefined) return;
    const hardEligibleKeys = new Set(
      decision.states
        .filter(state => state.hardEligibility === 'eligible')
        .map(state => candidateLinkKeyString(state.key)),
    );
    for (const [index, opportunity] of decision.opportunities.entries()) {
      assertCandidateOpportunityFrame(opportunity, sourceFrame.sourceFrameId, `${label} opportunity[${index}]`);
      const joinKey = addPair(
        opportunity.key.satelliteId,
        opportunity.key.beamId,
        { candidate: hardEligibleKeys.has(candidateLinkKeyString(opportunity.key)) },
      );
      if (joinKey === null) continue;
      if (hardEligibleKeys.has(joinKey)) candidateKeys.add(joinKey);
      const sinr = availableEvidenceValue(opportunity.sinr);
      if (sinr !== null) candidateSinrByKey.set(joinKey, sinr);
    }
  };

  if (primaryServing !== null) {
    addPair(primaryServing.satelliteId, primaryServing.beamId, { primary: true, active: true });
  }

  // A decision state is the source authority for hard eligibility. The
  // accepted snapshot may be the only decision-bearing object during a
  // publication bridge, so admit both canonical decision references without
  // creating a second decision.
  addDecisionPairs(sourceFrame.decision, 'source decision');
  addDecisionPairs(input.snapshot?.decision, 'snapshot decision');

  const opportunitySet = sourceFrame.opportunitySet;
  for (const opportunity of opportunitySet?.opportunities ?? []) {
    assertCandidateOpportunityFrame(opportunity, sourceFrame.sourceFrameId, 'candidate opportunity');
    const joinKey = addPair(opportunity.key.satelliteId, opportunity.key.beamId);
    if (joinKey === null) continue;
    const sinr = availableEvidenceValue(opportunity.sinr);
    if (sinr !== null) candidateSinrByKey.set(joinKey, sinr);
  }

  if (input.snapshot !== null) {
    for (const group of input.snapshot.plan.groups) {
      addSatellite(group.satelliteId);
      for (const rosterEntry of group.beamRoster) {
        if (!isBeamId(rosterEntry.beamId)) continue;
        addConfiguredSnapshotBeam(group.satelliteId, rosterEntry.beamId);
        addPair(group.satelliteId, rosterEntry.beamId, { snapshot: true });
        if (rosterEntry.link != null) {
          if (rosterEntry.link.sourceFrameId !== sourceFrame.sourceFrameId) {
            fail('snapshot roster link/sourceFrameId mismatch');
          }
          if (rosterEntry.link.opportunity !== null) {
            assertCandidateOpportunityFrame(
              rosterEntry.link.opportunity,
              sourceFrame.sourceFrameId,
              'snapshot roster opportunity',
            );
          }
          const joinKey = addPair(rosterEntry.link.satelliteId, rosterEntry.link.beamId, {
            snapshot: true,
            candidate: rosterEntry.link.isCandidate,
          });
          if (joinKey !== null) {
            snapshotKeys.add(joinKey);
            if (rosterEntry.link.isCandidate) candidateKeys.add(joinKey);
            const sinr = availableEvidenceValue(rosterEntry.link.opportunity?.sinr);
            if (sinr !== null) candidateSinrByKey.set(joinKey, sinr);
          }
        }
      }
    }

    for (const link of snapshotLinks(input.snapshot)) {
      if (link.sourceFrameId !== sourceFrame.sourceFrameId) {
        fail('snapshot link/sourceFrameId mismatch');
      }
      if (link.opportunity !== null) {
        assertCandidateOpportunityFrame(link.opportunity, sourceFrame.sourceFrameId, 'snapshot opportunity');
      }
      const joinKey = addPair(link.key.satelliteId, link.key.beamId, {
        snapshot: true,
        candidate: link.isCandidate,
      });
      if (joinKey === null) continue;
      snapshotKeys.add(joinKey);
      if (link.isCandidate) candidateKeys.add(joinKey);
      const sinr = availableEvidenceValue(link.opportunity?.sinr);
      if (sinr !== null) candidateSinrByKey.set(joinKey, sinr);
    }
  }

  // The cell frame is the targeted homepage active/illuminated surface. The
  // broad SimFrame active-assignment list can contain every scheduled beam in
  // the visible constellation when hopping is enabled, so only its known
  // homepage satellites are admitted below in that lane.
  for (const illuminated of frame.sinrLiveCells?.illuminatedBeams ?? []) {
    addSatellite(illuminated.satId);
    const beamId = resolveIlluminatedBeamId(
      illuminated.satId,
      illuminated.cellId,
      frame.beamCellsBySatId,
    );
    if (beamId !== null) addPair(illuminated.satId, beamId, { active: true });
  }

  for (const assignment of frame.displayAssignments ?? []) {
    addPair(assignment.satId, assignment.beamId, { active: true });
  }

  const homepageSatelliteIdsBeforeBroadAssignments = new Set(satelliteIds);
  for (const assignment of frame.activeAssignments ?? []) {
    if (
      frame.sinrLiveCells !== undefined
      && !homepageSatelliteIdsBeforeBroadAssignments.has(assignment.satId)
    ) continue;
    addPair(assignment.satId, assignment.beamId, { active: true });
  }

  for (const [satId, state] of frame.beamHopStatesBySatId ?? new Map()) {
    // `beamHopStatesBySatId` is a Map keyed by satellite id in SimFrame; keep
    // the key as the source identity rather than treating the Map tuple as a
    // state object.
    const isKnownHomepageSatellite = homepageSatelliteIdsBeforeBroadAssignments.has(satId);
    if (frame.sinrLiveCells !== undefined && !isKnownHomepageSatellite) continue;
    addSatellite(satId);
    for (const beamId of state.activeBeamIds ?? []) addPair(satId, beamId, { active: true });
    // Scheduler candidate ids are observed roster evidence, not a new
    // candidate decision. Candidate role comes only from the accepted/source
    // candidate opportunity or snapshot.
    for (const beamId of state.candidateBeamIds ?? []) addPair(satId, beamId);
  }

  for (const record of cellFrame?.ues ?? []) {
    const recordHasServingPair = isNonEmptyString(record.servingSatId)
      && isBeamId(record.servingBeamId);
    if (recordHasServingPair) {
      addPair(record.servingSatId, record.servingBeamId, { active: true });
    }

    const sample = record.servingLinkSample ?? null;
    if (
      sample === null
      || !isNonEmptyString(sample.satId)
      || !isBeamId(sample.beamId)
      || sample.angleAware === undefined
      || (isNonEmptyString(record.servingSatId) && sample.satId !== record.servingSatId)
      || (isBeamId(record.servingBeamId) && sample.beamId !== record.servingBeamId)
    ) continue;

    const sampleJoinKey = addPair(sample.satId, sample.beamId, { active: true });
    if (sampleJoinKey === null) continue;
    const terms = sample.angleAware;
    const aggregate = liveAggregates.get(sampleJoinKey) ?? {
      throughputBps: [],
      powerW: [],
      sinrDb: [],
      systemPowerW: [],
    };
    const throughput = finiteOrNull(terms.throughputBps);
    // `powerConsumptionW` is the accepted beam-level supply power P^p_(s,v),
    // already formed from the physical-beam RF maximum and xi. `systemPowerW`
    // is a frame-wide P^N total and would be double-counted when several UEs
    // share this exact sat/beam aggregate.
    const power = finiteOrNull(terms.powerConsumptionW);
    const systemPower = finiteOrNull(terms.systemPowerW);
    const sinr = finiteOrNull(terms.gammaDb) ?? finiteOrNull(sample.sinrDb);
    if (throughput !== null) aggregate.throughputBps.push(throughput);
    if (power !== null) aggregate.powerW.push(power);
    if (sinr !== null) aggregate.sinrDb.push(sinr);
    if (systemPower !== null) aggregate.systemPowerW.push(systemPower);
    liveAggregates.set(sampleJoinKey, aggregate);
  }

  // Primary-beam evidence is the display roster authority for the focused
  // homepage cell. Keep its identities even when the generic SimFrame beam map
  // is sparse (which is expected in the one-cell live lane); otherwise the
  // model can measure B2..B7 but the rail has no pair to render them under.
  for (const evidence of cellFrame?.primaryBeamMetricEvidence ?? []) {
    addPair(evidence.key.satelliteId, evidence.key.beamId);
  }

  for (const [joinKey, pair] of pairByJoinKey) {
    if (pair.active) activeKeys.add(joinKey);
    if (pair.candidate) candidateKeys.add(joinKey);
    if (pair.snapshot) snapshotKeys.add(joinKey);
  }

  const relevantSatelliteIds = [...satelliteIds].sort(compareSatelliteId);
  const pairsBySatellite = new Map<string, PairRecord[]>();
  for (const pair of pairByJoinKey.values()) {
    const pairs = pairsBySatellite.get(pair.key.satelliteId) ?? [];
    pairs.push(pair);
    pairsBySatellite.set(pair.key.satelliteId, pairs);
  }

  const allRosterPairs = new Map<string, PairRecord>();
  for (const satelliteId of relevantSatelliteIds) {
    const sourcePairs = pairsBySatellite.get(satelliteId) ?? [];
    const configuredIds = configuredBeamIds(satelliteId, sourceFrame, snapshotBeamIdsBySatellite);
    const configuredOverride = input.beamCountBySatellite?.[satelliteId];
    const roleCount = satelliteId === primaryServing?.satelliteId
      ? input.physicalServingBeamCount ?? input.servingBeamCount
      : input.physicalCandidateBeamCount ?? input.candidateBeamCount;
    const requestedCount = usableCount(configuredOverride) ?? usableCount(roleCount);
    const beamIds = rosterBeamIds(sourcePairs, configuredIds, requestedCount);
    for (const beamId of beamIds) {
      const joinKey = candidateLinkKeyString(candidateLinkKey(satelliteId, beamId));
      const pair = pairByJoinKey.get(joinKey);
      if (pair !== undefined) {
        allRosterPairs.set(joinKey, pair);
        continue;
      }
      const rosterPair: PairRecord = {
        key: candidateLinkKey(satelliteId, beamId),
        primary: primaryServing?.satelliteId === satelliteId && primaryServing.beamId === beamId,
        candidate: candidateKeys.has(joinKey),
        active: activeKeys.has(joinKey),
        snapshot: snapshotKeys.has(joinKey),
      };
      allRosterPairs.set(joinKey, rosterPair);
    }
  }

  const orderedPairs = [...allRosterPairs.values()].sort((left, right) => {
    const satelliteOrder = compareSatelliteId(left.key.satelliteId, right.key.satelliteId);
    if (satelliteOrder !== 0) return satelliteOrder;
    return comparePairRecord(left, right);
  });
  orderedPairs.sort((left, right) => {
    const leftIsPrimary = primaryServing !== null
      && left.key.satelliteId === primaryServing.satelliteId
      && left.key.beamId === primaryServing.beamId;
    const rightIsPrimary = primaryServing !== null
      && right.key.satelliteId === primaryServing.satelliteId
      && right.key.beamId === primaryServing.beamId;
    if (leftIsPrimary !== rightIsPrimary) return leftIsPrimary ? -1 : 1;
    const satelliteOrder = compareSatelliteId(left.key.satelliteId, right.key.satelliteId);
    if (satelliteOrder !== 0) return satelliteOrder;
    return comparePairRecord(left, right);
  });

  const rawDrafts: DraftMetric[] = orderedPairs.map(pair => {
    const joinKey = candidateLinkKeyString(pair.key);
    const isPrimaryServing = primaryServing !== null
      && pair.key.satelliteId === primaryServing.satelliteId
      && pair.key.beamId === primaryServing.beamId;
    const role: HomepageBeamMetricRole = isPrimaryServing
      ? 'serving'
      : candidateKeys.has(joinKey)
        ? 'candidate'
        : 'observed';
    const aggregate = liveAggregates.get(joinKey);
    const aggregateThroughputBps = sumFinite(aggregate?.throughputBps ?? []);
    // One physical beam supply must not be added once per UE. The canonical
    // model publishes the same beam supply on each sample, so the maximum is
    // the beam-level P^p_(s,v) readout and remains stable if a frame has more
    // than one UE on that beam.
    const aggregateBeamPowerW = maxFinite(aggregate?.powerW ?? []);
    // Every story/observed EE row uses the same frame-level denominator. This
    // is the critical distinction from the old observed path, which divided by
    // a sum of per-UE beam powers while serving/candidate rows used P_sys.
    const aggregateSystemPowerW = maxFinite(aggregate?.systemPowerW ?? [])
      ?? aggregateBeamPowerW;
    const aggregateSinrDb = meanFinite(aggregate?.sinrDb ?? []);
    const hasLiveTerms = aggregate !== undefined && (
      aggregate.throughputBps.length > 0
      || aggregate.powerW.length > 0
      || aggregate.systemPowerW.length > 0
    );
    const aggregateHasPositivePower = aggregateSystemPowerW !== null && aggregateSystemPowerW > 0;
    const aggregateEe = (
      aggregateThroughputBps !== null
      && aggregateHasPositivePower
      && Number.isFinite(aggregateThroughputBps / aggregateSystemPowerW)
    ) ? aggregateThroughputBps / aggregateSystemPowerW : null;
    const candidateProbe = role === 'candidate' ? candidateProbesByKey.get(joinKey) : undefined;
    const candidateProbeValues = readCandidateProbeMetricValues(candidateProbe);
    // Older hand-authored fixtures predate the probe field. Keep their active
    // aggregate readout compatible. Once the field is published, an absent or
    // unavailable probe is still fail-closed for new values, but an existing
    // same-role value remains the last detected value instead of going blank.
    const legacySinrDb = aggregateSinrDb ?? candidateSinrByKey.get(joinKey) ?? null;
    const legacyCandidateValues = role === 'candidate'
      && !candidateProbeFieldPublished
      && aggregateEe !== null
      && aggregateThroughputBps !== null
      && aggregateBeamPowerW !== null
      && legacySinrDb !== null
      ? {
        sinrDb: legacySinrDb,
        powerW: aggregateBeamPowerW,
        throughputBps: aggregateThroughputBps,
        energyEfficiencyBitsPerJoule: aggregateEe,
      }
      : null;
    const primaryBeamMetric = primaryBeamMetricsByKey.get(joinKey);
    const primaryBeamMetricValues = readPrimaryBeamMetricValues(primaryBeamMetric);
    // B1 is normally supplied by the candidate probe. B2..B7 on a candidate
    // satellite are display-only primary-beam evidence, so keep that evidence
    // visible instead of turning the row into an empty card.
    const candidateValues = candidateProbeValues ?? primaryBeamMetricValues ?? legacyCandidateValues;
    const aggregateValues = aggregateEe !== null
      && aggregateThroughputBps !== null
      && aggregateBeamPowerW !== null
      && aggregateSinrDb !== null
      ? {
        sinrDb: aggregateSinrDb,
        powerW: aggregateBeamPowerW,
        throughputBps: aggregateThroughputBps,
        energyEfficiencyBitsPerJoule: aggregateEe,
      }
      : null;
    const observedValues = primaryBeamMetricFieldPublished
      ? primaryBeamMetricValues
      : aggregateValues;
    const rawStoryValues = role === 'candidate'
      ? candidateValues
      : role === 'serving'
        ? primaryServingValues
        : observedValues;
    const previousMetric = previousMetricsByRoleAndKey.get(metricRetentionKey(role, pair.key))
      // The same physical pair legitimately changes from candidate to serving
      // at commit. Use its prior accepted metric as the continuity baseline,
      // instead of making the service row read the target's cold-start value.
      ?? previousMetricsByPair.get(joinKey);
    const storySample = role === 'candidate'
      ? candidateProbe?.sample ?? primaryBeamMetric?.sample
      : role === 'serving'
        ? primaryServingSample
        : primaryBeamMetric?.sample;
    const usesHomepageDemoEe = (
      storySample?.angleAware?.homepageDemoEeBitsPerJoule !== undefined
      || previousMetric?.eeBasis === HOMEPAGE_DEMO_EE_BASIS
    );
    // Do not smear a pre-bounded raw value (for example the old 49 Kbit/J
    // source frame) into the new homepage basis during hot reload/state
    // migration. The next bounded sample is the correct new baseline.
    const previousForStability = usesHomepageDemoEe
      && previousMetric?.eeBasis !== HOMEPAGE_DEMO_EE_BASIS
      ? null
      : previousMetric;
    // `homepageDemoEe` is already the single rate-limited homepage trajectory
    // produced by the live decision lane. Applying the generic rail smoother a
    // second time makes the displayed serving EE lag behind the value that
    // actually crossed the threshold (for example showing 151 while the
    // authority had already crossed below 135). Keep legacy/raw fixtures on
    // the existing continuity filter, but never create a second clock for the
    // homepage demo basis.
    const storyValues: HomepageLiveMetricValues | null = rawStoryValues === null
      ? null
      : usesHomepageDemoEe
        ? rawStoryValues
        : stabilizeHomepageMetricValues({
          current: rawStoryValues,
          previous: previousForStability ?? null,
          currentSimTimeSec: sourceFrame.simTimeSec,
          previousSimTimeSec: input.previousMetrics?.simTimeSec ?? null,
        });
    const currentThroughputBps = storyValues?.throughputBps
      ?? null;
    const currentPowerW = storyValues?.powerW
      ?? null;
    const currentSinrDb = storyValues?.sinrDb
      ?? (role === 'candidate' ? candidateSinrByKey.get(joinKey) ?? null : null);
    const currentEnergyEfficiencyBitsPerJoule = storyValues?.energyEfficiencyBitsPerJoule
      ?? null;
    // A missing or invalid sample retains the last detected value for the same
    // role and pair on the shared continuous timeline. This includes an
    // observed configured beam: its identity remains stable even when the
    // current frame has no UE sample for that beam.
    const canRetainPreviousValues = hasContinuousHomepageMetricTimeline(
      sourceFrame.simTimeSec,
      input.previousMetrics?.simTimeSec ?? null,
    ) && previousMetric?.availability === 'available';
    const throughputBps = retainFiniteMetricValue(
      currentThroughputBps,
      previousMetric?.throughputBps,
      canRetainPreviousValues,
    );
    const powerW = retainFiniteMetricValue(
      currentPowerW,
      previousMetric?.powerW,
      canRetainPreviousValues,
    );
    const sinrDb = retainFiniteMetricValue(
      currentSinrDb,
      previousMetric?.sinrDb,
      canRetainPreviousValues,
    );
    const energyEfficiencyBitsPerJoule = retainFiniteMetricValue(
      currentEnergyEfficiencyBitsPerJoule,
      previousMetric?.energyEfficiencyBitsPerJoule,
      canRetainPreviousValues,
    );
    const candidateValuesAreFinite = role === 'candidate'
      && sinrDb !== null
      && powerW !== null
      && throughputBps !== null
      && energyEfficiencyBitsPerJoule !== null;

    let availability: HomepageBeamMetric['availability'];
    let reason: string | null = null;
    let provenance: HomepageBeamMetric['provenance'];
    if (role === 'candidate' && candidateValuesAreFinite) {
      availability = 'available';
      provenance = usesHomepageDemoEe
        ? HOMEPAGE_DEMO_EE_PROVENANCE
        : candidateValues !== null
        ? candidateProbeValues !== null
          ? SINR_LIVE_CANDIDATE_PROBE_PROVENANCE
          : primaryBeamMetricValues !== null
            ? SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE
            : legacyCandidateValues !== null
              ? 'active-assignment-angle-aware'
              : previousMetric?.provenance ?? 'not-available'
        : previousMetric?.provenance ?? 'not-available';
    } else if (role === 'candidate') {
      availability = 'unavailable';
      reason = candidateProbe?.reason ?? primaryBeamMetric?.reason ?? CANDIDATE_PROBE_UNAVAILABLE_REASON;
      provenance = candidateProbe === undefined && primaryBeamMetric === undefined
        ? 'not-available'
        : candidateProbe !== undefined
          ? SINR_LIVE_CANDIDATE_PROBE_PROVENANCE
          : SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE;
    } else if (energyEfficiencyBitsPerJoule !== null) {
      availability = 'available';
      provenance = usesHomepageDemoEe
        ? HOMEPAGE_DEMO_EE_PROVENANCE
        : primaryBeamMetricFieldPublished
        ? SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE
        : 'active-assignment-angle-aware';
    } else if (isPrimaryServing && !hasLiveTerms) {
      availability = 'unavailable';
      reason = SERVING_SAMPLE_UNAVAILABLE_REASON;
      provenance = 'not-available';
    } else if (pair.active || hasLiveTerms) {
      availability = 'unavailable';
      reason = ACTIVE_SAMPLE_UNAVAILABLE_REASON;
      provenance = 'not-available';
    } else {
      availability = 'idle';
      reason = IDLE_BEAM_REASON;
      provenance = 'not-available';
    }

    return {
      key: pair.key,
      joinKey,
      sourceFrameId: sourceFrame.sourceFrameId,
      snapshotId,
      satelliteId: pair.key.satelliteId,
      beamId: pair.key.beamId,
      role,
      availability,
      sinrDb,
      powerW,
      throughputBps,
      energyEfficiencyBitsPerJoule,
      eeNormalized: null,
      eeBasis: role === 'candidate' && candidateValuesAreFinite
        ? usesHomepageDemoEe
          ? HOMEPAGE_DEMO_EE_BASIS
          : candidateValues !== null
          ? candidateProbeValues !== null
            ? 'candidate-probe'
            : primaryBeamMetricValues !== null
              ? 'primary-beam-display'
              : legacyCandidateValues !== null
                ? 'active-assignment'
                : previousMetric?.eeBasis ?? 'not-available'
          : previousMetric?.eeBasis ?? 'not-available'
        : energyEfficiencyBitsPerJoule === null
          ? 'not-available'
          : usesHomepageDemoEe
            ? HOMEPAGE_DEMO_EE_BASIS
            : primaryBeamMetricFieldPublished
            ? 'primary-beam-display'
            : 'active-assignment',
      provenance,
      reason,
      isPrimaryServing,
    };
  });

  const drafts = stabilizeHomepageDisplayDrafts(
    applyHomepageEeHierarchyDisplayPolicy(
      fillHomepageRosterMetricGaps(rawDrafts, input),
      input,
    ),
    input,
  );
  const availableEe = drafts
    .filter(draft => draft.availability === 'available')
    .map(draft => draft.energyEfficiencyBitsPerJoule)
    .filter((ee): ee is number => ee !== null && Number.isFinite(ee));
  const availableEeMinBitsPerJoule = availableEe.length > 0 ? Math.min(...availableEe) : null;
  const availableEeMaxBitsPerJoule = availableEe.length > 0 ? Math.max(...availableEe) : null;

  const metrics: readonly HomepageBeamMetric[] = Object.freeze(drafts.map(draft => Object.freeze({
    ...draft,
    // The accepted snapshot owns episode-stable satellite reservations. Feed
    // that slot into the compact homepage palette so a candidate keeps the
    // same hue when it becomes serving; the ID hash is only a fixture/source
    // fallback when no accepted allocation exists.
    eeNormalized: draft.energyEfficiencyBitsPerJoule === null
      ? null
      : homepageEeColorNormalized(draft.energyEfficiencyBitsPerJoule),
    color: homepageSatelliteColorForBeam(draft.satelliteId, draft.beamId, {
      identityPaletteIndex: input.snapshot?.plan.identityAllocation?.assignments[draft.satelliteId]?.paletteIndex ?? null,
      // A candidate's primary beam is already the identity carrier for the
      // upcoming link. Keep it on the same primary visual tier before and
      // after commit; `role` remains the decision truth, while this flag is
      // only the stable homepage shade treatment.
      isServing: draft.isPrimaryServing || draft.role === 'candidate',
      eeNormalized: homepageEeColorNormalized(draft.energyEfficiencyBitsPerJoule),
    }),
  })));

  return Object.freeze({
    sourceFrameId: sourceFrame.sourceFrameId,
    snapshotId,
    simTimeSec: sourceFrame.simTimeSec,
    metrics,
    availableEeMinBitsPerJoule,
    availableEeMaxBitsPerJoule,
  });
}
