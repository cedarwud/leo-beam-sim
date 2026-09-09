#!/usr/bin/env node

/**
 * ARCHITECTURE BOUNDARIES — the structural rules that make DUPLICATE AUTHORITY
 * impossible rather than merely detectable.
 *
 * ## Why this file grew three rules (2026-09-09)
 *
 * A measured experiment (two isolated worktrees, fresh agents, five one-sentence
 * tasks) found that SPLITTING large files was a wash: task success 2/5 before and
 * 2/5 after, while navigation cost ROSE (+44% tokens, +115% content lines read,
 * +43% files opened). Meanwhile every real bug the effort surfaced was DUPLICATE
 * AUTHORITY, not file size:
 *
 *   - one satellite's identity colour decided in three places that disagreed;
 *   - a rail redeclaring 13 symbols an appearance module already exported, where
 *     the LOCAL copies were what reached the screen;
 *   - `emphasizeIntraHandoverColor` existing twice, byte-identical, so editing the
 *     owner changed nothing;
 *   - `hslToHex` existing three times, one with an incompatible signature.
 *
 * `scripts/audit/appearance-change-drill.sh` grew a "check A" that counts
 * declarations of a perturbed symbol and fails above one. It caught two of the
 * duplicates above — but it only fires for the ~14 symbols the drill happens to
 * perturb. R1/R2/R3 below generalise that check to the whole repo.
 *
 * The two pre-existing import rules (engine/, scene/) are unchanged; they are the
 * first two entries of `IMPORT_RULES`.
 *
 * ## The ratchet
 *
 * Rules are NEVER weakened to make the current tree pass. Violations that need a
 * judgement call are listed EXPLICITLY, one line each, in
 * `scripts/architecture-boundaries-baseline.json`. The runner fails BOTH ways:
 *   - a violation not in the baseline  -> FAIL (a new one appeared);
 *   - a baseline entry that no longer violates -> FAIL (stale; delete it).
 * So the baseline can only shrink, and it can never grow unnoticed.
 */

import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const srcRoot = path.join(repoRoot, 'src');
const baselinePath = path.join(scriptDir, 'architecture-boundaries-baseline.json');

let passed = 0;
let failed = 0;

function pass(label: string): void {
  if (!PRINT_OBSERVED) console.log(`  [PASS] ${label}`);
  passed += 1;
}

function fail(label: string, detail?: string): void {
  if (!PRINT_OBSERVED) console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed += 1;
}

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir).flatMap(entry => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return walkFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [fullPath];
  });
  return entries.sort();
}

function toRepoPath(fullPath: string): string {
  return path.relative(repoRoot, fullPath).split(path.sep).join('/');
}

const isTestPath = (repoPath: string): boolean => /\.test\.tsx?$/.test(repoPath);

