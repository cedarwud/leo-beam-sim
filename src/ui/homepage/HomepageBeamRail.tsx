import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { candidateLinkKeyString } from '../../engine/handover/candidateDecisionContract';
import { ANGLE_AWARE_EE_CONTRACT_VERSION } from '../../engine/signal/angle-aware-ee';
import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetric,
  HomepageBeamMetricsProjection,
  HomepageHandoverPresentation,
  HomepageHandoverStoryCellExample,
  HomepageHandoverStoryProjection,
  HomepagePlaybackTransportState,
  HomepageRailProjection,
} from '../../homepage/controller/contracts';
import { useLocale } from '../../i18n';
import { txBi } from '../signal-tuning/labels';
import { resolveHomepageSatelliteDisplayName } from '../../homepage/controller/homepageSatelliteDisplayName';
import { formatHomepageEe } from '../../homepage/controller/homepageMetricFormatters';
import { formatHomepageBeamCellLabel } from '../../homepage/controller/homepageBeamIdentity';
import {
  EE_THRESHOLD_MAX_KBIT_PER_JOULE,
  eeThresholdKbitPerJouleToBitsPerJoule,
} from '../../engine/handover/eeThreshold';

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
  /** Same-snapshot comparison evidence; kept out of the 3D scene. */
  /** Homepage teaching threshold, shown in Kbit/J and compared in bit/J. */
  readonly eeThresholdKbitPerJoule?: number | null;
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

// The rail scale is a visual contract, not an auto-fitting chart. Keeping it
// fixed prevents the threshold and every beam from moving when a new frame or
// a new handover target arrives.
const HOMEPAGE_EE_SCALE_MIN_BITS_PER_JOULE = 0;
const HOMEPAGE_EE_SCALE_MAX_BITS_PER_JOULE = EE_THRESHOLD_MAX_KBIT_PER_JOULE * 1000;

/**
 * The concrete cell set each reuse topology names.
 *
 * Keyed on `cellExample` rather than derived from `cellCount` on purpose: the
 * two travel together in the projection, so rendering both means a test can
 * tell a real projection from hard-coded copy.
 */
const CELL_EXAMPLE_LABEL: Readonly<Record<HomepageHandoverStoryCellExample, string>> = Object.freeze({
  'one-cell': 'C1',
  'seven-cell': 'C1–C7',
  'nineteen-cell': 'C1–C19',
});

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
  switching: { zh: '換手中', en: 'Handover' },
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
      return isEnglish ? 'Option' : '候選';
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

function eeRatio(
  ee: number | null,
  eeScaleMin: number,
  eeScaleMax: number,
): number {
  return ee === null || eeScaleMax <= eeScaleMin
    ? 0
    : Math.max(0, Math.min(1, (ee - eeScaleMin) / (eeScaleMax - eeScaleMin)));
}

