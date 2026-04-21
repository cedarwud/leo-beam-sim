import type { FormulaFamily, Profile } from './types';
import paperDefaultJson from './hobs-2024-paper-default.json';
import candidateRichJson from './hobs-2024-candidate-rich.json';
import tr38811ResearchJson from './hobs-2024-tr38811-research.json';

const profileEntries = [
  ['hobs-2024-candidate-rich', candidateRichJson as Profile],
  ['hobs-2024-paper-default', paperDefaultJson as Profile],
  ['hobs-2024-tr38811-research', tr38811ResearchJson as Profile],
] as const;

export const profiles: Record<string, Profile> = Object.fromEntries(profileEntries);

export const profileList: Profile[] = profileEntries.map(([, profile]) => profile);

export function loadProfile(id: string): Profile {
  const profile = profiles[id];
  if (!profile) throw new Error(`Unknown profile: ${id}`);
  return profile;
}

export function getFormulaFamilyLabel(formulaFamily: FormulaFamily): string {
  switch (formulaFamily) {
    case 'hobs-legacy':
      return 'HOBS Legacy';
    case 'hobs-tr38811':
      return 'HOBS + TR 38.811';
  }
}

export function getProfileLabel(profile: Profile): string {
  switch (profile.id) {
    case 'hobs-2024-candidate-rich':
      return 'HOBS Candidate-Rich Demo';
    case 'hobs-2024-paper-default':
      return 'HOBS Paper Default';
    case 'hobs-2024-tr38811-research':
      return 'HOBS + TR 38.811 Research';
    default:
      return profile.id;
  }
}
