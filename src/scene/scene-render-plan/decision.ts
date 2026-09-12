import { handoverStoryPairKey } from '../handoverStoryFrame';
import {
  sceneSurfaceDefinition,
  type SceneSurfaceId,
  type SceneSurfaceSourceClass,
} from '../sceneSurfaceRegistry';
import type {
  SceneRenderLane,
  SceneRenderPlanInput,
  SceneRenderReasonCode,
  SceneRenderStoryOwner,
  SceneRenderSurfaceDecision,
  SceneRenderSurfaceOwner,
  SceneRenderStoryDescriptor,
} from './contracts';

export interface SceneRenderGate {
  readonly passes: boolean;
  readonly reason: SceneRenderReasonCode;
}

const ARTIFACT_RENDERER_IDENTITY: Partial<Record<SceneSurfaceId, string>> = {
  'ground.ues': '../viz/GroundScene#GroundScene',
  'satellite.markers': '../viz/SatelliteMarker#SatelliteMarker',
};

function surfaceUsesStory(id: SceneSurfaceId): boolean {
  const domain = sceneSurfaceDefinition(id).domain;
  return domain === 'motion'
    || domain === 'candidate'
    || domain === 'beam'
    || domain === 'handover'
    || domain === 'teaching'
    || domain === 'annotation';
}

export function resolveRenderStoryOwner(
  input: SceneRenderPlanInput,
): SceneRenderStoryOwner {
  if (input.lane === 'artifact-replay') return 'replay';
  if (input.corePlan !== null) return input.corePlan.storyOwner;
  const active = input.storyFrames.active;
  if (active?.provenance.claimClass === 'authored-teaching') return 'teaching';
  if (active !== null) return 'handover';
  return 'steady';
}

export function resolveRenderStoryDescriptor(
  input: SceneRenderPlanInput,
  owner: SceneRenderStoryOwner,
): SceneRenderStoryDescriptor {
  const active = input.storyFrames.active;
  return Object.freeze({
    owner,
    activeSource: input.storyFrames.activeSource,
    availableSources: input.storyFrames.availableSources,
    storyId: active?.storyId ?? null,
    pairKey: active === null ? null : handoverStoryPairKey(active),
    snapshotId: active?.provenance.snapshotId ?? null,
    episodeId: active?.provenance.episodeId ?? null,
    sourceFrameId: active?.provenance.sourceFrameId ?? null,
  });
}

function renderImplementation(id: SceneSurfaceId, lane: SceneRenderLane): string {
  if (lane === 'artifact-replay') {
    const override = ARTIFACT_RENDERER_IDENTITY[id];
    if (override !== undefined) return override;
  }
  const definition = sceneSurfaceDefinition(id);
  return `${definition.rendererModule}#${definition.rendererSymbol}`;
}

function renderIdentity(
  id: SceneSurfaceId,
  lane: SceneRenderLane,
  storyId: string | null,
): string {
  const storyToken = surfaceUsesStory(id) ? storyId ?? 'no-story' : 'stage';
  return `${lane}:${id}:${renderImplementation(id, lane)}:${storyToken}`;
}

export function surfaceOwner(
  id: SceneSurfaceId,
  storyOwner: SceneRenderStoryOwner,
): SceneRenderSurfaceOwner {
  const domain = sceneSurfaceDefinition(id).domain;
  if (domain === 'layout' || domain === 'diagnostics') return 'shell';
  if (domain === 'ground' || domain === 'satellite') return 'stage';
  return storyOwner;
}

export function actualSurfaceSource(
  id: SceneSurfaceId,
  lane: SceneRenderLane,
): SceneSurfaceSourceClass {
  if (lane === 'artifact-replay'
    && (id === 'ground.ues' || id === 'satellite.markers')) {
    return 'artifact-replay';
  }
  return sceneSurfaceDefinition(id).sourceClass;
}

export function createSurfaceDecision(input: {
  readonly id: SceneSurfaceId;
  readonly lane: SceneRenderLane;
  readonly storyOwner: SceneRenderStoryOwner;
  readonly storyId: string | null;
  readonly storyPairKey: string | null;
  readonly gates?: readonly SceneRenderGate[];
  readonly mounted?: boolean;
  readonly visible?: boolean;
  readonly mountedReason?: SceneRenderReasonCode;
  readonly hiddenReason?: SceneRenderReasonCode;
}): SceneRenderSurfaceDecision {
  const failedGate = input.gates?.find(gate => !gate.passes);
  const mounted = failedGate === undefined && (input.mounted ?? true);
  const visible = mounted && (input.visible ?? true);
  const reasonCode = failedGate?.reason
    ?? (visible
      ? input.mountedReason ?? 'active'
      : input.hiddenReason ?? 'feature-disabled');
  const storyBound = surfaceUsesStory(input.id);
  return Object.freeze({
    id: input.id,
    mounted,
    visible,
    owner: surfaceOwner(input.id, input.storyOwner),
    source: actualSurfaceSource(input.id, input.lane),
    reasonCode,
    renderIdentity: renderIdentity(input.id, input.lane, input.storyId),
    storyId: storyBound ? input.storyId : null,
    storyPairKey: storyBound ? input.storyPairKey : null,
  });
}

export function stageGate(visible: boolean): SceneRenderGate {
  return { passes: visible, reason: 'stage-hidden' };
}

export function featureGate(enabled: boolean): SceneRenderGate {
  return { passes: enabled, reason: 'feature-disabled' };
}

export function inventoryGate(count: number): SceneRenderGate {
  return { passes: count > 0, reason: 'inventory-empty' };
}

export function liveLaneGate(lane: SceneRenderLane): SceneRenderGate {
  return { passes: lane !== 'artifact-replay', reason: 'lane-incompatible' };
}
