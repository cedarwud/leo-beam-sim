import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';

import { SixActsNav } from '../nav/SixActsNav';
import {
  SIX_ACTS_ACT5_HREF,
  SIX_ACTS_ACT6_HREF,
} from '../nav/sixActsRoutes';
import {
  DEFAULT_24_HOUR_SCHEDULE_START_UTC,
  DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
  DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
  EXPERIMENT_5_ALTERNATIVE_SATELLITES,
  EXPERIMENT_5_PRIMARY_SATELLITE,
  EXPERIMENT_6_CONSTELLATION_SATELLITES,
  NTPU_LAB_OBSERVER,
} from './fixtures';
import {
  compute24HourMultiSatSchedule,
  selectMaximumDurationSingleReceiverSchedule,
} from './multiSatScheduleModel';
import { computeSinglePassContactOpportunity } from './singlePassModel';
import {
  SUPPORTED_ELEVATION_MASKS_DEG,
  type SinglePassContactResult,
  type SupportedElevationMaskDeg,
  type TopocentricLookPoint,
} from './types';
import './ContactWindowLabRoute.scss';

const ACT5_SATELLITES = EXPERIMENT_5_ALTERNATIVE_SATELLITES.filter(
  satellite => satellite.constellation === 'OneWeb',
);

function utcTime(instantUtc: string | undefined): string {
  return instantUtc?.slice(11, 19) ?? '—';
}

