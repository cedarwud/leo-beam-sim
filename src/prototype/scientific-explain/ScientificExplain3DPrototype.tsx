import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import './ScientificExplain3DPrototype.scss';

type FocusStep = 'geometry' | 'power' | 'efficiency';

interface DemoMetrics {
  readonly gainRatio: number;
  readonly gainDb: number;
  readonly gammaRequired: number;
  readonly requestedPowerW: number;
  readonly actualPowerW: number;
  readonly sinrDb: number;
  readonly throughputMbps: number;
  readonly systemPowerW: number;
  readonly eeMbitPerJ: number;
  readonly capped: boolean;
}

const BANDWIDTH_MHZ = 20;
const INTERFERENCE_AND_NOISE_W = 0.16;
const FIXED_SYSTEM_POWER_W = 6;
const PA_EFFICIENCY = 0.35;
const SERVICE_POSITION: [number, number, number] = [0, 4.35, 0];
const CANDIDATE_POSITION: [number, number, number] = [2.2, 3.5, -1.45];

const FOCUS_COPY: Record<FocusStep, { index: string; title: string; body: string }> = {
  geometry: {
    index: '01 · GEOMETRY',
    title: '離軸角離開波束中心',
    body: '鏡頭可拖曳旋轉；黃色虛線是波束中心，實線連到代表 UE。角度在場景中放大，讀值仍是原始 θ。',
  },
  power: {
    index: '02 · POWER',
    title: '通道損失轉成需求功率',
    body: '離軸增益下降時，射線上的能量流與需求功率一起改變。需求超過上限後，實際功率停在上限。',
  },
  efficiency: {
    index: '03 · EFFICIENCY',
    title: '服務量與系統功率一起判讀',
    body: '右側同時保留吞吐量、系統功率與瞬時 EE；避免只看最後比值，卻看不到服務量是否已經崩落。',
  },
};

const CELL_POSITIONS: ReadonlyArray<[number, number, number]> = [
  [0, 0.04, 0],
  [-1.1, 0.04, 0.22],
  [1.08, 0.04, -0.16],
  [-0.58, 0.04, -0.94],
  [0.61, 0.04, -1.03],
  [-0.72, 0.04, 1.02],
  [0.72, 0.04, 0.94],
];

function calculateMetrics(thetaDeg: number, rateTargetMbps: number, powerCapW: number): DemoMetrics {
  const gainRatio = Math.exp(-0.18 * thetaDeg * thetaDeg);
  const gainDb = 10 * Math.log10(Math.max(gainRatio, 1e-9));
  const gammaRequired = Math.pow(2, rateTargetMbps / BANDWIDTH_MHZ) - 1;
  const requestedPowerW = gammaRequired * INTERFERENCE_AND_NOISE_W / Math.max(gainRatio, 1e-9);
  const actualPowerW = Math.min(requestedPowerW, powerCapW);
  const sinrLinear = actualPowerW * gainRatio / INTERFERENCE_AND_NOISE_W;
  const sinrDb = 10 * Math.log10(Math.max(sinrLinear, 1e-9));
  const throughputMbps = BANDWIDTH_MHZ * Math.log2(1 + sinrLinear);
  const systemPowerW = FIXED_SYSTEM_POWER_W + actualPowerW / PA_EFFICIENCY;
  const eeMbitPerJ = throughputMbps / systemPowerW;

  return {
    gainRatio,
    gainDb,
    gammaRequired,
    requestedPowerW,
    actualPowerW,
    sinrDb,
    throughputMbps,
    systemPowerW,
    eeMbitPerJ,
    capped: requestedPowerW > powerCapW,
  };
}

