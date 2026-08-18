import type { TleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { selectPinnedRepresentativeLink, selectRepresentativeLinkV2 } from './representativeLink';
import type {
  CoordinateFrameDisclosure,
  ExplanatoryEvidence,
  SceneCompositionDisclosure,
  ScientificLinkIdentity,
} from './types';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

const COORDINATE_FRAMES: CoordinateFrameDisclosure = deepFreeze({
  orbitalFrame: 'TEME-to-Earth-fixed-to-NTPU-topocentric-ENU',
  orbitalFields: ['azimuthDeg', 'elevationDeg', 'rangeKm'],
  localFrame: 'uncalibrated-seven-cell-link-plane',
  localFields: ['distanceKm', 'elevationDeg'],
  derivedLinkGeometryFields: ['thetaRad'],
  azimuthTreatment: 'omitted-and-rendered-on-fixed-local-axis',
  matchCut: {
    preserves: ['instantUtc', 'satelliteId', 'frameId'],
    visualTransform: 'recenter-and-reorient',
    geographicMetricContinuity: false,
  },
});

export function buildExplanatoryEvidence(
  run: TleAnalysisRun,
  anchorIndex: number,
  pinnedIdentity?: ScientificLinkIdentity,
): ExplanatoryEvidence {
  const frame = run.getFrame(anchorIndex);
  if (frame === null) throw new Error(`accepted frame ${anchorIndex} is unavailable`);
  const selection = pinnedIdentity === undefined
    ? selectRepresentativeLinkV2(frame)
    : selectPinnedRepresentativeLink(frame, pinnedIdentity);
  if (selection.status === 'unavailable') throw new Error(selection.reason);
  const contextSatelliteIds = frame.tleState.propagationFrame.satellites
    .map(satellite => satellite.satelliteId)
    .filter(id => id !== frame.selectedSatelliteId && id !== frame.tleState.candidateSatellite?.satelliteId)
    .sort()
    .slice(0, 6);
  const activeServiceBeamIds = frame.inputs.frame.beamActiveB.flatMap((active, beamId) => active ? [beamId] : []);
  if (activeServiceBeamIds.length !== 7) throw new Error('explanatory scene requires exactly seven active service beams');
  const sceneComposition: SceneCompositionDisclosure = deepFreeze({
    serviceSatelliteId: frame.selectedSatelliteId,
    activeServiceBeamIds,
    activeSatelliteOwnerIds: [frame.selectedSatelliteId],
    activeSatelliteOwnerCount: 1,
    activeBeamCount: 7,
    multiSatelliteActiveBeamClaim: 'not-claimed',
    candidateBeamMode: frame.candidateComparison.status === 'available'
      ? 'counterfactual-display-only'
      : 'none',
    candidateComparison: frame.candidateComparison,
    contextSatelliteIds,
    contextSelectionRuleId: 'same-frame-first-six-by-id-context-only-v1',
    beamOwnershipSource: 'frame.scenario.beamSatelliteB',
    contextBeamCount: 0,
    footprintClaim: 'uncalibrated-scenario-substrate',
  });
  return deepFreeze({
    run,
    anchorIndex,
    frame,
    nextFrame: anchorIndex + 1 < run.anchorCount ? run.getFrame(anchorIndex + 1) : null,
    representativeLink: selection,
    handoverAnchor: frame.handover ?? null,
    coordinateFrames: COORDINATE_FRAMES,
    sceneComposition,
  });
}
