import type { SixActsFrameFacts } from './liveReplayBridge';

/** The eight on-screen beats from the teaching-cinema handoff. */
export type SixActsSubtitleBeat =
  | 'service'
  | 'decline'
  | 'candidate'
  | 'elimination'
  | 'ttt'
  | 'execute'
  | 'receipt'
  | 'new-normal';

export type SixActsSubtitleTone = 'neutral' | 'serving' | 'candidate' | 'warn' | 'source';

export interface SixActsSubtitlePolicy {
  readonly offsetDb: number;
  readonly tttSec: number;
}

export interface SixActsSubtitleState {
  readonly beat: SixActsSubtitleBeat;
  readonly eyebrow: string;
  readonly text: string;
  readonly tone: SixActsSubtitleTone;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly startedAtSimTimeSec: number;
  readonly lastCommitTimeMs: number | null;
}

export interface SixActsSubtitleStateMachineOptions {
  /** Display-only hold after a live commit before the receipt beat begins. */
  readonly executeBeatDurationSec?: number;
  /** Display-only hold for the receipt beat before the new-normal beat. */
  readonly receiptBeatDurationSec?: number;
  /** Minimum observed SINR drop used to call the decline beat. */
  readonly declineDeltaDb?: number;
}

const DEFAULT_EXECUTE_BEAT_DURATION_SEC = 1.5;
const DEFAULT_RECEIPT_BEAT_DURATION_SEC = 3;
const DEFAULT_DECLINE_DELTA_DB = 0.15;

