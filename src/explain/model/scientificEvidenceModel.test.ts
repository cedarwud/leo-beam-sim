import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { buildTleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { buildTleRunBundle } from '../../tle/run';
import {
  ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  CANONICAL_CAUSAL_EDGE_REGISTRY,
  CANONICAL_TERM_DEFINITIONS,
  CANONICAL_TERM_REGISTRY,
  CANONICAL_TERM_KEYS,
  buildCausalProbeEvidence,
  buildExplanatoryEvidence,
  deriveCanonicalTermDeltas,
  digestSimulatorParameters,
  parseScientificFixtureManifest,
  resolveScientificStoryEvidence,
  resolveServingChangeStory,
  selectCanonicalTermValue,
  selectPairRepresentativeLinkV2,
  selectRepresentativeLinkV2,
  scientificParityTolerance,
  withinScientificParityTolerance,
} from './index';
import type { CanonicalTermKey } from './types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const instantUtc = '2026-08-07T23:59:59.000Z';
const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const geometryRun = await buildTleRunBundle({ selection, t0Utc: instantUtc, yieldEveryAnchors: 241 });
const referenceRun = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
const angleRun = referenceRun.withParameters({
  ...DEFAULT_SIMULATOR_PARAMETERS,
  theta3dbRad: 4 * Math.PI / 180,
});
const serviceTargetRun = referenceRun.withParameters({
  ...DEFAULT_SIMULATOR_PARAMETERS,
  minimumRateBps: 10_000_000,
});

const manifest = parseScientificFixtureManifest(ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST);
assert.equal(manifest.status, 'ACCEPTED');
assert.equal(manifest.fixtures.angleResponse.fixtureId, 'angle-response-v1');
assert.equal(manifest.fixtures.serviceTargetStress.fixtureId, 'service-target-stress-v1');
assert.equal(manifest.fixtures.servingChange.eventId, 'tle-event-v1-e9303f64');
assert.equal(withinScientificParityTolerance(0.0092330704927, 0.00923307049223942), true);
assert.equal(withinScientificParityTolerance(0.0092330706, 0.00923307049223942), false);
assert.equal(withinScientificParityTolerance(5e-19, 0), true);
assert.equal(withinScientificParityTolerance(1e-12, 0), false);
assert.equal(scientificParityTolerance(5.666452889890504e-12) < 1e-20, true);

const shallowFrozenManifest = Object.freeze({
  ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  source: { ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.source },
  fixtures: {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
    method: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method,
      expectedTerms: { ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method.expectedTerms },
    },
  },
});
const recursivelyFrozenManifest = parseScientificFixtureManifest(shallowFrozenManifest);
assert.ok(Object.isFrozen(recursivelyFrozenManifest.source));
assert.ok(Object.isFrozen(recursivelyFrozenManifest.fixtures.method));
assert.ok(Object.isFrozen(recursivelyFrozenManifest.fixtures.method.expectedTerms));

assert.throws(
  () => parseScientificFixtureManifest({
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    status: 'PENDING_FRESH_CONTEXT_REVIEW',
  }),
  /fixture manifest must be accepted/,
);
assert.throws(
  () => parseScientificFixtureManifest({
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      angleResponse: undefined,
    },
  }),
  /angle-response-v1/,
);
assert.throws(
  () => parseScientificFixtureManifest({
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      method: {
        ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method,
        expectedTerms: undefined,
      },
    },
  }),
  /method-state-v1\.expectedTerms must be an object/,
);
for (const malformed of [
  {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      method: { ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method, anchorIndex: undefined },
    },
  },
  {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      angleResponse: { ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.angleResponse, control: {} },
    },
  },
  {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      servingChange: { fixtureId: 'serving-change-v1' },
    },
  },
  {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    secondarySource: {
      fixtureId: 'constellation-switch-starlink-v1',
      claimBoundary: 'constellation-switch-only-not-performance-comparison',
      constellation: 'starlink',
    },
  },
  {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      angleResponse: {
        ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.angleResponse,
        expectedReferenceTerms: {},
      },
    },
  },
  {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      method: {
        ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method,
        expectedTerms: {
          ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method.expectedTerms,
          systemPower: 'bogus',
        },
      },
    },
  },
]) assert.throws(() => parseScientificFixtureManifest(malformed));
assert.throws(
  () => parseScientificFixtureManifest({ ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST, unexpected: true }),
  /unknown or missing fields/,
);
assert.throws(
  () => parseScientificFixtureManifest({
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    source: { ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.source, unexpected: true },
  }),
  /source contains unknown or missing fields/,
);
assert.throws(
  () => parseScientificFixtureManifest({
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    negativeFixtureIds: [...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.negativeFixtureIds, 'unexpected-negative'],
  }),
  /required negative fixtures are missing/,
);
assert.throws(
  () => parseScientificFixtureManifest({
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
    fixtures: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
      method: { ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method, anchorIndex: 999 },
    },
  }),
  /must be within the accepted run/,
);

