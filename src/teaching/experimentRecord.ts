export interface ExperimentRecord {
  experimentId: string;
  scenarioIdentity: string;
  windowId: string;
  windowStartSec: number;
  windowEndSec: number;
  changedInput: string | null;
  unchangedInputs: string | null;
  units: Record<string, string> | null;
  absenceReason: string | null;
  interpretation: string | null;
  tradeoff: string | null;
  limitation: string | null;

  // T1
  paEfficiency: number | null;
  rfOutput: number | null;
  paInput: number | null;
  circuitPower: number | null;
  totalPower: number | null;
  scopeStatus: string | null;

  // T2
  energyKnobs: string | null;
  paPower: number | null;
  handoverEnergy: number | null;
  handoverCount: number | null;
  radioEnergy: number | null;
  totalEnergy: number | null;
  runEe: number | null;
  lowSinr: number | null;

  // T3
  txPower: number | null;
  bandwidth: number | null;
  reuseFactor: number | null;
  load: number | null;
  sinr: number | null;
  throughput: number | null;
  data: number | null;
  serviceStatus: string | null;

  // T4
  beforeParams: string | null;
  afterParams: string | null;
  dataT4: number | null;
  energyT4: number | null;
  windowIdT4: string | null;
  simulationClock: number | null;
  playbackState: string | null;

  // T5
  explicitStateStatus: string | null;

  // T6
  producerStatus: string | null;
  systemPower: number | null;
  instantaneousEe: number | null;
  perUserContributionSum: number | null;
  ratioOfSums: number | null;
  sampleWindow: string | null;
  actualRf: number | null;
  ratedRf: number | null;
  serviceBeam: string | null;
}
