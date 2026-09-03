import type { VisualLabGlobalSceneFrame } from '../../prototype/visual-lab-g0/visualLabGlobalSceneAdapter';
import type { VisualLabLocalScenePlan } from '../../prototype/visual-lab-g0/visualLabLocalSceneAdapter';
import type { SimulatorConstellation } from '../../simulator/types';

/**
 * The closed scene projection consumed by the renderer.
 *
 * This module is deliberately not re-exported from `session/index.ts`.  The
 * session facade publishes the value as part of its immutable snapshot, while
 * the compiler itself remains an internal seam between accepted evidence and
 * presentation.
 */
export interface ScenePlanIdentity {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly runId: string | null;
  readonly analysisRunId: string | null;
  readonly geometryRunId: string | null;
  readonly instantUtc: string;
  readonly instantTaipei: string;
  readonly tleEpochUtc: string;
  readonly constellation: SimulatorConstellation;
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly selectedSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly selectedTlePath: string;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly contractVersion: string;
}

export type ScenePlanView = 'earth' | 'sky' | 'service';
export type ScenePlanDensity = 'clean' | 'context' | 'full';
export type ScenePlanFocus = 'geometry' | 'handover' | 'energy' | 'none';

export interface ScenePlan {
  readonly schemaVersion: 'visual-lab-scene-plan-v1';
  readonly identity: ScenePlanIdentity | null;
  readonly view: ScenePlanView;
  readonly density: ScenePlanDensity;
  readonly focus: ScenePlanFocus;
  readonly global: VisualLabGlobalSceneFrame | null;
  readonly local: VisualLabLocalScenePlan | null;
  readonly availability: 'available' | 'unavailable';
  readonly reason: string | null;
}

export interface ScenePlanAcceptedInput {
  readonly identity: ScenePlanIdentity;
  readonly global: VisualLabGlobalSceneFrame | null;
  readonly local: VisualLabLocalScenePlan | null;
}

export interface ScenePlanPresentationInput {
  readonly view: ScenePlanView;
  readonly density: ScenePlanDensity;
  readonly focus: ScenePlanFocus;
}

/**
 * Purely joins one accepted frame identity with one presentation state.
 *
 * No fallback values are invented here.  A missing accepted frame produces no
 * plan; a missing projection required by the selected view produces an
 * explicitly unavailable plan.  The global projection is intentionally
 * absent for local service/sky views in the runtime, so availability cannot be
 * defined as "both DTOs are non-null".  The returned object is shallowly
 * frozen because the accepted/global/local DTOs are already deep-frozen at
 * their publication boundary.
 */
export function compileScenePlan(
  accepted: ScenePlanAcceptedInput | null,
  presentation: ScenePlanPresentationInput,
): ScenePlan | null {
  if (accepted === null) return null;

  const projectionAvailable = presentation.view === 'earth'
    ? accepted.global !== null
    : accepted.local !== null;
  const reason = projectionAvailable
    ? null
    : presentation.view === 'earth'
      ? 'global scene projection is unavailable for the earth view'
      : 'local scene projection is unavailable for the selected local view';
  return Object.freeze({
    schemaVersion: 'visual-lab-scene-plan-v1' as const,
    identity: accepted.identity,
    view: presentation.view,
    density: presentation.density,
    focus: presentation.focus,
    global: accepted.global,
    local: accepted.local,
    availability: projectionAvailable ? 'available' as const : 'unavailable' as const,
    reason,
  });
}
