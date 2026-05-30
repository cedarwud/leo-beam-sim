export type ModqnReplaySourceGapField =
  | 'beamHopping.activeSchedule'
  | 'beamHopping.nextSchedule'
  | 'entities.ues.positionTrace'
  | 'entities.satellites.trajectory'
  | 'entities.beams.footprints'
  | 'timeline.allUeServingHistory'
  | 'timeline.frequencyReuseGroups'
  | 'metrics.angleAwareTerms'
  | 'metrics.energyEfficiencyTerms'
  | 'metrics.reward'
  | 'diagnostics.policy'
  | 'provenance.claimBoundary';

export type ModqnReplaySourceGapSurface =
  | 'viewport'
  | 'focus-panel'
  | 'angle-energy-panel'
  | 'timeline'
  | 'comparison'
  | 'evidence-panel'
  | 'canvas-telemetry';

export type ModqnReplaySourceGapReason =
  | 'missing'
  | 'not-yet-exported'
  | 'non-renderable-frame'
  | 'display-only-provenance'
  | 'incompatible-lane-source';

export type ModqnReplaySourceGapPolicy = 'fail-closed' | 'summary-only';
export type ModqnReplaySourceGapOwner = 'modqn-paper-reproduction' | 'ntn-sim-core';
export type ModqnReplaySourceGapClaimImpact =
  | 'no-beam-hopping-animation'
  | 'no-next-beam-preview'
  | 'no-all-ue-serving-map'
  | 'no-physical-satellite-path'
  | 'no-physical-beam-footprint'
  | 'no-frequency-coloring'
  | 'no-angle-aware-per-step-claim'
  | 'no-energy-efficiency-per-step-claim'
  | 'no-reward-proof'
  | 'no-policy-diagnostics-proof'
  | 'no-evidence-promotion';

export interface ModqnReplaySourceGap {
  readonly field: ModqnReplaySourceGapField;
  readonly surface: ModqnReplaySourceGapSurface;
  readonly reason: ModqnReplaySourceGapReason;
  readonly owner: ModqnReplaySourceGapOwner;
  readonly policy: ModqnReplaySourceGapPolicy;
  readonly requiredProducerField: string;
  readonly claimImpact: ModqnReplaySourceGapClaimImpact;
  readonly note: string;
}

export const MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS = [
  'selectedServing',
  'previousServing',
  'actionValidityMask',
  'decisionActionValidityMask',
] as const;

export type ModqnReplayForbiddenBeamHoppingTruthField =
  typeof MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS[number];

export const MODQN_REPLAY_SOURCE_GAP_FIELDS = [
  'beamHopping.activeSchedule',
  'beamHopping.nextSchedule',
  'entities.ues.positionTrace',
  'entities.satellites.trajectory',
  'entities.beams.footprints',
  'timeline.allUeServingHistory',
  'timeline.frequencyReuseGroups',
  'metrics.angleAwareTerms',
  'metrics.energyEfficiencyTerms',
  'metrics.reward',
  'diagnostics.policy',
  'provenance.claimBoundary',
] as const satisfies readonly ModqnReplaySourceGapField[];

export const MODQN_REPLAY_SOURCE_GAP_SURFACES = [
  'viewport',
  'focus-panel',
  'angle-energy-panel',
  'timeline',
  'comparison',
  'evidence-panel',
  'canvas-telemetry',
] as const satisfies readonly ModqnReplaySourceGapSurface[];

export function isForbiddenBeamHoppingTruthAlias(
  value: string,
): value is ModqnReplayForbiddenBeamHoppingTruthField {
  return MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS.includes(
    value as ModqnReplayForbiddenBeamHoppingTruthField,
  );
}

function gap(input: ModqnReplaySourceGap): ModqnReplaySourceGap {
  return input;
}

export function createCurrentModqnReplayProofSourceGaps(): readonly ModqnReplaySourceGap[] {
  return [
    gap({
      field: 'beamHopping.activeSchedule',
      surface: 'viewport',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].activeBeamSchedule or timeline[].activeBeamMask',
      claimImpact: 'no-beam-hopping-animation',
      note: 'The replay proof lane must not animate active/inactive beams until the producer exports scheduler truth.',
    }),
    gap({
      field: 'beamHopping.nextSchedule',
      surface: 'viewport',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].nextActiveBeamSchedule or producer lookahead schedule',
      claimImpact: 'no-next-beam-preview',
      note: 'The replay proof lane must not show next-beam preview without producer lookahead truth.',
    }),
    gap({
      field: 'timeline.allUeServingHistory',
      surface: 'focus-panel',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].ues[].serving',
      claimImpact: 'no-all-ue-serving-map',
      note: 'The current playback shell exposes the focused row, not every UE serving state at every step.',
    }),
    gap({
      field: 'entities.satellites.trajectory',
      surface: 'viewport',
      reason: 'non-renderable-frame',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].satellites[].position in a renderable producer frame',
      claimImpact: 'no-physical-satellite-path',
      note: 'Proxy satellite frames may support display markers but do not prove real trajectory truth.',
    }),
    gap({
      field: 'entities.beams.footprints',
      surface: 'viewport',
      reason: 'display-only-provenance',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].beams[].footprint with producer-owned angle convention',
      claimImpact: 'no-physical-beam-footprint',
      note: 'Display-only footprint provenance cannot be promoted to physical beam geometry proof.',
    }),
    gap({
      field: 'metrics.angleAwareTerms',
      surface: 'angle-energy-panel',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].angleAwareTerms',
      claimImpact: 'no-angle-aware-per-step-claim',
      note: 'Angle-aware labels require producer-exported off-axis angle, gain, steering loss, or equivalent terms.',
    }),
    gap({
      field: 'metrics.energyEfficiencyTerms',
      surface: 'angle-energy-panel',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].energyEfficiencyTerms',
      claimImpact: 'no-energy-efficiency-per-step-claim',
      note: 'Energy-efficiency story must remain unavailable until producer exports per-step energy terms.',
    }),
  ];
}

export function sourceGapCountByPolicy(
  gaps: readonly ModqnReplaySourceGap[],
  policy: ModqnReplaySourceGapPolicy,
): number {
  return gaps.filter(gapItem => gapItem.policy === policy).length;
}
