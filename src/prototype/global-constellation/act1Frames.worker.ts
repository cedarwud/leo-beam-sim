/// <reference lib="webworker" />
/**
 * Act 1 time advance — SGP4 frames, computed in the browser.
 *
 * Measured trade-off (2026-08-22): pre-computing +/-90 min at a 60 s step for
 * Starlink is 1.95 M propagations. Shipped as packed Float32 that is ~30 MB per
 * constellation, against a page that currently loads 680 KB — a bad way to open
 * a lecture on a classroom network. SGP4 itself runs at ~170 k propagations/s,
 * so the same frames cost seconds of local compute and zero payload.
 *
 * Frames are therefore computed HERE and emitted CENTRE-OUTWARD, so the range a
 * lecturer actually scrubs first is ready first and the timeline widens as it
 * fills. Nothing waits for the last frame.
 */

import { eciToEcf, gstime, propagate, twoline2satrec, type EciVec3, type SatRec } from 'satellite.js';

import { deriveObserverLinkGeometry, NTPU_TLE_OBSERVER } from '../../simulator/observer';
import { act1FrameOffsets } from './act1FrameSchedule';
import {
  VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM,
  VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD,
} from '../../visualLab/globalConstellation';

const SCALE = VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_WORLD
  / VISUAL_LAB_GLOBAL_CONSTELLATION_EARTH_RADIUS_KM;

export interface Act1FrameRequest {
  readonly archiveUrl: string;
  readonly baseInstantUtc: string;
  readonly spanSec: number;
  readonly stepSec: number;
  readonly minimumElevationDeg: number;
}

export interface Act1CatalogMessage {
  readonly type: 'catalog';
  readonly satelliteIds: readonly string[];
  readonly satelliteNames: readonly string[];
  readonly inclinationsDeg: Float64Array;
  readonly frameCount: number;
}

export interface Act1FrameMessage {
  readonly type: 'frame';
  readonly offsetSec: number;
  readonly positions: Float32Array;
  readonly visible: Uint8Array;
  readonly visibleCount: number;
}

export interface Act1DoneMessage { readonly type: 'done' }
export interface Act1ErrorMessage { readonly type: 'error'; readonly message: string }

export type Act1WorkerMessage =
  | Act1CatalogMessage
  | Act1FrameMessage
  | Act1DoneMessage
  | Act1ErrorMessage;

interface ParsedOrbit {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly inclinationDeg: number;
  readonly satrec: SatRec;
}

function parse(text: string): readonly ParsedOrbit[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
    .map(line => line.trimEnd())
    .filter(line => line !== '');
  const orbits: ParsedOrbit[] = [];
  for (let index = 0; index + 2 < lines.length; index += 3) {
    const line1 = lines[index + 1]!;
    const line2 = lines[index + 2]!;
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;
    orbits.push({
      satelliteId: line1.slice(2, 7).trim().replace(/^0+(?=\d)/, ''),
      satelliteName: lines[index]!.trim(),
      inclinationDeg: Number(line2.slice(8, 16)),
      satrec: twoline2satrec(line1, line2),
    });
  }
  return orbits;
}

async function run(request: Act1FrameRequest): Promise<void> {
  const response = await fetch(request.archiveUrl);
  if (!response.ok) throw new Error(`archive returned HTTP ${response.status}`);
  const orbits = parse(await response.text());
  if (orbits.length === 0) throw new Error('archive carried no readable 3LE records');

  const offsets = act1FrameOffsets(request.spanSec, request.stepSec);
  const catalog: Act1CatalogMessage = {
    type: 'catalog',
    satelliteIds: orbits.map(orbit => orbit.satelliteId),
    satelliteNames: orbits.map(orbit => orbit.satelliteName),
    inclinationsDeg: Float64Array.from(orbits.map(orbit => orbit.inclinationDeg)),
    frameCount: offsets.length,
  };
  (self as unknown as Worker).postMessage(catalog);

  const baseMs = Date.parse(request.baseInstantUtc);
  for (const offsetSec of offsets) {
    const instantMs = baseMs + offsetSec * 1000;
    const instantUtc = new Date(instantMs).toISOString();
    const when = new Date(instantMs);
    const positions = new Float32Array(orbits.length * 3);
    const visible = new Uint8Array(orbits.length);
    let visibleCount = 0;

    for (let index = 0; index < orbits.length; index += 1) {
      const orbit = orbits[index]!;
      let propagated;
      try {
        propagated = propagate(orbit.satrec, when);
      } catch {
        propagated = null;
      }
      if (propagated?.position === undefined || orbit.satrec.error !== 0) {
        // A satellite SGP4 cannot place stays at the origin and counts as not
        // visible, rather than freezing at a stale position that would look
        // like a real one.
        continue;
      }
      const teme = propagated.position as { x: number; y: number; z: number };
      const geometry = deriveObserverLinkGeometry(teme, instantUtc, NTPU_TLE_OBSERVER);
      const offset = index * 3;
      // Earth-fixed display frame, produced by the SAME transform the published
      // first-frame artifact uses, so a worker frame and the artifact frame put
      // one satellite in one place.
      const ecf = eciToEcf(teme as EciVec3<number>, gstime(when));
      positions[offset] = ecf.x * SCALE;
      positions[offset + 1] = ecf.z * SCALE;
      positions[offset + 2] = -ecf.y * SCALE;
      if (geometry.elevationDeg >= request.minimumElevationDeg) {
        visible[index] = 1;
        visibleCount += 1;
      }
    }

    const message: Act1FrameMessage = { type: 'frame', offsetSec, positions, visible, visibleCount };
    (self as unknown as Worker).postMessage(message, [positions.buffer, visible.buffer]);
  }

  (self as unknown as Worker).postMessage({ type: 'done' } satisfies Act1DoneMessage);
}

self.onmessage = (event: MessageEvent<Act1FrameRequest>) => {
  run(event.data).catch((error: unknown) => {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Act 1 frame worker failed',
    } satisfies Act1ErrorMessage);
  });
};
