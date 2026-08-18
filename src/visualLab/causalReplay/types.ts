import type {
  ComparisonClassification,
  ComparisonMetricDelta,
  ComparisonView,
} from '../comparison';
import type { VisualLabLocale } from '../experiment';

/** The two bounded, single-input stories supported by the compact replay. */
export type VisualLabCausalStoryId = 'beamwidth' | 'power-cap';

/** The fixed three-beat sequence shown by the replay controls. */
export type VisualLabCausalPhase = 'baseline' | 'intervention' | 'comparison';

/** Alias matching route-level replay terminology. */
export type VisualLabCausalReplayPhase = VisualLabCausalPhase;

export type VisualLabCausalReplayTheme = 'dark' | 'light';

export interface VisualLabCausalParameterChange {
  /** Canonical input key or an integration-owned stable key. */
  readonly key: string;
  readonly label: string | Readonly<Record<VisualLabLocale, string>>;
  /** Values are display-ready when strings; numbers are formatted by the adapter. */
  readonly baseline: number | string | null;
  readonly candidate: number | string | null;
  readonly unit?: string;
}

/**
 * An optional SINR projection supplied by the owner when it already has a
 * canonical delta.  The cue never derives this delta from A/B values.
 */
export type VisualLabCausalSinrMetric = ComparisonMetricDelta;

export interface VisualLabCausalReplayRailProps {
  readonly storyId: VisualLabCausalStoryId;
  readonly phase: VisualLabCausalPhase;
  readonly locale?: VisualLabLocale;
  readonly theme?: VisualLabCausalReplayTheme;
  readonly classification?: ComparisonClassification | null;
  readonly playing?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onStoryChange: (storyId: VisualLabCausalStoryId) => void;
  readonly onPrevious: () => void;
  readonly onPlayToggle: () => void;
  readonly onNext: () => void;
  readonly onRestart: () => void;
}

export interface VisualLabCausalReplayStageCueProps {
  readonly storyId: VisualLabCausalStoryId;
  readonly phase: VisualLabCausalPhase;
  readonly comparison: ComparisonView | null | undefined;
  /** Optional display-ready change; otherwise a single causal comparison key is projected. */
  readonly parameterChange?: VisualLabCausalParameterChange | null;
  /** Alias for callers that name the one causal input `changedParameter`. */
  readonly changedParameter?: VisualLabCausalParameterChange | null;
  /** Optional canonical SINR metric projection; no delta is inferred when omitted. */
  readonly servingSinr?: VisualLabCausalSinrMetric | null;
  readonly locale?: VisualLabLocale;
  readonly theme?: VisualLabCausalReplayTheme;
  readonly className?: string;
  readonly directorEnabled?: boolean;
  readonly disabled?: boolean;
  readonly onDirectorEnabledChange?: (enabled: boolean) => void;
}
