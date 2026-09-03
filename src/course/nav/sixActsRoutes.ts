/**
 * The one registry of six-acts teaching routes.
 *
 * The running order, the nav strip on every act, and the homepage entry all
 * read this. A second list would drift, and this session has already produced
 * two "same fact, two numbers" bugs from exactly that.
 */

import {
  GOLDEN_FLOW_ACT3_HREF,
  GOLDEN_FLOW_ACT4_HREF,
} from '../../prototype/golden-flow/goldenFlowRoutes';

export interface SixActsRouteEntry {
  readonly id: string;
  /** Display order in the six-scene curriculum; null only for a non-act entry. */
  readonly actLabel: string | null;
  readonly href: string;
  readonly titleZhHant: string;
  readonly questionZhHant: string;
  readonly handsOnZhHant: string;
  readonly minutesZhHant: string;
  /** The question this act leaves for the next one, or null at the end. */
  readonly bridgeZhHant: string | null;
  /** Preserve the direct route while withholding an experiment from public navigation. */
  readonly hiddenFromNavigation?: boolean;
}

export const SIX_ACTS_INDEX_HREF = '/course/six-acts';
export const SIX_ACTS_ACT3_HREF = GOLDEN_FLOW_ACT3_HREF;
export const SIX_ACTS_ACT4_HREF = GOLDEN_FLOW_ACT4_HREF;
export const SIX_ACTS_ACT5_HREF = '/course/beam-layout-lab' as const;
export const SIX_ACTS_ACT6_HREF = '/course/frequency-reuse-lab' as const;

export const SIX_ACTS_ROUTES: readonly SixActsRouteEntry[] = Object.freeze([
  Object.freeze({
    id: 'act1',
    actLabel: '1',
    href: '/prototype/global-constellation',
    titleZhHant: '全球星座',
    questionZhHant: '星座規模與 NTPU 當下可見數量，如何由資料與幾何計算？',
    handsOnZhHant: '切換星座、比較軌道高度，並檢視封存 TLE 經 SGP4 推算的 NTPU 幾何可見衛星',
    minutesZhHant: '12–15',
    bridgeZhHant: '同一顆衛星僅在觀測點上空停留數分鐘。這些位置由何種模型計算？',
  }),
  Object.freeze({
    id: 'act2',
    actLabel: '2',
    href: '/course/tle-journey',
    titleZhHant: '星曆與通聯預測',
    questionZhHant: '衛星位置是誰算出來的？',
    handsOnZhHant: '逐欄解讀 69 個字元、修改欄位並觀察檢核失敗，再推演一次通過事件',
    minutesZhHant: '20–25',
    bridgeZhHant: '僅知道衛星位置仍不足以判讀鏈路；數百公里尺度下的接收條件取決於幾何關係。',
  }),
  Object.freeze({
    id: 'act3',
    actLabel: '3',
    href: SIX_ACTS_ACT3_HREF,
    titleZhHant: '離軸角實驗室',
    questionZhHant: '離軸角與仰角有何差異？波束指向如何改變離軸角與天線增益？',
    handsOnZhHant: '固定時間與幾何仰角，只調整波束指向，觀察離軸角與天線增益的關係',
    minutesZhHant: '15–20',
    bridgeZhHant: '即使只有一顆衛星與一個 UE，鏈路已涉及多項幾何量；當整個星座運動時，系統必須即時決定是否換手及其目標。',
  }),
  Object.freeze({
    id: 'act4',
    actLabel: '4',
    href: SIX_ACTS_ACT4_HREF,
    titleZhHant: '衛星服務換手',
    questionZhHant: 'Starlink 服務衛星離開可見範圍時，系統如何選定換手目標？',
    handsOnZhHant: '預設重播 Starlink 的可見性中斷與服務換手；需要時再切換 OneWeb，比較具有門檻與觸發時間（TTT）的換手事件',
    minutesZhHant: '22–25',
    bridgeZhHant: null,
  }),
  Object.freeze({
    id: 'act5',
    actLabel: '5',
    href: SIX_ACTS_ACT5_HREF,
    titleZhHant: '通聯預測導讀',
    questionZhHant: '如何由衛星星曆與最低仰角讀出 AOS、LOS 與通聯時長？',
    handsOnZhHant: '依序觀察 Starlink 仰角曲線、最低仰角門檻、AOS、LOS 與 LOS−AOS 時長',
    minutesZhHant: '8–10',
    bridgeZhHant: '已看懂三個預測結果如何產生；下一幕只改最低仰角，親手完成一次重算與比較。',
    hiddenFromNavigation: true,
  }),
  Object.freeze({
    id: 'act6',
    actLabel: '6',
    href: SIX_ACTS_ACT6_HREF,
    titleZhHant: '通聯預測實作',
    questionZhHant: '最低可通聯仰角改變時，AOS、LOS 與通聯時長如何重新計算？',
    handsOnZhHant: '固定同一筆 Starlink TLE 與 NTPU，只調整最低仰角並執行預測，比較三個核心輸出',
    minutesZhHant: '8–10',
    bridgeZhHant: null,
    hiddenFromNavigation: true,
  }),
]);

/** The currently released teaching sequence. Hidden experiments keep stable direct URLs. */
export const SIX_ACTS_VISIBLE_ROUTES: readonly SixActsRouteEntry[] = Object.freeze(
  SIX_ACTS_ROUTES.filter(entry => entry.hiddenFromNavigation !== true),
);

export function sixActsRouteFor(href: string): SixActsRouteEntry | null {
  return SIX_ACTS_ROUTES.find(entry => entry.href === href) ?? null;
}

function firstRouteIndexFor(href: string): number {
  return SIX_ACTS_VISIBLE_ROUTES.findIndex(entry => entry.href === href);
}

function lastRouteIndexFor(href: string): number {
  for (let index = SIX_ACTS_VISIBLE_ROUTES.length - 1; index >= 0; index -= 1) {
    if (SIX_ACTS_VISIBLE_ROUTES[index]!.href === href) return index;
  }
  return -1;
}

/** The next act, for the "continue" affordance at the end of a page. */
export function nextSixActsRoute(href: string): SixActsRouteEntry | null {
  const index = lastRouteIndexFor(href);
  if (index === -1 || index === SIX_ACTS_VISIBLE_ROUTES.length - 1) return null;
  return SIX_ACTS_VISIBLE_ROUTES[index + 1]!;
}

export function previousSixActsRoute(href: string): SixActsRouteEntry | null {
  const index = firstRouteIndexFor(href);
  if (index <= 0) return null;
  return SIX_ACTS_VISIBLE_ROUTES[index - 1]!;
}
