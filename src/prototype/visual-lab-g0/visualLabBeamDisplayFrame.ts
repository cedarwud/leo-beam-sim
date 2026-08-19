import type { FrameOptionsDraftView } from '../../visualLab/session/visualLabSession';
import {
  DEFAULT_BEAM_LAYOUT_COUNT,
  type SupportedBeamLayoutCount,
} from '../../core/beam/completeHexPresets';
import { resolveBeamLayoutCountForSatellite } from '../../simulator/beamLayoutOverrides';
import type {
  VisualLabLocalConfiguredBeamTarget,
  VisualLabLocalScenePlan,
} from './visualLabLocalSceneAdapter';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';

export type VisualLabBeamDisplayTarget = VisualLabLocalConfiguredBeamTarget;

export interface VisualLabBeamDisplayLane {
  readonly satelliteId: string | null;
  /** Candidate identity is shown only while the canonical trace is in TTT. */
  readonly visible: boolean;
  /** Complete-ring configuration selected for this satellite. */
  readonly configuredLayoutCount: SupportedBeamLayoutCount;
  /** Number of configured targets carrying positive canonical load. */
  readonly activeTargetCount: number;
  readonly selectedBeamId: number | null;
  readonly targets: readonly VisualLabBeamDisplayTarget[];
}

/**
 * One display-only beam frame projected from the accepted canonical frame.
 *
 * The canonical frame remains the owner of all values and active masks.  This
 * DTO only joins the accepted frame options with the already-published scene
 * targets so the renderer and result rail cannot resolve different beam
 * budgets or different serving/candidate lanes.
 */
export interface VisualLabBeamDisplayFrame {
  readonly schemaVersion: 'visual-lab-beam-display-frame-v1';
  readonly sourceFrameId: string | null;
  /** Per-satellite layout selected by the global control. */
  readonly globalLayoutCount: SupportedBeamLayoutCount;
  /** Total configured beams across the propagated constellation. */
  readonly globalBeamCount: number;
  readonly globalSatelliteCount: number | null;
  readonly illuminationMode: FrameOptionsDraftView['beamIlluminationMode'];
  readonly serving: VisualLabBeamDisplayLane;
  readonly candidate: VisualLabBeamDisplayLane;
}

function resolveGlobalBeamCount(input: {
  readonly globalLayoutCount: SupportedBeamLayoutCount;
  readonly perSatellite: FrameOptionsDraftView['perSatelliteBeamLayoutCount'];
  readonly satelliteCount: number | null | undefined;
}): number {
  if (input.satelliteCount === null || input.satelliteCount === undefined
    || !Number.isFinite(input.satelliteCount) || input.satelliteCount <= 0) {
    return input.globalLayoutCount;
  }
  const base = Math.floor(input.satelliteCount) * input.globalLayoutCount;
  return Object.values(input.perSatellite ?? {}).reduce(
    (total, configuredCount) => total + configuredCount - input.globalLayoutCount,
    base,
  );
}

function configuredLayoutCount(
  globalLayoutCount: SupportedBeamLayoutCount,
  perSatellite: FrameOptionsDraftView['perSatelliteBeamLayoutCount'],
  satelliteId: string | null,
): SupportedBeamLayoutCount {
  if (satelliteId === null) return globalLayoutCount;
  return resolveBeamLayoutCountForSatellite(globalLayoutCount, perSatellite, satelliteId)
    ?? DEFAULT_BEAM_LAYOUT_COUNT;
}

function lane(
  satelliteId: string | null,
  visible: boolean,
  configuredCount: SupportedBeamLayoutCount,
  targets: readonly VisualLabBeamDisplayTarget[],
  activeTargetCount: number,
  selectedBeamId: number | null,
): VisualLabBeamDisplayLane {
  return Object.freeze({
    satelliteId,
    visible,
    configuredLayoutCount: configuredCount,
    activeTargetCount,
    selectedBeamId,
    targets: Object.freeze([...targets]),
  });
}

export function createVisualLabBeamDisplayFrame(input: {
  readonly frameOptions: FrameOptionsDraftView;
  readonly snapshot: VisualLabCanonicalSnapshot | null;
  readonly localScene: VisualLabLocalScenePlan | null;
  readonly globalSatelliteCount?: number | null;
}): VisualLabBeamDisplayFrame {
  const globalLayoutCount = input.frameOptions.beamLayoutCount;
  const globalSatelliteCount = input.globalSatelliteCount ?? null;
  const globalBeamCount = resolveGlobalBeamCount({
    globalLayoutCount,
    perSatellite: input.frameOptions.perSatelliteBeamLayoutCount,
    satelliteCount: globalSatelliteCount,
  });
  const servingSatelliteId = input.snapshot?.serving.satelliteId ?? input.localScene?.serving.satelliteId ?? null;
  const candidateSatelliteId = input.snapshot?.candidate.satelliteId ?? input.localScene?.candidate.satelliteId ?? null;
  const candidateVisible = input.localScene?.handover.availability === 'available'
    && input.localScene.handover.state === 'pending'
    && input.localScene.handover.candidateSatelliteId !== null
    && input.localScene.handover.candidateSatelliteId === candidateSatelliteId;
  const servingTargets = input.localScene?.configuredBeamTargets.targets ?? [];
  const candidateTargets = input.localScene?.candidateBeamLayout.displayTargets ?? [];
  const servingActiveTargetCount = input.localScene?.activeBeamTargets.targets.length ?? 0;
  const candidateActiveTargetCount = input.localScene?.candidateBeamLayout.targets.length ?? 0;
  return Object.freeze({
    schemaVersion: 'visual-lab-beam-display-frame-v1' as const,
    sourceFrameId: input.localScene?.frameId ?? input.snapshot?.source.frameId ?? null,
    globalLayoutCount,
    globalBeamCount,
    globalSatelliteCount,
    illuminationMode: input.frameOptions.beamIlluminationMode,
    serving: lane(
      servingSatelliteId,
      true,
      configuredLayoutCount(globalLayoutCount, input.frameOptions.perSatelliteBeamLayoutCount, servingSatelliteId),
      servingTargets,
      servingActiveTargetCount,
      input.localScene?.representative.servingBeam?.beamId ?? null,
    ),
    candidate: lane(
      candidateSatelliteId,
      candidateVisible,
      configuredLayoutCount(globalLayoutCount, input.frameOptions.perSatelliteBeamLayoutCount, candidateSatelliteId),
      candidateTargets,
      candidateActiveTargetCount,
      input.localScene?.candidateBeamLayout.selectedBeamId ?? null,
    ),
  });
}
