import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import { readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { postTrain, probeService } from '../../modqn/training-trigger/serviceClient';
import {
  appendSubmittedJobId,
} from '../../modqn/training-trigger/submittedJobs';
import type {
  ServiceAvailability,
  TrainerSubcommand,
  TrainingRequest,
} from '../../modqn/training-trigger/types';

const TRAINER_SUBCOMMANDS: readonly TrainerSubcommand[] = ['baseline', 'ee-modqn', 'multi-catfish'];
const EPISODES_BACKEND_CAP = 5000;
const QUICK_EPISODES = 100;
const FULL_EPISODES = 5000;

interface TrainingFormProps {
  readonly appMode: AppExperienceMode;
}

interface FormState {
  trainerSubcommand: TrainerSubcommand;
  episodes: number;
  learningRate: number;
  discountGamma: number;
  hiddenDim: number;
  batchSize: number;
  omegaThroughput: number;
  omegaHandover: number;
  omegaLoadBalance: number;
}

const DEFAULT_FORM_STATE: FormState = {
  trainerSubcommand: 'baseline',
  episodes: 1000,
  learningRate: 0.001,
  discountGamma: 0.9,
  hiddenDim: 100,
  batchSize: 128,
  omegaThroughput: 0.4,
  omegaHandover: 0.3,
  omegaLoadBalance: 0.3,
};

function buildRequest(state: FormState): TrainingRequest {
  return {
    trainerSubcommand: state.trainerSubcommand,
    hyperparams: {
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
    },
  };
}

function summarize(state: FormState): string {
  return `ep=${state.episodes}, lr=${state.learningRate}, γ=${state.discountGamma}, ω=(${state.omegaThroughput},${state.omegaHandover},${state.omegaLoadBalance})`;
}

export function TrainingForm({ appMode }: TrainingFormProps): ReactElement | null {
  const enabled = appMode === 'modqn-demo';
  const [availability, setAvailability] = useState<ServiceAvailability | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ jobId: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    probeService({ baseUrl: readTrainingServiceBaseUrl() }).then(result => {
      if (!cancelled) setAvailability(result);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  const episodesOverCap = form.episodes > EPISODES_BACKEND_CAP;
  const reachable = availability?.reachable === true;
  const disableSubmit = !reachable || submitting || episodesOverCap;
  const disableForm = !reachable || submitting;

  const submitWith = useCallback(async (state: FormState) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await postTrain(
        { baseUrl: readTrainingServiceBaseUrl() },
        buildRequest(state),
      );
      appendSubmittedJobId({
        jobId: response.jobId,
        submittedAtMs: Date.now(),
        hyperparamSummary: summarize(state),
      });
      setSuccess({ jobId: response.jobId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (disableSubmit) return;
    void submitWith(form);
  }, [disableSubmit, form, submitWith]);

  const handleQuick = useCallback(() => {
    if (!reachable || submitting) return;
    const next = { ...DEFAULT_FORM_STATE, episodes: QUICK_EPISODES };
    setForm(next);
    void submitWith(next);
  }, [reachable, submitting, submitWith]);

  const handleFull = useCallback(() => {
    if (!reachable || submitting) return;
    const next = { ...DEFAULT_FORM_STATE, episodes: FULL_EPISODES };
    setForm(next);
    void submitWith(next);
  }, [reachable, submitting, submitWith]);

  if (!enabled) return null;

  return (
    <section
      className="leo-training-form"
      aria-label="MODQN training trigger"
      data-testid="training-form"
    >
      <label className="leo-training-form__field">
        <span>Trainer subcommand</span>
        <select
          value={form.trainerSubcommand}
          onChange={event => setForm(state => ({
            ...state,
            trainerSubcommand: event.target.value as TrainerSubcommand,
          }))}
          disabled={disableForm}
        >
          {TRAINER_SUBCOMMANDS.map(subcommand => (
            <option key={subcommand} value={subcommand}>
              {subcommand}
            </option>
          ))}
        </select>
      </label>

      <label className="leo-training-form__field">
        <span>Episodes</span>
        <input
          type="number"
          value={form.episodes}
          onChange={event => setForm(state => ({ ...state, episodes: Number(event.target.value) }))}
          disabled={disableForm}
          data-testid="training-form-episodes-input"
        />
      </label>

      <label className="leo-training-form__field">
        <span>Learning rate</span>
        <input
          type="number"
          step="0.0001"
          value={form.learningRate}
          onChange={event => setForm(state => ({ ...state, learningRate: Number(event.target.value) }))}
          disabled={disableForm}
        />
      </label>

      <label className="leo-training-form__field">
        <span>Discount gamma</span>
        <input
          type="number"
          step="0.01"
          value={form.discountGamma}
          onChange={event => setForm(state => ({ ...state, discountGamma: Number(event.target.value) }))}
          disabled={disableForm}
        />
      </label>

      <label className="leo-training-form__field">
        <span>Hidden dim</span>
        <input
          type="number"
          value={form.hiddenDim}
          onChange={event => setForm(state => ({ ...state, hiddenDim: Number(event.target.value) }))}
          disabled={disableForm}
        />
      </label>

      <label className="leo-training-form__field">
        <span>Batch size</span>
        <input
          type="number"
          value={form.batchSize}
          onChange={event => setForm(state => ({ ...state, batchSize: Number(event.target.value) }))}
          disabled={disableForm}
        />
      </label>

      <label className="leo-training-form__field">
        <span>ω throughput</span>
        <input
          type="number"
          step="0.01"
          value={form.omegaThroughput}
          onChange={event => setForm(state => ({ ...state, omegaThroughput: Number(event.target.value) }))}
          disabled={disableForm}
        />
      </label>

      <label className="leo-training-form__field">
        <span>ω handover</span>
        <input
          type="number"
          step="0.01"
          value={form.omegaHandover}
          onChange={event => setForm(state => ({ ...state, omegaHandover: Number(event.target.value) }))}
          disabled={disableForm}
        />
      </label>

      <label className="leo-training-form__field">
        <span>ω load balance</span>
        <input
          type="number"
          step="0.01"
          value={form.omegaLoadBalance}
          onChange={event => setForm(state => ({ ...state, omegaLoadBalance: Number(event.target.value) }))}
          disabled={disableForm}
        />
      </label>

      <div className="leo-training-form__presets">
        <button
          type="button"
          data-testid="training-form-quick"
          onClick={handleQuick}
          disabled={!reachable || submitting}
        >
          Quick (100 ep)
        </button>
        <button
          type="button"
          data-testid="training-form-full"
          onClick={handleFull}
          disabled={!reachable || submitting}
          title="Backend caps episodes at 5000 (paper baseline is 9000 — see SDD §4.1)."
        >
          Full (5000 ep)
        </button>
      </div>
      <button
        type="button"
        data-testid="training-form-submit"
        onClick={handleSubmit}
        disabled={disableSubmit}
      >
        {submitting ? 'Starting…' : 'Start training'}
      </button>
      {episodesOverCap ? (
        <div role="alert" className="leo-training-form__clamp-banner">
          Backend caps episodes at {EPISODES_BACKEND_CAP} — bump
          <code> modqn-paper-reproduction/src/modqn_training_service/allowlist.py </code>
          to raise the cap (see SDD §4.1).
        </div>
      ) : null}
      {error ? (
        <div role="alert" data-testid="training-form-error" className="leo-training-form__error">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" data-testid="training-form-success" className="leo-training-form__success">
          Started job {success.jobId}
        </div>
      ) : null}
    </section>
  );
}
