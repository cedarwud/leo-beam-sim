import assert from 'node:assert/strict';

import {
  buildVisualLabGuidedReplayAnnotationPlan,
  guidedReplayAnnotationPlansFor,
  VISUAL_LAB_GUIDED_REPLAY_ANNOTATION_TARGETS,
} from './annotationPlan';
import { VISUAL_LAB_GUIDED_REPLAY_PHASES } from './model';
import type { VisualLabGuidedReplayId } from './types';

const stories: readonly VisualLabGuidedReplayId[] = ['inter-handover', 'intra-beam-handover'];
const requiredResultTargets = ['sinr-result', 'power-result', 'throughput-result', 'ee-result'] as const;

for (const storyId of stories) {
  const plans = guidedReplayAnnotationPlansFor(storyId);
  assert.equal(plans.length, 6, `${storyId} exposes all six guided phases`);
  assert.deepEqual(plans.map(plan => plan.phase), VISUAL_LAB_GUIDED_REPLAY_PHASES);

  for (const phase of VISUAL_LAB_GUIDED_REPLAY_PHASES) {
    const plan = buildVisualLabGuidedReplayAnnotationPlan(storyId, phase);
    assert.equal(plan.storyId, storyId);
    assert.equal(plan.phase, phase);
    assert.ok(plan.title['zh-Hant'].length > 0);
    assert.ok(plan.title.en.length > 0);
    assert.ok(plan.phaseLabel['zh-Hant'].length > 0);
    assert.ok(plan.phaseLabel.en.length > 0);
    assert.ok(plan.subtitle['zh-Hant'].length > 0);
    assert.ok(plan.subtitle.en.length > 0);
    assert.ok(plan.cues.length > 0, `${storyId}/${phase} has semantic cues`);
    assert.equal(new Set(plan.cues.map(cue => cue.target)).size, plan.cues.length);
    assert.ok(plan.cues.every(cue => (
      cue.label['zh-Hant'].length > 0
      && cue.label.en.length > 0
      && VISUAL_LAB_GUIDED_REPLAY_ANNOTATION_TARGETS.includes(cue.target)
    )));
    assert.ok(plan.arrows.every(arrow => (
      plan.cues.some(cue => cue.target === arrow.from)
      && plan.cues.some(cue => cue.target === arrow.to)
    )));

    const serialized = JSON.stringify(plan);
    assert.doesNotMatch(serialized, /\b(?:mock|fake)\b/i, `${storyId}/${phase} has no forbidden placeholder copy`);
    assert.doesNotMatch(serialized, /TTT|threshold/i, `${storyId}/${phase} does not invent a threshold/TTT mechanism`);
    assert.doesNotMatch(serialized, /(?:sinrDb|powerW|throughputBps|instantaneousEeBitsPerJ)/, `${storyId}/${phase} carries no metric values`);
  }

  const targetSet = new Set(plans.flatMap(plan => plan.cues.map(cue => cue.target)));
  for (const target of requiredResultTargets) assert.equal(targetSet.has(target), true, `${storyId} covers ${target}`);
  assert.equal(targetSet.has('serving-satellite'), true);
  assert.equal(targetSet.has('serving-beam'), true);
  assert.equal(targetSet.has('ue'), true);
  assert.equal(
    targetSet.has(storyId === 'inter-handover' ? 'candidate-satellite' : 'candidate-beam'),
    true,
    `${storyId} covers its candidate semantic target`,
  );
}

console.log('visual-lab guided replay annotation plans cover both stories and six phases');
