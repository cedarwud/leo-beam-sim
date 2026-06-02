import type { FlowchartEdgeBinding } from './flowchartModel';

export const FLOWCHART_DECISION_EDGE_IDS = [
  'state->qnet',
  'qnet->omega',
  'omega->mask',
] as const;

export interface CrossedBoundary {
  readonly tSec: number;
  readonly edgeIds: readonly string[];
}

interface EventBoundaryInput {
  readonly tSec: number;
  readonly type?: string;
}

interface DecisionBoundaryInput {
  readonly tSec: number;
}

export function mapEventTypeToEdgeIds(type: string): readonly string[] {
  // Match the S1 isHandoverEvent predicate: exact 'handover' is a handover too,
  // so the channel and the flowchart agree on what counts as a handover.
  if (type === 'handover' || type.startsWith('handover-')) return ['serving->handover'];
  if (type === 'rl-action') return ['mask->select', 'select->serving'];
  if (type === 'reward-change') return ['serving->reward'];
  return [];
}

export function findCrossedBoundaries(
  prevSec: number,
  curSec: number,
  events: readonly EventBoundaryInput[],
  decisionFrames: readonly DecisionBoundaryInput[],
): readonly CrossedBoundary[] {
  if (!Number.isFinite(prevSec) || !Number.isFinite(curSec) || curSec <= prevSec) return [];

  const crossed: CrossedBoundary[] = [];
  for (const event of events) {
    if (!Number.isFinite(event.tSec) || event.tSec <= prevSec || event.tSec > curSec) continue;
    const edgeIds = event.type === undefined ? [] : mapEventTypeToEdgeIds(event.type);
    if (edgeIds.length > 0) crossed.push({ tSec: event.tSec, edgeIds });
  }

  for (const frame of decisionFrames) {
    if (!Number.isFinite(frame.tSec) || frame.tSec <= prevSec || frame.tSec > curSec) continue;
    crossed.push({ tSec: frame.tSec, edgeIds: FLOWCHART_DECISION_EDGE_IDS });
  }

  return crossed.sort((left, right) => left.tSec - right.tSec);
}

export function resolvePulseEdgeIds(
  crossed: readonly CrossedBoundary[],
  bindings: readonly FlowchartEdgeBinding[],
): readonly string[] {
  const animatableIds = new Set(
    bindings.filter(binding => binding.animatable).map(binding => binding.edgeId),
  );
  const pulseIds = new Set<string>();

  for (const boundary of crossed) {
    for (const edgeId of boundary.edgeIds) {
      if (animatableIds.has(edgeId)) pulseIds.add(edgeId);
    }
  }

  return [...pulseIds];
}
