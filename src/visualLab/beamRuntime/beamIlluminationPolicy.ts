/**
 * Pure beam-illumination domain contracts for the Visual Lab.
 *
 * Beam Hopping = 波束跳躍.  The scheduler deliberately produces only named
 * eligible beam positions.  It does not produce the canonical active mask
 * (`z`); active state is a separate realization derived from UE associations.
 */

export type BeamId = number;
export type UserId = string | number;
export type BeamIlluminationMode = 'fixed' | 'beam-hopping';

export interface BeamPosition {
  readonly beamId: BeamId;
  readonly satelliteId: string;
}

export interface BeamIlluminationPolicyConfig {
  readonly mode: BeamIlluminationMode;
  readonly candidateBeamPositions: readonly BeamPosition[];
  /** Maximum number of eligible positions returned for one slot. */
  readonly maxEligiblePerSlot: number;
  /** Optional deterministic subset for fixed mode; defaults to the first positions. */
  readonly fixedBeamIds?: readonly BeamId[];
}

export interface BeamIlluminationPolicy {
  /** Policies are satellite-local; local beam ids may repeat on another satellite. */
  readonly satelliteId: string;
  readonly mode: BeamIlluminationMode;
  readonly candidateBeamPositions: readonly BeamPosition[];
  readonly maxEligiblePerSlot: number;
  readonly fixedBeamIds: readonly BeamId[];
}

export interface BeamIlluminationSchedule {
  readonly satelliteId: string;
  readonly mode: BeamIlluminationMode;
  readonly slotIndex: number;
  /** The complete named candidate domain, retained for realization validation. */
  readonly candidateBeamPositions: readonly BeamPosition[];
  /** Scheduler output: eligible beam positions, never canonical active `z`. */
  readonly eligibleBeamPositions: readonly BeamPosition[];
}

export interface BeamAssociation {
  readonly userId: UserId;
  /** `null` represents no serving beam (service loss or not yet attached). */
  readonly beamId: BeamId | null;
}

export interface BeamIlluminationRealization {
  readonly satelliteId: string;
  readonly candidateBeamPositions: readonly BeamPosition[];
  readonly eligibleBeamPositions: readonly BeamPosition[];
  readonly beamIds: readonly BeamId[];
  readonly beamLoad: readonly number[];
  /** Derived mask: active iff the corresponding beam has positive load. */
  readonly activeMask: readonly boolean[];
}

export interface ServiceAssociation {
  /** Both fields must be non-null for a serving association. */
  readonly satelliteId: string | null;
  readonly beamId: BeamId | null;
}

export type ServiceTransitionKind =
  | 'stay'
  | 'initial-attach'
  | 'service-loss'
  | 'same-satellite-beam-switch'
  | 'cross-satellite-handover';

export interface ServiceTransition {
  readonly kind: ServiceTransitionKind;
  readonly from: ServiceAssociation | null;
  readonly to: ServiceAssociation | null;
}

export function createBeamIlluminationPolicy(
  config: BeamIlluminationPolicyConfig,
): BeamIlluminationPolicy {
  validateMode(config.mode);
  const candidateBeamPositions = normalizeCandidateBeamPositions(config.candidateBeamPositions);
  validateMaxEligiblePerSlot(config.maxEligiblePerSlot, candidateBeamPositions.length);

  if (config.mode === 'beam-hopping' && config.fixedBeamIds !== undefined) {
    throw new Error('fixedBeamIds is only supported in fixed mode');
  }

  const fixedBeamIds = config.mode === 'fixed'
    ? normalizeFixedBeamIds(
      config.fixedBeamIds,
      candidateBeamPositions,
      config.maxEligiblePerSlot,
    )
    : [];

  return Object.freeze({
    satelliteId: candidateBeamPositions[0]!.satelliteId,
    mode: config.mode,
    candidateBeamPositions,
    maxEligiblePerSlot: config.maxEligiblePerSlot,
    fixedBeamIds,
  });
}

/**
 * Schedule a slot without realizing UE service.  In beam-hopping mode the
 * eligible set advances by the configured maximum in deterministic round-robin
 * order.  In fixed mode the same subset is returned for every slot.
 */
export function scheduleEligibleBeamPositions(
  policy: BeamIlluminationPolicy,
  slotIndex: number,
): BeamIlluminationSchedule {
  validateSlotIndex(slotIndex);
  const { candidateBeamPositions, maxEligiblePerSlot } = policy;
  const eligibleBeamPositions = policy.mode === 'fixed'
    ? candidateBeamPositions.filter(position => policy.fixedBeamIds.includes(position.beamId))
    : roundRobinPositions(candidateBeamPositions, maxEligiblePerSlot, slotIndex);

  return Object.freeze({
    satelliteId: policy.satelliteId,
    mode: policy.mode,
    slotIndex,
    candidateBeamPositions,
    eligibleBeamPositions: Object.freeze([...eligibleBeamPositions]),
  });
}

