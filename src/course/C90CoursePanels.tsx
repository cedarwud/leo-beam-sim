import type {
  CourseDataProvider,
  CourseManifest,
  CourseSceneFrame,
  E1Arm,
  E1Experiment,
  E2Branch,
  E2Experiment,
  E2Trace,
  IoTChallenge,
  IoTRun,
  IoTVersion,
  LearningBundle,
  ServiceStatus,
  IdeaCard,
  TleJourney,
  TleTrajectoryBundle,
  TleTrajectoryFrame,
} from './contract';
import { useState } from 'react';
import { C90TlePanel } from './C90TlePanel';
import {
  advanceE1Frame,
  advanceE2Frame,
  courseSessionReadiness,
  freezeE2Rule,
  type CourseSessionState,
  finishE1Arm,
  markReadyCheckComplete,
  selectE2Action,
  setE1Decision,
  setE1CheckpointUpdate,
  setE1Prediction,
  setE2Decision,
  setE2Trace,
  setE2TraceAction,
  setIdeaCardField,
  setIoTRecord,
  setIoTVersion,
  startCompetition,
  startE1Arm,
  startE2,
  startIoT,
} from './session';

export interface C90CoursePanelsProps {
  readonly provider: CourseDataProvider;
  readonly manifest: CourseManifest;
  readonly e1: E1Experiment;
  readonly e2: E2Experiment;
  readonly iot: IoTChallenge;
  readonly session: CourseSessionState;
  readonly frame: CourseSceneFrame;
  readonly tleJourney: TleJourney;
  readonly tleBundle: TleTrajectoryBundle;
  readonly tleFrame: TleTrajectoryFrame;
  readonly exportedBundle: LearningBundle | null;
  readonly exportMessage: string;
  readonly onUpdate: (updater: (state: CourseSessionState) => CourseSessionState) => void;
  readonly onExport: () => void;
  readonly onCompleteAndExport: () => void;
  readonly onReset: () => void;
}

function metric(value: number, unit: string, digits = 0): string {
  return `${value.toFixed(digits)} ${unit}`;
}

function statusLabel(status: ServiceStatus): string {
  return status === 'served' ? 'served · deadline 內' : status === 'deadline-missed' ? 'deadline missed' : 'expired';
}

function statusClass(status: ServiceStatus): string {
  return status === 'served' ? 'is-good' : 'is-warn';
}

