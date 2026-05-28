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

export interface BeamPowerControlConfig {
  mode: BeamPowerControlMode;
  updatePeriodSec: number;
  stepDb: number;
  minTxPowerDbm: number;
  sinrThresholdDb: number;
}

export interface Shell {
  id: string;
  altitudeKm: number;
  inclinationDeg: number;
  planes: number;
  satsPerPlane: number;
  /** Live-sim initializer: one service-area pass target per plane when satsPerPlane is 1. */
  serviceAreaPassTargetsSec?: number[];
  /** Disable visual-only phase jitter when a profile must keep exact in-plane spacing. */
  phasePerturbation?: boolean;
}

export interface ModqnObjectiveWeights {
  throughput: number;
  handover: number;
  loadBalance: number;
}

export interface ModqnNetworkParams {
  learningRate: number;
  discountGamma: number;
  hiddenDim: number;
  networkDepth: number;
  batchSize: number;
  optimizer: 'Adam' | 'SGD' | 'RMSprop';
  epsilonStart: number;
  epsilonEnd: number;
  targetUpdateTau: number;
  replayBufferSize: number;
  episodes: number;
}

export interface ProfileUeDistribution {
  // Source: modqn-paper-reproduction/docs/modqn-reproduction-assumption-register.md
  // ASSUME-MODQN-REP-022: paper-faithful UE area is uniform-rectangle, 200 km x 90 km.
  mode: 'uniform-rectangle';
  areaWidthKm: number;
  areaHeightKm: number;
  // Source: modqn-paper-reproduction/configs/modqn-paper-baseline.resolved-template.yaml
  // resolved_assumptions.seed_and_rng_policy.value.mobility_seed (ASSUME-MODQN-REP-018).
  seed: number;
  assumptionId: string;
  seedAssumptionId: string;
}

export interface Profile {
  id: string;
  paper: string;
  profileClass: ProfileClass;
  formulaFamily: FormulaFamily;

  orbit: {
    type: 'walker';
    shells: Shell[];
    observerLatDeg: number;
    observerLonDeg: number;
  };

  antenna: {
    model: GainModel;
    maxGainDbi: number;
    /**
     * MODQN paper-faithful profile stores radians for
     * modqn-paper-reproduction/configs/modqn-paper-baseline.resolved-template.yaml
     * resolved_assumptions.beam_geometry.value.theta_3db_deg = 2.0
     * (ASSUME-MODQN-REP-002).
     */
    beamwidth3dBRad: number;
    efficiency: number;
    maxSteeringAngleDeg: number;
    scanLossAtMaxSteeringDb: number;
  };

  ueAntenna: {
    maxGainDbi: number;
  };

  channel: {
    frequencyGHz: number;
    bandwidthMHz: number;
    maxTxPowerDbm: number;
    noisePsdDbmHz: number;
    pathLossComponents: PathLossComponent[];
    lossOverrides?: Partial<ChannelLossOverrides>;
    tr38811?: Partial<Tr38811ChannelConfig>;
    beamPowerControl?: BeamPowerControlConfig;
  };

  handover: {
    policy: 'sinr-offset';
    sinrThresholdDb: number;
    offsetDb: number;
    triggerTimeSec: number;
    pingPongGuardSec: number;
    pendingTargetHoldSec: number;
    intraSwitchTimeSec: number;
    maxIntraSwitchesPerServingEpoch: number;
    sinrSmoothingSec: number;
    modqnWeights?: ModqnObjectiveWeights;
    modqnNetworkParams?: ModqnNetworkParams;
  };

  beams: {
    perSatellite: number;
    maxActivePerSat: number;
    /**
     * Frequency reuse is a live-layout compatibility input. The MODQN paper
     * source files have no frequency-reuse field, so the paper-faithful
     * profile uses 1 and renderer color comes from satellite identity.
     */
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
