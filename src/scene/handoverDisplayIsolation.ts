import {
  resolveHandoverConeEnvelope,
  type HandoverConeEnvelope,
} from '../constants/sinrLiveConeStyle';

export interface HandoverDisplayIsolationState {
  readonly active: boolean;
  readonly hidePrimaryServingBeam: boolean;
  readonly hideCandidateFan: boolean;
  /** Inter cinema replaces the normal live beam field with one explicit pair + target fan. */
  readonly hideNormalBeamField: boolean;
  /** The inter target fan is rendered separately from the normal candidate layer. */
  readonly showCinemaCandidateFan: boolean;
  readonly hideTimelinePulse: boolean;
  readonly hideTimelineTriggered: boolean;
  readonly hideTimelineEffects: boolean;
  /** Natural pulse/link/ripple/toast layers must not paint through an explicit story. */
  readonly suppressNaturalHandoverLayers: boolean;
}

export type HandoverCinemaArmFilter = 'off' | 'intra' | 'inter';

/**
 * The live cell model can expose a real handover while the teaching director
 * is idle.  Those two streams share the same event shape, but only the
 * explicit presentation owners may replace the normal beam field.
 */
export type HandoverDisplayPresentationSource = 'walker' | 'tle' | 'manual' | 'cinema';

export interface HandoverDisplayEventRef {
  readonly ueId: string;
  readonly sourceTimeSec: number;
}

/**
 * Select the event set the display owner is allowed to paint.
 *
 * The live model may retain several recent handovers at once because that is
 * useful for truth/telemetry. The teaching viewport has one protagonist by
 * default, so it must not let that retention buffer become a second scene
 * owner. The optional breadth switch is an explicit display choice; it never
 * changes the model event buffer.
 */
export function selectHandoverEventsForDisplay<T extends HandoverDisplayEventRef>(
  events: readonly T[] | undefined,
  protagonistUeId: string | null | undefined,
  showOtherHandoverUes: boolean,
): readonly T[] {
  if (!events || events.length === 0) return [];
  if (showOtherHandoverUes) return events;
  if (protagonistUeId === null || protagonistUeId === undefined) return [];

  let latest: T | null = null;
  for (const event of events) {
    if (event.ueId !== protagonistUeId) continue;
    if (latest === null || event.sourceTimeSec > latest.sourceTimeSec) latest = event;
  }
  return latest === null ? [] : [latest];
}

/** Keep intra's existing 8 s teaching envelope unchanged. */
export const INTRA_HANDOVER_CINEMA_DISPLAY_MS = 8000;
/** Inter's pair stays on screen one second longer so the serving beam has time to read. */
export const INTER_HANDOVER_CINEMA_DISPLAY_MS = 6000;

/**
 * Inter keeps the source link present through candidate arrival, then gives the
 * source a short release and the candidate a shorter settled tail. Intra keeps
 * the shared envelope below unchanged.
 */
export const INTER_HANDOVER_CINEMA_PHASE_END = {
  serving: 0.45,
  measuring: 0.62,
  holding: 0.72,
  releasing: 0.88,
} as const;

function interSmoothstep01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value * value * (3 - 2 * value);
}

/**
 * Inter-only handover display envelope. This is a presentation mapping over
 * the already-selected cinema candidate; it never changes the live frame.
 */
export function resolveInterHandoverCinemaEnvelope(
  progress01: number,
  peakOpacity: number,
): HandoverConeEnvelope {
  const peak = Number.isFinite(peakOpacity) ? Math.max(0, peakOpacity) : 0;
  const progress = !Number.isFinite(progress01) ? 0 : Math.min(1, Math.max(0, progress01));
  const { serving, measuring, holding, releasing } = INTER_HANDOVER_CINEMA_PHASE_END;
  const toOpacity = peak * interSmoothstep01((progress - serving) / (measuring - serving));
  const fromOpacity = peak * (1 - interSmoothstep01((progress - holding) / (releasing - holding)));
  const phase: HandoverConeEnvelope['phase'] = progress < serving
    ? 'serving'
    : progress < measuring
      ? 'measuring'
      : progress < holding
        ? 'holding'
        : progress < releasing
          ? 'releasing'
          : 'settled';
  return { fromOpacity, toOpacity, phase };
}

/** Select the inter-specific display envelope while preserving intra's existing shape. */
export function resolveHandoverCinemaEnvelope(
  kind: 'intra' | 'inter' | null,
  progress01: number,
  peakOpacity: number,
): HandoverConeEnvelope {
  return kind === 'inter'
    ? resolveInterHandoverCinemaEnvelope(progress01, peakOpacity)
    : resolveHandoverConeEnvelope(progress01, peakOpacity);
}

export function shouldSuppressInterSeekFade(filter: HandoverCinemaArmFilter): boolean {
  return filter === 'inter';
}

export function resolveHandoverCinemaDisplayMs(kind: 'intra' | 'inter' | null): number {
  return kind === 'inter'
    ? INTER_HANDOVER_CINEMA_DISPLAY_MS
    : INTRA_HANDOVER_CINEMA_DISPLAY_MS;
}

/**
 * Inter's clock starts when the requested live frame has actually landed. The
 * candidate may be known during the fade/seek arm window, but that is not yet
 * the visible handover story.
 */
