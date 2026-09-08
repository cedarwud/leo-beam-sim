import type {
  VisualShowcaseArtifact,
  VisualShowcaseDecisionFrame,
  VisualShowcaseEvent,
  VisualShowcaseHandoverState,
  VisualShowcaseSeries,
} from '../../scene/visual-showcase-contract';

type DashboardInventoryField = string;

export type DashboardSeriesPlane = 'visual-showcase-v1';
export type DashboardSeriesProvenanceStatus =
  | 'producer-backed'
  | 'partial-producer-backed'
  | 'source-gap';

export interface DashboardSeriesProvenance {
  readonly plane: DashboardSeriesPlane;
  readonly status: DashboardSeriesProvenanceStatus;
  readonly inventoryField: DashboardInventoryField;
}

export interface DashboardValueSeries<TValue> {
  readonly source: string | null;
  readonly timesSec: readonly number[];
  readonly values: readonly TValue[];
}

export interface DashboardRewardScalarChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly primary: DashboardValueSeries<number>;
  readonly timeline: DashboardValueSeries<number>;
}

export interface DashboardRewardComponentsChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly byComponent: Readonly<Record<string, DashboardValueSeries<number>>>;
}

export interface DashboardObjectiveWeightsChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly values: Readonly<Record<string, number>>;
}

export interface DashboardTimelineDecision {
  readonly tSec: number;
  readonly actionIndex: number;
  readonly actionLabel: string;
  readonly previousSatelliteId: string;
  readonly previousBeamId: string;
  readonly selectedSatelliteId: string;
  readonly selectedBeamId: string;
  readonly selectedActionScore: number;
  readonly runnerUpActionScore: number | null;
  readonly scoreMargin: number | null;
  readonly diagnosticsRef: string;
}

export interface DashboardDecisionFrame {
  readonly id: string;
  readonly tSec: number;
  readonly ueId?: string;
  readonly sourceUserIndex?: number;
  readonly actionScores: readonly number[];
  readonly selectedActionIndex: number;
  readonly selectedActionScore: number;
  readonly runnerUpActionScore: number | null;
  readonly scoreMargin: number | null;
  readonly decisionActionValidityMask?: readonly boolean[];
}

export interface DashboardSelectedActionChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly actionIndex: DashboardValueSeries<number>;
  readonly selectedAction: DashboardValueSeries<number>;
  readonly timelineDecisions: readonly DashboardTimelineDecision[];
  readonly decisionFrames: readonly DashboardDecisionFrame[];
}

export interface DashboardActionScoresChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly dense: DashboardValueSeries<readonly number[]>;
  readonly decisionFrames: readonly DashboardDecisionFrame[];
}

export interface DashboardServingSatelliteChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly series: DashboardValueSeries<string>;
}

export interface DashboardHandoverStateSample {
  readonly tSec: number;
  readonly kind?: string;
  readonly phase: string;
  readonly phaseSource?: string;
  readonly sourceHandoverOccurred?: boolean;
  readonly servingSatelliteId: string;
  readonly servingBeamId: string;
  readonly targetSatelliteId?: string | null;
  readonly targetBeamId?: string | null;
}

export interface DashboardHandoverEvent {
  readonly id: string;
  readonly type: string;
  readonly tSec: number;
  readonly title: string;
  readonly entityRefs: readonly string[];
  readonly truthRefs: readonly string[];
}

export interface DashboardHandoverChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly phase: DashboardValueSeries<string>;
  readonly states: readonly DashboardHandoverStateSample[];
  readonly events: readonly DashboardHandoverEvent[];
}

export interface DashboardSinrChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly primary: DashboardValueSeries<number>;
  readonly serving: DashboardValueSeries<number>;
}

export interface DashboardThroughputChannel {
  readonly provenance: DashboardSeriesProvenance;
  readonly series: DashboardValueSeries<number>;
}

