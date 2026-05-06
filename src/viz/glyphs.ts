import * as THREE from 'three';

export type GlyphKind = 'triangle' | 'diamond' | 'circle' | 'star';

export interface SatelliteGlyphSpec {
  kind: GlyphKind;
  symbol: string;
}

export const SATELLITE_GLYPH_LIBRARY = [
  { kind: 'triangle', symbol: '▲' },
  { kind: 'diamond', symbol: '◆' },
  { kind: 'circle', symbol: '●' },
  { kind: 'star', symbol: '★' },
] as const satisfies readonly SatelliteGlyphSpec[];

function pointsForGlyph(kind: GlyphKind, radius: number): THREE.Vector2[] {
  switch (kind) {
    case 'triangle':
      return [0, 1, 2].map(index => {
        const angle = -Math.PI / 2 + (index / 3) * Math.PI * 2;
        return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
      });
    case 'diamond':
      return [
        new THREE.Vector2(0, -radius),
        new THREE.Vector2(radius, 0),
        new THREE.Vector2(0, radius),
        new THREE.Vector2(-radius, 0),
      ];
    case 'circle':
      return Array.from({ length: 32 }, (_, index) => {
        const angle = (index / 32) * Math.PI * 2;
        return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
      });
    case 'star':
      return Array.from({ length: 10 }, (_, index) => {
        const starRadius = index % 2 === 0 ? radius : radius * 0.46;
        const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
        return new THREE.Vector2(Math.cos(angle) * starRadius, Math.sin(angle) * starRadius);
      });
  }
}

export function satelliteGlyphIndex(displayOrder: number): number {
  const order = Number.isFinite(displayOrder) ? Math.floor(displayOrder) : 0;
  return ((order % SATELLITE_GLYPH_LIBRARY.length) + SATELLITE_GLYPH_LIBRARY.length) % SATELLITE_GLYPH_LIBRARY.length;
}

export function satelliteGlyph(displayOrder: number): GlyphKind {
  return SATELLITE_GLYPH_LIBRARY[satelliteGlyphIndex(displayOrder)].kind;
}

export function glyphSymbolForKind(kind: GlyphKind): string {
  return SATELLITE_GLYPH_LIBRARY.find(entry => entry.kind === kind)?.symbol ?? '?';
}

export function createGlyphFillGeometry(kind: GlyphKind, radius: number): THREE.BufferGeometry {
  if (kind === 'circle') return new THREE.CircleGeometry(radius, 32);

  const points = pointsForGlyph(kind, radius);
  const shape = new THREE.Shape(points);
  return new THREE.ShapeGeometry(shape);
}

export function createGlyphOutlinePoints(kind: GlyphKind, radius: number): [number, number, number][] {
  const points = pointsForGlyph(kind, radius);
  const closed = [...points, points[0]];
  return closed.map(point => [point.x, point.y, 0]);
}
