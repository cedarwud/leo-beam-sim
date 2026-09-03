import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  HomepagePlaybackCommand,
  HomepagePlaybackTransportState,
} from './contracts';
import {
  createHomepagePlaybackTransportState,
  deriveHomepagePlaybackTransportState,
  reduceHomepagePlaybackTransport,
  type HomepagePlaybackTransportSpeedContext,
} from './playbackTransport';

/**
 * The homepage-facing transport surface.  The simulator still owns the clock;
 * this hook owns only user playback intent and the display-only speed cap.
 */
export interface HomepagePlaybackTransportControls extends HomepagePlaybackTransportState {
  /** Compatibility name used by the existing timeline/runtime consumers. */
  readonly speed: number;
  readonly autoSlowActive: boolean;
  readonly autoSlowApplied: boolean;
  readonly autoSlowEnabled: boolean;
  readonly togglePause: () => void;
  readonly setPaused: (next: boolean) => void;
  readonly setSpeed: (next: number) => void;
  /** Issue a seek intent; the integration owner forwards the returned target. */
  readonly requestSeek: (targetSec: number) => number;
  readonly dismissAutoSlow: () => void;
  readonly toggleAutoSlow: () => void;
  readonly resetAutoSlowDismissed: () => void;
}

export interface HomepagePlaybackTransportOptions {
  readonly directorFocusActive?: boolean;
  readonly visibleHandoverActive?: boolean;
  readonly candidateComparisonActive?: boolean;
  readonly startPaused?: boolean;
}

function commandState(
  state: HomepagePlaybackTransportState,
  command: HomepagePlaybackCommand,
  context: HomepagePlaybackTransportSpeedContext,
): HomepagePlaybackTransportState {
  return reduceHomepagePlaybackTransport(state, command, context).state;
}

/**
 * Route-local hook for `/`.  It deliberately delegates all speed policy to
 * the pure PlaybackTransport module and never advances source time itself.
 */
export function useHomepagePlaybackTransport(
  options: HomepagePlaybackTransportOptions = {},
): HomepagePlaybackTransportControls {
  const {
    directorFocusActive = false,
    visibleHandoverActive = false,
    candidateComparisonActive = false,
    startPaused = false,
  } = options;
  const [baseState, setBaseState] = useState<HomepagePlaybackTransportState>(() => (
    createHomepagePlaybackTransportState({ paused: startPaused })
  ));
  const [autoSlowEnabled, setAutoSlowEnabled] = useState(true);
  const [autoSlowDismissed, setAutoSlowDismissed] = useState(false);

  const autoSlowActive = visibleHandoverActive || candidateComparisonActive;
  const autoSlowApplied = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
  const context = useMemo<HomepagePlaybackTransportSpeedContext>(() => ({
    directorSlowActive: directorFocusActive && visibleHandoverActive,
    candidateComparisonSlowActive: autoSlowApplied && candidateComparisonActive,
    autoSlowApplied,
  }), [
    autoSlowApplied,
    candidateComparisonActive,
    directorFocusActive,
    visibleHandoverActive,
  ]);
  const state = useMemo(
    () => deriveHomepagePlaybackTransportState(
      { paused: baseState.paused, selectedSpeed: baseState.selectedSpeed },
      context,
    ),
    [baseState.paused, baseState.selectedSpeed, context],
  );

  useEffect(() => {
    if (!autoSlowActive) setAutoSlowDismissed(false);
  }, [autoSlowActive]);

  const issue = useCallback((command: HomepagePlaybackCommand): void => {
    setBaseState(previous => commandState(previous, command, context));
  }, [context]);
  const togglePause = useCallback(() => issue({ type: 'toggle' }), [issue]);
  const setPaused = useCallback((next: boolean) => {
    issue({ type: next ? 'pause' : 'play' });
  }, [issue]);
  const setSpeed = useCallback((next: number) => {
    issue({ type: 'set-speed', speed: next });
  }, [issue]);
  const requestSeek = useCallback((targetSec: number): number => {
    // This is intentionally a pure command acknowledgement.  The transport
    // records no cursor; App forwards the intent to the one canonical source.
    const transition = reduceHomepagePlaybackTransport(
      state,
      { type: 'seek', targetSec },
      context,
    );
    return transition.seekTargetSec ?? targetSec;
  }, [context, state]);
  const dismissAutoSlow = useCallback(() => setAutoSlowDismissed(true), []);
  const toggleAutoSlow = useCallback(() => setAutoSlowEnabled(value => !value), []);
  const resetAutoSlowDismissed = useCallback(() => setAutoSlowDismissed(false), []);

  return useMemo(() => Object.freeze({
    ...state,
    speed: state.selectedSpeed,
    autoSlowActive,
    autoSlowApplied,
    autoSlowEnabled,
    togglePause,
    setPaused,
    setSpeed,
    requestSeek,
    dismissAutoSlow,
    toggleAutoSlow,
    resetAutoSlowDismissed,
  }), [
    autoSlowActive,
    autoSlowApplied,
    autoSlowEnabled,
    dismissAutoSlow,
    requestSeek,
    resetAutoSlowDismissed,
    setPaused,
    setSpeed,
    state,
    toggleAutoSlow,
    togglePause,
  ]);
}
