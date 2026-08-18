import type { TleAnalysisRun } from '../../simulator/tleAnalysisRun';
import type { SimulatorParameters } from '../../simulator/types';
import { selectPairRepresentativeLinkV2 } from './representativeLink';
import { selectCanonicalTermValue } from './canonicalTermMap';
import { digestSimulatorParameters } from './parameterDigest';
import { withinScientificParityTolerance } from './scientificNumericParity';
import type {
  CausalProbeCapChecks,
  CausalProbeEvidence,
  ExplanatoryEvidence,
  ProbeFixtureManifest,
} from './types';
import type { CanonicalTermKey } from './types';

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parameterDifferenceKeys(
  reference: SimulatorParameters,
  probe: SimulatorParameters,
): readonly (keyof SimulatorParameters)[] {
  return (Object.keys(reference) as (keyof SimulatorParameters)[])
    .filter(key => reference[key] !== probe[key]);
}

function sameIdentitySequence(reference: TleAnalysisRun, probe: TleAnalysisRun): boolean {
  return reference.anchorSelections.length === probe.anchorSelections.length
    && reference.anchorSelections.every((anchor, index) => {
    const other = probe.anchorSelections[index];
    return other !== undefined
      && anchor.selectedSatelliteId === other.selectedSatelliteId
      && anchor.candidateSatelliteId === other.candidateSatelliteId
      && anchor.selectionKind === other.selectionKind;
    });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function validateExpectedTerms(
  fixtureLabel: string,
  evidence: ExplanatoryEvidence,
  expected: Readonly<Partial<Record<CanonicalTermKey, number>>>,
): void {
  for (const [term, expectedValue] of Object.entries(expected) as [CanonicalTermKey, number][]) {
    if (typeof expectedValue !== 'number' || !Number.isFinite(expectedValue)) {
      throw new Error(`${fixtureLabel} ${term} expected value is not finite`);
    }
    const selected = selectCanonicalTermValue(term, {
      run: evidence.run,
      frame: evidence.frame,
      identity: evidence.representativeLink,
    });
    if (selected.status === 'unavailable') throw new Error(`${fixtureLabel} expected ${term} is unavailable`);
    if (!withinScientificParityTolerance(selected.value, expectedValue)) {
      throw new Error(`${fixtureLabel} ${term} drifted from the accepted fixture`);
    }
  }
}

function capChecks(
  fixture: ProbeFixtureManifest,
  reference: ExplanatoryEvidence,
  probe: ExplanatoryEvidence,
): CausalProbeCapChecks {
  if (fixture.fixtureId !== 'service-target-stress-v1') {
    return Object.freeze({
      capToleranceW: null,
      allBeamCapsNonBinding: null,
      satelliteCapNonBinding: null,
      allSatelliteScalesOne: null,
      allUsersNotPowerLimited: null,
      allNonBinding: true,
    });
  }
  const tolerance = fixture.capToleranceW;
  if (tolerance === null || !(tolerance > 0)) throw new Error('service-target cap tolerance is invalid');
  const frames = [reference.frame, probe.frame];
  const allBeamCapsNonBinding = frames.every(frame => frame.canonical.power.pReqBW.every(
    value => value < frame.parameters.beamPowerCapW - tolerance,
  ));
  const satelliteCapNonBinding = frames.every(frame => {
    const totals = new Map<number, number>();
    frame.canonical.power.pDlBeforeSatelliteCapBW.forEach((value, beamId) => {
      const satelliteId = frame.inputs.frame.beamSatelliteB[beamId];
      if (satelliteId !== undefined) totals.set(satelliteId, (totals.get(satelliteId) ?? 0) + value);
    });
    return [...totals.values()].every(total => total < frame.parameters.satellitePowerCapW - tolerance);
  });
  const allSatelliteScalesOne = frames.every(frame => frame.canonical.power.satelliteScaleB.every(value => value === 1));
  const allUsersNotPowerLimited = frames.every(frame => frame.canonical.throughput.powerLimitedU.every(value => value === false));
  return Object.freeze({
    capToleranceW: tolerance,
    allBeamCapsNonBinding,
    satelliteCapNonBinding,
    allSatelliteScalesOne,
    allUsersNotPowerLimited,
    allNonBinding: allBeamCapsNonBinding
      && satelliteCapNonBinding
      && allSatelliteScalesOne
      && allUsersNotPowerLimited,
  });
}

export function buildCausalProbeEvidence(
  fixture: ProbeFixtureManifest,
  reference: ExplanatoryEvidence,
  probe: ExplanatoryEvidence,
): CausalProbeEvidence {
  const fixtureLabel = fixture.fixtureId;
  if (digestSimulatorParameters(reference.run.parameters) !== fixture.referenceParameterDigest
    || digestSimulatorParameters(probe.run.parameters) !== fixture.probeParameterDigest) {
    throw new Error(`${fixtureLabel} parameter digest mismatch`);
  }
  if (reference.run.geometryRunId !== probe.run.geometryRunId) throw new Error(`${fixtureLabel} geometry run mismatch`);
  if (reference.run.geometryRunId !== reference.frame.runAnchor?.geometryRunId) throw new Error(`${fixtureLabel} reference frame/run mismatch`);
  if (probe.run.geometryRunId !== probe.frame.runAnchor?.geometryRunId) throw new Error(`${fixtureLabel} probe frame/run mismatch`);
  if (reference.frame.tleFrameId !== probe.frame.tleFrameId
    || reference.frame.instantUtc !== probe.frame.instantUtc
    || reference.frame.provenance.constellation !== probe.frame.provenance.constellation
    || reference.frame.provenance.archiveId !== probe.frame.provenance.archiveId
    || reference.frame.provenance.selectedTlePath !== probe.frame.provenance.selectedTlePath
    || reference.run.selection.catalog.archiveContentSha256 !== probe.run.selection.catalog.archiveContentSha256
    || reference.run.selection.snapshot.sha256 !== probe.run.selection.snapshot.sha256
    || reference.run.selection.snapshot.metadata.archiveDate !== probe.run.selection.snapshot.metadata.archiveDate
    || reference.run.selection.snapshot.metadata.path !== probe.run.selection.snapshot.metadata.path
    || reference.run.geometryRun.archiveId !== probe.run.geometryRun.archiveId
    || reference.run.geometryRun.publicationSha256 !== probe.run.geometryRun.publicationSha256
    || reference.run.geometryRun.t0Utc !== probe.run.geometryRun.t0Utc) {
    throw new Error(`${fixtureLabel} source or TLE frame mismatch`);
  }
  const pairIdentity = selectPairRepresentativeLinkV2(reference.frame, probe.frame, fixture.identity);
  if (pairIdentity.status === 'unavailable') throw new Error(`${fixtureLabel} identity mismatch: ${pairIdentity.reason}`);
  if (pairIdentity.thetaRad !== pairIdentity.probeThetaRad) throw new Error(`${fixtureLabel} off-axis angle mismatch`);
  const differences = parameterDifferenceKeys(reference.frame.parameters, probe.frame.parameters);
  if (differences.length !== 1 || differences[0] !== fixture.control.parameterKey) {
    throw new Error(`${fixtureLabel}: only ${fixture.control.parameterKey} may change`);
  }
  if (reference.frame.parameters[fixture.control.parameterKey] !== fixture.control.referenceValue
    || probe.frame.parameters[fixture.control.parameterKey] !== fixture.control.probeValue) {
    throw new Error(`${fixtureLabel} control values do not match the accepted manifest`);
  }
  if (fixture.fixtureId === 'angle-response-v1' && fixture.control.parameterKey !== 'theta3dbRad') {
    throw new Error('angle-response-v1 must control theta3dbRad');
  }
  if (fixture.fixtureId === 'service-target-stress-v1'
    && (fixture.control.parameterKey !== 'minimumRateBps'
      || fixture.control.referenceValue !== 1_000_000
      || fixture.control.probeValue !== 10_000_000)) {
    throw new Error('service-target-stress-v1 must control 1-to-10 Mbit/s minimumRateBps');
  }
  if (!sameJson(reference.frame.inputs.frame.thetaRadUb, probe.frame.inputs.frame.thetaRadUb)
    || !sameJson(reference.frame.inputs.frame.propagationGainUb, probe.frame.inputs.frame.propagationGainUb)
    || !sameJson(reference.frame.inputs.frame.receiveGainUb, probe.frame.inputs.frame.receiveGainUb)
    || !sameJson(reference.frame.inputs.frame.servingBeamU, probe.frame.inputs.frame.servingBeamU)
    || !sameJson(reference.frame.inputs.frame.beamLoadB, probe.frame.inputs.frame.beamLoadB)
    || !sameJson(reference.frame.inputs.frame.beamSatelliteB, probe.frame.inputs.frame.beamSatelliteB)) {
    throw new Error(`${fixtureLabel} geometry, gain, load, or assignment invariant mismatch`);
  }
  const caps = capChecks(fixture, reference, probe);
  if (!caps.allNonBinding) throw new Error(`${fixtureLabel} RF cap gate is binding`);
  validateExpectedTerms(`${fixtureLabel} reference`, reference, fixture.expectedReferenceTerms);
  validateExpectedTerms(`${fixtureLabel} probe`, probe, fixture.expectedProbeTerms);
  const fullSequenceEqual = sameIdentitySequence(reference.run, probe.run);
  const eeEval = fixture.eeEvalPolicy === 'include-only-if-full-sequence-equal' && fullSequenceEqual
    ? Object.freeze({
        status: 'included' as const,
        referenceValue: reference.run.evaluation.evaluationBitsPerJ,
        probeValue: probe.run.evaluation.evaluationBitsPerJ,
        unit: 'bit/J' as const,
      })
    : Object.freeze({
        status: 'excluded' as const,
        reason: fixture.eeEvalPolicy === 'exclude-frame-scoped'
          ? 'the accepted first comparison is frame-scoped'
          : 'the complete serving/candidate identity sequence differs',
      });
  return deepFreeze({
    fixtureId: fixture.fixtureId,
    probeId: fixture.fixtureId,
    control: fixture.control,
    identity: fixture.identity,
    reference,
    probe,
    capChecks: caps,
    eeEval,
  });
}
