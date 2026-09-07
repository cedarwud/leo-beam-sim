/**
 * Browser acceptance harness for the additive multi-candidate homepage lane.
 *
 * This is deliberately evidence-oriented: it drives the same public Next Intra
 * / Next Inter actions a reviewer uses, samples the running scene and the
 * homepage beam rail from one accepted snapshot, and records the telemetry /
 * screenshots needed for the SDD visual-recovery gate. It does not use a
 * hidden probe, a second server, or a display-only handover trigger.
 *
 * Requires the already-running homepage on port 3000 (APP_URL may override).
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const OUTPUT_DIR = resolve('output/playwright/homepage-multi-candidate-acceptance');
const READY_TIMEOUT_MS = 120_000;
const SAMPLE_INTERVAL_MS = 100;
// Director focus intentionally slows the live Walker to 0.25x. A source
// event's two-second lead-in is therefore not expected to commit within a
// one-minute wall-clock probe; keep the default long enough to observe the
// actual switching/guard boundary, while allowing a shorter diagnostic run
// when only the comparison stage is under inspection.
const MAX_FLOW_MS = Number(process.env.MAX_FLOW_MS ?? 180_000);

const SCENE_SELECTOR = '[data-testid="leo-main-scene"]';
const SCENE_CANVAS_SELECTOR = `${SCENE_SELECTOR} canvas`;

const VIEWPORTS = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1366, height: 768, name: '1366x768' },
] as const;

/**
 * Scene render statuses that are an honest declared reason for not painting the
 * candidate comparison before the first accepted snapshot is joined.
 *
 * The harness attaches to an already-running homepage, so the live decision can
 * legitimately be mid-`switching`, and the accepted snapshot can legitimately
 * lag the current source frame during warm-start (`source-frame-mismatch`).
 * Both are declared states, not silent failures.
 *
 * `missing-scene-plan` and `unmapped-pairs` stay failures on purpose: they mean
 * geometry the scene claimed it would paint could not be resolved, which is the
 * exact defect this gate exists to catch. Do not widen this set to admit them.
 */
const HONEST_PRE_SNAPSHOT_RENDER_STATUSES: ReadonlySet<string> = new Set([
  'no-accepted-snapshot',
  'inactive',
  'phase-not-comparison',
  'below-comparison-threshold',
  'switching',
  'source-frame-mismatch',
]);

interface CandidateTelemetry {
  readonly pairKey: string | null;
  readonly satelliteId: string | null;
  readonly satelliteName: string | null;
  readonly beamId: string | null;
  readonly role: string | null;
  readonly snapshotId: string | null;
  readonly sourceFrameId: string | null;
  readonly sceneJoinKey: string | null;
  readonly railJoinKey: string | null;
}

interface TimelineMarkerTelemetry {
  readonly markerId: string | null;
  readonly kind: string | null;
  readonly legacyKind: string | null;
  readonly sourceTimeSec: string | null;
  readonly clickTargetSec: string | null;
  readonly disabled: boolean;
  readonly ariaLabel: string | null;
  readonly title: string | null;
}

interface RailVisualTelemetry {
  readonly backgroundColor: string;
  readonly overflowX: string;
  readonly overflowY: string;
}

interface SampleTelemetry {
  readonly wallTimeMs: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly app: Readonly<Record<string, string | undefined>> | null;
  readonly timeline: Readonly<Record<string, string | undefined>> | null;
  readonly timelineMarkers: readonly TimelineMarkerTelemetry[];
  readonly selectedSpeed: string | null;
  readonly scene: Readonly<Record<string, string | undefined>> | null;
  readonly canvas: Readonly<Record<string, string | undefined>> | null;
  readonly rail: Readonly<Record<string, string | undefined>> | null;
  readonly railHost: Readonly<Record<string, string | undefined>> | null;
  readonly railActiveDataLinkCount: string | null;
  readonly railText: string;
  readonly railMetricTexts: readonly string[];
  readonly railVisual: RailVisualTelemetry | null;
  readonly hoSlow: Readonly<Record<string, string | undefined>> | null;
  readonly candidateRows: readonly CandidateTelemetry[];
  readonly sceneJoinKeys: readonly string[];
  readonly presentationActive: boolean;
  readonly layout: {
    readonly canvas: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
    readonly rightRail: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
    readonly obstructionOverlaps: readonly string[];
  };
}

interface FlowEvidence {
  readonly kind: 'intra' | 'inter';
  readonly clickTargetSec: number | null;
  readonly samples: readonly SampleTelemetry[];
  readonly phases: readonly string[];
  readonly sceneSnapshotIds: readonly string[];
  readonly railSnapshotIds: readonly string[];
  readonly screenshots: readonly string[];
}

