#!/usr/bin/env node
/**
 * validate:test-orphans -- every repository test file must be named by an npm
 * script, and every test script must be reachable from an aggregate entrypoint.
 *
 * The repository surface is the whole worktree below the project root. This
 * includes source tests outside src/ and catches a newly-created test before
 * it is staged, while excluding dependency, build, and private scratch
 * artifacts that CI will not receive.
 *
 * Aggregate roots are `test:all` and explicitly named `test:all:*` tiers. A
 * tier is allowed to be separately invokable when the fast green tier and a
 * broader known-red/environment-dependent audit tier have different status
 * expectations; every non-tier `test:*` script must still be reachable from
 * one of those roots.
 *
 * Run: npm run validate:test-orphans
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>;
};
const scriptBodies = pkg.scripts ?? {};
const TEST_FILE_RE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/;

const IGNORED_REPO_DIRECTORIES = new Set([
  '.git',
  '.scratch',
  '.claude',
  '.codex',
  '.gstack',
  '.playwright-cli',
  '.playwright-mcp',
  'dist',
  'node_modules',
  'output',
]);

function repositoryFiles(dir = '', out: string[] = []): string[] {
  for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_REPO_DIRECTORIES.has(entry.name)) continue;
    const file = posix.join(dir, entry.name);
    if (entry.isDirectory()) repositoryFiles(file, out);
    else out.push(file);
  }
  return out;
}

function globToRegex(pattern: string): RegExp {
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${source}$`);
}

function quotedGlobPatterns(body: string): string[] {
  return [...body.matchAll(/(['"])([^'"]*\*[^'"]*)\1/g)].map(match => match[2]);
}

function scriptCoversFile(body: string, file: string): boolean {
  if (body.includes(file)) return true;
  return quotedGlobPatterns(body).some(pattern => globToRegex(pattern).test(file));
}

const tests = repositoryFiles().filter(file => TEST_FILE_RE.test(file)).sort();
const reachedBy = new Map<string, string[]>();
for (const file of tests) {
  const scripts = Object.entries(scriptBodies)
    .filter(([, body]) => scriptCoversFile(body, file))
    .map(([name]) => name);
  reachedBy.set(file, scripts);
}
const orphans = tests.filter(file => (reachedBy.get(file) ?? []).length === 0);

/** Find test-file tokens and quoted test globs in npm script bodies. */
function testReferences(body: string): string[] {
  return (body.match(/(?:src|scripts)\/[^\s'"`;&|]+/g) ?? [])
    .filter(token => token.includes('.test.') || token.includes('.spec.'));
}

const missingTestReferences: Array<{ script: string; reference: string }> = [];
for (const [script, body] of Object.entries(scriptBodies)) {
  for (const reference of testReferences(body)) {
    if (reference.includes('*')) {
      const matcher = globToRegex(reference);
      if (!tests.some(file => matcher.test(file))) {
        missingTestReferences.push({ script, reference });
      }
    } else if (!existsSync(join(repoRoot, reference))) {
      missingTestReferences.push({ script, reference });
    }
  }
}

const SCRIPT_CALL_RE = /\bnpm run ([A-Za-z0-9:_-]+)/g;
function referencedScripts(body: string): string[] {
  return [...body.matchAll(SCRIPT_CALL_RE)].map(match => match[1]);
}

function reachableScriptsFrom(roots: string[]): Set<string> {
  const reachable = new Set<string>();
  const pending = [...roots];
  while (pending.length > 0) {
    const name = pending.pop();
    if (!name || reachable.has(name)) continue;
    reachable.add(name);
    for (const child of referencedScripts(scriptBodies[name] ?? '')) {
      if (scriptBodies[child] && !reachable.has(child)) pending.push(child);
    }
  }
  return reachable;
}

const aggregateEntrypoints = Object.keys(scriptBodies)
  .filter(name => name === 'test:all' || name.startsWith('test:all:'))
  .sort();
const aggregateReachable = reachableScriptsFrom(aggregateEntrypoints);
const aggregateTestScripts = Object.keys(scriptBodies)
  .filter(name => name.startsWith('test:'))
  .filter(name => !name.startsWith('test:all'));
const unaggregatedTestScripts = aggregateTestScripts
  .filter(name => !aggregateReachable.has(name))
  .sort();

// Preserve the older check:* ratchet while giving test:* its stronger
// aggregate-root check above.
const workflowPath = join(repoRoot, '.github/workflows/governance.yml');
const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
function runsScript(body: string, name: string): boolean {
  return new RegExp(
    `\\bnpm run ${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?=\\s|$|&)`,
  ).test(body);
}
function scriptIsReachable(name: string): boolean {
  if (name.startsWith('validate:')) return true;
  if (runsScript(workflow, name)) return true;
  return Object.entries(scriptBodies).some(([other, body]) => other !== name && runsScript(body, name));
}
const unreachableCheckScripts = Object.keys(scriptBodies)
  .filter(name => name.startsWith('check:'))
  .filter(name => !scriptIsReachable(name))
  .sort();

const knownUnreachablePath = join(repoRoot, 'scripts/fixtures/known-unreachable-scripts.json');
const knownUnreachable: string[] = JSON.parse(readFileSync(knownUnreachablePath, 'utf8'));
const newlyUnreachableChecks = unreachableCheckScripts
  .filter(name => !knownUnreachable.includes(name));
const nowReachableChecks = knownUnreachable
  .filter(name => !unreachableCheckScripts.includes(name));

const knownPath = join(repoRoot, 'scripts/fixtures/known-test-orphans.json');
const known: string[] = JSON.parse(readFileSync(knownPath, 'utf8'));
const knownSet = new Set(known);
const added = orphans.filter(file => !knownSet.has(file));
const adopted = known.filter(file => !orphans.includes(file));

console.log(`test files: ${tests.length}`);
console.log(`test files reached by npm scripts: ${tests.length - orphans.length}`);
console.log(`orphans: ${orphans.length} (known ${known.length})`);
console.log(`missing test references: ${missingTestReferences.length}`);
console.log(`aggregate entrypoints: ${aggregateEntrypoints.length > 0 ? aggregateEntrypoints.join(', ') : '(none)'}`);
console.log(`unaggregated test scripts: ${unaggregatedTestScripts.length}`);
console.log(`unreachable check scripts: ${unreachableCheckScripts.length} (known ${knownUnreachable.length})`);

let failed = false;
if (!aggregateEntrypoints.includes('test:all')) {
  console.error('FAIL: npm script "test:all" is required as the authoritative test aggregate.');
  failed = true;
}
for (const { script, reference } of missingTestReferences) {
  console.error(`FAIL: npm script "${script}" references missing test file/glob "${reference}".`);
  failed = true;
}
for (const name of unaggregatedTestScripts) {
  console.error(
    `FAIL: npm script "${name}" is not reached by a test:all aggregate entrypoint. `
    + 'A test script behind no aggregate is not a safety net.',
  );
  failed = true;
}
for (const name of newlyUnreachableChecks) {
  console.error(`FAIL: npm script "${name}" is a new unreachable check script.`);
  failed = true;
}
if (nowReachableChecks.length > 0) {
  console.error(
    `FAIL: ${nowReachableChecks.length} check script(s) in known-unreachable-scripts.json are now reachable. `
    + `Remove them from that list:\n  ${nowReachableChecks.join('\n  ')}`,
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
    + `Remove them from that list:\n  ${adopted.join('\n  ')}`,
  );
  failed = true;
}

if (failed) {
  console.error('RED: the test reachability ratchet moved in the wrong direction.');
  process.exit(1);
}
console.log('GREEN: every repository test file is scripted and every test script is aggregated.');
process.exit(0);
