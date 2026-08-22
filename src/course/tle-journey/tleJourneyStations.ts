/**
 * Act 2's five stations.
 *
 * A linear teaching stepper, deliberately NOT a gated course shell: the review
 * round drew the reuse boundary at component level (c120's TLE import and the
 * three-tier source labels, `src/tle`'s SGP4 and pass index) and explicitly
 * excluded c90/c120 stage-gating, sessions and claim gates. This page is a
 * lecture surface, not a challenge track, so a lecturer can jump to any station.
 */

export type TleJourneyStationId =
  | 'raw-record'
  | 'column-walk'
  | 'sgp4-contract'
  | 'ntpu-pass'
  | 'simulator-fuel';

export interface TleJourneyStation {
  readonly id: TleJourneyStationId;
  readonly order: number;
  readonly titleZhHant: string;
  readonly questionZhHant: string;
  readonly handsOnZhHant: string;
  /** Provenance tier shown on the station, following the c120 vocabulary. */
  readonly provenance: 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION';
}

export const TLE_JOURNEY_STATIONS: readonly TleJourneyStation[] = Object.freeze([
  Object.freeze({
    id: 'raw-record' as const,
    order: 1,
    titleZhHant: '拿到原始資料',
    questionZhHant: '衛星位置的原始資料來源如何表示？',
    handsOnZhHant: '讀取這三行資料；該衛星未來數日的位置皆由此計算。',
    provenance: 'SOURCE' as const,
  }),
  Object.freeze({
    id: 'column-walk' as const,
    order: 2,
    titleZhHant: '逐欄解讀',
    questionZhHant: '這 69 個字元裡，哪些數字有意義？',
    handsOnZhHant: '移動游標檢視欄位定義；修改一位數字，觀察檢核碼如何偵測資料變更。',
    provenance: 'SOURCE' as const,
  }),
  Object.freeze({
    id: 'sgp4-contract' as const,
    order: 3,
    titleZhHant: 'SGP4 計算模型',
    questionZhHant: '三行文字如何轉換為衛星位置？',
    handsOnZhHant: '調整時間。輸入為（TLE, 時間），輸出為位置與速度；本節說明介面契約，不展開推導。',
    provenance: 'MODEL-DERIVED' as const,
  }),
  Object.freeze({
    id: 'ntpu-pass' as const,
    order: 4,
    titleZhHant: '從 NTPU 看它',
    questionZhHant: '從地面觀測點看，該衛星何時通過可見區域？',
    handsOnZhHant: '拖曳一次通過：升起 → 最高點 → 落下，讀取通過持續時間。',
    provenance: 'MODEL-DERIVED' as const,
  }),
  Object.freeze({
    id: 'simulator-fuel' as const,
    order: 5,
    titleZhHant: '成為模擬器燃料',
    questionZhHant: '這些位置接下來要拿去做什麼？',
    handsOnZhHant: '確認後，該衛星資料將供後續模擬器使用。',
    provenance: 'MODEL-DERIVED' as const,
  }),
]);

export function tleJourneyStationAt(order: number): TleJourneyStation {
  const station = TLE_JOURNEY_STATIONS.find(candidate => candidate.order === order);
  if (station === undefined) throw new RangeError(`no TLE journey station at order ${order}`);
  return station;
}

/**
 * Students use the bundled snapshot; a live CelesTrak fetch is a terminal demo.
 *
 * A browser fetch to CelesTrak fails CORS, and its group query carries a cache
 * and rate policy a classroom of thirty would trip. Stating that here keeps the
 * page from offering a button that cannot work.
 */
export const TLE_JOURNEY_SOURCE_NOTE_ZH_HANT =
  '學生一律使用封存快照。若需示範即時擷取，請使用終端機／腳本；瀏覽器直接擷取 CelesTrak 受 CORS、快取與流量政策限制。';
