import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import type { SceneSourceMode } from './appPersistence';
import type { SceneLane } from './sceneLane';
import {
  resolveInstructorHandoverScenarioFrame,
} from '../homepage/teaching/instructorHandoverScenario';
import type {
  InstructorHandoverTransportSnapshot,
} from '../homepage/teaching/instructorHandoverTransport';
import {
  useInstructorHandoverTransport,
  type InstructorHandoverTransportController,
} from '../homepage/teaching/useInstructorHandoverTransport';
import {
  useStudentHandoverActivity,
  type StudentHandoverActivityController,
} from '../homepage/teaching/useStudentHandoverActivity';
import type {
  StudentHandoverActivityState,
} from '../homepage/teaching/studentHandoverActivityState';
import type {
  TeachingFrame,
  TeachingHandoverKind,
  TeachingIdentityBinding,
} from '../homepage/teaching/handoverTeachingScript';
import type {
  HandoverTeachingSceneStory,
} from '../scene/handoverStoryFrame';

export interface AppHandoverTeachingControllers {
  readonly transport: InstructorHandoverTransportController;
  readonly snapshot: InstructorHandoverTransportSnapshot | null;
  readonly student: StudentHandoverActivityController;
  readonly studentState: StudentHandoverActivityState;
  readonly studentModeActive: boolean;
  readonly teachingStageKind: TeachingHandoverKind | null;
}

/** Mount the R5 transport and R6 activity state once at the App boundary. */
export function useAppHandoverTeachingControllers(): AppHandoverTeachingControllers {
  const transport = useInstructorHandoverTransport();
  const student = useStudentHandoverActivity();
  const snapshot = transport.snapshot;
  const studentState = student.state;
  return useMemo(() => ({
    transport,
    snapshot,
    student,
    studentState,
    studentModeActive: studentState.active,
    teachingStageKind: snapshot?.segment.kind ?? null,
  }), [snapshot, student, studentState, transport]);
}
interface AppTeachingPlayback {
  readonly paused: boolean;
  readonly speed: number;
  readonly setPaused: (paused: boolean) => void;
  readonly setSpeed: (speed: number) => void;
}

export interface AppHandoverTeachingStageOptions {
  readonly controllers: AppHandoverTeachingControllers;
  readonly teachingIdentityBindingCandidate: TeachingIdentityBinding | null;
  readonly teachingSceneStoryCandidate: HandoverTeachingSceneStory | null;
  readonly instructorSevenBeamAdmitted: boolean;
  readonly isRootHomepage: boolean;
  readonly sceneSource: SceneSourceMode;
  readonly isWalkerSceneActive: boolean;
  readonly sceneLane: SceneLane;
  readonly playback: AppTeachingPlayback;
  readonly clearManualHandover: () => void;
}

export interface AppHandoverTeachingLecture {
  readonly frame: TeachingFrame | null;
  readonly setPaused: InstructorHandoverTransportController['setPaused'];
  readonly restart: InstructorHandoverTransportController['restart'];
  readonly seek: InstructorHandoverTransportController['seek'];
  readonly setSpeed: InstructorHandoverTransportController['setSpeed'];
}

export interface AppHandoverTeachingStage {
  readonly teachingIdentityBinding: TeachingIdentityBinding | null;
  readonly teachingSceneStory: HandoverTeachingSceneStory | null;
  readonly teachingLecture: AppHandoverTeachingLecture;
  readonly open: (kind: TeachingHandoverKind) => void;
  readonly close: () => void;
  readonly studentActivityLaunchEnabled: boolean;
  readonly startStudentActivity: () => void;
  readonly exitStudentActivity: () => void;
  readonly resetStudentActivity: () => void;
}

interface TeachingFixture {
  readonly key: string;
  readonly binding: TeachingIdentityBinding;
  readonly story: HandoverTeachingSceneStory;
}

function freezeTeachingBinding(
  candidate: TeachingIdentityBinding,
): TeachingIdentityBinding {
  return Object.freeze({
    serving: candidate.serving === null
      ? null
      : Object.freeze({ ...candidate.serving }),
    candidates: Object.freeze(
      candidate.candidates.map(item => Object.freeze({ ...item })),
    ),
  });
}

/**
 * Own the App integration policy around the already-pure R5/R6 state machines.
 * It may freeze the scientific producer and issue bounded transport commands;
 * it owns no source clock, winner, accepted snapshot, or simulation mutation.
 */
