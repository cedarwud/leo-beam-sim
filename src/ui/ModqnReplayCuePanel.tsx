import { useMemo } from 'react';
import type { ReactElement } from 'react';
import {
  buildModqnReplayHandoverCinemaGate,
  modqnReplayHandoverCinemaGateSourceGapFieldsAttr,
  type ModqnReplayHandoverCinemaGate,
  type ModqnReplayPlaybackDisplayState,
} from '../modqn/replay-bundle';
import {
  createCurrentModqnReplayProofSourceGaps,
  type ModqnReplaySourceGap,
} from '../modqn/replay-source-gaps';
import {
  deriveModqnReplaySceneVisualState,
  type ModqnReplaySceneBeamRole,
} from '../scene/modqnReplaySceneVisuals';
import type { WindowReplayCue } from '../showcase/windowReplayCue';

interface ModqnReplayCuePanelProps {
  readonly appMode: string;
  readonly displayState: ModqnReplayPlaybackDisplayState | null;
  readonly proofViewportActive?: boolean;
  readonly onProofViewportActiveChange?: (active: boolean) => void;
  readonly sourceGaps?: readonly ModqnReplaySourceGap[];
  /**
   * P3 slice-3: on the modqn-replay-proof lane, the focus-UE decision derived from
   * the SAME recorded window frame the scene renders. When present (proof lane) it
   * replaces the baseline-bundle cue so the panel and the on-screen field agree.
   * Absent (undefined/null) on the live lane, where the baseline cue stays.
   */
  readonly windowCue?: WindowReplayCue | null;
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
  if (gap.field === 'metrics.reward') return 'Reward trace';
  if (gap.field === 'diagnostics.policy') return 'Policy diagnostics';
  if (gap.field === 'diagnostics.denseQPolicy') return 'Dense-Q proof';
  if (gap.field === 'traffic.queueRows') return 'Producer queue rows';
  return gap.field;
}

function replayCinemaStatusLabel(gate: ModqnReplayHandoverCinemaGate): string {
  return gate.status === 'ready' ? 'Replay cinema ready' : 'Replay cinema blocked';
}

function replayCinemaDetailLabel(gate: ModqnReplayHandoverCinemaGate): string {
  if (gate.status === 'ready') return gate.eventKey;
  const count = gate.sourceGapFields.length;
  return count === 1 ? '1 source gap' : `${count} source gaps`;
}

