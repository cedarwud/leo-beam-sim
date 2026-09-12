import {
  handoverStoryPairKey,
  type HandoverStoryFrame,
  type HandoverStoryFrameSet,
} from '../handoverStoryFrame';
import {
  HANDOVER_SURFACE_BINDING_SCHEMA_VERSION,
  type HandoverSurfaceBinding,
  type HandoverSurfaceBindingSet,
  type HandoverSurfaceIdentity,
  type HandoverSurfaceStorySource,
} from './contracts';

function sourceMatchesFrame(
  source: HandoverSurfaceStorySource,
  frame: HandoverStoryFrame,
): boolean {
  const claim = frame.provenance.claimClass;
  if (source === 'accepted') {
    return claim === 'accepted-decision'
      && frame.provenance.decisionEvidence === 'accepted';
  }
  if (source === 'teaching') {
    return claim === 'authored-teaching'
      && frame.provenance.producer === 'teaching'
      && frame.provenance.decisionEvidence === 'none';
  }
  if (source === 'replay') {
    return claim === 'recorded-replay'
      && frame.provenance.producer === 'artifact-replay'
      && frame.provenance.decisionEvidence === 'none';
  }
  return claim === 'observed-simulation'
    || claim === 'presentation-command';
}

function resolveIdentity(
  source: HandoverSurfaceStorySource,
  frame: HandoverStoryFrame,
  pairKey: string,
): HandoverSurfaceIdentity {
  return Object.freeze({
    source,
    storyId: frame.storyId,
    kind: frame.kind,
    pairKey,
    phase: frame.phase,
    committed: frame.committed,
    clockBasis: frame.clock.basis,
    producer: frame.provenance.producer,
    claimClass: frame.provenance.claimClass,
    decisionEvidence: frame.provenance.decisionEvidence,
    disclosure: frame.provenance.disclosure,
    snapshotId: frame.provenance.snapshotId,
    episodeId: frame.provenance.episodeId,
    sourceFrameId: frame.provenance.sourceFrameId,
  });
}

function bindingIdentityKey(identity: HandoverSurfaceIdentity): string {
  return [
    identity.source,
    identity.storyId,
    identity.kind,
    identity.pairKey,
    identity.phase,
    identity.committed ? 'committed' : 'pending',
    identity.clockBasis,
    identity.producer,
    identity.claimClass,
    identity.decisionEvidence,
    identity.disclosure,
    identity.snapshotId ?? '-',
    identity.episodeId ?? '-',
    identity.sourceFrameId ?? '-',
  ].join('|');
}

export function resolveHandoverSurfaceBinding(
  source: HandoverSurfaceStorySource,
  frame: HandoverStoryFrame | null,
): HandoverSurfaceBinding | null {
  if (frame === null || !sourceMatchesFrame(source, frame)) return null;
  const pairKey = handoverStoryPairKey(frame);
  const identity = resolveIdentity(source, frame, pairKey);
  return Object.freeze({
    schemaVersion: HANDOVER_SURFACE_BINDING_SCHEMA_VERSION,
    source,
    frame,
    pairKey,
    identity,
    identityKey: bindingIdentityKey(identity),
  });
}

export function resolveHandoverSurfaceBindings(
  frameSet: HandoverStoryFrameSet,
): HandoverSurfaceBindingSet {
  const accepted = resolveHandoverSurfaceBinding('accepted', frameSet.accepted);
  const presentation = resolveHandoverSurfaceBinding('presentation', frameSet.presentation);
  const teaching = resolveHandoverSurfaceBinding('teaching', frameSet.teaching);
  const replay = resolveHandoverSurfaceBinding('replay', frameSet.replay);
  const bySource = { accepted, presentation, teaching, replay } as const;
  const active = frameSet.activeSource === 'none'
    ? null
    : bySource[frameSet.activeSource];

  // A malformed source/frame pairing fails closed rather than publishing a
  // different identity from the frame-set authority.
  const exactActive = active !== null && active.frame === frameSet.active
    ? active
    : null;
  return Object.freeze({
    accepted,
    presentation,
    teaching,
    replay,
    active: exactActive,
    activeSource: exactActive === null ? 'none' : frameSet.activeSource,
  });
}
