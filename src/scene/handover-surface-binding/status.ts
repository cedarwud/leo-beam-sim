import type {
  HandoverStoryClockBasis,
  HandoverStoryKind,
  HandoverStoryPhase,
} from '../handoverStoryFrame';
import type {
  HandoverSurfaceBinding,
  HandoverSurfaceStorySource,
} from './contracts';

export type HandoverSurfaceContractStatus =
  | 'matched'
  | 'missing'
  | 'mismatch'
  | 'no-story';

export interface HandoverSurfaceEndpointExpectation {
  readonly satelliteId: string;
  readonly beamId: string;
}

export interface AcceptedHandoverSurfaceExpectation {
  readonly snapshotId: string;
  readonly episodeId?: string;
  readonly sourceFrameId: string;
  readonly kind: HandoverStoryKind;
  readonly phase?: HandoverStoryPhase;
  readonly clockBasis?: HandoverStoryClockBasis;
  readonly producer?: 'walker' | 'tle';
  readonly from: HandoverSurfaceEndpointExpectation;
  readonly to: HandoverSurfaceEndpointExpectation;
}
export interface TeachingHandoverSurfaceExpectation {
  readonly kind?: HandoverStoryKind;
  readonly phase?: HandoverStoryPhase;
  readonly committed?: boolean;
  readonly currentSec: number;
  readonly durationSec?: number | null;
}

const CLOCK_EPSILON_SEC = 0.001;

export function resolveHandoverSurfaceSourceStatus(
  binding: HandoverSurfaceBinding | null,
  expectedSource: HandoverSurfaceStorySource,
): Exclude<HandoverSurfaceContractStatus, 'no-story'> {
  if (binding === null) return 'missing';
  return binding.source === expectedSource ? 'matched' : 'mismatch';
}

export function resolveAcceptedHandoverSurfaceStatus(
  binding: HandoverSurfaceBinding | null,
  expected: AcceptedHandoverSurfaceExpectation | null,
): HandoverSurfaceContractStatus {
  if (expected === null) return binding === null ? 'no-story' : 'mismatch';
  if (binding === null) return 'missing';
  const frame = binding.frame;
  const identity = binding.identity;
  const matched = binding.source === 'accepted'
    && identity.claimClass === 'accepted-decision'
    && identity.decisionEvidence === 'accepted'
    && identity.disclosure === 'accepted-decision-read-only'
    && (identity.producer === 'walker' || identity.producer === 'tle')
    && (expected.producer === undefined || identity.producer === expected.producer)
    && identity.snapshotId === expected.snapshotId
    && (expected.episodeId === undefined || identity.episodeId === expected.episodeId)
    && identity.sourceFrameId === expected.sourceFrameId
    && identity.kind === expected.kind
    && (expected.phase === undefined || identity.phase === expected.phase)
    && (expected.clockBasis === undefined || identity.clockBasis === expected.clockBasis)
    && frame.from.satelliteId === expected.from.satelliteId
    && frame.from.beamId === expected.from.beamId
    && frame.to.satelliteId === expected.to.satelliteId
    && frame.to.beamId === expected.to.beamId;
  return matched ? 'matched' : 'mismatch';
}

export function resolveTeachingHandoverSurfaceStatus(
  binding: HandoverSurfaceBinding | null,
  expected: TeachingHandoverSurfaceExpectation,
): Exclude<HandoverSurfaceContractStatus, 'no-story'> {
  if (binding === null) return 'missing';
  const frame = binding.frame;
  const identity = binding.identity;
  const durationMatches = expected.durationSec === undefined
    || frame.clock.durationSec === expected.durationSec;
  const matched = binding.source === 'teaching'
    && identity.producer === 'teaching'
    && identity.claimClass === 'authored-teaching'
    && identity.decisionEvidence === 'none'
    && identity.disclosure === 'authored-teaching-not-measured'
    && identity.clockBasis === 'teaching-script'
    && (expected.kind === undefined || identity.kind === expected.kind)
    && (expected.phase === undefined || identity.phase === expected.phase)
    && (expected.committed === undefined || identity.committed === expected.committed)
    && Math.abs(frame.clock.currentSec - expected.currentSec) < CLOCK_EPSILON_SEC
    && durationMatches;
  return matched ? 'matched' : 'mismatch';
}

export function resolveHandoverStoryIdentityStatus(
  binding: HandoverSurfaceBinding | null,
  expectedSource: HandoverSurfaceStorySource,
  expectedStoryId: string | null,
): Exclude<HandoverSurfaceContractStatus, 'no-story'> {
  if (binding === null || expectedStoryId === null) return 'missing';
  return binding.source === expectedSource
    && binding.identity.storyId === expectedStoryId
    ? 'matched'
    : 'mismatch';
}
