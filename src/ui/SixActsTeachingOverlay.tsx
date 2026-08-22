import type { ReactElement } from 'react';

import type {
  SixActsCommittedHandover,
  SixActsFrameFacts,
} from '../course/sixActs/liveReplayBridge';
import type { SixActsSubtitleBeat } from '../course/sixActs/subtitleStateMachine';

export interface SixActsTeachingReceipt {
  readonly commit: SixActsCommittedHandover;
  /** The live frame in which this commit first reached the teaching surface. */
  readonly simTimeSec: number;
  readonly hoCount: number;
}

export interface SixActsTeachingOverlayProps {
  readonly beat: SixActsSubtitleBeat;
  readonly facts: SixActsFrameFacts;
  readonly trace: readonly SixActsFrameFacts[];
  readonly offsetDb: number;
  readonly tttSec: number;
  readonly receipt: SixActsTeachingReceipt | null;
}

export type SixActsTraceSeries = 'serving' | 'candidate' | 'threshold';

export interface SixActsTraceDomain {
  readonly minDb: number;
  readonly maxDb: number;
}

interface SixActsTracePoint {
  readonly index: number;
  readonly value: number | null;
}

export interface SixActsTracePathOptions {
  readonly width?: number;
  readonly height?: number;
  readonly padding?: number;
  readonly domain?: SixActsTraceDomain;
}

const TRACE_WIDTH = 320;
const TRACE_HEIGHT = 112;
const TRACE_PADDING = 12;

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function sixActsTttProgress(triggerProgressSec: number, tttSec: number): number {
  return tttSec > 0 ? clamp01(triggerProgressSec / tttSec) : 0;
}

export function sixActsCandidateDeltaDb(facts: SixActsFrameFacts): number | null {
  if (!finite(facts.servingSinrDb) || !finite(facts.candidateSinrDb)) return null;
  return facts.candidateSinrDb - facts.servingSinrDb;
}

export type SixActsCandidateDecision = 'none' | 'eliminated' | 'ttt' | 'qualified';

export function sixActsCandidateDecision(
  facts: SixActsFrameFacts,
  offsetDb: number,
): SixActsCandidateDecision {
  if (facts.candidateSatelliteId === null) return 'none';
  const deltaDb = sixActsCandidateDeltaDb(facts);
  if (deltaDb === null || deltaDb < offsetDb) return 'eliminated';
  return facts.triggerProgressSec > 0 ? 'ttt' : 'qualified';
}

export function resolveSixActsTraceDomain(
  trace: readonly SixActsFrameFacts[],
  offsetDb: number,
): SixActsTraceDomain {
  const values = trace.flatMap(facts => {
    const candidate = finite(facts.candidateSinrDb) ? [facts.candidateSinrDb] : [];
    const serving = finite(facts.servingSinrDb)
      ? [facts.servingSinrDb, facts.servingSinrDb + offsetDb]
      : [];
    return [...serving, ...candidate];
  });
  if (values.length === 0) return { minDb: -1, maxDb: 1 };
  const minDb = Math.min(...values);
  const maxDb = Math.max(...values);
  const span = Math.max(1, maxDb - minDb);
  const margin = span * 0.12;
  return { minDb: minDb - margin, maxDb: maxDb + margin };
}

function seriesValue(
  facts: SixActsFrameFacts,
  series: SixActsTraceSeries,
  offsetDb: number,
): number | null {
  if (series === 'serving') return facts.servingSinrDb;
  if (series === 'candidate') return facts.candidateSinrDb;
  return finite(facts.servingSinrDb) ? facts.servingSinrDb + offsetDb : null;
}