async function collectTelemetry(page: Page): Promise<SampleTelemetry> {
  return page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('.leo-app-shell');
    const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-bar"]');
    const selectedSpeedButton = document.querySelector<HTMLElement>(
      '[data-testid^="timeline-speed-"][aria-pressed="true"]',
    );
    const timelineMarkers = timeline === null
      ? []
      : [...timeline.querySelectorAll<HTMLButtonElement>('[data-testid^="timeline-event-marker-"]')]
        .map(marker => ({
          markerId: marker.dataset.markerId ?? null,
          kind: marker.dataset.markerKind ?? null,
          legacyKind: marker.dataset.kind ?? null,
          sourceTimeSec: marker.dataset.sourceTimeSec ?? null,
          clickTargetSec: marker.dataset.clickTargetSec ?? null,
          disabled: marker.disabled,
          ariaLabel: marker.getAttribute('aria-label'),
          title: marker.getAttribute('title'),
        }));
    const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="leo-main-scene"] canvas');
    const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
    const railHost = document.querySelector<HTMLElement>('[data-homepage-rail-snapshot-id]');
    const railActiveDataLinkCount = rail?.querySelector<HTMLElement>('[data-active-data-link-count]')?.dataset.activeDataLinkCount ?? null;
    const hoSlow = document.querySelector<HTMLElement>('[data-testid="ho-slow-status"]');
    const candidateRows = rail === null
      ? []
      : [...rail.querySelectorAll<HTMLElement>('[data-testid="homepage-beam-row"]')]
        .filter(row => row.dataset.role !== 'serving' && row.dataset.role !== 'committed-serving')
        .map(row => ({
          pairKey: row.dataset.pairKey ?? null,
          satelliteId: row.dataset.satelliteId ?? row.dataset.satId ?? null,
          satelliteName: row.dataset.satelliteName ?? null,
          beamId: row.dataset.beamId ?? null,
          role: row.dataset.role ?? null,
          snapshotId: row.dataset.snapshotId ?? null,
          sourceFrameId: row.dataset.sourceFrameId ?? null,
          sceneJoinKey: row.dataset.sceneJoinKey ?? row.dataset.joinKey ?? null,
          railJoinKey: row.dataset.railJoinKey ?? row.dataset.joinKey ?? null,
        }));
    const sceneJoinKeys = (() => {
      const raw = canvas?.dataset.multiCandidateSceneRenderedSceneJoinKeys;
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.every(value => typeof value === 'string') ? parsed : [];
      } catch {
        return [];
      }
    })();
    const canvasRect = canvas?.getBoundingClientRect();
    const railRect = document.querySelector<HTMLElement>('.leo-shell-right')?.getBoundingClientRect();
    const centralSafeBox = canvasRect === undefined
      ? null
      : {
        x: canvasRect.x + canvasRect.width * 0.2,
        y: canvasRect.y + canvasRect.height * 0.18,
        width: canvasRect.width * 0.6,
        height: canvasRect.height * 0.64,
      };
    // Candidate identity badges are intentional scene annotations and may sit
    // near a beam/footprint. The obstruction gate is for large explanatory
    // chrome (toast/subtitle) that can hide the subject, not those labels.
    const obstructionOverlaps = centralSafeBox === null
      ? []
      : [...document.querySelectorAll<HTMLElement>(
        '.leo-handover-toast, '
          + '.leo-six-acts-subtitle-overlay, '
          + '.leo-six-acts-teaching-overlay',
      )].filter(element => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.01;
      }).filter(element => {
        const box = element.getBoundingClientRect();
        const candidateBox = { x: box.x, y: box.y, width: box.width, height: box.height };
        return Math.max(0, Math.min(centralSafeBox.x + centralSafeBox.width, candidateBox.x + candidateBox.width) - Math.max(centralSafeBox.x, candidateBox.x)) > 3
          && Math.max(0, Math.min(centralSafeBox.y + centralSafeBox.height, candidateBox.y + candidateBox.height) - Math.max(centralSafeBox.y, candidateBox.y)) > 3;
      }).map(element => element.dataset.testid ?? element.className);
    const railStyle = rail === null ? null : getComputedStyle(rail);
    return {
      wallTimeMs: Date.now(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      app: app instanceof HTMLElement ? { ...app.dataset } : null,
      timeline: timeline instanceof HTMLElement ? { ...timeline.dataset } : null,
      timelineMarkers,
      selectedSpeed: selectedSpeedButton?.dataset.testid?.replace(/^timeline-speed-/, '').replace(/x$/, '') ?? null,
      scene: scene instanceof HTMLElement ? { ...scene.dataset } : null,
      canvas: canvas instanceof HTMLElement ? { ...canvas.dataset } : null,
      rail: rail instanceof HTMLElement ? { ...rail.dataset } : null,
      railHost: railHost instanceof HTMLElement ? { ...railHost.dataset } : null,
      railActiveDataLinkCount,
      railText: rail?.innerText ?? '',
      railMetricTexts: rail === null
        ? []
        : [...rail.querySelectorAll<HTMLElement>('[data-testid^="homepage-beam-metric-"]')]
          .map(element => element.textContent?.trim() ?? '')
          .filter(Boolean),
      railVisual: railStyle === null
        ? null
        : {
          backgroundColor: railStyle.backgroundColor,
          overflowX: railStyle.overflowX,
          overflowY: railStyle.overflowY,
        },
      hoSlow: hoSlow instanceof HTMLElement ? { ...hoSlow.dataset } : null,
      candidateRows,
      sceneJoinKeys,
      presentationActive: canvas?.dataset.handoverPresentationActive === '1',
      layout: {
        canvas: canvasRect === undefined ? null : { x: canvasRect.x, y: canvasRect.y, width: canvasRect.width, height: canvasRect.height },
        rightRail: railRect === undefined ? null : { x: railRect.x, y: railRect.y, width: railRect.width, height: railRect.height },
        obstructionOverlaps,
      },
    } satisfies SampleTelemetry;
  });
}

