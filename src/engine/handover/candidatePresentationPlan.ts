import {
  candidateLinkKey,
  candidateLinkKeyString,
  sameCandidateLinkKey,
  validateHandoverDecisionFrame,
  type CandidateDecisionState,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from './candidateDecisionContract';
import {
  allocateHandoverVisualIdentities,
  resolveHandoverBeamVisualIdentity,
  type HandoverBeamVisualIdentity,
  type HandoverSatelliteVisualIdentity,
  type HandoverVisualIdentityAllocation,
} from '../../constants/handoverVisualIdentity';
import { formatCandidateDisplayKey } from './candidateDisplayKey';

/**
 * The presentation budget is deliberately separate from the scientific frame.
 * It bounds only what the scene and the primary rail render; it never removes
 * opportunities from `HandoverDecisionFrame`.
 */
export interface CandidateDisplayBudget {
  readonly maxSatelliteGroups: number;
  readonly maxCandidatePairs: number;
  readonly maxConeVolumes: number;
}

export const DEFAULT_CANDIDATE_DISPLAY_BUDGET: CandidateDisplayBudget = Object.freeze({
  maxSatelliteGroups: 3,
  maxCandidatePairs: 6,
  maxConeVolumes: 7,
});

/** The SDD fixes this per-satellite scene budget rather than making it tunable. */
export const MAX_CANDIDATE_BEAMS_PER_SATELLITE = 2 as const;

export type CandidatePresentationRole =
  | 'serving'
  | 'committed-serving'
  | 'observed'
  | 'hard-eligible'
  | 'qualified'
  | 'provisional-leader'
  | 'selected-target';

export type CandidatePresentationFootprintStyle = 'solid' | 'dotted' | 'dashed' | 'double-line';
export type CandidatePresentationConeStyle = 'restrained-translucent' | 'hidden' | 'wireframe' | 'low-alpha';
export type CandidatePresentationDataLinkStyle = 'solid-data' | 'measurement-dashed' | 'none';

export interface CandidatePresentationVisualTreatment {
  readonly role: CandidatePresentationRole;
  readonly footprintStyle: CandidatePresentationFootprintStyle;
  readonly coneStyle: CandidatePresentationConeStyle;
  readonly dataLinkStyle: CandidatePresentationDataLinkStyle;
  readonly isMeasurementOnly: boolean;
  readonly isActiveDataLink: boolean;
}

export interface CandidatePresentationLink {
  /** Stable for the episode; it does not include rank, role, or source-frame ID. */
  readonly joinKey: string;
  readonly sceneJoinKey: string;
  readonly railJoinKey: string;
  readonly key: CandidateLinkKey;
  /** Source-frame join carried alongside the episode-stable pair key. */
  readonly sourceFrameId: string;
  readonly satelliteId: string;
  readonly beamId: number;
  /** Built once for both scene and rail; consumers must not reconstruct it. */
  readonly displayKey: string;
  /** Null only for a serving link not present in the current opportunity set. */
  readonly opportunity: CandidateOpportunity | null;
  readonly state: CandidateDecisionState | null;
  readonly role: CandidatePresentationRole;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
  readonly isPinned: boolean;
  readonly satelliteIdentity: HandoverSatelliteVisualIdentity;
  readonly beamIdentity: HandoverBeamVisualIdentity | null;
  readonly visual: CandidatePresentationVisualTreatment;
}

export type CandidatePresentationBeamRosterStatus =
  | CandidatePresentationRole
  | 'not-observed'
  | 'not-displayed';

/**
 * Complete configured-beam view for one rendered satellite group.
 *
 * `link` is present only when this exact beam was measured in the accepted
 * decision frame. Missing beams remain explicit `not-observed` entries; no
 * synthetic metric or candidate row is manufactured for them.
 */
export interface CandidatePresentationBeamRosterEntry {
  readonly beamId: number;
  readonly link: CandidatePresentationLink | null;
  readonly status: CandidatePresentationBeamRosterStatus;
  readonly observed: boolean;
  readonly displayed: boolean;
}

export interface CandidatePresentationSatelliteGroup {
  /** Stable for the episode and independent of candidate rank. */
  readonly joinKey: string;
  readonly satelliteId: string;
  readonly satelliteIdentity: HandoverSatelliteVisualIdentity;
  readonly isServingSatellite: boolean;
  readonly isPinnedSatellite: boolean;
  readonly links: readonly CandidatePresentationLink[];
  /** Configured beam inventory plus same-frame measured status. */
  readonly beamRoster: readonly CandidatePresentationBeamRosterEntry[];
  /** Number of scientific candidate pairs for this satellite, excluding serving. */
  readonly scientificCandidatePairCount: number;
  readonly displayedCandidatePairCount: number;
  readonly hiddenCandidatePairCount: number;
  readonly overflowCandidatePairCount: number;
}

export interface CandidatePresentationOverflow {
  readonly hiddenCandidatePairCount: number;
  readonly overflowCandidatePairCount: number;
  readonly hiddenSatelliteGroupCount: number;
  readonly overflowSatelliteGroupCount: number;
  readonly bySatellite: readonly {
    readonly satelliteId: string;
    readonly hiddenCandidatePairCount: number;
  }[];
}

export interface CandidatePresentationPinSwap {
  readonly pinnedKey: CandidateLinkKey;
  readonly wasHiddenBeforePin: boolean;
  readonly isVisibleAfterPin: boolean;
  /** The least-important visible pair evicted to make room, if any. */
  readonly evictedKey: CandidateLinkKey | null;
}

export interface CandidatePresentationPlan {
  /** The complete immutable decision frame. It is never truncated by this plan. */
  readonly decision: HandoverDecisionFrame;
  readonly budget: CandidateDisplayBudget;
  readonly identityAllocation: HandoverVisualIdentityAllocation;
  readonly groups: readonly CandidatePresentationSatelliteGroup[];
  readonly displayedLinks: readonly CandidatePresentationLink[];
  readonly scientificOpportunityCount: number;
  readonly scientificCandidatePairCount: number;
  /** Total scientific satellite groups, including the serving group when one exists. */
  readonly scientificSatelliteGroupCount: number;
  /** Scientific satellite groups other than the always-visible serving group. */
  readonly scientificCandidateSatelliteGroupCount: number;
  readonly scientificCandidateKeys: readonly CandidateLinkKey[];
  readonly displayedCandidatePairCount: number;
  /** Total rendered groups, including the serving group when one exists. */
  readonly displayedSatelliteGroupCount: number;
  readonly hiddenCandidatePairCount: number;
  readonly overflowCandidatePairCount: number;
  readonly hiddenSatelliteGroupCount: number;
  readonly overflowSatelliteGroupCount: number;
  readonly overflow: CandidatePresentationOverflow;
  readonly pinnedKey: CandidateLinkKey | null;
  readonly pinSwap: CandidatePresentationPinSwap | null;
  /** Exactly zero or one; candidates can never be active data links. */
  readonly activeDataLinkCount: 0 | 1;
}

export interface CandidatePresentationOptions {
  readonly pinnedKey?: CandidateLinkKey | null;
  readonly previousIdentityAllocation?: HandoverVisualIdentityAllocation | null;
  /**
   * Route-scoped allocation shared by the scene and right rail. It may contain
   * the active union of both consumers, but it must cover every displayed key.
   */
  readonly identityAllocation?: HandoverVisualIdentityAllocation | null;
  /**
   * Homepage comparison mode: include every hard-eligible pair from the
   * accepted frame instead of applying the compact legacy display cap. The
   * scientific decision remains the source of truth in either mode.
   */
  readonly displayAllHardEligibleCandidates?: boolean;
  /**
   * Homepage-only candidate visibility gate. When enabled, a candidate must
   * have passed both hard gates and the active decision trigger; observed or
   * merely hard-eligible pairs stay in scientific overflow, not the story.
   */
  readonly displayOnlyTriggerSatisfiedCandidates?: boolean;
  /** Configured beam inventory size for the route profile (default: 7). */
  readonly configuredBeamCount?: number;
}

interface CandidateRecord {
  readonly opportunity: CandidateOpportunity;
  readonly state: CandidateDecisionState;
  readonly role: CandidatePresentationRole;
  readonly priority: number;
  readonly isPinned: boolean;
}

interface DisplaySelection {
  readonly records: readonly CandidateRecord[];
  readonly groupIds: readonly string[];
}

const PRESENTATION_ROLE_PRIORITY: Readonly<Record<CandidatePresentationRole, number>> = Object.freeze({
  serving: 0,
  'committed-serving': 0,
  'selected-target': 1,
  'provisional-leader': 2,
  qualified: 4,
  'hard-eligible': 5,
  observed: 6,
});

function fail(message: string): never {
  throw new TypeError(`candidate presentation plan: ${message}`);
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}

function assertNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) fail(`${label} must be a non-negative integer`);
  return value;
}

