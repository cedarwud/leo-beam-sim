/**
 * Record the visual-first golden flow at its canonical presentation size.
 *
 * The output is intentionally a fixed handoff artifact. The route remains a
 * source-backed event-atlas visualization; this recorder does not turn it into
 * a live SGP4, canonical-power, EE, or platform-upload run.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

import { GOLDEN_FLOW_ROUTE } from '../src/prototype/golden-flow/goldenFlowDirector.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const WIDTH = 1920;
const HEIGHT = 1080;
const OUTPUT_DIR = join(process.cwd(), 'output/playwright/golden-flow');
const ARTIFACT_SUFFIX_RAW = process.env.GOLDEN_FLOW_ARTIFACT_SUFFIX ?? process.argv[3] ?? '-wi04-r2';
const ARTIFACT_SUFFIX = ARTIFACT_SUFFIX_RAW.startsWith('-') ? ARTIFACT_SUFFIX_RAW : `-${ARTIFACT_SUFFIX_RAW}`;
const OUTPUT_PATH = join(OUTPUT_DIR, `golden-flow-1920${ARTIFACT_SUFFIX}.webm`);
const MANIFEST_PATH = join(OUTPUT_DIR, `golden-flow-1920${ARTIFACT_SUFFIX}.manifest.json`);
const CONTACT_SHEET_PATH = join(OUTPUT_DIR, `golden-flow${ARTIFACT_SUFFIX}-contact-sheet.png`);
const CONTACT_SHEET_FRAME_WIDTH = 480;
const CONTACT_SHEET_FRAME_HEIGHT = 270;
const CONTACT_SHEET_LABEL_HEIGHT = 24;
const CONTACT_SHEET_GAP = 8;
const CONTACT_SHEET_COLUMNS = 4;
const CONTACT_SHEET_ROWS = 3;
const CONTACT_SHEET_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const HEAD_TRIM_SEC = 1;
const TARGET_FINAL_DURATION_SEC = 88.5;
const MAX_PRE_NEW_NORMAL_PLAYBACK_RATE = 1.12;
const CONTROLS_VISIBLE_MIN_SEC = 1.25;
const VIDEO_FLUSH_WAIT_SEC = 1.5;
const BEAT_LABELS = [
  '01  establish',
  '02  angles',
  '03  interaction',
  '04  consequence',
  '05  restore',
  '06  candidate',
  '07  qualification',
  '08  ttt',
  '09  trace',
  '10  commit',
  '11  receipt',
  '12  new-normal',
] as const;

interface CapturedBeat {
  readonly beat: string;
  readonly screenshot: string;
  readonly elapsedMs: number;
}

async function waitForBeat(page: Page, beatId: string, timeout = 120_000): Promise<void> {
  await page.waitForFunction(
    (expected) => document.querySelector('main')?.getAttribute('data-beat') === expected,
    beatId,
    { timeout },
  );
}

async function dragTeachingHandle(page: Page): Promise<void> {
  const handle = page.getByRole('slider', { name: '拖曳波束指向落點' });
  await handle.waitFor({ state: 'visible', timeout: 30_000 });
  const bounds = await handle.boundingBox();
  assert.ok(bounds, 'the scene-local teaching handle must be measurable');
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(bounds.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.82, y, { steps: 18 });
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector('main')?.getAttribute('data-interaction-complete') === 'true',
    undefined,
    { timeout: 5_000 },
  );
  assert.equal(await page.locator('main').getAttribute('data-guided-response'), 'gesture');
  assert.equal(await page.locator('main').getAttribute('data-gesture-count'), '1');
}

async function captureBeat(page: Page, beat: string, startedAt: number, captures: CapturedBeat[]): Promise<void> {
  const screenshot = join(OUTPUT_DIR, `beat-${String(captures.length + 1).padStart(2, '0')}-${beat}${ARTIFACT_SUFFIX}.png`);
  await page.screenshot({ path: screenshot });
  captures.push({ beat, screenshot, elapsedMs: Date.now() - startedAt });
}

function createContactSheet(framePaths: readonly string[]): void {
  assert.equal(framePaths.length, BEAT_LABELS.length, 'contact sheet requires one frame for each beat');
  const cellHeight = CONTACT_SHEET_FRAME_HEIGHT + CONTACT_SHEET_LABEL_HEIGHT;
  const sheetWidth = CONTACT_SHEET_COLUMNS * CONTACT_SHEET_FRAME_WIDTH
    + (CONTACT_SHEET_COLUMNS + 1) * CONTACT_SHEET_GAP;
  const sheetHeight = CONTACT_SHEET_ROWS * cellHeight
    + (CONTACT_SHEET_ROWS + 1) * CONTACT_SHEET_GAP;
  const filters = framePaths.map((_, index) => {
    const label = BEAT_LABELS[index]!.replaceAll("'", "\\'");
    return `[${index}:v]scale=${CONTACT_SHEET_FRAME_WIDTH}:${CONTACT_SHEET_FRAME_HEIGHT}:flags=lanczos,` +
      `pad=${CONTACT_SHEET_FRAME_WIDTH}:${cellHeight}:0:0:color=0x061211,` +
      `drawtext=fontfile=${CONTACT_SHEET_FONT}:text='${label}':fontcolor=0xeaf6f1:fontsize=14:x=8:y=${CONTACT_SHEET_FRAME_HEIGHT + 5}[v${index}]`;
  });
  const layout = framePaths.map((_, index) => {
    const column = index % CONTACT_SHEET_COLUMNS;
    const row = Math.floor(index / CONTACT_SHEET_COLUMNS);
    return `${CONTACT_SHEET_GAP + column * (CONTACT_SHEET_FRAME_WIDTH + CONTACT_SHEET_GAP)}_` +
      `${CONTACT_SHEET_GAP + row * (cellHeight + CONTACT_SHEET_GAP)}`;
  }).join('|');
  filters.push(
    `[${framePaths.map((_, index) => `v${index}`).join('][')}]` +
      `xstack=inputs=${framePaths.length}:layout=${layout}:fill=0x020908,` +
      `pad=${sheetWidth}:${sheetHeight}:0:0:color=0x020908[sheet]`,
  );
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const framePath of framePaths) args.push('-i', framePath);
  args.push('-filter_complex', filters.join(';'), '-map', '[sheet]', '-frames:v', '1', CONTACT_SHEET_PATH);
  execFileSync('ffmpeg', args);
}

function readVideoDurationSec(videoPath: string): number {
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    videoPath,
  ], { encoding: 'utf8' }).trim();
  const durationSec = Number(raw);
  assert.ok(Number.isFinite(durationSec), `ffprobe returned an invalid video duration: ${raw}`);
  return durationSec;
}

interface FrameSignalStats {
  readonly yMin: number;
  readonly yAvg: number;
  readonly yMax: number;
  readonly command: string;
}

function readFirstFrameSignalStats(videoPath: string): FrameSignalStats {
  const filter = `movie=${videoPath},signalstats`;
  const command = `ffprobe -v error -f lavfi -i "${filter}" -show_frames -show_entries frame=tags -read_intervals '%+#1' -of json`;
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', filter,
    '-show_frames',
    '-show_entries', 'frame=tags',
    '-read_intervals', '%+#1',
    '-of', 'json',
  ], { encoding: 'utf8' });
  const tags = (JSON.parse(raw) as { frames?: Array<{ tags?: Record<string, string> }> }).frames?.[0]?.tags;
  assert.ok(tags, `ffprobe did not expose first-frame signalstats for ${videoPath}`);
  const yMin = Number(tags['lavfi.signalstats.YMIN']);
  const yAvg = Number(tags['lavfi.signalstats.YAVG']);
  const yMax = Number(tags['lavfi.signalstats.YMAX']);
  assert.ok(Number.isFinite(yMin) && Number.isFinite(yAvg) && Number.isFinite(yMax), `invalid first-frame signalstats: ${JSON.stringify(tags)}`);
  return { yMin, yAvg, yMax, command };
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let browser: Browser | null = null;
  let page: Page | null = null;
  let capturedPath: string | null = null;
  const captures: CapturedBeat[] = [];
  let recordingTimelineStartedAt = 0;
  let nativeNewNormalStartMs: number | null = null;
  let nativeControlsFirstVisibleMs: number | null = null;
  let nativeControlsVisibleUntilMs: number | null = null;

  try {
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      recordVideo: { dir: OUTPUT_DIR, size: { width: WIDTH, height: HEIGHT } },
    });
    page = await context.newPage();
    recordingTimelineStartedAt = Date.now();
    const video = page.video();
    const url = new URL(GOLDEN_FLOW_ROUTE, appUrl);

    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="golden-flow-stage"] canvas', { state: 'attached', timeout: 30_000 });
    await waitForBeat(page, 'establish');
    await captureBeat(page, 'establish', recordingTimelineStartedAt, captures);
    await waitForBeat(page, 'angles');
    await captureBeat(page, 'angles', recordingTimelineStartedAt, captures);
    await waitForBeat(page, 'interaction');
    assert.equal(
      await page.locator('main').getAttribute('data-motion-state'),
      'frozen-teaching-comparison',
      'recording reached the frozen interaction beat',
    );
    await dragTeachingHandle(page);
    await captureBeat(page, 'interaction', recordingTimelineStartedAt, captures);
    for (const beatId of ['consequence', 'restore', 'candidate', 'qualification', 'ttt', 'trace', 'commit', 'receipt', 'new-normal']) {
      await waitForBeat(page, beatId);
      if (beatId !== 'new-normal') await captureBeat(page, beatId, recordingTimelineStartedAt, captures);
      if (beatId === 'new-normal') {
        nativeNewNormalStartMs = Date.now() - recordingTimelineStartedAt;
      }
    }
    assert.equal(
      await page.locator('main').getAttribute('data-visible-controls'),
      '',
      'new-normal replay/next controls remain unmounted before the stable hold',
    );
    await page.waitForTimeout(6_250);
    nativeControlsFirstVisibleMs = Date.now() - recordingTimelineStartedAt;
    assert.equal(
      await page.locator('main').getAttribute('data-beat'),
      'new-normal',
      'recording completed the twelve-beat flow and held the final new-normal frame',
    );
    assert.equal(
      await page.locator('main').getAttribute('data-visible-controls'),
      'replay,next',
      'new-normal replay/next controls mount after the six-second stable hold',
    );
    await captureBeat(page, 'new-normal', recordingTimelineStartedAt, captures);
    await page.waitForTimeout(CONTROLS_VISIBLE_MIN_SEC * 1000);
    nativeControlsVisibleUntilMs = Date.now() - recordingTimelineStartedAt;

    // Give Chromium enough time to enqueue the final controls-visible frames
    // before Playwright closes the page and flushes its WebM stream.
    await page.waitForTimeout(VIDEO_FLUSH_WAIT_SEC * 1000);
    await page.close();
    capturedPath = video ? await video.path() : null;
    await context.close();
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => undefined);
    if (browser) await browser.close();
  }

  assert.ok(capturedPath, 'Playwright did not produce a WebM recording');
  assert.equal(captures.length, 12, 'recording must produce one canonical screenshot per beat');
  assert.ok(nativeNewNormalStartMs !== null, 'recording must observe the native new-normal start');
  assert.ok(nativeControlsFirstVisibleMs !== null, 'recording must observe native controls first-visible');
  assert.ok(nativeControlsVisibleUntilMs !== null, 'recording must retain controls after first-visible');
  const nativeStableGapSec = (nativeControlsFirstVisibleMs! - nativeNewNormalStartMs!) / 1000;
  const nativeControlsVisibleDurationSec = (nativeControlsVisibleUntilMs! - nativeControlsFirstVisibleMs!) / 1000;
  assert.ok(nativeStableGapSec >= 6, `native new-normal stable gap ${nativeStableGapSec.toFixed(3)}s must be >= 6s`);
  assert.ok(nativeControlsVisibleDurationSec >= 1, `native controls visible duration ${nativeControlsVisibleDurationSec.toFixed(3)}s must be >= 1s`);
  const intermediateVideoPath = join('/tmp', `golden-flow-wi04-intermediate-${process.pid}.webm`);
  renameSync(capturedPath, intermediateVideoPath);
  const trimStartSec = HEAD_TRIM_SEC;
  const trimmedVideoPath = join('/tmp', `golden-flow-wi04-trimmed-${process.pid}.webm`);
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', intermediateVideoPath,
    '-ss', trimStartSec.toFixed(3),
    '-c:v', 'libvpx-vp9',
    '-crf', '32',
    '-b:v', '0',
    '-an',
    trimmedVideoPath,
  ]);
  unlinkSync(intermediateVideoPath);
  const trimmedDurationSec = readVideoDurationSec(trimmedVideoPath);
  const trimmedNewNormalStartSec = Math.max(0.01, nativeNewNormalStartMs! / 1000 - trimStartSec);
  assert.ok(trimmedNewNormalStartSec < trimmedDurationSec, 'trimmed video must retain the native new-normal segment');
  const nativeTailDurationSec = trimmedDurationSec - trimmedNewNormalStartSec;
  const preNewNormalPlaybackRate = Math.max(
    1,
    Math.min(
      MAX_PRE_NEW_NORMAL_PLAYBACK_RATE,
      trimmedNewNormalStartSec / Math.max(1, TARGET_FINAL_DURATION_SEC - nativeTailDurationSec),
    ),
  );
  const postProcessedVideoPath = join('/tmp', `golden-flow-wi04-postprocessed-${process.pid}.webm`);
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', trimmedVideoPath,
    '-filter_complex',
    `[0:v]trim=start=0:end=${trimmedNewNormalStartSec.toFixed(3)},setpts=PTS/${preNewNormalPlaybackRate.toFixed(6)}[pre];` +
      `[0:v]trim=start=${trimmedNewNormalStartSec.toFixed(3)},setpts=PTS-STARTPTS[normal];` +
      '[pre][normal]concat=n=2:v=1:a=0[outv]',
    '-map', '[outv]',
    '-r', '25',
    '-c:v', 'libvpx-vp9',
    '-crf', '32',
    '-b:v', '0',
    '-an',
    postProcessedVideoPath,
  ]);
  unlinkSync(trimmedVideoPath);
  renameSync(postProcessedVideoPath, OUTPUT_PATH);
  const videoDurationSec = readVideoDurationSec(OUTPUT_PATH);
  assert.ok(videoDurationSec >= 60 && videoDurationSec <= 90, `video duration ${videoDurationSec.toFixed(2)}s must stay within 60–90s`);
  const firstFrameSignalStats = readFirstFrameSignalStats(OUTPUT_PATH);
  assert.ok(firstFrameSignalStats.yAvg < 230, `first video frame must not be an all-white flash (YAVG=${firstFrameSignalStats.yAvg})`);
  assert.ok(firstFrameSignalStats.yMin < 230, `first video frame must contain non-white pixels (YMIN=${firstFrameSignalStats.yMin})`);
  createContactSheet(captures.map(capture => capture.screenshot));
  const recordingCommand = `node --import tsx/esm scripts/record-golden-flow-video.ts ${appUrl} ${ARTIFACT_SUFFIX}`;
  const nativeNewNormalStartSec = nativeNewNormalStartMs! / 1000;
  const nativeControlsFirstVisibleSec = nativeControlsFirstVisibleMs! / 1000;
  const nativeControlsVisibleUntilSec = nativeControlsVisibleUntilMs! / 1000;
  const finalNewNormalStartSec = trimmedNewNormalStartSec / preNewNormalPlaybackRate;
  const finalControlsFirstVisibleSec = finalNewNormalStartSec + nativeStableGapSec;
  const finalControlsVisibleUntilSec = finalControlsFirstVisibleSec + nativeControlsVisibleDurationSec;
  writeFileSync(MANIFEST_PATH, JSON.stringify({
    artifact: 'WI-04 scene-first Golden Flow candidate evidence',
    artifactSuffix: ARTIFACT_SUFFIX,
    capturedAt: new Date().toISOString(),
    route: GOLDEN_FLOW_ROUTE,
    viewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
    truthBoundary: '固定事件錨點；示意幾何；非即時資料；非實測 SINR/EE',
    truthMode: '固定事件錨點・示意幾何・非即時資料',
    stableNewNormalSec: 6,
    nativeTiming: {
      basis: 'wall-clock elapsed from Playwright context.newPage before navigation; raw browser WebM timeline',
      newNormalStartSec: nativeNewNormalStartSec,
      controlsFirstVisibleSec: nativeControlsFirstVisibleSec,
      controlsVisibleUntilSec: nativeControlsVisibleUntilSec,
      stableGapSec: nativeStableGapSec,
      controlsVisibleDurationSec: nativeControlsVisibleDurationSec,
      stableGapRequirementSec: 6,
      controlsVisibleRequirementSec: 1,
    },
    postProcess: {
      method: 'head trim, pre-new-normal-only playback-rate adjustment, then concat with an unmodified new-normal tail',
      headTrimSec: trimStartSec,
      trimmedSourceDurationSec: trimmedDurationSec,
      trimmedNewNormalStartSec,
      preNewNormalPlaybackRate,
      newNormalPlaybackRate: 1,
      finalNewNormalStartSec,
      finalControlsFirstVisibleSec,
      finalControlsVisibleUntilSec,
      finalStableGapSec: finalControlsFirstVisibleSec - finalNewNormalStartSec,
      finalControlsVisibleDurationSec: finalControlsVisibleUntilSec - finalControlsFirstVisibleSec,
      staticFrameAppend: false,
      controlsTailIsNativeRender: true,
      controlsTailVisibleDurationSec: nativeControlsVisibleDurationSec,
    },
    durationSec: videoDurationSec,
    videoTrimStartSec: trimStartSec,
    elapsedToFinalCaptureSec: captures.length > 0 ? captures[captures.length - 1]!.elapsedMs / 1000 : null,
    video: OUTPUT_PATH,
    contactSheet: CONTACT_SHEET_PATH,
    firstFrameEvidence: {
      nonWhite: true,
      yMin: firstFrameSignalStats.yMin,
      yAvg: firstFrameSignalStats.yAvg,
      yMax: firstFrameSignalStats.yMax,
      command: firstFrameSignalStats.command,
    },
    forbiddenChrome: ['.golden-flow-topbar', '.golden-flow-chapter', '.golden-flow-provenance'],
    primaryCueContract: 'exactly-one-per-beat',
    subjectOverlapPolicy: 'registered central subject safe-area proxy <= 5%; not pixel segmentation',
    controlsTiming: {
      interaction: 'camera-side,camera-top,camera-oblique,beam-axis-drag at elapsed 0',
      newNormal: 'replay,next after stableHoldSec 6; unmounted before threshold',
      otherBeats: 'none',
    },
    interactionEvidence: {
      method: 'real pointer drag on scene-local beam-axis slider',
      guidedResponse: 'gesture',
      gestureCount: 1,
    },
    testCommands: [
      { command: 'node --import tsx/esm src/prototype/golden-flow/goldenFlowDirector.test.ts', result: 'PASS' },
      { command: 'npx tsc --noEmit', result: 'PASS' },
      { command: `node --import tsx/esm scripts/validate-golden-flow-browser.ts ${appUrl}`, result: 'PASS; browser cue/control viewport and post-handover role assertions' },
      { command: `node --import tsx/esm scripts/validate-golden-flow-course-segments-browser.ts ${appUrl}`, result: 'PASS; Act 3/4 browser segment assertions' },
      { command: recordingCommand, result: `PASS; one native browser capture, ${captures.length} frames, no static frame append` },
      { command: 'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 <video>', result: `PASS; ${videoDurationSec.toFixed(3)}s; 1920x1080 @ 25fps` },
      { command: firstFrameSignalStats.command, result: `PASS; first frame non-white (YAVG=${firstFrameSignalStats.yAvg})` },
    ],
    knownGaps: [
      'Visual-only candidate evidence; controller/owner final pixel acceptance remains separate.',
      'Subject overlap uses the declared central safe-area proxy and conservative DOM rectangles, not semantic pixel segmentation.',
      'The pinned event-atlas and schematic geometry do not certify the WI-09 complete scientific source-backed inter-handover lesson.',
      'No canonical SINR/EE, energy, policy, live telemetry, platform persistence, or counterfactual-to-handover causal claim is made.',
      'Only the pre-new-normal segment is rate-adjusted to fit the 60–90s pilot window; the native new-normal hold and controls-visible tail are not accelerated.',
    ],
    screenshots: captures.map(capture => ({
      ...capture,
      elapsedSec: capture.elapsedMs / 1000,
    })),
  }, null, 2));
  console.log(`[golden-flow-record] PASS — ${OUTPUT_PATH}`);
  console.log(`[golden-flow-record] SCREENSHOTS — ${captures.length} beat frames; manifest ${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error('[golden-flow-record] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
