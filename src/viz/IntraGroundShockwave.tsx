import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  INTRA_HANDOVER_SOURCE_COLOR,
  INTRA_HANDOVER_TARGET_COLOR,
} from '../constants/beamRoleTokens';
import type { RuntimeConfig, VizFrame, VizIntraHandoverEvent } from '../scene/types';

/**
 * B4 — Ground shockwave (SDD §5.2 item B4).
 *
 * On the ground projection of the intra-HO from-beam and to-beam, render
 * one-shot ring effects during the wall-clock latch window:
 *
 *   - Source ring: starts at full ground-disc radius, contracts to 0.6x,
 *     opacity fades from ~0.85 down to ~0.
 *   - Target ring: starts at 0.4x, expands to ~1.3x, opacity ramps up to
 *     a peak at ~30% of the window then falls back to ~0.2 by latch end
 *     (yields a "shockwave" feel rather than a monotonic fade).
 *
 * Presentation only: reads only the intra-HO viz frame, never alters
 * SINR / handover policy / event identity (SDD §4.1, §4.3).
 *
 * DOM data-* attributes (written on gl.domElement.dataset for validators):
 *   - data-intra-shockwave-active           "1" while ring is visible
 *   - data-intra-shockwave-source-opacity   current source ring opacity (3dp)
 *   - data-intra-shockwave-target-opacity   current target ring opacity (3dp)
 *   - data-intra-shockwave-source-scale     current source ring radius/disc
 *   - data-intra-shockwave-target-scale     current target ring radius/disc
 */

const BEAM_GROUND_Y = 5;
const RING_Y_LIFT = 3.2;
const RING_SEGMENTS = 64;
const RING_THICKNESS_WORLD = 1.6;

// Source ring envelope: opacity drops from peak to 0; radius contracts.
const SOURCE_OPACITY_START = 0.85;
const SOURCE_OPACITY_END = 0;
const SOURCE_SCALE_START = 1.0;
const SOURCE_SCALE_END = 0.6;

// Target ring envelope: scale expands; opacity peaks early and tails off.
const TARGET_OPACITY_PEAK = 0.85;
const TARGET_OPACITY_TAIL = 0.2;
const TARGET_PEAK_PROGRESS = 0.3;
const TARGET_SCALE_START = 0.4;
const TARGET_SCALE_END = 1.3;

// Reduced-motion final-state values (no per-frame animation).
const REDUCED_MOTION_SOURCE_OPACITY = 0;
const REDUCED_MOTION_TARGET_OPACITY = 0.32;
const REDUCED_MOTION_SOURCE_SCALE = 0.62;
const REDUCED_MOTION_TARGET_SCALE = 1.25;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Target opacity envelope: ramps up from 0 to peak by `TARGET_PEAK_PROGRESS`,
 * then ramps down from peak to tail by progress=1. Produces a single hump
 * that visually reads as a "shockwave" rather than a slow fade.
 */
function targetOpacityFor(progress: number): number {
  const t = clamp01(progress);
  if (t <= TARGET_PEAK_PROGRESS) {
    return lerp(0, TARGET_OPACITY_PEAK, t / TARGET_PEAK_PROGRESS);
  }
  const tail = (t - TARGET_PEAK_PROGRESS) / (1 - TARGET_PEAK_PROGRESS);
  return lerp(TARGET_OPACITY_PEAK, TARGET_OPACITY_TAIL, tail);
}

function sourceOpacityFor(progress: number): number {
  return lerp(SOURCE_OPACITY_START, SOURCE_OPACITY_END, clamp01(progress));
}

function sourceScaleFor(progress: number): number {
  return lerp(SOURCE_SCALE_START, SOURCE_SCALE_END, clamp01(progress));
}

function targetScaleFor(progress: number): number {
  return lerp(TARGET_SCALE_START, TARGET_SCALE_END, clamp01(progress));
}

interface MeshProps {
  event: VizIntraHandoverEvent;
  footprintRadius: number;
  reducedMotion: boolean;
  sourceColor: string;
  targetColor: string;
}

