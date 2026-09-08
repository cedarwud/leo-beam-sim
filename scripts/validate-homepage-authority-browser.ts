/**
 * Homepage authority/browser gate.
 *
 * This intentionally connects to the already-running homepage only. It
 * exercises the real public Walker SINR/scenario controls and proves that the
 * central selected-link callout, scene, and homepage beam rail publish one
 * accepted frame. No hidden probe or second dev server participates in this
 * gate.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import {
  DEFAULT_WALKER_SCENARIO_DATE,
  DEFAULT_WALKER_SCENARIO_TIME,
} from '../src/app/walkerScenarioTime';

const BASE_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const HOMEPAGE_TIMELINE_READY_TIMEOUT_MS = Number(
  process.env.HOMEPAGE_TIMELINE_READY_TIMEOUT_MS ?? 180_000,
);
const [DEFAULT_WALKER_HOUR, DEFAULT_WALKER_MINUTE] = DEFAULT_WALKER_SCENARIO_TIME.split(':');
const HOME_RAIL_SELECTOR = '[data-testid="homepage-beam-rail"]';
const SCENE_SELECTOR = '[data-testid="leo-main-scene"]';
const SCENE_CANVAS_SELECTOR = SCENE_SELECTOR + ' canvas';
const TIMELINE_SELECTOR = '[data-testid="timeline-bar"]';

interface SharedHomepageSnapshot {
  readonly railSnapshotId: string;
  readonly railSourceFrameId: string;
  readonly railPhase: string;
  readonly railHostSnapshotId: string;
  readonly railHostSourceFrameId: string;
  readonly railHostPhase: string;
  readonly sceneSnapshotId: string;
  readonly sceneSourceFrameId: string;
  readonly scenePhase: string;
  readonly servingSnapshotId: string;
  readonly servingSourceFrameId: string;
  readonly servingSat: string;
  readonly servingBeam: string;
  readonly servingJoinKey: string;
  readonly centerTime: string;
  readonly centerSat: string;
  readonly centerBeam: string;
  readonly centerSinrDb: string;
  readonly centerThroughputBps: string;
  readonly centerSystemPowerW: string;
  readonly centerEeBitsPerJoule: string;
  readonly railActiveDataLinkCount: string;
  readonly sceneActiveDataLinkCount: string;
  readonly candidateSceneSnapshotId: string;
  readonly candidateSceneSourceFrameId: string;
  readonly candidateSceneRenderStatus: string;
  readonly railMetricTexts: readonly string[];
  readonly railBackgroundColor: string;
}

// The serving row renders exactly these metric cells. EE is deliberately excluded:
// HomepageBeamRail filters it out of the metric grid
// (src/ui/homepage/HomepageBeamRail.tsx:381) and presents it via EeProgressSummary
// under data-testid="homepage-beam-ee-progress". Both the predicate and the count
// assertion read this one list so they cannot drift apart again.
const SERVING_ROW_METRIC_FIELDS = ['powerW', 'throughputBps', 'sinrDb'] as const;

function assertHomepageRailPresentation(shared: SharedHomepageSnapshot): void {
  assert.ok(
    [shared.centerSystemPowerW, shared.centerThroughputBps, shared.centerSinrDb, shared.centerEeBitsPerJoule]
      .every(value => Number.isFinite(Number(value))),
    'central selected-link callout must publish finite live metrics',
  );
  assert.equal(shared.railBackgroundColor, 'rgb(6, 19, 27)', 'homepage rail must remain a dark instrument surface');
  assert.equal(
    shared.railMetricTexts.some(text => /\b\d{4,}(?:\.\d+)?\s*(?:bit\/s|bit\/J)\b/.test(text)),
    false,
    'homepage rail must not expose ungrouped long rate/EE units',
  );
  assert.ok(
    shared.railMetricTexts.some(text => /\b\d+(?:\.\d+)?\s+[kMG](?:bit\/s|bit\/J)\b/.test(text)),
    'homepage rail must expose compact k/M/G rate or EE units',
  );
  assert.equal(
    shared.railMetricTexts.length,
    SERVING_ROW_METRIC_FIELDS.length,
    `homepage serving row must expose its ${SERVING_ROW_METRIC_FIELDS.length} metric cells (EE lives in homepage-beam-ee-progress)`,
  );
}

async function assertWalkerHomepage(page: Page): Promise<void> {
  await page.goto(new URL('/', BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
  const timeline = page.locator(TIMELINE_SELECTOR);
  await timeline.waitFor({ timeout: 30_000 });
  if (await timeline.getAttribute('data-paused') !== 'true') {
    await page.locator('[data-testid="timeline-toggle-play"]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="timeline-bar"]')?.getAttribute('data-paused') === 'true');
  }
  await page.locator('[data-testid="sinr-live-display"]').waitFor({ timeout: 30_000 });
  await page.locator(HOME_RAIL_SELECTOR).waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
    const host = document.querySelector<HTMLElement>('[data-homepage-rail-snapshot-id]');
    const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
    return rail !== null
      && host !== null
      && scene !== null
      && rail.dataset.snapshotId !== ''
      && rail.dataset.sourceFrameId !== ''
      && rail.dataset.phase !== ''
      && host.dataset.homepageRailSnapshotId === rail.dataset.snapshotId
      && host.dataset.homepageRailSourceFrameId === rail.dataset.sourceFrameId
      && host.dataset.homepageRailPhase === rail.dataset.phase
      && scene.dataset.acceptedHandoverSnapshotId === rail.dataset.snapshotId
      && scene.dataset.acceptedHandoverSourceFrameId === rail.dataset.sourceFrameId
      && scene.dataset.acceptedHandoverPhase === rail.dataset.phase;
  }, undefined, { timeout: 30_000 });
  await assertNaturalHomepageTimeline(page);
  await page.waitForTimeout(250);

  const shell = page.locator('.leo-app-shell');
  assert.equal(await shell.getAttribute('data-active-simulation-source'), 'walker', 'homepage must mount Walker as the active source');
  assert.equal(await shell.getAttribute('data-timeline-source-owner'), 'live-walker', 'homepage timeline must remain owned by the Walker runtime');
  assert.equal(
    await page.locator('[data-testid="simulation-source-toggle"]').count(),
    0,
    'homepage TLE/Walker source toggle must stay hidden while the Walker gate is active',
  );
  assert.equal(
    await page.locator('[data-testid="homepage-canonical-controls"]').count(),
    0,
    'canonical archived-TLE controls must not be mounted in the Walker-only homepage',
  );

  // The transport contract is selected speed plus the live effective speed.
  await page.locator('[data-testid="timeline-speed-5x"]').click();
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLElement>('[data-testid="timeline-speed-5x"]');
    const effectiveSpeed = Number(document.querySelector<HTMLElement>('.leo-app-shell')?.dataset.effectiveSpeed);
    return button?.getAttribute('aria-pressed') === 'true'
      && Number.isFinite(effectiveSpeed)
      && effectiveSpeed > 0
      && effectiveSpeed <= 5;
  }, undefined, { timeout: 5_000 });
  await page.locator('[data-testid="timeline-speed-1x"]').click();
  await page.waitForFunction(
    () => document.querySelector<HTMLElement>('[data-testid="timeline-speed-1x"]')?.getAttribute('aria-pressed') === 'true',
    undefined,
    { timeout: 5_000 },
  );

  // These formula pages remain current Walker explanations, but are explicitly
  // read-only and derived-only rather than pretending to be input controls.
  for (const [tab, testId] of [
    ['power', 'walker-power-page'],
    ['throughput', 'walker-throughput-page'],
    ['energy', 'walker-ee-page'],
  ] as const) {
    await page.locator('#signal-tuning-main-tab-' + tab).click();
    const panel = page.locator('[data-testid="' + testId + '"]');
    await panel.waitFor({ state: 'visible', timeout: 5_000 });
    assert.equal(await panel.getAttribute('data-readonly'), 'true', tab + ' must be marked read-only on Walker');
    assert.equal(await panel.getAttribute('data-control-surface'), 'derived-only', tab + ' must be derived-only on Walker');
    assert.equal(await panel.locator('input, select, textarea').count(), 0, tab + ' must not pretend to expose an input');
  }
}

/**
 * The homepage timeline exposes a bounded teaching projection of the natural
 * live-Walker event index. Keep the marker contract tied to the current DOM:
 * one source-backed marker per event kind, exact source/click metadata, and
 * the live source/horizon claim on the transport itself.
 */
