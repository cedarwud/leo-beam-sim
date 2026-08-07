/**
 * ADR-003 BeamShift producer for the SINR-live, earth-fixed-cell lane.
 *
 * This module maps live BeamShift truth into the canonical EE algebra. It is a
 * deliberately narrow partial-payload boundary, not whole-satellite power:
 *
 *   active beam = one live served (satId, cellId) cell record
 *   P_DL        = the BeamShift per-beam RF output control, dBm -> W
 *   U_{s,c}     = every UE assigned to the active (sat, cell), including outage
 *   R_u         = (B / reuse / U_{s,c}) log2(1 + SINR_u), from live UE SINR
 *
 * The 3 W teaching `circuitPowerW` knob is intentionally absent. It is neither
 * P_RFC, P_BB, nor an ADR-003 P_sys component.
 */

import type { SinrLiveCellFrame } from '../scene/sinrLiveCellModel';
import {
  computeEvaluationEeFromTotals,
  computeInstantaneousEe,
  sumInstantaneousPowerW,
  type EvaluationEeResult,
  type InstantaneousEeStatus,
} from './canonicalEnergyEfficiency';

export const BEAMSHIFT_CANONICAL_EE_SCOPE = 'ADR-003 BeamShift partial-payload' as const;

export const BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS = {
  pRfcWPerActiveBeam: 0.338,
  pBbWPerActiveSatellite: 0.2,
  /** PA eta_max; actual eta is evaluated per beam from P_DL and P_max. */
  paEtaMax: 0.35,
  paBackoffDb: 5,
  pEventWPerActiveBeam: 0,
  eventAssumption: 'scenario-assumption-zero',
  excludedFromBoundary: [
    'P_LO',
    'bus',
    'TT&C',
    'thermal',
    'antenna-pointing',
    'other-platform-loads',
  ],
} as const;

export type BeamshiftCanonicalEeInputErrorCode =
  | 'INVALID_FRAME_TIME'
  | 'INVALID_BANDWIDTH'
  | 'INVALID_FREQUENCY_REUSE'
  | 'INVALID_RF_OUTPUT_POWER'
  | 'INVALID_RATED_MAX_RF_OUTPUT'
  | 'RF_OUTPUT_OVER_RATED_MAX'
  | 'DUPLICATE_CELL'
  | 'DUPLICATE_ACTIVE_KEY'
  | 'ACTIVE_KEY_MISMATCH'
  | 'DUPLICATE_UE'
  | 'INVALID_UE_ID'
  | 'INCONSISTENT_SERVING_ASSIGNMENT'
  | 'MISSING_ACTIVE_BEAM'
  | 'NON_FINITE_SINR'
  | 'LIVE_POWER_MISMATCH'
  | 'LIVE_SINR_MISMATCH'
  | 'INVALID_DURATION'
  | 'OUT_OF_ORDER_FRAME';

/** Fail-closed producer/configuration error; callers must surface it as unavailable. */
export class BeamshiftCanonicalEeInputError extends RangeError {
  readonly code: BeamshiftCanonicalEeInputErrorCode;

  constructor(code: BeamshiftCanonicalEeInputErrorCode, message: string) {
    super(message);
    this.name = 'BeamshiftCanonicalEeInputError';
    this.code = code;
  }
}

export interface BeamshiftCanonicalEeInput {
  /** The same SINR-live cell frame consumed by the live scene and panel. */
  readonly frame: SinrLiveCellFrame;
  /** Current live channel bandwidth B, from SignalTuningState, in MHz. */
  readonly bandwidthMHz: number;
  /** Current live geographic frequency-reuse factor K. */
  readonly frequencyReuse: number;
  /**
   * Current BeamShift per-beam RF output control, in dBm. This is the value
   * applied to each SINR-live beam by the link-budget profile, not EIRP.
   */
  readonly rfOutputPowerDbm: number;
  /**
   * Governed rated maximum RF output P_max in W. This is distinct from the
   * actual P_DL derived from rfOutputPowerDbm; it is not inferred from the
   * root truth scenario and has no default here.
   */
  readonly ratedMaxRfOutputW: number;
}

