import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { ModqnReplayPlaybackDisplayState } from '../modqn/replay-bundle';
import {
  deriveModqnReplaySceneVisualState,
  type ModqnReplaySceneBeamRole,
} from '../scene/modqnReplaySceneVisuals';

interface ModqnReplayCuePanelProps {
  readonly appMode: string;
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
}

function eventLabel(eventKind: string): string {
  if (eventKind === 'intra-satellite-beam-switch') return 'Intra beam switch';
  if (eventKind === 'inter-satellite-handover') return 'Inter satellite handover';
  return 'Serving beam hold';
}

function roleTone(role: ModqnReplaySceneBeamRole): string {
  if (role === 'selected') return 'selected';
  if (role === 'previous') return 'previous';
  if (role === 'previous-and-selected') return 'both';
  return 'inactive';
}

export function ModqnReplayCuePanel({
  appMode,
  displayState,
}: ModqnReplayCuePanelProps): ReactElement | null {
  const visualState = useMemo(
    () => deriveModqnReplaySceneVisualState(displayState),
    [displayState],
  );

  if (appMode !== 'modqn-demo') return null;

  if (visualState === null || displayState === null) {
    return (
      <section
        className="leo-modqn-replay-panel"
        aria-label="MODQN replay cue"
        data-testid="modqn-replay-cue-panel"
        data-replay-ready="0"
      >
        <div className="leo-modqn-replay-panel__empty">Replay unavailable</div>
      </section>
    );
  }

  return (
    <section
      className="leo-modqn-replay-panel"
      aria-label="MODQN replay cue"
      aria-live="polite"
      data-testid="modqn-replay-cue-panel"
      data-replay-ready="1"
      data-handover-event-kind={visualState.eventKind}
      data-selection-source={visualState.selectionSource}
      data-source-row={visualState.sourceRowNumber}
    >
      <div className="leo-modqn-replay-panel__header">
        <span>{`Slot ${visualState.slotIndex}`}</span>
        <strong>{eventLabel(visualState.eventKind)}</strong>
        <span>{`Row ${visualState.sourceRowNumber}`}</span>
      </div>

      <div className="leo-modqn-replay-panel__path">
        <div className="leo-modqn-replay-panel__node" data-node-role="previous">
          <span>Previous</span>
          <strong>{`B${visualState.previous.canonicalBeamNumber}`}</strong>
          <small>{visualState.previous.detail}</small>
        </div>
        <div className="leo-modqn-replay-panel__arrow" aria-hidden="true">-&gt;</div>
        <div className="leo-modqn-replay-panel__node" data-node-role="selected">
          <span>Selected</span>
          <strong>{`B${visualState.selected.canonicalBeamNumber}`}</strong>
          <small>{visualState.selected.detail}</small>
        </div>
      </div>

      <div className="leo-modqn-replay-panel__beams" aria-label="Canonical seven-beam replay roles">
        {visualState.beams.map(beam => (
          <span
            key={beam.canonicalBeamNumber}
            className="leo-modqn-replay-panel__beam"
            data-beam-role={roleTone(beam.role)}
          >
            {`B${beam.canonicalBeamNumber}`}
          </span>
        ))}
      </div>

      <div className="leo-modqn-replay-panel__metrics">
        <div>
          <span>Sat shown/raw</span>
          <strong>{`${visualState.renderedSatelliteStateCount}/${visualState.producerSatelliteStateCount}`}</strong>
        </div>
        <div>
          <span>UE rows</span>
          <strong>{visualState.slotDecisionRowCount}</strong>
        </div>
        <div>
          <span>Intra</span>
          <strong>{displayState.eventCounts['intra-satellite-beam-switch']}</strong>
        </div>
        <div>
          <span>Inter</span>
          <strong>{displayState.eventCounts['inter-satellite-handover']}</strong>
        </div>
        <div>
          <span>Truth</span>
          <strong>{visualState.truthAudit.highestSceneLevel}</strong>
        </div>
      </div>

      <div className="leo-modqn-replay-panel__truth">
        <span>{visualState.evidenceStatus}</span>
        <span>{visualState.selectionSource}</span>
        <span>{visualState.sourceOwner}</span>
        <span>{visualState.geometrySource}</span>
        <span>{`source gaps ${visualState.truthAudit.sourceGapCount}`}</span>
      </div>

      <div className="leo-modqn-replay-panel__audit" aria-label="MODQN truth-level audit">
        {visualState.truthAudit.levels.map(level => (
          <span
            key={level.level}
            data-truth-level={level.level}
            data-truth-status={level.status}
            title={level.reason}
          >
            {`${level.level} ${level.status}`}
          </span>
        ))}
      </div>
    </section>
  );
}
