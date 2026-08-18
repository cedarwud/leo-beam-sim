import { buildCellLayout } from '../../engine/cells/cellLayout';

export const VISUAL_LAB_BACKGROUND_CELL_COUNT = 37;

export interface VisualLabHexFieldBounds {
  readonly widthWorld: number;
  readonly depthWorld: number;
}

export interface VisualLabHexFieldCell {
  readonly cellId: number;
  readonly x: number;
  readonly z: number;
}

// Build the exact historical 37-cell footprint ordering, including its wider
// edge cells, at a unit cell radius. This keeps the new clean-canvas renderer
// visually aligned with the established simulator without importing its scene
// state or handover decisions.
const HISTORICAL_UNIT_LAYOUT = buildCellLayout({
  centerLatDeg: 0,
  centerLonDeg: 0,
  altitudeKm: 1,
  beamwidth3dBRad: Math.PI / 2,
  cellCount: VISUAL_LAB_BACKGROUND_CELL_COUNT,
});

function isCompleteHexInsideBounds(
  x: number,
  z: number,
  radiusWorld: number,
  bounds: VisualLabHexFieldBounds,
  paddingWorld: number,
): boolean {
  const halfWidth = bounds.widthWorld / 2 - paddingWorld;
  const halfDepth = bounds.depthWorld / 2 - paddingWorld;
  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    const vx = x + Math.cos(angle) * radiusWorld * 1.04;
    const vz = z + Math.sin(angle) * radiusWorld * 1.04;
    if (Math.abs(vx) > halfWidth || Math.abs(vz) > halfDepth) return false;
  }
  return true;
}

/**
 * Display-only historical cell field. Cells that would be visibly clipped by
 * the substrate edge are omitted instead of drawing partial hexagons outside
 * the NTPU ground model.
 */
export function buildVisualLabHexField(
  radiusWorld: number,
  bounds: VisualLabHexFieldBounds,
  paddingWorld = 0.08,
): readonly VisualLabHexFieldCell[] {
  if (!Number.isFinite(radiusWorld) || radiusWorld <= 0) {
    throw new RangeError('visual-lab hex radiusWorld must be positive');
  }
  if (!Number.isFinite(bounds.widthWorld) || bounds.widthWorld <= 0
    || !Number.isFinite(bounds.depthWorld) || bounds.depthWorld <= 0) {
    throw new RangeError('visual-lab hex field bounds must be positive');
  }
  if (!Number.isFinite(paddingWorld) || paddingWorld < 0) {
    throw new RangeError('visual-lab hex field paddingWorld must be non-negative');
  }

  return Object.freeze(HISTORICAL_UNIT_LAYOUT.centers
    .map(center => Object.freeze({
      cellId: center.cellId,
      x: center.localXKm * radiusWorld,
      z: -center.localYKm * radiusWorld,
    }))
    .filter(cell => isCompleteHexInsideBounds(
      cell.x,
      cell.z,
      radiusWorld,
      bounds,
      paddingWorld,
    )));
}
