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
 * Exit code is 0 only if ALL of the following hold:
 *   - every scenario produced the commit it is named for;
 *   - no EE-gated commit fired while its source was at/above the threshold;
 *   - every structural F1 claim still resolves through the syntax tree;
 *   - the commit-path count still equals EXPECTED_COMMIT_PATH_COUNT, which is
 *     derived from the HandoverCommitPath union rather than written here;
 *   - no commit symbol escapes as a value (an alias is a route the count
 *     cannot see);
 *   - no EeCommitPermit is forged by type assertion outside its own module;
 *   - every EE-blind commit is one the ledger already knows about, compared as
 *     a multiset so a duplicate cannot hide behind an existing key;
 *   - every declared commit path was actually OBSERVED by a scenario. A
 *     structural claim proves a call site exists, not that it can still fire.
 *
 * It exited 1 through 6b9474e/df0ce68, where SDD §3 test 3 was red.
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
import type { HandoverDecision, HandoverEvent } from '../src/engine/handover/types.ts';
import {
  HANDOVER_COMMIT_PATHS,
  handoverCommitPathConsultsEeThreshold,
  type HandoverCommitPath,
} from '../src/engine/handover/commitProvenance.ts';
import type { LinkSample } from '../src/engine/signal/types.ts';
import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from '../src/engine/handover/eeThreshold.ts';

// ---------------------------------------------------------------------------
// Part 0 -- static regression guard on SDD §2 F1's line-number claims. If the
// source moved since F1 was written, everything below still runs, but the
// path labels it prints would silently go stale. Fail loudly instead.
// ---------------------------------------------------------------------------

import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Part 0 -- structural F1 claims.
//
// These claims used to pin absolute line numbers ("handover-manager.ts:221
// must contain `commitDecision(`"). That made the one tool able to verify the
// convergence of the seven commit paths the first casualty of that
// convergence: any insertion or deletion above a pinned line invalidated it,
// and a 7-line deletion did exactly that once. Claims are now resolved through
// the TypeScript syntax tree, so they follow the symbol instead of the line.
//
// The topology assertion below is deliberately NOT drift-tolerant. Line drift
// is noise; a change in HOW MANY commit paths exist is the event this whole
// exercise is about, so it must stop the run until a human has re-read every
// claim and updated the expected count on purpose.
// ---------------------------------------------------------------------------

type StructuralClaim =
  | {
    readonly kind: 'call-with-argument';
    readonly file: string;
    readonly callee: string;
    readonly argumentIndex: number;
    readonly argumentPattern: RegExp;
    readonly label: string;
  }
  | { readonly kind: 'call'; readonly file: string; readonly callee: string; readonly label: string }
  | { readonly kind: 'function-declared'; readonly file: string; readonly name: string; readonly label: string };

// The five manager claims match the PERMIT argument, not the reason sentence.
// Matching the reason (argument 4) made these claims fail whenever a message
// was reworded -- a cosmetic edit reported as a missing commit path. Argument 5
// is the EeCommitPermit, so these change only when the authority does. Matching
// the whole mint call rather than just the path literal also asserts that the
// permit came from a mint function instead of being passed in from elsewhere.
const F1_STRUCTURAL_CLAIMS: readonly StructuralClaim[] = [
  {
    kind: 'call-with-argument',
    file: 'src/engine/handover/handover-manager.ts',
    callee: 'commitDecision',
    argumentIndex: 5,
    argumentPattern: /^mintInitialAttachPermit\('manager:initial-attach'\)$/,
    label: 'initial/re-attach',
  },
  {
    kind: 'call-with-argument',
    file: 'src/engine/handover/handover-manager.ts',
    callee: 'commitDecision',
    argumentIndex: 5,
    argumentPattern: /^mintLegacyEeBlindPermit\('manager:continuity-rescue'\)$/,
    label: 'continuity rescue intra-switch',
  },
  {
    kind: 'call-with-argument',
    file: 'src/engine/handover/handover-manager.ts',
    callee: 'commitDecision',
    argumentIndex: 5,
    argumentPattern: /^mintLegacyEeBlindPermit\('manager:inter-stable-pending-hold'\)$/,
    label: 'inter-HO after stable pending hold',
  },
  {
    kind: 'call-with-argument',
    file: 'src/engine/handover/handover-manager.ts',
    callee: 'commitDecision',
    argumentIndex: 5,
    argumentPattern: /^mintLegacyEeBlindPermit\('manager:inter-stable-target'\)$/,
    label: 'inter-HO stable target',
  },
  {
    kind: 'call-with-argument',
    file: 'src/engine/handover/handover-manager.ts',
    callee: 'commitDecision',
    argumentIndex: 5,
    argumentPattern: /^mintLegacyEeBlindPermit\('manager:intra-dwell'\)$/,
    label: 'intra-switch after dwell',
  },
  {
    kind: 'call',
    file: 'src/scene/sinrLiveCellModel.ts',
    callee: 'selectServiceContinuityFallback',
    label: 'service-continuity fallback',
  },
  {
    kind: 'function-declared',
    file: 'src/engine/handover/handoverSelectionPolicy.ts',
    name: 'instantaneousEeTriggerStatus',
    label: 'the one EE-gated path',
  },
];

