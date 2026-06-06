import type { KeyboardEvent } from 'react';
import type { SceneLane } from '../app/sceneLane';

// The four authoritative scene lanes, surfaced as one top-level "Experience"
// segmented control. This is the single in-app entry point for the viewport
// lane axis: it owns BOTH the appMode (SINR vs MODQN) and the sceneSource
// (live-sim vs artifact-replay) choice, mapping each segment to one SceneLane.
//
// Before this control, `artifact-replay` (and everything it owns — the MODQN
// pipeline flowchart, the Plane-C dashboard, the satellite compass, the real
// artifact Director cinematic) was reachable ONLY by loading the page with the
// `?sceneSource=artifact-replay` URL param, and the MODQN replay-proof lane was
// three sidebar clicks deep. The selector value is the resolved SceneLane and
// `onChange` hands back the target lane; App owns the governance-safe transition
// (reset artifact/replay state, cancel any armed Director focus, fail closed
// while the artifact streams).
export interface LaneExperienceOption {
  readonly lane: SceneLane;
  readonly label: string;
  readonly sub: string;
}

export const LANE_EXPERIENCE_OPTIONS: readonly LaneExperienceOption[] = [
  { lane: 'sinr-live', label: 'SINR Live', sub: 'live SINR beams' },
  { lane: 'modqn-live-cell-preview', label: 'MODQN Live', sub: 'cell preview + training' },
  { lane: 'modqn-replay-proof', label: 'MODQN Proof', sub: 'replay evidence' },
  { lane: 'artifact-replay', label: 'Artifact Showcase', sub: 'flowchart + dashboard' },
];

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
      <span className="leo-lane-experience-bar__title" aria-hidden="true">Experience</span>
      <div className="leo-lane-experience-bar__group">
        {LANE_EXPERIENCE_OPTIONS.map((option, index) => {
          const active = option.lane === value;
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
