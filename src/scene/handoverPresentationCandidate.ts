import type { SinrLiveCinemaHandoverCandidate } from '../viz/SinrLiveCellBeamCones';
import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import type { HandoverPresentationEvent } from './handoverPresentationOwner';
import type { SinrLiveCellHandoverEvent, UeCellServingRecord } from './sinrLiveCellModel';

export interface HandoverPresentationWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HandoverPresentationCandidateInput {
  readonly authority: {
    readonly active: boolean;
    readonly candidate: HandoverPresentationEvent | null;
    readonly centralOverlayActive: boolean;
    readonly decisionAuthorityPresent: boolean;
    readonly acceptedPresentation: AcceptedHandoverPresentationSnapshot | null;
  };
  readonly manual: {
    readonly active: boolean;
    readonly requested: boolean;
    readonly requestId?: number;
    readonly displayMs: number;
    readonly event: SinrLiveCellHandoverEvent | null;
    readonly beamRecord: UeCellServingRecord | null;
  };
  readonly natural: {
    readonly event: SinrLiveCellHandoverEvent | null;
    readonly source: 'archived-tle' | 'live';
    readonly satelliteWorldById: ReadonlyMap<string, HandoverPresentationWorldPoint>;
  };
  readonly cinema: {
    readonly ready: boolean;
    readonly armed: boolean;
    readonly candidate: SinrLiveCinemaHandoverCandidate | null;
    readonly satelliteWorldById: ReadonlyMap<string, HandoverPresentationWorldPoint>;
  };
  readonly placementByCellId: ReadonlyMap<number, unknown>;
  readonly durations: {
    readonly naturalIntraMs: number;
    readonly naturalInterMs: number;
    readonly cinemaIntraMs: number;
    readonly cinemaInterMs: number;
  };
  readonly teachingLectureActive: boolean;
}

type PresentationEndpoint = HandoverPresentationEvent['from'];

function endpoint(
  satId: string | null,
  cellId: number | null,
  satelliteWorldById: ReadonlyMap<string, HandoverPresentationWorldPoint>,
  placementByCellId: ReadonlyMap<number, unknown>,
  beamId: number | null | undefined = null,
): PresentationEndpoint | null {
  if (satId === null || cellId === null) return null;
  return {
    satId,
    cellId,
    beamId,
    drawable: placementByCellId.has(cellId) && satelliteWorldById.has(satId),
  };
}

function resolveManualCandidate(
  input: HandoverPresentationCandidateInput,
): HandoverPresentationEvent | null {
  if (!input.manual.active || input.manual.event === null) return null;
  const fromBeamId = input.manual.beamRecord?.servingLinkSample?.beamId ?? null;
  const toBeamId = input.manual.beamRecord?.intraCandidateLinkSample?.beamId ?? null;
  const from = endpoint(
    input.manual.event.fromSatId,
    input.manual.event.fromCellId,
    input.natural.satelliteWorldById,
    input.placementByCellId,
    fromBeamId,
  );
  const to = endpoint(
    input.manual.event.toSatId,
    input.manual.event.toCellId,
    input.natural.satelliteWorldById,
    input.placementByCellId,
    toBeamId,
  );
  if (from === null || to === null) return null;
  return {
    eventId: `manual:${input.manual.requestId ?? 'unknown'}`,
    source: 'manual',
    kind: input.manual.event.kind,
    ueId: input.manual.event.ueId,
    sourceTimeSec: input.manual.event.sourceTimeSec,
    from,
    to,
    durationMs: input.manual.displayMs,
    fromSinrDb: input.manual.event.fromSinrDb,
    toSinrDb: input.manual.event.toSinrDb,
    deltaDb: input.manual.event.deltaDb,
  };
}

function resolveNaturalCandidate(
  input: HandoverPresentationCandidateInput,
): HandoverPresentationEvent | null {
  const authorityOwnsLifecycle = input.authority.decisionAuthorityPresent
    || (input.authority.active
      && input.authority.acceptedPresentation?.decision !== null
      && input.authority.acceptedPresentation?.decision !== undefined);
  const event = input.natural.event;
  if (authorityOwnsLifecycle || input.authority.centralOverlayActive || event === null) return null;

  const from = endpoint(
    event.fromSatId,
    event.fromCellId,
    input.natural.satelliteWorldById,
    input.placementByCellId,
    event.fromBeamId,
  );
  const to = endpoint(
    event.toSatId,
    event.toCellId,
    input.natural.satelliteWorldById,
    input.placementByCellId,
    event.toBeamId,
  );
  if (from === null || to === null) return null;
  return {
    eventId: `${input.natural.source}:${event.ueId}:${event.sourceTimeSec}:${event.kind}`,
    source: input.natural.source === 'archived-tle' ? 'tle' : 'walker',
    kind: event.kind,
    ueId: event.ueId,
    sourceTimeSec: event.sourceTimeSec,
    from,
    to,
    durationMs: event.kind === 'inter'
      ? input.durations.naturalInterMs
      : input.durations.naturalIntraMs,
  } satisfies HandoverPresentationEvent;
}

function resolveCinemaCandidate(
  input: HandoverPresentationCandidateInput,
): HandoverPresentationEvent | null {
  const candidate = input.cinema.candidate;
  if (!input.cinema.ready || candidate === null) return null;
  const from = endpoint(
    candidate.fromSatId,
    candidate.fromCellId,
    input.cinema.satelliteWorldById,
    input.placementByCellId,
    candidate.fromBeamId,
  );
  const to = endpoint(
    candidate.toSatId,
    candidate.toCellId,
    input.cinema.satelliteWorldById,
    input.placementByCellId,
    candidate.toBeamId,
  );
  if (from === null || to === null) return null;
  return {
    eventId: `cinema:${candidate.eventId}`,
    source: 'cinema',
    kind: candidate.kind,
    ueId: candidate.ueId,
    sourceTimeSec: candidate.sourceTimeSec,
    from,
    to,
    durationMs: candidate.kind === 'inter'
      ? input.durations.cinemaInterMs
      : input.durations.cinemaIntraMs,
  };
}

/** Resolve the single candidate admitted to the stateful presentation owner. */
export function resolveHandoverPresentationCandidate(
  input: HandoverPresentationCandidateInput,
): HandoverPresentationEvent | null {
  // A real authority decision (the live EE handover engine's own committed
  // event) is never gated by teachingLectureActive anywhere else in the
  // scene — the multi-candidate authority policy, the homepage rail, and the
  // evaluation panel all keep tracking it while a lecture is open. Masking
  // it ONLY here left the shared presentation owner's clock frozen at idle
  // while every sibling view had already moved on to a real committed
  // handover, an invariant mismatch that eventually drove an unbounded
  // render loop. Check authority first so this owner's clock stays in sync
  // with reality; the teaching mask below still applies to the synthetic
  // manual/natural/cinema candidates a lecture must not leak into other UI.
  if (input.authority.candidate !== null) return input.authority.candidate;
  if (input.teachingLectureActive) return null;

  const naturalCandidate = resolveNaturalCandidate(input);
  if (input.manual.event?.kind === 'intra' && naturalCandidate?.kind === 'inter') {
    return naturalCandidate;
  }

  const manual = resolveManualCandidate(input);
  if (manual !== null) return manual;
  if (input.manual.requested) return null;

  const cinema = resolveCinemaCandidate(input);
  if (cinema !== null) return cinema;
  if (input.cinema.armed) return null;
  return naturalCandidate;
}
