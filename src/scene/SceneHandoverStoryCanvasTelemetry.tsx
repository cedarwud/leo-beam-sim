import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import type { HandoverPresentationView } from './handoverPresentationOwner';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import {
  handoverStoryPairKey,
  resolveAcceptedHandoverStoryFrame,
  resolveHandoverStoryFrameSet,
  resolvePresentationHandoverStoryFrame,
  resolveReplayHandoverStoryFrame,
  resolveTeachingHandoverStoryFrame,
  type HandoverTeachingFrameInput,
  type HandoverTeachingSceneStory,
} from './handoverStoryFrame';

interface ReadonlyCurrentRef<T> {
  readonly current: T | null;
}

const NO_ACCEPTED_CELL_ID = (): null => null;

export interface SceneHandoverStoryCanvasTelemetryProps {
  readonly acceptedSnapshot?: AcceptedHandoverPresentationSnapshot | null;
  readonly acceptedProducer?: 'walker' | 'tle';
  readonly resolveAcceptedCellId?: (beamId: number) => number | null;
  readonly presentationView?: HandoverPresentationView | null;
  readonly teachingStory?: HandoverTeachingSceneStory | null;
  readonly teachingFrameRef?: ReadonlyCurrentRef<HandoverTeachingFrameInput>;
  readonly replayFrame?: NormalizedSceneFrame | null;
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
] as const);

function clearStoryDataset(canvas: HTMLCanvasElement): void {
  for (const key of DATASET_KEYS) delete canvas.dataset[key];
}

/**
 * Read-only production projection for the normalized handover story boundary.
 * It changes no decision, clock, surface mount, animation or renderer input.
 */
export function SceneHandoverStoryCanvasTelemetry({
  acceptedSnapshot = null,
  acceptedProducer = 'walker',
  resolveAcceptedCellId = NO_ACCEPTED_CELL_ID,
  presentationView = null,
  teachingStory = null,
  teachingFrameRef,
  replayFrame = null,
}: SceneHandoverStoryCanvasTelemetryProps) {
  const gl = useThree(state => state.gl);
  const lastSignatureRef = useRef('');
  const accepted = useMemo(
    () => resolveAcceptedHandoverStoryFrame({
      snapshot: acceptedSnapshot,
      producer: acceptedProducer,
      resolveCellId: resolveAcceptedCellId,
    }),
    [acceptedProducer, acceptedSnapshot, resolveAcceptedCellId],
  );
  const presentation = useMemo(
    () => presentationView === null
      ? null
      : resolvePresentationHandoverStoryFrame({ view: presentationView }),
    [presentationView],
  );
  const replay = useMemo(
    () => resolveReplayHandoverStoryFrame({ frame: replayFrame }),
    [replayFrame],
  );

  useFrame(() => {
    const teaching = resolveTeachingHandoverStoryFrame({
      story: teachingStory,
      frame: teachingFrameRef?.current ?? null,
    });
    const set = resolveHandoverStoryFrameSet({
      accepted,
      presentation,
      teaching,
      replay,
    });
    const active = set.active;
    const pairKey = active === null ? '' : handoverStoryPairKey(active);
    const values = {
      activeSource: set.activeSource,
      availableSources: set.availableSources.join(','),
      id: active?.storyId ?? '',
      kind: active?.kind ?? '',
      phase: active?.phase ?? '',
      pairKey,
      claimClass: active?.provenance.claimClass ?? '',
      producer: active?.provenance.producer ?? '',
      decisionInputAllowed: active === null ? '' : '0',
      snapshotId: active?.provenance.snapshotId ?? '',
      episodeId: active?.provenance.episodeId ?? '',
      sourceFrameId: active?.provenance.sourceFrameId ?? '',
      clockBasis: active?.clock.basis ?? '',
      acceptedId: set.accepted?.storyId ?? '',
      presentationId: set.presentation?.storyId ?? '',
      teachingId: set.teaching?.storyId ?? '',
      replayId: set.replay?.storyId ?? '',
    };
    const signature = JSON.stringify(values);
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

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
  });

  useEffect(() => () => {
    lastSignatureRef.current = '';
    clearStoryDataset(gl.domElement);
  }, [gl]);

  return null;
}
