/**
 * Constrained complete-ring beam layouts shared by scientific scenario
 * producers and presentation adapters.
 *
 * The generic layout generator accepts arbitrary positive counts for legacy
 * callers.  The Visual Lab deliberately exposes only complete rings so a
 * number-only control can never create a partial, identity-ambiguous ring.
 */

export const SUPPORTED_BEAM_LAYOUT_COUNTS = Object.freeze([1, 7, 19] as const);
export const DEFAULT_BEAM_LAYOUT_COUNT = 7 as const;

export type SupportedBeamLayoutCount = (typeof SUPPORTED_BEAM_LAYOUT_COUNTS)[number];
export type SupportedBeamLayoutRingCount = 0 | 1 | 2;

export interface CompleteHexBeamPosition {
  readonly beamId: number;
  readonly satelliteId: string;
  readonly tier: number;
  readonly axialQ: number;
  readonly axialR: number;
  readonly u: number;
  readonly v: number;
}

export interface CompleteHexBeamLayout {
  readonly satelliteId: string;
  readonly ringCount: SupportedBeamLayoutRingCount;
  readonly beamCount: SupportedBeamLayoutCount;
  readonly halfPowerBeamWidthDeg: number;
  /** Adjacent boresight spacing on the satellite-frame UV plane. */
  readonly adjacentSpacingUv: number;
  readonly beamPositions: readonly CompleteHexBeamPosition[];
  readonly source:
    | 'complete-hex-ring-project-preset'
    | '3gpp-tr-38.821-table-6.1.1.1-4-topology-and-uv-spacing-metadata';
}

const COUNT_BY_RING = Object.freeze({ 0: 1, 1: 7, 2: 19 } as const);

export function beamCountForCompleteHexRings(ringCount: number): number {
  if (!Number.isInteger(ringCount) || ringCount < 0) {
    throw new RangeError('ringCount must be a non-negative integer');
  }
  return 1 + 3 * ringCount * (ringCount + 1);
}

export function isSupportedBeamLayoutCount(value: number): value is SupportedBeamLayoutCount {
  return (SUPPORTED_BEAM_LAYOUT_COUNTS as readonly number[]).includes(value);
}

export function assertSupportedBeamLayoutCount(value: number): SupportedBeamLayoutCount {
  if (!Number.isInteger(value) || !isSupportedBeamLayoutCount(value)) {
    throw new RangeError('beamCount must be one of 1, 7, or 19');
  }
  return value;
}

export function ringCountForSupportedBeamLayout(
  beamCount: SupportedBeamLayoutCount | number,
): SupportedBeamLayoutRingCount {
  const count = assertSupportedBeamLayoutCount(beamCount);
  if (count === 1) return 0;
  if (count === 7) return 1;
  return 2;
}

export function createCompleteHexBeamLayout(input: {
  readonly satelliteId: string;
  readonly beamCount: SupportedBeamLayoutCount | number;
  readonly halfPowerBeamWidthDeg: number;
}): CompleteHexBeamLayout {
  const satelliteId = input.satelliteId.trim();
  if (satelliteId.length === 0) throw new Error('satelliteId must be non-empty');
  const ringCount = ringCountForSupportedBeamLayout(input.beamCount);
  const halfPowerBeamWidthDeg = input.halfPowerBeamWidthDeg;
  if (!Number.isFinite(halfPowerBeamWidthDeg) || halfPowerBeamWidthDeg <= 0 || halfPowerBeamWidthDeg >= 180) {
    throw new RangeError('halfPowerBeamWidthDeg must be finite and in (0, 180)');
  }

  const halfPowerBeamWidthRad = halfPowerBeamWidthDeg * Math.PI / 180;
  const adjacentSpacingUv = Math.sqrt(3) * Math.sin(halfPowerBeamWidthRad / 2);
  const beamPositions = completeHexAxialPositions(ringCount).map(({ q, r, tier }, beamId) => Object.freeze({
    beamId,
    satelliteId,
    tier,
    axialQ: q,
    axialR: r,
    u: adjacentSpacingUv * (q + r / 2),
    v: adjacentSpacingUv * (Math.sqrt(3) / 2) * r,
  }));

  return Object.freeze({
    satelliteId,
    ringCount,
    beamCount: COUNT_BY_RING[ringCount],
    halfPowerBeamWidthDeg,
    adjacentSpacingUv,
    beamPositions: Object.freeze(beamPositions),
    source: input.beamCount === 19
      ? '3gpp-tr-38.821-table-6.1.1.1-4-topology-and-uv-spacing-metadata'
      : 'complete-hex-ring-project-preset',
  });
}

/** Compatibility name retained for the existing Visual Lab beam-runtime API. */
export const createHexBeamLayout = createCompleteHexBeamLayout;

function completeHexAxialPositions(
  ringCount: SupportedBeamLayoutRingCount,
): readonly { readonly q: number; readonly r: number; readonly tier: number }[] {
  const positions: { q: number; r: number; tier: number }[] = [{ q: 0, r: 0, tier: 0 }];
  for (let tier = 1; tier <= ringCount; tier += 1) {
    const ring: { q: number; r: number; tier: number; angle: number }[] = [];
    for (let q = -tier; q <= tier; q += 1) {
      for (let r = -tier; r <= tier; r += 1) {
        const cubeS = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(cubeS)) !== tier) continue;
        const x = q + r / 2;
        const y = (Math.sqrt(3) / 2) * r;
        ring.push({ q, r, tier, angle: Math.atan2(y, x) });
      }
    }
    ring.sort((left, right) => left.angle - right.angle || left.q - right.q || left.r - right.r);
    positions.push(...ring.map(({ q, r, tier: positionTier }) => ({ q, r, tier: positionTier })));
  }
  return positions;
}
