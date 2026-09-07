import type { ComponentProps, JSX } from 'react';

import { BeamPulseClock } from '../viz/SatelliteBeams';
import { HandoverLinks } from '../viz/HandoverLinks';
import { OrbitTrail } from '../viz/OrbitTrail';
import { ServingGroundRipple } from '../viz/ServingGroundRipple';
import { SpineParticles } from '../viz/SpineParticles';

type HandoverLinksProps = ComponentProps<typeof HandoverLinks>;
type OrbitTrailProps = ComponentProps<typeof OrbitTrail>;
type SpineParticlesProps = ComponentProps<typeof SpineParticles>;
type ServingGroundRippleProps = ComponentProps<typeof ServingGroundRipple>;

export interface SceneHandoverLinkLayer {
  readonly mounted: boolean;
  readonly satellites: HandoverLinksProps['satellites'];
  readonly eventRoles: HandoverLinksProps['eventRoles'];
  readonly satBeams: HandoverLinksProps['satBeams'];
  readonly primaryUeAnchor: HandoverLinksProps['primaryUeAnchor'];
}

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
  readonly links: SceneHandoverLinkLayer;
  readonly orbitTrail: SceneOrbitTrailLayer;
  readonly spineParticles: SceneSpineParticleLayer;
  readonly groundRipple: SceneGroundRippleLayer;
}

/** Renders the natural handover links and animated context around the beam field. */
export function SceneHandoverMotionLayers({
  reducedMotion,
  links,
  orbitTrail,
  spineParticles,
  groundRipple,
}: SceneHandoverMotionLayersProps): JSX.Element {
  return (
    <>
      {links.mounted && (
        <HandoverLinks
          satellites={links.satellites}
          eventRoles={links.eventRoles}
          satBeams={links.satBeams}
          primaryUeAnchor={links.primaryUeAnchor}
        />
      )}
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
