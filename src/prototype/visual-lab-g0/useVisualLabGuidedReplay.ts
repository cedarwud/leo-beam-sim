import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  FrameOptionsDraftView,
  VisualLabFrameOptions,
  VisualLabSession,
  LabSnapshot,
} from '../../visualLab/session';
import type { VisualLabStoryController } from '../../visualLab/story';
import {
  guidedReplayDefinition,
  guidedReplayPhaseTiming,
  guidedReplayProgress,
  type VisualLabGuidedReplayAnnotationMode,
  type VisualLabGuidedReplayId,
  type VisualLabGuidedReplayPhase,
  type VisualLabGuidedReplayState,
} from '../../visualLab/guidedReplay';
import type { VisualLabCausalReplay } from './useVisualLabCausalReplay';
import {
  visualLabAcceptedReplayEvidenceReady,
  visualLabCausalComparisonReady,
} from './useVisualLabCausalReplay';
import { visualLabReplaySourceIdentity } from './visualLabReplaySourceIdentity';

export interface VisualLabGuidedReplay extends VisualLabGuidedReplayState {
  readonly openStory: (storyId: VisualLabGuidedReplayId, baselineStoryRuntimeId: string) => Promise<void>;
  readonly close: () => Promise<void>;
  readonly next: () => Promise<void>;
  readonly restart: () => Promise<void>;
  readonly togglePlay: () => Promise<void>;
  readonly setAnnotationMode: (mode: VisualLabGuidedReplayAnnotationMode) => void;
}

const INITIAL_STATE: VisualLabGuidedReplayState = Object.freeze({
  open: false,
  storyId: 'inter-handover',
  phase: 'baseline',
  annotationMode: 'clean',
  baselineStoryRuntimeId: null,
  candidateStoryRuntimeId: null,
  playing: false,
  busy: false,
  prepared: false,
  progress: guidedReplayProgress('baseline'),
  error: null,
});

/**
 * A guided replay is allowed to publish a new accepted frame while it is
 * preparing or advancing its source-backed A/B story.  That publication is
 * different from a user changing the TLE source underneath an already-open
 * replay.  Keep this distinction explicit so the effect below cannot close a
 * replay merely because its own accepted candidate became visible.
 */
export function guidedReplayShouldCloseForSourceChange(input: {
  readonly open: boolean;
  readonly trackedSource: string | null;
  readonly currentSource: string | null;
  readonly replayOwnsTransition: boolean;
}): boolean {
  if (!input.open || input.trackedSource === null || input.currentSource === input.trackedSource) {
    return false;
  }
  return !input.replayOwnsTransition;
}

function availableStoryRuntimeId(
  controller: VisualLabStoryController,
  kind: 'inter-handover' | 'intra-handover',
): string | null {
  const state = controller.state();
  const story = kind === 'inter-handover'
    ? state.stories.find(candidate => (
        candidate.kind === kind
        && candidate.storyId === state.availability.interHandover.selectedStoryId
      )) ?? state.stories.find(candidate => candidate.kind === kind)
    : state.stories.find(candidate => candidate.kind === kind);
  return story?.availability.status === 'available' ? story.storyId : null;
}

function frameOptionsCommandValue(options: FrameOptionsDraftView): VisualLabFrameOptions {
  return {
    beamLayoutCount: options.beamLayoutCount,
    perSatelliteBeamLayoutCount: options.perSatelliteBeamLayoutCount,
    beamIlluminationMode: options.beamIlluminationMode,
    userPositionOverridesKm: options.userPositionOverridesKm,
    ...(options.representativeUserIndex === null
      ? {}
      : { representativeUserIndex: options.representativeUserIndex }),
  };
}

function acceptedFrameOptions(
  snapshot: LabSnapshot,
): FrameOptionsDraftView | null {
  return snapshot.accepted?.frameOptions ?? snapshot.draft.frameOptions ?? null;
}

function waitForAcceptedFrameOptions(
  session: VisualLabSession,
  expected: FrameOptionsDraftView,
  timeoutMs = 45_000,
): Promise<LabSnapshot> {
  const ready = (candidate: LabSnapshot): boolean => {
    const actual = acceptedFrameOptions(candidate);
    return candidate.phase === 'ready'
      && candidate.accepted?.runReady === true
      && actual !== null
      && actual.beamLayoutCount === expected.beamLayoutCount
      && actual.beamIlluminationMode === expected.beamIlluminationMode
      && JSON.stringify(actual.perSatelliteBeamLayoutCount) === JSON.stringify(expected.perSatelliteBeamLayoutCount)
      && JSON.stringify(actual.userPositionOverridesKm) === JSON.stringify(expected.userPositionOverridesKm)
      && actual.representativeUserIndex === expected.representativeUserIndex;
  };
  const current = session.snapshot();
  if (ready(current)) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    let settled = false;
    const unsubscribe = session.subscribe((candidate) => {
      if (settled || !ready(candidate)) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(candidate);
    });
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error('accepted frame-options publication timed out'));
    }, timeoutMs);
  });
}

