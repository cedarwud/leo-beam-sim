/**
 * Authorization to commit one handover.
 *
 * SDD §2 F1: seven code paths can commit a handover and one consults the EE
 * threshold. Comments asking the other six to check EE do not bind — that was
 * measured, not assumed. This module makes the authority a value instead: a
 * commit requires an `EeCommitPermit`, and a permit can only be minted here.
 *
 * The permit is branded with a `unique symbol` that is declared but never
 * exported, so outside this module an object literal cannot satisfy the type —
 * `tsc` reports the brand as missing. The mint functions below are the only
 * supported way to obtain one, and each records on the permit what evidence it
 * was granted against.
 *
 * Honest limit, measured rather than assumed: the brand stops ACCIDENTS, not a
 * determined cast. `{...} as unknown as EeCommitPermit` still compiles, and no
 * TypeScript construct prevents that — a private class field was tried and does
 * not stop it either. So the second half of the guard is mechanical, not
 * type-level: `scripts/check-handover.ts` fails the run if `EeCommitPermit`
 * appears in a type assertion anywhere outside this file.
 *
 * Why a legacy mint exists. The rail-timeline engine (`handover-manager.ts`,
 * SDD F10) receives `LinkSample[]` — SINR only — and never sees an EE value at
 * all, so it cannot supply EE evidence today. Refusing to mint for it would
 * mean deleting five working commit paths in one step. Instead those commits
 * take a permit that says, in the type system, "granted without EE evidence".
 * `scripts/check-handover.ts` ledgers exactly which paths hold one, and the
 * ledger may only shrink. That converts "six paths quietly ignore EE" from a
 * fact discoverable only by reading all seven into a fact the oracle asserts.
 */

import type { HandoverCommitPath } from './commitProvenance';

declare const eeCommitPermitBrand: unique symbol;

/** Why a commit was authorized. Recorded on the permit, not re-derived later. */
export type EeCommitEvidence =
  | {
    /** First attach, or re-attach after service loss: there is no prior link to measure. */
    readonly kind: 'initial-attach';
  }
  | {
    /** A replacement admitted because the serving link measured below the floor. */
    readonly kind: 'measured';
    readonly servingEeBitsPerJoule: number;
    readonly targetEeBitsPerJoule: number;
    readonly thresholdBitsPerJoule: number;
  }
  | {
    /**
     * Granted to an engine that structurally cannot read EE. Every one of these
     * is a known gap in the EE authority, ledgered in check:handover.
     */
    readonly kind: 'legacy-ee-blind';
    readonly engine: 'handover-manager';
  };

export interface EeCommitPermit {
  /** Present only on permits minted here; not constructible elsewhere. */
  readonly [eeCommitPermitBrand]: true;
  readonly path: HandoverCommitPath;
  readonly evidence: EeCommitEvidence;
}

function mint(path: HandoverCommitPath, evidence: EeCommitEvidence): EeCommitPermit {
  // The brand exists only in the type system -- `declare const ... unique symbol`
  // has no runtime value, so it is asserted here rather than assigned. This is
  // the one place that assertion is legitimate; check:handover rejects the same
  // assertion anywhere else.
  return Object.freeze({ path, evidence }) as unknown as EeCommitPermit;
}

/**
 * Authorize a replacement whose EE evidence was actually measured.
 *
 * Returns null — refusing the commit — unless the serving link is below the
 * threshold and the target is strictly better. This is the one rule the owner
 * has restated repeatedly: a handover may not start while the current service
 * is still at or above the floor.
 */
export function mintMeasuredEePermit(input: {
  readonly path: HandoverCommitPath;
  readonly servingEeBitsPerJoule: number | null;
  readonly targetEeBitsPerJoule: number | null;
  readonly thresholdBitsPerJoule: number;
}): EeCommitPermit | null {
  const { path, servingEeBitsPerJoule, targetEeBitsPerJoule, thresholdBitsPerJoule } = input;
  if (servingEeBitsPerJoule === null || !Number.isFinite(servingEeBitsPerJoule)) return null;
  if (targetEeBitsPerJoule === null || !Number.isFinite(targetEeBitsPerJoule)) return null;
  if (servingEeBitsPerJoule >= thresholdBitsPerJoule) return null;
  if (targetEeBitsPerJoule <= servingEeBitsPerJoule) return null;
  return mint(path, {
    kind: 'measured',
    servingEeBitsPerJoule,
    targetEeBitsPerJoule,
    thresholdBitsPerJoule,
  });
}

/**
 * Authorize an initial attach or a re-attach after service loss.
 *
 * There is no prior serving link, so no serving EE can exist. Without this
 * case the rule "no commit without EE evidence" would be unsatisfiable on
 * first attach, which is why it is encoded rather than left implicit.
 */
export function mintInitialAttachPermit(path: HandoverCommitPath): EeCommitPermit {
  return mint(path, { kind: 'initial-attach' });
}

/**
 * Authorize a commit from an engine that cannot read EE at all.
 *
 * This is the honest name for the F1 gap. Each call site holding one of these
 * is a path that commits handovers without consulting the EE threshold; the
 * set of them is ledgered by check:handover and is expected to shrink to empty.
 * Do not add a new call site without also extending that ledger deliberately.
 */
export function mintLegacyEeBlindPermit(path: HandoverCommitPath): EeCommitPermit {
  return mint(path, { kind: 'legacy-ee-blind', engine: 'handover-manager' });
}

/** True when this permit was granted without any EE evidence behind it. */
export function permitIsEeBlind(permit: EeCommitPermit): boolean {
  return permit.evidence.kind === 'legacy-ee-blind';
}
