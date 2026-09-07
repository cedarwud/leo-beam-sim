/**
 * Counts source-text pins: assertions that read a target file's SOURCE and
 * match a string literal against it.
 *
 * Why AST and not grep: measuring this with regex was wrong three times.
 *   1. `source` / `app` are rebound to other files inside the same validator,
 *      so file-level grep attributes other files' pins to the target;
 *   2. the dominant style is a multi-line `assertContains(\n appSource,\n '…')`
 *      which line-wise regex cannot see;
 *   3. the reader helper is not consistently named (readFileSync / readRepoFile
 *      / readSource / a bare `source()`).
 * Nearest preceding declaration wins, so a rebound name resolves per use site.
 *
 * Occurrence count is the evidence that matters:
 *   0 occurrences, positive assertion -> already red today
 *   >1 occurrences, positive assertion -> provably false-green: the literal
 *      cannot identify the single thing its label names
 *
 * Usage:
 *   node --import tsx/esm scripts/audit/count-source-pins.ts [targetPath]
 *   TARGET=src/scene/MainScene.tsx node --import tsx/esm scripts/audit/count-source-pins.ts
 */
import ts from 'typescript';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

const TARGET = process.argv[2] || process.env.TARGET || 'src/App.tsx';
const BASE = TARGET.split('/').pop()!;
const TRE = new RegExp(BASE.replace(/\./g, '\\.'));
const targetSource = fs.readFileSync(TARGET, 'utf8');

const files = execSync(`grep -rlF ${JSON.stringify(BASE)} scripts/ | grep '^scripts/validate-' || true`)
  .toString().trim().split('\n').filter(Boolean);

export interface Pin {
  file: string; line: number; literal: string; occurrences: number; negated: boolean;
}
const pins: Pin[] = [];
const perFile: { file: string; literal: number; nonLiteral: number }[] = [];

/**
 * A pin is negative whether it is written as `!src.includes(x)`, as
 * `assertNotContains(src, x)`, or as `assert.equal(src.includes(x), false, …)`.
 * Missing the third form reads a PASSING guard as a positive pin with zero
 * occurrences -- i.e. as "already red" -- and that misreading cost three real
 * negative guards before it was caught.
 */
function isNegated(call: ts.CallExpression): boolean {
  const p = call.parent;
  if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) return true;
  // `x.includes(y) === false` / `!== true`
  if (ts.isBinaryExpression(p)) {
    const other = p.left === call ? p.right : p.left;
    const k = p.operatorToken.kind;
    const isEq = k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.EqualsEqualsToken;
    const isNe = k === ts.SyntaxKind.ExclamationEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken;
    if (isEq && other.kind === ts.SyntaxKind.FalseKeyword) return true;
    if (isNe && other.kind === ts.SyntaxKind.TrueKeyword) return true;
  }
  // `assert.equal(x.includes(y), false, …)` / `assert.notEqual(…, true, …)`
  if (ts.isCallExpression(p) && p.arguments[0] === call) {
    const fn = p.expression.getText();
    const expected = p.arguments[1];
    if (!expected) return false;
    if (/\b(equal|strictEqual|deepEqual|is)$/i.test(fn) && expected.kind === ts.SyntaxKind.FalseKeyword) return true;
    if (/\bnot(Equal|StrictEqual)$/i.test(fn) && expected.kind === ts.SyntaxKind.TrueKeyword) return true;
  }
  return false;
}

