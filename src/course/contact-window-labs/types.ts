/**
 * Pure TypeScript types and contracts for teaching contact window experiments.
 *
 * Experiment 5: Single archived TLE + NTPU ground observer, adjustable minimum
 * elevation (5°, 10°, 20°, 30°), computing AOS, Peak, LOS, and duration from
 * SGP4 WGS84 topocentric geometry.
 *
 * Experiment 6: 24-hour multi-satellite contact schedule, pass extraction,
 * total contact minutes, longest outage, and overlap count.
 *
 * Scientific Boundary:
 * All results represent geometric line-of-sight contact opportunities derived
 * from orbital ephemeris. They do NOT represent guaranteed RF service (no link
 * margin, antenna pointing latency, doppler lock time, or interference).
 */

export const SUPPORTED_ELEVATION_MASKS_DEG = Object.freeze([5, 10, 20, 30] as const);
export type SupportedElevationMaskDeg = typeof SUPPORTED_ELEVATION_MASKS_DEG[number];

export interface ObserverLocation {
  readonly id: string;
  readonly label: string;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly heightKm: number;
}

export interface SatelliteTleRecord {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly line1: string;
  readonly line2: string;
  readonly epochUtc?: string;
  readonly sourcePath?: string;
  readonly constellation?: string;
  readonly orbitalPlane?: string;
  readonly noradCatalogId?: number;
}

export interface TopocentricLookPoint {
  readonly instantUtc: string;
  readonly instantMs: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
  readonly visible: boolean;
}

export interface PassBoundaryEvent {
  readonly instantUtc: string;
  readonly instantMs: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
}

export interface AosEvent extends PassBoundaryEvent {
  readonly eventType: 'AOS';
}

export interface PeakEvent extends PassBoundaryEvent {
  readonly eventType: 'PEAK';
  readonly maxElevationDeg: number;
}

export interface LosEvent extends PassBoundaryEvent {
  readonly eventType: 'LOS';
}

export interface SinglePassRequest {
  readonly tle: SatelliteTleRecord;
  readonly observer?: ObserverLocation;
  readonly minimumElevationDeg: number;
  readonly searchStartUtc: string;
  readonly searchDurationSec?: number;
  readonly sampleStepSec?: number;
}

export interface MultiMaskComparisonRow {
  readonly elevationMaskDeg: number;
  readonly hasContact: boolean;
  readonly aosUtc?: string;
  readonly peakUtc?: string;
  readonly losUtc?: string;
  readonly durationSec?: number;
  readonly durationMinutes?: number;
  readonly peakElevationDeg?: number;
  readonly peakAzimuthDeg?: number;
  readonly peakRangeKm?: number;
}

export interface CalculationProvenance {
  readonly model: string;
  readonly propagationModel: 'SGP4';
  readonly coordinateFrame: 'TEME -> ECEF -> WGS84 Topocentric';
  readonly observerId: string;
  readonly calculatedAtUtc: string;
  readonly scientificCategory: 'GEOMETRIC_CONTACT_OPPORTUNITY';
  readonly isGuaranteedRfService: false;
  readonly boundaryDisclaimer: string;
}

export interface SinglePassContactResult {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly epochUtc: string;
  readonly observer: ObserverLocation;
  readonly minimumElevationDeg: number;
  readonly searchStartUtc: string;
  readonly searchEndUtc: string;
  readonly hasContact: boolean;
  readonly aos: AosEvent | null;
  readonly peak: PeakEvent | null;
  readonly los: LosEvent | null;
  readonly durationSec: number;
  readonly durationMinutes: number;
  readonly trajectory: readonly TopocentricLookPoint[];
  readonly multiMaskComparison: readonly MultiMaskComparisonRow[];
  readonly provenance: CalculationProvenance;
}

export interface SatellitePassWindow {
  readonly passId: string;
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly passIndex: number;
  readonly aos: AosEvent;
  readonly peak: PeakEvent;
  readonly los: LosEvent;
  readonly durationSec: number;
  readonly durationMinutes: number;
  readonly orbitalPlane?: string;
}

export interface OutageInterval {
  readonly outageId: string;
  readonly startUtc: string;
  readonly startMs: number;
  readonly endUtc: string;
  readonly endMs: number;
  readonly durationSec: number;
  readonly durationMinutes: number;
  readonly previousPassSatelliteName?: string;
  readonly nextPassSatelliteName?: string;
}

export interface OverlapInterval {
  readonly overlapId: string;
  readonly startUtc: string;
  readonly startMs: number;
  readonly endUtc: string;
  readonly endMs: number;
  readonly durationSec: number;
  readonly durationMinutes: number;
  readonly overlappingSatellites: readonly {
    readonly satelliteId: string;
    readonly satelliteName: string;
  }[];
  readonly satelliteCount: number;
}

export interface ScheduleInterval {
  readonly intervalIndex: number;
  readonly startUtc: string;
  readonly startMs: number;
  readonly endUtc: string;
  readonly endMs: number;
  readonly durationSec: number;
  readonly durationMinutes: number;
  readonly concurrency: number;
  readonly isOutage: boolean;
  readonly isOverlap: boolean;
  readonly activeSatellites: readonly {
    readonly satelliteId: string;
    readonly satelliteName: string;
  }[];
}

export interface MultiSatScheduleRequest {
  readonly satellites: readonly SatelliteTleRecord[];
  readonly observer?: ObserverLocation;
  readonly minimumElevationDeg: number;
  readonly startUtc: string;
  readonly durationHours?: number;
  readonly sampleStepSec?: number;
}

export interface MultiSatScheduleResult {
  readonly windowStartUtc: string;
  readonly windowEndUtc: string;
  readonly durationHours: number;
  readonly observer: ObserverLocation;
  readonly minimumElevationDeg: number;
  readonly satelliteCount: number;
  readonly totalPassesCount: number;
  readonly passes: readonly SatellitePassWindow[];
  readonly passesBySatellite: Readonly<Record<string, readonly SatellitePassWindow[]>>;
  readonly totalContactOpportunityMinutes: number;
  readonly totalMergedContactCoverageMinutes: number;
  readonly coverageDutyCyclePercent: number;
  readonly longestOutage: OutageInterval | null;
  readonly outages: readonly OutageInterval[];
  readonly totalOutageMinutes: number;
  readonly overlapCount: number;
  readonly overlaps: readonly OverlapInterval[];
  readonly maxConcurrentSatellites: number;
  readonly timelineIntervals: readonly ScheduleInterval[];
  readonly concurrencyDistributionMinutes: Readonly<Record<number, number>>;
  readonly averagePassDurationMinutes: number;
  readonly provenance: CalculationProvenance;
}

export interface SingleReceiverSchedule {
  readonly objective: 'MAXIMUM_GEOMETRIC_OPPORTUNITY_DURATION';
  readonly assumption: 'ONE_TRACKING_CHANNEL_ZERO_SWITCH_GUARD';
  readonly windows: readonly SatellitePassWindow[];
  readonly totalDurationMinutes: number;
}
