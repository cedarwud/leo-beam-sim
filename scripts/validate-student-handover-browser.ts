import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';

import {
  MEASURED_BROWSER_GATE_FLOORS_MS,
  runBrowserValidator,
} from './lib/browser-gate';
import {
  validateR6EvidenceTelemetry,
  validateR6ResetEquivalence,
  validateR6StudentSurfaceSet,
  type R6CheckpointId,
  type R6EvidenceClaim,
  type R6EvidenceTelemetry,
  type R6StudentSurface,
  type R6StudentTelemetry,
} from './lib/student-handover-acceptance';

const ROOT = '.leo-app-shell';
const SCENE = '[data-testid="leo-main-scene"] canvas';
const RAIL = '[data-testid="student-guided-flow-panel"]';
const CAPTION = '[data-testid="handover-teaching-caption"]';
const ACTIVITY = '[data-testid="student-activity-surface"]';
const EVIDENCE = '[data-testid="student-evidence-panel"]';
const SURFACE_SELECTORS: Readonly<Record<R6StudentSurface, string>> = Object.freeze({
  root: ROOT,
  scene: SCENE,
  rail: RAIL,
  caption: CAPTION,
  activity: ACTIVITY,
});
const TIMEOUT_MS = 30_000;
const POLL_MS = 50;

interface SurfaceSet {
  readonly root: R6StudentTelemetry;
  readonly scene: R6StudentTelemetry;
  readonly rail: R6StudentTelemetry;
  readonly caption: R6StudentTelemetry;
  readonly activity: R6StudentTelemetry;
}

interface DomMutation {
  readonly selector: string;
  readonly attribute: string;
  readonly value: string;
}

async function readSurfaceTelemetry(
  page: Page,
  surface: R6StudentSurface,
): Promise<R6StudentTelemetry | null> {
  const locator = page.locator(SURFACE_SELECTORS[surface]);
  if (await locator.count() === 0) return null;
  return locator.first().evaluate((element, surfaceName) => ({
    surface: element.dataset.studentActivitySurface ?? surfaceName,
    binding: element.dataset.studentActivityBinding ?? '',
    schemaVersion: element.dataset.studentActivitySchemaVersion ?? '',
    activityId: element.dataset.studentActivityId ?? '',
    activityVersion: element.dataset.studentActivityVersion ?? '',
    step: element.dataset.studentActivityStep ?? '',
    runId: element.dataset.studentActivityRunId ?? '',
    prediction: element.dataset.studentActivityPrediction ?? '',
    predictionLocked: element.dataset.studentActivityPredictionLocked ?? '',
    checkpointId: element.dataset.studentActivityCheckpointId ?? '',
    observedCheckpoints: element.dataset.studentActivityObservedCheckpoints ?? '',
    explanation: element.dataset.studentActivityExplanation ?? '',
    evidenceClaims: element.dataset.studentActivityEvidenceClaims ?? '',
    receiptId: element.dataset.studentActivityReceiptId ?? '',
    resetIdentity: element.dataset.studentActivityResetIdentity ?? '',
    scenarioId: element.dataset.studentActivityScenarioId ?? '',
    scenarioVersion: element.dataset.studentActivityScenarioVersion ?? '',
    segment: element.dataset.studentActivitySegment ?? '',
    instructorRunId: element.dataset.studentActivityInstructorRunId ?? '',
    sourceTimeSec: element.dataset.studentActivitySourceTimeSec ?? '',
    storyId: element.dataset.studentActivityStoryId ?? '',
    pairKey: element.dataset.studentActivityPairKey ?? '',
    storyPhase: element.dataset.studentActivityStoryPhase ?? '',
    committed: element.dataset.studentActivityCommitted ?? '',
  }), surface);
}

async function captureSurfaceSet(
  page: Page,
  mutation: DomMutation | null = null,
): Promise<SurfaceSet | null> {
  let previous: string | null = null;
  let mutationTarget = mutation === null ? null : page.locator(mutation.selector).first();
  if (mutationTarget !== null) {
    if (await mutationTarget.count() === 0) return null;
    previous = await mutationTarget.getAttribute(mutation.attribute);
    await mutationTarget.evaluate((element, mutationSpec) => {
      element.setAttribute(mutationSpec.attribute, mutationSpec.value);
    }, mutation);
  }
  try {
    const [root, scene, rail, caption, activity] = await Promise.all([
      readSurfaceTelemetry(page, 'root'),
      readSurfaceTelemetry(page, 'scene'),
      readSurfaceTelemetry(page, 'rail'),
      readSurfaceTelemetry(page, 'caption'),
      readSurfaceTelemetry(page, 'activity'),
    ]);
    if (root === null || scene === null || rail === null || caption === null || activity === null) {
      return null;
    }
    return { root, scene, rail, caption, activity };
  } finally {
    if (mutationTarget !== null && mutation !== null) {
      await mutationTarget.evaluate((element, restore) => {
        if (restore.previous === null) element.removeAttribute(restore.attribute);
        else element.setAttribute(restore.attribute, restore.previous);
      }, { attribute: mutation.attribute, previous });
    }
  }
}

