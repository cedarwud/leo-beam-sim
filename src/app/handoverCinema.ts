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
  LiveWalkerHandoverEventIndexClaimKind,
  LiveWalkerHandoverEventIndexSourceOwner,
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
  readonly sourceOwner: LiveWalkerHandoverEventIndexSourceOwner;
  readonly sourceTimeSec: number;
  readonly kind: LiveWalkerHandoverEventKind;
  readonly fromSatId: string;
  readonly fromBeamId: number;
  readonly toSatId: string;
  readonly toBeamId: number;
  readonly ueId: string | null;
  readonly fromCellId: number | null;
  readonly toCellId: number | null;
  readonly fromBeamIdentity: string | null;
  readonly toBeamIdentity: string | null;
  readonly fromFrequencyIndex: number | null;
  readonly toFrequencyIndex: number | null;
  readonly fromOffAxisDeg: number | null;
  readonly toOffAxisDeg: number | null;
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

function toDirectorClaimKind(claimKind: LiveWalkerHandoverEventIndexClaimKind): LiveWalkerDirectorFocusClaimKind {
  if (claimKind === 'overlay-demo') return 'overlay-demo';
  if (claimKind === 'live-truth') return 'live-truth';
  return 'profile-derived-forecast';
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
  if (
    index.sourceOwner === 'sinr-live-cell-truth'
    && (
      event.fromCellId === undefined
      || event.toCellId === undefined
      || event.fromOffAxisDeg === undefined
      || event.toOffAxisDeg === undefined
    )
  ) {
    return null;
  }
  return {
    eventId: event.id,
    sourceOwner: index.sourceOwner,
    sourceTimeSec: event.sourceTimeSec,
    kind: event.kind,
    fromSatId: event.fromSatId,
    fromBeamId: event.fromBeamId,
    toSatId: event.toSatId,
    toBeamId: event.toBeamId,
    ueId: event.ueId ?? null,
    fromCellId: event.fromCellId ?? null,
    toCellId: event.toCellId ?? null,
    fromBeamIdentity: event.fromBeamIdentity ?? null,
    toBeamIdentity: event.toBeamIdentity ?? null,
    fromFrequencyIndex: event.fromFrequencyIndex ?? null,
    toFrequencyIndex: event.toFrequencyIndex ?? null,
    fromOffAxisDeg: event.fromOffAxisDeg ?? null,
    toOffAxisDeg: event.toOffAxisDeg ?? null,
    fromSinrDb: event.fromSinrDb,
    toSinrDb: event.toSinrDb,
    deltaDb: event.deltaDb,
    offsetDb: index.offsetDb,
    claimKind: toDirectorClaimKind(index.claimKind),
  };
}

/** Geometry-only command for the scene highlight layer (no SINR/decision truth). */
export function toCandidateHighlightCommand(
  detail: CinemaCandidateDetail | null,
): RuntimeCandidateHighlightCommand | null {
  if (detail === null) return null;
  return {
    eventId: detail.eventId,
    sourceOwner: detail.sourceOwner,
    sourceTimeSec: detail.sourceTimeSec,
    kind: detail.kind,
    fromSatId: detail.fromSatId,
    fromBeamId: detail.fromBeamId,
    toSatId: detail.toSatId,
    toBeamId: detail.toBeamId,
    ueId: detail.ueId,
    fromCellId: detail.fromCellId,
    toCellId: detail.toCellId,
    fromFrequencyIndex: detail.fromFrequencyIndex,
    toFrequencyIndex: detail.toFrequencyIndex,
    fromOffAxisDeg: detail.fromOffAxisDeg,
    toOffAxisDeg: detail.toOffAxisDeg,
  };
}

export type SinrCandidateRole = 'serving' | 'winner';

export interface SinrCandidateRow {
  readonly beamLabel: string;
  readonly satId: string;
  readonly beamId: number;
  readonly cellId: number | null;
  readonly beamIdentity: string | null;
  readonly frequencyIndex: number | null;
  readonly offAxisDeg: number | null;
  readonly sinrDb: number | null;
  readonly role: SinrCandidateRole;
  /** The winner is the selected (new-serving) beam. */
  readonly isSelected: boolean;
}

export interface SinrOffsetExplainerModel {
  readonly kind: LiveWalkerHandoverEventKind;
  readonly eventId: string;
  readonly sourceOwner: LiveWalkerHandoverEventIndexSourceOwner;
  readonly sourceTimeSec: number;
  readonly ueId: string | null;
  readonly offsetDb: number;
  readonly deltaDb: number | null;
  readonly rows: readonly SinrCandidateRow[];
  readonly claimKind: LiveWalkerDirectorFocusClaimKind;
}

function beamLabel(satId: string, beamId: number, cellId: number | null): string {
  return cellId === null ? `${satId} B${beamId}` : `${satId} C${cellId}`;
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
      beamLabel: beamLabel(candidate.fromSatId, candidate.fromBeamId, candidate.fromCellId),
      satId: candidate.fromSatId,
      beamId: candidate.fromBeamId,
      cellId: candidate.fromCellId,
      beamIdentity: candidate.fromBeamIdentity,
      frequencyIndex: candidate.fromFrequencyIndex,
      offAxisDeg: candidate.fromOffAxisDeg,
      sinrDb: candidate.fromSinrDb,
      role: 'serving',
      isSelected: false,
    },
    {
      beamLabel: beamLabel(candidate.toSatId, candidate.toBeamId, candidate.toCellId),
      satId: candidate.toSatId,
      beamId: candidate.toBeamId,
      cellId: candidate.toCellId,
      beamIdentity: candidate.toBeamIdentity,
      frequencyIndex: candidate.toFrequencyIndex,
      offAxisDeg: candidate.toOffAxisDeg,
      sinrDb: candidate.toSinrDb,
      role: 'winner',
      isSelected: true,
    },
  ];
  return {
    kind: candidate.kind,
    eventId: candidate.eventId,
    sourceOwner: candidate.sourceOwner,
    sourceTimeSec: candidate.sourceTimeSec,
    ueId: candidate.ueId,
    offsetDb: candidate.offsetDb,
    deltaDb: candidate.deltaDb,
    rows,
    claimKind: candidate.claimKind,
  };
}
