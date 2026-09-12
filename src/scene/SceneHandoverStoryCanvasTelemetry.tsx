import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

import {
  handoverStoryPairKey,
  type HandoverStoryFrame,
  type HandoverStoryFrameSet,
} from './handoverStoryFrame';
import {
  handoverSurfaceIdentityAttributes,
  resolveHandoverSurfaceBindings,
  type HandoverSurfaceBindingSet,
} from './handoverSurfaceBinding';
import {
  resolveBoundSceneHandoverStoryFrameSet,
  type SceneHandoverStoryLane,
} from './sceneHandoverStoryFrameSet';

export interface SceneHandoverStoryCanvasTelemetryProps {
  /** Exact frame set consumed by the production scene composition plan. */
  readonly frameSet: HandoverStoryFrameSet;
  readonly lane: SceneHandoverStoryLane;
  /** Stable ref lets the canvas read the current teaching frame without a React rerender. */
  readonly sharedBindingsRef?: MutableRefObject<HandoverSurfaceBindingSet | null>;
}

const DATASET_KEYS = Object.freeze([
  'handoverStoryActiveSource',
  'handoverStoryAvailableSources',
  'handoverStoryId',
  'handoverStoryKind',
  'handoverStoryPhase',
  'handoverStoryPairKey',
  'handoverStoryClaimClass',
  'handoverStoryProducer',
  'handoverStoryDecisionInputAllowed',
  'handoverStorySnapshotId',
  'handoverStoryEpisodeId',
  'handoverStorySourceFrameId',
  'handoverStoryClockBasis',
  'handoverStoryAcceptedId',
  'handoverStoryPresentationId',
  'handoverStoryTeachingId',
  'handoverStoryReplayId',
  'handoverSurfaceAcceptedIdentity',
  'handoverSurfaceAcceptedPairKey',
  'handoverSurfaceAcceptedSnapshotId',
  'handoverSurfaceAcceptedEpisodeId',
  'handoverSurfaceAcceptedSourceFrameId',
  'handoverSurfaceTeachingIdentity',
  'handoverSurfaceTeachingPairKey',
  'handoverSurfaceReplayIdentity',
  'handoverSurfacePresentationIdentity',
] as const);

const SURFACE_ATTRIBUTE_NAMES = Object.freeze(
  Object.keys(handoverSurfaceIdentityAttributes('scene', null, 'none')),
);

function clearStoryDataset(canvas: HTMLCanvasElement): void {
  for (const key of DATASET_KEYS) delete canvas.dataset[key];
  for (const name of SURFACE_ATTRIBUTE_NAMES) canvas.removeAttribute(name);
}

function pairKey(frame: HandoverStoryFrame | null): string {
  return frame === null ? '' : handoverStoryPairKey(frame);
}

/**
 * Read-only publication of the exact normalized frame set consumed by the
 * production scene. No adapter or source arbitration is repeated here.
 */
