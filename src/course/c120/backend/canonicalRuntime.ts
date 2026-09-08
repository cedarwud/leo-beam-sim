import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { readFile as readFileAsync } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { Readable } from 'node:stream';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import {
  C120RealDataError,
  type C120RealDataErrorCode,
} from './orbitSource';

export const C120_ANGLE_AWARE_CONTRACT_VERSION = 'family-b-thesis-3.13-3.17-v1';
export const C120_CANONICAL_RUNTIME_SHA256 =
  'e838246b7c82e4ccb01b323d92d5e49ab3f849039e31312f20a96adc52154131';
export const C120_GOLDEN_FIXTURE_SHA256 =
  '2d9de6552e9a8ad037b8d76999fd291938f6fefe64f6ec075b2ea19d76070519';

function configuredPath(name: string, fallback: string): string {
  const configured = process.env[name];
  return configured === undefined || configured.trim() === '' ? fallback : resolve(configured);
}

const C120_DEFAULT_RUNTIME_ROOT = resolve(homedir(), 'papers/c120-canonical-runtime');
export const C120_DEFAULT_CANONICAL_RUNTIME_PATH =
  configuredPath(
    'C120_CANONICAL_RUNTIME_PATH',
    resolve(C120_DEFAULT_RUNTIME_ROOT, 'runtime/angle_aware_ee.py'),
  );
export const C120_DEFAULT_GOLDEN_FIXTURE_PATH =
  configuredPath(
    'C120_GOLDEN_FIXTURE_PATH',
    resolve(C120_DEFAULT_RUNTIME_ROOT, 'fixtures/angle-aware-ee-v1/golden-vectors.json'),
  );
export const C120_CANONICAL_UNITS = Object.freeze({
  angle: 'rad',
  channelGain: 'linear',
  power: 'W',
  rate: 'bit/s',
  energy: 'J',
  efficiency: 'bit/J',
  bandwidth: 'Hz',
  duration: 's',
} as const);
export const C120_MAX_CANONICAL_REQUEST_BYTES = 64 * 1024;
const C120_MAX_CANONICAL_PROCESS_OUTPUT_BYTES = 8 * 1024 * 1024;

export type C120CanonicalUnits = typeof C120_CANONICAL_UNITS;
export type C120CanonicalRunMode = 'closure' | 'evaluation';

export interface C120CanonicalRunRequest {
  readonly mode: C120CanonicalRunMode;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly units: C120CanonicalUnits;
}

export type C120CanonicalRunner = (request: C120CanonicalRunRequest) => Promise<unknown>;
export type C120PinnedCanonicalRunner = (
  request: C120CanonicalRunRequest,
  runtimeBytes: Uint8Array,
  runtimePath: string,
) => Promise<unknown>;
export type C120CanonicalFileReader = (path: string) => Promise<string | Uint8Array>;

export interface C120CanonicalAdapterOptions {
  readonly runtimePath?: string;
  readonly goldenFixturePath?: string;
  readonly pythonExecutable?: string;
  /** Bound a misconfigured Python/NumPy process; failures remain fail-closed. */
  readonly timeoutMs?: number;
  readonly readFile?: C120CanonicalFileReader;
  /** Explicitly unpinned test seam; rejected unless allowUnpinnedTestRunner is true. */
  readonly runner?: C120CanonicalRunner;
  readonly allowUnpinnedTestRunner?: true;
  /** Testable pinned execution seam; receives the exact runtime bytes whose SHA was accepted. */
  readonly pinnedRunner?: C120PinnedCanonicalRunner;
  readonly runtimeSha256?: string;
  readonly goldenFixtureSha256?: string;
}

export interface C120CanonicalCaseResult {
  readonly id: string;
  readonly mode: C120CanonicalRunMode;
  readonly output: unknown;
}

export interface C120CanonicalVerification {
  readonly runtimePath: string;
  readonly goldenFixturePath: string;
  readonly runtimeSha256: string;
  readonly goldenFixtureSha256: string;
  readonly contractVersion: typeof C120_ANGLE_AWARE_CONTRACT_VERSION;
  readonly numericTolerance: Readonly<{ readonly rtol: number; readonly atol: number }>;
  readonly cases: readonly C120CanonicalCaseResult[];
  readonly evaluation: C120CanonicalCaseResult;
  readonly verified: true;
}

