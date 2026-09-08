/**
 * Appearance-facing satellite identity palette surface.
 *
 * The low-level palette authority lives in `constants/servingColour.ts` with
 * the serving cone/marker colour contract. This module remains the named
 * `src/appearance/` entry point used by homepage and appearance code, but it
 * intentionally contains no parallel table or allocator: changing the
 * identity hue family is one edit in the low-level authority and every
 * projection reaches that same answer through these exports.
 *
 * This preserves the layering rule: the pure appearance surface imports only
 * from the lower-level colour constants, never from a renderer or controller.
 * Beam shade, EE intensity, prominence, and handover situation remain
 * downstream projections and modifiers.
 */
export {
  HOMEPAGE_SATELLITE_COLOR_COUNT,
  HOMEPAGE_SATELLITE_HUE_FAMILIES,
  HOMEPAGE_SATELLITE_PALETTE_REFERENCE_IDS,
  SERVING_IDENTITY_SATURATION,
  colorForServingSatellite,
  homepageSatelliteBaseColor,
  homepageSatellitePaletteIndex,
  resolveHomepageSatelliteIdentityColor,
  servingIdentityPaletteColorAt,
  servingIdentityPaletteHueAt,
  servingIdentityPaletteIndex,
  servingIdentityPaletteNameAt,
} from '../constants/servingColour';
