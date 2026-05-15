import type { FormulaFamily, Profile } from './types';
import paperDefaultJson from './hobs-2024-paper-default.json';
import candidateRichJson from './hobs-2024-candidate-rich.json';
import tr38811ResearchJson from './hobs-2024-tr38811-research.json';
import mobileDemoAircraftJson from './hobs-2024-mobile-demo-aircraft.json';
import modqn1Sat7BeamJson from './modqn-1sat-7beam.json';

export const MODQN_1SAT_7BEAM_PROFILE_ID = 'modqn-1sat-7beam' as const;

const profileEntries = [
  ['hobs-2024-candidate-rich', candidateRichJson as Profile],
  ['hobs-2024-paper-default', paperDefaultJson as Profile],
  ['hobs-2024-tr38811-research', tr38811ResearchJson as Profile],
  ['hobs-2024-mobile-demo-aircraft', mobileDemoAircraftJson as Profile],
  [MODQN_1SAT_7BEAM_PROFILE_ID, modqn1Sat7BeamJson as Profile],
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
    case 'hobs-2024-mobile-demo-aircraft':
      return 'HOBS Aircraft Mobile Demo';
    case MODQN_1SAT_7BEAM_PROFILE_ID:
      return 'MODQN 1-sat 7-beam (replay)';
    default:
      return profile.id;
  }
}
