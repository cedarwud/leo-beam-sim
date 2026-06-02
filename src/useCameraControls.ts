import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CameraPreset,
  CinematicMode,
  DirectorFocusFraming,
  DirectorFocusKind,
  DirectorFocusPhase,
  RuntimeConfig,
} from './scene/types';

type UserCinematicMode = Exclude<CinematicMode, 'director'>;

// Must match CAMERA_TWEEN_DURATION_MS in src/scene/MainScene.tsx so the speed/cinematic
// window aligns with the camera settle.
const DIRECTOR_TWEEN_DURATION_MS = 600;

export interface CameraControls {
  readonly cinematicMode: CinematicMode;
  readonly cameraCommand: RuntimeConfig['cameraCommand'];
  readonly directorPhase: DirectorFocusPhase;
  readonly directorFocusActive: boolean;
  readonly directorFocusCommand: RuntimeConfig['directorFocusCommand'];
  readonly selectCameraPreset: (preset: CameraPreset) => void;
  readonly setCinematicMode: (mode: CinematicMode) => void;
  readonly requestIntraFocus: (framing?: DirectorFocusFraming) => void;
  readonly requestInterFocus: (framing?: DirectorFocusFraming) => void;
  readonly exitDirectorFocus: () => void;
}

export function useCameraControls(): CameraControls {
  const [userCinematicMode, setUserCinematicMode] = useState<UserCinematicMode>('off');
  const [cameraCommand, setCameraCommand] = useState<RuntimeConfig['cameraCommand']>();
  const [directorPhase, setDirectorPhase] = useState<DirectorFocusPhase>('idle');
  const [directorFocusCommand, setDirectorFocusCommand] =
    useState<RuntimeConfig['directorFocusCommand']>();
  const directorKindRef = useRef<DirectorFocusKind>('intra');
  const sequenceRef = useRef(0);

  const nextIssuedAtMs = useCallback(() => {
    sequenceRef.current += 1;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    return nowMs + sequenceRef.current / 1000;
  }, []);

  const selectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraCommand({
      preset,
      issuedAtMs: nextIssuedAtMs(),
    });
  }, [nextIssuedAtMs]);

  const setCinematicMode = useCallback((mode: CinematicMode) => {
    if (mode === 'director') return;
    setUserCinematicMode(mode);
  }, []);

  const requestFocus = useCallback((kind: DirectorFocusKind, framing?: DirectorFocusFraming) => {
    if (directorPhase !== 'idle' && directorPhase !== 'focused') return;
    directorKindRef.current = kind;
    setDirectorPhase('acquiring');
    setDirectorFocusCommand({
      kind,
      phase: 'acquiring',
      issuedAtMs: nextIssuedAtMs(),
      framing,
    });
  }, [directorPhase, nextIssuedAtMs]);

  const requestIntraFocus = useCallback((framing?: DirectorFocusFraming) => {
    requestFocus('intra', framing);
  }, [requestFocus]);

  const requestInterFocus = useCallback((framing?: DirectorFocusFraming) => {
    requestFocus('inter', framing);
  }, [requestFocus]);

  const exitDirectorFocus = useCallback(() => {
    if (directorPhase !== 'acquiring' && directorPhase !== 'focused') return;
    setDirectorPhase('restoring');
    setDirectorFocusCommand({
      kind: directorKindRef.current,
      phase: 'restoring',
      issuedAtMs: nextIssuedAtMs(),
    });
  }, [directorPhase, nextIssuedAtMs]);

  useEffect(() => {
    if (directorPhase !== 'acquiring' && directorPhase !== 'restoring') return undefined;
    const timeoutId = setTimeout(() => {
      setDirectorPhase(directorPhase === 'acquiring' ? 'focused' : 'idle');
    }, DIRECTOR_TWEEN_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [directorPhase]);

  const cinematicMode: CinematicMode = directorPhase !== 'idle' ? 'director' : userCinematicMode;
  // Slow-mo stays locked for the entire director cycle, INCLUDING the `restoring`
  // camera-pullback glide, so visual slow-mo and decision-cycle advance never desync
  // (SDD §5.3 dt-must-scale-with-speed lockstep). Speed returns to normal only at `idle`.
  const directorFocusActive = directorPhase !== 'idle';

  return useMemo(
    () => ({
      cinematicMode,
      cameraCommand,
      directorPhase,
      directorFocusActive,
      directorFocusCommand,
      selectCameraPreset,
      setCinematicMode,
      requestIntraFocus,
      requestInterFocus,
      exitDirectorFocus,
    }),
    [
      cinematicMode,
      cameraCommand,
      directorPhase,
      directorFocusActive,
      directorFocusCommand,
      selectCameraPreset,
      setCinematicMode,
      requestIntraFocus,
      requestInterFocus,
      exitDirectorFocus,
    ],
  );
}
