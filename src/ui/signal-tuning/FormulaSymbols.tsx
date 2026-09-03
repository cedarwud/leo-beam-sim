import type { CSSProperties } from 'react';
import { SIMPLIFIED_EE_BEAM_INDEX, SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';

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

/** Full half-power beam width carried by every angle-aware public equation. */
export function Theta3db() {
  return <>θ<sub>3dB</sub></>;
}

/** Public active-contract notation for one UE--satellite--beam link. */
export function LinkRfPower() {
  return <><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>;
}

export function LinkChannel() {
  return <>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>;
}

export function LinkTransmitGain() {
  return <>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>;
}

export function LinkInterference() {
  return <>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>;
}

export function LinkSinr() {
  return <>γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>;
}

export function LinkRate() {
  return <>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>;
}

export function LinkEnergyEfficiency() {
  return <>η<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />, <Theta3db />)</>;
}

export function BeamRfPower() {
  return <><i>p</i><sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t, <SystemAngleState />, <Theta3db />)</>;
}

export function BeamEfficiency() {
  return <>ξ<sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t, <SystemAngleState />, <Theta3db />)</>;
}

export function BeamSupplyPower() {
  return <>P<sup>p</sup><sub>{SIMPLIFIED_EE_BEAM_INDEX}</sub>(t, <SystemAngleState />, <Theta3db />)</>;
}

/** Legacy primed link-index display retained for compatibility callers. */
export function PrimedLinkIndex() {
  return <>u′,s′,v′</>;
}

/** Explicit system-power aggregation used by the active presentation contract. */
export function SystemPowerSum() {
  return (
    <>
      Σ<sub>s′∈𝒮</sub>Σ<sub>v′∈𝒱</sub>{' '}
      z<sub>s′,v′</sub>(t)P<sup>p</sup><sub>s′,v′</sub>(t, <SystemAngleState />, <Theta3db />)
    </>
  );
}
