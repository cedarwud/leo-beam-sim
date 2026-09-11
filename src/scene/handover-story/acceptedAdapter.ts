import type {
  HandoverKind,
  HandoverPhase,
  MetricEvidence,
} from '../../engine/handover/candidateDecisionContract';
import type { AcceptedHandoverPresentationSnapshot } from '../acceptedHandoverPresentationSnapshot';
import type {
  HandoverStoryEndpoint,
  HandoverStoryFrame,
  HandoverStoryKind,
  HandoverStoryMetric,
  HandoverStoryPhase,
} from './contracts';
import { HANDOVER_STORY_FRAME_SCHEMA_VERSION } from './contracts';
import {
  freezeHandoverStoryFrame,
  storyBeamToken,
  storyGeometryStatus,
  validStoryIndex,
} from './frame';

function acceptedMetric(evidence: MetricEvidence | undefined): HandoverStoryMetric | null {
  if (evidence === undefined) return null;
  return Object.freeze({
    status: evidence.status,
    value: evidence.value,
    unit: evidence.unit,
    sourceFrameId: evidence.sourceFrameId,
    reason: evidence.reason,
    provenance: 'accepted-decision',
  });
}

function storyKindFromDecisionKind(kind: HandoverKind): HandoverStoryKind | null {
  if (kind === 'intra-satellite') return 'intra';
  if (kind === 'inter-satellite') return 'inter';
  return null;
}

function decisionPhase(
  phase: HandoverPhase,
  committed: boolean,
): HandoverStoryPhase {
  if (committed && (phase === 'guard' || phase === 'monitoring')) return 'settled';
  switch (phase) {
    case 'initial-attach':
    case 'monitoring': return 'serving';
    case 'evaluating':
    case 'qualifying': return 'measuring';
    case 'selection-hold': return 'holding';
    case 'switching': return 'switching';
    case 'guard': return 'settled';
  }
}

function sameLink(
  left: { readonly satelliteId: string; readonly beamId: number } | null,
  right: { readonly satelliteId: string; readonly beamId: number } | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.satelliteId === right.satelliteId && left.beamId === right.beamId;
}

function acceptedCommitMatches(snapshot: AcceptedHandoverPresentationSnapshot): boolean {
  const evidence = snapshot.handoverEvidence;
  const commit = snapshot.commit;
  return evidence !== null
    && evidence.source !== null
    && commit !== null
    && sameLink(commit.from, evidence.source)
    && sameLink(commit.to, evidence.target);
}

export interface AcceptedHandoverStoryFrameInput {
  readonly snapshot: AcceptedHandoverPresentationSnapshot | null;
  readonly producer: 'walker' | 'tle';
  /** Optional exact beam-to-cell mapping; absence remains explicit as null. */
  readonly resolveCellId?: (beamId: number) => number | null;
  readonly isDrawable?: (satelliteId: string, cellId: number | null) => boolean;
}

function acceptedStoryProgress(
  snapshot: AcceptedHandoverPresentationSnapshot,
): number | null {
  // The decision frame has no whole-story clock. Guard is unambiguously post-transition.
  return snapshot.phase === 'guard' ? 1 : null;
}

/** Project accepted evidence without inventing a presentation clock or geometry. */
export function resolveAcceptedHandoverStoryFrame(
  input: AcceptedHandoverStoryFrameInput,
): HandoverStoryFrame | null {
  const snapshot = input.snapshot;
  const evidence = snapshot?.handoverEvidence ?? null;
  if (snapshot === null || evidence === null || evidence.source === null) return null;
  const kind = storyKindFromDecisionKind(evidence.kind);
  if (kind === null) return null;

  const resolveCellId = input.resolveCellId;
  const fromCellId = validStoryIndex(resolveCellId?.(evidence.source.beamId));
  const toCellId = validStoryIndex(resolveCellId?.(evidence.target.beamId));
  const committed = acceptedCommitMatches(snapshot);
  const drawable = (satelliteId: string, cellId: number | null): boolean | undefined =>
    input.isDrawable?.(satelliteId, cellId);

  const from: HandoverStoryEndpoint = {
    satelliteId: evidence.source.satelliteId,
    cellId: fromCellId,
    beamId: storyBeamToken(evidence.source.beamId),
    satelliteLabel: null,
    beamLabel: null,
    geometryStatus: storyGeometryStatus(drawable(evidence.source.satelliteId, fromCellId)),
    ee: acceptedMetric(evidence.sourceEe),
    sinr: null,
    elevationDeg: null,
  };
  const to: HandoverStoryEndpoint = {
    satelliteId: evidence.target.satelliteId,
    cellId: toCellId,
    beamId: storyBeamToken(evidence.target.beamId),
    satelliteLabel: null,
    beamLabel: null,
    geometryStatus: storyGeometryStatus(drawable(evidence.target.satelliteId, toCellId)),
    ee: acceptedMetric(evidence.targetEe),
    sinr: null,
    elevationDeg: null,
  };

  const sourceToken = `${from.satelliteId}|${from.beamId ?? '-'}`;
  const targetToken = `${to.satelliteId}|${to.beamId ?? '-'}`;
  return freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: `accepted:${snapshot.episodeId}:${sourceToken}->${targetToken}`,
    kind,
    phase: decisionPhase(snapshot.phase, committed),
    progress01: acceptedStoryProgress(snapshot),
    committed,
    ueId: snapshot.primaryUeId,
    from,
    to,
    provenance: {
      producer: input.producer,
      claimClass: 'accepted-decision',
      decisionEvidence: 'accepted',
      snapshotId: snapshot.snapshotId,
      episodeId: snapshot.episodeId,
      sourceFrameId: snapshot.sourceFrameId,
      disclosure: 'accepted-decision-read-only',
      decisionInputAllowed: false,
    },
    clock: {
      basis: 'simulation-time',
      currentSec: snapshot.simTimeMs / 1000,
      durationSec: null,
      sourceTimeSec: snapshot.simTimeMs / 1000,
    },
  });
}
