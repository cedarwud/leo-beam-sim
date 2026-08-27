/**
 * Presentation-only identity allocation for the homepage handover episode.
 *
 * This module deliberately knows only satellite IDs, beam IDs, and visual
 * metadata. It does not inspect or decide scientific state, handover status,
 * ranking, or role. A caller supplies a prior allocation when it wants to
 * preserve an episode's reservations across a new presentation frame.
 */

export const DEFAULT_HANDOVER_VISUAL_IDENTITY_NORMAL_DISPLAY_BUDGET = 3 as const;
export const HANDOVER_VISUAL_IDENTITY_MIN_CONTRAST_RATIO = 3 as const;

/** Conservative solid-color preflight samples; browser compositing is still required. */
const DARK_SCENE_CONTRAST_PREFLIGHT = '#07111f';
const DARK_RAIL_CONTRAST_PREFLIGHT = '#0e1726';
const OVERFLOW_FALLBACK_COLOR = '#94a3b8';
const OVERFLOW_FALLBACK_HUE_DEGREES = 215;
const DEFAULT_BEAM_CHROMA = 0.14;

export interface HandoverVisualPaletteEntry {
  readonly cssColor: string;
  /** Optional descriptive metadata for a supplied palette token. */
  readonly colorName?: string;
  /** Perceptual hue used to derive same-satellite beam shades. */
  readonly hueDegrees?: number;
  readonly colorSpace?: 'oklch' | 'provided';
}

export type HandoverVisualPaletteInput = readonly (
  | string
  | HandoverVisualPaletteEntry
)[];

export type HandoverVisualIdentityPattern =
  | 'solid'
  | 'long-dash'
  | 'short-dash'
  | 'dash-dot'
  | 'dotted'
  | 'double-line'
  | 'cross-hatch'
  | 'zigzag';

export type HandoverVisualContrastStatus = 'pass' | 'fail' | 'unverified';

export interface HandoverVisualIdentityFallback {
  readonly kind: 'palette-exhausted';
  readonly colorIsNotUnique: true;
  readonly reason: 'no-unreserved-palette-slot';
  readonly instruction: string;
}

export interface HandoverVisualIdentityAccessibility {
  readonly textLabel: string;
  readonly ariaLabel: string;
  readonly glyph: string;
  readonly pattern: HandoverVisualIdentityPattern;
  readonly colorIsNotSoleCue: true;
  readonly minimumContrastRatio: typeof HANDOVER_VISUAL_IDENTITY_MIN_CONTRAST_RATIO;
  readonly contrastStatus: HandoverVisualContrastStatus;
}

/** One stable presentation identity for one satellite. */
export interface HandoverSatelliteVisualIdentity {
  readonly satelliteId: string;
  /** Shared token: valid as a CSS color and as a THREE.Color constructor input. */
  readonly color: string;
  readonly cssColor: string;
  readonly threeColor: string;
  readonly colorSpace: 'oklch' | 'provided' | 'fallback';
  readonly colorName: string;
  readonly hueDegrees: number | null;
  readonly paletteIndex: number | null;
  /** Alias for consumers that call the deterministic slot a palette slot. */
  readonly paletteSlot: number | null;
  readonly isOverflow: boolean;
  readonly overflowIndex: number | null;
  readonly glyph: string;
  readonly pattern: HandoverVisualIdentityPattern;
  readonly label: string;
  readonly ariaLabel: string;
  readonly contrastRatioAgainstDarkBackground: number | null;
  readonly contrastRatioAgainstDarkRail: number | null;
  readonly contrastStatus: HandoverVisualContrastStatus;
  /** True for overflow identities whose fallback color may repeat. */
  readonly colorMayRepeat: boolean;
  readonly fallback: HandoverVisualIdentityFallback | null;
  readonly accessibility: HandoverVisualIdentityAccessibility;
}

/** A beam shade derived only from its satellite identity and beam ID. */
export interface HandoverBeamVisualIdentity {
  readonly satelliteId: string;
  readonly beamId: number;
  /** Shared token: valid as a CSS color and as a THREE.Color constructor input. */
  readonly color: string;
  readonly cssColor: string;
  readonly threeColor: string;
  readonly colorSpace: 'oklch';
  readonly hueDegrees: number;
  readonly lightness: number;
  readonly shadeIndex: number;
  readonly glyph: string;
  readonly pattern: HandoverVisualIdentityPattern;
  readonly label: string;
  readonly ariaLabel: string;
  readonly contrastRatioAgainstDarkBackground: number | null;
  readonly contrastRatioAgainstDarkRail: number | null;
  readonly contrastStatus: HandoverVisualContrastStatus;
  /** True when the finite shade set is intentionally reused; beam ID remains authoritative. */
  readonly colorMayRepeat: boolean;
  readonly accessibility: HandoverVisualIdentityAccessibility;
}

