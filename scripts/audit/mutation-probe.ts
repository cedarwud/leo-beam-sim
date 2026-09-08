#!/usr/bin/env node
/**
 * Repeatable aggregate-suite mutation probe.
 *
 * The manifest is deliberately exact-text based.  A mutation is valid only
 * when its file, line anchor, and `from` text each match exactly once.  After
 * writing, the probe uses ripgrep to prove that the `to` text is present,
 * runs the target command, restores the original bytes, and uses ripgrep
 * again to prove that the original text is back.
 *
 * Usage:
 *   node --import tsx/esm scripts/audit/mutation-probe.ts
 *   node --import tsx/esm scripts/audit/mutation-probe.ts --no-baseline
 *   node --import tsx/esm scripts/audit/mutation-probe.ts --ids appearance-visibility,scene-frame
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

interface MutationText {
  readonly from: string;
  readonly to: string;
}

export interface MutationSpec {
  readonly id: string;
  readonly category: string;
  readonly priority: 'critical' | 'high' | 'medium';
  readonly file: string;
  readonly lineAnchor: string;
  readonly mutation: MutationText;
  readonly target?: string;
}

interface Manifest {
  readonly target: string;
  readonly mutations: readonly MutationSpec[];
}

interface GrepProof {
  readonly query: string;
  readonly matched: boolean;
  readonly output: string;
}

interface ProbeResult {
  readonly id: string;
  readonly category: string;
  readonly priority: MutationSpec['priority'];
  readonly file: string;
  readonly target: string;
  readonly status: 'DETECTED' | 'ESCAPED' | 'INVALID';
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly applyGrep: GrepProof;
  readonly revertGrep: GrepProof;
  readonly outputTail: string;
  readonly error?: string;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = join(repoRoot, 'scripts/audit/mutation-probe.manifest.json');
const args = new Set(process.argv.slice(2));
const selectedIds = (() => {
  const value = process.argv.find(argument => argument.startsWith('--ids='));
  if (!value) return null;
  return new Set(value.slice('--ids='.length).split(',').filter(Boolean));
})();

function displayPath(file: string): string {
  return relative(repoRoot, file) || file;
}

function countExact(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = haystack.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function grepFixed(file: string, query: string): GrepProof {
  const result = spawnSync(
    'rg',
    ['--fixed-strings', '--multiline', '--line-number', '--no-heading', '--max-count', '3', '--', query, file],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return { query, matched: result.status === 0, output };
}

function requireGrep(proof: GrepProof, description: string): void {
  if (!proof.matched) {
    throw new Error(`${description}: grep found no match for ${JSON.stringify(proof.query)}`);
  }
}

function runCommand(command: string): { exitCode: number | null; output: string } {
  const result = spawnSync('bash', ['-lc', command], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    exitCode: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function tail(output: string, lines = 10): string {
  return output.trim().split('\n').slice(-lines).join('\n');
}

function loadManifest(): Manifest {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  if (!manifest.target || !Array.isArray(manifest.mutations) || manifest.mutations.length === 0) {
    throw new Error('mutation manifest must define a target and at least one mutation');
  }
  const ids = new Set<string>();
  for (const mutation of manifest.mutations) {
    if (ids.has(mutation.id)) throw new Error(`duplicate mutation id: ${mutation.id}`);
    ids.add(mutation.id);
    if (selectedIds !== null && !selectedIds.has(mutation.id)) continue;
    const file = isAbsolute(mutation.file) ? mutation.file : join(repoRoot, mutation.file);
    if (!existsSync(file)) throw new Error(`${mutation.id}: missing file ${mutation.file}`);
    if (mutation.lineAnchor.length === 0 || mutation.mutation.from.length === 0) {
      throw new Error(`${mutation.id}: lineAnchor and mutation.from must be non-empty`);
    }
    if (mutation.mutation.from === mutation.mutation.to) {
      throw new Error(`${mutation.id}: mutation.from and mutation.to are identical`);
    }
  }
  return {
    ...manifest,
    mutations: selectedIds === null
      ? manifest.mutations
      : manifest.mutations.filter(mutation => selectedIds.has(mutation.id)),
  };
}

function runBaseline(target: string): void {
  console.log(`BASELINE target=${target}`);
  const baseline = runCommand(target);
  console.log(`BASELINE exit=${baseline.exitCode}`);
  if (baseline.output.trim().length > 0) console.log(tail(baseline.output, 12));
  if (baseline.exitCode !== 0) {
    throw new Error('baseline target is red; no mutation result would be interpretable');
  }
}

function validateManifestEntries(mutations: readonly MutationSpec[]): void {
  for (const spec of mutations) {
    const file = isAbsolute(spec.file) ? spec.file : join(repoRoot, spec.file);
    const source = readFileSync(file, 'utf8');
    const anchorCount = countExact(source, spec.lineAnchor);
    const fromCount = countExact(source, spec.mutation.from);
    if (anchorCount !== 1 || fromCount !== 1) {
      throw new Error(
        `${spec.id}: lineAnchor=${anchorCount}, mutation.from=${fromCount}; both must match exactly once`,
      );
    }
    console.log(`VALID ${spec.id} ${displayPath(file)} anchor=1 from=1`);
  }
}

function probeMutation(spec: MutationSpec, defaultTarget: string): ProbeResult {
  const target = spec.target ?? defaultTarget;
  const file = isAbsolute(spec.file) ? spec.file : join(repoRoot, spec.file);
  const original = readFileSync(file, 'utf8');
  const applyGrep: GrepProof = { query: spec.mutation.to, matched: false, output: '' };
  const revertGrep: GrepProof = { query: spec.mutation.from, matched: false, output: '' };
  let applied = false;
  let exitCode: number | null = null;
  let output = '';
  const started = Date.now();

  try {
    const anchorCount = countExact(original, spec.lineAnchor);
    if (anchorCount !== 1) {
      throw new Error(`line anchor matched ${anchorCount} times, expected exactly 1`);
    }
    const fromCount = countExact(original, spec.mutation.from);
    if (fromCount !== 1) {
      throw new Error(`mutation.from matched ${fromCount} times, expected exactly 1`);
    }
    writeFileSync(file, original.replace(spec.mutation.from, spec.mutation.to));
    applied = true;
    const landed = grepFixed(file, spec.mutation.to);
    requireGrep(landed, 'mutation apply proof');
    Object.assign(applyGrep, landed);

    const run = runCommand(target);
    exitCode = run.exitCode;
    output = run.output;
    return {
      id: spec.id,
      category: spec.category,
      priority: spec.priority,
      file: displayPath(file),
      target,
      status: exitCode === 0 ? 'ESCAPED' : 'DETECTED',
      exitCode,
      durationMs: Date.now() - started,
      applyGrep,
      revertGrep,
      outputTail: tail(output),
    };
  } catch (error) {
    return {
      id: spec.id,
      category: spec.category,
      priority: spec.priority,
      file: displayPath(file),
      target,
      status: 'INVALID',
      exitCode,
      durationMs: Date.now() - started,
      applyGrep,
      revertGrep,
      outputTail: tail(output),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (applied) {
      writeFileSync(file, original);
      const restored = grepFixed(file, spec.mutation.from);
      Object.assign(revertGrep, restored);
      if (!restored.matched) {
        throw new Error(`${spec.id}: revert proof failed for ${displayPath(file)}`);
      }
    }
  }
}

const manifest = loadManifest();
if (manifest.mutations.length === 0) throw new Error('selection matched no mutation ids');
if (args.has('--validate-only')) {
  validateManifestEntries(manifest.mutations);
  process.exit(0);
}
if (!args.has('--no-baseline')) runBaseline(manifest.target);

const results: ProbeResult[] = [];
for (const spec of manifest.mutations) {
  const result = probeMutation(spec, manifest.target);
  results.push(result);
  console.log(
    `${result.status.padEnd(8)} ${result.id} ${result.file} `
    + `exit=${result.exitCode ?? 'signal'} duration_ms=${result.durationMs}`,
  );
  if (result.status === 'INVALID') console.log(`  INVALID: ${result.error}`);
  if (result.applyGrep.matched) console.log(`  apply grep: ${result.applyGrep.output}`);
  if (result.revertGrep.matched) console.log(`  revert grep: ${result.revertGrep.output}`);
}

const measured = results.filter(result => result.status !== 'INVALID');
const detected = measured.filter(result => result.status === 'DETECTED').length;
const escaped = measured.filter(result => result.status === 'ESCAPED').length;
console.log(`RESULT measured=${measured.length} detected=${detected} escaped=${escaped}`);
console.log(`DETECT_RATE ${detected}/${measured.length} = ${measured.length === 0 ? 'NaN' : (detected / measured.length).toFixed(4)}`);
if (results.some(result => result.status === 'INVALID')) process.exitCode = 2;
