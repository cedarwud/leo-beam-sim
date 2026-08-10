import { createHash } from 'node:crypto';

import {
  C120_CONTRACT_VERSION,
  C120_COURSE_ID,
  type C120UnitContract,
} from '../contract';
import {
  C120_ANGLE_AWARE_CONTRACT_VERSION,
  C120_CANONICAL_RUNTIME_SHA256,
  C120_GOLDEN_FIXTURE_SHA256,
  C120_CANONICAL_UNITS,
  type C120CanonicalRuntimeAdapter,
  type C120CanonicalVerification,
} from './canonicalRuntime';
import {
  C120RealDataError,
  C120_ORBIT_SOURCE_KIND,
  type C120OrbitFetcher,
  type C120OrbitSourceReceipt,
  type C120OrbitSourceRequest,
  fetchC120CelestrakOrbitSource,
} from './orbitSource';
import {
  deriveC120OrbitPass,
  type C120OrbitPropagationReceipt,
  type C120OrbitPropagationRequest,
} from './orbitPropagation';

export const C120_REAL_DATA_ARTIFACT_VERSION = 'c120-real-data-v2' as const;
export const C120_MODEL_DERIVED_ORBIT_KIND = 'MODEL_DERIVED_ORBIT' as const;
export const C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND = 'CANONICAL_MODEL_DERIVED_ENERGY' as const;
export const C120_COURSE_ASSUMPTION_KIND = 'COURSE_ASSUMPTION' as const;

export interface C120RealDataRequest {
  readonly courseId?: string;
  readonly courseContractVersion?: string;
  readonly providerId?: string;
  /** Explicit binding is required; a backend-default scenario must never leak into a course provider. */
  readonly scenarioId: string;
  readonly units?: C120UnitContract;
  readonly orbit: C120OrbitSourceRequest;
  readonly propagation: C120OrbitPropagationRequest;
  readonly courseAssumptions?: readonly string[];
}

export interface C120RealDataDependencies {
  readonly fetchOrbit: C120OrbitFetcher;
  readonly canonical: C120CanonicalRuntimeAdapter;
}

export interface C120ModelDerivedOrbitReady extends C120OrbitPropagationReceipt {
  readonly kind: typeof C120_MODEL_DERIVED_ORBIT_KIND;
  readonly status: 'READY';
  readonly measured: false;
}

export interface C120CanonicalEnergyLayer {
  readonly kind: typeof C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND;
  /** This slice verifies the canonical runtime; it does not canonicalize C-120 replay fixtures. */
  readonly scope: 'GOLDEN_VECTOR_PARITY_ONLY';
  readonly measured: false;
  readonly contractVersion: typeof C120_ANGLE_AWARE_CONTRACT_VERSION;
  readonly runtimeSha256: string;
  readonly goldenFixtureSha256: string;
  readonly numericTolerance: Readonly<{ readonly rtol: number; readonly atol: number }>;
  readonly cases: C120CanonicalVerification['cases'];
  readonly evaluation: C120CanonicalVerification['evaluation'];
}

export interface C120CourseAssumptionLayer {
  readonly kind: typeof C120_COURSE_ASSUMPTION_KIND;
  readonly measured: false;
  readonly values: readonly string[];
}

export interface C120RealDataProvenanceEntry {
  readonly kind:
    | typeof C120_ORBIT_SOURCE_KIND
    | typeof C120_MODEL_DERIVED_ORBIT_KIND
    | typeof C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND
    | typeof C120_COURSE_ASSUMPTION_KIND;
  readonly measured: false;
  readonly note: string;
}

export interface C120RealDataArtifact {
  readonly artifactVersion: typeof C120_REAL_DATA_ARTIFACT_VERSION;
  readonly artifactId: string;
  readonly contentSha256: string;
  readonly courseId: typeof C120_COURSE_ID;
  readonly courseContractVersion: typeof C120_CONTRACT_VERSION;
  readonly providerId: string;
  readonly scenarioId: string;
  readonly units: C120UnitContract;
  readonly measured: false;
  readonly wholeSatelliteCanonical: false;
  readonly source: C120OrbitSourceReceipt;
  readonly orbit: C120ModelDerivedOrbitReady;
  readonly energy: C120CanonicalEnergyLayer;
  readonly assumptions: C120CourseAssumptionLayer;
  readonly provenance: readonly [
    C120RealDataProvenanceEntry,
    C120RealDataProvenanceEntry,
    C120RealDataProvenanceEntry,
    C120RealDataProvenanceEntry,
  ];
  readonly claims: readonly [
    typeof C120_ORBIT_SOURCE_KIND,
    typeof C120_MODEL_DERIVED_ORBIT_KIND,
    typeof C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND,
    typeof C120_COURSE_ASSUMPTION_KIND,
  ];
}

