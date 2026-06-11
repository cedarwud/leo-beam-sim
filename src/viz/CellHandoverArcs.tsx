import type { JSX } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { CellReassignment } from '../scene/useCellSchedule';
import type { WorldPoint } from './CellFootprints';
import { INTER_HANDOVER_COLOR } from '../constants/beamRoleTokens';

export interface CellHandoverArcsProps {
  readonly reassignments: readonly CellReassignment[];
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly visible?: boolean;
}

interface ArcRenderItem {
  readonly reassignment: CellReassignment;
  readonly color: string;
  readonly label: string;
  readonly points: readonly [number, number, number][];
}

export const INTER_ARC_COLOR = INTER_HANDOVER_COLOR;
export const INTRA_ARC_COLOR = '#76ead7';

const ARC_LIFT_FACTOR = 0.35;
const INTER_ARC_SEGMENTS = 48;
const INTRA_ARC_SEGMENTS = 24;
const INTRA_ARC_HALF_SPAN = 9;
const INTRA_ARC_HEIGHT = 18;
const INTRA_ARC_Y = 1.1;
const ARC_LABEL_FONT_SIZE = 5.8;
const ARC_CAPTION_FONT_SIZE = 7.4;
const ARC_CAPTION_LIFT = 16;
const ARC_CLAIM_BOUNDARY = 'profile-derived overlay';
const ARC_PROOF_STATUS = 'non-proof';
const ARC_SOURCE = 'profile-derived-demo';
// S-ADV-3 honesty caption: the arcs are PROFILE-DERIVED next-slot cell-schedule
// changes, NOT producer-recorded handover events. The per-arc identity labels read
// like real handovers, so the layer carries one explicit visible caption that names
// it a synthetic preview (the non-proof status was previously only in userData).
export const CELL_HANDOVER_ARCS_SYNTHETIC_CAPTION = 'Next-slot cell changes (synthetic preview)';