async function assertNaturalHomepageTimeline(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-bar"]');
    if (timeline === null) return false;
    const markers = [...timeline.querySelectorAll<HTMLElement>('[data-testid^="timeline-event-marker-"]')];
    const kinds = new Set(markers.map(marker => marker.dataset.markerKind));
    return timeline.dataset.sourceOwner === 'live-walker'
      && timeline.dataset.horizonKind === 'live-walker-window'
      && timeline.dataset.claimKind === 'live-truth'
      && Number.isFinite(Number(timeline.dataset.durationSec))
      && Number(timeline.dataset.durationSec) > 0
      && markers.length === 2
      && kinds.has('intra')
      && kinds.has('inter');
  }, undefined, { timeout: HOMEPAGE_TIMELINE_READY_TIMEOUT_MS });

  const contract = await page.evaluate(() => {
    const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-bar"]');
    if (timeline === null) throw new Error('homepage timeline is missing');
    const durationSec = Number(timeline.dataset.durationSec);
    const markers = [...timeline.querySelectorAll<HTMLElement>('[data-testid^="timeline-event-marker-"]')].map(marker => ({
      testId: marker.dataset.testid ?? '',
      markerId: marker.dataset.markerId ?? '',
      kind: marker.dataset.markerKind ?? '',
      legacyKind: marker.dataset.kind ?? '',
      sourceTimeSec: Number(marker.dataset.sourceTimeSec),
      clickTargetSec: Number(marker.dataset.clickTargetSec),
      disabled: (marker as HTMLButtonElement).disabled,
      ariaLabel: marker.getAttribute('aria-label') ?? '',
      title: marker.getAttribute('title') ?? '',
    }));
    return {
      timeline: { ...timeline.dataset },
      durationSec,
      markers,
    };
  });

  assert.equal(contract.timeline.sourceOwner, 'live-walker');
  assert.equal(contract.timeline.horizonKind, 'live-walker-window');
  assert.equal(contract.timeline.claimKind, 'live-truth');
  assert.equal(contract.markers.length, 2, 'homepage timeline must expose one natural marker per handover kind');
  assert.deepEqual(
    contract.markers.map(marker => marker.kind).sort(),
    ['inter', 'intra'],
    'homepage timeline markers must cover natural intra and inter events',
  );
  for (const marker of contract.markers) {
    assert.match(marker.testId, /^timeline-event-marker-/);
    assert.match(marker.markerId, new RegExp(`^teaching-${marker.kind}-`));
    assert.equal(marker.legacyKind, marker.kind, `${marker.kind} marker must retain the current kind attribute`);
    assert.equal(marker.disabled, false, `${marker.kind} natural marker must remain actionable`);
    assert.ok(Number.isFinite(marker.sourceTimeSec), `${marker.kind} marker source time must be finite`);
    assert.ok(Number.isFinite(marker.clickTargetSec), `${marker.kind} marker click target must be finite`);
    assert.ok(marker.sourceTimeSec >= 0 && marker.sourceTimeSec <= contract.durationSec, `${marker.kind} source time must be on the timeline`);
    assert.ok(marker.clickTargetSec >= 0 && marker.clickTargetSec <= contract.durationSec, `${marker.kind} click target must be on the timeline`);
    assert.match(marker.ariaLabel, new RegExp(`^Seek to ${marker.kind.toUpperCase()} handover`));
    assert.match(marker.title, /source [0-9.]+ seconds/);
  }
}

// Both waits below used to fail as a bare `Timeout 30000ms exceeded`, which cannot say
// whether the primary callout never appeared or which one of the join conditions never
// settled. The predicate now records the FIRST unmet condition on window before
// returning false, and the catch re-throws with that name. Conditions and their order
// are unchanged, so this reports better without asserting less.
//
// The reason is stashed on window rather than returned: waitForFunction resolves on any
// truthy value, so returning a reason string would make the very first poll "pass".
declare global {
  interface Window { __walkerPredicateFailure?: string }
}

