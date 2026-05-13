import type { HandoverAction } from '../../engine/handover/types';
import type {
  ModqnBeamReference,
  ModqnBeamState,
  ModqnHandoverEvent,
  ModqnHandoverEventKind,
  ModqnReplayTimelineRow,
} from './types';

export const MODQN_BASELINE_BEAMS_PER_SATELLITE = 7;
export const MODQN_TOTAL_BASELINE_BEAMS = 28;

export const SUPPORTED_MODQN_HANDOVER_EVENT_KINDS = [
  'none',
  'intra-satellite-beam-switch',
  'inter-satellite-handover',
] as const satisfies readonly ModqnHandoverEventKind[];

export const MODQN_BEAM_COUNT_CLAIM_LABELS = {
  7: 'accepted regenerated baseline MODQN evidence path',
  19: 'live sensitivity/demo extension only',
  37: 'live sensitivity/demo extension only',
} as const;

export type ModqnHandoverSemanticKind =
  | 'no-event'
  | 'intra-satellite-beam-handover'
  | 'inter-satellite-handover';

export interface ModqnBeamIdentity {
  readonly producerSatId: string;
  readonly producerSatIndex: number;
  readonly producerBeamId: string;
  readonly producerBeamIndex: number;
  readonly producerLocalBeamIndex: number;
  readonly leoLocalBeamNumericId: number;
  readonly leoGlobalBeamNumericId: number;
}

export interface ModqnUserIdentity {
  readonly producerUserId: string;
  readonly producerUserIndex: number;
  readonly deterministicUserKey: string;
}

export interface ModqnSelectedActionIdentity {
  readonly producerUserId: string;
  readonly producerUserIndex: number;
  readonly selectedActionIndex: number;
  readonly selectedProducerSatId: string;
  readonly selectedProducerBeamId: string;
  readonly selectedLocalBeamIndex: number;
  readonly decisionActionValid: boolean;
  readonly postStepActionValid: boolean;
  readonly decisionVisible: boolean;
  readonly postStepVisible: boolean;
}

