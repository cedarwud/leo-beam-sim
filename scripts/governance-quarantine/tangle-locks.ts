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
  // QUAR-RENDER-RESET RETIRED 2026-06-11 (S5-2, one beam render): all 4 blocks
  // retired with the cone un-park. Replacements landed in the same commit: the
  // render-plan matrix now asserts showSinrLiveCellBeams TRUE on sinr-live (false
  // on the 3 sibling lanes), the steered-mount auto-suppress + UE-anchor retirement
  // flow through the shared visible-beam resolver (src/scene/sinrLiveBeamSelection),
  // and validate:phase-c:sinr-live-cells:render:browser is re-added to the
  // live-render suite. No registry entry remains → the meta-gate no longer expects it.
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
  // QUAR-S5-BEAMRENDER group RETIRED 2026-06-11 (S5-2/S5-3, one beam render): the
  // tangleLockGroup wrappers + this registry entry are removed. HONEST disposition
  // of the 11 blocks — it is a SPLIT, not a uniform behavioural retirement:
  //
  //   A) 5 sinr-live CONE-render pins (the slice's ACTUAL scope) — RETIRED WITH
  //      BEHAVIOURAL REPLACEMENTS landed this commit:
  //        - parked-flag pin + steered-restore/anchor pin → the flipped renderPlan
  //          matrix (showSinrLiveCellBeams TRUE on sinr-live) + the shared
  //          visible-beam selector (src/scene/sinrLiveBeamSelection) consumed by
  //          BOTH the MainScene cone mount AND the connected-sat invariant;
  //        - serving-only / focus-cap / freq-colour / NormalBlending pins → the
  //          connected-sat-has-beam must-hold (validate:s0:connected-sat-has-beam,
  //          cone-cripple positive control) + validate:phase-c:sinr-live-cells:render
  //          (serving-only cones, freq-reuse colour, focusSatIds-null-draws-all,
  //          style-token VALUE asserts) + the permanent MainScene focusSatIds:null
  //          wiring lock;
  //        - buildSinrLiveCellLayout placement pin → the cone-base==truth-cell-centre
  //          BEHAVIOUR invariant in that same render gate;
  //        - D4-pair JSX/telemetry pin → the pair-resolver sourceOwner-guard test
  //          (render gate) + the re-added validate:phase-c:sinr-live-cells:render:browser.
  //
  //   B) 6 NON-cone pins — MODQN-lane render layers (handover story @ 2025, modqn
  //      service map, beam-load cylinder @ 2135, upload particles @ 2192/2229),
  //      live-effects/cinematic JSX @ 2626, and the S2/S4 3D-mosaic colour wiring @
  //      1559 — are GENUINELY separate layers from the sinr-live cone S5-2 flips
  //      (program §6 keeps them separate). They were NOT behaviourally replaced;
  //      they GRADUATED to permanent asserts (un-wrapped in place, still EXECUTE
  //      every run). Their feature behaviour is independently covered by the
  //      dedicated gates (validate:phase-3:beam-load / :upload-particles /
  //      :contention-render:browser, validate:modqn:handover-story-layer,
  //      beamLoadUploadParticles.test.ts) + the permanent renderPlan matrix
  //      (lane-gating) + the mesh-telemetry observables; the live-effects/cinematic
  //      lane-gating PROPERTY is covered by the permanent showLiveSceneEffects/
  //      showCinematicSpotlight matrix; the mosaic colour wiring keeps its two
  //      permanent text pins (no cheap behavioural replacement — its consolidation
  //      is S2/S4 mosaic scope). The brittle text-pin CONSOLIDATION of these MODQN-
  //      lane layers is DEFERRED to a separate MODQN-lane render slice — out of
  //      S5-2's sinr-live cone-flip scope. No registry entry remains → the meta-gate
  //      no longer expects this group.
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
