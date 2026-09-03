import assert from 'node:assert/strict';

import {
  GLOBAL_CONSTELLATION_BEATS,
  GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_FACTS,
  GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC,
  GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
  GLOBAL_CONSTELLATION_NTPU_GEOMETRY_CHAIN,
  globalConstellationBeatAt,
  globalConstellationBeatIndex,
  globalConstellationDisplayedConstellation,
  resolveGlobalConstellationPlayRequest,
  medianAltitudeGuideRadiusWorld,
} from './globalConstellationDirector';
import {
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
  cameraTelemetryIsSettled,
} from './globalConstellationCamera';
import {
  ntpuElevationGeometry,
  ntpuMarkerGeometry,
  ntpuSurfaceReticleGeometry,
} from './globalConstellationGeometry';
import { act1NtpuApexWorld } from './act1NtpuGeometry';

assert.equal(GLOBAL_CONSTELLATION_BEATS.length, 8);
assert.equal(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, 66);
assert.equal(new Set(GLOBAL_CONSTELLATION_BEATS.map(beat => beat.primaryCue)).size, 8);
assert.equal(new Set(GLOBAL_CONSTELLATION_BEATS.map(beat => beat.camera)).size, 8);
assert.ok(GLOBAL_CONSTELLATION_BEATS.every(beat => beat.caption.length <= 2));
assert.ok(GLOBAL_CONSTELLATION_BEATS.every(beat => beat.durationSec > 0));
assert.equal(GLOBAL_CONSTELLATION_BEATS[GLOBAL_CONSTELLATION_BEATS.length - 1]?.durationSec, 6);
assert.equal(GLOBAL_CONSTELLATION_BEATS[GLOBAL_CONSTELLATION_BEATS.length - 1]?.camera, 'synthesis');
assert.equal(GLOBAL_CONSTELLATION_BEATS[GLOBAL_CONSTELLATION_BEATS.length - 1]?.focusTarget, 'global-earth');
assert.equal(GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC, 14);
assert.equal(GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG, 10);
assert.equal(GLOBAL_CONSTELLATION_NTPU_GEOMETRY_CHAIN, '封存 TLE → SGP4/TEME → 地固座標 → NTPU 站心座標 → α = atan2(U, √(E²+N²)) ≥ 10°');
assert.equal(globalConstellationDisplayedConstellation('earth-question', 'oneweb'), 'starlink');
assert.equal(globalConstellationDisplayedConstellation('starlink-density', 'oneweb'), 'starlink');
assert.equal(globalConstellationDisplayedConstellation('oneweb-compare', 'starlink'), 'starlink');
assert.equal(globalConstellationDisplayedConstellation('oneweb-compare', 'oneweb'), 'oneweb');
assert.equal(globalConstellationDisplayedConstellation('height-cross-section', 'oneweb'), 'oneweb');
assert.equal(globalConstellationDisplayedConstellation('ntpu-reveal', 'oneweb'), 'oneweb');
assert.equal(globalConstellationDisplayedConstellation('starlink-visible', 'oneweb'), 'starlink');
assert.equal(globalConstellationDisplayedConstellation('oneweb-visible', 'starlink'), 'oneweb');
assert.equal(globalConstellationDisplayedConstellation('stable-finale', 'oneweb'), 'oneweb');
assert.deepEqual(resolveGlobalConstellationPlayRequest(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, true), {
  nextCourseTimeSec: 0,
  shouldPlay: true,
  restarted: true,
});
assert.equal(GLOBAL_CONSTELLATION_BEATS[7]?.focusTarget, 'global-earth');
assert.equal(globalConstellationBeatIndex('ntpu-reveal'), 4);
assert.equal(globalConstellationBeatIndex('unknown'), null);
assert.equal(globalConstellationBeatAt(0).id, 'earth-question');
assert.throws(() => globalConstellationBeatAt(99), RangeError);

