import { useState } from 'react';
import { UI_TOKENS } from '../constants/uiTokens';
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
import { NumericControl, PathLossTermControl, SelectControl } from './signal-tuning/Controls';
import { SinrFormulaMap } from './signal-tuning/FormulaMap';
import { FormulaTabList } from './signal-tuning/FormulaTabList';
import { SinrOverview } from './signal-tuning/SinrOverview';
import { TopologyTab } from './signal-tuning/TopologyTab';
import {
  FREQUENCY_REUSE_OPTIONS,
  GAIN_MODEL_OPTIONS,
  PATH_LOSS_LABELS,
  getActiveTabConfig,
  getFormulaTabAccent,
} from './signal-tuning/tuningConfig';
import {
  collapsedPanelStyle,
  compactDetailsStyle,
  compactSummaryStyle,
  controlStackStyle,
  dividerStyle,
  drawerContentStyle,
  pagePanelStyle,
  panelStyle,
} from './signal-tuning/styles';
import type { SignalDrawerState, TuningTabKey } from './signal-tuning/types';
import { formatDbi } from './signal-tuning/formatters';
import type { UiMode } from './uiMode';
import type { AppExperienceMode } from './appMode';

interface SignalTuningPanelProps {
  baseProfile: Profile;
  tuning: SignalTuningState;
  topology: SceneTopologyState;
  sceneVisualScale: SceneVisualScaleState;
  hasOverrides: boolean;
  appMode: AppExperienceMode;
  uiMode: UiMode;
  formulaBudget: LinkBudgetTerms | null;
  isFormulaEvidenceStale?: boolean;
  initialActiveTab?: TuningTabKey;
  onTuningChange: (next: SignalTuningState) => void;
  onTopologyChange: (next: SceneTopologyState) => void;
  onSceneVisualScaleChange: (next: SceneVisualScaleState) => void;
  onReset: () => void;
}

function getSignalDrawerState(uiMode: UiMode): SignalDrawerState {
  if (uiMode === 'presentation') return 'collapsed';
  return uiMode;
}

