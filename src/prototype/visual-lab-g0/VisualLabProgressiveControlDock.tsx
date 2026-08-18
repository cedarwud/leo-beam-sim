import { type KeyboardEvent, type ReactElement, type ReactNode, useState } from 'react';
import {
  DEFAULT_VISUAL_LAB_INPUTS,
  VISUAL_LAB_INPUT_DEFINITIONS,
  VISUAL_LAB_INPUT_SUBGROUPS,
  type LocalizedCopy,
  type VisualLabInputDefinition,
  type VisualLabInputKey,
  type VisualLabInputValues,
  type VisualLabLocale,
} from '../../visualLab/experiment';
import {
  formatCompactUnit,
  formatFrequency,
  formatRate,
} from '../../visualLab/format/compact';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';
import {
  isControlModule,
  isInputModule,
  moduleDefinition,
  moduleLabel,
  type VisualLabModuleKey,
} from './visualLabWorkspace';
import type { VisualLabConstellation } from './VisualLabScene';
import { renderFormulaText } from '../../ui/common/formulaText';
import { UI_TOKENS } from '../../constants/uiTokens';
import {
  SUPPORTED_BEAM_LAYOUT_COUNTS,
  type SupportedBeamLayoutCount,
} from '../../core/beam/completeHexPresets';
import type { SimulatorBeamIlluminationMode } from '../../simulator/beamIlluminationScenario';

export interface VisualLabSceneSource {
  readonly constellation: VisualLabConstellation;
  readonly localDateTime: string;
}

export interface VisualLabUeGeometryControls {
  readonly acceptedAngleDeg: number;
  readonly draftAngleDeg: number;
  readonly maxAngleDeg: number;
  readonly hasDraft: boolean;
  readonly onAngleChange: (angleDeg: number) => void;
  readonly onReset: () => void;
}

export interface VisualLabProgressiveControlDockProps {
  readonly locale: VisualLabLocale;
  readonly activeModule: VisualLabModuleKey;
  readonly inputs: VisualLabInputValues;
  readonly acceptedSource: VisualLabSceneSource;
  readonly draftSource: VisualLabSceneSource;
  readonly applyingSource: boolean;
  /** Presentation/export lock; unlike applyingSource it must not change status copy. */
  readonly interactionLocked?: boolean;
  readonly sourceDirty: boolean;
  readonly beamLayoutCount: SupportedBeamLayoutCount;
  readonly beamIlluminationMode: SimulatorBeamIlluminationMode;
  readonly ueGeometry?: VisualLabUeGeometryControls | null;
  /** Expert-only per-satellite choices; the global selector remains the fallback. */
  readonly perSatelliteBeamLayoutCount?: Readonly<Record<string, SupportedBeamLayoutCount>>;
  readonly onDraftSourceChange: (patch: Partial<VisualLabSceneSource>) => void;
  readonly onApplySource: () => void;
  readonly onBeamLayoutCountChange: (beamCount: SupportedBeamLayoutCount) => void;
  readonly onBeamIlluminationModeChange: (mode: SimulatorBeamIlluminationMode) => void;
  readonly onPerSatelliteBeamLayoutChange?: (satelliteId: string, beamCount: SupportedBeamLayoutCount) => void;
  readonly onPerSatelliteBeamLayoutRemove?: (satelliteId: string) => void;
  readonly onInputChange: (key: VisualLabInputKey, canonicalValue: number) => void;
  readonly onResetInput?: (key: VisualLabInputKey) => void;
  readonly onResetAll?: () => void;
  readonly snapshot: VisualLabCanonicalSnapshot;
  readonly className?: string;
}

const localized = (zhHant: string, en: string): LocalizedCopy => Object.freeze({ 'zh-Hant': zhHant, en });

