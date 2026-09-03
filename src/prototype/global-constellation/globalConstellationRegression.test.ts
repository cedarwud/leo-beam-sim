#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import * as director from './globalConstellationDirector';
import {
  ntpuElevationGeometry,
  ntpuTeachingCameraPose,
  ntpuVisibilityMask,
} from './globalConstellationGeometry';

const prototypeSource = readFileSync(
  new URL('./GlobalConstellationPrototype.tsx', import.meta.url),
  'utf8',
);
const sceneSource = readFileSync(
  new URL('./GlobalConstellationScene.tsx', import.meta.url),
  'utf8',
);
const onewebArtifact = JSON.parse(readFileSync(
  new URL('../../../public/global-first-frame/oneweb-20260825.json', import.meta.url),
  'utf8',
)) as {
  readonly satelliteCount: number;
  readonly satelliteIds: readonly string[];
  readonly positionsWorld: readonly number[];
  readonly visibility: readonly number[];
};
const starlinkArtifact = JSON.parse(readFileSync(
  new URL('../../../public/global-first-frame/starlink-20260825.json', import.meta.url),
  'utf8',
)) as typeof onewebArtifact;

test('OneWeb source stays 651 unique archived positions while the renderer compares one cloud at a time', () => {
  assert.equal(onewebArtifact.satelliteCount, 651);
  assert.equal(onewebArtifact.satelliteIds.length, 651);
  assert.equal(new Set(onewebArtifact.satelliteIds).size, 651);
  assert.equal(onewebArtifact.positionsWorld.length, 651 * 3);

  const displayedConstellation = (
    director as typeof director & {
      globalConstellationDisplayedConstellation?: (
        beatId: director.GlobalConstellationBeatId,
        selected: 'starlink' | 'oneweb',
      ) => 'none' | 'starlink' | 'oneweb';
    }
  ).globalConstellationDisplayedConstellation;
  assert.equal(typeof displayedConstellation, 'function');
  assert.equal(displayedConstellation?.('starlink-density', 'oneweb'), 'starlink');
  assert.equal(displayedConstellation?.('oneweb-compare', 'starlink'), 'starlink');
  assert.equal(displayedConstellation?.('oneweb-compare', 'oneweb'), 'oneweb');
  assert.equal(displayedConstellation?.('starlink-visible', 'oneweb'), 'starlink');
  assert.equal(displayedConstellation?.('oneweb-visible', 'starlink'), 'oneweb');

  assert.match(prototypeSource, /data-testid="global-constellation-selector"/);
  assert.match(prototypeSource, /data-constellation=\{constellation\}/);
  assert.match(prototypeSource, /\[\s*'starlink',\s*'oneweb'\s*\]/);
  assert.doesNotMatch(sceneSource, /role === 'starlink' \? 0\.032 : 0\.052/);
});

test('comparison is a pause checkpoint and ended Play restarts at zero', () => {
  const comparisonCheckpoint = (
    director as typeof director & { GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC?: number }
  ).GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC;
  assert.equal(comparisonCheckpoint, 14);

  const playRequest = (
    director as typeof director & {
      resolveGlobalConstellationPlayRequest?: (
        currentTimeSec: number,
        interactionRevealed: boolean,
      ) => { readonly nextCourseTimeSec: number; readonly shouldPlay: boolean; readonly restarted: boolean };
    }
  ).resolveGlobalConstellationPlayRequest;
  assert.equal(typeof playRequest, 'function');
  assert.deepEqual(playRequest?.(director.GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, true), {
    nextCourseTimeSec: 0,
    shouldPlay: true,
    restarted: true,
  });
});

test('the ending remains a stable global frame with visible replay chrome', () => {
  const finale = director.GLOBAL_CONSTELLATION_BEATS[
    director.GLOBAL_CONSTELLATION_BEATS.length - 1
  ];
  assert.equal(finale?.camera, 'synthesis');
  assert.equal(finale?.focusTarget, 'global-earth');
  assert.equal(
    director.globalConstellationChromePhase('stable-finale', 'finale-copy', finale?.durationSec ?? 0),
    'hold',
  );
  assert.equal(
    director.globalConstellationChromePhase('stable-finale', 'replay', finale?.durationSec ?? 0),
    'hold',
  );
  assert.doesNotMatch(prototypeSource, /href="\/prototype\/visual-first-golden-flow"/);
});

