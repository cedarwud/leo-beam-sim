import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { ModqnReplayPlaybackDisplayState } from '../modqn/replay-bundle';
import {
  createCurrentModqnReplayProofSourceGaps,
  type ModqnReplaySourceGap,
} from '../modqn/replay-source-gaps';
import {
  deriveModqnReplaySceneVisualState,
  type ModqnReplaySceneBeamRole,
} from '../scene/modqnReplaySceneVisuals';

interface ModqnReplayCuePanelProps {
  readonly appMode: string;
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
  readonly proofViewportActive?: boolean;
  readonly onProofViewportActiveChange?: (active: boolean) => void;
  readonly sourceGaps?: readonly ModqnReplaySourceGap[];
}

interface ModqnReplayProofViewportToggleProps {
  readonly active: boolean;
  readonly onActiveChange?: (active: boolean) => void;
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

function sourceGapLabel(gap: ModqnReplaySourceGap): string {
  if (gap.field === 'beamHopping.activeSchedule') return 'Active beam schedule';
  if (gap.field === 'beamHopping.nextSchedule') return 'Next beam preview';
  if (gap.field === 'entities.satellites.trajectory') return 'Satellite trajectory';
  if (gap.field === 'entities.beams.footprints') return 'Beam footprint';
  if (gap.field === 'timeline.sourceRowIdentity') return 'Source row identity';
  if (gap.field === 'timeline.focusUeSelection') return 'Focus UE selection';
  if (gap.field === 'timeline.activeCellState') return 'Active cell state';
  if (gap.field === 'timeline.allUeServingHistory') return 'All-UE serving';
  if (gap.field === 'timeline.handoverPenaltyAttribution') return 'HO penalty attribution';
  if (gap.field === 'metrics.angleAwareTerms') return 'Angle-aware terms';
  if (gap.field === 'metrics.energyEfficiencyTerms') return 'Energy-efficiency terms';
  return gap.field;
}

function ModqnReplayProofViewportToggle({
  active,
  onActiveChange,
}: ModqnReplayProofViewportToggleProps): ReactElement {
  const disabled = onActiveChange === undefined;
  const label = active ? 'Hide proof from viewport' : 'Show proof in viewport';
  const wiringLabel = 'Controller wiring required to change MODQN replay proof viewport';

  return (
    <div className="leo-modqn-replay-panel__audit" aria-label="MODQN replay proof viewport control">
      <button
        type="button"
        className="leo-modqn-replay-panel__beam"
        data-testid="modqn-replay-proof-viewport-toggle"
        aria-pressed={active}
        aria-label={disabled ? `${label}. ${wiringLabel}` : label}
        title={disabled ? wiringLabel : label}
        disabled={disabled}
        onClick={() => onActiveChange?.(!active)}
      >
        {label}
      </button>
    </div>
  );
}

export function ModqnReplayCuePanel({
  appMode,
  displayState,
  proofViewportActive = false,
  onProofViewportActiveChange,
  sourceGaps,
}: ModqnReplayCuePanelProps): ReactElement | null {
  const visualState = useMemo(
    () => deriveModqnReplaySceneVisualState(displayState),
    [displayState],
  );
  const replaySourceGaps = useMemo(
    () => sourceGaps ?? createCurrentModqnReplayProofSourceGaps(),
    [sourceGaps],
  );
  const showReplaySourceGaps = proofViewportActive && replaySourceGaps.length > 0;

  if (appMode !== 'modqn-demo') return null;

  const proofViewportToggle = (
    <ModqnReplayProofViewportToggle
      active={proofViewportActive}
      onActiveChange={onProofViewportActiveChange}
    />
  );

  if (visualState === null || displayState === null) {
    return (
      <section
        className="leo-modqn-replay-panel"
        aria-label="MODQN replay cue"
        data-testid="modqn-replay-cue-panel"
        data-replay-ready="0"
      >
        {proofViewportToggle}
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
      {proofViewportToggle}

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
        {proofViewportActive ? <span>{`source gaps ${replaySourceGaps.length}`}</span> : null}
      </div>

      {showReplaySourceGaps ? (
        <section
          className="leo-modqn-replay-panel__source-gaps"
          data-testid="modqn-replay-source-gap-list"
          data-source-gap-count={replaySourceGaps.length}
          aria-label="MODQN replay source gaps"
        >
          <div className="leo-modqn-replay-panel__source-gaps-title">Source gaps</div>
          {replaySourceGaps.map(gap => (
            <div
              key={`${gap.field}:${gap.surface}`}
              className="leo-modqn-replay-panel__source-gap"
              data-testid="modqn-replay-source-gap-item"
              data-source-gap-field={gap.field}
              data-source-gap-policy={gap.policy}
              data-source-gap-claim-impact={gap.claimImpact}
            >
              <strong>{sourceGapLabel(gap)}</strong>
              <span>{gap.note}</span>
            </div>
          ))}
        </section>
      ) : null}

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
