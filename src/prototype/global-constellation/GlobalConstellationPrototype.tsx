import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useEffect, useState, type ReactElement } from 'react';
import type { SimulatorConstellation } from '../../simulator/types';
import {
  visualLabGlobalConstellationStore,
  type VisualLabGlobalConstellationArtifact,
  type VisualLabGlobalConstellationFirstFrameState,
} from '../../visualLab/globalConstellation';
import {
  VisualLabGlobalScene,
  type VisualLabGlobalSceneStatus,
} from '../visual-lab-g0/VisualLabGlobalScene';
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

function GlobalConstellationCanvas({ state }: { readonly state: VisualLabGlobalConstellationFirstFrameState }): ReactElement {
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
        camera={{ position: [0, 0.2, 8.6], fov: 31 }}
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
        <VisualLabGlobalScene
          frame={null}
          artifact={artifact}
          status={sceneStatus(state)}
          error={state.status === 'error' ? state.error : null}
          theme="dark"
          locale="zh-Hant"
          pointPresentation="constellation-compare"
        />
      </Canvas>
      <div className="global-constellation__canvas-hint" aria-hidden="true">拖曳旋轉地球 · 滾輪縮放</div>
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

  const artifact = state.status === 'ready' ? state.artifact : null;
  const selectedLabel = constellationLabel(constellation);

  return (
    <main className="global-constellation" lang="zh-Hant">
      <header className="global-constellation__header">
        <div>
          <p className="global-constellation__kicker">GLOBAL CONSTELLATION · TLE / SGP4</p>
          <h1>一顆地球，看見整個星座</h1>
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
            <p>兩組資料來自同一個封存時間點；切換後，地球周圍點雲數量會跟著改變。</p>
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
          <p className="global-constellation__section-label">CURRENT VIEW</p>
          <p className="global-constellation__selection"><strong>{selectedLabel}</strong><span>全球整球視角</span></p>
          <p className="global-constellation__note">這個 route 只負責展示星座規模；服務衛星、候選衛星、UE 與換手流程仍留在 3D 教學 route。</p>
        </aside>

        <section className="global-constellation__stage" aria-label="全球衛星場景">
          <div className="global-constellation__stage-heading">
            <div>
              <span>EARTH SCALE</span>
              <h2>{selectedLabel} 全球衛星分布</h2>
            </div>
            <p>{artifact ? `${formatCount(artifact.satelliteCount)} 顆衛星 · ${artifact.constellation === 'starlink' ? '高密度點雲' : '較低密度點雲'}` : '衛星資料準備中'}</p>
          </div>
          <GlobalConstellationCanvas state={state} />
          <div className="global-constellation__legend" aria-label="場景圖例">
            <span><i className="is-satellite" />衛星點雲（每點 1 顆）</span>
            <span><i className="is-visible" />NTPU 可見範圍</span>
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
            <Metric label="全球衛星總數" value={artifact ? formatCount(artifact.satelliteCount) : '—'} note="完整封存集合" />
            <Metric label="NTPU 可見" value={artifact ? formatCount(artifact.ntpuVisibleSatelliteCount) : '—'} note="仰角高於地平線" />
            <Metric label="中位軌道高度" value={artifact ? `${Math.round(artifact.medianAltitudeKm).toLocaleString('en-US')} km` : '—'} note="同一時間點的統計" />
            <Metric label="資料時間" value={artifact ? artifact.instantUtc.slice(0, 10) : '—'} note="UTC archived TLE" />
          </dl>
          {artifact ? <div className="global-constellation__density-readout">
            <span>密集度讀法</span>
            <strong>{artifact.constellation === 'starlink' ? '高密度全球點雲' : '較低密度全球點雲'}</strong>
            <small>每個亮點代表 1 顆衛星；點大小只為可讀性，不代表實體尺寸。</small>
          </div> : null}
          {artifact ? <p className="global-constellation__provenance">來源：{artifact.snapshotPath}<br />SHA-256：{artifact.snapshotSha256}</p> : null}
        </aside>
      </section>

      <footer className="global-constellation__footer">
        <span>全球顯示層</span>
        <strong>REAL ARCHIVED TLE · SGP4</strong>
        <span>不作為服務／換手決策輸入</span>
      </footer>
    </main>
  );
}
