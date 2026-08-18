import {
  assertSupportedBeamLayoutCount,
  ringCountForSupportedBeamLayout,
  type HexBeamLayout,
  type HexBeamPosition,
  type SupportedBeamLayoutCount,
} from './beamLayoutCatalog';
import {
  classifyServiceTransition,
  createBeamIlluminationPolicy,
  realizeBeamIllumination,
  scheduleEligibleBeamPositions,
  type BeamAssociation,
  type BeamId,
  type BeamIlluminationMode,
  type BeamIlluminationPolicy,
  type BeamPosition,
  type ServiceAssociation,
  type ServiceTransitionKind,
  type UserId,
} from './beamIlluminationPolicy';

/** Versioned, immutable read model for one accepted beam-schedule trace. */
export const BEAM_SCHEDULE_TRACE_SCHEMA = 'visual-lab-beam-schedule-trace-v1' as const;

/**
 * This is service-pair evidence only.  It deliberately is not a handover
 * story/event contract: a higher layer still needs aligned accepted
 * before/decision/after anchors before it may publish an intra-handover story.
 */
export const BEAM_SCHEDULE_TRACE_EVIDENCE_BASIS =
  'consecutive-accepted-slot-service-pairs' as const;

export interface BeamScheduleSlotIdentity {
  /** Stable identity supplied by the accepted run owner. */
  readonly slotId: string;
  /** Policy slot index; no synthetic sub-anchor slots are created here. */
  readonly slotIndex: number;
  /** Accepted scientific anchor carrying this slot. */
  readonly anchorIndex: number;
  readonly anchorTimeSec: number;
  readonly instantUtc: string;
}

/**
 * One complete per-UE serving-pair entry.  A null pair is explicit service
 * loss/unattached state; omission is not used to manufacture a transition.
 * Beam ids are local to their satellite layout.
 */
export interface BeamScheduleServiceAssociation {
  readonly userId: UserId;
  readonly satelliteId: string | null;
  readonly beamId: BeamId | null;
}

export interface BeamScheduleSatelliteInput {
  /** One complete-ring 1/7/19 layout for this satellite only. */
  readonly layout: HexBeamLayout;
  readonly mode: BeamIlluminationMode;
  /** Explicit policy input; the trace chooses no product default. */
  readonly maxEligiblePerSlot: number;
  /** Fixed-mode subset. Beam Hopping rejects this field. */
  readonly fixedBeamIds?: readonly BeamId[];
}

export interface BeamScheduleTraceSlotInput {
  readonly identity: BeamScheduleSlotIdentity;
  /** Complete, stable UE domain for every slot in the trace. */
  readonly associations: readonly BeamScheduleServiceAssociation[];
}

export interface BeamScheduleTraceBuildInput {
  /** Accepted scientific run identity that owns every slot below. */
  readonly analysisRunId: string;
  /** Completed archived-TLE geometry run that owns the anchor axis. */
  readonly geometryRunId: string;
  /** Each satellite owns its own complete-ring layout and policy. */
  readonly satellites: readonly BeamScheduleSatelliteInput[];
  readonly slots: readonly BeamScheduleTraceSlotInput[];
}

export interface BeamScheduleSatelliteTrace {
  readonly satelliteId: string;
  readonly layout: HexBeamLayout;
  readonly policy: BeamIlluminationPolicy;
}

/** One satellite-local schedule/realization at an accepted slot. */
export interface BeamScheduleSatelliteSlot {
  readonly satelliteId: string;
  readonly layoutBeamCount: SupportedBeamLayoutCount;
  readonly mode: BeamIlluminationMode;
  readonly slotIndex: number;
  /** Candidate and eligible identities retain the satellite-local namespace. */
  readonly candidateBeamPositions: readonly BeamPosition[];
  readonly eligibleBeamPositions: readonly BeamPosition[];
  readonly eligibleBeamIds: readonly BeamId[];
  /** Aligned to candidateBeamPositions; active iff corresponding load > 0. */
  readonly beamLoad: readonly number[];
  readonly activeBeamMask: readonly boolean[];
  readonly activeBeamIds: readonly BeamId[];
}

