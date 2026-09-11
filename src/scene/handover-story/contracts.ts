import type { EvidenceStatus } from '../../engine/handover/candidateDecisionContract';

/** One source-neutral, presentation-only handover story vocabulary. */
export const HANDOVER_STORY_FRAME_SCHEMA_VERSION = 1 as const;

export type HandoverStoryKind = 'intra' | 'inter';
export type HandoverStoryPhase =
  | 'serving'
  | 'measuring'
  | 'holding'
  | 'switching'
  | 'settled';

export type HandoverStoryProducer =
  | 'walker'
  | 'tle'
  | 'manual'
  | 'cinema'
  | 'teaching'
  | 'artifact-replay';

export type HandoverStoryClaimClass =
  | 'accepted-decision'
  | 'observed-simulation'
  | 'presentation-command'
  | 'authored-teaching'
  | 'recorded-replay';

export type HandoverStoryClockBasis =
  | 'simulation-time'
  | 'presentation-wall-clock'
  | 'teaching-script'
  | 'replay-time';

export type HandoverStoryGeometryStatus =
  | 'drawable'
  | 'not-drawable'
  | 'unchecked';

export type HandoverStoryMetricStatus = EvidenceStatus | 'authored';
export type HandoverStoryMetricProvenance =
  | 'accepted-decision'
  | 'observed-presentation'
  | 'authored-teaching';

export interface HandoverStoryMetric {
  readonly status: HandoverStoryMetricStatus;
  readonly value: number | null;
  readonly unit: string;
  readonly sourceFrameId: string | null;
  readonly reason: string | null;
  readonly provenance: HandoverStoryMetricProvenance;
}

export interface HandoverStoryEndpoint {
  readonly satelliteId: string;
  readonly cellId: number | null;
  /** Source-native exact beam token; numeric producers are normalised to text. */
  readonly beamId: string | null;
  readonly satelliteLabel: string | null;
  readonly beamLabel: string | null;
  readonly geometryStatus: HandoverStoryGeometryStatus;
  readonly ee: HandoverStoryMetric | null;
  readonly sinr: HandoverStoryMetric | null;
  readonly elevationDeg: number | null;
}

export interface HandoverStoryProvenance {
  readonly producer: HandoverStoryProducer;
  readonly claimClass: HandoverStoryClaimClass;
  readonly decisionEvidence: 'accepted' | 'none';
  readonly snapshotId: string | null;
  readonly episodeId: string | null;
  readonly sourceFrameId: string | null;
  readonly disclosure:
    | 'accepted-decision-read-only'
    | 'observed-simulation-read-only'
    | 'presentation-command-not-decision-evidence'
    | 'authored-teaching-not-measured'
    | 'artifact-replay-read-only';
  /** A normalized story is always downstream presentation data. */
  readonly decisionInputAllowed: false;
}

export interface HandoverStoryClock {
  readonly basis: HandoverStoryClockBasis;
  readonly currentSec: number;
  readonly durationSec: number | null;
  readonly sourceTimeSec: number | null;
}

export interface HandoverStoryFrame {
  readonly schemaVersion: typeof HANDOVER_STORY_FRAME_SCHEMA_VERSION;
  readonly storyId: string;
  readonly kind: HandoverStoryKind;
  readonly phase: HandoverStoryPhase;
  /** Overall progress when the source publishes it; null means unknown. */
  readonly progress01: number | null;
  readonly committed: boolean;
  readonly ueId: string | null;
  readonly from: HandoverStoryEndpoint;
  readonly to: HandoverStoryEndpoint;
  readonly provenance: HandoverStoryProvenance;
  readonly clock: HandoverStoryClock;
}

/** Renderer-independent geometry/identity descriptor for an authored lecture. */
export interface HandoverTeachingSceneStory {
  readonly kind: HandoverStoryKind;
  readonly sourceSatelliteId: string;
  readonly sourceCellId: number;
  readonly targetSatelliteId: string | null;
  readonly targetCellId: number | null;
  readonly storyKey: string;
}

export type HandoverTeachingPhaseId =
  | 'serving'
  | 'candidate'
  | 'countdown'
  | 'switching'
  | 'settled';

export interface HandoverTeachingLinkFrameInput {
  readonly id: string;
  readonly satelliteLabel: string;
  readonly beamLabel: string;
  readonly eeKbitPerJoule: number;
  readonly elevationDeg: number;
  readonly role: 'serving' | 'winner' | 'alternative';
}

export interface HandoverTeachingFrameInput {
  readonly phase: { readonly id: HandoverTeachingPhaseId };
  readonly phaseProgress01: number;
  readonly elapsedSec: number;
  readonly totalSec: number;
  readonly serving: HandoverTeachingLinkFrameInput;
  readonly winner: HandoverTeachingLinkFrameInput;
  readonly committed: boolean;
  readonly switchProgress01: number;
}
