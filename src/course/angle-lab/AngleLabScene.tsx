import { useMemo, type ReactElement } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

import { SixActsSceneCard } from '../nav/SixActsAnnotation';

/**
 * Act 3's geometry: one satellite, one UE, and the TWO angles the room keeps
 * confusing.
 *
 *   elevation ε — apex at the UE, measured from the local horizon plane
 *   off-axis  θ — apex at the SATELLITE, measured from the beam axis to the UE
 *
 * Drawing them in one frame is the whole argument: the apexes are in different
 * places, so they are not the same angle and never will be.
 *
 * Display only — the numbers come from `anglePowerChain`.
 */

export const ANGLE_LAB_ELEVATION_COLOUR = '#ffd78a';
export const ANGLE_LAB_OFFAXIS_COLOUR = '#5fe3ff';
export const ANGLE_LAB_BEAM_COLOUR = '#76ead7';

export type AngleLabCamera = 'ue' | 'side' | 'satellite';

export interface AngleLabCameraPreset {
  readonly id: AngleLabCamera;
  readonly labelZhHant: string;
  readonly whyZhHant: string;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/** Ground plane is y = 0, the UE sits at the origin, the satellite above it. */
export const ANGLE_LAB_CAMERAS: readonly AngleLabCameraPreset[] = Object.freeze([
  Object.freeze({
    id: 'ue' as const,
    labelZhHant: 'UE 視角',
    whyZhHant: '從你腳下往上看。這個視角只看得到仰角 ε，看不出離軸角。',
    position: [0.05, 0.35, 3.4] as const,
    target: [0, 1.4, 0] as const,
  }),
  Object.freeze({
    id: 'side' as const,
    labelZhHant: '側視',
    whyZhHant: '兩個角度同框。頂點一個在衛星、一個在你腳下——這就是它們不相等的原因。',
    position: [5.4, 1.9, 3.4] as const,
    target: [0.4, 1.1, 0] as const,
  }),
  Object.freeze({
    id: 'satellite' as const,
    labelZhHant: '衛星視角',
    whyZhHant: '沿著波束中軸往下看。你偏離準心多少，就是 θ 的畫面定義。',
    position: [0, 6.4, 0.001] as const,
    target: [0, 0, 0] as const,
  }),
]);

export interface AngleLabGeometry {
  readonly satellite: THREE.Vector3;
  readonly ue: THREE.Vector3;
  readonly beamAxisEnd: THREE.Vector3;
  readonly elevationDeg: number;
  readonly offAxisDeg: number;
}

/**
 * Places the satellite so that the UE sits at `offAxisDeg` from a beam axis
 * that is itself tilted by `steeringDeg` from nadir.
 */
export function buildAngleLabGeometry(options: {
  readonly satelliteHeight: number;
  readonly ueGroundX: number;
  readonly steeringDeg: number;
}): AngleLabGeometry {
  const satellite = new THREE.Vector3(0, options.satelliteHeight, 0);
  const ue = new THREE.Vector3(options.ueGroundX, 0, 0);

  const steeringRad = THREE.MathUtils.degToRad(options.steeringDeg);
  // Nadir is -Y; steering tilts the axis towards +X in the drawing plane.
  const axis = new THREE.Vector3(Math.sin(steeringRad), -Math.cos(steeringRad), 0).normalize();
  const beamAxisEnd = satellite.clone().addScaledVector(axis, options.satelliteHeight * 1.35);

  const toUe = ue.clone().sub(satellite).normalize();
  const offAxisDeg = THREE.MathUtils.radToDeg(Math.acos(
    THREE.MathUtils.clamp(axis.dot(toUe), -1, 1)));

  // Elevation is measured at the UE, from its horizon plane up to the satellite.
  const toSatellite = satellite.clone().sub(ue);
  const horizontal = Math.hypot(toSatellite.x, toSatellite.z);
  const elevationDeg = THREE.MathUtils.radToDeg(Math.atan2(toSatellite.y, horizontal));

  return { satellite, ue, beamAxisEnd, elevationDeg, offAxisDeg };
}

function arcPoints(
  apex: THREE.Vector3,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  segments = 36,
): [number, number, number][] {
  const a = from.clone().sub(apex).normalize();
  const b = to.clone().sub(apex).normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  const axis = new THREE.Vector3().crossVectors(a, b).normalize();
  const points: [number, number, number][] = [];
  for (let index = 0; index <= segments; index += 1) {
    const rotated = a.clone().applyAxisAngle(axis, (angle * index) / segments);
    const point = apex.clone().addScaledVector(rotated, radius);
    points.push([point.x, point.y, point.z]);
  }
  return points;
}

export function AngleLabScene({
  geometry, theta3dbDeg, showLabels = true,
}: {
  readonly geometry: AngleLabGeometry;
  readonly theta3dbDeg: number;
  readonly showLabels?: boolean;
}): ReactElement {
  const { satellite, ue, beamAxisEnd } = geometry;

  const arcs = useMemo(() => {
    const horizonPoint = ue.clone().add(new THREE.Vector3(1, 0, 0));
    return {
      elevation: arcPoints(ue, horizonPoint, satellite, 0.45),
      offAxis: arcPoints(satellite, beamAxisEnd, ue, 0.55),
    };
  }, [satellite, ue, beamAxisEnd]);

  const coneRadius = Math.tan(THREE.MathUtils.degToRad(theta3dbDeg)) * satellite.y * 1.35;
  const coneCentre = satellite.clone().lerp(beamAxisEnd, 0.5);
  const coneQuaternion = useMemo(() => {
    const axis = beamAxisEnd.clone().sub(satellite).normalize();
    // three.js puts a cone's TIP at +Y. The tip belongs at the satellite, so +Y
    // maps to the direction pointing back UP the axis. Mapping it to the axis
    // itself drew the beam upside down — wide at the satellite, narrow at the
    // ground, which is backwards for every beam ever built.
    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      axis.clone().negate(),
    );
  }, [satellite, beamAxisEnd]);

