import type {
  VisualLabLocale,
  VisualLabTheme,
} from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';

/** Stable product-facing choices; runtime story ids may remain dynamic. */
export type VisualLabClipId =
  | 'inter-handover'
  | 'intra-beam-handover'
  | 'link-gain-ab'
  | 'power-cap-ab';

export type VisualLabClipRuntime = 'story' | 'causal' | 'guided';
/**
 * `preparing` is an explicit source-backed preparation action, not a claim
 * that a replay already exists.  The root may launch it only to build and
 * validate the missing accepted trace.
 */
export type VisualLabClipStatus = 'available' | 'preparing' | 'pending' | 'unavailable';
export type VisualLabClipLaunchState = 'idle' | 'launching' | 'running' | 'error';

export interface VisualLabClipLocalizedCopy {
  readonly 'zh-Hant': string;
  readonly en: string;
}

/** Root-owned availability; the entry never infers this from labels or IDs. */
export interface VisualLabClipAvailability {
  readonly status: VisualLabClipStatus;
  readonly reason: string | null;
  /** Existing runtime story id, or causal story key for an A/B entry. */
  readonly runtimeId?: string | null;
  /** Optional source identity already published by the runtime. */
  readonly sourceLabel?: string | null;
}

export interface VisualLabClipDefinition {
  readonly id: VisualLabClipId;
  readonly runtime: VisualLabRuntimeKind;
  readonly runtimeId: string | null;
  readonly title: VisualLabClipLocalizedCopy;
  readonly summary: VisualLabClipLocalizedCopy;
  readonly requirement: VisualLabClipLocalizedCopy;
}

export interface VisualLabClipEntryModel extends VisualLabClipDefinition {
  readonly status: VisualLabClipStatus;
  readonly reason: string | null;
  readonly sourceLabel: string | null;
}

export type VisualLabRuntimeKind = VisualLabClipRuntime;

/** Exact target supplied to the root when an entry is launched. */
export interface VisualLabClipLaunchTarget {
  readonly clipId: VisualLabClipId;
  readonly runtime: VisualLabClipRuntime;
  readonly runtimeId: string;
}

export interface VisualLabClipReplayState {
  readonly entries: readonly VisualLabClipEntryModel[];
  readonly selectedClipId: VisualLabClipId | null;
  readonly launchState: VisualLabClipLaunchState;
  readonly error: string | null;
}

export interface VisualLabClipEntryProps {
  readonly entry: VisualLabClipEntryModel;
  readonly selected?: boolean;
  readonly locale?: VisualLabLocale;
  readonly theme?: VisualLabTheme;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly className?: string;
  readonly onSelect: (clipId: VisualLabClipId) => void;
  readonly onLaunch: (target: VisualLabClipLaunchTarget) => void;
}

export interface VisualLabClipEntryShelfProps {
  readonly entries: readonly VisualLabClipEntryModel[];
  readonly selectedClipId: VisualLabClipId | null;
  readonly launchState?: VisualLabClipLaunchState;
  readonly error?: string | null;
  readonly locale?: VisualLabLocale;
  readonly theme?: VisualLabTheme;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onSelect: (clipId: VisualLabClipId) => void;
  readonly onLaunch: (target: VisualLabClipLaunchTarget) => void;
}
