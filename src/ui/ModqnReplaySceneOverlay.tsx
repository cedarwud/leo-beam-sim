import type { ModqnReplayPlaybackDisplayState } from '../modqn/replay-bundle/playback-shell';
import type {
  ModqnBeamReference,
  ModqnHandoverEventKind,
} from '../modqn/replay-bundle/types';

interface ModqnReplaySceneOverlayProps {
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
  readonly failClosedReason?: string;
}

function formatBeamCue(ref: ModqnBeamReference): string {
  return `${ref.satId} / beam ${ref.localBeamIndex + 1}`;
}

function formatBeamDetail(ref: ModqnBeamReference): string {
  return `${ref.beamId} | action ${ref.beamIndex} | global ${ref.beamIndex + 1}`;
}

function formatEventKind(kind: ModqnHandoverEventKind): string {
  switch (kind) {
    case 'none':
      return 'no replay handover event';
    case 'intra-satellite-beam-switch':
      return 'intra-satellite beam switch';
    case 'inter-satellite-handover':
      return 'inter-satellite handover';
  }
}

export function ModqnReplaySceneOverlay({
  displayState,
  failClosedReason,
}: ModqnReplaySceneOverlayProps) {
  if (displayState === null) {
    return (
      <aside
        className="leo-modqn-scene-overlay leo-modqn-scene-overlay--blocked"
        data-testid="modqn-replay-scene-overlay"
        data-replay-overlay-state="fail-closed"
        aria-label="MODQN replay scene overlay unavailable"
      >
        <span>MODQN replay scene overlay</span>
        <strong>fail closed</strong>
        <small>{failClosedReason ?? 'Accepted 7-beam replay display state is unavailable.'}</small>
      </aside>
    );
  }

  const { currentSlot } = displayState;
  const focusRow = currentSlot.focusRow;
  const eventKind = focusRow.handoverEventKind;
  const sourceRowNumber = focusRow.sourceRowIndex + 1;

  return (
    <aside
      className="leo-modqn-scene-overlay"
      data-testid="modqn-replay-scene-overlay"
      data-replay-overlay-state="ready"
      data-handover-event-kind={eventKind}
      data-current-source-slot={currentSlot.slotIndex}
      data-focus-source-row={sourceRowNumber}
      aria-label="MODQN replay scene overlay"
    >
      <div className="leo-modqn-scene-overlay-header">
        <span>MODQN replay scene overlay</span>
        <strong data-testid="modqn-replay-scene-overlay-event">{formatEventKind(eventKind)}</strong>
      </div>
      <div className="leo-modqn-scene-overlay-path" aria-label="MODQN replay beam switch path">
        <div className="leo-modqn-scene-overlay-node leo-modqn-scene-overlay-node--previous">
          <span>Previous</span>
          <strong data-testid="modqn-replay-scene-overlay-previous">{formatBeamCue(focusRow.previousServing)}</strong>
          <small>{formatBeamDetail(focusRow.previousServing)}</small>
        </div>
        <div className="leo-modqn-scene-overlay-arrow" aria-hidden="true">-&gt;</div>
        <div className="leo-modqn-scene-overlay-node leo-modqn-scene-overlay-node--selected">
          <span>Selected</span>
          <strong data-testid="modqn-replay-scene-overlay-selected">{formatBeamCue(focusRow.selectedServing)}</strong>
          <small>{formatBeamDetail(focusRow.selectedServing)}</small>
        </div>
      </div>
      <div className="leo-modqn-scene-overlay-footer">
        <span>slot {currentSlot.slotIndex}, row {sourceRowNumber}</span>
        <span>display-only replay cue</span>
      </div>
    </aside>
  );
}