export interface C120CanonicalRuntimeAdapter {
  readonly verifyAndRunGoldenVectors: () => Promise<C120CanonicalVerification>;
  readonly run: (request: C120CanonicalRunRequest) => Promise<unknown>;
}

interface GoldenVectorFixture {
  readonly schema_version: string;
  readonly contract_version: string;
  readonly canonical_runtime: string;
  readonly numeric_tolerance: { readonly rtol: number; readonly atol: number };
  readonly cases: readonly {
    readonly id: string;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly expected: Readonly<Record<string, unknown>>;
  }[];
  readonly evaluation_vector: {
    readonly step_throughputs_bps: readonly number[];
    readonly step_consumed_power_w: readonly number[];
    readonly step_duration_s: readonly number[];
    readonly expected_delivered_bits: number;
    readonly expected_consumed_energy_j: number;
    readonly expected_energy_efficiency_bits_per_j: number;
  };
}

const CLOSURE_NON_NEGATIVE_FIELDS = new Set([
  'gamma_req_b',
  'p_req_u_w',
  'p_req_b_w',
  'p_dl_before_sat_cap_b_w',
  'satellite_scale_b',
  'p_dl_b_w',
  'received_power_ub_w',
  'signal_u_w',
  'interference_u_w',
  'sinr_u',
  'rate_u_bps',
  'eta_pa_b',
  'p_tot_b_w',
]);

function fail(code: C120RealDataErrorCode, message: string): never {
  throw new C120RealDataError(code, message);
}

function toBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? new TextEncoder().encode(value) : value;
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(toBytes(value)).digest('hex');
}

function decodeUtf8(value: string | Uint8Array): string {
  return typeof value === 'string' ? value : new TextDecoder().decode(value);
}

function assertFiniteDeep(value: unknown, path: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('CANONICAL_OUTPUT_INVALID', `${path} is non-finite`);
    return;
  }
  if (typeof value === 'undefined') fail('CANONICAL_OUTPUT_INVALID', `${path} must not be undefined`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteDeep(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    if (!isPlainRecord(value)) fail('CANONICAL_OUTPUT_INVALID', `${path} must be a plain JSON object`);
    for (const [key, child] of Object.entries(value)) assertFiniteDeep(child, `${path}.${key}`);
    return;
  }
  fail('CANONICAL_OUTPUT_INVALID', `${path} has unsupported type ${typeof value}`);
}

function assertUnits(units: C120CanonicalUnits): void {
  if (JSON.stringify(units) !== JSON.stringify(C120_CANONICAL_UNITS)) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'canonical unit contract does not match pinned units');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * JSON is the bridge contract.  Validate the complete input tree before a
 * runner sees it: JSON.stringify would otherwise turn NaN/Infinity into null,
 * drop undefined object properties, and silently coerce unsupported values.
 */
function assertBridgeSafeInput(value: unknown, path: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('CANONICAL_INPUT_INVALID', `${path} must be finite`);
    return;
  }
  if (typeof value === 'undefined') return fail('CANONICAL_INPUT_INVALID', `${path} must not be undefined`);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertBridgeSafeInput(value[index], `${path}[${index}]`);
    }
    return;
  }
  if (typeof value === 'object') {
    if (!isPlainRecord(value)) return fail('CANONICAL_INPUT_INVALID', `${path} must be a plain JSON object`);
    for (const [key, child] of Object.entries(value)) assertBridgeSafeInput(child, `${path}.${key}`);
    return;
  }
  return fail('CANONICAL_INPUT_INVALID', `${path} has unsupported type ${typeof value}`);
}