export interface DashboardSeriesModel {
  readonly plane: DashboardSeriesPlane;
  readonly rewardScalar: DashboardRewardScalarChannel;
  readonly rewardComponents: DashboardRewardComponentsChannel;
  readonly objectiveWeights: DashboardObjectiveWeightsChannel;
  readonly selectedAction: DashboardSelectedActionChannel;
  readonly actionScores: DashboardActionScoresChannel;
  readonly servingSatellite: DashboardServingSatelliteChannel;
  readonly handover: DashboardHandoverChannel;
  readonly sinr: DashboardSinrChannel;
  readonly throughput: DashboardThroughputChannel;
}

export type DashboardSeriesChannelKey = keyof Omit<DashboardSeriesModel, 'plane'>;

export interface DashboardSeriesChannelSpec {
  readonly key: DashboardSeriesChannelKey;
  readonly inventoryField: DashboardInventoryField;
}

export const DASHBOARD_SERIES_CHANNEL_SPECS = [
  { key: 'rewardScalar', inventoryField: 'step.reward' },
  { key: 'rewardComponents', inventoryField: 'step.reward' },
  { key: 'objectiveWeights', inventoryField: 'environment.objectiveWeights' },
  { key: 'selectedAction', inventoryField: 'step.selectedAction' },
  { key: 'actionScores', inventoryField: 'step.policyDiagnostics' },
  { key: 'servingSatellite', inventoryField: 'step.selectedServing' },
  { key: 'handover', inventoryField: 'step.handoverEvent' },
  { key: 'sinr', inventoryField: 'environment.channelModel' },
  { key: 'throughput', inventoryField: 'step.energyEfficiencyTerms' },
] as const satisfies readonly DashboardSeriesChannelSpec[];

const SOURCE_GAP_PROVENANCE: DashboardSeriesProvenanceStatus = 'source-gap';

const DASHBOARD_INVENTORY_STATUS: Readonly<Record<DashboardInventoryField, DashboardSeriesProvenanceStatus>> = {
  'step.reward': 'producer-backed',
  'environment.objectiveWeights': 'producer-backed',
  'step.selectedAction': 'producer-backed',
  'step.policyDiagnostics': 'partial-producer-backed',
  'step.selectedServing': 'producer-backed',
  'step.handoverEvent': 'partial-producer-backed',
  'environment.channelModel': 'partial-producer-backed',
  'step.energyEfficiencyTerms': 'partial-producer-backed',
};

function emptySeries<TValue>(source: string | null = null): DashboardValueSeries<TValue> {
  return {
    source,
    timesSec: [],
    values: [],
  };
}

function inventoryStatusFor(field: DashboardInventoryField): DashboardSeriesProvenanceStatus {
  return DASHBOARD_INVENTORY_STATUS[field] ?? SOURCE_GAP_PROVENANCE;
}

export function getDashboardSeriesChannelExpectedStatus(
  key: DashboardSeriesChannelKey,
): DashboardSeriesProvenanceStatus {
  const spec = DASHBOARD_SERIES_CHANNEL_SPECS.find(item => item.key === key);
  if (spec === undefined) return SOURCE_GAP_PROVENANCE;
  return inventoryStatusFor(spec.inventoryField);
}

function provenanceFor(
  key: DashboardSeriesChannelKey,
  hasProducerField: boolean,
): DashboardSeriesProvenance {
  const spec = DASHBOARD_SERIES_CHANNEL_SPECS.find(item => item.key === key);
  const inventoryField = spec?.inventoryField ?? 'step.sourceGaps';
  return {
    plane: 'visual-showcase-v1',
    status: hasProducerField ? inventoryStatusFor(inventoryField) : SOURCE_GAP_PROVENANCE,
    inventoryField,
  };
}

function fromVisualSeries<TValue>(
  series: VisualShowcaseSeries<TValue> | undefined,
): DashboardValueSeries<TValue> {
  if (series === undefined) return emptySeries<TValue>();
  return {
    source: series.source,
    timesSec: [...series.timesSec],
    values: [...series.values],
  };
}

function numberSeriesFromTimeline(
  artifact: VisualShowcaseArtifact,
  source: string,
  read: (frame: VisualShowcaseArtifact['timeline'][number]) => number,
): DashboardValueSeries<number> {
  return {
    source,
    timesSec: artifact.timeline.map(frame => frame.tSec),
    values: artifact.timeline.map(read),
  };
}