const COPY = Object.freeze({
  panelAria: localized('模型控制面板', 'Model controls'),
  controls: localized('控制面板', 'Controls'),
  resetAll: localized('重設全部', 'Reset all'),
  constellation: localized('衛星星系', 'Constellation'),
  tleTime: localized('TLE 時刻（台北）', 'TLE time (Taipei)'),
  customTime: localized('自訂日期與時間', 'Custom date and time'),
  applyScene: localized('套用場景', 'Apply scene'),
  applyingScene: localized('建立場景…', 'Building scene…'),
  sceneApplied: localized('場景已套用', 'Scene applied'),
  currentData: localized('目前資料', 'Current data'),
  pendingChanges: localized('有待套用變更', 'Changes pending'),
  beamLayout: localized('每顆衛星波束配置', 'Beams per satellite'),
  ueGeometry: localized('UE 與波束幾何', 'UE and beam geometry'),
  offAxisAngle: localized('離軸角 θ', 'Off-axis angle θ'),
  acceptedAngle: localized('目前計算值', 'Accepted result'),
  beamSize: localized('波束大小', 'Beam size'),
  resetGeometry: localized('重設位置', 'Reset position'),
  geometryHint: localized('拖曳時立即更新場景；計算期間先保留上一筆結果。', 'The scene updates while dragging; the previous result stays visible while it recalculates.'),
  satelliteOverrides: localized('波束配置', 'Beam configuration'),
  servingSatellite: localized('服務衛星', 'Serving satellite'),
  candidateSatellite: localized('候選衛星', 'Candidate satellite'),
  satelliteLayout: localized('波束配置', 'beam layout'),
  removeSatelliteOverride: localized('移除個別覆寫', 'Remove override'),
  details: localized('作用與計算路徑', 'Role and calculation path'),
  causalPath: localized('作用鏈', 'Causal path'),
  reset: localized('重設', 'Reset'),
  value: localized('數值', 'Value'),
  defaultValue: localized('預設', 'Default'),
} as const);

const BEAM_LAYOUT_OPTIONS: readonly { readonly id: SupportedBeamLayoutCount; readonly label: LocalizedCopy }[] =
  SUPPORTED_BEAM_LAYOUT_COUNTS.map(count => ({
    id: count,
    label: localized(
      String(count),
      String(count),
    ),
  }));

type SinrFormulaSection = 'power' | 'channel' | 'beam' | 'receiver' | 'interference' | 'noise';

interface SinrFormulaSemantic {
  readonly className: string;
  readonly dataSymbol: string;
  readonly color: string;
}

const SINR_FORMULA_SEMANTICS: Record<SinrFormulaSection, SinrFormulaSemantic> = {
  power: {
    className: 'vlab-sinr-formula-term--power',
    dataSymbol: 'p-dl-post-satellite-cap',
    color: UI_TOKENS.color.semantic.tuning,
  },
  channel: {
    className: 'vlab-sinr-formula-term--channel',
    dataSymbol: 'large-scale-gain',
    color: UI_TOKENS.color.semantic.loss,
  },
  beam: {
    className: 'vlab-sinr-formula-term--beam',
    dataSymbol: 'transmit-beam-gain',
    color: UI_TOKENS.color.semantic.beam,
  },
  receiver: {
    className: 'vlab-sinr-formula-term--receiver',
    dataSymbol: 'receive-gain',
    color: UI_TOKENS.color.semantic.fixed,
  },
  interference: {
    className: 'vlab-sinr-formula-term--interference',
    dataSymbol: 'interference',
    color: '#ff8a6b',
  },
  noise: {
    className: 'vlab-sinr-formula-term--noise',
    dataSymbol: 'noise',
    color: UI_TOKENS.color.semantic.noise,
  },
};

