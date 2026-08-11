import {
  CANONICAL_EE_CONTRACT_VERSION,
  CanonicalEeInputError,
  DEFAULT_BACKOFF_DB,
  DEFAULT_EPSILON_NUM,
  DEFAULT_ETA_MAX,
  DEFAULT_G0_LINEAR,
  DEFAULT_THETA_3DB_RAD,
  type BooleanVector,
  type CanonicalEeConfig,
  type CanonicalEeFrameInput,
  type CanonicalEeInput,
  type CanonicalEeResult,
  type NumberMatrix,
  type NumberVector,
} from './types';

const BESSEL_SERIES_MAX_ABS_X = 34;
const GAIN_MU_SCALE = 2.07123;

function fail(code: ConstructorParameters<typeof CanonicalEeInputError>[0], message: string): never {
  throw new CanonicalEeInputError(code, message);
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function finiteNumber(value: number, name: string): number {
  if (!isFiniteNumber(value)) fail('INVALID_INPUT', `${name} must be finite`);
  return value;
}

function nonNegativeNumber(value: number, name: string): number {
  finiteNumber(value, name);
  if (value < 0) fail('INVALID_PHYSICAL_DOMAIN', `${name} must be non-negative`);
  return value;
}

function positiveNumber(value: number, name: string): number {
  finiteNumber(value, name);
  if (value <= 0) fail('INVALID_PHYSICAL_DOMAIN', `${name} must be positive`);
  return value;
}

function integer(value: number, name: string): number {
  finiteNumber(value, name);
  if (!Number.isInteger(value)) fail('INVALID_PHYSICAL_DOMAIN', `${name} must be an integer`);
  return value;
}

function cloneVector(values: readonly number[]): number[] {
  return values.map(value => value);
}

function cloneBooleanVector(values: readonly boolean[]): boolean[] {
  return values.map(value => value);
}

function cloneMatrix(values: readonly (readonly number[])[]): number[][] {
  return values.map(row => row.map(value => value));
}

function assertFiniteDerived(value: number | readonly number[] | readonly (readonly number[])[], name: string): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_AGGREGATE', `${name} must be finite`);
    return;
  }
  for (let index = 0; index < value.length; index += 1) {
    const child = value[index];
    if (Array.isArray(child)) assertFiniteDerived(child, `${name}[${index}]`);
    else if (!Number.isFinite(child)) fail('INVALID_AGGREGATE', `${name}[${index}] must be finite`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function validateMatrix(
  value: NumberMatrix,
  name: string,
  expectedUsers: number | null,
  expectedBeams: number | null,
  nonNegative: boolean,
): number[][] {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${name} must be an array of rows`);
  if (expectedUsers !== null && value.length !== expectedUsers) {
    fail('INVALID_SHAPE', `${name} must have ${expectedUsers} rows`);
  }
  let beamCount = expectedBeams;
  const result: number[][] = [];
  for (let user = 0; user < value.length; user += 1) {
    const row = value[user];
    if (!Array.isArray(row)) fail('INVALID_SHAPE', `${name}[${user}] must be an array`);
    if (beamCount === null) beamCount = row.length;
    if (row.length !== beamCount) fail('INVALID_SHAPE', `${name} rows must have equal length`);
    result.push(row.map((entry, beam) => {
      if (nonNegative) return nonNegativeNumber(entry, `${name}[${user}][${beam}]`);
      return finiteNumber(entry, `${name}[${user}][${beam}]`);
    }));
  }
  return result;
}

function validateVector(
  value: readonly number[],
  name: string,
  expectedLength: number,
  nonNegative: boolean,
): number[] {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    fail('INVALID_SHAPE', `${name} must have length ${expectedLength}`);
  }
  return value.map((entry, index) => (
    nonNegative
      ? nonNegativeNumber(entry, `${name}[${index}]`)
      : finiteNumber(entry, `${name}[${index}]`)
  ));
}

function validateBooleanVector(value: BooleanVector, name: string, expectedLength: number): boolean[] {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    fail('INVALID_SHAPE', `${name} must have length ${expectedLength}`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'boolean') fail('INVALID_INPUT', `${name}[${index}] must be boolean`);
    return entry;
  });
}

function broadcastNumber(value: number | NumberVector | undefined, length: number, name: string, nonNegative: boolean): number[] {
  if (value === undefined) return Array.from({ length }, () => 0);
  if (typeof value === 'number') {
    const checked = nonNegative ? nonNegativeNumber(value, name) : finiteNumber(value, name);
    return Array.from({ length }, () => checked);
  }
  return validateVector(value, name, length, nonNegative);
}

function validateConfig(config: CanonicalEeConfig, beamCount: number): {
  readonly noisePowerW: number;
  readonly beamBandwidthHz: number;
  readonly minimumRateBps: number;
  readonly beamPowerCapW: number[];
  readonly satellitePowerCapW: number;
  readonly g0Linear: number;
  readonly theta3dbRad: number;
  readonly rfcPowerW: number;
  readonly basebandPerSatelliteW: number;
  readonly frameDurationS: number;
  readonly backoffDb: number;
  readonly etaMax: number;
  readonly trainingEnergyJByBeam: number[];
  readonly trainingIndicatorByBeam: number[];
  readonly switchEnergyJ: number;
  readonly switchIndicatorByBeam: number[];
} {
  if (config === null || typeof config !== 'object') fail('INVALID_INPUT', 'config must be an object');
  const noisePowerW = positiveNumber(config.noisePowerW, 'noisePowerW');
  const beamBandwidthHz = positiveNumber(config.beamBandwidthHz, 'beamBandwidthHz');
  const minimumRateBps = nonNegativeNumber(config.minimumRateBps, 'minimumRateBps');
  const beamPowerCapW = broadcastNumber(config.beamPowerCapW, beamCount, 'beamPowerCapW', true);
  beamPowerCapW.forEach((value, index) => {
    if (value <= 0) fail('INVALID_PHYSICAL_DOMAIN', `beamPowerCapW[${index}] must be positive`);
  });
  const satellitePowerCapW = positiveNumber(config.satellitePowerCapW, 'satellitePowerCapW');
  const g0Linear = positiveNumber(config.g0Linear, 'g0Linear');
  const theta3dbRad = positiveNumber(config.theta3dbRad, 'theta3dbRad');
  const rfcPowerW = nonNegativeNumber(config.rfcPowerW, 'rfcPowerW');
  const basebandPerSatelliteW = nonNegativeNumber(config.basebandPerSatelliteW, 'basebandPerSatelliteW');
  const frameDurationS = positiveNumber(config.frameDurationS, 'frameDurationS');
  const backoffDb = config.backoffDb === undefined
    ? DEFAULT_BACKOFF_DB
    : finiteNumber(config.backoffDb, 'backoffDb');
  const etaMax = config.etaMax === undefined ? DEFAULT_ETA_MAX : positiveNumber(config.etaMax, 'etaMax');
  const trainingEnergyJByBeam = broadcastNumber(config.trainingEnergyJByBeam, beamCount, 'trainingEnergyJByBeam', true);
  const trainingIndicatorByBeam = broadcastNumber(config.trainingIndicatorByBeam, beamCount, 'trainingIndicatorByBeam', true);
  const switchEnergyJ = config.switchEnergyJ === undefined
    ? 0
    : nonNegativeNumber(config.switchEnergyJ, 'switchEnergyJ');
  const switchIndicatorByBeam = broadcastNumber(config.switchIndicatorByBeam, beamCount, 'switchIndicatorByBeam', true);
  return {
    noisePowerW,
    beamBandwidthHz,
    minimumRateBps,
    beamPowerCapW,
    satellitePowerCapW,
    g0Linear,
    theta3dbRad,
    rfcPowerW,
    basebandPerSatelliteW,
    frameDurationS,
    backoffDb,
    etaMax,
    trainingEnergyJByBeam,
    trainingIndicatorByBeam,
    switchEnergyJ,
    switchIndicatorByBeam,
  };
}

function validateFrame(frame: CanonicalEeFrameInput): {
  readonly thetaRadUb: number[][];
  readonly propagationGainUb: number[][];
  readonly receiveGainUb: number[][];
  readonly servingBeamU: number[];
  readonly beamActiveB: boolean[];
  readonly beamLoadB: number[];
  readonly beamSatelliteB: number[];
  readonly beamColorB: number[];
  readonly laggedInterferenceUW: number[];
  readonly userCount: number;
  readonly beamCount: number;
} {
  if (frame === null || typeof frame !== 'object') fail('INVALID_INPUT', 'frame must be an object');
  if (!Array.isArray(frame.thetaRadUb)) fail('INVALID_INPUT', 'thetaRadUb must be a matrix');
  const userCount = frame.thetaRadUb.length;
  const firstRow = userCount === 0 ? [] : frame.thetaRadUb[0];
  if (!Array.isArray(firstRow)) fail('INVALID_SHAPE', 'thetaRadUb rows must be arrays');
  const beamCount = firstRow.length;
  const thetaRadUb = validateMatrix(frame.thetaRadUb, 'thetaRadUb', userCount, beamCount, false);
  const propagationGainUb = validateMatrix(frame.propagationGainUb, 'propagationGainUb', userCount, beamCount, true);
  const receiveGainUb = validateMatrix(frame.receiveGainUb, 'receiveGainUb', userCount, beamCount, true);
  const servingBeamU = validateVector(frame.servingBeamU, 'servingBeamU', userCount, false).map((value, index) => {
    integer(value, `servingBeamU[${index}]`);
    if (value < -1 || value >= beamCount) fail('INVALID_PHYSICAL_DOMAIN', `servingBeamU[${index}] must be -1 or a valid beam index`);
    return value;
  });
  const beamActiveB = validateBooleanVector(frame.beamActiveB, 'beamActiveB', beamCount);
  const beamLoadB = validateVector(frame.beamLoadB, 'beamLoadB', beamCount, true).map((value, index) => {
    integer(value, `beamLoadB[${index}]`);
    return value;
  });
  const beamSatelliteB = validateVector(frame.beamSatelliteB, 'beamSatelliteB', beamCount, false).map((value, index) => {
    integer(value, `beamSatelliteB[${index}]`);
    if (value < 0) fail('INVALID_PHYSICAL_DOMAIN', `beamSatelliteB[${index}] must be non-negative`);
    return value;
  });
  const beamColorB = validateVector(frame.beamColorB, 'beamColorB', beamCount, false).map((value, index) => {
    integer(value, `beamColorB[${index}]`);
    return value;
  });
  const laggedInterferenceUW = validateVector(frame.laggedInterferenceUW, 'laggedInterferenceUW', userCount, true);

  const realizedLoads = Array.from({ length: beamCount }, () => 0);
  for (const serving of servingBeamU) if (serving >= 0) realizedLoads[serving] += 1;
  for (let beam = 0; beam < beamCount; beam += 1) {
    if (beamActiveB[beam] && beamLoadB[beam] <= 0) {
      fail('INVALID_PHYSICAL_DOMAIN', `active beam ${beam} must have positive load`);
    }
    if (!beamActiveB[beam] && beamLoadB[beam] !== 0) {
      fail('INVALID_PHYSICAL_DOMAIN', `inactive beam ${beam} must have zero load`);
    }
    if (beamLoadB[beam] !== realizedLoads[beam]) {
      fail('INVALID_INPUT', `beamLoadB[${beam}] must equal the serving-user count`);
    }
  }
  for (let user = 0; user < userCount; user += 1) {
    const serving = servingBeamU[user];
    if (serving >= 0 && !beamActiveB[serving]) fail('INVALID_INPUT', `served user ${user} points to inactive beam ${serving}`);
  }
  return {
    thetaRadUb,
    propagationGainUb,
    receiveGainUb,
    servingBeamU,
    beamActiveB,
    beamLoadB,
    beamSatelliteB,
    beamColorB,
    laggedInterferenceUW,
    userCount,
    beamCount,
  };
}

function besselJMillers(order: number, x: number): number {
  if (x < 0) return (order % 2 === 0 ? 1 : -1) * besselJMillers(order, -x);
  const startBase = order + x + 20 + 10 * Math.sqrt(x);
  let start = Math.trunc(startBase);
  if (start % 2 === 1) start += 1;
  let jHi = 0;
  let jCur = 1e-30;
  let target = 0;
  let norm = 0;
  for (let k = start; k >= 1; k -= 1) {
    const jLow = (2 * k / x) * jCur - jHi;
    if (k - 1 === order) target = jLow;
    if (k - 1 >= 2 && (k - 1) % 2 === 0) norm += 2 * jLow;
    jHi = jCur;
    jCur = jLow;
    if (Math.abs(jCur) > 1e250) {
      const scale = 1e-250;
      jCur *= scale;
      jHi *= scale;
      target *= scale;
      norm *= scale;
    }
  }
  norm += jCur;
  return target / norm;
}

function besselJInteger(order: number, x: number): number {
  if (!Number.isFinite(x)) fail('INVALID_INPUT', 'Bessel argument must be finite');
  if (x === 0) return order === 0 ? 1 : 0;
  if (Math.abs(x) > BESSEL_SERIES_MAX_ABS_X) return besselJMillers(order, x);
  let term = (0.5 * x) ** order / factorial(order);
  let total = term;
  const x2Over4 = (x * x) / 4;
  for (let m = 0; m < 200; m += 1) {
    term *= -x2Over4 / ((m + 1) * (m + order + 1));
    total += term;
    if (Math.abs(term) <= 1e-15 * Math.max(1, Math.abs(total))) break;
  }
  return total;
}

function factorial(value: number): number {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

/** Canonical Bessel beam pattern G_T(θ), including the boresight limit. */
export function approvedTransmitGainLinear(
  thetaRad: number,
  g0Linear: number = DEFAULT_G0_LINEAR,
  theta3dbRad: number = DEFAULT_THETA_3DB_RAD,
): number {
  positiveNumber(g0Linear, 'g0Linear');
  positiveNumber(theta3dbRad, 'theta3dbRad');
  finiteNumber(thetaRad, 'thetaRad');
  const mu = GAIN_MU_SCALE * Math.sin(thetaRad) / Math.sin(theta3dbRad);
  if (Math.abs(mu) < 1e-10) return g0Linear;
  const j1 = besselJInteger(1, mu);
  const j3 = besselJInteger(3, mu);
  const bracket = j1 / (2 * mu) + 36 * j3 / (mu ** 3);
  return g0Linear * (bracket ** 2);
}

function gainMatrix(theta: number[][], g0Linear: number, theta3dbRad: number): number[][] {
  return theta.map(row => row.map(value => approvedTransmitGainLinear(value, g0Linear, theta3dbRad)));
}

function requireIdentity(contributions: readonly number[], expected: number): number {
  const actual = contributions.reduce((sum, value) => sum + value, 0);
  const error = actual - expected;
  const tolerance = Math.max(8, 4 * contributions.length) * Number.EPSILON * Math.max(1, Math.abs(expected));
  if (Math.abs(error) > tolerance) fail('INVALID_AGGREGATE', 'per-user r1 sum identity failed');
  return error;
}

function additiveEe(rates: readonly number[], systemPowerW: number): {
  readonly r1: number[];
  readonly systemEe: number;
  readonly contributionSum: number;
  readonly zeroOverZero: boolean;
  readonly identityError: number;
} {
  rates.forEach((rate, index) => nonNegativeNumber(rate, `rateUBps[${index}]`));
  nonNegativeNumber(systemPowerW, 'systemPowerW');
  const totalRate = rates.reduce((sum, rate) => sum + rate, 0);
  if (systemPowerW === 0) {
    if (totalRate > 0) fail('POSITIVE_RATE_ZERO_POWER', 'positive throughput with zero consumed power is invalid');
    return { r1: rates.map(() => 0), systemEe: 0, contributionSum: 0, zeroOverZero: true, identityError: 0 };
  }
  const r1 = rates.map(rate => rate / systemPowerW);
  const systemEe = totalRate / systemPowerW;
  const contributionSum = r1.reduce((sum, value) => sum + value, 0);
  const identityError = requireIdentity(r1, systemEe);
  return { r1, systemEe, contributionSum, zeroOverZero: false, identityError };
}

/**
 * Produce one pure canonical frame. No page-specific or teaching formula is
 * involved: every downstream quantity consumes the same post-cap P_DL vector.
 */
export function computeCanonicalEe(input: CanonicalEeInput): CanonicalEeResult {
  if (input === null || typeof input !== 'object') fail('INVALID_INPUT', 'input must be an object');
  const frame = validateFrame(input.frame);
  const config = validateConfig(input.config, frame.beamCount);
  const {
    thetaRadUb,
    propagationGainUb,
    receiveGainUb,
    servingBeamU,
    beamActiveB,
    beamLoadB,
    beamSatelliteB,
    beamColorB,
    laggedInterferenceUW,
    userCount,
    beamCount,
  } = frame;

  const transmitGainUb = gainMatrix(thetaRadUb, config.g0Linear, config.theta3dbRad);
  const compositeGainUb = thetaRadUb.map((row, user) => row.map((_, beam) => (
    propagationGainUb[user]![beam]! * transmitGainUb[user]![beam]! * receiveGainUb[user]![beam]!
  )));

  const gammaReqB = Array.from({ length: beamCount }, (_, beam) => beamActiveB[beam]
    ? 2 ** (config.minimumRateBps * beamLoadB[beam]! / config.beamBandwidthHz) - 1
    : 0);

  const pReqUW = Array.from({ length: userCount }, () => 0);
  for (let user = 0; user < userCount; user += 1) {
    const beam = servingBeamU[user]!;
    if (beam < 0) continue;
    const denominator = Math.max(compositeGainUb[user]![beam]!, DEFAULT_EPSILON_NUM);
    pReqUW[user] = gammaReqB[beam]! * (laggedInterferenceUW[user]! + config.noisePowerW) / denominator;
  }

  const pReqBW = Array.from({ length: beamCount }, () => 0);
  for (let beam = 0; beam < beamCount; beam += 1) {
    let max = 0;
    for (let user = 0; user < userCount; user += 1) {
      if (servingBeamU[user] === beam && pReqUW[user]! > max) max = pReqUW[user]!;
    }
    pReqBW[beam] = max;
  }
  const pDlBeforeSatelliteCapBW = pReqBW.map((request, beam) => (
    beamActiveB[beam] ? Math.min(config.beamPowerCapW[beam]!, request) : 0
  ));

  const satelliteScaleB = Array.from({ length: beamCount }, () => 1);
  const pDlActualBW = cloneVector(pDlBeforeSatelliteCapBW);
  const satellites = [...new Set(beamSatelliteB)];
  for (const satellite of satellites) {
    const members = beamSatelliteB
      .map((value, beam) => value === satellite ? beam : -1)
      .filter(beam => beam >= 0);
    const total = members.reduce((sum, beam) => sum + pDlBeforeSatelliteCapBW[beam]!, 0);
    const scale = total > config.satellitePowerCapW ? config.satellitePowerCapW / total : 1;
    for (const beam of members) {
      satelliteScaleB[beam] = scale;
      pDlActualBW[beam] = pDlBeforeSatelliteCapBW[beam]! * scale;
    }
  }

  const receivedPowerUbW = compositeGainUb.map(row => row.map((gain, beam) => gain * pDlActualBW[beam]!));
  const signalUW = Array.from({ length: userCount }, () => 0);
  const interferenceUW = Array.from({ length: userCount }, () => 0);
  for (let user = 0; user < userCount; user += 1) {
    const serving = servingBeamU[user]!;
    if (serving < 0) continue;
    signalUW[user] = receivedPowerUbW[user]![serving]!;
    let sum = 0;
    for (let beam = 0; beam < beamCount; beam += 1) {
      if (beamActiveB[beam] && beamColorB[beam] === beamColorB[serving]) sum += receivedPowerUbW[user]![beam]!;
    }
    interferenceUW[user] = Math.max(sum - signalUW[user]!, 0);
  }
  const sinrU = signalUW.map((signal, user) => (
    servingBeamU[user]! >= 0 ? signal / (interferenceUW[user]! + config.noisePowerW) : 0
  ));
  const rateUBps = sinrU.map((sinr, user) => {
    const serving = servingBeamU[user]!;
    if (serving < 0) return 0;
    return config.beamBandwidthHz / beamLoadB[serving]! * Math.log2(1 + sinr);
  });
  const qosMetU = rateUBps.map((rate, user) => servingBeamU[user]! >= 0 && rate >= config.minimumRateBps);
  const powerLimitedU = pReqUW.map((request, user) => {
    const serving = servingBeamU[user]!;
    return serving >= 0 && request > pDlActualBW[serving]!;
  });

  const etaPaB = pDlActualBW.map((pDl, beam) => {
    const pSat = config.beamPowerCapW[beam]! * 10 ** (config.backoffDb / 10);
    const ratio = pDl / Math.max(pSat, DEFAULT_EPSILON_NUM);
    return Math.min(config.etaMax, Math.max(0, config.etaMax * Math.sqrt(Math.max(ratio, 0))));
  });
  const activeCountBySatellite = new Map<number, number>();
  for (let beam = 0; beam < beamCount; beam += 1) {
    if (beamActiveB[beam]) activeCountBySatellite.set(
      beamSatelliteB[beam]!,
      (activeCountBySatellite.get(beamSatelliteB[beam]!) ?? 0) + 1,
    );
  }
  const pRfcBW = beamActiveB.map(active => active ? config.rfcPowerW : 0);
  const pBbBW = beamActiveB.map((active, beam) => active
    ? config.basebandPerSatelliteW / (activeCountBySatellite.get(beamSatelliteB[beam]!) ?? 1)
    : 0);
  const trainingPowerBW = config.trainingEnergyJByBeam.map((energy, beam) => (
    energy * config.trainingIndicatorByBeam[beam]! / config.frameDurationS
  ));
  const switchPowerBW = config.switchIndicatorByBeam.map(indicator => (
    config.switchEnergyJ * indicator / config.frameDurationS
  ));
  const pEventBW = trainingPowerBW.map((value, beam) => value + switchPowerBW[beam]!);
  const pPaBW = pDlActualBW.map((pDl, beam) => {
    if (pDl === 0) return 0;
    const eta = etaPaB[beam]!;
    if (eta <= 0) fail('INVALID_PHYSICAL_DOMAIN', `positive P_DL on beam ${beam} requires positive PA efficiency`);
    return pDl / eta;
  });
  const pTotBW = pDlActualBW.map((_, beam) => pRfcBW[beam]! + pBbBW[beam]! + pPaBW[beam]! + pEventBW[beam]!);
  const systemPowerW = pTotBW.reduce((sum, value) => sum + value, 0);
  const totalRateBps = rateUBps.reduce((sum, value) => sum + value, 0);
  assertFiniteDerived(transmitGainUb, 'transmitGainUb');
  assertFiniteDerived(compositeGainUb, 'compositeGainUb');
  assertFiniteDerived(gammaReqB, 'gammaReqB');
  assertFiniteDerived(pReqUW, 'pReqUW');
  assertFiniteDerived(pReqBW, 'pReqBW');
  assertFiniteDerived(pDlBeforeSatelliteCapBW, 'pDlBeforeSatelliteCapBW');
  assertFiniteDerived(satelliteScaleB, 'satelliteScaleB');
  assertFiniteDerived(pDlActualBW, 'pDlActualBW');
  assertFiniteDerived(receivedPowerUbW, 'receivedPowerUbW');
  assertFiniteDerived(signalUW, 'signalUW');
  assertFiniteDerived(interferenceUW, 'interferenceUW');
  assertFiniteDerived(sinrU, 'sinrU');
  assertFiniteDerived(rateUBps, 'rateUBps');
  assertFiniteDerived(etaPaB, 'etaPaB');
  assertFiniteDerived(pRfcBW, 'pRfcBW');
  assertFiniteDerived(pBbBW, 'pBbBW');
  assertFiniteDerived(pEventBW, 'pEventBW');
  assertFiniteDerived(pPaBW, 'pPaBW');
  assertFiniteDerived(pTotBW, 'pTotBW');
  assertFiniteDerived(systemPowerW, 'systemPowerW');
  assertFiniteDerived(totalRateBps, 'totalRateBps');
  const additive = additiveEe(rateUBps, systemPowerW);

  const normalizedInput: CanonicalEeInput = {
    config: {
      ...input.config,
      beamPowerCapW: cloneVector(config.beamPowerCapW),
      backoffDb: config.backoffDb,
      etaMax: config.etaMax,
      trainingEnergyJByBeam: cloneVector(config.trainingEnergyJByBeam),
      trainingIndicatorByBeam: cloneVector(config.trainingIndicatorByBeam),
      switchEnergyJ: config.switchEnergyJ,
      switchIndicatorByBeam: cloneVector(config.switchIndicatorByBeam),
    },
    frame: {
      thetaRadUb: cloneMatrix(thetaRadUb),
      propagationGainUb: cloneMatrix(propagationGainUb),
      receiveGainUb: cloneMatrix(receiveGainUb),
      servingBeamU: cloneVector(servingBeamU),
      beamActiveB: cloneBooleanVector(beamActiveB),
      beamLoadB: cloneVector(beamLoadB),
      beamSatelliteB: cloneVector(beamSatelliteB),
      beamColorB: cloneVector(beamColorB),
      laggedInterferenceUW: cloneVector(laggedInterferenceUW),
    },
  };
  const result: CanonicalEeResult = {
    contractVersion: CANONICAL_EE_CONTRACT_VERSION,
    inputs: normalizedInput,
    transmitGainUb,
    compositeGainUb,
    gammaReqB,
    receivedPowerUbW,
    power: {
      pReqUW,
      pReqBW,
      pDlBeforeSatelliteCapBW,
      satelliteScaleB,
      pDlActualBW,
      paEfficiencyB: etaPaB,
      pPaBW,
      pRfcBW,
      pBbBW,
      pEventBW,
      pTotBW,
      systemPowerW,
    },
    throughput: {
      signalUW,
      interferenceUW,
      sinrU,
      rateUBps,
      totalRateBps,
      qosMetU,
      powerLimitedU,
    },
    ee: {
      r1UBitsPerJ: additive.r1,
      systemEeBitsPerJ: additive.systemEe,
      contributionSumBitsPerJ: additive.contributionSum,
      sumIdentity: true,
      sumIdentityErrorBitsPerJ: additive.identityError,
      zeroOverZero: additive.zeroOverZero,
    },
    pReqUW,
    pReqBW,
    pDlBeforeSatelliteCapBW,
    satelliteScaleB,
    pDlActualBW,
    etaPaB,
    pTotBW,
    signalUW,
    interferenceUW,
    sinrU,
    rateUBps,
    r1UBitsPerJ: additive.r1,
  };
  return deepFreeze(result);
}

/** Formal instantaneous additive system EE helper, also useful for adapters. */
export function computeAdditiveSystemEe(
  userThroughputsBps: readonly number[],
  systemConsumedPowerW: number,
): Pick<CanonicalEeResult['ee'], 'r1UBitsPerJ' | 'systemEeBitsPerJ' | 'contributionSumBitsPerJ' | 'sumIdentity' | 'zeroOverZero'> {
  const additive = additiveEe(userThroughputsBps, systemConsumedPowerW);
  return {
    r1UBitsPerJ: deepFreeze(additive.r1),
    systemEeBitsPerJ: additive.systemEe,
    contributionSumBitsPerJ: additive.contributionSum,
    sumIdentity: true,
    zeroOverZero: additive.zeroOverZero,
  };
}

/** Naming aliases for controller adapters that call a result a frame. */
export const computeCanonicalEeFrame = computeCanonicalEe;
export const computeAngleAwareEe = computeCanonicalEe;
