/**
 * Act 2's final beat is a projection of a Starlink canonical Event Atlas
 * receipt.  The selected Starlink atlas contains forced-continuity events but
 * zero valid Offset+TTT inter-handovers.  This module therefore keeps the
 * event type explicit and never turns the forced continuity into a successful
 * handover claim.
 */
export type TleJourneyHandoverState = 'monitoring' | 'pending' | 'forced-continuity';
export type TleJourneyHandoverEvent = 'none' | 'forced-continuity';

export interface TleJourneyHandoverSource {
  readonly eventType: 'forced-continuity';
  readonly eventKey: string;
  readonly traceDigest: string;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly fromSatelliteId: string;
  readonly fromSatelliteName: string;
  readonly toSatelliteId: string;
  readonly toSatelliteName: string;
  readonly triggerInstantUtc: string;
  readonly offsetDb: number;
  readonly tttSec: number;
  readonly sourcePath: string;
  readonly sourceArchiveId: string;
  readonly sourcePublicationSha256: string;
  readonly fromTleLine1: string;
  readonly fromTleLine2: string;
  readonly toTleLine1: string;
  readonly toTleLine2: string;
}

export interface TleJourneyHandoverFrame {
  readonly state: TleJourneyHandoverState;
  readonly event: TleJourneyHandoverEvent;
  readonly progressSec: number;
  readonly ratio: number;
  readonly servingSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly eventFromSatelliteId: string | null;
  readonly eventToSatelliteId: string | null;
  readonly source: TleJourneyHandoverSource;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

/**
 * First forced-continuity receipt in the checked-in 2026-08-25 default
 * Starlink run. The IDs, names, event time, trace identity, and publication
 * digest are copied from that artifact; no alternate Starlink pair is
 * invented.
 */
const STARLINK_FORCED_CONTINUITY_SOURCE: TleJourneyHandoverSource = Object.freeze({
  eventType: 'forced-continuity' as const,
  eventKey: 'tle-event-v1-13fa6eb6',
  traceDigest: 'tle-trace-v1-30d1ca3b',
  analysisRunId: 'analysis-run-4d04f35b',
  geometryRunId: 'tle-run:starlink-20250727-20260824-3d746ccc21a6:e7e916df23f0e58398e94f03aeb9869a6d89900b882349e541cdb3349df21e00:2026-08-25T12%3A00%3A00.000Z:7200:30:a64664d6',
  fromSatelliteId: '62311',
  fromSatelliteName: 'STARLINK-32700',
  toSatelliteId: '53838',
  toSatelliteName: 'STARLINK-4773',
  triggerInstantUtc: '2026-08-25T12:06:00.000Z',
  offsetDb: 3,
  tttSec: 30,
  sourcePath: '/tle-archive/starlink/starlink_20260824.tle',
  sourceArchiveId: 'starlink-20250727-20260824-3d746ccc21a6',
  sourcePublicationSha256: 'e7e916df23f0e58398e94f03aeb9869a6d89900b882349e541cdb3349df21e00',
  fromTleLine1: '1 62311U 24239L   26236.10533130  .00023880  00000+0  71521-3 0  9997',
  fromTleLine2: '2 62311  53.1573 121.5507 0001038  92.5468 267.5654 15.34419904 95218',
  toTleLine1: '1 53838U 22114W   26236.37247313 -.00000912  00000+0 -39237-4 0  9997',
  toTleLine2: '2 53838  53.1592 261.0347 0001289  80.2978 279.8159 15.08837800218283',
});

/**
 * The handover stage has one authored transition at the midpoint of its beat.
 * Before that point, the archived source identity remains serving while the
 * source-backed target is only monitored; no Offset+TTT qualification is
 * claimed. At the midpoint the forced-continuity event is made visible and
 * the serving identity changes to the target.
 */
export function getTleJourneyHandoverFrame(
  beatProgress: number,
  source: TleJourneyHandoverSource = STARLINK_FORCED_CONTINUITY_SOURCE,
): TleJourneyHandoverFrame {
  const progress = clampProgress(beatProgress);
  const committed = progress >= 0.5;
  const pending = !committed && progress > 0;

  return Object.freeze({
    state: committed ? 'forced-continuity' : pending ? 'pending' : 'monitoring',
    event: committed ? 'forced-continuity' : 'none',
    progressSec: committed ? 0 : 0,
    // Visual replay timeline only. It must not be interpreted as Offset+TTT
    // qualification progress for this forced-continuity receipt.
    ratio: progress,
    servingSatelliteId: committed ? source.toSatelliteId : source.fromSatelliteId,
    candidateSatelliteId: committed ? null : source.toSatelliteId,
    eventFromSatelliteId: committed ? source.fromSatelliteId : null,
    eventToSatelliteId: committed ? source.toSatelliteId : null,
    source,
  });
}

export const TLE_JOURNEY_HANDOVER_SOURCE: TleJourneyHandoverSource = Object.freeze(
  STARLINK_FORCED_CONTINUITY_SOURCE,
);
