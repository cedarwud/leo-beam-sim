import type { KeyboardEvent } from 'react';
import type { SceneLane } from '../app/sceneLane';

// The top-level "Experience" segmented control. After the 4->2 nav consolidation
// (docs/modqn-tab-consolidation-plan.md) this surfaces only the TWO primary
// experiences — SINR and MODQN — even though FOUR authoritative SceneLanes exist.
// This is the governance keystone made literal: nav != lane (a non-injective map,
// ADR-002). The SINR segment owns the sinr-live lane; the MODQN segment owns the
// modqn-live-cell-preview lane AND, via the in-MODQN ModqnViewToggle sub-nav, the
// modqn-replay-proof and artifact-replay lanes. `value` is the resolved SceneLane;
// it is collapsed to a nav segment by `navSegmentForLane` so the MODQN button
// stays highlighted across all three MODQN lanes. `onChange` hands back the target
// lane; App owns the governance-safe transition (reset artifact/replay state,
// cancel any armed Director focus, fail closed while the artifact streams).
//
// SceneLane enum stays 4 (CLAUDE.md Rule#4): nav segments are UI chrome, not lanes.
export interface LaneExperienceOption {
  readonly lane: SceneLane;
  readonly label: string;
  readonly sub: string;
}

export const LANE_EXPERIENCE_OPTIONS: readonly LaneExperienceOption[] = [
  { lane: 'sinr-live', label: 'SINR', sub: 'live SINR beams' },
  { lane: 'modqn-live-cell-preview', label: 'MODQN', sub: 'decision + replay evidence' },
];

// nav != lane: collapse the 4 SceneLanes onto the 2 nav segments. The SINR
// segment maps from sinr-live only; the MODQN segment maps from all three MODQN
// lanes (live-cell-preview / replay-proof / artifact-replay), so the MODQN button
// stays active while the in-MODQN ModqnViewToggle picks the sub-lane.
export function navSegmentForLane(lane: SceneLane): SceneLane {
  return lane === 'sinr-live' ? 'sinr-live' : 'modqn-live-cell-preview';
}

export interface LaneExperienceBarProps {
  readonly value: SceneLane;
  readonly onChange: (lane: SceneLane) => void;
}

function focusLaneButton(lane: SceneLane): void {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLButtonElement>(`[data-testid="lane-experience-${lane}"]`)
      ?.focus();
  });
}

export function LaneExperienceBar({ value, onChange }: LaneExperienceBarProps) {
  const activeSegment = navSegmentForLane(value);
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % LANE_EXPERIENCE_OPTIONS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + LANE_EXPERIENCE_OPTIONS.length) % LANE_EXPERIENCE_OPTIONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = LANE_EXPERIENCE_OPTIONS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextLane = LANE_EXPERIENCE_OPTIONS[nextIndex].lane;
    onChange(nextLane);
    focusLaneButton(nextLane);
  };

  return (
    <nav
      className="leo-lane-experience-bar"
      role="tablist"
      aria-label="Showcase experience"
      data-testid="lane-experience-bar"
    >
      <div className="leo-lane-experience-bar__group">
        {LANE_EXPERIENCE_OPTIONS.map((option, index) => {
          const active = option.lane === activeSegment;
          return (
            <button
              key={option.lane}
              role="tab"
              type="button"
              className="leo-lane-experience-bar__button"
              data-testid={`lane-experience-${option.lane}`}
              data-active={active ? 'true' : 'false'}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => { if (!active) onChange(option.lane); }}
              onKeyDown={event => handleKeyDown(event, index)}
            >
              <span className="leo-lane-experience-bar__label">{option.label}</span>
              <small className="leo-lane-experience-bar__sub">{option.sub}</small>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