function validateCanonicalInputs(mode: C120CanonicalRunMode, inputs: unknown): asserts inputs is Readonly<Record<string, unknown>> {
  if (!isPlainRecord(inputs)) fail('CANONICAL_INPUT_INVALID', 'canonical inputs must be a plain object');
  assertBridgeSafeInput(inputs, 'inputs');
  const requestBytes = new TextEncoder().encode(JSON.stringify({ mode, inputs })).byteLength;
  if (requestBytes > C120_MAX_CANONICAL_REQUEST_BYTES) {
    fail('CANONICAL_INPUT_INVALID', `canonical request exceeds ${C120_MAX_CANONICAL_REQUEST_BYTES} bytes`);
  }
  if (mode !== 'evaluation') return;

  const names = ['step_throughputs_bps', 'step_consumed_power_w', 'step_duration_s'] as const;
  const arrays = names.map(name => {
    const value = inputs[name];
    if (!Array.isArray(value)) return fail('CANONICAL_INPUT_INVALID', `inputs.${name} must be an array`);
    return value;
  });
  const [throughputs, powers, durations] = arrays;
  if (throughputs.length !== powers.length || throughputs.length !== durations.length) {
    return fail('CANONICAL_INPUT_INVALID', 'evaluation arrays must have equal lengths');
  }
  const domains: readonly [string, readonly unknown[], boolean][] = [
    ['step_throughputs_bps', throughputs, true],
    ['step_consumed_power_w', powers, true],
    ['step_duration_s', durations, true],
  ];
  for (const [name, values, nonNegative] of domains) {
    values.forEach((value, index) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fail('CANONICAL_INPUT_INVALID', `inputs.${name}[${index}] must be finite`);
      }
      if (nonNegative && value < 0) return fail('CANONICAL_INPUT_INVALID', `inputs.${name}[${index}] must be non-negative`);
    });
  }
}

function compareExpected(actual: unknown, expected: unknown, path: string, rtol: number, atol: number): void {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || !Number.isFinite(actual)) {
      fail('CANONICAL_OUTPUT_INVALID', `${path} must be a finite number`);
    }
    const delta = Math.abs(actual - expected);
    if (delta > atol + rtol * Math.abs(expected)) {
      fail('CANONICAL_OUTPUT_INVALID', `${path} differs by ${delta}, tolerance exceeded`);
    }
    return;
  }
  if (typeof expected === 'string' || typeof expected === 'boolean' || expected === null) {
    if (actual !== expected) fail('CANONICAL_OUTPUT_INVALID', `${path} does not match expected value`);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      fail('CANONICAL_OUTPUT_INVALID', `${path} array shape mismatch`);
    }
    expected.forEach((item, index) => compareExpected(actual[index], item, `${path}[${index}]`, rtol, atol));
    return;
  }
  if (!isRecord(expected) || !isRecord(actual)) {
    fail('CANONICAL_OUTPUT_INVALID', `${path} object shape mismatch`);
  }
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  if (expectedKeys.some(key => !actualKeys.includes(key))) {
    fail('CANONICAL_OUTPUT_INVALID', `${path} is missing expected keys`);
  }
  for (const key of expectedKeys) compareExpected(actual[key], expected[key], `${path}.${key}`, rtol, atol);
}

