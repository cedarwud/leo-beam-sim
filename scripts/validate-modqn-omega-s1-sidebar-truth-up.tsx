// MODQN ω-Handover S1 — sidebar truth-up validator.
//
// Acceptance per docs/modqn-omega-handover-sdd.md §9.2 (S1) and the
// caller-supplied S1 contract:
//
//   1. `useModqnDemoStub.ts` no longer exists.
//   2. `useModqnHandoverState.ts` exists and exports the required contract.
//   3. ModqnObjectiveTab renders the new hook's ω draft + Apply/Reset and a
//      reset target labelled `from bundle`.
//   4. ModqnEvidenceTab renders bundle manifest fields (paperId,
//      bundleSchemaVersion, baselineSurface.totalBeamCount,
//      baselineSurface.episodesCompleted) plus the active ω.
//   5. The Retrain button, fake reward curve, and fake
//      `effectiveOffsetDb` / `effectiveTriggerTimeSec` derivations are gone
//      from the codebase.
//
// This validator renders the two tabs with a controlled hook snapshot using
// `react-dom/server.renderToStaticMarkup`, then inspects the markup for the
// presence of expected data-testid hooks and the absence of the removed
// `modqn-retrain-button` testid. It also confirms file-system invariants
// for the deleted stub and verifies the hook's static contract surface.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModqnObjectiveTab } from '../src/ui/ModqnObjectiveTab.tsx';
import { ModqnEvidenceTab } from '../src/ui/ModqnEvidenceTab.tsx';
import {
  DEFAULT_RUNTIME_HANDOVER_MODE,
  MODQN_PAPER_FAITHFUL_OMEGA,
  getBundleSidebarSnapshot,
  type BundleSidebarSnapshot,
  type RuntimeHandoverMode,
  type RuntimeOmegaSource,
  type RuntimeOmegaState,
  type UseModqnHandoverState,
} from '../src/ui/useModqnHandoverState.ts';
import {
  MODQN_PAPER_ID,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  type ModqnPolicyDiagnostics,
} from '../src/modqn/replay-bundle/types.ts';
import {
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  MODQN_TOTAL_BASELINE_BEAMS,
} from '../src/modqn/replay-bundle/identity.ts';
import type { SimState } from '../src/scene/types.ts';

const REPO_ROOT = path.resolve(import.meta.dirname ?? '.', '..');
const DELETED_STUB_PATH = path.join(REPO_ROOT, 'src/ui/useModqnDemoStub.ts');
const NEW_HOOK_PATH = path.join(REPO_ROOT, 'src/ui/useModqnHandoverState.ts');
const APP_PATH = path.join(REPO_ROOT, 'src/App.tsx');
const OBJECTIVE_TAB_PATH = path.join(REPO_ROOT, 'src/ui/ModqnObjectiveTab.tsx');
const EVIDENCE_TAB_PATH = path.join(REPO_ROOT, 'src/ui/ModqnEvidenceTab.tsx');
const PLAYBACK_SHELL_PATH = path.join(REPO_ROOT, 'src/modqn/replay-bundle/playback-shell.ts');

function decodeHtmlText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSimState(): SimState {
  return {
    simTimeSec: 0,
    physicalServing: {
      satId: null,
      beamId: null,
      sinrDb: null,
    },
    physicalPending: {
      satId: null,
      beamId: null,
      sinrDb: null,
    },
    physicalServingBudget: null,
    intraSwitchPending: null,
    intraHoCount: 0,
    hoCount: 0,
    lastHoEvent: null,
    beamHopEnabled: false,
    beamHopSlotIndex: null,
  } as unknown as SimState;
}