assert.equal(GLOBAL_CONSTELLATION_FACTS.instantUtc, '2026-08-25T12:00:00.000Z');
assert.equal(GLOBAL_CONSTELLATION_FACTS.worldFrame, 'earth-fixed-radius-2.48-v1');
assert.equal(GLOBAL_CONSTELLATION_FACTS.starlink.count, 10_738);
assert.equal(GLOBAL_CONSTELLATION_FACTS.starlink.ntpuHorizonVisible, 445);
assert.equal(GLOBAL_CONSTELLATION_FACTS.starlink.ntpuVisibleAtMinimumElevation, 175);
assert.equal(GLOBAL_CONSTELLATION_FACTS.starlink.medianAltitudeKm, 480.67);
assert.equal(GLOBAL_CONSTELLATION_FACTS.oneweb.count, 651);
assert.equal(GLOBAL_CONSTELLATION_FACTS.oneweb.ntpuHorizonVisible, 37);
assert.equal(GLOBAL_CONSTELLATION_FACTS.oneweb.ntpuVisibleAtMinimumElevation, 17);
assert.equal(GLOBAL_CONSTELLATION_FACTS.oneweb.medianAltitudeKm, 1212.455);
assert.equal(GLOBAL_CONSTELLATION_FACTS.starlink.snapshotPath, '/tle-archive/starlink/starlink_20260824.tle');
assert.equal(GLOBAL_CONSTELLATION_FACTS.oneweb.snapshotPath, '/tle-archive/oneweb/oneweb_20260825.tle');
assert.ok(GLOBAL_CONSTELLATION_FACTS.starlink.snapshotSha256.length === 64);
assert.ok(GLOBAL_CONSTELLATION_FACTS.oneweb.snapshotSha256.length === 64);

assert.ok(medianAltitudeGuideRadiusWorld(480.67) > GLOBAL_CONSTELLATION_FACTS.earthRadiusWorld);
assert.ok(medianAltitudeGuideRadiusWorld(1212.455) > medianAltitudeGuideRadiusWorld(480.67));
assert.ok(GLOBAL_CONSTELLATION_FACTS.starlink.count / GLOBAL_CONSTELLATION_FACTS.oneweb.count > 16);

const marker = ntpuMarkerGeometry(true);
const ntpuApex = act1NtpuApexWorld();
assert.deepEqual(marker.anchorWorld, ntpuApex, 'NTPU marker anchor stays at the canonical surface apex');
assert.equal(marker.glyphScale, 1.42, 'NTPU marker scale applies to glyph geometry only');
assert.deepEqual(marker.labelOffsetLocal.slice(0, 1), [0], 'NTPU label offset remains local to the anchored glyph');

const reticle = ntpuSurfaceReticleGeometry();
assert.deepEqual(reticle.centerWorld, ntpuApex, 'finale reticle center is the NTPU surface apex');
assert.equal(reticle.segmentsWorld.length, 4, 'finale uses four short surface reticle brackets');
assert.ok(!Object.prototype.hasOwnProperty.call(reticle, 'axis'), 'finale reticle has no vertical axis or link endpoint');
assert.ok(reticle.segmentsWorld.every(segment => segment.every(point => Math.abs(
  Math.hypot(point[0] - ntpuApex[0], point[1] - ntpuApex[1], point[2] - ntpuApex[2]) - reticle.radiusWorld,
) < 1e-9)), 'reticle brackets stay local to the surface marker');

assert.equal(cameraTelemetryIsSettled(
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
), true, 'camera settles only at the measured error/frame boundary');
assert.equal(cameraTelemetryIsSettled(0, 0, GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES - 1), false);
assert.equal(cameraTelemetryIsSettled(GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD + 0.001, 0, GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES), false);

// Autoplay chrome exclusivity & sparse visible copy tests
import {
  GLOBAL_CONSTELLATION_CHROME_TIMINGS,
  globalConstellationChromePhase,
  globalConstellationChromeState,
  type GlobalConstellationChromeId,
} from './globalConstellationDirector';

const EXPECTED_HOLD_CHROME: Readonly<Record<string, readonly string[]>> = {
  'earth-question': ['title', 'caption'],
  'starlink-density': ['truth', 'edge-number', 'caption'],
  'oneweb-compare': ['truth', 'legend', 'edge-number', 'caption'],
  'height-cross-section': ['caption'],
  'ntpu-reveal': ['reveal', 'caption'],
  'starlink-visible': ['edge-number', 'caption'],
  'oneweb-visible': ['edge-number', 'caption'],
  'stable-finale': ['finale-copy', 'replay'],
};

const EDGE_CHROME_IDS = new Set<GlobalConstellationChromeId>(['edge-number', 'reveal']);
const SUBTITLE_CHROME_IDS = new Set<GlobalConstellationChromeId>(['caption', 'finale-copy']);

const allBeatCopy = GLOBAL_CONSTELLATION_BEATS.flatMap(beat => [
  beat.eyebrow,
  ...beat.caption.filter((line): line is string => line !== undefined),
]).join(' ');
assert.doesNotMatch(allBeatCopy, /兩個系統|Starlink 的差異/);
assert.doesNotMatch(allBeatCopy, /同時|同步比較|直接比較|同一畫面/);
assert.doesNotMatch(allBeatCopy, /本幕|不是任意示意點|星座總數、軌道高度/);
assert.match(allBeatCopy, /封存 TLE.*SGP4.*atan2\(U, √\(E²\+N²\)\).*≥ 10°/);
assert.match(allBeatCopy, /幾何可見性.*服務覆蓋|服務覆蓋.*幾何可見性/);
assert.equal(GLOBAL_CONSTELLATION_BEATS[0]?.eyebrow, '01 · 建立 LEO 全球尺度');
assert.equal(GLOBAL_CONSTELLATION_BEATS[1]?.eyebrow, '02 · 讀取 Starlink 全球數量');
assert.equal(GLOBAL_CONSTELLATION_BEATS[2]?.eyebrow, '03 · 暫停並切換至 OneWeb');

