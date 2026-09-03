import type { KeyboardEvent, ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { LinkInterference, Theta3db } from './FormulaSymbols';
import { txBi } from './labels';
import { formulaTextStyle } from './styles';

export type CanonicalSinrSectionKey =
  | 'power'
  | 'channel'
  | 'beam'
  // Compatibility alias; it is normalized to channel and never rendered.
  | 'receiver'
  | 'interference'
  | 'noise';

const SECTIONS: readonly {
  readonly key: CanonicalSinrSectionKey;
  readonly symbol: ReactNode;
  readonly zh: string;
  readonly en: string;
  readonly accent: string;
}[] = [
  { key: 'power', symbol: <><i>p</i><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>, <Theta3db />)</>, zh: '鏈路功率', en: 'Link power', accent: UI_TOKENS.color.semantic.tuning },
  { key: 'channel', symbol: <>H<sub>u,s,v</sub>(t)</>, zh: '有效通道', en: 'Effective channel', accent: UI_TOKENS.color.semantic.loss },
  { key: 'beam', symbol: <>G<sup>T</sup>(θ<sub>u,s,v</sub>, <Theta3db />)</>, zh: '發射增益', en: 'Transmit gain', accent: UI_TOKENS.color.semantic.beam },
  { key: 'interference', symbol: <LinkInterference />, zh: '同頻干擾', en: 'Interference', accent: '#ff8a6b' },
  { key: 'noise', symbol: <>σ²</>, zh: '背景雜訊', en: 'Noise', accent: UI_TOKENS.color.semantic.noise },
];

export function CanonicalSinrTabList({
  activeSection,
  onChange,
}: {
  readonly activeSection: CanonicalSinrSectionKey;
  readonly onChange: (next: CanonicalSinrSectionKey) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const activeIndex = Math.max(SECTIONS.findIndex(section => section.key === activeSection), 0);

  const focusSection = (key: CanonicalSinrSectionKey) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`canonical-sinr-section-tab-${key}`)?.focus();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % SECTIONS.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + SECTIONS.length) % SECTIONS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = SECTIONS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const key = SECTIONS[nextIndex]!.key;
    onChange(key);
    focusSection(key);
  };

  return (
    <div
      data-testid="canonical-sinr-section-tabs"
      role="tablist"
      aria-label={txBi(t, isEnglish, 'homepage.sinr.sectionTabs', 'SINR 公式項目', 'SINR formula terms')}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
        gap: 6,
        padding: 6,
        borderRadius: UI_TOKENS.radius.lg,
        border: `1px solid ${UI_TOKENS.color.border.soft}`,
        background: UI_TOKENS.color.surface.cardFaint,
      }}
    >
      {SECTIONS.map((section, index) => {
        const active = index === activeIndex;
        const label = isEnglish ? section.en : section.zh;
        return (
          <button
            key={section.key}
            id={`canonical-sinr-section-tab-${section.key}`}
            className={`${UI_CLASSES.button} ${UI_CLASSES.tab}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`canonical-sinr-section-${section.key}`}
            aria-label={label}
            title={label}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(section.key)}
            onKeyDown={event => handleKeyDown(event, index)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              justifyItems: 'start',
              alignContent: 'center',
              gap: 3,
              minWidth: 0,
              minHeight: 62,
              padding: '7px 10px',
              borderRadius: UI_TOKENS.radius.md,
              border: active ? `1px solid ${section.accent}` : `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: active ? `${section.accent}1f` : UI_TOKENS.color.surface.card,
              boxShadow: active ? `inset 0 -3px 0 ${section.accent}` : 'none',
              color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                fontSize: 14,
                fontWeight: UI_TOKENS.type.weight.strong,
                lineHeight: 1.2,
              }}
            >
              {label}
            </span>
            <span style={{ ...formulaTextStyle, maxWidth: '100%', fontSize: 18, lineHeight: 1.25, color: section.accent, whiteSpace: 'nowrap' }}>
              {section.symbol}
            </span>
          </button>
        );
      })}
    </div>
  );
}
