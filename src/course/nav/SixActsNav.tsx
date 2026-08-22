import type { ReactElement } from 'react';

import {
  SIX_ACTS_INDEX_HREF,
  SIX_ACTS_ROUTES,
  nextSixActsRoute,
  previousSixActsRoute,
} from './sixActsRoutes';
import './SixActsNav.scss';

/**
 * The strip every act carries.
 *
 * A lecturer must be able to jump anywhere mid-class without going back to an
 * index first, and a student following along needs to know where they are. So
 * every act is always one click away, and so is the homepage.
 */

export function SixActsNav({ currentHref }: { readonly currentHref: string }): ReactElement {
  const previous = previousSixActsRoute(currentHref);
  const next = nextSixActsRoute(currentHref);

  return (
    <nav className="six-acts-nav" aria-label="六幕教學動線">
      <a className="six-acts-nav__home" href="/" title="回首頁模擬器">
        <span aria-hidden="true">←</span> 首頁
      </a>
      <a className="six-acts-nav__index" href={SIX_ACTS_INDEX_HREF}>動線</a>

      <ol className="six-acts-nav__acts">
        {SIX_ACTS_ROUTES.map(entry => {
          const current = entry.href === currentHref;
          return (
            <li key={entry.id}>
              <a
                href={entry.href}
                className={current ? 'is-current' : ''}
                aria-current={current ? 'page' : undefined}
                title={entry.questionZhHant}
              >
                <em>{entry.actLabel}</em>
                <span>{entry.titleZhHant}</span>
              </a>
            </li>
          );
        })}
      </ol>

      <div className="six-acts-nav__step">
        {previous === null
          ? null
          : <a href={previous.href} title={previous.titleZhHant}>← 上一幕</a>}
        {next === null
          ? null
          : <a href={next.href} className="is-next" title={next.titleZhHant}>下一幕 →</a>}
      </div>
    </nav>
  );
}

/**
 * The bridge line at the foot of an act.
 *
 * The proposal's structure is that each act ends on a question the next one
 * answers, so the hand-off is part of the teaching, not just navigation.
 */
export function SixActsBridge({ currentHref }: { readonly currentHref: string }): ReactElement | null {
  const entry = SIX_ACTS_ROUTES.find(candidate => candidate.href === currentHref);
  const next = nextSixActsRoute(currentHref);
  if (entry?.bridgeZhHant === undefined || entry.bridgeZhHant === null || next === null) return null;

  return (
    <aside className="six-acts-bridge">
      <p className="six-acts-bridge__line">{entry.bridgeZhHant}</p>
      <a href={next.href}>
        接下去：{next.actLabel} · {next.titleZhHant} <span aria-hidden="true">→</span>
      </a>
    </aside>
  );
}