export interface BeamshiftCanonicalBeamPower {
  readonly beamKey: string;
  readonly satId: string;
  readonly cellId: number;
  readonly activeBeamCountForSatellite: number;
  readonly rfOutputPowerDbm: number;
  readonly ratedMaxRfOutputW: number;
  /** ADR P_DL, RF output power after dBm -> W. */
  readonly downlinkPowerW: number;
  /** Actual eta_PA(P_DL), not eta_max. */
  readonly paEfficiency: number;
  readonly rfcPowerW: number;
  readonly basebandShareW: number;
  readonly paInputPowerW: number;
  readonly eventPowerW: 0;
  readonly totalPowerW: number;
}

export type BeamshiftCanonicalUeStatus = 'served' | 'outage' | 'unserved';

export interface BeamshiftCanonicalUeContribution {
  readonly ueId: string;
  readonly status: BeamshiftCanonicalUeStatus;
  readonly satId: string | null;
  readonly cellId: number | null;
  /** Assigned active-beam load U used to split this beam's bandwidth. */
  readonly assignedBeamLoad: number;
  readonly sinrDb: number | null;
  /** Per-UE equal-share bandwidth: (B/K)/U; zero when unserved. */
  readonly allocatedBandwidthMHz: number;
  readonly rateMbps: number;
  /** r_{1,u} = R_u / P_sys, not per-user physical power. */
  readonly contributionMbitPerJ: number;
}

export interface BeamshiftCanonicalInstantaneousEe {
  readonly scope: typeof BEAMSHIFT_CANONICAL_EE_SCOPE;
  readonly status: InstantaneousEeStatus;
  readonly frameSimTimeSec: number;
  readonly bandwidthMHz: number;
  readonly frequencyReuse: number;
  readonly allocatedBandwidthMHz: number;
  readonly rfOutputPowerDbm: number;
  readonly ratedMaxRfOutputW: number;
  readonly activeSatelliteCount: number;
  readonly activeBeamCount: number;
  readonly beams: readonly BeamshiftCanonicalBeamPower[];
  readonly users: readonly BeamshiftCanonicalUeContribution[];
  readonly totalThroughputMbps: number;
  readonly systemPowerW: number;
  readonly contributionSumMbitPerJ: number;
  readonly eeInstMbitPerJ: number;
  readonly sumIdentity: true;
}

function producerError(
  code: BeamshiftCanonicalEeInputErrorCode,
  message: string,
): never {
  throw new BeamshiftCanonicalEeInputError(code, message);
}

function beamKey(satId: string, cellId: number): string {
  return `${satId}#cell${cellId}`;
}

function numbersMatch(actual: number, expected: number): boolean {
  if (actual === expected) return true;
  return Number.isFinite(actual)
    && Number.isFinite(expected)
    && Math.abs(actual - expected) <= 1e-9;
}

function compareBeam(
  a: Pick<BeamshiftCanonicalBeamPower, 'satId' | 'cellId'>,
  b: Pick<BeamshiftCanonicalBeamPower, 'satId' | 'cellId'>,
): number {
  return a.satId.localeCompare(b.satId) || a.cellId - b.cellId;
}

