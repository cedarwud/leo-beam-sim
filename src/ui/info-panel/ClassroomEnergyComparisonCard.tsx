import { UI_CLASSES, UI_TOKENS } from '../../constants/uiTokens';
import {
  CLASSROOM_ENERGY_COMPARISON_THRESHOLDS,
  type ClassroomEnergyComparisonArm,
  type ClassroomEnergyComparisonResult,
} from '../../teaching';
import { usePanelCopy } from './panelHelp';

export type ClassroomEnergyCaptureBlockReason =
  | 'not-live-sinr-scene'
  | 'timeline-running'
  | 'wrong-power'
  | 'context-mismatch'
  | 'invalid-window'
  | 'missing-readout';

export interface ClassroomEnergyCaptureState {
  readonly canCapture: boolean;
  readonly reason: ClassroomEnergyCaptureBlockReason | null;
}

export interface ClassroomEnergyComparisonCardProps {
  readonly baseline: ClassroomEnergyComparisonArm | null;
  readonly candidate: ClassroomEnergyComparisonArm | null;
  readonly result: ClassroomEnergyComparisonResult | null;
  readonly currentTxPowerDbm: number;
  readonly currentLowSinrThresholdDb: number | null | undefined;
  readonly baselineTargetTxPowerDbm: number;
  readonly candidateTargetTxPowerDbm: number;
  readonly baselineCapture: ClassroomEnergyCaptureState;
  readonly candidateCapture: ClassroomEnergyCaptureState;
  readonly contextDrifted: boolean;
  readonly onCaptureBaseline: () => void;
  readonly onCaptureCandidate: () => void;
  readonly onClearArms: () => void;
}

type GateKey = keyof ClassroomEnergyComparisonResult['gates'];

const GATE_DEFINITIONS: ReadonlyArray<{
  readonly key: GateKey;
  readonly labelKey: string;
  readonly metric: 'energySavingPct' | 'dataRetentionRatio' | 'lowSinrDeltaPp' | 'runEeRatio';
}> = [
  {
    key: 'energySaving',
    labelKey: 'panel.energyComparison.gate.energySaving',
    metric: 'energySavingPct',
  },
  {
    key: 'dataRetention',
    labelKey: 'panel.energyComparison.gate.dataRetention',
    metric: 'dataRetentionRatio',
  },
  {
    key: 'lowSinr',
    labelKey: 'panel.energyComparison.gate.lowSinr',
    metric: 'lowSinrDeltaPp',
  },
  {
    key: 'runEe',
    labelKey: 'panel.energyComparison.gate.runEe',
    metric: 'runEeRatio',
  },
];

function isMeasured(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  return isMeasured(value) ? value.toFixed(digits) : '—';
}

function hasReason(
  result: ClassroomEnergyComparisonResult | null,
  ...reasons: ClassroomEnergyComparisonResult['reasonCodes'][number][]
): boolean {
  return result?.reasonCodes.some(reason => reasons.includes(reason)) ?? false;
}

function captureReasonCopy(
  reason: ClassroomEnergyCaptureBlockReason,
  t: (key: string) => string,
): string {
  switch (reason) {
    case 'not-live-sinr-scene':
      return t('panel.energyComparison.disabled.notLiveSinr');
    case 'timeline-running':
      return t('panel.energyComparison.disabled.timelineRunning');
    case 'wrong-power':
      return t('panel.energyComparison.disabled.wrongPower');
    case 'context-mismatch':
      return t('panel.energyComparison.disabled.contextMismatch');
    case 'invalid-window':
      return t('panel.energyComparison.disabled.invalidWindow');
    case 'missing-readout':
      return t('panel.energyComparison.disabled.missingReadout');
  }
}

function formatMetric(
  metric: (typeof GATE_DEFINITIONS)[number]['metric'],
  result: ClassroomEnergyComparisonResult | null,
  missingText: string,
  percentagePointsText: string,
): string {
  if (result === null || result.comparable !== true) return missingText;
  const value = result[metric];
  if (!isMeasured(value)) return missingText;
  if (metric === 'energySavingPct') return `${value.toFixed(2)}%`;
  if (metric === 'lowSinrDeltaPp') return `${value.toFixed(2)} ${percentagePointsText}`;
  return value.toFixed(2);
}

