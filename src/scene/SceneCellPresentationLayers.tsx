import type { ComponentProps, JSX } from 'react';

import { CellOverlay } from '../viz/CellOverlay';
import { CellHandoverArcs } from '../viz/CellHandoverArcs';
import { CellBeamCones } from '../viz/CellBeamCones';
import { HandoverStoryLayer } from '../viz/HandoverStoryLayer';

type CellOverlayModel = Omit<ComponentProps<typeof CellOverlay>, 'visible'> & {
  readonly visible: boolean;
};

type HandoverStoryModel = Omit<ComponentProps<typeof HandoverStoryLayer>, 'visible'> & {
  readonly visible: boolean;
};

type CellHandoverArcModel = Omit<ComponentProps<typeof CellHandoverArcs>, 'visible'> & {
  /** Preserve the original outer JSX mount gate. */
  readonly mounted: boolean;
  /** Preserve the child layer visibility gate. */
  readonly visible: boolean;
};

type CellBeamConeModel = Omit<ComponentProps<typeof CellBeamCones>, 'visible'> & {
  readonly visible: boolean;
};

export interface SceneCellPresentationLayersProps {
  readonly overlay: CellOverlayModel;
  readonly story: HandoverStoryModel;
  readonly arcs: CellHandoverArcModel;
  readonly beamCones: CellBeamConeModel;
}

/** Renders the ground cell, handover-story, arc, and cone layers together. */
export function SceneCellPresentationLayers({
  overlay,
  story,
  arcs,
  beamCones,
}: SceneCellPresentationLayersProps): JSX.Element {
  if (!overlay.visible && !story.visible && !arcs.mounted && !beamCones.visible) {
    return <></>;
  }

  return (
    <>
      {overlay.visible && (
        <CellOverlay
          schedule={overlay.schedule}
          satelliteTintById={overlay.satelliteTintById}
          satelliteWorldById={overlay.satelliteWorldById}
          showFootprints={overlay.showFootprints}
          ueCountByCellId={overlay.ueCountByCellId}
          showUeCounts={overlay.showUeCounts}
        />
      )}
      {story.visible && (
        <HandoverStoryLayer
          model={story.model}
          satelliteTintById={story.satelliteTintById}
        />
      )}
      {arcs.mounted && (
        <CellHandoverArcs
          visible={arcs.visible}
          reassignments={arcs.reassignments}
          satelliteWorldById={arcs.satelliteWorldById}
        />
      )}
      {beamCones.visible && (
        <CellBeamCones
          schedule={beamCones.schedule}
          satelliteWorldById={beamCones.satelliteWorldById}
          satelliteTintById={beamCones.satelliteTintById}
          focusedUe={beamCones.focusedUe}
          beamConeScope={beamCones.beamConeScope}
          appMode={beamCones.appMode}
        />
      )}
    </>
  );
}
