export type MultiCandidateSceneRenderStatus =
  | 'active'
  | 'inactive'
  | 'no-accepted-snapshot'
  | 'source-frame-mismatch'
  | 'below-comparison-threshold'
  | 'switching'
  | 'phase-not-comparison'
  | 'missing-scene-plan'
  | 'unmapped-pairs';

export interface MultiCandidateSceneRenderStatusInput {
  readonly hasAcceptedSnapshot: boolean;
  readonly sourceFrameMatches: boolean;
  readonly decisionPhase: string | null;
  readonly hardEligibleCount: number;
  readonly comparisonPhase: boolean;
  readonly hasScenePlan: boolean;
  readonly unmappedPairCount: number;
}

/** Resolve the diagnostic status for the mounted multi-candidate projection. */
export function resolveMultiCandidateSceneRenderStatus(
  input: MultiCandidateSceneRenderStatusInput,
): MultiCandidateSceneRenderStatus {
  if (!input.hasAcceptedSnapshot) return 'no-accepted-snapshot';
  if (!input.sourceFrameMatches) return 'source-frame-mismatch';
  if (input.decisionPhase === 'switching') return 'switching';
  if (input.hardEligibleCount < 2) return 'below-comparison-threshold';
  if (!input.comparisonPhase) return 'phase-not-comparison';
  if (!input.hasScenePlan) return 'missing-scene-plan';
  if (input.unmappedPairCount > 0) return 'unmapped-pairs';
  return 'active';
}
