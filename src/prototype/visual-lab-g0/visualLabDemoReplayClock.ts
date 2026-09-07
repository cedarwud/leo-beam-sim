import type { VisualLabDemoReplayState } from './visualLabDemoDirection';
import { VISUAL_LAB_DEMO_HANDOVER_DURATION_MS } from './visualLabDemoHandoverView';

/** Advance the compact demo clock without React or browser timing state. */
export function advanceVisualLabDemoReplay(
  current: VisualLabDemoReplayState,
  deltaMs: number,
  durationMs: number = VISUAL_LAB_DEMO_HANDOVER_DURATION_MS,
): VisualLabDemoReplayState | null {
  const elapsedMs = Number.isFinite(current.elapsedMs) ? Math.max(0, current.elapsedMs) : 0;
  const delta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const nextElapsedMs = elapsedMs + delta;
  if (nextElapsedMs >= duration) return null;
  return Object.freeze({ ...current, elapsedMs: nextElapsedMs });
}
