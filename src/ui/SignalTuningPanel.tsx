import { useState, type CSSProperties, type ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
import { getFormulaFamilyLabel, getProfileLabel } from '../profiles';
import type { GainModel, PathLossComponent, Profile } from '../profiles/types';
import type { LinkBudgetTerms, SignalSourceState, SignalTruthStatus } from '../scene/types';
import {
  PATH_LOSS_COMPONENT_ORDER,
  createSignalTuningState,
  type SignalTuningState,
} from '../signalTuning';
import { formatBeamLabel, formatSatelliteLabel } from '../utils/formatSatelliteLabel';

interface SignalTuningPanelProps {
  baseProfile: Profile;
  tuning: SignalTuningState;
  hasOverrides: boolean;
  currentSinrDb: number;
  formulaBudget: LinkBudgetTerms | null;
  formulaSource: SignalSourceState;
  onTuningChange: (next: SignalTuningState) => void;
  onReset: () => void;
}

interface NumericControlProps {
  symbol: ReactNode;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description: string;
  effect: string;
  accentColor?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}

type TuningTabKey = 'power' | 'loss' | 'beam' | 'interference';

interface TuningTab {
  key: TuningTabKey;
  symbol: ReactNode;
  title: string;
  subtitle: string;
  formula: ReactNode;
  note: string;
}

interface TuningChangeSummary {
  symbol: ReactNode;
  before: string;
  after: string;
}

const TUNING_TABS: readonly TuningTab[] = [
  {
    key: 'power',
    symbol: <>P<sub>t</sub> / σ²</>,
    title: 'Power',
    subtitle: 'Signal strength, receiver override, and thermal noise.',
    formula: <>Numerator uses P<sub>t</sub> · G<sub>t,max</sub> · G<sup>R</sup>. Noise uses σ² = N<sub>0</sub>B.</>,
    note: 'Use this page when the link is power-limited or thermal noise dominates the denominator.',
  },
  {
    key: 'loss',
    symbol: <>H(L)</>,
    title: 'Loss',
    subtitle: 'Path gain and propagation loss terms.',
    formula: <>H ≈ 10<sup>-L/10</sup>, L = L<sub>fs</sub> + L<sub>g</sub> + L<sub>sc</sub> + L<sub>sf</sub></>,
    note: 'Use this page to study how carrier frequency and propagation assumptions move every received beam power.',
  },
  {
    key: 'beam',
    symbol: <>G<sup>T</sup>(θ)</>,
    title: 'Beam',
    subtitle: 'Antenna pattern, beam footprint, and scan loss.',
    formula: <>G<sup>T</sup> = G<sub>t,max</sub> + G(θ) - L<sub>scan</sub></>,
    note: 'Use this page when beam shape, steering reach, or edge-of-beam attenuation is the question.',
  },
  {
    key: 'interference',
    symbol: <>I<sup>a</sup>, I<sup>b</sup></>,
    title: 'Interf.',
    subtitle: 'Co-channel interference grouping.',
    formula: <>Denominator interference is I<sup>a</sup> + I<sup>b</sup>, grouped by frequency reuse K.</>,
    note: 'Use this page to make the scene harsher or cleaner by changing how many active beams reuse the same frequency.',
  },
];

const GAIN_MODEL_OPTIONS: ReadonlyArray<{ value: GainModel; label: string; detail: string }> = [
  { value: 'bessel-j1-j3', label: 'Bessel J1/J3', detail: 'Paper-shaped main lobe with stronger side-lobe roll-off.' },
  { value: 'bessel-j1', label: 'Bessel J1', detail: 'Simpler Bessel pattern; still attenuates off-axis users.' },
  { value: 'flat', label: 'Flat Top', detail: 'Disables off-axis pattern loss for sensitivity checks.' },
];

const FREQUENCY_REUSE_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

const PATH_LOSS_LABELS: Record<PathLossComponent, { symbol: ReactNode; label: string; detail: string }> = {
  fspl: {
    symbol: <>L<sub>fs</sub></>,
    label: 'Free-space loss',
    detail: 'Dominant range and frequency loss. Usually stays on for physical runs.',
  },
  atmospheric: {
    symbol: <>L<sub>g</sub></>,
    label: 'Gas absorption',
    detail: 'Adds elevation-dependent atmospheric absorption.',
  },
  scintillation: {
    symbol: <>L<sub>sc</sub></>,
    label: 'Scintillation',
    detail: 'Adds a small elevation-dependent fading margin.',
  },
  'shadow-fading': {
    symbol: <>L<sub>sf</sub></>,
    label: 'Shadow fading',
    detail: 'Adds the deterministic shadow-fading margin used by this simulator.',
  },
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 76,
  left: 12,
  zIndex: 10,
  width: 'min(520px, calc(100vw - 24px))',
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'calc(100vh - 88px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  background: UI_TOKENS.color.surface.tuningPanel,
  backdropFilter: 'blur(12px)',
  border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
  borderRadius: UI_TOKENS.radius.panel,
  boxShadow: UI_TOKENS.shadow.tuningPanel,
  padding: UI_TOKENS.space.rail,
  color: UI_TOKENS.color.text.panel,
  boxSizing: 'border-box',
  display: 'grid',
  gap: UI_TOKENS.space.panelLg,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: UI_TOKENS.color.border.subtle,
};

const controlStackStyle: CSSProperties = {
  display: 'grid',
  gap: UI_TOKENS.space.panelLg,
};

const symbolStyle: CSSProperties = {
  fontFamily: UI_TOKENS.type.family.math,
  fontSize: UI_TOKENS.type.size.readout,
  fontWeight: UI_TOKENS.type.weight.strong,
  color: UI_TOKENS.color.text.symbol,
  lineHeight: 1,
};

const formulaTextStyle: CSSProperties = {
  fontFamily: UI_TOKENS.type.family.math,
  fontSize: UI_TOKENS.type.size.formula,
  color: UI_TOKENS.color.text.math,
  lineHeight: 1.35,
};

function formatWithUnit(value: number, unit: string, digits = 1): string {
  return `${value.toFixed(digits)} ${unit}`;
}

function formatSinrDb(sinrDb: number): string {
  if (!Number.isFinite(sinrDb)) return '—';
  return `${sinrDb.toFixed(1)} dB`;
}

function formatDbm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBm`;
}

function formatDbi(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBi`;
}