export type HandoverVisualIdentityAssignment = HandoverSatelliteVisualIdentity;

export interface HandoverVisualIdentityAllocation {
  readonly schemaVersion: 'handover-visual-identity-v1';
  readonly episodeId: string | null;
  readonly servingSatelliteId: string | null;
  /** Serving first, then the remaining IDs in deterministic lexical order. */
  readonly orderedSatelliteIds: readonly string[];
  readonly normalDisplayBudget: number;
  readonly paletteCapacity: number;
  readonly overflowSupported: true;
  readonly identities: readonly HandoverSatelliteVisualIdentity[];
  readonly identitiesBySatelliteId: Readonly<Record<string, HandoverSatelliteVisualIdentity>>;
  /** Includes retired identities so their palette reservations remain held. */
  readonly assignments: Readonly<Record<string, HandoverVisualIdentityAssignment>>;
  readonly overflowSatelliteIds: readonly string[];
  readonly reservedSatelliteIds: readonly string[];
  readonly beamIdentitiesBySatelliteId: Readonly<
    Record<string, Readonly<Record<string, HandoverBeamVisualIdentity>>>
  >;
  /** Includes retired beam variants so a later pin cannot recolour prior beams. */
  readonly beamAssignmentsBySatelliteId: Readonly<
    Record<string, Readonly<Record<string, HandoverBeamVisualIdentity>>>
  >;
}

export interface AllocateHandoverVisualIdentitiesInput {
  readonly episodeId: string;
  readonly servingSatelliteId?: string | null;
  readonly satelliteIds: readonly string[];
  readonly beamIdsBySatellite?: Readonly<Record<string, readonly number[]>>;
  readonly palette?: HandoverVisualPaletteInput;
  readonly normalDisplayBudget?: number;
  readonly previousAllocation?: HandoverVisualIdentityAllocation | null;
}

interface NormalizedPaletteEntry {
  readonly cssColor: string;
  readonly colorName: string;
  readonly hueDegrees: number;
  readonly colorSpace: 'oklch' | 'provided';
}

interface OklchColor {
  readonly lightness: number;
  readonly chroma: number;
  readonly hueDegrees: number;
}

const SATELLITE_GLYPHS = ['●', '◆', '■', '▲', '✦', '⬢', '✚', '⬟'] as const;
const SATELLITE_PATTERNS: readonly HandoverVisualIdentityPattern[] = [
  'solid',
  'long-dash',
  'short-dash',
  'dash-dot',
  'dotted',
  'double-line',
  'cross-hatch',
  'zigzag',
];
const BEAM_GLYPHS = ['○', '◇', '□', '△', '✧', '⬡', '＋', '⋄'] as const;
const BEAM_PATTERNS: readonly HandoverVisualIdentityPattern[] = [
  'solid',
  'short-dash',
  'long-dash',
  'dotted',
  'dash-dot',
  'double-line',
  'cross-hatch',
  'zigzag',
];
const BEAM_LIGHTNESSES = [0.59, 0.64, 0.69, 0.74, 0.78, 0.62, 0.67, 0.72] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeHueDegrees(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError(`hueDegrees must be finite; got ${value}`);
  return ((value % 360) + 360) % 360;
}

function stableHashUint32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stable hash start used by the allocator before linear probing. */
export function handoverVisualPaletteStartIndex(
  satelliteId: string,
  paletteSize: number,
): number {
  if (!Number.isInteger(paletteSize) || paletteSize <= 0) {
    throw new RangeError(`paletteSize must be a positive integer; got ${paletteSize}`);
  }
  return stableHashUint32(satelliteId) % paletteSize;
}

function compareStableIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertSatelliteId(value: string, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty satellite ID`);
  }
  return value;
}

function normalizeBeamId(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new TypeError(`beamId must be a non-negative finite integer; got ${value}`);
  }
  return value;
}

function canonicalHexColor(value: string): string | null {
  const rgb = parseHexColor(value);
  if (rgb === null) return null;
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

function parseHexColor(value: string): readonly [number, number, number] | null {
  const compact = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(compact)) {
    return [
      Number.parseInt(`${compact[1]}${compact[1]}`, 16),
      Number.parseInt(`${compact[2]}${compact[2]}`, 16),
      Number.parseInt(`${compact[3]}${compact[3]}`, 16),
    ];
  }
  if (!/^#[0-9a-f]{6}$/.test(compact)) return null;
  return [
    Number.parseInt(compact.slice(1, 3), 16),
    Number.parseInt(compact.slice(3, 5), 16),
    Number.parseInt(compact.slice(5, 7), 16),
  ];
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(value: string): number | null {
  const rgb = parseHexColor(value);
  if (rgb === null) return null;
  const [red, green, blue] = rgb;
  return (0.2126 * srgbChannelToLinear(red))
    + (0.7152 * srgbChannelToLinear(green))
    + (0.0722 * srgbChannelToLinear(blue));
}

function contrastRatio(foreground: string, background: string): number | null {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return null;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastStatus(
  againstDarkBackground: number | null,
  againstDarkRail: number | null,
): HandoverVisualContrastStatus {
  if (againstDarkBackground === null || againstDarkRail === null) return 'unverified';
  return againstDarkBackground >= HANDOVER_VISUAL_IDENTITY_MIN_CONTRAST_RATIO
    && againstDarkRail >= HANDOVER_VISUAL_IDENTITY_MIN_CONTRAST_RATIO
    ? 'pass'
    : 'fail';
}

function hueFromHex(value: string): number | null {
  const rgb = parseHexColor(value);
  if (rgb === null) return null;
  const [redByte, greenByte, blueByte] = rgb;
  const red = redByte / 255;
  const green = greenByte / 255;
  const blue = blueByte / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (delta === 0) return 0;
  let hue: number;
  if (maximum === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (maximum === green) {
    hue = 60 * (((blue - red) / delta) + 2);
  } else {
    hue = 60 * (((red - green) / delta) + 4);
  }
  return normalizeHueDegrees(hue);
}

function hueForProvidedColor(value: string, satelliteId: string): number {
  return hueFromHex(value) ?? ((stableHashUint32(`hue:${satelliteId}`) % 360) + 360) % 360;
}

function oklabToLinearRgb(color: OklchColor, chroma = color.chroma): readonly [number, number, number] {
  const hueRadians = normalizeHueDegrees(color.hueDegrees) * Math.PI / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);
  const lightness = color.lightness;
  const lPrime = lightness + (0.3963377774 * a) + (0.2158037573 * b);
  const mPrime = lightness - (0.1055613458 * a) - (0.0638541728 * b);
  const sPrime = lightness - (0.0894841775 * a) - (1.291485548 * b);
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  return [
    (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s),
    (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s),
    (-0.0041960863 * l) - (0.7034186147 * m) + (1.707614701 * s),
  ];
}

function linearToSrgb(value: number): number {
  const bounded = clamp(value, 0, 1);
  return bounded <= 0.0031308
    ? 12.92 * bounded
    : (1.055 * (bounded ** (1 / 2.4))) - 0.055;
}

function inGamut(rgb: readonly [number, number, number]): boolean {
  return rgb.every(channel => channel >= 0 && channel <= 1);
}

/** Convert an OKLCH color to a gamut-safe six-digit CSS/THREE hex token. */
function oklchToHex(color: OklchColor): string {
  let chroma = color.chroma;
  let rgb = oklabToLinearRgb(color, chroma);
  if (!inGamut(rgb)) {
    let minimum = 0;
    let maximum = chroma;
    for (let iteration = 0; iteration < 18; iteration += 1) {
      const midpoint = (minimum + maximum) / 2;
      const candidate = oklabToLinearRgb(color, midpoint);
      if (inGamut(candidate)) {
        minimum = midpoint;
        rgb = candidate;
      } else {
        maximum = midpoint;
      }
    }
    chroma = minimum;
    rgb = oklabToLinearRgb(color, chroma);
  }
  const channels = rgb.map(channel => Math.round(clamp(linearToSrgb(channel), 0, 1) * 255));
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

const DEFAULT_PALETTE_HUES: readonly { readonly name: string; readonly hueDegrees: number }[] = [
  { name: 'coral', hueDegrees: 24 },
  { name: 'gold', hueDegrees: 62 },
  { name: 'green', hueDegrees: 136 },
  { name: 'cyan', hueDegrees: 188 },
  { name: 'blue', hueDegrees: 232 },
  { name: 'violet', hueDegrees: 276 },
  { name: 'magenta', hueDegrees: 321 },
  { name: 'rose', hueDegrees: 350 },
];

export const DEFAULT_HANDOVER_VISUAL_IDENTITY_PALETTE: readonly HandoverVisualPaletteEntry[] = Object.freeze(
  DEFAULT_PALETTE_HUES.map(({ name, hueDegrees }) => Object.freeze({
    cssColor: oklchToHex({ lightness: 0.72, chroma: DEFAULT_BEAM_CHROMA, hueDegrees }),
    colorName: name,
    hueDegrees,
    colorSpace: 'oklch' as const,
  })),
);

function normalizePalette(input: HandoverVisualPaletteInput | undefined): readonly NormalizedPaletteEntry[] {
  const source = input ?? DEFAULT_HANDOVER_VISUAL_IDENTITY_PALETTE;
  if (source.length === 0) {
    throw new RangeError('handover visual identity palette must contain at least one color');
  }
  const seenColors = new Set<string>();
  return source.map((entry, index) => {
    const paletteEntry: HandoverVisualPaletteEntry = typeof entry === 'string'
      ? { cssColor: entry }
      : entry;
    if (typeof paletteEntry.cssColor !== 'string' || paletteEntry.cssColor.trim().length === 0) {
      throw new TypeError(`palette entry ${index} must contain a non-empty cssColor`);
    }
    const cssColor = canonicalHexColor(paletteEntry.cssColor);
    if (cssColor === null) {
      throw new TypeError(`palette entry ${index} must be a #RGB or #RRGGBB color usable by CSS and THREE.Color`);
    }
    const colorKey = cssColor.toLowerCase();
    if (seenColors.has(colorKey)) {
      throw new RangeError(`palette contains duplicate color token ${cssColor}`);
    }
    seenColors.add(colorKey);
    const contrast = assignmentContrast(cssColor);
    if (contrast.contrastStatus !== 'pass') {
      throw new RangeError(`palette entry ${index} does not pass the 3:1 dark-surface contrast preflight`);
    }
    return Object.freeze({
      cssColor,
      colorName: paletteEntry.colorName ?? `palette-${index + 1}`,
      hueDegrees: normalizeHueDegrees(
        paletteEntry.hueDegrees ?? hueForProvidedColor(cssColor, `palette-${index}`),
      ),
      colorSpace: paletteEntry.colorSpace ?? 'provided',
    });
  });
}

