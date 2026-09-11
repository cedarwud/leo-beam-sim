import {
  CORE_BEAM_SURFACE_IDS,
  sceneSurfaceDefinition,
  type CoreBeamSurfaceId,
  type SceneSurfaceSourceClass,
} from './sceneSurfaceRegistry';

export type SceneStoryOwner =
  | 'steady'
  | 'candidate-review'
  | 'handover'
  | 'teaching';

export type SceneSurfaceMountReason =
  | 'mounted'
  | 'stage-hidden'
  | 'beam-renderer-disabled'
  | 'candidate-story-owns-scene'
  | 'inventory-empty'
  | 'callouts-disabled'
  | 'teaching-story-suppresses-callouts'
  | 'teaching-story-suppresses-live-effects'
  | 'teaching-story-not-ready'
  | 'handover-isolation-hidden';

export type SceneSurfaceVisibilityReason =
  | 'visible'
  | 'not-mounted'
  | 'handover-field-hidden';

export interface SceneSurfaceDecision {
  readonly mounted: boolean;
  readonly visible: boolean;
  readonly owner: SceneStoryOwner;
  readonly source: SceneSurfaceSourceClass;
  readonly mountReason: SceneSurfaceMountReason;
  readonly visibilityReason: SceneSurfaceVisibilityReason;
}
export interface CoreSceneSurfacePlanInput {
  readonly stage: {
    readonly ambientBeams: boolean;
    readonly servingBeams: boolean;
    readonly candidateBeams: boolean;
    readonly eventEffects: boolean;
    readonly servingFootprints: boolean;
    readonly candidateFootprints: boolean;
  };
  readonly runtime: {
    readonly showSinrLiveCellBeams: boolean;
    readonly showBeamCallouts: boolean;
    readonly teachingLectureActive: boolean;
  };
  readonly story: {
    readonly homepageVisualIdentity: boolean;
    readonly multiCandidateSceneVisualActive: boolean;
    readonly multiCandidateCentralOverlayActive: boolean;
    readonly multiCandidateIdentityTransitionActive: boolean;
    readonly handoverPresentationActive: boolean;
    readonly candidateReviewActive: boolean;
  };
  readonly isolation: {
    readonly active: boolean;
    readonly hideNormalBeamField: boolean;
    readonly preserveConfiguredServingFan: boolean;
  };
  readonly inventory: {
    readonly nonServingConeCount: number;
    readonly cinemaInterServingFanConeCount: number;
    readonly candidateConeCount: number;
    readonly pulseConeCount: number;
    readonly triggeredIntraConeCount: number;
    readonly cinemaPairConeCount: number;
    readonly authorityTransitionConeCount: number;
    readonly beamInfoCount: number;
    readonly teachingReady: boolean;
  };
}

export interface CoreSceneSurfacePlan {
  readonly storyOwner: SceneStoryOwner;
  readonly surfaces: Readonly<Record<CoreBeamSurfaceId, SceneSurfaceDecision>>;
  readonly mountedSurfaceIds: readonly CoreBeamSurfaceId[];
  readonly visibleSurfaceIds: readonly CoreBeamSurfaceId[];
}

interface Gate {
  readonly passes: boolean;
  readonly reason: Exclude<SceneSurfaceMountReason, 'mounted'>;
}

function storyOwner(input: CoreSceneSurfacePlanInput): SceneStoryOwner {
  if (input.runtime.teachingLectureActive) return 'teaching';
  if (input.story.handoverPresentationActive
    || input.story.multiCandidateIdentityTransitionActive) return 'handover';
  if (input.story.candidateReviewActive
    || input.story.multiCandidateSceneVisualActive
    || input.story.multiCandidateCentralOverlayActive) return 'candidate-review';
  return 'steady';
}
function decision(
  id: CoreBeamSurfaceId,
  owner: SceneStoryOwner,
  gates: readonly Gate[],
  visibleWhenMounted = true,
): SceneSurfaceDecision {
  const failed = gates.find(gate => !gate.passes);
  const mounted = failed === undefined;
  const visible = mounted && visibleWhenMounted;
  return Object.freeze({
    mounted,
    visible,
    owner,
    source: sceneSurfaceDefinition(id).sourceClass,
    mountReason: failed?.reason ?? 'mounted',
    visibilityReason: !mounted
      ? 'not-mounted'
      : visible ? 'visible' : 'handover-field-hidden',
  });
}

function stageGate(
  visible: boolean,
): Gate {
  return { passes: visible, reason: 'stage-hidden' };
}

function rendererGate(
  enabled: boolean,
): Gate {
  return { passes: enabled, reason: 'beam-renderer-disabled' };
}

function candidateStoryGate(
  candidateStoryActive: boolean,
): Gate {
  return { passes: !candidateStoryActive, reason: 'candidate-story-owns-scene' };
}

function inventoryGate(
  count: number,
): Gate {
  return { passes: count > 0, reason: 'inventory-empty' };
}

