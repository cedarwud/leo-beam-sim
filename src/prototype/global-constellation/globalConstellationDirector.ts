/**
 * The director contract for the global constellation classroom slice.
 *
 * This file deliberately contains presentation order and the accepted, static
 * artifact facts only.  It does not propagate TLEs, compute a link budget, or
 * make a handover/energy decision.  The scene consumes the already validated
 * archived first-frame artifacts from `visualLab/globalConstellation`.
 */

import {
  VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM,
  VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD,
  VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC,
  VISUAL_LAB_GLOBAL_CONSTELLATION_WORLD_FRAME,
} from '../../visualLab/globalConstellation';

export const GLOBAL_CONSTELLATION_ROUTE = '/prototype/global-constellation' as const;

export const GLOBAL_CONSTELLATION_COLOURS = Object.freeze({
  starlink: '#58e6d0',
  oneweb: '#f6c86c',
  starlinkDim: '#287f79',
  onewebDim: '#8f7135',
  earth: '#0d3346',
  height: '#e6f6df',
  ntpu: '#ffdf88',
});

/** Keep individual archived positions legible without merging the dense cloud into a solid band. */
export const GLOBAL_CONSTELLATION_POINT_MARKER_SIZE = 0.026;

export type GlobalConstellationBeatId =
  | 'earth-question'
  | 'starlink-density'
  | 'oneweb-compare'
  | 'height-cross-section'
  | 'ntpu-reveal'
  | 'starlink-visible'
  | 'oneweb-visible'
  | 'stable-finale';

export type GlobalConstellationCameraPose =
  | 'earth-wide'
  | 'starlink-close'
  | 'compare-wide'
  | 'height-oblique'
  | 'ntpu-approach'
  | 'starlink-visibility'
  | 'oneweb-visibility'
  | 'synthesis'
  | 'finale';

export type GlobalConstellationPrimaryCue =
  | 'earth-only-question'
  | 'starlink-density-cloud'
  | 'oneweb-density-compare'
  | 'median-height-guides'
  | 'ntpu-reveal-control'
  | 'starlink-horizon-mask'
  | 'oneweb-horizon-mask'
  | 'stable-replay';

export type GlobalConstellationFocusTarget = 'global-earth' | 'ntpu-local';

export type GlobalConstellationDisplayedConstellation = 'none' | 'starlink' | 'oneweb';

export type GlobalConstellationSelectableConstellation = 'starlink' | 'oneweb';

export type GlobalConstellationChromeId =
  | 'title'
  | 'truth'
  | 'legend'
  | 'edge-number'
  | 'caption'
  | 'reveal'
  | 'finale-copy'
  | 'replay';

export type GlobalConstellationChromePhase = 'hidden' | 'enter' | 'hold' | 'exit';

export interface GlobalConstellationChromeTiming {
  readonly enterAtSec: number;
  readonly holdUntilSec: number;
  readonly exitUntilSec: number;
}

export interface GlobalConstellationChromeState {
  readonly id: GlobalConstellationChromeId;
  readonly phase: GlobalConstellationChromePhase;
  readonly visible: boolean;
}

export interface GlobalConstellationBeat {
  readonly id: GlobalConstellationBeatId;
  readonly order: number;
  readonly durationSec: number;
  readonly camera: GlobalConstellationCameraPose;
  readonly caption: readonly [string, string?];
  readonly eyebrow: string;
  readonly primaryCue: GlobalConstellationPrimaryCue;
  readonly focusTarget: GlobalConstellationFocusTarget;
}

/**
 * The geometry boundary shown in the local-visibility explanation.  The
 * director names the real source/frame chain without claiming that this
 * display performs a second propagation or a service decision.
 */
export const GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG = 10 as const;

export const GLOBAL_CONSTELLATION_NTPU_GEOMETRY_CHAIN =
  `封存 TLE → SGP4/TEME → 地固座標 → NTPU 站心座標 → α = atan2(U, √(E²+N²)) ≥ ${GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG}°` as const;