function coordinateFor(
  point: SixActsTracePoint,
  length: number,
  domain: SixActsTraceDomain,
  width: number,
  height: number,
  padding: number,
): string {
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  const x = padding + (length <= 1 ? usableWidth / 2 : (point.index / (length - 1)) * usableWidth);
  const normalized = (point.value! - domain.minDb) / Math.max(0.001, domain.maxDb - domain.minDb);
  const y = height - padding - clamp01(normalized) * usableHeight;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

export function buildSixActsTracePath(
  trace: readonly SixActsFrameFacts[],
  series: SixActsTraceSeries,
  offsetDb: number,
  options: SixActsTracePathOptions = {},
): string {
  if (trace.length === 0) return '';
  const width = options.width ?? TRACE_WIDTH;
  const height = options.height ?? TRACE_HEIGHT;
  const padding = options.padding ?? TRACE_PADDING;
  const domain = options.domain ?? resolveSixActsTraceDomain(trace, offsetDb);
  const points: SixActsTracePoint[] = trace.map((facts, index) => ({
    index,
    value: seriesValue(facts, series, offsetDb),
  }));
  const segments: string[] = [];
  let segment: string[] = [];
  for (const point of points) {
    if (!finite(point.value)) {
      if (segment.length > 0) segments.push(`M ${segment.join(' L ')}`);
      segment = [];
      continue;
    }
    segment.push(coordinateFor(point, trace.length, domain, width, height, padding));
  }
  if (segment.length > 0) segments.push(`M ${segment.join(' L ')}`);
  return segments.join(' ');
}

export function buildSixActsShadowBandPath(
  trace: readonly SixActsFrameFacts[],
  offsetDb: number,
  options: SixActsTracePathOptions = {},
): string {
  if (trace.length === 0) return '';
  const width = options.width ?? TRACE_WIDTH;
  const height = options.height ?? TRACE_HEIGHT;
  const padding = options.padding ?? TRACE_PADDING;
  const domain = options.domain ?? resolveSixActsTraceDomain(trace, offsetDb);
  const lower: SixActsTracePoint[] = [];
  const upper: SixActsTracePoint[] = [];
  trace.forEach((facts, index) => {
    const serving = seriesValue(facts, 'serving', offsetDb);
    if (!finite(serving)) return;
    lower.push({ index, value: serving });
    upper.push({ index, value: serving + offsetDb });
  });
  if (lower.length < 2) return '';
  const lowerPath = lower.map(point => coordinateFor(point, trace.length, domain, width, height, padding));
  const upperPath = [...upper].reverse().map(point => coordinateFor(point, trace.length, domain, width, height, padding));
  return `M ${lowerPath.join(' L ')} L ${upperPath.join(' L ')} Z`;
}

function formatDb(value: number | null): string {
  return finite(value) ? `${value.toFixed(1)} dB` : '—';
}

function formatSatellite(value: string | null): string {
  return value ?? '尚未附著';
}

function candidateDecisionLabel(decision: SixActsCandidateDecision): string {
  if (decision === 'none') return '等待候選';
  if (decision === 'eliminated') return '未達 offset · 保留觀察';
  if (decision === 'ttt') return '已跨過 offset · TTT 累積';
  return '已跨過 offset · 等待 TTT';
}

function toneForDecision(decision: SixActsCandidateDecision): string {
  if (decision === 'eliminated') return 'is-warn';
  if (decision === 'ttt' || decision === 'qualified') return 'is-good';
  return 'is-neutral';
}

function TttRing({ progress, tttSec }: { readonly progress: number; readonly tttSec: number }): ReactElement {
  const radius = 25;
  return (
    <div className="leo-six-acts-ttt" data-testid="six-acts-ttt-ring">
      <svg viewBox="0 0 64 64" role="img" aria-label={`TTT ${Math.round(progress * 100)} percent`}>
        <circle className="leo-six-acts-ttt__track" cx="32" cy="32" r={radius} />
        <circle
          className="leo-six-acts-ttt__progress"
          cx="32"
          cy="32"
          r={radius}
          pathLength="1"
          style={{ strokeDasharray: '1', strokeDashoffset: String(1 - progress) }}
        />
        <text x="32" y="30" textAnchor="middle" className="leo-six-acts-ttt__value">
          {Math.round(progress * 100)}%
        </text>
        <text x="32" y="41" textAnchor="middle" className="leo-six-acts-ttt__unit">TTT</text>
      </svg>
      <span>{(progress * tttSec).toFixed(1)} / {tttSec.toFixed(1)} s</span>
    </div>
  );
}

function SinrTrace({ trace, offsetDb }: { readonly trace: readonly SixActsFrameFacts[]; readonly offsetDb: number }): ReactElement {
  const domain = resolveSixActsTraceDomain(trace, offsetDb);
  return (
    <div className="leo-six-acts-trace" data-testid="six-acts-sinr-trace">
      <div className="leo-six-acts-trace__heading">
        <span>SINR live trace</span>
        <em>{offsetDb.toFixed(1)} dB policy band</em>
      </div>
      <svg
        viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`}
        role="img"
        aria-label={`Serving and candidate SINR trace with a ${offsetDb.toFixed(1)} dB shadow band`}
      >
        <path
          className="leo-six-acts-trace__band"
          d={buildSixActsShadowBandPath(trace, offsetDb, { domain })}
        />
        <path
          className="leo-six-acts-trace__threshold"
          d={buildSixActsTracePath(trace, 'threshold', offsetDb, { domain })}
        />
        <path
          className="leo-six-acts-trace__serving"
          d={buildSixActsTracePath(trace, 'serving', offsetDb, { domain })}
        />
        <path
          className="leo-six-acts-trace__candidate"
          d={buildSixActsTracePath(trace, 'candidate', offsetDb, { domain })}
        />
      </svg>
      <div className="leo-six-acts-trace__legend" aria-hidden="true">
        <span><i className="is-serving" /> serving</span>
        <span><i className="is-candidate" /> candidate</span>
        <span><i className="is-band" /> offset</span>
      </div>
    </div>
  );
}

function Receipt({ receipt }: { readonly receipt: SixActsTeachingReceipt }): ReactElement {
  const { commit } = receipt;
  return (
    <section className="leo-six-acts-receipt" data-testid="six-acts-handover-receipt">
      <div className="leo-six-acts-receipt__heading">
        <span>⑦ RECEIPT · LIVE EVENT</span>
        <strong>Handover #{receipt.hoCount}</strong>
      </div>
      <div className="leo-six-acts-receipt__route">
        <b>{formatSatellite(commit.fromSatelliteId)}</b>
        <span aria-hidden="true">→</span>
        <b>{formatSatellite(commit.toSatelliteId)}</b>
      </div>
      <dl>
        <div><dt>ΔSINR</dt><dd>{formatDb(commit.deltaDb)}</dd></div>
        <div><dt>commit frame</dt><dd>t={receipt.simTimeSec.toFixed(1)} s</dd></div>
        <div><dt>action</dt><dd>{commit.action}</dd></div>
      </dl>
      <p>收據只列出引擎已提交的事件欄位；中斷與訊令成本尚未由此 frame 提供。</p>
    </section>
  );
}

export function SixActsTeachingOverlay({
  beat,
  facts,
  trace,
  offsetDb,
  tttSec,
  receipt,
}: SixActsTeachingOverlayProps): ReactElement {
  const decision = sixActsCandidateDecision(facts, offsetDb);
  const deltaDb = sixActsCandidateDeltaDb(facts);
  const progress = sixActsTttProgress(facts.triggerProgressSec, tttSec);
  return (
    <div
      className="leo-six-acts-cinema-overlay"
      data-testid="six-acts-cinema-overlay"
      data-six-acts-beat={beat}
    >
      <section className="leo-six-acts-decision" data-testid="six-acts-candidate-overlay">
        <div className="leo-six-acts-cinema-card__heading">
          <span>④ CANDIDATE ELIMINATION</span>
          <em className={toneForDecision(decision)}>{candidateDecisionLabel(decision)}</em>
        </div>
        <div className="leo-six-acts-decision__pair">
          <div>
            <small>SERVING</small>
            <strong>{formatSatellite(facts.servingSatelliteId)}</strong>
            <span>{formatDb(facts.servingSinrDb)}</span>
          </div>
          <div className="leo-six-acts-decision__operator" aria-hidden="true">vs</div>
          <div>
            <small>CANDIDATE</small>
            <strong>{formatSatellite(facts.candidateSatelliteId)}</strong>
            <span>{formatDb(facts.candidateSinrDb)}</span>
          </div>
        </div>
        <dl className="leo-six-acts-decision__metrics">
          <div><dt>ΔSINR</dt><dd>{formatDb(deltaDb)}</dd></div>
          <div><dt>offset</dt><dd>{offsetDb.toFixed(1)} dB</dd></div>
        </dl>
      </section>

      <section className="leo-six-acts-cinema-card leo-six-acts-cinema-card--ttt" data-testid="six-acts-ttt-overlay">
        <div className="leo-six-acts-cinema-card__heading">
          <span>⑤ TIME-TO-TRIGGER</span>
          <em>{facts.candidateSatelliteId === null ? 'no pending target' : 'engine progress'}</em>
        </div>
        <TttRing progress={progress} tttSec={tttSec} />
      </section>

      <SinrTrace trace={trace} offsetDb={offsetDb} />

      {receipt === null ? null : <Receipt receipt={receipt} />}
    </div>
  );
}