async function waitForHomepageReady(page: Page): Promise<void> {
  await page.waitForSelector(SCENE_CANVAS_SELECTOR, { state: 'attached', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => {
    const rail = document.querySelector<HTMLElement>('[data-testid="homepage-beam-rail"]');
    const host = document.querySelector<HTMLElement>('[data-homepage-rail-snapshot-id]');
    const scene = document.querySelector<HTMLElement>('[data-testid="leo-main-scene"]');
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="leo-main-scene"] canvas');
    return rail !== null
      && host !== null
      && scene !== null
      && canvas !== null
      && rail.dataset.snapshotId !== ''
      && rail.dataset.sourceFrameId !== ''
      && rail.dataset.phase !== ''
      && host.dataset.homepageRailSnapshotId === rail.dataset.snapshotId
      && host.dataset.homepageRailSourceFrameId === rail.dataset.sourceFrameId
      && host.dataset.homepageRailPhase === rail.dataset.phase
      && scene.dataset.acceptedHandoverSnapshotId === rail.dataset.snapshotId
      && scene.dataset.acceptedHandoverSourceFrameId === rail.dataset.sourceFrameId
      && scene.dataset.acceptedHandoverPhase === rail.dataset.phase
      && (canvas.dataset.multiCandidateSceneRenderStatus !== 'active'
        || (canvas.dataset.multiCandidateSceneAcceptedSnapshotId === rail.dataset.snapshotId
          && canvas.dataset.multiCandidateSceneAcceptedSourceFrameId === rail.dataset.sourceFrameId));
  }, undefined, { timeout: READY_TIMEOUT_MS });
  const toggle = page.locator('[data-testid="homepage-beam-rail-toggle-groups"]');
  if (await toggle.count() > 0 && await toggle.getAttribute('aria-expanded') === 'false') {
    await toggle.click();
  }
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="director-intra-focus"]');
    const otherButton = document.querySelector<HTMLButtonElement>('[data-testid="director-inter-focus"]');
    const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-bar"]');
    const markerKinds = new Set(
      [...(timeline?.querySelectorAll<HTMLElement>('[data-testid^="timeline-event-marker-"]') ?? [])]
        .map(marker => marker.dataset.markerKind),
    );
    return button !== null && otherButton !== null
      && !document.querySelector('[data-testid="handover-index-building"]')
      && markerKinds.has('intra')
      && markerKinds.has('inter')
      && (button.disabled === false || otherButton.disabled === false);
  }, undefined, { timeout: READY_TIMEOUT_MS });
}