assert.equal(
  digestSimulatorParameters(referenceRun.parameters),
  manifest.fixtures.angleResponse.referenceParameterDigest,
);

const methodFrame = referenceRun.getFrame(manifest.fixtures.method.anchorIndex);
assert.ok(methodFrame);
const methodSelection = selectRepresentativeLinkV2(methodFrame!);
assert.deepEqual(methodSelection, {
  status: 'available',
  selectorVersion: 'representative-link-v2',
  satelliteId: '55796',
  beamId: 1,
  userIndex: 29,
  userId: 'ue-30',
  thetaRad: 0.011240719179150774,
  rateBps: 999978.2437959356,
});

const angleReferenceFrame = referenceRun.getFrame(manifest.fixtures.angleResponse.anchorIndex);
const angleProbeFrame = angleRun.getFrame(manifest.fixtures.angleResponse.anchorIndex);
assert.ok(angleReferenceFrame && angleProbeFrame);
const anglePairSelection = selectPairRepresentativeLinkV2(
  angleReferenceFrame!,
  angleProbeFrame!,
  manifest.fixtures.angleResponse.identity,
);
assert.equal(anglePairSelection.status, 'available');
if (anglePairSelection.status === 'available') {
  assert.equal(anglePairSelection.userId, 'ue-30');
  assert.equal(anglePairSelection.thetaRad, anglePairSelection.probeThetaRad);
}

const rawH = selectCanonicalTermValue('rawH', {
  run: referenceRun,
  frame: angleReferenceFrame!,
  identity: manifest.fixtures.angleResponse.identity,
});
const hDiv = selectCanonicalTermValue('hDiv', {
  run: referenceRun,
  frame: angleReferenceFrame!,
  identity: manifest.fixtures.angleResponse.identity,
});
assert.deepEqual(rawH, { status: 'available', unit: 'linear', value: 5.666452889890504e-12 });
assert.deepEqual(hDiv, { status: 'available', unit: 'linear', value: 5.666452889890504e-12 });
assert.deepEqual(
  selectCanonicalTermValue('laggedInterference', {
    run: referenceRun,
    frame: angleReferenceFrame!,
    identity: manifest.fixtures.angleResponse.identity,
  }),
  { status: 'available', unit: 'W', value: 0 },
);
assert.equal(
  selectCanonicalTermValue('sinr', {
    run: referenceRun,
    frame: angleReferenceFrame!,
    identity: { ...manifest.fixtures.angleResponse.identity, userId: 'ue-forged' },
  }).status,
  'unavailable',
);
const forgedScientificValuesFrame = {
  ...angleReferenceFrame!,
  canonical: {
    ...angleReferenceFrame!.canonical,
    throughput: {
      ...angleReferenceFrame!.canonical.throughput,
      sinrU: Object.freeze(angleReferenceFrame!.canonical.throughput.sinrU.map(() => 999)),
    },
  },
};
assert.deepEqual(
  selectCanonicalTermValue('sinr', {
    run: referenceRun,
    frame: forgedScientificValuesFrame,
    identity: manifest.fixtures.angleResponse.identity,
  }),
  { status: 'available', unit: 'linear', value: 0.0643687378670359 },
);
assert.equal(
  selectCanonicalTermValue('sinr', {
    run: referenceRun,
    frame: { ...angleReferenceFrame!, frameId: 'analysis-forged' },
    identity: manifest.fixtures.angleResponse.identity,
  }).status,
  'unavailable',
);
assert.equal(
  selectCanonicalTermValue('sinr', {
    run: referenceRun,
    frame: {
      ...angleReferenceFrame!,
      runAnchor: {
        ...angleReferenceFrame!.runAnchor!,
        anchorIndex: angleReferenceFrame!.runAnchor!.anchorIndex + 1,
      },
    },
    identity: manifest.fixtures.angleResponse.identity,
  }).status,
  'unavailable',
);
assert.equal(
  selectCanonicalTermValue('sinr', {
    run: angleRun,
    frame: angleReferenceFrame!,
    identity: manifest.fixtures.angleResponse.identity,
  }).status,
  'unavailable',
);
assert.deepEqual(
  selectCanonicalTermValue('interSatelliteInterference', {
    run: referenceRun,
    frame: angleReferenceFrame!,
    identity: manifest.fixtures.angleResponse.identity,
  }),
  { status: 'available', unit: 'W', value: 0 },
);
assert.deepEqual(
  selectCanonicalTermValue('p0', {
    run: referenceRun,
    frame: angleReferenceFrame!,
    identity: manifest.fixtures.angleResponse.identity,
  }),
  { status: 'unavailable', unit: 'W', reason: 'P_0 has no canonical numeric diagnostic seam' },
);
for (const term of CANONICAL_TERM_KEYS) {
  const selected = selectCanonicalTermValue(term, {
    run: referenceRun,
    frame: angleReferenceFrame!,
    identity: manifest.fixtures.angleResponse.identity,
  });
  assert.equal(selected.status, term === 'p0' ? 'unavailable' : 'available', `${term} selector status`);
}
if (angleReferenceFrame!.candidateLink !== null) {
  assert.equal(angleReferenceFrame!.candidateLink.instantaneousEeBitsPerJ, null);
}

