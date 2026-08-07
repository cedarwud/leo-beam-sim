// The SINR-live tuning surface, rendered INLINE in the left aside (always visible,
// in-flow, one scroll). App injects the tuner panels as nodes so this component does
// not prop-drill their large sets.
//
// The two `<details>` wrappers ("SINR formula" / "Handover policy") are gone
// (owner call 2026-08-06: 把 "SINR formula" 刪除，不需要再下拉收合了). The panel it
// wraps now carries its own SINR / EE / Policy / Scene tab strip, so an outer
// collapsible was a second, redundant navigation layer around a surface that
// already navigates itself — and its English summary was the last untranslated
// heading on the rail. The containers keep their test ids.
import { type ReactElement, type ReactNode } from 'react';

interface SinrLiveDisplayDrawerProps {
  /** The relocated SINR-formula tuner (App injects the panel node). */
  readonly sinrFormulaSection?: ReactNode;
  /** The relocated handover-policy tuner (App injects the panel node). */
  readonly handoverPolicySection?: ReactNode;
}

export function SinrLiveDisplayDrawer({
  sinrFormulaSection,
  handoverPolicySection,
}: SinrLiveDisplayDrawerProps): ReactElement {
  return (
    <section
      className="leo-sinr-advanced-inline leo-sidebar-content-stack"
      data-testid="sinr-live-display"
      aria-label="SINR-live tuning controls"
    >
      {sinrFormulaSection && (
        <div className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-formula">
          <div className="leo-sinr-advanced-body">{sinrFormulaSection}</div>
        </div>
      )}

      {handoverPolicySection && (
        <div className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-handover">
          <div className="leo-sinr-advanced-body">{handoverPolicySection}</div>
        </div>
      )}
    </section>
  );
}
