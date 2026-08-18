import type { VisualLabGuidedReplayProgress } from '../../visualLab/guidedReplay';
import type { VisualLabStorySceneDirection } from '../../visualLab/story';
import type { VisualLabLocalHandover } from './visualLabLocalSceneAdapter';

export const VISUAL_LAB_HANDOVER_CROSSFADE_SEC = 5;

export interface VisualLabDirectedHandoverPresentation {
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly sourceBeamOpacity: number;
  readonly targetCandidateOpacity: number;
  readonly targetServiceOpacity: number;
  readonly phase: 'qualification' | 'switch' | 'settled';
  readonly source: 'canonical-trace' | 'guided-source-story';
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));
const smooth = (value: number): number => {
  const t = clampUnit(value);
  return t * t * (3 - 2 * t);
};

function sourceBackedIdentity(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNegativeFinite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
}

function switchEnvelope(progress: number): Pick<
  VisualLabDirectedHandoverPresentation,
  'sourceBeamOpacity' | 'targetCandidateOpacity' | 'targetServiceOpacity'
> {
  const t = smooth(progress);
  const colorChange = smooth((t - .72) / .28);
  return {
    sourceBeamOpacity: 1 - t,
    // Keep one continuous blue envelope on screen while ownership changes.
    // The old expression faded the candidate cone to zero before the blue
    // service fan was fully visible, which read as a disappearing/reappearing
    // beam.  A small floor bridges that visual handoff; the settled state
    // below still removes the candidate-only cone completely.
    // The candidate is already an accepted target at the committed event
    // anchor.  Keep a visible blue floor from t=0 through the switch; the
    // settled envelope below removes this candidate-only cone only after the
    // blue service fan is fully owned by the target satellite.
    targetCandidateOpacity: Math.max(.22, t * (1 - colorChange)),
    targetServiceOpacity: colorChange,
  };
}

/**
 * Derive a presentation envelope from the accepted handover trace only.
 * The 30 s TTT qualification uses the accepted progress plus the visual
 * interpolation offset; a committed event gets a five-second colour/ownership
 * handoff without changing any scientific state.
 */
export function canonicalHandoverPresentation(
  handover: VisualLabLocalHandover,
  visualOffsetSec: number | null,
): VisualLabDirectedHandoverPresentation | null {
  // A presentation envelope is only allowed to project an accepted trace.
  // Keeping this guard here is important: a candidate identity in an
  // unavailable/pending adapter is not permission to draw a second link.
  if (handover.availability !== 'available') return null;
  const offsetSec = visualOffsetSec === null ? 0 : visualOffsetSec;
  if (!nonNegativeFinite(offsetSec)) return null;
  if (
    (handover.event === 'inter-handover' || handover.event === 'forced-continuity')
    && (handover.state === 'handover' || handover.state === 'forced-continuity')
    && sourceBackedIdentity(handover.eventFromSatelliteId)
    && sourceBackedIdentity(handover.eventToSatelliteId)
    && handover.eventFromSatelliteId !== handover.eventToSatelliteId
  ) {
    if (handover.presentationPhase === 'settled') {
      return {
        fromSatelliteId: handover.eventFromSatelliteId,
        toSatelliteId: handover.eventToSatelliteId,
        sourceBeamOpacity: 0,
        targetCandidateOpacity: 0,
        targetServiceOpacity: 1,
        phase: 'settled',
        source: 'canonical-trace',
      };
    }
    const progress = clampUnit(offsetSec / VISUAL_LAB_HANDOVER_CROSSFADE_SEC);
    if (progress >= 1) {
      return {
        fromSatelliteId: handover.eventFromSatelliteId,
        toSatelliteId: handover.eventToSatelliteId,
        sourceBeamOpacity: 0,
        targetCandidateOpacity: 0,
        targetServiceOpacity: 1,
        phase: 'settled',
        source: 'canonical-trace',
      };
    }
    return {
      fromSatelliteId: handover.eventFromSatelliteId,
      toSatelliteId: handover.eventToSatelliteId,
      ...switchEnvelope(progress),
      phase: 'switch',
      source: 'canonical-trace',
    };
  }
  if (
    handover.state === 'pending'
    && sourceBackedIdentity(handover.servingSatelliteId)
    && sourceBackedIdentity(handover.candidateSatelliteId)
    && handover.servingSatelliteId !== handover.candidateSatelliteId
    && nonNegativeFinite(handover.progressSec ?? 0)
    && handover.tttSec !== null
    && Number.isFinite(handover.tttSec)
    && handover.tttSec > 0
  ) {
    const progress = smooth(((handover.progressSec ?? 0) + offsetSec) / handover.tttSec);
    return {
      fromSatelliteId: handover.servingSatelliteId,
      toSatelliteId: handover.candidateSatelliteId,
      sourceBeamOpacity: 1 - .28 * progress,
      // Qualification is deliberately one candidate UE link, not the
      // candidate layout fan.  Start at zero and reveal it monotonically.
      targetCandidateOpacity: .8 * progress,
      targetServiceOpacity: 0,
      phase: 'qualification',
      source: 'canonical-trace',
    };
  }
  return null;
}

/** Presentation pacing over the identities of one accepted replay story. */
export function guidedHandoverPresentation(
  direction: VisualLabStorySceneDirection | null | undefined,
  progress: VisualLabGuidedReplayProgress | null | undefined,
): VisualLabDirectedHandoverPresentation | null {
  if (
    direction?.storyKind !== 'inter-handover'
    || progress === null
    || progress === undefined
    || !sourceBackedIdentity(direction.fromSatelliteId)
    || !sourceBackedIdentity(direction.toSatelliteId)
    || direction.fromSatelliteId === direction.toSatelliteId
    || progress.stage === 'comparison'
  ) return null;
  const t = smooth(Number.isFinite(progress.phaseFraction) ? progress.phaseFraction : 0);
  if (progress.stage === 'setup') {
    return {
      fromSatelliteId: direction.fromSatelliteId,
      toSatelliteId: direction.toSatelliteId,
      sourceBeamOpacity: 1,
      targetCandidateOpacity: 0,
      targetServiceOpacity: 0,
      phase: 'qualification',
      source: 'guided-source-story',
    };
  }
  if (progress.stage === 'candidate-approach') {
    return {
      fromSatelliteId: direction.fromSatelliteId,
      toSatelliteId: direction.toSatelliteId,
      sourceBeamOpacity: 1,
      targetCandidateOpacity: .08 + .42 * t,
      targetServiceOpacity: 0,
      phase: 'qualification',
      source: 'guided-source-story',
    };
  }
  if (progress.stage === 'qualification') {
    return {
      fromSatelliteId: direction.fromSatelliteId,
      toSatelliteId: direction.toSatelliteId,
      sourceBeamOpacity: 1 - .2 * t,
      targetCandidateOpacity: .5 + .3 * t,
      targetServiceOpacity: 0,
      phase: 'qualification',
      source: 'guided-source-story',
    };
  }
  if (progress.stage === 'switch') {
    return {
      fromSatelliteId: direction.fromSatelliteId,
      toSatelliteId: direction.toSatelliteId,
      ...switchEnvelope(progress.phaseFraction),
      phase: 'switch',
      source: 'guided-source-story',
    };
  }
  return {
    fromSatelliteId: direction.fromSatelliteId,
    toSatelliteId: direction.toSatelliteId,
    sourceBeamOpacity: 0,
    targetCandidateOpacity: 0,
    targetServiceOpacity: 1,
    phase: 'settled',
    source: 'guided-source-story',
  };
}
