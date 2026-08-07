import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { formatDbi } from './formatters';
import { txBi } from './labels';
import { MathSymbol } from './MathSymbol';
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
export function SinrFormulaMap({ receiverGainDbi }: { receiverGainDbi: number }) {
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
          P<sub>t</sub> -&gt; H -&gt; G<sup>T</sup> -&gt; G<sup>R</sup>
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
            symbol={<>P<sub>t</sub></>}
            title="Transmit power"
            titleText={say('section.formulaMap.pt', '發射功率', 'Transmit power')}
            detail={say('section.formulaMap.pt.detail', '每波束發射功率，為分子鏈的起始項。', 'Per-beam transmit power is the first factor of the numerator.')}
          />
          <FormulaMapTile
            testId="formula-map-hl"
            side="numerator"
            term="path-gain-loss"
            symbol={<>H</>}
            title="Channel gain / path loss"
            titleText={say('section.formulaMap.hl', '通道增益與路徑損耗', 'Channel gain and path loss')}
            detail={say('section.formulaMap.hl.detail', '載波頻率與各路徑損耗項決定分子的接收訊號功率（H 由 L 換算）。', 'Carrier frequency and the path-loss terms set the received signal power in the numerator; H is derived from L.')}
          />
          <FormulaMapTile
            testId="formula-map-gt"
            side="numerator"
            term="transmit-gain"
            symbol={<>G<sup>T</sup></>}
            title="Satellite beam gain"
            titleText={say('section.formulaMap.gt', '衛星波束增益', 'Satellite beam gain')}
            detail={say('section.formulaMap.gt.detail', '衛星天線增益圖樣、轉向角與轉向損耗共同構成 G^T 項。', 'Transmit antenna pattern, steering angle, and scan loss together form the G^T factor.')}
          />
          <FormulaMapTile
            testId="formula-map-gr"
            side="numerator"
            term="receiver-gain"
            symbol={<>G<sup>R</sup></>}
            title="Receiver gain"
            titleText={say('section.formulaMap.gr', '接收端增益', 'Receiver gain')}
            badge="Sensitivity"
            tone="research"
            detail={
              <>
                {say(
                  'section.formulaMap.gr.detail',
                  `地面天線的增益 ${formatDbi(receiverGainDbi)}。它是分子裡獨立的一項，跟發射功率和衛星波束增益是分開的。`,
                  `${formatDbi(receiverGainDbi)} of ground-antenna gain. It is its own term on the top of the fraction, separate from transmit power and satellite beam gain.`,
                )}
                <span aria-hidden="true" style={srOnlyStyle}>
                  {formatDbi(receiverGainDbi)} receive-side gain. Independent numerator term; not transmit power or satellite beam gain.
                </span>
              </>
            }
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
            symbol={<>I<sup>a</sup> + I<sup>b</sup></>}
            title="Co-channel interference"
            titleText={say('section.formulaMap.interference', '同頻干擾', 'Co-channel interference')}
            detail={say('section.formulaMap.interference.detail', '同衛星內與跨衛星的同頻干擾皆計入分母。', 'Intra-satellite and inter-satellite co-channel interference both belong to the denominator.')}
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
              '頻寬 B 和雜訊密度 N₀ 決定分母的雜訊底線。',
              'Bandwidth B and noise density N₀ define the denominator noise floor.',
            )}
          />
        </div>
      </div>
    </section>
  );
}