export const GLOBAL_CONSTELLATION_CHROME_TIMINGS: Readonly<Record<GlobalConstellationBeatId, Readonly<Partial<Record<GlobalConstellationChromeId, GlobalConstellationChromeTiming>>>>> = Object.freeze({
  'earth-question': Object.freeze({
    title: Object.freeze({ enterAtSec: 0, holdUntilSec: 4.8, exitUntilSec: 5.8 }),
    caption: Object.freeze({ enterAtSec: 0.05, holdUntilSec: 5.85, exitUntilSec: 6 }),
  }),
  'starlink-density': Object.freeze({
    truth: Object.freeze({ enterAtSec: 0.2, holdUntilSec: 6.2, exitUntilSec: 7.2 }),
    'edge-number': Object.freeze({ enterAtSec: 0.35, holdUntilSec: 5.8, exitUntilSec: 6.75 }),
    caption: Object.freeze({ enterAtSec: 0.2, holdUntilSec: 7.75, exitUntilSec: 7.95 }),
  }),
  'oneweb-compare': Object.freeze({
    truth: Object.freeze({ enterAtSec: 0.2, holdUntilSec: 5.9, exitUntilSec: 6.8 }),
    legend: Object.freeze({ enterAtSec: 0.4, holdUntilSec: 3.6, exitUntilSec: 4.55 }),
    'edge-number': Object.freeze({ enterAtSec: 0.35, holdUntilSec: 5.6, exitUntilSec: 6.55 }),
    caption: Object.freeze({ enterAtSec: 0.15, holdUntilSec: 7.75, exitUntilSec: 7.95 }),
  }),
  'height-cross-section': Object.freeze({
    caption: Object.freeze({ enterAtSec: 0.15, holdUntilSec: 7.75, exitUntilSec: 7.95 }),
  }),
  'ntpu-reveal': Object.freeze({
    // Keep the learner's action available while the course clock waits on its
    // first fully readable frame and until the learner activates it.
    reveal: Object.freeze({ enterAtSec: 0.1, holdUntilSec: 12, exitUntilSec: 12 }),
    caption: Object.freeze({ enterAtSec: 0.05, holdUntilSec: 12, exitUntilSec: 12 }),
  }),
  'starlink-visible': Object.freeze({
    'edge-number': Object.freeze({ enterAtSec: 0.3, holdUntilSec: 5.25, exitUntilSec: 6.15 }),
    caption: Object.freeze({ enterAtSec: 0.15, holdUntilSec: 8.75, exitUntilSec: 8.95 }),
  }),
  'oneweb-visible': Object.freeze({
    'edge-number': Object.freeze({ enterAtSec: 0.3, holdUntilSec: 5.25, exitUntilSec: 6.15 }),
    caption: Object.freeze({ enterAtSec: 0.15, holdUntilSec: 8.75, exitUntilSec: 8.95 }),
  }),
  'stable-finale': Object.freeze({
    'finale-copy': Object.freeze({ enterAtSec: 0.2, holdUntilSec: 6.1, exitUntilSec: 6.2 }),
    replay: Object.freeze({ enterAtSec: 0.7, holdUntilSec: 6.1, exitUntilSec: 6.2 }),
  }),
});

function chromePhaseAt(elapsedSec: number, timing: GlobalConstellationChromeTiming | undefined): GlobalConstellationChromePhase {
  if (timing === undefined || elapsedSec < timing.enterAtSec || elapsedSec >= timing.exitUntilSec) return 'hidden';
  if (elapsedSec < timing.enterAtSec + Math.min(0.55, Math.max(0.16, (timing.holdUntilSec - timing.enterAtSec) * 0.18))) return 'enter';
  if (elapsedSec < timing.holdUntilSec) return 'hold';
  return 'exit';
}

export function globalConstellationChromeState(
  beatId: GlobalConstellationBeatId,
  elapsedSec: number,
): readonly GlobalConstellationChromeState[] {
  const timing = GLOBAL_CONSTELLATION_CHROME_TIMINGS[beatId];
  return (Object.keys(timing) as GlobalConstellationChromeId[]).map(id => {
    const phase = globalConstellationChromePhase(beatId, id, elapsedSec);
    return Object.freeze({ id, phase, visible: phase !== 'hidden' });
  });
}

export function globalConstellationChromePhase(
  beatId: GlobalConstellationBeatId,
  id: GlobalConstellationChromeId,
  elapsedSec: number,
): GlobalConstellationChromePhase {
  return chromePhaseAt(elapsedSec, GLOBAL_CONSTELLATION_CHROME_TIMINGS[beatId][id]);
}

/**
 * The opening constellation is visible immediately; the first beat identifies
 * the satellite points. Beat 3 is an explicit manual-switch pause;
 * beat 5 retains the local NTPU reveal action before visibility is shown.
 */
