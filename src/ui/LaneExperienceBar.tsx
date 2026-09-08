import type { KeyboardEvent } from 'react';
import type { SceneLane } from '../app/sceneLane';

// The top-level experience control now exposes the canonical live SINR surface.
export interface LaneExperienceOption {
  readonly lane: SceneLane;
  readonly label: string;
  readonly sub: string;
}

export const LANE_EXPERIENCE_OPTIONS: readonly LaneExperienceOption[] = [
  { lane: 'sinr-live', label: 'SINR', sub: 'live SINR beams' },
];

export function navSegmentForLane(_lane: SceneLane): SceneLane {
  return 'sinr-live';
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
