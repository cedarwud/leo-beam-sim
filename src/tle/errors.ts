export type TleErrorCode =
  | 'INVALID_MANIFEST'
  | 'INVALID_ENTRY'
  | 'INVALID_IDENTITY'
  | 'CHECKSUM_MISMATCH'
  | 'INVALID_TLE_LINE'
  | 'INVALID_EPOCH'
  | 'DUPLICATE_EPOCH'
  | 'CONFLICTING_EPOCH'
  | 'REQUESTED_INSTANT_INVALID'
  | 'SATELLITE_ID_REQUIRED'
  | 'SATELLITE_NOT_FOUND'
  | 'NO_PRIOR_SNAPSHOT'
  | 'STALE_SNAPSHOT'
  | 'PROPAGATION_FAILED'
  | 'TIMEZONE_INVALID'
  | 'AMBIGUOUS_LOCAL_TIME';

/**
 * Every refusal at the archived-TLE boundary is typed so a controller can
 * preserve its last accepted frame and explain why a new one was refused.
 */
export class TleArchiveError extends Error {
  readonly code: TleErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: TleErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'TleArchiveError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function tleFail(
  code: TleErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new TleArchiveError(code, message, details);
}

export function isTleArchiveError(error: unknown): error is TleArchiveError {
  return error instanceof TleArchiveError;
}
