import {
  guidedReplayDefinition,
  guidedReplayPhaseLabel,
  VISUAL_LAB_GUIDED_REPLAY_PHASES,
} from './model';
import type {
  VisualLabGuidedReplayAnnotationArrow,
  VisualLabGuidedReplayAnnotationCue,
  VisualLabGuidedReplayAnnotationMark,
  VisualLabGuidedReplayAnnotationPlan,
  VisualLabGuidedReplayAnnotationTarget,
  VisualLabGuidedReplayAnnotationTone,
  VisualLabGuidedReplayId,
  VisualLabGuidedReplayLocalizedText,
  VisualLabGuidedReplayPhase,
} from './types';

const localized = (zhHant: string, en: string): VisualLabGuidedReplayLocalizedText => Object.freeze({
  'zh-Hant': zhHant,
  en,
});

export const VISUAL_LAB_GUIDED_REPLAY_ANNOTATION_TARGETS = Object.freeze([
  'serving-satellite',
  'candidate-satellite',
  'ue',
  'serving-beam',
  'candidate-beam',
  'sinr-result',
  'power-result',
  'throughput-result',
  'ee-result',
] as const satisfies readonly VisualLabGuidedReplayAnnotationTarget[]);

const TARGET_LABELS: Readonly<Record<VisualLabGuidedReplayAnnotationTarget, VisualLabGuidedReplayLocalizedText>> = Object.freeze({
  'serving-satellite': localized('服務衛星', 'Serving satellite'),
  'candidate-satellite': localized('候選衛星', 'Candidate satellite'),
  ue: localized('UE', 'UE'),
  'serving-beam': localized('服務波束', 'Serving beam'),
  'candidate-beam': localized('候選波束', 'Candidate beam'),
  'sinr-result': localized('SINR 結果', 'SINR result'),
  'power-result': localized('功率結果', 'Power result'),
  'throughput-result': localized('吞吐量結果', 'Throughput result'),
  'ee-result': localized('EE 結果', 'EE result'),
});

const TARGET_MARKS: Readonly<Record<VisualLabGuidedReplayAnnotationTarget, VisualLabGuidedReplayAnnotationMark>> = Object.freeze({
  'serving-satellite': 'spotlight',
  'candidate-satellite': 'spotlight',
  ue: 'circle',
  'serving-beam': 'circle',
  'candidate-beam': 'circle',
  'sinr-result': 'spotlight',
  'power-result': 'spotlight',
  'throughput-result': 'spotlight',
  'ee-result': 'spotlight',
});

const TARGET_TONES: Readonly<Record<VisualLabGuidedReplayAnnotationTarget, VisualLabGuidedReplayAnnotationTone>> = Object.freeze({
  'serving-satellite': 'service',
  'candidate-satellite': 'candidate',
  ue: 'ue',
  'serving-beam': 'service',
  'candidate-beam': 'candidate',
  'sinr-result': 'result',
  'power-result': 'result',
  'throughput-result': 'result',
  'ee-result': 'result',
});

const PHASE_SUBTITLES: Readonly<Record<
  VisualLabGuidedReplayId,
  Readonly<Record<VisualLabGuidedReplayPhase, VisualLabGuidedReplayLocalizedText>>
