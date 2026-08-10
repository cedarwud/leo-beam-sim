import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

import {
  C120_ANGLE_AWARE_CONTRACT_VERSION,
  C120_CANONICAL_RUNTIME_SHA256,
  C120_GOLDEN_FIXTURE_SHA256,
  C120_CANONICAL_UNITS,
  C120_MAX_CANONICAL_REQUEST_BYTES,
  C120_DEFAULT_CANONICAL_RUNTIME_PATH,
  C120_DEFAULT_GOLDEN_FIXTURE_PATH,
  createC120CanonicalRuntimeAdapter,
  type C120CanonicalVerification,
} from './canonicalRuntime';
import {
  C120_COURSE_ID,
  C120_CONTRACT_VERSION,
} from '../contract';
import {
  C120_MIN_SOURCE_REFRESH_INTERVAL_MS,
  C120RealDataError,
  createC120RealDataArtifact,
  deriveC120OrbitPass,
  fetchC120CelestrakOrbitSource,
  verifyC120RealDataArtifactContentAddress,
} from './index';
import type { C120OrbitFetchResponse } from './orbitSource';

const NOW = '2026-08-09T10:00:00Z';
// Exact offline capture bytes, including the CRLF emitted by the bounded
// CelesTrak response.  The body is never fetched in tests.
const BODY = '[{"OBJECT_NAME":"ONEWEB-0314","OBJECT_ID":"2021-075AB","EPOCH":"2026-08-09T09:20:51.128160","MEAN_MOTION":13.17651252,"ECCENTRICITY":0.0001589,"INCLINATION":87.9189,"RA_OF_ASC_NODE":355.279,"ARG_OF_PERICENTER":86.873,"MEAN_ANOMALY":273.2584,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","NORAD_CAT_ID":49100,"ELEMENT_SET_NO":999,"REV_AT_EPOCH":24057,"BSTAR":9.4634e-5,"MEAN_MOTION_DOT":5.0e-7,"MEAN_MOTION_DDOT":0}]\r\n';
const EXPECTED_SOURCE_SHA = '900127441642d85dcc81fd423e0cdb0db90e108157096f086662435311bd9c70';
const PROPAGATION = {
  observer: { latitudeDeg: 24.944, longitudeDeg: 121.371, heightKm: 0.05 },
  startUtc: '2026-08-09T18:20:00Z',
  endUtc: '2026-08-09T18:50:00Z',
  sampleStepSec: 10,
  minimumElevationDeg: 10,
};

const fetchBody = async (): Promise<C120OrbitFetchResponse> => ({ status: 200, body: BODY });
const orbitRequest = {
  retrievedAt: NOW,
  now: NOW,
};

function expectCode(action: () => unknown | Promise<unknown>, code: string): Promise<void> | void {
  let result: unknown | Promise<unknown>;
  try {
    result = action();
  } catch (error) {
    assert.ok(error instanceof C120RealDataError && error.code === code, String(error));
    return;
  }
  if (result instanceof Promise) {
    return result.then(
      () => assert.fail(`expected ${code} failure`),
      error => assert.ok(error instanceof C120RealDataError && error.code === code, String(error)),
    );
  }
  assert.fail(`expected ${code} failure`);
}

const minimalVerification: C120CanonicalVerification = {
  runtimePath: '/pinned/angle_aware_ee.py',
  goldenFixturePath: '/pinned/golden-vectors.json',
  runtimeSha256: C120_CANONICAL_RUNTIME_SHA256,
  goldenFixtureSha256: C120_GOLDEN_FIXTURE_SHA256,
  contractVersion: C120_ANGLE_AWARE_CONTRACT_VERSION,
  numericTolerance: { rtol: 1e-12, atol: 1e-15 },
  cases: [{ id: 'fake-single', mode: 'closure', output: { system_accounting: { system_throughput_bps: 0, system_consumed_power_w: 0, system_ee_bits_per_j: 0, per_user_contributions_bits_per_j: [0], zero_over_zero: true } } }],
  evaluation: { id: 'fake-evaluation', mode: 'evaluation', output: { delivered_bits: 0, consumed_energy_j: 0, energy_efficiency_bits_per_j: 0, zero_over_zero: true } },
  verified: true,
};

const fakeCanonical = {
  verifyAndRunGoldenVectors: async () => minimalVerification,
  run: async () => minimalVerification.cases[0]?.output,
};