function IntraGroundShockwaveMesh({
  event,
  footprintRadius,
  reducedMotion,
  sourceColor,
  targetColor,
}: MeshProps) {
  const { gl } = useThree();

  const sourcePos = useMemo<[number, number, number]>(
    () => [event.fromGroundX, BEAM_GROUND_Y + RING_Y_LIFT, event.fromGroundZ],
    [event.fromGroundX, event.fromGroundZ],
  );
  const targetPos = useMemo<[number, number, number]>(
    () => [event.toGroundX, BEAM_GROUND_Y + RING_Y_LIFT, event.toGroundZ],
    [event.toGroundX, event.toGroundZ],
  );

  // Unit ring geometries (radius = 1, thickness scaled out from 1). We then
  // apply per-frame .scale to express the runtime ring radius without rebuilding
  // the geometry every tick.
  const sourceGeo = useMemo(() => {
    const inner = Math.max(0.01, footprintRadius - RING_THICKNESS_WORLD);
    return new THREE.RingGeometry(inner, footprintRadius, RING_SEGMENTS);
  }, [footprintRadius]);

  const targetGeo = useMemo(() => {
    const inner = Math.max(0.01, footprintRadius - RING_THICKNESS_WORLD);
    return new THREE.RingGeometry(inner, footprintRadius, RING_SEGMENTS);
  }, [footprintRadius]);

  const sourceMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: sourceColor,
    transparent: true,
    opacity: reducedMotion ? REDUCED_MOTION_SOURCE_OPACITY : SOURCE_OPACITY_START,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }), [reducedMotion, sourceColor]);

  const targetMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: targetColor,
    transparent: true,
    opacity: reducedMotion ? REDUCED_MOTION_TARGET_OPACITY : 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }), [reducedMotion, targetColor]);

  const sourceMesh = useMemo(() => {
    const mesh = new THREE.Mesh(sourceGeo, sourceMat);
    mesh.position.set(sourcePos[0], sourcePos[1], sourcePos[2]);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 21;
    const initialScale = reducedMotion ? REDUCED_MOTION_SOURCE_SCALE : SOURCE_SCALE_START;
    mesh.scale.set(initialScale, initialScale, 1);
    return mesh;
  }, [sourceGeo, sourceMat, sourcePos, reducedMotion]);

  const targetMesh = useMemo(() => {
    const mesh = new THREE.Mesh(targetGeo, targetMat);
    mesh.position.set(targetPos[0], targetPos[1], targetPos[2]);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 21;
    const initialScale = reducedMotion ? REDUCED_MOTION_TARGET_SCALE : TARGET_SCALE_START;
    mesh.scale.set(initialScale, initialScale, 1);
    return mesh;
  }, [targetGeo, targetMat, targetPos, reducedMotion]);

  useFrame(() => {
    const ds = gl.domElement.dataset;
    if (reducedMotion) {
      sourceMat.opacity = REDUCED_MOTION_SOURCE_OPACITY;
      targetMat.opacity = REDUCED_MOTION_TARGET_OPACITY;
      sourceMesh.scale.set(REDUCED_MOTION_SOURCE_SCALE, REDUCED_MOTION_SOURCE_SCALE, 1);
      targetMesh.scale.set(REDUCED_MOTION_TARGET_SCALE, REDUCED_MOTION_TARGET_SCALE, 1);
      ds.intraShockwaveActive = '1';
      ds.intraShockwaveSourceOpacity = REDUCED_MOTION_SOURCE_OPACITY.toFixed(3);
      ds.intraShockwaveTargetOpacity = REDUCED_MOTION_TARGET_OPACITY.toFixed(3);
      ds.intraShockwaveSourceScale = REDUCED_MOTION_SOURCE_SCALE.toFixed(3);
      ds.intraShockwaveTargetScale = REDUCED_MOTION_TARGET_SCALE.toFixed(3);
      return;
    }

    const wallClockNowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const wallClockWindowMs = Math.max(
      1,
      event.wallClockExpiresMs - event.wallClockStartMs,
    );
    const progress = clamp01((wallClockNowMs - event.wallClockStartMs) / wallClockWindowMs);

    const sourceOpacity = sourceOpacityFor(progress);
    const targetOpacity = targetOpacityFor(progress);
    const sourceScale = sourceScaleFor(progress);
    const targetScale = targetScaleFor(progress);

    sourceMat.opacity = sourceOpacity;
    targetMat.opacity = targetOpacity;
    sourceMesh.scale.set(sourceScale, sourceScale, 1);
    targetMesh.scale.set(targetScale, targetScale, 1);

    // Visible if either ring still has meaningful opacity.
    const visible = sourceOpacity > 0.01 || targetOpacity > 0.01;
    ds.intraShockwaveActive = visible ? '1' : '0';
    ds.intraShockwaveSourceOpacity = sourceOpacity.toFixed(3);
    ds.intraShockwaveTargetOpacity = targetOpacity.toFixed(3);
    ds.intraShockwaveSourceScale = sourceScale.toFixed(3);
    ds.intraShockwaveTargetScale = targetScale.toFixed(3);
  });

  // Seed dataset attributes immediately on mount so validators that sample
  // before the first useFrame tick (SwiftShader-throttled rAF can be 200-300 ms
  // between frames) see a coherent active=1 reading rather than empty strings
  // left over from a prior latch teardown.
  useEffect(() => {
    const ds = gl.domElement.dataset;
    if (reducedMotion) {
      ds.intraShockwaveActive = '1';
      ds.intraShockwaveSourceOpacity = REDUCED_MOTION_SOURCE_OPACITY.toFixed(3);
      ds.intraShockwaveTargetOpacity = REDUCED_MOTION_TARGET_OPACITY.toFixed(3);
      ds.intraShockwaveSourceScale = REDUCED_MOTION_SOURCE_SCALE.toFixed(3);
      ds.intraShockwaveTargetScale = REDUCED_MOTION_TARGET_SCALE.toFixed(3);
      return;
    }
    const wallClockNowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const wallClockWindowMs = Math.max(
      1,
      event.wallClockExpiresMs - event.wallClockStartMs,
    );
    const progress = clamp01((wallClockNowMs - event.wallClockStartMs) / wallClockWindowMs);
    const sourceOpacity = sourceOpacityFor(progress);
    const targetOpacity = targetOpacityFor(progress);
    const sourceScale = sourceScaleFor(progress);
    const targetScale = targetScaleFor(progress);
    ds.intraShockwaveActive = sourceOpacity > 0.01 || targetOpacity > 0.01 ? '1' : '0';
    ds.intraShockwaveSourceOpacity = sourceOpacity.toFixed(3);
    ds.intraShockwaveTargetOpacity = targetOpacity.toFixed(3);
    ds.intraShockwaveSourceScale = sourceScale.toFixed(3);
    ds.intraShockwaveTargetScale = targetScale.toFixed(3);
  }, [gl, reducedMotion, event.wallClockStartMs, event.wallClockExpiresMs]);

  useEffect(() => () => {
    const ds = gl.domElement.dataset;
    ds.intraShockwaveActive = '0';
    ds.intraShockwaveSourceOpacity = '';
    ds.intraShockwaveTargetOpacity = '';
    ds.intraShockwaveSourceScale = '';
    ds.intraShockwaveTargetScale = '';
    sourceMat.dispose();
    targetMat.dispose();
    sourceGeo.dispose();
    targetGeo.dispose();
  }, [gl, sourceMat, targetMat, sourceGeo, targetGeo]);

  return (
    <group>
      <primitive object={sourceMesh} />
      <primitive object={targetMesh} />
    </group>
  );
}

interface Props {
  vizFrame: VizFrame;
  runtime: RuntimeConfig;
  /** Satellite identity hue; ring motion still distinguishes source and target. */
  identityColorBySatelliteId?: ReadonlyMap<string, string>;
}

export function IntraGroundShockwave({
  vizFrame,
  runtime,
  identityColorBySatelliteId,
}: Props) {
  const event = vizFrame.intraHandoverEvent;
  if (!event) return null;
  const identityColor = identityColorBySatelliteId?.get(event.satId);
  return (
    <IntraGroundShockwaveMesh
      key={event.triggeredAtSec}
      event={event}
      footprintRadius={vizFrame.footprintRadiusWorld}
      reducedMotion={runtime.reducedMotion}
      sourceColor={identityColor ?? INTRA_HANDOVER_SOURCE_COLOR}
      targetColor={identityColor ?? INTRA_HANDOVER_TARGET_COLOR}
    />
  );
}