for (const beat of GLOBAL_CONSTELLATION_BEATS) {
  // Sparse visible copy
  assert.ok(beat.caption.length >= 1 && beat.caption.length <= 2, `${beat.id}: caption has 1 or 2 lines`);
  for (const line of beat.caption) {
    if (line !== undefined) {
      assert.ok(line.length > 0 && line.length <= 50, `${beat.id}: caption line is concise (${line})`);
      assert.ok(!/handover|energy|coverage|link quality|ee/i.test(line), `${beat.id}: caption makes no out-of-scope claims`);
    }
  }

  // Chrome timings bounds
  const timing = GLOBAL_CONSTELLATION_CHROME_TIMINGS[beat.id];
  assert.ok(timing, `${beat.id}: chrome timing definition exists`);
  for (const [chromeId, item] of Object.entries(timing)) {
    if (item) {
      assert.ok(item.enterAtSec >= 0, `${beat.id}/${chromeId}: enter >= 0`);
      assert.ok(item.holdUntilSec > item.enterAtSec, `${beat.id}/${chromeId}: hold > enter`);
      assert.ok(item.exitUntilSec >= item.holdUntilSec, `${beat.id}/${chromeId}: exit >= hold`);
      const terminalAllowanceSec = beat.id === 'stable-finale' ? 0.25 : 0;
      assert.ok(item.exitUntilSec <= beat.durationSec + terminalAllowanceSec, `${beat.id}/${chromeId}: exit <= readable boundary`);
    }
  }

  // Hold phase exclusivity
  const holdMidpoint = Math.min(...Object.values(timing).map(t => (t!.enterAtSec + t!.holdUntilSec) / 2));
  const activeChrome = globalConstellationChromeState(beat.id, holdMidpoint);
  const activeIds = activeChrome.filter(c => c.phase === 'hold').map(c => c.id).sort();
  const expectedIds = [...(EXPECTED_HOLD_CHROME[beat.id] ?? [])].sort();
  assert.deepEqual(activeIds, expectedIds, `${beat.id}: hold phase has exact sparse chrome set`);

  // Exclusivity: at most one edge cluster and at most one subtitle cluster
  const edgeCount = activeChrome.filter(c => c.visible && EDGE_CHROME_IDS.has(c.id)).length;
  const subtitleCount = activeChrome.filter(c => c.visible && SUBTITLE_CHROME_IDS.has(c.id)).length;
  assert.ok(edgeCount <= 1, `${beat.id}: at most one edge chrome active during hold (${edgeCount})`);
  assert.ok(subtitleCount <= 1, `${beat.id}: at most one subtitle chrome active during hold (${subtitleCount})`);

  // Phase transitions: before enter -> hidden, during hold -> hold, after exit -> hidden
  for (const [chromeId, item] of Object.entries(timing)) {
    if (item) {
      const id = chromeId as GlobalConstellationChromeId;
      assert.equal(globalConstellationChromePhase(beat.id, id, -1), 'hidden');
      assert.equal(globalConstellationChromePhase(beat.id, id, item.enterAtSec - 0.01), 'hidden');
      assert.equal(globalConstellationChromePhase(beat.id, id, item.exitUntilSec + 0.1), 'hidden');
    }
  }
}

for (let index = 0; index < GLOBAL_CONSTELLATION_BEATS.length - 2; index += 1) {
  const beat = GLOBAL_CONSTELLATION_BEATS[index]!;
  const nextBeat = GLOBAL_CONSTELLATION_BEATS[index + 1]!;
  const currentCaption = GLOBAL_CONSTELLATION_CHROME_TIMINGS[beat.id].caption!;
  const nextCaption = GLOBAL_CONSTELLATION_CHROME_TIMINGS[nextBeat.id].caption!;
  const gapSec = beat.durationSec - currentCaption.exitUntilSec + nextCaption.enterAtSec;
  assert.ok(gapSec <= 0.25, `${beat.id} -> ${nextBeat.id}: caption gap <= 0.25s`);
}