const SYNTHETIC_RUNTIME = 'pinned runtime bytes';
const SYNTHETIC_GOLDEN = JSON.stringify({
  schema_version: 'angle-aware-ee-golden-v1',
  contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
  canonical_runtime: 'angle_aware_ee.py',
  numeric_tolerance: { rtol: 1e-12, atol: 1e-15 },
  cases: [{
    id: 'synthetic-single',
    inputs: {},
    expected: {
      contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
      system_accounting: {
        system_throughput_bps: 0,
        system_consumed_power_w: 0,
        system_ee_bits_per_j: 0,
        per_user_contributions_bits_per_j: [0],
        zero_over_zero: true,
      },
    },
  }],
  evaluation_vector: {
    step_throughputs_bps: [0],
    step_consumed_power_w: [0],
    step_duration_s: [1],
    expected_delivered_bits: 0,
    expected_consumed_energy_j: 0,
    expected_energy_efficiency_bits_per_j: 0,
  },
});
const syntheticRuntimeSha = createHash('sha256').update(SYNTHETIC_RUNTIME).digest('hex');
const syntheticGoldenSha = createHash('sha256').update(SYNTHETIC_GOLDEN).digest('hex');

const validSource = await fetchC120CelestrakOrbitSource(orbitRequest, fetchBody);
assert.equal(validSource.kind, 'PUBLIC_CURRENT_ORBIT_SOURCE');
assert.equal(validSource.catalogId, 49100);
assert.equal(validSource.objectName, 'ONEWEB-0314');
assert.equal(validSource.sourceEpoch, '2026-08-09T09:20:51.128160Z');
assert.equal(validSource.retrievedAt, NOW);
assert.equal(validSource.numericFields.ECCENTRICITY, 0.0001589);
assert.equal(validSource.numericFields.BSTAR, 9.4634e-5);
assert.equal(validSource.record.OBJECT_ID, '2021-075AB');
assert.equal(validSource.responseBytes, new TextEncoder().encode(BODY).byteLength);
assert.equal(validSource.rawContentSha256, EXPECTED_SOURCE_SHA);

const derivedPass = deriveC120OrbitPass(validSource, {
  ...PROPAGATION,
  expectedSourceSha256: EXPECTED_SOURCE_SHA,
  expectedCatalogId: 49100,
  expectedObjectName: 'ONEWEB-0314',
});
assert.equal(derivedPass.kind, 'MODEL_DERIVED_ORBIT');
assert.equal(derivedPass.model, 'satellite.js@6.0.2-sgp4-omm-v1');
assert.equal(derivedPass.measured, false);
assert.equal(derivedPass.source.rawContentSha256, EXPECTED_SOURCE_SHA);
assert.ok(Date.parse(derivedPass.pass.aos.utc) < Date.parse(derivedPass.pass.peak.utc));
assert.ok(Date.parse(derivedPass.pass.peak.utc) < Date.parse(derivedPass.pass.los.utc));
assert.ok(Math.abs(Date.parse(derivedPass.pass.aos.utc) - Date.parse('2026-08-09T18:28:00Z')) < 90_000);
assert.ok(Math.abs(Date.parse(derivedPass.pass.peak.utc) - Date.parse('2026-08-09T18:35:00Z')) < 90_000);
assert.ok(Math.abs(Date.parse(derivedPass.pass.los.utc) - Date.parse('2026-08-09T18:42:00Z')) < 120_000);
assert.ok(Math.abs(derivedPass.pass.peak.elevationDeg - 77.1) < 1);
assert.ok(Math.abs(derivedPass.pass.peak.rangeKm - 1222) < 15);

const clippedPass = deriveC120OrbitPass(validSource, {
  ...PROPAGATION,
  startUtc: '2026-08-09T18:34:00Z',
  endUtc: '2026-08-09T18:36:00Z',
});
assert.equal(clippedPass.pass.clippedAtWindowStart, true);
assert.equal(clippedPass.pass.clippedAtWindowEnd, true);
assert.equal(clippedPass.pass.aos.utc, '2026-08-09T18:34:00.000Z');
assert.equal(clippedPass.pass.los.utc, '2026-08-09T18:36:00.000Z');

