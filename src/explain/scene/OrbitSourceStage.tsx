import { Canvas } from '@react-three/fiber';

import { SimulatorOrbitSceneContents } from '../../simulator/SimulatorOrbitScene';
import type { ScientificExplanationAvailableState } from '../route/scientificExplanationLoader';

function utcLabel(value: string): string {
  return value.replace('T', ' ').replace('.000Z', ' UTC');
}

export function OrbitSourceStage({
  state,
  onBack,
}: {
  readonly state: ScientificExplanationAvailableState;
  readonly onBack: () => void;
}) {
  const method = state.evidence.methodState;
  const identity = method.representativeLink;
  const snapshotParts = state.source.snapshotPath.split('/');
  const snapshotName = snapshotParts[snapshotParts.length - 1] ?? state.source.snapshotPath;

  return (
    <article
      id="explain-orbit-stage"
      className="explain-orbit-stage"
      data-scene-layer="orbit-source"
      data-source-run-id={method.run.analysisRunId}
      aria-label={`TLE 經 SGP4 推進所得的軌道場景；衛星 ${identity.satelliteId}`}
    >
      <div className="explain-orbit-stage__canvas" role="img" aria-label="同一筆 TLE 推進所得的地球、軌道、衛星與 NTPU 觀測位置">
        <Canvas
          camera={{ position: [2.65, 2.1, 2.65], fov: 42, near: 0.01, far: 20 }}
          dpr={[1, 1.6]}
          frameloop="demand"
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          fallback={<div className="explain-orbit-stage__fallback">此裝置無法建立 WebGL 軌道視圖。</div>}
        >
          <color attach="background" args={['#030807']} />
          <fog attach="fog" args={['#030807', 4.8, 10]} />
          <SimulatorOrbitSceneContents frame={method.frame} />
        </Canvas>
      </div>

      <header className="explain-orbit-stage__topbar">
        <button type="button" className="explain-orbit-stage__back" onClick={onBack}>
          <span aria-hidden="true">←</span> 返回問題
        </button>
        <div className="explain-orbit-stage__source">
          <span>已核對的軌道來源</span>
          <strong>{state.source.constellation.toUpperCase()} · {utcLabel(state.source.requestedInstantUtc)}</strong>
        </div>
      </header>

      <section className="explain-orbit-stage__narrative" aria-labelledby="orbit-source-title">
        <span className="explain-orbit-stage__chapter">軌道來源</span>
        <h2 id="orbit-source-title">TLE 先被推進成這一刻的衛星位置</h2>
        <p>畫面中的軌道線、衛星與觀測點，共用同一筆已核對資料與同一個 frame。拖曳可旋轉視角，滾輪可縮放。</p>
      </section>

      <aside className="explain-orbit-stage__identity" aria-label="目前場景身分">
        <span>同一筆資料</span>
        <dl>
          <div><dt>TLE</dt><dd>{snapshotName}</dd></div>
          <div><dt>衛星</dt><dd>{identity.satelliteId}</dd></div>
          <div><dt>波束／代表 UE</dt><dd>{identity.beamId} ／ {identity.userId}</dd></div>
          <div><dt>frame</dt><dd>{method.frame.frameId}</dd></div>
        </dl>
      </aside>

      <div className="explain-orbit-stage__legend" aria-label="軌道場景圖例">
        <span><i className="is-trajectory" />SGP4 軌跡</span>
        <span><i className="is-satellite" />目前衛星</span>
        <span><i className="is-observer" />NTPU 觀測點</span>
        <span><i className="is-context" />同星座衛星</span>
      </div>

      <ol className="explain-orbit-stage__chain" aria-label="從 TLE 到可服務判定的轉換順序">
        <li className="is-complete"><span>01</span><strong>TLE record</strong></li>
        <li className="is-current"><span>02</span><strong>SGP4 / TEME</strong></li>
        <li><span>03</span><strong>Earth-fixed</strong></li>
        <li><span>04</span><strong>NTPU topocentric</strong></li>
        <li><span>05</span><strong>可服務判定</strong></li>
      </ol>
    </article>
  );
}
