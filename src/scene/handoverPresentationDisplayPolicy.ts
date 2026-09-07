import {
  resolveHandoverCinemaEnvelope,
  resolveHandoverDisplayIsolation,
  type HandoverDisplayIsolationState,
  type InterCinemaApexWorld,
  type InterCinemaPairAnchor,
} from './handoverDisplayIsolation';
import {
  resolveAuthorityHandoverPresentationEvent,
  type HandoverAuthorityJoin,
} from './handoverAuthorityJoin';
import type {
  HandoverPresentationEvent,
  HandoverPresentationState,
  HandoverPresentationView,
} from './handoverPresentationOwner';
import type { SinrLiveCinemaHandoverCandidate } from '../viz/SinrLiveCellBeamCones';

export type HandoverDisplaySimulationSource = 'live' | 'archived-tle';

export interface ManualHandoverProgress {
  readonly ageMs: number;
  readonly progressSec: number;
  readonly progressRatio: number;
}

export interface ManualHandoverDisplayPolicyInput {
  readonly startedAtMs: number | undefined;
  readonly nowMs: number;
  readonly displayMs: number;
  readonly requestId: number | undefined;
  readonly kind: 'intra' | 'inter' | undefined;
  readonly eventPresent: boolean;
}

export interface ManualHandoverDisplayPolicy extends ManualHandoverProgress {
  readonly requested: boolean;
  readonly active: boolean;
}

/**
 * Convert the explicit demonstration clock into display state. The clock is
 * supplied by the React/R3F adapter; this function only maps it to a bounded
 * presentation interval and never advances time.
 */
export function resolveManualHandoverDisplayState(
  input: ManualHandoverDisplayPolicyInput,
): ManualHandoverDisplayPolicy {
  const { ageMs, progressSec, progressRatio } = resolveManualHandoverProgress(input);
  const requested = input.requestId !== undefined
    && input.kind !== undefined
    && ageMs <= input.displayMs;
  return {
    ageMs,
    progressSec,
    progressRatio,
    requested,
    active: requested && input.eventPresent,
  };
}

export function resolveManualHandoverProgress(input: {
  readonly startedAtMs: number | undefined;
  readonly nowMs: number;
  readonly displayMs: number;
}): ManualHandoverProgress {
  const ageMs = input.startedAtMs === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, input.nowMs - input.startedAtMs);
  const progressSec = Math.min(input.displayMs / 1000, ageMs / 1000);
  return {
    ageMs,
    progressSec,
    progressRatio: progressSec / (input.displayMs / 1000),
  };
}

export function resolveManualHandoverDisplayMs(input: {
  readonly homepageVisualIdentity: boolean;
  readonly kind: 'intra' | 'inter' | undefined;
  readonly homepageIntraMs: number;
  readonly homepageInterMs: number;
  readonly defaultMs: number;
}): number {
  if (!input.homepageVisualIdentity) return input.defaultMs;
  return input.kind === 'inter' ? input.homepageInterMs : input.homepageIntraMs;
}

export interface CinemaPairSnapshotInput {
  readonly candidate: SinrLiveCinemaHandoverCandidate | null;
  readonly anchor: InterCinemaPairAnchor | null;
}

export function resolveCinemaPairCandidate(
  input: CinemaPairSnapshotInput,
): SinrLiveCinemaHandoverCandidate | null {
  if (input.candidate === null || input.candidate.kind !== 'inter') return input.candidate;
  const pairAnchor = input.anchor?.eventId === input.candidate.eventId
    ? input.anchor
    : null;
  if (pairAnchor === null) return input.candidate;
  return {
    ...input.candidate,
    fromSatId: pairAnchor.fromSatId,
    fromCellId: pairAnchor.fromCellId,
    toSatId: pairAnchor.toSatId,
    toCellId: pairAnchor.toCellId,
  };
}

export function resolveCinemaInterSatelliteWorldById(input: {
  readonly current: ReadonlyMap<string, InterCinemaApexWorld>;
  readonly anchor: InterCinemaPairAnchor | null;
}): Map<string, InterCinemaApexWorld> {
  const worldById = new Map(input.current);
  if (input.anchor?.fromApexWorld !== undefined && !worldById.has(input.anchor.fromSatId)) {
    worldById.set(input.anchor.fromSatId, input.anchor.fromApexWorld);
  }
  if (input.anchor?.toApexWorld !== undefined && !worldById.has(input.anchor.toSatId)) {
    worldById.set(input.anchor.toSatId, input.anchor.toApexWorld);
  }
  return worldById;
}

export interface AuthorityPresentationCandidateInput {
  readonly enabled: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly authorityJoin: HandoverAuthorityJoin | null;
  readonly simSource: HandoverDisplaySimulationSource;
  readonly hasCellPlacement: (cellId: number) => boolean;
  readonly hasSatelliteWorld: (satelliteId: string) => boolean;
  readonly durationMs: Readonly<{ readonly intra: number; readonly inter: number }>;
}

