/**
 * Contact Window Labs: Reusable Pure TypeScript Models & React Carriers.
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
 * from orbital ephemeris. They do NOT represent guaranteed RF service.
 */

// Types & Contracts
export * from './types';

// Scientific Boundaries & Disclaimers
export * from './scientificBoundaries';

// Archived TLE & Observer Fixtures
export * from './fixtures';

// Experiment 5 Calculation Model
export * from './singlePassModel';

// Experiment 6 Calculation Model
export * from './multiSatScheduleModel';

// React Carriers (Integration Ready)
export * from './SinglePassContactCarrier';
export * from './MultiSatScheduleCarrier';
export * from './ContactWindowLabsContainer';
