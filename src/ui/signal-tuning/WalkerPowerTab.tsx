import { UI_TOKENS } from '../../constants/uiTokens';
import type { AngleAwareFormulaFrame } from '../../engine/signal/types';
import {
  ANGLE_AWARE_BEAM_POWER_CAP_W,
  ANGLE_AWARE_SEGMENT_START_POWER_W,
} from '../../engine/signal/angle-aware-ee';
import { useLocale } from '../../i18n';
import { FormulaHeader, FormulaRow, InlineFormulaFraction } from './FormulaHeader';
import {
  BeamEfficiency,
  BeamRfPower,
  BeamSupplyPower,
  LinkAngle,
  LinkRfPower,
  SystemAngleState,
  SystemPowerSum,
  Theta3db,
} from './FormulaSymbols';
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
  const authoritySegmentStartPowerW = ANGLE_AWARE_SEGMENT_START_POWER_W;
  void formulaFrame;

  return (
    <section
      id="tuning-page-panel-power"
      data-testid="walker-power-page"
      data-readonly="true"
      data-control-surface="derived-only"
      data-canonical-state-owner="walker-live-scene-frame"
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
          formulaFontSize={17}
          expression={(
            <span style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
              <span>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />)</span>
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
          testId="walker-power-beam-aggregation-formula"
          accent={POWER_ACCENT}
          emphasis
          formulaFontSize={17}
          expression={(
            <span style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
              <span><BeamRfPower /> = max<sub>u:x<sub>u,s,v</sub>(t)=1</sub> <LinkRfPower /></span>
            </span>
          )}
          source={say(
            'walker.power.beamAggregationExplanation',
            '波束射頻功率取所有實際服務鏈路功率的最大值；同一支波束只有一個功率放大器，不對使用者鏈路重複加總。',
            'Beam RF power is the maximum actual RF power among its served links; one physical beam has one power amplifier, so user-link powers are not summed.',
          )}
        />
        <FormulaRow
          testId="walker-power-pa-formula"
          accent={POWER_ACCENT}
          formulaFontSize={17}
          expression={(
            <span>
              <BeamSupplyPower /> ={' '}
              <InlineFormulaFraction
                numerator={<BeamRfPower />}
                denominator={<BeamEfficiency />}
                label="maximum served-link RF power divided by beam efficiency"
              />
            </span>
          )}
          source={say(
            'walker.power.linkExplanation',
            'P^p 是衛星—波束層級的電源端功率；由波束最大 RF 功率 p_{s,v} 與同一波束 ξ_{s,v} 換算。',
            'P^p is beam-level supply power; it is obtained from the beam maximum RF power p_{s,v} and the same beam efficiency ξ_{s,v}.',
          )}
        />
        <FormulaRow
          testId="walker-power-segment-start-formula"
          accent={POWER_ACCENT}
          formulaFontSize={17}
          expression={(
            <span>
              <i>p</i><sub>{linkIndex}</sub>(τ<sub>{linkIndex}</sub>, <LinkAngle />, <Theta3db />) = p<sup>0</sup> = p<sub>max</sub>/2 = {authoritySegmentStartPowerW.toFixed(3)} W
            </span>
          )}
          source={say(
            'walker.power.segmentStartExplanation',
            `每個新的連續服務片段都從 p^0 開始；權威初始化為 p_max=${ANGLE_AWARE_BEAM_POWER_CAP_W.toFixed(2)} W，因此 p^0=${authoritySegmentStartPowerW.toFixed(3)} W。`,
            `Every new uninterrupted served segment starts at p^0; the authority initialization is p_max=${ANGLE_AWARE_BEAM_POWER_CAP_W.toFixed(2)} W, hence p^0=${authoritySegmentStartPowerW.toFixed(3)} W.`,
          )}
        />
        <FormulaRow
          testId="walker-power-recurrence-formula"
          accent={POWER_ACCENT}
          formulaFontSize={17}
          expression={(
            <span>
              <i>p</i><sub>{linkIndex}</sub>(t, <LinkAngle />, <Theta3db />) = <i>p</i><sub>{linkIndex}</sub>(t−1, θ<sub>{linkIndex}</sub>(t−1), <Theta3db />) ·{' '}
              <InlineFormulaFraction
                numerator={<>G<sup>T</sup>(θ<sub>{linkIndex}</sub>(t−1), <Theta3db />)</>}
                denominator={<>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>}
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
          formulaFontSize={17}
          expression={(
            <span>
              <i>p</i><sub>{linkIndex}</sub>(t, <LinkAngle />, <Theta3db />) = p<sup>0</sup> ·{' '}
              <InlineFormulaFraction
                numerator={<>G<sup>T</sup>(θ<sub>{linkIndex}</sub>(τ<sub>{linkIndex}</sub>), <Theta3db />)</>}
                denominator={<>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>}
                label="segment-start to current transmit-gain ratio"
              />
            </span>
          )}
          source={say(
            'walker.power.closedExplanation',
            '這是同一連續服務片段內由 p^0 起點展開的 closed form，不跨 handover、中斷或 episode reset。',
            'This is the closed form from the p^0 segment start; it does not cross handover, outage, or an episode reset.',
          )}
        />
        <FormulaSymbolGuide
          title={say('walker.power.symbolGuide', '符號說明', 'Symbol guide')}
          rows={[
            {
              testId: 'walker-power-symbol-system',
              symbol: <>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />)</>,
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
              symbol: <>z<sub>s′,v′</sub>(t)</>,
              explanation: say('walker.power.symbolIndicator', '衛星—波束作用指示量；作用中波束為 1，未作用波束為 0。', 'Satellite-beam activity indicator; 1 for an active beam and 0 otherwise.'),
              accent: UI_TOKENS.color.semantic.tuning,
            },
            {
              testId: 'walker-power-symbol-supply',
              symbol: <>P<sup>p</sup><sub>s,v</sub>(t, <SystemAngleState />, <Theta3db />)</>,
              explanation: say('walker.power.symbolSupply', '衛星—波束層級的電源端消耗功率。', 'Beam-level supply-side consumption power.'),
              accent: POWER_ACCENT,
            },
            {
              testId: 'walker-power-symbol-rf',
              symbol: <><i>p</i><sub>{linkIndex}</sub>(t, <LinkAngle />, <Theta3db />)</>,
              explanation: say('walker.power.symbolRf', '選定 UE-link 的實際 RF 發射功率；同一鏈路連續時由上一幀遞推。', 'Actual RF transmit power of the selected UE-link; continued from the previous frame while the link persists.'),
              accent: UI_TOKENS.color.semantic.tuning,
            },
            {
              testId: 'walker-power-symbol-efficiency',
              symbol: <>ξ<sub>s,v</sub>(t, <SystemAngleState />, <Theta3db />)</>,
              explanation: say('walker.power.symbolEfficiency', '衛星—波束層級的 RF 到電源端轉換效率。', 'Beam-level conversion efficiency from RF output to supply-side consumption.'),
              accent: UI_TOKENS.color.semantic.warning.accent,
            },
            {
              testId: 'walker-power-symbol-gain',
              symbol: <>G<sup>T</sup>(<LinkAngle />, <Theta3db />)</>,
              explanation: say('walker.power.symbolGain', '由選定 UE-link 的離軸角與 θ₃dB 決定的角度相關發射增益。', 'Angle-dependent transmit gain determined by the selected UE-link off-axis angle and θ₃dB.'),
              accent: UI_TOKENS.color.semantic.beam,
            },
          ]}
        />
      </FormulaHeader>
    </section>
  );
}
