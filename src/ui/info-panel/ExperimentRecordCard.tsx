import type { ExperimentRecord, ExperimentRecordScalar, ExperimentTaskId } from '../../teaching';
import {
  experimentRecordToCsv,
  experimentRecordToJson,
  validateExperimentRecord,
} from '../../teaching';

export interface ExperimentRecordCardProps {
  record: ExperimentRecord | null;
}

const SHARED_PRIMARY_FIELDS = [
  'windowId',
  'durationSec',
  'changedInput',
  'changedControls',
  'unchangedInputs',
] as const;

const TASK_PRIMARY_FIELDS: Record<ExperimentTaskId, readonly string[]> = {
  T1: ['paEfficiency', 'rfOutput', 'paInput', 'circuitPower', 'totalPower', 'scopeStatus'],
  T2: ['energyKnobs', 'paPower', 'handoverEnergy', 'handoverCount', 'radioEnergy', 'totalEnergy', 'runEe', 'lowSinr'],
  T3: ['bandwidth', 'reuseFactor', 'load', 'sinr', 'throughput', 'data', 'serviceStatus', 'servingBeam', 'sourceKind'],
  T4: ['beforeParams', 'afterParams', 'dataT4', 'energyT4', 'simulationClock', 'playbackState', 'resetAction'],
  T5: ['explicitStateStatus', 'baselineArm', 'candidateArm', 'comparison'],
  T6: ['producerStatus', 'systemPower', 'instantaneousEe', 'perUserContributionSum', 'ratioOfSums', 'sampleWindow', 'actualRf', 'ratedRf', 'serviceBeam', 'frameSimTime', 'evaluationData', 'evaluationEnergy'],
};