const methodEvidence = buildExplanatoryEvidence(
  referenceRun,
  manifest.fixtures.method.anchorIndex,
  manifest.fixtures.method.identity,
);
assert.equal(methodEvidence.sceneComposition.candidateComparison.role, 'single-link-comparison');
assert.equal(methodEvidence.handoverAnchor?.anchorIndex, manifest.fixtures.method.anchorIndex);
assert.equal(CANONICAL_TERM_DEFINITIONS.length, CANONICAL_TERM_KEYS.length);
for (const definition of CANONICAL_TERM_DEFINITIONS) {
  assert.equal(CANONICAL_TERM_REGISTRY[definition.key], definition);
  assert.ok(definition.thesisSymbol.length > 0);
  assert.ok(definition.label.length > 0);
  assert.ok(definition.unit.length > 0);
  assert.ok(definition.sceneTargets(methodEvidence).length > 0);
  assert.equal(definition.sourceSelector(methodEvidence).status, definition.key === 'p0' ? 'unavailable' : 'available');
  for (const dependency of definition.dependencies) {
    assert.ok(CANONICAL_TERM_REGISTRY[dependency].dependents.includes(definition.key));
  }
}
const visitedTerms = new Set<CanonicalTermKey>();
const activeTerms = new Set<CanonicalTermKey>();
const assertAcyclic = (term: CanonicalTermKey): void => {
  if (visitedTerms.has(term)) return;
  assert.equal(activeTerms.has(term), false, `canonical dependency cycle at ${term}`);
  activeTerms.add(term);
  for (const dependency of CANONICAL_TERM_REGISTRY[term].dependencies) assertAcyclic(dependency);
  activeTerms.delete(term);
  visitedTerms.add(term);
};
for (const term of CANONICAL_TERM_KEYS) assertAcyclic(term);
assert.ok(CANONICAL_CAUSAL_EDGE_REGISTRY.length >= 16);
for (const edge of CANONICAL_CAUSAL_EDGE_REGISTRY) {
  assert.ok(edge.edgeId.length > 0 && edge.sourceLocator.length > 0 && edge.operationOrConstraint.length > 0);
  assert.equal(edge.unit, CANONICAL_TERM_REGISTRY[edge.targetTerm].unit);
}