// Pure course time resolution & beat mapping tests
import {
  GLOBAL_CONSTELLATION_PLAYBACK_SPEEDS,
  GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_REVIEW_FRAME_OFFSET_SEC,
  beatToCourseTime,
  courseTimeToBeat,
  globalConstellationReviewFrameCourseTime,
  globalConstellationInteractionStateForCourseTime,
} from './globalConstellationDirector';

assert.deepEqual([...GLOBAL_CONSTELLATION_PLAYBACK_SPEEDS], [0.5, 1, 1.5, 2]);

// Beat 0: earth-question (6s)
assert.equal(beatToCourseTime(0, 0), 0);
assert.equal(beatToCourseTime(0, 6), 6);
assert.equal(beatToCourseTime(0, 8), 6);

// Beat 1: starlink-density (8s) -> [6, 14)
assert.equal(beatToCourseTime(1, 0), 6);
assert.equal(beatToCourseTime(1, 4), 10);
assert.equal(beatToCourseTime(1, 8), 14);

// Beat 2: oneweb-compare (8s) -> [14, 22)
assert.equal(beatToCourseTime(2, 0), 14);

// Beat 4: ntpu-reveal (12s) -> [30, 42)
assert.equal(beatToCourseTime(4, 0), 30);

// Beat 7: stable-finale (6s) -> [60, 66]
assert.equal(beatToCourseTime(7, 0), 60);
assert.equal(beatToCourseTime(7, 6), 66);

// Roundtrip & boundaries for courseTimeToBeat
const res0 = courseTimeToBeat(0);
assert.equal(res0.beatIndex, 0);
assert.equal(res0.beat.id, 'earth-question');
assert.equal(res0.beatElapsedSec, 0);
assert.equal(res0.beatProgress, 0);

const res8 = courseTimeToBeat(8);
assert.equal(res8.beatIndex, 1);
assert.equal(res8.beat.id, 'starlink-density');
assert.equal(res8.beatElapsedSec, 2);
assert.equal(res8.beatProgress, 0.25);

const res30 = courseTimeToBeat(30);
assert.equal(res30.beatIndex, 4);
assert.equal(res30.beat.id, 'ntpu-reveal');
assert.equal(res30.beatElapsedSec, 0);

const res399 = courseTimeToBeat(39.9);
assert.equal(res399.beatIndex, 4);
assert.equal(res399.beat.id, 'ntpu-reveal');
assert.ok(Math.abs(res399.beatElapsedSec - 9.9) < 1e-9);

const res42 = courseTimeToBeat(42);
assert.equal(res42.beatIndex, 5);
assert.equal(res42.beat.id, 'starlink-visible');
assert.equal(res42.beatElapsedSec, 0);

const res66 = courseTimeToBeat(66);
assert.equal(res66.beatIndex, 7);
assert.equal(res66.beat.id, 'stable-finale');
assert.equal(res66.beatElapsedSec, 6);
assert.equal(res66.beatProgress, 1);

// Negative and overflow clamping
assert.equal(courseTimeToBeat(-10).beatIndex, 0);
assert.equal(courseTimeToBeat(-10).beatElapsedSec, 0);
assert.equal(courseTimeToBeat(100).beatIndex, 7);
assert.equal(courseTimeToBeat(100).beatElapsedSec, 6);

// Review URLs open on one readable second inside the requested beat while
// natural autoplay retains its zero-time origin.
assert.equal(GLOBAL_CONSTELLATION_REVIEW_FRAME_OFFSET_SEC, 1);
assert.equal(globalConstellationReviewFrameCourseTime(0), 1);
assert.equal(globalConstellationReviewFrameCourseTime(4), 31);
assert.equal(globalConstellationReviewFrameCourseTime(7), 61);
assert.equal(courseTimeToBeat(globalConstellationReviewFrameCourseTime(4)).beat.id, 'ntpu-reveal');

// Natural playback stops on the first fully readable NTPU action frame.  It
// must not consume the entire twelve-second explanation before waiting for the
// learner to press Display.  A direct seek to the next beat still reconstructs
// the completed interaction.
assert.equal(GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC, 42);
assert.equal(GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC, 31);
assert.deepEqual(resolveGlobalConstellationPlayRequest(31, false), {
  nextCourseTimeSec: 31,
  shouldPlay: false,
  restarted: false,
});
assert.equal(globalConstellationInteractionStateForCourseTime(41.9), 'awaiting-reveal');
assert.equal(globalConstellationInteractionStateForCourseTime(31), 'awaiting-reveal');
assert.equal(globalConstellationInteractionStateForCourseTime(0), 'awaiting-reveal');
assert.equal(globalConstellationInteractionStateForCourseTime(42), 'completed');
assert.equal(globalConstellationInteractionStateForCourseTime(66), 'completed');

console.log('global constellation director keeps one 66-second, 8-beat, artifact-bound visual flow');
