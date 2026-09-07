export interface HandoverMarkerSatelliteIdsInput {
  readonly multiCandidateSceneVisualActive: boolean;
  readonly multiCandidateCentralMarkerSatelliteIds: ReadonlySet<string> | null;
  readonly renderedCandidateSatelliteId: string | null | undefined;
  readonly candidateComparisonSceneActive: boolean;
  readonly candidateReviewRenderPlanPresent: boolean;
  readonly candidateComparisonVisibleSatelliteIds: ReadonlySet<string> | null;
  readonly handoverCinemaCandidate: {
    readonly fromSatId: string;
    readonly toSatId: string;
  } | null | undefined;
  readonly authorityTransition: {
    readonly from: { readonly satelliteId: string };
    readonly to: { readonly satelliteId: string };
  } | null | undefined;
}

/** Collect the bounded set of spacecraft that must remain drawable for the story. */
export function resolveHandoverMarkerSatelliteIds(
  input: HandoverMarkerSatelliteIdsInput,
): ReadonlySet<string> {
  const ids = new Set<string>();
  if (input.multiCandidateSceneVisualActive) {
    for (const satelliteId of input.multiCandidateCentralMarkerSatelliteIds ?? []) {
      ids.add(satelliteId);
    }
  }
  if (input.renderedCandidateSatelliteId !== null && input.renderedCandidateSatelliteId !== undefined) {
    ids.add(input.renderedCandidateSatelliteId);
  }
  if (input.candidateComparisonSceneActive && input.candidateReviewRenderPlanPresent) {
    for (const satelliteId of input.candidateComparisonVisibleSatelliteIds ?? []) {
      ids.add(satelliteId);
    }
  }
  if (input.handoverCinemaCandidate !== null && input.handoverCinemaCandidate !== undefined) {
    ids.add(input.handoverCinemaCandidate.fromSatId);
    ids.add(input.handoverCinemaCandidate.toSatId);
  }
  const transition = input.authorityTransition;
  if (transition !== null && transition !== undefined) {
    ids.add(transition.from.satelliteId);
    ids.add(transition.to.satelliteId);
  }
  return ids;
}
