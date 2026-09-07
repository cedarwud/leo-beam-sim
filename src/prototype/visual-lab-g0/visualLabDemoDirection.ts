import type { VisualLabGuidedReplayPhase } from '../../visualLab/guidedReplay';
import type {
  VisualLabStoryBeat,
  VisualLabStorySceneDirection,
} from '../../visualLab/story';

export type VisualLabDemoHandoverKind = 'intra-handover' | 'inter-handover';

export interface VisualLabDemoReplayState {
  readonly kind: VisualLabDemoHandoverKind;
  readonly elapsedMs: number;
}

export interface VisualLabDemoReplayView {
  readonly phase: VisualLabGuidedReplayPhase;
  readonly beat: VisualLabStoryBeat;
}

interface VisualLabDemoUser {
  readonly index: number;
  readonly cellIndex: number;
}

export interface VisualLabDemoSceneInput {
  readonly satellites: readonly {
    readonly satelliteId: string;
    readonly topocentric: { readonly elevationDeg: number };
  }[];
  readonly serving: { readonly satelliteId: string };
  readonly candidate: {
    readonly availability: 'available' | 'unavailable';
    readonly satelliteId: string | null;
  };
  readonly representative: {
    readonly availability: 'available' | 'unavailable';
    readonly user: VisualLabDemoUser | null;
  };
  readonly users: readonly VisualLabDemoUser[];
  readonly activeBeamTargets: {
    readonly targets: readonly {
      readonly beamId: number;
      readonly cellIndex: number;
    }[];
  };
}

export interface VisualLabDemoDirectionInput {
  readonly replay: VisualLabDemoReplayState;
  readonly view: VisualLabDemoReplayView;
  readonly scene: VisualLabDemoSceneInput | null;
}

/** Derive the presentation-only direction for the compact demo replay. */
export function deriveVisualLabDemoDirection({
  replay,
  view,
  scene,
}: VisualLabDemoDirectionInput): VisualLabStorySceneDirection | null {
  if (scene === null) return null;

  const rankedSatellites = scene.satellites
    .slice()
    .sort((left, right) => right.topocentric.elevationDeg - left.topocentric.elevationDeg);
  // The intra path preserves the accepted serving identity and footprint.
  // The inter path starts from the highest visible pair in the retained pool.
  const servingSatellite = replay.kind === 'inter-handover'
    ? rankedSatellites[0] ?? scene.serving
    : scene.serving;
  const servingId = servingSatellite.satelliteId;
  const otherSatellite = rankedSatellites.find(satellite => satellite.satelliteId !== servingId)
    ?? (scene.candidate.availability === 'available' && scene.candidate.satelliteId !== servingId
      ? { satelliteId: scene.candidate.satelliteId }
      : null);
  const targetId = replay.kind === 'intra-handover'
    ? servingId
    : otherSatellite?.satelliteId ?? `${servingId}-demo-candidate`;
  const user = scene.representative.availability === 'available'
    ? scene.representative.user
    : scene.users[0] ?? null;
  const fromBeamId = user === null
    ? scene.activeBeamTargets.targets[0]?.beamId ?? 0
    : scene.activeBeamTargets.targets.find(target => target.cellIndex === user.cellIndex)?.beamId
      ?? scene.activeBeamTargets.targets[0]?.beamId
      ?? 0;
  // A same-satellite handover changes beam ownership on the same UE/cell.
  const toBeamId = fromBeamId;
  return Object.freeze({
    storyId: `demo:${replay.kind}`,
    storyKind: replay.kind === 'intra-handover' ? 'intra-handover' : 'inter-handover',
    beat: view.beat,
    cameraCue: view.beat === 'before'
      ? 'handover-before'
      : view.beat === 'decision' ? 'handover-decision' : 'handover-after',
    fromSatelliteId: servingId,
    toSatelliteId: targetId,
    fromBeamId: replay.kind === 'intra-handover' ? fromBeamId : null,
    toBeamId: replay.kind === 'intra-handover' ? toBeamId : null,
    userIndex: user?.index ?? null,
    revision: `demo:${replay.kind}:${view.phase}:${Math.round(replay.elapsedMs / 80)}`,
  });
}
