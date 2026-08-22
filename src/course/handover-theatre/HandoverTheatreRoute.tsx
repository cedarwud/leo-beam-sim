import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import {
  SIX_ACTS_PHASES,
  SIX_ACTS_TIMELINE_AXIS_LABEL_ZH_HANT,
  buildSixActsDirectorPlan,
  buildSixActsPolicyContextCard,
  getSixActsVisibilityRequirements,
  resolveSixActsPhaseAt,
  type SixActsPhasePlan,
} from '../sixActs/directorScript';
import { loadSixActsTeachingWindow } from '../sixActs/teachingWindow';
import { assertSixActsPlanVisibility, readSixActsElevation } from '../sixActs/windowVisibility';
import { HandoverTheatreStage } from './HandoverTheatreStage';
import { HandoverReceiptRail, type HandoverReceipt } from './HandoverReceipt';
import { SixActsBridge, SixActsNav } from '../nav/SixActsNav';
import './HandoverTheatreRoute.scss';

/**
 * Act 4 — the handover theatre.
 *
 * Six phases over the ONE source-backed OneWeb window the atlas found, driven
 * by the director-script model. The stage advances on a clock the lecturer
 * controls, and Phase D stops the room by itself.
 *
 * The window is real and low: at the commit the serving satellite is at 6.7 deg
 * and the candidate is nearly overhead. That is not a staging choice — it is
 * what 3 dB + 30 s TTT produces at NTPU, and the act is built to say so.
 */

/** Playback speed presets, in simulated seconds per wall-clock second. */
const SPEEDS = Object.freeze([1, 4, 12] as const);

