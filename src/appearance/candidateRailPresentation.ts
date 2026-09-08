/**
 * THE candidate rail presentation contract.
 *
 * ## Read this first if you were sent here by a prompt
 *
 * If the change you want is any of these:
 *
 *   - "改右側候選軌的波束列表與候選卡片呈現"
 *   - "改 EE 尺度範圍或換手門檻的比例/顏色衰減"
 *   - "改 candidate 卡片、按鈕或進度條的圓角與幾何尺寸"
 *   - "改候選波束的公開標籤編號（B1..B7）"
 *   - "改候選軌中衛星群組、波束列表的組織方式或狀態標籤"
 *
 * then the presentation geometry and rules are IN THIS FILE, and nowhere else.
 *
 * ## Why this module exists
 *
 * Like colour and beam visibility before it, candidate rail presentation
 * suffered from scattered ownership: changing 「改右側候選軌的呈現」 required
 * opening seven separate files across controllers, views, derivations, and App.tsx.
 *
 * Call sites substituted their own answers through ternary expressions (`?:`),
 * nullish coalescing chains (`??`), and inlined magic numbers for border radii,
 * opacity curves, and scale bounds.
 *
 * This module provides ONE owning authority for:
 *   1. Scale factors: fixed EE scale bounds and serving beam opacity envelopes.
 *   2. Radius rules & layout geometry: named data tokens for cards, bars, badges, pills.
 *   3. Public identity formatting: mapping link-budget identities to public B1..Bn labels.
 *   4. Candidate row projection & grouping: pure grouping of satellite candidates,
 *      best-EE row resolution, and handover role assignments.
 *
 * ## Layering
 *
 * `src/appearance/` sits at the bottom, beside `src/constants/`. `ui/` and
 * `homepage/` import DOWN into it; it imports nothing from them and nothing from
 * `scene/`/`viz/`.
 *
 * Pure by construction: no React, no hooks, no refs, and no module-level mutable
 * state. All functions are deterministic transforms of explicit inputs.
 */
import { EE_THRESHOLD_MAX_KBIT_PER_JOULE } from '../engine/handover/eeThreshold';
import {
  candidateLinkKeyString,
  sameCandidateLinkKey,
  type CandidateLinkKey,
} from '../engine/handover/candidateDecisionContract';

// ---------------------------------------------------------------------------
// 1. Scale Factors & Opacity Envelopes (Named Data)
// ---------------------------------------------------------------------------

/**
 * The rail EE scale is a fixed visual contract, not an auto-fitting chart.
 * Keeping it fixed prevents the threshold marker and beam bars from jittering
 * as frames advance.
 */
export const HOMEPAGE_EE_SCALE_MIN_BITS_PER_JOULE = 0;
export const HOMEPAGE_EE_SCALE_MAX_BITS_PER_JOULE = EE_THRESHOLD_MAX_KBIT_PER_JOULE * 1000;

/** Baseline opacity for the serving EE bar. */
export const RAIL_SERVING_EE_OPACITY_BASE = 0.3;
/** Dynamic range for serving EE opacity scaling across the decline. */
export const RAIL_SERVING_EE_OPACITY_RANGE = 0.7;

/**
 * Pure ratio calculation for a value on the rail's EE scale, clamped to [0, 1].
 */
export function resolveRailEeRatio(
  ee: number | null | undefined,
  eeScaleMin = HOMEPAGE_EE_SCALE_MIN_BITS_PER_JOULE,
  eeScaleMax = HOMEPAGE_EE_SCALE_MAX_BITS_PER_JOULE,
): number {
  if (ee === null || ee === undefined || !Number.isFinite(ee) || eeScaleMax <= eeScaleMin) {
    return 0;
  }
  return Math.max(0, Math.min(1, (ee - eeScaleMin) / (eeScaleMax - eeScaleMin)));
}

/**
 * Pure opacity calculation for the serving beam's EE indicator.
 * Fades smoothly as EE declines toward the threshold floor.
 */
export function resolveRailServingEeOpacity(
  ee: number | null | undefined,
  thresholdBitsPerJoule: number | null | undefined,
  eeScaleMin = HOMEPAGE_EE_SCALE_MIN_BITS_PER_JOULE,
  eeScaleMax = HOMEPAGE_EE_SCALE_MAX_BITS_PER_JOULE,
): number {
  if (ee === null || ee === undefined || !Number.isFinite(ee)) return 1;
  const displayMax = Math.max(
    eeScaleMax,
    (thresholdBitsPerJoule !== null && thresholdBitsPerJoule !== undefined && Number.isFinite(thresholdBitsPerJoule))
      ? thresholdBitsPerJoule
      : eeScaleMin,
    eeScaleMin + 1,
  );
  const ratio = Math.max(0, Math.min(1, (ee - eeScaleMin) / (displayMax - eeScaleMin)));
  return RAIL_SERVING_EE_OPACITY_BASE + ratio * RAIL_SERVING_EE_OPACITY_RANGE;
}