await expectCode(
  () => deriveC120OrbitPass(validSource, { ...PROPAGATION, startUtc: PROPAGATION.endUtc, endUtc: PROPAGATION.startUtc }),
  'ORBIT_REQUEST_INVALID',
);
await expectCode(
  () => deriveC120OrbitPass(validSource, { ...PROPAGATION, endUtc: '2026-08-17T18:50:01Z' }),
  'ORBIT_REQUEST_INVALID',
);
await expectCode(
  () => deriveC120OrbitPass(validSource, {
    ...PROPAGATION,
    startUtc: '2026-08-20T18:20:00Z',
    endUtc: '2026-08-20T18:50:00Z',
  }),
  'ORBIT_REQUEST_INVALID',
);
await expectCode(
  () => deriveC120OrbitPass(validSource, { ...PROPAGATION, observer: { ...PROPAGATION.observer, latitudeDeg: 91 } }),
  'ORBIT_REQUEST_INVALID',
);
await expectCode(
  () => deriveC120OrbitPass(validSource, { ...PROPAGATION, sampleStepSec: 0 }),
  'ORBIT_REQUEST_INVALID',
);
await expectCode(
  () => deriveC120OrbitPass(validSource, { ...PROPAGATION, minimumElevationDeg: 91 }),
  'ORBIT_REQUEST_INVALID',
);
await expectCode(
  () => deriveC120OrbitPass(validSource, { ...PROPAGATION, expectedSourceSha256: '0'.repeat(64) }),
  'ORBIT_IDENTITY_MISMATCH',
);
await expectCode(
  () => deriveC120OrbitPass(validSource, { ...PROPAGATION, startUtc: '2026-08-09T10:00:00Z', endUtc: '2026-08-09T10:10:00Z' }),
  'ORBIT_NO_PASS',
);
const missingOmmSource = await fetchC120CelestrakOrbitSource(orbitRequest, async () => ({
  status: 200,
  body: BODY.replace('"BSTAR":9.4634e-5,', ''),
}));
await expectCode(() => deriveC120OrbitPass(missingOmmSource, PROPAGATION), 'ORBIT_PROPAGATION_FAILED');

await expectCode(
  () => fetchC120CelestrakOrbitSource({ ...orbitRequest, now: '2026-08-17T10:00:00Z', maxAgeMs: 60 * 60 * 1000 }, fetchBody),
  'SOURCE_STALE',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource(orbitRequest, async () => ({ status: 200, body: BODY.replace('49100', '49101') })),
  'SOURCE_IDENTITY_MISMATCH',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource({ ...orbitRequest, catalogId: 49101 }, async () => ({
    status: 200,
    body: BODY.replace('49100', '49101'),
  })),
  'SOURCE_IDENTITY_MISMATCH',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource({ ...orbitRequest, expectedName: 'ONEWEB-9999' }, fetchBody),
  'SOURCE_IDENTITY_MISMATCH',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource(orbitRequest, async () => ({ status: 200, body: BODY.replace('ONEWEB-0314', 'STARLINK-1') })),
  'SOURCE_IDENTITY_MISMATCH',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource(orbitRequest, async () => ({ status: 200, body: '{' })),
  'MALFORMED_SOURCE',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource(orbitRequest, async () => ({ status: 200, body: BODY.replace('9.4634e-5', '"not-a-number"') })),
  'VALIDATION_FAILED',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource({ ...orbitRequest, maxResponseBytes: 8 }, fetchBody),
  'RESPONSE_TOO_LARGE',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource({ ...orbitRequest, lastRetrievedAt: '2026-08-09T09:30:00Z' }, fetchBody),
  'SOURCE_REFRESH_TOO_SOON',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource({
    ...orbitRequest,
    retrievedAt: '2026-08-09T08:00:00Z',
  }, fetchBody),
  'TIMESTAMP_INVALID',
);
await expectCode(
  () => fetchC120CelestrakOrbitSource({ ...orbitRequest, url: 'https://example.invalid/orbit.json' }, fetchBody),
  'VALIDATION_FAILED',
);
assert.equal(C120_MIN_SOURCE_REFRESH_INTERVAL_MS, 2 * 60 * 60 * 1000);

const unitMismatchAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async () => ({
    contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
    system_accounting: { system_throughput_bps: 0, system_consumed_power_w: 0, system_ee_bits_per_j: 0, per_user_contributions_bits_per_j: [0], zero_over_zero: true },
  }),
});
await expectCode(
  () => unitMismatchAdapter.run({ mode: 'closure', inputs: {}, units: { ...C120_CANONICAL_UNITS, power: 'J' } as unknown as typeof C120_CANONICAL_UNITS }),
  'CANONICAL_CONTRACT_MISMATCH',
);
const nonFiniteAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async () => ({
    contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
    system_accounting: { system_throughput_bps: Number.NaN, system_consumed_power_w: 0, system_ee_bits_per_j: 0, per_user_contributions_bits_per_j: [0], zero_over_zero: true },
  }),
});
await expectCode(
  () => nonFiniteAdapter.run({ mode: 'closure', inputs: {}, units: C120_CANONICAL_UNITS }),
  'CANONICAL_OUTPUT_INVALID',
);

