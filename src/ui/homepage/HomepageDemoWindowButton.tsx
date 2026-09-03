import type { ReactElement } from 'react';

export interface HomepageDemoWindowButtonProps {
  readonly enabled: boolean;
  readonly building?: boolean;
  readonly leadInSec?: number;
  readonly endSec?: number;
  readonly firstEventId?: string;
  readonly lastEventId?: string;
  readonly reason?: string;
  readonly onClick: () => void;
}

/**
 * Homepage-only entry point for the source-backed teaching window.
 *
 * This component owns no event selection, clock, decision, or snapshot.  It is
 * intentionally a thin button over the integration owner's existing seek path;
 * the selector and the live event index remain the only source of the window.
 */
export function HomepageDemoWindowButton({
  enabled,
  building = false,
  leadInSec,
  endSec,
  firstEventId,
  lastEventId,
  reason,
  onClick,
}: HomepageDemoWindowButtonProps): ReactElement {
  const title = enabled
    ? `Jump to the natural Intra → Inter teaching window${
      typeof leadInSec === 'number' && typeof endSec === 'number'
        ? ` (${leadInSec.toFixed(1)}–${endSec.toFixed(1)}s)`
        : ''
    }`
    : reason ?? (building
      ? 'Building the source-backed handover index'
      : 'No natural Intra → Inter window is available for the current parameters');

  return (
    <div
      className="leo-homepage-demo-window"
      data-testid="homepage-demo-window"
      data-homepage-demo-window-enabled={enabled ? '1' : '0'}
      data-homepage-demo-window-building={building ? '1' : '0'}
      data-homepage-demo-window-lead-in-sec={typeof leadInSec === 'number' ? leadInSec.toFixed(3) : ''}
      data-homepage-demo-window-end-sec={typeof endSec === 'number' ? endSec.toFixed(3) : ''}
      data-homepage-demo-window-first-event-id={firstEventId ?? ''}
      data-homepage-demo-window-last-event-id={lastEventId ?? ''}
      data-homepage-demo-window-reason={reason ?? ''}
    >
      <button
        type="button"
        className="leo-homepage-demo-window__button"
        disabled={!enabled}
        onClick={onClick}
        title={title}
        aria-label="Jump to the natural Intra to Inter teaching window"
      >
        Demo Intra → Inter
      </button>
      {!enabled && (
        <span className="leo-homepage-demo-window__status" role="status">
          {building ? 'Building…' : 'Unavailable'}
        </span>
      )}
    </div>
  );
}