export interface BeamScheduleTraceSlot {
  readonly identity: BeamScheduleSlotIdentity;
  readonly associations: readonly BeamScheduleServiceAssociation[];
  readonly satelliteSlots: readonly BeamScheduleSatelliteSlot[];
}

export interface BeamScheduleTransitionEvidence {
  readonly userId: UserId;
  readonly fromSlot: BeamScheduleSlotIdentity;
  readonly toSlot: BeamScheduleSlotIdentity;
  readonly from: ServiceAssociation | null;
  readonly to: ServiceAssociation | null;
  /** Classification of consecutive service pairs, not a story/event claim. */
  readonly kind: ServiceTransitionKind;
  readonly servicePairChanged: boolean;
  /** Schedule/active changes are retained as evidence, even when kind is stay. */
  readonly scheduleChanged: boolean;
  readonly activeMaskChanged: boolean;
  readonly changedSatelliteIds: readonly string[];
  readonly basis: typeof BEAM_SCHEDULE_TRACE_EVIDENCE_BASIS;
}

export interface BeamScheduleTrace {
  readonly schemaVersion: typeof BEAM_SCHEDULE_TRACE_SCHEMA;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  /** Deterministic identity of the normalized trace contents. */
  readonly traceDigest: string;
  readonly satellites: readonly BeamScheduleSatelliteTrace[];
  readonly slots: readonly BeamScheduleTraceSlot[];
  /** No handover event/story is manufactured by this domain layer. */
  readonly transitionEvidence: readonly BeamScheduleTransitionEvidence[];
}

interface NormalizedSatellite {
  readonly satelliteId: string;
  readonly layout: HexBeamLayout;
  readonly policy: BeamIlluminationPolicy;
}

interface NormalizedAssociation extends BeamScheduleServiceAssociation {
  readonly userKey: string;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function nonNegativeFinite(value: number, label: string): number {
  const next = finite(value, label);
  if (next < 0) throw new RangeError(`${label} must be non-negative`);
  return next;
}

function nonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
  return value;
}

function safeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
  return value;
}

function nonNegativeInteger(value: number, label: string): number {
  const next = safeInteger(value, label);
  if (next < 0) throw new RangeError(`${label} must be a non-negative integer`);
  return next;
}

function userKey(userId: UserId): string {
  if (typeof userId === 'string') return `s:${userId}`;
  if (!Number.isFinite(userId)) throw new RangeError('userId number must be finite');
  return `n:${userId}`;
}

function compareUserKey(left: NormalizedAssociation, right: NormalizedAssociation): number {
  return left.userKey.localeCompare(right.userKey);
}

