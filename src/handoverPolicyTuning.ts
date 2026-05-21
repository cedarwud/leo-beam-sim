import type {
  ModqnNetworkParams,
  ModqnObjectiveWeights,
  Profile,
} from './profiles/types';

export type { ModqnNetworkParams, ModqnObjectiveWeights } from './profiles/types';

const MODQN_OBJECTIVE_WEIGHTS_DEFAULT: ModqnObjectiveWeights = {
  throughput: 0.4,
  handover: 0.3,
  loadBalance: 0.3,
};

const MODQN_NETWORK_DEFAULTS: ModqnNetworkParams = {
  learningRate: 1e-3,
  discountGamma: 0.99,
  hiddenDim: 128,
  networkDepth: 2,
  batchSize: 64,
  optimizer: 'Adam',
  epsilonStart: 1,
  epsilonEnd: 0.05,
  targetUpdateTau: 0.01,
  replayBufferSize: 50_000,
  episodes: 100,
};

const MODQN_NETWORK_PARAM_MIN_MAX: Record<keyof ModqnNetworkParams, readonly [number, number]> = {
  learningRate: [1e-5, 1e-1],
  discountGamma: [0.8, 0.999],
  hiddenDim: [16, 512],
  networkDepth: [1, 5],
  batchSize: [8, 512],
  optimizer: [0, 2],
  epsilonStart: [0, 1],
  epsilonEnd: [0, 1],
  targetUpdateTau: [1e-4, 1],
  replayBufferSize: [1_000, 500_000],
  episodes: [1, 10_000],
};

