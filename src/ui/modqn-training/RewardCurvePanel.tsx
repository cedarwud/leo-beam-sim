import { useMemo } from 'react';
import type { JSX } from 'react';
import type { ModqnReplayEnvelope } from '../../modqn/replay-bundle';

type BundleProvenanceKind = 'paper-faithful' | 'user-trained';
type RewardChannelKey = 'r1Throughput' | 'r2Handover' | 'r3LoadBalance';

const REWARD_CHANNEL_KEYS = [
  'r1Throughput',
  'r2Handover',
  'r3LoadBalance',
] as const satisfies readonly RewardChannelKey[];

const SVG_WIDTH = 220;
const SVG_HEIGHT = 110;
const PLOT_LEFT = 30;
const PLOT_RIGHT = 8;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 18;
const PLOT_WIDTH = SVG_WIDTH - PLOT_LEFT - PLOT_RIGHT;
const PLOT_HEIGHT = SVG_HEIGHT - PLOT_TOP - PLOT_BOTTOM;

export interface RewardCurvePanelProps {
  readonly envelope: ModqnReplayEnvelope | null;
  readonly slotOffset: number;
  readonly bundleProvenanceKind: BundleProvenanceKind;
}

export interface RewardCurveSeries {
  readonly scalar: readonly number[];
  readonly r1Throughput: readonly number[];
  readonly r2Handover: readonly number[];
  readonly r3LoadBalance: readonly number[];
  /**
   * D-S4 pure-consumer contract: null envelopes have no rows, so the
   * highlighter returns -1 and chart rendering suppresses the reference line.
   */
  readonly highlightAt: (slotOffset: number) => number;
}

