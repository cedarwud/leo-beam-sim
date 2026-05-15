// MODQN ω-Handover S1 — sidebar objective tab.
//
// Replaces the previous tab + ModqnObjectiveControls combo that fronted the
// fake useModqnDemoStub (with fake reward curve, fake Retrain button, and
// fake `effectiveOffsetDb / effectiveTriggerTimeSec` derivations).
//
// S1 ownership (SDD §9.2 + §3.5):
//   * Three ω sliders bound to `omegaDraft` (rebalance so the vector sums to
//     1 across keystrokes; preserves the prior UX).
//   * Apply commits draft → active. Reset returns both to the bundle ω.
//   * The reset target is the bundle's `policyDiagnostics.objectiveWeights`
//     and is labelled `from bundle` — required by SDD §9.2 acceptance.
//
// Out of scope this slice:
//   * No engine wiring of `omegaActive` (S3 / S4).
//   * No mode selector (S3 adds it via ControlBar).
//   * No omega-heuristic banner / capture metadata (S4).
import { useCallback, useMemo } from 'react';
import {
  useModqnHandoverState,
  type RuntimeOmegaState,
  type UseModqnHandoverState,
} from './useModqnHandoverState';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

// Same rebalance behavior as the legacy ModqnObjectiveControls so the UX is
// preserved across the truth-up. Sum stays at 1 as the user drags one slider.
function rebalanceOmega(
  current: RuntimeOmegaState,
  changedKey: keyof RuntimeOmegaState,
  nextValue: number,
): RuntimeOmegaState {
  const clamped = clamp01(nextValue);
  const remaining = clamp01(1 - clamped);

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

function sameOmega(left: RuntimeOmegaState, right: RuntimeOmegaState): boolean {
  return left.throughput === right.throughput
    && left.handover === right.handover
    && left.loadBalance === right.loadBalance;
}

interface Props {
  // S1 default consumer: no props required; tab owns the hook. Tests inject a
  // pre-built hook state via `hookOverride` so the validator can render the
  // tab against a known snapshot without colliding with React state.
  readonly hookOverride?: UseModqnHandoverState;
}

export function ModqnObjectiveTab({ hookOverride }: Props) {
  const fallbackHook = useModqnHandoverState();
  const hook = hookOverride ?? fallbackHook;

  const {
    omegaDraft,
    omegaActive,
    omegaSource,
    bundlePolicyDiagnostics,
    setOmegaDraft,
    applyOmega,
    resetOmega,
  } = hook;

  const bundleWeights = useMemo<RuntimeOmegaState>(() => {
    const weights = bundlePolicyDiagnostics?.objectiveWeights;
    return {
      throughput: clamp01(Number(weights?.throughput ?? weights?.r1Throughput ?? 0.4)),
      handover: clamp01(Number(weights?.handover ?? weights?.r2Handover ?? 0.3)),
      loadBalance: clamp01(Number(weights?.loadBalance ?? weights?.r3LoadBalance ?? 0.3)),
    };
  }, [bundlePolicyDiagnostics]);

  const canApply = !sameOmega(omegaDraft, omegaActive);
  const canReset = !(sameOmega(omegaDraft, bundleWeights) && sameOmega(omegaActive, bundleWeights));

  const handleSliderChange = useCallback(
    (key: keyof RuntimeOmegaState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setOmegaDraft(rebalanceOmega(omegaDraft, key, Number(event.target.value)));
    },
    [omegaDraft, setOmegaDraft],
  );

  return (
    <section
      className="leo-modqn-objective-tab"
      data-testid="modqn-objective-tab"
      data-omega-source={omegaSource}
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <section
        className="leo-modqn-objective-controls"
        data-testid="modqn-objective-controls"
      >
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
            value={omegaDraft.throughput}
            aria-label="Throughput weight"
            data-testid="modqn-objective-weight-throughput"
            onChange={handleSliderChange('throughput')}
          />
          <output>{formatWeight(omegaDraft.throughput)}</output>
        </label>

        <label className="leo-modqn-objective-controls__slider-row">
          <span>Handover</span>
          <input
            type="range"
            className="leo-ui-range"
            min={0}
            max={1}
            step={0.01}
            value={omegaDraft.handover}
            aria-label="Handover weight"
            data-testid="modqn-objective-weight-handover"
            onChange={handleSliderChange('handover')}
          />
          <output>{formatWeight(omegaDraft.handover)}</output>
        </label>

        <label className="leo-modqn-objective-controls__slider-row">
          <span>Load balance</span>
          <input
            type="range"
            className="leo-ui-range"
            min={0}
            max={1}
            step={0.01}
            value={omegaDraft.loadBalance}
            aria-label="Load balance weight"
            data-testid="modqn-objective-weight-loadbalance"
            onChange={handleSliderChange('loadBalance')}
          />
          <output>{formatWeight(omegaDraft.loadBalance)}</output>
        </label>

        <p
          className="leo-modqn-objective-controls__hint"
          data-testid="modqn-objective-reset-target"
        >
          from bundle:
          {' '}
          ({formatWeight(bundleWeights.throughput)},
          {' '}
          {formatWeight(bundleWeights.handover)},
          {' '}
          {formatWeight(bundleWeights.loadBalance)})
        </p>

        <div className="leo-modqn-objective-controls__actions">
          <button
            className="leo-ui-button"
            type="button"
            data-testid="modqn-objective-apply"
            onClick={applyOmega}
            disabled={!canApply}
          >
            Apply
          </button>
          <button
            className="leo-ui-button"
            type="button"
            data-testid="modqn-objective-reset"
            onClick={resetOmega}
            disabled={!canReset}
          >
            Reset
          </button>
        </div>
      </section>
    </section>
  );
}
