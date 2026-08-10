import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C90CoursePanels, type C90CoursePanelsProps } from './C90CoursePanels';
import { C90CourseScene } from './C90CourseScene';
import {
  C90_CLAIM_LEVELS,
  type CourseDataProvider,
  type CourseSceneFrame,
  type CourseStage,
  type LearningBundle,
  type TleJourney,
  type TleTrajectoryBundle,
} from './contract';
import { C90_FIXTURE_PROVIDER } from './fixtures/e1-fixture';
import {
  buildLearningBundleInput,
  completeCourse,
  createInitialCourseSession,
  courseSessionReadiness,
  courseSessionStorageKey,
  restoreCourseSession,
  serializeCourseSession,
  setTleTimelineIndex,
  type CourseSessionState,
} from './session';
import './C90CourseRoute.scss';

export interface C90CourseRouteProps {
  readonly provider?: CourseDataProvider;
}

const STAGE_LABELS: readonly { readonly id: CourseStage; readonly label: string; readonly short: string }[] = [
  { id: 'ready', label: 'Ready', short: '0' },
  { id: 'tle', label: 'TLE journey', short: '1' },
  { id: 'e1', label: 'E1 power', short: '2' },
  { id: 'e2', label: 'E2 handover', short: '3' },
  { id: 'iot', label: 'IoT challenge', short: '4' },
  { id: 'competition', label: 'Idea card', short: '5' },
  { id: 'complete', label: 'Bundle', short: '6' },
];

function requireFrame(frames: readonly CourseSceneFrame[], index: number, label: string): CourseSceneFrame {
  const frame = frames[index];
  if (frame === undefined) throw new Error(`C-90 provider missing frame: ${label}/${index}`);
  return frame;
}

function loadInitialCourseSession(manifest: ReturnType<CourseDataProvider['getManifest']>): { readonly state: CourseSessionState; readonly restored: boolean } {
  const initial = createInitialCourseSession(manifest);
  if (typeof window === 'undefined') return { state: initial, restored: false };
  try {
    const restored = restoreCourseSession(manifest, window.localStorage.getItem(courseSessionStorageKey(manifest)));
    return restored === null ? { state: initial, restored: false } : { state: restored, restored: true };
  } catch {
    return { state: initial, restored: false };
  }
}

function activeFrameForSession(provider: CourseDataProvider, session: CourseSessionState): CourseSceneFrame {
  const e1 = provider.getE1Experiment();
  const e2 = provider.getE2Experiment();

  if (session.activeStage === 'e1' && session.e1ActiveArmId !== null) {
    const arm = e1.arms.find(candidate => candidate.id === session.e1ActiveArmId);
    if (arm === undefined) throw new Error(`C-90 provider missing E1 arm: ${session.e1ActiveArmId}`);
    return requireFrame(arm.frames, Math.min(session.e1TimelineIndex, arm.frames.length - 1), `E1/${arm.id}`);
  }

  if (session.activeStage === 'e2') {
    if (session.e2ActiveAction !== null) {
      const trace = session.e2TraceId === 'trace-a' ? e2.traceA : e2.traceB;
      const branch = trace.branches.find(candidate => candidate.action === session.e2ActiveAction);
      if (branch === undefined) throw new Error(`C-90 provider missing E2 branch: ${trace.id}/${session.e2ActiveAction}`);
      return requireFrame(branch.frames, Math.min(session.e2TimelineIndex, branch.frames.length - 1), `E2/${trace.id}/${branch.action}`);
    }
    const trace = session.e2TraceId === 'trace-a' ? e2.traceA : e2.traceB;
    const firstBranch = trace.branches[0];
    if (firstBranch === undefined) throw new Error('C-90 provider has no E2 branches');
    return requireFrame(firstBranch.frames, 0, `E2/${trace.id}/${firstBranch.action}`);
  }

  if (session.activeStage === 'iot' || session.activeStage === 'competition' || session.activeStage === 'complete') {
    const iot = provider.getIoTChallenge();
    const run = iot.runs.find(candidate => candidate.version === session.iotSelectedVersion);
    if (run === undefined) throw new Error(`C-90 provider missing IoT run: ${session.iotSelectedVersion}`);
    return run.frame;
  }

  const firstArm = e1.arms[0];
  if (firstArm === undefined) throw new Error('C-90 provider has no E1 arms');
  return requireFrame(firstArm.frames, 0, `E1/${firstArm.id}`);
}

