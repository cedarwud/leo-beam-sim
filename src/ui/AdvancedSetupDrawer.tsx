// MODQN tab consolidation S4 — Advanced setup drawer.
//
// The MODQN "Setup" power tools (TrainingForm / JobsPanel / ω-weight objective
// editor) were a second left-rail tab after S3. The north star is 少按鈕 / 直覺 /
// 零學習: the default MODQN surface should be the evidence/replay story, not a
// training console. S4 moves the setup tools OUT of the left rail (which then
// collapses to the single Evidence / Replay tab) and behind an opt-in Advanced
// drawer, so the power surface is reachable but not in the default path.
//
// These three components are KEEP-ACTIVE (real live SSE training telemetry, real
// backend polling, the only ω EDIT surface) — they are not degenerate-data
// parked. The drawer relocates them; it does not gate or disable them. The
// drawer trigger is mounted by App.tsx in the left aside, gated on the MODQN
// lanes (`sceneLane !== 'sinr-live'`).
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { AppExperienceMode } from './appMode';
import { TrainingForm } from './modqn-training/TrainingForm';
import { JobsPanel } from './modqn-training/JobsPanel';
import { ModqnObjectiveTab } from './ModqnObjectiveTab';

interface AdvancedSetupDrawerProps {
  readonly appMode: AppExperienceMode;
  /** Forwarded to JobsPanel — loads a finished training bundle into the scene. */
  readonly onLoadIntoScene?: (jobId: string) => void;
}

export function AdvancedSetupDrawer({
  appMode,
  onLoadIntoScene,
}: AdvancedSetupDrawerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // a11y: restore focus to the trigger when the drawer closes (Escape / backdrop
  // / × all route through here), so keyboard focus never lands on a hidden node.
  const closeDrawer = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    // Move focus into the dialog on open.
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="leo-advanced-setup" data-testid="advanced-setup">
      <button
        ref={triggerRef}
        type="button"
        className="leo-advanced-setup-trigger"
        data-testid="advanced-setup-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span>⚙ Advanced setup</span>
        <small>training · jobs · ω-weights</small>
      </button>
      {open && (
        <div
          className="leo-advanced-setup-overlay"
          data-testid="advanced-setup-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="MODQN advanced setup"
          onClick={closeDrawer}
        >
          <div
            className="leo-advanced-setup-panel"
            onClick={event => event.stopPropagation()}
          >
            <header className="leo-advanced-setup-header">
              <strong>MODQN advanced setup</strong>
              <button
                ref={closeRef}
                type="button"
                className="leo-advanced-setup-close"
                data-testid="advanced-setup-close"
                aria-label="Close advanced setup"
                onClick={closeDrawer}
              >
                ×
              </button>
            </header>
            <div className="leo-advanced-setup-content leo-sidebar-content-stack">
              <TrainingForm appMode={appMode} />
              <JobsPanel appMode={appMode} onLoadIntoScene={onLoadIntoScene} />
              <ModqnObjectiveTab />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
