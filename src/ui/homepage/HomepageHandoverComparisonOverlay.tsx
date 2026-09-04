import { useState } from 'react';
import type { HomepageBeamMetric, HomepageRailProjection } from '../../homepage/controller/contracts';
import { candidateLinkKeyString } from '../../engine/handover/candidateDecisionContract';
import { homepageSatelliteColorForBeam } from '../../homepage/controller/homepageSatelliteVisualIdentity';
import { formatHomepageEe } from '../../homepage/controller/homepageMetricFormatters';
import { resolveHomepageSatelliteDisplayName } from '../../homepage/controller/homepageSatelliteDisplayName';
import { formatHomepageBeamCellLabel } from '../../homepage/controller/homepageBeamIdentity';
import { useLocale } from '../../i18n';

interface HomepageHandoverComparisonOverlayProps {
  /** The same accepted-snapshot projection already consumed by the right rail. */
  readonly projection: HomepageRailProjection;
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
}

interface ComparisonRow {
  readonly key: string;
  readonly satelliteId: string;
  readonly beamId: number;
  readonly label: string;
  readonly ee: number | null;
  readonly metric: HomepageBeamMetric | null;
  readonly color: string;
  readonly selected: boolean;
  readonly reference: boolean;
}

function finiteEe(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function rowMetric(
  projection: HomepageRailProjection,
  satelliteId: string,
  beamId: number,
): HomepageBeamMetric | null {
  return projection.beamMetrics?.metrics.find(candidate => (
    candidate.satelliteId === satelliteId && candidate.beamId === beamId
  )) ?? null;
}

function rowEe(
  projection: HomepageRailProjection,
  satelliteId: string,
  beamId: number,
  fallback: number | null,
): number | null {
  const metric = rowMetric(projection, satelliteId, beamId);
  const metricEe = finiteEe(metric?.energyEfficiencyBitsPerJoule);
  if (metricEe !== null) return metricEe;
  const link = [...(projection.visibleCandidates ?? projection.candidates ?? []), ...(projection.serving ? [projection.serving] : [])]
    .find(candidate => candidate.satelliteId === satelliteId && candidate.beamId === beamId);
  const opportunityEe = finiteEe(link?.opportunity?.instantaneousEe?.value);
  return opportunityEe ?? finiteEe(fallback);
}

function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  const scale = magnitude >= 1_000_000_000
    ? 1_000_000_000
    : magnitude >= 1_000_000
      ? 1_000_000
      : magnitude >= 1_000
        ? 1_000
        : 1;
  const prefix = scale === 1_000_000_000 ? 'G'
    : scale === 1_000_000 ? 'M'
      : scale === 1_000 ? 'k'
        : '';
  return (value / scale).toFixed(2) + ' ' + prefix + unit;
}

function bestCandidateLinkBySatellite(
  projection: HomepageRailProjection,
): readonly HomepageRailProjection['candidates'][number][] {
  const bestBySatellite = new Map<string, HomepageRailProjection['candidates'][number]>();
  for (const link of (projection.visibleCandidates ?? projection.candidates)) {
    if (!link.isCandidate) continue;
    const current = bestBySatellite.get(link.satelliteId);
    const currentRank = current?.state?.rank ?? Number.POSITIVE_INFINITY;
    const nextRank = link.state?.rank ?? Number.POSITIVE_INFINITY;
    if (current === undefined || nextRank < currentRank) bestBySatellite.set(link.satelliteId, link);
  }
  return [...bestBySatellite.values()];
}

function barWidth(ee: number | null, maxEe: number): string {
  if (ee === null || maxEe <= 0) return '0%';
  return `${Math.max(6, Math.min(100, (ee / maxEe) * 100))}%`;
}

