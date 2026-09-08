/**
 * THE beam visibility contract.
 *
 * ## Why this module exists
 *
 * Like colour before it, beam visibility suffered from scattered ownership:
 * changing 「改哪些波束/錐體要顯示在畫面上」 required opening five separate files
 * across `homepage/controller/`, `scene/`, and `viz/`. Call sites substituted their
 * own answers via duplicated ternary expressions (`?:`), nullish coalescing, and
 * inline boolean operators.
 *
 * A wrongly hidden or wrongly shown beam is more visually jarring than a beam
 * one shade off. This module provides ONE owning authority for the question:
 *
 *   > "Should this beam or cone item be rendered?"
 *
 * Downstream components delegate to this module rather than branching locally.
 *
 * ## Layering
 *
 * `src/appearance/` sits at the bottom, beside `src/constants/`. `scene/`,
 * `viz/`, `homepage/` and `ui/` import DOWN into it; it imports nothing from
 * them. It is pure by construction: no React, no hooks, no refs, and no
 * module-level mutable state. All decisions are deterministic functions of
 * explicit inputs.
 */

/**
 * Identity of a beam eligible for homepage display.
 * Structural shape shared across controllers and renderers.
 */
export interface HomepageBeamIdentity {
  readonly satelliteId: string;
  /** Earth-fixed cell id; the live renderer uses the same value as its beam key. */
  readonly cellId: number;
  /** Exact link-budget beam id when the transition carries one. */
  readonly beamId?: number | null;
}

/**
 * Explicit endpoints that are permitted to own cone geometry on the homepage.
 * Only these 8 story-relevant beam roles may draw cones; ambient/background
 * candidates remain marker or rail evidence only.
 */
export interface HomepageBeamVisibilityInput {
  readonly servingBeam?: HomepageBeamIdentity | null;
  readonly preparedCandidateBeam?: HomepageBeamIdentity | null;
  readonly presentationFromBeam?: HomepageBeamIdentity | null;
  readonly presentationToBeam?: HomepageBeamIdentity | null;
  readonly cinemaFromBeam?: HomepageBeamIdentity | null;
  readonly cinemaToBeam?: HomepageBeamIdentity | null;
  readonly recentFromBeam?: HomepageBeamIdentity | null;
  readonly recentToBeam?: HomepageBeamIdentity | null;
}

/**
 * Build the canonical lookup key for a beam identity.
 * When beamId is absent/null, the key addresses the entire cell.
 */
export function homepageBeamIdentityKey(identity: HomepageBeamIdentity): string {
  const cellKey = `${identity.satelliteId}|${identity.cellId}`;
  return identity.beamId === null || identity.beamId === undefined
    ? cellKey
    : `${cellKey}|${identity.beamId}`;
}

function addBeamIdentity(
  identities: Set<string>,
  identity: HomepageBeamIdentity | null | undefined,
): void {
  if (
    identity !== null
    && identity !== undefined
    && typeof identity.satelliteId === 'string'
    && identity.satelliteId.trim().length > 0
    && Number.isInteger(identity.cellId)
    && (
      identity.beamId === null
      || identity.beamId === undefined
      || Number.isInteger(identity.beamId)
    )
  ) {
    identities.add(homepageBeamIdentityKey(identity));
  }
}

/**
 * Resolve the exact allow-list of beam identity keys permitted to draw cones
 * on the homepage story canvas.
 */
export function resolveHomepageBeamVisibility(
  input: HomepageBeamVisibilityInput,
): ReadonlySet<string> {
  const identities = new Set<string>();
  addBeamIdentity(identities, input.servingBeam);
  addBeamIdentity(identities, input.preparedCandidateBeam);
  addBeamIdentity(identities, input.presentationFromBeam);
  addBeamIdentity(identities, input.presentationToBeam);
  addBeamIdentity(identities, input.cinemaFromBeam);
  addBeamIdentity(identities, input.cinemaToBeam);
  addBeamIdentity(identities, input.recentFromBeam);
  addBeamIdentity(identities, input.recentToBeam);
  return identities;
}

/**
 * Keep the same item shape while dropping geometry from non-story beam pairs.
 *
 * A candidate satellite is never permitted to flood the scene with its full fan.
 * Only the serving spacecraft may use the `allowAllBeamSatelliteIds` escape hatch
 * for its configured 1/7/19 multibeam view.
 */
export function filterHomepageBeamItems<T extends {
  readonly satId: string;
  readonly cellId: number;
  readonly beamId?: number | null;
}>(
  items: readonly T[],
  allowedBeamIdentities: ReadonlySet<string>,
  allowAllBeamSatelliteIds: ReadonlySet<string> = new Set(),
): readonly T[] {
  return Object.freeze(items.filter(item => {
    if (allowAllBeamSatelliteIds.has(item.satId)) return true;

    const cellIdentity = { satelliteId: item.satId, cellId: item.cellId };
    if (allowedBeamIdentities.has(homepageBeamIdentityKey(cellIdentity))) return true;

    return item.beamId !== null
      && item.beamId !== undefined
      && allowedBeamIdentities.has(homepageBeamIdentityKey({ ...cellIdentity, beamId: item.beamId }));
  }));
}

