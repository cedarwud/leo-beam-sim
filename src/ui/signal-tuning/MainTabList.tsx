import type { KeyboardEvent } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { txBi } from './labels';
import type { MainTabKey } from './types';

/**
 * The visible top-level split of the left panel. All four tabs project one
 * canonical analysis frame. The legacy direct-P_t, teaching-energy, handover,
 * and topology surfaces remain mounted only as hidden compatibility history
 * inside `SignalTuningPanel`; they are not navigation targets.
 *
 * Each button carries only its short identifier. The full localized name and
 * explanation stay in `title` and `aria-label`, matching the formula sub-tab
 * strip and keeping the narrow rail readable.
 */
const PANEL_ID_BY_TAB: Record<MainTabKey, string> = {
  sinr: 'tuning-page-panel-sinr-canonical',
  energy: 'tuning-page-panel-ee-canonical',
  power: 'tuning-page-panel-power',
  throughput: 'tuning-page-panel-throughput',
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

  // Kept as a source-compatible prop for callers that still pass the old
  // handover slot. It no longer changes navigation: Policy is deliberately
  // not a visible main tab, and its runtime/state/component contract remains
  // in SignalTuningPanel for the Advanced drawer and Walker scene.
  void showHandoverTab;

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
      hint: txBi(t, isEnglish, 'tab.sinr.hint', '同一 P_DL_actual 推導的訊號、干擾與雜訊', 'Signal, interference, and noise derived from one P_DL_actual'),
      accent: UI_TOKENS.color.semantic.tuning,
    },
    {
      key: 'energy',
      short: 'EE',
      label: t('tab.energy.label'),
      hint: txBi(t, isEnglish, 'tab.energy.hint', '同一吞吐量分子與 canonical P_sys 分母', 'Shared throughput numerator and canonical P_sys denominator'),
      accent: '#c3a6ff',
    },
    {
      key: 'power',
      short: 'Power',
      label: txBi(t, isEnglish, 'tab.power.label', '功率', 'Power'),
      hint: txBi(
        t,
        isEnglish,
        'tab.power.hint',
        '調整 beam／satellite 上限與 canonical 功耗參數',
        'Tune beam/satellite caps and canonical power-model inputs',
      ),
      accent: UI_TOKENS.color.semantic.good,
    },
    {
      key: 'throughput',
      short: 'Throughput',
      label: txBi(t, isEnglish, 'tab.throughput.label', '吞吐量', 'Throughput'),
      hint: txBi(
        t,
        isEnglish,
        'tab.throughput.hint',
        '調整服務目標與 beam 頻寬；SINR 與速率保持唯讀',
        'Tune service target and beam bandwidth; SINR and rate remain derived',
      ),
      accent: UI_TOKENS.color.semantic.info,
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
        // The tuning rail is intentionally narrow (~250px). A two-by-two
        // layout keeps all four identifiers readable instead of squeezing
        // "Power" / "Throughput" into clipped single-row cells.
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
              minHeight: 44,
              padding: '8px 4px',
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
              fontSize: UI_TOKENS.type.size.tiny,
              fontWeight: UI_TOKENS.type.weight.heavy,
              letterSpacing: 0.2,
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