export const GLOBAL_CONSTELLATION_BEATS: readonly GlobalConstellationBeat[] = Object.freeze([
  {
    id: 'earth-question', order: 1, durationSec: 6, camera: 'earth-wide',
    eyebrow: '01 · 建立 LEO 全球尺度',
    // The opening beat must state this act's objective (compare Starlink and
    // OneWeb's global distribution, then read NTPU visible-satellite counts)
    // before the point-meaning explanation, per
    // validate-teaching-reset-browser.ts's assertGlobalFirstFrameAndNtpU.
    caption: [
      '接下來比較 Starlink 與 OneWeb 的全球分布，並在 NTPU 判讀可見衛星數。',
      '畫面上的每個亮點，代表一筆封存 TLE 經 SGP4 推算的衛星位置。',
    ],
    primaryCue: 'earth-only-question',
    focusTarget: 'global-earth',
  },
  {
    id: 'starlink-density', order: 2, durationSec: 8, camera: 'starlink-close',
    eyebrow: '02 · 讀取 Starlink 全球數量',
    caption: ['Starlink：封存快照中有 10,714 顆完成 SGP4 定位。', '極區空白受軌道傾角限制；密度帶是點位重疊，不是實體環。'],
    primaryCue: 'starlink-density-cloud',
    focusTarget: 'global-earth',
  },
  {
    id: 'oneweb-compare', order: 3, durationSec: 8, camera: 'compare-wide',
    eyebrow: '03 · 暫停並切換至 OneWeb',
    caption: ['OneWeb：封存快照記錄 651 顆成功定位。', '切換完成後，在相同尺度下分別讀取數量與高度。'],
    primaryCue: 'oneweb-density-compare',
    focusTarget: 'global-earth',
  },
  {
    id: 'height-cross-section', order: 4, durationSec: 8, camera: 'height-oblique',
    eyebrow: '04 · 讀取軌道高度',
    caption: ['數量與高度是兩個不同觀察量。', '同心參考環標示中位高度，不代表所有衛星位於同一軌道面。'],
    primaryCue: 'median-height-guides',
    focusTarget: 'global-earth',
  },
  {
    id: 'ntpu-reveal', order: 5, durationSec: 12, camera: 'ntpu-approach',
    eyebrow: '05 · 判定 NTPU 幾何可見性',
    // Names the archived propagation source (封存 TLE / SGP4, already stated in
    // GLOBAL_CONSTELLATION_NTPU_GEOMETRY_CHAIN and data-truth-boundary) and the
    // geometric-visibility-is-not-service boundary (already established
    // phrasing in ContactWindowLabRoute's own conclusion boundary) beside the
    // formula, per validate-teaching-reset-browser.ts's NTPU reveal assertions.
    caption: [
      '依封存 TLE 經 SGP4 推算 2026-09-09 12:00 UTC，判定幾何可見。',
      'NTPU：α = atan2(U, √(E²+N²)) ≥ 10° 為幾何可見性，非服務覆蓋。',
    ],
    primaryCue: 'ntpu-reveal-control',
    focusTarget: 'ntpu-local',
  },
  {
    id: 'starlink-visible', order: 6, durationSec: 9, camera: 'starlink-visibility',
    eyebrow: '06 · Starlink：NTPU 幾何可見性',
    caption: ['Starlink：單一封存時刻，仰角 α ≥ 10°：157 / 10,714 顆。', '時間：2026-09-09 12:00 UTC；這是幾何觀測門檻，不代表服務覆蓋。'],
    primaryCue: 'starlink-horizon-mask',
    focusTarget: 'ntpu-local',
  },
  {
    id: 'oneweb-visible', order: 7, durationSec: 9, camera: 'oneweb-visibility',
    eyebrow: '07 · OneWeb：NTPU 幾何可見性',
    caption: ['OneWeb：單一封存時刻，仰角 α ≥ 10°：18 / 651 顆。', '時間：2026-09-09 12:00 UTC；這是幾何觀測門檻，不代表服務覆蓋。'],
    primaryCue: 'oneweb-horizon-mask',
    focusTarget: 'ntpu-local',
  },
  {
    id: 'stable-finale', order: 8, durationSec: 6, camera: 'synthesis',
    eyebrow: '08 · 保留封存結果',
    caption: ['同一封存時刻，三個不同視角。', '右側場景導覽全程可用；也可從頭重新播放。'],
    primaryCue: 'stable-replay',
    focusTarget: 'global-earth',
  },
]);

export const GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC = GLOBAL_CONSTELLATION_BEATS.reduce(
  (sum, beat) => sum + beat.durationSec,
  0,
);

