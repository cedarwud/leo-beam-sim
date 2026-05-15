import { useCallback, useMemo, useRef, useState } from 'react';
import type { CameraPreset, CinematicMode, RuntimeConfig } from './scene/types';

export interface CameraControls {
  readonly cinematicMode: CinematicMode;
  readonly cameraCommand: RuntimeConfig['cameraCommand'];
  readonly selectCameraPreset: (preset: CameraPreset) => void;
  readonly setCinematicMode: (mode: CinematicMode) => void;
}

export function useCameraControls(): CameraControls {
  const [cinematicMode, setCinematicMode] = useState<CinematicMode>('off');
  const [cameraCommand, setCameraCommand] = useState<RuntimeConfig['cameraCommand']>();
  const sequenceRef = useRef(0);

  const selectCameraPreset = useCallback((preset: CameraPreset) => {
    sequenceRef.current += 1;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    setCameraCommand({
      preset,
      issuedAtMs: nowMs + sequenceRef.current / 1000,
    });
  }, []);

  return useMemo(
    () => ({
      cinematicMode,
      cameraCommand,
      selectCameraPreset,
      setCinematicMode,
    }),
    [cinematicMode, cameraCommand, selectCameraPreset],
  );
}
