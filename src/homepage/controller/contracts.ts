/**
 * Homepage-only controller seams.
 *
 * These are boundary types, not a second runtime.  The homepage integration
 * owner is responsible for adapting the existing live simulator into these
 * seams and for keeping the existing decision/snapshot authority singular.
 */

import type {
  CandidateLinkKey,
  HandoverDecisionFrame,
  HandoverPhase,
} from '../../engine/handover/candidateDecisionContract';
import type { CandidateOpportunitySet } from '../../engine/handover/candidateOpportunityProducer';
import type { CandidatePresentationLink } from '../../engine/handover/candidatePresentationPlan';
import type {
  AcceptedHandoverPresentationSnapshot,
} from '../../scene/acceptedHandoverPresentationSnapshot';
import type {
  HandoverPresentationKind,
  HandoverPresentationPhase,
  HandoverPresentationSource,
} from '../../scene/handoverPresentationOwner';
import type { MultiCandidateScenePresentation } from '../../scene/multiCandidateScenePresentation';
import type { SimFrame } from '../../scene/types';
import type { HomepageSatelliteVisualColor } from './homepageSatelliteVisualIdentity';

export interface HomepagePlaybackTransportState {
  readonly paused: boolean;
  /** User intent, as selected in the homepage timeline. */
  readonly selectedSpeed: number;
  /** The speed actually consumed by the live simulation. */
  readonly effectiveSpeed: number;
}

/**
 * The one visible handover pair published by the scene presentation owner.
 *
 * This is not a second decision or candidate list. It is the renderer's
 * accepted visual envelope projected to the homepage rail so the pair shown in
 * the centre can be found in the same service/candidate roster. Beam ids are
 * deliberately one-based here, matching the public rail and link-budget ids;
 * scene geometry continues to use zero-based earth-fixed cell ids.
 */
export interface HomepageHandoverPresentation {
  readonly eventId: string;
  readonly kind: HandoverPresentationKind;
  readonly source: HandoverPresentationSource;
  readonly phase: HandoverPresentationPhase;
  readonly progress01: number;
  readonly from: {
    readonly satelliteId: string;
    readonly beamId: number;
    readonly sinrDb: number | null;
  };
  readonly to: {
    readonly satelliteId: string;
    readonly beamId: number;
    readonly sinrDb: number | null;
  };
  readonly deltaDb: number | null;
}

export type HomepageHandoverStoryKind = 'intra' | 'inter';
export type HomepageHandoverStoryCellExample = 'one-cell' | 'seven-cell' | 'nineteen-cell';
export type HomepageHandoverStorySelectionStatus =
  | 'qualified'
  | 'ttt-stable'
  | 'selected'
  | 'committed';
export type HomepageHandoverStoryWinnerBasis = 'instantaneous-ee-max' | 'unavailable';

/**
 * One compact teaching projection of the accepted decision frame.
 *
 * This is deliberately not a new candidate selector.  The decision engine
 * still owns qualification, TTT, ordering, and commit.  The projection only
 * joins the accepted source/target pair with the already-published EE evidence
 * so the scene and rail can explain the same winner without re-running policy.
 */
export interface HomepageHandoverStoryProjection {
  readonly snapshotId: string;
  readonly sourceFrameId: string;
  readonly phase: HandoverPhase;
  readonly kind: HomepageHandoverStoryKind;
  readonly cellCount: 1 | 7 | 19;
  readonly cellExample: HomepageHandoverStoryCellExample;
  readonly source: CandidateLinkKey;
  readonly target: CandidateLinkKey;
  readonly winner: CandidateLinkKey | null;
  readonly sourceEeBitsPerJoule: number | null;
  readonly targetEeBitsPerJoule: number | null;
  readonly winnerEeBitsPerJoule: number | null;
  readonly winnerBasis: HomepageHandoverStoryWinnerBasis;
  readonly targetIsWinner: boolean;
  readonly qualifiedCandidateCount: number;
  readonly qualifiedCandidateSatelliteCount: number;
  readonly selectionStatus: HomepageHandoverStorySelectionStatus;
  readonly sameSatellite: boolean;
}

export type HomepagePlaybackCommand =
  | { readonly type: 'play' }
  | { readonly type: 'pause' }
  | { readonly type: 'toggle' }
  | { readonly type: 'seek'; readonly targetSec: number }
  | { readonly type: 'set-speed'; readonly speed: number };

/** One immutable live frame from which all homepage projections must derive. */
export interface HomepageSourceFrame {
  readonly frame: SimFrame;
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly simTimeMs: number;
  readonly simTimeSec: number;
  readonly dtSec: number;
  readonly primaryUeId: string | null;
  readonly serving: CandidateLinkKey | null;
  readonly opportunitySet: CandidateOpportunitySet | null;
  readonly decision: HandoverDecisionFrame | null;
}

