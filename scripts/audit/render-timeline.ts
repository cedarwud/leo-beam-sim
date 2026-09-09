/**
 * THE QUERYABLE RENDER TIMELINE.
 *
 * ## Why this exists
 *
 * The owner's standing complaint:
 *
 *   「每次都要我看畫面才能確定這件事本身就有問題,前端的渲染邏輯這麼清楚的寫在
 *     程式上,哪一秒要發生什麼事情,理論上你應該都是可以完全掌握才對,怎麼會每次
 *     都是要我用看的,你應該都算得出來嗎?」
 *
 * They are right. There is no randomness and no external input on this render
 * path: what the screen shows at sim second N is a pure function of the model
 * state at N. So it must be answerable by computation, not by looking.
 *
 * This tool answers it. It steps the REAL production model headlessly and, at
 * any second you ask for, prints the resolved render plan — every cone item
 * with its colour, opacity, role, layer and geometry — plus the serving
 * assignment and whatever handover is on stage.
 *
 * ## What it is NOT
 *
 * It is not a second copy of `validate:frame-plan`. That gate pins ONE synthetic
 * frame against a fixture and answers "did anything change since last time".
 * This answers "what is on screen at second N, and what changed at second N+1",
 * over the real 2-hour Walker route, for any N. Different question, different
 * tool, no shared file.
 *
 * ## What is computed here and what is NOT
 *
 * COMPUTED (all of it, exactly): the serving assignment, the handover events and
 * their kind, the accepted comparison plan, the accepted homepage snapshot,
 * same-frame EE normalisation, the identity ladder rung that won, the
 * presentation clock/phase/envelope, which cone items exist, each item's
 * resolved hex colour, its resolved opacity, its layer, its role, its cone
 * apex/baseCenter/baseRadius in world units.
 *
 * NOT COMPUTED, and deliberately not faked: GPU rasterisation, additive
 * blending between overlapping cones, fog, tone mapping, camera framing, and
 * anti-aliasing. Those need a rasteriser. Everything a rasteriser is HANDED —
 * colour, alpha, visibility, geometry — is computed here.
 *
 * ## Determinism
 *
 * Fixed epoch (`DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS`), fixed 1 s step, fixed
 * UE seed, no wall clock, no RNG, no I/O. The presentation clock is driven by
 * `nowMs = simTimeSec * 1000`, i.e. playback speed 1 — the only mapping under
 * which "sim second N" and "what the viewer sees" are the same question.
 *
 * ## Output format, and why
 *
 * Default is ONE ITEM PER LINE with a stable sort. Chosen over JSON because the
 * primary consumer is `diff`, `grep` and human eyes in a terminal, and a
 * line-oriented format survives all three. `--json` emits the same data with
 * sorted keys for machine consumption.
 *
 * ## Usage
 *
 *   npm run audit:render-timeline -- --at 88
 *   npm run audit:render-timeline -- --diff 86,90
 *   npm run audit:render-timeline -- --events 0..600
 *   npm run audit:render-timeline -- --watch color --range 300..340
 *   npm run audit:render-timeline -- --at 88 --json
 */
import { Vector3 } from 'three';

import { loadProfile } from '../../src/profiles/index.ts';
import { deriveWalkerSignalTunedProfile } from '../../src/app/walkerSignalProfile.ts';
import { createSignalTuningState } from '../../src/signalTuning.ts';
import {
  applyHandoverPolicyTuning,
  createHandoverPolicyTuningState,
} from '../../src/handoverPolicyTuning.ts';
import { createSceneTopologyState } from '../../src/sceneTopology.ts';
import { DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS } from '../../src/app/walkerScenarioTime.ts';
import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from '../../src/engine/handover/eeThreshold.ts';
import {
  DEFAULT_UE_MOBILITY_PARAMS,
  createMobilityStates,
} from '../../src/engine/ue/multiUeMobility.ts';
import { HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM } from '../../src/homepage/controller/homepageStoryScenario.ts';
import { HandoverManager } from '../../src/engine/handover/handover-manager.ts';
import { createObserverContext } from '../../src/engine/orbit/index.ts';
import {
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
  attachSinrLiveCellFrame,
  resolveSinrLiveSceneCellCount,
} from '../../src/scene/sinrLiveCellRuntime.ts';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  stepRuntimeFrame,
} from '../../src/scene/runtimeFrameStep.ts';
import { computeTrajectoryCache } from '../../src/scene/trajectoryFrame.ts';
import { SKY_DOME_V_RADIUS } from '../../src/scene/sceneScale.ts';
import { NTPU_CONFIG, resolveInscribedPaperUserArea } from '../../src/config/ntpu.config.ts';
import { resolveSinrLiveCellPlacementById } from '../../src/scene/sinrLiveCellPlacement.ts';
import {
  resolveCandidateConeItems,
  selectCandidateConeGeometry,
} from '../../src/scene/candidateConeItems.ts';
import { resolveCandidateBeamConeItems } from '../../src/viz/SinrLiveCellBeamCones.tsx';
import { resolveHandoverMarkerSatelliteIds } from '../../src/scene/handoverMarkerSatelliteIds.ts';
import { resolveRenderedLiveSatelliteMarkers } from '../../src/scene/renderedLiveSatelliteMarkers.ts';
import {
  cellLinkBudgetBeamId,
  type SinrLiveCellFrame,
  type SinrLiveCellHandoverEvent,
  type UeCellServingRecord,
} from '../../src/scene/sinrLiveCellModel.ts';
import { resolveRecentPrimaryHandoverEvent } from '../../src/scene/recentHandoverPresentationEvent.ts';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from '../../src/scene/acceptedHandoverPresentationSnapshot.ts';
import { resolveHandoverPresentationCandidate } from '../../src/scene/handoverPresentationCandidate.ts';
import {
  advanceHandoverPresentation,
  createHandoverPresentationState,
  createIdleHandoverPresentationView,
  type HandoverPresentationState,
  type HandoverPresentationView,
} from '../../src/scene/handoverPresentationOwner.ts';
import { resolveHandoverPresentationDisplayPolicy } from '../../src/scene/handoverPresentationDisplayPolicy.ts';
import { resolveHomepageSceneGeometryPolicy } from '../../src/homepage/controller/homepageSceneGeometryPolicy.ts';
import { adaptHomepageSourceFrame } from '../../src/homepage/controller/sourceFrameAdapter.ts';
import { resolveHomepageRenderAuthority } from '../../src/homepage/controller/homepageRenderAuthority.ts';
import { homepageBeamEeNormalizedByKey } from '../../src/homepage/controller/homepageBeamEeProjection.ts';
import { resolveHomepageSceneBeamVisibility } from '../../src/scene/homepageSceneBeamVisibility.ts';
import {
  restrictHomepageBeamItems,
  resolveNonServingConeFocusSatIds,
  resolveServingConeBudgetFan,
  resolveServingConeFocusSatIds,
} from '../../src/appearance/beamVisibilityContract.ts';
import {
  HANDOVER_CONE_PHASE_END,
  HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
  HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
  INTER_HANDOVER_CINEMA_PHASE_END,
  INTRA_HANDOVER_CINEMA_DISPLAY_MS,
  INTER_HANDOVER_CINEMA_DISPLAY_MS,
} from '../../src/appearance/handoverTimingEnvelope.ts';
import { DEFAULT_BEAM_DISPLAY_SPEC } from '../../src/scene/beamDisplaySpec.ts';
import {
  MIN_RENDER_ELEVATION_DEG,
  SINR_LIVE_FOOTPRINT_RING_Y_LIFT,
} from '../../src/appearance/coneGeometryContract.ts';
import { resolveServingConeItems } from '../../src/scene/servingConeItems.ts';
import {
  resolveAuthorityPairConeItems,
  resolveCinemaPairConeItems,
  resolvePulseConeItems,
} from '../../src/scene/handoverConeResolvers.ts';
import { paintConeItems } from '../../src/appearance/paintConeItems.ts';
import { makeIdentitySources } from '../../src/appearance/beamAppearanceContract.ts';
import {
  resolveBaseIdentityColorWithRung,
  type BaseIdentityColorResolution,
} from '../../src/appearance/resolveBeamAppearance.ts';
import {
  homepageBeamIdentityLookup,
  homepageSatelliteColorForBeam,
} from '../../src/homepage/controller/homepageSatelliteVisualIdentity.ts';
import { resolveAcceptedBeamIdentityColor } from '../../src/scene/acceptedBeamIdentityColor.ts';
import { resolveMultiCandidateComparisonPolicy } from '../../src/scene/multiCandidateSceneDisplayPolicy.ts';
import { resolveAuthorityPresentationCandidate } from '../../src/scene/handoverPresentationDisplayPolicy.ts';
import {
  commitReceiptMatchesHandoverPresentation,
  resolveHandoverAuthorityJoin,
} from '../../src/scene/handoverAuthorityJoin.ts';
import { resolveMultiCandidateBeamColors } from '../../src/scene/multiCandidateBeamColors.ts';
import { resolveSatelliteSurfaceColor } from '../../src/appearance/satelliteSurfaceModifiers.ts';
import {
  formatHomepageBeamCellLabel,
  HOMEPAGE_EE_SCALE_MAX_BITS_PER_JOULE,
  resolveRailServingEeOpacity,
} from '../../src/appearance/candidateRailPresentation.ts';
import {
  resolveMountedConeColor,
  resolvePrimaryIdentityBeam,
} from '../../src/appearance/mountedConeAppearance.ts';
import { eeThresholdKbitPerJouleToBitsPerJoule } from '../../src/engine/handover/eeThreshold.ts';
import {
  resolveIntraGroundShockwaveColors,
  sourceOpacityFor,
  sourceScaleFor,
  targetOpacityFor,
  targetScaleFor,
} from '../../src/viz/IntraGroundShockwave.tsx';
import { resolveSatelliteTintedColor } from '../../src/viz/SatelliteMarker.tsx';
import { resolveOrbitTrailPlans } from '../../src/viz/OrbitTrail.tsx';
import { resolveVisualLabBeamRadius } from '../../src/appearance/coneGeometryContract.ts';
import { DEFAULT_MAX_DISPLAY_SATS } from '../../src/scene/beamVizModel.ts';
import {
  resolveSinrLiveConeDisplayStyle,
  resolveSinrLiveConeRole,
  resolveSinrLiveNonServingConeItems,
  shouldDimSinrLiveConeRole,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveConeMountLayer,
  type SinrLiveCellPlacement,
} from '../../src/viz/SinrLiveCellBeamCones.tsx';
import {
  resolveSinrLiveConeElevationDimFactor,
  type SinrLiveConePalette,
} from '../../src/constants/sinrLiveConeStyle.ts';
import {
  SINR_LIVE_CONE_BASE_ALPHA_FACTOR,
  SINR_LIVE_CONE_SEGMENTS,
} from '../../src/constants/sinrLiveConeStyle.ts';
import type { WorldPoint } from '../../src/viz/CellFootprints.tsx';
import type { CachedSatState } from '../../src/scene/simulationHelpers.ts';
import type { SimFrame } from '../../src/scene/types.ts';
import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetricsProjection,
} from '../../src/homepage/controller/contracts.ts';
import type { MultiCandidateComparisonLatch } from '../../src/scene/multiCandidateSceneDisplayPolicy.ts';

