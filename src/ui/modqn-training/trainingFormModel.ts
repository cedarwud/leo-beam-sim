import type {
  SensitivitySweepRequest,
  TrainingArm,
  TrainingProfile,
  TrainingRequest,
  TrainingRequestMode,
} from '../../modqn/training-trigger/types';

export const EPISODES_BACKEND_CAP = 5000;
export const QUICK_EPISODES = 100;
export const FULL_EPISODES = 5000;
export const SWEEP_AXIS_OPTIONS = [
  { path: 'track2.envAxes.nSatellites', label: 'satellites' },
  { path: 'track2.envAxes.nUsers', label: 'UE count' },
  { path: 'track2.envAxes.userSpeedKmh', label: 'UE speed' },
  { path: 'track2.envAxes.antiCollapseMaxUsersPerBeam', label: 'capacity cap' },
  { path: 'track2.envAxes.qosThresholdBps', label: 'QoS bps' },
  { path: 'track2.hobsConfig.gammaOsDb', label: 'γ_os dB' },
  { path: 'track2.hobsConfig.tThresholdSteps', label: 'T threshold' },
] as const;

const EVALUATION_SWEEP_AXES = new Set<string>([
  'track2.envAxes.nSatellites',
  'track2.envAxes.nUsers',
  'track2.envAxes.userSpeedKmh',
  'track2.hobsConfig.gammaOsDb',
]);

export type SubmissionMode = 'single' | 'sweep';
export type SweepAxisPath = typeof SWEEP_AXIS_OPTIONS[number]['path'];

export interface FormState {
  submissionMode: SubmissionMode;
  trainingProfile: TrainingProfile;
  arm: TrainingArm;
  requestMode: TrainingRequestMode;
  episodes: number;
  learningRate: number;
  discountGamma: number;
  hiddenDim: number;
  batchSize: number;
  omegaThroughput: number;
  omegaHandover: number;
  omegaLoadBalance: number;
  seedTrain: number;
  seedEnvironment: number;
  seedMobility: number;
  nSatellites: number;
  altitudeKm: number;
  satelliteSpeedKmS: number;
  nUsers: number;
  userSpeedKmh: number;
  antiCollapseMaxUsersPerBeam: number;
  qosThresholdBps: number;
  ueDistribution: 'uniform-circular' | 'uniform-rectangle';
  ueRadiusKm: number;
  ueWidthKm: number;
  ueHeightKm: number;
  ueMobilityModel: 'deterministic-heading' | 'random-wandering';
  ueRandomWanderingMaxTurnRad: number;
  beamsPerSatellite: number;
  theta3dbDeg: number;
  carrierFrequencyGhz: number;
  bandwidthMhz: number;
  txPowerW: number;
  ricianKDb: number;
  atmosphericAttenuationDbPerKm: number;
  gammaOsDb: number;
  tThresholdSteps: number;
  eHoPerEventJ: number;
  catfishAlpha: number;
  quotaEe: number;
  quotaHo: number;
  quotaLoad: number;
  mainShareFloor: number;
  vdnLossScale: number;
  snapshotBatchSize: number;
  softmaxTemperature: number;
  evalOnlyQosThresholds: string;
  preRegSddPath: string;
  preRegSddSha256: string;
  preRegJsonPath: string;
  preRegJsonSha256: string;
  sweepAxis: SweepAxisPath;
  sweepValues: string;
}

