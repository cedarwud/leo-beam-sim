import {
  acceptedHandoverSnapshotTracksDecisionFrame,
  type AcceptedHandoverPresentationSnapshot,
} from './acceptedHandoverPresentationSnapshot';
import {
  buildMultiCandidateScenePresentation,
  type MultiCandidateScenePresentation,
} from './multiCandidateScenePresentation';
import { buildHomepageSceneProjection } from '../homepage/controller/sceneProjection';
import type { HomepageSceneProjection } from '../homepage/controller/contracts';
import {
  isMultiCandidateComparisonFocusDecisionFrame,
  isMultiCandidatePreSelectionDecisionFrame,
} from './multiCandidateWarmStart';
import {
  shouldEnableHomepageMultiCandidateAuthority,
  type SceneLane,
} from '../app/sceneLane';
import type { CandidatePresentationPlan } from '../engine/handover/candidatePresentationPlan';
import type {
  MultiCandidateBeamSceneRenderInstruction,
  MultiCandidateBeamSceneRenderPlan,
} from '../viz/MultiCandidateBeamScene';
import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';

export type MultiCandidateSceneSimulationSource = 'live' | 'archived-tle';

export { MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER } from '../appearance/coneGeometryContract';
export const MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED = true;

export interface MultiCandidateComparisonLatch {
  readonly episodeId: string;
  readonly epochToken: string;
}

export interface MultiCandidateComparisonPolicyInput {
  readonly acceptedPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly simSource: MultiCandidateSceneSimulationSource;
  readonly sceneLane: SceneLane;
  readonly previousLatch: MultiCandidateComparisonLatch | null;
  readonly centralOverlayEnabled: boolean;
}

export interface MultiCandidateComparisonPolicy {
  readonly acceptedDecision: HandoverDecisionFrame | null;
  readonly snapshotMatchesFrame: boolean;
  readonly authorityActive: boolean;
  readonly decisionAuthorityPresent: boolean;
  readonly rawComparisonPhase: boolean;
  readonly preSelectionComparisonPhase: boolean;
  readonly latchedComparisonPhase: boolean;
  readonly comparisonPhase: boolean;
  readonly centralOverlayActive: boolean;
  readonly nextLatch: MultiCandidateComparisonLatch | null;
}

/**
 * Resolve the accepted candidate comparison gate and its display-only
 * hysteresis. The latch is returned as data so the React adapter can retain it
 * without letting this policy read or write component state.
 */
export function resolveMultiCandidateComparisonPolicy(
  input: MultiCandidateComparisonPolicyInput,
): MultiCandidateComparisonPolicy {
  const acceptedDecision = input.acceptedPresentation?.decision ?? null;
  const snapshotMatchesFrame = acceptedHandoverSnapshotTracksDecisionFrame(
    input.acceptedPresentation,
    acceptedDecision,
  );
  const authorityActive = snapshotMatchesFrame;
  const decisionAuthorityPresent = input.simSource === 'live'
    && shouldEnableHomepageMultiCandidateAuthority(input.sceneLane)
    && acceptedDecision !== null;
  const rawComparisonPhase = acceptedDecision !== null
    && isMultiCandidateComparisonFocusDecisionFrame(acceptedDecision);
  const preSelectionComparisonPhase = acceptedDecision !== null
    && isMultiCandidatePreSelectionDecisionFrame(acceptedDecision);
  const previousLatch = input.previousLatch;
  const sameLatchedEpisode = input.acceptedPresentation !== null
    && previousLatch !== null
    && input.acceptedPresentation.episodeId === previousLatch.episodeId
    && input.acceptedPresentation.epochToken === previousLatch.epochToken;

  let nextLatch = previousLatch;
  if (
    acceptedDecision === null
    || !preSelectionComparisonPhase
    || (previousLatch !== null && !sameLatchedEpisode)
  ) {
    nextLatch = null;
  }
  if (rawComparisonPhase && input.acceptedPresentation !== null) {
    nextLatch = {
      episodeId: input.acceptedPresentation.episodeId,
      epochToken: input.acceptedPresentation.epochToken,
    };
  }

  const latchedComparisonPhase = preSelectionComparisonPhase
    && input.acceptedPresentation !== null
    && nextLatch !== null
    && input.acceptedPresentation.episodeId === nextLatch.episodeId
    && input.acceptedPresentation.epochToken === nextLatch.epochToken;
  const comparisonPhase = rawComparisonPhase || latchedComparisonPhase;
  const centralOverlayActive = authorityActive
    && input.centralOverlayEnabled
    && comparisonPhase;

  return {
    acceptedDecision,
    snapshotMatchesFrame,
    authorityActive,
    decisionAuthorityPresent,
    rawComparisonPhase,
    preSelectionComparisonPhase,
    latchedComparisonPhase,
    comparisonPhase,
    centralOverlayActive,
    nextLatch,
  };
}

