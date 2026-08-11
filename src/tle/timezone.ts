import { parseTaipeiLocalDateTime, parseUtcInstant, formatTaipeiLocalDateTime } from './time';

/**
 * Convert a wall-clock value explicitly labelled Asia/Taipei to UTC.  The
 * input intentionally has no offset: the function supplies the only accepted
 * zone and rejects strings that try to smuggle in a second interpretation.
 */
export function asiaTaipeiToUtc(localDateTime: string): string {
  return parseUtcInstant(new Date(parseTaipeiLocalDateTime(localDateTime).ms), 'converted UTC instant').value;
}

/** Convert an explicit UTC instant to a canonical Asia/Taipei wall-clock value. */
export function utcToAsiaTaipei(utcInstant: string | Date): string {
  const parsed = parseUtcInstant(utcInstant, 'UTC instant');
  return formatTaipeiLocalDateTime(parsed.ms);
}

// Descriptive aliases for callers that prefer conversion-oriented names.
export const taipeiLocalToUtc = asiaTaipeiToUtc;
export const utcToTaipeiLocal = utcToAsiaTaipei;

export { parseTaipeiLocalDateTime, parseUtcInstant };
