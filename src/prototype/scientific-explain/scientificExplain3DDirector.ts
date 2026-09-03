/**
 * Director contract, timeline beats, spatial geometry, and state reconstruction
 * for the visual-first off-axis angle 3D teaching lab.
 */

export type ScientificExplain3DBeatId =
  | 'establish'
  | 'perspective-side'
  | 'perspective-top'
  | 'perspective-oblique'
  | 'interaction'
  | 'comparison'
  | 'formula-reveal';

export const SCIENTIFIC_EXPLAIN_3D_BEAT_IDS: readonly ScientificExplain3DBeatId[] = Object.freeze([
  'establish',
  'perspective-side',
  'perspective-top',
  'perspective-oblique',
  'interaction',
  'comparison',
  'formula-reveal',
]);

export type CameraPresetName =
  | 'wide-oblique'
  | 'side-view'
  | 'top-view'
  | 'oblique-return'
  | 'interactive-oblique'
  | 'comparison-view'
  | 'formula-view';

export interface CameraPoseConfig {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
}

export const CAMERA_POSES: Readonly<Record<CameraPresetName, CameraPoseConfig>> = Object.freeze({
  'wide-oblique': {
    position: [6.2, 5.0, 7.0],
    target: [0, 1.65, 0],
    fov: 38,
  },
  'side-view': {
    position: [7.8, 2.4, 0.1],
    target: [0, 1.65, 0],
    fov: 38,
  },
  'top-view': {
    position: [0.1, 8.6, 0.1],
    target: [0, 0.5, 0],
    fov: 36,
  },
  'oblique-return': {
    position: [5.6, 4.2, 5.6],
    target: [0, 1.65, 0],
    fov: 38,
  },
  'interactive-oblique': {
    position: [5.6, 4.0, 6.0],
    target: [0, 1.65, 0],
    fov: 38,
  },
  'comparison-view': {
    position: [6.0, 4.4, 6.4],
    target: [0, 1.65, 0],
    fov: 38,
  },
  'formula-view': {
    position: [5.8, 4.2, 6.0],
    target: [0, 1.65, 0],
    fov: 38,
  },
});

export interface ScientificExplain3DBeat {
  readonly id: ScientificExplain3DBeatId;
  readonly order: number;
  readonly startSec: number;
  readonly durationSec: number;
  readonly camera: CameraPresetName;
  readonly eyebrow: string;
  readonly title: string;
  readonly caption: readonly [string, string?];
  readonly primaryCue: string;
  readonly isCameraOnlyMotion: boolean;
  readonly isInteractive: boolean;
  readonly isComparison: boolean;
  readonly isFormulaRevealed: boolean;
}

export const SCIENTIFIC_EXPLAIN_3D_BEATS: readonly ScientificExplain3DBeat[] = Object.freeze([
  {
    id: 'establish',
    order: 1,
    startSec: 0,
    durationSec: 12,
    camera: 'wide-oblique',
    eyebrow: '01 · 空間基準',
    title: '建立衛星與地面幾何',
    caption: [
      '建立衛星、地面用戶與波束指向。',
      '黃色虛線是波束中心指向，實線是衛星至用戶的視線。',
    ],
    primaryCue: 'establish',
    isCameraOnlyMotion: false,
    isInteractive: false,
    isComparison: false,
    isFormulaRevealed: false,
  },
  {
    id: 'perspective-side',
    order: 2,
    startSec: 12,
    durationSec: 8,
    camera: 'side-view',
    eyebrow: '02 · 視角無關',
    title: '側面視角：幾何不變',
    caption: [
      '切換至側面視角。',
      '視角改變不影響空間幾何：仰角 α 與離軸角 θ 數值完全不變。',
    ],
    primaryCue: 'camera-invariance',
    isCameraOnlyMotion: true,
    isInteractive: false,
    isComparison: false,
    isFormulaRevealed: false,
  },
  {
    id: 'perspective-top',
    order: 3,
    startSec: 20,
    durationSec: 8,
    camera: 'top-view',
    eyebrow: '02 · 視角無關',
    title: '俯視視角：幾何不變',
    caption: [
      '切換至俯視軌道視角。',
      '旋轉鏡頭只改變觀察方向，不會改變天線射頻物理夾角。',
    ],
    primaryCue: 'camera-invariance',
    isCameraOnlyMotion: true,
    isInteractive: false,
    isComparison: false,
    isFormulaRevealed: false,
  },
  {
    id: 'perspective-oblique',
    order: 4,
    startSec: 28,
    durationSec: 8,
    camera: 'oblique-return',
    eyebrow: '02 · 視角無關',
    title: '斜視角：幾何不變',
    caption: [
      '鏡頭回到斜視角。',
      '驗證結論：改變鏡頭視角絕不是改變離軸角。',
    ],
    primaryCue: 'camera-invariance',
    isCameraOnlyMotion: true,
    isInteractive: false,
    isComparison: false,
    isFormulaRevealed: false,
  },
  {
    id: 'interaction',
    order: 5,
    startSec: 36,
    durationSec: 16,
    camera: 'interactive-oblique',
    eyebrow: '03 · 互動檢驗',
    title: '轉動波束中心指向',
    caption: [
      '現在由你控制：轉動波束中心指向。',
      '觀察離軸角 θ 與天線增益同步改變，而地面仰角 α 依然保持固定。',
    ],
    primaryCue: 'beam-steering',
    isCameraOnlyMotion: false,
    isInteractive: true,
    isComparison: false,
    isFormulaRevealed: false,
  },
  {
    id: 'comparison',
    order: 6,
    startSec: 52,
    durationSec: 12,
    camera: 'comparison-view',
    eyebrow: '04 · 關鍵對比',
    title: '核心對比：相機轉動 vs 波束轉向',
    caption: [
      '核心對比：相機轉動 vs 波束轉向。',
      '離軸角 θ 是波束中心與用戶視線的夾角，不是仰角 α，也不是相機視角。',
    ],
    primaryCue: 'comparison-split',
    isCameraOnlyMotion: false,
    isInteractive: false,
    isComparison: true,
    isFormulaRevealed: false,
  },
  {
    id: 'formula-reveal',
    order: 7,
    startSec: 64,
    durationSec: 11,
    camera: 'formula-view',
    eyebrow: '05 · 公式呈現',
    title: '現象確立後，公式自然成立',
    caption: [
      '幾何現象清楚後，公式自然成立。',
      '點擊檢視抽屜可展開完整推導與數值對照。',
    ],
    primaryCue: 'formula-reveal',
    isCameraOnlyMotion: false,
    isInteractive: false,
    isComparison: false,
    isFormulaRevealed: true,
  },
]);

