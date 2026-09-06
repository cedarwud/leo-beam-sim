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

const sources = new Map<string, ts.SourceFile>();
const text = new Map<string, string>();
for (const file of allFiles) {
  sources.set(file, parse(file));
  text.set(file, readFileSync(join(repoRoot, file), 'utf8'));
}

/**
 * Whether some non-test module MOUNTS one of this file's components in JSX.
 *
 * This used to ask a weaker question -- whether any module imported the file --
 * and the commit that added it said so: "this proves a component is IMPORTED,
 * not that it is rendered on any route a user reaches". A cross-family review
 * then walked straight into the case that limit was written about.
 * `SatelliteBeams.tsx` says in its own header that it is NOT MOUNTED ON ANY
 * LANE and that its dead mount "made MainScene falsely point here as if this
 * were the live renderer -- the 改波束改不對 / edit the wrong file trap". It is
 * imported, so the old check was blind to it.
 *
 * Measured before switching: every file the import-based check listed is also
 * listed by this one -- 0 lost -- so this is a strictly stronger question, not
 * a different one. 16 became 21.
 *
 * Mounted BY a validation fixture still counts as mounted. Excluding
 * `src/validation/` was measured too and caught exactly one more file, not the
 * one that motivated the idea, so the extra rule bought nothing.
 */
function mountedTagNames(source: ts.SourceFile): Set<string> {
  const tags = new Set<string>();
  const nameOf = (node: ts.JsxTagNameExpression): string | null => (
    ts.isIdentifier(node) ? node.text : null
  );
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = nameOf(node.tagName);
      if (name !== null) tags.add(name);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return tags;
}

/**
 * Every component name actually mounted by a production module in `src/`.
 *
 * Built from the AST, not by matching `<Name`, and both details were forced by
 * measurement rather than chosen:
 *
 *  - Text matching counted a JSX MENTION INSIDE A COMMENT as a mount.
 *    `MainScene.tsx` documents the retired steered renderer as
 *    `{-* ... <SatelliteBeams> ... *-}`, so the one component whose own header
 *    says "NOT MOUNTED IN-APP ON ANY LANE" and warns about the
 *    "改波束改不對 / edit the wrong file" trap went undetected.
 *  - It also counted `source.includes('<LaneExperienceBar />')` inside a
 *    source-text validator, which is the assert-on-the-text-of-an-unmounted-
 *    surface pathology this ratchet exists to name.
 *
 * `scripts/` is excluded: a validator that genuinely renders a component still
 * reaches no user. That reclassified `SinrOffsetExplainer`, which an earlier
 * version of this file called referenced for exactly that reason.
 */
/**
 * Does a mount in this file put the component in front of a user?
 *
 * `scripts/` does not: a validator that genuinely renders a component still
 * reaches nobody. Neither does `src/validation/`, which holds the vc-family
 * render fixtures -- and that exclusion is the one that catches the case this
 * upgrade was written for. `SatelliteBeams.tsx` says in its own header that it
 * is NOT MOUNTED IN-APP ON ANY LANE, survives "ONLY as the render subject of
 * the vc1c/vc2 validation fixtures", and that its dead mount made MainScene
 * falsely point at it -- the "改波束改不對 / edit the wrong file" trap. Counting
 * its fixture as a mount hid the clearest decoy in the tree.
 *
 * Measured: excluding `src/validation/` adds exactly SatelliteBeams.tsx and
 * EarthFixedCells.tsx, so this is a targeted rule, not a net widened until
 * something fell in.
 */
function isProductionMounter(file: string): boolean {
  return file.startsWith('src/')
    && !file.startsWith('src/validation/')
    && !/\.test\.tsx?$/.test(file);
}

const mountedInProduction = new Set<string>();
for (const [file, source] of sources) {
  if (!isProductionMounter(file)) continue;
  for (const tag of mountedTagNames(source)) mountedInProduction.add(tag);
}

function isMountedSomewhere(file: string, componentNames: readonly string[]): boolean {
  // A file mounting only its own exports is not mounted by anything else.
  const ownTags = mountedTagNames(sources.get(file)!);
  return componentNames.some(name => {
    if (!mountedInProduction.has(name)) return false;
    for (const [other, source] of sources) {
      if (other === file || !isProductionMounter(other)) continue;
      if (mountedTagNames(source).has(name)) return true;
    }
    void ownTags;
    return false;
  });
}

/** A module that exports something a JSX tree could mount. */
function exportedComponentNames(source: ts.SourceFile): string[] {
  const names: string[] = [];
  const isExported = (node: ts.Node): boolean => (
    ts.canHaveModifiers(node)
    && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
  const capitalised = (name: string): boolean => /^[A-Z]/.test(name);
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)
      && isExported(statement)
      && statement.name !== undefined
      && capitalised(statement.name.text)) names.push(statement.name.text);
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && capitalised(declaration.name.text)
          && declaration.initializer !== undefined
          && (ts.isArrowFunction(declaration.initializer)
            || ts.isFunctionExpression(declaration.initializer)
            || ts.isCallExpression(declaration.initializer))) names.push(declaration.name.text);
      }
    }
  }
  return names;
}

const componentFiles = allFiles.filter(file => (
  file.startsWith('src/')
  && file.endsWith('.tsx')
  && !/\.test\.tsx?$/.test(file)
  && exportedComponentNames(sources.get(file)!).length > 0
));

const unreferenced = componentFiles
  .filter(file => !isMountedSomewhere(file, exportedComponentNames(sources.get(file)!)))
  .sort();

const knownPath = join(repoRoot, 'scripts/fixtures/known-unreferenced-components.json');
const known: string[] = JSON.parse(readFileSync(knownPath, 'utf8'));

console.log(`component modules scanned: ${componentFiles.length}`);
console.log(`unreferenced: ${unreferenced.length} (known ${known.length})`);
// `LIST_ALL=1` prints the full current set. Kept because comparing a new
// definition of "unmounted" against the frozen list needs the WHOLE set, not
// the FAIL lines -- reading the FAIL lines as the set once produced a confident
// "16 entries lost" that was pure artefact.
if (process.env.LIST_ALL === '1') for (const f of unreferenced) console.log(`  [current] ${f}`);

const added = unreferenced.filter(file => !known.includes(file));
const resolvedSince = known.filter(file => !unreferenced.includes(file));

let failed = false;
for (const file of added) {
  console.error(
    `FAIL: ${file} exports a component that no production module MOUNTS. It renders for `
    + 'nobody, so any test over it proves nothing a user can see, and a search for its name '
    + 'sends an agent to edit a file with no effect on screen. Wire it up, or delete it.',
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
console.log('GREEN: no new unmounted components.');