function formatTruthStatus(status: SignalTruthStatus): string {
  switch (status) {
    case 'live':
      return 'live';
    case 'latched':
      return 'latched';
    case 'recent-ho':
      return 'recent HO';
    case 'derived':
      return 'derived';
    case 'none':
      return 'none';
  }
}

function summarizePathLossComponents(components: readonly PathLossComponent[]): string {
  return components.map(component => {
    switch (component) {
      case 'fspl':
        return 'Lfs';
      case 'atmospheric':
        return 'Lg';
      case 'scintillation':
        return 'Lsc';
      case 'shadow-fading':
        return 'Lsf';
    }
  }).join(', ') || 'none';
}

function samePathLossComponents(a: readonly PathLossComponent[], b: readonly PathLossComponent[]): boolean {
  return summarizePathLossComponents(a) === summarizePathLossComponents(b);
}

function buildChangeSummaries(
  base: SignalTuningState,
  tuning: SignalTuningState,
): TuningChangeSummary[] {
  const changes: TuningChangeSummary[] = [];
  const pushNumeric = (
    symbol: ReactNode,
    before: number,
    after: number,
    format: (value: number) => string,
  ) => {
    if (before === after) return;
    changes.push({ symbol, before: format(before), after: format(after) });
  };

  pushNumeric(<>P<sub>t</sub></>, base.maxTxPowerDbm, tuning.maxTxPowerDbm, value => `${value.toFixed(1)} dBm`);
  pushNumeric(<>G<sub>t,max</sub></>, base.maxGainDbi, tuning.maxGainDbi, value => `${value.toFixed(1)} dBi`);
  pushNumeric(<>G<sup>R</sup></>, base.ueAntennaMaxGainDbi, tuning.ueAntennaMaxGainDbi, value => `${value.toFixed(1)} dBi`);
  pushNumeric(<>B</>, base.bandwidthMHz, tuning.bandwidthMHz, value => `${value.toFixed(0)} MHz`);
  pushNumeric(<>N<sub>0</sub></>, base.noisePsdDbmHz, tuning.noisePsdDbmHz, value => `${value.toFixed(1)} dBm/Hz`);
  pushNumeric(<>f<sub>c</sub></>, base.frequencyGHz, tuning.frequencyGHz, value => `${value.toFixed(1)} GHz`);
  pushNumeric(<>θ<sub>3dB</sub></>, base.beamwidth3dBDeg, tuning.beamwidth3dBDeg, value => `${value.toFixed(1)}°`);
  pushNumeric(<>θ<sub>max</sub></>, base.maxSteeringAngleDeg, tuning.maxSteeringAngleDeg, value => `${value.toFixed(1)}°`);
  pushNumeric(
    <>L<sub>scan,max</sub></>,
    base.scanLossAtMaxSteeringDb,
    tuning.scanLossAtMaxSteeringDb,
    value => `${value.toFixed(1)} dB`,
  );
  pushNumeric(<>K</>, base.frequencyReuse, tuning.frequencyReuse, value => `${value.toFixed(0)}`);

  if (base.model !== tuning.model) {
    changes.push({ symbol: <>G(θ)</>, before: base.model, after: tuning.model });
  }

  if (!samePathLossComponents(base.pathLossComponents, tuning.pathLossComponents)) {
    changes.push({
      symbol: <>L</>,
      before: summarizePathLossComponents(base.pathLossComponents),
      after: summarizePathLossComponents(tuning.pathLossComponents),
    });
  }

  return changes;
}

