import type { RuntimeHandoverMode, RuntimeOmegaState } from '../modqn/runtimeControls';
import { MODQN_PAPER_FAITHFUL_OMEGA } from '../modqn/runtimeControls';
import {
  APP_MODE_DEFAULT_PROFILE,
  APP_MODE_HANDOVER_MAP,
  readPersistedAppMode,
  readPersistedProfileByMode,
  resolveProfileForAppMode,
  type AppExperienceMode,
  type ProfileByMode,
} from './appExperienceMode';
import { profileList } from '../profiles';
import type { Profile } from '../profiles/types';
import type { PresentationMode } from '../scene/types';

export const DEFAULT_PROFILE_ID = APP_MODE_DEFAULT_PROFILE['sinr-experiment'];

export type LeftSidebarTab = 'objective' | 'signal' | 'handover' | 'training' | 'jobs' | 'replay';
export type RightSidebarTab = 'modqn' | 'live';

export interface AppSidebarTabItem<T extends string> {
  key: T;
  label: string;
  description: string;
}

const LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  { key: 'objective', label: 'MODQN objective', description: 'legacy ω controls' },
  { key: 'signal', label: 'SINR formula', description: 'SINR tuning' },
  { key: 'handover', label: 'Handover policy', description: 'decision timing gates' },
  { key: 'training', label: 'MODQN training', description: 'objective, env, and run setup' },
  { key: 'jobs', label: 'MODQN jobs', description: 'training run history' },
  { key: 'replay', label: 'MODQN replay', description: 'handover decision trace' },
];

const SINR_LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[1],
  LEFT_SIDEBAR_TABS[2],
];

const MODQN_LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[5],
  LEFT_SIDEBAR_TABS[3],
  LEFT_SIDEBAR_TABS[4],
];

const RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  { key: 'live', label: 'Live status', description: 'current scene state' },
  { key: 'modqn', label: 'MODQN evidence', description: 'artifact proof' },
];

const SINR_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  RIGHT_SIDEBAR_TABS[0],
];

const MODQN_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = RIGHT_SIDEBAR_TABS;

export interface InitialRuntimeState {
  readonly appMode: AppExperienceMode;
  readonly selectedProfileId: string;
  readonly handoverMode: RuntimeHandoverMode;
  readonly profileByMode: ProfileByMode;
}

export function resolvePresentationMode(profile: Profile): PresentationMode {
  if (profile.id === APP_MODE_DEFAULT_PROFILE['sinr-experiment']) return 'demo-readability';
  if (profile.profileClass === 'candidate-rich') return 'candidate-rich';
  return 'research-default';
}

export function isKnownProfileId(id: string): boolean {
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

export function getLeftSidebarTabsForMode(
  mode: RuntimeHandoverMode,
): readonly AppSidebarTabItem<LeftSidebarTab>[] {
  return mode === 'sinr-offset'
    ? SINR_LEFT_SIDEBAR_TABS
    : MODQN_LEFT_SIDEBAR_TABS;
}

export function getDefaultLeftSidebarTabForMode(mode: RuntimeHandoverMode): LeftSidebarTab {
  return mode === 'sinr-offset' ? 'signal' : 'replay';
}

export function getRightSidebarTabsForMode(
  mode: RuntimeHandoverMode,
): readonly AppSidebarTabItem<RightSidebarTab>[] {
  return mode === 'decision-overlay-on-live-sinr'
    ? MODQN_RIGHT_SIDEBAR_TABS
    : SINR_RIGHT_SIDEBAR_TABS;
}

export function getDefaultRightSidebarTabForMode(_mode: RuntimeHandoverMode): RightSidebarTab {
  return 'live';
}

function clampOmegaComponent(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

export function normalizeRuntimeOmega(
  weights: Readonly<Record<string, unknown>> | undefined,
): RuntimeOmegaState {
  const throughput = clampOmegaComponent(
    weights?.throughput ?? weights?.r1Throughput,
    MODQN_PAPER_FAITHFUL_OMEGA.throughput,
  );
  const handover = clampOmegaComponent(
    weights?.handover ?? weights?.r2Handover,
    MODQN_PAPER_FAITHFUL_OMEGA.handover,
  );
  const loadBalance = clampOmegaComponent(
    weights?.loadBalance ?? weights?.r3LoadBalance,
    MODQN_PAPER_FAITHFUL_OMEGA.loadBalance,
  );
  const sum = throughput + handover + loadBalance;
  if (sum <= 0) return MODQN_PAPER_FAITHFUL_OMEGA;
  return {
    throughput: throughput / sum,
    handover: handover / sum,
    loadBalance: loadBalance / sum,
  };
}