const sourceFiles = walkFiles(srcRoot);
const parsed = new Map<string, ts.SourceFile>();
function sourceOf(fullPath: string): ts.SourceFile {
  let sf = parsed.get(fullPath);
  if (sf === undefined) {
    sf = ts.createSourceFile(
      fullPath,
      readFileSync(fullPath, 'utf8'),
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      fullPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    parsed.set(fullPath, sf);
  }
  return sf;
}
const lineOf = (sf: ts.SourceFile, node: ts.Node): number =>
  sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

// ---------------------------------------------------------------------------
// BASELINE — explicit, one entry per known violation. See header.
// ---------------------------------------------------------------------------

interface BaselineEntry {
  readonly rule: string;
  readonly key: string;
  readonly count: number;
  readonly reason: string;
}

const baseline: readonly BaselineEntry[] =
  (JSON.parse(readFileSync(baselinePath, 'utf8')) as { readonly violations: BaselineEntry[] }).violations;

interface Violation {
  readonly key: string;
  readonly detail: string;
}

/**
 * `--print-observed` dumps the CURRENT violation set as baseline JSON on stdout.
 * It never writes the baseline file: widening the ratchet must stay a deliberate,
 * reviewable copy-paste with a written reason per row, never a `--fix` away.
 */
const PRINT_OBSERVED = process.argv.includes('--print-observed');
const observedAll: Array<{ rule: string; key: string; count: number; reason: string }> = [];

/**
 * Compare an observed violation set against the baseline for one rule.
 *
 * NEW violations fail. STALE baseline entries also fail — a baseline that can
 * keep dead rows is a baseline that can be padded, and this repo has already been
 * bitten by a check that silently matched nothing and was read as a pass.
 */
function reportAgainstBaseline(label: string, observed: readonly Violation[], rule: string): void {
  const expected = new Map(baseline.filter(e => e.rule === rule).map(e => [e.key, e]));
  const seen = new Map<string, Violation[]>();
  for (const v of observed) {
    const bucket = seen.get(v.key) ?? [];
    bucket.push(v);
    seen.set(v.key, bucket);
  }

  for (const [key, hits] of seen) observedAll.push({ rule, key, count: hits.length, reason: expected.get(key)?.reason ?? 'TODO: state why this is not fixed now' });

  if (PRINT_OBSERVED) return;

  const unexpected: Violation[] = [];
  const countDrift: string[] = [];
  for (const [key, hits] of seen) {
    const entry = expected.get(key);
    if (entry === undefined) {
      unexpected.push(...hits);
      continue;
    }
    if (entry.count !== hits.length) {
      countDrift.push(`${key}: baseline says ${entry.count}, found ${hits.length}\n      ${hits.map(h => h.detail).join('\n      ')}`);
    }
  }
  const stale = [...expected.keys()].filter(key => !seen.has(key));

  const problems: string[] = [];
  if (unexpected.length > 0) {
    problems.push(`NEW violation(s) — not in the baseline:\n    ${unexpected.map(v => v.detail).join('\n    ')}`);
  }
  if (countDrift.length > 0) {
    problems.push(`baseline COUNT drift:\n    ${countDrift.join('\n    ')}`);
  }
  if (stale.length > 0) {
    problems.push(`STALE baseline entr(ies) — fixed, so delete the row(s) from ${toRepoPath(baselinePath)}:\n    ${stale.join('\n    ')}`);
  }

  if (problems.length > 0) {
    fail(label, `\n  ${problems.join('\n  ')}`);
    return;
  }
  const baselined = [...expected.keys()].length;
  pass(`${label}${baselined > 0 ? ` (${observed.length} known violation(s) across ${baselined} baselined key(s); no new ones)` : ''}`);
}

// ---------------------------------------------------------------------------
// IMPORT EDGES
// ---------------------------------------------------------------------------

interface ImportEdge {
  readonly source: string;
  readonly line: number;
  readonly specifier: string;
  readonly target: string | null;
}

interface BoundaryRule {
  readonly label: string;
  readonly rule?: string;
  readonly sourcePrefix: string;
  readonly forbiddenTargetPrefixes: readonly string[];
  readonly allow?: (edge: ImportEdge) => boolean;
}

function normalizeTarget(source: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    return `src/${specifier.slice(2)}`;
  }
  if (!specifier.startsWith('.')) {
    return null;
  }
  const absolute = path.resolve(repoRoot, path.dirname(source), specifier);
  return path.relative(repoRoot, absolute).split(path.sep).join('/');
}

function readImportEdges(): ImportEdge[] {
  return sourceFiles.flatMap(fullPath => {
    const source = toRepoPath(fullPath);
    const sf = sourceOf(fullPath);
    const edges: ImportEdge[] = [];
    const record = (node: ts.Node, spec: ts.Expression | undefined): void => {
      if (spec === undefined || !ts.isStringLiteralLike(spec)) return;
      edges.push({
        source,
        line: lineOf(sf, node),
        specifier: spec.text,
        target: normalizeTarget(source, spec.text),
      });
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) record(node, node.moduleSpecifier);
      else if (ts.isExportDeclaration(node)) record(node, node.moduleSpecifier);
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        record(node, node.moduleReference.expression);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        record(node, node.arguments[0]);
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        record(node, node.argument.literal as ts.Expression);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
    return edges;
  });
}

function violatesPrefix(target: string | null, prefixes: readonly string[]): boolean {
  return target !== null && prefixes.some(prefix => target === prefix || target.startsWith(`${prefix}/`));
}

function checkImportRule(rule: BoundaryRule, edges: readonly ImportEdge[]): void {
  const violations = edges.filter(edge => (
    edge.source.startsWith(rule.sourcePrefix)
    && violatesPrefix(edge.target, rule.forbiddenTargetPrefixes)
    && rule.allow?.(edge) !== true
  ));

  if (rule.rule !== undefined) {
    reportAgainstBaseline(
      rule.label,
      violations.map(edge => ({
        key: `${edge.source} -> ${edge.target}`,
        detail: `${edge.source}:${edge.line} -> ${edge.specifier} (${edge.target})`,
      })),
      rule.rule,
    );
    return;
  }

  if (violations.length === 0) {
    pass(rule.label);
    return;
  }

  fail(
    rule.label,
    violations
      .map(edge => `${edge.source}:${edge.line} -> ${edge.specifier}${edge.target ? ` (${edge.target})` : ''}`)
      .join('\n    '),
  );
}

