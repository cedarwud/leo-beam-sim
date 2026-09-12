import type { ScenePresentationPlan } from '../presentation/scenePresentation';
import type {
  CoreSceneSurfacePlan,
  SceneStoryOwner,
  SceneSurfaceMountReason,
  SceneSurfaceVisibilityReason,
} from '../sceneSurfacePlan';
import type {
  SceneSurfaceId,
  SceneSurfaceSourceClass,
} from '../sceneSurfaceRegistry';
import type { HandoverStoryFrameSet } from '../handoverStoryFrame';

export const SCENE_RENDER_PLAN_SCHEMA_VERSION = 1 as const;

export type SceneRenderLane = 'live' | 'archived-tle' | 'artifact-replay';
export type SceneRenderStoryOwner = SceneStoryOwner | 'replay';
export type SceneRenderSurfaceOwner = SceneRenderStoryOwner | 'shell' | 'stage';

export type SceneRenderReasonCode =
  | SceneSurfaceMountReason
  | SceneSurfaceVisibilityReason
  | 'always-mounted'
  | 'active'
  | 'campus-selected'
  | 'teaching-floor-fallback'
  | 'feature-disabled'
  | 'after-first-paint-pending'
  | 'lane-incompatible'
  | 'retired-duplicate-grammar'
  | 'natural-layer-suppressed'
  | 'timeline-effects-hidden'
  | 'candidate-central-inactive'
  | 'candidate-central-active'
  | 'candidate-review-inactive'
  | 'accepted-cue-inactive'
  | 'event-cue-undrawable'
  | 'homepage-identity-suppresses-toast'
  | 'no-active-handover-event'
  | 'concurrent-intra-suppressed'
  | 'caption-disabled'
  | 'caption-empty';

export interface SceneRenderSurfaceDecision {
  readonly id: SceneSurfaceId;
  readonly mounted: boolean;
  readonly visible: boolean;
  readonly owner: SceneRenderSurfaceOwner;
  readonly source: SceneSurfaceSourceClass;
  readonly reasonCode: SceneRenderReasonCode;
  readonly renderIdentity: string;
  readonly storyId: string | null;
  readonly storyPairKey: string | null;
}

export interface SceneRenderPlanControls {
  readonly campusVisible: boolean;
  readonly showHorizonBoundary: boolean;
  readonly showUav: boolean;
  readonly afterFirstPaint: boolean;
  readonly showOrbitTrail: boolean;
  readonly showSpineParticles: boolean;
  readonly showGroundRipple: boolean;
  readonly showLiveSatelliteMarkers: boolean;
  readonly showSinrLiveCellBeams: boolean;
  readonly showLiveSceneEffects: boolean;
  readonly showSceneOverlays: boolean;
  readonly showHandoverToastOverlay: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly showFpsCounter: boolean;
  readonly cinematicSpotlightActive: boolean;
  readonly narrativeCaptionEnabled: boolean;
}

export interface SceneRenderPlanStoryState {
  readonly suppressNaturalHandoverLayers: boolean;
  readonly hideTimelineEffects: boolean;
  readonly concurrentIntraVisualSuppressed: boolean;
  readonly multiCandidateSceneLayerVisible: boolean;
  readonly candidateComparisonSceneActive: boolean;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly multiCandidateIdentityTransitionActive: boolean;
  readonly acceptedCueHasTransition: boolean;
  readonly handoverEventCueDrawable: boolean;
  readonly handoverPresentationActive: boolean;
  readonly handoverPresentationHasEvent: boolean;
  readonly manualHandoverPresentationActive: boolean;
  readonly manualHandoverHasEvent: boolean;
}

export interface SceneRenderPlanInventory {
  readonly visibleSatelliteCount: number;
  readonly visibleUeCount: number;
  readonly narrativeCaptionPresent: boolean;
}

export interface SceneRenderPlanInput {
  readonly lane: SceneRenderLane;
  readonly presentation: ScenePresentationPlan;
  readonly storyFrames: HandoverStoryFrameSet;
  /** Present on live/TLE lanes; artifact replay has no cell-truth beam plan. */
  readonly corePlan: CoreSceneSurfacePlan | null;
  readonly controls: SceneRenderPlanControls;
  readonly story: SceneRenderPlanStoryState;
  readonly inventory: SceneRenderPlanInventory;
}

export interface SceneRenderStoryDescriptor {
  readonly owner: SceneRenderStoryOwner;
  readonly activeSource: HandoverStoryFrameSet['activeSource'];
  readonly availableSources: HandoverStoryFrameSet['availableSources'];
  readonly storyId: string | null;
  readonly pairKey: string | null;
  readonly snapshotId: string | null;
  readonly episodeId: string | null;
  readonly sourceFrameId: string | null;
}

export interface SceneRenderPlan {
  readonly schemaVersion: typeof SCENE_RENDER_PLAN_SCHEMA_VERSION;
  readonly lane: SceneRenderLane;
  readonly stage: ScenePresentationPlan['stage'];
  readonly story: SceneRenderStoryDescriptor;
  readonly surfaces: Readonly<Record<SceneSurfaceId, SceneRenderSurfaceDecision>>;
  readonly mountedSurfaceIds: readonly SceneSurfaceId[];
  readonly visibleSurfaceIds: readonly SceneSurfaceId[];
}