export function SignalTuningPanel({
  baseProfile,
  tuning,
  topology,
  sceneVisualScale,
  hasOverrides,
  appMode,
  uiMode,
  formulaBudget,
  isFormulaEvidenceStale = false,
  initialActiveTab = 'signal-power',
  onTuningChange,
  onTopologyChange,
  onSceneVisualScaleChange,
  onReset,
}: SignalTuningPanelProps) {
  const [activeTab, setActiveTab] = useState<TuningTabKey>(initialActiveTab);
  const drawerState = getSignalDrawerState(uiMode);
  const activeTabConfig = getActiveTabConfig(activeTab);
  const isTr38811Formula = baseProfile.formulaFamily === 'hobs-tr38811';
  const fsplEnabled = tuning.pathLossComponents.includes('fspl');
  const atmosphericEnabled = tuning.pathLossComponents.includes('atmospheric');
  const scintillationEnabled = tuning.pathLossComponents.includes('scintillation');
  const shadowFadingEnabled = tuning.pathLossComponents.includes('shadow-fading');
  const tr38811Environment = baseProfile.channel.tr38811?.environment ?? DEFAULT_TR38811_CHANNEL.environment;

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
      data-drawer-state={drawerState}
      aria-label="Signal tuning controls"
      aria-expanded={drawerState !== 'collapsed'}
      style={drawerState === 'collapsed' ? collapsedPanelStyle : panelStyle}
    >
      {drawerState === 'collapsed' && (
        <div
          className="leo-signal-tuning-handle"
          data-testid="signal-tuning-drawer-handle"
          aria-hidden="true"
        >
          <span className="leo-signal-tuning-handle-symbol">γ</span>
          <span className="leo-signal-tuning-handle-rule" />
          <span className="leo-signal-tuning-handle-symbol">K</span>
        </div>
      )}
      <div
        className="leo-signal-tuning-content"
        data-testid="signal-tuning-drawer-content"
        hidden={drawerState === 'collapsed'}
        style={drawerState === 'collapsed' ? { display: 'none' } : drawerContentStyle}
      >
        <section
          id="tuning-page-panel-sinr-formula"
          data-testid="sinr-formula-page"
          role="tabpanel"
          aria-label="SINR formula controls"
          style={pagePanelStyle}
        >
          <FormulaTabList activeTab={activeTab} appMode={appMode} onChange={setActiveTab} />

          {activeTab === 'signal-power' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="signal-power-controls"
                side="numerator"
                title="Transmit Power / numerator"
                formula={<>P<sub>t</sub> starts the desired-signal numerator.</>}
                subtitle="This tab controls transmit power only. Receiver gain has its own tab."
              >
                <NumericControl
                  testId="pt-signal-power-control"
                  symbol={<>P<sub>t</sub></>}
                  label="Per-beam transmit power"
                  unit="dBm"
                  value={tuning.maxTxPowerDbm}
                  min={30}
                  max={60}
                  step={0.5}
                  description="Base transmit power before dynamic power control overrides."
                  effect="Raising it strengthens both the serving beam and any co-channel interferers."
                  onChange={maxTxPowerDbm => update({ maxTxPowerDbm })}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {activeTab === 'receiver-gain' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="receiver-gain-controls"
                side="numerator"
                title="Receiver Gain / numerator"
                formula={<>S includes G<sup>R</sup> after transmit power, path loss, and transmit gain.</>}
                subtitle="This tab controls receive-side gain independently from P_t and G^T."
                accentColor={UI_TOKENS.color.semantic.fixed}
              >
                <NumericControl
                  testId="gr-receiver-gain-control"
                  symbol={<>G<sup>R</sup></>}
                  label="Receiver gain"
                  unit="dBi"
                  value={tuning.ueAntennaMaxGainDbi}
                  min={-10}
                  max={20}
                  step={0.5}
                  description="Receive-side antenna gain in the SINR signal path."
                  effect="Adjusting it shifts the desired-signal numerator without changing transmit power, satellite beam gain, interference grouping, or thermal noise."
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
                side="denominator"
                title="Thermal Noise / denominator"
                formula={<>σ² = N<sub>0</sub>B</>}
                subtitle={<>B and N<sub>0</sub> set the denominator noise floor. They are not transmit-power controls.</>}
                accentColor={UI_TOKENS.color.semantic.noise}
              >
                <NumericControl
                  testId="bandwidth-thermal-noise-control"
                  symbol={<>B</>}
                  label="Channel bandwidth"
                  unit="MHz"
                  value={tuning.bandwidthMHz}
                  min={5}
                  max={400}
                  step={5}
                  description="Bandwidth used in σ² = N₀B."
                  effect="Wider bandwidth increases thermal noise when transmit power is held fixed."
                  accentColor={UI_TOKENS.color.semantic.noise}
                  formatValue={value => `${value.toFixed(0)} MHz`}
                  onChange={bandwidthMHz => update({ bandwidthMHz })}
                />
                <NumericControl
                  testId="n0-thermal-noise-control"
                  symbol={<>N<sub>0</sub></>}
                  label="Noise PSD"
                  unit="dBm/Hz"
                  value={tuning.noisePsdDbmHz}
                  min={-180}
                  max={-160}
                  step={0.5}
                  description="Thermal noise density before multiplying by bandwidth."
                  effect="A less negative value raises the noise floor and lowers weak-link SINR."
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
                subtitle={<>L = L<sub>fs</sub> + L<sub>g</sub> + L<sub>sc</sub> + L<sub>sf</sub></>}
              >
                <PathLossTermControl
                  testId="path-loss-term-fspl"
                  active={fsplEnabled}
                  symbol={<>L<sub>fs</sub></>}
                  label="Free-space loss"
                  detail={PATH_LOSS_LABELS.fspl.detail}
                  controlLabel="Carrier frequency"
                  unit="GHz"
                  value={tuning.frequencyGHz}
                  min={10}
                  max={40}
                  step={0.5}
                  effect="Higher frequency raises Lfs."
                  inactiveReason="Not contributing while Lfs is off."
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
                  detail={PATH_LOSS_LABELS.atmospheric.detail}
                  controlLabel="Zenith loss"
                  unit="dB"
                  value={tuning.atmosphericZenithLossDb}
                  min={0}
                  max={1}
                  step={0.01}
                  effect="Raises Lg when enabled."
                  inactiveReason="Not contributing while Lg is off."
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
                  detail={PATH_LOSS_LABELS.scintillation.detail}
                  controlLabel="Scale"
                  unit="dB"
                  value={tuning.scintillationScaleDb}
                  min={0}
                  max={1}
                  step={0.01}
                  effect="Raises Lsc when enabled."
                  inactiveReason="Not contributing while Lsc is off."
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
                  detail={PATH_LOSS_LABELS['shadow-fading'].detail}
                  controlLabel="Margin"
                  unit="dB"
                  value={tuning.shadowFadingMarginDb}
                  min={0}
                  max={10}
                  step={0.1}
                  effect="Raises Lsf when enabled."
                  inactiveReason="Not contributing while Lsf is off."
                  accentColor={UI_TOKENS.color.semantic.loss}
                  onToggle={() => togglePathLossComponent('shadow-fading')}
                  onChange={shadowFadingMarginDb => update({ shadowFadingMarginDb })}
                />
              </LossControlSection>

              <LossControlSection
                testId="loss-research-override"
                title="TR 38.811 Research Override"
                tone="research"
                subtitle="Teaching / sensitivity controls for simulator constants; not HOBS paper-backed parameter ranges. TR 38.811 NLoS sensitivity control; common loss terms are grouped above with their switches."
              >
                {isTr38811Formula && (
                  <NumericControl
                    testId="lcl-nlos-control"
                    symbol={<>L<sub>cl,NLoS</sub></>}
                    label="NLoS clutter loss"
                    unit="dB"
                    value={tuning.tr38811NlosClutterLossDb}
                    min={0}
                    max={40}
                    step={0.5}
                    description="TR 38.811 NLoS clutter Research Override for seeded NLoS samples only."
                    effect="Editable in the HOBS + TR 38.811 research profile; changing it affects only seeded NLoS samples. Seeded LoS samples do not change."
                    accentColor={UI_TOKENS.color.semantic.fixed}
                    onChange={tr38811NlosClutterLossDb => update({ tr38811NlosClutterLossDb })}
                  />
                )}
                {isTr38811Formula && (
                  <div style={{
                    display: 'grid',
                    gap: 4,
                    padding: '10px 11px',
                    borderRadius: UI_TOKENS.radius.md,
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 214, 125, 0.12)',
                    color: 'rgba(255, 230, 173, 0.78)',
                    fontSize: UI_TOKENS.type.size.body,
                    lineHeight: 1.45,
                  }}>
                    <span style={{ fontWeight: UI_TOKENS.type.weight.heavy }}>
                      TR 38.811 LoS environment: {tr38811Environment}
                    </span>
                    <span>Read-only in Phase 8B; no editable environment selector is provided.</span>
                  </div>
                )}
              </LossControlSection>
            </div>
          )}

          {activeTab === 'beam' && (
            <div style={controlStackStyle}>
              <FormulaSideControlSection
                testId="beam-gain-controls"
                side="numerator"
                title="Transmit Gain / numerator"
                formula={<>G<sup>T</sup> = G<sub>t,max</sub> + G(θ) - L<sub>scan</sub></>}
                subtitle="These controls shape the satellite-side gain term before receiver gain is applied."
                accentColor={UI_TOKENS.color.semantic.beam}
              >
                <NumericControl
                  testId="gtmax-transmit-gain-control"
                  symbol={<>G<sub>t,max</sub></>}
                  label="Max transmit gain"
                  unit="dBi"
                  value={tuning.maxGainDbi}
                  min={20}
                  max={60}
                  step={0.5}
                  description="Peak satellite-beam gain before off-axis and scan losses."
                  effect="Raising it shifts the transmit-gain numerator factor for all beams in the current profile."
                  accentColor={UI_TOKENS.color.semantic.beam}
                  onChange={maxGainDbi => update({ maxGainDbi })}
                />
                <NumericControl
                  symbol={<>θ<sub>3dB</sub></>}
                  label="3 dB beamwidth"
                  unit="degrees"
                  value={tuning.beamwidth3dBDeg}
                  min={1}
                  max={8}
                  step={0.1}
                  description="Main-lobe width used by the gain pattern and beam footprint geometry."
                  effect="Changing it rebuilds beam layout and clears in-progress HO preparation."
                  accentColor={UI_TOKENS.color.semantic.beamSoft}
                  formatValue={value => `${value.toFixed(1)}°`}
                  onChange={beamwidth3dBDeg => update({ beamwidth3dBDeg })}
                />
                <SelectControl
                  symbol={<>G(θ)</>}
                  label="Beam gain model"
                  description="Off-axis gain model applied after the UE-to-beam-center angle is known."
                  value={tuning.model}
                  options={GAIN_MODEL_OPTIONS}
                  accentColor={UI_TOKENS.color.semantic.beamCool}
                  onChange={model => update({ model: model as GainModel })}
                />
                <NumericControl
                  symbol={<>θ<sub>max</sub></>}
                  label="Max steering angle"
                  unit="degrees"
                  value={tuning.maxSteeringAngleDeg}
                  min={1}
                  max={20}
                  step={0.5}
                  description="Largest scan angle accepted when building steering-valid beam cells."
                  effect="A larger value can keep more candidate beams available, but edge beams may pay scan loss."
                  accentColor={UI_TOKENS.color.semantic.beamCool}
                  formatValue={value => `${value.toFixed(1)}°`}
                  onChange={maxSteeringAngleDeg => update({ maxSteeringAngleDeg })}
                />
                <NumericControl
                  symbol={<>L<sub>scan,max</sub></>}
                  label="Max scan loss"
                  unit="dB"
                  value={tuning.scanLossAtMaxSteeringDb}
                  min={0}
                  max={10}
                  step={0.25}
                  description="Loss applied quadratically as steering approaches θmax."
                  effect="Higher loss penalizes beams near the steering limit and can change the best candidate."
                  accentColor={UI_TOKENS.color.semantic.beamLoss}
                  onChange={scanLossAtMaxSteeringDb => update({ scanLossAtMaxSteeringDb })}
                />
              </FormulaSideControlSection>
            </div>
          )}

          {activeTab === 'interference' && (
            <div style={controlStackStyle}>
              <SelectControl
                symbol={<>K</>}
                label="Frequency reuse factor"
                description="Active beams with the same reuse index contribute co-channel interference."
                value={String(tuning.frequencyReuse)}
                options={FREQUENCY_REUSE_OPTIONS.map(value => ({
                  value: String(value),
                  label: `K = ${value}`,
                  detail: value === 1
                    ? 'All active beams share one frequency group: harshest interference case.'
                    : `Beams are split across ${value} reuse groups, reducing co-channel collisions.`,
                }))}
                accentColor={getFormulaTabAccent('interference')}
                onChange={frequencyReuse => update({ frequencyReuse: Number(frequencyReuse) })}
              />
              <div style={{
                padding: '12px 14px',
                borderRadius: UI_TOKENS.radius.lg,
                background: 'rgba(255, 214, 125, 0.07)',
                border: '1px solid rgba(255, 214, 125, 0.16)',
                color: 'rgba(255, 230, 173, 0.82)',
                fontSize: UI_TOKENS.type.size.body,
                lineHeight: 1.5,
              }}>
                <details style={compactDetailsStyle}>
                  <summary style={{
                    ...compactSummaryStyle,
                    color: UI_TOKENS.color.semantic.fixed,
                  }}>
                    Reuse-plan note
                  </summary>
                  <div style={{ paddingTop: 8 }}>
                    Lower K makes handover harder because more active beams interfere. Higher K makes the scene cleaner,
                    but can overstate SINR if the reuse plan is too optimistic.
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Phase E used: activeTab === 'topology' && appMode === 'sinr-experiment'. Phase C keeps visual scale visible in both app modes. */}
          {activeTab === 'topology' && (
            <TopologyTab
              topology={topology}
              sceneVisualScale={sceneVisualScale}
              baseProfile={baseProfile}
              appMode={appMode}
              onTopologyChange={onTopologyChange}
              onSceneVisualScaleChange={onSceneVisualScaleChange}
              onReset={() => onTopologyChange(createSceneTopologyState())}
            />
          )}

          <FormulaContextDisclosure tab={activeTabConfig} />

          <SinrOverview
            baseProfile={baseProfile}
            receiverGainDbi={tuning.ueAntennaMaxGainDbi}
            hasOverrides={hasOverrides}
            onReset={onReset}
          />

          <details
            data-testid="sinr-formula-map-disclosure"
            style={{
              display: 'grid',
              gap: 10,
              padding: '10px 11px',
              borderRadius: UI_TOKENS.radius.lg,
              background: 'rgba(118, 234, 215, 0.09)',
              border: '1px solid rgba(118, 234, 215, 0.26)',
              color: UI_TOKENS.color.text.secondary,
            }}
          >
            <summary style={{
              cursor: 'pointer',
              color: UI_TOKENS.color.semantic.tuningSoft,
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.heavy,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              Formula term map
            </summary>
            <div style={{ paddingTop: 10 }}>
              <SinrFormulaMap receiverGainDbi={tuning.ueAntennaMaxGainDbi} />
            </div>
          </details>

          <div style={dividerStyle} />
        </section>
      </div>
    </aside>
  );
}