function cloneLayout(layout: HexBeamLayout): HexBeamLayout {
  if (layout === null || typeof layout !== 'object') throw new TypeError('layout must be an object');
  const beamCount = assertSupportedBeamLayoutCount(layout.beamCount);
  const ringCount = ringCountForSupportedBeamLayout(beamCount);
  if (layout.ringCount !== ringCount) {
    throw new RangeError(`layout ${String(layout.satelliteId)} has an inconsistent ringCount`);
  }
  const satelliteId = nonEmpty(layout.satelliteId, 'layout.satelliteId');
  if (!Array.isArray(layout.beamPositions) || layout.beamPositions.length !== beamCount) {
    throw new RangeError(`layout ${satelliteId} must contain exactly ${beamCount} beam positions`);
  }
  finite(layout.halfPowerBeamWidthDeg, 'layout.halfPowerBeamWidthDeg');
  finite(layout.adjacentSpacingUv, 'layout.adjacentSpacingUv');

  const beamIds = new Set<number>();
  const positions = layout.beamPositions.map((position, index) => {
    if (position === null || typeof position !== 'object') {
      throw new TypeError(`layout.beamPositions[${index}] must be an object`);
    }
    const beamId = nonNegativeInteger(position.beamId, `layout.beamPositions[${index}].beamId`);
    if (beamId >= beamCount) {
      throw new RangeError(`layout beamId ${beamId} is outside the local [0, ${beamCount - 1}] namespace`);
    }
    if (beamIds.has(beamId)) throw new RangeError(`layout has duplicate beamId ${beamId}`);
    beamIds.add(beamId);
    if (position.satelliteId !== satelliteId) {
      throw new RangeError(`layout beam ${beamId} satelliteId disagrees with layout`);
    }
    nonNegativeInteger(position.tier, `layout.beamPositions[${index}].tier`);
    safeInteger(position.axialQ, `layout.beamPositions[${index}].axialQ`);
    safeInteger(position.axialR, `layout.beamPositions[${index}].axialR`);
    finite(position.u, `layout.beamPositions[${index}].u`);
    finite(position.v, `layout.beamPositions[${index}].v`);
    return freeze({
      beamId,
      satelliteId,
      tier: position.tier,
      axialQ: position.axialQ,
      axialR: position.axialR,
      u: position.u,
      v: position.v,
    });
  });
  for (let beamId = 0; beamId < beamCount; beamId += 1) {
    if (!beamIds.has(beamId)) throw new RangeError(`layout is missing local beamId ${beamId}`);
  }
  positions.sort((left, right) => left.beamId - right.beamId);

  return freeze({
    satelliteId,
    ringCount,
    beamCount,
    halfPowerBeamWidthDeg: layout.halfPowerBeamWidthDeg,
    adjacentSpacingUv: layout.adjacentSpacingUv,
    beamPositions: freeze(positions) as readonly HexBeamPosition[],
    source: layout.source,
  });
}

function normalizeSatellites(
  inputs: readonly BeamScheduleSatelliteInput[],
): readonly NormalizedSatellite[] {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new RangeError('satellites must contain at least one satellite layout');
  }
  const ids = new Set<string>();
  const normalized = inputs.map((input, index) => {
    if (input === null || typeof input !== 'object') {
      throw new TypeError(`satellites[${index}] must be an object`);
    }
    const layout = cloneLayout(input.layout);
    if (ids.has(layout.satelliteId)) {
      throw new RangeError(`duplicate satellite layout ${layout.satelliteId}`);
    }
    ids.add(layout.satelliteId);
    const policy = createBeamIlluminationPolicy({
      mode: input.mode,
      candidateBeamPositions: layout.beamPositions,
      maxEligiblePerSlot: input.maxEligiblePerSlot,
      ...(input.fixedBeamIds === undefined ? {} : { fixedBeamIds: input.fixedBeamIds }),
    });
    return { satelliteId: layout.satelliteId, layout, policy };
  });
  normalized.sort((left, right) => left.satelliteId.localeCompare(right.satelliteId));
  return freeze(normalized);
}

function normalizeSlotIdentity(identity: BeamScheduleSlotIdentity): BeamScheduleSlotIdentity {
  if (identity === null || typeof identity !== 'object') throw new TypeError('slot identity must be an object');
  return freeze({
    slotId: nonEmpty(identity.slotId, 'slotId'),
    slotIndex: nonNegativeInteger(identity.slotIndex, 'slotIndex'),
    anchorIndex: nonNegativeInteger(identity.anchorIndex, 'anchorIndex'),
    anchorTimeSec: nonNegativeFinite(identity.anchorTimeSec, 'anchorTimeSec'),
    instantUtc: nonEmpty(identity.instantUtc, 'instantUtc'),
  });
}

