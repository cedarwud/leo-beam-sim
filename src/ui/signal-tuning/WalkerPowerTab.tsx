import { UI_TOKENS } from '../../constants/uiTokens';
import type { AngleAwareFormulaFrame } from '../../engine/signal/types';
import { useLocale } from '../../i18n';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import { PrimedLinkIndex, SystemAngleState, LinkAngle, SystemPowerSum } from './FormulaSymbols';
import { txBi } from './labels';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import { FormulaSymbolGuide } from './FormulaSymbolGuide';
import { pagePanelStyle } from './styles';

const POWER_ACCENT = UI_TOKENS.color.semantic.good;

export function WalkerPowerTab({
  formulaFrame = null,
}: {
  readonly formulaFrame?: AngleAwareFormulaFrame | null;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const linkIndex = SIMPLIFIED_EE_LINK_INDEX;
  void formulaFrame;

  return (
    <section
      id="tuning-page-panel-power"
      data-testid="walker-power-page"
      role="tabpanel"
      aria-label={say('tab.power.label', '功率', 'Power')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="walker-power-formula-header"
        title="Power"
        accent={POWER_ACCENT}
        align="center"
        variant="legacy"
      >
        <FormulaRow
          testId="walker-power-system-formula"
          accent={POWER_ACCENT}
          emphasis
          expression={(
            <span style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
              <span>P<sup>N</sup>(t, <SystemAngleState />)</span>
              <span>= P<sup>f</sup>(t) + <SystemPowerSum /></span>
            </span>
          )}
          source={say(
            'walker.power.systemExplanation',
            'P^N 是所有作用中鏈路的共同系統總功率；右側顯示本幀的實際值。',
            'P^N is the shared system total power of all active links; the right rail shows the live value for this frame.',
          )}
        />
        <FormulaRow
          testId="walker-power-pa-formula"
          accent={POWER_ACCENT}
          expression={(
            <span>
              P<sup>p</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />) ={' '}
              <InlineFormulaFraction
                numerator={<><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />)</>}
                denominator={<>ξ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />)</>}
                label="link RF power divided by effective conversion efficiency"
              />
            </span>
          )}
          source={say(
            'walker.power.linkExplanation',
            'P^p 將鏈路 RF 功率換算成電源端消耗，ξ 是有效功率轉換效率。',
            'P^p converts link RF power to supply-side consumption; ξ is the effective conversion efficiency.',
          )}
        />
        <FormulaRow
          testId="walker-power-segment-start-formula"
          accent={POWER_ACCENT}
          expression={(
            <span>
              <i>p</i><sub>{linkIndex}</sub>(τ<sub>{linkIndex}</sub>, θ<sub>{linkIndex}</sub>(τ<sub>{linkIndex}</sub>)) = 2 W
            </span>
          )}
          source={say(
            'walker.power.segmentStartExplanation',
            '每個新的 uninterrupted served segment 都從 2 W 開始；換手、中斷或重新進入服務時不沿用舊鏈路功率。',
            'Every new uninterrupted served segment starts at 2 W; handover, outage, or re-entry does not reuse the old link power.',
          )}
        />
        <FormulaRow
          testId="walker-power-recurrence-formula"
          accent={POWER_ACCENT}
          expression={(
            <span>
              <i>p</i><sub>{linkIndex}</sub>(t, θ<sub>{linkIndex}</sub>(t)) = <i>p</i><sub>{linkIndex}</sub>(t−1, θ<sub>{linkIndex}</sub>(t−1)) ·{' '}
              <InlineFormulaFraction
                numerator={<>G<sup>T</sup>(θ<sub>{linkIndex}</sub>(t−1))</>}
                denominator={<>G<sup>T</sup>(θ<sub>{linkIndex}</sub>(t))</>}
                label="previous/current transmit-gain ratio"
              />
            </span>
          )}
          source={say(
            'walker.power.recurrenceExplanation',
            '同一實體服務鏈路連續存在時，使用上一幀的 p 與前後角度增益比；換手或中斷後重新開始新的 segment。',
            'While the same physical serving link continues, p uses the previous frame and the transmit-gain ratio; handover or outage starts a new segment.',
          )}
        />
        <FormulaRow
          testId="walker-power-closed-formula"
          accent={POWER_ACCENT}
          expression={(
            <span>
              <i>p</i><sub>{linkIndex}</sub>(t, θ<sub>{linkIndex}</sub>(t)) = 2 W ·{' '}
              <InlineFormulaFraction
                numerator={<>G<sup>T</sup>(θ<sub>{linkIndex}</sub>(τ<sub>{linkIndex}</sub>))</>}
                denominator={<>G<sup>T</sup>(θ<sub>{linkIndex}</sub>(t))</>}
                label="segment-start to current transmit-gain ratio"
              />
            </span>
          )}
          source={say(
            'walker.power.closedExplanation',
            '這是同一 uninterrupted segment 內由 2 W 起點展開的 closed form，不跨 handover、中斷或 episode reset。',
            'This is the closed form from the 2 W segment start; it does not cross handover, outage, or an episode reset.',
          )}
        />
        <FormulaSymbolGuide
          title={say('walker.power.symbolGuide', '符號說明', 'Symbol guide')}
          rows={[
            {
              testId: 'walker-power-symbol-system',
              symbol: <>P<sup>N</sup>(t, <SystemAngleState />)</>,
              explanation: say('walker.power.symbolSystem', '所有作用中 UE-link 共用的系統總功率。', 'Shared system power across all active UE-links.'),
              accent: POWER_ACCENT,
            },
            {
              testId: 'walker-power-symbol-fixed',
              symbol: <>P<sup>f</sup>(t)</>,
              explanation: say('walker.power.symbolFixed', '不隨單一鏈路切換的固定功率項。', 'Fixed power term that does not belong to one link.'),
              accent: UI_TOKENS.color.semantic.noise,
            },
            {
              testId: 'walker-power-symbol-indicator',
              symbol: <>x<sub><PrimedLinkIndex /></sub>(t)</>,
              explanation: say('walker.power.symbolIndicator', '鏈路指示量；作用中鏈路為 1，未選定鏈路為 0。', 'Link indicator; 1 for an active link and 0 otherwise.'),
              accent: UI_TOKENS.color.semantic.tuning,
            },
            {
              testId: 'walker-power-symbol-supply',
              symbol: <>P<sup>p</sup><sub>{linkIndex}</sub>(t, <LinkAngle />)</>,
              explanation: say('walker.power.symbolSupply', '選定 UE-link 的電源端消耗功率。', 'Supply-side consumption power of the selected UE-link.'),
              accent: POWER_ACCENT,
            },
            {
              testId: 'walker-power-symbol-rf',
              symbol: <><i>p</i><sub>{linkIndex}</sub>(t, <LinkAngle />)</>,
              explanation: say('walker.power.symbolRf', '選定 UE-link 的實際 RF 發射功率；同一鏈路連續時由上一幀遞推。', 'Actual RF transmit power of the selected UE-link; continued from the previous frame while the link persists.'),
              accent: UI_TOKENS.color.semantic.tuning,
            },
            {
              testId: 'walker-power-symbol-efficiency',
              symbol: <>ξ<sub>{linkIndex}</sub>(t, <LinkAngle />)</>,
              explanation: say('walker.power.symbolEfficiency', '把 RF 輸出換算成電源端消耗的有效功率轉換效率。', 'Effective conversion efficiency from RF output to supply-side consumption.'),
              accent: UI_TOKENS.color.semantic.warning.accent,
            },
            {
              testId: 'walker-power-symbol-gain',
              symbol: <>G<sup>T</sup>(<LinkAngle />)</>,
              explanation: say('walker.power.symbolGain', '由選定 UE-link 的離軸角決定的角度相關發射增益。', 'Angle-dependent transmit gain determined by the selected UE-link off-axis angle.'),
              accent: UI_TOKENS.color.semantic.beam,
            },
          ]}
        />
      </FormulaHeader>
    </section>
  );
}
