#!/usr/bin/env node
/**
 * check:handover -- cheap oracle for the owner's two standing questions
 * (SDD `docs/sdd/FRONTEND-AUTHORITY-REFACTOR-SDD.md` §5 P1, §6 Step 0):
 *
 *   1. Which of the seven known commit paths (SDD §2 F1) approved each
 *      handover commit observed below.
 *   2. Did any commit happen while the link it committed away FROM was
 *      still serving at or above the configured EE threshold.
 *
 * This is a READ-ONLY oracle. It drives `SinrLiveCellModel.step()` and
 * `HandoverManager.update()` through their real public entry points, using
 * the same fixtures as the acceptance tests in SDD §3, and reports what the
 * engines actually published (`HandoverCommitReceipt` / `HandoverEvent`) --
 * never "component mounted" or "DOM attribute present" (forbidden by SDD
 * §11, which records two false passes produced exactly that way).
 *
 * Exit code is 0 only if every scenario below produced the commit the
 * scenario is named for, with an approving path that is either EE-gated or
 * explicitly logged as EE-blind, and no EE-gated commit fired at/above
 * threshold. On the code as of commit 6b9474e this exits 1 -- SDD §3's five
 * tests are red, and the commits they document either did not happen or
 * happened with the wrong mode.
 *
 * Run: npm run check:handover
 */

import { buildCellLayout, elevationAngleRad } from '../src/engine/cells/cellLayout.ts';
import { loadProfile } from '../src/profiles/index.ts';
import {
  SinrLiveCellModel,
  cellIdFromLinkBudgetBeamId,
  cellLinkBudgetBeamId,
  intraCellLinkBudgetBeamId,
  resolveIntraCellBeamCenter,
  type CellModelSat,
} from '../src/scene/sinrLiveCellModel.ts';
import { buildSinrLiveCellLayout } from '../src/scene/sinrLiveCellRuntime.ts';
import type { CandidateOpportunity, HandoverCommitReceipt } from '../src/engine/handover/candidateDecisionContract.ts';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { HandoverEvent } from '../src/engine/handover/types.ts';
import type { LinkSample } from '../src/engine/signal/types.ts';
import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from '../src/engine/handover/eeThreshold.ts';

// ---------------------------------------------------------------------------
// Part 0 -- static regression guard on SDD §2 F1's line-number claims. If the
// source moved since F1 was written, everything below still runs, but the
// path labels it prints would silently go stale. Fail loudly instead.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

interface StaticClaim {
  readonly file: string;
  readonly line: number;
  readonly mustContain: string;
  readonly label: string;
}

const F1_STATIC_CLAIMS: readonly StaticClaim[] = [
  { file: 'src/engine/handover/handover-manager.ts', line: 221, mustContain: 'commitDecision(', label: 'initial/re-attach' },
  { file: 'src/engine/handover/handover-manager.ts', line: 265, mustContain: 'commitDecision(', label: 'continuity rescue intra-switch' },
  { file: 'src/engine/handover/handover-manager.ts', line: 319, mustContain: 'commitDecision(', label: 'inter-HO after stable pending hold' },
  { file: 'src/engine/handover/handover-manager.ts', line: 345, mustContain: 'commitDecision(', label: 'inter-HO stable target' },
  { file: 'src/engine/handover/handover-manager.ts', line: 389, mustContain: 'commitDecision(', label: 'intra-switch after dwell' },
  { file: 'src/scene/sinrLiveCellModel.ts', line: 2677, mustContain: 'selectServiceContinuityFallback(', label: 'service-continuity fallback' },
  { file: 'src/engine/handover/handoverSelectionPolicy.ts', line: 283, mustContain: 'function instantaneousEeTriggerStatus(', label: 'the one EE-gated path' },
];

interface StaticCheckResult {
  readonly claim: StaticClaim;
  readonly ok: boolean;
  readonly actualLine: string;
}

function checkStaticClaims(): StaticCheckResult[] {
  return F1_STATIC_CLAIMS.map(claim => {
    const text = readFileSync(join(repoRoot, claim.file), 'utf8').split('\n');
    const actualLine = text[claim.line - 1] ?? '';
    return { claim, ok: actualLine.includes(claim.mustContain), actualLine };
  });
}

