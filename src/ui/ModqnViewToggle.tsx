import type { KeyboardEvent } from 'react';
import type { SceneLane } from '../app/sceneLane';

// In-MODQN sub-navigation. After the 4->2 top-nav consolidation
// (docs/modqn-tab-consolidation-plan.md) the MODQN experience no longer spreads
// across three co-equal top tabs. Instead the top LaneExperienceBar shows one
// MODQN segment, and THIS toggle — visible only while a MODQN lane is active —
// picks the sub-lane: the live cell-preview (default), the replay-proof evidence
// view, and the frozen artifact showcase. It reuses App.handleExperienceChange,
// so every transition stays governance-safe (Director focus teardown, stale
// artifact-replay state cleared on leave). It is a governance Shared Surface:
// presentational only, no 3D / scene / viz import.
//
// nav != lane (CLAUDE.md Rule#4): these are in-MODQN view chrome. The 4 SceneLane
// values are unchanged; this control + the top bar map 2 top segments onto them.
export interface ModqnViewOption {
  readonly lane: SceneLane;
  readonly label: string;
  readonly sub: string;
}

export const MODQN_VIEW_OPTIONS: readonly ModqnViewOption[] = [
  { lane: 'modqn-live-cell-preview', label: 'Live', sub: 'cell preview + training' },
  { lane: 'modqn-replay-proof', label: 'Proof', sub: 'replay evidence' },
  { lane: 'artifact-replay', label: 'Artifact', sub: 'frozen showcase' },
];

export interface ModqnViewToggleProps {
  readonly value: SceneLane;
  readonly onChange: (lane: SceneLane) => void;
  // The replay-proof view's recorded-stage precondition (live-sim + modqn-demo).
  // App passes `canToggleModqnReplayProof`. P3 slice-3 nav-polish dropped the old
  // `decision-overlay-on-live-sinr` term: the recorded stage plays an artifact
  // window, not the live decision-overlay policy, so the Proof entry no longer
  // depends on it.
  readonly proofEnabled: boolean;
}

function isOptionDisabled(lane: SceneLane, _proofEnabled: boolean): boolean {
  // P3 slice-3 nav-polish: the Proof sub-view is UN-PARKED — a first-class entry
  // into the recorded replay-proof STAGE (it was dropped from this guard, per its
  // note). Only the Artifact sub-view stays hidden from the default sub-nav; it
  // remains a reachable SceneLane enum value (CLAUDE.md Rule#4 / nav != lane) and
  // MODQN_VIEW_OPTIONS stays the source-of-truth — un-parking Artifact later is
  // just dropping it from this guard too.
  return lane === 'artifact-replay';
}

function focusViewButton(lane: SceneLane): void {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLButtonElement>(`[data-testid="modqn-view-${lane}"]`)
      ?.focus();
  });
}

export function ModqnViewToggle({ value, onChange, proofEnabled }: ModqnViewToggleProps) {
  // P3 slice-3 nav-polish: the Proof sub-view is UN-PARKED — with modqn-demo live,
  // `proofEnabled` is true and [Live, Proof] both render (the recorded replay-proof
  // stage is now a first-class entry). Only the Artifact sub-view stays HIDDEN via
  // `isOptionDisabled`. MODQN_VIEW_OPTIONS still carries all three (source-of-truth).
  // Every rendered option here is enabled.
  const visibleOptions = MODQN_VIEW_OPTIONS.filter(
    option => !isOptionDisabled(option.lane, proofEnabled),
  );

  // Parked to one page: with a single (or no) visible view the sub-nav is pure
  // chrome — render nothing so MODQN is a single fixed page (no 3-way switch).
  if (visibleOptions.length <= 1) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let step: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') step = 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') step = -1;
    else if (event.key !== 'Home' && event.key !== 'End') return;

    event.preventDefault();
    const count = visibleOptions.length;
    if (count === 0) return;
    // All visible options are enabled, so navigation is a simple wrap.
    let target = index;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = count - 1;
    else if (step !== null) target = (target + step + count) % count;

    const nextLane = visibleOptions[target].lane;
    onChange(nextLane);
    focusViewButton(nextLane);
  };

  return (
    <nav
      className="leo-modqn-view-toggle"
      role="tablist"
      aria-label="MODQN view"
      data-testid="modqn-view-toggle"
    >
      <span className="leo-modqn-view-toggle__title" aria-hidden="true">MODQN view</span>
      <div className="leo-modqn-view-toggle__group">
        {visibleOptions.map((option, index) => {
          const active = option.lane === value;
          return (
            <button
              key={option.lane}
              role="tab"
              type="button"
              className="leo-modqn-view-toggle__button"
              data-testid={`modqn-view-${option.lane}`}
              data-active={active ? 'true' : 'false'}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => { if (!active) onChange(option.lane); }}
              onKeyDown={event => handleKeyDown(event, index)}
            >
              <span className="leo-modqn-view-toggle__label">{option.label}</span>
              <small className="leo-modqn-view-toggle__sub">{option.sub}</small>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
