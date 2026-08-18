import type {
  VisualLabCanonicalSnapshot,
} from '../visualLabCanonicalSnapshotAdapter';
import type {
  VisualLabCanonicalHandoverMarker,
  VisualLabCanonicalTimeline,
  VisualLabCanonicalTimelinePoint,
} from '../visualLabCanonicalTimelineAdapter';
import type {
  ScientificLinkIdentity,
} from '../../../explain/model/types';
import type {
  VisualLabInspectTarget,
  VisualLabPresentationState,
  VisualLabReplayStoryDescriptor,
  VisualLabReplayStoryKind,
  VisualLabSemanticCommand,
} from '../presentation/visualLabPresentationContract';

/**
 * A semantic play command is intentionally local until the presentation
 * contract grows a corresponding `play` member.  It carries no DOM or
 * renderer information and can therefore be issued by a button, a key, or a
 * capture driver without changing the story definition.
 */
export type VisualLabStoryCommand =
  | VisualLabSemanticCommand
  | { readonly type: 'play' };

export type VisualLabStoryRuntimeStatus =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'unavailable';

export type VisualLabStoryStepPhase =
  | 'before'
  | 'decision'
  | 'after'
  | 'from'
  | 'transition'
  | 'to';

export interface VisualLabStoryStep {
  readonly id: string;
  readonly phase: VisualLabStoryStepPhase;
  readonly index: number;
  readonly instantUtc: string | null;
  readonly anchorIndex: number | null;
  readonly point: VisualLabCanonicalTimelinePoint | null;
  readonly marker: VisualLabCanonicalHandoverMarker | null;
  /**
   * Intra-handover currently has an identity-only evidence contract.  Keep
   * that fact explicit instead of manufacturing a timestamp, frame ID, or
   * metric payload that the producer has not published.
   */
  readonly beamTrace: {
    readonly traceId: string;
    readonly from: ScientificLinkIdentity;
    readonly to: ScientificLinkIdentity;
  } | null;
}

export interface VisualLabCompiledStory {
  readonly storyId: string;
  readonly kind: VisualLabReplayStoryKind;
  readonly descriptor: VisualLabReplayStoryDescriptor;
  readonly availability: VisualLabReplayStoryDescriptor['availability'];
  readonly steps: readonly VisualLabStoryStep[];
}

export interface VisualLabStoryRuntimeInput {
  /** An accepted, real canonical read model.  Mock snapshots are rejected. */
  readonly snapshot: VisualLabCanonicalSnapshot | null;
  /** An accepted, real canonical 2-hour analysis projection. */
  readonly timeline: VisualLabCanonicalTimeline | null;
  readonly stories: readonly VisualLabReplayStoryDescriptor[];
  readonly presentation?: VisualLabPresentationState;
}

export interface VisualLabStoryRuntimeState {
  readonly status: VisualLabStoryRuntimeStatus;
  readonly activeStoryId: string | null;
  readonly activeStoryKind: VisualLabReplayStoryKind | null;
  readonly activeStepIndex: number | null;
  readonly activeStep: VisualLabStoryStep | null;
  readonly inspectedTarget: VisualLabInspectTarget | null;
  readonly presentation: VisualLabPresentationState;
  readonly stories: readonly VisualLabCompiledStory[];
  readonly snapshot: VisualLabCanonicalSnapshot | null;
  readonly forkedFromStoryId: string | null;
}

