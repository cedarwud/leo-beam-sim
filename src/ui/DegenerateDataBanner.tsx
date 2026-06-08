// MODQN tab consolidation S4 — degenerate-data honesty banner.
//
// The pinned producer artifact the MODQN lanes replay is DEGENERATE: 100 UEs all
// assigned to a single sat-0 beam, 0 handovers, flat SNR, 1 satellite visible
// (see docs/baseline-modqn-producer-data-defects-report-2026-06-06.md). The
// MODQN replay UI (live cell preview / replay proof / artifact showcase) is
// therefore display-correct but rides a non-representative run. Governance
// (CLAUDE.md Rule#3 + the consolidation plan §3) requires a loud, non-citable
// disclosure on every MODQN lane until the producer ships a non-degenerate run.
//
// This is a MODE-LEVEL strip (normal flow, full width, above the ControlBar) —
// distinct from HeuristicNotPaperBanner, which is an absolute overlay anchored to
// the scene canvas and gated on the omega-heuristic decision policy. The two can
// co-occur (degenerate data + heuristic scoring) and never share a position.
//
// Colors chosen for AA contrast (WCAG 2.1): background #7a2a14 (deep warm
// red-amber), foreground #ffeede (warm white) — contrast ratio ≈ 10.9 : 1, well
// above the 4.5 : 1 threshold. The text constant is pinned by
// scripts/validate-frontend-scene-lane-governance.ts.
import type { CSSProperties } from 'react';

// Exact disclosure text. Validator pins this string. Claim-safe: states the data
// defect, marks the surface non-citable, and names the unblock path. Never claims
// the MODQN policy itself is wrong (the RL training is sound — only the replayed
// run is degenerate).
export const DEGENERATE_DATA_BANNER_TEXT =
  'MODQN replay rides a degenerate baseline run — 1 satellite, 100 UEs on one beam, 0 handovers. '
  + 'Illustrative only — do not cite. Awaiting a non-degenerate producer artifact.';

export const DEGENERATE_DATA_BANNER_BG_COLOR = '#7a2a14';
export const DEGENERATE_DATA_BANNER_FG_COLOR = '#ffeede';

const bannerStyle: CSSProperties = {
  background: DEGENERATE_DATA_BANNER_BG_COLOR,
  color: DEGENERATE_DATA_BANNER_FG_COLOR,
  padding: '7px 16px',
  fontSize: 12.5,
  fontWeight: 600,
  letterSpacing: 0.2,
  textAlign: 'center',
  borderBottom: '1px solid #a8492c',
};

/**
 * Persistent MODQN-lane disclosure that the replayed producer run is degenerate.
 *
 * Mounted by App.tsx gated on `sceneLane !== 'sinr-live'` (all three MODQN
 * sub-lanes), in normal flow between the top nav and the ControlBar. Takes no
 * props on purpose: the disclosure text is fixed by governance and must not vary
 * by caller. The only way to remove it is to leave MODQN (switch to the SINR
 * tab) — there is no dismiss control.
 */
export function DegenerateDataBanner() {
  return (
    <div
      className="leo-degenerate-data-banner"
      role="note"
      aria-live="polite"
      data-testid="degenerate-data-banner"
      style={bannerStyle}
    >
      {DEGENERATE_DATA_BANNER_TEXT}
    </div>
  );
}
