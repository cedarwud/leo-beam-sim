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
    questionZhHant: '天上有多少衛星？為什麼兩家差 16 倍？',
    handsOnZhHant: '猜數量、切殼層濾鏡、拖時間軸、看 NTPU 可見圓錐',
    minutesZhHant: '12–15',
    bridgeZhHant: '同一顆衛星只在你頭上停留幾分鐘。這些點的位置是誰算出來的？',
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
    questionZhHant: '離軸角和仰角差在哪？角度怎麼變成功率？',
    handsOnZhHant: '三鏡頭連切、撥波束中軸、把 θ 調到剛好掉 3 dB',
    minutesZhHant: '15–20',
    bridgeZhHant: '一顆衛星對一支手機已經這麼多事。整個星座一起動，系統要在幾秒內回答：換不換？換給誰？',
  }),
  Object.freeze({
    id: 'act4',
    actLabel: '4',
    href: SIX_ACTS_HANDOVER_PRESET_HREF,
    titleZhHant: '換手劇場',
    questionZhHant: '為何換手？何時換？換給誰？為何有時「被迫」換？',
    handsOnZhHant: '走六個 Phase、在條件成立那一秒自動暫停、讀換手收據',
    minutesZhHant: '22–25',
    bridgeZhHant: '每張收據都是能量。我們來做一個正式的節能實驗——先從一個你八成會答錯的問題開始。',
  }),
  Object.freeze({
    id: 'act56',
    actLabel: '5·6',
    href: '/course/energy-lab',
    titleZhHant: '節能實驗與平台記錄',
    questionZhHant: '「調小功率＝省電」是真的嗎？量到的東西怎麼留下證據？',
    handsOnZhHant: '押預測、掃功率長出曲線、勾欄位走上傳台帳',
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
