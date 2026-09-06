#!/usr/bin/env node
/**
 * validate:unreferenced-components -- a rendered surface must be reachable.
 *
 * A React component that no module imports reaches no user, however green its
 * tests are. This is the same defect class as an orphan test file, seen from
 * the other side, and it is not hypothetical here:
 * `HomepageHandoverComparisonOverlay.tsx` was the only remaining renderer of
 * the homepage's cell-reuse topology and EE-max selection criterion, was
 * imported by nothing, and appeared in exactly two unreviewed "tmp" commits.
 * The producer feeding it stayed correct and 20+ assertions kept proving so,
 * while the information reached nobody for days.
 *
 * Worse variants exist and are ledgered below: components no module imports but
 * that a validator reads as SOURCE TEXT, so a check appears to protect a
 * surface that is never rendered.
 *
 * Detection is by TypeScript AST, not regex: every import, export-from, and
 * dynamic `import()` specifier in src/ and scripts/ is resolved to a file. A
 * component file that no resolved specifier names is unreferenced.
 *
 * The AST matters. A regex prototype of this check reported one extra file,
 * because `scripts/validate-s4-event-index-forecast-label.tsx` imports
 * `SinrOffsetExplainer` with an explicit `.tsx` suffix. That is a real
 * reference -- the script mounts the component through
 * `renderToStaticMarkup` -- so counting it is correct.
 *
 * The line this check draws is IMPORTED vs. READ AS TEXT. A validator that
 * renders a component exercises it. A validator that only does
 * `readRepoFile('src/ui/Something.tsx')` and asserts over the source string
 * does not: it protects a surface nobody mounts, which is the more misleading
 * of the two failures. Those files stay on the list.
 *
 * This is a RATCHET. The pre-existing set is listed in
 * `scripts/fixtures/known-unreferenced-components.json` and may only shrink. A
 * NEW unreferenced component fails immediately; deleting a listed one, or
 * wiring it up, requires removing its line -- which is the moment someone
 * notices the decision is being made.
 *
 * Run: npm run validate:unreferenced-components
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix } from 'node:path';
import ts from 'typescript';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(repoRoot, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const rel = posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const allFiles = [...walk('src'), ...walk('scripts')].sort();

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(join(repoRoot, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Every module specifier this file imports from, however it spells it. */
function moduleSpecifiers(source: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length > 0
      && ts.isStringLiteral(node.arguments[0]!)) {
      specifiers.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

/** Resolve a relative specifier to a repo-relative file, or null. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    posix.join(base, 'index.ts'),
    posix.join(base, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (/\.tsx?$/.test(candidate) && existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

const referenced = new Set<string>();
const sources = new Map<string, ts.SourceFile>();
for (const file of allFiles) {
  const source = parse(file);
  sources.set(file, source);
  for (const specifier of moduleSpecifiers(source)) {
    const resolved = resolveSpecifier(file, specifier);
    if (resolved !== null && resolved !== file) referenced.add(resolved);
  }
}

/** A module that exports something a JSX tree could mount. */
function exportsAComponent(source: ts.SourceFile): boolean {
  const isExported = (node: ts.Node): boolean => (
    ts.canHaveModifiers(node)
    && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
  const capitalised = (name: string): boolean => /^[A-Z]/.test(name);
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)
      && isExported(statement)
      && statement.name !== undefined
      && capitalised(statement.name.text)) return true;
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && capitalised(declaration.name.text)
          && declaration.initializer !== undefined
          && (ts.isArrowFunction(declaration.initializer)
            || ts.isFunctionExpression(declaration.initializer)
            || ts.isCallExpression(declaration.initializer))) return true;
      }
    }
  }
  return false;
}

const componentFiles = allFiles.filter(file => (
  file.startsWith('src/')
  && file.endsWith('.tsx')
  && !/\.test\.tsx?$/.test(file)
  && exportsAComponent(sources.get(file)!)
));

const unreferenced = componentFiles.filter(file => !referenced.has(file)).sort();

const knownPath = join(repoRoot, 'scripts/fixtures/known-unreferenced-components.json');
const known: string[] = JSON.parse(readFileSync(knownPath, 'utf8'));

console.log(`component modules scanned: ${componentFiles.length}`);
console.log(`unreferenced: ${unreferenced.length} (known ${known.length})`);

const added = unreferenced.filter(file => !known.includes(file));
const resolvedSince = known.filter(file => !unreferenced.includes(file));

let failed = false;
for (const file of added) {
  console.error(
    `FAIL: ${file} exports a component that no module imports. It renders for nobody, `
    + 'so any test over it proves nothing a user can see. Wire it up, or delete it.',
  );
  failed = true;
}
if (resolvedSince.length > 0) {
  console.error(
    `FAIL: ${resolvedSince.length} entr(y/ies) in known-unreferenced-components.json are no longer `
    + `unreferenced -- wired up or deleted. Remove them; the list is a ratchet and may only shrink:\n  `
    + resolvedSince.join('\n  '),
  );
  failed = true;
}

if (failed) {
  console.error('RED: the unreferenced-component ratchet moved in the wrong direction.');
  process.exit(1);
}
console.log('GREEN: no new unreferenced components.');