// ---------------------------------------------------------------------------
// Part 1 -- shared record shape for every commit observed, from either engine.
// ---------------------------------------------------------------------------

type EeGateStatus = 'below-threshold' | 'at-or-above-threshold' | 'not-applicable-initial-attach' | 'unknown-ee-blind-engine';

interface CommitRecord {
  readonly scenario: string;
  readonly engine: 'sinrLiveCellModel' | 'handover-manager';
  readonly simTimeMs: number;
  readonly kind: string;
  readonly mode: string | null;
  readonly reason: string;
  readonly from: string | null;
  readonly to: string;
  readonly approvingPath: string;
  readonly pathConsultsEeThreshold: boolean;
  readonly servingEeBitsPerJouleAtCommit: number | null;
  readonly thresholdBitsPerJoule: number | null;
  readonly eeGateStatus: EeGateStatus;
}

const records: CommitRecord[] = [];
const failures: string[] = [];

function fail(message: string): void {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

// ---------------------------------------------------------------------------
// Part 2 -- SinrLiveCellModel scenarios (the live-scene decision authority).
// Fixtures reused verbatim from the parameters in
// src/scene/sinrLiveCellDecisionAuthority.test.ts and
// src/scene/sinrLiveCellIntraDecision.test.ts (SDD §3's five red tests).
// ---------------------------------------------------------------------------

const OBSERVER = { latDeg: 25.1519, lonDeg: 121.7811 };
const EPOCH_MS = Date.UTC(2026, 7, 27, 12, 0, 0);
const EE_THRESHOLD_BITS_PER_JOULE = DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE * 1000;

function satellite(id: string, lonOffsetDeg: number): CellModelSat {
  return {
    id,
    shellId: 'walker-authority-check',
    altitudeKm: 550,
    latDeg: OBSERVER.latDeg,
    lonDeg: OBSERVER.lonDeg + lonOffsetDeg,
    topo: {
      azimuthDeg: lonOffsetDeg < 0 ? 270 : lonOffsetDeg > 0 ? 90 : 0,
      elevationDeg: 80,
    },
  };
}

function classifySinrLiveCellPath(mode: string): { approvingPath: string; consultsEe: boolean } {
  if (mode === 'ee-optimization') {
    return {
      approvingPath: 'handoverSelectionPolicy.ts:283 instantaneousEeTriggerStatus (via HandoverDecisionEngine.step -> InstantaneousEePolicy)',
      consultsEe: true,
    };
  }
  if (mode === 'service-continuity-protection') {
    return {
      approvingPath: 'sinrLiveCellModel.ts:2650 selectServiceContinuityFallback',
      consultsEe: false,
    };
  }
  return {
    approvingPath: `sinrLiveCellModel.ts primary decision authority (unrecognized mode "${mode}")`,
    consultsEe: false,
  };
}

/** EE evidence for one candidate key from a prior frame's opportunity set. */
function eeForKey(opportunities: readonly CandidateOpportunity[], satelliteId: string, beamId: number): number | null {
  const match = opportunities.find(item => item.key.satelliteId === satelliteId && item.key.beamId === beamId);
  if (match?.instantaneousEe?.status !== 'available') return null;
  return match.instantaneousEe.value;
}

function recordSinrLiveCellCommit(
  scenario: string,
  commit: HandoverCommitReceipt,
  priorOpportunities: readonly CandidateOpportunity[],
): void {
  const { approvingPath, consultsEe } = classifySinrLiveCellPath(commit.mode);
  const servingEe = commit.from === null
    ? null
    : eeForKey(priorOpportunities, commit.from.satelliteId, commit.from.beamId);
  let eeGateStatus: EeGateStatus;
  if (commit.from === null) {
    eeGateStatus = 'not-applicable-initial-attach';
  } else if (servingEe === null) {
    eeGateStatus = 'unknown-ee-blind-engine';
  } else {
    eeGateStatus = servingEe >= EE_THRESHOLD_BITS_PER_JOULE ? 'at-or-above-threshold' : 'below-threshold';
  }
  records.push({
    scenario,
    engine: 'sinrLiveCellModel',
    simTimeMs: commit.simTimeMs,
    kind: commit.kind,
    mode: commit.mode,
    reason: commit.reason,
    from: commit.from ? `${commit.from.satelliteId}:${commit.from.beamId}` : null,
    to: `${commit.to.satelliteId}:${commit.to.beamId}`,
    approvingPath,
    pathConsultsEeThreshold: consultsEe,
    servingEeBitsPerJouleAtCommit: servingEe,
    thresholdBitsPerJoule: EE_THRESHOLD_BITS_PER_JOULE,
    eeGateStatus,
  });
  if (eeGateStatus === 'at-or-above-threshold') {
    fail(
      `[${scenario}] commit ${commit.from?.satelliteId}:${commit.from?.beamId} -> `
      + `${commit.to.satelliteId}:${commit.to.beamId} fired while serving EE `
      + `${servingEe} bit/J was >= threshold ${EE_THRESHOLD_BITS_PER_JOULE} bit/J (mode=${commit.mode})`,
    );
  }
}

function scenarioPrimaryInterHandover(): void {
  const scenario = 'primary multi-candidate inter-handover (SDD §3 test 1)';
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: { ...baseProfile.handover, sinrThresholdDb: -100, offsetDb: 0.1, triggerTimeSec: 1, pingPongGuardSec: 1 },
  };
  const layout = buildCellLayout({
    centerLatDeg: OBSERVER.latDeg,
    centerLonDeg: OBSERVER.lonDeg,
    altitudeKm: 550,
    beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
    cellCount: 7,
  });
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: layout,
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  });
  // lonOffset 5.5deg puts SAT-A's real (post-F3) EE at ~122-125 Kbit/J, ~8-10%
  // below the 135 Kbit/J floor -- not a boundary value. Values empirically
  // measured against the real SinrLiveCellModel by a fork earlier this
  // session (topo.elevationDeg does not drive the physics; lon/lat/altitude
  // does -- see decisionEe.ts). SAT-A starts at zenith (0deg) so it
  // legitimately wins initial attach, which requires the target's EE to
  // already clear the floor.
  const ue = { id: 'ue-primary', eastKm: 8, northKm: 2 };
  model.step({ visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.8), satellite('SAT-C', -1.5)], ues: [ue], simTimeSec: 0, dtSec: 0 });
  let priorOpportunities = model.getHandoverDecisionFrame()?.opportunities ?? [];
  model.step({ visibleSats: [satellite('SAT-A', 5.5), satellite('SAT-B', 0), satellite('SAT-C', -1.5)], ues: [ue], simTimeSec: 1, dtSec: 1 });
  priorOpportunities = model.getHandoverDecisionFrame()?.opportunities ?? priorOpportunities;
  model.step({ visibleSats: [satellite('SAT-A', 5.5), satellite('SAT-B', 0), satellite('SAT-C', -1.5)], ues: [ue], simTimeSec: 2, dtSec: 1 });
  const decision = model.getHandoverDecisionFrame();
  if (decision?.recentCommit) {
    recordSinrLiveCellCommit(scenario, decision.recentCommit, priorOpportunities);
  } else {
    fail(`[${scenario}] expected one accepted commit receipt after TTT + selection hold; got recentCommit=null (mode=${decision?.mode ?? 'null'}, phase=${decision?.phase ?? 'null'})`);
  }
}

