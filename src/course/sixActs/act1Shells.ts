/**
 * Act 1 orbital-shell classification.
 *
 * The proposal's review round made one demand of this act: stop letting "the
 * poles have a hole" stand as a statement about a whole constellation. It is
 * true of Starlink's main 53 deg shell and false of the constellation, which
 * carries a large polar group.
 *
 * The bands below come from MEASURING the published archive, not from the
 * proposal's prose. That measurement changed the design: the proposal named a
 * 53 / 70 / polar / all filter, but 43 deg is the SECOND LARGEST group in the
 * snapshot (33.7 %, larger than 70 deg and larger than the polar group). A
 * filter that omitted it would misrepresent the constellation it is meant to
 * make honest, so it gets its own band.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (Act 1).
 */

/** The archive these bands and the reference distribution were measured on. */
export const SIX_ACTS_ACT1_ARCHIVE_DATE = '20260812' as const;

/** Inclination above which an orbit reaches the polar regions, in degrees. */
export const SIX_ACTS_POLAR_INCLINATION_DEG = 80;

export type SixActsShellId = 'main-53' | 'mid-43' | 'high-70' | 'polar' | 'other';

export interface SixActsShellBand {
  readonly id: SixActsShellId;
  readonly labelZhHant: string;
  /** Inclusive lower bound, exclusive upper bound, in degrees. */
  readonly minInclinationDeg: number;
  readonly maxInclinationDeg: number;
  /** What this shell does and does NOT let the room claim. */
  readonly claimZhHant: string;
}

/**
 * Boundaries sit in the empty gaps BETWEEN the measured clusters (43 / 53 / 70
 * / 97), not at round numbers chosen for tidiness, so a satellite never lands
 * in a band by rounding.
 */
export const SIX_ACTS_SHELL_BANDS: readonly SixActsShellBand[] = Object.freeze([
  Object.freeze({
    id: 'mid-43' as const,
    labelZhHant: '43° 中緯殼',
    minInclinationDeg: 38,
    maxInclinationDeg: 48,
    claimZhHant: '覆蓋更集中在中低緯度，是這份快照裡第二大的一群。',
  }),
  Object.freeze({
    id: 'main-53' as const,
    labelZhHant: '53° 主力殼',
    minInclinationDeg: 48,
    maxInclinationDeg: 60,
    claimZhHant: '「兩極有洞」只有對這一殼成立——軌道最北只到緯度 53°，極區確實掃不到。',
  }),
  Object.freeze({
    id: 'high-70' as const,
    labelZhHant: '70° 高緯殼',
    minInclinationDeg: 60,
    maxInclinationDeg: SIX_ACTS_POLAR_INCLINATION_DEG,
    claimZhHant: '往高緯度延伸，但仍不是極軌。',
  }),
  Object.freeze({
    id: 'polar' as const,
    labelZhHant: '極軌群',
    minInclinationDeg: SIX_ACTS_POLAR_INCLINATION_DEG,
    maxInclinationDeg: 180,
    claimZhHant: '這一群會飛過極區。切到「全部」看見它們，就知道剛才那句話不能對整個星座講。',
  }),
]);

/** Classifies one orbit. Anything outside every band is named, not forced in. */
export function classifySixActsShell(inclinationDeg: number): SixActsShellId {
  if (!Number.isFinite(inclinationDeg)) return 'other';
  for (const band of SIX_ACTS_SHELL_BANDS) {
    if (inclinationDeg >= band.minInclinationDeg && inclinationDeg < band.maxInclinationDeg) {
      return band.id;
    }
  }
  return 'other';
}

/** Inclination in degrees, read from TLE line 2 columns 9-16. */
export function readInclinationDegFromTleLine2(line2: string): number {
  const raw = Number(line2.slice(8, 16));
  if (!Number.isFinite(raw)) {
    throw new RangeError(`TLE line 2 carries no readable inclination: ${line2.slice(0, 20)}`);
  }
  return raw;
}

export interface SixActsShellCensus {
  readonly total: number;
  readonly byShell: Readonly<Record<SixActsShellId, number>>;
  readonly polarCount: number;
  readonly polarFraction: number;
  readonly minInclinationDeg: number;
  readonly maxInclinationDeg: number;
}

export function censusSixActsShells(
  inclinationsDeg: readonly number[],
): SixActsShellCensus {
  if (inclinationsDeg.length === 0) {
    throw new RangeError('a shell census needs at least one orbit');
  }
  const byShell: Record<SixActsShellId, number> = {
    'main-53': 0, 'mid-43': 0, 'high-70': 0, polar: 0, other: 0,
  };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const inclinationDeg of inclinationsDeg) {
    byShell[classifySixActsShell(inclinationDeg)] += 1;
    if (inclinationDeg < min) min = inclinationDeg;
    if (inclinationDeg > max) max = inclinationDeg;
  }

  // Polar membership IS the polar band, not a second comparison beside it: two
  // rules for one fact disagree at the boundary and put two numbers on screen.
  const polarCount = byShell.polar;

  return Object.freeze({
    total: inclinationsDeg.length,
    byShell: Object.freeze(byShell),
    polarCount,
    polarFraction: polarCount / inclinationsDeg.length,
    minInclinationDeg: min,
    maxInclinationDeg: max,
  });
}

/** What the honesty caption needs, and nothing more. */
export type SixActsShellTally = Pick<
  SixActsShellCensus,
  'total' | 'byShell' | 'polarCount' | 'polarFraction'
>;

/**
 * Tallies orbits that have already been classified.
 *
 * The page counts the SAME aligned array its filter buttons count, so the
 * buttons and the caption cannot report different totals for one fact.
 */
export function tallySixActsShells(
  shells: readonly (SixActsShellId | null)[],
): SixActsShellTally {
  const byShell: Record<SixActsShellId, number> = {
    'main-53': 0, 'mid-43': 0, 'high-70': 0, polar: 0, other: 0,
  };
  for (const shell of shells) byShell[shell ?? 'other'] += 1;
  return Object.freeze({
    total: shells.length,
    byShell: Object.freeze(byShell),
    polarCount: byShell.polar,
    polarFraction: shells.length === 0 ? 0 : byShell.polar / shells.length,
  });
}

/**
 * What the room may be told, given what is on screen.
 *
 * The caption is derived from the census rather than written once: if a future
 * archive changes the shape of the constellation, the sentence changes with it
 * instead of quietly becoming false.
 */
export function describeSixActsShellHonesty(
  census: SixActsShellTally,
  constellationLabel: string,
): string {
  const polarPercent = (census.polarFraction * 100).toFixed(1);
  if (census.polarFraction > 0.9) {
    return `${constellationLabel} 幾乎整組都是極軌（${polarPercent}%），`
      + `所以「兩極有洞」這句話對它完全不成立。`;
  }
  const main = census.byShell['main-53'];
  return `${constellationLabel} 有 ${census.polarCount} 顆（${polarPercent}%）傾角超過 `
    + `${SIX_ACTS_POLAR_INCLINATION_DEG}°。「兩極有洞」只對 53° 主力殼那 ${main} 顆成立，`
    + `不能對整個星座講。`;
}