/**
 * Realize canonical-style load and activity from UE associations.  An
 * association may target only an eligible position; no beam is active merely
 * because the scheduler listed it as eligible.  This is the sole place where
 * the active mask is derived, enforcing `active iff load > 0`.
 */
export function realizeBeamIllumination(
  schedule: BeamIlluminationSchedule,
  associations: readonly BeamAssociation[],
): BeamIlluminationRealization {
  const candidateBeamPositions = normalizeCandidateBeamPositions(schedule.candidateBeamPositions);
  if (schedule.satelliteId !== candidateBeamPositions[0]!.satelliteId) {
    throw new Error('schedule satelliteId disagrees with its candidate beam positions');
  }
  const eligibleBeamPositions = normalizeEligibleBeamPositions(
    schedule.eligibleBeamPositions,
    candidateBeamPositions,
  );
  const candidateIds = candidateBeamPositions.map(position => position.beamId);
  const candidateIdSet = new Set(candidateIds);
  const eligibleIdSet = new Set(eligibleBeamPositions.map(position => position.beamId));
  const beamLoad = Array.from({ length: candidateBeamPositions.length }, () => 0);
  const beamIndexById = new Map(candidateIds.map((beamId, index) => [beamId, index]));
  const userIds = new Set<UserId>();

  for (const item of associations) {
    validateAssociation(item);
    if (userIds.has(item.userId)) {
      throw new Error(`duplicate userId ${String(item.userId)}`);
    }
    userIds.add(item.userId);

    if (item.beamId === null) continue;
    if (!candidateIdSet.has(item.beamId)) {
      throw new Error(`UE ${String(item.userId)} references unknown beam ${item.beamId}`);
    }
    if (!eligibleIdSet.has(item.beamId)) {
      throw new Error(`UE ${String(item.userId)} is associated with ineligible beam ${item.beamId}`);
    }
    const beamIndex = beamIndexById.get(item.beamId);
    if (beamIndex === undefined) {
      throw new Error(`candidate beam ${item.beamId} has no realization index`);
    }
    beamLoad[beamIndex] = (beamLoad[beamIndex] ?? 0) + 1;
  }

  const activeMask = beamLoad.map(load => load > 0);
  return Object.freeze({
    satelliteId: schedule.satelliteId,
    candidateBeamPositions,
    eligibleBeamPositions,
    beamIds: Object.freeze(candidateIds),
    beamLoad: Object.freeze(beamLoad),
    activeMask: Object.freeze(activeMask),
  });
}

/**
 * Classify only a UE service transition.  Eligibility or active-set changes
 * alone are not handovers: if the service pair stays the same, the result is
 * `stay`.  Same-satellite beam switch = 同衛星換束; cross-satellite handover =
 * 跨衛星換手.
 */
export function classifyServiceTransition(
  previous: ServiceAssociation | null,
  current: ServiceAssociation | null,
): ServiceTransition {
  const from = normalizeServiceAssociation(previous);
  const to = normalizeServiceAssociation(current);

  let kind: ServiceTransitionKind;
  if (from === null && to === null) {
    kind = 'stay';
  } else if (from === null && to !== null) {
    kind = 'initial-attach';
  } else if (from !== null && to === null) {
    kind = 'service-loss';
  } else if (from!.satelliteId === to!.satelliteId && from!.beamId === to!.beamId) {
    kind = 'stay';
  } else if (from!.satelliteId === to!.satelliteId) {
    kind = 'same-satellite-beam-switch';
  } else {
    kind = 'cross-satellite-handover';
  }

  return Object.freeze({ kind, from, to });
}

function roundRobinPositions(
  candidates: readonly BeamPosition[],
  maxEligiblePerSlot: number,
  slotIndex: number,
): readonly BeamPosition[] {
  const startIndex = ((slotIndex % candidates.length) * maxEligiblePerSlot) % candidates.length;
  return Array.from({ length: maxEligiblePerSlot }, (_, offset) => (
    candidates[(startIndex + offset) % candidates.length]!
  ));
}

function normalizeCandidateBeamPositions(
  positions: readonly BeamPosition[],
): readonly BeamPosition[] {
  if (!Array.isArray(positions) || positions.length === 0) {
    throw new Error('candidateBeamPositions must contain at least one beam position');
  }

  const normalized = positions.map(position => {
    validateBeamPosition(position);
    return Object.freeze({
      beamId: position.beamId,
      satelliteId: position.satelliteId,
    });
  });
  const satelliteId = normalized[0]!.satelliteId;
  if (normalized.some(position => position.satelliteId !== satelliteId)) {
    throw new Error('candidateBeamPositions must belong to one satellite');
  }
  normalized.sort((left, right) => left.beamId - right.beamId);

  const ids = new Set<BeamId>();
  for (const position of normalized) {
    if (ids.has(position.beamId)) {
      throw new Error(`duplicate beamId ${position.beamId}`);
    }
    ids.add(position.beamId);
  }
  return Object.freeze(normalized);
}