function scenarioServiceContinuityFallback(): void {
  const scenario = 'vanished serving pair -> service-continuity fallback (SDD §3 test 2)';
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: { ...baseProfile.handover, sinrThresholdDb: -100, offsetDb: 0.1, triggerTimeSec: 5, pingPongGuardSec: 1 },
  };
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: buildCellLayout({
      centerLatDeg: OBSERVER.latDeg, centerLonDeg: OBSERVER.lonDeg, altitudeKm: 550,
      beamwidth3dBRad: profile.antenna.beamwidth3dBRad, cellCount: 7,
    }),
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  });
  // Same degrade pattern as the primary-inter-handover scenario above: SAT-A
  // starts at zenith (legitimate initial attach), degrades to 5.5deg
  // (~125 Kbit/J, genuinely below floor) while still visible, then vanishes.
  const ue = { id: 'ue-primary', eastKm: 4, northKm: 1 };
  model.step({ visibleSats: [satellite('SAT-A', 0), satellite('SAT-B', 1.5)], ues: [ue], simTimeSec: 0, dtSec: 0 });
  model.step({ visibleSats: [satellite('SAT-A', 5.5), satellite('SAT-B', 1.5)], ues: [ue], simTimeSec: 1, dtSec: 1 });
  const priorOpportunities = model.getHandoverDecisionFrame()?.opportunities ?? [];
  model.step({ visibleSats: [satellite('SAT-B', 0)], ues: [ue], simTimeSec: 2, dtSec: 1 });
  const decision = model.getHandoverDecisionFrame();
  if (decision?.recentCommit) {
    recordSinrLiveCellCommit(scenario, decision.recentCommit, priorOpportunities);
    if (decision.recentCommit.mode !== 'service-continuity-protection') {
      fail(`[${scenario}] expected mode "service-continuity-protection", got "${decision.recentCommit.mode}"`);
    }
  } else {
    fail(
      `[${scenario}] expected an explicit measured continuity commit; got recentCommit=null (mode=${decision?.mode ?? 'null'}). `
      + 'Known root cause (confirmed by a fork this session): the post-vanish "last known EE" fallback '
      + '(sinrLiveCellModel.ts, this.homepageDemoEeStates) still reads the seeded DISPLAY trajectory, not a history '
      + "of the real physics EE that decisionEe.ts's F3 fix now uses for the live-measured case. "
      + 'A second, narrower instance of F3 survived the first fix, inside code this script is not authorized to change.',
    );
  }
}