export function useAppHandoverTeachingStage({
  controllers,
  teachingIdentityBindingCandidate,
  teachingSceneStoryCandidate,
  instructorSevenBeamAdmitted,
  isRootHomepage,
  sceneSource,
  isWalkerSceneActive,
  sceneLane,
  playback,
  clearManualHandover,
}: AppHandoverTeachingStageOptions): AppHandoverTeachingStage {
  const { transport, snapshot, student, studentModeActive } = controllers;
  const fixtureRef = useRef<TeachingFixture | null>(null);
  const playbackRestoreRef = useRef<{
    readonly paused: boolean;
    readonly speed: number;
  } | null>(null);
  const fixtureKey = snapshot === null
    ? null
    : `${snapshot.scenarioId}:${snapshot.runId}:${snapshot.segment.index}`;

  const fixture = useMemo(() => {
    if (fixtureKey === null) {
      fixtureRef.current = null;
      return null;
    }
    if (fixtureRef.current?.key === fixtureKey) return fixtureRef.current;
    if (teachingIdentityBindingCandidate === null
      || teachingSceneStoryCandidate === null) {
      return null;
    }
    const next = Object.freeze({
      key: fixtureKey,
      binding: freezeTeachingBinding(teachingIdentityBindingCandidate),
      story: teachingSceneStoryCandidate,
    });
    fixtureRef.current = next;
    return next;
  }, [
    fixtureKey,
    teachingIdentityBindingCandidate,
    teachingSceneStoryCandidate,
  ]);
  const teachingIdentityBinding = fixture?.binding ?? null;
  const teachingSceneStory = fixture?.story ?? null;
  const teachingFrame = useMemo(
    () => snapshot === null
      ? null
      : resolveInstructorHandoverScenarioFrame(
        snapshot.sourceTimeSec,
        teachingIdentityBinding,
      ).frame,
    [snapshot, teachingIdentityBinding],
  );
  const teachingLecture = useMemo<AppHandoverTeachingLecture>(() => ({
    frame: teachingFrame,
    setPaused: transport.setPaused,
    restart: transport.restart,
    seek: transport.seek,
    setSpeed: transport.setSpeed,
  }), [
    teachingFrame,
    transport.restart,
    transport.seek,
    transport.setPaused,
    transport.setSpeed,
  ]);

  const open = useCallback((kind: TeachingHandoverKind): void => {
    if (!instructorSevenBeamAdmitted) return;
    clearManualHandover();
    if (playbackRestoreRef.current === null) {
      playbackRestoreRef.current = {
        paused: playback.paused,
        speed: playback.speed,
      };
    }
    if (!playback.paused) playback.setPaused(true);
    transport.open(kind);
  }, [
    clearManualHandover,
    instructorSevenBeamAdmitted,
    playback.paused,
    playback.setPaused,
    playback.speed,
    transport.open,
  ]);
  const close = useCallback((): void => {
    clearManualHandover();
    student.forceDeactivate();
    transport.close();
    const restore = playbackRestoreRef.current;
    playbackRestoreRef.current = null;
    if (restore === null) return;
    playback.setSpeed(restore.speed);
    playback.setPaused(restore.paused);
  }, [
    clearManualHandover,
    playback.setPaused,
    playback.setSpeed,
    student.forceDeactivate,
    transport.close,
  ]);

  const studentActivityLaunchEnabled = !studentModeActive
    && snapshot === null
    && isRootHomepage
    && sceneSource === 'live-sim'
    && isWalkerSceneActive
    && sceneLane === 'sinr-live'
    && instructorSevenBeamAdmitted;

  const startStudentActivity = useCallback((): void => {
    if (!studentActivityLaunchEnabled) return;
    student.activate();
    open('intra');
    transport.setPaused(true);
  }, [
    open,
    student.activate,
    studentActivityLaunchEnabled,
    transport.setPaused,
  ]);

  const exitStudentActivity = useCallback((): void => {
    student.exitCleanPredict();
    close();
  }, [close, student.exitCleanPredict]);
  const resetStudentActivity = useCallback((): void => {
    student.reset();
    transport.restart();
    transport.setPaused(true);
  }, [student.reset, transport.restart, transport.setPaused]);

  useEffect(() => {
    if (snapshot === null) return;
    const instructorLaneAvailable = isRootHomepage
      && sceneSource === 'live-sim'
      && isWalkerSceneActive
      && sceneLane === 'sinr-live'
      && instructorSevenBeamAdmitted;
    if (!instructorLaneAvailable) close();
  }, [
    close,
    instructorSevenBeamAdmitted,
    isRootHomepage,
    isWalkerSceneActive,
    sceneLane,
    sceneSource,
    snapshot,
  ]);

  return useMemo(() => ({
    teachingIdentityBinding,
    teachingSceneStory,
    teachingLecture,
    open,
    close,
    studentActivityLaunchEnabled,
    startStudentActivity,
    exitStudentActivity,
    resetStudentActivity,
  }), [
    close,
    exitStudentActivity,
    open,
    resetStudentActivity,
    startStudentActivity,
    studentActivityLaunchEnabled,
    teachingIdentityBinding,
    teachingLecture,
    teachingSceneStory,
  ]);
}