function normalizeEligibleBeamPositions(
  positions: readonly BeamPosition[],
  candidates: readonly BeamPosition[],
): readonly BeamPosition[] {
  if (!Array.isArray(positions)) {
    throw new Error('eligibleBeamPositions must be an array');
  }
  const candidateById = new Map(candidates.map(position => [position.beamId, position]));
  const seen = new Set<BeamId>();
  const normalized = positions.map(position => {
    validateBeamPosition(position);
    const candidate = candidateById.get(position.beamId);
    if (!candidate) {
      throw new Error(`eligible beam ${position.beamId} is not a candidate beam`);
    }
    if (seen.has(position.beamId)) {
      throw new Error(`duplicate eligible beamId ${position.beamId}`);
    }
    seen.add(position.beamId);
    if (candidate.satelliteId !== position.satelliteId) {
      throw new Error(`eligible beam ${position.beamId} satelliteId disagrees with candidate`);
    }
    return candidate;
  });
  return Object.freeze(normalized);
}

function normalizeFixedBeamIds(
  fixedBeamIds: readonly BeamId[] | undefined,
  candidates: readonly BeamPosition[],
  maxEligiblePerSlot: number,
): readonly BeamId[] {
  const selected = fixedBeamIds === undefined
    ? candidates.slice(0, maxEligiblePerSlot).map(position => position.beamId)
    : [...fixedBeamIds];
  if (selected.length === 0) {
    throw new Error('fixedBeamIds must contain at least one beam');
  }
  if (selected.length > maxEligiblePerSlot) {
    throw new Error('fixedBeamIds length cannot exceed maxEligiblePerSlot');
  }
  const candidateIdSet = new Set(candidates.map(position => position.beamId));
  const seen = new Set<BeamId>();
  for (const beamId of selected) {
    validateBeamId(beamId, 'fixed beamId');
    if (!candidateIdSet.has(beamId)) {
      throw new Error(`fixed beamId ${beamId} is not a candidate beam`);
    }
    if (seen.has(beamId)) {
      throw new Error(`duplicate fixed beamId ${beamId}`);
    }
    seen.add(beamId);
  }

  const order = new Map(candidates.map((position, index) => [position.beamId, index]));
  selected.sort((left, right) => order.get(left)! - order.get(right)!);
  return Object.freeze(selected);
}

function validateMode(mode: BeamIlluminationMode): void {
  if (mode !== 'fixed' && mode !== 'beam-hopping') {
    throw new Error(`unsupported beam illumination mode ${String(mode)}`);
  }
}

function validateMaxEligiblePerSlot(maxEligiblePerSlot: number, candidateCount: number): void {
  if (!Number.isSafeInteger(maxEligiblePerSlot) || maxEligiblePerSlot <= 0) {
    throw new Error(`maxEligiblePerSlot must be a positive integer; got ${maxEligiblePerSlot}`);
  }
  if (maxEligiblePerSlot > candidateCount) {
    throw new Error(`maxEligiblePerSlot cannot exceed candidateBeamPositions length ${candidateCount}`);
  }
}

function validateSlotIndex(slotIndex: number): void {
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0) {
    throw new Error(`slotIndex must be a non-negative integer; got ${slotIndex}`);
  }
}

function validateBeamPosition(position: BeamPosition): void {
  if (position === null || typeof position !== 'object') {
    throw new Error('beam position must be an object');
  }
  validateBeamId(position.beamId, 'beamId');
  if (typeof position.satelliteId !== 'string' || position.satelliteId.length === 0) {
    throw new Error(`satelliteId must be a non-empty string; got ${String(position.satelliteId)}`);
  }
}

function validateBeamId(beamId: BeamId, label: string): void {
  if (!Number.isSafeInteger(beamId) || beamId < 0) {
    throw new Error(`${label} must be a non-negative integer; got ${beamId}`);
  }
}

function validateAssociation(item: BeamAssociation): void {
  if (item === null || typeof item !== 'object') {
    throw new Error('beam association must be an object');
  }
  if (typeof item.userId !== 'string' && typeof item.userId !== 'number') {
    throw new Error(`userId must be a string or number; got ${String(item.userId)}`);
  }
  if (item.beamId !== null) validateBeamId(item.beamId, 'association beamId');
}

function normalizeServiceAssociation(
  association: ServiceAssociation | null,
): ServiceAssociation | null {
  if (association === null) return null;
  if (typeof association !== 'object') {
    throw new Error('service association must be an object or null');
  }
  const { satelliteId, beamId } = association;
  if (satelliteId === null && beamId === null) return null;
  if (typeof satelliteId !== 'string' || satelliteId.length === 0 || beamId === null) {
    throw new Error('service association must provide both satelliteId and beamId, or neither');
  }
  validateBeamId(beamId, 'service association beamId');
  return Object.freeze({ satelliteId, beamId });
}
