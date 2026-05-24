import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { INTRA_HANDOVER_ARROW_COLOR } from '../constants/beamRoleTokens';
import type { RuntimeConfig, VizFrame, VizIntraHandoverEvent } from '../scene/types';

/**
 * Intra-handover arrow (SDD 5.2 items B0 / B2).
 *
 * Renders during the wall-clock latch window after an intra-HO event. Composed
 * of four meshes inside a single <group> so they unmount atomically:
 *
 *   - Inner blue arc tube (renderOrder 22): the load-bearing "ribbon arc"
 *     drawn along a quadratic Bezier from from-beam ground point to to-beam
 *     ground point, control point lifted by CTRL_POINT_LIFT.
 *   - Outer blue glow tube (renderOrder 21): same Bezier, wider radius,
 *     lower opacity, AdditiveBlending - the visual halo widening the ribbon.
 *   - White pulse dot (renderOrder 23): sphere that travels along the same
 *     Bezier from `from` to `to` and holds at the to-beam endpoint for the
 *     remainder of the latch.
 *   - Arrow head triangle (renderOrder 22): tangent-aligned triangle at the
 *     to-beam endpoint.
 *
 * Presentation only: reads only the intra-HO viz frame (wall-clock latch from
 * `runtimeFrameStep.ts`); never alters SINR / handover policy / event identity
 * (SDD 4.1, 4.3).
 *
 * DOM data-* attributes (written on gl.domElement.dataset for validators):
 *   - data-intra-handover-arrow-active     "1" while ribbon is visible
 *   - data-intra-handover-arrow-opacity    current inner arc opacity (4dp)
 *   - data-intra-beam-roles-active         "1" while beam-level intra roles emit
 *   - data-intra-pulse-progress            curve-position parameter 0..1 (4dp)
 *   - data-intra-ribbon-radius-world       inner-arc world radius (4dp)
 *   - data-intra-outer-glow-opacity        current outer-glow opacity (4dp)
 */

const BEAM_GROUND_Y = 5;
const CTRL_POINT_LIFT = 80;
const ARC_SEGMENTS = 24;
const ARROWHEAD_SIZE = 10;
const ARC_TUBE_RADIUS = 2.4;
const ARC_TUBE_RADIUS_REDUCED_MOTION = 1.8;

// Outer glow: wider halo of the same blue, lower base opacity, additive blend
// so the brighter inner ribbon visually dominates the center.
const ARC_OUTER_GLOW_RADIUS = 4.8;
const ARC_OUTER_GLOW_RADIUS_REDUCED_MOTION = 3.6;
// Outer glow opacity tracks the inner-arc linear fade and is multiplied by
// this base so the halo never overpowers the brighter inner ribbon. The
// 0.45 / 0.30 split mirrors the inner arc's normal vs reduced-motion mix.
const OUTER_GLOW_BASE_OPACITY = 0.45;
const OUTER_GLOW_BASE_OPACITY_REDUCED_MOTION = 0.30;

// White pulse dot riding the ribbon. The pulse reaches the to-beam endpoint
// at ~1/3 of the wall-clock latch (~2 s into the 6 s window) by tripling the
// fade progress, then clamps to 1 and holds at the endpoint.
const PULSE_DOT_RADIUS = 3.2;
const PULSE_DOT_RADIUS_REDUCED_MOTION = 2.4;
const PULSE_DOT_BASE_OPACITY = 0.95;
const PULSE_DOT_BASE_OPACITY_REDUCED_MOTION = 0.75;
const PULSE_T_SPEED = 3; // progress multiplier; pulseT = clamp01(progress * 3)
const PULSE_DOT_REDUCED_MOTION_T = 0.7; // fixed past-midpoint position

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function buildArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, CTRL_POINT_LIFT, 0));
  return new THREE.QuadraticBezierCurve3(from, ctrl, to);
}

