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

/**
 * Floor on how long the comparison overlay stays visible once it turns on,
 * regardless of how quickly the real decision engine itself moves past its
 * pre-selection phase. Without this, the overlay's on-screen duration is
 * whatever the engine's own evaluation window happens to be — observed as
 * short as ~1-2s in live testing (several solid links flashing on, then gone
 * before a viewer can register there were candidates being compared at all).
 * That reads as "random lines appearing and vanishing for no reason," which
 * is a real usability problem on its own, independent of the homepage
 * teaching-lecture leaks this module's `teachingLectureActive` gate fixes.
 * 3s matches the low end of typical toast/flash-message minimum legibility
 * conventions — long enough to consciously register, short enough not to
 * linger past its relevance once the engine has already moved on.
 */
export const MULTI_CANDIDATE_COMPARISON_MIN_DISPLAY_HOLD_SEC = 3;

export interface MultiCandidateComparisonPolicyInput {
  readonly acceptedPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly simSource: MultiCandidateSceneSimulationSource;
  readonly sceneLane: SceneLane;
  readonly previousLatch: MultiCandidateComparisonLatch | null;
  readonly centralOverlayEnabled: boolean;
  /** Sim clock (seconds). Freezes the display hold while paused, same as the clock it measures against. */
  readonly nowSec: number;
  /** When the overlay's own minimum-display hold started this episode, or null if it is not currently holding. */
  readonly previousDisplayHoldSinceSec: number | null;
  /**
   * A homepage teaching lecture is open. `centralOverlayActive` is the ROOT
   * flag roughly thirty call sites in `MainScene.tsx` key off (cone items,
   * spine-particle plans, ground ripple, `SceneAcceptedHandoverCue`, ...) —
   * this authority evaluation runs continuously in the background regardless
   * of the lecture (see `HandoverTeachingBeamCones.tsx`'s own header), so
   * without this gate every one of those thirty sites independently risks
   * painting a real, un-teaching-related comparison overlay — several solid
   * links from the real serving satellite to the beams it is actually
   * evaluating — on top of the lecture's own two cones. Gating it once HERE,
   * at the source, is deliberate: `resolveMultiCandidatePresentationPolicy`'s
   * OWN `teachingLectureActive` gate (added first) only covers its own
   * `sceneVisualActive`/`candidateComparisonSceneActive` outputs, not this
   * sibling policy's `centralOverlayActive` — the two are computed
   * independently despite the similar names, and both feed downstream
   * renderers, so both need their own gate.
   */
  readonly teachingLectureActive: boolean;
}

export interface MultiCandidateComparisonPolicy {
  readonly acceptedDecision: HandoverDecisionFrame | null;
  readonly snapshotMatchesFrame: boolean;
  readonly authorityActive: boolean;
  readonly decisionAuthorityPresent: boolean;
  readonly rawComparisonPhase: boolean;
  readonly preSelectionComparisonPhase: boolean;
  readonly latchedComparisonPhase: boolean;
  /**
   * The raw signal (`rawComparisonPhase || latchedComparisonPhase`)
   * extended by the minimum-display hold — this is what `centralOverlayActive`
   * and every external consumer of `comparisonPhase` actually see, so the
   * hold applies everywhere this flag is read, not only inside this module.
   */
  readonly comparisonPhase: boolean;
  readonly centralOverlayActive: boolean;
  readonly nextLatch: MultiCandidateComparisonLatch | null;
  /** Pass back into `previousDisplayHoldSinceSec` on the next call. */
  readonly nextDisplayHoldSinceSec: number | null;
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
  const comparisonPhaseSignal = rawComparisonPhase || latchedComparisonPhase;

  let nextDisplayHoldSinceSec = input.previousDisplayHoldSinceSec;
  if (comparisonPhaseSignal && nextDisplayHoldSinceSec === null) {
    nextDisplayHoldSinceSec = input.nowSec;
  }
  const withinMinDisplayHold = nextDisplayHoldSinceSec !== null
    && input.nowSec - nextDisplayHoldSinceSec < MULTI_CANDIDATE_COMPARISON_MIN_DISPLAY_HOLD_SEC;
  const comparisonPhase = comparisonPhaseSignal || withinMinDisplayHold;
  if (!comparisonPhase) {
    nextDisplayHoldSinceSec = null;
  }

  const centralOverlayActive = !input.teachingLectureActive
    && authorityActive
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
    nextDisplayHoldSinceSec,
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
  /**
   * A homepage teaching lecture is open. This authority evaluation keeps
   * running in the background the whole time (the lecture is a display-only
   * overlay that never reads from or writes to it — see
   * `HandoverTeachingBeamCones.tsx`'s own header), so `authorityActive` and
   * `comparisonPhase` can flip through a real, independent candidate
   * comparison — several solid data-link lines from the real serving
   * satellite to the beams it is actually evaluating — while the lecture's
   * own two cones are on screen. Neither `sceneVisualActive` nor
   * `candidateComparisonSceneActive` may go true while this holds, the same
   * "clears the field for the whole run" rule every other natural layer
   * (`HandoverLinks`, `SpineParticles`, the `event-effects` cones) already
   * follows.
   */
  readonly teachingLectureActive: boolean;
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
  const candidateComparisonSceneActive = !input.teachingLectureActive
    && input.authorityActive
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
  const sceneVisualActive = !input.teachingLectureActive
    && input.centralOverlayEnabled
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
