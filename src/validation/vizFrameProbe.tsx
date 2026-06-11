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
import { showcaseArtifactToScene } from '../showcase/showcaseArtifactToScene';
import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';
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

/**
 * Replay-path counterpart: project a `visual-showcase-v1` artifact frame
 * through `showcaseArtifactToScene` → `useBeamViz`, mirroring the renderer's
 * `artifact-replay` lane. The replay adapter attaches the (replay-branded)
 * `SceneGeometry` to the frame, so the probe feeds `frame.geometry` to the
 * hook. Same single-frame caveat as {@link captureVizFrame} (hysteresis refs
 * reset per render).
 */
export function captureReplayVizFrame(input: {
  readonly artifact: VisualShowcaseArtifact;
  readonly frameIndex: number;
  readonly runtime: RuntimeConfig;
}): VizFrame {
  let captured: VizFrame | null = null;
  function Probe(): React.ReactElement {
    const frame = showcaseArtifactToScene(input.artifact, input.frameIndex);
    captured = useBeamViz(
      frame,
      frame.geometry,
      input.runtime,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
    return <div data-testid="replay-viz-frame-probe" />;
  }
  renderToStaticMarkup(<Probe />);
  if (!captured) throw new Error('useBeamViz replay probe did not capture a VizFrame');
  return captured;
}
