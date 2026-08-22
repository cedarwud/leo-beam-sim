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
    questionZhHant: '衛星的位置，最原始的來源長什麼樣子？',
    handsOnZhHant: '看這三行字。整顆衛星未來幾天的位置，全部從這裡算出來。',
    provenance: 'SOURCE' as const,
  }),
  Object.freeze({
    id: 'column-walk' as const,
    order: 2,
    titleZhHant: '逐欄解讀',
    questionZhHant: '這 69 個字元裡，哪些數字有意義？',
    handsOnZhHant: '滑過每一欄看它是什麼；再改壞一位數字，看最後一欄的檢核碼怎麼抓到你。',
    provenance: 'SOURCE' as const,
  }),
  Object.freeze({
    id: 'sgp4-contract' as const,
    order: 3,
    titleZhHant: 'SGP4 黑盒子',
    questionZhHant: '從三行文字，怎麼變成天上的一個位置？',
    handsOnZhHant: '拖時鐘。輸入是（TLE, 時間），輸出是位置與速度——這一站只教契約，不教推導。',
    provenance: 'MODEL-DERIVED' as const,
  }),
  Object.freeze({
    id: 'ntpu-pass' as const,
    order: 4,
    titleZhHant: '從 NTPU 看它',
    questionZhHant: '站在地面上，這顆衛星什麼時候在你頭上？',
    handsOnZhHant: '拖出一次通過：升起 → 最高點 → 落下。讀讀看一次通過有多久。',
    provenance: 'MODEL-DERIVED' as const,
  }),
  Object.freeze({
    id: 'simulator-fuel' as const,
    order: 5,
    titleZhHant: '成為模擬器燃料',
    questionZhHant: '這些位置接下來要拿去做什麼？',
    handsOnZhHant: '按下去，這顆衛星就進入後面幾幕的模擬器。',
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
  '學生一律用封存快照。講師若要示範「現場抓一次」，走終端機／腳本——瀏覽器直接抓 CelesTrak 會撞 CORS，而且它的群組查詢有快取與流量政策。';
