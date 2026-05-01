import { useState, type CSSProperties, type ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
import { getFormulaFamilyLabel, getProfileLabel } from '../profiles';
import {
  DEFAULT_TR38811_CHANNEL,
  type GainModel,
  type PathLossComponent,
  type Profile,
} from '../profiles/types';
import type { LinkBudgetTerms, SignalSourceState, SignalTruthStatus } from '../scene/types';
import type { HandoverPolicyTuningState } from '../handoverPolicyTuning';
import {
  PATH_LOSS_COMPONENT_ORDER,
  createSignalTuningState,
  type SignalTuningState,
} from '../signalTuning';
import { HandoverPolicyControls } from './HandoverPolicyControls';
import { formatBeamLabel, formatSatelliteLabel } from '../utils/formatSatelliteLabel';

interface SignalTuningPanelProps {
  baseProfile: Profile;
  tuning: SignalTuningState;
  hasOverrides: boolean;
  currentSinrDb: number;
  formulaBudget: LinkBudgetTerms | null;
  formulaSource: SignalSourceState;
  isFormulaEvidenceStale?: boolean;
  initialActiveTab?: TuningTabKey;
  handoverDraft: HandoverPolicyTuningState;
  appliedHandoverPolicy: HandoverPolicyTuningState;
  hasHandoverDraftChanges: boolean;
  hasHandoverOverrides: boolean;
  onTuningChange: (next: SignalTuningState) => void;
  onReset: () => void;
  onHandoverDraftChange: (next: HandoverPolicyTuningState) => void;
  onApplyHandoverPolicy: () => void;
  onResetHandoverPolicy: () => void;
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
  disabled?: boolean;
  inactiveReason?: string;
  formatValue?: (value: number) => string;
  testId?: string;
  onChange: (value: number) => void;
}

type TuningTabKey = 'signal-power' | 'loss' | 'beam' | 'receiver-gain' | 'interference' | 'thermal-noise';
type TuningPageKey = 'sinr-formula' | 'handover-policy';
type FormulaEvidenceStatus = 'current' | 'stale' | 'waiting';

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

interface TuningPage {
  key: TuningPageKey;
  title: string;
  subtitle: string;
}

const TUNING_PAGES: readonly TuningPage[] = [
  {
    key: 'sinr-formula',
    title: 'SINR Formula',
    subtitle: 'Formula-owned link budget controls.',
  },
  {
    key: 'handover-policy',
    title: 'Handover Policy',
    subtitle: 'Qualification and timing controls.',
  },
];

const TUNING_TABS: readonly TuningTab[] = [
  {
    key: 'signal-power',
    symbol: <>P<sub>t</sub></>,
    title: 'Transmit Power',
    subtitle: 'Per-beam transmit power.',
    formula: <>P<sub>t</sub> starts the desired-signal numerator.</>,
    note: 'Use this page for per-beam transmit power before beam gain, path loss, and receiver gain are applied.',
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
    title: 'Transmit Gain',
    subtitle: 'Satellite beam gain and scan loss.',
    formula: <>G<sup>T</sup> = G<sub>t,max</sub> + G(θ) - L<sub>scan</sub></>,
    note: 'Use this page when beam shape, steering reach, or edge-of-beam attenuation is the question.',
  },
  {
    key: 'receiver-gain',
    symbol: <>G<sup>R</sup></>,
    title: 'Receiver Gain',
    subtitle: 'Receive-side numerator gain.',
    formula: <>G<sup>R</sup> is the receive-side gain in the desired-signal numerator.</>,
    note: 'Use this page to tune the terminal-side gain without mixing it into transmit power or satellite beam gain.',
  },
  {
    key: 'interference',
    symbol: <>I<sup>a</sup>, I<sup>b</sup></>,
    title: 'Interf.',
    subtitle: 'Co-channel interference grouping.',
    formula: <>Denominator interference is I<sup>a</sup> + I<sup>b</sup>, grouped by frequency reuse K.</>,
    note: 'Use this page to make the scene harsher or cleaner by changing how many active beams reuse the same frequency.',
  },
  {
    key: 'thermal-noise',
    symbol: <>σ²</>,
    title: 'Thermal Noise',
    subtitle: 'Denominator thermal-noise controls.',
    formula: <>σ² = N<sub>0</sub>B</>,
    note: 'Use this page for bandwidth and noise density terms that raise the denominator noise floor.',
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

const pagePanelStyle: CSSProperties = {
  display: 'grid',
  gap: UI_TOKENS.space.panelLg,
};

const hiddenPagePanelStyle: CSSProperties = {
  display: 'none',
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

function formatDb(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dB`;
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

function formatFormulaSourceProvenance(status: SignalTruthStatus): string {
  switch (status) {
    case 'live':
      return 'physical serving source';
    case 'latched':
      return 'latched selected source';
    case 'recent-ho':
      return 'recent-HO selected source';
    case 'derived':
      return 'derived selected source';
    case 'none':
      return 'no selected source';
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
  pushNumeric(<>L<sub>g,z</sub></>, base.atmosphericZenithLossDb, tuning.atmosphericZenithLossDb, value => `${value.toFixed(2)} dB`);
  pushNumeric(<>L<sub>sc,scale</sub></>, base.scintillationScaleDb, tuning.scintillationScaleDb, value => `${value.toFixed(2)} dB`);
  pushNumeric(<>L<sub>sf,margin</sub></>, base.shadowFadingMarginDb, tuning.shadowFadingMarginDb, value => `${value.toFixed(1)} dB`);
  pushNumeric(<>L<sub>cl,NLoS</sub></>, base.tr38811NlosClutterLossDb, tuning.tr38811NlosClutterLossDb, value => `${value.toFixed(1)} dB`);
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

function FormulaMapTile({
  testId,
  side,
  term,
  symbol,
  title,
  detail,
  badge,
  tone = 'standard',
}: {
  testId: string;
  side: 'numerator' | 'denominator';
  term: string;
  symbol: ReactNode;
  title: string;
  detail: ReactNode;
  badge?: ReactNode;
  tone?: 'standard' | 'research' | 'denominator';
}) {
  const isResearch = tone === 'research';
  const isDenominator = side === 'denominator';
  const accent = isResearch
    ? UI_TOKENS.color.semantic.fixed
    : isDenominator
      ? '#a9c9ff'
      : UI_TOKENS.color.semantic.tuningSoft;

  return (
    <div
      data-testid={testId}
      data-formula-side={side}
      data-term-owner={term}
      style={{
        display: 'grid',
        gap: 8,
        minHeight: 138,
        padding: '12px 13px',
        borderRadius: UI_TOKENS.radius.md,
        background: isResearch
          ? 'rgba(255, 214, 125, 0.062)'
          : isDenominator
            ? 'rgba(93, 166, 255, 0.058)'
            : 'rgba(120, 228, 207, 0.052)',
        border: isResearch
          ? '1px solid rgba(255, 214, 125, 0.18)'
          : isDenominator
            ? '1px solid rgba(93, 166, 255, 0.16)'
            : '1px solid rgba(120, 228, 207, 0.16)',
        alignContent: 'start',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <MathSymbol size={23}>{symbol}</MathSymbol>
        {badge && (
          <span style={{
            padding: '3px 7px',
            borderRadius: UI_TOKENS.radius.pill,
            background: isResearch ? 'rgba(255, 214, 125, 0.1)' : 'rgba(255,255,255,0.045)',
            border: isResearch ? '1px solid rgba(255, 214, 125, 0.22)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
            color: accent,
            fontSize: UI_TOKENS.type.size.tiny,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{
        fontSize: UI_TOKENS.type.size.bodyLg,
        color: UI_TOKENS.color.text.controlLabel,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.3,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: UI_TOKENS.type.size.body,
        color: isResearch ? 'rgba(248, 234, 192, 0.78)' : 'rgba(255,255,255,0.64)',
        lineHeight: 1.45,
      }}>
        {detail}
      </div>
    </div>
  );
}

function SinrFormulaMap({ receiverGainDbi }: { receiverGainDbi: number }) {
  return (
    <section
      data-testid="sinr-formula-map"
      aria-label="SINR formula ownership map"
      style={{
        display: 'grid',
        gap: 14,
        padding: '15px 16px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'rgba(255,255,255,0.035)',
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{
          fontSize: UI_TOKENS.type.size.body,
          color: UI_TOKENS.color.semantic.tuning,
          fontWeight: UI_TOKENS.type.weight.heavy,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}>
          Formula map
        </div>
        <div style={{
          ...formulaTextStyle,
          fontSize: UI_TOKENS.type.size.subheading,
          color: UI_TOKENS.color.text.math,
        }}>
          P<sub>t</sub> -&gt; H/L -&gt; G<sup>T</sup> -&gt; G<sup>R</sup>
        </div>
      </div>

      <div
        data-testid="formula-map-numerator"
        data-formula-side="numerator"
        style={{
          display: 'grid',
          gap: 10,
          padding: '12px',
          borderRadius: UI_TOKENS.radius.lg,
          background: 'rgba(120, 228, 207, 0.035)',
          border: '1px solid rgba(120, 228, 207, 0.12)',
        }}
      >
        <div style={{
          fontSize: UI_TOKENS.type.size.bodyLg,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          Numerator / Signal Path
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 9,
        }}>
          <FormulaMapTile
            testId="formula-map-pt"
            side="numerator"
            term="transmit-power"
            symbol={<>P<sub>t</sub></>}
            title="Transmit power"
            detail="Per-beam power starts the desired signal path."
          />
          <FormulaMapTile
            testId="formula-map-hl"
            side="numerator"
            term="path-gain-loss"
            symbol={<>H/L</>}
            title="Path gain / loss"
            detail="Carrier frequency and path-loss terms shape H from L."
          />
          <FormulaMapTile
            testId="formula-map-gt"
            side="numerator"
            term="transmit-gain"
            symbol={<>G<sup>T</sup></>}
            title="Satellite beam gain"
            detail="Transmit antenna pattern, steering, and scan loss remain the G^T factor."
          />
          <FormulaMapTile
            testId="formula-map-gr"
            side="numerator"
            term="receiver-gain"
            symbol={<>G<sup>R</sup></>}
            title="Receiver gain"
            badge="Sensitivity"
            tone="research"
            detail={
              <>
                {formatDbi(receiverGainDbi)} receive-side gain. Independent numerator term; not transmit power or satellite beam gain.
              </>
            }
          />
        </div>
      </div>

      <div
        data-testid="formula-map-denominator"
        data-formula-side="denominator"
        style={{
          display: 'grid',
          gap: 10,
          padding: '12px',
          borderRadius: UI_TOKENS.radius.lg,
          background: 'rgba(93, 166, 255, 0.035)',
          border: '1px solid rgba(93, 166, 255, 0.12)',
        }}
      >
        <div style={{
          fontSize: UI_TOKENS.type.size.bodyLg,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          Denominator / Impairments
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 9,
        }}>
          <FormulaMapTile
            testId="formula-map-interference"
            side="denominator"
            term="interference"
            tone="denominator"
            symbol={<>I<sup>a</sup> + I<sup>b</sup></>}
            title="Co-channel interference"
            detail="Same-satellite and other-satellite interference belong to the denominator."
          />
          <FormulaMapTile
            testId="formula-map-sigma"
            side="denominator"
            term="thermal-noise"
            tone="denominator"
            symbol={<>σ²</>}
            title="Thermal noise floor"
            detail={<>B and N<sub>0</sub> define the denominator noise floor.</>}
          />
        </div>
      </div>
    </section>
  );
}

function FormulaSideControlSection({
  title,
  subtitle,
  formula,
  side,
  children,
  testId,
}: {
  title: string;
  subtitle: ReactNode;
  formula: ReactNode;
  side: 'numerator' | 'denominator';
  children: ReactNode;
  testId: string;
}) {
  const isNumerator = side === 'numerator';

  return (
    <section
      data-testid={testId}
      data-formula-side={side}
      style={{
        display: 'grid',
        gap: 14,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: isNumerator ? 'rgba(120, 228, 207, 0.05)' : 'rgba(93, 166, 255, 0.055)',
        border: isNumerator ? '1px solid rgba(120, 228, 207, 0.16)' : '1px solid rgba(93, 166, 255, 0.16)',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{
          fontSize: UI_TOKENS.type.size.bodyLg,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          {title}
        </div>
        <div style={formulaTextStyle}>{formula}</div>
        <div style={{
          fontSize: UI_TOKENS.type.size.body,
          color: 'rgba(255,255,255,0.66)',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </div>
      </div>
      {children}
    </section>
  );
}

function NoiseFloorReadout({
  formulaBudget,
  isFormulaEvidenceStale,
}: {
  formulaBudget: LinkBudgetTerms | null;
  isFormulaEvidenceStale: boolean;
}) {
  const hasCurrentNoiseFloor = formulaBudget !== null && !isFormulaEvidenceStale;

  return (
    <div
      data-testid="thermal-noise-floor-readout"
      data-readonly="true"
      data-formula-evidence-status={isFormulaEvidenceStale ? 'stale' : hasCurrentNoiseFloor ? 'current' : 'waiting'}
      style={{
        display: 'grid',
        gap: 8,
        padding: '12px 13px',
        borderRadius: UI_TOKENS.radius.md,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
          <MathSymbol size={22}>σ²</MathSymbol>
          <span style={{
            fontSize: UI_TOKENS.type.size.subheading,
            color: UI_TOKENS.color.text.controlLabel,
            fontWeight: UI_TOKENS.type.weight.heavy,
          }}>
            Noise floor
          </span>
        </div>
        <div style={{
          padding: '5px 8px',
          borderRadius: UI_TOKENS.radius.md,
          background: 'rgba(93, 166, 255, 0.1)',
          border: '1px solid rgba(93, 166, 255, 0.2)',
          color: hasCurrentNoiseFloor ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {hasCurrentNoiseFloor ? formatDbm(formulaBudget.noiseDbm) : 'waiting'}
        </div>
      </div>
      <div style={{ fontSize: UI_TOKENS.type.size.body, lineHeight: 1.5, color: UI_TOKENS.color.semantic.tuningSoft }}>
        {isFormulaEvidenceStale
          ? 'Read-only σ² / noise floor evidence is stale after edit; waiting for the next recomputed frame.'
          : hasCurrentNoiseFloor
            ? 'Read-only computed σ² / noise floor from the current formula evidence.'
            : 'Read-only σ² / noise floor appears after a selected formula frame is available.'}
      </div>
    </div>
  );
}

function LiveCheck({
  currentSinrDb,
  formulaBudget,
  formulaSource,
  isFormulaEvidenceStale = false,
  receiverGainDbi,
  changes,
}: {
  currentSinrDb: number;
  formulaBudget: LinkBudgetTerms | null;
  formulaSource: SignalSourceState;
  isFormulaEvidenceStale?: boolean;
  receiverGainDbi: number;
  changes: TuningChangeSummary[];
}) {
  const hasFormulaSource = formulaSource.satId !== null && formulaSource.beamId !== null;
  const formulaEvidenceStatus: FormulaEvidenceStatus = isFormulaEvidenceStale
    ? 'stale'
    : formulaBudget !== null && hasFormulaSource
      ? 'current'
      : 'waiting';
  const formulaResultDb = formulaSource.sinrDb ?? currentSinrDb;
  const hasCurrentFormulaResult = formulaEvidenceStatus === 'current' && Number.isFinite(formulaResultDb);
  const hasStaleFormulaResult = formulaEvidenceStatus === 'stale' && Number.isFinite(formulaResultDb);
  const formulaResultLabel = hasCurrentFormulaResult
    ? formatSinrDb(formulaResultDb)
    : hasStaleFormulaResult
      ? `${formatSinrDb(formulaResultDb)} stale`
      : formulaEvidenceStatus;
  const sourceProvenance = formulaEvidenceStatus === 'current'
    ? formatFormulaSourceProvenance(formulaSource.status)
    : formulaEvidenceStatus === 'stale'
      ? 'stale after edit; waiting for next recomputed frame'
      : 'waiting for selected formula source';
  const visibleChanges = changes.slice(0, 3);
  const remainingChanges = Math.max(changes.length - visibleChanges.length, 0);

  return (
    <div
      data-testid="formula-verification-card"
      data-formula-evidence-status={formulaEvidenceStatus}
      style={{
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
            Formula Verification
          </div>
          <div style={{ marginTop: 5, fontSize: UI_TOKENS.type.size.bodyLg, color: UI_TOKENS.color.text.label, lineHeight: 1.45 }}>
            {hasFormulaSource
              ? `${formatSatelliteLabel(formulaSource.satId)} ${formatBeamLabel(formulaSource.beamId)}`
              : 'No selected formula source yet'}
          </div>
          <div style={{ marginTop: 5, fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.faint, lineHeight: 1.4 }}>
            {sourceProvenance}
          </div>
        </div>
        <div
          data-testid="formula-result-readout"
          data-ownership="formula-verification"
          data-visual-weight="secondary"
          style={{
            display: 'grid',
            gap: 4,
            justifyItems: 'end',
            minWidth: 118,
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(120, 228, 207, 0.07)',
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
            color: hasCurrentFormulaResult ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.faint,
          }}
        >
          <div style={{
            fontSize: UI_TOKENS.type.size.tiny,
            color: UI_TOKENS.color.semantic.tuningSoft,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            textAlign: 'right',
          }}>
            selected source formula result
          </div>
          <div style={{
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            whiteSpace: 'nowrap',
          }}>
            {formulaResultLabel}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span style={{
          padding: '4px 8px',
          borderRadius: UI_TOKENS.radius.pill,
          background: formulaEvidenceStatus === 'current' ? 'rgba(125, 226, 209, 0.12)' : 'rgba(255, 214, 125, 0.1)',
          border: formulaEvidenceStatus === 'current' ? '1px solid rgba(125, 226, 209, 0.28)' : '1px solid rgba(255, 214, 125, 0.28)',
          color: formulaEvidenceStatus === 'current' ? '#bcfff5' : UI_TOKENS.color.semantic.fixed,
          fontSize: UI_TOKENS.type.size.caption,
          fontWeight: UI_TOKENS.type.weight.heavy,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          {formulaEvidenceStatus === 'current' ? formatTruthStatus(formulaSource.status) : formulaEvidenceStatus}
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
          G<sup>R</sup> = {formatDbi(receiverGainDbi)} · receiver gain
        </span>
      </div>

      <div
        data-testid="formula-term-evidence"
        data-ownership="formula-verification"
        data-visual-weight="primary"
        data-formula-evidence-status={formulaEvidenceStatus}
        style={{
        display: 'grid',
        gap: 8,
        padding: '12px 13px',
        borderRadius: 9,
        background: UI_TOKENS.color.surface.fieldSoft,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}>
        <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.tuningSoft, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Formula term evidence
        </div>
        <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.muted, lineHeight: 1.45 }}>
          {formulaEvidenceStatus === 'current'
            ? 'Current computeLinkBudget term values for the selected formula source.'
            : formulaEvidenceStatus === 'stale'
              ? 'Formula evidence is stale after a runtime edit; last-known values are labeled stale until the next recomputed frame.'
              : 'Waiting for a selected formula source; placeholders keep the evidence structure stable.'}
        </div>
        <div
          data-testid="formula-term-grid"
          data-formula-evidence-status={formulaEvidenceStatus}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}
        >
          <BudgetTerm
            dataTerm="signalDbm"
            status={formulaEvidenceStatus}
            symbol={<>P<sub>t</sub>·H·G<sup>T</sup>·G<sup>R</sup></>}
            label="numerator / signalDbm"
            value={formulaBudget?.signalDbm ?? null}
          />
          <BudgetTerm
            dataTerm="effectiveTxPower"
            status={formulaEvidenceStatus}
            symbol={<>P<sub>t</sub></>}
            label="effective transmit power"
            value={formulaBudget?.txPowerDbm ?? null}
          />
          <BudgetTerm
            dataTerm="transmitGain"
            status={formulaEvidenceStatus}
            symbol={<>G<sup>T</sup></>}
            label="transmit gain pattern"
            value={formulaBudget?.beamGainDb ?? null}
            unit="dB"
          />
          <BudgetTerm
            dataTerm="receiverGain"
            status={formulaEvidenceStatus}
            symbol={<>G<sup>R</sup></>}
            label="receiver gain"
            value={formulaBudget?.receiverGainDbi ?? null}
            unit="dBi"
            tone="fixed"
          />
          <BudgetTerm
            dataTerm="pathLoss"
            status={formulaEvidenceStatus}
            symbol={<>L</>}
            label="path loss"
            value={formulaBudget?.pathLossDb ?? null}
            unit="dB"
          />
          <BudgetTerm
            dataTerm="scanLoss"
            status={formulaEvidenceStatus}
            symbol={<>L<sub>scan</sub></>}
            label="scan loss"
            value={formulaBudget?.steeringLossDb ?? null}
            unit="dB"
          />
          <BudgetTerm
            dataTerm="intraInterference"
            status={formulaEvidenceStatus}
            symbol={<>I<sup>a</sup></>}
            label="intra interference"
            value={formulaBudget?.intraInterferenceDbm ?? null}
          />
          <BudgetTerm
            dataTerm="interInterference"
            status={formulaEvidenceStatus}
            symbol={<>I<sup>b</sup></>}
            label="inter interference"
            value={formulaBudget?.interInterferenceDbm ?? null}
          />
          <BudgetTerm
            dataTerm="noiseDbm"
            status={formulaEvidenceStatus}
            symbol={<>σ²</>}
            label="noise σ² / noiseDbm"
            value={formulaBudget?.noiseDbm ?? null}
          />
          <BudgetTerm
            dataTerm="denominator"
            status={formulaEvidenceStatus}
            symbol={<>I<sup>a</sup>+I<sup>b</sup>+σ²</>}
            label="denominator"
            value={formulaBudget?.denominatorDbm ?? null}
          />
        </div>
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

type BudgetTermUnit = 'dBm' | 'dB' | 'dBi';

function BudgetTerm({
  dataTerm,
  status,
  symbol,
  label,
  value,
  unit = 'dBm',
  tone = 'default',
}: {
  dataTerm?: string;
  status: FormulaEvidenceStatus;
  symbol: ReactNode;
  label: string;
  value: number | null;
  unit?: BudgetTermUnit;
  tone?: 'default' | 'fixed';
}) {
  const hasValue = value !== null && Number.isFinite(value);
  const formattedValue = hasValue
    ? unit === 'dBi'
      ? formatDbi(value)
      : unit === 'dB'
        ? formatDb(value)
        : formatDbm(value)
    : null;
  const valueLabel = status === 'current'
    ? formattedValue ?? '—'
    : status === 'stale'
      ? formattedValue ? `${formattedValue} stale` : 'stale waiting'
      : 'waiting';
  const stateLabel = status === 'current'
    ? 'current'
    : status === 'stale'
      ? 'last-known stale'
      : 'waiting';

  return (
    <div data-term={dataTerm} data-formula-evidence-status={status} style={{
      display: 'grid',
      gap: 4,
      padding: '9px 10px',
      borderRadius: UI_TOKENS.radius.md,
      background: tone === 'fixed' ? 'rgba(255, 214, 125, 0.055)' : 'rgba(255,255,255,0.045)',
      border: tone === 'fixed' ? '1px solid rgba(255, 214, 125, 0.14)' : '1px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
        <MathSymbol size={17}>{symbol}</MathSymbol>
        <span style={{ fontSize: UI_TOKENS.type.size.small, color: UI_TOKENS.color.text.muted, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: UI_TOKENS.type.size.metric,
        color: status === 'current'
          ? tone === 'fixed' ? UI_TOKENS.color.semantic.fixed : UI_TOKENS.color.text.primary
          : UI_TOKENS.color.text.faint,
        fontWeight: UI_TOKENS.type.weight.heavy,
      }}>
        {valueLabel}
      </div>
      <div style={{
        width: 'fit-content',
        padding: '2px 6px',
        borderRadius: UI_TOKENS.radius.pill,
        background: status === 'current' ? 'rgba(125, 226, 209, 0.1)' : 'rgba(255, 214, 125, 0.08)',
        border: status === 'current' ? '1px solid rgba(125, 226, 209, 0.2)' : '1px solid rgba(255, 214, 125, 0.16)',
        color: status === 'current' ? UI_TOKENS.color.semantic.tuningSoft : UI_TOKENS.color.semantic.fixed,
        fontSize: UI_TOKENS.type.size.tiny,
        fontWeight: UI_TOKENS.type.weight.heavy,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}>
        {stateLabel}
      </div>
    </div>
  );
}

function CoverageAssumptionsDisclosure() {
  return (
    <details data-testid="sinr-coverage-assumptions-disclosure" data-demotion="collapsed" data-readonly="true" data-prominence="low" style={{
      display: 'grid',
      gap: 8,
      padding: '9px 11px',
      borderRadius: UI_TOKENS.radius.lg,
      background: 'rgba(255, 255, 255, 0.026)',
      border: '1px solid rgba(255, 214, 125, 0.11)',
      color: 'rgba(248, 234, 192, 0.78)',
      fontSize: UI_TOKENS.type.size.body,
      lineHeight: 1.5,
    }}>
      <summary data-testid="sinr-coverage-assumptions-summary" style={{
        cursor: 'pointer',
        color: UI_TOKENS.color.semantic.fixed,
        fontSize: UI_TOKENS.type.size.body,
        fontWeight: UI_TOKENS.type.weight.heavy,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}>
        Coverage / assumptions
      </summary>
      <div style={{ display: 'grid', gap: 8, paddingTop: 8 }}>
        <div>
          Adjustable formula groups: P<sub>t</sub>, H/L, path-loss sensitivity controls, G<sup>T</sup>, G<sup>R</sup>, I<sup>a</sup>/I<sup>b</sup>, σ², and K.
        </div>
        <div>
          G<sup>R</sup> is controlled separately as receiver gain in the desired-signal numerator.
        </div>
        <div>
          Path-loss constants in the Loss tab are sensitivity controls. Read-only assumptions: TR 38.811 environment stays read-only, and antenna efficiency remains future-only.
        </div>
      </div>
    </details>
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
  disabled = false,
  inactiveReason,
  formatValue,
  testId,
  onChange,
}: NumericControlProps) {
  return (
    <div
      data-testid={testId}
      data-control-active={disabled ? 'false' : 'true'}
      style={{ display: 'grid', gap: 12, opacity: disabled ? 0.58 : 1 }}
    >
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
        disabled={disabled}
        aria-disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <div style={{ fontSize: UI_TOKENS.type.size.body, lineHeight: 1.5, color: UI_TOKENS.color.semantic.tuningSoft }}>
        {disabled && inactiveReason ? inactiveReason : effect}
      </div>
    </div>
  );
}

function LossControlSection({
  title,
  subtitle,
  children,
  testId,
  tone = 'formula',
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  testId: string;
  tone?: 'formula' | 'research';
}) {
  const isResearch = tone === 'research';

  return (
    <section
      data-testid={testId}
      style={{
        display: 'grid',
        gap: 14,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: isResearch ? 'rgba(255, 214, 125, 0.055)' : 'rgba(120, 228, 207, 0.045)',
        border: isResearch ? '1px solid rgba(255, 214, 125, 0.16)' : '1px solid rgba(120, 228, 207, 0.12)',
      }}
    >
      <div style={{ display: 'grid', gap: 5 }}>
        <div style={{
          fontSize: UI_TOKENS.type.size.bodyLg,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: UI_TOKENS.type.size.body,
          color: isResearch ? 'rgba(248, 234, 192, 0.78)' : 'rgba(255,255,255,0.65)',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </div>
      </div>
      {children}
    </section>
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

function TuningPageTabs({
  activePage,
  onChange,
}: {
  activePage: TuningPageKey;
  onChange: (page: TuningPageKey) => void;
}) {
  return (
    <div
      data-testid="tuning-page-tabs"
      role="tablist"
      aria-label="Tuning pages"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
        padding: 4,
        borderRadius: UI_TOKENS.radius.lg,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      {TUNING_PAGES.map(page => {
        const active = page.key === activePage;
        return (
          <button
            id={`tuning-page-tab-${page.key}`}
            className={`${UI_CLASSES.button} ${UI_CLASSES.tab}`}
            key={page.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`tuning-page-panel-${page.key}`}
            onClick={() => onChange(page.key)}
            style={{
              cursor: 'pointer',
              minHeight: 68,
              padding: '10px 12px',
              borderRadius: UI_TOKENS.radius.md,
              border: active ? '1px solid rgba(120, 228, 207, 0.62)' : '1px solid transparent',
              background: active ? 'rgba(120, 228, 207, 0.12)' : 'transparent',
              color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
              display: 'grid',
              gap: 5,
              textAlign: 'left',
            }}
          >
            <span style={{
              fontSize: UI_TOKENS.type.size.bodyLg,
              fontWeight: UI_TOKENS.type.weight.heavy,
            }}>
              {page.title}
            </span>
            <span style={{
              fontSize: UI_TOKENS.type.size.body,
              color: active ? UI_TOKENS.color.semantic.tuningSoft : UI_TOKENS.color.text.muted,
              lineHeight: 1.35,
            }}>
              {page.subtitle}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SignalTuningPanel({
  baseProfile,
  tuning,
  hasOverrides,
  currentSinrDb,
  formulaBudget,
  formulaSource,
  isFormulaEvidenceStale = false,
  initialActiveTab = 'signal-power',
  handoverDraft,
  appliedHandoverPolicy,
  hasHandoverDraftChanges,
  hasHandoverOverrides,
  onTuningChange,
  onReset,
  onHandoverDraftChange,
  onApplyHandoverPolicy,
  onResetHandoverPolicy,
}: SignalTuningPanelProps) {
  const [activePage, setActivePage] = useState<TuningPageKey>('sinr-formula');
  const [activeTab, setActiveTab] = useState<TuningTabKey>(initialActiveTab);
  const activeTabConfig = getActiveTabConfig(activeTab);
  const baseTuning = createSignalTuningState(baseProfile);
  const changeSummaries = buildChangeSummaries(baseTuning, tuning);
  const isTr38811Formula = baseProfile.formulaFamily === 'hobs-tr38811';
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
    <aside className="leo-signal-tuning-panel" style={panelStyle}>
      <TuningPageTabs activePage={activePage} onChange={setActivePage} />

      <section
        id="tuning-page-panel-sinr-formula"
        data-testid="sinr-formula-page"
        role="tabpanel"
        aria-labelledby="tuning-page-tab-sinr-formula"
        hidden={activePage !== 'sinr-formula'}
        style={activePage === 'sinr-formula' ? pagePanelStyle : hiddenPagePanelStyle}
      >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.tuning, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            SINR Formula Tuning
          </div>
          <div style={{ marginTop: 7, ...formulaTextStyle }}>
            γ = (P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup>) / (I<sup>a</sup> + I<sup>b</sup> + σ²)
          </div>
          <div style={{ marginTop: 7, fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.fixed, fontWeight: UI_TOKENS.type.weight.heavy }}>
            G<sup>R</sup> = {formatDbi(tuning.ueAntennaMaxGainDbi)} · receiver gain
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
        isFormulaEvidenceStale={isFormulaEvidenceStale}
        receiverGainDbi={tuning.ueAntennaMaxGainDbi}
        changes={changeSummaries}
      />

      <SinrFormulaMap receiverGainDbi={tuning.ueAntennaMaxGainDbi} />

      <div
        data-testid="sinr-formula-tabs"
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
          >
            <NoiseFloorReadout
              formulaBudget={formulaBudget}
              isFormulaEvidenceStale={isFormulaEvidenceStale}
            />
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
              onChange={noisePsdDbmHz => update({ noisePsdDbmHz })}
            />
          </FormulaSideControlSection>
        </div>
      )}

      {activeTab === 'loss' && (
        <div style={controlStackStyle}>
          <LossControlSection
            testId="loss-formula-controls"
            title="Formula controls"
            subtitle="Paper-facing controls for the loss expression already represented in the live HOBS link budget."
          >
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
          </LossControlSection>

          <LossControlSection
            testId="loss-research-override"
            title="Research Override"
            tone="research"
            subtitle="Teaching / sensitivity controls for simulator constants. These are not HOBS paper-backed parameter ranges."
          >
            <NumericControl
              symbol={<>L<sub>g,z</sub></>}
              label="Atmospheric zenith loss"
              unit="dB"
              value={tuning.atmosphericZenithLossDb}
              min={0}
              max={1}
              step={0.01}
              description="Research Override for the current gas-loss zenith constant before elevation scaling."
              effect="Increasing it raises pathLossDb through Lg when the atmospheric gas term is enabled."
              disabled={!atmosphericEnabled}
              inactiveReason="Inactive while L_g is off; this numeric override is not contributing."
              accentColor={UI_TOKENS.color.semantic.fixed}
              formatValue={value => `${value.toFixed(2)} dB`}
              onChange={atmosphericZenithLossDb => update({ atmosphericZenithLossDb })}
            />
            <NumericControl
              symbol={<>L<sub>sc,scale</sub></>}
              label="Scintillation scale"
              unit="dB"
              value={tuning.scintillationScaleDb}
              min={0}
              max={1}
              step={0.01}
              description="Research Override for the deterministic scintillation scale used by this teaching model."
              effect="Increasing it raises pathLossDb through Lsc when the scintillation term is enabled."
              disabled={!scintillationEnabled}
              inactiveReason="Inactive while L_sc is off; this numeric override is not contributing."
              accentColor={UI_TOKENS.color.semantic.fixed}
              formatValue={value => `${value.toFixed(2)} dB`}
              onChange={scintillationScaleDb => update({ scintillationScaleDb })}
            />
            <NumericControl
              symbol={<>L<sub>sf,margin</sub></>}
              label="Shadow fading margin"
              unit="dB"
              value={tuning.shadowFadingMarginDb}
              min={0}
              max={10}
              step={0.1}
              description="Research Override for the deterministic shadow-fading margin. It is not a random draw."
              effect="Increasing it raises pathLossDb through Lsf when the shadow-fading term is enabled."
              disabled={!shadowFadingEnabled}
              inactiveReason="Inactive while L_sf is off; this numeric override is not contributing."
              accentColor={UI_TOKENS.color.semantic.fixed}
              onChange={shadowFadingMarginDb => update({ shadowFadingMarginDb })}
            />
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
                color: 'rgba(248, 234, 192, 0.78)',
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

      <CoverageAssumptionsDisclosure />

      <div style={dividerStyle} />
      </section>

      <section
        id="tuning-page-panel-handover-policy"
        data-testid="handover-policy-page"
        role="tabpanel"
        aria-labelledby="tuning-page-tab-handover-policy"
        hidden={activePage !== 'handover-policy'}
        style={activePage === 'handover-policy' ? pagePanelStyle : hiddenPagePanelStyle}
      >
        <HandoverPolicyControls
          draft={handoverDraft}
          applied={appliedHandoverPolicy}
          hasDraftChanges={hasHandoverDraftChanges}
          hasOverrides={hasHandoverOverrides}
          onDraftChange={onHandoverDraftChange}
          onApply={onApplyHandoverPolicy}
          onReset={onResetHandoverPolicy}
        />
      </section>
    </aside>
  );
}