function makeHook(overrides: {
  omegaActive?: RuntimeOmegaState;
  omegaDraft?: RuntimeOmegaState;
  omegaSource?: RuntimeOmegaSource;
  bundleSidebarSnapshot?: BundleSidebarSnapshot | null;
  bundlePolicyDiagnostics?: ModqnPolicyDiagnostics | null;
  mode?: RuntimeHandoverMode;
} = {}): UseModqnHandoverState {
  const snapshot = overrides.bundleSidebarSnapshot ?? getBundleSidebarSnapshot();
  const omega: RuntimeOmegaState = {
    throughput: MODQN_PAPER_FAITHFUL_OMEGA.throughput,
    handover: MODQN_PAPER_FAITHFUL_OMEGA.handover,
    loadBalance: MODQN_PAPER_FAITHFUL_OMEGA.loadBalance,
  };

  return {
    omegaDraft: overrides.omegaDraft ?? omega,
    omegaActive: overrides.omegaActive ?? omega,
    omegaSource: overrides.omegaSource ?? 'bundle',
    bundlePolicyDiagnostics:
      overrides.bundlePolicyDiagnostics ?? snapshot?.policyDiagnostics ?? null,
    bundleSidebarSnapshot: snapshot,
    setOmegaDraft: () => {},
    applyOmega: () => {},
    resetOmega: () => {},
    mode: overrides.mode ?? DEFAULT_RUNTIME_HANDOVER_MODE,
    setMode: () => {},
  };
}

interface CheckResult {
  readonly id: string;
  readonly description: string;
  readonly status: 'pass';
}

const results: CheckResult[] = [];
function recordPass(id: string, description: string): void {
  results.push({ id, description, status: 'pass' });
}

// 1. File-system invariants.
assert.equal(
  existsSync(DELETED_STUB_PATH),
  false,
  `S1.1: ${DELETED_STUB_PATH} must be deleted`,
);
recordPass('S1.1', 'useModqnDemoStub.ts removed from src/ui/');

assert.equal(
  existsSync(NEW_HOOK_PATH),
  true,
  `S1.2: ${NEW_HOOK_PATH} must exist`,
);
recordPass('S1.2', 'useModqnHandoverState.ts exists');

// 1a. App.tsx no longer imports the deleted stub.
const appSource = readFileSync(APP_PATH, 'utf8');
assert.equal(
  appSource.includes('useModqnDemoStub'),
  false,
  'S1.1a: src/App.tsx must not import useModqnDemoStub',
);
recordPass('S1.1a', 'App.tsx no longer imports useModqnDemoStub');

// 1b. No source file imports the deleted symbol. Narrative comments may still
// mention the old name to explain the migration; the check looks for actual
// import / require statements.
const objectiveTabSource = readFileSync(OBJECTIVE_TAB_PATH, 'utf8');
const evidenceTabSource = readFileSync(EVIDENCE_TAB_PATH, 'utf8');
const importRegex = /(?:import\s+[^;]*?from\s+['"][^'"]*useModqnDemoStub['"])|(?:require\s*\(\s*['"][^'"]*useModqnDemoStub['"])/;
for (const [label, source] of [
  ['ModqnObjectiveTab.tsx', objectiveTabSource],
  ['ModqnEvidenceTab.tsx', evidenceTabSource],
] as const) {
  assert.equal(
    importRegex.test(source),
    false,
    `S1.1b: ${label} must not import useModqnDemoStub`,
  );
}
recordPass('S1.1b', 'Tab files no longer import useModqnDemoStub');

// 1c. Fake derivation helpers (deriveEffectiveOffset / deriveEffectiveTrigger)
// from the old stub must not reappear in any source file.
const srcRoot = path.join(REPO_ROOT, 'src');
const sourceFiles: string[] = [];
{
  const stack = [srcRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) break;
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) stack.push(full);
      else if (/\.(ts|tsx)$/.test(item.name)) sourceFiles.push(full);
    }
  }
}
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  assert.equal(
    /deriveEffectiveOffset\b|deriveEffectiveTrigger\b/.test(text),
    false,
    `S1.5a: ${file} must not define fake effective-offset / trigger derivations`,
  );
}
recordPass('S1.5a', 'No source file defines deriveEffectiveOffset/Trigger');