function scenarioDetachNoReplacement(): void {
  const scenario = 'vanished serving pair, no replacement -> explicit detach (SDD §3 test 3)';
  const profile = loadProfile('hobs-2024-candidate-rich');
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: buildCellLayout({
      centerLatDeg: OBSERVER.latDeg, centerLonDeg: OBSERVER.lonDeg, altitudeKm: 550,
      beamwidth3dBRad: profile.antenna.beamwidth3dBRad, cellCount: 7,
    }),
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
    coverageSteeringAngleDeg: 50,
  });
  const ue = { id: 'ue-primary', eastKm: 0, northKm: 0 };
  model.step({ visibleSats: [satellite('SAT-A', 0)], ues: [ue], simTimeSec: 0, dtSec: 0 });
  model.step({ visibleSats: [], ues: [ue], simTimeSec: 1, dtSec: 1 });
  const decision = model.getHandoverDecisionFrame();
  console.log(`  [${scenario}] no commit expected (detach). phase=${decision?.phase}, serving=${JSON.stringify(decision?.serving)}, recentCommit=${JSON.stringify(decision?.recentCommit)}`);
  if (decision?.phase !== 'initial-attach') {
    fail(`[${scenario}] expected phase "initial-attach" after an unrecoverable detach, got "${decision?.phase}"`);
  }
  if (decision?.serving !== null) {
    fail(`[${scenario}] expected serving=null after an unrecoverable detach, got ${JSON.stringify(decision?.serving)}`);
  }
}