function normalizeBudget(input: CandidateDisplayBudget): CandidateDisplayBudget {
  if (input === null || typeof input !== 'object') fail('budget must be an object');
  return Object.freeze({
    maxSatelliteGroups: assertPositiveInteger(input.maxSatelliteGroups, 'maxSatelliteGroups'),
    maxCandidatePairs: assertNonNegativeInteger(input.maxCandidatePairs, 'maxCandidatePairs'),
    maxConeVolumes: assertPositiveInteger(input.maxConeVolumes, 'maxConeVolumes'),
  });
}

function normalizeConfiguredBeamCount(value: number | undefined): number {
  const count = value ?? 7;
  return assertPositiveInteger(count, 'configuredBeamCount');
}

function expandBudgetForEligibleComparison(
  decision: HandoverDecisionFrame,
  budget: CandidateDisplayBudget,
  displayAllHardEligibleCandidates: boolean,
  displayOnlyTriggerSatisfiedCandidates: boolean,
): CandidateDisplayBudget {
  if (!displayAllHardEligibleCandidates) return budget;
  const records = candidateRecords(decision, null);
  const eligibleRecords = records.filter(record => isDisplayEligibleRecord(
    record,
    displayOnlyTriggerSatisfiedCandidates,
  ));
  const eligibleSatelliteCount = new Set(
    eligibleRecords.map(record => record.opportunity.key.satelliteId),
  ).size;
  const servingCount = decision.serving === null ? 0 : 1;
  // This is a presentation expansion, not a scientific limit. It prevents
  // the old compact 3x2 cap from silently hiding a hard-eligible pair that
  // the accepted snapshot explicitly asked the user to compare. Do not cap
  // this set here: eligibility belongs to the decision engine, while the
  // homepage scene separately decides which exact beam geometry is painted.
  return Object.freeze({
    maxSatelliteGroups: Math.max(budget.maxSatelliteGroups, eligibleSatelliteCount + servingCount),
    maxCandidatePairs: Math.max(budget.maxCandidatePairs, eligibleRecords.length),
    maxConeVolumes: Math.max(budget.maxConeVolumes, eligibleRecords.length + servingCount),
  });
}

