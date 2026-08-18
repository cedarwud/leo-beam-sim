import { useState } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { DEFAULT_SIMULATOR_PARAMETERS, type SimulatorParameters } from '../../simulator/types';
import { CanonicalParameterSection } from './CanonicalParameterPrimitives';
import { CanonicalSinrTabList, type CanonicalSinrSectionKey } from './CanonicalSinrTabList';
import { NumericControl } from './Controls';
import { FormulaFraction, FormulaHeader, FormulaRow } from './FormulaHeader';
import { txBi } from './labels';
import { captionTextStyle, controlStackStyle, groupTitleStyle, pagePanelStyle } from './styles';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

const SINR_ACCENT = UI_TOKENS.color.semantic.tuning;

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
  const [activeSection, setActiveSection] = useState<CanonicalSinrSectionKey>(initialSection);
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
            lhs={<>γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
            numerator={(
              <>
                <span style={{ color: SINR_ACCENT }} data-formula-symbol="link-request-power"><i>p</i><sup>r</sup><sub>u,s,v</sub>(t, θ)</span>
                {' · '}
                <span data-formula-symbol="effective-channel">h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</span>
              </>
            )}
            denominator={(
              <>
                I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) + σ²
              </>
            )}
            numeratorAccent={SINR_ACCENT}
            denominatorAccent={UI_TOKENS.color.semantic.noise}
          />
        </div>
      </FormulaHeader>

      <div style={{ display: 'grid', gap: 7 }}>
        <div style={groupTitleStyle}>{say('homepage.sinr.terms', '公式項目', 'Formula terms')}</div>
        <CanonicalSinrTabList activeSection={activeSection} onChange={setActiveSection} />
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
                  <i>p</i><sup>r</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)
                </>
              )}
              source={isEnglish ? (
                <>
                  <i>p</i><sup>r</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) is the requested link power for γ.
                </>
              ) : (
                <>
                  <i>p</i><sup>r</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) 是 γ 使用的鏈路需求功率。
                </>
              )}
            />
          </div>
          <p style={{ ...captionTextStyle, margin: 0 }}>
            {isEnglish ? (
              <>The γ link term uses the per-user requested link power.</>
            ) : (
              <>γ 的鏈路項使用單一使用者的鏈路需求功率。</>
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
              expression={<>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
              source={isEnglish
                ? <>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) is the composite effective channel used by SINR.</>
                : <>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) 是 SINR 使用的複合有效通道。</>}
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
            effect={say('homepage.sinr.carrierFrequency.effect', '提高頻率會降低傳播增益、提高需求功率；功率上限觸發後，SINR 與速率也會下降。', 'Increasing frequency lowers propagation gain and raises requested power; after a power cap binds, SINR and rate also decrease.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.carrierFrequencyGHz.toFixed(1)} GHz`}
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
            effect={say('homepage.sinr.atmosphericLoss.effect', '提高大氣衰減係數會增加損耗、降低傳播增益，並提高需求功率。', 'Increasing atmospheric attenuation raises loss, lowers propagation gain, and raises requested power.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.atmosphericZenithLossDb.toFixed(2)} dB/km`}
            helpId="param.canonicalSinr.atmosphericLoss"
            accentColor={UI_TOKENS.color.semantic.beam}
            formatValue={value => `${value.toFixed(2)} dB/km`}
            onChange={chiAtm => update({ atmosphericZenithLossDb: chiAtm })}
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
              expression={<>G<sup>T</sup>(θ)</>}
              source={isEnglish
                ? <>G<sup>T</sup>(θ) is the angle-dependent transmit beam gain.</>
                : <>G<sup>T</sup>(θ) 是隨離軸角 θ 變化的發射波束增益。</>}
            />
          </div>
          <NumericControl
            testId="sinr-tab-g0-control"
            symbol={<>G<sub>0</sub></>}
            label={say('homepage.sinr.g0.label', '波束中心發射增益', 'Boresight transmit gain')}
            unit="dBi"
            value={g0Dbi}
            min={0}
            max={40}
            step={0.1}
            description={say('homepage.sinr.g0.description', '波束中心的發射增益。', 'Boresight transmit gain.')}
            effect={say('homepage.sinr.g0.effect', '提高 G₀ 會提高波束增益並降低需求功率；功率上限觸發後，SINR 與速率也會改變。', 'Increasing G₀ raises beam gain and lowers requested power; after a power cap binds, SINR and rate also change.')}
            resetValue={say(
              'homepage.sinr.g0.resetValue',
              `預設 ${defaultG0Dbi.toFixed(1)} dBi`,
              `Default ${defaultG0Dbi.toFixed(1)} dBi`,
            )}
            helpId="param.canonicalSinr.g0"
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
            effect={say('homepage.sinr.theta3db.effect', '調整波束寬會改變離軸增益與需求功率；功率上限觸發後，SINR 與速率也會改變。', 'Changing beam width alters off-axis gain and requested power; after a power cap binds, SINR and rate also change.')}
            resetValue={say(
              'homepage.sinr.theta3db.resetValue',
              `預設 ${defaultThetaDegrees.toFixed(1)}°`,
              `Default ${defaultThetaDegrees.toFixed(1)}°`,
            )}
            helpId="param.canonicalSinr.theta3db"
            accentColor={UI_TOKENS.color.semantic.beam}
            formatValue={value => `${value.toFixed(1)}°`}
            onChange={value => update({ theta3dbRad: value * Math.PI / 180 })}
          />
        </div>
      )}

      {activeSection === 'receiver' && (
        <CanonicalParameterSection
          testId="canonical-sinr-section-receiver"
          title={say('homepage.sinr.receiver.title', '接收增益', 'Receive gain')}
        >
          <div data-testid="canonical-sinr-formula-receiver" data-formula-term="receiver">
            <FormulaRow
              testId="canonical-sinr-receiver-gain"
              accent={UI_TOKENS.color.semantic.fixed}
              emphasis
              expression={<>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
              source={isEnglish
                ? <>Receive gain is included in h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ); it is not shown as a separate SINR factor.</>
                : <>接收增益已納入 h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)，不再作為獨立 SINR 因子顯示。</>}
            />
          </div>
          <NumericControl
            testId="sinr-tab-receiver-gain-control"
            symbol={null}
            label={say('homepage.sinr.receiverGain.label', '接收增益（對數值）', 'Receive gain (log value)')}
            unit="dB"
            value={parameters.receiveGainDbi}
            min={-10}
            max={60}
            step={0.5}
            description={say('homepage.sinr.receiverGain.description', '接收增益的對數值；依公式轉換後進入複合通道。', 'Logarithmic receive gain; converted by the formula before entering the composite channel.')}
            effect={say('homepage.sinr.receiverGain.effect', '提高接收增益會提高訊號功率、降低需求功率；功率上限觸發後，SINR 與速率也會提高。', 'Increasing receive gain raises signal power and lowers requested power; after a power cap binds, SINR and rate also increase.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.receiveGainDbi.toFixed(1)} dB`}
            helpId="param.canonicalSinr.receiverGain"
            accentColor={UI_TOKENS.color.semantic.beam}
            formatValue={value => `${value.toFixed(1)} dB`}
            onChange={receiveGainDbi => update({ receiveGainDbi })}
          />
        </CanonicalParameterSection>
      )}

      {activeSection === 'interference' && (
        <CanonicalParameterSection
          testId="canonical-sinr-section-interference"
          title={say('homepage.sinr.interference.title', '同頻干擾', 'Co-channel interference')}
        >
          <div data-testid="canonical-sinr-interference-full-formula" data-formula-term="sinr">
            <FormulaFraction
              lhs={<>γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
              numerator={(
                <>
                  <i>p</i><sup>r</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)
                  {' · '}
                  h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)
                </>
              )}
              denominator={<>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) + σ²</>}
              numeratorAccent={SINR_ACCENT}
              denominatorAccent={UI_TOKENS.color.semantic.noise}
            />
          </div>
          <div data-testid="canonical-sinr-formula-interference" data-formula-term="interference">
            <FormulaRow
              testId="canonical-sinr-interference-decomposition"
              accent="#ff8a6b"
              emphasis
              expression={<>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ)</>}
              source={isEnglish ? (
                <>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) is the total co-channel interference used by the SINR equation.</>
              ) : (
                <>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) 是 SINR 式使用的總同頻干擾。</>
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
            description={say('homepage.sinr.frequencyReuse.description', '將系統頻寬分成指定數量的重用群組；這會決定哪些作用中波束共同形成 I_{u,s,v}(t,θ)，也會改變每道波束頻寬。', 'Splits system bandwidth into the selected number of reuse groups; this determines which active beams contribute to I_{u,s,v}(t,θ) and changes per-beam bandwidth.')}
            effect={say('homepage.sinr.frequencyReuse.effect', '增加重用群組數會改變 I_{u,s,v}(t,θ) 的同頻波束集合，並降低每道波束頻寬與 σ²。', 'Increasing the reuse-group count changes the co-channel contributors to I_{u,s,v}(t,θ) and lowers per-beam bandwidth and σ².')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.frequencyReuse}`}
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
              expression={<>σ²</>}
              source={isEnglish
                ? <>σ² is the receiver noise power paired with I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) in SINR.</>
                : <>σ² 是與 I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, θ) 一起進入 SINR 的接收端雜訊功率。</>}
            />
          </div>
          <NumericControl
            testId="sinr-tab-antenna-noise-temperature-control"
            symbol={null}
            label={say('homepage.sinr.antennaNoiseTemperature.label', '天線噪聲溫度', 'Antenna-noise temperature')}
            unit="K"
            value={parameters.antennaNoiseTemperatureK}
            min={1}
            max={2_000}
            step={1}
            description={say('homepage.sinr.antennaNoiseTemperature.description', '接收天線本身的等效噪聲溫度，會進入系統噪聲溫度。', 'Equivalent receive-antenna noise temperature; it contributes to system noise temperature.')}
            effect={say('homepage.sinr.antennaNoiseTemperature.effect', '提高後會增加系統噪聲溫度與 σ²，進而提高需求功率；若功率上限觸發，SINR、Throughput 與 EE 也會下降。', 'Increasing it raises system noise temperature and σ², then requested power; if a power cap binds, SINR, throughput, and EE also fall.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK} K`}
            helpId="param.canonicalSinr.antennaNoiseTemperature"
            accentColor={UI_TOKENS.color.semantic.noise}
            formatValue={value => `${Math.round(value)} K`}
            onChange={antennaNoiseTemperatureK => update({ antennaNoiseTemperatureK })}
          />
          <NumericControl
            testId="sinr-tab-noise-figure-control"
            symbol={null}
            label={say('homepage.sinr.noiseFigure.label', '雜訊指數', 'Noise figure')}
            unit="dB"
            value={parameters.noiseFigureDb}
            min={0}
            max={20}
            step={0.1}
            description={say('homepage.sinr.noiseFigure.description', '接收鏈的雜訊指數；先轉為噪聲因子，再與參考溫度組合。', 'Receiver-chain noise figure; converted to a noise factor before combining with the reference temperature.')}
            effect={say('homepage.sinr.noiseFigure.effect', '提高雜訊指數會增加系統噪聲溫度、σ² 與需求功率。', 'Increasing noise figure raises system noise temperature, σ², and requested power.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.noiseFigureDb.toFixed(1)} dB`}
            helpId="param.canonicalSinr.noiseFigure"
            accentColor={UI_TOKENS.color.semantic.noise}
            formatValue={value => `${value.toFixed(1)} dB`}
            onChange={noiseFigureDb => update({ noiseFigureDb })}
          />
          <NumericControl
            testId="sinr-tab-noise-reference-temperature-control"
            symbol={null}
            label={say('homepage.sinr.noiseReferenceTemperature.label', '參考溫度', 'Reference temperature')}
            unit="K"
            value={parameters.noiseReferenceTemperatureK}
            min={1}
            max={2_000}
            step={1}
            description={say('homepage.sinr.noiseReferenceTemperature.description', '由雜訊指數換算等效噪聲溫度時使用的參考溫度。', 'Reference temperature used to convert noise figure into equivalent noise temperature.')}
            effect={say('homepage.sinr.noiseReferenceTemperature.effect', '提高參考溫度會增加系統噪聲溫度與 σ²，並提高需求功率。', 'Increasing reference temperature raises system noise temperature, σ², and requested power.')}
            resetValue={`${DEFAULT_SIMULATOR_PARAMETERS.noiseReferenceTemperatureK} K`}
            helpId="param.canonicalSinr.noiseReferenceTemperature"
            accentColor={UI_TOKENS.color.semantic.noise}
            formatValue={value => `${Math.round(value)} K`}
            onChange={noiseReferenceTemperatureK => update({ noiseReferenceTemperatureK })}
          />
        </div>
      )}

    </section>
  );
}
