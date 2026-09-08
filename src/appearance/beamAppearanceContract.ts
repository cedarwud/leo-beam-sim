/**
 * THE appearance contract for beams, satellites and handover cues.
 *
 * ## Why this directory exists
 *
 * The owner's report: "我想改波束/衛星/換手的渲染邏輯，會改非常多次都失敗，
 * 甚至把原本好的也改壞了。" The measured cause was not file size. It was that a
 * sentence like "change the intra-handover beam colour" had no single referent:
 * the words could land on a steady serving identity colour, a semantic role
 * pulse colour, a committed carrier colour, a homepage EE shade, or a sink's
 * private fallback — six different pieces of code, none of which owned the
 * question. `scripts/audit/appearance-change-cost.ts` measures this directly:
 * at the baseline, changing ONE rendering decision meant opening up to 14 files.
 *
 * So this is not "another helper". It is a NAMED PLACE. The rule is:
 *
 *   > Appearance is decided here and nowhere else. Everything downstream
 *   > paints what it is handed.
 *
 * ## The four axes
 *
 * REV1's proposal was `FinalColor = Compose(BaseIdentity, HandoverModifier)`.
 * A census of `sinrLiveConeStyle.ts` and `beamRoleTokens.ts` showed that model
 * is one axis short of the real code: those files also encode "how prominent is
 * this cone relative to what the viewer is currently looking at" (hero vs
 * servingFan vs background) and a physical viewing-geometry dim. Folding those
 * into either Base or Modifier is what produced `resolveBeamVisualEncoding`,
 * where a single `color:` expression branches across identity, frequency plan
 * and event hue at once. So the contract names four axes and keeps them apart:
 *
 *   1. IDENTITY   — who this is.        (satId, beamId) and nothing else.
 *   2. PROMINENCE — how loud, relative to the current focus. Never a hue.
 *   3. SITUATION  — what event it is in. Handover kind, side, phase.
 *   4. VIEWING    — physics of looking at it. Elevation dim, distance.
 *
 * Each axis has exactly ONE owning module. An axis may scale or shade another
 * axis's output; no axis may REPLACE another's. Concretely: PROMINENCE may make
 * a cone dimmer, but may never give it a different hue, because hue is IDENTITY
 * and a satellite that changes hue when it becomes interesting is precisely the
 * bug the owner keeps hitting.
 *
 * ## Layering
 *
 * `src/appearance/` sits at the bottom, beside `src/constants/`. `scene/`,
 * `viz/`, `homepage/` and `ui/` all import DOWN into it; it imports nothing
 * from them. This is the same rule `constants/servingColour.ts` documents for
 * itself, and for the same reason: both a `viz/` cone and a `scene/` UE mosaic
 * must reach the same answer, so the answer cannot live in either one.
 *
 * Pure by construction: no React, no refs, no module-level mutable state, no
 * clock. Everything time-varying arrives as an explicit input. That is what
 * makes the matrix test possible, and per the previous session's lesson the
 * ability to write a non-React unit test is the ONLY reliable signal that a
 * seam was cut in the right place.
 */

/** Who a cone/marker/link is. The only input to the IDENTITY axis. */
export interface BeamIdentity {
  readonly satId: string;
  /** Earth-fixed cell id. */
  readonly cellId: number;
  /**
   * Exact link-budget beam id when the item carries one.
   *
   * `null`/absent means "this item did not carry one"; resolve it through
   * {@link resolvedBeamId}, never by reaching for `cellId` directly. Two
   * painting rituals disagreed on exactly this — one preferred the real beam
   * id, the other always re-derived from the cell — and a probe showed 14 of 16
   * sampled combinations therefore rendered one beam in two different colours.
   */
  readonly beamId?: number | null;
}

/**
 * How loud this item is relative to what the viewer is looking at right now.
 *
 * Deliberately NOT the same vocabulary as handover state. A cone can be the
 * `hero` while no handover is happening, and can be `background` while it is a
 * handover source. Six overlapping role unions exist across the older modules
 * (`SinrLiveConeRole`, `BeamCodeRole`, `BeamVisualRole`, `HandoverBeamRole`,
 * `BeamVisualEncodingRole`, `SinrLiveConeLayer`); this is the one that governs
 * appearance, and adapters map the legacy unions into it.
 */
