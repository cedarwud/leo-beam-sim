/**
 * Source-neutral, presentation-only ownership for one visible handover story.
 *
 * Walker, archived TLE, and an explicit teaching command may all describe a
 * handover, but none of those producers owns its wall-clock animation.  This
 * module accepts their normalized endpoints and guarantees that only one
 * drawable story can run at a time.  It never feeds a decision back into SINR,
 * TTT, orbit propagation, or serving selection.
 */

import { INTER_HANDOVER_CINEMA_PHASE_END } from './handoverDisplayIsolation';

export type HandoverPresentationKind = 'intra' | 'inter';
export type HandoverPresentationSource = 'walker' | 'tle' | 'manual' | 'cinema';
export type HandoverPresentationOwner = 'natural' | 'manual' | 'cinema';
export type HandoverPresentationPhase =
  | 'serving'
  | 'measuring'
  | 'holding'
  | 'releasing'
  | 'settled';

export interface HandoverPresentationEndpoint {
  readonly satId: string;
  readonly cellId: number;
  /** True only when both the satellite apex and target cell can be rendered. */
  readonly drawable: boolean;
}

export interface HandoverPresentationEvent {
  readonly eventId: string;
  readonly source: HandoverPresentationSource;
  readonly kind: HandoverPresentationKind;
  readonly ueId?: string | null;
  readonly sourceTimeSec?: number;
  readonly from: HandoverPresentationEndpoint;
  readonly to: HandoverPresentationEndpoint;
  readonly durationMs: number;
  /** Optional measured SINR evidence for the teaching readout. */
  readonly fromSinrDb?: number | null;
  readonly toSinrDb?: number | null;
  readonly deltaDb?: number | null;
}

export interface HandoverPresentationState {
  readonly mode: 'idle' | 'presenting' | 'cooldown';
  readonly active: HandoverPresentationEvent | null;
  readonly startedAtMs: number | null;
  readonly cooldownUntilMs: number;
  /** Most recent valid event observed, including events intentionally suppressed. */
  readonly lastObservedEventId: string | null;
}

export interface HandoverPresentationView {
  readonly active: boolean;
  readonly event: HandoverPresentationEvent | null;
  readonly phase: HandoverPresentationPhase | null;
  readonly progress01: number;
  /** Slow motion is legal only while a drawable transition is visibly underway. */
  readonly autoSlowActive: boolean;
  readonly sourceRole: 'serving';
  /** The acquired link becomes serving-yellow in the settled phase. */
  readonly targetRole: 'candidate' | 'serving';
}

export interface HandoverPresentationAdvanceResult {
  readonly state: HandoverPresentationState;
  readonly view: HandoverPresentationView;
}

/**
 * Complete snapshot for controls outside the renderer. `view.active` is the
 * visible envelope; `mode` also keeps the shared gate busy during cooldown.
 */
export interface HandoverPresentationSnapshot {
  readonly view: HandoverPresentationView;
  readonly mode: HandoverPresentationState['mode'];
  readonly cooldownUntilMs: number;
}

export const HANDOVER_PRESENTATION_COOLDOWN_MS = 1500;

export function createHandoverPresentationState(): HandoverPresentationState {
  return {
    mode: 'idle',
    active: null,
    startedAtMs: null,
    cooldownUntilMs: 0,
    lastObservedEventId: null,
  };
}