const DEFAULT_PROVIDER_ID = 'c120-real-data-backend-v2';
const DEFAULT_COURSE_ASSUMPTIONS = Object.freeze([
  'observer location and pass-selection policy are course assumptions',
  'traffic, deadline and freshness policy are course assumptions',
  'satellite hardware power, load and thermal parameters are not measured here',
  'SGP4-derived orbit/look-angle values are model-derived and not measured telemetry',
]);

function fail(code: ConstructorParameters<typeof C120RealDataError>[0], message: string): never {
  throw new C120RealDataError(code, message);
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      // Match JSON object serialization so a serialized/parsed artifact keeps
      // the same content address when optional receipt fields are absent.
      if (child !== undefined) result[key] = canonicalize(child);
    }
    return result;
  }
  return String(value);
}

function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function validateUnits(units: C120UnitContract): void {
  if (JSON.stringify(units) !== JSON.stringify({
    elapsedTime: 's',
    activeTime: 's',
    deadline: 's',
    freshness: 's',
    power: 'W',
    consumedEnergy: 'J',
    energyBudget: 'J',
    rate: 'bit/s',
    deliveredData: 'bit',
    energyEfficiency: 'bit/J',
    angle: 'deg',
    distance: 'km',
    quality: 'teaching-band',
  })) {
    fail('ARTIFACT_INVALID', 'C-120 course unit contract mismatch');
  }
  if (JSON.stringify(C120_CANONICAL_UNITS) !== JSON.stringify({
    angle: 'rad',
    channelGain: 'linear',
    power: 'W',
    rate: 'bit/s',
    energy: 'J',
    efficiency: 'bit/J',
    bandwidth: 'Hz',
    duration: 's',
  })) {
    fail('ARTIFACT_INVALID', 'canonical unit contract drifted');
  }
}

function assertFinite(value: unknown, path: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('ARTIFACT_INVALID', `${path} is non-finite`);
    return;
  }
  if (typeof value === 'undefined') fail('ARTIFACT_INVALID', `${path} must not be undefined`);
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertFinite(child, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertFinite(child, `${path}.${key}`);
    return;
  }
  fail('ARTIFACT_INVALID', `${path} has unsupported type ${typeof value}`);
}

