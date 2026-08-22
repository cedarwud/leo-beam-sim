/**
 * Fail-closed loader for the pinned six-acts teaching window.
 *
 * The generated fixture is data the classroom slice replays. This module is the
 * only door to it, and it re-derives every claim the fixture makes rather than
 * trusting the JSON: a stale or hand-edited fixture must fail loudly at load,
 * not quietly teach a wrong number.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M1).
 */

import { validateTleLines } from '../../tle/validation';
import generated from './fixtures/teachingWindow.generated.json';
import {
  SIX_ACTS_BEAT_CALIBRATION,
  SIX_ACTS_TEACHING_WINDOW_SCHEMA,
  type SixActsAtlasForecastSample,
  type SixActsTeachingWindowFixture,
} from './teachingWindowSchema';

export type SixActsTeachingWindowErrorCode =
  | 'SCHEMA_MISMATCH'
  | 'BEAT_CALIBRATION_MISMATCH'
  | 'TRIGGER_OFFSET_MISMATCH'
  | 'TTT_NOT_SATISFIED'
  | 'OFFSET_NOT_SATISFIED'
  | 'PAIR_MISMATCH'
  | 'DELTA_MISMATCH'
  | 'FORECAST_SHAPE'
  | 'INVALID_TLE'
  | 'COMMIT_DRIFT';

/** A typed domain failure; callers must not launder it into a usable window. */
export class SixActsTeachingWindowError extends Error {
  readonly code: SixActsTeachingWindowErrorCode;

  constructor(code: SixActsTeachingWindowErrorCode, message: string) {
    super(message);
    this.name = 'SixActsTeachingWindowError';
    this.code = code;
  }
}

function fail(code: SixActsTeachingWindowErrorCode, message: string): never {
  throw new SixActsTeachingWindowError(code, message);
}

/** Δ dB is compared at 1e-9, not exactly: the atlas stores IEEE doubles. */
const DELTA_TOLERANCE_DB = 1e-9;

const FORECAST_ROLE_ORDER: readonly SixActsAtlasForecastSample['role'][] = [
  'before',
  'decision',
  'after',
];

function parseInstant(instantUtc: string, label: string): number {
  const parsed = Date.parse(instantUtc);
  if (!Number.isFinite(parsed)) {
    fail('FORECAST_SHAPE', `${label} is not a parseable UTC instant: ${instantUtc}`);
  }
  return parsed;
}

/**
 * Re-derives every claim in a candidate window. Exported so the fixture and any
 * future re-pinned window pass the same door.
 */
export function validateSixActsTeachingWindow(
  fixture: SixActsTeachingWindowFixture,
): SixActsTeachingWindowFixture {
  if (fixture.schema !== SIX_ACTS_TEACHING_WINDOW_SCHEMA) {
    fail('SCHEMA_MISMATCH', `expected ${SIX_ACTS_TEACHING_WINDOW_SCHEMA}, found ${fixture.schema}`);
  }
  if (fixture.beatCalibration !== SIX_ACTS_BEAT_CALIBRATION) {
    fail(
      'BEAT_CALIBRATION_MISMATCH',
      `the teaching window must stay calibrated by ${SIX_ACTS_BEAT_CALIBRATION}`,
    );
  }

  const t0Ms = parseInstant(fixture.window.requestedT0Utc, 'window.requestedT0Utc');
  const triggerMs = parseInstant(fixture.window.triggerInstantUtc, 'window.triggerInstantUtc');
  if ((triggerMs - t0Ms) / 1000 !== fixture.window.triggerOffsetSec) {
    fail(
      'TRIGGER_OFFSET_MISMATCH',
      `triggerOffsetSec ${fixture.window.triggerOffsetSec} does not match the trigger instant`,
    );
  }

  const { offsetDb, tttSec } = fixture.window.handoverPolicy;
  const anchors = fixture.qualification.anchors;
  if (anchors.length === 0) {
    fail('TTT_NOT_SATISFIED', 'the window carries no qualification anchors');
  }
  if (anchors[0].progressSec !== 0) {
    fail('TTT_NOT_SATISFIED', 'the first qualification anchor must sit at progressSec 0');
  }
  const spanSec = anchors[anchors.length - 1].progressSec;
  if (spanSec !== fixture.qualification.spanSec) {
    fail('TTT_NOT_SATISFIED', `qualification spanSec ${fixture.qualification.spanSec} disagrees with its anchors`);
  }
  if (spanSec < tttSec) {
    fail('TTT_NOT_SATISFIED', `qualification span ${spanSec} s is shorter than TTT ${tttSec} s`);
  }
  for (const anchor of anchors) {
    if (anchor.deltaDb + DELTA_TOLERANCE_DB < offsetDb) {
      fail(
        'OFFSET_NOT_SATISFIED',
        `qualification anchor ${anchor.instantUtc} holds ${anchor.deltaDb} dB, below the ${offsetDb} dB offset`,
      );
    }
  }

  const { preCommit, postCommit } = fixture.qualification;
  if (preCommit.servingSatelliteId !== fixture.pair.from.satelliteId) {
    fail('PAIR_MISMATCH', 'the pre-commit serving satellite is not the pair source');
  }
  if (preCommit.candidateSatelliteId !== fixture.pair.to.satelliteId) {
    fail('PAIR_MISMATCH', 'the pre-commit candidate is not the pair target');
  }
  if (postCommit.servingSatelliteId !== fixture.pair.to.satelliteId) {
    fail('PAIR_MISMATCH', 'the post-commit serving satellite is not the pair target');
  }
  if (postCommit.instantUtc !== fixture.window.triggerInstantUtc) {
    fail('PAIR_MISMATCH', 'the commit instant disagrees with the window trigger');
  }
  const derivedDelta = preCommit.candidateSinrDb - preCommit.servingSinrDb;
  if (Math.abs(derivedDelta - preCommit.deltaDb) > DELTA_TOLERANCE_DB) {
    fail('DELTA_MISMATCH', 'pre-commit ΔSINR is not candidate minus serving');
  }

  const samples = fixture.atlasForecast.samples;
  if (samples.length !== FORECAST_ROLE_ORDER.length) {
    fail('FORECAST_SHAPE', `expected ${FORECAST_ROLE_ORDER.length} atlas anchors, found ${samples.length}`);
  }
  samples.forEach((sample, index) => {
    if (sample.role !== FORECAST_ROLE_ORDER[index]) {
      fail('FORECAST_SHAPE', `atlas anchor ${index} must carry role ${FORECAST_ROLE_ORDER[index]}`);
    }
    if (index > 0) {
      // The retained clip keeps three anchors out of the window trace, and they
      // are not adjacent (227 / 229 / 231 for the pinned event). Spacing is
      // therefore anchor-index distance times the step, not one step.
      const previous = samples[index - 1];
      const indexStride = sample.anchorIndex - previous.anchorIndex;
      if (indexStride <= 0) {
        fail('FORECAST_SHAPE', 'atlas anchor indices must strictly increase');
      }
      const previousMs = parseInstant(previous.instantUtc, 'atlas anchor');
      const currentMs = parseInstant(sample.instantUtc, 'atlas anchor');
      const expectedGapSec = indexStride * fixture.atlasForecast.stepSec;
      if ((currentMs - previousMs) / 1000 !== expectedGapSec) {
        fail(
          'FORECAST_SHAPE',
          `atlas anchors ${previous.anchorIndex}->${sample.anchorIndex} must be ${expectedGapSec} s apart`,
        );
      }
    }
  });
  const decision = samples[FORECAST_ROLE_ORDER.indexOf('decision')];
  if (decision.instantUtc !== fixture.window.triggerInstantUtc) {
    fail('FORECAST_SHAPE', 'the decision anchor must sit on the window trigger instant');
  }

  for (const identity of [fixture.pair.from, fixture.pair.to]) {
    let validated: ReturnType<typeof validateTleLines>;
    try {
      validated = validateTleLines(identity.line1, identity.line2);
    } catch (error) {
      fail('INVALID_TLE', `${identity.satelliteName} carries an invalid TLE: ${String(error)}`);
    }
    if (validated.identity.satelliteId !== identity.satelliteId) {
      fail('INVALID_TLE', `${identity.satelliteName} TLE catalog number is not ${identity.satelliteId}`);
    }
    if (validated.epoch.epochUtc !== identity.epochUtc) {
      fail('INVALID_TLE', `${identity.satelliteName} epoch disagrees with its TLE line 1`);
    }
  }

  return fixture;
}

