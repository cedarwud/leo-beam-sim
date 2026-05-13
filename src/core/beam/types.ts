/**
 * Beam module type definitions.
 *
 * Governance:
 *   - SDD: sdd/ntn-sim-core-sdd.md §8 Beam Semantics, §9.2.2 Beam-Gain Mapping
 *   - Constraints: sdd/ntn-sim-core-development-constraints.md §3, §4
 *   - This file must not import React, Three.js, or scene code.
 */

/** A single beam definition within a satellite's beam layout. */
export interface BeamDefinition {
  beamId: string;
  /** Offset from satellite sub-point in km (east, north). */
  offsetEastKm: number;
  offsetNorthKm: number;
  /** Whether beam is currently active (for BH scheduling). */
  isActive: boolean;
  /** Frequency reuse group index. */
  reuseGroup: number;
}

/** Full beam layout for a satellite. */
export interface SatelliteBeamLayout {
  satId: string;
  beams: BeamDefinition[];
  beamDiameterKm: number;
  altitudeKm: number;
}

/** Result of beam selection for a UE. */
export interface BeamSelectionResult {
  bestBeamId: string;
  offAxisAngleDeg: number;
  beamGainDbi: number;
  /** All beams with their off-axis angles (for interference). */
  allBeams: Array<{
    beamId: string;
    offAxisAngleDeg: number;
    reuseGroup: number;
  }>;
}

/** Active beam state for beam hopping / scheduling. */
export interface ActiveBeamState {
  satId: string;
  activeBeamIds: Set<string>;
  slotIndex: number;
}
