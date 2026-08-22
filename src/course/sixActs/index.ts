/**
 * Six-acts classroom slice — the headless model layer.
 *
 * Everything here runs without a viewport: the pinned teaching window, the run
 * telemetry the platform fields need, the upload session, the Act 4 director
 * plan, and the Act 5 sweep. The React surfaces consume these; none of them
 * recompute a classroom number of their own.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md.
 */

export * from './teachingWindowSchema';
export * from './teachingWindow';
export * from './taughtConstants';
export * from './runSummary';
export * from './platformPayload';
export * from './platformUpload';
export * from './directorScript';
export * from './armStrategy';
export * from './powerSweep';
export * from './liveReplayBridge';
export * from './subtitleStateMachine';
export * from './teachingMode';
export * from './windowVisibility';
export * from './act1Shells';
