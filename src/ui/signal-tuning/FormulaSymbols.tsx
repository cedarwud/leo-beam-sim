import type { CSSProperties } from 'react';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';

const angleStateStyle: CSSProperties = {
  display: 'inline',
  fontWeight: 800,
  fontStyle: 'italic',
};

/** Current-step system angle state from the simplified presentation contract. */
export function SystemAngleState() {
  return (
    <span
      aria-label="bold theta"
      data-formula-symbol="system-angle-state"
      style={angleStateStyle}
    >
      θ
    </span>
  );
}

/** Direct off-axis angle of one fixed user-satellite-beam link. */
export function LinkAngle() {
  return <>θ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub></>;
}

/** Primed link index used by the system-power aggregation. */
export function PrimedLinkIndex() {
  return <>u′,s′,v′</>;
}

/** Explicit system-power aggregation used by the active presentation contract. */
export function SystemPowerSum() {
  return (
    <>
      Σ<sub>u′∈𝒰</sub>Σ<sub>s′∈𝒮</sub>Σ<sub>v′∈𝒱</sub>{' '}
      x<sub>u′,s′,v′</sub>(t)P<sup>p</sup><sub>u′,s′,v′</sub>(t, θ<sub>u′,s′,v′</sub>)
    </>
  );
}
