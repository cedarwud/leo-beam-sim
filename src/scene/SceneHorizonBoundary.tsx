import { useEffect, useRef, useState, type JSX } from 'react';
import { useFrame } from '@react-three/fiber';

import { MIN_RENDER_ELEVATION_DEG } from '../appearance/coneGeometryContract';
import type { VisibleSat } from './types';

export const HORIZON_TRANSITION_DURATION_MS = 720;

/** Keep the fade-beacon cue just above the unchanged 15° render boundary. */
const HORIZON_APPROACH_BAND_DEG = 5;
const HORIZON_APPROACH_ELEVATION_DEG = MIN_RENDER_ELEVATION_DEG + HORIZON_APPROACH_BAND_DEG;

type HorizonSatellite = Pick<VisibleSat, 'id' | 'world' | 'topo'>;
type HorizonDirection = 'entering' | 'leaving';

interface HorizonSample {
  readonly world: readonly [number, number, number];
  readonly elevationDeg: number;
}

interface HorizonTransition {
  readonly key: string;
  readonly satelliteId: string;
  readonly direction: HorizonDirection;
  readonly sample: HorizonSample;
  readonly startedAtMs: number;
}

export interface SceneHorizonBoundaryProps {
  readonly visible?: boolean;
  readonly satellites: readonly HorizonSatellite[];
}

function worldTuple(satellite: HorizonSatellite): readonly [number, number, number] {
  return [satellite.world.x, satellite.world.y, satellite.world.z];
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/** Presentation-only alpha; it never decides whether a satellite is eligible. */
export function resolveHorizonTransitionOpacity(
  direction: HorizonDirection,
  elapsedMs: number,
): number {
  const progress = Math.max(0, Math.min(1, elapsedMs / HORIZON_TRANSITION_DURATION_MS));
  return direction === 'entering' ? progress : 1 - progress;
}

/**
 * A small ghost beacon fades in/out at a satellite's own position as it
 * crosses the elevation floor, softening the existing cache/render floors'
 * otherwise-abrupt pop-in/pop-out. The core marker and cone mounts remain
 * untouched; only this additive beacon fades.
 */
export function SceneHorizonBoundary({
  visible = true,
  satellites,
}: SceneHorizonBoundaryProps): JSX.Element | null {
  const previousSamplesRef = useRef<Map<string, HorizonSample>>(new Map());
  const transitionsRef = useRef<Map<string, HorizonTransition>>(new Map());
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!visible) {
      // `satellites` is a fresh array reference most renders even when its
      // content hasn't changed, so this effect re-fires far more often than
      // the state it tracks actually changes. Calling `setRevision`
      // unconditionally here turned every such re-fire into another render,
      // which produced another fresh `satellites` reference, which re-fired
      // the effect again — an infinite render loop that tripped React's
      // "Maximum update depth exceeded" guard. Only touch state when there is
      // something to clear.
      if (previousSamplesRef.current.size === 0 && transitionsRef.current.size === 0) return;
      previousSamplesRef.current = new Map();
      transitionsRef.current.clear();
      setRevision(current => current + 1);
      return;
    }

    const previous = previousSamplesRef.current;
    const current = new Map<string, HorizonSample>(satellites.map(satellite => [
      satellite.id,
      { world: worldTuple(satellite), elevationDeg: satellite.topo.elevationDeg },
    ]));
    const startedAtMs = nowMs();
    let startedAnyTransition = false;
    const startTransition = (
      satelliteId: string,
      direction: HorizonDirection,
      sample: HorizonSample,
    ): void => {
      const key = `${satelliteId}:${direction}`;
      const oppositeKey = `${satelliteId}:${direction === 'entering' ? 'leaving' : 'entering'}`;
      transitionsRef.current.delete(oppositeKey);
      if (transitionsRef.current.has(key)) return;
      transitionsRef.current.set(key, {
        key,
        satelliteId,
        direction,
        sample,
        startedAtMs,
      });
      startedAnyTransition = true;
    };

    for (const [satelliteId, sample] of current) {
      const prior = previous.get(satelliteId);
      if (prior === undefined) {
        // A stream can begin with an already-low satellite; give that first
        // visible sample the same short entering cue without guessing motion.
        if (sample.elevationDeg <= HORIZON_APPROACH_ELEVATION_DEG) {
          startTransition(satelliteId, 'entering', sample);
        }
        continue;
      }
      const crossedFloorWhileRising = prior.elevationDeg <= MIN_RENDER_ELEVATION_DEG
        && sample.elevationDeg > MIN_RENDER_ELEVATION_DEG
        && sample.elevationDeg > prior.elevationDeg;
      const crossedFloorWhileSetting = prior.elevationDeg > MIN_RENDER_ELEVATION_DEG
        && sample.elevationDeg <= MIN_RENDER_ELEVATION_DEG
        && sample.elevationDeg < prior.elevationDeg;
      if (crossedFloorWhileRising) startTransition(satelliteId, 'entering', sample);
      if (crossedFloorWhileSetting) startTransition(satelliteId, 'leaving', prior);
    }

    for (const [satelliteId, prior] of previous) {
      if (current.has(satelliteId) || prior.elevationDeg > MIN_RENDER_ELEVATION_DEG) continue;
      startTransition(satelliteId, 'leaving', prior);
    }

    previousSamplesRef.current = current;
    // Same fix as above: only force a render when a transition actually
    // started. `previousSamplesRef` is a ref precisely so tracking it never
    // needs to force one.
    if (startedAnyTransition) setRevision(currentRevision => currentRevision + 1);
  }, [satellites, visible]);

  useFrame(() => {
    if (transitionsRef.current.size === 0) return;
    const currentNowMs = nowMs();
    let changed = false;
    for (const [key, transition] of transitionsRef.current) {
      if (currentNowMs - transition.startedAtMs < HORIZON_TRANSITION_DURATION_MS) continue;
      transitionsRef.current.delete(key);
      changed = true;
    }
    if (changed || transitionsRef.current.size > 0) {
      setRevision(currentRevision => currentRevision + 1);
    }
  });

  if (!visible) return null;

  const currentNowMs = nowMs();
  const transitions = [...transitionsRef.current.values()];
  // Keep `revision` read in render so R3F clock ticks repaint the alpha ramp.
  void revision;
  return (
    <group
      name="scene-visibility-horizon"
      userData={{
        elevationFloorDeg: MIN_RENDER_ELEVATION_DEG,
        transitionDurationMs: HORIZON_TRANSITION_DURATION_MS,
      }}
    >
      {transitions.map(transition => {
        const opacity = resolveHorizonTransitionOpacity(
          transition.direction,
          currentNowMs - transition.startedAtMs,
        );
        return (
          <mesh
            key={transition.key}
            name={`scene-horizon-transition-${transition.satelliteId}-${transition.direction}`}
            position={transition.sample.world}
            scale={1 + (1 - opacity) * 0.35}
            renderOrder={26}
            userData={{
              horizonFade: true,
              satelliteId: transition.satelliteId,
              direction: transition.direction,
              elevationDeg: transition.sample.elevationDeg,
              opacity,
              transitionDurationMs: HORIZON_TRANSITION_DURATION_MS,
            }}
          >
            <sphereGeometry args={[14, 16, 12]} />
            <meshBasicMaterial
              color="#d9f7ff"
              transparent
              opacity={0.62 * opacity}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
