import type { SatelliteSnapshot } from '../engine/signal/types';
import { computeLinkBudget } from '../engine/signal/link-budget';
import { HandoverManager } from '../engine/handover/handover-manager';
import {
  mobilityStep,
  type UeMobilityMode,
  type UeMobilityParams,
  type UePerMobilityState,
} from '../engine/ue/multiUeMobility';
import type { Profile } from '../profiles/types';
import { EARTH_KM_PER_DEG } from '../engine/orbit/earth-constants';

export interface RuntimePerUeSinrPosition {
  id: string;
  groundX: number;
  groundZ: number;
  eastKm: number;
  northKm: number;
  sinrDb: number | null;
  servingSatId: string | null;
  servingBeamId: number | null;
  pendingTargetSatId: string | null;
  pendingTargetBeamId: number | null;
  triggerProgressSec: number;
}

export interface FillPerUeServingSinrParams {
  perUePositions: RuntimePerUeSinrPosition[];
  /** The UE owned by the main HandoverManager; default keeps the old index 0 path. */
  primaryUeIndex?: number;
  primaryServingSinrDb: number;
  primaryServingSatId: string | null;
  primaryServingBeamId: number | null;
  primaryLatDeg: number;
  primaryLonDeg: number;
  primaryEastKm: number;
  primaryNorthKm: number;
  snapshots: SatelliteSnapshot[];
  linkBudgetOptions: Parameters<typeof computeLinkBudget>[2];
}

export interface StepSecondaryUeHandoversParams {
  perUePositions: RuntimePerUeSinrPosition[];
  secondaryHoManagers: readonly HandoverManager[];
  primaryLatDeg: number;
  primaryLonDeg: number;
  primaryEastKm: number;
  primaryNorthKm: number;
  snapshots: SatelliteSnapshot[];
  linkBudgetOptions: Parameters<typeof computeLinkBudget>[2];
  dtSec: number;
  simTimeMs: number;
  /** The UE owned by the MAIN HandoverManager; this pass skips it. Default 0. */
  primaryUeIndex?: number;
}

export interface ApplyPerTickUeMobilityParams {
  perUePositions: RuntimePerUeSinrPosition[];
  mobilityStates: UePerMobilityState[];
  /** The UE that remains the protagonist while secondaries move around it. */
  primaryUeIndex?: number;
  /**
   * Secondaries this pass must leave exactly where they are. Used for UEs that
   * USED to be the protagonist and are holding the ground they walked to
   * (`RuntimeFrameStepState.protagonistDriftOffsetKmByUeId`): their position is
   * owned by that held offset, not by the mobility integrator, and letting both
   * write it would drag them off the spot they stopped on. Empty by default, so
   * callers that do not pass it are unchanged.
   */
  frozenUeIndices?: ReadonlySet<number>;
  ueMobilityMode: UeMobilityMode;
  ueMobilityParams: UeMobilityParams;
  deltaSec: number;
  primaryFootprintRadiusKm: number;
  ueWorldScale: number;
}

export function resolveProfileRectangleAreaKm(profile: Profile): { widthKm: number; heightKm: number } | undefined {
  const distribution = profile.ueDistribution;
  if (distribution?.mode !== 'uniform-rectangle') return undefined;
  if (
    !Number.isFinite(distribution.areaWidthKm)
    || !Number.isFinite(distribution.areaHeightKm)
    || distribution.areaWidthKm <= 0
    || distribution.areaHeightKm <= 0
  ) {
    return undefined;
  }

  // Uniform-rectangle sampling is carried by the profile's area dimensions.
  return {
    widthKm: distribution.areaWidthKm,
    heightKm: distribution.areaHeightKm,
  };
}

export function fillPerUeServingSinr(params: FillPerUeServingSinrParams): RuntimePerUeSinrPosition[] {
  const {
    perUePositions,
    primaryUeIndex = 0,
    primaryServingSinrDb,
    primaryServingSatId,
    primaryServingBeamId,
    primaryLatDeg,
    primaryLonDeg,
    primaryEastKm,
    primaryNorthKm,
    snapshots,
    linkBudgetOptions,
  } = params;

  if (perUePositions.length === 0) return perUePositions;
  const primary = perUePositions[primaryUeIndex] ?? perUePositions[0];
  const resolvedPrimaryUeIndex = perUePositions[primaryUeIndex] === undefined ? 0 : primaryUeIndex;
  primary.sinrDb = primaryServingSinrDb;

  if (primaryServingSatId === null || primaryServingBeamId === null) {
    for (let i = 0; i < perUePositions.length; i += 1) {
      if (i === resolvedPrimaryUeIndex) continue;
      perUePositions[i].sinrDb = null;
    }
    return perUePositions;
  }

  const cosPrimaryLat = Math.cos((primaryLatDeg * Math.PI) / 180);
  const lonKmPerDeg = EARTH_KM_PER_DEG * Math.max(Math.abs(cosPrimaryLat), 1e-6);

  for (let i = 0; i < perUePositions.length; i += 1) {
    if (i === resolvedPrimaryUeIndex) continue;
    const ueSecondary = perUePositions[i];
    const deltaEastKm = ueSecondary.eastKm - primaryEastKm;
    const deltaNorthKm = ueSecondary.northKm - primaryNorthKm;
    const secondarySamples = computeLinkBudget(
      {
        latDeg: primaryLatDeg + deltaNorthKm / EARTH_KM_PER_DEG,
        lonDeg: primaryLonDeg + deltaEastKm / lonKmPerDeg,
        offsetEastKm: deltaEastKm,
        offsetNorthKm: deltaNorthKm,
      },
      snapshots,
      linkBudgetOptions,
    );
    const matchingSample = secondarySamples.find(
      sample => sample.satId === primaryServingSatId && sample.beamId === primaryServingBeamId,
    );
    ueSecondary.sinrDb = matchingSample?.sinrDb ?? null;
  }

  return perUePositions;
}