/**
 * Project the accepted transition into the existing wall-clock presentation
 * vocabulary. The homepage selected boundary remains pending until commit;
 * geometry validation and event construction stay in the pure authority seam.
 */
export function resolveAuthorityPresentationCandidate(
  input: AuthorityPresentationCandidateInput,
): HandoverPresentationEvent | null {
  if (!input.enabled) return null;
  if (
    input.homepageVisualIdentity
    && input.authorityJoin?.transition?.boundary === 'selected'
  ) {
    return null;
  }
  return resolveAuthorityHandoverPresentationEvent(input.authorityJoin, {
    source: input.simSource === 'archived-tle' ? 'tle' : 'walker',
    hasCellPlacement: input.hasCellPlacement,
    hasSatelliteWorld: input.hasSatelliteWorld,
    durationMs: input.durationMs,
  });
}

export interface HandoverPresentationDisplayPolicyInput {
  readonly presentation: HandoverPresentationView;
  readonly presentationMode: HandoverPresentationState['mode'];
  readonly manualHandoverActive: boolean;
  readonly manualHandoverRequested: boolean;
  readonly handoverCinemaArmed: boolean;
  readonly handoverCinemaReady: boolean;
  readonly handoverCinemaKind: 'intra' | 'inter' | null;
  readonly recentAnyInterHandoverEventPresent: boolean;
  readonly simSource: HandoverDisplaySimulationSource;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly primaryServingRecord: {
    readonly pendingTargetSatId?: string | null;
    readonly servingSatId?: string | null;
  } | null | undefined;
  readonly preserveConfiguredServingFan: boolean;
  readonly teachingLectureActive: boolean;
  readonly peakOpacity: number;
  readonly fallbackSimTimeSec: number;
  readonly homepageVisualIdentity: boolean;
  readonly multiCandidateIdentityTransitionActive?: boolean;
}

export interface HandoverPresentationDisplayPolicy {
  readonly source: HandoverPresentationEvent['source'] | null;
  readonly presentedCinemaHandoverActive: boolean;
  readonly presentedInterHandoverActive: boolean;
  readonly manualHandoverPresentationActive: boolean;
  readonly concurrentIntraVisualSuppressed: boolean;
  readonly naturalInterCandidatePending: boolean;
  readonly presentationHandoverEnvelope: ReturnType<typeof resolveHandoverCinemaEnvelope>;
  readonly handoverDisplayIsolation: HandoverDisplayIsolationState;
  readonly teachingLectureFieldCleared: boolean;
  readonly presentedHandoverPairCandidate: SinrLiveCinemaHandoverCandidate | null;
  readonly homepageEeProgressVisible: boolean;
}

function resolvePresentedHandoverPairCandidate(
  presentation: HandoverPresentationView,
  fallbackSimTimeSec: number,
): SinrLiveCinemaHandoverCandidate | null {
  const event = presentation.event;
  if (!presentation.active || event === null) return null;
  return {
    eventId: event.eventId,
    ueId: event.ueId ?? null,
    kind: event.kind,
    sourceTimeSec: event.sourceTimeSec ?? fallbackSimTimeSec,
    fromSatId: event.from.satId,
    fromBeamId: event.from.beamId ?? null,
    fromCellId: event.from.cellId,
    toSatId: event.to.satId,
    toBeamId: event.to.beamId ?? null,
    toCellId: event.to.cellId,
  };
}

/**
 * Resolve all display ownership flags derived from the normalized
 * presentation owner. This is the policy seam for field isolation, envelope,
 * pair identity, and homepage progress; it does not own the stateful clock.
 */