export const EPISODE_TOTAL_DURATION_SEC = SCIENTIFIC_EXPLAIN_3D_BEATS.reduce(
  (sum, beat) => sum + beat.durationSec,
  0,
);

export const INTERACTION_CHECKPOINT_TIME_SEC = 36;
export const DETERMINISTIC_RECONSTRUCTED_STEER_THETA_DEG = 4.2;
export const BASELINE_THETA_DEG = 2.4;

// Physical Scene Geometry Constants
export const SATELLITE_POSITION: readonly [number, number, number] = Object.freeze([0, 4.35, 0]);
export const UE_GROUND_POSITION: readonly [number, number, number] = Object.freeze([2.2, 0.1, 0.5]);

/**
 * Computes the elevation angle (degrees) between ground horizontal and user line-of-sight.
 * In a local flat/tangent scene: alpha = atan2(sat_y - ue_y, horizontal_dist)
 */
export function calculateElevationDeg(
  satPos: readonly [number, number, number] = SATELLITE_POSITION,
  uePos: readonly [number, number, number] = UE_GROUND_POSITION,
): number {
  const dy = satPos[1] - uePos[1];
  const dx = satPos[0] - uePos[0];
  const dz = satPos[2] - uePos[2];
  const horizontalDist = Math.hypot(dx, dz);
  if (horizontalDist <= 1e-9) return 90;
  return Math.atan2(dy, horizontalDist) * (180 / Math.PI);
}

export const FIXED_ELEVATION_DEG = calculateElevationDeg();

/**
 * Computes the unit vector from satellite to ground UE.
 */
function getLosUnitVector(
  satPos: readonly [number, number, number] = SATELLITE_POSITION,
  uePos: readonly [number, number, number] = UE_GROUND_POSITION,
): [number, number, number] {
  const dx = uePos[0] - satPos[0];
  const dy = uePos[1] - satPos[1];
  const dz = uePos[2] - satPos[2];
  const len = Math.hypot(dx, dy, dz);
  return [dx / len, dy / len, dz / len];
}

/**
 * Computes the 3D boresight unit vector rotated by thetaDeg relative to the LOS vector.
 */
export function calculateBoresightUnitVector(
  thetaDeg: number,
  satPos: readonly [number, number, number] = SATELLITE_POSITION,
  uePos: readonly [number, number, number] = UE_GROUND_POSITION,
): [number, number, number] {
  const [ux, uy, uz] = getLosUnitVector(satPos, uePos);
  // Orthogonal vector in the horizontal plane: [-uz, 0, ux] normalized
  const hLen = Math.hypot(-uz, ux);
  const nx = -uz / hLen;
  const ny = 0;
  const nz = ux / hLen;

  const thetaRad = thetaDeg * (Math.PI / 180);
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);

  const bx = cosT * ux + sinT * nx;
  const by = cosT * uy + sinT * ny;
  const bz = cosT * uz + sinT * nz;
  const bLen = Math.hypot(bx, by, bz);
  return [bx / bLen, by / bLen, bz / bLen];
}

/**
 * Computes the 3D boresight ground center position for a given theta (degrees).
 */
