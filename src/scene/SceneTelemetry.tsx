import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { REPLAY_CANVAS_ATTRIBUTES } from './modqn-replay-visuals/constants';

function formatCameraVector(vector: THREE.Vector3): string {
  return [vector.x, vector.y, vector.z].map(value => value.toFixed(2)).join(',');
}

export interface SceneTelemetryProps {
  visibleSatelliteCount: string | number;
  firstSatellitePosition: string;
  servingSatelliteId: string;
  servingBeamId: string | number;
  beamCalloutsEnabled: string;
  simTimeSec: number;
  appMode: string;
  sceneLaneSourceCompatible: string;
  liveSimulationEnabled: string;
  ueMarkerShape: string;
  uavVisible: string;
  uePrimaryAnchorMode: string;
  firstUePosition: string;
  /**
   * Count of UE markers GroundScene actually renders (worldPos-bearing UEs).
   * Provenance audit 2026-06-04: gives the artifact-replay real-data scene gate a
   * durable observable that the real 100-UE distribution actually rendered, rather
   * than relying on a one-time manual screenshot.
   */
  renderedUeCount: string | number;
  /**
   * Count of UEs carrying live phase-3 beam-load contention (>0 normalized load).
   * Provenance audit 2026-06-04: lets a durable browser gate prove the contention
   * overlay actually fires on real live geometry (audit B4 / FIX-6 residual #2),
   * not only that the component source string mounts. 0 outside the live cell lane.
   */
  beamLoadContentionUeCount: string | number;
  visualSatelliteAltitude: string;
  beamSatelliteCount: string | number;
  sceneSource: string;
  beamConeCount: string | number;

  // Cell overlay dataset attributes
  cellOverlaySlotIndex: string;
  cellOverlayActiveCount: string;
  cellOverlayIdleCount: string;
  cellOverlayCellCount: string;
  cellServingCount: string;
  cellVisibleCount: string;
  cellHoReassignmentCount: string;
  cellHoInterCount: string;
  cellHoIntraCount: string;
  cellBeamConeCount: string;
  cellBeamConeScope: string;
  cellBeamConeSatelliteCount: string;
  modqnVisualLayerPreset: string;
  modqnServiceMapEnabled: string;
  modqnServedUeCount: string | number;
  modqnIdleUeCount: string | number;
  modqnHandoverCuesVisible: string;

  // Handover story dataset attributes
  handoverStoryLayer: string;
  handoverStoryVisible: string;
  handoverStorySource: string;
  handoverStoryNotBaselineProof: string;
  handoverStoryEventCount: string | number;
  handoverStoryAggregateEventCount: string | number;
  handoverStoryActiveCount: string | number;
  handoverStoryInactiveCount: string | number;
  handoverStoryNextCount: string | number;

  // Ref attributes for camera tracking without triggering re-renders
  cameraPresetRef?: React.RefObject<string | null>;
  cameraTransitionRef?: React.RefObject<'idle' | 'animating'>;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;

  // Artifact replay boundary control
  shouldClearReplayAttributes?: boolean;
}

