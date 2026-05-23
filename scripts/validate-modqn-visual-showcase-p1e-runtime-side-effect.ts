/**
 * P1e (b2) — runtime side-effect probe (SDD §9 P1 exit criterion (b2)).
 *
 * Pairs with the static scanner in
 * `validate-modqn-visual-showcase-p1e-import-boundary.ts`. The static scan
 * catches direct/named imports in `src/showcase/**`; this probe catches
 * transitive runtime evaluations that a static scanner cannot see (e.g. a
 * scene-source-agnostic module evaluating a live-engine subgraph only on
 * one code path).
 *
 * Mechanism:
 *   1. Spawn a child Node process that loads + adapts the trigger
 *      `visual-showcase-v1.json` artifact via the showcase path.
 *   2. Register the `p1e-runtime-side-effect-loader.mjs` ESM hook before
 *      `tsx/esm` so any load whose URL matches the forbidden set is
 *      replaced with `throw new Error('P1E_FORBIDDEN_MODULE_EVALUATED:…')`.
 *   3. PASS = child exits 0 with `REPLAY_DRIVER_OK` on stdout.
 *   4. Positive control: a second child intentionally imports a forbidden
 *      module; that child must exit non-zero with the sentinel error to
 *      prove the loader hook is actually wired.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SCRIPTS_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPTS_DIR, '..');

const LOADER = path.join(SCRIPTS_DIR, 'p1e-runtime-side-effect-loader.mjs');
const REPLAY_DRIVER = path.join(SCRIPTS_DIR, 'p1e-runtime-side-effect-driver.ts');
const POSITIVE_DRIVER = path.join(SCRIPTS_DIR, 'p1e-runtime-positive-control-driver.ts');

function test(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (err) {
    console.error(`  FAIL  ${label}`);
    console.error(err);
    process.exit(1);
  }
}

function runChild(driverPath: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-loader',
      LOADER,
      '--import',
      'tsx/esm',
      driverPath,
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

console.log('validate-modqn-visual-showcase-p1e-runtime-side-effect');

test('replay code path runs end-to-end without evaluating any forbidden module', () => {
  const r = runChild(REPLAY_DRIVER);
  if (r.status !== 0) {
    throw new Error(
      `replay driver exited ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
  }
  assert.ok(
    r.stdout.includes('REPLAY_DRIVER_OK'),
    `replay driver did not reach success print. stdout was:\n${r.stdout}\nstderr:\n${r.stderr}`,
  );
  assert.ok(
    !r.stderr.includes('P1E_FORBIDDEN_MODULE_EVALUATED'),
    `replay driver tripped the forbidden-module sentinel:\n${r.stderr}`,
  );
});

test('positive control: forbidden import triggers loader stub-throw', () => {
  const r = runChild(POSITIVE_DRIVER);
  assert.notStrictEqual(
    r.status,
    0,
    `positive control should exit non-zero but exited 0.\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
  );
  assert.ok(
    !r.stdout.includes('POSITIVE_CONTROL_UNREACHABLE'),
    'positive control reached its unreachable print — loader hook never fired',
  );
  const combined = r.stdout + r.stderr;
  assert.ok(
    combined.includes('P1E_FORBIDDEN_MODULE_EVALUATED'),
    `positive control did not emit the sentinel error.\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
  );
});

console.log('OK');