test('subtitles form a continuous observation sequence instead of leaving long blank tails', () => {
  const [opening, starlink, oneweb, , ntpuReveal, starlinkVisible, onewebVisible] = director.GLOBAL_CONSTELLATION_BEATS;
  assert.deepEqual(opening?.caption, [
    '畫面上的每個亮點，代表一筆封存 TLE 經 SGP4 推算的衛星位置。',
  ]);
  assert.deepEqual(starlink?.caption, [
    'Starlink：封存快照中有 10,738 顆完成 SGP4 定位。',
    '極區空白受軌道傾角限制；密度帶是點位重疊，不是實體環。',
  ]);
  assert.deepEqual(oneweb?.caption, [
    'OneWeb：封存快照記錄 651 顆成功定位。',
    '切換完成後，在相同尺度下分別讀取數量與高度。',
  ]);
  assert.match(starlinkVisible?.caption.join('') ?? '', /單一封存時刻.*175 \/ 10,738/);
  assert.match(onewebVisible?.caption.join('') ?? '', /單一封存時刻.*17 \/ 651/);
  assert.match(ntpuReveal?.caption.join('') ?? '', /2026-08-25 12:00 UTC.*這一個封存時刻.*atan2.*≥ 10°.*觀測範圍/);
  assert.match(ntpuReveal?.caption.join('') ?? '', /不代表服務/);
  assert.match(starlinkVisible?.caption.join('') ?? '', /幾何觀測門檻.*不代表服務覆蓋/);
  assert.match(onewebVisible?.caption.join('') ?? '', /幾何觀測門檻.*不代表服務覆蓋/);

  const allCopy = director.GLOBAL_CONSTELLATION_BEATS.flatMap(beat => [
    beat.eyebrow,
    ...beat.caption.filter((line): line is string => line !== undefined),
  ]).join(' ');
  assert.doesNotMatch(allCopy, /兩個系統|Starlink 的差異/);
  assert.doesNotMatch(allCopy, /同時|同步比較|直接比較|同一畫面/);
  assert.doesNotMatch(allCopy, /本幕|不是任意示意點|星座總數、軌道高度/);
  assert.match(allCopy, /仰角 α ≥ 10°/);
  assert.match(allCopy, /服務覆蓋/);

  for (const beat of director.GLOBAL_CONSTELLATION_BEATS.slice(0, -1)) {
    const timing = director.GLOBAL_CONSTELLATION_CHROME_TIMINGS[beat.id].caption;
    assert.ok(timing, `${beat.id}: caption timing exists`);
    assert.ok(timing.enterAtSec <= 0.25, `${beat.id}: caption starts promptly`);
    assert.ok(beat.durationSec - timing.exitUntilSec <= 0.2, `${beat.id}: no long blank tail`);
  }

  for (let index = 0; index < director.GLOBAL_CONSTELLATION_BEATS.length - 2; index += 1) {
    const beat = director.GLOBAL_CONSTELLATION_BEATS[index]!;
    const nextBeat = director.GLOBAL_CONSTELLATION_BEATS[index + 1]!;
    const currentTiming = director.GLOBAL_CONSTELLATION_CHROME_TIMINGS[beat.id].caption!;
    const nextTiming = director.GLOBAL_CONSTELLATION_CHROME_TIMINGS[nextBeat.id].caption!;
    const gapSec = beat.durationSec - currentTiming.exitUntilSec + nextTiming.enterAtSec;
    assert.ok(gapSec <= 0.25, `${beat.id} -> ${nextBeat.id}: caption gap is short (${gapSec}s)`);
  }
});