async function captureEvidence(
  page: Page,
  mutation: DomMutation | null = null,
): Promise<R6EvidenceTelemetry | null> {
  return page.evaluate(({ selector, mutationSpec }) => {
    const panel = document.querySelector<HTMLElement>(selector);
    if (panel === null) return null;
    let target: Element | null = null;
    let previous: string | null = null;
    if (mutationSpec !== null) {
      target = document.querySelector(mutationSpec.selector);
      if (target === null) return null;
      previous = target.getAttribute(mutationSpec.attribute);
      target.setAttribute(mutationSpec.attribute, mutationSpec.value);
    }
    const claims = {
      'serving-below-floor': '',
      'replacement-above-floor': '',
      'replacement-beats-serving': '',
      'hold-complete': '',
      committed: '',
    } satisfies Record<R6EvidenceClaim, string>;
    for (const element of panel.querySelectorAll<HTMLElement>('[data-evidence-claim]')) {
      const claim = element.dataset.evidenceClaim as R6EvidenceClaim | undefined;
      if (claim !== undefined && claim in claims) {
        claims[claim] = element.dataset.evidenceValue ?? '';
      }
    }
    const result: R6EvidenceTelemetry = {
      checkpointId: panel.dataset.evidenceCheckpointId ?? '',
      sourceTimeSec: panel.dataset.evidenceSourceTimeSec ?? '',
      storyId: panel.dataset.evidenceStoryId ?? '',
      pairKey: panel.dataset.evidencePairKey ?? '',
      claims,
    };
    if (target !== null && mutationSpec !== null) {
      if (previous === null) target.removeAttribute(mutationSpec.attribute);
      else target.setAttribute(mutationSpec.attribute, previous);
    }
    return result;
  }, { selector: EVIDENCE, mutationSpec: mutation });
}

async function waitForSurfaceSet(
  page: Page,
  expectedStep: R6StudentTelemetry['step'],
  expectedCheckpointId: R6CheckpointId | null = null,
): Promise<SurfaceSet> {
  const deadline = Date.now() + TIMEOUT_MS;
  let last: readonly string[] = ['surface set not mounted'];
  while (Date.now() < deadline) {
    const capture = await captureSurfaceSet(page);
    if (capture !== null && capture.root.step === expectedStep) {
      last = validateR6StudentSurfaceSet(
        capture.root,
        capture.scene,
        capture.rail,
        capture.caption,
        capture.activity,
        expectedCheckpointId,
      );
      if (last.length === 0) return capture;
    }
    await page.waitForTimeout(POLL_MS);
  }
  throw new Error(
    `R6 surfaces did not stabilize at ${expectedStep}/${expectedCheckpointId ?? 'entry'}: ${last.join('; ')}`,
  );
}

async function waitForEvidence(
  page: Page,
  checkpointId: R6CheckpointId,
  activity: R6StudentTelemetry,
): Promise<R6EvidenceTelemetry> {
  const deadline = Date.now() + TIMEOUT_MS;
  let last: readonly string[] = ['evidence panel not mounted'];
  while (Date.now() < deadline) {
    const capture = await captureEvidence(page);
    if (capture !== null) {
      last = validateR6EvidenceTelemetry(capture, checkpointId, activity);
      if (last.length === 0) return capture;
    }
    await page.waitForTimeout(POLL_MS);
  }
  throw new Error(`R6 evidence did not stabilize at ${checkpointId}: ${last.join('; ')}`);
}

