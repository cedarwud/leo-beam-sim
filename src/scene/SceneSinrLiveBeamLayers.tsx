import type { ComponentProps, JSX } from 'react';

import type { SinrLiveConePalette } from '../constants/sinrLiveConeStyle';
import {
  HandoverTeachingBeamCones,
  type HandoverTeachingSceneStory,
} from '../viz/HandoverTeachingBeamCones';
import {
  SinrLiveCellBeamCallouts,
  type SinrLiveCellBeamCalloutsProps,
} from '../viz/SinrLiveCellBeamCallouts';
import {
  SinrLiveCellBeamCones,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveConeMountLayer,
  type SinrLiveCellPlacement,
} from '../viz/SinrLiveCellBeamCones';
import {
  SinrLiveCellFootprintRings,
  type SinrLiveCellFootprintRingsProps,
} from '../viz/SinrLiveCellFootprintRings';

type BeamCalloutFrameSnapshot = SinrLiveCellBeamCalloutsProps['frameSnapshot'];
type TeachingFrameRef = ComponentProps<typeof HandoverTeachingBeamCones>['frameRef'];
type BeamWorldMap = ComponentProps<typeof HandoverTeachingBeamCones>['satelliteWorldById'];

export interface SceneSinrPrimaryServing {
  readonly satId: string | null;
  readonly cellId: number | null;
  readonly beamId: number | null;
}

export interface SceneSinrLiveBeamAppearance {
  readonly homepageVisualIdentity: boolean;
  readonly homepageBeamEeByKey: ReadonlyMap<string, number | null> | undefined;
  readonly homepageIdentityPaletteIndexBySatelliteId:
    ReadonlyMap<string, number | null> | undefined;
  readonly widthScale: number;
  readonly ellipseTiltExaggeration: number;
}

export interface SceneSinrLiveBeamElevationDimming {
  readonly enabled: boolean;
  readonly floorDeg: number;
  readonly ceilDeg: number;
  readonly minFactor: number;
  readonly heroExempt: boolean;
  readonly primaryServing?: SceneSinrPrimaryServing;
}

export interface SceneSinrLiveBeamConeLayer {
  readonly key: string;
  /** The original JSX mount gate; false means the renderer is not mounted. */
  readonly mounted: boolean;
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  readonly layer: SinrLiveConeMountLayer;
  readonly palette?: SinrLiveConePalette;
  readonly telemetryCountDatasetKey: string;
  readonly elevationDimming?: SceneSinrLiveBeamElevationDimming;
}

export interface SceneSinrLiveBeamFootprintLayer {
  readonly key: string;
  /** The original JSX mount gate; false means the renderer is not mounted. */
  readonly mounted: boolean;
  /** Preserve the footprint renderer's separate child visibility gate. */
  readonly visible?: boolean;
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  readonly layer: SinrLiveCellFootprintRingsProps['layer'];
  readonly palette?: SinrLiveCellFootprintRingsProps['palette'];
  readonly primaryServing?: SceneSinrPrimaryServing;
  readonly telemetryCountDatasetKey: string;
}

export interface SceneSinrLiveBeamCalloutLayer {
  readonly mounted: boolean;
  readonly items: SinrLiveCellBeamCalloutsProps['items'];
  readonly servingSinrByCellId: SinrLiveCellBeamCalloutsProps['servingSinrByCellId'];
  readonly primaryServing: SceneSinrPrimaryServing;
  readonly frameSnapshot: BeamCalloutFrameSnapshot;
  readonly homepageBeamEeBitsPerJouleByKey:
    SinrLiveCellBeamCalloutsProps['homepageBeamEeBitsPerJouleByKey'];
  readonly homepageBeamEeByKey: SinrLiveCellBeamCalloutsProps['homepageBeamEeByKey'];
  readonly homepageIdentityPaletteIndexBySatelliteId:
    SinrLiveCellBeamCalloutsProps['homepageIdentityPaletteIndexBySatelliteId'];
  readonly homepageVisualIdentity: boolean;
  readonly satelliteNameById: SinrLiveCellBeamCalloutsProps['satelliteNameById'];
  readonly telemetryCountDatasetKey: string;
}

export interface SceneSinrLiveTeachingLayer {
  readonly mounted: boolean;
  readonly story: HandoverTeachingSceneStory;
  readonly frameRef: TeachingFrameRef;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: BeamWorldMap;
}

export interface SceneSinrLiveBeamLayersProps {
  readonly appearance: SceneSinrLiveBeamAppearance;
  readonly cones: readonly SceneSinrLiveBeamConeLayer[];
  readonly footprints: readonly SceneSinrLiveBeamFootprintLayer[];
  readonly callouts: SceneSinrLiveBeamCalloutLayer | null;
  readonly teaching: SceneSinrLiveTeachingLayer | null;
}

