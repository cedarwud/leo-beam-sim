#!/usr/bin/env node
/**
 * The deleted-symbol guard, as an assertion rather than a comment.
 *
 * `runSummary.ts` used to merely PROMISE it reintroduced no deleted symbol.
 * Ruling 2026-08-22: wire that promise to a test. Two independent checks,
 * because they catch different mistakes:
 *
 *   1. the RUNTIME surface — what actually reaches a screen;
 *   2. the SOURCE, comments stripped — what a future edit might name.
 *
 * Known and deliberately out of scope: `src/analysis/canonicalEe/producer.ts`
 * computes `gammaReqB` and inverts it to `pReqUW`. That is the engine's power
 * allocation, it predates the symbol ruling, and renaming engine internals is
 * an owner decision. What this guard enforces is that none of it reaches a
 * course-facing output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as sixActs from './index';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Identifiers the ACTIVE SYMBOL AUTHORITY has removed.
 *
 * `V_b` and `v_max` are both here: the 2026-08-22 ruling deleted the per-satellite
 * beam-count cap outright rather than renaming it, so neither spelling may come
 * back. Render-layer names like `MAX_BEAMS_PER_SATELLITE` are a different thing
 * and are not listed.
 */
const DELETED_SYMBOLS: readonly { readonly pattern: RegExp; readonly why: string }[] = Object.freeze([
  { pattern: /gamma[_-]?req/i, why: 'γ_req was removed from the paper' },
  { pattern: /γ[_ ]?req/i, why: 'γ_req was removed from the paper' },
  { pattern: /\bp[_]?req\b/i, why: 'required-power inversion was removed with γ_req' },
  { pattern: /requiredPower/i, why: 'required-power inversion was removed with γ_req' },
  { pattern: /\bv[_]?max\b/i, why: 'the per-satellite beam-count cap was deleted, not renamed' },
  { pattern: /\bV_b\b/, why: 'the per-satellite beam-count cap was deleted, not renamed' },
  { pattern: /widetilde/i, why: '\\widetilde was removed from the paper' },
  { pattern: /\bK_tar\b|\bq_lo\b|\bq_hi\b|\bT_lo\b|\bT_hi\b/, why: 'multi-letter subscripts were single-lettered' },
]);

function collectStrings(value: unknown, into: string[], depth = 0): void {
  if (depth > 8 || value === null || value === undefined) return;
  if (typeof value === 'string') { into.push(value); return; }
  if (typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, into, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      into.push(key);
      collectStrings(entry, into, depth + 1);
    }
  }
}

test('no deleted symbol reaches the course-facing runtime surface', () => {
  const strings: string[] = [];
  for (const [name, exported] of Object.entries(sixActs)) {
    strings.push(name);
    if (typeof exported === 'function') continue;
    collectStrings(exported, strings);
  }
  assert.ok(strings.length > 50, 'the barrel should expose a real surface to scan');

  for (const text of strings) {
    for (const { pattern, why } of DELETED_SYMBOLS) {
      assert.ok(
        !pattern.test(text),
        `course-facing value ${JSON.stringify(text)} matches ${String(pattern)}: ${why}`,
      );
    }
  }
});

/** Strips line and block comments so a guard's own documentation is not a hit. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ' '))
    .join('\n');
}

test('no deleted symbol is named in six-acts code', () => {
  const files = readdirSync(MODULE_DIR).filter(name => name.endsWith('.ts'));
  assert.ok(files.length >= 10, 'the module should have files to scan');

  for (const file of files) {
    // The guard names the forbidden symbols on purpose.
    if (file === 'deletedSymbols.test.ts') continue;
    const code = stripComments(readFileSync(join(MODULE_DIR, file), 'utf8'));
    for (const { pattern, why } of DELETED_SYMBOLS) {
      const match = pattern.exec(code);
      assert.ok(match === null, `${file} names ${String(match?.[0])} (${String(pattern)}): ${why}`);
    }
  }
});

test('the comment-stripping guard actually strips, and actually catches', () => {
  // Without this the previous test could pass by stripping everything.
  assert.strictEqual(stripComments('const a = 1; // gammaReq\n').includes('gammaReq'), false);
  assert.strictEqual(stripComments('/* gammaReq */ const a = 1;').includes('gammaReq'), false);
  assert.ok(stripComments('const gammaReqB = 1;').includes('gammaReqB'));
  assert.ok(DELETED_SYMBOLS.some(entry => entry.pattern.test('const gammaReqB = 1;')));
  assert.ok(DELETED_SYMBOLS.some(entry => entry.pattern.test('const vMax = 7;')));
});
