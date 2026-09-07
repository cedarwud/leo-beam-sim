import type { JSX } from 'react';

import {
  HOMEPAGE_PRIMARY_UE_MARKER_COLOR,
  HOMEPAGE_PRIMARY_UE_MARKER_EMISSIVE,
} from '../homepage/controller/homepageAccentPalette';
import type { BeamLoadContentionModel } from './beamLoadContention';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type { ModqnUeServiceProjection } from './modqnServiceMap';
import type { SinrServingMarkerColor } from './sinrServingMosaic';
import type { UeTrailHistory } from './useUeTrailHistory';
import { GroundScene, type GroundSceneUe } from '../viz/GroundScene';

export type SceneDisplayedUe = Pick<
  NormalizedSceneFrame['ues'][number],
  'id' | 'worldPos'
> & {
  /** Display-only cue for a secondary UE selected by the live HO filter. */
  readonly isOtherHandover?: boolean;
};

export interface SceneGroundUeLayerMarkerOptions {
  readonly markerMultiplier: number;
  readonly markerShape: 'cylinder' | 'sphere';
  readonly trailHistory?: UeTrailHistory;
  readonly trailVisible: boolean;
  readonly secondaryOpacity: number;
  readonly secondaryScale: number;
  readonly colorTelemetryAttr?: string;
}

export interface SceneGroundUeLayerAppearance {
  readonly sinrServingColorById?: ReadonlyMap<string, SinrServingMarkerColor> | null;
  readonly modqnServiceByUeId: ReadonlyMap<string, Pick<ModqnUeServiceProjection, 'markerColor' | 'markerEmissive'>>;
  readonly beamLoadContention: BeamLoadContentionModel;
  readonly beamLoadContentionEnabled: boolean;
  readonly loadOverlaysVisible: boolean;
  readonly eventEffectsVisible: boolean;
  readonly homepageVisualIdentity: boolean;
}

export interface SceneGroundUeLayerProps {
  readonly visible: boolean;
  readonly ues: ReadonlyArray<SceneDisplayedUe>;
  readonly marker: SceneGroundUeLayerMarkerOptions;
  readonly appearance: SceneGroundUeLayerAppearance;
}

export function resolveGroundSceneUes({
  ues,
  appearance,
}: Pick<SceneGroundUeLayerProps, 'ues' | 'appearance'>): GroundSceneUe[] {
  return ues
    .filter(ue => ue.worldPos !== undefined)
    .map((ue, index) => {
      // The primary UE stays the focus anchor. Secondary markers use the
      // measured serving mosaic first and the MODQN service map only as a
      // display fallback when the mosaic has no colour for that UE.
      const mosaic = index === 0
        ? undefined
        : appearance.sinrServingColorById?.get(ue.id);
      const service = mosaic || !appearance.loadOverlaysVisible
        ? undefined
        : appearance.modqnServiceByUeId.get(ue.id);
      const contention = appearance.loadOverlaysVisible && appearance.beamLoadContentionEnabled
        ? appearance.beamLoadContention.byUeId.get(ue.id)?.normalizedLoad ?? 0
        : undefined;
      const isOtherHandover = appearance.eventEffectsVisible
        && ue.isOtherHandover === true;

      return {
        id: ue.id,
        worldPos: ue.worldPos as readonly [number, number, number],
        markerColor: isOtherHandover
          ? '#facc15'
          : index === 0 && appearance.homepageVisualIdentity
            ? HOMEPAGE_PRIMARY_UE_MARKER_COLOR
            : mosaic?.markerColor ?? service?.markerColor,
        markerEmissive: isOtherHandover
          ? '#f59e0b'
          : index === 0 && appearance.homepageVisualIdentity
            ? HOMEPAGE_PRIMARY_UE_MARKER_EMISSIVE
            : mosaic?.markerEmissive ?? service?.markerEmissive,
        contention,
        isOtherHandover,
      };
    });
}

/** Renders the ground UE field after resolving all display-only marker styles. */
export function SceneGroundUeLayer({
  visible,
  ues,
  marker,
  appearance,
}: SceneGroundUeLayerProps): JSX.Element | null {
  if (!visible) return null;

  return (
    <GroundScene
      ues={resolveGroundSceneUes({ ues, appearance })}
      ueMarkerMultiplier={marker.markerMultiplier}
      markerShape={marker.markerShape}
      ueTrailHistory={marker.trailVisible ? marker.trailHistory : undefined}
      secondaryOpacity={marker.secondaryOpacity}
      secondaryScale={marker.secondaryScale}
      colorTelemetryAttr={marker.colorTelemetryAttr}
    />
  );
}
