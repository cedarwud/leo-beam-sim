import {
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react';

import type { AppHandoverTeachingControllers } from './useAppHandoverTeachingStage';
import type { SceneLane } from './sceneLane';
import type {
  HomepageRailProjection,
} from '../homepage/controller/contracts';
import type {
  TeachingFrame,
  TeachingHandoverKind,
} from '../homepage/teaching/handoverTeachingScript';
import {
  instructorHandoverTelemetryAttributes,
} from '../homepage/teaching/instructorHandoverTelemetry';
import type {
  InstructorHandoverTransportSnapshot,
} from '../homepage/teaching/instructorHandoverTransport';
import {
  currentStudentHandoverCheckpointId,
  type StudentHandoverActivityState,
} from '../homepage/teaching/studentHandoverActivityState';
import {
  studentHandoverCheckpoint,
} from '../homepage/teaching/studentHandoverActivityContract';
import {
  resolveStudentHandoverActivityEvidence,
  type StudentHandoverActivityEvidence,
} from '../homepage/teaching/studentHandoverActivityEvidence';
import {
  studentHandoverActivityTelemetryAttributes,
} from '../homepage/teaching/studentHandoverActivityTelemetry';
import type {
  AcceptedHandoverPresentationSnapshot,
} from '../scene/acceptedHandoverPresentationSnapshot';
import {
  resolveHandoverAcceptedSurfaceProjection,
  type HandoverAcceptedSurfaceProjection,
} from '../scene/handoverAcceptedSurfaceProjection';
import type {
  HandoverTeachingSceneStory,
} from '../scene/handoverStoryFrame';
import {
  resolveHandoverSurfaceBindings,
  type HandoverSurfaceBindingSet,
} from '../scene/handoverSurfaceBinding';
import {
  resolveHandoverTeachingSurfaceProjection,
  type HandoverTeachingSurfaceProjection,
} from '../scene/handoverTeachingSurfaceProjection';
import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';
import {
  resolveSceneHandoverStoryFrameSet,
} from '../scene/sceneHandoverStoryFrameSet';
import { cellIdFromLinkBudgetBeamId } from '../scene/sinrLiveCellModel';

export interface AppHandoverSurfaceRuntimeOptions {
  readonly controllers: AppHandoverTeachingControllers;
  readonly isRootHomepage: boolean;
  readonly isWalkerSceneActive: boolean;
  readonly sceneLane: SceneLane;
  readonly acceptedSnapshot: AcceptedHandoverPresentationSnapshot | null;
  readonly teachingSceneStory: HandoverTeachingSceneStory | null;
  readonly teachingFrame: TeachingFrame | null;
  readonly teachingStageKind: TeachingHandoverKind | null;
  readonly activeSceneFrame: NormalizedSceneFrame | null | undefined;
  readonly homepageRailProjection: HomepageRailProjection | null;
}

export interface AppHandoverSurfaceRuntime {
  readonly acceptedSurfaceProjection: HandoverAcceptedSurfaceProjection;
  readonly teachingSurfaceProjection: HandoverTeachingSurfaceProjection | null;
  readonly teachingSurfaceProjectionRef: MutableRefObject<HandoverTeachingSurfaceProjection | null>;
  readonly handoverSurfaceBindingsRef: MutableRefObject<HandoverSurfaceBindingSet>;
  readonly instructorHandoverSnapshotRef: MutableRefObject<InstructorHandoverTransportSnapshot | null>;
  readonly studentHandoverActivityStateRef: MutableRefObject<StudentHandoverActivityState | null>;
  readonly instructorRootAttributes: ReturnType<typeof instructorHandoverTelemetryAttributes>;
  readonly studentRootAttributes: ReturnType<typeof studentHandoverActivityTelemetryAttributes>;
  readonly studentHandoverEvidence: StudentHandoverActivityEvidence | null;
}
/**
 * Compose the R4-R6 surface runtime once at the App shell. This hook projects
 * already-owned state; it never reads raw simulation fields or advances time.
 */
export function useAppHandoverSurfaceRuntime({
  controllers,
  isRootHomepage,
  isWalkerSceneActive,
  sceneLane,
  acceptedSnapshot,
  teachingSceneStory,
  teachingFrame,
  teachingStageKind,
  activeSceneFrame,
  homepageRailProjection,
}: AppHandoverSurfaceRuntimeOptions): AppHandoverSurfaceRuntime {
  const { transport, snapshot, student, studentState, studentModeActive } = controllers;
  const appStoryFrames = useMemo(() => resolveSceneHandoverStoryFrameSet({
    acceptedSnapshot: sceneLane === 'sinr-live' && isWalkerSceneActive
      ? acceptedSnapshot
      : null,
    acceptedProducer: 'walker',
    resolveAcceptedCellId: cellIdFromLinkBudgetBeamId,
    teachingStory: isRootHomepage ? teachingSceneStory : null,
    teachingFrame: isRootHomepage ? teachingFrame : null,
    replayFrame: activeSceneFrame ?? null,
  }), [
    acceptedSnapshot,
    activeSceneFrame,
    isRootHomepage,
    isWalkerSceneActive,
    sceneLane,
    teachingFrame,
    teachingSceneStory,
  ]);
  const bindings = useMemo(
    () => resolveHandoverSurfaceBindings(appStoryFrames),
    [appStoryFrames],
  );
  const acceptedSurfaceProjection = useMemo(
    () => resolveHandoverAcceptedSurfaceProjection(
      bindings.accepted,
      homepageRailProjection,
      'walker',
    ),
    [bindings.accepted, homepageRailProjection],
  );
  const teachingSurfaceProjection = useMemo(
    () => resolveHandoverTeachingSurfaceProjection(
      bindings.teaching,
      teachingFrame,
      teachingStageKind,
    ),
    [bindings.teaching, teachingFrame, teachingStageKind],
  );

  const teachingSurfaceProjectionRef = useRef<HandoverTeachingSurfaceProjection | null>(
    teachingSurfaceProjection,
  );
  teachingSurfaceProjectionRef.current = teachingSurfaceProjection;
  const handoverSurfaceBindingsRef = useRef<HandoverSurfaceBindingSet>(bindings);
  handoverSurfaceBindingsRef.current = bindings;
  const instructorHandoverSnapshotRef = useRef<InstructorHandoverTransportSnapshot | null>(
    snapshot,
  );
  instructorHandoverSnapshotRef.current = snapshot;
  const studentHandoverActivityStateRef = useRef<StudentHandoverActivityState | null>(
    studentState,
  );
  studentHandoverActivityStateRef.current = studentState;

  const instructorRootAttributes = instructorHandoverTelemetryAttributes(
    'root',
    snapshot,
    teachingSurfaceProjection?.binding ?? null,
  );
  const studentRootAttributes = studentHandoverActivityTelemetryAttributes(
    'root',
    studentState,
    snapshot,
    teachingSurfaceProjection?.binding ?? null,
  );
  const currentCheckpointId = currentStudentHandoverCheckpointId(studentState);
  const studentHandoverEvidence = useMemo(
    () => currentCheckpointId === null
      ? null
      : resolveStudentHandoverActivityEvidence(
        currentCheckpointId,
        snapshot,
        teachingSurfaceProjection,
      ),
    [currentCheckpointId, snapshot, teachingSurfaceProjection],
  );

  useEffect(() => {
    const pendingCheckpointId = studentState.pendingCheckpointId;
    if (!studentModeActive
      || studentState.step !== 'observe'
      || pendingCheckpointId === null
      || snapshot === null) {
      return;
    }
    const checkpoint = studentHandoverCheckpoint(pendingCheckpointId);
    if (!snapshot.paused) {
      transport.setPaused(true);
      return;
    }
    if (Math.abs(snapshot.sourceTimeSec - checkpoint.sourceTimeSec) > 0.001) {
      transport.seek(checkpoint.sourceTimeSec);
      return;
    }
    const evidence = resolveStudentHandoverActivityEvidence(
      pendingCheckpointId,
      snapshot,
      teachingSurfaceProjection,
    );
    if (evidence === null) return;
    student.recordObservation({
      checkpointId: pendingCheckpointId,
      evidenceClaims: evidence.evidenceClaims,
    });
  }, [
    snapshot,
    student.recordObservation,
    studentModeActive,
    studentState.pendingCheckpointId,
    studentState.step,
    teachingSurfaceProjection,
    transport.seek,
    transport.setPaused,
  ]);

  return useMemo(() => ({
    acceptedSurfaceProjection,
    teachingSurfaceProjection,
    teachingSurfaceProjectionRef,
    handoverSurfaceBindingsRef,
    instructorHandoverSnapshotRef,
    studentHandoverActivityStateRef,
    instructorRootAttributes,
    studentRootAttributes,
    studentHandoverEvidence,
  }), [
    acceptedSurfaceProjection,
    handoverSurfaceBindingsRef,
    instructorHandoverSnapshotRef,
    instructorRootAttributes,
    studentHandoverActivityStateRef,
    studentHandoverEvidence,
    studentRootAttributes,
    teachingSurfaceProjection,
    teachingSurfaceProjectionRef,
  ]);
}