export function resolveHandoverPresentationDisplayPolicy(
  input: HandoverPresentationDisplayPolicyInput,
): HandoverPresentationDisplayPolicy {
  const presentation = input.presentation;
  const source = presentation.event?.source ?? null;
  const presentedCinemaHandoverActive = presentation.active && source === 'cinema';
  const presentedInterHandoverActive = presentation.active
    && presentation.event?.kind === 'inter';
  const manualHandoverPresentationActive = presentation.active
    && source === 'manual'
    && input.manualHandoverActive;
  const concurrentIntraVisualSuppressed = (
    presentation.active
    && presentation.event?.kind === 'inter'
  ) || input.recentAnyInterHandoverEventPresent;
  const naturalInterCandidatePending = input.simSource === 'live'
    && !input.multiCandidateCentralOverlayActive
    && input.primaryServingRecord?.pendingTargetSatId !== null
    && input.primaryServingRecord?.pendingTargetSatId !== undefined
    && input.primaryServingRecord.pendingTargetSatId
      !== input.primaryServingRecord.servingSatId;
  const presentationHandoverEnvelope = resolveHandoverCinemaEnvelope(
    presentation.event?.kind ?? null,
    presentation.progress01,
    input.peakOpacity,
  );
  const handoverDisplayIsolation = resolveHandoverDisplayIsolation({
    manualHandoverActive: presentation.active && source === 'manual',
    manualHandoverRequested: input.manualHandoverRequested,
    cinemaCandidateActive: presentation.active && source === 'cinema',
    cinemaCandidateArmed: input.handoverCinemaArmed,
    cinemaCandidateReady: input.handoverCinemaReady,
    cinemaCandidateKind: presentation.event?.kind ?? input.handoverCinemaKind,
    preserveConfiguredServingFan: input.preserveConfiguredServingFan,
    presentationSource: source
      ?? (input.presentationMode === 'idle' && input.handoverCinemaArmed ? 'cinema' : undefined),
    naturalPresentationActive: presentation.active
      && (source === 'walker' || source === 'tle'),
    naturalInterCandidatePending,
    presentationKind: presentation.event?.kind ?? null,
    presentationMode: input.presentationMode,
    teachingLectureActive: input.teachingLectureActive,
  });
  const teachingLectureFieldCleared = input.teachingLectureActive
    && handoverDisplayIsolation.hideNormalBeamField;
  const presentedHandoverPairCandidate = resolvePresentedHandoverPairCandidate(
    presentation,
    input.fallbackSimTimeSec,
  );
  return {
    source,
    presentedCinemaHandoverActive,
    presentedInterHandoverActive,
    manualHandoverPresentationActive,
    concurrentIntraVisualSuppressed,
    naturalInterCandidatePending,
    presentationHandoverEnvelope,
    handoverDisplayIsolation,
    teachingLectureFieldCleared,
    presentedHandoverPairCandidate,
    homepageEeProgressVisible: input.homepageVisualIdentity
      && (
        input.multiCandidateCentralOverlayActive
        || input.multiCandidateIdentityTransitionActive === true
        || presentation.active
      ),
  };
}

export function resolveHomepageEeProgressVisible(input: {
  readonly homepageVisualIdentity: boolean;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly multiCandidateIdentityTransitionActive: boolean;
  readonly handoverPresentationActive: boolean;
}): boolean {
  return input.homepageVisualIdentity
    && (
      input.multiCandidateCentralOverlayActive
      || input.multiCandidateIdentityTransitionActive
      || input.handoverPresentationActive
    );
}

export interface CinemaDisplaySatelliteIdsInput {
  readonly presentedInterHandoverActive: boolean;
  readonly presentedHandoverPairCandidate: SinrLiveCinemaHandoverCandidate | null;
  readonly targetRole: 'candidate' | 'serving';
  readonly servingSatelliteId: string | null;
  readonly renderedCandidateSatelliteId: string | null | undefined;
}

export interface CinemaDisplaySatelliteIds {
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteId: string | null | undefined;
}

export function resolveCinemaDisplaySatelliteIds(
  input: CinemaDisplaySatelliteIdsInput,
): CinemaDisplaySatelliteIds {
  const servingSatelliteId = input.presentedInterHandoverActive
    && input.presentedHandoverPairCandidate !== null
    ? input.targetRole === 'serving'
      ? input.presentedHandoverPairCandidate.toSatId
      : input.presentedHandoverPairCandidate.fromSatId
    : input.servingSatelliteId;
  const candidateSatelliteId = input.presentedInterHandoverActive
    ? input.presentedHandoverPairCandidate !== null
      && input.targetRole === 'candidate'
      ? input.presentedHandoverPairCandidate.toSatId
      : null
    : input.renderedCandidateSatelliteId;
  return { servingSatelliteId, candidateSatelliteId };
}

export interface SinrLiveCellTelemetryInput {
  readonly showSinrLiveCellBeams: boolean;
  readonly servedCellCount: number | undefined;
  readonly ues: ReadonlyArray<{
    readonly servingSatId: string | null;
    readonly offAxisDeg: number;
  }> | undefined;
}

export interface SinrLiveCellTelemetry {
  readonly servedCellCount: number;
  readonly ueOffAxisMaxDeg: number;
}

export function resolveSinrLiveCellTelemetry(
  input: SinrLiveCellTelemetryInput,
): SinrLiveCellTelemetry {
  if (!input.showSinrLiveCellBeams) {
    return { servedCellCount: 0, ueOffAxisMaxDeg: 0 };
  }
  let ueOffAxisMaxDeg = 0;
  for (const ue of input.ues ?? []) {
    if (ue.servingSatId !== null && ue.offAxisDeg > ueOffAxisMaxDeg) {
      ueOffAxisMaxDeg = ue.offAxisDeg;
    }
  }
  return {
    servedCellCount: input.servedCellCount ?? 0,
    ueOffAxisMaxDeg,
  };
}
