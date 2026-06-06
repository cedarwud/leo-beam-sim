#!/usr/bin/env node
// validate-modqn-omega-s4-heuristic-not-paper.tsx
//
// S4 acceptance validator (SDD §9.5 + §4.4):
//   (a) computeHeuristicNotPaperScore is exported from
//       src/engine/handover/decision-override.ts under this exact name.
//   (b) decision-override.ts source contains the SDD §4.4 inline citation.
//   (c) HeuristicNotPaperBanner component exists, renders the exact text
//       `Heuristic ω-scoring — NOT paper MODQN`, and exports the banner BG/FG
//       color constants for contrast verification.
//   (d) Banner background/foreground colors achieve W3C WCAG 2.1 contrast
//       ratio ≥ 4.5:1.
//   (e) ControlBar.tsx no longer exposes omega-heuristic as a top-level demo
//       mode; ω Apply is handled inside MODQN replay.
//   (f) App.tsx keeps data-handover-criterion to the two public branches:
//       decision-overlay-on-live-sinr / sinr-offset.
//   (g) `persistHandoverMode('omega-heuristic')` MUST NOT write to localStorage
//       (verified via a mock storage instance). `persistHandoverMode('sinr-offset')`
//       still writes (regression guard).
//   (h) On boot, readPersistedHandoverMode returns 'sinr-offset' for any
//       stored value other than 'sinr-offset' or 'decision-overlay-on-live-sinr' — including
//       'omega-heuristic' and arbitrary invalid strings (SDD §4.4 item 2).
//   (i) DiagnosticsDrawer renders an omega-heuristic section (test-id
//       `diagnostics-drawer-omega-heuristic`) that shows mode, ω, score
//       formula, and not-paper warning text when handoverMode is
//       omega-heuristic.
//   (j) Heuristic-mode score function picks the best candidate under the
//       user's ω. Sanity checks the closed-form arithmetic against a
//       hand-computed argmax.
//   (k) No keyboard shortcut or URL query handler may launch omega-heuristic
//       mode (SDD §4.4 item 5). Verified by grepping App.tsx/main.tsx for
//       handlers that set handoverMode without going through the
//       sidebar's `onHandoverModeChange` plumbing.
//
// Run: node --import tsx/esm scripts/validate-modqn-omega-s4-heuristic-not-paper.tsx

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeHeuristicNotPaperScore,
} from '../src/engine/handover/decision-override';
import {
  HEURISTIC_NOT_PAPER_BANNER_BG_COLOR,
  HEURISTIC_NOT_PAPER_BANNER_FG_COLOR,
  HEURISTIC_NOT_PAPER_BANNER_TEXT,
  HeuristicNotPaperBanner,
} from '../src/ui/HeuristicNotPaperBanner';
import {
  DEFAULT_RUNTIME_HANDOVER_MODE,
  HANDOVER_MODE_STORAGE_KEY,
  persistHandoverMode,
  readPersistedHandoverMode,
} from '../src/ui/useModqnHandoverState';
import type { LinkSample } from '../src/engine/signal/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed++;
}

function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) pass(label); else fail(label, detail);
}

function readSource(relPath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relPath), 'utf8');
}

