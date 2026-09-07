import type {
  TeachingHandoverKind,
  TeachingIdentityBinding,
} from '../homepage/teaching/handoverTeachingScript';
import {
  resolveHomepageSatelliteDisplayName,
} from '../homepage/controller/homepageSatelliteDisplayName';
import { formatHomepageBeamCellLabel } from '../homepage/controller/homepageBeamIdentity';
import type { HomepageRailProjection } from '../homepage/controller/contracts';
import type { HandoverTeachingSceneStory } from '../viz/HandoverTeachingBeamCones';
import type {
  IntraHandoverPresentation,
  SimState,
} from '../scene/types';
import { cellIdFromLinkBudgetBeamId } from '../scene/sinrLiveCellModel';
import { resolveSinrLiveSceneCellCount } from '../scene/sinrLiveCellRuntime';
import {
  resolveTeachingInterRosterSatelliteIds,
} from './teachingInterRoster';

export function deriveTeachingInterRosterSatelliteIds(input: {
  readonly projection: HomepageRailProjection | null;
}): readonly string[] {
  const projection = input.projection;
  const roster = projection?.visibleCandidates ?? projection?.candidates ?? [];
  return resolveTeachingInterRosterSatelliteIds({
    servingSatelliteId: projection?.serving?.satelliteId ?? null,
    candidateSatelliteIds: roster.map(link => link.satelliteId),
    beamMetrics: projection?.beamMetrics?.metrics ?? [],
  });
}

export function resolveTeachingIntraSatelliteId(input: {
  readonly projection: HomepageRailProjection | null;
  readonly servingSatelliteId: string | null;
  readonly teachingInterRosterSatelliteIds: readonly string[];
}): string | null {
  return input.teachingInterRosterSatelliteIds[0]
    ?? input.servingSatelliteId
    ?? input.projection?.serving?.satelliteId
    ?? null;
}

export function deriveTeachingIdentityBinding(input: {
  readonly projection: HomepageRailProjection | null;
  readonly homepageSatelliteNameById: ReadonlyMap<string, string> | null;
  readonly teachingStageKind: TeachingHandoverKind | null;
  readonly teachingInterRosterSatelliteIds: readonly string[];
  readonly servingElevationDeg: number | null;
  readonly comparisonElevationDeg: number | null;
}): TeachingIdentityBinding {
  const projection = input.projection;
  const name = (satelliteId: string): string =>
    resolveHomepageSatelliteDisplayName(satelliteId, input.homepageSatelliteNameById);
  const servingLink = projection?.serving ?? null;
  const intraSatelliteId = input.teachingStageKind === 'intra'
    ? servingLink?.satelliteId ?? null
    : null;
  const serving = servingLink === null ? null : {
    satelliteLabel: name(intraSatelliteId ?? servingLink.satelliteId),
    beamLabel: formatHomepageBeamCellLabel(servingLink.beamId),
    elevationDeg: input.servingElevationDeg,
  };
  const roster = projection?.visibleCandidates ?? projection?.candidates ?? [];
  const candidates = input.teachingStageKind === 'intra'
    ? (projection?.beamMetrics?.metrics ?? [])
      .filter(metric => intraSatelliteId !== null
        && metric.satelliteId === intraSatelliteId
        && metric.beamId !== servingLink?.beamId)
      .map(metric => ({
        satelliteLabel: name(metric.satelliteId),
        beamLabel: formatHomepageBeamCellLabel(metric.beamId),
        elevationDeg: input.servingElevationDeg,
      }))
    : (() => {
      const bestBeamBySatellite = new Map<string, { beamId: number; ee: number }>();
      for (const metric of projection?.beamMetrics?.metrics ?? []) {
        if (servingLink !== null && metric.satelliteId === servingLink.satelliteId) continue;
        const ee = metric.energyEfficiencyBitsPerJoule ?? Number.NEGATIVE_INFINITY;
        const current = bestBeamBySatellite.get(metric.satelliteId);
        if (current === undefined || ee > current.ee) {
          bestBeamBySatellite.set(metric.satelliteId, { beamId: metric.beamId, ee });
        }
      }
      const servingBeamId = servingLink?.beamId ?? 1;
      const usedBeamIds = new Set<number>([servingBeamId]);
      return input.teachingInterRosterSatelliteIds.map((satelliteId, index) => {
        const measuredBeamId = bestBeamBySatellite.get(satelliteId)?.beamId
          ?? roster.find(link => link.satelliteId === satelliteId)?.beamId
          ?? null;
        let beamId = measuredBeamId !== null && !usedBeamIds.has(measuredBeamId)
          ? measuredBeamId
          : 0;
        if (beamId === 0) {
          let hash = 2166136261;
          for (const character of satelliteId) {
            hash ^= character.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
          }
          for (let attempt = 0; attempt < 7; attempt += 1) {
            const candidate = (((hash >>> 0) + attempt) % 7) + 1;
            if (!usedBeamIds.has(candidate)) { beamId = candidate; break; }
          }
          if (beamId === 0) beamId = ((servingBeamId + index) % 7) + 1;
        }
        usedBeamIds.add(beamId);
        return {
          satelliteLabel: name(satelliteId),
          beamLabel: formatHomepageBeamCellLabel(beamId),
          elevationDeg: index === 0 ? input.comparisonElevationDeg : null,
        };
      });
    })();
  return { serving, candidates: Object.freeze(candidates) };
}

