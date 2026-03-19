import type { Profile } from './types';
import hobsJson from './hobs-2024.json';

export const profiles: Record<string, Profile> = {
  'hobs-2024': hobsJson as Profile,
};

export function loadProfile(id: string): Profile {
  const profile = profiles[id];
  if (!profile) throw new Error(`Unknown profile: ${id}`);
  return profile;
}