function activeTimelineLength(provider: CourseDataProvider, session: CourseSessionState): number {
  if (session.activeStage === 'e1' && session.e1ActiveArmId !== null) {
    const arm = provider.getE1Experiment().arms.find(candidate => candidate.id === session.e1ActiveArmId);
    if (arm === undefined) throw new Error(`C-90 provider missing E1 arm: ${session.e1ActiveArmId}`);
    return arm.frames.length;
  }
  if (session.activeStage === 'e2' && session.e2ActiveAction !== null) {
    const experiment = provider.getE2Experiment();
    const trace = session.e2TraceId === 'trace-a' ? experiment.traceA : experiment.traceB;
    const branch = trace.branches.find(candidate => candidate.action === session.e2ActiveAction);
    if (branch === undefined) throw new Error(`C-90 provider missing E2 branch: ${trace.id}/${session.e2ActiveAction}`);
    return branch.frames.length;
  }
  return 1;
}

function selectedTleBundle(journey: TleJourney, session: CourseSessionState): TleTrajectoryBundle {
  const bundle = journey.trajectoryBundles.find(candidate => (
    candidate.sourceId === session.tleSelectedSourceId
    && candidate.windowId === session.tleSelectedWindowId
  ));
  if (bundle === undefined) {
    throw new Error(`C-90 provider missing TLE bundle: ${session.tleSelectedSourceId}/${session.tleSelectedWindowId}`);
  }
  return bundle;
}

function stageIsUnlocked(stage: CourseStage, session: CourseSessionState): boolean {
  if (stage === session.activeStage) return true;
  if (stage === 'ready') return true;
  if (stage === 'tle') return session.readyCheckCompleted;
  if (stage === 'e1') return session.tleCompleted;
  if (stage === 'e2') return session.e1CompletedArmIds.length >= 3
    && session.e1SelectedArm !== null
    && session.e1Verdict !== null
    && session.e1Explanation.trim() !== '';
  if (stage === 'iot') return session.e2TraceACompleted
    && session.e2TraceAReplayCompleted
    && session.e2TraceBCompleted
    && session.e2RuleFrozen
    && session.e2Verdict !== null
    && session.e2Explanation.trim() !== '';
  if (stage === 'competition') return session.iotSelectedVersion !== 'baseline'
    && session.iotPrediction.trim() !== ''
    && session.iotSelectedRule.trim() !== ''
    && session.iotVerdict !== null
    && session.iotRevisedRule.trim() !== ''
    && session.iotExplanation.trim() !== '';
  return session.activeStage === 'complete';
}

function classForStage(stage: CourseStage, session: CourseSessionState): string {
  return `${stage === session.activeStage ? 'is-active' : ''} ${stageIsUnlocked(stage, session) ? 'is-unlocked' : ''}`;
}

function StageNav({ session, onUpdate }: { readonly session: CourseSessionState; readonly onUpdate: C90CoursePanelsProps['onUpdate'] }) {
  return (
    <nav className="c90-stage-nav" aria-label="C-90 learning stages">
      {STAGE_LABELS.map(stage => (
        <button
          key={stage.id}
          type="button"
          className={classForStage(stage.id, session)}
          disabled={!stageIsUnlocked(stage.id, session)}
          aria-current={stage.id === session.activeStage ? 'step' : undefined}
          aria-label={`${stage.label}${stage.id === session.activeStage ? ' · current stage' : ''}`}
          onClick={() => onUpdate(state => ({ ...state, activeStage: stage.id }))}
        >
          <span>{stage.short}</span>{stage.label}
        </button>
      ))}
    </nav>
  );
}

