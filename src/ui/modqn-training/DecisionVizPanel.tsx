import { useMemo } from 'react';
import type { JSX } from 'react';
import type { ModqnReplayEnvelope } from '../../modqn/replay-bundle';

type BundleProvenanceKind = 'paper-faithful' | 'user-trained';

const TOP_SVG_WIDTH = 260;
const TOP_BAR_HEIGHT = 18;
const TOP_ROW_GAP = 8;
const TOP_LEFT = 86;
const TOP_RIGHT = 42;
const TOP_TOP = 18;
const TOP_BOTTOM = 18;

const DENSE_SVG_WIDTH = 260;
const DENSE_SVG_HEIGHT = 72;
const DENSE_LEFT = 8;
const DENSE_RIGHT = 8;
const DENSE_TOP = 18;
const DENSE_BOTTOM = 16;

export interface DecisionVizPanelProps {
  readonly envelope: ModqnReplayEnvelope | null;
  readonly slotOffset: number;
  readonly bundleProvenanceKind: BundleProvenanceKind;
}

export interface DecisionVizFocusSnapshot {
  readonly selectedBeamId: string | null;
  readonly selectedScalarizedQ: number | null;
  readonly scalarizedMarginToRunnerUp: number | null;
  readonly runnersUpCount: number | null;
  readonly objectiveWeights: { r1?: number; r2?: number; r3?: number } | null;
  readonly topCandidates: readonly {
    readonly beamId: string;
    readonly scalarizedQ: number | null;
    readonly isSelected: boolean;
    readonly isInvalid: boolean;
  }[];
  readonly denseScores: readonly {
    readonly beamIndex: number;
    readonly value: number;
    readonly isSelected: boolean;
    readonly isInvalid: boolean;
  }[] | null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readFiniteNumberArray(value: unknown): readonly number[] | null {
  return Array.isArray(value)
    && value.length >= 1
    && value.every(item => typeof item === 'number' && Number.isFinite(item))
    ? value
    : null;
}

function readBooleanArray(value: unknown): readonly boolean[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'boolean')
    ? value
    : null;
}

function formatFixed(value: number | null, digits: number): string {
  return value === null ? '—' : value.toFixed(digits);
}

function formatWeight(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';
}

function formatHeaderBeamId(
  satId: unknown,
  localBeamIndex: unknown,
  fallbackBeamId: unknown,
): string | null {
  if (
    typeof satId === 'string'
    && typeof localBeamIndex === 'number'
    && Number.isFinite(localBeamIndex)
  ) {
    return `${satId}-beam-${localBeamIndex}`;
  }
  return typeof fallbackBeamId === 'string' && fallbackBeamId.length > 0 ? fallbackBeamId : null;
}

function invalidFromMask(mask: readonly boolean[] | null, beamIndex: unknown): boolean {
  return mask !== null
    && typeof beamIndex === 'number'
    && Number.isInteger(beamIndex)
    && mask[beamIndex] === false;
}

function selectedColor(kind: BundleProvenanceKind): string {
  return kind === 'user-trained' ? '#f5b042' : '#52d273';
}

function barColor(
  kind: BundleProvenanceKind,
  item: { readonly isSelected: boolean; readonly isInvalid: boolean },
): string {
  if (item.isInvalid) return '#3b454c';
  if (item.isSelected) return selectedColor(kind);
  return '#7a8a96';
}

function sortValue(value: number | null): number {
  return value === null ? -Infinity : value;
}

function getMaxAbs(values: readonly number[]): number {
  return Math.max(1, ...values.map(value => Math.abs(value)));
}