function hasValues<TValue>(series: DashboardValueSeries<TValue>): boolean {
  return series.values.length > 0;
}

function mapDecisionFrame(frame: VisualShowcaseDecisionFrame): DashboardDecisionFrame {
  return {
    id: frame.id,
    tSec: frame.tSec,
    ...(frame.ueId === undefined ? {} : { ueId: frame.ueId }),
    ...(frame.sourceUserIndex === undefined ? {} : { sourceUserIndex: frame.sourceUserIndex }),
    actionScores: [...frame.actionScores],
    selectedActionIndex: frame.selectedActionIndex,
    selectedActionScore: frame.selectedActionScore,
    runnerUpActionScore: frame.runnerUpActionScore,
    scoreMargin: frame.scoreMargin,
    ...(frame.decisionActionValidityMask === undefined
      ? {}
      : { decisionActionValidityMask: [...frame.decisionActionValidityMask] }),
  };
}

function mapHandoverState(
  tSec: number,
  handoverState: VisualShowcaseHandoverState,
): DashboardHandoverStateSample {
  return {
    tSec,
    ...(handoverState.kind === undefined ? {} : { kind: handoverState.kind }),
    phase: handoverState.phase,
    ...(handoverState.phaseSource === undefined ? {} : { phaseSource: handoverState.phaseSource }),
    ...(handoverState.sourceHandoverOccurred === undefined
      ? {}
      : { sourceHandoverOccurred: handoverState.sourceHandoverOccurred }),
    servingSatelliteId: handoverState.servingSatelliteId,
    servingBeamId: handoverState.servingBeamId,
    ...(handoverState.targetSatelliteId === undefined
      ? {}
      : { targetSatelliteId: handoverState.targetSatelliteId }),
    ...(handoverState.targetBeamId === undefined
      ? {}
      : { targetBeamId: handoverState.targetBeamId }),
  };
}

function mapHandoverEvent(event: VisualShowcaseEvent): DashboardHandoverEvent {
  return {
    id: event.id,
    type: event.type,
    tSec: event.tSec,
    title: event.title,
    entityRefs: [...event.entityRefs],
    truthRefs: [...event.truthRefs],
  };
}

// The handover channel must only carry handover-typed events. visual-showcase-v1
// `events[]` also includes rl-action / reward-change records; mapping those into
// the handover channel would mislabel them as handovers downstream. The full
// typed event list stays available on the artifact for the S3/S4 flowchart.
function isHandoverEvent(event: VisualShowcaseEvent): boolean {
  return event.type === 'handover' || event.type.startsWith('handover-');
}

function buildEmptyModel(): DashboardSeriesModel {
  return {
    plane: 'visual-showcase-v1',
    rewardScalar: {
      provenance: provenanceFor('rewardScalar', false),
      primary: emptySeries<number>('series.reward'),
      timeline: emptySeries<number>('timeline[].metrics.rewardScalar'),
    },
    rewardComponents: {
      provenance: provenanceFor('rewardComponents', false),
      byComponent: {},
    },
    objectiveWeights: {
      provenance: provenanceFor('objectiveWeights', false),
      values: {},
    },
    selectedAction: {
      provenance: provenanceFor('selectedAction', false),
      actionIndex: emptySeries<number>('series.actionIndex'),
      selectedAction: emptySeries<number>('diagnostics.selectedAction'),
      timelineDecisions: [],
      decisionFrames: [],
    },
    actionScores: {
      provenance: provenanceFor('actionScores', false),
      dense: emptySeries<readonly number[]>('diagnostics.actionScores'),
      decisionFrames: [],
    },
    servingSatellite: {
      provenance: provenanceFor('servingSatellite', false),
      series: emptySeries<string>('series.servingSatellite'),
    },
    handover: {
      provenance: provenanceFor('handover', false),
      phase: emptySeries<string>('series.handoverPhase'),
      states: [],
      events: [],
    },
    sinr: {
      provenance: provenanceFor('sinr', false),
      primary: emptySeries<number>('series.sinrDb'),
      serving: emptySeries<number>('timeline[].metrics.servingSinrDb'),
    },
    throughput: {
      provenance: provenanceFor('throughput', false),
      series: emptySeries<number>('timeline[].metrics.throughputMbps'),
    },
  };
}