export function SceneTelemetry(props: SceneTelemetryProps) {
  const gl = useThree(state => state.gl);
  const camera = useThree(state => state.camera);

  // Sync static and highly reactive props inside unified useEffect
  useEffect(() => {
    const el = gl.domElement;
    el.dataset.visibleSatelliteCount = String(props.visibleSatelliteCount);
    el.dataset.firstSatellitePosition = props.firstSatellitePosition;
    el.dataset.servingSatelliteId = props.servingSatelliteId;
    el.dataset.servingBeamId = String(props.servingBeamId);
    el.dataset.beamCalloutsEnabled = props.beamCalloutsEnabled;
    el.dataset.simTimeSec = props.simTimeSec.toFixed(2);
    el.dataset.appMode = props.appMode;
    el.dataset.sceneLaneSourceCompatible = props.sceneLaneSourceCompatible;
    el.dataset.liveSimulationEnabled = props.liveSimulationEnabled;
    el.dataset.ueMarkerShape = props.ueMarkerShape;
    el.dataset.uavVisible = props.uavVisible;
    el.dataset.uePrimaryAnchorMode = props.uePrimaryAnchorMode;
    el.dataset.firstUePosition = props.firstUePosition;
    el.dataset.renderedUeCount = String(props.renderedUeCount);
    el.dataset.beamLoadContentionUeCount = String(props.beamLoadContentionUeCount);
    el.dataset.visualSatelliteAltitude = props.visualSatelliteAltitude;
    el.dataset.beamSatelliteCount = String(props.beamSatelliteCount);
    el.dataset.sceneSource = props.sceneSource;
    el.dataset.beamConeCount = String(props.beamConeCount);

    el.dataset.cellOverlaySlotIndex = props.cellOverlaySlotIndex;
    el.dataset.cellOverlayActiveCount = props.cellOverlayActiveCount;
    el.dataset.cellOverlayIdleCount = props.cellOverlayIdleCount;
    el.dataset.cellOverlayCellCount = props.cellOverlayCellCount;
    el.dataset.cellServingCount = props.cellServingCount;
    el.dataset.cellVisibleCount = props.cellVisibleCount;
    el.dataset.cellHoReassignmentCount = props.cellHoReassignmentCount;
    el.dataset.cellHoInterCount = props.cellHoInterCount;
    el.dataset.cellHoIntraCount = props.cellHoIntraCount;
    el.dataset.cellBeamConeCount = props.cellBeamConeCount;
    el.dataset.cellBeamConeScope = props.cellBeamConeScope;
    el.dataset.cellBeamConeSatelliteCount = props.cellBeamConeSatelliteCount;
    el.dataset.modqnVisualLayerPreset = props.modqnVisualLayerPreset;
    el.dataset.modqnServiceMapEnabled = props.modqnServiceMapEnabled;
    el.dataset.modqnServedUeCount = String(props.modqnServedUeCount);
    el.dataset.modqnIdleUeCount = String(props.modqnIdleUeCount);
    el.dataset.modqnHandoverCuesVisible = props.modqnHandoverCuesVisible;

    el.dataset.handoverStoryLayer = props.handoverStoryLayer;
    el.dataset.handoverStoryVisible = props.handoverStoryVisible;
    el.dataset.handoverStorySource = props.handoverStorySource;
    el.dataset.handoverStoryNotBaselineProof = props.handoverStoryNotBaselineProof;
    el.dataset.handoverStoryEventCount = String(props.handoverStoryEventCount);
    el.dataset.handoverStoryAggregateEventCount = String(props.handoverStoryAggregateEventCount);
    el.dataset.handoverStoryActiveCount = String(props.handoverStoryActiveCount);
    el.dataset.handoverStoryInactiveCount = String(props.handoverStoryInactiveCount);
    el.dataset.handoverStoryNextCount = String(props.handoverStoryNextCount);

    if (props.shouldClearReplayAttributes) {
      REPLAY_CANVAS_ATTRIBUTES.forEach(attribute => {
        el.removeAttribute(attribute);
      });
    }
  }, [
    gl.domElement,
    props.visibleSatelliteCount,
    props.firstSatellitePosition,
    props.servingSatelliteId,
    props.servingBeamId,
    props.beamCalloutsEnabled,
    props.simTimeSec,
    props.appMode,
    props.sceneLaneSourceCompatible,
    props.liveSimulationEnabled,
    props.ueMarkerShape,
    props.uavVisible,
    props.uePrimaryAnchorMode,
    props.firstUePosition,
    props.renderedUeCount,
    props.beamLoadContentionUeCount,
    props.visualSatelliteAltitude,
    props.beamSatelliteCount,
    props.sceneSource,
    props.beamConeCount,
    props.cellOverlaySlotIndex,
    props.cellOverlayActiveCount,
    props.cellOverlayIdleCount,
    props.cellOverlayCellCount,
    props.cellServingCount,
    props.cellVisibleCount,
    props.cellHoReassignmentCount,
    props.cellHoInterCount,
    props.cellHoIntraCount,
    props.cellBeamConeCount,
    props.cellBeamConeScope,
    props.cellBeamConeSatelliteCount,
    props.modqnVisualLayerPreset,
    props.modqnServiceMapEnabled,
    props.modqnServedUeCount,
    props.modqnIdleUeCount,
    props.modqnHandoverCuesVisible,
    props.handoverStoryLayer,
    props.handoverStoryVisible,
    props.handoverStorySource,
    props.handoverStoryNotBaselineProof,
    props.handoverStoryEventCount,
    props.handoverStoryAggregateEventCount,
    props.handoverStoryActiveCount,
    props.handoverStoryInactiveCount,
    props.handoverStoryNextCount,
    props.shouldClearReplayAttributes,
  ]);

  // Handle dynamic real-time frame telemetry (camera updates on every R3F tick)
  useFrame(() => {
    const el = gl.domElement;
    el.dataset.cameraPreset = props.cameraPresetRef?.current ?? 'manual';
    el.dataset.cameraTransition = props.cameraTransitionRef?.current ?? 'idle';
    el.dataset.cameraPosition = formatCameraVector(camera.position);
    el.dataset.cameraTarget = formatCameraVector(props.controlsRef.current?.target ?? new THREE.Vector3());
  });

  return null;
}
