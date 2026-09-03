import {
  sameCandidateLinkKey,
  type CandidateLinkKey,
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import type { LiveWalkerHandoverEvent } from '../../scene/liveWalkerHandoverEventIndex';

/**
 * The two homepage teaching claims are intentionally checked as a pure
 * boundary predicate.  This module never selects a target, reads a clock, or
 * creates a presentation snapshot; it only prevents a malformed source pair
 * from becoming the natural Intra -> Inter demo window.
 */
export type HomepageAcceptanceAlignmentCheck =
  | 'intra-kind'
  | 'intra-same-satellite'
  | 'intra-same-geographic-cell'
  | 'intra-distinct-beam'
  | 'inter-kind'
  | 'inter-cross-satellite'
  | 'inter-follows-intra'
  | 'same-primary-ue'
  | 'source-order'
  | 'source-window';

export interface HomepageAcceptanceAlignment {
  readonly aligned: boolean;
  readonly checks: Readonly<Record<HomepageAcceptanceAlignmentCheck, boolean>>;
  readonly failedChecks: readonly HomepageAcceptanceAlignmentCheck[];
}

function eventUeId(event: LiveWalkerHandoverEvent): string {
  return event.ueId ?? event.primaryUeId;
}

function validSourceWindow(event: LiveWalkerHandoverEvent): boolean {
  return Number.isFinite(event.sourceTimeSec)
    && Number.isFinite(event.sourceStartSec)
    && Number.isFinite(event.sourceEndSec)
    && event.sourceStartSec <= event.sourceTimeSec
    && event.sourceTimeSec <= event.sourceEndSec;
}

/**
 * Check the stable geometry/order contract for one natural homepage window.
 *
 * Intra-cell means a same-satellite beam replacement on one geographic cell;
 * it does not mean that the geographic cell id changes. Inter-cell teaching
 * then changes satellite identity, while the candidate decision itself stays
 * owned by the source decision engine.
 */
export function evaluateHomepageAcceptanceAlignment(
  intra: LiveWalkerHandoverEvent | null | undefined,
  inter: LiveWalkerHandoverEvent | null | undefined,
): HomepageAcceptanceAlignment {
  const checks: Record<HomepageAcceptanceAlignmentCheck, boolean> = {
    'intra-kind': intra?.kind === 'intra',
    'intra-same-satellite': intra !== null
      && intra !== undefined
      && intra.fromSatId === intra.toSatId,
    'intra-same-geographic-cell': intra !== null
      && intra !== undefined
      && Number.isInteger(intra.fromCellId)
      && Number.isInteger(intra.toCellId)
      && intra.fromCellId === intra.toCellId,
    'intra-distinct-beam': intra !== null
      && intra !== undefined
      && Number.isInteger(intra.fromBeamId)
      && Number.isInteger(intra.toBeamId)
      && intra.fromBeamId !== intra.toBeamId,
    'inter-kind': inter?.kind === 'inter',
    'inter-cross-satellite': inter !== null
      && inter !== undefined
      && inter.fromSatId !== inter.toSatId,
    // The teaching pair must be a continuous service story: the inter-cell
    // event starts from the satellite that won the preceding intra-cell beam
    // transition. This is an event-sequence guard only; it does not choose or
    // re-rank either handover.
    'inter-follows-intra': intra !== null
      && intra !== undefined
      && inter !== null
      && inter !== undefined
      && inter.fromSatId === intra.toSatId,
    'same-primary-ue': intra !== null
      && intra !== undefined
      && inter !== null
      && inter !== undefined
      && eventUeId(intra) === eventUeId(inter)
      && intra.primaryUeId === inter.primaryUeId,
    'source-order': intra !== null
      && intra !== undefined
      && inter !== null
      && inter !== undefined
      && Number.isFinite(intra.sourceTimeSec)
      && Number.isFinite(inter.sourceTimeSec)
      && inter.sourceTimeSec > intra.sourceTimeSec,
    'source-window': intra !== null
      && intra !== undefined
      && inter !== null
      && inter !== undefined
      && validSourceWindow(intra)
      && validSourceWindow(inter),
  };
  const failedChecks = (Object.keys(checks) as HomepageAcceptanceAlignmentCheck[])
    .filter(check => !checks[check]);
  return Object.freeze({
    aligned: failedChecks.length === 0,
    checks: Object.freeze(checks),
    failedChecks: Object.freeze(failedChecks),
  });
}

export function isHomepageAcceptanceAligned(
  intra: LiveWalkerHandoverEvent | null | undefined,
  inter: LiveWalkerHandoverEvent | null | undefined,
): boolean {
  return evaluateHomepageAcceptanceAlignment(intra, inter).aligned;
}

export type HomepageAcceptanceDecisionCheck =
  | 'decision-ee-mode'
  | 'decision-target-present'
  | 'decision-target-stable'
  | 'decision-target-rank-one'
  | 'decision-ee-evidence'
  | 'decision-ee-max'
  | 'decision-target-ee-improves-source';

export interface HomepageAcceptanceDecisionAlignment {
  readonly aligned: boolean;
  readonly checks: Readonly<Record<HomepageAcceptanceDecisionCheck, boolean>>;
  readonly failedChecks: readonly HomepageAcceptanceDecisionCheck[];
}

function finiteInstantaneousEe(
  decision: HandoverDecisionFrame,
  key: CandidateLinkKey,
): number | null {
  const opportunity = decision.opportunities.find(item => sameCandidateLinkKey(item.key, key));
  const evidence = opportunity?.instantaneousEe;
  if (evidence?.status !== 'available' || evidence.value === null) return null;
  return Number.isFinite(evidence.value) && evidence.value >= 0 ? evidence.value : null;
}

/**
 * Read-only EE witness for the existing decision output.
 *
 * This does not rank, select, or mutate anything. It checks the target already
 * selected by the canonical engine against the stable candidates that engine
 * exposed on the same frame. TTT/selection hold therefore remain part of the
 * accepted candidate definition, while the controller cannot quietly choose a
 * different target for presentation.
 */
export function evaluateHomepageDecisionEeAlignment(
  decision: HandoverDecisionFrame | null | undefined,
  target: CandidateLinkKey | null | undefined,
): HomepageAcceptanceDecisionAlignment {
  const targetState = decision === null || decision === undefined || target === null || target === undefined
    ? undefined
    : decision.states.find(state => sameCandidateLinkKey(state.key, target));
  const stableStates = decision?.states.filter(state => state.stable) ?? [];
  const stableEeValues = decision === null || decision === undefined
    ? []
    : stableStates.map(state => finiteInstantaneousEe(decision, state.key));
  const targetEe = decision === null || decision === undefined || target === null || target === undefined
    ? null
    : finiteInstantaneousEe(decision, target);
  const sourceEe = decision === null
    || decision === undefined
    || decision.serving === null
    || decision.serving === undefined
    ? null
    : finiteInstantaneousEe(decision, decision.serving);
  const checks: Record<HomepageAcceptanceDecisionCheck, boolean> = {
    'decision-ee-mode': decision?.mode === 'ee-optimization',
    'decision-target-present': targetState !== undefined,
    'decision-target-stable': targetState?.stable === true,
    'decision-target-rank-one': targetState?.rank === 1,
    'decision-ee-evidence': stableEeValues.length > 0
      && targetEe !== null
      && stableEeValues.every(value => value !== null),
    'decision-ee-max': false,
    // The same-cell story is only visually honest when the replacement beam
    // is measurably better than the serving beam on the accepted frame. For an
    // inter story the canonical max-EE check above remains the sole comparison
    // requirement; this extra check is intentionally intra-only.
    'decision-target-ee-improves-source': decision?.selectedKind !== 'intra-satellite'
      || (sourceEe !== null && targetEe !== null && targetEe > sourceEe),
  };
  if (checks['decision-ee-evidence'] && targetEe !== null) {
    const maxStableEe = Math.max(...stableEeValues as number[]);
    const tolerance = 1e-9 * Math.max(1, Math.abs(maxStableEe), Math.abs(targetEe));
    checks['decision-ee-max'] = Math.abs(targetEe - maxStableEe) <= tolerance;
  }
  const failedChecks = (Object.keys(checks) as HomepageAcceptanceDecisionCheck[])
    .filter(check => !checks[check]);
  return Object.freeze({
    aligned: failedChecks.length === 0,
    checks: Object.freeze(checks),
    failedChecks: Object.freeze(failedChecks),
  });
}

export function isHomepageDecisionEeAligned(
  decision: HandoverDecisionFrame | null | undefined,
  target: CandidateLinkKey | null | undefined,
): boolean {
  return evaluateHomepageDecisionEeAlignment(decision, target).aligned;
}
