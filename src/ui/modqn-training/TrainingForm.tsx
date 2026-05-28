import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import { readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import {
  postSensitivitySweep,
  postTrain,
  probeService,
} from '../../modqn/training-trigger/serviceClient';
import { appendSubmittedJobId } from '../../modqn/training-trigger/submittedJobs';
import type {
  ServiceAvailability,
  TrainingArm,
  TrainingProfile,
  TrainingRequestMode,
} from '../../modqn/training-trigger/types';
import {
  DEFAULT_FORM_STATE,
  FULL_EPISODES,
  QUICK_EPISODES,
  SWEEP_AXIS_OPTIONS,
  buildRequest,
  buildSweepRequest,
  summarize,
  validationMessage,
  type FormState,
  type SubmissionMode,
  type SweepAxisPath,
} from './trainingFormModel';

type SubmissionSuccess =
  | { readonly kind: 'job'; readonly jobId: string }
  | { readonly kind: 'batch'; readonly batchId: string; readonly jobIds: readonly string[] };

interface TrainingFormProps {
  readonly appMode: AppExperienceMode;
}

const DEG_TO_RAD = Math.PI / 180;

interface CoverageEstimate {
  readonly beamRadiusKm: number;
  readonly beamAreaKm2: number;
  readonly ueAreaKm2: number;
  readonly expectedUesPerBeam: number;
  readonly expectedUesPerSatellite: number;
}

function formatEstimate(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function estimateCoverage(form: FormState): CoverageEstimate {
  const beamRadiusKm = Math.max(
    0,
    form.altitudeKm * Math.tan(Math.max(0, form.theta3dbDeg) * DEG_TO_RAD / 2),
  );
  const beamAreaKm2 = Math.PI * beamRadiusKm * beamRadiusKm;
  const ueAreaKm2 = form.ueDistribution === 'uniform-rectangle'
    ? Math.max(1, form.ueWidthKm * form.ueHeightKm)
    : Math.max(1, Math.PI * form.ueRadiusKm * form.ueRadiusKm);
  const expectedUesPerBeam = form.nUsers * (beamAreaKm2 / ueAreaKm2);

  return {
    beamRadiusKm,
    beamAreaKm2,
    ueAreaKm2,
    expectedUesPerBeam,
    expectedUesPerSatellite: expectedUesPerBeam * Math.max(0, form.beamsPerSatellite),
  };
}

export function TrainingForm({ appMode }: TrainingFormProps): ReactElement | null {
  const enabled = appMode === 'modqn-demo';
  const [availability, setAvailability] = useState<ServiceAvailability | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubmissionSuccess | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    probeService({ baseUrl: readTrainingServiceBaseUrl() }).then(result => {
      if (!cancelled) setAvailability(result);
    });
    return () => { cancelled = true; };
  }, [enabled]);

  const reachable = availability?.reachable === true;
  const validation = useMemo(() => validationMessage(form), [form]);
  const coverageEstimate = useMemo(() => estimateCoverage(form), [form]);

  const submitWith = useCallback(async (state: FormState) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const config = { baseUrl: readTrainingServiceBaseUrl() };
      const submittedAtMs = Date.now();
      if (state.submissionMode === 'sweep') {
        const response = await postSensitivitySweep(config, buildSweepRequest(state));
        for (const jobId of response.jobIds) {
          appendSubmittedJobId({
            jobId,
            batchId: response.batchId,
            submittedAtMs,
            hyperparamSummary: `${summarize(state)}, sweep=${state.sweepAxis}`,
          });
        }
        setSuccess({ kind: 'batch', batchId: response.batchId, jobIds: response.jobIds });
      } else {
        const response = await postTrain(config, buildRequest(state));
        appendSubmittedJobId({
          jobId: response.jobId,
          submittedAtMs,
          hyperparamSummary: summarize(state),
        });
        setSuccess({ kind: 'job', jobId: response.jobId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!reachable) {
      setError('Training backend is unreachable. Please start the backend service first.');
      return;
    }
    if (validation !== null) {
      setError(validation);
      return;
    }
    void submitWith(form);
  }, [form, reachable, submitWith, validation]);

  const handleQuick = useCallback(() => {
    if (!reachable) {
      setError('Training backend is unreachable. Please start the backend service first.');
      return;
    }
    if (submitting) return;
    const next = { ...DEFAULT_FORM_STATE, episodes: QUICK_EPISODES };
    setForm(next);
    void submitWith(next);
  }, [reachable, submitting, submitWith]);

  const handleFull = useCallback(() => {
    if (!reachable) {
      setError('Training backend is unreachable. Please start the backend service first.');
      return;
    }
    if (submitting) return;
    const next = { ...DEFAULT_FORM_STATE, episodes: FULL_EPISODES };
    setForm(next);
    void submitWith(next);
  }, [reachable, submitting, submitWith]);

  if (!enabled) return null;

  return (
    <section className="leo-training-form" aria-label="MODQN training trigger" data-testid="training-form">
      <div className="leo-training-form__section">
        <label className="leo-training-form__field">
          <span>Submit</span>
          <select
            value={form.submissionMode}
            onChange={event => setForm(state => ({
              ...state,
              submissionMode: event.target.value as SubmissionMode,
            }))}
            disabled={submitting}
            data-testid="training-form-submission-mode"
          >
            <option value="single">single job</option>
            <option value="sweep">sensitivity sweep</option>
          </select>
        </label>
        <label className="leo-training-form__field">
          <span>Profile</span>
          <select
            value={form.trainingProfile}
            onChange={event => setForm(state => ({
              ...state,
              trainingProfile: event.target.value as TrainingProfile,
            }))}
            disabled={submitting}
          >
            <option value="track2">Track-2 profile</option>
            <option value="legacy-baseline">Legacy baseline</option>
          </select>
        </label>
        <label className="leo-training-form__field">
          <span>Arm</span>
          <select
            value={form.arm}
            onChange={event => setForm(state => ({ ...state, arm: event.target.value as TrainingArm }))}
            disabled={submitting || form.trainingProfile !== 'track2'}
            data-testid="training-form-arm-select"
          >
            <option value="a1">a1 baseline</option>
            <option value="a4">a4 Multi-Catfish</option>
            <option value="a5_hobs">a5 HOBS</option>
          </select>
        </label>
        <label className="leo-training-form__field">
          <span>Mode</span>
          <select
            value={form.requestMode}
            onChange={event => setForm(state => ({ ...state, requestMode: event.target.value as TrainingRequestMode }))}
            disabled={submitting || form.trainingProfile !== 'track2'}
            data-testid="training-form-request-mode"
          >
            <option value="exploration">exploration</option>
            <option value="evaluation">evaluation</option>
          </select>
        </label>
      </div>

      <fieldset className="leo-training-form__fieldset">
        <legend>Network</legend>
        <label className="leo-training-form__field">
          <span>Episodes</span>
          <input type="number" value={form.episodes} onChange={event => setForm(state => ({ ...state, episodes: Number(event.target.value) }))} disabled={submitting} data-testid="training-form-episodes-input" />
        </label>
        <label className="leo-training-form__field">
          <span>Learning rate</span>
          <input type="number" step="0.0001" value={form.learningRate} onChange={event => setForm(state => ({ ...state, learningRate: Number(event.target.value) }))} disabled={submitting} />
        </label>
        <label className="leo-training-form__field">
          <span>Discount gamma</span>
          <input type="number" step="0.01" value={form.discountGamma} onChange={event => setForm(state => ({ ...state, discountGamma: Number(event.target.value) }))} disabled={submitting} />
        </label>
        <label className="leo-training-form__field">
          <span>Hidden dim</span>
          <input type="number" value={form.hiddenDim} onChange={event => setForm(state => ({ ...state, hiddenDim: Number(event.target.value) }))} disabled={submitting} />
        </label>
        <label className="leo-training-form__field">
          <span>Batch size</span>
          <input type="number" value={form.batchSize} onChange={event => setForm(state => ({ ...state, batchSize: Number(event.target.value) }))} disabled={submitting} />
        </label>
      </fieldset>

      <fieldset className="leo-training-form__fieldset">
        <legend>Objective</legend>
        <label className="leo-training-form__field">
          <span>ω throughput</span>
          <input type="number" step="0.01" value={form.omegaThroughput} onChange={event => setForm(state => ({ ...state, omegaThroughput: Number(event.target.value) }))} disabled={submitting} />
        </label>
        <label className="leo-training-form__field">
          <span>ω handover</span>
          <input type="number" step="0.01" value={form.omegaHandover} onChange={event => setForm(state => ({ ...state, omegaHandover: Number(event.target.value) }))} disabled={submitting} />
        </label>
        <label className="leo-training-form__field">
          <span>ω load balance</span>
          <input type="number" step="0.01" value={form.omegaLoadBalance} onChange={event => setForm(state => ({ ...state, omegaLoadBalance: Number(event.target.value) }))} disabled={submitting} />
        </label>
      </fieldset>

      <section
        className="leo-training-form__coverage"
        data-testid="training-form-coverage-estimate"
        data-beam-radius-km={coverageEstimate.beamRadiusKm.toFixed(3)}
        data-expected-ues-per-beam={coverageEstimate.expectedUesPerBeam.toFixed(3)}
        data-expected-ues-per-satellite={coverageEstimate.expectedUesPerSatellite.toFixed(3)}
      >
        <div className="leo-training-form__coverage-title">Coverage estimate</div>
        <div className="leo-training-form__coverage-grid">
          <span>3 dB radius</span>
          <output>{formatEstimate(coverageEstimate.beamRadiusKm)} km</output>
          <span>UE area</span>
          <output>{formatEstimate(coverageEstimate.ueAreaKm2, 0)} km²</output>
          <span>UE / beam</span>
          <output>{formatEstimate(coverageEstimate.expectedUesPerBeam)}</output>
          <span>UE / sat</span>
          <output>{formatEstimate(coverageEstimate.expectedUesPerSatellite)}</output>
        </div>
      </section>

      <fieldset className="leo-training-form__fieldset">
        <legend>Environment</legend>
        <label className="leo-training-form__field">
          <span>Satellites</span>
          <input type="number" value={form.nSatellites} onChange={event => setForm(state => ({ ...state, nSatellites: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} data-testid="training-form-satellite-count" />
        </label>
        <label className="leo-training-form__field">
          <span>Beams / satellite</span>
          <input type="number" value={form.beamsPerSatellite} onChange={event => setForm(state => ({ ...state, beamsPerSatellite: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} data-testid="training-form-beam-count" />
        </label>
        <label className="leo-training-form__field">
          <span>Beamwidth θ3dB</span>
          <input
            type="number"
            step="0.1"
            value={form.theta3dbDeg}
            onChange={event => setForm(state => ({ ...state, theta3dbDeg: Number(event.target.value) }))}
            disabled={submitting || form.trainingProfile !== 'track2'}
            data-testid="training-form-theta3db-deg"
          />
        </label>
        <label className="leo-training-form__field">
          <span>UE count</span>
          <input type="number" value={form.nUsers} onChange={event => setForm(state => ({ ...state, nUsers: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} data-testid="training-form-ue-count" />
        </label>
        <label className="leo-training-form__field">
          <span>UE speed km/h</span>
          <input type="number" value={form.userSpeedKmh} onChange={event => setForm(state => ({ ...state, userSpeedKmh: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>Altitude km</span>
          <input type="number" value={form.altitudeKm} onChange={event => setForm(state => ({ ...state, altitudeKm: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>Sat speed km/s</span>
          <input type="number" step="0.1" value={form.satelliteSpeedKmS} onChange={event => setForm(state => ({ ...state, satelliteSpeedKmS: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>Capacity cap</span>
          <input type="number" value={form.antiCollapseMaxUsersPerBeam} onChange={event => setForm(state => ({ ...state, antiCollapseMaxUsersPerBeam: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>QoS bps</span>
          <input type="number" value={form.qosThresholdBps} onChange={event => setForm(state => ({ ...state, qosThresholdBps: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} data-testid="training-form-qos-threshold" />
        </label>
      </fieldset>

      <fieldset className="leo-training-form__fieldset">
        <legend>UE Area</legend>
        <label className="leo-training-form__field">
          <span>Distribution</span>
          <select value={form.ueDistribution} onChange={event => setForm(state => ({ ...state, ueDistribution: event.target.value as FormState['ueDistribution'] }))} disabled={submitting || form.trainingProfile !== 'track2'} data-testid="training-form-ue-area-distribution">
            <option value="uniform-circular">uniform-circular</option>
            <option value="uniform-rectangle">uniform-rectangle</option>
          </select>
        </label>
        {form.ueDistribution === 'uniform-circular' ? (
          <label className="leo-training-form__field">
            <span>Radius km</span>
            <input type="number" value={form.ueRadiusKm} onChange={event => setForm(state => ({ ...state, ueRadiusKm: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
          </label>
        ) : (
          <>
            <label className="leo-training-form__field">
              <span>Width km</span>
              <input type="number" value={form.ueWidthKm} onChange={event => setForm(state => ({ ...state, ueWidthKm: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
            </label>
            <label className="leo-training-form__field">
              <span>Height km</span>
              <input type="number" value={form.ueHeightKm} onChange={event => setForm(state => ({ ...state, ueHeightKm: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
            </label>
          </>
        )}
        <label className="leo-training-form__field">
          <span>Mobility</span>
          <select value={form.ueMobilityModel} onChange={event => setForm(state => ({ ...state, ueMobilityModel: event.target.value as FormState['ueMobilityModel'] }))} disabled={submitting || form.trainingProfile !== 'track2'} data-testid="training-form-mobility-model">
            <option value="deterministic-heading">deterministic-heading</option>
            <option value="random-wandering">random-wandering</option>
          </select>
        </label>
        {form.ueMobilityModel === 'random-wandering' ? (
          <label className="leo-training-form__field">
            <span>Max turn rad</span>
            <input
              type="number"
              step="0.01"
              value={form.ueRandomWanderingMaxTurnRad}
              onChange={event => setForm(state => ({ ...state, ueRandomWanderingMaxTurnRad: Number(event.target.value) }))}
              disabled={submitting || form.trainingProfile !== 'track2'}
              data-testid="training-form-random-wandering-max-turn"
            />
          </label>
        ) : null}
      </fieldset>

      <fieldset className="leo-training-form__fieldset">
        <legend>Channel</legend>
        <label className="leo-training-form__field">
          <span>Carrier GHz</span>
          <input type="number" step="0.1" value={form.carrierFrequencyGhz} onChange={event => setForm(state => ({ ...state, carrierFrequencyGhz: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>Bandwidth MHz</span>
          <input type="number" value={form.bandwidthMhz} onChange={event => setForm(state => ({ ...state, bandwidthMhz: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>Tx power W</span>
          <input type="number" step="0.1" value={form.txPowerW} onChange={event => setForm(state => ({ ...state, txPowerW: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>Rician K dB</span>
          <input type="number" value={form.ricianKDb} onChange={event => setForm(state => ({ ...state, ricianKDb: Number(event.target.value) }))} disabled={submitting || form.trainingProfile !== 'track2'} />
        </label>
        <label className="leo-training-form__field">
          <span>Atmos loss dB/km</span>
          <input
            type="number"
            step="0.01"
            value={form.atmosphericAttenuationDbPerKm}
            onChange={event => setForm(state => ({ ...state, atmosphericAttenuationDbPerKm: Number(event.target.value) }))}
            disabled={submitting || form.trainingProfile !== 'track2'}
            data-testid="training-form-atmospheric-loss"
          />
        </label>
      </fieldset>

      {form.arm === 'a5_hobs' && form.trainingProfile === 'track2' ? (
        <fieldset className="leo-training-form__fieldset">
          <legend>HOBS</legend>
          <label className="leo-training-form__field">
            <span>γ_os dB</span>
            <input type="number" step="0.5" value={form.gammaOsDb} onChange={event => setForm(state => ({ ...state, gammaOsDb: Number(event.target.value) }))} disabled={submitting} data-testid="training-form-gamma-os" />
          </label>
          <label className="leo-training-form__field">
            <span>T threshold</span>
            <input type="number" value={form.tThresholdSteps} onChange={event => setForm(state => ({ ...state, tThresholdSteps: Number(event.target.value) }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field">
            <span>E_HO J</span>
            <input type="number" value={form.eHoPerEventJ} onChange={event => setForm(state => ({ ...state, eHoPerEventJ: Number(event.target.value) }))} disabled={submitting} data-testid="training-form-e-ho" />
          </label>
        </fieldset>
      ) : null}

      {form.arm !== 'a1' && form.trainingProfile === 'track2' ? (
        <fieldset className="leo-training-form__fieldset">
          <legend>Multi-Catfish</legend>
          <label className="leo-training-form__field">
            <span>Catfish α</span>
            <input type="number" step="0.01" value={form.catfishAlpha} onChange={event => setForm(state => ({ ...state, catfishAlpha: Number(event.target.value) }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field">
            <span>Quota EE</span>
            <input type="number" value={form.quotaEe} onChange={event => setForm(state => ({ ...state, quotaEe: Number(event.target.value) }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field">
            <span>Quota HO</span>
            <input type="number" value={form.quotaHo} onChange={event => setForm(state => ({ ...state, quotaHo: Number(event.target.value) }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field">
            <span>Quota load</span>
            <input type="number" value={form.quotaLoad} onChange={event => setForm(state => ({ ...state, quotaLoad: Number(event.target.value) }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field">
            <span>Main share floor</span>
            <input type="number" step="0.01" value={form.mainShareFloor} onChange={event => setForm(state => ({ ...state, mainShareFloor: Number(event.target.value) }))} disabled={submitting} data-testid="training-form-main-share-floor" />
          </label>
          <label className="leo-training-form__field">
            <span>VDN loss scale</span>
            <input type="number" step="0.1" value={form.vdnLossScale} onChange={event => setForm(state => ({ ...state, vdnLossScale: Number(event.target.value) }))} disabled={submitting} data-testid="training-form-vdn-loss-scale" />
          </label>
          <label className="leo-training-form__field">
            <span>Snapshot batch</span>
            <input type="number" value={form.snapshotBatchSize} onChange={event => setForm(state => ({ ...state, snapshotBatchSize: Number(event.target.value) }))} disabled={submitting} data-testid="training-form-snapshot-batch-size" />
          </label>
          <label className="leo-training-form__field">
            <span>Softmax temp</span>
            <input type="number" step="0.05" value={form.softmaxTemperature} onChange={event => setForm(state => ({ ...state, softmaxTemperature: Number(event.target.value) }))} disabled={submitting} data-testid="training-form-softmax-temperature" />
          </label>
        </fieldset>
      ) : null}

      {form.requestMode === 'evaluation' && form.trainingProfile === 'track2' ? (
        <fieldset className="leo-training-form__fieldset leo-training-form__fieldset--wide">
          <legend>Evaluation Provenance</legend>
          <label className="leo-training-form__field leo-training-form__field--wide">
            <span>Pre-reg SDD path</span>
            <input type="text" value={form.preRegSddPath} onChange={event => setForm(state => ({ ...state, preRegSddPath: event.target.value }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field leo-training-form__field--wide">
            <span>Pre-reg SDD SHA-256</span>
            <input type="text" value={form.preRegSddSha256} onChange={event => setForm(state => ({ ...state, preRegSddSha256: event.target.value }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field leo-training-form__field--wide">
            <span>Pre-reg JSON path</span>
            <input type="text" value={form.preRegJsonPath} onChange={event => setForm(state => ({ ...state, preRegJsonPath: event.target.value }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field leo-training-form__field--wide">
            <span>Pre-reg JSON SHA-256</span>
            <input type="text" value={form.preRegJsonSha256} onChange={event => setForm(state => ({ ...state, preRegJsonSha256: event.target.value }))} disabled={submitting} />
          </label>
          <label className="leo-training-form__field leo-training-form__field--wide">
            <span>Eval-only QoS tiers bps</span>
            <input
              type="text"
              value={form.evalOnlyQosThresholds}
              onChange={event => setForm(state => ({ ...state, evalOnlyQosThresholds: event.target.value }))}
              disabled={submitting}
              data-testid="training-form-eval-qos-tiers"
            />
          </label>
        </fieldset>
      ) : null}

      {form.submissionMode === 'sweep' ? (
        <fieldset className="leo-training-form__fieldset leo-training-form__fieldset--wide">
          <legend>Sensitivity Sweep</legend>
          <label className="leo-training-form__field">
            <span>Axis</span>
            <select
              value={form.sweepAxis}
              onChange={event => setForm(state => ({ ...state, sweepAxis: event.target.value as SweepAxisPath }))}
              disabled={submitting || form.trainingProfile !== 'track2'}
              data-testid="training-form-sweep-axis"
            >
              {SWEEP_AXIS_OPTIONS.map(option => (
                <option key={option.path} value={option.path}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="leo-training-form__field leo-training-form__field--wide">
            <span>Values</span>
            <input
              type="text"
              value={form.sweepValues}
              onChange={event => setForm(state => ({ ...state, sweepValues: event.target.value }))}
              disabled={submitting || form.trainingProfile !== 'track2'}
              data-testid="training-form-sweep-values"
            />
          </label>
        </fieldset>
      ) : null}

      <div className="leo-training-form__presets">
        <button type="button" data-testid="training-form-quick" onClick={handleQuick} disabled={submitting}>
          Quick (100 ep)
        </button>
        <button type="button" data-testid="training-form-full" onClick={handleFull} disabled={submitting} title="Backend caps episodes at 5000.">
          Full (5000 ep)
        </button>
      </div>
      <button type="button" data-testid="training-form-submit" onClick={handleSubmit} disabled={submitting || (validation !== null && reachable)}>
        {submitting ? 'Starting...' : form.submissionMode === 'sweep' ? 'Start sweep' : 'Start training'}
      </button>
      {validation ? (
        <div role="alert" className="leo-training-form__clamp-banner">
          {validation}
        </div>
      ) : null}
      {error ? (
        <div role="alert" data-testid="training-form-error" className="leo-training-form__error">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" data-testid="training-form-success" className="leo-training-form__success">
          {success.kind === 'batch'
            ? `Started batch ${success.batchId} (${success.jobIds.length} jobs)`
            : `Started job ${success.jobId}`}
        </div>
      ) : null}
    </section>
  );
}
