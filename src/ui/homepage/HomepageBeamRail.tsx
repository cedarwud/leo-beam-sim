import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { candidateLinkKeyString } from '../../engine/handover/candidateDecisionContract';
import { ANGLE_AWARE_EE_CONTRACT_VERSION } from '../../engine/signal/angle-aware-ee';
import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetric,
  HomepageBeamMetricsProjection,
  HomepageHandoverPresentation,
  HomepageHandoverStoryProjection,
  HomepagePlaybackTransportState,
  HomepageRailProjection,
} from '../../homepage/controller/contracts';
import { useLocale } from '../../i18n';
import { txBi } from '../signal-tuning/labels';
import { resolveHomepageSatelliteDisplayName } from '../../homepage/controller/homepageSatelliteDisplayName';
import { formatHomepageEe } from '../../homepage/controller/homepageMetricFormatters';
import { formatHomepageBeamCellLabel } from '../../homepage/controller/homepageBeamIdentity';

/** Metadata copied from the accepted snapshot; it carries no decision logic. */
export type HomepageBeamRailSnapshotMetadata = Pick<
  HomepageAcceptedSnapshot,
  'snapshotId' | 'sourceFrameId' | 'phase'
>;

export interface HomepageBeamRailProps {
  readonly projection: HomepageRailProjection;
  readonly acceptedSnapshotMetadata?: HomepageBeamRailSnapshotMetadata | null;
  readonly playback?: HomepagePlaybackTransportState | null;
  /** The same presentation-owner pair currently rendered in the scene. */
  readonly handoverPresentation?: HomepageHandoverPresentation | null;
  /** Exact active-TLE names; raw IDs remain the projection join keys. */
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  /** Controlled scene cross-highlight identity. */
  readonly selectedJoinKey?: string | null;
  /** Optional handoff hook; the rail never chooses a beam. */
  readonly onFocusJoinKeyChange?: (joinKey: string | null) => void;
  /** Homepage teaching controls rendered inside this one right-rail surface. */
  readonly teachingTimeline?: ReactNode | null;
  /** Same-snapshot comparison evidence; kept out of the 3D scene. */
  readonly handoverComparison?: ReactNode | null;
  /**
   * Homepage-only review mode: keep every currently implemented rail surface
   * visible so the owner can decide which sections to remove.  This changes
   * visibility only; projection, decision, and metric authorities stay intact.
   */
  readonly showAllSurfaces?: boolean;
}

type RailLink = NonNullable<HomepageRailProjection['serving']>;
type MetricField =
  | 'powerW'
  | 'throughputBps'
  | 'sinrDb'
  | 'energyEfficiencyBitsPerJoule';

type RailPhase = HomepageRailProjection['phase'];

const COLORS = Object.freeze({
  // Keep the homepage rail in the same dark instrument-panel family as the
  // existing shell.  The rail is a new projection, not a light-theme escape.
  ink: '#f1fbff',
  muted: 'rgba(229, 244, 251, 0.72)',
  quiet: 'rgba(157, 202, 218, 0.46)',
  line: 'rgba(218, 244, 255, 0.16)',
  surface: '#06131b',
  surfaceAlt: 'rgba(7, 25, 34, 0.86)',
  white: 'rgba(255, 255, 255, 0.055)',
  amber: '#facc15',
  blue: '#58bff0',
  cyan: '#76ead7',
  green: '#52f2a1',
  orange: '#ffb36b',
} as const);

const METRIC_FIELDS: ReadonlyArray<{
  readonly field: MetricField;
  readonly zh: string;
  readonly en: string;
  readonly unit: string;
}> = [
  { field: 'powerW', zh: 'Power', en: 'Power', unit: 'W' },
  { field: 'throughputBps', zh: 'Throughput', en: 'Throughput', unit: 'bit/s' },
  { field: 'sinrDb', zh: 'SINR', en: 'SINR', unit: 'dB' },
  { field: 'energyEfficiencyBitsPerJoule', zh: 'EE', en: 'EE', unit: 'Kbit/J' },
];

const PHASE_LABELS: Readonly<Record<RailPhase, { readonly zh: string; readonly en: string }>> = {
  'initial-attach': { zh: '初始連線', en: 'Initial attach' },
  monitoring: { zh: '監測中', en: 'Monitoring' },
  evaluating: { zh: '評估中', en: 'Evaluating' },
  qualifying: { zh: '資格確認', en: 'Qualifying' },
  'selection-hold': { zh: '選擇保持', en: 'Selection hold' },
  switching: { zh: '切換中', en: 'Switching' },
  guard: { zh: '保護期', en: 'Guard' },
};

interface SatelliteGroup {
  readonly satelliteId: string;
  readonly metrics: HomepageBeamMetric[];
  readonly links: RailLink[];
}

/**
 * Beam metrics and accepted presentation links deliberately carry different
 * public join strings: metrics use the source pair key, while presentation
 * links use the episode-stable scene/rail key.  Join them on the typed pair
 * identity so the rail cannot silently replace finite metric values with an
 * unavailable placeholder.
 */
function pairJoinKey(value: Pick<RailLink, 'key'> | Pick<HomepageBeamMetric, 'key'>): string {
  return candidateLinkKeyString(value.key);
}

function trimNumber(value: number): string {
  if (Object.is(value, -0)) return '0';
  return value.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 2,
  });
}

function formatCompactValue(value: number): { readonly value: string; readonly prefix: string } {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return { value: trimNumber(value / 1_000_000_000), prefix: 'G' };
  if (magnitude >= 1_000_000) return { value: trimNumber(value / 1_000_000), prefix: 'M' };
  if (magnitude >= 1_000) return { value: trimNumber(value / 1_000), prefix: 'k' };
  return { value: trimNumber(value), prefix: '' };
}

function formatNumber(value: number, unit: string): string {
  const compact = formatCompactValue(value);
  return `${compact.value} ${compact.prefix}${unit}`.trim();
}

function paddedEeDomain(values: readonly number[]): { readonly min: number; readonly max: number } {
  const finiteValues = values.filter(value => Number.isFinite(value) && value >= 0);
  if (finiteValues.length === 0) return { min: 0, max: 1 };
  const minimum = Math.min(...finiteValues);
  const maximum = Math.max(...finiteValues);
  const spread = maximum - minimum;
  const padding = spread > 0
    ? Math.max(spread * 0.35, minimum * 0.2)
    : Math.max(maximum * 0.5, 1);
  return {
    min: Math.max(0, minimum - padding),
    max: Math.max(minimum + 1, maximum + padding),
  };
}

function formatCount(value: number): string {
  const compact = formatCompactValue(value);
  return `${compact.value}${compact.prefix.length > 0 ? ` ${compact.prefix}` : ''}`;
}

function phaseLabel(phase: RailPhase, isEnglish: boolean): string {
  const labels = PHASE_LABELS[phase];
  return isEnglish ? labels.en : labels.zh;
}

function roleLabel(role: string, isEnglish: boolean): string {
  switch (role) {
    case 'serving':
    case 'committed-serving':
      return isEnglish ? 'Serving' : '服務';
    case 'candidate':
    case 'selected-target':
    case 'provisional-leader':
    case 'qualified':
    case 'hard-eligible':
      return isEnglish ? 'Candidate' : '候選';
    case 'observed':
      return isEnglish ? 'Observed' : '觀測';
    default:
      return role;
  }
}

