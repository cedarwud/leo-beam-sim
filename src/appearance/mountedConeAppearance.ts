/**
 * THE mounted-cone appearance table — what a cone/callout paints once it is on
 * screen.
 *
 * ## Read this first if you were sent here by a prompt
 *
 * If the change you want is any of these:
 *
 *   - "首頁上非主要的波束太亮/太暗"
 *   - "哪些波束算是主要身分波束（要用飽和色）"
 *   - "首頁的錐體要不要跟著換手表變色"
 *
 * then the change is IN THIS FILE and nowhere else.
 *
 * ## Why this exists
 *
 * A measured audit found the homepage beam colour decided TWICE, with the
 * second decision silently overriding the first:
 *
 *     non-hero serving beam, sat-a beam 1
 *       paintConeItems (servingConeItems.ts) -> #69e95d
 *       the cone mount   (SinrLiveCellBeamCones.tsx) -> #8ad183   <- drawn
 *
 * Both consulted the same homepage projection. They disagreed because they
 * disagreed about ONE boolean: the shared path derived `isServing` from the
 * lane's PROMINENCE (`'serving'` -> true), while the mount computed its own
 * `isPrimaryIdentityBeam` from the hero identity and the derived cone role. So
 * "is this the beam you are actually on" had two implementations, and the mount
 * threw the shared answer away. Worse, the SAME question had a THIRD
 * implementation in `SinrLiveCellBeamCallouts.tsx` with a different answer
 * (only the handover TARGET counted, not both sides), so a cone and its own
 * callout could disagree about the beam they were describing.
 *
 * The rule is now data, in one table, with one row per surface. The surfaces
 * still differ — that difference is real and is preserved — but it is now a
 * visible row rather than two expressions in two files that nobody could
 * compare.
 *
 * ## Layering
 *
 * This module does NOT import the homepage projection. `src/appearance/` sits
 * below `src/homepage/` and imports only DOWN, so the homepage projection
 * arrives the way every other identity source arrives: as an injected lookup
 * that answers `undefined` on a miss. The DECISION (which source, which flag,
 * whether a handover shade applies) is here; the SOURCE is supplied.
 */
import { resolveHandoverSide } from './handoverAppearanceModifiers';
import { paintConeItem, type IdentityColorLookup, type PaintableConeItem } from './paintConeItems';
import type { HandoverSide } from './beamAppearanceContract';

/** The two surfaces that mount an already-resolved cone. */
export type ConeMountSurface = 'cone' | 'callout';

/**
 * WHAT MAKES A BEAM "the one you are on" for the purposes of colour.
 *
 * A primary-identity beam is painted in the vivid serving projection; every
 * other beam is pale context. The rows below are the two rules that existed as
 * hand-written boolean expressions in `SinrLiveCellBeamCones.tsx` and
 * `SinrLiveCellBeamCallouts.tsx`, transcribed without change.
 */
export interface PrimaryIdentityBeamRule {
  /** The hero — the beam currently serving the protagonist UE. */
  readonly primaryServing: boolean;
  /** The candidate satellite's own primary cone. */
  readonly candidatePrimary: boolean;
  /** An explicitly triggered demo cone. */
  readonly triggered: boolean;
  /** Which sides of a handover count. */
  readonly handoverSides: readonly HandoverSide[];
  /**
   * Whether this surface reads the render key when deciding the handover side.
   *
   * The cone mount reads the DERIVED cone role and nothing else; the callout
   * reads the item's own role AND its render key. That is a real difference in
   * available signal, not a style choice, and stating it here stops a caller
   * from silently changing a surface's answer by passing one extra field.
   */
  readonly readsRenderKey: boolean;
  /** Why this row is what it is. Prose, for the next person holding a prompt. */
  readonly rationale: string;
}

/**
 * THE TABLE. One row per mounted surface.
 *
 * The `cone` and `callout` rows differ in exactly one field, and that
 * difference is the pre-existing behaviour, recorded rather than "fixed": a
 * cone treats BOTH sides of a handover as primary identity (so the outgoing
 * beam stays vivid while it fades), a callout treats only the TARGET as primary
 * (so the label that matters is the one for the beam you are arriving on).
 *
 * If that asymmetry turns out to be an accident rather than a choice, the fix
 * is one word in one row here — which is the entire point of writing it down.
 */