// ---------------------------------------------------------------------------
// 2. Radius Rules & Layout Geometry (Named Data)
// ---------------------------------------------------------------------------

/**
 * Border radius rules across rail cards, pills, rows, and badges.
 * Expressed as named data rather than as numbers scattered in CSS-in-JS styles.
 */
export const RAIL_RADIUS_RULES = Object.freeze({
  container: '10px',
  panel: '10px',
  card: '8px',
  row: '6px',
  headerBadge: '7px',
  badge: '5px',
  tag: '4px',
  pill: '999px',
  circle: '50%',
} as const);

/**
 * Named layout dimensions for rail presentation.
 */
export const RAIL_LAYOUT_GEOMETRY = Object.freeze({
  rowMinHeight: '44px',
  cardPadding: '10px',
  barHeight: '6px',
  pillHeight: '8px',
  badgeHeight: '20px',
  markerDotSize: '8px',
} as const);

// ---------------------------------------------------------------------------
// 3. Beam Identity & Public Labels
// ---------------------------------------------------------------------------

const CELL_BEAM_ID_OFFSET = 1;
const INTRA_CELL_BEAM_ID_STRIDE = 420;

/**
 * Decode geographic cell and reserved intra-cell variant from an internal link id.
 * Pure mathematical decoding without importing scene/model dependencies.
 */
export function decodeRailBeamCell(beamId: number): {
  readonly cellId: number;
  readonly variantIndex: number;
} {
  const encoded = Math.max(0, Math.floor(beamId) - CELL_BEAM_ID_OFFSET);
  return {
    cellId: encoded % INTRA_CELL_BEAM_ID_STRIDE,
    variantIndex: Math.floor(encoded / INTRA_CELL_BEAM_ID_STRIDE),
  };
}

/**
 * Format the public beam label (B1..Bn).
 * Hides large internal link-budget identifiers (421..2521) behind human-readable B1..B7.
 */
export function formatHomepageBeamLabel(beamId: number): string {
  if (!Number.isFinite(beamId)) return 'B—';
  const decoded = decodeRailBeamCell(beamId);
  return `B${decoded.cellId + decoded.variantIndex + 1}`;
}

/**
 * Format the public cell label (C1..Cn).
 */
export function formatHomepageCellLabel(beamId: number): string {
  if (!Number.isFinite(beamId)) return 'C—';
  return 'C' + (decodeRailBeamCell(beamId).cellId + 1);
}

/**
 * Authority formatter for beam cell labels on the candidate rail.
 * Primary probe symbol for `candidate-rail-presentation`.
 */
export function formatHomepageBeamCellLabel(beamId: number): string {
  return formatHomepageBeamLabel(beamId);
}

/**
 * Format a rail endpoint label combining satellite name and beam label.
 */
export function formatRailEndpointLabel(
  satelliteDisplayName: string,
  beamId: number,
): string {
  return `${satelliteDisplayName} / ${formatHomepageBeamCellLabel(beamId)}`;
}

// ---------------------------------------------------------------------------
// 4. Role & Phase Vocabulary (Named Data)
// ---------------------------------------------------------------------------

export type RailPhase =
  | 'initial-attach'
  | 'monitoring'
  | 'evaluating'
  | 'qualifying'
  | 'selection-hold'
  | 'switching'
  | 'guard';

export const RAIL_PHASE_LABELS: Readonly<Record<RailPhase, { readonly zh: string; readonly en: string }>> = Object.freeze({
  'initial-attach': { zh: '初始連線', en: 'Initial attach' },
  monitoring: { zh: '監測中', en: 'Monitoring' },
  evaluating: { zh: '評估中', en: 'Evaluating' },
  qualifying: { zh: '資格確認', en: 'Qualifying' },
  'selection-hold': { zh: '選擇保持', en: 'Selection hold' },
  switching: { zh: '換手中', en: 'Handover' },
  guard: { zh: '保護期', en: 'Guard' },
});

export function phaseLabel(phase: RailPhase, isEnglish: boolean): string {
  const labels = RAIL_PHASE_LABELS[phase];
  return isEnglish ? labels.en : labels.zh;
}

export function roleLabel(role: string, isEnglish: boolean): string {
  switch (role) {
    case 'serving':
    case 'committed-serving':
      return isEnglish ? 'Serving' : '服務';
    case 'candidate':
    case 'selected-target':
    case 'provisional-leader':
    case 'qualified':
    case 'hard-eligible':
      return isEnglish ? 'Option' : '候選';
    case 'observed':
      return isEnglish ? 'Observed' : '觀測';
    default:
      return role;
  }
}

