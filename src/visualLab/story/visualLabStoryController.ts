import {
  createIntraHandoverReplayDescriptor,
  type VisualLabInspectTarget,
  type VisualLabPresentationState,
  type VisualLabReplayStoryDescriptor,
  type VisualLabSemanticCommand,
} from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';
import {
  createVisualLabStoryRuntime,
  type VisualLabCompiledStory,
  type VisualLabStoryRuntime,
  type VisualLabStoryRuntimeState,
  type VisualLabStoryStep,
  type VisualLabStoryRuntimeStatus,
} from '../../prototype/visual-lab-g0/story/visualLabStoryRuntime';
import type { VisualLabCanonicalHandoverMarker } from '../../prototype/visual-lab-g0/visualLabCanonicalTimelineAdapter';
import type { LabSnapshot } from '../session';

/**
 * Stable id used for the capability entry that is currently unavailable.
 * The entry is a status statement, not a fabricated trace or story event.
 */
export const VISUAL_LAB_INTRA_HANDOVER_STORY_ID = 'intra-handover';

export const VISUAL_LAB_INTRA_HANDOVER_UNAVAILABLE_REASON =
  'No accepted canonical same-satellite beam-identity trace is available in the current session.';

export const VISUAL_LAB_INTER_HANDOVER_UNAVAILABLE_REASON =
  'The accepted canonical timeline has no complete inter-handover marker with before, decision, and after anchors.';

export type VisualLabStoryControllerCommand =
  | { readonly type: 'select'; readonly storyId: string }
  | { readonly type: 'selectStory'; readonly storyId: string }
  | { readonly type: 'play' }
  | VisualLabSemanticCommand;

export interface VisualLabStoryAvailability {
  readonly interHandover: {
    readonly status: 'available' | 'unavailable';
    readonly reason: string | null;
    readonly storyIds: readonly string[];
    readonly selectedStoryId: string | null;
    readonly markerEventId: string | null;
  };
  readonly intraHandover: {
    readonly status: 'available' | 'unavailable';
    readonly reason: string | null;
    readonly storyId: typeof VISUAL_LAB_INTRA_HANDOVER_STORY_ID;
  };
}

export interface VisualLabStoryDescriptorDerivation {
  /** Only complete, real, accepted canonical markers produce descriptors. */
  readonly descriptors: readonly VisualLabReplayStoryDescriptor[];
  readonly selectedMarker: VisualLabCanonicalHandoverMarker | null;
  readonly availability: VisualLabStoryAvailability;
}

/**
 * Controller read model.  `activeStepTimeSec` is deliberately a projection
 * only: the route may pass it to `VisualLabSession.dispatch({ type: 'seek' })`.
 * The controller never seeks the session itself and never owns a second clock.
 */
export interface VisualLabStoryControllerState {
  readonly status: VisualLabStoryRuntimeStatus;
  readonly activeStoryId: string | null;
  readonly activeStoryKind: VisualLabStoryRuntimeState['activeStoryKind'];
  readonly activeStepIndex: number | null;
  readonly activeStep: VisualLabStoryStep | null;
  readonly activeStepTimeSec: number | null;
  /** Alias for adapters that name the route command target explicitly. */
  readonly activeStepSeekTimeSec: number | null;
  readonly inspectedTarget: VisualLabInspectTarget | null;
  readonly presentation: VisualLabPresentationState;
  readonly stories: readonly VisualLabCompiledStory[];
  readonly availability: VisualLabStoryAvailability;
  readonly forkedFromStoryId: string | null;
}

export interface VisualLabStoryController {
  readonly state: () => VisualLabStoryControllerState;
  readonly dispatch: (command: VisualLabStoryControllerCommand) => VisualLabStoryControllerState;
  readonly tick: () => VisualLabStoryControllerState;
  readonly selectStory: (storyId: string) => VisualLabStoryControllerState;
  readonly select: (storyId: string) => VisualLabStoryControllerState;
  readonly subscribe: (listener: (state: VisualLabStoryControllerState) => void) => () => void;
  /** Rebind accepted evidence after the session publishes a new snapshot. */
  readonly updateSnapshot: (snapshot: LabSnapshot) => VisualLabStoryControllerState;
  readonly play: () => VisualLabStoryControllerState;
  readonly pause: () => VisualLabStoryControllerState;
  readonly next: () => VisualLabStoryControllerState;
  readonly previous: () => VisualLabStoryControllerState;
  readonly restart: () => VisualLabStoryControllerState;
  readonly inspect: (target: VisualLabInspectTarget) => VisualLabStoryControllerState;
  readonly forkToExplore: () => VisualLabStoryControllerState;
}