function assertWalkerSource(sample: SampleTelemetry): void {
  assert.equal(sample.app?.activeSimulationSource, 'walker', 'homepage must use the Walker source');
  assert.equal(sample.app?.simulationSource, 'walker', 'homepage source mode must remain Walker');
  assert.equal(sample.app?.walkerConstellation, 'starlink', 'homepage default constellation must be Starlink');
  assert.equal(sample.app?.timelineSourceOwner, 'live-walker', 'timeline must be owned by live Walker');
  assert.equal(sample.app?.timelineDisabled, 'false', 'timeline must be enabled at acceptance');
  const selectedSpeed = Number(sample.selectedSpeed);
  const effectiveSpeed = Number(sample.app?.effectiveSpeed);
  assert.ok(Number.isFinite(selectedSpeed) && selectedSpeed > 0, 'homepage must expose a selected timeline speed');
  assert.ok(Number.isFinite(effectiveSpeed) && effectiveSpeed > 0, 'homepage must expose a finite effective speed');
}

function assertNaturalTimelineMarkers(sample: SampleTelemetry, label: string): void {
  assert.equal(sample.timeline?.sourceOwner, 'live-walker', `${label}: timeline must be owned by live Walker`);
  assert.equal(sample.timeline?.horizonKind, 'live-walker-window', `${label}: timeline must expose the live Walker horizon`);
  assert.equal(sample.timeline?.claimKind, 'live-truth', `${label}: timeline must retain the live-truth claim`);
  const durationSec = Number(sample.timeline?.durationSec);
  assert.ok(Number.isFinite(durationSec) && durationSec > 0, `${label}: timeline duration must be finite and positive`);
  assert.equal(sample.timelineMarkers.length, 2, `${label}: homepage must expose one natural marker per handover kind`);
  assert.deepEqual(
    sample.timelineMarkers.map(marker => marker.kind).sort(),
    ['inter', 'intra'],
    `${label}: timeline markers must cover natural intra and inter events`,
  );
  for (const marker of sample.timelineMarkers) {
    assert.ok(marker.markerId?.startsWith(`teaching-${marker.kind}-`), `${label}: ${marker.kind} marker must retain its source-backed id`);
    assert.equal(marker.legacyKind, marker.kind, `${label}: ${marker.kind} marker kind attributes must agree`);
    assert.equal(marker.disabled, false, `${label}: ${marker.kind} natural marker must remain actionable`);
    const sourceTimeSec = Number(marker.sourceTimeSec);
    const clickTargetSec = Number(marker.clickTargetSec);
    assert.ok(Number.isFinite(sourceTimeSec), `${label}: ${marker.kind} marker source time must be finite`);
    assert.ok(Number.isFinite(clickTargetSec), `${label}: ${marker.kind} marker click target must be finite`);
    assert.ok(sourceTimeSec >= 0 && sourceTimeSec <= durationSec, `${label}: ${marker.kind} source time must be on the timeline`);
    assert.ok(clickTargetSec >= 0 && clickTargetSec <= durationSec, `${label}: ${marker.kind} click target must be on the timeline`);
    assert.match(marker.ariaLabel ?? '', new RegExp(`^Seek to ${marker.kind?.toUpperCase()} handover`));
    assert.match(marker.title ?? '', /source [0-9.]+ seconds/);
  }
}

function phaseOf(sample: SampleTelemetry): string {
  return sample.rail?.phase
    ?? sample.scene?.acceptedHandoverPhase
    ?? sample.canvas?.multiCandidateDecisionPhase
    ?? '';
}

function hasSameAcceptedSnapshot(sample: SampleTelemetry): boolean {
  const rail = sample.rail;
  const railHost = sample.railHost;
  const scene = sample.scene;
  const canvas = sample.canvas;
  return rail?.snapshotId !== undefined
    && rail.snapshotId !== ''
    && rail.sourceFrameId !== undefined
    && rail.sourceFrameId !== ''
    && rail.phase !== undefined
    && rail.phase !== ''
    && railHost?.homepageRailSnapshotId === rail.snapshotId
    && railHost.homepageRailSourceFrameId === rail.sourceFrameId
    && railHost.homepageRailPhase === rail.phase
    && scene?.acceptedHandoverSnapshotId === rail.snapshotId
    && scene.acceptedHandoverSourceFrameId === rail.sourceFrameId
    && scene.acceptedHandoverPhase === rail.phase
    && (sample.canvas?.multiCandidateSceneRenderStatus !== 'active'
      || (canvas?.multiCandidateSceneAcceptedSnapshotId === rail.snapshotId
        && canvas.multiCandidateSceneAcceptedSourceFrameId === rail.sourceFrameId));
}

