/**
 * WHAT the intra-handover shade actually is.
 *
 * Its companion `handoverAppearanceModifiers.ts` decides WHICH shade a given
 * (kind, side) gets; this file decides what "darker source" and "brighter
 * target" mean in numbers. The two used to live in different directories, so
 * "make the intra target a bit brighter" was a two-file edit — exactly the
 * shape of change the owner reports failing at.
 *
 * Moved verbatim from `constants/servingColour.ts`; the arithmetic is
 * unchanged, so no pixel moves as a result of this file existing.
 */
import { clampUnit, hexToHsl, hslToHex } from '../constants/hsl';

/**
 * Make the two sides of an intra-satellite handover readable for the short
 * transition envelope while retaining the allocated satellite hue.  This is
 * intentionally a transient render treatment: steady-state beam colours and
 * the right-rail identity allocation continue to use their original tokens.
 * The source is a restrained darker shade and the target is a brighter shade;
 * both are derived from the same input hue, so the change cannot be mistaken
 * for an inter-satellite identity swap or for a role colour.
 */
export function emphasizeIntraHandoverColor(
  color: string,
  side: 'source' | 'target',
): string {
  const hsl = hexToHsl(color);
  if (hsl === null) return color;
  const saturation = clampUnit(Math.max(0.78, Math.min(0.92, hsl.saturation * 1.12)));
  const lightness = side === 'source'
    ? Math.min(0.62, Math.max(0.42, hsl.lightness * 0.64 + 0.12))
    : Math.min(0.94, Math.max(0.74, hsl.lightness * 0.50 + 0.48));
  return hslToHex(hsl.hue, saturation, lightness);
}