function normalizedBudget(value: number | undefined): number {
  const budget = value ?? DEFAULT_HANDOVER_VISUAL_IDENTITY_NORMAL_DISPLAY_BUDGET;
  if (!Number.isFinite(budget) || budget < 1) {
    throw new RangeError(`normalDisplayBudget must be at least 1; got ${budget}`);
  }
  return Math.floor(budget);
}

function orderedSatelliteIds(
  satelliteIds: readonly string[],
  servingSatelliteId: string | null,
): readonly string[] {
  const unique = new Set<string>();
  for (const satelliteId of satelliteIds) {
    unique.add(assertSatelliteId(satelliteId, 'satelliteIds entry'));
  }
  if (servingSatelliteId !== null) unique.add(servingSatelliteId);
  const remaining = [...unique].filter(satelliteId => satelliteId !== servingSatelliteId);
  remaining.sort(compareStableIds);
  return Object.freeze(servingSatelliteId === null ? remaining : [servingSatelliteId, ...remaining]);
}

function assignmentContrast(
  color: string,
): Pick<
  HandoverSatelliteVisualIdentity,
  'contrastRatioAgainstDarkBackground' | 'contrastRatioAgainstDarkRail' | 'contrastStatus'
> {
  const againstDarkBackground = contrastRatio(color, DARK_SCENE_CONTRAST_PREFLIGHT);
  const againstDarkRail = contrastRatio(color, DARK_RAIL_CONTRAST_PREFLIGHT);
  return {
    contrastRatioAgainstDarkBackground: againstDarkBackground,
    contrastRatioAgainstDarkRail: againstDarkRail,
    contrastStatus: contrastStatus(againstDarkBackground, againstDarkRail),
  };
}

function satelliteGlyph(index: number): string {
  return SATELLITE_GLYPHS[((index % SATELLITE_GLYPHS.length) + SATELLITE_GLYPHS.length) % SATELLITE_GLYPHS.length] ?? '●';
}

