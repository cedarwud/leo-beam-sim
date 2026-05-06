import { useMemo } from 'react';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { BEAM_ROLE_TOKENS, frequencyReuseColor } from '../constants/beamRoleTokens';
import type { BeamTarget } from './SatelliteBeams';

export type CellCoverRole = 'serving' | 'pending' | 'approach' | 'recentSource' | 'otherActive';

export interface CellCoveringBeam {
  beamKey: string;
  satelliteId: string;
  beamId: number;
  satelliteVisualIndex: number;
  satTintColor: string;
  frequencyColor: string;
  role: CellCoverRole;
  roleColor: string;
  isServingOrPending: boolean;
  sinrDb: number | null;
  displayOrder: number;
  debugLabel: string;
}

export interface CellCoverCandidate extends CellCoveringBeam {
  groundX: number;
  groundZ: number;
  footprintRadius: number;
}

export interface CellCoverHysteresisEntry {
  activeBeamKey: string | null;
  candidateBeamKey: string | null;
  ticksHeld: number;
}

export type CellCoverHysteresisState = Map<number, CellCoverHysteresisEntry>;

export interface CellData {
  id: number;
  position: { x: number; z: number };
  radius: number;
  isServed: boolean;
  servingBeamId: number | null;
  coveringBeam?: CellCoveringBeam;
}

export const CELL_COVER_HOLD_TICKS = 2;
export const CELL_COVER_ROLE_PRIORITY: Record<CellCoverRole, number> = {
  serving: 0,
  pending: 1,
  approach: 2,
  recentSource: 3,
  otherActive: 4,
};

export const CELL_COVER_FILL_OPACITY = 0.18;
const HEX_INSCRIBED_RADIUS_FACTOR = Math.cos(Math.PI / 6);

function satelliteDebugLetter(index: number): string {
  const normalized = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return String.fromCharCode(65 + (normalized % 26));
}

export function resolveCellCoverRole(
  beam: Pick<BeamTarget, 'isServing' | 'isScheduledActive' | 'role'>,
): CellCoverRole | null {
  if (!beam.isScheduledActive) return null;
  if (beam.isServing || beam.role === 'serving' || beam.role === 'post-ho') return 'serving';
  if (beam.role === 'prepared') return 'pending';
  if (beam.role === 'approach') return 'approach';
  if (beam.role === 'secondary') return 'recentSource';
  return 'otherActive';
}

export function createCellCoverCandidate(input: {
  satelliteId: string;
  beam: BeamTarget;
  footprintRadius: number;
  displayOrder: number;
}): CellCoverCandidate | null {
  const role = resolveCellCoverRole(input.beam);
  if (!role) return null;

  const satelliteVisualIndex = Number.isFinite(input.beam.satelliteVisualIndex)
    ? input.beam.satelliteVisualIndex
    : input.displayOrder;

  return {
    beamKey: `${input.satelliteId}:B${input.beam.beamId}`,
    satelliteId: input.satelliteId,
    beamId: input.beam.beamId,
    satelliteVisualIndex,
    satTintColor: input.beam.satelliteTintColor,
    frequencyColor: frequencyReuseColor(input.beam.frequencyIndex),
    role,
    roleColor: BEAM_ROLE_TOKENS[role].color,
    isServingOrPending: role === 'serving' || role === 'pending',
    sinrDb: Number.isFinite(input.beam.sinrDb ?? NaN) ? input.beam.sinrDb! : null,
    displayOrder: input.displayOrder,
    debugLabel: `${satelliteDebugLetter(satelliteVisualIndex)}${input.beam.beamId}`,
    groundX: input.beam.groundX,
    groundZ: input.beam.groundZ,
    footprintRadius: input.footprintRadius,
  };
}

export function isCellCoveredByBeam(cell: CellData, beam: CellCoverCandidate): boolean {
  const paddedRadius = beam.footprintRadius + cell.radius * HEX_INSCRIBED_RADIUS_FACTOR;
  return Math.hypot(cell.position.x - beam.groundX, cell.position.z - beam.groundZ) <= paddedRadius;
}

export function selectDominantCellCover(beams: CellCoverCandidate[]): CellCoverCandidate | null {
  if (beams.length === 0) return null;

  return [...beams].sort((left, right) => {
    const roleDelta = CELL_COVER_ROLE_PRIORITY[left.role] - CELL_COVER_ROLE_PRIORITY[right.role];
    if (roleDelta !== 0) return roleDelta;

    const leftSinr = left.sinrDb ?? -Infinity;
    const rightSinr = right.sinrDb ?? -Infinity;
    if (leftSinr !== rightSinr) return rightSinr - leftSinr;

    return left.displayOrder - right.displayOrder || left.beamKey.localeCompare(right.beamKey);
  })[0];
}