function sameKey(left: CandidateLinkKey, right: CandidateLinkKey): boolean {
  return sameCandidateLinkKey(left, right);
}

function keyFor(key: CandidateLinkKey): string {
  return candidateLinkKeyString(key);
}

function copyKey(key: CandidateLinkKey): CandidateLinkKey {
  return candidateLinkKey(key.satelliteId, key.beamId);
}

function compareRecords(left: CandidateRecord, right: CandidateRecord): number {
  if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
  if (left.priority !== right.priority) return left.priority - right.priority;
  const leftRank = left.state.rank ?? Number.POSITIVE_INFINITY;
  const rightRank = right.state.rank ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return compareStableText(keyFor(left.opportunity.key), keyFor(right.opportunity.key));
}

function compareStableText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isEligiblePresentationRole(role: CandidatePresentationRole): boolean {
  return role === 'hard-eligible'
    || role === 'qualified'
    || role === 'provisional-leader'
    || role === 'selected-target';
}

function isDisplayEligibleRecord(
  record: CandidateRecord,
  displayOnlyTriggerSatisfiedCandidates: boolean,
): boolean {
  if (displayOnlyTriggerSatisfiedCandidates) {
    return record.state.hardEligibility === 'eligible'
      && record.state.triggerStatus === 'satisfied';
  }
  return isEligiblePresentationRole(record.role);
}

function stateFor(
  decision: HandoverDecisionFrame,
  opportunity: CandidateOpportunity,
): CandidateDecisionState {
  const state = decision.states.find(candidate => sameKey(candidate.key, opportunity.key));
  if (state === undefined) fail(`missing decision state for ${keyFor(opportunity.key)}`);
  return state;
}

function roleFor(
  decision: HandoverDecisionFrame,
  opportunity: CandidateOpportunity,
  state: CandidateDecisionState,
): CandidatePresentationRole {
  if (decision.serving !== null && sameKey(decision.serving, opportunity.key)) {
    return decision.recentCommit !== null && sameKey(decision.recentCommit.to, opportunity.key)
      ? 'committed-serving'
      : 'serving';
  }
  if (decision.selectedTarget !== null && sameKey(decision.selectedTarget, opportunity.key)) {
    return 'selected-target';
  }
  if (decision.provisionalLeader !== null && sameKey(decision.provisionalLeader, opportunity.key)) {
    return 'provisional-leader';
  }
  if (state.hardEligibility === 'eligible' && state.triggerStatus === 'satisfied') return 'qualified';
  if (state.hardEligibility === 'eligible') return 'hard-eligible';
  return 'observed';
}

function priorityFor(
  decision: HandoverDecisionFrame,
  opportunity: CandidateOpportunity,
  state: CandidateDecisionState,
): number {
  const role = roleFor(decision, opportunity, state);
  // Stable candidates are a distinct presentation priority even though the
  // role grammar uses the same qualified treatment for their beam.
  if (role === 'qualified' && state.stable) return 3;
  return PRESENTATION_ROLE_PRIORITY[role];
}

function styleFor(
  role: CandidatePresentationRole,
  isPinned: boolean,
  _phase: HandoverDecisionFrame['phase'],
): CandidatePresentationVisualTreatment {
  switch (role) {
    case 'serving':
      return Object.freeze({
        role,
        footprintStyle: 'solid',
        coneStyle: 'restrained-translucent',
        dataLinkStyle: 'solid-data',
        isMeasurementOnly: false,
        isActiveDataLink: true,
      });
    case 'committed-serving':
      return Object.freeze({
        role,
        footprintStyle: 'solid',
        coneStyle: 'restrained-translucent',
        dataLinkStyle: 'solid-data',
        isMeasurementOnly: false,
        isActiveDataLink: true,
      });
    case 'selected-target':
      return Object.freeze({
        role,
        footprintStyle: 'double-line',
        coneStyle: 'low-alpha',
        dataLinkStyle: 'measurement-dashed',
        isMeasurementOnly: true,
        isActiveDataLink: false,
      });
    case 'provisional-leader':
      return Object.freeze({
        role,
        footprintStyle: 'double-line',
        coneStyle: 'wireframe',
        dataLinkStyle: 'measurement-dashed',
        isMeasurementOnly: true,
        isActiveDataLink: false,
      });
    case 'qualified':
      return Object.freeze({
        role,
        footprintStyle: 'dashed',
        // A qualified candidate remains a measured alternative until commit.
        // Keep its bounded sparse wireframe and dashed measurement path visible
        // so the central scene can be read without consulting the rail. The
        // renderer still enforces measurement-only semantics and the one-solid-
        // data-link invariant.
        coneStyle: 'wireframe',
        dataLinkStyle: 'measurement-dashed',
        isMeasurementOnly: true,
        isActiveDataLink: false,
      });
    case 'hard-eligible':
      return Object.freeze({
        role,
        footprintStyle: 'dotted',
        // Hard eligibility is already a meaningful comparison state. Use the
        // same sparse wireframe/measurement grammar as qualified candidates;
        // it distinguishes a real alternative from an observed-only record
        // without implying an active data path.
        coneStyle: 'wireframe',
        dataLinkStyle: 'measurement-dashed',
        isMeasurementOnly: true,
        isActiveDataLink: false,
      });
    case 'observed': {
      // Observation is footprint/label-only in every phase. A user pin is the
      // explicit inspection override that may add one sparse wireframe and
      // its dashed measurement guide without changing serving authority.
      const measurementConeVisible = isPinned;
      return Object.freeze({
        role,
        footprintStyle: 'dotted',
        coneStyle: measurementConeVisible ? 'wireframe' : 'hidden',
        // Drawing a full UE-to-satellite dashed line for every observed pair
        // turns the viewport into a line cage; reserve that explicit path for
        // a pinned pair or the explicit leader/selected-target roles.
        dataLinkStyle: isPinned ? 'measurement-dashed' : 'none',
        isMeasurementOnly: true,
        isActiveDataLink: false,
      });
    }
  }
}