export function calculateBoresightGroundCenter(
  thetaDeg: number,
  satPos: readonly [number, number, number] = SATELLITE_POSITION,
  uePos: readonly [number, number, number] = UE_GROUND_POSITION,
): readonly [number, number, number] {
  const [bx, by, bz] = calculateBoresightUnitVector(thetaDeg, satPos, uePos);
  if (Math.abs(by) <= 1e-6) {
    return [satPos[0] + bx * 10, 0, satPos[2] + bz * 10];
  }
  const t = -satPos[1] / by;
  return [satPos[0] + bx * t, 0, satPos[2] + bz * t];
}

/**
 * Calculates off-axis angle theta (degrees) between boresight vector and satellite-to-UE LOS vector.
 */
export function calculateOffAxisAngleDeg(
  boresightGroundCenter: readonly [number, number, number],
  satPos: readonly [number, number, number] = SATELLITE_POSITION,
  uePos: readonly [number, number, number] = UE_GROUND_POSITION,
): number {
  const bX = boresightGroundCenter[0] - satPos[0];
  const bY = boresightGroundCenter[1] - satPos[1];
  const bZ = boresightGroundCenter[2] - satPos[2];

  const uX = uePos[0] - satPos[0];
  const uY = uePos[1] - satPos[1];
  const uZ = uePos[2] - satPos[2];

  const bLen = Math.hypot(bX, bY, bZ);
  const uLen = Math.hypot(uX, uY, uZ);

  if (bLen <= 1e-9 || uLen <= 1e-9) return 0;

  const dot = (bX * uX + bY * uY + bZ * uZ) / (bLen * uLen);
  const clampedDot = Math.max(-1, Math.min(1, dot));
  return Math.acos(clampedDot) * (180 / Math.PI);
}

/**
 * Computes the normalized antenna transmit gain ratio G(theta) / G0
 * and decibel gain G_dB(theta) = 10 * log10(G/G0) using the accepted exponential beam model.
 */
export function calculateAntennaGain(thetaDeg: number): {
  readonly gainRatio: number;
  readonly gainDb: number;
} {
  const boundedTheta = Math.max(0, thetaDeg);
  const gainRatio = Math.exp(-0.18 * boundedTheta * boundedTheta);
  const gainDb = 10 * Math.log10(Math.max(gainRatio, 1e-9));
  return {
    gainRatio,
    gainDb,
  };
}

export interface TimeResolution {
  readonly currentTimeSec: number;
  readonly beatIndex: number;
  readonly beat: ScientificExplain3DBeat;
  readonly beatElapsedSec: number;
  readonly beatProgress: number;
}

/**
 * Resolves any continuous course time to active beat and progress.
 */
export function resolveTimeToBeat(currentTimeSec: number): TimeResolution {
  const clamped = Math.max(0, Math.min(EPISODE_TOTAL_DURATION_SEC, currentTimeSec));
  let accumulated = 0;
  for (let i = 0; i < SCIENTIFIC_EXPLAIN_3D_BEATS.length; i += 1) {
    const beat = SCIENTIFIC_EXPLAIN_3D_BEATS[i];
    const nextAccumulated = accumulated + beat.durationSec;
    if (clamped < nextAccumulated || i === SCIENTIFIC_EXPLAIN_3D_BEATS.length - 1) {
      const beatElapsedSec = Math.max(0, Math.min(beat.durationSec, clamped - accumulated));
      const beatProgress = beat.durationSec > 0 ? beatElapsedSec / beat.durationSec : 1;
      return {
        currentTimeSec: clamped,
        beatIndex: i,
        beat,
        beatElapsedSec,
        beatProgress,
      };
    }
    accumulated = nextAccumulated;
  }
  const lastBeat = SCIENTIFIC_EXPLAIN_3D_BEATS[SCIENTIFIC_EXPLAIN_3D_BEATS.length - 1];
  return {
    currentTimeSec: EPISODE_TOTAL_DURATION_SEC,
    beatIndex: SCIENTIFIC_EXPLAIN_3D_BEATS.length - 1,
    beat: lastBeat,
    beatElapsedSec: lastBeat.durationSec,
    beatProgress: 1,
  };
}

/**
 * Maps a beat ID string to its corresponding beat index (or null if not found).
 */
export function findBeatIndexById(beatId: string | null): number | null {
  if (!beatId) return null;
  const index = SCIENTIFIC_EXPLAIN_3D_BEATS.findIndex(b => b.id === beatId);
  return index >= 0 ? index : null;
}

/**
 * Returns review frame course time for a beat index.
 */
export function reviewFrameCourseTime(beatIndex: number): number {
  const beat = SCIENTIFIC_EXPLAIN_3D_BEATS[Math.max(0, Math.min(SCIENTIFIC_EXPLAIN_3D_BEATS.length - 1, beatIndex))];
  return beat.startSec + Math.min(2, beat.durationSec * 0.25);
}
