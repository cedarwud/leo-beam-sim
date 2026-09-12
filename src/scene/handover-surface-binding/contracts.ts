import type {
  HandoverStoryClaimClass,
  HandoverStoryClockBasis,
  HandoverStoryFrame,
  HandoverStoryFrameSet,
  HandoverStoryFrameSource,
  HandoverStoryKind,
  HandoverStoryPhase,
  HandoverStoryProducer,
  HandoverStoryProvenance,
} from '../handoverStoryFrame';

export const HANDOVER_SURFACE_BINDING_SCHEMA_VERSION = 1 as const;

export type HandoverSurfaceKind = 'scene' | 'rail' | 'caption';
export type HandoverSurfaceStorySource = Exclude<HandoverStoryFrameSource, 'none'>;

/**
 * Immutable identity published by every scene/rail/caption surface.
 * Keep this separate from view copy and animation values: these are exactly
 * the fields that establish which normalized story a surface is presenting.
 */
export interface HandoverSurfaceIdentity {
  readonly source: HandoverSurfaceStorySource;
  readonly storyId: string;
  readonly kind: HandoverStoryKind;
  readonly pairKey: string;
  readonly phase: HandoverStoryPhase;
  readonly committed: boolean;
  readonly clockBasis: HandoverStoryClockBasis;
  readonly producer: HandoverStoryProducer;
  readonly claimClass: HandoverStoryClaimClass;
  readonly decisionEvidence: HandoverStoryProvenance['decisionEvidence'];
  readonly disclosure: HandoverStoryProvenance['disclosure'];
  readonly snapshotId: string | null;
  readonly episodeId: string | null;
  readonly sourceFrameId: string | null;
}

export interface HandoverSurfaceBinding {
  readonly schemaVersion: typeof HANDOVER_SURFACE_BINDING_SCHEMA_VERSION;
  readonly source: HandoverSurfaceStorySource;
  /** Exact normalized frame shared by every projection in this source lane. */
  readonly frame: HandoverStoryFrame;
  readonly pairKey: string;
  /** Frozen, comparison-safe identity derived once by the shared composer. */
  readonly identity: HandoverSurfaceIdentity;
  readonly identityKey: string;
}

export interface HandoverSurfaceBindingSet {
  readonly accepted: HandoverSurfaceBinding | null;
  readonly presentation: HandoverSurfaceBinding | null;
  readonly teaching: HandoverSurfaceBinding | null;
  readonly replay: HandoverSurfaceBinding | null;
  readonly active: HandoverSurfaceBinding | null;
  readonly activeSource: HandoverStoryFrameSet['activeSource'];
}
