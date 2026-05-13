import { useEffect, useMemo, useState } from 'react';
import { UI_CLASSES } from '../constants/uiTokens';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  createModqnReplayPlaybackDisplayState,
  getModqnReplayPlaybackModelValidationIssue,
  type ModqnReplayPlaybackDisplayState,
  type ModqnReplayPlaybackEventCounts,
  type ModqnReplayPlaybackModelValidationIssue,
  type ModqnReplayPlaybackShellModel,
} from '../modqn/replay-bundle/playback-shell';
import type { ModqnBeamReference, ModqnRewardVector } from '../modqn/replay-bundle/types';

interface ModqnReplayPlaybackShellProps {
  readonly model?: ModqnReplayPlaybackShellModel | null;
  readonly onDisplayStateChange?: (displayState: ModqnReplayPlaybackDisplayState | null) => void;
}

function formatNumber(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatBeamReference(ref: ModqnBeamReference): string {
  return `${ref.satId} / beam ${ref.localBeamIndex + 1} (${ref.beamId}, action ${ref.beamIndex})`;
}

function formatRewardVector(rewardVector: ModqnRewardVector): string {
  return Object.entries(rewardVector)
    .map(([key, value]) => `${key} ${formatNumber(value)}`)
    .join(' | ');
}

function formatEventCounts(eventCounts: ModqnReplayPlaybackEventCounts): string {
  return [
    `none ${eventCounts.none}`,
    `intra-sat ${eventCounts['intra-satellite-beam-switch']}`,
    `inter-sat ${eventCounts['inter-satellite-handover']}`,
  ].join(' | ');
}

function SourceMetric({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}) {
  return (
    <div className="leo-replay-playback-metric" data-testid={testId}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TruthRow({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}) {
  return (
    <div className="leo-replay-truth-row" data-testid={testId}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ModqnReplayFailClosedState({
  issue,
}: {
  readonly issue: ModqnReplayPlaybackModelValidationIssue;
}) {
  return (
    <section
      className="leo-replay-playback-shell leo-replay-playback-shell--fail-closed"
      data-testid="modqn-replay-playback-shell"
      data-replay-state="fail-closed"
      data-fail-closed-code={issue.code}
      aria-label="MODQN replay playback unavailable"
      aria-live="assertive"
    >
      <div className="leo-replay-playback-header">
        <div className="leo-replay-playback-title">
          <span data-testid="phase7f-mode-label">MODQN replay unavailable - fail closed</span>
          <strong data-testid="phase7f-evidence-status">no accepted replay displayed</strong>
        </div>
        <div className="leo-replay-playback-boundaries">
          <span>selected producer artifact missing or invalid</span>
          <span>no fixture fallback promoted</span>
          <span>HOBS/SINR live remains separate</span>
        </div>
      </div>

      <div className="leo-replay-fail-closed-detail" data-testid="modqn-replay-fail-closed">
        <span>Expected MODQN replay - 7-beam producer artifact / accepted-7beam-baseline.</span>
        <strong>{issue.message}</strong>
        <span>Replay controls and scene cues are blocked until the selected artifact model is valid.</span>
      </div>
    </section>
  );
}

export function ModqnReplayPlaybackShell({
  model = MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  onDisplayStateChange,
}: ModqnReplayPlaybackShellProps) {
  const [slotOffset, setSlotOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const modelIssue = getModqnReplayPlaybackModelValidationIssue(model);
  const maxSlotOffset = Math.max((model?.slots.length ?? 0) - 1, 0);

  useEffect(() => {
    setSlotOffset(current => Math.min(current, maxSlotOffset));
  }, [maxSlotOffset]);

  useEffect(() => {
    if (!playing) return undefined;

    const timer = window.setInterval(() => {
      setSlotOffset(current => {
        if (current < maxSlotOffset) return current + 1;
        if (loopEnabled) return 0;
        return current;
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [loopEnabled, maxSlotOffset, playing]);

  useEffect(() => {
    if (playing && !loopEnabled && slotOffset >= maxSlotOffset) {
      setPlaying(false);
    }
  }, [loopEnabled, maxSlotOffset, playing, slotOffset]);

  const displayState = useMemo(
    () => {
      if (modelIssue !== null || model === null || model === undefined) return null;
      return createModqnReplayPlaybackDisplayState(model, slotOffset, playing, loopEnabled);
    },
    [loopEnabled, model, modelIssue, playing, slotOffset],
  );
  const currentSlot = displayState?.currentSlot;
  const rewardVectorText = useMemo(
    () => currentSlot === undefined ? '' : formatRewardVector(currentSlot.focusRow.rewardVector),
    [currentSlot],
  );

  useEffect(() => {
    onDisplayStateChange?.(displayState);
  }, [displayState, onDisplayStateChange]);

  const handlePlayToggle = () => {
    if (!playing && !loopEnabled && slotOffset >= maxSlotOffset) {
      setSlotOffset(0);
    }
    setPlaying(current => !current);
  };

  if (model === null || model === undefined || modelIssue !== null || displayState === null || currentSlot === undefined) {
    return (
      <ModqnReplayFailClosedState
        issue={modelIssue ?? {
          code: 'missing-slots',
          message: 'Selected replay display model could not produce a current source slot.',
        }}
      />
    );
  }
  const activeModel = model;

  return (
    <section
      className="leo-replay-playback-shell"
      data-testid="modqn-replay-playback-shell"
      aria-label="MODQN replay playback shell"
    >
      <div className="leo-replay-playback-header">
        <div className="leo-replay-playback-title">
          <span data-testid="phase7f-mode-label">{activeModel.modeLabel}</span>
          <strong data-testid="phase7f-evidence-status">{activeModel.evidenceStatus}</strong>
        </div>
        <details
          className="leo-replay-playback-detail-group leo-replay-playback-detail-group--boundary"
          data-phase7h-open-for-validation="true"
        >
          <summary>Replay/live boundary</summary>
          <div className="leo-replay-playback-boundaries">
            <span>read-only source-slot playback</span>
            <span>producer diagnostics {activeModel.diagnosticsStatus}</span>
            <span>HOBS/SINR live controls separated</span>
          </div>
        </details>
      </div>

      <div className="leo-replay-playback-controls" aria-label="Replay playback controls">
        <button
          className={UI_CLASSES.button}
          type="button"
          aria-pressed={playing}
          data-testid="modqn-replay-play-toggle"
          onClick={handlePlayToggle}
        >
          {playing ? 'Pause replay' : 'Play replay'}
        </button>
        <button
          className={UI_CLASSES.button}
          type="button"
          data-testid="modqn-replay-reset"
          onClick={() => {
            setPlaying(false);
            setSlotOffset(0);
          }}
        >
          Reset
        </button>
        <label className="leo-replay-loop-toggle">
          <input
            className={UI_CLASSES.checkbox}
            type="checkbox"
            checked={loopEnabled}
            data-testid="modqn-replay-loop-toggle"
            onChange={event => setLoopEnabled(event.target.checked)}
          />
          Loop
        </label>
        <label className="leo-replay-scrub-label">
          <span>Scrub source slot</span>
          <input
            className={`${UI_CLASSES.range} leo-replay-scrub`}
            type="range"
            min={0}
            max={maxSlotOffset}
            step={1}
            value={slotOffset}
            aria-label="Scrub MODQN replay source slot"
            data-testid="modqn-replay-scrub"
            onChange={event => setSlotOffset(Number(event.target.value))}
          />
        </label>
      </div>

      <details
        className="leo-replay-playback-detail-group leo-replay-playback-detail-group--source"
        data-phase7h-open-for-validation="true"
      >
        <summary>Source slot details</summary>
        <div className="leo-replay-playback-status" aria-label="Current replay source position">
          <SourceMetric
            label="Current slot"
            value={`${currentSlot.slotIndex} / ${activeModel.slotCount}`}
            testId="modqn-replay-current-slot"
          />
          <SourceMetric
            label="Source rows"
            value={`${currentSlot.sourceRowStartIndex + 1}-${currentSlot.sourceRowEndIndex + 1} / ${activeModel.rowCount}`}
            testId="modqn-replay-current-row-range"
          />
          <SourceMetric
            label="Focus source row"
            value={`${currentSlot.focusRow.sourceRowIndex + 1} / ${activeModel.rowCount}`}
            testId="modqn-replay-current-focus-row"
          />
          <SourceMetric
            label="Slot event mix"
            value={formatEventCounts(currentSlot.eventCounts)}
            testId="modqn-replay-current-event-mix"
          />
          <SourceMetric
            label="Artifact event total"
            value={formatEventCounts(activeModel.eventCounts)}
            testId="modqn-replay-artifact-event-total"
          />
        </div>
      </details>

      <details
        className="leo-replay-playback-detail-group leo-replay-playback-detail-group--truth"
        data-phase7h-open-for-validation="true"
      >
        <summary>Producer truth details</summary>
        <div className="leo-replay-truth-summary" aria-label="Current replay producer truth summary">
          <TruthRow
            label="Selected serving"
            value={formatBeamReference(currentSlot.focusRow.selectedServing)}
            testId="modqn-replay-selected-serving"
          />
          <TruthRow
            label="Previous serving"
            value={formatBeamReference(currentSlot.focusRow.previousServing)}
            testId="modqn-replay-previous-serving"
          />
          <TruthRow
            label="Handover event"
            value={currentSlot.focusRow.handoverEventKind}
            testId="modqn-replay-handover-event"
          />
          <TruthRow
            label="Scalar reward"
            value={formatNumber(currentSlot.focusRow.scalarReward)}
            testId="modqn-replay-scalar-reward"
          />
          <TruthRow
            label="Reward vector"
            value={rewardVectorText}
            testId="modqn-replay-reward-vector"
          />
          <TruthRow
            label="Diagnostics"
            value={`${currentSlot.focusRow.diagnosticsStatus}; actions ${currentSlot.focusRow.availableActionCount ?? 'n/a'}`}
            testId="modqn-replay-diagnostics-status"
          />
        </div>
      </details>
    </section>
  );
}