function getActiveTabConfig(activeTab: TuningTabKey): TuningTab {
  return TUNING_TABS.find(tab => tab.key === activeTab) ?? TUNING_TABS[0];
}

function MathSymbol({
  children,
  size = 24,
}: {
  children: ReactNode;
  size?: number;
}) {
  return <span style={{ ...symbolStyle, fontSize: size }}>{children}</span>;
}

function FormulaContext({ tab }: { tab: TuningTab }) {
  return (
    <div style={{
      display: 'grid',
      gap: 10,
      padding: '15px 16px',
      borderRadius: UI_TOKENS.radius.lg,
      background: 'rgba(120, 228, 207, 0.07)',
      border: '1px solid rgba(120, 228, 207, 0.16)',
    }}>
      <div style={formulaTextStyle}>{tab.formula}</div>
      <div style={{ fontSize: UI_TOKENS.type.size.bodyLg, lineHeight: 1.55, color: 'rgba(238, 249, 255, 0.82)' }}>
        {tab.note}
      </div>
    </div>
  );
}

function LiveCheck({
  currentSinrDb,
  formulaBudget,
  formulaSource,
  receiverGainDbi,
  changes,
}: {
  currentSinrDb: number;
  formulaBudget: LinkBudgetTerms | null;
  formulaSource: SignalSourceState;
  receiverGainDbi: number;
  changes: TuningChangeSummary[];
}) {
  const hasFormulaSource = formulaSource.satId !== null && formulaSource.beamId !== null;
  const visibleChanges = changes.slice(0, 3);
  const remainingChanges = Math.max(changes.length - visibleChanges.length, 0);

  return (
    <div style={{
      display: 'grid',
      gap: 12,
      padding: '16px',
      borderRadius: UI_TOKENS.radius.lg,
      background: UI_TOKENS.color.surface.card,
      border: `1px solid ${UI_TOKENS.color.border.soft}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.tuning, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            Physical Serving Check
          </div>
          <div style={{ marginTop: 5, fontSize: UI_TOKENS.type.size.bodyLg, color: UI_TOKENS.color.text.label, lineHeight: 1.45 }}>
            {hasFormulaSource
              ? `${formatSatelliteLabel(formulaSource.satId)} ${formatBeamLabel(formulaSource.beamId)}`
              : 'No serving beam attached yet'}
          </div>
        </div>
        <div style={{
          color: Number.isFinite(currentSinrDb) ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.readout,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {formatSinrDb(currentSinrDb)}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span style={{
          padding: '4px 8px',
          borderRadius: UI_TOKENS.radius.pill,
          background: 'rgba(125, 226, 209, 0.12)',
          border: '1px solid rgba(125, 226, 209, 0.28)',
          color: '#bcfff5',
          fontSize: UI_TOKENS.type.size.caption,
          fontWeight: UI_TOKENS.type.weight.heavy,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          {formatTruthStatus(formulaSource.status)}
        </span>
        <span style={{
          padding: '4px 8px',
          borderRadius: UI_TOKENS.radius.pill,
          background: 'rgba(255, 214, 125, 0.1)',
          border: '1px solid rgba(255, 214, 125, 0.22)',
          color: UI_TOKENS.color.semantic.fixed,
          fontSize: UI_TOKENS.type.size.caption,
          fontWeight: UI_TOKENS.type.weight.heavy,
          letterSpacing: 0.5,
        }}>
          G<sup>R</sup> = {formatDbi(receiverGainDbi)} · Research Override
        </span>
      </div>

      <div style={{
        display: 'grid',
        gap: 8,
        padding: '12px 13px',
        borderRadius: 9,
        background: UI_TOKENS.color.surface.fieldSoft,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}>
        <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.tuningSoft, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Physical serving formula terms
        </div>
        {formulaBudget ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
            <BudgetTerm
              symbol={<>P<sub>t</sub>·H·G<sup>T</sup>·G<sup>R</sup></>}
              label="numerator"
              value={formulaBudget.signalDbm}
            />
            <FormulaValueTerm
              symbol={<>G<sup>R</sup></>}
              label="research override"
              value={formatDbi(formulaBudget.receiverGainDbi)}
            />
            <BudgetTerm
              symbol={<>I<sup>a</sup></>}
              label="same-sat interference"
              value={formulaBudget.intraInterferenceDbm}
            />
            <BudgetTerm
              symbol={<>I<sup>b</sup></>}
              label="other-sat interference"
              value={formulaBudget.interInterferenceDbm}
            />
            <BudgetTerm
              symbol={<>σ²</>}
              label="thermal noise"
              value={formulaBudget.noiseDbm}
            />
          </div>
        ) : (
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.muted }}>
            Waiting for an attached serving beam.
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gap: 8,
        paddingTop: 2,
      }}>
        {changes.length === 0 ? (
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: 'rgba(255,255,255,0.6)' }}>
            No runtime overrides. Current values match the selected profile baseline.
          </div>
        ) : (
          <>
            <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.tuningSoft, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Overrides feeding computeLinkBudget
            </div>
            {visibleChanges.map((change, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr',
                  gap: 10,
                  alignItems: 'center',
                  fontSize: UI_TOKENS.type.size.body,
                  color: '#edf8ff',
                }}
              >
                <MathSymbol size={22}>{change.symbol}</MathSymbol>
                <span>
                  {change.before}
                  <span style={{ color: UI_TOKENS.color.semantic.tuning }}> → </span>
                  {change.after}
                </span>
              </div>
            ))}
            {remainingChanges > 0 && (
              <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.muted }}>
                +{remainingChanges} more changed parameter{remainingChanges === 1 ? '' : 's'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FormulaValueTerm({
  symbol,
  label,
  value,
}: {
  symbol: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gap: 4,
      padding: '9px 10px',
      borderRadius: UI_TOKENS.radius.md,
      background: 'rgba(255, 214, 125, 0.055)',
      border: '1px solid rgba(255, 214, 125, 0.14)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
        <MathSymbol size={17}>{symbol}</MathSymbol>
        <span style={{ fontSize: UI_TOKENS.type.size.small, color: UI_TOKENS.color.text.muted, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: UI_TOKENS.type.size.metric, color: UI_TOKENS.color.semantic.fixed, fontWeight: UI_TOKENS.type.weight.heavy }}>
        {value}
      </div>
    </div>
  );
}

function BudgetTerm({
  symbol,
  label,
  value,
}: {
  symbol: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div style={{
      display: 'grid',
      gap: 4,
      padding: '9px 10px',
      borderRadius: UI_TOKENS.radius.md,
      background: 'rgba(255,255,255,0.045)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
        <MathSymbol size={17}>{symbol}</MathSymbol>
        <span style={{ fontSize: UI_TOKENS.type.size.small, color: UI_TOKENS.color.text.muted, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: UI_TOKENS.type.size.metric, color: UI_TOKENS.color.text.primary, fontWeight: UI_TOKENS.type.weight.heavy }}>
        {formatDbm(value)}
      </div>
    </div>
  );
}

function CoverageAudit() {
  return (
    <div style={{
      display: 'grid',
      gap: 8,
      padding: '14px 16px',
      borderRadius: UI_TOKENS.radius.lg,
      background: 'rgba(255, 214, 125, 0.065)',
      border: '1px solid rgba(255, 214, 125, 0.16)',
      color: UI_TOKENS.color.semantic.fixed,
      fontSize: UI_TOKENS.type.size.body,
      lineHeight: 1.5,
    }}>
      <div style={{ fontSize: UI_TOKENS.type.size.body, fontWeight: UI_TOKENS.type.weight.heavy, letterSpacing: 0.7, textTransform: 'uppercase' }}>
        Coverage audit
      </div>
      <div>
        Adjustable now: P<sub>t</sub>, H/L, G<sup>T</sup>, G<sup>R</sup>, I<sup>a</sup>/I<sup>b</sup>, σ², and K.
      </div>
      <div style={{ color: 'rgba(248, 234, 192, 0.74)' }}>
        G<sup>R</sup> is an approved Research Override / teaching control. The HOBS paper parameter table does not provide a receiver / UE antenna gain value.
      </div>
      <div style={{ color: 'rgba(248, 234, 192, 0.74)' }}>
        Still fixed in current model: TR 38.811 environment, NLoS clutter loss, and antenna efficiency.
      </div>
    </div>
  );
}

function NumericControl({
  symbol,
  label,
  unit,
  value,
  min,
  max,
  step,
  description,
  effect,
  accentColor = UI_TOKENS.color.semantic.tuning,
  formatValue,
  onChange,
}: NumericControlProps) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, marginBottom: 5 }}>
            <MathSymbol>{symbol}</MathSymbol>
            <span style={{ fontSize: UI_TOKENS.type.size.subheading, color: UI_TOKENS.color.text.controlLabel, lineHeight: 1.3, fontWeight: UI_TOKENS.type.weight.heavy }}>
              {label}
            </span>
          </div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            {description}
          </div>
        </div>
        <div style={{
          padding: '6px 9px',
          borderRadius: UI_TOKENS.radius.md,
          background: 'rgba(120, 228, 207, 0.1)',
          border: `1px solid ${accentColor}33`,
          color: UI_TOKENS.color.text.primary,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {formatValue ? formatValue(value) : formatWithUnit(value, unit)}
        </div>
      </div>
      <input
        className={UI_CLASSES.range}
        type="range"
        aria-label={`${label} (${unit})`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor }}
      />
      <div style={{ fontSize: UI_TOKENS.type.size.body, lineHeight: 1.5, color: UI_TOKENS.color.semantic.tuningSoft }}>
        {effect}
      </div>
    </div>
  );
}

function SelectControl({
  symbol,
  label,
  description,
  value,
  options,
  onChange,
}: {
  symbol: ReactNode;
  label: string;
  description: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; detail?: string }>;
  onChange: (value: string) => void;
}) {
  const activeOption = options.find(option => option.value === value);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 11 }}>
        <MathSymbol>{symbol}</MathSymbol>
        <span style={{ fontSize: UI_TOKENS.type.size.subheading, color: UI_TOKENS.color.text.controlLabel, fontWeight: UI_TOKENS.type.weight.heavy }}>{label}</span>
      </div>
      <div style={{ fontSize: UI_TOKENS.type.size.body, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
        {description}
      </div>
      <select
        className={UI_CLASSES.select}
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        style={{
          cursor: 'pointer',
          width: '100%',
          borderRadius: UI_TOKENS.radius.md,
          border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
          background: UI_TOKENS.color.surface.field,
          color: UI_TOKENS.color.text.primary,
          padding: '12px 13px',
          fontSize: UI_TOKENS.type.size.control,
        }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {activeOption?.detail && (
        <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.tuningSoft, lineHeight: 1.5 }}>
          {activeOption.detail}
        </div>
      )}
    </div>
  );
}

function ToggleChip({
  active,
  symbol,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  symbol: ReactNode;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`${UI_CLASSES.button} ${UI_CLASSES.toggle}`}
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        textAlign: 'left',
        padding: '13px 14px',
        borderRadius: UI_TOKENS.radius.md,
        border: active ? '1px solid rgba(120, 228, 207, 0.62)' : `1px solid ${UI_TOKENS.color.border.soft}`,
        background: active
          ? 'linear-gradient(180deg, rgba(31, 116, 100, 0.38), rgba(16, 67, 58, 0.2))'
          : 'rgba(255,255,255,0.03)',
        color: UI_TOKENS.color.text.primary,
        display: 'grid',
        gap: 7,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <MathSymbol size={21}>{symbol}</MathSymbol>
        <span style={{ fontSize: UI_TOKENS.type.size.bodyLg, color: active ? '#e9fffb' : '#c6d2dc', fontWeight: UI_TOKENS.type.weight.heavy }}>{label}</span>
      </div>
      <div style={{ fontSize: UI_TOKENS.type.size.body, lineHeight: 1.45, color: active ? '#b8f6ea' : 'rgba(255,255,255,0.56)' }}>
        {detail}
      </div>
    </button>
  );
}

export function SignalTuningPanel({
  baseProfile,
  tuning,
  hasOverrides,
  currentSinrDb,
  formulaBudget,
  formulaSource,
  onTuningChange,
  onReset,
}: SignalTuningPanelProps) {
  const [activeTab, setActiveTab] = useState<TuningTabKey>('power');
  const activeTabConfig = getActiveTabConfig(activeTab);
  const baseTuning = createSignalTuningState(baseProfile);
  const changeSummaries = buildChangeSummaries(baseTuning, tuning);
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
    <aside className="leo-signal-tuning-panel" style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.tuning, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            HOBS SINR Tuning
          </div>
          <div style={{ marginTop: 7, ...formulaTextStyle }}>
            γ = (P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup>) / (I<sup>a</sup> + I<sup>b</sup> + σ²)
          </div>
          <div style={{ marginTop: 7, fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.fixed, fontWeight: UI_TOKENS.type.weight.heavy }}>
            G<sup>R</sup> = {formatDbi(tuning.ueAntennaMaxGainDbi)} · Research Override
          </div>
          <div style={{ marginTop: 7, fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.secondary, lineHeight: 1.5 }}>
            {getProfileLabel(baseProfile)} · {getFormulaFamilyLabel(baseProfile.formulaFamily)}
          </div>
        </div>
        <button
          className={UI_CLASSES.button}
          type="button"
          onClick={onReset}
          disabled={!hasOverrides}
          style={{
            cursor: hasOverrides ? 'pointer' : 'default',
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            border: hasOverrides ? '1px solid rgba(125, 226, 209, 0.44)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: hasOverrides ? 'rgba(14, 55, 48, 0.78)' : 'rgba(255,255,255,0.04)',
            color: hasOverrides ? '#dffef7' : 'rgba(255,255,255,0.35)',
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.strong,
          }}
        >
          Reset
        </button>
      </div>

      <LiveCheck
        currentSinrDb={currentSinrDb}
        formulaBudget={formulaBudget}
        formulaSource={formulaSource}
        receiverGainDbi={tuning.ueAntennaMaxGainDbi}
        changes={changeSummaries}
      />

      <div
        role="tablist"
        aria-label="SINR parameter groups"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))',
          gap: 8,
        }}
      >
        {TUNING_TABS.map(tab => {
          const active = tab.key === activeTab;
          return (
            <button
              className={`${UI_CLASSES.button} ${UI_CLASSES.tab}`}
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              title={tab.subtitle}
              onClick={() => setActiveTab(tab.key)}
              style={{
                cursor: 'pointer',
                minHeight: 94,
                padding: '10px 9px',
                borderRadius: UI_TOKENS.radius.md,
                border: active ? '1px solid rgba(120, 228, 207, 0.7)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
                background: active ? 'rgba(120, 228, 207, 0.13)' : 'rgba(255,255,255,0.035)',
                color: active ? '#f8fffd' : 'rgba(255,255,255,0.66)',
                display: 'grid',
                gap: 5,
                alignContent: 'center',
              }}
            >
              <span style={{ ...formulaTextStyle, fontSize: 20, color: active ? '#f8fffd' : 'rgba(255,255,255,0.76)' }}>
                {tab.symbol}
              </span>
              <span style={{ fontSize: UI_TOKENS.type.size.body, fontWeight: UI_TOKENS.type.weight.heavy }}>{tab.title}</span>
            </button>
          );
        })}
      </div>

      <FormulaContext tab={activeTabConfig} />

      <div style={dividerStyle} />

      {activeTab === 'power' && (
        <div style={controlStackStyle}>
          <NumericControl
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
          <NumericControl
            symbol={<>G<sub>t,max</sub></>}
            label="Max transmit gain"
            unit="dBi"
            value={tuning.maxGainDbi}
            min={20}
            max={60}
            step={0.5}
            description="Peak antenna gain added before off-axis and scan losses."
            effect="Raising it shifts the numerator upward for all beams in the current profile."
            onChange={maxGainDbi => update({ maxGainDbi })}
          />
          <div style={{
            display: 'grid',
            gap: 12,
            padding: '14px 15px',
            borderRadius: UI_TOKENS.radius.lg,
            background: 'rgba(255, 214, 125, 0.065)',
            border: '1px solid rgba(255, 214, 125, 0.18)',
          }}>
            <div style={{
              display: 'inline-flex',
              width: 'fit-content',
              padding: '4px 8px',
              borderRadius: UI_TOKENS.radius.pill,
              background: 'rgba(255, 214, 125, 0.1)',
              border: '1px solid rgba(255, 214, 125, 0.24)',
              color: UI_TOKENS.color.semantic.fixed,
              fontSize: UI_TOKENS.type.size.caption,
              fontWeight: UI_TOKENS.type.weight.heavy,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}>
              Research Override / teaching control
            </div>
            <NumericControl
              symbol={<>G<sup>R</sup></>}
              label="Receiver / UE gain"
              unit="dBi"
              value={tuning.ueAntennaMaxGainDbi}
              min={-10}
              max={20}
              step={0.5}
              description="Bounded simulator control for teaching the numerator effect of receiver gain."
              effect="The HOBS paper parameter table does not provide a receiver / UE antenna gain value; this guardrail is not a HOBS paper range."
              accentColor={UI_TOKENS.color.semantic.fixed}
              formatValue={formatDbi}
              onChange={ueAntennaMaxGainDbi => update({ ueAntennaMaxGainDbi })}
            />
          </div>
          <NumericControl
            symbol={<>B</>}
            label="Channel bandwidth"
            unit="MHz"
            value={tuning.bandwidthMHz}
            min={5}
            max={400}
            step={5}
            description="Bandwidth used in σ² = N₀B."
            effect="Wider bandwidth increases thermal noise when transmit power is held fixed."
            formatValue={value => `${value.toFixed(0)} MHz`}
            onChange={bandwidthMHz => update({ bandwidthMHz })}
          />
          <NumericControl
            symbol={<>N<sub>0</sub></>}
            label="Noise PSD"
            unit="dBm/Hz"
            value={tuning.noisePsdDbmHz}
            min={-180}
            max={-160}
            step={0.5}
            description="Thermal noise density before multiplying by bandwidth."
            effect="A less negative value raises the noise floor and lowers weak-link SINR."
            onChange={noisePsdDbmHz => update({ noisePsdDbmHz })}
          />
        </div>
      )}

      {activeTab === 'loss' && (
        <div style={controlStackStyle}>
          <NumericControl
            symbol={<>f<sub>c</sub></>}
            label="Carrier frequency"
            unit="GHz"
            value={tuning.frequencyGHz}
            min={10}
            max={40}
            step={0.5}
            description="Frequency term used by free-space and composite path loss."
            effect="Higher frequency increases free-space loss in the current implementation."
            onChange={frequencyGHz => update({ frequencyGHz })}
          />
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 11 }}>
              <MathSymbol>L</MathSymbol>
              <span style={{ fontSize: UI_TOKENS.type.size.subheading, color: UI_TOKENS.color.text.controlLabel, fontWeight: UI_TOKENS.type.weight.heavy }}>
                Path-loss components
              </span>
            </div>
            <div style={{ fontSize: UI_TOKENS.type.size.body, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              Toggle individual terms in the link-budget loss sum.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 9 }}>
              {PATH_LOSS_COMPONENT_ORDER.map(component => {
                const config = PATH_LOSS_LABELS[component];
                return (
                  <ToggleChip
                    key={component}
                    active={tuning.pathLossComponents.includes(component)}
                    symbol={config.symbol}
                    label={config.label}
                    detail={config.detail}
                    onClick={() => togglePathLossComponent(component)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'beam' && (
        <div style={controlStackStyle}>
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
            formatValue={value => `${value.toFixed(1)}°`}
            onChange={beamwidth3dBDeg => update({ beamwidth3dBDeg })}
          />
          <SelectControl
            symbol={<>G(θ)</>}
            label="Beam gain model"
            description="Off-axis gain model applied after the UE-to-beam-center angle is known."
            value={tuning.model}
            options={GAIN_MODEL_OPTIONS}
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
            onChange={scanLossAtMaxSteeringDb => update({ scanLossAtMaxSteeringDb })}
          />
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
            onChange={frequencyReuse => update({ frequencyReuse: Number(frequencyReuse) })}
          />
          <div style={{
            padding: '12px 14px',
            borderRadius: UI_TOKENS.radius.lg,
            background: 'rgba(255, 214, 125, 0.07)',
            border: '1px solid rgba(255, 214, 125, 0.16)',
            color: '#f6e9b8',
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.5,
          }}>
            Lower K makes handover harder because more active beams interfere. Higher K makes the scene cleaner,
            but can overstate SINR if the reuse plan is too optimistic.
          </div>
        </div>
      )}

      <CoverageAudit />
    </aside>
  );
}
