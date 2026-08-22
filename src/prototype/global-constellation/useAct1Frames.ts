import { useEffect, useMemo, useRef, useState } from 'react';

import { classifySixActsShell, type SixActsShellId } from '../../course/sixActs/act1Shells';
import type { SimulatorConstellation } from '../../simulator/types';
import { ACT1_FRAME_SPAN_SEC, ACT1_FRAME_STEP_SEC } from './act1FrameSchedule';
import { act1ArchiveUrl } from './act1TleCatalog';
import type {
  Act1FrameRequest,
  Act1WorkerMessage,
} from './act1Frames.worker';

export interface Act1Frame {
  readonly positions: Float32Array;
  readonly visible: Uint8Array;
  readonly visibleCount: number;
}

export interface Act1FrameState {
  /** Satellite order for every frame and for the shell array. */
  readonly satelliteIds: readonly string[];
  readonly satelliteNames: readonly string[];
  readonly shells: readonly SixActsShellId[];
  readonly inclinationsDeg: Float64Array | null;
  readonly frames: ReadonlyMap<number, Act1Frame>;
  /** Frames arrive centre-outward, so this is the contiguous ready span. */
  readonly readySpanSec: number;
  readonly frameCount: number;
  readonly status: 'idle' | 'loading' | 'streaming' | 'ready' | 'error';
  readonly error: string | null;
}

const EMPTY: Act1FrameState = Object.freeze({
  satelliteIds: [],
  satelliteNames: [],
  shells: [],
  inclinationsDeg: null,
  frames: new Map<number, Act1Frame>(),
  readySpanSec: 0,
  frameCount: 0,
  status: 'idle',
  error: null,
});

/**
 * Streams SGP4 frames for one constellation.
 *
 * `readySpanSec` is the contiguous range around the base instant, so the
 * timeline can widen as frames land instead of gating on the last one. The
 * lecture can start scrubbing seconds in.
 */
export { ACT1_FRAME_SPAN_SEC, ACT1_FRAME_STEP_SEC };

export function useAct1Frames(
  constellation: SimulatorConstellation,
  baseInstantUtc: string | null,
  minimumElevationDeg: number,
): Act1FrameState {
  const [state, setState] = useState<Act1FrameState>(EMPTY);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (baseInstantUtc === null) return undefined;
    setState({ ...EMPTY, status: 'loading' });

    const worker = new Worker(new URL('./act1Frames.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    const frames = new Map<number, Act1Frame>();
    let readySpanSec = 0;

    worker.onmessage = (event: MessageEvent<Act1WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'catalog') {
        setState(previous => ({
          ...previous,
          satelliteIds: message.satelliteIds,
          satelliteNames: message.satelliteNames,
          shells: Array.from(message.inclinationsDeg, classifySixActsShell),
          inclinationsDeg: message.inclinationsDeg,
          frameCount: message.frameCount,
          status: 'streaming',
        }));
        return;
      }
      if (message.type === 'frame') {
        frames.set(message.offsetSec, {
          positions: message.positions,
          visible: message.visible,
          visibleCount: message.visibleCount,
        });
        while (
          frames.has(readySpanSec + ACT1_FRAME_STEP_SEC)
          && frames.has(-(readySpanSec + ACT1_FRAME_STEP_SEC))
        ) {
          readySpanSec += ACT1_FRAME_STEP_SEC;
        }
        setState(previous => ({ ...previous, frames: new Map(frames), readySpanSec }));
        return;
      }
      if (message.type === 'done') {
        setState(previous => ({ ...previous, status: 'ready' }));
        return;
      }
      setState(previous => ({ ...previous, status: 'error', error: message.message }));
    };

    const request: Act1FrameRequest = {
      archiveUrl: act1ArchiveUrl(constellation),
      baseInstantUtc,
      spanSec: ACT1_FRAME_SPAN_SEC,
      stepSec: ACT1_FRAME_STEP_SEC,
      minimumElevationDeg,
    };
    worker.postMessage(request);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [constellation, baseInstantUtc, minimumElevationDeg]);

  return state;
}

/** The nearest computed frame at or before an offset, or null while it is pending. */
export function useAct1FrameAt(state: Act1FrameState, offsetSec: number): Act1Frame | null {
  return useMemo(() => {
    const snapped = Math.round(offsetSec / ACT1_FRAME_STEP_SEC) * ACT1_FRAME_STEP_SEC;
    return state.frames.get(snapped) ?? null;
  }, [state.frames, offsetSec]);
}