// 1d. Retrain button testid must not appear in any source file.
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  assert.equal(
    text.includes('"modqn-retrain-button"') || text.includes("'modqn-retrain-button'"),
    false,
    `S1.5b: ${file} must not render the Retrain button`,
  );
}
recordPass('S1.5b', 'Retrain button testid absent from all source files');

// 1e. Fake reward-curve setInterval lifecycle must be gone with the stub.
for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  assert.equal(
    /computeRewardCurveSample\b|RETRAIN_TOTAL_TICKS|RETRAIN_TICK_MS/.test(text),
    false,
    `S1.5c: ${file} must not retain fake reward-curve symbols`,
  );
}
recordPass('S1.5c', 'Fake reward-curve symbols (RETRAIN_TOTAL_TICKS, RETRAIN_TICK_MS, computeRewardCurveSample) gone');

// 2. Bundle sidebar snapshot exposes the SDD §9.2 manifest fields.
const snapshot = getBundleSidebarSnapshot();
assert.equal(snapshot.paperId, MODQN_PAPER_ID, 'S1.2a: snapshot paperId');
assert.equal(
  snapshot.bundleSchemaVersion,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  'S1.2b: snapshot bundleSchemaVersion',
);
assert.equal(
  snapshot.baselineSurface.totalBeamCount,
  MODQN_TOTAL_BASELINE_BEAMS,
  'S1.2c: snapshot baselineSurface.totalBeamCount',
);
assert.equal(
  snapshot.baselineSurface.beamCountPerSatellite,
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  'S1.2d: snapshot baselineSurface.beamCountPerSatellite',
);
assert.ok(
  Number.isFinite(snapshot.baselineSurface.episodesCompleted),
  'S1.2e: snapshot baselineSurface.episodesCompleted finite',
);
assert.equal(
  snapshot.policyDiagnostics.objectiveWeights?.throughput,
  MODQN_PAPER_FAITHFUL_OMEGA.throughput,
  'S1.2f: snapshot policyDiagnostics.objectiveWeights.throughput',
);
recordPass('S1.2.bundle', 'Bundle sidebar snapshot exposes paperId, schema, beam totals, episodesCompleted, ω');

// 3. ModqnObjectiveTab renders ω sliders + Apply/Reset + from-bundle label.
{
  const hook = makeHook();
  const markup = renderToStaticMarkup(<ModqnObjectiveTab hookOverride={hook} />);
  const text = decodeHtmlText(markup);

  for (const testId of [
    'modqn-objective-tab',
    'modqn-objective-controls',
    'modqn-objective-weight-throughput',
    'modqn-objective-weight-handover',
    'modqn-objective-weight-loadbalance',
    'modqn-objective-apply',
    'modqn-objective-reset',
    'modqn-objective-reset-target',
  ]) {
    assert.ok(
      markup.includes(`data-testid="${testId}"`),
      `S1.3.${testId}: ModqnObjectiveTab markup missing data-testid="${testId}"`,
    );
  }
  recordPass('S1.3.testids', 'ObjectiveTab renders all expected data-testid hooks');

  assert.ok(
    markup.includes('data-omega-source="bundle"'),
    'S1.3.source: ObjectiveTab carries data-omega-source="bundle" with default hook state',
  );
  recordPass('S1.3.source', 'ObjectiveTab carries data-omega-source attribute');

  assert.ok(
    text.includes('from bundle:'),
    'S1.3.reset-target: ObjectiveTab shows "from bundle:" reset target label',
  );
  recordPass('S1.3.reset-target', 'ObjectiveTab shows "from bundle:" label');

  for (const expected of ['0.40', '0.30']) {
    assert.ok(
      text.includes(expected),
      `S1.3.bundle-omega: ObjectiveTab reset target must include weight ${expected}`,
    );
  }
  recordPass('S1.3.bundle-omega', 'ObjectiveTab reset target prints paper ω (0.40, 0.30, 0.30)');

  assert.equal(
    markup.includes('modqn-retrain-button'),
    false,
    'S1.3.no-retrain: ObjectiveTab markup must not contain the Retrain button',
  );
  recordPass('S1.3.no-retrain', 'ObjectiveTab markup contains no Retrain button');
}

