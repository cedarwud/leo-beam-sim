import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { PaperEnergyEfficiencyConfig } from '../../profiles/types';
import type {
  PaperEnergyEfficiency,
  PaperEnergyEfficiencySummary,
} from '../../utils/paperEnergyEfficiency';
import { PanelHelp, usePanelCopy } from './panelHelp';

// NOTE on where the "?" triggers sit in the DOM.
//
// `EnergyEfficiencyCard.test.tsx` (`npm run validate:paper-energy-efficiency:ui`)
// pins this card's copy as *adjacency*: `label value unit detail` with nothing
// in between. A help trigger rendered between the label and the value injects a
// "?" into that text and breaks the pin. So every trigger here is rendered
// FIRST in its row's DOM and moved to the right of the label visually with flex
// `order` — the pinned label→value text stays contiguous, and the "?" still
// reads as belonging to the label. Do not "tidy" this by moving the trigger
// after the label in source; that silently breaks the gate.
//
// This card's numbers are untouched: they remain the instantaneous, cross-UE,
// coverage-weighted bit/J from `src/utils/paperEnergyEfficiency.ts`. It is NOT
// the run-level Σ Mbit / Σ J shown by `TeachingEnergyCard`, and the two must
// never be blended into one figure.
const HELP_ORDER = 2;

function fixed(value: number | null | undefined, digits = 1): string {
  return value !== null && value !== undefined && Number.isFinite(value)
    ? value.toFixed(digits)
    : '—';
}

function mbitsPerJoule(bitsPerJoule: number | null | undefined): string {
  return bitsPerJoule !== null && bitsPerJoule !== undefined && Number.isFinite(bitsPerJoule)
    ? (bitsPerJoule / 1e6).toFixed(2)
    : '—';
}