async function readPredicateFailure(page: Page): Promise<string> {
  const reason = await page.evaluate(() => window.__walkerPredicateFailure ?? '');
  return reason === '' ? 'no condition was recorded (predicate never ran)' : reason;
}

async function assertSharedWalkerSnapshot(page: Page): Promise<SharedHomepageSnapshot> {
  try {
    await page.waitForFunction(
      () => document.querySelector('[data-testid="beam-callout"][data-beam-primary="1"]') !== null,
      undefined,
      { timeout: 30_000 },
    );
  } catch {
    throw new Error('shared Walker snapshot stage 1: the primary beam callout never mounted');
  }
  try {
  await page.waitForFunction((fields: readonly string[]) => {
    const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
    const host = document.querySelector<HTMLElement>('[data-homepage-rail-snapshot-id]');
    const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
    const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="leo-main-scene"] canvas');
    const servingRow = rail?.querySelector<HTMLElement>(
      '[aria-labelledby="homepage-serving-beam-title"] [data-testid="homepage-beam-row"]',
    ) ?? null;
    // EE is deliberately NOT one of the row's metric cells: HomepageBeamRail filters it
    // out of the metric grid (src/ui/homepage/HomepageBeamRail.tsx:381) and presents it
    // through EeProgressSummary instead (data-testid="homepage-beam-ee-progress").
    // Asserting an EE cell here required an element the rail is designed not to render,
    // so this gate could never pass. The EE contract is kept -- it moved to the surface
    // that actually carries it, checked below.
    const metricFields = fields;
    const checks: readonly (readonly [string, () => boolean])[] = [
      ['rail element', () => rail !== null],
      ['rail host element', () => host !== null],
      ['scene element', () => scene !== null],
      ['primary callout element', () => center !== null],
      ['scene canvas', () => canvas !== null],
      ['serving beam row', () => servingRow !== null],
      ['rail snapshotId is set', () => rail!.dataset.snapshotId !== ''],
      ['rail sourceFrameId is set', () => rail!.dataset.sourceFrameId !== ''],
      ['rail phase is set', () => rail!.dataset.phase !== ''],
      ['host joins rail snapshotId', () => host!.dataset.homepageRailSnapshotId === rail!.dataset.snapshotId],
      ['host joins rail sourceFrameId', () => host!.dataset.homepageRailSourceFrameId === rail!.dataset.sourceFrameId],
      ['host joins rail phase', () => host!.dataset.homepageRailPhase === rail!.dataset.phase],
      ['scene joins rail snapshotId', () => scene!.dataset.acceptedHandoverSnapshotId === rail!.dataset.snapshotId],
      ['scene joins rail sourceFrameId', () => scene!.dataset.acceptedHandoverSourceFrameId === rail!.dataset.sourceFrameId],
      ['scene joins rail phase', () => scene!.dataset.acceptedHandoverPhase === rail!.dataset.phase],
      ['serving row joins rail snapshotId', () => servingRow!.dataset.snapshotId === rail!.dataset.snapshotId],
      ['serving row joins rail sourceFrameId', () => servingRow!.dataset.sourceFrameId === rail!.dataset.sourceFrameId],
      ['rail active data-link count is 1', () => rail!.querySelector<HTMLElement>('[data-active-data-link-count]')?.dataset.activeDataLinkCount === '1'],
      ['scene active data-link count is 1', () => scene!.dataset.acceptedHandoverActiveDataLinkCount === '1'],
      ['canvas multi-candidate accepted join', () => canvas!.dataset.multiCandidateSceneRenderStatus !== 'active'
        || (canvas!.dataset.multiCandidateSceneAcceptedSnapshotId === rail!.dataset.snapshotId
          && canvas!.dataset.multiCandidateSceneAcceptedSourceFrameId === rail!.dataset.sourceFrameId)],
      ['serving row satellite matches callout', () => servingRow!.dataset.satelliteId === center!.dataset.angleAwareFrameSatId],
      ['serving row beam matches callout', () => servingRow!.dataset.beamId === center!.dataset.angleAwareFrameBeamId],
      ['callout frame time is set', () => center!.dataset.angleAwareFrameTimeSec !== ''],
      ['callout frame SINR is set', () => center!.dataset.angleAwareFrameSinrDb !== ''],
      ['callout frame throughput is set', () => center!.dataset.angleAwareFrameThroughputBps !== ''],
      ['callout frame system power is set', () => center!.dataset.angleAwareFrameSystemPowerW !== ''],
      ['callout frame EE is set', () => center!.dataset.angleAwareFrameEeBitsPerJoule !== ''],
      ['serving row exposes the EE progress summary', () => {
        const ee = rail!.querySelector<HTMLElement>('[data-testid="homepage-beam-ee-progress"]');
        return ee !== null && (ee.textContent ?? '').trim() !== '';
      }],
      ...metricFields.map(field => [
        'serving row metric text is non-empty: ' + field,
        () => (servingRow!.querySelector('[data-testid="homepage-beam-metric-' + field + '"]')?.textContent ?? '').trim() !== '',
      ] as const),
    ];
    for (const [name, holds] of checks) {
      if (!holds()) {
        window.__walkerPredicateFailure = name;
        return false;
      }
    }
    window.__walkerPredicateFailure = undefined;
    return true;
  }, [...SERVING_ROW_METRIC_FIELDS], { timeout: 30_000 });
  } catch {
    throw new Error(`shared Walker snapshot stage 2: unmet condition -- ${await readPredicateFailure(page)}`);
  }
  const shared = await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
    const railHost = document.querySelector<HTMLElement>('[data-homepage-rail-snapshot-id]');
    const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="leo-main-scene"] canvas');
    const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
    const servingRow = rail?.querySelector<HTMLElement>(
      '[aria-labelledby="homepage-serving-beam-title"] [data-testid="homepage-beam-row"]',
    ) ?? null;
    if (!rail || !railHost || !scene || !canvas || !center || !servingRow) {
      throw new Error('homepage scene/rail snapshot nodes are missing');
    }
    return {
      railSnapshotId: rail.dataset.snapshotId ?? '',
      railSourceFrameId: rail.dataset.sourceFrameId ?? '',
      railPhase: rail.dataset.phase ?? '',
      railHostSnapshotId: railHost.dataset.homepageRailSnapshotId ?? '',
      railHostSourceFrameId: railHost.dataset.homepageRailSourceFrameId ?? '',
      railHostPhase: railHost.dataset.homepageRailPhase ?? '',
      sceneSnapshotId: scene.dataset.acceptedHandoverSnapshotId ?? '',
      sceneSourceFrameId: scene.dataset.acceptedHandoverSourceFrameId ?? '',
      scenePhase: scene.dataset.acceptedHandoverPhase ?? '',
      servingSnapshotId: servingRow.dataset.snapshotId ?? '',
      servingSourceFrameId: servingRow.dataset.sourceFrameId ?? '',
      servingSat: servingRow.dataset.satelliteId ?? servingRow.dataset.satId ?? '',
      servingBeam: servingRow.dataset.beamId ?? '',
      servingJoinKey: servingRow.dataset.joinKey ?? '',
      centerTime: center.dataset.angleAwareFrameTimeSec ?? '',
      centerSat: center.dataset.angleAwareFrameSatId ?? '',
      centerBeam: center.dataset.angleAwareFrameBeamId ?? '',
      centerSinrDb: center.dataset.angleAwareFrameSinrDb ?? '',
      centerThroughputBps: center.dataset.angleAwareFrameThroughputBps ?? '',
      centerSystemPowerW: center.dataset.angleAwareFrameSystemPowerW ?? '',
      centerEeBitsPerJoule: center.dataset.angleAwareFrameEeBitsPerJoule ?? '',
      railActiveDataLinkCount: rail.querySelector<HTMLElement>('[data-active-data-link-count]')?.dataset.activeDataLinkCount ?? '',
      sceneActiveDataLinkCount: scene.dataset.acceptedHandoverActiveDataLinkCount ?? '',
      candidateSceneSnapshotId: canvas.dataset.multiCandidateSceneAcceptedSnapshotId ?? '',
      candidateSceneSourceFrameId: canvas.dataset.multiCandidateSceneAcceptedSourceFrameId ?? '',
      candidateSceneRenderStatus: canvas.dataset.multiCandidateSceneRenderStatus ?? '',
      railMetricTexts: [...servingRow.querySelectorAll<HTMLElement>('[data-testid^="homepage-beam-metric-"]')]
        .map(element => element.textContent?.trim() ?? '')
        .filter(Boolean),
      railBackgroundColor: getComputedStyle(rail).backgroundColor,
    };
  });
  assert.ok(shared.railSnapshotId, 'homepage beam rail must publish the accepted snapshot identity');
  assert.ok(shared.railSourceFrameId, 'homepage beam rail must publish the accepted source-frame identity');
  assert.ok(shared.railPhase, 'homepage beam rail must publish the accepted phase');
  assert.ok(shared.centerTime, 'central beam callout must publish the selected-link frame time');
  assert.equal(shared.railActiveDataLinkCount, '1', 'homepage rail must report exactly one active data link');
  assert.equal(shared.sceneActiveDataLinkCount, '1', 'central scene must report exactly one active data link');
  assert.deepEqual(
    [shared.railSnapshotId, shared.railSourceFrameId, shared.railPhase],
    [shared.sceneSnapshotId, shared.sceneSourceFrameId, shared.scenePhase],
    'central scene and homepage rail must consume one accepted snapshot identity and phase',
  );
  if (shared.candidateSceneRenderStatus === 'active') {
    assert.equal(shared.candidateSceneSnapshotId, shared.railSnapshotId, 'active candidate scene must acknowledge the rail snapshot');
    assert.equal(shared.candidateSceneSourceFrameId, shared.railSourceFrameId, 'active candidate scene must acknowledge the rail source frame');
  }
  assert.deepEqual(
    [shared.railHostSnapshotId, shared.railHostSourceFrameId, shared.railHostPhase],
    [shared.railSnapshotId, shared.railSourceFrameId, shared.railPhase],
    'homepage rail host and rail must consume one accepted snapshot identity and phase',
  );
  assert.deepEqual(
    [shared.servingSnapshotId, shared.servingSourceFrameId, shared.servingSat, shared.servingBeam],
    [shared.railSnapshotId, shared.railSourceFrameId, shared.centerSat, shared.centerBeam],
    'homepage serving row and central selected-link callout must consume the same accepted link identity',
  );
  assert.ok(shared.servingJoinKey, 'homepage serving row must publish its current join key');
  assertHomepageRailPresentation(shared);
  return shared;
}

