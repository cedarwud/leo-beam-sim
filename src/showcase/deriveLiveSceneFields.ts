/**
 * deriveLiveSceneFields — pure module that extracts the role / event /
 * transition-progress derivation from `SimFrame + SceneGeometry` and returns
 * `NormalizedSceneFrame`-shaped sub-records.
 *
 * Rationale (SDD §3 Q5 C1 binding):
 *   On the live path, the **derivation** of role tokens / handover progress /
 *   pendingTarget / recentHo / beamHopping currently lives in `useBeamViz.ts`
 *   mixed with display-prop computation (line widths, cone meshes, callouts).
 *   C1 mandates separating the two:
 *     (a) **derivation** — live-engine ID comparison + wallclock-latch reads
 *         → moves here. This is what `liveSimToScene.ts` (the adapter)
 *         consumes to fill `NormalizedSceneFrame`.
 *     (b) **display** — kept in `useBeamViz.ts` (cone geo, callouts, …).
 *
 *   This module is **the single live-engine derivation seam**. The renderer
 *   never re-derives role / event / progress from ID comparison.
 *
 * Truth-ownership boundary (R1/R2):
 *   - This module does NOT recompute SINR / handover decisions / positions /
 *     rewards. It only **reads** what the live engine already produced
 *     (`SimFrame` fields) and projects them into the renderer-facing shape.
 *   - The function is pure — same inputs → same outputs except for the
 *     `performance.now()` read inside `wallClockProgress`, which is the
 *     legacy behaviour of `useBeamViz` and stays in this module to preserve
 *     the live wallclock animation.
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`. We DO
 *     accept a pre-computed `SimFrame` from those modules — we are downstream
 *     of them.
 *   - No three.js imports here — output is plain data so the result can be
 *     JSON-serialised for D6 snapshot tests in P1d.
 */

import { makeChannelMetricValue, type ChannelMetricValue } from '../scene/ChannelMetricValue';
import type {
  EventRole,
  IntraTransitionProgress,
  InterTransitionProgress,
  NormalizedBeamHopping,
  NormalizedEventRoleMaps,
  NormalizedHandover,
  NormalizedPendingTarget,
  NormalizedRecentHo,
  TransitionProgress,
} from '../scene/NormalizedSceneFrame';
import type { SceneGeometry } from '../scene/SceneGeometry';
import type { SimFrame } from '../scene/types';

/**
 * Live-engine channel-metric kind. The live path produces interference-aware
 * SINR via `core/channel.computeLinkBudget`; the replay path produces paper
 * SNR (no interference). The legend / formatters branch on this discriminator.
 */
export const LIVE_CHANNEL_METRIC_KIND = 'sinr-with-interference' as const;

/**
 * Output of {@link deriveLiveSceneFields} — exactly the subset of
 * `NormalizedSceneFrame` that comes from live-engine derivation. The adapter
 * (`liveSimToScene`) folds these into the full frame.
 */
export interface DerivedLiveSceneFields {
  readonly eventRoles: NormalizedEventRoleMaps;
  readonly transitionProgress: TransitionProgress;
  readonly beamHopping: NormalizedBeamHopping;
  readonly pendingTarget?: NormalizedPendingTarget;
  readonly recentHo?: NormalizedRecentHo;
  readonly handover: NormalizedHandover;
  /**
   * Live-engine handover kind discriminator, derived from `sim.lastHoEvent` +
   * `sim.intraHandoverEvent` + `sim.interHandoverEvent`. Surfaced separately
   * so the adapter can write it into `NormalizedSceneFrame.handover.kind`.
   */
  readonly handoverKind: 'none' | 'intra' | 'inter';
}

// ---------------------------------------------------------------------------
// Wallclock helpers — preserved verbatim from useBeamViz so the live render
// path keeps the same animation pacing. These are display-only timing reads.
// ---------------------------------------------------------------------------

function wallClockProgress(startMs: number | null, endMs: number | null): number {
  if (startMs === null || endMs === null) return 1;
  const durationMs = Math.max(1, endMs - startMs);
  const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
  return Math.min(1, Math.max(0, (nowMs - startMs) / durationMs));
}

function intraPreviewTransitionProgress(progress: number): number {
  return Math.min(0.3, Math.max(0, progress) * 0.3);
}

