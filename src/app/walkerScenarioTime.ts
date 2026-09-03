import {
  LATEST_TLE_REFERENCE_INSTANT_UTC,
  LATEST_TLE_REFERENCE_TAIPEI_LOCAL,
} from '../tle/latestTleDefaults';

/**
 * Walker remains the homepage producer. Its initial civil time is aligned to
 * the latest checked-in TLE teaching reference only so every surface opens on
 * the same date; changing this value never selects or propagates a TLE.
 */
export const DEFAULT_WALKER_SCENARIO_DATE = LATEST_TLE_REFERENCE_TAIPEI_LOCAL.slice(0, 10);
export const DEFAULT_WALKER_SCENARIO_TIME = LATEST_TLE_REFERENCE_TAIPEI_LOCAL.slice(11, 16);
export const DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS = Date.parse(LATEST_TLE_REFERENCE_INSTANT_UTC);

const TAIPEI_UTC_OFFSET_MINUTES = 8 * 60;

/**
 * Convert the homepage's minute-resolution Asia/Taipei civil time to an
 * explicit UTC epoch. Taiwan has used UTC+08:00 throughout the simulator's
 * supported teaching dates, so this conversion has no daylight-saving branch.
 * Invalid or partial browser input fails closed to `null`.
 */
export function taipeiScenarioTimeToUtcMs(date: string, time: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (dateMatch === null || timeMatch === null) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (
    month < 1 || month > 12
    || day < 1 || day > 31
    || hour < 0 || hour > 23
    || minute < 0 || minute > 59
  ) return null;

  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const normalizedLocal = new Date(localAsUtcMs);
  if (
    normalizedLocal.getUTCFullYear() !== year
    || normalizedLocal.getUTCMonth() !== month - 1
    || normalizedLocal.getUTCDate() !== day
    || normalizedLocal.getUTCHours() !== hour
    || normalizedLocal.getUTCMinutes() !== minute
  ) return null;

  return localAsUtcMs - TAIPEI_UTC_OFFSET_MINUTES * 60_000;
}
