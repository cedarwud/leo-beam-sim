import type { ReactElement } from 'react';

import {
  clipEntryCanLaunch,
  clipEntryLaunchTarget,
} from './model';
import type {
  VisualLabClipEntryModel,
  VisualLabClipEntryProps,
  VisualLabClipEntryShelfProps,
  VisualLabClipId,
} from './types';
import './VisualLabClipEntry.scss';

const STATUS_LABELS = Object.freeze({
  'zh-Hant': Object.freeze({ available: '可播放', preparing: '可準備', pending: '等待來源', unavailable: '不可用' }),
  en: Object.freeze({ available: 'Ready', preparing: 'Prepare source', pending: 'Waiting for source', unavailable: 'Unavailable' }),
});

const ACTION_LABELS = Object.freeze({
  'zh-Hant': Object.freeze({ select: '選取', launch: '啟動回放', prepare: '準備回放' }),
  en: Object.freeze({ select: 'Select', launch: 'Launch replay', prepare: 'Prepare replay' }),
});

function localized(
  value: { readonly 'zh-Hant': string; readonly en: string },
  locale: 'zh-Hant' | 'en',
): string {
  return value[locale];
}

function entryClasses(
  entry: VisualLabClipEntryModel,
  selected: boolean,
  theme: 'dark' | 'light',
  className?: string,
): string {
  return [
    'vlab-clip-entry',
    `vlab-clip-entry--${theme}`,
    `is-${entry.status}`,
    selected ? 'is-selected' : null,
    className,
  ].filter(Boolean).join(' ');
}

export function VisualLabClipEntry({
  entry,
  selected = false,
  locale = 'zh-Hant',
  theme = 'dark',
  disabled = false,
  busy = false,
  className,
  onSelect,
  onLaunch,
}: VisualLabClipEntryProps): ReactElement {
  const statusLabel = STATUS_LABELS[locale][entry.status];
  const actions = ACTION_LABELS[locale];
  const launchTarget = clipEntryLaunchTarget(entry);
  const launchable = clipEntryCanLaunch(entry);
  const launchDisabled = disabled || busy || !launchable;
  const actionLabel = entry.status === 'preparing' ? actions.prepare : actions.launch;

  return (
    <article
      className={entryClasses(entry, selected, theme, className)}
      data-clip-entry={entry.id}
      data-clip-id={entry.id}
      data-clip-runtime={entry.runtime}
      data-clip-runtime-id={entry.runtimeId ?? 'unavailable'}
      data-clip-status={entry.status}
      data-clip-launchable={launchable ? 'true' : 'false'}
      data-clip-selected={selected ? 'true' : 'false'}
    >
      <button
        type="button"
        className="vlab-clip-entry__select"
        aria-pressed={selected}
        aria-label={`${actions.select}: ${localized(entry.title, locale)}`}
        disabled={disabled || busy}
        data-clip-action="select"
        onClick={() => onSelect(entry.id)}
      >
        <span className="vlab-clip-entry__title-row">
          <span className="vlab-clip-entry__marker" aria-hidden="true" />
          <span className="vlab-clip-entry__title">{localized(entry.title, locale)}</span>
          <span className="vlab-clip-entry__status" data-clip-status-label={entry.status}>{statusLabel}</span>
        </span>
        <span className="vlab-clip-entry__summary">{localized(entry.summary, locale)}</span>
        <span className="vlab-clip-entry__requirement">{localized(entry.requirement, locale)}</span>
        {entry.sourceLabel !== null ? (
          <span className="vlab-clip-entry__source" data-clip-source>{entry.sourceLabel}</span>
        ) : null}
        {entry.status !== 'available' && entry.reason !== null ? (
          <span className="vlab-clip-entry__reason" role="status" data-clip-unavailable-reason>{entry.reason}</span>
        ) : null}
      </button>

      <button
        type="button"
        className="vlab-clip-entry__launch"
        aria-label={`${actionLabel}: ${localized(entry.title, locale)}`}
        aria-disabled={launchDisabled}
        disabled={launchDisabled}
        data-clip-action="launch"
        onClick={() => {
          if (launchTarget !== null) onLaunch(launchTarget);
        }}
      >
        <span aria-hidden="true">{busy ? '…' : '▶'}</span>
        <span>{actionLabel}</span>
      </button>
    </article>
  );
}

export function VisualLabClipEntryShelf({
  entries,
  selectedClipId,
  launchState = 'idle',
  error = null,
  locale = 'zh-Hant',
  theme = 'dark',
  disabled = false,
  className,
  onSelect,
  onLaunch,
}: VisualLabClipEntryShelfProps): ReactElement {
  const busy = launchState === 'launching';
  return (
    <section
      className={['vlab-clip-entry-shelf', `vlab-clip-entry-shelf--${theme}`, className].filter(Boolean).join(' ')}
      aria-label={locale === 'zh-Hant' ? '可用的故事與 A／B 回放' : 'Available story and A/B replays'}
      aria-busy={busy}
      data-clip-shelf
      data-clip-launch-state={launchState}
    >
      <header className="vlab-clip-entry-shelf__header">
        <div>
          <span className="vlab-clip-entry-shelf__eyebrow">{locale === 'zh-Hant' ? '回放入口' : 'Replay entry'}</span>
          <h2>{locale === 'zh-Hant' ? '選擇一段真實回放' : 'Choose a source-backed replay'}</h2>
        </div>
        <span className="vlab-clip-entry-shelf__count" data-clip-entry-count={entries.length}>{entries.length}</span>
      </header>
      {error !== null ? <p className="vlab-clip-entry-shelf__error" role="status" data-clip-launch-error>{error}</p> : null}
      <div className="vlab-clip-entry-shelf__grid" role="list">
        {entries.map(entry => (
          <div key={entry.id} role="listitem">
            <VisualLabClipEntry
              entry={entry}
              selected={entry.id === selectedClipId}
              locale={locale}
              theme={theme}
              disabled={disabled}
              busy={busy && entry.id === selectedClipId}
              onSelect={onSelect}
              onLaunch={onLaunch}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export const ClipEntry = VisualLabClipEntry;
