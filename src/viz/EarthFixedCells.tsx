import { useMemo } from 'react';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';

export interface CellData {
  id: number;
  position: { x: number; z: number };
  radius: number;
  isServed: boolean;
  servingBeamId: number | null;
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

function createHexBorderPoints(radius: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
  }
  return pts;
}

function CellComponent({ cell }: { cell: CellData }) {
  const hexGeo = useMemo(() => createHexagonGeometry(cell.radius), [cell.radius]);
  const borderPts = useMemo(() => createHexBorderPoints(cell.radius), [cell.radius]);
  const color = cell.isServed ? '#44aaff' : '#aaaaaa';
  const opacity = cell.isServed ? 0.5 : 0.25;

  return (
    <group position={[cell.position.x, 3, cell.position.z]}>
      <mesh geometry={hexGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Line
        points={borderPts}
        color={color}
        lineWidth={cell.isServed ? 4 : 2.5}
        transparent
        opacity={cell.isServed ? 1 : 0.7}
        dashed={!cell.isServed}
        dashSize={12}
        gapSize={6}
        depthWrite={false}
      />
      <Text
        position={[0, 8, 0]}
        fontSize={14}
        color={cell.isServed ? '#ffffff' : '#aaccff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={1}
        outlineColor="#000000"
      >
        {`C${cell.id}`}
      </Text>
    </group>
  );
}

export function EarthFixedCells({ cells }: { cells: CellData[] }) {
  return (
    <group>
      {cells.map(cell => (
        <CellComponent key={cell.id} cell={cell} />
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