async function waitForCurrentMetricChange(
  page: Page,
  previousValue: string,
  field: 'sinr' | 'throughput',
): Promise<void> {
  await page.waitForFunction(
    ({ previousValue, field }) => {
      const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
      const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      const servingRow = rail?.querySelector<HTMLElement>(
        '[aria-labelledby="homepage-serving-beam-title"] [data-testid="homepage-beam-row"]',
      ) ?? null;
      if (!rail || !scene || !center || !servingRow) return false;
      const currentValue = field === 'sinr'
        ? center.dataset.angleAwareFrameSinrDb
        : center.dataset.angleAwareFrameThroughputBps;
      return rail.dataset.snapshotId !== ''
        && rail.dataset.sourceFrameId !== ''
        && scene.dataset.acceptedHandoverSnapshotId === rail.dataset.snapshotId
        && scene.dataset.acceptedHandoverSourceFrameId === rail.dataset.sourceFrameId
        && scene.dataset.acceptedHandoverPhase === rail.dataset.phase
        && servingRow.dataset.snapshotId === rail.dataset.snapshotId
        && servingRow.dataset.sourceFrameId === rail.dataset.sourceFrameId
        && currentValue !== undefined
        && currentValue !== ''
        && currentValue !== previousValue;
    },
    { previousValue, field },
    { timeout: 30_000 },
  );
}

