// ci-data-guard.test — self-executing unit test for the CI data guard (P2 SN-3c).
//
// Because skipIfDataUnavailable() calls process.exit(0), each case runs the
// guard in a CHILD node process (tsx/esm registered) and asserts on the child's
// exit status + stdout. Cases:
//   1. all deps present            → no output, execution continues, exit 0
//   2. a dep missing               → marker line (why + path) printed, execution
//                                    STOPS before the sentinel, exit 0 (not red)
//   3. dep missing but regenerable → treated as available (runs through)
//   4. dep + regen source missing  → skips, marker notes the regen source too
//   5. multiple missing deps       → one marker line per missing dep
//
// npm run validate:infra:ci-data-guard — auto-discovered by validate:static:all.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SKIP_DATA_UNAVAILABLE_MARKER } from './ci-data-guard.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '../..');
const GUARD_URL = new URL('./ci-data-guard.ts', import.meta.url).href;

const PRESENT = join(REPO_ROOT, 'package.json');
const MISSING_A = join(REPO_ROOT, 'definitely-not-here-ci-data-guard-test-a');
const MISSING_B = join(REPO_ROOT, 'definitely-not-here-ci-data-guard-test-b');
assert.ok(existsSync(PRESENT), `test precondition: ${PRESENT} must exist`);
assert.ok(!existsSync(MISSING_A) && !existsSync(MISSING_B), 'test precondition: fake paths must not exist');

const SENTINEL = 'AFTER-GUARD-SENTINEL';

function runGuardInChild(depsLiteral: string): { status: number; stdout: string } {
  const code = [
    `const { skipIfDataUnavailable } = await import(${JSON.stringify(GUARD_URL)});`,
    `skipIfDataUnavailable(${depsLiteral});`,
    `console.log(${JSON.stringify(SENTINEL)});`,
  ].join('\n');
  try {
    const stdout = execFileSync(
      process.execPath,
      ['--import', 'tsx/esm', '--input-type=module', '-e', code],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { status: 0, stdout };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? '' };
  }
}

function test(label: string, fn: () => void): void {
  fn();
  console.log(`  PASS  ${label}`);
}

test('all deps present -> no output, returns (execution continues), exit 0', () => {
  const r = runGuardInChild(`[{ path: ${JSON.stringify(PRESENT)}, why: 'unit-test present dep' }]`);
  assert.equal(r.status, 0, `exit 0 expected, got ${r.status}`);
  assert.ok(r.stdout.includes(SENTINEL), 'execution must continue past the guard');
  assert.ok(!r.stdout.includes(SKIP_DATA_UNAVAILABLE_MARKER), 'no skip marker when data is present');
});

test('missing dep -> prints marker (why + missing path) and exits 0 BEFORE the sentinel', () => {
  const r = runGuardInChild(`[{ path: ${JSON.stringify(MISSING_A)}, why: 'unit-test missing dep' }]`);
  assert.equal(r.status, 0, `skip must exit 0 (environment fact, not a red), got ${r.status}`);
  assert.ok(r.stdout.includes(SKIP_DATA_UNAVAILABLE_MARKER), 'skip marker must be printed');
  assert.ok(r.stdout.includes('unit-test missing dep'), 'marker line must carry the why');
  assert.ok(r.stdout.includes(MISSING_A), 'marker line must carry the missing path');
  assert.ok(!r.stdout.includes(SENTINEL), 'execution must STOP at the guard');
});

test('missing dep with PRESENT regenerableFrom -> treated as available (runs through)', () => {
  const r = runGuardInChild(
    `[{ path: ${JSON.stringify(MISSING_A)}, why: 'unit-test regenerable dep', regenerableFrom: ${JSON.stringify(PRESENT)} }]`,
  );
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes(SENTINEL), 'must run through: the validator own restore path should fire instead');
  assert.ok(!r.stdout.includes(SKIP_DATA_UNAVAILABLE_MARKER), 'no skip when a regeneration source exists');
});

test('missing dep with MISSING regenerableFrom -> skips and names the regen source', () => {
  const r = runGuardInChild(
    `[{ path: ${JSON.stringify(MISSING_A)}, why: 'unit-test dead-end dep', regenerableFrom: ${JSON.stringify(MISSING_B)} }]`,
  );
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes(SKIP_DATA_UNAVAILABLE_MARKER));
  assert.ok(r.stdout.includes(MISSING_B), 'marker must name the also-missing regeneration source');
  assert.ok(!r.stdout.includes(SENTINEL));
});

test('multiple missing deps -> one marker line per missing dep', () => {
  const r = runGuardInChild(
    `[{ path: ${JSON.stringify(MISSING_A)}, why: 'unit-test multi a' },`
    + ` { path: ${JSON.stringify(PRESENT)}, why: 'unit-test multi present' },`
    + ` { path: ${JSON.stringify(MISSING_B)}, why: 'unit-test multi b' }]`,
  );
  assert.equal(r.status, 0);
  const markerLines = r.stdout.split('\n').filter((l) => l.includes(SKIP_DATA_UNAVAILABLE_MARKER));
  assert.equal(markerLines.length, 2, `one line per missing dep, got ${markerLines.length}:\n${r.stdout}`);
  assert.ok(markerLines[0].includes(MISSING_A) && markerLines[1].includes(MISSING_B));
  assert.ok(!r.stdout.includes(SENTINEL));
});

console.log('ci-data-guard unit test passed (5/5).');
