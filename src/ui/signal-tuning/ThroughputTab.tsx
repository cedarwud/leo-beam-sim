import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import {
  computeTeachingThroughputMbps,
  TEACHING_CLAIM_LABEL,
} from '../../teaching';
import type { LinkBudgetTerms } from '../../scene/types';
import type { SignalTuningState } from '../../signalTuning';
import { NumericControl } from './Controls';
import { FormulaHeader, FormulaRow } from './FormulaHeader';
import { txBi } from './labels';
import {
  captionTextStyle,
  controlStackStyle,
  groupTitleStyle,
  pagePanelStyle,
} from './styles';

const THROUGHPUT_ACCENT = UI_TOKENS.color.semantic.info;

function resolveTeachingSinrDb(
  formulaBudget: LinkBudgetTerms | null,
  isFormulaEvidenceStale: boolean,
): number | null {
  if (isFormulaEvidenceStale || formulaBudget === null) return null;
  if (!Number.isFinite(formulaBudget.signalDbm) || !Number.isFinite(formulaBudget.denominatorDbm)) {
    return null;
  }
  return formulaBudget.signalDbm - formulaBudget.denominatorDbm;
}

function formatNumber(value: number | null, unit: string, digits = 2): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)} ${unit}`;
}

/**
 * Teaching throughput controls and readout.
 *
 * SINR is read-only here: it is derived from the current formula evidence
 * supplied by the existing panel, while B and K write the shared signal
 * tuning state. The result is intentionally the teaching Shannon projection,
 * not a canonical delivered-throughput frame.
 */
export function ThroughputTab({
  tuning,
  formulaBudget,
  isFormulaEvidenceStale = false,
  onTuningChange,
}: {
  tuning: SignalTuningState;
  formulaBudget: LinkBudgetTerms | null;
  isFormulaEvidenceStale?: boolean;
  onTuningChange: (next: SignalTuningState) => void;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const sinrDb = resolveTeachingSinrDb(formulaBudget, isFormulaEvidenceStale);
  const throughputMbps = sinrDb === null
    ? null
    : computeTeachingThroughputMbps({
      sinrDb,
      bandwidthMHz: tuning.bandwidthMHz,
      frequencyReuse: tuning.frequencyReuse,
    });
  const evidenceStatus = isFormulaEvidenceStale
    ? 'stale'
    : formulaBudget === null
      ? 'waiting'
      : sinrDb === null
        ? 'absent'
        : 'current';

  return (
    <section
      id="tuning-page-panel-throughput"
      data-testid="throughput-teaching-page"
      data-teaching-claim={TEACHING_CLAIM_LABEL}
      data-canonical-status="non-canonical"
      role="tabpanel"
      aria-label={say('tab.throughput.label', '吞吐量', 'Throughput')}
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="throughput-teaching-formula-header"
        title={say('panel.throughput.title', '吞吐量', 'Throughput')}
        accent={THROUGHPUT_ACCENT}
        caption={say(
          'panel.throughput.scope',
          '用目前連線的 SINR、頻寬 B 與頻率重複使用 K 估算教學吞吐量；不是 canonical delivered-throughput frame。',
          'Projects teaching throughput from the current link SINR, bandwidth B, and reuse K; it is not a canonical delivered-throughput frame.',
        )}
        help={{
          helpId: 'panel.throughput.teachingHelp',
          body: say(
            'panel.throughput.help',
            'SINR 來自現有 link-budget evidence；B 與 K 可在本頁操作。結果使用教學 Shannon 上限，並在沒有可信即時證據時保持空值。',
            'SINR comes from the existing link-budget evidence; B and K are adjustable here. The result uses the teaching Shannon cap and stays absent when current evidence is unavailable.',
          ),
        }}
      >
        <FormulaRow
          testId="throughput-teaching-formula-row"
          accent={THROUGHPUT_ACCENT}
          emphasis
          expression={<>R<sub>teaching</sub> = (B / K) · log<sub>2</sub>(1 + SINR)</>}
          note="Mbit/s"
          source={say(
            'panel.throughput.formula.source',
            'SINR ← 即時公式證據；B、K ← 本頁控制',
            'SINR ← current formula evidence; B and K ← controls on this tab',
          )}
        />
      </FormulaHeader>

      <div style={controlStackStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={groupTitleStyle}>{say('section.throughputControls.title', '可操作參數', 'Adjustable inputs')}</div>
          <span style={captionTextStyle}>B / K</span>
        </div>

        <NumericControl
          testId="throughput-tab-bandwidth-control"
          symbol={<>B</>}
          label="Channel bandwidth"
          labelKey="param.bandwidthMHz.label"
          unit="MHz"
          unitKey="param.bandwidthMHz.unit"
          value={tuning.bandwidthMHz}
          min={5}
          max={400}
          step={5}
          description="Bandwidth allocated to the teaching throughput projection."
          effect="Increasing B raises the projected rate, while also raising the SINR thermal-noise floor in the shared signal model."
          helpId="param.throughputTab.bandwidthMHz"
          helpBodyKey="param.bandwidthMHz.help"
          helpEffectKey="param.bandwidthMHz.effect"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => `${value.toFixed(0)} MHz`}
          onChange={bandwidthMHz => onTuningChange({ ...tuning, bandwidthMHz })}
        />

        <NumericControl
          testId="throughput-tab-frequency-reuse-control"
          symbol={<>K</>}
          label="Frequency reuse factor"
          labelKey="param.frequencyReuse.label"
          unit="groups"
          unitKey="param.frequencyReuse.unit"
          value={tuning.frequencyReuse}
          min={1}
          max={7}
          step={1}
          description="Number of frequency-reuse groups used by the teaching rate projection."
          effect="Increasing K divides the available bandwidth across more reuse groups; it also changes co-channel interference in the shared SINR model."
          helpId="param.throughputTab.frequencyReuse"
          helpBodyKey="param.frequencyReuse.help"
          helpEffectKey="param.frequencyReuse.effect"
          accentColor={THROUGHPUT_ACCENT}
          formatValue={value => `K = ${value.toFixed(0)}`}
          onChange={frequencyReuse => onTuningChange({ ...tuning, frequencyReuse })}
        />
      </div>

      <section
        data-testid="throughput-teaching-readout"
        data-throughput-status={evidenceStatus}
        data-sinr-source="current-link-budget-evidence"
        style={{
          display: 'grid',
          gap: 10,
          padding: '13px 14px',
          borderRadius: UI_TOKENS.radius.lg,
          background: UI_TOKENS.color.surface.card,
          border: `1px solid ${THROUGHPUT_ACCENT}3d`,
          borderLeft: `4px solid ${THROUGHPUT_ACCENT}`,
        }}
      >
        <div style={groupTitleStyle}>{say('section.throughputReadout.title', '目前教學讀數', 'Current teaching readout')}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          <div data-testid="throughput-tab-sinr-readout" style={{ ...readoutCellStyle, borderColor: `${THROUGHPUT_ACCENT}33` }}>
            <span style={captionTextStyle}>SINR</span>
            <strong style={{ color: THROUGHPUT_ACCENT }}>{formatNumber(sinrDb, 'dB')}</strong>
          </div>
          <div data-testid="throughput-tab-allocated-bandwidth-readout" style={readoutCellStyle}>
            <span style={captionTextStyle}>B / K</span>
            <strong style={{ color: THROUGHPUT_ACCENT }}>{formatNumber(tuning.bandwidthMHz / tuning.frequencyReuse, 'MHz')}</strong>
          </div>
          <div data-testid="throughput-tab-rate-readout" style={{ ...readoutCellStyle, borderColor: `${THROUGHPUT_ACCENT}66` }}>
            <span style={captionTextStyle}>R<sub>teaching</sub></span>
            <strong style={{ color: THROUGHPUT_ACCENT }}>{formatNumber(throughputMbps, 'Mbit/s')}</strong>
          </div>
        </div>
        <div style={captionTextStyle}>
          {evidenceStatus === 'current'
            ? say(
              'section.throughputReadout.current',
              '非 canonical 教學投影；SINR 由目前公式證據推導，並非實測網路吞吐量。',
              'Non-canonical teaching projection; SINR is derived from current formula evidence, not measured network throughput.',
            )
            : say(
              'section.throughputReadout.waiting',
              '等待可信的目前 SINR 公式證據；在此之前保持 —，不把舊讀數當成 current。',
              'Waiting for current SINR formula evidence; the panel stays at — rather than presenting stale data as current.',
            )}
        </div>
      </section>
    </section>
  );
}

const readoutCellStyle = {
  display: 'grid',
  gap: 5,
  padding: '9px 8px',
  borderRadius: UI_TOKENS.radius.md,
  background: UI_TOKENS.color.surface.cardFaint,
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
  textAlign: 'center' as const,
};
