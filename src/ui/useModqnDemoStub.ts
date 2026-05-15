import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  HandoverPolicyTuningState,
  ModqnNetworkParams,
  ModqnObjectiveWeights,
} from '../handoverPolicyTuning';

type RetrainStatus = 'idle' | 'training' | 'deploying';

const DEFAULT_OBJECTIVE_WEIGHTS: ModqnObjectiveWeights = {
  throughput: 0.4,
  handover: 0.3,
  loadBalance: 0.3,
};

const DEFAULT_NETWORK_PARAMS: ModqnNetworkParams = {
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

const RETRAIN_TOTAL_TICKS = 100;
const RETRAIN_TICK_MS = 80;
const DEFAULT_FINAL_REWARD = 0.62;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeObjectiveWeights(weights?: HandoverPolicyTuningState['modqnWeights']): ModqnObjectiveWeights {
  return {
    throughput: weights?.throughput === undefined || !Number.isFinite(weights.throughput)
      ? DEFAULT_OBJECTIVE_WEIGHTS.throughput
      : clamp(weights.throughput, 0, 1),
    handover: weights?.handover === undefined || !Number.isFinite(weights.handover)
      ? DEFAULT_OBJECTIVE_WEIGHTS.handover
      : clamp(weights.handover, 0, 1),
    loadBalance: weights?.loadBalance === undefined || !Number.isFinite(weights.loadBalance)
      ? DEFAULT_OBJECTIVE_WEIGHTS.loadBalance
      : clamp(weights.loadBalance, 0, 1),
  };
}

function normalizeNetworkParams(network?: ModqnNetworkParams): ModqnNetworkParams {
  return {
    learningRate: network?.learningRate ?? DEFAULT_NETWORK_PARAMS.learningRate,
    discountGamma: clamp(network?.discountGamma ?? DEFAULT_NETWORK_PARAMS.discountGamma, 0.5, 1),
    hiddenDim: network?.hiddenDim === undefined ? DEFAULT_NETWORK_PARAMS.hiddenDim : Math.round(network.hiddenDim),
    networkDepth: network?.networkDepth === undefined ? DEFAULT_NETWORK_PARAMS.networkDepth : Math.round(network.networkDepth),
    batchSize: network?.batchSize === undefined ? DEFAULT_NETWORK_PARAMS.batchSize : Math.round(network.batchSize),
    optimizer: network?.optimizer ?? DEFAULT_NETWORK_PARAMS.optimizer,
    epsilonStart: clamp(network?.epsilonStart ?? DEFAULT_NETWORK_PARAMS.epsilonStart, 0, 1),
    epsilonEnd: clamp(network?.epsilonEnd ?? DEFAULT_NETWORK_PARAMS.epsilonEnd, 0, 1),
    targetUpdateTau: clamp(network?.targetUpdateTau ?? DEFAULT_NETWORK_PARAMS.targetUpdateTau, 1e-4, 1),
    replayBufferSize: Math.round(network?.replayBufferSize ?? DEFAULT_NETWORK_PARAMS.replayBufferSize),
    episodes: Math.round(network?.episodes ?? DEFAULT_NETWORK_PARAMS.episodes),
  };
}

function deriveEffectiveOffset(baseOffset: number, weights: ModqnObjectiveWeights): number {
  return clamp(baseOffset + 6 * weights.handover - 3 * weights.throughput, 0, 10);
}

function deriveEffectiveTrigger(baseTrigger: number, weights: ModqnObjectiveWeights): number {
  return clamp(baseTrigger + 2 * weights.loadBalance, 0, 15);
}

function sameObjectiveWeights(left: ModqnObjectiveWeights, right: ModqnObjectiveWeights): boolean {
  return left.throughput === right.throughput
    && left.handover === right.handover
    && left.loadBalance === right.loadBalance;
}

function sameNetworkParams(left: ModqnNetworkParams, right: ModqnNetworkParams): boolean {
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

function parsePolicyVersion(input: string): number {
  const raw = input.trim().match(/^v(\d+)$/i)?.[1];
  if (raw === undefined) return 1;
  const next = Number.parseInt(raw, 10);
  return Number.isFinite(next) ? Math.max(next, 1) : 1;
}

function computeRewardCurveSample(progress: number): number {
  const noise = (Math.random() - 0.5) * 0.05;
  return 0.2 + 0.4 * (1 - Math.exp(-progress / 30)) + noise;
}

export interface ModqnDemoStub {
  readonly weightsDraft: ModqnObjectiveWeights;
  readonly weightsActive: ModqnObjectiveWeights;
  readonly networkDraft: ModqnNetworkParams;
  readonly networkActive: ModqnNetworkParams;
  readonly retrainStatus: RetrainStatus;
  readonly retrainProgress: number;
  readonly episodeNow: number;
  readonly rewardCurve: readonly number[];
  readonly policyVersion: string;
  readonly trainedAtMs: number;
  readonly finalReward: number;
  readonly defaultWeights: ModqnObjectiveWeights;
  readonly hasWeightsDraftChanges: boolean;
  readonly hasNetworkDraftChanges: boolean;
  readonly effectiveOffsetDb: number;
  readonly effectiveTriggerTimeSec: number;
  readonly handleWeightsChange: (next: ModqnObjectiveWeights) => void;
  readonly handleApplyWeights: (next: ModqnObjectiveWeights) => void;
  readonly handleResetWeights: () => void;
  readonly handleNetworkDraftChange: (next: ModqnNetworkParams) => void;
  readonly handleApplyLiveNetwork: () => void;
  readonly handleRetrain: () => void;
}

export function useModqnDemoStub(appliedHandoverPolicy: HandoverPolicyTuningState): ModqnDemoStub {
  const defaultWeightValues = useMemo(
    () => normalizeObjectiveWeights(appliedHandoverPolicy.modqnWeights),
    [appliedHandoverPolicy.modqnWeights],
  );
  const defaultNetworkValues = useMemo(
    () => normalizeNetworkParams(appliedHandoverPolicy.modqnNetworkParams),
    [appliedHandoverPolicy.modqnNetworkParams],
  );

  const [weightsDraft, setWeightsDraft] = useState<ModqnObjectiveWeights>(defaultWeightValues);
  const [weightsActive, setWeightsActive] = useState<ModqnObjectiveWeights>(defaultWeightValues);
  const [networkDraft, setNetworkDraft] = useState<ModqnNetworkParams>(defaultNetworkValues);
  const [networkActive, setNetworkActive] = useState<ModqnNetworkParams>(defaultNetworkValues);
  const [retrainStatus, setRetrainStatus] = useState<RetrainStatus>('idle');
  const [retrainProgress, setRetrainProgress] = useState(0);
  const [episodeNow, setEpisodeNow] = useState(0);
  const [rewardCurve, setRewardCurve] = useState<number[]>([]);
  const [policyVersion, setPolicyVersion] = useState('v1');
  const [trainedAtMs, setTrainedAtMs] = useState(Date.now());
  const [finalReward, setFinalReward] = useState(DEFAULT_FINAL_REWARD);
  const retrainIntervalRef = useRef<number | null>(null);
  const deployTimeoutRef = useRef<number | null>(null);

  const hasNetworkDraftChanges = useMemo(
    () => !sameNetworkParams(networkDraft, networkActive),
    [networkDraft, networkActive],
  );
  const hasWeightsDraftChanges = useMemo(
    () => !sameObjectiveWeights(weightsDraft, weightsActive),
    [weightsDraft, weightsActive],
  );
  const effectiveOffsetDb = deriveEffectiveOffset(appliedHandoverPolicy.offsetDb, weightsActive);
  const effectiveTriggerTimeSec = deriveEffectiveTrigger(appliedHandoverPolicy.triggerTimeSec, weightsActive);

  const clearRetrainInterval = useCallback(() => {
    if (retrainIntervalRef.current !== null) {
      window.clearInterval(retrainIntervalRef.current);
      retrainIntervalRef.current = null;
    }
  }, []);

  const clearRetrainDeployTimeout = useCallback(() => {
    if (deployTimeoutRef.current !== null) {
      window.clearTimeout(deployTimeoutRef.current);
      deployTimeoutRef.current = null;
    }
  }, []);

  const clearRetrainSchedulers = useCallback(() => {
    clearRetrainInterval();
    clearRetrainDeployTimeout();
  }, [clearRetrainInterval, clearRetrainDeployTimeout]);

  const handleWeightsChange = useCallback((next: ModqnObjectiveWeights) => {
    setWeightsDraft(next);
  }, []);

  const handleApplyWeights = useCallback((next: ModqnObjectiveWeights) => {
    setWeightsActive(next);
  }, []);

  const handleResetWeights = useCallback(() => {
    setWeightsDraft(defaultWeightValues);
  }, [defaultWeightValues]);

  const handleNetworkDraftChange = useCallback((next: ModqnNetworkParams) => {
    setNetworkDraft(next);
  }, []);

  const handleApplyLiveNetwork = useCallback(() => {
    if (retrainStatus !== 'idle') return;
    setNetworkActive(networkDraft);
  }, [networkDraft, retrainStatus]);

  const handleRetrain = useCallback(() => {
    if (retrainStatus !== 'idle' || hasNetworkDraftChanges) return;

    const draftSnapshot = { ...networkActive };
    clearRetrainSchedulers();

    setRewardCurve([]);
    setEpisodeNow(0);
    setRetrainProgress(0);
    setFinalReward(DEFAULT_FINAL_REWARD);
    setRetrainStatus('training');

    let tick = 0;
    const samples: number[] = [];
    retrainIntervalRef.current = window.setInterval(() => {
      tick = clamp(tick + 1, 1, RETRAIN_TOTAL_TICKS);
      const reward = computeRewardCurveSample(tick);
      const currentEpisode = Math.max(0, Math.round((tick / RETRAIN_TOTAL_TICKS) * draftSnapshot.episodes));
      samples.push(reward);
      setEpisodeNow(currentEpisode);
      setRetrainProgress(tick);
      setRewardCurve(samples);

      if (tick >= RETRAIN_TOTAL_TICKS) {
        clearRetrainInterval();
        setEpisodeNow(draftSnapshot.episodes);
        setRetrainProgress(RETRAIN_TOTAL_TICKS);
        setRetrainStatus('deploying');
        deployTimeoutRef.current = window.setTimeout(() => {
          clearRetrainDeployTimeout();
          const nextReward = samples[samples.length - 1] ?? DEFAULT_FINAL_REWARD;
          setPolicyVersion(version => `v${parsePolicyVersion(version) + 1}`);
          setTrainedAtMs(Date.now());
          setFinalReward(nextReward);
          setNetworkActive(draftSnapshot);
          setRetrainStatus('idle');
        }, 600);
      }
    }, RETRAIN_TICK_MS);
  }, [
    clearRetrainInterval,
    clearRetrainDeployTimeout,
    clearRetrainSchedulers,
    hasNetworkDraftChanges,
    networkActive,
    retrainStatus,
  ]);

  useEffect(() => {
    clearRetrainSchedulers();
    setWeightsDraft(defaultWeightValues);
    setWeightsActive(defaultWeightValues);
    setNetworkDraft(defaultNetworkValues);
    setNetworkActive(defaultNetworkValues);
    setPolicyVersion('v1');
    setTrainedAtMs(Date.now());
    setFinalReward(DEFAULT_FINAL_REWARD);
    setRewardCurve([]);
    setEpisodeNow(0);
    setRetrainProgress(0);
    setRetrainStatus('idle');
  }, [clearRetrainSchedulers, defaultNetworkValues, defaultWeightValues]);

  useEffect(() => () => {
    clearRetrainSchedulers();
  }, [clearRetrainSchedulers]);

  return {
    weightsDraft,
    weightsActive,
    networkDraft,
    networkActive,
    retrainStatus,
    retrainProgress,
    episodeNow,
    rewardCurve,
    policyVersion,
    trainedAtMs,
    finalReward,
    defaultWeights: defaultWeightValues,
    hasWeightsDraftChanges,
    hasNetworkDraftChanges,
    effectiveOffsetDb,
    effectiveTriggerTimeSec,
    handleWeightsChange,
    handleApplyWeights,
    handleResetWeights,
    handleNetworkDraftChange,
    handleApplyLiveNetwork,
    handleRetrain,
  };
}