function assertCanonicalClosureOutput(value: unknown): void {
  assertFiniteDeep(value, 'closure');
  if (!isRecord(value)) fail('CANONICAL_OUTPUT_INVALID', 'closure output must be an object');
  if (value.contract_version !== C120_ANGLE_AWARE_CONTRACT_VERSION) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'canonical closure output contract version mismatch');
  }
  const hasNegativeNumber = (candidate: unknown): boolean => {
    if (typeof candidate === 'number') return candidate < 0;
    if (Array.isArray(candidate)) return candidate.some(hasNegativeNumber);
    return false;
  };
  for (const [field, child] of Object.entries(value)) {
    if (CLOSURE_NON_NEGATIVE_FIELDS.has(field)) {
      if (hasNegativeNumber(child)) {
        fail('CANONICAL_OUTPUT_INVALID', `${field} contains a negative value`);
      }
    }
  }
  const accounting = value.system_accounting;
  if (!isRecord(accounting)) fail('CANONICAL_OUTPUT_INVALID', 'system_accounting is missing');
  if (typeof accounting.system_throughput_bps !== 'number' || typeof accounting.system_consumed_power_w !== 'number' || typeof accounting.system_ee_bits_per_j !== 'number') {
    fail('CANONICAL_OUTPUT_INVALID', 'system_accounting has invalid units');
  }
  if (accounting.system_consumed_power_w < 0 || accounting.system_throughput_bps < 0 || accounting.system_ee_bits_per_j < 0) {
    fail('CANONICAL_OUTPUT_INVALID', 'system_accounting contains negative physical values');
  }
  if (accounting.system_consumed_power_w === 0 && accounting.system_throughput_bps > 0) {
    fail('CANONICAL_OUTPUT_INVALID', 'positive throughput with zero consumed power');
  }
  if (accounting.system_consumed_power_w > 0) {
    const expectedEe = accounting.system_throughput_bps / accounting.system_consumed_power_w;
    const delta = Math.abs(accounting.system_ee_bits_per_j - expectedEe);
    if (!Number.isFinite(expectedEe) || !Number.isFinite(accounting.system_ee_bits_per_j) ||
      delta > 1e-12 * Math.abs(expectedEe) + 1e-15) {
      fail('CANONICAL_OUTPUT_INVALID', 'system EE is not throughput divided by consumed power');
    }
  }
}

/** Flatten the dataclass's accounting payload into the frozen golden-vector view. */
function normalizeClosureOutput(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const accounting = isRecord(value.system_accounting) ? value.system_accounting : value;
  const hasAccounting =
    typeof accounting.system_throughput_bps === 'number' &&
    typeof accounting.system_consumed_power_w === 'number' &&
    typeof accounting.system_ee_bits_per_j === 'number';
  if (!hasAccounting) return value;
  const contributions = Array.isArray(accounting.per_user_contributions_bits_per_j)
    ? accounting.per_user_contributions_bits_per_j
    : (Array.isArray(value.r1_u_bits_per_j) ? value.r1_u_bits_per_j : []);
  return {
    ...value,
    system_throughput_bps: accounting.system_throughput_bps,
    system_consumed_power_w: accounting.system_consumed_power_w,
    system_ee_bits_per_j: accounting.system_ee_bits_per_j,
    r1_u_bits_per_j: contributions,
    system_accounting: value.system_accounting ?? {
      system_throughput_bps: accounting.system_throughput_bps,
      system_consumed_power_w: accounting.system_consumed_power_w,
      system_ee_bits_per_j: accounting.system_ee_bits_per_j,
      per_user_contributions_bits_per_j: contributions,
      zero_over_zero: value.zero_over_zero ?? false,
    },
  };
}