export const DEFAULT_FORM_STATE: FormState = {
  submissionMode: 'single',
  trainingProfile: 'track2',
  arm: 'a1',
  requestMode: 'exploration',
  episodes: 1000,
  learningRate: 0.001,
  discountGamma: 0.9,
  hiddenDim: 100,
  batchSize: 128,
  omegaThroughput: 0.4,
  omegaHandover: 0.3,
  omegaLoadBalance: 0.3,
  seedTrain: 42,
  seedEnvironment: 1337,
  seedMobility: 7,
  nSatellites: 4,
  altitudeKm: 780,
  satelliteSpeedKmS: 7.4,
  nUsers: 100,
  userSpeedKmh: 30,
  antiCollapseMaxUsersPerBeam: 25,
  qosThresholdBps: 1_000_000,
  ueDistribution: 'uniform-rectangle',
  ueRadiusKm: 50,
  ueWidthKm: 200,
  ueHeightKm: 90,
  ueMobilityModel: 'deterministic-heading',
  ueRandomWanderingMaxTurnRad: 0.7853981633974483,
  beamsPerSatellite: 7,
  theta3dbDeg: 2,
  carrierFrequencyGhz: 20,
  bandwidthMhz: 500,
  txPowerW: 2,
  ricianKDb: 20,
  atmosphericAttenuationDbPerKm: 0.05,
  gammaOsDb: 6,
  tThresholdSteps: 5,
  eHoPerEventJ: 150,
  catfishAlpha: 0.2,
  quotaEe: 3,
  quotaHo: 3,
  quotaLoad: 2,
  mainShareFloor: 0.875,
  vdnLossScale: 10,
  snapshotBatchSize: 128,
  softmaxTemperature: 0.5,
  evalOnlyQosThresholds: '5000,15000,50000,1000000',
  preRegSddPath: '',
  preRegSddSha256: '',
  preRegJsonPath: '',
  preRegJsonSha256: '',
  sweepAxis: 'track2.envAxes.nUsers',
  sweepValues: '50,100,150',
};

export function canonicalTrainerSubcommand(arm: TrainingArm): 'baseline' | 'multi-catfish' {
  return arm === 'a1' ? 'baseline' : 'multi-catfish';
}

export function parseSweepValues(raw: string): number[] {
  return raw
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isFinite(value));
}

export function buildRequest(state: FormState): TrainingRequest {
  const evalOnlyQosThresholds = parseSweepValues(state.evalOnlyQosThresholds);
  const hyperparams = {
    episodes: state.episodes,
    learningRate: state.learningRate,
    discountGamma: state.discountGamma,
    hiddenDim: state.hiddenDim,
    batchSize: state.batchSize,
    objectiveWeights: {
      throughput: state.omegaThroughput,
      handover: state.omegaHandover,
      loadBalance: state.omegaLoadBalance,
    },
    seedTriplet: [
      Math.trunc(state.seedTrain),
      Math.trunc(state.seedEnvironment),
      Math.trunc(state.seedMobility),
    ] as const,
  };

  if (state.trainingProfile === 'legacy-baseline') {
    return {
      trainingProfile: 'legacy-baseline',
      trainerSubcommand: 'baseline',
      hyperparams,
    };
  }

  const multiCatfishV2 = state.arm === 'a1'
    ? undefined
    : {
        catfishEnabled: true,
        catfishAlpha: state.catfishAlpha,
        quotaEe: state.quotaEe,
        quotaHo: state.quotaHo,
        quotaLoad: state.quotaLoad,
        mainShareFloor: state.mainShareFloor,
        vdnLossScale: state.vdnLossScale,
        vdnPooling: 'mean',
        identityMode: 'one_hot',
        snapshotBatchSize: state.snapshotBatchSize,
        featureNormalization: true,
        softmaxTemperature: state.softmaxTemperature,
      } as const;
  const hobsConfig = state.arm === 'a5_hobs'
    ? {
        gammaOsDb: state.gammaOsDb,
        tThresholdSteps: state.tThresholdSteps,
        eHoPerEventJ: state.eHoPerEventJ,
      }
    : undefined;
  const evaluationProvenance = state.requestMode === 'evaluation'
    ? {
        preRegSddPath: state.preRegSddPath,
        preRegSddSha256: state.preRegSddSha256,
        preRegJsonPath: state.preRegJsonPath,
        preRegJsonSha256: state.preRegJsonSha256,
      }
    : undefined;

  const track2: NonNullable<TrainingRequest['track2']> = {
    arm: state.arm,
    r1RewardMode: 'angle_aware_ee',
    requestMode: state.requestMode,
    envAxes: {
      nSatellites: state.nSatellites,
      altitudeKm: state.altitudeKm,
      satelliteSpeedKmS: state.satelliteSpeedKmS,
      nUsers: state.nUsers,
      userSpeedKmh: state.userSpeedKmh,
      antiCollapseMaxUsersPerBeam: state.antiCollapseMaxUsersPerBeam,
      qosThresholdBps: state.qosThresholdBps,
      ueArea: state.ueDistribution === 'uniform-rectangle'
        ? {
            distribution: 'uniform-rectangle',
            widthKm: state.ueWidthKm,
            heightKm: state.ueHeightKm,
            mobilityModel: state.ueMobilityModel,
            randomWanderingMaxTurnRad: state.ueRandomWanderingMaxTurnRad,
          }
        : {
            distribution: 'uniform-circular',
            radiusKm: state.ueRadiusKm,
            mobilityModel: state.ueMobilityModel,
            randomWanderingMaxTurnRad: state.ueRandomWanderingMaxTurnRad,
          },
      antenna: {
        beamsPerSatellite: 7,
        theta3dbDeg: state.theta3dbDeg,
      },
      channel: {
        carrierFrequencyGhz: state.carrierFrequencyGhz,
        bandwidthMhz: state.bandwidthMhz,
        txPowerW: state.txPowerW,
        ricianKDb: state.ricianKDb,
        atmosphericAttenuationDbPerKm: state.atmosphericAttenuationDbPerKm,
      },
    },
    ...(multiCatfishV2 === undefined ? {} : { multiCatfishV2 }),
    ...(hobsConfig === undefined ? {} : { hobsConfig }),
    ...(evaluationProvenance === undefined ? {} : { evaluationProvenance }),
    ...(state.requestMode === 'evaluation' && evalOnlyQosThresholds.length > 0
      ? { evalOnlyAxes: { 'track2.envAxes.qosThresholdBps': evalOnlyQosThresholds } }
      : {}),
  };

  return {
    trainingProfile: 'track2',
    trainerSubcommand: canonicalTrainerSubcommand(state.arm),
    hyperparams,
    track2,
  };
}