export function stepSecondaryUeHandovers(
  params: StepSecondaryUeHandoversParams,
): RuntimePerUeSinrPosition[] {
  const {
    perUePositions,
    secondaryHoManagers,
    primaryLatDeg,
    primaryLonDeg,
    primaryEastKm,
    primaryNorthKm,
    snapshots,
    linkBudgetOptions,
    dtSec,
    simTimeMs,
    primaryUeIndex = 0,
  } = params;

  if (perUePositions.length <= 1 || secondaryHoManagers.length === 0) return perUePositions;

  const cosPrimaryLat = Math.cos((primaryLatDeg * Math.PI) / 180);
  const lonKmPerDeg = EARTH_KM_PER_DEG * Math.max(Math.abs(cosPrimaryLat), 1e-6);

  // Walk every UE EXCEPT the protagonist, keeping the manager↔UE pairing stable
  // by slot order. This used to assume the protagonist was index 0; with a
  // focused cell it can be any index, and letting the secondary pass also touch
  // it would have two managers writing the same UE's serving state.
  let managerSlot = 0;
  for (let i = 0; i < perUePositions.length; i += 1) {
    if (i === primaryUeIndex) continue;
    const manager = secondaryHoManagers[managerSlot];
    managerSlot += 1;
    if (!manager) continue;

    const ueSecondary = perUePositions[i];
    const deltaEastKm = ueSecondary.eastKm - primaryEastKm;
    const deltaNorthKm = ueSecondary.northKm - primaryNorthKm;
    const secondarySamples = computeLinkBudget(
      {
        latDeg: primaryLatDeg + deltaNorthKm / EARTH_KM_PER_DEG,
        lonDeg: primaryLonDeg + deltaEastKm / lonKmPerDeg,
        offsetEastKm: deltaEastKm,
        offsetNorthKm: deltaNorthKm,
      },
      snapshots,
      linkBudgetOptions,
    );

    if (manager.state.satId && !secondarySamples.some(sample => sample.satId === manager.state.satId)) {
      manager.clearServing();
    }

    manager.update(secondarySamples, dtSec, simTimeMs);
    ueSecondary.sinrDb = manager.state.sinrDb;
    ueSecondary.servingSatId = manager.state.satId;
    ueSecondary.servingBeamId = manager.state.beamId;
    ueSecondary.pendingTargetSatId = manager.state.pendingTarget?.satId ?? null;
    ueSecondary.pendingTargetBeamId = manager.state.pendingTarget?.beamId ?? null;
    ueSecondary.triggerProgressSec = manager.state.pendingTarget ? manager.state.triggerTimeSec : 0;
  }

  return perUePositions;
}

export function applyPerTickUeMobility(
  params: ApplyPerTickUeMobilityParams,
): RuntimePerUeSinrPosition[] {
  const {
    perUePositions,
    mobilityStates,
    primaryUeIndex = 0,
    frozenUeIndices,
    ueMobilityMode,
    ueMobilityParams,
    deltaSec,
    primaryFootprintRadiusKm,
    ueWorldScale,
  } = params;
  if (ueMobilityMode === 'static' || perUePositions.length <= 1) return perUePositions;

  const primary = perUePositions[primaryUeIndex] ?? perUePositions[0];
  const resolvedPrimaryUeIndex = perUePositions[primaryUeIndex] === undefined ? 0 : primaryUeIndex;
  for (let i = 0; i < perUePositions.length; i += 1) {
    if (i === resolvedPrimaryUeIndex) continue;
    if (frozenUeIndices?.has(i)) continue;
    const previous = perUePositions[i];
    const storedState = mobilityStates[i];
    if (!storedState) continue;
    const currentPosition = storedState.currentPosition ?? previous;
    const next = mobilityStep(
      currentPosition,
      {
        ...storedState,
        originEastKm: primary.eastKm,
        originNorthKm: primary.northKm,
        ueWorldScale,
      },
      ueMobilityMode,
      ueMobilityParams,
      deltaSec,
      primaryFootprintRadiusKm,
    );
    mobilityStates[i] = next.state;
    perUePositions[i] = {
      ...previous,
      groundX: next.position.groundX,
      groundZ: next.position.groundZ,
      eastKm: next.position.eastKm,
      northKm: next.position.northKm,
    };
  }

  return perUePositions;
}
