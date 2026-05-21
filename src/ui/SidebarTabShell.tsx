import type { KeyboardEvent, ReactNode } from 'react';
import { UI_CLASSES } from '../constants/uiTokens';

export interface SidebarTabItem<T extends string> {
  readonly key: T;
  readonly label: string;
  readonly description: string;
}

interface SidebarTabShellProps<T extends string> {
  readonly label: string;
  readonly side: 'left' | 'right';
  readonly tabs: readonly SidebarTabItem<T>[];
  readonly activeKey: T;
  readonly onChange: (key: T) => void;
  readonly children: ReactNode;
}

export function SidebarTabShell<T extends string>({
  label,
  side,
  tabs,
  activeKey,
  onChange,
  children,
}: SidebarTabShellProps<T>) {
  const activeTab = tabs.find(tab => tab.key === activeKey) ?? tabs[0];
  const panelId = `${side}-sidebar-tab-panel`;
  const activeIndex = Math.max(tabs.findIndex(tab => tab.key === activeTab.key), 0);
  const showTabList = tabs.length > 1;

  const focusTab = (key: T) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`${side}-sidebar-tab-${key}`)?.focus();
    });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextKey = tabs[nextIndex].key;
    onChange(nextKey);
    focusTab(nextKey);
  };

  return (
    <section
      className="leo-sidebar-tab-shell"
      data-sidebar-side={side}
      data-tab-list-visible={showTabList ? 'true' : 'false'}
      data-tab-count={tabs.length}
      aria-label={label}
    >
      {showTabList && (
        <div className="leo-sidebar-tab-list" role="tablist" aria-label={`${label} tabs`} aria-orientation="horizontal">
          {tabs.map((tab, index) => {
            const selected = index === activeIndex;
            return (
              <button
                key={tab.key}
                id={`${side}-sidebar-tab-${tab.key}`}
                className={`${UI_CLASSES.tab} leo-sidebar-tab-button`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                data-active={selected ? 'true' : 'false'}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tab.key)}
                onKeyDown={event => handleTabKeyDown(event, index)}
              >
                <span>{tab.label}</span>
                <small>{tab.description}</small>
              </button>
            );
          })}
        </div>
      )}

      <div
        id={panelId}
        className="leo-sidebar-tab-panel"
        role="tabpanel"
        aria-labelledby={showTabList ? `${side}-sidebar-tab-${activeTab.key}` : undefined}
        aria-label={showTabList ? undefined : activeTab.label}
      >
        {children}
      </div>
    </section>
  );
}
