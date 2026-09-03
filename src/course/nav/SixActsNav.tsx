import type { ReactElement } from 'react';

import {
  SIX_ACTS_INDEX_HREF,
  SIX_ACTS_ROUTES,
  SIX_ACTS_VISIBLE_ROUTES,
  nextSixActsRoute,
  previousSixActsRoute,
} from './sixActsRoutes';
import { sixActsHref } from './lightCapture';
import './SixActsNav.scss';

/**
 * The strip every act carries.
 *
 * A lecturer must be able to jump anywhere mid-class without going back to an
 * index first, and a student following along needs to know where they are. So
 * every act is always one click away, and so is the homepage.
 */

export function SixActsNav({
  currentHref,
  variant = 'strip',
}: {
  readonly currentHref: string;
  readonly variant?: 'strip' | 'stage';
}): ReactElement {
  const previous = previousSixActsRoute(currentHref);
  const next = nextSixActsRoute(currentHref);

  return (
    <nav
      className={`six-acts-nav ${variant === 'stage' ? 'is-stage' : 'is-strip'}`}
      aria-label={variant === 'stage' ? '切換教學實驗' : '教學實驗動線'}
      data-testid={variant === 'stage' ? 'six-acts-stage-nav' : undefined}
      data-stage-occluder={variant === 'stage' ? 'true' : undefined}
    >
      {variant === 'strip' ? <>
        <a className="six-acts-nav__home" href="/" title="回首頁模擬器">
          <span aria-hidden="true">←</span> 首頁
        </a>
        <a className="six-acts-nav__index" href={sixActsHref(SIX_ACTS_INDEX_HREF)}>動線</a>
      </> : null}

      {variant === 'stage' ? (
        <a className="six-acts-nav__stage-home" href="/" aria-label="回首頁" title="回首頁模擬器">
          <span aria-hidden="true">⌂</span>
        </a>
      ) : null}

      <ol className="six-acts-nav__acts">
        {SIX_ACTS_VISIBLE_ROUTES.map(entry => {
          const current = entry.href === currentHref;
          return (
            <li key={entry.id}>
              <a
                href={sixActsHref(entry.href)}
                className={current ? 'is-current' : ''}
                aria-current={current ? 'page' : undefined}
                aria-label={`第 ${entry.actLabel} 幕：${entry.titleZhHant}`}
                title={entry.questionZhHant}
              >
                <em>{entry.actLabel}</em>
                <span>{entry.titleZhHant}</span>
              </a>
            </li>
          );
        })}
      </ol>

      {variant === 'strip' ? <div className="six-acts-nav__step">
        {previous === null
          ? null
          : <a href={sixActsHref(previous.href)} title={previous.titleZhHant}>← 上一幕</a>}
        {next === null
          ? null
          : <a href={sixActsHref(next.href)} className="is-next" title={next.titleZhHant}>下一幕 →</a>}
      </div> : null}
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
      <a href={sixActsHref(next.href)}>
        接下去：{next.actLabel} · {next.titleZhHant} <span aria-hidden="true">→</span>
      </a>
    </aside>
  );
}
