/**
 * Phase 1b browser gate: the Plane-A LiveTelemetryPanel POPULATES and FAILS
 * CLOSED in a real browser on the `modqn-live-cell-preview` lane.
 *
 * It route-mocks the training service (`/jobs` list + `/jobs/:id/stream` SSE)
 * so it needs NO real backend and NO training run. The headless
 * TrainingTelemetryFeed polls the mocked list, opens the mocked SSE stream, and
 * publishes into liveTelemetryStore; the dock's live panel renders from it.
 *
 * The three scenarios exercise the rendered INV-2 status (NOT just the pure
 * resolver, which is exhaustively unit-tested in
 * `validate:phase-d:live-telemetry-store`). Each is a STABLE snapshot built from
 * the event timestamps relative to the panel's live clock — no fake clock (the
 * feed's own poll/SSE-reconnect timers make a faked clock unreliable here):
 *   A. LIVE — fresh progress -> live badge, populated episode tile (5/10),
 *      exactly the Plane-A INV-1 chips (never mixed), and the honest per-channel
 *      source gaps for the un-emitted channels.
 *   B. STALLED — a fresh heartbeat but a progress sample aged past
 *      STALL_AFTER_MS -> stalled badge, producer-backed tile FROZEN (G2).
 *   C. OFFLINE — heartbeat aged past OFFLINE_AFTER_MS -> offline badge (fail
 *      closed; no fabricated fresh numbers).
 *
 * OUT OF SCOPE (intentional): the v2 §3.4/C4 "synthetic 60 Hz SSE burst /
 * bounded re-render" guard targets a FUTURE per-step plane. Plane-A is
 * episode-coarse (<= 1 event/episode + 10 s heartbeat) and never bursts at
 * 60 Hz, so there is nothing to back-pressure; G4 prop-stability is enforced
 * statically by validate:frontend:scene-lane-governance.
 *
 * Requires a running dev server; pass APP_URL or argv[2] to override.
 * Run: `npm run validate:phase-d:live-telemetry`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { OFFLINE_AFTER_MS, STALL_AFTER_MS } from '../src/showcase/dashboard/liveTelemetryStore.ts';

const APP_MODE_STORAGE_KEY = 'leo-beam-sim.app-mode.v1';
const JOB_ID = 'job-live-telemetry-smoke';

const JOBS_LIST_ROUTE = /\/jobs\?/;
const JOB_STREAM_ROUTE = /\/jobs\/[^/]+\/stream$/;
// 127.0.0.1:8765 is cross-origin to the Vite dev server, so the mocked responses
// carry permissive CORS headers (defensive — playwright's route.fulfill
// short-circuits the network, but this guards against CORS enforcement across
// playwright versions).
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

/** Tiles that MUST render a source gap with this mid-run fixture (INV-3). */
const EXPECTED_SOURCE_GAP_TILES = [
  'live-telemetry-terminal-rewards', // reward scalars are terminal-only
  'live-telemetry-reward-curve',     // G-A producer gate, not yet wired
  'live-telemetry-loss',
  'live-telemetry-pareto',
  'live-telemetry-q-values',
  'live-telemetry-learning-rate',
] as const;

interface SseEvent {
  readonly type: 'queued' | 'heartbeat' | 'progress';
  /** Event timestamp RELATIVE to the request-fulfillment moment (negative = past). */
  readonly offsetMs: number;
  readonly episode?: number;
  readonly episodeBudget?: number;
  readonly scalarReward?: number;
}

function sseBody(events: readonly SseEvent[], nowMs: number): string {
  return events.map((e, index) => {
    const data: Record<string, unknown> = { id: index + 1, jobId: JOB_ID, tsMs: nowMs + e.offsetMs, type: e.type, status: 'running' };
    if (e.episode !== undefined) data.episode = e.episode;
    if (e.episodeBudget !== undefined) data.episodeBudget = e.episodeBudget;
    if (e.scalarReward !== undefined) data.metrics = { scalarReward: e.scalarReward };
    return `event: ${e.type}\ndata: ${JSON.stringify(data)}\n\n`;
  }).join('');
}

