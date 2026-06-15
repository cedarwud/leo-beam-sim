// MODQN top-K decision trace builder.
//
// Extracted from the retired `ModqnEvidenceTab` so the relocated Top-K decision
// preview (`ModqnTopKDecisionPreview`, mounted in the Advanced setup drawer) keeps
// the SAME legacy trace over the shared MODQN handover state. This is display
// evidence only — it does not mutate producer selectedServing or bundle payloads.
import {
  reScalarize,
  scoreModqnPolicyCandidate,
  type ReScalarizeResult,
} from '../modqn/replay-bundle/rescalarize';
import type {
  ModqnBeamReference,
  ModqnPolicyCandidate,
} from '../modqn/replay-bundle/types';
import type {
  RuntimeOmegaState,
  UseModqnHandoverState,
} from './useModqnHandoverState';
import type { SimState } from '../scene/types';

function formatScore(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '-' : value.toFixed(3);
}

function formatSlot(snapshot: UseModqnHandoverState['bundleSidebarSnapshot']): string {
  if (snapshot === null) return '-';
  const slot = snapshot.currentSlotIndex === null ? 'slot -' : `slot ${snapshot.currentSlotIndex}`;
  const time = snapshot.currentTimeSec === null ? null : `t=${snapshot.currentTimeSec.toFixed(1)}s`;
  return [slot, `offset ${snapshot.slotOffset}`, time].filter(Boolean).join(' / ');
}

function formatProducerBeam(ref: ModqnBeamReference | null): string {
  if (ref === null) return '-';
  return `${ref.satId} / local B${ref.localBeamIndex} / global #${ref.beamIndex}`;
}

function formatCandidateBeam(candidate: ModqnPolicyCandidate | null): string {
  if (candidate === null) return '-';
  return `${candidate.satId} / local B${candidate.localBeamIndex} / global #${candidate.beamIndex}`;
}

function formatLiveServing(simState: SimState): string {
  if (simState.servingSatId === null || simState.servingBeamId === null) return '-';
  return `${simState.servingSatId} / live B${simState.servingBeamId}`;
}

function findRescalarizedCandidate(
  topCandidates: readonly ModqnPolicyCandidate[] | undefined,
  result: ReScalarizeResult | null,
): ModqnPolicyCandidate | null {
  if (!topCandidates || result === null) return null;
  return topCandidates.find(candidate => (
    candidate.satId === result.satId
    && candidate.localBeamIndex === result.beamId
  )) ?? null;
}

function getSelectionChanged(
  producerSelected: ModqnBeamReference | null,
  result: ReScalarizeResult | null,
): 'yes' | 'no' | 'unavailable' {
  if (producerSelected === null || result === null) return 'unavailable';
  return producerSelected.satId === result.satId
    && producerSelected.localBeamIndex === result.beamId
    ? 'no'
    : 'yes';
}

function getFallbackStatus(result: ReScalarizeResult | null): string {
  if (result === null) return 'no top-K diagnostics';
  return result.wasFallback ? 'top-1 fallback' : 'within top-K';
}

interface DecisionTraceRow {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}

export interface DecisionTrace {
  readonly rows: readonly DecisionTraceRow[];
  readonly selectionChanged: 'yes' | 'no' | 'unavailable';
  readonly fallbackStatus: string;
}

export function buildDecisionTrace(
  snapshot: UseModqnHandoverState['bundleSidebarSnapshot'],
  omegaActive: RuntimeOmegaState,
  simState: SimState,
): DecisionTrace {
  const topCandidates = snapshot?.policyDiagnostics.topCandidates;
  const result = reScalarize(topCandidates, omegaActive);
  const selectedCandidate = findRescalarizedCandidate(topCandidates, result);
  const producerSelected = snapshot?.currentRowSelectedServing ?? null;
  const selectionChanged = getSelectionChanged(producerSelected, result);
  const fallbackStatus = getFallbackStatus(result);
  const selectedScore = selectedCandidate === null
    ? null
    : scoreModqnPolicyCandidate(selectedCandidate, omegaActive);

  return {
    selectionChanged,
    fallbackStatus,
    rows: [
      {
        label: 'Current slot',
        value: formatSlot(snapshot),
        testId: 'modqn-evidence-current-slot',
      },
      {
        label: 'Producer baseline',
        value: formatProducerBeam(producerSelected),
        testId: 'modqn-evidence-producer-selected',
      },
      {
        label: 'Top-K ω preview',
        value: formatCandidateBeam(selectedCandidate),
        testId: 'modqn-evidence-rescalarized-selected',
      },
      {
        label: 'Top-K score',
        value: formatScore(selectedScore),
        testId: 'modqn-evidence-rescalarized-score',
      },
      {
        label: 'Top-K changed',
        value: selectionChanged,
        testId: 'modqn-evidence-selection-changed',
      },
      {
        label: 'Fallback status',
        value: fallbackStatus,
        testId: 'modqn-evidence-fallback-status',
      },
      {
        label: 'Mapped live serving',
        value: formatLiveServing(simState),
        testId: 'modqn-evidence-mapped-live-serving',
      },
    ],
  };
}