const TOOL = 'audit:render-timeline';

// ---------------------------------------------------------------------------
// FIXED INPUTS. Every one of these is the production default-route value; the
// header prints them so a reader never has to trust this comment.
// ---------------------------------------------------------------------------
const EPOCH_UTC_MS = DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS;
const PROFILE_ID = 'hobs-2024-candidate-rich';
const STEP_SEC = 1;
const UE_COUNT = 100;
const SERVING_BEAM_COUNT = 7;
const CANDIDATE_BEAM_COUNT = 7;
const PRIMARY_UE_ID = 'live-ue-0';
/** Playback speed 1: one sim second is one wall-clock second on screen. */
const MS_PER_SIM_SEC = 1000;

type Surface = 'homepage' | 'scene';

type TimelineItemLayer = SinrLiveConeMountLayer | 'marker' | 'orbitTrail' | 'shockwave';
type TimelineItemKind = 'cone' | 'marker' | 'orbitTrail' | 'shockwave' | 'candidateGeometry' | 'candidateRail';

interface TimelineItem {
  /** Stable identity for diffing across seconds. */
  readonly id: string;
  readonly kind: TimelineItemKind;
  readonly layer: TimelineItemLayer;
  readonly color: string;
  /** The role-table colour before the item-identity authority is applied. */
  readonly roleColor: string;
  /**
   * The colour this item would have with NO handover shade applied. When this
   * differs from `color`, the (kind, side) row in
   * `appearance/handoverAppearanceModifiers.ts` fired. That difference is the
   * only direct evidence the intra shading path was exercised.
   */
  readonly identityColor: string;
  readonly identityRung: BaseIdentityColorResolution['rung'] | 'marker' | 'surface' | 'shockwave';
  /** The exact frame-relative EE input used by the homepage colour projection. */
  readonly eeNormalized: number | null;
  readonly shaded: boolean;
  readonly opacity: number;
  readonly role: string;
  readonly satId: string;
  readonly cellId: number | null;
  readonly beamId: number | null;
  readonly frequencyIndex: number | null;
  readonly serving: boolean;
  readonly displayOnly: boolean;
  readonly renderKey: string | null;
  readonly apex: WorldPoint | null;
  readonly baseCenter: WorldPoint | null;
  readonly baseRadiusWorld: number | null;
  readonly bodyColor: string | null;
  readonly scale: number | null;
  /** The colour the real React cone mount hands to its mesh. */
  readonly mountedColor: string | null;
  /** Candidate-rail-only projections; null for scene/marker/surface items. */
  readonly railLabel: string | null;
  readonly railOpacity: number | null;
}

