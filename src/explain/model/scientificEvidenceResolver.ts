import type { TleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { buildCausalProbeEvidence } from './causalProbeEvidence';
import { selectCanonicalTermValue } from './canonicalTermMap';
import { buildExplanatoryEvidence } from './explanatoryEvidence';
import { resolveServingChangeStory } from './servingChangeStoryEvidence';
import { parseScientificFixtureManifest } from './evidenceFixtureManifest';
import { withinScientificParityTolerance } from './scientificNumericParity';
import type {
  ResolveScientificStoryEvidenceInput,
  ScientificFixtureId,
  ScientificStoryEvidenceResult,
} from './types';

const RECOVERY = 'reload the accepted fixture inputs and rebuild the complete run';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function fail(fixtureId: ScientificFixtureId, reason: string): never {
  const error = new Error(reason) as Error & { fixtureId: ScientificFixtureId };
  error.fixtureId = fixtureId;
  throw error;
}

function validateSource(run: TleAnalysisRun, input: ResolveScientificStoryEvidenceInput): void {
  const { source } = input.manifest;
  if (run.geometryRunId !== source.geometryRunId
    || run.selection.catalog.constellation !== source.constellation
    || run.selection.catalog.archiveId !== source.archiveId
    || run.selection.catalog.archiveContentSha256 !== source.archiveContentSha256
    || run.selection.snapshot.metadata.archiveDate !== source.archiveDate
    || run.selection.snapshot.metadata.path !== source.snapshotPath
    || run.selection.snapshot.sha256 !== source.selectedTleSha256
    || run.geometryRun.getAnchorUtc(0) !== source.requestedInstantUtc
    || JSON.stringify(run.parameters) !== JSON.stringify(input.manifest.referenceParameters)) {
    fail('method-state-v1', 'reference run source does not match the accepted fixture');
  }
}

function validateMethodExpectedValues(
  evidence: ReturnType<typeof buildExplanatoryEvidence>,
  input: ResolveScientificStoryEvidenceInput,
): void {
  const expected = input.manifest.fixtures.method.expectedTerms;
  for (const [term, expectedValue] of Object.entries(expected) as [keyof typeof expected, number][]) {
    if (typeof expectedValue !== 'number' || !Number.isFinite(expectedValue)) {
      fail('method-state-v1', `method-state ${term} expected value is not finite`);
    }
    const selected = selectCanonicalTermValue(term, {
      run: evidence.run,
      frame: evidence.frame,
      identity: evidence.representativeLink,
    });
    if (selected.status === 'unavailable') fail('method-state-v1', `method-state ${term} is unavailable`);
    if (!withinScientificParityTolerance(selected.value, expectedValue)) {
      fail('method-state-v1', `method-state ${term} drifted from the accepted fixture`);
    }
  }
  const evaluation = input.manifest.fixtures.method.expectedEvaluation;
  const actual = evidence.run.evaluation;
  if (![evaluation.evaluationBitsPerJ, evaluation.deliveredBits, evaluation.consumedEnergyJ].every(Number.isFinite)
    || !withinScientificParityTolerance(actual.evaluationBitsPerJ, evaluation.evaluationBitsPerJ)
    || !withinScientificParityTolerance(actual.deliveredBits, evaluation.deliveredBits)
    || !withinScientificParityTolerance(actual.consumedEnergyJ, evaluation.consumedEnergyJ)
    || actual.durationS !== evaluation.durationS
    || actual.sampleCount !== evaluation.sampleCount
    || actual.aggregation !== evaluation.aggregation) {
    fail('method-state-v1', 'method-state run evaluation drifted from the accepted fixture');
  }
}

function validatePinnedRunAndFrame(
  fixtureId: ScientificFixtureId,
  run: TleAnalysisRun,
  expectedRunId: string,
  anchorIndex: number,
  expectedFrameId: string,
): void {
  if (run.analysisRunId !== expectedRunId) fail(fixtureId, `${fixtureId} analysis run identity mismatch`);
  if (run.getFrame(anchorIndex)?.frameId !== expectedFrameId) fail(fixtureId, `${fixtureId} frame identity mismatch`);
}

export function resolveScientificStoryEvidence(
  input: ResolveScientificStoryEvidenceInput,
): ScientificStoryEvidenceResult {
  try {
    const manifest = parseScientificFixtureManifest(input.manifest);
    const checkedInput = { ...input, manifest };
    validateSource(input.referenceRun, checkedInput);
    const fixtures = manifest.fixtures;
    validatePinnedRunAndFrame(
      'method-state-v1',
      input.referenceRun,
      fixtures.method.analysisRunId,
      fixtures.method.anchorIndex,
      fixtures.method.frameId,
    );
    const methodState = buildExplanatoryEvidence(
      input.referenceRun,
      fixtures.method.anchorIndex,
      fixtures.method.identity,
    );
    validateMethodExpectedValues(methodState, checkedInput);
    if (input.angleProbeRun === null) {
      return deepFreeze({
        status: 'unavailable',
        fixtureId: 'angle-response-v1',
        reason: 'accepted angle-response probe run is unavailable',
        recovery: RECOVERY,
      });
    }
    validatePinnedRunAndFrame('angle-response-v1', input.referenceRun,
      fixtures.angleResponse.referenceAnalysisRunId,
      fixtures.angleResponse.anchorIndex,
      fixtures.angleResponse.referenceFrameId);
    validatePinnedRunAndFrame('angle-response-v1', input.angleProbeRun,
      fixtures.angleResponse.probeAnalysisRunId,
      fixtures.angleResponse.anchorIndex,
      fixtures.angleResponse.probeFrameId);
    const angleResponse = buildCausalProbeEvidence(
      fixtures.angleResponse,
      buildExplanatoryEvidence(input.referenceRun, fixtures.angleResponse.anchorIndex, fixtures.angleResponse.identity),
      buildExplanatoryEvidence(input.angleProbeRun, fixtures.angleResponse.anchorIndex, fixtures.angleResponse.identity),
    );
    if (input.serviceTargetProbeRun === null) {
      return deepFreeze({
        status: 'unavailable',
        fixtureId: 'service-target-stress-v1',
        reason: 'accepted service-target probe run is unavailable',
        recovery: RECOVERY,
      });
    }
    validatePinnedRunAndFrame('service-target-stress-v1', input.referenceRun,
      fixtures.serviceTargetStress.referenceAnalysisRunId,
      fixtures.serviceTargetStress.anchorIndex,
      fixtures.serviceTargetStress.referenceFrameId);
    validatePinnedRunAndFrame('service-target-stress-v1', input.serviceTargetProbeRun,
      fixtures.serviceTargetStress.probeAnalysisRunId,
      fixtures.serviceTargetStress.anchorIndex,
      fixtures.serviceTargetStress.probeFrameId);
    const serviceTargetStress = buildCausalProbeEvidence(
      fixtures.serviceTargetStress,
      buildExplanatoryEvidence(input.referenceRun, fixtures.serviceTargetStress.anchorIndex, fixtures.serviceTargetStress.identity),
      buildExplanatoryEvidence(input.serviceTargetProbeRun, fixtures.serviceTargetStress.anchorIndex, fixtures.serviceTargetStress.identity),
    );
    const servingChange = resolveServingChangeStory(input.referenceRun, fixtures.servingChange);
    if (servingChange.status === 'unavailable') fail('serving-change-v1', servingChange.reason);
    return deepFreeze({
      status: 'available',
      evidence: { methodState, angleResponse, serviceTargetStress, servingChange: servingChange.evidence },
    });
  } catch (error) {
    const candidate = error as Error & { fixtureId?: ScientificFixtureId };
    return deepFreeze({
      status: 'unavailable',
      fixtureId: candidate.fixtureId ?? 'method-state-v1',
      reason: candidate.message,
      recovery: RECOVERY,
    });
  }
}