function stableJoinKey(episodeId: string, key: CandidateLinkKey): string {
  return `${episodeId}/link/${encodeURIComponent(keyFor(key))}`;
}

function stableSatelliteJoinKey(episodeId: string, satelliteId: string): string {
  return `${episodeId}/satellite/${encodeURIComponent(satelliteId)}`;
}

function uniqueKeys(keys: readonly CandidateLinkKey[]): CandidateLinkKey[] {
  const seen = new Set<string>();
  const result: CandidateLinkKey[] = [];
  for (const key of keys) {
    const identity = keyFor(key);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(copyKey(key));
  }
  return result;
}

function uniqueSatelliteIds(ids: readonly string[], servingSatelliteId: string | null): string[] {
  const result = [...new Set(ids)];
  result.sort((left, right) => {
    if (servingSatelliteId !== null && left === servingSatelliteId) return -1;
    if (servingSatelliteId !== null && right === servingSatelliteId) return 1;
    return compareStableText(left, right);
  });
  return result;
}

function optionsValue(
  options: CandidatePresentationOptions | CandidateLinkKey | null | undefined,
): CandidatePresentationOptions {
  if (options === null || options === undefined) return Object.freeze({});
  if ('satelliteId' in options && 'beamId' in options) {
    return Object.freeze({ pinnedKey: options });
  }
  return options;
}

function candidateRecords(
  decision: HandoverDecisionFrame,
  pinnedKey: CandidateLinkKey | null,
): CandidateRecord[] {
  return decision.opportunities
    .filter(opportunity => decision.serving === null || !sameKey(opportunity.key, decision.serving))
    .map(opportunity => {
      const state = stateFor(decision, opportunity);
      const role = roleFor(decision, opportunity, state);
      return {
        opportunity,
        state,
        role,
        priority: priorityFor(decision, opportunity, state),
        isPinned: pinnedKey !== null && sameKey(pinnedKey, opportunity.key),
      };
    })
    .sort(compareRecords);
}

function groupCandidateRecords(records: readonly CandidateRecord[]): Map<string, CandidateRecord[]> {
  const result = new Map<string, CandidateRecord[]>();
  for (const record of records) {
    const group = result.get(record.opportunity.key.satelliteId) ?? [];
    group.push(record);
    result.set(record.opportunity.key.satelliteId, group);
  }
  return result;
}

