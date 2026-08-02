/**
 * liveSimToScene — thin pure projection from `SimFrame` to
 * `NormalizedSceneFrame`.
 *
 * Rationale (SDD §3 Q5 C1 split / §3 Q7 / §4 D5):
 *   On the live path, role / event / handover-progress derivation MUST NOT
 *   live in `useBeamViz`. It lives in `deriveLiveSceneFields` (pure module),
 *   and this adapter is the single seam that calls it.
 *
 *   In P1c this adapter:
 *     - calls `deriveLiveSceneFields(sim, geometry)` to fill role tokens,
 *       transition progress, pendingTarget, recentHo, beamHopping, handover;
 *     - wraps channel values in `ChannelMetricValue` with kind
 *       `'sinr-with-interference'` (the live engine produces interference-
 *       aware SINR, contrasting with the artifact's `'snr-no-interference'`);
 *     - projects live UEs (R6: live N variable, primary preserved at index 0)
 *       into the renderer-facing UE array;
 *     - emits live-stub `claimBoundary` / `evidenceStatus` / `provenance`
 *       (UI prop injection is deferred to P1d when the claim-boundary banner
 *       UI component lands).
 *
 *   Per Q7 binding shape, `satellites[]` / `beams[]` / `links[]` are NOT
 *   filled by this adapter today: those shapes carry world-space positions
 *   (THREE.Vector3) that `useBeamViz` already consumes directly from
 *   `SimFrame`. `useBeamViz` retains its `(SimFrame, Profile, …)` signature
 *   on the live path; the C1 split here is the **derivation** seam, not a
 *   complete `SimFrame → NormalizedSceneFrame` projection. The remaining
 *   per-entity projection (satellites world positions, beams world centers)
 *   is deferred to P1d / P2 where the renderer will read `NormalizedSceneFrame`
 *   instead of `SimFrame`.
 *
 *   Where a live-engine `sim.*` field has no direct `NormalizedSceneFrame`
 *   home today, it is documented as **live-only adapter state** in
 *   `deriveLiveSceneFields` and is NOT leaked into `useBeamViz` display
 *   branches via this adapter.
 *
 * What this module is FORBIDDEN to do (R1/R2):
 *   - recompute SINR (the live engine already produced it; we wrap, we do
 *     not re-derive)
 *   - reclassify handover (the live HandoverManager output is the source)
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`. We DO
 *     accept a pre-computed `SimFrame` from those modules — we are downstream
 *     of them.
 *
 * P1d: `useBeamViz` now consumes `NormalizedSceneFrame + SceneGeometry`. This
 * adapter projects `satellites[]` (worldPos + topo / lat / lon / shellId),
 * `beams[]` (layout primitives), `links[]` (link-budget components), and
 * `beamHopping` (slotIndex / slotSec / enabled / displayAssignments).
 */

import { makeChannelMetricValue } from '../scene/ChannelMetricValue';
import type {
  EventRole,
  NormalizedBeam,
  NormalizedLink,
  NormalizedMetrics,
  NormalizedSatellite,
  NormalizedSceneFrame,
  NormalizedUe,
  NormalizedUeDecision,
} from '../scene/NormalizedSceneFrame';
import { isLiveSceneGeometry, type SceneGeometry } from '../scene/SceneGeometry';
import type { SimFrame } from '../scene/types';
import { resolvePrimaryCellServingRecord } from '../scene/sinrLiveCellModel';
import {
  LIVE_CHANNEL_METRIC_KIND,
  deriveLiveSceneFields,
} from './deriveLiveSceneFields';

/**
 * Project a live `SimFrame` into a `NormalizedSceneFrame`.
 *
 * @param sim       the live-engine output for the current frame.
 * @param geometry  the live-built `SceneGeometry` (must carry
 *                  `LIVE_GEOMETRY_BRAND`; runtime-asserted).
 * @returns a `NormalizedSceneFrame` for the renderer.
 */
