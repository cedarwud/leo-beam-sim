export const SCENE_SURFACE_IDS = [
  'scene.layout',
  'scene.cinematic-spotlight',
  'ground.campus',
  'ground.teaching-floor',
  'ground.horizon-boundary',
  'ground.uav',
  'ground.ues',
  'motion.handover-links',
  'motion.orbit-trail',
  'motion.spine-particles',
  'motion.ground-ripple',
  'satellite.markers',
  'candidate.central',
  'candidate.review',
  'handover.accepted-cue',
  'beam.non-serving-cones',
  'beam.serving-cones',
  'beam.cinema-inter-serving-fan',
  'beam.candidate-cones',
  'handover.pulse-cones',
  'handover.triggered-intra-cones',
  'handover.cinema-pair-cones',
  'handover.authority-transition-cones',
  'beam.serving-footprints',
  'beam.candidate-footprints',
  'beam.callouts',
  'teaching.handover-cones',
  'annotation.narrative-caption',
  'handover.intra-shockwave',
  'handover.toast',
  'diagnostics.fps',
] as const;

export type SceneSurfaceId = typeof SCENE_SURFACE_IDS[number];
export type SceneSurfaceDomain =
  | 'layout'
  | 'ground'
  | 'motion'
  | 'satellite'
  | 'candidate'
  | 'beam'
  | 'handover'
  | 'teaching'
  | 'annotation'
  | 'diagnostics';

export type SceneSurfaceSourceClass =
  | 'static'
  | 'live-frame'
  | 'accepted-snapshot'
  | 'presentation'
  | 'teaching-fixture'
  | 'artifact-replay'
  | 'mixed';

export interface SceneSurfaceDefinition {
  readonly id: SceneSurfaceId;
  readonly domain: SceneSurfaceDomain;
  readonly rendererModule: string;
  readonly rendererSymbol: string;
  readonly sourceClass: SceneSurfaceSourceClass;
  readonly firstManagedPhase: 'R1' | 'R3';
}