async function assertStudentControlBoundary(page: Page): Promise<void> {
  const root = page.locator(ROOT);
  assert.equal(await root.getAttribute('data-student-mode'), 'active');
  assert.equal(await root.getAttribute('data-student-control-boundary'), 'safe-only');
  for (const selector of [
    '[data-testid="shell-chrome-controls"]',
    '[data-testid="simulation-source-toggle"]',
    '[data-testid="director-intra-focus"]',
    '[data-testid="director-inter-focus"]',
    '[data-testid="handover-teaching-rail"]',
  ]) {
    assert.equal(await page.locator(selector).count(), 0, `${selector} must not be mounted`);
  }
  const leftSidebar = page.locator('.leo-shell-left');
  assert.equal(await leftSidebar.getAttribute('data-shell-visibility'), 'hidden');
  assert.equal(await leftSidebar.getAttribute('aria-hidden'), 'true');
  assert.equal(await leftSidebar.isVisible(), false);
  for (const testId of [
    'timeline-jump-start',
    'timeline-step-backward',
    'timeline-toggle-play',
    'timeline-step-forward',
    'timeline-jump-end',
    'timeline-speed-5x',
    'timeline-scrubber',
  ]) {
    const control = page.getByTestId(testId);
    if (await control.count() > 0) assert.equal(await control.isDisabled(), true, testId);
  }
}

async function assertTeacherPromptReadable(page: Page): Promise<void> {
  const prompt = page.getByTestId('student-group-vote-prompt');
  await prompt.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  const box = await prompt.boundingBox();
  assert.ok(box !== null && box.width >= 180 && box.height >= 40, 'teacher-led prompt has no readable box');
  const visual = await prompt.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      text: element.textContent?.trim() ?? '',
    };
  });
  assert.ok(visual.fontSize >= 16, `teacher prompt font-size=${visual.fontSize}`);
  assert.ok(visual.lineHeight >= 20, `teacher prompt line-height=${visual.lineHeight}`);
  assert.ok(visual.text.length >= 20, 'teacher prompt copy is empty');
}

async function assertBilingualProjectionCopy(page: Page): Promise<void> {
  const title = page.getByTestId('student-activity-title');
  const prompt = page.getByTestId('student-group-vote-prompt');
  const predictProgress = page.locator('[data-student-progress-step="predict"]');
  const banner = page.getByTestId('student-mode-banner');

  await page.getByTestId('locale-toggle-zh-TW').click();
  await page.waitForTimeout(50);
  assert.match((await banner.textContent()) ?? '', /學生引導流程/);
  assert.match((await title.textContent()) ?? '', /預測.*操作.*觀察.*解釋.*重設/);
  assert.match((await prompt.textContent()) ?? '', /舉手|口頭表決/);
  assert.match((await predictProgress.textContent()) ?? '', /預測/);

  await page.getByTestId('locale-toggle-en').click();
  await page.waitForTimeout(50);
  assert.match((await banner.textContent()) ?? '', /Student guided flow/);
  assert.match((await title.textContent()) ?? '', /Predict.*Operate.*Observe.*Explain.*Reset/);
  assert.match((await prompt.textContent()) ?? '', /vote by hand/);
  assert.match((await predictProgress.textContent()) ?? '', /Predict/);

  // Leave the projected class flow in zh-TW after proving both locales.
  await page.getByTestId('locale-toggle-zh-TW').click();
  await page.waitForTimeout(50);
}

async function assertMutationRedGreen(
  page: Page,
  mutation: DomMutation,
  expectedCheckpointId: R6CheckpointId,
): Promise<void> {
  const mutated = await captureSurfaceSet(page, mutation);
  assert.ok(mutated !== null, `mutation target missing: ${mutation.selector}`);
  const red = validateR6StudentSurfaceSet(
    mutated.root,
    mutated.scene,
    mutated.rail,
    mutated.caption,
    mutated.activity,
    expectedCheckpointId,
  );
  assert.ok(red.length > 0, `${mutation.attribute} mutation stayed green`);
  await waitForSurfaceSet(page, 'complete', expectedCheckpointId);
}