async function collectAlignedTelemetry(page: Page, label: string): Promise<SampleTelemetry> {
  const deadline = Date.now() + 10_000;
  let latest: SampleTelemetry | null = null;
  while (Date.now() < deadline) {
    latest = await collectTelemetry(page);
    if (hasSameAcceptedSnapshot(latest)) return latest;
    await page.waitForTimeout(100);
  }
  assert.ok(latest !== null, `${label}: no homepage telemetry sample was collected`);
  assertSameAcceptedSnapshot(latest, label);
  return latest;
}

function assertSameAcceptedSnapshot(sample: SampleTelemetry, label: string): void {
  const rail = sample.rail;
  const railHost = sample.railHost;
  const scene = sample.scene;
  assert.ok(rail?.snapshotId, `${label}: homepage beam rail must publish a snapshot id`);
  assert.ok(rail?.sourceFrameId, `${label}: homepage beam rail must publish a source frame`);
  assert.ok(rail?.phase, `${label}: homepage beam rail must publish a phase`);
  assert.equal(railHost?.homepageRailSnapshotId, rail?.snapshotId, `${label}: rail host and rail must share snapshot identity`);
  assert.equal(railHost?.homepageRailSourceFrameId, rail?.sourceFrameId, `${label}: rail host and rail must share source-frame identity`);
  assert.equal(railHost?.homepageRailPhase, rail?.phase, `${label}: rail host and rail must share phase`);
  assert.ok(scene?.acceptedHandoverSnapshotId, `${label}: central scene must publish an accepted snapshot id`);
  assert.equal(scene?.acceptedHandoverSnapshotId, rail?.snapshotId, `${label}: central scene and homepage rail must share the accepted snapshot id`);
  assert.equal(scene?.acceptedHandoverSourceFrameId, rail?.sourceFrameId, `${label}: central scene and homepage rail must share the accepted source frame`);
  assert.equal(scene?.acceptedHandoverPhase, rail?.phase, `${label}: central scene and homepage rail must share the accepted phase`);
  if (sample.canvas?.multiCandidateSceneRenderStatus === 'active') {
    assert.ok(sample.canvas.multiCandidateSceneAcceptedSnapshotId, `${label}: active candidate scene must publish a render snapshot id`);
    assert.ok(sample.canvas.multiCandidateSceneAcceptedSourceFrameId, `${label}: active candidate scene must publish a render source frame`);
    assert.equal(sample.canvas.multiCandidateSceneAcceptedSnapshotId, rail?.snapshotId, `${label}: candidate scene must acknowledge the homepage rail snapshot`);
    assert.equal(sample.canvas.multiCandidateSceneAcceptedSourceFrameId, rail?.sourceFrameId, `${label}: candidate scene must acknowledge the homepage rail source frame`);
  }
}

function assertCandidateSceneRailJoin(sample: SampleTelemetry, label: string): void {
  const rail = sample.rail;
  assert.equal(sample.canvas?.multiCandidateSceneRenderStatus, 'active', `${label}: candidate scene must be active at the comparison sample`);
  const displayedBeams = Number(rail?.displayedBeamCount ?? 0);
  const metricBeams = Number(rail?.beamMetricCount ?? 0);
  assert.ok(displayedBeams >= 3, `${label}: homepage rail must display one serving beam plus at least two candidates, got ${displayedBeams}`);
  assert.ok(metricBeams >= 3, `${label}: homepage rail metrics must retain one serving beam plus at least two candidates, got ${metricBeams}`);
  const candidateRows = sample.candidateRows.filter(row => (
    row.sceneJoinKey !== null
      && row.railJoinKey !== null
      && row.role !== 'serving'
      && row.role !== 'committed-serving'
  ));
  const sceneKeys = new Set(sample.sceneJoinKeys);
  assert.ok(sceneKeys.size >= 2, `${label}: expected at least two rendered scene join keys`);
  // The homepage rail intentionally contains the complete configured beam
  // roster for every accepted candidate satellite (and the serving
  // satellite's collapsible non-primary roster).  Those metric rows are
  // useful in the story but are not all central-stage geometry.  Only the
  // accepted presentation representatives carry a scene key that should be
  // present in the central candidate scene.  Join from the rendered scene
  // back to the rail rather than requiring every rail-only metric row to have
  // a central cone/link of its own.
  const sceneJoinedCandidateRows = candidateRows.filter(row => sceneKeys.has(row.sceneJoinKey!));
  assert.ok(
    sceneJoinedCandidateRows.length >= 2,
    `${label}: expected at least two visible candidate representatives joined to the rendered scene`,
  );
  const alternateSceneJoinedCandidateRows = sceneJoinedCandidateRows.filter(row => (
    row.satelliteId !== null
      && row.satelliteId !== sample.canvas?.servingSatelliteId
  ));
  const alternateCandidateSatelliteIds = new Set(
    alternateSceneJoinedCandidateRows
      .map(row => row.satelliteId)
      .filter((satelliteId): satelliteId is string => satelliteId !== null),
  );
  assert.ok(
    alternateCandidateSatelliteIds.size >= 2,
    `${label}: expected at least two alternate candidate satellites joined to the rendered scene`,
  );
  for (const row of sceneJoinedCandidateRows) {
    assert.equal(row.snapshotId, rail?.snapshotId, `${label}: candidate ${row.pairKey ?? row.sceneJoinKey} has a stale rail snapshot id`);
    assert.equal(row.sourceFrameId, rail?.sourceFrameId, `${label}: candidate ${row.pairKey ?? row.sceneJoinKey} has a stale source frame id`);
    assert.equal(row.sceneJoinKey, row.railJoinKey, `${label}: candidate ${row.pairKey ?? row.sceneJoinKey} has scene/rail join-key skew`);
  }
  assert.equal(
    Number(sample.canvas?.multiCandidateSceneSolidDataLinkCount ?? sample.canvas?.multiCandidateSceneGlobalSolidDataLinkCount ?? -1),
    1,
    `${label}: candidate scene must retain exactly one solid data link`,
  );
  assert.equal(Number(sample.railActiveDataLinkCount ?? -1), 1, `${label}: homepage rail must report exactly one solid data link`);
  assert.equal(Number(sample.scene?.acceptedHandoverActiveDataLinkCount ?? -1), 1, `${label}: central scene must report exactly one solid data link`);
  assert.equal(Number(sample.canvas?.multiCandidateSceneUnmappedPairCount ?? -1), 0, `${label}: no candidate geometry may be unmapped`);
}