function normalizeAssociations(
  associations: readonly BeamScheduleServiceAssociation[],
  satelliteIds: ReadonlySet<string>,
): readonly NormalizedAssociation[] {
  if (!Array.isArray(associations)) throw new TypeError('slot associations must be an array');
  const seen = new Set<string>();
  const normalized = associations.map((association, index) => {
    if (association === null || typeof association !== 'object') {
      throw new TypeError(`associations[${index}] must be an object`);
    }
    if (typeof association.userId !== 'string' && typeof association.userId !== 'number') {
      throw new TypeError(`associations[${index}].userId must be a string or number`);
    }
    const key = userKey(association.userId);
    if (seen.has(key)) throw new RangeError(`duplicate userId ${String(association.userId)}`);
    seen.add(key);
    const satelliteId = association.satelliteId;
    const beamId = association.beamId;
    if (satelliteId === null || beamId === null) {
      if (satelliteId !== null || beamId !== null) {
        throw new RangeError('unserved association must provide both satelliteId and beamId as null');
      }
    } else {
      nonEmpty(satelliteId, `associations[${index}].satelliteId`);
      if (!satelliteIds.has(satelliteId)) {
        throw new RangeError(`association references unknown satellite ${satelliteId}`);
      }
      nonNegativeInteger(beamId, `associations[${index}].beamId`);
    }
    return {
      userId: association.userId,
      satelliteId,
      beamId,
      userKey: key,
    };
  });
  normalized.sort(compareUserKey);
  return freeze(normalized);
}

function assertSameUserDomain(
  reference: readonly NormalizedAssociation[] | null,
  current: readonly NormalizedAssociation[],
): readonly NormalizedAssociation[] {
  if (reference === null) return current;
  if (reference.length !== current.length || reference.some((item, index) => item.userKey !== current[index]?.userKey)) {
    throw new RangeError('every trace slot must provide the same complete UE association domain');
  }
  return reference;
}

function toPolicyAssociation(association: NormalizedAssociation): BeamAssociation {
  if (association.satelliteId === null || association.beamId === null) {
    throw new Error('unserved association cannot be sent to a satellite realization');
  }
  return { userId: association.userId, beamId: association.beamId };
}

function ids(positions: readonly BeamPosition[]): readonly BeamId[] {
  return freeze(positions.map(position => position.beamId));
}

