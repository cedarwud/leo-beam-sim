import { parseUtcInstant, formatTaipeiLocalDateTime } from '../tle/time';
import type {
  HomepageTleSceneFrame,
  HomepageTleSceneSatellite,
} from './homepageTleSceneAdapter';
import { projectHomepageTleLook } from './homepageTleSceneAdapter';

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function segmentProgress(
  elapsedSec: number,
  previousInstantUtc: string,
  nextInstantUtc: string,
): { readonly fraction: number; readonly previousMs: number; readonly nextMs: number } {
  finite(elapsedSec, 'elapsedSec');
  const previousMs = parseUtcInstant(previousInstantUtc, 'previousInstantUtc').ms;
  const nextMs = parseUtcInstant(nextInstantUtc, 'nextInstantUtc').ms;
  const durationSec = (nextMs - previousMs) / 1_000;
  if (!(durationSec > 0)) {
    throw new RangeError('nextInstantUtc must be later than previousInstantUtc');
  }
  return {
    fraction: clamp01(elapsedSec / durationSec),
    previousMs,
    nextMs,
  };
}

function hermiteState(
  previous: HomepageTleSceneSatellite,
  next: HomepageTleSceneSatellite,
  fraction: number,
  durationSec: number,
): {
  readonly positionTemeKm: HomepageTleSceneSatellite['positionTemeKm'];
  readonly velocityTemeKmPerSec: HomepageTleSceneSatellite['velocityTemeKmPerSec'];
} {
  const t = fraction;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const dh00 = (6 * t2 - 6 * t) / durationSec;
  const dh10 = 3 * t2 - 4 * t + 1;
  const dh01 = (-6 * t2 + 6 * t) / durationSec;
  const dh11 = 3 * t2 - 2 * t;
  const axis = (key: 'x' | 'y' | 'z'): readonly [number, number] => {
    const p0 = previous.positionTemeKm[key];
    const p1 = next.positionTemeKm[key];
    const v0 = previous.velocityTemeKmPerSec[key];
    const v1 = next.velocityTemeKmPerSec[key];
    return [
      h00 * p0 + h10 * durationSec * v0 + h01 * p1 + h11 * durationSec * v1,
      dh00 * p0 + dh10 * v0 + dh01 * p1 + dh11 * v1,
    ];
  };
  const [x, vx] = axis('x');
  const [y, vy] = axis('y');
  const [z, vz] = axis('z');
  return {
    positionTemeKm: Object.freeze({ x, y, z }),
    velocityTemeKmPerSec: Object.freeze({ x: vx, y: vy, z: vz }),
  };
}

function interpolatedInstantUtc(
  elapsedSec: number,
  previousInstantUtc: string,
  nextInstantUtc: string,
): { readonly fraction: number; readonly value: string } {
  const segment = segmentProgress(elapsedSec, previousInstantUtc, nextInstantUtc);
  if (segment.fraction === 0) return { fraction: 0, value: new Date(segment.previousMs).toISOString() };
  if (segment.fraction === 1) return { fraction: 1, value: new Date(segment.nextMs).toISOString() };
  const elapsedMs = (segment.nextMs - segment.previousMs) * segment.fraction;
  return {
    fraction: segment.fraction,
    value: new Date(segment.previousMs + elapsedMs).toISOString(),
  };
}

function assertStableIdentity(
  previous: HomepageTleSceneSatellite,
  next: HomepageTleSceneSatellite,
): void {
  if (previous.satelliteId !== next.satelliteId) {
    throw new Error(
      `cannot interpolate different homepage TLE satellites: ${previous.satelliteId} vs ${next.satelliteId}`,
    );
  }
}

/**
 * Interpolate one visual satellite between two archived-TLE scene anchors.
 *
 * This is display-only: the canonical analysis frame remains at its published
 * anchor. TEME position/velocity use cubic Hermite interpolation over the two
 * completed SGP4 state vectors; the intermediate UTC is then projected again
 * through the canonical NTPU observer. No campus/world-coordinate tween is
 * treated as orbit truth.
 * Endpoint objects are returned unchanged so metadata and identity remain
 * exact at both published anchors. During an anchor-boundary role change, the
 * previous role is held until the endpoint while the physical satellite still
 * moves continuously.
 */
export function interpolateHomepageTleSceneSatellite(
  previous: HomepageTleSceneSatellite,
  next: HomepageTleSceneSatellite,
  elapsedSec: number,
  previousInstantUtc: string,
  nextInstantUtc: string,
): HomepageTleSceneSatellite {
  const instant = interpolatedInstantUtc(elapsedSec, previousInstantUtc, nextInstantUtc);
  const { fraction } = instant;
  assertStableIdentity(previous, next);
  if (fraction === 0) return previous;
  if (fraction === 1) return next;
  const durationSec = (Date.parse(nextInstantUtc) - Date.parse(previousInstantUtc)) / 1_000;
  const state = hermiteState(previous, next, fraction, durationSec);
  const projected = projectHomepageTleLook(state.positionTemeKm, instant.value);

  return Object.freeze({
    satelliteId: previous.satelliteId,
    satelliteName: previous.satelliteName,
    role: previous.role,
    worldPosition: projected.worldPosition,
    positionTemeKm: state.positionTemeKm,
    velocityTemeKmPerSec: state.velocityTemeKmPerSec,
    look: projected.look,
    tleEpochUtc: previous.tleEpochUtc,
    sourcePath: previous.sourcePath,
  });
}