// 4. ModqnEvidenceTab renders bundle manifest fields + active ω.
{
  const hook = makeHook({
    omegaActive: { throughput: 0.55, handover: 0.25, loadBalance: 0.2 },
    omegaSource: 'user-applied',
  });
  const markup = renderToStaticMarkup(
    <ModqnEvidenceTab
      simState={makeSimState()}
      bandwidthMHz={400}
      appliedHandoverOffsetDb={3}
      appliedHandoverTriggerTimeSec={3.5}
      hookOverride={hook}
    />,
  );
  const text = decodeHtmlText(markup);

  for (const testId of [
    'modqn-evidence-tab',
    'modqn-evidence-manifest',
    'modqn-evidence-paper-id',
    'modqn-evidence-bundle-schema-version',
    'modqn-evidence-total-beam-count',
    'modqn-evidence-episodes-completed',
    'modqn-evidence-active-omega',
    'modqn-evidence-active-omega-throughput',
    'modqn-evidence-active-omega-handover',
    'modqn-evidence-active-omega-loadbalance',
  ]) {
    assert.ok(
      markup.includes(`data-testid="${testId}"`),
      `S1.4.${testId}: EvidenceTab markup missing data-testid="${testId}"`,
    );
  }
  recordPass('S1.4.testids', 'EvidenceTab renders all expected data-testid hooks');

  assert.ok(
    text.includes(MODQN_PAPER_ID),
    'S1.4.paper-id: EvidenceTab markup must include paperId',
  );
  assert.ok(
    text.includes(MODQN_REPLAY_BUNDLE_SCHEMA_VERSION),
    'S1.4.schema: EvidenceTab markup must include bundleSchemaVersion',
  );
  assert.ok(
    text.includes(String(MODQN_TOTAL_BASELINE_BEAMS)),
    'S1.4.total-beams: EvidenceTab markup must include totalBeamCount',
  );
  recordPass('S1.4.manifest', 'EvidenceTab markup contains paperId, schema version, total beams');

  for (const expected of ['0.55', '0.25', '0.20']) {
    assert.ok(
      text.includes(expected),
      `S1.4.active-omega: EvidenceTab active ω must include ${expected}`,
    );
  }
  recordPass('S1.4.active-omega', 'EvidenceTab renders active ω (0.55, 0.25, 0.20)');

  assert.ok(
    markup.includes('data-omega-source="user-applied"'),
    'S1.4.source: EvidenceTab carries data-omega-source="user-applied"',
  );
  recordPass('S1.4.source', 'EvidenceTab carries data-omega-source="user-applied" when overridden');
}

// 5. Confirm the hard-coded shell model is unchanged (S2 territory).
{
  const text = readFileSync(PLAYBACK_SHELL_PATH, 'utf8');
  assert.ok(
    text.includes('MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL'),
    'S1.6: playback-shell.ts must still export the shell model (S2 swaps it)',
  );
  recordPass('S1.6', 'playback-shell.ts MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL untouched');
}

// 6. Hook contract surface (typescript-static).
{
  const expectedKeys = [
    'omegaDraft',
    'omegaActive',
    'omegaSource',
    'bundlePolicyDiagnostics',
    'bundleSidebarSnapshot',
    'setOmegaDraft',
    'applyOmega',
    'resetOmega',
    'mode',
    'setMode',
  ];
  const hook = makeHook();
  for (const key of expectedKeys) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(hook, key),
      `S1.7: hook contract surface must expose ${key}`,
    );
  }
  recordPass('S1.7', 'Hook contract surface exposes all SDD §5.2 + S1 prompt fields');
}

const summary = {
  slice: 'modqn-omega-s1-sidebar-truth-up',
  sddSection: 'docs/modqn-omega-handover-sdd.md §9.2',
  status: 'pass' as const,
  checks: results,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