function surface(
  definition: SceneSurfaceDefinition,
): SceneSurfaceDefinition {
  return Object.freeze(definition);
}
export const SCENE_SURFACE_REGISTRY = Object.freeze({
  'scene.layout': surface({ id: 'scene.layout', domain: 'layout', rendererModule: './BaseSceneLayout', rendererSymbol: 'BaseSceneLayout', sourceClass: 'mixed', firstManagedPhase: 'R3' }),
  'scene.cinematic-spotlight': surface({ id: 'scene.cinematic-spotlight', domain: 'layout', rendererModule: './BaseSceneLayout', rendererSymbol: 'BaseSceneLayout', sourceClass: 'presentation', firstManagedPhase: 'R3' }),
  'ground.campus': surface({ id: 'ground.campus', domain: 'ground', rendererModule: './BaseSceneLayout', rendererSymbol: 'BaseSceneLayout', sourceClass: 'static', firstManagedPhase: 'R3' }),
  'ground.teaching-floor': surface({ id: 'ground.teaching-floor', domain: 'ground', rendererModule: './TeachingFloor', rendererSymbol: 'TeachingFloor', sourceClass: 'static', firstManagedPhase: 'R3' }),
  'ground.horizon-boundary': surface({ id: 'ground.horizon-boundary', domain: 'ground', rendererModule: './SceneHorizonBoundary', rendererSymbol: 'SceneHorizonBoundary', sourceClass: 'live-frame', firstManagedPhase: 'R3' }),
  'ground.uav': surface({ id: 'ground.uav', domain: 'ground', rendererModule: '../components/scene/UAV', rendererSymbol: 'UAV', sourceClass: 'live-frame', firstManagedPhase: 'R3' }),
  'ground.ues': surface({ id: 'ground.ues', domain: 'ground', rendererModule: './SceneGroundUeLayer', rendererSymbol: 'SceneGroundUeLayer', sourceClass: 'mixed', firstManagedPhase: 'R3' }),
  'motion.handover-links': surface({ id: 'motion.handover-links', domain: 'motion', rendererModule: './SceneHandoverMotionLayers', rendererSymbol: 'SceneHandoverMotionLayers', sourceClass: 'presentation', firstManagedPhase: 'R3' }),
  'motion.orbit-trail': surface({ id: 'motion.orbit-trail', domain: 'motion', rendererModule: './SceneHandoverMotionLayers', rendererSymbol: 'SceneHandoverMotionLayers', sourceClass: 'live-frame', firstManagedPhase: 'R3' }),
  'motion.spine-particles': surface({ id: 'motion.spine-particles', domain: 'motion', rendererModule: './SceneHandoverMotionLayers', rendererSymbol: 'SceneHandoverMotionLayers', sourceClass: 'mixed', firstManagedPhase: 'R3' }),
  'motion.ground-ripple': surface({ id: 'motion.ground-ripple', domain: 'motion', rendererModule: './SceneHandoverMotionLayers', rendererSymbol: 'SceneHandoverMotionLayers', sourceClass: 'mixed', firstManagedPhase: 'R3' }),
  'satellite.markers': surface({ id: 'satellite.markers', domain: 'satellite', rendererModule: './SceneSatelliteMarkerLayer', rendererSymbol: 'SceneSatelliteMarkerLayer', sourceClass: 'mixed', firstManagedPhase: 'R3' }),
  'candidate.central': surface({ id: 'candidate.central', domain: 'candidate', rendererModule: './SceneMultiCandidateLayer', rendererSymbol: 'SceneMultiCandidateLayer', sourceClass: 'accepted-snapshot', firstManagedPhase: 'R3' }),
  'candidate.review': surface({ id: 'candidate.review', domain: 'candidate', rendererModule: './SceneMultiCandidateLayer', rendererSymbol: 'SceneMultiCandidateLayer', sourceClass: 'accepted-snapshot', firstManagedPhase: 'R3' }),
  'handover.accepted-cue': surface({ id: 'handover.accepted-cue', domain: 'handover', rendererModule: './SceneAcceptedHandoverCue', rendererSymbol: 'SceneAcceptedHandoverCue', sourceClass: 'accepted-snapshot', firstManagedPhase: 'R3' }),
  'beam.non-serving-cones': surface({ id: 'beam.non-serving-cones', domain: 'beam', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'live-frame', firstManagedPhase: 'R1' }),
  'beam.serving-cones': surface({ id: 'beam.serving-cones', domain: 'beam', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'live-frame', firstManagedPhase: 'R1' }),
  'beam.cinema-inter-serving-fan': surface({ id: 'beam.cinema-inter-serving-fan', domain: 'beam', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'presentation', firstManagedPhase: 'R1' }),
  'beam.candidate-cones': surface({ id: 'beam.candidate-cones', domain: 'beam', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'presentation', firstManagedPhase: 'R1' }),
  'handover.pulse-cones': surface({ id: 'handover.pulse-cones', domain: 'handover', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'presentation', firstManagedPhase: 'R1' }),
  'handover.triggered-intra-cones': surface({ id: 'handover.triggered-intra-cones', domain: 'handover', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'presentation', firstManagedPhase: 'R1' }),
  'handover.cinema-pair-cones': surface({ id: 'handover.cinema-pair-cones', domain: 'handover', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'presentation', firstManagedPhase: 'R1' }),
  'handover.authority-transition-cones': surface({ id: 'handover.authority-transition-cones', domain: 'handover', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'accepted-snapshot', firstManagedPhase: 'R1' }),
  'beam.serving-footprints': surface({ id: 'beam.serving-footprints', domain: 'beam', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'live-frame', firstManagedPhase: 'R1' }),
  'beam.candidate-footprints': surface({ id: 'beam.candidate-footprints', domain: 'beam', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'presentation', firstManagedPhase: 'R1' }),
  'beam.callouts': surface({ id: 'beam.callouts', domain: 'beam', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'mixed', firstManagedPhase: 'R1' }),
  'teaching.handover-cones': surface({ id: 'teaching.handover-cones', domain: 'teaching', rendererModule: './SceneSinrLiveBeamLayers', rendererSymbol: 'SceneSinrLiveBeamLayers', sourceClass: 'teaching-fixture', firstManagedPhase: 'R1' }),
  'annotation.narrative-caption': surface({ id: 'annotation.narrative-caption', domain: 'annotation', rendererModule: './SceneNarrativeCaption', rendererSymbol: 'SceneNarrativeCaption', sourceClass: 'accepted-snapshot', firstManagedPhase: 'R3' }),
  'handover.intra-shockwave': surface({ id: 'handover.intra-shockwave', domain: 'handover', rendererModule: './SceneIntraGroundShockwave', rendererSymbol: 'SceneIntraGroundShockwave', sourceClass: 'mixed', firstManagedPhase: 'R3' }),
  'handover.toast': surface({ id: 'handover.toast', domain: 'handover', rendererModule: './SceneHandoverToastLayer', rendererSymbol: 'SceneHandoverToastLayer', sourceClass: 'presentation', firstManagedPhase: 'R3' }),
  'diagnostics.fps': surface({ id: 'diagnostics.fps', domain: 'diagnostics', rendererModule: './FPSCounter', rendererSymbol: 'FPSCounter', sourceClass: 'static', firstManagedPhase: 'R3' }),
} satisfies Readonly<Record<SceneSurfaceId, SceneSurfaceDefinition>>);

export const CORE_BEAM_SURFACE_IDS = [
  'beam.non-serving-cones',
  'beam.serving-cones',
  'beam.cinema-inter-serving-fan',
  'beam.candidate-cones',
  'handover.pulse-cones',
  'handover.triggered-intra-cones',
  'handover.cinema-pair-cones',
  'handover.authority-transition-cones',
  'beam.serving-footprints',
  'beam.candidate-footprints',
  'beam.callouts',
  'teaching.handover-cones',
] as const satisfies readonly SceneSurfaceId[];

export type CoreBeamSurfaceId = typeof CORE_BEAM_SURFACE_IDS[number];

export function sceneSurfaceDefinition(
  id: SceneSurfaceId,
): SceneSurfaceDefinition {
  return SCENE_SURFACE_REGISTRY[id];
}
