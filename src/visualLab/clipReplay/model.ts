import type {
  VisualLabClipAvailability,
  VisualLabClipDefinition,
  VisualLabClipEntryModel,
  VisualLabClipId,
  VisualLabClipLaunchTarget,
  VisualLabClipReplayState,
  VisualLabClipStatus,
} from './types';

export const VISUAL_LAB_CLIP_IDS = Object.freeze([
  'inter-handover',
  'intra-beam-handover',
  'link-gain-ab',
  'power-cap-ab',
] as const satisfies readonly VisualLabClipId[]);

const UNPUBLISHED_REASON = 'Runtime availability has not been published.';
const PENDING_REASON = 'The accepted source-backed replay is still being prepared.';

export const VISUAL_LAB_CLIP_DEFINITIONS: readonly VisualLabClipDefinition[] = Object.freeze([
  Object.freeze({
    id: 'inter-handover',
    runtime: 'guided',
    runtimeId: null,
    title: Object.freeze({ 'zh-Hant': '跨衛星換手', en: 'Inter-satellite handover' }),
    summary: Object.freeze({ 'zh-Hant': '播放通過核對的切換前、判定時刻與切換後，再比較四項結果。', en: 'Replay the checked before, decision, and after anchors, then compare four results.' }),
    requirement: Object.freeze({ 'zh-Hant': '需要真實 A／B frame 與三個已核對的換手錨點；缺少時保持不可用。', en: 'Requires a real A/B frame and three checked handover anchors; unavailable when they are missing.' }),
  }),
  Object.freeze({
    id: 'intra-beam-handover',
    runtime: 'guided',
    runtimeId: 'intra-handover',
    title: Object.freeze({ 'zh-Hant': '同衛星換束', en: 'Same-satellite beam switch' }),
    summary: Object.freeze({ 'zh-Hant': '播放通過核對的同衛星換束三個錨點，再比較四項結果。', en: 'Replay the checked three-anchor same-satellite beam switch, then compare four results.' }),
    requirement: Object.freeze({ 'zh-Hant': '需要真實 A／B frame 與通過核對的同衛星換束軌跡；缺少時保持不可用。', en: 'Requires a real A/B frame and an accepted same-satellite beam-switch trace; unavailable when they are missing.' }),
  }),
  Object.freeze({
    id: 'link-gain-ab',
    runtime: 'causal',
    runtimeId: 'beamwidth',
    title: Object.freeze({ 'zh-Hant': '3 dB 波束寬度 A／B', en: '3 dB beamwidth A/B' }),
    summary: Object.freeze({ 'zh-Hant': '只改完整 3 dB 波束寬度，觀察 SINR、系統功率、吞吐量與 EE 的變化。', en: 'Change only the full 3 dB beamwidth and observe SINR, system power, throughput, and EE.' }),
    requirement: Object.freeze({ 'zh-Hant': '需要同一真實場景的 A／B 結果；來源未完成時保持等待。', en: 'Requires A/B results from one real scene; remains pending until the source is ready.' }),
  }),
  Object.freeze({
    id: 'power-cap-ab',
    runtime: 'causal',
    runtimeId: 'power-cap',
    title: Object.freeze({ 'zh-Hant': '功率上限 A／B', en: 'Power-cap A/B' }),
    summary: Object.freeze({ 'zh-Hant': '只改單波束功率上限，觀察吞吐量、功率與 EE 的差異。', en: 'Change only the per-beam power cap and compare throughput, power, and EE.' }),
    requirement: Object.freeze({ 'zh-Hant': '需要同一真實場景的 A／B 結果；來源未完成時保持等待。', en: 'Requires A/B results from one real scene; remains pending until the source is ready.' }),
  }),
] satisfies readonly VisualLabClipDefinition[]);

function definitionFor(id: VisualLabClipId): VisualLabClipDefinition {
  const definition = VISUAL_LAB_CLIP_DEFINITIONS.find(item => item.id === id);
  if (definition === undefined) throw new Error(`Unknown visual-lab clip id: ${id}`);
  return definition;
}

function statusFor(
  availability: Partial<Record<VisualLabClipId, VisualLabClipAvailability>>,
  id: VisualLabClipId,
): VisualLabClipAvailability {
  return availability[id] ?? {
    status: 'unavailable' as const,
    reason: UNPUBLISHED_REASON,
    runtimeId: null,
    sourceLabel: null,
  };
}

