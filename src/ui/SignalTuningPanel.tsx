import { useState, type CSSProperties, type ReactNode } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
import { getFormulaFamilyLabel, getProfileLabel } from '../profiles';
import {
  DEFAULT_TR38811_CHANNEL,
  type GainModel,
  type PathLossComponent,
  type Profile,
} from '../profiles/types';
import type { LinkBudgetTerms } from '../scene/types';
import type { HandoverPolicyTuningState } from '../handoverPolicyTuning';
import {
  PATH_LOSS_COMPONENT_ORDER,
  type SignalTuningState,
} from '../signalTuning';
import { HandoverPolicyControls } from './HandoverPolicyControls';
import type { UiMode } from './uiMode';

interface SignalTuningPanelProps {
  baseProfile: Profile;
  tuning: SignalTuningState;
  hasOverrides: boolean;
  uiMode: UiMode;
  formulaBudget: LinkBudgetTerms | null;
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
type SignalDrawerState = 'collapsed' | 'tuning' | 'diagnostics';

interface TuningTab {
  key: TuningTabKey;
  symbol: ReactNode;
  title: string;
  subtitle: string;
  formula: ReactNode;
  note: string;
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
  width: 'min(520px, calc(100vw - 24px))',
  minWidth: 0,
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'calc(100vh - 88px)',
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  background: UI_TOKENS.color.surface.tuningPanel,
  backdropFilter: 'blur(12px)',
  border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
  borderRadius: UI_TOKENS.radius.panel,
  boxShadow: UI_TOKENS.shadow.tuningPanel,
  padding: 20,
  color: UI_TOKENS.color.text.panel,
  fontSize: UI_TOKENS.type.size.body,
  boxSizing: 'border-box',
  display: 'grid',
  gap: 16,
};

const collapsedPanelStyle: CSSProperties = {
  ...panelStyle,
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'center',
  gap: 0,
  overflow: 'hidden',
  overflowY: 'hidden',
  padding: 0,
};

const drawerContentStyle: CSSProperties = {
  display: 'grid',
  gap: 0,
  minWidth: 0,
  width: '100%',
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: UI_TOKENS.color.border.subtle,
};

const controlStackStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
};

const pagePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 15,
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

const compactDetailsStyle: CSSProperties = {
  color: UI_TOKENS.color.text.muted,
  fontSize: UI_TOKENS.type.size.body,
  lineHeight: 1.5,
};

const compactSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: UI_TOKENS.color.text.secondary,
  fontWeight: UI_TOKENS.type.weight.strong,
};

const explanatoryTextStyle: CSSProperties = {
  color: UI_TOKENS.color.text.secondary,
  fontSize: UI_TOKENS.type.size.body,
  lineHeight: 1.48,
};

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function formatWithUnit(value: number, unit: string, digits = 1): string {
  return `${value.toFixed(digits)} ${unit}`;
}

function formatDbm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBm`;
}

function formatDbi(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dBi`;
}

function getActiveTabConfig(activeTab: TuningTabKey): TuningTab {
  return TUNING_TABS.find(tab => tab.key === activeTab) ?? TUNING_TABS[0];
}

function MathSymbol({
  children,
  size = 24,
  color = UI_TOKENS.color.text.symbol,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
}) {
  return <span style={{ ...symbolStyle, fontSize: size, color }}>{children}</span>;
}

