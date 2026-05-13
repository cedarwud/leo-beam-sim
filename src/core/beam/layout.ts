/**
 * Hexagonal beam layout generator.
 *
 * Generates concentric hexagonal rings of beams in the local ENU frame
 * relative to the satellite sub-point.
 *
 * Governance:
 *   - SDD: sdd/ntn-sim-core-sdd.md §8 Beam Semantics
 *   - Sources: PAP-2022-SINR-ELEVATION (19-beam hex), PAP-2024-HOBS (37-beam),
 *     PAP-2021-SHADOWED-RICIAN (hexagonal packing geometry)
 *   - Tier: paper-backed
 *   - This file must not import React, Three.js, or scene code.
 */

import type { SatelliteBeamLayout, BeamDefinition } from './types';

/**
 * Generate a hexagonal beam layout.
 *
 * Ring structure:
 *   - Ring 0: 1 beam (center)
 *   - Ring k (k >= 1): 6k beams
 *   - Cumulative: 1, 7, 19, 37, 61, ...
 *
 * Beam spacing uses tight hexagonal packing:
 *   spacing = beamDiameterKm * sqrt(3) / 2
 *
 * FRF coloring:
 *   - FRF=1: all group 0
 *   - FRF=3: deterministic 3-color hexagonal coloring
 *   - FRF=7: deterministic 7-color hexagonal coloring
 */
export function generateHexagonalBeamLayout(config: {
  satId: string;
  numBeams: number;
  beamDiameterKm: number;
  altitudeKm: number;
  frf: number;
}): SatelliteBeamLayout {
  const { satId, numBeams, beamDiameterKm, altitudeKm, frf } = config;

  if (numBeams < 1) {
    throw new Error(`numBeams must be >= 1, got ${numBeams}`);
  }
  if (![1, 3, 7].includes(frf)) {
    throw new Error(`FRF must be 1, 3, or 7, got ${frf}`);
  }

  const spacing = beamDiameterKm * Math.sqrt(3) / 2;

  // Generate hex grid positions as axial coordinates (q, r),
  // then convert to ENU (east, north) km offsets.
  // Axial to cartesian: east = spacing * (q + r/2), north = spacing * r * sqrt(3)/2
  // But for hex rings we use cube coordinates and convert.

  // We'll collect beams as (q, r) axial coords in concentric rings.
  const axialCoords: Array<{ q: number; r: number }> = [];

  // Ring 0: center
  axialCoords.push({ q: 0, r: 0 });

  // Ring k: walk the 6 edges of the hex ring
  // Hex directions in axial: [+1,0], [0,+1], [-1,+1], [-1,0], [0,-1], [+1,-1]
  const directions = [
    { dq: 1, dr: 0 },
    { dq: 0, dr: 1 },
    { dq: -1, dr: 1 },
    { dq: -1, dr: 0 },
    { dq: 0, dr: -1 },
    { dq: 1, dr: -1 },
  ];

  let ring = 1;
  while (axialCoords.length < numBeams) {
    // Start position for ring k: move k steps in direction 4 (0, -1) from center
    // i.e., (0, -k) ... actually start at (ring, 0) and walk edges
    let q = 0;
    let r = -ring;

    for (let side = 0; side < 6; side++) {
      const dir = directions[side];
      for (let step = 0; step < ring; step++) {
        if (axialCoords.length >= numBeams) break;
        axialCoords.push({ q, r });
        q += dir.dq;
        r += dir.dr;
      }
      if (axialCoords.length >= numBeams) break;
    }
    ring++;
  }

  // Truncate to exact numBeams
  const selected = axialCoords.slice(0, numBeams);

  // Convert axial (q, r) to flat-top hex ENU coordinates.
  // For pointy-top hex grid with spacing s between centers:
  //   east  = s * (q + r * 0.5)
  //   north = s * r * (sqrt(3) / 2)
  // But we want the inter-center distance to equal `spacing`.
  // In axial coords with unit size, the distance between adjacent centers is 1.
  // So we just scale by `spacing`.
  const beams: BeamDefinition[] = selected.map((coord, index) => {
    const east = spacing * (coord.q + coord.r * 0.5);
    const north = spacing * coord.r * (Math.sqrt(3) / 2);

    return {
      beamId: `${satId}-b${index}`,
      offsetEastKm: east,
      offsetNorthKm: north,
      isActive: true,
      reuseGroup: assignReuseGroup(coord.q, coord.r, frf),
    };
  });

  return {
    satId,
    beams,
    beamDiameterKm,
    altitudeKm,
  };
}

/**
 * Assign a deterministic frequency reuse group based on axial coordinates.
 *
 * FRF=1: all beams share the same group.
 * FRF=3: 3-color hexagonal coloring using (q - r) mod 3.
 * FRF=7: 7-color hexagonal coloring using (2q + r) mod 7.
 *
 * Source: standard hexagonal frequency reuse coloring from cellular theory,
 * applied to satellite multi-beam as in PAP-2024-HOBS, PAP-2022-SINR-ELEVATION.
 */
function assignReuseGroup(q: number, r: number, frf: number): number {
  if (frf === 1) return 0;
  if (frf === 3) {
    return ((q - r) % 3 + 3) % 3;
  }
  // FRF=7
  return ((2 * q + r) % 7 + 7) % 7;
}
