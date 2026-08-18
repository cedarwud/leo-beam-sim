import {
  angularSeparationDeg,
  comparePassEvents,
  deduplicatePassEvents,
  extractPassEvents,
  normalizePassGeometrySource,
  normalizePassPolicy,
} from './extract';
import type {
  PassDiversityPolicy,
  PassEvent,
  PassGeometrySource,
  PassPlan,
  PassPlannerOptions,
  ServiceAnchorSelection,
  ServiceSequenceEntry,
} from './types';

/** Service and candidate links use the established 15-degree elevation mask. */
export const DEFAULT_PASS_SERVICE_MIN_ELEVATION_DEG = 15;

const CURRENT_ELEVATION_TIE_EPSILON_DEG = 1e-9;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function activeAt(pass: PassEvent, anchorTimeSec: number): boolean {
  return anchorTimeSec >= pass.aos && anchorTimeSec <= pass.los;
}

function overlapSeconds(left: PassEvent, right: PassEvent): number {
  return Math.max(0, Math.min(left.los, right.los) - Math.max(left.aos, right.aos));
}

function circularAzimuthDistance(left: number, right: number): number {
  return Math.abs(((left - right + 540) % 360) - 180);
}

function passDiversityScore(
  candidate: PassEvent,
  selected: readonly PassEvent[],
  policy: PassDiversityPolicy,
): readonly number[] {
  const reference = selected[selected.length - 1];
  if (reference === undefined) {
    return [
      Number(candidate.maxElevationDeg >= policy.highElevationDeg),
      Number(candidate.orbitalPlaneKey !== undefined),
      candidate.maxElevationDeg,
      -candidate.peak,
    ];
  }
  const planeDistinct = candidate.orbitalPlaneKey === undefined || reference.orbitalPlaneKey === undefined
    ? 0
    : Number(candidate.orbitalPlaneKey !== reference.orbitalPlaneKey);
  const peakDistinct = Number(Math.abs(candidate.peak - reference.peak) >= policy.preferredPeakSeparationSec);
  const directionDistinct = Number(circularAzimuthDistance(candidate.entryAzimuthDeg, reference.entryAzimuthDeg)
    >= policy.simultaneousSkySeparationDeg);
  return [
    Number(candidate.maxElevationDeg >= policy.highElevationDeg),
    planeDistinct,
    peakDistinct,
    directionDistinct,
    candidate.maxElevationDeg,
    -candidate.peak,
  ];
}

function compareScore(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue !== rightValue) return rightValue - leftValue;
  }
  return 0;
}

function chooseServingPass(
  active: readonly PassEvent[],
  selected: readonly PassEvent[],
  policy: PassDiversityPolicy,
  currentElevation: (pass: PassEvent) => number | null,
): PassEvent | null {
  if (active.length === 0) return null;
  return [...active].sort((left, right) => {
    const leftElevation = currentElevation(left) ?? -Infinity;
    const rightElevation = currentElevation(right) ?? -Infinity;
    return rightElevation - leftElevation
      || compareScore(passDiversityScore(left, selected, policy), passDiversityScore(right, selected, policy))
      || comparePassEvents(left, right);
  })[0] ?? null;
}

function candidateQualifies(
  serving: PassEvent,
  candidate: PassEvent,
  anchorTimeSec: number,
  policy: PassDiversityPolicy,
): boolean {
  if (candidate.passId === serving.passId || candidate.satelliteId === serving.satelliteId) return false;
  if (!activeAt(candidate, anchorTimeSec)) return false;
  if (overlapSeconds(serving, candidate) < policy.minimumCandidateOverlapSec) return false;
  if (candidate.los - serving.los < policy.minimumCandidateContinuationSec) return false;
  return true;
}

