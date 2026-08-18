import type { VisualLabLocale } from '../experiment';

export type VisualLabGuidedReplayId = 'inter-handover' | 'intra-beam-handover';

export type VisualLabGuidedReplayPhase =
  | 'baseline'
  | 'intervention'
  | 'before'
  | 'decision'
  | 'after'
  | 'comparison';

/**
 * Presentation stages are deliberately separate from the accepted story
 * anchors.  Several stages may hold one canonical anchor while the camera,
 * annotations, and operator-facing explanation have time to settle.
 */
export type VisualLabGuidedReplayStage =
  | 'setup'
  | 'candidate-approach'
  | 'qualification'
  | 'switch'
  | 'settle'
  | 'smooth-return'
  | 'comparison';

export type VisualLabGuidedReplayAnnotationMode = 'clean' | 'annotated';

export type VisualLabGuidedReplayAnnotationTarget =
  | 'serving-satellite'
  | 'candidate-satellite'
  | 'ue'
  | 'serving-beam'
  | 'candidate-beam'
  | 'sinr-result'
  | 'power-result'
  | 'throughput-result'
  | 'ee-result';

export type VisualLabGuidedReplayAnnotationMark = 'circle' | 'spotlight';
export type VisualLabGuidedReplayAnnotationTone = 'service' | 'candidate' | 'ue' | 'beam' | 'result';

export type VisualLabGuidedReplayLocalizedText = Readonly<{
  readonly 'zh-Hant': string;
  readonly en: string;
}>;

/**
 * Coordinates are normalized to the scene host: x/y/width/height/radius are
 * all expected in the inclusive [0, 1] range.  The parent owns these anchors;
 * annotation presentation never derives them from a second scene model.
 */
export interface VisualLabGuidedReplayNormalizedAnchor {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly radius?: number;
}

export type VisualLabGuidedReplayNormalizedAnchorMap = Readonly<Partial<Record<
  VisualLabGuidedReplayAnnotationTarget,
  VisualLabGuidedReplayNormalizedAnchor
>>>;

export interface VisualLabGuidedReplayAnnotationCue {
  readonly target: VisualLabGuidedReplayAnnotationTarget;
  readonly mark: VisualLabGuidedReplayAnnotationMark;
  readonly tone: VisualLabGuidedReplayAnnotationTone;
  readonly label: VisualLabGuidedReplayLocalizedText;
}

export interface VisualLabGuidedReplayAnnotationArrow {
  readonly from: VisualLabGuidedReplayAnnotationTarget;
  readonly to: VisualLabGuidedReplayAnnotationTarget;
  readonly tone: Extract<VisualLabGuidedReplayAnnotationTone, 'service' | 'candidate' | 'result'>;
}

/** Pure, source-neutral presentation plan shared by on-screen and clip renderers. */
export interface VisualLabGuidedReplayAnnotationPlan {
  readonly storyId: VisualLabGuidedReplayId;
  readonly phase: VisualLabGuidedReplayPhase;
  readonly title: VisualLabGuidedReplayLocalizedText;
  readonly phaseLabel: VisualLabGuidedReplayLocalizedText;
  readonly subtitle: VisualLabGuidedReplayLocalizedText;
  readonly cues: readonly VisualLabGuidedReplayAnnotationCue[];
  readonly arrows: readonly VisualLabGuidedReplayAnnotationArrow[];
}

export interface VisualLabGuidedReplayDefinition {
  readonly id: VisualLabGuidedReplayId;
  readonly storyKind: 'inter-handover' | 'intra-handover';
  readonly causalStoryId: 'beamwidth' | 'power-cap';
  readonly title: Readonly<Record<VisualLabLocale, string>>;
  readonly summary: Readonly<Record<VisualLabLocale, string>>;
}

export interface VisualLabGuidedReplayState {
  readonly open: boolean;
  readonly storyId: VisualLabGuidedReplayId;
  readonly phase: VisualLabGuidedReplayPhase;
  readonly annotationMode: VisualLabGuidedReplayAnnotationMode;
  readonly baselineStoryRuntimeId: string | null;
  readonly candidateStoryRuntimeId: string | null;
  readonly playing: boolean;
  readonly busy: boolean;
  readonly prepared: boolean;
  readonly progress: VisualLabGuidedReplayProgress;
  readonly error: string | null;
}

/** Wall-clock presentation progress; it never owns or recomputes scientific state. */
export interface VisualLabGuidedReplayProgress {
  readonly stage: VisualLabGuidedReplayStage;
  readonly phaseElapsedMs: number;
  readonly phaseDurationMs: number;
  readonly phaseFraction: number;
  readonly overallFraction: number;
  /** Candidate emphasis is intended only for approach/qualification/switch. */
  readonly candidateEngaged: boolean;
}

export interface VisualLabGuidedReplayRailProps {
  readonly storyId: VisualLabGuidedReplayId;
  readonly phase: VisualLabGuidedReplayPhase;
  readonly annotationMode: VisualLabGuidedReplayAnnotationMode;
  readonly locale?: VisualLabLocale;
  readonly theme?: 'dark' | 'light';
  readonly playing?: boolean;
  readonly busy?: boolean;
  readonly prepared?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onAnnotationModeChange: (mode: VisualLabGuidedReplayAnnotationMode) => void;
  readonly onPlayToggle: () => void;
  readonly onNext: () => void;
  readonly onRestart: () => void;
}