async function exercisePublicSinrControls(page: Page): Promise<void> {
  await page.locator('#signal-tuning-main-tab-sinr').click();
  const controls = [
    { tab: 'channel', testId: 'gr-receiver-gain-control', kind: 'range', delta: 1, changedField: 'sinr' },
    { tab: 'channel', testId: 'path-loss-term-fspl', kind: 'range', delta: 1, changedField: 'sinr' },
    { tab: 'channel', testId: 'path-loss-term-atmospheric', kind: 'range', delta: 0.1, changedField: 'sinr' },
    { tab: 'channel', testId: 'path-loss-term-scintillation', kind: 'range', delta: 0.1, changedField: 'sinr' },
    { tab: 'channel', testId: 'path-loss-term-shadow-fading', kind: 'range', delta: 1, changedField: 'sinr' },
    { tab: 'beam', testId: 'gtmax-transmit-gain-control', kind: 'range', delta: 1, changedField: 'sinr' },
    { tab: 'beam', testId: 'beamwidth3db-transmit-gain-control', kind: 'range', delta: 0.5, changedField: 'sinr' },
    { tab: 'interference', testId: 'frequency-reuse-interference-control', kind: 'select', changedField: 'sinr' },
    { tab: 'thermal-noise', testId: 'n0-thermal-noise-control', kind: 'range', delta: 1, changedField: 'sinr' },
    { tab: 'thermal-noise', testId: 'bandwidth-thermal-noise-control', kind: 'range', delta: 25, changedField: 'throughput' },
  ] as const;

  for (const probe of controls) {
    const { tab, testId, kind, changedField } = probe;
    await page.locator('#sinr-formula-tab-' + tab).click();
    const control = page.locator('[data-testid="' + testId + '"]');
    await control.waitFor({ state: 'visible', timeout: 5_000 });
    const input = kind === 'range'
      ? control.locator('input[type="range"]')
      : control.locator('select');
    const inputCount = await input.count();
    if (inputCount !== 1) {
      const controlMarkup = await control.first().evaluate(element => element.outerHTML);
      throw new Error(
        testId + ' must expose exactly one current public input; found ' + inputCount
        + ' in ' + controlMarkup,
      );
    }
    assert.equal(await input.isEnabled(), true, testId + ' must expose an enabled public input');
    if (kind !== 'range' || !testId.startsWith('path-loss-term-')) {
      assert.equal(await control.getAttribute('data-control-active'), 'true', testId + ' must be marked as a public editable control');
    }
    const beforeInput = await input.inputValue();
    const beforeFrame = await assertSharedWalkerSnapshot(page);

    if (kind === 'range') {
      const numericBefore = Number(beforeInput);
      const min = Number(await input.getAttribute('min'));
      const max = Number(await input.getAttribute('max'));
      const rawTarget = numericBefore + probe.delta <= max
        ? numericBefore + probe.delta
        : numericBefore - probe.delta;
      const target = Number(rawTarget.toFixed(6));
      assert.ok(target >= min && target <= max && target !== numericBefore, testId + ' has no safe adjacent probe value');
      await input.fill(String(target));
      await page.waitForFunction(
        ({ controlTestId, expectedValue }) => {
          const inputElement = document.querySelector<HTMLInputElement>(
            '[data-testid="' + controlTestId + '"] input[type="range"]',
          );
          return inputElement?.value === expectedValue;
        },
        { controlTestId: testId, expectedValue: String(target) },
        { timeout: 5_000 },
      );
    } else {
      const options = await input.locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value));
      const target = options.find(value => value !== beforeInput);
      assert.ok(target, testId + ' has no alternate public option');
      await input.selectOption(target);
      assert.equal(await input.inputValue(), target, testId + ' did not accept the public DOM edit');
    }

    try {
      await waitForCurrentMetricChange(
        page,
        changedField === 'sinr' ? beforeFrame.centerSinrDb : beforeFrame.centerThroughputBps,
        changedField,
      );
    } catch (error) {
      const diagnostic = await page.evaluate(({ controlTestId }) => {
        const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-bar"]');
        const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
        const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
        const inputElement = document.querySelector<HTMLInputElement>(
          '[data-testid="' + controlTestId + '"] input[type="range"]',
        );
        return {
          inputValue: inputElement?.value ?? null,
          timeline: timeline === null ? null : { ...timeline.dataset },
          rail: rail === null ? null : { ...rail.dataset },
          center: center === null ? null : { ...center.dataset },
        };
      }, { controlTestId: testId });
      throw new Error(
        testId + ' did not publish a changed shared ' + changedField + ' frame: '
        + JSON.stringify(diagnostic) + ' (' + (error instanceof Error ? error.message : String(error)) + ')',
      );
    }

    const afterFrame = await assertSharedWalkerSnapshot(page);
    const beforeValue = changedField === 'sinr' ? beforeFrame.centerSinrDb : beforeFrame.centerThroughputBps;
    const afterValue = changedField === 'sinr' ? afterFrame.centerSinrDb : afterFrame.centerThroughputBps;
    assert.notEqual(afterValue, beforeValue, testId + ' did not change the accepted-frame ' + changedField);

    const reset = page.locator('[data-testid="sinr-tuning-reset"]');
    await reset.click();
    await page.waitForFunction(
      ({ controlTestId, controlKind, expectedInput }) => {
        const root = document.querySelector<HTMLElement>('[data-testid="' + controlTestId + '"]');
        const inputElement = root?.querySelector<HTMLInputElement | HTMLSelectElement>(
          controlKind === 'range' ? 'input[type="range"]' : 'select',
        );
        return inputElement?.value === expectedInput;
      },
      { controlTestId: testId, controlKind: kind, expectedInput: beforeInput },
      { timeout: 5_000 },
    );
    await waitForCurrentMetricChange(page, afterValue, changedField);
    const resetFrame = await assertSharedWalkerSnapshot(page);
    assert.equal(
      changedField === 'sinr' ? resetFrame.centerSinrDb : resetFrame.centerThroughputBps,
      beforeValue,
      testId + ' reset must restore the original accepted-frame value',
    );
  }

  await page.locator('#sinr-formula-tab-channel').click();
  for (const testId of [
    'path-loss-term-fspl',
    'path-loss-term-atmospheric',
    'path-loss-term-scintillation',
    'path-loss-term-shadow-fading',
  ] as const) {
    const root = page.locator('[data-testid="' + testId + '"]');
    const toggle = root.locator('[data-testid="' + testId + '-switch"]');
    const range = root.locator('input[type="range"]');
    assert.equal(await toggle.getAttribute('aria-checked'), 'true', testId + ' must start enabled');
    assert.equal(await range.isEnabled(), true, testId + ' scalar must start enabled');
    const before = await assertSharedWalkerSnapshot(page);
    await toggle.click();
    await page.waitForFunction(
      switchTestId => {
        const switchElement = document.querySelector<HTMLElement>('[data-testid="' + switchTestId + '-switch"]');
        const rangeElement = document.querySelector<HTMLInputElement>('[data-testid="' + switchTestId + '"] input[type="range"]');
        return switchElement?.getAttribute('aria-checked') === 'false' && rangeElement?.disabled === true;
      },
      testId,
      { timeout: 5_000 },
    );
    await waitForCurrentMetricChange(page, before.centerSinrDb, 'sinr');
    const switched = await assertSharedWalkerSnapshot(page);
    await page.locator('[data-testid="sinr-tuning-reset"]').click();
    await page.waitForFunction(
      switchTestId => {
        const switchElement = document.querySelector<HTMLElement>('[data-testid="' + switchTestId + '-switch"]');
        const rangeElement = document.querySelector<HTMLInputElement>('[data-testid="' + switchTestId + '"] input[type="range"]');
        return switchElement?.getAttribute('aria-checked') === 'true' && rangeElement?.disabled === false;
      },
      testId,
      { timeout: 5_000 },
    );
    await waitForCurrentMetricChange(page, switched.centerSinrDb, 'sinr');
    await assertSharedWalkerSnapshot(page);
  }

  assert.equal(
    await page.locator('[data-testid="timeline-bar"]').getAttribute('data-paused'),
    'true',
    'parameter edits must not silently resume a paused timeline',
  );
}

