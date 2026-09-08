export type GainModel = 'bessel-j1-j3' | 'bessel-j1' | 'flat';
export type ProfileClass = 'paper-default' | 'candidate-rich';
export type BeamHoppingScheduler = 'round-robin' | 'distance-priority';
export type FormulaFamily = 'hobs-legacy' | 'hobs-tr38811';
export type BeamPowerControlMode = 'dpc';
export type PathLossComponent = 'fspl' | 'atmospheric' | 'scintillation' | 'shadow-fading';
export type Tr38811LosEnvironment = 'suburban';

export interface UeMobilityWaypoint {
  timeSec: number;
  latDeg: number;
  lonDeg: number;
}

export interface UeMobility {
  type: 'waypoints';
  waypoints: UeMobilityWaypoint[];
  interpolation: 'linear';
  generator?: string;
}

export interface ChannelLossOverrides {
  atmosphericZenithLossDb: number;
  scintillationScaleDb: number;
  shadowFadingMarginDb: number;
}

export interface Tr38811ChannelConfig {
  environment: Tr38811LosEnvironment;
  nlosClutterLossDb: number;
}

export const DEFAULT_CHANNEL_LOSS_OVERRIDES: ChannelLossOverrides = {
  atmosphericZenithLossDb: 0.1,
  scintillationScaleDb: 0.05,
  shadowFadingMarginDb: 2,
};

export const DEFAULT_TR38811_CHANNEL: Tr38811ChannelConfig = {
  environment: 'suburban',
  nlosClutterLossDb: 20,
};

/** Default per-beam transmit power P_t when a profile omits it, in dBm. */
export const DEFAULT_MAX_TX_POWER_DBM = 20;

export interface BeamPowerControlConfig {
  mode: BeamPowerControlMode;
  updatePeriodSec: number;
  stepDb: number;
  minTxPowerDbm: number;
  sinrThresholdDb: number;
}

export interface ChannelConfig {
  frequencyGHz: number;
  bandwidthMHz: number;
  /** Base per-beam transmit power P_t; omitted profiles use DEFAULT_MAX_TX_POWER_DBM. */
  maxTxPowerDbm?: number;
  noisePsdDbmHz: number;
  pathLossComponents: PathLossComponent[];
  lossOverrides?: Partial<ChannelLossOverrides>;
  tr38811?: Partial<Tr38811ChannelConfig>;
  beamPowerControl?: BeamPowerControlConfig;
}

export function resolveMaxTxPowerDbm(
  channel: Pick<ChannelConfig, 'maxTxPowerDbm'>,
): number {
  return channel.maxTxPowerDbm ?? DEFAULT_MAX_TX_POWER_DBM;
}

/**
 * The paper-style EE readout uses the load-dependent per-beam power surface
 * from (3.37). It is profile-backed so the panel never hides these constants
 * in a UI or utility literal. `publishedReferenceMbitsPerJoule` is the
 * current Chapter 5 comparison anchor, not a claim that this live scene
 * reproduces the paper experiment. The `ch5Demo*` fields are a temporary,
 * display-only operating-point projection; they do not change live link truth.
 */
export interface PaperEnergyEfficiencyConfig {
  beamPowerBaseW: number;
  beamPowerLoadScaleW: number;
  beamPowerLoadExponent: number;
  beamPowerMaxW: number;
  publishedReferenceMbitsPerJoule: number;
  ch5DemoBandwidthMHz: number;
  ch5DemoFrequencyReuse: number;
}

export interface Shell {
  id: string;
  altitudeKm: number;
  inclinationDeg: number;
  planes: number;
  satsPerPlane: number;
  /** Optional Walker plane rotation used by candidate-rich sensitivity profiles. */
  raanOffsetDeg?: number;
  /** Optional along-track phase rotation used by candidate-rich sensitivity profiles. */
  phaseOffsetDeg?: number;
  /** Live-sim initializer: one service-area pass target per plane when satsPerPlane is 1. */
  serviceAreaPassTargetsSec?: number[];
  /** Disable visual-only phase jitter when a profile must keep exact in-plane spacing. */
  phasePerturbation?: boolean;
}

export interface ProfileUeDistribution {
  mode: 'uniform-rectangle';
  areaWidthKm: number;
  areaHeightKm: number;
  seed: number;
  assumptionId: string;
  seedAssumptionId: string;
}

export interface Profile {
  id: string;
  paper: string;
  profileClass: ProfileClass;
  formulaFamily: FormulaFamily;
  energyEfficiency?: {
    paper: PaperEnergyEfficiencyConfig;
  };

  orbit: {
    type: 'walker';
    /**
     * Deterministic Walker phase-jitter seed. Shipped profiles must state this
     * explicitly so accepted scientific frames never depend on the orbit
     * generator's legacy omitted-seed fallback.
     */
    constellationSeed: number;
    shells: Shell[];
    observerLatDeg: number;
    observerLonDeg: number;
  };

  antenna: {
    model: GainModel;
    maxGainDbi: number;
    beamwidth3dBRad: number;
    efficiency: number;
    maxSteeringAngleDeg: number;
    scanLossAtMaxSteeringDb: number;
  };

  ueAntenna: {
    maxGainDbi: number;
  };

  channel: ChannelConfig;

  handover: {
    policy: 'sinr-offset';
    sinrThresholdDb: number;
    offsetDb: number;
    /** Teaching/readability floor: do not select a replacement with fewer than this many distinct alternate satellites. */
    minimumDistinctCandidateSatellites?: number;
    triggerTimeSec: number;
    pingPongGuardSec: number;
    pendingTargetHoldSec: number;
    intraSwitchTimeSec: number;
    maxIntraSwitchesPerServingEpoch: number;
    sinrSmoothingSec: number;
  };

  beams: {
    perSatellite: number;
    maxActivePerSat: number;
    frequencyReuse: number;
  };

  beamHopping: {
    enabled: boolean;
    slotSec: number;
    maxActiveBeamsPerSlot: number;
    scheduler: BeamHoppingScheduler;
    frameLengthSlots: number;
  };

  /** Pre-calculated or manually selected start time for the demo */
  demoStartOffsetSec?: number;
  ueMobility?: UeMobility;
  ueDistribution?: ProfileUeDistribution;
}
