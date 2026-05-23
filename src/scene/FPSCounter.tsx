import { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

/**
 * FPSCounter component renders a real-time frame rate indicator inside the 3D Canvas.
 * It measures the actual render loop delta over the last 60 frames.
 */
export function FPSCounter() {
  const [fps, setFps] = useState(60);
  const frameTimes = useRef<number[]>([]);

  useFrame(() => {
    const now = performance.now();
    frameTimes.current.push(now);
    // Keep last 60 frame timestamps for rolling average calculation
    while (frameTimes.current.length > 60) {
      frameTimes.current.shift();
    }
    if (frameTimes.current.length > 1) {
      const duration = now - frameTimes.current[0];
      const currentFps = Math.round((frameTimes.current.length - 1) / (duration / 1000));
      // Clamp to a sensible range to avoid layout flicker
      setFps(Math.max(1, Math.min(120, currentFps)));
    }
  });

  return (
    <Html
      style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      className="leo-fps-counter-wrapper"
    >
      <div className="leo-fps-counter" data-testid="leo-fps-counter">
        {fps} FPS
      </div>
    </Html>
  );
}