async function mockTrainingBackend(page: Page, events: readonly SseEvent[]): Promise<void> {
  // Build the body at FULFILLMENT time (per request + per reconnect) so the
  // event timestamps are fresh relative to when the panel reads them — never a
  // single stale `Date.now()` shared across slow/CI scenario loads (codex [P2]).
  await page.route(JOBS_LIST_ROUTE, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify({ jobs: [{ jobId: JOB_ID, status: 'running', submittedAtMs: Date.now(), trainerSubcommand: 'modqn', hyperparamSummary: '' }] }),
    }));
  await page.route(JOB_STREAM_ROUTE, route =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' },
      body: sseBody(events, Date.now()),
    }));
}

/** A failed request is expected ONLY if it targets the unreachable 8765 backend. */
function isBackendOriginFailure(url: string): boolean {
  return /:8765(\/|$)/.test(url);
}

async function runScenario(
  browser: Browser,
  appUrl: string,
  opts: {
    readonly label: string;
    readonly events: readonly SseEvent[];
    readonly expectBadge: 'live' | 'stalled' | 'offline';
    readonly assertExtra?: (page: Page) => Promise<Record<string, unknown>>;
  },
): Promise<Record<string, unknown>> {
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 }, reducedMotion: 'no-preference' });
  await context.addInitScript((key: string) => { window.localStorage.setItem(key, 'modqn-demo'); }, APP_MODE_STORAGE_KEY);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`));
  page.on('requestfailed', r => requestFailures.push(r.url()));

  await mockTrainingBackend(page, opts.events);
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('.leo-app-shell[data-scene-lane="modqn-live-cell-preview"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="algorithm-dock"][data-mode="live"]').waitFor({ state: 'visible', timeout: 20000 });
    // Require the panel to ACTUALLY load our mocked job's telemetry first. The
    // empty "No active training run" state now renders an `idle` badge (distinct
    // from `offline`), but we still gate on the populated panel's data-job-id so
    // the offline scenario verifies a real heartbeat-loss fail-close, not any
    // non-live state (codex [P2]).
    await page.locator(`[data-testid="live-telemetry-panel"][data-job-id="${JOB_ID}"]`).waitFor({ state: 'attached', timeout: 25000 });
    await page.waitForFunction(
      (want: string) => document.querySelector('[data-testid="live-telemetry-status-badge"]')?.getAttribute('data-telemetry-status') === want,
      opts.expectBadge,
      { timeout: 25000 },
    );

    const extra = opts.assertExtra ? await opts.assertExtra(page) : {};

    const unexpectedRequests = requestFailures.filter(url => !isBackendOriginFailure(url));
    assert.deepEqual(unexpectedRequests, [], `[${opts.label}] failed requests outside the mocked 8765 backend:\n${unexpectedRequests.join('\n')}`);
    const backendNoise = requestFailures.some(isBackendOriginFailure);
    const unexpectedConsole = consoleErrors.filter(entry =>
      !(backendNoise && entry === 'Failed to load resource: net::ERR_CONNECTION_REFUSED'));
    assert.deepEqual(unexpectedConsole, [], `[${opts.label}] unexpected console errors:\n${unexpectedConsole.join('\n')}`);

    return { badge: opts.expectBadge, ...extra };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser = await chromium.launch();
  try {
    // A. LIVE: a fresh episode-bearing progress event (offset 0 = fulfillment time).
    const live = await runScenario(browser, appUrl, {
      label: 'live',
      expectBadge: 'live',
      events: [
        { type: 'queued', offsetMs: 0 },
        { type: 'progress', offsetMs: 0, episode: 5, episodeBudget: 10 },
      ],
      assertExtra: async page => {
        const episodeTile = page.locator('[data-testid="live-telemetry-episode"]');
        const episodeText = (await episodeTile.innerText()).replace(/\s+/g, ' ').trim();
        const episodeIsSourceGap = (await episodeTile.innerText()).includes('source gap');
        const provenanceChips = await page.locator('[data-testid="live-telemetry-provenance-chip"]').count();
        const planeAChips = await page.locator('[data-testid="live-telemetry-provenance-chip"][data-plane="A"]').count();
        const sourceGapTileIds: string[] = [];
        for (const tileId of EXPECTED_SOURCE_GAP_TILES) {
          if ((await page.locator(`[data-testid="${tileId}"]`).innerText()).includes('source gap')) sourceGapTileIds.push(tileId);
        }
        const sourceGapTiles = await page.locator('.leo-algorithm-dashboard__source-gap').count();

        assert.match(episodeText, /5\s*\/\s*10/, 'producer-backed episode tile shows episode 5 / 10');
        assert.equal(episodeIsSourceGap, false, 'episode tile is populated (NOT a source gap) mid-run');
        assert.equal(provenanceChips, 7, `every live tile carries an INV-1 provenance chip (got ${provenanceChips})`);
        assert.equal(planeAChips, 7, 'every provenance chip is tagged Plane A (INV-1, never mixed)');
        assert.deepEqual([...sourceGapTileIds].sort(), [...EXPECTED_SOURCE_GAP_TILES].sort(),
          `each un-emitted channel renders an explicit source gap (got ${sourceGapTileIds.join(', ')})`);
        assert.equal(sourceGapTiles, EXPECTED_SOURCE_GAP_TILES.length, 'exactly the un-emitted channels are source gaps');
        return { episodeText, provenanceChips, sourceGapTiles };
      },
    });

    // B. STALLED: fresh heartbeat (last) + a progress sample aged past STALL_AFTER_MS.
    const stalled = await runScenario(browser, appUrl, {
      label: 'stalled',
      expectBadge: 'stalled',
      events: [
        { type: 'progress', offsetMs: -(STALL_AFTER_MS + 4_000), episode: 5, episodeBudget: 10 },
        { type: 'heartbeat', offsetMs: 0 },
      ],
      assertExtra: async page => {
        const frozen = await page.locator('[data-testid="live-telemetry-episode"]').getAttribute('data-frozen');
        assert.equal(frozen, 'true', 'producer-backed tile freezes (data-frozen) while telemetry is stalled (G2)');
        return { episodeFrozen: frozen };
      },
    });

    // C. OFFLINE: heartbeat aged past OFFLINE_AFTER_MS -> fail closed.
    const offline = await runScenario(browser, appUrl, {
      label: 'offline',
      expectBadge: 'offline',
      events: [
        { type: 'progress', offsetMs: -(OFFLINE_AFTER_MS + 5_000), episode: 5, episodeBudget: 10 },
        { type: 'heartbeat', offsetMs: -(OFFLINE_AFTER_MS + 5_000) },
      ],
    });

    // D. EVOLVING CURVE (P3a): per-episode progress carrying scalarReward (as the
    // producer will emit post-G-A) -> the reward-curve tile renders a live
    // MiniRewardCurve instead of a source gap.
    const curve = await runScenario(browser, appUrl, {
      label: 'curve',
      expectBadge: 'live',
      events: [
        { type: 'progress', offsetMs: 0, episode: 1, episodeBudget: 3, scalarReward: 0.4 },
        { type: 'progress', offsetMs: 0, episode: 2, episodeBudget: 3, scalarReward: 0.9 },
        { type: 'progress', offsetMs: 0, episode: 3, episodeBudget: 3, scalarReward: 1.5 },
      ],
      assertExtra: async page => {
        const tile = page.locator('[data-testid="live-telemetry-reward-curve"]');
        const tileText = await tile.innerText();
        const hasCurve = await tile.locator('[data-testid="modqn-mini-reward-curve"]').count();
        const sourceGapTiles = await page.locator('.leo-algorithm-dashboard__source-gap').count();
        assert.equal(hasCurve, 1, 'reward-curve tile renders a live MiniRewardCurve when per-episode reward is present');
        assert.equal(tileText.includes('source gap'), false, 'reward-curve tile is no longer a source gap once reward history exists');
        assert.equal(sourceGapTiles, EXPECTED_SOURCE_GAP_TILES.length - 1, 'reward-curve drops out of the source-gap set, leaving the other un-emitted channels');
        return { hasCurve, sourceGapTiles };
      },
    });

    console.log(JSON.stringify({ appUrl, live, stalled, offline, curve, result: 'PASS' }, null, 2));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
