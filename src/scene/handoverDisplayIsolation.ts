// Compatibility exports: the timing/envelope decision itself lives in the
// pure appearance owner. This scene module retains only display isolation.
export {
  INTER_HANDOVER_CINEMA_DISPLAY_MS,
  INTER_HANDOVER_CINEMA_PHASE_END,
  INTRA_HANDOVER_CINEMA_DISPLAY_MS,
  resolveHandoverCinemaDisplayMs,
  resolveHandoverCinemaEnvelope,
  resolveInterHandoverCinemaEnvelope,
} from '../appearance/handoverTimingEnvelope';
export type { HandoverConeEnvelope } from '../appearance/handoverTimingEnvelope';

export interface HandoverDisplayIsolationState {
  readonly active: boolean;
  readonly hidePrimaryServingBeam: boolean;
  /** Explicit homepage opt-in to keep the existing configured serving fan during inter. */
  readonly preserveConfiguredServingFan: boolean;
  readonly hideCandidateFan: boolean;
  /** Inter cinema replaces the normal live beam field with one explicit pair + target fan. */
  readonly hideNormalBeamField: boolean;
  /** The inter target fan is rendered separately from the normal candidate layer. */
  readonly showCinemaCandidateFan: boolean;
  readonly hideTimelinePulse: boolean;
  readonly hideTimelineTriggered: boolean;
  readonly hideTimelineEffects: boolean;
  /** Natural pulse/link/ripple/toast layers must not paint through an explicit story. */
  readonly suppressNaturalHandoverLayers: boolean;
}

export type HandoverCinemaArmFilter = 'off' | 'intra' | 'inter';

/**
 * The live cell model can expose a real handover while the teaching director
 * is idle.  Those two streams share the same event shape, but only the
 * explicit presentation owners may replace the normal beam field.
 */
export type HandoverDisplayPresentationSource = 'walker' | 'tle' | 'manual' | 'cinema';

export interface HandoverDisplayEventRef {
  readonly ueId: string;
  readonly sourceTimeSec: number;
}

/**
 * Select the event set the display owner is allowed to paint.
 *
 * The live model may retain several recent handovers at once because that is
 * useful for truth/telemetry. The teaching viewport has one protagonist by
 * default, so it must not let that retention buffer become a second scene
 * owner. The optional breadth switch is an explicit display choice; it never
 * changes the model event buffer.
 */
export function selectHandoverEventsForDisplay<T extends HandoverDisplayEventRef>(
  events: readonly T[] | undefined,
  protagonistUeId: string | null | undefined,
  showOtherHandoverUes: boolean,
): readonly T[] {
  if (!events || events.length === 0) return [];
  if (showOtherHandoverUes) return events;
  if (protagonistUeId === null || protagonistUeId === undefined) return [];

  let latest: T | null = null;
  for (const event of events) {
    if (event.ueId !== protagonistUeId) continue;
    if (latest === null || event.sourceTimeSec > latest.sourceTimeSec) latest = event;
  }
  return latest === null ? [] : [latest];
}

/**
 * React may receive the seek-landed callback one render before the newly
 * reseated simulation frame is visible to MainScene.  Keep the cinema parked
 * until the same source clock is visibly at the requested landing; a small
 * tolerance covers the first playback tick after the reseat.
 */
export const HANDOVER_CINEMA_SEEK_LANDING_TOLERANCE_SEC = 1;

export function shouldSuppressInterSeekFade(filter: HandoverCinemaArmFilter): boolean {
  return filter === 'inter';
}

/**
 * Cinema's clock starts when the requested live frame has actually landed.
 * The candidate may be known during the fade/seek arm window, but that is not
 * yet the visible handover story.  This applies to both kinds: starting an
 * intra envelope before its seek landed made the scene/rail pair briefly read
 * from different source frames, even though inter already waited correctly.
 */