function satellitePattern(index: number): HandoverVisualIdentityPattern {
  return SATELLITE_PATTERNS[((index % SATELLITE_PATTERNS.length) + SATELLITE_PATTERNS.length) % SATELLITE_PATTERNS.length] ?? 'solid';
}

function buildAccessibility(
  textLabel: string,
  ariaLabel: string,
  glyph: string,
  pattern: HandoverVisualIdentityPattern,
  status: HandoverVisualContrastStatus,
): HandoverVisualIdentityAccessibility {
  return Object.freeze({
    textLabel,
    ariaLabel,
    glyph,
    pattern,
    colorIsNotSoleCue: true as const,
    minimumContrastRatio: HANDOVER_VISUAL_IDENTITY_MIN_CONTRAST_RATIO,
    contrastStatus: status,
  });
}

function buildPaletteAssignment(
  satelliteId: string,
  paletteIndex: number,
  entry: NormalizedPaletteEntry,
): HandoverVisualIdentityAssignment {
  const color = entry.cssColor;
  const contrast = assignmentContrast(color);
  const glyph = satelliteGlyph(paletteIndex);
  const pattern = satellitePattern(paletteIndex);
  const label = `Satellite ${satelliteId}`;
  const ariaLabel = `${label}; identity glyph ${glyph}; ${pattern} pattern; ${entry.colorName} color; use the label and pattern as identity cues.`;
  return Object.freeze({
    satelliteId,
    color,
    cssColor: color,
    threeColor: color,
    colorSpace: entry.colorSpace,
    colorName: entry.colorName,
    hueDegrees: entry.hueDegrees,
    paletteIndex,
    paletteSlot: paletteIndex,
    isOverflow: false,
    overflowIndex: null,
    glyph,
    pattern,
    label,
    ariaLabel,
    ...contrast,
    colorMayRepeat: false,
    fallback: null,
    accessibility: buildAccessibility(label, ariaLabel, glyph, pattern, contrast.contrastStatus),
  });
}

function buildOverflowAssignment(
  satelliteId: string,
  overflowIndex: number,
): HandoverVisualIdentityAssignment {
  const color = OVERFLOW_FALLBACK_COLOR;
  const contrast = assignmentContrast(color);
  const glyph = satelliteGlyph(overflowIndex);
  const pattern = satellitePattern(overflowIndex);
  const label = `Satellite ${satelliteId}`;
  const fallback: HandoverVisualIdentityFallback = Object.freeze({
    kind: 'palette-exhausted',
    colorIsNotUnique: true,
    reason: 'no-unreserved-palette-slot',
    instruction: 'Palette exhausted: identify this satellite with its ID, glyph, and pattern; color may repeat.',
  });
  const ariaLabel = `${label}; palette exhausted; color may repeat; identify it by glyph ${glyph}, ${pattern} pattern, and satellite ID.`;
  return Object.freeze({
    satelliteId,
    color,
    cssColor: color,
    threeColor: color,
    colorSpace: 'fallback',
    colorName: 'overflow-neutral',
    hueDegrees: OVERFLOW_FALLBACK_HUE_DEGREES,
    paletteIndex: null,
    paletteSlot: null,
    isOverflow: true,
    overflowIndex,
    glyph,
    pattern,
    label,
    ariaLabel,
    ...contrast,
    colorMayRepeat: true,
    fallback,
    accessibility: buildAccessibility(label, ariaLabel, glyph, pattern, contrast.contrastStatus),
  });
}

function priorAssignmentsFor(
  input: AllocateHandoverVisualIdentitiesInput,
  palette: readonly NormalizedPaletteEntry[],
): Readonly<Record<string, HandoverVisualIdentityAssignment>> {
  const previous = input.previousAllocation;
  if (previous === null || previous === undefined || previous.episodeId !== input.episodeId) {
    return Object.freeze({});
  }
  const assignments = previous.assignments;
  const usedPaletteSlots = new Set<number>();
  const usedOverflowSlots = new Set<number>();
  for (const [satelliteId, assignment] of Object.entries(assignments)) {
    if (satelliteId !== assignment.satelliteId) {
      throw new Error(`previous identity key ${satelliteId} does not match its satellite ID`);
    }
    if (assignment.isOverflow) {
      if (assignment.paletteIndex !== null || assignment.overflowIndex === null) {
        throw new Error(`previous overflow identity ${satelliteId} is malformed`);
      }
      if (usedOverflowSlots.has(assignment.overflowIndex)) {
        throw new Error(`previous identities reuse overflow slot ${assignment.overflowIndex}`);
      }
      usedOverflowSlots.add(assignment.overflowIndex);
      continue;
    }
    const slot = assignment.paletteIndex;
    if (slot === null || slot < 0 || slot >= palette.length || !Number.isInteger(slot)) {
      throw new Error(`previous identity ${satelliteId} has an invalid palette slot`);
    }
    if (usedPaletteSlots.has(slot)) throw new Error(`previous identities reuse palette slot ${slot}`);
    if (assignment.cssColor.toLowerCase() !== palette[slot]?.cssColor.toLowerCase()) {
      throw new Error(`palette changed during identity episode ${input.episodeId}`);
    }
    usedPaletteSlots.add(slot);
  }
  return assignments;
}