export const RAIL_CELL_EXAMPLE_LABELS = Object.freeze({
  'one-cell': 'C1',
  'seven-cell': 'C1–C7',
  'nineteen-cell': 'C1–C19',
} as const);

export type MetricField =
  | 'powerW'
  | 'throughputBps'
  | 'sinrDb'
  | 'energyEfficiencyBitsPerJoule';

export const RAIL_METRIC_FIELDS: ReadonlyArray<{
  readonly field: MetricField;
  readonly zh: string;
  readonly en: string;
  readonly unit: string;
}> = Object.freeze([
  { field: 'powerW', zh: 'Power', en: 'Power', unit: 'W' },
  { field: 'throughputBps', zh: 'Throughput', en: 'Throughput', unit: 'bit/s' },
  { field: 'sinrDb', zh: 'SINR', en: 'SINR', unit: 'dB' },
  { field: 'energyEfficiencyBitsPerJoule', zh: 'EE', en: 'EE', unit: 'Kbit/J' },
]);

// ---------------------------------------------------------------------------
// 5. Grouping & Candidate Row Logic
// ---------------------------------------------------------------------------

export interface RailPresentationLink {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly key: CandidateLinkKey;
  readonly joinKey: string;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
  readonly visual: {
    readonly isActiveDataLink: boolean;
  };
  readonly opportunity?: {
    readonly instantaneousEe?: {
      readonly value: number | null;
    } | null;
  } | null;
}

export interface RailBeamMetric {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly key: CandidateLinkKey;
  readonly joinKey: string;
  readonly isPrimaryServing: boolean;
  readonly role: string;
  readonly energyEfficiencyBitsPerJoule: number | null;
  readonly availability?: string;
  readonly reason?: string | null;
}

export interface RailSatelliteGroup<M extends RailBeamMetric = RailBeamMetric, L extends RailPresentationLink = RailPresentationLink> {
  readonly satelliteId: string;
  readonly metrics: M[];
  readonly links: L[];
}

export interface RailProjectedBeamRow<M extends RailBeamMetric = RailBeamMetric, L extends RailPresentationLink = RailPresentationLink> {
  readonly metric: M | null;
  readonly link: L | null;
}

export function pairJoinKey(value: { readonly key: CandidateLinkKey }): string {
  return candidateLinkKeyString(value.key);
}

