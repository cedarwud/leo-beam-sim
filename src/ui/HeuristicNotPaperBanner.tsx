// MODQN ω-Handover S4 — heuristic-mode disclosure banner.
//
// SDD §4.4 item 1: when `handoverMode === 'omega-heuristic'`, a non-dismissable
// banner anchored to the top of the main scene MUST read
// `Heuristic ω-scoring — NOT paper MODQN`. Background is the warning color
// (orange / amber, contrast ratio ≥ 4.5:1 against text). The banner must be
// present regardless of sidebar visibility, fullscreen state, or cinematic-mode
// dimming.
//
// Mount: inside the .leo-shell-canvas <main> so the banner travels with the
// scene container in both browser fullscreen (F11) and cinematic mode (which
// dims Three.js content but does not affect HTML overlays).
//
// Colors chosen for AA contrast (W3C WCAG 2.1):
//   * background #7a3a00 (warm amber/brown — same family as the fetch-error
//     banner at src/App.tsx:492 for visual consistency)
//   * foreground #fff8e7 (warm white)
//   * computed contrast ratio ≈ 7.77 : 1, well above the 4.5 : 1 AA threshold
//     (computation documented in the S4 PR body and re-verified by
//     scripts/validate-modqn-omega-s4-heuristic-not-paper.tsx).
//
// Non-dismissable: the banner has no close button and ignores click /
// keyboard events. The only way to remove it is to switch out of
// `omega-heuristic` via the Advanced drawer decision-policy control (SDD §4.4
// item 5 — no shortcut or URL handler may enter or leave the mode without the
// on-screen control).
//
// References:
//   * docs/modqn-omega-handover-sdd.md §4.4 item 1 (banner)
//   * docs/modqn-omega-handover-sdd.md §6.1 row "omega-heuristic" (warn tone)
//   * docs/modqn-omega-handover-sdd.md §9.5 acceptance
import type { CSSProperties } from 'react';
import { OVERRIDE_PRIMARY_UE_SCOPE_NOTE } from '../modqn/runtimeControls';

// SDD §4.4 item 1: this exact text. Validator pins the string.
export const HEURISTIC_NOT_PAPER_BANNER_TEXT =
  'Heuristic ω-scoring — NOT paper MODQN';

// Color tokens exported so the S4 validator can re-compute the contrast ratio
// against the same constants the runtime uses.
export const HEURISTIC_NOT_PAPER_BANNER_BG_COLOR = '#7a3a00';
export const HEURISTIC_NOT_PAPER_BANNER_FG_COLOR = '#fff8e7';

// High z-index keeps the banner above the Three.js canvas and any cinematic
// overlay. Existing app z-indices stay ≤ 18 (src/styles/main.scss); 9999 is
// safely above everything without colliding with browser UI in fullscreen.
const BANNER_Z_INDEX = 9999;

const bannerStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: BANNER_Z_INDEX,
  background: HEURISTIC_NOT_PAPER_BANNER_BG_COLOR,
  color: HEURISTIC_NOT_PAPER_BANNER_FG_COLOR,
  padding: '8px 16px',
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: 0.2,
  textAlign: 'center',
  borderBottom: '1px solid #b25c00',
  pointerEvents: 'none', // non-dismissable: ignore all input
  userSelect: 'none',
};

// S4-4 (D3): secondary scope line. Same AA-verified foreground color as the
// headline (contrast unchanged) but lighter weight / smaller size so the SDD
// headline stays the dominant line. Honestly scopes the override to the primary
// UE so the demo never implies it drives the whole served population.
const scopeNoteStyle: CSSProperties = {
  marginTop: 2,
  fontSize: 13,
  fontWeight: 400,
  letterSpacing: 0.1,
};

/**
 * Persistent warning banner shown whenever `handoverMode === 'omega-heuristic'`.
 *
 * SDD §4.4 item 1 binding rules:
 *   * Exact text: `Heuristic ω-scoring — NOT paper MODQN`.
 *   * Warning background (amber / orange), contrast ratio ≥ 4.5:1 against text.
 *   * Anchored to the top of the main scene container.
 *   * Non-dismissable — present whenever the mode is active, regardless of
 *     sidebar visibility, fullscreen state, or cinematic-mode dimming.
 *
 * The component takes no props on purpose: the banner's content and styling
 * are fixed by the SDD and must not vary by caller. The caller (App.tsx)
 * decides whether to mount it based on `handoverMode === 'omega-heuristic'`.
 */
export function HeuristicNotPaperBanner() {
  return (
    <div
      className="leo-heuristic-not-paper-banner"
      role="alert"
      aria-live="polite"
      data-testid="heuristic-not-paper-banner"
      style={bannerStyle}
    >
      <div className="leo-heuristic-not-paper-banner__headline">
        {HEURISTIC_NOT_PAPER_BANNER_TEXT}
      </div>
      <div
        className="leo-heuristic-not-paper-banner__scope"
        data-testid="heuristic-not-paper-banner-scope"
        style={scopeNoteStyle}
      >
        {OVERRIDE_PRIMARY_UE_SCOPE_NOTE}
      </div>
    </div>
  );
}
