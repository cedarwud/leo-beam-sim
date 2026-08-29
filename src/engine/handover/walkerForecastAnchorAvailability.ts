import {
  createWalkerForecastAnchor,
  WalkerForecastValidationError,
  type WalkerForecastAnchor,
} from './walkerForecastFrameProvider';

export const WALKER_FORECAST_ANCHOR_UNAVAILABLE_CODES = Object.freeze([
  'lane-not-walker',
  'accepted-frame-missing',
  'source-frame-missing',
  'absolute-time-missing',
  'satellite-geometry-missing',
  'ue-motion-state-missing',
  'beam-identity-missing',
  'beam-axis-missing',
  'schedule-state-missing',
  'load-state-missing',
  'lagged-interference-missing',
  'canonical-config-missing',
  'policy-hash-missing',
  'source-frame-discontinuous',
  'unsupported-beam-hopping',
  'invalid-anchor-facts',
] as const);

export type WalkerForecastAnchorUnavailableCode =
  typeof WALKER_FORECAST_ANCHOR_UNAVAILABLE_CODES[number];

export interface WalkerForecastAnchorUnavailable {
  readonly status: 'unavailable';
  readonly code: WalkerForecastAnchorUnavailableCode;
  readonly sourceFrameId: string | null;
  readonly absoluteUtcMs: number | null;
  readonly detail: string;
}

export interface WalkerForecastAnchorAvailable {
  readonly status: 'available';
  readonly anchor: WalkerForecastAnchor;
}

export type WalkerForecastAnchorAvailability =
  | WalkerForecastAnchorAvailable
  | WalkerForecastAnchorUnavailable;

export type WalkerForecastAnchorAvailabilityInput =
  | {
      readonly status: 'available';
      readonly anchor: WalkerForecastAnchor;
    }
  | WalkerForecastAnchorUnavailable;

function nonEmptyOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function safeUtcOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function validateUnavailable(
  input: WalkerForecastAnchorUnavailable,
): WalkerForecastAnchorUnavailable {
  if (!WALKER_FORECAST_ANCHOR_UNAVAILABLE_CODES.includes(input.code)) {
    throw new TypeError('Walker forecast anchor unavailable code is invalid');
  }
  const sourceFrameId = input.sourceFrameId === null
    ? null
    : nonEmptyOrNull(input.sourceFrameId);
  if (input.sourceFrameId !== null && sourceFrameId === null) {
    throw new TypeError('Walker forecast anchor unavailable sourceFrameId must be non-empty or null');
  }
  const absoluteUtcMs = input.absoluteUtcMs === null
    ? null
    : safeUtcOrNull(input.absoluteUtcMs);
  if (input.absoluteUtcMs !== null && absoluteUtcMs === null) {
    throw new TypeError('Walker forecast anchor unavailable absoluteUtcMs must be a non-negative safe integer or null');
  }
  const detail = nonEmptyOrNull(input.detail);
  if (detail === null) throw new TypeError('Walker forecast anchor unavailable detail must be non-empty');
  return Object.freeze({
    status: 'unavailable',
    code: input.code,
    sourceFrameId,
    absoluteUtcMs,
    detail,
  });
}

/**
 * Normalize one immutable availability result without ever exposing a partial
 * anchor. A later live-runtime adapter remains responsible for collecting the
 * accepted scientific facts. Expected missing facts are supplied as typed
 * unavailable input; malformed supposedly-complete facts are demoted to
 * `invalid-anchor-facts`.
 * Neither path invokes forecast construction, ranking, TTT, selection, or
 * service mutation.
 */
export function resolveWalkerForecastAnchorAvailability(
  request: WalkerForecastAnchorAvailabilityInput,
): WalkerForecastAnchorAvailability {
  if (request.status === 'unavailable') return validateUnavailable(request);
  try {
    return Object.freeze({
      status: 'available',
      anchor: createWalkerForecastAnchor(request.anchor),
    });
  } catch (error) {
    if (!(error instanceof WalkerForecastValidationError)) throw error;
    const anchor = request.anchor as WalkerForecastAnchor | null | undefined;
    return validateUnavailable({
      status: 'unavailable',
      code: error.code === 'UNSUPPORTED_BEAM_HOPPING'
        ? 'unsupported-beam-hopping'
        : 'invalid-anchor-facts',
      sourceFrameId: nonEmptyOrNull(anchor?.sourceFrameId),
      absoluteUtcMs: safeUtcOrNull(anchor?.simTimeMs),
      detail: error.message,
    });
  }
}
