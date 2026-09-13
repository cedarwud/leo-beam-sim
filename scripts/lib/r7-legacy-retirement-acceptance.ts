/** Independent R7 legacy-retirement acceptance oracle. */

export interface R7LegacyRetirementSources {
  readonly app: string;
  readonly main: string;
  readonly mainScene: string;
  readonly telemetry: string;
  readonly frameSet: string;
  readonly teachingStage: string;
  readonly surfaceRuntime: string;
}

function requireText(
  source: string,
  token: string,
  label: string,
  errors: string[],
): void {
  if (!source.includes(token)) errors.push(`${label}: missing ${token}`);
}

function forbidText(
  source: string,
  token: string,
  label: string,
  errors: string[],
): void {
  if (source.includes(token)) errors.push(`${label}: retained ${token}`);
}

function validateNoClockOrDecisionOwner(
  source: string,
  label: string,
  errors: string[],
): void {
  for (const token of [
    'useState(',
    'setInterval(',
    'setTimeout(',
    'requestAnimationFrame(',
    'performance.now(',
    'Date.now(',
    'SimState',
    'setSimState',
    'HandoverDecision',
    'candidateRanking',
  ]) {
    forbidText(source, token, label, errors);
  }
}

export function validateR7LegacyRetirement(
  sources: R7LegacyRetirementSources,
): readonly string[] {
  const errors: string[] = [];

  requireText(sources.main, 'resolveLegacyRouteRetirement', 'main', errors);
  forbidText(sources.main, 'IntraHandoverTeachingPrototype', 'main', errors);
  forbidText(sources.main, 'isIntraHandoverTeachingRoute', 'main', errors);

  for (const token of [
    'useAppHandoverTeachingControllers()',
    'useAppHandoverTeachingStage({',
    'useAppHandoverSurfaceRuntime({',
  ]) {
    requireText(sources.app, token, 'App', errors);
  }
  for (const token of [
    'teachingFixtureLatchRef',
    'instructorPlaybackRestoreRef',
    'resolveInstructorHandoverScenarioFrame(',
    'resolveSceneHandoverStoryFrameSet(',
    'resolveHandoverSurfaceBindings(',
    'resolveStudentHandoverActivityEvidence(',
    'studentHandoverCheckpoint(',
  ]) {
    forbidText(sources.app, token, 'App', errors);
  }

  requireText(
    sources.mainScene,
    'handoverSurfaceBindingsRef: MutableRefObject<HandoverSurfaceBindingSet>',
    'MainScene',
    errors,
  );
  for (const token of [
    'handoverSurfaceBindingsRef?:',
    'handoverSurfaceBindingsRef?.current',
    'resolveHandoverSurfaceBindings(',
    'resolveSceneHandoverStoryFrameSet(',
  ]) {
    forbidText(sources.mainScene, token, 'MainScene', errors);
  }

  requireText(
    sources.telemetry,
    'sharedBindingsRef: MutableRefObject<HandoverSurfaceBindingSet>',
    'canvas telemetry',
    errors,
  );
  for (const token of [
    'sharedBindingsRef?:',
    'sharedBindingsRef?.current',
    'sharedBindingsRef === undefined',
    'resolveHandoverSurfaceBindings(',
  ]) {
    forbidText(sources.telemetry, token, 'canvas telemetry', errors);
  }

  requireText(
    sources.frameSet,
    'readonly localPresentation: HandoverStoryFrame | null;',
    'frame-set boundary',
    errors,
  );
  requireText(
    sources.frameSet,
    'readonly sharedBindings: HandoverSurfaceBindingSet;',
    'frame-set boundary',
    errors,
  );
  requireText(
    sources.frameSet,
    'resolveBoundSceneHandoverSurfaceBindingSet',
    'frame-set boundary',
    errors,
  );
  forbidText(
    sources.frameSet,
    'readonly sharedBindings: HandoverSurfaceBindingSet | null;',
    'frame-set boundary',
    errors,
  );
  forbidText(
    sources.frameSet,
    'readonly local: HandoverStoryFrameSet;',
    'frame-set boundary',
    errors,
  );

  validateNoClockOrDecisionOwner(sources.teachingStage, 'teaching stage', errors);
  validateNoClockOrDecisionOwner(sources.surfaceRuntime, 'surface runtime', errors);
  requireText(
    sources.teachingStage,
    'useInstructorHandoverTransport()',
    'teaching stage',
    errors,
  );
  requireText(
    sources.surfaceRuntime,
    'resolveStudentHandoverActivityEvidence(',
    'surface runtime',
    errors,
  );

  return errors;
}
