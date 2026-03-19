import type { Profile } from './types';
import paperDefaultJson from './hobs-2024-paper-default.json';
import candidateRichJson from './hobs-2024-candidate-rich.json';

export const profiles: Record<string, Profile> = {
  'hobs-2024-paper-default': paperDefaultJson as Profile,
  'hobs-2024-candidate-rich': candidateRichJson as Profile,
};

export function loadProfile(id: string): Profile {
  const profile = profiles[id];
  if (!profile) throw new Error(`Unknown profile: ${id}`);
  return profile;
}