function validateInput(input: BeamshiftCanonicalEeInput): {
  allocatedBandwidthMHz: number;
  downlinkPowerW: number;
} {
  const {
    frame,
    bandwidthMHz,
    frequencyReuse,
    rfOutputPowerDbm,
    ratedMaxRfOutputW,
  } = input;
  if (!Number.isFinite(frame.simTimeSec) || frame.simTimeSec < 0) {
    producerError('INVALID_FRAME_TIME', 'frame.simTimeSec must be finite and non-negative');
  }
  if (!Number.isFinite(bandwidthMHz) || bandwidthMHz <= 0) {
    producerError('INVALID_BANDWIDTH', 'bandwidthMHz must be finite and positive');
  }
  if (
    !Number.isFinite(frequencyReuse)
    || frequencyReuse <= 0
    || !Number.isInteger(frequencyReuse)
  ) {
    producerError(
      'INVALID_FREQUENCY_REUSE',
      'frequencyReuse must be a finite positive integer',
    );
  }
  if (!Number.isFinite(ratedMaxRfOutputW) || ratedMaxRfOutputW <= 0) {
    producerError(
      'INVALID_RATED_MAX_RF_OUTPUT',
      'ratedMaxRfOutputW must be finite and strictly positive P_max in W',
    );
  }
  // -Infinity dBm is the explicit zero-W RF-output limit. Other non-finite
  // dBm values are invalid; keeping this branch makes P_DL=0 testable without
  // inventing a second actual-power input beside the live dBm control.
  if (rfOutputPowerDbm !== Number.NEGATIVE_INFINITY && !Number.isFinite(rfOutputPowerDbm)) {
    producerError(
      'INVALID_RF_OUTPUT_POWER',
      'rfOutputPowerDbm must be finite dBm from the live BeamShift control',
    );
  }

  const allocatedBandwidthMHz = bandwidthMHz / frequencyReuse;
  const downlinkPowerW = rfOutputPowerDbm === Number.NEGATIVE_INFINITY
    ? 0
    : 10 ** ((rfOutputPowerDbm - 30) / 10);
  if (
    !Number.isFinite(allocatedBandwidthMHz)
    || allocatedBandwidthMHz <= 0
    || !Number.isFinite(downlinkPowerW)
    || downlinkPowerW < 0
  ) {
    producerError(
      'INVALID_RF_OUTPUT_POWER',
      'the live RF output control must convert to finite non-negative P_DL in W',
    );
  }
  if (downlinkPowerW > ratedMaxRfOutputW) {
    producerError(
      'RF_OUTPUT_OVER_RATED_MAX',
      `P_DL ${downlinkPowerW} W exceeds governed rated maximum P_max ${ratedMaxRfOutputW} W`,
    );
  }
  return { allocatedBandwidthMHz, downlinkPowerW };
}