>> = Object.freeze({
  'inter-handover': Object.freeze({
    baseline: localized('先固定基準鏈路，確認服務衛星與目前結果。', 'Hold the baseline link and read the serving path.'),
    intervention: localized('調整 3 dB 波束寬度，觀察候選鏈路的變化。', 'Change the 3 dB beamwidth and observe the candidate link.'),
    before: localized('切換前同時觀察服務與候選鏈路。', 'Observe the serving and candidate links together before the switch.'),
    decision: localized('到達資料中的跨衛星換手事件。', 'Reach the inter-satellite handover event in the accepted trace.'),
    after: localized('切換完成，候選衛星接管 UE 服務。', 'After the switch, the candidate satellite serves the UE.'),
    comparison: localized('比較切換前後的 SINR、功率、吞吐量與 EE。', 'Compare SINR, power, throughput, and EE across the switch.'),
  }),
  'intra-beam-handover': Object.freeze({
    baseline: localized('先固定同衛星服務波束，確認基準結果。', 'Hold the same-satellite serving beam and read the baseline.'),
    intervention: localized('調整單波束功率上限，準備觀察換束。', 'Change the per-beam power cap to prepare the beam switch.'),
    before: localized('切換前同時觀察原服務波束與候選波束。', 'Observe the serving and candidate beams together before the switch.'),
    decision: localized('到達資料中的同衛星換束事件。', 'Reach the same-satellite beam-switch event in the accepted trace.'),
    after: localized('切換完成，同衛星改由候選波束服務。', 'After the switch, the candidate beam serves the UE on the same satellite.'),
    comparison: localized('比較換束前後的 SINR、功率、吞吐量與 EE。', 'Compare SINR, power, throughput, and EE across the beam switch.'),
  }),
});

const targetList = (...targets: VisualLabGuidedReplayAnnotationTarget[]): readonly VisualLabGuidedReplayAnnotationTarget[] => Object.freeze(targets);