const result = resolveScientificStoryEvidence({
  manifest,
  referenceRun,
  angleProbeRun: angleRun,
  serviceTargetProbeRun: serviceTargetRun,
});
assert.equal(result.status, 'available');
if (result.status === 'available') {
  assert.equal(result.evidence.methodState.representativeLink.userId, 'ue-30');
  assert.equal(result.evidence.angleResponse.control.parameterKey, 'theta3dbRad');
  assert.equal(result.evidence.angleResponse.reference.frame.frameId, 'analysis-ee7fbeeb');
  assert.equal(result.evidence.angleResponse.probe.frame.frameId, 'analysis-613fa1bf');
  assert.equal(result.evidence.angleResponse.eeEval.status, 'excluded');
  assert.equal(result.evidence.serviceTargetStress.control.referenceValue, 1_000_000);
  assert.equal(result.evidence.serviceTargetStress.control.probeValue, 10_000_000);
  assert.equal(result.evidence.serviceTargetStress.capChecks.allNonBinding, true);
  assert.equal(result.evidence.serviceTargetStress.eeEval.status, 'excluded');
  assert.equal(result.evidence.servingChange.eventKind, 'forced-continuity');
  assert.equal(result.evidence.servingChange.sourceEventEvidence.eventId, 'tle-event-v1-e9303f64');
  assert.equal(result.evidence.servingChange.before.anchorIndex, 21);
  assert.equal(result.evidence.servingChange.decision.anchorIndex, 22);
  assert.equal(result.evidence.servingChange.after.anchorIndex, 23);
  assert.equal(result.evidence.servingChange.decision.quantitativeFrameRole, 'post-commit-trigger-frame');
}
assert.ok(Object.isFrozen(result));
if (result.status === 'available') {
  assert.ok(Object.isFrozen(result.evidence.angleResponse.control));
  assert.ok(Object.isFrozen(result.evidence.angleResponse.identity));
  for (const edge of CANONICAL_CAUSAL_EDGE_REGISTRY) {
    assert.equal(edge.referenceSelector(result.evidence.angleResponse).status, edge.targetTerm === 'p0' ? 'unavailable' : 'available');
    assert.equal(edge.probeSelector(result.evidence.angleResponse).status, edge.targetTerm === 'p0' ? 'unavailable' : 'available');
  }
}

const angleDeltas = deriveCanonicalTermDeltas(result.status === 'available'
  ? result.evidence.angleResponse
  : assert.fail('expected available evidence'));
const gainDelta = angleDeltas.find(delta => delta.term === 'transmitGain');
assert.equal(gainDelta?.direction, 'increase');
assert.equal(gainDelta?.unit, 'linear');
const gammaDelta = angleDeltas.find(delta => delta.term === 'gammaReq');
assert.equal(gammaDelta?.direction, 'unchanged');

const handoverStory = resolveServingChangeStory(
  referenceRun,
  manifest.fixtures.servingChange,
);
assert.equal(handoverStory.status, 'available');

const missingProbe = resolveScientificStoryEvidence({
  manifest,
  referenceRun,
  angleProbeRun: null,
  serviceTargetProbeRun: serviceTargetRun,
});
assert.deepEqual(missingProbe, {
  status: 'unavailable',
  fixtureId: 'angle-response-v1',
  reason: 'accepted angle-response probe run is unavailable',
  recovery: 'reload the accepted fixture inputs and rebuild the complete run',
});

const wrongAngleRun = referenceRun.withParameters({
  ...DEFAULT_SIMULATOR_PARAMETERS,
  theta3dbRad: 4 * Math.PI / 180,
  minimumRateBps: 2_000_000,
});
assert.throws(
  () => buildCausalProbeEvidence(
    {
      ...manifest.fixtures.angleResponse,
      probeParameterDigest: digestSimulatorParameters(wrongAngleRun.parameters),
    },
    buildExplanatoryEvidence(referenceRun, manifest.fixtures.angleResponse.anchorIndex, manifest.fixtures.angleResponse.identity),
    buildExplanatoryEvidence(wrongAngleRun, manifest.fixtures.angleResponse.anchorIndex, manifest.fixtures.angleResponse.identity),
  ),
  /only theta3dbRad may change/,
);
assert.throws(
  () => buildCausalProbeEvidence(
    {
      ...manifest.fixtures.angleResponse,
      expectedProbeTerms: {
        ...manifest.fixtures.angleResponse.expectedProbeTerms,
        transmitGain: 1,
      },
    },
    buildExplanatoryEvidence(referenceRun, manifest.fixtures.angleResponse.anchorIndex, manifest.fixtures.angleResponse.identity),
    buildExplanatoryEvidence(angleRun, manifest.fixtures.angleResponse.anchorIndex, manifest.fixtures.angleResponse.identity),
  ),
  /transmitGain drifted from the accepted fixture/,
);
const sourceDriftedAngleRun = {
  ...angleRun,
  selection: {
    ...angleRun.selection,
    catalog: {
      ...angleRun.selection.catalog,
      archiveContentSha256: '0'.repeat(64),
    },
  },
};
assert.throws(
  () => buildCausalProbeEvidence(
    manifest.fixtures.angleResponse,
    buildExplanatoryEvidence(referenceRun, manifest.fixtures.angleResponse.anchorIndex, manifest.fixtures.angleResponse.identity),
    {
      ...buildExplanatoryEvidence(angleRun, manifest.fixtures.angleResponse.anchorIndex, manifest.fixtures.angleResponse.identity),
      run: sourceDriftedAngleRun,
    },
  ),
  /source or TLE frame mismatch/,
);
const undeclaredDifference = resolveScientificStoryEvidence({
  manifest,
  referenceRun,
  angleProbeRun: wrongAngleRun,
  serviceTargetProbeRun: serviceTargetRun,
});
assert.equal(undeclaredDifference.status, 'unavailable');
if (undeclaredDifference.status === 'unavailable') {
  assert.equal(undeclaredDifference.fixtureId, 'angle-response-v1');
  assert.match(undeclaredDifference.reason, /analysis run identity mismatch/);
}

