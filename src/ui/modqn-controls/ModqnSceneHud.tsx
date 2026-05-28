import type { JSX } from 'react';
import type { AppExperienceMode } from '../../app/appExperienceMode';
import type { SimState } from '../../scene/types';

interface Props {
  readonly appMode: AppExperienceMode;
  readonly simState: SimState;
  readonly bundleProvenanceKind: 'paper-faithful' | 'user-trained';
  readonly sceneSource: 'live-sim' | 'artifact-replay';
}

// Phase H §4.8: top-right HUD that surfaces sim time + handover counters +
// truth-lane chip so the user can tell whether the scene is live-sim (the
// modqn-demo default) or artifact-replay (paper-faithful or user-trained
// bundle loaded). The chip honors modqn-training-truth-visualization-sdd
// §4.4 - no producer-truth claim leaks into the live-sim chip.

function truthChipLabel(
  sceneSource: 'live-sim' | 'artifact-replay',
  bundleProvenanceKind: 'paper-faithful' | 'user-trained',
): { label: string; tone: 'live' | 'paper' | 'user' } {
  if (sceneSource === 'live-sim') {
    return { label: 'live-sim · profile-derived', tone: 'live' };
  }
  if (bundleProvenanceKind === 'user-trained') {
    return { label: 'user-trained replay', tone: 'user' };
  }
  return { label: 'paper-faithful replay', tone: 'paper' };
}

export function ModqnSceneHud({
  appMode,
  simState,
  bundleProvenanceKind,
  sceneSource,
}: Props): JSX.Element | null {
  if (appMode !== 'modqn-demo') return null;

  const { label, tone } = truthChipLabel(sceneSource, bundleProvenanceKind);
  const intraHoCount = simState.intraHoCount ?? 0;
  const hoCount = simState.hoCount ?? 0;
  const interHoCount = Math.max(0, hoCount - intraHoCount);
  const simTimeSec = simState.simTimeSec ?? 0;

  return (
    <div
      className="leo-modqn-scene-hud"
      data-testid="modqn-scene-hud"
      data-truth-tone={tone}
      data-sim-time-sec={simTimeSec.toFixed(1)}
      data-intra-ho-count={String(intraHoCount)}
      data-inter-ho-count={String(interHoCount)}
      aria-label="MODQN scene HUD"
    >
      <header className="leo-modqn-scene-hud__chip" data-truth-chip={tone}>
        {label}
      </header>
      <dl className="leo-modqn-scene-hud__metrics">
        <div>
          <dt>sim t</dt>
          <dd data-testid="modqn-scene-hud-sim-time">{simTimeSec.toFixed(1)}s</dd>
        </div>
        <div>
          <dt>intra HO</dt>
          <dd data-testid="modqn-scene-hud-intra-ho">{intraHoCount}</dd>
        </div>
        <div>
          <dt>inter HO</dt>
          <dd data-testid="modqn-scene-hud-inter-ho">{interHoCount}</dd>
        </div>
      </dl>
    </div>
  );
}
