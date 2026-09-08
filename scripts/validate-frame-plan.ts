/**
 * Deterministic, headless render-plan verification for the live cell scene.
 *
 * This deliberately stops at the same pure seams MainScene uses:
 *   model.step -> cone resolvers -> appearance -> render-item snapshot
 * There is no React tree, browser clock, RAF, WebGL context, or random source.
 *
 * Usage:
 *   npm run validate:frame-plan -- --update
 *   npm run validate:frame-plan
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Vector3 } from 'three';

import { resolveBaseIdentityColor } from '../src/appearance/resolveBeamAppearance.ts';
import { formatHomepageBeamCellLabel } from '../src/appearance/candidateRailPresentation.ts';
import {
  HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
  HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
  HANDOVER_CONE_PHASE_END,
  INTER_HANDOVER_CINEMA_PHASE_END,
  INTRA_HANDOVER_CINEMA_DISPLAY_MS,
  INTER_HANDOVER_CINEMA_DISPLAY_MS,
  MANUAL_HANDOVER_DISPLAY_MS,
  resolveHandoverConeEnvelope,
  resolveHandoverPresentationPhase,
  resolveInterHandoverCinemaEnvelope,
} from '../src/appearance/handoverTimingEnvelope.ts';
import {
  resolveNonServingConeFocusSatIds,
  resolveServingConeBudgetFan,
  resolveServingConeFocusSatIds,
  resolveHomepageBeamVisibility,
} from '../src/appearance/beamVisibilityContract.ts';
import { restrictHomepageBeamItems as restrictHomepageBeamItemsByContract } from '../src/appearance/beamVisibilityContract.ts';
import { DEFAULT_BEAM_DISPLAY_SPEC } from '../src/scene/beamDisplaySpec.ts';
import {
  resolveCandidateConeItems,
  selectCandidateConeGeometry,
} from '../src/scene/candidateConeItems.ts';
import {
  resolveAuthorityPairConeItems,
  resolveCinemaPairConeItems,
  resolvePulseConeItems,
  resolveTriggeredIntraConeItems,
} from '../src/scene/handoverConeResolvers.ts';
import { resolveSinrLiveCellPlacementById } from '../src/scene/sinrLiveCellPlacement.ts';
import {
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
} from '../src/scene/sinrLiveCellRuntime.ts';
import type {
  CellModelSat,
  SinrLiveCellFrame,
  UeInput,
} from '../src/scene/sinrLiveCellModel.ts';
import {
  SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
  SinrLiveCellModel,
  resolveIntraCellBeamCenter,
  type SinrLiveCellHandoverEvent,
} from '../src/scene/sinrLiveCellModel.ts';
import { resolveServingConeItems } from '../src/scene/servingConeItems.ts';
import { paintConeItems } from '../src/appearance/paintConeItems.ts';
import {
  resolveRenderedLiveSatelliteMarkers,
  type RenderedLiveSatelliteMarker,
} from '../src/scene/renderedLiveSatelliteMarkers.ts';
import { resolveHomepageSceneBeamVisibility } from '../src/scene/homepageSceneBeamVisibility.ts';
import {
  buildHomepageAcceptedSnapshot,
  createHandoverPresentationPolicyConfigHash,
} from '../src/homepage/controller/acceptedSnapshot.ts';
import { projectHomepageRail } from '../src/homepage/controller/railProjection.ts';
import { resolveManualHandoverDisplayMs } from '../src/scene/handoverPresentationDisplayPolicy.ts';
import {
  groundRippleSpec,
  resolveGroundRippleEnvelope,
} from '../src/viz/ServingGroundRipple.tsx';
import {
  resolveIntraGroundShockwaveColors,
  sourceOpacityFor,
  sourceScaleFor,
  targetOpacityFor,
  targetScaleFor,
} from '../src/viz/IntraGroundShockwave.tsx';
import {
  resolveSinrLiveConeDisplayStyle,
  resolveSinrLiveConeRole,
  resolveSinrLiveNonServingConeItems,
  sinrLiveHandoverPulseOpacity,
  shouldDimSinrLiveConeRole,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveConeMountLayer,
  type SinrLiveCellPlacement,
} from '../src/viz/SinrLiveCellBeamCones.tsx';
import {
  resolveSinrLiveConeElevationDimFactor,
  type SinrLiveConePalette,
} from '../src/constants/sinrLiveConeStyle.ts';
import { cellLinkBudgetBeamId } from '../src/scene/sinrLiveCellModel.ts';
import type { WorldPoint } from '../src/viz/CellFootprints.tsx';
import { loadProfile } from '../src/profiles/index.ts';

const GATE = 'validate:frame-plan';
const FIXTURE_PATH = path.join('fixtures', 'frame-plan.json');
const EPOCH_UTC_MS = 1_767_225_600_000; // 2026-01-01T00:00:00.000Z
const STEP_SEC = 1;
const STEP_COUNT = 89; // fixed t=0..88 s; t=88 contains the real handover pulse
const WORLD_UNITS_PER_KM = 0.25;
const PROFILE_ID = 'hobs-2024-candidate-rich';

type SatelliteFixture = Readonly<{
  id: string;
  shellId: string;
  altitudeKm: number;
  latDeg: number;
  lonOffsetDegBeforeSwitch: number;
  lonOffsetDegAfterSwitch: number;
  switchAtSec: number;
  world: WorldPoint;
}>;

const SATELLITES: readonly SatelliteFixture[] = Object.freeze([
  {
    id: 'SAT-A',
    shellId: 'frame-plan-shell',
    altitudeKm: 550,
    latDeg: 40,
    lonOffsetDegBeforeSwitch: 0,
    lonOffsetDegAfterSwitch: 5.5,
    switchAtSec: 84,
    world: { x: -45, y: 140, z: 20 },
  },
  {
    id: 'SAT-B',
    shellId: 'frame-plan-shell',
    altitudeKm: 550,
    latDeg: 40,
    lonOffsetDegBeforeSwitch: 1.8,
    lonOffsetDegAfterSwitch: 0,
    switchAtSec: 84,
    world: { x: 0, y: 140, z: 0 },
  },
  {
    id: 'SAT-C',
    shellId: 'frame-plan-shell',
    altitudeKm: 550,
    latDeg: 40,
    lonOffsetDegBeforeSwitch: -1.5,
    lonOffsetDegAfterSwitch: -1.5,
    switchAtSec: 1_000_000_000,
    world: { x: 45, y: 140, z: -20 },
  },
]);

const UES: readonly UeInput[] = Object.freeze([
  { id: 'ue-primary', eastKm: 8, northKm: 2 },
]);

const INTRA_SATELLITE: SatelliteFixture = Object.freeze({
  id: 'SAT-INTRA',
  shellId: 'frame-plan-intra-shell',
  altitudeKm: 550,
  latDeg: 40,
  lonOffsetDegBeforeSwitch: 0,
  lonOffsetDegAfterSwitch: 0,
  switchAtSec: 1_000_000_000,
  world: { x: 0, y: 140, z: 0 },
});

interface SnapshotItem {
  readonly layer: SinrLiveConeMountLayer;
  readonly color: string;
  readonly opacity: number;
  readonly role: string;
  readonly satId: string;
  readonly cellId: number;
  readonly beamId: number;
  readonly frequencyIndex: number;
  readonly serving: boolean;
  readonly displayOnly: boolean;
  readonly renderKey: string | null;
  readonly geometry: {
    readonly apex: WorldPoint;
    readonly baseCenter: WorldPoint;
    readonly baseRadiusWorld: number;
  };
}

interface HandoverEventSummary {
  readonly kind: 'intra' | 'inter';
  readonly ueId: string;
  readonly sourceTimeSec: number;
  readonly fromSatId: string | null;
  readonly fromCellId: number | null;
  readonly fromBeamId: number | null;
  readonly toSatId: string;
  readonly toCellId: number;
  readonly toBeamId: number | null;
}

interface TimingSnapshot {
  readonly progress01: number;
  readonly phase: string;
  readonly envelope: {
    readonly fromOpacity: number;
    readonly toOpacity: number;
    readonly phase: string;
  };
  readonly pulseOpacity: number;
  readonly triggeredProgress01: number;
  readonly triggeredIntraSustainMs: number;
  readonly homepageDisplayMs: {
    readonly intra: number;
    readonly inter: number;
  };
  readonly cinemaDisplayMs: {
    readonly intra: number;
    readonly inter: number;
  };
  readonly manualDisplayMs: number;
  readonly phaseBoundaries: {
    readonly intra: typeof HANDOVER_CONE_PHASE_END;
    readonly inter: typeof INTER_HANDOVER_CINEMA_PHASE_END;
  };
}

interface MarkerSnapshot {
  readonly id: string;
  readonly world: WorldPoint;
  readonly satelliteTintColor?: string;
}

interface RailLinkSnapshot {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly cellLabel: string;
  readonly role: string;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
  readonly joinKey: string;
}

interface RailSnapshot {
  readonly snapshotId: string;
  readonly sourceFrameId: string;
  readonly candidateRosterRetained: boolean;
  readonly candidateRosterSourceFrameId: string;
  readonly candidates: readonly RailLinkSnapshot[];
  readonly visibleCandidates: readonly RailLinkSnapshot[];
  readonly overflowKeys: readonly { readonly satelliteId: string; readonly beamId: number }[];
  readonly counts: {
    readonly observed: number;
    readonly hardEligible: number;
    readonly triggerSatisfied: number;
    readonly tttStable: number;
    readonly displayed: number;
    readonly overflow: number;
  };
  readonly activeDataLinkCount: 0 | 1;
  readonly handoverStory: unknown;
}

interface GroundEffectsSnapshot {
  readonly servingRipple: {
    readonly spec: ReturnType<typeof groundRippleSpec>;
    readonly envelope: ReturnType<typeof resolveGroundRippleEnvelope>;
  };
  readonly pendingRipple: {
    readonly spec: ReturnType<typeof groundRippleSpec>;
    readonly envelope: ReturnType<typeof resolveGroundRippleEnvelope>;
  };
  readonly intraShockwave: {
    readonly progress01: number;
    readonly sourceOpacity: number;
    readonly targetOpacity: number;
    readonly sourceScale: number;
    readonly targetScale: number;
    readonly sourceColor: string;
    readonly targetColor: string;
  };
}

interface FramePlanScenario {
  readonly id: string;
  readonly inputs: {
    readonly targetSimTimeSec: number;
    readonly stepSec: number;
    readonly stepCount: number;
    readonly profileId: string;
    readonly maxGainDbiOverrideDbi?: number;
    readonly eeThresholdKbitPerJoule?: number;
    readonly ueIds: readonly string[];
    readonly satellites: readonly SatelliteFixture[];
  };
  readonly truth: {
    readonly simTimeSec: number;
    readonly primaryUeId: string | null;
    readonly primaryServing: {
      readonly satId: string | null;
      readonly cellId: number | null;
      readonly beamId: number | null;
    };
    readonly handoverEvents: readonly HandoverEventSummary[];
    readonly selectedKind: string | null;
    readonly committedKind: string | null;
  };
  readonly items: readonly SnapshotItem[];
  readonly visibility: {
    readonly allowedBeamIdentities: readonly string[];
    readonly probeAllowedBeamIdentities: readonly string[];
    readonly sceneAllowedBeamIdentities: readonly string[];
    readonly renderedBeamIdentities: readonly string[];
  };
  readonly markers: readonly MarkerSnapshot[];
  readonly timing: TimingSnapshot;
  readonly groundEffects: GroundEffectsSnapshot;
  readonly rail: RailSnapshot;
}

interface FramePlanSnapshot {
  readonly protocol: 'deterministic-frame-plan-v1';
  readonly inputs: {
    readonly epochUtcMs: number;
    readonly profileId: string;
    readonly stepSec: number;
    readonly stepCount: number;
    readonly targetSimTimeSec: number;
    readonly worldUnitsPerKm: number;
    readonly ueIds: readonly string[];
    readonly satellites: readonly SatelliteFixture[];
  };
  readonly truth: {
    readonly simTimeSec: number;
    readonly primaryUeId: string | null;
    readonly primaryServing: {
      readonly satId: string | null;
      readonly cellId: number | null;
      readonly beamId: number | null;
    };
    readonly recentHandoverEvents: number;
    readonly handoverEvents: readonly HandoverEventSummary[];
  };
  readonly timing: TimingSnapshot;
  readonly items: readonly SnapshotItem[];
  readonly scenarios: readonly FramePlanScenario[];
}

function satelliteAt(profile: ReturnType<typeof loadProfile>, fixture: SatelliteFixture, simTimeSec: number): CellModelSat {
  const lonOffsetDeg = simTimeSec >= fixture.switchAtSec
    ? fixture.lonOffsetDegAfterSwitch
    : fixture.lonOffsetDegBeforeSwitch;
  return {
    id: fixture.id,
    shellId: fixture.shellId,
    altitudeKm: fixture.altitudeKm,
    latDeg: fixture.latDeg,
    lonDeg: profile.orbit.observerLonDeg + lonOffsetDeg,
    topo: {
      azimuthDeg: lonOffsetDeg < 0 ? 270 : lonOffsetDeg > 0 ? 90 : 0,
      elevationDeg: 80,
    },
  };
}

function toWorldPoint(point: { readonly x: number; readonly y: number; readonly z: number }): WorldPoint {
  return { x: point.x, y: point.y, z: point.z };
}

function paletteFromDefaultSpec(): SinrLiveConePalette {
  return {
    heroColor: DEFAULT_BEAM_DISPLAY_SPEC.heroConeColor,
    servingFanColor: DEFAULT_BEAM_DISPLAY_SPEC.servingFanConeColor,
    backgroundColor: DEFAULT_BEAM_DISPLAY_SPEC.backgroundConeColor,
    candidateColor: DEFAULT_BEAM_DISPLAY_SPEC.candidateConeColor,
    candidateFanColor: DEFAULT_BEAM_DISPLAY_SPEC.candidateFanConeColor,
    pulseIntraColor: DEFAULT_BEAM_DISPLAY_SPEC.pulseIntraColor,
    pulseInterColor: DEFAULT_BEAM_DISPLAY_SPEC.pulseInterColor,
    heroOpacity: DEFAULT_BEAM_DISPLAY_SPEC.heroConeOpacity,
    servingConeOpacity: DEFAULT_BEAM_DISPLAY_SPEC.servingConeOpacity,
    backgroundOpacity: DEFAULT_BEAM_DISPLAY_SPEC.backgroundConeOpacity,
    candidateOpacity: DEFAULT_BEAM_DISPLAY_SPEC.candidateConeOpacity,
    candidateFanOpacity: DEFAULT_BEAM_DISPLAY_SPEC.candidateFanConeOpacity,
    nonServingOpacity: DEFAULT_BEAM_DISPLAY_SPEC.nonServingConeOpacity,
  };
}

function identityColor(satId: string, beamId: number, isServingOrCandidate = false): string {
  return resolveBaseIdentityColor(satId, beamId, {}, { isServingOrCandidate });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareItems(left: SnapshotItem, right: SnapshotItem): number {
  const layerOrder: Record<SinrLiveConeMountLayer, number> = {
    nonServing: 0,
    serving: 1,
    candidate: 2,
    pulse: 3,
    triggered: 4,
  };
  return layerOrder[left.layer] - layerOrder[right.layer]
    || compareText(left.satId, right.satId)
    || left.cellId - right.cellId
    || left.beamId - right.beamId
    || compareText(left.role, right.role)
    || compareText(left.renderKey ?? '', right.renderKey ?? '');
}

function finalSnapshotItem(
  layer: SinrLiveConeMountLayer,
  item: SinrLiveCellBeamConeRenderItem,
  placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>,
  palette: SinrLiveConePalette,
  hero: { readonly satId: string | null; readonly cellId: number | null; readonly beamId: number | null },
): SnapshotItem {
  const beamId = item.beamId ?? cellLinkBudgetBeamId(item.cellId);
  const role = resolveSinrLiveConeRole({
    layer,
    satId: item.satId,
    cellId: item.cellId,
    itemRole: item.role,
    heroSatId: hero.satId,
    heroCellId: hero.cellId,
    heroBeamId: hero.beamId,
    beamId,
  });
  const style = resolveSinrLiveConeDisplayStyle(role, palette, item, 'item-identity');
  const placement = placementByCellId.get(item.cellId);
  if (placement === undefined) throw new Error(`missing placement for rendered cell ${item.cellId}`);
  const apparentElevationDeg = (Math.atan2(
    item.apex.y - item.baseCenter.y,
    Math.hypot(item.apex.x - item.baseCenter.x, item.apex.z - item.baseCenter.z),
  ) * 180) / Math.PI;
  const opacity = style.opacity * (
    shouldDimSinrLiveConeRole(
      role,
      layer === 'serving' || layer === 'candidate' ? DEFAULT_BEAM_DISPLAY_SPEC.elevationDimEnabled : false,
      DEFAULT_BEAM_DISPLAY_SPEC.heroExemptFromElevationDim,
    )
      ? resolveSinrLiveConeElevationDimFactor(
        apparentElevationDeg,
        DEFAULT_BEAM_DISPLAY_SPEC.elevationDimFloorDeg,
        DEFAULT_BEAM_DISPLAY_SPEC.elevationDimCeilDeg,
        DEFAULT_BEAM_DISPLAY_SPEC.elevationDimMinFactor,
      )
      : 1
  );
  return {
    layer,
    color: style.color,
    opacity,
    role,
    satId: item.satId,
    cellId: item.cellId,
    beamId,
    frequencyIndex: item.frequencyIndex,
    serving: item.serving,
    displayOnly: item.displayOnly === true,
    renderKey: item.renderKey ?? null,
    geometry: {
      apex: toWorldPoint(item.apex),
      baseCenter: toWorldPoint(item.baseCenter),
      baseRadiusWorld: placement.radiusWorld * DEFAULT_BEAM_DISPLAY_SPEC.coneWidthScale,
    },
  };
}

function summarizeEvent(event: SinrLiveCellHandoverEvent): HandoverEventSummary {
  return {
    kind: event.kind,
    ueId: event.ueId,
    sourceTimeSec: event.sourceTimeSec,
    fromSatId: event.fromSatId,
    fromCellId: event.fromCellId,
    fromBeamId: event.fromBeamId ?? null,
    toSatId: event.toSatId,
    toCellId: event.toCellId,
    toBeamId: event.toBeamId ?? null,
  };
}

function candidateFromEvent(event: SinrLiveCellHandoverEvent) {
  if (event.fromSatId === null || event.fromCellId === null || event.fromBeamId === null) {
    throw new Error('the real handover event did not publish a drawable source endpoint');
  }
  if (event.toBeamId === null) {
    throw new Error('the real handover event did not publish a drawable target beam');
  }
  return {
    eventId: `${event.ueId}-${event.sourceTimeSec}-${event.fromSatId}-${event.fromBeamId}-${event.toSatId}-${event.toBeamId}`,
    ueId: event.ueId,
    kind: event.kind,
    sourceTimeSec: event.sourceTimeSec,
    fromSatId: event.fromSatId,
    fromBeamId: event.fromBeamId,
    fromCellId: event.fromCellId,
    toSatId: event.toSatId,
    toBeamId: event.toBeamId,
    toCellId: event.toCellId,
  };
}

function buildTimingSnapshot(
  kind: 'intra' | 'inter',
  progress01: number,
  pulseAgeSec: number,
  triggeredAgeMs: number,
): TimingSnapshot {
  const envelope = kind === 'inter'
    ? resolveInterHandoverCinemaEnvelope(progress01, DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity)
    : resolveHandoverConeEnvelope(progress01, DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity);
  const triggeredIntraSustainMs = DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraSustainMs;
  const triggeredProgress01 = Math.min(
    1,
    Math.max(0, triggeredAgeMs / Math.max(1, triggeredIntraSustainMs)),
  );
  return {
    progress01,
    phase: resolveHandoverPresentationPhase(kind, progress01),
    envelope,
    pulseOpacity: sinrLiveHandoverPulseOpacity(
      pulseAgeSec,
      SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
    ),
    triggeredProgress01,
    triggeredIntraSustainMs,
    homepageDisplayMs: {
      intra: resolveManualHandoverDisplayMs({
        homepageVisualIdentity: true,
        kind: 'intra',
        homepageIntraMs: HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
        homepageInterMs: HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
        defaultMs: MANUAL_HANDOVER_DISPLAY_MS,
      }),
      inter: resolveManualHandoverDisplayMs({
        homepageVisualIdentity: true,
        kind: 'inter',
        homepageIntraMs: HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
        homepageInterMs: HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
        defaultMs: MANUAL_HANDOVER_DISPLAY_MS,
      }),
    },
    cinemaDisplayMs: {
      intra: INTRA_HANDOVER_CINEMA_DISPLAY_MS,
      inter: INTER_HANDOVER_CINEMA_DISPLAY_MS,
    },
    manualDisplayMs: resolveManualHandoverDisplayMs({
      homepageVisualIdentity: false,
      kind,
      homepageIntraMs: HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
      homepageInterMs: HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
      defaultMs: MANUAL_HANDOVER_DISPLAY_MS,
    }),
    phaseBoundaries: {
      intra: HANDOVER_CONE_PHASE_END,
      inter: INTER_HANDOVER_CINEMA_PHASE_END,
    },
  };
}

function summarizeMarkers(markers: readonly RenderedLiveSatelliteMarker[]): readonly MarkerSnapshot[] {
  return markers.map(marker => ({
    id: marker.id,
    world: {
      x: marker.world.x,
      y: marker.world.y,
      z: marker.world.z,
    },
    ...(marker.satelliteTintColor === undefined ? {} : { satelliteTintColor: marker.satelliteTintColor }),
  }));
}

function buildMarkerSnapshots(
  satellites: readonly SatelliteFixture[],
  event: SinrLiveCellHandoverEvent,
): readonly MarkerSnapshot[] {
  const displaySats = satellites.map(fixture => ({
    id: fixture.id,
    world: new Vector3(fixture.world.x, fixture.world.y, fixture.world.z),
  }));
  const identityColorBySatelliteId = new Map(
    satellites.map(fixture => [fixture.id, identityColor(fixture.id, cellLinkBudgetBeamId(0), true)] as const),
  );
  const coneApexWorldById = new Map(
    satellites.map(fixture => [fixture.id, fixture.world] as const),
  );
  return summarizeMarkers(resolveRenderedLiveSatelliteMarkers({
    displaySats,
    handoverMarkerSatelliteIds: new Set([
      ...(event.fromSatId === null ? [] : [event.fromSatId]),
      event.toSatId,
    ]),
    identityColorBySatelliteId,
    coneApexWorldById,
  }));
}

function buildGroundEffectsSnapshot(
  event: SinrLiveCellHandoverEvent,
  placement: SinrLiveCellPlacement,
): GroundEffectsSnapshot {
  if (
    event.fromBeamId === null
    || event.fromBeamId === undefined
    || event.toBeamId === null
    || event.toBeamId === undefined
    || event.fromSatId === null
  ) {
    throw new Error('the real intra event did not provide complete ground-effect endpoints');
  }
  const fromBeamId = event.fromBeamId;
  const toBeamId = event.toBeamId;
  const servingSpec = groundRippleSpec('serving');
  const pendingSpec = groundRippleSpec('pending');
  const rippleTarget = (spec: ReturnType<typeof groundRippleSpec>) => ({
    ...spec,
    id: `${spec.role}-${event.ueId}`,
    satelliteId: event.toSatId,
    beamId: toBeamId,
    groundX: placement.worldX,
    groundZ: placement.worldZ,
    footprintRadius: placement.radiusWorld,
  });
  const identityColorBySatelliteBeamId = new Map([
    [`${event.toSatId}/${fromBeamId}`, identityColor(event.toSatId, fromBeamId, true)],
    [`${event.toSatId}/${toBeamId}`, identityColor(event.toSatId, toBeamId, true)],
  ]);
  const shockwaveColors = resolveIntraGroundShockwaveColors({
    event: {
      satId: event.toSatId,
      fromBeamId,
      toBeamId,
    },
    identityColorBySatelliteBeamId,
  });
  const progress01 = 0.5;
  return {
    servingRipple: {
      spec: servingSpec,
      envelope: resolveGroundRippleEnvelope(rippleTarget(servingSpec), 0.75, 0.1),
    },
    pendingRipple: {
      spec: pendingSpec,
      envelope: resolveGroundRippleEnvelope(rippleTarget(pendingSpec), 0.75, 0.1),
    },
    intraShockwave: {
      progress01,
      sourceOpacity: sourceOpacityFor(progress01),
      targetOpacity: targetOpacityFor(progress01),
      sourceScale: sourceScaleFor(progress01),
      targetScale: targetScaleFor(progress01),
      sourceColor: shockwaveColors.sourceColor,
      targetColor: shockwaveColors.targetColor,
    },
  };
}

function summarizeRailLinks(
  links: readonly {
    readonly key: { readonly satelliteId: string; readonly beamId: number };
    readonly role: string;
    readonly isServing: boolean;
    readonly isCandidate: boolean;
    readonly joinKey: string;
  }[],
): readonly RailLinkSnapshot[] {
  return links.map(link => ({
    satelliteId: link.key.satelliteId,
    beamId: link.key.beamId,
    cellLabel: formatHomepageBeamCellLabel(link.key.beamId),
    role: link.role,
    isServing: link.isServing,
    isCandidate: link.isCandidate,
    joinKey: link.joinKey,
  }));
}

function summarizeRail(rail: ReturnType<typeof projectHomepageRail>): RailSnapshot {
  return {
    snapshotId: rail.snapshotId,
    sourceFrameId: rail.sourceFrameId,
    candidateRosterRetained: rail.candidateRosterRetained === true,
    candidateRosterSourceFrameId: rail.candidateRosterSourceFrameId ?? '',
    candidates: summarizeRailLinks(rail.candidates),
    visibleCandidates: summarizeRailLinks(rail.visibleCandidates ?? rail.candidates),
    overflowKeys: rail.overflowKeys.map(key => ({
      satelliteId: key.satelliteId,
      beamId: key.beamId,
    })),
    counts: rail.counts,
    activeDataLinkCount: rail.activeDataLinkCount,
    handoverStory: rail.handoverStory ?? null,
  };
}

function buildIntraScenario(profile: ReturnType<typeof loadProfile>): FramePlanScenario {
  const intraStepSec = 0.25;
  const intraStepCount = 8; // t=0..1.75; the final step commits the real intra event
  const layout = buildSinrLiveCellLayout(profile, 7);
  const observer = {
    latDeg: profile.orbit.observerLatDeg,
    lonDeg: profile.orbit.observerLonDeg,
  };
  const selectedCell = layout.centers[0];
  if (selectedCell === undefined) throw new Error('intra scenario did not build cell 0');
  const variantCenter = resolveIntraCellBeamCenter(
    selectedCell,
    layout.cellRadiusKm,
    observer,
  );
  const intraUe: UeInput = {
    id: 'ue-intra',
    eastKm: variantCenter.localXKm,
    northKm: variantCenter.localYKm,
  };
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: layout,
    observer,
    epochUtcMs: EPOCH_UTC_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    eeThresholdKbitPerJoule: 220,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    // The default profile keeps this source above the homepage EE floor. This
    // is still the live model and its supported antenna override; the override
    // makes the real same-satellite candidate cross the real decision trigger.
    maxGainDbiOverrideDbi: 30,
  });

  let frame: SinrLiveCellFrame | undefined;
  let preCommitFrame: SinrLiveCellFrame | undefined;
  let preCommitDecision: ReturnType<SinrLiveCellModel['getHandoverDecisionFrame']> = null;
  for (let step = 0; step < intraStepCount; step += 1) {
    const simTimeSec = step * intraStepSec;
    frame = model.step({
      visibleSats: [satelliteAt(profile, INTRA_SATELLITE, simTimeSec)],
      ues: [intraUe],
      simTimeSec,
      dtSec: step === 0 ? 0 : intraStepSec,
    });
    if (step === intraStepCount - 2) {
      preCommitFrame = frame;
      preCommitDecision = model.getHandoverDecisionFrame();
    }
  }
  const decision = model.getHandoverDecisionFrame();
  if (frame === undefined || preCommitFrame === undefined || decision === null || preCommitDecision === null) {
    throw new Error('intra scenario did not publish both pre-commit and committed decision frames');
  }
  const event = frame.recentHandoverEvents.find(item => item.ueId === intraUe.id && item.kind === 'intra');
  if (event === undefined) throw new Error('intra scenario did not publish a real intra event');
  if (decision.recentCommit?.kind !== 'intra-satellite') {
    throw new Error('intra scenario did not publish an intra-satellite commit');
  }
  const candidate = candidateFromEvent(event);

  const placementByCellId = resolveSinrLiveCellPlacementById({
    enabled: true,
    hasCanonicalScenario: false,
    profile,
    servingBeamCount: 7,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
  });
  const placement = placementByCellId.get(event.toCellId);
  if (placement === undefined) throw new Error(`missing placement for intra cell ${event.toCellId}`);
  const satellites = [INTRA_SATELLITE] as const;
  const satelliteWorldById = new Map<string, WorldPoint>(satellites.map(fixture => [fixture.id, fixture.world]));
  const primary = frame.ues.find(item => item.ueId === intraUe.id) ?? frame.ues[0];
  if (primary === undefined) throw new Error('intra scenario did not publish its primary UE');
  const hero = {
    satId: primary.servingSatId,
    cellId: primary.cellId,
    beamId: primary.servingBeamId ?? null,
  };
  const focusSatIds = hero.satId === null ? null : new Set([hero.satId]);
  const envelope = resolveHandoverConeEnvelope(
    0.5,
    DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
  );
  const handoverGeometry = {
    placementByCellId,
    satelliteWorldById,
    frequencyReuse: profile.beams.frequencyReuse,
    homepageIntraCellAnchor: new Vector3(0, 0, 0),
    manualHandoverGroundTarget: new Vector3(0, 0, 0),
  };

  // The scene-level adapter and the lower-level allow-list both receive real
  // identities from the committed frame/event. The extra prepared candidate is
  // another measured opportunity from the pre-commit decision, not an authored
  // render item; it makes the serving-vs-prepared visibility branch observable.
  const measuredPrepared = preCommitDecision.opportunities.find(opportunity => (
    opportunity.key.satelliteId === event.toSatId
      && opportunity.key.beamId !== event.fromBeamId
      && opportunity.key.beamId !== event.toBeamId
  ));
  if (measuredPrepared === undefined) throw new Error('intra decision did not publish a second measured candidate');
  const visibilityProbe = resolveHomepageBeamVisibility({
    servingBeam: {
      satelliteId: hero.satId ?? event.toSatId,
      cellId: event.toCellId,
      beamId: hero.beamId,
    },
    preparedCandidateBeam: {
      satelliteId: measuredPrepared.key.satelliteId,
      cellId: event.toCellId,
      beamId: measuredPrepared.key.beamId,
    },
  });
  const sceneVisibility = resolveHomepageSceneBeamVisibility({
    displayHeroRecord: hero.satId === null || hero.cellId === null
      ? null
      : { servingSatId: hero.satId, cellId: hero.cellId, beamId: hero.beamId },
    primaryServingRecord: primary,
    renderedCandidateSatelliteId: null,
    presentedHandoverPairCandidate: candidate,
    handoverPresentationCandidate: null,
    handoverAuthorityJoin: null,
    cinemaPairCandidate: candidate,
    recentPrimaryHandoverEvent: event,
  });
  const allowedBeamIdentities = new Set([...visibilityProbe, ...sceneVisibility]);
  const restrictHomepageBeamItems = (items: readonly SinrLiveCellBeamConeRenderItem[]) => (
    restrictHomepageBeamItemsByContract(items, {
      homepageVisualIdentity: true,
      allowedBeamIdentities,
      allowAllBeamSatelliteIds: new Set(),
    })
  );
  const palette = paletteFromDefaultSpec();
  const servingItems = resolveServingConeItems({
    geometry: {
      cellFrame: frame,
      placementByCellId,
      satelliteWorldById,
      focusSatIds,
      frequencyReuse: profile.beams.frequencyReuse,
      servingBeamBudget: 7,
      allowHeroFallback: false,
      budgetServingFan: resolveServingConeBudgetFan(true, true),
      displayHeroRecord: hero.satId === null || hero.cellId === null
        ? null
        : { servingSatId: hero.satId, cellId: hero.cellId, beamId: hero.beamId },
    },
    presentation: {
      showSinrLiveCellBeams: true,
      renderServingField: true,
      showNonServingCones: true,
      hideNormalBeamField: false,
      hidePrimaryServingBeam: false,
      preserveConfiguredServingFan: false,
      teachingLectureFieldCleared: false,
      multiCandidateCentralOverlayActive: false,
      homepageVisualIdentity: true,
      homepageBeamVisibility: allowedBeamIdentities,
      homepageBeamFanSatelliteIds: new Set(),
      resolveSceneAcceptedBeamColor: identityColor,
      restrictHomepageBeamItems,
    },
  });
  const nonServingItems = restrictHomepageBeamItems(paintConeItems(
    resolveSinrLiveNonServingConeItems({
      cellFrame: frame,
      placementByCellId,
      satelliteWorldById,
      focusSatIds: resolveNonServingConeFocusSatIds(true, focusSatIds),
    }),
    { resolveIdentityColor: identityColor, prominence: 'candidate' },
  ));
  const pulseItems = resolvePulseConeItems({
    policy: {
      enabled: true,
      hideTimelinePulse: false,
      suppressNaturalHandoverLayers: false,
      renderNaturalPulse: true,
      homepageVisualIdentity: true,
      concurrentIntraVisualSuppressed: false,
      showOtherHandoverUes: false,
      pulseFocusFollowsScope: true,
    },
    frame: {
      recentHandoverEvents: frame.recentHandoverEvents,
      simTimeSec: frame.simTimeSec,
    },
    geometry: {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      focusSatIds,
      protagonistUeId: frame.primaryUeId ?? primary.ueId,
      protagonistIntraBaseCenterOverride: new Vector3(0, 0, 0),
    },
    output: {
      resolveSceneAcceptedBeamColor: identityColor,
      restrictHomepageBeamItems,
    },
  });
  const cinemaItems = resolveCinemaPairConeItems({
    policy: {
      enabled: true,
      homepageVisualIdentity: true,
      renderCinemaPair: true,
      handoverActive: true,
      presentedInterHandoverActive: false,
      presentedCinemaHandoverActive: true,
      handoverEventKind: 'intra',
    },
    candidate,
    envelope,
    triggeredIntraPeakOpacity: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
    geometry: handoverGeometry,
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems },
  });
  const authorityItems = resolveAuthorityPairConeItems({
    policy: {
      enabled: true,
      centralOverlayActive: true,
      identityTransitionActive: true,
      handoverActive: true,
      homepageVisualIdentity: true,
      renderAuthorityPair: true,
      authorityPresentationCommitObserved: true,
    },
    candidate,
    envelope,
    beamColorBySatelliteBeam: new Map(),
    geometry: handoverGeometry,
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems },
  });
  const layers: readonly [SinrLiveConeMountLayer, readonly SinrLiveCellBeamConeRenderItem[]][] = [
    ['nonServing', nonServingItems],
    ['serving', servingItems],
    ['pulse', pulseItems],
    ['triggered', [...cinemaItems, ...authorityItems]],
  ];
  const items = layers
    .flatMap(([layer, layerItems]) => layerItems.map(item => finalSnapshotItem(layer, item, placementByCellId, palette, hero)))
    .sort(compareItems);

  const policyConfigHash = createHandoverPresentationPolicyConfigHash('frame-plan-intra');
  const preCommitEpochToken = preCommitDecision.epochToken;
  const committedEpochToken = decision.epochToken;
  if (preCommitEpochToken === undefined || committedEpochToken === undefined) {
    throw new Error('intra decision frames did not publish epoch tokens');
  }
  const previousAcceptedSnapshot = buildHomepageAcceptedSnapshot({
    decisionBoundary: {
      sourceFrameId: preCommitDecision.sourceFrameId,
      epochToken: preCommitEpochToken,
      simTimeMs: preCommitDecision.simTimeMs,
      phase: preCommitDecision.phase,
      decision: preCommitDecision,
    },
    policyConfigHash,
    pinnedKey: null,
    configuredBeamCount: 7,
  });
  if (previousAcceptedSnapshot === null) throw new Error('pre-commit accepted homepage snapshot was null');
  const previousRail = projectHomepageRail(previousAcceptedSnapshot, { configuredCellCount: 7 });
  const previousStory = previousRail.handoverStory ?? null;
  if (previousStory === null) throw new Error('pre-commit homepage rail did not publish a handover story');
  const previousCandidateRoster = {
    episodeId: previousAcceptedSnapshot.episodeId,
    epochToken: previousAcceptedSnapshot.epochToken,
    policyConfigHash: previousAcceptedSnapshot.policyConfigHash,
    sourceFrameId: previousRail.sourceFrameId,
    source: previousStory.source,
    target: previousStory.target,
    links: previousRail.visibleCandidates ?? previousRail.candidates,
  };
  const acceptedSnapshot = buildHomepageAcceptedSnapshot({
    decisionBoundary: {
      sourceFrameId: decision.sourceFrameId,
      epochToken: committedEpochToken,
      simTimeMs: decision.simTimeMs,
      phase: decision.phase,
      decision,
    },
    policyConfigHash,
    pinnedKey: null,
    previousSnapshot: previousAcceptedSnapshot,
    configuredBeamCount: 7,
  });
  if (acceptedSnapshot === null) throw new Error('committed accepted homepage snapshot was null');
  const rail = projectHomepageRail(acceptedSnapshot, {
    configuredCellCount: 7,
    previousSnapshot: previousAcceptedSnapshot,
    previousStory,
    previousCandidateRoster,
  });

  const renderedBeamIdentities = [...new Set(items.map(item => (
    `${item.satId}|${item.cellId}|${item.beamId}`
  )))].sort(compareText);
  return {
    id: 'real-intra-commit',
    inputs: {
      targetSimTimeSec: frame.simTimeSec,
      stepSec: intraStepSec,
      stepCount: intraStepCount,
      profileId: PROFILE_ID,
      maxGainDbiOverrideDbi: 30,
      eeThresholdKbitPerJoule: 220,
      ueIds: [intraUe.id],
      satellites,
    },
    truth: {
      simTimeSec: frame.simTimeSec,
      primaryUeId: frame.primaryUeId ?? primary.ueId,
      primaryServing: hero,
      handoverEvents: frame.recentHandoverEvents.map(summarizeEvent),
      selectedKind: preCommitDecision.selectedKind,
      committedKind: decision.recentCommit?.kind ?? null,
    },
    items,
    visibility: {
      allowedBeamIdentities: [...allowedBeamIdentities].sort(compareText),
      probeAllowedBeamIdentities: [...visibilityProbe].sort(compareText),
      sceneAllowedBeamIdentities: [...sceneVisibility].sort(compareText),
      renderedBeamIdentities,
    },
    markers: buildMarkerSnapshots(satellites, event),
    timing: buildTimingSnapshot('intra', 0.5, 0, 2500),
    groundEffects: buildGroundEffectsSnapshot(event, placement),
    rail: summarizeRail(rail),
  };
}

function buildSnapshot(): FramePlanSnapshot {
  const profile = loadProfile(PROFILE_ID);
  const model = createSinrLiveCellModel(
    profile,
    true,
    EPOCH_UTC_MS,
    {},
    7,
    3,
    true,
    'earth-fixed-cell',
    true,
    1000,
  );
  if (model === null) throw new Error('the earth-fixed cell model did not initialize');

  let frame: SinrLiveCellFrame | undefined;
  for (let step = 0; step < STEP_COUNT; step += 1) {
    const simTimeSec = step * STEP_SEC;
    frame = model.step({
      visibleSats: SATELLITES.map(fixture => satelliteAt(profile, fixture, simTimeSec)),
      ues: UES,
      simTimeSec,
      dtSec: step === 0 ? 0 : STEP_SEC,
    });
  }
  if (frame === undefined || frame.simTimeSec !== (STEP_COUNT - 1) * STEP_SEC) {
    throw new Error('fixed-step model did not reach the expected target simulation time');
  }

  const placementByCellId = resolveSinrLiveCellPlacementById({
    enabled: true,
    hasCanonicalScenario: false,
    profile,
    servingBeamCount: 7,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
  });
  const satelliteWorldById = new Map<string, WorldPoint>(SATELLITES.map(fixture => [fixture.id, fixture.world]));
  const primary = frame.ues[0];
  const hero = {
    satId: primary?.servingSatId ?? null,
    cellId: primary?.cellId ?? null,
    beamId: primary?.servingBeamId ?? null,
  };
  const focusSatIds = resolveServingConeFocusSatIds(
    false,
    DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones,
    hero.satId === null ? null : new Set([hero.satId]),
  );
  const palette = paletteFromDefaultSpec();
  const restrictHomepageBeamItems = (items: readonly SinrLiveCellBeamConeRenderItem[]) => items;
  const servingItems = resolveServingConeItems({
    geometry: {
      cellFrame: frame,
      placementByCellId,
      satelliteWorldById,
      focusSatIds,
      frequencyReuse: profile.beams.frequencyReuse,
      servingBeamBudget: 7,
      allowHeroFallback: false,
      budgetServingFan: resolveServingConeBudgetFan(false, DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones),
      displayHeroRecord: hero.satId === null || hero.cellId === null
        ? null
        : { servingSatId: hero.satId, cellId: hero.cellId, beamId: hero.beamId },
    },
    presentation: {
      showSinrLiveCellBeams: true,
      renderServingField: true,
      showNonServingCones: DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones,
      hideNormalBeamField: false,
      hidePrimaryServingBeam: false,
      preserveConfiguredServingFan: false,
      teachingLectureFieldCleared: false,
      multiCandidateCentralOverlayActive: false,
      homepageVisualIdentity: false,
      homepageBeamVisibility: new Set(),
      homepageBeamFanSatelliteIds: new Set(),
      resolveSceneAcceptedBeamColor: identityColor,
      restrictHomepageBeamItems,
    },
  });

  const candidateGeometry = selectCandidateConeGeometry({
    presentedHandoverPairCandidate: null,
    showCinemaCandidateFan: false,
    renderedCandidateSatelliteId: 'SAT-C',
    primaryServingRecord: primary ?? null,
    candidateDisplayCellFrame: frame,
    cinemaInterDisplayCellFrame: undefined,
    normalSatelliteWorldById: satelliteWorldById,
    cinemaSatelliteWorldById: satelliteWorldById,
    placementByCellId,
    frequencyReuse: profile.beams.frequencyReuse,
    maxFanCones: DEFAULT_BEAM_DISPLAY_SPEC.candidateFanMaxCones,
  });
  const { isInterPresentation: candidateIsInterPresentation, ...candidateGeometryInput } = candidateGeometry;
  const candidateItems = resolveCandidateConeItems({
    geometry: candidateGeometryInput,
    presentation: {
      candidateComparisonSceneActive: false,
      renderCandidateField: true,
      homepageVisualIdentity: false,
      showSinrLiveCellBeams: true,
      hideCandidateFan: false,
      showCinemaCandidateFan: false,
      isInterPresentation: candidateIsInterPresentation,
      handoverPhase: 'measuring',
      handoverToOpacity: 1,
      candidateFanConeOpacity: DEFAULT_BEAM_DISPLAY_SPEC.candidateFanConeOpacity,
      triggeredIntraPeakOpacity: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
      targetRole: 'candidate',
      acceptedHandoverPresentation: null,
      restrictHomepageBeamItems,
    },
  });

  const nonServingItems = DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones
    ? paintConeItems(resolveSinrLiveNonServingConeItems({
      cellFrame: frame,
      placementByCellId,
      satelliteWorldById,
      focusSatIds: resolveNonServingConeFocusSatIds(
        DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones,
        focusSatIds,
      ),
    }), { resolveIdentityColor: identityColor, prominence: 'candidate' })
    : [];

  const pulseItems = resolvePulseConeItems({
    policy: {
      enabled: true,
      hideTimelinePulse: false,
      suppressNaturalHandoverLayers: false,
      renderNaturalPulse: true,
      homepageVisualIdentity: false,
      concurrentIntraVisualSuppressed: false,
      showOtherHandoverUes: DEFAULT_BEAM_DISPLAY_SPEC.showOtherHandoverUes,
      pulseFocusFollowsScope: DEFAULT_BEAM_DISPLAY_SPEC.pulseFocusFollowsScope,
    },
    frame: {
      recentHandoverEvents: frame.recentHandoverEvents,
      simTimeSec: frame.simTimeSec,
    },
    geometry: {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      focusSatIds: focusSatIds,
      protagonistUeId: frame.primaryUeId ?? primary?.ueId ?? null,
    },
    output: {
      resolveSceneAcceptedBeamColor: identityColor,
      restrictHomepageBeamItems,
    },
  });

  const emptyCandidate = null;
  const emptyEnvelope = { fromOpacity: 0, phase: 'serving' as const, toOpacity: 0 };
  const handoverGeometry = {
    placementByCellId,
    satelliteWorldById,
    frequencyReuse: profile.beams.frequencyReuse,
    homepageIntraCellAnchor: new Vector3(0, 0, 0),
    manualHandoverGroundTarget: new Vector3(0, 0, 0),
  };
  const triggeredItems = resolveTriggeredIntraConeItems({
    policy: {
      enabled: true,
      renderTriggeredIntra: true,
      homepageVisualIdentity: false,
      presentedCinemaHandoverActive: false,
      handoverActive: false,
      handoverEventSource: null,
      handoverEventKind: null,
    },
    candidate: emptyCandidate,
    fallbackUeId: primary?.ueId,
    envelope: emptyEnvelope,
    triggeredIntraPeakOpacity: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
    geometry: { ...handoverGeometry, manualBaseCenterOverride: new Vector3(0, 0, 0) },
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems },
  });
  const cinemaItems = resolveCinemaPairConeItems({
    policy: {
      enabled: true,
      homepageVisualIdentity: false,
      renderCinemaPair: true,
      handoverActive: false,
      presentedInterHandoverActive: false,
      presentedCinemaHandoverActive: false,
      handoverEventKind: null,
    },
    candidate: emptyCandidate,
    envelope: emptyEnvelope,
    triggeredIntraPeakOpacity: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
    geometry: handoverGeometry,
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems },
  });
  const authorityItems = resolveAuthorityPairConeItems({
    policy: {
      enabled: true,
      centralOverlayActive: false,
      identityTransitionActive: false,
      handoverActive: false,
      homepageVisualIdentity: false,
      renderAuthorityPair: true,
      authorityPresentationCommitObserved: false,
    },
    candidate: emptyCandidate,
    envelope: emptyEnvelope,
    beamColorBySatelliteBeam: new Map(),
    geometry: handoverGeometry,
    output: { resolveSceneAcceptedBeamColor: identityColor, restrictHomepageBeamItems },
  });

  const layers: readonly [SinrLiveConeMountLayer, readonly SinrLiveCellBeamConeRenderItem[]][] = [
    ['nonServing', nonServingItems],
    ['serving', servingItems],
    ['candidate', candidateItems],
    ['pulse', pulseItems],
    ['triggered', [...triggeredItems, ...cinemaItems, ...authorityItems]],
  ];
  const items = layers
    .flatMap(([layer, layerItems]) => layerItems.map(item => finalSnapshotItem(layer, item, placementByCellId, palette, hero)))
    .sort(compareItems);
  const intraScenario = buildIntraScenario(profile);

  return {
    protocol: 'deterministic-frame-plan-v1',
    inputs: {
      epochUtcMs: EPOCH_UTC_MS,
      profileId: PROFILE_ID,
      stepSec: STEP_SEC,
      stepCount: STEP_COUNT,
      targetSimTimeSec: frame.simTimeSec,
      worldUnitsPerKm: WORLD_UNITS_PER_KM,
      ueIds: UES.map(ue => ue.id),
      satellites: SATELLITES,
    },
    truth: {
      simTimeSec: frame.simTimeSec,
      primaryUeId: frame.primaryUeId ?? primary?.ueId ?? null,
      primaryServing: hero,
      recentHandoverEvents: frame.recentHandoverEvents.length,
      handoverEvents: frame.recentHandoverEvents.map(summarizeEvent),
    },
    timing: buildTimingSnapshot('inter', 0.5, 0, 2500),
    items,
    scenarios: [intraScenario],
  };
}

type JsonValue = null | boolean | number | string | JsonValue[] | { readonly [key: string]: JsonValue };

function diffJson(expected: JsonValue, actual: JsonValue, currentPath = '$'): string[] {
  if (Object.is(expected, actual)) return [];
  if (typeof expected !== typeof actual || expected === null || actual === null) {
    return [`${currentPath}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`];
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return [`${currentPath}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`];
    }
    const diffs: string[] = [];
    if (expected.length !== actual.length) {
      diffs.push(`${currentPath}.length: expected ${expected.length}, received ${actual.length}`);
    }
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      if (index >= expected.length || index >= actual.length) continue;
      diffs.push(...diffJson(expected[index]!, actual[index]!, `${currentPath}[${index}]`));
    }
    return diffs;
  }
  if (typeof expected === 'object' && typeof actual === 'object') {
    const expectedObject = expected as { readonly [key: string]: JsonValue };
    const actualObject = actual as { readonly [key: string]: JsonValue };
    const keys = [...new Set([...Object.keys(expectedObject), ...Object.keys(actualObject)])].sort();
    return keys.flatMap(key => (
      key in expectedObject && key in actualObject
        ? diffJson(expectedObject[key]!, actualObject[key]!, `${currentPath}.${key}`)
        : [`${currentPath}.${key}: ${key in expectedObject ? 'missing from received' : 'unexpected in received'}`]
    ));
  }
  return [`${currentPath}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`];
}

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

const update = process.argv.slice(2).includes('--update');
const startedAt = process.hrtime.bigint();
const snapshot = buildSnapshot();
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
const digest = createHash('sha256').update(serialized).digest('hex');
const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

if (update) {
  mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, serialized, 'utf8');
  console.log(`[${GATE}] UPDATED ${FIXTURE_PATH}`);
} else if (!existsSync(FIXTURE_PATH)) {
  console.error(`[${GATE}] FAIL — missing ${FIXTURE_PATH}; run with --update to create it`);
  process.exitCode = 1;
} else {
  const expected = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as JsonValue;
  const diffs = diffJson(expected, asJsonValue(snapshot));
  if (diffs.length > 0) {
    console.error(`[${GATE}] FAIL — ${diffs.length} per-field difference(s) vs ${FIXTURE_PATH}`);
    console.error(`[${GATE}] actual-sha256=${digest}`);
    for (const diff of diffs.slice(0, 80)) console.error(`  ${diff}`);
    if (diffs.length > 80) console.error(`  ... ${diffs.length - 80} more`);
    process.exitCode = 1;
  } else {
    console.log(`[${GATE}] PASS — ${snapshot.items.length} items, sha256=${digest}`);
  }
}

console.log(`[${GATE}] wall=${elapsedMs.toFixed(2)}ms target=t=${snapshot.truth.simTimeSec}s events=${snapshot.truth.recentHandoverEvents}`);
