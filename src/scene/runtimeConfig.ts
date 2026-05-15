import type {
  BeamDensity,
  CinematicMode,
  RuntimeConfig,
  RuntimeEffectsEnabled,
  RuntimeViewport,
} from './types';
import type { UiMode } from '../ui/uiMode';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type RuntimeVisualSettings = Pick<
  RuntimeConfig,
  'beamDensity' | 'effectsEnabled' | 'cinematicMode' | 'reducedMotion'
>;

interface MediaQueryListLike {
  matches: boolean;
  addEventListener?: (type: 'change', listener: (event: MediaQueryListEventLike) => void) => void;
  removeEventListener?: (type: 'change', listener: (event: MediaQueryListEventLike) => void) => void;
  addListener?: (listener: (event: MediaQueryListEventLike) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEventLike) => void) => void;
}

interface MediaQueryListEventLike {
  matches: boolean;
}

interface ReducedMotionWindowLike {
  matchMedia: (query: string) => MediaQueryListLike;
}

interface ViewportWindowLike {
  innerWidth: number;
  innerHeight: number;
  addEventListener?: (type: 'resize', listener: () => void) => void;
  removeEventListener?: (type: 'resize', listener: () => void) => void;
}

function allEffectsEnabled(value: boolean): RuntimeEffectsEnabled {
  return {
    spineParticles: value,
    orbitTrail: value,
    servingRipple: value,
    pendingRipple: value,
  };
}

export function deriveBeamDensity(uiMode: UiMode): BeamDensity {
  return uiMode === 'presentation' ? 'event-plus-1' : 'all';
}

export function resolveRuntimeCinematicMode(
  _uiMode: UiMode,
  requestedMode: CinematicMode,
): CinematicMode {
  return requestedMode;
}

export function deriveRuntimeVisualSettings(
  uiMode: UiMode,
  reducedMotion: boolean,
): RuntimeVisualSettings {
  const presentationEffects = uiMode === 'presentation';

  return {
    beamDensity: deriveBeamDensity(uiMode),
    effectsEnabled: reducedMotion ? allEffectsEnabled(false) : allEffectsEnabled(presentationEffects),
    cinematicMode: resolveRuntimeCinematicMode(uiMode, 'off'),
    reducedMotion,
  };
}

export function readPrefersReducedMotion(
  mediaWindow: ReducedMotionWindowLike | undefined = typeof window === 'undefined' ? undefined : window,
): boolean {
  if (!mediaWindow) return false;
  return mediaWindow.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function subscribeToReducedMotionPreference(
  onChange: (reducedMotion: boolean) => void,
  mediaWindow: ReducedMotionWindowLike | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  if (!mediaWindow) return () => {};

  const mediaQuery = mediaWindow.matchMedia(REDUCED_MOTION_QUERY);
  const listener = (event: MediaQueryListEventLike) => {
    onChange(event.matches);
  };

  onChange(mediaQuery.matches);

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener?.('change', listener);
  }

  mediaQuery.addListener?.(listener);
  return () => mediaQuery.removeListener?.(listener);
}

export function readRuntimeViewport(
  viewportWindow: ViewportWindowLike | undefined = typeof window === 'undefined' ? undefined : window,
): RuntimeViewport {
  return {
    width: viewportWindow?.innerWidth ?? 1440,
    height: viewportWindow?.innerHeight ?? 900,
  };
}

export function subscribeToRuntimeViewport(
  onChange: (viewport: RuntimeViewport) => void,
  viewportWindow: ViewportWindowLike | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  if (!viewportWindow) return () => {};

  const listener = () => {
    onChange(readRuntimeViewport(viewportWindow));
  };

  listener();
  viewportWindow.addEventListener?.('resize', listener);
  return () => viewportWindow.removeEventListener?.('resize', listener);
}