function chooseCandidate(
  serving: PassEvent,
  candidates: readonly PassEvent[],
  anchorTimeSec: number,
  serviceMaskDeg: number,
  policy: PassDiversityPolicy,
  currentElevation: (pass: PassEvent) => number | null,
): PassEvent | null {
  const qualifying = candidates.filter(candidate => {
    const elevation = currentElevation(candidate);
    return elevation !== null
      && elevation >= serviceMaskDeg
      && candidateQualifies(serving, candidate, anchorTimeSec, policy);
  });
  if (qualifying.length === 0) return null;
  return [...qualifying].sort((left, right) => {
    const score = (candidate: PassEvent): readonly number[] => {
      const overlap = overlapSeconds(serving, candidate);
      const planeDistinct = serving.orbitalPlaneKey === undefined || candidate.orbitalPlaneKey === undefined
        ? 0
        : Number(serving.orbitalPlaneKey !== candidate.orbitalPlaneKey);
      const peakDistinct = Number(Math.abs(serving.peak - candidate.peak) >= policy.preferredPeakSeparationSec);
      const directionDistinct = Number(circularAzimuthDistance(serving.entryAzimuthDeg, candidate.entryAzimuthDeg)
        >= policy.simultaneousSkySeparationDeg);
      return [
        Number(candidate.maxElevationDeg >= policy.highElevationDeg),
        planeDistinct,
        peakDistinct,
        directionDistinct,
        candidate.los - serving.los,
        overlap,
        candidate.maxElevationDeg,
        -candidate.peak,
      ];
    };
    const leftElevation = currentElevation(left) ?? -Infinity;
    const rightElevation = currentElevation(right) ?? -Infinity;
    return rightElevation - leftElevation
      || compareScore(score(left), score(right))
      || comparePassEvents(left, right);
  })[0] ?? null;
}

function makeSequence(
  eventsById: Readonly<Record<string, PassEvent>>,
  anchors: readonly ServiceAnchorSelection[],
  candidatesByPassId: Readonly<Record<string, string | null>>,
): readonly ServiceSequenceEntry[] {
  const order: string[] = [];
  const spans = new Map<string, { first: number; last: number }>();
  for (const anchor of anchors) {
    const id = anchor.servingPassId;
    if (id === null) continue;
    if (!spans.has(id)) {
      order.push(id);
      spans.set(id, { first: anchor.anchorIndex, last: anchor.anchorIndex });
    } else {
      spans.get(id)!.last = anchor.anchorIndex;
    }
  }
  return order.flatMap(id => {
    const event = eventsById[id];
    const span = spans.get(id);
    if (event === undefined || span === undefined) return [];
    return [{
      ...event,
      firstServingAnchorIndex: span.first,
      lastServingAnchorIndex: span.last,
      nextCandidatePassId: candidatesByPassId[id] ?? null,
    }];
  });
}

/**
 * Build a complete deterministic plan over the source's common anchor axis.
 * Every candidate in the result is a real extracted pass; no fallback or
 * synthetic satellite is introduced when qualification fails.
 */