function servingEeOpacity(
  ee: number | null,
  thresholdBitsPerJoule: number | null,
  eeScaleMin: number,
  eeScaleMax: number,
): number {
  if (ee === null) return 1;
  // Use the fixed homepage EE scale rather than the trigger as the colour
  // breakpoint.  The serving beam therefore fades during the whole decline,
  // while the threshold remains a separate handover decision marker.
  const displayMax = Math.max(
    eeScaleMax,
    thresholdBitsPerJoule ?? eeScaleMin,
    eeScaleMin + 1,
  );
  const ratio = Math.max(0, Math.min(1, (ee - eeScaleMin) / (displayMax - eeScaleMin)));
  return 0.3 + ratio * 0.7;
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
  eeThresholdBitsPerJoule = null,
  showThresholdMarker = false,
  visualOpacity = 1,
}: {
  readonly metric: HomepageBeamMetric | null;
  readonly link: RailLink | null;
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
  readonly isEnglish: boolean;
  readonly eeThresholdBitsPerJoule?: number | null;
  readonly showThresholdMarker?: boolean;
  readonly visualOpacity?: number;
}) {
  const ee = eeForRow(metric, link);
  const ratio = eeRatio(ee, eeScaleMin, eeScaleMax);
  const thresholdRatio = eeRatio(eeThresholdBitsPerJoule, eeScaleMin, eeScaleMax);
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
      <div style={styles.eeTrackShell}>
        <div
          role="progressbar"
          aria-label={isEnglish ? 'Energy efficiency' : 'Energy efficiency'}
          aria-valuemin={eeScaleMin}
          aria-valuemax={eeScaleMax}
          aria-valuenow={available ? ee : undefined}
          aria-valuetext={available ? formatHomepageEe(ee) : '—'}
          style={styles.eeTrack}
        >
          <span style={{ ...styles.eeFill, width: String(ratio * 100) + '%', opacity: visualOpacity }} />
        </div>
        {showThresholdMarker && eeThresholdBitsPerJoule !== null ? (
          <span
            data-testid="homepage-ee-threshold-marker"
            data-ee-threshold={String(eeThresholdBitsPerJoule)}
            data-ee-threshold-ratio={String(thresholdRatio)}
            style={{ ...styles.eeThresholdMarker, left: String(thresholdRatio * 100) + '%' }}
            title={`${isEnglish ? 'Threshold' : '閾值'} ${formatHomepageEe(eeThresholdBitsPerJoule)}`}
          />
        ) : null}
      </div>
      {showThresholdMarker && eeThresholdBitsPerJoule !== null ? (
        <div
          data-testid="homepage-ee-threshold-label"
          style={styles.eeThresholdLegend}
        >
          <span style={styles.eeThresholdSwatch} aria-hidden="true" />
          <strong>
            {isEnglish ? 'Threshold' : '閾值'} {formatHomepageEe(eeThresholdBitsPerJoule)}
          </strong>
        </div>
      ) : null}
      <span style={styles.eeDetailsHint}>
        {isEnglish
          ? 'Stable display · click for SINR · Power · Throughput'
          : '穩定顯示 · 點擊查看 SINR · Power · Throughput'}
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
  link = null,
  isEnglish,
  eeScaleMin,
  eeScaleMax,
  eeThresholdBitsPerJoule,
  showThresholdMarker,
}: {
  readonly reason: string;
  readonly link?: RailLink | null;
  readonly isEnglish: boolean;
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
  readonly eeThresholdBitsPerJoule?: number | null;
  readonly showThresholdMarker?: boolean;
}) {
  return (
    <div data-testid="homepage-beam-metrics" data-metric-details-expanded="false">
      <EeProgressSummary
        metric={null}
        link={link}
        eeScaleMin={eeScaleMin}
        eeScaleMax={eeScaleMax}
        isEnglish={isEnglish}
        eeThresholdBitsPerJoule={eeThresholdBitsPerJoule}
        showThresholdMarker={showThresholdMarker}
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
  eeThresholdBitsPerJoule = null,
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
  readonly eeThresholdBitsPerJoule?: number | null;
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
  const rowEe = eeForRow(metric, link);
  const visualOpacity = variant === 'serving' && metric?.isPrimaryServing === true
    ? servingEeOpacity(rowEe, eeThresholdBitsPerJoule, eeScaleMin, eeScaleMax)
    : 1;
  const showThresholdMarker = variant === 'serving'
    && (metric?.isPrimaryServing === true || handoverRole === 'source');
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
      outline: `${handoverRole === 'target' ? 3 : 2}px solid ${accent}`,
      outlineOffset: '-2px',
      boxShadow: handoverRole === 'source'
        ? `inset 0 0 0 1px ${accent}, 0 0 0 1px rgba(255,255,255,0.08)`
        : `inset 0 0 0 2px ${accent}, 0 0 0 2px rgba(118, 234, 215, 0.42), 0 0 16px ${accent}66`,
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
          <span
            style={{ ...styles.hueMarker, backgroundColor: accent, opacity: visualOpacity }}
            aria-hidden="true"
          />
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
          link={link}
          isEnglish={isEnglish}
          eeScaleMin={eeScaleMin}
          eeScaleMax={eeScaleMax}
          eeThresholdBitsPerJoule={eeThresholdBitsPerJoule}
          showThresholdMarker={showThresholdMarker}
        />
      ) : (
        <>
          <EeProgressSummary
            metric={metric}
            link={link}
            eeScaleMin={eeScaleMin}
            eeScaleMax={eeScaleMax}
            isEnglish={isEnglish}
            eeThresholdBitsPerJoule={eeThresholdBitsPerJoule}
            showThresholdMarker={showThresholdMarker}
            visualOpacity={visualOpacity}
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
    const targetIsConfirmed = story.selectionStatus === 'selected'
      || story.selectionStatus === 'committed'
      || story.phase === 'switching'
      || story.phase === 'guard';
    if (targetIsConfirmed && rowKey === candidateLinkKeyString(story.target)) return 'target';
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

type HandoverRailEndpoint = {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly sinrDb: number | null;
};

function bestSameSatelliteAlternateMetric(
  metrics: readonly HomepageBeamMetric[],
  source: HandoverRailEndpoint,
): HomepageBeamMetric | null {
  return metrics
    .filter(metric => metric.satelliteId === source.satelliteId && metric.beamId !== source.beamId)
    .filter(metric => finiteEe(metric.energyEfficiencyBitsPerJoule) !== null)
    .sort((left, right) => (
      (finiteEe(right.energyEfficiencyBitsPerJoule) ?? -1)
      - (finiteEe(left.energyEfficiencyBitsPerJoule) ?? -1)
    ))[0] ?? null;
}

function handoverStatusLabel(
  story: HomepageHandoverStoryProjection | null,
  presentation: HomepageHandoverPresentation | null,
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

/**
 * Compact homepage handover readout. It joins accepted data only; it does not
 * select a candidate or recompute the handover decision.
 */
function IntraHandoverExplainer({
  story,
  presentation,
  serving,
  metrics,
  thresholdKbitPerJoule,
  eeScaleMin,
  eeScaleMax,
  isEnglish,
  satelliteNameById,
  showIdle,
}: {
  readonly story: HomepageHandoverStoryProjection | null;
  readonly presentation: HomepageHandoverPresentation | null;
  readonly serving?: RailLink | null;
  readonly metrics: readonly HomepageBeamMetric[];
  readonly thresholdKbitPerJoule: number | null;
  readonly eeScaleMin: number;
  readonly eeScaleMax: number;
  readonly isEnglish: boolean;
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  readonly showIdle: boolean;
}) {
  const currentServing: HandoverRailEndpoint | null = serving === null || serving === undefined
    ? null
    : {
      satelliteId: serving.satelliteId,
      beamId: serving.beamId,
      sinrDb: serving.opportunity?.sinr.status === 'available'
        ? serving.opportunity.sinr.value
        : null,
    };
  // The word "serving" has one meaning on this rail: the currently active
  // service pair. Both the explainer and the serving section below must join
  // that same pair. The accepted story source is kept separately as trigger
  // evidence, because after a commit it is intentionally the previous pair.
  const storySource: HandoverRailEndpoint | null = story === null
    ? null
    : { ...story.source, sinrDb: null };
  const storyCommitted = story?.selectionStatus === 'committed' || story?.phase === 'guard';
  const source: HandoverRailEndpoint | null = currentServing
    ?? presentation?.from
    ?? storySource;
  const requestedTarget: HandoverRailEndpoint | null = presentation !== null
    ? presentation.to
    : story !== null
      ? { ...story.target, sinrDb: null }
      : null;
  const sourceMetric = source === null
    ? null
    : metrics.find(metric => metric.satelliteId === source.satelliteId && metric.beamId === source.beamId) ?? null;
  const requestedTargetMetric = requestedTarget === null
    ? null
    : metrics.find(metric => metric.satelliteId === requestedTarget.satelliteId && metric.beamId === requestedTarget.beamId) ?? null;
  const alternateMetric = source === null ? null : bestSameSatelliteAlternateMetric(metrics, source);
  const targetFallback = source !== null
    && requestedTarget !== null
    && source.satelliteId === requestedTarget.satelliteId
    && source.beamId === requestedTarget.beamId
    && alternateMetric !== null;
  const target: HandoverRailEndpoint | null = targetFallback
    ? {
      satelliteId: alternateMetric!.satelliteId,
      beamId: alternateMetric!.beamId,
      sinrDb: alternateMetric!.sinrDb,
    }
    : requestedTarget;
  const targetMetric = targetFallback ? alternateMetric : requestedTargetMetric;
  const sourceLinkEe = source !== null
    && serving !== null
    && serving !== undefined
    && serving.satelliteId === source.satelliteId
    && serving.beamId === source.beamId
    ? finiteEe(serving.opportunity?.instantaneousEe?.value)
    : null;
  const sourceIsCurrentServing = source !== null
    && currentServing !== null
    && source.satelliteId === currentServing.satelliteId
    && source.beamId === currentServing.beamId;
  // The main source value is always the current serving row, so it matches the
  // serving block below. The accepted story value remains a separate witness
  // for the threshold crossing and is never allowed to replace a post-commit
  // serving value.
  const liveSourceEe = finiteEe(sourceMetric?.energyEfficiencyBitsPerJoule) ?? sourceLinkEe;
  const triggerSourceEe = finiteEe(story?.sourceEeBitsPerJoule);
  const sourceEe = liveSourceEe ?? (storyCommitted ? null : triggerSourceEe);
  const targetEe = (targetFallback ? null : finiteEe(story?.targetEeBitsPerJoule))
    ?? finiteEe(targetMetric?.energyEfficiencyBitsPerJoule);
  const thresholdBitsPerJoule = thresholdKbitPerJoule === null
    ? null
    : eeThresholdKbitPerJouleToBitsPerJoule(thresholdKbitPerJoule);
  const sourceOpacity = servingEeOpacity(sourceEe, thresholdBitsPerJoule, eeScaleMin, eeScaleMax);
  const thresholdEvidenceEe = story !== null ? triggerSourceEe : sourceEe;
  const sourceBelowThreshold = thresholdEvidenceEe !== null
    && thresholdBitsPerJoule !== null
    && thresholdEvidenceEe < thresholdBitsPerJoule;
  const sourceColor = sourceMetric?.color.color ?? COLORS.amber;
  const targetColor = targetMetric?.color.color
    ?? (source !== null && target !== null && source.satelliteId === target.satelliteId
      ? sourceColor
      : COLORS.cyan);
  const progress01 = presentation === null
    ? 0
    : Math.max(0, Math.min(1, presentation.progress01));
  const sourceLabel = source === null
    ? '—'
    : `${resolveHomepageSatelliteDisplayName(source.satelliteId, satelliteNameById)} / ${formatHomepageBeamCellLabel(source.beamId)}`;
  const targetLabel = target === null
    ? '—'
    : `${resolveHomepageSatelliteDisplayName(target.satelliteId, satelliteNameById)} / ${formatHomepageBeamCellLabel(target.beamId)}`;
  const thresholdLabel = thresholdKbitPerJoule === null
    ? '—'
    : `${thresholdKbitPerJoule.toFixed(0)} Kbit/J`;
  const sourceAvailable = source !== null;
  const pairAvailable = source !== null && target !== null;
  const handoverKind = presentation?.kind ?? story?.kind ?? null;
  const handoverPhase = presentation?.phase ?? story?.phase ?? 'idle';
  const handoverCue = presentation !== null
    ? presentation.phase === 'serving'
      ? (isEnglish ? 'Monitor: serving EE is falling on the fixed scale.' : '監測：服務 EE 正在固定尺度上緩慢下降')
      : presentation.phase === 'measuring'
        ? (isEnglish ? 'Compare: the target beam is highlighted before the handover.' : '比較：先標出即將換手的目標波束')
        : presentation.phase === 'holding'
          ? (isEnglish ? 'Confirm: source is below the trigger; target is held.' : '確認：服務 EE 已低於閾值，保留目標波束')
          : presentation.phase === 'releasing'
            ? (isEnglish ? 'Handover: the highlighted target is taking the link.' : '換手：外框標示的目標波束正在接手')
            : (isEnglish ? 'Settled: the new beam is now serving.' : '完成：新的波束已成為服務波束')
    : story !== null
      ? story.selectionStatus === 'committed'
        ? (isEnglish ? 'Committed: the selected beam is now serving.' : '已完成：選定波束已成為服務波束')
        : story.selectionStatus === 'selected'
          ? (isEnglish ? 'Selected: the best eligible beam is ready for handover.' : '已選定：最佳合資格波束已準備換手')
          : (isEnglish ? 'Evaluate: wait for EE to cross the trigger, then compare beams.' : '評估：等待 EE 低於閾值，再比較各波束')
      : (isEnglish ? 'Serving link: no handover is active.' : '目前服務鏈路：尚未進行換手');
  const storyPhaseIndex = presentation !== null
    ? ['serving', 'measuring', 'holding', 'releasing', 'settled'].indexOf(presentation.phase)
    : story === null
      ? 0
      // One accepted-decision phase per step, in the order the steps are drawn.
      // `switching` owns step 3; mapping it onto step 4 made the rail claim the
      // handover had finished while it was still being executed, and left step 3
      // unreachable on this lane. `qualifying` is the TTT accumulation, which is
      // step 2 ("confirm"), while `evaluating` is the candidate comparison.
      : story.selectionStatus === 'committed' || story.phase === 'guard'
        ? 4
        : story.phase === 'switching'
          ? 3
          : story.phase === 'selection-hold'
            || story.phase === 'qualifying'
            || story.selectionStatus === 'ttt-stable'
            || story.selectionStatus === 'selected'
            ? 2
            : story.phase === 'evaluating'
              ? 1
              : 0;
  const storySteps = isEnglish
    ? ['Monitor', 'Compare', 'Confirm', 'Switch', 'Settled']
    : ['監測', '比較', '確認', '換手', '完成'];
  if (!showIdle && !sourceAvailable && !pairAvailable) return null;

  return (
    <section
      aria-label={isEnglish ? 'Handover status and EE values' : '換手狀態與 EE 數值'}
      data-testid="homepage-handover-story"
      data-ui-surface="handover-readout"
      data-explainer-kind={handoverKind ?? ''}
      data-handover-kind={handoverKind ?? ''}
      data-handover-event-id={presentation?.eventId ?? ''}
      data-handover-source={presentation?.source ?? (story === null ? 'current-serving' : 'accepted-story')}
      data-handover-active={presentation === null ? 'false' : 'true'}
      data-handover-phase={handoverPhase}
      data-handover-from-sat-id={source?.satelliteId ?? ''}
      data-handover-from-beam-id={source === null ? '' : String(source.beamId)}
      data-handover-to-sat-id={target?.satelliteId ?? ''}
      data-handover-to-beam-id={target === null ? '' : String(target.beamId)}
      data-handover-target-fallback={targetFallback ? 'true' : 'false'}
      data-ee-threshold-kbit-per-joule={thresholdKbitPerJoule === null ? '' : String(thresholdKbitPerJoule)}
      data-ee-threshold-serving-ee={sourceEe === null ? '' : String(sourceEe)}
      data-ee-threshold-trigger-ee={thresholdEvidenceEe === null ? '' : String(thresholdEvidenceEe)}
      data-ee-threshold-relation={thresholdEvidenceEe === null || thresholdBitsPerJoule === null ? 'unavailable' : sourceBelowThreshold ? 'below' : 'above'}
      data-story-selection-status={story?.selectionStatus ?? 'idle'}
      data-story-cell-count={story === null ? '' : String(story.cellCount)}
      data-story-cell-example={story?.cellExample ?? ''}
      data-story-target-is-winner={story === null ? '' : story.targetIsWinner ? 'true' : 'false'}
      data-story-winner-basis={story?.winnerBasis ?? ''}
      data-story-qualified-candidate-count={story === null ? '' : String(story.qualifiedCandidateCount)}
      style={styles.handoverExplainerSection}
    >
      <div style={styles.sectionHeading}>
        <h3 style={styles.sectionTitle}>{isEnglish ? 'Handover status' : '換手狀態'}</h3>
        <span style={styles.storyBadge}>
          {handoverKind === null ? 'IDLE' : handoverKind.toUpperCase()} · {handoverPhase}
        </span>
      </div>
      <div
        data-testid="homepage-handover-story-cue"
        data-handover-cue-phase={handoverPhase}
        style={styles.handoverStoryCue}
      >
        {handoverCue}
      </div>
      <div
        data-testid="homepage-handover-story-steps"
        data-handover-step-index={String(Math.max(0, storyPhaseIndex))}
        style={styles.handoverStepRow}
      >
        {storySteps.map((step, index) => (
          <span
            key={step}
            style={{
              ...styles.handoverStep,
              color: index <= storyPhaseIndex ? COLORS.cyan : COLORS.quiet,
            }}
          >
            <span style={styles.handoverStepNumber} aria-hidden="true">{index + 1}</span>
            {step}
            {index < storySteps.length - 1 ? <span style={styles.handoverStepArrow} aria-hidden="true">›</span> : null}
          </span>
        ))}
      </div>
      <div style={styles.handoverReadoutGrid}>
        <div
          style={{ ...styles.handoverReadoutEndpoint, borderColor: sourceColor }}
          data-story-endpoint="source"
          data-handover-endpoint-summary="source"
        >
          <span style={styles.metricLabel}>
            {!sourceIsCurrentServing
              ? (isEnglish ? 'Previous serving' : '換手前服務波束')
              : (isEnglish ? 'Serving' : '服務波束')}
          </span>
          <strong style={styles.handoverReadoutIdentity}>
            <span style={{ ...styles.handoverColorDot, backgroundColor: sourceColor, opacity: sourceOpacity }} aria-hidden="true" />
            {sourceLabel}
          </strong>
          <span style={styles.handoverReadoutEe}>{formatHomepageEe(sourceEe)}</span>
          {triggerSourceEe !== null && story !== null && (
            <span
              data-testid="homepage-ee-trigger-evidence"
              style={styles.handoverReadoutSecondary}
            >
              {isEnglish ? 'Trigger EE ' : '觸發前 EE '}{formatHomepageEe(triggerSourceEe)}
            </span>
          )}
          {source?.sinrDb !== null && typeof source?.sinrDb === 'number' && Number.isFinite(source.sinrDb) ? (
            <span style={styles.handoverReadoutSecondary}>SINR {formatNumber(source.sinrDb, 'dB')}</span>
          ) : null}
        </div>
        <div style={styles.handoverReadoutArrow} aria-hidden="true">→</div>
        <div
          style={{ ...styles.handoverReadoutEndpoint, borderColor: targetColor }}
          data-story-endpoint="target"
          data-handover-endpoint-summary="target"
        >
          <span style={styles.metricLabel}>
            {presentation !== null
              ? (isEnglish ? 'Target beam' : '目標波束')
              : (isEnglish ? 'Beam option' : '候選波束')}
          </span>
          <strong style={styles.handoverReadoutIdentity}>
            <span style={{ ...styles.handoverColorDot, backgroundColor: targetColor }} aria-hidden="true" />
            {targetLabel}
          </strong>
          <span style={styles.handoverReadoutEe}>{formatHomepageEe(targetEe)}</span>
          {target?.sinrDb !== null && typeof target?.sinrDb === 'number' && Number.isFinite(target.sinrDb) ? (
            <span style={styles.handoverReadoutSecondary}>SINR {formatNumber(target.sinrDb, 'dB')}</span>
          ) : null}
        </div>
      </div>
      <div style={styles.handoverReadoutMeta}>
        <span data-testid="homepage-ee-threshold-state">
          {storyCommitted
            ? (isEnglish
              ? `Trigger EE ${formatHomepageEe(triggerSourceEe)} < ${thresholdLabel} · new service active`
              : `觸發前 EE ${formatHomepageEe(triggerSourceEe)} < ${thresholdLabel} · 新服務已接手`)
            : sourceBelowThreshold
            ? presentation !== null
              ? (isEnglish ? `EE below threshold ${thresholdLabel} · handover in progress` : `EE 低於閾值 ${thresholdLabel} · 換手進行中`)
              : (isEnglish ? `EE below threshold ${thresholdLabel} · comparing options` : `EE 低於閾值 ${thresholdLabel} · 比較候選波束`)
            : (isEnglish ? `EE above threshold ${thresholdLabel} · monitoring` : `EE 高於閾值 ${thresholdLabel} · 持續監測`)}
        </span>
        {presentation !== null ? (
          <span data-testid="homepage-intra-handover-progress">{isEnglish ? 'Progress' : '進度'} {Math.round(progress01 * 100)}%</span>
        ) : null}
      </div>
      {/*
        The cell-reuse topology and the EE-max selection criterion. `6b9474e`
        deleted both from this rail with no design comment; the projection kept
        computing them and a 12 KB overlay component that nothing imported was
        the only remaining reader. This is a teaching simulator, so the
        pedagogically meaningful half of the decision was the half that stopped
        reaching anyone.

        The criterion is stated as a CRITERION, never as an accomplished
        selection: `targetIsWinner` is derived from the objective and rank-one
        witness independently of `selectionStatus`, so a ttt-stable story can
        legitimately have a winner that has not been selected yet. The retired
        overlay did claim "Selected by instantaneous EE ordering" on exactly
        that state, which is why it was not simply wired back in.
      */}
      {story !== null ? (
        <div data-testid="homepage-handover-story-topology" style={styles.handoverReadoutMeta}>
          <span data-testid="homepage-handover-cell-count">
            {isEnglish
              ? `${story.cellCount} ${story.cellCount === 1 ? 'cell' : 'cells'} reused per satellite (${CELL_EXAMPLE_LABEL[story.cellExample]})`
              : `每顆衛星重用 ${story.cellCount} 個 Cell（${CELL_EXAMPLE_LABEL[story.cellExample]}）`}
          </span>
          <span data-testid="homepage-handover-winner-basis">
            {story.winnerBasis === 'instantaneous-ee-max'
              ? story.selectionStatus === 'committed'
                ? (isEnglish
                  ? `Committed by max instantaneous EE · ${story.qualifiedCandidateCount} qualified`
                  : `依瞬時 EE 最大提交 · ${story.qualifiedCandidateCount} 個合格候選`)
                : (isEnglish
                  ? `Criterion: max instantaneous EE · ${story.qualifiedCandidateCount} qualified`
                  : `選擇準則：瞬時 EE 最大 · ${story.qualifiedCandidateCount} 個合格候選`)
              : (isEnglish
                ? `Selection criterion unavailable · ${story.qualifiedCandidateCount} qualified`
                : `選擇準則無法判定 · ${story.qualifiedCandidateCount} 個合格候選`)}
          </span>
        </div>
      ) : null}
      {presentation !== null ? (
        <div style={styles.handoverTransitionTrack} aria-hidden="true">
          <span style={{ ...styles.handoverTransitionFill, width: String(progress01 * 100) + '%' }} />
        </div>
      ) : null}
      {!sourceAvailable && !pairAvailable ? (
        <div role="status" style={styles.handoverIdleNotice}>
          {isEnglish ? 'No accepted handover data' : '目前沒有 accepted 換手資料'}
        </div>
      ) : null}
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
  eeThresholdKbitPerJoule = null,
  showAllSurfaces = false,
}: HomepageBeamRailProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string): string => txBi(t, isEnglish, key, zh, en);
  const homepageEeThresholdKbitPerJoule = typeof eeThresholdKbitPerJoule === 'number'
    && Number.isFinite(eeThresholdKbitPerJoule)
    ? eeThresholdKbitPerJoule
    : null;
  const eeThresholdBitsPerJoule = homepageEeThresholdKbitPerJoule === null
    ? null
    : eeThresholdKbitPerJouleToBitsPerJoule(homepageEeThresholdKbitPerJoule);
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
  const railPresentation = handoverPresentation;
  const railStory = surfaceStory;
  const interTargetSatelliteId = railPresentation?.kind === 'inter'
    ? railPresentation.to.satelliteId
    : railStory?.kind === 'inter'
      ? railStory.target.satelliteId
      : null;
  // During inter handover the lower rail becomes the candidate satellite's
  // seven-beam roster. During intra handover it remains the same satellite's
  // other beams. This is a visibility filter only; candidate selection stays
  // in the accepted decision snapshot.
  const railCandidateSatelliteIds = interTargetSatelliteId === null
    ? candidateSatelliteIds
    : new Set([interTargetSatelliteId]);
  const railCandidateLinks = candidateLinks.filter(link => railCandidateSatelliteIds.has(link.satelliteId));
  const visibleSatelliteIds = new Set(railCandidateSatelliteIds);
  if (servingSatelliteId !== null) visibleSatelliteIds.add(servingSatelliteId);
  // BeamMetrics is the complete configured roster. The rail only removes
  // satellites outside the accepted serving/candidate set; it must not remove
  // beams inside a selected satellite's 1/7/19 roster.
  const metrics = beamMetrics === null
    ? []
    : allMetrics.filter(metric => visibleSatelliteIds.has(metric.satelliteId));
  const eeScaleMin = HOMEPAGE_EE_SCALE_MIN_BITS_PER_JOULE;
  const eeScaleMax = HOMEPAGE_EE_SCALE_MAX_BITS_PER_JOULE;
  const groups = buildSatelliteGroups(metrics, railCandidateLinks, servingSatelliteId);
  const linkByPairKey = new Map<string, RailLink>();
  if (servingLink !== null) linkByPairKey.set(pairJoinKey(servingLink), servingLink);
  for (const link of railCandidateLinks) linkByPairKey.set(pairJoinKey(link), link);
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
  // The primary serving link is always part of the visible story. In focused
  // one-cell mode the remaining six physical beams are part of the same
  // satellite roster and stay visible for direct intra comparison.
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
  const handoverStoryKey = railStory === null || railStory === undefined
    ? null
    : railStory.kind + '|' + candidateLinkKeyString(railStory.source) + '|' + candidateLinkKeyString(railStory.target);
  const [expandedGroupIds, setExpandedGroupIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  // Keep the six same-satellite beams visible on first render, while restoring
  // the disclosure interaction so the rail can be compacted when needed.
  const [servingExpanded, setServingExpanded] = useState(true);
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
    // A handover story makes candidate satellite groups visible at the moment
    // the story starts. Serving-satellite physical beams are always rendered.
    if (detailsExpansionModeRef.current === 'all-collapsed') return;
    setExpandedGroupIds(new Set(groupIds));
  }, [groupIdentity, handoverStoryKey, railStory?.kind]);
  const allDetailsExpanded = detailsExpansionMode === 'all-expanded'
    || (detailsExpansionMode !== 'all-collapsed'
      && servingExpanded
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
      data-ee-display-policy="log-ewma-rate-limited"
      data-snapshot-id={snapshotId}
      data-source-frame-id={sourceFrameId}
      data-phase={phase}
      data-phase-label={phaseLabel(phase, isEnglish)}
      data-handover-story-active={surfaceStory === null && handoverPresentation === null ? 'false' : 'true'}
      data-ee-threshold-kbit-per-joule={homepageEeThresholdKbitPerJoule === null ? '' : String(homepageEeThresholdKbitPerJoule)}
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
      {/*
        This was a `handoverComparison` REPLACEMENT slot, not an additive one:
        supplying it suppressed this explainer entirely. Its only intended
        occupant, `HomepageHandoverComparisonOverlay`, was never imported by any
        production file and is now deleted, so the seam is gone with it. The
        explainer is the single handover teaching surface again.
      */}
      <IntraHandoverExplainer
        story={surfaceStory}
        presentation={handoverPresentation}
        serving={servingLink}
        metrics={metrics}
        thresholdKbitPerJoule={homepageEeThresholdKbitPerJoule}
        eeScaleMin={eeScaleMin}
        eeScaleMax={eeScaleMax}
        isEnglish={isEnglish}
        satelliteNameById={satelliteNameById}
        showIdle={showAllSurfaces}
      />
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
                  handoverRole={handoverRoleForRow(metric, link, railPresentation, railStory)}
                  eeScaleMin={eeScaleMin}
                  eeScaleMax={eeScaleMax}
                  eeThresholdBitsPerJoule={eeThresholdBitsPerJoule}
                />
              ))}
            </div>
            {collapsibleServingRows.length > 0 ? (
              <details
                id="homepage-serving-beam-details"
                data-testid="homepage-serving-beam-details"
                open={servingExpanded}
                onToggle={event => {
                  const open = (event.currentTarget as HTMLDetailsElement).open;
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
                      handoverRole={handoverRoleForRow(metric, link, railPresentation, railStory)}
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
            {say('homepage.rail.candidates', '候選衛星', 'Beam options')}
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
                handoverPresentation={railPresentation}
                handoverStory={railStory}
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
  handoverExplainerSection: {
    display: 'grid',
    gap: '8px',
    minWidth: 0,
    padding: '10px',
    border: `2px solid ${COLORS.cyan}`,
    borderRadius: '8px',
    background: 'linear-gradient(180deg, rgba(7, 43, 49, 0.96), rgba(6, 25, 35, 0.98))',
  },
  handoverStoryCue: {
    padding: '7px 8px',
    border: '1px solid rgba(118, 234, 215, 0.42)',
    borderRadius: '6px',
    color: '#e0fbf6',
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    fontSize: '12px',
    fontWeight: 800,
    lineHeight: 1.35,
  },
  handoverReadoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    alignItems: 'stretch',
    gap: '6px',
    minWidth: 0,
  },
  handoverReadoutEndpoint: {
    display: 'grid',
    gap: '3px',
    minWidth: 0,
    padding: '7px',
    border: `1px solid ${COLORS.line}`,
    borderRadius: '6px',
    backgroundColor: COLORS.surface,
    color: COLORS.ink,
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  handoverReadoutIdentity: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    lineHeight: 1.2,
  },
  handoverReadoutEe: {
    color: COLORS.cyan,
    fontSize: '17px',
    fontWeight: 900,
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
  },
  handoverReadoutSecondary: {
    color: COLORS.muted,
    fontSize: '10px',
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
  },
  handoverReadoutArrow: {
    display: 'grid',
    placeItems: 'center',
    color: COLORS.cyan,
    fontSize: '18px',
    fontWeight: 900,
  },
  handoverReadoutEeBlock: {
    display: 'grid',
    gap: '4px',
    minWidth: 0,
    padding: '6px 7px',
    borderRadius: '6px',
    backgroundColor: 'rgba(2, 16, 24, 0.72)',
  },
  handoverReadoutEeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    minWidth: 0,
    color: COLORS.amber,
    fontSize: '11px',
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
  },
  handoverReadoutThresholdName: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    minWidth: 0,
    fontWeight: 850,
  },
  handoverReadoutThresholdValue: {
    flex: '0 0 auto',
    padding: '2px 5px',
    border: `1px solid ${COLORS.amber}`,
    borderRadius: '4px',
    backgroundColor: 'rgba(250, 204, 21, 0.14)',
    color: '#fff3a1',
    fontSize: '12px',
    fontWeight: 950,
    whiteSpace: 'nowrap',
  },
  handoverReadoutThresholdSwatch: {
    display: 'inline-block',
    flex: '0 0 auto',
    width: '4px',
    height: '12px',
    borderRadius: '999px',
    backgroundColor: COLORS.amber,
    boxShadow: '0 0 6px rgba(250, 204, 21, 0.9)',
  },
  handoverReadoutEeTrackShell: {
    position: 'relative',
    display: 'block',
    minWidth: 0,
    height: '12px',
  },
  handoverReadoutEeTrack: {
    position: 'relative',
    display: 'block',
    width: '100%',
    height: '12px',
    overflow: 'hidden',
    borderRadius: '999px',
    backgroundColor: 'rgba(229, 244, 251, 0.14)',
  },
  handoverReadoutTargetMarker: {
    position: 'absolute',
    top: '0',
    bottom: '0',
    zIndex: 1,
    width: '4px',
    borderRadius: '999px',
    transform: 'translateX(-50%)',
    boxShadow: '0 0 0 1px rgba(2, 16, 24, 0.8)',
  },
  handoverReadoutThresholdMarker: {
    position: 'absolute',
    top: '0',
    bottom: '0',
    zIndex: 2,
    width: '4px',
    borderRadius: '999px',
    backgroundColor: '#ffe66d',
    border: '1px solid #fff8c7',
    boxShadow: '0 0 0 1px rgba(2, 16, 24, 0.96), 0 0 8px rgba(250, 204, 21, 0.95)',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
  },
  handoverReadoutScale: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '5px',
    color: COLORS.muted,
    fontSize: '10px',
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
  },
  handoverReadoutThresholdText: {
    color: COLORS.amber,
    textAlign: 'center',
    fontWeight: 900,
    whiteSpace: 'nowrap',
    padding: '2px 5px',
    border: `1px solid ${COLORS.amber}`,
    borderRadius: '4px',
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
  },
  handoverReadoutMeta: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    minWidth: 0,
    color: COLORS.muted,
    fontSize: '11px',
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
  },
  handoverExplainerEyebrow: {
    display: 'block',
    color: COLORS.cyan,
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.09em',
    lineHeight: 1.2,
  },
  handoverStepRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 8px',
    borderRadius: '7px',
    color: COLORS.muted,
    backgroundColor: 'rgba(2, 16, 24, 0.72)',
    fontSize: '12px',
    fontWeight: 750,
    lineHeight: 1.25,
  },
  handoverStep: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  },
  handoverStepNumber: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '17px',
    height: '17px',
    border: '1px solid currentColor',
    borderRadius: '50%',
    fontSize: '10px',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  handoverStepArrow: {
    color: COLORS.cyan,
    fontWeight: 900,
  },
  handoverColorDot: {
    display: 'inline-block',
    width: '9px',
    height: '9px',
    marginInlineEnd: '5px',
    borderRadius: '50%',
    verticalAlign: '1px',
  },
  handoverEeComparison: {
    display: 'grid',
    gap: '6px',
    padding: '8px 9px',
    borderRadius: '7px',
    backgroundColor: 'rgba(2, 16, 24, 0.76)',
  },
  handoverEeTrackShell: {
    position: 'relative',
    display: 'block',
    minWidth: 0,
    paddingTop: '15px',
  },
  handoverEeTrack: {
    position: 'relative',
    display: 'block',
    width: '100%',
    height: '13px',
    overflow: 'hidden',
    borderRadius: '999px',
    backgroundColor: 'rgba(229, 244, 251, 0.14)',
  },
  handoverEeFill: {
    display: 'block',
    height: '100%',
    minWidth: '2px',
    borderRadius: 'inherit',
    transition: 'width 180ms ease-out, opacity 180ms ease-out',
  },
  handoverTargetEeMarker: {
    position: 'absolute',
    top: '-3px',
    width: '4px',
    height: '19px',
    borderRadius: '999px',
    transform: 'translateX(-50%)',
    boxShadow: '0 0 0 2px rgba(2, 16, 24, 0.8)',
  },
  handoverThresholdMarker: {
    position: 'absolute',
    top: '0',
    bottom: '0',
    zIndex: 2,
    width: '2px',
    backgroundColor: COLORS.amber,
    boxShadow: '0 0 0 1px rgba(2, 16, 24, 0.72)',
    pointerEvents: 'none',
  },
  handoverThresholdLabel: {
    position: 'absolute',
    top: '-1px',
    left: '50%',
    color: COLORS.amber,
    fontSize: '10px',
    fontWeight: 900,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -100%)',
  },
  handoverLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '5px 12px',
    color: COLORS.muted,
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.25,
  },
  handoverLegendDot: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    marginInlineEnd: '4px',
    borderRadius: '50%',
    verticalAlign: '1px',
  },
  handoverTransitionProgress: {
    display: 'grid',
    gap: '5px',
    padding: '8px 9px',
    border: `1px solid ${COLORS.line}`,
    borderRadius: '7px',
    backgroundColor: 'rgba(118, 234, 215, 0.055)',
  },
  handoverTransitionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
    color: COLORS.muted,
    fontSize: '12px',
    lineHeight: 1.2,
  },
  handoverTransitionTrack: {
    display: 'block',
    width: '100%',
    height: '8px',
    overflow: 'hidden',
    borderRadius: '999px',
    backgroundColor: 'rgba(229, 244, 251, 0.14)',
  },
  handoverTransitionFill: {
    display: 'block',
    height: '100%',
    minWidth: '2px',
    borderRadius: 'inherit',
    background: `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.cyan})`,
    transition: 'width 120ms linear',
  },
  handoverExplainerNote: {
    display: 'grid',
    gap: '3px',
    padding: '8px 9px',
    borderRadius: '7px',
    color: COLORS.muted,
    backgroundColor: 'rgba(2, 16, 24, 0.72)',
    fontSize: '13px',
    lineHeight: 1.4,
  },
  handoverIdleNotice: {
    padding: '10px',
    border: `1px dashed ${COLORS.quiet}`,
    borderRadius: '7px',
    color: COLORS.muted,
    backgroundColor: 'rgba(2, 16, 24, 0.72)',
    fontSize: '13px',
    lineHeight: 1.4,
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
  surfacePreviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
    alignItems: 'stretch',
    gap: '8px',
  },
  surfacePreviewEndpoint: {
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
    overflowWrap: 'anywhere',
  },
  surfacePreviewMetrics: {
    color: COLORS.cyan,
    fontSize: '12px',
    lineHeight: 1.3,
    overflowWrap: 'anywhere',
  },
  surfacePreviewArrow: {
    display: 'grid',
    placeItems: 'center',
    color: COLORS.cyan,
    fontSize: '20px',
    fontWeight: 800,
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
  eeTrackShell: {
    position: 'relative',
    display: 'block',
    minWidth: 0,
    height: '12px',
  },
  eeThresholdMarker: {
    position: 'absolute',
    top: '0',
    bottom: '0',
    zIndex: 2,
    width: '4px',
    backgroundColor: '#ffe66d',
    border: '1px solid #fff8c7',
    boxShadow: '0 0 0 1px rgba(2, 16, 24, 0.96), 0 0 8px rgba(250, 204, 21, 0.95)',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
  },
  eeThresholdLegend: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '5px',
    minWidth: 0,
    color: COLORS.amber,
    fontSize: '11px',
    fontWeight: 900,
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
  },
  eeThresholdSwatch: {
    display: 'inline-block',
    flex: '0 0 auto',
    width: '4px',
    height: '12px',
    borderRadius: '999px',
    backgroundColor: '#ffe66d',
    boxShadow: '0 0 6px rgba(250, 204, 21, 0.9)',
  },
  eeThresholdLabel: {
    position: 'absolute',
    top: '-1px',
    left: '50%',
    color: COLORS.amber,
    fontSize: '10px',
    fontWeight: 900,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -100%)',
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
