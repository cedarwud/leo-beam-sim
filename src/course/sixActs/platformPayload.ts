/**
 * Platform payload construction for Act 6.
 *
 * The wire shape is fixed by the historical exporter
 * (`upload_baseline_modqn_platform.py`): one flat `data[]` of
 * `{type, channel, value, timestamp}` objects. This module owns the mapping
 * from run telemetry to that shape, the documented numeric bounds, and the
 * local JSON/CSV export — nothing here performs I/O.
 *
 * Only the five historical series are modelled. The energy-efficiency fields
 * (`TOTAL_ENERGY_J`, `DELIVERED_DATA_MBIT`, `RUN_EE_MBIT_PER_J`) are P1: they
 * are blocked on platform-owner registration, and shipping them as if they were
 * live would be the exact dishonesty the proposal's boundary rules forbid.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M3).
 */

import type { SixActsOneHzSample, SixActsRunSummary } from './runSummary';

export const SIX_ACTS_PLATFORM_API_BASE = 'https://edu.nthu-smart-farming.kits.tw/api/api' as const;

/** Documented `CURRENT_SINR` range from the platform field spec, in dB. */
export const SIX_ACTS_PLATFORM_SINR_MIN_DB = -60;
export const SIX_ACTS_PLATFORM_SINR_MAX_DB = 60;

/**
 * The line that must stay on screen for the whole of Act 6.
 * A 200 is an acknowledgement of receipt and nothing more.
 */
export const SIX_ACTS_PLATFORM_HONESTY_NOTE =
  'HTTP 200 只代表平台已接收，不代表已持久化或可回查。只有回讀驗證才是證據。';

/** How much we actually know about a field's registration on the remote. */
export type SixActsFieldRegistrationStatus =
  /** Uploaded successfully in 2026-05; remote registration not re-verified since. */
  | 'CURRENT_UNVERIFIED'
  /** Present in the platform spec but needs the owner to confirm current state. */
  | 'OWNER_CONFIRMATION_REQUIRED';

export type SixActsPlatformSeriesId =
  | 'serving-sinr'
  | 'candidate-sinr'
  | 'sinr-gain'
  | 'handover-event'
  | 'low-sinr-ratio';

export type SixActsPlatformCadence = 'one-hz' | 'run-end';

export interface SixActsPlatformSeriesSpec {
  readonly id: SixActsPlatformSeriesId;
  /** `data[].type` on the wire. */
  readonly fieldType: 'CURRENT_SINR' | 'HANDOVER_EVENT' | 'LOW_SINR_RATIO';
  readonly channel: number;
  readonly cadence: SixActsPlatformCadence;
  readonly unit: string;
  readonly registrationStatus: SixActsFieldRegistrationStatus;
  /** Shown beside the student's tick box — why this is worth uploading. */
  readonly whyUpload: string;
  /** A caveat the drawer must show with the field, or null when there is none. */
  readonly caveat: string | null;
}

export const SIX_ACTS_PLATFORM_SERIES: readonly SixActsPlatformSeriesSpec[] = Object.freeze([
  Object.freeze({
    id: 'serving-sinr',
    fieldType: 'CURRENT_SINR',
    channel: 0,
    cadence: 'one-hz',
    unit: 'dB',
    registrationStatus: 'CURRENT_UNVERIFIED',
    whyUpload: '服務衛星的連線品質曲線——平台圖上換手前的交叉就是從這條看出來的。',
    caveat: null,
  }),
  Object.freeze({
    id: 'candidate-sinr',
    fieldType: 'CURRENT_SINR',
    channel: 1,
    cadence: 'one-hz',
    unit: 'dB',
    registrationStatus: 'CURRENT_UNVERIFIED',
    whyUpload: '最佳候選衛星的品質——用於判定候選與服務鏈路的換手條件。',
    caveat: null,
  }),
  Object.freeze({
    id: 'sinr-gain',
    fieldType: 'CURRENT_SINR',
    channel: 2,
    cadence: 'one-hz',
    unit: 'dB',
    registrationStatus: 'CURRENT_UNVERIFIED',
    whyUpload: '候選減服務，就是 3 dB 條件在看的那個量。',
    caveat: null,
  }),
  Object.freeze({
    id: 'handover-event',
    fieldType: 'HANDOVER_EVENT',
    channel: 0,
    cadence: 'one-hz',
    unit: 'event',
    registrationStatus: 'CURRENT_UNVERIFIED',
    whyUpload: '在時間軸上標出每一次換手，跟品質曲線對得起來。',
    caveat: null,
  }),
  Object.freeze({
    id: 'low-sinr-ratio',
    fieldType: 'LOW_SINR_RATIO',
    channel: 0,
    cadence: 'run-end',
    unit: '%',
    registrationStatus: 'CURRENT_UNVERIFIED',
    whyUpload: '整場連線的低 SINR 比例——低功率區間的量測證據。',
    caveat: '欄位規格是每場結束 1 筆；2026-05 的歷史腳本曾每秒上傳，課堂採規格版。',
  }),
]);

