/**
 * showcaseArtifactToScene — the single enforcement seam (R1/R2).
 *
 * Rationale (SDD §3 Q7, §4 D2/D3, §3 Q5 C1 split):
 *   This is the ONLY module allowed to read raw `visual-showcase-v1` shape
 *   and emit a `NormalizedSceneFrame`. The renderer never sees the wire
 *   format, so it cannot reinvent producer truth.
 *
 *   Per C1 (SDD §3 Q5), role / event / progress derivation happens here on
 *   the replay path — not in `useBeamViz`. The renderer consumes pre-derived
 *   tokens (`eventRoles`, `transitionProgress`, `handover.kind`).
 *
 * What this module is allowed to do:
 *   - call `coordToWorld` for positions
 *   - read `handoverState`, `phase`, `sourceHandoverOccurred`,
 *     `beams[].role` from the timeline frame
 *   - read producer truth from `truthOwnership` / `diagnostics` / `entities`
 *   - synthesise display-only role tokens from those signals
 *
 * What this module is FORBIDDEN to do (R1):
 *   - recompute SINR / SNR
 *   - reclassify handover by ID comparison (the producer's `kind` always wins)
 *   - re-derive positions (no Earth-rotation compensation for the ECI proxy)
 *   - synthesise a fake `Profile` for `useBeamViz`
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`.
 *
 * P1d: `useBeamViz` now consumes `NormalizedSceneFrame + SceneGeometry`. The
 * C1 split is complete on both paths — live and replay produce the same
 * normalized shape. `computeApproachPreviews` was refactored to consume
 * `frame + geometry + beamHoppingConfig`; the replay path leaves
 * `frame.beamHopping.enabled` undefined and the function returns an empty
 * result (approach previews remain a live-only feature).
 */

import { makeChannelMetricValue, type ChannelMetricValue } from '../scene/ChannelMetricValue';
import type {
  EventRole,
  NormalizedBeam,
  NormalizedBeamHopping,
  NormalizedEventRoleMaps,
  NormalizedHandover,
  NormalizedLink,
  NormalizedMetrics,
  NormalizedPendingTarget,
  NormalizedRecentHo,
  NormalizedSatellite,
  NormalizedSceneFrame,
  NormalizedUe,
  NormalizedUeDecision,
  TransitionProgress,
  WorldPos,
} from '../scene/NormalizedSceneFrame';
import {
  isReplaySceneGeometry,
  sceneGeometryFromFullArtifact,
  type SceneGeometry,
} from '../scene/SceneGeometry';
import { FOOTPRINT_RADIUS_WORLD } from '../scene/beam-geometry-pure';
import { EARTH_KM_PER_DEG } from '../engine/orbit/earth-constants';
import type {
  VisualShowcaseArtifact,
  VisualShowcaseBeamRole,
  VisualShowcaseBeamSample,
  VisualShowcaseChannelMetricKind,
  VisualShowcaseCoordinateFrameKind,
  VisualShowcaseDecisionFrame,
  VisualShowcaseHandoverState,
  VisualShowcaseSatelliteSample,
  VisualShowcaseTimelineFrame,
  VisualShowcaseUeSample,
} from '../scene/visual-showcase-contract';
import { coordToWorld } from './coordToWorld';

// ---------------------------------------------------------------------------
// Role-token derivation (Q5 C1 binding — replay side)
// ---------------------------------------------------------------------------

/**
 * Map producer `beams[].role` directly to the renderer's `EventRole` token.
 * Producer's `'context'` collapses to `'inactive'` because the renderer's
 * token table has no `'context'` slot today.
 */