export function resolveHandoverCinemaReady(input: {
  readonly active: boolean;
  readonly kind: 'intra' | 'inter' | null | undefined;
  readonly requestedSeekKey: string | null | undefined;
  readonly landedSeekKey: string | null | undefined;
  readonly requestedSeekTargetSec: number | null | undefined;
  readonly currentSimTimeSec: number | null | undefined;
}): boolean {
  if (!input.active) return false;
  const matchingSeek = input.requestedSeekKey !== null
    && input.requestedSeekKey !== undefined
    && input.requestedSeekKey === input.landedSeekKey;
  if (!matchingSeek) return false;
  if (
    input.requestedSeekTargetSec === null
    || input.requestedSeekTargetSec === undefined
    || input.currentSimTimeSec === null
    || input.currentSimTimeSec === undefined
    || !Number.isFinite(input.requestedSeekTargetSec)
    || !Number.isFinite(input.currentSimTimeSec)
  ) return false;
  return Math.abs(input.currentSimTimeSec - input.requestedSeekTargetSec)
    <= HANDOVER_CINEMA_SEEK_LANDING_TOLERANCE_SEC;
}

export function resolveHandoverDisplayIsolation(input: {
  readonly manualHandoverActive: boolean;
  /** A manual request may be armed before its drawable endpoints resolve. */
  readonly manualHandoverRequested?: boolean;
  readonly cinemaCandidateActive: boolean;
  /** A cinema button has claimed the viewport, but its exact frame has not landed yet. */
  readonly cinemaCandidateArmed?: boolean;
  readonly cinemaCandidateReady?: boolean;
  readonly cinemaCandidateKind?: 'intra' | 'inter' | null;
  /** Display-only opt-in; the renderer still resolves the configured 1/7/19 fan. */
  readonly preserveConfiguredServingFan?: boolean;
  /** Source of the normalized presentation owner, when one is visible. */
  readonly presentationSource?: HandoverDisplayPresentationSource;
  /** The normalized owner currently presents a natural Walker/TLE handover. */
  readonly naturalPresentationActive?: boolean;
  /**
   * The live model has admitted a cross-satellite candidate, but has not fired
   * the handover event yet. Keep that candidate out of the ordinary fan layer;
   * it must enter through the same normalized inter story as the badge/pair.
   */
  readonly naturalInterCandidatePending?: boolean;
  /** Kind of the normalized owner currently being presented. */
  readonly presentationKind?: 'intra' | 'inter' | null;
  /** Shared owner mode; cooldown is still occupied even when `active` is false. */
  readonly presentationMode?: 'idle' | 'presenting' | 'cooldown';
  /**
   * A scripted handover lecture is open. Its whole point is that two cones can
   * be read against each other, which the ambient fan drawn behind them
   * defeats, so a lecture clears the field for BOTH kinds and declines the
   * homepage's keep-the-configured-fan opt-in. The lecture draws its own pair
   * from its own layer, so this holds for the whole run rather than only while
   * a live presentation owner happens to be active.
   */
  readonly teachingLectureActive?: boolean;
}): HandoverDisplayIsolationState {
  // Keep the old flag-only contract for existing pure callers/tests. A natural
  // source claims the display only after the normalized presentation owner has
  // acquired a drawable story. Intra keeps the existing beam field geometry;
  // inter additionally replaces that field with its alternate source/target frame.
  const sourceOwnsPresentation = input.presentationSource === undefined
    || input.presentationSource === 'manual'
    || input.presentationSource === 'cinema';
  const presentationKind = input.presentationKind ?? input.cinemaCandidateKind ?? null;
  const naturalPresentationActive = (
    input.presentationSource === 'walker' || input.presentationSource === 'tle'
  ) && input.naturalPresentationActive === true
    && presentationKind !== null;
  const naturalInterPresentationActive = naturalPresentationActive
    && presentationKind === 'inter';
  const explicitPresentationActive = sourceOwnsPresentation
    && (input.manualHandoverActive || input.cinemaCandidateActive);
  const teachingLectureOwnsField = input.teachingLectureActive === true;
  const active = teachingLectureOwnsField
    || explicitPresentationActive
    || naturalPresentationActive;
  const interCinemaActive = active && presentationKind === 'inter';
  const preserveConfiguredServingFan = input.preserveConfiguredServingFan === true
    && interCinemaActive
    && !teachingLectureOwnsField;
  const cinemaPending = sourceOwnsPresentation
    && input.cinemaCandidateArmed === true
    && input.cinemaCandidateReady !== true
    && !input.manualHandoverActive;
  const naturalPresentationOwns = input.presentationSource === 'walker'
    || input.presentationSource === 'tle';
  const explicitPresentationOwns = input.presentationSource === 'manual'
    || input.presentationSource === 'cinema';
  // A natural owner or its cooldown remains the only owner until it releases.
  // The armed flags are requests, not a second permission to blank or replace
  // that owner. With no active owner, an explicit request may claim the field.
  const explicitClaimMayPaint = !naturalPresentationOwns
    && (explicitPresentationOwns || input.presentationMode === undefined || input.presentationMode === 'idle');
  // A natural Walker/TLE source owns this policy only through the normalized
  // story above. A manual request, however, is an explicit claim even during the one render in
  // which its pair is not drawable yet; otherwise the old natural pulse can
  // leak through before the fail-closed manual story is resolved.
  const manualClaimed = explicitClaimMayPaint && (input.manualHandoverRequested === true
    || input.manualHandoverActive);
  const cinemaClaimed = explicitClaimMayPaint && (input.cinemaCandidateArmed === true
    || input.cinemaCandidateActive);
  const naturalInterCandidatePending = input.naturalInterCandidatePending === true
    && !naturalInterPresentationActive
    && !explicitPresentationActive
    && !cinemaPending;
  const suppressNaturalHandoverLayers = naturalPresentationActive
    || manualClaimed
    || cinemaClaimed
    || teachingLectureOwnsField;

  return {
    active,
    hidePrimaryServingBeam: active,
    preserveConfiguredServingFan,
    // A natural pending frame is still ordinary live playback. Keep the
    // candidate fan visible until the accepted event claims the presentation
    // so the user can compare the measured candidates before commit.
    hideCandidateFan: active || cinemaPending,
    hideNormalBeamField: interCinemaActive || teachingLectureOwnsField,
    // Intra draws both of its cones from one spacecraft, and the pair layer
    // owns them, so no extra target fan may crowd the two ends being compared.
    showCinemaCandidateFan: interCinemaActive && !teachingLectureOwnsField,
    hideTimelinePulse: active || cinemaPending || manualClaimed,
    hideTimelineTriggered: active || cinemaPending || manualClaimed,
    hideTimelineEffects: active || cinemaPending || manualClaimed,
    suppressNaturalHandoverLayers,
  };
}

