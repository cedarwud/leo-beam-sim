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
import type { SinrLiveCellPlacement } from './SinrLiveCellBeamCones';

interface CandidateBeamHighlightProps {
  readonly candidate: RuntimeCandidateHighlightCommand;
  readonly satBeams: Map<string, BeamTarget[]>;
  readonly cellPlacementById?: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly footprintRadius: number;
  readonly reducedMotion: boolean;
}

interface CandidateRing {
  readonly key: string;
  readonly role: 'source' | 'target';
  readonly x: number;
  readonly z: number;
  readonly radius: number;
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
  beamId: number | null,
): { x: number; z: number } | null {
  // S4-2: cell-truth events carry a null steered beamId (the cell id is their
  // identity and resolves via findCellGround); there is no beam to look up.
  if (beamId === null) return null;
  const beams = satBeams.get(satId);
  if (!beams) return null;
  const beam = beams.find(b => b.beamId === beamId);
  if (!beam) return null;
  return { x: beam.groundX, z: beam.groundZ };
}

function findCellGround(
  placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement> | undefined,
  cellId: number | null | undefined,
): { x: number; z: number; radius: number } | null {
  if (placementByCellId === undefined || cellId == null) return null;
  const placement = placementByCellId.get(cellId);
  if (!placement) return null;
  return {
    x: placement.worldX,
    z: placement.worldZ,
    radius: placement.radiusWorld,
  };
}

export function CandidateBeamHighlight({
  candidate,
  satBeams,
  cellPlacementById,
  footprintRadius,
  reducedMotion,
}: CandidateBeamHighlightProps): JSX.Element {
  const gl = useThree(state => state.gl);
  const groupRef = useRef<THREE.Group>(null);

  const rings = useMemo<CandidateRing[]>(() => {
    const out: CandidateRing[] = [];
    const fromCell = candidate.sourceOwner === 'sinr-live-cell-truth'
      ? findCellGround(cellPlacementById, candidate.fromCellId)
      : null;
    const fromBeam = fromCell === null ? findBeamGround(satBeams, candidate.fromSatId, candidate.fromBeamId) : null;
    const from = fromCell ?? (fromBeam ? { ...fromBeam, radius: footprintRadius } : null);
    if (from) {
      out.push({
        key: `source-${candidate.fromSatId}-${candidate.fromCellId ?? candidate.fromBeamId}`,
        role: 'source',
        x: from.x,
        z: from.z,
        radius: from.radius,
        color: HANDOVER_SOURCE_COLOR,
      });
    }
    const toCell = candidate.sourceOwner === 'sinr-live-cell-truth'
      ? findCellGround(cellPlacementById, candidate.toCellId)
      : null;
    const toBeam = toCell === null ? findBeamGround(satBeams, candidate.toSatId, candidate.toBeamId) : null;
    const to = toCell ?? (toBeam ? { ...toBeam, radius: footprintRadius } : null);
    if (to) {
      out.push({
        key: `target-${candidate.toSatId}-${candidate.toCellId ?? candidate.toBeamId}`,
        role: 'target',
        x: to.x,
        z: to.z,
        radius: to.radius,
        color: HANDOVER_TARGET_COLOR,
      });
    }
    return out;
  }, [
    satBeams,
    cellPlacementById,
    footprintRadius,
    candidate.sourceOwner,
    candidate.fromSatId,
    candidate.fromBeamId,
    candidate.fromCellId,
    candidate.toSatId,
    candidate.toBeamId,
    candidate.toCellId,
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

  return (
    <group ref={groupRef} name="candidate-beam-highlight">
      {rings.map(ring => {
        const innerRadius = Math.max(0.1, ring.radius * RING_INNER_FACTOR);
        const outerRadius = ring.radius * RING_OUTER_FACTOR;
        return (
          <mesh
            key={ring.key}
            position={[ring.x, RING_Y_LIFT_WORLD, ring.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={30}
            frustumCulled={false}
            userData={{
              source: candidate.sourceOwner === 'sinr-live-cell-truth'
                ? 'handover-cinema-cell-truth-candidate'
                : 'handover-cinema-candidate',
              role: ring.role,
              eventId: candidate.eventId,
            }}
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
        );
      })}
    </group>
  );
}