function scenarioIntraCommit(cellCount: 1 | 7): void {
  const scenario = `${cellCount}-cell intra commit (SDD §3 test ${cellCount === 1 ? 4 : 5})`;
  const localObserver = { latDeg: 40, lonDeg: 116 };
  const localEpochMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: {
      ...baseProfile.handover,
      sinrThresholdDb: -100, offsetDb: 0, triggerTimeSec: 1, intraSwitchTimeSec: 0.75,
      pingPongGuardSec: 0, minimumDistinctCandidateSatellites: 0,
    },
    beams: { ...baseProfile.beams, frequencyReuse: 3 },
  };
  const layout = buildSinrLiveCellLayout(profile, cellCount);
  // Directly overhead (0deg offset) put real (post-F3) EE at ~648k/666k
  // bit/J -- 4-5x the 135 Kbit/J floor. A lon offset of 6.5deg gives a real
  // elevation of ~41deg, where measured EE lands at ~124k/126k bit/J:
  // genuinely below the floor, alternate still measurably higher than normal.
  // Empirically measured against the real SinrLiveCellModel by a fork this
  // session -- topo.elevationDeg is a display/visibility-gate value only and
  // does not drive the physics (see decisionEe.ts); the real lon/lat/altitude
  // geometry does, hence computing it via elevationAngleRad here.
  const satLonOffsetDeg = 6.5;
  const satLonDeg = localObserver.lonDeg + satLonOffsetDeg;
  const realElevationDeg = (elevationAngleRad(
    localObserver.latDeg, satLonDeg, 550, localObserver.latDeg, localObserver.lonDeg,
  ) * 180) / Math.PI;
  const sat: CellModelSat = {
    id: 'SAT-INTRA', shellId: 'shell-intra-check', altitudeKm: 550,
    latDeg: localObserver.latDeg, lonDeg: satLonDeg,
    topo: { azimuthDeg: 90, elevationDeg: realElevationDeg },
  };
  const variantCenter = resolveIntraCellBeamCenter(layout.centers[0]!, layout.cellRadiusKm, localObserver);
  // 7-cell layouts require the full default gate set (steering included);
  // at this offset the real scan angle for both candidate beams is
  // ~45.1-45.2deg, over the base profile's 40deg maxSteeringAngleDeg. A
  // declared teaching-scenario widening (SDD §9's "declared synthetic
  // scenario" option), scoped to only this scenario via the existing
  // per-instance override -- identical values and derivation to what's now
  // in sinrLiveCellIntraDecision.test.ts: 48deg gives ~2.8deg margin over the
  // measured ~45.17deg ceiling; 5.76 = 4 * (48/40)^2 preserves the original
  // 40deg point's 4 dB scan loss (computeSteeringLossDb in link-budget.ts).
  const sevenCellSteeringOverride = cellCount === 7
    ? { maxSteeringAngleOverrideDeg: 48, scanLossAtMaxSteeringOverrideDb: 5.76 }
    : {};
  const model = new SinrLiveCellModel({
    profile, cellLayout: layout, observer: localObserver, epochUtcMs: localEpochMs,
    candidateOpportunityMeasurementEnabled: true, multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false, beamsPerSat: Infinity, coverageSteeringAngleDeg: 50,
    ...sevenCellSteeringOverride,
  });
  const ue = { id: `ue-${cellCount}`, eastKm: variantCenter.localXKm, northKm: variantCenter.localYKm };
  model.step({ visibleSats: [sat], ues: [ue], simTimeSec: 0, dtSec: 0 });
  const variantBeamId = intraCellLinkBudgetBeamId(0);
  const normalBeamId = cellLinkBudgetBeamId(0);

  const startDecision = model.getHandoverDecisionFrame();
  const normalOpp = startDecision?.opportunities.find(item => item.key.beamId === normalBeamId);
  const variantOpp = startDecision?.opportunities.find(item => item.key.beamId === variantBeamId);
  const normalEe = normalOpp?.instantaneousEe?.status === 'available' ? normalOpp.instantaneousEe.value : null;
  const variantEe = variantOpp?.instantaneousEe?.status === 'available' ? variantOpp.instantaneousEe.value : null;
  console.log(`  [${scenario}] at t=0: normal-cell EE=${normalEe ?? 'n/a'} bit/J, same-cell-alternate EE=${variantEe ?? 'n/a'} bit/J (alternate must be strictly greater for the EE policy to ever prefer it)`);
  if (normalEe === null || variantEe === null || !(variantEe > normalEe)) {
    fail(`[${scenario}] root cause: at t=0 the same-cell alternate beam's EE (${variantEe ?? 'n/a'}) does not exceed the normal beam's EE (${normalEe ?? 'n/a'}), so InstantaneousEePolicy has no reason to ever select it -- matches SDD §3's "the fixed alternate geometry wins the instantaneous EE policy at its boresight" assertion, which fails on this code`);
  }

  let priorOpportunities = model.getHandoverDecisionFrame()?.opportunities ?? [];
  let committedReceipt: HandoverCommitReceipt | null = null;
  for (let step = 1; step <= 20 && committedReceipt === null; step += 1) {
    const simTimeSec = step * 0.25;
    model.step({ visibleSats: [sat], ues: [ue], simTimeSec, dtSec: 0.25 });
    const decision = model.getHandoverDecisionFrame();
    if (decision?.recentCommit) {
      committedReceipt = decision.recentCommit;
      break;
    }
    priorOpportunities = decision?.opportunities ?? priorOpportunities;
  }
  if (committedReceipt) {
    recordSinrLiveCellCommit(scenario, committedReceipt, priorOpportunities);
    // The production model enumerates all 6 synthetic same-cell beam
    // variants per geographic cell as candidates, not just the one variant
    // this scenario happens to compute above -- in the 7-cell layout their
    // real EE values sit within ~1% of each other, so pinning the exact
    // winning variant is fragile (a fork found variant 2 legitimately
    // outscoring variant 1 by ~0.3% once steering was widened). What matters
    // for the acceptance criterion is that the commit stays in this cell and
    // genuinely switches beams.
    if (cellIdFromLinkBudgetBeamId(committedReceipt.to.beamId) !== 0) {
      fail(`[${scenario}] committed to beam ${committedReceipt.to.beamId}, expected it to stay in geographic cell 0`);
    } else if (committedReceipt.to.beamId === normalBeamId) {
      fail(`[${scenario}] committed to the same beam it started on (${normalBeamId}) -- not a real switch`);
    }
  } else if (cellCount === 7) {
    fail(
      `[${scenario}] no commit within 20 steps (5s), even with the 48deg steering override applied. `
      + 'This scenario previously failed because 7-cell layouts require the "steering" gate '
      + '(antenna maxSteeringAngleDeg=40deg), which needed elevation >=~48deg while the EE floor needed '
      + 'elevation <=~43.6deg -- non-overlapping. That was resolved with a declared teaching-scenario '
      + 'steering override (maxSteeringAngleOverrideDeg=48, scanLossAtMaxSteeringOverrideDb=5.76). '
      + 'If this is still failing, the override stopped being sufficient -- re-measure, do not re-apply blindly.',
    );
  } else {
    fail(`[${scenario}] no commit within 20 steps (5s); the same-cell alternate beam never won the EE policy -- see SDD §3's "the fixed alternate geometry wins" assertion, which fails on this code`);
  }
}