function liveEventGate(teachingLectureActive: boolean): Gate {
  return {
    passes: !teachingLectureActive,
    reason: 'teaching-story-suppresses-live-effects',
  };
}
export function resolveCoreSceneSurfacePlan(
  input: CoreSceneSurfacePlanInput,
): CoreSceneSurfacePlan {
  const owner = storyOwner(input);
  const candidateStoryActive = input.story.multiCandidateSceneVisualActive;
  const surfaces: Record<CoreBeamSurfaceId, SceneSurfaceDecision> = {
    'beam.non-serving-cones': decision(
      'beam.non-serving-cones',
      owner,
      [
        stageGate(input.stage.ambientBeams),
        candidateStoryGate(candidateStoryActive),
        inventoryGate(input.inventory.nonServingConeCount),
      ],
    ),
    'beam.serving-cones': decision(
      'beam.serving-cones',
      owner,
      [
        stageGate(input.stage.servingBeams),
        rendererGate(input.runtime.showSinrLiveCellBeams),
        candidateStoryGate(
          candidateStoryActive && !input.story.homepageVisualIdentity,
        ),
      ],
    ),
    'beam.cinema-inter-serving-fan': decision(
      'beam.cinema-inter-serving-fan',
      owner,
      [
        stageGate(input.stage.servingBeams),
        rendererGate(input.runtime.showSinrLiveCellBeams),
        candidateStoryGate(candidateStoryActive),
        inventoryGate(input.inventory.cinemaInterServingFanConeCount),
      ],
    ),
    'beam.candidate-cones': decision(
      'beam.candidate-cones',
      owner,
      [
        stageGate(input.stage.candidateBeams),
        rendererGate(input.runtime.showSinrLiveCellBeams),
        candidateStoryGate(candidateStoryActive),
        inventoryGate(input.inventory.candidateConeCount),
      ],
    ),
    'handover.pulse-cones': decision(
      'handover.pulse-cones',
      owner,
      [
        stageGate(input.stage.eventEffects),
        liveEventGate(input.runtime.teachingLectureActive),
        inventoryGate(input.inventory.pulseConeCount),
      ],
    ),
    'handover.triggered-intra-cones': decision(
      'handover.triggered-intra-cones',
      owner,
      [
        stageGate(input.stage.eventEffects),
        liveEventGate(input.runtime.teachingLectureActive),
        inventoryGate(input.inventory.triggeredIntraConeCount),
      ],
    ),
    'handover.cinema-pair-cones': decision(
      'handover.cinema-pair-cones',
      owner,
      [
        stageGate(input.stage.eventEffects),
        liveEventGate(input.runtime.teachingLectureActive),
        inventoryGate(input.inventory.cinemaPairConeCount),
      ],
    ),
    'handover.authority-transition-cones': decision(
      'handover.authority-transition-cones',
      owner,
      [
        stageGate(input.stage.eventEffects),
        liveEventGate(input.runtime.teachingLectureActive),
        inventoryGate(input.inventory.authorityTransitionConeCount),
      ],
    ),
    'beam.serving-footprints': decision(
      'beam.serving-footprints',
      owner,
      [
        stageGate(input.stage.servingFootprints),
        rendererGate(input.runtime.showSinrLiveCellBeams),
        candidateStoryGate(
          candidateStoryActive && !input.story.homepageVisualIdentity,
        ),
        {
          passes: !input.isolation.active
            || input.story.multiCandidateCentralOverlayActive
            || input.isolation.preserveConfiguredServingFan,
          reason: 'handover-isolation-hidden',
        },
      ],
      !input.isolation.hideNormalBeamField
        || input.isolation.preserveConfiguredServingFan,
    ),
    'beam.candidate-footprints': decision(
      'beam.candidate-footprints',
      owner,
      [
        stageGate(input.stage.candidateFootprints),
        rendererGate(input.runtime.showSinrLiveCellBeams),
        candidateStoryGate(candidateStoryActive),
        inventoryGate(input.inventory.candidateConeCount),
      ],
    ),
    'beam.callouts': decision(
      'beam.callouts',
      owner,
      [
        {
          passes: input.runtime.showBeamCallouts,
          reason: 'callouts-disabled',
        },
        {
          passes: !input.runtime.teachingLectureActive,
          reason: 'teaching-story-suppresses-callouts',
        },
        inventoryGate(input.inventory.beamInfoCount),
      ],
    ),
    'teaching.handover-cones': decision(
      'teaching.handover-cones',
      owner,
      [
        {
          passes: input.inventory.teachingReady,
          reason: 'teaching-story-not-ready',
        },
        stageGate(input.stage.eventEffects),
      ],
    ),
  };

  const frozenSurfaces = Object.freeze(surfaces);
  const mountedSurfaceIds = Object.freeze(
    CORE_BEAM_SURFACE_IDS.filter(id => frozenSurfaces[id].mounted),
  );
  const visibleSurfaceIds = Object.freeze(
    CORE_BEAM_SURFACE_IDS.filter(id => frozenSurfaces[id].visible),
  );

  return Object.freeze({
    storyOwner: owner,
    surfaces: frozenSurfaces,
    mountedSurfaceIds,
    visibleSurfaceIds,
  });
}

export function formatSceneSurfaceReasons(
  plan: CoreSceneSurfacePlan,
): string {
  return CORE_BEAM_SURFACE_IDS.map(id => {
    const surfaceDecision = plan.surfaces[id];
    return `${id}=${surfaceDecision.mountReason}/${surfaceDecision.visibilityReason}`;
  }).join(';');
}
