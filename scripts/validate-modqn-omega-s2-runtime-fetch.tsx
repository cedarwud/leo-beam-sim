// MODQN ω-Handover S2 — runtime bundle fetch validator.
//
// Acceptance per docs/modqn-omega-handover-sdd.md §9.3 (S2):
//
//   1. MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL is no longer imported by
//      App.tsx. (The const may remain in playback-shell.ts as a typed
//      reference.)
//   2. App.tsx fetches the bundle at runtime via fetchModqnReplayBundleEnvelope.
//   3. Fetch failure surfaces a visible banner and falls back to the typed
//      reference shell model.
//   4. modqn-1sat-7beam profile is registered, selector label is
//      "MODQN 1-sat 7-beam (replay)".
//   5. useModqnHandoverState's bundlePolicyDiagnostics originates from the
//      envelope (`s2-envelope-row:*` diagnosticsVersion marker) when an
//      envelope is provided via ModqnEnvelopeProvider context, and from the
//      paper-default synthesizer (`s1-sidebar-snapshot-paper-default`) when no
//      envelope is provided.
//   6. The hook's exported surface (BundleSidebarSnapshot keys, hook return
//      keys) is unchanged from S1.
//
// This validator does not require a running dev server. The runtime fetch is
// exercised through an in-process mock fetch that reads the bundle's surfaces
// from disk and feeds them to fetchModqnReplayBundleEnvelope.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MODQN_BUNDLE_DEV_ROUTE_PREFIX,
  ModqnRuntimeBundleFetchError,
  createModqnReplayPlaybackShellModel,
  fetchModqnReplayBundleEnvelope,
  getModqnBundleDevFetchUrlBase,
  getModqnReplayPlaybackFallbackShellModel,
  type ModqnReplayEnvelope,
} from '../src/modqn/replay-bundle/index.ts';
import {
  MODQN_1SAT_7BEAM_PROFILE_ID,
  getProfileLabel,
  loadProfile,
  profileList,
} from '../src/profiles/index.ts';
import {
  ModqnEnvelopeProvider,
  S1_PAPER_DEFAULT_DIAGNOSTICS_VERSION,
  S2_ENVELOPE_DIAGNOSTICS_VERSION_PREFIX,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  getBundleSidebarSnapshot,
  useModqnHandoverState,
  type BundleSidebarSnapshot,
  type UseModqnHandoverState,
} from '../src/ui/useModqnHandoverState.ts';
import { ModqnObjectiveTab } from '../src/ui/ModqnObjectiveTab.tsx';
import { ensureModqnCurrentBaselineExport } from './support/modqn-current-baseline-export.ts';

const REPO_ROOT = path.resolve(import.meta.dirname ?? '.', '..');
const APP_PATH = path.join(REPO_ROOT, 'src/App.tsx');
const PLAYBACK_SHELL_PATH = path.join(REPO_ROOT, 'src/modqn/replay-bundle/playback-shell.ts');
const PROFILE_PATH = path.join(REPO_ROOT, 'src/profiles/modqn-1sat-7beam.json');
ensureModqnCurrentBaselineExport();

interface CheckResult {
  readonly id: string;
  readonly description: string;
  readonly status: 'pass';
}

const results: CheckResult[] = [];
function recordPass(id: string, description: string): void {
  results.push({ id, description, status: 'pass' });
}

// 1. App.tsx no longer imports the hard-coded shell model constant.
const appSource = readFileSync(APP_PATH, 'utf8');
assert.equal(
  /MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL/.test(appSource),
  false,
  'S2.1: src/App.tsx must not import MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL',
);
recordPass('S2.1', 'App.tsx no longer imports MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL');

assert.ok(
  appSource.includes('fetchModqnReplayBundleEnvelope'),
  'S2.1a: App.tsx must wire fetchModqnReplayBundleEnvelope',
);
recordPass('S2.1a', 'App.tsx wires fetchModqnReplayBundleEnvelope');

assert.ok(
  appSource.includes('getModqnReplayPlaybackFallbackShellModel'),
  'S2.1b: App.tsx must call getModqnReplayPlaybackFallbackShellModel for fallback path',
);
recordPass('S2.1b', 'App.tsx uses fallback accessor instead of direct shell-model import');

// 1c. The shell-model constant may remain in playback-shell.ts as a typed reference.
const shellSource = readFileSync(PLAYBACK_SHELL_PATH, 'utf8');
assert.ok(
  shellSource.includes('MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL'),
  'S2.1c: playback-shell.ts must still export the typed reference',
);
recordPass('S2.1c', 'playback-shell.ts still exports the typed reference const');

