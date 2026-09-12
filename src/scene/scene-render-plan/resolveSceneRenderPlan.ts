import {
  CORE_BEAM_SURFACE_IDS,
  SCENE_SURFACE_IDS,
  type CoreBeamSurfaceId,
  type SceneSurfaceId,
} from '../sceneSurfaceRegistry';
import type { SceneSurfaceDecision } from '../sceneSurfacePlan';
import {
  SCENE_RENDER_PLAN_SCHEMA_VERSION,
  type SceneRenderPlan,
  type SceneRenderPlanInput,
  type SceneRenderReasonCode,
  type SceneRenderSurfaceDecision,
  type SceneRenderStoryOwner,
} from './contracts';
import {
  createSurfaceDecision,
  featureGate,
  inventoryGate,
  liveLaneGate,
  resolveRenderStoryDescriptor,
  resolveRenderStoryOwner,
  stageGate,
} from './decision';

function coreReason(decision: SceneSurfaceDecision): SceneRenderReasonCode {
  if (!decision.mounted) return decision.mountReason;
  if (!decision.visible) return decision.visibilityReason;
  return 'visible';
}

function fromCore(input: {
  readonly id: CoreBeamSurfaceId;
  readonly plan: SceneRenderPlanInput;
  readonly storyOwner: SceneRenderStoryOwner;
  readonly storyId: string | null;
  readonly pairKey: string | null;
  readonly decision: SceneSurfaceDecision;
}): SceneRenderSurfaceDecision {
  const reason = coreReason(input.decision);
  return createSurfaceDecision({
    id: input.id,
    lane: input.plan.lane,
    storyOwner: input.storyOwner,
    storyId: input.storyId,
    storyPairKey: input.pairKey,
    mounted: input.decision.mounted,
    visible: input.decision.visible,
    mountedReason: reason,
    hiddenReason: reason,
  });
}

function emptySurfaceRecord(
  input: SceneRenderPlanInput,
  storyOwner: SceneRenderStoryOwner,
  storyId: string | null,
  pairKey: string | null,
): Record<SceneSurfaceId, SceneRenderSurfaceDecision> {
  return Object.fromEntries(SCENE_SURFACE_IDS.map(id => [id, createSurfaceDecision({
    id,
    lane: input.lane,
    storyOwner,
    storyId,
    storyPairKey: pairKey,
    mounted: false,
    hiddenReason: 'lane-incompatible',
  })])) as Record<SceneSurfaceId, SceneRenderSurfaceDecision>;
}