function ComparisonBar({ row, maxEe }: { readonly row: ComparisonRow; readonly maxEe: number }) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const toggleDetails = (): void => {
    setDetailsExpanded(previous => !previous);
  };

  return (
    <div
      className="leo-homepage-handover-comparison__row"
      role="button"
      tabIndex={0}
      aria-expanded={detailsExpanded}
      data-comparison-key={row.key}
      data-comparison-satellite-id={row.satelliteId}
      data-comparison-beam-id={String(row.beamId)}
      data-comparison-selected={row.selected ? 'true' : 'false'}
      data-comparison-reference={row.reference ? 'true' : 'false'}
      data-comparison-metrics-expanded={detailsExpanded ? 'true' : 'false'}
      onClick={toggleDetails}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleDetails();
      }}
    >
      <div className="leo-homepage-handover-comparison__row-head">
        <span className="leo-homepage-handover-comparison__identity">
          <span
            className="leo-homepage-handover-comparison__swatch"
            style={{ backgroundColor: row.color }}
            aria-hidden="true"
          />
          <span>{row.label}</span>
        </span>
        <span className="leo-homepage-handover-comparison__value">
          {formatHomepageEe(row.ee)}
        </span>
      </div>
      <div className="leo-homepage-handover-comparison__track" aria-hidden="true">
        <span
          className="leo-homepage-handover-comparison__fill"
          style={{ width: barWidth(row.ee, maxEe), backgroundColor: row.color }}
        />
      </div>
      <div
        className="leo-homepage-handover-comparison__metrics"
        data-testid="homepage-handover-comparison-metrics"
        hidden={!detailsExpanded}
      >
        <span>SINR {formatMetricValue(row.metric?.sinrDb, 'dB')}</span>
        <span>Power {formatMetricValue(row.metric?.powerW, 'W')}</span>
        <span>Throughput {formatMetricValue(row.metric?.throughputBps, 'bit/s')}</span>
        <span>EE {formatHomepageEe(row.ee)}</span>
      </div>
    </div>
  );
}

/**
 * A small screen-anchored explanation layer for the homepage only.
 *
 * It is deliberately a projection of the accepted rail snapshot. It does not
 * select a candidate, recalculate EE, own a timer, or change the 3D carrier.
 * The 3D stage remains responsible for spatial identity and the handover
 * animation; this layer makes the common-scale comparison readable at a glance.
 */