interface ScenarioFrameWaitOptions {
  readonly expectedEpoch: number;
  readonly previousSinr?: string;
  readonly previousSatellite?: string;
  readonly allowNoLink?: boolean;
}

async function waitForWalkerScenarioFrame(page: Page, options: ScenarioFrameWaitOptions): Promise<void> {
  await page.waitForFunction(
    ({ expectedEpoch, previousSinr, previousSatellite, allowNoLink }) => {
      const appShell = document.querySelector<HTMLElement>('.leo-app-shell');
      if (appShell?.dataset.walkerEpochUtcMs !== String(expectedEpoch)) return false;
      const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
      const host = document.querySelector<HTMLElement>('[data-homepage-rail-snapshot-id]');
      const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      const servingRow = rail?.querySelector<HTMLElement>(
        '[aria-labelledby="homepage-serving-beam-title"] [data-testid="homepage-beam-row"]',
      ) ?? null;
      const accepted = rail !== null
        && host !== null
        && scene !== null
        && center !== null
        && servingRow !== null
        && rail.dataset.snapshotId !== ''
        && rail.dataset.sourceFrameId !== ''
        && rail.dataset.phase !== ''
        && host.dataset.homepageRailSnapshotId === rail.dataset.snapshotId
        && host.dataset.homepageRailSourceFrameId === rail.dataset.sourceFrameId
        && host.dataset.homepageRailPhase === rail.dataset.phase
        && scene.dataset.acceptedHandoverSnapshotId === rail.dataset.snapshotId
        && scene.dataset.acceptedHandoverSourceFrameId === rail.dataset.sourceFrameId
        && scene.dataset.acceptedHandoverPhase === rail.dataset.phase
        && servingRow.dataset.snapshotId === rail.dataset.snapshotId
        && servingRow.dataset.sourceFrameId === rail.dataset.sourceFrameId
        && center.dataset.angleAwareFrameSinrDb !== ''
        && center.dataset.angleAwareFrameTimeSec !== ''
        && (previousSinr === undefined
          || center.dataset.angleAwareFrameSinrDb !== previousSinr
          || servingRow.dataset.satelliteId !== previousSatellite);
      if (accepted) return true;
      const waiting = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail-waiting"]');
      return allowNoLink === true
        && center === null
        && waiting?.dataset.homepageRailSnapshotId === ''
        && waiting?.dataset.homepageRailSourceFrameId === ''
        && waiting?.dataset.homepageRailPhase === '';
    },
    options,
    { timeout: 60_000 },
  );
}

