import { useCallback } from 'react';
import {
  NetworkParamInput,
} from './modqn-controls/NetworkParamInput';
import { type ModqnNetworkParams } from '../handoverPolicyTuning';
import type { ModqnObjectiveWeights } from '../handoverPolicyTuning';

type RetrainStatus = 'idle' | 'training' | 'deploying';

interface ModqnObjectiveControlsProps {
  readonly weights: ModqnObjectiveWeights;
  readonly defaultWeights: ModqnObjectiveWeights;
  readonly onWeightsChange: (next: ModqnObjectiveWeights) => void;
  readonly onApply: (weights: ModqnObjectiveWeights) => void;
  readonly onReset: () => void;
  readonly networkDraft: ModqnNetworkParams;
  readonly networkActive: ModqnNetworkParams;
  readonly retrainStatus: RetrainStatus;
  readonly onNetworkDraftChange: (next: ModqnNetworkParams) => void;
  readonly onRetrain: () => void;
  readonly onApplyLive: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rebalanceWeights(
  current: ModqnObjectiveWeights,
  changedKey: keyof ModqnObjectiveWeights,
  nextValue: number,
): ModqnObjectiveWeights {
  const clamped = clamp(nextValue, 0, 1);
  const remaining = clamp(1 - clamped, 0, 1);

  if (changedKey === 'throughput') {
    const untouchedSum = current.handover + current.loadBalance;
    if (untouchedSum <= 0) {
      const balanced = remaining / 2;
      return {
        throughput: clamped,
        handover: balanced,
        loadBalance: remaining - balanced,
      };
    }

    const handoverRatio = current.handover / untouchedSum;
    const adjustedHandover = remaining * handoverRatio;
    return {
      throughput: clamped,
      handover: adjustedHandover,
      loadBalance: remaining - adjustedHandover,
    };
  }

  if (changedKey === 'handover') {
    const untouchedSum = current.throughput + current.loadBalance;
    if (untouchedSum <= 0) {
      const balanced = remaining / 2;
      return {
        throughput: balanced,
        handover: clamped,
        loadBalance: remaining - balanced,
      };
    }

    const throughputRatio = current.throughput / untouchedSum;
    const adjustedThroughput = remaining * throughputRatio;
    return {
      throughput: adjustedThroughput,
      handover: clamped,
      loadBalance: remaining - adjustedThroughput,
    };
  }

  const untouchedSum = current.throughput + current.handover;
  if (untouchedSum <= 0) {
    const balanced = remaining / 2;
    return {
      throughput: balanced,
      handover: remaining - balanced,
      loadBalance: clamped,
    };
  }

  const throughputRatio = current.throughput / untouchedSum;
  const adjustedThroughput = remaining * throughputRatio;
  return {
    throughput: adjustedThroughput,
    handover: remaining - adjustedThroughput,
    loadBalance: clamped,
  };
}

function formatWeight(value: number): string {
  return value.toFixed(2);
}

function sameObjectiveWeights(
  left: ModqnObjectiveWeights,
  right: ModqnObjectiveWeights,
): boolean {
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

const NETWORK_PARAM_INPUTS: readonly {
  readonly kind: 'log-slider' | 'slider' | 'int-slider' | 'select';
  readonly field: keyof ModqnNetworkParams;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly logMin?: number;
  readonly logMax?: number;
  readonly description: string;
  readonly valuePrecision?: number;
  readonly options?: readonly string[];
  readonly testId: string;
  readonly legacyTestId: string;
}[] = [
  {
    kind: 'log-slider',
    field: 'learningRate',
    label: 'Learning rate',
    min: -5,
    max: -1,
    step: 0.01,
    logMin: -5,
    logMax: 0,
    valuePrecision: 6,
    description: 'Learning rate for optimizer updates.',
    testId: 'modqn-network-learning-rate',
    legacyTestId: 'modqn-network-param-learning-rate',
  },
  {
    kind: 'slider',
    field: 'discountGamma',
    label: 'Discount γ',
    min: 0.8,
    max: 0.999,
    step: 0.01,
    valuePrecision: 3,
    description: 'Reward discount factor.',
    testId: 'modqn-network-discount-gamma',
    legacyTestId: 'modqn-network-param-discount-gamma',
  },
  {
    kind: 'int-slider',
    field: 'hiddenDim',
    label: 'Hidden dim',
    min: 16,
    max: 512,
    step: 1,
    description: 'Number of hidden units per layer.',
    testId: 'modqn-network-hidden-dim',
    legacyTestId: 'modqn-network-param-hidden-dim',
  },
  {
    kind: 'int-slider',
    field: 'networkDepth',
    label: 'Network depth',
    min: 1,
    max: 5,
    step: 1,
    description: 'Number of hidden layers.',
    testId: 'modqn-network-depth',
    legacyTestId: 'modqn-network-param-network-depth',
  },
  {
    kind: 'int-slider',
    field: 'batchSize',
    label: 'Batch size',
    min: 8,
    max: 512,
    step: 1,
    description: 'Updates per gradient batch.',
    testId: 'modqn-network-batch-size',
    legacyTestId: 'modqn-network-param-batch-size',
  },
  {
    kind: 'select',
    field: 'optimizer',
    label: 'Optimizer',
    min: 0,
    max: 1,
    description: 'Optimizer type.',
    options: ['Adam', 'SGD', 'RMSprop'],
    testId: 'modqn-network-optimizer',
    legacyTestId: 'modqn-network-param-optimizer',
  },
  {
    kind: 'slider',
    field: 'epsilonStart',
    label: 'Epsilon start',
    min: 0,
    max: 1,
    step: 0.01,
    valuePrecision: 3,
    description: 'Start exploration probability.',
    testId: 'modqn-network-epsilon-start',
    legacyTestId: 'modqn-network-param-epsilon-start',
  },
  {
    kind: 'slider',
    field: 'epsilonEnd',
    label: 'Epsilon end',
    min: 0,
    max: 1,
    step: 0.01,
    valuePrecision: 3,
    description: 'Final exploration floor.',
    testId: 'modqn-network-epsilon-end',
    legacyTestId: 'modqn-network-param-epsilon-end',
  },
  {
    kind: 'log-slider',
    field: 'targetUpdateTau',
    label: 'Target update τ',
    min: -4,
    max: 0,
    step: 0.01,
    logMin: -4,
    logMax: 0,
    valuePrecision: 4,
    description: 'Polyak target update factor.',
    testId: 'modqn-network-target-update',
    legacyTestId: 'modqn-network-param-target-update-tau',
  },
  {
    kind: 'int-slider',
    field: 'replayBufferSize',
    label: 'Replay buffer size',
    min: 1_000,
    max: 500_000,
    step: 100,
    description: 'Replay store capacity.',
    testId: 'modqn-network-replay-buffer',
    legacyTestId: 'modqn-network-param-replay-buffer-size',
  },
  {
    kind: 'int-slider',
    field: 'episodes',
    label: 'Episodes',
    min: 10,
    max: 1_000,
    step: 1,
    description: 'Training episodes for retrain',
    testId: 'modqn-network-episodes',
    legacyTestId: 'modqn-network-param-episodes',
  },
];

export function ModqnObjectiveControls({
  weights,
  defaultWeights,
  onWeightsChange,
  onApply,
  onReset,
  networkDraft,
  networkActive,
  retrainStatus,
  onNetworkDraftChange,
  onRetrain,
  onApplyLive,
}: ModqnObjectiveControlsProps) {
  const canReset = !sameObjectiveWeights(weights, defaultWeights);
  const canApply = true;
  const canRetrain = !(sameNetworkParams(networkDraft, networkActive) || retrainStatus !== 'idle');
  const canApplyLive = retrainStatus === 'idle';

  const handleInputChange = useCallback((field: keyof ModqnNetworkParams, value: string | number | boolean) => {
    onNetworkDraftChange({
      ...networkDraft,
      [field]: value,
    } as ModqnNetworkParams);
  }, [networkDraft, onNetworkDraftChange]);

  return (
    <section className="leo-modqn-objective-controls" data-testid="modqn-objective-controls">
      <div className="leo-modqn-objective-controls__title">Objective weights</div>
      <p className="leo-modqn-objective-controls__hint">
        sum = 1; moving one rebalances others
      </p>

      <label className="leo-modqn-objective-controls__slider-row">
        <span>Throughput</span>
        <input
          type="range"
          className="leo-ui-range"
          min={0}
          max={1}
          step={0.01}
          value={weights.throughput}
          aria-label="Throughput weight"
          data-testid="modqn-objective-weight-throughput"
          onChange={event => onWeightsChange(
            rebalanceWeights(weights, 'throughput', Number(event.target.value)),
          )}
        />
        <output>{formatWeight(weights.throughput)}</output>
      </label>

      <label className="leo-modqn-objective-controls__slider-row">
        <span>Handover</span>
        <input
          type="range"
          className="leo-ui-range"
          min={0}
          max={1}
          step={0.01}
          value={weights.handover}
          aria-label="Handover weight"
          data-testid="modqn-objective-weight-handover"
          onChange={event => onWeightsChange(
            rebalanceWeights(weights, 'handover', Number(event.target.value)),
          )}
        />
        <output>{formatWeight(weights.handover)}</output>
      </label>

      <label className="leo-modqn-objective-controls__slider-row">
        <span>Load balance</span>
        <input
          type="range"
          className="leo-ui-range"
          min={0}
          max={1}
          step={0.01}
          value={weights.loadBalance}
          aria-label="Load balance weight"
          data-testid="modqn-objective-weight-loadbalance"
          onChange={event => onWeightsChange(
            rebalanceWeights(weights, 'loadBalance', Number(event.target.value)),
          )}
        />
        <output>{formatWeight(weights.loadBalance)}</output>
      </label>

      <div className="leo-modqn-objective-controls__actions">
        <button
          className="leo-ui-button"
          type="button"
          data-testid="modqn-objective-apply"
          onClick={() => onApply(weights)}
          disabled={!canApply}
        >
          Apply
        </button>
        <button
          className="leo-ui-button"
          type="button"
          data-testid="modqn-objective-reset"
          onClick={onReset}
          disabled={!canReset}
        >
          Reset
        </button>
      </div>

      <details
        className="leo-modqn-network-section"
        data-testid="modqn-network-section"
        open
      >
        <summary className="leo-modqn-network-section__summary">Network</summary>
        <p className="leo-modqn-network-section__hint">11 trainable network parameters</p>
        <div className="leo-modqn-objective-controls__hyperparam-list">
          {NETWORK_PARAM_INPUTS.slice(0, 6).map(config => (
                <NetworkParamInput
                  key={String(config.field)}
                  label={config.label}
                  description={config.description}
                  testId={config.testId}
                  legacyTestId={config.legacyTestId}
                  kind={config.kind}
                  kindProps={
                    config.kind === 'select'
                      ? { value: networkDraft[config.field] as string, options: config.options ?? [] }
                      : {
                        value: networkDraft[config.field] as number,
                        min: config.min,
                        max: config.max,
                        step: config.step,
                        logMin: config.logMin,
                        logMax: config.logMax,
                        valuePrecision: config.valuePrecision,
                      }
              }
              onChange={next => handleInputChange(config.field, next)}
            />
          ))}
        </div>
        <div className="leo-modqn-objective-controls__network-grid leo-modqn-objective-controls__network-grid--compact">
          {NETWORK_PARAM_INPUTS.slice(6).map(config => (
                <NetworkParamInput
                  key={String(config.field)}
                  label={config.label}
                  description={config.description}
                  testId={config.testId}
                  legacyTestId={config.legacyTestId}
                  kind={config.kind}
                  kindProps={
                    config.kind === 'select'
                      ? { value: networkDraft[config.field] as string, options: config.options ?? [] }
                      : {
                        value: networkDraft[config.field] as number,
                        min: config.min,
                        max: config.max,
                        step: config.step,
                        logMin: config.logMin,
                        logMax: config.logMax,
                        valuePrecision: config.valuePrecision,
                      }
              }
              onChange={next => handleInputChange(config.field, next)}
            />
          ))}
        </div>
      </details>
      <div className="leo-modqn-objective-controls__actions">
        <button
          className="leo-ui-button leo-modqn-retrain-button"
          type="button"
          data-testid="modqn-retrain-button"
          onClick={onRetrain}
          disabled={!canRetrain}
        >
          Retrain
        </button>
        <button
          className="leo-ui-button"
          type="button"
          data-testid="modqn-apply-live"
          onClick={onApplyLive}
          disabled={!canApplyLive}
        >
          Apply live
        </button>
      </div>
    </section>
  );
}
