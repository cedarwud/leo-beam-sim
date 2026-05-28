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

const EARTH_KM_PER_DEG = 111.32;

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
}

export interface ApplyPerTickUeMobilityParams {
  perUePositions: RuntimePerUeSinrPosition[];
  mobilityStates: UePerMobilityState[];
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

  // Source: modqn-paper-reproduction/docs/modqn-reproduction-assumption-register.md
  // ASSUME-MODQN-REP-022: uniform-rectangle sampling inside 200 km x 90 km;
  // StepConfig carries these as user_area_width_km/user_area_height_km.
  return {
    widthKm: distribution.areaWidthKm,
    heightKm: distribution.areaHeightKm,
  };
}

export function fillPerUeServingSinr(params: FillPerUeServingSinrParams): RuntimePerUeSinrPosition[] {
  const {
    perUePositions,
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
  perUePositions[0].sinrDb = primaryServingSinrDb;

  if (primaryServingSatId === null || primaryServingBeamId === null) {
    for (let i = 1; i < perUePositions.length; i += 1) {
      perUePositions[i].sinrDb = null;
    }
    return perUePositions;
  }

  const cosPrimaryLat = Math.cos((primaryLatDeg * Math.PI) / 180);
  const lonKmPerDeg = EARTH_KM_PER_DEG * Math.max(Math.abs(cosPrimaryLat), 1e-6);

  for (let i = 1; i < perUePositions.length; i += 1) {
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
  } = params;

  if (perUePositions.length <= 1 || secondaryHoManagers.length === 0) return perUePositions;

  const cosPrimaryLat = Math.cos((primaryLatDeg * Math.PI) / 180);
  const lonKmPerDeg = EARTH_KM_PER_DEG * Math.max(Math.abs(cosPrimaryLat), 1e-6);

  for (let i = 1; i < perUePositions.length; i += 1) {
    const manager = secondaryHoManagers[i - 1];
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
    ueMobilityMode,
    ueMobilityParams,
    deltaSec,
    primaryFootprintRadiusKm,
    ueWorldScale,
  } = params;
  if (ueMobilityMode === 'static' || perUePositions.length <= 1) return perUePositions;

  const primary = perUePositions[0];
  for (let i = 1; i < perUePositions.length; i += 1) {
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

