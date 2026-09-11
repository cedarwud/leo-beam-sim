import type { ComponentProps, JSX } from 'react';

import { BeamPulseClock } from '../viz/SatelliteBeams';
import { OrbitTrail } from '../viz/OrbitTrail';
import { ServingGroundRipple } from '../viz/ServingGroundRipple';
import { SpineParticles } from '../viz/SpineParticles';

type OrbitTrailProps = ComponentProps<typeof OrbitTrail>;
type SpineParticlesProps = ComponentProps<typeof SpineParticles>;
type ServingGroundRippleProps = ComponentProps<typeof ServingGroundRipple>;

export interface SceneOrbitTrailLayer {
  readonly mounted: boolean;
  readonly satellites: OrbitTrailProps['satellites'];
}

export interface SceneSpineParticleLayer {
  readonly mounted: boolean;
  readonly satellites: SpineParticlesProps['satellites'];
  readonly satBeams: SpineParticlesProps['satBeams'];
  readonly plans: SpineParticlesProps['plans'];
}

export interface SceneGroundRippleLayer {
  readonly mounted: boolean;
  readonly satBeams: ServingGroundRippleProps['satBeams'];
  readonly footprintRadius: ServingGroundRippleProps['footprintRadius'];
  readonly servingEnabled: ServingGroundRippleProps['servingEnabled'];
  readonly pendingEnabled: ServingGroundRippleProps['pendingEnabled'];
  readonly identityColorBySatelliteId: ServingGroundRippleProps['identityColorBySatelliteId'];
  readonly identityColorBySatelliteBeamId: ServingGroundRippleProps['identityColorBySatelliteBeamId'];
  readonly paused: ServingGroundRippleProps['paused'];
  readonly reducedMotion: ServingGroundRippleProps['reducedMotion'];
  readonly recentHoActive: ServingGroundRippleProps['recentHoActive'];
}

export interface SceneHandoverMotionLayersProps {
  readonly reducedMotion: boolean;
  readonly orbitTrail: SceneOrbitTrailLayer;
  readonly spineParticles: SceneSpineParticleLayer;
  readonly groundRipple: SceneGroundRippleLayer;
}

/**
 * Renders the natural animated context around the beam field.
 *
 * `HandoverLinks` (a straight satellite→UE line) used to render here too.
 * Retired: `showLiveSceneEffects` and `showSinrLiveCellBeams` are the exact
 * same underlying flag (`showSinrBeamRender` in `sceneLaneRenderPlan.ts`),
 * so the line was structurally NEVER visible without the serving/candidate
 * beam cone for that same link also being visible — the cone's apex-to-base
 * geometry, plus this session's EE colour/opacity shading, already says
 * "this satellite serves this ground point." The line was a second visual
 * grammar for the identical fact, which read as clutter rather than added
 * information. The component (`viz/HandoverLinks.tsx`) is kept — its
 * `identityColorForLink`/`markerColorForBeam` colour helpers are still used
 * elsewhere — only the JSX mount here is gone.
 */
export function SceneHandoverMotionLayers({
  reducedMotion,
  orbitTrail,
  spineParticles,
  groundRipple,
}: SceneHandoverMotionLayersProps): JSX.Element {
  return (
    <>
      <BeamPulseClock reducedMotion={reducedMotion} />
      {orbitTrail.mounted && <OrbitTrail satellites={orbitTrail.satellites} />}
      {spineParticles.mounted && (
        <SpineParticles
          satellites={spineParticles.satellites}
          satBeams={spineParticles.satBeams}
          plans={spineParticles.plans}
        />
      )}
      {groundRipple.mounted && (
        <ServingGroundRipple
          satBeams={groundRipple.satBeams}
          footprintRadius={groundRipple.footprintRadius}
          servingEnabled={groundRipple.servingEnabled}
          pendingEnabled={groundRipple.pendingEnabled}
          identityColorBySatelliteId={groundRipple.identityColorBySatelliteId}
          identityColorBySatelliteBeamId={groundRipple.identityColorBySatelliteBeamId}
          paused={groundRipple.paused}
          reducedMotion={groundRipple.reducedMotion}
          recentHoActive={groundRipple.recentHoActive}
        />
      )}
    </>
  );
}
