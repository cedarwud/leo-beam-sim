import { useMemo, type JSX, type ReactNode } from 'react';
import { MiniRewardCurve } from '../../ui/modqn-controls/MiniRewardCurve';
import { AlgorithmFlowchart, type FlowchartTimeRef } from './AlgorithmFlowchart';
import {
  buildDashboardSeriesModel,
  type DashboardDecisionFrame,
  type DashboardSeriesProvenance,
  type DashboardTimelineDecision,
} from './seriesModel';

type VisualShowcaseArtifact = NonNullable<Parameters<typeof buildDashboardSeriesModel>[0]>;
type DashboardModel = ReturnType<typeof buildDashboardSeriesModel>;

export interface AlgorithmDashboardProps {
  readonly artifact: VisualShowcaseArtifact | null;
  readonly frameIndex: number;
  readonly currentTimeSecRef?: FlowchartTimeRef | null;
}

interface DashboardTileProps {
  readonly title: string;
  readonly testId: string;
  readonly provenance: DashboardSeriesProvenance;
  readonly extraProvenance?: DashboardSeriesProvenance;
  readonly hasValue: boolean;
  readonly children: ReactNode;
}

interface MetricRowProps {
  readonly label: string;
  readonly value: string;
}

const COMPONENT_PRIORITY = ['r1', 'r2', 'r3', 'throughput', 'handover', 'loadBalance'] as const;

function formatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? 'n/a' : formatNumber(value, 3);
}

function valueAtFrame<TValue>(
  values: readonly TValue[],
  frameIndex: number,
): TValue | null {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= values.length) return null;
  return values[frameIndex] ?? null;
}

function hasProducerValue(
  provenance: DashboardSeriesProvenance,
  count: number,
): boolean {
  return provenance.status !== 'source-gap' && count > 0;
}

function provenanceLabel(provenance: DashboardSeriesProvenance): string {
  return `${provenance.status} / plane=${provenance.plane}`;
}

function ProvenanceChip({
  provenance,
}: {
  readonly provenance: DashboardSeriesProvenance;
}): JSX.Element {
  return (
    <span
      className="leo-algorithm-dashboard__provenance-chip"
      data-testid="algorithm-dashboard-provenance-chip"
      data-provenance-status={provenance.status}
      data-provenance-plane={provenance.plane}
      title={provenance.inventoryField}
    >
      {provenanceLabel(provenance)}
    </span>
  );
}

function DashboardTile({
  title,
  testId,
  provenance,
  extraProvenance,
  hasValue,
  children,
}: DashboardTileProps): JSX.Element {
  const visible = hasProducerValue(provenance, hasValue ? 1 : 0)
    && (extraProvenance === undefined || extraProvenance.status !== 'source-gap');

  return (
    <section
      className="leo-algorithm-dashboard__tile"
      data-testid={testId}
      data-provenance-status={provenance.status}
      data-provenance-plane={provenance.plane}
    >
      <header className="leo-algorithm-dashboard__tile-header">
        <strong>{title}</strong>
        <span className="leo-algorithm-dashboard__chip-row">
          <ProvenanceChip provenance={provenance} />
          {extraProvenance ? <ProvenanceChip provenance={extraProvenance} /> : null}
        </span>
      </header>
      {visible ? (
        children
      ) : (
        <p className="leo-algorithm-dashboard__source-gap">source gap - not shown</p>
      )}
    </section>
  );
}

function MetricRow({ label, value }: MetricRowProps): JSX.Element {
  return (
    <div className="leo-algorithm-dashboard__metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function currentDecisionFrame(
  model: DashboardModel,
  frameIndex: number,
  decision: DashboardTimelineDecision | null,
): DashboardDecisionFrame | null {
  if (decision !== null) {
    const byRef = model.selectedAction.decisionFrames.find(frame => frame.id === decision.diagnosticsRef);
    if (byRef !== undefined) return byRef;
  }

  return valueAtFrame(model.selectedAction.decisionFrames, frameIndex);
}

function topActionScores(frame: DashboardDecisionFrame | null): readonly {
  readonly label: string;
  readonly value: number;
}[] {
  if (frame === null || frame.actionScores.length === 0) return [];
  return frame.actionScores
    .map((value, index) => ({ label: `A${index}`, value, index }))
    // G1/producer-truth: never surface a mask-invalid action as a top candidate.
    .filter(item => frame.decisionActionValidityMask?.[item.index] !== false)
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)
    .map(({ label, value }) => ({ label, value }));
}

