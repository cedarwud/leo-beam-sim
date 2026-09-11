import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';

import {
  TeachingAnimationTransport,
  type PlaybackSpeed,
} from '../../course/transport';
import {
  INTRA_HANDOVER_TEACHING_BEATS,
  INTRA_HANDOVER_TEACHING_DURATION_SEC,
  directorStateForIntraHandoverTeachingTime,
  seekIntraHandoverTeachingTime,
  ueTeachingPositionForState,
} from './intraHandoverTeachingDirector';
import {
  buildIntraHandoverTeachingSource,
  INTRA_HANDOVER_TEACHING_EPOCH_UTC,
  type IntraHandoverTeachingSource,
  type IntraHandoverTeachingUnavailable,
  type IntraHandoverTeachingSourceResult,
} from './intraHandoverTeachingSource';
import './IntraHandoverTeachingPrototype.scss';

type InspectionMode = 'source' | 'target';
type PredictionChoice = 'old' | 'new' | null;

const INITIAL_SPEED: PlaybackSpeed = 1;

function shortSatelliteId(id: string): string {
  const match = id.match(/(P\d+)-(S\d+)$/);
  return match ? `${match[1]} · ${match[2]}` : id;
}

function formatSigned(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value >= 0 ? '+' : ''}${value.toFixed(2)} dB`
    : '未發布';
}

function sourceSnapshot(source: IntraHandoverTeachingSource): Record<string, string> {
  const event = source.intraEvent;
  const comparison = source.comparisonInterEvent;
  return {
    sourceOwner: source.sourceOwner,
    claimKind: source.claimKind,
    eventId: event.id,
    sourceTimeSec: event.sourceTimeSec.toFixed(3),
    fromSatId: event.fromSatId,
    toSatId: event.toSatId,
    fromBeamId: String(event.fromBeamId),
    toBeamId: String(event.toBeamId),
    interFromSatId: comparison.fromSatId,
    interToSatId: comparison.toSatId,
    offsetDb: source.offsetDb.toFixed(3),
  };
}

function TeachingScene({
  source,
  state,
  inspection,
}: {
  readonly source: IntraHandoverTeachingSource;
  readonly state: ReturnType<typeof directorStateForIntraHandoverTeachingTime>;
  readonly inspection: InspectionMode;
}): ReactElement {
  const { beat } = state;
  const ue = ueTeachingPositionForState(state);
  const switchProgress = beat.id === 'switch' ? state.beatProgress : beat.endSec > 54 ? 1 : 0;
  const oldBeamVisible = inspection === 'source' && switchProgress < 1;
  const newBeamVisible = inspection === 'target' || switchProgress > 0 || beat.id === 'candidate' || beat.id === 'qualify';
  const oldCellOpacity = oldBeamVisible ? 1 - switchProgress * .84 : .16;
  const newCellOpacity = newBeamVisible ? (inspection === 'source' ? .82 : 1) : .24;
  const event = source.intraEvent;
  const sourceData = sourceSnapshot(source);

  const cells = [
    [600, 470, 'cell--source'],
    [430, 500, 'cell--quiet'],
    [770, 500, 'cell--target'],
    [515, 600, 'cell--quiet'],
    [685, 600, 'cell--quiet'],
  ] as const;

  return (
    <div
      className={`intra-teaching__scene-camera intra-teaching__scene-camera--${beat.camera}`}
      data-camera-layer="automatic"
      data-camera-pose={beat.camera}
    >
      <svg
        className="intra-teaching__scene-svg"
        viewBox="0 0 1200 720"
        role="img"
        aria-label="一顆固定身份的衛星、地面波束地毯與移動中的 UE"
        data-testid="intra-handover-scene-visual"
      >
        <defs>
          <linearGradient id="intra-earth-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b262c" />
            <stop offset="1" stopColor="#061217" />
          </linearGradient>
          <radialGradient id="intra-sat-glow">
            <stop offset="0" stopColor="#ffe5a0" stopOpacity=".9" />
            <stop offset="1" stopColor="#ffe5a0" stopOpacity="0" />
          </radialGradient>
          <filter id="intra-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <pattern id="intra-ground-grid" width="68" height="44" patternUnits="userSpaceOnUse">
            <path d="M 68 0 L 0 0 0 44" fill="none" stroke="#3e7880" strokeOpacity=".14" strokeWidth="1" />
          </pattern>
        </defs>

        <ellipse cx="600" cy="430" rx="480" ry="270" fill="url(#intra-earth-gradient)" stroke="#38717a" strokeOpacity=".34" strokeWidth="2" />
        <ellipse cx="600" cy="430" rx="480" ry="270" fill="url(#intra-ground-grid)" opacity=".85" />
        <path d="M 150 410 C 330 340 420 350 600 420 S 880 500 1050 410" fill="none" stroke="#68d7c2" strokeOpacity=".18" strokeWidth="2" strokeDasharray="8 16" />

        <g className="intra-teaching__beam-carpet" data-testid="beam-carpet">
          {cells.map(([x, y, className]) => (
            <polygon
              key={`${x}-${y}`}
              points={`${x},${y - 72} ${x + 62},${y - 36} ${x + 62},${y + 36} ${x},${y + 72} ${x - 62},${y + 36} ${x - 62},${y - 36}`}
              className={`intra-teaching__cell ${className}`}
            />
          ))}
          <polygon
            points="538,434 600,398 662,434 662,506 600,542 538,506"
            className="intra-teaching__cell intra-teaching__cell--old"
            opacity={oldCellOpacity}
            data-beam-role="old"
            data-beam-id={String(event.fromBeamId)}
          />
          <polygon
            points="708,464 770,428 832,464 832,536 770,572 708,536"
            className="intra-teaching__cell intra-teaching__cell--new"
            opacity={newCellOpacity}
            data-beam-role="new"
            data-beam-id={String(event.toBeamId)}
          />
          <path d="M 520 560 C 590 600 670 610 730 575" fill="none" stroke="#c8f5e6" strokeOpacity=".22" strokeWidth="2" strokeDasharray="6 10" />
        </g>

        <g className="intra-teaching__beam-footprints" data-testid="beam-footprints">
          <path d="M 600 170 L 482 510 L 638 510 Z" className="intra-teaching__beam-cone intra-teaching__beam-cone--old" opacity={oldCellOpacity} data-beam-role="old-cone" />
          <path d="M 600 170 L 652 540 L 838 540 Z" className="intra-teaching__beam-cone intra-teaching__beam-cone--new" opacity={newCellOpacity} data-beam-role="new-cone" />
          <line x1="600" y1="170" x2="600" y2="408" className="intra-teaching__beam-axis" />
          <circle cx="600" cy="170" r="22" fill="url(#intra-sat-glow)" opacity=".95" />
        </g>

        <g className="intra-teaching__satellite" data-testid="fixed-satellite" data-satellite-id={event.fromSatId}>
          <rect x="565" y="107" width="70" height="52" rx="8" fill="#d9e8e7" stroke="#ffe39b" strokeWidth="3" />
          <rect x="518" y="115" width="38" height="34" rx="3" fill="#63d0ca" stroke="#b9f6e9" strokeWidth="2" />
          <rect x="644" y="115" width="38" height="34" rx="3" fill="#63d0ca" stroke="#b9f6e9" strokeWidth="2" />
          <circle cx="600" cy="133" r="9" fill="#173b43" />
          <path d="M 600 104 V 86 M 588 86 H 612" stroke="#ffe39b" strokeWidth="3" strokeLinecap="round" />
        </g>

        <g className="intra-teaching__ue" data-testid="moving-ue" data-ue-x={ue.x.toFixed(1)} data-ue-y={ue.y.toFixed(1)}>
          <circle cx={ue.x} cy={ue.y} r="30" fill="#d9fbf0" fillOpacity=".11" stroke="#d9fbf0" strokeOpacity=".18" strokeWidth="2" />
          <circle cx={ue.x} cy={ue.y} r="12" fill="#fff6ca" stroke="#fff" strokeWidth="3" filter="url(#intra-soft-glow)" />
          <path d={`M ${ue.x - 6} ${ue.y + 20} L ${ue.x + 8} ${ue.y + 36}`} stroke="#fff6ca" strokeWidth="3" strokeLinecap="round" />
        </g>

        <g className="intra-teaching__labels" aria-hidden="true">
          <text x="600" y="66" textAnchor="middle" className="intra-teaching__svg-label intra-teaching__svg-label--sat">{shortSatelliteId(event.fromSatId)} · 固定衛星身份</text>
          <text x="548" y="592" textAnchor="middle" className="intra-teaching__svg-label intra-teaching__svg-label--beam">舊 beam v{event.fromBeamId}</text>
          <text x="785" y="620" textAnchor="middle" className="intra-teaching__svg-label intra-teaching__svg-label--beam-new">新 beam v{event.toBeamId}</text>
          <text x={ue.x + 26} y={ue.y - 20} className="intra-teaching__svg-label intra-teaching__svg-label--ue">UE</text>
          <text x="600" y="684" textAnchor="middle" className="intra-teaching__svg-label intra-teaching__svg-label--ground">earth cell / beam carpet · presentation geometry</text>
        </g>
      </svg>
      <div
        className="intra-teaching__scene-truth"
        data-testid="source-identity-display"
        data-source-event-id={sourceData.eventId}
        data-source-from-satellite={sourceData.fromSatId}
        data-source-to-satellite={sourceData.toSatId}
        data-source-from-beam={sourceData.fromBeamId}
        data-source-to-beam={sourceData.toBeamId}
      >
        <span>{shortSatelliteId(event.fromSatId)} · v{event.fromBeamId} → v{event.toBeamId}</span>
      </div>
    </div>
  );
}

function PrimaryCue({
  source,
  state,
}: {
  readonly source: IntraHandoverTeachingSource;
  readonly state: ReturnType<typeof directorStateForIntraHandoverTeachingTime>;
}): ReactElement {
  const event = source.intraEvent;
  const sameSatellite = event.fromSatId === event.toSatId;
  const delta = formatSigned(event.deltaDb);

  return (
    <section
      className={`intra-teaching__primary-cue intra-teaching__primary-cue--${state.beat.primaryCue}`}
      data-primary-cue="true"
      data-stage-occluder="true"
      data-cue-id={state.beat.primaryCue}
      aria-label={state.beat.title}
    >
      <span className="intra-teaching__cue-kicker">{state.beat.order.toString().padStart(2, '0')} / 08 · {state.beat.title}</span>
      {state.beat.id === 'qualify' || state.beat.id === 'receipt' ? (
        <div className="intra-teaching__cue-facts">
          <strong>ΔSINR {delta}</strong>
          <span>offset {source.offsetDb.toFixed(0)} dB · {event.deltaDb !== null && event.deltaDb >= source.offsetDb ? '來源事件達到門檻' : '來源事件未達門檻'}</span>
          <span>TTT：來源事件未發布 · EE：非此來源契約</span>
        </div>
      ) : state.beat.id === 'compare' ? (
        <div className="intra-teaching__cue-facts">
          <strong>同星：{sameSatellite ? 'satellite ID 不變' : '來源缺口'}</strong>
          <span>跨衛星比較事件：satellite ID 會改變</span>
        </div>
      ) : (
        <div className="intra-teaching__cue-facts">
          <strong>{state.beat.id === 'switch' ? 'beam identity 正在切換' : 'satellite identity 固定'}</strong>
          <span>舊 v{event.fromBeamId} → 新 v{event.toBeamId}</span>
        </div>
      )}
    </section>
  );
}

function SourceBadge({ source }: { readonly source: IntraHandoverTeachingSource }): ReactElement {
  const event = source.intraEvent;
  return (
    <aside
      className="intra-teaching__source-badge"
      data-stage-occluder="true"
      data-testid="source-badge"
      data-source-owner={source.sourceOwner}
      data-claim-kind={source.claimKind}
      data-event-id={event.id}
      data-event-source-time-sec={event.sourceTimeSec.toFixed(3)}
      data-epoch-utc={INTRA_HANDOVER_TEACHING_EPOCH_UTC}
    >
      <strong>SOURCE · Live TLE event index</strong>
      <span>{event.id} · source time {event.sourceTimeSec.toFixed(0)} s</span>
      <span>stepRuntimeFrame · coarse offline forecast</span>
    </aside>
  );
}

function UnavailableSource({ result }: { readonly result: IntraHandoverTeachingUnavailable }): ReactElement {
  return (
    <main className="intra-teaching intra-teaching--unavailable" data-testid="intra-handover-teaching" data-source-status="unavailable">
      <div className="intra-teaching__unavailable-copy">
        <span className="intra-teaching__eyebrow">INTRA-SATELLITE TEACHING / FAIL CLOSED</span>
        <h1>同衛星換束事件目前不可用</h1>
        <p>來源契約沒有提供可驗證的「同一 satellite、不同 beam」事件，因此本課不會補寫身份或指標。</p>
        <code>{result.reason}</code>
      </div>
    </main>
  );
}

export function IntraHandoverTeachingPrototype(): ReactElement {
  const [sourceResult, setSourceResult] = useState<IntraHandoverTeachingSourceResult | null>(null);
  const [timeSec, setTimeSec] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(INITIAL_SPEED);
  const [inspection, setInspection] = useState<InspectionMode>('source');
  const [prediction, setPrediction] = useState<PredictionChoice>(null);
  const lastFrameMsRef = useRef<number | null>(null);
  const forceTransportVisible = useMemo(() => new URLSearchParams(window.location.search).get('controls') === '1', []);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      if (!cancelled) setSourceResult(buildIntraHandoverTeachingSource());
    }, 20);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, []);

  const source = sourceResult?.available === true ? sourceResult : null;
  const state = directorStateForIntraHandoverTeachingTime(timeSec);
  const sourceData = source === null ? null : sourceSnapshot(source);

  useEffect(() => {
    if (!playing || source === null) {
      lastFrameMsRef.current = null;
      return undefined;
    }
    let frameHandle = 0;
    const tick = (nowMs: number) => {
      const previous = lastFrameMsRef.current ?? nowMs;
      lastFrameMsRef.current = nowMs;
      const elapsedSec = Math.min(.1, Math.max(0, (nowMs - previous) / 1000));
      setTimeSec(current => Math.min(INTRA_HANDOVER_TEACHING_DURATION_SEC, current + elapsedSec * speed));
      frameHandle = window.requestAnimationFrame(tick);
    };
    frameHandle = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameHandle);
  }, [playing, source, speed]);

  useEffect(() => {
    if (timeSec >= INTRA_HANDOVER_TEACHING_DURATION_SEC) setPlaying(false);
  }, [timeSec]);

  const onSeek = useCallback((nextTimeSec: number) => {
    setTimeSec(nextTimeSec);
  }, []);

  const step = useCallback((deltaSec: number) => {
    setTimeSec(current => seekIntraHandoverTeachingTime(current, deltaSec));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying(current => !current);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-5);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(5);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step]);

  if (sourceResult !== null && 'reason' in sourceResult) return <UnavailableSource result={sourceResult} />;
  if (source === null || sourceData === null) {
    return (
      <main className="intra-teaching intra-teaching--loading" data-testid="intra-handover-teaching" data-source-status="loading" aria-busy="true">
        <div className="intra-teaching__loading-mark">
          <span className="intra-teaching__eyebrow">INTRA-SATELLITE TEACHING</span>
          <h1>正在讀取來源事件…</h1>
          <p>只接受可驗證的 TLE 同衛星換束身份。</p>
        </div>
      </main>
    );
  }

  const beat = state.beat;
  const sourceEvent = source.intraEvent;
  const sourceIdentityStable = sourceEvent.fromSatId === sourceEvent.toSatId;
  const cssVars = {
    '--teaching-progress': `${(timeSec / INTRA_HANDOVER_TEACHING_DURATION_SEC * 100).toFixed(2)}%`,
    '--beat-progress': String(state.beatProgress),
  } as CSSProperties;

  return (
    <main
      className="intra-teaching"
      data-testid="intra-handover-teaching"
      data-source-status="ready"
      data-source-owner={source.sourceOwner}
      data-claim-kind={source.claimKind}
      data-source-contract={source.contract}
      data-event-id={sourceData.eventId}
      data-event-source-time-sec={sourceData.sourceTimeSec}
      data-source-intra-from-satellite={sourceData.fromSatId}
      data-source-intra-to-satellite={sourceData.toSatId}
      data-source-intra-from-beam={sourceData.fromBeamId}
      data-source-intra-to-beam={sourceData.toBeamId}
      data-source-inter-from-satellite={sourceData.interFromSatId}
      data-source-inter-to-satellite={sourceData.interToSatId}
      data-satellite-identity-stable={sourceIdentityStable ? 'true' : 'false'}
      data-beam-identity-changed={sourceEvent.fromBeamId !== sourceEvent.toBeamId ? 'true' : 'false'}
      data-ttt-available="false"
      data-ee-available="false"
      data-duration-sec={INTRA_HANDOVER_TEACHING_DURATION_SEC}
      data-time-sec={timeSec.toFixed(2)}
      data-playing={playing ? 'true' : 'false'}
      data-speed={speed}
      data-beat={beat.id}
      data-beat-order={beat.order}
      data-beat-total={INTRA_HANDOVER_TEACHING_BEATS.length}
      data-primary-cue={beat.primaryCue}
      data-learning-loop-phase={beat.learningPhase}
      data-prediction={prediction ?? 'unanswered'}
      data-camera-pose={beat.camera}
      data-camera-director="automatic"
      data-caption-count="1"
      data-geometry-provenance="presentation-only; source-backed identities only"
      style={cssVars}
      tabIndex={-1}
    >
      <div className="intra-teaching__stage" data-testid="intra-handover-teaching-stage">
        <div className="intra-teaching__ambient" aria-hidden="true" />
        <TeachingScene source={source} state={state} inspection={inspection} />
      </div>

      <header className="intra-teaching__header" data-stage-occluder="true">
        <span className="intra-teaching__eyebrow">VISUAL LESSON · BEAM IDENTITY</span>
        <h1>同衛星換束</h1>
        <p>一顆衛星固定在視野中；只追蹤 UE 的服務 beam。</p>
      </header>

      <div
        className="intra-teaching__beat-counter"
        data-testid="intra-handover-beat-counter"
        data-stage-occluder="true"
      >
        <strong>{String(beat.order).padStart(2, '0')} / {String(INTRA_HANDOVER_TEACHING_BEATS.length).padStart(2, '0')}</strong>
        <span>{beat.title}</span>
      </div>

      <SourceBadge source={source} />
      <PrimaryCue source={source} state={state} />

      <p className="intra-teaching__caption" data-stage-occluder="true" data-caption-line="true">
        {beat.caption}
      </p>

      {beat.id === 'candidate' ? (
        <div className="intra-teaching__prediction" data-stage-occluder="true" data-testid="intra-handover-prediction">
          <span>先預測</span>
          <button
            type="button"
            aria-pressed={prediction === 'old'}
            onClick={() => setPrediction('old')}
            data-testid="predict-old-beam"
          >
            留在舊 beam
          </button>
          <button
            type="button"
            aria-pressed={prediction === 'new'}
            onClick={() => setPrediction('new')}
            data-testid="predict-new-beam"
          >
            切到新 beam
          </button>
          <output data-testid="prediction-outcome">{prediction === null ? '尚未選擇' : `預測：${prediction === 'old' ? `v${sourceEvent.fromBeamId}` : `v${sourceEvent.toBeamId}`}`}</output>
        </div>
      ) : beat.id === 'receipt' || beat.id === 'after' ? (
        <div className="intra-teaching__inspect" data-stage-occluder="true" data-testid="intra-handover-inspect">
          <span>互動檢視</span>
          <button
            type="button"
            aria-pressed={inspection === 'source'}
            onClick={() => setInspection('source')}
            data-testid="inspect-before"
          >
            切換前
          </button>
          <button
            type="button"
            aria-pressed={inspection === 'target'}
            onClick={() => setInspection('target')}
            data-testid="inspect-after"
          >
            切換後
          </button>
        </div>
      ) : null}

      {beat.id === 'switch' || beat.id === 'receipt' ? (
        <div className="intra-teaching__consequence" data-stage-occluder="true" data-testid="intra-handover-consequence">
          <span>可見結果</span>
          <strong>{prediction === 'old' ? '預測留在舊 beam，但來源事件切到新 beam' : `服務 beam 已切到 v${sourceEvent.toBeamId}`}</strong>
        </div>
      ) : null}

      <div className="intra-teaching__identity-proof" data-testid="identity-proof" data-stage-occluder="true">
        <span>satellite</span>
        <strong>{shortSatelliteId(sourceEvent.fromSatId)}</strong>
        <i aria-hidden="true" />
        <span>beam</span>
        <strong>v{sourceEvent.fromBeamId} → v{sourceEvent.toBeamId}</strong>
      </div>

      <TeachingAnimationTransport
        currentTimeSec={timeSec}
        durationSec={INTRA_HANDOVER_TEACHING_DURATION_SEC}
        isPlaying={playing}
        playbackSpeed={speed}
        onPlayPause={() => setPlaying(current => !current)}
        onSeek={onSeek}
        onSpeedChange={setSpeed}
        onStepBackward={() => step(-5)}
        onStepForward={() => step(5)}
        stepSeconds={5}
        forceVisible={forceTransportVisible}
        testId="intra-handover-teaching-transport"
      />
    </main>
  );
}