function format(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function formatGainRatio(value: number) {
  return format(value, value < 0.001 ? 4 : 3);
}

function Satellite({ position, color, label }: {
  readonly position: [number, number, number];
  readonly color: string;
  readonly label: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.46, 0.28, 0.34]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.24} metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[-0.68, 0, 0]}>
        <boxGeometry args={[0.78, 0.03, 0.36]} />
        <meshStandardMaterial color="#123d4b" emissive={color} emissiveIntensity={0.08} metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0.68, 0, 0]}>
        <boxGeometry args={[0.78, 0.03, 0.36]} />
        <meshStandardMaterial color="#123d4b" emissive={color} emissiveIntensity={0.08} metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.12, 0.17, 0.18, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <Html center position={[0, 0.52, 0]} className="se3d-world-label">
        <span style={{ borderColor: color }}>{label}</span>
      </Html>
    </group>
  );
}

function EnergyParticles({ end, powerRatio }: {
  readonly end: [number, number, number];
  readonly powerRatio: number;
}) {
  const particles = useRef<Array<THREE.Mesh | null>>([]);
  const start = useMemo(() => new THREE.Vector3(...SERVICE_POSITION), []);
  const finish = useMemo(() => new THREE.Vector3(...end), [end]);
  const count = 9;

  useFrame(({ clock }) => {
    particles.current.forEach((particle, index) => {
      if (!particle) return;
      const progress = (clock.elapsedTime * (0.22 + powerRatio * 0.34) + index / count) % 1;
      particle.position.lerpVectors(start, finish, progress);
      const pulse = 0.62 + Math.sin((progress + index) * Math.PI * 2) * 0.2;
      particle.scale.setScalar(pulse);
    });
  });

  return (
    <group>
      {Array.from({ length: count }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => { particles.current[index] = node; }}
        >
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshBasicMaterial color="#ffe27d" transparent opacity={0.35 + powerRatio * 0.6} />
        </mesh>
      ))}
    </group>
  );
}

