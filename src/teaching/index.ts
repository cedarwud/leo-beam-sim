/**
 * Canonical energy-efficiency exports shared by the active archived-TLE and
 * Walker simulator paths. Retired classroom models intentionally have no
 * compatibility exports here.
 */

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
