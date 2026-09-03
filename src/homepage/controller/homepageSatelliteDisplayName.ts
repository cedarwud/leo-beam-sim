/**
 * Homepage-only satellite naming adapter.
 *
 * A TLE-backed homepage must show the exact name carried by the active TLE
 * propagation frame. Walker has no TLE name record at this boundary, so it
 * uses the existing stable compact formatter as its explicit fallback. The
 * adapter is display-only: raw satellite IDs remain the join/decision keys.
 */
import { formatSatelliteLabel } from '../../utils/formatSatelliteLabel';

export interface HomepageSatelliteNameRecord {
  readonly satelliteId: string;
  readonly satelliteName: string;
}

export function buildHomepageSatelliteDisplayNameMap(
  satellites: readonly HomepageSatelliteNameRecord[] | null | undefined,
): ReadonlyMap<string, string> | null {
  if (satellites === null || satellites === undefined || satellites.length === 0) return null;
  const names = new Map<string, string>();
  for (const satellite of satellites) {
    const satelliteId = satellite.satelliteId.trim();
    const satelliteName = satellite.satelliteName.trim();
    if (satelliteId.length === 0 || satelliteName.length === 0) continue;
    names.set(satelliteId, satelliteName);
  }
  return names.size === 0 ? null : names;
}

export function resolveHomepageSatelliteDisplayName(
  satelliteId: string | null | undefined,
  names?: ReadonlyMap<string, string> | null,
): string {
  if (satelliteId === null || satelliteId === undefined || satelliteId.length === 0) return '—';
  const sourceName = names?.get(satelliteId)?.trim();
  return sourceName && sourceName.length > 0
    ? sourceName
    : formatSatelliteLabel(satelliteId);
}