export function HomepageHandoverComparisonOverlay({
  projection,
  satelliteNameById = null,
}: HomepageHandoverComparisonOverlayProps) {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  const story = projection.handoverStory ?? null;
  if (story === null) return null;

  const sourceKey = candidateLinkKeyString(story.source);
  const targetKey = candidateLinkKeyString(story.target);
  const sourceColor = homepageSatelliteColorForBeam(story.source.satelliteId, story.source.beamId).color;
  const targetColor = story.sameSatellite
    ? homepageSatelliteColorForBeam(story.source.satelliteId, story.source.beamId).color
    : homepageSatelliteColorForBeam(story.target.satelliteId, story.target.beamId).color;
  const sourceLabel = `${resolveHomepageSatelliteDisplayName(story.source.satelliteId, satelliteNameById)} / ${formatHomepageBeamCellLabel(story.source.beamId)}`;
  const targetLabel = `${resolveHomepageSatelliteDisplayName(story.target.satelliteId, satelliteNameById)} / ${formatHomepageBeamCellLabel(story.target.beamId)}`;

  const pairRows: readonly ComparisonRow[] = Object.freeze([
    {
      key: sourceKey,
      satelliteId: story.source.satelliteId,
      beamId: story.source.beamId,
      label: isEnglish ? `Source · ${sourceLabel}` : `來源 · ${sourceLabel}`,
     ee: rowEe(projection, story.source.satelliteId, story.source.beamId, story.sourceEeBitsPerJoule),
      metric: rowMetric(projection, story.source.satelliteId, story.source.beamId),
     color: sourceColor,
     selected: false,
     reference: true,
   },
   {
     key: targetKey,
     satelliteId: story.target.satelliteId,
     beamId: story.target.beamId,
     label: isEnglish ? `Target · ${targetLabel}` : `目標 · ${targetLabel}`,
     ee: rowEe(projection, story.target.satelliteId, story.target.beamId, story.targetEeBitsPerJoule),
      metric: rowMetric(projection, story.target.satelliteId, story.target.beamId),
     color: targetColor,
     selected: story.targetIsWinner,
     reference: false,
   },
 ]);

  const candidateRows: readonly ComparisonRow[] = Object.freeze(
    bestCandidateLinkBySatellite(projection).map(link => {
      const key = candidateLinkKeyString(link.key);
      const isTarget = key === targetKey;
      return {
        key,
        satelliteId: link.satelliteId,
        beamId: link.beamId,
        label: `${resolveHomepageSatelliteDisplayName(link.satelliteId, satelliteNameById)} / ${formatHomepageBeamCellLabel(link.beamId)}`,
       ee: rowEe(
         projection,
         link.satelliteId,
         link.beamId,
         isTarget ? story.targetEeBitsPerJoule : null,
       ),
        metric: rowMetric(projection, link.satelliteId, link.beamId),
       color: homepageSatelliteColorForBeam(link.satelliteId, link.beamId).color,
       selected: isTarget && story.targetIsWinner,
       reference: false,
     };
    }),
  );
  // Inter-cell comparison keeps the current serving beam as the baseline and
  // lists qualified candidate satellites on the same scale. The target row is
  // one of those candidates, not a second decision source.
  const rows = story.kind === 'inter' && candidateRows.length > 0
    ? [pairRows[0]!, ...candidateRows]
    : pairRows;
  const maxEe = Math.max(0, ...rows.map(row => row.ee ?? 0));
  const kind = story.kind === 'intra' ? 'intra' : 'inter';
  const title = story.kind === 'intra'
    ? (isEnglish ? 'Intra-cell beam handover' : '同一 Cell 內的 Beam 換手')
    : (isEnglish ? 'Inter-cell satellite selection' : '跨 Cell 的衛星選擇');
  const subtitle = story.kind === 'intra'
    ? (isEnglish ? 'Same cell · source beam → target beam' : '同一 Cell · 來源 Beam → 目標 Beam')
    : (isEnglish ? 'Qualified candidate satellites · common EE scale' : '合格候選衛星 · 共用 EE 尺度');
  const status = story.targetIsWinner
      ? (isEnglish ? 'Selected by instantaneous EE ordering' : '依瞬時 EE 排序選定')
      : story.selectionStatus === 'committed'
        ? (isEnglish ? 'Committed transition' : '換手已提交')
      : (isEnglish ? 'Candidate comparison' : '候選比較');

  return (
    <section
      className="leo-homepage-handover-comparison"
      data-testid="homepage-handover-comparison"
      data-comparison-kind={kind}
      data-comparison-phase={story.phase}
      data-comparison-cell-count={String(story.cellCount)}
      data-comparison-cell-example={story.cellExample}
      data-comparison-snapshot-id={story.snapshotId}
      data-comparison-source-frame-id={story.sourceFrameId}
      data-comparison-source-key={sourceKey}
      data-comparison-target-key={targetKey}
      data-comparison-qualified-candidate-count={String(story.qualifiedCandidateCount)}
      data-comparison-qualified-satellite-count={String(story.qualifiedCandidateSatelliteCount)}
      data-comparison-candidate-roster-source-frame-id={projection.candidateRosterSourceFrameId ?? projection.sourceFrameId}
      data-comparison-candidate-roster-retained={projection.candidateRosterRetained === true ? '1' : '0'}
      aria-label={title}
    >
      <div className="leo-homepage-handover-comparison__header">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <span className="leo-homepage-handover-comparison__cell-badge">
          {story.cellCount} {story.cellCount === 1 ? 'cell' : 'cells'}
        </span>
      </div>
      <div className="leo-homepage-handover-comparison__meta">
        <span>{status}</span>
        <span>EE · Kbit/J</span>
        {story.kind === 'inter' && (
          <span>{isEnglish ? 'Qualified candidates' : '合格候選'} {story.qualifiedCandidateSatelliteCount}</span>
        )}
      </div>
      <div className="leo-homepage-handover-comparison__bars">
        {rows.map(row => <ComparisonBar key={row.key} row={row} maxEe={maxEe} />)}
      </div>
      {story.kind === 'intra' && (
        <div className="leo-homepage-handover-comparison__transition" aria-hidden="true">
          {sourceLabel} <span>→</span> {targetLabel}
        </div>
      )}
    </section>
  );
}
