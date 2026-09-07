import {
  guidedReplayProgress,
} from '../../visualLab/guidedReplay/model';
import type {
  VisualLabGuidedReplayPhase,
  VisualLabGuidedReplayProgress,
} from '../../visualLab/guidedReplay/types';
import type { VisualLabStoryBeat } from '../../visualLab/story';

export const VISUAL_LAB_DEMO_HANDOVER_DURATION_MS = 12_000 as const;

export interface VisualLabDemoHandoverView {
  readonly phase: VisualLabGuidedReplayPhase;
  readonly beat: VisualLabStoryBeat;
  readonly progress: VisualLabGuidedReplayProgress;
}

/** Resolve the compact handover teaching clock without React or browser state. */
export function deriveVisualLabDemoHandoverView(
  elapsedMs: number,
): VisualLabDemoHandoverView {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  // This is a short teaching clock, not the canonical 30 s TLE decision clock.
  if (elapsed < 1_000) return { phase: 'baseline', beat: 'before', progress: guidedReplayProgress('baseline', elapsed) };
  if (elapsed < 2_800) return { phase: 'intervention', beat: 'before', progress: guidedReplayProgress('intervention', elapsed - 1_000) };
  if (elapsed < 5_200) return { phase: 'before', beat: 'before', progress: guidedReplayProgress('before', elapsed - 2_800) };
  if (elapsed < 6_800) return { phase: 'decision', beat: 'decision', progress: guidedReplayProgress('decision', elapsed - 5_200) };
  return { phase: 'after', beat: 'after', progress: guidedReplayProgress('after', elapsed - 6_800) };
}
