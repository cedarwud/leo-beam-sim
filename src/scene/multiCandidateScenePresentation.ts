import {
  candidateLinkKey,
  candidateLinkKeyString,
  type CandidateLinkKey,
} from '../engine/handover/candidateDecisionContract';
import type {
  CandidatePresentationConeStyle,
  CandidatePresentationDataLinkStyle,
  CandidatePresentationFootprintStyle,
  CandidatePresentationLink,
  CandidatePresentationPlan,
  CandidatePresentationRole,
} from '../engine/handover/candidatePresentationPlan';
import type {
  HandoverBeamVisualIdentity,
  HandoverSatelliteVisualIdentity,
} from '../constants/handoverVisualIdentity';
import {
  resolveHandoverAuthorityJoin,
  type HandoverAuthorityJoin,
} from './handoverAuthorityJoin';

export type MultiCandidateSceneTransitionRole = 'source' | 'target' | null;

/**
 * Renderer-neutral identity tokens for one displayed satellite-beam pair.
 *
 * CSS and Three.js consumers receive the same token.  The adapter does not
 * select or recolour an identity; those reservations belong to the
 * CandidatePresentationPlan and remain stable for the handover episode.
 */
export interface MultiCandidateSceneIdentity {
  readonly satellite: {
    readonly cssColor: string;
    readonly threeColor: string;
  };
  readonly beam: {
    readonly cssColor: string;
    readonly threeColor: string;
  } | null;
}

export interface MultiCandidateSceneConeInstruction {
  readonly style: CandidatePresentationConeStyle;
  readonly visible: boolean;
  /** One visible cone is one presentation volume; hidden cones consume zero. */
  readonly volume: 0 | 1;
}

export interface MultiCandidateSceneFootprintInstruction {
  readonly style: CandidatePresentationFootprintStyle;
  readonly visible: true;
}

export interface MultiCandidateSceneLinkInstruction {
  /** Stable episode join key copied from the presentation plan. */
  readonly joinKey: string;
  /** Stable scene join key copied from the presentation plan. */
  readonly sceneJoinKey: string;
  /** Stable rail join key copied from the presentation plan. */
  readonly railJoinKey: string;
  /** Canonical pair identity; satellite-only joins are not permitted. */
  readonly pairKey: string;
  readonly key: CandidateLinkKey;
  readonly sourceFrameId: string;
  readonly satelliteId: string;
  readonly beamId: number;
  readonly displayKey: string;
  readonly role: CandidatePresentationRole;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
  readonly isPinned: boolean;
  /** Exact accepted transition endpoint; satellite-only matches are invalid. */
  readonly transitionRole: MultiCandidateSceneTransitionRole;
  readonly satelliteIdentity: HandoverSatelliteVisualIdentity;
  readonly beamIdentity: HandoverBeamVisualIdentity | null;
  readonly identity: MultiCandidateSceneIdentity;
  readonly cone: MultiCandidateSceneConeInstruction;
  readonly footprint: MultiCandidateSceneFootprintInstruction;
  readonly link: {
    readonly style: CandidatePresentationDataLinkStyle;
    readonly isSolidData: boolean;
    readonly isMeasurementOnly: boolean;
  };
}

export interface MultiCandidateScenePresentation {
  readonly episodeId: string;
  readonly sourceFrameId: string;
  readonly budget: CandidatePresentationPlan['budget'];
  /** Same order as plan.displayedLinks; no ranking or re-selection occurs here. */
  readonly instructions: readonly MultiCandidateSceneLinkInstruction[];
  readonly serving: MultiCandidateSceneLinkInstruction | null;
  readonly candidates: readonly MultiCandidateSceneLinkInstruction[];
  readonly coneVolumeCount: number;
  /** Exactly zero or one solid data link is allowed in the scene. */
  readonly activeDataLinkCount: 0 | 1;
  readonly solidDataLinkCount: 0 | 1;
}

function fail(message: string): never {
  throw new TypeError(`multi-candidate scene presentation: ${message}`);
}

function assertNonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${label} must be non-empty`);
  return value;
}

function assertPairJoin(link: CandidatePresentationLink, expectedSourceFrameId: string): string {
  if (link.key.satelliteId !== link.satelliteId || link.key.beamId !== link.beamId) {
    fail(`displayed link identity mismatch for ${link.joinKey}`);
  }
  const pairKey = candidateLinkKeyString(link.key);
  assertNonEmpty(link.joinKey, 'joinKey');
  assertNonEmpty(link.sceneJoinKey, 'sceneJoinKey');
  assertNonEmpty(link.railJoinKey, 'railJoinKey');
  assertNonEmpty(link.sourceFrameId, 'sourceFrameId');
  if (link.sourceFrameId !== expectedSourceFrameId) {
    fail(`source-frame mismatch for ${candidateLinkKeyString(link.key)}`);
  }
  if (link.sourceFrameId !== link.opportunity?.sourceFrameId
    && link.opportunity !== null) {
    fail(`source-frame mismatch for ${candidateLinkKeyString(link.key)}`);
  }
  return pairKey;
}

function copyKey(key: CandidateLinkKey): CandidateLinkKey {
  return candidateLinkKey(key.satelliteId, key.beamId);
}

function assertIdentity(link: CandidatePresentationLink): void {
  if (link.satelliteIdentity.satelliteId !== link.satelliteId) {
    fail(`satellite identity does not join ${candidateLinkKeyString(link.key)}`);
  }
  if (link.beamIdentity !== null
    && (link.beamIdentity.satelliteId !== link.satelliteId || link.beamIdentity.beamId !== link.beamId)) {
    fail(`beam identity does not join ${candidateLinkKeyString(link.key)}`);
  }
}

function assertRoleAndLinkContract(link: CandidatePresentationLink): boolean {
  if (link.isServing === link.isCandidate) {
    fail(`link must be exactly serving or candidate: ${candidateLinkKeyString(link.key)}`);
  }
  const isSolidData = link.visual.dataLinkStyle === 'solid-data';
  if (isSolidData !== link.visual.isActiveDataLink) {
    fail(`solid-data and active-data flags disagree for ${candidateLinkKeyString(link.key)}`);
  }
  if (link.isCandidate) {
    if (isSolidData || link.visual.isActiveDataLink) {
      fail(`candidate cannot be a solid data link: ${candidateLinkKeyString(link.key)}`);
    }
    if (!link.visual.isMeasurementOnly) {
      fail(`candidate must remain measurement-only: ${candidateLinkKeyString(link.key)}`);
    }
  } else if (!isSolidData || link.visual.isMeasurementOnly) {
    fail(`serving link must be the sole solid data link: ${candidateLinkKeyString(link.key)}`);
  }
  return isSolidData;
}

function samePair(left: CandidateLinkKey, right: CandidateLinkKey): boolean {
  return left.satelliteId === right.satelliteId && left.beamId === right.beamId;
}

function sameOptionalPair(
  left: CandidateLinkKey | null,
  right: CandidateLinkKey | null,
): boolean {
  return left === null ? right === null : right !== null && samePair(left, right);
}

/**
 * An explicit join is accepted only when it belongs to this accepted plan.
 * Stale joins fail closed so a previous episode cannot relabel a current
 * serving/candidate pair.  The plan remains the source of serving truth.
 */
function acceptedAuthorityJoin(
  plan: CandidatePresentationPlan,
  authorityJoin: HandoverAuthorityJoin | null,
): HandoverAuthorityJoin | null {
  if (authorityJoin === null) return null;
  const decision = plan.decision;
  if (authorityJoin.phase !== decision.phase
    || !sameOptionalPair(authorityJoin.serving, decision.serving)
    || !sameOptionalPair(authorityJoin.solidDataLinkKey, decision.serving)
    || authorityJoin.solidDataLinkCount !== (decision.serving === null ? 0 : 1)) {
    return null;
  }
  const transition = authorityJoin.transition;
  if (transition === null) return authorityJoin;
  if (
    authorityJoin.showTransitionCue !== true
    || decision.phase !== 'switching'
    || transition.episodeId !== decision.episodeId
    || transition.sourceFrameId !== decision.sourceFrameId
    || transition.simTimeMs !== decision.simTimeMs
    || samePair(transition.from, transition.to)
    || transition.kind !== (transition.from.satelliteId === transition.to.satelliteId ? 'intra' : 'inter')
  ) return null;
  return authorityJoin;
}

function resolveTransitionRole(
  key: CandidateLinkKey,
  authorityJoin: HandoverAuthorityJoin | null,
): MultiCandidateSceneTransitionRole {
  const transition = authorityJoin?.transition ?? null;
  if (authorityJoin?.showTransitionCue !== true || transition === null) return null;
  if (samePair(key, transition.from)) return 'source';
  if (samePair(key, transition.to)) return 'target';
  return null;
}

function mapLink(
  link: CandidatePresentationLink,
  pairKey: string,
  transitionRole: MultiCandidateSceneTransitionRole,
): {
  readonly instruction: MultiCandidateSceneLinkInstruction;
  readonly isSolidData: boolean;
} {
  assertIdentity(link);
  const isSolidData = assertRoleAndLinkContract(link);
  const coneVisible = link.visual.coneStyle !== 'hidden';
  const instruction = Object.freeze({
    joinKey: link.joinKey,
    sceneJoinKey: link.sceneJoinKey,
    railJoinKey: link.railJoinKey,
    pairKey,
    key: copyKey(link.key),
    sourceFrameId: link.sourceFrameId,
    satelliteId: link.satelliteId,
    beamId: link.beamId,
    displayKey: link.displayKey,
    role: link.role,
    isServing: link.isServing,
    isCandidate: link.isCandidate,
    isPinned: link.isPinned,
    transitionRole,
    satelliteIdentity: link.satelliteIdentity,
    beamIdentity: link.beamIdentity,
    identity: Object.freeze({
      satellite: Object.freeze({
        cssColor: link.satelliteIdentity.cssColor,
        threeColor: link.satelliteIdentity.threeColor,
      }),
      beam: link.beamIdentity === null
        ? null
        : Object.freeze({
          cssColor: link.beamIdentity.cssColor,
          threeColor: link.beamIdentity.threeColor,
        }),
    }),
    cone: Object.freeze({
      // The accepted plan owns role treatment. In particular, do not turn an
      // intra target into the serving cone: its target treatment must remain
      // visibly distinct while its copied identity stays in the same hue
      // family as the source satellite.
      style: link.visual.coneStyle,
      visible: coneVisible,
      volume: coneVisible ? 1 : 0,
    }),
    footprint: Object.freeze({
      style: link.visual.footprintStyle,
      visible: true,
    }),
    link: Object.freeze({
      style: link.visual.dataLinkStyle,
      isSolidData,
      isMeasurementOnly: link.visual.isMeasurementOnly,
    }),
  });
  return { instruction, isSolidData };
}

/**
 * Adapt a bounded CandidatePresentationPlan into renderer-neutral scene
 * instructions.
 *
 * This module deliberately consumes only `displayedLinks` and the accepted
 * authority join. It does not read opportunity metrics, calculate EE, rank
 * candidates, or alter the scientific decision frame. Display invariants are
 * checked at this seam so a renderer cannot accidentally turn a candidate into
 * simultaneous service or exceed the plan's cone-volume budget.
 */
export function buildMultiCandidateScenePresentation(
  plan: CandidatePresentationPlan,
  authorityJoin?: HandoverAuthorityJoin | null,
): MultiCandidateScenePresentation {
  if (plan === null || typeof plan !== 'object') fail('plan must be an object');
  const sourceFrameId = assertNonEmpty(plan.decision.sourceFrameId, 'plan sourceFrameId');
  if (!Number.isInteger(plan.budget.maxConeVolumes) || plan.budget.maxConeVolumes < 0) {
    fail('budget.maxConeVolumes must be a non-negative integer');
  }
  if (!Array.isArray(plan.displayedLinks)) fail('displayedLinks must be an array');

  // The decision frame is the accepted scene input. An explicit join is
  // accepted for callers that already performed the authority join; the
  // fallback keeps this pure adapter usable at existing call sites.
  const acceptedJoin = acceptedAuthorityJoin(
    plan,
    authorityJoin === undefined ? resolveHandoverAuthorityJoin(plan.decision) : authorityJoin,
  );

  const seenPairs = new Set<string>();
  const mapped = plan.displayedLinks.map(link => {
    const pairKey = assertPairJoin(link, sourceFrameId);
    if (seenPairs.has(pairKey)) fail(`duplicate displayed pair ${pairKey}`);
    seenPairs.add(pairKey);
    return mapLink(
      link,
      pairKey,
      resolveTransitionRole(link.key, acceptedJoin),
    );
  });
  const instructions = mapped.map(value => value.instruction);
  const serving = instructions.find(instruction => instruction.isServing) ?? null;
  const candidates = instructions.filter(instruction => instruction.isCandidate);
  const coneVolumeCount = instructions.reduce((count, instruction) => count + instruction.cone.volume, 0);
  if (coneVolumeCount > plan.budget.maxConeVolumes) {
    fail(
      `cone volume budget exceeded: ${coneVolumeCount} > ${plan.budget.maxConeVolumes}`,
    );
  }
  const solidDataLinkCount = mapped.reduce(
    (count, value) => count + (value.isSolidData ? 1 : 0),
    0,
  );
  if (solidDataLinkCount > 1) fail(`more than one solid data link: ${solidDataLinkCount}`);
  if (solidDataLinkCount !== (serving === null ? 0 : 1)) {
    fail(`solid data link count does not match serving link: ${solidDataLinkCount}`);
  }
  if (plan.activeDataLinkCount !== solidDataLinkCount) {
    fail(
      `plan active data link count ${plan.activeDataLinkCount} does not match mapped count ${solidDataLinkCount}`,
    );
  }

  return Object.freeze({
    episodeId: plan.decision.episodeId,
    sourceFrameId,
    budget: plan.budget,
    instructions: Object.freeze(instructions),
    serving,
    candidates: Object.freeze(candidates),
    coneVolumeCount,
    activeDataLinkCount: solidDataLinkCount as 0 | 1,
    solidDataLinkCount: solidDataLinkCount as 0 | 1,
  });
}