function renderConeLayer(
  layer: SceneSinrLiveBeamConeLayer,
  appearance: SceneSinrLiveBeamAppearance,
): JSX.Element | null {
  if (!layer.mounted) return null;
  const dimming = layer.elevationDimming;
  const primaryServing = dimming?.primaryServing;
  return (
    <SinrLiveCellBeamCones
      key={layer.key}
      items={layer.items}
      layer={layer.layer}
      palette={layer.palette}
      colorAuthority="item-identity"
      homepageVisualIdentity={appearance.homepageVisualIdentity}
      homepageBeamEeByKey={appearance.homepageBeamEeByKey}
      homepageIdentityPaletteIndexBySatelliteId={appearance.homepageIdentityPaletteIndexBySatelliteId}
      widthScale={appearance.widthScale}
      ellipseTiltExaggeration={appearance.ellipseTiltExaggeration}
      dimShallowCones={dimming?.enabled}
      elevationDimFloorDeg={dimming?.floorDeg}
      elevationDimCeilDeg={dimming?.ceilDeg}
      elevationDimMinFactor={dimming?.minFactor}
      heroExemptFromElevationDim={dimming?.heroExempt}
      primaryServingSatId={primaryServing?.satId}
      primaryServingCellId={primaryServing?.cellId}
      primaryServingBeamId={primaryServing?.beamId}
      telemetryCountDatasetKey={layer.telemetryCountDatasetKey}
    />
  );
}

function renderFootprintLayer(
  layer: SceneSinrLiveBeamFootprintLayer,
  appearance: SceneSinrLiveBeamAppearance,
): JSX.Element | null {
  if (!layer.mounted) return null;
  const primaryServing = layer.primaryServing;
  return (
    <SinrLiveCellFootprintRings
      key={layer.key}
      items={layer.items}
      visible={layer.visible}
      layer={layer.layer}
      palette={layer.palette}
      colorAuthority="item-identity"
      homepageVisualIdentity={appearance.homepageVisualIdentity}
      homepageBeamEeByKey={appearance.homepageBeamEeByKey}
      homepageIdentityPaletteIndexBySatelliteId={appearance.homepageIdentityPaletteIndexBySatelliteId}
      widthScale={appearance.widthScale}
      primaryServingSatId={primaryServing?.satId}
      primaryServingCellId={primaryServing?.cellId}
      primaryServingBeamId={primaryServing?.beamId}
      telemetryCountDatasetKey={layer.telemetryCountDatasetKey}
    />
  );
}

/** Renders the cell-truth beam field, its footprints, callouts, and lecture cue. */
export function SceneSinrLiveBeamLayers({
  appearance,
  cones,
  footprints,
  callouts,
  teaching,
}: SceneSinrLiveBeamLayersProps): JSX.Element | null {
  const hasMountedLayer = cones.some(layer => layer.mounted)
    || footprints.some(layer => layer.mounted)
    || callouts?.mounted === true
    || teaching?.mounted === true;
  if (!hasMountedLayer) return null;

  return (
    <>
      {cones.map(layer => renderConeLayer(layer, appearance))}
      {footprints.map(layer => renderFootprintLayer(layer, appearance))}
      {callouts?.mounted && (
        <SinrLiveCellBeamCallouts
          items={callouts.items}
          servingSinrByCellId={callouts.servingSinrByCellId}
          primaryServingSatId={callouts.primaryServing.satId}
          primaryServingCellId={callouts.primaryServing.cellId}
          frameSnapshot={callouts.frameSnapshot}
          homepageBeamEeBitsPerJouleByKey={callouts.homepageBeamEeBitsPerJouleByKey}
          homepageBeamEeByKey={callouts.homepageBeamEeByKey}
          homepageIdentityPaletteIndexBySatelliteId={callouts.homepageIdentityPaletteIndexBySatelliteId}
          homepageVisualIdentity={callouts.homepageVisualIdentity}
          satelliteNameById={callouts.satelliteNameById}
          telemetryCountDatasetKey={callouts.telemetryCountDatasetKey}
        />
      )}
      {teaching?.mounted && (
        <HandoverTeachingBeamCones
          story={teaching.story}
          frameRef={teaching.frameRef}
          placementByCellId={teaching.placementByCellId}
          satelliteWorldById={teaching.satelliteWorldById}
          widthScale={appearance.widthScale}
          ellipseTiltExaggeration={appearance.ellipseTiltExaggeration}
        />
      )}
    </>
  );
}
