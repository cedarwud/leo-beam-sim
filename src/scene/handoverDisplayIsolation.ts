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
}

export type HandoverCinemaArmFilter = 'off' | 'intra' | 'inter';

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
  serving: 0.28,
  measuring: 0.5,
  holding: 0.68,
  releasing: 0.84,
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
  readonly cinemaCandidateActive: boolean;
  readonly cinemaCandidateKind?: 'intra' | 'inter' | null;
}): HandoverDisplayIsolationState {
  const active = input.manualHandoverActive || input.cinemaCandidateActive;
  const interCinemaActive = input.cinemaCandidateActive && input.cinemaCandidateKind === 'inter';

  return {
    active,
    hidePrimaryServingBeam: active,
    hideCandidateFan: active,
    hideNormalBeamField: interCinemaActive,
    showCinemaCandidateFan: interCinemaActive,
    hideTimelinePulse: active,
    hideTimelineTriggered: active,
    hideTimelineEffects: active,
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
