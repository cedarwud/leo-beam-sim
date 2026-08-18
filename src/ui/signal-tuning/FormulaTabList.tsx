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
 * Secondary tab strip: one button per term of the SINR expression.
 *
 * The buttons carry ONLY the notation. The plain-language name and the
 * one-line description moved to the button's `title` (and to the "?" inside
 * each tab body) — on a narrow rail, seven captioned buttons read as a wall of
 * words above the formula they are supposed to index. The `aria-label` still
 * speaks the full name, so nothing is lost to a screen reader, and the hidden
 * canonical span still names the group for the provenance gates.
 */
export function FormulaTabList({
  activeTab,
  appMode,
  onChange,
}: {
  activeTab: TuningTabKey;
  appMode: AppExperienceMode;
  onChange: (tab: TuningTabKey) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  // `appMode` remains in the public prop for callers and validation fixtures;
  // topology is now a peer main tab, so this formula-term strip has no mode
  // gate of its own.
  void appMode;
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
      aria-label={txBi(t, isEnglish, 'tab.sub.ariaLabel', 'SINR 公式各項參數', 'SINR parameter groups')}
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
        // Keep all four groups visible in one row. σ² is a compact scalar, so
        // give the three link terms the space needed for indexed notation.
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) minmax(40px, 0.45fr)',
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
                height: 46,
                minHeight: 46,
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
              {/* Notation never wraps: a symbol broken across two lines reads as
                  two terms, and the 46px chip clips the second line. */}
              <span style={{ ...formulaTextStyle, fontSize: 22, color: accent, lineHeight: 1.04, whiteSpace: 'nowrap' }}>
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
        discoverable while the user-facing strip presents one effective-channel
        tab instead of separate H / G^T / receiver tabs.
      */}
      <div aria-hidden="true" style={srOnlyStyle}>
        {(['loss', 'beam', 'receiver-gain'] as const).map(tab => (
          <span key={tab} id={`sinr-formula-tab-${tab}`} />
        ))}
      </div>
    </div>
  );
}
