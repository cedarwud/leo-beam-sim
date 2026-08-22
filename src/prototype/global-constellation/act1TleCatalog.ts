/**
 * Act 1 orbital catalogue — inclination per satellite, from the published archive.
 *
 * The first-frame artifact carries positions and a horizon mask but no
 * inclination, and the shell filter needs one per point. Inclination is read
 * straight out of TLE line 2, so this costs a fetch of an already-published
 * file and no propagation.
 *
 * Progressive by design: the page paints from the existing artifact first and
 * layers this on when it arrives, so the lecture never opens on a blank globe.
 */

import { propagate, twoline2satrec } from 'satellite.js';

import { NTPU_TLE_OBSERVER, deriveObserverLinkGeometry } from '../../simulator/observer';
import {
  classifySixActsShell,
  readInclinationDegFromTleLine2,
  type SixActsShellId,
} from '../../course/sixActs/act1Shells';
import type { SimulatorConstellation } from '../../simulator/types';

export const ACT1_ARCHIVE_DATE = '20260812' as const;

export function act1ArchiveUrl(constellation: SimulatorConstellation): string {
  return `/tle-archive/${constellation}/${constellation}_${ACT1_ARCHIVE_DATE}.tle`;
}

export interface Act1OrbitRecord {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly inclinationDeg: number;
  readonly shell: SixActsShellId;
  readonly line1: string;
  readonly line2: string;
}

/** NORAD id from TLE line 1 columns 3-7, trimmed of its classification letter. */
function satelliteIdFromLine1(line1: string): string {
  return line1.slice(2, 7).trim().replace(/^0+(?=\d)/, '');
}

export function parseAct1OrbitCatalog(text: string): readonly Act1OrbitRecord[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
    .map(line => line.trimEnd())
    .filter(line => line !== '');
  const records: Act1OrbitRecord[] = [];

  for (let index = 0; index + 2 < lines.length; index += 3) {
    const name = lines[index]!.trim();
    const line1 = lines[index + 1]!;
    const line2 = lines[index + 2]!;
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;
    const inclinationDeg = readInclinationDegFromTleLine2(line2);
    records.push(Object.freeze({
      satelliteId: satelliteIdFromLine1(line1),
      satelliteName: name,
      inclinationDeg,
      shell: classifySixActsShell(inclinationDeg),
      line1,
      line2,
    }));
  }
  return Object.freeze(records);
}

export async function loadAct1OrbitCatalog(
  constellation: SimulatorConstellation,
  signal?: AbortSignal,
): Promise<readonly Act1OrbitRecord[]> {
  const response = await fetch(act1ArchiveUrl(constellation), { signal });
  if (!response.ok) {
    throw new Error(`Act 1 orbit catalogue ${constellation} returned HTTP ${response.status}`);
  }
  return parseAct1OrbitCatalog(await response.text());
}

/**
 * Shell index aligned one-to-one with the artifact's own satellite order.
 *
 * An id the catalogue does not carry becomes `null` rather than a guess: the
 * point still draws, it just draws unclassified, and the page can say how many.
 */
export function alignAct1ShellsToArtifact(
  satelliteIds: readonly string[],
  catalog: readonly Act1OrbitRecord[],
): readonly (SixActsShellId | null)[] {
  const byId = new Map(catalog.map(record => [record.satelliteId, record]));
  return satelliteIds.map(id => byId.get(id)?.shell ?? null);
}

/* -- NTPU visibility ------------------------------------------------------ */

/**
 * Elevation at NTPU for every catalogued orbit, at one instant.
 *
 * Kept separate from parsing because it propagates: parsing a 10 k-satellite
 * archive is instant, propagating it is not, and the page paints the shell
 * filter before it needs elevations.
 */
export function computeAct1Elevations(
  catalog: readonly Act1OrbitRecord[],
  instantUtc: string,
): Float64Array {
  const when = new Date(Date.parse(instantUtc));
  const elevations = new Float64Array(catalog.length);
  for (let index = 0; index < catalog.length; index += 1) {
    const record = catalog[index]!;
    elevations[index] = Number.NaN;
    try {
      const satrec = twoline2satrec(record.line1, record.line2);
      const propagated = propagate(satrec, when);
      if (propagated?.position === undefined || satrec.error !== 0) continue;
      elevations[index] = deriveObserverLinkGeometry(
        propagated.position as { x: number; y: number; z: number },
        instantUtc,
        NTPU_TLE_OBSERVER,
      ).elevationDeg;
    } catch {
      // A single unpropagatable record stays NaN and is counted as not visible;
      // it must not take the whole globe down.
    }
  }
  return elevations;
}

/**
 * Visibility mask at the classroom cone, aligned to the artifact's own order.
 *
 * Act 1 narrates a 10 deg cone, which is NOT the artifact's own mask — that one
 * is the geometric horizon. Both are real; they are different questions, so
 * this computes its own rather than reusing a mask that answers the other one.
 */
export function alignAct1VisibilityToArtifact(
  satelliteIds: readonly string[],
  catalog: readonly Act1OrbitRecord[],
  elevations: Float64Array,
  minimumElevationDeg: number,
): Uint8Array {
  const byId = new Map<string, number>();
  catalog.forEach((record, index) => byId.set(record.satelliteId, index));
  const mask = new Uint8Array(satelliteIds.length);
  satelliteIds.forEach((id, index) => {
    const source = byId.get(id);
    if (source === undefined) return;
    const elevationDeg = elevations[source]!;
    mask[index] = Number.isFinite(elevationDeg) && elevationDeg >= minimumElevationDeg ? 1 : 0;
  });
  return mask;
}
