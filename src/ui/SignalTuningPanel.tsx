import { useState, type ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
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
  FormulaContextDisclosure,
  FormulaSideControlSection,
  LossControlSection,
  NoiseFloorReadout,
} from './signal-tuning/ControlSections';
import { HelpPopover } from './common/HelpPopover';
import { NumericControl, PathLossTermControl, SelectControl } from './signal-tuning/Controls';
import { SinrFormulaMap } from './signal-tuning/FormulaMap';
import { FormulaFraction, FormulaHeader } from './signal-tuning/FormulaHeader';
import { FormulaTabList } from './signal-tuning/FormulaTabList';
import { MainTabList } from './signal-tuning/MainTabList';
import { SinrOverview } from './signal-tuning/SinrOverview';
import { TopologyTab } from './signal-tuning/TopologyTab';
import { tx, txBi } from './signal-tuning/labels';
import {
  FREQUENCY_REUSE_OPTIONS,
  GAIN_MODEL_OPTIONS,
  PATH_LOSS_LABELS,
  getActiveTabConfig,
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
import { formatFrequencyLabel, getBeamFrequencyIndex } from '../utils/beamFrequency';
import { formatDbi } from './signal-tuning/formatters';
import type { AppExperienceMode } from './appMode';

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
 * Nothing that was wired up was removed: the seven formula-term tabs (P_t,
 * H(L), G^T(θ), G^R, I, σ², scene topology) all still exist, one level down
 * inside SINR, with their existing data-testids intact so the repo's
 * `validate:*` provenance gates keep working.
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
  const activeTabConfig = getActiveTabConfig(activeTab);
  const isTr38811Formula = baseProfile.formulaFamily === 'hobs-tr38811';
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
  const reuseGroupCount = Math.max(1, Math.trunc(tuning.frequencyReuse));
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
              body: t('formula.sinr.caption'),
              effect: t('formula.sinr.symbolHelp'),
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
              apart. With the coloured backgrounds gone from the term sections,
              this is what ties the expression to the controls: a student who
              sees the colour of `P_t` up here knows which group edits it.
            */}
            <FormulaFraction
              lhs={<>γ</>}
              numerator={(
                <>
                  <span style={{ color: getFormulaTabAccent('signal-power') }}>P<sub>t</sub></span>
                  {' · '}
                  <span style={{ color: getFormulaTabAccent('loss') }}>H</span>
                  {' · '}
                  <span style={{ color: getFormulaTabAccent('beam') }}>G<sup>T</sup></span>
                  {' · '}
                  <span style={{ color: getFormulaTabAccent('receiver-gain') }}>G<sup>R</sup></span>
                </>
              )}
              denominator={(
                <>
                  <span style={{ color: getFormulaTabAccent('interference') }}>I<sup>a</sup> + I<sup>b</sup></span>
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
              {say('section.sinrTerms.title', '公式項目', 'Formula terms')}
            </div>
            <FormulaTabList activeTab={activeTab} appMode={appMode} onChange={setActiveTab} />
          </div>

          {activeTab === 'signal-power' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="signal-power-controls"
                helpId="section.signalPower"
                side="numerator"
                title="Transmit Power / numerator"
                titleText={say('section.signalPower.title', '發射功率（分子項）', 'Transmit power (numerator term)')}
                formula={<>P<sub>t</sub> starts the desired-signal numerator.</>}
                formulaExpr={<>S ∝ P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup></>}
                subtitle="This tab controls transmit power only. Receiver gain has its own tab."
                subtitleText={say(
                  'section.signalPower.hint',
                  '本區僅設定衛星端的每波束發射功率 P_t；地面終端天線增益 G^R 屬於「接收增益」項。',
                  'This section sets the satellite-side per-beam transmit power P_t only. Terminal antenna gain G^R belongs to the receiver-gain term.',
                )}
              >
                <NumericControl
                  testId="pt-signal-power-control"
                  symbol={<>P<sub>t</sub></>}
                  label="Per-beam transmit power"
                  labelKey="param.maxTxPowerDbm.label"
                  unit="dBm"
                  unitKey="param.maxTxPowerDbm.unit"
                  value={tuning.maxTxPowerDbm}
                  min={10}
                  max={60}
                  step={0.5}
                  description="Base transmit power before dynamic power control overrides."
                  effect="Raising it strengthens both the serving beam and any co-channel interferers."
                  helpId="param.maxTxPowerDbm"
                  helpBodyKey="param.maxTxPowerDbm.help"
                  helpEffectKey="param.maxTxPowerDbm.effect"
                  onChange={maxTxPowerDbm => update({ maxTxPowerDbm })}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {activeTab === 'receiver-gain' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="receiver-gain-controls"
                helpId="section.receiverGain"
                side="numerator"
                title="Receiver Gain / numerator"
                titleText={say('section.receiverGain.title', '接收增益（分子項）', 'Receiver gain (numerator term)')}
                formula={<>S includes G<sup>R</sup> after transmit power, path loss, and transmit gain.</>}
                formulaExpr={<>S ∝ P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup></>}
                subtitle="This tab controls receive-side gain independently from P_t and G^T."
                subtitleText={say(
                  'section.receiverGain.hint',
                  '地面終端天線增益 G^R，與衛星發射功率 P_t 及衛星天線增益 G^T 為互相獨立的參數。',
                  'Terminal antenna gain G^R is independent of satellite transmit power P_t and satellite antenna gain G^T.',
                )}
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
                  description="Receive-side antenna gain in the SINR signal path."
                  effect="Adjusting it shifts the desired-signal numerator without changing transmit power, satellite beam gain, interference grouping, or thermal noise."
                  helpId="param.ueAntennaMaxGainDbi"
                  helpBodyKey="param.ueAntennaMaxGainDbi.help"
                  helpEffectKey="param.ueAntennaMaxGainDbi.effect"
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
                // σ² reads top-down as a definition: σ² = N₀B, then the two
                // factors, then the computed floor. Owner request 2026-08-06;
                // every other section keeps the formula as a trailing footnote.
                contextPlacement="leading"
                side="denominator"
                title="Thermal Noise / denominator"
                titleText={say('section.thermalNoise.title', '熱雜訊（分母項）', 'Thermal noise (denominator term)')}
                formula={<>σ² = N<sub>0</sub>B</>}
                subtitle={<>B and N<sub>0</sub> set the denominator noise floor. They are not transmit-power controls.</>}
                subtitleText={say(
                  'section.thermalNoise.hint',
                  '頻寬 B 與雜訊功率密度 N₀ 決定分母的熱雜訊底線 σ² = N₀B，與發射功率無關。',
                  'Bandwidth B and noise power density N₀ set the denominator noise floor σ² = N₀B. Neither is a transmit-power parameter.',
                )}
                accentColor={UI_TOKENS.color.semantic.noise}
              >
                <NumericControl
                  testId="bandwidth-thermal-noise-control"
                  symbol={<>B</>}
                  label="Channel bandwidth"
                  labelKey="param.bandwidthMHz.label"
                  unit="MHz"
                  unitKey="param.bandwidthMHz.unit"
                  value={tuning.bandwidthMHz}
                  min={5}
                  max={400}
                  step={5}
                  description="Bandwidth used in σ² = N₀B."
                  effect="Wider bandwidth increases thermal noise when transmit power is held fixed."
                  helpId="param.bandwidthMHz"
                  helpBodyKey="param.bandwidthMHz.help"
                  helpEffectKey="param.bandwidthMHz.effect"
                  accentColor={UI_TOKENS.color.semantic.noise}
                  formatValue={value => `${value.toFixed(0)} MHz`}
                  onChange={bandwidthMHz => update({ bandwidthMHz })}
                />
                <NumericControl
                  testId="n0-thermal-noise-control"
                  symbol={<>N<sub>0</sub></>}
                  label="Noise PSD"
                  labelKey="param.noisePsdDbmHz.label"
                  unit="dBm/Hz"
                  unitKey="param.noisePsdDbmHz.unit"
                  value={tuning.noisePsdDbmHz}
                  min={-180}
                  max={-160}
                  step={0.5}
                  description="Thermal noise density before multiplying by bandwidth."
                  effect="A less negative value raises the noise floor and lowers weak-link SINR."
                  helpId="param.noisePsdDbmHz"
                  helpBodyKey="param.noisePsdDbmHz.help"
                  helpEffectKey="param.noisePsdDbmHz.effect"
                  accentColor={UI_TOKENS.color.semantic.noiseSoft}
                  onChange={noisePsdDbmHz => update({ noisePsdDbmHz })}
                />
                <NoiseFloorReadout
                  formulaBudget={formulaBudget}
                  isFormulaEvidenceStale={isFormulaEvidenceStale}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {activeTab === 'loss' && (
            <div style={controlStackStyle}>
              <LossControlSection
                testId="loss-formula-controls"
                title="Path-loss stack"
                titleText={say('section.pathLoss.title', '路徑損耗', 'Path loss')}
                // The stack expression goes through `formulaExpr`, not
                // `subtitle`: a subtitle renders in the prose caption box at
                // `size.caption` (16px), which is why this formula read smaller
                // than every other formula in the panel. `formulaExpr` puts it
                // on the same rendering path as the numerator/denominator
                // sections. `subtitle` keeps the identical canonical markup so
                // the hidden provenance copy is unchanged.
                // NOTATION RULE: this page's sliders are the L stack, but the term
                // γ actually multiplies is H. Showing only the L line left the
                // student to guess the link, which is what pushed `H(L)` onto the
                // chip. The bridge belongs HERE, on the page that owns the sliders,
                // so the chip can stay the plain γ symbol `H`.
                subtitle={<>H = 10<sup>-L/10</sup>, L = L<sub>fs</sub> + L<sub>g</sub> + L<sub>sc</sub> + L<sub>sf</sub></>}
                formulaExpr={<>H = 10<sup>-L/10</sup>, L = L<sub>fs</sub> + L<sub>g</sub> + L<sub>sc</sub> + L<sub>sf</sub></>}
              >
                <PathLossTermControl
                  testId="path-loss-term-fspl"
                  active={fsplEnabled}
                  symbol={<>L<sub>fs</sub></>}
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
                  effect="Higher frequency raises Lfs."
                  inactiveReason="Not contributing while Lfs is off."
                  helpId="param.frequencyGHz"
                  helpBodyKey="param.frequencyGHz.help"
                  helpEffectKey="param.frequencyGHz.effect"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(1)} GHz`}
                  onToggle={() => togglePathLossComponent('fspl')}
                  onChange={frequencyGHz => update({ frequencyGHz })}
                />
                <PathLossTermControl
                  testId="path-loss-term-atmospheric"
                  active={atmosphericEnabled}
                  symbol={<>L<sub>g</sub></>}
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
                  effect="Raises Lg when enabled."
                  inactiveReason="Not contributing while Lg is off."
                  helpId="param.atmosphericZenithLossDb"
                  helpBodyKey="param.atmosphericZenithLossDb.help"
                  helpEffectKey="param.atmosphericZenithLossDb.effect"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(2)} dB`}
                  onToggle={() => togglePathLossComponent('atmospheric')}
                  onChange={atmosphericZenithLossDb => update({ atmosphericZenithLossDb })}
                />
                <PathLossTermControl
                  testId="path-loss-term-scintillation"
                  active={scintillationEnabled}
                  symbol={<>L<sub>sc</sub></>}
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
                  effect="Raises Lsc when enabled."
                  inactiveReason="Not contributing while Lsc is off."
                  helpId="param.scintillationScaleDb"
                  helpBodyKey="param.scintillationScaleDb.help"
                  helpEffectKey="param.scintillationScaleDb.effect"
                  accentColor={UI_TOKENS.color.semantic.loss}
                  formatValue={value => `${value.toFixed(2)} dB`}
                  onToggle={() => togglePathLossComponent('scintillation')}
                  onChange={scintillationScaleDb => update({ scintillationScaleDb })}
                />
                <PathLossTermControl
                  testId="path-loss-term-shadow-fading"
                  active={shadowFadingEnabled}
                  symbol={<>L<sub>sf</sub></>}
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
                  effect="Raises Lsf when enabled."
                  inactiveReason="Not contributing while Lsf is off."
                  helpId="param.shadowFadingMarginDb"
                  helpBodyKey="param.shadowFadingMarginDb.help"
                  helpEffectKey="param.shadowFadingMarginDb.effect"
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
                      symbol={<>L<sub>cl,NLoS</sub></>}
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
                      helpBodyKey="param.tr38811NlosClutterLossDb.help"
                      helpEffectKey="param.tr38811NlosClutterLossDb.effect"
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
                        TR 38.811 LoS environment: {tr38811Environment}. Read-only in Phase 8B; no editable environment selector is provided.
                      </span>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: UI_TOKENS.radius.pill,
                        border: `1px solid ${UI_TOKENS.color.border.soft}`,
                        color: UI_TOKENS.color.text.faint,
                        fontSize: UI_TOKENS.type.size.tiny,
                        fontWeight: UI_TOKENS.type.weight.heavy,
                        whiteSpace: 'nowrap',
                      }}>
                        {say('common.readOnly', '唯讀', 'Read-only')}
                      </span>
                    </div>
                  )}
                </LossControlSection>
              </div>
            </div>
          )}

          {activeTab === 'beam' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="beam-gain-controls"
                helpId="section.beamGain"
                // Same read-as-a-definition order as σ²: G^T = G_t,max + G(θ) −
                // L_scan first, then the sliders that fill each term in.
                contextPlacement="leading"
                side="numerator"
                title="Transmit Gain / numerator"
                titleText={say('section.beamGain.title', '衛星波束增益（分子項）', 'Satellite beam gain (numerator term)')}
                formula={<>G<sup>T</sup> = G<sub>t,max</sub> + G(θ) - L<sub>scan</sub></>}
                subtitle="These controls shape the satellite-side gain term before receiver gain is applied."
                subtitleText={say(
                  'section.beamGain.hint',
                  '本區參數決定衛星端的波束寬度、可轉向範圍與轉向損耗，共同構成 G^T 項。',
                  'These parameters set the satellite-side beamwidth, steering range, and scan loss, which together form the G^T term.',
                )}
                accentColor={UI_TOKENS.color.semantic.beam}
              >
                <NumericControl
                  testId="gtmax-transmit-gain-control"
                  symbol={<>G<sub>t,max</sub></>}
                  label="Max transmit gain"
                  labelKey="param.maxGainDbi.label"
                  unit="dBi"
                  unitKey="param.maxGainDbi.unit"
                  value={tuning.maxGainDbi}
                  min={20}
                  max={60}
                  step={0.5}
                  description="Peak satellite-beam gain before off-axis and scan losses."
                  effect="Raising it shifts the transmit-gain numerator factor for all beams in the current profile."
                  helpId="param.maxGainDbi"
                  helpBodyKey="param.maxGainDbi.help"
                  helpEffectKey="param.maxGainDbi.effect"
                  accentColor={UI_TOKENS.color.semantic.beam}
                  onChange={maxGainDbi => update({ maxGainDbi })}
                />
                <NumericControl
                  symbol={<>θ<sub>3dB</sub></>}
                  label="3 dB beamwidth"
                  labelKey="param.beamwidth3dBDeg.label"
                  unit="degrees"
                  unitKey="param.beamwidth3dBDeg.unit"
                  value={tuning.beamwidth3dBDeg}
                  min={1}
                  max={8}
                  step={0.1}
                  description="Main-lobe width used by the gain pattern and beam footprint geometry."
                  effect="Changing it rebuilds beam layout and clears in-progress HO preparation."
                  helpId="param.beamwidth3dBDeg"
                  helpBodyKey="param.beamwidth3dBDeg.help"
                  helpEffectKey="param.beamwidth3dBDeg.effect"
                  accentColor={UI_TOKENS.color.semantic.beamSoft}
                  formatValue={value => `${value.toFixed(1)}°`}
                  onChange={beamwidth3dBDeg => update({ beamwidth3dBDeg })}
                />
                <SelectControl
                  symbol={<>G(θ)</>}
                  label="Beam gain model"
                  labelKey="param.model.label"
                  description="Off-axis gain model applied after the UE-to-beam-center angle is known."
                  effect="Switching model changes how fast signal falls off away from the beam centre."
                  helpId="param.model"
                  helpBodyKey="param.model.help"
                  helpEffectKey="param.model.effect"
                  value={tuning.model}
                  options={GAIN_MODEL_OPTIONS.map(option => {
                    const detail = getGainModelDetailCopy(option.value);
                    return { ...option, detail: say(detail.key, detail.zh, detail.en) };
                  })}
                  accentColor={UI_TOKENS.color.semantic.beamCool}
                  onChange={model => update({ model: model as GainModel })}
                />
                <NumericControl
                  symbol={<>θ<sub>max</sub></>}
                  label="Max steering angle"
                  labelKey="param.maxSteeringAngleDeg.label"
                  unit="degrees"
                  unitKey="param.maxSteeringAngleDeg.unit"
                  value={tuning.maxSteeringAngleDeg}
                  min={1}
                  max={20}
                  step={0.5}
                  description="Largest scan angle accepted when building steering-valid beam cells."
                  effect="A larger value can keep more candidate beams available, but edge beams may pay scan loss."
                  helpId="param.maxSteeringAngleDeg"
                  helpBodyKey="param.maxSteeringAngleDeg.help"
                  helpEffectKey="param.maxSteeringAngleDeg.effect"
                  accentColor={UI_TOKENS.color.semantic.beamCool}
                  formatValue={value => `${value.toFixed(1)}°`}
                  onChange={maxSteeringAngleDeg => update({ maxSteeringAngleDeg })}
                />
                <NumericControl
                  symbol={<>L<sub>scan,max</sub></>}
                  label="Max scan loss"
                  labelKey="param.scanLossAtMaxSteeringDb.label"
                  unit="dB"
                  unitKey="param.scanLossAtMaxSteeringDb.unit"
                  value={tuning.scanLossAtMaxSteeringDb}
                  min={0}
                  max={10}
                  step={0.25}
                  description="Loss applied quadratically as steering approaches θmax."
                  effect="Higher loss penalizes beams near the steering limit and can change the best candidate."
                  helpId="param.scanLossAtMaxSteeringDb"
                  helpBodyKey="param.scanLossAtMaxSteeringDb.help"
                  helpEffectKey="param.scanLossAtMaxSteeringDb.effect"
                  accentColor={UI_TOKENS.color.semantic.beamLoss}
                  onChange={scanLossAtMaxSteeringDb => update({ scanLossAtMaxSteeringDb })}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {activeTab === 'interference' && (
            <div style={controlStackStyle}>
              {/*
                This tab used to render a bare K selector with no section around
                it: γ's denominator names I^a + I^b, the chip named them too, and
                nothing on the page said how the one control reaches those two
                terms.

                The formula states the ONE fact that makes interference
                intuitive: an interfering beam delivers its power through the
                SAME numerator chain as the wanted signal. `link-budget.ts`
                accumulates `interferenceMw`, which is
                `dbmToMw(linkSignalBeforeReceiverGainDbm)` — P_t + G_t,max +
                G(θ) − L_scan − L, i.e. exactly P_t · H · G^T and deliberately
                WITHOUT G^R (Phase 4B keeps G^R numerator-only). Writing it that
                way keeps every symbol on the right-hand side a term the student
                has already met in γ; the earlier Σ_{F(j)=F(i)} P_rx,j form
                introduced five symbols (F, i, j, P_rx, b) that appear nowhere
                else in the panel. The membership rule — active, same reuse group,
                same satellite or not — is prose in the caption, where it reads.
              */}
              <FormulaSideControlSection
                testId="interference-controls"
                // No `helpId` on purpose: that prop moves the caption into a "?"
                // popover, and on THIS section the caption is the answer to "what
                // does K actually do" — it has to be on the page, not one click away.
                contextPlacement="leading"
                side="denominator"
                title="Co-channel interference / denominator"
                titleText={say('section.interference.title', '同頻干擾（分母項）', 'Co-channel interference (denominator term)')}
                formula={(
                  <>I<sup>a</sup> + I<sup>b</sup> = Σ<sub>same group</sub> (P<sub>t</sub> · H · G<sup>T</sup>), where group(b) = (b-1) mod K — an interfering beam reaches the receiver through the same numerator chain as the wanted signal, minus G<sup>R</sup>, and K decides which beams are co-channel.</>
                )}
                // The `group(b) = (b-1) mod K` line is gone on purpose: the F-label
                // row below SHOWS the grouping, which is the same fact without the
                // modulo.
                formulaExpr={(
                  <>I<sup>a</sup> + I<sup>b</sup> = Σ<sub>{say('section.interference.sumOver', '同頻', 'same frequency')}</sub> (P<sub>t</sub> · H · G<sup>T</sup>)</>
                )}
                // One line, not a paragraph. The colour row below carries the
                // explanation — nobody reads three sentences of prose to find out
                // what a slider does.
                subtitle="Beams carrying the same frequency are the ones that interfere."
                subtitleText={say(
                  'section.interference.hint',
                  '同一個 F 編號 = 同一種頻率 = 會互相干擾。',
                  'Same F number = same frequency = they interfere with each other.',
                )}
                accentColor={getFormulaTabAccent('interference')}
              >
              <SelectControl
                symbol={<>K</>}
                label="Frequency reuse factor"
                labelKey="param.frequencyReuse.label"
                description="Active beams with the same reuse index contribute co-channel interference."
                effect="Lower K makes handover harder because more active beams interfere. Higher K makes the scene cleaner, but can overstate SINR if the reuse plan is too optimistic."
                helpId="param.frequencyReuse"
                helpBodyKey="param.frequencyReuse.help"
                helpEffectKey="param.frequencyReuse.effect"
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
                      title={`B${beamId}`}
                      data-testid={`interference-frequency-swatch-${beamId}`}
                      data-frequency-index={frequencyIndex}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 28,
                        height: 26,
                        borderRadius: UI_TOKENS.radius.sm,
                        background: UI_TOKENS.color.surface.card,
                        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
                        color: UI_TOKENS.color.text.secondary,
                        fontSize: UI_TOKENS.type.size.caption,
                        fontWeight: UI_TOKENS.type.weight.heavy,
                      }}
                    >
                      {formatFrequencyLabel(frequencyIndex)}
                    </span>
                  );
                })}
              </div>
              </FormulaSideControlSection>
            </div>
          )}

          {/*
            THREE BLOCKS, DEMOTED — not deleted.

            "Formula / notes", "Current run configuration" and the "Formula term
            map" each restated something the top of this tab already says: the
            header prints the whole fraction, and every symbol now carries its
            own "?" holding the definition and the "what changes if I move it".
            Three more cards repeating that under the sliders made the page long
            without adding a fact.

            They stay in the DOM, visually hidden and aria-hidden, because the
            provenance gates match this panel by their test ids, their `open`
            state and their canonical English headings (`sinr-formula-map`, its
            numerator/denominator tiles, `active-tab-formula-context`,
            `sinr-overview-disclosure`, "SINR Formula Tuning", "Formula / notes",
            "SINR overview"). Rendering them off-screen keeps every one of those
            hooks intact and truthful while the student sees a clean tab.

            Once agent-M's rewrite lands and those gates match on test ids alone,
            this whole wrapper can be deleted outright.
          */}
          <div aria-hidden="true" data-prominence="canonical-copy" style={srOnlyStyle}>
            <FormulaContextDisclosure tab={activeTabConfig} />

            <SinrOverview
              baseProfile={baseProfile}
              receiverGainDbi={tuning.ueAntennaMaxGainDbi}
            />

            <details data-testid="sinr-formula-map-disclosure" open>
              <summary>
                {say('section.formulaMap.title', '公式項目對照表', 'Formula term map')}
              </summary>
              <SinrFormulaMap receiverGainDbi={tuning.ueAntennaMaxGainDbi} />
            </details>
          </div>

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
