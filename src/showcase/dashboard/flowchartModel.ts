import type {
  DashboardSeriesChannelKey,
  DashboardSeriesModel,
  DashboardSeriesProvenanceStatus,
} from './seriesModel';

export type FlowchartNodeId =
  | 'state'
  | 'qnet'
  | 'omega'
  | 'mask'
  | 'select'
  | 'serving'
  | 'handover'
  | 'reward';

export interface FlowchartNode {
  readonly id: FlowchartNodeId;
  // Short display label (SVG <text> does not wrap; keep it node-box sized).
  readonly label: string;
  // Full description, rendered as an SVG <title> tooltip / accessible name.
  readonly title: string;
  readonly x: number;
  readonly y: number;
}

export interface FlowchartEdge {
  readonly from: FlowchartNodeId;
  readonly to: FlowchartNodeId;
  readonly sourceChannel: DashboardSeriesChannelKey | 'none';
}

export interface FlowchartEdgeBinding {
  readonly edgeId: string;
  readonly sourceChannel: DashboardSeriesChannelKey | 'none';
  readonly status: DashboardSeriesProvenanceStatus | 'none';
  readonly animatable: boolean;
}

// Landscape pipeline layout for the full-width AlgorithmDock strip (viewBox
// 0 0 360 42): a single left→right spine (state…handover) with the reward
// feedback bus dropping below `serving` and returning to `qnet`. See
// docs/flowchart-dock-landscape-relayout-sdd.md.
export const FLOWCHART_NODES = [
  { id: 'state', label: 'State', title: 'State (UE / SINR / serving)', x: 26, y: 12 },
  { id: 'qnet', label: 'Q-network', title: 'MODQN Q-network (per-objective heads)', x: 77, y: 12 },
  { id: 'omega', label: 'ω scalarize', title: 'ω scalarization', x: 129, y: 12 },
  { id: 'mask', label: 'Action mask', title: 'Action validity mask', x: 180, y: 12 },
  { id: 'select', label: 'argmax → select', title: 'argmax → selected action', x: 231, y: 12 },
  { id: 'serving', label: 'Serving', title: 'Serving (sat / beam)', x: 283, y: 12 },
  { id: 'handover', label: 'Handover', title: 'Handover', x: 334, y: 12 },
  { id: 'reward', label: 'Reward', title: 'Reward (r1/r2/r3 → scalar)', x: 283, y: 31 },
] as const satisfies readonly FlowchartNode[];

export const FLOWCHART_EDGES = [
  { from: 'state', to: 'qnet', sourceChannel: 'actionScores' },
  { from: 'qnet', to: 'omega', sourceChannel: 'objectiveWeights' },
  { from: 'omega', to: 'mask', sourceChannel: 'actionScores' },
  { from: 'mask', to: 'select', sourceChannel: 'selectedAction' },
  { from: 'select', to: 'serving', sourceChannel: 'servingSatellite' },
  { from: 'serving', to: 'handover', sourceChannel: 'handover' },
  { from: 'serving', to: 'reward', sourceChannel: 'rewardScalar' },
  { from: 'reward', to: 'qnet', sourceChannel: 'none' },
] as const satisfies readonly FlowchartEdge[];

export function flowchartEdgeId(edge: Pick<FlowchartEdge, 'from' | 'to'>): string {
  return `${edge.from}->${edge.to}`;
}

export function getFlowchartNodeById(id: string): FlowchartNode {
  const node = FLOWCHART_NODES.find(item => item.id === id);
  if (node === undefined) {
    throw new Error(`Unknown flowchart node id: ${id}`);
  }
  return node;
}

export function resolveFlowchartEdgeBindings(
  model: DashboardSeriesModel,
): readonly FlowchartEdgeBinding[] {
  return FLOWCHART_EDGES.map(edge => {
    if (edge.sourceChannel === 'none') {
      return {
        edgeId: flowchartEdgeId(edge),
        sourceChannel: edge.sourceChannel,
        status: 'none',
        animatable: false,
      };
    }

    const status = model[edge.sourceChannel].provenance.status;
    return {
      edgeId: flowchartEdgeId(edge),
      sourceChannel: edge.sourceChannel,
      status,
      animatable: status === 'producer-backed' || status === 'partial-producer-backed',
    };
  });
}
