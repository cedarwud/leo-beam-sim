export * from './types';
export {
  approvedTransmitGainLinear,
  computeAngleAwareEe,
  computeAdditiveSystemEe,
  computeCanonicalEe,
  computeCanonicalEeFrame,
} from './producer';
export {
  CanonicalEeAccumulator,
  CanonicalEeRatioOfSumsAccumulator,
  computeCanonicalEvaluation,
  computeCanonicalEvaluationFromTotals,
  evaluationEnergyEfficiency,
  evaluationEnergyEfficiencyFromTotals,
} from './accumulator';
export {
  CANONICAL_EE_CONFORMANCE_FIXTURES,
  CANONICAL_EE_EVALUATION_FIXTURE,
  type CanonicalEeConformanceExpected,
  type CanonicalEeConformanceFixture,
  type CanonicalEeFixtureResult,
} from './fixtures';
