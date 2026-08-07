import type { LinkSample } from './types';
import {
  resolveMaxTxPowerDbm,
  type BeamPowerControlConfig,
  type Profile,
} from '../../profiles/types';

export interface BeamPowerControlState {
  txPowerDbm: number;
  stepDb: number;
  efficiencyScore: number | null;
}

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function beamPowerKey(satId: string, beamId: number): string {
  return `${satId}:${beamId}`;
}

export function buildBeamPowerOverrideDbmByKey(
  statesByKey: ReadonlyMap<string, BeamPowerControlState>,
): ReadonlyMap<string, number> {
  return new Map(
    [...statesByKey.entries()].map(([key, state]) => [key, state.txPowerDbm]),
  );
}

function computeEfficiencyScore(sample: LinkSample, txPowerDbm: number): number {
  const sinrLinear = Math.max(Math.pow(10, sample.sinrDb / 10), 0);
  const powerMw = Math.max(dbmToMw(txPowerDbm), 1e-9);
  return Math.log2(1 + sinrLinear) / powerMw;
}

export function updateBeamPowerControlStates(
  samples: LinkSample[],
  previousStatesByKey: ReadonlyMap<string, BeamPowerControlState>,
  powerControl: BeamPowerControlConfig,
  channel: Profile['channel'],
): Map<string, BeamPowerControlState> {
  const nextStatesByKey = new Map(previousStatesByKey);
  const maxTxPowerDbm = resolveMaxTxPowerDbm(channel);

  for (const sample of samples) {
    const key = beamPowerKey(sample.satId, sample.beamId);
    const previousState = nextStatesByKey.get(key) ?? {
      txPowerDbm: maxTxPowerDbm,
      stepDb: powerControl.stepDb,
      efficiencyScore: null,
    } satisfies BeamPowerControlState;
    let nextStepDb = previousState.stepDb;
    const nextEfficiencyScore = computeEfficiencyScore(sample, previousState.txPowerDbm);

    if (
      previousState.efficiencyScore !== null
      && nextEfficiencyScore <= previousState.efficiencyScore
    ) {
      nextStepDb = -nextStepDb;
    }

    if (sample.sinrDb < powerControl.sinrThresholdDb) {
      nextStepDb = Math.abs(nextStepDb);
    }

    const nextTxPowerDbm = clamp(
      previousState.txPowerDbm + nextStepDb,
      powerControl.minTxPowerDbm,
      maxTxPowerDbm,
    );

    nextStatesByKey.set(key, {
      txPowerDbm: nextTxPowerDbm,
      stepDb: nextStepDb,
      efficiencyScore: nextEfficiencyScore,
    });
  }

  return nextStatesByKey;
}