const pendingManifest = resolveScientificStoryEvidence({
  manifest: { ...manifest, status: 'PENDING' } as unknown as typeof manifest,
  referenceRun,
  angleProbeRun: angleRun,
  serviceTargetProbeRun: serviceTargetRun,
});
assert.equal(pendingManifest.status, 'unavailable');
if (pendingManifest.status === 'unavailable') assert.match(pendingManifest.reason, /accepted/);

const forgedDigestManifest = parseScientificFixtureManifest({
  ...manifest,
  fixtures: {
    ...manifest.fixtures,
    angleResponse: {
      ...manifest.fixtures.angleResponse,
      referenceParameterDigest: `sha256:${'0'.repeat(64)}`,
      probeParameterDigest: `sha256:${'0'.repeat(64)}`,
    },
  },
});
const forgedDigest = resolveScientificStoryEvidence({
  manifest: forgedDigestManifest,
  referenceRun,
  angleProbeRun: angleRun,
  serviceTargetProbeRun: serviceTargetRun,
});
assert.equal(forgedDigest.status, 'unavailable');
if (forgedDigest.status === 'unavailable') assert.match(forgedDigest.reason, /parameter digest mismatch/);

const serviceReferenceEvidence = buildExplanatoryEvidence(
  referenceRun,
  manifest.fixtures.serviceTargetStress.anchorIndex,
  manifest.fixtures.serviceTargetStress.identity,
);
const serviceProbeEvidence = buildExplanatoryEvidence(
  serviceTargetRun,
  manifest.fixtures.serviceTargetStress.anchorIndex,
  manifest.fixtures.serviceTargetStress.identity,
);
const extraAnchorRun = {
  ...serviceTargetRun,
  anchorSelections: Object.freeze([
    ...serviceTargetRun.anchorSelections,
    serviceTargetRun.anchorSelections[serviceTargetRun.anchorSelections.length - 1]!,
  ]),
};
const unequalSequence = buildCausalProbeEvidence(
  manifest.fixtures.serviceTargetStress,
  serviceReferenceEvidence,
  { ...serviceProbeEvidence, run: extraAnchorRun },
);
assert.equal(unequalSequence.eeEval.status, 'excluded');

const missingEvent = resolveServingChangeStory(referenceRun, {
  ...manifest.fixtures.servingChange,
  eventId: 'tle-event-v1-missing',
});
assert.deepEqual(missingEvent, {
  status: 'unavailable',
  fixtureId: 'serving-change-v1',
  reason: 'accepted serving-change event tle-event-v1-missing is unavailable',
});

const driftedMethodManifest = parseScientificFixtureManifest({
  ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST,
  fixtures: {
    ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures,
    method: {
      ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method,
      expectedTerms: {
        ...ACCEPTED_SCIENTIFIC_FIXTURE_MANIFEST.fixtures.method.expectedTerms,
        systemPower: 1,
      },
    },
  },
});
const driftedMethod = resolveScientificStoryEvidence({
  manifest: driftedMethodManifest,
  referenceRun,
  angleProbeRun: angleRun,
  serviceTargetProbeRun: serviceTargetRun,
});
assert.equal(driftedMethod.status, 'unavailable');
if (driftedMethod.status === 'unavailable') {
  assert.equal(driftedMethod.fixtureId, 'method-state-v1');
  assert.match(driftedMethod.reason, /systemPower drifted/);
}

console.log('Scientific explanation evidence model tests passed');
