import type { VisualLabLocale } from '../experiment';
import type {
  VisualLabGuidedReplayDefinition,
  VisualLabGuidedReplayId,
  VisualLabGuidedReplayPhase,
  VisualLabGuidedReplayProgress,
  VisualLabGuidedReplayStage,
} from './types';

export const VISUAL_LAB_GUIDED_REPLAY_PHASES = Object.freeze([
  'baseline',
  'intervention',
  'before',
  'decision',
  'after',
  'comparison',
] as const satisfies readonly VisualLabGuidedReplayPhase[]);

export interface VisualLabGuidedReplayPhaseTiming {
  readonly stage: VisualLabGuidedReplayStage;
  readonly durationMs: number;
  readonly candidateEngaged: boolean;
}

/**
 * Presentation-only pacing.  The first five phases total 21 seconds before
 * the final comparison state.  Scientific work still occurs only at the
 * accepted A/B and before/decision/after anchors; the extra time is for
 * readable approach, qualification, settle, and camera return.
 */
export const VISUAL_LAB_GUIDED_REPLAY_PHASE_TIMINGS: Readonly<Record<
  VisualLabGuidedReplayPhase,
  VisualLabGuidedReplayPhaseTiming
>> = Object.freeze({
  baseline: Object.freeze({ stage: 'setup' as const, durationMs: 3_000, candidateEngaged: false }),
  intervention: Object.freeze({ stage: 'candidate-approach' as const, durationMs: 3_500, candidateEngaged: true }),
  before: Object.freeze({ stage: 'qualification' as const, durationMs: 4_500, candidateEngaged: true }),
  decision: Object.freeze({ stage: 'switch' as const, durationMs: 3_000, candidateEngaged: true }),
  // The post-switch phase deliberately contains two presentation beats:
  // settle for 4 seconds, then smooth-return for the remaining 3 seconds.
  after: Object.freeze({ stage: 'settle' as const, durationMs: 7_000, candidateEngaged: false }),
  comparison: Object.freeze({ stage: 'comparison' as const, durationMs: 0, candidateEngaged: false }),
});

// A short-lived compatibility guard for a stale HMR closure or an older
// consumer that still publishes the former `return` phase.  The phase is not
// part of the current public sequence, but timing lookup must fail safe while
// the browser reloads instead of throwing on `.durationMs`.
const LEGACY_RETURN_PHASE_TIMING: VisualLabGuidedReplayPhaseTiming = Object.freeze({
  stage: 'smooth-return',
  durationMs: 3_000,
  candidateEngaged: false,
});

export const VISUAL_LAB_GUIDED_REPLAY_AFTER_SETTLE_MS = 4_000;
export const VISUAL_LAB_GUIDED_REPLAY_RETURN_DURATION_MS =
  VISUAL_LAB_GUIDED_REPLAY_PHASE_TIMINGS.after.durationMs
  - VISUAL_LAB_GUIDED_REPLAY_AFTER_SETTLE_MS;

export const VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS = VISUAL_LAB_GUIDED_REPLAY_PHASES
  .reduce((total, phase) => total + VISUAL_LAB_GUIDED_REPLAY_PHASE_TIMINGS[phase].durationMs, 0);

export const VISUAL_LAB_GUIDED_REPLAY_DEFINITIONS = Object.freeze({
  'inter-handover': Object.freeze({
    id: 'inter-handover' as const,
    storyKind: 'inter-handover' as const,
    causalStoryId: 'beamwidth' as const,
    title: Object.freeze({
      'zh-Hant': '跨衛星換手',
      en: 'Inter-satellite handover',
    }),
    summary: Object.freeze({
      'zh-Hant': '播放通過核對的切換前、判定時刻與切換後，再比較吞吐量、功率、EE 與 SINR。',
      en: 'Replay the checked before, decision, and after anchors, then compare throughput, power, EE, and SINR.',
    }),
  }),
  'intra-beam-handover': Object.freeze({
    id: 'intra-beam-handover' as const,
    storyKind: 'intra-handover' as const,
    causalStoryId: 'power-cap' as const,
    title: Object.freeze({
      'zh-Hant': '同衛星換束',
      en: 'Same-satellite beam switch',
    }),
    summary: Object.freeze({
      'zh-Hant': '播放通過核對的同衛星換束三個錨點，再比較吞吐量、功率、EE 與 SINR。',
      en: 'Replay the checked three-anchor same-satellite beam switch, then compare throughput, power, EE, and SINR.',
    }),
  }),
} satisfies Readonly<Record<VisualLabGuidedReplayId, VisualLabGuidedReplayDefinition>>);

