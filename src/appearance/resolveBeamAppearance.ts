/**
 * The composition point: identity + prominence + situation -> one appearance.
 *
 * This is the function every renderer ends up calling, directly or through
 * {@link paintConeItems}. It is deliberately boring — the interesting decisions
 * live in the modules it composes, one axis each:
 *
 *   IDENTITY   -> resolveBaseIdentityColor (below) + constants/servingColour.ts
 *   SITUATION  -> handoverAppearanceModifiers.ts   <- the handover table
 *   PROMINENCE -> the geometry/role layer's opacity, scaled here
 *
 * Nothing in this file picks a colour out of the air. It picks a SOURCE for a
 * colour, applies a table row, and returns. If you are looking for a hue, you
 * are in the wrong file; see the header of `handoverAppearanceModifiers.ts`.
 */
import { colorForServingBeam } from '../constants/servingColour';
import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';
import {
  resolveServingOrCandidateFlag,
  type BeamAppearance,
  type BeamIdentity,
  type BeamProminence,
  type HandoverSituation,
  type IdentitySources,
} from './beamAppearanceContract';
import {
  applyHandoverShade,
  handoverModifierFor,
} from './handoverAppearanceModifiers';

/**
 * Options for {@link resolveBaseIdentityColor}.
 */
export interface BaseIdentityColorOptions {
  readonly isServingOrCandidate?: boolean;
}

/**
 * WHERE A BEAM'S IDENTITY COLOUR COMES FROM — the single precedence ladder.
 *
 * Before this, the ladder was spelled out separately at every call site, and
 * each site supplied its own `fallback` argument computed a different way. That
 * is why the same satellite could be one colour in the scene and another in the
 * rail: not because anyone chose two colours, but because nobody owned the
 * order. The order is now:
 *
 *   0. COMPARISON PLAN — `sources.planColorFor?.(satId, beamId)`. The accepted
 *      comparison plan's own published colour for this beam. Outranks
 *      everything: it is authored specifically for the comparison episode, so
 *      it outranks the general presentation snapshot.
 *   1. HOMEPAGE PROJECTION — when the homepage controller owns identity on this
 *      surface. It is a compact-family projection of the accepted snapshot, and
 *      it is authoritative there precisely so a satellite does not change hue
 *      when it becomes serving.
 *   2. ACCEPTED SNAPSHOT — the colour the right-hand rail is already showing.
 *      The scene must agree with the rail; the rail published first.
 *   3. DETERMINISTIC IDENTITY — `colorForServingBeam(satId, beamId)`. Stable
 *      from the id alone, so an ambient beam outside any snapshot still gets
 *      the same colour every frame and on every surface.
 *   4. NEUTRAL — only when the id itself is unusable. Reaching this is a bug in
 *      the caller, not a style choice. An unusable id has no identity, so
 *      answering with a real colour would be inventing one, and
 *      `colorForServingBeam(sat, NaN)` silently returned lightness rung 0 — a
 *      real, plausible-looking colour for a bug.
 *
 * A miss at any rung falls to the next. No rung may be skipped by a caller, and
 * no caller may substitute its own rung: that is the "downstream autonomous
 * fallback" the audit identified as the root cause.
 *
 * A rung MISSES when its lookup answers `undefined` or the empty string. A
 * lookup must never answer a colour of its own invention to signal a miss —
 * that is what made a miss indistinguishable from a hit at the boundary.
 */
export function resolveBaseIdentityColor(
  satId: string,
  beamId: number,
  sources: IdentitySources,
  options: BaseIdentityColorOptions = {},
): string {
  if (satId.length === 0 || !Number.isFinite(beamId)) {
    // An unusable id has no identity, so answering with a real colour would be
    // inventing one, and colorForServingBeam(sat, NaN) silently returned
    // lightness rung 0 — a real, plausible-looking colour for a bug.
    return HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR;
  }
  const plan = sources.planColorFor?.(satId, beamId);
  if (plan !== undefined && plan.length > 0) return plan;

  const homepage = sources.homepageColorFor?.(
    satId,
    beamId,
    options.isServingOrCandidate ?? false,
  );
  if (homepage !== undefined && homepage.length > 0) return homepage;

  const accepted = sources.acceptedColorFor?.(satId, beamId);
  if (accepted !== undefined && accepted.length > 0) return accepted;

  return colorForServingBeam(satId, beamId).markerColor;
}

export interface BeamAppearanceInput {
  readonly identity: BeamIdentity;
  /** Already-resolved link-budget beam id; use `resolvedBeamId` to get it. */
  readonly beamId: number;
  readonly prominence: BeamProminence;
  readonly situation: HandoverSituation;
  readonly sources: IdentitySources;
  /**
   * Whether this item counts as serving-or-candidate for the homepage's EE
   * shade projection. Defaults to the prominence-derived value; see
   * {@link resolveServingOrCandidateFlag} for why a lane may say it outright.
   */
  readonly isServingOrCandidate?: boolean;
}

/**
 * Compose the four axes into one finished appearance.
 *
 * Order matters and is fixed: identity first, then the handover shade on top of
 * it, then opacity. Shading an already-shaded colour, or shading a colour that
 * was itself picked by a role, is what produced the "改三個地方還是壞" symptom.
 */
export function resolveBeamAppearance(input: BeamAppearanceInput): BeamAppearance {
  const identityColor = resolveBaseIdentityColor(
    input.identity.satId,
    input.beamId,
    input.sources,
    {
      isServingOrCandidate: resolveServingOrCandidateFlag(
        input.prominence,
        input.isServingOrCandidate,
      ),
    },
  );
  const modifier = handoverModifierFor(input.situation);
  return {
    color: applyHandoverShade(identityColor, modifier),
  };
}
