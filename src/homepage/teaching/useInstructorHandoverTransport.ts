import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TeachingHandoverKind } from './handoverTeachingScript';
import {
  advanceInstructorHandoverTransport,
  closeInstructorHandoverTransport,
  createInstructorHandoverTransportState,
  openInstructorHandoverTransport,
  resolveInstructorHandoverTransportSnapshot,
  restartInstructorHandoverTransport,
  seekInstructorHandoverTransport,
  setInstructorHandoverPaused,
  setInstructorHandoverSpeed,
  type InstructorHandoverSpeed,
  type InstructorHandoverTransportSnapshot,
} from './instructorHandoverTransport';

export interface InstructorHandoverTransportController {
  readonly snapshot: InstructorHandoverTransportSnapshot | null;
  readonly open: (kind: TeachingHandoverKind) => void;
  readonly close: () => void;
  readonly restart: () => void;
  readonly seek: (sourceTimeSec: number) => void;
  readonly setPaused: (paused: boolean) => void;
  readonly setSpeed: (speed: InstructorHandoverSpeed) => void;
}

export function useInstructorHandoverTransport(): InstructorHandoverTransportController {
  const [state, setState] = useState(createInstructorHandoverTransportState);
  const lastTickMsRef = useRef<number | null>(null);
  const snapshot = useMemo(
    () => resolveInstructorHandoverTransportSnapshot(state),
    [state],
  );

  useEffect(() => {
    if (state.status !== 'playing') {
      lastTickMsRef.current = null;
      return;
    }
    let frameId = 0;
    const tick = (nowMs: number): void => {
      const lastTickMs = lastTickMsRef.current;
      lastTickMsRef.current = nowMs;
      if (lastTickMs !== null) {
        const wallDeltaSec = Math.min(0.25, Math.max(0, (nowMs - lastTickMs) / 1000));
        setState(current => advanceInstructorHandoverTransport(current, wallDeltaSec));
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [state.status]);

  const open = useCallback((kind: TeachingHandoverKind) => {
    lastTickMsRef.current = null;
    setState(current => openInstructorHandoverTransport(current, kind));
  }, []);
  const close = useCallback(() => {
    lastTickMsRef.current = null;
    setState(closeInstructorHandoverTransport);
  }, []);
  const restart = useCallback(() => {
    lastTickMsRef.current = null;
    setState(restartInstructorHandoverTransport);
  }, []);
  const seek = useCallback((sourceTimeSec: number) => {
    lastTickMsRef.current = null;
    setState(current => seekInstructorHandoverTransport(current, sourceTimeSec));
  }, []);
  const setPaused = useCallback((paused: boolean) => {
    lastTickMsRef.current = null;
    setState(current => setInstructorHandoverPaused(current, paused));
  }, []);
  const setSpeed = useCallback((speed: InstructorHandoverSpeed) => {
    lastTickMsRef.current = null;
    setState(current => setInstructorHandoverSpeed(current, speed));
  }, []);

  return useMemo(() => ({
    snapshot,
    open,
    close,
    restart,
    seek,
    setPaused,
    setSpeed,
  }), [snapshot, open, close, restart, seek, setPaused, setSpeed]);
}
