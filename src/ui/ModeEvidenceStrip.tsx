import { UI_TOKENS } from '../constants/uiTokens';
import { MODQN_BASELINE_BEAMS_PER_SATELLITE } from '../modqn/replay-bundle/identity';

const MODQN_REPLAY_LABEL = 'MODQN replay - 7-beam producer artifact';
const HOBS_SINR_LIVE_LABEL = 'HOBS/SINR live';
const SENSITIVITY_DEMO_LABEL = 'Sensitivity/demo';
const MODQN_EVIDENCE_STATUS = 'accepted-7beam-baseline';

function EvidenceChip({
  children,
  tone,
}: {
  children: string;
  tone: 'replay' | 'live' | 'sensitivity' | 'boundary';
}) {
  return (
    <span
      className={`leo-mode-evidence-chip leo-mode-evidence-chip--${tone}`}
      style={{
        borderRadius: UI_TOKENS.radius.sm,
        fontWeight: UI_TOKENS.type.weight.heavy,
        letterSpacing: 0,
      }}
    >
      {children}
    </span>
  );
}

export function ModeEvidenceStrip() {
  return (
    <aside
      className="leo-mode-evidence-strip"
      data-testid="mode-evidence-strip"
      aria-label="Replay and live mode evidence labels"
    >
      <div
        className="leo-mode-evidence-cluster leo-mode-evidence-cluster--replay"
        data-testid="modqn-replay-evidence-label"
      >
        <EvidenceChip tone="replay">{MODQN_REPLAY_LABEL}</EvidenceChip>
        <EvidenceChip tone="replay">{MODQN_EVIDENCE_STATUS}</EvidenceChip>
        <span className="leo-mode-evidence-note">
          newly regenerated / re-promoted; not recovered frozen artifact; not full paper-faithful reproduction.
        </span>
      </div>

      <div
        className="leo-mode-evidence-cluster leo-mode-evidence-cluster--live"
        data-testid="hobs-sinr-live-label"
      >
        <EvidenceChip tone="live">{HOBS_SINR_LIVE_LABEL}</EvidenceChip>
        <span className="leo-mode-evidence-note">
          HOBS/SINR live is separate; HOBS/SINR controls do not modify MODQN replay artifact truth.
        </span>
      </div>

      <div
        className="leo-mode-evidence-cluster leo-mode-evidence-cluster--sensitivity"
        data-testid="sensitivity-demo-boundary-label"
      >
        <EvidenceChip tone="sensitivity">{SENSITIVITY_DEMO_LABEL}</EvidenceChip>
        <span className="leo-mode-evidence-note">
          {MODQN_BASELINE_BEAMS_PER_SATELLITE} = baseline MODQN evidence path; 19/37 = sensitivity/demo only.
        </span>
      </div>
    </aside>
  );
}