/** Decision output carries source identity forward; it does not own playback. */
export interface HomepageHandoverDecisionBoundary {
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly simTimeMs: number;
  readonly phase: HandoverPhase;
  readonly decision: HandoverDecisionFrame | null;
}

/** Scene output is an adapter over the existing renderer-neutral scene model. */
export interface HomepageSceneProjection {
  readonly snapshotId: string;
  readonly sourceFrameId: string;
  readonly phase: HandoverPhase;
  readonly presentation: MultiCandidateScenePresentation | null;
  readonly renderedSceneJoinKeys: readonly CandidateLinkKey[];
  readonly beamMetrics?: HomepageBeamMetricsProjection | null;
}

/** Rail output is a view of the accepted snapshot, never a new decision. */
export interface HomepageRailProjection {
  readonly snapshotId: string;
  readonly sourceFrameId: string;
  readonly phase: HandoverPhase;
  /** The accepted decision frame; the rail may display it but never recompute it. */
  readonly decision?: HandoverDecisionFrame | null;
  readonly serving: CandidatePresentationLink | null;
  readonly candidates: readonly CandidatePresentationLink[];
  /**
   * Display-only continuity roster for a readable handover boundary.  The
   * canonical `candidates` reference above always remains the current
   * accepted snapshot; this optional view is populated only when that current
   * snapshot temporarily omits the already-explained pair's candidate set.
   */
  readonly visibleCandidates?: readonly CandidatePresentationLink[];
  readonly candidateRosterSourceFrameId?: string;
  readonly candidateRosterRetained?: boolean;
  readonly overflowKeys: readonly CandidateLinkKey[];
  readonly counts: AcceptedHandoverPresentationSnapshot['counts'];
  readonly activeDataLinkCount: 0 | 1;
  readonly beamMetrics?: HomepageBeamMetricsProjection | null;
  /** Same-snapshot EE story; absent only for an initial-attach/no-target frame. */
  readonly handoverStory?: HomepageHandoverStoryProjection | null;
}

/**
 * Homepage-only per-beam readout.  This is a projection of the accepted
 * source frame, never a new candidate or serving decision. The serving and
 * candidate handover-story rows use the same primary-UE, same-frame,
 * angle-aware LinkSample contract so their four raw values are comparable.
 * The homepage may apply a documented display-only continuity filter to those
 * same-role values; this never feeds back into the decision engine.
 * Candidate power/rate/instantaneous-EE values require finite primary-UE
 * candidate-probe evidence, except for finite values retained from an
 * optional prior same-role projection during a temporary omission; this
 * display seam is not forecast-EE and must not turn a missing value into a
 * fabricated number.
 */
export type HomepageBeamMetricRole = 'serving' | 'candidate' | 'observed';
export type HomepageBeamMetricAvailability = 'available' | 'unavailable' | 'idle';
export type HomepageBeamMetricEeBasis =
  | 'active-assignment'
  | 'primary-beam-display'
  | 'candidate-probe'
  | 'homepage-demo-stable'
  | 'homepage-handover-hierarchy-display'
  | 'not-available';
export type HomepageBeamMetricProvenance =
  | 'active-assignment-angle-aware'
  | 'primary-ue-same-frame-angle-aware-display-only'
  | 'primary-ue-same-frame-angle-aware-beam-metric-display-only'
  | 'homepage-demo-ee-display-only'
  | 'homepage-ee-hierarchy-display-only'
  | 'not-available';

export interface HomepageBeamMetric {
  readonly key: CandidateLinkKey;
  readonly joinKey: string;
  readonly sourceFrameId: string;
  readonly snapshotId: string | null;
  readonly satelliteId: string;
  readonly beamId: number;
  readonly role: HomepageBeamMetricRole;
  readonly availability: HomepageBeamMetricAvailability;
  readonly sinrDb: number | null;
  readonly powerW: number | null;
  readonly throughputBps: number | null;
  readonly energyEfficiencyBitsPerJoule: number | null;
  /** Frame-local 0..1 rank used only by the homepage colour projection. */
  readonly eeNormalized: number | null;
  readonly eeBasis: HomepageBeamMetricEeBasis;
  /** Optional for older hand-authored rail fixtures; live projections set it. */
  readonly provenance?: HomepageBeamMetricProvenance;
  readonly reason: string | null;
  readonly isPrimaryServing: boolean;
  readonly color: HomepageSatelliteVisualColor;
}

export interface HomepageBeamMetricsProjection {
  readonly sourceFrameId: string;
  readonly snapshotId: string | null;
  readonly simTimeSec: number;
  readonly metrics: readonly HomepageBeamMetric[];
  readonly availableEeMinBitsPerJoule: number | null;
  readonly availableEeMaxBitsPerJoule: number | null;
}

/** Alias makes the integration seam explicit without redefining the snapshot. */
export type HomepageAcceptedSnapshot = AcceptedHandoverPresentationSnapshot;
