/**
 * Unified export surface for the teaching energy model layer. Other agents
 * should import from `src/teaching` (this file), not reach into the
 * individual module files directly.
 */

export {
  DEFAULT_ENERGY_PER_HANDOVER_J,
  DEFAULT_ENERGY_TUNING,
  ENERGY_TUNING_RANGES,
  computePowerTrain,
  computeTeachingThroughputMbps,
  resolveEnergyPerHandoverJ,
  type EnergyTuningState,
  type PowerTrainBreakdown,
  type TeachingThroughputArgs,
} from './energyModel';

export {
  CANONICAL_EE_UNITS,
  CanonicalEeInputError,
  computeEvaluationEe,
  computeEvaluationEeFromTotals,
  computeInstantaneousEe,
  sumInstantaneousPowerW,
  type CanonicalEeInputErrorCode,
  type EvaluationEeResult,
  type EvaluationEeStep,
  type EvaluationEeTotals,
  type InstantaneousEeInput,
  type InstantaneousEeResult,
  type InstantaneousPowerComponent,
} from './canonicalEnergyEfficiency';

export {
  DEFAULT_LOW_SINR_THRESHOLD_DB,
  DEFAULT_MAX_SAMPLE_GAP_SEC,
  EMPTY_ENERGY_LEDGER,
  advanceEnergyLedger,
  computeHandoverEnergyJ,
  computeLowSinrRatioPct,
  computeRunEeMbitPerJ,
  computeTotalEnergyJ,
  getEnergyLedgerResetKey,
  type EnergyLedgerState,
  type EnergyLedgerSample,
} from './energyLedger';

// The live BeamShift canonical producer is exposed here for the controller's
// eventual frame bridge. App intentionally does not synthesize its required
// SinrLiveCellFrame from the teaching SimState summary.
export {
  BEAMSHIFT_CANONICAL_EE_SCOPE,
  BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS,
  BeamshiftCanonicalEeAccumulator,
  BeamshiftCanonicalEeInputError,
  computeBeamshiftCanonicalEe,
  type BeamshiftCanonicalBeamPower,
  type BeamshiftCanonicalEeInput,
  type BeamshiftCanonicalEeInputErrorCode,
  type BeamshiftCanonicalEvaluationSnapshot,
  type BeamshiftCanonicalInstantaneousEe,
  type BeamshiftCanonicalUeContribution,
  type BeamshiftCanonicalUeStatus,
} from './beamshiftCanonicalEe';

export type { TeachingEnergyReadout } from './readout';

export {
  TEACHING_CLAIM_LABEL,
  TEACHING_ABSENT_DASH,
  TEACHING_ALLOWED_CLAIMS,
  TEACHING_FORBIDDEN_CLAIMS,
  HANDOVER_ENERGY_MODEL_NOTE,
  HANDOVER_ENERGY_ABSENT_NOTE,
} from './claimBoundary';

export {
  CLASSROOM_BASELINE_TX_POWER_DBM,
  CLASSROOM_CANDIDATE_TX_POWER_DBM,
  CLASSROOM_ENERGY_COMPARISON_THRESHOLDS,
  COURSE_ENERGY_COMPARISON_THRESHOLDS,
  compareClassroomEnergyArms,
  type ClassroomEnergyComparisonArm,
  type ClassroomEnergyComparisonArmRole,
  type ClassroomEnergyComparisonGate,
  type ClassroomEnergyComparisonGates,
  type ClassroomEnergyComparisonReasonCode,
  type ClassroomEnergyComparisonResult,
  type ClassroomEnergyComparisonThresholds,
} from './energyComparison';

export type { ExperimentRecord } from './experimentRecord';