// 1d. App.tsx mounts the fetch-failure banner with the expected data-testid +
// data-modqn-bundle-fetch-status="failed" capture metadata.
assert.ok(
  appSource.includes('data-testid="modqn-bundle-fetch-banner"'),
  'S2.1d: App.tsx must mount the fetch-failure banner with data-testid',
);
assert.ok(
  appSource.includes('data-modqn-bundle-fetch-status="failed"'),
  'S2.1d: App.tsx banner must carry data-modqn-bundle-fetch-status="failed"',
);
recordPass('S2.1d', 'App.tsx banner exposes data-testid + data-modqn-bundle-fetch-status');

// 2. Profile registry.
const profileEntry = profileList.find(p => p.id === MODQN_1SAT_7BEAM_PROFILE_ID);
assert.ok(profileEntry, 'S2.2: modqn-1sat-7beam profile must be registered in profileList');
recordPass('S2.2', `modqn-1sat-7beam profile registered (${profileList.length} total)`);

const profileLabel = getProfileLabel(profileEntry);
assert.equal(
  profileLabel,
  'MODQN 1-sat 7-beam (replay)',
  `S2.2a: profile label expected "MODQN 1-sat 7-beam (replay)", got "${profileLabel}"`,
);
recordPass('S2.2a', 'Profile label is "MODQN 1-sat 7-beam (replay)"');

const loadedProfile = loadProfile(MODQN_1SAT_7BEAM_PROFILE_ID);
assert.equal(loadedProfile.beams.perSatellite, 7, 'S2.2b: profile must declare 7 beams per satellite');
assert.equal(
  loadedProfile.orbit.shells.length,
  1,
  'S2.2c: profile must declare exactly one orbital shell (1-sat env)',
);
assert.equal(
  loadedProfile.orbit.shells[0]?.planes * loadedProfile.orbit.shells[0]?.satsPerPlane,
  1,
  'S2.2d: profile must declare exactly 1 satellite (planes × satsPerPlane = 1)',
);
assert.equal(
  loadedProfile.formulaFamily,
  'hobs-legacy',
  'S2.2e: profile.formulaFamily must be hobs-legacy per SDD §7.2',
);
recordPass('S2.2b', 'Profile shape matches SDD §7.2 (1 sat, 7 beams, hobs-legacy)');

// Profile file exists on disk.
assert.ok(existsSync(PROFILE_PATH), `S2.2f: profile JSON must exist at ${PROFILE_PATH}`);
recordPass('S2.2f', 'modqn-1sat-7beam.json file exists');

// 3. Runtime fetch via mock fetch impl — reads producer bundle from fs.
const fetchUrlBase = getModqnBundleDevFetchUrlBase(SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH);
assert.ok(
  fetchUrlBase.startsWith(MODQN_BUNDLE_DEV_ROUTE_PREFIX),
  `S2.3.url: fetch URL must start with ${MODQN_BUNDLE_DEV_ROUTE_PREFIX}, got ${fetchUrlBase}`,
);
recordPass('S2.3.url', `getModqnBundleDevFetchUrlBase returns dev-route prefix (${fetchUrlBase})`);

function makeMockFetch(opts: { failOn?: string } = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (opts.failOn && url.endsWith(opts.failOn)) {
      throw new Error(`mock fetch refusing to serve ${opts.failOn}`);
    }
    const expectedPrefix = `${fetchUrlBase}/`;
    if (!url.startsWith(expectedPrefix)) {
      return new Response('not found', { status: 404 });
    }
    const relative = url.slice(expectedPrefix.length).split('?')[0] ?? '';
    const fsPath = path.join(SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH, relative);
    if (!existsSync(fsPath)) {
      return new Response('not found', { status: 404 });
    }
    const text = readFileSync(fsPath, 'utf8');
    return new Response(text, { status: 200 });
  }) as typeof fetch;
}

// 3a. Successful runtime fetch produces an envelope identical (in identity)
// to the validated load-from-disk path used by other validators.
const fetched = await fetchModqnReplayBundleEnvelope({ fetchImpl: makeMockFetch() });
assert.equal(
  fetched.envelope.sourcePath,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  'S2.3a: fetched envelope.sourcePath must match selected bundle path',
);
assert.equal(fetched.envelope.diagnostics.adapter.status, 'accepted', 'S2.3a: adapter status accepted');
assert.equal(
  fetched.envelope.diagnostics.adapter.rowCount,
  1000,
  'S2.3a: envelope row count must be 1000',
);
assert.equal(
  fetched.envelope.diagnostics.adapter.slotCount,
  10,
  'S2.3a: envelope slot count must be 10',
);
recordPass('S2.3a', 'fetchModqnReplayBundleEnvelope returns the 1000-row 10-slot envelope from a mock fetch');