const runtimeBytes = SYNTHETIC_RUNTIME;
const goldenBytes = SYNTHETIC_GOLDEN;
const driftAdapter = createC120CanonicalRuntimeAdapter({
  runtimeSha256: syntheticRuntimeSha,
  goldenFixtureSha256: syntheticGoldenSha,
  readFile: async path => path.endsWith('angle_aware_ee.py') ? `${runtimeBytes}\u0000` : goldenBytes,
});
await expectCode(() => driftAdapter.verifyAndRunGoldenVectors(), 'CANONICAL_RUNTIME_DRIFT');
const goldenDriftAdapter = createC120CanonicalRuntimeAdapter({
  runtimeSha256: syntheticRuntimeSha,
  goldenFixtureSha256: syntheticGoldenSha,
  readFile: async path => path.endsWith('angle_aware_ee.py') ? runtimeBytes : `${goldenBytes}\u0000`,
});
await expectCode(() => goldenDriftAdapter.verifyAndRunGoldenVectors(), 'CANONICAL_RUNTIME_DRIFT');
const contractDriftGolden = goldenBytes.replace(C120_ANGLE_AWARE_CONTRACT_VERSION, 'wrong-contract-version');
const contractDriftGoldenSha = createHash('sha256').update(contractDriftGolden, 'utf8').digest('hex');
const contractDriftAdapter = createC120CanonicalRuntimeAdapter({
  runtimeSha256: syntheticRuntimeSha,
  goldenFixtureSha256: contractDriftGoldenSha,
  readFile: async path => path.endsWith('angle_aware_ee.py') ? runtimeBytes : contractDriftGolden,
});
await expectCode(() => contractDriftAdapter.verifyAndRunGoldenVectors(), 'CANONICAL_CONTRACT_MISMATCH');

const syntheticAdapter = createC120CanonicalRuntimeAdapter({
  runtimePath: '/synthetic/angle_aware_ee.py',
  goldenFixturePath: '/synthetic/golden-vectors.json',
  runtimeSha256: syntheticRuntimeSha,
  goldenFixtureSha256: syntheticGoldenSha,
  allowUnpinnedTestRunner: true,
  runner: async request => request.mode === 'closure'
    ? {
      contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
      system_accounting: {
        system_throughput_bps: 0,
        system_consumed_power_w: 0,
        system_ee_bits_per_j: 0,
        per_user_contributions_bits_per_j: [0],
        zero_over_zero: true,
      },
    }
    : { delivered_bits: 0, consumed_energy_j: 0, energy_efficiency_bits_per_j: 0, zero_over_zero: false },
  readFile: async path => path.endsWith('angle_aware_ee.py') ? runtimeBytes : goldenBytes,
});
const syntheticVerification = await syntheticAdapter.verifyAndRunGoldenVectors();
assert.equal(syntheticVerification.verified, true);
assert.equal(syntheticVerification.runtimeSha256, syntheticRuntimeSha);
assert.equal(syntheticVerification.goldenFixtureSha256, syntheticGoldenSha);
assert.equal(syntheticVerification.evaluation.mode, 'evaluation');

await expectCode(
  () => createC120CanonicalRuntimeAdapter({ runner: async () => ({}) }),
  'CANONICAL_CONTRACT_MISMATCH',
);