function selectDisplayRecords(
  decision: HandoverDecisionFrame,
  budget: CandidateDisplayBudget,
  pinnedKey: CandidateLinkKey | null,
  displayAllHardEligibleCandidates = false,
  displayOnlyTriggerSatisfiedCandidates = false,
): DisplaySelection {
  const records = candidateRecords(decision, pinnedKey);
  const bySatellite = groupCandidateRecords(records);
  const servingSatelliteId = decision.serving?.satelliteId ?? null;
  const orderedGroupIds = [...bySatellite.entries()]
    .filter(([satelliteId]) => satelliteId !== servingSatelliteId)
    .sort((left, right) => {
      // Candidate groups with hard-eligible/qualified evidence must occupy the
      // bounded scene before observed-only decoration. The record order already
      // prefers selected/qualified pairs, but this explicit group-level check
      // prevents an observed first record from consuming an alternate slot when
      // another pair in the same source group is eligible.
      const leftHasEligible = left[1].some(record => isDisplayEligibleRecord(
        record,
        displayOnlyTriggerSatisfiedCandidates,
      ));
      const rightHasEligible = right[1].some(record => isDisplayEligibleRecord(
        record,
        displayOnlyTriggerSatisfiedCandidates,
      ));
      if (leftHasEligible !== rightHasEligible) return leftHasEligible ? -1 : 1;
      const byRecord = compareRecords(left[1][0]!, right[1][0]!);
      return byRecord !== 0 ? byRecord : compareStableText(left[0], right[0]);
    })
    .map(([satelliteId]) => satelliteId);
  // Full comparison mode expands the compact budget only for satellite
  // groups that have hard-eligible evidence. Observed-only groups remain in
  // the scientific/overflow accounting and must not consume a central scene
  // group slot (or make the rendered group count exceed the expanded budget).
  const comparisonGroupIds = displayAllHardEligibleCandidates
    ? orderedGroupIds.filter(satelliteId => (
      bySatellite.get(satelliteId)?.some(record => isDisplayEligibleRecord(
        record,
        displayOnlyTriggerSatisfiedCandidates,
      )) ?? false
    ))
    : orderedGroupIds;
  const budgetAlternateGroupCapacity = Math.max(
    0,
    budget.maxSatelliteGroups - (servingSatelliteId === null ? 0 : 1),
  );
  const alternateGroupCapacity = displayAllHardEligibleCandidates
    ? comparisonGroupIds.length
    : budgetAlternateGroupCapacity;
  const pinnedSatelliteId = pinnedKey === null ? null : pinnedKey.satelliteId;
  const selectedGroupIds: string[] = [];
  if (pinnedSatelliteId !== null
    && pinnedSatelliteId !== servingSatelliteId
    && bySatellite.has(pinnedSatelliteId)
    && (!displayAllHardEligibleCandidates || comparisonGroupIds.includes(pinnedSatelliteId))) {
    selectedGroupIds.push(pinnedSatelliteId);
  }
  for (const satelliteId of comparisonGroupIds) {
    if (selectedGroupIds.includes(satelliteId)) continue;
    if (selectedGroupIds.length >= alternateGroupCapacity) break;
    selectedGroupIds.push(satelliteId);
  }
  if (selectedGroupIds.length > alternateGroupCapacity) {
    // A pinned alternate group displaces the least-important unpinned group.
    const evictIndex = [...selectedGroupIds].reverse().findIndex(
      satelliteId => satelliteId !== pinnedSatelliteId,
    );
    if (evictIndex >= 0) {
      selectedGroupIds.splice(selectedGroupIds.length - 1 - evictIndex, 1);
    } else {
      // The serving satellite consumes the whole group budget. A pin cannot
      // hide that group, so the alternate remains available to the rail only.
      selectedGroupIds.splice(alternateGroupCapacity);
    }
  }

  const candidateRenderGroupIds = servingSatelliteId === null
    ? selectedGroupIds
    : [servingSatelliteId, ...selectedGroupIds.filter(satelliteId => satelliteId !== servingSatelliteId)];
  const groupRecords = candidateRenderGroupIds.flatMap(satelliteId => {
    const group = bySatellite.get(satelliteId) ?? [];
    const selected = displayAllHardEligibleCandidates
      ? group.filter(record => isDisplayEligibleRecord(record, displayOnlyTriggerSatisfiedCandidates)
        || (pinnedKey !== null && sameKey(record.opportunity.key, pinnedKey)))
      : group.slice(0, MAX_CANDIDATE_BEAMS_PER_SATELLITE);
    if (pinnedKey !== null && group.some(record => sameKey(record.opportunity.key, pinnedKey))) {
      const pinned = group.find(record => sameKey(record.opportunity.key, pinnedKey));
      if (pinned !== undefined && !selected.some(record => sameKey(record.opportunity.key, pinned.opportunity.key))) {
        selected.pop();
        selected.unshift(pinned);
      }
    }
    return selected;
  });
  const candidateCapacity = displayAllHardEligibleCandidates
    ? groupRecords.length
    : Math.min(
      budget.maxCandidatePairs,
      Math.max(0, budget.maxConeVolumes - (decision.serving === null ? 0 : 1)),
    );
  const boundedRecords = groupRecords.sort(compareRecords);
  // Preserve one eligible pair per eligible satellite whenever the pair cap
  // permits it. This keeps the central scene able to show an actual
  // multi-satellite comparison instead of spending the whole budget on two
  // beams from the first satellite. The final fill still follows the normal
  // stable role/rank ordering.
  const reservedEligibleKeys = new Set<string>();
  const reservedEligibleSatelliteIds = new Set<string>();
  if (candidateCapacity > 0) {
    for (const record of boundedRecords) {
      if (!isDisplayEligibleRecord(record, displayOnlyTriggerSatisfiedCandidates)) continue;
      if (reservedEligibleSatelliteIds.has(record.opportunity.key.satelliteId)) continue;
      reservedEligibleSatelliteIds.add(record.opportunity.key.satelliteId);
      reservedEligibleKeys.add(keyFor(record.opportunity.key));
      if (reservedEligibleKeys.size >= candidateCapacity) break;
    }
  }
  const selectedRecords = boundedRecords
    .filter(record => reservedEligibleKeys.has(keyFor(record.opportunity.key)))
    .concat(boundedRecords.filter(record => !reservedEligibleKeys.has(keyFor(record.opportunity.key))))
    .slice(0, candidateCapacity)
    .sort(compareRecords);
  return Object.freeze({
    records: Object.freeze(selectedRecords),
    groupIds: Object.freeze(selectedGroupIds),
  });
}

function identityFor(
  allocation: HandoverVisualIdentityAllocation,
  satelliteId: string,
): HandoverSatelliteVisualIdentity {
  const identity = allocation.identitiesBySatelliteId[satelliteId];
  if (identity === undefined) fail(`missing satellite identity for ${satelliteId}`);
  return identity;
}

function beamIdentityFor(
  allocation: HandoverVisualIdentityAllocation,
  key: CandidateLinkKey,
): HandoverBeamVisualIdentity | null {
  return resolveHandoverBeamVisualIdentity(allocation, key.satelliteId, key.beamId);
}