function usePlaybackLoop(durationMs: number, resetKey: string) {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    setProgress(0);
    setIsPlaying(true);
  }, [resetKey]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      setProgress(current => {
        const next = current + delta / durationMs;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [durationMs, isPlaying]);

  const toggle = () => {
    if (progress >= 1) {
      setProgress(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying(current => !current);
  };
  const replay = () => {
    setProgress(0);
    setIsPlaying(true);
  };
  const seek = (nextProgress: number) => {
    setProgress(Math.max(0, Math.min(1, nextProgress)));
    setIsPlaying(false);
  };
  return { progress, isPlaying, toggle, replay, seek };
}

function MaskSelector({
  value,
  onChange,
  options = SUPPORTED_ELEVATION_MASKS_DEG,
}: {
  readonly value: SupportedElevationMaskDeg;
  readonly onChange: (value: SupportedElevationMaskDeg) => void;
  readonly options?: readonly SupportedElevationMaskDeg[];
}): ReactElement {
  return (
    <div className="contact-lab__mask" role="group" aria-label="最低可通聯仰角">
      {options.map(mask => (
        <button
          key={mask}
          type="button"
          className={mask === value ? 'is-active' : ''}
          aria-pressed={mask === value}
          data-testid={`contact-mask-${mask}`}
          onClick={() => onChange(mask)}
        >
          {mask}°
        </button>
      ))}
    </div>
  );
}

function Transport({
  isPlaying,
  progress,
  onToggle,
  onReplay,
  seek,
  timeLabel = null,
  nextHref,
  nextLabel,
}: {
  readonly isPlaying: boolean;
  readonly progress: number;
  readonly onToggle: () => void;
  readonly onReplay: () => void;
  readonly seek: (progress: number) => void;
  readonly timeLabel?: string | null;
  readonly nextHref: string | null;
  readonly nextLabel: string | null;
}): ReactElement {
  return (
    <footer className="contact-lab__transport">
      <div className="contact-lab__transport-buttons">
        <button type="button" onClick={onToggle}>{progress >= 1 ? '從頭播放' : isPlaying ? '暫停' : '繼續播放'}</button>
        <button type="button" onClick={onReplay}>重新播放</button>
      </div>
      <label className="contact-lab__progress">
        <span>{timeLabel ?? '教學動畫時間'}</span>
        <input
          type="range"
          min="0"
          max="1000"
          step="1"
          value={Math.round(progress * 1000)}
          onChange={event => seek(Number(event.currentTarget.value) / 1000)}
          aria-label="調整通聯預測時間游標"
          data-testid="contact-prediction-time-range"
        />
      </label>
      {nextHref && nextLabel ? <a href={nextHref}>{nextLabel} <span aria-hidden="true">→</span></a> : <a href="/">回首頁</a>}
    </footer>
  );
}

function currentPointFor(
  trajectory: readonly TopocentricLookPoint[],
  progress: number,
): TopocentricLookPoint | null {
  if (trajectory.length === 0) return null;
  return trajectory[Math.min(trajectory.length - 1, Math.round(progress * (trajectory.length - 1)))] ?? null;
}

function SinglePassLab(): ReactElement {
  const [satelliteId, setSatelliteId] = useState(EXPERIMENT_5_PRIMARY_SATELLITE.satelliteId);
  const [maskDeg, setMaskDeg] = useState<SupportedElevationMaskDeg>(10);
  const satellite = ACT5_SATELLITES.find(candidate => candidate.satelliteId === satelliteId)
    ?? EXPERIMENT_5_PRIMARY_SATELLITE;
  const result = useMemo(() => computeSinglePassContactOpportunity({
    tle: satellite,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: maskDeg,
    searchStartUtc: DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
    searchDurationSec: DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
    sampleStepSec: 10,
  }), [maskDeg, satellite]);
  const passTrajectory = useMemo(() => {
    if (!result.aos || !result.los) return result.trajectory;
    const paddingMs = 4 * 60 * 1000;
    return result.trajectory.filter(point => (
      point.instantMs >= result.aos!.instantMs - paddingMs
      && point.instantMs <= result.los!.instantMs + paddingMs
    ));
  }, [result]);
  const playback = usePlaybackLoop(16_000, `${satelliteId}:${maskDeg}`);
  const current = currentPointFor(passTrajectory, playback.progress);
  const peakElevation = Math.max(35, result.peak?.maxElevationDeg ?? 35);
  const chart = { left: 58, right: 18, top: 20, bottom: 44, width: 760, height: 330 };
  const innerWidth = chart.width - chart.left - chart.right;
  const innerHeight = chart.height - chart.top - chart.bottom;
  const chartStart = passTrajectory[0]?.instantMs ?? Date.parse(result.searchStartUtc);
  const chartEnd = passTrajectory[passTrajectory.length - 1]?.instantMs ?? Date.parse(result.searchEndUtc);
  const x = (instantMs: number) => chart.left + ((instantMs - chartStart) / Math.max(1, chartEnd - chartStart)) * innerWidth;
  const y = (elevationDeg: number) => chart.top + (1 - Math.max(0, Math.min(1, elevationDeg / peakElevation))) * innerHeight;
  const curvePoints = passTrajectory.map(point => `${x(point.instantMs).toFixed(1)},${y(point.elevationDeg).toFixed(1)}`).join(' ');
  const selectedAtFive = result.multiMaskComparison.find(row => row.elevationMaskDeg === 5)?.durationMinutes ?? 0;
  const reductionFromFive = Math.max(0, selectedAtFive - result.durationMinutes);

  return (
    <main
      className="contact-lab contact-lab--single"
      data-testid="contact-window-act5"
      data-mask-deg={maskDeg}
      data-scientific-category="GEOMETRIC_CONTACT_OPPORTUNITY"
      data-guaranteed-rf-service="false"
    >
      <SixActsNav currentHref={SIX_ACTS_ACT5_HREF} variant="stage" />
      <header className="contact-lab__header">
        <div><p>ACT 5 · SINGLE-PASS PREDICTION</p><h1>單次過境通聯窗口預測</h1><span>最低可通聯仰角如何改變 AOS、LOS 與幾何可用時長？</span></div>
        <aside><strong>ARCHIVED TLE · SGP4</strong><span>{satellite.constellation} · {satellite.epochUtc?.slice(0, 10)}</span><small>NTPU WGS84 觀測點</small></aside>
      </header>

      <section className="contact-lab__workspace">
        <aside className="contact-lab__panel contact-lab__controls">
          <div className="contact-lab__panel-heading"><p>INPUTS</p><h2>設定預測條件</h2><span>每次只顯示一顆衛星，所有數值會依選擇重新計算。</span></div>
          <label className="contact-lab__field">
            <span>封存 TLE 衛星</span>
            <select value={satelliteId} onChange={event => setSatelliteId(event.target.value)} data-testid="contact-satellite-select">
              {ACT5_SATELLITES.map(option => <option key={option.satelliteId} value={option.satelliteId}>{option.satelliteName} · {option.satelliteId}</option>)}
            </select>
          </label>
          <div className="contact-lab__field"><span>最低可通聯仰角 α<sub>min</sub></span><MaskSelector value={maskDeg} onChange={setMaskDeg} /></div>
          <dl className="contact-lab__ledger">
            <div><dt>觀測點</dt><dd>NTPU 三峽</dd></div>
            <div><dt>軌道推演</dt><dd>SGP4</dd></div>
            <div><dt>座標轉換</dt><dd>TEME → ECEF → WGS84</dd></div>
            <div><dt>交會求解</dt><dd>10 s 掃描 · 50 ms 細化</dd></div>
          </dl>
          <div className="contact-lab__formula">
            <span>觀測點座標系</span>
            <strong>α(t) = atan2(U, √(E² + N²))</strong>
            <p>AOS 與 LOS 是 α(t) = α<sub>min</sub> 的進入與離開時刻。</p>
          </div>
        </aside>

        <section className="contact-lab__stage" aria-label="單次過境可視化">
          <div className="contact-lab__stage-heading"><div><p>PASS GEOMETRY</p><h2>{satellite.satelliteName} · 仰角歷程</h2></div><output>{current ? `${utcTime(current.instantUtc)} UTC · α ${current.elevationDeg.toFixed(1)}°` : '無可用樣本'}</output></div>
          <div className="contact-lab__single-visuals">
            <figure className="contact-lab__elevation-chart">
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="仰角對時間曲線">
                {[0, maskDeg, Math.round(peakElevation / 2), Math.round(peakElevation)].filter((value, index, values) => values.indexOf(value) === index).map(value => (
                  <g key={value}><line x1={chart.left} y1={y(value)} x2={chart.width - chart.right} y2={y(value)} className={value === maskDeg ? 'is-mask' : ''} /><text x={chart.left - 9} y={y(value) + 5}>{value}°</text></g>
                ))}
                <polyline points={curvePoints} className="contact-lab__pass-curve" />
                {result.aos && <g className="is-aos"><circle cx={x(result.aos.instantMs)} cy={y(result.aos.elevationDeg)} r="7" /><text x={x(result.aos.instantMs)} y={y(result.aos.elevationDeg) - 14}>AOS</text></g>}
                {result.peak && <g className="is-peak"><circle cx={x(result.peak.instantMs)} cy={y(result.peak.maxElevationDeg)} r="7" /><text x={x(result.peak.instantMs)} y={y(result.peak.maxElevationDeg) - 14}>PEAK</text></g>}
                {result.los && <g className="is-los"><circle cx={x(result.los.instantMs)} cy={y(result.los.elevationDeg)} r="7" /><text x={x(result.los.instantMs)} y={y(result.los.elevationDeg) - 14}>LOS</text></g>}
                {current && <g className="is-current"><line x1={x(current.instantMs)} y1={chart.top} x2={x(current.instantMs)} y2={chart.height - chart.bottom} /><circle cx={x(current.instantMs)} cy={y(current.elevationDeg)} r="9" /></g>}
                <text x={chart.left} y={chart.height - 12}>{utcTime(new Date(chartStart).toISOString())}</text>
                <text x={chart.width - chart.right} y={chart.height - 12} textAnchor="end">{utcTime(new Date(chartEnd).toISOString())} UTC</text>
                <text x="18" y={chart.top + 24} className="contact-lab__axis-title">α</text>
              </svg>
            </figure>
            <figure className="contact-lab__skyplot">
              <svg viewBox="0 0 340 340" role="img" aria-label="NTPU 天空雷達視圖">
                <circle cx="170" cy="170" r="132" className="is-horizon" />
                <circle cx="170" cy="170" r={132 * (90 - maskDeg) / 90} className="is-mask" />
                {[0, 90, 180, 270].map(azimuth => <line key={azimuth} x1="170" y1="170" x2={170 + Math.sin(azimuth * Math.PI / 180) * 132} y2={170 - Math.cos(azimuth * Math.PI / 180) * 132} />)}
                <polyline points={passTrajectory.filter(point => point.elevationDeg >= 0).map(point => {
                  const radius = 132 * (90 - point.elevationDeg) / 90;
                  const azimuth = point.azimuthDeg * Math.PI / 180;
                  return `${(170 + Math.sin(azimuth) * radius).toFixed(1)},${(170 - Math.cos(azimuth) * radius).toFixed(1)}`;
                }).join(' ')} className="contact-lab__sky-track" />
                {current && (() => {
                  const radius = 132 * (90 - current.elevationDeg) / 90;
                  const azimuth = current.azimuthDeg * Math.PI / 180;
                  return <circle cx={170 + Math.sin(azimuth) * radius} cy={170 - Math.cos(azimuth) * radius} r="9" className="is-current" />;
                })()}
                <text x="170" y="22" textAnchor="middle">N</text><text x="322" y="176" textAnchor="middle">E</text><text x="170" y="330" textAnchor="middle">S</text><text x="18" y="176" textAnchor="middle">W</text>
                <text x="170" y="165" textAnchor="middle">90°</text><text x="170" y="185" textAnchor="middle">天頂</text>
              </svg>
              <figcaption>NTPU 天空雷達視圖 · 外圈為 0° 地平線</figcaption>
            </figure>
          </div>
        </section>

        <aside className="contact-lab__panel contact-lab__results">
          <div className="contact-lab__panel-heading"><p>OUTPUTS</p><h2>預測結果</h2><span>時間均為 UTC；門檻改變後即時重算。</span></div>
          <dl className="contact-lab__metrics">
            <div><dt>AOS · 進入門檻</dt><dd>{utcTime(result.aos?.instantUtc)}</dd><small>方位 {result.aos?.azimuthDeg.toFixed(1) ?? '—'}° · 斜距 {result.aos?.rangeKm.toFixed(0) ?? '—'} km</small></div>
            <div><dt>PEAK · 最高仰角</dt><dd>{result.peak?.maxElevationDeg.toFixed(1) ?? '—'}°</dd><small>{utcTime(result.peak?.instantUtc)} UTC</small></div>
            <div><dt>LOS · 離開門檻</dt><dd>{utcTime(result.los?.instantUtc)}</dd><small>方位 {result.los?.azimuthDeg.toFixed(1) ?? '—'}° · 斜距 {result.los?.rangeKm.toFixed(0) ?? '—'} km</small></div>
            <div className="is-primary"><dt>幾何可用時長</dt><dd data-testid="contact-duration-minutes">{result.durationMinutes.toFixed(2)} min</dd><small>相較 5° 門檻縮短 {reductionFromFive.toFixed(2)} min</small></div>
          </dl>
          <div className="contact-lab__comparison">
            <h3>門檻敏感度</h3>
            {result.multiMaskComparison.map(row => <div key={row.elevationMaskDeg} className={row.elevationMaskDeg === maskDeg ? 'is-active' : ''}><span>{row.elevationMaskDeg}°</span><i><b style={{ width: `${Math.min(100, ((row.durationMinutes ?? 0) / Math.max(1, selectedAtFive)) * 100)}%` }} /></i><strong>{row.hasContact ? `${row.durationMinutes?.toFixed(2)} min` : '無窗口'}</strong></div>)}
          </div>
          <p className="contact-lab__boundary"><strong>結論邊界</strong>幾何可見不等於鏈路已建立；未納入干擾、天氣與資源配置。</p>
        </aside>
      </section>

      <p className="contact-lab__caption">將最低仰角提高，會延後 AOS、提前 LOS；這個結果可直接由同一條仰角曲線與門檻交點驗證。</p>
      <Transport {...playback} onToggle={playback.toggle} onReplay={playback.replay} nextHref={SIX_ACTS_ACT6_HREF} nextLabel="進入第 6 幕：24 小時排程" />
    </main>
  );
}

function ScheduleLab(): ReactElement {
  const [maskDeg, setMaskDeg] = useState<SupportedElevationMaskDeg>(10);
  const result = useMemo(() => compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: maskDeg,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
    sampleStepSec: 30,
  }), [maskDeg]);
  const selectedSchedule = useMemo(
    () => selectMaximumDurationSingleReceiverSchedule(result.passes),
    [result],
  );
  const selectedPassIds = useMemo(
    () => new Set(selectedSchedule.windows.map(pass => pass.passId)),
    [selectedSchedule],
  );
  const playback = usePlaybackLoop(24_000, String(maskDeg));
  const startMs = Date.parse(result.windowStartUtc);
  const endMs = Date.parse(result.windowEndUtc);
  const cursorMs = startMs + playback.progress * (endMs - startMs);
  const activePasses = result.passes.filter(pass => pass.aos.instantMs <= cursorMs && pass.los.instantMs >= cursorMs);
  const percent = (instantMs: number) => Math.max(0, Math.min(100, ((instantMs - startMs) / (endMs - startMs)) * 100));

  return (
    <main
      className="contact-lab contact-lab--schedule"
      data-testid="contact-window-act6"
      data-mask-deg={maskDeg}
      data-total-passes={result.totalPassesCount}
      data-scientific-category="GEOMETRIC_CONTACT_OPPORTUNITY"
      data-guaranteed-rf-service="false"
    >
      <SixActsNav currentHref={SIX_ACTS_ACT6_HREF} variant="stage" />
      <header className="contact-lab__header">
        <div><p>ACT 6 · MULTI-SATELLITE SCHEDULING</p><h1>24 小時多衛星通聯排程</h1><span>將單次過境窗口排成時間表後，哪些時段有候選、重疊或完全空窗？</span></div>
        <aside><strong>8-SATELLITE ONEWEB SUBSET</strong><span>OneWeb · 2026-08-25</span><small>封存 TLE · SGP4 · 非完整星座</small></aside>
      </header>

      <section className="contact-lab__workspace">
        <aside className="contact-lab__panel contact-lab__controls">
          <div className="contact-lab__panel-heading"><p>CONSTRAINTS</p><h2>排程條件</h2><span>相同的最低仰角同時套用到 8 顆封存 OneWeb 衛星。</span></div>
          <div className="contact-lab__field"><span>最低可通聯仰角 α<sub>min</sub></span><MaskSelector value={maskDeg} onChange={setMaskDeg} /></div>
          <dl className="contact-lab__ledger">
            <div><dt>觀測期間</dt><dd>24 h</dd></div>
            <div><dt>觀測點</dt><dd>NTPU 三峽</dd></div>
            <div><dt>TLE 樣本</dt><dd>{result.satelliteCount} 顆 OneWeb</dd></div>
            <div><dt>求解步長</dt><dd>30 s 掃描</dd></div>
          </dl>
          <div className="contact-lab__formula">
            <span>單接收器排程</span>
            <strong>max Σ (LOS<sub>i</sub> − AOS<sub>i</sub>)</strong>
            <p>限制同一時刻最多選擇一個窗口；不含天線轉向與重新鎖定時間。</p>
          </div>
          <p className="contact-lab__live"><span>時間游標</span><strong>{utcTime(new Date(cursorMs).toISOString())} UTC</strong><small>{activePasses.length === 0 ? '當下無衛星高於門檻' : `當下 ${activePasses.length} 顆候選：${activePasses.map(pass => pass.satelliteName).join('、')}`}</small></p>
        </aside>

        <section className="contact-lab__stage contact-lab__schedule-stage" aria-label="24 小時幾何可見時間表">
          <div className="contact-lab__stage-heading"><div><p>GEOMETRIC WINDOW ATLAS</p><h2>24 h 通聯窗口圖</h2></div><output>{result.totalPassesCount} 個過境 · 最高同時 {result.maxConcurrentSatellites} 顆</output></div>
          <div className="contact-lab__schedule-chart">
            <div className="contact-lab__hours"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24 UTC</span></div>
            <div className="contact-lab__schedule-rows">
              <i className="contact-lab__cursor" style={{ '--cursor-progress': playback.progress } as CSSProperties} />
              {EXPERIMENT_6_CONSTELLATION_SATELLITES.map((satellite, rowIndex) => (
                <div className="contact-lab__schedule-row" key={satellite.satelliteId}>
                  <strong>{satellite.satelliteName}</strong>
                  <div>
                    {(result.passesBySatellite[satellite.satelliteId] ?? []).map(pass => (
                      <span
                        key={pass.passId}
                        className={selectedPassIds.has(pass.passId) ? 'is-selected' : ''}
                        style={{ left: `${percent(pass.aos.instantMs)}%`, width: `${Math.max(0.24, percent(pass.los.instantMs) - percent(pass.aos.instantMs))}%`, '--row': rowIndex } as CSSProperties}
                        title={`${pass.satelliteName}: ${utcTime(pass.aos.instantUtc)}–${utcTime(pass.los.instantUtc)} UTC`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="contact-lab__schedule-legend"><span><i className="is-window" />幾何可見窗口</span><span><i className="is-selected" />單接收器排程選中</span><span><i className="is-cursor" />時間游標</span></div>
          </div>
          <div className="contact-lab__selected-strip">
            <header><strong>單接收器排程</strong><span>目標：最大化不重疊幾何窗口時數</span></header>
            <div>{selectedSchedule.windows.slice(0, 8).map(pass => <span key={pass.passId}><b>{utcTime(pass.aos.instantUtc)}</b>{pass.satelliteName}<small>{pass.durationMinutes.toFixed(1)} min</small></span>)}</div>
          </div>
        </section>

        <aside className="contact-lab__panel contact-lab__results">
          <div className="contact-lab__panel-heading"><p>SUMMARY</p><h2>窗口與空檔</h2><span>原始窗口總和可能包含同時重疊，不能直接當作 24 h 覆蓋時數。</span></div>
          <dl className="contact-lab__metrics">
            <div><dt>原始幾何機會總和</dt><dd>{result.totalContactOpportunityMinutes.toFixed(1)} min</dd><small>含重疊窗口</small></div>
            <div className="is-primary"><dt>去重疊可見時數</dt><dd data-testid="merged-coverage-minutes">{result.totalMergedContactCoverageMinutes.toFixed(1)} min</dd><small>24 h 占比 {result.coverageDutyCyclePercent.toFixed(1)}%</small></div>
            <div><dt>最長空窗</dt><dd>{result.longestOutage?.durationMinutes.toFixed(1) ?? '0.0'} min</dd><small>{utcTime(result.longestOutage?.startUtc)} – {utcTime(result.longestOutage?.endUtc)} UTC</small></div>
            <div><dt>重疊區間</dt><dd>{result.overlapCount}</dd><small>最高同時 {result.maxConcurrentSatellites} 顆</small></div>
            <div><dt>單接收器選定</dt><dd>{selectedSchedule.totalDurationMinutes.toFixed(1)} min</dd><small>{selectedSchedule.windows.length} 個不重疊窗口</small></div>
          </dl>
          <div className="contact-lab__outage-list"><h3>最長的三個空窗</h3>{[...result.outages].sort((a, b) => b.durationSec - a.durationSec).slice(0, 3).map(outage => <div key={outage.outageId}><span>{utcTime(outage.startUtc)}–{utcTime(outage.endUtc)}</span><strong>{outage.durationMinutes.toFixed(1)} min</strong></div>)}</div>
        </aside>
      </section>

      <p className="contact-lab__caption">把單星 AOS–LOS 放入同一時軸，才能檢查重疊、空窗與單接收器排程；這仍是 8 星樣本的幾何機會，不代表 RF 服務成功或完整星座覆蓋。</p>
      <Transport {...playback} onToggle={playback.toggle} onReplay={playback.replay} nextHref={null} nextLabel={null} />
    </main>
  );
}

type PredictionReveal = 1 | 2 | 3 | 4 | 5;

function predictionTrajectory(result: SinglePassContactResult): readonly TopocentricLookPoint[] {
  if (!result.aos || !result.los) return result.trajectory;
  const paddingMs = 4 * 60 * 1_000;
  return result.trajectory.filter(point => (
    point.instantMs >= result.aos!.instantMs - paddingMs
    && point.instantMs <= result.los!.instantMs + paddingMs
  ));
}

function ContactPredictionChart({
  result,
  reveal,
  curveProgress = 1,
  baselineResult = null,
  cursorProgress = null,
}: {
  readonly result: SinglePassContactResult;
  readonly reveal: PredictionReveal;
  readonly curveProgress?: number;
  readonly baselineResult?: SinglePassContactResult | null;
  readonly cursorProgress?: number | null;
}): ReactElement {
  const trajectory = useMemo(() => predictionTrajectory(result), [result]);
  const width = 920;
  const height = 430;
  const plot = Object.freeze({ left: 82, right: 28, top: 26, bottom: 72 });
  const plotRight = width - plot.right;
  const plotBottom = height - plot.bottom;
  const innerWidth = plotRight - plot.left;
  const innerHeight = plotBottom - plot.top;
  const startMs = trajectory[0]?.instantMs ?? Date.parse(result.searchStartUtc);
  const endMs = trajectory[trajectory.length - 1]?.instantMs ?? Date.parse(result.searchEndUtc);
  const x = (instantMs: number) => plot.left + ((instantMs - startMs) / Math.max(1, endMs - startMs)) * innerWidth;
  const y = (elevationDeg: number) => plot.top + (1 - Math.max(0, Math.min(90, elevationDeg)) / 90) * innerHeight;
  const points = trajectory.map(point => `${x(point.instantMs).toFixed(1)},${y(point.elevationDeg).toFixed(1)}`).join(' ');
  const yTicks = [...new Set([0, result.minimumElevationDeg, 30, 60, 90])].sort((a, b) => a - b);
  const durationY = Math.min(plotBottom - 18, y(result.minimumElevationDeg) + 32);
  const aosX = result.aos ? x(result.aos.instantMs) : plot.left;
  const losX = result.los ? x(result.los.instantMs) : plotRight;
  const baselineMask = baselineResult?.minimumElevationDeg ?? null;
  const cursorPoint = cursorProgress === null || trajectory.length === 0
    ? null
    : trajectory[Math.min(
      trajectory.length - 1,
      Math.round(Math.max(0, Math.min(1, cursorProgress)) * (trajectory.length - 1)),
    )] ?? null;

  return (
    <figure
      className="contact-prediction__figure"
      data-testid="contact-prediction-chart"
      data-mask-deg={result.minimumElevationDeg}
      data-reveal-level={reveal}
    >
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="NTPU 地面仰角對時間的通聯預測曲線">
        <line x1={plot.left} y1={plot.top} x2={plot.left} y2={plotBottom} className="prediction-axis" />
        <line x1={plot.left} y1={plotBottom} x2={plotRight} y2={plotBottom} className="prediction-axis" />
        {yTicks.map(value => (
          <g key={value}>
            <line
              x1={plot.left}
              y1={y(value)}
              x2={plotRight}
              y2={y(value)}
              className={value === result.minimumElevationDeg ? 'prediction-grid is-mask' : 'prediction-grid'}
            />
            <text x={plot.left - 12} y={y(value) + 5} textAnchor="end" className="prediction-tick">{value}°</text>
          </g>
        ))}
        {[0, 0.5, 1].map(ratio => {
          const instantMs = startMs + (endMs - startMs) * ratio;
          return (
            <g key={ratio}>
              <line x1={x(instantMs)} y1={plotBottom} x2={x(instantMs)} y2={plotBottom + 6} className="prediction-axis" />
              <text x={x(instantMs)} y={plotBottom + 25} textAnchor="middle" className="prediction-tick">
                {utcTime(new Date(instantMs).toISOString())}Z
              </text>
            </g>
          );
        })}

        {baselineMask !== null && baselineMask !== result.minimumElevationDeg ? (
          <line x1={plot.left} y1={y(baselineMask)} x2={plotRight} y2={y(baselineMask)} className="prediction-baseline-mask" />
        ) : null}
        {reveal >= 2 ? (
          <>
            <line x1={plot.left} y1={y(result.minimumElevationDeg)} x2={plotRight} y2={y(result.minimumElevationDeg)} className="prediction-threshold" />
            <text x={plotRight - 8} y={y(result.minimumElevationDeg) - 10} textAnchor="end" className="prediction-threshold-label">
              最低幾何仰角門檻 α_min = {result.minimumElevationDeg}°
            </text>
          </>
        ) : null}

        <polyline
          points={points}
          pathLength={1}
          className="prediction-curve"
          style={{ strokeDasharray: 1, strokeDashoffset: 1 - Math.max(0.02, Math.min(1, curveProgress)) }}
        />

        {cursorPoint ? (
          <g className="prediction-cursor" data-testid="prediction-time-cursor" data-cursor-utc={cursorPoint.instantUtc}>
            <line x1={x(cursorPoint.instantMs)} y1={plot.top} x2={x(cursorPoint.instantMs)} y2={plotBottom} />
            <circle cx={x(cursorPoint.instantMs)} cy={y(cursorPoint.elevationDeg)} r="8" />
          </g>
        ) : null}

        {reveal >= 3 && result.aos ? (
          <g className="prediction-event is-aos" data-testid="prediction-aos-marker">
            <circle cx={aosX} cy={y(result.aos.elevationDeg)} r="8" />
            <text x={aosX} y={y(result.aos.elevationDeg) - 19} textAnchor="middle">AOS · {utcTime(result.aos.instantUtc)}Z</text>
          </g>
        ) : null}
        {reveal >= 4 && result.los ? (
          <g className="prediction-event is-los" data-testid="prediction-los-marker">
            <circle cx={losX} cy={y(result.los.elevationDeg)} r="8" />
            <text x={losX} y={y(result.los.elevationDeg) - 19} textAnchor="middle">LOS · {utcTime(result.los.instantUtc)}Z</text>
          </g>
        ) : null}
        {reveal >= 5 && result.aos && result.los ? (
          <g className="prediction-duration" data-testid="prediction-duration-bracket">
            <line x1={aosX} y1={durationY} x2={losX} y2={durationY} />
            <line x1={aosX} y1={durationY - 8} x2={aosX} y2={durationY + 8} />
            <line x1={losX} y1={durationY - 8} x2={losX} y2={durationY + 8} />
            <text x={(aosX + losX) / 2} y={durationY + 27} textAnchor="middle">
              幾何窗口時長 = LOS − AOS = {result.durationMinutes.toFixed(2)} 分鐘
            </text>
          </g>
        ) : null}

        <text x={width / 2} y={height - 10} textAnchor="middle" className="prediction-axis-label">X｜UTC 時間</text>
        <text
          x="20"
          y={plot.top + innerHeight / 2}
          textAnchor="middle"
          className="prediction-axis-label"
          transform={`rotate(-90 20 ${plot.top + innerHeight / 2})`}
        >
          Y｜NTPU 地面仰角 α（°）
        </text>
      </svg>
    </figure>
  );
}

const GUIDED_PREDICTION_SUBTITLES = Object.freeze([
  '拖動時間游標，觀察同一顆 Starlink 衛星相對 NTPU 的仰角 α(t) 如何變化。',
  '固定最低幾何仰角門檻 α_min = 10°；曲線高於門檻的區段才列入窗口。',
  '第一次由下往上穿越 10° 的時刻，是幾何通聯起始 AOS。',
  '第二次由上往下穿越 10° 的時刻，是幾何通聯終止 LOS。',
  'AOS 到 LOS 之間就是本次幾何窗口；時長由 LOS − AOS 計算。',
] as const);

function GuidedPredictionLab(): ReactElement {
  const result = useMemo(() => computeSinglePassContactOpportunity({
    tle: EXPERIMENT_5_PRIMARY_SATELLITE,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    searchStartUtc: DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
    searchDurationSec: DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
    sampleStepSec: 10,
  }), []);
  const playback = usePlaybackLoop(32_000, 'guided-starlink-contact-prediction');
  const phaseIndex = Math.min(4, Math.floor(playback.progress * 5));
  const reveal = (phaseIndex + 1) as PredictionReveal;
  const curveProgress = Math.min(1, playback.progress / 0.25);
  const trajectory = useMemo(() => predictionTrajectory(result), [result]);
  const current = currentPointFor(trajectory, playback.progress);

  return (
    <main
      className="contact-lab contact-prediction is-guided"
      data-testid="contact-window-act5"
      data-default-constellation="Starlink"
      data-learning-goal="AOS_LOS_DURATION_FROM_TLE_AND_ELEVATION_MASK"
      data-mask-deg="10"
      data-aos-utc={result.aos?.instantUtc}
      data-los-utc={result.los?.instantUtc}
      data-duration-minutes={result.durationMinutes.toFixed(4)}
      data-scientific-category="GEOMETRIC_CONTACT_OPPORTUNITY"
      data-guaranteed-rf-service="false"
    >
      <SixActsNav currentHref={SIX_ACTS_ACT5_HREF} variant="stage" />
      <header className="contact-prediction__header">
        <div><p>ACT 5 · GUIDED PREDICTION</p><h1>用時間游標找出通聯窗口</h1><span>固定 10° 門檻，找出曲線進入與離開門檻的兩個時刻。</span></div>
        <aside data-testid="prediction-source-summary">
          <strong>{EXPERIMENT_5_PRIMARY_SATELLITE.satelliteName}</strong>
          <span>Starlink · NORAD {EXPERIMENT_5_PRIMARY_SATELLITE.satelliteId}</span>
          <small>TLE epoch {EXPERIMENT_5_PRIMARY_SATELLITE.epochUtc?.replace('T', ' ').slice(0, 19)}Z · SGP4</small>
        </aside>
      </header>

      <section className="contact-prediction__stage">
        <output className="contact-prediction__cursor-readout" data-testid="prediction-current-time">
          {current ? `${utcTime(current.instantUtc)}Z · 目前仰角 ${current.elevationDeg.toFixed(1)}°` : '尚無時間樣本'}
        </output>
        <ContactPredictionChart result={result} reveal={reveal} curveProgress={curveProgress} cursorProgress={playback.progress} />
        <div className="contact-prediction__essential-results" aria-label="預測結果">
          <div className={reveal >= 3 ? 'is-visible' : ''}><span>窗口起始 AOS</span><strong>{reveal >= 3 ? `${utcTime(result.aos?.instantUtc)}Z` : '等待曲線穿越門檻'}</strong></div>
          <div className={reveal >= 4 ? 'is-visible' : ''}><span>窗口終止 LOS</span><strong>{reveal >= 4 ? `${utcTime(result.los?.instantUtc)}Z` : '等待曲線離開門檻'}</strong></div>
          <div className={reveal >= 5 ? 'is-visible is-primary' : ''}><span>幾何窗口時長</span><strong>{reveal >= 5 ? `${result.durationMinutes.toFixed(2)} 分鐘` : 'LOS − AOS'}</strong></div>
        </div>
      </section>

      <p className="contact-prediction__subtitle" data-testid="prediction-phase-subtitle" data-phase={phaseIndex + 1}>
        {GUIDED_PREDICTION_SUBTITLES[phaseIndex]}
      </p>
      <Transport
        {...playback}
        onToggle={playback.toggle}
        onReplay={playback.replay}
        timeLabel={current ? `UTC ${utcTime(current.instantUtc)} · α ${current.elevationDeg.toFixed(1)}°` : null}
        nextHref={SIX_ACTS_ACT6_HREF}
        nextLabel="進入第 6 幕：改變門檻"
      />
    </main>
  );
}

function signedSeconds(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1_000);
  return `${seconds >= 0 ? '+' : '−'}${Math.abs(seconds)} 秒`;
}

function PredictionExperimentLab(): ReactElement {
  const experimentMasks = [10, 20, 30] as const satisfies readonly SupportedElevationMaskDeg[];
  const [draftMask, setDraftMask] = useState<SupportedElevationMaskDeg>(10);
  const [appliedMask, setAppliedMask] = useState<SupportedElevationMaskDeg>(10);
  const baseline = useMemo(() => computeSinglePassContactOpportunity({
    tle: EXPERIMENT_5_PRIMARY_SATELLITE,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    searchStartUtc: DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
    searchDurationSec: DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
    sampleStepSec: 10,
  }), []);
  const result = useMemo(() => computeSinglePassContactOpportunity({
    tle: EXPERIMENT_5_PRIMARY_SATELLITE,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: appliedMask,
    searchStartUtc: DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
    searchDurationSec: DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
    sampleStepSec: 10,
  }), [appliedMask]);
  const aosDeltaMs = (result.aos?.instantMs ?? 0) - (baseline.aos?.instantMs ?? 0);
  const losDeltaMs = (result.los?.instantMs ?? 0) - (baseline.los?.instantMs ?? 0);
  const durationDeltaMin = result.durationMinutes - baseline.durationMinutes;
  const reset = () => {
    setDraftMask(10);
    setAppliedMask(10);
  };

  return (
    <main
      className="contact-lab contact-prediction is-experiment"
      data-testid="contact-window-act6"
      data-default-constellation="Starlink"
      data-learning-goal="RUN_CONTACT_PREDICTION_AND_COMPARE_ELEVATION_MASK"
      data-mask-deg={appliedMask}
      data-aos-utc={result.aos?.instantUtc}
      data-los-utc={result.los?.instantUtc}
      data-duration-minutes={result.durationMinutes.toFixed(4)}
      data-scientific-category="GEOMETRIC_CONTACT_OPPORTUNITY"
      data-guaranteed-rf-service="false"
    >
      <SixActsNav currentHref={SIX_ACTS_ACT6_HREF} variant="stage" />
      <header className="contact-prediction__header">
        <div><p>ACT 6 · THRESHOLD EXPERIMENT</p><h1>改變門檻，重算同一次過境</h1><span>只改最低幾何仰角，直接比較 AOS、LOS 與窗口時長。</span></div>
        <aside>
          <strong>{EXPERIMENT_5_PRIMARY_SATELLITE.satelliteName}</strong>
          <span>Starlink · NTPU</span>
          <small>同一筆 TLE · SGP4 · 同一次過境</small>
        </aside>
      </header>

      <section className="contact-prediction__experiment-bar" aria-label="通聯預測輸入">
        <div><span>固定輸入</span><strong>Starlink TLE + NTPU</strong></div>
        <div className="contact-prediction__mask-control">
          <span>選擇最低幾何仰角 α_min</span>
          <MaskSelector value={draftMask} onChange={setDraftMask} options={experimentMasks} />
          <small>10° 為本課基準；5° 屬近地平線敏感度情境，不作一般通聯設定。</small>
        </div>
        <button type="button" className="contact-prediction__run" onClick={() => setAppliedMask(draftMask)} data-testid="run-contact-prediction">
          以 {draftMask}° 執行預測
        </button>
      </section>

      <section className="contact-prediction__stage">
        <ContactPredictionChart result={result} reveal={5} baselineResult={baseline} />
        <div className="contact-prediction__essential-results" aria-label="預測結果">
          <div className="is-visible"><span>窗口起始 AOS</span><strong data-testid="experiment-aos">{utcTime(result.aos?.instantUtc)}Z</strong></div>
          <div className="is-visible"><span>窗口終止 LOS</span><strong data-testid="experiment-los">{utcTime(result.los?.instantUtc)}Z</strong></div>
          <div className="is-visible is-primary"><span>幾何窗口時長</span><strong data-testid="contact-duration-minutes">{result.durationMinutes.toFixed(2)} 分鐘</strong></div>
        </div>
      </section>

      <p className="contact-prediction__subtitle" data-testid="prediction-comparison-conclusion">
        {appliedMask === 10
          ? '目前是 10° 基準。選擇另一個最低仰角並執行預測，觀察 AOS、LOS 與時長如何改變。'
          : `相較 10° 基準：AOS ${signedSeconds(aosDeltaMs)}、LOS ${signedSeconds(losDeltaMs)}、通聯時長 ${durationDeltaMin >= 0 ? '增加' : '縮短'} ${Math.abs(durationDeltaMin).toFixed(2)} 分鐘。`}
      </p>
      <footer className="contact-prediction__actions">
        <button type="button" onClick={reset}>重設實驗</button>
        <a href="/">回首頁</a>
      </footer>
    </main>
  );
}

export function ContactWindowLabRoute({ act }: { readonly act: 5 | 6 }): ReactElement {
  return act === 5 ? <GuidedPredictionLab /> : <PredictionExperimentLab />;
}