/**
 * R3 — LAYER DIRECTION.
 *
 * `src/constants/**` is the bottom layer (raw decided values); `src/appearance/**`
 * sits above it (it resolves those values into what is painted); every render
 * surface (`scene`, `viz`, `ui`, `app`, `homepage`) sits above BOTH. Imports may
 * only point DOWN.
 *
 * An up-pointing edge is what let `coneGeometryContract` and `sinrLiveConeStyle`
 * close the repo's only runtime import CYCLE — appearance importing a constant
 * while the constants module re-exported an appearance symbol back. A cycle makes
 * module init order load-bearing, which is exactly the class of bug that reads as
 * "the value is undefined only in the browser".
 */
const RENDER_SURFACES = ['src/scene', 'src/viz', 'src/ui', 'src/app', 'src/homepage'] as const;

const IMPORT_RULES: readonly BoundaryRule[] = [
  {
    label: 'engine modules do not import UI, viz, app, scene, or component surfaces',
    sourcePrefix: 'src/engine/',
    forbiddenTargetPrefixes: ['src/ui', 'src/viz', 'src/app', 'src/scene', 'src/components'],
  },
  {
    label: 'scene contract/type modules do not import UI, viz, or component surfaces',
    sourcePrefix: 'src/scene/',
    forbiddenTargetPrefixes: ['src/ui', 'src/viz', 'src/components'],
    allow: edge => ![
      'src/scene/types.ts',
      'src/scene/NormalizedSceneFrame.ts',
      'src/scene/visual-showcase-contract.ts',
      'src/scene/beamTargetTypes.ts',
    ].includes(edge.source),
  },
  {
    label: 'R3a appearance/ does not import a render surface (scene, viz, ui, app, homepage)',
    rule: 'R3a',
    sourcePrefix: 'src/appearance/',
    forbiddenTargetPrefixes: [...RENDER_SURFACES],
    allow: edge => isTestPath(edge.source),
  },
  {
    label: 'R3b constants/ does not import appearance/ or a render surface',
    rule: 'R3b',
    sourcePrefix: 'src/constants/',
    forbiddenTargetPrefixes: ['src/appearance', ...RENDER_SURFACES],
    allow: edge => isTestPath(edge.source),
  },
];

// ---------------------------------------------------------------------------
// R1 — SINGLE DEFINITION
//
// For any symbol name exported from src/appearance/** or src/constants/**, there
// must be EXACTLY ONE declaration of that name across all non-test files in src/.
//
// ALL declarations are counted, exported or not. An export-only count would have
// called `hslToHex` clean while two PRIVATE copies existed — which is precisely
// how three disagreeing copies survived under a green light.
//
// Test files are excluded: a local helper in a test is not a rendering authority.
// A zero-declaration owned export is reported too (never silently a pass): the
// documented worst measurement bug in this repo is a query that quietly returns
// the empty set and is read as a fact.
// ---------------------------------------------------------------------------

