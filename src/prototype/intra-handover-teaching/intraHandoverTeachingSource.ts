import { APP_EPOCH_MS } from '../../app/appRuntimeConfig';
import {
  buildLiveWalkerHandoverEventIndex,
  type LiveWalkerHandoverEvent,
  type LiveWalkerHandoverEventIndex,
} from '../../scene/liveWalkerHandoverEventIndex';
import { loadProfile } from '../../profiles';

/**
 * The episode deliberately consumes the live Walker event-index contract.
 * It does not read a TLE candidate comparison or a presentation-only schedule
 * transition.  The source is built once per route mount and is kept immutable
 * for the whole lesson.
 */
export const INTRA_HANDOVER_TEACHING_SOURCE_CONTRACT = 'live-walker-intra-beam-switch-v1' as const;
export const INTRA_HANDOVER_TEACHING_PROFILE_ID = 'hobs-2024-paper-default' as const;
export const INTRA_HANDOVER_TEACHING_EPOCH_UTC = new Date(APP_EPOCH_MS).toISOString();

export interface IntraHandoverTeachingSource {
  readonly available: true;
  readonly contract: typeof INTRA_HANDOVER_TEACHING_SOURCE_CONTRACT;
  readonly sourceOwner: LiveWalkerHandoverEventIndex['sourceOwner'];
  readonly claimKind: LiveWalkerHandoverEventIndex['claimKind'];
  readonly index: LiveWalkerHandoverEventIndex;
  readonly intraEvent: LiveWalkerHandoverEvent;
  readonly comparisonInterEvent: LiveWalkerHandoverEvent;
  /** The policy offset is published by the event-index generation metadata. */
  readonly offsetDb: number;
  /** This Walker index does not publish a TTT value for a selected event. */
  readonly tttSec: null;
  /** This Walker index does not publish canonical EE for the selected event. */
  readonly eeBitsPerJ: null;
}

export interface IntraHandoverTeachingUnavailable {
  readonly contract: typeof INTRA_HANDOVER_TEACHING_SOURCE_CONTRACT;
  readonly available: false;
  readonly reason: string;
  readonly index: LiveWalkerHandoverEventIndex | null;
}

export type IntraHandoverTeachingSourceResult =
  | (IntraHandoverTeachingSource & { readonly available: true })
  | IntraHandoverTeachingUnavailable;

function finite(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validIntraEvent(event: LiveWalkerHandoverEvent): boolean {
  return event.kind === 'intra'
    && event.fromSatId.trim().length > 0
    && event.fromSatId === event.toSatId
    && event.fromBeamId !== null
    && event.toBeamId !== null
    && event.fromBeamId !== event.toBeamId
    && finite(event.fromSinrDb)
    && finite(event.toSinrDb)
    && finite(event.deltaDb)
    && Number.isFinite(event.sourceTimeSec);
}

function validInterEvent(event: LiveWalkerHandoverEvent): boolean {
  return event.kind === 'inter'
    && event.fromSatId.trim().length > 0
    && event.toSatId.trim().length > 0
    && event.fromSatId !== event.toSatId
    && Number.isFinite(event.sourceTimeSec);
}

function unavailable(
  reason: string,
  index: LiveWalkerHandoverEventIndex | null,
): IntraHandoverTeachingUnavailable {
  return Object.freeze({
    contract: INTRA_HANDOVER_TEACHING_SOURCE_CONTRACT,
    available: false as const,
    reason,
    index,
  });
}

/**
 * Build a deterministic lesson source from the actual Walker event index.
 * Selection is identity- and payload-validated; absence is explicit.
 */
export function buildIntraHandoverTeachingSource(): IntraHandoverTeachingSourceResult {
  let index: LiveWalkerHandoverEventIndex;
  try {
    index = buildLiveWalkerHandoverEventIndex({
      profile: loadProfile(INTRA_HANDOVER_TEACHING_PROFILE_ID),
      epochUtcMs: APP_EPOCH_MS,
      simStepSec: 30,
      claimKind: 'live-truth',
      ueDistributionMode: 'random',
      uePrimaryAnchorMode: 'observer',
      ueDistributionScope: 'service-area',
      ueMobilityMode: 'static',
    });
  } catch (error) {
    return unavailable(
      `Walker event index failed closed: ${error instanceof Error ? error.message : String(error)}`,
      null,
    );
  }

  if (index.sourceGapReasons.length > 0) {
    return unavailable(`Walker event index source gap: ${index.sourceGapReasons.join('; ')}`, index);
  }

  const intraCandidates = index.events.filter(validIntraEvent);
  const intraEvent = intraCandidates.find(event => (
    finite(event.deltaDb) && event.deltaDb >= index.offsetDb
  )) ?? intraCandidates[0];
  const comparisonInterEvent = index.events.find(validInterEvent);

  if (intraEvent === undefined) {
    return unavailable('No source-backed same-satellite, different-beam event is available.', index);
  }
  if (comparisonInterEvent === undefined) {
    return unavailable('No source-backed cross-satellite event is available for the comparison sentence.', index);
  }
  if (intraEvent.fromSatId !== intraEvent.toSatId || intraEvent.fromBeamId === intraEvent.toBeamId) {
    return unavailable('Selected Walker event failed the same-satellite beam-identity invariant.', index);
  }

  return Object.freeze({
    available: true as const,
    contract: INTRA_HANDOVER_TEACHING_SOURCE_CONTRACT,
    sourceOwner: index.sourceOwner,
    claimKind: index.claimKind,
    index,
    intraEvent,
    comparisonInterEvent,
    offsetDb: index.offsetDb,
    tttSec: null,
    eeBitsPerJ: null,
  });
}

/** Narrow validation helper used by the browser validator and pure tests. */
export function sourceIdentityIsTruthful(source: IntraHandoverTeachingSource): boolean {
  return source.available === true
    && source.sourceOwner === 'live-walker'
    && source.intraEvent.fromSatId === source.intraEvent.toSatId
    && source.intraEvent.fromBeamId !== null
    && source.intraEvent.toBeamId !== null
    && source.intraEvent.fromBeamId !== source.intraEvent.toBeamId
    && source.intraEvent.id === source.index.events.find(event => event.id === source.intraEvent.id)?.id
    && source.comparisonInterEvent.fromSatId !== source.comparisonInterEvent.toSatId;
}
