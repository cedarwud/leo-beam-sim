import { useState, type ReactElement } from 'react';

import { SIX_ACTS_INDEX_HREF, SIX_ACTS_ROUTES } from './sixActsRoutes';
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
        <span aria-hidden="true">◎</span> 六幕教學
      </button>

      {!open ? null : (
        <div className="six-acts-launcher__menu" role="menu">
          <a href={SIX_ACTS_INDEX_HREF} className="six-acts-launcher__index" role="menuitem">
            <strong>動線總覽</strong>
            <small>六幕順序與彼此的橋接</small>
          </a>
          <ol>
            {SIX_ACTS_ROUTES.map(entry => (
              <li key={entry.id}>
                <a href={entry.href} role="menuitem">
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
            六幕頁面各自保留閱讀動線；Act 3／4 會以首頁 handover preset 進入同一段教學動畫。
          </p>
        </div>
      )}
    </div>
  );
}
