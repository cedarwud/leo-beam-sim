import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import type { Profile } from '../../profiles/types';
import { formatDbi } from './formatters';
import {
  compactSummaryStyle,
  explanatoryTextStyle,
  formulaTextStyle,
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
  hasOverrides,
  onReset,
}: {
  baseProfile: Profile;
  receiverGainDbi: number;
  hasOverrides: boolean;
  onReset: () => void;
}) {
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
        textTransform: 'uppercase',
      }}>
        SINR overview
      </summary>
      <div style={{ display: 'grid', gap: 12, paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.semantic.tuning, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: UI_TOKENS.type.weight.heavy }}>
              SINR Formula Tuning
            </div>
            <div style={{ marginTop: 7, ...formulaTextStyle, fontSize: 23, lineHeight: 1.28 }}>
              γ = <span style={{ color: UI_TOKENS.color.semantic.tuning }}>(P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup>)</span> / <span style={{ color: UI_TOKENS.color.semantic.noise }}>(I<sup>a</sup> + I<sup>b</sup> + σ²)</span>
            </div>
          </div>
          <button
            className={UI_CLASSES.button}
            type="button"
            onClick={onReset}
            disabled={!hasOverrides}
            style={{
              cursor: hasOverrides ? 'pointer' : 'default',
              padding: '8px 10px',
              borderRadius: UI_TOKENS.radius.md,
              border: hasOverrides ? '1px solid rgba(20, 135, 121, 0.38)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: hasOverrides ? 'rgba(118, 234, 215, 0.16)' : UI_TOKENS.color.surface.cardFaint,
              color: hasOverrides ? UI_TOKENS.color.semantic.tuning : UI_TOKENS.color.text.faint,
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            Reset
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <div style={{
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(118, 234, 215, 0.16)',
          }}>
            <div style={{ fontSize: UI_TOKENS.type.size.tiny, color: UI_TOKENS.color.semantic.tuning, fontWeight: UI_TOKENS.type.weight.heavy, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Signal side
            </div>
            <div style={{ ...explanatoryTextStyle, marginTop: 3 }}>
              P<sub>t</sub>, H, G<sup>T</sup>, G<sup>R</sup>
            </div>
          </div>
          <div style={{
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(142, 186, 255, 0.16)',
          }}>
            <div style={{ fontSize: UI_TOKENS.type.size.tiny, color: UI_TOKENS.color.semantic.noise, fontWeight: UI_TOKENS.type.weight.heavy, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Noise side
            </div>
            <div style={{ ...explanatoryTextStyle, marginTop: 3 }}>
              I<sup>a</sup>, I<sup>b</sup>, σ²
            </div>
          </div>
        </div>
        <div style={explanatoryTextStyle}>
          {getOverviewProfileLabel(baseProfile)} · {getOverviewFormulaLabel(baseProfile)} · G<sup>R</sup> {formatDbi(receiverGainDbi)}
        </div>
      </div>
    </details>
  );
}