function assertTypographyAndLayout(sample: SampleTelemetry, label: string): void {
  const rail = sample.layout.rightRail;
  const canvas = sample.layout.canvas;
  assert.ok(rail !== null && canvas !== null, `${label}: canvas and homepage rail must be measurable`);
  assert.ok(rail.x >= canvas.x + canvas.width - 1, `${label}: homepage rail must not cover the central canvas`);
  assert.deepEqual(sample.layout.obstructionOverlaps, [], `${label}: scene labels/toast must not cover the central safe area`);
  assert.deepEqual(sample.railVisual, {
    backgroundColor: 'rgb(6, 19, 27)',
    overflowX: 'hidden',
    overflowY: 'auto',
  }, `${label}: homepage rail must retain its dark, scrollable instrument surface`);
  assert.ok(sample.railText.length > 0, `${label}: homepage rail must have visible content`);
  assert.equal(
    sample.railMetricTexts.some(text => /\b\d{4,}(?:\.\d+)?\s*(?:bit\/s|bit\/J)\b/.test(text)),
    false,
    `${label}: rate/EE values must not regress to ungrouped long units`,
  );
  assert.ok(
    sample.railMetricTexts.some(text => /\b\d+(?:\.\d+)?\s+[kMG](?:bit\/s|bit\/J)\b/.test(text)),
    `${label}: homepage rail must expose compact k/M/G rate or EE units`,
  );
}

// The homepage quick buttons are NOT the surface this gate may drive. They own a
// scripted teaching story rather than an index seek (src/App.tsx:3373,3413) and the
// homepage deliberately hides their event count, because "the number of indexed rows
// is not user-facing evidence" (src/App.tsx:4085). Requiring a positive indexed count
// from them made this gate assert across its own live-truth boundary.
//
// The source-backed public surface is the timeline marker: selected from the real
// Walker event index (src/App.tsx:2501) and rendered with its own source/target times
// (src/ui/TimelineBar.tsx:338-342). assertNaturalTimelineMarkers already locks their
// owner, horizon, claim kind and one-per-kind contract before we touch them.
async function waitForMarkerReady(page: Page, kind: 'intra' | 'inter'): Promise<import('@playwright/test').Locator> {
  const marker = page.locator(`[data-marker-kind="${kind}"][data-click-target-sec]`).first();
  await marker.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(
    expectedKind => {
      const element = document.querySelector<HTMLButtonElement>(`[data-marker-kind="${expectedKind}"][data-click-target-sec]`);
      return element !== null && !element.disabled && !document.querySelector('[data-testid="handover-index-building"]');
    },
    kind,
    { timeout: READY_TIMEOUT_MS },
  );
  return marker;
}

