// validate:static:all — the COMPLETE static-validator gate + the recurrence guard.
//
// WHY THIS EXISTS: governance:full runs only ~16 curated static validators, but
// the repo has ~144 static `validate:*` leaf scripts. The other ~128 were
// orphaned — nobody ran them, so when code moved, a source-pinned validator went
// red SILENTLY (2026-06-14 triage found 20 such rotted reds). This runner
// AUTO-DISCOVERS every static validator and runs it, so:
//   1. a NEW static validator is automatically included — it can never orphan;
//   2. a refactor that breaks any GATED validator is caught here;
//   3. the QUARANTINE list below makes the existing rot VISIBLE (not hidden), and
//      the runner FAILS if a quarantined validator starts passing — forcing you
//      to remove it from quarantine once fixed (no stale allowlist).
//
// Browser validators (need a running vite + APP_URL) are excluded — they live in
// `validate:ready` / `validate:live-render`. This gate is STATIC only.
//
// Run before a handoff/PR:  npm run validate:static:all   (~8 min)
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Known-red static validators (silently rotted; found by the 2026-06-14 triage).
// Each needs its own fix (stale-validator vs real-regression). Listed here so the
// debt is VISIBLE and a new orphan cannot hide among them. When you GREEN one,
// DELETE its entry — the runner fails if a quarantined validator passes.
// 14 of the original 19 quarantined reds were repaired 2026-06-14 (intent-preserving
// validator fixes, adversarially verified). These 5 remain — each needs a HUMAN
// decision, NOT a source-pin update:
const QUARANTINE = new Map([
  ['validate:beam-floor', 'REAL ENGINE REGRESSION — validator is byte-identical to its passing creation; bisection points at src/engine/handover/handover-manager.ts (serving-pending beam-floor fallback). FIX THE ENGINE, never the validator.'],
  ['validate:modqn:phase6t-source-channel-shadow-kpi', 'RED BY DESIGN — a shadow-comparison guard correctly catching a real channel-model KPI drift. Do NOT silence; investigate the drift (scripts/fixtures/modqn-phase6t-*).'],
  ['validate:phase6b:handover-policy-controls', 'DEAD ARCHITECTURE — asserts the removed LeftSidebarTab=objective|signal|handover top-level-tab model (now appRuntimeModel summary|evidence). Rewrite to the current sidebar contract, or retire the obsolete placement gate.'],
  ['validate:phase6c:handover-policy-placement', 'DEAD ARCHITECTURE — shares the phase6b script; the top-level Handover-Policy tab placement it proved was removed by design. Retire or rewrite alongside phase6b.'],
  ['validate:modqn:phase5c-frequency-diagnostics', 'PARTIAL — repair workflow fixed the stale SimState fixture, but a Phase-5C vendor-boundary assert (scoped files must not import /src/engine/) is still red and is NOT a safe source-pin update; needs a human look.'],
]);

// Load-sensitive PERFORMANCE validators: they measure per-frame CPU/timing and
// pass standalone but flake under the bulk-run load of this gate (running ~144
// validators back-to-back drives up load). They are EXCLUDED here — NOT
// source-pin rot — and must be run standalone. If you add another perf/timing
// validator, exclude it too.
const EXCLUDE = new Set([
  'validate:phase-3:cpu-budget', // per-frame ms ceiling; passes standalone, flaky under bulk load
]);

const pkg = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const discovered = [];
for (const key of Object.keys(pkg)) {
  if (!key.startsWith('validate:')) continue;
  if (EXCLUDE.has(key)) continue; // load-sensitive perf test — run standalone
  const cmd = pkg[key];
  if (cmd.includes('&&') || !cmd.includes('node --import')) continue; // aggregates only
  const m = cmd.match(/scripts\/(\S+)/);
  if (!m) continue;
  let src = '';
  try { src = readFileSync('scripts/' + m[1], 'utf8'); } catch { continue; }
  if (/chromium|playwright|newPage|APP_URL/.test(src)) continue; // browser → not here
  discovered.push({ key, file: m[1] });
}

const gatedRed = [], staleQuarantine = [];
let ran = 0;
for (const { key, file } of discovered) {
  let pass = true;
  try { execFileSync('node', ['--import', 'tsx/esm', 'scripts/' + file], { stdio: 'pipe', timeout: 90000 }); }
  catch { pass = false; }
  ran += 1;
  if (QUARANTINE.has(key)) {
    if (pass) staleQuarantine.push(key);
  } else if (!pass) {
    gatedRed.push(key);
  }
}

// A quarantined validator that the discovery missed (renamed/removed) is also a
// stale-quarantine entry to clean up.
const discoveredKeys = new Set(discovered.map((d) => d.key));
for (const key of QUARANTINE.keys()) if (!discoveredKeys.has(key)) staleQuarantine.push(`${key} (no longer discovered)`);

console.log(`\n===== validate:static:all — ${ran} static validators run, ${QUARANTINE.size} quarantined =====`);
if (gatedRed.length) {
  console.log(`\n✗ ${gatedRed.length} GATED validator(s) RED (a refactor broke one, or a NEW validator is red — fix it or, if it is pre-existing rot, add it to QUARANTINE with a TODO):`);
  for (const k of gatedRed) console.log(`    ${k}`);
}
if (staleQuarantine.length) {
  console.log(`\n✗ ${staleQuarantine.length} QUARANTINED validator(s) now GREEN or gone — DELETE them from QUARANTINE:`);
  for (const k of staleQuarantine) console.log(`    ${k}`);
}
const ok = gatedRed.length === 0 && staleQuarantine.length === 0;
console.log(ok ? `\n✓ static gate intact: ${ran - QUARANTINE.size} gated green, ${QUARANTINE.size} known-red quarantined (visible debt).` : '\n✗ static gate FAILED — see above.');
process.exit(ok ? 0 : 1);