export function deriveTeachingSceneStoryCandidate(input: {
  readonly teachingStageKind: TeachingHandoverKind | null;
  readonly projection: HomepageRailProjection | null;
  readonly servingSatelliteId: string | null;
  readonly servingCellId: number | null;
  readonly teachingInterRosterSatelliteIds: readonly string[];
  readonly servingBeamCount: number | undefined;
}): HandoverTeachingSceneStory | null {
  if (input.teachingStageKind === null) return null;
  const servingLink = input.projection?.serving ?? null;
  const sourceSatelliteId = input.servingSatelliteId ?? servingLink?.satelliteId ?? null;
  const servingBeamId = servingLink?.beamId ?? null;
  const sourceCellId = input.servingCellId
    ?? (servingBeamId === null ? null : cellIdFromLinkBudgetBeamId(servingBeamId));
  if (sourceSatelliteId === null || sourceCellId === null) return null;
  if (input.teachingStageKind === 'inter') {
    const targetSatelliteId = input.teachingInterRosterSatelliteIds
      .find(satelliteId => satelliteId !== sourceSatelliteId) ?? null;
    if (targetSatelliteId === null) return null;
    return {
      kind: 'inter',
      sourceSatelliteId,
      sourceCellId,
      targetSatelliteId,
      targetCellId: null,
      storyKey: `teaching-inter:${sourceSatelliteId}:${targetSatelliteId}:${sourceCellId}`,
    };
  }
  const sceneCellCount = Math.max(1, resolveSinrLiveSceneCellCount(input.servingBeamCount));
  const intraCellId = sourceCellId < sceneCellCount ? sourceCellId : 0;
  return {
    kind: 'intra',
    sourceSatelliteId,
    sourceCellId: intraCellId,
    targetSatelliteId: null,
    targetCellId: intraCellId,
    storyKey: `teaching-intra:${sourceSatelliteId}:${intraCellId}`,
  };
}

export interface IntraTeachingDisplayRequest {
  readonly kind: 'intra' | 'inter';
  readonly intraPresentation: IntraHandoverPresentation | null | undefined;
}

export function deriveIntraTeachingDisplayState(input: {
  readonly simState: SimState;
  readonly visibleManualHandoverActive: boolean;
  readonly manualHandoverRequest: IntraTeachingDisplayRequest | null;
}): SimState {
  const presentation = input.visibleManualHandoverActive
    && input.manualHandoverRequest?.kind === 'intra'
    ? input.manualHandoverRequest.intraPresentation
    : null;
  if (presentation === null || presentation === undefined) return input.simState;
  return {
    ...input.simState,
    panelPrimary: {
      ...input.simState.panelPrimary,
      role: 'serving',
      satId: presentation.sourceSatId,
      beamId: null,
      sinrDb: presentation.servingSinrDb,
      elevationDeg: presentation.elevationDeg,
      rangeKm: presentation.rangeKm,
      status: 'live',
    },
    panelComparison: {
      ...input.simState.panelComparison,
      role: 'pending',
      satId: presentation.sourceSatId,
      beamId: null,
      sinrDb: presentation.candidateSinrDb,
      elevationDeg: presentation.elevationDeg,
      rangeKm: presentation.rangeKm,
      status: 'live',
    },
    servingSatId: presentation.sourceSatId,
    servingBeamId: null,
    servingCellId: presentation.sourceCellId,
    servingElevationDeg: presentation.elevationDeg,
    servingRangeKm: presentation.rangeKm,
    pendingTargetSatId: presentation.sourceSatId,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: presentation.candidateSinrDb,
    comparisonSatId: presentation.sourceSatId,
    comparisonBeamId: null,
    comparisonElevationDeg: presentation.elevationDeg,
    comparisonRangeKm: presentation.rangeKm,
    comparisonSinrDb: presentation.candidateSinrDb,
    comparisonKind: 'pending',
    sinrDeltaDb: presentation.deltaSinrDb,
    sinrDb: presentation.servingSinrDb,
  };
}