export function HandoverTheatreRoute(): ReactElement {
  const window_ = useMemo(() => loadSixActsTeachingWindow(), []);
  const commitMs = useMemo(() => Date.parse(window_.window.triggerInstantUtc), [window_]);

  // A live observation is what the director plans around. Here the replay is the
  // pinned window itself, played back at the policy's own TTT.
  const plan = useMemo(() => buildSixActsDirectorPlan({
    source: 'live-replay',
    commitInstantMs: commitMs,
    conditionStartInstantMs: commitMs - window_.window.handoverPolicy.tttSec * 1000,
    fromSatelliteId: window_.pair.from.satelliteId,
    toSatelliteId: window_.pair.to.satelliteId,
    replayStepSec: 1,
  }), [commitMs, window_]);

  const visibility = useMemo(
    () => assertSixActsPlanVisibility(getSixActsVisibilityRequirements(plan)),
    [plan],
  );
  const policyCard = useMemo(() => buildSixActsPolicyContextCard(window_), [window_]);

  const startMs = plan.phases[0]!.startInstantMs;
  const endMs = commitMs + 90_000;

  const [instantMs, setInstantMs] = useState(startMs);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const [playing, setPlaying] = useState(false);
  const [receipts, setReceipts] = useState<readonly HandoverReceipt[]>([]);
  const pausedAt = useRef<string | null>(null);

  const phase: SixActsPhasePlan | null = resolveSixActsPhaseAt(plan, instantMs);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = globalThis.setInterval(() => {
      setInstantMs(previous => Math.min(endMs, previous + speed * 1000));
    }, 1000);
    return () => globalThis.clearInterval(timer);
  }, [playing, speed, endMs]);

  // Phase D stops the room by itself, once per visit.
  useEffect(() => {
    if (phase === null) return;
    if (phase.autoPause && pausedAt.current !== phase.id) {
      pausedAt.current = phase.id;
      setPlaying(false);
    }
    if (!phase.autoPause && pausedAt.current === phase.id) pausedAt.current = null;
  }, [phase]);

  // The receipt is written when the replay crosses the commit.
  useEffect(() => {
    if (instantMs < commitMs || receipts.length > 0) return;
    setReceipts([{
      id: `${window_.pair.from.satelliteId}->${window_.pair.to.satelliteId}`,
      fromName: window_.pair.from.satelliteName,
      toName: window_.pair.to.satelliteName,
      committedAtUtc: window_.window.triggerInstantUtc,
      deltaSinrDb: window_.qualification.preCommit.deltaDb,
      servingElevationDeg: readSixActsElevation('from', commitMs, window_).elevationDeg,
      candidateElevationDeg: readSixActsElevation('to', commitMs, window_).elevationDeg,
      heldSec: plan.observedConditionHoldSec,
    }]);
  }, [instantMs, commitMs, receipts.length, window_, plan.observedConditionHoldSec]);

  const elevations = useMemo(() => ({
    from: readSixActsElevation('from', instantMs, window_),
    to: readSixActsElevation('to', instantMs, window_),
  }), [instantMs, window_]);

  const offsetSec = Math.round((instantMs - commitMs) / 1000);
  const tttProgressSec = Math.max(0, Math.min(
    window_.window.handoverPolicy.tttSec,
    (instantMs - (commitMs - window_.window.handoverPolicy.tttSec * 1000)) / 1000,
  ));

  return (
    <main className="theatre" lang="zh-Hant">
      <SixActsNav currentHref="/course/handover-theatre" />
      <header className="theatre__header">
        <p className="theatre__kicker">ACT 4 · 換手劇場</p>
        <h1>為何換手？何時換？換給誰？</h1>
        <p className="theatre__lede">
          一個真實的窗：{window_.pair.from.satelliteName} → {window_.pair.to.satelliteName}，
          {window_.window.triggerInstantUtc.slice(0, 16).replace('T', ' ')} UTC，NTPU。
        </p>
      </header>

      <div className="theatre__body">
        <section className="theatre__stage-wrap">
          <HandoverTheatreStage
            phase={phase}
            servingElevationDeg={elevations.from.elevationDeg}
            candidateElevationDeg={elevations.to.elevationDeg}
            servingName={window_.pair.from.satelliteName}
            candidateName={window_.pair.to.satelliteName}
            committed={instantMs >= commitMs}
            tttProgressSec={tttProgressSec}
            tttTotalSec={window_.window.handoverPolicy.tttSec}
            offsetDb={window_.window.handoverPolicy.offsetDb}
            deltaDb={window_.qualification.preCommit.deltaDb}
          />

          <div className="theatre__transport">
            <button type="button" className="theatre__play" onClick={() => setPlaying(value => !value)}>
              {playing ? '暫停' : '播放'}
            </button>
            <div className="theatre__speeds" role="group" aria-label="播放速度">
              {SPEEDS.map(option => (
                <button key={option} type="button" className={speed === option ? 'is-active' : ''}
                  onClick={() => setSpeed(option)}>×{option}</button>
              ))}
            </div>
            <input
              type="range"
              min={startMs}
              max={endMs}
              step={1000}
              value={instantMs}
              aria-label={SIX_ACTS_TIMELINE_AXIS_LABEL_ZH_HANT}
              onChange={event => { setPlaying(false); setInstantMs(Number(event.target.value)); }}
            />
            <span className="theatre__clock">
              {offsetSec >= 0 ? '+' : '−'}{Math.abs(offsetSec)} 秒
              <small>{SIX_ACTS_TIMELINE_AXIS_LABEL_ZH_HANT}</small>
            </span>
            <button type="button" className="theatre__reset" onClick={() => {
              setPlaying(false);
              setInstantMs(startMs);
              setReceipts([]);
              pausedAt.current = null;
            }}>重來</button>
          </div>

          <ol className="theatre__phases">
            {SIX_ACTS_PHASES.map(spec => {
              const planned = plan.phases.find(candidate => candidate.id === spec.id)!;
              const active = phase?.id === spec.id;
              const passed = instantMs >= planned.startInstantMs;
              const reading = visibility.find(entry => entry.phaseId === spec.id);
              return (
                <li key={spec.id} className={`${active ? 'is-active' : ''} ${passed ? 'is-passed' : ''}`}>
                  <button type="button" onClick={() => { setPlaying(false); setInstantMs(planned.startInstantMs); }}>
                    <em>{String.fromCharCode(64 + spec.order)}</em>
                    <span>{spec.titleZhHant}</span>
                    <small>{(planned.startInstantMs - commitMs) / 1000 >= 0 ? '+' : '−'}
                      {Math.abs((planned.startInstantMs - commitMs) / 1000)} s</small>
                    {spec.autoPause ? <i className="theatre__pause-tag">自動暫停</i> : null}
                  </button>
                  {active ? <p className="theatre__narration">{spec.narrationZhHant}</p> : null}
                  {active && reading ? (
                    <p className="theatre__vis">
                      {reading.readings.map(entry => `${entry.satelliteName} ${entry.elevationDeg.toFixed(1)}°`).join(' · ')}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="theatre__panel">
          <div className="theatre__policy">
            <span>這組政策的性質</span>
            <p>{policyCard.captionZhHant}</p>
            <dl>
              <div><dt>條件式換手</dt><dd>{policyCard.validInterHandoverCount.toLocaleString('en-US')}</dd></div>
              <div><dt>被迫接替</dt><dd>{policyCard.forcedContinuityCount.toLocaleString('en-US')}</dd></div>
            </dl>
          </div>

          <HandoverReceiptRail receipts={receipts} />

          <div className="theatre__provenance">
            <span>SOURCE</span>
            <p>{window_.selection.logicalEventKey}</p>
            <small>圖集 {window_.provenance.atlasId.slice(0, 26)}… · {window_.provenance.evidenceClass}</small>
          </div>
        </aside>
      </div>

      <SixActsBridge currentHref="/course/handover-theatre" />
    </main>
  );
}