function interpolateBoundedSatellite(
  previous: HomepageTleSceneSatellite,
  next: HomepageTleSceneSatellite,
  previousInstantUtc: string,
  nextInstantUtc: string,
  elapsedSec: number,
): HomepageTleSceneSatellite {
  if (previous.satelliteId !== next.satelliteId) return previous;
  return interpolateHomepageTleSceneSatellite(
    previous,
    next,
    elapsedSec,
    previousInstantUtc,
    nextInstantUtc,
  );
}

function nextPhysicalStateFor(
  previous: HomepageTleSceneSatellite,
  next: HomepageTleSceneFrame,
): HomepageTleSceneSatellite | null {
  const physical = next.satellites.find(item => item.satelliteId === previous.satelliteId);
  if (physical === undefined) return null;
  return physical.role === previous.role
    ? physical
    : Object.freeze({ ...physical, role: previous.role });
}

function interpolateOptionalBoundedSatellite(
  previous: HomepageTleSceneSatellite | null,
  next: HomepageTleSceneSatellite | null,
  previousInstantUtc: string,
  nextInstantUtc: string,
  elapsedSec: number,
): HomepageTleSceneSatellite | null {
  if (previous === null || next === null) return previous;
  return interpolateBoundedSatellite(
    previous,
    next,
    previousInstantUtc,
    nextInstantUtc,
    elapsedSec,
  );
}

/**
 * Produce a bounded visual frame from two adjacent accepted scene frames.
 * Only the current selected/candidate/context identities are carried between
 * anchors; next-only context satellites enter at the next endpoint.  This
 * keeps the helper pure and prevents it from becoming a second propagation or
 * full-constellation renderer.
 */
export function interpolateHomepageTleSceneFrame(
  previous: HomepageTleSceneFrame,
  next: HomepageTleSceneFrame,
  elapsedSec: number,
): HomepageTleSceneFrame {
  const instant = interpolatedInstantUtc(elapsedSec, previous.instantUtc, next.instantUtc);
  if (instant.fraction === 0) return previous;
  if (instant.fraction === 1) return next;
  if (previous.constellation !== next.constellation) {
    throw new Error(
      `cannot interpolate homepage TLE constellations: ${previous.constellation} vs ${next.constellation}`,
    );
  }

  const selectedNextState = nextPhysicalStateFor(previous.selected, next);
  const selected = selectedNextState === null
    ? previous.selected
    : interpolateBoundedSatellite(
      previous.selected,
      selectedNextState,
      previous.instantUtc,
      next.instantUtc,
      elapsedSec,
    );
  const candidateNextState = previous.candidate === null
    ? null
    : nextPhysicalStateFor(previous.candidate, next);
  const candidate = interpolateOptionalBoundedSatellite(
    previous.candidate,
    candidateNextState,
    previous.instantUtc,
    next.instantUtc,
    elapsedSec,
  );
  const contextSatellites = Object.freeze(previous.contextSatellites.map(item => {
    const nextItem = nextPhysicalStateFor(item, next);
    return nextItem === null
      ? item
      : interpolateBoundedSatellite(
        item,
        nextItem,
        previous.instantUtc,
        next.instantUtc,
        elapsedSec,
      );
  }));
  const satellites = Object.freeze([
    selected,
    ...(candidate === null ? [] : [candidate]),
    ...contextSatellites,
  ]);
  const identity = Object.freeze({
    ...previous.identity,
    requestedInstantUtc: instant.value,
    instantTaipei: formatTaipeiLocalDateTime(Date.parse(instant.value)),
    selectedSatelliteId: selected.satelliteId,
    candidateSatelliteId: candidate?.satelliteId ?? null,
  });
  const telemetry = Object.freeze({
    ...previous.telemetry,
    renderedSatelliteCount: satellites.length,
    visibleContextSatelliteCount: contextSatellites.length,
    selectedElevationDeg: selected.look.elevationDeg,
    selectedAzimuthDeg: selected.look.azimuthDeg,
    selectedRangeKm: selected.look.rangeKm,
    candidateElevationDeg: candidate?.look.elevationDeg ?? null,
  });

  return Object.freeze({
    ...previous,
    instantUtc: instant.value,
    identity,
    selected,
    candidate,
    contextSatellites,
    satellites,
    telemetry,
  });
}
