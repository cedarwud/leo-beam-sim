import { useMemo, useState, type CSSProperties } from 'react';
import './ScientificExplainPrototype.scss';

type FocusStep = 'geometry' | 'power' | 'efficiency';

interface DemoMetrics {
  readonly gainRatio: number;
  readonly gainDb: number;
  readonly gammaRequired: number;
  readonly requestedPowerW: number;
  readonly actualPowerW: number;
  readonly sinrLinear: number;
  readonly sinrDb: number;
  readonly throughputMbps: number;
  readonly systemPowerW: number;
  readonly eeMbitPerJ: number;
  readonly capped: boolean;
}

const DEMO_BANDWIDTH_MHZ = 20;
const DEMO_INTERFERENCE_AND_NOISE_W = 0.16;
const DEMO_FIXED_SYSTEM_POWER_W = 6;
const DEMO_PA_EFFICIENCY = 0.35;

function calculateDemoMetrics(thetaDeg: number, rateTargetMbps: number, powerCapW: number): DemoMetrics {
  const gainRatio = Math.exp(-0.18 * thetaDeg * thetaDeg);
  const gainDb = 10 * Math.log10(Math.max(gainRatio, 1e-9));
  const gammaRequired = Math.pow(2, rateTargetMbps / DEMO_BANDWIDTH_MHZ) - 1;
  const requestedPowerW = gammaRequired * DEMO_INTERFERENCE_AND_NOISE_W / Math.max(gainRatio, 1e-9);
  const actualPowerW = Math.min(requestedPowerW, powerCapW);
  const sinrLinear = actualPowerW * gainRatio / DEMO_INTERFERENCE_AND_NOISE_W;
  const sinrDb = 10 * Math.log10(Math.max(sinrLinear, 1e-9));
  const throughputMbps = DEMO_BANDWIDTH_MHZ * Math.log2(1 + sinrLinear);
  const systemPowerW = DEMO_FIXED_SYSTEM_POWER_W + actualPowerW / DEMO_PA_EFFICIENCY;
  const eeMbitPerJ = throughputMbps / systemPowerW;

  return {
    gainRatio,
    gainDb,
    gammaRequired,
    requestedPowerW,
    actualPowerW,
    sinrLinear,
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

const FOCUS_COPY: Record<FocusStep, { eyebrow: string; title: string; body: string }> = {
  geometry: {
    eyebrow: '01 · SPACE → CHANNEL',
    title: '先看離軸角如何改變增益',
    body: '拖動 θ。UE 射線離開波束中心後，增益條會縮短，需求功率隨之提高。中央角度採視覺放大，數值仍顯示原始角度。',
  },
  power: {
    eyebrow: '02 · TARGET → POWER',
    title: '再看目標速率與功率上限',
    body: '提高最低速率目標會推高需求 SINR 與需求功率；若需求超過上限，實際功率停在上限，吞吐量便無法追上目標。',
  },
  efficiency: {
    eyebrow: '03 · SERVICE ÷ ENERGY',
    title: '最後一起判讀吞吐量與系統功率',
    body: '瞬時 EE 不是單看功率高低，而是比較同一狀態下的吞吐量與系統功率。右側保留兩者，避免只看最後一個比值。',
  },
};

const HEX_CELLS = [
  [400, 405], [315, 405], [485, 405], [357, 335], [443, 335], [315, 265], [485, 265],
] as const;

function hexPoints(cx: number, cy: number, radius = 38) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 3 * index;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(' ');
}

export function ScientificExplainPrototype() {
  const [thetaDeg, setThetaDeg] = useState(2.4);
  const [rateTargetMbps, setRateTargetMbps] = useState(6);
  const [powerCapW, setPowerCapW] = useState(0.8);
  const [focus, setFocus] = useState<FocusStep>('geometry');

  const metrics = useMemo(
    () => calculateDemoMetrics(thetaDeg, rateTargetMbps, powerCapW),
    [thetaDeg, rateTargetMbps, powerCapW],
  );

  const visualAngle = thetaDeg / 7 * 0.56;
  const satelliteX = 400;
  const satelliteY = 64;
  const ueX = 400 + Math.sin(visualAngle) * 286;
  const ueY = 408;
  const arcRadius = 72;
  const arcEndX = satelliteX + Math.sin(visualAngle) * arcRadius;
  const arcEndY = satelliteY + Math.cos(visualAngle) * arcRadius;
  const beamOpacity = 0.18 + 0.42 * Math.min(metrics.actualPowerW / Math.max(powerCapW, 0.01), 1);
  const particleDuration = Math.max(0.75, 3.2 - metrics.throughputMbps / 8);
  const sceneStyle = {
    '--beam-opacity': beamOpacity,
    '--flow-duration': `${particleDuration}s`,
  } as CSSProperties;

  const reset = () => {
    setThetaDeg(2.4);
    setRateTargetMbps(6);
    setPowerCapW(0.8);
    setFocus('geometry');
  };

  return (
    <main className="scientific-prototype" style={sceneStyle}>
      <header className="scientific-prototype__header">
        <div>
          <p className="scientific-prototype__kicker">ANGLE-AWARE EE · VISUAL PROTOTYPE</p>
          <h1>讓公式真的進入場景</h1>
          <p className="scientific-prototype__lede">從離軸角、功率控制到吞吐量與瞬時能效，先用一頁看清楚因果關係。</p>
        </div>
        <div className="prototype-badge" role="note">
          <span>FRONT-END DEMO</span>
          <strong>固定示意資料</strong>
          <small>未接 TLE／canonical／後端</small>
        </div>
      </header>

      <nav className="story-stepper" aria-label="示意說明階段">
        {(Object.keys(FOCUS_COPY) as FocusStep[]).map((step, index) => (
          <button
            key={step}
            type="button"
            className={focus === step ? 'is-active' : ''}
            onClick={() => setFocus(step)}
          >
            <span>0{index + 1}</span>
            {step === 'geometry' ? '空間與增益' : step === 'power' ? '目標與功率' : '服務與能效'}
          </button>
        ))}
      </nav>

      <section className="scientific-prototype__workspace">
        <aside className="prototype-panel prototype-controls" aria-label="示意參數">
          <div className="panel-heading">
            <span>INPUTS</span>
            <h2>調整參數</h2>
            <p>三個控制項皆只影響這個前端示意模型。</p>
          </div>

          <label className={focus === 'geometry' ? 'control-row is-emphasized' : 'control-row'}>
            <span className="control-row__label"><b>離軸角</b><i>θ</i></span>
            <output>{format(thetaDeg, 1)}°</output>
            <input
              type="range"
              min="0"
              max="7"
              step="0.1"
              value={thetaDeg}
              onChange={(event) => setThetaDeg(Number(event.target.value))}
            />
            <small>波束中心方向與 UE 射線的夾角</small>
          </label>

          <label className={focus === 'power' ? 'control-row is-emphasized' : 'control-row'}>
            <span className="control-row__label"><b>最低速率目標</b><i>R<sub>min</sub></i></span>
            <output>{format(rateTargetMbps, 1)} Mbit/s</output>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={rateTargetMbps}
              onChange={(event) => setRateTargetMbps(Number(event.target.value))}
            />
            <small>先轉成需求 SINR，再形成需求功率</small>
          </label>

          <label className={focus === 'power' ? 'control-row is-emphasized' : 'control-row'}>
            <span className="control-row__label"><b>射頻功率上限</b><i>P<sub>max</sub></i></span>
            <output>{format(powerCapW, 2)} W</output>
            <input
              type="range"
              min="0.05"
              max="1.5"
              step="0.05"
              value={powerCapW}
              onChange={(event) => setPowerCapW(Number(event.target.value))}
            />
            <small>需求功率超過此值時進入功率受限</small>
          </label>

          <button className="prototype-reset" type="button" onClick={reset}>回到示意起點</button>
        </aside>

        <section className={`prototype-scene focus-${focus}`} aria-label="空間與能量流示意場景">
          <div className="scene-narrative">
            <p>{FOCUS_COPY[focus].eyebrow}</p>
            <h2>{FOCUS_COPY[focus].title}</h2>
            <span>{FOCUS_COPY[focus].body}</span>
          </div>

          <svg viewBox="0 0 800 500" role="img" aria-labelledby="demo-scene-title demo-scene-desc">
            <title id="demo-scene-title">離軸角、波束、UE 與能量流的示意圖</title>
            <desc id="demo-scene-desc">黃色服務波束連至七個示意 cell，藍色候選衛星僅作角色提示。調整離軸角與功率參數會更新射線、增益與流量視覺。</desc>
            <defs>
              <linearGradient id="beam-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#ffe78a" stopOpacity="0.02" />
                <stop offset="1" stopColor="#f6be45" stopOpacity="0.75" />
              </linearGradient>
              <filter id="beam-glow" x="-40%" y="-20%" width="180%" height="150%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>

            <g className="context-orbits" aria-hidden="true">
              <path d="M70 94 Q400 -30 730 94" />
              <circle cx="116" cy="72" r="5" /><circle cx="675" cy="61" r="4" />
            </g>

            <g className="candidate-satellite" transform="translate(636 106)">
              <path d="M-34 0 H34 M0 -20 V20" />
              <rect x="-15" y="-9" width="30" height="18" rx="5" />
              <text x="0" y="39">候選 · 示意</text>
            </g>
            <path className="candidate-guide" d={`M636 118 L${ueX} ${ueY}`} />

            <g className="service-satellite" transform={`translate(${satelliteX} ${satelliteY})`}>
              <path d="M-48 0 H48 M0 -27 V27" />
              <rect x="-20" y="-12" width="40" height="24" rx="7" />
              <circle cx="0" cy="0" r="4" />
              <text x="0" y="-38">服務衛星</text>
            </g>

            <path className="beam-glow" d="M400 75 L222 445 L578 445 Z" />
            <path className="beam-body" d="M400 75 L222 445 L578 445 Z" />
            <line className="boresight" x1={satelliteX} y1={satelliteY + 14} x2="400" y2="425" />
            <line className="ue-ray" x1={satelliteX} y1={satelliteY + 14} x2={ueX} y2={ueY} />
            <line className="energy-flow" x1={satelliteX} y1={satelliteY + 14} x2={ueX} y2={ueY} />
            <path className="theta-arc" d={`M400 ${satelliteY + arcRadius} A${arcRadius} ${arcRadius} 0 0 0 ${arcEndX} ${arcEndY}`} />
            <text className="theta-label" x={410 + Math.sin(visualAngle / 2) * 82} y={satelliteY + 68}>θ {format(thetaDeg, 1)}°</text>
            <text className="magnify-label" x="416" y="158">角度視覺放大</text>

            <g className="cell-field">
              {HEX_CELLS.map(([cx, cy], index) => (
                <polygon key={`${cx}-${cy}`} points={hexPoints(cx, cy)} className={index === 0 ? 'is-primary' : ''} />
              ))}
            </g>
            <g className="ue-marker" transform={`translate(${ueX} ${ueY})`}>
              <circle r="12" />
              <circle r="4" />
              <text x="18" y="5">代表 UE</text>
            </g>

            <g className="scene-gain-meter" transform="translate(72 395)">
              <text x="0" y="-14">發射增益 Gᵀ(θ) / G₀</text>
              <rect width="164" height="12" rx="6" />
              <rect className="scene-gain-meter__value" width={164 * metrics.gainRatio} height="12" rx="6" />
              <text x="172" y="11">{formatGainRatio(metrics.gainRatio)}</text>
            </g>
          </svg>

          <div className="causal-ribbon" aria-label="示意因果鏈">
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

        <aside className="prototype-panel prototype-results" aria-label="示意計算結果">
          <div className="panel-heading">
            <span>OUTPUTS</span>
            <h2>同一狀態的結果</h2>
            <p>每次調整後，全部數值一起更新。</p>
          </div>

          <div className={metrics.capped ? 'result-status is-limited' : 'result-status is-reachable'}>
            <span>{metrics.capped ? 'POWER LIMITED' : 'TARGET REACHABLE'}</span>
            <strong>{metrics.capped ? '功率受限' : '目標可達'}</strong>
            <small>{metrics.capped ? `尚差 ${format(rateTargetMbps - metrics.throughputMbps, 1)} Mbit/s` : '實際吞吐量已達示意目標'}</small>
          </div>

          <dl className="result-ledger">
            <div><dt>發射增益</dt><dd>{format(metrics.gainDb, 1)} dB</dd><small>Gᵀ(θ) / G₀ = {formatGainRatio(metrics.gainRatio)}</small></div>
            <div><dt>需求 SINR</dt><dd>{format(10 * Math.log10(Math.max(metrics.gammaRequired, 1e-9)), 1)} dB</dd><small>由最低速率目標形成</small></div>
            <div><dt>需求／實際功率</dt><dd>{format(metrics.requestedPowerW, 3)} / {format(metrics.actualPowerW, 3)} W</dd><small>實際值受 P<sub>max</sub> 限制</small></div>
            <div><dt>實現 SINR</dt><dd>{format(metrics.sinrDb, 1)} dB</dd><small>訊號相對於干擾與雜訊</small></div>
            <div><dt>實際吞吐量</dt><dd>{format(metrics.throughputMbps, 1)} Mbit/s</dd><small>目標為 {format(rateTargetMbps, 1)} Mbit/s</small></div>
            <div><dt>系統功率</dt><dd>{format(metrics.systemPowerW, 2)} W</dd><small>固定功耗 + 示意 PA 功耗</small></div>
          </dl>

          <section className={focus === 'efficiency' ? 'ee-card is-emphasized' : 'ee-card'}>
            <span>瞬時能效 · EE<sub>demo</sub></span>
            <strong>{format(metrics.eeMbitPerJ, 2)}</strong>
            <em>Mbit/J</em>
            <div><b>{format(metrics.throughputMbps, 1)} Mbit/s</b><i>÷</i><b>{format(metrics.systemPowerW, 2)} W</b></div>
          </section>

          <details className="demo-formulas">
            <summary>查看示意公式</summary>
            <p>Gᵀ/G₀ = exp(−0.18 θ²)</p>
            <p>γ<sub>req</sub> = 2<sup>Rmin / 20</sup> − 1</p>
            <p>P<sub>actual</sub> = min(P<sub>req</sub>, P<sub>max</sub>)</p>
            <p>EE<sub>demo</sub> = R<sub>demo</sub> / P<sub>sys,demo</sub></p>
          </details>
        </aside>
      </section>

      <footer className="scientific-prototype__footer">
        <strong>PROTOTYPE · DO NOT CITE</strong>
        <span>這一頁只驗證「參數—場景—結果」的視覺敘事；數值不是論文公式、TLE 結果或節能證據。</span>
      </footer>
    </main>
  );
}