// 3b. Envelope produces a playback shell that passes the shape validator.
const liveShell = createModqnReplayPlaybackShellModel(fetched.envelope);
assert.equal(
  liveShell.rowCount,
  fetched.envelope.diagnostics.adapter.rowCount,
  'S2.3b: liveShell.rowCount must match envelope',
);
assert.equal(liveShell.slotCount, 10, 'S2.3b: liveShell.slotCount must be 10');
recordPass('S2.3b', 'createModqnReplayPlaybackShellModel(envelope) builds the 10-slot shell from runtime fetch');

// 3c. Fallback accessor still returns the typed reference shell model so the
// fetch-failure path renders something.
const fallback = getModqnReplayPlaybackFallbackShellModel();
assert.equal(fallback.slotCount, 10, 'S2.3c: fallback shell model still has 10 slots');
assert.equal(fallback.rowCount, 1000, 'S2.3c: fallback shell model still has 1000 rows');
recordPass('S2.3c', 'getModqnReplayPlaybackFallbackShellModel returns the typed reference (fetch-failure fallback)');

// 3d. Fetch failure surfaces ModqnRuntimeBundleFetchError, not a generic
// crash. App.tsx catches this and pivots to the banner + fallback.
let caught: unknown = null;
try {
  await fetchModqnReplayBundleEnvelope({
    fetchImpl: makeMockFetch({ failOn: 'manifest.json' }),
  });
} catch (error) {
  caught = error;
}
assert.ok(
  caught instanceof ModqnRuntimeBundleFetchError,
  'S2.3d: fetch failure on manifest.json must throw ModqnRuntimeBundleFetchError',
);
recordPass('S2.3d', 'Fetch failure throws ModqnRuntimeBundleFetchError (caught by App.tsx fetch effect)');

// 4. Hook context wiring: bundlePolicyDiagnostics flows from envelope under
// ModqnEnvelopeProvider, and from paper-default fallback without provider.
function HookCaptureSync({
  capture,
}: {
  readonly capture: (h: UseModqnHandoverState) => void;
}) {
  const hook = useModqnHandoverState();
  // Render-time capture so renderToStaticMarkup grabs the value synchronously.
  capture(hook);
  return null;
}

// 4a. No-envelope fallback path.
{
  let captured: UseModqnHandoverState | null = null;
  renderToStaticMarkup(
    React.createElement(HookCaptureSync, {
      capture: (h: UseModqnHandoverState) => {
        captured = h;
      },
    }),
  );
  const hook = captured as UseModqnHandoverState | null;
  assert.ok(hook !== null, 'S2.4a: hook must render at least once without provider');
  const nonNullHook = hook as UseModqnHandoverState;
  assert.ok(nonNullHook.bundlePolicyDiagnostics !== null, 'S2.4a: bundlePolicyDiagnostics must be present');
  assert.equal(
    nonNullHook.bundlePolicyDiagnostics?.diagnosticsVersion,
    S1_PAPER_DEFAULT_DIAGNOSTICS_VERSION,
    'S2.4a: bundlePolicyDiagnostics.diagnosticsVersion must be paper-default fallback without provider',
  );
  recordPass(
    'S2.4a',
    'Hook falls back to paper-default diagnostics when no envelope provider is mounted',
  );
}

// 4b. Envelope-wired path: bundlePolicyDiagnostics carries the S2 marker.
{
  let captured: UseModqnHandoverState | null = null;
  renderToStaticMarkup(
    React.createElement(
      ModqnEnvelopeProvider,
      { envelope: fetched.envelope, slotOffset: 0 },
      React.createElement(HookCaptureSync, {
        capture: (h: UseModqnHandoverState) => {
          captured = h;
        },
      }),
    ),
  );
  const hook = captured as UseModqnHandoverState | null;
  assert.ok(hook !== null, 'S2.4b: hook must render under provider');
  const nonNullHook = hook as UseModqnHandoverState;
  const version = nonNullHook.bundlePolicyDiagnostics?.diagnosticsVersion ?? '';
  assert.ok(
    typeof version === 'string' && version.startsWith(S2_ENVELOPE_DIAGNOSTICS_VERSION_PREFIX),
    `S2.4b: hook bundlePolicyDiagnostics.diagnosticsVersion must start with ${S2_ENVELOPE_DIAGNOSTICS_VERSION_PREFIX}, got "${version}"`,
  );
  // Envelope-specific snapshot fields.
  assert.equal(
    nonNullHook.bundleSidebarSnapshot?.sourcePath,
    fetched.envelope.sourcePath,
    'S2.4b: bundleSidebarSnapshot.sourcePath must echo envelope sourcePath',
  );
  assert.equal(
    nonNullHook.bundleSidebarSnapshot?.rowCount,
    1000,
    'S2.4b: bundleSidebarSnapshot.rowCount must echo envelope row count',
  );
  recordPass(
    'S2.4b',
    'Hook bundlePolicyDiagnostics carries the s2-envelope-row marker when envelope is provided via context',
  );
}

