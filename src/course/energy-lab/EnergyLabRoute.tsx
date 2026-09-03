import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import { SixActsNav } from '../nav/SixActsNav';
import { SIX_ACTS_ACT5_HREF, SIX_ACTS_ACT6_HREF } from '../nav/sixActsRoutes';
import {
  TeachingAnimationTransport,
  type PlaybackSpeed,
} from '../transport';
import {
  ENERGY_LAB_ACT6_DURATION_SEC,
  ENERGY_LAB_BASELINE_POWER_W,
  ENERGY_LAB_CHECKPOINTS,
  ENERGY_LAB_DURATION_SEC,
  ENERGY_LAB_PREDICTION_END_SEC,
  ENERGY_LAB_QUESTION_POWER_W,
  ENERGY_LAB_SOURCE_CONTRACT,
  buildEnergyLabLocalReceipt,
  energyLabActFromLocation,
  energyLabAct6BeatAtTime,
  type EnergyLabAct6BeatId,
  type EnergyLabBeatId,
  type EnergyLabDirectorFrame,
  type EnergyLabLocalReceipt,
  type EnergyLabPrediction,
  type EnergyLabSample,
  advanceEnergyLabCourseTime,
  observedCheckpointLabel,
  predictionLabel,
  resolveEnergyLabFrame,
} from './energyLabDirector';
import { ENERGY_LAB_STOPS } from './energyLabFixture';
import { EnergyLabScene } from './EnergyLabScene';
import './EnergyLabRoute.scss';

interface LessonCopy {
  readonly label: string;
  readonly cue: string;
  readonly caption: string;
}

const ACT5_COPY: Readonly<Record<EnergyLabBeatId, LessonCopy>> = Object.freeze({
  prediction: Object.freeze({
    label: '先做預測',
    cue: `${ENERGY_LAB_QUESTION_POWER_W.toFixed(2)} W 能否維持 4/4 UE 服務？`,
    caption: '先作判斷，再以固定教學資料驗證。',
  }),
  baseline: Object.freeze({
    label: '服務基準',
    cue: `${ENERGY_LAB_BASELINE_POWER_W.toFixed(2)} W：4/4 UE 符合服務條件`,
    caption: '固定教學資料；作為後續功率掃描的比較基準。',
  }),
  'downward-sweep': Object.freeze({
    label: '向下掃描',
    cue: '降低功率，觀察服務邊界',
    caption: '僅調整發射功率 p；先看服務，再比較能源效率。',
  }),
  'outage-reveal': Object.freeze({
    label: '服務後果',
    cue: `${ENERGY_LAB_QUESTION_POWER_W.toFixed(2)} W：服務條件不成立`,
    caption: '固定電路功耗仍在，總資料率下降；此點不列入有效樣本。',
  }),
  'upward-sweep': Object.freeze({
    label: '向上掃描',
    cue: '提高功率，資料率增益趨緩',
    caption: '系統功率仍持續上升。',
  }),
  'checkpoint-compare': Object.freeze({
    label: '採樣點比較',
    cue: '比較服務有效的採樣點',
    caption: '核對服務狀態與系統能源效率。',
  }),
  finale: Object.freeze({
    label: '資料推導結論',
    cue: '哪個有效採樣點的能源效率最高？',
    caption: '本結論僅適用於這組固定教學資料。',
  }),
});

const ACT6_COPY: Readonly<Record<EnergyLabAct6BeatId, LessonCopy>> = Object.freeze({
  source: Object.freeze({
    label: '第 6 幕 · 本機證據',
    cue: '先確認這份證據從哪裡來',
    caption: '這是固定教學資料的本機來源收據，不是即時網路資料。',
  }),
  sample: Object.freeze({
    label: '第 6 幕 · 單點樣本',
    cue: '把同一個採樣點寫成可追溯欄位',
    caption: '欄位保留資料框架摘要、情境識別碼、單點時長及量測單位。',
  }),
  receipt: Object.freeze({
    label: '第 6 幕 · 收據完成',
    cue: '本機收據已整理',
    caption: '可下載本機 JSON；此畫面不執行網路傳送，也不宣稱遠端保存。',
  }),
});