export function liveSimToScene(
  sim: SimFrame,
  geometry: SceneGeometry,
): NormalizedSceneFrame {
  // Defence-in-depth: SDD §3 Q7 last paragraph.
  if (!isLiveSceneGeometry(geometry)) {
    throw new Error(
      '[liveSimToScene] SceneGeometry does not carry LIVE_GEOMETRY_BRAND — ' +
        'live adapter must not consume replay-built geometry (R1).',
    );
  }

  // P1c §A: role / event / progress derivation moves OUT of useBeamViz into
  // `deriveLiveSceneFields`. This adapter is the single live-side caller.
  const derived = deriveLiveSceneFields(sim, geometry);

  // Half-angle (deg) derived once from geometry.beamwidth3dBRad. The live
  // engine treats `beamwidth3dBRad` as the full 3 dB beamwidth; the renderer
  // uses the half-angle for cone geometry.
  const halfAngleDeg = (geometry.beamwidth3dBRad / 2) * (180 / Math.PI);

  // Satellite projection. `worldPos` is the live sky-dome az/el projection
  // (`s.world`, small world-units), tagged honestly via `worldFrame: 'live-enu'`
  // so `useBeamViz` selects its scaling by TYPE rather than by guessing the
  // frame from the coordinate magnitude (the former `mag > 1000` heuristic).
  // `coordFrameKind` stays `'ecef-km'` as a legacy provenance field only — the
  // value is dome-world units, NOT ecef-km; the renderer no longer reads it.
  const satellites: NormalizedSatellite[] = sim.satellites.map((s) => ({
    id: s.id,
    coordFrameKind: 'ecef-km' as const,
    worldFrame: 'live-enu' as const,
    worldPos: [s.world.x, s.world.y, s.world.z] as const,
    displayRole: '',
    visible: true,
    shellId: s.shellId,
    altitudeKm: s.altitudeKm,
    topo: s.topo,
    latDeg: s.latDeg,
    lonDeg: s.lonDeg,
  }));

  // Per-satellite event-role lookup for beam role assignment.
  const eventRoleBySatId = derived.eventRoles.bySatId;
  const eventRoleByBeamId = derived.eventRoles.byBeamId;

  // Beam projection from `steeringBeamCellsBySatId`. Each BeamCellState
  // carries the layout primitives (offset / scanAngle / reuseGroup); we wrap
  // those alongside the role token derived from `derived.eventRoles`.
  const beams: NormalizedBeam[] = [];
  for (const [satId, cells] of sim.steeringBeamCellsBySatId.entries()) {
    for (const cell of cells) {
      const beamIdStr = String(cell.beamId);
      const beamRole =
        eventRoleByBeamId.get(`${satId}:${cell.beamId}`)
        ?? eventRoleBySatId.get(satId)
        ?? 'inactive';
      beams.push({
        id: beamIdStr,
        satelliteId: satId,
        halfAngleDeg,
        role: beamRole,
        offsetEastKm: cell.offsetEastKm,
        offsetNorthKm: cell.offsetNorthKm,
        scanAngleDeg: cell.scanAngleDeg,
        coreLayoutSatId: cell.coreLayoutSatId,
        coreBeamId: cell.coreBeamId,
        coreLocalBeamIndex: cell.coreLocalBeamIndex,
        reuseGroup: cell.reuseGroup,
        runtimeFrequencyReuse: cell.runtimeFrequencyReuse,
        coreLayoutFrequencyReuse: cell.coreLayoutFrequencyReuse,
        reuseGroupSource: cell.reuseGroupSource,
      });
    }
  }

  // Link projection from `linkSamples`. The live engine produces one sample
  // per (sat, beam) candidate; we attach the full link-budget breakdown for
  // downstream engineering panels (FormulaTermsReadout, DuelSignalColumn).
  const liveUeId = 'live-ue-0';
  const links: NormalizedLink[] = sim.linkSamples.map((sample) => ({
    id: `${sample.satId}:${sample.beamId}`,
    sourceId: sample.satId,
    targetId: liveUeId,
    beamId: String(sample.beamId),
    role:
      eventRoleByBeamId.get(`${sample.satId}:${sample.beamId}`)
      ?? eventRoleBySatId.get(sample.satId)
      ?? 'inactive',
    channelMetric: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, sample.sinrDb),
    rsrpDbm: sample.rsrpDbm,
    signalDbm: sample.signalDbm,
    intraInterferenceDbm: sample.intraInterferenceDbm,
    interInterferenceDbm: sample.interInterferenceDbm,
    noiseDbm: sample.noiseDbm,
    denominatorDbm: sample.denominatorDbm,
    txPowerDbm: sample.txPowerDbm,
    pathLossDb: sample.pathLossDb,
    beamGainDb: sample.beamGainDb,
    steeringLossDb: sample.steeringLossDb,
    receiverGainDbi: sample.receiverGainDbi,
  }));

  // R6 binding: live N variable, primary preserved at index 0 (live-ue-0).
  // F-S2 secondaries carry SINR against the primary serving beam when available.
  const simUePositions = sim.perUePositions ?? [];
  const liveUePositions = simUePositions.length > 0
    ? simUePositions
    : [{
      id: liveUeId,
      groundX: sim.ueGroundX,
      groundZ: sim.ueGroundZ,
      eastKm: 0,
      northKm: 0,
      sinrDb: sim.serving.sinrDb,
      servingSatId: sim.serving.satId,
      servingBeamId: sim.serving.beamId,
      pendingTargetSatId: sim.pendingTargetSatId,
      pendingTargetBeamId: sim.pendingTargetBeamId,
      triggerProgressSec: sim.handoverTriggerProgressSec,
    }];
  const ues: NormalizedUe[] = liveUePositions.map((pos, i) => {
    if (i === 0) {
      return {
        id: liveUeId,
        geo: { latDeg: 0, lonDeg: 0 },
        worldPos: [pos.groundX, 0, pos.groundZ] as const,
        servingSatelliteId: sim.serving.satId ?? '',
        servingBeamId:
          sim.serving.beamId !== null && sim.serving.beamId !== undefined
            ? String(sim.serving.beamId)
            : '',
        targetSatelliteId: sim.pendingTargetSatId,
        targetBeamId:
          sim.pendingTargetBeamId !== null && sim.pendingTargetBeamId !== undefined
            ? String(sim.pendingTargetBeamId)
            : null,
        channelMetric: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, sim.serving.sinrDb),
      };
    }

    return {
      id: pos.id,
      geo: { latDeg: 0, lonDeg: 0 },
      worldPos: [pos.groundX, 0, pos.groundZ] as const,
      servingSatelliteId: pos.servingSatId ?? '',
      servingBeamId: pos.servingBeamId !== null ? String(pos.servingBeamId) : '',
      targetSatelliteId: pos.pendingTargetSatId,
      targetBeamId: pos.pendingTargetBeamId !== null ? String(pos.pendingTargetBeamId) : null,
      channelMetric: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, pos.sinrDb ?? NaN),
    };
  });

  let metrics: NormalizedMetrics = {
    channelMetricKind: LIVE_CHANNEL_METRIC_KIND,
    primary: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, sim.serving.sinrDb),
    serving: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, sim.serving.sinrDb),
    servingSatelliteId: sim.serving.satId ?? '',
    servingBeamId:
      sim.serving.beamId !== null && sim.serving.beamId !== undefined
        ? String(sim.serving.beamId)
        : '',
  };

  // If the cell-truth model is active, align the serving satellite and beam
  // for the primary UE (and the overall scene metrics) to the cell-truth serving satellite.
  const primaryUeId = liveUePositions[0]?.id;
  const primaryServingRecord = sim.sinrLiveCells
    ? resolvePrimaryCellServingRecord(sim.sinrLiveCells, liveUePositions)
    : null;

  let handover = derived.handover;
  let recentHo = derived.recentHo;
  let pendingTarget = derived.pendingTarget;
  let transitionProgress = derived.transitionProgress;
  let eventRoles = derived.eventRoles;

  if (primaryServingRecord) {
    const servingSatId = primaryServingRecord.servingSatId ?? '';
    const servingBeamIdStr = primaryServingRecord.beamIdentity ?? '';
    const servingSinrDb = primaryServingRecord.sinrDb ?? NaN;

    // Find the latest handover event for the primary UE to determine recent HO status
    const latestHoEvent = sim.sinrLiveCells?.recentHandoverEvents
      ?.filter(e => e.ueId === primaryUeId)
      .slice(-1)[0];
    const ageSec = latestHoEvent ? sim.simTimeSec - latestHoEvent.sourceTimeSec : Infinity;
    const isRecent = ageSec >= 0 && ageSec < 4; // SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC is 4

    // 1. Override metrics
    metrics = {
      channelMetricKind: LIVE_CHANNEL_METRIC_KIND,
      primary: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, servingSinrDb),
      serving: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, servingSinrDb),
      servingSatelliteId: servingSatId,
      servingBeamId: servingBeamIdStr,
    };

    // 2. Override primary UE's serving/target details
    if (ues.length > 0) {
      ues[0] = {
        ...ues[0],
        servingSatelliteId: servingSatId,
        servingBeamId: servingBeamIdStr,
        targetSatelliteId: null, // cell-truth model doesn't have prepared target
        targetBeamId: null,
        channelMetric: makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, servingSinrDb),
      };
    }

    // 3. Override handover state
    handover = {
      kind: !latestHoEvent || !isRecent
        ? 'none'
        : latestHoEvent.kind === 'intra'
          ? 'intra-satellite-beam-switch'
          : 'inter-satellite-handover',
      phase: isRecent ? 'committing' : 'idle',
      servingSatelliteId: servingSatId,
      servingBeamId: servingBeamIdStr,
      targetSatelliteId: null,
      targetBeamId: null,
      sourceHandoverOccurred: latestHoEvent !== undefined,
    };

    // 4. Override recentHo details
    recentHo = latestHoEvent && isRecent ? {
      sourceSatId: latestHoEvent.fromSatId ?? '',
      sourceBeamId: latestHoEvent.fromCellId !== null ? String(latestHoEvent.fromCellId) : '',
      sourceChannelMetric: undefined,
      targetSatId: latestHoEvent.toSatId,
      targetBeamId: String(latestHoEvent.toCellId),
      ageSec: ageSec,
    } : undefined;

    // 5. Override pendingTarget (it is none for cell-truth)
    pendingTarget = undefined;

    // 6. Override transition progress for inter-satellite transitions
    if (latestHoEvent && latestHoEvent.kind === 'inter' && isRecent) {
      transitionProgress = {
        ...transitionProgress,
        inter: {
          fromSatId: latestHoEvent.fromSatId ?? '',
          fromBeamId: latestHoEvent.fromCellId !== null ? String(latestHoEvent.fromCellId) : '',
          toSatId: latestHoEvent.toSatId,
          toBeamId: String(latestHoEvent.toCellId),
          progress01: Math.min(1.0, Math.max(0.0, ageSec / 4)),
          expiresAtSec: latestHoEvent.sourceTimeSec + 4,
        },
      };
    } else {
      transitionProgress = {
        ...transitionProgress,
        inter: undefined,
      };
    }

    // 7. Override event roles
    const bySatId = new Map<string, EventRole>();
    const byBeamId = new Map<string, EventRole>();

    if (servingSatId) {
      const isPostHo = latestHoEvent && isRecent && latestHoEvent.toSatId === servingSatId;
      const role: EventRole = isPostHo ? 'post-ho' : 'serving';
      bySatId.set(servingSatId, role);
      if (servingBeamIdStr) {
        byBeamId.set(`${servingSatId}:${servingBeamIdStr}`, role);
      }
    }

    if (latestHoEvent && isRecent && latestHoEvent.fromSatId) {
      bySatId.set(latestHoEvent.fromSatId, 'secondary');
      if (latestHoEvent.fromCellId !== null) {
        byBeamId.set(`${latestHoEvent.fromSatId}:${latestHoEvent.fromCellId}`, 'secondary');
      }
    }

    // Keep approach roles from the steered model if any (since they are calculated
    // in derived.eventRoles.bySatId based on satellites close to observer, which is useful)
    for (const [satId, role] of derived.eventRoles.bySatId.entries()) {
      if (role === 'approach' && !bySatId.has(satId)) {
        bySatId.set(satId, 'approach');
      }
    }

    eventRoles = { bySatId, byBeamId };
  }

  // Live: no per-UE MODQN decisions.
  const perUeDecisions: NormalizedUeDecision[] = [];

  // Project `displayAssignments` (active beam assignments for display) and
  // `beamHopSlotSec` into the beamHopping struct. `displayAssignments` differs
  // from `beamHopStatesBySatId.activeBeamIds` because it can include preview /
  // overlay beams sourced from `runtimeFrameStep`.
  const displayAssignmentsBySatId = new Map<string, string[]>();
  for (const assignment of sim.displayAssignments) {
    const existing = displayAssignmentsBySatId.get(assignment.satId) ?? [];
    existing.push(String(assignment.beamId));
    displayAssignmentsBySatId.set(assignment.satId, existing);
  }
  const beamHopping = {
    bySatId: derived.beamHopping.bySatId,
    slotSec: sim.beamHopSlotSec,
    slotIndex: sim.beamHopSlotIndex,
    enabled: sim.beamHopEnabled,
    displayAssignmentsBySatId,
  };

  return {
    sceneSource: 'live-sim',
    // frameIndex: live engine does not maintain a discrete frame counter.
    // We use the integer floor of simTimeSec as a stable proxy so consumers
    // (e.g. D6 snapshot harness) can index sequentially. Not truth — display.
    frameIndex: Math.floor(sim.simTimeSec),
    tSec: sim.simTimeSec,
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
    channelMetricKind: LIVE_CHANNEL_METRIC_KIND,
    provenance: { kind: 'live-stub', note: 'live-sim provenance — repo build info' },
    claimBoundary: {
      kind: 'live-stub',
      storyKind: 'live-sinr-sim',
      // Live path makes no MODQN / Multi-Catfish EE-EFFECTIVENESS claims. The r1
      // EE term below is the reward-surface ratio B_alloc·log2(1+γ)/P_beam
      // derived from the live SINR (see `src/utils/energyEfficiency.ts`);
      // it is a rendered quantity, NOT a superiority / energy-saving result, so
      // the forbidden list underneath is unchanged.
      allowedClaims: [
        'interference-aware SINR (live)',
        'reward-surface r1 EE derived from live SINR (bit/joule)',
      ],
      forbiddenClaims: [
        'Multi-Catfish-MODQN effectiveness',
        'Catfish-EE',
        'general EE-MODQN superiority',
        'active-TX EE recovery',
        'physical energy saving',
      ],
    },
    evidenceStatus: { kind: 'live-stub', status: 'live', notes: [] },
    truthOwnership: null,
  };
}
