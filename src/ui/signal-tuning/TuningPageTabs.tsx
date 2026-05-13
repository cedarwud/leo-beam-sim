import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import { TUNING_PAGES } from './tuningConfig';
import type { TuningPageKey } from './types';

export function TuningPageTabs({
  activePage,
  onChange,
}: {
  activePage: TuningPageKey;
  onChange: (page: TuningPageKey) => void;
}) {
  return (
    <div
      data-testid="tuning-page-tabs"
      role="tablist"
      aria-label="Tuning pages"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridAutoRows: 44,
        height: 54,
        gap: 6,
        padding: 4,
        borderRadius: activePage === 'sinr-formula'
          ? `${UI_TOKENS.radius.lg}px ${UI_TOKENS.radius.lg}px 0 0`
          : UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.soft}`,
        borderBottomColor: activePage === 'sinr-formula'
          ? 'rgba(218,244,255,0.08)'
          : UI_TOKENS.color.border.soft,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {TUNING_PAGES.map(page => {
        const active = page.key === activePage;
        return (
          <button
            id={`tuning-page-tab-${page.key}`}
            className={`${UI_CLASSES.button} ${UI_CLASSES.tab}`}
            key={page.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`tuning-page-panel-${page.key}`}
            title={page.subtitle}
            onClick={() => onChange(page.key)}
            style={{
              cursor: 'pointer',
              height: 44,
              minHeight: 44,
              padding: '8px 10px',
              borderRadius: UI_TOKENS.radius.md,
              border: active ? '1px solid rgba(118, 234, 215, 0.44)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: active ? 'rgba(118, 234, 215, 0.14)' : UI_TOKENS.color.surface.cardSubtle,
              color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
              display: 'grid',
              textAlign: 'left',
              alignItems: 'center',
              lineHeight: 1.12,
              boxSizing: 'border-box',
            }}
          >
            <span style={{
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.heavy,
              lineHeight: 1.12,
            }}>
              {page.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
