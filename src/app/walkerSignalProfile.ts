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

export interface WalkerSignalProfileInput {
  readonly baseProfile: Profile;
  readonly signalTuning: SignalTuningState;
  readonly activeSceneTopology: SceneTopologyState;
}

export function deriveWalkerSignalTunedProfile(
  input: WalkerSignalProfileInput,
): Profile {
  const signalProfile = applySignalTuning(input.baseProfile, input.signalTuning);
  return applySceneTopology(
    applyLegacyConstellationPreset(signalProfile, input.activeSceneTopology.constellation),
    input.activeSceneTopology,
  );
}
