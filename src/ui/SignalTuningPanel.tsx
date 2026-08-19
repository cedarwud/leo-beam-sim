import { useState, type ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
import {
  DEFAULT_BEAM_LAYOUT_COUNT,
  isSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from '../core/beam/completeHexPresets';
import { useLocale } from '../i18n';
import {
  DEFAULT_TR38811_CHANNEL,
  type GainModel,
  type PathLossComponent,
  type Profile,
} from '../profiles/types';
import type { LinkBudgetTerms } from '../scene/types';
import {
  PATH_LOSS_COMPONENT_ORDER,
  type SignalTuningState,
} from '../signalTuning';
import {
  createSceneTopologyState,
  type SceneTopologyState,
} from '../sceneTopology';
import type { SceneVisualScaleState } from '../sceneVisualScale';
import {
  FormulaSideControlSection,
  LossControlSection,
  NoiseFloorReadout,
} from './signal-tuning/ControlSections';
import { HelpPopover } from './common/HelpPopover';
import { NumericControl, PathLossTermControl, SelectControl } from './signal-tuning/Controls';
import { FormulaFraction, FormulaHeader, FormulaRow, InlineFormulaFraction } from './signal-tuning/FormulaHeader';
import { FormulaTabList } from './signal-tuning/FormulaTabList';
import { MainTabList } from './signal-tuning/MainTabList';
import { ScenarioDataTab } from './signal-tuning/ScenarioDataTab';
import { TopologyTab } from './signal-tuning/TopologyTab';
import { WalkerEeTab } from './signal-tuning/WalkerEeTab';
import { WalkerPowerTab } from './signal-tuning/WalkerPowerTab';
import { WalkerThroughputTab } from './signal-tuning/WalkerThroughputTab';
import { tx, txBi } from './signal-tuning/labels';
import {
  FREQUENCY_REUSE_OPTIONS,
  GAIN_MODEL_OPTIONS,
  PATH_LOSS_LABELS,
  getFormulaTabAccent,
  getGainModelDetailCopy,
} from './signal-tuning/tuningConfig';
import {
  captionTextStyle,
  controlStackStyle,
  dividerStyle,
  drawerContentStyle,
  groupTitleStyle,
  pagePanelStyle,
  panelStyle,
  srOnlyStyle,
} from './signal-tuning/styles';
import type { MainTabKey, TuningTabKey } from './signal-tuning/types';
// The same grouping function the link budget interferes by, so the panel's
// frequency row cannot drift from the engine.
import { getBeamFrequencyIndex } from '../utils/beamFrequency';
import { formatDbi } from './signal-tuning/formatters';
import type { AppExperienceMode } from './appMode';
import {
  SIMPLIFIED_EE_LINK_INDEX,
} from './signal-tuning/simplifiedEeSymbols';
import { LinkAngle, SystemAngleState } from './signal-tuning/FormulaSymbols';

/**
 * Left panel for the active canonical analysis surface.
 *
 * The visible top level is exactly four projections of one immutable frame:
 * SINR, EE, Power and Throughput. Long explanations are not printed under every
 * slider: each control's label row ends in a "?" that opens a localized
 * definition + "what changes if I move this" (HelpPopover,
 * `placement="left"`).
 *
 * The hidden `scene` and `handover` branches remain compatibility consumers for
 * older deep links and validators; MainTabList does not expose them on the
 * canonical homepage.
 *
 * The visible SINR strip presents four formula terms (p, h, I, σ²). Legacy
 * loss / beam / receiver-gain keys remain non-rendered aliases so older deep
 * links and provenance selectors continue to resolve without adding extra
 * user-facing tabs.
 */

interface SignalTuningPanelProps {
  baseProfile: Profile;
  tuning: SignalTuningState;
  topology: SceneTopologyState;
  sceneVisualScale: SceneVisualScaleState;
  hasOverrides: boolean;
  appMode: AppExperienceMode;
  formulaBudget: LinkBudgetTerms | null;
  isFormulaEvidenceStale?: boolean;
  initialActiveTab?: TuningTabKey;
  initialMainTab?: MainTabKey;
  onTuningChange: (next: SignalTuningState) => void;
  onTopologyChange: (next: SceneTopologyState) => void;
  /** Current cell-truth serving satellite used by the legacy live scene. */
  readonly servingSatelliteId?: string | null;
  /** Current cell-truth comparison/pending satellite used by the legacy live scene. */
  readonly candidateSatelliteId?: string | null;
  /** Current primary-link values projected from the same live canonical frame as the right rail. */
  readonly linkThroughputMbps?: number | null;
  readonly linkEeMbitPerJ?: number | null;
  onSceneVisualScaleChange: (next: SceneVisualScaleState) => void;
  onReset: () => void;
  /**
   * Slot for the handover-timing controls, rendered as this panel's third
   * topic. It arrives as a node rather than as prop-drilled state so this file
   * stays a pure formula/tuning surface with no handover-manager wiring of its
   * own; when the app supplies nothing, the third tab simply does not exist.
   */
  readonly handoverPolicySection?: ReactNode;
}

export function SignalTuningPanel({
  baseProfile,
  tuning,
  topology,
  sceneVisualScale,
  hasOverrides,
  appMode,
  formulaBudget,
  isFormulaEvidenceStale = false,
  initialActiveTab = 'signal-power',
  initialMainTab = 'sinr',
  onTuningChange,
  onTopologyChange,
  servingSatelliteId,
  candidateSatelliteId,
  linkThroughputMbps = null,
  linkEeMbitPerJ = null,
  onSceneVisualScaleChange,
  onReset,
  handoverPolicySection,
}: SignalTuningPanelProps) {
  const [mainTab, setMainTab] = useState<MainTabKey>(initialMainTab);
  const [activeTab, setActiveTab] = useState<TuningTabKey>(initialActiveTab);
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  /** Localized string with a locale-appropriate literal when the key is missing. */
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

  // The panel is always mounted expanded in the tuning drawer; the former
  // presentation/diagnostics collapse was driven by the now-removed UI-mode
  // switch, so the collapsed handle/styles are gone.
  const isTr38811Formula = baseProfile.formulaFamily === 'hobs-tr38811';
  const showEffectiveChannelControls = activeTab === 'channel';
  const showLossControls = showEffectiveChannelControls || activeTab === 'loss';
  const showBeamControls = showEffectiveChannelControls || activeTab === 'beam';
  const showReceiverControls = showEffectiveChannelControls || activeTab === 'receiver-gain';
  const fsplEnabled = tuning.pathLossComponents.includes('fspl');
  const atmosphericEnabled = tuning.pathLossComponents.includes('atmospheric');
  const scintillationEnabled = tuning.pathLossComponents.includes('scintillation');
  const shadowFadingEnabled = tuning.pathLossComponents.includes('shadow-fading');
  const tr38811Environment = baseProfile.channel.tr38811?.environment ?? DEFAULT_TR38811_CHANNEL.environment;

  // K's whole effect is HOW MANY beams end up co-channel, so the interference
  // section states that count instead of leaving the student to derive it from
  // the modulo. `link-budget.ts` groups by F(b) = (b-1) mod K over the beam id,
  // so group g holds every b with (b-1) % K === g — sizes differ by at most one
  // when K does not divide the beam count, hence the min/max pair rather than a
  // single rounded number.
  const beamsPerSatellite = Math.max(1, Math.trunc(baseProfile.beams.perSatellite));
  const scenarioBeamLayoutCount: SupportedBeamLayoutCount = topology.beamCountPerSatellite !== null
    && isSupportedBeamLayoutCount(topology.beamCountPerSatellite)
    ? topology.beamCountPerSatellite
    : isSupportedBeamLayoutCount(beamsPerSatellite)
      ? beamsPerSatellite
      : DEFAULT_BEAM_LAYOUT_COUNT;
  const reuseGroupCount = Math.max(1, Math.trunc(tuning.frequencyReuse));
  const frequencyLabel = say('section.interference.frequencyLabel', '頻率', 'Frequency');
  const coChannelGroupMin = Math.floor(beamsPerSatellite / reuseGroupCount);
  const coChannelGroupMax = Math.ceil(beamsPerSatellite / reuseGroupCount);
  const formatGroupRange = (min: number, max: number) => (
    min === max ? `${min}` : `${min}–${max}`
  );
  const coChannelPerSat = formatGroupRange(coChannelGroupMin, coChannelGroupMax);
  // Same satellite: the serving beam itself is excluded from its own interference.
  const intraInterfererCount = formatGroupRange(
    Math.max(0, coChannelGroupMin - 1),
    Math.max(0, coChannelGroupMax - 1),
  );

  const update = (patch: Partial<SignalTuningState>) => {
    onTuningChange({ ...tuning, ...patch });
  };

  const togglePathLossComponent = (component: PathLossComponent) => {
    const selected = new Set(tuning.pathLossComponents);
    if (selected.has(component)) {
      selected.delete(component);
    } else {
      selected.add(component);
    }
    update({
      pathLossComponents: PATH_LOSS_COMPONENT_ORDER.filter(entry => selected.has(entry)),
    });
  };

  return (
    <aside
      className="leo-signal-tuning-panel"
      data-drawer-state="tuning"
      aria-label={say('panel.tuning.ariaLabel', '訊號與能源參數面板', 'Signal and energy tuning controls')}
      aria-expanded
      style={panelStyle}
    >
      <div
        className="leo-signal-tuning-content"
        data-testid="signal-tuning-drawer-content"
        style={drawerContentStyle}
      >
        <MainTabList
          activeTab={mainTab}
          showHandoverTab={handoverPolicySection != null}
          onChange={setMainTab}
        />

        {mainTab === 'scenario' && (
          <ScenarioDataTab
            connection="live-scene"
            constellation={topology.constellation}
            onConstellationChange={constellation => onTopologyChange({ ...topology, constellation })}
            beamLayoutCount={scenarioBeamLayoutCount}
            onBeamLayoutCountChange={(next: SupportedBeamLayoutCount) => onTopologyChange({
              ...topology,
              beamCountPerSatellite: next,
            })}
            servingBeamLayoutCount={topology.servingBeamCount ?? scenarioBeamLayoutCount}
            onServingBeamLayoutCountChange={(servingBeamCount: SupportedBeamLayoutCount) => onTopologyChange({
              ...topology,
              servingBeamCount,
            })}
            candidateBeamLayoutCount={topology.candidateBeamCount ?? scenarioBeamLayoutCount}
            onCandidateBeamLayoutCountChange={(candidateBeamCount: SupportedBeamLayoutCount) => onTopologyChange({
              ...topology,
              candidateBeamCount,
            })}
          />
        )}

        {mainTab === 'energy' && (
          <WalkerEeTab linkEeMbitPerJ={linkEeMbitPerJ} />
        )}
        {mainTab === 'power' && (
          <WalkerPowerTab
            baseProfile={baseProfile}
            tuning={tuning}
            onTuningChange={onTuningChange}
          />
        )}
        {mainTab === 'throughput' && (
          <WalkerThroughputTab linkThroughputMbps={linkThroughputMbps} />
        )}

        <div>

        {mainTab === 'sinr' && (
        <section
          id="tuning-page-panel-sinr-formula"
          data-testid="sinr-formula-page"
          role="tabpanel"
          aria-label={t('tab.sinr.label')}
          style={pagePanelStyle}
        >
          {/* The whole SINR expression, first thing on the tab. No prose sits
              under it: the "what does this mean" paragraph is served from the
              "?" so the header stays a formula and nothing else. */}
          <FormulaHeader
            testId="sinr-formula-header"
            title={t('tab.sinr.heading')}
            accent={UI_TOKENS.color.semantic.tuning}
            align="center"
            help={{
              helpId: 'formula.sinr',
              body: say(
                'formula.sinr.presentationHelp',
                'γ 使用鏈路 (u,s,v) 的 RF 功率 p 與有效通道 h 形成訊號，分母使用總干擾 I 與 σ²。',
                'γ uses link RF power p and effective channel h for link (u,s,v), with total interference I and σ² in the denominator.',
              ),
              effect: say(
                'formula.sinr.presentationEffect',
                'h_{u,s,v}(t,θ) 與 p_{u,s,v}(t,θ) 使用同一條鏈路的角度參數。',
                'h_{u,s,v}(t,θ) and p_{u,s,v}(t,θ) use the same link angle parameter.',
              ),
            }}
            // The only "reset the signal parameters" entry point in the panel.
            // It used to live inside the run-configuration block below, which is
            // no longer on screen, so it moves up here next to the formula it
            // resets rather than disappearing with its old host.
            action={(
              <button
                className={UI_CLASSES.button}
                type="button"
                data-testid="sinr-tuning-reset"
                onClick={onReset}
                disabled={!hasOverrides}
                style={{
                  cursor: hasOverrides ? 'pointer' : 'default',
                  padding: '6px 10px',
                  borderRadius: UI_TOKENS.radius.md,
                  border: hasOverrides
                    ? '1px solid rgba(20, 135, 121, 0.38)'
                    : `1px solid ${UI_TOKENS.color.border.subtle}`,
                  background: hasOverrides
                    ? 'rgba(118, 234, 215, 0.16)'
                    : UI_TOKENS.color.surface.cardFaint,
                  color: hasOverrides
                    ? UI_TOKENS.color.semantic.tuning
                    : UI_TOKENS.color.text.faint,
                  fontSize: UI_TOKENS.type.size.body,
                  fontWeight: UI_TOKENS.type.weight.strong,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('common.reset')}
              </button>
            )}
          >
            {/*
              Every symbol is painted in the accent of the sub-tab that owns it,
              read straight from `getFormulaTabAccent` so the two can never drift
              apart.
            */}
            <FormulaFraction
              lhs={<>γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              numerator={(
                <>
                  <span style={{ color: getFormulaTabAccent('signal-power') }}><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</span>
                  {' · '}
                  <span style={{ color: getFormulaTabAccent('loss') }}>h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />)</span>
                </>
              )}
              denominator={(
                <>
                  <span style={{ color: getFormulaTabAccent('interference') }}>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</span>
                  {' + '}
                  <span style={{ color: getFormulaTabAccent('thermal-noise') }}>σ²</span>
                </>
              )}
              numeratorAccent={UI_TOKENS.color.semantic.tuning}
              denominatorAccent={UI_TOKENS.color.semantic.noise}
            />
          </FormulaHeader>

          <div style={{ display: 'grid', gap: 7 }}>
            <div style={groupTitleStyle}>
              {say('section.sinrTerms.title', 'SINR', 'SINR')}
            </div>
            <FormulaTabList activeTab={activeTab} appMode={appMode} onChange={setActiveTab} />
          </div>

          {showEffectiveChannelControls && (
            <div
              data-testid="effective-channel-composition"
              data-formula-term="channel"
              style={{ display: 'grid', gap: 7 }}
            >
              <div style={groupTitleStyle}>
                {say('section.effectiveChannelFormula.primaryTitle', '主要展開', 'Primary expansion')}
              </div>
              <FormulaRow
                testId="effective-channel-composition-formula"
                accent={UI_TOKENS.color.semantic.loss}
                emphasis
                expression={(
                  <>
                    h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />) = H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) · G<sup>T</sup>(<LinkAngle />)
                  </>
                )}
                source={say(
                  'section.effectiveChannelFormula.source',
                  'H 收合傳播與接收端因素；G^T(θ) 將離軸角帶入有效通道。',
                  'H collects propagation and receive-side factors; G^T(θ) carries the off-axis angle into the effective channel.',
                )}
              />
              <div
                data-testid="effective-channel-detail"
                style={{ display: 'grid', gap: 4 }}
              >
                <div style={groupTitleStyle}>
                  {say('section.effectiveChannelFormula.detailTitle', '細部展開', 'Detailed expansion')}
                </div>
                <FormulaRow
                  testId="effective-channel-detail-formula"
                  accent={UI_TOKENS.color.semantic.fixed}
                  expression={(
                    <>
                      H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) = G<sup>LS</sup><sub>u,s</sub> · G<sup>R</sup><sub>u,s</sub> · g<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)
                    </>
                  )}
                  source={say(
                    'section.effectiveChannelFormula.detailSource',
                    'H 由大尺度通道因素 G^LS、接收端增益 G^R 與小尺度因素 g 組成；因此下方控制項都有對應來源。',
                    'H is composed of the large-scale factor G^LS, receive-side gain G^R, and small-scale factor g; the controls below now have an explicit source.',
                  )}
                />
              </div>
            </div>
          )}

          {activeTab === 'signal-power' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="signal-power-controls"
                helpId="section.signalPower"
                side="numerator"
                title="RF output"
                titleText={say('section.signalPower.title', '實際 RF 輸出', 'Actual RF output')}
                formula={<><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
                formulaExpr={(
                  <>
                    <i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)
                  </>
                )}
                subtitle="Actual RF output is shared by the signal and interference paths."
                subtitleText={say(
                  'section.signalPower.hint',
                  'p_{u,s,v}(t,θ) 是訊號與干擾路徑共同使用的鏈路 RF 功率。',
                  'p_{u,s,v}(t,θ) is the link RF power shared by the signal and interference paths.',
                )}
                contextPlacement="hidden"
              >
                <FormulaRow
                  testId="signal-power-output-formula"
                  accent={getFormulaTabAccent('signal-power')}
                  emphasis
                  expression={(
                    <span style={{ display: 'grid', gap: 3, justifyItems: 'center' }}>
                      <span><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</span>
                      <span>= <i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t₀, θ⁰) · <InlineFormulaFraction
                        numerator={<>G<sup>T</sup>(θ⁰)</>}
                        denominator={<>G<sup>T</sup>(θ)</>}
                        label="reference transmit gain divided by current transmit gain"
                      /></span>
                    </span>
                  )}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {showReceiverControls && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="receiver-gain-controls"
                helpId="section.receiverGain"
                side="numerator"
                title="Receive-side gain"
                titleText={say('section.receiverGain.title', '接收端增益', 'Receive-side gain')}
                formula={<>G<sup>R</sup></>}
                formulaExpr={<>G<sup>R</sup></>}
                subtitle="G^R is the receive-side factor collected inside H."
                subtitleText={say(
                  'section.receiverGain.hint',
                  'G^R 是收合在 H 中的接收端因素。',
                  'G^R is the receive-side factor collected inside H.',
                )}
                contextPlacement={showEffectiveChannelControls ? 'hidden' : 'trailing'}
                accentColor={UI_TOKENS.color.semantic.fixed}
              >
                <NumericControl
                  testId="gr-receiver-gain-control"
                  symbol={<>G<sup>R</sup></>}
                  label="Receiver gain"
                  labelKey="param.ueAntennaMaxGainDbi.label"
                  unit="dBi"
                  unitKey="param.ueAntennaMaxGainDbi.unit"
                  value={tuning.ueAntennaMaxGainDbi}
                  min={-10}
                  max={20}
                  step={0.5}
                  description="Receive-side gain contribution included in the composite channel factor."
                  effect="Adjusting it changes the effective channel factor used by the link."
                  helpId="param.ueAntennaMaxGainDbi"
                  accentColor={UI_TOKENS.color.semantic.fixed}
                  formatValue={formatDbi}
                  onChange={ueAntennaMaxGainDbi => update({ ueAntennaMaxGainDbi })}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {activeTab === 'thermal-noise' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="thermal-noise-controls"
                helpId="section.thermalNoise"
                contextPlacement="leading"
                side="denominator"
                title="Thermal noise"
                titleText={say('section.thermalNoise.title', '熱雜訊', 'Thermal noise')}
                formula={<>σ² = B<sup>w</sup> · <i>N</i><sub>0</sub></>}
                formulaExpr={<>σ² = B<sup>w</sup> · <i>N</i><sub>0</sub></>}
                subtitle={<>σ² is formed by multiplying channel bandwidth B^w by noise density N₀.</>}
                subtitleText={say(
                  'section.thermalNoise.hint',
                  'σ² 由通道頻寬 B^w 與雜訊功率密度 N₀ 相乘得到。',
                  'σ² is formed by multiplying channel bandwidth B^w by noise density N₀.',
                )}
                accentColor={UI_TOKENS.color.semantic.noise}
              >
                <NoiseFloorReadout
                  formulaBudget={formulaBudget}
                  isFormulaEvidenceStale={isFormulaEvidenceStale}
                />
                <NumericControl
                  testId="bandwidth-thermal-noise-control"
                  symbol={<>B<sup>w</sup></>}
                  label="Channel bandwidth"
                  labelKey="param.bandwidthMHz.label"
                  unit="MHz"
                  unitKey="param.bandwidthMHz.unit"
                  value={tuning.bandwidthMHz}
                  min={5}
                  max={400}
                  step={5}
                  description="Bandwidth input used by the noise path."
                  effect="Wider bandwidth raises σ²."
                  helpId="param.bandwidthMHz"
                  accentColor={UI_TOKENS.color.semantic.noise}
                  formatValue={value => `${value.toFixed(0)} MHz`}
                  onChange={bandwidthMHz => update({ bandwidthMHz })}
                />
                <NumericControl
                  testId="n0-thermal-noise-control"
                  symbol={<><i>N</i><sub>0</sub></>}
                  label="Noise PSD"
                  labelKey="param.noisePsdDbmHz.label"
                  unit="dBm/Hz"
                  unitKey="param.noisePsdDbmHz.unit"
                  value={tuning.noisePsdDbmHz}
                  min={-180}
                  max={-160}
                  step={0.5}
                  description="Noise-density input used by the noise path."
                  effect="A higher noise density raises σ²."
                  helpId="param.noisePsdDbmHz"
                  accentColor={UI_TOKENS.color.semantic.noiseSoft}
                  onChange={noisePsdDbmHz => update({ noisePsdDbmHz })}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {showLossControls && (
            <div style={controlStackStyle}>
              <LossControlSection
                testId="loss-formula-controls"
                title="Propagation factors"
                titleText={showEffectiveChannelControls
                  ? say('section.pathLoss.groupTitle', '傳播因素', 'Propagation factors')
                  : say('section.pathLoss.title', '有效通道 H', 'Effective channel H')}
                // The stack expression goes through `formulaExpr`, not
                // `subtitle`: a subtitle renders in the prose caption box at
                // `size.caption` (16px), which is why this formula read smaller
                // than every other formula in the panel. `formulaExpr` puts it
                // on the same rendering path as the numerator/denominator
                // sections. `subtitle` keeps the identical canonical markup so
                // the hidden provenance copy is unchanged.
                // NOTATION RULE: this page's sliders are the L stack, while the
                // simplified numerator term is h. The bridge belongs HERE, on the
                // page that owns the sliders, so the visible tab remains the
                // single effective-channel symbol h.
                subtitle={<>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>}
                formulaExpr={showEffectiveChannelControls
                  ? (
                    <>
                      G<sup>LS</sup><sub>u,s</sub> ← L<sup>FS</sup>(<i>f</i><sub>c</sub>, d<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)) + L<sup>atm</sup>(χ<sub>atm</sub>) + L<sup>sc</sup> + L<sup>sf</sup>
                    </>
                  )
                  : <>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>}
                helpId={showEffectiveChannelControls ? 'section.pathLoss' : undefined}
                subtitleText={showEffectiveChannelControls
                  ? say(
                    'section.effectiveChannelFormula.pathLossSource',
                    'G^LS 收合自由空間、大氣、閃爍與陰影衰落因素；f_c 與 d 位於自由空間損耗的輸入中。',
                    'G^LS collects free-space, atmospheric, scintillation, and shadow-fading factors; f_c and d are inputs to free-space loss.',
                  )
                  : undefined}
              >
                <PathLossTermControl
                  testId="path-loss-term-fspl"
                  active={fsplEnabled}
                  symbol={<><i>f</i><sub>c</sub></>}
                  label="Free-space loss"
                  labelText={say('param.frequencyGHz.termLabel', '自由空間損耗', 'Free-space loss')}
                  detail={PATH_LOSS_LABELS.fspl.detail}
                  controlLabel="Carrier frequency"
                  controlLabelText={tx(t, 'param.frequencyGHz.label', 'Carrier frequency')}
                  unit="GHz"
                  unitKey="param.frequencyGHz.unit"
                  value={tuning.frequencyGHz}
                  min={10}
                  max={40}
                  step={0.5}
                  effect="Higher frequency changes the composite channel factor."
                  inactiveReason="Not contributing while this propagation term is off."
                  helpId="param.frequencyGHz"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(1)} GHz`}
                  onToggle={() => togglePathLossComponent('fspl')}
                  onChange={frequencyGHz => update({ frequencyGHz })}
                />
                <PathLossTermControl
                  testId="path-loss-term-atmospheric"
                  active={atmosphericEnabled}
                  symbol={<>χ<sub>atm</sub></>}
                  label="Gas absorption"
                  labelText={say('param.atmosphericZenithLossDb.termLabel', '大氣吸收', 'Gas absorption')}
                  detail={PATH_LOSS_LABELS.atmospheric.detail}
                  controlLabel="Zenith loss"
                  controlLabelText={tx(t, 'param.atmosphericZenithLossDb.label', 'Zenith loss')}
                  unit="dB"
                  unitKey="param.atmosphericZenithLossDb.unit"
                  value={tuning.atmosphericZenithLossDb}
                  min={0}
                  max={1}
                  step={0.01}
                  effect="Enabling it changes the composite channel factor."
                  inactiveReason="Not contributing while this propagation term is off."
                  helpId="param.atmosphericZenithLossDb"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(2)} dB`}
                  onToggle={() => togglePathLossComponent('atmospheric')}
                  onChange={atmosphericZenithLossDb => update({ atmosphericZenithLossDb })}
                />
                <PathLossTermControl
                  testId="path-loss-term-scintillation"
                  active={scintillationEnabled}
                  symbol={<>L<sup>sc</sup></>}
                  label="Scintillation"
                  labelText={say('param.scintillationScaleDb.termLabel', '閃爍衰落', 'Scintillation')}
                  detail={PATH_LOSS_LABELS.scintillation.detail}
                  controlLabel="Scale"
                  controlLabelText={tx(t, 'param.scintillationScaleDb.label', 'Scale')}
                  unit="dB"
                  unitKey="param.scintillationScaleDb.unit"
                  value={tuning.scintillationScaleDb}
                  min={0}
                  max={1}
                  step={0.01}
                  effect="Enabling it changes the composite channel factor."
                  inactiveReason="Not contributing while this propagation term is off."
                  helpId="param.scintillationScaleDb"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(2)} dB`}
                  onToggle={() => togglePathLossComponent('scintillation')}
                  onChange={scintillationScaleDb => update({ scintillationScaleDb })}
                />
                <PathLossTermControl
                  testId="path-loss-term-shadow-fading"
                  active={shadowFadingEnabled}
                  symbol={<>L<sup>sf</sup></>}
                  label="Shadow fading"
                  labelText={say('param.shadowFadingMarginDb.termLabel', '陰影衰落', 'Shadow fading')}
                  detail={PATH_LOSS_LABELS['shadow-fading'].detail}
                  controlLabel="Margin"
                  controlLabelText={tx(t, 'param.shadowFadingMarginDb.label', 'Margin')}
                  unit="dB"
                  unitKey="param.shadowFadingMarginDb.unit"
                  value={tuning.shadowFadingMarginDb}
                  min={0}
                  max={10}
                  step={0.1}
                  effect="Enabling it changes the composite channel factor."
                  inactiveReason="Not contributing while this propagation term is off."
                  helpId="param.shadowFadingMarginDb"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  onToggle={() => togglePathLossComponent('shadow-fading')}
                  onChange={shadowFadingMarginDb => update({ shadowFadingMarginDb })}
                />
              </LossControlSection>

              {/*
                Both of this card's children were already gated on
                `isTr38811Formula` while the card itself was not, so on the five
                `hobs-legacy` profiles it rendered as a heading and a border
                around nothing — a section a student cannot open.

                The group is still MOUNTED on every profile, because the
                provenance gates locate it by `data-testid` regardless of formula
                family; what changes is that it is only VISIBLE where it has
                content. Under `hobs-2024-tr38811-research` the clutter-loss
                control and the environment readout are real and appear as
                before; elsewhere the whole card collapses to an aria-hidden,
                zero-height block.
              */}
              <div
                style={isTr38811Formula ? undefined : srOnlyStyle}
                aria-hidden={isTr38811Formula ? undefined : 'true'}
                data-prominence={isTr38811Formula ? undefined : 'canonical-copy'}
              >
                <LossControlSection
                  testId="loss-sensitivity-controls"
                  title="TR 38.811 Sensitivity"
                  titleText={say('section.tr38811.title', '進階：非視距（NLoS）情境', 'Advanced: non-line-of-sight (NLoS) cases')}
                  tone="research"
                  helpId="section.tr38811"
                  subtitle="Advanced sensitivity controls for simulator constants. TR 38.811 NLoS sensitivity control; common loss terms are grouped above with their switches."
                  subtitleText={say(
                    'section.tr38811.hint',
                    '進階參數：僅套用於判定為非視距（NLoS）的取樣點，用於敏感度分析。一般傳播損耗項位於「路徑損耗」區塊。',
                    'Advanced parameter: applies only to samples classified as non-line-of-sight (NLoS), for sensitivity analysis. The ordinary propagation-loss terms are in the path-loss section.',
                  )}
                >
                  {isTr38811Formula && (
                    <NumericControl
                      testId="lcl-nlos-control"
                      symbol={null}
                      label="NLoS clutter loss"
                      labelKey="param.tr38811NlosClutterLossDb.label"
                      unit="dB"
                      unitKey="param.tr38811NlosClutterLossDb.unit"
                      value={tuning.tr38811NlosClutterLossDb}
                      min={0}
                      max={40}
                      step={0.5}
                      description="TR 38.811 NLoS clutter sensitivity control for seeded NLoS samples only."
                      effect="Editable in the TR 38.811 profile; changing it affects only seeded NLoS samples. Seeded LoS samples do not change."
                      helpId="param.tr38811NlosClutterLossDb"
                      accentColor={UI_TOKENS.color.semantic.fixed}
                      onChange={tr38811NlosClutterLossDb => update({ tr38811NlosClutterLossDb })}
                    />
                  )}
                  {isTr38811Formula && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 11px',
                      borderRadius: UI_TOKENS.radius.md,
                      background: 'rgba(255, 255, 255, 0.035)',
                      border: '1px solid rgba(255, 214, 125, 0.12)',
                      color: 'rgba(255, 230, 173, 0.78)',
                      fontSize: UI_TOKENS.type.size.caption,
                      lineHeight: 1.45,
                    }}>
                      <span style={{ fontWeight: UI_TOKENS.type.weight.heavy }}>
                        {say('section.tr38811.environment', '模擬環境', 'Simulated environment')}: {tr38811Environment}
                      </span>
                      {/* Canonical copy for the read-only-environment gate; the
                          student just sees which environment is in use. */}
                      <span aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
                        TR 38.811 LoS environment: {tr38811Environment}. Used in Phase 8B; no editable environment selector is provided.
                      </span>
                    </div>
                  )}
                </LossControlSection>
              </div>
            </div>
          )}

          {showBeamControls && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="beam-gain-controls"
                helpId="section.beamGain"
                contextPlacement={showEffectiveChannelControls ? 'hidden' : 'leading'}
                side="numerator"
                title="Angle-dependent transmit gain"
                titleText={say('section.beamGain.title', '角度相關發射增益', 'Angle-dependent transmit gain')}
                formula={<>G<sup>T</sup>(<LinkAngle />)</>}
                subtitle="G^T(θ) is the angle-dependent transmit-gain factor."
                subtitleText={say(
                  'section.beamGain.hint',
                  'G^T(θ) 是有效通道中的發射增益因素。',
                  'G^T(θ) is the transmit-gain factor inside the effective channel.',
                )}
                accentColor={UI_TOKENS.color.semantic.beam}
              >
                <NumericControl
                  testId="gtmax-transmit-gain-control"
                  symbol={<>G<sub>0</sub></>}
                  label="Max transmit gain"
                  labelKey="param.maxGainDbi.label"
                  unit="dBi"
                  unitKey="param.maxGainDbi.unit"
                  value={tuning.maxGainDbi}
                  min={20}
                  max={60}
                  step={0.5}
                  description="Peak-gain input for the angle-dependent transmit factor."
                  effect="Raising it changes the angle-dependent transmit factor."
                  helpId="param.maxGainDbi"
                  accentColor={UI_TOKENS.color.semantic.beam}
                  onChange={maxGainDbi => update({ maxGainDbi })}
                />
                <NumericControl
                  testId="beamwidth3db-transmit-gain-control"
                  symbol={<>θ<sub>3dB</sub></>}
                  label="3 dB beamwidth"
                  labelKey="param.beamwidth3dBDeg.label"
                  unit="degrees"
                  unitKey="param.beamwidth3dBDeg.unit"
                  value={tuning.beamwidth3dBDeg}
                  min={1}
                  max={8}
                  step={0.1}
                  description="Beamwidth input used by the angle-dependent transmit factor."
                  effect="Changing it changes the angle-dependent transmit factor."
                  helpId="param.beamwidth3dBDeg"
                  accentColor={UI_TOKENS.color.semantic.beamSoft}
                  formatValue={value => `${value.toFixed(1)}°`}
                  onChange={beamwidth3dBDeg => update({ beamwidth3dBDeg })}
                />
                <SelectControl
                  symbol={null}
                  label="Beam gain model"
                  labelKey="param.model.label"
                  description="Angle-dependent gain model used by the transmit factor."
                  effect="Switching the model changes the angle-dependent transmit factor."
                  helpId="param.model"
                  value={tuning.model}
                  options={GAIN_MODEL_OPTIONS.map(option => {
                    const detail = getGainModelDetailCopy(option.value);
                    return { ...option, detail: say(detail.key, detail.zh, detail.en) };
                  })}
                  accentColor={UI_TOKENS.color.semantic.beamCool}
                  onChange={model => update({ model: model as GainModel })}
                />
                <NumericControl
                  symbol={<>θ</>}
                  label="Max steering angle"
                  labelKey="param.maxSteeringAngleDeg.label"
                  unit="degrees"
                  unitKey="param.maxSteeringAngleDeg.unit"
                  value={tuning.maxSteeringAngleDeg}
                  min={1}
                  max={20}
                  step={0.5}
                  description="Steering-angle input used by the angle-dependent transmit factor."
                  effect="Changing it changes the angle-dependent transmit factor."
                  helpId="param.maxSteeringAngleDeg"
                  accentColor={UI_TOKENS.color.semantic.beamCool}
                  formatValue={value => `${value.toFixed(1)}°`}
                  onChange={maxSteeringAngleDeg => update({ maxSteeringAngleDeg })}
                />
                <NumericControl
                  symbol={null}
                  label="Max scan loss"
                  labelKey="param.scanLossAtMaxSteeringDb.label"
                  unit="dB"
                  unitKey="param.scanLossAtMaxSteeringDb.unit"
                  value={tuning.scanLossAtMaxSteeringDb}
                  min={0}
                  max={10}
                  step={0.25}
                  description="Scan-loss input used by the angle-dependent transmit factor."
                  effect="Changing it changes the angle-dependent transmit factor."
                  helpId="param.scanLossAtMaxSteeringDb"
                  accentColor={UI_TOKENS.color.semantic.beamLoss}
                  onChange={scanLossAtMaxSteeringDb => update({ scanLossAtMaxSteeringDb })}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {activeTab === 'interference' && (
            <div style={controlStackStyle}>

              <FormulaSideControlSection
                testId="interference-controls"
                // No `helpId` on purpose: that prop moves the caption into a "?"
                // popover, and on THIS section the caption is the answer to "what
                // does K actually do" — it has to be on the page, not one click away.
                contextPlacement="leading"
                side="denominator"
                title="Co-channel interference"
                titleText={say('section.interference.title', '同頻干擾', 'Co-channel interference')}
                formula={(
                  <>
                    I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)
                  </>
                )}
                formulaExpr={(
                  <>
                    I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)
                  </>
                )}
                // One line, not a paragraph. The colour row below carries the
                // explanation — nobody reads three sentences of prose to find out
                // what a slider does.
                subtitle="The two co-channel interference sources add to I_{u,s,v}(t, θ)."
                subtitleText={say(
                  'section.interference.hint',
                  '同頻干擾由同衛星與跨衛星來源共同形成 I_{u,s,v}(t,θ)；下方標籤只表示各來源使用的頻率。',
                  'Same-satellite and cross-satellite sources form I_{u,s,v}(t,θ); the labels below identify their frequencies only.',
                )}
                accentColor={getFormulaTabAccent('interference')}
              >
              <SelectControl
                symbol={frequencyLabel}
                label="Number of frequency groups"
                description="The selected number of frequency groups determines which active beams contribute to I_{u,s,v}(t, θ)."
                effect="Fewer groups add more co-channel contributors to I_{u,s,v}(t, θ); more groups separate them."
                helpId="param.frequencyReuse"
                value={String(tuning.frequencyReuse)}
                options={FREQUENCY_REUSE_OPTIONS.map(value => ({
                  value: String(value),
                  // "K = 3" is a number with no meaning attached. What the control
                  // actually picks is HOW MANY FREQUENCIES the beams are split
                  // across, so the option says that.
                  label: say('param.frequencyReuse.option', `${value} 種頻率`, `${value} frequencies`),
                  // No per-option prose. It restated in a sentence what the colour
                  // row under this control shows at a glance.
                }))}
                accentColor={getFormulaTabAccent('interference')}
                onChange={frequencyReuse => update({ frequencyReuse: Number(frequencyReuse) })}
              />
              {/*
                The whole explanation, in one row: one chip per beam of a
                satellite, labelled with the frequency that beam lands on —
                `getBeamFrequencyIndex(b, K)`, the SAME grouping the link budget
                interferes by. Change K and the row regroups in front of you:
                K=1 → F1 F1 F1 F1 F1 F1 F1 (everyone interferes), K=7 → F1…F7
                (nobody does).

                DELIBERATELY MONOCHROME (owner call 2026-08-06). The scene does not
                encode frequency as beam colour — cones are painted by ROLE
                (serving / pending / handover; `displayColor` in
                SatelliteBeams.tsx), and the frequency palette survives there only
                as a thin footprint edge ring. Tinting these chips per frequency
                would teach a colour language the 3D view does not speak. The F
                label carries the grouping on its own, and it stays exact at K=7,
                where the six-entry BEAM_FREQUENCY_COLORS palette would have wrapped
                two different frequencies onto one colour anyway.
              */}
              <div
                data-testid="interference-frequency-groups"
                // Sized so a 7-beam satellite still reads as ONE row in the narrow
                // tuning rail (7 x 28 + 6 x 3 = 214px). `flexWrap` keeps a
                // higher-beam-count profile graceful rather than clipped.
                style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}
              >
                {Array.from({ length: beamsPerSatellite }, (_, index) => {
                  const beamId = index + 1;
                  const frequencyIndex = getBeamFrequencyIndex(beamId, reuseGroupCount);
                  return (
                    <span
                      key={beamId}
                      title={`${frequencyLabel} ${frequencyIndex + 1}`}
                      data-testid={`interference-frequency-swatch-${beamId}`}
                      data-frequency-index={frequencyIndex}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 58,
                        height: 26,
                        borderRadius: UI_TOKENS.radius.sm,
                        background: UI_TOKENS.color.surface.card,
                        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                        color: UI_TOKENS.color.text.secondary,
                        fontSize: UI_TOKENS.type.size.caption,
                        fontWeight: UI_TOKENS.type.weight.heavy,
                      }}
                    >
                      {frequencyLabel} {frequencyIndex + 1}
                    </span>
                  );
                })}
              </div>
              </FormulaSideControlSection>
            </div>
          )}

          <div style={dividerStyle} />
        </section>
        )}

        {/*
          Scene topology is a MAIN tab, not a seventh SINR sub-tab.

          Phase E rendered it as `activeTab === 'topology' && appMode ===
          'sinr-experiment'`; Phase C then kept visual scale visible in both app
          modes. Neither placement was right: none of these fields — satellite
          count, beams per satellite, UE count and how those UEs move — appears
          anywhere in γ = (P_t · H · G^T · G^R) / (I^a + I^b + σ²). Sitting them
          under a formula-term strip, behind an `N_sat` symbol, taught students
          that the satellite count was a factor of the fraction. It is not: it is
          the shape of the simulated world, and changing it restarts the run
          instead of recomputing a term.

          `appMode` is still forwarded for the MODQN serving-candidate selector;
          the live scene topology controls themselves are available in every
          live app mode.
        */}
        {mainTab === 'scene' && (
          <section
            id="tuning-page-panel-scene"
            data-testid="scene-topology-page"
            role="tabpanel"
            aria-label={say('tab.scene.label', '場景設定', 'Scene setup')}
            style={pagePanelStyle}
          >
            <TopologyTab
              topology={topology}
              sceneVisualScale={sceneVisualScale}
              baseProfile={baseProfile}
              appMode={appMode}
              onTopologyChange={onTopologyChange}
              onSceneVisualScaleChange={onSceneVisualScaleChange}
              onReset={() => onTopologyChange(createSceneTopologyState())}
            />
          </section>
        )}

        {/* Compatibility-only handover branch. These controls choose which
            satellite serves the link; they are not a factor in the canonical
            power train and are not exposed by the four-tab homepage. */}
        {mainTab === 'handover' && handoverPolicySection != null && (
          <section
            id="tuning-page-panel-handover"
            data-testid="handover-continuity-page"
            role="tabpanel"
            aria-label={say('tab.handover.label', '換手判定', 'Handover')}
            style={pagePanelStyle}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={groupTitleStyle}>
                {say(
                  'section.handoverIntro.title',
                  '換手判定條件',
                  'Handover decision criteria',
                )}
              </div>
              <HelpPopover
                helpId="section.handoverIntro"
                titleText={say(
                  'section.handoverIntro.title',
                  '換手判定條件',
                  'Handover decision criteria',
                )}
                bodyText={say(
                  'section.handoverIntro.hint',
                  '低軌衛星持續移動，服務衛星終將離開可視範圍。本區參數設定候選衛星須優於服務衛星多少 dB、且須持續多久，才觸發換手。門檻過低會導致頻繁往返換手；門檻過高則可能在換手前訊號已劣化。',
                  'LEO satellites keep moving, so the serving satellite eventually leaves visibility. These parameters set how many dB better a candidate must be, and for how long, before a handover is triggered. Too low a threshold causes repeated back-and-forth handovers; too high a threshold lets the link degrade before it moves.',
                )}
                placement="left"
              />
            </div>
            {handoverPolicySection}
          </section>
        )}
        </div>
      </div>
    </aside>
  );
}
