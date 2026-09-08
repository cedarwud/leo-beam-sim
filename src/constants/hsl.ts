/**
 * Pure hex/HSL conversion, shared by the identity palette and the handover
 * shade. Extracted so the two are not maintained as separate copies of the
 * same formula — a divergence between them would silently change one and not
 * the other.
 *
 * Lives in `constants/` so that both `constants/servingColour.ts` and
 * `appearance/` can import DOWN into it. `appearance/` imports `constants/`;
 * never the other way round.
 */

/** Pure HSL→hex (h,s,l in [0,1]); avoids a THREE dependency in the model. */
export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): string => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export interface HslColor {
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

export function hexToHsl(color: string): HslColor | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (match === null) return null;
  const channels = match[1]!.match(/../g)!.map(channel => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels;
  const maximum = Math.max(red!, green!, blue!);
  const minimum = Math.min(red!, green!, blue!);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta <= Number.EPSILON) {
    return { hue: 0, saturation: 0, lightness };
  }
  const saturation = delta / (1 - Math.abs((2 * lightness) - 1));
  const hue = maximum === red
    ? ((green! - blue!) / delta) % 6
    : maximum === green
      ? ((blue! - red!) / delta) + 2
      : ((red! - green!) / delta) + 4;
  return {
    hue: ((hue / 6) % 1 + 1) % 1,
    saturation,
    lightness,
  };
}

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
