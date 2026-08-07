import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { Profile } from '../../profiles/types';
import { formatDbi } from './formatters';
import { txBi } from './labels';
import {
  compactSummaryStyle,
  explanatoryTextStyle,
  srOnlyStyle,
} from './styles';

function getOverviewProfileLabel(profile: Profile): string {
  switch (profile.id) {
    case 'hobs-2024-candidate-rich':
      return 'Candidate-rich demo profile';
    case 'hobs-2024-paper-default':
      return 'Default simulator profile';
    case 'hobs-2024-tr38811-research':
      return 'TR 38.811 sensitivity profile';
    case 'hobs-2024-mobile-demo-aircraft':
      return 'Aircraft mobility demo profile';
    default:
      return profile.id;
  }
}

function getOverviewFormulaLabel(profile: Profile): string {
  switch (profile.formulaFamily) {
    case 'hobs-legacy':
      return 'Legacy SINR model';
    case 'hobs-tr38811':
      return 'TR 38.811 path-loss model';
  }
}

export function SinrOverview({
  baseProfile,
  receiverGainDbi,
}: {
  baseProfile: Profile;
  receiverGainDbi: number;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';

  return (
    <details
      open
      data-testid="sinr-overview-disclosure"
      data-prominence="primary-context"
      style={{
        display: 'grid',
        gap: 10,
        padding: '10px 11px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'rgba(118, 234, 215, 0.13)',
        border: '1px solid rgba(118, 234, 215, 0.30)',
        color: UI_TOKENS.color.text.secondary,
      }}
    >
      <summary style={{
        ...compactSummaryStyle,
        color: UI_TOKENS.color.semantic.tuning,
        letterSpacing: 0.6,
      }}>
        {txBi(t, isEnglish, 'section.sinrOverview.title', '本次模擬組態', 'Current run configuration')}
        {/* Canonical heading kept for validate:phase9h, hidden from screen readers. */}
        <span aria-hidden="true" style={srOnlyStyle}> SINR overview</span>
      </summary>
      {/*
        Everything this block used to draw is gone from the screen.

        The γ expression was a second copy of the one the tab already opens on;
        the signal/noise term split was a third; the reset button moved up to
        that same `FormulaHeader`, next to the formula it resets. What is left is
        the run's provenance line — which profile and which formula family — plus
        the canonical English headings the provenance gates match on.

        The whole component is rendered inside an `aria-hidden`, visually-hidden
        wrapper by `SignalTuningPanel`, so this is DOM for the gates, not UI.
      */}
      <div style={{ display: 'grid', gap: 12, paddingTop: 10 }}>
        <div style={explanatoryTextStyle}>
          {getOverviewProfileLabel(baseProfile)} · {getOverviewFormulaLabel(baseProfile)} · G<sup>R</sup> {formatDbi(receiverGainDbi)}
        </div>
        <div data-prominence="canonical-copy">
          <span>SINR Formula Tuning</span>
          <span>γ = (P_t · H · G^T · G^R) / (I^a + I^b + σ²)</span>
          <span>Signal side P_t, H, G^T, G^R</span>
          <span>Noise side I^a, I^b, σ²</span>
        </div>
      </div>
    </details>
  );
}