// ---------------------------------------------------------------------------
// Part 3 -- HandoverManager scenarios (the rail-timeline engine, F10). This
// engine receives LinkSample[] (SINR only) and never sees EE at all, so every
// commit it produces is structurally EE-blind -- reported, not inferred.
// ---------------------------------------------------------------------------

function classifyHandoverManagerReason(reason: string): { approvingPath: string } {
  if (/^(initial attach|re-attach after service loss)/.test(reason)) {
    return { approvingPath: 'handover-manager.ts:221 (initial attach / re-attach)' };
  }
  if (/^continuity rescue/.test(reason)) {
    return { approvingPath: 'handover-manager.ts:265 (continuity rescue intra-switch)' };
  }
  if (/stable pending hold/.test(reason)) {
    return { approvingPath: 'handover-manager.ts:319 (inter-HO after stable pending hold)' };
  }
  if (/stable target for/.test(reason)) {
    return { approvingPath: 'handover-manager.ts:345 (inter-HO stable target)' };
  }
  if (/dwell$/.test(reason)) {
    return { approvingPath: 'handover-manager.ts:389 (intra-switch after dwell, F2: gated on SINR only)' };
  }
  return { approvingPath: `handover-manager.ts (unrecognized reason "${reason}")` };
}

function recordHandoverManagerEvent(scenario: string, event: HandoverEvent): void {
  const { approvingPath } = classifyHandoverManagerReason(
    // eventLog entries don't carry `reason`; re-derive the label from action + presence of fromSatId.
    event.action === 'inter-handover' && event.fromSatId === null
      ? 'initial attach'
      : event.action,
  );
  records.push({
    scenario,
    engine: 'handover-manager',
    simTimeMs: event.timeMs,
    kind: event.action,
    mode: null,
    reason: `action=${event.action} deltaDb=${event.deltaDb ?? 'n/a'}`,
    from: event.fromSatId !== null ? `${event.fromSatId}:${event.fromBeamId}` : null,
    to: `${event.toSatId}:${event.toBeamId}`,
    approvingPath,
    pathConsultsEeThreshold: false,
    servingEeBitsPerJouleAtCommit: null,
    thresholdBitsPerJoule: null,
    eeGateStatus: event.fromSatId === null ? 'not-applicable-initial-attach' : 'unknown-ee-blind-engine',
  });
}

