import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  describeSixActsShellHonesty,
  tallySixActsShells,
  type SixActsShellId,
} from '../../course/sixActs/act1Shells';
import {
  ACT1_SHELL_OPTIONS,
  Act1ConstellationPointCloud,
  Act1NtpuMarker,
  act1ShellClaim,
  type Act1ShellFilter,
} from './Act1ConstellationScene';
import {
  alignAct1ShellsToArtifact,
  alignAct1VisibilityToArtifact,
  computeAct1Elevations,
  loadAct1OrbitCatalog,
  type Act1OrbitRecord,
} from './act1TleCatalog';
import { SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG } from '../../course/sixActs/windowVisibility';
import {
  ACT1_FRAME_SPAN_SEC,
  ACT1_FRAME_STEP_SEC,
  useAct1FrameAt,
  useAct1Frames,
} from './useAct1Frames';
import {
  act1NtpuApexWorld,
  act1NtpuCameraPosition,
} from './act1NtpuGeometry';
import type { SimulatorConstellation } from '../../simulator/types';
import {
  visualLabGlobalConstellationStore,
  type VisualLabGlobalConstellationArtifact,
  type VisualLabGlobalConstellationFirstFrameState,
} from '../../visualLab/globalConstellation';
import {
  EarthSphere,
  GLOBAL_SCENE_PALETTES,
  VisualLabGlobalScene,
  type VisualLabGlobalSceneStatus,
} from '../visual-lab-g0/VisualLabGlobalScene';
import { SixActsBridge, SixActsNav } from '../../course/nav/SixActsNav';
import './GlobalConstellationPrototype.scss';

const CONSTELLATIONS: readonly {
  readonly id: SimulatorConstellation;
  readonly label: string;
  readonly description: string;
}[] = Object.freeze([
  { id: 'starlink', label: 'Starlink', description: '低軌道、密集星座' },
  { id: 'oneweb', label: 'OneWeb', description: '較高軌道、較少衛星' },
]);

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function constellationLabel(constellation: SimulatorConstellation): string {
  return constellation === 'starlink' ? 'Starlink' : 'OneWeb';
}

function sceneStatus(state: VisualLabGlobalConstellationFirstFrameState): VisualLabGlobalSceneStatus {
  return state.status;
}

function Metric({ label, value, note }: { readonly label: string; readonly value: string; readonly note: string }): ReactElement {
  return (
    <div className="global-constellation__metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{note}</small>
    </div>
  );
}

function SourceState({ state }: { readonly state: VisualLabGlobalConstellationFirstFrameState }): ReactElement {
  if (state.status === 'loading') {
    return <p className="global-constellation__source-state" role="status" aria-live="polite">正在載入 {constellationLabel(state.constellation)} 全球衛星資料…</p>;
  }
  if (state.status === 'error') {
    return <p className="global-constellation__source-state is-error" role="alert">全球衛星資料載入失敗：{state.error}</p>;
  }
  if (state.status === 'ready') {
    return <p className="global-constellation__source-state is-ready" role="status" aria-live="polite">已載入封存 TLE · SGP4 · {state.artifact.instantUtc}</p>;
  }
  return <p className="global-constellation__source-state" role="status" aria-live="polite">等待全球衛星資料</p>;
}