function ModqnReplayCinemaReadiness({
  gate,
}: {
  readonly gate: ModqnReplayHandoverCinemaGate;
}): ReactElement {
  const sourceGapFields = modqnReplayHandoverCinemaGateSourceGapFieldsAttr(gate);
  const reasons = gate.status === 'source-gap' ? gate.reasons.slice(0, 3) : [];

  return (
    <section
      className="leo-modqn-replay-panel__cinema-gate"
      data-testid="modqn-replay-cinema-readiness"
      data-replay-cinema-status={gate.status}
      data-source-gap-fields={sourceGapFields}
      data-replay-cinema-event-kind={gate.eventKind ?? 'none'}
      data-replay-cinema-event-key={gate.eventKey ?? ''}
      aria-label="MODQN replay handover cinema readiness"
      title={gate.status === 'source-gap' ? gate.reasons.join(' | ') : gate.eventKey}
    >
      <div>
        <strong>{replayCinemaStatusLabel(gate)}</strong>
        <span>{replayCinemaDetailLabel(gate)}</span>
      </div>
      {reasons.length > 0 ? (
        <div className="leo-modqn-replay-panel__cinema-gaps">
          {reasons.map(reason => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      ) : (
        <span>producer sample locked</span>
      )}
    </section>
  );
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

// Producer source-gap disclosure list. Shared by BOTH the baseline cue and the P3
// slice-3 window cue so the proof lane keeps its honesty disclosure regardless of
// which cue renders (the pinned `modqn-replay-source-gap-*` hooks stay in this file).
function ModqnReplaySourceGapList({
  gaps,
}: {
  readonly gaps: readonly ModqnReplaySourceGap[];
}): ReactElement {
  return (
    <section
      className="leo-modqn-replay-panel__source-gaps"
      data-testid="modqn-replay-source-gap-list"
      data-source-gap-count={gaps.length}
      aria-label="MODQN replay source gaps"
    >
      <div className="leo-modqn-replay-panel__source-gaps-title">Source gaps</div>
      {gaps.map(gap => (
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
  );
}

export function ModqnReplayCuePanel({
  appMode,
  displayState,
  proofViewportActive = false,
  onProofViewportActiveChange,
  sourceGaps,
  windowCue,
}: ModqnReplayCuePanelProps): ReactElement | null {
  const visualState = useMemo(
    () => deriveModqnReplaySceneVisualState(displayState),
    [displayState],
  );
  const replaySourceGaps = useMemo(
    () => sourceGaps ?? createCurrentModqnReplayProofSourceGaps(),
    [sourceGaps],
  );
  const replayCinemaGate = useMemo(
    () => buildModqnReplayHandoverCinemaGate(displayState),
    [displayState],
  );
  const showReplaySourceGaps = proofViewportActive && replaySourceGaps.length > 0;

  if (appMode !== 'modqn-demo') return null;

  // P2 replay stage (un-parked 2026-07-04): this toggle is the entry into the
  // modqn-replay-proof lane — the RECORDED dense-Q replay STAGE (red/green per-UE
  // field + beam cones + hex, artifact-backed, frameloop=demand). P3 slice-3
  // nav-polish decoupled the entry from the live decision-overlay policy; and (the
  // window branch just below) the proof lane now shows the WINDOW focus-UE cue,
  // derived from the same recorded frame the field renders — not the baseline bundle.
  const PROOF_VIEWPORT_TOGGLE_PARKED = false;
  const proofViewportToggle = PROOF_VIEWPORT_TOGGLE_PARKED ? null : (
    <ModqnReplayProofViewportToggle
      active={proofViewportActive}
      onActiveChange={onProofViewportActiveChange}
    />
  );

  // P3 slice-3: on the modqn-replay-proof lane, render the focus-UE decision derived
  // from the SAME recorded window frame the scene renders (served/serving/target
  // producer truth) instead of the baseline bundle's single sat-0 row. Takes
  // precedence over the baseline path below. The live lane passes no windowCue, so it
  // keeps the baseline cue (deriveModqnReplaySceneVisualState) fully unchanged.
  if (proofViewportActive && windowCue) {
    const targetPending = windowCue.targetBeamId !== null;
    return (
      <section
        className="leo-modqn-replay-panel"
        aria-label="MODQN replay cue"
        aria-live="polite"
        data-testid="modqn-replay-cue-panel"
        data-replay-ready="1"
        data-cue-source="window"
        data-handover-event-kind={windowCue.eventKind}
        data-focus-ue={windowCue.focusUeId}
        data-focus-selection={windowCue.focusSelection}
        data-serving-beam={windowCue.servingBeamId}
        data-target-beam={windowCue.targetBeamId ?? ''}
        data-served={windowCue.served ? '1' : '0'}
      >
        {proofViewportToggle}

        <div className="leo-modqn-replay-panel__header">
          <span>{`Frame ${windowCue.frameIndex}`}</span>
          <strong>{eventLabel(windowCue.eventKind)}</strong>
          <span>{windowCue.served ? 'Served' : 'Starved'}</span>
        </div>

        <div className="leo-modqn-replay-panel__path">
          <div className="leo-modqn-replay-panel__node" data-node-role="previous">
            <span>Serving</span>
            <strong>{windowCue.servingBeamLabel}</strong>
            <small>{windowCue.servingSatelliteId}</small>
          </div>
          <div className="leo-modqn-replay-panel__arrow" aria-hidden="true">-&gt;</div>
          <div className="leo-modqn-replay-panel__node" data-node-role="selected">
            <span>{targetPending ? 'Target' : 'Hold'}</span>
            <strong>{windowCue.targetBeamLabel ?? windowCue.servingBeamLabel}</strong>
            <small>{windowCue.targetSatelliteId ?? windowCue.servingSatelliteId}</small>
          </div>
        </div>

        <div className="leo-modqn-replay-panel__metrics">
          <div>
            <span>Focus UE</span>
            <strong>{windowCue.focusUeId}</strong>
          </div>
          <div>
            <span>Pick</span>
            <strong>{windowCue.focusSelection}</strong>
          </div>
          <div>
            <span>t</span>
            <strong>{`${windowCue.tSec.toFixed(1)}s`}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{windowCue.served ? 'served' : 'starved'}</strong>
          </div>
        </div>

        <div className="leo-modqn-replay-panel__truth">
          <span>window focus-UE decision</span>
          <span>producer served / serving / target truth</span>
          {windowCue.decisionRef !== null ? <span>{windowCue.decisionRef}</span> : null}
        </div>

        {showReplaySourceGaps ? <ModqnReplaySourceGapList gaps={replaySourceGaps} /> : null}
      </section>
    );
  }

  if (visualState === null || displayState === null) {
    return (
      <section
        className="leo-modqn-replay-panel"
        aria-label="MODQN replay cue"
        data-testid="modqn-replay-cue-panel"
        data-replay-ready="0"
        data-cue-source="baseline"
      >
        {proofViewportToggle}
        <div className="leo-modqn-replay-panel__empty">Replay unavailable</div>
        <ModqnReplayCinemaReadiness gate={replayCinemaGate} />
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
      data-cue-source="baseline"
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

      <ModqnReplayCinemaReadiness gate={replayCinemaGate} />

      {showReplaySourceGaps ? <ModqnReplaySourceGapList gaps={replaySourceGaps} /> : null}

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
