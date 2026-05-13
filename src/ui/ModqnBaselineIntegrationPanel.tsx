import { UI_CLASSES } from '../constants/uiTokens';
import type { HandoverPolicyTuningState } from '../handoverPolicyTuning';
import type { ModqnReplayPlaybackDisplayState } from '../modqn/replay-bundle/playback-shell';

interface ModqnBaselineIntegrationPanelProps {
  readonly replayDisplayState: ModqnReplayPlaybackDisplayState | null;
  readonly replayIssueMessage?: string | null;
  readonly appliedHandoverPolicy: HandoverPolicyTuningState;
  readonly hasHandoverOverrides: boolean;
  readonly hasHandoverDraftChanges: boolean;
  readonly onOpenHandoverPolicyControls: () => void;
  readonly onResetHandoverPolicy: () => void;
}

interface ModqnBaselineReplayEvidenceProps {
  readonly replayDisplayState: ModqnReplayPlaybackDisplayState | null;
  readonly replayIssueMessage?: string | null;
}

interface ModqnBaselineHandoverControlsProps {
  readonly appliedHandoverPolicy: HandoverPolicyTuningState;
  readonly hasHandoverOverrides: boolean;
  readonly hasHandoverDraftChanges: boolean;
  readonly onOpenHandoverPolicyControls: () => void;
  readonly onResetHandoverPolicy: () => void;
}

