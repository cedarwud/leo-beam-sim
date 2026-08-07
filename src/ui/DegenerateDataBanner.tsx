// MODQN tab consolidation S4 — degenerate-data honesty banner.
//
// The pinned producer artifact the baseline MODQN lanes replay is DEGENERATE:
// 100 UEs all assigned to a single sat-0 beam, 0 handovers, flat SNR, 1 satellite
// visible (see docs/baseline-modqn-producer-data-defects-report-2026-06-06.md).
// The MODQN replay UI (live cell preview / replay proof / artifact showcase) is
// therefore display-correct but rides a non-representative run. Governance
// (CLAUDE.md Rule#3 + the consolidation plan §3) requires a loud, non-citable
// disclosure on every MODQN lane until the producer ships a non-degenerate run.
//
// G3 Family-B dense-Q proof: when the Family-B dense-Q window is loaded the
// replayed run is NOT degenerate — it is Grade-2 CONSTRAINED (2 serving sats,
// 2 unique selected actions, 125 handovers) and proves MODQN is wired (real
// per-action Q1/Q2/Q3). The banner therefore switches to an honest Family-B
// disclosure that never calls it "degenerate" and never overclaims. The mode is
// read from ModqnEnvelopeContext so the component stays propless (the disclosure
// must not vary by arbitrary caller, only by the loaded producer evidence status).
//
// This is a MODE-LEVEL strip (normal flow, full width, above the ControlBar) —
// distinct from HeuristicNotPaperBanner, which is an absolute overlay anchored to
// the scene canvas and gated on the omega-heuristic decision policy. The two can
// co-occur (degenerate data + heuristic scoring) and never share a position.
//
// Colors chosen for AA contrast (WCAG 2.1): baseline background #7a2a14 (deep warm
// red-amber), foreground #ffeede (≈ 10.9 : 1); Family-B background #5a4410 (calmer
// amber — caution, not a defect alarm), foreground #fff4d6 (≈ 8.6 : 1). Both are
// well above the 4.5 : 1 threshold. The baseline text constant is pinned by
// scripts/validate-frontend-scene-lane-governance.ts.
import { useContext, type CSSProperties } from 'react';
import { ModqnEnvelopeContext } from '../modqn/runtimeContext';
import { MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS } from '../modqn/replay-bundle';

// Exact baseline disclosure text. Validator pins this string. Claim-safe: states
// the data defect, marks the surface non-citable, and names the unblock path.
// Never claims the MODQN policy itself is wrong (the RL training is sound — only
// the replayed baseline run is degenerate).
export const DEGENERATE_DATA_BANNER_TEXT =
  'MODQN replay rides a degenerate baseline run — 1 satellite, 100 UEs on one beam, 0 handovers. '
  + 'Illustrative only — do not cite. Awaiting a non-degenerate producer artifact.';

// G3 Family-B dense-Q disclosure. Honest: Grade-2 CONSTRAINED (not degenerate),
// non-paper-faithful, proves wiring only, non-citable. Never says "degenerate".
export const FAMILY_B_DENSE_Q_BANNER_TEXT =
  'MODQN Family-B dense-Q proof — Grade-2 constrained (2 serving satellites, 2 unique selected actions, '
  + '125 handovers), non-paper-faithful trained replay. Proves MODQN is wired (real per-action Q1/Q2/Q3 '
  + '+ original-weight argmax self-check). Illustrative only — do not cite; not a beats-baseline claim.';

export const DEGENERATE_DATA_BANNER_BG_COLOR = '#7a2a14';
export const DEGENERATE_DATA_BANNER_FG_COLOR = '#ffeede';
export const FAMILY_B_DENSE_Q_BANNER_BG_COLOR = '#5a4410';
export const FAMILY_B_DENSE_Q_BANNER_FG_COLOR = '#fff4d6';

function bannerStyle(background: string, color: string, borderColor: string): CSSProperties {
  return {
    background,
    color,
    padding: '7px 16px',
    fontSize: 14.5,
    fontWeight: 600,
    letterSpacing: 0.2,
    textAlign: 'center',
    borderBottom: `1px solid ${borderColor}`,
  };
}

/**
 * Persistent MODQN-lane disclosure for the currently loaded producer evidence.
 *
 * Mounted by App.tsx gated on `sceneLane !== 'sinr-live'` (all three MODQN
 * sub-lanes), in normal flow between the top nav and the ControlBar. Takes no
 * props on purpose: the disclosure text is fixed by governance and varies only by
 * the loaded producer evidence status (read from ModqnEnvelopeContext), never by
 * an arbitrary caller. The only way to remove it is to leave MODQN (switch to the
 * SINR tab) — there is no dismiss control.
 */
export function DegenerateDataBanner() {
  const { envelope } = useContext(ModqnEnvelopeContext);
  const isFamilyBDenseQ = envelope?.evidenceStatus === MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS;

  const text = isFamilyBDenseQ ? FAMILY_B_DENSE_Q_BANNER_TEXT : DEGENERATE_DATA_BANNER_TEXT;
  const style = isFamilyBDenseQ
    ? bannerStyle(FAMILY_B_DENSE_Q_BANNER_BG_COLOR, FAMILY_B_DENSE_Q_BANNER_FG_COLOR, '#8a6a1c')
    : bannerStyle(DEGENERATE_DATA_BANNER_BG_COLOR, DEGENERATE_DATA_BANNER_FG_COLOR, '#a8492c');

  return (
    <div
      className="leo-degenerate-data-banner"
      role="note"
      aria-live="polite"
      data-testid="degenerate-data-banner"
      data-modqn-banner-mode={isFamilyBDenseQ ? 'family-b-dense-q' : 'degenerate-baseline'}
      style={style}
    >
      {text}
    </div>
  );
}