export function buildSweepRequest(state: FormState): SensitivitySweepRequest {
  return {
    requestMode: state.requestMode,
    baseRequest: buildRequest(state),
    matrix: {
      axes: [
        {
          path: state.sweepAxis,
          values: parseSweepValues(state.sweepValues),
        },
      ],
      mode: 'single-axis-from-base',
    },
    seeds: [[
      Math.trunc(state.seedTrain),
      Math.trunc(state.seedEnvironment),
      Math.trunc(state.seedMobility),
    ]],
  };
}

export function summarize(state: FormState): string {
  const profile = state.trainingProfile === 'track2' ? `track2/${state.arm}` : 'legacy-baseline';
  return `${profile}, ep=${state.episodes}, env=(${state.nSatellites} sat, ${state.nUsers} UE), ω=(${state.omegaThroughput},${state.omegaHandover},${state.omegaLoadBalance})`;
}

export function validationMessage(state: FormState): string | null {
  if (state.episodes > EPISODES_BACKEND_CAP) return `Backend caps episodes at ${EPISODES_BACKEND_CAP}.`;
  if (state.trainingProfile === 'track2' && state.beamsPerSatellite !== 7) {
    return 'Track-2 producer currently accepts exactly 7 beams per satellite.';
  }
  if (state.submissionMode === 'sweep') {
    if (state.trainingProfile !== 'track2') return 'Sensitivity sweep requires the Track-2 profile.';
    const parsedValues = parseSweepValues(state.sweepValues);
    const rawValueCount = state.sweepValues.split(',').filter(value => value.trim().length > 0).length;
    if (parsedValues.length === 0 || parsedValues.length !== rawValueCount) {
      return 'Sensitivity sweep values must be a comma-separated numeric list.';
    }
    if (state.sweepAxis.startsWith('track2.hobsConfig') && state.arm !== 'a5_hobs') {
      return 'HOBS sweep axes require arm a5_hobs.';
    }
    if (state.requestMode === 'evaluation' && !EVALUATION_SWEEP_AXES.has(state.sweepAxis)) {
      return 'Evaluation sweeps must use the SDD09 pre-registered axis set.';
    }
  }
  if (state.requestMode === 'evaluation') {
    const qosRawCount = state.evalOnlyQosThresholds.split(',').filter(value => value.trim().length > 0).length;
    const qosValues = parseSweepValues(state.evalOnlyQosThresholds);
    if (qosValues.length === 0 || qosValues.length !== qosRawCount) {
      return 'Evaluation QoS tiers must be a comma-separated numeric list.';
    }
  }
  if (state.requestMode === 'evaluation') {
    const missing = [
      state.preRegSddPath,
      state.preRegSddSha256,
      state.preRegJsonPath,
      state.preRegJsonSha256,
    ].some(value => value.trim().length === 0);
    if (missing) return 'Evaluation mode requires pre-registration paths and SHA-256 values.';
  }
  return null;
}