function FormulaContext({ tab }: { tab: TuningTab }) {
  const accent = getFormulaTabAccent(tab.key);

  return (
    <div style={{
      display: 'grid',
      gap: 8,
      padding: '12px 14px',
      borderRadius: UI_TOKENS.radius.lg,
      background: 'rgba(255, 255, 255, 0.045)',
      border: `1px solid ${accent}30`,
      borderLeft: `4px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
        <div style={{ ...formulaTextStyle, color: accent }}>{tab.formula}</div>
      </div>
      <div style={explanatoryTextStyle}>
        {tab.note}
      </div>
    </div>
  );
}

function FormulaContextDisclosure({ tab }: { tab: TuningTab }) {
  return (
    <details
      open
      data-testid="active-tab-formula-context"
      data-prominence="primary-context"
      style={{
        display: 'grid',
        gap: 10,
        padding: '10px 11px',
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
        color: UI_TOKENS.color.text.secondary,
      }}
    >
      <summary style={{
        ...compactSummaryStyle,
        color: UI_TOKENS.color.semantic.tuningSoft,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        Formula / notes
      </summary>
      <div style={{ paddingTop: 10 }}>
        <FormulaContext tab={tab} />
      </div>
    </details>
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
      ? UI_TOKENS.color.semantic.noiseSoft
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
        <MathSymbol size={25}>{symbol}</MathSymbol>
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
        lineHeight: explanatoryTextStyle.lineHeight,
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
          background: `${UI_TOKENS.color.semantic.noise}08`,
          border: `1px solid ${UI_TOKENS.color.semantic.noise}1f`,
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
  accentColor,
}: {
  title: string;
  subtitle: ReactNode;
  formula: ReactNode;
  side: 'numerator' | 'denominator';
  children: ReactNode;
  testId: string;
  accentColor?: string;
}) {
  const isNumerator = side === 'numerator';
  const sectionAccent = accentColor ?? (isNumerator ? UI_TOKENS.color.semantic.tuning : UI_TOKENS.color.semantic.noise);

  return (
    <section
      data-testid={testId}
      data-formula-side={side}
      style={{
        display: 'grid',
        gap: 14,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'linear-gradient(180deg, rgba(9, 27, 36, 0.62), rgba(5, 15, 24, 0.5))',
        border: `1px solid ${sectionAccent}24`,
      }}
    >
      {children}
      <div
        data-testid={`${testId}-formula-context`}
        data-prominence="secondary-context"
        style={{
          display: 'grid',
          gap: 6,
        padding: '10px 12px',
        borderRadius: UI_TOKENS.radius.md,
          background: 'rgba(255, 255, 255, 0.035)',
          border: `1px solid ${sectionAccent}1f`,
          borderLeft: `3px solid ${sectionAccent}66`,
        }}
      >
        <div style={{
          fontSize: UI_TOKENS.type.size.body,
          color: UI_TOKENS.color.text.controlLabel,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          {title}
        </div>
        <div style={{ ...formulaTextStyle, fontSize: UI_TOKENS.type.size.subheading, lineHeight: 1.28, color: sectionAccent }}>
          {formula}
        </div>
        <div style={{
          ...explanatoryTextStyle,
        }}>
          {subtitle}
        </div>
      </div>
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
        background: UI_TOKENS.color.surface.card,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
          <MathSymbol size={22} color={UI_TOKENS.color.semantic.noise}>σ²</MathSymbol>
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
          background: `${UI_TOKENS.color.semantic.noise}14`,
          border: `1px solid ${UI_TOKENS.color.semantic.noise}2e`,
          color: hasCurrentNoiseFloor ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {hasCurrentNoiseFloor ? formatDbm(formulaBudget.noiseDbm) : 'waiting'}
        </div>
      </div>
      <div style={{ ...explanatoryTextStyle, color: UI_TOKENS.color.semantic.noiseSoft }}>
        {isFormulaEvidenceStale
          ? 'Read-only σ² / noise floor evidence is stale after edit; waiting for the next recomputed frame.'
          : hasCurrentNoiseFloor
            ? 'Read-only computed σ² / noise floor from the current formula evidence.'
            : 'Read-only σ² / noise floor appears after a selected formula frame is available.'}
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
  disabled = false,
  inactiveReason,
  formatValue,
  testId,
  onChange,
}: NumericControlProps) {
  const formatRangeEndpoint = (endpoint: number) => (
    formatValue ? formatValue(endpoint) : formatWithUnit(endpoint, unit)
  );

  return (
    <div
      data-testid={testId}
      data-control-active={disabled ? 'false' : 'true'}
      style={{
        display: 'grid',
        gap: 11,
        opacity: disabled ? 0.58 : 1,
        padding: '14px 15px',
        borderRadius: UI_TOKENS.radius.lg,
        background: disabled
          ? UI_TOKENS.color.surface.cardSubtle
          : 'linear-gradient(180deg, rgba(15, 39, 48, 0.94), rgba(7, 20, 30, 0.9))',
        border: disabled
          ? `1px solid ${UI_TOKENS.color.border.subtle}`
          : `1px solid ${accentColor}34`,
        boxShadow: disabled
          ? 'none'
          : `inset 2px 0 0 ${accentColor}8f, inset 0 1px 0 rgba(255, 255, 255, 0.06)`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, marginBottom: 5 }}>
            <MathSymbol color={disabled ? UI_TOKENS.color.text.faint : accentColor}>{symbol}</MathSymbol>
            <span
              title={description}
              style={{
                fontSize: UI_TOKENS.type.size.bodyLg,
                color: UI_TOKENS.color.text.controlLabel,
                lineHeight: 1.3,
                fontWeight: UI_TOKENS.type.weight.heavy,
              }}
            >
              {label}
            </span>
          </div>
        </div>
        <div style={{
          padding: '6px 10px',
          borderRadius: UI_TOKENS.radius.md,
          background: disabled ? 'rgba(132, 148, 163, 0.08)' : 'rgba(255, 255, 255, 0.055)',
          border: disabled ? `1px solid ${UI_TOKENS.color.border.subtle}` : `1px solid ${accentColor}38`,
          color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.primary,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {formatValue ? formatValue(value) : formatWithUnit(value, unit)}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
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
        <div
          data-testid={testId ? `${testId}-range-endpoints` : undefined}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.35,
          }}
        >
          <span>Min {formatRangeEndpoint(min)}</span>
          <span>Max {formatRangeEndpoint(max)}</span>
        </div>
      </div>
      <div
        data-testid={testId ? `${testId}-details` : undefined}
        data-prominence="inline-description"
        style={{
          ...explanatoryTextStyle,
          color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.secondary,
        }}
      >
        {description}
      </div>
      <div
        data-testid={testId ? `${testId}-effect` : undefined}
        style={{
          ...explanatoryTextStyle,
          color: disabled ? UI_TOKENS.color.text.faint : UI_TOKENS.color.text.secondary,
        }}
      >
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
        background: isResearch ? 'rgba(117, 74, 10, 0.2)' : 'rgba(21, 96, 88, 0.22)',
        border: isResearch ? '1px solid rgba(247, 217, 123, 0.22)' : '1px solid rgba(118, 234, 215, 0.2)',
      }}
    >
      <div style={{
        fontSize: UI_TOKENS.type.size.bodyLg,
        color: UI_TOKENS.color.text.controlLabel,
        fontWeight: UI_TOKENS.type.weight.heavy,
      }}>
        {title}
      </div>
      <div
        style={{
          padding: '8px 10px',
          borderRadius: UI_TOKENS.radius.md,
          background: isResearch ? 'rgba(247, 217, 123, 0.075)' : 'rgba(88, 191, 240, 0.08)',
          border: isResearch ? '1px solid rgba(247, 217, 123, 0.14)' : '1px solid rgba(88, 191, 240, 0.16)',
          color: isResearch ? 'rgba(255, 230, 173, 0.82)' : UI_TOKENS.color.text.secondary,
          fontSize: UI_TOKENS.type.size.body,
          lineHeight: explanatoryTextStyle.lineHeight,
        }}
      >
        {subtitle}
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
  accentColor = UI_TOKENS.color.semantic.tuning,
  onChange,
}: {
  symbol: ReactNode;
  label: string;
  description: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; detail?: string }>;
  accentColor?: string;
  onChange: (value: string) => void;
}) {
  const activeOption = options.find(option => option.value === value);

  return (
    <div style={{
      display: 'grid',
      gap: 12,
      padding: '12px 13px',
      borderRadius: UI_TOKENS.radius.lg,
      background: UI_TOKENS.color.surface.card,
      border: `1px solid ${UI_TOKENS.color.border.subtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 11 }}>
        <MathSymbol color={accentColor}>{symbol}</MathSymbol>
        <span style={{ fontSize: UI_TOKENS.type.size.subheading, color: UI_TOKENS.color.text.controlLabel, fontWeight: UI_TOKENS.type.weight.heavy }}>{label}</span>
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
          border: `1px solid ${accentColor}33`,
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
        <div style={explanatoryTextStyle}>
          {activeOption.detail}
        </div>
      )}
      <details style={compactDetailsStyle}>
        <summary style={compactSummaryStyle}>Details</summary>
        <div style={{ ...explanatoryTextStyle, paddingTop: 8 }}>
          {description}
        </div>
      </details>
    </div>
  );
}