export function CellHandoverArcs({
  reassignments,
  satelliteWorldById,
  visible = true,
}: CellHandoverArcsProps): JSX.Element | null {
  if (!visible) return null;

  const arcs: ArcRenderItem[] = reassignments.flatMap(reassignment => {
    if (reassignment.kind === 'inter') {
      const from = satelliteWorldById.get(reassignment.fromSatId);
      const to = satelliteWorldById.get(reassignment.toSatId);
      if (!from || !to) return [];
      return [{
        reassignment,
        color: INTER_ARC_COLOR,
        label: buildIdentityLabel(reassignment),
        points: buildInterArcPoints(from, to),
      }];
    }

    const servingSat = satelliteWorldById.get(reassignment.toSatId);
    if (!servingSat) return [];
    return [{
      reassignment,
      color: INTRA_ARC_COLOR,
      label: buildIdentityLabel(reassignment),
      points: buildIntraArcPoints(reassignment.worldX, reassignment.worldZ),
    }];
  });
  const interCount = arcs.filter(arc => arc.reassignment.kind === 'inter').length;
  const intraCount = arcs.filter(arc => arc.reassignment.kind === 'intra').length;
  const captionPosition = buildCaptionPosition(arcs);

  return (
    <group
      name="cell-handover-arcs"
      userData={{
        count: arcs.length,
        interCount,
        intraCount,
        source: ARC_SOURCE,
        claimBoundary: ARC_CLAIM_BOUNDARY,
        proofStatus: ARC_PROOF_STATUS,
        caption: CELL_HANDOVER_ARCS_SYNTHETIC_CAPTION,
      }}
    >
      {arcs.length > 0 && (
        <Text
          name="cell-handover-arcs-caption"
          position={captionPosition}
          fontSize={ARC_CAPTION_FONT_SIZE}
          color="#cbd5f5"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.4}
          outlineColor="#020617"
          userData={{
            source: ARC_SOURCE,
            claimBoundary: ARC_CLAIM_BOUNDARY,
            proofStatus: ARC_PROOF_STATUS,
          }}
        >
          {CELL_HANDOVER_ARCS_SYNTHETIC_CAPTION}
        </Text>
      )}
      {arcs.map(arc => (
        <group
          key={`${arc.reassignment.cellId}-${arc.reassignment.fromSatId}-${arc.reassignment.toSatId}`}
          name={`cell-ho-arc-${arc.reassignment.cellId}`}
          userData={{
            cellId: arc.reassignment.cellId,
            kind: arc.reassignment.kind,
            fromSatId: arc.reassignment.fromSatId,
            fromBeamIndex: arc.reassignment.fromBeamIndex,
            toSatId: arc.reassignment.toSatId,
            toBeamIndex: arc.reassignment.toBeamIndex,
            label: arc.label,
            color: arc.color,
            source: ARC_SOURCE,
            claimBoundary: ARC_CLAIM_BOUNDARY,
            proofStatus: ARC_PROOF_STATUS,
          }}
        >
          <Line
            points={arc.points}
            color={arc.color}
            lineWidth={arc.reassignment.kind === 'inter' ? 2.2 : 2}
            transparent
            opacity={arc.reassignment.kind === 'inter' ? 0.78 : 0.82}
            depthWrite={false}
            renderOrder={23}
            userData={{
              cellId: arc.reassignment.cellId,
              kind: arc.reassignment.kind,
              label: arc.label,
              color: arc.color,
              source: ARC_SOURCE,
              claimBoundary: ARC_CLAIM_BOUNDARY,
              proofStatus: ARC_PROOF_STATUS,
            }}
          />
          <Text
            position={buildArcLabelPosition(arc.points)}
            fontSize={ARC_LABEL_FONT_SIZE}
            color="#f8fafc"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.32}
            outlineColor="#020617"
            userData={{
              cellId: arc.reassignment.cellId,
              kind: arc.reassignment.kind,
              label: arc.label,
              source: ARC_SOURCE,
              claimBoundary: ARC_CLAIM_BOUNDARY,
              proofStatus: ARC_PROOF_STATUS,
            }}
          >
            {arc.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

function buildIdentityLabel(reassignment: CellReassignment): string {
  return `${reassignment.fromSatId}/${reassignment.fromBeamIndex} -> ${reassignment.toSatId}/${reassignment.toBeamIndex}`;
}

// Centroid of the arc label positions, lifted clear above the cluster so the
// synthetic-preview caption sits over the arcs without overlapping the identity
// labels. Falls back to a fixed overhead point when no arc geometry resolves.
function buildCaptionPosition(arcs: readonly ArcRenderItem[]): [number, number, number] {
  const labelPositions = arcs.map(arc => buildArcLabelPosition(arc.points));
  if (labelPositions.length === 0) return [0, INTRA_ARC_Y + INTRA_ARC_HEIGHT + ARC_CAPTION_LIFT, 0];
  let sumX = 0;
  let maxY = -Infinity;
  let sumZ = 0;
  for (const [x, y, z] of labelPositions) {
    sumX += x;
    sumZ += z;
    if (y > maxY) maxY = y;
  }
  return [sumX / labelPositions.length, maxY + ARC_CAPTION_LIFT, sumZ / labelPositions.length];
}

function buildArcLabelPosition(points: readonly [number, number, number][]): [number, number, number] {
  const midpoint = points[Math.floor(points.length / 2)];
  if (!midpoint) return [0, INTRA_ARC_Y + INTRA_ARC_HEIGHT, 0];
  return [midpoint[0], midpoint[1] + 3.8, midpoint[2]];
}

function buildInterArcPoints(from: WorldPoint, to: WorldPoint): readonly [number, number, number][] {
  const curve = buildArcCurve(
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  );

  return Array.from({ length: INTER_ARC_SEGMENTS + 1 }, (_, index) => {
    const point = curve.getPoint(index / INTER_ARC_SEGMENTS);
    return [point.x, point.y, point.z];
  });
}

function buildIntraArcPoints(worldX: number, worldZ: number): readonly [number, number, number][] {
  const from = new THREE.Vector3(worldX - INTRA_ARC_HALF_SPAN, INTRA_ARC_Y, worldZ);
  const mid = new THREE.Vector3(worldX, INTRA_ARC_Y + INTRA_ARC_HEIGHT, worldZ);
  const to = new THREE.Vector3(worldX + INTRA_ARC_HALF_SPAN, INTRA_ARC_Y, worldZ);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);

  return Array.from({ length: INTRA_ARC_SEGMENTS + 1 }, (_, index) => {
    const point = curve.getPoint(index / INTRA_ARC_SEGMENTS);
    return [point.x, point.y, point.z];
  });
}

function buildArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = from.clone().lerp(to, 0.5);
  const distance = from.distanceTo(to);
  mid.y += distance * ARC_LIFT_FACTOR;
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}