export function isDrawableHandoverPresentationEvent(
  event: HandoverPresentationEvent | null | undefined,
): event is HandoverPresentationEvent {
  if (!event) return false;
  if (
    event.eventId.length === 0
    || !Number.isFinite(event.durationMs)
    || event.durationMs <= 0
    || event.from.satId.length === 0
    || event.to.satId.length === 0
    || !Number.isInteger(event.from.cellId)
    || !Number.isInteger(event.to.cellId)
    || !event.from.drawable
    || !event.to.drawable
  ) return false;

  return event.kind === 'inter'
    ? event.from.satId !== event.to.satId
    : event.from.satId === event.to.satId && event.from.cellId !== event.to.cellId;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * The inter lead-in keeps the serving link alone for one second of its
 * six-second story. The same shared phase boundaries drive the cone envelope,
 * badge phase, and HO Slow state.
 */
export function resolveHandoverPresentationPhase(
  kind: HandoverPresentationKind,
  progress01: number,
): HandoverPresentationPhase {
  const progress = clampProgress(progress01);
  const phases = kind === 'inter'
    ? INTER_HANDOVER_CINEMA_PHASE_END
    : { serving: 0.2, measuring: 0.4, holding: 0.6, releasing: 0.8 };
  if (progress < phases.serving) return 'serving';
  if (progress < phases.measuring) return 'measuring';
  if (progress < phases.holding) return 'holding';
  if (progress < phases.releasing) return 'releasing';
  return 'settled';
}

export function createIdleHandoverPresentationView(): HandoverPresentationView {
  return {
    active: false,
    event: null,
    phase: null,
    progress01: 0,
    autoSlowActive: false,
    sourceRole: 'serving',
    targetRole: 'candidate',
  };
}

function activeView(
  event: HandoverPresentationEvent,
  startedAtMs: number,
  nowMs: number,
): HandoverPresentationView {
  const progress01 = clampProgress((nowMs - startedAtMs) / event.durationMs);
  const phase = resolveHandoverPresentationPhase(event.kind, progress01);
  return {
    active: true,
    event,
    phase,
    progress01,
    autoSlowActive: phase !== 'settled',
    sourceRole: 'serving',
    targetRole: phase === 'settled' ? 'serving' : 'candidate',
  };
}

/**
 * Advance one wall-clock presentation step.
 *
 * New events observed while another story or its cooldown owns the screen are
 * deliberately consumed but not queued. Scientific event logs remain intact;
 * only their visual reenactment is suppressed, preventing rapid handovers from
 * interrupting or immediately following one another. Explicit manual/cinema
 * requests use the same lock: they cannot preempt a story or bypass cooldown.
 */
export function advanceHandoverPresentation(
  previous: HandoverPresentationState,
  input: {
    readonly nowMs: number;
    readonly candidate?: HandoverPresentationEvent | null;
    readonly cooldownMs?: number;
    /** Owner hint for the source that requested the candidate; never preempts. */
    readonly owner?: HandoverPresentationOwner;
  },
): HandoverPresentationAdvanceResult {
  const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : 0;
  const cooldownMs = Number.isFinite(input.cooldownMs)
    ? Math.max(0, input.cooldownMs ?? HANDOVER_PRESENTATION_COOLDOWN_MS)
    : HANDOVER_PRESENTATION_COOLDOWN_MS;
  const candidate = isDrawableHandoverPresentationEvent(input.candidate)
    ? input.candidate
    : null;

  if (previous.mode === 'presenting' && previous.active && previous.startedAtMs !== null) {
    const lastObservedEventId = candidate?.eventId ?? previous.lastObservedEventId;
    if (nowMs - previous.startedAtMs < previous.active.durationMs) {
      const state = { ...previous, lastObservedEventId };
      return { state, view: activeView(previous.active, previous.startedAtMs, nowMs) };
    }
    return {
      state: {
        mode: 'cooldown',
        active: null,
        startedAtMs: null,
        cooldownUntilMs: nowMs + cooldownMs,
        lastObservedEventId,
      },
      view: createIdleHandoverPresentationView(),
    };
  }

  if (previous.mode === 'cooldown') {
    const lastObservedEventId = candidate?.eventId ?? previous.lastObservedEventId;
    if (nowMs < previous.cooldownUntilMs) {
      return {
        state: { ...previous, lastObservedEventId },
        view: createIdleHandoverPresentationView(),
      };
    }
    previous = {
      mode: 'idle',
      active: null,
      startedAtMs: null,
      cooldownUntilMs: 0,
      lastObservedEventId,
    };
  }

  if (candidate && candidate.eventId !== previous.lastObservedEventId) {
    const state: HandoverPresentationState = {
      mode: 'presenting',
      active: candidate,
      startedAtMs: nowMs,
      cooldownUntilMs: 0,
      lastObservedEventId: candidate.eventId,
    };
    return { state, view: activeView(candidate, nowMs, nowMs) };
  }

  return { state: previous, view: createIdleHandoverPresentationView() };
}
