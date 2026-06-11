// Consolidation S0 — headless VizFrame capture (shared harness piece).
//
// Lifts the proven vc1d pattern (scripts/validate-vc1d-identity-match.tsx):
// useBeamViz is a React hook, but a single-frame capture needs no browser and
// no DOM — render a probe component with react-dom/server and grab the result.
// Caveat (documented in the audit recon): the hook's hysteresis refs reset on
// every renderToStaticMarkup call, so each capture is an INDEPENDENT frame
// (latch-dependent fields like approach previews are out of scope here; use a
// persistent createRoot fixture when a slice needs them).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Profile } from '../profiles/types';
import type { SceneGeometry } from '../scene/SceneGeometry';
import { useBeamViz } from '../scene/useBeamViz';
import { liveSimToScene } from '../showcase/liveSimToScene';
import type { RuntimeConfig, SimFrame, VizFrame } from '../scene/types';

export function captureVizFrame(input: {
  readonly sim: SimFrame;
  readonly geometry: SceneGeometry;
  readonly runtime: RuntimeConfig;
  readonly beamHopping?: Profile['beamHopping'];
  readonly disableUeAnchor?: boolean;
}): VizFrame {
  let captured: VizFrame | null = null;
  function Probe(): React.ReactElement {
    const frame = liveSimToScene(input.sim, input.geometry);
    captured = useBeamViz(
      frame,
      input.geometry,
      input.runtime,
      undefined,
      undefined,
      input.beamHopping,
      undefined,
      input.disableUeAnchor ?? false,
    );
    return <div data-testid="viz-frame-probe" />;
  }
  renderToStaticMarkup(<Probe />);
  if (!captured) throw new Error('useBeamViz probe did not capture a VizFrame');
  return captured;
}
