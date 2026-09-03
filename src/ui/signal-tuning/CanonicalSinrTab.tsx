import { useState } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { CanonicalParameterSection } from './CanonicalParameterPrimitives';
import { CanonicalSinrTabList, type CanonicalSinrSectionKey } from './CanonicalSinrTabList';
import { NumericControl } from './Controls';
import { FormulaFraction, FormulaHeader, FormulaRow } from './FormulaHeader';
import {
  LinkChannel,
  LinkInterference,
  LinkRfPower,
  LinkSinr,
  LinkTransmitGain,
  Theta3db,
} from './FormulaSymbols';
import { txBi } from './labels';
import { captionTextStyle, controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const SINR_ACCENT = UI_TOKENS.color.semantic.tuning;

function normalizeSection(section: CanonicalSinrSectionKey): CanonicalSinrSectionKey {
  return section === 'receiver' ? 'channel' : section;
}

function linearToDb(value: number): number {
  return 10 * Math.log10(Math.max(value, 1e-30));
}

function dbToLinear(value: number): number {
  return 10 ** (value / 10);
}

export function CanonicalSinrTab({
  analysis,
  initialSection = 'power',
}: {
  readonly analysis: HomepageCanonicalAnalysisState;
  readonly initialSection?: CanonicalSinrSectionKey;
}) {
  const [activeSection, setActiveSection] = useState<CanonicalSinrSectionKey>(() => normalizeSection(initialSection));
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const parameters = analysis.parameters;
  const update = (patch: Partial<SimulatorParameters>) => analysis.setParameters({ ...parameters, ...patch });
  const thetaDegrees = parameters.theta3dbRad * 180 / Math.PI;
  const g0Dbi = linearToDb(parameters.g0Linear);
  const defaultThetaDegrees = DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad * 180 / Math.PI;
  const defaultG0Dbi = linearToDb(DEFAULT_SIMULATOR_PARAMETERS.g0Linear);

  return (
    <section
      id="tuning-page-panel-sinr-formula"
      data-testid="homepage-sinr-parameters"
      role="tabpanel"
      aria-label={say('tab.sinr.label', 'SINR', 'SINR')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="homepage-sinr-formula-header"
        title={say('homepage.sinr.heading', 'SINR 公式與參數', 'SINR formula and inputs')}
        accent={SINR_ACCENT}
        caption={say(
          'homepage.sinr.scope',
          'SINR 比較接收訊號功率與同頻干擾、熱雜訊；調整通道、增益與雜訊輸入即可觀察鏈路品質如何改變。',
          'SINR compares received signal power with co-channel interference and thermal noise; adjust channel, gain, and noise inputs to see how link quality changes.',
        )}
      >
        <div
          data-testid="homepage-sinr-top-formula"
          data-formula-term="sinr"
          style={{ width: '100%' }}
        >
          <FormulaFraction
            lhs={<LinkSinr />}
            numerator={(
              <>
                <span style={{ color: SINR_ACCENT }} data-formula-symbol="link-request-power"><LinkRfPower /></span>
                {' · '}
                <span data-formula-symbol="effective-channel"><LinkChannel /></span>
                {' · '}
                <span data-formula-symbol="transmit-gain"><LinkTransmitGain /></span>
              </>
            )}
            denominator={(
              <>
                <LinkInterference /> + σ²
              </>
            )}
            numeratorAccent={SINR_ACCENT}
            denominatorAccent={UI_TOKENS.color.semantic.noise}
          />
        </div>
      </FormulaHeader>

      <div style={{ display: 'grid', gap: 7 }}>
        <div style={groupTitleStyle}>{say('homepage.sinr.terms', '公式項目', 'Formula terms')}</div>
        <CanonicalSinrTabList activeSection={activeSection} onChange={next => setActiveSection(normalizeSection(next))} />
      </div>

      {activeSection === 'power' && (
        <CanonicalParameterSection
          testId="canonical-sinr-section-power"
          title={say('homepage.sinr.power.title', '功率鏈', 'Power chain')}
        >
          <div data-testid="canonical-sinr-formula-power" data-formula-term="power">
            <FormulaRow
              testId="canonical-sinr-power-chain"
              accent={SINR_ACCENT}
              emphasis
              expression={(
                <>
                  <i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ<sub>u,s,v</sub>, <Theta3db />)
                </>
              )}
              source={isEnglish ? (
                <>
                  <i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ<sub>u,s,v</sub>, <Theta3db />) is the actual RF power used by γ.
                </>
              ) : (
                <>
                  <i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ<sub>u,s,v</sub>, <Theta3db />) 是 γ 使用的實際 RF 功率。
                </>
              )}
            />
          </div>
          <p style={{ ...captionTextStyle, margin: 0 }}>
            {isEnglish ? (
              <>The γ link term uses the actual RF power of the selected link under the configured θ<sub>3dB</sub>.</>
            ) : (
              <>γ 的鏈路項使用設定的 θ<sub>3dB</sub> 與單一使用者的實際 RF 功率。</>
            )}
          </p>
        </CanonicalParameterSection>
      )}

      {activeSection === 'channel' && (
        <CanonicalParameterSection
          testId="canonical-sinr-section-channel"
          title={say('homepage.sinr.channel.title', '大尺度傳播增益', 'Large-scale propagation gain')}
        >
          <div data-testid="canonical-sinr-formula-channel" data-formula-term="channel">
            <FormulaRow
              testId="canonical-sinr-channel-gain"
              accent={UI_TOKENS.color.semantic.loss}
              emphasis
              expression={<LinkChannel />}
              source={isEnglish
                ? <><LinkChannel /> is the composite effective channel used by SINR.</>
                : <><LinkChannel /> 是 SINR 使用的複合有效通道。</>}
            />
          </div>
          <NumericControl
            testId="sinr-tab-carrier-frequency-control"
            symbol={null}
            label={say('homepage.sinr.carrierFrequency.label', '載波頻率', 'Carrier frequency')}
            unit="GHz"
            value={parameters.carrierFrequencyGHz}
            min={1}
            max={100}
            step={0.1}
            description={say('homepage.sinr.carrierFrequency.description', '自由空間路徑損耗使用的頻率；提高頻率會增加損耗。', 'Carrier frequency used in free-space path loss; higher frequency increases loss.')}
            effect={say('homepage.sinr.carrierFrequency.effect', '提高頻率會改變 H，並連帶改變 SINR 與速率。', 'Increasing frequency changes H and therefore the SINR and rate.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.carrierFrequencyGHz.toFixed(1)} GHz`}
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · carrier frequency"
            helpId="param.canonicalSinr.carrierFrequency"
            accentColor={UI_TOKENS.color.semantic.beam}
            formatValue={value => `${value.toFixed(1)} GHz`}
            onChange={carrierFrequencyGHz => update({ carrierFrequencyGHz })}
          />
          <NumericControl
            testId="sinr-tab-atmospheric-loss-control"
            symbol={null}
            label={say('homepage.sinr.atmosphericLoss.label', '大氣衰減係數', 'Atmospheric attenuation coefficient')}
            unit="dB/km"
            value={parameters.atmosphericZenithLossDb}
            min={0}
            max={1}
            step={0.01}
            description={say('homepage.sinr.atmosphericLoss.description', '大氣衰減係數，以 dB/km 表示。', 'Atmospheric attenuation coefficient, in dB/km.')}
            effect={say('homepage.sinr.atmosphericLoss.effect', '提高大氣衰減係數會改變 H，並連帶改變 SINR 與速率。', 'Increasing atmospheric attenuation changes H and therefore the SINR and rate.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.atmosphericZenithLossDb.toFixed(2)} dB/km`}
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · atmospheric attenuation coefficient"
            helpId="param.canonicalSinr.atmosphericLoss"
            accentColor={UI_TOKENS.color.semantic.beam}
            formatValue={value => `${value.toFixed(2)} dB/km`}
            onChange={chiAtm => update({ atmosphericZenithLossDb: chiAtm })}
          />
          <NumericControl
            testId="sinr-tab-receiver-gain-control"
            symbol={<>G<sup>R</sup></>}
            label={say('homepage.sinr.receiveGain.label', '接收天線增益', 'Receive antenna gain')}
            unit="dBi"
            value={parameters.receiveGainDbi}
            min={-10}
            max={60}
            step={0.1}
            description={say('homepage.sinr.receiveGain.description', '接收端天線增益，屬於 H 的通道組成。', 'Receive-antenna gain, included in the H channel term.')}
            effect={say('homepage.sinr.receiveGain.effect', '提高接收增益會改變 H，並連帶改變 γ 與速率。', 'Increasing receive gain changes H and therefore γ and rate.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.receiveGainDbi.toFixed(1)} dBi`}
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · receive antenna gain"
            helpId="param.canonicalSinr.receiveGain"
            accentColor={UI_TOKENS.color.semantic.loss}
            formatValue={value => `${value.toFixed(1)} dBi`}
            onChange={receiveGainDbi => update({ receiveGainDbi })}
          />
        </CanonicalParameterSection>
      )}

      {activeSection === 'beam' && (
        <div id="canonical-sinr-section-beam" style={controlStackStyle}>
          <div style={groupTitleStyle}>{say('homepage.sinr.beam.title', '波束增益模型', 'Beam gain model')}</div>
          <div data-testid="canonical-sinr-formula-beam" data-formula-term="beam">
            <FormulaRow
              testId="canonical-sinr-beam-gain"
              accent={UI_TOKENS.color.semantic.beam}
              emphasis
              expression={<>G<sup>T</sup>(θ<sub>u,s,v</sub>, <Theta3db />)</>}
              source={isEnglish
                ? <>G<sup>T</sup>(θ<sub>u,s,v</sub>, <Theta3db />) is the angle-dependent transmit beam gain.</>
                : <>G<sup>T</sup>(θ<sub>u,s,v</sub>, <Theta3db />) 是隨離軸角與 θ<sub>3dB</sub> 變化的發射波束增益。</>}
            />
          </div>
          <NumericControl
            testId="sinr-tab-g0-control"
            symbol={<>G<sup>T</sup>(0, <Theta3db />)</>}
            label={say('homepage.sinr.g0.label', '波束中心發射增益', 'Boresight transmit gain')}
            unit="dBi"
            value={g0Dbi}
            min={0}
            max={40}
            step={0.1}
            description={say('homepage.sinr.g0.description', '波束中心的發射增益。', 'Boresight transmit gain.')}
            effect={say('homepage.sinr.g0.effect', '提高 Gᵀ(0,θ₃dB) 會改變角度相關發射增益，並連帶改變 SINR 與速率。', 'Increasing Gᵀ(0,θ₃dB) changes the angle-dependent transmit gain and therefore the SINR and rate.')}
            resetValue={say(
              'homepage.sinr.g0.resetValue',
              `預設 ${defaultG0Dbi.toFixed(1)} dBi`,
              `Default ${defaultG0Dbi.toFixed(1)} dBi`,
            )}
            helpId="param.canonicalSinr.g0"
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · boresight transmit gain"
            accentColor={UI_TOKENS.color.semantic.beam}
            formatValue={value => `${value.toFixed(1)} dBi`}
            onChange={value => update({ g0Linear: dbToLinear(value) })}
          />
          <NumericControl
            testId="sinr-tab-theta3db-control"
            symbol={null}
            label={say('homepage.sinr.theta3db.label', '完整半功率波束寬度', 'Full half-power beam width')}
            unit="degree"
            value={thetaDegrees}
            min={1}
            max={20}
            step={0.1}
            description={say('homepage.sinr.theta3db.description', '完整半功率波束寬；公式使用其一半作為單側角度。', 'Full half-power beam width; the formula uses half of it as the one-sided angle.')}
            effect={say('homepage.sinr.theta3db.effect', '調整波束寬會改變 Gᵀ(θᵤ,ₛ,ᵥ,θ₃dB)，並連帶改變 SINR 與速率。', 'Changing beamwidth changes Gᵀ(θᵤ,ₛ,ᵥ,θ₃dB) and therefore the SINR and rate.')}
            resetValue={say(
              'homepage.sinr.theta3db.resetValue',
              `預設 ${defaultThetaDegrees.toFixed(1)}°`,
              `Default ${defaultThetaDegrees.toFixed(1)}°`,
            )}
            helpId="param.canonicalSinr.theta3db"
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · full 3 dB beamwidth"
            accentColor={UI_TOKENS.color.semantic.beam}
            formatValue={value => `${value.toFixed(1)}°`}
            onChange={value => update({ theta3dbRad: value * Math.PI / 180 })}
          />
        </div>
      )}

      {activeSection === 'interference' && (
        <CanonicalParameterSection
          testId="canonical-sinr-section-interference"
          title={say('homepage.sinr.interference.title', '同頻干擾', 'Co-channel interference')}
        >
          <div data-testid="canonical-sinr-formula-interference" data-formula-term="interference">
            <FormulaRow
              testId="canonical-sinr-interference-decomposition"
              accent="#ff8a6b"
              emphasis
              expression={<LinkInterference />}
              source={isEnglish ? (
                <><LinkInterference /> is the total co-channel interference used by the SINR equation.</>
              ) : (
                <><LinkInterference /> 是 SINR 式使用的總同頻干擾。</>
              )}
            />
          </div>
          <NumericControl
            testId="sinr-tab-frequency-reuse-control"
            symbol={null}
            label={say('homepage.sinr.frequencyReuse.label', '頻率重用群組數', 'Frequency-reuse group count')}
            unit="groups"
            value={parameters.frequencyReuse}
            min={1}
            max={7}
            step={1}
            description={say('homepage.sinr.frequencyReuse.description', '將系統頻寬分成指定數量的重用群組；這會決定哪些作用中波束共同形成 I_{u,s,v}(t,θ,θ₃dB)，也會改變每道波束頻寬。', 'Splits system bandwidth into the selected number of reuse groups; this determines which active beams contribute to I_{u,s,v}(t,θ,θ₃dB) and changes per-beam bandwidth.')}
            effect={say('homepage.sinr.frequencyReuse.effect', '增加重用群組數會改變 I_{u,s,v}(t,θ,θ₃dB) 的同頻波束集合，並降低每道波束頻寬與 σ²。', 'Increasing the reuse-group count changes the co-channel contributors to I_{u,s,v}(t,θ,θ₃dB) and lowers per-beam bandwidth and σ².')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.frequencyReuse}`}
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · frequency-reuse group count"
            helpId="param.canonicalSinr.frequencyReuse"
            accentColor={SINR_ACCENT}
            formatValue={value => `${Math.round(value)}`}
            onChange={frequencyReuse => update({ frequencyReuse: Math.round(frequencyReuse) })}
          />
        </CanonicalParameterSection>
      )}

      {activeSection === 'noise' && (
        <div id="canonical-sinr-section-noise" style={controlStackStyle}>
          <div style={groupTitleStyle}>{say('homepage.sinr.noise.title', '熱雜訊推導', 'Thermal-noise derivation')}</div>
          <div data-testid="canonical-sinr-formula-noise" data-formula-term="noise">
            <FormulaRow
              testId="canonical-sinr-noise-power"
              accent={UI_TOKENS.color.semantic.noise}
              emphasis
              expression={<>σ² = B<sup>w</sup> · N<sub>0</sub></>}
              source={isEnglish
                ? <>σ² is the noise power paired with <LinkInterference /> in SINR.</>
                : <>σ² 是與 <LinkInterference /> 一起進入 SINR 的接收端雜訊功率。</>}
            />
          </div>
          <NumericControl
            testId="sinr-tab-antenna-noise-temperature-control"
            symbol={<>T<sub>ant</sub></>}
            label={say('homepage.sinr.antennaTemperature.label', '天線雜訊溫度', 'Antenna noise temperature')}
            unit="K"
            value={parameters.antennaNoiseTemperatureK}
            min={1}
            max={2000}
            step={1}
            description={say('homepage.sinr.antennaTemperature.description', '接收端天線雜訊溫度，參與 σ² 推導。', 'Receiver antenna noise temperature used in the σ² derivation.')}
            effect={say('homepage.sinr.antennaTemperature.effect', '提高天線雜訊溫度會提高 σ²，並降低 γ 與速率。', 'Increasing antenna noise temperature raises σ² and lowers γ and rate.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK} K`}
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · antenna noise temperature"
            helpId="param.canonicalSinr.antennaNoiseTemperature"
            accentColor={UI_TOKENS.color.semantic.noise}
            formatValue={value => `${Math.round(value)} K`}
            onChange={antennaNoiseTemperatureK => update({ antennaNoiseTemperatureK: Math.round(antennaNoiseTemperatureK) })}
          />
          <NumericControl
            testId="sinr-tab-noise-figure-control"
            symbol={<>NF</>}
            label={say('homepage.sinr.noiseFigure.label', '接收器雜訊指數', 'Receiver noise figure')}
            unit="dB"
            value={parameters.noiseFigureDb}
            min={0}
            max={20}
            step={0.1}
            description={say('homepage.sinr.noiseFigure.description', '接收器雜訊指數，參與 σ² 推導。', 'Receiver noise figure used in the σ² derivation.')}
            effect={say('homepage.sinr.noiseFigure.effect', '提高雜訊指數會提高 σ²，並降低 γ 與速率。', 'Increasing noise figure raises σ² and lowers γ and rate.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.noiseFigureDb.toFixed(1)} dB`}
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · receiver noise figure"
            helpId="param.canonicalSinr.noiseFigure"
            accentColor={UI_TOKENS.color.semantic.noise}
            formatValue={value => `${value.toFixed(1)} dB`}
            onChange={noiseFigureDb => update({ noiseFigureDb })}
          />
          <NumericControl
            testId="sinr-tab-noise-reference-temperature-control"
            symbol={<>T<sub>0</sub></>}
            label={say('homepage.sinr.noiseReferenceTemperature.label', '雜訊參考溫度', 'Noise reference temperature')}
            unit="K"
            value={parameters.noiseReferenceTemperatureK}
            min={1}
            max={2000}
            step={1}
            description={say('homepage.sinr.noiseReferenceTemperature.description', '熱雜訊計算使用的參考溫度。', 'Reference temperature used by the thermal-noise calculation.')}
            effect={say('homepage.sinr.noiseReferenceTemperature.effect', '提高參考溫度會提高 σ²，並降低 γ 與速率。', 'Increasing reference temperature raises σ² and lowers γ and rate.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.noiseReferenceTemperatureK} K`}
            source="TLE-CANONICAL-EE-SIMULATOR-SDD §8.1 · noise reference temperature"
            helpId="param.canonicalSinr.noiseReferenceTemperature"
            accentColor={UI_TOKENS.color.semantic.noise}
            formatValue={value => `${Math.round(value)} K`}
            onChange={noiseReferenceTemperatureK => update({ noiseReferenceTemperatureK: Math.round(noiseReferenceTemperatureK) })}
          />
        </div>
      )}

    </section>
  );
}
