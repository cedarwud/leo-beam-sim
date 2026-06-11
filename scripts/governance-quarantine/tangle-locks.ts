// Governance-lock quarantine registry — consolidation S0.
//
// docs/frontend-consolidation-program.md §2: the string-lock regime freezes the
// display↔truth tangle (needles pin exact source text — internal expressions,
// call shapes, JSX indentation, literal constants — of the very files slices
// S1-S6/C1-C2 must rewrite), turning every consolidation edit into validator
// surgery. S0 splits the locks instead of weakening them:
//
//   - PERMANENT locks stay in validate-frontend-scene-lane-governance.ts:
//     behavioral matrix asserts (real function calls), lane mount/suppress
//     rules, truth-boundary import bans (BLOCK-3 class), honesty/claim/telemetry
//     observables, fail-closed gates, R3F dispose/no-setState discipline.
//   - TANGLE-PIN locks are wrapped in-place in `tangleLockGroup('<id>', ...)`
//     blocks registered here. They still EXECUTE on every gate run — there is
//     no silent regression window — but they are scheduled for retirement.
//
// Rules (binding for every consolidation slice):
//   1. A group is deleted WHOLESALE by the slice commit named in `retiringSlice`,
//      in the same commit that lands the `replacement` behavior gates. Never
//      retire a group without its replacement.
//   2. Never patch a needle inside a group to "fix" the gate after a source
//      edit. If a needle breaks before its slice lands, the EDIT is premature —
//      revert the edit or bring the slice forward.
//   3. New locks added during the program must be behavior locks (call the
//      function / render the frame / read the telemetry), not source-text pins.
//      If a slice meets an unclassified tangle pin, wrap it into the matching
//      group rather than duplicating it.
//   4. The permanent gate file is append-only during the program (no
//      reorganization churn while slices are in flight).

export interface TangleLockGroupContract {
  /** Slice (docs/frontend-consolidation-program.md §3) that deletes the group. */
  readonly retiringSlice: string;
  /** The behavior gates that replace the group in the retiring commit. */
  readonly replacement: string;
}

export const TANGLE_LOCK_RETIREMENT: Record<string, TangleLockGroupContract> = {
  'QUAR-RENDER-RESET': {
    retiringSlice:
      'sinr-live render reset (docs/sinr-live-render-reset-decision.md) — or S5 if it lands first',
    replacement:
      'render-plan matrix asserts for the un-parked cell-truth lane + the S0 connected-sat-has-beam invariant on the cell-cone path',
  },
  // QUAR-S3-STEP RETIRED 2026-06-11 (S3-3, one step/one reset): its three blocks
  // (cell-lane gate strings, runtimeFrameStep FROZEN-text pin, 15° literal triple-pin)
  // were replaced wholesale by behavior / structural / imported-constant VALUE asserts
  // in validate:s3:one-reset, alongside the pure-step (S3-1) + served-survives-wrap
  // (S3-2) gates. No registry entry remains, so the meta-gate no longer expects it.
  // QUAR-S4-SERVING RETIRED 2026-06-11 (S4-3, one serving truth per lane): of
  // its five blocks' 23 needles, 20 were replaced by behaviour/VALUE asserts —
  // the keystone validate:s4:serving-equivalence gate (cell truth == published
  // records == mosaic == HUD aggregate == queue == cone data, on the REAL
  // exported projection, plus antenna imported-constant VALUE asserts + factory
  // wiring), the extended validate:phase-c:sinr-serving-mosaic:model/:browser
  // and validate:phase-c:sinr-live-cells:model behaviour gates, and the
  // standing validate:s4:pun-retired structural sweep. Per the S4-3 3-lens
  // review: 2 MainScene render-WIRING needles (the mosaic derivation lane gate
  // + the colour-oracle cell-truth selection) had no behavioural replacement
  // short of S5's shared selection resolver and were RE-WRAPPED into
  // QUAR-S5-BEAMRENDER (rule 3 escape hatch), and 1 net-new call-edge pin
  // (hook → buildPublishedPerUePositions) joined QUAR-S6-BUS so the keystone
  // gate provably certifies the projection the hook actually publishes. No
  // QUAR-S4-SERVING registry entry remains, so the meta-gate no longer
  // expects it.
  'QUAR-S5-BEAMRENDER': {
    retiringSlice: 'S5 (one beam render)',
    replacement:
      'ONE pure beam selector under invariant tests (incl. connected-sat-has-beam per lane), ONE cone renderer per lane with mesh-derived telemetry gates, ONE style token module — replacing JSX mount-string pins, per-component mesh micro-pins and layer-wiring text locks',
  },
  'QUAR-S6-BUS': {
    retiringSlice: 'S6 (split the runtime bus)',
    replacement:
      'typed render-plan lane gates (behavioral matrix), a control->engine single-channel contract test, and a lane-transition behavior test (focus cancelled, artifact state torn down, URL synced) replacing App.tsx internal-text and mount-position pins',
  },
  'QUAR-C1-DIRECTOR': {
    retiringSlice: 'C1 (camera/cinema rework)',
    replacement:
      'content-aware framing behavior gates on the post-S4 event geometry (from->to pair actually framed; warm handover replayed) replacing director-hook internal-text pins; the claim-kind/telemetry honesty locks stay permanent',
  },
  'QUAR-C2-TIMELINE': {
    retiringSlice: 'C2 (single playhead / single time axis)',
    replacement:
      'single-axis behavior gates on resolveTimelineRailDescriptor (already covered by the permanent behavioral matrix) + rail-marker==playhead-axis equivalence test replacing the display-stretched dual-axis attribute pins',
  },
};

const seenGroups = new Map<string, number>();

/** Called by the governance gate's tangleLockGroup() wrapper for each group execution. */
export function recordTangleLockGroup(groupId: string): void {
  if (!(groupId in TANGLE_LOCK_RETIREMENT)) {
    throw new Error(
      `tangle-lock group "${groupId}" is not in TANGLE_LOCK_RETIREMENT — register it (with retiring slice + replacement gates) before wrapping locks in it`,
    );
  }
  seenGroups.set(groupId, (seenGroups.get(groupId) ?? 0) + 1);
}

/**
 * Meta-gate + summary, called once at the end of the governance gate. Every
 * registered group must have executed at least once: a group that vanished
 * without its registry entry being deleted means locks were dropped outside
 * the retirement protocol.
 */
export function assertAndSummarizeTangleLockGroups(log: (line: string) => void): void {
  const missing = Object.keys(TANGLE_LOCK_RETIREMENT).filter(id => !seenGroups.has(id));
  if (missing.length > 0) {
    throw new Error(
      `tangle-lock groups registered but never executed: ${missing.join(', ')} — either the wrapped blocks were deleted without retiring the registry entry, or a wrapper id is misspelled`,
    );
  }
  for (const [id, blocks] of [...seenGroups.entries()].sort()) {
    const contract = TANGLE_LOCK_RETIREMENT[id];
    log(`  [quarantine] ${id}: ${blocks} block(s) — retires with ${contract.retiringSlice}`);
  }
}