const isPathBuilder = (n: ts.CallExpression) =>
  /^(path\.)?(join|resolve|normalize)$/.test(n.expression.getText());

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const pathVars = new Set<string>();
  const decls: { pos: number; name: string; isTargetSource: boolean }[] = [];

  const collect = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const name = n.name.text;
      const init = n.initializer;
      if (ts.isCallExpression(init) && !isPathBuilder(init)) {
        const args = init.arguments.map(a => a.getText()).join(',');
        const firstArg = init.arguments[0];
        const readsTarget = TRE.test(args)
          || (firstArg !== undefined && ts.isIdentifier(firstArg) && pathVars.has(firstArg.text));
        // Any call carrying a *.ts/tsx path argument is a file read of some file.
        const readsAFile = /['"`][^'"`]*\.(ts|tsx|json|mjs)['"`]/.test(args) || readsTarget;
        if (readsTarget) { decls.push({ pos: n.getStart(sf), name, isTargetSource: true }); pathVars.delete(name); }
        else if (readsAFile) decls.push({ pos: n.getStart(sf), name, isTargetSource: false });
      } else if (TRE.test(init.getText())) {
        pathVars.add(name);                       // holds the path, not the text
      }
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);

  const holdsTarget = (name: string, pos: number): boolean => {
    let hit: boolean | null = null;
    for (const d of decls) if (d.pos <= pos && d.name === name) hit = d.isTargetSource;
    return hit === true;
  };
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const literalOf = (n: ts.Node | undefined): string | null =>
    n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

  let literal = 0, nonLiteral = 0;
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const at = n.getStart(sf);

      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'includes'
          && ts.isIdentifier(callee.expression) && holdsTarget(callee.expression.text, at)) {
        const lit = literalOf(n.arguments[0]);
        if (lit !== null) {
          const negated = isNegated(n);
          pins.push({ file, line: lineOf(n), literal: lit, occurrences: targetSource.split(lit).length - 1, negated });
          literal++;
        } else nonLiteral++;
      }

      if (ts.isIdentifier(callee) && /^assert(Not)?Contains$/.test(callee.text)) {
        const receiver = n.arguments[0];
        if (receiver && ts.isIdentifier(receiver) && holdsTarget(receiver.text, at)) {
          const lit = literalOf(n.arguments[1]);
          if (lit !== null) {
            pins.push({ file, line: lineOf(n), literal: lit, occurrences: targetSource.split(lit).length - 1, negated: callee.text === 'assertNotContains' });
            literal++;
          } else nonLiteral++;
        }
      }

      const usesTarget = decls.some(d => d.isTargetSource && holdsTarget(d.name, at)
        && n.arguments.some(a => new RegExp(`\\b${d.name}\\b`).test(a.getText())));
      if (ts.isPropertyAccessExpression(callee)
          && /^(test|exec|match|search|indexOf|lastIndexOf|split|replace|slice)$/.test(callee.name.text)) {
        if (/^(test|exec)$/.test(callee.name.text)) { if (usesTarget) nonLiteral++; }
        else if (ts.isIdentifier(callee.expression) && holdsTarget(callee.expression.text, at)) nonLiteral++;
      }
      if (ts.isPropertyAccessExpression(callee) && /^(match|doesNotMatch)$/.test(callee.name.text)
          && callee.expression.getText() === 'assert' && usesTarget) nonLiteral++;
      if (ts.isIdentifier(callee) && callee.text === 'countOccurrences' && usesTarget) nonLiteral++;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  perFile.push({ file, literal, nonLiteral });
}

const positive = pins.filter(p => !p.negated);
const negative = pins.filter(p => p.negated);
const alreadyRed = [...positive.filter(p => p.occurrences === 0), ...negative.filter(p => p.occurrences > 0)];
const falseGreen = positive.filter(p => p.occurrences > 1);

console.error(`target ${TARGET}`);
console.error(`validators mentioning it: ${files.length}; asserting on its source: ${perFile.filter(f => f.literal + f.nonLiteral > 0).length}`);
console.error(`literal pins ${pins.length} (positive ${positive.length} / negative ${negative.length}); non-literal ${perFile.reduce((a, f) => a + f.nonLiteral, 0)}`);
console.error(`ALREADY RED ${alreadyRed.length}; PROVABLY FALSE-GREEN ${falseGreen.length}; single-occurrence ${positive.filter(p => p.occurrences === 1).length}`);

for (const p of pins) {
  console.log([p.occurrences, p.negated ? 'NEG' : 'POS', `${p.file}:${p.line}`, JSON.stringify(p.literal)].join('\t'));
}
