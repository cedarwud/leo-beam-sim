import type { ChangeEvent, ReactElement } from 'react';
import {
  formatEnergy,
  formatEnergyEfficiency,
  formatPower,
  formatRate,
} from '../../visualLab/format/compact';
import type { VisualLabLocale } from '../../visualLab/experiment';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';
import type {
  VisualLabCanonicalTimeline,
  VisualLabCanonicalTimelinePoint,
} from './visualLabCanonicalTimelineAdapter';

export interface VisualLabTimelineProps {
  readonly locale?: VisualLabLocale;
  readonly snapshot: VisualLabCanonicalSnapshot;
  readonly timeline: VisualLabCanonicalTimeline;
  readonly currentTimeSec: number;
  readonly playing?: boolean;
  readonly playbackRate?: number;
  readonly onPlayToggle?: () => void;
  readonly onSeek?: (elapsedSec: number) => void;
  readonly onStep?: (deltaSec: number) => void;
  readonly onPlaybackRateChange?: (rate: number) => void;
  readonly className?: string;
}

const TIMELINE_COPY = Object.freeze({
  'zh-Hant': Object.freeze({
    aria: '事件時間軸',
    eyebrow: '事件時間軸',
    title: '播放控制與時間位置',
    time: '時間',
    unavailable: '不可用',
    handover: '換手',
    legend: '圖例',
    throughput: '傳輸速率',
    power: '系統功率',
    energy: '累積能量',
    ee: '累積 EE',
    handoverEvent: '換手事件',
    summary: '目前數值',
    controls: '播放控制',
    back: '往前 15 秒',
    forward: '往後 15 秒',
    pause: '暫停',
    play: '播放',
    position: '時間位置',
    speed: '速度',
    eventList: '換手事件列表',
    markers: '換手時刻',
    none: '目前時間之前尚未發生換手',
    cursor: '目前時間',
  }),
  en: Object.freeze({
    aria: 'Event timeline',
    eyebrow: 'Event timeline',
    title: 'Playback controls and timeline position',
    time: 'Time',
    unavailable: 'unavailable',
    handover: 'Handover',
    legend: 'Legend',
    throughput: 'Throughput',
    power: 'System power',
    energy: 'Accumulated energy',
    ee: 'Accumulated EE',
    handoverEvent: 'Handover event',
    summary: 'Current values',
    controls: 'Playback controls',
    back: 'Back 15 seconds',
    forward: 'Forward 15 seconds',
    pause: 'Pause',
    play: 'Play',
    position: 'Timeline position',
    speed: 'Speed',
    eventList: 'Handover events',
    markers: 'Handover times',
    none: 'No handover has occurred before the current time',
    cursor: 'Current time',
  }),
});

const CHART_WIDTH = 760;
const CHART_HEIGHT = 182;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

// The legacy path helper above is intentionally kept stable for callers and
// tests.  The rendered chart uses a larger canvas with one independent band
// per metric.  Independent scales prevent watts, joules, bits/s and bit/J
// from becoming an unreadable stack of normalised lines.
const BAND_CHART_WIDTH = 900;
const BAND_CHART_HEIGHT = 348;
const BAND_PAD_LEFT = 142;
const BAND_PAD_RIGHT = 18;
const BAND_PAD_TOP = 16;
const BAND_HEIGHT = 60;
const BAND_GAP = 10;
const BAND_PLOT_BOTTOM = BAND_PAD_TOP + (BAND_HEIGHT * 4) + (BAND_GAP * 3);

function bandTop(index: number): number {
  return BAND_PAD_TOP + index * (BAND_HEIGHT + BAND_GAP);
}

function bandChartX(timeSec: number, durationSec: number): number {
  const width = BAND_CHART_WIDTH - BAND_PAD_LEFT - BAND_PAD_RIGHT;
  return BAND_PAD_LEFT + (durationSec <= 0 ? 0 : Math.min(1, Math.max(0, timeSec / durationSec))) * width;
}

export interface VisualLabTimelineSeriesPath {
  readonly d: string;
  readonly hasData: boolean;
}

function chartX(timeSec: number, durationSec: number): number {
  const width = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  return PAD_LEFT + (durationSec <= 0 ? 0 : Math.min(1, Math.max(0, timeSec / durationSec))) * width;
}

