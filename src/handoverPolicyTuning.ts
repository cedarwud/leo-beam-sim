import type { Profile } from './profiles/types';

export type HandoverPolicyTuningState = Omit<
  Profile['handover'],
  'minimumDistinctCandidateSatellites'
>;

export function createHandoverPolicyTuningState(profile: Profile): HandoverPolicyTuningState {
  const { minimumDistinctCandidateSatellites: _minimumDistinctCandidateSatellites, ...state } = profile.handover;
  return state;
}

export function applyHandoverPolicyTuning(
  profile: Profile,
  tuning: HandoverPolicyTuningState,
): Profile {
  return {
    ...profile,
    handover: {
      ...profile.handover,
      ...tuning,
      policy: 'sinr-offset',
    },
  };
}

export function sameHandoverPolicyTuning(
  left: HandoverPolicyTuningState,
  right: HandoverPolicyTuningState,
): boolean {
  return left.policy === right.policy
    && left.sinrThresholdDb === right.sinrThresholdDb
    && left.offsetDb === right.offsetDb
    && left.triggerTimeSec === right.triggerTimeSec
    && left.pingPongGuardSec === right.pingPongGuardSec
    && left.pendingTargetHoldSec === right.pendingTargetHoldSec
    && left.intraSwitchTimeSec === right.intraSwitchTimeSec
    && left.maxIntraSwitchesPerServingEpoch === right.maxIntraSwitchesPerServingEpoch
    && left.sinrSmoothingSec === right.sinrSmoothingSec;
}

export function hasHandoverPolicyOverrides(
  profile: Profile,
  tuning: HandoverPolicyTuningState,
): boolean {
  return !sameHandoverPolicyTuning(createHandoverPolicyTuningState(profile), tuning);
}

export function getHandoverPolicyResetKey(tuning: HandoverPolicyTuningState): string {
  return [
    tuning.policy,
    tuning.offsetDb.toFixed(3),
    tuning.triggerTimeSec.toFixed(3),
    tuning.pingPongGuardSec.toFixed(3),
    tuning.sinrSmoothingSec.toFixed(3),
    tuning.intraSwitchTimeSec.toFixed(3),
    tuning.maxIntraSwitchesPerServingEpoch.toFixed(3),
    tuning.pendingTargetHoldSec.toFixed(3),
    tuning.sinrThresholdDb.toFixed(3),
  ].join('|');
}
