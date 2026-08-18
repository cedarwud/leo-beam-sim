import { useCallback, useEffect, useRef, useState } from 'react';

import {
  VISUAL_LAB_INPUT_DEFINITIONS,
  type VisualLabInputKey,
} from '../../visualLab/experiment';
import type {
  LabSnapshot,
  VisualLabSession,
} from '../../visualLab/session';
import type { VisualLabCausalCameraCue } from './VisualLabScene';
import { visualLabReplaySourceIdentity } from './visualLabReplaySourceIdentity';

export type VisualLabCausalStoryId = 'beamwidth' | 'power-cap';
export type VisualLabCausalReplayPhase = 'baseline' | 'intervention' | 'comparison';

export interface VisualLabCausalReplayState {
  readonly open: boolean;
  readonly storyId: VisualLabCausalStoryId;
  readonly phase: VisualLabCausalReplayPhase;
  readonly baselineValue: number | null;
  readonly probeValue: number | null;
  readonly playing: boolean;
  readonly busy: boolean;
  readonly error: string | null;
}

export interface VisualLabCausalReplay extends VisualLabCausalReplayState {
  readonly cameraCue: VisualLabCausalCameraCue | null;
  readonly openStory: (storyId?: VisualLabCausalStoryId) => Promise<void>;
  readonly close: () => Promise<void>;
  readonly selectStory: (storyId: VisualLabCausalStoryId) => Promise<void>;
  readonly next: () => Promise<void>;
  readonly previous: () => Promise<void>;
  readonly restart: () => Promise<void>;
  readonly togglePlay: () => Promise<void>;
}

/** Presentation pacing for the compact A/B replay; computation remains async. */
export const VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS = Object.freeze({
  baseline: 5_000,
  intervention: 5_000,
} as const);

export const VISUAL_LAB_CAUSAL_REPLAY_TOTAL_DURATION_MS =
  VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS.baseline
  + VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS.intervention;

const STORY_PARAMETER: Readonly<Record<VisualLabCausalStoryId, VisualLabInputKey>> = Object.freeze({
  beamwidth: 'theta3dbRad',
  'power-cap': 'beamPowerCapW',
});

const INITIAL_STATE: VisualLabCausalReplayState = Object.freeze({
  open: false,
  storyId: 'beamwidth',
  phase: 'baseline',
  baselineValue: null,
  probeValue: null,
  playing: false,
  busy: false,
  error: null,
});

function parameterKey(storyId: VisualLabCausalStoryId): VisualLabInputKey {
  return STORY_PARAMETER[storyId];
}

export function visualLabCausalProbeValue(storyId: VisualLabCausalStoryId, canonicalValue: number): number {
  const definition = VISUAL_LAB_INPUT_DEFINITIONS.find(item => item.key === parameterKey(storyId));
  if (definition === undefined) return canonicalValue;
  const currentDisplay = definition.toDisplayValue(canonicalValue);
  const targetDisplay = storyId === 'beamwidth'
    // The default 7-beam archived-TLE scene keeps the same representative
    // serving/candidate link through a 0.3 degree intervention while still
    // moving power, throughput, and EE materially.  A 3 degree jump changes
    // the representative UE/beam and correctly fails the matched-frame gate.
    ? currentDisplay <= definition.max - .3 ? currentDisplay + .3 : currentDisplay - .3
    : currentDisplay > .4 ? .35 : Math.min(definition.max, Math.max(.8, currentDisplay * 2));
  return definition.fromDisplayValue(Math.min(definition.max, Math.max(definition.min, targetDisplay)));
}

function sameParameterValue(left: number | undefined, right: number): boolean {
  if (left === undefined || !Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) <= Math.max(1e-10, Math.abs(right) * 1e-9);
}

function acceptedParameter(snapshot: LabSnapshot, key: VisualLabInputKey): number | undefined {
  return snapshot.accepted?.parameters?.[key];
}

/**
 * A replay may only read a complete, source-backed accepted run.  This gate
 * is intentionally stricter than `phase === 'ready'`: a ready-looking
 * projection with mock flags, missing timeline identity, or a non-SGP4 source
 * is not a launchable scientific replay.
 */
export function visualLabAcceptedReplayEvidenceReady(
  snapshot: Pick<LabSnapshot, 'phase' | 'accepted'>,
): boolean {
  const accepted = snapshot.accepted;
  const timeline = accepted?.timeline ?? null;
  if (
    snapshot.phase !== 'ready'
    || accepted?.runReady !== true
    || accepted.canonical.isMock !== false
    || timeline === null
    || timeline.isMock !== false
    || timeline.availability !== 'available'
    || accepted.identity.sourceKind !== 'ARCHIVED_TLE'
    || accepted.identity.propagationModel !== 'SGP4'
    || accepted.analysisRunId === null
    || accepted.geometryRunId === null
    || accepted.analysisRunId !== timeline.analysisRunId
    || accepted.geometryRunId !== timeline.geometryRunId
  ) return false;
  return true;
}

function finiteMetricPair(
  metric: { readonly baseline: number | null; readonly candidate: number | null },
): boolean {
  return Number.isFinite(metric.baseline) && Number.isFinite(metric.candidate);
}

