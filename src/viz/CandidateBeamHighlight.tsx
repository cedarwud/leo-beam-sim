/**
 * Handover-cinema candidate-beam highlight (S1.2).
 *
 * A lane-owned scene layer that lights up the TWO candidate beams of the focused
 * live-walker handover during the cinema: a coloured ground ring around the
 * serving (source) beam footprint and the winner (target) beam footprint, using
 * the same role colours as the existing handover-role beam treatment
 * (`HANDOVER_SOURCE_COLOR` / `HANDOVER_TARGET_COLOR`).
 *
 * Governance / honesty:
 * - Mounted ONLY when the render plan grants `showCandidateHandoverHighlight`
 *   (sinr-live + director cinematic) — it never decides its own lane (Rule#2/#9).
 * - It is display-only: it draws rings at the beam ground positions already
 *   computed by `useBeamViz` (`BeamTarget.groundX/Z`); it reads NO SINR and
 *   alters NO truth (Rule#6).
 * - It publishes a MESH-derived observable (the count of visible ring meshes in
 *   its own subtree) to the canvas dataset, so the validator proves the highlight
 *   actually rendered — not just that a model prop was set (mirrors
 *   `BeamLoadCylinder` / `HandoverStoryLayer`).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type JSX } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HANDOVER_SOURCE_COLOR, HANDOVER_TARGET_COLOR } from '../constants/beamRoleTokens';
import type { BeamTarget } from '../scene/beamTargetTypes';
import type { RuntimeCandidateHighlightCommand } from '../scene/types';

interface CandidateBeamHighlightProps {
  readonly candidate: RuntimeCandidateHighlightCommand;
  readonly satBeams: Map<string, BeamTarget[]>;
  readonly footprintRadius: number;
  readonly reducedMotion: boolean;
}

interface CandidateRing {
  readonly key: string;
  readonly role: 'source' | 'target';
  readonly x: number;
  readonly z: number;
  readonly color: string;
}

const RING_Y_LIFT_WORLD = 0.8;
const RING_INNER_FACTOR = 1.04;
const RING_OUTER_FACTOR = 1.32;
const BASE_OPACITY = 0.7;
// Pulse keeps opacity in (0.48, 0.92) — strictly inside (0, 1) so the headless
// validator's opacity bounds check never sees an exact 0 or 1.
const PULSE_AMP = 0.22;
const PULSE_HZ = 0.85;

function findBeamGround(
  satBeams: Map<string, BeamTarget[]>,
  satId: string,
  beamId: number,
): { x: number; z: number } | null {
  const beams = satBeams.get(satId);
  if (!beams) return null;
  const beam = beams.find(b => b.beamId === beamId);
  if (!beam) return null;
  return { x: beam.groundX, z: beam.groundZ };
}

export function CandidateBeamHighlight({
  candidate,
  satBeams,
  footprintRadius,
  reducedMotion,
}: CandidateBeamHighlightProps): JSX.Element {
  const gl = useThree(state => state.gl);
  const groupRef = useRef<THREE.Group>(null);

  const rings = useMemo<CandidateRing[]>(() => {
    const out: CandidateRing[] = [];
    const from = findBeamGround(satBeams, candidate.fromSatId, candidate.fromBeamId);
    if (from) {
      out.push({
        key: `source-${candidate.fromSatId}-${candidate.fromBeamId}`,
        role: 'source',
        x: from.x,
        z: from.z,
        color: HANDOVER_SOURCE_COLOR,
      });
    }
    const to = findBeamGround(satBeams, candidate.toSatId, candidate.toBeamId);
    if (to) {
      out.push({
        key: `target-${candidate.toSatId}-${candidate.toBeamId}`,
        role: 'target',
        x: to.x,
        z: to.z,
        color: HANDOVER_TARGET_COLOR,
      });
    }
    return out;
  }, [
    satBeams,
    candidate.fromSatId,
    candidate.fromBeamId,
    candidate.toSatId,
    candidate.toBeamId,
  ]);

  // Mesh-derived telemetry: count the actually-visible ring meshes in the subtree
  // and publish to the canvas dataset (catches a broken mesh render a model-prop
  // observable would miss). Intentionally runs EVERY render (no deps): under R3F
  // the child meshes attach to the group across commits, and `groupRef.current` /
  // the live `satBeams`-derived `rings` are not reliably populated on the first
  // mount commit, so a `[rings]`-gated effect can publish a stale 0 and never
  // re-count. Re-running each render keeps the count honest to the live scene.
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    let count = 0;
    group.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh && obj.visible) count += 1;
    });
    gl.domElement.dataset.candidateHandoverHighlightRenderedCount = String(count);
    gl.domElement.dataset.candidateHandoverHighlightRendered = count > 0 ? 'true' : 'false';
  });

  // Clear the flags on unmount so a stale 'true' cannot survive a focus exit /
  // lane switch (the layer unmounts when the render-plan gate drops).
  useEffect(() => () => {
    delete gl.domElement.dataset.candidateHandoverHighlightRenderedCount;
    delete gl.domElement.dataset.candidateHandoverHighlightRendered;
  }, [gl]);

  // Gentle opacity pulse (display-only); reduced-motion holds the static opacity.
  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group || reducedMotion) return;
    const opacity = BASE_OPACITY + PULSE_AMP * Math.sin(clock.elapsedTime * PULSE_HZ * Math.PI * 2);
    group.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (material) material.opacity = opacity;
    });
  });

  const innerRadius = Math.max(0.1, footprintRadius * RING_INNER_FACTOR);
  const outerRadius = footprintRadius * RING_OUTER_FACTOR;

  return (
    <group ref={groupRef} name="candidate-beam-highlight">
      {rings.map(ring => (
        <mesh
          key={ring.key}
          position={[ring.x, RING_Y_LIFT_WORLD, ring.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={30}
          frustumCulled={false}
          userData={{ source: 'handover-cinema-candidate', role: ring.role }}
        >
          <ringGeometry args={[innerRadius, outerRadius, 48]} />
          <meshBasicMaterial
            color={ring.color}
            transparent
            opacity={BASE_OPACITY}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
