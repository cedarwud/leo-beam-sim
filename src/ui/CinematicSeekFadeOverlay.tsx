import { useCallback, useEffect, useRef, useState } from 'react';

export interface CinematicSeekFadeOverlayProps {
  /** Bumped to a new value each time a cinematic seek should be masked. null = idle. */
  readonly pulseKey: number | null;
  readonly reducedMotion: boolean;
  /** Keep the seek callback while suppressing the black veil for inter presentation. */
  readonly suppressVisual?: boolean;
  /** Fired ONCE at peak dim (or immediately under reduced motion) -- perform the seek here. */
  readonly onPeak: () => void;
}

export const FADE_OUT_MS = 150;
export const FADE_IN_MS = 150;
export const PEAK_OPACITY = 0.6;

type FadePhase = 'idle' | 'dimming' | 'clearing';

export function CinematicSeekFadeOverlay({
  pulseKey,
  reducedMotion,
  suppressVisual = false,
  onPeak,
}: CinematicSeekFadeOverlayProps) {
  const [opacity, setOpacity] = useState(0);
  const [phase, setPhase] = useState<FadePhase>('idle');
  const lastHandledPulseKeyRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (pulseKey === null || pulseKey === lastHandledPulseKeyRef.current) return;

    clearTimers();
    lastHandledPulseKeyRef.current = pulseKey;
    generationRef.current += 1;
    const generation = generationRef.current;

    const schedule = (callback: () => void, delayMs: number) => {
      const timer = window.setTimeout(() => {
        timersRef.current = timersRef.current.filter(candidate => candidate !== timer);
        if (generationRef.current !== generation) return;
        callback();
      }, delayMs);
      timersRef.current.push(timer);
    };

    setOpacity(0);
    setPhase('idle');

    if (reducedMotion) {
      schedule(onPeak, 0);
      return;
    }

    setPhase('dimming');
    schedule(() => setOpacity(PEAK_OPACITY), 0);
    schedule(() => {
      onPeak();
      setPhase('clearing');
      setOpacity(0);
    }, FADE_OUT_MS);
    schedule(() => {
      setPhase('idle');
      setOpacity(0);
    }, FADE_OUT_MS + FADE_IN_MS);
  }, [clearTimers, onPeak, pulseKey, reducedMotion]);

  const transitionMs = phase === 'dimming'
    ? FADE_OUT_MS
    : phase === 'clearing'
      ? FADE_IN_MS
      : 0;

  return (
    <div
      className="leo-cinematic-seek-fade-overlay"
      data-testid="cinematic-seek-fade-overlay"
      data-fade-phase={phase}
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        backgroundColor: `rgba(0, 0, 0, ${suppressVisual ? 0 : opacity})`,
        transition: `background-color ${transitionMs}ms ease`,
      }}
    />
  );
}