export function getSixActsPlatformSeries(id: SixActsPlatformSeriesId): SixActsPlatformSeriesSpec {
  const spec = SIX_ACTS_PLATFORM_SERIES.find(candidate => candidate.id === id);
  if (spec === undefined) throw new RangeError(`unknown platform series ${id}`);
  return spec;
}

export interface SixActsPlatformDatum {
  readonly type: SixActsPlatformSeriesSpec['fieldType'];
  readonly channel: number;
  readonly value: number;
  /** UTC milliseconds, as the historical exporter sends. */
  readonly timestamp: number;
}

export interface SixActsPlatformPayload {
  readonly data: readonly SixActsPlatformDatum[];
}

export interface SixActsPayloadBuildResult {
  readonly payload: SixActsPlatformPayload;
  /** SINR values that hit a documented bound. Surfaced, never silent. */
  readonly clampedValueCount: number;
  /** Seconds the UE spent unattached, reported at the SINR floor. */
  readonly unattachedSecondCount: number;
  readonly seriesCounts: Readonly<Record<SixActsPlatformSeriesId, number>>;
}

/**
 * Two decimals, then clamped to the documented range.
 *
 * The historical Python exporter used `round(x, 2)` (half-to-even); this is
 * half-away-from-zero. They agree on every value whose double is not exactly on
 * a hundredth's midpoint, which is the normal case for a computed SINR, and the
 * platform quantizes to 0.1 dB regardless. The difference is recorded here
 * rather than papered over.
 */
function platformSinrValue(valueDb: number): { value: number; clamped: boolean } {
  const rounded = Math.round(valueDb * 100) / 100;
  if (rounded < SIX_ACTS_PLATFORM_SINR_MIN_DB) {
    return { value: SIX_ACTS_PLATFORM_SINR_MIN_DB, clamped: true };
  }
  if (rounded > SIX_ACTS_PLATFORM_SINR_MAX_DB) {
    return { value: SIX_ACTS_PLATFORM_SINR_MAX_DB, clamped: true };
  }
  return { value: rounded, clamped: false };
}

function emptyCounts(): Record<SixActsPlatformSeriesId, number> {
  return {
    'serving-sinr': 0,
    'candidate-sinr': 0,
    'sinr-gain': 0,
    'handover-event': 0,
    'low-sinr-ratio': 0,
  };
}

/**
 * Builds the per-second half of the payload.
 *
 * An unattached second is reported at the documented SINR floor rather than
 * omitted: a gap in the chart reads as "no data", while the floor plus the
 * returned `unattachedSecondCount` reads as "the link was down", which is what
 * actually happened and what Act 5 is teaching.
 */
