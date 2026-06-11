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
  // The replay-proof view needs the canonical decision overlay (live-sim +
  // modqn-demo + decision-overlay-on-live-sinr). When that precondition is not
  // met the Proof segment is disabled rather than silently doing nothing.
  readonly proofEnabled: boolean;
}

function isOptionDisabled(lane: SceneLane, proofEnabled: boolean): boolean {
  return lane === 'modqn-replay-proof' && !proofEnabled;
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
  // S5-2b consolidation (user-locked): the Proof sub-view is HIDDEN (not merely
  // disabled) until its producer evidence precondition is met — fewer buttons,
  // cleaner north star. The lane + gate (proofEnabled) are unchanged; only the
  // segment's render is dropped while inert. MODQN_VIEW_OPTIONS still carries all
  // three (source-of-truth) so the un-park is a pure re-show when producer data
  // lands. Every rendered option here is therefore enabled.
  const visibleOptions = MODQN_VIEW_OPTIONS.filter(
    option => !isOptionDisabled(option.lane, proofEnabled),
  );

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