export const GLOBAL_CONSTELLATION_FACTS = Object.freeze({
  instantUtc: VISUAL_LAB_GLOBAL_CONSTELLATION_INSTANT_UTC,
  worldFrame: VISUAL_LAB_GLOBAL_CONSTELLATION_WORLD_FRAME,
  earthRadiusKm: VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM,
  earthRadiusWorld: VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD,
  starlink: Object.freeze({
    constellation: 'starlink' as const,
    label: 'Starlink',
    count: 10_714,
    ntpuHorizonVisible: 450,
    ntpuVisibleAtMinimumElevation: 157,
    medianAltitudeKm: 479.368,
    snapshotPath: '/tle-archive/starlink/starlink_20260908.tle',
    snapshotSha256: '5882d160c127e8669b25cc621a7940b2b1bda4e133999f141980ecee28a2d92d',
  }),
  oneweb: Object.freeze({
    constellation: 'oneweb' as const,
    label: 'OneWeb',
    count: 651,
    ntpuHorizonVisible: 37,
    ntpuVisibleAtMinimumElevation: 18,
    medianAltitudeKm: 1212.105,
    snapshotPath: '/tle-archive/oneweb/oneweb_20260908.tle',
    snapshotSha256: '04c542d83db02cc0d9cbfd50b261404f3788b581f92888b1216f86a7a8f7f464',
  }),
});

/**
 * Beat 3 is the manual compare checkpoint.  The checkpoint is the start of
 * `oneweb-compare`, so the learner can switch the displayed constellation
 * before the director resumes the sequence.
 */
export const GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC = GLOBAL_CONSTELLATION_BEATS
  .slice(0, 2)
  .reduce((sum, beat) => sum + beat.durationSec, 0);

/**
 * Resolve the single cloud shown by a beat.  The compare beat is deliberately
 * one-at-a-time: selecting OneWeb does not make Starlink and OneWeb appear as
 * a simultaneous comparison.  The later visibility beats remain explicit and
 * deterministic regardless of the selected compare state.
 */
export function globalConstellationDisplayedConstellation(
  beatId: GlobalConstellationBeatId,
  selected: GlobalConstellationSelectableConstellation,
): GlobalConstellationDisplayedConstellation {
  switch (beatId) {
    case 'earth-question':
    case 'starlink-density':
    case 'starlink-visible':
      return 'starlink';
    case 'oneweb-compare':
    case 'height-cross-section':
    case 'ntpu-reveal':
    case 'stable-finale':
      return selected;
    case 'oneweb-visible':
      return 'oneweb';
    default:
      return 'none';
  }
}

export interface GlobalConstellationPlayRequest {
  readonly nextCourseTimeSec: number;
  readonly shouldPlay: boolean;
  readonly restarted: boolean;
}

/**
 * Keep play/pause deterministic at the end of the authored flow and at the
 * existing NTPU reveal checkpoint.  The manual constellation switch is a
 * separate state owned by the runtime; this helper only resolves transport
 * intent and therefore cannot silently switch a source.
 */
export function resolveGlobalConstellationPlayRequest(
  currentTimeSec: number,
  interactionRevealed: boolean,
): GlobalConstellationPlayRequest {
  const safeCurrentTimeSec = Number.isFinite(currentTimeSec)
    ? Math.max(0, Math.min(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, currentTimeSec))
    : 0;

  if (safeCurrentTimeSec >= GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC) {
    return Object.freeze({ nextCourseTimeSec: 0, shouldPlay: true, restarted: true });
  }

  if (
    !interactionRevealed
    && safeCurrentTimeSec >= GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC
  ) {
    return Object.freeze({
      nextCourseTimeSec: GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC,
      shouldPlay: false,
      restarted: false,
    });
  }

  return Object.freeze({ nextCourseTimeSec: safeCurrentTimeSec, shouldPlay: true, restarted: false });
}

export function globalConstellationBeatIndex(value: string | null): number | null {
  if (value === null) return null;
  const index = GLOBAL_CONSTELLATION_BEATS.findIndex(beat => beat.id === value);
  return index < 0 ? null : index;
}

export function globalConstellationBeatAt(index: number): GlobalConstellationBeat {
  const beat = GLOBAL_CONSTELLATION_BEATS[index];
  if (beat === undefined) throw new RangeError(`unknown global constellation beat index ${index}`);
  return beat;
}

/** World-space shell radius for a median altitude guide. */
export function medianAltitudeGuideRadiusWorld(medianAltitudeKm: number): number {
  return GLOBAL_CONSTELLATION_FACTS.earthRadiusWorld
    * (1 + medianAltitudeKm / GLOBAL_CONSTELLATION_FACTS.earthRadiusKm);
}

export const GLOBAL_CONSTELLATION_PLAYBACK_SPEEDS = Object.freeze([0.5, 1, 1.5, 2] as const);
export type GlobalConstellationPlaybackSpeed = (typeof GLOBAL_CONSTELLATION_PLAYBACK_SPEEDS)[number];