function validRuntimeId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Build four entries from root-published availability.  Missing availability
 * is deliberately unavailable rather than optimistic, so a card cannot imply
 * that a runtime or A/B pair exists merely because its label is known.
 */
export function createVisualLabClipEntries(
  availability: Partial<Record<VisualLabClipId, VisualLabClipAvailability>> = {},
): readonly VisualLabClipEntryModel[] {
  return Object.freeze(VISUAL_LAB_CLIP_IDS.map(id => {
    const definition = definitionFor(id);
    const published = statusFor(availability, id);
    const runtimeId = published.runtimeId === undefined
      ? definition.runtimeId
      : published.runtimeId;
    const status: VisualLabClipStatus = (published.status === 'available' || published.status === 'preparing') && !validRuntimeId(runtimeId)
      ? 'unavailable'
      : published.status;
    const reason = published.reason
      ?? (status === 'pending'
        ? PENDING_REASON
        : status === 'unavailable'
          ? 'This replay has no launchable runtime target.'
          : null);
    return Object.freeze({
      ...definition,
      status,
      reason,
      runtimeId: validRuntimeId(runtimeId) ? runtimeId : null,
      sourceLabel: published.sourceLabel ?? null,
    });
  }));
}

export function clipEntryCanLaunch(entry: VisualLabClipEntryModel): boolean {
  return (entry.status === 'available' || entry.status === 'preparing') && validRuntimeId(entry.runtimeId);
}

export function clipEntryLaunchTarget(
  entry: VisualLabClipEntryModel,
): VisualLabClipLaunchTarget | null {
  const runtimeId = entry.runtimeId;
  if (!clipEntryCanLaunch(entry) || !validRuntimeId(runtimeId)) return null;
  return Object.freeze({
    clipId: entry.id,
    runtime: entry.runtime,
    runtimeId,
  });
}

function firstSelectableEntry(entries: readonly VisualLabClipEntryModel[]): VisualLabClipId | null {
  return entries.find(entry => entry.status !== 'unavailable')?.id
    ?? entries[0]?.id
    ?? null;
}

/** Immutable UI state; selecting never launches and launching is callback-owned. */
export function createVisualLabClipReplayState(
  entries: readonly VisualLabClipEntryModel[],
  selectedClipId: VisualLabClipId | null = null,
): VisualLabClipReplayState {
  const selected = selectedClipId !== null && entries.some(entry => entry.id === selectedClipId)
    ? selectedClipId
    : firstSelectableEntry(entries);
  return Object.freeze({
    entries: Object.freeze([...entries]),
    selectedClipId: selected,
    launchState: 'idle' as const,
    error: null,
  });
}

export function selectVisualLabClip(
  state: VisualLabClipReplayState,
  clipId: VisualLabClipId,
): VisualLabClipReplayState {
  if (!state.entries.some(entry => entry.id === clipId)) return state;
  return Object.freeze({
    ...state,
    selectedClipId: clipId,
    launchState: 'idle' as const,
    error: null,
  });
}

export function setVisualLabClipLaunchState(
  state: VisualLabClipReplayState,
  launchState: VisualLabClipReplayState['launchState'],
  error: string | null = null,
): VisualLabClipReplayState {
  return Object.freeze({ ...state, launchState, error });
}

export function selectedVisualLabClip(
  state: VisualLabClipReplayState,
): VisualLabClipEntryModel | null {
  return state.selectedClipId === null
    ? null
    : state.entries.find(entry => entry.id === state.selectedClipId) ?? null;
}

export interface VisualLabClipLaunchPreparation {
  readonly state: VisualLabClipReplayState;
  readonly target: VisualLabClipLaunchTarget;
}

/**
 * Prepare a launch command for the root runtime.  This only changes UI state
 * and returns the already-published runtime target; it does not start a story
 * or create a frame.
 */
export function launchVisualLabClip(
  state: VisualLabClipReplayState,
  clipId: VisualLabClipId,
): VisualLabClipLaunchPreparation | null {
  const entry = state.entries.find(candidate => candidate.id === clipId) ?? null;
  if (entry === null) return null;
  const target = clipEntryLaunchTarget(entry);
  if (target === null) return null;
  return Object.freeze({
    state: setVisualLabClipLaunchState(
      selectVisualLabClip(state, clipId),
      'launching',
      null,
    ),
    target,
  });
}

export const VISUAL_LAB_CLIP_UNPUBLISHED_REASON = UNPUBLISHED_REASON;
export const VISUAL_LAB_CLIP_PENDING_REASON = PENDING_REASON;
