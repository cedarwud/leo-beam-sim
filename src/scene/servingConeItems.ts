import { type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import {
  restrictHomepageBeamItems,
  shouldKeepPrimaryServingBeam,
  shouldRenderServingConeField,
} from '../appearance/beamVisibilityContract';
import { resolveServingConeGeometry } from './servingConeGeometry';
import { paintConeItems } from '../appearance/paintConeItems';

export type ServingConeGeometryInput = Parameters<typeof resolveServingConeGeometry>[0];

export interface ServingConePresentationInput {
  readonly showSinrLiveCellBeams: boolean;
  readonly renderServingField: boolean;
  readonly showNonServingCones: boolean;
  readonly hideNormalBeamField: boolean;
  readonly hidePrimaryServingBeam: boolean;
  readonly preserveConfiguredServingFan: boolean;
  readonly teachingLectureFieldCleared: boolean;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly homepageBeamVisibility: ReadonlySet<string>;
  readonly homepageBeamFanSatelliteIds: ReadonlySet<string>;
  readonly resolveSceneAcceptedBeamColor: (
    satelliteId: string,
    beamId: number,
    isServingOrCandidate?: boolean,
  ) => string;
  readonly restrictHomepageBeamItems?: (
    items: readonly SinrLiveCellBeamConeRenderItem[],
  ) => readonly SinrLiveCellBeamConeRenderItem[];
}

export interface ServingConeInput {
  readonly geometry: ServingConeGeometryInput;
  readonly presentation: ServingConePresentationInput;
}

/**
 * Pure serving-cone projection. Geometry and display policy are explicit inputs;
 * no React state or hook lifecycle is visible at this seam.
 * Visibility filtering delegates entirely to `src/appearance/beamVisibilityContract`.
 */
export function resolveServingConeItems(
  input: ServingConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { geometry, presentation } = input;
  const hero = geometry.displayHeroRecord;
  if (!shouldRenderServingConeField({
    showSinrLiveCellBeams: presentation.showSinrLiveCellBeams,
    renderServingField: presentation.renderServingField,
    hideNormalBeamField: presentation.hideNormalBeamField,
    teachingLectureFieldCleared: presentation.teachingLectureFieldCleared,
    multiCandidateCentralOverlayActive: presentation.multiCandidateCentralOverlayActive,
    preserveConfiguredServingFan: presentation.preserveConfiguredServingFan,
    homepageVisualIdentity: presentation.homepageVisualIdentity,
    showNonServingCones: presentation.showNonServingCones,
    focusSatIds: geometry.focusSatIds,
  })) return [];

  const items = resolveServingConeGeometry(geometry);
  // COLOUR is decided by `src/appearance/`, never here. This lane's items are
  // all `serving: true` (every builder that feeds `resolveServingConeGeometry`
  // hard-codes it), so `prominence: 'serving'` reproduces the exact
  // `isServingOrCandidate` flag the hand-rolled call used to pass.
  const identityItems = paintConeItems(items, {
    resolveIdentityColor: presentation.resolveSceneAcceptedBeamColor,
    prominence: 'serving',
  });
  const keepPrimary = shouldKeepPrimaryServingBeam({
    hidePrimaryServingBeam: presentation.hidePrimaryServingBeam,
    preserveConfiguredServingFan: presentation.preserveConfiguredServingFan,
    multiCandidateCentralOverlayActive: presentation.multiCandidateCentralOverlayActive,
    homepageVisualIdentity: presentation.homepageVisualIdentity,
    heroRecordPresent: hero !== null,
  });
  const visibleItems = keepPrimary || hero === null
    ? identityItems
    : identityItems.filter(item => item.satId !== hero.servingSatId || item.cellId !== hero.cellId);

  return restrictHomepageBeamItems(visibleItems, {
    homepageVisualIdentity: presentation.homepageVisualIdentity,
    allowedBeamIdentities: presentation.homepageBeamVisibility,
    allowAllBeamSatelliteIds: presentation.homepageBeamFanSatelliteIds,
  });
}
