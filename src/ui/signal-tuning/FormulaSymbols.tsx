import type { CSSProperties } from 'react';

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

/** Ordered angle-state trajectory used by the evaluation-window EE result. */
export function SystemAngleTrajectory() {
  return (
    <span
      aria-label="bold capital theta"
      data-formula-symbol="system-angle-trajectory"
      style={angleStateStyle}
    >
      Θ
    </span>
  );
}

/** Direct off-axis angle of one fixed user-satellite-beam link. */
export function LinkAngle() {
  // The homepage uses the short presentation form `(t, θ)` everywhere.  The
  // link ownership remains on the formula's `u,s,v` symbol; repeating the
  // ownership inside the angle argument made the display unnecessarily long.
  return <>θ</>;
}
