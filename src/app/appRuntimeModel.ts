import {
  APP_MODE_DEFAULT_PROFILE,
  APP_MODE_HANDOVER_MAP,
  DEFAULT_APP_EXPERIENCE_MODE,
  readPersistedAppMode,
  readPersistedProfileByMode,
  resolveProfileForAppMode,
  type AppExperienceMode,
  type ProfileByMode,
} from './appExperienceMode';
import type { SceneLane } from './sceneLane';
import { profileList } from '../profiles';
import type { Profile } from '../profiles/types';
import type { PresentationMode } from '../scene/types';

const DEFAULT_PROFILE_ID = APP_MODE_DEFAULT_PROFILE['sinr-experiment'];

export type LeftSidebarTab = 'summary' | 'evidence';
export type RightSidebarTab = 'live' | 'artifact' | 'palette' | (string & {});

interface AppSidebarTabItem<T extends string> {
  key: T;
  label: string;
  description: string;
}

const LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  { key: 'summary', label: 'Live SINR', description: 'scene summary' },
  { key: 'evidence', label: 'Evidence / Replay', description: 'decision trace + artifact source' },
];

const SINR_LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[0], // summary
];

const ARTIFACT_LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[1], // evidence
];

const RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  { key: 'live', label: 'Live status', description: 'current scene state' },
];

const SINR_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  RIGHT_SIDEBAR_TABS[0],
];

// The root homepage renders its accepted-snapshot beam rail directly.  It no
// longer exposes a competing live-status/palette tab shell; the colour
// catalogue lives on the dedicated `/beam-colors` route instead.
const HOMEPAGE_SINR_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [];

const ARTIFACT_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  { key: 'artifact', label: 'Artifact truth', description: 'producer status' },
];

export interface InitialRuntimeState {
  readonly appMode: AppExperienceMode;
  readonly selectedProfileId: string;
  readonly handoverMode: 'sinr-offset';
  readonly profileByMode: ProfileByMode;
}

export function resolvePresentationMode(profile: Profile): PresentationMode {
  if (profile.id === APP_MODE_DEFAULT_PROFILE['sinr-experiment']) return 'demo-readability';
  if (profile.profileClass === 'candidate-rich') return 'candidate-rich';
  return 'research-default';
}

function isKnownProfileId(id: string): boolean {
  return profileList.some(p => p.id === id);
}

export function readInitialRuntimeState(): InitialRuntimeState {
  const appMode = readPersistedAppMode();
  const profileByMode = readPersistedProfileByMode();
  const selectedProfileId = resolveProfileForAppMode(appMode, profileByMode, isKnownProfileId);
  const handoverMode = APP_MODE_HANDOVER_MAP[appMode];
  const defaultState: InitialRuntimeState = {
    appMode,
    selectedProfileId: DEFAULT_PROFILE_ID,
    handoverMode,
    profileByMode,
  };
  return { ...defaultState, selectedProfileId };
}

/**
 * The public Walker App surface is the canonical paper-formula workspace.
 */
export function resolveHomepageInitialRuntimeState(
  persisted: InitialRuntimeState,
): InitialRuntimeState {
  const appMode = DEFAULT_APP_EXPERIENCE_MODE;
  return {
    ...persisted,
    appMode,
    selectedProfileId: resolveProfileForAppMode(
      appMode,
      persisted.profileByMode,
      isKnownProfileId,
    ),
    handoverMode: APP_MODE_HANDOVER_MAP[appMode],
  };
}

function getLeftSidebarTabsForMode(
  mode: string,
): readonly AppSidebarTabItem<LeftSidebarTab>[] {
  void mode;
  return SINR_LEFT_SIDEBAR_TABS;
}

export function getDefaultLeftSidebarTabForMode(mode: string): LeftSidebarTab {
  void mode;
  return 'summary';
}

export function getLeftSidebarTabsForSceneLane(
  lane: SceneLane,
  mode: string,
): readonly AppSidebarTabItem<LeftSidebarTab>[] {
  if (lane === 'artifact-replay') return ARTIFACT_LEFT_SIDEBAR_TABS;
  return getLeftSidebarTabsForMode(mode);
}

export function getDefaultLeftSidebarTabForSceneLane(
  lane: SceneLane,
  mode: string,
): LeftSidebarTab {
  if (lane === 'artifact-replay') return 'evidence';
  return getDefaultLeftSidebarTabForMode(mode);
}

function getRightSidebarTabsForMode(
  mode: string,
): readonly AppSidebarTabItem<RightSidebarTab>[] {
  void mode;
  return SINR_RIGHT_SIDEBAR_TABS;
}

function getDefaultRightSidebarTabForMode(_mode: string): RightSidebarTab {
  return 'live';
}

export function getRightSidebarTabsForSceneLane(
  lane: SceneLane,
  mode: string,
): readonly AppSidebarTabItem<RightSidebarTab>[] {
  if (lane === 'artifact-replay') return ARTIFACT_RIGHT_SIDEBAR_TABS;
  return getRightSidebarTabsForMode(mode);
}

/**
 * Root-only extension point for the homepage sidebar. The root SINR lane has
 * no tab list: the integration owner mounts its single accepted-snapshot rail
 * directly. This helper never broadens the tab set for other scene lanes.
 */
export function getHomepageRightSidebarTabsForSceneLane(
  lane: SceneLane,
  mode: string,
): readonly AppSidebarTabItem<RightSidebarTab>[] {
  if (lane === 'sinr-live') return HOMEPAGE_SINR_RIGHT_SIDEBAR_TABS;
  return getRightSidebarTabsForSceneLane(lane, mode);
}

export function getDefaultRightSidebarTabForSceneLane(
  lane: SceneLane,
  mode: string,
): RightSidebarTab {
  if (lane === 'artifact-replay') return 'artifact';
  return getDefaultRightSidebarTabForMode(mode);
}
