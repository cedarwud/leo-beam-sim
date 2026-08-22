import { useMemo, useState, type ReactElement } from 'react';

import {
  SIX_ACTS_ARMS,
  getSixActsArmSpec,
  type SixActsArm,
} from '../sixActs/armStrategy';
import {
  SIX_ACTS_BEAM_POWER_CAP_W,
  SixActsPowerSweep,
  describeSixActsSweepSegments,
} from '../sixActs/powerSweep';
import { getSixActsAttachThreshold } from '../sixActs/taughtConstants';
import {
  ENERGY_LAB_FRAME_SET_DIGEST,
  ENERGY_LAB_PARAMS,
  ENERGY_LAB_SCENARIO_ID,
  ENERGY_LAB_STOPS,
  energyLabFixedOverheadW,
  energyLabPointForArm,
} from './energyLabFixture';
import { PlatformDrawer } from './PlatformDrawer';
import { SixActsNav } from '../nav/SixActsNav';
import './EnergyLabRoute.scss';

/**
 * Acts 5 and 6 — the experiment, and the record of it.
 *
 * One continuous flow: bet, sweep, reveal, then upload what you measured. The
 * numbers come from the canonical EE definitions over a pinned DEMO parameter
 * set; the sweep bookkeeping, the arm rules and the upload payload all come
 * from the six-acts model layer, so nothing on this page recomputes a
 * classroom number of its own.
 */

/** A run summary built from one operating point, in the model layer's shape. */
function summaryFor(beamPowerW: number, arm: SixActsArm) {
  const point = energyLabPointForArm(beamPowerW, arm);
  const durationSec = 120;
  const threshold = getSixActsAttachThreshold();
  return {
    point,
    summary: {
      runId: `energy-lab-${arm}-${beamPowerW}`,
      strategyId: arm,
      scenarioId: ENERGY_LAB_SCENARIO_ID,
      totalEnergyJ: point.systemPowerW * durationSec,
      deliveredDataMbit: point.totalRateMbps * durationSec,
      runEeMbitPerJ: point.eeMbitPerJ,
      lowSinrFraction: point.lowSinrFraction,
      lowSinrRatioPercent: Math.round(point.lowSinrFraction * 100),
      lowSinrThresholdDb: threshold.value,
      lowSinrThreshold: threshold,
      numHandovers: 0,
      sampleCount: durationSec,
      durationSec,
      outageSampleCount: Math.round(point.lowSinrFraction * durationSec),
      outageDurationSec: point.lowSinrFraction * durationSec,
      startInstantMs: 0,
      endInstantMs: durationSec * 1000,
    },
  };
}