function buildActiveBeams(
  frame: SinrLiveCellFrame,
  rfOutputPowerDbm: number,
  downlinkPowerW: number,
  ratedMaxRfOutputW: number,
): BeamshiftCanonicalBeamPower[] {
  const active: Array<{ satId: string; cellId: number; key: string }> = [];
  const seenCellIds = new Set<number>();
  const activeKeys = new Set<string>();

  for (const cell of frame.cells) {
    if (!Number.isInteger(cell.cellId) || cell.cellId < 0 || seenCellIds.has(cell.cellId)) {
      producerError('DUPLICATE_CELL', `cellId ${String(cell.cellId)} is invalid or duplicated`);
    }
    seenCellIds.add(cell.cellId);
    if (cell.servingSatId !== null) {
      if (cell.servingSatId.length === 0) {
        producerError('INCONSISTENT_SERVING_ASSIGNMENT', 'a serving satellite id cannot be empty');
      }
      const key = beamKey(cell.servingSatId, cell.cellId);
      if (activeKeys.has(key)) {
        producerError('DUPLICATE_ACTIVE_KEY', `active denominator key ${key} is duplicated`);
      }
      activeKeys.add(key);
      active.push({ satId: cell.servingSatId, cellId: cell.cellId, key });
    }
  }

  const servingIlluminatedKeys = new Set<string>();
  for (const illuminated of frame.illuminatedBeams) {
    if (!illuminated.serving) continue;
    if (
      illuminated.satId.length === 0
      || !Number.isInteger(illuminated.cellId)
      || illuminated.cellId < 0
    ) {
      producerError(
        'ACTIVE_KEY_MISMATCH',
        'a serving illuminated beam must carry a valid satId and cellId',
      );
    }
    const key = beamKey(illuminated.satId, illuminated.cellId);
    if (servingIlluminatedKeys.has(key)) {
      producerError('DUPLICATE_ACTIVE_KEY', `serving illuminated key ${key} is duplicated`);
    }
    servingIlluminatedKeys.add(key);
  }
  const missingKeys = [...activeKeys].filter(key => !servingIlluminatedKeys.has(key));
  const extraKeys = [...servingIlluminatedKeys].filter(key => !activeKeys.has(key));
  if (missingKeys.length > 0 || extraKeys.length > 0 || servingIlluminatedKeys.size !== activeKeys.size) {
    producerError(
      'ACTIVE_KEY_MISMATCH',
      `illuminatedBeams.filter(serving) must equal active cell keys; `
      + `missing=[${missingKeys.sort().join(',')}], extra=[${extraKeys.sort().join(',')}]`,
    );
  }

  active.sort((a, b) => a.satId.localeCompare(b.satId) || a.cellId - b.cellId);
  const activeCountBySat = new Map<string, number>();
  for (const beam of active) {
    activeCountBySat.set(beam.satId, (activeCountBySat.get(beam.satId) ?? 0) + 1);
  }

  return active.map(({ satId, cellId, key }) => {
    const activeBeamCountForSatellite = activeCountBySat.get(satId)!;
    const rfcPowerW = BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.pRfcWPerActiveBeam;
    const basebandShareW =
      BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.pBbWPerActiveSatellite
      / Math.max(1, activeBeamCountForSatellite);
    const paEfficiency = downlinkPowerW === 0
      ? 0
      : Math.min(
        BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.paEtaMax,
        BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.paEtaMax * Math.sqrt(
          downlinkPowerW
          / (
            ratedMaxRfOutputW
            * 10 ** (BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.paBackoffDb / 10)
          ),
        ),
      );
    if (!Number.isFinite(paEfficiency) || (downlinkPowerW > 0 && paEfficiency <= 0)) {
      producerError('INVALID_RF_OUTPUT_POWER', `P_DL ${downlinkPowerW} W produced invalid PA eta`);
    }
    const paInputPowerW = downlinkPowerW === 0 ? 0 : downlinkPowerW / paEfficiency;
    const eventPowerW = BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.pEventWPerActiveBeam;
    const totalPowerW = sumInstantaneousPowerW([
      { label: `${beamKey(satId, cellId)} P_RFC`, powerW: rfcPowerW },
      { label: `${beamKey(satId, cellId)} P_BB share`, powerW: basebandShareW },
      { label: `${beamKey(satId, cellId)} P_DL/eta_PA`, powerW: paInputPowerW },
      { label: `${beamKey(satId, cellId)} P_event`, powerW: eventPowerW },
    ]);

    return {
      beamKey: key,
      satId,
      cellId,
      activeBeamCountForSatellite,
      rfOutputPowerDbm,
      ratedMaxRfOutputW,
      downlinkPowerW,
      paEfficiency,
      rfcPowerW,
      basebandShareW,
      paInputPowerW,
      eventPowerW,
      totalPowerW,
    };
  });
}

interface PreparedUe {
  readonly ueId: string;
  readonly status: BeamshiftCanonicalUeStatus;
  readonly satId: string | null;
  readonly cellId: number | null;
  readonly sinrDb: number | null;
  readonly beamKey: string | null;
  readonly assignedBeamLoad: number;
  readonly rateMbps: number;
  /** B/K/U for an assigned UE; zero for an unserved UE. */
  readonly allocatedBandwidthMHz: number;
}

