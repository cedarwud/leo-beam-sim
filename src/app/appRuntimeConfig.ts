import type { AppExperienceMode } from './appExperienceMode';
import { DEFAULT_UE_MOBILITY_PARAMS } from '../engine/ue/multiUeMobility';
import type { EnvAxes } from '../modqn/training-trigger/types';
import type { Profile } from '../profiles/types';
import type { RuntimeConfig, BeamDensity } from '../scene/types';
import type { SceneTopologyState } from '../sceneTopology';
import { resolvePresentationMode } from './appRuntimeModel';
import { sceneTopologyFromTrainingEnvAxes } from './trainingEnvAxesProfileAdapter';

export const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

const MODQN_PAPER_BASELINE_UE_COUNT = 100;

type RuntimeVisualSettings = Pick<
  RuntimeConfig,
  'beamDensity' | 'effectsEnabled' | 'cinematicMode' | 'reducedMotion'
>;

export interface AppRuntimeConfigInput {
  readonly appMode: AppExperienceMode;
  readonly effectiveProfile: Profile;
  readonly demoStartOffsetSec: number;
  readonly signalResetKey: string;
  readonly handoverResetKey: string;
  readonly runtimeVisualSettings: RuntimeVisualSettings;
  readonly beamDensityOverride: BeamDensity | null;
  readonly beamCalloutsEnabled: boolean;
  readonly effectiveCinematicMode: RuntimeConfig['cinematicMode'];
  readonly cameraCommand: RuntimeConfig['cameraCommand'];
  readonly viewport: RuntimeConfig['viewport'];
  readonly sceneTopology: SceneTopologyState;
  readonly selectedTrainingEnvAxes: EnvAxes | undefined;
}

export function buildAppRuntimeConfig(input: AppRuntimeConfigInput): RuntimeConfig {
  const trainingTopology = sceneTopologyFromTrainingEnvAxes(input.selectedTrainingEnvAxes);
  return {
    appMode: input.appMode,
    presentationMode: resolvePresentationMode(input.effectiveProfile),
    replay: {
      epochUtcMs: APP_EPOCH_MS,
      startOffsetSec: input.demoStartOffsetSec,
      loop: true,
    },
    signalResetKey: input.signalResetKey,
    handoverResetKey: input.handoverResetKey,
    ...input.runtimeVisualSettings,
    beamDensity: input.beamDensityOverride ?? input.runtimeVisualSettings.beamDensity,
    beamCalloutsEnabled: input.beamCalloutsEnabled,
    cinematicMode: input.effectiveCinematicMode,
    cameraCommand: input.cameraCommand,
    viewport: input.viewport,
    ueCount: input.appMode === 'sinr-experiment'
      ? input.sceneTopology.ueCount ?? undefined
      : input.selectedTrainingEnvAxes?.nUsers ?? MODQN_PAPER_BASELINE_UE_COUNT,
    cellServingCount: input.appMode === 'modqn-demo'
      ? input.sceneTopology.cellServingCount ?? undefined
      : undefined,
    ueDistributionMode: input.appMode === 'sinr-experiment'
      ? input.sceneTopology.ueDistributionMode ?? 'random'
      : trainingTopology.ueDistributionMode ?? 'random',
    uePrimaryAnchorMode: input.appMode === 'modqn-demo' ? 'distribution' : 'observer',
    ueDistributionScope: input.appMode === 'modqn-demo' ? 'service-area' : 'beam-footprint',
    ueDistributionRadiusKm: input.appMode === 'modqn-demo'
      && input.selectedTrainingEnvAxes?.ueArea.distribution === 'uniform-circular'
      ? input.selectedTrainingEnvAxes.ueArea.radiusKm
      : undefined,
    ueMobilityMode: input.appMode === 'sinr-experiment'
      ? input.sceneTopology.ueMobilityMode ?? 'static'
      : trainingTopology.ueMobilityMode ?? 'static',
    ueMobilityParams: input.appMode === 'sinr-experiment'
      ? input.sceneTopology.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS
      : trainingTopology.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS,
    enableUeTrails: input.appMode === 'sinr-experiment'
      ? input.sceneTopology.enableUeTrails === true
      : trainingTopology.enableUeTrails === true,
  };
}
