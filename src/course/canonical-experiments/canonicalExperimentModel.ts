import type { SimulationAnalysisFrame, SimulatorParameters } from '../../simulator/types';

export type CanonicalExperimentKind = 'beam-layout' | 'frequency-reuse';

export interface CanonicalExperimentReceipt {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly instantUtc: string;
  readonly selectedSatelliteId: string;
  readonly constellation: string;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly contractVersion: string;
  readonly ueSubstrateId: string;
  readonly totalUeCount: number;
  readonly invariantKey: string;
}

export interface CanonicalExperimentObservation {
  readonly kind: CanonicalExperimentKind;
  readonly condition: number;
  readonly configuredBeamCount: number;
  readonly activeBeamCount: number;
  readonly frequencyReuse: number;
  readonly servedUeCount: number;
  readonly totalUeCount: number;
  readonly beamBandwidthMHz: number;
  readonly representativeInterferenceW: number;
  readonly representativeSinrDb: number;
  readonly totalRateMbps: number;
  readonly systemPowerW: number;
  readonly instantaneousEeMbitPerJ: number;
  readonly receipt: CanonicalExperimentReceipt;
}

function stableParameters(
  parameters: SimulatorParameters,
  kind: CanonicalExperimentKind,
): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(parameters)
      .filter(([key]) => kind !== 'frequency-reuse' || key !== 'frequencyReuse')
      .sort(([left], [right]) => left.localeCompare(right)),
  ));
}

/**
 * Identity of everything that must remain fixed while the learner changes the
 * declared control. The controlled value itself is intentionally absent.
 */
export function canonicalExperimentInvariantKey(
  frame: SimulationAnalysisFrame,
  kind: CanonicalExperimentKind,
): string {
  return JSON.stringify({
    instantUtc: frame.instantUtc,
    tleFrameId: frame.tleFrameId,
    selectedSatelliteId: frame.selectedSatelliteId,
    selectedTlePath: frame.provenance.selectedTlePath,
    contractVersion: frame.contractVersion,
    parameters: stableParameters(frame.parameters, kind),
    ueSubstrateId: frame.scenario.ueSubstrateId,
    users: frame.scenario.users.map(user => [user.userId, ...user.positionKm]),
    ...(kind === 'frequency-reuse' ? {
      beamLayout: frame.scenario.beamLayout.beamCount,
      beamCenters: frame.scenario.cells.map(cell => [cell.index, ...cell.centerKm]),
      servingBeamU: frame.inputs.frame.servingBeamU,
      beamActiveB: frame.inputs.frame.beamActiveB,
    } : {}),
  });
}

export function canonicalExperimentCondition(
  frame: SimulationAnalysisFrame,
  kind: CanonicalExperimentKind,
): number {
  return kind === 'beam-layout'
    ? frame.scenario.beamLayout.beamCount
    : frame.parameters.frequencyReuse;
}

export function canonicalExperimentObservation(
  frame: SimulationAnalysisFrame,
  kind: CanonicalExperimentKind,
): CanonicalExperimentObservation {
  const representative = frame.links[0];
  if (representative === undefined) {
    throw new Error('canonical experiment requires a representative serving link');
  }
  const totalUeCount = frame.canonical.throughput.qosMetU.length;
  if (totalUeCount === 0) {
    throw new Error('canonical experiment requires at least one UE result');
  }
  const invariantKey = canonicalExperimentInvariantKey(frame, kind);
  return Object.freeze({
    kind,
    condition: canonicalExperimentCondition(frame, kind),
    configuredBeamCount: frame.scenario.beamLayout.beamCount,
    activeBeamCount: frame.inputs.frame.beamActiveB.filter(Boolean).length,
    frequencyReuse: frame.parameters.frequencyReuse,
    servedUeCount: frame.canonical.throughput.qosMetU.filter(Boolean).length,
    totalUeCount,
    beamBandwidthMHz: frame.scenario.derived.beamBandwidthHz / 1_000_000,
    representativeInterferenceW: representative.interferenceW,
    representativeSinrDb: representative.sinrDb,
    totalRateMbps: frame.throughput.totalRateBps / 1_000_000,
    systemPowerW: frame.power.systemPowerW,
    instantaneousEeMbitPerJ: frame.ee.instantaneousBitsPerJ / 1_000_000,
    receipt: Object.freeze({
      frameId: frame.frameId,
      tleFrameId: frame.tleFrameId,
      instantUtc: frame.instantUtc,
      selectedSatelliteId: frame.selectedSatelliteId,
      constellation: frame.provenance.constellation,
      sourceKind: frame.provenance.sourceKind,
      propagationModel: frame.provenance.propagationModel,
      contractVersion: frame.contractVersion,
      ueSubstrateId: frame.scenario.ueSubstrateId,
      totalUeCount,
      invariantKey,
    }),
  });
}

export function acceptCanonicalExperimentObservation(
  existing: readonly CanonicalExperimentObservation[],
  observation: CanonicalExperimentObservation,
  expectedCondition: number,
): readonly CanonicalExperimentObservation[] {
  if (observation.condition !== expectedCondition) {
    throw new Error(`canonical frame condition ${observation.condition} does not match requested ${expectedCondition}`);
  }
  const first = existing[0];
  if (first !== undefined && first.receipt.invariantKey !== observation.receipt.invariantKey) {
    throw new Error('experiment invariant changed between canonical frames');
  }
  return Object.freeze([
    ...existing.filter(candidate => candidate.condition !== observation.condition),
    observation,
  ].sort((left, right) => left.condition - right.condition));
}

export function canonicalExperimentComplete(
  observations: readonly CanonicalExperimentObservation[],
  requiredConditions: readonly number[],
): boolean {
  return requiredConditions.every(condition => observations.some(observation => observation.condition === condition));
}
