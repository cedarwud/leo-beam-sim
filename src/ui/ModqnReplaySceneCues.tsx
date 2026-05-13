import type {
  ModqnReplayPlaybackDisplayState,
} from '../modqn/replay-bundle/playback-shell';
import type {
  ModqnBeamReference,
  ModqnHandoverEventKind,
} from '../modqn/replay-bundle/types';

interface ModqnReplaySceneCuesProps {
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
  readonly failClosedReason?: string;
}

interface ReplayCueProps {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly role: 'selected' | 'previous' | 'event' | 'focus';
  readonly testId: string;
}

function formatBeamCue(ref: ModqnBeamReference): string {
  return `${ref.satId} / beam ${ref.localBeamIndex + 1}`;
}

function formatBeamCueDetail(ref: ModqnBeamReference): string {
  return `${ref.beamId} | action ${ref.beamIndex} | global beam ${ref.beamIndex + 1}`;
}

function formatEventKind(kind: ModqnHandoverEventKind): string {
  switch (kind) {
    case 'none':
      return 'none';
    case 'intra-satellite-beam-switch':
      return 'intra-satellite beam switch';
    case 'inter-satellite-handover':
      return 'inter-satellite handover';
  }
}

function ReplayCue({
  label,
  value,
  detail,
  role,
  testId,
}: ReplayCueProps) {
  return (
    <div
      className={`leo-replay-scene-cue leo-replay-scene-cue--${role}`}
      data-testid={testId}
      data-replay-cue-role={role}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function ModqnReplaySceneCues({
  displayState,
  failClosedReason,
}: ModqnReplaySceneCuesProps) {
  if (displayState === null) {
    return (
      <section
        className="leo-replay-scene-cues leo-replay-scene-cues--fail-closed"
        data-testid="modqn-replay-scene-cues"
        data-replay-cue-state="fail-closed"
        aria-label="MODQN replay artifact scene cues unavailable"
        aria-live="polite"
      >
        <div className="leo-replay-scene-cues-header">
          <span data-testid="modqn-replay-scene-cues-label">MODQN replay artifact cues unavailable</span>
          <strong>fail-closed display only</strong>
          <small>not live HOBS/SINR state</small>
        </div>
        <div className="leo-replay-scene-cues-grid">
          <div className="leo-replay-scene-cue leo-replay-scene-cue--focus" data-testid="modqn-replay-scene-cue-fail-closed">
            <span>Selected artifact</span>
            <strong>missing or invalid</strong>
            <small>{failClosedReason ?? 'Replay cues blocked until the accepted 7-beam artifact model is valid.'}</small>
          </div>
        </div>
      </section>
    );
  }

  const { currentSlot } = displayState;
  const focusRow = currentSlot.focusRow;
  const sourceRowNumber = focusRow.sourceRowIndex + 1;
  const eventKind = focusRow.handoverEventKind;

  return (
    <section
      className="leo-replay-scene-cues"
      data-testid="modqn-replay-scene-cues"
      data-current-source-slot={currentSlot.slotIndex}
      data-focus-source-row={sourceRowNumber}
      data-handover-event-kind={eventKind}
      aria-label="MODQN replay artifact scene cues"
      aria-live="polite"
    >
      <div className="leo-replay-scene-cues-header">
        <span data-testid="modqn-replay-scene-cues-label">MODQN replay artifact cues</span>
        <strong>scene-adjacent display only</strong>
        <small>not live HOBS/SINR state</small>
      </div>
      <div className="leo-replay-scene-cues-grid">
        <ReplayCue
          role="selected"
          label="Selected serving"
          value={formatBeamCue(focusRow.selectedServing)}
          detail={formatBeamCueDetail(focusRow.selectedServing)}
          testId="modqn-replay-scene-cue-selected"
        />
        <ReplayCue
          role="previous"
          label="Previous serving"
          value={formatBeamCue(focusRow.previousServing)}
          detail={formatBeamCueDetail(focusRow.previousServing)}
          testId="modqn-replay-scene-cue-previous"
        />
        <ReplayCue
          role="event"
          label="Handover event"
          value={formatEventKind(eventKind)}
          detail={`artifact event kind ${eventKind}`}
          testId="modqn-replay-scene-cue-event"
        />
        <ReplayCue
          role="focus"
          label="Source slot / focus row"
          value={`slot ${currentSlot.slotIndex}, row ${sourceRowNumber}`}
          detail={`${focusRow.userId}|${focusRow.userIndex} of ${displayState.rowCount} rows`}
          testId="modqn-replay-scene-cue-focus"
        />
      </div>
    </section>
  );
}