export function EnergyLabRoute(): ReactElement {
  const [arm, setArm] = useState<SixActsArm>('baseline');
  const [beamPowerW, setBeamPowerW] = useState(0.35);
  const [recorded, setRecorded] = useState<readonly { arm: SixActsArm; beamPowerW: number }[]>([]);

  const sweep = useMemo(() => {
    const instance = new SixActsPowerSweep({
      frameSetDigest: ENERGY_LAB_FRAME_SET_DIGEST,
      scenarioId: ENERGY_LAB_SCENARIO_ID,
    });
    for (const entry of recorded) {
      instance.record({
        arm: entry.arm,
        beamPowerW: entry.beamPowerW,
        frameSetDigest: ENERGY_LAB_FRAME_SET_DIGEST,
        beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
        summary: summaryFor(entry.beamPowerW, entry.arm).summary,
      });
    }
    return instance;
  }, [recorded]);

  const curves = useMemo(() => ({
    baseline: sweep.curveFor('baseline'),
    eco: sweep.curveFor('eco'),
  }), [sweep]);

  const segments = useMemo(
    () => describeSixActsSweepSegments(curves[arm].length >= 3 ? curves[arm] : curves.baseline),
    [curves, arm],
  );

  const live = summaryFor(beamPowerW, arm);
  const alreadyRecorded = recorded.some(
    entry => entry.arm === arm && entry.beamPowerW === beamPowerW,
  );
  const maxEe = Math.max(
    1e-6,
    ...curves.baseline.map(point => point.runEeMbitPerJ),
    ...curves.eco.map(point => point.runEeMbitPerJ),
  );

  return (
    <main className="energy-lab" lang="zh-Hant">
      <SixActsNav currentHref="/course/energy-lab" />
      <header className="energy-lab__header">
        <p className="energy-lab__kicker">ACT 5 · 節能實驗　／　ACT 6 · 平台記錄</p>
        <h1>「調小功率＝省電」是真的嗎？</h1>
        <p className="energy-lab__lede">先押注，再掃描，最後把你量到的東西留下證據。</p>
              <p className="energy-lab__badge">
          <b>ξ = {ENERGY_LAB_PARAMS.xi}</b>（ADR-006 §29，常數）與
          <b> P^f = {energyLabFixedOverheadW().toFixed(3)} W</b>
          （ADR-006 公式：0.338×{ENERGY_LAB_PARAMS.activeBeamCount} beam ＋ 0.2×{ENERGY_LAB_PARAMS.activeSatelliteCount} sat）
          已依論文釘定。<b>COURSE-ASSUMPTION</b>：通道基準與干擾耦合 κ = {ENERGY_LAB_PARAMS.interferenceCoupling}
           仍是課堂調校值，論文端尚無對應數值。
        </p>
        <p className="energy-lab__scope">
          縱軸是<b>系統級 ratio-of-sums EE</b>（全體使用者總 throughput ÷ 系統總能耗），
          即論文 headline 的口徑，也是平台欄位 <code>RUN_EE_MBIT_PER_J</code> 的口徑；
          它不是符號表裡的單鏈路顯示量 η<sub>u,s,v</sub>。
        </p>
      </header>

      <section className="energy-lab__sweep">
        <h2>功率掃描</h2>

        <div className="energy-lab__arms" role="group" aria-label="選擇 arm">
          {SIX_ACTS_ARMS.map(spec => (
            <button key={spec.id} type="button" className={arm === spec.id ? 'is-active' : ''}
              onClick={() => setArm(spec.id)}>
              <strong>{spec.labelZhHant}</strong>
              <code>{spec.formula}</code>
            </button>
          ))}
        </div>
        <p className="energy-lab__arm-why">{getSixActsArmSpec(arm).whyZhHant}</p>

        <label className="energy-lab__power">
          <span>每波束發射功率 p　{beamPowerW.toFixed(2)} W（額定上限 {SIX_ACTS_BEAM_POWER_CAP_W} W）</span>
          <input
            type="range"
            min={0}
            max={ENERGY_LAB_STOPS.length - 1}
            step={1}
            value={ENERGY_LAB_STOPS.indexOf(beamPowerW) === -1 ? 4 : ENERGY_LAB_STOPS.indexOf(beamPowerW)}
            onChange={event => setBeamPowerW(ENERGY_LAB_STOPS[Number(event.target.value)]!)}
          />
        </label>

        <div className="energy-lab__live">
          <div><dt>R（總速率）</dt><dd>{live.point.totalRateMbps.toFixed(1)} Mbit/s</dd></div>
          <div><dt>P^N（系統功率）</dt><dd>{live.point.systemPowerW.toFixed(2)} W</dd></div>
          <div><dt>系統 EE（ratio-of-sums）</dt><dd>{live.point.eeMbitPerJ.toFixed(2)} Mbit/J</dd></div>
          <div><dt>LOW_SINR_RATIO</dt><dd>{live.summary.lowSinrRatioPercent}%</dd></div>
        </div>

        <button
          type="button"
          className="energy-lab__record"
          disabled={alreadyRecorded}
          onClick={() => setRecorded(previous => [...previous, { arm, beamPowerW }])}
        >{alreadyRecorded ? '這個點已記錄' : '記錄一點'}</button>

        <div className="energy-lab__chart">
          <svg viewBox="0 0 620 220" role="img" aria-label="能量效率對功率的曲線">
            {(['baseline', 'eco'] as const).map(which => {
              const curve = curves[which];
              if (curve.length < 2) return null;
              const path = curve.map((point, index) => {
                const x = (ENERGY_LAB_STOPS.indexOf(point.beamPowerW) / (ENERGY_LAB_STOPS.length - 1)) * 600 + 10;
                const y = 200 - (point.runEeMbitPerJ / maxEe) * 180;
                return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(' ');
              return <path key={which} d={path} className={`energy-lab__curve is-${which}`} />;
            })}
            {(['baseline', 'eco'] as const).flatMap(which => curves[which].map(point => {
              const x = (ENERGY_LAB_STOPS.indexOf(point.beamPowerW) / (ENERGY_LAB_STOPS.length - 1)) * 600 + 10;
              const y = 200 - (point.runEeMbitPerJ / maxEe) * 180;
              return <circle key={`${which}-${point.beamPowerW}`} cx={x} cy={y} r={4}
                className={`energy-lab__dot is-${which}`} />;
            }))}
          </svg>
          <div className="energy-lab__legend">
            <span className="is-baseline">baseline · R 最大</span>
            <span className="is-eco">eco · R/P^N 最大</span>
            <span className="is-axis">橫軸：p（左小右大）　縱軸：η</span>
          </div>
        </div>

        <div className="energy-lab__reveal">
          <h3>3 · 揭示</h3>
          {segments.shape === 'insufficient-points'
            ? <p className="energy-lab__hint">至少記錄三個點，形狀才說得準。目前 {curves[arm].length} 點。</p>
            : <>
              <p className="energy-lab__shape">
                你的曲線是：<strong>{
                  segments.shape === 'peak-inside-range' ? '中間有峰'
                    : segments.shape === 'monotonic-increasing' ? '一路上升'
                      : '一路下降'
                }</strong>
                {segments.peak === null ? null : <>，甜蜜點在 <strong>{segments.peak.beamPowerW} W</strong></>}
              </p>
              <ul className="energy-lab__segments">
                <li><strong>左段（功率太小）</strong>
                  固定開銷 P^f = {energyLabFixedOverheadW().toFixed(2)} W 不會因為你調小而消失。
                  功率調到 0.02 W 時，七道波束總共才吃 {(7 * 0.02 / ENERGY_LAB_PARAMS.xi).toFixed(2)} W，
                  也就是說**八成以上的電是花在什麼都沒傳的固定開銷上**——每 bit 的能量成本因此爆炸。</li>
                <li><strong>中段</strong>甜蜜點。它是算出來的，不是猜的。</li>
                <li><strong>右段（功率拉滿）</strong>
                  速率只有 <b>log</b> 成長，電源端功率卻是<b>線性</b>成長
                  （ξ = {ENERGY_LAB_PARAMS.xi} 是常數，所以 P^p = p/ξ 對 p 成正比），
                  多波束時干擾又同步上升讓速率提早飽和——報酬遞減。</li>
              </ul>
              <p className="energy-lab__trap">
                <strong>第二層陷阱：</strong>
                功率太低時 LOW_SINR_RATIO 直接衝到 100%。噪聲不會跟著你變小，
                絕對門檻（{live.summary.lowSinrThresholdDb} dB，這是<b>引擎的運作規則、不是論文值</b>）過不了，
                UE 只能斷著等——停擺期間固定功耗照燒，J/bit 更慘。
              </p>
            </>}
        </div>
      </section>

      <PlatformDrawer
        summary={live.summary}
        armLabel={getSixActsArmSpec(arm).labelZhHant}
      />
    </main>
  );
}