export function resolveHandoverCinemaReady(input: {
  readonly active: boolean;
  readonly kind: 'intra' | 'inter' | null | undefined;
  readonly requestedSeekKey: string | null | undefined;
  readonly landedSeekKey: string | null | undefined;
}): boolean {
  if (!input.active) return false;
  if (input.kind !== 'inter') return true;
  return input.requestedSeekKey !== null
    && input.requestedSeekKey !== undefined
    && input.requestedSeekKey === input.landedSeekKey;
}

export function resolveHandoverDisplayIsolation(input: {
  readonly manualHandoverActive: boolean;
  /** A manual request may be armed before its drawable endpoints resolve. */
  readonly manualHandoverRequested?: boolean;
  readonly cinemaCandidateActive: boolean;
  /** A cinema button has claimed the viewport, but its exact frame has not landed yet. */
  readonly cinemaCandidateArmed?: boolean;
  readonly cinemaCandidateReady?: boolean;
  readonly cinemaCandidateKind?: 'intra' | 'inter' | null;
  /** Natural Walker/TLE events remain in the ordinary live field. */
  readonly presentationSource?: HandoverDisplayPresentationSource;
}): HandoverDisplayIsolationState {
  // Keep the old flag-only contract for existing pure callers/tests. Once a
  // source is supplied, only an explicit manual/cinema story owns isolation;
  // a natural Walker/TLE event is rendered by the normal serving/candidate and
  // pulse layers instead of blanking the serving field.
  const sourceOwnsPresentation = input.presentationSource === undefined
    || input.presentationSource === 'manual'
    || input.presentationSource === 'cinema';
  const active = sourceOwnsPresentation
    && (input.manualHandoverActive || input.cinemaCandidateActive);
  const interCinemaActive = active && input.cinemaCandidateKind === 'inter';
  const cinemaPending = sourceOwnsPresentation
    && input.cinemaCandidateArmed === true
    && input.cinemaCandidateReady !== true
    && !input.manualHandoverActive;
  // A natural Walker/TLE source never owns this policy by itself. A manual
  // request, however, is an explicit claim even during the one render in
  // which its pair is not drawable yet; otherwise the old natural pulse can
  // leak through before the fail-closed manual story is resolved.
  const manualClaimed = input.manualHandoverRequested === true
    || (input.manualHandoverActive
      && input.presentationSource !== 'walker'
      && input.presentationSource !== 'tle');
  const cinemaClaimed = input.cinemaCandidateArmed === true
    || (input.cinemaCandidateActive
      && input.presentationSource !== 'walker'
      && input.presentationSource !== 'tle');
  const suppressNaturalHandoverLayers = manualClaimed || cinemaClaimed;

  return {
    active,
    hidePrimaryServingBeam: active,
    hideCandidateFan: active || cinemaPending,
    hideNormalBeamField: interCinemaActive,
    showCinemaCandidateFan: interCinemaActive,
    hideTimelinePulse: active || cinemaPending || manualClaimed,
    hideTimelineTriggered: active || cinemaPending || manualClaimed,
    hideTimelineEffects: active || cinemaPending || manualClaimed,
    suppressNaturalHandoverLayers,
  };
}

export interface InterCinemaFromAnchor {
  readonly eventId: string;
  readonly fromSatId: string;
  readonly fromCellId: number | null;
}

export interface InterCinemaPairAnchor {
  readonly eventId: string;
  readonly fromSatId: string;
  readonly fromCellId: number | null;
  readonly toSatId: string;
  readonly toCellId: number | null;
  /** Display-only last-known apex used only while a rebuilt frame omits that id. */
  readonly fromApexWorld?: InterCinemaApexWorld;
  readonly toApexWorld?: InterCinemaApexWorld;
}

export interface InterCinemaApexWorld {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Capture the visual source identity once, before the live seek rebuilds its frame.
 * This is a presentation anchor only; it never feeds the simulation or handover model.
 */
export function resolveInterCinemaFromAnchor(input: {
  readonly eventId: string;
  readonly captured: InterCinemaFromAnchor | null;
  readonly currentServingSatId: string | null | undefined;
  readonly currentCellId: number | null | undefined;
  readonly fallbackSatId: string;
  readonly fallbackCellId: number | null;
}): InterCinemaFromAnchor {
  if (input.captured?.eventId === input.eventId) return input.captured;
  return {
    eventId: input.eventId,
    fromSatId: input.currentServingSatId ?? input.fallbackSatId,
    fromCellId: input.currentCellId ?? input.fallbackCellId,
  };
}

/**
 * Latch the complete display pair for one inter event. The live seek rebuilds
 * the simulation frame and may expose a different current serving/pending
 * record; that record must never rewrite an already-started teaching shot.
 */
export function resolveInterCinemaPairAnchor(input: {
  readonly eventId: string;
  readonly captured: InterCinemaPairAnchor | null;
  readonly fallback: Omit<InterCinemaPairAnchor, 'eventId'>;
}): InterCinemaPairAnchor {
  if (input.captured?.eventId === input.eventId) return input.captured;
  return {
    eventId: input.eventId,
    ...input.fallback,
  };
}