async function seekToControllerStep(
  session: VisualLabSession,
  controller: VisualLabStoryController,
  action: 'restart' | 'next',
): Promise<void> {
  const state = action === 'restart' ? controller.restart() : controller.next();
  if (state.activeStepSeekTimeSec !== null) {
    await session.dispatch({ type: 'seek', timeSec: state.activeStepSeekTimeSec });
  }
}

/**
 * Compose one real one-input A/B runtime with one real handover runtime.
 *
 * The hook prebuilds B and validates its story before publishing the replay as
 * prepared. Playback then uses the accepted experiment cache: A baseline → B
 * input → B before/decision/after anchors → A/B comparison. It never writes a
 * result or synthesizes an unavailable handover.
 */
export function useVisualLabGuidedReplay(
  session: VisualLabSession,
  snapshot: LabSnapshot,
  storyController: VisualLabStoryController,
  causalReplay: VisualLabCausalReplay,
): VisualLabGuidedReplay {
  const [state, setState] = useState<VisualLabGuidedReplayState>(INITIAL_STATE);
  const stateRef = useRef(state);
  const sourceRef = useRef<string | null>(visualLabReplaySourceIdentity(snapshot));
  const revisionRef = useRef(0);
  // Non-null only while one of this hook's async commands may publish its
  // accepted A/B frame.  The revision makes an older, cancelled command
  // unable to suppress a later external source change.
  const replaySourceTransitionRef = useRef<number | null>(null);
  // Intra-beam stories require a real beam-hopping schedule.  Remember the
  // user's accepted frame options so the preparation is reversible and never
  // leaves the workspace in a hidden replay-only mode.
  const originalFrameOptionsRef = useRef<FrameOptionsDraftView | null>(null);
  // The causal hook returns a state-bearing object whose identity changes on
  // every render.  Its command callbacks are stable; retain those individual
  // callbacks so the guided phase timer is not cancelled and restarted by
  // the 100 ms presentation-progress updates.
  const openCausalStory = causalReplay.openStory;
  const closeCausalReplay = causalReplay.close;
  const nextCausalReplay = causalReplay.next;
  const restartCausalReplay = causalReplay.restart;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const patch = useCallback((values: Partial<VisualLabGuidedReplayState>): void => {
    // Replay commands can be chained immediately by the launcher, the wall
    // clock, or the manual Next control.  Keep the command-side ref in sync
    // before asking React to render so a following command never reads the
    // preceding busy/open state from a deferred functional updater.
    const next = { ...stateRef.current, ...values };
    stateRef.current = next;
    setState(next);
  }, []);

  const syncStoryController = useCallback((): void => {
    storyController.updateSnapshot(session.snapshot());
  }, [session, storyController]);

  const restoreOriginalFrameOptions = useCallback(async (): Promise<boolean> => {
    const original = originalFrameOptionsRef.current;
    if (original === null) return true;
    const result = await session.dispatch({
      type: 'applyFrameOptions',
      frameOptions: frameOptionsCommandValue(original),
    });
    if (result.status !== 'accepted') return false;
    try {
      await waitForAcceptedFrameOptions(session, original);
      return true;
    } catch {
      return false;
    } finally {
      originalFrameOptionsRef.current = null;
    }
  }, [session]);

  const prepareIntraBeamTrace = useCallback(async (): Promise<void> => {
    const current = session.snapshot();
    const original = acceptedFrameOptions(current);
    if (original === null) throw new Error('The accepted frame options are unavailable.');
    if (originalFrameOptionsRef.current === null) originalFrameOptionsRef.current = original;
    if (original.beamIlluminationMode === 'beam-hopping') return;
    const hopping: FrameOptionsDraftView = Object.freeze({
      ...original,
      beamIlluminationMode: 'beam-hopping',
    });
    const result = await session.dispatch({
      type: 'applyFrameOptions',
      frameOptions: frameOptionsCommandValue(hopping),
    });
    if (result.status !== 'accepted') {
      throw new Error(result.error?.message ?? 'Beam-hopping preparation was rejected.');
    }
    await waitForAcceptedFrameOptions(session, hopping);
  }, [session]);

  const restart = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (!current.open || current.busy) return;
    const revision = ++revisionRef.current;
    replaySourceTransitionRef.current = revision;
    patch({ busy: true, playing: false, error: null });
    try {
      await restartCausalReplay();
      const restartedSnapshot = session.snapshot();
      if (
        !visualLabAcceptedReplayEvidenceReady(restartedSnapshot)
        || restartedSnapshot.comparison.classification !== 'identical'
      ) {
        patch({ busy: false, playing: false, error: 'The accepted baseline could not be restored.' });
        return;
      }
      syncStoryController();
      if (current.baselineStoryRuntimeId !== null) {
        storyController.selectStory(current.baselineStoryRuntimeId);
        await seekToControllerStep(session, storyController, 'restart');
      }
      patch({
        phase: 'baseline',
        busy: false,
        playing: false,
        progress: guidedReplayProgress('baseline'),
      });
    } finally {
      if (replaySourceTransitionRef.current === revision) {
        sourceRef.current = visualLabReplaySourceIdentity(session.snapshot());
        replaySourceTransitionRef.current = null;
      }
    }
  }, [patch, restartCausalReplay, session, storyController, syncStoryController]);

  const close = useCallback(async (): Promise<void> => {
    revisionRef.current += 1;
    patch({ busy: true, playing: false });
    await closeCausalReplay();
    await restoreOriginalFrameOptions();
    const closed = {
      ...INITIAL_STATE,
      storyId: stateRef.current.storyId,
      annotationMode: stateRef.current.annotationMode,
    };
    stateRef.current = closed;
    setState(closed);
  }, [closeCausalReplay, patch, restoreOriginalFrameOptions]);

  const openStory = useCallback(async (
    storyId: VisualLabGuidedReplayId,
    baselineStoryRuntimeId: string,
  ): Promise<void> => {
    const revision = ++revisionRef.current;
    replaySourceTransitionRef.current = revision;
    const annotationMode = stateRef.current.annotationMode;
    const definition = guidedReplayDefinition(storyId);
    patch({
      // Mount the replay surface immediately. Scientific A/B preparation can
      // take several seconds, but it must never look like an unresponsive
      // launcher or leave the full workspace visible underneath a modal.
      open: true,
      storyId,
      phase: 'baseline',
      baselineStoryRuntimeId,
      candidateStoryRuntimeId: null,
      playing: false,
      busy: true,
      prepared: false,
      progress: guidedReplayProgress('baseline'),
      error: null,
    });
    try {
      if (storyId === 'intra-beam-handover') await prepareIntraBeamTrace();
      await openCausalStory(definition.causalStoryId);
      await nextCausalReplay();
      if (revision !== revisionRef.current) return;
      const candidateSnapshot = session.snapshot();
      if (
        !visualLabCausalComparisonReady(candidateSnapshot)
      ) {
        throw new Error('The controlled candidate did not pass the frame comparison gates.');
      }
      syncStoryController();
      const candidateStoryRuntimeId = availableStoryRuntimeId(storyController, definition.storyKind);
      if (candidateStoryRuntimeId === null) {
        throw new Error(definition.storyKind === 'inter-handover'
          ? 'The controlled candidate has no accepted inter-satellite handover story.'
          : 'The controlled candidate has no accepted same-satellite beam-switch story.');
      }
      await nextCausalReplay();
      await restartCausalReplay();
      if (revision !== revisionRef.current) return;
      syncStoryController();
      const baselineAvailable = storyController.state().stories.some(story => (
        story.storyId === baselineStoryRuntimeId && story.availability.status === 'available'
      ));
      if (!baselineAvailable) throw new Error('The baseline handover story is no longer available.');
      storyController.selectStory(baselineStoryRuntimeId);
      await seekToControllerStep(session, storyController, 'restart');
      const ready: VisualLabGuidedReplayState = {
        open: true,
        storyId,
        phase: 'baseline',
        annotationMode,
        baselineStoryRuntimeId,
        candidateStoryRuntimeId,
        playing: true,
        busy: false,
        prepared: true,
        progress: guidedReplayProgress('baseline'),
        error: null,
      };
      sourceRef.current = visualLabReplaySourceIdentity(session.snapshot());
      stateRef.current = ready;
      setState(ready);
    } catch (error) {
      await closeCausalReplay();
      await restoreOriginalFrameOptions();
      if (revision !== revisionRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      patch({ open: false, busy: false, prepared: false, playing: false, error: message });
      throw error;
    } finally {
      if (replaySourceTransitionRef.current === revision) {
        sourceRef.current = visualLabReplaySourceIdentity(session.snapshot());
        replaySourceTransitionRef.current = null;
      }
    }
  }, [closeCausalReplay, nextCausalReplay, openCausalStory, patch, prepareIntraBeamTrace, restoreOriginalFrameOptions, restartCausalReplay, session, storyController, syncStoryController]);

  const advance = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (!current.open || current.busy || current.phase === 'comparison') return;
    const revision = revisionRef.current;
    replaySourceTransitionRef.current = revision;
    patch({ busy: true, error: null });
    try {
      let phase: VisualLabGuidedReplayPhase = current.phase;
      if (current.phase === 'baseline') {
        await nextCausalReplay();
        if (revision !== revisionRef.current) return;
        if (!visualLabCausalComparisonReady(session.snapshot())) {
          throw new Error('The accepted candidate comparison is unavailable.');
        }
        syncStoryController();
        const runtimeId = current.candidateStoryRuntimeId;
        if (runtimeId === null) throw new Error('The prepared candidate handover story is unavailable.');
        const selected = storyController.selectStory(runtimeId);
        const selectedStory = selected.stories.find(story => story.storyId === runtimeId) ?? null;
        if (selectedStory?.availability.status !== 'available') {
          throw new Error('The prepared candidate handover story failed to rebind.');
        }
        await seekToControllerStep(session, storyController, 'restart');
        phase = 'intervention';
      } else if (current.phase === 'intervention') {
        phase = 'before';
      } else if (current.phase === 'before') {
        await seekToControllerStep(session, storyController, 'next');
        phase = 'decision';
      } else if (current.phase === 'decision') {
        await seekToControllerStep(session, storyController, 'next');
        phase = 'after';
      } else if (current.phase === 'after') {
        await nextCausalReplay();
        if (!visualLabCausalComparisonReady(session.snapshot())) {
          throw new Error('The accepted A/B comparison is unavailable.');
        }
        phase = 'comparison';
      } else if ((current.phase as string) === 'return') {
        // Compatibility with one stale pre-refresh closure that briefly
        // exposed `return` as a separate phase.  Finish it through the same
        // accepted comparison transition instead of looping or throwing.
        await nextCausalReplay();
        phase = 'comparison';
      }
      if (revision !== revisionRef.current) return;
      patch({
        phase,
        busy: false,
        progress: guidedReplayProgress(phase),
        playing: phase === 'comparison' ? false : current.playing,
      });
    } catch (error) {
      if (revision !== revisionRef.current) return;
      patch({
        busy: false,
        playing: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (replaySourceTransitionRef.current === revision) {
        sourceRef.current = visualLabReplaySourceIdentity(session.snapshot());
        replaySourceTransitionRef.current = null;
      }
    }
  }, [nextCausalReplay, patch, session, storyController, syncStoryController]);

  const next = useCallback(async (): Promise<void> => {
    await advance();
  }, [advance]);

  const togglePlay = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (!current.open || current.busy) return;
    if (current.playing) {
      revisionRef.current += 1;
      patch({ playing: false });
      return;
    }
    if (current.phase === 'comparison') await restart();
    revisionRef.current += 1;
    patch({ playing: true });
  }, [patch, restart]);

  const setAnnotationMode = useCallback((mode: VisualLabGuidedReplayAnnotationMode): void => {
    patch({ annotationMode: mode });
  }, [patch]);

  useEffect(() => {
    if (!state.open || !state.playing || state.busy || state.phase === 'comparison') return undefined;
    const revision = revisionRef.current;
    const delayMs = guidedReplayPhaseTiming(state.phase).durationMs;
    const timer = window.setTimeout(() => {
      if (revision === revisionRef.current) void advance();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [advance, state.busy, state.open, state.phase, state.playing]);

  /**
   * Publish a wall-clock progress readout while the semantic phase remains
   * stable. The interval is presentation-only: it never seeks or derives a
   * frame, and it is cancelled whenever playback is paused or restarted.
   */
  useEffect(() => {
    if (!state.open || !state.playing || state.busy || state.phase === 'comparison') return undefined;
    const startedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
    const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());
    const update = (): void => {
      patch({ progress: guidedReplayProgress(state.phase, Math.max(0, now() - startedAt)) });
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [patch, state.busy, state.open, state.phase, state.playing]);

  const currentSource = visualLabReplaySourceIdentity(snapshot);
  useEffect(() => {
    const replayOwnsTransition = replaySourceTransitionRef.current === revisionRef.current;
    if (!guidedReplayShouldCloseForSourceChange({
      open: state.open,
      trackedSource: sourceRef.current,
      currentSource,
      replayOwnsTransition,
    })) {
      // Keep the tracked identity current while the replay's own accepted
      // publication is in flight.  The command's finally block clears the
      // acknowledgement window after all of its seeks have settled.
      if (replayOwnsTransition && currentSource !== sourceRef.current) {
        sourceRef.current = currentSource;
      }
      return;
    }
    revisionRef.current += 1;
    replaySourceTransitionRef.current = null;
    const closed = {
      ...INITIAL_STATE,
      storyId: state.storyId,
      annotationMode: state.annotationMode,
    };
    stateRef.current = closed;
    setState(closed);
  }, [currentSource, state.annotationMode, state.open, state.storyId]);

  return {
    ...state,
    openStory,
    close,
    next,
    restart,
    togglePlay,
    setAnnotationMode,
  };
}