function rewardComponentEntries(model: DashboardModel): readonly {
  readonly label: string;
  readonly values: readonly number[];
}[] {
  const entries = Object.entries(model.rewardComponents.byComponent);
  return [...entries]
    .sort(([left], [right]) => {
      const leftRank = COMPONENT_PRIORITY.indexOf(left as typeof COMPONENT_PRIORITY[number]);
      const rightRank = COMPONENT_PRIORITY.indexOf(right as typeof COMPONENT_PRIORITY[number]);
      const normalizedLeftRank = leftRank === -1 ? COMPONENT_PRIORITY.length : leftRank;
      const normalizedRightRank = rightRank === -1 ? COMPONENT_PRIORITY.length : rightRank;
      if (normalizedLeftRank !== normalizedRightRank) return normalizedLeftRank - normalizedRightRank;
      return left.localeCompare(right);
    })
    .slice(0, 3)
    .map(([label, series]) => ({
      label,
      values: series.values,
    }));
}

function currentFrameMarkerStyle(
  frameIndex: number,
  length: number,
): { readonly left: string } | null {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= length || length === 0) {
    return null;
  }
  const ratio = length === 1 ? 0 : frameIndex / (length - 1);
  return { left: `${Math.max(0, Math.min(100, ratio * 100)).toFixed(2)}%` };
}