function isCompleteComparison(result: ClassroomEnergyComparisonResult | null): boolean {
  if (result === null || result.comparable !== true) return false;
  const derivedValues = [
    result.dataRetentionRatio,
    result.energySavingPct,
    result.lowSinrDeltaPp,
    result.runEeRatio,
  ];
  return derivedValues.every(isMeasured)
    && Object.values(result.gates).every(value => typeof value === 'boolean');
}

function armStatusLabel(
  arm: ClassroomEnergyComparisonArm | null,
  t: (key: string) => string,
): string {
  return arm === null
    ? t('panel.energyComparison.notCaptured')
    : t('panel.energyComparison.frozen');
}

function armValue(value: number | null | undefined, unit: string, digits = 2): string {
  return isMeasured(value) ? `${formatNumber(value, digits)} ${unit}` : '—';
}

export function ClassroomEnergyComparisonCard({
  baseline,
  candidate,
  result,
  currentTxPowerDbm,
  currentLowSinrThresholdDb,
  baselineTargetTxPowerDbm,
  candidateTargetTxPowerDbm,
  baselineCapture,
  candidateCapture,
  contextDrifted,
  onCaptureBaseline,
  onCaptureCandidate,
  onClearArms,
}: ClassroomEnergyComparisonCardProps) {
  const { locale, t, tx } = usePanelCopy();
  const comparisonComplete = isCompleteComparison(result);
  const absent = t('panel.energyComparison.dataInsufficient');
  const statusLabel = (gate: boolean | null): string => {
    if (!comparisonComplete || typeof gate !== 'boolean') return absent;
    return gate ? t('panel.energyComparison.pass') : t('panel.energyComparison.fail');
  };
  const lowSinrThreshold = baseline?.lowSinrThresholdDb
    ?? candidate?.lowSinrThresholdDb
    ?? currentLowSinrThresholdDb
    ?? null;
  const lowSinrLabel = t('panel.energyComparison.lowSinrLabel')
    .replace('{threshold}', formatNumber(lowSinrThreshold, 0))
    .replace('{unit}', t('common.unit.db'));
  const gateLabel = (definition: (typeof GATE_DEFINITIONS)[number]): string => {
    const label = t(definition.labelKey);
    if (definition.key === 'dataRetention') {
      return `${label} ${CLASSROOM_ENERGY_COMPARISON_THRESHOLDS.minDataRetentionRatio.toFixed(2)}`;
    }
    if (definition.key === 'lowSinr') {
      return `${label} ${CLASSROOM_ENERGY_COMPARISON_THRESHOLDS.maxLowSinrDeltaPp.toFixed(0)} ${t('panel.energyComparison.percentagePoints')}`;
    }
    if (definition.key === 'runEe') {
      return `${label} ${CLASSROOM_ENERGY_COMPARISON_THRESHOLDS.minRunEeRatio.toFixed(2)}`;
    }
    return label;
  };
  const settingsChanged = contextDrifted
    || hasReason(result, 'CONTEXT_KEY_MISMATCH', 'LOW_SINR_THRESHOLD_MISMATCH');
  const windowMismatch = hasReason(
    result,
    'WINDOW_START_MISMATCH',
    'WINDOW_END_MISMATCH',
    'WINDOW_DURATION_MISMATCH',
  );

  const renderCaptureControl = (
    role: 'baseline' | 'candidate',
    arm: ClassroomEnergyComparisonArm | null,
    capture: ClassroomEnergyCaptureState,
    targetTxPowerDbm: number,
    onCapture: () => void,
  ) => {
    const labelKey = role === 'baseline'
      ? 'panel.energyComparison.captureBaseline'
      : 'panel.energyComparison.captureCandidate';
    const replaceLabelKey = role === 'baseline'
      ? 'panel.energyComparison.replaceBaseline'
      : 'panel.energyComparison.replaceCandidate';
    const buttonLabel = t(arm === null ? labelKey : replaceLabelKey);
    const reasonId = `classroom-energy-${role}-capture-help`;
    return (
      <div style={{ display: 'grid', gap: UI_TOKENS.space.xs, minWidth: 0 }}>
        <button
          type="button"
          className={UI_CLASSES.button}
          onClick={onCapture}
          disabled={!capture.canCapture}
          aria-describedby={!capture.canCapture ? reasonId : undefined}
          data-testid={`classroom-energy-${role}-capture`}
          style={{
            width: '100%',
            minHeight: 42,
            padding: `${UI_TOKENS.space.md}px ${UI_TOKENS.space.lg}px`,
            border: `1px solid ${UI_TOKENS.color.border.soft}`,
            borderRadius: UI_TOKENS.radius.md,
            background: UI_TOKENS.color.surface.fieldSoft,
            color: UI_TOKENS.color.text.primary,
            fontWeight: UI_TOKENS.type.weight.strong,
            textAlign: 'left',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {buttonLabel} ({targetTxPowerDbm} {t('common.unit.dbm')})
        </button>
        {!capture.canCapture && capture.reason !== null && (
          <span
            id={reasonId}
            style={{
              color: UI_TOKENS.color.text.muted,
              fontSize: UI_TOKENS.type.size.tiny,
              lineHeight: 1.35,
              minWidth: 0,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {captureReasonCopy(capture.reason, t)}
          </span>
        )}
      </div>
    );
  };

  const renderArm = (
    role: 'baseline' | 'candidate',
    arm: ClassroomEnergyComparisonArm | null,
  ) => {
    const title = role === 'baseline'
      ? t('panel.energyComparison.baseline')
      : t('panel.energyComparison.candidate');
    const rows = [
      [t('param.maxTxPowerDbm.label'), armValue(arm?.txPowerDbm, t('common.unit.dbm'), 0)],
      [t('panel.energyComparison.rawLoad'), armValue(arm?.servingLoad, '', 0).trim()],
      [t('panel.energyComparison.rawSinr'), armValue(arm?.servingSinrDb, t('common.unit.db'))],
      [t('panel.energyComparison.rawThroughput'), armValue(arm?.throughputMbps, t('common.unit.mbps'))],
      [t('panel.energyComparison.rawServiceStatus'), arm?.serviceStatus ?? '—'],
      [t('panel.energyComparison.rawServiceIdentity'), arm?.serviceIdentity ?? '—'],
      [t('panel.energyComparison.rawProducerStatus'), arm?.producerStatus ?? '—'],
      [tx('panel.energy.elapsed'), armValue(arm?.elapsedSec, t('common.unit.second'))],
      [t('kpi.cumulativeDeliveredData.label'), armValue(arm?.cumulativeDataMbit, 'Mbit')],
      [t('kpi.totalEnergy.label'), armValue(arm?.totalEnergyJ, t('common.unit.joule'))],
      [t('kpi.runEe.label'), armValue(arm?.runEeMbitPerJ, t('common.unit.mbitPerJoule'))],
      [lowSinrLabel, armValue(arm?.lowSinrRatioPct, t('common.unit.percent'))],
      [t('kpi.handoverCount.label'), armValue(arm?.handoverCount, '', 0).trim()],
    ] as const;
    return (
      <section
        aria-label={title}
        data-testid={`classroom-energy-${role}-arm`}
        style={{
          minWidth: 0,
          padding: UI_TOKENS.space.lg,
          border: `1px solid ${UI_TOKENS.color.border.subtle}`,
          borderRadius: UI_TOKENS.radius.md,
          background: UI_TOKENS.color.surface.cardSubtle,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: UI_TOKENS.space.sm, alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
          <h3 style={{ margin: 0, minWidth: 0, color: UI_TOKENS.color.text.panel, fontSize: UI_TOKENS.type.size.body, fontWeight: UI_TOKENS.type.weight.strong, overflowWrap: 'anywhere' }}>
            {title}
          </h3>
          <span style={{ minWidth: 0, color: UI_TOKENS.color.text.muted, fontSize: UI_TOKENS.type.size.tiny, overflowWrap: 'anywhere' }}>
            {armStatusLabel(arm, t)}
          </span>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: `${UI_TOKENS.space.sm}px ${UI_TOKENS.space.lg}px`, margin: `${UI_TOKENS.space.lg}px 0 0`, fontSize: UI_TOKENS.type.size.tiny, minWidth: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'contents' }}>
              <dt style={{ color: UI_TOKENS.color.text.muted, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{label}</dt>
              <dd style={{ margin: 0, minWidth: 0, color: UI_TOKENS.color.text.primary, fontFamily: UI_TOKENS.type.family.mono, textAlign: 'right', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  };

  return (
    <section
      className="leo-classroom-energy-comparison-card"
      data-testid="classroom-energy-comparison-card"
      aria-labelledby="classroom-energy-comparison-title"
      style={{
        marginTop: UI_TOKENS.space.xl,
        padding: UI_TOKENS.space.xl,
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.card,
        border: `1px solid ${UI_TOKENS.color.border.metric}`,
        display: 'grid',
        gap: UI_TOKENS.space.lg,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'grid', gap: UI_TOKENS.space.xs, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: UI_TOKENS.space.md, flexWrap: 'wrap', minWidth: 0 }}>
          <h2 id="classroom-energy-comparison-title" style={{ margin: 0, minWidth: 0, color: UI_TOKENS.color.text.panel, fontSize: UI_TOKENS.type.size.body, fontWeight: UI_TOKENS.type.weight.heavy, overflowWrap: 'anywhere' }}>
            {t('panel.energyComparison.title')}
          </h2>
          <span style={{ minWidth: 0, maxWidth: '100%', color: UI_TOKENS.color.text.muted, fontSize: UI_TOKENS.type.size.tiny, textAlign: 'right', overflowWrap: 'anywhere' }}>
            {t('param.maxTxPowerDbm.label')}: {formatNumber(currentTxPowerDbm, 0)} {t('common.unit.dbm')}
          </span>
        </div>
        <p style={{ margin: 0, minWidth: 0, color: UI_TOKENS.color.text.secondary, fontSize: UI_TOKENS.type.size.tiny, lineHeight: 1.45, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
          {t('panel.energyComparison.subtitle')}
        </p>
      </div>

      {(settingsChanged || windowMismatch) && (
        <div
          role="status"
          data-testid="classroom-energy-comparison-mismatch"
          style={{
            display: 'grid',
            gap: UI_TOKENS.space.xs,
            padding: UI_TOKENS.space.md,
            border: `1px solid ${UI_TOKENS.color.semantic.warning.badgeBorder}`,
            borderRadius: UI_TOKENS.radius.md,
            background: UI_TOKENS.color.surface.cardFaint,
            color: UI_TOKENS.color.semantic.warning.badge,
            fontSize: UI_TOKENS.type.size.tiny,
            minWidth: 0,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {settingsChanged && <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{contextDrifted ? t('panel.energyComparison.settingsChanged') : t('panel.energyComparison.contextMismatch')}</span>}
          {windowMismatch && <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{t('panel.energyComparison.windowMismatch')}</span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: UI_TOKENS.space.md, minWidth: 0 }}>
        {renderArm('baseline', baseline)}
        {renderArm('candidate', candidate)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: UI_TOKENS.space.md, minWidth: 0 }}>
        {renderCaptureControl('baseline', baseline, baselineCapture, baselineTargetTxPowerDbm, onCaptureBaseline)}
        {renderCaptureControl('candidate', candidate, candidateCapture, candidateTargetTxPowerDbm, onCaptureCandidate)}
      </div>

      <div
        data-testid="classroom-energy-clear-control"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: `${UI_TOKENS.space.sm}px ${UI_TOKENS.space.md}px`,
          minWidth: 0,
        }}
      >
        <button
          type="button"
          className={UI_CLASSES.button}
          onClick={onClearArms}
          disabled={baseline === null && candidate === null}
          aria-describedby={baseline === null && candidate === null ? 'classroom-energy-clear-help' : undefined}
          data-testid="classroom-energy-clear"
          style={{
            minHeight: 38,
            maxWidth: '100%',
            padding: `${UI_TOKENS.space.sm}px ${UI_TOKENS.space.lg}px`,
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
            borderRadius: UI_TOKENS.radius.md,
            background: UI_TOKENS.color.surface.cardFaint,
            color: UI_TOKENS.color.text.secondary,
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {t('panel.energyComparison.clear')}
        </button>
        {baseline === null && candidate === null && (
          <span id="classroom-energy-clear-help" style={{ flex: '1 1 12rem', minWidth: 0, color: UI_TOKENS.color.text.muted, fontSize: UI_TOKENS.type.size.tiny, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {t('panel.energyComparison.disabled.noSnapshots')}
          </span>
        )}
      </div>

      <div data-testid="classroom-energy-gates" style={{ display: 'grid', gap: UI_TOKENS.space.sm }}>
        {GATE_DEFINITIONS.map(definition => {
          const gate = result?.gates[definition.key] ?? null;
          const state = statusLabel(gate);
          const stateTone = state === t('panel.energyComparison.pass')
            ? UI_TOKENS.color.semantic.good
            : state === t('panel.energyComparison.fail')
              ? UI_TOKENS.color.semantic.danger
              : UI_TOKENS.color.text.muted;
          return (
            <div
              key={definition.key}
              data-testid={`classroom-energy-gate-${definition.key}`}
              data-gate-state={state === absent ? 'missing' : state === t('panel.energyComparison.pass') ? 'pass' : 'fail'}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 12rem)',
                gap: UI_TOKENS.space.md,
                alignItems: 'baseline',
                padding: `${UI_TOKENS.space.sm}px 0`,
                borderTop: `1px solid ${UI_TOKENS.color.border.subtle}`,
                minWidth: 0,
              }}
            >
              <span style={{ color: UI_TOKENS.color.text.secondary, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{gateLabel(definition)}</span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', flexWrap: 'wrap', gap: `0 ${UI_TOKENS.space.sm}px`, minWidth: 0 }}>
                <span style={{ color: UI_TOKENS.color.text.muted, minWidth: 0, fontFamily: UI_TOKENS.type.family.mono, textAlign: 'right', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {formatMetric(
                    definition.metric,
                    comparisonComplete ? result : null,
                    absent,
                    t('panel.energyComparison.percentagePoints'),
                  )}
                </span>
                <strong style={{ color: stateTone, minWidth: 0, textAlign: 'right', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{state}</strong>
              </div>
            </div>
          );
        })}
        <div
          data-testid="classroom-energy-overall"
          data-gate-state={comparisonComplete && result?.qualified === true ? 'pass' : comparisonComplete && result?.qualified === false ? 'fail' : 'missing'}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: UI_TOKENS.space.md,
            alignItems: 'baseline',
            paddingTop: UI_TOKENS.space.md,
            borderTop: `1px solid ${UI_TOKENS.color.border.metric}`,
            minWidth: 0,
          }}
        >
          <strong style={{ color: UI_TOKENS.color.text.panel, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{t('panel.energyComparison.overall')}</strong>
          <strong style={{ color: comparisonComplete && result?.qualified === true ? UI_TOKENS.color.semantic.good : comparisonComplete ? UI_TOKENS.color.semantic.danger : UI_TOKENS.color.text.muted, minWidth: 0, textAlign: 'right', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {statusLabel(comparisonComplete ? result?.qualified ?? null : null)}
          </strong>
        </div>
      </div>

      <p style={{ margin: 0, minWidth: 0, color: UI_TOKENS.color.text.faint, fontSize: UI_TOKENS.type.size.tiny, lineHeight: 1.4, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        {comparisonComplete
          ? t('panel.energyComparison.failClosedNote')
          : t('panel.energyComparison.dataInsufficientNote')}
      </p>
    </section>
  );
}