function unavailableReason(metric: HomepageBeamMetric | null, isEnglish: boolean): string {
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

function UnavailableValue({ reason }: { readonly reason: string }) {
  return (
    <span
      style={styles.unavailableReason}
      title={reason}
      aria-label={reason}
    >—</span>
  );
}

function MetricCell({
  metric,
  field,
  label,
  unit,
  isEnglish,
}: {
  readonly metric: HomepageBeamMetric;
  readonly field: MetricField;
  readonly label: string;
  readonly unit: string;
  readonly isEnglish: boolean;
}) {
  const value = metric[field];
  const available = typeof value === 'number' && Number.isFinite(value);

  return (
    <div
      data-testid={`homepage-beam-metric-${field}`}
      data-metric-field={field}
      style={styles.metricCell}
    >
      <dt style={styles.metricLabel}>{label}</dt>
      <dd style={styles.metricValue}>
        {available ? (
          <span>{field === 'energyEfficiencyBitsPerJoule' ? formatHomepageEe(value) : formatNumber(value, unit)}</span>
        ) : (
          <UnavailableValue reason={unavailableReason(metric, isEnglish)} />
        )}
      </dd>
    </div>
  );
}

function finiteEe(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function eeForRow(
  metric: HomepageBeamMetric | null,
  link: RailLink | null,
): number | null {
  return finiteEe(metric?.energyEfficiencyBitsPerJoule)
    ?? finiteEe(link?.opportunity?.instantaneousEe?.value);
}

function EeProgressSummary({
  metric,
  link,
  eeScaleMin,
  eeScaleMax,
  isEnglish,
}: {
  readonly metric: HomepageBeamMetric | null;
  readonly link: RailLink | null;
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
  readonly isEnglish: boolean;
}) {
  const ee = eeForRow(metric, link);
  const ratio = ee === null || eeScaleMax <= eeScaleMin
    ? 0
    : Math.max(0, Math.min(1, (ee - eeScaleMin) / (eeScaleMax - eeScaleMin)));
  const available = ee !== null;
  return (
    <div
      data-testid="homepage-beam-ee-progress"
      data-ee-value={ee === null ? '' : String(ee)}
      data-ee-scale-max={String(eeScaleMax)}
      data-ee-ratio={String(ratio)}
      style={styles.eeSummary}
    >
      <div style={styles.eeSummaryHeader}>
        <span style={styles.eeSummaryLabel}>EE</span>
        <strong style={styles.eeSummaryValue}>{available ? formatHomepageEe(ee) : '—'}</strong>
      </div>
      <div
        role="progressbar"
        aria-label={isEnglish ? 'Energy efficiency' : 'Energy efficiency'}
        aria-valuemin={eeScaleMin}
        aria-valuemax={eeScaleMax}
        aria-valuenow={available ? ee : undefined}
        aria-valuetext={available ? formatHomepageEe(ee) : '—'}
        style={styles.eeTrack}
      >
        <span style={{ ...styles.eeFill, width: String(ratio * 100) + '%' }} />
      </div>
      <span style={styles.eeDetailsHint}>
        {isEnglish ? 'Click for SINR · Power · Throughput' : '點擊查看 SINR · Power · Throughput'}
      </span>
    </div>
  );
}

function MetricGrid({
  metric,
  isEnglish,
  expanded,
}: {
  readonly metric: HomepageBeamMetric;
  readonly isEnglish: boolean;
  readonly expanded: boolean;
}) {
  return (
    <dl
      aria-label={isEnglish ? 'Additional beam metrics' : '其他波束數值'}
      data-testid="homepage-beam-metrics"
      data-metric-details-expanded={expanded ? 'true' : 'false'}
      hidden={!expanded}
      style={{ ...styles.metricGrid, display: expanded ? 'grid' : 'none' }}
    >
      {METRIC_FIELDS.filter(({ field }) => field !== 'energyEfficiencyBitsPerJoule').map(({ field, zh, en, unit }) => (
        <MetricCell
          key={field}
          metric={metric}
          field={field}
          label={isEnglish ? en : zh}
          unit={unit}
          isEnglish={isEnglish}
        />
      ))}
    </dl>
  );
}

function UnavailableMetricGrid({
  reason,
  isEnglish,
  eeScaleMin,
  eeScaleMax,
}: {
  readonly reason: string;
  readonly isEnglish: boolean;
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
}) {
  return (
    <div data-testid="homepage-beam-metrics" data-metric-details-expanded="false">
      <EeProgressSummary
        metric={null}
        link={null}
        eeScaleMin={eeScaleMin}
        eeScaleMax={eeScaleMax}
        isEnglish={isEnglish}
      />
    <dl
      aria-label={isEnglish ? 'Additional beam metrics unavailable' : '其他波束數值（目前未提供）'}
      data-testid="homepage-beam-metrics"
      data-metric-details-expanded="false"
      hidden
      style={{ ...styles.metricGrid, display: 'none' }}
    >
      {METRIC_FIELDS.map(({ field, zh, en }) => (
        <div
          key={field}
          data-testid={`homepage-beam-metric-${field}`}
          data-metric-field={field}
          data-metric-unavailable-reason={reason}
          style={styles.metricCell}
        >
          <dt style={styles.metricLabel}>{isEnglish ? en : zh}</dt>
          <dd style={styles.metricValue}>
            <UnavailableValue reason={reason} />
          </dd>
        </div>
      ))}
    </dl>
      <span hidden data-metric-unavailable-reason={reason}>{reason}</span>
    </div>
  );
}

function BeamRow({
  metric,
  link,
  snapshotId,
  selectedJoinKey,
  onFocusJoinKeyChange,
  variant,
  isEnglish,
  satelliteNameById,
  handoverRole,
  eeScaleMin,
  eeScaleMax,
}: {
  readonly metric: HomepageBeamMetric | null;
  readonly link: RailLink | null;
  readonly snapshotId: string;
  readonly selectedJoinKey: string | null;
  readonly onFocusJoinKeyChange?: (joinKey: string | null) => void;
  readonly variant: 'serving' | 'candidate';
  readonly isEnglish: boolean;
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  readonly handoverRole?: 'source' | 'target';
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
}) {
  const satelliteId = metric?.satelliteId ?? link?.satelliteId ?? '';
  const satelliteName = resolveHomepageSatelliteDisplayName(satelliteId, satelliteNameById);
  const beamId = metric?.beamId ?? link?.beamId ?? 0;
  // Prefer the accepted snapshot's stable join when a metric is paired with
  // its link. This keeps hover/selection identity shared with the scene while
  // the metric itself remains keyed by the source pair internally.
  const joinKey = link?.joinKey ?? metric?.joinKey ?? '';
  const sourceFrameId = metric?.sourceFrameId ?? link?.sourceFrameId ?? '';
  const role = metric?.role ?? link?.visual.role ?? 'observed';
  const eeAvailability = metric?.availability ?? 'unavailable';
  const accent = metric?.color.color ?? COLORS.muted;
  const selected = selectedJoinKey !== null && selectedJoinKey === joinKey;
  const interactive = onFocusJoinKeyChange !== undefined;
  const hasMetricDetails = metric !== null;
  const rowInteractive = interactive || hasMetricDetails;
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const focusHook = joinKey.length > 0 ? `homepage-beam:${joinKey}` : 'unavailable';
  const unavailableMetricReason = metric === null
    ? isEnglish
      ? 'No accepted beam metric was supplied for this projected link.'
      : '目前影格沒有提供此波束數值。'
    : unavailableReason(metric, isEnglish);

  const rowStyle: CSSProperties = variant === 'serving'
    ? {
      ...styles.beamRow,
      // The serving outline is part of the same satellite/beam identity. Do
      // not introduce a second amber identity colour at the rail boundary.
      border: `1px solid ${accent}`,
      borderInlineStart: `5px solid ${accent}`,
      backgroundColor: COLORS.white,
      boxShadow: '0 8px 20px rgba(32, 52, 52, 0.10)',
    }
    : {
      ...styles.beamRow,
      border: `1px solid ${COLORS.line}`,
      borderInlineStart: `4px solid ${accent}`,
      backgroundColor: COLORS.surfaceAlt,
      opacity: 0.9,
    };
  const handoverRowStyle: CSSProperties = handoverRole === undefined
    ? {}
    : {
      outline: `2px solid ${accent}`,
      outlineOffset: '-2px',
      boxShadow: handoverRole === 'source'
        ? `inset 0 0 0 1px ${accent}, 0 0 0 1px rgba(255,255,255,0.08)`
        : `inset 0 0 0 2px ${accent}, 0 0 0 1px rgba(255,255,255,0.08)`,
    };

  return (
    <div
      role={rowInteractive ? 'button' : 'group'}
      tabIndex={0}
      aria-label={`${roleLabel(role, isEnglish)} ${isEnglish ? 'satellite' : '衛星'} ${satelliteName}, ${isEnglish ? 'beam' : '波束'} ${beamId}`}
      aria-current={selected ? 'true' : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-expanded={hasMetricDetails ? detailsExpanded : undefined}
      data-testid="homepage-beam-row"
      data-snapshot-id={metric?.snapshotId ?? snapshotId}
      data-source-frame-id={sourceFrameId}
      data-sat-id={satelliteId}
      data-satellite-id={satelliteId}
      data-satellite-name={satelliteName}
      data-beam-id={String(beamId)}
      data-pair-key={`${satelliteId}/${isEnglish ? 'beam' : 'beam'}/${beamId}`}
      data-join-key={joinKey}
      data-scene-join-key={link?.sceneJoinKey ?? joinKey}
      data-rail-join-key={link?.railJoinKey ?? joinKey}
      data-role={role}
      data-ee-availability={eeAvailability}
      data-ee-basis={metric?.eeBasis ?? 'not-available'}
      data-selected={selected ? 'true' : 'false'}
      data-focus={selected ? 'true' : 'false'}
      data-focus-join-key={joinKey}
      data-focus-hook={focusHook}
      data-handover-endpoint={handoverRole ?? ''}
      data-metric-details-expanded={detailsExpanded ? 'true' : 'false'}
      onMouseEnter={() => onFocusJoinKeyChange?.(joinKey)}
      onMouseLeave={() => onFocusJoinKeyChange?.(null)}
      onFocus={() => onFocusJoinKeyChange?.(joinKey)}
      onBlur={() => onFocusJoinKeyChange?.(null)}
      onClick={() => {
        onFocusJoinKeyChange?.(joinKey);
        if (hasMetricDetails) setDetailsExpanded(previous => !previous);
      }}
      onKeyDown={(event) => {
        if (!rowInteractive || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onFocusJoinKeyChange?.(joinKey);
        if (hasMetricDetails) setDetailsExpanded(previous => !previous);
      }}
      style={{ ...rowStyle, ...handoverRowStyle }}
    >
      <div style={styles.beamRowHeader}>
        <div style={styles.beamIdentity}>
          <span style={{ ...styles.hueMarker, backgroundColor: accent }} aria-hidden="true" />
          <span style={variant === 'serving' ? styles.servingIdentity : styles.otherIdentity}>
            {satelliteName}
          </span>
          <span style={styles.beamId}>{isEnglish ? 'Beam' : '波束'} {formatHomepageBeamCellLabel(beamId)}</span>
        </div>
        <span
          style={variant === 'serving'
            ? { ...styles.servingRole, color: accent }
            : styles.roleLabel}
        >
          {handoverRole === 'source'
            ? (isEnglish ? 'From' : '來源')
            : handoverRole === 'target'
              ? (isEnglish ? 'To' : '目標')
              : roleLabel(role, isEnglish)}
        </span>
      </div>
      {metric === null ? (
        <UnavailableMetricGrid
          reason={unavailableMetricReason}
          isEnglish={isEnglish}
          eeScaleMin={eeScaleMin}
          eeScaleMax={eeScaleMax}
        />
      ) : (
        <>
          <EeProgressSummary
            metric={metric}
            link={link}
            eeScaleMin={eeScaleMin}
            eeScaleMax={eeScaleMax}
            isEnglish={isEnglish}
          />
          <MetricGrid metric={metric} isEnglish={isEnglish} expanded={detailsExpanded} />
        </>
      )}
    </div>
  );
}

function buildSatelliteGroups(
  metrics: readonly HomepageBeamMetric[],
  links: readonly RailLink[],
  servingSatelliteId: string | null,
): SatelliteGroup[] {
  const groups = new Map<string, SatelliteGroup>();

  const groupFor = (satelliteId: string): SatelliteGroup => {
    const existing = groups.get(satelliteId);
    if (existing !== undefined) return existing;
    const created: SatelliteGroup = { satelliteId, metrics: [], links: [] };
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

interface ProjectedBeamRow {
  readonly metric: HomepageBeamMetric | null;
  readonly link: RailLink | null;
}

function handoverRoleForRow(
  metric: HomepageBeamMetric | null,
  link: RailLink | null,
  presentation: HomepageHandoverPresentation | null | undefined,
  story: HomepageHandoverStoryProjection | null | undefined,
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
    if (rowKey === candidateLinkKeyString(story.target)) return 'target';
  }
  return undefined;
}

function projectedRowsForGroup(group: SatelliteGroup): ProjectedBeamRow[] {
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

function bestEeRowForGroup(group: SatelliteGroup): ProjectedBeamRow | null {
  let best: ProjectedBeamRow | null = null;
  let bestEe: number | null = null;
  for (const row of projectedRowsForGroup(group)) {
    const ee = eeForRow(row.metric, row.link);
    if (ee === null || (bestEe !== null && ee <= bestEe)) continue;
    best = row;
    bestEe = ee;
  }
  return best;
}

function GroupEeSummary({
  row,
  eeScaleMin,
  eeScaleMax,
}: {
  readonly row: ProjectedBeamRow | null;
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
}) {
  const ee = row === null ? null : eeForRow(row.metric, row.link);
  const ratio = ee === null || eeScaleMax <= eeScaleMin
    ? 0
    : Math.max(0, Math.min(1, (ee - eeScaleMin) / (eeScaleMax - eeScaleMin)));
  const accent = row?.metric?.color.color ?? row?.link?.satelliteIdentity.color ?? COLORS.blue;
  return (
    <span
      style={styles.groupEeSummary}
      data-testid="homepage-candidate-ee-summary"
      data-ee-value={ee === null ? '' : String(ee)}
      data-ee-ratio={String(ratio)}
    >
      <span style={styles.groupEeLabel}>EE</span>
      <span style={styles.groupEeTrack} aria-hidden="true">
        <span
          style={{
            ...styles.groupEeFill,
            width: String(ratio * 100) + '%',
            backgroundColor: accent,
          }}
        />
      </span>
      <strong style={styles.groupEeValue}>{ee === null ? '—' : formatHomepageEe(ee)}</strong>
    </span>
  );
}

function storyCellLabel(
  story: HomepageHandoverStoryProjection,
  isEnglish: boolean,
): string {
  if (isEnglish) return `${story.cellCount} ${story.cellCount === 1 ? 'cell' : 'cells'}`;
  return `${story.cellCount} cell`;
}

function storyEndpointLabel(
  key: HomepageHandoverStoryProjection['source'],
  satelliteNameById: ReadonlyMap<string, string> | null | undefined,
): string {
  return `${resolveHomepageSatelliteDisplayName(key.satelliteId, satelliteNameById)} / ${formatHomepageBeamCellLabel(key.beamId)}`;
}

/**
 * Numeric handover story for the homepage rail.  Every value here is already
 * joined by the accepted snapshot projection; this component never selects a
 * candidate, recomputes EE, or derives a phase from UI state.
 */
function HandoverStorySection({
  story,
  isEnglish,
  satelliteNameById,
}: {
  readonly story: HomepageHandoverStoryProjection;
  readonly isEnglish: boolean;
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
}) {
  const kindLabel = story.kind === 'intra'
    ? (isEnglish ? 'Intra' : 'Intra')
    : (isEnglish ? 'Inter' : 'Inter');
  const statusLabel = story.selectionStatus === 'committed'
    ? (isEnglish ? 'Committed' : '已完成')
    : story.selectionStatus === 'selected'
      ? (isEnglish ? 'Selected' : '已選定')
      : story.selectionStatus === 'ttt-stable'
        ? (isEnglish ? 'TTT stable' : 'TTT 穩定')
        : (isEnglish ? 'Qualified' : '具備資格');
  const winnerLabel = story.targetIsWinner
    ? (isEnglish ? 'Selected · maximum instantaneous EE criterion' : '依瞬時 EE 最大化準則選定')
    : (isEnglish ? 'Instantaneous EE comparison' : '瞬時 EE 比較');
  const headingLabel = story.targetIsWinner
    ? (isEnglish
      ? 'Handover decision under the maximum instantaneous EE criterion'
      : '瞬時能效最大化準則之換手判定')
    : (isEnglish ? 'Instantaneous EE comparison' : '瞬時 EE 比較');
  const sourceKey = candidateLinkKeyString(story.source);
  const targetKey = candidateLinkKeyString(story.target);
  const winnerKey = story.winner === null ? '' : candidateLinkKeyString(story.winner);

  return (
    <section
      aria-label={isEnglish ? 'Handover story' : '換手故事'}
      data-testid="homepage-handover-story"
      data-story-kind={story.kind}
      data-story-cell-count={String(story.cellCount)}
      data-story-cell-example={story.cellExample}
      data-story-source-key={sourceKey}
      data-story-target-key={targetKey}
      data-story-winner-key={winnerKey}
      data-story-source-ee={story.sourceEeBitsPerJoule === null ? '' : String(story.sourceEeBitsPerJoule)}
      data-story-target-ee={story.targetEeBitsPerJoule === null ? '' : String(story.targetEeBitsPerJoule)}
      data-story-winner-ee={story.winnerEeBitsPerJoule === null ? '' : String(story.winnerEeBitsPerJoule)}
      data-story-winner-basis={story.winnerBasis}
      data-story-target-is-winner={String(story.targetIsWinner)}
      data-story-qualified-candidate-count={String(story.qualifiedCandidateCount)}
      data-story-qualified-candidate-satellite-count={String(story.qualifiedCandidateSatelliteCount)}
      data-story-selection-status={story.selectionStatus}
      data-story-phase={story.phase}
      style={styles.storySection}
    >
      <div style={styles.sectionHeading}>
        <h3 style={styles.sectionTitle}>{headingLabel}</h3>
        <span style={styles.storyBadge}>{kindLabel} · {storyCellLabel(story, isEnglish)}</span>
      </div>
      <div style={styles.storyGrid}>
        <div style={styles.storyEndpoint} data-story-endpoint="source">
          <span style={styles.metricLabel}>{isEnglish ? 'From' : '來源'}</span>
          <strong>{storyEndpointLabel(story.source, satelliteNameById)}</strong>
          <span style={styles.storyEeValue}>
            EE {formatHomepageEe(story.sourceEeBitsPerJoule)}
          </span>
        </div>
        <div style={styles.storyArrow} aria-hidden="true">→</div>
        <div style={styles.storyEndpoint} data-story-endpoint="target">
          <span style={styles.metricLabel}>{isEnglish ? 'To' : '目標'}</span>
          <strong>{storyEndpointLabel(story.target, satelliteNameById)}</strong>
          <span style={styles.storyEeValue}>
            EE {formatHomepageEe(story.targetEeBitsPerJoule)}
          </span>
        </div>
      </div>
      <div style={styles.storyFooter}>
        <span data-story-winner-badge={story.targetIsWinner ? 'true' : 'false'} style={styles.storyWinnerBadge}>
          {winnerLabel}
        </span>
        <span>{statusLabel}</span>
        <span>{isEnglish ? 'qualified' : '合格'} {formatCount(story.qualifiedCandidateCount)}</span>
        <span>{isEnglish ? 'satellites' : '衛星'} {formatCount(story.qualifiedCandidateSatelliteCount)}</span>
      </div>
    </section>
  );
}

function HandoverSurfacePlaceholder({
  testId,
  title,
  status,
  reason,
  accent,
}: {
  readonly testId: string;
  readonly title: string;
  readonly status: string;
  readonly reason: string;
  readonly accent: string;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      data-surface-state="inactive"
      style={{ ...styles.surfacePlaceholder, borderColor: accent }}
    >
      <div style={styles.sectionHeading}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        <span data-surface-status="inactive" style={styles.surfacePlaceholderStatus}>
          {status}
        </span>
      </div>
      <div role="status" style={styles.surfacePlaceholderReason}>
        {reason}
      </div>
    </section>
  );
}

function ProjectedSatelliteGroup({
  group,
  snapshotId,
  selectedJoinKey,
  onFocusJoinKeyChange,
  isEnglish,
  expanded,
  onExpandedChange,
  satelliteNameById,
  handoverPresentation,
  handoverStory,
  eeScaleMin,
  eeScaleMax,
}: {
  readonly group: SatelliteGroup;
  readonly snapshotId: string;
  readonly selectedJoinKey: string | null;
  readonly onFocusJoinKeyChange?: (joinKey: string | null) => void;
  readonly isEnglish: boolean;
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  readonly handoverPresentation?: HomepageHandoverPresentation | null;
  readonly handoverStory?: HomepageHandoverStoryProjection | null;
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
}) {
  const rows = projectedRowsForGroup(group);

  return (
    <details
      open={expanded}
      onToggle={event => onExpandedChange((event.currentTarget as HTMLDetailsElement).open)}
      data-testid="homepage-satellite-group"
      data-sat-id={group.satelliteId}
      data-satellite-id={group.satelliteId}
      data-satellite-name={resolveHomepageSatelliteDisplayName(group.satelliteId, satelliteNameById)}
      style={styles.group}
    >
      <summary style={styles.groupSummary}>
        <span style={styles.groupSummaryInfo}>
          <span style={styles.groupTitle}>{resolveHomepageSatelliteDisplayName(group.satelliteId, satelliteNameById)}</span>
          <span style={styles.groupCount}>{rows.length} {isEnglish ? 'beams' : '個波束'}</span>
        </span>
        <GroupEeSummary
          row={bestEeRowForGroup(group)}
          eeScaleMin={eeScaleMin}
          eeScaleMax={eeScaleMax}
        />
      </summary>
      <div style={styles.groupRows}>
        {rows.map(({ metric, link }, index) => (
          <BeamRow
            key={`${metric?.joinKey ?? link?.joinKey ?? group.satelliteId}-${index}`}
            metric={metric}
            link={link}
            snapshotId={snapshotId}
            selectedJoinKey={selectedJoinKey}
            onFocusJoinKeyChange={onFocusJoinKeyChange}
            variant="candidate"
            isEnglish={isEnglish}
            satelliteNameById={satelliteNameById}
            handoverRole={handoverRoleForRow(metric, link, handoverPresentation, handoverStory)}
            eeScaleMin={eeScaleMin}
            eeScaleMax={eeScaleMax}
          />
        ))}
      </div>
    </details>
  );
}

export function HomepageBeamRail({
  projection,
  selectedJoinKey = null,
  onFocusJoinKeyChange,
  satelliteNameById = null,
  handoverPresentation = null,
  teachingTimeline = null,
  handoverComparison,
  showAllSurfaces = false,
}: HomepageBeamRailProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string): string => txBi(t, isEnglish, key, zh, en);
  // The projection is the accepted-snapshot boundary for this rail. Keep the
  // older metadata prop source-compatible, but never let a stale duplicate
  // override the identity used by the scene/rail join.
  const snapshotId = projection.snapshotId;
  const sourceFrameId = projection.sourceFrameId;
  const phase = projection.phase;
  const beamMetrics: HomepageBeamMetricsProjection | null = projection.beamMetrics ?? null;
  const allMetrics = beamMetrics?.metrics ?? [];
  const servingLink = projection.serving;
  const servingPairKey = servingLink === null ? null : pairJoinKey(servingLink);
  const servingMetric = (servingPairKey === null
    ? undefined
    : allMetrics.find(metric => pairJoinKey(metric) === servingPairKey))
    ?? allMetrics.find(metric => metric.isPrimaryServing || metric.role === 'serving')
    ?? null;
  const servingSatelliteId = servingLink?.satelliteId ?? servingMetric?.satelliteId ?? null;
  const servingAccent = servingMetric?.color.color ?? '#16303b';
  const candidateLinks = (projection.visibleCandidates ?? projection.candidates)
    .filter(candidate => candidate.isCandidate);
  const candidateSatelliteIds = new Set(candidateLinks.map(candidate => candidate.satelliteId));
  const visibleSatelliteIds = new Set(candidateSatelliteIds);
  if (servingSatelliteId !== null) visibleSatelliteIds.add(servingSatelliteId);
  // BeamMetrics is the complete configured roster. The rail only removes
  // satellites outside the accepted serving/candidate set; it must not remove
  // beams inside a selected satellite's 1/7/19 roster.
  const metrics = beamMetrics === null
    ? []
    : allMetrics.filter(metric => visibleSatelliteIds.has(metric.satelliteId));
  const eeScaleValues = [
    ...metrics.map(metric => finiteEe(metric.energyEfficiencyBitsPerJoule)),
    finiteEe(servingLink?.opportunity?.instantaneousEe?.value),
    ...candidateLinks.map(link => finiteEe(link.opportunity?.instantaneousEe?.value)),
  ].filter((value): value is number => value !== null && Number.isFinite(value));
  const targetEeDomain = paddedEeDomain(eeScaleValues);
  const scaleStory = projection.handoverStory !== null
    && projection.handoverStory !== undefined
    && projection.handoverStory.phase !== 'initial-attach'
    && projection.handoverStory.phase !== 'monitoring'
    && projection.handoverStory.phase !== 'guard'
    ? projection.handoverStory
    : null;
  // Review mode exposes a story even during guard when the accepted snapshot
  // still carries one.  When no pair exists, the render below shows an
  // explicitly inactive shell instead of inventing source/target evidence.
  const surfaceStory = showAllSurfaces
    ? projection.handoverStory ?? null
    : scaleStory;
  const eeScaleKey = scaleStory === null || scaleStory === undefined
    ? 'serving|' + (servingSatelliteId ?? 'none')
    : scaleStory.kind + '|' + candidateLinkKeyString(scaleStory.source) + '|' + candidateLinkKeyString(scaleStory.target);
  const eeScaleRef = useRef<{ readonly key: string; readonly min: number; readonly max: number } | null>(null);
  const previousEeDomain = eeScaleRef.current;
  const nextEeDomain = previousEeDomain === null || previousEeDomain.key !== eeScaleKey
    ? { key: eeScaleKey, ...targetEeDomain }
    : {
      key: eeScaleKey,
      min: previousEeDomain.min + (targetEeDomain.min - previousEeDomain.min) * 0.12,
      max: previousEeDomain.max + (targetEeDomain.max - previousEeDomain.max) * 0.12,
    };
  eeScaleRef.current = nextEeDomain;
  const eeScaleMin = nextEeDomain.min;
  const eeScaleMax = Math.max(eeScaleMin + 1, nextEeDomain.max);
  // The domain is padded and eased within one story, so a new candidate
  // cannot remap every existing bar to 0% or 100% on the next render.
  const groups = buildSatelliteGroups(metrics, candidateLinks, servingSatelliteId);
  const linkByPairKey = new Map<string, RailLink>();
  if (servingLink !== null) linkByPairKey.set(pairJoinKey(servingLink), servingLink);
  for (const link of candidateLinks) linkByPairKey.set(pairJoinKey(link), link);
  const servingMetrics = servingSatelliteId === null
    ? []
    : metrics.filter(metric => metric.satelliteId === servingSatelliteId);
  const servingMetricPairKeys = new Set(servingMetrics.map(pairJoinKey));
  const servingRows: ProjectedBeamRow[] = [
    ...servingMetrics.map(metric => ({
      metric,
      link: linkByPairKey.get(pairJoinKey(metric)) ?? null,
    })),
    ...[...linkByPairKey.values()]
      .filter(link => link.satelliteId === servingSatelliteId && !servingMetricPairKeys.has(pairJoinKey(link)))
      .map(link => ({ metric: null, link })),
  ];
  // The primary serving link is always part of the visible story. Only the
  // serving satellite's other configured beams belong behind the collapsible
  // details disclosure; collapsing the section must never hide the active link.
  const isPrimaryServingRow = ({ metric, link }: ProjectedBeamRow): boolean => (
    metric?.isPrimaryServing === true
    || link?.isServing === true
    || link?.visual.isActiveDataLink === true
  );
  const primaryServingRows = servingRows.filter(isPrimaryServingRow);
  const servingOtherRows = servingRows.filter(row => !isPrimaryServingRow(row));
  // A legacy fixture may omit the explicit primary flag while still supplying
  // a serving roster. Keep its first row visible rather than hiding the whole
  // section behind the disclosure.
  const visiblePrimaryServingRows = primaryServingRows.length > 0
    ? primaryServingRows
    : servingRows.slice(0, 1);
  const collapsibleServingRows = primaryServingRows.length > 0
    ? servingOtherRows
    : servingRows.slice(1);
  const groupRowCount = groups.reduce((count, group) => count + projectedRowsForGroup(group).length, 0);
  const displayedBeamCount = servingRows.length + groupRowCount;
  const groupIds = groups.map(group => group.satelliteId);
  const groupIdentity = groupIds.join('|');
  const handoverStoryKey = surfaceStory === null || surfaceStory === undefined
    ? null
    : surfaceStory.kind + '|' + candidateLinkKeyString(surfaceStory.source) + '|' + candidateLinkKeyString(surfaceStory.target);
  const [servingExpanded, setServingExpanded] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  type DetailsExpansionMode = 'individual' | 'all-expanded' | 'all-collapsed';
  const detailsExpansionModeRef = useRef<DetailsExpansionMode>('individual');
  const handoverStoryKeyRef = useRef<string | null>(null);
  const [detailsExpansionMode, setDetailsExpansionMode] = useState<DetailsExpansionMode>('individual');
  useEffect(() => {
    const currentGroupIds = new Set(groupIds);
    if (detailsExpansionModeRef.current === 'all-expanded') return;
    if (detailsExpansionModeRef.current === 'all-collapsed') {
      setExpandedGroupIds(previous => previous.size === 0 ? previous : new Set<string>());
      return;
    }
    setExpandedGroupIds(previous => {
      const next = new Set([...previous].filter(groupId => currentGroupIds.has(groupId)));
      return next.size === previous.size ? previous : next;
    });
  }, [groupIdentity]);
  useEffect(() => {
    if (handoverStoryKey === null) {
      handoverStoryKeyRef.current = null;
      return;
    }
    if (handoverStoryKeyRef.current === handoverStoryKey) return;
    handoverStoryKeyRef.current = handoverStoryKey;
    // A handover story makes its comparison rows visible at the moment the
    // story starts. The lecturer can still collapse them manually or use the
    // global collapse control; this is only an entry affordance, not a second
    // presentation state machine.
    if (detailsExpansionModeRef.current === 'all-collapsed') return;
    if (surfaceStory?.kind === 'intra') {
      setServingExpanded(true);
    } else {
      setExpandedGroupIds(new Set(groupIds));
    }
  }, [groupIdentity, handoverStoryKey, surfaceStory?.kind]);
  const allDetailsExpanded = detailsExpansionMode === 'all-expanded'
    || (detailsExpansionMode !== 'all-collapsed'
      && (collapsibleServingRows.length === 0 || servingExpanded)
      && groups.every(group => expandedGroupIds.has(group.satelliteId)));
  const hasExpandableDetails = collapsibleServingRows.length > 0 || groups.length > 0;
  const toggleAllDetails = (): void => {
    const nextExpanded = !allDetailsExpanded;
    const nextMode: DetailsExpansionMode = nextExpanded ? 'all-expanded' : 'all-collapsed';
    detailsExpansionModeRef.current = nextMode;
    setDetailsExpansionMode(nextMode);
    setServingExpanded(nextExpanded);
    setExpandedGroupIds(nextExpanded ? new Set(groupIds) : new Set<string>());
  };

  const metricForPresentationEndpoint = (
    endpoint: HomepageHandoverPresentation['from'],
  ): HomepageBeamMetric | null => allMetrics.find(metric => (
    metric.satelliteId === endpoint.satelliteId && metric.beamId === endpoint.beamId
  )) ?? null;
  const formatEndpoint = (
    endpoint: HomepageHandoverPresentation['from'],
  ): string => `${resolveHomepageSatelliteDisplayName(endpoint.satelliteId, satelliteNameById)} / ${formatHomepageBeamCellLabel(endpoint.beamId)}`;
  const fromMetric = handoverPresentation === null
    ? null
    : metricForPresentationEndpoint(handoverPresentation.from);
  const toMetric = handoverPresentation === null
    ? null
    : metricForPresentationEndpoint(handoverPresentation.to);
  const endpointMetric = (
    metric: HomepageBeamMetric | null,
    endpoint: HomepageHandoverPresentation['from'],
  ): string => {
    const ee = metric?.energyEfficiencyBitsPerJoule;
    const sinr = metric?.sinrDb ?? endpoint.sinrDb;
    const eeText = formatHomepageEe(ee);
    const sinrText = typeof sinr === 'number' && Number.isFinite(sinr) ? formatNumber(sinr, 'dB') : '—';
    return `SINR ${sinrText} · EE ${eeText}`;
  };
  const servingUnavailableReason = isEnglish
    ? 'No accepted serving beam was supplied by the rail projection.'
    : '目前影格未提供可接受的服務波束數值。';

  return (
    <aside
      aria-label={say('homepage.rail.ariaLabel', '首頁波束數值', 'Homepage beam values')}
      data-testid="homepage-beam-rail"
      data-formula-contract="simplified-ee-c1-c9"
      data-formula-contract-version={ANGLE_AWARE_EE_CONTRACT_VERSION}
      data-power-metric="P^p_{s,v}"
      data-snapshot-id={snapshotId}
      data-source-frame-id={sourceFrameId}
      data-phase={phase}
      data-phase-label={phaseLabel(phase, isEnglish)}
      data-handover-story-active={surfaceStory === null ? 'false' : 'true'}
      data-show-all-surfaces={showAllSurfaces ? 'true' : 'false'}
      data-displayed-beam-count={String(displayedBeamCount)}
      data-beam-metric-count={String(metrics.length)}
      data-serving-beam-count={String(servingRows.length)}
      data-serving-primary-beam-count={String(visiblePrimaryServingRows.length)}
      data-serving-other-beam-count={String(collapsibleServingRows.length)}
      data-candidate-beam-count={String(groupRowCount)}
      data-candidate-satellite-count={String(groups.length)}
      data-candidate-roster-source-frame-id={projection.candidateRosterSourceFrameId ?? sourceFrameId}
      data-candidate-roster-retained={projection.candidateRosterRetained === true ? '1' : '0'}
      data-accepted-serving-count={String(projection.serving === null ? 0 : 1)}
      data-accepted-candidate-count={String(projection.candidates.length)}
      data-candidate-overflow-count={String(projection.counts.overflow)}
      data-selected-join-key={selectedJoinKey ?? ''}
      data-focus-join-key={selectedJoinKey ?? ''}
      data-focus-hook={selectedJoinKey === null ? 'none' : `homepage-beam:${selectedJoinKey}`}
      style={styles.rail}
    >
      {teachingTimeline}
      {handoverComparison !== undefined
        ? handoverComparison
        : surfaceStory !== null ? (
        <HandoverStorySection
          story={surfaceStory}
          isEnglish={isEnglish}
          satelliteNameById={satelliteNameById}
        />
      ) : showAllSurfaces ? (
        <HandoverSurfacePlaceholder
          testId="homepage-handover-story-placeholder"
          title={isEnglish ? 'Handover story' : '換手故事'}
          status={isEnglish ? 'Inactive' : '目前未啟動'}
          reason={isEnglish
            ? 'No accepted source → target pair is active in this snapshot. The surface remains visible for review.'
            : '目前 accepted snapshot 沒有作用中的來源 → 目標 pair；此區塊保留供盤點。'}
          accent={COLORS.blue}
        />
      ) : null}
      {handoverPresentation !== null ? (
        <section
          aria-label={say('homepage.rail.presentation', '目前換手', 'Visible handover')}
          data-testid="homepage-handover-presentation"
          data-handover-event-id={handoverPresentation.eventId}
          data-handover-kind={handoverPresentation.kind}
          data-handover-source={handoverPresentation.source}
          data-handover-phase={handoverPresentation.phase}
          data-handover-from-sat-id={handoverPresentation.from.satelliteId}
          data-handover-from-beam-id={String(handoverPresentation.from.beamId)}
          data-handover-to-sat-id={handoverPresentation.to.satelliteId}
          data-handover-to-beam-id={String(handoverPresentation.to.beamId)}
          style={styles.presentationSection}
        >
          <div style={styles.sectionHeading}>
            <h3 style={styles.sectionTitle}>{say('homepage.rail.presentation', '目前換手', 'Visible handover')}</h3>
            <span style={styles.phase}>{handoverPresentation.kind === 'intra' ? 'Intra' : 'Inter'} · {handoverPresentation.phase}</span>
          </div>
          <div style={styles.presentationGrid}>
            <div style={styles.presentationEndpoint} data-handover-endpoint-summary="source">
              <span style={styles.metricLabel}>{isEnglish ? 'From' : '來源'}</span>
              <strong>{formatEndpoint(handoverPresentation.from)}</strong>
              <span style={styles.presentationMetrics}>{endpointMetric(fromMetric, handoverPresentation.from)}</span>
            </div>
            <div style={styles.presentationArrow} aria-hidden="true">→</div>
            <div style={styles.presentationEndpoint} data-handover-endpoint-summary="target">
              <span style={styles.metricLabel}>{isEnglish ? 'To' : '目標'}</span>
              <strong>{formatEndpoint(handoverPresentation.to)}</strong>
              <span style={styles.presentationMetrics}>{endpointMetric(toMetric, handoverPresentation.to)}</span>
            </div>
          </div>
        </section>
      ) : showAllSurfaces ? (
        <HandoverSurfacePlaceholder
          testId="homepage-handover-presentation-placeholder"
          title={say('homepage.rail.presentation', '目前換手', 'Visible handover')}
          status={isEnglish ? 'Inactive' : '目前未啟動'}
          reason={isEnglish
            ? 'The presentation-owner envelope is not active in this frame. The surface remains visible for review.'
            : '目前影格沒有啟用 presentation-owner envelope；此區塊保留供盤點。'}
          accent={COLORS.cyan}
        />
      ) : null}
      <section
        aria-labelledby="homepage-serving-beam-title"
        style={{
          ...styles.servingSection,
          borderColor: servingAccent,
          background: `linear-gradient(180deg, ${servingAccent}20, rgba(15, 31, 33, 0.72))`,
        }}
      >
        <div style={styles.sectionHeading}>
          <h3 id="homepage-serving-beam-title" style={styles.sectionTitle}>
            {say('homepage.rail.serving', '服務波束', 'Serving beam')}
          </h3>
          <span data-active-data-link-count={String(projection.activeDataLinkCount)} style={styles.activeBadge}>
            {projection.activeDataLinkCount === 1
              ? say('homepage.rail.activeLink', '作用中鏈路', 'Active link')
              : say('homepage.rail.noActiveLink', '無作用中鏈路', 'No active link')}
          </span>
        </div>
        {servingRows.length === 0 ? (
          <div role="status" data-testid="homepage-serving-beam-unavailable" style={styles.emptyState}>
            <UnavailableValue reason={servingUnavailableReason} />
          </div>
        ) : (
          <>
            <div data-testid="homepage-primary-serving-beam" style={styles.groupRows}>
              {visiblePrimaryServingRows.map(({ metric, link }, index) => (
                <BeamRow
                  key={`${metric?.joinKey ?? link?.joinKey ?? 'serving-primary'}-${index}`}
                  metric={metric}
                  link={link}
                  snapshotId={snapshotId}
                  selectedJoinKey={selectedJoinKey}
                  onFocusJoinKeyChange={onFocusJoinKeyChange}
                  variant="serving"
                  isEnglish={isEnglish}
                  satelliteNameById={satelliteNameById}
                  handoverRole={handoverRoleForRow(metric, link, handoverPresentation, surfaceStory)}
                  eeScaleMin={eeScaleMin}
                  eeScaleMax={eeScaleMax}
                />
              ))}
            </div>
            {collapsibleServingRows.length > 0 ? (
              <details
                id="homepage-serving-beam-details"
                data-testid="homepage-serving-beam-details"
                open={detailsExpansionMode === 'all-expanded'
                  || (detailsExpansionMode !== 'all-collapsed' && servingExpanded)}
                onToggle={event => {
                  const open = (event.currentTarget as HTMLDetailsElement).open;
                  const mode = detailsExpansionModeRef.current;
                  if ((mode === 'all-expanded' && open) || (mode === 'all-collapsed' && !open)) return;
                  detailsExpansionModeRef.current = 'individual';
                  setDetailsExpansionMode('individual');
                  setServingExpanded(open);
                }}
                style={styles.servingDetails}
              >
                <summary style={{ ...styles.sectionHeading, ...styles.detailsSummary }}>
                  <span style={styles.otherBeamSummary}>
                    {say('homepage.rail.otherBeams', '其他波束', 'Other beams')}
                  </span>
                  <span style={styles.groupCount}>{formatCount(collapsibleServingRows.length)} {isEnglish ? 'beams' : '個波束'}</span>
                </summary>
                <div style={styles.groupRows}>
                  {collapsibleServingRows.map(({ metric, link }, index) => (
                    <BeamRow
                      key={`${metric?.joinKey ?? link?.joinKey ?? 'serving-other'}-${index}`}
                      metric={metric}
                      link={link}
                      snapshotId={snapshotId}
                      selectedJoinKey={selectedJoinKey}
                      onFocusJoinKeyChange={onFocusJoinKeyChange}
                      variant="candidate"
                      isEnglish={isEnglish}
                      satelliteNameById={satelliteNameById}
                      handoverRole={handoverRoleForRow(metric, link, handoverPresentation, surfaceStory)}
                      eeScaleMin={eeScaleMin}
                      eeScaleMax={eeScaleMax}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </section>

      <section
        id="homepage-projected-groups"
        aria-labelledby="homepage-projected-groups-title"
        style={styles.groupsSection}
      >
        <div style={styles.sectionHeading}>
          <h3 id="homepage-projected-groups-title" style={styles.sectionTitle}>
            {say('homepage.rail.candidates', '候選衛星', 'Candidate satellites')}
          </h3>
          <div style={styles.groupToolbar}>
            <span style={styles.groupTotal}>{formatCount(groups.length)} {isEnglish ? 'satellites' : '顆'}</span>
            <button
              type="button"
              data-testid="homepage-beam-rail-toggle-groups"
              aria-expanded={allDetailsExpanded}
              aria-controls="homepage-serving-beam-details homepage-projected-groups"
              data-control-scope="serving-and-candidate-details"
              disabled={!hasExpandableDetails}
              onClick={toggleAllDetails}
              style={styles.groupToggle}
            >
              {allDetailsExpanded
                ? say('homepage.rail.collapseAll', '全部收合', 'Collapse all')
                : say('homepage.rail.expandAll', '全部展開', 'Expand all')}
            </button>
          </div>
        </div>
        {beamMetrics === null ? (
          <div
            role="status"
            data-testid="homepage-beam-metrics-unavailable"
            style={styles.emptyState}
            title={say('homepage.rail.metricsUnavailable', '目前影格未提供波束數值。', 'Beam metrics unavailable.')}
            aria-label={say('homepage.rail.metricsUnavailable', '目前影格未提供波束數值。', 'Beam metrics unavailable.')}
          >—</div>
        ) : null}
        {groups.length === 0 ? (
          <div role="status" data-testid="homepage-projected-groups-empty" style={styles.emptyState}>
            <strong>—</strong>
          </div>
        ) : (
          <div style={styles.groupList}>
            {groups.map(group => (
              <ProjectedSatelliteGroup
                key={group.satelliteId}
                group={group}
                snapshotId={snapshotId}
                selectedJoinKey={selectedJoinKey}
                onFocusJoinKeyChange={onFocusJoinKeyChange}
                isEnglish={isEnglish}
                expanded={detailsExpansionMode === 'all-expanded'
                  || (detailsExpansionMode !== 'all-collapsed' && expandedGroupIds.has(group.satelliteId))}
                onExpandedChange={expanded => {
                  detailsExpansionModeRef.current = 'individual';
                  setDetailsExpansionMode('individual');
                  setExpandedGroupIds(previous => {
                    const next = new Set(previous);
                    if (expanded) next.add(group.satelliteId);
                    else next.delete(group.satelliteId);
                    return next;
                  });
                }}
                satelliteNameById={satelliteNameById}
                handoverPresentation={handoverPresentation}
                handoverStory={surfaceStory}
                eeScaleMin={eeScaleMin}
                eeScaleMax={eeScaleMax}
              />
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

const styles: Readonly<Record<string, CSSProperties>> = {
  rail: {
    boxSizing: 'border-box',
    display: 'grid',
    gap: '16px',
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    alignContent: 'start',
    padding: '16px',
    color: COLORS.ink,
    backgroundColor: COLORS.surface,
    fontFamily: 'inherit',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    minWidth: 0,
  },
  eyebrow: {
    margin: 0,
    color: COLORS.muted,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    lineHeight: 1.25,
    textTransform: 'uppercase',
  },
  title: {
    margin: '4px 0 0',
    color: COLORS.ink,
    fontSize: '24px',
    lineHeight: 1.15,
  },
  phase: {
    flex: '0 0 auto',
    padding: '6px 8px',
    border: `1px solid ${COLORS.amber}`,
    borderRadius: '6px',
    color: COLORS.ink,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  presentationSection: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
    padding: '12px',
    border: `2px solid ${COLORS.cyan}`,
    borderRadius: '10px',
    backgroundColor: 'rgba(7, 36, 43, 0.94)',
  },
  presentationGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    alignItems: 'stretch',
    gap: '8px',
  },
  presentationEndpoint: {
    display: 'grid',
    gap: '3px',
    minWidth: 0,
    padding: '8px',
    border: `1px solid ${COLORS.line}`,
    borderRadius: '6px',
    backgroundColor: COLORS.surface,
    color: COLORS.ink,
    fontSize: '14px',
    fontVariantNumeric: 'tabular-nums',
  },
  presentationMetrics: {
    color: COLORS.cyan,
    fontSize: '12px',
    lineHeight: 1.3,
    overflowWrap: 'anywhere',
  },
  presentationArrow: {
    display: 'grid',
    placeItems: 'center',
    color: COLORS.cyan,
    fontSize: '20px',
    fontWeight: 800,
  },
  storySection: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
    padding: '12px',
    border: `2px solid ${COLORS.blue}`,
    borderRadius: '10px',
    backgroundColor: 'rgba(6, 30, 43, 0.96)',
  },
  surfacePlaceholder: {
    display: 'grid',
    gap: '8px',
    minWidth: 0,
    padding: '12px',
    border: `2px dashed ${COLORS.quiet}`,
    borderRadius: '10px',
    backgroundColor: 'rgba(5, 20, 28, 0.88)',
  },
  surfacePlaceholderStatus: {
    flex: '0 0 auto',
    padding: '5px 8px',
    border: `1px solid ${COLORS.quiet}`,
    borderRadius: '6px',
    color: COLORS.muted,
    fontSize: '13px',
    fontWeight: 800,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  surfacePlaceholderReason: {
    padding: '9px',
    borderRadius: '7px',
    color: COLORS.muted,
    backgroundColor: 'rgba(2, 16, 24, 0.72)',
    fontSize: '14px',
    lineHeight: 1.4,
  },
  storyBadge: {
    flex: '0 0 auto',
    padding: '5px 8px',
    border: `1px solid ${COLORS.blue}`,
    borderRadius: '999px',
    color: COLORS.ink,
    backgroundColor: 'rgba(88, 191, 240, 0.14)',
    fontSize: '13px',
    fontWeight: 800,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  storyGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    alignItems: 'stretch',
    gap: '8px',
  },
  storyEndpoint: {
    display: 'grid',
    gap: '4px',
    minWidth: 0,
    padding: '9px',
    border: `1px solid ${COLORS.line}`,
    borderRadius: '7px',
    backgroundColor: 'rgba(2, 16, 24, 0.8)',
    color: COLORS.ink,
    fontSize: '15px',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  storyEeValue: {
    color: COLORS.cyan,
    fontSize: '16px',
    fontWeight: 800,
    lineHeight: 1.25,
  },
  storyArrow: {
    display: 'grid',
    placeItems: 'center',
    color: COLORS.blue,
    fontSize: '20px',
    fontWeight: 800,
  },
  storyFooter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '8px 12px',
    color: COLORS.muted,
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.3,
  },
  storyWinnerBadge: {
    padding: '4px 7px',
    borderRadius: '5px',
    color: COLORS.green,
    backgroundColor: 'rgba(82, 242, 161, 0.12)',
    fontWeight: 800,
  },
  identityPanel: {
    display: 'grid',
    gap: '10px',
    margin: 0,
    padding: '12px',
    border: `1px solid ${COLORS.line}`,
    borderRadius: '8px',
    backgroundColor: COLORS.white,
  },
  identityItem: {
    display: 'grid',
    gridTemplateColumns: '88px minmax(0, 1fr)',
    alignItems: 'baseline',
    gap: '8px',
    minWidth: 0,
    margin: 0,
  },
  identityLabel: {
    color: COLORS.muted,
    fontSize: '13px',
    lineHeight: 1.3,
  },
  identityValue: {
    minWidth: 0,
    margin: 0,
    color: COLORS.ink,
    fontSize: '14px',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  groupToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    minWidth: 0,
  },
  groupToggle: {
    flex: '0 0 auto',
    padding: '6px 9px',
    border: `1px solid ${COLORS.line}`,
    borderRadius: '6px',
    color: COLORS.ink,
    backgroundColor: COLORS.surfaceAlt,
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: 750,
    lineHeight: 1.2,
    cursor: 'pointer',
  },
  sectionHeading: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '12px',
    minWidth: 0,
  },
  detailsSummary: {
    cursor: 'pointer',
    listStyle: 'none',
  },
  sectionTitle: {
    margin: '4px 0 0',
    color: COLORS.ink,
    fontSize: '19px',
    lineHeight: 1.2,
  },
  servingSection: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
    padding: '14px',
    border: `2px solid ${COLORS.amber}`,
    borderRadius: '10px',
    background: 'linear-gradient(180deg, rgba(130, 103, 10, 0.30), rgba(15, 31, 33, 0.72))',
  },
  servingDetails: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
  },
  activeBadge: {
    flex: '0 0 auto',
    color: COLORS.green,
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1.25,
    textAlign: 'right',
  },
  beamRow: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
    padding: '12px',
    borderRadius: '8px',
    color: COLORS.ink,
    cursor: 'pointer',
  },
  beamRowHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    minWidth: 0,
  },
  beamIdentity: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    minWidth: 0,
    fontSize: '16px',
    lineHeight: 1.25,
  },
  hueMarker: {
    flex: '0 0 auto',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  servingIdentity: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    fontSize: '18px',
    fontWeight: 800,
  },
  otherIdentity: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    fontSize: '16px',
    fontWeight: 750,
  },
  beamId: {
    flex: '0 0 auto',
    color: COLORS.muted,
    fontSize: '15px',
    fontWeight: 700,
  },
  servingRole: {
    flex: '0 0 auto',
    color: COLORS.amber,
    fontSize: '14px',
    fontWeight: 800,
  },
  roleLabel: {
    flex: '0 0 auto',
    color: COLORS.muted,
    fontSize: '14px',
    fontWeight: 700,
  },
  joinLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '6px',
    color: COLORS.muted,
    fontSize: '12px',
    lineHeight: 1.3,
  },
  joinKey: {
    color: COLORS.ink,
    fontSize: '12px',
    overflowWrap: 'anywhere',
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
    margin: 0,
  },
  eeSummary: {
    display: 'grid',
    gap: '6px',
    minWidth: 0,
    padding: '8px 9px',
    border: '1px solid ' + COLORS.line,
    borderRadius: '6px',
    backgroundColor: 'rgba(118, 234, 215, 0.055)',
  },
  eeSummaryHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    minWidth: 0,
  },
  eeSummaryLabel: {
    color: COLORS.cyan,
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '0.04em',
  },
  eeSummaryValue: {
    minWidth: 0,
    color: COLORS.ink,
    fontSize: '18px',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  eeTrack: {
    position: 'relative',
    display: 'block',
    width: '100%',
    height: '12px',
    overflow: 'hidden',
    borderRadius: '999px',
    backgroundColor: 'rgba(229, 244, 251, 0.14)',
  },
  eeFill: {
    display: 'block',
    height: '100%',
    minWidth: '2px',
    borderRadius: 'inherit',
    background: 'linear-gradient(90deg, ' + COLORS.blue + ', ' + COLORS.cyan + ')',
    transition: 'width 180ms ease-out',
  },
  eeDetailsHint: {
    color: COLORS.quiet,
    fontSize: '11px',
    lineHeight: 1.25,
  },
  metricCell: {
    display: 'grid',
    gap: '3px',
    minWidth: 0,
    margin: 0,
    padding: '7px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: '14px',
    lineHeight: 1.25,
  },
  metricValue: {
    display: 'grid',
    gap: '2px',
    minWidth: 0,
    margin: 0,
    color: COLORS.ink,
    fontSize: '17px',
    fontWeight: 750,
    lineHeight: 1.3,
    overflowWrap: 'anywhere',
  },
  unavailableReason: {
    color: COLORS.muted,
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  groupsSection: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
  },
  groupTotal: {
    flex: '0 0 auto',
    color: COLORS.muted,
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
  },
  groupList: {
    display: 'grid',
    gap: '8px',
    minWidth: 0,
  },
  group: {
    minWidth: 0,
    border: `1px solid ${COLORS.line}`,
    borderRadius: '8px',
    backgroundColor: COLORS.white,
  },
  groupSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    minWidth: 0,
    padding: '10px 12px',
    color: COLORS.ink,
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1.25,
  },
  groupSummaryInfo: {
    display: 'grid',
    gap: '3px',
    minWidth: 0,
  },
  groupTitle: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    fontWeight: 750,
  },
  groupCount: {
    flex: '0 0 auto',
    color: COLORS.muted,
    fontSize: '13px',
  },
  groupEeSummary: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(54px, 96px) auto',
    alignItems: 'center',
    gap: '6px',
    flex: '0 0 auto',
    minWidth: 0,
  },
  groupEeLabel: {
    color: COLORS.cyan,
    fontSize: '12px',
    fontWeight: 900,
  },
  groupEeTrack: {
    display: 'block',
    width: '100%',
    height: '7px',
    overflow: 'hidden',
    borderRadius: '999px',
    backgroundColor: 'rgba(229, 244, 251, 0.14)',
  },
  groupEeFill: {
    display: 'block',
    height: '100%',
    minWidth: '2px',
    borderRadius: 'inherit',
  },
  groupEeValue: {
    color: COLORS.ink,
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  groupRows: {
    display: 'grid',
    gap: '8px',
    padding: '0 8px 8px',
  },
  emptyState: {
    display: 'grid',
    gap: '4px',
    padding: '12px',
    border: `1px dashed ${COLORS.quiet}`,
    borderRadius: '8px',
    color: COLORS.muted,
    backgroundColor: COLORS.surfaceAlt,
    fontSize: '14px',
    lineHeight: 1.35,
  },
};
