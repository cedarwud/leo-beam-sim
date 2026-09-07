import type { Vector3 } from 'three';
import {
  MULTI_CANDIDATE_TRANSITION_SOURCE_OPACITY_FACTOR,
  MULTI_CANDIDATE_TRANSITION_TARGET_OPACITY_FACTOR,
  resolveServingIdentityColor,
} from './beamConeIdentityColors';
import { emphasizeIntraHandoverColor } from '../constants/servingColour';
import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';
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
  cellLinkBudgetBeamId,
  type SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';
import { selectHandoverEventsForDisplay } from './handoverDisplayIsolation';
import { type HandoverConeEnvelope } from '../constants/sinrLiveConeStyle';
import { type WorldPoint } from '../viz/CellFootprints';

type ResolveSceneAcceptedBeamColor = (
  satelliteId: string,
  beamId: number,
  fallback: string,
  isServingOrCandidate?: boolean,
) => string;

type RestrictHomepageBeamItems = (
  items: readonly SinrLiveCellBeamConeRenderItem[],
) => readonly SinrLiveCellBeamConeRenderItem[];

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
  return output.restrictHomepageBeamItems(items.map(item => ({
    ...item,
    color: item.kind === 'intra'
      ? emphasizeIntraHandoverColor(
        output.resolveSceneAcceptedBeamColor(
          item.satId,
          item.beamId ?? cellLinkBudgetBeamId(item.cellId),
          item.color,
          true,
        ),
        item.role === 'handoverSource' ? 'source' : 'target',
      )
      : output.resolveSceneAcceptedBeamColor(
        item.satId,
        item.beamId ?? cellLinkBudgetBeamId(item.cellId),
        item.color,
      ),
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
  const fromBeamId = event.fromBeamId ?? cellLinkBudgetBeamId(fromCellId);
  const toBeamId = event.toBeamId ?? cellLinkBudgetBeamId(toCellId);
  return output.restrictHomepageBeamItems(resolveTriggeredGeometry({
    event,
    fromOpacity: envelope.fromOpacity,
    toOpacity: envelope.phase === 'settled'
      ? input.triggeredIntraPeakOpacity
      : envelope.toOpacity,
    fromColor: emphasizeIntraHandoverColor(
      output.resolveSceneAcceptedBeamColor(
        candidate.fromSatId,
        fromBeamId,
        resolveServingIdentityColor(
          candidate.fromSatId,
          fromCellId,
          HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
        ),
      ),
      'source',
    ),
    toColor: emphasizeIntraHandoverColor(
      output.resolveSceneAcceptedBeamColor(
        event.toSatId,
        toBeamId,
        resolveServingIdentityColor(
          event.toSatId,
          toCellId,
          HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
        ),
      ),
      'target',
    ),
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
  const fromBeamId = candidate.fromBeamId ?? cellLinkBudgetBeamId(fromCellId);
  const toBeamId = candidate.toBeamId ?? cellLinkBudgetBeamId(toCellId);
  const fromFallback = resolveServingIdentityColor(
    candidate.fromSatId,
    fromCellId,
    HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
  );
  const toFallback = resolveServingIdentityColor(
    candidate.toSatId,
    toCellId,
    HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
  );
  const intra = candidate.kind === 'intra';
  return output.restrictHomepageBeamItems(resolveCinemaPairGeometry({
    candidate,
    fromOpacity: envelope.fromOpacity,
    toOpacity: envelope.phase === 'settled'
      ? input.triggeredIntraPeakOpacity
      : envelope.toOpacity,
    fromColor: intra
      ? emphasizeIntraHandoverColor(
        output.resolveSceneAcceptedBeamColor(candidate.fromSatId, fromBeamId, fromFallback),
        'source',
      )
      : output.resolveSceneAcceptedBeamColor(candidate.fromSatId, fromBeamId, fromFallback),
    toColor: intra
      ? emphasizeIntraHandoverColor(
        output.resolveSceneAcceptedBeamColor(candidate.toSatId, toBeamId, toFallback),
        'target',
      )
      : output.resolveSceneAcceptedBeamColor(candidate.toSatId, toBeamId, toFallback),
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
  const fromBeamId = candidate.fromBeamId ?? cellLinkBudgetBeamId(fromCellId);
  const toBeamId = candidate.toBeamId ?? cellLinkBudgetBeamId(toCellId);
  const fromFallback = resolveServingIdentityColor(
    candidate.fromSatId,
    fromCellId,
    HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
  );
  const toFallback = resolveServingIdentityColor(
    candidate.toSatId,
    toCellId,
    HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
  );
  const fromColor = input.policy.centralOverlayActive
    ? input.beamColorBySatelliteBeam.get(`${candidate.fromSatId}/${fromBeamId}`)
    : undefined;
  const toColor = input.policy.centralOverlayActive
    ? input.beamColorBySatelliteBeam.get(`${candidate.toSatId}/${toBeamId}`)
    : undefined;
  const fromResolvedColor = fromColor ?? output.resolveSceneAcceptedBeamColor(
    candidate.fromSatId,
    fromBeamId,
    fromFallback,
    candidate.kind === 'intra',
  );
  const toResolvedColor = toColor ?? output.resolveSceneAcceptedBeamColor(
    candidate.toSatId,
    toBeamId,
    toFallback,
    candidate.kind === 'intra',
  );
  const intra = candidate.kind === 'intra';
  const pair = resolveCinemaPairGeometry({
    candidate,
    fromOpacity: envelope.fromOpacity * MULTI_CANDIDATE_TRANSITION_SOURCE_OPACITY_FACTOR,
    toOpacity: envelope.toOpacity * MULTI_CANDIDATE_TRANSITION_TARGET_OPACITY_FACTOR,
    fromColor: intra ? emphasizeIntraHandoverColor(fromResolvedColor, 'source') : fromResolvedColor,
    toColor: intra ? emphasizeIntraHandoverColor(toResolvedColor, 'target') : toResolvedColor,
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