// The deliberately brittle half of the hybrid. Each entry counts one KIND of
// commit authority; the total is the seven paths of SDD §2 F1. Converging the
// paths (P3) is expected to break this on purpose.
const COMMIT_PATH_TOPOLOGY: readonly {
  readonly file: string;
  readonly what: string;
  readonly expected: number;
  readonly count: () => number;
}[] = [
  {
    file: 'src/engine/handover/handover-manager.ts',
    what: 'commitDecision(...) call sites',
    expected: 5,
    count: () => callSites('src/engine/handover/handover-manager.ts', 'commitDecision').length,
  },
  {
    file: 'src/scene/sinrLiveCellModel.ts',
    what: 'selectServiceContinuityFallback(...) call sites',
    expected: 1,
    count: () => callSites('src/scene/sinrLiveCellModel.ts', 'selectServiceContinuityFallback').length,
  },
  {
    file: 'src/engine/handover/handoverSelectionPolicy.ts',
    what: 'instantaneousEeTriggerStatus declarations',
    expected: 1,
    count: () => functionDeclarations(
      'src/engine/handover/handoverSelectionPolicy.ts',
      'instantaneousEeTriggerStatus',
    ).length,
  },
];

// Derived from the provenance union rather than written here, so the declared
// set of commit paths and the counted set cannot drift apart silently: adding a
// member to HandoverCommitPath without adding the call site that uses it (or
// vice versa) fails this gate.
const EXPECTED_COMMIT_PATH_COUNT = HANDOVER_COMMIT_PATHS.length;

/** Symbols that must only ever appear as a direct callee -- see escapingReferences. */
/**
 * Files allowed to write `as ... EeCommitPermit`.
 *
 * The permit's brand stops an object literal from satisfying the type, but no
 * TypeScript construct stops a determined `as unknown as EeCommitPermit` -- a
 * private class field was tried and does not stop it either. So forging a
 * permit is blocked mechanically here instead: a type assertion naming
 * EeCommitPermit outside its own module means some path granted itself
 * authority to commit without going through a mint.
 */
const EE_COMMIT_PERMIT_ASSERTION_ALLOWLIST: readonly string[] = [
  'src/engine/handover/eeCommitPermit.ts',
];

/** Every `<expr> as T` / `<T>expr` in `file` whose asserted type names `typeName`. */
function permitTypeAssertions(file: string, typeName: string): ts.Node[] {
  const found: ts.Node[] = [];
  eachNode(sourceFileFor(file), node => {
    if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) return;
    if (node.type.getText().includes(typeName)) found.push(node);
  });
  return found;
}

const COMMIT_SYMBOLS_THAT_MAY_NOT_ESCAPE: readonly { readonly file: string; readonly name: string }[] = [
  { file: 'src/engine/handover/handover-manager.ts', name: 'commitDecision' },
  { file: 'src/scene/sinrLiveCellModel.ts', name: 'selectServiceContinuityFallback' },
];

