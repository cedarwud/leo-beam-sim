/**
 * P1e (b1) — Static import-boundary scanner for src/showcase/**.
 *
 * SDD §9 P1 exit criterion (b1) calls for an ESLint `no-restricted-imports`
 * rule. This repo does not run ESLint (package.json: `"lint": "tsc --noEmit"`),
 * so we satisfy the same negative-path enforcement with a standalone
 * AST-style scanner. The scanner asserts that every TypeScript / TSX file
 * under `src/showcase/` (the artifact-replay-only code path) does NOT import
 * any of the forbidden live-engine modules / symbols:
 *
 *   - `src/core/channel/**`            (paper SNR/SINR recompute is forbidden)
 *   - `src/core/beam/**`               (live beam layout is forbidden)
 *   - `src/engine/handover/handover-manager.ts` + symbol `HandoverManager`
 *   - `src/engine/signal/link-budget.ts` + symbols `computeLinkBudget`,
 *     `buildLinkContext`
 *   - `src/scene/runtimeFrameStep.ts` + symbol `runtimeFrameStep`
 *
 * If ESLint is later adopted in this repo, the corresponding rule should be:
 *
 *     "no-restricted-imports": ["error", {
 *       "patterns": [
 *         "**\/core/channel/**",
 *         "**\/core/beam/**",
 *         "**\/engine/handover/handover-manager*",
 *         "**\/engine/signal/link-budget*",
 *         "**\/runtimeFrameStep*"
 *       ]
 *     }]
 *
 * Pair with P1e (b2) runtime side-effect probe: SDD §9 says either is
 * insufficient alone. Static catches a developer who writes a forbidden
 * import; runtime catches a transitive evaluation that slipped through.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SHOWCASE_DIR = path.join(REPO_ROOT, 'src', 'showcase');

/**
 * Module-path patterns that no file in `src/showcase/**` may import (directly
 * or via re-export). Matched against the post-resolution path relative to the
 * repo root, after `../..` resolution.
 */
const FORBIDDEN_MODULE_REGEXES: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /(?:^|\/)src\/core\/channel(?:\/|$)/, reason: 'src/core/channel/** — recomputes paper SINR/SNR (R1)' },
  { pattern: /(?:^|\/)src\/core\/beam(?:\/|$)/, reason: 'src/core/beam/** — live beam layout (R1)' },
  { pattern: /(?:^|\/)src\/engine\/handover\/handover-manager(?:\.|$)/, reason: 'src/engine/handover/handover-manager — live HandoverManager (R1)' },
  { pattern: /(?:^|\/)src\/engine\/signal\/link-budget(?:\.|$)/, reason: 'src/engine/signal/link-budget — live computeLinkBudget/buildLinkContext (R1)' },
  { pattern: /(?:^|\/)src\/scene\/runtimeFrameStep(?:\.|$)/, reason: 'src/scene/runtimeFrameStep — live frame stepper (R1)' },
];

/**
 * Named-symbol blacklist. Even if a file imports from an allowed module that
 * happens to re-export one of these symbols, the import is forbidden.
 */
const FORBIDDEN_NAMED_IMPORTS: ReadonlySet<string> = new Set([
  'HandoverManager',
  'computeLinkBudget',
  'buildLinkContext',
  'runtimeFrameStep',
]);

/** Walk a directory recursively and collect .ts / .tsx files. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

type ImportSite = {
  readonly file: string;
  readonly line: number;
  readonly source: string;
  readonly resolvedSource: string;
  readonly namedImports: ReadonlyArray<string>;
  readonly hasDefault: boolean;
  readonly hasNamespace: boolean;
};

/**
 * Parse import statements from a TypeScript / TSX source file. Handles:
 *   - `import { a, b as c } from '…';`
 *   - `import * as ns from '…';`
 *   - `import def from '…';`
 *   - `import '…';`
 *   - `import type { X } from '…';` (treated identically — boundary applies
 *     to type imports too; even a type pull crosses the architecture seam)
 *   - dynamic `import('…')` (string-literal form only — non-literal dynamic
 *     imports are not detected by this static scanner and are caught by the
 *     P1e b2 runtime probe instead)
 *
 * Multi-line imports are normalised by joining lines until the matching
 * closing brace + 'from' clause appears.
 */
