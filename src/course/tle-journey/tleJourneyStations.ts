/**
 * Act 2's five teaching beats.
 *
 * A scene-first animated visual lesson for novice students:
 * 1. Raw Lines -> 2. Field Decode Scanner -> 3. SGP4 Engine -> 4. 3D Orbit -> 5. Observer Elevation & Pass.
 *
 * Retains scientific honesty: uses validated repository SGP4 propagation,
 * explicit TEME -> ECEF -> NTPU topocentric conversions, WGS84 observer coordinates,
 * and an immutable archived Starlink TLE snapshot.
 */

export type TleJourneyStationId =
  | 'raw-record'
  | 'column-walk'
  | 'sgp4-contract'
  | 'satellite-orbit'
  | 'observer-pass';

export interface TleJourneyStation {
  readonly id: TleJourneyStationId;
  readonly order: number;
  readonly beatLabel: string;
  readonly shortTitle: string;
  readonly titleZhHant: string;
  readonly questionZhHant: string;
  readonly handsOnZhHant: string;
  readonly subtitleZhHant: readonly [string, string];
  /** Provenance tier shown on the station, following the c120 vocabulary. */
  readonly provenance: 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION';
}

export const TLE_JOURNEY_STATIONS: readonly TleJourneyStation[] = Object.freeze([
  Object.freeze({
    id: 'raw-record' as const,
    order: 1,
    beatLabel: '第 1 / 5 段',
    shortTitle: '原始代碼',
    titleZhHant: 'Starlink 原始文字代碼',
    questionZhHant: '衛星軌道根數與參考時刻如何以標準文字格式表達？',
    handsOnZhHant: '讀取標準 TLE 文字代碼；SGP4 依據參考時刻軌道根數推算後續幾何位置。',
    subtitleZhHant: [
      'STARLINK-1008（NORAD 44714）：TLE 由兩行固定格式資料組成。',
      '第 1、2 行各有 69 個固定字元位置（包含空白）；第 69 個字元為模 10 檢核碼。',
    ] as const,
    provenance: 'SOURCE' as const,
  }),
  Object.freeze({
    id: 'column-walk' as const,
    order: 2,
    beatLabel: '第 2 / 5 段',
    shortTitle: '欄位解讀',
    titleZhHant: '欄位解讀與檢核防線',
    questionZhHant: '這 69 個固定字元位置中，哪些數值決定幾何運動？',
    handsOnZhHant: '移動游標檢視欄位定義；修改一位數字，觀察檢核碼如何即刻攔截損毀資料。',
    subtitleZhHant: [
      '15.6155 圈/天；週期 92.2 分鐘。',
      '行末模 10 檢核碼 8 / 4；異常即停止載入。',
    ] as const,
    provenance: 'SOURCE' as const,
  }),
  Object.freeze({
    id: 'sgp4-contract' as const,
    order: 3,
    beatLabel: '第 3 / 5 段',
    shortTitle: 'SGP4 引擎',
    titleZhHant: 'SGP4 轉換契約',
    questionZhHant: '文字代碼與目標時間如何轉換為空間狀態？',
    handsOnZhHant: '調整時間 Δt。輸入為（TLE, 時間），輸出為 TEME 慣性座標系狀態向量。',
    subtitleZhHant: [
      'SGP4 將 TLE + Δt 轉成 TEME 向量。',
      '輸出位置與速度；模型推算，不是即時遙測。',
    ] as const,
    provenance: 'MODEL-DERIVED' as const,
  }),
  Object.freeze({
    id: 'satellite-orbit' as const,
    order: 4,
    beatLabel: '第 4 / 5 段',
    shortTitle: '3D 軌道',
    titleZhHant: '3D 座標轉換與軌道幾何',
    questionZhHant: '衛星狀態如何從慣性座標投影至三維地固視圖？',
    handsOnZhHant: '觀察衛星依序經 TEME → GMST → ECEF 幾何轉換，投射於三維地球視圖。',
    subtitleZhHant: [
      '起點記為 t₀；經過一個軌道週期 T ≈ 92.2 分鐘後，得到終點 t₀ + T。',
      '這段時間地球自轉約 23.30°。ECEF 固定在地球上，因此終點比起點向西約 23.30°、相距約 2,594 km，兩個地面位置不會重合。',
    ] as const,
    provenance: 'MODEL-DERIVED' as const,
  }),
  Object.freeze({
    id: 'observer-pass' as const,
    order: 5,
    beatLabel: '第 5 / 5 段',
    shortTitle: '地面通過',
    titleZhHant: 'NTPU 地面仰角與通過曲線',
    questionZhHant: '從地面站視角，幾何通過曲線如何呈現？',
    handsOnZhHant: '拖曳通過時刻：進入 10° 仰角門檻 → 最高點 → 離開門檻，觀察這筆封存 TLE 的本次幾何通過。',
    subtitleZhHant: [
      '這筆封存 TLE 經 SGP4 推算：本次仰角 ≥ 10° 約 6.2 分鐘；峰值仰角 82.5°。',
      '曲線只描述 NTPU 與衛星的幾何關係，不代表通訊服務狀態。',
    ] as const,
    provenance: 'MODEL-DERIVED' as const,
  }),
]);

export function tleJourneyStationAt(order: number): TleJourneyStation {
  const station = TLE_JOURNEY_STATIONS.find(candidate => candidate.order === order);
  if (station === undefined) throw new RangeError(`no TLE journey station at order ${order}`);
  return station;
}

/**
 * Pinned teaching record for Act 2.
 * Real snapshot from public/tle-archive/starlink/starlink_20260824.tle.
 */
export const SAMPLE_TLE = Object.freeze({
  name: 'STARLINK-1008',
  line1: '1 44714U 19074B   26236.60522982  .00078599  00000+0  89669-3 0  9992',
  line2: '2 44714  53.1483  98.4192 0004695  79.4604 280.6939 15.61546781374862',
  sourcePath: '/tle-archive/starlink/starlink_20260824.tle',
  catalogId: '44714',
  constellation: 'Starlink',
  nominalAltitudeKm: 384,
  archiveDate: '20260824',
  contentDigest: '5028f55b',
});

/**
 * The course uses the bundled snapshot; a live CelesTrak fetch is a terminal demo.
 */
export const TLE_JOURNEY_SOURCE_NOTE_ZH_HANT =
  '本課程採用封存快照；若需示範即時擷取，請使用終端機或腳本。瀏覽器直接擷取 CelesTrak 受跨來源、快取與流量政策限制。';