const sample = (satId: string, beamId: number, sinrDb: number): LinkSample => ({ satId, beamId, sinrDb } as LinkSample);

function scenarioHandoverManagerInitialAttach(): void {
  const scenario = 'handover-manager initial attach (F1 line 221)';
  const manager = new HandoverManager(loadProfile('hobs-2024-paper-default').handover, { enforceSharedHandoverInterval: true });
  const decision = manager.update([sample('sat-a', 0, 10)], 0, 0);
  console.log(`  [${scenario}] decision=${JSON.stringify(decision)}`);
  if (decision.action !== 'inter-handover') {
    fail(`[${scenario}] expected initial attach to commit inter-handover, got action="${decision.action}" reason="${decision.reason}"`);
    return;
  }
  const event = manager.eventLog[manager.eventLog.length - 1]!;
  recordHandoverManagerEvent(scenario, event);
  const { approvingPath } = classifyHandoverManagerReason('initial attach');
  const idx = records.length - 1;
  records[idx] = { ...records[idx]!, approvingPath, reason: decision.reason };
}

function scenarioHandoverManagerInterThenContinuityRescue(): void {
  // Sequence lifted from src/engine/handover/handover-manager.test.ts, which
  // this repo's own tests use to exercise inter-HO stable-target commit and
  // continuity-rescue intra-switch commit back to back.
  const scenario = 'handover-manager inter-HO + continuity rescue (F1 lines 319/345, 265)';
  const epochMs = Date.UTC(2026, 0, 1);
  const manager = new HandoverManager(loadProfile('hobs-2024-paper-default').handover, { enforceSharedHandoverInterval: true });
  manager.state = { satId: 'sat-a', beamId: 0, sinrDb: 10, triggerTimeSec: 0, pendingTarget: null };
  manager.update([sample('sat-a', 0, 10), sample('sat-b', 0, 20)], 0, epochMs);
  const inter = manager.update([sample('sat-a', 0, 10), sample('sat-b', 0, 20)], 4, epochMs + 4000);
  if (inter.action !== 'inter-handover') {
    fail(`[${scenario}] expected inter-handover after 4s stable target, got "${inter.action}": ${inter.reason}`);
  } else {
    const event = manager.eventLog[manager.eventLog.length - 1]!;
    recordHandoverManagerEvent(scenario, event);
    const idx = records.length - 1;
    records[idx] = { ...records[idx]!, reason: inter.reason, approvingPath: classifyHandoverManagerReason(inter.reason).approvingPath };
  }
  // Serving beam (sat-b/0) drops out of the candidate set entirely; a
  // same-satellite sibling beam (sat-b/1) remains steerable above threshold.
  const guardBlocked = manager.update([sample('sat-b', 1, 20), sample('sat-a', 0, 5)], 6, epochMs + 10000);
  if (guardBlocked.action !== 'intra-switch') {
    fail(`[${scenario}] expected continuity-rescue intra-switch once the shared guard cleared, got "${guardBlocked.action}": ${guardBlocked.reason}`);
  } else {
    const event = manager.eventLog[manager.eventLog.length - 1]!;
    recordHandoverManagerEvent(scenario, event);
    const idx = records.length - 1;
    records[idx] = { ...records[idx]!, reason: guardBlocked.reason, approvingPath: classifyHandoverManagerReason(guardBlocked.reason).approvingPath };
  }
}