const SINR_SECTION_OPTIONS: readonly {
  readonly id: SinrFormulaSection;
  readonly symbol: string;
  readonly label: LocalizedCopy;
  readonly semantic: SinrFormulaSemantic;
}[] = [
  { id: 'power', symbol: 'P̃ᵇᴰᴸ', label: localized('功率鏈', 'Power chain'), semantic: SINR_FORMULA_SEMANTICS.power },
  { id: 'channel', symbol: 'Gᴸˢ', label: localized('大尺度傳播增益', 'Large-scale gain'), semantic: SINR_FORMULA_SEMANTICS.channel },
  { id: 'beam', symbol: 'Gᵀ(θ)', label: localized('發射波束增益', 'Transmit beam gain'), semantic: SINR_FORMULA_SEMANTICS.beam },
  { id: 'receiver', symbol: 'Gᴿ', label: localized('接收增益', 'Receive gain'), semantic: SINR_FORMULA_SEMANTICS.receiver },
  { id: 'interference', symbol: 'I', label: localized('同頻干擾', 'Interference'), semantic: SINR_FORMULA_SEMANTICS.interference },
  { id: 'noise', symbol: 'σ²', label: localized('背景雜訊', 'Noise'), semantic: SINR_FORMULA_SEMANTICS.noise },
];

/** Only the controls owned by the selected SINR term remain visible below
 * the fixed total equation.  Power-ledger controls stay on the Power tab. */
const SINR_SECTION_INPUT_KEYS: Readonly<Record<SinrFormulaSection, readonly VisualLabInputKey[]>> = Object.freeze({
  power: Object.freeze(['minimumRateBps'] as const),
  channel: Object.freeze(['carrierFrequencyGHz', 'atmosphericZenithLossDb'] as const),
  beam: Object.freeze(['g0Linear', 'theta3dbRad'] as const),
  receiver: Object.freeze(['receiveGainDbi'] as const),
  interference: Object.freeze(['frequencyReuse'] as const),
  noise: Object.freeze(['antennaNoiseTemperatureK', 'noiseFigureDb', 'noiseReferenceTemperatureK', 'systemBandwidthHz'] as const),
});

function text(copy: LocalizedCopy, locale: VisualLabLocale): string {
  return copy[locale];
}

function visibleSchemaCopy(copy: LocalizedCopy, locale: VisualLabLocale): string {
  return copy[locale]
    .replace(/\bcanonical\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/；\s*/g, '；')
    .trim();
}

function inputId(key: VisualLabInputKey): string {
  return `vlab-progressive-input-${key}`;
}

function safeDisplayValue(definition: VisualLabInputDefinition, canonicalValue: number): number {
  const displayValue = definition.toDisplayValue(canonicalValue);
  return Number.isFinite(displayValue)
    ? displayValue
    : definition.toDisplayValue(definition.defaultValue);
}

function visibleUnit(definition: VisualLabInputDefinition, locale: VisualLabLocale): string {
  if (definition.displayUnit === 'degree') return '°';
  if (definition.displayUnit === 'groups') return locale === 'zh-Hant' ? '組' : 'groups';
  return definition.displayUnit;
}

function displayValueText(
  definition: VisualLabInputDefinition,
  canonicalValue: number,
  locale: VisualLabLocale,
): string {
  const displayValue = safeDisplayValue(definition, canonicalValue);
  if (definition.key === 'systemBandwidthHz') return formatFrequency(displayValue);
  if (definition.key === 'minimumRateBps') return formatRate(displayValue);
  if (definition.displayUnit === 'W' || definition.displayUnit === 'W/beam' || definition.displayUnit === 'W/satellite') {
    return formatCompactUnit(displayValue, definition.displayUnit);
  }
  if (definition.displayUnit === 'ratio') {
    return `${(displayValue * 100).toFixed(displayValue < .1 ? 1 : 0)}%`;
  }
  return `${definition.formatDisplayValue(displayValue)} ${visibleUnit(definition, locale)}`;
}

function commitDisplayValue(
  definition: VisualLabInputDefinition,
  event: { readonly currentTarget: HTMLInputElement },
  onChange: VisualLabProgressiveControlDockProps['onInputChange'],
): void {
  const displayValue = Number(event.currentTarget.value);
  if (!Number.isFinite(displayValue)) return;
  onChange(definition.key, definition.fromDisplayValue(displayValue));
}

function blurOnEnter(
  event: KeyboardEvent<HTMLInputElement>,
): void {
  if (event.key !== 'Enter') return;
  event.currentTarget.blur();
}

const RANGE_COMMIT_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown',
]);