function buildHeadGeometry(curve: THREE.QuadraticBezierCurve3, to: THREE.Vector3): THREE.BufferGeometry {
  const tangent = curve.getTangent(1).normalize();
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

  // Hoist the Bezier curve so inner-arc geometry, outer-glow geometry, head
  // geometry, and per-frame pulse positions all derive from the same instance.
  const curve = useMemo(() => buildArcCurve(fromVec, toVec), [fromVec, toVec]);

  const arcRadiusWorld = reducedMotion ? ARC_TUBE_RADIUS_REDUCED_MOTION : ARC_TUBE_RADIUS;
  const arcRadiusWorldStr = arcRadiusWorld.toFixed(4);
  const outerGlowRadiusWorld = reducedMotion
    ? ARC_OUTER_GLOW_RADIUS_REDUCED_MOTION
    : ARC_OUTER_GLOW_RADIUS;
  const pulseDotRadiusWorld = reducedMotion ? PULSE_DOT_RADIUS_REDUCED_MOTION : PULSE_DOT_RADIUS;
  const outerGlowBaseOpacity = reducedMotion
    ? OUTER_GLOW_BASE_OPACITY_REDUCED_MOTION
    : OUTER_GLOW_BASE_OPACITY;
  const pulseDotBaseOpacity = reducedMotion
    ? PULSE_DOT_BASE_OPACITY_REDUCED_MOTION
    : PULSE_DOT_BASE_OPACITY;

  const arcGeo = useMemo(() => new THREE.TubeGeometry(
    curve,
    ARC_SEGMENTS,
    arcRadiusWorld,
    8,
    false,
  ), [curve, arcRadiusWorld]);

  const outerGlowGeo = useMemo(() => new THREE.TubeGeometry(
    curve,
    ARC_SEGMENTS,
    outerGlowRadiusWorld,
    8,
    false,
  ), [curve, outerGlowRadiusWorld]);

  const headGeo = useMemo(() => buildHeadGeometry(curve, toVec), [curve, toVec]);
  const pulseGeo = useMemo(() => new THREE.SphereGeometry(pulseDotRadiusWorld, 24, 16), [pulseDotRadiusWorld]);

  const arcMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: INTRA_HANDOVER_ARROW_COLOR,
    transparent: true,
    opacity: reducedMotion ? 0.72 : 1,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }),
  [reducedMotion]);

  const headMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: INTRA_HANDOVER_ARROW_COLOR,
    transparent: true,
    opacity: reducedMotion ? 0.7 : 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [reducedMotion]);

  const outerGlowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: INTRA_HANDOVER_ARROW_COLOR,
    transparent: true,
    opacity: outerGlowBaseOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }), [outerGlowBaseOpacity]);

  const pulseMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: pulseDotBaseOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [pulseDotBaseOpacity]);

  const arcMesh = useMemo(() => {
    const mesh = new THREE.Mesh(arcGeo, arcMat);
    mesh.renderOrder = 22;
    return mesh;
  }, [arcGeo, arcMat]);

  const headMesh = useMemo(() => {
    const mesh = new THREE.Mesh(headGeo, headMat);
    mesh.renderOrder = 22;
    return mesh;
  }, [headGeo, headMat]);

  const outerGlowMesh = useMemo(() => {
    const mesh = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    mesh.renderOrder = 21;
    return mesh;
  }, [outerGlowGeo, outerGlowMat]);

  const pulseMesh = useMemo(() => {
    const mesh = new THREE.Mesh(pulseGeo, pulseMat);
    mesh.renderOrder = 23;
    // Seed at the from-end so the first paint (pre-useFrame) shows the dot
    // at the start of the ribbon rather than at world origin.
    const seedPoint = curve.getPoint(0);
    mesh.position.copy(seedPoint);
    return mesh;
  }, [pulseGeo, pulseMat, curve]);

  useFrame(() => {
    const ds = gl.domElement.dataset;
    if (reducedMotion) {
      // Pulse fixed past midpoint along the curve; opacities held constant.
      const pulsePoint = curve.getPoint(PULSE_DOT_REDUCED_MOTION_T);
      pulseMesh.position.copy(pulsePoint);
      pulseMat.opacity = pulseDotBaseOpacity;
      outerGlowMat.opacity = outerGlowBaseOpacity;
      ds.intraHandoverArrowOpacity = '0.700';
      ds.intraHandoverArrowActive = '1';
      ds.intraBeamRolesActive = '1';
      ds.intraPulseProgress = PULSE_DOT_REDUCED_MOTION_T.toFixed(4);
      ds.intraRibbonRadiusWorld = arcRadiusWorldStr;
      ds.intraOuterGlowOpacity = outerGlowBaseOpacity.toFixed(4);
      return;
    }
    const wallClockNowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const wallClockWindowMs = Math.max(
      1,
      event.wallClockExpiresMs - event.wallClockStartMs,
    );
    const elapsedMs = wallClockNowMs - event.wallClockStartMs;
    const progress = clamp01(elapsedMs / wallClockWindowMs);
    const opacity = Math.max(0, 1 - elapsedMs / wallClockWindowMs);
    arcMat.opacity = opacity;
    headMat.opacity = opacity;
    // Outer glow follows the same linear wall-clock fade, scaled so the
    // halo never overpowers the brighter inner ribbon at the latch start.
    outerGlowMat.opacity = opacity * outerGlowBaseOpacity;

    // Pulse dot: reaches endpoint at ~1/3 of latch, then holds.
    const pulseT = clamp01(progress * PULSE_T_SPEED);
    const pulsePoint = curve.getPoint(pulseT);
    pulseMesh.position.copy(pulsePoint);
    pulseMat.opacity = pulseDotBaseOpacity * opacity;

    ds.intraHandoverArrowOpacity = opacity.toFixed(4);
    ds.intraHandoverArrowActive = opacity > 0.01 ? '1' : '0';
    ds.intraBeamRolesActive = opacity > 0.01 ? '1' : '0';
    ds.intraPulseProgress = pulseT.toFixed(4);
    ds.intraRibbonRadiusWorld = arcRadiusWorldStr;
    ds.intraOuterGlowOpacity = outerGlowMat.opacity.toFixed(4);
  });

  // Seed dataset attributes immediately on mount so validators that sample
  // before the first useFrame tick (SwiftShader-throttled rAF can be 200-300 ms
  // between frames) see a coherent active=1 reading rather than empty strings
  // left over from a prior latch teardown.
  useEffect(() => {
    const ds = gl.domElement.dataset;
    if (reducedMotion) {
      ds.intraHandoverArrowOpacity = '0.700';
      ds.intraHandoverArrowActive = '1';
      ds.intraBeamRolesActive = '1';
      ds.intraPulseProgress = PULSE_DOT_REDUCED_MOTION_T.toFixed(4);
      ds.intraRibbonRadiusWorld = arcRadiusWorldStr;
      ds.intraOuterGlowOpacity = outerGlowBaseOpacity.toFixed(4);
      return;
    }
    const wallClockNowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const wallClockWindowMs = Math.max(
      1,
      event.wallClockExpiresMs - event.wallClockStartMs,
    );
    const elapsedMs = wallClockNowMs - event.wallClockStartMs;
    const progress = clamp01(elapsedMs / wallClockWindowMs);
    const opacity = Math.max(0, 1 - elapsedMs / wallClockWindowMs);
    const pulseT = clamp01(progress * PULSE_T_SPEED);
    ds.intraHandoverArrowOpacity = opacity.toFixed(4);
    ds.intraHandoverArrowActive = opacity > 0.01 ? '1' : '0';
    ds.intraBeamRolesActive = opacity > 0.01 ? '1' : '0';
    ds.intraPulseProgress = pulseT.toFixed(4);
    ds.intraRibbonRadiusWorld = arcRadiusWorldStr;
    ds.intraOuterGlowOpacity = (opacity * outerGlowBaseOpacity).toFixed(4);
  }, [
    gl,
    reducedMotion,
    event.wallClockStartMs,
    event.wallClockExpiresMs,
    arcRadiusWorldStr,
    outerGlowBaseOpacity,
  ]);

  useEffect(() => () => {
    const ds = gl.domElement.dataset;
    ds.intraHandoverArrowOpacity = '';
    ds.intraHandoverArrowActive = '0';
    ds.intraBeamRolesActive = '0';
    ds.intraPulseProgress = '';
    ds.intraRibbonRadiusWorld = '';
    ds.intraOuterGlowOpacity = '';
    arcMat.dispose();
    headMat.dispose();
    outerGlowMat.dispose();
    pulseMat.dispose();
    arcGeo.dispose();
    headGeo.dispose();
    outerGlowGeo.dispose();
    pulseGeo.dispose();
  }, [
    gl,
    arcMat,
    headMat,
    outerGlowMat,
    pulseMat,
    arcGeo,
    headGeo,
    outerGlowGeo,
    pulseGeo,
  ]);

  return (
    <group>
      <primitive object={outerGlowMesh} />
      <primitive object={arcMesh} />
      <primitive object={headMesh} />
      <primitive object={pulseMesh} />
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
