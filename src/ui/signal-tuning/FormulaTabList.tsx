import type { KeyboardEvent } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import {
  getFormulaTabAccent,
  getFormulaTabShortLabel,
  TUNING_TABS,
} from './tuningConfig';
import { formulaTextStyle, srOnlyStyle } from './styles';
import type { TuningTabKey } from './types';
import type { AppExperienceMode } from '../appMode';

export function FormulaTabList({
  activeTab,
  appMode,
  onChange,
}: {
  activeTab: TuningTabKey;
  appMode: AppExperienceMode;
  onChange: (tab: TuningTabKey) => void;
}) {
  void appMode;
  // Phase E gate was: tab.key !== 'topology' || appMode === 'sinr-experiment'.
  const visibleTabs = TUNING_TABS;
  const activeIndex = Math.max(visibleTabs.findIndex(tab => tab.key === activeTab), 0);

  const focusFormulaTab = (tab: TuningTabKey) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`sinr-formula-tab-${tab}`)?.focus();
    });
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % visibleTabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleTabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = visibleTabs[nextIndex].key;
    onChange(nextTab);
    focusFormulaTab(nextTab);
  };

  return (
    <div
      data-testid="sinr-formula-tabs"
      role="tablist"
      aria-label="SINR parameter groups"
      aria-orientation="horizontal"
      style={{
        overflowX: 'auto',
        scrollbarGutter: 'stable',
        marginTop: -1,
        padding: 0,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.soft}`,
        borderTop: 0,
        borderRadius: `0 0 ${UI_TOKENS.radius.lg}px ${UI_TOKENS.radius.lg}px`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(64px, 1fr))`,
        gap: 6,
        minWidth: visibleTabs.length > 6 ? 490 : 420,
        padding: '0 4px 4px',
      }}>
        {visibleTabs.map((tab, index) => {
          const active = index === activeIndex;
          const accent = getFormulaTabAccent(tab.key);
          return (
            <button
              id={`sinr-formula-tab-${tab.key}`}
              className={`${UI_CLASSES.button} ${UI_CLASSES.tab}`}
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              title={tab.subtitle}
              onClick={() => onChange(tab.key)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              style={{
                cursor: 'pointer',
                height: 50,
                minHeight: 50,
                padding: '5px 6px',
                borderRadius: UI_TOKENS.radius.md,
                border: active ? `1px solid ${accent}` : `1px solid ${UI_TOKENS.color.border.subtle}`,
                background: active ? `linear-gradient(180deg, ${accent}1f, rgba(6, 18, 28, 0.82))` : UI_TOKENS.color.surface.card,
                color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                boxShadow: active ? `inset 0 -3px 0 ${accent}` : 'inset 0 -2px 0 rgba(218, 244, 255, 0.06)',
                display: 'grid',
                gap: 2,
                alignContent: 'center',
                justifyItems: 'center',
                textAlign: 'center',
                transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <span style={{ ...formulaTextStyle, fontSize: 20, color: accent, lineHeight: 1.04 }}>
                {tab.symbol}
              </span>
              <span style={{
                fontSize: UI_TOKENS.type.size.small,
                fontWeight: UI_TOKENS.type.weight.heavy,
                lineHeight: 1.15,
              }}>
                {getFormulaTabShortLabel(tab.key)}
                {getFormulaTabShortLabel(tab.key) !== tab.title && (
                  <span style={srOnlyStyle}> {tab.title}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