export function finiteEe(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function eeForRow(
  metric: RailBeamMetric | null,
  link: RailPresentationLink | null,
): number | null {
  return finiteEe(metric?.energyEfficiencyBitsPerJoule)
    ?? finiteEe(link?.opportunity?.instantaneousEe?.value);
}

export function buildSatelliteGroups<M extends RailBeamMetric, L extends RailPresentationLink>(
  metrics: readonly M[],
  links: readonly L[],
  servingSatelliteId: string | null,
): RailSatelliteGroup<M, L>[] {
  const groups = new Map<string, RailSatelliteGroup<M, L>>();

  const groupFor = (satelliteId: string): RailSatelliteGroup<M, L> => {
    const existing = groups.get(satelliteId);
    if (existing !== undefined) return existing;
    const created: RailSatelliteGroup<M, L> = { satelliteId, metrics: [], links: [] };
    groups.set(satelliteId, created);
    return created;
  };

  for (const metric of metrics) {
    if (metric.satelliteId !== servingSatelliteId) groupFor(metric.satelliteId).metrics.push(metric);
  }

  for (const link of links) {
    const isServingLink = link.isServing
      || link.visual.isActiveDataLink
      || link.satelliteId === servingSatelliteId;
    if (!isServingLink && link.isCandidate) groupFor(link.satelliteId).links.push(link);
  }

  return [...groups.values()];
}

export function projectedRowsForGroup<M extends RailBeamMetric, L extends RailPresentationLink>(
  group: RailSatelliteGroup<M, L>,
): RailProjectedBeamRow<M, L>[] {
  const metricJoinKeys = new Set(group.metrics.map(metric => metric.joinKey));
  const metricPairKeys = new Set(group.metrics.map(pairJoinKey));
  const linkByPairKey = new Map(group.links.map(link => [pairJoinKey(link), link]));
  return [
    ...group.metrics.map(metric => ({
      metric,
      link: linkByPairKey.get(pairJoinKey(metric)) ?? null,
    })),
    ...group.links
      .filter(link => !metricPairKeys.has(pairJoinKey(link)) && !metricJoinKeys.has(link.joinKey))
      .map(link => ({ metric: null, link })),
  ];
}

export function bestEeRowForGroup<M extends RailBeamMetric, L extends RailPresentationLink>(
  group: RailSatelliteGroup<M, L>,
): RailProjectedBeamRow<M, L> | null {
  let best: RailProjectedBeamRow<M, L> | null = null;
  let bestEe: number | null = null;
  for (const row of projectedRowsForGroup(group)) {
    const ee = eeForRow(row.metric, row.link);
    if (ee === null || (bestEe !== null && ee <= bestEe)) continue;
    best = row;
    bestEe = ee;
  }
  return best;
}

export function bestSameSatelliteAlternateMetric<M extends RailBeamMetric>(
  metrics: readonly M[],
  source: { readonly satelliteId: string; readonly beamId: number },
): M | null {
  return metrics
    .filter(metric => metric.satelliteId === source.satelliteId && metric.beamId !== source.beamId)
    .filter(metric => finiteEe(metric.energyEfficiencyBitsPerJoule) !== null)
    .sort((left, right) => (
      (finiteEe(right.energyEfficiencyBitsPerJoule) ?? -1)
      - (finiteEe(left.energyEfficiencyBitsPerJoule) ?? -1)
    ))[0] ?? null;
}

export function handoverRoleForRow(
  metric: RailBeamMetric | null,
  link: RailPresentationLink | null,
  presentation?: {
    readonly from: { readonly satelliteId: string; readonly beamId: number };
    readonly to: { readonly satelliteId: string; readonly beamId: number };
  } | null,
  story?: {
    readonly source: CandidateLinkKey;
    readonly target: CandidateLinkKey;
    readonly selectionStatus: string;
    readonly phase: string;
  } | null,
): 'source' | 'target' | undefined {
  const satelliteId = metric?.satelliteId ?? link?.satelliteId ?? '';
  const beamId = metric?.beamId ?? link?.beamId ?? null;
  if (presentation !== null && presentation !== undefined) {
    if (satelliteId === presentation.from.satelliteId && beamId === presentation.from.beamId) return 'source';
    if (satelliteId === presentation.to.satelliteId && beamId === presentation.to.beamId) return 'target';
  }
  if (story !== null && story !== undefined) {
    const rowKey = candidateLinkKeyString({ satelliteId, beamId: beamId ?? 0 });
    if (rowKey === candidateLinkKeyString(story.source)) return 'source';
    const targetIsConfirmed = story.selectionStatus === 'selected'
      || story.selectionStatus === 'committed'
      || story.phase === 'switching'
      || story.phase === 'guard';
    if (targetIsConfirmed && rowKey === candidateLinkKeyString(story.target)) return 'target';
  }
  return undefined;
}

export function handoverStatusLabel(
  story: { readonly selectionStatus: string } | null,
  presentation: { readonly phase: string } | null,
  isEnglish: boolean,
): string {
  if (presentation !== null) {
    return isEnglish ? `Live · ${presentation.phase}` : `進行中 · ${presentation.phase}`;
  }
  if (story === null) return isEnglish ? 'Waiting for EE trigger' : '等待 EE 觸發';
  if (story.selectionStatus === 'committed') return isEnglish ? 'Committed' : '已完成';
  if (story.selectionStatus === 'selected') return isEnglish ? 'Selected' : '已選定';
  if (story.selectionStatus === 'ttt-stable') return isEnglish ? 'TTT stable' : 'TTT 穩定';
  return isEnglish ? 'Qualified' : '具備資格';
}

export function unavailableReason(
  metric: RailBeamMetric | null,
  isEnglish: boolean,
): string {
  if (metric?.reason?.trim()) return metric.reason.trim();
  if (metric?.availability === 'idle') {
    return isEnglish
      ? 'This configured beam has no accepted measurement in the frame.'
      : '此設定波束在目前影格沒有可接受的量測。';
  }
  if (metric?.availability === 'unavailable') {
    return isEnglish ? 'The accepted frame did not provide this metric.' : '目前影格沒有提供此數值。';
  }
  return isEnglish
    ? 'No value was supplied by the accepted beam-metrics projection.'
    : '目前影格沒有提供此波束數值。';
}

function trimNumber(value: number): string {
  if (Object.is(value, -0)) return '0';
  return value.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 2,
  });
}

export function formatCompactValue(value: number): { readonly value: string; readonly prefix: string } {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return { value: trimNumber(value / 1_000_000_000), prefix: 'G' };
  if (magnitude >= 1_000_000) return { value: trimNumber(value / 1_000_000), prefix: 'M' };
  if (magnitude >= 1_000) return { value: trimNumber(value / 1_000), prefix: 'k' };
  return { value: trimNumber(value), prefix: '' };
}

export function formatNumber(value: number, unit: string): string {
  const compact = formatCompactValue(value);
  return `${compact.value} ${compact.prefix}${unit}`.trim();
}

export function formatCount(value: number): string {
  const compact = formatCompactValue(value);
  return `${compact.value}${compact.prefix.length > 0 ? ` ${compact.prefix}` : ''}`;
}