export function resolveSceneRenderPlan(
  input: SceneRenderPlanInput,
): SceneRenderPlan {
  const storyOwner = resolveRenderStoryOwner(input);
  const story = resolveRenderStoryDescriptor(input, storyOwner);
  const storyId = story.storyId;
  const pairKey = story.pairKey;
  const surfaces = emptySurfaceRecord(input, storyOwner, storyId, pairKey);
  const stage = input.presentation.visible;
  const controls = input.controls;
  const state = input.story;
  const inventory = input.inventory;

  type DecisionOptions = Omit<Parameters<typeof createSurfaceDecision>[0],
    'id' | 'lane' | 'storyOwner' | 'storyId' | 'storyPairKey'>;
  const decide = (
    id: SceneSurfaceId,
    options: DecisionOptions = {},
  ): SceneRenderSurfaceDecision => createSurfaceDecision({
    id,
    lane: input.lane,
    storyOwner,
    storyId,
    storyPairKey: pairKey,
    ...options,
  });

  surfaces['scene.layout'] = decide('scene.layout', {
    mountedReason: 'always-mounted',
  });
  surfaces['scene.cinematic-spotlight'] = decide('scene.cinematic-spotlight', {
    gates: [
      liveLaneGate(input.lane),
      stageGate(stage['event-effects']),
      featureGate(controls.cinematicSpotlightActive),
    ],
  });

  const campusSelected = controls.campusVisible && stage.campus;
  surfaces['ground.campus'] = decide('ground.campus', {
    mounted: campusSelected,
    visible: campusSelected,
    mountedReason: 'campus-selected',
    hiddenReason: controls.campusVisible ? 'stage-hidden' : 'feature-disabled',
  });
  surfaces['ground.teaching-floor'] = decide('ground.teaching-floor', {
    mounted: !campusSelected,
    visible: !campusSelected,
    mountedReason: 'teaching-floor-fallback',
    hiddenReason: 'campus-selected',
  });

  const liveLane = input.lane !== 'artifact-replay';
  surfaces['ground.horizon-boundary'] = decide('ground.horizon-boundary', {
    mounted: liveLane,
    visible: liveLane && controls.showHorizonBoundary && stage['context-satellites'] && inventory.visibleSatelliteCount > 0,
    mountedReason: 'active',
    hiddenReason: !liveLane
      ? 'lane-incompatible'
      : !controls.showHorizonBoundary ? 'feature-disabled'
      : !stage['context-satellites'] ? 'stage-hidden' : 'inventory-empty',
  });
  surfaces['ground.uav'] = decide('ground.uav', {
    gates: [
      liveLaneGate(input.lane),
      stageGate(stage.uav),
      featureGate(controls.showUav),
      { passes: controls.afterFirstPaint, reason: 'after-first-paint-pending' },
    ],
  });

  const ueMounted = input.lane === 'artifact-replay' ? stage.ues : true;
  const ueVisible = ueMounted && stage.ues && inventory.visibleUeCount > 0;
  surfaces['ground.ues'] = decide('ground.ues', {
    mounted: ueMounted,
    visible: ueVisible,
    mountedReason: 'active',
    hiddenReason: !stage.ues ? 'stage-hidden' : 'inventory-empty',
  });

  surfaces['motion.handover-links'] = decide('motion.handover-links', {
    mounted: false,
    hiddenReason: 'retired-duplicate-grammar',
  });
  surfaces['motion.orbit-trail'] = decide('motion.orbit-trail', {
    gates: [
      liveLaneGate(input.lane),
      stageGate(stage['motion-guides']),
      featureGate(controls.showOrbitTrail),
    ],
  });
  surfaces['motion.spine-particles'] = decide('motion.spine-particles', {
    gates: [
      liveLaneGate(input.lane),
      stageGate(stage['motion-guides']),
      featureGate(controls.showSpineParticles),
      {
        passes: !state.suppressNaturalHandoverLayers,
        reason: 'natural-layer-suppressed',
      },
    ],
  });
  surfaces['motion.ground-ripple'] = decide('motion.ground-ripple', {
    gates: [
      liveLaneGate(input.lane),
      stageGate(stage['event-effects']),
      featureGate(controls.showGroundRipple),
      {
        passes: !state.suppressNaturalHandoverLayers,
        reason: 'natural-layer-suppressed',
      },
    ],
  });

  const satelliteStageVisible = stage['selected-satellite']
    || stage['candidate-satellite']
    || stage['context-satellites'];
  const satelliteMounted = input.lane === 'artifact-replay'
    ? satelliteStageVisible
    : controls.showLiveSatelliteMarkers;
  const satelliteVisible = satelliteMounted
    && satelliteStageVisible
    && inventory.visibleSatelliteCount > 0;
  surfaces['satellite.markers'] = decide('satellite.markers', {
    mounted: satelliteMounted,
    visible: satelliteVisible,
    mountedReason: 'active',
    hiddenReason: !satelliteMounted
      ? input.lane === 'artifact-replay' ? 'stage-hidden' : 'feature-disabled'
      : !satelliteStageVisible ? 'stage-hidden' : 'inventory-empty',
  });

  surfaces['candidate.central'] = decide('candidate.central', {
    gates: [
      liveLaneGate(input.lane),
      {
        passes: state.multiCandidateSceneLayerVisible,
        reason: 'candidate-central-inactive',
      },
    ],
  });
  surfaces['candidate.review'] = decide('candidate.review', {
    gates: [
      liveLaneGate(input.lane),
      {
        passes: state.candidateComparisonSceneActive,
        reason: 'candidate-review-inactive',
      },
      featureGate(controls.showSinrLiveCellBeams),
      {
        passes: !state.multiCandidateSceneLayerVisible,
        reason: 'candidate-central-active',
      },
    ],
  });

  const authorityVisualActive = state.multiCandidateCentralOverlayActive
    || state.multiCandidateIdentityTransitionActive;
  surfaces['handover.accepted-cue'] = decide('handover.accepted-cue', {
    gates: [
      liveLaneGate(input.lane),
      {
        passes: authorityVisualActive,
        reason: 'accepted-cue-inactive',
      },
      stageGate(stage['event-effects']),
      {
        passes: state.acceptedCueHasTransition,
        reason: 'accepted-cue-inactive',
      },
      {
        passes: state.handoverEventCueDrawable,
        reason: 'event-cue-undrawable',
      },
    ],
  });

  if (input.corePlan !== null) {
    for (const id of CORE_BEAM_SURFACE_IDS) {
      surfaces[id] = fromCore({
        id,
        plan: input,
        storyOwner,
        storyId,
        pairKey,
        decision: input.corePlan.surfaces[id],
      });
    }
  }

  surfaces['annotation.narrative-caption'] = decide('annotation.narrative-caption', {
    mounted: liveLane,
    visible: liveLane
      && controls.narrativeCaptionEnabled
      && inventory.narrativeCaptionPresent,
    mountedReason: 'active',
    hiddenReason: !liveLane
      ? 'lane-incompatible'
      : !controls.narrativeCaptionEnabled ? 'caption-disabled' : 'caption-empty',
  });

  surfaces['handover.intra-shockwave'] = decide('handover.intra-shockwave', {
    gates: [
      liveLaneGate(input.lane),
      stageGate(stage['event-effects']),
      featureGate(controls.showLiveSceneEffects),
      {
        passes: !state.hideTimelineEffects,
        reason: 'timeline-effects-hidden',
      },
      {
        passes: !state.suppressNaturalHandoverLayers,
        reason: 'natural-layer-suppressed',
      },
      {
        passes: !state.concurrentIntraVisualSuppressed,
        reason: 'concurrent-intra-suppressed',
      },
    ],
  });

  const hasToastEvent = (
    state.manualHandoverPresentationActive && state.manualHandoverHasEvent
  ) || (
    state.handoverPresentationActive && state.handoverPresentationHasEvent
  ) || (
    !state.hideTimelineEffects && !state.suppressNaturalHandoverLayers
  );
  surfaces['handover.toast'] = decide('handover.toast', {
    gates: [
      liveLaneGate(input.lane),
      featureGate(controls.showSceneOverlays),
      stageGate(stage['event-effects']),
      featureGate(controls.showHandoverToastOverlay),
      {
        passes: !controls.homepageVisualIdentity,
        reason: 'homepage-identity-suppresses-toast',
      },
      {
        passes: hasToastEvent,
        reason: 'no-active-handover-event',
      },
    ],
  });

  surfaces['diagnostics.fps'] = decide('diagnostics.fps', {
    gates: [
      stageGate(stage.diagnostics),
      featureGate(controls.showFpsCounter),
    ],
  });

  const frozenSurfaces = Object.freeze(surfaces);
  const mountedSurfaceIds = Object.freeze(
    SCENE_SURFACE_IDS.filter(id => frozenSurfaces[id].mounted),
  );
  const visibleSurfaceIds = Object.freeze(
    SCENE_SURFACE_IDS.filter(id => frozenSurfaces[id].visible),
  );

  return Object.freeze({
    schemaVersion: SCENE_RENDER_PLAN_SCHEMA_VERSION,
    lane: input.lane,
    stage: input.presentation.stage,
    story,
    surfaces: frozenSurfaces,
    mountedSurfaceIds,
    visibleSurfaceIds,
  });
}
