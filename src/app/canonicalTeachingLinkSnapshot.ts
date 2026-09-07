import type { CanonicalEeResult } from '../analysis/canonicalEe';
import type {
  CanonicalLinkResult,
  SimulatorEeLedger,
  SimulatorRunAnchorIdentity,
} from '../simulator/types';

export interface CanonicalTeachingLinkSnapshot {
  readonly ueId: string | null;
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly timeSec: number | null;
  readonly thetaDeg: number | null;
  readonly transmitGainLinear: number | null;
  readonly sinrDb: number | null;
  readonly throughputMbps: number | null;
  readonly systemPowerW: number | null;
  readonly energyEfficiencyBitsPerJoule: number | null;
}

type TeachingLinkSource = Pick<
  CanonicalLinkResult,
  'userIndex' | 'userId' | 'beamId' | 'satelliteId' | 'offAxisAngleRad' | 'sinrDb' | 'rateBps'
>;

export interface CanonicalTeachingLinkSnapshotSource {
  readonly links: readonly TeachingLinkSource[];
  readonly candidateLink: Pick<CanonicalLinkResult, 'satelliteId'> | null;
  readonly runAnchor?: Pick<SimulatorRunAnchorIdentity, 'elapsedSec'>;
  readonly canonical: Pick<CanonicalEeResult, 'transmitGainUb'>;
  readonly power: { readonly systemPowerW: number };
  readonly ee: Pick<SimulatorEeLedger, 'instantaneousBitsPerJ'>;
}

function emptyCanonicalTeachingLinkSnapshot(): CanonicalTeachingLinkSnapshot {
  return {
    ueId: null,
    servingSatelliteId: null,
    candidateSatelliteId: null,
    timeSec: null,
    thetaDeg: null,
    transmitGainLinear: null,
    sinrDb: null,
    throughputMbps: null,
    systemPowerW: null,
    energyEfficiencyBitsPerJoule: null,
  };
}

/** Project one accepted canonical frame into the teaching panel's link readout. */
export function deriveCanonicalTeachingLinkSnapshot(
  frame: CanonicalTeachingLinkSnapshotSource | null,
): CanonicalTeachingLinkSnapshot {
  const link = frame?.links[0] ?? null;
  if (frame === null || link === null) return emptyCanonicalTeachingLinkSnapshot();

  return {
    ueId: link.userId,
    servingSatelliteId: link.satelliteId,
    candidateSatelliteId: frame.candidateLink?.satelliteId ?? null,
    timeSec: frame.runAnchor?.elapsedSec ?? null,
    thetaDeg: link.offAxisAngleRad * (180 / Math.PI),
    transmitGainLinear: frame.canonical.transmitGainUb[link.userIndex]?.[link.beamId] ?? null,
    sinrDb: link.sinrDb,
    throughputMbps: link.rateBps / 1e6,
    systemPowerW: frame.power.systemPowerW,
    energyEfficiencyBitsPerJoule: frame.ee.instantaneousBitsPerJ,
  };
}