function validateCanonicalVerification(verification: C120CanonicalVerification): void {
  if (typeof verification !== 'object' || verification === null) {
    return fail('ARTIFACT_INVALID', 'canonical verification must be an object');
  }
  if (verification.verified !== true || verification.contractVersion !== C120_ANGLE_AWARE_CONTRACT_VERSION) {
    return fail('ARTIFACT_INVALID', 'canonical verification status or contract version mismatch');
  }
  if (verification.runtimeSha256 !== C120_CANONICAL_RUNTIME_SHA256 || verification.goldenFixtureSha256 !== C120_GOLDEN_FIXTURE_SHA256) {
    return fail('ARTIFACT_INVALID', 'canonical verification hash identity mismatch');
  }
  const tolerance = verification.numericTolerance;
  if (typeof tolerance !== 'object' || tolerance === null ||
    !Number.isFinite(tolerance.rtol) || !Number.isFinite(tolerance.atol) || tolerance.rtol < 0 || tolerance.atol < 0) {
    return fail('ARTIFACT_INVALID', 'canonical verification tolerance is invalid');
  }
  if (!Array.isArray(verification.cases) || verification.cases.length === 0) return fail('ARTIFACT_INVALID', 'canonical verification cases are missing');
  for (const [index, result] of verification.cases.entries()) {
    if (typeof result.id !== 'string' || result.mode !== 'closure') return fail('ARTIFACT_INVALID', `canonical case ${index} identity is invalid`);
    assertFinite(result.output, `canonical case ${result.id}`);
  }
  if (typeof verification.evaluation !== 'object' || verification.evaluation === null ||
    verification.evaluation.mode !== 'evaluation') return fail('ARTIFACT_INVALID', 'canonical evaluation identity is invalid');
  assertFinite(verification.evaluation.output, 'canonical evaluation');
  const evaluation = verification.evaluation.output;
  if (typeof evaluation !== 'object' || evaluation === null || Array.isArray(evaluation)) return fail('ARTIFACT_INVALID', 'canonical evaluation must be an object');
  const values = evaluation as Record<string, unknown>;
  const deliveredBits = values.delivered_bits;
  const consumedEnergy = values.consumed_energy_j;
  const efficiency = values.energy_efficiency_bits_per_j;
  if (typeof deliveredBits !== 'number' || typeof consumedEnergy !== 'number' || typeof efficiency !== 'number' || deliveredBits < 0 || consumedEnergy < 0 || efficiency < 0) {
    return fail('ARTIFACT_INVALID', 'canonical evaluation units or domain are invalid');
  }
  if (consumedEnergy === 0 && deliveredBits > 0) return fail('ARTIFACT_INVALID', 'canonical evaluation has positive bits with zero energy');
  if (consumedEnergy > 0 && Math.abs(efficiency - deliveredBits / consumedEnergy) > tolerance.atol + tolerance.rtol * Math.abs(deliveredBits / consumedEnergy)) {
    return fail('ARTIFACT_INVALID', 'canonical evaluation is not ratio of sums');
  }
}

function normalizeRequest(request: C120RealDataRequest): {
  readonly courseId: typeof C120_COURSE_ID;
  readonly courseContractVersion: typeof C120_CONTRACT_VERSION;
  readonly providerId: string;
  readonly scenarioId: string;
  readonly units: C120UnitContract;
  readonly orbit: C120OrbitSourceRequest;
  readonly propagation: C120OrbitPropagationRequest;
  readonly courseAssumptions: readonly string[];
} {
  if (request.courseId !== undefined && request.courseId !== C120_COURSE_ID) {
    return fail('ARTIFACT_INVALID', 'courseId does not match frozen C-120 identity');
  }
  if (request.courseContractVersion !== undefined && request.courseContractVersion !== C120_CONTRACT_VERSION) {
    return fail('ARTIFACT_INVALID', 'courseContractVersion does not match frozen C-120 identity');
  }
  const providerId = request.providerId ?? DEFAULT_PROVIDER_ID;
  const scenarioId = request.scenarioId;
  if (typeof providerId !== 'string' || providerId.trim() === ''
    || typeof scenarioId !== 'string' || scenarioId.trim() === '') {
    return fail('ARTIFACT_INVALID', 'providerId and explicit scenarioId are required');
  }
  const units = request.units ?? ({
    elapsedTime: 's',
    activeTime: 's',
    deadline: 's',
    freshness: 's',
    power: 'W',
    consumedEnergy: 'J',
    energyBudget: 'J',
    rate: 'bit/s',
    deliveredData: 'bit',
    energyEfficiency: 'bit/J',
    angle: 'deg',
    distance: 'km',
    quality: 'teaching-band',
  } as C120UnitContract);
  validateUnits(units);
  const assumptions = request.courseAssumptions ?? DEFAULT_COURSE_ASSUMPTIONS;
  if (assumptions.length === 0 || assumptions.some(value => typeof value !== 'string' || value.trim() === '')) {
    return fail('ARTIFACT_INVALID', 'course assumptions must be non-empty strings');
  }
  return {
    courseId: C120_COURSE_ID,
    courseContractVersion: C120_CONTRACT_VERSION,
    providerId,
    scenarioId,
    units,
    orbit: request.orbit,
    propagation: request.propagation,
    courseAssumptions: Object.freeze([...assumptions]),
  };
}

