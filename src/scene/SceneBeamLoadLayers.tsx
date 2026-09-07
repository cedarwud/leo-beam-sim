import type { ComponentProps, JSX } from 'react';

import { BeamLoadCylinder } from '../viz/BeamLoadCylinder';
import { BeamLoadUploadParticles } from '../viz/BeamLoadUploadParticles';

type BeamLoadCylinderModel = Omit<ComponentProps<typeof BeamLoadCylinder>, 'visible'> & {
  /** Preserve the original outer JSX mount gate. */
  readonly mounted: boolean;
  /** Preserve the child mesh visibility gate while it stays mounted. */
  readonly visible: boolean;
};

type BeamLoadUploadParticlesModel = ComponentProps<typeof BeamLoadUploadParticles> & {
  /** The parent presentation plan's load-overlay gate. */
  readonly visible: boolean;
};

export interface SceneBeamLoadLayersProps {
  readonly cylinder: BeamLoadCylinderModel;
  readonly uploadParticles: BeamLoadUploadParticlesModel;
}

/** Renders the optional load cylinder and upload-particle overlays. */
export function SceneBeamLoadLayers({
  cylinder,
  uploadParticles,
}: SceneBeamLoadLayersProps): JSX.Element | null {
  if (!cylinder.mounted && !uploadParticles.visible) return null;

  return (
    <>
      {cylinder.mounted && (
        <BeamLoadCylinder
          worldPos={cylinder.worldPos}
          normalizedLoad={cylinder.normalizedLoad}
          load={cylinder.load}
          tintColor={cylinder.tintColor}
          visible={cylinder.visible}
        />
      )}
      {uploadParticles.visible && (
        <BeamLoadUploadParticles
          focusCones={uploadParticles.focusCones}
          beamLoadContention={uploadParticles.beamLoadContention}
          focusedUe={uploadParticles.focusedUe}
          enabled={uploadParticles.enabled}
          paused={uploadParticles.paused}
          reducedMotion={uploadParticles.reducedMotion}
        />
      )}
    </>
  );
}