  return (
    <group name="angle-lab">
      <gridHelper args={[8, 16, '#12333d', '#0c2028']} position={[0, 0, 0]} />

      <mesh position={satellite}>
        <boxGeometry args={[0.18, 0.09, 0.28]} />
        <meshStandardMaterial color="#dff6ff" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={ue}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshBasicMaterial color={ANGLE_LAB_ELEVATION_COLOUR} />
      </mesh>

      {/* the 3 dB beam envelope, sized by theta_3dB */}
      <mesh position={coneCentre} quaternion={coneQuaternion}>
        <coneGeometry args={[coneRadius, satellite.y * 1.35, 40, 1, true]} />
        <meshBasicMaterial color={ANGLE_LAB_BEAM_COLOUR} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <Line points={[satellite.toArray(), beamAxisEnd.toArray()]} color={ANGLE_LAB_BEAM_COLOUR} lineWidth={1.6} dashed dashSize={0.12} gapSize={0.08} />
      <Line points={[satellite.toArray(), ue.toArray()]} color={ANGLE_LAB_OFFAXIS_COLOUR} lineWidth={2} />
      <Line points={[ue.toArray(), [ue.x + 1.6, 0, 0]]} color={ANGLE_LAB_ELEVATION_COLOUR} lineWidth={1.4} transparent opacity={0.7} />

      <Line points={arcs.elevation} color={ANGLE_LAB_ELEVATION_COLOUR} lineWidth={2.4} />
      <Line points={arcs.offAxis} color={ANGLE_LAB_OFFAXIS_COLOUR} lineWidth={2.4} />

      {showLabels ? <>
        <Html position={[ue.x + 0.55, 0.28, 0]} center className="angle-lab__tag is-elevation">
          ε = {geometry.elevationDeg.toFixed(1)}°
        </Html>
        <Html position={[satellite.x + 0.1, satellite.y - 0.62, 0]} center className="angle-lab__tag is-offaxis">
          θ = {geometry.offAxisDeg.toFixed(1)}°
        </Html>
      </> : null}

      {/* The two angles get a card each, pinned where they are measured. Values
          alone leave the room to work out WHERE each apex sits; the cards say
          it, and a screenshot of the frame carries the argument. */}
      {showLabels ? <>
        <SixActsSceneCard
          position={[ue.x + 0.9, 0.75, 0]}
          content={{
            eyebrow: '仰角 ε',
            title: `${geometry.elevationDeg.toFixed(1)}°`,
            body: '頂點在你腳下，從地平面量到衛星。它只跟衛星在天上多高有關。',
            tone: 'source',
          }}
        />
        <SixActsSceneCard
          position={[satellite.x + 1.05, satellite.y - 0.95, 0]}
          content={{
            eyebrow: '離軸角 θ',
            title: `${geometry.offAxisDeg.toFixed(1)}°`,
            body: '頂點在衛星，從波束中軸量到你。撥中軸它就變，仰角卻一動也不動。',
            tone: 'candidate',
          }}
        />
      </> : null}

    </group>
  );
}