function scenarioHandoverManagerOrdinaryIntraDwell(): void {
  const scenario = 'handover-manager ordinary intra dwell, SINR only (F1/F2 line 389)';
  const manager = new HandoverManager(loadProfile('hobs-2024-paper-default').handover, { enforceSharedHandoverInterval: false });
  manager.state = { satId: 'sat-a', beamId: 0, sinrDb: 0, triggerTimeSec: 0, pendingTarget: null };
  manager.update([sample('sat-a', 0, 0), sample('sat-a', 1, 8)], 0, 0);
  const commit = manager.update([sample('sat-a', 0, 0), sample('sat-a', 1, 8)], 1, 1000);
  console.log(`  [${scenario}] commit=${JSON.stringify(commit)}`);
  if (commit.action !== 'intra-switch') {
    fail(`[${scenario}] expected an ordinary (non-rescue) intra-switch once dwell elapsed, got "${commit.action}": ${commit.reason}`);
    return;
  }
  const event = manager.eventLog[manager.eventLog.length - 1]!;
  recordHandoverManagerEvent(scenario, event);
  const idx = records.length - 1;
  records[idx] = { ...records[idx]!, reason: commit.reason, approvingPath: classifyHandoverManagerReason(commit.reason).approvingPath };
}

// ---------------------------------------------------------------------------
// Run everything, then print the raw machine-readable report.
// ---------------------------------------------------------------------------

console.log('=== check:handover -- static F1 claims ===');
const staticResults = checkStaticClaims();
for (const result of staticResults) {
  const status = result.ok ? 'ok' : 'DRIFTED';
  console.log(`  [${status}] ${result.claim.file}:${result.claim.line} (${result.claim.label})`);
  if (!result.ok) {
    console.log(`    expected to contain: ${result.claim.mustContain}`);
    console.log(`    actual line: ${result.actualLine.trim()}`);
    fail(`static claim drifted: ${result.claim.file}:${result.claim.line} no longer contains "${result.claim.mustContain}"`);
  }
}

console.log('\n=== check:handover -- running scenarios ===');
const scenarios: Array<[string, () => void]> = [
  ['primaryInterHandover', scenarioPrimaryInterHandover],
  ['serviceContinuityFallback', scenarioServiceContinuityFallback],
  ['detachNoReplacement', scenarioDetachNoReplacement],
  ['intraCommit(1-cell)', () => scenarioIntraCommit(1)],
  ['intraCommit(7-cell)', () => scenarioIntraCommit(7)],
  ['handoverManagerInitialAttach', scenarioHandoverManagerInitialAttach],
  ['handoverManagerInterThenContinuityRescue', scenarioHandoverManagerInterThenContinuityRescue],
  ['handoverManagerOrdinaryIntraDwell', scenarioHandoverManagerOrdinaryIntraDwell],
];
for (const [name, run] of scenarios) {
  try {
    run();
  } catch (error) {
    fail(`[${name}] threw: ${(error as Error).stack ?? String(error)}`);
  }
}

console.log('\n=== check:handover -- Q1: which path approved each commit ===');
console.log(JSON.stringify(records, null, 2));

console.log('\n=== check:handover -- Q2: any commit at/above the EE threshold? ===');
const eeGatedRecords = records.filter(r => r.pathConsultsEeThreshold || r.engine === 'sinrLiveCellModel');
const violations = eeGatedRecords.filter(r => r.eeGateStatus === 'at-or-above-threshold');
console.log(`  EE-observable commits: ${eeGatedRecords.length}`);
console.log(`  violations (committed at/above threshold): ${violations.length}`);
console.log(`  EE-blind commits (handover-manager.ts, never reads EE): ${records.filter(r => r.engine === 'handover-manager').length}`);

console.log('\n=== check:handover -- verdict ===');
if (failures.length > 0) {
  console.log(`RED: ${failures.length} failure(s).`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('GREEN: all scenarios committed as expected; no EE-gated commit fired at/above threshold.');
  process.exit(0);
}