let pinnedRuntimeReadCount = 0;
const executedRuntimeSnapshots: string[] = [];
const pinnedSnapshotAdapter = createC120CanonicalRuntimeAdapter({
  runtimePath: '/synthetic/angle_aware_ee.py',
  goldenFixturePath: '/synthetic/golden-vectors.json',
  runtimeSha256: syntheticRuntimeSha,
  goldenFixtureSha256: syntheticGoldenSha,
  readFile: async path => {
    if (path.endsWith('angle_aware_ee.py')) {
      pinnedRuntimeReadCount += 1;
      return pinnedRuntimeReadCount === 1 ? runtimeBytes : 'tampered-after-hash';
    }
    return goldenBytes;
  },
  pinnedRunner: async (request, pinnedRuntimeBytes) => {
    executedRuntimeSnapshots.push(new TextDecoder().decode(pinnedRuntimeBytes));
    return request.mode === 'closure'
      ? {
        contract_version: C120_ANGLE_AWARE_CONTRACT_VERSION,
        system_accounting: {
          system_throughput_bps: 0,
          system_consumed_power_w: 0,
          system_ee_bits_per_j: 0,
          per_user_contributions_bits_per_j: [0],
          zero_over_zero: true,
        },
      }
      : { delivered_bits: 0, consumed_energy_j: 0, energy_efficiency_bits_per_j: 0, zero_over_zero: false };
  },
});
await pinnedSnapshotAdapter.verifyAndRunGoldenVectors();
await pinnedSnapshotAdapter.run({
  mode: 'evaluation',
  inputs: { step_throughputs_bps: [0], step_consumed_power_w: [0], step_duration_s: [1] },
  units: C120_CANONICAL_UNITS,
});
assert.equal(pinnedRuntimeReadCount, 1);
assert.ok(executedRuntimeSnapshots.length >= 3);
assert.ok(executedRuntimeSnapshots.every(value => value === runtimeBytes));

const inputValidationAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async () => minimalVerification.cases[0]?.output,
});
await expectCode(
  () => inputValidationAdapter.run({ mode: 'closure', inputs: { bad: Number.NaN }, units: C120_CANONICAL_UNITS }),
  'CANONICAL_INPUT_INVALID',
);
await expectCode(
  () => inputValidationAdapter.run({ mode: 'closure', inputs: { bad: undefined }, units: C120_CANONICAL_UNITS }),
  'CANONICAL_INPUT_INVALID',
);
await expectCode(
  () => inputValidationAdapter.run({ mode: 'closure', inputs: { bad: new Date('2026-01-01T00:00:00Z') }, units: C120_CANONICAL_UNITS }),
  'CANONICAL_INPUT_INVALID',
);
await expectCode(
  () => inputValidationAdapter.run({
    mode: 'closure',
    inputs: { oversized: 'x'.repeat(C120_MAX_CANONICAL_REQUEST_BYTES) },
    units: C120_CANONICAL_UNITS,
  }),
  'CANONICAL_INPUT_INVALID',
);
await expectCode(
  () => inputValidationAdapter.run({ mode: 'evaluation', inputs: {
    step_throughputs_bps: [1],
    step_consumed_power_w: [1, 2],
    step_duration_s: [1],
  }, units: C120_CANONICAL_UNITS }),
  'CANONICAL_INPUT_INVALID',
);
await expectCode(
  () => inputValidationAdapter.run({ mode: 'evaluation', inputs: {
    step_throughputs_bps: [1],
    step_consumed_power_w: [-1],
    step_duration_s: [1],
  }, units: C120_CANONICAL_UNITS }),
  'CANONICAL_INPUT_INVALID',
);
const invalidEvaluationOutputAdapter = createC120CanonicalRuntimeAdapter({
  allowUnpinnedTestRunner: true,
  runner: async () => ({ delivered_bits: 2, consumed_energy_j: 1, energy_efficiency_bits_per_j: 1, zero_over_zero: false }),
});
await expectCode(
  () => invalidEvaluationOutputAdapter.run({ mode: 'evaluation', inputs: {
    step_throughputs_bps: [1],
    step_consumed_power_w: [1],
    step_duration_s: [1],
  }, units: C120_CANONICAL_UNITS }),
  'CANONICAL_OUTPUT_INVALID',
);
const directDriftAdapter = createC120CanonicalRuntimeAdapter({
  runtimePath: '/synthetic/angle_aware_ee.py',
  goldenFixturePath: '/synthetic/golden-vectors.json',
  runtimeSha256: syntheticRuntimeSha,
  goldenFixtureSha256: syntheticGoldenSha,
  readFile: async path => path.endsWith('angle_aware_ee.py') ? `${runtimeBytes}\u0000` : goldenBytes,
});
await expectCode(
  () => directDriftAdapter.run({ mode: 'closure', inputs: {}, units: C120_CANONICAL_UNITS }),
  'CANONICAL_RUNTIME_DRIFT',
);

