import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SimState } from './scene/types';

// Multi-candidate evaluation is the homepage's default teaching state. Starting
// at 5x lets the first post-mount frame skip the real qualification window
// before React can apply HO Slow, so the user sees only the aftermath. Keep the
// default at real time; 2x/5x remain explicit user choices.
const DEFAULT_BASE_SPEED = 1;
// Keep the actual switch animation at the same readable half-speed as the
// multi-candidate comparison. The role changes from candidate to serving, but
// the user still needs time to follow the winning satellite/beam into service.
const HANDOVER_FOCUS_SPEED = 0.5;
// Candidate comparison is the first half of the same handover story.  It must
// use the same capped clock as the source→target cross-fade; otherwise a 10x or
// 20x timeline can run through eligibility/TTT before the user can see which
// spacecrafts were actually compared.
const CANDIDATE_COMPARISON_FOCUS_SPEED = HANDOVER_FOCUS_SPEED;
// CQ2 (cinema quality): the Director/cinema slow-mo tier. Raised from the original
// 0.05x — at 0.05x even the short lead-in→event→linger window took ~2-3 minutes of
// wall-clock, so the cinema "felt frozen and dragged". 0.25x keeps the handover
// readable (still 4x slower than the 1x HO-focus tier and 20x slower than base)
// while the whole cinema now resolves in seconds. Pure display speed (Rule#6): it
// scales dt in lockstep, never the SINR/HO/decision truth.
const DIRECTOR_FOCUS_SPEED = 0.25;

export interface EffectivePlaybackSpeedInput {
  readonly speed: number;
  readonly directorSlowActive: boolean;
  readonly candidateComparisonSlowActive: boolean;
  readonly autoSlowApplied: boolean;
}

/**
 * Resolve the clock rate used by the scene and timeline consumers.
 *
 * The automatic handover cap owns the complete candidate-to-switch story.  A
 * speed preset is still effective during ordinary playback, but it must not
 * let a visible handover outrun its comparison, TTT, or transfer animation.
 * Keeping this rule in a pure function gives the transport a small regression
 * seam instead of relying on a browser-only interaction test.
 */
export function resolveEffectivePlaybackSpeed({
  speed,
  directorSlowActive,
  candidateComparisonSlowActive,
  autoSlowApplied,
}: EffectivePlaybackSpeedInput): number {
  const safeSpeed = Number.isFinite(speed) && speed >= 0 ? speed : DEFAULT_BASE_SPEED;
  if (directorSlowActive) return Math.min(safeSpeed, DIRECTOR_FOCUS_SPEED);
  if (candidateComparisonSlowActive) return Math.min(safeSpeed, CANDIDATE_COMPARISON_FOCUS_SPEED);
  if (autoSlowApplied) return Math.min(safeSpeed, HANDOVER_FOCUS_SPEED);
  return safeSpeed;
}

export interface PlaybackControls {
  readonly paused: boolean;
  readonly speed: number;
  readonly effectiveSpeed: number;
  readonly autoSlowActive: boolean;
  readonly autoSlowApplied: boolean;
  readonly autoSlowEnabled: boolean;
  readonly togglePause: () => void;
  readonly setPaused: (next: boolean) => void;
  readonly setSpeed: (next: number) => void;
  readonly dismissAutoSlow: () => void;
  readonly toggleAutoSlow: () => void;
  readonly resetAutoSlowDismissed: () => void;
}

export interface LegacyAutoSlowSignal {
  /** Resolved by the scene presentation owner after both cone ends are drawable. */
  readonly visibleHandoverActive: boolean;
  /** Display-only multi-candidate comparison focus; never a decision input. */
  readonly candidateComparisonActive?: boolean;
}

/**
 * Playback never infers a visual transition from a raw pending/TTT field.  The
 * scene presentation owner is the only authority that can request HO Slow.
 */
export function resolveLegacyAutoSlowActive(signal: LegacyAutoSlowSignal): boolean {
  return signal.visibleHandoverActive || signal.candidateComparisonActive === true;
}

export function usePlaybackControls(
  _simState: SimState,
  directorFocusActive = false,
  visibleHandoverActive = false,
  candidateComparisonActive = false,
  startPaused = false,
): PlaybackControls {
  const [paused, setPaused] = useState(startPaused);
  const [speed, setSpeed] = useState(DEFAULT_BASE_SPEED);
  const [autoSlowEnabled, setAutoSlowEnabled] = useState(true);
  const [autoSlowDismissed, setAutoSlowDismissed] = useState(false);

  const autoSlowActive = resolveLegacyAutoSlowActive({
    visibleHandoverActive,
    candidateComparisonActive,
  });
  const autoSlowEligible = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
  // Keep the cap active for the whole visible candidate→handover story.  The
  // transport presets remain useful before/after that story, while Resume or
  // turning off HO Slow is the explicit escape hatch during it.
  const autoSlowApplied = autoSlowEligible;
  const directorSlowActive = directorFocusActive && visibleHandoverActive;
  const candidateComparisonSlowActive = autoSlowEligible && candidateComparisonActive;
  const effectiveSpeed = resolveEffectivePlaybackSpeed({
    speed,
    directorSlowActive,
    candidateComparisonSlowActive,
    autoSlowApplied,
  });

  useEffect(() => {
    if (!autoSlowActive) setAutoSlowDismissed(false);
  }, [autoSlowActive]);

  const togglePause = useCallback(() => setPaused(p => !p), []);
  const setPausedValue = useCallback((next: boolean) => setPaused(next), []);
  const dismissAutoSlow = useCallback(() => setAutoSlowDismissed(true), []);
  const toggleAutoSlow = useCallback(() => setAutoSlowEnabled(e => !e), []);
  const resetAutoSlowDismissed = useCallback(() => setAutoSlowDismissed(false), []);

  return useMemo(
    () => ({
      paused,
      speed,
      effectiveSpeed,
      autoSlowActive,
      autoSlowApplied,
      autoSlowEnabled,
      togglePause,
      setPaused: setPausedValue,
      setSpeed,
      dismissAutoSlow,
      toggleAutoSlow,
      resetAutoSlowDismissed,
    }),
    [
      paused,
      speed,
      effectiveSpeed,
      directorSlowActive,
      candidateComparisonSlowActive,
      autoSlowActive,
      autoSlowApplied,
      autoSlowEnabled,
      togglePause,
      setPausedValue,
      dismissAutoSlow,
      toggleAutoSlow,
      resetAutoSlowDismissed,
    ],
  );
}