async function runFlow(page: Page, kind: 'intra' | 'inter'): Promise<FlowEvidence> {
  const marker = await waitForMarkerReady(page, kind);
  assert.equal(
    await page.locator(`[data-marker-kind="${kind}"][data-click-target-sec]`).count(),
    1,
    `${kind}: homepage exposes exactly one source-backed timeline marker of this kind`,
  );
  const before = await collectAlignedTelemetry(page, `${kind} pre-action`);
  assertWalkerSource(before);
  assertNaturalTimelineMarkers(before, `${kind} pre-action`);
  const selectedSpeed = Number(before.selectedSpeed);
  const clickTargetSec = Number(await marker.getAttribute('data-click-target-sec'));
  assert.ok(
    Number.isFinite(clickTargetSec) && clickTargetSec >= 0,
    `${kind}: timeline marker must expose a finite click target derived from the Walker event index`,
  );
  await marker.click();
  await page.waitForFunction(
    expected => document.querySelector<HTMLElement>('.leo-app-shell')?.dataset.liveTimelineSeekTarget === expected,
    clickTargetSec.toFixed(3),
    { timeout: 15_000 },
  );

  const samples: SampleTelemetry[] = [before];
  const screenshots: string[] = [];
  const started = Date.now();
  let sampledSwitching = false;
  let sampledGuard = false;
  while (Date.now() - started < MAX_FLOW_MS) {
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
    const sample = await collectTelemetry(page);
    samples.push(sample);
    const phase = phaseOf(sample);
    if (phase === 'switching') sampledSwitching = true;
    if (phase === 'guard' || sample.canvas?.handoverPresentationPhase === 'settled') sampledGuard = true;
    // Keep sampling lightweight so the browser clock remains representative of
    // the real flow. Screenshots are captured after the flow at each required
    // acceptance viewport; taking one on every tick would slow playback enough
    // to hide the commit boundary.
    if (sampledSwitching && sampledGuard) break;
  }

  const comparisonSamples = samples.filter(sample => (
    sample.canvas?.multiCandidateSceneRenderStatus === 'active'
      && hasSameAcceptedSnapshot(sample)
  ));
  if (comparisonSamples.length === 0) {
    // This assertion fails for two very different reasons: the scene never
    // reached `active`, or it did but the scene/rail accepted identity did not
    // join. Report which one, so the failure points at a seam instead of at the
    // whole flow.
    const statusHistogram: Record<string, number> = {};
    for (const sample of samples) {
      const status = sample.canvas?.multiCandidateSceneRenderStatus ?? 'missing';
      statusHistogram[status] = (statusHistogram[status] ?? 0) + 1;
    }
    const activeSamples = samples.filter(
      sample => sample.canvas?.multiCandidateSceneRenderStatus === 'active',
    );
    console.error(`[homepage-multi-candidate-acceptance] ${kind} no-comparison diagnosis:`, {
      totalSamples: samples.length,
      statusHistogram,
      activeSamples: activeSamples.length,
      activeButUnjoined: activeSamples.filter(sample => !hasSameAcceptedSnapshot(sample)).length,
      joinedSamples: samples.filter(hasSameAcceptedSnapshot).length,
      phasesObserved: [...new Set(samples.map(phaseOf).filter(Boolean))],
      firstActiveJoinMismatch: activeSamples
        .filter(sample => !hasSameAcceptedSnapshot(sample))
        .slice(0, 1)
        .map(sample => ({
          railSnapshotId: sample.rail?.snapshotId,
          railSourceFrameId: sample.rail?.sourceFrameId,
          railPhase: sample.rail?.phase,
          sceneSnapshotId: sample.scene?.acceptedHandoverSnapshotId,
          sceneSourceFrameId: sample.scene?.acceptedHandoverSourceFrameId,
          scenePhase: sample.scene?.acceptedHandoverPhase,
          canvasSnapshotId: sample.canvas?.multiCandidateSceneAcceptedSnapshotId,
          canvasSourceFrameId: sample.canvas?.multiCandidateSceneAcceptedSourceFrameId,
        })),
    });
  }
  assert.ok(comparisonSamples.length > 0, `${kind}: no active multi-candidate scene sample was observed`);
  const representative = comparisonSamples.find(sample => sample.candidateRows.length >= 2) ?? comparisonSamples[0]!;
  assertSameAcceptedSnapshot(representative, `${kind} comparison`);
  assertCandidateSceneRailJoin(representative, `${kind} comparison`);
  const maxObstruction = Math.max(...samples.map(sample => sample.layout.obstructionOverlaps.length));
  assert.equal(maxObstruction, 0, `${kind}: sampled scene overlays obstructed the central safe area`);
  const phases = [...new Set(samples.map(phaseOf).filter(Boolean))];
  assert.ok(phases.length >= 2, `${kind}: the flow did not advance through multiple accepted phases (${phases.join(', ')})`);
  if (!samples.some(sample => phaseOf(sample) === 'switching')) {
    console.error(`[homepage-multi-candidate-acceptance] ${kind} phase trace:`, samples.map(sample => ({
      t: sample.timeline?.currentTimeSec,
      railPhase: sample.rail?.phase,
      scenePhase: sample.scene?.acceptedHandoverPhase,
      decisionPhase: sample.canvas?.multiCandidateDecisionPhase,
      presentation: sample.canvas?.handoverPresentationPhase,
      focus: sample.app?.directorPhase,
      snapshot: sample.rail?.snapshotId,
      candidates: sample.candidateRows.length,
      scene: sample.canvas?.multiCandidateSceneRenderStatus,
      effectiveSpeed: sample.app?.effectiveSpeed,
    })));
  }
  assert.ok(samples.some(sample => phaseOf(sample) === 'switching'), `${kind}: switching phase was not observed`);
  assert.ok(
    samples.some(sample => {
      const effective = Number(sample.app?.effectiveSpeed);
      return sample.hoSlow?.autoSlowActive === '1'
        && Number.isFinite(effective)
        && effective > 0
        && effective < selectedSpeed;
    }),
    `${kind}: the current handover flow did not expose an effective speed below the selected speed while HO Slow was active`,
  );

  const originalViewport = page.viewportSize();
  assert.ok(originalViewport, `${kind}: browser viewport must be available`);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const resized = await collectAlignedTelemetry(page, `${kind} ${viewport.name}`);
    assertTypographyAndLayout(resized, `${kind} ${viewport.name}`);
    if (resized.canvas?.multiCandidateSceneRenderStatus === 'active') {
      const path = resolve(OUTPUT_DIR, `${kind}-${viewport.name}.png`);
      await page.screenshot({ path });
      screenshots.push(path);
    }
  }
  await page.setViewportSize(originalViewport);

  return {
    kind,
    clickTargetSec: Number.isFinite(clickTargetSec) ? clickTargetSec : null,
    samples,
    phases,
    sceneSnapshotIds: [...new Set(samples.map(sample => sample.scene?.acceptedHandoverSnapshotId ?? '').filter(Boolean))],
    railSnapshotIds: [...new Set(samples.map(sample => sample.rail?.snapshotId ?? '').filter(Boolean))],
    screenshots,
  };
}

