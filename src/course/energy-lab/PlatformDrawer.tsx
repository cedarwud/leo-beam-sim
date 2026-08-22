import { useMemo, useState, type ReactElement } from 'react';

import {
  SIX_ACTS_PLATFORM_HONESTY_NOTE,
  SIX_ACTS_PLATFORM_SERIES,
  buildSixActsOneHzPayload,
  buildSixActsRunEndPayload,
  mergeSixActsPayloads,
  serializeSixActsPayloadAsCsv,
  serializeSixActsPayloadAsJson,
  type SixActsPlatformSeriesId,
} from '../sixActs/platformPayload';
import {
  SIX_ACTS_BATCH_INTERVAL_CHOICES_SEC,
  SIX_ACTS_OFFLINE_MOCK_BADGE,
  SixActsUploadSession,
  buildSixActsReadBackUrls,
  type SixActsLedgerEntry,
} from '../sixActs/platformUpload';
import type { SixActsOneHzSample, SixActsRunSummary } from '../sixActs/runSummary';

/**
 * Act 6 — the platform drawer.
 *
 * The classroom runs it in OFFLINE MOCK: the whole flow walks end to end with
 * no socket, which is both the lecture fallback and the honest default. Live
 * upload needs SMARTFARM_* credentials the browser does not hold, so the drawer
 * says so rather than offering a button that cannot work.
 */

function syntheticOneHz(summary: SixActsRunSummary): readonly SixActsOneHzSample[] {
  const samples: SixActsOneHzSample[] = [];
  for (let second = 0; second < 30; second += 1) {
    const attached = second / 30 >= summary.lowSinrFraction;
    samples.push(Object.freeze({
      secondEpochMs: summary.startInstantMs + second * 1000,
      attached,
      currentSinrDb: attached ? -4 + Math.sin(second / 3) : null,
      bestCandidateSinrDb: -2 + Math.cos(second / 4),
      sinrGainDb: attached ? 2 + Math.cos(second / 4) - Math.sin(second / 3) : null,
      handoverEvent: second === 17 ? 1 : 0,
      sourceSampleCount: 1,
    }));
  }
  return samples;
}

