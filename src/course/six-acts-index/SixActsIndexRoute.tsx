import type { ReactElement } from 'react';

import { SIX_ACTS_ROUTES } from '../nav/sixActsRoutes';
import { SixActsNav } from '../nav/SixActsNav';
import './SixActsIndexRoute.scss';

/**
 * The six-acts running order.
 *
 * The proposal's line is one story told by zooming in: constellation → one
 * satellite's orbital record → one link's geometry → one system's handover →
 * one experiment → one record. Each act ends on a question the NEXT one
 * answers, so this page shows the bridges, not just the links.
 */

export function SixActsIndexRoute(): ReactElement {
  return (
    <main className="six-acts" lang="zh-Hant">
      <SixActsNav currentHref="/course/six-acts" />
      <header className="six-acts__header">
        <p className="six-acts__kicker">LEO 六幕教學動線</p>
        <h1>從一顆地球，到一份實驗紀錄</h1>
        <p className="six-acts__lede">
          整條動線只講一個故事：<strong>衛星飛得太快，網路必須一直做決定；每個決定都有能量代價。</strong>
          鏡頭一路拉近——星座 → 一顆衛星的軌道資料 → 一條鏈路的幾何 → 一個系統的換手 → 一個實驗 → 一份紀錄。
        </p>
      </header>

      <ol className="six-acts__list">
        {SIX_ACTS_ROUTES.map(act => (
          <li key={act.id}>
            <a className="six-acts__card" href={act.href}>
              <span className="six-acts__order">{act.actLabel}</span>
              <div>
                <h2>{act.titleZhHant}<em>{act.minutesZhHant} min</em></h2>
                <p className="six-acts__question">{act.questionZhHant}</p>
                <p className="six-acts__handson">{act.handsOnZhHant}</p>
              </div>
            </a>
            {act.bridgeZhHant === null
              ? null
              : <p className="six-acts__bridge"><span>橋接</span>{act.bridgeZhHant}</p>}
          </li>
        ))}
      </ol>

      <footer className="six-acts__footer">
        <p>
          資料一律來自封存 TLE 與 SGP4，數值口徑分四種徽章：
          <b>CANONICAL</b>（符號權威）、<b>DEMO</b>（課堂調校值）、
          <b>COURSE-ASSUMPTION</b>（敘事需要、引擎不產出）、<b>實作層</b>（工程量、非公開公式項）。
          畫面上出現哪一種，就標哪一種。
        </p>
      </footer>
    </main>
  );
}