function tracePoint(sample: EnergyLabSample, maxEe: number): { readonly x: number; readonly y: number } {
  const stopIndex = Math.max(0, ENERGY_LAB_STOPS.indexOf(sample.powerW));
  return {
    x: 28 + (stopIndex / Math.max(1, ENERGY_LAB_STOPS.length - 1)) * 270,
    y: 126 - (sample.point.eeMbitPerJ / Math.max(maxEe, 0.001)) * 98,
  };
}

function EnergyTrace({ frame }: { readonly frame: EnergyLabDirectorFrame }): ReactElement | null {
  if (frame.traceSamples.length === 0) return null;
  const maxEe = frame.sampledPoints.reduce(
    (maximum, sample) => Math.max(maximum, sample.point.eeMbitPerJ),
    0,
  );
  const coordinates = frame.traceSamples.map(sample => tracePoint(sample, maxEe));
  const path = coordinates
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  return (
    <figure className="energy-lab__trace" data-testid="energy-lab-ee-trace">
      <figcaption>結果檢視 · 採樣 EE（Mbit/J）</figcaption>
      <svg viewBox="0 0 320 150" role="img" aria-label="結果檢視中的 fixture 採樣 EE">
        <line x1="28" y1="126" x2="298" y2="126" className="energy-lab__trace-axis" />
        <line x1="28" y1="18" x2="28" y2="126" className="energy-lab__trace-axis" />
        <path d={path} className="energy-lab__trace-path" />
        {frame.traceSamples.map(sample => {
          const point = tracePoint(sample, maxEe);
          return (
            <circle
              key={sample.powerW}
              cx={point.x}
              cy={point.y}
              r={sample.powerW === frame.currentSample.powerW ? 6 : 3.5}
              className={sample.powerW === frame.currentSample.powerW ? 'is-current' : ''}
              data-power-w={sample.powerW}
            />
          );
        })}
      </svg>
      <span className="energy-lab__trace-foot">離散採樣點；不是連續量測</span>
    </figure>
  );
}

function serviceLabel(frame: EnergyLabDirectorFrame): string {
  if (frame.serviceState === 'healthy') return `${frame.totalUserCount} / ${frame.totalUserCount} UE 服務中`;
  if (frame.serviceState === 'degraded') return `${frame.totalUserCount - frame.lowSinrUserCount} / ${frame.totalUserCount} UE 服務中`;
  return `0 / ${frame.totalUserCount} UE 可穩定服務`;
}

function predictionButtonLabel(prediction: EnergyLabPrediction): string {
  return prediction === 'service-survives' ? '仍可全部服務' : '無法全部服務';
}

function questionAnswerLabel(frame: EnergyLabDirectorFrame): string {
  return frame.questionAnswer === 'all-served' ? '全部服務' : '無法全部服務';
}

function receiptFieldLabel(key: EnergyLabLocalReceipt['fields'][number]['key']): string {
  switch (key) {
    case 'DELIVERED_DATA_MBIT': return '傳輸資料量';
    case 'TOTAL_ENERGY_J': return '總能耗';
    case 'RUN_EE_MBIT_PER_J': return '系統能源效率';
    case 'LOW_SINR_RATIO': return '低 SINR 比例';
  }
}

function LocalReceipt({ receipt, onDownload }: {
  readonly receipt: EnergyLabLocalReceipt;
  readonly onDownload: () => void;
}): ReactElement {
  return (
    <aside className="energy-lab__receipt" data-testid="energy-lab-local-receipt" data-primary-teaching="true">
      <div className="energy-lab__receipt-heading">
        <span>本機證據收據</span>
        <strong>{receipt.receiptId}</strong>
      </div>
      <dl className="energy-lab__receipt-meta">
        <div><dt>資料框架</dt><dd>{receipt.frameSetDigest}</dd></div>
        <div><dt>情境</dt><dd>{receipt.scenarioId}</dd></div>
        <div><dt>採樣點</dt><dd>{receipt.samplePowerW.toFixed(2)} W · 1 s</dd></div>
      </dl>
      <ul className="energy-lab__receipt-fields">
        {receipt.fields.map(field => (
          <li key={field.key}>
            <span>{receiptFieldLabel(field.key)}</span>
            <strong>{field.value.toFixed(3)} {field.unit}</strong>
          </li>
        ))}
      </ul>
      <p className="energy-lab__receipt-limit">{receipt.evidenceLimit} 本機 JSON；未傳送。</p>
      <button type="button" onClick={onDownload} data-testid="energy-lab-download-receipt">下載本機 JSON</button>
    </aside>
  );
}