function intraCommittedTransitionProgress(startMs: number | null, endMs: number | null): number {
  return 0.3 + wallClockProgress(startMs, endMs) * 0.7;
}

function interPendingTransitionProgress(progressSec: number, targetSec: number): number {
  const target = Math.max(targetSec, 1e-6);
  return Math.min(0.3, Math.max(0, progressSec / target) * 0.3);
}

// ---------------------------------------------------------------------------
// Event-role derivation — Q5 C1 split, replay-side mirror in
// `showcaseArtifactToScene.buildEventRoles`.
// ---------------------------------------------------------------------------

/**
 * Derive per-sat and per-beam role tokens from live-engine `SimFrame` fields.
 *
 * This mirrors the legacy logic in `useBeamViz.ts:415-445` but without the
 * coupling to per-beam selection specs (those stay in useBeamViz as display
 * computation). Only the role *assignment* lives here.
 */
function deriveEventRoles(sim: SimFrame): NormalizedEventRoleMaps {
  const bySatId = new Map<string, EventRole>();
  // Live-engine beam IDs are numeric; keys here are stringified to share the
  // map shape with the replay path. Per-beam role tokens are sparse — only
  // explicitly-flagged event beams get entries; the renderer fills the rest
  // from the satellite-level role.
  const byBeamId = new Map<string, EventRole>();

  const committedInterEvent =
    sim.pendingTargetSatId === null ? sim.interHandoverEvent : null;

  if (sim.serving.satId) {
    const isPostHo =
      sim.recentHoTargetSatId === sim.serving.satId ||
      committedInterEvent?.toSatId === sim.serving.satId;
    bySatId.set(sim.serving.satId, isPostHo ? 'post-ho' : 'serving');
    if (sim.serving.beamId !== null && sim.serving.beamId !== undefined) {
      byBeamId.set(`${sim.serving.satId}:${sim.serving.beamId}`, isPostHo ? 'post-ho' : 'serving');
    }
  }

  if (sim.pendingTargetSatId && sim.pendingTargetSatId !== sim.serving.satId) {
    bySatId.set(sim.pendingTargetSatId, 'prepared');
    if (sim.pendingTargetBeamId !== null && sim.pendingTargetBeamId !== undefined) {
      byBeamId.set(`${sim.pendingTargetSatId}:${sim.pendingTargetBeamId}`, 'prepared');
    }
  }

  if (
    sim.recentHoSourceSatId &&
    sim.recentHoSourceSatId !== sim.serving.satId &&
    sim.recentHoSourceSatId !== sim.pendingTargetSatId
  ) {
    bySatId.set(sim.recentHoSourceSatId, 'secondary');
    if (sim.recentHoSourceBeamId !== null && sim.recentHoSourceBeamId !== undefined) {
      byBeamId.set(
        `${sim.recentHoSourceSatId}:${sim.recentHoSourceBeamId}`,
        'secondary',
      );
    }
  }

  if (
    committedInterEvent &&
    committedInterEvent.fromSatId !== sim.serving.satId &&
    committedInterEvent.fromSatId !== sim.pendingTargetSatId
  ) {
    bySatId.set(committedInterEvent.fromSatId, 'secondary');
  }

  return { bySatId, byBeamId };
}

// ---------------------------------------------------------------------------
// Transition-progress derivation — wallclock latches → progress01.
// ---------------------------------------------------------------------------