function isPaletteAssignment(value: HandoverVisualIdentityAssignment): boolean {
  return !value.isOverflow
    && Number.isInteger(value.paletteIndex)
    && (value.paletteIndex ?? -1) >= 0;
}

function nextOverflowIndex(
  assignments: Readonly<Record<string, HandoverVisualIdentityAssignment>>,
): number {
  let maximum = -1;
  for (const assignment of Object.values(assignments)) {
    if (assignment.isOverflow && Number.isInteger(assignment.overflowIndex)) {
      maximum = Math.max(maximum, assignment.overflowIndex ?? -1);
    }
  }
  return maximum + 1;
}

function uniqueBeamIds(values: readonly number[] | undefined): readonly number[] {
  if (values === undefined) return [];
  const result = new Set<number>();
  for (const value of values) result.add(normalizeBeamId(value));
  return Object.freeze([...result].sort((left, right) => left - right));
}

function beamShadeIndex(beamId: number): number {
  const hash = stableHashUint32(`beam:${beamId}`);
  return hash % BEAM_LIGHTNESSES.length;
}

function beamGlyph(index: number): string {
  return BEAM_GLYPHS[((index % BEAM_GLYPHS.length) + BEAM_GLYPHS.length) % BEAM_GLYPHS.length] ?? '○';
}

function beamPattern(index: number): HandoverVisualIdentityPattern {
  return BEAM_PATTERNS[((index % BEAM_PATTERNS.length) + BEAM_PATTERNS.length) % BEAM_PATTERNS.length] ?? 'solid';
}

function buildHandoverBeamVisualIdentity(
  satellite: HandoverSatelliteVisualIdentity,
  beamId: number,
  shadeIndex: number,
  colorMayRepeat: boolean,
): HandoverBeamVisualIdentity {
  const hueDegrees = satellite.hueDegrees ?? OVERFLOW_FALLBACK_HUE_DEGREES;
  const lightness = BEAM_LIGHTNESSES[shadeIndex] ?? BEAM_LIGHTNESSES[0];
  const color = oklchToHex({
    lightness,
    chroma: DEFAULT_BEAM_CHROMA,
    hueDegrees,
  });
  const contrast = assignmentContrast(color);
  const glyph = beamGlyph(shadeIndex);
  const pattern = beamPattern(shadeIndex);
  const label = `${satellite.label}, beam ${beamId}`;
  const repeatDisclosure = colorMayRepeat ? '; color or shade may repeat' : '';
  const ariaLabel = `${label}; same-satellite hue family shade ${shadeIndex + 1}; ${pattern} pattern${repeatDisclosure}; use the beam ID and pattern as identity cues.`;
  return Object.freeze({
    satelliteId: satellite.satelliteId,
    beamId,
    color,
    cssColor: color,
    threeColor: color,
    colorSpace: 'oklch',
    hueDegrees,
    lightness,
    shadeIndex,
    glyph,
    pattern,
    label,
    ariaLabel,
    ...contrast,
    colorMayRepeat,
    accessibility: buildAccessibility(label, ariaLabel, glyph, pattern, contrast.contrastStatus),
  });
}

/**
 * Standalone deterministic fallback. Allocation callers should predeclare the
 * episode beam IDs so collision-resolving variants can be reserved together.
 */
export function deriveHandoverBeamVisualIdentity(
  satellite: HandoverSatelliteVisualIdentity,
  beamIdInput: number,
): HandoverBeamVisualIdentity {
  const beamId = normalizeBeamId(beamIdInput);
  return buildHandoverBeamVisualIdentity(
    satellite,
    beamId,
    beamShadeIndex(beamId),
    satellite.colorMayRepeat,
  );
}

