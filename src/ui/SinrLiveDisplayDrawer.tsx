// The SINR-live tuning surface, rendered INLINE in the left aside (always visible,
// in-flow, one scroll). It holds only the heavy tuners now:
//   - SINR formula (collapsible <details>, open by default)
//   - Handover policy (collapsible <details>, open by default)
// The cheap display toggles moved to the compact SinrLiveQuickControls row at the
// top of the rail; beam density + camera presets were retired. App injects the
// tuner panels as nodes so this component does not prop-drill their large sets.
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
        <details className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-formula" open>
          <summary className="leo-sinr-advanced-summary">SINR formula</summary>
          <div className="leo-sinr-advanced-body">{sinrFormulaSection}</div>
        </details>
      )}

      {handoverPolicySection && (
        <details className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-handover" open>
          <summary className="leo-sinr-advanced-summary">Handover policy</summary>
          <div className="leo-sinr-advanced-body">{handoverPolicySection}</div>
        </details>
      )}
    </section>
  );
}
