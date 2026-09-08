/**
 * THE satellite-surface appearance table.
 *
 * ## Read this first if you were sent here by a prompt
 *
 * If the change you want is any of these:
 *
 *   - "衛星的軌跡線顏色要跟衛星本體一致 / 再淡一點 / 再濃一點"
 *   - "artifact 重播時衛星的顏色跟即時模式不一樣"
 *   - "衛星身分色改了，但軌跡線沒跟著改"
 *
 * then the change is IN THIS FILE, in {@link SATELLITE_SURFACE_MODIFIERS} (or
 * the two paling constants beside it), and nowhere else.
 *
 * ## Why this exists
 *
 * A measured audit found ONE satellite wearing two different colours at once,
 * decided by two different authorities:
 *
 *     sat-a   live marker   #e2c550   <- resolveSatelliteIdentityColor (the ladder)
 *             orbit trail   #f2d7a0   <- satelliteTint (a 4-colour legacy hash)
 *             replay marker #f2d7a0   <- satelliteTint (the same legacy hash)
 *
 * `satelliteTint` is a FNV-1a hash into a four-entry pale palette. Its own
 * docstring says collisions "are expected and acceptable", which is a fair
 * design for a background wash and a disqualifying one for identity: four
 * colours cannot name N satellites, so two spacecraft that collide become
 * indistinguishable exactly when a handover asks the viewer to tell them apart.
 * More to the point for this directory: because that palette is a SECOND table,
 * changing the identity palette in `constants/servingColour.ts` moved the marker
 * and left the trail behind — the "改了沒有用" the convergence exists to end.
 *
 * ## The invariant that must not be broken
 *
 * A row here may SHADE the identity colour. It must never REPLACE it, and it
 * must never look the colour up somewhere else. Every shade below preserves the
 * incoming HUE exactly and only moves saturation/lightness, so a viewer can
 * always still tell which spacecraft a trail belongs to. This is the same rule
 * `handoverAppearanceModifiers.ts` states for the handover table, for the same
 * reason, and this module is deliberately built in its image.
 */
import { clampUnit, hexToHsl, hslToHex } from '../constants/hsl';
import {
  resolveSatelliteIdentityColor,
  type SatelliteIdentitySources,
} from './resolveSatelliteAppearance';

/**
 * The surfaces that draw a satellite's identity.
 *
 * `marker` covers BOTH the live satellite marker and the artifact-replay marker.
 * They are one surface — a satellite marker — drawn by two mutually exclusive
 * scene sources, so they get one row, which is the whole point: before this the
 * replay lane had its own palette and drew the same spacecraft a different
 * colour than the live lane did.
 */
export type SatelliteSurface = 'marker' | 'orbitTrail';

/** How one surface modifies the satellite's identity colour. */
export interface SatelliteSurfaceModifier {
  /**
   * Hue-preserving shade applied to the identity colour, or `null` to draw the
   * identity colour untouched.
   */
  readonly shade: 'pale' | null;
  /** Why this row is what it is. Prose, for the next person holding a prompt. */
  readonly rationale: string;
}

/**
 * How pale a `'pale'` surface is.
 *
 * These numbers are not invented. They were chosen to land the trail inside the
 * measured lightness band of the legacy `SATELLITE_TINT_PALETTE` it replaces —
 * `#f2d7a0` L=0.788, `#d9b6e8` L=0.812, `#c7d1d8` L=0.814 — so the trail keeps
 * the pale, receding character it has today while now DERIVING that paleness
 * from the satellite's own identity colour instead of from a second table.
 *
 * The saturation factor is what makes a trail read as background: identity
 * colours all measure saturation ≈ 0.72, and 0.62 of that sits between the
 * legacy palette's pale gold (0.76) and its pale steel (0.18) without ever
 * reaching grey, which would throw the identity away.
 */
export const SATELLITE_TRAIL_LIGHTNESS_FLOOR = 0.72;
export const SATELLITE_TRAIL_LIGHTNESS_CEILING = 0.88;
export const SATELLITE_TRAIL_LIGHTNESS_MIX = 0.35;
export const SATELLITE_TRAIL_LIGHTNESS_LIFT = 0.53;
export const SATELLITE_TRAIL_SATURATION_FACTOR = 0.62;

/**
 * THE TABLE. One row per satellite surface.
 *
 * Current behaviour, preserved from the pre-convergence code:
 *   - `marker` draws the identity colour, which is what the live marker lane
 *     already did through `resolveSatelliteIdentityColor`;
 *   - `orbitTrail` draws a paled variant, which is the character the legacy
 *     tint palette gave it — now derived from the identity instead of looked up
 *     in a second palette.
 */
export const SATELLITE_SURFACE_MODIFIERS: {
  readonly [S in SatelliteSurface]: SatelliteSurfaceModifier;
} = {
  marker: {
    shade: null,
    rationale: 'the marker IS the satellite; it wears the identity colour with nothing on top',
  },
  orbitTrail: {
    shade: 'pale',
    rationale: 'a trail is context behind the marker, so it recedes — but it recedes from the SAME hue, so you can still tell whose trail it is',
  },
} as const;

/**
 * Lighten and desaturate a colour while keeping its hue exactly.
 *
 * Exported so a characterization can pin the paling itself, separately from the
 * table row that selects it.
 */
export function paleSatelliteSurfaceColor(color: string): string {
  const hsl = hexToHsl(color);
  // An unparseable colour is passed through untouched rather than guessed at.
  // Inventing a hue for something we could not read is the exact failure mode
  // `handoverAppearanceModifiers.ts` documents for its own shade guard.
  if (hsl === null) return color;
  const lightness = Math.min(
    SATELLITE_TRAIL_LIGHTNESS_CEILING,
    Math.max(
      SATELLITE_TRAIL_LIGHTNESS_FLOOR,
      hsl.lightness * SATELLITE_TRAIL_LIGHTNESS_MIX + SATELLITE_TRAIL_LIGHTNESS_LIFT,
    ),
  );
  return hslToHex(
    hsl.hue,
    clampUnit(hsl.saturation * SATELLITE_TRAIL_SATURATION_FACTOR),
    lightness,
  );
}

/**
 * Apply a row to an identity colour.
 *
 * The one place `paleSatelliteSurfaceColor` may be called. Every other module
 * asks for a SURFACE instead of reaching for the shade function directly —
 * which is what makes the table the single edit point.
 */
export function applySatelliteSurfaceShade(
  identityColor: string,
  modifier: SatelliteSurfaceModifier,
): string {
  if (modifier.shade === null) return identityColor;
  return paleSatelliteSurfaceColor(identityColor);
}

/**
 * THE colour a satellite surface draws: the identity ladder, then this table.
 *
 * Every satellite-surface renderer calls this and none picks its own colour.
 * Order is fixed and matches `resolveBeamAppearance`: identity FIRST, surface
 * shade on top of it. Shading something that was itself chosen by a surface is
 * how the two authorities drifted apart in the first place.
 */
export function resolveSatelliteSurfaceColor(
  satId: string,
  surface: SatelliteSurface,
  sources: SatelliteIdentitySources = {},
): string {
  return applySatelliteSurfaceShade(
    resolveSatelliteIdentityColor(satId, sources),
    SATELLITE_SURFACE_MODIFIERS[surface],
  );
}
