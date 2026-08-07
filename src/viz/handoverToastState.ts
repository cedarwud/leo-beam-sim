// P1d: consumes `NormalizedSceneFrame.transitionProgress` instead of
// `SimFrame`. The live adapter populates intra/inter progress with optional
// live-only metadata (kind=committed/preview/pending, wallclock latches,
// pendingProgressSec, …); replay leaves those undefined and the toast simply
// renders nothing — preview / wallclock animations are live-only display
// surfaces.
import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';

export type HandoverToastKind = 'intra' | 'inter';

export interface HandoverToastState {
  kind: HandoverToastKind;
  sourceSatId: string | null;
  sourceBeamId: number | null;
  targetSatId: string | null;
  targetBeamId: number | null;
  progressSec: number;
  targetSec: number;
  progressRatio: number;
}

export type HandoverToastInput = Pick<NormalizedSceneFrame, 'transitionProgress'>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function resolveHandoverToastState(
  input: HandoverToastInput,
  // Retained for live-only re-evaluation of pending-inter timing; replay
  // ignores this parameter.
  _interTriggerSec: number,
  wallClockNowMs: number,
): HandoverToastState | null {
  const intra = input.transitionProgress.intra;
  if (intra && intra.kind === 'preview'
    && intra.previewProgressSec !== undefined
    && intra.previewTargetSec !== undefined
  ) {
    const targetSec = Math.max(intra.previewTargetSec, 1e-6);
    const progressSec = Math.max(0, intra.previewProgressSec);
    return {
      kind: 'intra',
      sourceSatId: intra.satId ?? null,
      sourceBeamId: Number(intra.fromBeamId),
      targetSatId: intra.satId ?? null,
      targetBeamId: Number(intra.toBeamId),
      progressSec,
      targetSec,
      progressRatio: clamp01(intra.progress01 / 0.3),
    };
  }
  if (
    intra && intra.kind === 'committed'
    && intra.wallClockStartMs !== undefined
    && intra.wallClockExpiresMs !== undefined
    && wallClockNowMs <= intra.wallClockExpiresMs
  ) {
    const targetSec = Math.max(
      (intra.wallClockExpiresMs - intra.wallClockStartMs) / 1000,
      1e-6,
    );
    const progressSec = Math.max(0, (wallClockNowMs - intra.wallClockStartMs) / 1000);
    return {
      kind: 'intra',
      sourceSatId: intra.satId ?? null,
      sourceBeamId: Number(intra.fromBeamId),
      targetSatId: intra.satId ?? null,
      targetBeamId: Number(intra.toBeamId),
      progressSec,
      targetSec,
      progressRatio: clamp01(progressSec / targetSec),
    };
  }
  if (
    intra && intra.kind === 'recent'
    && intra.recentProgressSec !== undefined
    && intra.recentTargetSec !== undefined
    && intra.recentProgressSec < Math.max(intra.recentTargetSec, 1e-6)
  ) {
    const targetSec = Math.max(intra.recentTargetSec, 1e-6);
    const progressSec = Math.max(0, intra.recentProgressSec);
    return {
      kind: 'intra',
      sourceSatId: intra.satId ?? null,
      sourceBeamId: Number(intra.fromBeamId),
      targetSatId: intra.satId ?? null,
      targetBeamId: Number(intra.toBeamId),
      progressSec,
      targetSec,
      progressRatio: clamp01(progressSec / targetSec),
    };
  }

  const inter = input.transitionProgress.inter;
  if (
    inter && inter.kind === 'pending'
    && inter.pendingProgressSec !== undefined
    && inter.pendingTargetSec !== undefined
  ) {
    const targetSec = Math.max(inter.pendingTargetSec, 1e-6);
    const progressSec = Math.max(0, inter.pendingProgressSec);
    return {
      kind: 'inter',
      sourceSatId: inter.fromSatId,
      sourceBeamId: Number(inter.fromBeamId),
      targetSatId: inter.toSatId,
      targetBeamId: Number(inter.toBeamId),
      progressSec,
      targetSec,
      progressRatio: clamp01(progressSec / targetSec),
    };
  }
  if (
    inter && inter.kind === 'committed'
    && inter.wallClockStartMs !== undefined
    && inter.wallClockExpiresMs !== undefined
    && wallClockNowMs <= inter.wallClockExpiresMs
  ) {
    const targetSec = Math.max(
      (inter.wallClockExpiresMs - inter.wallClockStartMs) / 1000,
      1e-6,
    );
    const progressSec = Math.max(0, (wallClockNowMs - inter.wallClockStartMs) / 1000);
    return {
      kind: 'inter',
      sourceSatId: inter.fromSatId,
      sourceBeamId: Number(inter.fromBeamId),
      targetSatId: inter.toSatId,
      targetBeamId: Number(inter.toBeamId),
      progressSec,
      targetSec,
      progressRatio: clamp01(progressSec / targetSec),
    };
  }
  if (
    inter && inter.kind === 'recent'
    && inter.recentProgressSec !== undefined
    && inter.recentTargetSec !== undefined
    && inter.recentProgressSec < Math.max(inter.recentTargetSec, 1e-6)
  ) {
    const targetSec = Math.max(inter.recentTargetSec, 1e-6);
    const progressSec = Math.max(0, inter.recentProgressSec);
    return {
      kind: 'inter',
      sourceSatId: inter.fromSatId,
      sourceBeamId: Number(inter.fromBeamId),
      targetSatId: inter.toSatId,
      targetBeamId: Number(inter.toBeamId),
      progressSec,
      targetSec,
      progressRatio: clamp01(progressSec / targetSec),
    };
  }

  return null;
}
