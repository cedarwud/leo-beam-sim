import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import { resolveAcceptedBeamIdentityColor } from './acceptedBeamIdentityColor';
import { paintConeItems } from '../appearance/paintConeItems';
import {
  resolveCandidateBeamConeItems,
  resolveBudgetedSinrLiveBeamConeItems,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveCellPlacement,
  type SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import { type HandoverConeEnvelope } from '../constants/sinrLiveConeStyle';
import { type SinrLiveCellFrame, type UeCellServingRecord } from './sinrLiveCellModel';
import { type WorldPoint } from '../viz/CellFootprints';

export interface CandidateConeGeometryInput {
  readonly pendingTargetSatId: string | null | undefined;
  readonly servingSatId: string | null | undefined;
  readonly primaryCellId: number | null | undefined;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly frequencyReuse: number;
  readonly cellFrame?: SinrLiveCellFrame;
  readonly maxFanCones: number;
}

export interface CandidateConePresentationInput {
  readonly candidateComparisonSceneActive: boolean;
  readonly renderCandidateField: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly showSinrLiveCellBeams: boolean;
  readonly hideCandidateFan: boolean;
  readonly showCinemaCandidateFan: boolean;
  readonly isInterPresentation: boolean;
  readonly handoverPhase: HandoverConeEnvelope['phase'];
  readonly handoverToOpacity: number;
  readonly candidateFanConeOpacity: number;
  readonly triggeredIntraPeakOpacity: number;
  readonly targetRole: 'candidate' | 'serving';
  readonly acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly restrictHomepageBeamItems: (
    items: readonly SinrLiveCellBeamConeRenderItem[],
  ) => readonly SinrLiveCellBeamConeRenderItem[];
}

export interface CandidateConeInput {
  readonly geometry: CandidateConeGeometryInput;
  readonly presentation: CandidateConePresentationInput;
}

function colorizeCandidateItems(
  items: readonly SinrLiveCellBeamConeRenderItem[],
  input: CandidateConePresentationInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  // COLOUR is decided by `src/appearance/`, never here. The lookup is keyed on
  // the item's OWN beam id (`coneItemBeamId`), not on a beam id re-derived from
  // the cell — the cell-keyed variant made this lane disagree with the serving
  // lane about which rung of the identity ladder a beam sits on.
  const snapshot = input.acceptedHandoverPresentation;
  return input.restrictHomepageBeamItems(paintConeItems(items, {
    resolveIdentityColor: (satId, beamId) =>
      resolveAcceptedBeamIdentityColor(snapshot, satId, beamId, ''),
    prominence: 'candidate',
  }));
}

/**
 * Pure candidate-cone projection. It accepts one selected cell frame and one
 * selected world map, then returns only the candidate render items. React state,
 * hooks, and the source-specific frame selection stay outside this seam.
 */
export function resolveCandidateConeItems(
  input: CandidateConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { geometry, presentation } = input;
  if (
    presentation.candidateComparisonSceneActive
    || (presentation.homepageVisualIdentity && !presentation.renderCandidateField)
    || !presentation.showSinrLiveCellBeams
    || (presentation.hideCandidateFan && !presentation.showCinemaCandidateFan)
  ) return [];

  const rawItems = resolveCandidateBeamConeItems({
    pendingTargetSatId: geometry.pendingTargetSatId,
    servingSatId: geometry.servingSatId,
    primaryCellId: geometry.primaryCellId,
    placementByCellId: geometry.placementByCellId,
    satelliteWorldById: geometry.satelliteWorldById,
    frequencyReuse: geometry.frequencyReuse,
    cellFrame: geometry.cellFrame,
    maxFanCones: geometry.maxFanCones,
  });

  // The accepted homepage projection and the explicit cinema pair own candidate
  // geometry. The legacy pending-target fan is intentionally suppressed there.
  if (presentation.homepageVisualIdentity) return [];

  if (!presentation.isInterPresentation) {
    const items = resolveBudgetedSinrLiveBeamConeItems({
      existingItems: rawItems,
      satId: geometry.pendingTargetSatId,
      maxCones: geometry.maxFanCones,
      placementByCellId: geometry.placementByCellId,
      satelliteWorldById: geometry.satelliteWorldById,
      frequencyReuse: geometry.frequencyReuse,
      role: 'candidateFan',
      renderKeyPrefix: 'candidate-display-fan',
    });
    return colorizeCandidateItems(items, presentation);
  }

  // The cinema pair owns the exact primary cone. This layer supplies only the
  // remaining target-satellite fan, with the same target envelope.
  const targetOpacity = presentation.handoverPhase === 'settled'
    ? presentation.triggeredIntraPeakOpacity
    : presentation.handoverToOpacity;
  const candidateFanOpacity = presentation.candidateFanConeOpacity * targetOpacity;
  if (candidateFanOpacity <= 0) return [];
  const items = resolveBudgetedSinrLiveBeamConeItems({
    existingItems: rawItems.filter(item => item.role === 'candidateFan'),
    satId: geometry.pendingTargetSatId,
    maxCones: Math.max(0, geometry.maxFanCones - 1),
    placementByCellId: geometry.placementByCellId,
    satelliteWorldById: geometry.satelliteWorldById,
    frequencyReuse: geometry.frequencyReuse,
    role: 'candidateFan',
    renderKeyPrefix: 'cinema-candidate-display-fan',
  }).map(item => ({
    ...item,
    role: presentation.targetRole === 'serving' ? 'servingFan' as const : item.role,
    opacity: candidateFanOpacity,
  }));
  return colorizeCandidateItems(items, presentation);
}

/**
 * The source adapter keeps the hook call site explicit without exposing the
 * large `SinrLiveCellFrame` union that the original extraction generated.
 */
export interface CandidateConeSelectionInput {
  readonly presentedHandoverPairCandidate: SinrLiveCinemaHandoverCandidate | null;
  readonly showCinemaCandidateFan: boolean;
  readonly renderedCandidateSatelliteId: string | null | undefined;
  readonly primaryServingRecord: Pick<UeCellServingRecord, 'servingSatId' | 'cellId'> | null;
  readonly candidateDisplayCellFrame?: SinrLiveCellFrame;
  readonly cinemaInterDisplayCellFrame?: SinrLiveCellFrame;
  readonly normalSatelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly cinemaSatelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly frequencyReuse: number;
  readonly maxFanCones: number;
}

export function selectCandidateConeGeometry(
  input: CandidateConeSelectionInput,
): CandidateConeGeometryInput & { readonly isInterPresentation: boolean } {
  const isInterPresentation = input.showCinemaCandidateFan
    && input.presentedHandoverPairCandidate?.kind === 'inter';
  const candidate = input.presentedHandoverPairCandidate;
  return {
    isInterPresentation,
    pendingTargetSatId: isInterPresentation
      ? candidate?.toSatId
      : input.renderedCandidateSatelliteId,
    servingSatId: isInterPresentation
      ? candidate?.fromSatId
      : input.primaryServingRecord?.servingSatId,
    primaryCellId: isInterPresentation
      ? candidate?.toCellId
      : input.primaryServingRecord?.cellId,
    placementByCellId: input.placementByCellId,
    satelliteWorldById: isInterPresentation
      ? input.cinemaSatelliteWorldById
      : input.normalSatelliteWorldById,
    frequencyReuse: input.frequencyReuse,
    cellFrame: isInterPresentation
      ? input.cinemaInterDisplayCellFrame
      : input.candidateDisplayCellFrame,
    maxFanCones: input.maxFanCones,
  };
}