function buildLink(
  decision: HandoverDecisionFrame,
  allocation: HandoverVisualIdentityAllocation,
  key: CandidateLinkKey,
  opportunity: CandidateOpportunity | null,
  state: CandidateDecisionState | null,
  pinnedKey: CandidateLinkKey | null,
): CandidatePresentationLink {
  const isServing = decision.serving !== null && sameKey(decision.serving, key);
  const role = isServing
    ? (decision.recentCommit !== null && sameKey(decision.recentCommit.to, key)
      ? 'committed-serving'
      : 'serving')
    : opportunity === null || state === null
      ? 'observed'
      : roleFor(decision, opportunity, state);
  const isPinned = pinnedKey !== null && sameKey(pinnedKey, key);
  const visual = styleFor(role, isPinned, decision.phase);
  return Object.freeze({
    joinKey: stableJoinKey(decision.episodeId, key),
    sceneJoinKey: stableJoinKey(decision.episodeId, key),
    railJoinKey: stableJoinKey(decision.episodeId, key),
    key: copyKey(key),
    sourceFrameId: decision.sourceFrameId,
    satelliteId: key.satelliteId,
    beamId: key.beamId,
    displayKey: formatCandidateDisplayKey({
      key,
      beamIdentitySource: opportunity?.beamIdentitySource
        ?? decision.opportunities[0]?.beamIdentitySource
        ?? 'physical-beam',
    }),
    opportunity,
    state,
    role,
    isServing,
    isCandidate: !isServing,
    isPinned,
    satelliteIdentity: identityFor(allocation, key.satelliteId),
    beamIdentity: beamIdentityFor(allocation, key),
    visual,
  });
}

function buildAllocation(
  decision: HandoverDecisionFrame,
  budget: CandidateDisplayBudget,
  options: CandidatePresentationOptions,
  displayedKeys: readonly CandidateLinkKey[],
): HandoverVisualIdentityAllocation {
  const keys = uniqueKeys(displayedKeys);
  const satelliteIds = uniqueSatelliteIds(
    keys.map(key => key.satelliteId),
    decision.serving?.satelliteId ?? null,
  );
  const beamIdsBySatellite: Record<string, number[]> = {};
  for (const key of keys) {
    const beams = beamIdsBySatellite[key.satelliteId] ?? [];
    if (!beams.includes(key.beamId)) beams.push(key.beamId);
    beamIdsBySatellite[key.satelliteId] = beams;
  }
  for (const beams of Object.values(beamIdsBySatellite)) beams.sort((left, right) => left - right);
  return allocateHandoverVisualIdentities({
    episodeId: decision.episodeId,
    servingSatelliteId: decision.serving?.satelliteId ?? null,
    satelliteIds,
    beamIdsBySatellite,
    normalDisplayBudget: budget.maxSatelliteGroups,
    previousAllocation: options.previousIdentityAllocation ?? null,
    previousReservationSatelliteIds: satelliteIds,
  });
}

function assertAllocationCoversDisplayedKeys(
  decision: HandoverDecisionFrame,
  allocation: HandoverVisualIdentityAllocation,
  displayedKeys: readonly CandidateLinkKey[],
): HandoverVisualIdentityAllocation {
  if (allocation.episodeId !== decision.episodeId) {
    fail(`identity allocation episode ${allocation.episodeId ?? 'null'} does not match ${decision.episodeId}`);
  }
  for (const key of displayedKeys) {
    if (allocation.identitiesBySatelliteId[key.satelliteId] === undefined) {
      fail(`shared identity allocation is missing satellite ${key.satelliteId}`);
    }
    if (resolveHandoverBeamVisualIdentity(allocation, key.satelliteId, key.beamId) === null) {
      fail(`shared identity allocation is missing beam ${keyFor(key)}`);
    }
  }
  return allocation;
}

/**
 * Build the bounded scene/rail projection for one immutable decision frame.
 *
 * All opportunities remain available through `decision` and the scientific
 * counts/keys on the result. The `groups` and `displayedLinks` arrays are the
 * only bounded render subset. Passing a pin changes that subset only; it does
 * not mutate, rank, or otherwise rewrite the decision frame.
 */