export const PRIMARY_IDENTITY_BEAM_RULES: {
  readonly [S in ConeMountSurface]: PrimaryIdentityBeamRule;
} = {
  cone: {
    primaryServing: true,
    candidatePrimary: true,
    triggered: true,
    handoverSides: ['source', 'target'],
    readsRenderKey: false,
    rationale: 'both sides of a handover stay vivid so the pair reads as one event rather than a bright beam next to a faded stranger',
  },
  callout: {
    primaryServing: true,
    candidatePrimary: true,
    triggered: true,
    handoverSides: ['target'],
    readsRenderKey: true,
    rationale: 'a callout labels where you are going; the outgoing side is left as context so the two labels are not equally loud',
  },
} as const;

export interface PrimaryIdentityBeamInput {
  readonly surface: ConeMountSurface;
  /** Does this item match the hero (satellite, cell, beam)? */
  readonly isPrimaryServing: boolean;
  /**
   * The role this surface reads. The cone mount passes the DERIVED cone role;
   * the callout passes the item's own role. Those are different signals on
   * purpose and both are preserved.
   */
  readonly role: string | undefined;
  /** Only the callout consults the render key; the cone mount reads the role alone. */
  readonly renderKey?: string | undefined;
}

/** Apply a row. The ONE implementation of "is this a primary identity beam". */
export function resolvePrimaryIdentityBeam(input: PrimaryIdentityBeamInput): boolean {
  const rule = PRIMARY_IDENTITY_BEAM_RULES[input.surface];
  if (rule.primaryServing && input.isPrimaryServing) return true;
  if (rule.candidatePrimary && input.role === 'candidatePrimary') return true;
  if (rule.triggered && input.role === 'triggered') return true;
  const side = resolveHandoverSide({
    role: input.role,
    renderKey: rule.readsRenderKey ? input.renderKey : undefined,
  });
  return side !== null && rule.handoverSides.includes(side);
}

/**
 * DOES A MOUNTED CONE CARRY THE HANDOVER SHADE?
 *
 * Today: NO. The mount replaced the item's colour outright with the homepage
 * projection, discarding whatever `handoverAppearanceModifiers.ts` had already
 * applied. So on the homepage the handover table has no effect on the cone
 * field at all, while it does affect every non-homepage lane.
 *
 * That is recorded here, as one flag, rather than left implicit in a `?:` that
 * happened not to mention the situation axis. It is deliberately NOT changed in
 * the convergence pass that named it: turning it on would recolour every
 * homepage handover cone, which is a visual decision for the owner and not a
 * side effect of moving code. Flip this one constant to hand the homepage the
 * table.
 */
export const MOUNT_APPLIES_HANDOVER_SHADE: boolean = false;

export interface MountedConeColorInput {
  /** The already-resolved render item. Its `color` is the shared path's answer. */
  readonly item: PaintableConeItem;
  /** What the role/prominence style table says, used when the homepage does not own identity. */
  readonly roleColor: string;
  /** Whether the homepage controller owns identity on this surface. */
  readonly homepageIdentity: boolean;
  /** {@link resolvePrimaryIdentityBeam}'s answer for this item on this surface. */
  readonly primaryIdentityBeam: boolean;
  /**
   * The homepage's compact-family projection, injected because `src/appearance/`
   * may not import `src/homepage/`. `undefined` on a miss, never a colour of its
   * own invention.
   */
  readonly homepageColorFor: IdentityColorLookup | undefined;
}

/**
 * THE colour a mounted cone/callout paints.
 *
 * The mount decides nothing after this call. It used to compose a colour here
 * from the homepage projection directly; now it states its situation and takes
 * the answer, so that "what colour is this beam" has one implementation shared
 * with every off-screen lane.
 */
export function resolveMountedConeColor(input: MountedConeColorInput): string {
  if (!input.homepageIdentity || input.homepageColorFor === undefined) {
    return input.roleColor;
  }
  return paintConeItem(input.item, {
    resolveIdentityColor: input.homepageColorFor,
    prominence: 'serving',
    // The flag is STATED, not derived from prominence: the mount knows which
    // beam is the one you are on, and encoding that by choosing a prominence
    // that happens to derive it is what made the two paths disagree.
    isServingOrCandidate: input.primaryIdentityBeam,
    situationKindAuthority: 'lane',
    laneKind: MOUNT_APPLIES_HANDOVER_SHADE ? (input.item.kind ?? null) : null,
  }).color;
}