export function PlatformDrawer({ summary, armLabel }: {
  readonly summary: SixActsRunSummary;
  readonly armLabel: string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<readonly SixActsPlatformSeriesId[]>(
    SIX_ACTS_PLATFORM_SERIES.map(spec => spec.id),
  );
  const [batchIntervalSec, setBatchIntervalSec] = useState<30 | 60 | 300>(30);
  const [ledger, setLedger] = useState<readonly SixActsLedgerEntry[]>([]);
  const [readBack, setReadBack] = useState<readonly string[] | null>(null);
  const [jitterSec, setJitterSec] = useState<number | null>(null);

  const built = useMemo(() => mergeSixActsPayloads(
    buildSixActsOneHzPayload(syntheticOneHz(summary), selected),
    buildSixActsRunEndPayload(summary, selected),
  ), [summary, selected]);

  async function runOfflineUpload(): Promise<void> {
    const session = new SixActsUploadSession({
      mode: 'offline-mock',
      credentials: { email: 'offline@mock', password: 'offline', macAddress: 'OFFLINE-MOCK' },
      fetcher: async () => { throw new Error('offline mock must not reach the network'); },
      now: () => Date.now(),
      random: () => Math.random(),
      batchIntervalSec,
    });
    setJitterSec(session.jitterSec);
    await session.uploadBatch(built.payload);
    setLedger(session.ledger);
    setReadBack(buildSixActsReadBackUrls({
      account: 'ntpu-class',
      areaId: 'area-demo',
      groupId: 'group-demo',
      sensorType: 'CURRENT_SINR',
      sensorId: 'sensor-demo',
      fromMs: summary.startInstantMs,
      toMs: summary.endInstantMs,
    }));
  }

  function download(name: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="platform">
      <button type="button" className="platform__toggle" onClick={() => setOpen(value => !value)}>
        {open ? '收起' : '打開'} Platform 抽屜 · ACT 6
      </button>

      {!open ? null : (
        <div className="platform__body">
          <p className="platform__badge">{SIX_ACTS_OFFLINE_MOCK_BADGE}</p>
          <p className="platform__honesty">{SIX_ACTS_PLATFORM_HONESTY_NOTE}</p>

          <h3>勾選要上傳的欄位</h3>
          <ul className="platform__fields">
            {SIX_ACTS_PLATFORM_SERIES.map(spec => (
              <li key={spec.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(spec.id)}
                    onChange={event => setSelected(previous => (event.target.checked
                      ? [...previous, spec.id]
                      : previous.filter(id => id !== spec.id)))}
                  />
                  <span>
                    <strong>{spec.fieldType} ch{spec.channel}</strong>
                    <em>{spec.cadence === 'one-hz' ? '每秒 1 筆' : '每場結束 1 筆'} · {spec.registrationStatus}</em>
                  </span>
                </label>
                <p>{spec.whyUpload}</p>
                {spec.caveat === null ? null : <small>{spec.caveat}</small>}
              </li>
            ))}
          </ul>

          <div className="platform__controls">
            <label>
              <span>批次間隔</span>
              <select value={batchIntervalSec}
                onChange={event => setBatchIntervalSec(Number(event.target.value) as 30 | 60 | 300)}>
                {SIX_ACTS_BATCH_INTERVAL_CHOICES_SEC.map(option => (
                  <option key={option} value={option}>{option} 秒</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { void runOfflineUpload(); }}>
              走一次上傳流程（離線）
            </button>
            <button type="button" onClick={() => download(
              'six-acts-payload.json', serializeSixActsPayloadAsJson(built.payload), 'application/json')}>
              下載 JSON
            </button>
            <button type="button" onClick={() => download(
              'six-acts-payload.csv', serializeSixActsPayloadAsCsv(built.payload), 'text/csv')}>
              下載 CSV
            </button>
          </div>

          <div className="platform__summary">
            <div><dt>arm</dt><dd>{armLabel}</dd></div>
            <div><dt>樣本數</dt><dd>{built.payload.data.length}</dd></div>
            <div><dt>斷線秒數</dt><dd>{built.unattachedSecondCount}</dd></div>
            <div><dt>觸及邊界值</dt><dd>{built.clampedValueCount}</dd></div>
            {jitterSec === null ? null : <div><dt>本組 jitter</dt><dd>{jitterSec.toFixed(1)} s</dd></div>}
          </div>

          <h3>payload 預覽</h3>
          <pre className="platform__payload">
            {JSON.stringify({ data: built.payload.data.slice(0, 4) }, null, 2)}
            {built.payload.data.length > 4 ? `\n… 共 ${built.payload.data.length} 筆` : ''}
          </pre>

          <h3>上傳台帳</h3>
          {ledger.length === 0
            ? <p className="platform__hint">還沒有上傳紀錄。按上面那顆按鈕走一次完整流程。</p>
            : <table className="platform__ledger">
              <thead><tr><th>#</th><th>動作</th><th>筆數</th><th>HTTP</th><th>結果</th><th>說明</th></tr></thead>
              <tbody>
                {ledger.map(entry => (
                  <tr key={entry.sequence}>
                    <td>{entry.sequence}</td>
                    <td>{entry.kind}</td>
                    <td>{entry.sampleCount}</td>
                    <td>{entry.httpStatus ?? '—'}</td>
                    <td className={`is-${entry.outcome}`}>{entry.outcome}</td>
                    <td>{entry.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>}

          {readBack === null ? null : (
            <>
              <h3>回讀驗證</h3>
              <p className="platform__hint">
                200 只代表已接收。真正的證據是照這條 GET 鏈把資料抓回來比對——離線模式下這裡只列出會打的網址。
              </p>
              <ol className="platform__readback">
                {readBack.map(url => <li key={url}><code>{url}</code></li>)}
              </ol>
            </>
          )}

          <p className="platform__blocked">
            正式上傳需要 <code>SMARTFARM_EMAIL / SMARTFARM_PASSWORD / SMARTFARM_MAC</code>，
            由講師端提供；瀏覽器不持有這些憑證，所以這個抽屜不提供「現在上傳」按鈕。
          </p>
        </div>
      )}
    </section>
  );
}
