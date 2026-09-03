import type { SimulatorParameters } from '../../simulator/types';

/**
 * Parameter fields that are intentionally editable on the canonical input
 * pages.  Every other displayed quantity (p, P^p, ξ, P^N, R and η) is a
 * derived value of the accepted frame and must not be wired to a slider.
 */
export type CanonicalParameterKey =
  | 'beamPowerCapW'
  | 'satellitePowerCapW'
  | 'minimumRateBps'
  | 'systemBandwidthHz'
  | 'etaMax'
  | 'backoffDb'
  | 'rfcPowerW'
  | 'basebandPerSatelliteW';

export interface CanonicalParameterControlContract {
  readonly tab: 'power' | 'throughput' | 'ee';
  readonly testId: string;
  readonly parameterKey: CanonicalParameterKey;
  /** Fields that must be recomputed by the accepted-frame producer. */
  readonly derivedFields: readonly string[];
  /** The one accepted-frame snapshot consumed by both scene and right rail. */
  readonly snapshotOwner: 'accepted-frame';
}

/**
 * Machine-readable ownership map used by the regression gate and by browser
 * evidence.  Keep this list next to the state update function so a newly added
 * slider cannot silently omit its calculation/consumer contract.
 */
export const CANONICAL_PARAMETER_CONTROL_CONTRACTS: readonly CanonicalParameterControlContract[] = [
  {
    tab: 'power',
    testId: 'power-tab-beam-cap-control',
    parameterKey: 'beamPowerCapW',
    derivedFields: ['p', 'P^p', 'P^N', 'R', 'η'],
    snapshotOwner: 'accepted-frame',
  },
  {
    tab: 'power',
    testId: 'power-tab-satellite-cap-control',
    parameterKey: 'satellitePowerCapW',
    derivedFields: ['p', 'P^p', 'P^N', 'R', 'η'],
    snapshotOwner: 'accepted-frame',
  },
  {
    tab: 'throughput',
    testId: 'throughput-tab-minimum-rate-control',
    parameterKey: 'minimumRateBps',
    derivedFields: ['qos'],
    snapshotOwner: 'accepted-frame',
  },
  {
    tab: 'throughput',
    testId: 'throughput-tab-system-bandwidth-control',
    parameterKey: 'systemBandwidthHz',
    derivedFields: ['B^w', 'R', 'total rate', 'η'],
    snapshotOwner: 'accepted-frame',
  },
  {
    tab: 'ee',
    testId: 'ee-tab-eta-max-control',
    parameterKey: 'etaMax',
    derivedFields: ['ξ', 'P^p', 'P^N', 'η'],
    snapshotOwner: 'accepted-frame',
  },
  {
    tab: 'ee',
    testId: 'ee-tab-backoff-control',
    parameterKey: 'backoffDb',
    derivedFields: ['ξ', 'P^p', 'P^N', 'η'],
    snapshotOwner: 'accepted-frame',
  },
  {
    tab: 'ee',
    testId: 'ee-tab-rfc-control',
    parameterKey: 'rfcPowerW',
    derivedFields: ['P^f', 'P^N', 'η'],
    snapshotOwner: 'accepted-frame',
  },
  {
    tab: 'ee',
    testId: 'ee-tab-bb-control',
    parameterKey: 'basebandPerSatelliteW',
    derivedFields: ['P^f', 'P^N', 'η'],
    snapshotOwner: 'accepted-frame',
  },
] as const;

/**
 * Apply one UI input event to the canonical parameter state.  Normalization
 * lives here (rather than in individual JSX callbacks) so tests can exercise
 * the exact event-to-state path without relying on a static HTML render.
 */
export function applyCanonicalParameterChange(
  parameters: SimulatorParameters,
  key: CanonicalParameterKey,
  value: number,
): SimulatorParameters {
  switch (key) {
    case 'minimumRateBps':
      return { ...parameters, minimumRateBps: Math.round(value / 1_000) * 1_000 };
    case 'systemBandwidthHz':
      return { ...parameters, systemBandwidthHz: Math.round(value / 1_000_000) * 1_000_000 };
    default:
      return { ...parameters, [key]: value } as SimulatorParameters;
  }
}