interface PreparedStoryInput {
  readonly runtime: VisualLabStoryRuntime;
  readonly derivation: VisualLabStoryDescriptorDerivation;
  readonly presentation: VisualLabPresentationState;
}

interface AcceptedTimelineEvidence {
  readonly canonical: NonNullable<LabSnapshot['canonical']>;
  readonly timeline: NonNullable<LabSnapshot['timeline']>;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return freeze([...values]);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function unavailableIntraDescriptor(): VisualLabReplayStoryDescriptor {
  // Use the existing runtime's explicit missing-trace path.  This keeps the
  // reason and unavailable source classification aligned with the accepted
  // presentation contract without supplying a fake trace identity.
  return createIntraHandoverReplayDescriptor({
    storyId: VISUAL_LAB_INTRA_HANDOVER_STORY_ID,
    source: { kind: 'missing' },
  });
}

function intraDescriptorForSnapshot(snapshot: LabSnapshot): VisualLabReplayStoryDescriptor {
  const accepted = snapshot.accepted;
  const timeline = snapshot.timeline;
  const trace = accepted?.intraHandoverEvidence ?? null;
  if (
    accepted === null
    || accepted.runReady !== true
    || timeline === null
    || timeline.isMock
    || timeline.availability !== 'available'
    || trace === null
    || trace.analysisRunId !== accepted.analysisRunId
    || trace.analysisRunId !== timeline.analysisRunId
    || trace.geometryRunId !== accepted.geometryRunId
    || trace.geometryRunId !== timeline.geometryRunId
  ) return unavailableIntraDescriptor();
  return createIntraHandoverReplayDescriptor({
    storyId: VISUAL_LAB_INTRA_HANDOVER_STORY_ID,
    source: { kind: 'accepted-canonical-beam-identity', trace },
  });
}

function intraAvailability(
  descriptor: VisualLabReplayStoryDescriptor,
): VisualLabStoryAvailability['intraHandover'] {
  return freeze({
    status: descriptor.availability.status,
    reason: descriptor.availability.reason,
    storyId: VISUAL_LAB_INTRA_HANDOVER_STORY_ID,
  });
}

function unavailableInterReason(
  snapshot: LabSnapshot,
  timeline: LabSnapshot['timeline'],
): string {
  if (timeline === null || timeline.availability !== 'available' || timeline.isMock) {
    return 'An accepted canonical timeline is unavailable for inter-handover replay.';
  }
  if (snapshot.accepted?.runReady !== true) {
    return 'The accepted canonical run is not complete, so handover replay is unavailable.';
  }
  return VISUAL_LAB_INTER_HANDOVER_UNAVAILABLE_REASON;
}

function emptyAvailability(
  snapshot: LabSnapshot,
  intra: VisualLabReplayStoryDescriptor,
): VisualLabStoryAvailability {
  return freeze({
    interHandover: freeze({
      status: 'unavailable' as const,
      reason: unavailableInterReason(snapshot, snapshot.timeline),
      storyIds: freezeArray([]),
      selectedStoryId: null,
      markerEventId: null,
    }),
    intraHandover: intraAvailability(intra),
  });
}

/**
 * Keep the accepted session boundary strict.  A timeline and canonical frame
 * are usable only when they are the same accepted read model and the complete
 * run has been published.  Mock objects are refused before the real-evidence
 * runtime sees them.
 */
function acceptedTimelineEvidence(snapshot: LabSnapshot): AcceptedTimelineEvidence | null {
  const accepted = snapshot.accepted;
  const canonical = snapshot.canonical;
  const timeline = snapshot.timeline;
  if (
    accepted === null
    || accepted.runReady !== true
    || canonical === null
    || timeline === null
    || accepted.canonical !== canonical
    || accepted.timeline !== timeline
    || canonical.isMock
    || timeline.isMock
    || timeline.availability !== 'available'
    || !nonEmpty(timeline.analysisRunId)
    || !nonEmpty(timeline.geometryRunId)
  ) return null;

  // The session identity is the other half of the same-run gate.  Null run
  // ids are not enough evidence to select an event story.
  if (
    !nonEmpty(accepted.analysisRunId)
    || !nonEmpty(accepted.geometryRunId)
    || accepted.analysisRunId !== timeline.analysisRunId
    || accepted.geometryRunId !== timeline.geometryRunId
  ) return null;

  return { canonical, timeline };
}

function sortedPoints(
  timeline: NonNullable<LabSnapshot['timeline']>,
): readonly NonNullable<LabSnapshot['timeline']>['points'][number][] {
  return [...timeline.points].sort((left, right) => (
    left.anchorIndex - right.anchorIndex
  ));
}

interface CompleteMarkerAnchors {
  readonly markerPoint: NonNullable<LabSnapshot['timeline']>['points'][number];
  readonly beforePoint: NonNullable<LabSnapshot['timeline']>['points'][number];
  readonly afterPoint: NonNullable<LabSnapshot['timeline']>['points'][number];
}

function completeMarkerAnchors(
  marker: VisualLabCanonicalHandoverMarker,
  points: readonly NonNullable<LabSnapshot['timeline']>['points'][number][],
): CompleteMarkerAnchors | null {
  if (
    !nonEmpty(marker.eventId)
    || !nonEmpty(marker.fromSatelliteId)
    || !nonEmpty(marker.toSatelliteId)
    || marker.fromSatelliteId === marker.toSatelliteId
    || !Number.isInteger(marker.anchorIndex)
    || marker.anchorIndex < 1
    || !finite(marker.timeSec)
    || !nonEmpty(marker.instantUtc)
  ) return null;

  const markerPoint = points.find(point => point.anchorIndex === marker.anchorIndex);
  if (markerPoint === undefined) return null;
  let beforePoint: typeof markerPoint | null = null;
  let afterPoint: typeof markerPoint | null = null;
  for (const point of points) {
    if (point.anchorIndex < marker.anchorIndex) beforePoint = point;
    if (point.anchorIndex > marker.anchorIndex) {
      afterPoint = point;
      break;
    }
  }
  if (beforePoint === null || afterPoint === null) return null;
  if (
    beforePoint.servingSatelliteId !== marker.fromSatelliteId
    || afterPoint.servingSatelliteId !== marker.toSatelliteId
    || markerPoint.servingSatelliteId !== marker.toSatelliteId
    || !finite(beforePoint.timeSec)
    || !finite(markerPoint.timeSec)
    || !finite(afterPoint.timeSec)
  ) return null;
  return { markerPoint, beforePoint, afterPoint };
}

function descriptorForMarker(
  marker: VisualLabCanonicalHandoverMarker,
): VisualLabReplayStoryDescriptor {
  // The canonical timeline marker already is the accepted real evidence.  Do
  // not widen it into a full producer event (which would require inventing
  // decision fields that LabSnapshot intentionally does not expose).
  return freeze({
    storyId: marker.eventId,
    kind: 'inter-handover' as const,
    source: freeze({
      kind: 'inter-handover' as const,
      eventId: marker.eventId,
      fromSatelliteId: marker.fromSatelliteId,
      toSatelliteId: marker.toSatelliteId,
    }),
    availability: freeze({
      status: 'available' as const,
      reason: null,
      sourceKind: 'accepted-canonical-real' as const,
    }),
  });
}

/**
 * Derive story descriptors from one immutable LabSnapshot.
 *
 * Inter stories are intentionally not inferred from the current frame's
 * handover projection, candidate identity, or any historical engine event;
 * only accepted canonical timeline markers may create them.  If no complete
 * marker exists the descriptor list contains no inter story, while the
 * availability read model carries the explicit unavailable reason.
 */
export function deriveVisualLabStoryDescriptors(
  snapshot: LabSnapshot,
): VisualLabStoryDescriptorDerivation {
  const intra = intraDescriptorForSnapshot(snapshot);
  const evidence = acceptedTimelineEvidence(snapshot);
  if (evidence === null) {
    const empty = emptyAvailability(snapshot, intra);
    return freeze({
      descriptors: freezeArray([intra]),
      selectedMarker: null,
      availability: empty,
    });
  }

  const points = sortedPoints(evidence.timeline);
  const markers = [...evidence.timeline.markers]
    // Both canonical event variants are real cross-satellite serving changes.
    // `forced-continuity` means the old serving link could not be retained;
    // it is still an inter-satellite replay, with its reason carried into the
    // decision beat instead of being hidden or relabelled as a TTT trigger.
    .sort((left, right) => (
      left.anchorIndex - right.anchorIndex
      || compareText(left.eventId, right.eventId)
    ));
  const seenIds = new Set<string>();
  const completeMarkers: VisualLabCanonicalHandoverMarker[] = [];
  for (const marker of markers) {
    if (seenIds.has(marker.eventId)) continue;
    if (completeMarkerAnchors(marker, points) === null) continue;
    seenIds.add(marker.eventId);
    completeMarkers.push(marker);
  }

  const interDescriptors = completeMarkers.map(descriptorForMarker);
  const selectedMarker = completeMarkers[0] ?? null;
  const interAvailability = selectedMarker === null
    ? freeze({
      status: 'unavailable' as const,
      reason: unavailableInterReason(snapshot, evidence.timeline),
      storyIds: freezeArray([]),
      selectedStoryId: null,
      markerEventId: null,
    })
    : freeze({
      status: 'available' as const,
      reason: null,
      storyIds: freezeArray(interDescriptors.map(descriptor => descriptor.storyId)),
      selectedStoryId: selectedMarker.eventId,
      markerEventId: selectedMarker.eventId,
    });
  const availability = freeze({
    interHandover: interAvailability,
    intraHandover: intraAvailability(intra),
  });
  return freeze({
    descriptors: freezeArray([...interDescriptors, intra]),
    selectedMarker,
    availability,
  });
}

/** Select the first deterministic complete inter-handover marker. */
export function selectVisualLabInterHandoverMarker(
  snapshot: LabSnapshot,
): VisualLabCanonicalHandoverMarker | null {
  return deriveVisualLabStoryDescriptors(snapshot).selectedMarker;
}

function presentationFromSnapshot(snapshot: LabSnapshot): VisualLabPresentationState {
  return freeze({
    theme: snapshot.presentation.theme,
    locale: snapshot.presentation.locale,
    experience: snapshot.presentation.experience,
  });
}

function prepareStoryInput(snapshot: LabSnapshot): PreparedStoryInput {
  const derivation = deriveVisualLabStoryDescriptors(snapshot);
  const evidence = acceptedTimelineEvidence(snapshot);
  const runtime = createVisualLabStoryRuntime({
    snapshot: evidence?.canonical ?? null,
    timeline: evidence?.timeline ?? null,
    stories: derivation.descriptors,
    presentation: presentationFromSnapshot(snapshot),
  });
  return { runtime, derivation, presentation: presentationFromSnapshot(snapshot) };
}

function activeStepTimeSec(state: VisualLabStoryRuntimeState): number | null {
  const timeSec = state.activeStep?.point?.timeSec ?? null;
  return finite(timeSec) ? timeSec : null;
}

function viewState(
  runtimeState: VisualLabStoryRuntimeState,
  availability: VisualLabStoryAvailability,
): VisualLabStoryControllerState {
  const timeSec = activeStepTimeSec(runtimeState);
  return freeze({
    status: runtimeState.status,
    activeStoryId: runtimeState.activeStoryId,
    activeStoryKind: runtimeState.activeStoryKind,
    activeStepIndex: runtimeState.activeStepIndex,
    activeStep: runtimeState.activeStep,
    activeStepTimeSec: timeSec,
    activeStepSeekTimeSec: timeSec,
    inspectedTarget: runtimeState.inspectedTarget,
    presentation: runtimeState.presentation,
    stories: runtimeState.stories,
    availability,
    forkedFromStoryId: runtimeState.forkedFromStoryId,
  });
}

function sameVisibleState(
  left: VisualLabStoryControllerState,
  right: VisualLabStoryControllerState,
): boolean {
  return left.status === right.status
    && left.activeStoryId === right.activeStoryId
    && left.activeStepIndex === right.activeStepIndex
    && left.activeStepTimeSec === right.activeStepTimeSec
    && left.inspectedTarget === right.inspectedTarget
    && left.forkedFromStoryId === right.forkedFromStoryId
    && left.stories === right.stories
    && left.availability === right.availability;
}

function replayCursor(
  runtime: VisualLabStoryRuntime,
  previous: VisualLabStoryRuntimeState,
): VisualLabStoryRuntimeState {
  const fresh = runtime.state();
  if (previous.activeStoryId === null) {
    return previous.forkedFromStoryId === null
      ? fresh
      : runtime.dispatch({ type: 'fork-to-explore' });
  }
  const previousStory = fresh.stories.find(story => story.storyId === previous.activeStoryId) ?? null;
  const freshActiveStory = fresh.activeStoryId === null
    ? null
    : fresh.stories.find(story => story.storyId === fresh.activeStoryId) ?? null;
  // During the initial first-frame publication only the explicit unavailable
  // intra capability may exist. Once a complete accepted run introduces a
  // real inter-satellite replay, do not keep the controller pinned to that
  // unavailable placeholder; adopt the runtime's first available story.
  if (
    previousStory?.availability.status !== 'available'
    && freshActiveStory?.availability.status === 'available'
  ) return fresh;
  let next = runtime.selectStory(previous.activeStoryId);
  const targetIndex = previous.activeStepIndex ?? 0;
  for (let index = 0; index < targetIndex; index += 1) next = runtime.dispatch({ type: 'next' });
  if (previous.inspectedTarget !== null) {
    next = runtime.dispatch({ type: 'inspect', target: previous.inspectedTarget });
  }
  if (previous.status === 'playing' && next.status !== 'completed') {
    next = runtime.dispatch({ type: 'play' });
  }
  return next;
}

/**
 * Framework-agnostic semantic controller over the real-evidence story
 * runtime.  It has no timer; callers decide when to call `tick()`.
 */
export function createVisualLabStoryController(
  initialSnapshot: LabSnapshot,
): VisualLabStoryController {
  let snapshot = initialSnapshot;
  let prepared = prepareStoryInput(snapshot);
  let runtime = prepared.runtime;
  let current = viewState(runtime.state(), prepared.derivation.availability);
  const listeners = new Set<(state: VisualLabStoryControllerState) => void>();

  const publish = (
    runtimeState: VisualLabStoryRuntimeState,
    availability = prepared.derivation.availability,
  ): VisualLabStoryControllerState => {
    const next = viewState(runtimeState, availability);
    if (!sameVisibleState(current, next)) {
      current = next;
      for (const listener of listeners) listener(current);
    }
    return current;
  };

  const dispatch = (command: VisualLabStoryControllerCommand): VisualLabStoryControllerState => {
    if (command.type === 'select' || command.type === 'selectStory') {
      return publish(runtime.selectStory(command.storyId));
    }
    return publish(runtime.dispatch(command));
  };

  const selectStory = (storyId: string): VisualLabStoryControllerState => (
    publish(runtime.selectStory(storyId))
  );

  const updateSnapshot = (nextSnapshot: LabSnapshot): VisualLabStoryControllerState => {
    if (nextSnapshot === snapshot) return current;
    const previousRuntimeState = runtime.state();
    snapshot = nextSnapshot;
    prepared = prepareStoryInput(nextSnapshot);
    runtime = prepared.runtime;
    const rebound = replayCursor(runtime, previousRuntimeState);
    return publish(rebound, prepared.derivation.availability);
  };

  return {
    state: () => current,
    dispatch,
    tick: () => publish(runtime.tick()),
    selectStory,
    select: selectStory,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updateSnapshot,
    play: () => dispatch({ type: 'play' }),
    pause: () => dispatch({ type: 'pause' }),
    next: () => dispatch({ type: 'next' }),
    previous: () => dispatch({ type: 'previous' }),
    restart: () => dispatch({ type: 'restart' }),
    inspect: target => dispatch({ type: 'inspect', target }),
    forkToExplore: () => dispatch({ type: 'fork-to-explore' }),
  };
}
