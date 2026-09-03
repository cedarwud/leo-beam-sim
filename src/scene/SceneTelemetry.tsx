import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { REPLAY_CANVAS_ATTRIBUTES } from './replayCanvasAttributes';

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
  /** Diagnostic projection for the optional secondary-handover display. */
  otherHandoverFilterEnabled: string;
  otherHandoverPendingUeCount: string | number;
  otherHandoverSelectedUeCount: string | number;
  otherHandoverCueUeCount: string | number;
  otherHandoverSelectedUeIds: string;
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

  // SINR-live earth-fixed cell-truth beam cones (S-cells-3). Empty off the
  // sinr-live lane. Lets the durable browser gate prove the lane renders cones at
  // FIXED cell centres (not glued to the UE) on real live geometry.
  sinrLiveCellBeamConeCount: string;
  sinrLiveCellServingSatCount: string;
  sinrLiveCellServedCount: string;
  /** Max off-axis angle (deg) among served UEs — > 0 proves UEs sit off-centre. */
  sinrLiveCellUeOffAxisMaxDeg: string;
  /** G2c ambient live-pulse cones currently lit (real per-frame handovers, age-faded); empty off the sinr-live lane. */
  sinrLiveHandoverPulseConeCount: string;
  multiCandidateAuthorityActive: string;
  multiCandidateDecisionPhase: string;
  multiCandidateRenderedPairCount: string | number;
  multiCandidateSceneGlobalSolidDataLinkCount: string | number;
  multiCandidateCarrierFallbackActive: string;
  multiCandidateEventCueCount: string | number;
  /** Why the additive candidate layer is active or parked for this frame. */
  multiCandidateSceneRenderStatus: MultiCandidateSceneRenderStatus;
  /** Live producer identity beside the accepted snapshot for homepage join QA. */
  liveDecisionEpisodeId?: string;
  liveDecisionSourceFrameId?: string;
  liveDecisionSimTimeMs?: string | number;
  liveDecisionServingKey?: string;
  liveDecisionCommitTo?: string;
  /** Accepted snapshot identity beside the live producer identity for join QA. */
  acceptedSnapshotEpochToken?: string;
  acceptedSnapshotServingKey?: string;
  /** One display-owner contract for diagnosing beam-layer precedence. */
  handoverPresentationActive: string;
  handoverPresentationSource: string;
  handoverPresentationKind: string;
  handoverPresentationPhase: string;
  handoverAutoSlowActive: string;
  handoverDisplayIsolationActive: string;
  beamBudgetGlobal: string;
  beamBudgetServing: string;
  beamBudgetCandidate: string;
  beamHoppingEnabled: string;
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