export function buildDashboardSeriesModel(
  artifact: VisualShowcaseArtifact | null,
): DashboardSeriesModel {
  if (artifact === null) return buildEmptyModel();

  const rewardFromSeries = fromVisualSeries(artifact.series?.reward);
  const rewardFromTimeline = numberSeriesFromTimeline(
    artifact,
    'timeline[].metrics.rewardScalar',
    frame => frame.metrics.rewardScalar,
  );
  const rewardPrimary = hasValues(rewardFromSeries) ? rewardFromSeries : rewardFromTimeline;
  const decisionFrames = artifact.diagnostics?.decisionFrames.map(mapDecisionFrame) ?? [];
  const timelineDecisions: readonly DashboardTimelineDecision[] = [];
  const handoverStates = artifact.timeline.map(frame =>
    mapHandoverState(frame.tSec, frame.handoverState));
  const handoverEvents = artifact.events.filter(isHandoverEvent).map(mapHandoverEvent);

  const rewardComponents = Object.fromEntries(
    Object.entries(artifact.diagnostics?.rewardComponents ?? {})
      .map(([key, series]) => [key, fromVisualSeries(series)]),
  ) as Readonly<Record<string, DashboardValueSeries<number>>>;

  return {
    plane: 'visual-showcase-v1',
    rewardScalar: {
      provenance: provenanceFor('rewardScalar', hasValues(rewardPrimary)),
      primary: rewardPrimary,
      timeline: rewardFromTimeline,
    },
    rewardComponents: {
      provenance: provenanceFor('rewardComponents', Object.keys(rewardComponents).length > 0),
      byComponent: rewardComponents,
    },
    objectiveWeights: {
      provenance: provenanceFor(
        'objectiveWeights',
        Object.keys(artifact.diagnostics?.objectiveWeights ?? {}).length > 0,
      ),
      values: { ...(artifact.diagnostics?.objectiveWeights ?? {}) },
    },
    selectedAction: {
      provenance: provenanceFor(
        'selectedAction',
        artifact.series?.actionIndex !== undefined
          || artifact.diagnostics?.selectedAction !== undefined
          || timelineDecisions.length > 0,
      ),
      actionIndex: fromVisualSeries(artifact.series?.actionIndex),
      selectedAction: fromVisualSeries(artifact.diagnostics?.selectedAction),
      timelineDecisions,
      decisionFrames,
    },
    actionScores: {
      provenance: provenanceFor(
        'actionScores',
        artifact.diagnostics?.actionScores !== undefined || decisionFrames.length > 0,
      ),
      dense: fromVisualSeries(artifact.diagnostics?.actionScores),
      decisionFrames,
    },
    servingSatellite: {
      provenance: provenanceFor('servingSatellite', artifact.series?.servingSatellite !== undefined),
      series: fromVisualSeries(artifact.series?.servingSatellite),
    },
    handover: {
      provenance: provenanceFor(
        'handover',
        artifact.series?.handoverPhase !== undefined
          || handoverStates.length > 0
          || handoverEvents.length > 0,
      ),
      phase: fromVisualSeries(artifact.series?.handoverPhase),
      states: handoverStates,
      events: handoverEvents,
    },
    sinr: {
      provenance: provenanceFor(
        'sinr',
        artifact.series?.sinrDb !== undefined || artifact.timeline.length > 0,
      ),
      primary: fromVisualSeries(artifact.series?.sinrDb),
      serving: numberSeriesFromTimeline(
        artifact,
        'timeline[].metrics.servingSinrDb',
        frame => frame.metrics.servingSinrDb,
      ),
    },
    throughput: {
      provenance: provenanceFor('throughput', artifact.timeline.length > 0),
      series: numberSeriesFromTimeline(
        artifact,
        'timeline[].metrics.throughputMbps',
        frame => frame.metrics.throughputMbps,
      ),
    },
  };
}