export function buildSixActsOneHzPayload(
  samples: readonly SixActsOneHzSample[],
  selected: readonly SixActsPlatformSeriesId[],
): SixActsPayloadBuildResult {
  const active = SIX_ACTS_PLATFORM_SERIES.filter(
    spec => spec.cadence === 'one-hz' && selected.includes(spec.id),
  );
  const data: SixActsPlatformDatum[] = [];
  const seriesCounts = emptyCounts();
  let clampedValueCount = 0;
  let unattachedSecondCount = 0;

  for (const sample of samples) {
    if (!sample.attached) unattachedSecondCount += 1;
    for (const spec of active) {
      let raw: number | null;
      if (spec.id === 'serving-sinr') raw = sample.currentSinrDb ?? SIX_ACTS_PLATFORM_SINR_MIN_DB;
      else if (spec.id === 'candidate-sinr') raw = sample.bestCandidateSinrDb;
      else if (spec.id === 'sinr-gain') raw = sample.sinrGainDb;
      else raw = sample.handoverEvent;

      if (raw === null) continue;

      let value = raw;
      if (spec.fieldType === 'CURRENT_SINR') {
        const coerced = platformSinrValue(raw);
        value = coerced.value;
        if (coerced.clamped) clampedValueCount += 1;
      }
      data.push(Object.freeze({
        type: spec.fieldType,
        channel: spec.channel,
        value,
        timestamp: sample.secondEpochMs,
      }));
      seriesCounts[spec.id] += 1;
    }
  }

  return Object.freeze({
    payload: Object.freeze({ data: Object.freeze(data) }),
    clampedValueCount,
    unattachedSecondCount,
    seriesCounts: Object.freeze(seriesCounts),
  });
}

/**
 * Builds the run-end half: one `LOW_SINR_RATIO` sample, per the field spec.
 *
 * The energy-efficiency fields are intentionally absent until the platform
 * owner registers them.
 */
export function buildSixActsRunEndPayload(
  summary: SixActsRunSummary,
  selected: readonly SixActsPlatformSeriesId[],
): SixActsPayloadBuildResult {
  const data: SixActsPlatformDatum[] = [];
  const seriesCounts = emptyCounts();

  if (selected.includes('low-sinr-ratio')) {
    const spec = getSixActsPlatformSeries('low-sinr-ratio');
    data.push(Object.freeze({
      type: spec.fieldType,
      channel: spec.channel,
      value: summary.lowSinrRatioPercent,
      timestamp: summary.endInstantMs,
    }));
    seriesCounts['low-sinr-ratio'] += 1;
  }

  return Object.freeze({
    payload: Object.freeze({ data: Object.freeze(data) }),
    clampedValueCount: 0,
    unattachedSecondCount: 0,
    seriesCounts: Object.freeze(seriesCounts),
  });
}

export function mergeSixActsPayloads(
  ...results: readonly SixActsPayloadBuildResult[]
): SixActsPayloadBuildResult {
  const seriesCounts = emptyCounts();
  const data: SixActsPlatformDatum[] = [];
  let clampedValueCount = 0;
  let unattachedSecondCount = 0;

  for (const result of results) {
    data.push(...result.payload.data);
    clampedValueCount += result.clampedValueCount;
    unattachedSecondCount += result.unattachedSecondCount;
    for (const id of Object.keys(seriesCounts) as SixActsPlatformSeriesId[]) {
      seriesCounts[id] += result.seriesCounts[id];
    }
  }

  return Object.freeze({
    payload: Object.freeze({ data: Object.freeze(data) }),
    clampedValueCount,
    unattachedSecondCount,
    seriesCounts: Object.freeze(seriesCounts),
  });
}

/** Splits a payload into batches no larger than `maxData` samples each. */
export function chunkSixActsPayload(
  payload: SixActsPlatformPayload,
  maxData: number,
): readonly SixActsPlatformPayload[] {
  if (!Number.isInteger(maxData) || maxData <= 0) {
    throw new RangeError('batch size must be a positive whole number of samples');
  }
  const batches: SixActsPlatformPayload[] = [];
  for (let index = 0; index < payload.data.length; index += maxData) {
    batches.push(Object.freeze({ data: Object.freeze(payload.data.slice(index, index + maxData)) }));
  }
  return Object.freeze(batches);
}

/** Exactly what would have gone on the wire, for the offline handout. */
export function serializeSixActsPayloadAsJson(payload: SixActsPlatformPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

const CSV_HEADER = 'type,channel,value,timestamp,iso_utc';

export function serializeSixActsPayloadAsCsv(payload: SixActsPlatformPayload): string {
  const rows = payload.data.map(datum => [
    datum.type,
    String(datum.channel),
    String(datum.value),
    String(datum.timestamp),
    new Date(datum.timestamp).toISOString(),
  ].join(','));
  return `${[CSV_HEADER, ...rows].join('\n')}\n`;
}
