/**
 * Source-neutral, presentation-only ownership for one visible handover story.
 *
 * Walker, archived TLE, and an explicit teaching command may all describe a
 * handover, but none of those producers owns its wall-clock animation.  This
 * module accepts their normalized endpoints and guarantees that only one
 * drawable story can run at a time.  It never feeds a decision back into SINR,
 * TTT, orbit propagation, or serving selection.
 */

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
 * The inter lead-in intentionally keeps the serving link alone for 45% of its
 * six-second story (about one second longer than the previous 28% envelope).
 * The settled candidate tail is bounded to the final 12%, so it cannot linger.
 */
export function resolveHandoverPresentationPhase(
  kind: HandoverPresentationKind,
  progress01: number,
): HandoverPresentationPhase {
  const progress = clampProgress(progress01);
  const phases = kind === 'inter'
    ? { serving: 0.45, measuring: 0.62, holding: 0.72, releasing: 0.88 }
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
 * deliberately consumed but not queued.  Scientific event logs remain intact;
 * only their visual reenactment is suppressed, preventing rapid handovers from
 * interrupting or immediately following one another.
 */
export function advanceHandoverPresentation(
  previous: HandoverPresentationState,
  input: {
    readonly nowMs: number;
    readonly candidate?: HandoverPresentationEvent | null;
    readonly cooldownMs?: number;
    /** Explicit cinema claims replace a natural Walker/TLE visual owner. */
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

  // The model may still retain a natural event while an explicit teaching
  // command claims the viewport. That event remains valid truth, but it must
  // stop owning the display immediately. Manual and cinema are both explicit
  // owners; treating only cinema this way caused the intermittent overlap
  // between a manual button story and an old natural blue event.
  const explicitOwner = input.owner === 'manual' || input.owner === 'cinema';
  const ownerChangedWhilePresenting = explicitOwner
    && previous.active !== null
    && previous.active.source !== input.owner;
  const ownerStartsNewEventDuringCooldown = explicitOwner
    && previous.mode === 'cooldown'
    && candidate !== null
    && candidate.source === input.owner
    && candidate.eventId !== previous.lastObservedEventId;
  if (ownerChangedWhilePresenting || ownerStartsNewEventDuringCooldown) {
    previous = createHandoverPresentationState();
  }

  // A manual request has ended when the caller returns to the natural owner.
  // Do not let the old manual envelope keep running for one extra render and
  // collide with the next natural event.
  if (
    input.owner === 'natural'
    && previous.active?.source === 'manual'
    && candidate?.source !== 'manual'
  ) {
    previous = createHandoverPresentationState();
  }

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