export function EnergyLabRoute(): ReactElement {
  const act = energyLabActFromLocation(
    typeof window === 'undefined' ? SIX_ACTS_ACT5_HREF : window.location.pathname,
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const isAct6 = act === 6;
  const durationSec = isAct6 ? ENERGY_LAB_ACT6_DURATION_SEC : ENERGY_LAB_DURATION_SEC;
  const currentHref = isAct6 ? SIX_ACTS_ACT6_HREF : SIX_ACTS_ACT5_HREF;
  const [courseTimeSec, setCourseTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [prediction, setPrediction] = useState<EnergyLabPrediction | null>(null);
  const [selectedCheckpointW, setSelectedCheckpointW] = useState(ENERGY_LAB_BASELINE_POWER_W);
  const [predictionPrompt, setPredictionPrompt] = useState(false);
  const lastNowRef = useRef<number | null>(null);

  const frame = useMemo(
    () => resolveEnergyLabFrame(isAct6 ? ENERGY_LAB_DURATION_SEC - 6 : courseTimeSec, selectedCheckpointW),
    [courseTimeSec, isAct6, selectedCheckpointW],
  );
  const act6Beat = energyLabAct6BeatAtTime(courseTimeSec);
  const bestSample = frame.bestServiceValidSample;
  const receipt = useMemo(() => buildEnergyLabLocalReceipt(bestSample), [bestSample]);
  const isPredictionGate = !isAct6 && frame.beat.id === 'prediction';
  const isCheckpointMode = !isAct6 && frame.beat.id === 'checkpoint-compare';
  const showTrace = !isAct6 && !isPlaying && (isCheckpointMode || frame.beat.id === 'finale');
  const showMetric = !isAct6 && !isPredictionGate && (!isPlaying || frame.beat.id === 'outage-reveal');
  const showReceipt = isAct6 && act6Beat.id === 'receipt';
  const activeBeat = isAct6 ? `act6-${act6Beat.id}` : frame.beat.id;
  const copy = isAct6
    ? ACT6_COPY[act6Beat.id]
    : frame.beat.id === 'finale'
      ? Object.freeze({
        ...ACT5_COPY.finale,
        caption: `服務有效樣本中，${bestSample.powerW.toFixed(2)} W 的能源效率最高；本結論僅適用於固定教學資料。`,
      })
      : ACT5_COPY[frame.beat.id];

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (isPredictionGate && prediction === null) {
      setPredictionPrompt(true);
      return;
    }
    if (courseTimeSec >= durationSec) setCourseTimeSec(0);
    setPredictionPrompt(false);
    setIsPlaying(true);
  }, [courseTimeSec, durationSec, isPlaying, isPredictionGate, prediction]);

  const handleSeek = useCallback((timeSec: number) => {
    setCourseTimeSec(Math.max(0, Math.min(durationSec, timeSec)));
    setPredictionPrompt(false);
    setIsPlaying(false);
  }, [durationSec]);

  const handleStepBackward = useCallback((seconds = 5) => {
    handleSeek(courseTimeSec - seconds);
  }, [courseTimeSec, handleSeek]);

  const handleStepForward = useCallback((seconds = 5) => {
    handleSeek(courseTimeSec + seconds);
  }, [courseTimeSec, handleSeek]);

  const handlePrediction = useCallback((value: EnergyLabPrediction) => {
    setPrediction(value);
    setPredictionPrompt(false);
    if (courseTimeSec < ENERGY_LAB_PREDICTION_END_SEC) setIsPlaying(true);
  }, [courseTimeSec]);

  const handleCheckpoint = useCallback((powerW: number) => {
    setSelectedCheckpointW(powerW);
    setIsPlaying(false);
  }, []);

  const downloadReceipt = useCallback(() => {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${receipt.receiptId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [receipt]);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (lastNowRef.current === null) lastNowRef.current = now;
      const elapsedSec = Math.min(0.1, Math.max(0, (now - lastNowRef.current) / 1000));
      lastNowRef.current = now;
      if (isPlaying) {
        setCourseTimeSec(previous => {
          const next = advanceEnergyLabCourseTime(previous, elapsedSec, playbackSpeed);
          const clamped = Math.min(durationSec, next);
          if (clamped >= durationSec) setIsPlaying(false);
          return clamped;
        });
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      lastNowRef.current = null;
    };
  }, [durationSec, isPlaying, playbackSpeed]);

  const currentPoint = isAct6 ? bestSample.point : frame.currentSample.point;

  return (
    <main
      className={`energy-lab energy-lab--act-${act} energy-lab--${activeBeat} ${isPlaying ? 'is-playing' : 'is-paused'}`}
      lang="zh-Hant"
      data-act={String(act)}
      data-route-href={currentHref}
      data-course-time={courseTimeSec.toFixed(1)}
      data-beat={activeBeat}
      data-beat-progress={isAct6 ? '0.000' : frame.beatProgress.toFixed(3)}
      data-transport-playing={isPlaying ? 'true' : 'false'}
      data-transport-speed={String(playbackSpeed)}
      data-transport-time={courseTimeSec.toFixed(1)}
      data-transport-duration={durationSec.toFixed(1)}
      data-prediction-gate={isPredictionGate ? 'open' : 'revealed'}
      data-prediction-selected={prediction ?? 'none'}
      data-question-answer={isAct6 ? 'not-mounted' : isPredictionGate ? 'hidden' : frame.questionAnswer}
      data-question-power-w={isAct6 ? 'not-mounted' : String(frame.questionSample.powerW)}
      data-selected-checkpoint={String(selectedCheckpointW)}
      data-best-service-valid-power={String(bestSample.powerW)}
      data-frame-set-digest={ENERGY_LAB_SOURCE_CONTRACT.frameSetDigest}
      data-scenario-id={ENERGY_LAB_SOURCE_CONTRACT.scenarioId}
      data-local-receipt-persistence={isAct6 ? receipt.persistence : 'not-mounted'}
      data-current-power-w={String(currentPoint.beamPowerW)}
      data-current-rate-mbps={isPredictionGate ? 'hidden' : currentPoint.totalRateMbps.toFixed(6)}
      data-current-system-power-w={isPredictionGate ? 'hidden' : currentPoint.systemPowerW.toFixed(6)}
      data-current-ee-mbit-per-j={isPredictionGate ? 'hidden' : currentPoint.eeMbitPerJ.toFixed(6)}
      data-low-sinr-ratio={isPredictionGate ? 'hidden' : String(currentPoint.lowSinrFraction)}
      data-scene-exposure="central-stage-100-percent"
      data-transient-caption-count="1"
    >
      <section className="energy-lab__theater" aria-label={isAct6 ? 'Act 6 本機證據收據場景' : 'Act 5 場景優先能源效率實驗'}>
        <div className="energy-lab__nav-shell">
          <SixActsNav currentHref={currentHref} variant="stage" />
        </div>

        <div
          className={`energy-lab__scene is-${isAct6 ? 'healthy' : frame.serviceState}`}
          data-testid="energy-lab-scene"
          data-scene-state={isAct6 ? 'healthy' : frame.serviceState}
          data-beam-strength={frame.beamVisualStrength.toFixed(3)}
          role="img"
          aria-label={isAct6 ? '本機來源收據的衛星場景' : `衛星波束場景：${serviceLabel(frame)}`}
        >
          <EnergyLabScene
            serviceState={isAct6 ? 'healthy' : frame.serviceState}
            beamVisualStrength={isAct6 ? 0.58 : frame.beamVisualStrength}
            lowSinrUserCount={isAct6 ? 0 : frame.lowSinrUserCount}
            totalUserCount={frame.totalUserCount}
            isPrediction={isPredictionGate}
          />
        </div>

        <div className="energy-lab__evidence-badge">
          固定教學資料 · {isAct6 ? '僅供本機證據檢視' : '非即時網路結果'}
        </div>

        {!showReceipt ? (
          <header className="energy-lab__lesson" data-primary-teaching="true" data-beat={activeBeat}>
            <div className="energy-lab__eyebrow"><span>{copy.label}</span><b>{courseTimeSec.toFixed(0)}s</b></div>
            <h1>{copy.cue}</h1>
            <p className="energy-lab__caption" data-testid="energy-lab-caption">{copy.caption}</p>
            {isPredictionGate ? (
              <div className="energy-lab__prediction-options" role="group" aria-label="服務預測答案">
                {(['service-survives', 'service-fails'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    className={prediction === option ? 'is-selected' : ''}
                    aria-pressed={prediction === option}
                    data-testid={`energy-lab-prediction-${option}`}
                    onClick={() => handlePrediction(option)}
                  >
                    {predictionButtonLabel(option)}
                  </button>
                ))}
              </div>
            ) : !isAct6 ? (
              <p className="energy-lab__prediction-chip" data-testid="energy-lab-prediction-chip">
                預測：{predictionLabel(prediction)}
                {(frame.beat.id === 'outage-reveal' || frame.beat.id === 'checkpoint-compare' || frame.beat.id === 'finale')
                  ? ` · ${frame.questionSample.powerW.toFixed(2)} W 的觀察：${questionAnswerLabel(frame)}`
                  : ''}
              </p>
            ) : null}
            {predictionPrompt ? <p className="energy-lab__prompt" role="alert">先選一個服務預測，時間軸才會開始。</p> : null}
          </header>
        ) : (
          <LocalReceipt receipt={receipt} onDownload={downloadReceipt} />
        )}

        {!isAct6 && !isPredictionGate ? (
          <aside className={`energy-lab__scene-readout is-${frame.serviceState}`} data-testid="energy-lab-scene-readout">
            <div><span>當前採樣 p</span><strong>{currentPoint.beamPowerW.toFixed(2)} W</strong></div>
            <div><span>服務狀態</span><strong>{serviceLabel(frame)}</strong></div>
          </aside>
        ) : null}

        {showMetric ? (
          <aside className="energy-lab__metric-tether" data-testid="energy-lab-ee-tether" aria-label="系統能源效率 ratio-of-sums">
            <span className="energy-lab__metric-group"><span>ΣR</span><strong>{currentPoint.totalRateMbps.toFixed(1)} Mbit/s</strong></span>
            <i>/</i>
            <span className="energy-lab__metric-group"><span>P<sup>N</sup></span><strong>{currentPoint.systemPowerW.toFixed(2)} W</strong></span>
            <i>=</i>
            <span className="energy-lab__metric-group"><span>η</span><strong>{currentPoint.eeMbitPerJ.toFixed(2)} Mbit/J</strong></span>
          </aside>
        ) : null}

        {showTrace ? <EnergyTrace frame={frame} /> : null}

        {isCheckpointMode ? (
          <section className="energy-lab__checkpoint-zone" data-testid="energy-lab-checkpoint-zone" aria-label="採樣功率點比較">
            <div className="energy-lab__checkpoint-buttons" role="group" aria-label="選擇 fixture 採樣功率點">
              {ENERGY_LAB_CHECKPOINTS.map(powerW => (
                <button
                  key={powerW}
                  type="button"
                  className={selectedCheckpointW === powerW ? 'is-selected' : ''}
                  aria-pressed={selectedCheckpointW === powerW}
                  data-testid={`energy-lab-checkpoint-${String(powerW).replace('.', '-')}`}
                  data-power-w={powerW}
                  onClick={() => handleCheckpoint(powerW)}
                >
                  {powerW.toFixed(2)} W
                </button>
              ))}
            </div>
            <p className="energy-lab__checkpoint-readout" data-testid="energy-lab-checkpoint-readout">
              <span>預測：{predictionLabel(prediction)}</span>
              <b>{frame.selectedSample.powerW.toFixed(2)} W</b>
              <span>觀察：{observedCheckpointLabel(frame.selectedSample, bestSample)} · EE {frame.selectedSample.point.eeMbitPerJ.toFixed(2)} Mbit/J</span>
            </p>
          </section>
        ) : null}

        <TeachingAnimationTransport
          currentTimeSec={courseTimeSec}
          durationSec={durationSec}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onStepBackward={handleStepBackward}
          onStepForward={handleStepForward}
          onSpeedChange={setPlaybackSpeed}
          stepSeconds={5}
          testId="energy-lab-transport"
        />
      </section>
    </main>
  );
}