const FIELD_LABELS: Record<string, string> = {
  windowId: '量測窗口 ID',
  durationSec: '窗口時間',
  changedInput: '改變的輸入',
  changedControls: '改變的控制值',
  unchangedInputs: '固定的輸入',
  paEfficiency: 'ηPA',
  rfOutput: 'P_RF 發射功率',
  paInput: 'P_PA 放大器輸入',
  circuitPower: 'P_circuit 電路功率',
  totalPower: 'P_total 總功率',
  scopeStatus: '資料範圍',
  energyKnobs: '能源參數',
  paPower: 'PA 功率',
  handoverEnergy: '換手能耗',
  handoverCount: '換手次數',
  radioEnergy: '無線電累積能耗',
  totalEnergy: '總能耗',
  runEe: '整段累積效率',
  lowSinr: '低 SINR 比例',
  bandwidth: '頻寬 B',
  reuseFactor: '頻率重用 K',
  load: '固定負載 U',
  sinr: '固定 SINR',
  throughput: '固定條件速率',
  data: '固定條件資料量',
  serviceStatus: '服務狀態',
  servingBeam: '服務波束',
  sourceKind: '資料來源',
  beforeParams: '復原前參數',
  afterParams: '復原後參數',
  dataT4: '復原後資料量',
  energyT4: '復原後能耗',
  simulationClock: '模擬時間',
  playbackState: '播放狀態',
  resetAction: '重設動作',
  explicitStateStatus: '比較狀態',
  baselineArm: '50 dBm 基準 arm',
  candidateArm: '35 dBm 候選 arm',
  comparison: '比較結果',
  producerStatus: 'Producer 狀態',
  systemPower: 'P_sys 系統功率',
  instantaneousEe: 'EE_inst 瞬時效率',
  perUserContributionSum: 'Σ 貢獻總和',
  ratioOfSums: 'EE_eval 比例和效率',
  sampleWindow: '取樣窗口',
  actualRf: '實際 RF 輸出',
  ratedRf: '額定 RF 上限',
  serviceBeam: '服務波束',
  frameSimTime: 'Producer frame 時間',
  evaluationData: 'EE_eval 資料量',
  evaluationEnergy: 'EE_eval 能量',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function displayValue(value: unknown, absenceReason?: string): string {
  if (value === null || value === undefined || value === '') {
    return absenceReason ? `— (${absenceReason})` : '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function downloadText(filename: string, mimeType: string, text: string): void {
  const href = `data:${mimeType},${encodeURIComponent(text)}`;
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function ExperimentRecordCard({ record }: ExperimentRecordCardProps) {
  if (!record) return null;

  const validation = validateExperimentRecord(record);
  const absenceReasons = record.fieldAbsenceReasons;
  const entries = Object.entries(record) as Array<[string, ExperimentRecordScalar | object | undefined]>;
  const primaryKeys = new Set<string>([
    ...SHARED_PRIMARY_FIELDS,
    ...TASK_PRIMARY_FIELDS[record.taskId],
  ]);
  const primaryEntries = entries.filter(([key]) => primaryKeys.has(key));
  const secondaryEntries = entries.filter(([key]) => !primaryKeys.has(key));

  const handleDownloadJson = () => {
    if (!validation.valid) return;
    downloadText(
      `experiment-record-${record.experimentId || 'unknown'}-${record.windowId || 'unknown'}.json`,
      'application/json;charset=utf-8',
      experimentRecordToJson(record),
    );
  };

  const handleDownloadCsv = () => {
    if (!validation.valid) return;
    downloadText(
      `experiment-record-${record.experimentId || 'unknown'}-${record.windowId || 'unknown'}.csv`,
      'text/csv;charset=utf-8',
      experimentRecordToCsv(record),
    );
  };

  return (
    <section
      className="leo-info-panel__card"
      data-testid="experiment-record-card"
      data-record-valid={validation.valid ? 'true' : 'false'}
      style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--leo-surface-subtle)', borderRadius: '8px' }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--leo-text-primary)' }}>
        實驗紀錄 · {record.taskId}
      </h3>
      <div
        data-testid="experiment-record-primary-fields"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(10rem, 0.85fr) minmax(10rem, 1.15fr)', gap: '9px 12px', fontSize: '14px', color: 'var(--leo-text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}
      >
        {primaryEntries.map(([key, value]) => (
          <div key={key} style={{ display: 'contents' }}>
            <span style={{ color: 'var(--leo-text-muted)', overflowWrap: 'anywhere' }}>{fieldLabel(key)}</span>
            <span data-record-field={key} style={{ overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums', color: 'var(--leo-text-primary)' }}>
              {displayValue(value, absenceReasons[key])}
            </span>
          </div>
        ))}
      </div>
      <details data-testid="experiment-record-full-details" style={{ marginBottom: '16px' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--leo-text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
          完整 schema 欄位（JSON/CSV 會保留全部）
        </summary>
        <div
          data-testid="experiment-record-fields"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(9rem, 0.8fr) minmax(12rem, 1.2fr)', gap: '6px 10px', fontSize: '12px', color: 'var(--leo-text-secondary)', marginTop: '10px', lineHeight: 1.35 }}
        >
          {secondaryEntries.map(([key, value]) => (
            <div key={key} style={{ display: 'contents' }}>
              <span style={{ color: 'var(--leo-text-muted)', overflowWrap: 'anywhere' }}>{fieldLabel(key)}</span>
              <span data-record-field={key} style={{ overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>
                {displayValue(value, absenceReasons[key])}
              </span>
            </div>
          ))}
        </div>
      </details>
      {!validation.valid && (
        <div data-testid="experiment-record-export-error" style={{ color: 'var(--leo-warning)', fontSize: '12px', marginBottom: '8px' }}>
          無法匯出：{validation.errors.join(', ')}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          onClick={handleDownloadJson}
          disabled={!validation.valid}
          data-testid="download-record-json"
          style={{ padding: '8px', backgroundColor: 'var(--leo-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: validation.valid ? 'pointer' : 'not-allowed' }}
        >
          下載 JSON 紀錄
        </button>
        <button
          type="button"
          onClick={handleDownloadCsv}
          disabled={!validation.valid}
          data-testid="download-record-csv"
          style={{ padding: '8px', backgroundColor: 'var(--leo-surface-card)', color: 'var(--leo-text-primary)', border: '1px solid var(--leo-border)', borderRadius: '4px', cursor: validation.valid ? 'pointer' : 'not-allowed' }}
        >
          下載 CSV 紀錄
        </button>
      </div>
    </section>
  );
}
