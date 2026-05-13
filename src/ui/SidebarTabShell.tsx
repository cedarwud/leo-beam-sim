import type { ReactNode } from 'react';
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

  return (
    <section className="leo-sidebar-tab-shell" data-sidebar-side={side} aria-label={label}>
      <div className="leo-sidebar-tab-list" role="tablist" aria-label={`${label} tabs`}>
        {tabs.map(tab => {
          const selected = tab.key === activeKey;
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
              onClick={() => onChange(tab.key)}
            >
              <span>{tab.label}</span>
              <small>{tab.description}</small>
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        className="leo-sidebar-tab-panel"
        role="tabpanel"
        aria-labelledby={`${side}-sidebar-tab-${activeTab.key}`}
      >
        {children}
      </div>
    </section>
  );
}