const PHASE_LABELS = Object.freeze({
  baseline: Object.freeze({ 'zh-Hant': '設定', en: 'Setup' }),
  intervention: Object.freeze({ 'zh-Hant': '候選接近', en: 'Candidate approach' }),
  before: Object.freeze({ 'zh-Hant': '切換前', en: 'Before switch' }),
  decision: Object.freeze({ 'zh-Hant': '切換', en: 'Switch' }),
  after: Object.freeze({ 'zh-Hant': '穩定 → 平滑返回', en: 'Settle → smooth return' }),
  comparison: Object.freeze({ 'zh-Hant': '結果比較', en: 'Compare' }),
} satisfies Readonly<Record<VisualLabGuidedReplayPhase, Readonly<Record<VisualLabLocale, string>>>>);

export function guidedReplayDefinition(id: VisualLabGuidedReplayId): VisualLabGuidedReplayDefinition {
  return VISUAL_LAB_GUIDED_REPLAY_DEFINITIONS[id];
}

export function guidedReplayPhaseLabel(
  phase: VisualLabGuidedReplayPhase,
  locale: VisualLabLocale,
): string {
  // Keep a stale `return` phase renderable for one HMR turn.  Current callers
  // only publish the six-phase contract, but labels must fail soft while an
  // older hook state is being replaced.
  return (PHASE_LABELS[phase] ?? PHASE_LABELS.after)[locale];
}

export function guidedReplayPhaseIndex(phase: VisualLabGuidedReplayPhase): number {
  return VISUAL_LAB_GUIDED_REPLAY_PHASES.indexOf(phase);
}

export function isGuidedHandoverPhase(
  phase: VisualLabGuidedReplayPhase,
): phase is Exclude<VisualLabGuidedReplayPhase, 'comparison'> {
  // Keep the directed scene/camera active through setup and smooth return.
  // The final comparison deliberately releases it so the renderer can restore
  // its normal pose.
  return phase !== 'comparison';
}

export function nextGuidedReplayPhase(
  phase: VisualLabGuidedReplayPhase,
): VisualLabGuidedReplayPhase | null {
  const index = guidedReplayPhaseIndex(phase);
  return VISUAL_LAB_GUIDED_REPLAY_PHASES[index + 1] ?? null;
}

export function guidedReplayPhaseTiming(
  phase: VisualLabGuidedReplayPhase,
): VisualLabGuidedReplayPhaseTiming {
  return VISUAL_LAB_GUIDED_REPLAY_PHASE_TIMINGS[phase] ?? LEGACY_RETURN_PHASE_TIMING;
}

export function guidedReplayCandidateEngaged(
  phase: VisualLabGuidedReplayPhase,
): boolean {
  return guidedReplayPhaseTiming(phase).candidateEngaged;
}

function phaseOffsetMs(phase: VisualLabGuidedReplayPhase): number {
  let offset = 0;
  for (const candidate of VISUAL_LAB_GUIDED_REPLAY_PHASES) {
    if (candidate === phase) return offset;
    offset += guidedReplayPhaseTiming(candidate).durationMs;
  }
  return offset;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Resolve deterministic presentation progress without touching source data. */
export function guidedReplayProgress(
  phase: VisualLabGuidedReplayPhase,
  elapsedMs = 0,
): VisualLabGuidedReplayProgress {
  const timing = guidedReplayPhaseTiming(phase);
  const phaseElapsedMs = timing.durationMs === 0
    ? 0
    : Math.min(timing.durationMs, Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const phaseFraction = timing.durationMs === 0 ? 1 : phaseElapsedMs / timing.durationMs;
  const stage: VisualLabGuidedReplayStage = phase === 'after' && phaseElapsedMs >= VISUAL_LAB_GUIDED_REPLAY_AFTER_SETTLE_MS
    ? 'smooth-return'
    : timing.stage;
  const overallFraction = phase === 'comparison'
    ? 1
    : clampUnit((phaseOffsetMs(phase) + phaseElapsedMs) / VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS);
  return Object.freeze({
    stage,
    phaseElapsedMs,
    phaseDurationMs: timing.durationMs,
    phaseFraction,
    overallFraction,
    candidateEngaged: timing.candidateEngaged,
  });
}

/** Camera return progress is derived from the same pacing contract as playback. */
export function guidedReplayReturnProgress(
  phase: VisualLabGuidedReplayPhase,
  elapsedMs = 0,
): number | null {
  if (phase !== 'after' || elapsedMs < VISUAL_LAB_GUIDED_REPLAY_AFTER_SETTLE_MS) return null;
  return clampUnit(
    (elapsedMs - VISUAL_LAB_GUIDED_REPLAY_AFTER_SETTLE_MS)
    / VISUAL_LAB_GUIDED_REPLAY_RETURN_DURATION_MS,
  );
}
