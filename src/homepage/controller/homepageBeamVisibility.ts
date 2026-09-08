/**
 * Homepage beam visibility boundary.
 *
 * Re-exports the canonical visibility contract from `src/appearance/beamVisibilityContract`.
 * Downstream controllers and views consume these symbols without owning the visibility decision.
 */
export {
  type HomepageBeamIdentity,
  type HomepageBeamVisibilityInput,
  homepageBeamIdentityKey,
  resolveHomepageBeamVisibility,
  filterHomepageBeamItems,
} from '../../appearance/beamVisibilityContract';
