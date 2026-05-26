import type { UeTrailHistory, UeTrailPoint } from '../scene/useUeTrailHistory';

interface UeTrailProps {
  history: UeTrailHistory;
  maxOpacity?: number;
}

const TRAIL_COLOR = '#7a8a96';
const DEFAULT_MAX_OPACITY = 0.58;

function segmentOpacity(index: number, segmentCount: number, maxOpacity: number): number {
  if (segmentCount <= 1) return maxOpacity;
  return (index / (segmentCount - 1)) * maxOpacity;
}

function UeTrailSegment({
  start,
  end,
  opacity,
}: {
  start: UeTrailPoint;
  end: UeTrailPoint;
  opacity: number;
}) {
  const positions = new Float32Array([
    start[0],
    start[1],
    start[2],
    end[0],
    end[1],
    end[2],
  ]);

  return (
    <lineSegments renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color={TRAIL_COLOR}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function UeTrailPolyline({
  points,
  maxOpacity,
}: {
  points: ReadonlyArray<UeTrailPoint>;
  maxOpacity: number;
}) {
  if (points.length < 2) return null;

  const segmentCount = points.length - 1;
  return (
    <group>
      {points.slice(1).map((point, index) => (
        <UeTrailSegment
          key={`${index}:${point[0]}:${point[2]}`}
          start={points[index]}
          end={point}
          opacity={segmentOpacity(index, segmentCount, maxOpacity)}
        />
      ))}
    </group>
  );
}

export function UeTrail({
  history,
  maxOpacity = DEFAULT_MAX_OPACITY,
}: UeTrailProps) {
  const safeMaxOpacity = Math.min(Math.max(maxOpacity, 0), 1);

  return (
    <group>
      {history.map((points, ueIndex) => (
        ueIndex === 0 || points.length < 2
          ? null
          : (
              <UeTrailPolyline
                key={`ue-trail-${ueIndex}`}
                points={points}
                maxOpacity={safeMaxOpacity}
              />
            )
      ))}
    </group>
  );
}