export interface MultiCandidatePresentationHold {
  readonly episodeKey: string;
  readonly presentation: MultiCandidateScenePresentation;
}

export interface MultiCandidatePresentationPolicyInput {
  readonly acceptedPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly candidatePresentationPlan: CandidatePresentationPlan | null;
  readonly homepageVisualIdentity: boolean;
  readonly sceneLane: SceneLane;
  readonly simSource: MultiCandidateSceneSimulationSource;
  readonly authorityActive: boolean;
  readonly comparisonPhase: boolean;
  readonly preSelectionComparisonPhase: boolean;
  readonly showSinrLiveCellBeams: boolean;
  readonly sceneLayerEnabled: boolean;
  readonly previousHold: MultiCandidatePresentationHold | null;
  readonly centralOverlayEnabled: boolean;
}

export interface MultiCandidatePresentationPolicy {
  readonly homepageSceneProjection: HomepageSceneProjection | null;
  readonly candidateReviewPresentation: MultiCandidateScenePresentation | null;
  readonly candidateComparisonSceneActive: boolean;
  readonly scenePresentation: MultiCandidateScenePresentation | null;
  readonly episodeKey: string | null;
  readonly nextHold: MultiCandidatePresentationHold | null;
  readonly scenePresentationForRender: MultiCandidateScenePresentation | null;
  readonly scenePresentationHoldActive: boolean;
  readonly sceneVisualActive: boolean;
  readonly sceneLayerVisible: boolean;
}

/**
 * Build the shared accepted snapshot presentation and keep the short
 * publication-gap hold. Geometry remains outside this module as a renderer
 * adapter; this seam only decides which immutable presentation is mounted.
 */
export function resolveMultiCandidatePresentationPolicy(
  input: MultiCandidatePresentationPolicyInput,
): MultiCandidatePresentationPolicy {
  const homepageSceneProjection = input.homepageVisualIdentity
    && input.sceneLane === 'sinr-live'
    && input.simSource === 'live'
    && input.acceptedPresentation !== null
    && input.candidatePresentationPlan !== null
    ? buildHomepageSceneProjection(input.acceptedPresentation)
    : null;
  const candidateReviewPresentation = input.candidatePresentationPlan === null
    ? null
    : homepageSceneProjection?.presentation
      ?? buildMultiCandidateScenePresentation(input.candidatePresentationPlan);
  const candidateComparisonSceneActive = input.authorityActive
    && input.comparisonPhase
    && input.showSinrLiveCellBeams
    && candidateReviewPresentation !== null;
  const scenePresentation = !input.centralOverlayEnabled || input.candidatePresentationPlan === null
    ? null
    : homepageSceneProjection?.presentation
      ?? buildMultiCandidateScenePresentation(input.candidatePresentationPlan);

  const episodeKey = input.acceptedPresentation === null
    ? null
    : input.acceptedPresentation.episodeId + '|' + input.acceptedPresentation.epochToken;
  let nextHold = input.previousHold;
  if (
    !input.centralOverlayEnabled
    || episodeKey === null
    || !input.preSelectionComparisonPhase
    || (
      nextHold !== null
      && nextHold.episodeKey !== episodeKey
    )
  ) {
    nextHold = null;
  }
  if (
    input.preSelectionComparisonPhase
    && scenePresentation !== null
    && episodeKey !== null
  ) {
    nextHold = { episodeKey, presentation: scenePresentation };
  }

  const scenePresentationForRender = input.centralOverlayEnabled
    ? scenePresentation
      ?? (
        input.preSelectionComparisonPhase
        && nextHold?.episodeKey === episodeKey
          ? nextHold.presentation
          : null
      )
    : null;
  const scenePresentationHoldActive = scenePresentation === null
    && scenePresentationForRender !== null
    && input.preSelectionComparisonPhase
    && input.comparisonPhase;
  const sceneVisualActive = input.centralOverlayEnabled
    && (input.authorityActive && input.comparisonPhase || scenePresentationHoldActive);
  const sceneLayerVisible = input.sceneLayerEnabled && sceneVisualActive;

  return {
    homepageSceneProjection,
    candidateReviewPresentation,
    candidateComparisonSceneActive,
    scenePresentation,
    episodeKey,
    nextHold,
    scenePresentationForRender,
    scenePresentationHoldActive,
    sceneVisualActive,
    sceneLayerVisible,
  };
}