function masksEqual(left: readonly boolean[], right: readonly boolean[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function idsEqual(left: readonly BeamId[], right: readonly BeamId[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function servicePair(
  association: NormalizedAssociation | undefined,
): ServiceAssociation | null {
  if (association === undefined || association.satelliteId === null || association.beamId === null) return null;
  return freeze({ satelliteId: association.satelliteId, beamId: association.beamId });
}

function changedSatelliteIds(
  previous: readonly BeamScheduleSatelliteSlot[],
  current: readonly BeamScheduleSatelliteSlot[],
): readonly string[] {
  const changed: string[] = [];
  for (let index = 0; index < current.length; index += 1) {
    const before = previous[index];
    const after = current[index]!;
    if (before === undefined || before.satelliteId !== after.satelliteId) {
      changed.push(after.satelliteId);
      continue;
    }
    if (
      !idsEqual(before.eligibleBeamIds, after.eligibleBeamIds)
      || !masksEqual(before.activeBeamMask, after.activeBeamMask)
    ) changed.push(after.satelliteId);
  }
  return freeze(changed);
}

function transitionChangedSatelliteIds(
  previous: readonly BeamScheduleSatelliteSlot[],
  current: readonly BeamScheduleSatelliteSlot[],
): { readonly schedule: readonly string[]; readonly active: readonly string[] } {
  const schedule: string[] = [];
  const active: string[] = [];
  for (let index = 0; index < current.length; index += 1) {
    const before = previous[index];
    const after = current[index]!;
    if (before === undefined || before.satelliteId !== after.satelliteId) {
      schedule.push(after.satelliteId);
      active.push(after.satelliteId);
      continue;
    }
    if (!idsEqual(before.eligibleBeamIds, after.eligibleBeamIds)) schedule.push(after.satelliteId);
    if (!masksEqual(before.activeBeamMask, after.activeBeamMask)) active.push(after.satelliteId);
  }
  return { schedule: freeze(schedule), active: freeze(active) };
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32-${hash.toString(16).padStart(8, '0')}`;
}

function digestPayload(
  analysisRunId: string,
  geometryRunId: string,
  satellites: readonly BeamScheduleSatelliteTrace[],
  slots: readonly BeamScheduleTraceSlot[],
  transitionEvidence: readonly BeamScheduleTransitionEvidence[],
): string {
  return JSON.stringify({
    schemaVersion: BEAM_SCHEDULE_TRACE_SCHEMA,
    analysisRunId,
    geometryRunId,
    satellites: satellites.map(satellite => ({
      satelliteId: satellite.satelliteId,
      layout: {
        beamCount: satellite.layout.beamCount,
        ringCount: satellite.layout.ringCount,
        halfPowerBeamWidthDeg: satellite.layout.halfPowerBeamWidthDeg,
        adjacentSpacingUv: satellite.layout.adjacentSpacingUv,
        beamPositions: satellite.layout.beamPositions,
      },
      policy: {
        mode: satellite.policy.mode,
        maxEligiblePerSlot: satellite.policy.maxEligiblePerSlot,
        fixedBeamIds: satellite.policy.fixedBeamIds,
      },
    })),
    slots,
    transitionEvidence,
  });
}

/**
 * Build one immutable trace from explicit accepted slots.  Layouts and policies
 * are satellite-scoped, so a serving satellite with 7 beams and a candidate
 * satellite with 19 beams can coexist without a fabricated global beam count.
 */
export function createBeamScheduleTrace(input: BeamScheduleTraceBuildInput): BeamScheduleTrace {
  if (input === null || typeof input !== 'object') throw new TypeError('trace input must be an object');
  const analysisRunId = nonEmpty(input.analysisRunId, 'analysisRunId');
  const geometryRunId = nonEmpty(input.geometryRunId, 'geometryRunId');
  const satellites = normalizeSatellites(input.satellites);
  if (!Array.isArray(input.slots) || input.slots.length === 0) {
    throw new RangeError('slots must contain at least one accepted slot');
  }
  const satelliteIds = new Set(satellites.map(satellite => satellite.satelliteId));
  const normalizedSlots: BeamScheduleTraceSlot[] = [];
  const slotIds = new Set<string>();
  let previousSlotIdentity: BeamScheduleSlotIdentity | null = null;
  let userDomain: readonly NormalizedAssociation[] | null = null;

  for (let slotInputIndex = 0; slotInputIndex < input.slots.length; slotInputIndex += 1) {
    const slotInput = input.slots[slotInputIndex];
    if (slotInput === null || typeof slotInput !== 'object') {
      throw new TypeError(`slots[${slotInputIndex}] must be an object`);
    }
    const identity = normalizeSlotIdentity(slotInput.identity);
    if (slotIds.has(identity.slotId)) throw new RangeError(`duplicate slotId ${identity.slotId}`);
    slotIds.add(identity.slotId);
    if (previousSlotIdentity !== null) {
      if (identity.slotIndex <= previousSlotIdentity.slotIndex) {
        throw new RangeError('trace slots must be ordered by strictly increasing slotIndex');
      }
      if (identity.anchorIndex <= previousSlotIdentity.anchorIndex) {
        throw new RangeError('trace slots must be ordered by strictly increasing anchorIndex');
      }
    }
    previousSlotIdentity = identity;
    const associations = normalizeAssociations(slotInput.associations, satelliteIds);
    userDomain = assertSameUserDomain(userDomain, associations);

    const satelliteSlots = satellites.map(satellite => {
      const schedule = scheduleEligibleBeamPositions(satellite.policy, identity.slotIndex);
      const localAssociations = associations
        .filter(association => association.satelliteId === satellite.satelliteId)
        .map(toPolicyAssociation);
      const realization = realizeBeamIllumination(schedule, localAssociations);
      const candidateBeamPositions = freeze([...schedule.candidateBeamPositions]);
      const eligibleBeamPositions = freeze([...schedule.eligibleBeamPositions]);
      const eligibleBeamIds = ids(eligibleBeamPositions);
      const activeBeamMask = freeze([...realization.activeMask]);
      const beamLoad = freeze([...realization.beamLoad]);
      const activeBeamIds = freeze(
        realization.beamIds.filter((_beamId, index) => activeBeamMask[index] === true),
      );
      return freeze({
        satelliteId: satellite.satelliteId,
        layoutBeamCount: satellite.layout.beamCount,
        mode: satellite.policy.mode,
        slotIndex: identity.slotIndex,
        candidateBeamPositions,
        eligibleBeamPositions,
        eligibleBeamIds,
        beamLoad,
        activeBeamMask,
        activeBeamIds,
      });
    });

    normalizedSlots.push(freeze({
      identity,
      associations: freeze(associations.map(({ userKey: _userKey, ...association }) => freeze(association))),
      satelliteSlots: freeze(satelliteSlots),
    }));
  }

  const transitionEvidence: BeamScheduleTransitionEvidence[] = [];
  for (let slotIndex = 1; slotIndex < normalizedSlots.length; slotIndex += 1) {
    const previous = normalizedSlots[slotIndex - 1]!;
    const current = normalizedSlots[slotIndex]!;
    const previousAssociations = new Map(
      previous.associations.map(association => [userKey(association.userId), association] as const),
    );
    const currentAssociations = new Map(
      current.associations.map(association => [userKey(association.userId), association] as const),
    );
    const changed = transitionChangedSatelliteIds(previous.satelliteSlots, current.satelliteSlots);
    const changedIds = changedSatelliteIds(previous.satelliteSlots, current.satelliteSlots);
    const keys = [...previousAssociations.keys()].sort();
    for (const key of keys) {
      const before = previousAssociations.get(key);
      const after = currentAssociations.get(key);
      const from = servicePair(before === undefined ? undefined : {
        ...before,
        userKey: key,
      });
      const to = servicePair(after === undefined ? undefined : {
        ...after,
        userKey: key,
      });
      const classification = classifyServiceTransition(from, to);
      const servicePairChanged = !sameServicePair(from, to);
      const transitionUserId = before?.userId ?? after?.userId;
      if (transitionUserId === undefined) {
        throw new Error(`trace transition ${previous.identity.slotId}->${current.identity.slotId} has no user identity`);
      }
      transitionEvidence.push(freeze({
        userId: transitionUserId,
        fromSlot: previous.identity,
        toSlot: current.identity,
        from,
        to,
        kind: classification.kind,
        servicePairChanged,
        scheduleChanged: changed.schedule.length > 0,
        activeMaskChanged: changed.active.length > 0,
        changedSatelliteIds: changedIds,
        basis: BEAM_SCHEDULE_TRACE_EVIDENCE_BASIS,
      }));
    }
  }

  const outputSatellites = freeze(satellites.map(satellite => freeze({
    satelliteId: satellite.satelliteId,
    layout: satellite.layout,
    policy: satellite.policy,
  })));
  const outputSlots = freeze(normalizedSlots);
  const outputTransitions = freeze(transitionEvidence);
  return freeze({
    schemaVersion: BEAM_SCHEDULE_TRACE_SCHEMA,
    analysisRunId,
    geometryRunId,
    traceDigest: fnv1a32(digestPayload(
      analysisRunId,
      geometryRunId,
      outputSatellites,
      outputSlots,
      outputTransitions,
    )),
    satellites: outputSatellites,
    slots: outputSlots,
    transitionEvidence: outputTransitions,
  });
}

/** Explicit alias for callers that name the operation a build. */
export const buildBeamScheduleTrace = createBeamScheduleTrace;

function sameServicePair(
  left: ServiceAssociation | null,
  right: ServiceAssociation | null,
): boolean {
  return left?.satelliteId === right?.satelliteId && left?.beamId === right?.beamId;
}