test('height comparison restores labelled median-height rings without calling them orbital planes', () => {
  assert.equal(director.GLOBAL_CONSTELLATION_BEATS[3]?.camera, 'height-oblique');
  assert.match(sceneSource, /'height-oblique': Object\.freeze\(\{ position: \[[^\]]+\]/);
  assert.match(sceneSource, /torusGeometry/);
  assert.match(director.GLOBAL_CONSTELLATION_BEATS[3]?.caption.join('') ?? '', /同心參考環.*不代表.*同一軌道面/);
});

test('the scene itself toggles playback and satellite markers remain legible', () => {
  assert.match(sceneSource, /Math\.hypot\(event\.clientX - start\.x, event\.clientY - start\.y\) <= 6/);
  assert.match(sceneSource, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(prototypeSource, /onTogglePlayback=\{handlePlayPause\}/);
  assert.match(sceneSource, /<OrbitControls[\s\S]*enabled=\{!isPlaying\}/);
  assert.match(sceneSource, /data-orbit-revision=\{String\(orbitRevision\)\}/);
  assert.match(prototypeSource, /'data-camera-interaction': isPlaying \? 'director-locked' : 'orbit-enabled'/);
  assert.ok(director.GLOBAL_CONSTELLATION_POINT_MARKER_SIZE >= 0.026);
  assert.match(sceneSource, /toneMapped=\{false\}/);
});

test('NTPU beats render only geometrically visible satellites and add an elevation construction', () => {
  assert.match(sceneSource, /const NTPU_CAMERA_TARGET[\s\S]*?act1NtpuApexWorld/);
  assert.equal(sceneSource.match(/target: NTPU_CAMERA_TARGET/g)?.length, 3, 'all NTPU camera beats centre the ground station');
  assert.match(prototypeSource, /beat\.id === 'ntpu-reveal' && !interactionRevealed[\s\S]*?'none'/);
  assert.match(prototypeSource, /showElevationGeometry=\{beat\.focusTarget === 'ntpu-local' && interactionRevealed\}/);
  assert.match(sceneSource, /filter\(index => !visibleOnly \|\| \(visibility === role && visibilityMask\[index\] === 1\)\)/);
  assert.match(sceneSource, /ntpuElevationGeometry\([\s\S]*?GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG/);
  assert.match(sceneSource, /局部地平面[\s\S]*?√\(E²\+N²\)/);
  assert.match(sceneSource, /10° 最低仰角界線[\s\S]*?角度按門檻繪製 · 線長不按比例/);
  assert.match(sceneSource, /α = \{geometry\.elevationDeg\.toFixed\(0\)\}°/);

  const onewebMask = ntpuVisibilityMask(
    onewebArtifact.positionsWorld,
    director.GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
  ).mask;
  const geometry = ntpuElevationGeometry(
    onewebArtifact.positionsWorld,
    onewebMask,
    director.GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
    director.GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
  );
  assert.ok(geometry, 'a real visible OneWeb position supplies the elevation construction');
  assert.equal(onewebMask[geometry.satelliteIndex], 1);
  assert.equal(geometry.elevationDeg, director.GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG);
  assert.ok(geometry.referenceSatelliteElevationDeg >= director.GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG);
  assert.equal(geometry.angleArcWorld.length, 25);

  const camera = ntpuTeachingCameraPose(geometry, 9.6, 40);
  const cameraDirection = camera.position.map((value, index) => value - camera.target[index]!) as [number, number, number];
  const cameraDistance = Math.hypot(...cameraDirection);
  const unitCameraDirection = cameraDirection.map(value => value / cameraDistance) as [number, number, number];
  const screenRight = [
    camera.up[1] * unitCameraDirection[2] - camera.up[2] * unitCameraDirection[1],
    camera.up[2] * unitCameraDirection[0] - camera.up[0] * unitCameraDirection[2],
    camera.up[0] * unitCameraDirection[1] - camera.up[1] * unitCameraDirection[0],
  ] as const;
  const screenRightLength = Math.hypot(...screenRight);
  const horizonProjectsRight = screenRight.reduce(
    (sum, value, index) => sum + (value / screenRightLength) * geometry.horizonDirectionWorld[index]!,
    0,
  );
  assert.ok(Math.abs(cameraDistance - 9.6) < 1e-9, 'teaching camera keeps the requested distance from NTPU');
  assert.ok(horizonProjectsRight > 0.999, 'the real local horizon azimuth projects toward screen-right');
  assert.ok(camera.up.reduce((sum, value, index) => sum + value * geometry.zenithWorld[index]!, 0) > 0.999, 'camera up follows NTPU local zenith');
  assert.throws(() => ntpuTeachingCameraPose(geometry, 0), /distance/);
});

test('NTPU teaching visibility uses the 10 degree mask derived from the archived ECF positions', () => {
  const starlink = ntpuVisibilityMask(
    starlinkArtifact.positionsWorld,
    director.GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
  );
  const oneweb = ntpuVisibilityMask(
    onewebArtifact.positionsWorld,
    director.GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG,
  );

  assert.equal(starlink.visibleCount, 175);
  assert.equal(oneweb.visibleCount, 17);
  assert.equal(starlink.mask.length, starlinkArtifact.satelliteCount);
  assert.equal(oneweb.mask.length, onewebArtifact.satelliteCount);
  assert.ok(starlink.visibleCount < starlinkArtifact.visibility.reduce((sum, value) => sum + value, 0));
  assert.ok(oneweb.visibleCount < onewebArtifact.visibility.reduce((sum, value) => sum + value, 0));
});

test('the redundant three-statistic beat is removed rather than left blank', () => {
  assert.equal(director.GLOBAL_CONSTELLATION_BEATS.length, 8);
  assert.equal(director.GLOBAL_CONSTELLATION_BEATS.some(beat => beat.id === ('three-questions' as never)), false);
  assert.doesNotMatch(prototypeSource, /本幕|總數 ／ 中位高度 ／ NTPU 幾何可見數/);
});