export interface ModqnHandoverIdentity {
  readonly producerEventId: string | null;
  readonly producerEventKind: ModqnHandoverEventKind;
  readonly semanticKind: ModqnHandoverSemanticKind;
  readonly leoHandoverAction: HandoverAction;
  readonly fromProducerSatId: string;
  readonly fromProducerBeamId: string;
  readonly toProducerSatId: string;
  readonly toProducerBeamId: string;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}: expected non-negative integer, got ${value}`);
  }
}

export function deriveProducerSatelliteId(satIndex: number): string {
  assertNonNegativeInteger(satIndex, 'satIndex');
  return `sat-${satIndex}`;
}

export function deriveProducerBeamId(satId: string, localBeamIndex: number): string {
  assertNonNegativeInteger(localBeamIndex, 'localBeamIndex');
  return `${satId}-beam-${localBeamIndex}`;
}

export function deriveProducerBeamIndex(
  satIndex: number,
  localBeamIndex: number,
  beamCountPerSatellite = MODQN_BASELINE_BEAMS_PER_SATELLITE,
): number {
  assertNonNegativeInteger(satIndex, 'satIndex');
  assertNonNegativeInteger(localBeamIndex, 'localBeamIndex');
  assertNonNegativeInteger(beamCountPerSatellite, 'beamCountPerSatellite');
  return (satIndex * beamCountPerSatellite) + localBeamIndex;
}

export function deriveLeoLocalBeamNumericId(localBeamIndex: number): number {
  assertNonNegativeInteger(localBeamIndex, 'localBeamIndex');
  return localBeamIndex + 1;
}

export function deriveLeoGlobalBeamNumericId(beamIndex: number): number {
  assertNonNegativeInteger(beamIndex, 'beamIndex');
  return beamIndex + 1;
}

export function deriveProducerUserId(userIndex: number): string {
  assertNonNegativeInteger(userIndex, 'userIndex');
  return `user-${userIndex}`;
}

export function createBeamIdentity(
  beam: ModqnBeamReference,
  beamCountPerSatellite = MODQN_BASELINE_BEAMS_PER_SATELLITE,
): ModqnBeamIdentity {
  const expectedSatId = deriveProducerSatelliteId(beam.satIndex);
  const expectedBeamId = deriveProducerBeamId(beam.satId, beam.localBeamIndex);
  const expectedBeamIndex = deriveProducerBeamIndex(beam.satIndex, beam.localBeamIndex, beamCountPerSatellite);

  if (beam.satId !== expectedSatId) {
    throw new Error(`${beam.beamId}: satId ${beam.satId} does not match satIndex ${beam.satIndex}`);
  }
  if (beam.beamId !== expectedBeamId) {
    throw new Error(`${beam.beamId}: beamId does not match satId + localBeamIndex (${expectedBeamId})`);
  }
  if (beam.beamIndex !== expectedBeamIndex) {
    throw new Error(`${beam.beamId}: beamIndex ${beam.beamIndex} does not match satellite-major ordering ${expectedBeamIndex}`);
  }

  return {
    producerSatId: beam.satId,
    producerSatIndex: beam.satIndex,
    producerBeamId: beam.beamId,
    producerBeamIndex: beam.beamIndex,
    producerLocalBeamIndex: beam.localBeamIndex,
    leoLocalBeamNumericId: deriveLeoLocalBeamNumericId(beam.localBeamIndex),
    leoGlobalBeamNumericId: deriveLeoGlobalBeamNumericId(beam.beamIndex),
  };
}

export function createBeamCatalogByProducerId(
  beamStates: readonly ModqnBeamState[],
): ReadonlyMap<string, ModqnBeamState> {
  return new Map(beamStates.map(beam => [beam.beamId, beam]));
}

export function createUserIdentity(userId: string, userIndex: number): ModqnUserIdentity {
  const expectedUserId = deriveProducerUserId(userIndex);
  if (userId !== expectedUserId) {
    throw new Error(`${userId}: userId does not match userIndex ${userIndex}`);
  }
  return {
    producerUserId: userId,
    producerUserIndex: userIndex,
    deterministicUserKey: `${userId}|${userIndex}`,
  };
}

export function createSelectedActionIdentity(row: ModqnReplayTimelineRow): ModqnSelectedActionIdentity {
  const selectedActionIndex = row.selectedServing.beamIndex;
  assertNonNegativeInteger(selectedActionIndex, 'selectedActionIndex');

  return {
    ...createUserIdentity(row.userId, row.userIndex),
    selectedActionIndex,
    selectedProducerSatId: row.selectedServing.satId,
    selectedProducerBeamId: row.selectedServing.beamId,
    selectedLocalBeamIndex: row.selectedServing.localBeamIndex,
    decisionActionValid: row.decisionActionValidityMask[selectedActionIndex] ?? false,
    postStepActionValid: row.actionValidityMask[selectedActionIndex] ?? false,
    decisionVisible: row.decisionVisibilityMask[selectedActionIndex] ?? false,
    postStepVisible: row.visibilityMask[selectedActionIndex] ?? false,
  };
}

export function adaptModqnHandoverEvent(
  event: ModqnHandoverEvent,
  previousServing: ModqnBeamReference,
  selectedServing: ModqnBeamReference,
): ModqnHandoverIdentity {
  switch (event.kind) {
    case 'none':
      return {
        producerEventId: event.eventId,
        producerEventKind: event.kind,
        semanticKind: 'no-event',
        leoHandoverAction: 'stay',
        fromProducerSatId: previousServing.satId,
        fromProducerBeamId: previousServing.beamId,
        toProducerSatId: selectedServing.satId,
        toProducerBeamId: selectedServing.beamId,
      };
    case 'intra-satellite-beam-switch':
      if (previousServing.satId !== selectedServing.satId) {
        throw new Error(`${event.eventId ?? event.kind}: intra-satellite event crossed satellites`);
      }
      if (previousServing.beamId === selectedServing.beamId) {
        throw new Error(`${event.eventId ?? event.kind}: intra-satellite event did not change beam`);
      }
      return {
        producerEventId: event.eventId,
        producerEventKind: event.kind,
        semanticKind: 'intra-satellite-beam-handover',
        leoHandoverAction: 'intra-switch',
        fromProducerSatId: previousServing.satId,
        fromProducerBeamId: previousServing.beamId,
        toProducerSatId: selectedServing.satId,
        toProducerBeamId: selectedServing.beamId,
      };
    case 'inter-satellite-handover':
      if (previousServing.satId === selectedServing.satId) {
        throw new Error(`${event.eventId ?? event.kind}: inter-satellite event stayed on one satellite`);
      }
      return {
        producerEventId: event.eventId,
        producerEventKind: event.kind,
        semanticKind: 'inter-satellite-handover',
        leoHandoverAction: 'inter-handover',
        fromProducerSatId: previousServing.satId,
        fromProducerBeamId: previousServing.beamId,
        toProducerSatId: selectedServing.satId,
        toProducerBeamId: selectedServing.beamId,
      };
  }
}
