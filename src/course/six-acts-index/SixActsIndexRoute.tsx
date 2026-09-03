import type { ReactElement } from 'react';

import { SIX_ACTS_VISIBLE_ROUTES } from '../nav/sixActsRoutes';
import { SixActsNav } from '../nav/SixActsNav';
import { isSixActsLightCaptureMode, sixActsHref } from '../nav/lightCapture';
import './SixActsIndexRoute.scss';

const INDEX_QUESTIONS: Readonly<Record<string, string>> = Object.freeze({
  act1: '星座規模與 NTPU 當下可見數量如何由資料與幾何計算？',
  act2: '衛星位置如何由星曆資料推算，並形成通聯預測？',
  act3: '離軸角與仰角有何差異？波束指向如何影響離軸角與天線增益？',
  act4: 'Starlink 服務衛星離開可見範圍時，系統如何選定換手目標？',
});

/**
 * The currently released teaching-experiment running order.
 *
 * The proposal's line is one story told by zooming in: constellation → one
 * satellite's orbital record → one link's geometry → one system's handover.
 * Each experiment ends on a question the NEXT one
 * answers, so this page shows the bridges, not just the links.
 */

export function SixActsIndexRoute(): ReactElement {
  const lightCapture = isSixActsLightCaptureMode();
  return (
    <main className="six-acts" lang="zh-Hant" data-theme={lightCapture ? 'light-capture' : undefined}>
      <SixActsNav currentHref="/course/six-acts" />
      <header className="six-acts__header six-acts__header--overview">
        <div className="six-acts__header-copy">
          <p className="six-acts__kicker">低軌衛星通信模擬</p>
          <h1>從全球星座到衛星服務換手</h1>
          <p className="six-acts__lede">
            以同一組衛星與地面站資料，依序分析可見性、星曆推算、鏈路幾何與服務決策。
          </p>
        </div>
        <aside className="six-acts__summary" aria-label="分析層次">
          <p className="six-acts__summary-label">分析層次</p>
          <p className="six-acts__summary-flow">
            <span>資料</span><b aria-hidden="true">→</b><span>位置</span><b aria-hidden="true">→</b><span>幾何</span><b aria-hidden="true">→</b><span>服務</span>
          </p>
          <p className="six-acts__summary-note">四幕共用同一資料快照與時間狀態。</p>
        </aside>
      </header>

      <ol className="six-acts__list">
        {SIX_ACTS_VISIBLE_ROUTES.map(act => (
          <li key={act.id}>
            <a className="six-acts__card" href={sixActsHref(act.href, lightCapture)}>
              <span className="six-acts__order">{act.actLabel}</span>
              <div>
                <h2>{act.titleZhHant}<em>{act.minutesZhHant} min</em></h2>
                <p className="six-acts__question">
                  {INDEX_QUESTIONS[act.id] ?? act.questionZhHant}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ol>

    </main>
  );
}