export function buildCandidatePresentationPlan(
  decision: HandoverDecisionFrame,
  budget: CandidateDisplayBudget = DEFAULT_CANDIDATE_DISPLAY_BUDGET,
  options?: CandidatePresentationOptions | CandidateLinkKey | null,
): CandidatePresentationPlan {
  validateHandoverDecisionFrame(decision);
  const normalizedOptions = optionsValue(options);
  const compactBudget = normalizeBudget(budget);
  const displayAllHardEligibleCandidates = normalizedOptions.displayAllHardEligibleCandidates === true;
  const displayOnlyTriggerSatisfiedCandidates = normalizedOptions.displayOnlyTriggerSatisfiedCandidates === true;
  const normalizedBudget = expandBudgetForEligibleComparison(
    decision,
    compactBudget,
    displayAllHardEligibleCandidates,
    displayOnlyTriggerSatisfiedCandidates,
  );
  const configuredBeamCount = normalizeConfiguredBeamCount(normalizedOptions.configuredBeamCount);
  const requestedPin = normalizedOptions.pinnedKey === undefined || normalizedOptions.pinnedKey === null
    ? null
    : copyKey(normalizedOptions.pinnedKey);
  const opportunityForPin = requestedPin === null
    ? null
    : decision.opportunities.find(opportunity => sameKey(opportunity.key, requestedPin)) ?? null;
  const pinIsServing = requestedPin !== null
    && decision.serving !== null
    && sameKey(requestedPin, decision.serving);
  const acceptedPin = requestedPin !== null && (opportunityForPin !== null || pinIsServing)
    ? requestedPin
    : null;
  const baselineSelection = selectDisplayRecords(
    decision,
    normalizedBudget,
    null,
    displayAllHardEligibleCandidates,
    displayOnlyTriggerSatisfiedCandidates,
  );
  const selection = selectDisplayRecords(
    decision,
    normalizedBudget,
    acceptedPin,
    displayAllHardEligibleCandidates,
    displayOnlyTriggerSatisfiedCandidates,
  );
  const displayedKeys = uniqueKeys([
    ...(decision.serving === null ? [] : [decision.serving]),
    ...selection.records.map(record => record.opportunity.key),
  ]);
  const rosterSatelliteIds = new Set([
    ...selection.groupIds,
    ...(decision.serving === null ? [] : [decision.serving.satelliteId]),
  ]);
  const rosterKeysForAllocation = displayAllHardEligibleCandidates
    ? decision.opportunities
      .filter(opportunity => rosterSatelliteIds.has(opportunity.key.satelliteId))
      .map(opportunity => opportunity.key)
    : [];
  // A recent commit can leave the old source pair out of the next decision
  // frame. Keep that source as a presentation-only colour anchor so the
  // accepted target is selected against the actual predecessor; it is not
  // added to displayedLinks, counts, or the central shortlist.
  const transitionAnchorKeys = decision.recentCommit?.from === null
    || decision.recentCommit?.from === undefined
    ? []
    : [decision.recentCommit.from];
  const allocationKeys = uniqueKeys([
    ...displayedKeys,
    ...rosterKeysForAllocation,
    ...transitionAnchorKeys,
  ]);
  const suppliedAllocation = normalizedOptions.identityAllocation ?? null;
  const allocation = suppliedAllocation === null
    ? buildAllocation(decision, normalizedBudget, normalizedOptions, allocationKeys)
    : suppliedAllocation.episodeId !== decision.episodeId
      ? assertAllocationCoversDisplayedKeys(decision, suppliedAllocation, allocationKeys)
      : allocationKeys.every(key => (
        suppliedAllocation.identitiesBySatelliteId[key.satelliteId] !== undefined
        && resolveHandoverBeamVisualIdentity(
          suppliedAllocation,
          key.satelliteId,
          key.beamId,
        ) !== null
      ))
        ? assertAllocationCoversDisplayedKeys(decision, suppliedAllocation, allocationKeys)
        : buildAllocation(
          decision,
          normalizedBudget,
          {
            ...normalizedOptions,
            previousIdentityAllocation: normalizedOptions.previousIdentityAllocation
              ?? suppliedAllocation,
          },
          allocationKeys,
        );
  const baselineKeys = new Set(baselineSelection.records.map(record => keyFor(record.opportunity.key)));
  const displayedCandidateKeys = new Set(selection.records.map(record => keyFor(record.opportunity.key)));
  const pinnedWasHiddenBeforePin = acceptedPin !== null
    && opportunityForPin !== null
    && !baselineKeys.has(keyFor(acceptedPin));
  const evictedKey = pinnedWasHiddenBeforePin
    ? baselineSelection.records.find(record => !displayedCandidateKeys.has(keyFor(record.opportunity.key)))?.opportunity.key ?? null
    : null;

  const allRecords = candidateRecords(decision, acceptedPin);
  const allBySatellite = groupCandidateRecords(allRecords);
  const allCandidateSatelliteIds = [...allBySatellite.keys()].sort(compareStableText);
  const candidateSatelliteIds = allCandidateSatelliteIds.filter(
    satelliteId => satelliteId !== decision.serving?.satelliteId,
  );
  const servingKey = decision.serving === null ? null : copyKey(decision.serving);
  const renderedGroupIds = [...selection.groupIds];
  if (servingKey !== null && !renderedGroupIds.includes(servingKey.satelliteId)) {
    renderedGroupIds.unshift(servingKey.satelliteId);
  }
  const groups: CandidatePresentationSatelliteGroup[] = [];
  const displayedLinks: CandidatePresentationLink[] = [];
  for (const satelliteId of renderedGroupIds) {
    const isServingSatellite = servingKey !== null && satelliteId === servingKey.satelliteId;
    const scientificRecords = allBySatellite.get(satelliteId) ?? [];
    const selectedRecords = selection.records.filter(record => record.opportunity.key.satelliteId === satelliteId);
    const links: CandidatePresentationLink[] = [];
    if (isServingSatellite && servingKey !== null) {
      const servingOpportunity = decision.opportunities.find(opportunity => sameKey(opportunity.key, servingKey)) ?? null;
      const servingState = servingOpportunity === null ? null : stateFor(decision, servingOpportunity);
      links.push(buildLink(decision, allocation, servingKey, servingOpportunity, servingState, acceptedPin));
    }
    for (const record of selectedRecords.sort(compareRecords)) {
      links.push(buildLink(
        decision,
        allocation,
        record.opportunity.key,
        record.opportunity,
        record.state,
        acceptedPin,
      ));
    }
    const linkByBeamId = new Map(links.map(link => [link.beamId, link] as const));
    const recordByBeamId = new Map(scientificRecords.map(record => [
      record.opportunity.key.beamId,
      record,
    ] as const));
    const beamRoster: CandidatePresentationBeamRosterEntry[] = [];
    for (let beamId = 1; beamId <= configuredBeamCount; beamId += 1) {
      const displayedLink = linkByBeamId.get(beamId) ?? null;
      const record = recordByBeamId.get(beamId) ?? null;
      if (displayedLink !== null) {
        beamRoster.push(Object.freeze({
          beamId,
          link: displayedLink,
          status: displayedLink.role,
          observed: true,
          displayed: true,
        }));
        continue;
      }
      if (record !== null && displayAllHardEligibleCandidates) {
        // Full comparison mode keeps measured but currently non-eligible beams
        // available to the rail without promoting them into the central scene.
        const rosterLink = buildLink(
          decision,
          allocation,
          record.opportunity.key,
          record.opportunity,
          record.state,
          acceptedPin,
        );
        beamRoster.push(Object.freeze({
          beamId,
          link: rosterLink,
          status: rosterLink.role,
          observed: true,
          displayed: false,
        }));
        continue;
      }
      beamRoster.push(Object.freeze({
        beamId,
        link: null,
        status: record === null ? 'not-observed' : 'not-displayed',
        observed: record !== null,
        displayed: false,
      }));
    }
    // A candidate group displaced by a pin can still be represented by its
    // explicit +N count; do not manufacture a scene link for hidden rows.
    const displayedCandidatePairCount = selectedRecords.length;
    const hiddenCandidatePairCount = Math.max(0, scientificRecords.length - displayedCandidatePairCount);
    groups.push(Object.freeze({
      joinKey: stableSatelliteJoinKey(decision.episodeId, satelliteId),
      satelliteId,
      satelliteIdentity: identityFor(allocation, satelliteId),
      isServingSatellite,
      isPinnedSatellite: acceptedPin !== null && acceptedPin.satelliteId === satelliteId,
      links: Object.freeze(links),
      beamRoster: Object.freeze(beamRoster),
      scientificCandidatePairCount: scientificRecords.length,
      displayedCandidatePairCount,
      hiddenCandidatePairCount,
      overflowCandidatePairCount: hiddenCandidatePairCount,
    }));
    displayedLinks.push(...links);
  }

  const scientificCandidatePairCount = decision.opportunities.filter(
    opportunity => decision.serving === null || !sameKey(opportunity.key, decision.serving),
  ).length;
  const displayedCandidatePairCount = selection.records.length;
  const displayedAlternateGroupIds = new Set(selection.groupIds);
  const scientificSatelliteGroupIds = new Set(candidateSatelliteIds);
  const scientificAllSatelliteIds = new Set([
    ...allCandidateSatelliteIds,
    ...(decision.serving === null ? [] : [decision.serving.satelliteId]),
  ]);
  const hiddenSatelliteGroupCount = Math.max(
    0,
    scientificSatelliteGroupIds.size - displayedAlternateGroupIds.size,
  );
  const hiddenCandidatePairCount = Math.max(0, scientificCandidatePairCount - displayedCandidatePairCount);
  const bySatellite = allCandidateSatelliteIds.map(satelliteId => {
    const scientificCount = allBySatellite.get(satelliteId)?.length ?? 0;
    const displayedCount = selection.records.filter(record => record.opportunity.key.satelliteId === satelliteId).length;
    return Object.freeze({
      satelliteId,
      hiddenCandidatePairCount: Math.max(0, scientificCount - displayedCount),
    });
  }).filter(entry => entry.hiddenCandidatePairCount > 0);
  const activeDataLinkCount = displayedLinks.filter(link => link.visual.isActiveDataLink).length;
  if (activeDataLinkCount !== (decision.serving === null ? 0 : 1)) {
    fail(`expected ${decision.serving === null ? 0 : 1} active data link, got ${activeDataLinkCount}`);
  }
  const scientificCandidateKeys = decision.opportunities
    .filter(opportunity => decision.serving === null || !sameKey(opportunity.key, decision.serving))
    .map(opportunity => copyKey(opportunity.key));
  const pinSwap = acceptedPin === null
    ? null
    : Object.freeze({
      pinnedKey: copyKey(acceptedPin),
      wasHiddenBeforePin: pinnedWasHiddenBeforePin,
      isVisibleAfterPin: displayedCandidateKeys.has(keyFor(acceptedPin)) || pinIsServing,
      evictedKey: evictedKey === null ? null : copyKey(evictedKey),
    });
  const overflow = Object.freeze({
    hiddenCandidatePairCount,
    overflowCandidatePairCount: hiddenCandidatePairCount,
    hiddenSatelliteGroupCount,
    overflowSatelliteGroupCount: hiddenSatelliteGroupCount,
    bySatellite: Object.freeze(bySatellite),
  });
  return Object.freeze({
    decision,
    budget: normalizedBudget,
    identityAllocation: allocation,
    groups: Object.freeze(groups),
    displayedLinks: Object.freeze(displayedLinks),
    scientificOpportunityCount: decision.opportunities.length,
    scientificCandidatePairCount,
    scientificSatelliteGroupCount: scientificAllSatelliteIds.size,
    scientificCandidateKeys: Object.freeze(scientificCandidateKeys),
    displayedCandidatePairCount,
    displayedSatelliteGroupCount: groups.length,
    scientificCandidateSatelliteGroupCount: candidateSatelliteIds.length,
    hiddenCandidatePairCount,
    overflowCandidatePairCount: hiddenCandidatePairCount,
    hiddenSatelliteGroupCount,
    overflowSatelliteGroupCount: hiddenSatelliteGroupCount,
    overflow,
    pinnedKey: acceptedPin === null ? null : copyKey(acceptedPin),
    pinSwap,
    activeDataLinkCount: activeDataLinkCount as 0 | 1,
  });
}
