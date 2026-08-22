/**
 * The one registry of six-acts teaching routes.
 *
 * The running order, the nav strip on every act, and the homepage entry all
 * read this. A second list would drift, and this session has already produced
 * two "same fact, two numbers" bugs from exactly that.
 */

export interface SixActsRouteEntry {
  readonly id: string;
  /** Acts sharing a page share an order label; null for the index itself. */
  readonly actLabel: string | null;
  readonly href: string;
  readonly titleZhHant: string;
  readonly questionZhHant: string;
  readonly handsOnZhHant: string;
  readonly minutesZhHant: string;
  /** The question this act leaves for the next one, or null at the end. */
  readonly bridgeZhHant: string | null;
}

export const SIX_ACTS_INDEX_HREF = '/course/six-acts';
export const SIX_ACTS_HANDOVER_PRESET_HREF = '/?teaching=1&preset=handover';

export const SIX_ACTS_ROUTES: readonly SixActsRouteEntry[] = Object.freeze([
  Object.freeze({
    id: 'act1',
    actLabel: '1',
    href: '/prototype/global-constellation',
    titleZhHant: '全球星座',
    questionZhHant: '星座包含多少衛星？兩份資料為何相差 16 倍？',
    handsOnZhHant: '分析衛星數量、切換殼層篩選、拖曳時間軸、檢視 NTPU 可見圓錐',
    minutesZhHant: '12–15',
    bridgeZhHant: '同一顆衛星僅在觀測點上空停留數分鐘。這些位置由何種模型計算？',
  }),
  Object.freeze({
    id: 'act2',
    actLabel: '2',
    href: '/course/tle-journey',
    titleZhHant: 'TLE 之旅',
    questionZhHant: '衛星位置是誰算出來的？',
    handsOnZhHant: '逐欄解讀 69 個字元、改壞數字看檢核碼、拖出一次通過',
    minutesZhHant: '20–25',
    bridgeZhHant: '知道位置還不夠——訊號從幾百公里外打下來，夠不夠、準不準，取決於幾何。',
  }),
  Object.freeze({
    id: 'act3',
    actLabel: '3',
    href: SIX_ACTS_HANDOVER_PRESET_HREF,
    titleZhHant: '離軸角實驗室',
    questionZhHant: '離軸角與仰角有何差異？角度如何影響功率？',
    handsOnZhHant: '切換教學視角、調整波束中軸、觀察 θ = 3 dB 邊界',
    minutesZhHant: '15–20',
    bridgeZhHant: '即使只有一顆衛星與一個 UE，鏈路已涉及多項幾何量；當整個星座運動時，系統必須即時決定是否換手及其目標。',
  }),
  Object.freeze({
    id: 'act4',
    actLabel: '4',
    href: SIX_ACTS_HANDOVER_PRESET_HREF,
    titleZhHant: '換手劇場',
    questionZhHant: '為何換手？何時換？換給誰？為何有時「被迫」換？',
    handsOnZhHant: '走六個 Phase、在條件成立那一秒自動暫停、讀換手收據',
    minutesZhHant: '22–25',
    bridgeZhHant: '每張收據都對應能量成本。接著進行正式節能實驗，先建立可檢驗的預測。',
  }),
  Object.freeze({
    id: 'act56',
    actLabel: '5·6',
    href: '/course/energy-lab',
    titleZhHant: '節能實驗與平台記錄',
    questionZhHant: '降低發射功率是否必然提升能源效率？量測結果如何形成可追溯證據？',
    handsOnZhHant: '提出可檢驗預測、掃描功率形成曲線、選取欄位建立上傳台帳',
    minutesZhHant: '30–35',
    bridgeZhHant: null,
  }),
]);

export function sixActsRouteFor(href: string): SixActsRouteEntry | null {
  return SIX_ACTS_ROUTES.find(entry => entry.href === href) ?? null;
}

function firstRouteIndexFor(href: string): number {
  return SIX_ACTS_ROUTES.findIndex(entry => entry.href === href);
}

function lastRouteIndexFor(href: string): number {
  for (let index = SIX_ACTS_ROUTES.length - 1; index >= 0; index -= 1) {
    if (SIX_ACTS_ROUTES[index]!.href === href) return index;
  }
  return -1;
}

/** The next act, for the "continue" affordance at the end of a page. */
export function nextSixActsRoute(href: string): SixActsRouteEntry | null {
  // Acts 3 and 4 are one homepage surface. Once on that surface, continue
  // after the last alias so the same href cannot loop back to Act 4 forever.
  const index = lastRouteIndexFor(href);
  if (index === -1 || index === SIX_ACTS_ROUTES.length - 1) return null;
  return SIX_ACTS_ROUTES[index + 1]!;
}

export function previousSixActsRoute(href: string): SixActsRouteEntry | null {
  const index = firstRouteIndexFor(href);
  if (index <= 0) return null;
  return SIX_ACTS_ROUTES[index - 1]!;
}
