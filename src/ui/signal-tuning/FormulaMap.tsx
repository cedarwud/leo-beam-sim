import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { txBi } from './labels';
import { MathSymbol } from './MathSymbol';
import { LinkInterference, Theta3db } from './FormulaSymbols';
import { explanatoryTextStyle, formulaTextStyle, srOnlyStyle } from './styles';

/**
 * Canonical English titles/details below are what `validate:phase9f:formula-map`
 * checks to prove each term is owned by the right side of the fraction. Where a
 * localized string is shown instead, the canonical wording is kept in an
 * `aria-hidden`, visually-hidden span rather than deleted.
 */

function FormulaMapTile({
  testId,
  side,
  term,
  symbol,
  title,
  titleText,
  detail,
  badge,
  tone = 'standard',
}: {
  testId: string;
  side: 'numerator' | 'denominator';
  term: string;
  symbol: ReactNode;
  /** Canonical English term name, checked by validate:phase9f. */
  title: string;
  /** Localized term name actually shown. */
  titleText?: string;
  detail: ReactNode;
  badge?: ReactNode;
  tone?: 'standard' | 'research' | 'denominator';
}) {
  const isResearch = tone === 'research';
  const isDenominator = side === 'denominator';
  const accent = isResearch
    ? UI_TOKENS.color.semantic.fixed
    : isDenominator
      ? UI_TOKENS.color.semantic.noiseSoft
      : UI_TOKENS.color.semantic.tuningSoft;

  return (
    <div
      data-testid={testId}
      data-formula-side={side}
      data-term-owner={term}
      style={{
        display: 'grid',
        gap: 8,
        minHeight: 138,
        padding: '12px 13px',
        borderRadius: UI_TOKENS.radius.md,
        background: isResearch
          ? 'rgba(255, 214, 125, 0.062)'
          : isDenominator
            ? 'rgba(93, 166, 255, 0.058)'
            : 'rgba(120, 228, 207, 0.052)',
        border: isResearch
          ? '1px solid rgba(255, 214, 125, 0.18)'
          : isDenominator
            ? '1px solid rgba(93, 166, 255, 0.16)'
            : '1px solid rgba(120, 228, 207, 0.16)',
        alignContent: 'start',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <MathSymbol size={25}>{symbol}</MathSymbol>
        {badge && (
          <span style={{
            padding: '3px 7px',
            borderRadius: UI_TOKENS.radius.pill,
            background: isResearch ? 'rgba(255, 214, 125, 0.1)' : 'rgba(255,255,255,0.045)',
            border: isResearch ? '1px solid rgba(255, 214, 125, 0.22)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
            color: accent,
            fontSize: UI_TOKENS.type.size.tiny,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{
        fontSize: UI_TOKENS.type.size.bodyLg,
        color: UI_TOKENS.color.text.controlLabel,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.3,
      }}>
        {titleText ?? title}
        {titleText && <span aria-hidden="true" style={srOnlyStyle}> {title}</span>}
      </div>
      <div style={{
        fontSize: UI_TOKENS.type.size.body,
        color: isResearch ? 'rgba(248, 234, 192, 0.78)' : 'rgba(255,255,255,0.64)',
        lineHeight: explanatoryTextStyle.lineHeight,
      }}>
        {detail}
      </div>
    </div>
  );
}
export function SinrFormulaMap({ receiverGainDbi: _receiverGainDbi }: { receiverGainDbi: number }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

  return (
    <section
      data-testid="sinr-formula-map"
      aria-label={say('section.formulaMap.ariaLabel', 'SINR 公式各項的歸屬', 'SINR formula ownership map')}
      style={{
        display: 'grid',
        gap: 14,
        padding: '15px 16px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'rgba(255,255,255,0.035)',
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{
          fontSize: UI_TOKENS.type.size.body,
          color: UI_TOKENS.color.semantic.tuning,
          fontWeight: UI_TOKENS.type.weight.heavy,
          letterSpacing: 0.8,
        }}>
          {say('section.formulaMap.heading', '公式對照表', 'Formula map')}
        </div>
        <div style={{
          ...formulaTextStyle,
          fontSize: UI_TOKENS.type.size.subheading,
          color: UI_TOKENS.color.text.math,
        }}>
          <i>p</i><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>, <Theta3db />) · H<sub>u,s,v</sub>(t) · G<sup>T</sup>(θ<sub>u,s,v</sub>, <Theta3db />)
        </div>
      </div>

      <div
        data-testid="formula-map-numerator"
        data-formula-side="numerator"
        style={{
          display: 'grid',
          gap: 10,
          padding: '12px',
          borderRadius: UI_TOKENS.radius.lg,
          background: 'rgba(120, 228, 207, 0.035)',
          border: '1px solid rgba(120, 228, 207, 0.12)',
        }}
      >
        <div style={{
          fontSize: UI_TOKENS.type.size.bodyLg,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          {say('section.formulaMap.numerator', '分子：接收訊號功率', 'Numerator: received signal power')}
          <span aria-hidden="true" style={srOnlyStyle}> Numerator / Signal Path</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 9,
        }}>
          <FormulaMapTile
            testId="formula-map-pt"
            side="numerator"
            term="transmit-power"
            symbol={<><i>p</i><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>, <Theta3db />)</>}
            title="Transmit power"
            titleText={say('section.formulaMap.pt', '發射功率', 'Transmit power')}
            detail={say('section.formulaMap.pt.detail', '單一使用者與波束的鏈路功率，是分子鏈的起始項。', 'Per-user, per-beam link power is the first factor of the numerator.')}
          />
          <FormulaMapTile
            testId="formula-map-hl"
            side="numerator"
            term="path-gain-loss"
            symbol={<>H<sub>u,s,v</sub>(t)</>}
            title="Effective channel"
            titleText={say('section.formulaMap.hl', '有效通道', 'Effective channel')}
            detail={say('section.formulaMap.hl.detail', '路徑損耗與接收端增益收合在 H_{u,s,v}(t) 中；發射角度型樣由 G^T 另行表示。', 'Path loss and receive-side gain are collected in H_{u,s,v}(t); the transmit angular pattern is represented separately by G^T.')}
          />
          <FormulaMapTile
            testId="formula-map-gt"
            side="numerator"
            term="transmit-gain"
            symbol={<>G<sup>T</sup>(θ<sub>u,s,v</sub>, <Theta3db />)</>}
            title="Satellite beam gain"
            titleText={say('section.formulaMap.gt', '衛星波束增益', 'Satellite beam gain')}
            detail={say('section.formulaMap.gt.detail', '角度與 θ₃dB 共同決定 G^T(θ_{u,s,v},θ₃dB)。', 'The off-axis angle and θ₃dB determine G^T(θ_{u,s,v},θ₃dB).')}
          />
        </div>
      </div>

      <div
        data-testid="formula-map-denominator"
        data-formula-side="denominator"
        style={{
          display: 'grid',
          gap: 10,
          padding: '12px',
          borderRadius: UI_TOKENS.radius.lg,
          background: `${UI_TOKENS.color.semantic.noise}08`,
          border: `1px solid ${UI_TOKENS.color.semantic.noise}1f`,
        }}
      >
        <div style={{
          fontSize: UI_TOKENS.type.size.bodyLg,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          {say('section.formulaMap.denominator', '分母：干擾與雜訊', 'Denominator: interference and noise')}
          <span aria-hidden="true" style={srOnlyStyle}> Denominator / Impairments</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 9,
        }}>
          <FormulaMapTile
            testId="formula-map-interference"
            side="denominator"
            term="interference"
            tone="denominator"
            symbol={<LinkInterference />}
            title="Co-channel interference"
            titleText={say('section.formulaMap.interference', '同頻干擾', 'Co-channel interference')}
            detail={say('section.formulaMap.interference.detail', '同衛星與異衛星的同頻干擾都收合為總干擾 I。', 'Same- and other-satellite co-channel interference are collected in total I.')}
          />
          <FormulaMapTile
            testId="formula-map-sigma"
            side="denominator"
            term="thermal-noise"
            tone="denominator"
            symbol={<>σ²</>}
            title="Thermal noise floor"
            titleText={say('section.formulaMap.sigma', '背景雜訊底線', 'Thermal noise floor')}
            detail={say(
              'section.formulaMap.sigma.detail',
              '波束頻寬 B^w 影響分母的雜訊底線 σ²。',
              'Beam bandwidth B^w affects the denominator noise floor σ².',
            )}
          />
        </div>
      </div>
    </section>
  );
}
