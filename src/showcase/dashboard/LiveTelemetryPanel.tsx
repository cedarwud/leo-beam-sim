import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import {
  resolveTelemetryStatus,
  useLiveTelemetry,
  type TrainingProgressEvent,
  type TelemetryStatus,
} from './liveTelemetryStore';
import {
  REWARD_METRIC_KEYS,
  readFiniteMetric,
  resolveLiveEpisodeProgress,
  selectActiveTelemetryJob,
  selectTerminalRewardMetrics,
} from './selectActiveTelemetryJob';

export interface LiveTelemetryPanelProps {
  readonly variant?: 'sidebar' | 'dock';
}

interface LiveTelemetryTileProps {
  readonly title: string;
  readonly testId: string;
  readonly provenanceLabel: string;
  readonly provenanceStatus?: 'producer-backed' | 'source-gap';
  readonly frozen?: boolean;
  readonly children: ReactNode;
}

interface MetricRowProps {
  readonly label: string;
  readonly value: string;
}

function formatMetric(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(3);
}

function telemetryStatusLabel(status: TelemetryStatus): string {
  if (status === 'live') return 'live (connected)';
  if (status === 'stalled') return 'Telemetry stalled';
  return 'Offline';
}

function SourceGap({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <p className="leo-algorithm-dashboard__source-gap">
      source gap - not shown
      <span className="leo-live-telemetry-panel__source-gap-detail">{children}</span>
    </p>
  );
}

function ProvenanceChip({
  label,
  status,
}: {
  readonly label: string;
  readonly status: 'producer-backed' | 'source-gap';
}): JSX.Element {
  return (
    <span
      className="leo-algorithm-dashboard__provenance-chip"
      data-testid="live-telemetry-provenance-chip"
      data-plane="A"
      data-provenance-plane="A"
      data-provenance-status={status}
      title={label}
    >
      {label}
    </span>
  );
}

function LiveTelemetryTile({
  title,
  testId,
  provenanceLabel,
  provenanceStatus = 'producer-backed',
  frozen = false,
  children,
}: LiveTelemetryTileProps): JSX.Element {
  return (
    <section
      className={[
        'leo-algorithm-dashboard__tile',
        frozen ? 'leo-live-telemetry-panel__tile--frozen' : '',
      ].filter(Boolean).join(' ')}
      data-testid={testId}
      data-plane="A"
      data-provenance-status={provenanceStatus}
      data-frozen={frozen ? 'true' : 'false'}
    >
      <header className="leo-algorithm-dashboard__tile-header">
        <strong>{title}</strong>
        <span className="leo-algorithm-dashboard__chip-row">
          <ProvenanceChip label={provenanceLabel} status={provenanceStatus} />
        </span>
      </header>
      {children}
    </section>
  );
}