function createArtifact(
  normalized: ReturnType<typeof normalizeRequest>,
  source: C120OrbitSourceReceipt,
  orbit: C120OrbitPropagationReceipt,
  verification: C120CanonicalVerification,
): C120RealDataArtifact {
  const payload = {
    artifactVersion: C120_REAL_DATA_ARTIFACT_VERSION,
    courseId: normalized.courseId,
    courseContractVersion: normalized.courseContractVersion,
    providerId: normalized.providerId,
    scenarioId: normalized.scenarioId,
    units: normalized.units,
    measured: false as const,
    wholeSatelliteCanonical: false as const,
    source,
    orbit: {
      ...orbit,
      kind: C120_MODEL_DERIVED_ORBIT_KIND,
      status: 'READY' as const,
      measured: false as const,
    },
    energy: {
      kind: C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND,
      scope: 'GOLDEN_VECTOR_PARITY_ONLY' as const,
      measured: false as const,
      contractVersion: verification.contractVersion,
      runtimeSha256: verification.runtimeSha256,
      goldenFixtureSha256: verification.goldenFixtureSha256,
      numericTolerance: verification.numericTolerance,
      cases: verification.cases,
      evaluation: verification.evaluation,
    },
    assumptions: {
      kind: C120_COURSE_ASSUMPTION_KIND,
      measured: false as const,
      values: normalized.courseAssumptions,
    },
    provenance: [
      {
        kind: C120_ORBIT_SOURCE_KIND,
        measured: false as const,
        note: 'CelesTrak GP/OMM source bytes with bounded freshness and SHA-256 receipt',
      },
      {
        kind: C120_MODEL_DERIVED_ORBIT_KIND,
        measured: false as const,
        note: 'SGP4/model-derived orbit and look-angle values; not measured telemetry',
      },
      {
        kind: C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND,
        measured: false as const,
        note: 'Pinned angle-aware EE runtime and golden vectors verified; C-120 replay values are not canonicalized in this slice',
      },
      {
        kind: C120_COURSE_ASSUMPTION_KIND,
        measured: false as const,
        note: 'Course-owned traffic, observer, scheduling and hardware/load assumptions',
      },
    ] as const,
    claims: [
      C120_ORBIT_SOURCE_KIND,
      C120_MODEL_DERIVED_ORBIT_KIND,
      C120_CANONICAL_MODEL_DERIVED_ENERGY_KIND,
      C120_COURSE_ASSUMPTION_KIND,
    ] as const,
  };
  const digest = contentHash(payload);
  return Object.freeze({
    ...payload,
    artifactId: `sha256:${digest}`,
    contentSha256: digest,
  });
}

export function verifyC120RealDataArtifactContentAddress(artifact: C120RealDataArtifact): void {
  if (!/^sha256:[0-9a-f]{64}$/.test(artifact.artifactId)
    || !/^[0-9a-f]{64}$/.test(artifact.contentSha256)) {
    return fail('ARTIFACT_INVALID', 'artifact content address is malformed');
  }
  const { artifactId: _artifactId, contentSha256: _contentSha256, ...payload } = artifact;
  const digest = contentHash(payload);
  if (artifact.artifactId !== `sha256:${digest}` || artifact.contentSha256 !== digest) {
    return fail('ARTIFACT_INVALID', 'artifact content address does not match canonical JSON content');
  }
}

/**
 * The backend lane's only external seam: source fetch and canonical execution
 * are injected, while identity, provenance, freshness and claim separation
 * stay inside this deep module.
 */
export async function createC120RealDataArtifact(
  request: C120RealDataRequest,
  dependencies: C120RealDataDependencies,
): Promise<C120RealDataArtifact> {
  const normalized = normalizeRequest(request);
  const source = await fetchC120CelestrakOrbitSource(normalized.orbit, dependencies.fetchOrbit);
  const orbit = deriveC120OrbitPass(source, {
    ...normalized.propagation,
    expectedSourceSha256: source.rawContentSha256,
    expectedCatalogId: source.catalogId,
    expectedObjectName: source.objectName,
  });
  const verification = await dependencies.canonical.verifyAndRunGoldenVectors();
  validateCanonicalVerification(verification);
  const artifact = createArtifact(normalized, source, orbit, verification);
  verifyC120RealDataArtifactContentAddress(artifact);
  return artifact;
}

export const orchestrateC120RealData = createC120RealDataArtifact;
