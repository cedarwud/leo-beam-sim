import { useMemo } from 'react';
import { type Profile } from '../profiles/types';
import { deriveWalkerSignalTunedProfile, type WalkerSignalProfileInput } from './walkerSignalProfile';

export interface UseWalkerSignalProfileParameters {
  signalProfileInput: WalkerSignalProfileInput;
}

export interface UseWalkerSignalProfileResult {
  signalTunedProfile: Profile;
}

export function useWalkerSignalProfile({ signalProfileInput }: UseWalkerSignalProfileParameters): UseWalkerSignalProfileResult {
  const signalTunedProfile = useMemo(
      () => deriveWalkerSignalTunedProfile(signalProfileInput),
      [signalProfileInput],
    );
  return { signalTunedProfile };
}