async function exercisePublicWalkerScenarioControls(page: Page): Promise<void> {
  await page.locator('#signal-tuning-main-tab-scenario').click();
  const shell = page.locator('.leo-app-shell');
  const beforeFrame = await assertSharedWalkerSnapshot(page);
  const initialEpoch = Number(await shell.getAttribute('data-walker-epoch-utc-ms'));
  const initialSatelliteCount = Number(await shell.getAttribute('data-walker-satellite-count'));
  const initialPresentationAltitude = Number(await shell.getAttribute('data-walker-cell-presentation-altitude-km'));
  assert.ok(Number.isFinite(initialEpoch), 'Walker epoch must be finite');
  assert.equal(await shell.getAttribute('data-walker-source-kind'), 'synthetic-walker');
  assert.equal(await shell.getAttribute('data-walker-constellation'), 'starlink');

  const hourOptions = await page.locator('[data-testid="scenario-data-hour"] option').evaluateAll(
    options => options.map(option => (option as HTMLOptionElement).value),
  );
  assert.deepEqual(
    hourOptions,
    Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')),
    'homepage time control must expose the complete 24-hour clock',
  );
  assert.doesNotMatch(
    await page.locator('[data-testid="scenario-data-time-controls"]').innerText(),
    /(?:AM|PM|上午|下午)/i,
    'homepage time control must not expose an AM/PM selector',
  );

  const minute = page.locator('[data-testid="scenario-data-minute"]');
  await minute.selectOption('01');
  await waitForWalkerScenarioFrame(page, {
    expectedEpoch: initialEpoch + 60_000,
    previousSinr: beforeFrame.centerSinrDb,
    previousSatellite: beforeFrame.servingSat,
  });
  assert.equal(
    await shell.getAttribute('data-walker-scenario-local'),
    DEFAULT_WALKER_SCENARIO_DATE + 'T' + DEFAULT_WALKER_HOUR + ':01',
  );
  await minute.selectOption('00');
  await waitForWalkerScenarioFrame(page, { expectedEpoch: initialEpoch });
  await assertSharedWalkerSnapshot(page);

  const hour = page.locator('[data-testid="scenario-data-hour"]');
  await hour.selectOption('21');
  await waitForWalkerScenarioFrame(page, {
    expectedEpoch: initialEpoch + 60 * 60_000,
    previousSinr: beforeFrame.centerSinrDb,
    previousSatellite: beforeFrame.servingSat,
  });
  assert.equal(
    await shell.getAttribute('data-walker-scenario-local'),
    DEFAULT_WALKER_SCENARIO_DATE + 'T21:00',
  );
  await hour.selectOption(DEFAULT_WALKER_HOUR);
  await waitForWalkerScenarioFrame(page, { expectedEpoch: initialEpoch });
  await assertSharedWalkerSnapshot(page);

  const nextDate = '2026-08-26';
  const nextEpoch = initialEpoch + 24 * 60 * 60_000;
  await page.locator('[data-testid="scenario-data-date"]').fill(nextDate);
  try {
    await waitForWalkerScenarioFrame(page, { expectedEpoch: nextEpoch, allowNoLink: true });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const appShell = document.querySelector<HTMLElement>('.leo-app-shell');
      const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
      const waiting = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail-waiting"]');
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      return {
        shell: appShell === null ? null : { ...appShell.dataset },
        rail: rail === null ? null : { ...rail.dataset },
        waiting: waiting === null ? null : { ...waiting.dataset },
        center: center === null ? null : { ...center.dataset },
      };
    });
    throw new Error(
      'Walker date edit did not publish an accepted frame or an honest current no-link state: '
      + JSON.stringify(diagnostic) + ' (' + (error instanceof Error ? error.message : String(error)) + ')',
    );
  }
  assert.notEqual(Number(await shell.getAttribute('data-walker-epoch-utc-ms')), initialEpoch);
  assert.equal(
    await shell.getAttribute('data-walker-scenario-local'),
    nextDate + 'T' + DEFAULT_WALKER_HOUR + ':' + DEFAULT_WALKER_MINUTE,
  );

  // Return to the known service-bearing default before the OneWeb comparison.
  // A no-link result is valid Walker truth; it must not carry stale numbers or
  // fall back to the archived-TLE source.
  await page.locator('[data-testid="scenario-data-date"]').fill(DEFAULT_WALKER_SCENARIO_DATE);
  try {
    await waitForWalkerScenarioFrame(page, { expectedEpoch: initialEpoch });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const appShell = document.querySelector<HTMLElement>('.leo-app-shell');
      const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
      const waiting = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail-waiting"]');
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      return {
        shell: appShell === null ? null : { ...appShell.dataset },
        rail: rail === null ? null : { ...rail.dataset },
        waiting: waiting === null ? null : { ...waiting.dataset },
        center: center === null ? null : { ...center.dataset },
      };
    });
    throw new Error(
      'Walker default date did not restore a current shared frame: '
      + JSON.stringify(diagnostic) + ' (' + (error instanceof Error ? error.message : String(error)) + ')',
    );
  }
  await assertSharedWalkerSnapshot(page);

  const canvas = page.locator(SCENE_CANVAS_SELECTOR);
  const sevenBeamFrame = await assertSharedWalkerSnapshot(page);
  await page.locator('#scenario-data-serving-beam-layout-19').check();
  await page.waitForFunction(() => (
    document.querySelector<HTMLCanvasElement>('[data-testid="leo-main-scene"] canvas')?.dataset.beamBudgetServing === '19'
  ), undefined, { timeout: 60_000 });
  await page.waitForFunction(
    ({ previousSinr, previousPower }) => {
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      return center !== null
        && center.dataset.angleAwareFrameSinrDb !== ''
        && center.dataset.angleAwareFrameSystemPowerW !== ''
        && (
          center.dataset.angleAwareFrameSinrDb !== previousSinr
          || center.dataset.angleAwareFrameSystemPowerW !== previousPower
        );
    },
    { previousSinr: sevenBeamFrame.centerSinrDb, previousPower: sevenBeamFrame.centerSystemPowerW },
    { timeout: 60_000 },
  );
  await assertSharedWalkerSnapshot(page);
  await page.locator('#scenario-data-serving-beam-layout-7').check();
  await page.waitForFunction(
    () => document.querySelector<HTMLCanvasElement>('[data-testid="leo-main-scene"] canvas')?.dataset.beamBudgetServing === '7',
    undefined,
    { timeout: 60_000 },
  );
  await assertSharedWalkerSnapshot(page);

  // Candidate beam count is a real candidate-fan budget, not a selected-link
  // scalar. Assert scene telemetry while retaining the shared formula frame.
  await page.locator('#scenario-data-candidate-beam-layout-19').check();
  await page.waitForFunction(
    () => {
      const scene = document.querySelector<HTMLCanvasElement>('[data-testid="leo-main-scene"] canvas');
      return scene?.dataset.beamBudgetServing === '7' && scene.dataset.beamBudgetCandidate === '19';
    },
    undefined,
    { timeout: 30_000 },
  );
  await assertSharedWalkerSnapshot(page);
  // The "candidate follows serving" control was retired when the candidate beam count
  // became a real candidate-fan budget rather than a selected-link scalar, and
  // src/ui/SignalTuningPanel.formula.test.tsx:142 now asserts the testid must NOT be
  // rendered. Driving it here was a stale test artifact, not a product regression --
  // restoring the control would break that negative contract. Nothing else is lost:
  // beamBudgetServing === '7' is already asserted by the waitForFunction above, and
  // the shared-snapshot check still runs immediately below.

  const defaultFocusFrame = await assertSharedWalkerSnapshot(page);
  await page.locator('label[for="scenario-data-focus-cell-1"]').click();
  await page.waitForFunction(
    ({ previousBeam, previousSatellite, previousSinr }) => {
      const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      const servingRow = rail?.querySelector<HTMLElement>(
        '[aria-labelledby="homepage-serving-beam-title"] [data-testid="homepage-beam-row"]',
      ) ?? null;
      return rail !== null
        && center !== null
        && servingRow !== null
        && rail.dataset.snapshotId !== ''
        && rail.dataset.sourceFrameId !== ''
        && center.dataset.angleAwareFrameSinrDb !== ''
        && (
          servingRow.dataset.beamId !== previousBeam
          || servingRow.dataset.satelliteId !== previousSatellite
          || center.dataset.angleAwareFrameSinrDb !== previousSinr
        );
    },
    {
      previousBeam: defaultFocusFrame.servingBeam,
      previousSatellite: defaultFocusFrame.servingSat,
      previousSinr: defaultFocusFrame.centerSinrDb,
    },
    { timeout: 30_000 },
  );
  const focusedFrame = await assertSharedWalkerSnapshot(page);
  await page.locator('label[for="scenario-data-focus-cell-default"]').click();
  await page.waitForFunction(
    ({ expectedBeam, expectedSatellite, expectedSinr, focusedBeam, focusedSatellite, focusedSinr }) => {
      const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      const servingRow = rail?.querySelector<HTMLElement>(
        '[aria-labelledby="homepage-serving-beam-title"] [data-testid="homepage-beam-row"]',
      ) ?? null;
      return rail !== null
        && center !== null
        && servingRow !== null
        && servingRow.dataset.beamId === expectedBeam
        && servingRow.dataset.satelliteId === expectedSatellite
        && center.dataset.angleAwareFrameSinrDb === expectedSinr
        && (
          servingRow.dataset.beamId !== focusedBeam
          || servingRow.dataset.satelliteId !== focusedSatellite
          || center.dataset.angleAwareFrameSinrDb !== focusedSinr
        );
    },
    {
      expectedBeam: defaultFocusFrame.servingBeam,
      expectedSatellite: defaultFocusFrame.servingSat,
      expectedSinr: defaultFocusFrame.centerSinrDb,
      focusedBeam: focusedFrame.servingBeam,
      focusedSatellite: focusedFrame.servingSat,
      focusedSinr: focusedFrame.centerSinrDb,
    },
    { timeout: 30_000 },
  );
  await assertSharedWalkerSnapshot(page);

  await page.locator('#scenario-data-constellation-oneweb').check();
  try {
    await page.waitForFunction(
      ({ starlinkSatelliteCount }) => {
        const appShell = document.querySelector<HTMLElement>('.leo-app-shell');
        const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
        const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
        const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
        return appShell?.dataset.activeSimulationSource === 'walker'
          && appShell.dataset.walkerSourceKind === 'synthetic-walker'
          && appShell.dataset.walkerConstellation === 'oneweb'
          && Number(appShell.dataset.walkerSatelliteCount) < starlinkSatelliteCount
          && Number(appShell.dataset.walkerPrimaryShellAltitudeKm) > 550
          && rail !== null
          && scene !== null
          && center !== null
          && rail.dataset.snapshotId !== ''
          && rail.dataset.sourceFrameId !== ''
          && scene.dataset.acceptedHandoverSnapshotId === rail.dataset.snapshotId
          && scene.dataset.acceptedHandoverSourceFrameId === rail.dataset.sourceFrameId
          && scene.dataset.acceptedHandoverPhase === rail.dataset.phase
          && center.dataset.angleAwareFrameSinrDb !== '';
      },
      { starlinkSatelliteCount: initialSatelliteCount },
      { timeout: 60_000 },
    );
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const appShell = document.querySelector<HTMLElement>('.leo-app-shell');
      const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
      const waiting = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail-waiting"]');
      const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
      return {
        shell: appShell === null ? null : { ...appShell.dataset },
        rail: rail === null ? null : { ...rail.dataset },
        waiting: waiting === null ? null : { ...waiting.dataset },
        center: center === null ? null : { ...center.dataset },
      };
    });
    throw new Error(
      'OneWeb Walker edit did not publish a current homepage frame: '
      + JSON.stringify(diagnostic) + ' (' + (error instanceof Error ? error.message : String(error)) + ')',
    );
  }
  assert.equal(
    Number(await shell.getAttribute('data-walker-cell-presentation-altitude-km')),
    initialPresentationAltitude,
    'OneWeb must retain the established Walker ground-cell presentation scale',
  );
  assert.equal(await page.locator('[data-testid="simulation-source-toggle"]').count(), 0);
  await assertSharedWalkerSnapshot(page);
}

