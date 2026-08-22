import { useMemo, useState, type ReactElement } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { propagate, twoline2satrec } from 'satellite.js';

import {
  EarthSphere,
  GLOBAL_SCENE_PALETTES,
} from '../../prototype/visual-lab-g0/VisualLabGlobalScene';
import { NTPU_TLE_OBSERVER, deriveObserverLinkGeometry } from '../../simulator/observer';
import {
  TLE_JOURNEY_SOURCE_NOTE_ZH_HANT,
  TLE_JOURNEY_STATIONS,
  type TleJourneyStationId,
} from './tleJourneyStations';
import {
  TLE_LINE_LENGTH,
  decodeTleFields,
  deriveTleFacts,
  tleChecksum,
  tleFieldAtColumn,
  type TleFieldSpec,
} from './tleFields';
import { findTleJourneyPass } from './tleJourneyPass';
import { SixActsOverlayCard, SixActsOverlayStage } from '../nav/SixActsAnnotation';
import { SixActsBridge, SixActsNav } from '../nav/SixActsNav';
import './TleJourneyRoute.scss';

/** The bundled teaching record, from public/tle-archive/oneweb/oneweb_20260812.tle. */
const SAMPLE = Object.freeze({
  name: 'ONEWEB-0314',
  line1: '1 49100U 21075AB  26223.89537308 -.00000237  00000+0 -64275-3 0  9997',
  line2: '2 49100  87.9193 354.7822 0001578  89.4957 270.6355 13.17649174240903',
  sourcePath: '/tle-archive/oneweb/oneweb_20260812.tle',
});