let cached: SixActsTeachingWindowFixture | null = null;

/** The validated teaching window. Throws rather than returning a partial one. */
export function loadSixActsTeachingWindow(): SixActsTeachingWindowFixture {
  if (cached === null) {
    cached = validateSixActsTeachingWindow(generated as unknown as SixActsTeachingWindowFixture);
  }
  return cached;
}

export interface SixActsQualificationSpan {
  /** First instant the offset condition is known to hold. */
  readonly startUtc: string;
  /** The commit instant. */
  readonly endUtc: string;
  readonly durationSec: number;
}

/**
 * The span a live-replay handover must land inside for the director beat to be
 * the fixture's event and not a different one.
 */
export function getSixActsQualificationSpan(
  fixture: SixActsTeachingWindowFixture = loadSixActsTeachingWindow(),
): SixActsQualificationSpan {
  const anchors = fixture.qualification.anchors;
  return Object.freeze({
    startUtc: anchors[0].instantUtc,
    endUtc: fixture.window.triggerInstantUtc,
    durationSec: fixture.qualification.spanSec,
  });
}

/**
 * True when an instant is one of the atlas's coarse forecast anchors.
 *
 * Used for provenance labelling: a value read at one of these instants is
 * SOURCE-class atlas forecast, anything else the run shows is MODEL-DERIVED.
 */
export function isSixActsAtlasForecastInstant(
  instantUtc: string,
  fixture: SixActsTeachingWindowFixture = loadSixActsTeachingWindow(),
): boolean {
  return fixture.atlasForecast.samples.some(sample => sample.instantUtc === instantUtc);
}

/**
 * Checks that a live-replay commit actually reproduced the pinned event.
 *
 * This is the real drift guard, and it is deliberately NOT "a beat must not
 * land on an atlas instant": with a 1 s replay step a legitimate beat can
 * coincide with a 30 s anchor by arithmetic, so that check would fail honest
 * work while proving nothing. What matters is that the live run committed the
 * same handover the fixture pinned. The director never reads a beat time from
 * the fixture at all — there is no code path from here to a timetable — so
 * provenance is structural, and this bounds the drift.
 */
export function assertSixActsCommitMatchesWindow(
  liveCommitInstantMs: number,
  toleranceSec: number,
  fixture: SixActsTeachingWindowFixture = loadSixActsTeachingWindow(),
): number {
  if (!Number.isFinite(toleranceSec) || toleranceSec < 0) {
    fail('COMMIT_DRIFT', 'the drift tolerance must be a non-negative number of seconds');
  }
  const pinnedMs = parseInstant(fixture.window.triggerInstantUtc, 'window.triggerInstantUtc');
  const driftSec = Math.abs(liveCommitInstantMs - pinnedMs) / 1000;
  if (driftSec > toleranceSec) {
    fail(
      'COMMIT_DRIFT',
      `live replay committed ${driftSec} s from the pinned event, beyond the ${toleranceSec} s tolerance`,
    );
  }
  return driftSec;
}
