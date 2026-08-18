import type {
  VisualLabReplayStoryKind,
} from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';
import type {
  VisualLabStoryControllerState,
} from './visualLabStoryController';
import type {
  VisualLabStoryStep,
} from '../../prototype/visual-lab-g0/story/visualLabStoryRuntime';

export type VisualLabStoryBeat = 'before' | 'decision' | 'after';

export type VisualLabStoryCameraCue =
  | 'handover-before'
  | 'handover-decision'
  | 'handover-after';

/**
 * Presentation-only direction derived from one accepted story step.
 *
 * It contains identities and camera intent, never positions or calculated
 * metrics. The renderer must resolve every visible point from the accepted
 * local scene plan at the active story anchor.
 */
export interface VisualLabStorySceneDirection {
  readonly storyId: string;
  readonly storyKind: VisualLabReplayStoryKind;
  readonly beat: VisualLabStoryBeat;
  readonly cameraCue: VisualLabStoryCameraCue;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly fromBeamId: number | null;
  readonly toBeamId: number | null;
  readonly userIndex: number | null;
  readonly revision: string;
}

function storyBeat(phase: VisualLabStoryStep['phase']): VisualLabStoryBeat | null {
  if (phase === 'before' || phase === 'from') return 'before';
  if (phase === 'decision' || phase === 'transition') return 'decision';
  if (phase === 'after' || phase === 'to') return 'after';
  return null;
}

function cameraCue(beat: VisualLabStoryBeat): VisualLabStoryCameraCue {
  if (beat === 'before') return 'handover-before';
  if (beat === 'decision') return 'handover-decision';
  return 'handover-after';
}

/** Derive the one scene/camera cue for the currently selected real story. */
export function deriveVisualLabStorySceneDirection(
  state: Pick<
    VisualLabStoryControllerState,
    'status' | 'activeStoryId' | 'activeStoryKind' | 'activeStep' | 'stories'
  >,
  storyOpen: boolean,
): VisualLabStorySceneDirection | null {
  if (!storyOpen || state.status === 'unavailable') return null;
  const step = state.activeStep;
  const storyId = state.activeStoryId;
  const storyKind = state.activeStoryKind;
  if (step === null || storyId === null || storyKind === null) return null;
  const beat = storyBeat(step.phase);
  if (beat === null) return null;

  const story = state.stories.find(candidate => candidate.storyId === storyId) ?? null;
  if (story === null || story.availability.status !== 'available') return null;

  if (storyKind === 'intra-handover') {
    const trace = step.beamTrace;
    if (trace === null) return null;
    return Object.freeze({
      storyId,
      storyKind,
      beat,
      cameraCue: cameraCue(beat),
      fromSatelliteId: trace.from.satelliteId,
      toSatelliteId: trace.to.satelliteId,
      fromBeamId: trace.from.beamId,
      toBeamId: trace.to.beamId,
      userIndex: trace.from.userIndex,
      revision: `${storyId}:${step.id}`,
    });
  }

  const source = story.descriptor.source;
  if (
    source.kind !== 'inter-handover'
    || source.fromSatelliteId === null
    || source.toSatelliteId === null
    || source.fromSatelliteId === source.toSatelliteId
  ) return null;

  return Object.freeze({
    storyId,
    storyKind,
    beat,
    cameraCue: cameraCue(beat),
    fromSatelliteId: source.fromSatelliteId,
    toSatelliteId: source.toSatelliteId,
    fromBeamId: null,
    toBeamId: null,
    userIndex: null,
    revision: `${storyId}:${step.id}`,
  });
}