function ProvenanceTag({ tier }: { readonly tier: 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION' }): ReactElement {
  const label = tier === 'SOURCE' ? '原始資料' : tier === 'MODEL-DERIVED' ? '模型推得' : '課堂假設';
  return <span className={`tle-journey__tier is-${tier.toLowerCase()}`}>{tier} · {label}</span>;
}

/* -- station 2 ------------------------------------------------------------- */

interface ColumnHover {
  readonly field: TleFieldSpec;
  /** Percent across the walk, so the card tracks the column under the cursor. */
  readonly leftPercent: number;
  readonly lineNumber: 1 | 2;
}

function ColumnWalk({
  line, lineNumber, onHover,
}: {
  readonly line: string;
  readonly lineNumber: 1 | 2;
  readonly onHover: (hover: ColumnHover | null) => void;
}): ReactElement {
  return (
    <div className="tle-journey__columns" onMouseLeave={() => onHover(null)}>
      {Array.from(line.padEnd(TLE_LINE_LENGTH), (character, index) => {
        const field = tleFieldAtColumn(index, lineNumber);
        return (
          <span
            key={index}
            className={field === null ? 'is-gap' : field.narrated ? 'is-narrated' : ''}
            data-field={field?.id}
            onMouseEnter={event => {
              if (field === null) { onHover(null); return; }
              const target = event.currentTarget;
              const parent = target.parentElement;
              if (parent === null) { onHover(null); return; }
              const left = target.offsetLeft - parent.scrollLeft + target.offsetWidth / 2;
              onHover({
                field,
                leftPercent: Math.max(0, Math.min(100, (left / parent.clientWidth) * 100)),
                lineNumber,
              });
            }}
          >{character === ' ' ? ' ' : character}</span>
        );
      })}
    </div>
  );
}

function ChecksumLab({
  line, lineNumber,
}: {
  readonly line: string;
  readonly lineNumber: 1 | 2;
}): ReactElement {
  const [edited, setEdited] = useState(line);
  const result = tleChecksum(edited);
  const changed = edited !== line;

  return (
    <div className="tle-journey__checksum">
      <label>
        <span>改壞一位數字試試</span>
        <input
          type="text"
          value={edited}
          spellCheck={false}
          onChange={event => setEdited(event.target.value.slice(0, TLE_LINE_LENGTH))}
        />
      </label>
      <p className={result.valid ? 'is-ok' : 'is-bad'}>
        {result.valid
          ? `檢核碼通過：前 68 欄算出 ${result.expected}，最後一欄就是 ${result.actual}。`
          : `檢核碼不符：前 68 欄算出 ${result.expected}，但最後一欄寫的是 ${Number.isFinite(result.actual) ? result.actual : '？'}。這筆資料會被擋下來。`}
      </p>
      {changed
        ? <button type="button" onClick={() => setEdited(line)}>還原原始第 {lineNumber} 行</button>
        : <p className="tle-journey__hint">任何一位數字改掉，最後一欄就對不上——這是資料傳輸出錯時的第一道防線。</p>}
    </div>
  );
}

/* -- station 3 ------------------------------------------------------------- */

function Sgp4Contract({ offsetMin }: { readonly offsetMin: number }): ReactElement {
  const output = useMemo(() => {
    const satrec = twoline2satrec(SAMPLE.line1, SAMPLE.line2);
    const facts = deriveTleFacts(SAMPLE.line1, SAMPLE.line2);
    const when = new Date(Date.parse(facts.epochUtc) + offsetMin * 60_000);
    const propagated = propagate(satrec, when);
    if (propagated?.position === undefined || propagated.velocity === undefined) return null;
    const p = propagated.position as { x: number; y: number; z: number };
    const v = propagated.velocity as { x: number; y: number; z: number };
    return {
      instantUtc: when.toISOString(),
      position: p,
      speedKmPerSec: Math.hypot(v.x, v.y, v.z),
      altitudeKm: Math.hypot(p.x, p.y, p.z) - 6378.137,
    };
  }, [offsetMin]);

  return (
    <div className="tle-journey__contract">
      <div className="tle-journey__contract-box is-in">
        <span>輸入</span>
        <code>TLE（那三行字）</code>
        <code>時間 t</code>
      </div>
      <div className="tle-journey__contract-arrow" aria-hidden="true">
        <strong>SGP4</strong>
        <small>這一站只教契約，不教推導</small>
      </div>
      <div className="tle-journey__contract-box is-out">
        <span>輸出</span>
        {output === null
          ? <code>無法傳播</code>
          : <>
            <code>位置 ({output.position.x.toFixed(0)}, {output.position.y.toFixed(0)}, {output.position.z.toFixed(0)}) km</code>
            <code>速度 {output.speedKmPerSec.toFixed(3)} km/s</code>
            <code>高度 {output.altitudeKm.toFixed(0)} km</code>
            <small>{output.instantUtc}</small>
          </>}
      </div>
    </div>
  );
}

/* -- station 4 ------------------------------------------------------------- */

function PassCurve({ cursorMs, onCursor }: {
  readonly cursorMs: number | null;
  readonly onCursor: (instantMs: number) => void;
}): ReactElement {
  const pass = useMemo(() => findTleJourneyPass(
    SAMPLE.line1,
    SAMPLE.line2,
    Date.parse('2026-08-12T00:00:00.000Z'),
    6 * 3600,
    30,
    10,
  ), []);

  if (pass === null) return <p className="tle-journey__hint">這段時間內沒有通過。</p>;

  const width = 640;
  const height = 200;
  const maxElevation = Math.max(90, pass.peakElevationDeg);
  const x = (instantMs: number) =>
    ((instantMs - pass.riseMs) / (pass.setMs - pass.riseMs)) * width;
  const y = (elevationDeg: number) => height - (elevationDeg / maxElevation) * height;
  const path = pass.samples.map((sample, index) =>
    `${index === 0 ? 'M' : 'L'}${x(sample.instantMs).toFixed(1)},${y(sample.elevationDeg).toFixed(1)}`).join(' ');
  const cursor = cursorMs ?? pass.peakMs;
  const atCursor = pass.samples.reduce((best, sample) =>
    Math.abs(sample.instantMs - cursor) < Math.abs(best.instantMs - cursor) ? sample : best, pass.samples[0]!);

  return (
    <div className="tle-journey__pass">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="仰角對時間的通過曲線">
        <path d={`${path} L${width},${height} L0,${height} Z`} className="tle-journey__pass-fill" />
        <path d={path} className="tle-journey__pass-line" />
        <line x1={x(atCursor.instantMs)} x2={x(atCursor.instantMs)} y1={0} y2={height} className="tle-journey__pass-cursor" />
      </svg>
      <input
        type="range"
        min={pass.riseMs}
        max={pass.setMs}
        step={30_000}
        value={cursor}
        aria-label="拖曳通過時刻"
        onChange={event => onCursor(Number(event.target.value))}
      />
      <dl className="tle-journey__pass-readout">
        <div><dt>此刻仰角</dt><dd>{atCursor.elevationDeg.toFixed(1)}°</dd></div>
        <div><dt>方位</dt><dd>{atCursor.azimuthDeg.toFixed(0)}°</dd></div>
        <div><dt>距離</dt><dd>{Math.round(atCursor.rangeKm).toLocaleString('en-US')} km</dd></div>
        <div><dt>整段長度</dt><dd>{(pass.durationSec / 60).toFixed(1)} 分</dd></div>
      </dl>
      <p className="tle-journey__hint">
        升起 {new Date(pass.riseMs).toISOString().slice(11, 19)} →
        最高 {new Date(pass.peakMs).toISOString().slice(11, 19)}（{pass.peakElevationDeg.toFixed(1)}°）→
        落下 {new Date(pass.setMs).toISOString().slice(11, 19)} UTC。
        一顆衛星在你頭上，就只有這麼久。
      </p>
    </div>
  );
}

/* -- station 5 ------------------------------------------------------------- */

function MiniGlobe({ instantMs }: { readonly instantMs: number }): ReactElement {
  const marker = useMemo(() => {
    const satrec = twoline2satrec(SAMPLE.line1, SAMPLE.line2);
    const when = new Date(instantMs);
    const propagated = propagate(satrec, when);
    if (propagated?.position === undefined) return null;
    const p = propagated.position as { x: number; y: number; z: number };
    const geometry = deriveObserverLinkGeometry(p, when.toISOString(), NTPU_TLE_OBSERVER);
    const scale = 2.48 / 6378.137;
    return {
      position: [p.x * scale, p.z * scale, -p.y * scale] as [number, number, number],
      elevationDeg: geometry.elevationDeg,
    };
  }, [instantMs]);

  return (
    <div className="tle-journey__globe">
      <Canvas camera={{ position: [0, 2, 9], fov: 32 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#020a10']} />
        <ambientLight intensity={0.8} />
        <EarthSphere palette={GLOBAL_SCENE_PALETTES.dark} />
        {marker === null ? null : (
          <mesh position={marker.position}>
            <sphereGeometry args={[0.06, 16, 12]} />
            <meshBasicMaterial color="#ffd78a" />
          </mesh>
        )}
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={4} maxDistance={14} />
      </Canvas>
      <p className="tle-journey__globe-caption">
        {marker === null ? '無法傳播' : `此刻從 NTPU 看，仰角 ${marker.elevationDeg.toFixed(1)}°`}
      </p>
    </div>
  );
}

/* -- route ----------------------------------------------------------------- */

export function TleJourneyRoute(): ReactElement {
  const [stationId, setStationId] = useState<TleJourneyStationId>('raw-record');
  const [hovered, setHovered] = useState<ColumnHover | null>(null);
  const [clockOffsetMin, setClockOffsetMin] = useState(0);
  const [cursorMs, setCursorMs] = useState<number | null>(null);
  const [handedOff, setHandedOff] = useState(false);

  const station = TLE_JOURNEY_STATIONS.find(candidate => candidate.id === stationId)!;
  const facts = useMemo(() => deriveTleFacts(SAMPLE.line1, SAMPLE.line2), []);
  const fields = useMemo(() => [...decodeTleFields(SAMPLE.line1, 1), ...decodeTleFields(SAMPLE.line2, 2)], []);

  return (
    <main className="tle-journey" lang="zh-Hant">
      <SixActsNav currentHref="/course/tle-journey" />
      <header className="tle-journey__header">
        <p className="tle-journey__kicker">ACT 2 · TLE 之旅</p>
        <h1>衛星位置是誰算出來的？</h1>
        <p className="tle-journey__lede">五站，從三行純文字一路長成天上的一個點。</p>
      </header>

      <nav className="tle-journey__steps" aria-label="五站">
        {TLE_JOURNEY_STATIONS.map(candidate => (
          <button
            key={candidate.id}
            type="button"
            className={candidate.id === stationId ? 'is-active' : ''}
            aria-current={candidate.id === stationId}
            onClick={() => setStationId(candidate.id)}
          >
            <em>{candidate.order}</em>
            <span>{candidate.titleZhHant}</span>
          </button>
        ))}
      </nav>

      <section className="tle-journey__stage" aria-live="polite">
        <div className="tle-journey__stage-head">
          <h2>{station.titleZhHant}</h2>
          <ProvenanceTag tier={station.provenance} />
        </div>
        <p className="tle-journey__question">{station.questionZhHant}</p>
        <p className="tle-journey__handson">{station.handsOnZhHant}</p>

        {stationId === 'raw-record' ? (
          <div className="tle-journey__raw">
            <pre>{SAMPLE.name}{'\n'}{SAMPLE.line1}{'\n'}{SAMPLE.line2}</pre>
            <p className="tle-journey__source">來源：{SAMPLE.sourcePath}（封存快照）</p>
            <p className="tle-journey__hint">{TLE_JOURNEY_SOURCE_NOTE_ZH_HANT}</p>
          </div>
        ) : null}

        {stationId === 'column-walk' ? (
          <div className="tle-journey__walk">
            <SixActsOverlayStage>
              <ColumnWalk line={SAMPLE.line1} lineNumber={1} onHover={setHovered} />
              <ColumnWalk line={SAMPLE.line2} lineNumber={2} onHover={setHovered} />
              {/* The explanation follows the column it is about. A fixed panel
                  below made the room look away from the characters to read
                  about them, which is the one thing this station cannot afford. */}
              {hovered === null ? null : (
                <SixActsOverlayCard
                  leftPercent={hovered.leftPercent}
                  // Always BELOW both lines: a card over the characters hides
                  // the very columns it is explaining.
                  topPercent={104}
                  anchor={hovered.leftPercent > 62 ? 'top-right' : 'top-left'}
                  content={{
                    eyebrow: `第 ${hovered.field.startColumn}–${hovered.field.endColumn} 欄`,
                    title: hovered.field.labelZhHant,
                    body: hovered.field.explainZhHant,
                    rows: [{
                      label: '這一欄的內容',
                      value: (fields.find(field => field.id === hovered.field.id)?.raw ?? '').trim() || '（空白）',
                    }],
                    tone: hovered.field.narrated ? 'source' : 'neutral',
                  }}
                />
              )}
            </SixActsOverlayStage>
            <p className="tle-journey__hint">
              滑過任何一欄，解說卡會直接跟到那一欄底下。畫底線的是這一堂會停下來講的欄位。
            </p>
            <div className="tle-journey__derived">
              <div><dt>平均運動</dt><dd>{facts.meanMotionRevPerDay.toFixed(8)} 圈/天</dd></div>
              <div><dt>1440 ÷ 它 =</dt><dd>{facts.orbitalPeriodMin.toFixed(2)} 分／圈</dd></div>
              <div><dt>傾角</dt><dd>{facts.inclinationDeg.toFixed(4)}°（極軌）</dd></div>
              <div><dt>Epoch</dt><dd>{facts.epochUtc.slice(0, 19)}Z</dd></div>
            </div>
            <ChecksumLab line={SAMPLE.line2} lineNumber={2} />
          </div>
        ) : null}

        {stationId === 'sgp4-contract' ? (
          <div className="tle-journey__sgp4">
            <Sgp4Contract offsetMin={clockOffsetMin} />
            <label className="tle-journey__clock">
              <span>從 epoch 起算 {clockOffsetMin} 分鐘</span>
              <input
                type="range"
                min={0}
                max={Math.round(facts.orbitalPeriodMin)}
                step={1}
                value={clockOffsetMin}
                onChange={event => setClockOffsetMin(Number(event.target.value))}
              />
            </label>
            <p className="tle-journey__hint">
              拖滿一圈是 {facts.orbitalPeriodMin.toFixed(0)} 分鐘——剛才那個除法算出來的數字，在這裡就看得到。
            </p>
          </div>
        ) : null}

        {stationId === 'ntpu-pass' ? <PassCurve cursorMs={cursorMs} onCursor={setCursorMs} /> : null}

        {stationId === 'simulator-fuel' ? (
          <div className="tle-journey__handoff">
            <MiniGlobe instantMs={cursorMs ?? Date.parse('2026-08-12T05:34:00.000Z')} />
            <button type="button" className="tle-journey__cta" onClick={() => setHandedOff(true)}>
              把這顆衛星放進模擬器
            </button>
            {handedOff
              ? <p className="tle-journey__done">
                已交棒。接下來幾幕的服務衛星、候選衛星、換手判斷，全部從剛才那三行字算出來。
              </p>
              : null}
          </div>
        ) : null}
      </section>

      <SixActsBridge currentHref="/course/tle-journey" />

      <footer className="tle-journey__footer">
        <span>ACT 2</span>
        <strong>REAL ARCHIVED TLE · SGP4</strong>
        <span>封存快照，非即時抓取</span>
      </footer>
    </main>
  );
}
