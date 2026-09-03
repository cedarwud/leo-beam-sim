/**
 * Homepage-only beam visibility boundary.
 *
 * This is a display filter over already-resolved identities. It does not
 * choose a candidate, rank a beam, or change the handover decision. The root
 * scene may show the current serving beam and the exact handover pair that
 * already owns the presentation; other qualifying candidates stay marker/rail
 * evidence only and cannot flash a different beam into the scene.
 */

export interface HomepageBeamIdentity {
  readonly satelliteId: string;
  /** Earth-fixed cell id; the live renderer uses the same value as its beam key. */
  readonly cellId: number;
  /** Exact link-budget beam id when the transition carries one. */
  readonly beamId?: number | null;
}

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

/** Resolve the exact beam pairs allowed to own homepage cone geometry. */
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

/** Keep the same item shape while dropping geometry from non-story beam pairs. */
export function filterHomepageBeamItems<T extends {
  readonly satId: string;
  readonly cellId: number;
  readonly beamId?: number | null;
}>(
  items: readonly T[],
  allowedBeamIdentities: ReadonlySet<string>,
  /**
   * The current serving spacecraft owns a bounded multibeam fan.  Keep that
   * fan visible for the configured 1/7/19 serving-beam view, while every
   * non-serving spacecraft still has to pass the exact (satellite, cell[, beam])
   * allow-list above.  This is deliberately a separate, explicit escape
   * hatch; allowing an entire candidate satellite here would recreate the
   * flashing fan that this boundary is meant to stop.
   */
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
