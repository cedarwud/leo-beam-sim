import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import * as THREE from 'three';

import {
  HOMEPAGE_PRIMARY_UE_MARKER_COLOR,
  HOMEPAGE_PRIMARY_UE_MARKER_EMISSIVE,
} from '../homepage/controller/homepageAccentPalette';
import type { CellScheduleViz } from './useCellSchedule';
import {
  deriveBeamLoadContention,
  EMPTY_BEAM_LOAD_CONTENTION,
} from './beamLoadContention';
import {
  SceneBeamLoadLayers,
  type SceneBeamLoadLayersProps,
} from './SceneBeamLoadLayers';
import {
  SceneCellPresentationLayers,
  type SceneCellPresentationLayersProps,
} from './SceneCellPresentationLayers';
import {
  SceneGroundUeLayer,
  resolveGroundSceneUes,
  type SceneGroundUeLayerProps,
} from './SceneGroundUeLayer';
import {
  SceneHandoverMotionLayers,
  type SceneHandoverMotionLayersProps,
} from './SceneHandoverMotionLayers';
import { SceneHandoverToastLayer } from './SceneHandoverToastLayer';
import { SceneIntraGroundShockwave } from './SceneIntraGroundShockwave';
import {
  SceneMultiCandidateLayer,
  type SceneMultiCandidateLayerProps,
} from './SceneMultiCandidateLayer';
import { SceneAcceptedHandoverCue } from './SceneAcceptedHandoverCue';
import {
  SceneSatelliteMarkerLayer,
  type SceneSatelliteMarkerLayerProps,
} from './SceneSatelliteMarkerLayer';
import { SceneSinrLiveBeamLayers } from './SceneSinrLiveBeamLayers';

function childElements(node: ReactElement | null): ReactElement[] {
  if (node === null) return [];
  const props = node.props as { readonly children?: ReactNode };
  return Children.toArray(props.children).filter(isValidElement) as ReactElement[];
}

function elementProps<T extends object>(node: ReactElement | null): T {
  assert.ok(node);
  return node.props as T;
}

test('ground UE layer resolves display styling before creating the renderer element', () => {
  const beamLoadContention = deriveBeamLoadContention([
    { ueId: 'ue-mosaic', servingSatId: 'sat-1', servingBeamId: 4 },
    { ueId: 'ue-other', servingSatId: 'sat-1', servingBeamId: 4 },
  ]);
  const props: SceneGroundUeLayerProps = {
    visible: true,
    ues: [
      { id: 'ue-primary', worldPos: [1, 2, 3] },
      { id: 'ue-mosaic', worldPos: [4, 5, 6] },
      { id: 'ue-other', worldPos: [7, 8, 9], isOtherHandover: true },
      { id: 'ue-missing', worldPos: undefined },
    ],
    marker: {
      markerMultiplier: 1,
      markerShape: 'sphere',
      trailVisible: false,
      secondaryOpacity: 1,
      secondaryScale: 1,
    },
    appearance: {
      sinrServingColorById: new Map([
        ['ue-mosaic', { markerColor: '#0ea5e9', markerEmissive: '#0369a1' }],
      ]),
      beamLoadContention,
      beamLoadContentionEnabled: true,
      loadOverlaysVisible: true,
      eventEffectsVisible: true,
      homepageVisualIdentity: true,
    },
  };

  const resolved = resolveGroundSceneUes(props);
  assert.equal(resolved.length, 3);
  assert.equal(resolved[0].markerColor, HOMEPAGE_PRIMARY_UE_MARKER_COLOR);
  assert.equal(resolved[0].markerEmissive, HOMEPAGE_PRIMARY_UE_MARKER_EMISSIVE);
  assert.equal(resolved[1].markerColor, '#0ea5e9');
  assert.equal(resolved[1].contention, 1);
  assert.equal(resolved[2].markerColor, '#facc15');
  assert.equal(resolved[2].isOtherHandover, true);

  const rendererElement = SceneGroundUeLayer(props);
  assert.ok(isValidElement(rendererElement));
  assert.equal(elementProps<{ readonly ues: readonly unknown[] }>(rendererElement).ues.length, 3);
  assert.equal(SceneGroundUeLayer({ ...props, visible: false }), null);
});

test('satellite marker layer keeps identity labels and visibility in one render tree', () => {
  const props: SceneSatelliteMarkerLayerProps = {
    satellites: [{
      id: 'sat-1',
      world: new THREE.Vector3(1, 2, 3),
      satelliteTintColor: '#38bdf8',
    }],
    visibility: {
      mounted: true,
      selectedSatellite: true,
      candidateSatellite: true,
      contextSatellites: true,
      centralMarkerSatelliteIds: null,
    },
    identity: {
      constellation: 'starlink',
      eventRoles: new Map(),
      multiCandidateColorById: new Map(),
      homepageNameById: new Map([['sat-1', 'Demo SAT']]),
    },
    labels: {
      candidateLabelActive: false,
      candidateOrdinalBySatelliteId: new Map(),
      candidateVisibleSatelliteIds: null,
      teachingLabelSatelliteIds: null,
      selectedLayerSatelliteId: null,
      candidateLayerSatelliteId: null,
      homepageLabelActive: true,
      homepageEeProgressById: null,
      homepageEeProgressVisible: false,
      handoverMarkerSatelliteIds: new Set(),
      heroSatelliteId: null,
      candidateEeSatelliteId: null,
    },
    emphasis: {
      multiCandidateSceneVisualActive: false,
      candidateComparisonSceneActive: false,
      candidateComparisonVisibleSatelliteIds: null,
      liveSource: true,
    },
  };

  const tree = SceneSatelliteMarkerLayer(props);
  const markers = childElements(tree);
  assert.equal(markers.length, 1);
  const markerProps = elementProps<{
    readonly label: string;
    readonly showLabel: boolean;
    readonly visible: boolean;
  }>(markers[0]);
  assert.equal(markerProps.label, 'Demo SAT');
  assert.equal(markerProps.showLabel, true);
  assert.equal(markerProps.visible, true);
  assert.equal(SceneSatelliteMarkerLayer({
    ...props,
    visibility: { ...props.visibility, mounted: false },
  }), null);
});