function validateFixture(value: unknown): GoldenVectorFixture {
  if (!isRecord(value)) fail('CANONICAL_CONTRACT_MISMATCH', 'golden fixture must be an object');
  if (value.contract_version !== C120_ANGLE_AWARE_CONTRACT_VERSION) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'golden fixture contract version mismatch');
  }
  if (typeof value.canonical_runtime !== 'string' || !value.canonical_runtime.endsWith('angle_aware_ee.py')) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'golden fixture canonical runtime identity mismatch');
  }
  const tolerance = value.numeric_tolerance;
  if (!isRecord(tolerance) || typeof tolerance.rtol !== 'number' || typeof tolerance.atol !== 'number' ||
    !Number.isFinite(tolerance.rtol) || !Number.isFinite(tolerance.atol) || tolerance.rtol < 0 || tolerance.atol < 0) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'golden fixture numeric tolerance is invalid');
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) fail('CANONICAL_CONTRACT_MISMATCH', 'golden cases are missing');
  const cases = value.cases.map((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || !isRecord(candidate.inputs) || !isRecord(candidate.expected)) {
      fail('CANONICAL_CONTRACT_MISMATCH', `golden case ${index} is malformed`);
    }
    validateCanonicalInputs('closure', candidate.inputs);
    assertBridgeSafeInput(candidate.expected, `golden case ${candidate.id}.expected`);
    return candidate as unknown as GoldenVectorFixture['cases'][number];
  });
  const vector = value.evaluation_vector;
  if (!isRecord(vector) || !Array.isArray(vector.step_throughputs_bps) || !Array.isArray(vector.step_consumed_power_w) || !Array.isArray(vector.step_duration_s) ||
    vector.step_throughputs_bps.length !== vector.step_consumed_power_w.length || vector.step_throughputs_bps.length !== vector.step_duration_s.length) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'evaluation vector is malformed');
  }
  const stepThroughputs = vector.step_throughputs_bps as unknown[];
  const stepPowers = vector.step_consumed_power_w as unknown[];
  const stepDurations = vector.step_duration_s as unknown[];
  const numericVectorKeys = ['expected_delivered_bits', 'expected_consumed_energy_j', 'expected_energy_efficiency_bits_per_j'] as const;
  for (const key of numericVectorKeys) {
    if (typeof vector[key] !== 'number' || !Number.isFinite(vector[key])) fail('CANONICAL_CONTRACT_MISMATCH', `${key} is invalid`);
  }
  for (const key of ['step_throughputs_bps', 'step_consumed_power_w', 'step_duration_s'] as const) {
    const values = key === 'step_throughputs_bps' ? stepThroughputs : key === 'step_consumed_power_w' ? stepPowers : stepDurations;
    if (values.some((item: unknown) => typeof item !== 'number' || !Number.isFinite(item))) fail('CANONICAL_CONTRACT_MISMATCH', `${key} contains non-finite values`);
  }
  validateCanonicalInputs('evaluation', {
    step_throughputs_bps: stepThroughputs,
    step_consumed_power_w: stepPowers,
    step_duration_s: stepDurations,
  });
  return {
    schema_version: String(value.schema_version ?? ''),
    contract_version: value.contract_version,
    canonical_runtime: value.canonical_runtime,
    numeric_tolerance: tolerance as GoldenVectorFixture['numeric_tolerance'],
    cases,
    evaluation_vector: vector as unknown as GoldenVectorFixture['evaluation_vector'],
  };
}