// D-S5 keeps policy diagnostics as a read-only projection of producer rows.
export function buildDecisionVizFocusSnapshot(
  envelope: ModqnReplayEnvelope | null,
  slotOffset: number,
): DecisionVizFocusSnapshot | null {
  if (envelope === null || envelope.replaySlots.length === 0) return null;

  const clampedSlotOffset = Math.min(
    Math.max(Math.trunc(slotOffset), 0),
    envelope.replaySlots.length - 1,
  );
  const focusedRow = envelope.replaySlots[clampedSlotOffset]?.rows[0];
  if (!focusedRow) return null;

  const { selectedServing, policyDiagnostics } = focusedRow.producerTruth;
  if (policyDiagnostics === undefined) return null;

  const selectedBeamId = formatHeaderBeamId(
    selectedServing.satId,
    selectedServing.localBeamIndex,
    selectedServing.beamId,
  );
  const selectedDenseBeamIndex = readFiniteNumber(selectedServing.beamIndex);
  const validityMask = readBooleanArray(policyDiagnostics.actionScoreValidityMask);
  const weights = policyDiagnostics.objectiveWeights;
  const objectiveWeights = weights
    ? {
        r1: readFiniteNumber(weights.r1Throughput) ?? undefined,
        r2: readFiniteNumber(weights.r2Handover) ?? undefined,
        r3: readFiniteNumber(weights.r3LoadBalance) ?? undefined,
      }
    : null;
  const rawTopCandidates = Array.isArray(policyDiagnostics.topCandidates)
    ? policyDiagnostics.topCandidates
    : [];
  const topCandidates = rawTopCandidates
    .map(candidate => {
      const beamId = typeof candidate.beamId === 'string' && candidate.beamId.length > 0
        ? candidate.beamId
        : formatHeaderBeamId(candidate.satId, candidate.localBeamIndex, null) ?? 'unknown-beam';
      return {
        beamId,
        scalarizedQ: readFiniteNumber(candidate.scalarizedQ),
        isSelected: selectedServing.beamId === beamId,
        isInvalid: invalidFromMask(validityMask, candidate.beamIndex),
      };
    })
    .sort((left, right) => sortValue(right.scalarizedQ) - sortValue(left.scalarizedQ));
  const denseActionScores = readFiniteNumberArray(policyDiagnostics.denseActionScores);
  const denseValidityMask = denseActionScores !== null
    && validityMask !== null
    && validityMask.length === denseActionScores.length
    ? validityMask
    : null;
  const denseScores = denseActionScores === null
    ? null
    : denseActionScores.map((value, beamIndex) => ({
        beamIndex,
        value,
        isSelected: selectedDenseBeamIndex === beamIndex,
        isInvalid: denseValidityMask?.[beamIndex] === false,
      }));

  return {
    selectedBeamId,
    selectedScalarizedQ: readFiniteNumber(policyDiagnostics.selectedScalarizedQ),
    scalarizedMarginToRunnerUp: readFiniteNumber(policyDiagnostics.scalarizedMarginToRunnerUp),
    runnersUpCount: (Array.isArray(policyDiagnostics.topCandidates) ? policyDiagnostics.topCandidates.length : 1) - 1,
    objectiveWeights,
    topCandidates,
    denseScores,
  };
}

interface TopCandidateChartProps {
  readonly snapshot: DecisionVizFocusSnapshot;
  readonly kind: BundleProvenanceKind;
}