function allocateBeamIdentityRecord(
  satellite: HandoverSatelliteVisualIdentity,
  beamIds: readonly number[] | undefined,
  previous: Readonly<Record<string, HandoverBeamVisualIdentity>> | undefined,
): {
  readonly current: Readonly<Record<string, HandoverBeamVisualIdentity>>;
  readonly assignments: Readonly<Record<string, HandoverBeamVisualIdentity>>;
} {
  const assignments: Record<string, HandoverBeamVisualIdentity> = { ...(previous ?? {}) };
  const reservedSlots = new Set<number>();
  const identityByShade = new Map<number, HandoverBeamVisualIdentity>();
  for (const [beamIdKey, identity] of Object.entries(assignments)) {
    if (String(identity.beamId) !== beamIdKey || identity.satelliteId !== satellite.satelliteId) {
      throw new Error(`previous beam identity ${satellite.satelliteId}/${beamIdKey} is malformed`);
    }
    normalizeBeamId(identity.beamId);
    if (identity.shadeIndex < 0 || identity.shadeIndex >= BEAM_LIGHTNESSES.length) {
      throw new Error(`previous beam identity ${satellite.satelliteId}/${beamIdKey} has an invalid shade slot`);
    }
    const existingShadeOwner = identityByShade.get(identity.shadeIndex);
    if (existingShadeOwner !== undefined
      && (!existingShadeOwner.colorMayRepeat || !identity.colorMayRepeat)) {
      throw new Error(
        `previous beam identities for ${satellite.satelliteId} reuse shade slot ${identity.shadeIndex} without disclosure`,
      );
    }
    reservedSlots.add(identity.shadeIndex);
    if (existingShadeOwner === undefined) identityByShade.set(identity.shadeIndex, identity);
  }

  const currentBeamIds = uniqueBeamIds(beamIds);
  const episodeBeamIds = new Set<number>([
    ...Object.values(assignments).map(identity => identity.beamId),
    ...currentBeamIds,
  ]);
  const shadeReuseRequired = episodeBeamIds.size > BEAM_LIGHTNESSES.length;
  if (shadeReuseRequired) {
    for (const [key, identity] of Object.entries(assignments)) {
      if (identity.colorMayRepeat) continue;
      assignments[key] = buildHandoverBeamVisualIdentity(
        satellite,
        identity.beamId,
        identity.shadeIndex,
        true,
      );
    }
  }
  for (const beamId of currentBeamIds) {
    const key = String(beamId);
    if (assignments[key] !== undefined) continue;
    const preferred = beamShadeIndex(beamId);
    let shadeIndex: number | null = null;
    for (let offset = 0; offset < BEAM_LIGHTNESSES.length; offset += 1) {
      const candidate = (preferred + offset) % BEAM_LIGHTNESSES.length;
      if (!reservedSlots.has(candidate)) {
        shadeIndex = candidate;
        break;
      }
    }
    // The scientific candidate set is not bounded by the eight visual shade
    // tokens. Once they are exhausted, reuse the deterministic preferred
    // shade and disclose that repetition; the beam ID remains authoritative.
    if (shadeIndex === null) shadeIndex = preferred;
    reservedSlots.add(shadeIndex);
    assignments[key] = buildHandoverBeamVisualIdentity(
      satellite,
      beamId,
      shadeIndex,
      satellite.colorMayRepeat || shadeReuseRequired,
    );
  }
  const current: Record<string, HandoverBeamVisualIdentity> = {};
  for (const beamId of currentBeamIds) current[String(beamId)] = assignments[String(beamId)]!;
  return Object.freeze({
    current: Object.freeze(current),
    assignments: Object.freeze(assignments),
  });
}

/** Resolve a beam identity only when its satellite is in the current plan. */
export function resolveHandoverBeamVisualIdentity(
  allocation: HandoverVisualIdentityAllocation,
  satelliteId: string,
  beamId: number,
): HandoverBeamVisualIdentity | null {
  const normalizedBeamId = normalizeBeamId(beamId);
  return allocation.beamAssignmentsBySatelliteId[satelliteId]?.[String(normalizedBeamId)] ?? null;
}

/**
 * Allocate all supplied presentation IDs. Display budgets never truncate this
 * set; they are metadata for the caller, while palette reservations and
 * overflow identities keep the mapping stable.
 */