const artifactRequest = {
  courseId: C120_COURSE_ID,
  courseContractVersion: C120_CONTRACT_VERSION,
  providerId: 'test-real-data-provider',
  scenarioId: 'test-scenario',
  orbit: orbitRequest,
  propagation: PROPAGATION,
};
const artifact = await createC120RealDataArtifact(artifactRequest, { fetchOrbit: fetchBody, canonical: fakeCanonical });
const artifactAgain = await createC120RealDataArtifact(artifactRequest, { fetchOrbit: fetchBody, canonical: fakeCanonical });
assert.equal(artifact.artifactId, artifactAgain.artifactId);
assert.equal(artifact.contentSha256, artifactAgain.contentSha256);
assert.equal(artifact.artifactId, `sha256:${artifact.contentSha256}`);
assert.equal(artifact.measured, false);
assert.equal(artifact.wholeSatelliteCanonical, false);
assert.equal(artifact.source.kind, 'PUBLIC_CURRENT_ORBIT_SOURCE');
assert.equal(artifact.orbit.status, 'READY');
assert.equal(artifact.orbit.model, 'satellite.js@6.0.2-sgp4-omm-v1');
assert.deepEqual(artifact.orbit.pass, derivedPass.pass);
assert.equal(artifact.orbit.measured, false);
assert.equal(artifact.energy.kind, 'CANONICAL_MODEL_DERIVED_ENERGY');
assert.equal(artifact.energy.scope, 'GOLDEN_VECTOR_PARITY_ONLY');
assert.equal(artifact.energy.measured, false);
assert.equal(artifact.assumptions.kind, 'COURSE_ASSUMPTION');
assert.deepEqual(artifact.provenance.map(entry => entry.kind), [
  'PUBLIC_CURRENT_ORBIT_SOURCE',
  'MODEL_DERIVED_ORBIT',
  'CANONICAL_MODEL_DERIVED_ENERGY',
  'COURSE_ASSUMPTION',
]);
assert.deepEqual(artifact.claims, [
  'PUBLIC_CURRENT_ORBIT_SOURCE',
  'MODEL_DERIVED_ORBIT',
  'CANONICAL_MODEL_DERIVED_ENERGY',
  'COURSE_ASSUMPTION',
]);
verifyC120RealDataArtifactContentAddress(artifact);
const serializedArtifact = JSON.parse(JSON.stringify(artifact)) as typeof artifact;
verifyC120RealDataArtifactContentAddress(serializedArtifact);
await expectCode(
  () => verifyC120RealDataArtifactContentAddress({
    ...serializedArtifact,
    scenarioId: 'tampered-scenario',
  }),
  'ARTIFACT_INVALID',
);
await expectCode(
  () => createC120RealDataArtifact({ ...artifactRequest, courseId: 'wrong-course' }, { fetchOrbit: fetchBody, canonical: fakeCanonical }),
  'ARTIFACT_INVALID',
);
const missingScenarioRequest = { ...artifactRequest } as Record<string, unknown>;
delete missingScenarioRequest.scenarioId;
await expectCode(
  () => createC120RealDataArtifact(
    missingScenarioRequest as unknown as Parameters<typeof createC120RealDataArtifact>[0],
    { fetchOrbit: fetchBody, canonical: fakeCanonical },
  ),
  'ARTIFACT_INVALID',
);
const nonFiniteVerification = {
  ...minimalVerification,
  evaluation: {
    ...minimalVerification.evaluation,
    output: { delivered_bits: Number.NaN, consumed_energy_j: 1, energy_efficiency_bits_per_j: Number.NaN, zero_over_zero: false },
  },
};
await expectCode(
  () => createC120RealDataArtifact(artifactRequest, {
    fetchOrbit: fetchBody,
    canonical: { ...fakeCanonical, verifyAndRunGoldenVectors: async () => nonFiniteVerification },
  }),
  'ARTIFACT_INVALID',
);

// The default bridge must execute and match every golden vector whenever its
// pinned external dependencies are present.  A checkout without those files
// remains a deterministic fail-closed environment.
const defaultAdapter = createC120CanonicalRuntimeAdapter();
if (existsSync(C120_DEFAULT_CANONICAL_RUNTIME_PATH) && existsSync(C120_DEFAULT_GOLDEN_FIXTURE_PATH)) {
  const verification = await defaultAdapter.verifyAndRunGoldenVectors();
  assert.equal(verification.verified, true);
  assert.equal(verification.cases.length, 3);
  assert.equal((verification.evaluation.output as { readonly energy_efficiency_bits_per_j: number }).energy_efficiency_bits_per_j, 70 / 26);
} else {
  await expectCode(() => defaultAdapter.verifyAndRunGoldenVectors(), 'CANONICAL_RUNTIME_UNAVAILABLE');
}

console.log('C-120 real-data backend tests passed');