/**
 * The A/B replay is launchable only after the session has published the same
 * accepted source and a causal comparison containing the values the story
 * promises to show.  Missing throughput, power, or EE is a blocked replay,
 * never a zero-filled or frame-substituted result.
 */
export function visualLabCausalComparisonReady(
  snapshot: Pick<LabSnapshot, 'phase' | 'accepted' | 'comparison'>,
): boolean {
  if (!visualLabAcceptedReplayEvidenceReady(snapshot)) return false;
  const comparison = snapshot.comparison;
  return comparison.availability === 'available'
    && comparison.frame.availability === 'available'
    && comparison.classification === 'causal'
    && comparison.baseline !== null
    && comparison.candidate !== null
    && finiteMetricPair(comparison.frame.deltas.totalThroughputBps)
    && finiteMetricPair(comparison.frame.deltas.systemPowerW)
    && finiteMetricPair(comparison.frame.deltas.instantaneousEeBitsPerJ);
}

function waitForAcceptedParameter(
  session: VisualLabSession,
  key: VisualLabInputKey,
  value: number,
  timeoutMs = 45_000,
): Promise<LabSnapshot> {
  const ready = (candidate: LabSnapshot): boolean => (
    candidate.phase === 'ready'
    && candidate.accepted?.runReady === true
    && sameParameterValue(acceptedParameter(candidate, key), value)
  );
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
      reject(new Error(`accepted ${key} publication timed out`));
    }, timeoutMs);
  });
}

/**
 * Route-level orchestration for a one-variable replay.
 *
 * The hook never computes metrics. It stores the original canonical input,
 * delegates A/B evidence to VisualLabSession, and restores that one input on
 * restart/close so the replay cannot silently leave a probe applied.
 */