interface TimelineEvent {
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

interface TimelineSecond {
  readonly simTimeSec: number;
  readonly serving: {
    readonly ueId: string | null;
    readonly satId: string | null;
    readonly cellId: number | null;
    readonly beamId: number | null;
    readonly sinrDb: number | null;
  };
  /**
   * Two DIFFERENT energy-efficiency numbers exist for the same link and they do
   * not agree. Both are printed, labelled, and neither is silently preferred.
   *
   *   decisionEe — `angleAware.energyEfficiencyBitsPerJoule`, the raw formula
   *                output. This is what the EE admission threshold compares.
   *   displayEe  — `angleAware.homepageDemoEeBitsPerJoule`, the bounded,
   *                temporally-continuous projection the homepage rail SHOWS
   *                (see `homepage/controller/beamMetrics.ts:157-163`, frozen).
   *
   * A timeline that printed only one of them and did not say which would invite
   * exactly the confusion this tool exists to remove.
   */
  readonly ee: {
    readonly decisionEeBitsPerJoule: number | null;
    readonly displayEeBitsPerJoule: number | null;
    readonly diverges: boolean;
  };
  readonly presentation: {
    readonly active: boolean;
    readonly kind: 'intra' | 'inter' | null;
    readonly source: string | null;
    readonly phase: string | null;
    readonly progress01: number;
    readonly fromOpacity: number;
    readonly toOpacity: number;
    readonly eventId: string | null;
    readonly geometryOwner: string;
  };
  /** Events the model published at this exact second (not the retained window). */
  readonly newEvents: readonly TimelineEvent[];
  readonly retainedEvents: readonly TimelineEvent[];
  readonly items: readonly TimelineItem[];
}

// ---------------------------------------------------------------------------
// Ordering. One total order, used everywhere, so two runs and two seconds are
// comparable line by line.
// ---------------------------------------------------------------------------
const LAYER_ORDER: Record<TimelineItemLayer, number> = {
  nonServing: 0,
  serving: 1,
  candidate: 2,
  pulse: 3,
  triggered: 4,
  marker: 5,
  orbitTrail: 6,
  shockwave: 7,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareItems(left: TimelineItem, right: TimelineItem): number {
  return LAYER_ORDER[left.layer] - LAYER_ORDER[right.layer]
    || compareText(left.kind, right.kind)
    || compareText(left.satId, right.satId)
    || (left.cellId ?? -1) - (right.cellId ?? -1)
    || (left.beamId ?? -1) - (right.beamId ?? -1)
    || compareText(left.role, right.role)
    || compareText(left.renderKey ?? '', right.renderKey ?? '')
    || compareText(left.id, right.id);
}

function num(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return String(value);
  const fixed = value.toFixed(digits);
  return fixed === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : fixed;
}

function point(p: WorldPoint): string {
  return `(${num(p.x, 3)},${num(p.y, 3)},${num(p.z, 3)})`;
}

function optionalPoint(p: WorldPoint | null): string {
  return p === null ? '-' : point(p);
}

function optionalNum(value: number | null, digits = 4): string {
  return value === null ? '-' : num(value, digits);
}

// ---------------------------------------------------------------------------
// The driver. Steps the production model forward one second at a time and
// resolves the render plan at each second.
// ---------------------------------------------------------------------------
function buildProfile() {
  const baseProfile = loadProfile(PROFILE_ID);
  const topology = createSceneTopologyState();
  const signalTuning = createSignalTuningState(baseProfile);
  const tuned = deriveWalkerSignalTunedProfile({
    baseProfile,
    signalTuning,
    activeSceneTopology: topology,
  });
  return {
    profile: applyHandoverPolicyTuning(tuned, createHandoverPolicyTuningState(baseProfile)),
    topology,
  };
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

function summarizeEvent(event: SinrLiveCellHandoverEvent): TimelineEvent {
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

interface DriverOptions {
  readonly surface: Surface;
}

interface Driver {
  readonly header: readonly string[];
  /** Advance to `sec` (must be >= the last requested second) and return its plan. */
  at(sec: number): TimelineSecond;
}

function createDriver(options: DriverOptions): Driver {
  const { profile, topology } = buildProfile();
  const homepageVisualIdentity = options.surface === 'homepage';
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache: CachedSatState[][] = computeTrajectoryCache(profile, observer, EPOCH_UTC_MS);

  const model = createSinrLiveCellModel(
    profile,
    true,
    EPOCH_UTC_MS,
    {},
    SERVING_BEAM_COUNT,
    CANDIDATE_BEAM_COUNT,
    topology.beamHoppingEnabled,
    'sampled-steering',
    true,
    DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE,
  );
  if (model === null) throw new Error(`[${TOOL}] the cell-truth model did not initialize`);
  model.setFocusCell(null);

  const hoManager = new HandoverManager(profile.handover, { enforceSharedHandoverInterval: true });
  const secondaryHoManagers = Array.from(
    { length: Math.max(0, UE_COUNT - 1) },
    () => new HandoverManager(profile.handover),
  );
  const state = createRuntimeFrameStepState(0);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const sceneCellLayout = buildSinrLiveCellLayout(
    profile,
    resolveSinrLiveSceneCellCount(SERVING_BEAM_COUNT),
  );
  const sceneCellCentersKm = sceneCellLayout.centers.map(c => ({
    eastKm: c.localXKm,
    northKm: c.localYKm,
  }));
  const mobilityStates = createMobilityStates(
    UE_COUNT,
    'static',
    DEFAULT_UE_MOBILITY_PARAMS,
    profile.ueDistribution?.seed ?? 42,
  );
  const replay = {
    epochUtcMs: EPOCH_UTC_MS,
    startOffsetSec: 0,
    loop: false,
    windowLengthSec: 7200,
  };

  // Production world scale, read from the same config MainScene reads.
  const paperUserArea = resolveInscribedPaperUserArea(NTPU_CONFIG);
  const worldUnitsPerKm = 1 / paperUserArea.kmPerWorldUnit;
  const satPosScaleFactor = NTPU_CONFIG.visualSatelliteAltitude / SKY_DOME_V_RADIUS;

  const placementByCellId = resolveSinrLiveCellPlacementById({
    enabled: true,
    hasCanonicalScenario: false,
    profile,
    servingBeamCount: SERVING_BEAM_COUNT,
    worldUnitsPerKm,
  });
  const palette = paletteFromDefaultSpec();
  const policyConfigHash = createHandoverPresentationPolicyConfigHash(JSON.stringify(profile));

  const stepFrame = (paused: boolean, deltaSec: number) => stepRuntimeFrame({
    profile,
    replay,
    speed: 1,
    paused,
    deltaSec,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager,
    secondaryHoManagers,
    state,
    ueCount: UE_COUNT,
    ueDistributionMode: 'seven-cell-asymmetric',
    primaryJogEastKm: HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM.east,
    primaryJogNorthKm: HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM.north,
    focusCellId: null,
    focusUeId: model.getPinnedPrimaryUeId(),
    uePrimaryAnchorMode: 'observer',
    ueDistributionScope: 'beam-footprint',
    ueDistributionRadiusKm: undefined,
    ueDistributionCellCentersKm: sceneCellCentersKm,
    ueDistributionCellRadiusKm: sceneCellLayout.cellRadiusKm,
    ueMobilityMode: 'static',
    ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
    mobilityStates,
    // Fixed, so the display-latch stamping inside the step is deterministic.
    nowMs: EPOCH_UTC_MS,
  } as never);

  let rawFrame = stepFrame(true, 0).frame;
  attachSinrLiveCellFrame(rawFrame as never, model, 0);

  let presentationState: HandoverPresentationState = createHandoverPresentationState();
  let lastSec = -1;
  const seenEventKeys = new Set<string>();
  let previousAcceptedSnapshot: HomepageAcceptedSnapshot | null = null;
  let previousHomepageBeamMetrics: HomepageBeamMetricsProjection | null = null;
  let previousComparisonLatch: MultiCandidateComparisonLatch | null = null;

  const eventKey = (event: SinrLiveCellHandoverEvent): string => (
    `${event.ueId}|${event.sourceTimeSec}|${event.kind}|${event.fromSatId}|${event.fromBeamId}|${event.toSatId}|${event.toBeamId}`
  );

  function resolvePlan(frame: unknown): TimelineSecond {
    const cellFrame = (frame as { sinrLiveCells?: SinrLiveCellFrame }).sinrLiveCells;
    const simTimeSec = (frame as { simTimeSec: number }).simTimeSec;
    if (cellFrame === undefined) {
      throw new Error(`[${TOOL}] the model published no cell frame at t=${simTimeSec}`);
    }

    // This is the headless equivalent of the live publisher's React adapter.
    // The adapter and authority are pure; the only state retained here is the
    // same previous-snapshot/previous-metrics continuity that React retains in
    // refs between published frames.
    const homepageSourceFrame = homepageVisualIdentity
      ? adaptHomepageSourceFrame({
        frame: frame as SimFrame,
        epochUtcMs: EPOCH_UTC_MS,
        dtSec: 0,
      })
      : null;
    const homepageAuthority = homepageVisualIdentity
      ? resolveHomepageRenderAuthority({
        sourceFrame: homepageSourceFrame,
        policyConfigHash,
        previousSnapshot: previousAcceptedSnapshot,
        previousMetrics: previousHomepageBeamMetrics,
        servingBeamCount: SERVING_BEAM_COUNT,
        candidateBeamCount: CANDIDATE_BEAM_COUNT,
        profileBeamsPerSatellite: profile.beams.perSatellite,
        configuredBeamCount: SERVING_BEAM_COUNT,
      })
      : null;
    const directAcceptedSession = !homepageVisualIdentity
      && (frame as SimFrame).handoverDecisionFrame !== null
      && (frame as SimFrame).handoverDecisionFrame !== undefined
      ? buildAcceptedHandoverPresentationSession({
        decision: (frame as SimFrame).handoverDecisionFrame!,
        policyConfigHash,
        pinnedKey: null,
        previousSnapshot: previousAcceptedSnapshot,
      })
      : null;
    if (homepageAuthority?.session !== null && homepageAuthority?.session !== undefined) {
      previousAcceptedSnapshot = homepageAuthority.session.snapshot;
    } else if (directAcceptedSession !== null) {
      previousAcceptedSnapshot = directAcceptedSession.snapshot;
    }
    if (homepageAuthority?.beamMetrics !== null && homepageAuthority?.beamMetrics !== undefined) {
      previousHomepageBeamMetrics = homepageAuthority.beamMetrics;
    }
    const acceptedSnapshot = homepageAuthority?.snapshot
      ?? directAcceptedSession?.snapshot
      ?? null;
    const homepageBeamMetrics = homepageAuthority?.beamMetrics ?? null;
    const homepageEeByKey = homepageBeamMetrics === null
      ? null
      : homepageBeamEeNormalizedByKey(homepageBeamMetrics.metrics);
    const homepageIdentityPaletteIndexBySatelliteId = acceptedSnapshot === null
      ? null
      : new Map(
        Object.entries(acceptedSnapshot.plan.identityAllocation.assignments).map(
          ([satelliteId, identity]) => [satelliteId, identity.paletteIndex] as const,
        ),
      );
    const comparisonPolicy = homepageVisualIdentity
      ? resolveMultiCandidateComparisonPolicy({
        acceptedPresentation: acceptedSnapshot,
        simSource: 'live',
        sceneLane: 'sinr-live',
        previousLatch: previousComparisonLatch,
        centralOverlayEnabled: true,
      })
      : null;
    previousComparisonLatch = comparisonPolicy?.nextLatch ?? null;

    // --- satellite cone apexes, by the production projection ----------------
    const satelliteWorldById = new Map<string, WorldPoint>();
    for (const sat of (frame as { satellites: readonly {
      id: string;
      world: { x: number; y: number; z: number };
    }[] }).satellites) {
      satelliteWorldById.set(sat.id, {
        x: sat.world.x * satPosScaleFactor,
        y: sat.world.y * satPosScaleFactor,
        z: sat.world.z * satPosScaleFactor,
      });
    }

    const primaryUeId = cellFrame.primaryUeId ?? PRIMARY_UE_ID;
    const primary: UeCellServingRecord | undefined = cellFrame.ues.find(
      ue => ue.ueId === primaryUeId,
    ) ?? cellFrame.ues[0];

    const resolveIdentityAppearance = (
      satelliteId: string,
      beamId: number,
      isServingOrCandidate = false,
      planColorFor?: (satId: string, beam: number) => string | undefined,
    ): BaseIdentityColorResolution => resolveBaseIdentityColorWithRung(
      satelliteId,
      beamId,
      makeIdentitySources({
        plan: planColorFor ?? null,
        homepageProjection: homepageVisualIdentity
          ? (satId, beam, serving) => homepageSatelliteColorForBeam(satId, beam, {
            identityPaletteIndex: homepageIdentityPaletteIndexBySatelliteId?.get(satId) ?? null,
            eeNormalized: homepageEeByKey?.get(`${satId}:${beam}`),
            isServing: serving,
          }).color
          : null,
        acceptedSnapshot: acceptedSnapshot === null
          ? null
          : (satId, beam) => {
              const published = resolveAcceptedBeamIdentityColor(
                acceptedSnapshot,
                satId,
                beam,
                '',
              );
              return published.length > 0 ? published : undefined;
            },
      }),
      { isServingOrCandidate },
    );
    const resolveIdentityColor = (
      satelliteId: string,
      beamId: number,
      isServingOrCandidate = false,
    ): string => resolveIdentityAppearance(
      satelliteId,
      beamId,
      isServingOrCandidate,
    ).color;
    const homepageIdentityColorFor = homepageBeamIdentityLookup(homepageEeByKey);
    // `resolveMultiCandidateBeamColors` is the production authority-map
    // constructor. Its values are then supplied as the pair lane's rung-0
    // source, exactly as MainScene supplies `beamColorBySatelliteBeam`.
    const authorityBeamColors = resolveMultiCandidateBeamColors({
      sceneInstructions: [],
      authorityDisplayedLinks: acceptedSnapshot?.plan.displayedLinks.map(link => ({
        satelliteId: link.satelliteId,
        beamId: link.beamId,
        isServing: link.isServing,
        isCandidate: link.isCandidate,
      })) ?? [],
      authorityActive: comparisonPolicy?.authorityActive ?? false,
      resolveBeamColor: resolveIdentityColor,
    }).bySatelliteBeam;
    const resolveAuthorityIdentityAppearance = (
      satelliteId: string,
      beamId: number,
      isServingOrCandidate = false,
    ): BaseIdentityColorResolution => resolveIdentityAppearance(
      satelliteId,
      beamId,
      isServingOrCandidate,
      (satId, beam) => authorityBeamColors.get(`${satId}/${beam}`),
    );

    // --- events -------------------------------------------------------------
    const retained = cellFrame.recentHandoverEvents ?? [];
    const newEvents: TimelineEvent[] = [];
    for (const event of retained) {
      const key = eventKey(event);
      if (seenEventKeys.has(key)) continue;
      seenEventKeys.add(key);
      newEvents.push(summarizeEvent(event));
    }

    // --- presentation owner (the production state machine, speed 1) ---------
    const recentPrimaryHandoverEvent = resolveRecentPrimaryHandoverEvent({
      events: retained,
      primaryUeId,
      simTimeSec: cellFrame.simTimeSec,
    });
    const handoverAuthorityJoin = resolveHandoverAuthorityJoin(
      acceptedSnapshot?.decision ?? null,
      acceptedSnapshot?.commit ?? null,
    );
    const authorityHandoverPresentationCandidate = resolveAuthorityPresentationCandidate({
      enabled: comparisonPolicy?.authorityActive ?? false,
      homepageVisualIdentity,
      authorityJoin: handoverAuthorityJoin,
      simSource: 'live',
      hasCellPlacement: cellId => placementByCellId.has(cellId),
      hasSatelliteWorld: satelliteId => satelliteWorldById.has(satelliteId),
      durationMs: {
        intra: homepageVisualIdentity
          ? HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS
          : INTRA_HANDOVER_CINEMA_DISPLAY_MS,
        inter: homepageVisualIdentity
          ? HOMEPAGE_INTER_HANDOVER_DISPLAY_MS
          : INTER_HANDOVER_CINEMA_DISPLAY_MS,
      },
    });
    const presentationCandidate = resolveHandoverPresentationCandidate({
      authority: {
        active: comparisonPolicy?.authorityActive ?? false,
        candidate: authorityHandoverPresentationCandidate,
        centralOverlayActive: comparisonPolicy?.centralOverlayActive ?? false,
        decisionAuthorityPresent: comparisonPolicy?.decisionAuthorityPresent ?? false,
        acceptedPresentation: acceptedSnapshot,
      },
      manual: {
        active: false,
        requested: false,
        displayMs: 0,
        event: null,
        beamRecord: null,
      },
      natural: {
        event: recentPrimaryHandoverEvent,
        source: 'live',
        satelliteWorldById,
      },
      cinema: { ready: false, armed: false, candidate: null, satelliteWorldById },
      placementByCellId,
      durations: {
        naturalIntraMs: HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
        naturalInterMs: HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
        cinemaIntraMs: INTRA_HANDOVER_CINEMA_DISPLAY_MS,
        cinemaInterMs: INTER_HANDOVER_CINEMA_DISPLAY_MS,
      },
      teachingLectureActive: false,
    });
    const advanced = advanceHandoverPresentation(presentationState, {
      nowMs: simTimeSec * MS_PER_SIM_SEC,
      candidate: presentationCandidate,
    });
    presentationState = advanced.state;
    const presentation: HandoverPresentationView = advanced.view
      ?? createIdleHandoverPresentationView();
    const authorityTransitionActive = comparisonPolicy?.authorityActive === true
      && handoverAuthorityJoin?.transition !== null
      && handoverAuthorityJoin?.transition !== undefined
      && presentation.event?.eventId === handoverAuthorityJoin.transition.eventId;

    const displayPolicy = resolveHandoverPresentationDisplayPolicy({
      presentation,
      presentationMode: presentationState.mode,
      manualHandoverActive: false,
      manualHandoverRequested: false,
      handoverCinemaArmed: false,
      handoverCinemaReady: false,
      handoverCinemaKind: null,
      recentAnyInterHandoverEventPresent: false,
      simSource: 'live',
      multiCandidateCentralOverlayActive: comparisonPolicy?.centralOverlayActive ?? false,
      primaryServingRecord: primary ?? null,
      preserveConfiguredServingFan: homepageVisualIdentity,
      teachingLectureActive: false,
      peakOpacity: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
      fallbackSimTimeSec: simTimeSec,
      homepageVisualIdentity,
      multiCandidateIdentityTransitionActive: authorityTransitionActive,
    });
    const geometryPolicy = resolveHomepageSceneGeometryPolicy({
      homepageVisualIdentity,
      candidateReviewActive: comparisonPolicy?.centralOverlayActive ?? false,
      authorityTransitionActive,
      presentationActive: presentation.active,
      presentationSource: presentation.event?.source ?? null,
      presentationKind: presentation.event?.kind ?? null,
      presentationMode: presentationState.mode,
      // MainScene:2468 — the homepage never uses the raw retention-buffer pulse
      // fallback; its natural events go through the normalized wall-clock pair.
      naturalPulseAvailable: !homepageVisualIdentity && recentPrimaryHandoverEvent !== null,
    });

    // --- homepage geometry allow-list ---------------------------------------
    const hero = {
      satId: primary?.servingSatId ?? null,
      cellId: primary?.cellId ?? null,
      beamId: primary?.servingBeamId ?? null,
    };
    const allowedBeamIdentities = homepageVisualIdentity
      ? resolveHomepageSceneBeamVisibility({
        displayHeroRecord: hero.satId === null || hero.cellId === null
          ? null
          : { servingSatId: hero.satId, cellId: hero.cellId, beamId: hero.beamId },
        primaryServingRecord: primary ?? null,
        renderedCandidateSatelliteId: null,
        presentedHandoverPairCandidate: displayPolicy.presentedHandoverPairCandidate,
        handoverPresentationCandidate: presentationCandidate,
        handoverAuthorityJoin,
        cinemaPairCandidate: displayPolicy.presentedHandoverPairCandidate,
        recentPrimaryHandoverEvent,
      })
      : new Set<string>();
    const homepageBeamFanSatelliteIds = new Set<string>(
      hero.satId === null ? [] : [hero.satId],
    );
    const restrict = (items: readonly SinrLiveCellBeamConeRenderItem[]) => (
      restrictHomepageBeamItems(items, {
        homepageVisualIdentity,
        allowedBeamIdentities,
        allowAllBeamSatelliteIds: homepageBeamFanSatelliteIds,
      })
    );

    const targetSatIds = hero.satId === null ? null : new Set([hero.satId]);
    const focusSatIds = resolveServingConeFocusSatIds(
      homepageVisualIdentity,
      DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones,
      targetSatIds,
    );

    // --- the render lanes, as MainScene assembles them ----------------------
    const servingItems = resolveServingConeItems({
      geometry: {
        cellFrame,
        placementByCellId,
        satelliteWorldById,
        focusSatIds,
        frequencyReuse: profile.beams.frequencyReuse,
        servingBeamBudget: SERVING_BEAM_COUNT,
        allowHeroFallback: homepageVisualIdentity,
        budgetServingFan: resolveServingConeBudgetFan(
          homepageVisualIdentity,
          DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones,
        ),
        displayHeroRecord: hero.satId === null || hero.cellId === null
          ? null
          : { servingSatId: hero.satId, cellId: hero.cellId, beamId: hero.beamId },
      },
      presentation: {
        showSinrLiveCellBeams: true,
        renderServingField: geometryPolicy.renderServingField,
        showNonServingCones: DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones,
        hideNormalBeamField: displayPolicy.handoverDisplayIsolation.hideNormalBeamField,
        hidePrimaryServingBeam: displayPolicy.handoverDisplayIsolation.hidePrimaryServingBeam,
        preserveConfiguredServingFan:
          displayPolicy.handoverDisplayIsolation.preserveConfiguredServingFan,
        teachingLectureFieldCleared: false,
        multiCandidateCentralOverlayActive: comparisonPolicy?.centralOverlayActive ?? false,
        homepageVisualIdentity,
        homepageBeamVisibility: allowedBeamIdentities,
        homepageBeamFanSatelliteIds,
        resolveSceneAcceptedBeamColor: resolveIdentityColor,
        restrictHomepageBeamItems: restrict,
      },
    });

    const nonServingItems = DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones
      ? restrict(paintConeItems(
        resolveSinrLiveNonServingConeItems({
          cellFrame,
          placementByCellId,
          satelliteWorldById,
          focusSatIds: resolveNonServingConeFocusSatIds(
            DEFAULT_BEAM_DISPLAY_SPEC.showNonServingCones,
            focusSatIds,
          ),
        }),
        { resolveIdentityColor, prominence: 'candidate' },
      ))
      : [];

    const pulseItems = resolvePulseConeItems({
      policy: {
        enabled: true,
        hideTimelinePulse: displayPolicy.handoverDisplayIsolation.hideTimelinePulse,
        suppressNaturalHandoverLayers:
          displayPolicy.handoverDisplayIsolation.suppressNaturalHandoverLayers,
        renderNaturalPulse: geometryPolicy.renderNaturalPulse,
        homepageVisualIdentity,
        concurrentIntraVisualSuppressed: displayPolicy.concurrentIntraVisualSuppressed,
        showOtherHandoverUes: DEFAULT_BEAM_DISPLAY_SPEC.showOtherHandoverUes,
        pulseFocusFollowsScope: DEFAULT_BEAM_DISPLAY_SPEC.pulseFocusFollowsScope,
      },
      frame: {
        recentHandoverEvents: retained,
        simTimeSec: cellFrame.simTimeSec,
      },
      geometry: {
        placementByCellId,
        satelliteWorldById,
        frequencyReuse: profile.beams.frequencyReuse,
        focusSatIds,
        protagonistUeId: primaryUeId,
      },
      output: {
        resolveSceneAcceptedBeamColor: resolveIdentityColor,
        restrictHomepageBeamItems: restrict,
      },
    });

    const handoverGeometry = {
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      homepageIntraCellAnchor: new Vector3(0, 0, 0),
      manualHandoverGroundTarget: new Vector3(0, 0, 0),
    };
    const envelope = {
      fromOpacity: displayPolicy.presentationHandoverEnvelope.fromOpacity,
      phase: displayPolicy.presentationHandoverEnvelope.phase,
      toOpacity: displayPolicy.presentationHandoverEnvelope.toOpacity,
    };
    const cinemaItems = resolveCinemaPairConeItems({
      policy: {
        enabled: true,
        homepageVisualIdentity,
        renderCinemaPair: geometryPolicy.renderCinemaPair,
        handoverActive: presentation.active,
        presentedInterHandoverActive: displayPolicy.presentedInterHandoverActive,
        presentedCinemaHandoverActive: displayPolicy.presentedCinemaHandoverActive,
        handoverEventKind: presentation.event?.kind ?? null,
      },
      candidate: displayPolicy.presentedHandoverPairCandidate,
      envelope,
      triggeredIntraPeakOpacity: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
      geometry: handoverGeometry,
      output: {
        resolveSceneAcceptedBeamColor: resolveIdentityColor,
        restrictHomepageBeamItems: restrict,
      },
    });
    // The authority lane owns rung 0 when the pure comparison policy says the
    // accepted plan is on stage. Its map is the same map the React scene passes
    // into `handoverConePaintContext`; an absent map entry is still a miss.
    const authorityItems = resolveAuthorityPairConeItems({
      policy: {
        enabled: true,
        centralOverlayActive: comparisonPolicy?.centralOverlayActive ?? false,
        identityTransitionActive: authorityTransitionActive,
        handoverActive: presentation.active,
        homepageVisualIdentity,
        renderAuthorityPair: geometryPolicy.renderAuthorityPair,
        authorityPresentationCommitObserved: commitReceiptMatchesHandoverPresentation(
          acceptedSnapshot?.commit,
          presentation.event,
        ),
      },
      candidate: displayPolicy.presentedHandoverPairCandidate,
      envelope,
      beamColorBySatelliteBeam: authorityBeamColors,
      geometry: handoverGeometry,
      output: {
        resolveSceneAcceptedBeamColor: resolveIdentityColor,
        restrictHomepageBeamItems: restrict,
      },
    });

    const terms = primary?.servingLinkSample?.angleAware as
      | { energyEfficiencyBitsPerJoule?: number; homepageDemoEeBitsPerJoule?: number }
      | undefined;
    const decisionEe = typeof terms?.energyEfficiencyBitsPerJoule === 'number'
      && Number.isFinite(terms.energyEfficiencyBitsPerJoule)
      ? terms.energyEfficiencyBitsPerJoule
      : null;
    const displayEe = typeof terms?.homepageDemoEeBitsPerJoule === 'number'
      && Number.isFinite(terms.homepageDemoEeBitsPerJoule)
      ? terms.homepageDemoEeBitsPerJoule
      : null;

    // Candidate cones are a separate production lane.  MainScene reaches the
    // same pure resolver through useSinrLiveCandidateBeamConeItems; keep the
    // selection/presentation inputs here identical to that call site so a
    // candidate colour, opacity, cap, or role mutation changes this timeline.
    const candidateSelection = selectCandidateConeGeometry({
      presentedHandoverPairCandidate: displayPolicy.presentedHandoverPairCandidate,
      showCinemaCandidateFan: displayPolicy.handoverDisplayIsolation.showCinemaCandidateFan,
      renderedCandidateSatelliteId: primary?.pendingTargetSatId ?? null,
      primaryServingRecord: primary === undefined
        ? null
        : { servingSatId: primary.servingSatId, cellId: primary.cellId },
      candidateDisplayCellFrame: cellFrame,
      cinemaInterDisplayCellFrame: cellFrame,
      normalSatelliteWorldById: satelliteWorldById,
      cinemaSatelliteWorldById: satelliteWorldById,
      placementByCellId,
      frequencyReuse: profile.beams.frequencyReuse,
      maxFanCones: CANDIDATE_BEAM_COUNT,
    });
    const { isInterPresentation: candidateIsInterPresentation, ...candidateGeometry } = candidateSelection;
    const routedCandidateItems = resolveCandidateConeItems({
      geometry: candidateGeometry,
      presentation: {
        candidateComparisonSceneActive: comparisonPolicy?.centralOverlayActive ?? false,
        renderCandidateField: geometryPolicy.renderCandidateField,
        homepageVisualIdentity,
        showSinrLiveCellBeams: true,
        hideCandidateFan: displayPolicy.handoverDisplayIsolation.hideCandidateFan,
        showCinemaCandidateFan: displayPolicy.handoverDisplayIsolation.showCinemaCandidateFan,
        isInterPresentation: candidateIsInterPresentation,
        handoverPhase: envelope.phase,
        handoverToOpacity: envelope.toOpacity,
        candidateFanConeOpacity: DEFAULT_BEAM_DISPLAY_SPEC.candidateFanConeOpacity,
        triggeredIntraPeakOpacity: DEFAULT_BEAM_DISPLAY_SPEC.triggeredIntraPeakOpacity,
        targetRole: presentation.targetRole,
        acceptedHandoverPresentation: acceptedSnapshot,
        restrictHomepageBeamItems: restrict,
      },
    });
    const fallbackCandidateSatId = displayPolicy.presentedHandoverPairCandidate?.toSatId
      ?? presentation.event?.to.satId
      ?? primary?.pendingTargetSatId
      ?? null;
    const fallbackCandidateServingSatId = displayPolicy.presentedHandoverPairCandidate?.fromSatId
      ?? presentation.event?.from.satId
      ?? primary?.servingSatId
      ?? null;
    const fallbackCandidateCellId = displayPolicy.presentedHandoverPairCandidate?.toCellId
      ?? presentation.event?.to.cellId
      ?? primary?.cellId
      ?? null;
    const directCandidateItems = resolveCandidateBeamConeItems({
      pendingTargetSatId: fallbackCandidateSatId,
      servingSatId: fallbackCandidateServingSatId,
      primaryCellId: fallbackCandidateCellId,
      placementByCellId,
      satelliteWorldById,
      frequencyReuse: profile.beams.frequencyReuse,
      cellFrame,
      maxFanCones: DEFAULT_BEAM_DISPLAY_SPEC.candidateFanMaxCones,
    });
    // The routed scene adapter owns the normal lane. During the normalized
    // handover pair the adapter intentionally suppresses the legacy fan, but
    // the same production candidate resolver still owns the candidate readout;
    // retain it in the audit plan so its role/colour/cap decisions remain
    // observable at the exact pair seconds too.
    const paintedDirectCandidateItems = paintConeItems(directCandidateItems, {
      resolveIdentityColor,
      prominence: 'candidate',
    });
    const candidateItems = [
      ...routedCandidateItems,
      ...paintedDirectCandidateItems,
    ].filter((item, index, all) => all.findIndex(candidate => (
      candidate.satId === item.satId
      && candidate.cellId === item.cellId
      && candidate.beamId === item.beamId
      && candidate.role === item.role
    )) === index);

    // The teaching Visual-Lab candidate primary uses the same production
    // geometry contract, including its candidate-primary radius ratio.  It is
    // emitted only when the real candidate lane supplied a primary item; no
    // synthetic candidate or alternate geometry is invented for empty frames.
    const candidatePrimary = candidateItems.find(item => item.role === 'candidatePrimary');
    const candidateGeometryItems: TimelineItem[] = candidatePrimary === undefined
      ? []
      : [{
        id: `candidateGeometry|${candidatePrimary.satId}|${candidatePrimary.cellId}|${candidatePrimary.beamId ?? cellLinkBudgetBeamId(candidatePrimary.cellId)}`,
        kind: 'candidateGeometry',
        layer: 'candidate',
        color: candidatePrimary.color,
        roleColor: candidatePrimary.color,
        identityColor: candidatePrimary.color,
        identityRung: 'surface',
        eeNormalized: null,
        shaded: false,
        opacity: candidatePrimary.opacity ?? 1,
        role: 'candidatePrimary',
        satId: candidatePrimary.satId,
        cellId: candidatePrimary.cellId,
        beamId: candidatePrimary.beamId ?? cellLinkBudgetBeamId(candidatePrimary.cellId),
        frequencyIndex: candidatePrimary.frequencyIndex,
        serving: false,
        displayOnly: candidatePrimary.displayOnly === true,
        renderKey: candidatePrimary.renderKey ?? null,
        apex: { x: candidatePrimary.apex.x, y: candidatePrimary.apex.y, z: candidatePrimary.apex.z },
        baseCenter: { x: candidatePrimary.baseCenter.x, y: candidatePrimary.baseCenter.y, z: candidatePrimary.baseCenter.z },
        baseRadiusWorld: resolveVisualLabBeamRadius({
          active: false,
          role: 'candidatePrimary',
          cellRadiusWorld: placementByCellId.get(candidatePrimary.cellId)?.radiusWorld ?? 0.8,
        }),
        bodyColor: null,
        scale: null,
        mountedColor: null,
        railLabel: null,
        railOpacity: null,
      }];

    // The `isServingOrCandidate` flag each lane passes to the identity ladder is
    // NOT derivable from the finished item — the pair lanes decide their colour
    // before the item exists, and they pass `false` on cones whose `serving`
    // field is `true`. Recording the flag per lane is what lets the unshaded
    // identity colour be recomputed with the SAME inputs the lane used, so a
    // `shaded=YES` means the modifier table fired and never means this tool
    // asked the ladder a different question.
    type ResolveIdentityAppearance = (
      satId: string,
      beamId: number,
      isServingOrCandidate?: boolean,
    ) => BaseIdentityColorResolution;
    const lanes: readonly [
      SinrLiveConeMountLayer,
      readonly SinrLiveCellBeamConeRenderItem[],
      (item: SinrLiveCellBeamConeRenderItem) => boolean,
      ResolveIdentityAppearance,
    ][] = [
      // paintConeItems(..., prominence: 'candidate') -> flag derives to true.
      ['nonServing', nonServingItems, () => true, resolveIdentityAppearance],
      // servingConeItems.ts:65 paints with prominence 'serving' -> true.
      ['serving', servingItems, () => true, resolveIdentityAppearance],
      // useSinrLiveCandidateBeamConeItems -> resolveCandidateConeItems.
      ['candidate', candidateItems, () => true, resolveIdentityAppearance],
      // handoverConeResolvers.ts pulse lane: `isServingOrCandidate: item.kind === 'intra'`.
      ['pulse', pulseItems, item => item.kind === 'intra', resolveIdentityAppearance],
      // handoverConeResolvers.ts cinema pair lane: `isServingOrCandidate: false`.
      ['triggered', cinemaItems, () => false, resolveIdentityAppearance],
      // handoverConeResolvers.ts authority pair lane: `isServingOrCandidate: intra`.
      ['triggered', authorityItems, () => (
        displayPolicy.presentedHandoverPairCandidate?.kind === 'intra'
      ), resolveAuthorityIdentityAppearance],
    ];

    const coneItems = lanes.flatMap(([layer, laneItems, laneServingFlag, laneIdentityAppearance]) => laneItems.map(
      item => finalizeItem(
        layer,
        item,
        placementByCellId,
        palette,
        hero,
        laneIdentityAppearance,
        (satId, beamId) => homepageEeByKey?.get(`${satId}:${beamId}`) ?? null,
        laneServingFlag(item),
        homepageVisualIdentity,
        homepageVisualIdentity ? homepageIdentityColorFor : undefined,
      ),
    ));

    // The candidate rail is a DOM projection, but its public beam label and
    // serving EE opacity are pure production authorities. Keep those values
    // as line-oriented audit items so a rail-only mutation is still visible
    // without pretending that a browser layout is part of this timeline.
    const railOpacity = homepageVisualIdentity
      ? resolveRailServingEeOpacity(
        displayEe,
        eeThresholdKbitPerJouleToBitsPerJoule(DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE),
        0,
        HOMEPAGE_EE_SCALE_MAX_BITS_PER_JOULE,
      )
      : null;
    const railAnchor = coneItems.find(item => item.role === 'candidatePrimary')
      ?? coneItems.find(item => item.role === 'hero')
      ?? null;
    const railPair = displayPolicy.presentedHandoverPairCandidate;
    const railPairItems: TimelineItem[] = railPair === null || railAnchor === null
      ? []
      : [
        { satId: railPair.fromSatId, cellId: railPair.fromCellId, beamId: railPair.fromBeamId },
        { satId: railPair.toSatId, cellId: railPair.toCellId, beamId: railPair.toBeamId },
      ].map((endpoint, index) => {
        const beamId = endpoint.beamId ?? cellLinkBudgetBeamId(endpoint.cellId ?? 0);
        const source = coneItems.find(item => item.satId === endpoint.satId && item.beamId === beamId)
          ?? railAnchor;
        return {
          ...source,
          id: `candidateRail|endpoint|${endpoint.satId}|${beamId}|${index}`,
          kind: 'candidateRail' as const,
          layer: 'candidate' as const,
          cellId: endpoint.cellId,
          beamId,
          shaded: false,
          opacity: railOpacity ?? 0,
          role: 'candidate-rail-endpoint',
          serving: false,
          displayOnly: true,
          renderKey: `candidate-rail-endpoint-${index}`,
          apex: null,
          baseCenter: null,
          baseRadiusWorld: null,
          bodyColor: null,
          scale: null,
          mountedColor: null,
          railLabel: formatHomepageBeamCellLabel(beamId),
          railOpacity,
        };
      });
    const candidateRailItems: TimelineItem[] = homepageVisualIdentity && railAnchor !== null
      ? [
        {
          id: `candidateRail|serving|${railAnchor.satId}|${railAnchor.beamId ?? cellLinkBudgetBeamId(railAnchor.cellId ?? 0)}`,
          kind: 'candidateRail',
          layer: 'candidate',
          color: railAnchor.color,
          roleColor: railAnchor.roleColor,
          identityColor: railAnchor.identityColor,
          identityRung: 'surface',
          eeNormalized: railAnchor.eeNormalized,
          shaded: false,
          opacity: railOpacity ?? 0,
          role: 'candidate-rail-serving',
          satId: railAnchor.satId,
          cellId: railAnchor.cellId,
          beamId: railAnchor.beamId,
          frequencyIndex: railAnchor.frequencyIndex,
          serving: true,
          displayOnly: true,
          renderKey: 'candidate-rail-serving',
          apex: null,
          baseCenter: null,
          baseRadiusWorld: null,
          bodyColor: null,
          scale: null,
          mountedColor: null,
          railLabel: formatHomepageBeamCellLabel(railAnchor.beamId ?? cellLinkBudgetBeamId(railAnchor.cellId ?? 0)),
          railOpacity,
        },
        ...coneItems
          .filter(item => item.layer === 'candidate' && item.beamId !== null)
          .map(item => ({
            id: `candidateRail|candidate|${item.satId}|${item.beamId}|${item.role}`,
            kind: 'candidateRail' as const,
            layer: 'candidate' as const,
            color: item.color,
            roleColor: item.roleColor,
            identityColor: item.identityColor,
            identityRung: 'surface' as const,
            eeNormalized: item.eeNormalized,
            shaded: false,
            opacity: railOpacity ?? 0,
            role: 'candidate-rail-row',
            satId: item.satId,
            cellId: item.cellId,
            beamId: item.beamId,
            frequencyIndex: item.frequencyIndex,
            serving: false,
            displayOnly: true,
            renderKey: `candidate-rail-row-${item.renderKey ?? item.beamId}`,
            apex: null,
            baseCenter: null,
            baseRadiusWorld: null,
            bodyColor: null,
            scale: null,
            mountedColor: null,
            railLabel: formatHomepageBeamCellLabel(item.beamId!),
            railOpacity,
          })),
        ...railPairItems,
      ]
      : [];

    // SatelliteMarker and its scene projection are a separate production path
    // from cone items.  Feed the same resolver a bounded ambient marker list,
    // the production marker-id policy, the identity map, and the cone-apex map.
    // The marker body tint helper is pure and is the exact calculation used by
    // SatelliteMarker's material application; the representative GLB base
    // colour is the canonical helper-validation material colour.
    const markerSeeds = (frame as SimFrame).satellites.slice(0, DEFAULT_MAX_DISPLAY_SATS).map(satellite => ({
      id: satellite.id,
      world: new Vector3(satellite.world.x, satellite.world.y, satellite.world.z),
      satelliteTintColor: resolveSatelliteSurfaceColor(
        satellite.id,
        'marker',
      ),
    }));
    const markerIdentityColors = new Map(
      markerSeeds.map(marker => [marker.id, marker.satelliteTintColor ?? '#aaccff'] as const),
    );
    const markerPair = displayPolicy.presentedHandoverPairCandidate;
    const handoverMarkerSatelliteIds = resolveHandoverMarkerSatelliteIds({
      multiCandidateSceneVisualActive: false,
      multiCandidateCentralMarkerSatelliteIds: null,
      renderedCandidateSatelliteId: primary?.pendingTargetSatId ?? null,
      candidateComparisonSceneActive: comparisonPolicy?.centralOverlayActive ?? false,
      candidateReviewRenderPlanPresent: false,
      candidateComparisonVisibleSatelliteIds: null,
      handoverCinemaCandidate: markerPair === null
        ? null
        : { fromSatId: markerPair.fromSatId, toSatId: markerPair.toSatId },
      authorityTransition: null,
    });
    const renderedMarkers = resolveRenderedLiveSatelliteMarkers({
      displaySats: markerSeeds,
      handoverMarkerSatelliteIds,
      identityColorBySatelliteId: markerIdentityColors,
      coneApexWorldById: satelliteWorldById,
      resolveFallbackColor: satelliteId => resolveSatelliteSurfaceColor(satelliteId, 'marker'),
    });
    const markerItems: TimelineItem[] = renderedMarkers.map(marker => {
      const accent = marker.satelliteTintColor ?? '#aaccff';
      return {
        id: `marker|${marker.id}`,
        kind: 'marker',
        layer: 'marker',
        color: resolveSatelliteTintedColor('#aaccff', accent),
        roleColor: accent,
        identityColor: accent,
        identityRung: 'marker',
        eeNormalized: null,
        shaded: false,
        opacity: 1,
        role: 'marker',
        satId: marker.id,
        cellId: null,
        beamId: null,
        frequencyIndex: null,
        serving: marker.id === hero.satId,
        displayOnly: false,
        renderKey: null,
        apex: { x: marker.world.x, y: marker.world.y, z: marker.world.z },
        baseCenter: null,
        baseRadiusWorld: null,
        bodyColor: resolveSatelliteTintedColor('#aaccff', accent),
        scale: null,
        mountedColor: null,
        railLabel: null,
        railOpacity: null,
      };
    });

    // MainScene first resolves the orbit-trail surface colour and then passes
    // that derived satellite list to OrbitTrail's production plan resolver.
    const orbitTrailPlans = resolveOrbitTrailPlans({
      satellites: markerSeeds.map(marker => ({
        id: marker.id,
        satelliteTintColor: resolveSatelliteSurfaceColor(marker.id, 'orbitTrail'),
      })),
      enabled: true,
      reducedMotion: false,
    });
    const surfaceItems: TimelineItem[] = orbitTrailPlans.map(plan => ({
      id: plan.id,
      kind: 'orbitTrail',
      layer: 'orbitTrail',
      color: plan.color,
      roleColor: plan.color,
      identityColor: markerIdentityColors.get(plan.satelliteId) ?? plan.color,
      identityRung: 'surface',
      eeNormalized: null,
      shaded: plan.color.toLowerCase() !== (markerIdentityColors.get(plan.satelliteId) ?? plan.color).toLowerCase(),
      opacity: plan.opacities[0] ?? 0,
      role: 'orbitTrail',
      satId: plan.satelliteId,
      cellId: null,
      beamId: null,
      frequencyIndex: null,
      serving: plan.satelliteId === hero.satId,
      displayOnly: false,
      renderKey: plan.id,
      apex: null,
      baseCenter: null,
      baseRadiusWorld: null,
      bodyColor: null,
      scale: null,
      mountedColor: null,
      railLabel: null,
      railOpacity: null,
    }));

    // IntraGroundShockwave is mounted from the viz frame.  Its envelope
    // functions are pure, so the audit can resolve the exact source/target
    // colours, opacities, and scales without a renderer or wall clock.
    const shockwaveEvent = (frame as SimFrame).intraHandoverEvent
      ?? (() => {
        const recentIntra = retained.find(event => (
          event.kind === 'intra'
          && event.ueId === primaryUeId
          && event.fromSatId !== null
          && event.fromCellId !== null
          && event.fromBeamId !== null
        ));
        if (recentIntra === undefined || recentIntra.fromSatId === null) return null;
        return {
          satId: recentIntra.toSatId,
          fromBeamId: recentIntra.fromBeamId ?? cellLinkBudgetBeamId(recentIntra.fromCellId ?? 0),
          toBeamId: recentIntra.toBeamId ?? cellLinkBudgetBeamId(recentIntra.toCellId),
          triggeredAtSec: recentIntra.sourceTimeSec,
          expiresAtSec: recentIntra.sourceTimeSec + 1,
          wallClockStartMs: recentIntra.sourceTimeSec * MS_PER_SIM_SEC,
          wallClockExpiresMs: (recentIntra.sourceTimeSec + 1) * MS_PER_SIM_SEC,
        };
      })();
    const shockwaveItems: TimelineItem[] = shockwaveEvent === null
      ? []
      : (() => {
        const colors = resolveIntraGroundShockwaveColors({
          event: shockwaveEvent,
          identityColorBySatelliteId: markerIdentityColors,
          identityColorBySatelliteBeamId: authorityBeamColors,
        });
        const progress = presentation.active && presentation.event?.kind === 'intra'
          ? presentation.progress01
          : 0;
        return [
          {
            id: `shockwave|${shockwaveEvent.satId}|${shockwaveEvent.triggeredAtSec}|source`,
            kind: 'shockwave' as const,
            layer: 'shockwave' as const,
            color: colors.sourceColor,
            roleColor: colors.sourceColor,
            identityColor: colors.sourceColor,
            identityRung: 'shockwave' as const,
            eeNormalized: null,
            shaded: false,
            opacity: sourceOpacityFor(progress),
            role: 'shockwave-source',
            satId: shockwaveEvent.satId,
            cellId: null,
            beamId: shockwaveEvent.fromBeamId,
            frequencyIndex: null,
            serving: false,
            displayOnly: false,
            renderKey: 'source',
            apex: null,
            baseCenter: null,
            baseRadiusWorld: null,
            bodyColor: null,
            scale: sourceScaleFor(progress),
            mountedColor: null,
            railLabel: null,
            railOpacity: null,
          },
          {
            id: `shockwave|${shockwaveEvent.satId}|${shockwaveEvent.triggeredAtSec}|target`,
            kind: 'shockwave' as const,
            layer: 'shockwave' as const,
            color: colors.targetColor,
            roleColor: colors.targetColor,
            identityColor: colors.targetColor,
            identityRung: 'shockwave' as const,
            eeNormalized: null,
            shaded: false,
            opacity: targetOpacityFor(progress),
            role: 'shockwave-target',
            satId: shockwaveEvent.satId,
            cellId: null,
            beamId: shockwaveEvent.toBeamId,
            frequencyIndex: null,
            serving: false,
            displayOnly: false,
            renderKey: 'target',
            apex: null,
            baseCenter: null,
            baseRadiusWorld: null,
            bodyColor: null,
            scale: targetScaleFor(progress),
            mountedColor: null,
            railLabel: null,
            railOpacity: null,
          },
        ];
      })();

    const items = [
      ...candidateGeometryItems,
      ...coneItems,
      ...candidateRailItems,
      ...markerItems,
      ...surfaceItems,
      ...shockwaveItems,
    ].sort(compareItems);

    return {
      simTimeSec,
      serving: {
        ueId: primary?.ueId ?? null,
        satId: hero.satId,
        cellId: hero.cellId,
        beamId: hero.beamId,
        sinrDb: primary?.sinrDb ?? null,
      },
      ee: {
        decisionEeBitsPerJoule: decisionEe,
        displayEeBitsPerJoule: displayEe,
        diverges: decisionEe !== null && displayEe !== null && decisionEe !== displayEe,
      },
      presentation: {
        active: presentation.active,
        kind: presentation.event?.kind ?? null,
        source: presentation.event?.source ?? null,
        phase: presentation.phase,
        progress01: presentation.progress01,
        fromOpacity: envelope.fromOpacity,
        toOpacity: envelope.toOpacity,
        eventId: presentation.event?.eventId ?? null,
        geometryOwner: geometryPolicy.owner,
      },
      newEvents,
      retainedEvents: retained.map(summarizeEvent),
      items,
    };
  }

  const header = [
    `tool                = ${TOOL}`,
    `surface             = ${options.surface} (homepageVisualIdentity=${String(homepageVisualIdentity)})`,
    `profile             = ${profile.id}`,
    `epochUtcMs          = ${EPOCH_UTC_MS} (${new Date(EPOCH_UTC_MS).toISOString()})`,
    `simStepSec          = ${STEP_SEC}`,
    `ueCount             = ${UE_COUNT}  primaryUe=${PRIMARY_UE_ID}`,
    `primaryJogKm        = east ${HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM.east}, north ${HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM.north}`,
    `servingBeamCount    = ${SERVING_BEAM_COUNT}  candidateBeamCount=${CANDIDATE_BEAM_COUNT}`,
    `eeThresholdKbitPerJ = ${DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE}`,
    `worldUnitsPerKm     = ${num(worldUnitsPerKm, 6)}  satPosScaleFactor=${num(satPosScaleFactor, 6)}`,
    `renderGeometry      = coneSegments=${SINR_LIVE_CONE_SEGMENTS} baseVertexAlpha=${num(SINR_LIVE_CONE_BASE_ALPHA_FACTOR)} footprintRingYLift=${num(SINR_LIVE_FOOTPRINT_RING_Y_LIFT)} minRenderElevationDeg=${num(MIN_RENDER_ELEVATION_DEG, 1)}`,
    `renderTiming        = homepageIntraMs=${HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS} homepageInterMs=${HOMEPAGE_INTER_HANDOVER_DISPLAY_MS} intraCinemaMs=${INTRA_HANDOVER_CINEMA_DISPLAY_MS} interCinemaMs=${INTER_HANDOVER_CINEMA_DISPLAY_MS} intraPhase=${HANDOVER_CONE_PHASE_END.serving},${HANDOVER_CONE_PHASE_END.measuring},${HANDOVER_CONE_PHASE_END.holding},${HANDOVER_CONE_PHASE_END.releasing} interPhase=${INTER_HANDOVER_CINEMA_PHASE_END.serving},${INTER_HANDOVER_CINEMA_PHASE_END.measuring},${INTER_HANDOVER_CINEMA_PHASE_END.holding},${INTER_HANDOVER_CINEMA_PHASE_END.releasing}`,
    `presentationClock   = simTimeSec * ${MS_PER_SIM_SEC} ms (playback speed 1)`,
  ];

  return {
    header,
    at(sec: number): TimelineSecond {
      if (sec < lastSec) {
        throw new Error(`[${TOOL}] the timeline only advances; asked for t=${sec} after t=${lastSec}`);
      }
      while (state.simTimeSec < sec - 1e-9) {
        const deltaSec = Math.min(STEP_SEC, sec - state.simTimeSec);
        const result = stepFrame(false, deltaSec);
        rawFrame = result.frame;
        attachSinrLiveCellFrame(
          rawFrame as never,
          model,
          (rawFrame as { simTimeSec: number }).simTimeSec - result.previousSimTimeSec,
        );
        // Every intermediate second must be resolved too: the presentation
        // owner is a STATE MACHINE, so skipping a second would change what it
        // reports later. This is why the tool is a timeline and not a sampler.
        lastSec = (rawFrame as { simTimeSec: number }).simTimeSec;
        if (lastSec < sec - 1e-9) resolvePlan(rawFrame);
      }
      lastSec = sec;
      return resolvePlan(rawFrame);
    },
  };
}

function finalizeItem(
  layer: SinrLiveConeMountLayer,
  item: SinrLiveCellBeamConeRenderItem,
  placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>,
  palette: SinrLiveConePalette,
  hero: { readonly satId: string | null; readonly cellId: number | null; readonly beamId: number | null },
  resolveIdentityAppearance: (
    satId: string,
    beamId: number,
    isServingOrCandidate?: boolean,
  ) => BaseIdentityColorResolution,
  resolveEeNormalized: (satId: string, beamId: number) => number | null,
  laneIsServingOrCandidate: boolean,
  homepageIdentity: boolean,
  homepageColorFor: ((satId: string, beamId: number, isServingOrCandidate?: boolean) => string) | undefined,
): TimelineItem {
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
  const roleStyle = resolveSinrLiveConeDisplayStyle(role, palette, item, 'semantic-role');
  const style = resolveSinrLiveConeDisplayStyle(role, palette, item, 'item-identity');
  const placement = placementByCellId.get(item.cellId);
  if (placement === undefined) {
    throw new Error(`[${TOOL}] missing placement for rendered cell ${item.cellId}`);
  }
  const apparentElevationDeg = (Math.atan2(
    item.apex.y - item.baseCenter.y,
    Math.hypot(item.apex.x - item.baseCenter.x, item.apex.z - item.baseCenter.z),
  ) * 180) / Math.PI;
  const opacity = style.opacity * (
    shouldDimSinrLiveConeRole(
      role,
      layer === 'serving' || layer === 'candidate'
        ? DEFAULT_BEAM_DISPLAY_SPEC.elevationDimEnabled
        : false,
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
  // The SAME identity lookup the lane used, with NO handover row applied. When
  // this differs from `style.color`, the modifier table fired on this item.
  const identity = resolveIdentityAppearance(item.satId, beamId, laneIsServingOrCandidate);
  const identityColor = identity.color;
  const primaryIdentityBeam = resolvePrimaryIdentityBeam({
    surface: 'cone',
    isPrimaryServing: item.satId === hero.satId
      && item.cellId === hero.cellId
      && (hero.beamId === null || beamId === hero.beamId),
    role,
  });
  const mountedColor = resolveMountedConeColor({
    item,
    roleColor: roleStyle.color,
    homepageIdentity,
    primaryIdentityBeam,
    homepageColorFor,
  });
  return {
    id: `${layer}|${item.satId}|${item.cellId}|${beamId}|${role}|${item.renderKey ?? ''}`,
    kind: 'cone',
    layer,
    color: style.color,
    roleColor: roleStyle.color,
    identityColor,
    identityRung: identity.rung,
    eeNormalized: resolveEeNormalized(item.satId, beamId),
    shaded: style.color.toLowerCase() !== identityColor.toLowerCase(),
    opacity,
    role,
    satId: item.satId,
    cellId: item.cellId,
    beamId,
    frequencyIndex: item.frequencyIndex,
    serving: item.serving,
    displayOnly: item.displayOnly === true,
    renderKey: item.renderKey ?? null,
    apex: { x: item.apex.x, y: item.apex.y, z: item.apex.z },
    baseCenter: { x: item.baseCenter.x, y: item.baseCenter.y, z: item.baseCenter.z },
    baseRadiusWorld: placement.radiusWorld * DEFAULT_BEAM_DISPLAY_SPEC.coneWidthScale,
    bodyColor: null,
    scale: null,
    mountedColor,
    railLabel: null,
    railOpacity: null,
  };
}

// ---------------------------------------------------------------------------
// Rendering the answer.
// ---------------------------------------------------------------------------
function itemLine(item: TimelineItem): string {
  return [
    `  ${item.layer.padEnd(10)}`,
    `kind=${item.kind}`,
    `${item.role.padEnd(15)}`,
    `${item.satId.padEnd(22)}`,
    `cell=${String(item.cellId ?? '-').padStart(2)}`,
    `beam=${String(item.beamId ?? '-').padStart(2)}`,
    `freq=${String(item.frequencyIndex ?? '-').padStart(2)}`,
    `color=${item.color}`,
    `roleColor=${item.roleColor}`,
    `identity=${item.identityColor}`,
    `rung=${item.identityRung}`,
    `eeNorm=${item.eeNormalized === null ? '-' : num(item.eeNormalized)}`,
    `shaded=${item.shaded ? 'YES' : 'no '}`,
    `opacity=${num(item.opacity)}`,
    `serving=${item.serving ? 'Y' : 'n'}`,
    `displayOnly=${item.displayOnly ? 'Y' : 'n'}`,
    `apex=${item.apex === null ? '-' : point(item.apex)}`,
    `base=${item.baseCenter === null ? '-' : point(item.baseCenter)}`,
    `r=${item.baseRadiusWorld === null ? '-' : num(item.baseRadiusWorld, 3)}`,
    `body=${item.bodyColor ?? '-'}`,
    `scale=${item.scale === null ? '-' : num(item.scale, 3)}`,
    `mounted=${item.mountedColor ?? '-'}`,
    `railLabel=${item.railLabel ?? '-'}`,
    `railOpacity=${item.railOpacity === null ? '-' : num(item.railOpacity)}`,
    `key=${item.renderKey ?? '-'}`,
  ].join(' ');
}

function eventLine(event: TimelineEvent): string {
  return `  t=${String(event.sourceTimeSec).padStart(6)} ${event.kind.toUpperCase().padEnd(5)}`
    + ` ue=${event.ueId}`
    + ` ${event.fromSatId ?? '-'}#cell${event.fromCellId ?? '-'}/beam${event.fromBeamId ?? '-'}`
    + ` -> ${event.toSatId}#cell${event.toCellId}/beam${event.toBeamId ?? '-'}`;
}

function printAt(second: TimelineSecond, lines: string[]): void {
  lines.push(`=== RENDER PLAN AT t=${second.simTimeSec}s ===`);
  lines.push(
    `SERVING   ue=${second.serving.ueId ?? '-'}`
    + ` sat=${second.serving.satId ?? '-'}`
    + ` cell=${second.serving.cellId ?? '-'}`
    + ` beam=${second.serving.beamId ?? '-'}`
    + ` sinrDb=${second.serving.sinrDb === null ? '-' : num(second.serving.sinrDb, 3)}`,
  );
  lines.push(
    `EE        decision(raw formula, drives the threshold)=`
    + `${second.ee.decisionEeBitsPerJoule === null ? '-' : num(second.ee.decisionEeBitsPerJoule, 1)} bit/J`
    + `  display(homepage projection, what the rail SHOWS)=`
    + `${second.ee.displayEeBitsPerJoule === null ? '-' : num(second.ee.displayEeBitsPerJoule, 1)} bit/J`
    + `  ${second.ee.diverges ? '<-- DISPLAY-ONLY VALUE DIVERGES FROM DECISION VALUE' : '(agree)'}`,
  );
  lines.push(
    `HANDOVER  active=${second.presentation.active ? 'YES' : 'no'}`
    + ` kind=${second.presentation.kind ?? '-'}`
    + ` source=${second.presentation.source ?? '-'}`
    + ` phase=${second.presentation.phase ?? '-'}`
    + ` progress01=${num(second.presentation.progress01)}`
    + ` fromOpacity=${num(second.presentation.fromOpacity)}`
    + ` toOpacity=${num(second.presentation.toOpacity)}`
    + ` owner=${second.presentation.geometryOwner}`,
  );
  lines.push(`          eventId=${second.presentation.eventId ?? '-'}`);
  lines.push(`EVENTS committed at this second: ${second.newEvents.length}`);
  for (const event of second.newEvents) lines.push(eventLine(event));
  lines.push(`EVENTS retained in the display window: ${second.retainedEvents.length}`);
  for (const event of second.retainedEvents) lines.push(eventLine(event));
  lines.push(`ITEMS ${second.items.length}`);
  for (const item of second.items) lines.push(itemLine(item));
}

const DIFFED_FIELDS = [
  'kind', 'layer', 'color', 'roleColor', 'identityColor', 'identityRung', 'eeNormalized', 'shaded', 'opacity', 'role', 'satId',
  'cellId', 'beamId', 'frequencyIndex', 'serving', 'displayOnly', 'renderKey', 'mountedColor', 'railLabel', 'railOpacity',
] as const;

function formatFieldValue(value: unknown): string {
  if (typeof value === 'number') return num(value);
  return String(value);
}

function printDiff(before: TimelineSecond, after: TimelineSecond, lines: string[]): void {
  lines.push(`=== DIFF t=${before.simTimeSec}s -> t=${after.simTimeSec}s ===`);
  const changedTop: string[] = [];
  const compareTop = (label: string, left: unknown, right: unknown): void => {
    if (formatFieldValue(left) !== formatFieldValue(right)) {
      changedTop.push(`  ${label}: ${formatFieldValue(left)} -> ${formatFieldValue(right)}`);
    }
  };
  compareTop('serving.satId', before.serving.satId, after.serving.satId);
  compareTop('serving.cellId', before.serving.cellId, after.serving.cellId);
  compareTop('serving.beamId', before.serving.beamId, after.serving.beamId);
  compareTop('serving.sinrDb', before.serving.sinrDb, after.serving.sinrDb);
  compareTop('ee.decision', before.ee.decisionEeBitsPerJoule, after.ee.decisionEeBitsPerJoule);
  compareTop('ee.display', before.ee.displayEeBitsPerJoule, after.ee.displayEeBitsPerJoule);
  compareTop('handover.active', before.presentation.active, after.presentation.active);
  compareTop('handover.kind', before.presentation.kind, after.presentation.kind);
  compareTop('handover.phase', before.presentation.phase, after.presentation.phase);
  compareTop('handover.progress01', before.presentation.progress01, after.presentation.progress01);
  compareTop('handover.fromOpacity', before.presentation.fromOpacity, after.presentation.fromOpacity);
  compareTop('handover.toOpacity', before.presentation.toOpacity, after.presentation.toOpacity);
  compareTop('handover.eventId', before.presentation.eventId, after.presentation.eventId);
  compareTop('handover.owner', before.presentation.geometryOwner, after.presentation.geometryOwner);
  lines.push(`STATE CHANGES: ${changedTop.length}`);
  lines.push(...changedTop);

  const beforeById = new Map(before.items.map(item => [item.id, item]));
  const afterById = new Map(after.items.map(item => [item.id, item]));
  const added = after.items.filter(item => !beforeById.has(item.id));
  const removed = before.items.filter(item => !afterById.has(item.id));
  const changed: string[] = [];
  for (const item of after.items) {
    const previous = beforeById.get(item.id);
    if (previous === undefined) continue;
    const fieldDiffs: string[] = [];
    for (const field of DIFFED_FIELDS) {
      const left = formatFieldValue(previous[field]);
      const right = formatFieldValue(item[field]);
      if (left !== right) fieldDiffs.push(`${field}: ${left} -> ${right}`);
    }
    for (const geo of ['apex', 'baseCenter'] as const) {
      const left = optionalPoint(previous[geo]);
      const right = optionalPoint(item[geo]);
      if (left !== right) fieldDiffs.push(`${geo}: ${left} -> ${right}`);
    }
    if (optionalNum(previous.baseRadiusWorld, 3) !== optionalNum(item.baseRadiusWorld, 3)) {
      fieldDiffs.push(`baseRadiusWorld: ${optionalNum(previous.baseRadiusWorld, 3)} -> ${optionalNum(item.baseRadiusWorld, 3)}`);
    }
    if (fieldDiffs.length > 0) {
      changed.push(`  ~ ${item.id}`);
      for (const diff of fieldDiffs) changed.push(`      ${diff}`);
    }
  }
  lines.push(`ITEMS ADDED: ${added.length}`);
  for (const item of added) lines.push(`  + ${itemLine(item).trimStart()}`);
  lines.push(`ITEMS REMOVED: ${removed.length}`);
  for (const item of removed) lines.push(`  - ${itemLine(item).trimStart()}`);
  lines.push(`ITEMS CHANGED: ${changed.filter(line => line.startsWith('  ~')).length}`);
  lines.push(...changed);
}

interface VisibleChange {
  readonly sec: number;
  readonly reasons: readonly string[];
  readonly intraCommits: number;
  readonly interCommits: number;
}

function detectChanges(before: TimelineSecond, after: TimelineSecond): VisibleChange {
  const reasons: string[] = [];
  // Only the PROTAGONIST UE's handovers reach the homepage presentation owner
  // and the pulse lane; the other 99 UEs hand over constantly and are counted
  // separately so a reader is never told the screen changed when it did not.
  const primaryUeId = after.serving.ueId;
  const primaryCommits = after.newEvents.filter(event => event.ueId === primaryUeId);
  const otherCommits = after.newEvents.filter(event => event.ueId !== primaryUeId);
  for (const event of primaryCommits) reasons.push(`handover-commit:${event.kind}`);
  if (otherCommits.length > 0) reasons.push(`other-ue-commits:${otherCommits.length}`);
  if (before.serving.satId !== after.serving.satId) reasons.push('serving-satellite-change');
  if (before.serving.beamId !== after.serving.beamId) reasons.push('serving-beam-change');
  if (before.presentation.active !== after.presentation.active) {
    reasons.push(after.presentation.active ? 'presentation-start' : 'presentation-end');
  }
  if (before.presentation.phase !== after.presentation.phase) {
    reasons.push(`presentation-phase:${before.presentation.phase ?? '-'}->${after.presentation.phase ?? '-'}`);
  }
  const beforeById = new Map(before.items.map(item => [item.id, item]));
  const afterById = new Map(after.items.map(item => [item.id, item]));
  let appeared = 0;
  let disappeared = 0;
  let colorChanges = 0;
  let opacityChanges = 0;
  let geometryChanges = 0;
  for (const item of after.items) {
    const previous = beforeById.get(item.id);
    if (previous === undefined) { appeared += 1; continue; }
    if (previous.color !== item.color) colorChanges += 1;
    if (num(previous.opacity) !== num(item.opacity)) opacityChanges += 1;
    if (optionalPoint(previous.apex) !== optionalPoint(item.apex) || optionalPoint(previous.baseCenter) !== optionalPoint(item.baseCenter)) {
      geometryChanges += 1;
    }
  }
  for (const item of before.items) if (!afterById.has(item.id)) disappeared += 1;
  if (appeared > 0) reasons.push(`cone-appeared:${appeared}`);
  if (disappeared > 0) reasons.push(`cone-disappeared:${disappeared}`);
  if (colorChanges > 0) reasons.push(`color-changed:${colorChanges}`);
  if (opacityChanges > 0) reasons.push(`opacity-changed:${opacityChanges}`);
  if (geometryChanges > 0) reasons.push(`geometry-changed:${geometryChanges}`);
  return {
    sec: after.simTimeSec,
    reasons,
    intraCommits: primaryCommits.filter(event => event.kind === 'intra').length,
    interCommits: primaryCommits.filter(event => event.kind === 'inter').length,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseRange(text: string): { from: number; to: number } {
  const match = /^(-?\d+)\.\.(-?\d+)$/.exec(text.trim());
  if (match === null) throw new Error(`[${TOOL}] expected a range like 0..600, received "${text}"`);
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (to < from) throw new Error(`[${TOOL}] range end ${to} precedes start ${from}`);
  return { from, to };
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => {
    if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
      return Object.fromEntries(
        Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => compareText(a, b)),
      );
    }
    return inner;
  }, 2);
}

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const surface: Surface = argValue(argv, '--surface') === 'scene' ? 'scene' : 'homepage';
  const startedAt = process.hrtime.bigint();
  const lines: string[] = [];
  let payload: unknown = null;

  const atArg = argValue(argv, '--at');
  const diffArg = argValue(argv, '--diff');
  const eventsArg = argValue(argv, '--events');
  const watchArg = argValue(argv, '--watch');

  if (atArg === undefined && diffArg === undefined && eventsArg === undefined && watchArg === undefined) {
    console.log(`[${TOOL}] usage:`);
    console.log('  --at <sec>                     the complete render plan at that sim second');
    console.log('  --diff <a>,<b>                 what changed on screen between two seconds');
    console.log('  --events <a>..<b> [--only-discrete]  every second at which something visible changes');
    console.log('  --watch <field> --range <a>..<b> [--item <id-substring>]');
    console.log('                                 track one field across time (color|opacity|visibility)');
    console.log('  --surface homepage|scene       which identity surface (default homepage)');
    console.log('  --json                         machine-readable output, sorted keys');
    process.exitCode = 2;
    return;
  }

  const driver = createDriver({ surface });
  lines.push(...driver.header.map(line => `# ${line}`));

  if (atArg !== undefined) {
    const sec = Number(atArg);
    if (!Number.isFinite(sec) || sec < 0) throw new Error(`[${TOOL}] --at needs a non-negative second`);
    const second = driver.at(sec);
    payload = second;
    printAt(second, lines);
  } else if (diffArg !== undefined) {
    const parts = diffArg.split(',').map(part => Number(part.trim()));
    if (parts.length !== 2 || parts.some(part => !Number.isFinite(part))) {
      throw new Error(`[${TOOL}] --diff needs two seconds, e.g. --diff 86,90`);
    }
    const [left, right] = parts as [number, number];
    if (right < left) throw new Error(`[${TOOL}] --diff needs the earlier second first`);
    const before = driver.at(left);
    const after = driver.at(right);
    payload = { before, after };
    printDiff(before, after, lines);
  } else if (eventsArg !== undefined) {
    const { from, to } = parseRange(eventsArg);
    // Satellites move every second, so cone apexes and elevation-dimmed
    // opacities drift on EVERY second of a live route. That is a real visible
    // change and is reported, but it buries the discrete ones; --only-discrete
    // keeps the seconds where something appeared, vanished, recoloured, or a
    // handover/phase boundary was crossed.
    const onlyDiscrete = argv.includes('--only-discrete');
    const DRIFT_ONLY = /^(geometry-changed|opacity-changed|other-ue-commits):/;
    const changes: VisibleChange[] = [];
    let previous = driver.at(from);
    for (let sec = from + 1; sec <= to; sec += 1) {
      const current = driver.at(sec);
      const change = detectChanges(previous, current);
      const discrete = change.reasons.some(reason => !DRIFT_ONLY.test(reason));
      if (change.reasons.length > 0 && (!onlyDiscrete || discrete)) changes.push(change);
      previous = current;
    }
    const intraSeconds = changes.filter(change => change.intraCommits > 0).map(change => change.sec);
    const interSeconds = changes.filter(change => change.interCommits > 0).map(change => change.sec);
    payload = { from, to, changes, intraSeconds, interSeconds };
    lines.push(`=== VISIBLE CHANGES IN t=${from}..${to}s ===`);
    lines.push(`seconds scanned            = ${to - from}`);
    lines.push(`seconds with a change      = ${changes.length}`);
    lines.push(`INTRA handover commits     = ${intraSeconds.length}  at t=[${intraSeconds.join(', ')}]   (primary UE only)`);
    lines.push(`INTER handover commits     = ${interSeconds.length}  at t=[${interSeconds.join(', ')}]   (primary UE only)`);
    if (intraSeconds.length === 0) {
      lines.push('NOTE: zero INTRA commits in this range. An empty result is not proof of absence —');
      lines.push('      widen the range or run the positive control in the report.');
    }
    if (interSeconds.length === 0) {
      lines.push('NOTE: zero INTER commits in this range. Same caveat.');
    }
    for (const change of changes) {
      lines.push(`  t=${String(change.sec).padStart(6)}  ${change.reasons.join(' ')}`);
    }
  } else if (watchArg !== undefined) {
    const field = watchArg;
    if (!['color', 'opacity', 'visibility'].includes(field)) {
      throw new Error(`[${TOOL}] --watch takes color, opacity or visibility; received "${field}"`);
    }
    const rangeArg = argValue(argv, '--range');
    if (rangeArg === undefined) throw new Error(`[${TOOL}] --watch needs --range <a>..<b>`);
    const { from, to } = parseRange(rangeArg);
    const itemFilter = argValue(argv, '--item') ?? '';
    const trajectory: { sec: number; id: string; value: string }[] = [];
    for (let sec = from; sec <= to; sec += 1) {
      const second = driver.at(sec);
      const matching = second.items.filter(item => item.id.includes(itemFilter));
      if (field === 'visibility') {
        for (const item of matching) trajectory.push({ sec, id: item.id, value: 'present' });
      } else {
        for (const item of matching) {
          trajectory.push({
            sec,
            id: item.id,
            value: field === 'color' ? item.color : num(item.opacity),
          });
        }
      }
    }
    const byId = new Map<string, { sec: number; value: string }[]>();
    for (const entry of trajectory) {
      const list = byId.get(entry.id) ?? [];
      list.push({ sec: entry.sec, value: entry.value });
      byId.set(entry.id, list);
    }
    payload = { field, from, to, itemFilter, byId: Object.fromEntries(byId) };
    lines.push(`=== WATCH ${field} OVER t=${from}..${to}s ${itemFilter === '' ? '(all items)' : `(items matching "${itemFilter}")`} ===`);
    lines.push(`items tracked = ${byId.size}`);
    if (byId.size === 0) {
      lines.push('NOTE: no item matched. An empty result is not proof of absence — check the');
      lines.push('      --item filter against an --at listing for one of these seconds.');
    }
    for (const id of [...byId.keys()].sort(compareText)) {
      const samples = byId.get(id)!;
      lines.push(`  ${id}`);
      let runStart = samples[0]!.sec;
      let runValue = samples[0]!.value;
      let runPrevSec = samples[0]!.sec;
      const flush = (endSec: number): void => {
        lines.push(`      t=${runStart}..${endSec}  ${field}=${runValue}`);
      };
      for (let index = 1; index < samples.length; index += 1) {
        const sample = samples[index]!;
        if (sample.value !== runValue || sample.sec !== runPrevSec + 1) {
          flush(runPrevSec);
          runStart = sample.sec;
          runValue = sample.value;
        }
        runPrevSec = sample.sec;
      }
      flush(runPrevSec);
    }
  }

  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  // Wall time goes to stderr in BOTH modes so the payload stays byte-identical
  // across runs. A timing number inside the document would make every machine
  // comparison fail for the one reason that is never interesting — and machine
  // comparison (diff two seconds, sha256 two runs) is what this tool is for.
  // This reasoning was already written here but applied only to the JSON
  // branch; the text branch printed wall to stdout, so three runs of the same
  // query produced three different hashes with identical content.
  if (json) {
    console.log(sortedJson({ tool: TOOL, header: driver.header, result: payload }));
  } else {
    for (const line of lines) console.log(line);
  }
  console.error(`# wall=${elapsedMs.toFixed(0)}ms`);
}

main();