export async function assertHomepageAuthority(
  page: Page,
  archivedTleRequests: readonly string[] = [],
  errors: readonly string[] = [],
): Promise<void> {
    await assertWalkerHomepage(page);
    assert.deepEqual(
      archivedTleRequests,
      [],
      'Walker-only homepage must not start archived-TLE catalog, snapshot, or run-artifact requests',
    );
    await assertSharedWalkerSnapshot(page);
    await exercisePublicSinrControls(page);
    await exercisePublicWalkerScenarioControls(page);
    assert.deepEqual(errors, [], 'homepage browser console errors: ' + JSON.stringify(errors));
    console.log('[homepage-authority-browser] PASS');
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    // WSL/restricted CI containers can trap Chrome while it tries to allocate
    // the shared-memory mount. The same flags keep this gate an environment
    // diagnostic rather than a false application failure.
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-crashpad', '--disable-breakpad'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  const archivedTleRequests: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.startsWith('/tle-archive/')
      || pathname.startsWith('/homepage-first-frame/')
      || pathname.startsWith('/visual-lab-default-full-run/')
    ) archivedTleRequests.push(pathname);
  });
  try {
    await assertHomepageAuthority(page, archivedTleRequests, errors);
  } catch (error) {
    if (errors.length > 0) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message + '; browser console/page errors: ' + JSON.stringify(errors));
    }
    throw error;
  } finally {
    await page.close();
    await browser.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(error => {
    console.error(
      '[homepage-authority-browser] FAILED:',
      error instanceof Error ? error.stack ?? error.message : error,
    );
    process.exitCode = 1;
  });
}
