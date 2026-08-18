import {
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react';

import { visualLabExperienceCopy } from '../../prototype/visual-lab-g0/presentation/visualLabCopy';
import type {
  VisualLabInspectTarget,
  VisualLabLocale,
} from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';
import type {
  VisualLabStoryController,
  VisualLabStoryControllerState,
} from '../story';
import {
  formatStoryElapsedTime,
  formatStoryMetric,
  storyActiveBeatLabel,
  storyBeatLabel,
  storyPointMetrics,
  storySourceIdentities,
  storyStepForBeat,
  STORY_BEAT_PHASES,
  type StoryBeatPhase,
  type StoryRailStep,
} from './storyRailModel';
import './VisualLabStoryRail.scss';

/** A semantic beat is advanced by the controller, not by a hidden data clock. */
export const VISUAL_LAB_STORY_TICK_INTERVAL_MS = 800;

export interface VisualLabStoryRailProps {
  readonly controller: VisualLabStoryController;
  readonly locale: VisualLabLocale;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly onSeek: (timeSec: number) => void;
  readonly onInspect: (target: VisualLabInspectTarget) => void;
  readonly onForkExplore: () => void;
  /** Keeps the route-owned clip identity aligned when the rail changes story. */
  readonly onStoryChange?: (kind: 'inter-handover' | 'intra-handover', storyId: string) => void;
  /** Compact stage companion: the scene cue owns the active metrics. */
  readonly compact?: boolean;
  readonly className?: string;
}

const INSPECT_TARGETS: ReadonlyArray<{
  readonly target: VisualLabInspectTarget;
  readonly labelKey:
    | 'inspectScene'
    | 'inspectHandover'
    | 'inspectSinr'
    | 'inspectPower'
    | 'inspectThroughput'
    | 'inspectEnergyEfficiency';
}> = [
  { target: 'scene', labelKey: 'inspectScene' },
  { target: 'handover', labelKey: 'inspectHandover' },
  { target: 'sinr', labelKey: 'inspectSinr' },
  { target: 'power', labelKey: 'inspectPower' },
  { target: 'throughput', labelKey: 'inspectThroughput' },
  { target: 'energy-efficiency', labelKey: 'inspectEnergyEfficiency' },
];

const STATUS_LABELS: Readonly<Record<VisualLabLocale, Readonly<Record<VisualLabStoryControllerState['status'], string>>>> = {
  'zh-Hant': Object.freeze({
    idle: '待播放',
    playing: '播放中',
    paused: '已暫停',
    completed: '已完成',
    unavailable: '不可用',
  }),
  en: Object.freeze({
    idle: 'Ready',
    playing: 'Playing',
    paused: 'Paused',
    completed: 'Completed',
    unavailable: 'Unavailable',
  }),
};

function activeStory(state: VisualLabStoryControllerState) {
  return state.activeStoryId === null
    ? null
    : state.stories.find(story => story.storyId === state.activeStoryId) ?? null;
}

function seekFromState(
  next: VisualLabStoryControllerState,
  onSeek: (timeSec: number) => void,
): void {
  const timeSec = next.activeStepSeekTimeSec;
  if (typeof timeSec === 'number' && Number.isFinite(timeSec)) onSeek(timeSec);
}

function sourceLabel(
  fromSatelliteId: string | null,
  toSatelliteId: string | null,
): string | null {
  if (fromSatelliteId === null || toSatelliteId === null) return null;
  return `${fromSatelliteId} → ${toSatelliteId}`;
}

function pointIdentityLabel(step: StoryRailStep, locale: VisualLabLocale): string | null {
  if (step.beamTrace !== null) {
    const beam = locale === 'zh-Hant' ? '波束' : 'Beam';
    const satelliteId = step.beamTrace.from.satelliteId;
    if (step.phase === 'before') return `${satelliteId} · ${beam} ${step.beamTrace.from.beamId}`;
    if (step.phase === 'after') return `${satelliteId} · ${beam} ${step.beamTrace.to.beamId}`;
    return `${satelliteId} · ${beam} ${step.beamTrace.from.beamId} → ${step.beamTrace.to.beamId}`;
  }
  const point = step.point;
  if (point === null) return null;
  const candidate = point.candidateSatelliteId === null ? '—' : point.candidateSatelliteId;
  return `${point.servingSatelliteId} → ${candidate}`;
}

export function formatStoryReason(reason: string, locale: VisualLabLocale): string {
  if (locale === 'en') return reason;
  const forced = /^serving TLE satellite (\S+) left the NTPU horizon$/.exec(reason);
  if (forced !== null) return `服務衛星 ${forced[1]} 已離開 NTPU 可見範圍。`;
  const qualified = /^candidate TLE satellite (\S+) exceeded the serving SINR by ([\d.]+) dB for ([\d.]+) s$/.exec(reason);
  if (qualified !== null) {
    return `候選衛星 ${qualified[1]} 的 SINR 連續 ${qualified[3]} 秒比服務鏈路高至少 ${qualified[2]} dB。`;
  }
  return reason;
}

function StoryChoice({
  story,
  label,
  available,
  selected,
  availableCopy,
  unavailableCopy,
  onSelect,
  disabled,
}: {
  readonly story: ReturnType<typeof activeStory>;
  readonly label: string;
  readonly available: boolean;
  readonly selected: boolean;
  readonly availableCopy: string;
  readonly unavailableCopy: string;
  readonly onSelect: () => void;
  readonly disabled: boolean;
}) {
  const source = storySourceIdentities(story);
  const identity = available ? sourceLabel(source.fromSatelliteId, source.toSatelliteId) : null;
  return (
    <button
      type="button"
      className={`vlab-story-rail__choice${selected ? ' is-selected' : ''}${available ? '' : ' is-unavailable'}`}
      data-story-choice={story?.kind ?? 'inter-handover'}
      data-story-availability={available ? 'available' : 'unavailable'}
      aria-pressed={selected}
      aria-disabled={!available || disabled}
      disabled={!available || disabled}
      onClick={onSelect}
    >
      <span className="vlab-story-rail__choice-heading">
        <span className="vlab-story-rail__choice-mark" aria-hidden="true" />
        <span>{label}</span>
      </span>
      {identity ? <span className="vlab-story-rail__choice-identity">{identity}</span> : null}
      <span className="vlab-story-rail__choice-status">
        {available ? availableCopy : unavailableCopy}
      </span>
    </button>
  );
}

function MetricReadout({
  label,
  value,
  metric,
  locale,
  active,
}: {
  readonly label: string;
  readonly value: number | null;
  readonly metric: 'sinr' | 'throughput' | 'power' | 'energy-efficiency';
  readonly locale: VisualLabLocale;
  readonly active: boolean;
}) {
  return (
    <div className="vlab-story-rail__metric" data-metric={metric} data-value-source={active ? 'active-point' : 'timeline-point'}>
      <dt>{label}</dt>
      <dd>{formatStoryMetric(value, metric, locale)}</dd>
    </div>
  );
}

function StoryBeat({
  phase,
  step,
  active,
  locale,
  copy,
}: {
  readonly phase: StoryBeatPhase;
  readonly step: StoryRailStep | null;
  readonly active: boolean;
  readonly locale: VisualLabLocale;
  readonly copy: ReturnType<typeof visualLabExperienceCopy>;
}) {
  const point = step?.point ?? null;
  const metrics = storyPointMetrics(step);
  const identity = step === undefined || step === null ? null : pointIdentityLabel(step, locale);
  return (
    <article
      className={`vlab-story-rail__beat${active ? ' is-active' : ''}${point === null ? ' is-empty' : ''}`}
      data-story-beat={phase}
      aria-current={active ? 'step' : undefined}
    >
      <header className="vlab-story-rail__beat-heading">
        <span className="vlab-story-rail__beat-index">{STORY_BEAT_PHASES.indexOf(phase) + 1}</span>
        <h3>{storyBeatLabel(phase, locale)}</h3>
        {active ? <span className="vlab-story-rail__active-label">{storyActiveBeatLabel(locale)}</span> : null}
      </header>
      {point === null ? (
        <p className="vlab-story-rail__beat-empty" role="status">
          {copy.unavailable.waitingForSource}
        </p>
      ) : (
        <>
          <div className="vlab-story-rail__beat-source" data-source-identity="timeline-point">
            <span>{identity}</span>
            <time dateTime={point.instantUtc}>
              {formatStoryElapsedTime(point.timeSec, locale)}
            </time>
          </div>
          {step?.marker?.reason ? (
            <p className="vlab-story-rail__beat-note">{formatStoryReason(step.marker.reason, locale)}</p>
          ) : null}
          <dl className="vlab-story-rail__metrics" aria-label={`${storyBeatLabel(phase, locale)} metrics`}>
            <MetricReadout label={copy.moduleLabels.sinr} value={metrics.sinrDb} metric="sinr" locale={locale} active={active} />
            <MetricReadout label={copy.moduleLabels.throughput} value={metrics.throughputBps} metric="throughput" locale={locale} active={active} />
            <MetricReadout label={copy.moduleLabels.power} value={metrics.powerW} metric="power" locale={locale} active={active} />
            <MetricReadout label={copy.moduleLabels.energyEfficiency} value={metrics.energyEfficiencyBitsPerJ} metric="energy-efficiency" locale={locale} active={active} />
          </dl>
        </>
      )}
    </article>
  );
}

/**
 * A small presentation adapter over `VisualLabStoryController`.
 *
 * The controller owns story selection and semantic transitions.  This React
 * layer owns only the visible interval while status is `playing`; every tick
 * is delegated back to the controller and seeks the returned accepted point.
 */
export function VisualLabStoryRail({
  controller,
  locale,
  disabled = false,
  busy = false,
  onSeek,
  onInspect,
  onForkExplore,
  onStoryChange,
  compact = false,
  className,
}: VisualLabStoryRailProps) {
  const state = useSyncExternalStore(
    listener => controller.subscribe(listener),
    () => controller.state(),
    () => controller.state(),
  );
  const copy = visualLabExperienceCopy(locale, state.presentation.experience);
  const actionDisabled = disabled || busy;
  const selectedStory = activeStory(state);
  const interStory = state.stories.find(story => (
    story.kind === 'inter-handover'
      && story.storyId === state.availability.interHandover.selectedStoryId
  )) ?? state.stories.find(story => story.kind === 'inter-handover') ?? null;
  const intraStory = state.stories.find(story => story.kind === 'intra-handover') ?? null;
  const interAvailable = state.availability.interHandover.status === 'available'
    && interStory?.availability.status === 'available';
  const intraAvailable = state.availability.intraHandover.status === 'available'
    && intraStory?.availability.status === 'available';

  const commit = useCallback((action: () => VisualLabStoryControllerState) => {
    if (actionDisabled) return;
    seekFromState(action(), onSeek);
  }, [actionDisabled, onSeek]);

  useEffect(() => {
    if (actionDisabled || state.status !== 'playing') return undefined;
    const timer = setInterval(() => {
      const next = controller.tick();
      seekFromState(next, onSeek);
    }, VISUAL_LAB_STORY_TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [actionDisabled, controller, onSeek, state.status]);

  const selectStory = (storyId: string) => {
    const story = state.stories.find(candidate => candidate.storyId === storyId) ?? null;
    if (story !== null) onStoryChange?.(story.kind, storyId);
    commit(() => controller.selectStory(storyId));
  };

  const inspect = (target: VisualLabInspectTarget) => {
    if (actionDisabled) return;
    controller.inspect(target);
    onInspect(target);
  };

  const forkExplore = () => {
    if (actionDisabled) return;
    controller.forkToExplore();
    onForkExplore();
  };

  const statusLabel = busy ? copy.source.applying : STATUS_LABELS[locale][state.status];
  const classes = [
    'vlab-story-rail',
    `vlab-story-rail--${state.presentation.theme}`,
    compact ? 'vlab-story-rail--compact' : '',
    actionDisabled ? 'is-disabled' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <section
      className={classes}
      data-testid="visual-lab-story-rail"
      data-theme={state.presentation.theme}
      data-story-status={state.status}
      aria-busy={busy || undefined}
    >
      <header className="vlab-story-rail__header">
        <div>
          <p className="vlab-story-rail__eyebrow">{copy.storyControls.section}</p>
          <h2>{locale === 'zh-Hant' ? '換手事件重播' : 'Handover event replay'}</h2>
        </div>
        <span className="vlab-story-rail__status" role="status" aria-live="polite">
          {statusLabel}
        </span>
      </header>

      <div className="vlab-story-rail__choices" aria-label={copy.storyControls.section}>
        <StoryChoice
          story={interStory}
          label={copy.storyControls.interHandover}
          available={interAvailable}
          selected={state.activeStoryId === interStory?.storyId}
          availableCopy={copy.source.accepted}
          unavailableCopy={copy.unavailable.noCanonicalHandover}
          onSelect={() => { if (interStory) selectStory(interStory.storyId); }}
          disabled={actionDisabled}
        />
        <StoryChoice
          story={intraStory}
          label={copy.storyControls.intraHandover}
          available={intraAvailable}
          selected={state.activeStoryId === intraStory?.storyId}
          availableCopy={copy.source.accepted}
          unavailableCopy={copy.unavailable.noCanonicalBeamTrace}
          onSelect={() => { if (intraStory) selectStory(intraStory.storyId); }}
          disabled={actionDisabled}
        />
      </div>

      <div className="vlab-story-rail__availability" role="note">
        {!interAvailable ? (
          <p data-story-unavailable="inter-handover">
            <strong>{copy.unavailable.noCanonicalHandover}</strong>
          </p>
        ) : null}
        {!intraAvailable ? (
          <p data-story-unavailable="intra-handover">
            <strong>{copy.unavailable.noCanonicalBeamTrace}</strong>
          </p>
        ) : null}
      </div>

      <section
        className="vlab-story-rail__beats"
        aria-label={selectedStory?.kind === 'intra-handover'
          ? copy.storyControls.intraHandover
          : copy.storyControls.interHandover}
      >
        {STORY_BEAT_PHASES.map(phase => (
          <StoryBeat
            key={phase}
            phase={phase}
            step={storyStepForBeat(selectedStory, phase)}
            active={state.activeStep?.phase === phase}
            locale={locale}
            copy={copy}
          />
        ))}
      </section>

      <div className="vlab-story-rail__transport" aria-label={copy.timelineTransport.section}>
        <button
          type="button"
          className="vlab-story-rail__transport-button"
          aria-label={copy.timelineTransport.previous}
          disabled={actionDisabled}
          onClick={() => commit(() => controller.previous())}
        >
          <span aria-hidden="true">←</span>
          <span>{copy.timelineTransport.previous}</span>
        </button>
        <button
          type="button"
          className="vlab-story-rail__transport-button vlab-story-rail__transport-button--primary"
          aria-label={state.status === 'playing' ? copy.timelineTransport.pause : copy.timelineTransport.play}
          disabled={actionDisabled}
          onClick={() => commit(() => (
            state.status === 'playing' ? controller.pause() : controller.play()
          ))}
        >
          <span aria-hidden="true">{state.status === 'playing' ? 'Ⅱ' : '▶'}</span>
          <span>{state.status === 'playing' ? copy.timelineTransport.pause : copy.timelineTransport.play}</span>
        </button>
        <button
          type="button"
          className="vlab-story-rail__transport-button"
          aria-label={copy.timelineTransport.next}
          disabled={actionDisabled}
          onClick={() => commit(() => controller.next())}
        >
          <span>{copy.timelineTransport.next}</span>
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="vlab-story-rail__transport-button"
          aria-label={copy.timelineTransport.restart}
          disabled={actionDisabled}
          onClick={() => commit(() => controller.restart())}
        >
          <span aria-hidden="true">↺</span>
          <span>{copy.timelineTransport.restart}</span>
        </button>
      </div>

      <div className="vlab-story-rail__footer">
        <div className="vlab-story-rail__inspect" aria-label={copy.storyControls.inspect}>
          <span className="vlab-story-rail__inspect-label">{copy.storyControls.inspect}</span>
          <div className="vlab-story-rail__inspect-actions">
            {INSPECT_TARGETS.map(({ target, labelKey }) => (
              <button
                type="button"
                key={target}
                className="vlab-story-rail__inspect-button"
                disabled={actionDisabled}
                onClick={() => inspect(target)}
              >
                {copy.storyControls[labelKey]}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="vlab-story-rail__fork"
          disabled={actionDisabled}
          onClick={forkExplore}
        >
          {copy.storyControls.forkToExplore}
        </button>
      </div>
    </section>
  );
}

/** Short alias for route code that names this surface simply StoryRail. */
export const StoryRail = VisualLabStoryRail;

export default VisualLabStoryRail;
