import {
  DEFAULT_UE_MOBILITY_PARAMS,
} from '../engine/ue/multiUeMobility';
import type { Profile } from '../profiles/types';
import {
  applySceneTopology,
  createSceneTopologyState,
  type SceneTopologyState,
} from '../sceneTopology';
import type { EnvAxes, TrainingRunMetadata } from '../modqn/training-trigger/types';

function txPowerWToDbm(txPowerW: number): number {
  return 10 * Math.log10(Math.max(txPowerW, 1e-9) * 1000);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isEnvAxes(value: unknown): value is EnvAxes {
  const record = asRecord(value);
  if (record === null) return false;
  return typeof record.nSatellites === 'number'
    && typeof record.altitudeKm === 'number'
    && typeof record.nUsers === 'number'
    && typeof record.userSpeedKmh === 'number'
    && asRecord(record.ueArea) !== null
    && asRecord(record.antenna) !== null
    && asRecord(record.channel) !== null;
}

export function envAxesFromTrainingRunMetadata(metadata: TrainingRunMetadata | null): EnvAxes | undefined {
  const record = asRecord(metadata);
  if (record === null) return undefined;

  for (const key of ['envAxes', 'env_axes', 'resolvedEnvAxes', 'resolved_env_axes']) {
    const candidate = record[key];
    if (isEnvAxes(candidate)) return candidate;
  }

  for (const key of ['trainingTruth', 'training_truth']) {
    const truth = asRecord(record[key]);
    if (truth !== null && isEnvAxes(truth.envAxes ?? truth.env_axes)) {
      return (truth.envAxes ?? truth.env_axes) as EnvAxes;
    }
  }

  return undefined;
}

export function seedTripletFromTrainingRunMetadata(metadata: TrainingRunMetadata | null): readonly number[] | undefined {
  const record = asRecord(metadata);
  if (record === null) return undefined;
  const candidate = record.seed_triplet ?? record.seedTriplet;
  if (!Array.isArray(candidate)) return undefined;
  const seedTriplet = candidate.filter(value => typeof value === 'number' && Number.isFinite(value));
  return seedTriplet.length === candidate.length ? seedTriplet : undefined;
}

function serviceAreaPassTargetsSecForSatelliteCount(count: number): number[] {
  const satelliteCount = Math.max(1, Math.trunc(count));
  if (satelliteCount === 4) return [100, 400, 700, 1000];
  const cycleSec = 1200;
  const spacingSec = cycleSec / satelliteCount;
  return Array.from({ length: satelliteCount }, (_, index) => Math.round((index + 0.5) * spacingSec));
}

export function sceneTopologyFromTrainingEnvAxes(envAxes: EnvAxes | undefined): SceneTopologyState {
  if (envAxes === undefined) return createSceneTopologyState();
  return {
    ...createSceneTopologyState(),
    // `nSatellites` is total training truth. Applying it as
    // `satsPerPlane` would multiply MODQN's service-area phased planes.
    satsPerPlane: null,
    beamCountPerSatellite: envAxes.antenna.beamsPerSatellite,
    ueCount: envAxes.nUsers,
    ueDistributionMode: 'random',
    ueMobilityMode: envAxes.ueArea.mobilityModel === 'random-wandering' ? 'random-walk' : 'static',
    ueMobilityParams: {
      ...DEFAULT_UE_MOBILITY_PARAMS,
      speedKmPerSec: envAxes.userSpeedKmh / 3600,
    },
    enableUeTrails: envAxes.ueArea.mobilityModel === 'random-wandering',
  };
}

export function applyTrainingEnvAxesToProfile(
  profile: Profile,
  envAxes: EnvAxes | undefined,
  seedTriplet: readonly number[] | undefined,
): Profile {
  if (envAxes === undefined) return profile;
  const mobilitySeed = seedTriplet?.[2];
  const topologyProfile = applySceneTopology(profile, sceneTopologyFromTrainingEnvAxes(envAxes));
  const primaryShell = topologyProfile.orbit.shells[0];
  const totalSatellites = Math.max(1, Math.trunc(envAxes.nSatellites));
  const shells = primaryShell === undefined
    ? topologyProfile.orbit.shells
    : [
        {
          ...primaryShell,
          altitudeKm: envAxes.altitudeKm,
          planes: totalSatellites,
          satsPerPlane: 1,
          serviceAreaPassTargetsSec: serviceAreaPassTargetsSecForSatelliteCount(totalSatellites),
          phasePerturbation: false,
        },
        ...topologyProfile.orbit.shells.slice(1),
      ];
  return {
    ...topologyProfile,
    orbit: { ...topologyProfile.orbit, shells },
    antenna: {
      ...topologyProfile.antenna,
      beamwidth3dBRad: (envAxes.antenna.theta3dbDeg * Math.PI) / 180,
    },
    channel: {
      ...topologyProfile.channel,
      frequencyGHz: envAxes.channel.carrierFrequencyGhz,
      bandwidthMHz: envAxes.channel.bandwidthMhz,
      maxTxPowerDbm: txPowerWToDbm(envAxes.channel.txPowerW),
    },
    ueDistribution: envAxes.ueArea.distribution === 'uniform-rectangle'
      ? {
          mode: 'uniform-rectangle',
          areaWidthKm: envAxes.ueArea.widthKm ?? 200,
          areaHeightKm: envAxes.ueArea.heightKm ?? 90,
          seed: typeof mobilitySeed === 'number' && Number.isFinite(mobilitySeed)
            ? Math.trunc(mobilitySeed)
            : profile.ueDistribution?.seed ?? 7,
          assumptionId: 'training-service-envAxes.ueArea',
          seedAssumptionId: 'training-service-seedTriplet.mobility',
        }
      : undefined,
  };
}