function buildRates(
  frame: SinrLiveCellFrame,
  activeBeamKeys: ReadonlySet<string>,
  allocatedBandwidthMHz: number,
  rfOutputPowerDbm: number,
): PreparedUe[] {
  const seenUeIds = new Set<string>();
  const assignedLoadByBeam = new Map<string, number>();
  for (const key of activeBeamKeys) assignedLoadByBeam.set(key, 0);

  const pending: Array<{
    readonly ueId: string;
    readonly status: BeamshiftCanonicalUeStatus;
    readonly satId: string | null;
    readonly cellId: number | null;
    readonly sinrDb: number | null;
    readonly beamKey: string | null;
  }> = [];

  for (const ue of frame.ues) {
    if (ue.ueId.length === 0) {
      producerError('INVALID_UE_ID', 'ueId cannot be empty');
    }
    if (seenUeIds.has(ue.ueId)) {
      producerError('DUPLICATE_UE', `ueId ${ue.ueId} is duplicated`);
    }
    seenUeIds.add(ue.ueId);

    if (ue.sinrDb !== null && !Number.isFinite(ue.sinrDb)) {
      producerError('NON_FINITE_SINR', `UE ${ue.ueId} SINR must be finite dB or null outage`);
    }

    if (ue.servingSatId === null) {
      if (ue.sinrDb !== null) {
        producerError(
          'INCONSISTENT_SERVING_ASSIGNMENT',
          `unserved UE ${ue.ueId} cannot carry a non-null SINR`,
        );
      }
      if (ue.servingLinkSample !== undefined && ue.servingLinkSample !== null) {
        producerError(
          'INCONSISTENT_SERVING_ASSIGNMENT',
          `unserved UE ${ue.ueId} cannot carry a servingLinkSample`,
        );
      }
      pending.push({
        ueId: ue.ueId,
        status: 'unserved',
        satId: null,
        cellId: ue.cellId,
        sinrDb: null,
        beamKey: null,
      });
      continue;
    }
    if (ue.cellId === null || !Number.isInteger(ue.cellId) || ue.cellId < 0) {
      producerError(
        'INCONSISTENT_SERVING_ASSIGNMENT',
        `served UE ${ue.ueId} must carry a valid earth-fixed cellId`,
      );
    }

    const key = beamKey(ue.servingSatId, ue.cellId);
    if (!activeBeamKeys.has(key)) {
      producerError(
        'MISSING_ACTIVE_BEAM',
        `served UE ${ue.ueId} references ${key}, which is not a live served cell beam`,
      );
    }

    assignedLoadByBeam.set(key, (assignedLoadByBeam.get(key) ?? 0) + 1);

    const sample = ue.servingLinkSample;
    if (sample !== undefined && sample !== null) {
      const expectedLinkBudgetBeamId = ue.cellId + 1;
      if (sample.satId !== ue.servingSatId || sample.beamId !== expectedLinkBudgetBeamId) {
        producerError(
          'INCONSISTENT_SERVING_ASSIGNMENT',
          `UE ${ue.ueId} servingLinkSample does not match its live (satId, cellId)`,
        );
      }
      if (
        !numbersMatch(sample.txPowerDbm, rfOutputPowerDbm)
      ) {
        producerError(
          'LIVE_POWER_MISMATCH',
          `UE ${ue.ueId} link sample power does not match the supplied live RF control`,
        );
      }
      if (ue.sinrDb === null || !numbersMatch(sample.sinrDb, ue.sinrDb)) {
        producerError(
          'LIVE_SINR_MISMATCH',
          `UE ${ue.ueId} servingLinkSample SINR does not match its live UE SINR`,
        );
      }
    }

    if (ue.sinrDb === null) {
      // The live model explicitly defines this as served-by-assignment but no
      // decodable sample. It is an outage (R_u=0), not fabricated SINR=0 dB.
      pending.push({
        ueId: ue.ueId,
        status: 'outage',
        satId: ue.servingSatId,
        cellId: ue.cellId,
        sinrDb: null,
        beamKey: key,
      });
      continue;
    }
    pending.push({
      ueId: ue.ueId,
      status: 'served',
      satId: ue.servingSatId,
      cellId: ue.cellId,
      sinrDb: ue.sinrDb,
      beamKey: key,
    });
  }

  return pending.map((user) => {
    if (user.beamKey === null) {
      return {
        ...user,
        assignedBeamLoad: 0,
        allocatedBandwidthMHz: 0,
        rateMbps: 0,
      };
    }
    const load = assignedLoadByBeam.get(user.beamKey);
    if (load === undefined || !Number.isInteger(load) || load <= 0) {
      producerError('INCONSISTENT_SERVING_ASSIGNMENT', `active beam ${user.beamKey} has invalid load`);
    }
    const perUeBandwidthMHz = allocatedBandwidthMHz / load;
    const rateMbps = user.sinrDb === null
      ? 0
      : perUeBandwidthMHz * Math.log2(1 + 10 ** (user.sinrDb / 10));
    if (!Number.isFinite(rateMbps) || rateMbps < 0) {
      producerError('NON_FINITE_SINR', `UE ${user.ueId} SINR cannot produce a finite rate`);
    }
    return {
      ...user,
      assignedBeamLoad: load,
      allocatedBandwidthMHz: perUeBandwidthMHz,
      rateMbps,
    };
  }).sort((a, b) => a.ueId.localeCompare(b.ueId));
}

