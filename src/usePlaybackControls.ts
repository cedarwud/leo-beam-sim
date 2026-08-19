import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SimState } from './scene/types';

const DEFAULT_BASE_SPEED = 5;
const HANDOVER_FOCUS_SPEED = 1;
// CQ2 (cinema quality): the Director/cinema slow-mo tier. Raised from the original
// 0.05x — at 0.05x even the short lead-in→event→linger window took ~2-3 minutes of
// wall-clock, so the cinema "felt frozen and dragged". 0.25x keeps the handover
// readable (still 4x slower than the 1x HO-focus tier and 20x slower than base)
// while the whole cinema now resolves in seconds. Pure display speed (Rule#6): it
// scales dt in lockstep, never the SINR/HO/decision truth.
const DIRECTOR_FOCUS_SPEED = 0.25;

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
}

/**
 * Playback never infers a visual transition from a raw pending/TTT field.  The
 * scene presentation owner is the only authority that can request HO Slow.
 */
export function resolveLegacyAutoSlowActive(signal: LegacyAutoSlowSignal): boolean {
  return signal.visibleHandoverActive;
}

export function usePlaybackControls(
  _simState: SimState,
  directorFocusActive = false,
  visibleHandoverActive = false,
): PlaybackControls {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_BASE_SPEED);
  const [autoSlowEnabled, setAutoSlowEnabled] = useState(true);
  const [autoSlowDismissed, setAutoSlowDismissed] = useState(false);

  const autoSlowActive = resolveLegacyAutoSlowActive({ visibleHandoverActive });
  const autoSlowApplied = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
  const directorSlowActive = directorFocusActive && visibleHandoverActive;
  const effectiveSpeed = directorSlowActive
    ? Math.min(speed, DIRECTOR_FOCUS_SPEED)
    : autoSlowApplied
      ? Math.min(speed, HANDOVER_FOCUS_SPEED)
      : speed;

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
