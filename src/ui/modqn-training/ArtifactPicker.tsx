import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { AppExperienceMode } from '../appMode';
import { readTrainingServiceBaseUrl } from '../../modqn/training-trigger/baseUrl';
import { getJobDetail, getJobs } from '../../modqn/training-trigger/serviceClient';
import { fetchTrainingServiceManifest } from '../../modqn/training-trigger/artifactManifest';
import {
  readSubmittedJobIds,
  type SubmittedJobRecord,
} from '../../modqn/training-trigger/submittedJobs';
import { shortJobId } from '../../modqn/training-trigger/jobsPolling';
import type {
  EnvAxes,
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
  readonly onLoadEntry: (jobId: string) => void;
}

function formatTimestamp(timestampMs: number | undefined): string {
  if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) return 'unknown time';
  return new Date(timestampMs).toLocaleString();
}

function toSubmittedRecord(job: TrainingJobSummary): SubmittedJobRecord {
  return {
    jobId: job.jobId,
    ...(job.batchId ? { batchId: job.batchId } : {}),
    submittedAtMs: job.submittedAtMs,
    hyperparamSummary: job.hyperparamSummary,
  };
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

function replayStatusFromManifest(manifest: TrainingServiceManifest | null | undefined): string {
  if (manifest === undefined) return 'replay pending';
  if (manifest === null) return 'replay unknown';
  return manifest.replayBundle?.present === false ? 'replay no' : 'replay yes';
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

interface AblationGroupEntry {
  readonly key: string;
  readonly label: string;
  readonly byArm: Partial<Record<TrainingArm, TrainingJobSummary>>;
}

export function ArtifactPicker({
  appMode,
  selectedJobId,
  onLoadEntry,
}: ArtifactPickerProps): ReactElement | null {
  const enabled = appMode === 'modqn-demo';
  const [doneJobs, setDoneJobs] = useState<readonly TrainingJobSummary[]>([]);
  const [history, setHistory] = useState<readonly SubmittedJobRecord[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, TrainingJobDetail | undefined>>({});
  const [manifestsById, setManifestsById] = useState<Record<string, TrainingServiceManifest | null | undefined>>({});
  const [armFilter, setArmFilter] = useState<'all' | TrainingArm>('all');
  const [satelliteFilter, setSatelliteFilter] = useState<'all' | string>('all');
  const [userFilter, setUserFilter] = useState<'all' | string>('all');
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    cancelledRef.current = false;
    if (!enabled) return;
    setHistory(readSubmittedJobIds());

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
      setHistory(readSubmittedJobIds());
      timerRef.current = setTimeout(tick, PICKER_POLL_MS);
    };

    void tick();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

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

  if (!enabled) return null;

  const doneById = new Map(doneJobs.map(job => [job.jobId, job]));
  const historyById = new Map(history.map(record => [record.jobId, record]));
  const merged = [
    ...history.map(record => {
      const done = doneById.get(record.jobId);
      return done ? toSubmittedRecord(done) : record;
    }),
    ...doneJobs
      .filter(job => !historyById.has(job.jobId))
      .map(toSubmittedRecord),
  ].filter(record => {
    const detail = detailsById[record.jobId];
    const manifest = manifestsById[record.jobId];
    const envAxes = envAxesFromSources(detail, manifest);
    const arm = armFromSources(detail, manifest, doneById.get(record.jobId));
    if (armFilter !== 'all' && arm !== armFilter) return false;
    if (satelliteFilter !== 'all' && envAxes?.nSatellites !== Number(satelliteFilter)) return false;
    if (userFilter !== 'all' && envAxes?.nUsers !== Number(userFilter)) return false;
    return true;
  }).sort((a, b) => b.submittedAtMs - a.submittedAtMs);
  const ablationGroupsByKey = new Map<string, AblationGroupEntry>();
  for (const record of merged) {
    const job = doneById.get(record.jobId);
    if (job === undefined) continue;
    const detail = detailsById[record.jobId];
    const manifest = manifestsById[record.jobId];
    if (manifest === null || manifest?.replayBundle?.present === false) continue;
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
  const isEmpty = doneJobs.length === 0 && history.length === 0;
  const envOptions = [...new Map(
    doneJobs
      .map(job => envAxesFromSources(detailsById[job.jobId], manifestsById[job.jobId]))
      .filter((envAxes): envAxes is EnvAxes => envAxes !== undefined)
      .map(envAxes => [`${envAxes.nSatellites}:${envAxes.nUsers}`, envAxes]),
  ).values()];
  const satelliteOptions = [...new Set(envOptions.map(envAxes => envAxes.nSatellites))].sort((a, b) => a - b);
  const userOptions = [...new Set(envOptions.map(envAxes => envAxes.nUsers))].sort((a, b) => a - b);

  return (
    <section
      className="artifact-picker"
      aria-label="MODQN training artifacts"
      data-testid="artifact-picker"
    >
      <header className="artifact-picker__section">
        <h3>Producer-official bundles</h3>
        <div className="artifact-picker__producer-empty" data-testid="artifact-picker-producer-empty">
          No producer-official bundles available in this build.
        </div>
      </header>
      <header className="artifact-picker__section">
        <h3>User-trained bundles</h3>
        <div className="artifact-picker__filters" aria-label="Artifact filters">
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
            No training artifacts yet.
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
                              disabled={job === undefined}
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
              {merged.map(record => {
                const selected = selectedJobId === record.jobId;
                const detail = detailsById[record.jobId];
                const manifest = manifestsById[record.jobId];
                const envAxes = envAxesFromSources(detail, manifest);
                const claimMode = claimModeFromManifest(manifest);
                const seedTriplet = seedTripletFromSources(detail, manifest);
                const replayUnavailable = manifest === null || manifest?.replayBundle?.present === false;
                return (
                  <div
                    key={record.jobId}
                    className={
                      selected
                        ? 'artifact-picker__entry artifact-picker__entry--selected'
                        : 'artifact-picker__entry'
                    }
                    data-testid="artifact-picker-entry"
                    aria-current={selected ? 'true' : undefined}
                  >
                    <div className="artifact-picker__entry-header">
                      <span className="artifact-picker__job-id">{shortJobId(record.jobId)}</span>
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
                      {armFromSources(detail, manifest, doneById.get(record.jobId)) ?? 'legacy'} · {formatEnvAxes(envAxes)}
                    </div>
                    <div className="artifact-picker__meta" data-testid="artifact-picker-truth-row">
                      {formatSeedTriplet(seedTriplet)} · {replayStatusFromManifest(manifest)} · {paperFaithfulStatusFromManifest(manifest)}
                    </div>
                    {replayUnavailable ? (
                      <div className="artifact-picker__meta">replay-bundle unavailable</div>
                    ) : null}
                    <div className="artifact-picker__meta">
                      submitted {formatTimestamp(record.submittedAtMs)}
                    </div>
                    <div className="artifact-picker__summary">{record.hyperparamSummary}</div>
                    <button
                    type="button"
                    data-testid="artifact-picker-load"
                    disabled={replayUnavailable}
                    onClick={() => handleLoad(record.jobId)}
                  >
                      Load into scene
                    </button>
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
