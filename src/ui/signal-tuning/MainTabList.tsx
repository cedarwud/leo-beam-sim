import type { KeyboardEvent } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { txBi } from './labels';
import type { MainTabKey } from './types';

/**
 * The top-level split of the left panel. The six terms of γ (P_t, H(L), G^T(θ),
 * G^R, I, σ²) are still all there — they just live one level down, inside SINR.
 * Scene topology, which is not a term of γ at all, is a peer tab here instead.
 *
 * On screen each button carries ONLY its short identifier — `SINR`, `EE`,
 * `Policy`, `Scene` — and nothing else. The glyph prefix and the one-line description
 * that used to sit next to it are gone from the visible label: on a narrow rail
 * three three-part captions wrap to four lines each and bury the tabs they are
 * labelling. The full name and the description are still there, in `title` and
 * `aria-label`, so hover and screen readers lose nothing.
 *
 * This is the same rule the formula sub-tab strip follows (notation only on the
 * button, prose behind the "?"), so the two levels read as one system.
 */
const PANEL_ID_BY_TAB: Record<MainTabKey, string> = {
  sinr: 'tuning-page-panel-sinr-formula',
  energy: 'tuning-page-panel-energy',
  handover: 'tuning-page-panel-handover',
  scene: 'tuning-page-panel-scene',
};

export function MainTabList({
  activeTab,
  showHandoverTab = false,
  onChange,
}: {
  activeTab: MainTabKey;
  /** The third topic only exists when the app supplies its controls. */
  showHandoverTab?: boolean;
  onChange: (tab: MainTabKey) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';

  const tabs: ReadonlyArray<{
    key: MainTabKey;
    /** The only thing printed on the button. Deliberately not translated. */
    short: string;
    /** Full localized name. Lives in `title` / `aria-label`, not on screen. */
    label: string;
    hint: string;
    accent: string;
  }> = [
    {
      key: 'sinr',
      short: 'SINR',
      label: t('tab.sinr.label'),
      hint: txBi(t, isEnglish, 'tab.sinr.hint', '訊號功率、干擾與雜訊項', 'Signal power, interference and noise terms'),
      accent: UI_TOKENS.color.semantic.tuning,
    },
    {
      key: 'energy',
      short: 'EE',
      label: t('tab.energy.label'),
      hint: txBi(t, isEnglish, 'tab.energy.hint', '功率鏈與能源效率', 'Power train and energy efficiency'),
      accent: '#c3a6ff',
    },
    ...(showHandoverTab
      ? [{
        key: 'handover' as MainTabKey,
        short: 'Policy',
        label: txBi(t, isEnglish, 'tab.handover.label', '換手判定', 'Handover'),
        hint: txBi(
          t,
          isEnglish,
          'tab.handover.hint',
          '換手偏移門檻與觸發時間',
          'Handover offset margin and trigger time',
        ),
        accent: UI_TOKENS.color.semantic.candidate.accent,
      }]
      : []),
    {
      key: 'scene',
      short: 'Scene',
      label: txBi(t, isEnglish, 'tab.scene.label', '場景設定', 'Scene setup'),
      hint: txBi(
        t,
        isEnglish,
        'tab.scene.hint',
        '衛星數、每顆衛星的波束數與使用者分布；變更後模擬重新開始',
        'Satellite count, beams per satellite and user distribution; changing one restarts the run',
      ),
      accent: UI_TOKENS.color.semantic.fixed,
    },
  ];

  const activeIndex = Math.max(tabs.findIndex(tab => tab.key === activeTab), 0);

  const focusTab = (key: MainTabKey) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`signal-tuning-main-tab-${key}`)?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
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
    const nextTab = tabs[nextIndex].key;
    onChange(nextTab);
    focusTab(nextTab);
  };

  return (
    <div
      data-testid="signal-tuning-main-tabs"
      role="tablist"
      aria-label={txBi(t, isEnglish, 'tab.main.ariaLabel', '左側面板主分頁', 'Left panel main tabs')}
      aria-orientation="horizontal"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        gap: 8,
      }}
    >
      {tabs.map((tab, index) => {
        const active = index === activeIndex;
        return (
          <button
            id={`signal-tuning-main-tab-${tab.key}`}
            key={tab.key}
            className={`${UI_CLASSES.button} ${UI_CLASSES.tab}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={PANEL_ID_BY_TAB[tab.key]}
            tabIndex={active ? 0 : -1}
            // The full name and its one-line description are a tooltip, not
            // visible body text — the button itself carries only `tab.short`.
            title={`${tab.label} — ${tab.hint}`}
            aria-label={`${tab.label} — ${tab.hint}`}
            onClick={() => onChange(tab.key)}
            onKeyDown={event => handleKeyDown(event, index)}
            style={{
              cursor: 'pointer',
              display: 'grid',
              gap: 3,
              // Centred, like the formula sub-tab strip below it: the button is
              // now a single short token, not a label with a caption under it.
              justifyItems: 'center',
              alignContent: 'center',
              textAlign: 'center',
              minHeight: 48,
              padding: '10px 12px',
              borderRadius: UI_TOKENS.radius.lg,
              border: active ? `1px solid ${tab.accent}` : `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: active
                ? `linear-gradient(180deg, ${tab.accent}26, rgba(6, 18, 28, 0.82))`
                : UI_TOKENS.color.surface.cardFaint,
              color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
              boxShadow: active ? `inset 0 -3px 0 ${tab.accent}` : 'none',
              transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease',
              boxSizing: 'border-box',
            }}
          >
            <span style={{
              fontFamily: UI_TOKENS.type.family.math,
              fontSize: UI_TOKENS.type.size.bodyLg,
              fontWeight: UI_TOKENS.type.weight.heavy,
              letterSpacing: 0.6,
              lineHeight: 1.2,
              color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
              whiteSpace: 'nowrap',
            }}>
              {tab.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}