/** Produce one canonical ADR-003 instantaneous BeamShift frame. */
export function computeBeamshiftCanonicalEe(
  input: BeamshiftCanonicalEeInput,
): BeamshiftCanonicalInstantaneousEe {
  const { allocatedBandwidthMHz, downlinkPowerW } = validateInput(input);
  const beams = buildActiveBeams(
    input.frame,
    input.rfOutputPowerDbm,
    downlinkPowerW,
    input.ratedMaxRfOutputW,
  ).sort(compareBeam);
  const activeBeamKeys = new Set(beams.map(beam => beam.beamKey));
  const preparedUsers = buildRates(
    input.frame,
    activeBeamKeys,
    allocatedBandwidthMHz,
    input.rfOutputPowerDbm,
  );
  const systemPowerW = sumInstantaneousPowerW(
    beams.map(beam => ({ label: beam.beamKey, powerW: beam.totalPowerW })),
  );
  const canonical = computeInstantaneousEe({
    ratesMbps: preparedUsers.map(user => user.rateMbps),
    systemPowerW,
  });
  const users = preparedUsers.map((user, index): BeamshiftCanonicalUeContribution => {
    const { beamKey: _beamKey, ...publicUser } = user;
    return {
      ...publicUser,
      contributionMbitPerJ: canonical.contributionsMbitPerJ[index]!,
    };
  });

  return {
    scope: BEAMSHIFT_CANONICAL_EE_SCOPE,
    status: canonical.status,
    frameSimTimeSec: input.frame.simTimeSec,
    bandwidthMHz: input.bandwidthMHz,
    frequencyReuse: input.frequencyReuse,
    allocatedBandwidthMHz,
    rfOutputPowerDbm: input.rfOutputPowerDbm,
    ratedMaxRfOutputW: input.ratedMaxRfOutputW,
    activeSatelliteCount: new Set(beams.map(beam => beam.satId)).size,
    activeBeamCount: beams.length,
    beams,
    users,
    totalThroughputMbps: canonical.totalThroughputMbps,
    systemPowerW: canonical.systemPowerW,
    contributionSumMbitPerJ: canonical.contributionSumMbitPerJ,
    eeInstMbitPerJ: canonical.eeInstMbitPerJ,
    sumIdentity: canonical.sumIdentity,
  };
}

export interface BeamshiftCanonicalEvaluationSnapshot {
  readonly scope: typeof BEAMSHIFT_CANONICAL_EE_SCOPE;
  readonly status: InstantaneousEeStatus;
  readonly sampleCount: number;
  readonly lastFrameSimTimeSec: number | null;
  readonly totalDataMbit: number;
  readonly totalEnergyJ: number;
  readonly eeEvalMbitPerJ: number;
}

