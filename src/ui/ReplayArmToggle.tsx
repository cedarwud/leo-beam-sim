import type { KeyboardEvent } from 'react';

// a2↔b1 replay-arm toggle.
//
// The replay-proof lane plays a RECORDED producer window (served/starved
// per-UE coverage truth baked in). This segmented control swaps WHICH arm's
// window the lane fetches — b1 (basic learned-argmax → red sea) ⇄ a2 (smart
// coordinated auction → all-green). App owns the `replayArm` state and points
// `recordedReplayArtifactUrl` at the matching window; changing it re-fetches and
// the red/green field re-flips automatically (App fetch effect deps include the
// URL). This control is a governance Shared Surface: PRESENTATIONAL ONLY — no 3D
// / scene / viz import, no truth. It never computes served/starved, only picks
// which producer window is displayed.
//
// Narrative order (defense runbook §5 beat ①→②): b1 (basic) sits LEFT, a2 (smart)
// sits RIGHT, so dragging right flips the red sea to green.
export type ReplayArm = 'a2' | 'b1';

export interface ReplayArmOption {
  readonly key: ReplayArm;
  readonly label: string;
  readonly sub: string;
}

export const REPLAY_ARM_OPTIONS: readonly ReplayArmOption[] = [
  { key: 'b1', label: '基本 argmax', sub: 'baseline · red sea' },
  { key: 'a2', label: '智慧 auction', sub: 'hero · all-green' },
];

export interface ReplayArmToggleProps {
  readonly arm: ReplayArm;
  readonly onArmChange: (arm: ReplayArm) => void;
}

function focusArmButton(arm: ReplayArm): void {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLButtonElement>(`[data-testid="replay-arm-toggle"] [data-arm="${arm}"]`)
      ?.focus();
  });
}

export function ReplayArmToggle({ arm, onArmChange }: ReplayArmToggleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let step: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') step = 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') step = -1;
    else if (event.key !== 'Home' && event.key !== 'End') return;

    event.preventDefault();
    const count = REPLAY_ARM_OPTIONS.length;
    let target = index;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = count - 1;
    else if (step !== null) target = (target + step + count) % count;

    const nextArm = REPLAY_ARM_OPTIONS[target].key;
    onArmChange(nextArm);
    focusArmButton(nextArm);
  };

  return (
    <nav
      className="leo-replay-arm-toggle"
      role="tablist"
      aria-label="Replay arm"
      data-testid="replay-arm-toggle"
    >
      <span className="leo-replay-arm-toggle__title" aria-hidden="true">Replay arm</span>
      <div className="leo-replay-arm-toggle__group">
        {REPLAY_ARM_OPTIONS.map((option, index) => {
          const active = option.key === arm;
          return (
            <button
              key={option.key}
              role="tab"
              type="button"
              className="leo-replay-arm-toggle__button"
              data-arm={option.key}
              data-active={active ? 'true' : 'false'}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => { if (!active) onArmChange(option.key); }}
              onKeyDown={event => handleKeyDown(event, index)}
            >
              <span className="leo-replay-arm-toggle__label">{option.label}</span>
              <small className="leo-replay-arm-toggle__sub">{option.sub}</small>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
