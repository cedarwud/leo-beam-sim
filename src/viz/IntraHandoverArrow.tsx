import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { INTRA_HANDOVER_ARROW_COLOR } from '../constants/beamRoleTokens';
import type { RuntimeConfig, VizFrame, VizIntraHandoverEvent } from '../scene/types';

const BEAM_GROUND_Y = 5;
const CTRL_POINT_LIFT = 80;
const ARC_SEGMENTS = 24;
const ARROWHEAD_SIZE = 10;

function buildArcGeometry(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, CTRL_POINT_LIFT, 0));
  const positions: number[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = i / ARC_SEGMENTS;
    const mt = 1 - t;
    positions.push(
      mt * mt * from.x + 2 * mt * t * ctrl.x + t * t * to.x,
      mt * mt * from.y + 2 * mt * t * ctrl.y + t * t * to.y,
      mt * mt * from.z + 2 * mt * t * ctrl.z + t * t * to.z,
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

function buildHeadGeometry(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, CTRL_POINT_LIFT, 0));
  const tangent = to.clone().sub(ctrl).normalize();
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const sz = ARROWHEAD_SIZE;
  const b1 = to.clone().sub(tangent.clone().multiplyScalar(sz)).add(right.clone().multiplyScalar(sz * 0.45));
  const b2 = to.clone().sub(tangent.clone().multiplyScalar(sz)).sub(right.clone().multiplyScalar(sz * 0.45));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    to.x, to.y, to.z,
    b1.x, b1.y, b1.z,
    b2.x, b2.y, b2.z,
  ], 3));
  return geo;
}

interface MeshProps {
  event: VizIntraHandoverEvent;
  reducedMotion: boolean;
}

function IntraHandoverArrowMesh({ event, reducedMotion }: MeshProps) {
  const { gl } = useThree();

  const fromVec = useMemo(
    () => new THREE.Vector3(event.fromGroundX, BEAM_GROUND_Y, event.fromGroundZ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event.fromGroundX, event.fromGroundZ],
  );
  const toVec = useMemo(
    () => new THREE.Vector3(event.toGroundX, BEAM_GROUND_Y, event.toGroundZ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event.toGroundX, event.toGroundZ],
  );

  const arcGeo = useMemo(() => buildArcGeometry(fromVec, toVec), [fromVec, toVec]);
  const headGeo = useMemo(() => buildHeadGeometry(fromVec, toVec), [fromVec, toVec]);

  const arcMat = useMemo(() => reducedMotion
    ? new THREE.LineDashedMaterial({ color: INTRA_HANDOVER_ARROW_COLOR, dashSize: 12, gapSize: 8, transparent: true, opacity: 0.7, depthWrite: false })
    : new THREE.LineBasicMaterial({ color: INTRA_HANDOVER_ARROW_COLOR, transparent: true, opacity: 1, depthWrite: false }),
  [reducedMotion]);

  const headMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: INTRA_HANDOVER_ARROW_COLOR,
    transparent: true,
    opacity: reducedMotion ? 0.7 : 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [reducedMotion]);

  const arcLine = useMemo(() => {
    const line = reducedMotion ? new THREE.LineSegments(arcGeo, arcMat) : new THREE.Line(arcGeo, arcMat);
    if (reducedMotion) line.computeLineDistances();
    line.renderOrder = 22;
    return line;
  }, [arcGeo, arcMat, reducedMotion]);

  const headMesh = useMemo(() => {
    const mesh = new THREE.Mesh(headGeo, headMat);
    mesh.renderOrder = 22;
    return mesh;
  }, [headGeo, headMat]);

  useFrame(() => {
    if (reducedMotion) {
      gl.domElement.dataset.intraHandoverArrowOpacity = '0.700';
      gl.domElement.dataset.intraHandoverArrowActive = '1';
      return;
    }
    const wallClockNowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const wallClockWindowMs = Math.max(
      1,
      event.wallClockExpiresMs - event.wallClockStartMs,
    );
    const opacity = Math.max(
      0,
      1 - (wallClockNowMs - event.wallClockStartMs) / wallClockWindowMs,
    );
    arcMat.opacity = opacity;
    headMat.opacity = opacity;
    gl.domElement.dataset.intraHandoverArrowOpacity = opacity.toFixed(4);
    gl.domElement.dataset.intraHandoverArrowActive = opacity > 0.01 ? '1' : '0';
  });

  useEffect(() => () => {
    gl.domElement.dataset.intraHandoverArrowOpacity = '';
    gl.domElement.dataset.intraHandoverArrowActive = '0';
    arcMat.dispose();
    headMat.dispose();
    arcGeo.dispose();
    headGeo.dispose();
  }, [gl, arcMat, headMat, arcGeo, headGeo]);

  return (
    <group>
      <primitive object={arcLine} />
      <primitive object={headMesh} />
    </group>
  );
}

interface Props {
  vizFrame: VizFrame;
  runtime: RuntimeConfig;
}

export function IntraHandoverArrow({ vizFrame, runtime }: Props) {
  const event = vizFrame.intraHandoverEvent;
  if (!event) return null;
  return (
    <IntraHandoverArrowMesh
      key={event.triggeredAtSec}
      event={event}
      reducedMotion={runtime.reducedMotion}
    />
  );
}
