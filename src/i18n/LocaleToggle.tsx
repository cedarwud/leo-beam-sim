import { UI_TOKENS } from '../constants/uiTokens';
import { useLocale } from './LocaleContext';
import type { Locale } from './types';

// Owner call 2026-08-06: label the buttons with the language CODES, not the
// endonym. `中文` was itself Chinese, so a reader who could not read it could
// not find the switch that would fix that.
const OPTIONS: ReadonlyArray<{ value: Locale; label: string }> = [
  { value: 'zh-TW', label: 'zh' },
  { value: 'en', label: 'en' },
];

/**
 * zh | en segmented control (CONTRACT.md §2). Each button is a real
 * `<button>` with a >=44x44 hit area (padding, not just the glyph, carries
 * the size) and a correct `aria-pressed`, so this also satisfies the
 * touch-target rule shared with HelpPopover's `?` trigger.
 */
export function LocaleToggle({ compact = false }: { compact?: boolean } = {}) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      data-testid="locale-toggle"
      role="group"
      aria-label="Language / 語言切換"
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        borderRadius: UI_TOKENS.radius.pill,
        background: UI_TOKENS.color.surface.cardSubtle,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      {OPTIONS.map(option => {
        const isActive = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-testid={`locale-toggle-${option.value}`}
            aria-pressed={isActive}
            onClick={() => setLocale(option.value)}
            style={{
              cursor: 'pointer',
              boxSizing: 'border-box',
              minWidth: compact ? 44 : 56,
              minHeight: 44,
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: UI_TOKENS.radius.pill,
              border: isActive ? `1px solid ${UI_TOKENS.color.border.focus}` : '1px solid transparent',
              background: isActive ? UI_TOKENS.color.surface.fieldSoft : 'transparent',
              color: isActive ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
              fontSize: UI_TOKENS.type.size.caption,
              fontWeight: isActive ? UI_TOKENS.type.weight.heavy : UI_TOKENS.type.weight.strong,
              boxShadow: isActive ? `0 0 0 1px ${UI_TOKENS.color.border.focusShadow}` : 'none',
              touchAction: 'manipulation',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
