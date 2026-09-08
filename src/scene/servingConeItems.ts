import { type SinrLiveCellBeamConeRenderItem } from '../viz/SinrLiveCellBeamCones';
import { filterHomepageBeamItems as filterHomepageBeamItemsBySatellite } from '../homepage/controller/homepageBeamVisibility';
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
  readonly restrictHomepageBeamItems: (
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
 */
export function resolveServingConeItems(
  input: ServingConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { geometry, presentation } = input;
  const hero = geometry.displayHeroRecord;
  if (!presentation.showSinrLiveCellBeams || !presentation.renderServingField) return [];
  if (
    presentation.hideNormalBeamField
    && (presentation.teachingLectureFieldCleared || !presentation.multiCandidateCentralOverlayActive)
    && !presentation.preserveConfiguredServingFan
  ) return [];
  if (
    !presentation.homepageVisualIdentity
    && !presentation.showNonServingCones
    && geometry.focusSatIds !== null
    && geometry.focusSatIds.size === 0
  ) return [];

  const items = resolveServingConeGeometry(geometry);
  // COLOUR is decided by `src/appearance/`, never here. This lane's items are
  // all `serving: true` (every builder that feeds `resolveServingConeGeometry`
  // hard-codes it), so `prominence: 'serving'` reproduces the exact
  // `isServingOrCandidate` flag the hand-rolled call used to pass.
  const identityItems = paintConeItems(items, {
    resolveIdentityColor: presentation.resolveSceneAcceptedBeamColor,
    prominence: 'serving',
  });
  const keepPrimary = (
    !presentation.hidePrimaryServingBeam
    || presentation.preserveConfiguredServingFan
    || presentation.multiCandidateCentralOverlayActive
    || presentation.homepageVisualIdentity
    || hero === null
  );
  const visibleItems = keepPrimary || hero === null
    ? identityItems
    : identityItems.filter(item => item.satId !== hero.servingSatId || item.cellId !== hero.cellId);

  return presentation.homepageVisualIdentity
    ? filterHomepageBeamItemsBySatellite(
      visibleItems,
      presentation.homepageBeamVisibility,
      presentation.homepageBeamFanSatelliteIds,
    )
    : presentation.restrictHomepageBeamItems(visibleItems);
}