function formatPolicyValue(value: number, unit: string): string {
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${unit}`;
}

function formatReplayEventTotals(displayState: ModqnReplayPlaybackDisplayState): string {
  return [
    `none ${displayState.eventCounts.none}`,
    `intra-sat ${displayState.eventCounts['intra-satellite-beam-switch']}`,
    `inter-sat ${displayState.eventCounts['inter-satellite-handover']}`,
  ].join(' | ');
}

function ProofMetric({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}) {
  return (
    <div className="leo-modqn-integration-metric" data-testid={testId}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getPolicyState(
  hasHandoverDraftChanges: boolean,
  hasHandoverOverrides: boolean,
): string {
  return hasHandoverDraftChanges
    ? 'draft pending'
    : hasHandoverOverrides
      ? 'custom applied'
      : 'profile defaults';
}

export function ModqnBaselineHandoverControls({
  appliedHandoverPolicy,
  hasHandoverOverrides,
  hasHandoverDraftChanges,
  onOpenHandoverPolicyControls,
  onResetHandoverPolicy,
}: ModqnBaselineHandoverControlsProps) {
  const policyState = getPolicyState(hasHandoverDraftChanges, hasHandoverOverrides);

  return (
    <section
      className="leo-modqn-integration-panel leo-modqn-integration-panel--controls"
      data-testid="modqn-baseline-handover-controls"
      data-live-handover-policy-state={policyState}
      aria-label="Baseline MODQN handover control proof"
    >
      <div className="leo-modqn-integration-heading">
        <span>Baseline MODQN integrated in frontend</span>
        <strong>Live handover controls active</strong>
      </div>

      <div className="leo-modqn-integration-card leo-modqn-integration-card--live">
        <div className="leo-modqn-integration-card-title">
          <span>Current live policy</span>
          <strong>{policyState}</strong>
        </div>
        <div className="leo-modqn-integration-metrics">
          <ProofMetric
            label="Offset margin"
            value={formatPolicyValue(appliedHandoverPolicy.offsetDb, 'dB')}
            testId="modqn-live-handover-offset"
          />
          <ProofMetric
            label="Inter-HO trigger"
            value={formatPolicyValue(appliedHandoverPolicy.triggerTimeSec, 's')}
            testId="modqn-live-handover-trigger"
          />
          <ProofMetric
            label="Attach threshold"
            value={formatPolicyValue(appliedHandoverPolicy.sinrThresholdDb, 'dB')}
            testId="modqn-live-handover-threshold"
          />
        </div>
      </div>

      <div className="leo-modqn-integration-actions">
        <button
          className={UI_CLASSES.button}
          type="button"
          data-testid="modqn-open-handover-policy-controls"
          onClick={onOpenHandoverPolicyControls}
        >
          Open handover controls
        </button>
        <button
          className={UI_CLASSES.button}
          type="button"
          disabled={!hasHandoverOverrides && !hasHandoverDraftChanges}
          data-testid="modqn-reset-handover-policy"
          onClick={onResetHandoverPolicy}
        >
          Reset live handover policy
        </button>
      </div>

      <details className="leo-modqn-boundary-disclosure">
        <summary>Replay/live boundary</summary>
        <p>
          Replay truth is read-only; live handover edits tune current HOBS/SINR simulation only.
        </p>
      </details>
    </section>
  );
}

export function ModqnBaselineReplayEvidence({
  replayDisplayState,
  replayIssueMessage = null,
}: ModqnBaselineReplayEvidenceProps) {
  const replayLoaded = replayDisplayState !== null;
  const currentSlot = replayDisplayState?.currentSlot;

  return (
    <section
      className="leo-modqn-integration-panel leo-modqn-integration-panel--evidence"
      data-testid="modqn-baseline-integration-panel"
      data-replay-state={replayLoaded ? 'accepted' : 'fail-closed'}
      aria-label="Baseline MODQN frontend integration proof"
    >
      <div className="leo-modqn-integration-heading">
        <span>Baseline MODQN integrated in frontend</span>
        <strong data-testid="modqn-baseline-integration-status">
          {replayLoaded ? 'Replay evidence loaded' : 'Replay evidence blocked'}
        </strong>
        <details
          className="leo-modqn-boundary-disclosure"
          data-phase7h-open-for-validation="true"
        >
          <summary>Replay/live boundary</summary>
          <p>
            Replay truth is read-only; live handover edits tune current HOBS/SINR simulation only.
          </p>
        </details>
      </div>

      <div className="leo-modqn-integration-card leo-modqn-integration-card--replay">
        <div className="leo-modqn-integration-card-title">
          <span>MODQN baseline replay</span>
          <strong>{replayDisplayState?.evidenceStatus ?? 'fail-closed'}</strong>
        </div>
        {replayLoaded && currentSlot !== undefined ? (
          <div className="leo-modqn-integration-metrics">
            <ProofMetric
              label="Artifact shape"
              value={`${replayDisplayState.rowCount} rows / ${replayDisplayState.slotCount} slots`}
              testId="modqn-baseline-artifact-shape"
            />
            <ProofMetric
              label="Current source"
              value={`slot ${currentSlot.slotIndex}, row ${currentSlot.focusRow.sourceRowIndex + 1}`}
              testId="modqn-baseline-current-source"
            />
            <ProofMetric
              label="Event totals"
              value={formatReplayEventTotals(replayDisplayState)}
              testId="modqn-baseline-event-totals"
            />
          </div>
        ) : (
          <div className="leo-modqn-integration-blocked" data-testid="modqn-baseline-replay-blocked">
            {replayIssueMessage ?? 'Accepted 7-beam replay display model is unavailable.'}
          </div>
        )}
      </div>

      <details
        className="leo-modqn-integration-footnote leo-modqn-boundary-disclosure"
        data-phase7h-open-for-validation="true"
      >
        <summary>Integration note</summary>
        <span>
          7-beam baseline MODQN evidence is displayed in the same shell as the adjustable live handover simulator.
        </span>
      </details>
    </section>
  );
}

export function ModqnBaselineIntegrationPanel(props: ModqnBaselineIntegrationPanelProps) {
  return (
    <>
      <ModqnBaselineHandoverControls {...props} />
      <ModqnBaselineReplayEvidence
        replayDisplayState={props.replayDisplayState}
        replayIssueMessage={props.replayIssueMessage}
      />
    </>
  );
}