function pythonBridgeRunner(pythonExecutable: string, timeoutMs: number): C120PinnedCanonicalRunner {
  return async (request, runtimeBytes, runtimePath) => {
    const bridge = [
      'import base64, gzip, json, sys, types',
      'runtime_path = sys.argv[1]',
      'request = json.loads(sys.argv[2])',
      'runtime_bytes = gzip.decompress(base64.b64decode(sys.argv[3], validate=True))',
      'import numpy as np',
      'module_name = "c120_pinned_angle_aware_ee"',
      'module = types.ModuleType(module_name)',
      'module.__file__ = runtime_path',
      'module.__package__ = ""',
      'sys.modules[module_name] = module',
      'exec(compile(runtime_bytes, runtime_path, "exec"), module.__dict__)',
      'def plain(value):',
      '    if hasattr(value, "__dataclass_fields__"): return {key: plain(getattr(value, key)) for key in value.__dataclass_fields__}',
      '    if isinstance(value, np.ndarray): return value.tolist()',
      '    if isinstance(value, np.generic): return value.item()',
      '    if isinstance(value, dict): return {key: plain(child) for key, child in value.items()}',
      '    if isinstance(value, (tuple, list)): return [plain(child) for child in value]',
      '    return value',
      'if request["mode"] == "closure": result = module.angle_aware_ee_closure(**request["inputs"])',
      'elif request["mode"] == "evaluation": result = module.evaluation_energy_efficiency(**request["inputs"])',
      'else: raise ValueError("unsupported canonical mode")',
      'print(json.dumps(plain(result), allow_nan=False, separators=(",", ":")))',
    ].join('\n');
    const args = [
      '-c',
      bridge,
      runtimePath,
      JSON.stringify({ mode: request.mode, inputs: request.inputs }),
      gzipSync(runtimeBytes).toString('base64'),
    ];

    // Use the asynchronous process API.  In the managed teaching workspace,
    // spawnSync can surface a spurious EPERM after a child has exited 0 and
    // produced valid output.  The asynchronous API reports the real process
    // lifecycle and still lets us bound time and output fail-closed.
    return new Promise<unknown>((resolve, reject) => {
      let child: ChildProcessByStdio<null, Readable, Readable>;
      try {
        child = spawn(pythonExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (error) {
        reject(new C120RealDataError(
          'CANONICAL_RUNTIME_UNAVAILABLE',
          error instanceof Error ? error.message : String(error),
        ));
        return;
      }

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;

      const finishWithError = (message: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new C120RealDataError('CANONICAL_RUNTIME_UNAVAILABLE', message));
      };
      const stopForOutputLimit = (stream: 'stdout' | 'stderr'): void => {
        try {
          child.kill('SIGKILL');
        } catch {
          // The bounded adapter is already failing closed; close/error events
          // remain guarded by `settled` if the sandbox refuses the signal.
        }
        finishWithError(`${stream} exceeded ${C120_MAX_CANONICAL_PROCESS_OUTPUT_BYTES} bytes`);
      };
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // See stopForOutputLimit: timeout still fails closed.
        }
        finishWithError(`canonical runtime exceeded ${timeoutMs} ms`);
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        if (settled) return;
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > C120_MAX_CANONICAL_PROCESS_OUTPUT_BYTES) {
          stopForOutputLimit('stdout');
          return;
        }
        stdoutChunks.push(chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        if (settled) return;
        stderrBytes += chunk.byteLength;
        if (stderrBytes > C120_MAX_CANONICAL_PROCESS_OUTPUT_BYTES) {
          stopForOutputLimit('stderr');
          return;
        }
        stderrChunks.push(chunk);
      });
      child.on('error', error => finishWithError(error.message));
      child.on('close', (code, signal) => {
        if (settled) return;
        clearTimeout(timer);
        if (code !== 0 || signal !== null) {
          const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
          finishWithError(
            `canonical runtime exited with code ${String(code)} signal ${String(signal)}`
              + (stderr === '' ? '' : `: ${stderr}`),
          );
          return;
        }
        try {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8');
          const parsed: unknown = JSON.parse(stdout);
          settled = true;
          resolve(parsed);
        } catch (error) {
          finishWithError(error instanceof Error ? error.message : String(error));
        }
      });
    });
  };
}

function defaultPythonExecutable(): string {
  const configured = process.env.C120_PYTHON;
  if (configured !== undefined && configured.trim() !== '') return resolve(configured);
  const preferred = resolve(C120_DEFAULT_RUNTIME_ROOT, '.venv/bin/python');
  return existsSync(preferred) ? preferred : 'python3';
}

function validateEvaluationOutput(actual: unknown, vector: GoldenVectorFixture['evaluation_vector'], rtol: number, atol: number): void {
  assertCanonicalEvaluationOutput(actual);
  const expected = {
    delivered_bits: vector.expected_delivered_bits,
    consumed_energy_j: vector.expected_consumed_energy_j,
    energy_efficiency_bits_per_j: vector.expected_energy_efficiency_bits_per_j,
    zero_over_zero: false,
  };
  compareExpected(actual, expected, 'evaluation', rtol, atol);
  const deliveredBits = (actual as Record<string, unknown>).delivered_bits as number;
  const consumedEnergy = (actual as Record<string, unknown>).consumed_energy_j as number;
  const efficiency = (actual as Record<string, unknown>).energy_efficiency_bits_per_j as number;
  if (consumedEnergy > 0) {
    const ratio = deliveredBits / consumedEnergy;
    if (Math.abs(efficiency - ratio) > atol + rtol * Math.abs(ratio)) {
      fail('CANONICAL_OUTPUT_INVALID', 'evaluation is not ratio of sums');
    }
  }
}