function commitRangeKey(
  definition: VisualLabInputDefinition,
  event: KeyboardEvent<HTMLInputElement>,
  onChange: VisualLabProgressiveControlDockProps['onInputChange'],
): void {
  if (!RANGE_COMMIT_KEYS.has(event.key)) return;
  commitDisplayValue(definition, event, onChange);
}

function moduleAccent(module: VisualLabModuleKey): string {
  return module === 'scene' ? 'scene' : module;
}

export function VisualLabProgressiveControlDock({
  locale = 'zh-Hant',
  activeModule,
  inputs,
  acceptedSource,
  draftSource,
  applyingSource,
  interactionLocked = false,
  sourceDirty,
  beamLayoutCount,
  ueGeometry = null,
  perSatelliteBeamLayoutCount = {},
  onDraftSourceChange,
  onApplySource,
  onBeamLayoutCountChange,
  onPerSatelliteBeamLayoutChange,
  onPerSatelliteBeamLayoutRemove,
  onInputChange,
  onResetInput,
  onResetAll,
  snapshot,
  className,
}: VisualLabProgressiveControlDockProps): ReactElement {
  const classNames = ['vlab-progressive-dock', className].filter(Boolean).join(' ');
  // Scientific edits are optimistic: the accepted frame remains on screen
  // while the worker rebuilds a new frame.  Only source-apply controls are
  // locked during that rebuild; parameter controls stay responsive.
  const controlsDisabled = interactionLocked;
  const sourceControlsDisabled = applyingSource || interactionLocked;
  const [activeSinrSection, setActiveSinrSection] = useState<SinrFormulaSection>('power');
  if (!isControlModule(activeModule)) {
    return <aside id="vlab-controls" className={classNames} aria-label={text(COPY.panelAria, locale)} data-compatibility-only="result-focus" />;
  }
  const selectedDefinition = moduleDefinition(activeModule);
  const inputDefinitions = isInputModule(activeModule)
    ? VISUAL_LAB_INPUT_DEFINITIONS.filter((definition) => definition.group === activeModule)
    : [];
  const allInputSubgroups = isInputModule(activeModule)
    ? VISUAL_LAB_INPUT_SUBGROUPS.filter((subgroup) => subgroup.group === activeModule)
    : [];
  const visibleInputDefinitions = activeModule === 'sinr'
    ? inputDefinitions.filter((definition) => SINR_SECTION_INPUT_KEYS[activeSinrSection].includes(definition.key))
    : inputDefinitions;
  const inputSubgroups = allInputSubgroups.filter((subgroup) => visibleInputDefinitions.some(definition => definition.subgroup === subgroup.key));
  const beamWidthDefinition = VISUAL_LAB_INPUT_DEFINITIONS.find(definition => definition.key === 'theta3dbRad');
  const selectedLabel = moduleLabel(activeModule, locale);
  const expertSatelliteChoices: Array<{ satelliteId: string; roleLabel: string }> = [];
  if (activeModule === 'scene' && snapshot.serving.satelliteId !== null) {
    expertSatelliteChoices.push({
      satelliteId: snapshot.serving.satelliteId,
      roleLabel: text(COPY.servingSatellite, locale),
    });
  }
  if (activeModule === 'scene' && snapshot.candidate.satelliteId !== null) {
    const existing = expertSatelliteChoices.find(choice => choice.satelliteId === snapshot.candidate.satelliteId);
    if (existing === undefined) {
      expertSatelliteChoices.push({
        satelliteId: snapshot.candidate.satelliteId,
        roleLabel: text(COPY.candidateSatellite, locale),
      });
    } else {
      existing.roleLabel = `${existing.roleLabel} / ${text(COPY.candidateSatellite, locale)}`;
    }
  }

  return (
    <aside id="vlab-controls" className={classNames} aria-label={text(COPY.panelAria, locale)} aria-disabled={interactionLocked || undefined} inert={interactionLocked || undefined} tabIndex={-1}>
      <section
        className={`vlab-progressive-dock__panel vlab-progressive-dock__panel--${moduleAccent(activeModule)}`}
        id="vlab-progressive-dock-panel"
        role="tabpanel"
        aria-label={`${selectedLabel} ${text(COPY.controls, locale)}`}
      >
        <header className="vlab-progressive-dock__panel-header">
          <div>
            <p className="vlab-eyebrow">{selectedDefinition.symbol}</p>
            <h2>{selectedLabel}</h2>
          </div>
          <div className="vlab-progressive-dock__panel-actions">
            {onResetAll && isInputModule(activeModule) ? <button className="vlab-quiet-button" type="button" onClick={onResetAll} disabled={controlsDisabled} style={{ minHeight: 44 }}>{text(COPY.resetAll, locale)}</button> : null}
          </div>
        </header>

        {activeModule === 'scene' ? (
          <div className="vlab-progressive-scene-controls">
            <div className="vlab-progressive-source-row">
              <div className="vlab-progressive-source-field">
                <span className="vlab-progressive-field-label">{text(COPY.constellation, locale)}</span>
                <div className="vlab-segmented" role="group" aria-label={text(COPY.constellation, locale)}>
                  {(['starlink', 'oneweb'] as const).map((constellation) => (
                    <button
                      key={constellation}
                      type="button"
                      className={draftSource.constellation === constellation ? 'is-active' : ''}
                      aria-pressed={draftSource.constellation === constellation}
                      disabled={sourceControlsDisabled}
                      onClick={() => onDraftSourceChange({ constellation })}
                      style={{ minHeight: 44 }}
                    >
                      {constellation === 'starlink' ? 'Starlink' : 'OneWeb'}
                    </button>
                  ))}
                </div>
              </div>
              <button className="vlab-apply-button" type="button" onClick={onApplySource} disabled={sourceControlsDisabled || !sourceDirty} style={{ minHeight: 44 }}>
                {applyingSource ? text(COPY.applyingScene, locale) : sourceDirty ? text(COPY.applyScene, locale) : text(COPY.sceneApplied, locale)}
              </button>
            </div>
            <details className="vlab-progressive-custom-time">
              <summary>{text(COPY.customTime, locale)}</summary>
              <label className="vlab-progressive-source-field">
                <span className="vlab-progressive-field-label">{text(COPY.tleTime, locale)}</span>
                <input
                  type="datetime-local"
                  name="tleTaipeiDateTime"
                  autoComplete="off"
                  step="0.001"
                  value={draftSource.localDateTime}
                  onChange={(event) => onDraftSourceChange({ localDateTime: event.currentTarget.value })}
                  aria-label={text(COPY.tleTime, locale)}
                  disabled={sourceControlsDisabled}
                  style={{ minHeight: 44 }}
                />
              </label>
            </details>
            <div className="vlab-progressive-source-status" role="status">
              <span className="vlab-status-dot" aria-hidden="true" />
              <span>{text(COPY.currentData, locale)}：{acceptedSource.constellation === 'starlink' ? 'Starlink' : 'OneWeb'} · {acceptedSource.localDateTime.replace('T', ' ')}</span>
              {sourceDirty ? <em>{text(COPY.pendingChanges, locale)}</em> : null}
            </div>
            {ueGeometry !== null && beamWidthDefinition !== undefined ? <section className="vlab-progressive-geometry-controls" aria-labelledby="vlab-geometry-controls-label">
              <div className="vlab-progressive-geometry-controls__heading">
                <span className="vlab-progressive-field-label" id="vlab-geometry-controls-label">{text(COPY.ueGeometry, locale)}</span>
                <span className="vlab-progressive-geometry-controls__accepted">{text(COPY.acceptedAngle, locale)} {ueGeometry.acceptedAngleDeg.toFixed(2)}°</span>
              </div>
              <label className="vlab-progressive-geometry-controls__range" htmlFor="vlab-ue-off-axis-angle">
                <span>{text(COPY.offAxisAngle, locale)}</span>
                <output htmlFor="vlab-ue-off-axis-angle">{ueGeometry.draftAngleDeg.toFixed(2)}°</output>
              </label>
              <input
                id="vlab-ue-off-axis-angle"
                className="vlab-input-card__range"
                type="range"
                min={0}
                max={Math.max(ueGeometry.maxAngleDeg, .01)}
                step={.01}
                value={ueGeometry.draftAngleDeg}
                onChange={(event) => ueGeometry.onAngleChange(Number(event.currentTarget.value))}
                disabled={controlsDisabled}
                aria-label={`${text(COPY.offAxisAngle, locale)} θ`}
              />
              <div className="vlab-progressive-geometry-controls__meta">
                <span>0°–{ueGeometry.maxAngleDeg.toFixed(2)}°</span>
                <span>{text(COPY.geometryHint, locale)}</span>
              </div>
              <div className="vlab-progressive-geometry-controls__actions">
                <button type="button" onClick={ueGeometry.onReset} disabled={controlsDisabled || !ueGeometry.hasDraft} style={{ minHeight: 44 }}>{text(COPY.resetGeometry, locale)}</button>
              </div>
              <span className="vlab-progressive-field-label vlab-progressive-geometry-controls__beam-label">{text(COPY.beamSize, locale)}</span>
              <ProgressiveInputCard
                definition={beamWidthDefinition}
                inputs={inputs}
                locale={locale}
                onChange={onInputChange}
                onResetInput={onResetInput}
                disabled={controlsDisabled}
                className="vlab-progressive-input-card--scene-geometry"
              />
            </section> : null}
            <ControlChoiceRow
              label={text(COPY.beamLayout, locale)}
              options={BEAM_LAYOUT_OPTIONS}
              value={beamLayoutCount}
              locale={locale}
              onChange={onBeamLayoutCountChange}
              disabled={controlsDisabled}
            />
            {expertSatelliteChoices.length > 0 && onPerSatelliteBeamLayoutChange !== undefined ? <details className="vlab-progressive-disclosure" open>
              <summary>{text(COPY.satelliteOverrides, locale)}</summary>
              {expertSatelliteChoices.map(({ satelliteId, roleLabel }) => {
                const override = perSatelliteBeamLayoutCount[satelliteId];
                return <div key={satelliteId} className="vlab-progressive-choice-row">
                  <span className="vlab-progressive-field-label">{roleLabel} · {satelliteId}</span>
                  <ControlChoiceRow
                    label={`${roleLabel} ${satelliteId} ${text(COPY.satelliteLayout, locale)}`}
                    options={BEAM_LAYOUT_OPTIONS}
                    value={override ?? beamLayoutCount}
                    locale={locale}
                    onChange={(beamCount) => onPerSatelliteBeamLayoutChange(satelliteId, beamCount)}
                    disabled={controlsDisabled}
                  />
                  {override !== undefined && onPerSatelliteBeamLayoutRemove !== undefined ? <button
                    className="vlab-quiet-button"
                    type="button"
                    onClick={() => onPerSatelliteBeamLayoutRemove(satelliteId)}
                    disabled={controlsDisabled}
                    style={{ minHeight: 44 }}
                  >{text(COPY.removeSatelliteOverride, locale)}</button> : null}
                </div>;
              })}
            </details> : null}
          </div>
        ) : isInputModule(activeModule) ? (
          <div className="vlab-progressive-science-controls">
            {activeModule === 'sinr' ? <SinrFormulaGuide locale={locale} activeSection={activeSinrSection} onChange={setActiveSinrSection} /> : null}
            <div className="vlab-progressive-input-list">
              {inputSubgroups.map((subgroup) => {
                const subgroupDefinitions = visibleInputDefinitions
                  .filter((definition) => definition.subgroup === subgroup.key);
                if (subgroupDefinitions.length === 0) return null;
                return (
                  <section key={subgroup.key} aria-labelledby={`vlab-progressive-subgroup-${subgroup.key}`}>
                    <p className="vlab-eyebrow" id={`vlab-progressive-subgroup-${subgroup.key}`}>{subgroup.label[locale]}</p>
                    <p className="vlab-progressive-disclosure__source">{subgroup.description[locale]}</p>
                    {subgroupDefinitions.map((definition) => <ProgressiveInputCard key={definition.key} definition={definition} inputs={inputs} locale={locale} onChange={onInputChange} onResetInput={onResetInput} disabled={controlsDisabled} />)}
                  </section>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </aside>
  );
}

function SinrFormulaGuide({
  locale,
  activeSection,
  onChange,
}: {
  readonly locale: VisualLabLocale;
  readonly activeSection: SinrFormulaSection;
  readonly onChange: (section: SinrFormulaSection) => void;
}): ReactElement {
  const zh = locale === 'zh-Hant';
  const formulaTerm = (section: SinrFormulaSection, children: ReactNode): ReactElement => {
    const semantic = SINR_FORMULA_SEMANTICS[section];
    return <span
      className={`vlab-sinr-formula-term ${semantic.className}`}
      data-formula-term={section}
      data-formula-symbol={semantic.dataSymbol}
      style={{ color: semantic.color }}
    >{children}</span>;
  };
  return <section className="vlab-sinr-formula-guide" data-testid="visual-lab-sinr-formula-guide" aria-label={zh ? 'SINR 公式與參數' : 'SINR formula and inputs'}>
    <div className="vlab-sinr-formula-guide__main" data-testid="visual-lab-sinr-top-formula" data-formula-term="sinr">
      <span className="vlab-sinr-formula-guide__label">SINR</span>
      <span className="vlab-sinr-formula-guide__equation">
        <span data-formula-side="numerator">
          {formulaTerm('power', <>P̃<sub>b</sub><sup>DL</sup></>)} · {formulaTerm('channel', <>G<sup>LS</sup></>)} · {formulaTerm('beam', <>G<sup>T</sup>(θ)</>)} · {formulaTerm('receiver', <>G<sup>R</sup></>)}
        </span>
        <b data-formula-side="denominator">
          {formulaTerm('interference', <>I</>)} + {formulaTerm('noise', <>σ²</>)}
        </b>
      </span>
    </div>
    <div className="vlab-sinr-formula-guide__tabs" role="tablist" aria-label={zh ? 'SINR 公式項目' : 'SINR formula terms'}>
      {SINR_SECTION_OPTIONS.map((option) => <button
        key={option.id}
        id={`visual-lab-sinr-formula-tab-${option.id}`}
        type="button"
        role="tab"
        aria-selected={activeSection === option.id}
        aria-controls={`visual-lab-sinr-formula-panel-${option.id}`}
        aria-label={text(option.label, locale)}
        data-formula-term={option.id}
        className={['vlab-sinr-formula-term', option.semantic.className, activeSection === option.id ? 'is-active' : ''].filter(Boolean).join(' ')}
        style={activeSection === option.id ? {
          borderColor: option.semantic.color,
          background: `${option.semantic.color}1f`,
          boxShadow: `inset 0 -3px 0 ${option.semantic.color}`,
        } : undefined}
        onClick={() => onChange(option.id)}
      ><strong data-formula-symbol={option.semantic.dataSymbol} style={{ color: option.semantic.color }}>{option.symbol}</strong><span>{text(option.label, locale)}</span></button>)}
    </div>
    {SINR_SECTION_OPTIONS.map((option) => <div
      key={option.id}
      id={`visual-lab-sinr-formula-panel-${option.id}`}
      className={['vlab-sinr-formula-guide__detail', 'vlab-sinr-formula-term', option.semantic.className].join(' ')}
      role="tabpanel"
      aria-labelledby={`visual-lab-sinr-formula-tab-${option.id}`}
      data-testid={`visual-lab-sinr-formula-${option.id}`}
      data-formula-term={option.id}
      data-formula-symbol={option.semantic.dataSymbol}
      hidden={activeSection !== option.id}
    />)}
  </section>;
}

function ProgressiveInputCard({
  definition,
  inputs,
  locale,
  onChange,
  onResetInput,
  disabled,
  className,
}: {
  readonly definition: VisualLabInputDefinition;
  readonly inputs: VisualLabInputValues;
  readonly locale: VisualLabLocale;
  readonly onChange: VisualLabProgressiveControlDockProps['onInputChange'];
  readonly onResetInput?: VisualLabProgressiveControlDockProps['onResetInput'];
  readonly disabled: boolean;
  readonly className?: string;
}): ReactElement {
  const value = safeDisplayValue(definition, inputs[definition.key]);
  const id = inputId(definition.key);
  const defaultValue = safeDisplayValue(definition, DEFAULT_VISUAL_LAB_INPUTS[definition.key]);
  const label = definition.label[locale];
  const unit = visibleUnit(definition, locale);
  return (
    <article className={['vlab-progressive-input-card', className].filter(Boolean).join(' ')} data-input-group={definition.group} data-input-key={definition.key}>
      <div className="vlab-progressive-input-card__header">
        <label htmlFor={id}>
          <span>{label}</span>
          <code>{renderFormulaText(definition.symbol)}</code>
        </label>
        <output htmlFor={id}>{displayValueText(definition, inputs[definition.key], locale)}</output>
        <button
          className="vlab-input-card__reset"
          type="button"
          onClick={() => onResetInput?.(definition.key)}
          disabled={disabled || onResetInput === undefined}
          aria-label={`${text(COPY.reset, locale)} ${label}`}
          style={{ minHeight: 44, minWidth: 44 }}
        >↺</button>
      </div>
      <div className="vlab-progressive-input-card__editor">
        <input
          key={`range-${definition.key}-${value}`}
          className="vlab-input-card__range"
          id={id}
          type="range"
          min={definition.min}
          max={definition.max}
          step={definition.step}
          defaultValue={value}
          onPointerUp={(event) => commitDisplayValue(definition, event, onChange)}
          onKeyUp={(event) => commitRangeKey(definition, event, onChange)}
          disabled={disabled}
          aria-label={`${label} ${definition.symbol}`}
        />
        <input
          key={`number-${definition.key}-${value}`}
          className="vlab-input-card__number"
          type="number"
          min={definition.min}
          max={definition.max}
          step={definition.step}
          defaultValue={value}
          onBlur={(event) => commitDisplayValue(definition, event, onChange)}
          onKeyDown={blurOnEnter}
          disabled={disabled}
          aria-label={`${label} ${text(COPY.value, locale)}`}
          style={{ minHeight: 44 }}
        />
        <span className="vlab-input-card__unit">{unit}</span>
      </div>
      <div className="vlab-progressive-input-card__meta">
        <span>{displayValueText(definition, definition.fromDisplayValue(definition.min), locale)}–{displayValueText(definition, definition.fromDisplayValue(definition.max), locale)}</span>
        <span>{text(COPY.defaultValue, locale)} {displayValueText(definition, DEFAULT_VISUAL_LAB_INPUTS[definition.key], locale)}</span>
      </div>
      <details className="vlab-progressive-input-card__details">
        <summary>{text(COPY.details, locale)}</summary>
        <p>{visibleSchemaCopy(definition.description, locale)}</p>
        <p><strong>{text(COPY.causalPath, locale)}</strong> {renderFormulaText(visibleSchemaCopy(definition.causalPath, locale))}</p>
      </details>
    </article>
  );
}

function ControlChoiceRow<T extends string | number>({
  label,
  options,
  value,
  locale,
  onChange,
  disabled = false,
}: {
  readonly label: string;
  readonly options: readonly { readonly id: T; readonly label: LocalizedCopy }[];
  readonly value: T;
  readonly locale: VisualLabLocale;
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
}): ReactElement {
  return (
    <div className="vlab-progressive-choice-row">
      <span className="vlab-progressive-field-label">{label}</span>
      <div className="vlab-segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.id} type="button" className={value === option.id ? 'is-active' : ''} aria-pressed={value === option.id} onClick={() => onChange(option.id)} disabled={disabled} style={{ minHeight: 44 }}>
            {option.label[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
