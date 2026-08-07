/**
 * Shared classroom record contract.  App is the producer of this shape and
 * the record card/exporter are consumers; task-specific values stay typed so a
 * worksheet can be recomputed without scraping rendered labels.
 */

export type ExperimentTaskId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export type ExperimentRecordScalar = string | number | boolean | null;

export type ExperimentRecordFieldMap = Readonly<Record<string, ExperimentRecordScalar>>;

export type ExperimentRecordUserRow = ExperimentRecordFieldMap;

export interface ExperimentRecord {
  readonly schemaVersion: 't1-t6-experiment-record-v1';
  readonly taskId: ExperimentTaskId;
  readonly experimentId: string;
  readonly runId: string;
  readonly captureIndex: number;
  readonly capturedAtIso: string;
  readonly scenarioIdentity: string;
  readonly profileIdentity: string;
  readonly sceneSource: string;
  readonly sceneLane: string;
  readonly windowId: string;
  readonly windowStartSec: number;
  readonly windowEndSec: number;
  readonly durationSec: number;
  readonly changedInput: string | null;
  readonly unchangedInputs: string | null;
  readonly changedControls: ExperimentRecordFieldMap;
  readonly unchangedControls: ExperimentRecordFieldMap;
  readonly fieldAbsenceReasons: Readonly<Record<string, string>>;
  readonly units: Readonly<Record<string, string>> | null;
  readonly absenceReason: string | null;
  readonly interpretation: string | null;
  readonly tradeoff: string | null;
  readonly limitation: string | null;

  // T1 — teaching RF/PA/circuit/total power chain.
  readonly paEfficiency: number | null;
  readonly rfOutput: number | null;
  readonly paInput: number | null;
  readonly circuitPower: number | null;
  readonly totalPower: number | null;
  readonly scopeStatus: string | null;

  // T2 — energy ledger, handover cost and quality guardrail.
  readonly energyKnobs: ExperimentRecordFieldMap | null;
  readonly paPower: number | null;
  readonly handoverEnergy: number | null;
  readonly handoverCount: number | null;
  readonly radioEnergy: number | null;
  readonly totalEnergy: number | null;
  readonly runEe: number | null;
  readonly lowSinr: number | null;

  // T3 — fixed U=1, SINR=0 dB B/K fixture.  There is intentionally no
  // transmit-power field in this task contract.
  readonly bandwidth: number | null;
  readonly reuseFactor: number | null;
  readonly load: number | null;
  readonly sinr: number | null;
  readonly throughput: number | null;
  readonly data: number | null;
  readonly serviceStatus: string | null;
  readonly servingSatellite: string | null;
  readonly servingCell: string | null;
  readonly servingBeam: string | null;
  readonly sourceKind: string | null;

  // T4 — explicit restart-vs-restore action and parameter snapshots.
  readonly beforeParams: ExperimentRecordFieldMap | null;
  readonly afterParams: ExperimentRecordFieldMap | null;
  readonly dataT4: number | null;
  readonly energyT4: number | null;
  readonly windowIdT4: string | null;
  readonly simulationClock: number | null;
  readonly playbackState: string | null;
  readonly resetAction: string | null;

  // T5 — actual 50/35 dBm arm evidence and gated verdict.
  readonly explicitStateStatus: string | null;
  readonly baselineArm: ExperimentRecordFieldMap | null;
  readonly candidateArm: ExperimentRecordFieldMap | null;
  readonly comparison: ExperimentRecordFieldMap | null;

  // T6 — canonical producer values, with actual/rated RF kept separate.
  readonly producerStatus: string | null;
  readonly systemPower: number | null;
  readonly instantaneousEe: number | null;
  readonly perUserContributionSum: number | null;
  readonly ratioOfSums: number | null;
  readonly sampleWindow: string | null;
  readonly actualRf: number | null;
  readonly ratedRf: number | null;
  readonly serviceBeam: string | null;
  readonly frameSimTime: number | null;
  readonly evaluationData: number | null;
  readonly evaluationEnergy: number | null;
  readonly perUserContributions: readonly ExperimentRecordUserRow[] | null;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function collectNonFinite(value: unknown, path: string, errors: string[]): void {
  if (typeof value === 'number') {
    if (!isFiniteNumber(value)) errors.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNonFinite(item, `${path}[${index}]`, errors));
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => collectNonFinite(item, `${path}.${key}`, errors));
  }
}

/** Returns every non-finite path; an empty list is required before export. */
export function findExperimentRecordNonFiniteFields(record: ExperimentRecord): string[] {
  const errors: string[] = [];
  collectNonFinite(record, 'record', errors);
  return errors;
}

export function validateExperimentRecord(record: ExperimentRecord): { valid: boolean; errors: readonly string[] } {
  const errors = findExperimentRecordNonFiniteFields(record);
  if (!record.experimentId) errors.push('record.experimentId');
  if (!record.runId) errors.push('record.runId');
  if (!record.capturedAtIso) errors.push('record.capturedAtIso');
  if (record.windowEndSec < record.windowStartSec) errors.push('record.windowEndSec');
  if (record.durationSec < 0) errors.push('record.durationSec');
  return { valid: errors.length === 0, errors };
}

export function experimentRecordToJson(record: ExperimentRecord): string {
  const validation = validateExperimentRecord(record);
  if (!validation.valid) {
    throw new Error(`Experiment record is not exportable: ${validation.errors.join(', ')}`);
  }
  return JSON.stringify(record, null, 2);
}

function csvCell(value: ExperimentRecordScalar): string {
  if (value === null) return '';
  const text = typeof value === 'string' ? value : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function flattenRecordValue(path: string, value: unknown, rows: Array<[string, ExperimentRecordScalar]>): void {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    rows.push([path, value]);
    return;
  }
  if (Array.isArray(value)) {
    rows.push([path, JSON.stringify(value)]);
    return;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => flattenRecordValue(`${path}.${key}`, item, rows));
  }
}

/** Two-column long CSV preserves every scalar field and nested worksheet row. */
export function experimentRecordToCsv(record: ExperimentRecord): string {
  const validation = validateExperimentRecord(record);
  if (!validation.valid) {
    throw new Error(`Experiment record is not exportable: ${validation.errors.join(', ')}`);
  }
  const rows: Array<[string, ExperimentRecordScalar]> = [];
  flattenRecordValue('record', record, rows);
  return [
    'field,value',
    ...rows.map(([field, value]) => `${csvCell(field)},${csvCell(value)}`),
    '',
  ].join('\n');
}