function assertCanonicalEvaluationOutput(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) fail('CANONICAL_OUTPUT_INVALID', 'evaluation output must be an object');
  assertFiniteDeep(value, 'evaluation');
  const deliveredBits = value.delivered_bits;
  const consumedEnergy = value.consumed_energy_j;
  const efficiency = value.energy_efficiency_bits_per_j;
  if (typeof deliveredBits !== 'number' || typeof consumedEnergy !== 'number' || typeof efficiency !== 'number') {
    fail('CANONICAL_OUTPUT_INVALID', 'evaluation output units are invalid');
  }
  if (deliveredBits < 0 || consumedEnergy < 0 || efficiency < 0) {
    fail('CANONICAL_OUTPUT_INVALID', 'evaluation output contains negative physical values');
  }
  if (consumedEnergy === 0) {
    if (deliveredBits > 0 || efficiency !== 0) {
      fail('CANONICAL_OUTPUT_INVALID', 'evaluation has positive bits or efficiency with zero energy');
    }
    return;
  }
  const ratio = deliveredBits / consumedEnergy;
  if (!Number.isFinite(ratio) || Math.abs(efficiency - ratio) > 1e-12 * Math.abs(ratio) + 1e-15) {
    fail('CANONICAL_OUTPUT_INVALID', 'evaluation is not ratio of sums');
  }
}