/** Local alias previously used at scene call sites before consolidation. */
export const filterHomepageBeamItemsBySatellite = filterHomepageBeamItems;

export interface RestrictHomepageBeamItemsOptions {
  readonly homepageVisualIdentity: boolean;
  readonly allowedBeamIdentities: ReadonlySet<string>;
  readonly allowAllBeamSatelliteIds?: ReadonlySet<string>;
}

/**
 * The single restriction gateway.
 *
 * When homepage visual identity is active, non-story items are filtered out.
 * When inactive (e.g. legacy/sandbox modes), items pass through untouched.
 */
export function restrictHomepageBeamItems<T extends {
  readonly satId: string;
  readonly cellId: number;
  readonly beamId?: number | null;
}>(
  items: readonly T[],
  options: RestrictHomepageBeamItemsOptions,
): readonly T[] {
  if (!options.homepageVisualIdentity) return items;
  return filterHomepageBeamItems(
    items,
    options.allowedBeamIdentities,
    options.allowAllBeamSatelliteIds,
  );
}

/**
 * Focus satellite decision for the primary serving cone field.
 *
 * In homepage mode, focus is restricted to the target satellites.
 * In legacy modes, toggling `showNonServingCones` opens the focus to all satellites (`null`).
 */
export function resolveServingConeFocusSatIds(
  homepageVisualIdentity: boolean,
  showNonServingCones: boolean,
  targetSatIds: ReadonlySet<string> | null,
): ReadonlySet<string> | null {
  if (homepageVisualIdentity) return targetSatIds;
  return showNonServingCones ? null : targetSatIds;
}

/**
 * Budgeting decision for the serving fan.
 *
 * The fan is budgeted whenever homepage visual identity is active or
 * `showNonServingCones` is off.
 */
export function resolveServingConeBudgetFan(
  homepageVisualIdentity: boolean,
  showNonServingCones: boolean,
): boolean {
  return homepageVisualIdentity || !showNonServingCones;
}

/**
 * Focus satellite decision for secondary/hopping non-serving cones.
 *
 * When `showNonServingCones` is true, all satellites are admitted (`null`).
 * Otherwise, non-serving hopping cones are limited to `targetSatIds`.
 */
export function resolveNonServingConeFocusSatIds(
  showNonServingCones: boolean,
  targetSatIds: ReadonlySet<string> | null,
): ReadonlySet<string> | null {
  return showNonServingCones ? null : targetSatIds;
}

/**
 * Pure predicate governing whether the serving cone field should be rendered.
 */
export function shouldRenderServingConeField(presentation: {
  readonly showSinrLiveCellBeams: boolean;
  readonly renderServingField: boolean;
  readonly hideNormalBeamField: boolean;
  readonly teachingLectureFieldCleared: boolean;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly preserveConfiguredServingFan: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly showNonServingCones: boolean;
  readonly focusSatIds: ReadonlySet<string> | null;
}): boolean {
  if (!presentation.showSinrLiveCellBeams || !presentation.renderServingField) return false;
  if (
    presentation.hideNormalBeamField
    && (presentation.teachingLectureFieldCleared || !presentation.multiCandidateCentralOverlayActive)
    && !presentation.preserveConfiguredServingFan
  ) return false;
  if (
    !presentation.homepageVisualIdentity
    && !presentation.showNonServingCones
    && presentation.focusSatIds !== null
    && presentation.focusSatIds.size === 0
  ) return false;
  return true;
}

/**
 * Pure predicate governing whether the primary serving beam should be retained.
 */
export function shouldKeepPrimaryServingBeam(presentation: {
  readonly hidePrimaryServingBeam: boolean;
  readonly preserveConfiguredServingFan: boolean;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly heroRecordPresent: boolean;
}): boolean {
  return (
    !presentation.hidePrimaryServingBeam
    || presentation.preserveConfiguredServingFan
    || presentation.multiCandidateCentralOverlayActive
    || presentation.homepageVisualIdentity
    || !presentation.heroRecordPresent
  );
}

/**
 * Pure predicate governing whether non-serving cones should be rendered.
 */
export function shouldRenderNonServingCones(options: {
  readonly showSinrLiveCellBeams: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly hideNormalBeamField: boolean;
  readonly showNonServingCones: boolean;
  readonly targetSatIds: ReadonlySet<string> | null;
}): boolean {
  if (
    !options.showSinrLiveCellBeams
    || options.homepageVisualIdentity
    || options.hideNormalBeamField
  ) return false;
  if (!options.showNonServingCones && options.targetSatIds !== null && options.targetSatIds.size === 0) {
    return false;
  }
  return true;
}