export function buildVisualLabSeriesPath(
  timeline: readonly VisualLabCanonicalTimelinePoint[],
  durationSec: number,
  read: (point: VisualLabCanonicalTimelinePoint) => number,
): VisualLabTimelineSeriesPath {
  const finiteValues = timeline.map(read).filter(Number.isFinite);
  if (finiteValues.length === 0) return { d: '', hasData: false };
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const range = max - min || Math.max(1, Math.abs(max) * 0.12);
  const chartBottom = CHART_HEIGHT - PAD_BOTTOM;
  const chartHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const commands: string[] = [];
  let previousWasFinite = false;
  timeline.forEach((point) => {
    const value = read(point);
    if (!Number.isFinite(value)) {
      // A missing sample is a real gap.  Starting a new sub-path prevents the
      // chart from silently drawing a line through an unavailable interval.
      previousWasFinite = false;
      return;
    }
    const x = chartX(point.timeSec, durationSec);
    const y = chartBottom - ((value - min) / range) * chartHeight;
    commands.push(`${previousWasFinite ? 'L' : 'M'} ${x.toFixed(2)} ${Math.max(PAD_TOP, Math.min(chartBottom, y)).toFixed(2)}`);
    previousWasFinite = true;
  });
  return { d: commands.join(' '), hasData: commands.length > 0 };
}

export interface VisualLabTimelineBandPath extends VisualLabTimelineSeriesPath {
  readonly min: number | null;
  readonly max: number | null;
}

/**
 * Build one metric's path inside an explicitly bounded chart band.
 *
 * Unlike a multi-series overlay, every band gets its own exact min/max scale.
 * Missing samples deliberately split the path so an unavailable interval is
 * never mistaken for a measured value.
 */
export function buildVisualLabBandPath(
  timeline: readonly VisualLabCanonicalTimelinePoint[],
  durationSec: number,
  read: (point: VisualLabCanonicalTimelinePoint) => number,
  top: number,
  height: number,
): VisualLabTimelineBandPath {
  const finiteValues = timeline.map(read).filter(Number.isFinite);
  if (finiteValues.length === 0) return { d: '', hasData: false, min: null, max: null };
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const range = max - min || Math.max(1, Math.abs(max) * 0.12);
  const bottom = top + height;
  const commands: string[] = [];
  let previousWasFinite = false;
  timeline.forEach((point) => {
    const value = read(point);
    if (!Number.isFinite(value)) {
      previousWasFinite = false;
      return;
    }
    const x = bandChartX(point.timeSec, durationSec);
    const y = bottom - ((value - min) / range) * height;
    commands.push(`${previousWasFinite ? 'L' : 'M'} ${x.toFixed(2)} ${Math.max(top, Math.min(bottom, y)).toFixed(2)}`);
    previousWasFinite = true;
  });
  return { d: commands.join(' '), hasData: commands.length > 0, min, max };
}

function finiteReadout<T>(value: number, formatter: (value: number) => T, unavailable: string): T | string {
  return Number.isFinite(value) ? formatter(value) : unavailable;
}

function axisLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function eventX(timeline: VisualLabCanonicalTimeline, timeSec: number): number {
  return bandChartX(timeSec, timeline.durationSec);
}

interface TimelineBandDefinition {
  readonly key: 'throughput' | 'power' | 'energy' | 'ee';
  readonly label: string;
  readonly className: string;
  readonly read: (point: VisualLabCanonicalTimelinePoint) => number;
  readonly format: (value: number) => string;
}

interface TimelineBandCopy {
  readonly throughput: string;
  readonly power: string;
  readonly energy: string;
  readonly ee: string;
}

function createBandDefinitions(copy: TimelineBandCopy): readonly TimelineBandDefinition[] {
  return [
    { key: 'throughput', label: copy.throughput, className: 'throughput', read: point => point.throughputBps, format: formatRate },
    { key: 'power', label: copy.power, className: 'power', read: point => point.powerW, format: formatPower },
    { key: 'energy', label: copy.energy, className: 'energy', read: point => point.energyJ, format: formatEnergy },
    { key: 'ee', label: copy.ee, className: 'ee', read: point => point.cumulativeEeBitsPerJ, format: formatEnergyEfficiency },
  ];
}

function handleSeek(
  event: ChangeEvent<HTMLInputElement>,
  onSeek: VisualLabTimelineProps['onSeek'],
): void {
  if (!onSeek) return;
  const elapsed = Number(event.currentTarget.value);
  if (Number.isFinite(elapsed)) onSeek(elapsed);
}

/**
 * A readable, aligned data/power/energy/EE timeline.  The four visual series
 * share an x-axis but occupy independent bands, so each unit keeps its own
 * scale while the exact current value remains visible beside the plot.
 */
