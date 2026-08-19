import type { Profile } from '../profiles/types';
import type { RuntimeConfig } from './types';
import { resolveSinrLiveBeamCapacityPerSat } from './sinrLiveCellRuntime';
import { resolveSinrLiveBeamBudget } from './sinrLiveBeamBudget';

export interface SinrLiveBeamDisplayLane {
  readonly satelliteId: string | null;
  readonly configuredBeamCount: number;
}

export type SinrLiveBeamDisplayRuntime = Pick<
  RuntimeConfig,
  'beamCountBySatellite' | 'servingBeamCount' | 'candidateBeamCount' | 'beamHoppingEnabled'
>;

/**
 * One presentation-only configuration shared by the SINR-live canvas and the
 * legacy result rail. It resolves the displayed global/serving/candidate
 * budgets and the hopping label; it never changes a model input or a decision.
 */
export interface SinrLiveBeamDisplayFrame {
  readonly schemaVersion: 'sinr-live-beam-display-frame-v1';
  readonly globalSatelliteCount: number;
  readonly globalBeamCount: number;
  readonly beamHoppingEnabled: boolean;
  readonly serving: SinrLiveBeamDisplayLane;
  readonly candidate: SinrLiveBeamDisplayLane;
}

export function resolveSinrLiveSatelliteCount(profile: Profile): number {
  return profile.orbit.shells.reduce(
    (total, shell) => total + shell.planes * shell.satsPerPlane,
    0,
  );
}

function normalizeGlobalBeamOverride(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value));
}

export function resolveSinrLiveGlobalBeamCount(input: {
  readonly profile: Profile;
  readonly runtime: SinrLiveBeamDisplayRuntime;
}): number {
  const beamsPerSatellite = resolveSinrLiveBeamCapacityPerSat(input.profile);
  const satelliteCount = resolveSinrLiveSatelliteCount(input.profile);
  const overrides = input.runtime.beamCountBySatellite ?? {};
  return Object.entries(overrides).reduce((total, [, rawOverride]) => {
    const override = normalizeGlobalBeamOverride(rawOverride);
    return override === undefined
      ? total
      : total + override - beamsPerSatellite;
  }, satelliteCount * beamsPerSatellite);
}

export function resolveSinrLiveConfiguredBeamCount(input: {
  readonly profile: Profile;
  readonly runtime: SinrLiveBeamDisplayRuntime;
  readonly satelliteId?: string | null;
  readonly role?: 'serving' | 'candidate';
}): number {
  const globalBeamCount = resolveSinrLiveBeamCapacityPerSat(input.profile);
  return resolveSinrLiveBeamBudget({
    fallbackBeamCount: globalBeamCount,
    satelliteId: input.satelliteId,
    roleBeamCount: input.role === 'serving'
      ? input.runtime.servingBeamCount
      : input.role === 'candidate'
        ? input.runtime.candidateBeamCount
        : undefined,
    beamCountBySatellite: input.runtime.beamCountBySatellite,
  });
}

export function createSinrLiveBeamDisplayFrame(input: {
  readonly profile: Profile;
  readonly runtime: SinrLiveBeamDisplayRuntime;
  readonly servingSatelliteId?: string | null;
  readonly candidateSatelliteId?: string | null;
}): SinrLiveBeamDisplayFrame {
  const globalSatelliteCount = resolveSinrLiveSatelliteCount(input.profile);
  const globalBeamCount = resolveSinrLiveGlobalBeamCount({
    profile: input.profile,
    runtime: input.runtime,
  });
  const servingSatelliteId = input.servingSatelliteId ?? null;
  const candidateSatelliteId = input.candidateSatelliteId ?? null;
  return Object.freeze({
    schemaVersion: 'sinr-live-beam-display-frame-v1' as const,
    globalSatelliteCount,
    globalBeamCount,
    beamHoppingEnabled: input.runtime.beamHoppingEnabled ?? false,
    serving: Object.freeze({
      satelliteId: servingSatelliteId,
      configuredBeamCount: resolveSinrLiveConfiguredBeamCount({
        profile: input.profile,
        runtime: input.runtime,
        satelliteId: servingSatelliteId,
        role: 'serving',
      }),
    }),
    candidate: Object.freeze({
      satelliteId: candidateSatelliteId,
      configuredBeamCount: resolveSinrLiveConfiguredBeamCount({
        profile: input.profile,
        runtime: input.runtime,
        satelliteId: candidateSatelliteId,
        role: 'candidate',
      }),
    }),
  });
}
