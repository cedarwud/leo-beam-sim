import {
  candidateLinkKeyString,
  type HandoverCommitReceipt,
  type CandidateLinkKey,
  type HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import { cellIdFromLinkBudgetBeamId } from './sinrLiveCellModel';
import {
  createIdleHandoverPresentationView,
  type HandoverPresentationEvent,
  type HandoverPresentationView,
} from './handoverPresentationOwner';

export type AuthorityHandoverKind = 'intra' | 'inter';
export type AuthorityTransitionBoundary = 'selected' | 'committed';

export interface AuthorityHandoverTransition {
  readonly eventId: string;
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly simTimeMs: number;
  readonly kind: AuthorityHandoverKind;
  readonly boundary: AuthorityTransitionBoundary;
  readonly from: CandidateLinkKey;
  readonly to: CandidateLinkKey;
}

export interface HandoverAuthorityJoin {
  readonly phase: HandoverDecisionFrame['phase'];
  readonly serving: CandidateLinkKey | null;
  readonly transition: AuthorityHandoverTransition | null;
  /** Only the immutable decision frame may nominate the active data link. */
  readonly solidDataLinkKey: CandidateLinkKey | null;
  readonly solidDataLinkCount: 0 | 1;
  /** A source-target transition is legal only during the switching frame. */
  readonly showTransitionCue: boolean;
}

export interface AuthorityHandoverPresentationGeometry {
  readonly source: HandoverPresentationEvent['source'];
  readonly hasCellPlacement: (cellId: number) => boolean;
  readonly hasSatelliteWorld: (satelliteId: string) => boolean;
  readonly durationMs: Readonly<Record<AuthorityHandoverKind, number>>;
}

export interface AuthorityHandoverPresentationSnapshot {
  readonly view: HandoverPresentationView;
  readonly mode: 'idle' | 'presenting';
  readonly cooldownUntilMs: 0;
}

function copyKey(key: CandidateLinkKey): CandidateLinkKey {
  return Object.freeze({ satelliteId: key.satelliteId, beamId: key.beamId });
}

function visibleKind(kind: HandoverDecisionFrame['selectedKind']): AuthorityHandoverKind | null {
  if (kind === 'intra-satellite') return 'intra';
  if (kind === 'inter-satellite') return 'inter';
  return null;
}

/**
 * A wall-clock presentation may outlive the one-frame switching boundary. This
 * predicate lets the renderer distinguish a still-pending selected pair from
 * an already committed pair without guessing from animation progress.
 */
export function commitReceiptMatchesHandoverPresentation(
  receipt: HandoverCommitReceipt | null | undefined,
  event: HandoverPresentationEvent | null | undefined,
): boolean {
  if (receipt === null || receipt === undefined || event === null || event === undefined) return false;
  if (receipt.from === null) return false;
  if (!Number.isInteger(event.from.cellId) || !Number.isInteger(event.to.cellId)) return false;
  const receiptKind = receipt.kind === 'inter-satellite'
    ? 'inter'
    : receipt.kind === 'intra-satellite' ? 'intra' : null;
  return receiptKind === event.kind
    && receipt.from.satelliteId === event.from.satId
    && receipt.from.beamId === event.from.cellId + 1
    && receipt.to.satelliteId === event.to.satId
    && receipt.to.beamId === event.to.cellId + 1;
}

function transitionId(
  frame: HandoverDecisionFrame,
  kind: AuthorityHandoverKind,
  from: CandidateLinkKey,
  to: CandidateLinkKey,
): string {
  return [
    'decision',
    frame.episodeId,
    kind,
    candidateLinkKeyString(from),
    candidateLinkKeyString(to),
  ].join(':');
}

/**
 * Join the engine, rail, scene and receipt at the immutable decision-frame
 * boundary. Legacy handover latches are deliberately absent from this adapter.
 */
export function resolveHandoverAuthorityJoin(
  frame: HandoverDecisionFrame | null | undefined,
): HandoverAuthorityJoin | null {
  if (frame === null || frame === undefined) return null;

  const serving = frame.serving === null ? null : copyKey(frame.serving);
  let transition: AuthorityHandoverTransition | null = null;

  if (
    frame.phase === 'switching'
    && frame.recentCommit !== null
    && frame.recentCommit.from !== null
  ) {
    const kind = visibleKind(frame.recentCommit.kind);
    if (kind !== null) {
      const from = copyKey(frame.recentCommit.from);
      const to = copyKey(frame.recentCommit.to);
      transition = Object.freeze({
        eventId: transitionId(frame, kind, from, to),
        episodeId: frame.episodeId,
        sourceFrameId: frame.sourceFrameId,
        simTimeMs: frame.simTimeMs,
        kind,
        boundary: 'committed',
        from,
        to,
      });
    }
  } else if (
    frame.phase === 'switching'
    && frame.serving !== null
    && frame.selectedTarget !== null
  ) {
    const kind = visibleKind(frame.selectedKind);
    if (kind !== null) {
      const from = copyKey(frame.serving);
      const to = copyKey(frame.selectedTarget);
      transition = Object.freeze({
        eventId: transitionId(frame, kind, from, to),
        episodeId: frame.episodeId,
        sourceFrameId: frame.sourceFrameId,
        simTimeMs: frame.simTimeMs,
        kind,
        boundary: 'selected',
        from,
        to,
      });
    }
  }

  return Object.freeze({
    phase: frame.phase,
    serving,
    transition,
    solidDataLinkKey: serving,
    solidDataLinkCount: serving === null ? 0 : 1,
    showTransitionCue: frame.phase === 'switching' && transition !== null,
  });
}

/**
 * Adapt the exact selected/committed pair to the established presentation
 * vocabulary. Geometry is checked, never guessed from a satellite-only match.
 */
export function resolveAuthorityHandoverPresentationEvent(
  join: HandoverAuthorityJoin | null,
  geometry: AuthorityHandoverPresentationGeometry,
): HandoverPresentationEvent | null {
  const transition = join?.transition ?? null;
  if (transition === null || join?.showTransitionCue !== true) return null;
  const fromCellId = cellIdFromLinkBudgetBeamId(transition.from.beamId);
  const toCellId = cellIdFromLinkBudgetBeamId(transition.to.beamId);
  const fromDrawable = geometry.hasCellPlacement(fromCellId)
    && geometry.hasSatelliteWorld(transition.from.satelliteId);
  const toDrawable = geometry.hasCellPlacement(toCellId)
    && geometry.hasSatelliteWorld(transition.to.satelliteId);
  if (!fromDrawable || !toDrawable) return null;

  return Object.freeze({
    eventId: transition.eventId,
    source: geometry.source,
    kind: transition.kind,
    sourceTimeSec: transition.simTimeMs / 1000,
    from: Object.freeze({
      satId: transition.from.satelliteId,
      cellId: fromCellId,
      drawable: true,
    }),
    to: Object.freeze({
      satId: transition.to.satelliteId,
      cellId: toCellId,
      drawable: true,
    }),
    durationMs: geometry.durationMs[transition.kind],
  });
}

/**
 * Project the decision-frame switching boundary directly into the established
 * handover-presentation vocabulary. Authority frames are simulation-time
 * facts, so they must not start an independent six/eight-second wall clock
 * that can continue playing after the frame has entered guard.
 *
 * The selected boundary keeps the source as the sole serving link while the
 * target enters the established holding choreography. The committed boundary
 * immediately promotes the target and releases the source. These progress
 * values drive presentation envelopes only; they are not TTT or decision
 * evidence and never feed back into the engine.
 */
export function resolveAuthorityHandoverPresentationSnapshot(
  join: HandoverAuthorityJoin | null,
  event: HandoverPresentationEvent | null,
): AuthorityHandoverPresentationSnapshot {
  if (join?.showTransitionCue !== true || join.transition === null || event === null) {
    return Object.freeze({
      view: createIdleHandoverPresentationView(),
      mode: 'idle',
      cooldownUntilMs: 0,
    });
  }

  const committed = join.transition.boundary === 'committed';
  return Object.freeze({
    view: Object.freeze({
      active: true,
      event,
      phase: committed ? 'releasing' : 'holding',
      progress01: committed ? 0.76 : 0.54,
      autoSlowActive: true,
      sourceRole: 'serving',
      targetRole: committed ? 'serving' : 'candidate',
    }),
    mode: 'presenting',
    cooldownUntilMs: 0,
  });
}
