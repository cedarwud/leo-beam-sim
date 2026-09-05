/**
 * Which authority approved a handover commit.
 *
 * This module is the provenance authority for SDD §2 F1's seven commit paths.
 * Before it existed, `scripts/check-handover.ts` recovered provenance by
 * regex-matching the human-readable `reason` sentence (`/stable target for/`,
 * `/dwell$/`, ...). That coupled the oracle to prose: rewording a reason
 * silently changed which path the oracle believed had fired, and the
 * `HandoverEvent` log does not carry `reason` at all, so the manager scenarios
 * had to patch the classification back in by hand at every call site.
 *
 * A commit path is now a typed value that the committing code states about
 * itself.
 *
 * Adding a member to `HandoverCommitPath` means adding a way to commit a
 * handover. That is precisely the event the oracle exists to catch, so the
 * union, `HANDOVER_COMMIT_PATHS` and `EXPECTED_COMMIT_PATH_COUNT` in
 * `scripts/check-handover.ts` are meant to be edited together, deliberately.
 */

export type HandoverCommitPath =
  /** Initial attach, or re-attach after service loss. No prior link to measure. */
  | 'manager:initial-attach'
  /** Serving beam left the steering cone; switch to a steerable sibling. */
  | 'manager:continuity-rescue'
  /** Inter-HO once a replaced pending target held for the full trigger time. */
  | 'manager:inter-stable-pending-hold'
  /** Inter-HO once the same pending target stayed best for the full trigger time. */
  | 'manager:inter-stable-target'
  /** Same-satellite beam refinement after dwell. SDD F2: gated on SINR only. */
  | 'manager:intra-dwell'
  /** The committed serving pair vanished; the explicit continuity lane replaced it. */
  | 'live-cell:service-continuity-fallback'
  /** The one path that consults the EE threshold before committing. */
  | 'live-cell:ee-optimization';

/**
 * All seven paths, so the count is a typed fact rather than a number kept in a
 * comment. `scripts/check-handover.ts` asserts the observed topology against
 * this length.
 */
export const HANDOVER_COMMIT_PATHS = Object.freeze([
  'manager:initial-attach',
  'manager:continuity-rescue',
  'manager:inter-stable-pending-hold',
  'manager:inter-stable-target',
  'manager:intra-dwell',
  'live-cell:service-continuity-fallback',
  'live-cell:ee-optimization',
] as const satisfies readonly HandoverCommitPath[]);

/**
 * Compile-time proof that the list above covers the union.
 *
 * `satisfies readonly HandoverCommitPath[]` only checks the other direction --
 * that every listed value belongs to the union. A cross-family review added a
 * union member without listing it here and both `tsc` and `check:handover`
 * passed, because EXPECTED_COMMIT_PATH_COUNT is derived from the LIST: the new
 * commit path was simply never counted or coverage-checked.
 *
 * If a member is missing below, `UnlistedCommitPath` stops being `never` and
 * this line fails to compile, naming the missing path in the error.
 */
type UnlistedCommitPath = Exclude<HandoverCommitPath, typeof HANDOVER_COMMIT_PATHS[number]>;
const _everyCommitPathIsListed: UnlistedCommitPath extends never ? true : UnlistedCommitPath = true;
void _everyCommitPathIsListed;

/**
 * Whether this path reads the EE threshold before committing.
 *
 * Two of seven do. `live-cell:ee-optimization` always did.
 * `live-cell:service-continuity-fallback` now does as well: it requires the
 * vanished link's EE evidence as a required input and refuses to replace a link
 * that was still at or above the floor. Previously that check lived in its one
 * caller, which is the SDD §2 F1 shape -- authority at the call site rather
 * than in the authority.
 *
 * The five `manager:*` paths belong to the SINR-only rail-timeline engine
 * (SDD F10), which never receives an EE value at all, so they still commit
 * blind and hold a `legacy-ee-blind` permit that check:handover ledgers.
 *
 * This is a statement of fact about today's code, not an endorsement.
 */
export function handoverCommitPathConsultsEeThreshold(path: HandoverCommitPath): boolean {
  return path === 'live-cell:ee-optimization'
    || path === 'live-cell:service-continuity-fallback';
}

/**
 * Whether this path commits without any prior serving link, so no serving EE
 * can exist to compare against. An EE permit must treat these differently from
 * a replacement commit, or "no commit without EE evidence" is either false or
 * impossible to satisfy on first attach.
 */
export function handoverCommitPathIsInitialAttach(path: HandoverCommitPath): boolean {
  return path === 'manager:initial-attach';
}

/**
 * Which handover actions each commit path is allowed to produce.
 *
 * A permit records which authority approved a commit. Without this map a permit
 * minted for one path could be passed to a commit of a different kind and the
 * decision would report that path as its provenance -- demonstrated by a
 * cross-family review, which committed an `inter-handover` using a permit
 * minted as `manager:intra-dwell`.
 *
 * `HandoverManager.commitDecision` enforces it. Adding a path means stating
 * here what it may commit, which is the question worth being forced to answer.
 */
export const HANDOVER_COMMIT_PATH_ACTIONS: Readonly<
  Record<HandoverCommitPath, readonly ('inter-handover' | 'intra-switch')[]>
> = Object.freeze({
  // Attach and re-attach are both published as inter-handover today.
  'manager:initial-attach': Object.freeze(['inter-handover'] as const),
  'manager:continuity-rescue': Object.freeze(['intra-switch'] as const),
  'manager:inter-stable-pending-hold': Object.freeze(['inter-handover'] as const),
  'manager:inter-stable-target': Object.freeze(['inter-handover'] as const),
  'manager:intra-dwell': Object.freeze(['intra-switch'] as const),
  // The live-cell lane does not route through HandoverManager.commitDecision;
  // both kinds are listed because its receipts carry either.
  'live-cell:service-continuity-fallback': Object.freeze(['inter-handover', 'intra-switch'] as const),
  'live-cell:ee-optimization': Object.freeze(['inter-handover', 'intra-switch'] as const),
});