/**
 * Stateful ratio-of-sums accumulator for a UI consumer.
 *
 * `append` requires an explicit positive sample duration. `seek` and `reset`
 * clear the old evaluation window; a backward/equal frame after a real sample
 * fails closed so a mixed timeline cannot silently enter the denominator.
 */
export class BeamshiftCanonicalEeAccumulator {
  private totalDataMbit = 0;
  private totalEnergyJ = 0;
  private sampleCount = 0;
  private lastFrameSimTimeSec: number | null = null;
  private seekAnchorSimTimeSec: number | null = null;

  snapshot(): BeamshiftCanonicalEvaluationSnapshot {
    const evaluation: EvaluationEeResult = computeEvaluationEeFromTotals({
      totalDataMbit: this.totalDataMbit,
      totalEnergyJ: this.totalEnergyJ,
    });
    return {
      scope: BEAMSHIFT_CANONICAL_EE_SCOPE,
      status: evaluation.status,
      sampleCount: this.sampleCount,
      lastFrameSimTimeSec: this.lastFrameSimTimeSec,
      totalDataMbit: evaluation.totalDataMbit,
      totalEnergyJ: evaluation.totalEnergyJ,
      eeEvalMbitPerJ: evaluation.eeEvalMbitPerJ,
    };
  }

  reset(): BeamshiftCanonicalEvaluationSnapshot {
    this.totalDataMbit = 0;
    this.totalEnergyJ = 0;
    this.sampleCount = 0;
    this.lastFrameSimTimeSec = null;
    this.seekAnchorSimTimeSec = null;
    return this.snapshot();
  }

  seek(targetSimTimeSec: number): BeamshiftCanonicalEvaluationSnapshot {
    if (!Number.isFinite(targetSimTimeSec) || targetSimTimeSec < 0) {
      producerError('INVALID_FRAME_TIME', 'seek target must be finite and non-negative seconds');
    }
    this.reset();
    this.seekAnchorSimTimeSec = targetSimTimeSec;
    return this.snapshot();
  }

  append(
    input: BeamshiftCanonicalEeInput,
    durationSec: number,
  ): {
    readonly instantaneous: BeamshiftCanonicalInstantaneousEe;
    readonly evaluation: BeamshiftCanonicalEvaluationSnapshot;
  } {
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      producerError('INVALID_DURATION', 'durationSec must be finite and positive');
    }
    if (
      this.seekAnchorSimTimeSec !== null
      && this.lastFrameSimTimeSec === null
      && input.frame.simTimeSec < this.seekAnchorSimTimeSec
    ) {
      producerError('OUT_OF_ORDER_FRAME', 'first frame after seek precedes the seek target');
    }
    if (
      this.lastFrameSimTimeSec !== null
      && input.frame.simTimeSec <= this.lastFrameSimTimeSec
    ) {
      producerError(
        'OUT_OF_ORDER_FRAME',
        'frame time must advance; call seek() or reset() before replaying a timeline',
      );
    }

    const instantaneous = computeBeamshiftCanonicalEe(input);
    const nextTotalDataMbit =
      this.totalDataMbit + instantaneous.totalThroughputMbps * durationSec;
    const nextTotalEnergyJ =
      this.totalEnergyJ + instantaneous.systemPowerW * durationSec;
    if (!Number.isFinite(nextTotalDataMbit) || !Number.isFinite(nextTotalEnergyJ)) {
      producerError('INVALID_DURATION', 'accumulated data and energy must remain finite');
    }
    this.totalDataMbit = nextTotalDataMbit;
    this.totalEnergyJ = nextTotalEnergyJ;
    this.sampleCount += 1;
    this.lastFrameSimTimeSec = input.frame.simTimeSec;
    this.seekAnchorSimTimeSec = null;
    return { instantaneous, evaluation: this.snapshot() };
  }
}