function Timeline({ provider, session, frame, tleBundle, onUpdate }: { readonly provider: CourseDataProvider; readonly session: CourseSessionState; readonly frame: CourseSceneFrame; readonly tleBundle: TleTrajectoryBundle; readonly onUpdate: C90CoursePanelsProps['onUpdate'] }) {
  const isTle = session.activeStage === 'tle';
  const length = isTle ? tleBundle.frames.length : activeTimelineLength(provider, session);
  const value = isTle
    ? session.tleTimelineIndex
    : session.activeStage === 'e1'
    ? session.e1TimelineIndex
    : session.activeStage === 'e2'
      ? session.e2TimelineIndex
      : 0;
  const canScrub = length > 1;
  const tleFrame = tleBundle.frames[Math.min(session.tleTimelineIndex, tleBundle.frames.length - 1)];
  if (tleFrame === undefined) throw new Error(`C-90 provider missing TLE timeline frame: ${session.tleTimelineIndex}`);
  const activeFrameId = isTle ? tleFrame.frameId : frame.identity.frameId;
  const activeTimeLabel = isTle ? tleFrame.targetUtc : `${frame.elapsedSec} s`;
  return (
    <section className="c90-timeline" data-testid="c90-timeline">
      <div className="c90-timeline__top"><span>REPLAY / SAME FIXTURE FRAME</span><strong>{activeFrameId}</strong><span>{activeTimeLabel} · {isTle ? tleBundle.windowId : frame.identity.scenarioId}</span></div>
      <input
        aria-label="Replay fixture frame"
        aria-valuetext={`${activeFrameId} · ${activeTimeLabel}`}
        type="range"
        min={0}
        max={Math.max(0, length - 1)}
        value={value}
        disabled={!canScrub}
        onChange={event => {
          const next = Number(event.target.value);
          onUpdate(state => state.activeStage === 'tle'
            ? setTleTimelineIndex(state, next, tleBundle.frames.length)
            : state.activeStage === 'e1'
            ? { ...state, e1TimelineIndex: next }
            : state.activeStage === 'e2'
              ? { ...state, e2TimelineIndex: next }
              : state);
        }}
      />
      <div className="c90-timeline__labels"><span>checkpoint 0</span><span>{isTle ? 'precomputed target clock · no implicit now' : 'same scenario identity · no live clock'}</span><span>frame {value + 1}/{length} · {activeFrameId}</span></div>
    </section>
  );
}

