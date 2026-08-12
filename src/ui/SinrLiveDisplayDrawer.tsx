// The SINR-live tuning surface, rendered INLINE in the left aside (always visible,
// in-flow, one scroll). App injects the tuner panels as nodes so this component does
// not prop-drill their large sets.
//
// The former formula/handover drawers are gone. This slot now hosts only the
// homepage source/parameter surface. Walker handover policy is a separate
// legacy runtime and must not be mixed into the archived-TLE analysis frame.
import { type ReactElement, type ReactNode } from 'react';

interface SinrLiveDisplayDrawerProps {
  /** Homepage source and calculation-parameter surface. */
  readonly parameterSection?: ReactNode;
}

export function SinrLiveDisplayDrawer({
  parameterSection,
}: SinrLiveDisplayDrawerProps): ReactElement {
  return (
    <section
      className="leo-sinr-advanced-inline leo-sidebar-content-stack"
      data-testid="sinr-live-display"
      aria-label="SINR-live tuning controls"
    >
      {parameterSection && (
        <div className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-formula">
          <div className="leo-sinr-advanced-body">{parameterSection}</div>
        </div>
      )}
    </section>
  );
}