function readFiniteReward(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapX(rowIndex: number, rowCount: number): number {
  if (rowCount <= 1) return PLOT_LEFT + (PLOT_WIDTH / 2);
  return PLOT_LEFT + ((rowIndex / (rowCount - 1)) * PLOT_WIDTH);
}

function mapY(value: number, min: number, max: number): number {
  return PLOT_TOP + ((1 - ((value - min) / (max - min))) * PLOT_HEIGHT);
}

function getChartRange(series: readonly number[]): { readonly min: number; readonly max: number } {
  if (series.length === 0) return { min: -0.5, max: 0.5 };
  let min = Infinity;
  let max = -Infinity;
  for (const value of series) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (min === max) return { min: min - 0.5, max: max + 0.5 };
  return { min, max };
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

// D-S4 keeps reward visualization as a read-only projection of producer rows.
export function buildRewardCurveSeries(envelope: ModqnReplayEnvelope | null): RewardCurveSeries {
  if (envelope === null) {
    return {
      scalar: [],
      r1Throughput: [],
      r2Handover: [],
      r3LoadBalance: [],
      highlightAt: () => -1,
    };
  }

  const scalar: number[] = [];
  const vectors: Record<RewardChannelKey, number[]> = {
    r1Throughput: [],
    r2Handover: [],
    r3LoadBalance: [],
  };
  const slotStartIndexes: number[] = [];
  let rowIndex = 0;

  for (const slot of envelope.replaySlots) {
    slotStartIndexes.push(rowIndex);
    for (const row of slot.rows) {
      const { producerTruth } = row;
      scalar.push(readFiniteReward(producerTruth.scalarReward));
      for (const key of REWARD_CHANNEL_KEYS) {
        vectors[key].push(readFiniteReward(producerTruth.rewardVector[key]));
      }
      rowIndex++;
    }
  }

  return {
    scalar,
    r1Throughput: vectors.r1Throughput,
    r2Handover: vectors.r2Handover,
    r3LoadBalance: vectors.r3LoadBalance,
    highlightAt: (slotOffset: number) => {
      if (slotStartIndexes.length === 0) return -1;
      const clampedSlotOffset = Math.min(
        Math.max(Math.trunc(slotOffset), 0),
        slotStartIndexes.length - 1,
      );
      return slotStartIndexes[clampedSlotOffset] ?? -1;
    },
  };
}

interface RewardChartProps {
  readonly testId: string;
  readonly title: string;
  readonly series: readonly number[];
  readonly highlightAt: number;
  readonly kind: BundleProvenanceKind;
}

function RewardChart({
  testId,
  title,
  series,
  highlightAt,
  kind,
}: RewardChartProps): JSX.Element {
  const { min, max } = getChartRange(series);
  const points = series
    .map((value, rowIndex) => `${mapX(rowIndex, series.length).toFixed(2)},${mapY(value, min, max).toFixed(2)}`)
    .join(' ');
  const highlightVisible = series.length > 0 && highlightAt >= 0 && highlightAt < series.length;
  const highlightX = highlightVisible ? mapX(highlightAt, series.length) : 0;
  const highlightColor = kind === 'user-trained'
    ? '#f5b042'
    : 'var(--leo-color-accent-green, #52d273)';

  return (
    <svg
      className="leo-reward-curve-chart"
      data-testid={testId}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      role="img"
      aria-label={`${title} reward curve`}
    >
      <text className="leo-reward-curve-chart__title" x="8" y="14">{title}</text>
      <line className="leo-reward-curve-chart__axis-line" x1={PLOT_LEFT} y1={PLOT_TOP} x2={PLOT_LEFT} y2={PLOT_TOP + PLOT_HEIGHT} />
      <line className="leo-reward-curve-chart__axis-line" x1={PLOT_LEFT} y1={PLOT_TOP + PLOT_HEIGHT} x2={PLOT_LEFT + PLOT_WIDTH} y2={PLOT_TOP + PLOT_HEIGHT} />
      <text className="leo-reward-curve-chart__axis" x="8" y={PLOT_TOP + 4}>{formatAxisValue(max)}</text>
      <text className="leo-reward-curve-chart__axis" x="8" y={PLOT_TOP + PLOT_HEIGHT}>{formatAxisValue(min)}</text>
      {points.length > 0 ? (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {highlightVisible ? (
        <line
          x1={highlightX}
          y1={PLOT_TOP}
          x2={highlightX}
          y2={PLOT_TOP + PLOT_HEIGHT}
          stroke={highlightColor}
          strokeWidth="1.5"
        />
      ) : null}
    </svg>
  );
}

export function RewardCurvePanel({
  envelope,
  slotOffset,
  bundleProvenanceKind,
}: RewardCurvePanelProps): JSX.Element {
  const curves = useMemo(() => buildRewardCurveSeries(envelope), [envelope]);
  const highlightAt = curves.highlightAt(slotOffset);
  const modeLabel = bundleProvenanceKind === 'user-trained' ? 'user-trained' : 'paper-faithful';

  return (
    <div data-testid="reward-curve-panel" className="leo-reward-curve-panel">
      <header className="leo-reward-curve-panel__header">
        Reward curves · {modeLabel}
      </header>
      {envelope === null ? (
        <p className="leo-reward-curve-panel__empty">No envelope loaded</p>
      ) : (
        <div className="leo-reward-curve-grid">
          <RewardChart
            testId="reward-curve-chart-scalar"
            title="scalarReward"
            series={curves.scalar}
            highlightAt={highlightAt}
            kind={bundleProvenanceKind}
          />
          <RewardChart
            testId="reward-curve-chart-r1-throughput"
            title="r1Throughput"
            series={curves.r1Throughput}
            highlightAt={highlightAt}
            kind={bundleProvenanceKind}
          />
          <RewardChart
            testId="reward-curve-chart-r2-handover"
            title="r2Handover"
            series={curves.r2Handover}
            highlightAt={highlightAt}
            kind={bundleProvenanceKind}
          />
          <RewardChart
            testId="reward-curve-chart-r3-load-balance"
            title="r3LoadBalance"
            series={curves.r3LoadBalance}
            highlightAt={highlightAt}
            kind={bundleProvenanceKind}
          />
        </div>
      )}
    </div>
  );
}
