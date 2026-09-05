#!/usr/bin/env node
/**
 * validate:test-orphans -- every test file must be reachable by some npm script.
 *
 * A test that nothing runs is not a safety net; it is a file that makes the
 * repo look tested. This was not hypothetical here: red-team mutation C
 * (removing the time-to-trigger guard from HandoverManager) went undetected
 * partly because `src/engine/handover/handover-manager.test.ts` -- the test
 * file for the engine at the centre of SDD §2 F1 -- was referenced by no npm
 * script at all. `scripts/validate-static-all.mjs` cannot see this class of
 * problem: it auto-discovers `validate:*` npm keys, so an unreferenced
 * `*.test.ts` is invisible to it by construction.
 *
 * This is a RATCHET, not a clean gate. There are many pre-existing orphans;
 * they are listed in `known-test-orphans.json` so that the count can only go
 * down. A NEW orphan fails immediately; adopting one requires deleting its
 * line, which is the moment someone notices.
 *
 * Run: npm run validate:test-orphans
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, posix } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>;
};
const scriptText = Object.values(pkg.scripts ?? {}).join(' ');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const rel = posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/**
 * A glob in an npm script (e.g. 'src/visualLab/ **\/*.test.ts') covers a file
 * even though the filename never appears literally. Translate the globs we
 * actually use into regexes rather than pretending they are literals.
 */
function coveredByGlob(file: string): boolean {
  for (const raw of scriptText.match(/'[^']*\*[^']*'/g) ?? []) {
    const pattern = raw.slice(1, -1);
    const rx = new RegExp(`^${pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '(?:.*/)?')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')}$`);
    if (rx.test(file)) return true;
  }
  return false;
}

const tests = walk('src').sort();
const orphans = tests.filter(file => {
  if (scriptText.includes(file)) return false;
  if (scriptText.includes(posix.basename(file))) return false;
  return !coveredByGlob(file);
});

// ---------------------------------------------------------------------------
// Second class of orphan: the script itself.
//
// The check above proves a test file is NAMED by some npm script. It does not
// prove anything runs that script. An independent audit found the consequence:
// `test:homepage:alignment` names 17 test files -- including beamMetrics.test.ts,
// which carries four FAILING tests -- and nothing invokes it. Not CI, not
// another script. Four red tests sat behind a script no automation calls, and
// the file-level ratchet could not see them by construction.
//
// A script is reachable if CI runs it, another script's body runs it, or
// validate-static-all auto-discovers it (which it does for `validate:*` leaves).
// ---------------------------------------------------------------------------
const workflow = readFileSync(join(repoRoot, '.github/workflows/governance.yml'), 'utf8');
const scriptBodies = pkg.scripts ?? {};

function runsScript(body: string, name: string): boolean {
  return new RegExp(`npm run ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|&)`).test(body);
}

function scriptIsReachable(name: string): boolean {
  if (name.startsWith('validate:')) return true; // validate-static-all auto-discovers these
  if (runsScript(workflow, name)) return true;
  return Object.entries(scriptBodies).some(([other, body]) => other !== name && runsScript(body, name));
}

const unreachableScripts = Object.keys(scriptBodies)
  .filter(name => name.startsWith('test:') || name.startsWith('check:'))
  .filter(name => !scriptIsReachable(name))
  .sort();

const knownUnreachablePath = join(repoRoot, 'scripts/fixtures/known-unreachable-scripts.json');
const knownUnreachable: string[] = JSON.parse(readFileSync(knownUnreachablePath, 'utf8'));

console.log(`unreachable test/check scripts: ${unreachableScripts.length} (known ${knownUnreachable.length})`);
const newlyUnreachable = unreachableScripts.filter(name => !knownUnreachable.includes(name));
const nowReachable = knownUnreachable.filter(name => !unreachableScripts.includes(name));

const knownPath = join(repoRoot, 'scripts/fixtures/known-test-orphans.json');
const known: string[] = JSON.parse(readFileSync(knownPath, 'utf8'));
const knownSet = new Set(known);

const added = orphans.filter(file => !knownSet.has(file));
const adopted = known.filter(file => !orphans.includes(file));

console.log(`test files: ${tests.length}`);
console.log(`orphans: ${orphans.length} (known ${known.length})`);

let failed = false;
for (const name of newlyUnreachable) {
  console.error(
    `FAIL: npm script "${name}" runs test files but nothing runs it -- not CI, not another script. `
    + 'A test behind an uninvoked script is not a safety net.',
  );
  failed = true;
}
if (nowReachable.length > 0) {
  console.error(
    `FAIL: ${nowReachable.length} script(s) in known-unreachable-scripts.json are now reachable. `
    + `Remove them -- the list is a ratchet and may only shrink:\n  ${nowReachable.join('\n  ')}`,
  );
  failed = true;
}
for (const file of added) {
  console.error(`FAIL: ${file} is a new test file that no npm script runs.`);
  failed = true;
}
if (adopted.length > 0) {
  console.error(
    `FAIL: ${adopted.length} file(s) in known-test-orphans.json are now run by an npm script. `
    + `Remove them from that list -- it is a ratchet and may only shrink:\n  ${adopted.join('\n  ')}`,
  );
  failed = true;
}

if (failed) {
  console.error('RED: the orphan ratchet moved in the wrong direction.');
  process.exit(1);
}
console.log('GREEN: no new orphan test files.');
process.exit(0);