export type CandidateSceneInstructionSelector = (
  instructions: readonly MultiCandidateBeamSceneRenderInstruction[],
) => readonly MultiCandidateBeamSceneRenderInstruction[];

export interface MultiCandidateRenderIdentityInput {
  readonly candidateReviewRenderPlan: MultiCandidateBeamSceneRenderPlan | null;
  readonly sceneRenderPlan: MultiCandidateBeamSceneRenderPlan | null;
  readonly selectInstructions: CandidateSceneInstructionSelector;
}

export interface MultiCandidateRenderIdentity {
  readonly candidateComparisonVisibleSatelliteIds: ReadonlySet<string> | null;
  readonly candidateComparisonOrdinalBySatelliteId: ReadonlyMap<string, number>;
  readonly servingCarrierRenderable: boolean;
}

/**
 * Resolve the marker identity roster from the already-mapped render plans.
 * Candidate selection remains supplied by the route adapter, while the
 * satellite set, ordinal labels, and serving-carrier acknowledgement share
 * one pure result.
 */
export function resolveMultiCandidateRenderIdentity(
  input: MultiCandidateRenderIdentityInput,
): MultiCandidateRenderIdentity {
  const candidatePlan = input.candidateReviewRenderPlan;
  const candidateInstructions = candidatePlan === null
    ? []
    : input.selectInstructions(candidatePlan.instructions);
  const candidateComparisonVisibleSatelliteIds = candidatePlan === null
    ? null
    : new Set(candidateInstructions.map(instruction => instruction.satelliteId));
  const servingSatelliteId = candidateInstructions.find(
    instruction => instruction.isServing,
  )?.satelliteId;
  const alternateIds = [...new Set(
    candidateInstructions
      .filter(instruction => instruction.isCandidate && instruction.satelliteId !== servingSatelliteId)
      .map(instruction => instruction.satelliteId),
  )];
  const candidateComparisonOrdinalBySatelliteId = new Map(
    alternateIds.map((satelliteId, index) => [satelliteId, index + 1] as const),
  );
  const servingCarrierRenderable = input.sceneRenderPlan?.instructions.some(
    instruction => instruction.isServing
      && (
        instruction.cone.visible
        || instruction.footprint.visible
        || instruction.link.visible
      ),
  ) ?? false;
  return {
    candidateComparisonVisibleSatelliteIds,
    candidateComparisonOrdinalBySatelliteId,
    servingCarrierRenderable,
  };
}

export interface MultiCandidateCentralMarkerFilter {
  readonly episodeKey: string;
  readonly satelliteIds: ReadonlySet<string>;
}

export interface MultiCandidateMarkerPolicyInput {
  readonly simSource: MultiCandidateSceneSimulationSource;
  readonly canonicalCandidateSatelliteId: string | null | undefined;
  readonly primaryPendingTargetSatelliteId: string | null | undefined;
  readonly sceneVisualActive: boolean;
  readonly centralOverlayActive: boolean;
  readonly candidateComparisonSceneActive: boolean;
  readonly preSelectionComparisonPhase: boolean;
  readonly acceptedComparisonEpisodeKey: string | null;
  readonly previousFilter: MultiCandidateCentralMarkerFilter | null;
  readonly candidateComparisonRenderPlan: MultiCandidateBeamSceneRenderPlan | null;
  readonly sceneRenderPlan: MultiCandidateBeamSceneRenderPlan | null;
  readonly candidateComparisonVisibleSatelliteIds: ReadonlySet<string> | null;
  readonly homepageVisualIdentity: boolean;
  readonly selectInstructions: CandidateSceneInstructionSelector;
}