export type HandoverPolicyTuningState = Omit<Profile['handover'], 'modqnWeights' | 'modqnNetworkParams'> & {
  modqnWeights: ModqnObjectiveWeights;
  modqnNetworkParams: ModqnNetworkParams;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeObjectiveWeights(weights?: Profile['handover']['modqnWeights']): ModqnObjectiveWeights {
  return {
    throughput: weights?.throughput === undefined || !Number.isFinite(weights.throughput)
      ? MODQN_OBJECTIVE_WEIGHTS_DEFAULT.throughput
      : clamp(weights.throughput, 0, 1),
    handover: weights?.handover === undefined || !Number.isFinite(weights.handover)
      ? MODQN_OBJECTIVE_WEIGHTS_DEFAULT.handover
      : clamp(weights.handover, 0, 1),
    loadBalance: weights?.loadBalance === undefined || !Number.isFinite(weights.loadBalance)
      ? MODQN_OBJECTIVE_WEIGHTS_DEFAULT.loadBalance
      : clamp(weights.loadBalance, 0, 1),
  };
}

export function normalizeModqnNetworkParams(
  networkParams?: Profile['handover']['modqnNetworkParams'],
): ModqnNetworkParams {
  const optimizerValue = networkParams?.optimizer;
  const optimizer = optimizerValue === 'Adam' || optimizerValue === 'SGD' || optimizerValue === 'RMSprop'
    ? optimizerValue
    : MODQN_NETWORK_DEFAULTS.optimizer;

  return {
    learningRate: clamp(networkParams?.learningRate ?? MODQN_NETWORK_DEFAULTS.learningRate, ...MODQN_NETWORK_PARAM_MIN_MAX.learningRate),
    discountGamma: clamp(networkParams?.discountGamma ?? MODQN_NETWORK_DEFAULTS.discountGamma, ...MODQN_NETWORK_PARAM_MIN_MAX.discountGamma),
    hiddenDim: Math.round(clamp(networkParams?.hiddenDim ?? MODQN_NETWORK_DEFAULTS.hiddenDim, ...MODQN_NETWORK_PARAM_MIN_MAX.hiddenDim)),
    networkDepth: Math.round(clamp(networkParams?.networkDepth ?? MODQN_NETWORK_DEFAULTS.networkDepth, ...MODQN_NETWORK_PARAM_MIN_MAX.networkDepth)),
    batchSize: Math.round(clamp(networkParams?.batchSize ?? MODQN_NETWORK_DEFAULTS.batchSize, ...MODQN_NETWORK_PARAM_MIN_MAX.batchSize)),
    optimizer,
    epsilonStart: clamp(networkParams?.epsilonStart ?? MODQN_NETWORK_DEFAULTS.epsilonStart, ...MODQN_NETWORK_PARAM_MIN_MAX.epsilonStart),
    epsilonEnd: clamp(networkParams?.epsilonEnd ?? MODQN_NETWORK_DEFAULTS.epsilonEnd, ...MODQN_NETWORK_PARAM_MIN_MAX.epsilonEnd),
    targetUpdateTau: clamp(networkParams?.targetUpdateTau ?? MODQN_NETWORK_DEFAULTS.targetUpdateTau, ...MODQN_NETWORK_PARAM_MIN_MAX.targetUpdateTau),
    replayBufferSize: Math.round(clamp(
      networkParams?.replayBufferSize ?? MODQN_NETWORK_DEFAULTS.replayBufferSize,
      ...MODQN_NETWORK_PARAM_MIN_MAX.replayBufferSize,
    )),
    episodes: Math.round(clamp(
      networkParams?.episodes ?? MODQN_NETWORK_DEFAULTS.episodes,
      ...MODQN_NETWORK_PARAM_MIN_MAX.episodes,
    )),
  };
}

export function createHandoverPolicyTuningState(profile: Profile): HandoverPolicyTuningState {
  return {
    ...profile.handover,
    modqnWeights: normalizeObjectiveWeights(profile.handover.modqnWeights),
    modqnNetworkParams: normalizeModqnNetworkParams(profile.handover.modqnNetworkParams),
  };
}

export function applyHandoverPolicyTuning(
  profile: Profile,
  tuning: HandoverPolicyTuningState,
): Profile {
  return {
    ...profile,
    handover: {
      ...profile.handover,
      ...tuning,
      policy: 'sinr-offset',
      modqnWeights: normalizeObjectiveWeights(tuning.modqnWeights),
      modqnNetworkParams: normalizeModqnNetworkParams(tuning.modqnNetworkParams),
    },
  };
}

function formatModqnNetworkParams(params: ModqnNetworkParams): string {
  return [
    params.learningRate.toFixed(6),
    params.discountGamma.toFixed(3),
    params.hiddenDim,
    params.networkDepth,
    params.batchSize,
    params.optimizer,
    params.epsilonStart.toFixed(3),
    params.epsilonEnd.toFixed(3),
    params.targetUpdateTau.toFixed(4),
    params.replayBufferSize,
    params.episodes,
  ].join('|');
}

function sameModqnObjectiveWeights(
  left: ModqnObjectiveWeights,
  right: ModqnObjectiveWeights,
): boolean {
  return left.throughput === right.throughput
    && left.handover === right.handover
    && left.loadBalance === right.loadBalance;
}

function sameModqnNetworkParams(
  left: ModqnNetworkParams,
  right: ModqnNetworkParams,
): boolean {
  return left.learningRate === right.learningRate
    && left.discountGamma === right.discountGamma
    && left.hiddenDim === right.hiddenDim
    && left.networkDepth === right.networkDepth
    && left.batchSize === right.batchSize
    && left.optimizer === right.optimizer
    && left.epsilonStart === right.epsilonStart
    && left.epsilonEnd === right.epsilonEnd
    && left.targetUpdateTau === right.targetUpdateTau
    && left.replayBufferSize === right.replayBufferSize
    && left.episodes === right.episodes;
}

export function sameHandoverPolicyTuning(
  left: HandoverPolicyTuningState,
  right: HandoverPolicyTuningState,
): boolean {
  return left.policy === right.policy
    && left.sinrThresholdDb === right.sinrThresholdDb
    && left.offsetDb === right.offsetDb
    && left.triggerTimeSec === right.triggerTimeSec
    && left.pingPongGuardSec === right.pingPongGuardSec
    && left.pendingTargetHoldSec === right.pendingTargetHoldSec
    && left.intraSwitchTimeSec === right.intraSwitchTimeSec
    && left.maxIntraSwitchesPerServingEpoch === right.maxIntraSwitchesPerServingEpoch
    && left.sinrSmoothingSec === right.sinrSmoothingSec
    && sameModqnObjectiveWeights(left.modqnWeights, right.modqnWeights)
    && sameModqnNetworkParams(left.modqnNetworkParams, right.modqnNetworkParams);
}

export function hasHandoverPolicyOverrides(
  profile: Profile,
  tuning: HandoverPolicyTuningState,
): boolean {
  return !sameHandoverPolicyTuning(createHandoverPolicyTuningState(profile), tuning);
}

export function getHandoverPolicyResetKey(tuning: HandoverPolicyTuningState): string {
  return [
    tuning.policy,
    tuning.offsetDb.toFixed(3),
    tuning.triggerTimeSec.toFixed(3),
    tuning.pingPongGuardSec.toFixed(3),
    tuning.sinrSmoothingSec.toFixed(3),
    tuning.intraSwitchTimeSec.toFixed(3),
    tuning.maxIntraSwitchesPerServingEpoch.toFixed(3),
    tuning.pendingTargetHoldSec.toFixed(3),
    tuning.sinrThresholdDb.toFixed(3),
    tuning.modqnWeights.throughput.toFixed(3),
    tuning.modqnWeights.handover.toFixed(3),
    tuning.modqnWeights.loadBalance.toFixed(3),
    formatModqnNetworkParams(tuning.modqnNetworkParams),
  ].join('|');
}