function mapProducerBeamRoleToEventRole(role: VisualShowcaseBeamRole): EventRole {
  switch (role) {
    case 'serving':
      return 'serving';
    case 'prepared':
      return 'prepared';
    case 'post-ho':
      return 'post-ho';
    case 'secondary':
      return 'secondary';
    case 'inactive':
      return 'inactive';
    case 'context':
      // Display-only fallback — no semantic re-derivation.
      return 'inactive';
    default: {
      const _exhaustive: never = role;
      throw new Error(`[showcaseArtifactToScene] unknown beam role: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Transition progress (Q7 binding)
// ---------------------------------------------------------------------------

/**
 * Producer truth gives `phase` (string) per frame. We synthesise a coarse
 * `progress01` value from the phase token (display only). The renderer must
 * NOT re-derive progress from any other source on the replay path.
 *
 * Known phase tokens we encode here are the ones present in the contract
 * surface (`'idle'`, `'preparing'`, `'committed'`, etc. are producer-defined).
 * Unknown values map to `0.5` — explicitly mid-transition, surfaced as such
 * to the renderer.
 */
function phaseToProgress01(phase: string): number {
  switch (phase) {
    case 'idle':
    case 'none':
    case 'completed':
      return 0;
    case 'preparing':
    case 'arming':
      return 0.25;
    case 'dual-active':
      return 0.5;
    case 'committing':
    case 'committed':
      return 0.85;
    default:
      return 0.5;
  }
}

function deriveTransitionProgress(
  hs: VisualShowcaseHandoverState,
  tSec: number,
): TransitionProgress {
  const kind = hs.kind ?? '';
  if (kind === 'none' || kind === '' || hs.sourceHandoverOccurred === false) {
    return {};
  }

  const progress01 = phaseToProgress01(hs.phase);
  // expiresAtSec is producer-unknown at this scope; we set it to tSec + 1s as
  // a display-only placeholder. The renderer must not treat this as truth.
  // TODO P3: producer truth-of-transition-duration would land in
  // `events[]` correlation — wired when playback lands.
  const expiresAtSec = tSec + 1;

  // Intra-satellite case: same serving sat, beam changes.
  if (
    hs.targetSatelliteId &&
    hs.servingSatelliteId === hs.targetSatelliteId &&
    hs.targetBeamId &&
    hs.servingBeamId !== hs.targetBeamId
  ) {
    return {
      intra: {
        fromBeamId: hs.servingBeamId,
        toBeamId: hs.targetBeamId,
        progress01,
        expiresAtSec,
      },
    };
  }

  // Inter-satellite case: serving sat differs from target sat.
  if (
    hs.targetSatelliteId &&
    hs.servingSatelliteId !== hs.targetSatelliteId &&
    hs.targetBeamId
  ) {
    return {
      inter: {
        fromSatId: hs.servingSatelliteId,
        fromBeamId: hs.servingBeamId,
        toSatId: hs.targetSatelliteId,
        toBeamId: hs.targetBeamId,
        progress01,
        expiresAtSec,
      },
    };
  }

  // Fallback: handover kind known but cannot classify as intra/inter from the
  // ID comparison. We return empty progress so the renderer does not invent.
  return {};
}

// ---------------------------------------------------------------------------
// Per-section converters
// ---------------------------------------------------------------------------

function buildSatellites(
  samples: readonly VisualShowcaseSatelliteSample[],
  fallbackKind: VisualShowcaseCoordinateFrameKind,
  shellIdById: ReadonlyMap<string, string>,
): NormalizedSatellite[] {
  return samples.map((s) => {
    const kind = (s.coordinateFrameKind ?? fallbackKind) as VisualShowcaseCoordinateFrameKind;
    const worldPos = coordToWorld(s.positionEcefKm, kind);
    return {
      id: s.id,
      worldPos,
      coordFrameKind: kind,
      displayRole: s.displayRole,
      visible: s.visible,
      positionProvenance: s.positionProvenance,
      shellId: shellIdById.get(s.id),
      latDeg: s.geo.latDeg,
      lonDeg: s.geo.lonDeg,
      altitudeKm: s.geo.altKm,
    };
  });
}

/**
 * Per-artifact UE ground-projection parameters (P2). Reference center is
 * the bbox center of the first-frame UE cluster, and the world scale is
 * derived from the primary shell's footprint radius — same convention as
 * the live `runtimeFrameStep` ueWorldScale at line ~506.
 *
 * The reference center is fixed per artifact (not recomputed per frame)
 * so that UE motion across frames appears as motion in world space rather
 * than as a sliding cluster origin.
 */
interface UeReplayProjection {
  readonly referenceLatDeg: number;
  readonly referenceLonDeg: number;
  readonly ueWorldScale: number;
}

const KM_PER_DEG = EARTH_KM_PER_DEG;

function computeUeReplayProjection(
  artifact: VisualShowcaseArtifact,
  geometry: SceneGeometry,
): UeReplayProjection {
  const firstFrameUes = artifact.timeline[0]?.ues ?? [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const u of firstFrameUes) {
    minLat = Math.min(minLat, u.geo.latDeg);
    maxLat = Math.max(maxLat, u.geo.latDeg);
    minLon = Math.min(minLon, u.geo.lonDeg);
    maxLon = Math.max(maxLon, u.geo.lonDeg);
  }
  const referenceLatDeg = Number.isFinite(minLat) ? (minLat + maxLat) / 2 : 0;
  const referenceLonDeg = Number.isFinite(minLon) ? (minLon + maxLon) / 2 : 0;

  // Scale: pick primary shell's footprintRadiusKm.
  const primaryShellId = artifact.entities.satellites[0]?.shellId ?? '';
  const layout =
    geometry.shellLayouts.get(primaryShellId) ??
    geometry.shellLayouts.values().next().value;
  const footprintRadiusKm = layout?.footprintRadiusKm ?? 1;
  const ueWorldScale =
    footprintRadiusKm > 0 ? FOOTPRINT_RADIUS_WORLD / footprintRadiusKm : 1;

  return { referenceLatDeg, referenceLonDeg, ueWorldScale };
}

function projectUeWorldPos(
  latDeg: number,
  lonDeg: number,
  proj: UeReplayProjection,
): WorldPos {
  const cosRefLat = Math.cos((proj.referenceLatDeg * Math.PI) / 180);
  const eastKm = (lonDeg - proj.referenceLonDeg) * KM_PER_DEG * cosRefLat;
  const northKm = (latDeg - proj.referenceLatDeg) * KM_PER_DEG;
  return [eastKm * proj.ueWorldScale, 0, -northKm * proj.ueWorldScale];
}

function buildUes(
  samples: readonly VisualShowcaseUeSample[],
  channelMetricKind: VisualShowcaseChannelMetricKind,
  proj: UeReplayProjection,
): NormalizedUe[] {
  return samples.map((u) => {
    const candidates = u.candidateSinrDbByBeamId
      ? new Map<string, ChannelMetricValue>(
          Object.entries(u.candidateSinrDbByBeamId).map(([beamId, dB]) => [
            beamId,
            makeChannelMetricValue(channelMetricKind, dB),
          ]),
        )
      : undefined;
    return {
      id: u.id,
      geo: { latDeg: u.geo.latDeg, lonDeg: u.geo.lonDeg, altKm: u.geo.altKm },
      worldPos: projectUeWorldPos(u.geo.latDeg, u.geo.lonDeg, proj),
      servingSatelliteId: u.servingSatelliteId,
      servingBeamId: u.servingBeamId,
      targetSatelliteId: u.targetSatelliteId ?? null,
      targetBeamId: u.targetBeamId ?? null,
      channelMetric: makeChannelMetricValue(channelMetricKind, u.sinrDb),
      candidatesByBeamId: candidates,
      decisionRef: u.decisionRef,
    };
  });
}

function buildBeams(
  samples: readonly VisualShowcaseBeamSample[],
  entityIndex: ReadonlyMap<
    string,
    { halfAngleDeg: number; frequencyReuseGroup: string | null }
  >,
): NormalizedBeam[] {
  return samples.map((b) => {
    const entity = entityIndex.get(b.id);
    const halfAngleDeg = entity?.halfAngleDeg ?? 0;
    return {
      id: b.id,
      satelliteId: b.satelliteId,
      halfAngleDeg,
      role: mapProducerBeamRoleToEventRole(b.role),
      producerRole: b.role,
      gainDb: b.gainDb ?? null,
      gainProvenance: b.gainProvenance,
      frequencyReuseGroup: entity?.frequencyReuseGroup ?? null,
    };
  });
}

function buildLinks(
  samples: VisualShowcaseTimelineFrame['links'],
  channelMetricKind: VisualShowcaseChannelMetricKind,
): NormalizedLink[] {
  return samples.map((l) => ({
    id: l.id,
    sourceId: l.sourceId,
    targetId: l.targetId,
    beamId: l.beamId,
    role: l.role,
    channelMetric: makeChannelMetricValue(channelMetricKind, l.sinrDb),
  }));
}

function buildEventRoles(
  beams: readonly NormalizedBeam[],
): NormalizedEventRoleMaps {
  const bySatId = new Map<string, EventRole>();
  const byBeamId = new Map<string, EventRole>();
  // Sat-level role: pick the strongest role present on any of its beams.
  const rolePriority: Record<EventRole, number> = {
    serving: 5,
    prepared: 4,
    'post-ho': 3,
    secondary: 2,
    approach: 1,
    inactive: 0,
  };
  for (const beam of beams) {
    byBeamId.set(beam.id, beam.role);
    const current = bySatId.get(beam.satelliteId);
    if (!current || rolePriority[beam.role] > rolePriority[current]) {
      bySatId.set(beam.satelliteId, beam.role);
    }
  }
  return { bySatId, byBeamId };
}

function buildBeamHopping(beams: readonly NormalizedBeam[]): NormalizedBeamHopping {
  const bySatId = new Map<string, { activeBeamIds: string[]; hopSlot?: number }>();
  for (const beam of beams) {
    if (beam.role !== 'serving') continue;
    const entry = bySatId.get(beam.satelliteId);
    if (entry) {
      entry.activeBeamIds.push(beam.id);
    } else {
      bySatId.set(beam.satelliteId, { activeBeamIds: [beam.id] });
    }
  }
  return { bySatId };
}

function buildHandover(hs: VisualShowcaseHandoverState): NormalizedHandover {
  return {
    kind: hs.kind ?? '',
    phase: hs.phase,
    phaseSource: hs.phaseSource,
    sourceHandoverOccurred: hs.sourceHandoverOccurred,
    servingSatelliteId: hs.servingSatelliteId,
    servingBeamId: hs.servingBeamId,
    targetSatelliteId: hs.targetSatelliteId ?? null,
    targetBeamId: hs.targetBeamId ?? null,
    handoverProvenance: hs.handoverProvenance,
  };
}

function buildMetrics(
  metrics: VisualShowcaseTimelineFrame['metrics'],
  channelMetricKind: VisualShowcaseChannelMetricKind,
): NormalizedMetrics {
  const candidates = metrics.candidateSinrDbByBeamId
    ? new Map<string, ChannelMetricValue>(
        Object.entries(metrics.candidateSinrDbByBeamId).map(([beamId, dB]) => [
          beamId,
          makeChannelMetricValue(channelMetricKind, dB),
        ]),
      )
    : undefined;
  return {
    channelMetricKind,
    primary: makeChannelMetricValue(channelMetricKind, metrics.primarySinrDb),
    serving: makeChannelMetricValue(channelMetricKind, metrics.servingSinrDb),
    candidates,
    servingSatelliteId: metrics.servingSatelliteId,
    servingBeamId: metrics.servingBeamId,
    throughputMbps: metrics.throughputMbps,
    rewardScalar: metrics.rewardScalar,
    rewardVector: metrics.rewardVector,
  };
}

function buildPendingTarget(
  hs: VisualShowcaseHandoverState,
  channelMetricKind: VisualShowcaseChannelMetricKind,
  candidatesByBeamId: ReadonlyMap<string, ChannelMetricValue> | undefined,
): NormalizedPendingTarget | undefined {
  if (
    !hs.targetSatelliteId ||
    !hs.targetBeamId ||
    hs.kind === 'none' ||
    hs.kind === undefined ||
    hs.kind === ''
  ) {
    return undefined;
  }
  const channelMetric = candidatesByBeamId?.get(hs.targetBeamId);
  void channelMetricKind; // already encoded in candidatesByBeamId entries
  return {
    satId: hs.targetSatelliteId,
    beamId: hs.targetBeamId,
    channelMetric,
  };
}

function buildPerUeDecisions(
  artifact: VisualShowcaseArtifact,
  frame: VisualShowcaseTimelineFrame,
): NormalizedUeDecision[] {
  // Resolve decisionFrames whose tSec matches this frame. Cheap linear scan;
  // adequate for ≤61 frames × ≤100 UEs in the trigger artifact.
  const out: NormalizedUeDecision[] = [];
  for (const df of artifact.diagnostics.decisionFrames) {
    if (df.tSec !== frame.tSec) continue;
    out.push(mapDecisionFrame(df));
  }
  return out;
}

function mapDecisionFrame(df: VisualShowcaseDecisionFrame): NormalizedUeDecision {
  return {
    id: df.id,
    ueId: df.ueId,
    actionIndex: df.selectedActionIndex,
    selectedActionScore: df.selectedActionScore,
    runnerUpActionScore: df.runnerUpActionScore,
    scoreMargin: df.scoreMargin,
    mask: df.decisionActionValidityMask,
    source: df,
  };
}

// ---------------------------------------------------------------------------
// Public entry — single seam
// ---------------------------------------------------------------------------

/**
 * Project a validated `visual-showcase-v1` artifact into the renderer's
 * single input shape.
 *
 * @param artifact     the `VisualShowcaseArtifact` returned by
 *                     `loadShowcaseArtifact`.
 * @param frameIndex   the 0-based timeline frame index.
 * @returns a `NormalizedSceneFrame` ready for `useBeamViz` (after the C1
 *          split in P1c).
 * @throws if the frame index is out of bounds or the constructed geometry
 *         brand does not match the replay path (defence-in-depth assert).
 */
export function showcaseArtifactToScene(
  artifact: VisualShowcaseArtifact,
  frameIndex: number,
): NormalizedSceneFrame {
  if (
    !Number.isInteger(frameIndex) ||
    frameIndex < 0 ||
    frameIndex >= artifact.timeline.length
  ) {
    throw new Error(
      `[showcaseArtifactToScene] frameIndex=${frameIndex} out of bounds ` +
        `(timeline length ${artifact.timeline.length})`,
    );
  }
  const frame = artifact.timeline[frameIndex];

  // Truth: channel metric kind is set on `truthOwnership.sinr`.
  const channelMetricKind =
    (artifact.truthOwnership.sinr.channelMetricKind ?? 'snr-no-interference') as
      VisualShowcaseChannelMetricKind;

  // Build entity-side lookups once per call.
  const beamEntityIndex = new Map<
    string,
    { halfAngleDeg: number; frequencyReuseGroup: string | null }
  >();
  for (const be of artifact.entities.beams) {
    beamEntityIndex.set(be.id, {
      halfAngleDeg: be.halfAngleDeg,
      frequencyReuseGroup: be.frequencyReuseGroup,
    });
  }
  const satelliteShellIdById = new Map<string, string>();
  for (const se of artifact.entities.satellites) {
    satelliteShellIdById.set(se.id, se.shellId);
  }

  // Fallback coord frame: scenario.coordinateFrame can name the frame kind
  // at scenario scope; we accept it as a hint only if it matches the
  // contract's coordinate-frame kind enum.
  const scenarioCoord = artifact.scenario.coordinateFrame;
  const fallbackCoord: VisualShowcaseCoordinateFrameKind =
    scenarioCoord === 'ecef-km' || scenarioCoord === 'eci-km-no-earth-rotation-proxy'
      ? scenarioCoord
      : 'eci-km-no-earth-rotation-proxy';

  const geometry = sceneGeometryFromFullArtifact(artifact);
  // Defence-in-depth: SDD §3 Q7 last paragraph + §4 D9.
  if (!isReplaySceneGeometry(geometry)) {
    throw new Error(
      '[showcaseArtifactToScene] internal invariant violated: SceneGeometry ' +
        'does not carry REPLAY_GEOMETRY_BRAND — would risk filling geometry ' +
        'from live Profile on the replay path (R1).',
    );
  }
  const ueProjection = computeUeReplayProjection(artifact, geometry);

  const satellites = buildSatellites(frame.satellites, fallbackCoord, satelliteShellIdById);
  const ues = buildUes(frame.ues, channelMetricKind, ueProjection);
  const beams = buildBeams(frame.beams, beamEntityIndex);
  const links = buildLinks(frame.links, channelMetricKind);

  const eventRoles = buildEventRoles(beams);
  const beamHopping = buildBeamHopping(beams);
  const handover = buildHandover(frame.handoverState);
  const metrics = buildMetrics(frame.metrics, channelMetricKind);
  const transitionProgress = deriveTransitionProgress(frame.handoverState, frame.tSec);

  // Primary-UE candidates → expose as a Map for pendingTarget lookup.
  const primaryUe = ues[0];
  const pendingTarget = buildPendingTarget(
    frame.handoverState,
    channelMetricKind,
    primaryUe?.candidatesByBeamId,
  );

  // TODO P3: recentHo synthesis from artifact `events[]` correlation. For
  // now we leave it undefined on the replay path — the producer does not
  // currently carry recent-HO ageSec; surfacing it would require event-log
  // correlation that lands with playback. Live path retains its
  // wallclock-latch derivation in `deriveLiveSceneFields`.
  const recentHo: NormalizedRecentHo | undefined = undefined;

  const perUeDecisions = buildPerUeDecisions(artifact, frame);

  return {
    sceneSource: 'artifact-replay',
    frameIndex,
    tSec: frame.tSec,
    satellites,
    ues,
    beams,
    links,
    eventRoles,
    transitionProgress,
    beamHopping,
    pendingTarget,
    recentHo,
    handover,
    metrics,
    perUeDecisions,
    geometry,
    channelMetricKind,
    provenance: artifact.provenance,
    claimBoundary: artifact.provenance.claimBoundary,
    evidenceStatus: artifact.provenance.evidenceStatus,
    truthOwnership: artifact.truthOwnership,
  };
}

// Convenience re-exports for downstream consumers without circular imports.
export type { WorldPos } from '../scene/NormalizedSceneFrame';
