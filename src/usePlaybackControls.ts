import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SimState } from './scene/types';

const DEFAULT_BASE_SPEED = 5;
const HANDOVER_FOCUS_SPEED = 1;

export interface PlaybackControls {
  readonly paused: boolean;
  readonly speed: number;
  readonly effectiveSpeed: number;
  readonly autoSlowActive: boolean;
  readonly autoSlowApplied: boolean;
  readonly autoSlowEnabled: boolean;
  readonly togglePause: () => void;
  readonly setSpeed: (next: number) => void;
  readonly dismissAutoSlow: () => void;
  readonly toggleAutoSlow: () => void;
  readonly resetAutoSlowDismissed: () => void;
}

export function usePlaybackControls(simState: SimState): PlaybackControls {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_BASE_SPEED);
  const [autoSlowEnabled, setAutoSlowEnabled] = useState(true);
  const [autoSlowDismissed, setAutoSlowDismissed] = useState(false);

  const autoSlowActive =
    simState.pendingTargetSatId !== null || simState.intraHandoverEvent !== null;
  const autoSlowApplied = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
  const effectiveSpeed = autoSlowApplied ? Math.min(speed, HANDOVER_FOCUS_SPEED) : speed;

  useEffect(() => {
    if (!autoSlowActive) setAutoSlowDismissed(false);
  }, [autoSlowActive]);

  const togglePause = useCallback(() => setPaused(p => !p), []);
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
      setSpeed,
      dismissAutoSlow,
      toggleAutoSlow,
      resetAutoSlowDismissed,
    }),
    [
      paused,
      speed,
      effectiveSpeed,
      autoSlowActive,
      autoSlowApplied,
      autoSlowEnabled,
      togglePause,
      dismissAutoSlow,
      toggleAutoSlow,
      resetAutoSlowDismissed,
    ],
  );
}