function deriveTransitionProgressFromLive(
  sim: SimFrame,
  geometry: SceneGeometry,
): TransitionProgress {
  const result: TransitionProgress = {};

  // Intra-satellite: prefer committed event over preview.
  const committedIntra = sim.intraHandoverEvent;
  if (committedIntra) {
    const progress01 = intraCommittedTransitionProgress(
      sim.intraHandoverWallClockStartMs,
      sim.intraHandoverWallClockExpiresMs,
    );
    const expiresAtSec = committedIntra.expiresAtSec;
    const intra: IntraTransitionProgress = {
      fromBeamId: String(committedIntra.fromBeamId),
      toBeamId: String(committedIntra.toBeamId),
      progress01,
      expiresAtSec,
      satId: committedIntra.satId,
      triggeredAtSec: committedIntra.triggeredAtSec,
      wallClockStartMs: sim.intraHandoverWallClockStartMs ?? undefined,
      wallClockExpiresMs: sim.intraHandoverWallClockExpiresMs ?? undefined,
      kind: 'committed',
    };
    result.intra = intra;
  } else if (sim.intraHandoverPreview) {
    const preview = sim.intraHandoverPreview;
    const progress01 = intraPreviewTransitionProgress(preview.progress);
    const intra: IntraTransitionProgress = {
      fromBeamId: String(preview.fromBeamId),
      toBeamId: String(preview.toBeamId),
      progress01,
      // Preview has no wallclock expiry — surface as live tSec so the renderer
      // treats it as in-progress. Renderer must not interpret this as truth.
      expiresAtSec: sim.simTimeSec,
      satId: preview.satId,
      kind: 'preview',
      previewProgressSec: preview.triggerTimeSec,
      previewTargetSec: preview.triggerTimeTargetSec,
    };
    result.intra = intra;
  }

  // Inter-satellite: pending vs committed.
  const pendingInterActive =
    sim.pendingTargetSatId !== null &&
    sim.pendingTargetBeamId !== null &&
    sim.pendingTargetSatId !== sim.serving.satId;

  if (pendingInterActive && sim.serving.satId && sim.pendingTargetSatId) {
    const triggerTimeSec = geometry.handoverTriggerTimeSec ?? 0;
    const progress01 = interPendingTransitionProgress(
      sim.handoverTriggerProgressSec,
      triggerTimeSec,
    );
    if (
      sim.serving.beamId !== null &&
      sim.serving.beamId !== undefined &&
      sim.pendingTargetBeamId !== null
    ) {
      const inter: InterTransitionProgress = {
        fromSatId: sim.serving.satId,
        fromBeamId: String(sim.serving.beamId),
        toSatId: sim.pendingTargetSatId,
        toBeamId: String(sim.pendingTargetBeamId),
        progress01,
        expiresAtSec: sim.simTimeSec + Math.max(0, triggerTimeSec - sim.handoverTriggerProgressSec),
        kind: 'pending',
        pendingProgressSec: sim.handoverTriggerProgressSec,
        pendingTargetSec: triggerTimeSec,
      };
      result.inter = inter;
    }
  } else {
    const committedInter =
      sim.pendingTargetSatId === null ? sim.interHandoverEvent : null;
    if (committedInter) {
      const progress01 = intraCommittedTransitionProgress(
        sim.interHandoverWallClockStartMs,
        sim.interHandoverWallClockExpiresMs,
      );
      const inter: InterTransitionProgress = {
        fromSatId: committedInter.fromSatId,
        fromBeamId: String(committedInter.fromBeamId),
        toSatId: committedInter.toSatId,
        toBeamId: String(committedInter.toBeamId),
        progress01,
        expiresAtSec: committedInter.expiresAtSec,
        kind: 'committed',
        wallClockStartMs: sim.interHandoverWallClockStartMs ?? undefined,
        wallClockExpiresMs: sim.interHandoverWallClockExpiresMs ?? undefined,
      };
      result.inter = inter;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Beam-hopping projection — preserves the `beamHopStatesBySatId` semantic.
// ---------------------------------------------------------------------------

function deriveBeamHopping(sim: SimFrame): NormalizedBeamHopping {
  const bySatId = new Map<string, { activeBeamIds: string[]; hopSlot?: number }>();
  for (const [satId, state] of sim.beamHopStatesBySatId.entries()) {
    bySatId.set(satId, {
      activeBeamIds: state.activeBeamIds.map((id) => String(id)),
      hopSlot: state.slotIndex,
    });
  }
  return { bySatId };
}

// ---------------------------------------------------------------------------
// Pending-target + recent-HO projection.
// ---------------------------------------------------------------------------

function derivePendingTarget(sim: SimFrame): NormalizedPendingTarget | undefined {
  if (
    sim.pendingTargetSatId === null ||
    sim.pendingTargetBeamId === null ||
    sim.pendingTargetBeamId === undefined
  ) {
    return undefined;
  }
  const channelMetric: ChannelMetricValue | undefined =
    sim.pendingTargetSinrDb !== null && Number.isFinite(sim.pendingTargetSinrDb)
      ? makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, sim.pendingTargetSinrDb)
      : undefined;
  return {
    satId: sim.pendingTargetSatId,
    beamId: String(sim.pendingTargetBeamId),
    channelMetric,
  };
}

function deriveRecentHo(sim: SimFrame): NormalizedRecentHo | undefined {
  // Source presence is the gate; target may be null when only the source is
  // latched (pre-handover dwell). The renderer flags the source-only case as
  // `secondary`.
  if (
    sim.recentHoSourceSatId === null ||
    sim.recentHoSourceBeamId === null ||
    sim.recentHoSourceBeamId === undefined
  ) {
    return undefined;
  }
  const channelMetric: ChannelMetricValue | undefined =
    sim.recentHoSourceSinrDb !== null && Number.isFinite(sim.recentHoSourceSinrDb)
      ? makeChannelMetricValue(LIVE_CHANNEL_METRIC_KIND, sim.recentHoSourceSinrDb)
      : undefined;
  return {
    sourceSatId: sim.recentHoSourceSatId,
    sourceBeamId: String(sim.recentHoSourceBeamId),
    targetSatId: sim.recentHoTargetSatId,
    targetBeamId:
      sim.recentHoTargetBeamId !== null && sim.recentHoTargetBeamId !== undefined
        ? String(sim.recentHoTargetBeamId)
        : null,
    sourceChannelMetric: channelMetric,
    // ageSec — live engine does not currently carry an explicit "recent-HO
    // age" field; the render path treats `recentHo` as present-while-active.
    // We surface 0 here as the live-side proxy; replay carries producer-truth
    // ageSec when available (currently undefined per the trigger artifact).
    ageSec: 0,
  };
}

// ---------------------------------------------------------------------------
// Handover state projection.
// ---------------------------------------------------------------------------

function deriveHandover(sim: SimFrame): {
  handover: NormalizedHandover;
  kind: 'none' | 'intra' | 'inter';
} {
  // Discriminator: prefer wallclock-latched events; fall back to lastHoEvent.
  let kind: 'none' | 'intra' | 'inter' = 'none';
  if (sim.intraHandoverEvent !== null) kind = 'intra';
  else if (sim.interHandoverEvent !== null) kind = 'inter';
  else if (sim.lastHoEvent !== null) {
    kind = sim.lastHoEvent.action === 'intra-switch' ? 'intra' : 'inter';
  }

  const phase =
    sim.intraHandoverEvent !== null
      ? 'committing'
      : sim.intraHandoverPreview !== null
        ? 'preparing'
        : sim.pendingTargetSatId !== null && sim.pendingTargetSatId !== sim.serving.satId
          ? 'preparing'
          : 'idle';

  const handover: NormalizedHandover = {
    kind: kind === 'none' ? 'none' : kind === 'intra' ? 'intra-satellite-beam-switch' : 'inter-satellite-handover',
    phase,
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
    sourceHandoverOccurred: sim.lastHoEvent !== null,
  };
  return { handover, kind };
}

// ---------------------------------------------------------------------------
// Public entry — the single live-engine derivation seam.
// ---------------------------------------------------------------------------

/**
 * Derive `NormalizedSceneFrame` sub-records from `SimFrame + SceneGeometry`.
 *
 * Pure of SINR / handover recomputation (R1/R2): we **read** what the live
 * engine produced and project it into the renderer-facing shape; we do not
 * re-derive truth.
 *
 * @param sim       the live-engine `SimFrame` for the current tick.
 * @param geometry  live-built `SceneGeometry` (carries `handoverTriggerTimeSec`).
 * @returns role tokens, transition progress, beam hopping, pending target,
 *          recent-HO, and the projected handover state.
 */
export function deriveLiveSceneFields(
  sim: SimFrame,
  geometry: SceneGeometry,
): DerivedLiveSceneFields {
  const eventRoles = deriveEventRoles(sim);
  const transitionProgress = deriveTransitionProgressFromLive(sim, geometry);
  const beamHopping = deriveBeamHopping(sim);
  const pendingTarget = derivePendingTarget(sim);
  const recentHo = deriveRecentHo(sim);
  const { handover, kind: handoverKind } = deriveHandover(sim);

  return {
    eventRoles,
    transitionProgress,
    beamHopping,
    pendingTarget,
    recentHo,
    handover,
    handoverKind,
  };
}