function formatNumber(value: number | null, digits = 1, suffix = ''): string {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}${suffix}`;
}

function formatSatellite(value: string | null): string {
  return value === null ? '尚未附著' : value;
}

function deltaDb(facts: SixActsFrameFacts): number | null {
  if (facts.servingSinrDb === null || facts.candidateSinrDb === null) return null;
  return facts.candidateSinrDb - facts.servingSinrDb;
}

function baseRows(facts: SixActsFrameFacts): readonly { readonly label: string; readonly value: string }[] {
  return Object.freeze([
    { label: 'Serving', value: formatSatellite(facts.servingSatelliteId) },
    { label: 'SINR', value: formatNumber(facts.servingSinrDb, 1, ' dB') },
  ]);
}

function stateFor(
  beat: SixActsSubtitleBeat,
  facts: SixActsFrameFacts,
  startedAtSimTimeSec: number,
  lastCommitTimeMs: number | null,
  policy: SixActsSubtitlePolicy,
): SixActsSubtitleState {
  const delta = deltaDb(facts);
  const candidate = formatSatellite(facts.candidateSatelliteId);
  const deltaText = formatNumber(delta, 1, ' dB');
  const tttText = `${formatNumber(facts.triggerProgressSec, 1)} / ${formatNumber(policy.tttSec, 1)} s`;

  if (beat === 'decline') {
    return Object.freeze({
      beat,
      eyebrow: '① SERVICE → ② DECLINE',
      text: '服務連線仍在運行；目前 live frame 顯示訊號正在下滑。先檢視幾何與鏈路數值，不將下滑誤判為衛星故障。',
      tone: 'serving',
      rows: Object.freeze([
        ...baseRows(facts),
        { label: 'Option', value: candidate },
      ]),
      startedAtSimTimeSec,
      lastCommitTimeMs,
    });
  }

  if (beat === 'candidate') {
    return Object.freeze({
      beat,
      eyebrow: '③ BEAM OPTION',
      text: '候選連線出現。接下來比較的是同一個 frame 裡的 serving、candidate 與它們的 SINR 差值。',
      tone: 'candidate',
      rows: Object.freeze([
        ...baseRows(facts),
        { label: 'Option', value: candidate },
        { label: 'ΔSINR', value: deltaText },
      ]),
      startedAtSimTimeSec,
      lastCommitTimeMs,
    });
  }

  if (beat === 'elimination') {
    return Object.freeze({
      beat,
      eyebrow: '④ ELIMINATION',
      text: `候選尚未跨過 ${policy.offsetDb.toFixed(1)} dB offset；它被保留為比較對象，但不會被宣告為換手。`,
      tone: 'warn',
      rows: Object.freeze([
        { label: 'Option', value: candidate },
        { label: 'ΔSINR', value: deltaText },
        { label: 'Offset', value: formatNumber(policy.offsetDb, 1, ' dB') },
      ]),
      startedAtSimTimeSec,
      lastCommitTimeMs,
    });
  }

  if (beat === 'ttt') {
    return Object.freeze({
      beat,
      eyebrow: '⑤ TTT',
      text: `候選已跨過 ${policy.offsetDb.toFixed(1)} dB offset；優勢必須持續到 TTT 完成，才會提交跨衛星換手。`,
      tone: 'source',
      rows: Object.freeze([
        { label: 'Option', value: candidate },
        { label: 'ΔSINR', value: deltaText },
        { label: 'TTT', value: tttText },
      ]),
      startedAtSimTimeSec,
      lastCommitTimeMs,
    });
  }

  if (beat === 'execute') {
    const commit = facts.lastCommittedHandover;
    return Object.freeze({
      beat,
      eyebrow: '⑥ EXECUTE',
      text: '跨衛星換手已由 live handover manager 提交；此 beat 只呈現已發生的決策，不回寫模擬狀態。',
      tone: 'source',
      rows: Object.freeze([
        { label: 'From', value: formatSatellite(commit?.fromSatelliteId ?? null) },
        { label: 'To', value: formatSatellite(commit?.toSatelliteId ?? facts.servingSatelliteId) },
        { label: 'ΔSINR', value: formatNumber(commit?.deltaDb ?? delta, 1, ' dB') },
      ]),
      startedAtSimTimeSec,
      lastCommitTimeMs,
    });
  }

  if (beat === 'receipt') {
    const commit = facts.lastCommittedHandover;
    return Object.freeze({
      beat,
      eyebrow: '⑦ RECEIPT',
      text: '收據欄位記錄已提交事件的 source、target 與 SINR 差值；完整事件資料由下一層面板呈現。',
      tone: 'candidate',
      rows: Object.freeze([
        { label: 'From', value: formatSatellite(commit?.fromSatelliteId ?? null) },
        { label: 'To', value: formatSatellite(commit?.toSatelliteId ?? facts.servingSatelliteId) },
        { label: 'ΔSINR', value: formatNumber(commit?.deltaDb ?? delta, 1, ' dB') },
      ]),
      startedAtSimTimeSec,
      lastCommitTimeMs,
    });
  }

  if (beat === 'new-normal') {
    return Object.freeze({
      beat,
      eyebrow: '⑧ NEW NORMAL',
      text: '新服務連線已接手。播放進入正常速率；下一次幾何下滑仍會沿著同一條決策鏈重演。',
      tone: 'serving',
      rows: baseRows(facts),
      startedAtSimTimeSec,
      lastCommitTimeMs,
    });
  }

  return Object.freeze({
    beat: 'service',
    eyebrow: '① SERVICE',
    text: '服務連線正常。先建立 serving link 的基準，再看幾何如何把它推向下一個決策。',
    tone: 'serving',
    rows: baseRows(facts),
    startedAtSimTimeSec,
    lastCommitTimeMs,
  });
}

export function createSixActsSubtitleState(
  facts: SixActsFrameFacts,
  policy: SixActsSubtitlePolicy,
): SixActsSubtitleState {
  return stateFor('service', facts, facts.simTimeSec, null, policy);
}

function isNewInterCommit(
  facts: SixActsFrameFacts,
  previous: SixActsSubtitleState,
): boolean {
  const commit = facts.lastCommittedHandover;
  return commit !== null
    && commit.action === 'inter-handover'
    && commit.fromSatelliteId !== null
    && commit.timeMs !== previous.lastCommitTimeMs;
}

export function advanceSixActsSubtitleState(
  previous: SixActsSubtitleState,
  facts: SixActsFrameFacts,
  policy: SixActsSubtitlePolicy,
  options: SixActsSubtitleStateMachineOptions = {},
): SixActsSubtitleState {
  const executeDurationSec = options.executeBeatDurationSec ?? DEFAULT_EXECUTE_BEAT_DURATION_SEC;
  const receiptDurationSec = options.receiptBeatDurationSec ?? DEFAULT_RECEIPT_BEAT_DURATION_SEC;
  const declineDeltaDbThreshold = options.declineDeltaDb ?? DEFAULT_DECLINE_DELTA_DB;
  const elapsedInBeat = Math.max(0, facts.simTimeSec - previous.startedAtSimTimeSec);

  if (isNewInterCommit(facts, previous)) {
    return stateFor('execute', facts, facts.simTimeSec, facts.lastCommittedHandover!.timeMs, policy);
  }

  if (previous.beat === 'execute' && elapsedInBeat >= executeDurationSec) {
    return stateFor('receipt', facts, facts.simTimeSec, previous.lastCommitTimeMs, policy);
  }

  if (previous.beat === 'receipt' && elapsedInBeat >= receiptDurationSec) {
    return stateFor('new-normal', facts, facts.simTimeSec, previous.lastCommitTimeMs, policy);
  }

  const delta = deltaDb(facts);
  if (facts.candidateSatelliteId !== null && facts.triggerProgressSec > 0) {
    return stateFor('ttt', facts, previous.startedAtSimTimeSec, previous.lastCommitTimeMs, policy);
  }
  if (facts.candidateSatelliteId !== null) {
    return stateFor(
      delta !== null && delta < policy.offsetDb ? 'elimination' : 'candidate',
      facts,
      previous.startedAtSimTimeSec,
      previous.lastCommitTimeMs,
      policy,
    );
  }

  const previousSinr = previous.rows.find(row => row.label === 'SINR')?.value ?? null;
  const currentSinr = facts.servingSinrDb;
  const previousNumeric = previousSinr === null ? null : Number.parseFloat(previousSinr);
  if (
    currentSinr !== null
    && previousNumeric !== null
    && Number.isFinite(previousNumeric)
    && currentSinr <= previousNumeric - declineDeltaDbThreshold
    && facts.servingSatelliteId !== null
  ) {
    return stateFor('decline', facts, previous.startedAtSimTimeSec, previous.lastCommitTimeMs, policy);
  }

  if (previous.beat === 'new-normal') {
    return stateFor('new-normal', facts, previous.startedAtSimTimeSec, previous.lastCommitTimeMs, policy);
  }

  return stateFor('service', facts, previous.startedAtSimTimeSec, previous.lastCommitTimeMs, policy);
}
