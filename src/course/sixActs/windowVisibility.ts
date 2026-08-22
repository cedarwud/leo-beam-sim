/**
 * Elevation truth for the pinned teaching window.
 *
 * Act 4 draws a link for every phase. A phase whose satellite is below the
 * horizon at its start would be drawing a link that does not exist, so the plan
 * is checked against SGP4 rather than against an assumption about pass length.
 *
 * Three elevation thresholds exist in this repo and they are NOT
 * interchangeable; conflating them is how a teaching claim goes wrong:
 *
 *   - 0 deg  — the geometric horizon. This is what the atlas chain used
 *              (`ntpu-exact-sgp4-horizon-v1`, `observer.ts` `visible`), so it is
 *              the only threshold that can judge a window the atlas produced.
 *   - 10 deg — the classroom visibility cone in Act 1's narration.
 *   - 15 deg — `DEFAULT_PASS_SERVICE_MIN_ELEVATION_DEG`, the pass planner's
 *              service mask. Unrelated to either of the above.
 *
 * The guard below uses the horizon. The 10 deg figure is reported alongside so
 * a card can honestly say "already in the low-elevation handover band" without
 * the guard silently adopting a stricter rule than the chain it is checking.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M4).
 */

import { propagate, twoline2satrec } from 'satellite.js';

import { NTPU_TLE_OBSERVER, deriveObserverLinkGeometry } from '../../simulator/observer';
import { loadSixActsTeachingWindow } from './teachingWindow';
import type { SixActsTeachingWindowFixture, SixActsTleIdentity } from './teachingWindowSchema';

/** The atlas chain's own visibility rule. */
export const SIX_ACTS_HORIZON_ELEVATION_DEG = 0;

/** Act 1's narrated visibility cone. Reported, never used as the guard. */
export const SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG = 10;

export type SixActsPairSide = 'from' | 'to';

export type SixActsVisibilityErrorCode = 'PROPAGATION_FAILED' | 'BELOW_HORIZON';

export class SixActsVisibilityError extends Error {
  readonly code: SixActsVisibilityErrorCode;

  constructor(code: SixActsVisibilityErrorCode, message: string) {
    super(message);
    this.name = 'SixActsVisibilityError';
    this.code = code;
  }
}

export interface SixActsElevationReading {
  readonly side: SixActsPairSide;
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly instantMs: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
  /** Above the geometric horizon the atlas chain used. */
  readonly aboveHorizon: boolean;
  /** Above Act 1's narrated cone — a teaching label, not the guard. */
  readonly aboveClassroomCone: boolean;
}

/**
 * The window was mined from one observer. Reusing the repo's NTPU constant is
 * only correct while it still IS that observer, so the two are compared rather
 * than merged — a moved ground station must fail loudly, not silently reproject
 * the whole lesson.
 */
function assertObserverMatchesFixture(fixture: SixActsTeachingWindowFixture): void {
  const mined = fixture.provenance.observer;
  const matches = mined.id === NTPU_TLE_OBSERVER.id
    && mined.latitudeDeg === NTPU_TLE_OBSERVER.latitudeDeg
    && mined.longitudeDeg === NTPU_TLE_OBSERVER.longitudeDeg
    && mined.heightKm === NTPU_TLE_OBSERVER.heightKm;
  if (!matches) {
    throw new SixActsVisibilityError(
      'PROPAGATION_FAILED',
      `the window was mined at ${mined.id}, which is no longer the repo's NTPU observer`,
    );
  }
}

function identityFor(
  fixture: SixActsTeachingWindowFixture,
  side: SixActsPairSide,
): SixActsTleIdentity {
  return side === 'from' ? fixture.pair.from : fixture.pair.to;
}

/** Elevation of one side of the pinned pair, from its own TLE. */
export function readSixActsElevation(
  side: SixActsPairSide,
  instantMs: number,
  fixture: SixActsTeachingWindowFixture = loadSixActsTeachingWindow(),
): SixActsElevationReading {
  const identity = identityFor(fixture, side);
  const satrec = twoline2satrec(identity.line1, identity.line2);
  const propagated = propagate(satrec, new Date(instantMs));
  if (propagated === null || propagated === undefined
    || propagated.position === undefined || satrec.error !== 0) {
    throw new SixActsVisibilityError(
      'PROPAGATION_FAILED',
      `SGP4 failed for ${identity.satelliteId} at ${new Date(instantMs).toISOString()}`,
    );
  }

  assertObserverMatchesFixture(fixture);
  const geometry = deriveObserverLinkGeometry(
    propagated.position as { x: number; y: number; z: number },
    new Date(instantMs).toISOString(),
    NTPU_TLE_OBSERVER,
  );

  return Object.freeze({
    side,
    satelliteId: identity.satelliteId,
    satelliteName: identity.satelliteName,
    instantMs,
    elevationDeg: geometry.elevationDeg,
    rangeKm: geometry.rangeKm,
    aboveHorizon: geometry.elevationDeg > SIX_ACTS_HORIZON_ELEVATION_DEG,
    aboveClassroomCone: geometry.elevationDeg >= SIX_ACTS_CLASSROOM_CONE_ELEVATION_DEG,
  });
}

export interface SixActsPhaseVisibility {
  readonly phaseId: string;
  readonly startInstantMs: number;
  readonly readings: readonly SixActsElevationReading[];
}

/** What a plan must be able to draw: the phase id, and which sides it shows. */
export interface SixActsVisibilityRequirement {
  readonly phaseId: string;
  readonly startInstantMs: number;
  readonly requiresVisible: readonly SixActsPairSide[];
}

/**
 * Checks every phase can actually draw what it claims.
 *
 * Fails on the first phase whose displayed satellite is below the horizon: a
 * lesson that draws a link to a set satellite is worse than a lesson that
 * refuses to start.
 */
export function assertSixActsPlanVisibility(
  requirements: readonly SixActsVisibilityRequirement[],
  fixture: SixActsTeachingWindowFixture = loadSixActsTeachingWindow(),
): readonly SixActsPhaseVisibility[] {
  return Object.freeze(requirements.map(requirement => {
    const readings = requirement.requiresVisible.map(side =>
      readSixActsElevation(side, requirement.startInstantMs, fixture));
    for (const reading of readings) {
      if (!reading.aboveHorizon) {
        throw new SixActsVisibilityError(
          'BELOW_HORIZON',
          `${requirement.phaseId} shows ${reading.satelliteName} at `
          + `${reading.elevationDeg.toFixed(2)} deg, below the horizon the atlas chain used`,
        );
      }
    }
    return Object.freeze({
      phaseId: requirement.phaseId,
      startInstantMs: requirement.startInstantMs,
      readings: Object.freeze(readings),
    });
  }));
}
