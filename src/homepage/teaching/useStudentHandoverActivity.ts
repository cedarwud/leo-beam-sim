import { useCallback, useRef, useState } from 'react';

import type {
  StudentHandoverCheckpointId,
  StudentHandoverEvidenceClaimId,
  StudentHandoverExplanationChoice,
  StudentHandoverPredictionChoice,
} from './studentHandoverActivityContract';
import {
  createInactiveStudentHandoverActivityState,
  reduceStudentHandoverActivity,
  type StudentHandoverActivityAction,
  type StudentHandoverActivityState,
  type StudentHandoverObservationRecord,
} from './studentHandoverActivityState';

export interface StudentHandoverActivityController {
  readonly state: StudentHandoverActivityState;
  readonly activate: () => void;
  readonly forceDeactivate: () => void;
  readonly exitCleanPredict: () => void;
  readonly selectPrediction: (prediction: StudentHandoverPredictionChoice) => void;
  readonly lockPrediction: () => void;
  readonly beginObserve: () => void;
  readonly requestCheckpoint: (checkpointId: StudentHandoverCheckpointId) => void;
  readonly recordObservation: (observation: StudentHandoverObservationRecord) => void;
  readonly finishObserve: () => void;
  readonly selectExplanation: (explanation: StudentHandoverExplanationChoice) => void;
  readonly toggleEvidenceClaim: (claim: StudentHandoverEvidenceClaimId) => void;
  readonly submitExplanation: () => void;
  readonly reset: () => void;
}

export function useStudentHandoverActivity(): StudentHandoverActivityController {
  const [state, setState] = useState(createInactiveStudentHandoverActivityState);
  const runSequenceRef = useRef(0);

  const dispatch = useCallback((action: StudentHandoverActivityAction): void => {
    setState(current => reduceStudentHandoverActivity(current, action).state);
  }, []);

  const activate = useCallback(() => dispatch({ type: 'activate' }), [dispatch]);
  const forceDeactivate = useCallback(() => {
    setState(createInactiveStudentHandoverActivityState());
  }, []);
  const exitCleanPredict = useCallback(() => dispatch({ type: 'deactivate' }), [dispatch]);
  const selectPrediction = useCallback((prediction: StudentHandoverPredictionChoice) => {
    dispatch({ type: 'select-prediction', prediction });
  }, [dispatch]);
  const lockPrediction = useCallback(() => {
    runSequenceRef.current += 1;
    dispatch({
      type: 'lock-prediction',
      runId: `student-intra-${runSequenceRef.current}`,
    });
  }, [dispatch]);
  const beginObserve = useCallback(() => dispatch({ type: 'begin-observe' }), [dispatch]);
  const requestCheckpoint = useCallback((checkpointId: StudentHandoverCheckpointId) => {
    dispatch({ type: 'request-checkpoint', checkpointId });
  }, [dispatch]);
  const recordObservation = useCallback((observation: StudentHandoverObservationRecord) => {
    dispatch({ type: 'record-observation', observation });
  }, [dispatch]);
  const finishObserve = useCallback(() => dispatch({ type: 'finish-observe' }), [dispatch]);
  const selectExplanation = useCallback((explanation: StudentHandoverExplanationChoice) => {
    dispatch({ type: 'select-explanation', explanation });
  }, [dispatch]);
  const toggleEvidenceClaim = useCallback((claim: StudentHandoverEvidenceClaimId) => {
    dispatch({ type: 'toggle-evidence-claim', claim });
  }, [dispatch]);
  const submitExplanation = useCallback(() => dispatch({ type: 'submit-explanation' }), [dispatch]);
  const reset = useCallback(() => dispatch({ type: 'reset' }), [dispatch]);

  return {
    state,
    activate,
    forceDeactivate,
    exitCleanPredict,
    selectPrediction,
    lockPrediction,
    beginObserve,
    requestCheckpoint,
    recordObservation,
    finishObserve,
    selectExplanation,
    toggleEvidenceClaim,
    submitExplanation,
    reset,
  };
}
