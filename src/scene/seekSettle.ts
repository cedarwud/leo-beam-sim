/**
 * Seek-settle plan — how far BEFORE a seek target the runtime must reseat, and at
 * what sim-time grain it must run forward, so the LANDED frame carries real
 * handover state.
 *
 * Why this exists. The one-reset recipe reseats a fresh `RuntimeFrameStepState` at
 * the target and renders it with a single `paused` / `deltaSec: 0` step. That is
 * enough for positions and link budget (both are pure functions of sim-time), but
 * NOT for the HandoverManagers, whose pending-target state is time-INTEGRATED:
 *
 *   - a manager that (re)attaches at the landing enters its `pingPongGuardSec`
 *     window, and an active guard clears the pending target outright;
 *   - time-to-trigger only accumulates through `dt`, and the landing step pays
 *     `dt = 0`, so no manager can ever be observed mid-TTT.
 *
 * Both together mean a landed seek shows ZERO UEs in handover no matter what the
 * geometry at that sim-time actually is — the secondary-handover display filter
 * then has nothing to select. The fix is to reseat one settle-window EARLIER and
 * run the REAL model forward to the target, which is what continuous playback
 * would have done. Nothing is fabricated (Rule#6): every pending target on the
 * landed frame was produced by the same engine, from the same geometry, as play.
 */

export interface SeekSettleHandoverConfig {
  /** Post-handover ping-pong guard; an active guard suppresses pending targets. */
  readonly pingPongGuardSec: number;
  /** Time-to-trigger a pending target must accumulate before it commits. */
  readonly triggerTimeSec: number;
}

export interface SeekSettlePlan {
  /** Sim-time to run forward from the reseat to the landing. 0 = no settle. */
  readonly settleSec: number;
  /** Sim-time grain of each run-through step. */
  readonly stepSec: number;
  /** Where the reseat happens: `landingOffsetSec - settleSec`. */
  readonly reseatOffsetSec: number;
}

/**
 * Upper bound on the run-through grain. Matches the warm-up run-through / offline
 * event-index 2s scan: guard and TTT are sim-time integrals, so a coarse grain
 * accumulates them faithfully while keeping the seek cost bounded.
 */
export const SEEK_SETTLE_MAX_STEP_SEC = 2;

/**
 * Settle-window multiplier on TTT, on top of the ping-pong guard. The guard must
 * elapse before any pending target may form at all; the extra TTT budget gives a
 * post-guard pending target room to form AND still be mid-accumulation at the
 * landing (a window of exactly guard + 1×TTT can only land on committed
 * handovers, which have already cleared their pending target).
 */
const SETTLE_TRIGGER_TIME_MULTIPLE = 3;

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Plan the settle for a seek landing at `landingOffsetSec` (already normalized
 * against the trajectory horizon). The window is derived from the profile's own
 * handover timing — never hard-coded — and is clamped so the reseat never runs
 * before the start of the trajectory.
 */
export function planSeekSettle(
  handover: SeekSettleHandoverConfig,
  landingOffsetSec: number,
): SeekSettlePlan {
  const landing = Number.isFinite(landingOffsetSec) ? Math.max(0, landingOffsetSec) : 0;
  const guardSec = finitePositive(handover.pingPongGuardSec);
  const triggerTimeSec = finitePositive(handover.triggerTimeSec);
  const windowSec = guardSec + triggerTimeSec * SETTLE_TRIGGER_TIME_MULTIPLE;
  const settleSec = Math.min(windowSec, landing);
  // The grain must stay STRICTLY under one TTT: a step >= TTT takes a manager from
  // "no pending" to "pending already past its trigger time" within a single update,
  // so the landing can only ever observe committed handovers, never one in progress.
  const stepSec = triggerTimeSec > 0
    ? Math.min(SEEK_SETTLE_MAX_STEP_SEC, triggerTimeSec / 2)
    : SEEK_SETTLE_MAX_STEP_SEC;
  return {
    settleSec: settleSec > 0 ? settleSec : 0,
    stepSec,
    reseatOffsetSec: landing - (settleSec > 0 ? settleSec : 0),
  };
}
