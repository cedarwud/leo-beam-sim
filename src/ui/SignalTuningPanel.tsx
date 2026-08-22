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
  type PathLossComponent,
  type Profile,
} from '../profiles/types';
import type { LinkBudgetTerms } from '../scene/types';
import type { AngleAwareFormulaFrame } from '../engine/signal/types';
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
} from './signal-tuning/ControlSections';
import { HelpPopover } from './common/HelpPopover';
import { NumericControl, PathLossTermControl, SelectControl } from './signal-tuning/Controls';
import {
  FormulaFraction,
  FormulaHeader,
  InlineFormulaFraction,
  FormulaRow,
} from './signal-tuning/FormulaHeader';
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
  PATH_LOSS_LABELS,
  getFormulaTabAccent,
} from './signal-tuning/tuningConfig';
import {
  controlStackStyle,
  dividerStyle,
  drawerContentStyle,
  explanatoryTextStyle,
  groupTitleStyle,
  legacyPanelStyle,
  legacyPagePanelStyle,
  pagePanelStyle,
  srOnlyStyle,
} from './signal-tuning/styles';
import type { MainTabKey, TuningTabKey } from './signal-tuning/types';
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
 * The visible SINR strip presents five formula terms (p, H, Gᵀ, I, σ²). Legacy
 * loss / receiver-gain keys remain non-rendered aliases so older deep
 * links and provenance selectors continue to resolve to the channel tab.
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
  /** Shared C1-C9 selected-link frame from the live cell truth. */
  readonly formulaFrame?: AngleAwareFormulaFrame | null;
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
  formulaFrame = null,
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
  const showChannelControls = activeTab === 'channel' || activeTab === 'loss' || activeTab === 'receiver-gain';
  const showLossControls = showChannelControls;
  const showBeamControls = activeTab === 'beam';
  const fsplEnabled = tuning.pathLossComponents.includes('fspl');
  const atmosphericEnabled = tuning.pathLossComponents.includes('atmospheric');
  const scintillationEnabled = tuning.pathLossComponents.includes('scintillation');
  const shadowFadingEnabled = tuning.pathLossComponents.includes('shadow-fading');
  const tr38811Environment = baseProfile.channel.tr38811?.environment ?? DEFAULT_TR38811_CHANNEL.environment;

  const beamsPerSatellite = Math.max(1, Math.trunc(baseProfile.beams.perSatellite));
  // The live Scenario tab has one authoritative scene-cell control: serving
  // satellite. Keep the old global field as a persisted/runtime compatibility
  // fallback, so existing saved sessions migrate without losing their choice.
  const scenarioBeamLayoutCount: SupportedBeamLayoutCount = topology.servingBeamCount
    ?? (topology.beamCountPerSatellite !== null && isSupportedBeamLayoutCount(topology.beamCountPerSatellite)
      ? topology.beamCountPerSatellite
      : isSupportedBeamLayoutCount(beamsPerSatellite)
        ? beamsPerSatellite
        : DEFAULT_BEAM_LAYOUT_COUNT);
  const frequencyLabel = say('section.interference.frequencyLabel', '頻率', 'Frequency');

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
      style={legacyPanelStyle}
    >
      <div
        className="leo-signal-tuning-content"
        data-testid="signal-tuning-drawer-content"
        style={drawerContentStyle}
      >
        <MainTabList
          activeTab={mainTab}
          showHandoverTab={handoverPolicySection != null}
          variant="legacy"
          onChange={setMainTab}
        />

        {mainTab === 'scenario' && (
          <ScenarioDataTab
            connection="live-scene"
            constellation={topology.constellation}
            onConstellationChange={constellation => onTopologyChange({ ...topology, constellation })}
            servingBeamLayoutCount={topology.servingBeamCount ?? scenarioBeamLayoutCount}
            onServingBeamLayoutCountChange={(servingBeamCount: SupportedBeamLayoutCount) => onTopologyChange({
              ...topology,
              beamCountPerSatellite: servingBeamCount,
              servingBeamCount,
              focusCellId: null,
            })}
            candidateBeamLayoutCount={topology.candidateBeamCount ?? topology.servingBeamCount ?? scenarioBeamLayoutCount}
            onCandidateBeamLayoutCountChange={(candidateBeamCount: SupportedBeamLayoutCount) => onTopologyChange({
              ...topology,
              candidateBeamCount,
            })}
            onCandidateBeamLayoutReset={() => onTopologyChange({
              ...topology,
              candidateBeamCount: null,
            })}
            focusCellId={topology.focusCellId}
            focusCellCount={topology.servingBeamCount ?? scenarioBeamLayoutCount}
            onFocusCellChange={(focusCellId: number | null) => onTopologyChange({
              ...topology,
              focusCellId,
            })}
          />
        )}

        {mainTab === 'energy' && (
          <WalkerEeTab formulaFrame={formulaFrame} />
        )}
        {mainTab === 'power' && (
          <WalkerPowerTab
            formulaFrame={formulaFrame}
          />
        )}
        {mainTab === 'throughput' && (
          <WalkerThroughputTab formulaFrame={formulaFrame} />
        )}

        <div>

        {mainTab === 'sinr' && (
        <section
          id="tuning-page-panel-sinr-formula"
          data-testid="sinr-formula-page"
          role="tabpanel"
          aria-label={t('tab.sinr.label')}
          style={legacyPagePanelStyle}
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
                'γ 使用 p、H 與 Gᵀ 形成 wanted-link 訊號，分母使用總干擾 I 與 σ²。',
                'γ uses p, H, and Gᵀ for the wanted link, with total interference I and σ² in the denominator.',
              ),
              effect: say(
                'formula.sinr.presentationEffect',
                'p_{u,s,v}(t,θ_{u,s,v}) 與 Gᵀ(θ_{u,s,v}) 使用同一條鏈路的角度參數。',
                'p_{u,s,v}(t,θ_{u,s,v}) and Gᵀ(θ_{u,s,v}) use the same link angle parameter.',
              ),
            }}
            variant="legacy"
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
            <FormulaRow
              testId="sinr-main-formula-explanation"
              accent={UI_TOKENS.color.semantic.tuning}
              emphasis
              expression={(
                <FormulaFraction
                  lhs={<>γ<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
                  numerator={(
                    <>
                      <span style={{ color: getFormulaTabAccent('signal-power') }}><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <LinkAngle />)</span>
                      {' · '}
                      <span style={{ color: getFormulaTabAccent('channel') }}>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</span>
                      {' · '}
                      <span style={{ color: getFormulaTabAccent('beam') }}>G<sup>T</sup>(<LinkAngle />)</span>
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
              )}
              source={say(
                'section.sinrTerms.explanation',
                '分子是選定 UE-link 的 RF 功率、非角度鏈路因子與角度相關發射增益；分母是總同頻干擾加上接收端雜訊。',
                'The numerator combines the selected UE-link RF power, non-angle channel factor, and angle-dependent transmit gain; the denominator is total co-channel interference plus receiver noise.',
              )}
            />
          </FormulaHeader>

          <div style={{ display: 'grid', gap: 7 }}>
            <div style={groupTitleStyle}>
              {say('section.sinrTerms.title', 'SINR', 'SINR')}
            </div>
            <FormulaTabList activeTab={activeTab} appMode={appMode} variant="legacy" onChange={setActiveTab} />
          </div>

          {activeTab === 'signal-power' && (
            <div style={controlStackStyle}>
              <section
                data-testid="signal-power-controls"
                data-formula-side="numerator"
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: '14px 15px',
                  borderRadius: UI_TOKENS.radius.panel,
                  border: `1px solid ${UI_TOKENS.color.border.soft}`,
                  borderLeft: `3px solid ${getFormulaTabAccent('signal-power')}aa`,
                  background: UI_TOKENS.color.surface.cardSubtle,
                }}
              >
                <div style={{ ...groupTitleStyle, color: getFormulaTabAccent('signal-power') }}>
                  {say('section.signalPower.title', '實際 RF 輸出', 'Actual RF output')}
                </div>
                <div style={explanatoryTextStyle}>
                  {say(
                    'section.signalPower.hint',
                    '是選定 UE-link 的實際 RF 發射功率。',
                    'is the actual RF transmit power of the selected UE-link.',
                  )}
                </div>
              </section>
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
                subtitle="σ² = B^w · N_0 is the receiver thermal noise power in the SINR denominator."
                subtitleText={say(
                  'section.thermalNoise.hint',
                  'σ² = B^w · N_0 是 SINR 分母中的接收端雜訊功率；下方控制可調整波束頻寬 B^w 與雜訊功率密度 N_0。',
                  'σ² = B^w · N_0 is the receiver noise power in the SINR denominator; the controls below adjust beam bandwidth B^w and noise power spectral density N_0.',
                )}
                accentColor={UI_TOKENS.color.semantic.noise}
                visualVariant="legacy"
              >
                <NumericControl
                  testId="bandwidth-thermal-noise-control"
                  visualVariant="legacy"
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
                  visualVariant="legacy"
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
                titleText={say('section.pathLoss.groupTitle', '傳播因素', 'Propagation factors')}
                // The stack expression goes through `formulaExpr`, not
                // `subtitle`: a subtitle renders in the prose caption box at
                // `size.caption` (16px), which is why this formula read smaller
                // than every other formula in the panel. `formulaExpr` puts it
                // on the same rendering path as the numerator/denominator
                // sections. `subtitle` keeps the identical canonical markup so
                // the hidden provenance copy is unchanged.
                subtitle={<>H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>}
                formulaExpr={(
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div>
                      H<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) = 10<sup>−</sup>
                      <InlineFormulaFraction
                        numerator={<>
                          L<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)
                        </>}
                        denominator={10}
                        label="total path loss divided by ten"
                      />
                      · <i>G</i><sup>R</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)
                    </div>
                    <div>
                      L<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t) = L<sub>fs</sub>(d<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t), f<sub>c</sub>) + L<sub>g</sub>(α<sub>u,s</sub>(t)) + L<sub>sc</sub>(α<sub>u,s</sub>(t)) + L<sub>sf</sub>
                    </div>
                  </div>
                )}
                helpId="section.pathLoss"
                subtitleText={say(
                  'section.effectiveChannelFormula.pathLossSource',
                  'H_{u,s,v}(t) 是不承載發射角度型樣的線性鏈路因子；公開展開層只到 L_fs、L_g、L_sc、L_sf 與 G^R，其餘實作層修正留在 H 之內，不列為公開符號。',
                  'H_{u,s,v}(t) is the linear link factor that does not carry the transmit angular pattern; the public expansion stops at L_fs, L_g, L_sc, L_sf and G^R, and any further implementation-layer correction stays inside H rather than becoming a public symbol.',
                )}
                visualVariant="legacy"
              >
                <NumericControl
                  testId="gr-receiver-gain-control"
                  visualVariant="legacy"
                  symbol={<><i>G</i><sup>R</sup><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t)</>}
                  label="Receive-side factor"
                  labelKey="param.ueAntennaMaxGainDbi.label"
                  unit="dBi"
                  unitKey="param.ueAntennaMaxGainDbi.unit"
                  value={tuning.ueAntennaMaxGainDbi}
                  min={-10}
                  max={20}
                  step={0.5}
                  description="Receive-side gain G^R_{u,s,v}(t) in the expanded H factor."
                  effect="Adjusting it changes H_{u,s,v}(t) and the selected-link SINR."
                  helpId="param.ueAntennaMaxGainDbi"
                  accentColor={UI_TOKENS.color.semantic.fixed}
                  formatValue={formatDbi}
                  onChange={ueAntennaMaxGainDbi => update({ ueAntennaMaxGainDbi })}
                />
                <PathLossTermControl
                  testId="path-loss-term-fspl"
                  visualVariant="legacy"
                  active={fsplEnabled}
                  symbol={PATH_LOSS_LABELS.fspl.symbol}
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
                  effect="Higher carrier frequency increases L_fs and lowers H_{u,s,v}(t)."
                  inactiveReason="Not contributing while this propagation term is off."
                  helpId="param.frequencyGHz"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(1)} GHz`}
                  onToggle={() => togglePathLossComponent('fspl')}
                  onChange={frequencyGHz => update({ frequencyGHz })}
                />
                <PathLossTermControl
                  testId="path-loss-term-atmospheric"
                  visualVariant="legacy"
                  active={atmosphericEnabled}
                  symbol={PATH_LOSS_LABELS.atmospheric.symbol}
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
                  effect="Enabling it adds L_g to L_{u,s,v}(t) and lowers H_{u,s,v}(t)."
                  inactiveReason="Not contributing while this propagation term is off."
                  helpId="param.atmosphericZenithLossDb"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(2)} dB`}
                  onToggle={() => togglePathLossComponent('atmospheric')}
                  onChange={atmosphericZenithLossDb => update({ atmosphericZenithLossDb })}
                />
                <PathLossTermControl
                  testId="path-loss-term-scintillation"
                  visualVariant="legacy"
                  active={scintillationEnabled}
                  symbol={PATH_LOSS_LABELS.scintillation.symbol}
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
                  effect="Enabling it adds L_sc to L_{u,s,v}(t) and lowers H_{u,s,v}(t)."
                  inactiveReason="Not contributing while this propagation term is off."
                  helpId="param.scintillationScaleDb"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(2)} dB`}
                  onToggle={() => togglePathLossComponent('scintillation')}
                  onChange={scintillationScaleDb => update({ scintillationScaleDb })}
                />
                <PathLossTermControl
                  testId="path-loss-term-shadow-fading"
                  visualVariant="legacy"
                  active={shadowFadingEnabled}
                  symbol={PATH_LOSS_LABELS['shadow-fading'].symbol}
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
                  effect="Enabling it adds L_sf to L_{u,s,v}(t) and lowers H_{u,s,v}(t)."
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
                  subtitle="Implementation-layer TR 38.811 NLoS sensitivity control. It is not part of the public H expansion; the public propagation terms are grouped above with their switches."
                  subtitleText={say(
                    'section.tr38811.hint',
                    '實作層敏感度參數，不屬於公開 H 展開，也不是論文公式符號：僅套用於判定為非視距（NLoS）的取樣點，其效果併入 H_{u,s,v}(t)。公開的傳播損耗項位於「路徑損耗」區塊。',
                    'Implementation-layer sensitivity parameter, outside the public H expansion and not a paper formula symbol: it applies only to samples classified as non-line-of-sight (NLoS), and its effect is absorbed into H_{u,s,v}(t). The public propagation-loss terms are in the path-loss section.',
                  )}
                  visualVariant="legacy"
                >
                  {isTr38811Formula && (
                    <NumericControl
                      testId="lcl-nlos-control"
                      visualVariant="legacy"
                      symbol={<><i>L</i><sub>N</sub>(t)</>}
                      label="NLoS clutter loss"
                      labelKey="param.tr38811NlosClutterLossDb.label"
                      unit="dB"
                      unitKey="param.tr38811NlosClutterLossDb.unit"
                      value={tuning.tr38811NlosClutterLossDb}
                      min={0}
                      max={40}
                      step={0.5}
                      description="Implementation-layer TR 38.811 NLoS clutter sensitivity value absorbed into H_{u,s,v}(t); it is not a public formula symbol."
                      effect="Editable in the TR 38.811 research profile only; it affects seeded NLoS samples. Seeded LoS samples do not change."
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
                contextPlacement="leading"
                side="numerator"
                title="Angle-dependent transmit gain"
                titleText={say('section.beamGain.title', '角度相關發射增益', 'Angle-dependent transmit gain')}
                formula={<>G<sup>T</sup>(<LinkAngle />)</>}
                formulaExpr={(
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div>G<sup>T</sup>(<LinkAngle />) = G<sub>0</sub> F(<LinkAngle />, θ<sub>3dB</sub>)</div>
                    <div>G<sup>T</sup>(0) = G<sub>0</sub>, &nbsp;F(0, θ<sub>3dB</sub>) = 1</div>
                    <div>
                      μ(<LinkAngle />) = 2.07123 ·
                      <InlineFormulaFraction
                        numerator={<>sin(<LinkAngle />)</>}
                        denominator={<>sin(θ<sub>3dB</sub>)</>}
                        label="sine of the off-axis angle divided by sine of the three dB beamwidth"
                      />
                    </div>
                    <div>
                      F(<LinkAngle />, θ<sub>3dB</sub>) = (
                      <InlineFormulaFraction
                        numerator={<>J<sub>1</sub>(μ)</>}
                        denominator={<>2μ</>}
                        label="Bessel J1 divided by twice its angle argument"
                      /> +
                      <InlineFormulaFraction
                        numerator={<>36J<sub>3</sub>(μ)</>}
                        denominator={<>μ<sup>3</sup></>}
                        label="thirty six times Bessel J3 divided by the cubed angle argument"
                      />
                      )<sup>2</sup>
                    </div>
                  </div>
                )}
                subtitle="Gᵀ(θ_{u,s,v}) = G₀F(θ_{u,s,v}, θ_{3dB}) is the normalized angle-dependent transmit-gain factor."
                subtitleText={say(
                  'section.beamGain.hint',
                  'Gᵀ(θ_{u,s,v}) = G₀F(θ_{u,s,v}, θ_{3dB})；F 是 HOBS 式 (3) 的 J₁/J₃ 角度型樣，在波束中心自然等於 1（1/4 + 3/4），不需額外正規化常數。2.07123 是該式的固定角度參數，不是可調參數。',
                  'Gᵀ(θ_{u,s,v}) = G₀F(θ_{u,s,v}, θ_{3dB}); F is the J₁/J₃ angular pattern of HOBS Eq. (3), which is naturally unity at beam centre (1/4 + 3/4) and needs no extra normalization constant. 2.07123 is that equation\'s fixed angle argument, not a tunable parameter.',
                )}
                accentColor={UI_TOKENS.color.semantic.beam}
                visualVariant="legacy"
              >
                <NumericControl
                  testId="gtmax-transmit-gain-control"
                  visualVariant="legacy"
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
                  visualVariant="legacy"
                  symbol={<>θ<sub>3dB</sub></>}
                  label="3 dB beamwidth"
                  labelKey="param.beamwidth3dBDeg.label"
                  unit="degrees"
                  unitKey="param.beamwidth3dBDeg.unit"
                  value={tuning.beamwidth3dBDeg}
                  min={1}
                  max={8}
                  step={0.1}
                  description="3 dB beamwidth θ_{3dB} used by the normalized pattern F."
                  effect="Changing θ_{3dB} changes the angular argument μ and therefore F."
                  helpId="param.beamwidth3dBDeg"
                  accentColor={UI_TOKENS.color.semantic.beamSoft}
                  formatValue={value => `${value.toFixed(1)}°`}
                  onChange={beamwidth3dBDeg => update({ beamwidth3dBDeg })}
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
                showFormula={false}
                subtitle="Frequency-reuse groups determine which active beams share frequencies and affect interference; adjusting group count controls how co-channel beams are distributed."
                subtitleText={say(
                  'section.interference.hint',
                  '頻率重用群組會決定哪些作用中波束使用同頻並影響干擾；調整群組數可控制共用頻率的波束數量以抑制同頻干擾。',
                  'Frequency-reuse groups determine which active beams share frequencies and affect interference; adjusting group count controls how co-channel beams are distributed.',
                )}
                accentColor={getFormulaTabAccent('interference')}
                visualVariant="legacy"
              >
              <SelectControl
                visualVariant="legacy"
                symbol={frequencyLabel}
                label="Number of frequency groups"
                labelKey="param.frequencyReuse.label"
                description="The selected number of frequency groups determines which active beams share frequencies and contribute to interference."
                effect="Fewer groups add more co-channel contributors; more groups separate them to reduce co-channel interference."
                helpId="param.frequencyReuse"
                value={String(tuning.frequencyReuse)}
                options={FREQUENCY_REUSE_OPTIONS.map(value => ({
                  value: String(value),
                  // "K = 3" is a number with no meaning attached. What the control
                  // actually picks is HOW MANY FREQUENCIES the beams are split
                  // across, so the option says that.
                  label: say('param.frequencyReuse.option', `${value} 種頻率`, `${value} frequencies`),
                }))}
                accentColor={getFormulaTabAccent('interference')}
                onChange={frequencyReuse => update({ frequencyReuse: Number(frequencyReuse) })}
              />
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
          anywhere in γ = p_{u,s,v} H_{u,s,v} Gᵀ(θ_{u,s,v}) / (I_{u,s,v} + σ²). Sitting them
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