const parsedSources = new Map<string, ts.SourceFile>();

function sourceFileFor(file: string): ts.SourceFile {
  const cached = parsedSources.get(file);
  if (cached !== undefined) return cached;
  const text = readFileSync(join(repoRoot, file), 'utf8');
  const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  parsedSources.set(file, parsed);
  return parsed;
}

function eachNode(node: ts.Node, visit: (candidate: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, child => { eachNode(child, visit); });
}

/** `foo(...)` and `this.foo(...)` both resolve to the name `foo`. */
function calleeName(node: ts.CallExpression): string | null {
  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function callSites(file: string, callee: string): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];
  eachNode(sourceFileFor(file), node => {
    if (ts.isCallExpression(node) && calleeName(node) === callee) found.push(node);
  });
  return found;
}

function functionDeclarations(file: string, name: string): ts.Node[] {
  const found: ts.Node[] = [];
  eachNode(sourceFileFor(file), node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found.push(node);
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === name
      && node.initializer !== undefined
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      found.push(node);
    }
  });
  return found;
}

/**
 * References to `name` that are NOT the callee of a call and NOT its own
 * declaration -- i.e. the symbol escaping as a value. A cross-family review
 * demonstrated the bypass this closes: `const approve = this.commitDecision
 * .bind(this); approve(...)` creates a real extra commit route while leaving
 * the call-site count at 5, so the topology gate reported GREEN.
 */
function escapingReferences(file: string, name: string): ts.Node[] {
  const escaping: ts.Node[] = [];
  eachNode(sourceFileFor(file), node => {
    const isDeclarationName = (ts.isMethodDeclaration(node.parent ?? node)
      || ts.isFunctionDeclaration(node.parent ?? node)
      || ts.isPropertyDeclaration(node.parent ?? node))
      && (node.parent as { name?: ts.Node }).name === node;
    if (isDeclarationName) return;
    const matchesName = (ts.isIdentifier(node) && node.text === name)
      || (ts.isPropertyAccessExpression(node) && node.name.text === name);
    if (!matchesName) return;
    // An import/export binding is how the symbol legitimately arrives; it is
    // not the symbol escaping as a value.
    const binder = node.parent;
    if (binder !== undefined && (ts.isImportSpecifier(binder)
      || ts.isExportSpecifier(binder)
      || ts.isImportClause(binder)
      || ts.isNamespaceImport(binder))) return;
    // The callee position of a call is the legitimate, counted use.
    const parent = node.parent;
    if (parent !== undefined && ts.isCallExpression(parent) && parent.expression === node) return;
    if (ts.isPropertyAccessExpression(node)) escaping.push(node);
    else if (parent !== undefined && !ts.isPropertyAccessExpression(parent)) escaping.push(node);
  });
  return escaping;
}

/** Line numbers are DERIVED for human output only -- never used to locate anything. */
function locationOf(file: string, node: ts.Node): string {
  const { line } = sourceFileFor(file).getLineAndCharacterOfPosition(node.getStart());
  return `${file}:${line + 1}`;
}

interface StructuralCheckResult {
  readonly label: string;
  readonly file: string;
  readonly ok: boolean;
  readonly detail: string;
}