export function C90CourseRoute({ provider = C90_FIXTURE_PROVIDER }: C90CourseRouteProps) {
  const manifest = useMemo(() => provider.getManifest(), [provider]);
  const tleJourney = useMemo(() => provider.getTleJourney(), [provider]);
  const e1 = useMemo(() => provider.getE1Experiment(), [provider]);
  const e2 = useMemo(() => provider.getE2Experiment(), [provider]);
  const iot = useMemo(() => provider.getIoTChallenge(), [provider]);
  const initialLoad = useMemo(() => loadInitialCourseSession(manifest), [manifest]);
  const [session, setSession] = useState<CourseSessionState>(() => initialLoad.state);
  const [restoredFromLocal, setRestoredFromLocal] = useState(initialLoad.restored);
  const [persistenceError, setPersistenceError] = useState(false);
  const [exportedBundle, setExportedBundle] = useState<LearningBundle | null>(null);
  const [exportMessage, setExportMessage] = useState('complete the guided flow, then export one learning bundle');
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const frame = activeFrameForSession(provider, session);
  const tleBundle = selectedTleBundle(tleJourney, session);
  const tleFrame = tleBundle.frames[Math.min(session.tleTimelineIndex, tleBundle.frames.length - 1)];
  if (tleFrame === undefined) throw new Error(`C-90 provider missing selected TLE frame: ${session.tleTimelineIndex}`);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(courseSessionStorageKey(manifest), serializeCourseSession(manifest, session));
      setPersistenceError(false);
    } catch {
      setPersistenceError(true);
    }
  }, [manifest, session]);

  const onUpdate = useCallback((updater: (state: CourseSessionState) => CourseSessionState) => {
    setSession(current => updater(current));
    setExportedBundle(null);
    setExportMessage('progress changed · complete the guided flow before exporting');
  }, []);

  const onReset = useCallback(() => {
    const nextOrdinal = sessionRef.current.resetOrdinal + 1;
    const nextSession = createInitialCourseSession(manifest, nextOrdinal);
    sessionRef.current = nextSession;
    setSession(nextSession);
    setRestoredFromLocal(false);
    setExportedBundle(null);
    setExportMessage('reset complete · same pinned scenario is ready');
  }, [manifest]);

  const exportSnapshot = useCallback((snapshot: CourseSessionState): boolean => {
    const readiness = courseSessionReadiness(snapshot, provider);
    const reasons = [...readiness.reasons];
    if (snapshot.activeStage !== 'complete') reasons.push('final Bundle checkpoint has not been completed');
    if (reasons.length > 0) {
      setExportedBundle(null);
      setExportMessage(`export blocked · ${reasons.join(' · ')}`);
      return false;
    }
    try {
      const bundle = provider.buildLearningBundle(buildLearningBundleInput(snapshot, provider));
      const json = JSON.stringify(bundle, null, 2);
      setExportedBundle(bundle);
      setExportMessage(`${json.length.toLocaleString()} bytes · ${bundle.provenance.fixtureId} · ${bundle.scenario.scenarioId}`);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${bundle.course.courseId}-${bundle.scenario.scenarioId}-learning-bundle.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch (error) {
      setExportedBundle(null);
      setExportMessage(`export blocked · provider data failed closed (${String(error)})`);
      return false;
    }
  }, [provider]);

  const onExport = useCallback(() => {
    exportSnapshot(sessionRef.current);
  }, [exportSnapshot]);

  const onCompleteAndExport = useCallback(() => {
    const current = sessionRef.current;
    const readiness = courseSessionReadiness(current, provider);
    if (!readiness.ready) {
      exportSnapshot(current);
      return;
    }
    const completed = completeCourse(current);
    sessionRef.current = completed;
    setSession(completed);
    exportSnapshot(completed);
  }, [exportSnapshot, provider]);

  return (
    <main className="c90-route" data-testid="c90-course-route" data-provider-kind={provider.kind} data-claim-levels={C90_CLAIM_LEVELS.join(',')} aria-labelledby="c90-course-title">
      <header className="c90-header">
        <div className="c90-brand-lockup"><span className="c90-kicker">LEO / NTPU · C-90 ENERGY BETA</span><h1 id="c90-course-title">Make the energy decision visible.</h1><p>Student-operated fixture journey · prediction → choice → replay → explanation</p></div>
        <div className="c90-header-actions"><span className="c90-sim-badge">SIMULATED TEACHING</span><span className={`c90-persistence-status ${persistenceError ? 'is-error' : ''}`} data-testid="persistence-status" role="status">{persistenceError ? 'local save unavailable' : restoredFromLocal ? 'local checkpoint restored' : 'local checkpoint saved on this device'}</span><button type="button" className="c90-reset-button" data-testid="reset-session" aria-label="Reset the C-90 session to the pinned checkpoint" onClick={onReset}>Reset checkpoint</button></div>
      </header>
      <div className="c90-claim-bar" data-testid="claim-boundary" aria-label="C-90 claim boundary"><span>CLAIM BOUNDARY</span><strong>{manifest.claimBoundary}</strong></div>
      <StageNav session={session} onUpdate={onUpdate} />
      <div className="c90-workspace" data-testid="c90-workspace" data-active-frame-id={session.activeStage === 'tle' ? tleFrame.frameId : frame.identity.frameId}>
        <C90CoursePanels key={`${session.resetOrdinal}:${session.activeStage}`} provider={provider} manifest={manifest} e1={e1} e2={e2} iot={iot} session={session} frame={frame} tleJourney={tleJourney} tleBundle={tleBundle} tleFrame={tleFrame} exportedBundle={exportedBundle} exportMessage={exportMessage} onUpdate={onUpdate} onExport={onExport} onCompleteAndExport={onCompleteAndExport} onReset={onReset} />
        <section className="c90-scene-column"><C90CourseScene frame={frame} tleJourney={tleJourney} tleBundle={tleBundle} tleFrame={session.activeStage === 'tle' ? tleFrame : null} /><Timeline provider={provider} session={session} frame={frame} tleBundle={tleBundle} onUpdate={onUpdate} /></section>
      </div>
      <footer className="c90-footer"><span>Phase 1 ceiling: fixture-world reasoning only</span><span>provider = {provider.kind} · {provider.providerId}</span><span>{manifest.claimBoundary}</span></footer>
    </main>
  );
}

export default C90CourseRoute;