// 4c. Direct accessor: getBundleSidebarSnapshot(envelope, slotOffset) returns
// envelope-marker diagnostics; getBundleSidebarSnapshot() returns paper-default.
{
  const fallbackSnap: BundleSidebarSnapshot = getBundleSidebarSnapshot();
  assert.equal(
    fallbackSnap.policyDiagnostics.diagnosticsVersion,
    S1_PAPER_DEFAULT_DIAGNOSTICS_VERSION,
    'S2.4c: getBundleSidebarSnapshot() returns paper-default diagnostics',
  );
  const envelopeSnap: BundleSidebarSnapshot = getBundleSidebarSnapshot(fetched.envelope, 0);
  assert.ok(
    typeof envelopeSnap.policyDiagnostics.diagnosticsVersion === 'string'
      && envelopeSnap.policyDiagnostics.diagnosticsVersion.startsWith(
        S2_ENVELOPE_DIAGNOSTICS_VERSION_PREFIX,
      ),
    'S2.4c: getBundleSidebarSnapshot(envelope, 0) returns envelope-row diagnostics',
  );
  recordPass(
    'S2.4c',
    'getBundleSidebarSnapshot() returns paper-default; (envelope, slot) returns envelope-row diagnostics',
  );
}

// 4d. Hook exported surface unchanged from S1 (shape stability lock).
{
  let captured: UseModqnHandoverState | null = null;
  renderToStaticMarkup(
    React.createElement(HookCaptureSync, {
      capture: (h: UseModqnHandoverState) => {
        captured = h;
      },
    }),
  );
  const nonNullHook = captured as UseModqnHandoverState;
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
  for (const key of expectedKeys) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(nonNullHook, key),
      `S2.4d: hook surface must still expose ${key}`,
    );
  }
  recordPass('S2.4d', 'Hook return shape unchanged from S1 (S3/S4 locked surface)');
}

// 4e. ObjectiveTab renders unchanged under the envelope provider — the
// `from bundle:` reset target still resolves to a finite ω triple, so existing
// downstream renders are not broken by the S2 wiring.
{
  const markup = renderToStaticMarkup(
    React.createElement(
      ModqnEnvelopeProvider,
      { envelope: fetched.envelope, slotOffset: 0 },
      React.createElement(ModqnObjectiveTab, {}),
    ),
  );
  assert.ok(
    markup.includes('data-testid="modqn-objective-tab"'),
    'S2.4e: ObjectiveTab renders under ModqnEnvelopeProvider',
  );
  assert.ok(
    markup.includes('data-testid="modqn-objective-reset-target"'),
    'S2.4e: ObjectiveTab still renders the reset target row',
  );
  recordPass('S2.4e', 'ObjectiveTab renders under ModqnEnvelopeProvider with intact testids');
}

// 5. End-to-end: simulate App.tsx's fetch-success path producing an envelope,
// then thread it through ModqnEnvelopeProvider and confirm the consumer hook
// (via direct accessor with the same envelope) sees envelope-derived bundle
// path + envelope-marker diagnostics. This is a process-level check that the
// runtime-fetch result actually reaches the sidebar without identity drift.
{
  const liveSnapshot = getBundleSidebarSnapshot(fetched.envelope, 0);
  assert.equal(
    liveSnapshot.sourcePath,
    SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
    'S2.5: live snapshot must carry the producer artifact path',
  );
  assert.equal(
    liveSnapshot.rowCount,
    fetched.envelope.diagnostics.adapter.rowCount,
    'S2.5: live snapshot rowCount must echo envelope diagnostics',
  );
  assert.equal(
    liveSnapshot.slotCount,
    fetched.envelope.diagnostics.adapter.slotCount,
    'S2.5: live snapshot slotCount must echo envelope diagnostics',
  );
  recordPass('S2.5', 'Runtime-fetch envelope identity is preserved through the sidebar accessor');
}

const summary = {
  slice: 'modqn-omega-s2-runtime-bundle-fetch',
  sddSection: 'docs/modqn-omega-handover-sdd.md §9.3',
  status: 'pass' as const,
  checks: results,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