export interface VisualLabStoryRuntime {
  readonly state: () => VisualLabStoryRuntimeState;
  readonly dispatch: (command: VisualLabStoryCommand) => VisualLabStoryRuntimeState;
  /** Advance exactly one semantic beat when the runtime is playing. */
  readonly tick: () => VisualLabStoryRuntimeState;
  /** Select an already compiled story; no new evidence is created. */
  readonly selectStory: (storyId: string) => VisualLabStoryRuntimeState;
  readonly subscribe: (listener: (state: VisualLabStoryRuntimeState) => void) => () => void;
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

function unavailableDescriptor(
  descriptor: VisualLabReplayStoryDescriptor,
  reason: string,
): VisualLabCompiledStory {
  return freeze({
    storyId: descriptor.storyId,
    kind: descriptor.kind,
    descriptor,
    availability: {
      status: 'unavailable' as const,
      reason,
      reasonCode: descriptor.availability.status === 'unavailable'
        ? descriptor.availability.reasonCode
        : 'missing-real-trace' as const,
      sourceKind: descriptor.availability.status === 'unavailable'
        ? descriptor.availability.sourceKind
        : 'unsupported' as const,
    },
    steps: freezeArray([]),
  });
}

function timelinePointAtOrBefore(
  points: readonly VisualLabCanonicalTimelinePoint[],
  anchorIndex: number,
): VisualLabCanonicalTimelinePoint | null {
  let result: VisualLabCanonicalTimelinePoint | null = null;
  for (const point of points) {
    if (point.anchorIndex >= anchorIndex) break;
    result = point;
  }
  return result;
}

function timelinePointAfter(
  points: readonly VisualLabCanonicalTimelinePoint[],
  anchorIndex: number,
): VisualLabCanonicalTimelinePoint | null {
  for (const point of points) {
    if (point.anchorIndex > anchorIndex) return point;
  }
  return null;
}

function interStory(
  descriptor: VisualLabReplayStoryDescriptor,
  timeline: VisualLabCanonicalTimeline | null,
): VisualLabCompiledStory {
  if (descriptor.availability.status !== 'available') {
    return unavailableDescriptor(descriptor, descriptor.availability.reason);
  }
  const source = descriptor.source;
  if (source.kind !== 'inter-handover') {
    return unavailableDescriptor(descriptor, 'inter-handover descriptor has the wrong source kind');
  }
  if (timeline === null || timeline.isMock || timeline.availability !== 'available') {
    return unavailableDescriptor(descriptor, 'accepted canonical timeline is unavailable for inter-handover replay');
  }

  const marker = timeline.markers.find(candidate => (
    candidate.eventId === source.eventId
      && candidate.fromSatelliteId === source.fromSatelliteId
      && candidate.toSatelliteId === source.toSatelliteId
  ));
  if (marker === undefined) {
    return unavailableDescriptor(
      descriptor,
      'the accepted canonical timeline has no matching serving-satellite change event',
    );
  }

  const markerPoint = timeline.points.find(point => point.anchorIndex === marker.anchorIndex) ?? null;
  const before = timelinePointAtOrBefore(timeline.points, marker.anchorIndex);
  const after = timelinePointAfter(timeline.points, marker.anchorIndex);
  if (markerPoint === null || before === null || after === null) {
    return unavailableDescriptor(
      descriptor,
      'the accepted handover event does not have complete before, decision, and after anchors',
    );
  }
  if (
    before.servingSatelliteId !== marker.fromSatelliteId
      || after.servingSatelliteId !== marker.toSatelliteId
  ) {
    return unavailableDescriptor(
      descriptor,
      'serving-satellite identity does not agree across the canonical before and after anchors',
    );
  }

  const steps = [
    freeze({
      id: `${descriptor.storyId}:before`,
      phase: 'before' as const,
      index: 0,
      instantUtc: before.instantUtc,
      anchorIndex: before.anchorIndex,
      point: before,
      marker: null,
      beamTrace: null,
    }),
    freeze({
      id: `${descriptor.storyId}:decision`,
      phase: 'decision' as const,
      index: 1,
      instantUtc: markerPoint.instantUtc,
      anchorIndex: markerPoint.anchorIndex,
      point: markerPoint,
      marker,
      beamTrace: null,
    }),
    freeze({
      id: `${descriptor.storyId}:after`,
      phase: 'after' as const,
      index: 2,
      instantUtc: after.instantUtc,
      anchorIndex: after.anchorIndex,
      point: after,
      marker: null,
      beamTrace: null,
    }),
  ];
  return freeze({
    storyId: descriptor.storyId,
    kind: descriptor.kind,
    descriptor,
    availability: descriptor.availability,
    steps: freezeArray(steps),
  });
}

function intraStory(
  descriptor: VisualLabReplayStoryDescriptor,
  timeline: VisualLabCanonicalTimeline | null,
): VisualLabCompiledStory {
  if (descriptor.availability.status !== 'available') {
    return unavailableDescriptor(descriptor, descriptor.availability.reason);
  }
  if (descriptor.source.kind !== 'intra-handover') {
    return unavailableDescriptor(descriptor, 'intra-handover descriptor has the wrong source kind');
  }
  if (
    descriptor.source.traceId === null
    || descriptor.source.from === null
    || descriptor.source.to === null
    || descriptor.source.trace === null
    || descriptor.source.trace === undefined
  ) {
    return unavailableDescriptor(
      descriptor,
      'accepted canonical same-satellite beam identity trace is incomplete',
    );
  }
  const from = descriptor.source.from;
  const to = descriptor.source.to;
  const acceptedTrace = descriptor.source.trace;
  if (
    !nonEmpty(descriptor.source.traceId)
      || !nonEmpty(from.satelliteId)
      || !nonEmpty(to.satelliteId)
      || from.satelliteId !== to.satelliteId
      || from.beamId === to.beamId
      || from.userIndex !== to.userIndex
      || from.userId !== to.userId
      || timeline === null
      || timeline.isMock
      || timeline.availability !== 'available'
      || timeline.analysisRunId !== acceptedTrace.analysisRunId
      || timeline.geometryRunId !== acceptedTrace.geometryRunId
  ) {
    return unavailableDescriptor(
      descriptor,
      'accepted canonical trace does not prove a same-satellite, different-beam identity change',
    );
  }

  const before = timeline.points.find(point => point.anchorIndex === acceptedTrace.beforeAnchorIndex) ?? null;
  const decision = timeline.points.find(point => point.anchorIndex === acceptedTrace.decisionAnchorIndex) ?? null;
  const after = timeline.points.find(point => point.anchorIndex === acceptedTrace.afterAnchorIndex) ?? null;
  if (
    before === null
    || decision === null
    || after === null
    || before.instantUtc !== acceptedTrace.beforeInstantUtc
    || decision.instantUtc !== acceptedTrace.decisionInstantUtc
    || after.instantUtc !== acceptedTrace.afterInstantUtc
    || before.servingSatelliteId !== from.satelliteId
    || decision.servingSatelliteId !== to.satelliteId
    || after.servingSatelliteId !== to.satelliteId
  ) {
    return unavailableDescriptor(
      descriptor,
      'accepted canonical timeline does not contain the complete same-satellite before, decision, and after anchors',
    );
  }

  const trace = freeze({
    traceId: descriptor.source.traceId,
    from,
    to,
  });

  const steps = [
    freeze({
      id: `${descriptor.storyId}:from`,
      phase: 'before' as const,
      index: 0,
      instantUtc: before.instantUtc,
      anchorIndex: before.anchorIndex,
      point: before,
      marker: null,
      beamTrace: trace,
    }),
    freeze({
      id: `${descriptor.storyId}:transition`,
      phase: 'decision' as const,
      index: 1,
      instantUtc: decision.instantUtc,
      anchorIndex: decision.anchorIndex,
      point: decision,
      marker: null,
      beamTrace: trace,
    }),
    freeze({
      id: `${descriptor.storyId}:to`,
      phase: 'after' as const,
      index: 2,
      instantUtc: after.instantUtc,
      anchorIndex: after.anchorIndex,
      point: after,
      marker: null,
      beamTrace: trace,
    }),
  ];
  return freeze({
    storyId: descriptor.storyId,
    kind: descriptor.kind,
    descriptor,
    availability: descriptor.availability,
    steps: freezeArray(steps),
  });
}

function compileStory(
  descriptor: VisualLabReplayStoryDescriptor,
  timeline: VisualLabCanonicalTimeline | null,
): VisualLabCompiledStory {
  return descriptor.kind === 'inter-handover'
    ? interStory(descriptor, timeline)
    : intraStory(descriptor, timeline);
}

function initialStoryId(stories: readonly VisualLabCompiledStory[]): string | null {
  return stories.find(story => story.availability.status === 'available')?.storyId
    ?? stories[0]?.storyId
    ?? null;
}

function activeStory(
  stories: readonly VisualLabCompiledStory[],
  storyId: string | null,
): VisualLabCompiledStory | null {
  return storyId === null ? null : stories.find(story => story.storyId === storyId) ?? null;
}

function createState(
  stories: readonly VisualLabCompiledStory[],
  storyId: string | null,
  status: VisualLabStoryRuntimeStatus,
  stepIndex: number | null,
  inspectedTarget: VisualLabInspectTarget | null,
  presentation: VisualLabPresentationState,
  snapshot: VisualLabCanonicalSnapshot | null,
  forkedFromStoryId: string | null,
): VisualLabStoryRuntimeState {
  const story = activeStory(stories, storyId);
  const boundedStepIndex = story === null || story.steps.length === 0 || stepIndex === null
    ? null
    : Math.max(0, Math.min(stepIndex, story.steps.length - 1));
  const available = story?.availability.status === 'available' && story.steps.length > 0;
  const normalizedStatus = !available && story !== null
    ? 'unavailable'
    : status;
  return freeze({
    status: normalizedStatus,
    activeStoryId: storyId,
    activeStoryKind: story?.kind ?? null,
    activeStepIndex: boundedStepIndex,
    activeStep: boundedStepIndex === null || story === null ? null : story.steps[boundedStepIndex] ?? null,
    inspectedTarget,
    presentation,
    stories,
    snapshot,
    forkedFromStoryId,
  });
}

function sameState(a: VisualLabStoryRuntimeState, b: VisualLabStoryRuntimeState): boolean {
  return a.status === b.status
    && a.activeStoryId === b.activeStoryId
    && a.activeStepIndex === b.activeStepIndex
    && a.inspectedTarget === b.inspectedTarget
    && a.presentation.experience === b.presentation.experience
    && a.forkedFromStoryId === b.forkedFromStoryId;
}

/**
 * Create a deterministic, framework-free replay runtime over accepted
 * canonical evidence.  `tick()` is the only clock: no interval, animation
 * frame, or renderer side effect is hidden inside this module.
 */
export function createVisualLabStoryRuntime(
  input: VisualLabStoryRuntimeInput,
): VisualLabStoryRuntime {
  const snapshotIsMock = (input.snapshot as { readonly isMock?: unknown } | null)?.isMock === true;
  const timelineIsMock = (input.timeline as { readonly isMock?: unknown } | null)?.isMock === true;
  if (snapshotIsMock) {
    throw new Error('VisualLabStoryRuntime refuses a mock canonical snapshot');
  }
  if (timelineIsMock) {
    throw new Error('VisualLabStoryRuntime refuses a mock canonical timeline');
  }
  const stories = freezeArray(input.stories.map(descriptor => compileStory(descriptor, input.timeline)));
  const initialId = initialStoryId(stories);
  const initial = activeStory(stories, initialId);
  let current = createState(
    stories,
    initialId,
    initial?.availability.status === 'available' ? 'idle' : 'unavailable',
    initial?.availability.status === 'available' ? 0 : null,
    null,
    input.presentation ?? freeze({ theme: 'dark', locale: 'zh-Hant', experience: 'guided' }),
    input.snapshot,
    null,
  );
  const listeners = new Set<(state: VisualLabStoryRuntimeState) => void>();

  const publish = (next: VisualLabStoryRuntimeState): VisualLabStoryRuntimeState => {
    if (!sameState(current, next)) {
      current = next;
      for (const listener of listeners) listener(current);
    }
    return current;
  };

  const selectStory = (storyId: string): VisualLabStoryRuntimeState => {
    const story = activeStory(stories, storyId);
    if (story === null) return current;
    return publish(createState(
      stories,
      story.storyId,
      story.availability.status === 'available' ? 'idle' : 'unavailable',
      story.availability.status === 'available' ? 0 : null,
      null,
      current.presentation,
      input.snapshot,
      null,
    ));
  };

  const dispatch = (command: VisualLabStoryCommand): VisualLabStoryRuntimeState => {
    const story = activeStory(stories, current.activeStoryId);
    switch (command.type) {
      case 'play': {
        if (story === null || story.availability.status !== 'available') return current;
        const index = current.status === 'completed' || current.activeStepIndex === null ? 0 : current.activeStepIndex;
        return publish(createState(stories, story.storyId, 'playing', index, current.inspectedTarget, current.presentation, input.snapshot, null));
      }
      case 'pause':
        return story === null || story.availability.status !== 'available'
          ? current
          : publish(createState(stories, story.storyId, current.status === 'completed' ? 'completed' : 'paused', current.activeStepIndex ?? 0, current.inspectedTarget, current.presentation, input.snapshot, current.forkedFromStoryId));
      case 'next': {
        if (story === null || story.availability.status !== 'available' || story.steps.length === 0) return current;
        const currentIndex = current.activeStepIndex ?? 0;
        const nextIndex = Math.min(currentIndex + 1, story.steps.length - 1);
        return publish(createState(stories, story.storyId, nextIndex === story.steps.length - 1 ? 'completed' : 'paused', nextIndex, current.inspectedTarget, current.presentation, input.snapshot, current.forkedFromStoryId));
      }
      case 'previous': {
        if (story === null || story.availability.status !== 'available' || story.steps.length === 0) return current;
        const currentIndex = current.activeStepIndex ?? 0;
        return publish(createState(stories, story.storyId, 'paused', Math.max(0, currentIndex - 1), current.inspectedTarget, current.presentation, input.snapshot, current.forkedFromStoryId));
      }
      case 'restart': {
        const restartStory = story?.availability.status === 'available' ? story : activeStory(stories, initialId);
        if (restartStory === null || restartStory.availability.status !== 'available') return current;
        return publish(createState(stories, restartStory.storyId, 'paused', 0, null, current.presentation, input.snapshot, null));
      }
      case 'inspect':
        return publish(createState(stories, current.activeStoryId, current.status, current.activeStepIndex, command.target, current.presentation, input.snapshot, current.forkedFromStoryId));
      case 'fork-to-explore':
        return publish(createState(stories, null, 'idle', null, current.inspectedTarget, freeze({ ...current.presentation, experience: 'explore' }), input.snapshot, current.activeStoryId));
      default:
        return current;
    }
  };

  const tick = (): VisualLabStoryRuntimeState => {
    if (current.status !== 'playing') return current;
    const story = activeStory(stories, current.activeStoryId);
    if (story === null || story.availability.status !== 'available' || story.steps.length === 0) return current;
    const currentIndex = current.activeStepIndex ?? 0;
    if (currentIndex >= story.steps.length - 1) {
      return publish(createState(stories, story.storyId, 'completed', currentIndex, current.inspectedTarget, current.presentation, input.snapshot, current.forkedFromStoryId));
    }
    const nextIndex = currentIndex + 1;
    return publish(createState(stories, story.storyId, nextIndex === story.steps.length - 1 ? 'completed' : 'playing', nextIndex, current.inspectedTarget, current.presentation, input.snapshot, current.forkedFromStoryId));
  };

  return {
    state: () => current,
    dispatch,
    tick,
    selectStory,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