export function resolveHexCellCoverAssignments(input: {
  cells: CellData[];
  beams: CellCoverCandidate[];
  hysteresis: CellCoverHysteresisState;
  holdTicks?: number;
}): CellData[] {
  const holdTicks = Math.max(1, Math.floor(input.holdTicks ?? CELL_COVER_HOLD_TICKS));

  return input.cells.map(cell => {
    const covered = input.beams.filter(beam => isCellCoveredByBeam(cell, beam));
    const dominant = selectDominantCellCover(covered);
    const nextBeamKey = dominant?.beamKey ?? null;
    const previous = input.hysteresis.get(cell.id);
    let activeBeamKey = previous?.activeBeamKey ?? null;
    let candidateBeamKey = previous?.candidateBeamKey ?? null;
    let ticksHeld = previous?.ticksHeld ?? 0;

    if (activeBeamKey === null) {
      activeBeamKey = nextBeamKey;
      candidateBeamKey = null;
      ticksHeld = 0;
    } else if (activeBeamKey === nextBeamKey) {
      candidateBeamKey = null;
      ticksHeld = 0;
    } else {
      const continuesCandidate = candidateBeamKey === nextBeamKey;
      candidateBeamKey = nextBeamKey;
      ticksHeld = continuesCandidate ? ticksHeld + 1 : 1;

      if (ticksHeld >= holdTicks) {
        activeBeamKey = nextBeamKey;
        candidateBeamKey = null;
        ticksHeld = 0;
      }
    }

    if (activeBeamKey === null && candidateBeamKey === null) {
      input.hysteresis.delete(cell.id);
    } else {
      input.hysteresis.set(cell.id, { activeBeamKey, candidateBeamKey, ticksHeld });
    }

    const coveringBeam = activeBeamKey
      ? covered.find(beam => beam.beamKey === activeBeamKey)
        ?? input.beams.find(beam => beam.beamKey === activeBeamKey)
      : undefined;

    return {
      ...cell,
      isServed: Boolean(coveringBeam),
      servingBeamId: coveringBeam?.isServingOrPending ? coveringBeam.beamId : null,
      coveringBeam,
    };
  });
}

function createHexagonGeometry(radius: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createHexRingGeometry(outerRadius: number, innerRadius: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * outerRadius;
    const y = Math.sin(angle) * outerRadius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  const hole = new THREE.Path();
  for (let i = 0; i <= 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * innerRadius;
    const y = Math.sin(angle) * innerRadius;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  shape.holes.push(hole);

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createHexBorderPoints(radius: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
  }
  return pts;
}

function CellComponent({ cell, showDebugLabels }: { cell: CellData; showDebugLabels: boolean }) {
  const hexGeo = useMemo(() => createHexagonGeometry(cell.radius), [cell.radius]);
  const borderPts = useMemo(() => createHexBorderPoints(cell.radius), [cell.radius]);
  const outerBorderGeo = useMemo(() => createHexRingGeometry(cell.radius * 1.04, cell.radius * 0.96), [cell.radius]);
  const innerRoleBorderGeo = useMemo(() => createHexRingGeometry(cell.radius * 0.84, cell.radius * 0.78), [cell.radius]);
  const coveringBeam = cell.coveringBeam;
  const fillColor = coveringBeam?.frequencyColor ?? '#1d2f46';
  const fillOpacity = coveringBeam ? CELL_COVER_FILL_OPACITY : 0.08;
  const borderColor = coveringBeam?.satTintColor ?? '#6b7f93';
  const borderOpacity = coveringBeam ? 1 : 0.42;

  return (
    <group position={[cell.position.x, 3, cell.position.z]}>
      <mesh geometry={hexGeo} renderOrder={8}>
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={fillOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {coveringBeam ? (
        <mesh geometry={outerBorderGeo} position={[0, 0.45, 0]} renderOrder={12}>
          <meshBasicMaterial
            color={borderColor}
            transparent
            opacity={borderOpacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ) : (
        <Line
          points={borderPts}
          color={borderColor}
          lineWidth={2}
          transparent
          opacity={borderOpacity}
          dashed
          dashSize={12}
          gapSize={6}
          depthWrite={false}
          renderOrder={12}
        />
      )}
      {coveringBeam?.isServingOrPending && (
        <mesh geometry={innerRoleBorderGeo} position={[0, 0.7, 0]} renderOrder={13}>
          <meshBasicMaterial
            color={coveringBeam.roleColor}
            transparent
            opacity={1}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      )}
      {showDebugLabels && coveringBeam && (
        <Text
          position={[0, 8, 0]}
          fontSize={14}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={1}
          outlineColor="#000000"
        >
          {coveringBeam.debugLabel}
        </Text>
      )}
    </group>
  );
}

export function EarthFixedCells({
  cells,
  showDebugLabels = false,
}: {
  cells: CellData[];
  showDebugLabels?: boolean;
}) {
  return (
    <group>
      {cells.map(cell => (
        <CellComponent key={cell.id} cell={cell} showDebugLabels={showDebugLabels} />
      ))}
    </group>
  );
}

export function generateHexGrid(config: {
  rows: number;
  cols: number;
  cellRadius: number;
  centerX: number;
  centerZ: number;
}): CellData[] {
  const { rows, cols, cellRadius, centerX, centerZ } = config;
  const cells: CellData[] = [];
  const hSpacing = cellRadius * Math.sqrt(3);
  const vSpacing = cellRadius * 1.5;
  const rowOffset = hSpacing / 2;
  const gridW = (cols - 1) * hSpacing + rowOffset;
  const gridH = (rows - 1) * vSpacing;
  const startX = centerX - gridW / 2;
  const startZ = centerZ - gridH / 2;
  let id = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xOff = r % 2 === 1 ? rowOffset : 0;
      cells.push({
        id: id++,
        position: { x: startX + c * hSpacing + xOff, z: startZ + r * vSpacing },
        radius: cellRadius,
        isServed: false,
        servingBeamId: null,
      });
    }
  }
  return cells;
}