export type MultiCandidateSceneRenderStatus =
  | 'active'
  | 'inactive'
  | 'no-accepted-snapshot'
  | 'source-frame-mismatch'
  | 'below-comparison-threshold'
  | 'switching'
  | 'phase-not-comparison'
  | 'missing-scene-plan'
  | 'unmapped-pairs';

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
    el.dataset.otherHandoverFilterEnabled = props.otherHandoverFilterEnabled;
    el.dataset.otherHandoverPendingUeCount = String(props.otherHandoverPendingUeCount);
    el.dataset.otherHandoverSelectedUeCount = String(props.otherHandoverSelectedUeCount);
    el.dataset.otherHandoverCueUeCount = String(props.otherHandoverCueUeCount);
    el.dataset.otherHandoverSelectedUeIds = props.otherHandoverSelectedUeIds;
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
    el.dataset.sinrLiveCellBeamConeCount = props.sinrLiveCellBeamConeCount;
    el.dataset.sinrLiveCellServingSatCount = props.sinrLiveCellServingSatCount;
    el.dataset.sinrLiveCellServedCount = props.sinrLiveCellServedCount;
    el.dataset.sinrLiveCellUeOffAxisMaxDeg = props.sinrLiveCellUeOffAxisMaxDeg;
    el.dataset.sinrLiveHandoverPulseConeCount = props.sinrLiveHandoverPulseConeCount;
    el.dataset.multiCandidateAuthorityActive = props.multiCandidateAuthorityActive;
    el.dataset.multiCandidateDecisionPhase = props.multiCandidateDecisionPhase;
    el.dataset.multiCandidateRenderedPairCount = String(props.multiCandidateRenderedPairCount);
    el.dataset.multiCandidateSceneGlobalSolidDataLinkCount = String(props.multiCandidateSceneGlobalSolidDataLinkCount);
    el.dataset.multiCandidateCarrierFallbackActive = props.multiCandidateCarrierFallbackActive;
    el.dataset.multiCandidateEventCueCount = String(props.multiCandidateEventCueCount);
    el.dataset.multiCandidateSceneRenderStatus = props.multiCandidateSceneRenderStatus;
    el.dataset.liveDecisionEpisodeId = props.liveDecisionEpisodeId ?? '';
    el.dataset.liveDecisionSourceFrameId = props.liveDecisionSourceFrameId ?? '';
    el.dataset.liveDecisionSimTimeMs = String(props.liveDecisionSimTimeMs ?? '');
    el.dataset.liveDecisionServingKey = props.liveDecisionServingKey ?? '';
    el.dataset.liveDecisionCommitTo = props.liveDecisionCommitTo ?? '';
    el.dataset.acceptedSnapshotEpochToken = props.acceptedSnapshotEpochToken ?? '';
    el.dataset.acceptedSnapshotServingKey = props.acceptedSnapshotServingKey ?? '';
    el.dataset.handoverPresentationActive = props.handoverPresentationActive;
    el.dataset.handoverPresentationSource = props.handoverPresentationSource;
    el.dataset.handoverPresentationKind = props.handoverPresentationKind;
    el.dataset.handoverPresentationPhase = props.handoverPresentationPhase;
    el.dataset.handoverAutoSlowActive = props.handoverAutoSlowActive;
    el.dataset.handoverDisplayIsolationActive = props.handoverDisplayIsolationActive;
    el.dataset.beamBudgetGlobal = props.beamBudgetGlobal;
    el.dataset.beamBudgetServing = props.beamBudgetServing;
    el.dataset.beamBudgetCandidate = props.beamBudgetCandidate;
    el.dataset.beamHoppingEnabled = props.beamHoppingEnabled;
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
    props.otherHandoverFilterEnabled,
    props.otherHandoverPendingUeCount,
    props.otherHandoverSelectedUeCount,
    props.otherHandoverCueUeCount,
    props.otherHandoverSelectedUeIds,
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
    props.sinrLiveCellBeamConeCount,
    props.sinrLiveCellServingSatCount,
    props.sinrLiveCellServedCount,
    props.sinrLiveHandoverPulseConeCount,
    props.sinrLiveCellUeOffAxisMaxDeg,
    props.multiCandidateAuthorityActive,
    props.multiCandidateDecisionPhase,
    props.multiCandidateRenderedPairCount,
    props.multiCandidateSceneGlobalSolidDataLinkCount,
    props.multiCandidateCarrierFallbackActive,
    props.multiCandidateEventCueCount,
    props.multiCandidateSceneRenderStatus,
    props.liveDecisionEpisodeId,
    props.liveDecisionSourceFrameId,
    props.liveDecisionSimTimeMs,
    props.liveDecisionServingKey,
    props.liveDecisionCommitTo,
    props.handoverPresentationActive,
    props.handoverPresentationSource,
    props.handoverPresentationKind,
    props.handoverPresentationPhase,
    props.handoverAutoSlowActive,
    props.handoverDisplayIsolationActive,
    props.beamBudgetGlobal,
    props.beamBudgetServing,
    props.beamBudgetCandidate,
    props.beamHoppingEnabled,
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
