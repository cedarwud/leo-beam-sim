import type { Profile } from '../profiles/types';
import {
  applySignalTuning,
  type SignalTuningState,
} from '../signalTuning';
import {
  applyLegacyConstellationPreset,
  applySceneTopology,
  type SceneTopologyState,
} from '../sceneTopology';
import {
  applyTrainingEnvAxesToProfile,
} from './trainingEnvAxesProfileAdapter';
import type { EnvAxes } from '../modqn/training-trigger/types';

export interface WalkerSignalProfileInput {
  readonly baseProfile: Profile;
  readonly signalTuning: SignalTuningState;
  readonly selectedTrainingEnvAxes: EnvAxes | undefined;
  readonly selectedTrainingSeedTriplet: readonly number[] | undefined;
  readonly activeSceneTopology: SceneTopologyState;
}

export function deriveWalkerSignalTunedProfile(
  input: WalkerSignalProfileInput,
): Profile {
  const signalProfile = applySignalTuning(input.baseProfile, input.signalTuning);
  const trainingProfile = applyTrainingEnvAxesToProfile(
    signalProfile,
    input.selectedTrainingEnvAxes,
    input.selectedTrainingSeedTriplet,
  );
  // Manual scene controls are the last live-sim layer, so changing a beam or
  // satellite count remains effective even when a training environment is loaded.
  return applySceneTopology(
    applyLegacyConstellationPreset(trainingProfile, input.activeSceneTopology.constellation),
    input.activeSceneTopology,
  );
}