function checkStructuralClaims(): StructuralCheckResult[] {
  return F1_STRUCTURAL_CLAIMS.map(claim => {
    if (claim.kind === 'function-declared') {
      const declarations = functionDeclarations(claim.file, claim.name);
      return {
        label: claim.label,
        file: claim.file,
        ok: declarations.length > 0,
        detail: declarations.length > 0
          ? `${claim.name} declared at ${locationOf(claim.file, declarations[0]!)}`
          : `no declaration of ${claim.name} found`,
      };
    }
    const calls = callSites(claim.file, claim.callee);
    if (claim.kind === 'call') {
      return {
        label: claim.label,
        file: claim.file,
        ok: calls.length > 0,
        detail: calls.length > 0
          ? `${claim.callee}(...) called at ${calls.map(call => locationOf(claim.file, call)).join(', ')}`
          : `no call to ${claim.callee}(...) found`,
      };
    }
    const matching = calls.filter(call => {
      const argument = call.arguments[claim.argumentIndex];
      return argument !== undefined && claim.argumentPattern.test(argument.getText());
    });
    return {
      label: claim.label,
      file: claim.file,
      ok: matching.length > 0,
      detail: matching.length > 0
        ? `${claim.callee}(...) with argument ${claim.argumentIndex} matching ${String(claim.argumentPattern)}`
          + ` at ${matching.map(call => locationOf(claim.file, call)).join(', ')}`
        : `no ${claim.callee}(...) call whose argument ${claim.argumentIndex} matches ${String(claim.argumentPattern)}`,
    };
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
  /** The typed identity of the authority that approved this commit. */
  readonly commitPath: HandoverCommitPath;
  /** Human-readable rendering of `commitPath`. Nothing keys off this. */
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

/**
 * Human-readable label for a typed commit path. This is presentation only --
 * nothing keys off it. The typed path is the identity.
 */
const COMMIT_PATH_LABELS: Readonly<Record<HandoverCommitPath, string>> = {
  'manager:initial-attach': 'handover-manager.ts (initial attach / re-attach)',
  'manager:continuity-rescue': 'handover-manager.ts (continuity rescue intra-switch)',
  'manager:inter-stable-pending-hold': 'handover-manager.ts (inter-HO after stable pending hold)',
  'manager:inter-stable-target': 'handover-manager.ts (inter-HO stable target)',
  'manager:intra-dwell': 'handover-manager.ts (intra-switch after dwell, F2: gated on SINR only)',
  'live-cell:service-continuity-fallback': 'sinrLiveCellModel.ts selectServiceContinuityFallback',
  'live-cell:ee-optimization':
    'handoverSelectionPolicy.ts instantaneousEeTriggerStatus (via HandoverDecisionEngine.step -> InstantaneousEePolicy)',
};

/**
 * The live-cell engine already reports a typed `mode`, so this is a total
 * mapping rather than a regex over prose. An unmapped mode is a new commit path
 * and must fail rather than be labelled "unrecognized" and counted as normal.
 */
function classifySinrLiveCellPath(mode: string): HandoverCommitPath | null {
  if (mode === 'ee-optimization') return 'live-cell:ee-optimization';
  if (mode === 'service-continuity-protection') return 'live-cell:service-continuity-fallback';
  return null;
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
  const commitPath = classifySinrLiveCellPath(commit.mode);
  if (commitPath === null) {
    fail(
      `[${scenario}] live-cell commit reported mode "${commit.mode}", which maps to no known `
      + `HandoverCommitPath. Either the mode is new -- in which case it is a new commit path and `
      + `commitProvenance.ts must declare it -- or the mode was renamed and this mapping is stale.`,
    );
    return;
  }
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
    commitPath,
    approvingPath: COMMIT_PATH_LABELS[commitPath],
    pathConsultsEeThreshold: handoverCommitPathConsultsEeThreshold(commitPath),
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

/**
 * Record one manager commit.
 *
 * The provenance is taken from the decision the engine returned, which states
 * it directly. This used to be recovered by regex-matching the `reason`
 * sentence, which could not work from an `eventLog` entry (those carry no
 * `reason`), so every caller had to patch the classification back in by hand
 * afterwards. A forgotten patch produced "unrecognized reason", which the
 * EE-blind ledger then treated as an unledgered commit path.
 */
function recordHandoverManagerEvent(
  scenario: string,
  event: HandoverEvent,
  decision: HandoverDecision,
): void {
  const commitPath = decision.provenance;
  if (commitPath === undefined) {
    fail(
      `[${scenario}] handover-manager committed action="${event.action}" but the decision carried no `
      + `provenance. commitDecision() is the only writer of that field, so either a commit path was `
      + `added without declaring itself, or a commit was published without going through it.`,
    );
    return;
  }
  records.push({
    scenario,
    engine: 'handover-manager',
    simTimeMs: event.timeMs,
    kind: event.action,
    mode: null,
    reason: decision.reason,
    from: event.fromSatId !== null ? `${event.fromSatId}:${event.fromBeamId}` : null,
    to: `${event.toSatId}:${event.toBeamId}`,
    commitPath,
    approvingPath: COMMIT_PATH_LABELS[commitPath],
    pathConsultsEeThreshold: handoverCommitPathConsultsEeThreshold(commitPath),
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
  recordHandoverManagerEvent(scenario, event, decision);
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
    recordHandoverManagerEvent(scenario, event, inter);
  }
  // Serving beam (sat-b/0) drops out of the candidate set entirely; a
  // same-satellite sibling beam (sat-b/1) remains steerable above threshold.
  const guardBlocked = manager.update([sample('sat-b', 1, 20), sample('sat-a', 0, 5)], 6, epochMs + 10000);
  if (guardBlocked.action !== 'intra-switch') {
    fail(`[${scenario}] expected continuity-rescue intra-switch once the shared guard cleared, got "${guardBlocked.action}": ${guardBlocked.reason}`);
  } else {
    const event = manager.eventLog[manager.eventLog.length - 1]!;
    recordHandoverManagerEvent(scenario, event, guardBlocked);
  }
}

function scenarioHandoverManagerPendingHoldCommit(): void {
  // The one path with no runtime coverage until now. It is NOT the plain
  // stable-target path: it fires when the best target has been REPLACED while
  // the previous pending target is still qualified, and that pending target
  // then reaches the full trigger time while still inside pendingTargetHoldMs.
  // The commit goes to the PENDING target, not to the new best one.
  const scenario = 'handover-manager inter-HO after stable pending hold (F1 pending-hold path)';
  const manager = new HandoverManager(loadProfile('hobs-2024-paper-default').handover, { enforceSharedHandoverInterval: false });
  manager.state = { satId: 'sat-a', beamId: 0, sinrDb: 10, triggerTimeSec: 0, pendingTarget: null };
  // sat-b becomes the pending target and banks 2.0s of the 3.5s trigger time.
  manager.update([sample('sat-a', 0, 10), sample('sat-b', 0, 20)], 2, 1000);
  // sat-c is now the best target, but sat-b is still qualified and the hold
  // window (1.5s) has not expired, so sat-b keeps accumulating and commits.
  const commit = manager.update(
    [sample('sat-a', 0, 10), sample('sat-b', 0, 20), sample('sat-c', 0, 26)],
    2,
    1500,
  );
  console.log(`  [${scenario}] commit=${JSON.stringify(commit)}`);
  if (commit.action !== 'inter-handover') {
    fail(`[${scenario}] expected an inter-handover from the pending-hold path, got "${commit.action}": ${commit.reason}`);
    return;
  }
  if (commit.target?.satId !== 'sat-b') {
    fail(`[${scenario}] the pending-hold path must commit the PENDING target sat-b, not ${commit.target?.satId}`);
  }
  const event = manager.eventLog[manager.eventLog.length - 1]!;
  recordHandoverManagerEvent(scenario, event, commit);
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
  recordHandoverManagerEvent(scenario, event, commit);
}

// ---------------------------------------------------------------------------
// Run everything, then print the raw machine-readable report.
// ---------------------------------------------------------------------------

console.log('=== check:handover -- structural F1 claims ===');
const structuralResults = checkStructuralClaims();
for (const result of structuralResults) {
  const status = result.ok ? 'ok' : 'MISSING';
  console.log(`  [${status}] ${result.file} (${result.label})`);
  console.log(`    ${result.detail}`);
  if (!result.ok) {
    fail(`structural claim unsatisfied: ${result.label} -- ${result.detail}`);
  }
}

console.log('\n=== check:handover -- commit-path topology (deliberately brittle) ===');
let observedCommitPathCount = 0;
for (const entry of COMMIT_PATH_TOPOLOGY) {
  const observed = entry.count();
  observedCommitPathCount += observed;
  const status = observed === entry.expected ? 'ok' : 'CHANGED';
  console.log(`  [${status}] ${entry.file}: ${observed} ${entry.what} (expected ${entry.expected})`);
}
// A commit symbol used anywhere other than as a callee is a route the count
// above cannot see (`.bind(this)`, an alias, `Reflect.apply`, `this['x'](...)`).
// A permit forged by type assertion is a path granting itself commit authority.
// The brand blocks object literals; only this check blocks `as unknown as`.
{
  const scanRoots = ['src', 'scripts'];
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { walk(rel); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (EE_COMMIT_PERMIT_ASSERTION_ALLOWLIST.includes(rel)) continue;
      if (!readFileSync(join(repoRoot, rel), 'utf8').includes('EeCommitPermit')) continue;
      for (const node of permitTypeAssertions(rel, 'EeCommitPermit')) {
        offenders.push(locationOf(rel, node));
      }
    }
  };
  for (const root of scanRoots) walk(root);
  console.log(`\n=== check:handover -- EeCommitPermit forgery guard ===`);
  console.log(`  type assertions naming EeCommitPermit outside its module: ${offenders.length}`);
  if (offenders.length > 0) {
    fail(
      `EeCommitPermit was forged by type assertion at ${offenders.join(', ')}. A permit may only come `
      + `from a mint function in src/engine/handover/eeCommitPermit.ts; asserting one into existence `
      + `is a commit path granting itself authority without EE evidence.`,
    );
  }
}

for (const entry of COMMIT_SYMBOLS_THAT_MAY_NOT_ESCAPE) {
  const escaping = escapingReferences(entry.file, entry.name);
  if (escaping.length > 0) {
    fail(
      `commit symbol ${entry.name} escapes as a value at `
      + `${escaping.map(node => locationOf(entry.file, node)).join(', ')}. An aliased or bound `
      + `reference is a commit route the path count cannot see, so the topology gate above can no `
      + `longer be trusted. Call it directly, or teach COMMIT_PATH_TOPOLOGY to count this route.`,
    );
  }
}

if (observedCommitPathCount !== EXPECTED_COMMIT_PATH_COUNT) {
  fail(
    `commit-path topology changed: counted ${observedCommitPathCount} commit paths, expected `
    + `${EXPECTED_COMMIT_PATH_COUNT}. This assertion is intentionally brittle -- the number of paths `
    + `that can commit a handover is exactly what SDD §2 F1 is about. Re-read every structural claim `
    + `above, confirm which authority each remaining path answers to, then update `
    + `EXPECTED_COMMIT_PATH_COUNT and COMMIT_PATH_TOPOLOGY deliberately.`,
  );
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
  ['handoverManagerPendingHoldCommit', scenarioHandoverManagerPendingHoldCommit],
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

// ---------------------------------------------------------------------------
// The EE-blind commit ledger.
//
// `handover-manager.ts` can commit a handover with no EE evidence and no
// threshold authority at all. This oracle has always been able to SEE that --
// it printed the count as information -- but information is not a signal: a
// red-team mutation that let a fourth path commit without EE produced no
// failure, because nothing compared the count to anything.
//
// The ledger freezes the blind commits that exist today, keyed by the path
// that approved them. A blind commit that is not listed fails the run, and a
// listed entry that stops appearing also fails. The set can therefore only
// change as a deliberate edit here -- which is the moment someone has to look
// at it. P3 convergence is expected to shrink this list toward empty; an
// initial attach has no prior link to measure and is not a blind commit.
// ---------------------------------------------------------------------------
// Keyed on the typed commit path, not on the prose label: rewording a reason
// sentence must not be able to change a ledger key.
const EXPECTED_EE_BLIND_COMMITS: readonly HandoverCommitPath[] = [
  'manager:inter-stable-target',
  'manager:inter-stable-pending-hold',
  'manager:continuity-rescue',
  'manager:intra-dwell',
];

const blindCommitKeys = records
  .filter(r => r.eeGateStatus === 'unknown-ee-blind-engine')
  .map(r => r.commitPath)
  .sort();
const expectedBlindKeys: readonly HandoverCommitPath[] = [...EXPECTED_EE_BLIND_COMMITS].sort();

console.log('\n=== check:handover -- EE-blind commit ledger ===');
console.log(`  ledgered: ${expectedBlindKeys.length}, observed: ${blindCommitKeys.length}`);
for (const key of blindCommitKeys) {
  console.log(`    [${expectedBlindKeys.includes(key) ? 'ledgered' : 'UNLEDGERED'}] ${key}`);
}
// Compared as a MULTISET, not with includes(). A cross-family review showed
// that includes() lets a genuinely new blind path pass whenever its reason text
// happens to classify to a key already in the ledger: the observed count grows
// from 3 to 4 while every key is still "found".
function tallyKeys(keys: readonly string[]): ReadonlyMap<string, number> {
  const tally = new Map<string, number>();
  for (const key of keys) tally.set(key, (tally.get(key) ?? 0) + 1);
  return tally;
}
const observedTally = tallyKeys(blindCommitKeys);
const expectedTally = tallyKeys(expectedBlindKeys);
for (const [key, observedCount] of observedTally) {
  const expectedCount = expectedTally.get(key) ?? 0;
  if (observedCount > expectedCount) {
    fail(
      `unledgered EE-blind commit: ${key} occurred ${observedCount} time(s) but the ledger allows `
      + `${expectedCount}. A handover committed with no EE evidence and no threshold authority. `
      + `Either the path must consult the EE threshold, or EXPECTED_EE_BLIND_COMMITS must be `
      + `extended deliberately with the reason it may not.`,
    );
  }
}
for (const [key, expectedCount] of expectedTally) {
  const observedCount = observedTally.get(key) ?? 0;
  if (observedCount < expectedCount) {
    fail(
      `ledgered EE-blind commit no longer observed: ${key} expected ${expectedCount} time(s), saw `
      + `${observedCount}. If this path now consults the EE threshold, remove it from `
      + `EXPECTED_EE_BLIND_COMMITS; if the scenario stopped exercising it, the scenario has lost `
      + `coverage and the ledger can no longer see this path.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Runtime coverage of the declared commit paths.
//
// The structural claims above prove a call site EXISTS; they cannot prove it is
// reachable. A cross-family review made the point concretely: an unreachable
// call can pad the topology count while a live path is removed, and every
// static check stays green. Only a scenario that actually observes a commit on
// a path proves that path still fires.
//
// The uncovered list is a ratchet: a path on it that starts being observed must
// be removed from the list, and a path not on it that stops being observed
// fails. Coverage can therefore only improve.
// ---------------------------------------------------------------------------
const COMMIT_PATHS_WITHOUT_RUNTIME_COVERAGE: readonly HandoverCommitPath[] = [
  // Empty: every declared commit path is exercised by a scenario above.
];

const observedCommitPaths = new Set(records.map(record => record.commitPath));
console.log('\n=== check:handover -- commit-path runtime coverage ===');
for (const path of HANDOVER_COMMIT_PATHS) {
  const observed = observedCommitPaths.has(path);
  const excused = COMMIT_PATHS_WITHOUT_RUNTIME_COVERAGE.includes(path);
  const status = observed ? 'observed' : excused ? 'UNCOVERED (known)' : 'UNCOVERED';
  console.log(`  [${status}] ${path}`);
  if (!observed && !excused) {
    fail(
      `commit path ${path} was not observed by any scenario. Its structural claim only proves the `
      + `call site exists, not that it can still fire, so an unreachable path would keep every `
      + `static check green. Add a scenario that exercises it, or add it to `
      + `COMMIT_PATHS_WITHOUT_RUNTIME_COVERAGE with the reason.`,
    );
  }
  if (observed && excused) {
    fail(
      `commit path ${path} is listed in COMMIT_PATHS_WITHOUT_RUNTIME_COVERAGE but a scenario now `
      + `observes it. Remove it from that list -- the list is a ratchet and may only shrink.`,
    );
  }
}

console.log('\n=== check:handover -- verdict ===');
if (failures.length > 0) {
  console.log(`RED: ${failures.length} failure(s).`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('GREEN: all scenarios committed as expected; no EE-gated commit fired at/above threshold.');
  process.exit(0);
}
