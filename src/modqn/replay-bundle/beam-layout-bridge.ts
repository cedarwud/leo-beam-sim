import {
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  createBeamIdentity,
} from './identity';
import type { ModqnBeamReference } from './types';

export type ModqnSatelliteIdBridgeTable =
  | Readonly<Record<string, string>>
  | ReadonlyMap<string, string>;

export interface ModqnBeamLayoutBridgeOptions {
  readonly beamCountPerSatellite?: number;
  readonly coreLayoutSatIdsByProducerSatId?: ModqnSatelliteIdBridgeTable;
  readonly leoSceneSatIdsByProducerSatId?: ModqnSatelliteIdBridgeTable;
}

export interface ModqnBeamLayoutBridgeIdentity {
  readonly producerSatId: string;
  readonly producerSatIndex: number;
  readonly producerBeamId: string;
  readonly producerBeamIndex: number;
  readonly producerLocalBeamIndex: number;
  readonly coreLayoutSatId: string;
  readonly coreBeamId: string;
  readonly leoSceneSatId: string;
  readonly leoLocalBeamNumericId: number;
  readonly leoGlobalBeamNumericId: number;
}

export type ModqnBeamCountBridgeClaimKind =
  | 'accepted-regenerated-baseline-evidence'
  | 'live-sensitivity-demo-only'
  | 'unsupported';

export interface ModqnBeamCountBridgeClaim {
  readonly beamCount: number;
  readonly kind: ModqnBeamCountBridgeClaimKind;
  readonly label: string;
  readonly supportsProducerReplayEvidence: boolean;
  readonly mayDeriveProducerBeamIdentity: boolean;
}

function assertNonEmptyString(value: string, label: string): void {
  if (value.length === 0) {
    throw new Error(`${label}: expected non-empty string`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}: expected non-negative integer, got ${value}`);
  }
}

function resolveBeamCountPerSatellite(options: ModqnBeamLayoutBridgeOptions): number {
  return options.beamCountPerSatellite ?? MODQN_BASELINE_BEAMS_PER_SATELLITE;
}

function assertMayDeriveProducerBeamIdentity(beamCountPerSatellite: number): ModqnBeamCountBridgeClaim {
  const claim = getModqnBeamCountBridgeClaim(beamCountPerSatellite);
  if (claim.mayDeriveProducerBeamIdentity !== true) {
    throw new Error(
      `beamCountPerSatellite ${beamCountPerSatellite} is ${claim.kind}; ` +
        'producer replay identity may only be derived for the accepted 7-beam baseline path',
    );
  }
  return claim;
}

function readBridgeTable(
  table: ModqnSatelliteIdBridgeTable | undefined,
  producerSatId: string,
  label: string,
): string | undefined {
  if (table === undefined) return undefined;

  let value: string | undefined;
  if (table instanceof Map) {
    value = table.get(producerSatId);
  } else {
    const record = table as Readonly<Record<string, string>>;
    value = Object.prototype.hasOwnProperty.call(record, producerSatId)
      ? record[producerSatId]
      : undefined;
  }

  if (value === undefined) {
    throw new Error(`${label}: missing mapping for producer satellite ${producerSatId}`);
  }

  assertNonEmptyString(value, `${label}.${producerSatId}`);
  return value;
}

export function deriveCoreBeamId(coreLayoutSatId: string, localBeamIndex: number): string {
  assertNonEmptyString(coreLayoutSatId, 'coreLayoutSatId');
  assertNonNegativeInteger(localBeamIndex, 'localBeamIndex');
  return `${coreLayoutSatId}-b${localBeamIndex}`;
}

export function resolveCoreLayoutSatId(
  producerSatId: string,
  table?: ModqnSatelliteIdBridgeTable,
): string {
  assertNonEmptyString(producerSatId, 'producerSatId');
  return readBridgeTable(table, producerSatId, 'coreLayoutSatIdsByProducerSatId') ?? producerSatId;
}

export function resolveLeoSceneSatId(
  producerSatId: string,
  table?: ModqnSatelliteIdBridgeTable,
): string {
  assertNonEmptyString(producerSatId, 'producerSatId');
  return readBridgeTable(table, producerSatId, 'leoSceneSatIdsByProducerSatId') ?? producerSatId;
}

export function createBeamLayoutBridgeIdentity(
  beam: ModqnBeamReference,
  options: ModqnBeamLayoutBridgeOptions = {},
): ModqnBeamLayoutBridgeIdentity {
  const beamCountPerSatellite = resolveBeamCountPerSatellite(options);
  assertMayDeriveProducerBeamIdentity(beamCountPerSatellite);
  const producerIdentity = createBeamIdentity(beam, beamCountPerSatellite);
  const coreLayoutSatId = resolveCoreLayoutSatId(
    producerIdentity.producerSatId,
    options.coreLayoutSatIdsByProducerSatId,
  );
  const leoSceneSatId = resolveLeoSceneSatId(
    producerIdentity.producerSatId,
    options.leoSceneSatIdsByProducerSatId,
  );

  return {
    producerSatId: producerIdentity.producerSatId,
    producerSatIndex: producerIdentity.producerSatIndex,
    producerBeamId: producerIdentity.producerBeamId,
    producerBeamIndex: producerIdentity.producerBeamIndex,
    producerLocalBeamIndex: producerIdentity.producerLocalBeamIndex,
    coreLayoutSatId,
    coreBeamId: deriveCoreBeamId(coreLayoutSatId, producerIdentity.producerLocalBeamIndex),
    leoSceneSatId,
    leoLocalBeamNumericId: producerIdentity.leoLocalBeamNumericId,
    leoGlobalBeamNumericId: producerIdentity.leoGlobalBeamNumericId,
  };
}

export function createBeamLayoutBridgeCatalogByProducerId(
  beams: readonly ModqnBeamReference[],
  options: ModqnBeamLayoutBridgeOptions = {},
): ReadonlyMap<string, ModqnBeamLayoutBridgeIdentity> {
  assertMayDeriveProducerBeamIdentity(resolveBeamCountPerSatellite(options));
  const catalog = new Map<string, ModqnBeamLayoutBridgeIdentity>();

  for (const beam of beams) {
    const identity = createBeamLayoutBridgeIdentity(beam, options);
    if (catalog.has(identity.producerBeamId)) {
      throw new Error(`${identity.producerBeamId}: duplicate producer beam ID`);
    }
    catalog.set(identity.producerBeamId, identity);
  }

  return catalog;
}

export function getModqnBeamCountBridgeClaim(beamCount: number): ModqnBeamCountBridgeClaim {
  if (beamCount === 7) {
    return {
      beamCount,
      kind: 'accepted-regenerated-baseline-evidence',
      label: MODQN_BEAM_COUNT_CLAIM_LABELS[7],
      supportsProducerReplayEvidence: true,
      mayDeriveProducerBeamIdentity: true,
    };
  }

  if (beamCount === 19 || beamCount === 37) {
    return {
      beamCount,
      kind: 'live-sensitivity-demo-only',
      label: MODQN_BEAM_COUNT_CLAIM_LABELS[beamCount],
      supportsProducerReplayEvidence: false,
      mayDeriveProducerBeamIdentity: false,
    };
  }

  return {
    beamCount,
    kind: 'unsupported',
    label: 'unsupported by the MODQN baseline bridge',
    supportsProducerReplayEvidence: false,
    mayDeriveProducerBeamIdentity: false,
  };
}
