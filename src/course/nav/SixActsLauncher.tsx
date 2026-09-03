import { useState, type ReactElement } from 'react';

import { SIX_ACTS_INDEX_HREF, SIX_ACTS_VISIBLE_ROUTES } from './sixActsRoutes';
import { sixActsHref } from './lightCapture';
import './SixActsLauncher.scss';

/**
 * The homepage's way into the teaching line.
 *
 * The homepage is the engineering dashboard and stays that way: this is a
 * collapsed launcher pinned in a corner, not a band across the top. It adds no
 * scene lane, mounts no mesh and touches no render plan — DOM only, so the
 * dashboard's layout and every visual invariant are untouched.
 */

export function SixActsLauncher(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div className={`six-acts-launcher ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="six-acts-launcher__toggle"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true">◎</span> 教學實驗
      </button>

      {!open ? null : (
        <div className="six-acts-launcher__menu" role="menu">
          <a href={sixActsHref(SIX_ACTS_INDEX_HREF)} className="six-acts-launcher__index" role="menuitem">
            <strong>動線總覽</strong>
            <small>目前開放的四個實驗與彼此銜接</small>
          </a>
          <ol>
            {SIX_ACTS_VISIBLE_ROUTES.map(entry => (
              <li key={entry.id}>
                <a href={sixActsHref(entry.href)} role="menuitem">
                  <em>{entry.actLabel}</em>
                  <span>
                    <strong>{entry.titleZhHant}</strong>
                    <small>{entry.questionZhHant}</small>
                  </span>
                </a>
              </li>
            ))}
          </ol>
          <p className="six-acts-launcher__note">
            四個實驗可隨時切換；畫面只在事件發生時呈現當下必要資訊。
          </p>
        </div>
      )}
    </div>
  );
}