export function allocateHandoverVisualIdentities(
  input: AllocateHandoverVisualIdentitiesInput,
): HandoverVisualIdentityAllocation {
  if (typeof input.episodeId !== 'string' || input.episodeId.trim().length === 0) {
    throw new TypeError('episodeId must be a non-empty string');
  }
  const servingSatelliteId = input.servingSatelliteId === null || input.servingSatelliteId === undefined
    ? null
    : assertSatelliteId(input.servingSatelliteId, 'servingSatelliteId');
  const orderedIds = orderedSatelliteIds(input.satelliteIds, servingSatelliteId);
  const palette = normalizePalette(input.palette);
  const budget = normalizedBudget(input.normalDisplayBudget);
  const prior = priorAssignmentsFor(input, palette);
  const assignments: Record<string, HandoverVisualIdentityAssignment> = { ...prior };
  const reservedPaletteSlots = new Set<number>();
  for (const assignment of Object.values(prior)) {
    if (isPaletteAssignment(assignment) && (assignment.paletteIndex ?? -1) < palette.length) {
      reservedPaletteSlots.add(assignment.paletteIndex ?? -1);
    }
  }
  let overflowIndex = nextOverflowIndex(prior);

  for (const satelliteId of orderedIds) {
    if (assignments[satelliteId] !== undefined) continue;
    const preferred = handoverVisualPaletteStartIndex(satelliteId, palette.length);
    let paletteIndex: number | null = null;
    for (let offset = 0; offset < palette.length; offset += 1) {
      const candidateIndex = (preferred + offset) % palette.length;
      if (!reservedPaletteSlots.has(candidateIndex)) {
        paletteIndex = candidateIndex;
        break;
      }
    }
    if (paletteIndex === null) {
      assignments[satelliteId] = buildOverflowAssignment(satelliteId, overflowIndex);
      overflowIndex += 1;
    } else {
      reservedPaletteSlots.add(paletteIndex);
      const paletteEntry = palette[paletteIndex];
      if (paletteEntry === undefined) {
        throw new Error(`palette slot ${paletteIndex} unexpectedly missing`);
      }
      assignments[satelliteId] = buildPaletteAssignment(satelliteId, paletteIndex, paletteEntry);
    }
  }

  const identities = orderedIds.map(satelliteId => {
    const assignment = assignments[satelliteId];
    if (assignment === undefined) throw new Error(`identity missing for ${satelliteId}`);
    return assignment;
  });
  const identitiesBySatelliteId: Record<string, HandoverSatelliteVisualIdentity> = {};
  for (const identity of identities) identitiesBySatelliteId[identity.satelliteId] = identity;
  const beamIdentitiesBySatelliteId: Record<
    string,
    Readonly<Record<string, HandoverBeamVisualIdentity>>
  > = {};
  const beamAssignmentsBySatelliteId: Record<
    string,
    Readonly<Record<string, HandoverBeamVisualIdentity>>
  > = {
    ...(input.previousAllocation?.episodeId === input.episodeId
      ? input.previousAllocation.beamAssignmentsBySatelliteId
      : {}),
  };
  for (const identity of identities) {
    const allocated = allocateBeamIdentityRecord(
      identity,
      input.beamIdsBySatellite?.[identity.satelliteId],
      beamAssignmentsBySatelliteId[identity.satelliteId],
    );
    beamIdentitiesBySatelliteId[identity.satelliteId] = allocated.current;
    beamAssignmentsBySatelliteId[identity.satelliteId] = allocated.assignments;
  }
  const currentIdSet = new Set(orderedIds);
  const reservedSatelliteIds = Object.keys(assignments)
    .filter(satelliteId => !currentIdSet.has(satelliteId))
    .sort(compareStableIds);
  const overflowSatelliteIds = identities
    .filter(identity => identity.isOverflow)
    .map(identity => identity.satelliteId);

  return Object.freeze({
    schemaVersion: 'handover-visual-identity-v1' as const,
    episodeId: input.episodeId,
    servingSatelliteId,
    orderedSatelliteIds: orderedIds,
    normalDisplayBudget: budget,
    paletteCapacity: palette.length,
    overflowSupported: true as const,
    identities: Object.freeze(identities),
    identitiesBySatelliteId: Object.freeze(identitiesBySatelliteId),
    assignments: Object.freeze(assignments),
    overflowSatelliteIds: Object.freeze(overflowSatelliteIds),
    reservedSatelliteIds: Object.freeze(reservedSatelliteIds),
    beamIdentitiesBySatelliteId: Object.freeze(beamIdentitiesBySatelliteId),
    beamAssignmentsBySatelliteId: Object.freeze(beamAssignmentsBySatelliteId),
  });
}
