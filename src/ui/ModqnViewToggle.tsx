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
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let step: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') step = 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') step = -1;
    else if (event.key === 'Home') step = null;
    else if (event.key === 'End') step = null;
    else return;

    event.preventDefault();
    const count = MODQN_VIEW_OPTIONS.length;
    // Walk to the next ENABLED option in the requested direction (skips a
    // disabled Proof segment) so keyboard nav never lands on a dead button.
    let target = index;
    if (event.key === 'Home') {
      target = 0;
      while (isOptionDisabled(MODQN_VIEW_OPTIONS[target].lane, proofEnabled) && target < count - 1) target += 1;
    } else if (event.key === 'End') {
      target = count - 1;
      while (isOptionDisabled(MODQN_VIEW_OPTIONS[target].lane, proofEnabled) && target > 0) target -= 1;
    } else if (step !== null) {
      for (let i = 0; i < count; i += 1) {
        target = (target + step + count) % count;
        if (!isOptionDisabled(MODQN_VIEW_OPTIONS[target].lane, proofEnabled)) break;
      }
    }
    const nextLane = MODQN_VIEW_OPTIONS[target].lane;
    if (isOptionDisabled(nextLane, proofEnabled)) return;
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
        {MODQN_VIEW_OPTIONS.map((option, index) => {
          const active = option.lane === value;
          const disabled = isOptionDisabled(option.lane, proofEnabled);
          return (
            <button
              key={option.lane}
              role="tab"
              type="button"
              className="leo-modqn-view-toggle__button"
              data-testid={`modqn-view-${option.lane}`}
              data-active={active ? 'true' : 'false'}
              aria-selected={active}
              disabled={disabled}
              tabIndex={active ? 0 : -1}
              onClick={() => { if (!active && !disabled) onChange(option.lane); }}
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