function MetricRow({ label, value }: MetricRowProps): JSX.Element {
  return (
    <div className="leo-algorithm-dashboard__metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function eventTimestamp(event: TrainingProgressEvent | null): string {
  if (event === null || !Number.isFinite(event.tsMs)) return 'not emitted';
  return new Date(event.tsMs).toLocaleTimeString();
}

export function LiveTelemetryPanel({
  variant = 'sidebar',
}: LiveTelemetryPanelProps): JSX.Element {
  const snapshot = useLiveTelemetry();
  const activeJobId = useMemo(() => selectActiveTelemetryJob(snapshot), [snapshot]);
  const entry = activeJobId === null ? null : (snapshot[activeJobId] ?? null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const telemetryStatus = entry === null
    ? 'offline'
    : resolveTelemetryStatus(
      entry.lastProgressMs,
      entry.lastHeartbeatMs,
      nowMs,
      entry.latestEvent.status,
    );
  const frozen = telemetryStatus === 'stalled' || telemetryStatus === 'offline';

  if (entry === null || activeJobId === null) {
    // No run loaded yet = "idle", a distinct neutral state from "offline" (a run
    // whose heartbeat was lost). Conflating the two would read as an alarm when
    // nothing is wrong. INV-2: idle / stalled / offline stay visually distinct.
    return (
      <section
        className="leo-algorithm-dashboard leo-live-telemetry-panel leo-live-telemetry-panel--empty"
        data-testid="live-telemetry-panel"
        data-variant={variant}
        data-telemetry-status="idle"
        data-plane="A"
      >
        <header className="leo-algorithm-dashboard__header">
          <strong>Live training telemetry</strong>
          <span>Plane A / live training</span>
          <span
            className="leo-live-telemetry-panel__status-badge"
            data-testid="live-telemetry-status-badge"
            data-telemetry-status="idle"
          >
            Idle
          </span>
        </header>
        <p className="leo-algorithm-dashboard__empty" data-testid="live-telemetry-empty">
          No active training run
          <span className="leo-live-telemetry-panel__empty-hint">
            Start a training job to stream live Plane-A telemetry.
          </span>
        </p>
      </section>
    );
  }

  const episodeProgress = resolveLiveEpisodeProgress(entry);
  const rewardMetrics = selectTerminalRewardMetrics(entry);
  const rewardSeries = entry.rewardHistory.map(point => point.scalarReward);

  return (
    <section
      className="leo-algorithm-dashboard leo-live-telemetry-panel"
      data-testid="live-telemetry-panel"
      data-variant={variant}
      data-telemetry-status={telemetryStatus}
      data-plane="A"
      data-job-id={activeJobId}
    >
      <header className="leo-algorithm-dashboard__header">
        <strong>Live training telemetry</strong>
        <span>Plane A / live training</span>
        <span
          className="leo-live-telemetry-panel__status-badge"
          data-testid="live-telemetry-status-badge"
          data-telemetry-status={telemetryStatus}
        >
          {telemetryStatusLabel(telemetryStatus)}
        </span>
      </header>

      <LiveTelemetryTile
        title="Episode progress"
        testId="live-telemetry-episode"
        provenanceLabel="Plane A / live training"
        frozen={frozen}
      >
        {episodeProgress === null ? (
          <SourceGap>waiting for the first progress event</SourceGap>
        ) : (
          <>
            <MetricRow
              label="episode"
              value={`${episodeProgress.episode} / ${episodeProgress.budget ?? 'unknown'}`}
            />
            <MetricRow label="last progress" value={eventTimestamp(entry.lastProgressEvent)} />
          </>
        )}
      </LiveTelemetryTile>

      <LiveTelemetryTile
        title="Terminal reward scalars"
        testId="live-telemetry-terminal-rewards"
        provenanceLabel="Plane A / terminal summary"
        frozen={frozen}
      >
        {rewardMetrics === undefined ? (
          <SourceGap>emitted at completion</SourceGap>
        ) : (
          <div className="leo-algorithm-dashboard__component-grid">
            {REWARD_METRIC_KEYS.map(([key, label]) => (
              <MetricRow key={key} label={label} value={formatMetric(readFiniteMetric(rewardMetrics, key))} />
            ))}
          </div>
        )}
      </LiveTelemetryTile>

      <LiveTelemetryTile
        title="Evolving reward curve"
        testId="live-telemetry-reward-curve"
        provenanceLabel={rewardSeries.length > 0 ? 'Plane A / live training' : 'Plane A / source gap'}
        provenanceStatus={rewardSeries.length > 0 ? 'producer-backed' : 'source-gap'}
        frozen={frozen}
      >
        {rewardSeries.length > 0 ? (
          <div
            className="leo-algorithm-dashboard__curve-wrap"
            role="img"
            aria-label="Evolving reward curve: episode-by-episode scalar reward trend"
          >
            <output aria-label="Reward samples">{rewardSeries.join(', ')}</output>
          </div>
        ) : (
          <SourceGap>requires producer change</SourceGap>
        )}
      </LiveTelemetryTile>

      <LiveTelemetryTile
        title="Loss"
        testId="live-telemetry-loss"
        provenanceLabel="Plane A / source gap"
        provenanceStatus="source-gap"
      >
        <SourceGap>requires producer change</SourceGap>
      </LiveTelemetryTile>

      <LiveTelemetryTile
        title="Pareto front"
        testId="live-telemetry-pareto"
        provenanceLabel="Plane A / source gap"
        provenanceStatus="source-gap"
      >
        <SourceGap>requires producer change</SourceGap>
      </LiveTelemetryTile>

      <LiveTelemetryTile
        title="Q-values"
        testId="live-telemetry-q-values"
        provenanceLabel="Plane A / source gap"
        provenanceStatus="source-gap"
      >
        <SourceGap>requires producer change</SourceGap>
      </LiveTelemetryTile>

      <LiveTelemetryTile
        title="Learning rate"
        testId="live-telemetry-learning-rate"
        provenanceLabel="Plane A / source gap"
        provenanceStatus="source-gap"
      >
        <SourceGap>requires producer change</SourceGap>
      </LiveTelemetryTile>
    </section>
  );
}