export interface GlobalConstellationTimeResolution {
  readonly courseTimeSec: number;
  readonly beatIndex: number;
  readonly beat: GlobalConstellationBeat;
  readonly beatElapsedSec: number;
  readonly beatProgress: number;
}

/**
 * Resolves any continuous course time in the authored duration to the active beat,
 * its beat-local elapsed offset, and the beat progress [0, 1].
 */
export function courseTimeToBeat(courseTimeSec: number): GlobalConstellationTimeResolution {
  const clampedTime = Math.max(0, Math.min(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, courseTimeSec));
  let accumulated = 0;
  for (let i = 0; i < GLOBAL_CONSTELLATION_BEATS.length; i += 1) {
    const beat = GLOBAL_CONSTELLATION_BEATS[i]!;
    const nextAccumulated = accumulated + beat.durationSec;
    if (clampedTime < nextAccumulated || i === GLOBAL_CONSTELLATION_BEATS.length - 1) {
      const beatElapsedSec = Math.max(0, Math.min(beat.durationSec, clampedTime - accumulated));
      const beatProgress = beat.durationSec > 0 ? beatElapsedSec / beat.durationSec : 1;
      return Object.freeze({
        courseTimeSec: clampedTime,
        beatIndex: i,
        beat,
        beatElapsedSec,
        beatProgress,
      });
    }
    accumulated = nextAccumulated;
  }
  const lastBeat = GLOBAL_CONSTELLATION_BEATS[GLOBAL_CONSTELLATION_BEATS.length - 1]!;
  return Object.freeze({
    courseTimeSec: GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC,
    beatIndex: GLOBAL_CONSTELLATION_BEATS.length - 1,
    beat: lastBeat,
    beatElapsedSec: lastBeat.durationSec,
    beatProgress: 1,
  });
}

/**
 * Converts a beat index and optional beat-local elapsed seconds to total course time.
 */
export function beatToCourseTime(beatIndex: number, beatElapsedSec = 0): number {
  const safeIndex = Math.max(0, Math.min(GLOBAL_CONSTELLATION_BEATS.length - 1, beatIndex));
  let accumulated = 0;
  for (let i = 0; i < safeIndex; i += 1) {
    accumulated += GLOBAL_CONSTELLATION_BEATS[i]!.durationSec;
  }
  const targetBeat = GLOBAL_CONSTELLATION_BEATS[safeIndex]!;
  const clampedElapsed = Math.max(0, Math.min(targetBeat.durationSec, beatElapsedSec));
  return Math.min(GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC, accumulated + clampedElapsed);
}

/**
 * Review routes open on a paused, readable frame instead of the first hidden
 * compositor instant.  Natural autoplay still starts at course time zero.
 */
export const GLOBAL_CONSTELLATION_REVIEW_FRAME_OFFSET_SEC = 1;

export function globalConstellationReviewFrameCourseTime(beatIndex: number): number {
  const safeIndex = Math.max(0, Math.min(GLOBAL_CONSTELLATION_BEATS.length - 1, beatIndex));
  const beat = GLOBAL_CONSTELLATION_BEATS[safeIndex]!;
  return beatToCourseTime(safeIndex, Math.min(GLOBAL_CONSTELLATION_REVIEW_FRAME_OFFSET_SEC, beat.durationSec));
}

/**
 * Natural playback stops on the same fully readable frame used by a direct
 * review URL.  The learner therefore sees the NTPU prompt, then owns the next
 * transition by activating Display.  A seek to the exact end boundary (or any
 * later beat) remains an explicit reconstruction of the completed state.
 */
export const GLOBAL_CONSTELLATION_NTPU_REVEAL_BEAT_INDEX = 4;
export const GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC = beatToCourseTime(
  GLOBAL_CONSTELLATION_NTPU_REVEAL_BEAT_INDEX,
  GLOBAL_CONSTELLATION_BEATS[GLOBAL_CONSTELLATION_NTPU_REVEAL_BEAT_INDEX]!.durationSec,
);
export const GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC =
  globalConstellationReviewFrameCourseTime(GLOBAL_CONSTELLATION_NTPU_REVEAL_BEAT_INDEX);

export type GlobalConstellationInteractionState = 'awaiting-reveal' | 'completed';

/**
 * Seeking/replaying before the NTPU beat boundary always restores the pending
 * learner action.  The result is deterministic and independent of prior state.
 */
export function globalConstellationInteractionStateForCourseTime(
  courseTimeSec: number,
): GlobalConstellationInteractionState {
  return Number.isFinite(courseTimeSec) && courseTimeSec >= GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC
    ? 'completed'
    : 'awaiting-reveal';
}
