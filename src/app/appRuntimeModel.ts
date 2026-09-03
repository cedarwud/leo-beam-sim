import type { RuntimeHandoverMode, RuntimeOmegaState } from '../modqn/runtimeControls';
import { MODQN_PAPER_FAITHFUL_OMEGA } from '../modqn/runtimeControls';
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

export const DEFAULT_PROFILE_ID = APP_MODE_DEFAULT_PROFILE['sinr-experiment'];

// Left-rail tab model. The 'summary' tab is retained as the SINR-live contract
// default, but the left tab SHELL is now MODQN-only — the SINR-live left rail
// renders the archived-TLE analysis parameters (src/ui/SinrLiveDisplayDrawer.tsx)
// directly; Walker handover controls are not mixed into that frame. The public
// SINR/MODQN experience switch is intentionally hidden, and
// the read-only orientation card that used to fill 'summary' was removed (it
// duplicated the in-scene serving HUD).
// 'evidence' remains the SOLE MODQN left rail (see MODQN_LEFT_SIDEBAR_TABS); S4
// relocated the MODQN training / jobs / ω-weight power tools into the opt-in
// AdvancedSetupDrawer.
export type LeftSidebarTab = 'summary' | 'evidence';
export type RightSidebarTab = 'modqn' | 'live' | 'artifact' | 'palette';

export interface AppSidebarTabItem<T extends string> {
  key: T;
  label: string;
  description: string;
}

const LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  { key: 'summary', label: 'Live SINR', description: 'scene summary' },
  { key: 'evidence', label: 'Evidence / Replay', description: 'decision trace + artifact source' },
];

// The SINR-live left-tab model default (retained for the contract). The left tab
// shell is MODQN-only now, so this 'summary' entry is not actually rendered — the
// SINR-live left rail is the inlined tuners.
const SINR_LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[0], // summary
];

// S3 + S4: all three MODQN sub-lanes (live cell preview / replay proof / artifact
// showcase) SHARE this one stable left rail, so toggling the in-MODQN
// ModqnViewToggle sub-nav never reshuffles the sidebar. S4 collapsed it to the
// single 'Evidence / Replay' tab (decision trace + artifact source summary); the
// training / jobs / ω-objective power tools moved to the Advanced setup drawer.
const MODQN_LEFT_SIDEBAR_TABS: readonly AppSidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[1], // evidence
];

const RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  { key: 'live', label: 'Live status', description: 'current scene state' },
  { key: 'modqn', label: 'MODQN evidence', description: 'artifact proof' },
];

const SINR_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  RIGHT_SIDEBAR_TABS[0],
];

// The root homepage renders its accepted-snapshot beam rail directly.  It no
// longer exposes a competing live-status/palette tab shell; the colour
// catalogue lives on the dedicated `/beam-colors` route instead.
const HOMEPAGE_SINR_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [];

const MODQN_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = RIGHT_SIDEBAR_TABS;

const MODQN_REPLAY_PROOF_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  RIGHT_SIDEBAR_TABS[1],
];

const ARTIFACT_RIGHT_SIDEBAR_TABS: readonly AppSidebarTabItem<RightSidebarTab>[] = [
  { key: 'artifact', label: 'Artifact truth', description: 'producer status' },
];

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

/**
 * The public Walker App surface is the canonical paper-formula workspace, not a
 * persisted experience switch. Keep profile preferences, but never let a
 * previous MODQN visit replace its parameter/result rails on the next launch.
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

export function getLeftSidebarTabsForMode(
  mode: RuntimeHandoverMode,
): readonly AppSidebarTabItem<LeftSidebarTab>[] {
  return mode === 'sinr-offset'
    ? SINR_LEFT_SIDEBAR_TABS
    : MODQN_LEFT_SIDEBAR_TABS;
}

export function getDefaultLeftSidebarTabForMode(mode: RuntimeHandoverMode): LeftSidebarTab {
  return mode === 'sinr-offset' ? 'summary' : 'evidence';
}

export function getLeftSidebarTabsForSceneLane(
  lane: SceneLane,
  mode: RuntimeHandoverMode,
): readonly AppSidebarTabItem<LeftSidebarTab>[] {
  // S3: the three MODQN sub-lanes share ONE unified left rail (no reshuffle when
  // the in-MODQN ModqnViewToggle sub-nav switches sub-view). Only SINR differs.
  if (
    lane === 'artifact-replay'
    || lane === 'modqn-replay-proof'
    || lane === 'modqn-live-cell-preview'
  ) {
    return MODQN_LEFT_SIDEBAR_TABS;
  }
  return getLeftSidebarTabsForMode(mode);
}

export function getDefaultLeftSidebarTabForSceneLane(
  lane: SceneLane,
  mode: RuntimeHandoverMode,
): LeftSidebarTab {
  if (
    lane === 'artifact-replay'
    || lane === 'modqn-replay-proof'
    || lane === 'modqn-live-cell-preview'
  ) {
    return 'evidence';
  }
  return getDefaultLeftSidebarTabForMode(mode);
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

export function getRightSidebarTabsForSceneLane(
  lane: SceneLane,
  mode: RuntimeHandoverMode,
): readonly AppSidebarTabItem<RightSidebarTab>[] {
  if (lane === 'artifact-replay') return ARTIFACT_RIGHT_SIDEBAR_TABS;
  if (lane === 'modqn-replay-proof') return MODQN_REPLAY_PROOF_RIGHT_SIDEBAR_TABS;
  // Showcase navigation: the MODQN live cell preview right rail now offers the
  // MODQN evidence tab (reward curve / decision viz / artifact picker) co-visible
  // with live status, so the bundle diagnostics are reachable without entering the
  // dedicated replay-proof lane. 'live' stays the default; 'modqn' is opt-in.
  if (lane === 'modqn-live-cell-preview') return MODQN_RIGHT_SIDEBAR_TABS;
  return getRightSidebarTabsForMode(mode);
}

/**
 * Root-only extension point for the homepage sidebar. The root SINR lane has
 * no tab list: the integration owner mounts its single accepted-snapshot rail
 * directly. This helper never broadens the tab set for other scene lanes.
 */
export function getHomepageRightSidebarTabsForSceneLane(
  lane: SceneLane,
  mode: RuntimeHandoverMode,
): readonly AppSidebarTabItem<RightSidebarTab>[] {
  if (lane === 'sinr-live') return HOMEPAGE_SINR_RIGHT_SIDEBAR_TABS;
  return getRightSidebarTabsForSceneLane(lane, mode);
}

export function getDefaultRightSidebarTabForSceneLane(
  lane: SceneLane,
  mode: RuntimeHandoverMode,
): RightSidebarTab {
  if (lane === 'artifact-replay') return 'artifact';
  if (lane === 'modqn-replay-proof') return 'modqn';
  // MODQN consolidation: the MODQN page is a PROOF page — default the right rail to
  // the 'modqn' tab (dense-Q Q1/Q2/Q3 evidence) since the multi-beam scene render is
  // data-blocked (collapsed producer baseline). 'live' status stays opt-in.
  if (lane === 'modqn-live-cell-preview') return 'modqn';
  return getDefaultRightSidebarTabForMode(mode);
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