function PathLossTermControl({
  active,
  symbol,
  label,
  detail,
  controlLabel,
  unit,
  value,
  min,
  max,
  step,
  effect,
  inactiveReason,
  accentColor = UI_TOKENS.color.semantic.tuning,
  formatValue,
  testId,
  onToggle,
  onChange,
}: {
  active: boolean;
  symbol: ReactNode;
  label: string;
  detail: string;
  controlLabel: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  effect: string;
  inactiveReason: string;
  accentColor?: string;
  formatValue?: (value: number) => string;
  testId?: string;
  onToggle: () => void;
  onChange: (value: number) => void;
}) {
  const displayValue = formatValue ? formatValue(value) : formatWithUnit(value, unit);
  const formatRangeEndpoint = (endpoint: number) => (
    formatValue ? formatValue(endpoint) : formatWithUnit(endpoint, unit)
  );
  const termAccent = active ? UI_TOKENS.color.text.secondary : UI_TOKENS.color.text.faint;
  const primaryText = active ? UI_TOKENS.color.text.label : UI_TOKENS.color.text.faint;
  const secondaryText = active ? UI_TOKENS.color.text.muted : UI_TOKENS.color.text.faint;
  const termBackground = active ? 'rgba(255, 255, 255, 0.045)' : 'rgba(132, 148, 163, 0.04)';

  return (
    <section
      className="leo-path-loss-term-row"
      data-testid={testId}
      data-path-loss-term-state={active ? 'on' : 'off'}
      style={{
        display: 'grid',
        gap: 9,
        padding: '12px 13px',
        borderRadius: UI_TOKENS.radius.lg,
        border: `1px solid ${active ? 'rgba(218, 244, 255, 0.14)' : UI_TOKENS.color.border.subtle}`,
        borderLeft: `3px solid ${active ? `${accentColor}66` : 'rgba(132, 148, 163, 0.24)'}`,
        background: termBackground,
        color: primaryText,
        opacity: active ? 1 : 0.58,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
        <div
          title={detail}
          style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}
        >
          <MathSymbol size={24} color={termAccent}>{symbol}</MathSymbol>
          <span style={{
            fontSize: UI_TOKENS.type.size.bodyLg,
            color: primaryText,
            fontWeight: UI_TOKENS.type.weight.strong,
            lineHeight: 1.25,
          }}>
            {label}
          </span>
        </div>
        <button
          className={`${UI_CLASSES.button} leo-path-loss-switch`}
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`${label} path-loss component ${active ? 'on' : 'off'}`}
          data-state={active ? 'on' : 'off'}
          data-testid={testId ? `${testId}-switch` : undefined}
          onClick={onToggle}
          style={{
            cursor: 'pointer',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: active ? 'flex-start' : 'flex-end',
            width: 66,
            height: 30,
            padding: '0 9px',
            borderRadius: UI_TOKENS.radius.pill,
            border: active ? `1px solid ${accentColor}38` : '1px solid rgba(132, 148, 163, 0.32)',
            background: active ? 'rgba(255, 255, 255, 0.05)' : 'rgba(132, 148, 163, 0.10)',
            color: active ? UI_TOKENS.color.text.label : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.caption,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0,
            boxSizing: 'border-box',
            touchAction: 'manipulation',
          }}
        >
          <span>{active ? 'ON' : 'OFF'}</span>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 4,
              left: active ? 40 : 4,
              width: 20,
              height: 20,
              borderRadius: UI_TOKENS.radius.pill,
              background: active ? `${accentColor}b8` : UI_TOKENS.color.semantic.inactive,
              boxShadow: active ? `0 0 4px ${accentColor}20` : 'none',
            }}
          />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
          <span style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'baseline',
            color: primaryText,
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.strong,
          }}>
            <span>{controlLabel}</span>
            <span style={{ fontSize: UI_TOKENS.type.size.small, color: secondaryText }}>
              {active ? effect : inactiveReason}
            </span>
          </span>
          <input
            className={UI_CLASSES.range}
            type="range"
            aria-label={`${controlLabel} (${unit})`}
            disabled={!active}
            aria-disabled={!active}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            style={{ width: '100%', accentColor, cursor: active ? 'pointer' : 'not-allowed' }}
          />
          <span
            data-testid={testId ? `${testId}-range-meta` : undefined}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              color: secondaryText,
              fontSize: UI_TOKENS.type.size.body,
              lineHeight: 1.35,
            }}
          >
            <span>Min {formatRangeEndpoint(min)}</span>
            <span>Max {formatRangeEndpoint(max)}</span>
          </span>
        </label>
        <div style={{
          minWidth: 84,
          padding: '6px 9px',
          borderRadius: UI_TOKENS.radius.md,
          background: active ? 'rgba(255, 255, 255, 0.04)' : 'rgba(132, 148, 163, 0.05)',
          border: active ? '1px solid rgba(218, 244, 255, 0.13)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
          color: active ? UI_TOKENS.color.text.label : UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}>
          {displayValue}
        </div>
      </div>

      <details data-testid={testId ? `${testId}-details` : undefined} style={{
        color: UI_TOKENS.color.text.muted,
        fontSize: UI_TOKENS.type.size.body,
        lineHeight: 1.55,
      }}>
        <summary style={{ cursor: 'pointer', color: secondaryText, fontWeight: UI_TOKENS.type.weight.strong }}>
          Details
        </summary>
        <div style={{ display: 'grid', gap: 6, paddingTop: 8 }}>
          <div>{detail}</div>
        </div>
      </details>
    </section>
  );
}

