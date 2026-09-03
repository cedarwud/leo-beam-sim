import type { KeyboardEvent } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { txBi } from './labels';
import {
  getFormulaTabAccent,
  getFormulaTabLabelCopy,
  getFormulaTabShortLabel,
  normalizeTuningTabKey,
  TUNING_TABS,
} from './tuningConfig';
import { formulaTextStyle, srOnlyStyle } from './styles';
import type { TuningTabKey } from './types';
import type { AppExperienceMode } from '../appMode';

/**
 * Secondary tab grid: one button per term of the SINR expression (p, H, Gᵀ, I, σ²).
 *
 * The homepage rail is too narrow for five indexed expressions on one line.
 * A content-sized responsive grid keeps every symbol readable without
 * clipping; the selected tab's body supplies the longer plain-language copy.
 */
export function FormulaTabList({
  activeTab,
  appMode,
  variant = 'default',
  onChange,
}: {
  activeTab: TuningTabKey;
  appMode: AppExperienceMode;
  /** The legacy Walker rail keeps the notation but uses the Visual Lab chip rhythm. */
  variant?: 'default' | 'legacy';
  onChange: (tab: TuningTabKey) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  // `appMode` remains in the public prop for callers and validation fixtures;
  // topology is now a peer main tab, so this formula-term strip has no mode
  // gate of its own.
  void appMode;
  const isLegacy = variant === 'legacy';
  const visibleTabs = TUNING_TABS;
  const normalizedActiveTab = normalizeTuningTabKey(activeTab);
  const activeIndex = Math.max(visibleTabs.findIndex(tab => tab.key === normalizedActiveTab), 0);

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
      aria-label={txBi(t, isEnglish, 'tab.sub.ariaLabel', 'SINR', 'SINR')}
      aria-orientation="horizontal"
      style={{
        padding: 6,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.soft}`,
        borderRadius: UI_TOKENS.radius.lg,
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 138px), 1fr))',
        gridAutoRows: 'minmax(58px, auto)',
        gap: 6,
      }}>
        {visibleTabs.map((tab, index) => {
          const active = index === activeIndex;
          const accent = getFormulaTabAccent(tab.key);
          const copy = getFormulaTabLabelCopy(tab.key);
          const shortLabel = txBi(t, isEnglish, copy.key, copy.zh, copy.en);
          return (
            <button
              id={`sinr-formula-tab-${tab.key}`}
              className={`${UI_CLASSES.button} ${UI_CLASSES.tab}`}
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={shortLabel}
              tabIndex={active ? 0 : -1}
              title={shortLabel}
              onClick={() => onChange(tab.key)}
              onKeyDown={event => handleTabKeyDown(event, index)}
              style={{
                cursor: 'pointer',
                minWidth: 0,
                minHeight: 58,
                padding: isLegacy ? '7px 3px' : '7px 8px',
                borderRadius: UI_TOKENS.radius.md,
                border: active ? `1px solid ${accent}` : `1px solid ${UI_TOKENS.color.border.subtle}`,
                background: active ? `${accent}1f` : UI_TOKENS.color.surface.card,
                color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                boxShadow: active ? `inset 0 -3px 0 ${accent}` : 'none',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 3,
                alignContent: 'center',
                justifyItems: 'start',
                textAlign: 'left',
                transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease',
                boxSizing: 'border-box',
                overflow: 'visible',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  minWidth: 0,
                  color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                  fontSize: 13,
                  fontWeight: UI_TOKENS.type.weight.strong,
                  lineHeight: 1.15,
                }}
              >
                {shortLabel}
              </span>
              {/* A term remains a single mathematical token; the wider grid cell
                  makes wrapping or ellipsis unnecessary. */}
              <span
                data-formula-tab-symbol={tab.key}
                style={{
                  ...formulaTextStyle,
                  display: 'block',
                  maxWidth: '100%',
                  // Keep the mathematical token legible in the narrow Walker
                  // rail while retaining a single-line expression.
                  fontSize: isLegacy ? 20 : 18,
                  color: accent,
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.symbol}
              </span>
              {/* Canonical English term: kept in the DOM so the formula-side
                  provenance gates can still see which group is which, but
                  aria-hidden so a screen reader is not read both languages. */}
              <span aria-hidden="true" style={srOnlyStyle}>
                {shortLabel} {getFormulaTabShortLabel(tab.key)} {tab.title}
              </span>
            </button>
          );
        })}
      </div>
      {/*
        These non-rendered anchors keep old deep-link and provenance selectors
        discoverable for legacy loss and receiver-gain aliases.
      */}
      <div aria-hidden="true" style={srOnlyStyle}>
        {(['loss', 'receiver-gain'] as const).map(tab => (
          <span key={tab} id={`sinr-formula-tab-${tab}`} />
        ))}
      </div>
    </div>
  );
}
