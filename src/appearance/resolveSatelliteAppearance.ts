/**
 * WHERE A SATELLITE'S IDENTITY COLOUR COMES FROM — the single precedence ladder.
 *
 * Before this, the satellite ladder was spelled out separately at each call site in
 * MainScene.tsx, and the two call sites disagreed about whether the accepted snapshot
 * was consulted:
 *   - The ambient fallback site consulted the accepted snapshot, then fell back to
 *     deterministic identity.
 *   - The live satellite markers site skipped the accepted snapshot entirely and
 *     supplied only deterministic identity.
 *
 * That meant the SAME satellite could appear in one colour as an ambient marker and
 * another through the fallback path: not because anyone chose two colours, but
 * because nobody owned the order. The order is now single and fixed:
 *
 *   1. HOMEPAGE PROJECTION — when the homepage controller owns identity on this
 *      surface. It is a compact-family projection of the accepted snapshot.
 *   2. ACCEPTED SNAPSHOT — the published colour from the accepted handover plan.
 *      The scene must agree with the rail and the accepted plan.
 *   3. DETERMINISTIC IDENTITY — `colorForServingSatellite(satId).markerColor`.
 *      Stable from the satellite id alone, ensuring consistent identity across
 *      frames and views outside any snapshot.
 *   4. NEUTRAL — only when the id itself is unusable (empty string). An unusable
 *      id has no identity; answering with a real colour would be inventing one.
 *
 * A miss at any rung falls to the next. A rung misses when its lookup answers
 * `undefined` or the empty string. No caller may skip a rung or substitute its
 * own fallback authority.
 */
import { colorForServingSatellite } from '../constants/servingColour';
import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';

export interface SatelliteIdentitySources {
  /** Accepted snapshot's published colour for this satellite, or undefined on a miss. */
  readonly acceptedColorFor?: (satId: string) => string | undefined;
  /** Homepage compact-family projection; present only when the homepage owns identity. */
  readonly homepageColorFor?: (satId: string) => string | undefined;
}

export function resolveSatelliteIdentityColor(
  satId: string,
  sources: SatelliteIdentitySources,
): string {
  if (satId.length === 0) {
    // An unusable id has no identity, so answering with a real colour would be
    // inventing one.
    return HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR;
  }

  const homepage = sources.homepageColorFor?.(satId);
  if (homepage !== undefined && homepage.length > 0) return homepage;

  const accepted = sources.acceptedColorFor?.(satId);
  if (accepted !== undefined && accepted.length > 0) return accepted;

  return colorForServingSatellite(satId).markerColor;
}