export function useVisualLabCausalReplay(
  session: VisualLabSession,
  snapshot: LabSnapshot,
): VisualLabCausalReplay {
  const [state, setState] = useState<VisualLabCausalReplayState>(INITIAL_STATE);
  const stateRef = useRef(state);
  const sourceRef = useRef<string | null>(visualLabReplaySourceIdentity(snapshot));
  const playRevisionRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const patchState = useCallback((patch: Partial<VisualLabCausalReplayState>): void => {
    // Async replay commands are intentionally chained (open → B → compare →
    // restore A).  React may defer a functional updater, so the mutable ref is
    // the synchronous command-state authority and the render follows it.
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
  }, []);

  const restoreCurrentBaseline = useCallback(async (clear = false): Promise<boolean> => {
    const current = stateRef.current;
    if (!current.open || current.baselineValue === null) return true;
    const result = await session.dispatch({
      type: 'editCanonicalParameter',
      key: parameterKey(current.storyId),
      value: current.baselineValue,
    });
    if (result.status === 'accepted') {
      try {
        await waitForAcceptedParameter(
          session,
          parameterKey(current.storyId),
          current.baselineValue,
        );
      } catch {
        if (clear) await session.dispatch({ type: 'clearComparison' });
        return false;
      }
    }
    if (clear) await session.dispatch({ type: 'clearComparison' });
    return result.status === 'accepted';
  }, [session]);

  const openStory = useCallback(async (storyId: VisualLabCausalStoryId = 'beamwidth'): Promise<void> => {
    playRevisionRef.current += 1;
    patchState({ busy: true, playing: false, error: null });
    const restored = await restoreCurrentBaseline(true);
    if (!restored) {
      const closed = { ...INITIAL_STATE, storyId, error: 'baseline-restore-unavailable' };
      stateRef.current = closed;
      setState(closed);
      throw new Error('The accepted baseline could not be restored.');
    }
    const currentSnapshot = session.snapshot();
    const key = parameterKey(storyId);
    const baselineValue = acceptedParameter(currentSnapshot, key) ?? currentSnapshot.draft.parameters[key];
    if (!Number.isFinite(baselineValue) || !visualLabAcceptedReplayEvidenceReady(currentSnapshot)) {
      const closed = { ...INITIAL_STATE, storyId, error: 'accepted-source-unavailable' };
      stateRef.current = closed;
      setState(closed);
      throw new Error('A complete accepted archived-TLE/SGP4 baseline is required.');
    }
    const nextState: VisualLabCausalReplayState = {
      open: true,
      storyId,
      phase: 'baseline',
      baselineValue,
      probeValue: visualLabCausalProbeValue(storyId, baselineValue),
      playing: false,
      busy: true,
      error: null,
    };
    stateRef.current = nextState;
    setState(nextState);
    const result = await session.dispatch({ type: 'saveComparisonBaseline' });
    if (result.status !== 'accepted') {
      const closed = {
        ...INITIAL_STATE,
        storyId,
        error: result.error?.code ?? 'baseline-unavailable',
      };
      stateRef.current = closed;
      setState(closed);
      throw new Error(result.error?.message ?? 'The accepted baseline could not be registered.');
    }
    // `openStory()` is immediately chained into `next()` by the guided
    // replay. Publish the ref synchronously instead of relying on React to run
    // a queued functional updater before that next async step reads it.
    const openedState: VisualLabCausalReplayState = {
      ...nextState,
      busy: false,
      error: null,
    };
    stateRef.current = openedState;
    setState(openedState);
    sourceRef.current = visualLabReplaySourceIdentity(result.snapshot);
  }, [restoreCurrentBaseline, session]);

  const close = useCallback(async (): Promise<void> => {
    playRevisionRef.current += 1;
    patchState({ busy: true, playing: false });
    const restored = await restoreCurrentBaseline(true);
    const closed = {
      ...INITIAL_STATE,
      storyId: stateRef.current.storyId,
      error: restored ? null : 'restore-unavailable',
    };
    stateRef.current = closed;
    setState(closed);
  }, [patchState, restoreCurrentBaseline]);

  const selectStory = useCallback(async (storyId: VisualLabCausalStoryId): Promise<void> => {
    if (stateRef.current.storyId === storyId && stateRef.current.open) return;
    try {
      await openStory(storyId);
    } catch (error) {
      // The rail uses a fire-and-forget callback for story selection.  Keep a
      // rejected source gate visible in state instead of creating an
      // unhandled promise rejection; launchReplay still receives the throw
      // from openStory directly and can return to its entry shelf.
      if (stateRef.current.error === null) {
        patchState({ busy: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }, [openStory, patchState]);

  const next = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (!current.open || current.busy || current.phase === 'comparison') {
      if (current.phase === 'comparison') patchState({ playing: false });
      return;
    }
    if (current.phase === 'intervention') {
      patchState({ phase: 'comparison', playing: current.playing });
      return;
    }
    if (current.probeValue === null) return;
    patchState({ busy: true, error: null });
    const result = await session.dispatch({
      type: 'editCanonicalParameter',
      key: parameterKey(current.storyId),
      value: current.probeValue,
    });
    let published = false;
    let publishedSnapshot: LabSnapshot | null = null;
    if (result.status === 'accepted') {
      try {
        publishedSnapshot = await waitForAcceptedParameter(session, parameterKey(current.storyId), current.probeValue);
        published = visualLabCausalComparisonReady(publishedSnapshot);
      } catch {
        published = false;
      }
    }
    patchState({
      busy: false,
      phase: published ? 'intervention' : current.phase,
      error: published
        ? null
        : result.status === 'accepted'
          ? publishedSnapshot === null
            ? 'probe-publication-timeout'
            : 'probe-comparison-unavailable'
          : result.error?.code ?? 'probe-unavailable',
      playing: published ? current.playing : false,
    });
  }, [patchState, session]);

  const previous = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    playRevisionRef.current += 1;
    if (!current.open || current.busy || current.phase === 'baseline') return;
    if (current.phase === 'comparison') {
      patchState({ phase: 'intervention', playing: false });
      return;
    }
    patchState({ busy: true, playing: false });
    const restored = await restoreCurrentBaseline(false);
    patchState({
      busy: false,
      phase: restored ? 'baseline' : current.phase,
      error: restored ? null : 'restore-unavailable',
    });
  }, [patchState, restoreCurrentBaseline]);

  const restart = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    playRevisionRef.current += 1;
    if (!current.open || current.busy) return;
    patchState({ busy: true, playing: false, error: null });
    const restored = await restoreCurrentBaseline(false);
    patchState({
      busy: false,
      phase: restored ? 'baseline' : current.phase,
      error: restored ? null : 'restore-unavailable',
    });
  }, [patchState, restoreCurrentBaseline]);

  const togglePlay = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (!current.open || current.busy) return;
    if (current.playing) {
      playRevisionRef.current += 1;
      patchState({ playing: false });
      return;
    }
    if (current.phase === 'comparison') await restart();
    patchState({ playing: true });
  }, [patchState, restart]);

  useEffect(() => {
    if (!state.open || !state.playing || state.busy) return undefined;
    if (state.phase === 'comparison') {
      patchState({ playing: false });
      return undefined;
    }
    const revision = playRevisionRef.current;
    const timer = window.setTimeout(() => {
      if (revision === playRevisionRef.current) void next();
    }, state.phase === 'baseline'
      ? VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS.baseline
      : VISUAL_LAB_CAUSAL_REPLAY_PHASE_DURATION_MS.intervention);
    return () => window.clearTimeout(timer);
  }, [next, patchState, state.busy, state.open, state.phase, state.playing]);

  const currentSource = visualLabReplaySourceIdentity(snapshot);
  useEffect(() => {
    if (!state.open || sourceRef.current === null || currentSource === sourceRef.current) return;
    playRevisionRef.current += 1;
    const closed = { ...INITIAL_STATE, storyId: state.storyId };
    stateRef.current = closed;
    setState(closed);
    void session.dispatch({ type: 'clearComparison' });
  }, [currentSource, session, state.open, state.storyId]);

  return {
    ...state,
    cameraCue: state.open ? {
      storyId: state.storyId,
      phase: state.phase,
      revision: `${state.storyId}:${state.phase}`,
    } : null,
    openStory,
    close,
    selectStory,
    next,
    previous,
    restart,
    togglePlay,
  };
}