export function createC120CanonicalRuntimeAdapter(options: C120CanonicalAdapterOptions = {}): C120CanonicalRuntimeAdapter {
  const runtimePath = options.runtimePath ?? C120_DEFAULT_CANONICAL_RUNTIME_PATH;
  const goldenFixturePath = options.goldenFixturePath ?? C120_DEFAULT_GOLDEN_FIXTURE_PATH;
  const expectedRuntimeSha = options.runtimeSha256 ?? C120_CANONICAL_RUNTIME_SHA256;
  const expectedGoldenSha = options.goldenFixtureSha256 ?? C120_GOLDEN_FIXTURE_SHA256;
  const readFile = options.readFile ?? (async path => readFileAsync(path));
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) fail('CANONICAL_CONTRACT_MISMATCH', 'canonical timeoutMs must be a positive integer');
  if (options.runner !== undefined && options.allowUnpinnedTestRunner !== true) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'unpinned runner injection requires explicit test-only opt-in');
  }
  if (options.runner !== undefined && options.pinnedRunner !== undefined) {
    fail('CANONICAL_CONTRACT_MISMATCH', 'choose either an unpinned test runner or a pinned runner');
  }
  const injectedRunner = options.runner;
  // An injected runner is an explicit trusted-test boundary.  Production
  // file-backed runs execute the exact immutable byte snapshot whose hash was
  // accepted, rather than reopening runtimePath after verification.
  const pinnedRunner = options.pinnedRunner
    ?? pythonBridgeRunner(options.pythonExecutable ?? defaultPythonExecutable(), timeoutMs);

  interface PinnedFixture {
    readonly runtimeBytes: Uint8Array;
    readonly runtimeSha256: string;
    readonly goldenFixtureSha256: string;
    readonly fixture: GoldenVectorFixture;
  }

  let pinnedFixturePromise: Promise<PinnedFixture> | undefined;
  const loadPinnedFixture = async (): Promise<PinnedFixture> => {
    if (pinnedFixturePromise !== undefined) return pinnedFixturePromise;
    const pending = (async (): Promise<PinnedFixture> => {
      let runtimeBytes: string | Uint8Array;
      let goldenBytes: string | Uint8Array;
      try {
        [runtimeBytes, goldenBytes] = await Promise.all([readFile(runtimePath), readFile(goldenFixturePath)]);
      } catch (error) {
        return fail('CANONICAL_RUNTIME_UNAVAILABLE', error instanceof Error ? error.message : String(error));
      }
      const runtimeSnapshot = new Uint8Array(toBytes(runtimeBytes));
      const runtimeSha256 = sha256(runtimeSnapshot);
      const goldenFixtureSha256 = sha256(goldenBytes);
      if (runtimeSha256 !== expectedRuntimeSha) {
        return fail('CANONICAL_RUNTIME_DRIFT', `runtime SHA ${runtimeSha256} does not match pinned SHA ${expectedRuntimeSha}`);
      }
      if (goldenFixtureSha256 !== expectedGoldenSha) {
        return fail('CANONICAL_RUNTIME_DRIFT', `golden SHA ${goldenFixtureSha256} does not match pinned SHA ${expectedGoldenSha}`);
      }
      try {
        return {
          runtimeBytes: runtimeSnapshot,
          runtimeSha256,
          goldenFixtureSha256,
          fixture: validateFixture(JSON.parse(decodeUtf8(goldenBytes))),
        };
      } catch (error) {
        if (error instanceof C120RealDataError) throw error;
        return fail('CANONICAL_CONTRACT_MISMATCH', error instanceof Error ? error.message : String(error));
      }
    })();
    pinnedFixturePromise = pending.catch(error => {
      // Do not cache a failed read/hash/parse result; a caller may repair an
      // unavailable external checkout and retry deterministically.
      pinnedFixturePromise = undefined;
      throw error;
    });
    return pinnedFixturePromise;
  };

  const execute = async (
    request: C120CanonicalRunRequest,
    pinned?: PinnedFixture,
  ): Promise<unknown> => {
    if (request.mode !== 'closure' && request.mode !== 'evaluation') fail('CANONICAL_CONTRACT_MISMATCH', 'unsupported canonical mode');
    assertUnits(request.units);
    validateCanonicalInputs(request.mode, request.inputs);
    const rawOutput = injectedRunner !== undefined
      ? await injectedRunner(request)
      : pinned === undefined
        ? fail('CANONICAL_RUNTIME_UNAVAILABLE', 'verified runtime byte snapshot is missing')
        : await pinnedRunner(request, pinned.runtimeBytes, runtimePath);
    const output = request.mode === 'closure' ? normalizeClosureOutput(rawOutput) : rawOutput;
    assertFiniteDeep(output, `${request.mode} output`);
    if (request.mode === 'closure') assertCanonicalClosureOutput(output);
    if (request.mode === 'evaluation') assertCanonicalEvaluationOutput(output);
    return output;
  };

  const run = async (request: C120CanonicalRunRequest): Promise<unknown> => {
    if (injectedRunner !== undefined) return execute(request);
    const pinned = await loadPinnedFixture();
    return execute(request, pinned);
  };

  return Object.freeze({
    run,
    verifyAndRunGoldenVectors: async (): Promise<C120CanonicalVerification> => {
      const { fixture, runtimeBytes, runtimeSha256, goldenFixtureSha256 } = await loadPinnedFixture();
      const outputs: C120CanonicalCaseResult[] = [];
      for (const testCase of fixture.cases) {
        const output = await execute(
          { mode: 'closure', inputs: testCase.inputs, units: C120_CANONICAL_UNITS },
          { fixture, runtimeBytes, runtimeSha256, goldenFixtureSha256 },
        );
        assertCanonicalClosureOutput(output);
        compareExpected(output, testCase.expected, `case ${testCase.id}`, fixture.numeric_tolerance.rtol, fixture.numeric_tolerance.atol);
        outputs.push(Object.freeze({ id: testCase.id, mode: 'closure', output }));
      }
      const evaluationOutput = await execute(
        {
          mode: 'evaluation',
          inputs: {
            step_throughputs_bps: fixture.evaluation_vector.step_throughputs_bps,
            step_consumed_power_w: fixture.evaluation_vector.step_consumed_power_w,
            step_duration_s: fixture.evaluation_vector.step_duration_s,
          },
          units: C120_CANONICAL_UNITS,
        },
        { fixture, runtimeBytes, runtimeSha256, goldenFixtureSha256 },
      );
      validateEvaluationOutput(evaluationOutput, fixture.evaluation_vector, fixture.numeric_tolerance.rtol, fixture.numeric_tolerance.atol);
      return Object.freeze({
        runtimePath,
        goldenFixturePath,
        runtimeSha256,
        goldenFixtureSha256,
        contractVersion: C120_ANGLE_AWARE_CONTRACT_VERSION,
        numericTolerance: Object.freeze({ ...fixture.numeric_tolerance }),
        cases: Object.freeze(outputs),
        evaluation: Object.freeze({ id: 'evaluation_vector', mode: 'evaluation' as const, output: evaluationOutput }),
        verified: true,
      });
    },
  });
}

export const createC120CanonicalAdapter = createC120CanonicalRuntimeAdapter;
