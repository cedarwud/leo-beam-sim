import { useId, useState } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { SIMULATOR_CONSTELLATIONS } from '../../simulator/types';
import { CanonicalSourceControls } from './CanonicalSourceControls';
import { txBi } from './labels';
import { captionTextStyle, groupTitleStyle } from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

function constellationLabel(value: string): string {
  return SIMULATOR_CONSTELLATIONS.find(option => option.id === value)?.label ?? value;
}

function formatAppliedTaipeiInstant(value: string | undefined): string {
  if (value === undefined) return '—';
  return value.slice(0, 19).replace('T', ' ');
}

/**
 * Compact source context for the analysis rail.
 *
 * Orbit-data selection is source provenance, not a fifth scientific projection. Keep
 * it visible as one-line context and disclose the full selector only on demand
 * so the four analysis tabs remain the primary navigation.
 */
export function TleScenarioDisclosure({
  analysis,
}: {
  readonly analysis: HomepageCanonicalAnalysisState;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const acceptedConstellation = analysis.frame?.provenance.constellation;
  const sourceName = acceptedConstellation === undefined
    ? constellationLabel(analysis.requestedConstellation)
    : constellationLabel(acceptedConstellation);
  const appliedInstant = formatAppliedTaipeiInstant(analysis.frame?.instantTaipei);
  const status = analysis.status === 'loading'
    ? say('homepage.source.summary.loading', '正在計算', 'Calculating')
    : null;

  return (
    <section
      data-testid="homepage-tle-scenario-disclosure"
      data-tle-archive-date={analysis.frame?.tleState.archiveDate ?? ''}
      data-applied-instant-taipei={analysis.frame?.instantTaipei ?? ''}
      style={{
        display: 'grid',
        gap: open ? 10 : 0,
        padding: 10,
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={groupTitleStyle}>{say('homepage.source.summary.title', '衛星軌道資料', 'Satellite orbit data')}</div>
          <div style={{ ...captionTextStyle, marginTop: 3, overflowWrap: 'anywhere' }}>
            <strong style={{ color: UI_TOKENS.color.text.primary }}>{sourceName}</strong>
            {' · '}{say('homepage.source.summary.appliedTime', '模擬時間', 'Simulation time')} {appliedInstant}
            {status === null ? null : (
              <span role="status" aria-live="polite">{' · '}{status}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`leo-ui-button leo-tle-scenario-toggle${open ? ' leo-tle-scenario-toggle--open' : ''}`}
          data-testid="homepage-tle-scenario-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(current => !current)}
          style={{
            minHeight: 34,
            padding: '6px 9px',
            borderRadius: UI_TOKENS.radius.md,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontWeight: UI_TOKENS.type.weight.strong,
          }}
        >
          {open
            ? say('homepage.source.summary.collapse', '收合', 'Collapse')
            : say('homepage.source.summary.configure', '設定', 'Configure')}
          {open ? ' ▴' : ' ▾'}
        </button>
      </div>

      {open && (
        <div id={panelId} data-testid="homepage-tle-scenario-expanded">
          <CanonicalSourceControls analysis={analysis} />
        </div>
      )}
    </section>
  );
}