export function SceneHandoverStoryCanvasTelemetry({
  frameSet,
  lane,
  sharedBindingsRef,
}: SceneHandoverStoryCanvasTelemetryProps) {
  const gl = useThree(state => state.gl);
  const lastSignatureRef = useRef('');

  useFrame(() => {
    const sharedBindings = sharedBindingsRef?.current ?? null;
    const currentFrameSet = sharedBindingsRef === undefined
      ? frameSet
      : resolveBoundSceneHandoverStoryFrameSet({
        lane,
        local: frameSet,
        sharedBindings,
      });
    const active = currentFrameSet.active;
    const composedBindings = resolveHandoverSurfaceBindings(currentFrameSet);
    // When the shell supplies bindings, absence is authoritative and must not
    // fall back to a scene-local reconstruction. Only presentation remains a
    // scene-local animation clock; accepted/teaching/replay identity is exact.
    const acceptedBinding = sharedBindings === null
      ? composedBindings.accepted
      : sharedBindings.accepted;
    const teachingBinding = sharedBindings === null
      ? composedBindings.teaching
      : sharedBindings.teaching;
    const replayBinding = sharedBindings === null
      ? composedBindings.replay
      : sharedBindings.replay;
    const surfaceBinding = sharedBindings === null
      ? composedBindings.active
      : sharedBindings.active;
    const surfaceActiveSource = sharedBindings === null
      ? composedBindings.activeSource
      : sharedBindings.activeSource;
    const surfaceAttributes = handoverSurfaceIdentityAttributes(
      'scene',
      surfaceBinding,
      surfaceActiveSource,
    );
    const values = {
      surfaceAttributes,
      activeSource: currentFrameSet.activeSource,
      availableSources: currentFrameSet.availableSources.join(','),
      id: active?.storyId ?? '',
      kind: active?.kind ?? '',
      phase: active?.phase ?? '',
      pairKey: pairKey(active),
      claimClass: active?.provenance.claimClass ?? '',
      producer: active?.provenance.producer ?? '',
      decisionInputAllowed: active === null ? '' : '0',
      snapshotId: active?.provenance.snapshotId ?? '',
      episodeId: active?.provenance.episodeId ?? '',
      sourceFrameId: active?.provenance.sourceFrameId ?? '',
      clockBasis: active?.clock.basis ?? '',
      acceptedId: currentFrameSet.accepted?.storyId ?? '',
      presentationId: currentFrameSet.presentation?.storyId ?? '',
      teachingId: currentFrameSet.teaching?.storyId ?? '',
      replayId: currentFrameSet.replay?.storyId ?? '',
      acceptedIdentity: acceptedBinding?.identityKey ?? '',
      acceptedPairKey: acceptedBinding?.pairKey ?? '',
      acceptedSnapshotId: acceptedBinding?.identity.snapshotId ?? '',
      acceptedEpisodeId: acceptedBinding?.identity.episodeId ?? '',
      acceptedSourceFrameId: acceptedBinding?.identity.sourceFrameId ?? '',
      teachingIdentity: teachingBinding?.identityKey ?? '',
      teachingPairKey: teachingBinding?.pairKey ?? '',
      replayIdentity: replayBinding?.identityKey ?? '',
      presentationIdentity: composedBindings.presentation?.identityKey ?? '',
    };
    const signature = JSON.stringify(values);
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    for (const [name, value] of Object.entries(values.surfaceAttributes)) {
      gl.domElement.setAttribute(name, value);
    }
    const dataset = gl.domElement.dataset;
    dataset.handoverStoryActiveSource = values.activeSource;
    dataset.handoverStoryAvailableSources = values.availableSources;
    dataset.handoverStoryId = values.id;
    dataset.handoverStoryKind = values.kind;
    dataset.handoverStoryPhase = values.phase;
    dataset.handoverStoryPairKey = values.pairKey;
    dataset.handoverStoryClaimClass = values.claimClass;
    dataset.handoverStoryProducer = values.producer;
    dataset.handoverStoryDecisionInputAllowed = values.decisionInputAllowed;
    dataset.handoverStorySnapshotId = values.snapshotId;
    dataset.handoverStoryEpisodeId = values.episodeId;
    dataset.handoverStorySourceFrameId = values.sourceFrameId;
    dataset.handoverStoryClockBasis = values.clockBasis;
    dataset.handoverStoryAcceptedId = values.acceptedId;
    dataset.handoverStoryPresentationId = values.presentationId;
    dataset.handoverStoryTeachingId = values.teachingId;
    dataset.handoverStoryReplayId = values.replayId;
    dataset.handoverSurfaceAcceptedIdentity = values.acceptedIdentity;
    dataset.handoverSurfaceAcceptedPairKey = values.acceptedPairKey;
    dataset.handoverSurfaceAcceptedSnapshotId = values.acceptedSnapshotId;
    dataset.handoverSurfaceAcceptedEpisodeId = values.acceptedEpisodeId;
    dataset.handoverSurfaceAcceptedSourceFrameId = values.acceptedSourceFrameId;
    dataset.handoverSurfaceTeachingIdentity = values.teachingIdentity;
    dataset.handoverSurfaceTeachingPairKey = values.teachingPairKey;
    dataset.handoverSurfaceReplayIdentity = values.replayIdentity;
    dataset.handoverSurfacePresentationIdentity = values.presentationIdentity;
  });

  useEffect(() => () => {
    lastSignatureRef.current = '';
    clearStoryDataset(gl.domElement);
  }, [gl]);

  return null;
}
