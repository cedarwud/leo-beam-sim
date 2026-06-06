/**
 * Handover-cinema (S1) pure model — the lane-truthful glue between the live
 * Walker handover event index and the cinema's candidate-beam highlight + SINR
 * explainer.
 *
 * Honesty / governance (frontend-render-governance.md Rule#6, CLAUDE.md §3):
 * - Everything here is built ONLY from the real live-walker handover event index
 *   (`sinr-live` lane), which is computed from live SINR truth. There is NO
 *   producer/MODQN dependency and NO fabrication: the SINR values are carried
 *   verbatim from the engine `HandoverEvent`.
 * - The claim is `sinr-offset` / `profile-derived-forecast`, NEVER producer proof.
 * - These are pure functions (no React, no DOM) so the SINR math + lane-gating can
 *   be unit-tested without a renderer, mirroring `decideArtifactSourceBadge` /
 *   `decideClaimBoundaryBanner`.
 */
import type {
  LiveWalkerHandoverEventIndex,
  LiveWalkerHandoverEventKind,
} from '../scene/liveWalkerHandoverEventIndex';
import type { LiveWalkerDirectorFocusClaimKind } from '../scene/liveWalkerDirectorFocus';
import type { RuntimeCandidateHighlightCommand } from '../scene/types';
import type { SceneLane } from './sceneLane';

/**
 * The two candidate beams of the focused handover + their recorded live SINR.
 * Drives BOTH the candidate-beam highlight (geometry) and the SINR explainer
 * (the "why"). `from` is the serving (losing) candidate, `to` the winner.
 */
export interface CinemaCandidateDetail {
  readonly eventId: string;
  readonly kind: LiveWalkerHandoverEventKind;
  readonly fromSatId: string;
  readonly fromBeamId: number;
  readonly toSatId: string;
  readonly toBeamId: number;
  /** Serving (losing) candidate SINR at the recorded handover (dB); null on cold attach. */
  readonly fromSinrDb: number | null;
  /** Winner candidate SINR at the recorded handover (dB). */
  readonly toSinrDb: number;
  /** `toSinrDb - fromSinrDb` (dB); null when `fromSinrDb` is null. */
  readonly deltaDb: number | null;
  /** Inter-HO SINR-offset threshold of the live profile (dB). */
  readonly offsetDb: number;
  /** Honest claim of the live focus — never producer proof. */
  readonly claimKind: LiveWalkerDirectorFocusClaimKind;
}

/**
 * Resolve the focused handover's candidate detail from the live Walker index by
 * event id. Returns null off the `sinr-live` lane (S1 is sinr-live only), when no
 * focus is armed, or when the id is not in the index — fail-closed, never fabricated.
 */
export function buildCinemaCandidateDetail(
  index: LiveWalkerHandoverEventIndex | null,
  eventId: string | null,
  sceneLane: SceneLane,
): CinemaCandidateDetail | null {
  if (index === null || eventId === null) return null;
  // S1 builds the candidate story on the live SINR lane only (real SINR, no
  // producer dependency). The MODQN / artifact variants are later slices.
  if (sceneLane !== 'sinr-live') return null;
  const event = index.events.find(e => e.id === eventId);
  if (event === undefined) return null;
  return {
    eventId: event.id,
    kind: event.kind,
    fromSatId: event.fromSatId,
    fromBeamId: event.fromBeamId,
    toSatId: event.toSatId,
    toBeamId: event.toBeamId,
    fromSinrDb: event.fromSinrDb,
    toSinrDb: event.toSinrDb,
    deltaDb: event.deltaDb,
    offsetDb: index.offsetDb,
    claimKind: index.claimKind === 'overlay-demo' ? 'overlay-demo' : 'profile-derived-forecast',
  };
}

/** Geometry-only command for the scene highlight layer (no SINR/decision truth). */
export function toCandidateHighlightCommand(
  detail: CinemaCandidateDetail | null,
): RuntimeCandidateHighlightCommand | null {
  if (detail === null) return null;
  return {
    kind: detail.kind,
    fromSatId: detail.fromSatId,
    fromBeamId: detail.fromBeamId,
    toSatId: detail.toSatId,
    toBeamId: detail.toBeamId,
  };
}

export type SinrCandidateRole = 'serving' | 'winner';

export interface SinrCandidateRow {
  readonly beamLabel: string;
  readonly satId: string;
  readonly beamId: number;
  readonly sinrDb: number | null;
  readonly role: SinrCandidateRole;
  /** The winner is the selected (new-serving) beam. */
  readonly isSelected: boolean;
}

export interface SinrOffsetExplainerModel {
  readonly kind: LiveWalkerHandoverEventKind;
  readonly offsetDb: number;
  readonly deltaDb: number | null;
  readonly rows: readonly SinrCandidateRow[];
  readonly claimKind: LiveWalkerDirectorFocusClaimKind;
}

function beamLabel(satId: string, beamId: number): string {
  return `${satId} B${beamId}`;
}

/**
 * Build the SINR explainer model (the "why this beam won, in SINR terms").
 * Pure projection of the candidate detail: two rows (serving + winner), the
 * recorded delta, and the offset threshold. It NEVER invents a SINR value and
 * NEVER references MODQN/producer — the only decision rule it states is the live
 * SINR-offset policy.
 */
export function decideSinrOffsetExplainer(
  candidate: CinemaCandidateDetail | null,
): SinrOffsetExplainerModel | null {
  if (candidate === null) return null;
  const rows: SinrCandidateRow[] = [
    {
      beamLabel: beamLabel(candidate.fromSatId, candidate.fromBeamId),
      satId: candidate.fromSatId,
      beamId: candidate.fromBeamId,
      sinrDb: candidate.fromSinrDb,
      role: 'serving',
      isSelected: false,
    },
    {
      beamLabel: beamLabel(candidate.toSatId, candidate.toBeamId),
      satId: candidate.toSatId,
      beamId: candidate.toBeamId,
      sinrDb: candidate.toSinrDb,
      role: 'winner',
      isSelected: true,
    },
  ];
  return {
    kind: candidate.kind,
    offsetDb: candidate.offsetDb,
    deltaDb: candidate.deltaDb,
    rows,
    claimKind: candidate.claimKind,
  };
}
