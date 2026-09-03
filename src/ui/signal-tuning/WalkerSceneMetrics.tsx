import type { ReactNode } from 'react';
import type { SimState } from '../../scene/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { txBi } from './labels';
import { LinkEnergyEfficiency, SystemAngleState, Theta3db } from './FormulaSymbols';

export type WalkerSceneMetricsProps = Pick<SimState, 'canonicalEe' | 'livePaperEnergyEfficiency'>;

function formatValue(value: number | null | undefined, unit: string, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits })} ${unit}`;
}

function formatCoverage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

function Metric({
  testId,
  label,
  value,
  accent,
}: {
  readonly testId: string;
  readonly label: ReactNode;
  readonly value: string;
  readonly accent: string;
}) {
  return (
    <div
      data-testid={testId}
      data-readonly="true"
      style={{
        display: 'grid',
        gap: UI_TOKENS.space.xs,
        minWidth: 0,
        padding: `${UI_TOKENS.space.md}px ${UI_TOKENS.space.lg}px`,
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <span
        style={{
          color: UI_TOKENS.color.text.secondary,
          fontSize: UI_TOKENS.type.size.tiny,
          fontWeight: UI_TOKENS.type.weight.strong,
          lineHeight: 1.25,
          overflowWrap: 'anywhere',
        }}
      >
        {label}
      </span>
      <strong
        style={{
          color: accent,
          fontSize: UI_TOKENS.type.size.body,
          fontWeight: UI_TOKENS.type.weight.heavy,
          lineHeight: 1.2,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

/** Read-only live metrics owned by the central Walker scene. */
export function WalkerSceneMetrics({
  canonicalEe,
  livePaperEnergyEfficiency,
}: WalkerSceneMetricsProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

  return (
    <section
      data-testid="walker-scene-metrics"
      data-readonly="true"
      aria-label={say('walker.scene.metrics.aria', '中央衛星場景即時統計', 'Central satellite-scene live statistics')}
      style={{
        display: 'grid',
        gap: UI_TOKENS.space.md,
        minWidth: 0,
        padding: UI_TOKENS.space.lg,
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardSubtle,
        border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
        color: UI_TOKENS.color.text.primary,
      }}
    >
      <header style={{ display: 'grid', gap: UI_TOKENS.space.xs, minWidth: 0 }}>
        <strong
          style={{
            color: UI_TOKENS.color.semantic.tuningSoft,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            lineHeight: 1.25,
          }}
        >
          {say('walker.scene.metrics.title', '中央衛星場景即時統計', 'Central satellite-scene live statistics')}
        </strong>
        <p
          data-testid="walker-scene-metrics-scope"
          style={{
            margin: 0,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.tiny,
            lineHeight: 1.35,
          }}
        >
          {say(
            'walker.scene.metrics.scope',
            '這一區由中央 3D 場景持續更新；左側參數改變的是上方「目前計算結果」。',
            'This section follows the central 3D scene; left-side parameters update “Current calculated results” above.',
          )}
        </p>
      </header>

      <div
        data-testid="walker-scene-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: UI_TOKENS.space.md,
          minWidth: 0,
        }}
      >
        <Metric
          testId="walker-scene-ee"
          label={<LinkEnergyEfficiency />}
          value={`${formatValue(canonicalEe?.eeEvalMbitPerJ, 'Mbit/J', 3)} · ${formatValue(canonicalEe?.eeInstMbitPerJ, 'Mbit/J', 3)}`}
          accent={UI_TOKENS.color.semantic.warning.accent}
        />
        <Metric
          testId="walker-scene-system-power"
          label={<>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />)</>}
          value={formatValue(canonicalEe?.systemPowerW, 'W', 3)}
          accent={UI_TOKENS.color.semantic.good}
        />
        <Metric
          testId="walker-scene-actual-rf"
          label={<>Power</>}
          value={formatValue(canonicalEe?.actualRfOutputW, 'W', 3)}
          accent={UI_TOKENS.color.semantic.tuning}
        />
        <Metric
          testId="walker-scene-coverage"
          label={say('walker.scene.metrics.coverage', 'Field coverage', 'Field coverage')}
          value={formatCoverage(livePaperEnergyEfficiency?.coverageFraction)}
          accent={UI_TOKENS.color.semantic.info}
        />
        <Metric
          testId="walker-scene-throughput"
          label={say('walker.scene.metrics.throughput', '平均吞吐量', 'Mean throughput')}
          value={formatValue(livePaperEnergyEfficiency?.throughputSummaryBps.mean, 'bit/s', 1)}
          accent={UI_TOKENS.color.semantic.info}
        />
        <Metric
          testId="walker-scene-sinr"
          label={say('walker.scene.metrics.sinr', '平均 SINR', 'Mean SINR')}
          value={formatValue(livePaperEnergyEfficiency?.sinrDbSummary?.mean, 'dB', 2)}
          accent={UI_TOKENS.color.semantic.noise}
        />
        <Metric
          testId="walker-scene-beam-power"
          label={say('walker.scene.metrics.beamPower', '波束 RF 功率', 'Beam RF power')}
          value={formatValue(livePaperEnergyEfficiency?.powerSummaryW.mean, 'W', 3)}
          accent={UI_TOKENS.color.semantic.beam}
        />
      </div>
    </section>
  );
}
