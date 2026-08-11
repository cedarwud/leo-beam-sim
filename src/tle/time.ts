import { tleFail } from './errors';
import type { UtcInstantInput } from './types';

interface DateTimeParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

const UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?Z$/;
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;

function parseParts(match: RegExpExecArray): DateTimeParts {
  const fraction = match[7] ?? '';
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((fraction + '000').slice(0, 3)),
  };
}

/** Date.UTC treats years 0..99 as 1900..1999; this helper avoids that trap. */
export function utcMillisecondsFromParts(parts: DateTimeParts, offsetMinutes = 0): number {
  const candidate = new Date(0);
  candidate.setUTCFullYear(
    parts.year,
    parts.month - 1,
    parts.day,
  );
  candidate.setUTCHours(
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  const utcMs = candidate.getTime() - offsetMinutes * 60_000;
  const roundTrip = new Date(utcMs + offsetMinutes * 60_000);
  if (
    roundTrip.getUTCFullYear() !== parts.year
    || roundTrip.getUTCMonth() !== parts.month - 1
    || roundTrip.getUTCDate() !== parts.day
    || roundTrip.getUTCHours() !== parts.hour
    || roundTrip.getUTCMinutes() !== parts.minute
    || roundTrip.getUTCSeconds() !== parts.second
    || roundTrip.getUTCMilliseconds() !== parts.millisecond
  ) {
    tleFail('TIMEZONE_INVALID', 'date-time contains an impossible calendar value');
  }
  return utcMs;
}

export function parseUtcInstant(input: UtcInstantInput, label = 'UTC instant'): {
  readonly value: string;
  readonly ms: number;
} {
  if (input instanceof Date) {
    const ms = input.getTime();
    if (!Number.isFinite(ms)) tleFail('REQUESTED_INSTANT_INVALID', `${label} is an invalid Date`);
    return { value: input.toISOString(), ms };
  }
  if (typeof input !== 'string' || input.trim() !== input || input.length === 0) {
    tleFail('REQUESTED_INSTANT_INVALID', `${label} must be an explicit ISO-8601 UTC instant ending in Z`);
  }
  const match = UTC_PATTERN.exec(input);
  if (!match) {
    tleFail('REQUESTED_INSTANT_INVALID', `${label} must be an explicit ISO-8601 UTC instant ending in Z`);
  }
  const parts = parseParts(match);
  const ms = utcMillisecondsFromParts(parts);
  return { value: new Date(ms).toISOString(), ms };
}

export function parseTaipeiLocalDateTime(input: string, label = 'Asia/Taipei local date-time'): {
  readonly value: string;
  readonly ms: number;
} {
  if (typeof input !== 'string' || input.trim() !== input || input.length === 0) {
    tleFail('TIMEZONE_INVALID', `${label} must omit a timezone suffix and use YYYY-MM-DDTHH:mm[:ss[.sss]]`);
  }
  if (/[zZ]|[+-]\d\d(?::?\d\d)?$/.test(input)) {
    tleFail('AMBIGUOUS_LOCAL_TIME', `${label} must not include a UTC offset or timezone suffix`);
  }
  const match = LOCAL_PATTERN.exec(input);
  if (!match) {
    tleFail('TIMEZONE_INVALID', `${label} must use YYYY-MM-DDTHH:mm[:ss[.sss]] without a timezone suffix`);
  }
  const parts = parseParts(match);
  const ms = utcMillisecondsFromParts(parts, 8 * 60);
  return { value: input, ms };
}

export function formatTaipeiLocalDateTime(ms: number): string {
  if (!Number.isFinite(ms)) tleFail('TIMEZONE_INVALID', 'cannot format a non-finite instant');
  const local = new Date(ms + 8 * 60 * 60_000);
  if (!Number.isFinite(local.getTime())) tleFail('TIMEZONE_INVALID', 'instant is outside the supported Date range');
  const pad = (value: number, width: number): string => String(value).padStart(width, '0');
  return `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1, 2)}-${pad(local.getUTCDate(), 2)}T${pad(local.getUTCHours(), 2)}:${pad(local.getUTCMinutes(), 2)}:${pad(local.getUTCSeconds(), 2)}.${pad(local.getUTCMilliseconds(), 3)}`;
}