export type BeamProminence =
  | 'hero'
  | 'serving'
  | 'candidate'
  | 'ambient'
  | 'background';

/** Which side of a handover an item is on. */
export type HandoverSide = 'source' | 'target';

/**
 * What event this item is in. `kind: null` means steady state — no handover is
 * being told, and the SITUATION axis contributes nothing.
 */
export interface HandoverSituation {
  readonly kind: 'intra' | 'inter' | null;
  readonly side: HandoverSide | null;
  /** Envelope phase; see `HANDOVER_CONE_PHASE_END` in constants/sinrLiveConeStyle.ts. */
  readonly phase: 'serving' | 'measuring' | 'holding' | 'releasing' | 'settled' | null;
}

/**
 * Where the identity colour comes from, supplied by the caller as pure lookups.
 *
 * These are FUNCTIONS, not resolved colours, so the precedence between them is
 * decided in one place ({@link resolveBaseIdentityColor}) instead of being
 * re-litigated by every call site through a differently-computed `fallback`
 * argument. Each returns `undefined` on a miss — never a colour of its own
 * invention, because a sink inventing a fallback colour is how the same
 * satellite ends up different colours on different surfaces.
 */
export interface IdentitySources {
  /** The accepted comparison plan's own published colour. Outranks everything. */
  readonly planColorFor?: (satId: string, beamId: number) => string | undefined;
  /**
   * The accepted presentation snapshot's published colour for this beam, if the
   * snapshot has one. Highest precedence: it is what the right-hand rail shows,
   * and the scene must agree with the rail.
   */
  readonly acceptedColorFor?: (satId: string, beamId: number) => string | undefined;
  /**
   * The homepage's compact-family projection, when the homepage owns identity.
   * Present only on the homepage; absent elsewhere.
   */
  readonly homepageColorFor?: (
    satId: string,
    beamId: number,
    isServingOrCandidate: boolean,
  ) => string | undefined;
}

/**
 * The finished appearance. Downstream paints this and decides nothing.
 *
 * Every field here must be READ by something. An `emissive` field lived here
 * for one pass: it was declared once, written once, and read nowhere, and the
 * ~25 lines of duplicated HSL arithmetic that computed it were dead weight that
 * still had to be understood by anyone auditing the module. A contract carrying
 * a field no renderer consumes is a claim this module does not actually own —
 * the opposite of the point. Add a field when a painter asks for it.
 */
export interface BeamAppearance {
  readonly color: string;
}

/**
 * The one way to get a beam id out of an identity.
 *
 * Every painter must go through this. The `cellId + 1` derivation is a fallback
 * for items that genuinely carry no link-budget id — it is NOT a licence to
 * ignore an id the item does carry.
 */
export function resolvedBeamId(
  identity: Pick<BeamIdentity, 'cellId' | 'beamId'>,
  deriveFromCell: (cellId: number) => number,
): number {
  return identity.beamId ?? deriveFromCell(identity.cellId);
}

/**
 * THE rule for "does this item count as serving-or-candidate".
 *
 * The flag selects the homepage's EE shade, so it is an appearance decision and
 * it gets exactly one implementation. A lane may STATE it (`explicit`), because
 * the alternative — encoding it by choosing a prominence that happens to derive
 * it — makes the PROMINENCE axis carry something that is not loudness. When a
 * lane says nothing, prominence derives it.
 *
 * This lives beside the axes rather than inside either composer because both
 * {@link resolveBeamAppearance} and the cone painter need the same answer, and
 * two `=== 'serving' || === 'candidate'` expressions is how the axes drift.
 */
export function resolveServingOrCandidateFlag(
  prominence: BeamProminence,
  explicit?: boolean,
): boolean {
  return explicit ?? (prominence === 'serving' || prominence === 'candidate');
}
