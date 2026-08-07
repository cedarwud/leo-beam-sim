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

export type { TeachingEnergyReadout } from './readout';

export {
  TEACHING_CLAIM_LABEL,
  TEACHING_ABSENT_DASH,
  TEACHING_ALLOWED_CLAIMS,
  TEACHING_FORBIDDEN_CLAIMS,
  HANDOVER_ENERGY_MODEL_NOTE,
  HANDOVER_ENERGY_ABSENT_NOTE,
} from './claimBoundary';