async function resetAndReady(page: Page): Promise<void> {
  await page.goto(new URL('/', APP_URL).toString(), { waitUntil: 'domcontentloaded' });
  await waitForHomepageReady(page);
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser: Browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-crashpad', '--disable-breakpad'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  const evidence: FlowEvidence[] = [];
  try {
    await resetAndReady(page);
    const initial = await collectAlignedTelemetry(page, 'initial comparison');
    assertWalkerSource(initial);
    assertNaturalTimelineMarkers(initial, 'initial comparison');
    // The Walker warm-start may briefly publish an honest pending scene while
    // React commits its first accepted snapshot. Once active, the full
    // candidate/scene/rail join gate is mandatory.
    if (initial.canvas?.multiCandidateSceneRenderStatus === 'active') {
      assertSameAcceptedSnapshot(initial, 'initial comparison');
      assertCandidateSceneRailJoin(initial, 'initial comparison');
    } else {
      assert.ok(
        HONEST_PRE_SNAPSHOT_RENDER_STATUSES.has(
          initial.canvas?.multiCandidateSceneRenderStatus ?? '',
        ),
        `initial scene must be honest before its first snapshot: ${initial.canvas?.multiCandidateSceneRenderStatus ?? 'missing'}`,
      );
    }
    evidence.push(await runFlow(page, 'intra'));
    await resetAndReady(page);
    evidence.push(await runFlow(page, 'inter'));
    assert.deepEqual(errors, [], `homepage acceptance console errors: ${JSON.stringify(errors)}`);
    writeFileSync(resolve(OUTPUT_DIR, 'acceptance-report.json'), JSON.stringify({ appUrl: APP_URL, evidence, errors }, null, 2));
    console.log(`[homepage-multi-candidate-acceptance] PASS: ${evidence.map(flow => `${flow.kind} phases=${flow.phases.join('>')}`).join(' | ')}`);
  } finally {
    await page.close();
    await browser.close();
  }
}

void main().catch(error => {
  console.error('[homepage-multi-candidate-acceptance] FAILED:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
