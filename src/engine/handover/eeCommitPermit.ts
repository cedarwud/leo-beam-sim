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
     * The serving link measured below the floor, but the pair it is being
     * replaced with has no measurable EE this frame -- the continuity lane,
     * where the old pair has already vanished.
     *
     * This is deliberately NOT 'measured'. The first version of that lane
     * passed the threshold itself as the target EE so it could reuse the
     * measured mint, which made the permit claim evidence it did not have: a
     * target with worse EE, or none at all, still produced a permit recording a
     * measured comparison. A cross-family review caught it.
     */
    readonly kind: 'serving-below-floor-no-target-evidence';
    readonly servingEeBitsPerJoule: number;
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

/**
 * Every permit this module has actually issued.
 *
 * The type brand is phantom: it exists only at compile time, so the runtime
 * object carries no evidence of its origin. A cross-family review showed that
 * made the permit forgeable in ways neither tsc nor the source-text guard could
 * see -- `JSON.parse(JSON.stringify({...}))` assigned through `any`,
 * `Object.assign`, generic laundering, `satisfies`. None of those is a type
 * assertion, so scanning for `as EeCommitPermit` never fired.
 *
 * Identity is therefore tracked at runtime. A forged object is not in this set,
 * whatever its shape, and `assertMintedPermit` rejects it. WeakSet so permits
 * stay garbage-collectable.
 */
const issuedPermits = new WeakSet<EeCommitPermit>();

// Captured at module load. `assertMintedPermit` would otherwise reach
// WeakSet.prototype.has through a normal property lookup, which same-realm code
// can replace with `() => true`. Cheap to close, so closed -- though a caller
// able to patch built-ins has other routes and this is not the threat this
// module is primarily defending against.
const weakSetHas = WeakSet.prototype.has;
const weakSetDelete = WeakSet.prototype.delete;

function mint(path: HandoverCommitPath, evidence: EeCommitEvidence): EeCommitPermit {
  // The brand exists only in the type system -- `declare const ... unique symbol`
  // has no runtime value, so it is asserted here rather than assigned. This is
  // the one place that assertion is legitimate; check:handover rejects the same
  // assertion anywhere else.
  const permit = Object.freeze({ path, evidence }) as unknown as EeCommitPermit;
  issuedPermits.add(permit);
  return permit;
}

/**
 * Reject anything this module did not issue.
 *
 * Call this at the point of use, before acting on a permit. The type system
 * cannot do this job: a phantom brand is erased at runtime, and no TypeScript
 * construct prevents a determined cast or an `any` round-trip.
 */
export function assertMintedPermit(permit: EeCommitPermit, context: string): void {
  // Single use. A permit authorizes ONE commit, so it is consumed here rather
  // than merely checked: without this, a permit obtained once could authorize
  // any number of later commits, including ones whose evidence no longer holds.
  // Every call site mints inline, so nothing today depends on replay.
  if (!weakSetHas.call(issuedPermits, permit)) {
    throw new Error(
      `${context}: this EeCommitPermit was not issued by eeCommitPermit.ts. A permit is authorization `
      + 'to commit a handover; fabricating one bypasses the EE evidence rule entirely. Obtain it from '
      + 'a mint function, or it has already been used -- a permit authorizes one commit.',
    );
  }
  weakSetDelete.call(issuedPermits, permit);
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
  // A non-finite threshold makes every comparison below vacuously false, so it
  // would mint on absent evidence. Refuse rather than fail open.
  // EE is bits per joule: physically non-negative. A negative value is an error
  // sentinel from an upstream measurement, not evidence, and comparing two of
  // them produces an ordering that means nothing.
  if (!Number.isFinite(thresholdBitsPerJoule) || thresholdBitsPerJoule < 0) return null;
  if (servingEeBitsPerJoule === null || !Number.isFinite(servingEeBitsPerJoule)) return null;
  if (servingEeBitsPerJoule < 0) return null;
  if (targetEeBitsPerJoule === null || !Number.isFinite(targetEeBitsPerJoule)) return null;
  if (targetEeBitsPerJoule <= 0) return null;
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
 * Authorize a continuity replacement for a serving pair that has vanished.
 *
 * Requires evidence that the serving link was below the floor -- a vanished
 * pair is not by itself permission to replace a link that was still healthy --
 * but records honestly that the replacement's own EE could not be measured,
 * because the frame the old pair disappeared from has no comparison to offer.
 */
export function mintContinuityEePermit(input: {
  readonly path: HandoverCommitPath;
  readonly servingEeBitsPerJoule: number | null;
  readonly thresholdBitsPerJoule: number;
}): EeCommitPermit | null {
  const { path, servingEeBitsPerJoule, thresholdBitsPerJoule } = input;
  if (!Number.isFinite(thresholdBitsPerJoule) || thresholdBitsPerJoule < 0) return null;
  if (servingEeBitsPerJoule === null || !Number.isFinite(servingEeBitsPerJoule)) return null;
  if (servingEeBitsPerJoule < 0) return null;
  if (servingEeBitsPerJoule >= thresholdBitsPerJoule) return null;
  return mint(path, {
    kind: 'serving-below-floor-no-target-evidence',
    servingEeBitsPerJoule,
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