test('layer wrappers preserve mount gates without invoking WebGL child renderers', () => {
  const cellProps: SceneCellPresentationLayersProps = {
    overlay: {
      visible: false,
      schedule: {} as CellScheduleViz,
      satelliteTintById: new Map(),
    },
    story: {
      visible: false,
      model: null,
      satelliteTintById: new Map(),
    },
    arcs: {
      mounted: false,
      visible: false,
      reassignments: [],
      satelliteWorldById: new Map(),
    },
    beamCones: {
      visible: false,
      schedule: {} as CellScheduleViz,
      satelliteWorldById: new Map(),
      satelliteTintById: new Map(),
    },
  };
  assert.equal(childElements(SceneCellPresentationLayers(cellProps)).length, 0);
  assert.equal(
    childElements(SceneCellPresentationLayers({
      ...cellProps,
      overlay: { ...cellProps.overlay, visible: true },
    })).length,
    1,
  );

  const beamLoadProps: SceneBeamLoadLayersProps = {
    cylinder: {
      worldPos: undefined,
      normalizedLoad: 0,
      load: 0,
      mounted: false,
      visible: false,
    },
    uploadParticles: {
      visible: false,
      focusCones: [],
      beamLoadContention: EMPTY_BEAM_LOAD_CONTENTION,
      focusedUe: null,
      enabled: false,
      paused: false,
      reducedMotion: true,
    },
  };
  assert.equal(SceneBeamLoadLayers(beamLoadProps), null);
  assert.equal(childElements(SceneBeamLoadLayers({
    ...beamLoadProps,
    cylinder: { ...beamLoadProps.cylinder, mounted: true },
  })).length, 1);

  const emptySinrLayers = {
    appearance: {
      homepageVisualIdentity: false,
      homepageBeamEeByKey: undefined,
      homepageIdentityPaletteIndexBySatelliteId: undefined,
      widthScale: 1,
      ellipseTiltExaggeration: 1,
    },
    cones: [],
    footprints: [],
    callouts: null,
    teaching: null,
  };
  assert.equal(SceneSinrLiveBeamLayers(emptySinrLayers), null);
  assert.equal(childElements(SceneSinrLiveBeamLayers({
    ...emptySinrLayers,
    cones: [{
      key: 'test',
      mounted: true,
      items: [],
      layer: 'serving',
      telemetryCountDatasetKey: 'test',
    }],
  })).length, 1);

  assert.equal(SceneAcceptedHandoverCue({
    mounted: false,
    transition: null,
    placementByCellId: new Map(),
    progress01: 0,
    sourceColor: '#fff',
    targetColor: '#000',
  }), null);
  const acceptedCue = SceneAcceptedHandoverCue({
    mounted: true,
    transition: null,
    placementByCellId: new Map(),
    progress01: 0,
    sourceColor: '#fff',
    targetColor: '#000',
  });
  assert.ok(isValidElement(acceptedCue));
  assert.equal(SceneIntraGroundShockwave({
    mounted: false,
    vizFrame: {} as never,
    runtime: {} as never,
    identityColorBySatelliteId: new Map(),
    identityColorBySatelliteBeamId: new Map(),
  }), null);
  assert.equal(SceneHandoverToastLayer({ mounted: false, toast: {} as never }), null);
});

test('motion and multi-candidate wrappers expose only their presentation children', () => {
  const motionProps: SceneHandoverMotionLayersProps = {
    reducedMotion: true,
    links: {
      mounted: false,
      satellites: [],
      eventRoles: new Map(),
      satBeams: new Map(),
      primaryUeAnchor: undefined,
    },
    orbitTrail: { mounted: false, satellites: [] },
    spineParticles: {
      mounted: false,
      satellites: [],
      satBeams: new Map(),
      plans: [],
    },
    groundRipple: {
      mounted: false,
      satBeams: new Map(),
      footprintRadius: 1,
      servingEnabled: false,
      pendingEnabled: false,
      identityColorBySatelliteId: new Map(),
      identityColorBySatelliteBeamId: new Map(),
      paused: true,
      reducedMotion: true,
      recentHoActive: false,
    },
  };
  const motionTree = SceneHandoverMotionLayers(motionProps);
  assert.equal(childElements(motionTree).length, 1);
  assert.equal(
    elementProps<{ readonly reducedMotion: boolean }>(childElements(motionTree)[0]).reducedMotion,
    true,
  );

  const multiCandidateProps: SceneMultiCandidateLayerProps = {
    context: {
      placementByCellId: new Map(),
      satelliteWorldById: new Map(),
      primaryUeWorld: null,
      reducedMotion: true,
      homepageVisualIdentity: false,
      satelliteNameById: new Map(),
      homepageBeamEeByKey: new Map(),
      homepageIdentityPaletteIndexBySatelliteId: new Map(),
    },
    central: {
      active: false,
      presentation: null,
      widthScale: 1,
      renderReceipt: null,
    },
    review: {
      active: false,
      presentation: null,
      widthScale: 1,
      renderReceipt: null,
    },
  };
  assert.equal(childElements(SceneMultiCandidateLayer(multiCandidateProps)).length, 0);
});