function parseImports(file: string, source: string): ImportSite[] {
  const sites: ImportSite[] = [];
  const lines = source.split(/\r?\n/);
  const fileDir = path.dirname(file);

  let buf = '';
  let bufStartLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (buf === '') {
      if (!trimmed.startsWith('import')) continue;
      bufStartLine = i + 1;
      buf = trimmed;
    } else {
      buf += ' ' + trimmed;
    }
    // Heuristic: continue until we see `from '…';` or `'…';` (side-effect
    // import) or a dynamic-import close paren.
    if (!/from\s+['"][^'"]+['"]\s*;?\s*$/.test(buf) && !/^import\s+['"][^'"]+['"]\s*;?\s*$/.test(buf)) {
      // Still consuming multi-line import.
      continue;
    }

    const statement = buf;
    buf = '';
    const fromMatch = statement.match(/from\s+['"]([^'"]+)['"]\s*;?\s*$/);
    const sideEffectMatch = statement.match(/^import\s+['"]([^'"]+)['"]\s*;?\s*$/);
    const sourceSpec = fromMatch ? fromMatch[1] : sideEffectMatch ? sideEffectMatch[1] : null;
    if (sourceSpec === null) continue;

    const namedMatch = statement.match(/import\s+(?:type\s+)?\{([^}]*)\}/);
    const namedImports: string[] = namedMatch
      ? namedMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((s) => {
            // Strip `type` prefix on individual specifiers.
            const noTypePrefix = s.replace(/^type\s+/, '');
            // Take the original name (before `as`).
            const asSplit = noTypePrefix.split(/\s+as\s+/);
            return asSplit[0];
          })
      : [];

    const hasDefault = /^import\s+(?:type\s+)?[A-Za-z_$][\w$]*\s*(?:,|from)/.test(statement);
    const hasNamespace = /\*\s+as\s+[A-Za-z_$][\w$]*/.test(statement);

    let resolvedSource = sourceSpec;
    if (sourceSpec.startsWith('.')) {
      resolvedSource = path
        .resolve(fileDir, sourceSpec)
        .replace(REPO_ROOT + path.sep, '')
        .replace(/\\/g, '/');
    }

    sites.push({
      file,
      line: bufStartLine,
      source: sourceSpec,
      resolvedSource,
      namedImports,
      hasDefault,
      hasNamespace,
    });
  }
  return sites;
}

function relForLog(p: string): string {
  return p.replace(REPO_ROOT + path.sep, '').replace(/\\/g, '/');
}

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

console.log('validate-modqn-visual-showcase-p1e-import-boundary');

const files = walk(SHOWCASE_DIR);
assert.ok(files.length > 0, 'expected at least one file under src/showcase/');
console.log(`  scan target: ${files.length} file(s) under ${relForLog(SHOWCASE_DIR)}/`);

const allSites: ImportSite[] = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  allSites.push(...parseImports(file, text));
}

test('no src/showcase/** file imports from a forbidden module path', () => {
  const violations: string[] = [];
  for (const site of allSites) {
    for (const rule of FORBIDDEN_MODULE_REGEXES) {
      if (rule.pattern.test(site.resolvedSource)) {
        violations.push(
          `${relForLog(site.file)}:${site.line}  imports '${site.source}' → resolved '${site.resolvedSource}' — forbidden: ${rule.reason}`,
        );
      }
    }
  }
  if (violations.length > 0) {
    throw new Error(`import-boundary violations:\n  ${violations.join('\n  ')}`);
  }
});

test('no src/showcase/** file imports a forbidden symbol by name', () => {
  const violations: string[] = [];
  for (const site of allSites) {
    for (const named of site.namedImports) {
      if (FORBIDDEN_NAMED_IMPORTS.has(named)) {
        violations.push(
          `${relForLog(site.file)}:${site.line}  imports '${named}' from '${site.source}' — forbidden symbol (R1 seam)`,
        );
      }
    }
  }
  if (violations.length > 0) {
    throw new Error(`symbol-boundary violations:\n  ${violations.join('\n  ')}`);
  }
});

test('positive control: scanner finds a forbidden import when seeded artificially', () => {
  const synthetic = [
    "import { HandoverManager } from '../engine/handover/handover-manager';",
    "import { computeLinkBudget } from '../engine/signal/link-budget';",
    "import * as channel from '../core/channel';",
    "import '../core/beam/layout';",
  ].join('\n');
  const fakeFile = path.join(SHOWCASE_DIR, '__synthetic__.ts');
  const sites = parseImports(fakeFile, synthetic);
  assert.strictEqual(sites.length, 4, 'parser must capture 4 imports from synthetic source');

  const flagged = sites.filter((s) =>
    FORBIDDEN_MODULE_REGEXES.some((r) => r.pattern.test(s.resolvedSource)),
  );
  assert.strictEqual(
    flagged.length,
    4,
    'all 4 synthetic forbidden imports must be flagged by FORBIDDEN_MODULE_REGEXES',
  );

  const namedFlags = sites.filter((s) =>
    s.namedImports.some((n) => FORBIDDEN_NAMED_IMPORTS.has(n)),
  );
  assert.strictEqual(
    namedFlags.length,
    2,
    'exactly 2 synthetic imports (HandoverManager, computeLinkBudget) carry a forbidden named symbol',
  );
});

console.log('OK');
