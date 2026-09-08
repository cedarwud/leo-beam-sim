import type { Vector3 } from 'three';
import {
  handoverRoleForSide,
  HANDOVER_TRANSITION_OPACITY_OVERLAY,
} from '../appearance/handoverAppearanceModifiers';
import type {
  BeamProminence,
  HandoverSide,
} from '../appearance/beamAppearanceContract';
import { coneItemBeamId, paintConeItem } from '../appearance/paintConeItems';
import {
  resolveSinrLiveHandoverPulseConeItems as resolvePulseGeometry,
  resolveTriggeredIntraConeItems as resolveTriggeredGeometry,
  resolveCinemaHandoverPairConeItems as resolveCinemaPairGeometry,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveCellPlacement,
  type SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import {
  SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
  type SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';
import { selectHandoverEventsForDisplay } from './handoverDisplayIsolation';
import { type HandoverConeEnvelope } from '../constants/sinrLiveConeStyle';
import { type WorldPoint } from '../viz/CellFootprints';

type ResolveSceneAcceptedBeamColor = (
  satelliteId: string,
  beamId: number,
  isServingOrCandidate?: boolean,
) => string | undefined;

type RestrictHomepageBeamItems = (
  items: readonly SinrLiveCellBeamConeRenderItem[],
) => readonly SinrLiveCellBeamConeRenderItem[];

/**
 * The colour for ONE SIDE of a pair lane.
 *
 * The three pair geometries take `fromColor`/`toColor` as ARGUMENTS, so the
 * render item does not exist yet at the moment its colour has to be decided and
 * there is nothing to hand to `paintConeItems`. Rather than let each lane keep
 * its own copy of the ritual — which is exactly how they drifted apart — this
 * hands the appearance module the identity the item is ABOUT to have and takes
 * the answer it would give once the item exists.
 *
 * The consequence worth stating: the identity lookup's KEY and its fallback are
 * now the same beam id. They were not before — these lanes passed a BEAM id as
 * the key and a CELL-derived colour as the fallback — so on a snapshot miss the
 * pair rendered one lightness rung away from the steady serving lane for the
 * same beam.
 */
function pairSideColor(input: {
  readonly satId: string;
  readonly cellId: number;
  readonly beamId: number | null | undefined;
  /** Which table row applies. The pair lanes know their kind per lane. */
  readonly kind: 'intra' | 'inter' | null;
  readonly side: HandoverSide;
  readonly prominence: BeamProminence;
  /**
   * The `isServingOrCandidate` flag the identity lookup takes; on the homepage
   * it selects an EE shade. Passed explicitly rather than inferred from
   * PROMINENCE, so the prominence axis keeps meaning loudness and only loudness.
   */
  readonly isServingOrCandidate: boolean;
  readonly resolveIdentityColor?: ResolveSceneAcceptedBeamColor;
  readonly planColorFor?: (satId: string, beamId: number) => string | undefined;
}): string {
  return paintConeItem(
    {
      satId: input.satId,
      cellId: input.cellId,
      beamId: input.beamId ?? undefined,
      // Never read. `paintConeItem` decides the colour; this slot exists only
      // because a real render item carries one.
      color: '',
      role: handoverRoleForSide(input.side),
    },
    {
      resolveIdentityColor: input.resolveIdentityColor,
      planColorFor: input.planColorFor,
      laneKind: input.kind,
      prominence: input.prominence,
      isServingOrCandidate: input.isServingOrCandidate,
    },
  ).color;
}

export interface PulseConeInput {
  readonly policy: {
    readonly enabled: boolean;
    readonly hideTimelinePulse: boolean;
    readonly suppressNaturalHandoverLayers: boolean;
    readonly renderNaturalPulse: boolean;
    readonly homepageVisualIdentity: boolean;
    readonly concurrentIntraVisualSuppressed: boolean;
    readonly showOtherHandoverUes: boolean;
    readonly pulseFocusFollowsScope: boolean;
  };
  readonly frame: {
    readonly recentHandoverEvents: readonly SinrLiveCellHandoverEvent[] | undefined;
    readonly simTimeSec: number;
  };
  readonly geometry: {
    readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
    readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
    readonly frequencyReuse: number;
    readonly focusSatIds: ReadonlySet<string> | null;
    readonly protagonistUeId: string | null;
    readonly protagonistIntraBaseCenterOverride?: Vector3;
  };
  readonly output: {
    readonly resolveSceneAcceptedBeamColor: ResolveSceneAcceptedBeamColor;
    readonly restrictHomepageBeamItems: RestrictHomepageBeamItems;
  };
}

/** Resolve the ambient real-handover pulse as one independent output. */
export function resolvePulseConeItems(
  input: PulseConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { policy, frame, geometry, output } = input;
  if (
    policy.hideTimelinePulse
    || policy.suppressNaturalHandoverLayers
    || !policy.enabled
    || (policy.homepageVisualIdentity && !policy.renderNaturalPulse)
  ) return [];

  const events = frame.recentHandoverEvents ?? [];
  const selectedEvents = selectHandoverEventsForDisplay(
    events,
    geometry.protagonistUeId,
    policy.homepageVisualIdentity ? false : policy.showOtherHandoverUes,
  );
  const selectedEventSet = new Set(selectedEvents);
  const filteredEvents = events
    .filter(event => selectedEventSet.has(event))
    .filter(event => !policy.concurrentIntraVisualSuppressed || event.kind === 'inter')
    .filter(event => (
      geometry.focusSatIds === null
      || !policy.pulseFocusFollowsScope
      || geometry.focusSatIds.has(event.toSatId)
      || (event.fromSatId !== null && geometry.focusSatIds.has(event.fromSatId))
    ));
  const items = resolvePulseGeometry({
    recentHandoverEvents: filteredEvents,
    simTimeSec: frame.simTimeSec,
    retentionSec: SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
    placementByCellId: geometry.placementByCellId,
    satelliteWorldById: geometry.satelliteWorldById,
    frequencyReuse: geometry.frequencyReuse,
    focusSatIds: policy.pulseFocusFollowsScope ? geometry.focusSatIds : null,
    protagonistUeId: geometry.protagonistUeId,
    protagonistIntraBaseCenterOverride: policy.homepageVisualIdentity
      ? geometry.protagonistIntraBaseCenterOverride
      : undefined,
  });
  // These items exist, so they are painted directly: identity from the lookup,
  // shade from the (kind, side) table, side from the item's own role.
  return output.restrictHomepageBeamItems(items.map(item => paintConeItem(item, {
    resolveIdentityColor: output.resolveSceneAcceptedBeamColor,
    // See `pairSideColor`: prominence carries the `isServingOrCandidate` flag,
    // which this lane passed as `true` for intra and left unset for inter.
    prominence: 'serving',
    isServingOrCandidate: item.kind === 'intra',
  })));
}

export interface TriggeredIntraConeInput {
  readonly policy: {
    readonly enabled: boolean;
    readonly renderTriggeredIntra: boolean;
    readonly homepageVisualIdentity: boolean;
    readonly presentedCinemaHandoverActive: boolean;
    readonly handoverActive: boolean;
    readonly handoverEventSource: 'walker' | 'tle' | 'manual' | 'cinema' | null;
    readonly handoverEventKind: 'intra' | 'inter' | null;
  };
  readonly candidate: SinrLiveCinemaHandoverCandidate | null;
  readonly fallbackUeId: string | undefined;
  readonly envelope: {
    readonly fromOpacity: number;
    readonly phase: HandoverConeEnvelope['phase'];
    readonly toOpacity: number;
  };
  readonly triggeredIntraPeakOpacity: number;
  readonly geometry: {
    readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
    readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
    readonly frequencyReuse: number;
    readonly manualBaseCenterOverride: Vector3;
  };
  readonly output: {
    readonly resolveSceneAcceptedBeamColor: ResolveSceneAcceptedBeamColor;
    readonly restrictHomepageBeamItems: RestrictHomepageBeamItems;
  };
}

/** Resolve the explicitly triggered manual intra-handover output. */
export function resolveTriggeredIntraConeItems(
  input: TriggeredIntraConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { policy, candidate, envelope, geometry, output } = input;
  if (
    !policy.enabled
    || (policy.homepageVisualIdentity && !policy.renderTriggeredIntra)
    || !policy.handoverActive
    || policy.handoverEventSource !== 'manual'
    || policy.handoverEventKind !== 'intra'
    || policy.presentedCinemaHandoverActive
    || candidate === null
    || candidate.fromCellId === null
    || candidate.toCellId === null
  ) return [];

  const fromCellId = candidate.fromCellId;
  const toCellId = candidate.toCellId;
  const event: SinrLiveCellHandoverEvent = {
    ueId: candidate.ueId ?? input.fallbackUeId ?? 'ue-0',
    kind: candidate.kind,
    sourceTimeSec: candidate.sourceTimeSec,
    fromSatId: candidate.fromSatId,
    fromCellId,
    fromBeamId: candidate.fromBeamId ?? null,
    toSatId: candidate.toSatId,
    toCellId,
    toBeamId: candidate.toBeamId ?? null,
  };
  return output.restrictHomepageBeamItems(resolveTriggeredGeometry({
    event,
    fromOpacity: envelope.fromOpacity,
    toOpacity: envelope.phase === 'settled'
      ? input.triggeredIntraPeakOpacity
      : envelope.toOpacity,
    // `kind: 'intra'` is the LANE's kind, not the candidate's: this resolver is
    // gated to `handoverEventKind === 'intra'` above and shaded both sides
    // unconditionally, so the lane row is the faithful one.
    fromColor: pairSideColor({
      satId: candidate.fromSatId,
      cellId: fromCellId,
      beamId: event.fromBeamId,
      kind: 'intra',
      side: 'source',
      prominence: 'serving',
      isServingOrCandidate: false,
      resolveIdentityColor: output.resolveSceneAcceptedBeamColor,
    }),
    toColor: pairSideColor({
      satId: event.toSatId,
      cellId: toCellId,
      beamId: event.toBeamId,
      kind: 'intra',
      side: 'target',
      prominence: 'serving',
      isServingOrCandidate: false,
      resolveIdentityColor: output.resolveSceneAcceptedBeamColor,
    }),
    placementByCellId: geometry.placementByCellId,
    satelliteWorldById: geometry.satelliteWorldById,
    frequencyReuse: geometry.frequencyReuse,
    baseCenterOverride: geometry.manualBaseCenterOverride,
    fromBaseRadiusScale: 0.84,
    toBaseRadiusScale: 1,
  }));
}

export interface CinemaPairConeInput {
  readonly policy: {
    readonly enabled: boolean;
    readonly homepageVisualIdentity: boolean;
    readonly renderCinemaPair: boolean;
    readonly handoverActive: boolean;
    readonly presentedInterHandoverActive: boolean;
    readonly presentedCinemaHandoverActive: boolean;
    readonly handoverEventKind: 'intra' | 'inter' | null;
  };
  readonly candidate: SinrLiveCinemaHandoverCandidate | null;
  readonly envelope: {
    readonly fromOpacity: number;
    readonly phase: HandoverConeEnvelope['phase'];
    readonly toOpacity: number;
  };
  readonly triggeredIntraPeakOpacity: number;
  readonly geometry: {
    readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
    readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
    readonly frequencyReuse: number;
    readonly homepageIntraCellAnchor: Vector3;
    readonly manualHandoverGroundTarget: Vector3;
  };
  readonly output: {
    readonly resolveSceneAcceptedBeamColor: ResolveSceneAcceptedBeamColor;
    readonly restrictHomepageBeamItems: RestrictHomepageBeamItems;
  };
}

/** Resolve the focused cinema pair as its own output. */
export function resolveCinemaPairConeItems(
  input: CinemaPairConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { policy, candidate, envelope, geometry, output } = input;
  const presentationPairActive = policy.homepageVisualIdentity
    ? policy.handoverActive
    : policy.presentedInterHandoverActive
      || (policy.presentedCinemaHandoverActive && policy.handoverEventKind === 'intra');
  if (
    !policy.enabled
    || !presentationPairActive
    || candidate === null
    || (policy.homepageVisualIdentity && !policy.renderCinemaPair)
  ) return [];
  if (candidate.fromCellId === null || candidate.toCellId === null) return [];

  const fromCellId = candidate.fromCellId;
  const toCellId = candidate.toCellId;
  const intra = candidate.kind === 'intra';
  return output.restrictHomepageBeamItems(resolveCinemaPairGeometry({
    candidate,
    fromOpacity: envelope.fromOpacity,
    toOpacity: envelope.phase === 'settled'
      ? input.triggeredIntraPeakOpacity
      : envelope.toOpacity,
    // The `intra ? shade : plain` branch is gone: the table's `inter` rows are
    // the ones that say "no shade", so the kind alone decides.
    fromColor: pairSideColor({
      satId: candidate.fromSatId,
      cellId: fromCellId,
      beamId: candidate.fromBeamId,
      kind: candidate.kind,
      side: 'source',
      prominence: 'serving',
      isServingOrCandidate: false,
      resolveIdentityColor: output.resolveSceneAcceptedBeamColor,
    }),
    toColor: pairSideColor({
      satId: candidate.toSatId,
      cellId: toCellId,
      beamId: candidate.toBeamId,
      kind: candidate.kind,
      side: 'target',
      prominence: 'serving',
      isServingOrCandidate: false,
      resolveIdentityColor: output.resolveSceneAcceptedBeamColor,
    }),
    placementByCellId: geometry.placementByCellId,
    satelliteWorldById: geometry.satelliteWorldById,
    frequencyReuse: geometry.frequencyReuse,
    baseCenterOverride: intra
      ? geometry.homepageIntraCellAnchor
      : candidate.kind === 'inter'
        ? geometry.manualHandoverGroundTarget
        : undefined,
    fromBaseRadiusScale: intra || candidate.kind === 'inter' ? 0.86 : undefined,
    toBaseRadiusScale: intra || candidate.kind === 'inter' ? 1 : undefined,
  }));
}

export interface AuthorityPairConeInput {
  readonly policy: {
    readonly enabled: boolean;
    readonly centralOverlayActive: boolean;
    readonly identityTransitionActive: boolean;
    readonly handoverActive: boolean;
    readonly homepageVisualIdentity: boolean;
    readonly renderAuthorityPair: boolean;
    readonly authorityPresentationCommitObserved: boolean;
  };
  readonly candidate: SinrLiveCinemaHandoverCandidate | null;
  readonly envelope: {
    readonly fromOpacity: number;
    readonly phase: HandoverConeEnvelope['phase'];
    readonly toOpacity: number;
  };
  readonly beamColorBySatelliteBeam: ReadonlyMap<string, string>;
  readonly geometry: {
    readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
    readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
    readonly frequencyReuse: number;
    readonly homepageIntraCellAnchor: Vector3;
    readonly manualHandoverGroundTarget: Vector3;
  };
  readonly output: {
    readonly resolveSceneAcceptedBeamColor: ResolveSceneAcceptedBeamColor;
    readonly restrictHomepageBeamItems: RestrictHomepageBeamItems;
  };
}

/** Resolve the accepted comparison-plan pair as a separate output. */
export function resolveAuthorityPairConeItems(
  input: AuthorityPairConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { policy, candidate, envelope, geometry, output } = input;
  if (
    !(policy.centralOverlayActive || policy.identityTransitionActive)
    || !policy.enabled
    || !policy.handoverActive
    || candidate === null
    || (policy.homepageVisualIdentity && !policy.renderAuthorityPair)
    || candidate.fromCellId === null
    || candidate.toCellId === null
  ) return [];

  const fromCellId = candidate.fromCellId;
  const toCellId = candidate.toCellId;
  const fromBeamId = coneItemBeamId({ cellId: fromCellId, beamId: candidate.fromBeamId ?? undefined });
  const toBeamId = coneItemBeamId({ cellId: toCellId, beamId: candidate.toBeamId ?? undefined });
  // The accepted comparison plan's OWN published colour for this beam. It is a
  // legitimate identity source and outranks the scene lookup (ladder rung 0).
  const planColorFor = (satId: string, beamId: number): string | undefined => (
    input.policy.centralOverlayActive
      ? input.beamColorBySatelliteBeam.get(`${satId}/${beamId}`)
      : undefined
  );
  const intra = candidate.kind === 'intra';
  const pair = resolveCinemaPairGeometry({
    candidate,
    fromOpacity: envelope.fromOpacity * HANDOVER_TRANSITION_OPACITY_OVERLAY.source,
    toOpacity: envelope.toOpacity * HANDOVER_TRANSITION_OPACITY_OVERLAY.target,
    fromColor: pairSideColor({
      satId: candidate.fromSatId,
      cellId: fromCellId,
      beamId: candidate.fromBeamId,
      kind: candidate.kind,
      side: 'source',
      prominence: 'serving',
      isServingOrCandidate: intra,
      resolveIdentityColor: output.resolveSceneAcceptedBeamColor,
      planColorFor,
    }),
    toColor: pairSideColor({
      satId: candidate.toSatId,
      cellId: toCellId,
      beamId: candidate.toBeamId,
      kind: candidate.kind,
      side: 'target',
      prominence: 'serving',
      isServingOrCandidate: intra,
      resolveIdentityColor: output.resolveSceneAcceptedBeamColor,
      planColorFor,
    }),
    placementByCellId: geometry.placementByCellId,
    satelliteWorldById: geometry.satelliteWorldById,
    frequencyReuse: geometry.frequencyReuse,
    baseCenterOverride: intra ? geometry.homepageIntraCellAnchor : geometry.manualHandoverGroundTarget,
    fromBaseRadiusScale: 0.86,
    toBaseRadiusScale: 1,
  });
  if (
    candidate.kind !== 'inter'
    || !policy.authorityPresentationCommitObserved
    || envelope.phase !== 'settled'
  ) return output.restrictHomepageBeamItems(pair);

  const visibleSatelliteId = candidate.toSatId;
  const visibleCellId = candidate.toCellId;
  return output.restrictHomepageBeamItems(pair.filter(item => (
    item.satId === visibleSatelliteId && item.cellId === visibleCellId
  )));
}
