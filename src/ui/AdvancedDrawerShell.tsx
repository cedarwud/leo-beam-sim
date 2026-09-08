// G1-CONTROLBAR-ADV — shared opt-in Advanced drawer shell.
//
// The advanced setup lane hosts its non-default controls behind an
// opt-in "⚙ Advanced" trigger at the foot of the left aside (north star: 少按鈕 /
// 直覺 / 零學習 — the default surface stays the scene, not a control panel). This
// shell owns the trigger button, the open/close + focus management, and two
// render modalities; the lane mounts its own content as children and picks one.
//
// modal=false: a non-modal inline disclosure rendered
//   in-flow in the aside. NO scrim — the scene and timeline stay live while the
//   drawer is open. Chosen because the advanced tools are degenerate-data power
//   tools you rarely touch live, so dimming the whole viewport added no value.
//   Behavior-locked by validate:frontend:advanced-drawer-modality.
// modal=true (legacy): a left-anchored modal drawer with a fixed full-viewport
//   scrim that tops every HUD layer (timeline not clickable through the modal).
//   Retained for callers that genuinely need a watch-blocking config surface.
//
// The shell carries NO lane-specific props — the lane decides labels, testid
// prefix, modality, and content.
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface AdvancedDrawerShellProps {
  /** testid prefix → `${prefix}`, `${prefix}-trigger`, `${prefix}-drawer`, `${prefix}-close`. */
  readonly testIdPrefix: string;
  readonly triggerLabel: string;
  readonly triggerHint: string;
  readonly dialogTitle: string;
  readonly dialogAriaLabel: string;
  readonly closeAriaLabel?: string;
  /** true = modal scrim drawer; false = non-modal inline disclosure. Default true. */
  readonly modal?: boolean;
  readonly children: ReactNode;
}

export function AdvancedDrawerShell({
  testIdPrefix,
  triggerLabel,
  triggerHint,
  dialogTitle,
  dialogAriaLabel,
  closeAriaLabel = 'Close advanced drawer',
  modal = true,
  children,
}: AdvancedDrawerShellProps): ReactNode {
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
    // Move focus into the panel on open.
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const header = (
    <header className="leo-advanced-setup-header">
      <strong>{dialogTitle}</strong>
      <button
        ref={closeRef}
        type="button"
        className="leo-advanced-setup-close"
        data-testid={`${testIdPrefix}-close`}
        aria-label={closeAriaLabel}
        onClick={closeDrawer}
      >
        ×
      </button>
    </header>
  );

  return (
    <div className="leo-advanced-setup" data-testid={testIdPrefix}>
      <button
        ref={triggerRef}
        type="button"
        className="leo-advanced-setup-trigger"
        data-testid={`${testIdPrefix}-trigger`}
        aria-haspopup={modal ? 'dialog' : undefined}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span>{triggerLabel}</span>
        <small>{triggerHint}</small>
      </button>
      {open && modal && (
        <div
          className="leo-advanced-setup-overlay"
          data-testid={`${testIdPrefix}-drawer`}
          role="dialog"
          aria-modal="true"
          aria-label={dialogAriaLabel}
          onClick={closeDrawer}
        >
          <div
            className="leo-advanced-setup-panel"
            onClick={event => event.stopPropagation()}
          >
            {header}
            <div className="leo-advanced-setup-content leo-sidebar-content-stack">
              {children}
            </div>
          </div>
        </div>
      )}
      {open && !modal && (
        // Non-modal inline disclosure: in-flow in the aside, no scrim, so the
        // scene + timeline stay interactive while display controls are adjusted.
        <div
          className="leo-inline-drawer"
          data-testid={`${testIdPrefix}-drawer`}
          role="region"
          aria-label={dialogAriaLabel}
        >
          {header}
          <div className="leo-inline-drawer-content leo-sidebar-content-stack">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