export function planPassDiversity(
  source: PassGeometrySource,
  options: PassPlannerOptions = {},
): PassPlan {
  const policy = normalizePassPolicy(options);
  const normalized = normalizePassGeometrySource(source);
  const extractedPasses = extractPassEvents(source, policy);
  const passes = deduplicatePassEvents(extractedPasses, policy);
  const serviceMaskDeg = options.minimumElevationDeg ?? DEFAULT_PASS_SERVICE_MIN_ELEVATION_DEG;
  if (!Number.isFinite(serviceMaskDeg) || serviceMaskDeg < 0) {
    throw new TypeError('service elevation mask must be finite and non-negative');
  }
  const currentElevationsBySatellite = new Map<string, readonly (number | null)[]>();
  for (const satelliteId of normalized.satelliteIds) {
    currentElevationsBySatellite.set(
      satelliteId,
      normalized.readSamplesForSatellite(satelliteId).map(sample => sample?.elevationDeg ?? null),
    );
  }
  const currentElevation = (pass: PassEvent, anchorIndex: number): number | null => (
    currentElevationsBySatellite.get(pass.satelliteId)?.[anchorIndex] ?? null
  );
  const eventsById: Record<string, PassEvent> = {};
  for (const pass of passes) eventsById[pass.passId] = pass;

  const selectedEvents: PassEvent[] = [];
  let servingPassId: string | null = null;
  const serviceAnchors: ServiceAnchorSelection[] = [];
  const nextCandidateByPassId: Record<string, string | null> = {};
  for (const pass of passes) nextCandidateByPassId[pass.passId] = null;

  for (let anchorIndex = 0; anchorIndex < normalized.anchorTimesSec.length; anchorIndex += 1) {
    const anchorTimeSec = normalized.anchorTimesSec[anchorIndex];
    const active = passes.filter(pass => (
      activeAt(pass, anchorTimeSec)
      && (currentElevation(pass, anchorIndex) ?? -Infinity) >= serviceMaskDeg
    ));
    let serving: PassEvent | null = servingPassId === null ? null : eventsById[servingPassId] ?? null;
    if (serving === null || !active.some(pass => pass.passId === serving!.passId)) {
      serving = chooseServingPass(
        active,
        selectedEvents,
        policy,
        pass => currentElevation(pass, anchorIndex),
      );
      servingPassId = serving?.passId ?? null;
      if (serving !== null && !selectedEvents.some(pass => pass.passId === serving!.passId)) selectedEvents.push(serving);
    } else {
      const betterCurrentCandidate = chooseCandidate(
        serving,
        passes,
        anchorTimeSec,
        serviceMaskDeg,
        policy,
        pass => currentElevation(pass, anchorIndex),
      );
      const servingElevation = currentElevation(serving, anchorIndex);
      const candidateElevation = betterCurrentCandidate === null
        ? null
        : currentElevation(betterCurrentCandidate, anchorIndex);
      if (
        betterCurrentCandidate !== null
        && candidateElevation !== null
        && (servingElevation === null || candidateElevation > servingElevation + CURRENT_ELEVATION_TIE_EPSILON_DEG)
      ) {
        serving = betterCurrentCandidate;
        servingPassId = serving.passId;
        if (!selectedEvents.some(pass => pass.passId === serving!.passId)) selectedEvents.push(serving);
      }
    }
    const candidate = serving === null ? null : chooseCandidate(
      serving,
      passes,
      anchorTimeSec,
      serviceMaskDeg,
      policy,
      pass => currentElevation(pass, anchorIndex),
    );
    if (serving !== null && candidate !== null && nextCandidateByPassId[serving.passId] === null) {
      nextCandidateByPassId[serving.passId] = candidate.passId;
    }
    serviceAnchors.push(Object.freeze({
      anchorIndex,
      anchorTimeSec,
      servingPassId: serving?.passId ?? null,
      candidatePassId: candidate?.passId ?? null,
    }));
  }

  const selectedPassIds = selectedEvents.map(pass => pass.passId);
  const serviceSequence = makeSequence(eventsById, serviceAnchors, nextCandidateByPassId);
  const provenance = {
    policyRevision: policy.revision,
    selectedPassIds,
  } as const;
  return deepFreeze({
    policyRevision: policy.revision,
    policy,
    anchorTimesSec: normalized.anchorTimesSec,
    anchorTimes: normalized.anchorTimes,
    extractedPasses,
    passes,
    deduplicatedPasses: passes,
    selectedPasses: serviceSequence,
    selectedPassIds,
    serviceSequence,
    serviceAnchors,
    nextCandidateByAnchor: serviceAnchors,
    nextCandidateByPassId,
    nextCandidateMapping: nextCandidateByPassId,
    provenance,
  });
}

/** Alias retained for callers that describe the output as a run pass plan. */
export const buildPassPlan = planPassDiversity;
export const buildDeterministicPassPlan = planPassDiversity;
export const planPasses = planPassDiversity;
export const planServiceSequence = planPassDiversity;
export const buildServiceSequence = planPassDiversity;

export function candidatePassAtAnchor(
  serving: PassEvent,
  candidates: readonly PassEvent[],
  anchorTimeSec: number,
  policy: PassDiversityPolicy = normalizePassPolicy(),
): PassEvent | null {
  return chooseCandidate(
    serving,
    candidates,
    anchorTimeSec,
    DEFAULT_PASS_SERVICE_MIN_ELEVATION_DEG,
    policy,
    pass => pass.maxElevationDeg,
  );
}

export { angularSeparationDeg };
