/**
 * THE owning contract for handover presentation timing.
 *
 * A handover's display story has three coupled decisions: how long the window
 * stays readable, where its phases start and end, and how the old/new cone
 * opacities move through that window. Those decisions used to be split across
 * homepage timing, the manual demo, scene isolation, the presentation owner,
 * and the SINR cone style constants. That made one timing change require a
 * hunt through adapters and made it possible for a badge and a cone to tell
 * different stories.
 *
 * This module is the pure appearance seam. It imports no scene, homepage, or
 * viz code; those layers delegate to this answer and paint what they receive.
 * The inter envelope remains intentionally different from intra: inter has a
 * serving-only lead-in so the viewer can see the source satellite before the
 * cross-satellite candidate arrives. That is a real per-kind distinction, not
 * duplication to flatten.
 */

export const HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS = 16_000;
export const HOMEPAGE_INTER_HANDOVER_DISPLAY_MS = 12_000;
export const MANUAL_HANDOVER_DISPLAY_MS = 8000;
export const INTRA_HANDOVER_CINEMA_DISPLAY_MS = 8000;
export const INTER_HANDOVER_CINEMA_DISPLAY_MS = 6000;

/** The real triggered flash's shorter wall-clock budget during playback. */
export const SINR_LIVE_TRIGGERED_INTRA_SUSTAIN_MS = 5000;

/** Intra keeps the established five-act envelope. Boundaries are phase ends. */
export const HANDOVER_CONE_PHASE_END = {
  serving: 0.1875,
  measuring: 0.375,
  holding: 0.5625,
  releasing: 0.75,
} as const;

/**
 * Inter keeps a one-second serving-only lead-in inside its six-second cinema
 * window; the later phases therefore use their measured, non-intra fractions.
 */
export const INTER_HANDOVER_CINEMA_PHASE_END = {
  serving: 1 / 6,
  measuring: 14 / 33,
  holding: 19 / 33,
  releasing: 9 / 11,
} as const;

export type HandoverConePhase = 'serving' | 'measuring' | 'holding' | 'releasing' | 'settled';

export interface HandoverConeEnvelope {
  /** Alpha for the OLD (from) cone. 0 means the renderer emits no old cone. */
  readonly fromOpacity: number;
  /** Alpha for the NEW (to) cone. 0 means the renderer emits no new cone. */
  readonly toOpacity: number;
  readonly phase: HandoverConePhase;
}

function smoothstep01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value * value * (3 - 2 * value);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Phase boundaries as a SHAPE, not as one table's literal values.
 *
 * `typeof HANDOVER_CONE_PHASE_END` pins each field to the literal it happens to
 * hold (0.1875, 0.375, ...), so the inter-cinema table — same shape, different
 * numbers — could not be passed in. The boundaries are data; the resolver only
 * needs four ordered fractions.
 */
interface HandoverPhaseBoundaries {
  readonly serving: number;
  readonly measuring: number;
  readonly holding: number;
  readonly releasing: number;
}

function phaseFor(progress01: number, phases: HandoverPhaseBoundaries): HandoverConePhase {
  if (progress01 < phases.serving) return 'serving';
  if (progress01 < phases.measuring) return 'measuring';
  if (progress01 < phases.holding) return 'holding';
  if (progress01 < phases.releasing) return 'releasing';
  return 'settled';
}

/** Resolve the shared intra handover old/new alpha envelope. */
export function resolveHandoverConeEnvelope(
  progress01: number,
  peakOpacity: number,
): HandoverConeEnvelope {
  const peak = Number.isFinite(peakOpacity) ? Math.max(0, peakOpacity) : 0;
  const progress = clampProgress(progress01);
  const { serving, measuring, holding, releasing } = HANDOVER_CONE_PHASE_END;
  const toOpacity = peak * smoothstep01((progress - serving) / (measuring - serving));
  const fromOpacity = peak * (1 - smoothstep01((progress - holding) / (releasing - holding)));
  return {
    fromOpacity,
    toOpacity,
    phase: phaseFor(progress, HANDOVER_CONE_PHASE_END),
  };
}

/** Resolve the intentionally distinct inter-satellite alpha envelope. */
export function resolveInterHandoverCinemaEnvelope(
  progress01: number,
  peakOpacity: number,
): HandoverConeEnvelope {
  const peak = Number.isFinite(peakOpacity) ? Math.max(0, peakOpacity) : 0;
  const progress = clampProgress(progress01);
  const { serving, measuring, holding, releasing } = INTER_HANDOVER_CINEMA_PHASE_END;
  const toOpacity = peak * smoothstep01((progress - serving) / (measuring - serving));
  const fromOpacity = peak * (1 - smoothstep01((progress - holding) / (releasing - holding)));
  return {
    fromOpacity,
    toOpacity,
    phase: phaseFor(progress, INTER_HANDOVER_CINEMA_PHASE_END),
  };
}

/** Resolve the envelope for whichever handover kind owns the presentation. */
export function resolveHandoverCinemaEnvelope(
  kind: 'intra' | 'inter' | null,
  progress01: number,
  peakOpacity: number,
): HandoverConeEnvelope {
  return kind === 'inter'
    ? resolveInterHandoverCinemaEnvelope(progress01, peakOpacity)
    : resolveHandoverConeEnvelope(progress01, peakOpacity);
}

/** Keep phase labels, cone alpha, and presentation clocks on the same boundaries. */
export function resolveHandoverPresentationPhase(
  kind: 'intra' | 'inter',
  progress01: number,
): HandoverConePhase {
  const progress = clampProgress(progress01);
  return phaseFor(
    progress,
    kind === 'inter' ? INTER_HANDOVER_CINEMA_PHASE_END : HANDOVER_CONE_PHASE_END,
  );
}

/** Select the display window used by the scene cinema owner. */
export function resolveHandoverCinemaDisplayMs(kind: 'intra' | 'inter' | null): number {
  return kind === 'inter'
    ? INTER_HANDOVER_CINEMA_DISPLAY_MS
    : INTRA_HANDOVER_CINEMA_DISPLAY_MS;
}