function ScientificScene({ thetaDeg, beamWidthDeg, metrics, powerCapW, focus }: {
  readonly thetaDeg: number;
  readonly beamWidthDeg: number;
  readonly metrics: DemoMetrics;
  readonly powerCapW: number;
  readonly focus: FocusStep;
}) {
  const visualThetaRad = THREE.MathUtils.degToRad(thetaDeg * 4.2);
  const beamHeight = 4.32;
  const beamRadius = Math.min(3.4, Math.max(.48, Math.tan(THREE.MathUtils.degToRad(beamWidthDeg)) * beamHeight));
  const uePosition = useMemo<[number, number, number]>(() => [
    Math.tan(visualThetaRad) * 3.55,
    0.2,
    0.12,
  ], [visualThetaRad]);
  const powerRatio = Math.min(metrics.actualPowerW / Math.max(powerCapW, 0.01), 1);
  const arcPoints = useMemo(() => Array.from({ length: 20 }, (_, index) => {
    const angle = visualThetaRad * (index / 19);
    return new THREE.Vector3(Math.sin(angle) * 0.76, 4.35 - Math.cos(angle) * 0.76, 0.02);
  }), [visualThetaRad]);

  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={.08}
        enablePan={false}
        rotateSpeed={.72}
        zoomSpeed={.8}
        minDistance={5.2}
        maxDistance={14}
        minPolarAngle={.35}
        maxPolarAngle={1.5}
        target={[0, 1.65, 0]}
      />
      <color attach="background" args={['#04100f']} />
      <fog attach="fog" args={['#04100f', 8, 15]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 7, 4]} intensity={2.4} color="#e8fff8" />
      <pointLight position={SERVICE_POSITION} intensity={8 + powerRatio * 10} distance={8} color="#f5bf4f" />

      <gridHelper args={[10, 20, '#1d4b45', '#102b28']} position={[0, -0.015, 0]} />
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[4.7, 4.7, 0.12, 72]} />
        <meshStandardMaterial color="#061917" metalness={0.1} roughness={0.9} />
      </mesh>

      <Satellite position={SERVICE_POSITION} color="#f5bf4f" label="服務衛星" />
      <Satellite position={CANDIDATE_POSITION} color="#43cbe8" label="候選衛星" />

      <mesh position={[0, beamHeight / 2 + .02, 0]}>
        <coneGeometry args={[beamRadius, beamHeight, 64, 1, true]} />
        <meshBasicMaterial
          color="#f5bf4f"
          transparent
          opacity={(focus === 'power' ? 0.16 : 0.1) + powerRatio * 0.09}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[Math.max(.18, beamRadius - .1), beamRadius, 72]} />
        <meshBasicMaterial color="#f5bf4f" transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>

      {CELL_POSITIONS.map((position, index) => (
        <mesh key={index} position={position}>
          <cylinderGeometry args={[0.62, 0.62, 0.07, 6]} />
          <meshStandardMaterial
            color={index === 0 ? '#735618' : '#103934'}
            emissive={index === 0 ? '#f5bf4f' : '#1b8c7b'}
            emissiveIntensity={index === 0 ? 0.38 : 0.1}
            transparent
            opacity={0.82}
            metalness={0.1}
            roughness={0.75}
          />
        </mesh>
      ))}

      <Line points={[[0, 4.12, 0], [0, 0.12, 0]]} color="#ffd466" lineWidth={1.25} dashed dashSize={0.12} gapSize={0.1} transparent opacity={0.65} />
      <Line points={[SERVICE_POSITION, uePosition]} color="#ffe27d" lineWidth={focus === 'geometry' ? 3.2 : 2.1} transparent opacity={0.95} />
      <Line points={[CANDIDATE_POSITION, uePosition]} color="#43cbe8" lineWidth={1.3} dashed dashSize={0.16} gapSize={0.12} transparent opacity={focus === 'efficiency' ? 0.8 : 0.42} />
      <Line points={arcPoints} color="#fff3b0" lineWidth={3.2} transparent opacity={focus === 'geometry' ? 1 : 0.62} />
      <EnergyParticles end={uePosition} powerRatio={powerRatio} />

      <group position={uePosition}>
        <mesh>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color="#fff1a8" emissive="#f5bf4f" emissiveIntensity={0.75} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.11, 0]}>
          <ringGeometry args={[0.22, 0.29, 32]} />
          <meshBasicMaterial color="#f5bf4f" transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
        <Html center position={[0.45, 0.08, 0]} className="se3d-world-label se3d-world-label--ue">
          <span>代表 UE</span>
        </Html>
      </group>

      <Html center position={[0.52, 3.72, 0.02]} className="se3d-angle-label">
        <strong>θ {format(thetaDeg, 1)}°</strong>
        <small>視覺角度放大</small>
      </Html>
    </>
  );
}

function Control({ label, symbol, value, display, min, max, step, help, emphasized, onChange }: {
  readonly label: string;
  readonly symbol: React.ReactNode;
  readonly value: number;
  readonly display: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly help: string;
  readonly emphasized: boolean;
  readonly onChange: (next: number) => void;
}) {
  return (
    <label className={emphasized ? 'se3d-control is-emphasized' : 'se3d-control'}>
      <span className="se3d-control__heading"><b>{label}</b><i>{symbol}</i><output>{display}</output></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{help}</small>
    </label>
  );
}