const INTER_TARGETS: Readonly<Record<VisualLabGuidedReplayPhase, readonly VisualLabGuidedReplayAnnotationTarget[]>> = Object.freeze({
  baseline: targetList('serving-satellite', 'serving-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  intervention: targetList('serving-satellite', 'candidate-satellite', 'serving-beam', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  before: targetList('serving-satellite', 'candidate-satellite', 'serving-beam', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  decision: targetList('serving-satellite', 'candidate-satellite', 'serving-beam', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  after: targetList('candidate-satellite', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  comparison: targetList('serving-satellite', 'candidate-satellite', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
});

const INTRA_TARGETS: Readonly<Record<VisualLabGuidedReplayPhase, readonly VisualLabGuidedReplayAnnotationTarget[]>> = Object.freeze({
  baseline: targetList('serving-satellite', 'serving-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  intervention: targetList('serving-satellite', 'serving-beam', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  before: targetList('serving-satellite', 'serving-beam', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  decision: targetList('serving-satellite', 'serving-beam', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  after: targetList('serving-satellite', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
  comparison: targetList('serving-satellite', 'serving-beam', 'candidate-beam', 'ue', 'sinr-result', 'power-result', 'throughput-result', 'ee-result'),
});

const arrow = (
  from: VisualLabGuidedReplayAnnotationTarget,
  to: VisualLabGuidedReplayAnnotationTarget,
  tone: VisualLabGuidedReplayAnnotationArrow['tone'],
): VisualLabGuidedReplayAnnotationArrow => Object.freeze({ from, to, tone });

const INTER_ARROWS: Readonly<Record<VisualLabGuidedReplayPhase, readonly VisualLabGuidedReplayAnnotationArrow[]>> = Object.freeze({
  baseline: Object.freeze([
    arrow('serving-satellite', 'serving-beam', 'service'),
    arrow('serving-beam', 'ue', 'service'),
    arrow('ue', 'sinr-result', 'result'),
  ]),
  intervention: Object.freeze([
    arrow('serving-satellite', 'candidate-satellite', 'candidate'),
    arrow('serving-beam', 'candidate-beam', 'candidate'),
  ]),
  before: Object.freeze([
    arrow('serving-satellite', 'serving-beam', 'service'),
    arrow('serving-beam', 'ue', 'service'),
    arrow('candidate-satellite', 'candidate-beam', 'candidate'),
  ]),
  decision: Object.freeze([
    arrow('serving-satellite', 'candidate-satellite', 'candidate'),
    arrow('serving-beam', 'candidate-beam', 'candidate'),
    arrow('ue', 'sinr-result', 'result'),
  ]),
  after: Object.freeze([
    arrow('candidate-satellite', 'candidate-beam', 'candidate'),
    arrow('candidate-beam', 'ue', 'candidate'),
    arrow('ue', 'throughput-result', 'result'),
  ]),
  comparison: Object.freeze([
    arrow('serving-satellite', 'candidate-satellite', 'candidate'),
    arrow('sinr-result', 'ee-result', 'result'),
  ]),
});

const INTRA_ARROWS: Readonly<Record<VisualLabGuidedReplayPhase, readonly VisualLabGuidedReplayAnnotationArrow[]>> = Object.freeze({
  baseline: Object.freeze([
    arrow('serving-satellite', 'serving-beam', 'service'),
    arrow('serving-beam', 'ue', 'service'),
    arrow('ue', 'sinr-result', 'result'),
  ]),
  intervention: Object.freeze([
    arrow('serving-satellite', 'serving-beam', 'service'),
    arrow('serving-beam', 'candidate-beam', 'candidate'),
  ]),
  before: Object.freeze([
    arrow('serving-satellite', 'serving-beam', 'service'),
    arrow('serving-beam', 'ue', 'service'),
  ]),
  decision: Object.freeze([
    arrow('serving-beam', 'candidate-beam', 'candidate'),
    arrow('ue', 'sinr-result', 'result'),
  ]),
  after: Object.freeze([
    arrow('serving-satellite', 'candidate-beam', 'candidate'),
    arrow('candidate-beam', 'ue', 'candidate'),
    arrow('ue', 'throughput-result', 'result'),
  ]),
  comparison: Object.freeze([
    arrow('serving-beam', 'candidate-beam', 'candidate'),
    arrow('sinr-result', 'ee-result', 'result'),
  ]),
});

function targetsFor(
  storyId: VisualLabGuidedReplayId,
  phase: VisualLabGuidedReplayPhase,
): readonly VisualLabGuidedReplayAnnotationTarget[] {
  return storyId === 'inter-handover' ? INTER_TARGETS[phase] : INTRA_TARGETS[phase];
}

function arrowsFor(
  storyId: VisualLabGuidedReplayId,
  phase: VisualLabGuidedReplayPhase,
): readonly VisualLabGuidedReplayAnnotationArrow[] {
  return storyId === 'inter-handover' ? INTER_ARROWS[phase] : INTRA_ARROWS[phase];
}

/**
 * Build the source-neutral annotation contract for one guided replay point.
 * No frame, metric, identity, or anchor is computed here; the active guided
 * runtime remains the sole owner of those values.
 */
export function buildVisualLabGuidedReplayAnnotationPlan(
  storyId: VisualLabGuidedReplayId,
  phase: VisualLabGuidedReplayPhase,
): VisualLabGuidedReplayAnnotationPlan {
  const definition = guidedReplayDefinition(storyId);
  const targetCues: readonly VisualLabGuidedReplayAnnotationCue[] = Object.freeze(
    targetsFor(storyId, phase).map((target) => Object.freeze({
      target,
      mark: TARGET_MARKS[target],
      tone: TARGET_TONES[target],
      label: TARGET_LABELS[target],
    })),
  );
  return Object.freeze({
    storyId,
    phase,
    title: definition.title,
    phaseLabel: localized(guidedReplayPhaseLabel(phase, 'zh-Hant'), guidedReplayPhaseLabel(phase, 'en')),
    subtitle: PHASE_SUBTITLES[storyId][phase],
    cues: targetCues,
    arrows: arrowsFor(storyId, phase),
  });
}

export function guidedReplayAnnotationPlansFor(
  storyId: VisualLabGuidedReplayId,
): readonly VisualLabGuidedReplayAnnotationPlan[] {
  return Object.freeze(VISUAL_LAB_GUIDED_REPLAY_PHASES.map(phase => (
    buildVisualLabGuidedReplayAnnotationPlan(storyId, phase)
  )));
}