function GlobalConstellationCanvas({ state, shells, filter, ntpuVisible, framePositions, frameShells }: {
  readonly state: VisualLabGlobalConstellationFirstFrameState;
  readonly shells: readonly (SixActsShellId | null)[] | null;
  readonly filter: Act1ShellFilter;
  readonly ntpuVisible: Uint8Array | null;
  readonly framePositions: Float32Array | null;
  readonly frameShells: readonly SixActsShellId[] | null;
}): ReactElement {
  const artifact: VisualLabGlobalConstellationArtifact | null = state.status === 'ready' ? state.artifact : null;
  return (
    <div
      className="global-constellation__canvas"
      data-testid="global-constellation-canvas"
      data-global-constellation={state.constellation}
      data-global-satellite-count={artifact?.satelliteCount ?? undefined}
      data-global-satellite-density={artifact ? (artifact.constellation === 'starlink' ? 'high' : 'lower') : undefined}
      aria-label={artifact ? `${constellationLabel(state.constellation)} 全球衛星點雲，${formatCount(artifact.satelliteCount)} 顆衛星` : '全球衛星點雲載入中'}
    >
      <Canvas
        camera={{ position: act1NtpuCameraPosition(8.6), fov: 31 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#020a10']} />
        <ambientLight intensity={0.72} />
        <hemisphereLight args={['#bfefff', '#06131c', 0.88]} />
        <directionalLight position={[4, 5, 4]} intensity={2.1} color="#e8fbff" />
        <Stars radius={60} depth={36} count={420} factor={1.6} saturation={0.1} fade speed={0.16} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={4.1}
          maxDistance={15}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI - 0.25}
        />
        {artifact === null
          ? <VisualLabGlobalScene
            frame={null}
            artifact={null}
            status={sceneStatus(state)}
            error={state.status === 'error' ? state.error : null}
            theme="dark"
            locale="zh-Hant"
            pointPresentation="constellation-compare"
          />
          : <>
            <EarthSphere palette={GLOBAL_SCENE_PALETTES.dark} />
            <Act1NtpuMarker apexWorld={act1NtpuApexWorld()} />
            <Act1ConstellationPointCloud
              artifact={artifact}
              shells={shells}
              filter={filter}
              ntpuVisible={ntpuVisible}
              framePositions={framePositions}
              frameShells={frameShells}
            />
          </>}
      </Canvas>
      <div className="global-constellation__canvas-hint" aria-hidden="true">拖曳旋轉地球 · 滾輪縮放</div>
    </div>
  );
}

function formatOffset(offsetSec: number): string {
  if (offsetSec === 0) return '封存時刻';
  const sign = offsetSec > 0 ? '+' : '−';
  const total = Math.abs(offsetSec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${sign}${minutes} 分${seconds === 0 ? '' : ` ${seconds} 秒`}`;
}

const ACT1_PLAY_SPEEDS: readonly { readonly value: number; readonly label: string }[] = Object.freeze([
  Object.freeze({ value: 0.5, label: '慢動作 ×0.5' }),
  Object.freeze({ value: 1, label: '×1' }),
  Object.freeze({ value: 4, label: '×4' }),
]);

function Act1Timeline({
  offsetSec, readySpanSec, spanSec, stepSec, status, frameCount, readyFrameCount, error, onChange,
  playing, playSpeed, onPlayToggle, onSpeed,
}: {
  readonly offsetSec: number;
  readonly readySpanSec: number;
  readonly spanSec: number;
  readonly stepSec: number;
  readonly status: string;
  readonly frameCount: number;
  readonly readyFrameCount: number;
  readonly error: string | null;
  readonly onChange: (next: number) => void;
  readonly playing: boolean;
  readonly playSpeed: number;
  readonly onPlayToggle: () => void;
  readonly onSpeed: (next: number) => void;
}): ReactElement {
  const usable = readySpanSec > 0;
  const progress = frameCount === 0 ? 0 : Math.min(1, readyFrameCount / frameCount);
  return (
    <div className="global-constellation__timeline" data-testid="act1-timeline">
      <div className="global-constellation__timeline-head">
        <span>TIME · SGP4</span>
        <strong>{formatOffset(offsetSec)}</strong>
        {error === null
          ? <em>
            {usable
              // The label states the span that EXISTS, so a lecturer is never
              // dragging into a range the worker has not reached.
              ? `可拖 ±${Math.round(readySpanSec / 60)} 分（已算 ${Math.round(progress * 100)}%，最終 ±${Math.round(spanSec / 60)} 分）`
              : '正在算軌道幀…'}
          </em>
          : <em className="is-error">時間推進失敗：{error}</em>}
      </div>
      <div className="global-constellation__transport">
        <button
          type="button"
          className="global-constellation__play"
          disabled={!usable}
          aria-pressed={playing}
          onClick={onPlayToggle}
        >{playing ? '暫停' : '播放'}</button>
        <div className="global-constellation__speeds" role="group" aria-label="播放速度">
          {ACT1_PLAY_SPEEDS.map(option => (
            <button key={option.value} type="button"
              className={playSpeed === option.value ? 'is-active' : ''}
              disabled={!usable}
              onClick={() => onSpeed(option.value)}>{option.label}</button>
          ))}
        </div>
        <small>整個星座持續運動，可見衛星數量隨時間變化，這正是換手機制的背景。</small>
      </div>
      <input
        type="range"
        min={-spanSec}
        max={spanSec}
        step={stepSec}
        value={offsetSec}
        disabled={!usable}
        aria-label="時間推進"
        aria-valuetext={formatOffset(offsetSec)}
        onChange={event => {
          const next = Number(event.target.value);
          // Clamp to the computed span rather than letting the thumb run ahead
          // of the data and freeze on a stale frame.
          onChange(Math.max(-readySpanSec, Math.min(readySpanSec, next)));
        }}
      />
      <div className="global-constellation__timeline-scale" aria-hidden="true">
        <span>−{Math.round(spanSec / 60)} 分</span>
        <span>封存時刻</span>
        <span>+{Math.round(spanSec / 60)} 分</span>
      </div>
      <div className="global-constellation__timeline-ready" aria-hidden="true">
        <i style={{ width: `${(readySpanSec / spanSec) * 100}%` }} />
      </div>
    </div>
  );
}

export function GlobalConstellationPrototype(): ReactElement {
  const [constellation, setConstellation] = useState<SimulatorConstellation>('starlink');
  const [state, setState] = useState<VisualLabGlobalConstellationFirstFrameState>(() => (
    visualLabGlobalConstellationStore.state('starlink')
  ));

  useEffect(() => {
    setState(visualLabGlobalConstellationStore.state(constellation));
    const unsubscribe = visualLabGlobalConstellationStore.subscribe((next) => {
      if (next.constellation === constellation) setState(next);
    });
    void visualLabGlobalConstellationStore.load(constellation);
    return unsubscribe;
  }, [constellation]);

  // Opens on the WHOLE constellation. Defaulting to the 53 deg shell showed only
  // that shell's hard +/-53 deg latitude limit, which reads as a broken render
  // rather than as the fact it is. The boundary is the teaching point once the
  // room filters down to it, not the first impression.
  const [filter, setFilter] = useState<Act1ShellFilter>('all');
  const [catalog, setCatalog] = useState<readonly Act1OrbitRecord[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalog(null);
    setCatalogError(null);
    loadAct1OrbitCatalog(constellation, controller.signal)
      .then(records => { if (!controller.signal.aborted) setCatalog(records); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(error instanceof Error ? error.message : '軌道傾角資料載入失敗');
      });
    return () => controller.abort();
  }, [constellation]);

  const artifact = state.status === 'ready' ? state.artifact : null;
  const selectedLabel = constellationLabel(constellation);

  const shells = useMemo(
    () => (artifact === null || catalog === null
      ? null
      : alignAct1ShellsToArtifact(artifact.satelliteIds, catalog)),
    [artifact, catalog],
  );
  // Tallied from the aligned array the buttons also count, so the panel and the
  // caption can never report different totals for one fact.


  const ntpuVisible = useMemo(() => {
    if (artifact === null || catalog === null) return null;
    const elevations = computeAct1Elevations(catalog, artifact.instantUtc);
    return alignAct1VisibilityToArtifact(
      artifact.satelliteIds,
      catalog,
      elevations,
      SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG,
    );
  }, [artifact, catalog]);

  const frameState = useAct1Frames(
    constellation,
    artifact?.instantUtc ?? null,
    SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG,
  );
  const [offsetSec, setOffsetSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const liveFrame = useAct1FrameAt(frameState, offsetSec);

  // The scrubber only reaches where frames actually exist, so it can never
  // present a gap as if it were data.
  const readySpanSec = frameState.readySpanSec;

  // Time advance. It steps whole frames rather than interpolating: every point
  // on screen is then a real SGP4 position, not a tween between two of them.
  useEffect(() => {
    if (!playing || readySpanSec === 0) return undefined;
    const timer = globalThis.setInterval(() => {
      setOffsetSec(previous => {
        const next = previous + ACT1_FRAME_STEP_SEC;
        // Loop back to the start of the computed span so a lecturer can leave
        // it running while talking.
        return next > readySpanSec ? -readySpanSec : next;
      });
    }, 900 / playSpeed);
    return () => globalThis.clearInterval(timer);
  }, [playing, playSpeed, readySpanSec]);
  useEffect(() => {
    if (Math.abs(offsetSec) > readySpanSec) setOffsetSec(readySpanSec * Math.sign(offsetSec));
  }, [readySpanSec, offsetSec]);
  useEffect(() => { setOffsetSec(0); }, [constellation]);

  // ONE shell array feeds the buttons, the tally and the render. The worker's
  // catalogue supersedes the artifact-aligned one as soon as it lands, because
  // the render switches to worker frames at the same moment; keeping two would
  // put two counts for one fact back on screen.
  const activeShells: readonly (SixActsShellId | null)[] | null =
    frameState.shells.length > 0 ? frameState.shells : shells;

  const census = useMemo(
    () => (activeShells === null ? null : tallySixActsShells(activeShells)),
    [activeShells],
  );

  const drawnCount = activeShells?.length ?? artifact?.satelliteCount ?? null;

  const shellCount = activeShells === null
    ? null
    : (filter === 'all'
      ? activeShells.length
      : activeShells.reduce<number>((sum, shell) => sum + (shell === filter ? 1 : 0), 0));

  const ntpuConeCount = useMemo(
    () => (liveFrame !== null
      ? liveFrame.visibleCount
      : ntpuVisible === null ? null : ntpuVisible.reduce<number>((sum, value) => sum + value, 0)),
    [ntpuVisible, liveFrame],
  );


  return (
    <main className="global-constellation" lang="zh-Hant">
      <SixActsNav currentHref="/prototype/global-constellation" />
      <header className="global-constellation__header">
        <div>
          <p className="global-constellation__kicker">GLOBAL CONSTELLATION · TLE / SGP4</p>
          <h1>地球觀測點與全球星座</h1>
          <p className="global-constellation__lede">切換 Starlink 或 OneWeb，直接比較全球衛星數量與軌道高度的差異。</p>
        </div>
        <aside className="global-constellation__badge" role="note">
          <strong>DISPLAY-ONLY GLOBAL VIEW</strong>
          <span>只改變全球顯示</span>
          <small>不改變服務或換手決策</small>
        </aside>
      </header>

      <section className="global-constellation__workspace">
        <aside className="global-constellation__panel global-constellation__controls" aria-label="全球星座控制">
          <div className="global-constellation__panel-heading">
            <span>CONSTELLATION</span>
            <h2>選擇衛星系統</h2>
            <p>兩組資料來自同一個封存時間點；切換後，地球周圍點雲數量隨星座資料集改變。</p>
          </div>

          <div className="global-constellation__selector" role="group" aria-label="選擇星座">
            {CONSTELLATIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={constellation === option.id ? 'is-active' : ''}
                aria-pressed={constellation === option.id}
                onClick={() => setConstellation(option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>

          <SourceState state={state} />

          <div className="global-constellation__rule" />
          <p className="global-constellation__section-label">ORBITAL SHELL</p>
          <div className="global-constellation__shells" role="group" aria-label="選擇軌道殼層">
            {ACT1_SHELL_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? 'is-active' : ''}
                aria-pressed={filter === option.id}
                disabled={activeShells === null}
                onClick={() => setFilter(option.id)}
              >
                {option.colour === null
                  ? <i className="is-all" aria-hidden="true" />
                  : <i style={{ background: option.colour }} aria-hidden="true" />}
                <span>{option.labelZhHant}</span>
                <em>{activeShells === null
                  ? '—'
                  : formatCount(option.id === 'all'
                    ? activeShells.length
                    : activeShells.reduce<number>((sum, shell) => sum + (shell === option.id ? 1 : 0), 0))}</em>
              </button>
            ))}
          </div>
          <p className="global-constellation__shell-claim">{act1ShellClaim(filter)}</p>
          {catalogError === null
            ? activeShells === null
              ? <p className="global-constellation__source-state" role="status" aria-live="polite">正在讀取逐顆軌道傾角…</p>
              : null
            : <p className="global-constellation__source-state is-error" role="alert">傾角資料載入失敗：{catalogError}</p>}

          <div className="global-constellation__rule" />
          <p className="global-constellation__section-label">CURRENT VIEW</p>
          <p className="global-constellation__selection"><strong>{selectedLabel}</strong><span>全球整球視角</span></p>
          <p className="global-constellation__note">此頁面負責展示星座規模；服務衛星、候選衛星、UE 與換手流程仍由 3D 教學首頁呈現。</p>
        </aside>

        <section className="global-constellation__stage" aria-label="全球衛星場景">
          <div className="global-constellation__stage-heading">
            <div>
              <span>EARTH SCALE</span>
              <h2>{selectedLabel} 全球衛星分布</h2>
            </div>
            <p>{drawnCount === null ? '衛星資料準備中' : `${formatCount(drawnCount)} 顆衛星 · ${constellation === 'starlink' ? '高密度點雲' : '較低密度點雲'}`}</p>
          </div>
          <Act1Timeline
            offsetSec={offsetSec}
            readySpanSec={readySpanSec}
            spanSec={ACT1_FRAME_SPAN_SEC}
            stepSec={ACT1_FRAME_STEP_SEC}
            status={frameState.status}
            playing={playing}
            playSpeed={playSpeed}
            onPlayToggle={() => setPlaying(value => !value)}
            onSpeed={setPlaySpeed}
            frameCount={frameState.frameCount}
            readyFrameCount={frameState.frames.size}
            error={frameState.error}
            onChange={next => { setPlaying(false); setOffsetSec(next); }}
          />
          <GlobalConstellationCanvas
            state={state}
            shells={shells}
            filter={filter}
            ntpuVisible={liveFrame === null ? ntpuVisible : liveFrame.visible}
            framePositions={liveFrame?.positions ?? null}
            frameShells={frameState.shells.length > 0 ? frameState.shells : null}
          />
          <div className="global-constellation__legend" aria-label="場景圖例">
            <span><i className="is-satellite" />衛星點雲（每點 1 顆）</span>
            <span><i className="is-visible" />NTPU 仰角 {SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG}° 可見圓錐</span>
            <span><i className="is-earth" />地球半徑基準</span>
          </div>
        </section>

        <aside className="global-constellation__panel global-constellation__insights" aria-label="全球星座資料摘要">
          <div className="global-constellation__panel-heading">
            <span>OBSERVATION</span>
            <h2>數量差異</h2>
            <p>把全球規模和 NTPU 當下可見數量分開讀。</p>
          </div>
          <dl className="global-constellation__metrics">
            <Metric
              label="全球衛星總數"
              value={drawnCount === null ? '—' : formatCount(drawnCount)}
              note={artifact === null || drawnCount === null || drawnCount === artifact.satelliteCount
                ? '封存快照中的衛星'
                // The two sets really differ: the published first-frame artifact
                // drops records its propagation gate rejects. Saying so beats
                // showing two totals and letting the room wonder which is real.
                : `封存 ${formatCount(drawnCount)} 顆；已發佈 first-frame artifact 收錄 ${formatCount(artifact.satelliteCount)} 顆`}
            />
            <Metric label="NTPU 可見（地平線）" value={artifact ? formatCount(artifact.ntpuVisibleSatelliteCount) : '—'} note="仰角 0° 以上，含貼地平線那些" />
            <Metric label={`NTPU 可見（${SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG}° 圓錐）`} value={ntpuConeCount === null ? '—' : formatCount(ntpuConeCount)} note="這一幕用的口徑；比地平線嚴格" />
            <Metric label="中位軌道高度" value={artifact ? `${Math.round(artifact.medianAltitudeKm).toLocaleString('en-US')} km` : '—'} note="同一時間點的統計" />
            <Metric label="資料時間" value={artifact ? artifact.instantUtc.slice(0, 10) : '—'} note="UTC archived TLE" />
          </dl>
          {census ? <div className="global-constellation__honesty">
            <span>誠實邊界</span>
            <strong>{shellCount === null ? '—' : `${formatCount(shellCount)} 顆在目前殼層`}</strong>
            <small>{describeSixActsShellHonesty(census, selectedLabel)}</small>
          </div> : null}
          {artifact ? <div className="global-constellation__density-readout">
            <span>密集度讀法</span>
            <strong>{artifact.constellation === 'starlink' ? '高密度全球點雲' : '較低密度全球點雲'}</strong>
            <small>每個亮點代表 1 顆衛星；點大小只為可讀性，不代表實體尺寸。</small>
          </div> : null}
          {artifact ? <p className="global-constellation__provenance">來源：{artifact.snapshotPath}<br />SHA-256：{artifact.snapshotSha256}</p> : null}
        </aside>
      </section>

      <SixActsBridge currentHref="/prototype/global-constellation" />

      <footer className="global-constellation__footer">
        <span>全球顯示層</span>
        <strong>REAL ARCHIVED TLE · SGP4</strong>
        <span>不作為服務／換手決策輸入</span>
      </footer>
    </main>
  );
}