export function VisualLabTimeline({
  locale = 'zh-Hant',
  snapshot,
  timeline,
  currentTimeSec,
  playing = false,
  playbackRate = 1,
  onPlayToggle,
  onSeek,
  onStep,
  onPlaybackRateChange,
  className,
}: VisualLabTimelineProps): ReactElement {
  const copy = TIMELINE_COPY[locale];
  const classNames = ['vlab-timeline', className].filter(Boolean).join(' ');
  const currentPoint = timeline.points.reduce<VisualLabCanonicalTimelinePoint | null>((nearest, point) => {
    if (nearest === null) return point;
    return Math.abs(point.timeSec - currentTimeSec) < Math.abs(nearest.timeSec - currentTimeSec) ? point : nearest;
  }, null);
  const bands = createBandDefinitions(copy).map((definition, index) => {
    const top = bandTop(index);
    return {
      definition,
      top,
      path: buildVisualLabBandPath(timeline.points, timeline.durationSec, definition.read, top, BAND_HEIGHT),
      currentValue: currentPoint === null ? Number.NaN : definition.read(currentPoint),
    };
  });
  const reachedEvents = timeline.markers.filter(event => event.timeSec <= currentTimeSec);
  const snapshotThroughput = snapshot.throughput.totalRateBps !== null && Number.isFinite(snapshot.throughput.totalRateBps)
    ? formatRate(snapshot.throughput.totalRateBps)
    : copy.unavailable;
  const snapshotPower = snapshot.power.systemPowerW !== null && Number.isFinite(snapshot.power.systemPowerW)
    ? formatPower(snapshot.power.systemPowerW)
    : copy.unavailable;
  const snapshotEe = snapshot.ee.cumulativeBitsPerJ !== null && Number.isFinite(snapshot.ee.cumulativeBitsPerJ)
    ? formatEnergyEfficiency(snapshot.ee.cumulativeBitsPerJ)
    : copy.unavailable;

  return (
    <section className={classNames} aria-label={copy.aria} data-mock="false" data-analysis-run-id={timeline.analysisRunId}>
      <div className="vlab-timeline__chart-wrap">
        <svg
          className="vlab-timeline__chart"
          viewBox={`0 0 ${BAND_CHART_WIDTH} ${BAND_CHART_HEIGHT}`}
          role="img"
          aria-label={`${copy.time} ${axisLabel(currentTimeSec)}; ${copy.throughput} ${snapshotThroughput}; ${copy.power} ${snapshotPower}; EE ${snapshotEe}`}
        >
          {bands.map(({ definition, top, path, currentValue }) => {
            const bandBottom = top + BAND_HEIGHT;
            const minimum = path.min === null ? copy.unavailable : definition.format(path.min);
            const maximum = path.max === null ? copy.unavailable : definition.format(path.max);
            const current = finiteReadout(currentValue, definition.format, copy.unavailable);
            return (
              <g className={`vlab-timeline__band vlab-timeline__band--${definition.className}`} key={definition.key} data-timeline-band={definition.key}>
                <rect className="vlab-timeline__band-background" x={BAND_PAD_LEFT} y={top} width={BAND_CHART_WIDTH - BAND_PAD_LEFT - BAND_PAD_RIGHT} height={BAND_HEIGHT} rx="4" />
                <line className="vlab-timeline__grid-line" x1={BAND_PAD_LEFT} x2={BAND_CHART_WIDTH - BAND_PAD_RIGHT} y1={top + BAND_HEIGHT / 2} y2={top + BAND_HEIGHT / 2} />
                <text className="vlab-timeline__band-label" x={BAND_PAD_LEFT - 12} y={top + 22} textAnchor="end">{definition.label}</text>
                <text className="vlab-timeline__band-current" x={BAND_PAD_LEFT - 12} y={top + 44} textAnchor="end">{current}</text>
                <text className="vlab-timeline__band-scale vlab-timeline__band-scale--max" x={BAND_PAD_LEFT + 8} y={top + 15}>{maximum}</text>
                <text className="vlab-timeline__band-scale vlab-timeline__band-scale--min" x={BAND_PAD_LEFT + 8} y={bandBottom - 7}>{minimum}</text>
                {path.hasData ? (
                  <path className={`vlab-timeline__series vlab-timeline__series--${definition.className}`} d={path.d} fill="none" data-series-availability="available" />
                ) : (
                  <text className={`vlab-timeline__series-unavailable vlab-timeline__series--${definition.className}`} x={BAND_PAD_LEFT + 12} y={top + 36} data-series-availability="unavailable">{definition.label}: {copy.unavailable}</text>
                )}
              </g>
            );
          })}
          {timeline.markers.map((event) => {
            const x = eventX(timeline, event.timeSec);
            return (
              <g className="vlab-timeline__handover-marker" key={`${event.timeSec}-${event.toSatelliteId}`}>
                <line x1={x} x2={x} y1={BAND_PAD_TOP} y2={BAND_PLOT_BOTTOM} />
                <circle cx={x} cy={BAND_PAD_TOP + 8} r="4" />
                <title>{`${copy.handover} ${axisLabel(event.timeSec)}: ${event.fromSatelliteId} → ${event.toSatelliteId}`}</title>
              </g>
            );
          })}
          <line
            className="vlab-timeline__cursor"
            x1={bandChartX(currentTimeSec, timeline.durationSec)}
            x2={bandChartX(currentTimeSec, timeline.durationSec)}
            y1={BAND_PAD_TOP}
            y2={BAND_PLOT_BOTTOM}
          />
          <circle
            className="vlab-timeline__cursor-dot"
            cx={bandChartX(currentTimeSec, timeline.durationSec)}
            cy={BAND_PLOT_BOTTOM}
            r="4"
          />
          <text className="vlab-timeline__axis-label" x={BAND_CHART_WIDTH / 2} y={BAND_CHART_HEIGHT - 8} textAnchor="middle">{axisLabel(timeline.durationSec / 2)}</text>
          <text className="vlab-timeline__axis-label" x={BAND_CHART_WIDTH - BAND_PAD_RIGHT} y={BAND_CHART_HEIGHT - 8} textAnchor="end">{axisLabel(timeline.durationSec)}</text>
        </svg>
      </div>

      <aside className="vlab-timeline__side">
        <div className="vlab-timeline__summary" aria-label={copy.summary}>
          {bands.map(({ definition, currentValue }) => (
            <div className={`vlab-timeline__summary-card vlab-timeline__summary-card--${definition.className}`} key={`summary-${definition.key}`}>
              <span>{definition.label}</span>
              <strong>{finiteReadout(currentValue, definition.format, copy.unavailable)}</strong>
            </div>
          ))}
        </div>

        <div className="vlab-timeline__legend" aria-label={copy.legend}>
          <span><i className="vlab-timeline__legend-swatch vlab-timeline__legend-swatch--throughput" aria-hidden="true" />{copy.throughput}</span>
          <span><i className="vlab-timeline__legend-swatch vlab-timeline__legend-swatch--power" aria-hidden="true" />{copy.power}</span>
          <span><i className="vlab-timeline__legend-swatch vlab-timeline__legend-swatch--energy" aria-hidden="true" />{copy.energy}</span>
          <span><i className="vlab-timeline__legend-swatch vlab-timeline__legend-swatch--ee" aria-hidden="true" />{copy.ee}</span>
          <span><i className="vlab-timeline__legend-swatch vlab-timeline__legend-swatch--handover" aria-hidden="true" />{copy.handoverEvent}</span>
        </div>

        <div className="vlab-timeline__controls">
          <div className="vlab-timeline__transport" aria-label={copy.controls}>
            <button className="vlab-timeline__step-button" type="button" onClick={() => onStep?.(-15)} disabled={onStep === undefined} aria-label={copy.back}>−15s</button>
            <button className="vlab-timeline__play-button" type="button" onClick={onPlayToggle} disabled={onPlayToggle === undefined} aria-pressed={playing}>
              <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>{playing ? copy.pause : copy.play}
            </button>
            <button className="vlab-timeline__step-button" type="button" onClick={() => onStep?.(15)} disabled={onStep === undefined} aria-label={copy.forward}>+15s</button>
          </div>
          <div className="vlab-timeline__seek">
            <label htmlFor="vlab-timeline-seek">{copy.position}</label>
            <input
              id="vlab-timeline-seek"
              className="vlab-timeline__seek-range"
              type="range"
              min={0}
              max={timeline.durationSec}
              step={timeline.stepSec}
              value={currentTimeSec}
              onChange={(event) => handleSeek(event, onSeek)}
              disabled={onSeek === undefined}
              aria-valuetext={`${axisLabel(currentTimeSec)} / ${axisLabel(timeline.durationSec)}`}
            />
            <span>{axisLabel(currentTimeSec)} / {axisLabel(timeline.durationSec)}</span>
          </div>
          <label className="vlab-timeline__speed">
            {copy.speed}
            <select value={playbackRate} onChange={(event) => onPlaybackRateChange?.(Number(event.currentTarget.value))} disabled={onPlaybackRateChange === undefined}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>

        <div className="vlab-timeline__event-strip" aria-label={copy.eventList}>
          <span className="vlab-timeline__event-strip-label">{copy.markers}</span>
          {reachedEvents.length === 0 ? <span className="vlab-timeline__event-empty">{copy.none}</span> : null}
          {reachedEvents.map((event) => (
            <button className="vlab-event-pill" type="button" key={`pill-${event.eventId}`} onClick={() => onSeek?.(event.timeSec)} disabled={onSeek === undefined}>
              <span>{axisLabel(event.timeSec)}</span><small>{event.fromSatelliteId} → {event.toSatelliteId}</small>
            </button>
          ))}
        </div>
      </aside>

      {currentPoint ? <p className="vlab-timeline__footnote">{copy.cursor} · {axisLabel(currentPoint.timeSec)}</p> : null}
    </section>
  );
}
