export interface LinkSample {
  /** Optional UE identity used to keep the previous served-link state link-owned. */
  ueId?: string;
  satId: string;
  beamId: number;
  rsrpDbm: number;
  sinrDb: number;
  signalDbm: number;
  intraInterferenceDbm: number;
  interInterferenceDbm: number;
  noiseDbm: number;
  denominatorDbm: number;
  txPowerDbm: number;
  pathLossDb: number;
  beamGainDb: number;
  steeringLossDb: number;
  receiverGainDbi: number;
  /**
   * Formula-contract terms in linear units.  The legacy dB fields above stay
   * available to old renderers and diagnostics, but active formula surfaces
   * must read this one-to-one C1-C9 projection.
   */
  angleAware?: AngleAwareLinkTerms;
}

/** Previous published-frame state for one continuously served (u,s,v) link. */
export interface AngleAwarePowerState {
  readonly timeSec: number;
  readonly thetaRad: number;
  readonly transmitGainLinear: number;
  readonly powerW: number;
  readonly segmentStartTimeSec: number;
  readonly segmentStartThetaRad: number;
  readonly segmentStartTransmitGainLinear: number;
  readonly segmentStartPowerW: number;
}

/**
 * Runtime projection of the active simplified EE symbol table.
 *
 * Internal field names are intentionally descriptive; the UI maps them only
 * to the public symbols p, H, G^T, I, σ², γ, B^w, U, R, ξ, P^p, P^N and η.
 */
export interface AngleAwareLinkTerms {
  readonly contractVersion?: string;
  readonly timeSec: number;
  readonly previousTimeSec: number | null;
  readonly previousThetaRad: number | null;
  readonly previousPowerW: number | null;
  readonly previousTransmitGainLinear: number | null;
  readonly segmentStartTimeSec: number;
  readonly segmentStartThetaRad: number;
  readonly segmentStartTransmitGainLinear: number;
  readonly segmentStartPowerW: number;
  readonly thetaRad: number;
  readonly distanceM: number;
  readonly powerW: number;
  /** G^T(θ, θ_3dB) = G_0 · F(θ, θ_3dB), including boresight gain. */
  readonly transmitGainLinear: number;
  /** H(t) = 10^(-L(t)/10) · G^R(t), excluding the transmit pattern. */
  readonly channelGainLinear: number;
  readonly desiredSignalW: number;
  readonly interferenceW: number;
  readonly noiseW: number;
  readonly gammaLinear: number;
  readonly gammaDb: number;
  readonly bandwidthHz: number;
  readonly beamLoad: number;
  readonly throughputBps: number;
  readonly conversionEfficiency: number;
  /** p_(s,v), the maximum served-link RF power on the physical beam. */
  readonly beamPowerW?: number;
  /** P^p_(s,v), the beam RF power after the shared efficiency. */
  readonly beamSupplyPowerW?: number;
  readonly powerConsumptionW: number;
  readonly fixedPowerW: number;
  readonly systemPowerW: number;
  readonly energyEfficiencyBitsPerJoule: number;
}

/** Selected-link view used by the left rail, right rail and scene publisher. */
export interface AngleAwareFormulaFrame {
  readonly ueId: string;
  readonly satId: string;
  readonly beamId: number;
  readonly timeSec: number;
  /** Selected-link x_(u,s,v)(t); the primary-link view is always one. */
  readonly selected: 0 | 1;
  readonly terms: AngleAwareLinkTerms;
}

export type BeamPowerOverrideDbmByKey = ReadonlyMap<string, number>;

export interface ActiveBeamAssignment {
  satId: string;
  beamId: number;
}

export interface SatelliteSnapshot {
  id: string;
  shellId: string;
  altitudeKm: number;
  /** Optional geodetic position used by the angle-aware live geometry path. */
  latDeg?: number;
  lonDeg?: number;
  ecefKm: [number, number, number];
  rangeKm: number;
  elevationDeg: number;
  azimuthDeg: number;
  /** Ground-projected beam cell centers in km offset from observer */
  beamCellsKm: {
    beamId: number;
    offsetEastKm: number;
    offsetNorthKm: number;
    scanAngleDeg: number;
    /** Optional resolved ground boresight identity for exact moving-sat θ. */
    beamCenterLatDeg?: number;
    beamCenterLonDeg?: number;
    /** Optional sampled boresight direction in the current ECEF frame. */
    beamAxisEcefKm?: readonly [number, number, number];
  }[];
}

export interface UEPosition {
  /** Stable user identity for the angle-aware (u,s,v) served-link state. */
  id?: string;
  latDeg: number;
  lonDeg: number;
  /** Offset from observer in km (east, north) — 0,0 = at observer */
  offsetEastKm: number;
  offsetNorthKm: number;
}
