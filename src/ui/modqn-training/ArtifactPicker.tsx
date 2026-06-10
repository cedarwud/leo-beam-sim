import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import {
  HEADER_ABSENT_SOURCE,
  PRODUCER_PINNED_SOURCE,
  SYNTHETIC_FIXTURE_SOURCE,
} from '../ArtifactSourceBadge';
import { readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { getJobDetail, getJobs, deleteJob } from '../../modqn/training-trigger/serviceClient';
import { fetchTrainingServiceManifest } from '../../modqn/training-trigger/artifactManifest';
import { removeSubmittedJobId } from '../../modqn/training-trigger/submittedJobs';
import { shortJobId } from '../../modqn/training-trigger/jobsPolling';
import type {
  EnvAxes,
  ObjectiveWeights,
  TrainingArm,
  TrainingJobDetail,
  TrainingJobSummary,
  TrainingServiceManifest,
} from '../../modqn/training-trigger/types';

const PICKER_POLL_MS = 30000;
const ARM_ORDER: readonly TrainingArm[] = ['a1', 'a4', 'a5_hobs'];

interface ArtifactPickerProps {
  readonly appMode: AppExperienceMode;
  readonly selectedJobId: string | null;
  readonly bundleProvenanceKind: 'paper-faithful' | 'user-trained';
  readonly artifactReplaySource: string | null;
  readonly onLoadEntry: (jobId: string) => void;
  readonly onLoadPaperFaithful: () => void | Promise<void>;
}

function formatTimestamp(timestampMs: number | undefined): string {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return 'unknown time';
  return new Date(timestampMs).toLocaleString();
}

function envAxesFromDetail(detail: TrainingJobDetail | undefined): EnvAxes | undefined {
  return detail?.trainingTruth?.envAxes ?? detail?.request?.track2?.envAxes;
}

function envAxesFromSources(
  detail: TrainingJobDetail | undefined,
  manifest: TrainingServiceManifest | null | undefined,
): EnvAxes | undefined {
  return manifest?.trainingTruth?.envAxes ?? envAxesFromDetail(detail);
}

function armFromSources(
  detail: TrainingJobDetail | undefined,
  manifest: TrainingServiceManifest | null | undefined,
  job: TrainingJobSummary | undefined,
): TrainingArm | undefined {
  return manifest?.arm ?? detail?.arm ?? detail?.request?.track2?.arm ?? job?.arm ?? undefined;
}

function formatEnvAxes(envAxes: EnvAxes | undefined): string {
  if (envAxes === undefined) return 'env pending';
  return `${envAxes.nSatellites} sat · ${envAxes.antenna.beamsPerSatellite} beam · ${envAxes.nUsers} UE · ${envAxes.userSpeedKmh} km/h`;
}

function claimModeFromManifest(manifest: TrainingServiceManifest | null | undefined): string {
  if (manifest === undefined) return 'claim pending';
  if (manifest === null) return 'claim unavailable';
  if (manifest.claimMode === 'pre-registered-evaluation') return 'pre-registered-evaluation';
  if (manifest.claimMode === 'exploration' || manifest.claimMode === undefined) return 'exploration';
  return manifest.claimMode;
}

function claimModeTone(claimMode: string): 'evaluation' | 'exploration' | 'pending' {
  if (claimMode === 'pre-registered-evaluation') return 'evaluation';
  if (claimMode === 'exploration') return 'exploration';
  return 'pending';
}

function seedTripletFromSources(
  detail: TrainingJobDetail | undefined,
  manifest: TrainingServiceManifest | null | undefined,
): readonly number[] | undefined {
  return manifest?.trainingTruth?.seedTriplet
    ?? detail?.trainingTruth?.seedTriplet
    ?? detail?.request?.hyperparams.seedTriplet;
}

function formatSeedTriplet(seedTriplet: readonly number[] | undefined): string {
  return seedTriplet === undefined || seedTriplet.length === 0
    ? 'seed pending'
    : `seed ${seedTriplet.join('/')}`;
}

function objectiveWeightsFromSources(
  detail: TrainingJobDetail | undefined,
  manifest: TrainingServiceManifest | null | undefined,
): ObjectiveWeights | undefined {
  return manifest?.trainingTruth?.objectiveWeights
    ?? detail?.trainingTruth?.objectiveWeights
    ?? detail?.request?.hyperparams.objectiveWeights
    ?? detail?.hyperparams.objectiveWeights;
}

function formatObjectiveWeights(weights: ObjectiveWeights | undefined): string {
  if (weights === undefined) return 'omega pending';
  return `omega ${weights.throughput}/${weights.handover}/${weights.loadBalance}`;
}

function replayStatusFromManifest(manifest: TrainingServiceManifest | null | undefined): string {
  if (manifest === undefined) return 'replay pending';
  if (manifest === null) return 'replay unknown';
  if (manifest.replayBundle?.present === true) return 'replay yes';
  if (manifest.replayBundle?.present === false) return 'replay no';
  return 'replay unknown';
}

function paperFaithfulStatusFromManifest(manifest: TrainingServiceManifest | null | undefined): string {
  if (manifest === undefined) return 'paperFaithful pending';
  if (manifest === null) return 'paperFaithful unknown';
  return manifest.paperFaithful === false ? 'paperFaithful false' : 'paperFaithful unexpected';
}

function envGroupKey(envAxes: EnvAxes): string {
  return [
    envAxes.nSatellites,
    envAxes.antenna.beamsPerSatellite,
    envAxes.nUsers,
    envAxes.userSpeedKmh,
    envAxes.ueArea.distribution,
    envAxes.ueArea.radiusKm ?? envAxes.ueArea.widthKm ?? 'na',
    envAxes.ueArea.heightKm ?? 'na',
    envAxes.altitudeKm,
  ].join('|');
}

function isLoadableManifest(
  manifest: TrainingServiceManifest | null | undefined,
): manifest is TrainingServiceManifest {
  return manifest?.replayBundle?.present === true;
}

function requestModeFromSources(
  detail: TrainingJobDetail | undefined,
  manifest: TrainingServiceManifest | null | undefined,
): string {
  return detail?.request?.track2?.requestMode
    ?? (manifest?.claimMode === 'pre-registered-evaluation' ? 'evaluation' : undefined)
    ?? (manifest?.claimMode === 'exploration' ? 'exploration' : undefined)
    ?? 'request mode pending';
}

function checkpointStatusFromManifest(manifest: TrainingServiceManifest): string {
  const checkpointCount = manifest.rawRun?.checkpointPaths?.length ?? 0;
  const checkpointLabel = checkpointCount > 0
    ? `${checkpointCount} checkpoint${checkpointCount === 1 ? '' : 's'}`
    : 'checkpoint pending';
  const configHash = manifest.configFingerprintSha256 === undefined
    ? 'config hash pending'
    : `config ${manifest.configFingerprintSha256.slice(0, 10)}`;
  return `${checkpointLabel} · ${configHash}`;
}

function artifactReplaySourceLabel(source: string | null): string {
  if (source === PRODUCER_PINNED_SOURCE) return 'producer-pinned artifact replay';
  if (source === SYNTHETIC_FIXTURE_SOURCE) return 'synthetic fixture fallback';
  if (source === HEADER_ABSENT_SOURCE) return 'unknown artifact source';
  if (source === null) return 'artifact source pending';
  return `non-producer artifact source: ${source}`;
}

interface AblationGroupEntry {
  readonly key: string;
  readonly label: string;
  readonly byArm: Partial<Record<TrainingArm, TrainingJobSummary>>;
}

export function ArtifactPicker({
  appMode,
  selectedJobId,
  bundleProvenanceKind,
  artifactReplaySource,
  onLoadEntry,
  onLoadPaperFaithful,
}: ArtifactPickerProps): ReactElement | null {
  const enabled = appMode === 'modqn-demo';
  const [doneJobs, setDoneJobs] = useState<readonly TrainingJobSummary[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, TrainingJobDetail | undefined>>({});
  const [manifestsById, setManifestsById] = useState<Record<string, TrainingServiceManifest | null | undefined>>({});
  const [armFilter, setArmFilter] = useState<'all' | TrainingArm>('all');
  const [satelliteFilter, setSatelliteFilter] = useState<'all' | string>('all');
  const [userFilter, setUserFilter] = useState<'all' | string>('all');
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    cancelledRef.current = false;
    if (!enabled) return;

    const tick = async () => {
      if (cancelledRef.current) return;
      try {
        const response = await getJobs(
          { baseUrl: readTrainingServiceBaseUrl() },
          { status: 'done', limit: 50 },
        );
        if (cancelledRef.current) return;
        setDoneJobs(response.jobs);
      } catch {
        // ignore - keep last good list
      }
      if (cancelledRef.current) return;
      timerRef.current = setTimeout(tick, PICKER_POLL_MS);
    };

    void tick();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, refreshCount]);

  useEffect(() => {
    if (!enabled || doneJobs.length === 0) return;
    let cancelled = false;
    const missing = doneJobs.filter(job => detailsById[job.jobId] === undefined);
    if (missing.length === 0) return;
    Promise.allSettled(
      missing.slice(0, 25).map(job => getJobDetail(
        { baseUrl: readTrainingServiceBaseUrl() },
        job.jobId,
      )),
    ).then(results => {
      if (cancelled) return;
      setDetailsById(current => {
        const next = { ...current };
        let changed = false;
        for (const result of results) {
          if (result.status === 'fulfilled') {
            next[result.value.jobId] = result.value;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
    return () => { cancelled = true; };
  }, [detailsById, doneJobs, enabled]);

  useEffect(() => {
    if (!enabled || doneJobs.length === 0) return;
    let cancelled = false;
    const missing = doneJobs.filter(job => manifestsById[job.jobId] === undefined);
    if (missing.length === 0) return;
    Promise.allSettled(
      missing.slice(0, 25).map(job => fetchTrainingServiceManifest(
        { baseUrl: readTrainingServiceBaseUrl() },
        job.jobId,
      )),
    ).then(results => {
      if (cancelled) return;
      setManifestsById(current => {
        const next = { ...current };
        let changed = false;
        results.forEach((result, index) => {
          const jobId = missing[index]?.jobId;
          if (jobId === undefined) return;
          next[jobId] = result.status === 'fulfilled' ? result.value : null;
          changed = true;
        });
        return changed ? next : current;
      });
    });
    return () => { cancelled = true; };
  }, [doneJobs, enabled, manifestsById]);

  const handleLoad = useCallback((jobId: string) => {
    onLoadEntry(jobId);
  }, [onLoadEntry]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      await deleteJob({ baseUrl: readTrainingServiceBaseUrl() }, jobId);
    } catch {
      // ignore
    }
    removeSubmittedJobId(jobId);
    setRefreshCount(c => c + 1);
  }, []);

  if (!enabled) return null;

  const loadableJobs = doneJobs.filter(job => isLoadableManifest(manifestsById[job.jobId]));
  const filteredLibraryJobs = loadableJobs.filter(job => {
    const detail = detailsById[job.jobId];
    const manifest = manifestsById[job.jobId];
    const envAxes = envAxesFromSources(detail, manifest);
    const arm = armFromSources(detail, manifest, job);
    if (armFilter !== 'all' && arm !== armFilter) return false;
    if (satelliteFilter !== 'all' && envAxes?.nSatellites !== Number(satelliteFilter)) return false;
    if (userFilter !== 'all' && envAxes?.nUsers !== Number(userFilter)) return false;
    return true;
  }).sort((a, b) => b.submittedAtMs - a.submittedAtMs);
  const ablationGroupsByKey = new Map<string, AblationGroupEntry>();
  for (const job of filteredLibraryJobs) {
    const detail = detailsById[job.jobId];
    const manifest = manifestsById[job.jobId];
    const envAxes = envAxesFromSources(detail, manifest);
    const arm = armFromSources(detail, manifest, job);
    if (envAxes === undefined || arm === undefined || arm === null) continue;
    const key = envGroupKey(envAxes);
    const existing = ablationGroupsByKey.get(key) ?? {
      key,
      label: formatEnvAxes(envAxes),
      byArm: {},
    };
    const previous = existing.byArm[arm];
    if (previous === undefined || job.submittedAtMs > previous.submittedAtMs) {
      existing.byArm[arm] = job;
    }
    ablationGroupsByKey.set(key, existing);
  }
  const ablationGroups = [...ablationGroupsByKey.values()]
    .sort((a, b) => {
      const newestA = Math.max(...ARM_ORDER.map(arm => a.byArm[arm]?.submittedAtMs ?? 0));
      const newestB = Math.max(...ARM_ORDER.map(arm => b.byArm[arm]?.submittedAtMs ?? 0));
      return newestB - newestA;
    })
    .slice(0, 6);
  const isEmpty = filteredLibraryJobs.length === 0;
  const envOptions = [...new Map(
    loadableJobs
      .map(job => envAxesFromSources(detailsById[job.jobId], manifestsById[job.jobId]))
      .filter((envAxes): envAxes is EnvAxes => envAxes !== undefined)
      .map(envAxes => [`${envAxes.nSatellites}:${envAxes.nUsers}`, envAxes]),
  ).values()];
  const satelliteOptions = [...new Set(envOptions.map(envAxes => envAxes.nSatellites))].sort((a, b) => a - b);
  const userOptions = [...new Set(envOptions.map(envAxes => envAxes.nUsers))].sort((a, b) => a - b);

  return (
    <section
      className="artifact-picker"
      aria-label="MODQN model library"
      data-testid="artifact-picker"
      data-surface="model-library"
    >
      <header className="artifact-picker__section" data-testid="artifact-picker-paper-faithful-section">
        <h3>Paper-faithful baseline</h3>
        <div
          className={
            bundleProvenanceKind === 'paper-faithful'
              ? 'artifact-picker__entry artifact-picker__entry--selected'
              : 'artifact-picker__entry'
          }
          data-testid="artifact-picker-paper-faithful-entry"
          data-artifact-kind="paper-faithful"
          data-loadable="true"
          aria-current={bundleProvenanceKind === 'paper-faithful' ? 'true' : undefined}
        >
          <div className="artifact-picker__entry-header">
            <span className="artifact-picker__job-id">baseline replay</span>
            <span className="artifact-picker__chip-stack">
              <span className="artifact-picker__chip artifact-picker__chip--paper-faithful">paper-faithful</span>
              <span className="artifact-picker__chip artifact-picker__chip--claim-evaluation">replay surface</span>
            </span>
          </div>
          <div className="artifact-picker__meta" data-testid="artifact-picker-paper-faithful-truth-row">
            Built-in replay bundle · immutable baseline surface · producer proof still source-gap gated where fields are absent.
          </div>
          <button
            type="button"
            data-testid="revert-to-paper-faithful"
            disabled={bundleProvenanceKind === 'paper-faithful'}
            onClick={() => { void onLoadPaperFaithful(); }}
            aria-pressed={bundleProvenanceKind === 'paper-faithful' ? 'true' : undefined}
          >
            Load paper-faithful replay
          </button>
        </div>
      </header>

      <header className="artifact-picker__section" data-testid="artifact-picker-producer-official-section">
        <h3>Producer-official models</h3>
        <div
          className="artifact-picker__producer-empty"
          data-testid="artifact-picker-producer-empty"
          data-artifact-kind="producer-official"
          data-loadable="false"
        >
          No producer-official manifest with replay or trace surface is available in this build.
        </div>
      </header>

      <header className="artifact-picker__section" data-testid="artifact-picker-synthetic-section">
        <h3>Synthetic / fallback artifacts</h3>
        <div
          className="artifact-picker__entry artifact-picker__entry--disabled"
          data-testid="artifact-picker-synthetic-entry"
          data-artifact-kind="synthetic-fixture"
          data-artifact-source={artifactReplaySource ?? 'pending'}
          data-loadable="false"
        >
          <div className="artifact-picker__entry-header">
            <span className="artifact-picker__job-id">artifact fallback</span>
            <span className="artifact-picker__chip-stack">
              <span className="artifact-picker__chip artifact-picker__chip--synthetic">not producer proof</span>
            </span>
          </div>
          <div className="artifact-picker__meta">
            {artifactReplaySourceLabel(artifactReplaySource)} · synthetic or unverified sources stay disabled in the MODQN proof library.
          </div>
          <button type="button" data-testid="artifact-picker-synthetic-load" disabled>
            Not loadable as MODQN proof
          </button>
        </div>
      </header>

      <header className="artifact-picker__section" data-testid="artifact-picker-user-trained-section">
        <h3>User-trained models</h3>
        <div className="artifact-picker__filters" aria-label="Model filters">
          <label>
            <span>Arm</span>
            <select value={armFilter} onChange={event => setArmFilter(event.target.value as 'all' | TrainingArm)} data-testid="artifact-picker-arm-filter">
              <option value="all">all</option>
              <option value="a1">a1</option>
              <option value="a4">a4</option>
              <option value="a5_hobs">a5_hobs</option>
            </select>
          </label>
          <label>
            <span>Sat</span>
            <select value={satelliteFilter} onChange={event => setSatelliteFilter(event.target.value)}>
              <option value="all">all</option>
              {satelliteOptions.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>UE</span>
            <select value={userFilter} onChange={event => setUserFilter(event.target.value)}>
              <option value="all">all</option>
              {userOptions.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        {isEmpty ? (
          <div className="artifact-picker__empty" data-testid="artifact-picker-empty">
            No loadable user-trained models yet.
          </div>
        ) : (
          <>
            {ablationGroups.length > 0 ? (
              <div className="artifact-picker__ablation" aria-label="Multi-Catfish ablation comparison">
                <h4>Same-env ablations</h4>
                {ablationGroups.map(group => (
                  <div className="artifact-picker__ablation-row" key={group.key}>
                    <div className="artifact-picker__meta">{group.label}</div>
                    <div className="artifact-picker__ablation-arms">
                      {ARM_ORDER.map(arm => {
                        const job = group.byArm[arm];
                        const selected = job !== undefined && selectedJobId === job.jobId;
                        const detail = job === undefined ? undefined : detailsById[job.jobId];
                        const manifest = job === undefined ? undefined : manifestsById[job.jobId];
                        const claimMode = claimModeFromManifest(manifest);
                        const seedTriplet = seedTripletFromSources(detail, manifest);
                        return (
                          <div
                            key={arm}
                            className="artifact-picker__ablation-arm-card"
                            data-testid="artifact-picker-ablation-arm-card"
                            data-arm={arm}
                            data-claim-mode={claimMode}
                            data-replay-status={replayStatusFromManifest(manifest)}
                          >
                            <button
                              type="button"
                              data-testid="artifact-picker-ablation-load"
                              disabled={job === undefined || !isLoadableManifest(manifest)}
                              onClick={() => { if (job) handleLoad(job.jobId); }}
                              aria-pressed={selected ? 'true' : undefined}
                            >
                              {arm}
                            </button>
                            <div className="artifact-picker__ablation-truth" data-testid="artifact-picker-ablation-truth">
                              <span>{claimMode}</span>
                              <span>{formatSeedTriplet(seedTriplet)}</span>
                              <span>{replayStatusFromManifest(manifest)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="artifact-picker__entries">
              {filteredLibraryJobs.map(job => {
                const selected = selectedJobId === job.jobId;
                const detail = detailsById[job.jobId];
                const manifest = manifestsById[job.jobId];
                if (!isLoadableManifest(manifest)) return null;
                const envAxes = envAxesFromSources(detail, manifest);
                const claimMode = claimModeFromManifest(manifest);
                const seedTriplet = seedTripletFromSources(detail, manifest);
                const objectiveWeights = objectiveWeightsFromSources(detail, manifest);
                return (
                  <div
                    key={job.jobId}
                    className={
                      selected
                        ? 'artifact-picker__entry artifact-picker__entry--selected'
                        : 'artifact-picker__entry'
                    }
                    data-testid="artifact-picker-entry"
                    aria-current={selected ? 'true' : undefined}
                  >
                    <div className="artifact-picker__entry-header">
                      <span className="artifact-picker__job-id">{shortJobId(job.jobId)}</span>
                      <span className="artifact-picker__chip-stack">
                        <span className="artifact-picker__chip artifact-picker__chip--user-trained" data-testid="artifact-picker-user-trained-chip">user-trained</span>
                        <span
                          className={`artifact-picker__chip artifact-picker__chip--claim artifact-picker__chip--claim-${claimModeTone(claimMode)}`}
                          data-testid="artifact-picker-claim-mode-chip"
                        >
                          {claimMode}
                        </span>
                      </span>
                    </div>
                    <div className="artifact-picker__meta">
                      {job.status} · submitted {formatTimestamp(job.submittedAtMs)} · finished {formatTimestamp(job.finishedAtMs)}
                    </div>
                    <div className="artifact-picker__meta">
                      {detail?.trainingProfile ?? manifest.trainingProfile ?? job.trainingProfile ?? 'profile pending'} · {armFromSources(detail, manifest, job) ?? 'legacy'} · {detail?.trainerSubcommand ?? manifest.trainerSubcommand ?? job.trainerSubcommand} · {requestModeFromSources(detail, manifest)}
                    </div>
                    <div className="artifact-picker__meta">
                      {formatEnvAxes(envAxes)}
                    </div>
                    <div className="artifact-picker__meta" data-testid="artifact-picker-truth-row">
                      {formatSeedTriplet(seedTriplet)} · {formatObjectiveWeights(objectiveWeights)} · {replayStatusFromManifest(manifest)} · {paperFaithfulStatusFromManifest(manifest)}
                    </div>
                    <div className="artifact-picker__meta">
                      {checkpointStatusFromManifest(manifest)}
                    </div>
                    <div className="artifact-picker__summary">{detail?.hyperparamSummary ?? job.hyperparamSummary}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        style={{ flex: 2, marginTop: 0 }}
                        data-testid="artifact-picker-load"
                        disabled={!isLoadableManifest(manifest)}
                        onClick={() => handleLoad(job.jobId)}
                      >
                        Load into scene
                      </button>
                      <button
                        type="button"
                        className="artifact-picker__delete-btn"
                        style={{ flex: 1, marginTop: 0 }}
                        data-testid="artifact-picker-delete"
                        onClick={() => { void handleDeleteJob(job.jobId); }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </header>
    </section>
  );
}