function MetricTile({
  label,
  symbol,
  help,
  value,
  unit,
  detail,
  testId,
}: {
  label: string;
  symbol?: ReactNode;
  /** "?" trigger. Rendered DOM-first, positioned right of the label — see HELP_ORDER note. */
  help?: ReactNode;
  value: string;
  unit?: string;
  detail: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        minWidth: 0,
        padding: `${UI_TOKENS.space.md}px ${UI_TOKENS.space.lg}px`,
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.card,
        border: `1px solid ${UI_TOKENS.color.border.metric}`,
      }}
    >
      <dt style={{
        display: 'flex',
        alignItems: 'center',
        gap: UI_TOKENS.space.sm,
        minWidth: 0,
        color: UI_TOKENS.color.text.secondary,
        fontSize: UI_TOKENS.type.size.small,
        lineHeight: 1.2,
      }}>
        {help}
        {symbol ? (
          <span style={{
            color: UI_TOKENS.color.text.symbol,
            fontFamily: UI_TOKENS.type.family.math,
            fontWeight: UI_TOKENS.type.weight.heavy,
          }}>
            {symbol}
          </span>
        ) : null}
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
      </dt>
      <dd style={{ margin: `${UI_TOKENS.space.sm}px 0 0` }}>
        <div style={{
          color: UI_TOKENS.color.text.primary,
          fontSize: UI_TOKENS.type.size.subheading,
          fontWeight: UI_TOKENS.type.weight.heavy,
          lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
          {unit ? (
            <span style={{
              marginLeft: UI_TOKENS.space.xs,
              color: UI_TOKENS.color.text.secondary,
              fontSize: UI_TOKENS.type.size.caption,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}>
              {unit}
            </span>
          ) : null}
        </div>
        <div style={{
          marginTop: UI_TOKENS.space.xs,
          color: UI_TOKENS.color.text.muted,
          fontSize: UI_TOKENS.type.size.caption,
          lineHeight: 1.4,
        }}>
          {detail}
        </div>
      </dd>
    </div>
  );
}

function AggregationStep({
  label,
  help,
  value,
  unit,
  detail,
  emphasis = false,
  testId,
}: {
  label: string;
  /** "?" trigger. Rendered DOM-first, positioned right of the label — see HELP_ORDER note. */
  help?: ReactNode;
  value: string;
  unit?: string;
  detail: string;
  emphasis?: boolean;
  testId: string;
}) {
  return (
    <div
      className="leo-ee-card__aggregation-step"
      data-testid={testId}
      data-emphasis={emphasis ? 'result' : 'input'}
      style={{
        borderColor: emphasis ? UI_TOKENS.color.border.focus : UI_TOKENS.color.border.metric,
        background: emphasis ? UI_TOKENS.color.surface.fieldSoft : UI_TOKENS.color.surface.card,
      }}
    >
      <div className="leo-ee-card__aggregation-label" style={{
        display: 'flex',
        alignItems: 'center',
        gap: UI_TOKENS.space.xs,
        minWidth: 0,
        color: emphasis ? UI_TOKENS.color.semantic.tuningSoft : UI_TOKENS.color.text.secondary,
        fontSize: UI_TOKENS.type.size.small,
        fontWeight: UI_TOKENS.type.weight.strong,
        lineHeight: 1.2,
      }}>
        {help}
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
      </div>
      <div className="leo-ee-card__aggregation-value" style={{
        color: UI_TOKENS.color.text.primary,
        fontSize: UI_TOKENS.type.size.subheading,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
        {unit ? (
          <span style={{
            marginLeft: UI_TOKENS.space.xs,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.caption,
          }}>
            {unit}
          </span>
        ) : null}
      </div>
      <div className="leo-ee-card__aggregation-detail" style={{
        color: UI_TOKENS.color.text.muted,
        fontSize: UI_TOKENS.type.size.caption,
        lineHeight: 1.35,
      }}>
        {detail}
      </div>
    </div>
  );
}

export function EnergyEfficiencyCard({
  energyEfficiency,
}: {
  energyEfficiency: PaperEnergyEfficiency | null | undefined;
  powerSurface: PaperEnergyEfficiencyConfig | null | undefined;
}) {
  const { t } = usePanelCopy();
  const metric = energyEfficiency ?? null;
  const headline = mbitsPerJoule(metric?.coverageWeightedBitsPerJoule);
  const servedAverage = mbitsPerJoule(metric?.perServedUeBitsPerJoule);
  const servedCount = metric?.servedUeCount ?? null;
  const totalCount = metric?.totalUeCount ?? null;
  const unservedCount = servedCount !== null && totalCount !== null ? totalCount - servedCount : null;
  const coverage = metric
    ? `${fixed(metric.coverageFraction * 100)}${t('common.unit.percent')}`
    : '—';
  const load = metric?.loadSummary;
  const throughput = metric?.throughputSummaryBps;
  const sinr = metric?.sinrDbSummary;
  const power = metric?.powerSummaryW;
  const perUeRawPower = metric?.perUeRawPowerSummaryW;

  return (
    <section
      className="leo-ee-card"
      data-testid="energy-efficiency-card"
      aria-labelledby="energy-efficiency-card-title"
      style={{
        marginTop: UI_TOKENS.space.xl,
        padding: UI_TOKENS.space.xl,
        borderRadius: UI_TOKENS.radius.lg,
        background: 'linear-gradient(180deg, rgba(8, 38, 44, 0.82), rgba(5, 15, 24, 0.72))',
        border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
      }}
    >
      <header className="leo-ee-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: UI_TOKENS.space.xs, minWidth: 0 }}>
          <PanelHelp
            order={HELP_ORDER}
            helpId="kpi.instantaneousEe"
            titleKey="kpi.instantaneousEe.label"
            bodyKey="kpi.instantaneousEe.help"
            formula={<>EE = Σ<sub>u</sub> R<sub>u</sub> / Σ<sub>u</sub> P<sub>u</sub></>}
            meta={<>{t('common.unit.mbitPerJoule')} · {t('panel.ee.headline.help')}</>}
          />
          <h2 id="energy-efficiency-card-title" style={{
            margin: 0,
            color: UI_TOKENS.color.semantic.tuningSoft,
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            {t('panel.overallEe.title')}
          </h2>
        </div>
        <div
          data-testid="energy-efficiency-headline"
          aria-label={headline === '—'
            ? t('panel.ee.headline.unavailable')
            : `${t('panel.overallEe.title')} ${headline} ${t('common.unit.mbitPerJoule')}`}
          style={{
            color: UI_TOKENS.color.text.primary,
            textAlign: 'right',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{
            fontSize: UI_TOKENS.type.size.readout,
            fontWeight: UI_TOKENS.type.weight.heavy,
            lineHeight: 1,
          }}>
            {headline}
          </span>
          <span style={{
            marginLeft: UI_TOKENS.space.xs,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.caption,
            fontWeight: UI_TOKENS.type.weight.strong,
          }}>
            {t('common.unit.mbitPerJoule')}
          </span>
        </div>
      </header>

      <div className="leo-ee-card__aggregation" aria-label={t('panel.ee.aggregation.label')}>
        <AggregationStep
          testId="energy-efficiency-served-average"
          label={t('panel.ee.servedAverage.label')}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="panel.ee.servedAverage"
              titleText={t('panel.ee.servedAverage.label')}
              bodyText={t('panel.ee.servedAverage.help')}
              meta={<>{t('common.unit.mbitPerJoule')}</>}
            />
          )}
          value={servedAverage}
          unit={t('common.unit.mbitPerJoule')}
          detail={servedCount === null
            ? t('panel.ee.waiting.ueAssignments')
            : `${servedCount} ${t('panel.ee.detail.servedAssignments')}`}
        />
        <AggregationStep
          testId="energy-efficiency-coverage"
          label={`× ${t('kpi.coverage.label')}`}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="kpi.coverage"
              titleKey="kpi.coverage.label"
              bodyKey="kpi.coverage.help"
              effectText={t('panel.ee.coverageStep.help')}
              meta={<>{t('common.unit.percent')}</>}
            />
          )}
          value={coverage}
          detail={servedCount === null || totalCount === null
            ? t('panel.ee.waiting.uePopulation')
            : `${servedCount} / ${totalCount} ${t('panel.ee.detail.coverageServed')}`}
        />
      </div>

      <dl className="leo-ee-card__metrics">
        <MetricTile
          testId="energy-efficiency-bandwidth"
          label={t('panel.ee.bandwidth.label')}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="panel.ee.bandwidth"
              titleText={t('panel.ee.bandwidth.label')}
              bodyText={t('panel.ee.bandwidth.help')}
              meta={<>{t('common.unit.mhz')}</>}
            />
          )}
          value={fixed(metric ? metric.allocatedBandwidthHz / 1e6 : null)}
          unit={t('common.unit.mhz')}
          detail={metric ? t('panel.ee.bandwidth.detail') : t('panel.ee.waiting.frameValues')}
        />
        <MetricTile
          testId="energy-efficiency-population"
          symbol={<>|𝒰|</>}
          label={t('panel.ee.population.label')}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="kpi.servedUeCount"
              titleKey="kpi.servedUeCount.label"
              bodyKey="kpi.servedUeCount.help"
              effectText={t('panel.ee.population.help')}
            />
          )}
          value={totalCount === null ? '—' : String(totalCount)}
          unit={t('common.unit.ue')}
          detail={servedCount === null || unservedCount === null
            ? t('panel.ee.waiting.ueAssignments')
            : `${servedCount} ${t('panel.ee.detail.served')} · ${unservedCount} ${t('panel.ee.detail.unserved')}`}
        />
        <MetricTile
          testId="energy-efficiency-beam-load"
          symbol={<>U<sub>s,v</sub></>}
          label={`${t('panel.ee.beamLoad.label')} (s,v)`}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="panel.ee.beamLoad"
              titleText={t('panel.ee.beamLoad.label')}
              bodyText={t('panel.ee.beamLoad.help')}
            />
          )}
          value={`${t('panel.ee.mean')} ${fixed(load?.mean)}`}
          unit={t('common.unit.ue')}
          detail={t('panel.ee.beamLoad.detail')}
        />
        <MetricTile
          testId="energy-efficiency-throughput"
          symbol={<>R<sub>u</sub></>}
          label={t('panel.ee.throughput.label')}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="panel.ee.throughput"
              titleText={t('panel.ee.throughput.label')}
              bodyText={t('panel.ee.throughput.help')}
              meta={<>{t('common.unit.mbps')}</>}
            />
          )}
          value={`${t('panel.ee.mean')} ${throughput ? fixed(throughput.mean / 1e6) : '—'}`}
          unit={t('common.unit.mbps')}
          detail={t('panel.ee.throughput.detail')}
        />
        <MetricTile
          testId="energy-efficiency-sinr"
          symbol={<>γ<sub>u</sub></>}
          label={t('panel.ee.sinr.label')}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="panel.ee.sinr"
              titleText={t('panel.ee.sinr.label')}
              bodyText={t('panel.ee.sinr.help')}
              meta={<>{t('common.unit.db')}</>}
            />
          )}
          value={`${t('panel.ee.mean')} ${fixed(sinr?.mean)}`}
          unit={t('common.unit.db')}
          detail={sinr ? t('panel.ee.sinr.detail') : t('panel.ee.waiting.servedSinr')}
        />
        <MetricTile
          testId="energy-efficiency-beam-power"
          symbol={<>P<sup>b, raw</sup><sub>s,v</sub></>}
          label={t('panel.ee.beamPower.label')}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="panel.ee.beamPower"
              titleText={t('panel.ee.beamPower.label')}
              bodyText={t('panel.ee.beamPower.help')}
              meta={<>{t('common.unit.watt')}</>}
            />
          )}
          value={`${t('panel.ee.mean')} ${fixed(power?.mean, 2)}`}
          unit={t('common.unit.watt')}
          detail={power ? t('panel.ee.beamPower.detail') : t('panel.ee.waiting.beamLoad')}
        />
        <MetricTile
          testId="energy-efficiency-per-ue-raw-power"
          label={t('panel.ee.perUePower.label')}
          help={(
            <PanelHelp
              order={HELP_ORDER}
              helpId="panel.ee.perUePower"
              titleText={t('panel.ee.perUePower.label')}
              bodyText={t('panel.ee.perUePower.help')}
              meta={<>{t('common.unit.watt')}</>}
            />
          )}
          value={`${t('panel.ee.mean')} ${fixed(perUeRawPower?.mean, 2)}`}
          unit={t('common.unit.watt')}
          detail={perUeRawPower ? t('panel.ee.perUePower.detail') : t('panel.ee.waiting.beamLoad')}
        />
      </dl>
    </section>
  );
}