function getFormulaTabAccent(tabKey: TuningTabKey): string {
  switch (tabKey) {
    case 'thermal-noise':
      return UI_TOKENS.color.semantic.noise;
    case 'interference':
      return '#ff8a6b';
    case 'loss':
      return UI_TOKENS.color.semantic.loss;
    case 'receiver-gain':
      return UI_TOKENS.color.semantic.fixed;
    case 'beam':
      return UI_TOKENS.color.semantic.beam;
    case 'signal-power':
      return UI_TOKENS.color.semantic.tuning;
  }
}

function getFormulaTabShortLabel(tabKey: TuningTabKey): string {
  switch (tabKey) {
    case 'signal-power':
      return 'Power';
    case 'loss':
      return 'Loss';
    case 'beam':
      return 'Beam';
    case 'receiver-gain':
      return 'Receiver';
    case 'interference':
      return 'Interf.';
    case 'thermal-noise':
      return 'Noise';
  }
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
        gridAutoRows: 44,
        height: 54,
        gap: 6,
        padding: 4,
        borderRadius: activePage === 'sinr-formula'
          ? `${UI_TOKENS.radius.lg}px ${UI_TOKENS.radius.lg}px 0 0`
          : UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.soft}`,
        borderBottomColor: activePage === 'sinr-formula'
          ? 'rgba(218,244,255,0.08)'
          : UI_TOKENS.color.border.soft,
        boxSizing: 'border-box',
        overflow: 'hidden',
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
            title={page.subtitle}
            onClick={() => onChange(page.key)}
            style={{
              cursor: 'pointer',
              height: 44,
              minHeight: 44,
              padding: '8px 10px',
              borderRadius: UI_TOKENS.radius.md,
              border: active ? '1px solid rgba(118, 234, 215, 0.44)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: active ? 'rgba(118, 234, 215, 0.14)' : UI_TOKENS.color.surface.cardSubtle,
              color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
              display: 'grid',
              textAlign: 'left',
              alignItems: 'center',
              lineHeight: 1.12,
              boxSizing: 'border-box',
            }}
          >
            <span style={{
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.heavy,
              lineHeight: 1.12,
            }}>
              {page.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function getSignalDrawerState(uiMode: UiMode): SignalDrawerState {
  if (uiMode === 'presentation') return 'collapsed';
  return uiMode;
}

export function SignalTuningPanel({
  baseProfile,
  tuning,
  hasOverrides,
  uiMode,
  formulaBudget,
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

  const sinrOverview = (
    <details
      open
      data-testid="sinr-overview-disclosure"
      data-prominence="primary-context"
      style={{
        display: 'grid',
        gap: 10,
        padding: '10px 11px',
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
        color: UI_TOKENS.color.text.secondary,
      }}
    >
      <summary style={{
        ...compactSummaryStyle,
        color: UI_TOKENS.color.semantic.tuning,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}>
        SINR overview
      </summary>
      <div style={{ display: 'grid', gap: 12, paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.semantic.tuning, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: UI_TOKENS.type.weight.heavy }}>
              SINR Formula Tuning
            </div>
            <div style={{ marginTop: 7, ...formulaTextStyle, fontSize: 23, lineHeight: 1.28 }}>
              γ = <span style={{ color: UI_TOKENS.color.semantic.tuning }}>(P<sub>t</sub> · H · G<sup>T</sup> · G<sup>R</sup>)</span> / <span style={{ color: UI_TOKENS.color.semantic.noise }}>(I<sup>a</sup> + I<sup>b</sup> + σ²)</span>
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
              border: hasOverrides ? '1px solid rgba(20, 135, 121, 0.38)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
              background: hasOverrides ? 'rgba(118, 234, 215, 0.16)' : UI_TOKENS.color.surface.cardFaint,
              color: hasOverrides ? UI_TOKENS.color.semantic.tuning : UI_TOKENS.color.text.faint,
              fontSize: UI_TOKENS.type.size.body,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            Reset
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <div style={{
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(118, 234, 215, 0.16)',
          }}>
            <div style={{ fontSize: UI_TOKENS.type.size.tiny, color: UI_TOKENS.color.semantic.tuning, fontWeight: UI_TOKENS.type.weight.heavy, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Signal side
            </div>
            <div style={{ ...explanatoryTextStyle, marginTop: 3 }}>
              P<sub>t</sub>, H, G<sup>T</sup>, G<sup>R</sup>
            </div>
          </div>
          <div style={{
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(142, 186, 255, 0.16)',
          }}>
            <div style={{ fontSize: UI_TOKENS.type.size.tiny, color: UI_TOKENS.color.semantic.noise, fontWeight: UI_TOKENS.type.weight.heavy, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Noise side
            </div>
            <div style={{ ...explanatoryTextStyle, marginTop: 3 }}>
              I<sup>a</sup>, I<sup>b</sup>, σ²
            </div>
          </div>
        </div>
        <div style={explanatoryTextStyle}>
          {getProfileLabel(baseProfile)} · {getFormulaFamilyLabel(baseProfile.formulaFamily)} · G<sup>R</sup> {formatDbi(tuning.ueAntennaMaxGainDbi)}
        </div>
      </div>
    </details>
  );

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
        style={drawerState === 'collapsed' ? hiddenPagePanelStyle : drawerContentStyle}
      >
      <TuningPageTabs activePage={activePage} onChange={setActivePage} />

      <section
        id="tuning-page-panel-sinr-formula"
        data-testid="sinr-formula-page"
        role="tabpanel"
        aria-labelledby="tuning-page-tab-sinr-formula"
        hidden={activePage !== 'sinr-formula'}
        style={activePage === 'sinr-formula' ? pagePanelStyle : hiddenPagePanelStyle}
      >
      <div
        data-testid="sinr-formula-tabs"
        role="tablist"
        aria-label="SINR parameter groups"
        style={{
          overflowX: 'auto',
          scrollbarGutter: 'stable',
          marginTop: -1,
          padding: 0,
          background: UI_TOKENS.color.surface.cardFaint,
          border: `1px solid ${UI_TOKENS.color.border.soft}`,
          borderTop: 0,
          borderRadius: `0 0 ${UI_TOKENS.radius.lg}px ${UI_TOKENS.radius.lg}px`,
          boxSizing: 'border-box',
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(64px, 1fr))',
          gap: 6,
          minWidth: 420,
          padding: '0 4px 4px',
        }}>
          {TUNING_TABS.map(tab => {
            const active = tab.key === activeTab;
            const accent = getFormulaTabAccent(tab.key);
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
                  height: 50,
                  minHeight: 50,
                  padding: '5px 6px',
                  borderRadius: UI_TOKENS.radius.md,
                  border: active ? `1px solid ${accent}` : `1px solid ${UI_TOKENS.color.border.subtle}`,
                  background: active ? `linear-gradient(180deg, ${accent}1f, rgba(6, 18, 28, 0.82))` : UI_TOKENS.color.surface.card,
                  color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                  boxShadow: active ? `inset 0 -3px 0 ${accent}` : 'inset 0 -2px 0 rgba(218, 244, 255, 0.06)',
                  display: 'grid',
                  gap: 2,
                  alignContent: 'center',
                  justifyItems: 'center',
                  textAlign: 'center',
                  transition: 'background 140ms ease, border-color 140ms ease, color 140ms ease',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <span style={{ ...formulaTextStyle, fontSize: 20, color: accent, lineHeight: 1.04 }}>
                  {tab.symbol}
                </span>
                <span style={{
                  fontSize: UI_TOKENS.type.size.small,
                  fontWeight: UI_TOKENS.type.weight.heavy,
                  lineHeight: 1.15,
                }}>
                  {getFormulaTabShortLabel(tab.key)}
                  {getFormulaTabShortLabel(tab.key) !== tab.title && (
                    <span style={srOnlyStyle}> {tab.title}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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

      <FormulaContextDisclosure tab={activeTabConfig} />

      {sinrOverview}

      <details
        data-testid="sinr-formula-map-disclosure"
        style={{
          display: 'grid',
          gap: 10,
          padding: '10px 11px',
          borderRadius: UI_TOKENS.radius.lg,
          background: 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${UI_TOKENS.color.border.subtle}`,
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
      </div>
    </aside>
  );
}