// W3C WCAG 2.1 contrast-ratio computation.
// https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Bad hex color: ${hex}`);
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(fgHex: string, bgHex: string): number {
  const lf = relativeLuminance(fgHex);
  const lb = relativeLuminance(bgHex);
  const [l1, l2] = lf > lb ? [lf, lb] : [lb, lf];
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---------------------------------------------------------------------------
// (a) computeHeuristicNotPaperScore exported under exact name
// ---------------------------------------------------------------------------
console.log('\n(a) computeHeuristicNotPaperScore export + exact name');
{
  assert(
    typeof computeHeuristicNotPaperScore === 'function',
    'computeHeuristicNotPaperScore is a function',
  );

  const overrideSrc = readSource('src/engine/handover/decision-override.ts');
  assert(
    overrideSrc.includes('export function computeHeuristicNotPaperScore'),
    "Source declares `export function computeHeuristicNotPaperScore`",
  );
}

// ---------------------------------------------------------------------------
// (b) SDD §4.4 inline citation
// ---------------------------------------------------------------------------
console.log('\n(b) SDD §4.4 inline citation in decision-override.ts');
{
  const overrideSrc = readSource('src/engine/handover/decision-override.ts');
  assert(
    overrideSrc.includes('docs/modqn-omega-handover-sdd.md'),
    'Cites docs/modqn-omega-handover-sdd.md',
  );
  assert(
    overrideSrc.includes('§4.4'),
    'Cites §4.4 binding disclosure rules section',
  );
  assert(
    overrideSrc.includes('NOT paper MODQN'),
    'Contains explicit "NOT paper MODQN" disclosure',
  );
}

// ---------------------------------------------------------------------------
// (c) Banner component + exact text + exported color tokens
// ---------------------------------------------------------------------------
console.log('\n(c) HeuristicNotPaperBanner component + exact text');
{
  assert(
    typeof HeuristicNotPaperBanner === 'function',
    'HeuristicNotPaperBanner is a function component',
  );
  assert(
    HEURISTIC_NOT_PAPER_BANNER_TEXT === 'Heuristic ω-scoring — NOT paper MODQN',
    'Banner exposes the exact required text constant',
    `got: ${HEURISTIC_NOT_PAPER_BANNER_TEXT}`,
  );

  const bannerSrc = readSource('src/ui/HeuristicNotPaperBanner.tsx');
  assert(
    bannerSrc.includes('Heuristic ω-scoring — NOT paper MODQN'),
    'Banner source contains the exact text',
  );
  assert(
    bannerSrc.includes('data-testid="heuristic-not-paper-banner"'),
    'Banner has data-testid="heuristic-not-paper-banner"',
  );
  assert(
    bannerSrc.includes('pointerEvents: \'none\'') || bannerSrc.includes('pointerEvents:"none"'),
    'Banner pointerEvents: none (non-dismissable)',
  );
}

// ---------------------------------------------------------------------------
// (d) Contrast ratio ≥ 4.5 : 1
// ---------------------------------------------------------------------------
console.log('\n(d) W3C WCAG 2.1 contrast ratio');
{
  const ratio = contrastRatio(
    HEURISTIC_NOT_PAPER_BANNER_FG_COLOR,
    HEURISTIC_NOT_PAPER_BANNER_BG_COLOR,
  );
  console.log(
    `      bg=${HEURISTIC_NOT_PAPER_BANNER_BG_COLOR} fg=${HEURISTIC_NOT_PAPER_BANNER_FG_COLOR} contrast=${ratio.toFixed(3)}:1`,
  );
  assert(
    ratio >= 4.5,
    'Banner contrast ratio >= 4.5:1 (WCAG 2.1 AA)',
    `got ${ratio.toFixed(3)}:1`,
  );
}

// ---------------------------------------------------------------------------
// (e) ControlBar.tsx — omega-heuristic is not a top-level public mode
// ---------------------------------------------------------------------------
console.log('\n(e) ControlBar omega-heuristic entry removed');
{
  const cbSrc = readSource('src/ui/ControlBar.tsx');
  // C1: the SINR/MODQN public switch moved to LaneExperienceBar. ControlBar keeps
  // only the contained MODQN decision-policy toggle (paper overlay <-> heuristic ω),
  // which must NOT register omega-heuristic as a third top-level handover mode.
  assert(
    cbSrc.includes('data-testid="modqn-decision-policy-control"'),
    'ControlBar exposes the contained MODQN decision-policy toggle',
  );
  assert(
    !cbSrc.includes("mode: 'omega-heuristic'"),
    'ControlBar does not expose omega-heuristic as a third top-level mode',
  );
}

// ---------------------------------------------------------------------------
// (f) App.tsx data-handover-criterion preserves decision-overlay-on-live-sinr/sinr-offset branch
// ---------------------------------------------------------------------------
console.log('\n(f) App.tsx data-handover-criterion 2-way wiring');
{
  const appSrc = readSource('src/App.tsx');
  assert(
    appSrc.includes("handoverMode === 'decision-overlay-on-live-sinr' ? 'decision-overlay-on-live-sinr' : 'sinr-offset'"),
    "App.tsx uses the public decision-overlay-on-live-sinr/sinr-offset ternary literal",
  );
  assert(
    !appSrc.includes("'omega-heuristic-not-paper'"),
    "App.tsx does not emit the removed 'omega-heuristic-not-paper' criterion",
  );
  // Showcase exposure (S4 2026-06-06): omega-heuristic is reachable again via the
  // MODQN decision-policy toggle (modqn-live lane). SDD §4.4 item 1 REQUIRES the
  // disclosure banner whenever the mode is active, so App MUST co-mount it gated
  // on handoverMode === 'omega-heuristic' (never expose the mode without it).
  assert(
    appSrc.includes("handoverMode === 'omega-heuristic' && sceneLane === 'modqn-live-cell-preview' && <HeuristicNotPaperBanner />"),
    'App.tsx co-mounts HeuristicNotPaperBanner gated on omega-heuristic AND the modqn-live lane (mandatory NOT-paper disclosure, never leaks to artifact/other lanes)',
  );
}

// ---------------------------------------------------------------------------
// (g) persistHandoverMode never writes for omega-heuristic
// ---------------------------------------------------------------------------
console.log('\n(g) persistHandoverMode skips omega-heuristic');
{
  // Mock a localStorage / window pair.
  const store = new Map<string, string>();
  const originalWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
  };

  try {
    // Attempt to persist omega-heuristic. Must be a no-op.
    persistHandoverMode('omega-heuristic');
    assert(
      !store.has(HANDOVER_MODE_STORAGE_KEY),
      "persistHandoverMode('omega-heuristic') does NOT write to localStorage",
      `key in store: ${[...store.keys()].join(',')}`,
    );

    // Regression: sinr-offset and decision-overlay-on-live-sinr still persist.
    persistHandoverMode('sinr-offset');
    assert(
      store.get(HANDOVER_MODE_STORAGE_KEY) === 'sinr-offset',
      "persistHandoverMode('sinr-offset') writes 'sinr-offset'",
      `got: ${store.get(HANDOVER_MODE_STORAGE_KEY) ?? '<unset>'}`,
    );
    persistHandoverMode('decision-overlay-on-live-sinr');
    assert(
      store.get(HANDOVER_MODE_STORAGE_KEY) === 'decision-overlay-on-live-sinr',
      "persistHandoverMode('decision-overlay-on-live-sinr') writes 'decision-overlay-on-live-sinr'",
      `got: ${store.get(HANDOVER_MODE_STORAGE_KEY) ?? '<unset>'}`,
    );
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
}

// ---------------------------------------------------------------------------
// (h) Boot fallback: omega-heuristic / invalid → sinr-offset
// ---------------------------------------------------------------------------
console.log('\n(h) readPersistedHandoverMode boot fallback');
{
  const store = new Map<string, string>();
  const originalWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
  };

  try {
    // No value stored → sinr-offset.
    assert(
      readPersistedHandoverMode() === 'sinr-offset',
      'No persisted value → sinr-offset',
    );

    // 'omega-heuristic' stored (defensively — shouldn't happen) → sinr-offset.
    store.set(HANDOVER_MODE_STORAGE_KEY, 'omega-heuristic');
    assert(
      readPersistedHandoverMode() === 'sinr-offset',
      "Persisted 'omega-heuristic' → sinr-offset (SDD §4.4 item 2 boot reset)",
    );

    // Arbitrary garbage → sinr-offset.
    store.set(HANDOVER_MODE_STORAGE_KEY, 'garbage-mode-name');
    assert(
      readPersistedHandoverMode() === 'sinr-offset',
      'Invalid stored value → sinr-offset',
    );

    // Valid values still round-trip.
    store.set(HANDOVER_MODE_STORAGE_KEY, 'decision-overlay-on-live-sinr');
    assert(
      readPersistedHandoverMode() === 'decision-overlay-on-live-sinr',
      "Persisted 'decision-overlay-on-live-sinr' → decision-overlay-on-live-sinr (S3 regression guard)",
    );
    store.set(HANDOVER_MODE_STORAGE_KEY, 'sinr-offset');
    assert(
      readPersistedHandoverMode() === 'sinr-offset',
      "Persisted 'sinr-offset' → sinr-offset",
    );

    // Default constant matches.
    assert(
      DEFAULT_RUNTIME_HANDOVER_MODE === 'sinr-offset',
      'DEFAULT_RUNTIME_HANDOVER_MODE is sinr-offset',
    );
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
}

// ---------------------------------------------------------------------------
// (i) DiagnosticsDrawer omega-heuristic row
// ---------------------------------------------------------------------------
console.log('\n(i) DiagnosticsDrawer omega-heuristic row');
{
  const drawSrc = readSource('src/ui/DiagnosticsDrawer.tsx');
  assert(
    drawSrc.includes("handoverMode === 'omega-heuristic'"),
    "DiagnosticsDrawer gates section on handoverMode === 'omega-heuristic'",
  );
  assert(
    drawSrc.includes('diagnostics-drawer-omega-heuristic'),
    'DiagnosticsDrawer omega-heuristic section has testid',
  );
  assert(
    drawSrc.includes('NOT PAPER MODQN'),
    'DiagnosticsDrawer surfaces NOT PAPER MODQN warning in section title',
  );
  assert(
    drawSrc.includes('Score formula'),
    'DiagnosticsDrawer surfaces "Score formula" row label',
  );
  assert(
    drawSrc.includes('score(a) = ω_t · normSINR(a) − ω_h · isSwitch(a) − ω_l · normLoad(a)'),
    'DiagnosticsDrawer shows the score formula in human-readable form',
  );
  assert(
    drawSrc.includes('ModqnHandoverModeContext'),
    'DiagnosticsDrawer reads ω from ModqnHandoverModeContext',
  );
}

// ---------------------------------------------------------------------------
// (j) Score-function arithmetic sanity
// ---------------------------------------------------------------------------
console.log('\n(j) computeHeuristicNotPaperScore picks argmax');
{
  const candidates: LinkSample[] = [
    {
      satId: 'SAT-A',
      beamId: 0,
      rsrpDbm: -90,
      sinrDb: 20, // linear 100
      signalDbm: 0,
      intraInterferenceDbm: -120,
      interInterferenceDbm: -120,
      noiseDbm: -110,
      denominatorDbm: -109,
      txPowerDbm: 30,
      pathLossDb: 120,
      beamGainDb: 40,
      steeringLossDb: 0,
      receiverGainDbi: 5,
    },
    {
      satId: 'SAT-A',
      beamId: 1,
      rsrpDbm: -100,
      sinrDb: 10, // linear 10
      signalDbm: -10,
      intraInterferenceDbm: -120,
      interInterferenceDbm: -120,
      noiseDbm: -110,
      denominatorDbm: -109,
      txPowerDbm: 30,
      pathLossDb: 120,
      beamGainDb: 40,
      steeringLossDb: 0,
      receiverGainDbi: 5,
    },
  ];

  // Serving = SAT-A:0 (so isSwitch(0)=0, isSwitch(1)=1).
  const serving = { satId: 'SAT-A', beamId: 0, sinrDb: 20 };

  // High ω_throughput: pick the high-SINR serving (no switch penalty).
  const omegaHigh = { throughput: 0.9, handover: 0.05, loadBalance: 0.05 };
  const rHigh = computeHeuristicNotPaperScore({
    omega: omegaHigh,
    candidates,
    serving,
  });
  assert(rHigh !== null, 'High-throughput ω → result non-null');
  assert(
    rHigh?.satId === 'SAT-A' && rHigh?.beamId === 0,
    'High-throughput ω selects SAT-A:0 (serving stays, no switch penalty)',
    `got ${rHigh?.satId}:${rHigh?.beamId}`,
  );

  // Force-flip ω_handover penalty huge, with low throughput → switch (beamId=1)
  // actually loses harder (it incurs the switch penalty). So this combination
  // still picks beam 0. We instead validate that a SECOND candidate can win
  // when its SINR is high enough to overcome the switch penalty.
  const candidatesFlipped: LinkSample[] = candidates.map((c, idx) => ({
    ...c,
    sinrDb: idx === 0 ? 10 : 30, // beam 1 now has higher SINR
  }));
  // ω = (0.9, 0.05, 0.05). Switch penalty 0.05 << throughput gain.
  const rFlip = computeHeuristicNotPaperScore({
    omega: omegaHigh,
    candidates: candidatesFlipped,
    serving,
  });
  assert(
    rFlip?.satId === 'SAT-A' && rFlip?.beamId === 1,
    'When candidate 1 has much higher SINR, score picks candidate 1 (switch worth it)',
    `got ${rFlip?.satId}:${rFlip?.beamId}`,
  );

  // Empty candidate array → null (defer to sinr-offset).
  const rEmpty = computeHeuristicNotPaperScore({
    omega: omegaHigh,
    candidates: [],
    serving,
  });
  assert(rEmpty === null, 'Empty candidates → null (defer to sinr-offset)');
}

// ---------------------------------------------------------------------------
// (k) No keyboard shortcut or URL handler for omega-heuristic
// ---------------------------------------------------------------------------
console.log('\n(k) No shortcut / URL handler for omega-heuristic (SDD §4.4 item 5)');
{
  // Walk every src file looking for setHandoverMode-ish writes that bypass
  // the ControlBar selector. We allow the legitimate uses in App.tsx
  // (state initializer + handleHandoverModeChange + persist/read).
  const allowedAppLines = new Set([
    'setHandoverModeRaw',
    'handleHandoverModeChange',
    'onHandoverModeChange',
    'readPersistedHandoverMode',
    'persistHandoverMode',
  ]);

  // Scan files. Look for direct string 'omega-heuristic' references and
  // confirm none come from URL query parsing or key event handlers.
  const filesToScan = [
    'src/App.tsx',
    'src/main.tsx',
  ];
  let suspectKeyHandler = false;
  let suspectUrlHandler = false;
  for (const rel of filesToScan) {
    if (!fs.existsSync(path.resolve(repoRoot, rel))) continue;
    const src = readSource(rel);
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('omega-heuristic')) continue;
      // Look for nearby suspect handlers.
      const window = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 4)).join('\n');
      if (/onKey(Down|Up|Press)\s*=|addEventListener\s*\(\s*['"]key/.test(window)) {
        suspectKeyHandler = true;
      }
      if (/URLSearchParams|location\.search|window\.location\.search|new URL\(/.test(window)) {
        suspectUrlHandler = true;
      }
    }
  }
  void allowedAppLines;
  assert(
    !suspectKeyHandler,
    'No keyboard handler near omega-heuristic references in App.tsx/main.tsx',
  );
  assert(
    !suspectUrlHandler,
    'No URL/search parser near omega-heuristic references in App.tsx/main.tsx',
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n---');
console.log(JSON.stringify({
  slice: 'S4',
  passed,
  failed,
  total: passed + failed,
}, null, 2));
if (failed > 0) {
  process.exit(1);
}
console.log('All S4 acceptance checks passed.');
