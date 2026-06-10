export type ModqnReplaySourceGapField =
  | 'beamHopping.activeSchedule'
  | 'beamHopping.nextSchedule'
  | 'entities.ues.positionTrace'
  | 'entities.satellites.trajectory'
  | 'entities.beams.footprints'
  | 'timeline.sourceRowIdentity'
  | 'timeline.focusUeSelection'
  | 'timeline.activeCellState'
  | 'timeline.allUeServingHistory'
  | 'timeline.handoverPenaltyAttribution'
  | 'timeline.frequencyReuseGroups'
  | 'metrics.angleAwareTerms'
  | 'metrics.energyEfficiencyTerms'
  | 'metrics.reward'
  | 'diagnostics.policy'
  | 'diagnostics.denseQPolicy'
  | 'traffic.queueRows'
  | 'comparison.alignedTimebase'
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
  | 'no-stable-source-row-proof'
  | 'no-producer-focus-ue-selection'
  | 'no-active-cell-state'
  | 'no-all-ue-serving-map'
  | 'no-handover-penalty-attribution'
  | 'no-physical-satellite-path'
  | 'no-physical-beam-footprint'
  | 'no-frequency-coloring'
  | 'no-angle-aware-per-step-claim'
  | 'no-energy-efficiency-per-step-claim'
  | 'no-reward-proof'
  | 'no-policy-diagnostics-proof'
  | 'no-dense-q-proof'
  | 'no-producer-queue-proof'
  | 'no-comparison-alignment-proof'
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
  'timeline.sourceRowIdentity',
  'timeline.focusUeSelection',
  'timeline.activeCellState',
  'timeline.allUeServingHistory',
  'timeline.handoverPenaltyAttribution',
  'timeline.frequencyReuseGroups',
  'metrics.angleAwareTerms',
  'metrics.energyEfficiencyTerms',
  'metrics.reward',
  'diagnostics.policy',
  'diagnostics.denseQPolicy',
  'traffic.queueRows',
  'comparison.alignedTimebase',
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
      field: 'timeline.sourceRowIdentity',
      surface: 'timeline',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].sourceRowId or stable producer row identifier',
      claimImpact: 'no-stable-source-row-proof',
      note: 'Display row numbers are not enough for cross-artifact replay and comparison evidence.',
    }),
    gap({
      field: 'timeline.focusUeSelection',
      surface: 'focus-panel',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].focusUeId and timeline[].focusReason',
      claimImpact: 'no-producer-focus-ue-selection',
      note: 'The UI may display-select a focus UE, but producer focus selection needs explicit trace fields.',
    }),
    gap({
      field: 'timeline.activeCellState',
      surface: 'viewport',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].cells[].active or timeline[].activeCellSchedule',
      claimImpact: 'no-active-cell-state',
      note: 'Active/inactive cells in replay proof require producer scheduler state, not serving identity.',
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
      field: 'timeline.handoverPenaltyAttribution',
      surface: 'angle-energy-panel',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].handoverEvent.penalty or timeline[].reward.handoverPenaltyTerm',
      claimImpact: 'no-handover-penalty-attribution',
      note: 'Inter/intra penalty attribution must come from the producer reward trace.',
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
    gap({
      field: 'diagnostics.denseQPolicy',
      surface: 'evidence-panel',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].policyDiagnostics.objectiveQByAction + scalarizedQByAction + selectedActionIndex + tieBreak + invalidActionSentinel',
      claimImpact: 'no-dense-q-proof',
      note: 'Dense-Q proof and counterfactual weight controls stay disabled until full per-action Q1/Q2/Q3, mask, selected action, tie-break, and sentinel are exported.',
    }),
    gap({
      field: 'traffic.queueRows',
      surface: 'evidence-panel',
      reason: 'not-yet-exported',
      owner: 'modqn-paper-reproduction',
      policy: 'fail-closed',
      requiredProducerField: 'timeline[].ues[].queueBeforeBits + trafficArrivalBits + servedBits + queueAfterBits + serviceRateBps',
      claimImpact: 'no-producer-queue-proof',
      note: 'Producer replay queue proof requires per-UE queue rows and conservation fields; live-service-demo queue state must not fill this MODQN proof gap.',
    }),
  ];
}

export function sourceGapCountByPolicy(
  gaps: readonly ModqnReplaySourceGap[],
  policy: ModqnReplaySourceGapPolicy,
): number {
  return gaps.filter(gapItem => gapItem.policy === policy).length;
}