export function ScientificExplain3DPrototype() {
  const [thetaDeg, setThetaDeg] = useState(2.4);
  const [beamWidthDeg, setBeamWidthDeg] = useState(31.5);
  const [rateTargetMbps, setRateTargetMbps] = useState(6);
  const [powerCapW, setPowerCapW] = useState(0.8);
  const [focus, setFocus] = useState<FocusStep>('geometry');
  const metrics = useMemo(
    () => calculateMetrics(thetaDeg, rateTargetMbps, powerCapW),
    [thetaDeg, rateTargetMbps, powerCapW],
  );
  const gammaRequiredDb = 10 * Math.log10(Math.max(metrics.gammaRequired, 1e-9));

  const reset = () => {
    setThetaDeg(2.4);
    setBeamWidthDeg(31.5);
    setRateTargetMbps(6);
    setPowerCapW(0.8);
    setFocus('geometry');
  };

  return (
    <main className="se3d-prototype">
      <header className="se3d-header">
        <div>
          <p>ANGLE-AWARE EE · CONTROLLED 3D PROTOTYPE</p>
          <h1>把空間關係放回公式裡</h1>
          <span>拖曳鏡頭查看立體關係，調整波束大小觀察地面 footprint；場景負責解釋離軸角、功率與服務結果如何連動。</span>
        </div>
        <aside aria-label="Prototype status">
          <strong>3D FRONT-END DEMO</strong>
          <span>固定示意資料</span>
          <small>未接 TLE／canonical／後端</small>
        </aside>
      </header>

      <nav className="se3d-stepper" aria-label="示意說明階段">
        {(Object.keys(FOCUS_COPY) as FocusStep[]).map((step, index) => (
          <button key={step} type="button" className={focus === step ? 'is-active' : ''} onClick={() => setFocus(step)}>
            <span>0{index + 1}</span>
            {step === 'geometry' ? '空間與角度' : step === 'power' ? '通道與功率' : '服務與能效'}
          </button>
        ))}
      </nav>

      <section className="se3d-workspace">
        <aside className="se3d-panel se3d-controls" aria-label="示意參數">
          <div className="se3d-panel-heading">
            <span>INPUTS</span>
            <h2>調整參數</h2>
            <p>控制項只驅動這一頁的示意模型。</p>
          </div>
          <Control
            label="離軸角"
            symbol={<>θ</>}
            value={thetaDeg}
            display={`${format(thetaDeg, 1)}°`}
            min={0}
            max={7}
            step={0.1}
            help="波束中心方向與 UE 射線的夾角"
            emphasized={focus === 'geometry'}
            onChange={setThetaDeg}
          />
          <Control
            label="波束大小"
            symbol={<>β</>}
            value={beamWidthDeg}
            display={`${format(beamWidthDeg, 1)}°`}
            min={8}
            max={36}
            step={0.5}
            help="示意波束半角；只改變地面 footprint，不改變數值鏈路"
            emphasized={focus === 'geometry'}
            onChange={setBeamWidthDeg}
          />
          <Control
            label="最低速率目標"
            symbol={<>R<sub>min</sub></>}
            value={rateTargetMbps}
            display={`${format(rateTargetMbps, 1)} Mbit/s`}
            min={1}
            max={10}
            step={0.5}
            help="先形成需求 SINR，再形成需求功率"
            emphasized={focus === 'power'}
            onChange={setRateTargetMbps}
          />
          <Control
            label="射頻功率上限"
            symbol={<>P<sub>max</sub></>}
            value={powerCapW}
            display={`${format(powerCapW, 2)} W`}
            min={0.05}
            max={1.5}
            step={0.05}
            help="需求功率超過此值時進入功率受限"
            emphasized={focus === 'power'}
            onChange={setPowerCapW}
          />
          <button type="button" className="se3d-reset" onClick={reset}>回到示意起點</button>
        </aside>

        <section className={`se3d-stage focus-${focus}`} aria-label="受控三維科學示意場景">
          <div className="se3d-narrative">
            <p>{FOCUS_COPY[focus].index}</p>
            <h2>{FOCUS_COPY[focus].title}</h2>
            <span>{FOCUS_COPY[focus].body}</span>
          </div>
          <div className="se3d-canvas" role="img" aria-label="衛星、波束、離軸角、代表 UE 與能量流的可旋轉三維示意">
            <Canvas
              camera={{ position: [6.1, 5.2, 7.2], fov: 38, near: 0.05, far: 30 }}
              dpr={[1, 1.25]}
              frameloop="always"
              shadows={false}
              gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            >
              <ScientificScene thetaDeg={thetaDeg} beamWidthDeg={beamWidthDeg} metrics={metrics} powerCapW={powerCapW} focus={focus} />
            </Canvas>
            <div className="se3d-camera-hint" aria-hidden="true">拖曳旋轉 · 滾輪縮放</div>
          </div>
          <div className="se3d-scene-key" aria-label="場景圖例">
            <span><i className="service" />服務鏈路</span>
            <span><i className="candidate" />候選鏈路</span>
            <span><i className="boresight" />波束中心</span>
          </div>
          <div className="se3d-causal" aria-label="示意因果鏈">
            <div className={focus === 'geometry' ? 'is-active' : ''}><span>θ</span><strong>{format(thetaDeg, 1)}°</strong></div>
            <i>→</i>
            <div className={focus === 'geometry' ? 'is-active' : ''}><span>Gᵀ/G₀</span><strong>{formatGainRatio(metrics.gainRatio)}</strong></div>
            <i>→</i>
            <div className={focus === 'power' ? 'is-active' : ''}><span>P<sub>actual</sub></span><strong>{format(metrics.actualPowerW, 3)} W</strong></div>
            <i>→</i>
            <div className={focus === 'efficiency' ? 'is-active' : ''}><span>R</span><strong>{format(metrics.throughputMbps, 1)} Mbit/s</strong></div>
            <i>→</i>
            <div className={focus === 'efficiency' ? 'is-active' : ''}><span>EE</span><strong>{format(metrics.eeMbitPerJ, 2)} Mbit/J</strong></div>
          </div>
        </section>

        <aside className="se3d-panel se3d-results" aria-label="示意計算結果">
          <div className="se3d-panel-heading">
            <span>OUTPUTS</span>
            <h2>同一狀態的結果</h2>
            <p>場景與數值使用同一組示意輸入。</p>
          </div>
          <section className={metrics.capped ? 'se3d-status is-limited' : 'se3d-status is-reachable'}>
            <span>{metrics.capped ? 'POWER LIMITED' : 'TARGET REACHABLE'}</span>
            <strong>{metrics.capped ? '功率受限' : '目標可達'}</strong>
            <small>{metrics.capped ? `尚差 ${format(rateTargetMbps - metrics.throughputMbps, 1)} Mbit/s` : '實際吞吐量已達示意目標'}</small>
          </section>
          <dl className="se3d-ledger">
            <div><dt>離軸增益</dt><dd>{format(metrics.gainDb, 1)} dB</dd><small>Gᵀ(θ) / G₀ = {formatGainRatio(metrics.gainRatio)}</small></div>
            <div><dt>需求 SINR</dt><dd>{format(gammaRequiredDb, 1)} dB</dd><small>由最低速率目標形成</small></div>
            <div><dt>需求功率</dt><dd>{format(metrics.requestedPowerW, 3)} W</dd><small>通道補償所需的示意值</small></div>
            <div><dt>實際功率</dt><dd>{format(metrics.actualPowerW, 3)} W</dd><small>受 P<sub>max</sub> 限制</small></div>
            <div><dt>實現 SINR</dt><dd>{format(metrics.sinrDb, 1)} dB</dd><small>實際鏈路狀態</small></div>
            <div><dt>實際吞吐量</dt><dd>{format(metrics.throughputMbps, 1)} Mbit/s</dd><small>目標 {format(rateTargetMbps, 1)} Mbit/s</small></div>
            <div><dt>系統功率</dt><dd>{format(metrics.systemPowerW, 2)} W</dd><small>固定功耗 + 示意 PA 功耗</small></div>
          </dl>
          <section className={focus === 'efficiency' ? 'se3d-ee is-emphasized' : 'se3d-ee'}>
            <span>瞬時能效 · EE<sub>demo</sub></span>
            <strong>{format(metrics.eeMbitPerJ, 2)}</strong>
            <em>Mbit/J</em>
            <div><b>{format(metrics.throughputMbps, 1)} Mbit/s</b><i>÷</i><b>{format(metrics.systemPowerW, 2)} W</b></div>
          </section>
        </aside>
      </section>

      <footer className="se3d-footer">
        <strong>PROTOTYPE · DO NOT CITE</strong>
        <span>只驗證受控 3D 是否能連結空間、參數與結果；數值不是論文公式、TLE 結果或節能證據。</span>
      </footer>
    </main>
  );
}
