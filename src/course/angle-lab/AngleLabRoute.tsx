import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import {
  ANGLE_LAB_DEFAULT_THETA_3DB_DEG,
  ANGLE_LAB_SEGMENT_START_POWER_W,
  angleLabAngleForDrop,
  angleLabGainDb,
  angleLabStep,
  angleLabSweep,
  type AngleLabPatternMode,
} from './anglePowerChain';
import {
  ANGLE_LAB_CAMERAS,
  AngleLabScene,
  buildAngleLabGeometry,
  type AngleLabCamera,
} from './AngleLabScene';
import { SIX_ACTS_BEAM_POWER_CAP_W } from '../sixActs/powerSweep';
import { SixActsSubtitleBar } from '../nav/SixActsAnnotation';
import { SixActsBridge, SixActsNav } from '../nav/SixActsNav';
import {
  ANGLE_LAB_DEMOS,
  ANGLE_LAB_DEMO_DURATION_SEC,
  ANGLE_LAB_DEMO_SPEEDS,
  angleLabDemoStateAt,
  type AngleLabDemoMode,
} from './angleLabDemo';
import './AngleLabRoute.scss';

const SATELLITE_HEIGHT = 2.6;

function GainCurve({
  theta3dbDeg, mode, cursorDeg, maxThetaDeg,
}: {
  readonly theta3dbDeg: number;
  readonly mode: AngleLabPatternMode;
  readonly cursorDeg: number;
  readonly maxThetaDeg: number;
}): ReactElement {
  const width = 520;
  const height = 180;
  const floorDb = -30;

  const path = useMemo(() => {
    const points: string[] = [];
    for (let index = 0; index <= 260; index += 1) {
      const thetaDeg = (index / 260) * maxThetaDeg;
      const gainDb = Math.max(angleLabGainDb(thetaDeg, theta3dbDeg, mode), floorDb);
      const x = (thetaDeg / maxThetaDeg) * width;
      const y = height - ((gainDb - floorDb) / -floorDb) * height;
      points.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(' ');
  }, [theta3dbDeg, mode, maxThetaDeg]);

  const cursorX = (Math.min(cursorDeg, maxThetaDeg) / maxThetaDeg) * width;
  const halfWidthX = (Math.min(theta3dbDeg, maxThetaDeg) / maxThetaDeg) * width;
  const minus3dbY = height - ((-3 - floorDb) / -floorDb) * height;

  return (
    <svg className="angle-lab__curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="G^T(θ)/G₀ 對離軸角">
      <line x1={0} x2={width} y1={minus3dbY} y2={minus3dbY} className="angle-lab__curve-3db" />
      <line x1={halfWidthX} x2={halfWidthX} y1={0} y2={height} className="angle-lab__curve-halfwidth" />
      <path d={path} className="angle-lab__curve-line" />
      <line x1={cursorX} x2={cursorX} y1={0} y2={height} className="angle-lab__curve-cursor" />
      <text x={6} y={minus3dbY - 6} className="angle-lab__curve-label">−3 dB</text>
      <text x={halfWidthX + 6} y={16} className="angle-lab__curve-label">θ_3dB</text>
    </svg>
  );
}

export function AngleLabRoute(): ReactElement {
  const [camera, setCamera] = useState<AngleLabCamera>('side');
  const [steeringDeg, setSteeringDeg] = useState(0);
  const [ueNadirDeg, setUeNadirDeg] = useState(1.5);
  const [theta3dbDeg, setTheta3dbDeg] = useState(ANGLE_LAB_DEFAULT_THETA_3DB_DEG);
  const [mode, setMode] = useState<AngleLabPatternMode>('canonical');

  const [demo, setDemo] = useState<AngleLabDemoMode>('off');
  const [demoSpeed, setDemoSpeed] = useState(1);
  const [demoProgress, setDemoProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (demo === 'off') return undefined;
    let previous = performance.now();
    const tick = (now: number) => {
      const deltaSec = (now - previous) / 1000;
      previous = now;
      setDemoProgress(value => {
        const next = value + (deltaSec * demoSpeed) / ANGLE_LAB_DEMO_DURATION_SEC;
        // The pass loops so a lecturer can leave it running while talking.
        return next > 1 ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [demo, demoSpeed]);

  // While the demo runs it OWNS the two angles; the sliders take over the moment
  // it stops, from wherever it left off, so the room can poke at the frame.
  const demoState = demo === 'off' ? null : angleLabDemoStateAt(demo, demoProgress);
  const effectiveUeNadirDeg = demoState?.ueNadirDeg ?? ueNadirDeg;
  const effectiveSteeringDeg = demoState?.steeringDeg ?? steeringDeg;

  const preset = ANGLE_LAB_CAMERAS.find(candidate => candidate.id === camera)!;
  const geometry = useMemo(
    () => buildAngleLabGeometry({
      satelliteHeight: SATELLITE_HEIGHT,
      // The slider speaks in degrees off nadir because that is the quantity the
      // lecture names; a scene-unit slider made one step worth about a degree.
      ueGroundX: SATELLITE_HEIGHT * Math.tan((effectiveUeNadirDeg * Math.PI) / 180),
      steeringDeg: effectiveSteeringDeg,
    }),
    [effectiveUeNadirDeg, effectiveSteeringDeg],
  );

  const step = useMemo(() => angleLabStep({
    thetaDeg: geometry.offAxisDeg,
    previousThetaDeg: 0,
    previousPowerW: ANGLE_LAB_SEGMENT_START_POWER_W,
    theta3dbDeg,
    mode,
    ratedCapW: SIX_ACTS_BEAM_POWER_CAP_W,
  }), [geometry.offAxisDeg, theta3dbDeg, mode]);

  const sweep = useMemo(() => angleLabSweep({
    maxThetaDeg: theta3dbDeg * 3,
    stepDeg: theta3dbDeg / 8,
    theta3dbDeg,
    mode,
    ratedCapW: SIX_ACTS_BEAM_POWER_CAP_W,
  }), [theta3dbDeg, mode]);

  const target3dbDeg = useMemo(() => angleLabAngleForDrop(3, theta3dbDeg, mode), [theta3dbDeg, mode]);
  const dropError = Math.abs(step.gainDb + 3);
  const taskHit = dropError < 0.25;

  return (
    <main className="angle-lab" lang="zh-Hant">
      <SixActsNav currentHref="/course/angle-lab" />
      <header className="angle-lab__header">
        <p className="angle-lab__kicker">ACT 3 · 離軸角實驗室</p>
        <h1>兩個角度，一條角度感知的能量鏈</h1>
        <p className="angle-lab__lede">仰角量的是「衛星在你頭上多高」；離軸角量的是「你偏離波束準心多遠」。頂點不在同一個地方。</p>
      </header>

      <div className="angle-lab__body">
        <section className="angle-lab__stage">
          <div className="angle-lab__cameras" role="group" aria-label="鏡頭預設">
            {ANGLE_LAB_CAMERAS.map(option => (
              <button
                key={option.id}
                type="button"
                className={camera === option.id ? 'is-active' : ''}
                aria-pressed={camera === option.id}
                onClick={() => setCamera(option.id)}
              >{option.labelZhHant}</button>
            ))}
          </div>
          <p className="angle-lab__camera-why">{preset.whyZhHant}</p>

          <div className="angle-lab__demo" role="group" aria-label="自動演示">
            <span>自動演示：衛星飛過去</span>
            {ANGLE_LAB_DEMOS.map(option => (
              <button
                key={option.id}
                type="button"
                className={demo === option.id ? 'is-active' : ''}
                onClick={() => {
                  setDemo(current => (current === option.id ? 'off' : option.id));
                  setDemoProgress(0);
                }}
              >{option.labelZhHant}</button>
            ))}
            {demo === 'off' ? null : (
              <>
                <button type="button" className="is-stop" onClick={() => {
                  // Hand the frame back to the sliders where the demo stopped.
                  setUeNadirDeg(effectiveUeNadirDeg);
                  setSteeringDeg(effectiveSteeringDeg);
                  setDemo('off');
                }}>停止</button>
                <div className="angle-lab__demo-speeds">
                  {ANGLE_LAB_DEMO_SPEEDS.map(option => (
                    <button key={option.value} type="button"
                      className={demoSpeed === option.value ? 'is-active' : ''}
                      onClick={() => setDemoSpeed(option.value)}>{option.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="angle-lab__canvas">
            <Canvas key={camera} camera={{ position: [...preset.position], fov: 38 }} dpr={[1, 1.5]}>
              <color attach="background" args={['#020a10']} />
              <ambientLight intensity={0.85} />
              <directionalLight position={[3, 5, 4]} intensity={1.4} />
              <AngleLabScene geometry={geometry} theta3dbDeg={theta3dbDeg} />
              <OrbitControls makeDefault enableDamping dampingFactor={0.09} target={[...preset.target]} />
            </Canvas>
          </div>
          {demoState === null ? null : (
            <SixActsSubtitleBar
              eyebrow={ANGLE_LAB_DEMOS.find(option => option.id === demo)?.labelZhHant}
              text={ANGLE_LAB_DEMOS.find(option => option.id === demo)?.narrationZhHant ?? ''}
              rows={[
                { label: 'G^T(θ)/G₀', value: `${step.gainDb.toFixed(2)} dB` },
                { label: 'p(t)', value: step.atGainFloor ? '增益觸底' : `${step.powerW.toFixed(2)} W` },
                { label: demo === 'track-ue' ? 'steering' : 'θ',
                  value: `${(demo === 'track-ue' ? effectiveSteeringDeg : geometry.offAxisDeg).toFixed(1)}°` },
              ]}
              tone={step.overRatedCap || step.atGainFloor ? 'warn' : 'source'}
            />
          )}
        </section>

        <aside className="angle-lab__panel">
          <div className="angle-lab__readout">
            <div className="is-elevation"><dt>仰角 ε</dt><dd>{geometry.elevationDeg.toFixed(1)}°</dd><small>頂點在你腳下</small></div>
            <div className="is-offaxis"><dt>離軸角 θ</dt><dd>{geometry.offAxisDeg.toFixed(1)}°</dd><small>頂點在衛星</small></div>
          </div>

          <label className="angle-lab__slider">
            <span>波束中軸 steering　{effectiveSteeringDeg.toFixed(1)}°</span>
            <input type="range" min={-12} max={12} step={0.02} value={effectiveSteeringDeg}
              disabled={demo !== 'off'}
              onChange={event => setSteeringDeg(Number(event.target.value))} />
            <small>UE 不動，只把中軸歪過去——θ 就變了，ε 一動也不動。這就是兩者不同的證明。</small>
          </label>

          <label className="angle-lab__slider">
            <span>UE 偏離星下點　{effectiveUeNadirDeg.toFixed(2)}°</span>
            <input type="range" min={-12} max={12} step={0.02} value={effectiveUeNadirDeg}
              disabled={demo !== 'off'}
              onChange={event => setUeNadirDeg(Number(event.target.value))} />
            <small>steering 為 0 時，這個角度就是 θ。兩顆旋鈕一起玩，才看得出 θ 是「中軸到你」的夾角。</small>
          </label>

          <label className="angle-lab__slider">
            <span>θ_3dB（半功率波束寬）　{theta3dbDeg.toFixed(2)}°</span>
            <input type="range" min={1} max={12} step={0.02} value={theta3dbDeg}
              onChange={event => setTheta3dbDeg(Number(event.target.value))} />
            <small>這顆旋鈕真的接進數值鏈：波束越寬，同一個 θ 掉得越少。</small>
          </label>

          <div className="angle-lab__modes" role="group" aria-label="型樣模式">
            <button type="button" className={mode === 'demo' ? 'is-active' : ''} onClick={() => setMode('demo')}>DEMO 簡化型樣</button>
            <button type="button" className={mode === 'canonical' ? 'is-active' : ''} onClick={() => setMode('canonical')}>CANONICAL · HOBS J₁/J₃</button>
          </div>

          <GainCurve theta3dbDeg={theta3dbDeg} mode={mode} cursorDeg={geometry.offAxisDeg} maxThetaDeg={theta3dbDeg * 3} />

          <div className={`angle-lab__task ${taskHit ? 'is-hit' : ''}`}>
            <strong>任務：把 θ 調到剛好掉 3 dB</strong>
            <p>
              現在 G^T(θ)/G₀ = <b>{step.gainDb.toFixed(2)} dB</b>
              {taskHit ? '　✓ 到了——這個角度就是 θ_3dB 的定義。' : `　目標角度約 ${target3dbDeg.toFixed(2)}°`}
            </p>
          </div>

          <div className="angle-lab__chain">
            <p className="angle-lab__chain-title">角度感知功率律（同一 served segment 內）</p>
            <code>θ → G^T(θ) = G₀·F(θ, θ_3dB) → p(t) = p(t−1)·G^T(θ(t−1))/G^T(θ(t)) → γ → R → η</code>
            <div className="angle-lab__power">
              <div><dt>segment 起始 p</dt><dd>{ANGLE_LAB_SEGMENT_START_POWER_W.toFixed(2)} W</dd></div>
              <div><dt>此刻 p(t)</dt><dd className={step.overRatedCap ? 'is-over' : ''}>
                {step.atGainFloor ? '—' : `${step.powerW.toFixed(3)} W`}
              </dd></div>
              <div><dt>額定上限</dt><dd>{SIX_ACTS_BEAM_POWER_CAP_W.toFixed(2)} W</dd></div>
            </div>
            {step.atGainFloor
              ? <p className="angle-lab__over">
                增益已經觸底：波束實質上照不到這個 UE 了。這時候再談「要推多少功率」沒有意義——該做的是換一道波束，或換一顆衛星。
              </p>
              : step.overRatedCap
                ? <p className="angle-lab__over">需求已經超過額定上限——畫面照實顯示，不偷偷夾到上限。波束歪到極限就得換人。</p>
                : null}
          </div>

          <div className="angle-lab__ramp">
            <p className="angle-lab__chain-title">整段遞推：θ 越大，功率一路爬</p>
            <div className="angle-lab__ramp-bars">
              {sweep.map(entry => (
                <i
                  key={entry.thetaDeg}
                  className={entry.overRatedCap ? 'is-over' : ''}
                  style={{ height: `${Math.min(100, (entry.powerW / (SIX_ACTS_BEAM_POWER_CAP_W * 4)) * 100)}%` }}
                  title={`θ=${entry.thetaDeg.toFixed(2)}° · p=${entry.powerW.toFixed(2)} W`}
                />
              ))}
            </div>
            <small>「波束為了維持鏈路品質，會隨著你偏離中軸而把功率越推越高——指向誤差是有能量帳單的。」</small>
          </div>
        </aside>
      </div>

      <SixActsBridge currentHref="/course/angle-lab" />
    </main>
  );
}
