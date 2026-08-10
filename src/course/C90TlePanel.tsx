import { useMemo, useRef, useState, type ChangeEvent } from 'react';

import type { TleJourney, TleStage, TleTrajectoryBundle, TleTrajectoryFrame } from './contract';
import {
  advanceTleStage,
  setTleExplanation,
  setTleSourceSelection,
  setTleWindowSelection,
  type CourseSessionState,
} from './session';
import { matchImportedTle } from './tleImport';

interface C90TlePanelProps {
  readonly journey: TleJourney;
  readonly session: CourseSessionState;
  readonly bundle: TleTrajectoryBundle;
  readonly frame: TleTrajectoryFrame;
  readonly onUpdate: (updater: (state: CourseSessionState) => CourseSessionState) => void;
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function signedDuration(seconds: number): string {
  const sign = seconds >= 0 ? '+' : '−';
  const absoluteHours = Math.abs(seconds) / 3600;
  if (absoluteHours >= 48) return `${sign}${(absoluteHours / 24).toFixed(1)} days`;
  return `${sign}${absoluteHours.toFixed(1)} h`;
}

function vector(values: readonly number[], unit: string): string {
  return `[${values.map(value => value.toFixed(2)).join(', ')}] ${unit}`;
}

function stageValues(stage: TleStage, journey: TleJourney, frame: TleTrajectoryFrame, sourceFilename: string, sourceEpoch: string) {
  if (stage.id === 'source') {
    return {
      input: sourceFilename,
      transformation: '讀取被選中物件的 TLE line 1；不使用 archive 檔名推測 epoch',
      output: `epoch ${sourceEpoch}`,
      unit: 'UTC / TLE fields',
    };
  }
  if (stage.id === 'target-time') {
    return {
      input: `epoch ${sourceEpoch} + target ${frame.targetUtc}`,
      transformation: '固定 target UTC；browser now 只作參考，不會暗中取代 target',
      output: `target − epoch = ${signedDuration(frame.ageSeconds)} (${frame.ageSeconds.toLocaleString()} s)`,
      unit: 'UTC / s',
    };
  }
  if (stage.id === 'propagation') {
    return {
      input: 'exact TLE record + selected target UTC',
      transformation: bundleModel(journey, frame),
      output: `${vector(frame.temePositionKm, 'km')} · v ${vector(frame.temeVelocityKmPerSec, 'km/s')}`,
      unit: 'TEME km / km/s',
    };
  }
  if (stage.id === 'ntpu-frame') {
    return {
      input: `TEME state + ${journey.observer.observerId}`,
      transformation: 'producer 預算 Earth-fixed / geodetic / topocentric frame',
      output: `az ${frame.look.azimuthDeg.toFixed(2)}° · el ${frame.look.elevationDeg.toFixed(2)}° · range ${frame.look.rangeKm.toFixed(1)} km · visible ${String(frame.look.visible)}`,
      unit: 'deg / km / boolean',
    };
  }
  return {
    input: `${journey.courseSourceId} + ${frame.frameId}`,
    transformation: '綁定 source / target / observer / producer / scenario identity',
    output: journey.scenario.scenarioId,
    unit: 'versioned fixture identity',
  };
}

function bundleModel(journey: TleJourney, frame: TleTrajectoryFrame): string {
  const bundle = journey.trajectoryBundles.find(candidate => candidate.frames.includes(frame));
  return bundle === undefined ? 'missing producer identity' : `${bundle.model} · ${bundle.producerVersion} · browser 不重算`;
}

export function C90TlePanel({ journey, session, bundle, frame, onUpdate }: C90TlePanelProps) {
  const [importMessage, setImportMessage] = useState('尚未匯入檔案');
  const [copyMessage, setCopyMessage] = useState('');
  const [browserNow] = useState(() => new Date().toISOString());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const source = useMemo(
    () => journey.sources.find(candidate => candidate.sourceId === session.tleSelectedSourceId),
    [journey, session.tleSelectedSourceId],
  );
  if (source === undefined) throw new Error(`C-90 TLE selected source is unavailable: ${session.tleSelectedSourceId}`);
  const stage = journey.stages[session.tleStageIndex];
  if (stage === undefined) throw new Error(`C-90 TLE stage is unavailable: ${session.tleStageIndex}`);
  const values = stageValues(stage, journey, frame, source.filename, source.epochUtc);
  const isLast = session.tleStageIndex === journey.stages.length - 1;
  const isCourseCompatible = source.sourceId === journey.courseSourceId && source.role === 'course-compatible';
  const canComplete = session.tleSourceConfirmed && isCourseCompatible && session.tleExplanation.trim() !== '';
  const selectionLocked = session.e1ArmOrder.length > 0;

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportMessage(`匯入失敗：${file.name} 超過 5 MB classroom limit`);
      event.target.value = '';
      return;
    }
    try {
      const result = matchImportedTle(await file.text(), journey.sources);
      onUpdate(state => setTleSourceSelection(state, result.source.sourceId, 'imported', file.name));
      setImportMessage(`已匹配 ${result.source.objectName} / ${result.source.archiveDate}；檔案共 ${result.importedRecordCount} 筆 record，可立即切換預算 trace。`);
    } catch (error) {
      setImportMessage(`匯入被拒絕：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      event.target.value = '';
    }
  };

  const copyUpdateCommand = async () => {
    try {
      await navigator.clipboard.writeText(journey.updateCommand);
      setCopyMessage('更新指令已複製；請在 server / instructor terminal 執行，再產生新 bundle。');
    } catch {
      setCopyMessage('瀏覽器未允許 clipboard；請手動複製下方唯讀指令。');
    }
  };

  return (
    <div className="c90-panel-stack c90-tle-panel" data-testid="c90-tle-panel">
      <div className="c90-section-header">
        <p className="c90-eyebrow">00–10 · one-time onboarding</p>
        <h2>TLE → target time → NTPU</h2>
        <p className="c90-question">先選來源，再看清 epoch、target 與 now 的角色；只有已有 precomputed bundle 的 record 才能立即渲染。</p>
      </div>

      <section className="c90-tle-paths" aria-labelledby="tle-start-path-title">
        <div className="c90-card-topline"><strong id="tle-start-path-title">選擇開始方式</strong><span>{session.tleSourceConfirmed ? `已確認 · ${session.tleSourceMode}` : '尚未確認來源'}</span></div>
        <div className="c90-tle-path-grid">
          <div className="c90-tle-path">
            <span>01 · archive</span><strong>使用已預算資料</strong><small>選日期與時段，立即 replay。</small>
          </div>
          <label className={`c90-tle-path c90-tle-path--action ${selectionLocked ? 'is-disabled' : ''}`}>
            <span>02 · import</span><strong>匯入 .tle</strong><small>精確匹配 bundle 才接受。</small>
            <input ref={fileInputRef} data-testid="tle-file-input" type="file" accept=".tle,text/plain" disabled={selectionLocked} onChange={handleImport} />
          </label>
          <button
            className="c90-tle-path c90-tle-path--action"
            type="button"
            data-testid="tle-use-fallback"
            disabled={selectionLocked}
            onClick={() => onUpdate(state => {
              const selected = setTleSourceSelection(state, journey.courseSourceId, 'fallback');
              return setTleWindowSelection(selected, journey.defaultWindowId);
            })}
          >
            <span>03 · skip</span><strong>跳過下載</strong><small>明示使用課程 pinned fallback。</small>
          </button>
        </div>
        <p className="c90-inline-status" role="status" data-testid="tle-import-status">{importMessage}</p>
      </section>

      <section className="c90-tle-selector" aria-label="Archived TLE source selection">
        <div className="c90-card-topline"><strong>Archive snapshot · 同一顆衛星</strong><span>filename date ≠ object epoch</span></div>
        <div className="c90-tle-source-grid">
          {journey.sources.map(candidate => {
            const selected = candidate.sourceId === source.sourceId;
            return (
              <button
                key={candidate.sourceId}
                type="button"
                data-testid={`tle-source-${candidate.archiveDate}`}
                className={`c90-tle-source-card ${selected ? 'is-selected' : ''}`}
                aria-pressed={selected}
                disabled={selectionLocked}
                onClick={() => onUpdate(state => setTleSourceSelection(state, candidate.sourceId, 'bundled'))}
              >
                <span>{candidate.shortLabel}</span>
                <strong>epoch {candidate.epochUtc.slice(0, 19)}Z</strong>
                <small>{candidate.role === 'course-compatible' ? '可接 E1' : '只作 age / model-output 比較'}</small>
              </button>
            );
          })}
        </div>
        {!isCourseCompatible && <p className="c90-callout c90-callout--warn">這筆舊 TLE 可以 replay 與比較，但不能把 E1 KPI 重新貼標。完成教學後請切回 course-compatible source。</p>}
        <label className="c90-field-label" htmlFor="tle-window">觀察時間區段</label>
        <select
          id="tle-window"
          data-testid="tle-window-select"
          value={session.tleSelectedWindowId}
          disabled={selectionLocked}
          onChange={event => onUpdate(state => setTleWindowSelection(state, event.target.value as typeof session.tleSelectedWindowId))}
        >
          {journey.windows.map(window => <option key={window.windowId} value={window.windowId}>{window.label} · {window.frameCount} frames · step {window.stepSec} s</option>)}
        </select>
        <p className="c90-helper">{bundle.startUtc} → {bundle.endUtc} · {bundle.model} · 預載完成後切換通常只需下一個 browser render frame。</p>
      </section>

      <section className="c90-time-semantics" aria-label="TLE time semantics">
        <div><span>archive key</span><strong>{source.archiveDate}</strong><small>只用來找檔案</small></div>
        <div><span>TLE epoch</span><strong>{source.epochUtc}</strong><small>element-set reference</small></div>
        <div><span>selected target</span><strong>{frame.targetUtc}</strong><small>SGP4 計算的時間</small></div>
        <div><span>browser now</span><strong>{browserNow}</strong><small>參考顯示，不送入 producer</small></div>
        <div className="c90-time-semantics__age"><span>target − epoch</span><strong>{signedDuration(frame.ageSeconds)}</strong><small>{Math.abs(frame.ageSeconds).toLocaleString()} s from epoch</small></div>
      </section>

      <div className="c90-accuracy-lesson">
        <strong>精度怎麼講才正確？</strong>
        <p>SGP4 先用 TLE epoch 初始化，再傳播到 selected target。離 epoch 越遠通常不確定性越高，但沒有通用的「N 天後失效」門檻；拖曳、軌道、機動與太空天氣都會影響。</p>
        <p>舊／中／recent 三筆在同一 target 的差距是 <b>model-output divergence</b>，不是拿量測 truth 算出的誤差。歷史 operational replay 應選 target 當時可取得、且不晚於 target 的最新 TLE，避免使用未來資料。</p>
      </div>

      <div className="c90-progress-line"><span style={{ width: `${((session.tleStageIndex + 1) / journey.stages.length) * 100}%` }} /></div>
      <div className="c90-stage-card c90-stage-card--active" data-testid={`tle-stage-${stage.id}`}>
        <div className="c90-card-topline"><span>{stage.title}</span><span className={`c90-source-tag c90-source-tag--${stage.provenance.toLowerCase()}`}>{stage.provenance}</span></div>
        <dl className="c90-lineage-list">
          <div><dt>Input</dt><dd>{values.input}</dd></div>
          <div><dt>Transform</dt><dd>{values.transformation}</dd></div>
          <div><dt>Output / unit</dt><dd>{values.output} · {values.unit}</dd></div>
          <div><dt>Why</dt><dd>{stage.purpose}</dd></div>
        </dl>
      </div>

      <details className="c90-source-record c90-source-details">
        <summary>Inspect selected TLE + hash</summary>
        <div><span>source id</span><strong>{source.sourceId}</strong></div>
        <div><span>record sha256</span><strong className="c90-mono-wrap">{source.recordSha256}</strong></div>
        <code>{source.line0}</code><code>{source.line1}</code><code>{source.line2}</code>
      </details>

      <label className="c90-field-label" htmlFor="tle-explanation">一句話說明（source → target/model → course assumption）</label>
      <textarea id="tle-explanation" value={session.tleExplanation} onChange={event => onUpdate(state => setTleExplanation(state, event.target.value))} placeholder="TLE epoch 是…；producer 計算到 selected target…；課程另外假設…" rows={3} />
      <div className="c90-tle-stage-actions">
        <button className="c90-secondary-button" type="button" disabled={session.tleStageIndex === 0} onClick={() => onUpdate(state => ({ ...state, tleStageIndex: Math.max(0, state.tleStageIndex - 1) }))}>← 上一站</button>
        <button className="c90-primary-button" type="button" data-testid="tle-next" disabled={isLast && !canComplete} onClick={() => onUpdate(state => advanceTleStage(state, journey.stages.length, canComplete))}>
          {isLast ? canComplete ? 'Identity locked · open E1 →' : '先確認 course source 並完成說明' : 'Inspect next stage →'}
        </button>
      </div>

      <details className="c90-source-hub">
        <summary>需要最新 TLE？來源連結與 server 更新流程</summary>
        <p>外部網站可能要求帳號或限制頻率。Phase 1 不從學生瀏覽器直接呼叫；由 instructor/server 更新 archive，預算後再提供 bundle。</p>
        <div className="c90-source-links">
          {journey.externalSources.map(external => <a key={external.sourceId} href={external.url} target="_blank" rel="noreferrer"><strong>{external.label}</strong><span>{external.accessNote}</span></a>)}
        </div>
        <button className="c90-secondary-button" type="button" data-testid="tle-copy-update-command" onClick={copyUpdateCommand}>複製 server 更新指令</button>
        <code className="c90-command">{journey.updateCommand}</code>
        <code className="c90-command">{journey.generationCommand}</code>
        {copyMessage && <p className="c90-inline-status" role="status">{copyMessage}</p>}
      </details>
    </div>
  );
}
