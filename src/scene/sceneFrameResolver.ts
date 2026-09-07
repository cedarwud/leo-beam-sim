import { liveSimToScene, type LiveSimToSceneOptions } from '../showcase/liveSimToScene';
import type { SimulationAnalysisFrame } from '../simulator/types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import type { SceneGeometry } from './SceneGeometry';
import type { SimFrame } from './types';

export type SceneFrameSource = 'archived-tle' | 'live';

export interface SceneFrameResolutionInput {
  readonly archivedTleFrameIdentity?: Pick<SimulationAnalysisFrame, 'frameId' | 'provenance'>;
  readonly propSceneFrame?: NormalizedSceneFrame;
  readonly sceneGeometry: SceneGeometry;
  readonly sim: SimFrame;
  readonly simSource: SceneFrameSource;
  /** Injectable only for pure tests; production uses the live scene adapter. */
  readonly projectLiveFrame?: (
    sim: SimFrame,
    geometry: SceneGeometry,
    options: LiveSimToSceneOptions,
  ) => NormalizedSceneFrame;
}

/** Resolve the renderer frame without reading React state or creating effects. */
export function resolveSceneFrame(input: SceneFrameResolutionInput): NormalizedSceneFrame {
  if (input.propSceneFrame) return input.propSceneFrame;

  const projectLiveFrame = input.projectLiveFrame ?? liveSimToScene;
  const projected = projectLiveFrame(input.sim, input.sceneGeometry, {
    source: input.simSource === 'archived-tle' ? 'archived-tle' : 'walker',
  });
  if (input.simSource !== 'archived-tle') return projected;
  if (input.archivedTleFrameIdentity === undefined) {
    throw new Error('archived TLE renderer requires immutable frame provenance');
  }

  return {
    ...projected,
    sceneSource: 'archived-tle' as const,
    provenance: {
      kind: 'archived-tle' as const,
      sourceKind: 'ARCHIVED_TLE' as const,
      propagationModel: input.archivedTleFrameIdentity.provenance.propagationModel,
      archiveId: input.archivedTleFrameIdentity.provenance.archiveId,
      frameId: input.archivedTleFrameIdentity.frameId,
      note: 'Projection of one accepted immutable SGP4/canonical analysis frame.',
    },
    claimBoundary: {
      kind: 'archived-tle' as const,
      storyKind: 'canonical-tle-sinr-ee' as const,
      allowedClaims: [
        'archived TLE SGP4 geometry',
        'canonical same-frame SINR, throughput, power and EE projection',
        'canonical 3 dB / 30 s handover trace',
      ],
      forbiddenClaims: [
        'live ephemeris',
        'multi-satellite RF interference',
        'synthetic handover events',
        'physical energy saving',
      ],
    },
    evidenceStatus: {
      kind: 'archived-tle' as const,
      status: 'accepted-immutable-frame' as const,
      notes: ['candidate is comparison-only and never an active interference owner'],
    },
  };
}