export function AlgorithmDashboard({
  artifact,
  frameIndex,
  currentTimeSecRef = null,
}: AlgorithmDashboardProps): JSX.Element {
  const model = useMemo(() => buildDashboardSeriesModel(artifact), [artifact]);

  if (artifact === null) {
    return (
      <section
        className="leo-algorithm-dashboard leo-algorithm-dashboard--empty"
        data-testid="algorithm-dashboard"
        data-plane={model.plane}
        data-artifact-loaded="false"
      >
        <header className="leo-algorithm-dashboard__header">
          <strong>Algorithm dashboard</strong>
          <span>visual-showcase-v1</span>
        </header>
        <section
          className="leo-algorithm-dashboard__tile leo-algorithm-dashboard__tile--flowchart"
          data-testid="algorithm-dashboard-flowchart"
        >
          <header className="leo-algorithm-dashboard__tile-header">
            <strong>Decision pipeline</strong>
          </header>
          <AlgorithmFlowchart artifact={artifact} currentTimeSecRef={currentTimeSecRef} />
        </section>
        <p className="leo-algorithm-dashboard__empty">No artifact loaded.</p>
      </section>
    );
  }

  const rewardValues = model.rewardScalar.primary.values;
  const frameMarkerStyle = currentFrameMarkerStyle(frameIndex, rewardValues.length);
  const rewardAtFrame = valueAtFrame(rewardValues, frameIndex);
  const rewardComponents = rewardComponentEntries(model);
  const objectiveWeightEntries = Object.entries(model.objectiveWeights.values)
    .sort(([left], [right]) => left.localeCompare(right));
  const currentAction = valueAtFrame(model.selectedAction.timelineDecisions, frameIndex);
  const actionFrame = currentDecisionFrame(model, frameIndex, currentAction);
  const topScores = topActionScores(actionFrame);
  const servingSatellite = valueAtFrame(model.servingSatellite.series.values, frameIndex);
  const handoverState = valueAtFrame(model.handover.states, frameIndex);
  const handoverPhase = handoverState?.phase ?? valueAtFrame(model.handover.phase.values, frameIndex);
  const servingSinr = valueAtFrame(model.sinr.serving.values, frameIndex)
    ?? valueAtFrame(model.sinr.primary.values, frameIndex);
  const throughput = valueAtFrame(model.throughput.series.values, frameIndex);

  return (
    <section
      className="leo-algorithm-dashboard"
      data-testid="algorithm-dashboard"
      data-plane={model.plane}
      data-artifact-loaded="true"
      data-frame-index={String(frameIndex)}
    >
      <header className="leo-algorithm-dashboard__header">
        <strong>Algorithm dashboard</strong>
        <span>Plane C / visual-showcase-v1</span>
      </header>

      <section
        className="leo-algorithm-dashboard__tile leo-algorithm-dashboard__tile--flowchart"
        data-testid="algorithm-dashboard-flowchart"
      >
        <header className="leo-algorithm-dashboard__tile-header">
          <strong>Decision pipeline</strong>
        </header>
        <AlgorithmFlowchart artifact={artifact} currentTimeSecRef={currentTimeSecRef} />
      </section>

      <DashboardTile
        title="Reward scalar"
        testId="algorithm-dashboard-reward"
        provenance={model.rewardScalar.provenance}
        hasValue={rewardValues.length > 0}
      >
        <div className="leo-algorithm-dashboard__curve-wrap">
          <MiniRewardCurve rewards={rewardValues} />
          {frameMarkerStyle ? (
            <span
              className="leo-algorithm-dashboard__frame-marker"
              style={frameMarkerStyle}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <MetricRow label="current" value={rewardAtFrame === null ? 'frame unavailable' : formatNumber(rewardAtFrame)} />
      </DashboardTile>

      <DashboardTile
        title="Reward components"
        testId="algorithm-dashboard-reward-components"
        provenance={model.rewardComponents.provenance}
        hasValue={rewardComponents.length > 0}
      >
        <div className="leo-algorithm-dashboard__component-grid">
          {rewardComponents.map(component => {
            const componentValue = valueAtFrame(component.values, frameIndex);
            return (
              <MetricRow
                key={component.label}
                label={component.label}
                value={componentValue === null ? 'frame unavailable' : formatNumber(componentValue)}
              />
            );
          })}
        </div>
      </DashboardTile>

      <DashboardTile
        title="Objective weights"
        testId="algorithm-dashboard-objective-weights"
        provenance={model.objectiveWeights.provenance}
        hasValue={objectiveWeightEntries.length > 0}
      >
        <div className="leo-algorithm-dashboard__weights">
          {objectiveWeightEntries.map(([key, value]) => (
            <MetricRow key={key} label={key} value={formatNumber(value, 3)} />
          ))}
        </div>
      </DashboardTile>

      <DashboardTile
        title="Selected action"
        testId="algorithm-dashboard-action"
        provenance={model.selectedAction.provenance}
        hasValue={currentAction !== null || actionFrame !== null}
      >
        <div className="leo-algorithm-dashboard__decision">
          <MetricRow
            label="action"
            value={
              currentAction === null
                ? `A${actionFrame?.selectedActionIndex ?? 'n/a'}`
                : `${currentAction.actionLabel} / A${currentAction.actionIndex}`
            }
          />
          <MetricRow
            label="score"
            value={formatScore(currentAction?.selectedActionScore ?? actionFrame?.selectedActionScore)}
          />
          <MetricRow
            label="margin"
            value={formatScore(currentAction?.scoreMargin ?? actionFrame?.scoreMargin)}
          />
          {topScores.length > 0 ? (
            <div className="leo-algorithm-dashboard__score-strip" aria-label="Top action scores">
              {topScores.map(score => (
                <span key={score.label}>
                  {score.label} {formatScore(score.value)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </DashboardTile>

      <DashboardTile
        title="Serving"
        testId="algorithm-dashboard-serving"
        provenance={model.servingSatellite.provenance}
        hasValue={servingSatellite !== null || handoverState !== null}
      >
        <MetricRow label="satellite" value={servingSatellite ?? handoverState?.servingSatelliteId ?? 'frame unavailable'} />
        <MetricRow label="beam" value={handoverState?.servingBeamId ?? 'frame unavailable'} />
      </DashboardTile>

      <DashboardTile
        title="Handover"
        testId="algorithm-dashboard-handover"
        provenance={model.handover.provenance}
        hasValue={handoverPhase !== null || handoverState !== null}
      >
        <MetricRow label="phase" value={handoverPhase ?? 'frame unavailable'} />
        <MetricRow label="kind" value={handoverState?.kind ?? 'frame unavailable'} />
        <MetricRow label="events" value={String(model.handover.events.length)} />
      </DashboardTile>

      <DashboardTile
        title="SINR / throughput"
        testId="algorithm-dashboard-sinr"
        provenance={model.sinr.provenance}
        extraProvenance={model.throughput.provenance}
        hasValue={servingSinr !== null || throughput !== null}
      >
        <MetricRow label="SINR" value={servingSinr === null ? 'frame unavailable' : `${formatNumber(servingSinr)} dB`} />
        <MetricRow
          label="throughput"
          value={throughput === null ? 'frame unavailable' : `${formatNumber(throughput, 1)} Mbps`}
        />
      </DashboardTile>
    </section>
  );
}