function TopCandidateChart({ snapshot, kind }: TopCandidateChartProps): JSX.Element {
  const rows = snapshot.topCandidates;
  if (rows.length === 0) {
    return (
      <div className="leo-decision-viz-top-candidates" data-testid="decision-viz-top-candidates">
        <p className="leo-decision-viz-empty">no top candidates available</p>
      </div>
    );
  }

  const svgHeight = TOP_TOP + TOP_BOTTOM + (rows.length * TOP_BAR_HEIGHT) + ((rows.length - 1) * TOP_ROW_GAP);
  const plotWidth = TOP_SVG_WIDTH - TOP_LEFT - TOP_RIGHT;
  const zeroX = TOP_LEFT + (plotWidth / 2);
  const maxAbs = getMaxAbs(rows.map(row => row.scalarizedQ ?? 0));

  return (
    <svg
      className="leo-decision-viz-top-candidates"
      data-testid="decision-viz-top-candidates"
      viewBox={`0 0 ${TOP_SVG_WIDTH} ${svgHeight}`}
      role="img"
      aria-label="Top scalarized Q candidates"
    >
      <text className="leo-decision-viz-chart-title" x="8" y="12">top-K scalarized Q</text>
      <line className="leo-decision-viz-axis" x1={zeroX} y1={TOP_TOP - 2} x2={zeroX} y2={svgHeight - TOP_BOTTOM + 4} />
      {rows.map((row, index) => {
        const value = row.scalarizedQ ?? 0;
        const width = (Math.abs(value) / maxAbs) * (plotWidth / 2);
        const y = TOP_TOP + (index * (TOP_BAR_HEIGHT + TOP_ROW_GAP));
        const x = value >= 0 ? zeroX : zeroX - width;
        return (
          <g key={`${row.beamId}-${index}`}>
            <text className="leo-decision-viz-label" x="8" y={y + 13}>{row.beamId}</text>
            <rect
              x={x}
              y={y}
              width={width}
              height={TOP_BAR_HEIGHT}
              rx="2"
              fill={barColor(kind, row)}
            />
            {!row.isInvalid && row.scalarizedQ !== null ? (
              <text
                className="leo-decision-viz-value"
                x={value >= 0 ? x + width + 4 : x - 4}
                y={y + 13}
                textAnchor={value >= 0 ? 'start' : 'end'}
              >
                {row.scalarizedQ.toFixed(3)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

interface DenseScoresChartProps {
  readonly denseScores: NonNullable<DecisionVizFocusSnapshot['denseScores']>;
  readonly kind: BundleProvenanceKind;
}

function DenseScoresChart({ denseScores, kind }: DenseScoresChartProps): JSX.Element {
  const plotWidth = DENSE_SVG_WIDTH - DENSE_LEFT - DENSE_RIGHT;
  const plotHeight = DENSE_SVG_HEIGHT - DENSE_TOP - DENSE_BOTTOM;
  const maxAbs = getMaxAbs(denseScores.map(score => score.value));
  const barGap = denseScores.length > 28 ? 1 : 2;
  const barWidth = Math.max(1, (plotWidth - (barGap * (denseScores.length - 1))) / denseScores.length);

  return (
    <svg
      className="leo-decision-viz-dense-scores"
      data-testid="decision-viz-dense-scores"
      viewBox={`0 0 ${DENSE_SVG_WIDTH} ${DENSE_SVG_HEIGHT}`}
      role="img"
      aria-label="Dense action scalarized Q scores"
    >
      <text className="leo-decision-viz-chart-title" x="8" y="12">dense action scores</text>
      <line className="leo-decision-viz-axis" x1={DENSE_LEFT} y1={DENSE_TOP + plotHeight} x2={DENSE_LEFT + plotWidth} y2={DENSE_TOP + plotHeight} />
      {denseScores.map(score => {
        const height = (Math.abs(score.value) / maxAbs) * plotHeight;
        const x = DENSE_LEFT + (score.beamIndex * (barWidth + barGap));
        const y = DENSE_TOP + plotHeight - height;
        return (
          <rect
            key={score.beamIndex}
            x={x}
            y={y}
            width={barWidth}
            height={height}
            fill={barColor(kind, score)}
          />
        );
      })}
    </svg>
  );
}

// D-S5 panel is a pure replay consumer; missing producer diagnostics stay empty.
export function DecisionVizPanel({
  envelope,
  slotOffset,
  bundleProvenanceKind,
}: DecisionVizPanelProps): JSX.Element {
  const snapshot = useMemo(
    () => buildDecisionVizFocusSnapshot(envelope, slotOffset),
    [envelope, slotOffset],
  );

  if (snapshot === null) {
    return (
      <div data-testid="decision-viz-panel" className="leo-decision-viz-panel">
        <p className="leo-decision-viz-empty">policy diagnostics absent for this row</p>
      </div>
    );
  }

  const weightsReadout = snapshot.objectiveWeights === null
    ? 'ω = —'
    : `ω = (r1:${formatWeight(snapshot.objectiveWeights.r1)}, r2:${formatWeight(snapshot.objectiveWeights.r2)}, r3:${formatWeight(snapshot.objectiveWeights.r3)})`;

  return (
    <div data-testid="decision-viz-panel" className="leo-decision-viz-panel">
      <header className="leo-decision-viz-header">
        <div>
          selected {snapshot.selectedBeamId ?? '—'} · scalarizedQ = {formatFixed(snapshot.selectedScalarizedQ, 3)} · margin {formatFixed(snapshot.scalarizedMarginToRunnerUp, 3)} · runners-up: {snapshot.runnersUpCount ?? '—'}
        </div>
        <div data-testid="decision-viz-objective-weights-readout">
          {weightsReadout}
        </div>
      </header>
      <TopCandidateChart snapshot={snapshot} kind={bundleProvenanceKind} />
      {snapshot.denseScores !== null ? (
        <DenseScoresChart denseScores={snapshot.denseScores} kind={bundleProvenanceKind} />
      ) : null}
    </div>
  );
}