void runBrowserValidator({
  validator: 'R6 student guided-flow production',
  floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.multiCanvas,
}, async ({ page }) => {
  await page.locator(SCENE).waitFor({ state: 'attached', timeout: TIMEOUT_MS });
  const launcher = page.getByTestId('student-guided-flow-launch');
  await launcher.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  assert.equal(await launcher.isEnabled(), true, 'R6 launcher must be admitted on the seven-beam baseline');
  await launcher.click();

  const initial = await waitForSurfaceSet(page, 'predict');
  await assertStudentControlBoundary(page);
  await assertTeacherPromptReadable(page);
  await assertBilingualProjectionCopy(page);
  assert.equal(await page.getByTestId('student-step-predict').isVisible(), true);

  await page.getByTestId('student-prediction-switch-target').click();
  await page.getByTestId('student-lock-prediction').click();
  const operate = await waitForSurfaceSet(page, 'operate');
  assert.equal(operate.root.prediction, 'switch-target');
  assert.equal(operate.root.predictionLocked, 'true');
  assert.ok(operate.root.runId.length > 0);

  await page.getByTestId('student-start-observation').click();
  const candidate = await waitForSurfaceSet(page, 'observe', 'candidate-comparison');
  await waitForEvidence(page, 'candidate-comparison', candidate.activity);

  await page.getByTestId('student-next-checkpoint').click();
  const conditions = await waitForSurfaceSet(page, 'observe', 'conditions-and-hold');
  await waitForEvidence(page, 'conditions-and-hold', conditions.activity);

  await page.getByTestId('student-next-checkpoint').click();
  const committed = await waitForSurfaceSet(page, 'observe', 'commit-receipt');
  await waitForEvidence(page, 'commit-receipt', committed.activity);

  await page.getByTestId('student-finish-observe').click();
  await waitForSurfaceSet(page, 'explain', 'commit-receipt');
  await page.getByTestId('student-explanation-all-four-conditions-held').click();
  await page.getByTestId('student-evidence-choice-serving-below-floor').click();
  assert.equal(await page.getByTestId('student-submit-explanation').isEnabled(), true);
  await page.getByTestId('student-submit-explanation').click();
  await waitForSurfaceSet(page, 'complete', 'commit-receipt');
  assert.equal(await page.getByTestId('student-completion-receipt').isVisible(), true);

  const requiredMutations: readonly DomMutation[] = Object.freeze([
    { selector: ACTIVITY, attribute: 'data-student-activity-step', value: 'operate' },
    { selector: ACTIVITY, attribute: 'data-student-activity-run-id', value: 'mutated-run' },
    { selector: ACTIVITY, attribute: 'data-student-activity-prediction-locked', value: 'false' },
    { selector: ACTIVITY, attribute: 'data-student-activity-story-id', value: 'mutated-story' },
    { selector: ACTIVITY, attribute: 'data-student-activity-pair-key', value: 'mutated-pair' },
    { selector: ACTIVITY, attribute: 'data-student-activity-source-time-sec', value: '51' },
    { selector: ACTIVITY, attribute: 'data-student-activity-checkpoint-id', value: 'conditions-and-hold' },
    { selector: ACTIVITY, attribute: 'data-student-activity-evidence-claims', value: 'committed' },
    { selector: ACTIVITY, attribute: 'data-student-activity-reset-identity', value: 'mutated-reset' },
  ]);
  for (const mutation of requiredMutations) {
    await assertMutationRedGreen(page, mutation, 'commit-receipt');
  }

  const evidenceMutation: DomMutation = {
    selector: `${EVIDENCE} [data-evidence-claim="serving-below-floor"]`,
    attribute: 'data-evidence-value',
    value: 'false',
  };
  const mutatedEvidence = await captureEvidence(page, evidenceMutation);
  assert.ok(mutatedEvidence !== null);
  assert.ok(
    validateR6EvidenceTelemetry(mutatedEvidence, 'commit-receipt', committed.activity).length > 0,
    'explanation evidence mutation stayed green',
  );
  await waitForEvidence(page, 'commit-receipt', committed.activity);

  await page.getByTestId('student-reset-activity').click();
  const reset = await waitForSurfaceSet(page, 'predict');
  const resetErrors = validateR6ResetEquivalence(initial.root, reset.root);
  assert.deepEqual(resetErrors, [], `reset residuals: ${resetErrors.join('; ')}`);
  assert.notEqual(reset.root.instructorRunId, initial.root.instructorRunId, 'R5 run ID must prove restart');
  assert.equal(reset.root.sourceTimeSec, '0');
  assert.equal(reset.root.segment, 'intra');
  assert.equal(reset.root.runId, '');
  assert.equal(reset.root.prediction, '');
  assert.equal(reset.root.explanation, '');
  assert.equal(reset.root.receiptId, '');

  await page.getByTestId('student-exit-activity').click();
  await launcher.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  assert.equal(await page.locator(RAIL).count(), 0, 'student rail must unmount after clean exit');

  // Keep the browser phase above the shared measured floor even on a warm local run.
  await page.waitForTimeout(MEASURED_BROWSER_GATE_FLOORS_MS.multiCanvas);
  console.log('R6 production browser gate passed: Predict → Operate → Observe → Explain → Complete → Reset');
  console.log(`R6 initial story=${initial.root.storyId} pair=${initial.root.pairKey}`);
  console.log(`R6 reset instructor run ${initial.root.instructorRunId} -> ${reset.root.instructorRunId}`);
  console.log(`R6 mutation red→green cases=${requiredMutations.length + 1}`);
});