export interface InterCinemaFromAnchor {
  readonly eventId: string;
  readonly fromSatId: string;
  readonly fromCellId: number | null;
}

export interface InterCinemaPairAnchor {
  readonly eventId: string;
  readonly fromSatId: string;
  readonly fromCellId: number | null;
  readonly toSatId: string;
  readonly toCellId: number | null;
  /** Display-only last-known apex used only while a rebuilt frame omits that id. */
  readonly fromApexWorld?: InterCinemaApexWorld;
  readonly toApexWorld?: InterCinemaApexWorld;
}

export interface InterCinemaApexWorld {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Capture the visual source identity once, before the live seek rebuilds its frame.
 * This is a presentation anchor only; it never feeds the simulation or handover model.
 */
export function resolveInterCinemaFromAnchor(input: {
  readonly eventId: string;
  readonly captured: InterCinemaFromAnchor | null;
  readonly currentServingSatId: string | null | undefined;
  readonly currentCellId: number | null | undefined;
  readonly fallbackSatId: string;
  readonly fallbackCellId: number | null;
}): InterCinemaFromAnchor {
  if (input.captured?.eventId === input.eventId) return input.captured;
  return {
    eventId: input.eventId,
    fromSatId: input.currentServingSatId ?? input.fallbackSatId,
    fromCellId: input.currentCellId ?? input.fallbackCellId,
  };
}

/**
 * Latch the complete display pair for one inter event. The live seek rebuilds
 * the simulation frame and may expose a different current serving/pending
 * record; that record must never rewrite an already-started teaching shot.
 */
export function resolveInterCinemaPairAnchor(input: {
  readonly eventId: string;
  readonly captured: InterCinemaPairAnchor | null;
  readonly fallback: Omit<InterCinemaPairAnchor, 'eventId'>;
}): InterCinemaPairAnchor {
  if (input.captured?.eventId === input.eventId) return input.captured;
  return {
    eventId: input.eventId,
    ...input.fallback,
  };
}