function VerdictButtons({
  value,
  onChange,
  prefix,
}: {
  readonly value: 'accept' | 'qualify' | 'reject' | null;
  readonly onChange: (value: 'accept' | 'qualify' | 'reject') => void;
  readonly prefix: string;
}) {
  return (
    <div className="c90-verdicts" role="group" aria-label={`${prefix} verdict`}>
      {(['accept', 'qualify', 'reject'] as const).map(option => (
        <button
          key={option}
          type="button"
          className={`c90-verdict ${value === option ? 'is-selected' : ''}`}
          data-testid={`${prefix}-verdict-${option}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ eyebrow, title, question }: { readonly eyebrow: string; readonly title: string; readonly question?: string }) {
  return (
    <div className="c90-section-header">
      <p className="c90-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {question && <p className="c90-question">{question}</p>}
    </div>
  );
}

function ReadyPanel({ session, onUpdate }: Pick<C90CoursePanelsProps, 'session' | 'onUpdate'>) {
  const [checks, setChecks] = useState([session.readyCheckCompleted, session.readyCheckCompleted, session.readyCheckCompleted]);
  const ready = checks.every(Boolean);
  return (
    <div className="c90-panel-stack">
      <SectionHeader eyebrow="00:00 · 60 seconds" title="Ready check" question="每位學生先確認：這台機器能在無安裝、無 login 的情況下進入同一個 fixture workspace。" />
      <div className="c90-checklist">
        {[
          '我看得到 NTPU course workspace',
          '我知道資料是 simulated teaching data',
          '我可以按 Reset 回到固定 checkpoint',
        ].map((label, index) => (
          <label key={label}><input type="checkbox" checked={checks[index]} onChange={event => setChecks(current => current.map((value, itemIndex) => itemIndex === index ? event.target.checked : value))} /> {label}</label>
        ))}
      </div>
      <button className="c90-primary-button" type="button" data-testid="ready-check" disabled={!ready} onClick={() => onUpdate(state => state.readyCheckCompleted ? { ...state, activeStage: 'tle' } : markReadyCheckComplete(state))}>
        {session.readyCheckCompleted ? 'Ready check complete · 回到 TLE' : 'Ready · 開始 TLE journey'}
      </button>
      <p className="c90-helper">若同學的畫面未就緒，工作人員提供相同的 offline fallback scenario；不把安裝或除錯算進學習時間。</p>
    </div>
  );
}

function E1ArmTable({ arms, completed }: { readonly arms: readonly E1Arm[]; readonly completed: readonly string[] }) {
  return (
    <div className="c90-table-wrap">
      <table className="c90-table">
        <caption>Three-arm comparison · same scenario / payload / deadline</caption>
        <thead><tr><th>Arm</th><th>Service</th><th>time (s)</th><th>power (W)</th><th>energy (J)</th><th>data (Mbit)</th><th>EE (Mbit/J)</th></tr></thead>
        <tbody>{arms.map(arm => {
          const isCompleted = completed.includes(arm.id);
          return (
          <tr key={arm.id} className={isCompleted ? 'is-complete' : ''}>
            <th scope="row">{arm.shortLabel}</th>
            <td>{isCompleted ? <span className={`c90-status ${statusClass(arm.outcome.serviceStatus)}`}>{statusLabel(arm.outcome.serviceStatus)}</span> : '—'}</td>
            <td>{isCompleted ? metric(arm.outcome.completionSec, 's') : '—'}</td>
            <td>{isCompleted ? metric(arm.outcome.powerW, 'W') : '—'}</td>
            <td>{isCompleted ? metric(arm.outcome.energyJ, 'J') : '—'}</td>
            <td>{isCompleted ? metric(arm.outcome.deliveredDataMbit, 'Mbit') : '—'}</td>
            <td>{isCompleted ? metric(arm.outcome.eeMbitPerJ, 'Mbit/J', 3) : '—'}</td>
          </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function E1Panel({ e1, session, onUpdate }: Pick<C90CoursePanelsProps, 'e1' | 'session' | 'onUpdate'>) {
  const activeArm = e1.arms.find(arm => arm.id === session.e1ActiveArmId) ?? null;
  const activeFrame = activeArm?.frames[session.e1TimelineIndex] ?? null;
  const allComplete = session.e1CompletedArmIds.length === e1.arms.length;
  const canContinue = allComplete
    && session.e1Prediction.trim() !== ''
    && session.e1CheckpointUpdate.trim() !== ''
    && session.e1SelectedArm !== null
    && session.e1Verdict !== null
    && session.e1Explanation.trim() !== '';
  return (
    <div className="c90-panel-stack">
      <SectionHeader eyebrow="10–32 · E1 / 22 minutes" title="Power × active time" question={e1.question} />
      <div className="c90-invariant">LOCKED COMPARISON · {e1.invariant}</div>
      <label className="c90-field-label" htmlFor="e1-prediction">Before running: rank your prediction</label>
      <textarea id="e1-prediction" value={session.e1Prediction} onChange={event => onUpdate(state => setE1Prediction(state, event.target.value))} placeholder="例如：low-power 會降低 W，但可能因為更久而…" rows={2} />
      <div className="c90-arm-grid">
        {e1.arms.map(arm => {
          const active = session.e1ActiveArmId === arm.id;
          const done = session.e1CompletedArmIds.includes(arm.id);
          return (
            <button key={arm.id} type="button" className={`c90-arm-card ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`} data-testid={`e1-arm-${arm.id}`} aria-label={`${arm.label} · ${done ? 'completed, replay available' : 'run this arm'}`} aria-pressed={active} disabled={session.e1Prediction.trim() === '' || (session.e1ActiveArmId !== null && !active)} onClick={() => onUpdate(state => startE1Arm(state, arm.id))}>
              <span className="c90-arm-card__status">{done ? '✓ complete' : active ? '● running' : '○ choose'}</span>
              <strong>{arm.label}</strong>
              <span>{arm.changedPolicy}</span>
            </button>
          );
        })}
      </div>
      {activeArm && activeFrame && (
        <div className="c90-run-card" data-testid="e1-active-run" data-frame-id={activeFrame.identity.frameId}>
          <div className="c90-card-topline"><strong>{activeArm.label} · frame {activeFrame.frameIndex + 1}/4</strong><span>{activeFrame.identity.frameId} · {activeArm.learnerPrompt}</span></div>
          <div className="c90-frame-sync"><span>SYNCED FRAME</span><strong>{activeFrame.identity.frameId}</strong><small>scene + right-rail KPI + this card use this exact fixture frame</small></div>
          <div className="c90-mini-metrics"><span>service <b>{statusLabel(activeFrame.service.status)}</b></span><span>rate <b>{metric(activeFrame.service.rateMbps, 'Mbps', 2)}</b></span><span>time <b>{metric(activeFrame.elapsedSec, 's')}</b></span><span>power <b>{metric(activeFrame.energy.powerW, 'W')}</b></span><span>energy <b>{metric(activeFrame.energy.energyJ, 'J')}</b></span><span>data <b>{metric(activeFrame.service.deliveredDataMbit, 'Mbit')}</b></span><span>EE <b>{metric(activeFrame.energy.eeMbitPerJ, 'Mbit/J', 3)}</b></span></div>
          {session.e1TimelineIndex < activeArm.frames.length - 1 ? (
            <button className="c90-primary-button" type="button" data-testid="e1-next-frame" onClick={() => onUpdate(state => advanceE1Frame(state, activeArm.frames.length))}>Advance one frame · observe</button>
          ) : (
            <button className="c90-primary-button" type="button" data-testid="e1-finish-arm" disabled={session.e1CheckpointUpdate.trim() === ''} onClick={() => onUpdate(state => finishE1Arm(state, activeArm.id))}>Save this arm · choose another</button>
          )}
        </div>
      )}
      {session.e1TimelineIndex > 0 && (
        <div className="c90-decision-card">
          <label className="c90-field-label" htmlFor="e1-checkpoint-update">Mid-run observation update（跑完第一個 frame 後更新）</label>
          <textarea id="e1-checkpoint-update" data-testid="e1-checkpoint-update" value={session.e1CheckpointUpdate} onChange={event => onUpdate(state => setE1CheckpointUpdate(state, event.target.value))} placeholder="我現在觀察到 W / rate / active time 的方向是…" rows={2} />
        </div>
      )}
      <E1ArmTable arms={e1.arms} completed={session.e1CompletedArmIds} />
      {allComplete && (
        <div className="c90-decision-card">
          <div className="c90-card-topline"><strong>Update your judgment</strong><span>高 EE 但 miss deadline 不是 mission winner</span></div>
          <div className="c90-choice-row" role="group" aria-label="E1 recommendation">
            {e1.arms.map(arm => <label key={arm.id}><input type="radio" name="e1-choice" checked={session.e1SelectedArm === arm.id} onChange={() => onUpdate(state => setE1Decision(state, arm.id, state.e1Verdict, state.e1Explanation))} /> {arm.shortLabel}</label>)}
          </div>
          <VerdictButtons value={session.e1Verdict} prefix="e1" onChange={verdict => onUpdate(state => setE1Decision(state, state.e1SelectedArm, verdict, state.e1Explanation))} />
          <textarea value={session.e1Explanation} onChange={event => onUpdate(state => setE1Decision(state, state.e1SelectedArm, state.e1Verdict, event.target.value))} placeholder="My choice / what changed / service result / energy result / why" rows={3} aria-label="E1 explanation" />
          <button className="c90-primary-button" type="button" disabled={!canContinue} onClick={() => onUpdate(startE2)}>Continue to E2 →</button>
        </div>
      )}
    </div>
  );
}

function traceBranch(trace: E2Trace, action: string | null): E2Branch | null {
  return trace.branches.find(branch => branch.action === action) ?? null;
}

function E2Panel({ e2, session, onUpdate }: Pick<C90CoursePanelsProps, 'e2' | 'session' | 'onUpdate'>) {
  const trace = session.e2TraceId === 'trace-a' ? e2.traceA : e2.traceB;
  const activeBranch = traceBranch(trace, session.e2ActiveAction);
  const activeFrame = activeBranch?.frames[session.e2TimelineIndex] ?? null;
  const hasAReplay = session.e2TraceAAction !== null && session.e2TraceAReplayAction !== null;
  const canUseB = hasAReplay && session.e2RuleFrozen;
  const canFreezeRule = hasAReplay && !session.e2RuleFrozen && session.e2FrozenRule.trim() !== '';
  const canContinue = hasAReplay
    && session.e2TraceBCompleted
    && session.e2TraceBAction !== null
    && session.e2FrozenRule.trim() !== ''
    && session.e2Verdict !== null
    && session.e2Prediction.trim() !== ''
    && session.e2Explanation.trim() !== '';
  const pickAction = (action: E2Branch['action']) => onUpdate(state => selectE2Action(state, action));
  const currentActionAlreadySaved = activeBranch !== null && (
    session.e2TraceId === 'trace-a'
      ? session.e2TraceAReplayAction !== null || session.e2TraceAAction === activeBranch.action
      : session.e2TraceBCompleted
  );
  const canConfirmAction = activeBranch !== null
    && session.e2TimelineIndex === activeBranch.frames.length - 1
    && session.e2Prediction.trim() !== ''
    && (session.e2TraceId === 'trace-a' || canUseB)
    && !currentActionAlreadySaved;
  return (
    <div className="c90-panel-stack">
      <SectionHeader eyebrow="32–54 · E2 / 22 minutes" title="Handover timing" question={e2.question} />
      <div className="c90-invariant">LOCKED TRACE · {e2.invariant}</div>
      <label className="c90-field-label" htmlFor="e2-prediction">At the overlap event, predict before replay</label>
      <textarea id="e2-prediction" value={session.e2Prediction} onChange={event => onUpdate(state => ({ ...state, e2Prediction: event.target.value }))} placeholder="我會 switch / wait / remain，因為…" rows={2} />
      <div className="c90-trace-note" data-testid="e2-trace-note"><strong>{trace.title}</strong><span>{trace.trend}</span><small>only changed input: {trace.changedInput}</small></div>
      <div className="c90-action-grid">
        {trace.branches.map(branch => (
          <button key={branch.action} type="button" className={`c90-action-card ${session.e2ActiveAction === branch.action ? 'is-active' : ''}`} data-testid={`e2-action-${branch.action}`} aria-label={`${branch.label} · ${branch.plainLanguageRule}`} aria-pressed={session.e2ActiveAction === branch.action} disabled={session.e2Prediction.trim() === '' || (trace.id === 'trace-b' && !canUseB)} onClick={() => pickAction(branch.action)}>
            <strong>{branch.label}</strong><span>{branch.plainLanguageRule}</span>
          </button>
        ))}
      </div>
      {activeBranch && activeFrame && (
        <div className="c90-run-card" data-testid="e2-active-run" data-frame-id={activeFrame.identity.frameId}>
          <div className="c90-card-topline"><strong>{activeBranch.label} · frame {session.e2TimelineIndex + 1}/4</strong><span>{activeFrame.identity.frameId} · {activeFrame.beam.qualityLabel}</span></div>
          <div className="c90-mini-metrics"><span>service <b>{statusLabel(activeFrame.service.status)}</b></span><span>rate <b>{metric(activeFrame.service.rateMbps, 'Mbps', 2)}</b></span><span>beam <b>{activeFrame.link.servingBeamId}</b></span><span>time <b>{metric(activeFrame.elapsedSec, 's')}</b></span><span>power <b>{metric(activeFrame.energy.powerW, 'W')}</b></span><span>energy <b>{metric(activeFrame.energy.energyJ, 'J')}</b></span><span>EE <b>{metric(activeFrame.energy.eeMbitPerJ, 'Mbit/J', 3)}</b></span></div>
          <div className="c90-run-controls"><button className="c90-secondary-button" type="button" data-testid="e2-rewind" aria-label={`Rewind ${activeBranch.label} to the overlap event`} onClick={() => onUpdate(state => ({ ...state, e2TimelineIndex: 0 }))}>Rewind to event</button>{session.e2TimelineIndex < activeBranch.frames.length - 1 ? <button className="c90-primary-button" type="button" data-testid="e2-advance" onClick={() => onUpdate(state => advanceE2Frame(state, activeBranch.frames.length))}>Advance trace</button> : <button className="c90-primary-button" type="button" data-testid="e2-save-action" disabled={!canConfirmAction} onClick={() => onUpdate(state => setE2TraceAction(state, activeBranch.action))}>{session.e2TraceId === 'trace-b' ? 'Save withheld Trace B result' : session.e2TraceAAction === null ? 'Save Trace A choice' : 'Save Trace A replay choice'}</button>}</div>
        </div>
      )}
      <div className="c90-decision-card">
        <div className="c90-card-topline"><strong>Rule gate</strong><span>{hasAReplay ? 'Trace A replay recorded' : 'Trace A first choice + replay required'}</span></div>
        <label className="c90-field-label" htmlFor="e2-rule">Freeze one plain-language rule before Trace B</label>
        <input id="e2-rule" value={session.e2FrozenRule} disabled={session.e2RuleFrozen} onChange={event => onUpdate(state => setE2Decision(state, event.target.value, state.e2Verdict, state.e2Explanation))} placeholder="例如：only switch after stable improvement" />
        <button className="c90-secondary-button" type="button" data-testid="e2-freeze-rule" disabled={!canFreezeRule} onClick={() => onUpdate(freezeE2Rule)}>{session.e2RuleFrozen ? 'Rule frozen · Trace B unlocked' : hasAReplay ? 'Freeze rule & reveal Trace B' : 'Run Trace A twice before freezing'}</button>
      </div>
      <div className="c90-tab-row" role="tablist" aria-label="E2 traces">
        <button type="button" role="tab" aria-selected={session.e2TraceId === 'trace-a'} className={session.e2TraceId === 'trace-a' ? 'is-selected' : ''} onClick={() => onUpdate(state => setE2Trace(state, 'trace-a'))}>Trace A · stable</button>
        <button type="button" role="tab" aria-selected={session.e2TraceId === 'trace-b'} disabled={!canUseB} className={session.e2TraceId === 'trace-b' ? 'is-selected' : ''} onClick={() => onUpdate(state => setE2Trace(state, 'trace-b'))}>Trace B · {canUseB ? 'withheld' : 'locked'}</button>
      </div>
      <div className="c90-decision-card">
        <VerdictButtons value={session.e2Verdict} prefix="e2" onChange={verdict => onUpdate(state => setE2Decision(state, state.e2FrozenRule, verdict, state.e2Explanation))} />
        <textarea value={session.e2Explanation} onChange={event => onUpdate(state => setE2Decision(state, state.e2FrozenRule, state.e2Verdict, event.target.value))} placeholder="A 與 B 的 trend 有何不同？何時 alternative 會更好？" rows={3} aria-label="E2 explanation" />
        <button className="c90-primary-button" type="button" disabled={!canContinue} onClick={() => onUpdate(startIoT)}>Continue to IoT challenge →</button>
      </div>
    </div>
  );
}

function IoTRunTable({ runs, selectedVersion }: { readonly runs: readonly IoTRun[]; readonly selectedVersion: IoTVersion }) {
  return (
    <div className="c90-table-wrap">
      <table className="c90-table">
        <caption>Same arrivals / windows · baseline → learner → one revision</caption>
        <thead><tr><th>Version</th><th>delivered (Mbit)</th><th>fresh</th><th>expired</th><th>active (s)</th><th>energy (J)</th><th>EE (Mbit/J)</th></tr></thead>
        <tbody>{runs.map(run => <tr key={run.version} className={run.version === selectedVersion ? 'is-selected' : ''}><th scope="row">{run.label}</th><td>{metric(run.deliveredDataMbit, 'Mbit')}</td><td>{run.freshCount}</td><td>{run.expiredCount}</td><td>{metric(run.activeTimeSec, 's')}</td><td>{metric(run.energyJ, 'J')}</td><td>{metric(run.eeMbitPerJ, 'Mbit/J', 3)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function IoTPanel({ iot, session, onUpdate }: Pick<C90CoursePanelsProps, 'iot' | 'session' | 'onUpdate'>) {
  const versions: readonly IoTVersion[] = ['baseline', 'learner', 'revision'];
  const selectedRun = iot.runs.find(run => run.version === session.iotSelectedVersion) ?? null;
  const canContinue = session.iotPrediction.trim() !== ''
    && session.iotSelectedVersion !== 'baseline'
    && selectedRun !== null
    && session.iotSelectedRule.trim() !== ''
    && session.iotRevisedRule.trim() !== ''
    && session.iotVerdict !== null
    && session.iotExplanation.trim() !== '';
  const selectVersion = (version: IoTVersion, run: IoTRun) => onUpdate(state => {
    const next = setIoTVersion(state, version);
    const learnerRule = version === 'learner' && state.iotSelectedRule.trim() === '' ? run.rule : state.iotSelectedRule;
    const revisedRule = version === 'revision' && state.iotRevisedRule.trim() === '' ? run.rule : state.iotRevisedRule;
    return setIoTRecord(next, state.iotPrediction, learnerRule, revisedRule, state.iotVerdict, state.iotExplanation);
  });
  return (
    <div className="c90-panel-stack">
      <SectionHeader eyebrow="54–72 · IoT design challenge" title="Priority, batching, freshness" question={iot.question} />
      <div className="c90-invariant">LOCKED ARRIVALS · {iot.invariant}</div>
      <label className="c90-field-label" htmlFor="iot-prediction">Before placing tasks: what should change?</label>
      <textarea id="iot-prediction" value={session.iotPrediction} onChange={event => onUpdate(state => ({ ...state, iotPrediction: event.target.value }))} placeholder="我會讓 alarm…，routine…，因為…" rows={2} />
      <div className="c90-task-grid">{iot.tasks.map(task => <article key={task.id} className="c90-task-card"><span>{task.label}</span><strong>{task.value}</strong><small>arrival {task.arrivalSec}s · {task.window}</small><small>{task.freshnessGoal}</small></article>)}</div>
      <div className="c90-window-strip">{iot.windows.map(window => <span key={window}>{window}</span>)}</div>
      <div className="c90-version-heading"><strong>Three versions · compare before revising</strong><span>{iot.runs.length}/3 provider versions available</span></div>
      <div className="c90-rule-picker" role="group" aria-label="IoT prepared rules" data-testid="iot-version-picker">
        {versions.map(version => {
          const run = iot.runs.find(candidate => candidate.version === version) ?? null;
          return <button key={version} type="button" className={session.iotSelectedVersion === version ? 'is-selected' : ''} data-testid={`iot-version-${version}`} aria-pressed={session.iotSelectedVersion === version} disabled={run === null} onClick={() => { if (run === null) return; selectVersion(version, run); }}>{run?.label ?? `${version} unavailable`}<small>{run?.rule ?? 'provider did not supply this version'}</small></button>;
        })}
      </div>
      {selectedRun ? <div className="c90-run-card" data-testid="iot-selected-run" data-frame-id={selectedRun.frame.identity.frameId}><div className="c90-card-topline"><strong>{selectedRun.label}</strong><span>{selectedRun.frame.identity.frameId} · {selectedRun.rule}</span></div><div className="c90-mini-metrics"><span>delivered <b>{metric(selectedRun.deliveredDataMbit, 'Mbit')}</b></span><span>rate <b>{metric(selectedRun.frame.service.rateMbps, 'Mbps', 2)}</b></span><span>fresh <b>{selectedRun.freshCount}</b></span><span>expired <b>{selectedRun.expiredCount}</b></span><span>active <b>{metric(selectedRun.activeTimeSec, 's')}</b></span><span>energy <b>{metric(selectedRun.energyJ, 'J')}</b></span><span>EE <b>{metric(selectedRun.eeMbitPerJ, 'Mbit/J', 3)}</b></span></div><div className="c90-task-result-row">{selectedRun.taskResults.map(result => <span key={result.taskId} className={result.status === 'delivered-fresh' ? 'is-good' : 'is-warn'}>{result.taskId} · {result.status.replace(/-/g, ' ')}</span>)}</div></div> : <div className="c90-evidence-card" role="alert"><strong>Selected IoT version unavailable</strong><p>The provider did not supply a run for this version. No fallback KPI is shown.</p></div>}
      <IoTRunTable runs={iot.runs} selectedVersion={session.iotSelectedVersion} />
      <div className="c90-decision-card"><label className="c90-field-label" htmlFor="iot-selected-rule">Your learner rule</label><input id="iot-selected-rule" value={session.iotSelectedRule} onChange={event => onUpdate(state => setIoTRecord(state, state.iotPrediction, event.target.value, state.iotRevisedRule, state.iotVerdict, state.iotExplanation))} placeholder="Choose learner, then describe the rule you tested" /><label className="c90-field-label" htmlFor="iot-revised-rule">One revision</label><input id="iot-revised-rule" value={session.iotRevisedRule} onChange={event => onUpdate(state => setIoTRecord(state, state.iotPrediction, state.iotSelectedRule, event.target.value, state.iotVerdict, state.iotExplanation))} placeholder="What changed after observing the learner run?" /><VerdictButtons value={session.iotVerdict} prefix="iot" onChange={verdict => onUpdate(state => setIoTRecord(state, state.iotPrediction, session.iotSelectedRule, session.iotRevisedRule, verdict, state.iotExplanation))} /><textarea value={session.iotExplanation} onChange={event => onUpdate(state => setIoTRecord(state, state.iotPrediction, state.iotSelectedRule, state.iotRevisedRule, state.iotVerdict, event.target.value))} placeholder="What improved, and what did it sacrifice?" rows={3} aria-label="IoT explanation" /><button className="c90-primary-button" type="button" disabled={!canContinue} onClick={() => onUpdate(startCompetition)}>Continue to competition idea →</button></div>
    </div>
  );
}

const IDEA_FIELDS: readonly { readonly key: keyof IdeaCard; readonly label: string; readonly hint: string }[] = [
  { key: 'sensedData', label: '1 · Sensed data', hint: 'What is observed?' },
  { key: 'stateToPredict', label: '2 · State to predict', hint: 'What state or trend changes?' },
  { key: 'baseline', label: '3 · Baseline', hint: 'What happens today?' },
  { key: 'controlAction', label: '4 · Manipulated control', hint: 'What action changes the mechanism?' },
  { key: 'powerTimePathway', label: '5 · Power/time pathway', hint: 'Why could active time or W change?' },
  { key: 'energyIndicator', label: '6 · Energy indicator + unit', hint: 'J, Wh, or another defined boundary?' },
  { key: 'serviceConstraint', label: '7 · Service constraint', hint: 'What quality must not be lost?' },
  { key: 'falsifier', label: '8 · Falsifying measurement', hint: 'What result would disprove saving?' },
];

function CompetitionPanel({ provider, session, onUpdate, onCompleteAndExport }: Pick<C90CoursePanelsProps, 'provider' | 'session' | 'onUpdate' | 'onCompleteAndExport'>) {
  const complete = Object.values(session.ideaCard).every(value => value.trim() !== '');
  const readiness = courseSessionReadiness(session, provider);
  const canExport = complete && readiness.ready;
  return (
    <div className="c90-panel-stack">
      <SectionHeader eyebrow="72–84 · competition transfer" title="Make one falsifiable idea card" question="把 satellite lesson 轉成 smart-energy / IoT hypothesis，而不是只寫『use AI』。" />
      <div className="c90-idea-grid">{IDEA_FIELDS.map(field => <label key={field.key} className="c90-idea-field" htmlFor={`idea-${field.key}`}><span>{field.label}</span><small>{field.hint}</small><textarea id={`idea-${field.key}`} data-testid={`idea-${field.key}`} aria-required="true" value={session.ideaCard[field.key]} onChange={event => onUpdate(state => setIdeaCardField(state, field.key, event.target.value))} rows={2} /></label>)}</div>
      <div className="c90-bundle-cta"><strong>{canExport ? 'Idea card complete · ready for final checkpoint' : complete ? 'Complete earlier evidence before final export' : 'Fill all eight fields before final export'}</strong><span>Bundle includes TLE explanation, E1 three-arm table, Trace A/B, IoT three versions, verdicts and claim labels.</span>{!readiness.ready && <small className="c90-export-reasons">{readiness.reasons.join(' · ')}</small>}<button className="c90-primary-button" type="button" data-testid="export-learning-bundle" disabled={!canExport} onClick={onCompleteAndExport}>Complete checkpoint & export bundle</button></div>
    </div>
  );
}

function CompletePanel({ exportedBundle, exportMessage, onExport, onReset }: Pick<C90CoursePanelsProps, 'exportedBundle' | 'exportMessage' | 'onExport' | 'onReset'>) {
  return (
    <div className="c90-panel-stack c90-complete-panel">
      <SectionHeader eyebrow="84–90 · retrieval + self-study" title="Learning bundle checkpoint" question="這份記錄只描述 fixture 世界內的推理，不是 scientific receipt。" />
      <div className="c90-retrieval-list"><p>✓ lower power 可能因為 active time 變長而沒有改善總 J</p><p>✓ switch timing 的結果依賴 future link trend，不存在 universal rule</p><p>✓ IoT idea 必須同時寫 data、control、energy boundary、service constraint 與 falsifier</p></div>
      <div className="c90-export-card"><span>export status</span><strong>{exportedBundle ? 'ready · deterministic replay bundle' : 'not exported'}</strong><small aria-live="polite">{exportMessage}</small><button className="c90-primary-button" type="button" data-testid="export-learning-bundle-again" onClick={onExport}>Export learning bundle again</button></div>
      <button className="c90-secondary-button" type="button" onClick={onReset}>Reset to ready checkpoint</button>
    </div>
  );
}

function LeftPanel(props: C90CoursePanelsProps) {
  switch (props.session.activeStage) {
    case 'ready': return <ReadyPanel session={props.session} onUpdate={props.onUpdate} />;
    case 'tle': return <C90TlePanel journey={props.tleJourney} session={props.session} bundle={props.tleBundle} frame={props.tleFrame} onUpdate={props.onUpdate} />;
    case 'e1': return <E1Panel e1={props.e1} session={props.session} onUpdate={props.onUpdate} />;
    case 'e2': return <E2Panel e2={props.e2} session={props.session} onUpdate={props.onUpdate} />;
    case 'iot': return <IoTPanel iot={props.iot} session={props.session} onUpdate={props.onUpdate} />;
    case 'competition': return <CompetitionPanel provider={props.provider} session={props.session} onUpdate={props.onUpdate} onCompleteAndExport={props.onCompleteAndExport} />;
    case 'complete': return <CompletePanel exportedBundle={props.exportedBundle} exportMessage={props.exportMessage} onExport={props.onExport} onReset={props.onReset} />;
  }
}

function ReadoutPanel({ manifest, provider, frame, tleJourney, tleBundle, tleFrame, session, exportedBundle, exportMessage, onExport }: Pick<C90CoursePanelsProps, 'manifest' | 'provider' | 'frame' | 'tleJourney' | 'tleBundle' | 'tleFrame' | 'session' | 'exportedBundle' | 'exportMessage' | 'onExport'>) {
  const readiness = courseSessionReadiness(session, provider);
  const exportReady = session.activeStage === 'complete' && readiness.ready;
  const isTle = session.activeStage === 'tle';
  const tleSource = tleJourney.sources.find(source => source.sourceId === tleBundle.sourceId);
  if (tleSource === undefined) throw new Error(`C-90 TLE readout source unavailable: ${tleBundle.sourceId}`);
  return (
    <div className="c90-right-stack">
      <div className="c90-claim-box" data-testid="panel-claim-boundary"><span>claim boundary</span><strong>{manifest.claimBoundary}</strong><small>Every number below is a read-only fixture value. It is not a live backend result, measurement, or canonical-parity claim.</small><small>{manifest.claimLevels.join(' · ')}</small></div>
      {isTle ? (
        <section className="c90-readout-card" data-testid="c90-synchronized-readout" data-frame-id={tleFrame.frameId}>
          <div className="c90-card-topline"><span>same producer frame drives scene + timeline + readout</span><strong>{tleFrame.frameId}</strong></div>
          <div className="c90-frame-sync"><span>TLE / SCENE SYNC</span><strong>{tleFrame.targetUtc}</strong><small>{tleBundle.bundleId} · precomputed, no browser SGP4</small></div>
          <div className="c90-kpi-grid c90-kpi-grid--tle">
            <div><span>TLE epoch</span><strong>{tleSource.epochUtc}</strong></div>
            <div><span>target − epoch</span><strong>{(tleFrame.ageSeconds / 3600).toFixed(2)} h</strong></div>
            <div><span>azimuth</span><strong>{tleFrame.look.azimuthDeg.toFixed(2)} deg</strong></div>
            <div><span>elevation</span><strong>{tleFrame.look.elevationDeg.toFixed(2)} deg</strong></div>
            <div><span>range</span><strong>{tleFrame.look.rangeKm.toFixed(1)} km</strong></div>
            <div><span>visibility</span><strong className={tleFrame.look.visible ? 'is-good' : 'is-warn'}>{tleFrame.look.visible ? 'visible' : 'below horizon'}</strong></div>
            <div><span>altitude</span><strong>{tleFrame.geodetic.altitudeKm.toFixed(1)} km</strong></div>
            <div><span>model divergence</span><strong>{tleFrame.modelDeltaFromCourseSourceKm.toFixed(1)} km</strong></div>
          </div>
          <div className="c90-link-readout"><span>MODEL-DERIVED · {tleBundle.model}</span><span>divergence is not measured error</span><span>{tleSource.objectName} · NORAD {tleSource.noradCatalogId}</span></div>
        </section>
      ) : (
        <section className="c90-readout-card" data-testid="c90-synchronized-readout" data-frame-id={frame.identity.frameId}><div className="c90-card-topline"><span>same frame drives all readouts</span><strong>frame {frame.identity.frameId}</strong></div><div className="c90-frame-sync"><span>SCENE / KPI SYNC</span><strong>{frame.identity.frameId}</strong><small>scenario {frame.identity.scenarioId} · no live clock</small></div><div className="c90-kpi-grid"><div><span>service status</span><strong className={statusClass(frame.service.status)}>{statusLabel(frame.service.status)}</strong></div><div><span>rate</span><strong>{metric(frame.service.rateMbps, 'Mbps', 2)}</strong></div><div><span>time</span><strong>{metric(frame.elapsedSec, 's')}</strong></div><div><span>deadline</span><strong>{metric(frame.service.deadlineSec, 's')}</strong></div><div><span>power</span><strong>{metric(frame.energy.powerW, 'W')}</strong></div><div><span>energy</span><strong>{metric(frame.energy.energyJ, 'J')}</strong></div><div><span>delivered data</span><strong>{metric(frame.service.deliveredDataMbit, 'Mbit')}</strong></div><div><span>energy efficiency</span><strong>{metric(frame.energy.eeMbitPerJ, 'Mbit/J', 3)}</strong></div></div><div className="c90-link-readout"><span>link {frame.link.servingBeamId} · visibility {frame.link.visible ? 'visible' : 'not visible'}</span><span>{frame.beam.qualityLabel} · {frame.beam.trendLabel}</span><span>{frame.link.azimuthDeg}° az · {frame.link.elevationDeg}° el · {frame.link.rangeKm} km</span></div></section>
      )}
      {isTle ? (
        <section className="c90-identity-card"><div><span>source</span><strong>{tleSource.sourceId}</strong></div><div><span>bundle</span><strong>{tleBundle.bundleId}</strong></div><div><span>observer</span><strong>{tleJourney.observer.observerId}</strong></div><div><span>target UTC</span><strong>{tleFrame.targetUtc}</strong></div><div><span>record hash</span><strong className="c90-mono-wrap">{tleSource.recordSha256}</strong></div></section>
      ) : (
        <section className="c90-identity-card"><div><span>scenario</span><strong>{frame.identity.scenarioId}</strong></div><div><span>provider</span><strong>{provider.providerId}</strong></div><div><span>fixture</span><strong>{frame.identity.fixtureId}</strong></div><div><span>target UTC</span><strong>{frame.identity.targetUtc}</strong></div><div><span>contract</span><strong>{frame.identity.contractVersion}</strong></div></section>
      )}
      <section className="c90-evidence-card"><div className="c90-card-topline"><span>evidence / recovery</span><strong>{session.readyCheckCompleted ? 'checkpoint active' : 'ready check pending'}</strong></div><p>Reset/replay uses the same provider identity and precomputed branch. Missing fields fail closed in the bundle; no fallback KPI is invented.</p>{!readiness.ready && <ul className="c90-readiness-list">{readiness.reasons.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}</ul>}<div className="c90-bundle-status"><span>{exportedBundle ? 'bundle ready' : 'bundle pending'}</span><span>{exportedBundle ? exportedBundle.provenance.source : exportMessage}</span></div><button className="c90-secondary-button" type="button" data-testid="export-current-bundle" aria-label="Export the complete C-90 learning bundle" disabled={!exportReady} onClick={onExport}>{exportReady ? 'Export current learning bundle' : 'Finish flow to export bundle'}</button></section>
    </div>
  );
}

export function C90CoursePanels(props: C90CoursePanelsProps) {
  return (
    <>
      <aside className="c90-left-rail"><div className="c90-panel-claim-strip" data-testid="left-claim-boundary"><span>SIMULATED TEACHING · FIXTURE ONLY</span><strong>{props.manifest.claimBoundary}</strong></div><div className="c90-rail-scroll"><LeftPanel {...props} /></div></aside>
      <aside className="c90-right-rail"><div className="c90-rail-scroll"><ReadoutPanel manifest={props.manifest} provider={props.provider} frame={props.frame} tleJourney={props.tleJourney} tleBundle={props.tleBundle} tleFrame={props.tleFrame} session={props.session} exportedBundle={props.exportedBundle} exportMessage={props.exportMessage} onExport={props.onExport} /></div></aside>
    </>
  );
}