export interface MultiCandidateMarkerPolicy {
  readonly centralMarkerSourcePlan: MultiCandidateBeamSceneRenderPlan | null;
  readonly nextFilter: MultiCandidateCentralMarkerFilter | null;
  readonly latchedCentralMarkerSatelliteIds: ReadonlySet<string> | null;
  readonly renderedCandidateSatelliteId: string | null | undefined;
  readonly centralMarkerSatelliteIds: ReadonlySet<string> | null;
  readonly homepageCandidateStageLabelActive: boolean;
  readonly homepageCandidateStageVisibleSatelliteIds: ReadonlySet<string> | null;
  readonly homepageSatelliteLabelActive: boolean;
  readonly satelliteCandidateLabelActive: boolean;
  readonly satelliteCandidateLabelVisibleSatelliteIds: ReadonlySet<string> | null;
}

/**
 * Resolve the display-only marker filter and label gates. The filter is a
 * latch because a throttled accepted publication can briefly omit a valid
 * comparison set; no scientific serving state is retained here.
 */
export function resolveMultiCandidateMarkerPolicy(
  input: MultiCandidateMarkerPolicyInput,
): MultiCandidateMarkerPolicy {
  const centralMarkerSourcePlan = input.candidateComparisonSceneActive
    ? input.candidateComparisonRenderPlan
    : input.centralOverlayActive
      ? input.sceneRenderPlan
      : null;
  let nextFilter = input.previousFilter;
  const previousFilterIsStale = nextFilter !== null
    && nextFilter.episodeKey !== input.acceptedComparisonEpisodeKey;
  if (
    input.acceptedComparisonEpisodeKey === null
    || !input.preSelectionComparisonPhase
    || previousFilterIsStale
  ) {
    nextFilter = null;
  }
  if (
    centralMarkerSourcePlan !== null
    && input.acceptedComparisonEpisodeKey !== null
    && (input.candidateComparisonSceneActive || input.centralOverlayActive)
  ) {
    nextFilter = {
      episodeKey: input.acceptedComparisonEpisodeKey,
      satelliteIds: new Set(
        input.selectInstructions(centralMarkerSourcePlan.instructions)
          .map(instruction => instruction.satelliteId),
      ),
    };
  }
  const latchedCentralMarkerSatelliteIds = nextFilter !== null
    && nextFilter.episodeKey === input.acceptedComparisonEpisodeKey
    ? nextFilter.satelliteIds
    : null;
  const renderedCandidateSatelliteId = input.simSource === 'archived-tle'
    ? input.canonicalCandidateSatelliteId
    : input.sceneVisualActive
      ? null
      : input.primaryPendingTargetSatelliteId;
  let centralMarkerSatelliteIds: ReadonlySet<string> | null = null;
  if (
    (input.centralOverlayActive || input.candidateComparisonSceneActive)
    && centralMarkerSourcePlan !== null
  ) {
    centralMarkerSatelliteIds = latchedCentralMarkerSatelliteIds;
  } else if (input.sceneVisualActive && input.preSelectionComparisonPhase) {
    centralMarkerSatelliteIds = latchedCentralMarkerSatelliteIds;
  }
  const homepageCandidateStageLabelActive = input.homepageVisualIdentity
    && (input.candidateComparisonSceneActive || input.sceneVisualActive);
  const homepageCandidateStageVisibleSatelliteIds = homepageCandidateStageLabelActive
    ? centralMarkerSatelliteIds ?? input.candidateComparisonVisibleSatelliteIds
    : null;
  const homepageSatelliteLabelActive = input.homepageVisualIdentity;
  const satelliteCandidateLabelActive = input.candidateComparisonSceneActive
    || homepageCandidateStageLabelActive;
  const satelliteCandidateLabelVisibleSatelliteIds = input.candidateComparisonSceneActive
    ? input.candidateComparisonVisibleSatelliteIds
    : homepageCandidateStageVisibleSatelliteIds;
  return {
    centralMarkerSourcePlan,
    nextFilter,
    latchedCentralMarkerSatelliteIds,
    renderedCandidateSatelliteId,
    centralMarkerSatelliteIds,
    homepageCandidateStageLabelActive,
    homepageCandidateStageVisibleSatelliteIds,
    homepageSatelliteLabelActive,
    satelliteCandidateLabelActive,
    satelliteCandidateLabelVisibleSatelliteIds,
  };
}