interface Declaration {
  readonly name: string;
  readonly file: string;
  readonly line: number;
  readonly exported: boolean;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    && (ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function declarationsIn(fullPath: string): Declaration[] {
  const sf = sourceOf(fullPath);
  const file = toRepoPath(fullPath);
  const out: Declaration[] = [];
  const push = (name: string, node: ts.Node, exported: boolean): void => {
    out.push({ name, file, line: lineOf(sf, node), exported });
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name !== undefined
    ) push(node.name.text, node, hasExportModifier(node));
    else if (ts.isEnumDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      push(node.name.text, node, hasExportModifier(node));
    } else if (ts.isVariableStatement(node)) {
      const exported = hasExportModifier(node);
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) push(decl.name.text, decl, exported);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return out;
}

/** Public surface of a module: declared exports plus named re-exports. */
function exportedNamesIn(fullPath: string): string[] {
  const sf = sourceOf(fullPath);
  const names = declarationsIn(fullPath).filter(d => d.exported).map(d => d.name);
  const visit = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node) && node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) names.push(element.name.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return names;
}

const OWNER_PREFIXES = ['src/appearance/', 'src/constants/'] as const;

function checkSingleDefinition(): void {
  const nonTest = sourceFiles.filter(f => !isTestPath(toRepoPath(f)));
  const ownerFiles = nonTest.filter(f => OWNER_PREFIXES.some(p => toRepoPath(f).startsWith(p)));

  const ownedExports = new Set<string>();
  for (const f of ownerFiles) for (const name of exportedNamesIn(f)) ownedExports.add(name);

  const byName = new Map<string, Declaration[]>();
  for (const f of nonTest) {
    for (const decl of declarationsIn(f)) {
      const bucket = byName.get(decl.name) ?? [];
      bucket.push(decl);
      byName.set(decl.name, bucket);
    }
  }

  if (ownedExports.size === 0) {
    fail('R1 single definition', 'INVALID — the owned-export set is EMPTY, so this rule matched nothing. That is never a pass.');
    return;
  }

  const missing: string[] = [];
  const violations: Violation[] = [];
  for (const name of [...ownedExports].sort()) {
    const declarations = byName.get(name) ?? [];
    if (declarations.length === 0) {
      missing.push(name);
      continue;
    }
    if (declarations.length === 1) continue;
    violations.push({
      key: name,
      detail: `${name} declared ${declarations.length}x:\n        ${declarations
        .map(d => `${d.file}:${d.line}${d.exported ? ' [exported]' : ''}`)
        .join('\n        ')}`,
    });
  }

  if (missing.length > 0) {
    fail('R1 single definition', `INVALID — owned export(s) resolved to ZERO declarations (a query returning empty is not proof of absence): ${missing.join(', ')}`);
    return;
  }

  reportAgainstBaseline(
    `R1 every symbol exported from appearance/ or constants/ has exactly one declaration under src/ (${ownedExports.size} owned exports checked)`,
    violations,
    'R1',
  );
}

// ---------------------------------------------------------------------------
// R2 — SINKS MAY NOT INVENT AN IDENTITY COLOUR
//
// `src/appearance/resolveBeamAppearance.ts:70-78` forbids this in prose: "no
// caller may substitute its own rung: that is the 'downstream autonomous
// fallback' the audit identified as the root cause". A rule can enforce what a
// comment only asks for.
//
// Fires OUTSIDE src/appearance/** on a `??`, `||` or ternary where
//   (a) exactly ONE branch is an INVENTED colour — a `#rgb`..`#rrggbbaa` literal,
//       or an identifier/property matching /FALLBACK_COLOU?R/; and
//   (b) the other branch RECEIVES a colour from elsewhere (an identifier,
//       property access, call or index — recursively, through nested ternaries
//       and ??/|| chains); and
//   (c) the slot is colour-typed: the assignment/prop/JSX-attribute target name,
//       or the received branch's text, reads as a colour.
//
// (b) is what separates a SUBSTITUTION from a local palette: `served ? '#77f0c8'
// : '#ff737f'` invents on both sides and replaces nothing, whereas
// `coveringBeam?.satTintColor ?? '#6b7f93'` overrides an absent upstream identity.
//
// DEVIATION FROM THE ORIGINAL PHRASING, recorded deliberately: the rule was first
// specified as "a CALL INTO THE APPEARANCE EXPORT SET on the other side". Measured
// against the tree, that shape matches exactly ONE of the four known violations
// (src/viz/SatelliteMarker.tsx:54). The other three receive the colour as a plain
// property — `coveringBeam?.frequencyColor`, `servingMetric?.color.color`,
// `coneColor` — because the appearance call happened one or more assignments
// earlier. Requiring a syntactic call at the operator would have reported
// 3 of 4 known violations as clean.
// ---------------------------------------------------------------------------

const COLOR_LITERAL = /^#[0-9a-f]{3,8}$/i;
const FALLBACK_IDENTIFIER = /FALLBACK_COLOU?R/i;
const COLOR_SLOT = /colou?r|tint|hue|accent|shade|palette/i;

function inventedColour(expression: ts.Expression): string | null {
  const e = ts.isParenthesizedExpression(expression) ? expression.expression : expression;
  if ((ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && COLOR_LITERAL.test(e.text)) return `'${e.text}'`;
  if (ts.isIdentifier(e) && FALLBACK_IDENTIFIER.test(e.text)) return e.text;
  if (ts.isPropertyAccessExpression(e) && FALLBACK_IDENTIFIER.test(e.name.text)) return e.getText();
  return null;
}

/** Does this expression carry a value produced somewhere else? */
function carriesReceivedValue(expression: ts.Expression): boolean {
  const e = ts.isParenthesizedExpression(expression) ? expression.expression : expression;
  if (ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) {
    return carriesReceivedValue(e.expression);
  }
  if (ts.isConditionalExpression(e)) {
    return carriesReceivedValue(e.whenTrue) || carriesReceivedValue(e.whenFalse);
  }
  if (
    ts.isBinaryExpression(e)
    && (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return carriesReceivedValue(e.left) || carriesReceivedValue(e.right);
  }
  if (ts.isIdentifier(e)) return e.text !== 'undefined';
  return ts.isPropertyAccessExpression(e)
    || ts.isElementAccessExpression(e)
    || ts.isCallExpression(e)
    || ts.isTaggedTemplateExpression(e);
}

/** The named slot the expression flows into — a variable, property, or JSX attribute. */
function slotName(node: ts.Node): string {
  let current: ts.Node | undefined = node;
  while (current !== undefined) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    if (ts.isPropertyAssignment(current) && (ts.isIdentifier(current.name) || ts.isStringLiteral(current.name))) return current.name.text;
    if (ts.isJsxAttribute(current) && ts.isIdentifier(current.name)) return current.name.text;
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken) return current.left.getText();
    current = current.parent;
  }
  return '';
}

function checkSinkColourInvention(): void {
  const violations: Violation[] = [];
  let inspectedFiles = 0;
  let inspectedChoices = 0;

  for (const fullPath of sourceFiles) {
    const file = toRepoPath(fullPath);
    if (isTestPath(file) || file.startsWith('src/appearance/')) continue;
    inspectedFiles += 1;
    const sf = sourceOf(fullPath);
    const visit = (node: ts.Node): void => {
      let left: ts.Expression | null = null;
      let right: ts.Expression | null = null;
      let operator = '';
      if (
        ts.isBinaryExpression(node)
        && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        left = node.left;
        right = node.right;
        operator = node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ? '??' : '||';
      } else if (ts.isConditionalExpression(node)) {
        left = node.whenTrue;
        right = node.whenFalse;
        operator = '?:';
      }
      if (left !== null && right !== null) {
        inspectedChoices += 1;
        const inventedLeft = inventedColour(left);
        const inventedRight = inventedColour(right);
        const picked = inventedLeft !== null && inventedRight === null
          ? { invented: inventedLeft, received: right }
          : inventedRight !== null && inventedLeft === null
            ? { invented: inventedRight, received: left }
            : null;
        if (picked !== null && carriesReceivedValue(picked.received)) {
          const slot = slotName(node);
          const receivedText = picked.received.getText(sf).replace(/\s+/g, ' ').slice(0, 80);
          if (COLOR_SLOT.test(slot) || COLOR_SLOT.test(receivedText)) {
            violations.push({
              key: `${file}|${slot || '<expr>'}|${picked.invented}`,
              detail: `${file}:${lineOf(sf, node)} [${operator}] ${slot || '<expr>'} = ${receivedText} <- invented ${picked.invented}`,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }

  if (inspectedFiles === 0 || inspectedChoices === 0) {
    fail('R2 sinks do not invent an identity colour', `INVALID — inspected ${inspectedFiles} file(s) / ${inspectedChoices} choice expression(s). A rule that matched nothing is not a pass.`);
    return;
  }

  reportAgainstBaseline(
    `R2 no sink outside appearance/ substitutes its own colour for a received one (${inspectedChoices} choice expressions in ${inspectedFiles} files)`,
    violations,
    'R2',
  );
}

// ---------------------------------------------------------------------------

if (!PRINT_OBSERVED) console.log('[validate-architecture-boundaries]');
const edges = readImportEdges();
if (edges.length === 0) {
  fail('import edges', 'INVALID — zero import edges parsed from src/. Refusing to report any import rule as green.');
}
for (const rule of IMPORT_RULES) {
  checkImportRule(rule, edges);
}
checkSingleDefinition();
checkSinkColourInvention();

if (PRINT_OBSERVED) {
  console.log(JSON.stringify({ violations: observedAll }, null, 2));
  process.exit(0);
}

console.log('\n---');
console.log(`[validate-architecture-boundaries] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
