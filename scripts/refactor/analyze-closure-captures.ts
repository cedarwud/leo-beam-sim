/** Symbol-based closure inventory. Scores are triage evidence, never extraction approval. */
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export interface Location { line: number; column: number; endLine: number }
export interface WriteSite extends Location { kind: string; text: string; via?: string }
export interface UseSite extends Location { owner: string; kind: 'value' | 'type' }
export interface Capture {
  name: string; id: string; origin: 'import' | 'module' | 'closure' | 'global' | 'unresolved';
  declaration?: Location; importFrom?: string; type: string; runtime: boolean;
  classification: 'read-only' | 'written'; writes: WriteSite[]; uses: UseSite[];
  hooks: { hook: string; role: string; line: number }[];
}
export interface HookRecord extends Location {
  hook: string; bindings: { name: string; role: string; users: UseSite[] }[];
  owner: string; dependencies: string[];
}
export interface AnalysisReport {
  file: string; sha256: string; region: Location & { name: string; start: number; end: number };
  captures: Capture[]; hooks: HookRecord[];
  ownedWrites: { name: string; writes: WriteSite[] }[];
  summary: { captures: number; readOnlyCaptures: number; writeCaptures: number; imports: number;
    stateCount: number; refCount: number; hookCounts: Record<string, number>; ownedWrittenBindings: number };
  extractability: { score: number; props: number; stateToLift: number; crossesHookBoundary: boolean; reasons: string[] };
  limitations: string[]; candidates?: Candidate[];
}
export interface Candidate { kind: 'helper' | 'jsx'; name: string; startLine: number; endLine: number; score: number;
  props: number; stateToLift: number; writeCaptures: number; crossesHookBoundary: boolean; reasons: string[] }
export interface Selection { functionName?: string; startLine?: number; endLine?: number }
export interface AnalysisOptions extends Selection { filePath: string; projectPath?: string; candidates?: boolean }
export interface Region { node?: ts.Node; start: number; end: number; name: string }
interface HookBinding { hook: string; role: string; call: ts.CallExpression }
interface Effect { symbol: ts.Symbol; site: WriteSite }
const coreHooks = new Set(['useState', 'useRef', 'useMemo', 'useCallback', 'useEffect', 'useLayoutEffect', 'useReducer']);
const mutators = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin', 'set', 'add', 'delete', 'clear']);
export function walk(node: ts.Node, visit: (node: ts.Node) => void): void { visit(node); ts.forEachChild(node, child => walk(child, visit)); }
export function unwrap(node: ts.Node): ts.Node {
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
  return node;
}
export function isFunction(node: ts.Node): node is ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
}
export function functionName(node: ts.Node): string | undefined {
  if (isFunction(node) && node.name) return node.name.getText();
  if (isFunction(node) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
  return undefined;
}
function ownerName(node: ts.Node): string {
  for (let p = node.parent; p; p = p.parent) if (isFunction(p)) return functionName(p) ?? `callback@${p.getSourceFile().getLineAndCharacterOfPosition(p.getStart()).line + 1}`;
  return '<module>';
}
function bindingIds(name: ts.BindingName): ts.Identifier[] {
  if (ts.isIdentifier(name)) return [name];
  return name.elements.flatMap(e => ts.isOmittedExpression(e) ? [] : bindingIds(e.name));
}
export function isTypeUse(node: ts.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isTypeNode(p)) return true;
    if (ts.isExpression(p) || ts.isStatement(p)) return false;
  }
  return false;
}
export function isReference(id: ts.Identifier): boolean {
  const p = id.parent;
  if ((ts.isPropertyAccessExpression(p) && p.name === id) || (ts.isQualifiedName(p) && p.right === id)) return false;
  if (ts.isShorthandPropertyAssignment(p)) return true;
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodSignature(p) || ts.isEnumMember(p)) && p.name === id) return false;
  if (ts.isJsxAttribute(p) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return false;
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || isFunction(p) || ts.isClassDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isTypeParameterDeclaration(p) || ts.isEnumDeclaration(p)) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) return false;
  if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) && p.tagName === id && id.text[0] === id.text[0]?.toLowerCase()) return false;
  return true;
}
export class AnalysisContext {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly sourceFile: ts.SourceFile;
  readonly projectPath?: string;
  readonly hooks = new Map<ts.Symbol, HookBinding[]>();
  readonly hookCalls = new Map<ts.CallExpression, string>();
  readonly aliases = new Map<ts.Symbol, Set<ts.Symbol>>();
  readonly references = new Map<ts.Symbol, ts.Identifier[]>();
  readonly effects: Effect[] = [];
  readonly functionEffects = new Map<ts.Symbol, Effect[]>();
  constructor(filePath: string, projectPath?: string) {
    const file = resolve(filePath);
    this.projectPath = projectPath ? resolve(projectPath) : ts.findConfigFile(dirname(file), ts.sys.fileExists);
    let options: ts.CompilerOptions = { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX, skipLibCheck: true };
    let rootNames = [file];
    if (this.projectPath) {
      const config = ts.readConfigFile(this.projectPath, ts.sys.readFile);
      if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(this.projectPath));
      if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, diagnosticHost));
      options = parsed.options; rootNames = [...new Set([...parsed.fileNames, file])];
    }
    this.program = ts.createProgram(rootNames, options);
    this.checker = this.program.getTypeChecker();
    const sf = this.program.getSourceFile(file);
    if (!sf) throw new Error(`Source file not found: ${file}`);
    this.sourceFile = sf;
    const syntax = this.program.getSyntacticDiagnostics(sf);
    if (syntax.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(syntax, diagnosticHost));
    this.index();
  }
  symbol(id: ts.Identifier): ts.Symbol | undefined {
    return ts.isShorthandPropertyAssignment(id.parent) ? this.checker.getShorthandAssignmentValueSymbol(id.parent) : this.checker.getSymbolAtLocation(id);
  }
  location(node: ts.Node): Location {
    const sf = node.getSourceFile();
    const a = sf.getLineAndCharacterOfPosition(node.getStart());
    return { line: a.line + 1, column: a.character + 1, endLine: sf.getLineAndCharacterOfPosition(Math.max(node.getStart(), node.end - 1)).line + 1 };
  }
  hookName(call: ts.CallExpression): string | undefined {
    const e = unwrap(call.expression);
    let name: string | undefined;
    if (ts.isIdentifier(e)) {
      const symbol = this.symbol(e);
      const spec = symbol?.declarations?.find(ts.isImportSpecifier);
      if (spec) name = (spec.propertyName ?? spec.name).text;
      else name = e.text;
    } else if (ts.isPropertyAccessExpression(e)) name = e.name.text;
    if (!name) return undefined;
    if (coreHooks.has(name) || (name.startsWith('use') && name.length > 3 && name[3] >= 'A' && name[3] <= 'Z')) return name;
    return undefined;
  }
  roots(node: ts.Node): ts.Symbol[] {
    node = unwrap(node);
    if (ts.isIdentifier(node)) { const s = this.symbol(node); return s ? [s] : []; }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return this.roots(node.expression);
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(e => this.roots(e));
    if (ts.isObjectLiteralExpression(node)) return node.properties.flatMap(p => ts.isShorthandPropertyAssignment(p) ? this.roots(p.name) : ts.isPropertyAssignment(p) ? this.roots(p.initializer) : ts.isSpreadAssignment(p) ? this.roots(p.expression) : []);
    if (ts.isSpreadElement(node)) return this.roots(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) return this.roots(node.left);
    return [];
  }
  origins(symbol: ts.Symbol, visited = new Set<ts.Symbol>()): ts.Symbol[] {
    if (visited.has(symbol)) return [];
    visited.add(symbol);
    return [symbol, ...[...(this.aliases.get(symbol) ?? [])].flatMap(s => this.origins(s, visited))];
  }
  hookOrigins(symbol: ts.Symbol): HookBinding[] { return this.origins(symbol).flatMap(s => this.hooks.get(s) ?? []); }
  private index(): void {
    const functions = new Map<ts.Symbol, ts.Node>();
    const addAlias = (left: ts.Node, right: ts.Node) => {
      if (!ts.isIdentifier(unwrap(left))) return;
      for (const s of this.roots(left)) for (const r of this.roots(right)) {
        if (r !== s) { if (!this.aliases.has(s)) this.aliases.set(s, new Set()); this.aliases.get(s)!.add(r); }
      }
    };
    walk(this.sourceFile, node => {
      if (ts.isIdentifier(node) && isReference(node)) {
        const s = this.symbol(node); if (s) { if (!this.references.has(s)) this.references.set(s, []); this.references.get(s)!.push(node); }
      }
      if (ts.isVariableDeclaration(node) && node.initializer) addAlias(node.name, node.initializer);
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) addAlias(node.left, node.right);
      if (ts.isCallExpression(node)) {
        const hook = this.hookName(node);
        if (hook) {
          this.hookCalls.set(node, hook);
          let p: ts.Node = node; while (p.parent && unwrap(p.parent) === node) p = p.parent;
          if (ts.isVariableDeclaration(p.parent) && p.parent.initializer === p) {
            bindingIds(p.parent.name).forEach((id, i) => {
              const s = this.symbol(id); if (!s) return;
              const role = hook === 'useState' || hook === 'useReducer' ? (i === 0 ? 'state' : 'setter') : hook === 'useRef' ? 'ref' : 'value';
              this.hooks.set(s, [{ hook, role, call: node }]);
            });
          }
        }
      }
      if (isFunction(node)) {
        let id: ts.Identifier | undefined;
        if (node.name && ts.isIdentifier(node.name)) id = node.name;
        else if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) id = node.parent.name;
        else if (ts.isCallExpression(node.parent) && ts.isVariableDeclaration(node.parent.parent) && ts.isIdentifier(node.parent.parent.name)) id = node.parent.parent.name;
        const s = id && this.symbol(id); if (s) functions.set(s, node);
      }
    });
    const addEffect = (target: ts.Node, site: ts.Node, kind: string, throughAlias: boolean) => {
      for (const symbol of this.roots(target)) for (const s of throughAlias ? this.origins(symbol) : [symbol]) this.effects.push({ symbol: s, site: { ...this.location(site), kind, text: site.getText().slice(0, 240), ...(s !== symbol ? { via: symbol.name } : {}) } });
    };
    walk(this.sourceFile, node => {
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) addEffect(node.left, node, 'assignment', !ts.isIdentifier(unwrap(node.left)));
      if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) addEffect(node.operand, node, 'update', !ts.isIdentifier(unwrap(node.operand)));
      if (ts.isDeleteExpression(node)) addEffect(node.expression, node, 'delete', true);
      if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && !ts.isVariableDeclarationList(node.initializer)) addEffect(node.initializer, node.initializer, 'loop-assignment', !ts.isIdentifier(unwrap(node.initializer)));
      if (ts.isCallExpression(node)) {
        const expression = unwrap(node.expression);
        if (ts.isIdentifier(expression)) {
          const symbol = this.symbol(expression);
          const setter = symbol && this.hookOrigins(symbol).some(h => h.role === 'setter');
          const declaredInSource = symbol?.declarations?.some(declaration => declaration.getSourceFile() === this.sourceFile) ?? false;
          const namedSetter = declaredInSource && expression.text.startsWith('set') && expression.text.length > 3 && expression.text[3] >= 'A' && expression.text[3] <= 'Z';
          if (setter || namedSetter) addEffect(expression, node, setter ? 'state-setter-call' : 'setter-name-call', true);
        }
        if (ts.isPropertyAccessExpression(expression) && mutators.has(expression.name.text)) addEffect(expression.expression, node, 'mutator-call', true);
      }
    });
    // Propagate known local callback effects to callers. Keep origin sites, not invented writes.
    for (const [s, fn] of functions) this.functionEffects.set(s, this.effects.filter(e => e.site.line >= this.location(fn).line && e.site.endLine <= this.location(fn).endLine && !this.declaredWithin(e.symbol, { start: fn.getStart(), end: fn.end, name: '' })));
    let changed = true;
    while (changed) {
      changed = false;
      for (const [s, fn] of functions) {
        const effects = this.functionEffects.get(s)!;
        walk(fn, node => {
          if (!ts.isCallExpression(node)) return;
          for (const called of this.roots(node.expression).flatMap(r => this.origins(r))) for (const e of this.functionEffects.get(called) ?? []) {
            if (!this.declaredWithin(e.symbol, { start: fn.getStart(), end: fn.end, name: '' }) && !effects.some(x => x.symbol === e.symbol && x.site.line === e.site.line && x.site.column === e.site.column)) { effects.push(e); changed = true; }
          }
        });
      }
    }
  }
  declaredWithin(s: ts.Symbol, region: Region): boolean {
    return (s.declarations ?? []).some(d => d.getSourceFile() === this.sourceFile && d.getStart() >= region.start && d.end <= region.end);
  }
  select(selection: Selection): Region {
    const { functionName: name, startLine, endLine } = selection;
    if (name && startLine === undefined && endLine === undefined) {
      const found: ts.Node[] = []; walk(this.sourceFile, n => { if (isFunction(n) && functionName(n) === name) found.push(n); });
      if (found.length !== 1) throw new Error(`Expected exactly one function named ${name}; found ${found.length}. Use line selection for ambiguity.`);
      return { node: found[0], start: found[0].getStart(), end: found[0].end, name };
    }
    if (name || !Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine! < 1 || endLine! < startLine! || endLine! > this.sourceFile.getLineStarts().length) throw new Error('Provide a functionName OR a valid inclusive startLine/endLine range.');
    const nodes: ts.Node[] = [];
    walk(this.sourceFile, n => { if (n === this.sourceFile) return; const l = this.location(n); if (l.line === startLine && l.endLine === endLine) nodes.push(n); });
    nodes.sort((a,b) => (b.end-b.getStart())-(a.end-a.getStart()));
    if (nodes.length) return { node: nodes[0], start: nodes[0].getStart(), end: nodes[0].end, name: `lines ${startLine}-${endLine}` };
    const start = this.sourceFile.getLineStarts()[startLine! - 1];
    const end = this.sourceFile.getLineStarts()[endLine!] ?? this.sourceFile.end;
    const statements: ts.Statement[] = []; walk(this.sourceFile, n => { if (ts.isStatement(n) && n.getStart() >= start && n.end <= end) statements.push(n); });
    const top = statements.filter(n => !statements.some(p => p !== n && p.getStart() <= n.getStart() && p.end >= n.end));
    if (!top.length || top.some(n => n.parent !== top[0].parent) || this.sourceFile.text.slice(start, top[0].getStart()).trim() || this.sourceFile.text.slice(top[top.length - 1].end, end).trim()) throw new Error('Range must align with a complete AST node or consecutive complete statements; partial boundaries are refused.');
    return { start: top[0].getStart(), end: top[top.length - 1].end, name: `lines ${startLine}-${endLine}` };
  }
  analyze(region: Region): AnalysisReport {
    const inside = (node: ts.Node) => node.getSourceFile() === this.sourceFile && node.getStart() >= region.start && node.end <= region.end;
    const siteInside = (s: WriteSite) => s.line >= this.sourceFile.getLineAndCharacterOfPosition(region.start).line + 1 && s.endLine <= this.sourceFile.getLineAndCharacterOfPosition(region.end - 1).line + 1;
    const captures: Capture[] = [];
    const writesFor = (s: ts.Symbol) => uniqueSites(this.effects.filter(e => e.symbol === s && siteInside(e.site)).map(e => e.site));
    for (const [symbol, refs] of this.references) {
      const uses = refs.filter(inside); if (!uses.length || this.declaredWithin(symbol, region)) continue;
      const decl = symbol.declarations?.[0];
      let imp: ts.ImportDeclaration | undefined;
      for (let p: ts.Node | undefined = decl; p; p = p.parent) if (ts.isImportDeclaration(p)) imp = p;
      const origin: Capture['origin'] = imp ? 'import' : !decl ? 'unresolved' : decl.getSourceFile() !== this.sourceFile ? 'global' : ownerName(decl) === '<module>' ? 'module' : 'closure';
      const hooks = this.hookOrigins(symbol);
      const writes = writesFor(symbol);
      const indirect = this.origins(symbol).flatMap(s => this.functionEffects.get(s) ?? []);
      for (const effect of indirect) writes.push({ ...effect.site, via: symbol.name });
      // Passing a setter/callback is a write capability even when invocation occurs downstream.
      if (!writes.length && hooks.some(h => h.role === 'setter')) writes.push({ ...this.location(uses[0]), kind: 'setter-capability', text: uses[0].getText() });
      captures.push({ name: symbol.name, id: `${symbol.name}@${decl ? this.location(decl).line : '?'}`, origin,
        ...(decl ? { declaration: this.location(decl) } : {}), ...(imp && ts.isStringLiteral(imp.moduleSpecifier) ? { importFrom: imp.moduleSpecifier.text } : {}),
        type: this.checker.typeToString(this.checker.getTypeAtLocation(uses[0]), uses[0], ts.TypeFormatFlags.NoTruncation), runtime: uses.some(u => !isTypeUse(u)),
        classification: writes.length ? 'written' : 'read-only', writes: uniqueSites(writes),
        uses: uses.map(u => ({ ...this.location(u), owner: ownerName(u), kind: isTypeUse(u) ? 'type' : 'value' })),
        hooks: hooks.map(h => ({ hook: h.hook, role: h.role, line: this.location(h.call).line })) });
    }
    const hooks: HookRecord[] = [...this.hookCalls].filter(([call]) => inside(call)).map(([call, hook]) => ({ ...this.location(call), hook, owner: ownerName(call),
      bindings: [...this.hooks].filter(([, origins]) => origins.some(h => h.call === call)).map(([s, origins]) => ({ name: s.name, role: origins[0].role, users: (this.references.get(s) ?? []).map(u => ({ ...this.location(u), owner: ownerName(u), kind: isTypeUse(u) ? 'type' : 'value' })) })),
      dependencies: call.arguments.length > 1 && ts.isArrayLiteralExpression(call.arguments[call.arguments.length - 1]) ? (call.arguments[call.arguments.length - 1] as ts.ArrayLiteralExpression).elements.map(e => e.getText()) : [] }));
    const ownedWrites = [...this.references.keys()].filter(s => this.declaredWithin(s, region)).map(s => ({ name: s.name, writes: writesFor(s) })).filter(e => e.writes.length);
    const runtime = captures.filter(c => c.runtime && c.origin !== 'import' && c.origin !== 'global');
    const stateToLift = new Set(captures.flatMap(c => c.hooks.filter(h => h.role === 'state' || h.role === 'setter').map(h => h.line))).size;
    let enclosesHookCallback = false;
    for (let p = region.node?.parent; p; p = p.parent) if (ts.isCallExpression(p) && this.hookCalls.has(p)) enclosesHookCallback = true;
    const crossesHookBoundary = hooks.length > 0 || enclosesHookCallback;
    const written = captures.filter(c => c.classification === 'written');
    const score = Math.max(0, 100 - runtime.length * 3 - written.length * 20 - stateToLift * 8 - (crossesHookBoundary ? 30 : 0));
    const hookCounts: Record<string, number> = {};
    for (const h of hooks) hookCounts[h.hook] = (hookCounts[h.hook] ?? 0) + 1;
    const reasons = [`${runtime.length} runtime props/parameters (imports and ambient globals excluded).`, `${written.length} captured write capabilities; ${stateToLift} distinct captured state cells require an ownership decision (not a mandatory lift).`, crossesHookBoundary ? 'Contains hook calls or lies inside a hook callback; hook ownership/order must be reviewed.' : 'No hook call boundary crossed.', 'Score = max(0, 100 - 3*props - 20*written captures - 8*captured state cells - 30*hook boundary).'];
    return { file: this.sourceFile.fileName, sha256: createHash('sha256').update(this.sourceFile.text).digest('hex'),
      region: { name: region.name, start: region.start, end: region.end, line: this.sourceFile.getLineAndCharacterOfPosition(region.start).line + 1, column: this.sourceFile.getLineAndCharacterOfPosition(region.start).character + 1, endLine: this.sourceFile.getLineAndCharacterOfPosition(region.end - 1).line + 1 },
      captures, hooks, ownedWrites,
      summary: { captures: captures.length, readOnlyCaptures: captures.length - written.length, writeCaptures: written.length, imports: captures.filter(c => c.origin === 'import').length, stateCount: hooks.filter(h => h.hook === 'useState').length, refCount: hooks.filter(h => h.hook === 'useRef').length, hookCounts, ownedWrittenBindings: ownedWrites.length },
      extractability: { score, props: runtime.length, stateToLift, crossesHookBoundary, reasons },
      limitations: ['Static syntactic writes plus conservative, flow-insensitive local alias/callback propagation; not a purity or interprocedural proof.', 'Unknown imported calls, dynamic dispatch, accessors, custom-hook returns, and external object aliases can hide effects.', 'Hook-like names and setXxx calls are conservative syntactic hints, not proof of React origin.', 'stateToLift counts captured useState/useReducer cells needing an ownership decision; static analysis cannot decide whether any state must actually move.', 'Whole-function captures exclude state declared inside that function; inspect hooks and ownedWrites separately.'] };
  }
  candidates(region: Region, count = 5): Candidate[] {
    const candidates: Candidate[] = [];
    walk(region.node ?? this.sourceFile, node => {
      if (node.getStart() <= region.start || node.end > region.end) return;
      const helper = isFunction(node) && !!functionName(node);
      const jsx = ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
      if (!helper && !jsx) return;
      const loc = this.location(node);
      if (loc.endLine - loc.line + 1 < 3) return;
      const report = this.analyze({ node, start: node.getStart(), end: node.end, name: functionName(node) ?? node.getText().slice(0, 80).split('\n')[0] });
      candidates.push({ kind: helper ? 'helper' : 'jsx', name: report.region.name, startLine: loc.line, endLine: loc.endLine, score: report.extractability.score, props: report.extractability.props, stateToLift: report.extractability.stateToLift, writeCaptures: report.summary.writeCaptures, crossesHookBoundary: report.extractability.crossesHookBoundary, reasons: report.extractability.reasons });
    });
    candidates.sort((a,b) => b.score-a.score || (b.endLine-b.startLine)-(a.endLine-a.startLine) || a.startLine-b.startLine);
    const selected: Candidate[] = [];
    for (const candidate of candidates) if (!selected.some(s => candidate.startLine <= s.endLine && candidate.endLine >= s.startLine)) { selected.push(candidate); if (selected.length >= count) break; }
    return selected;
  }
}
function uniqueSites(sites: WriteSite[]): WriteSite[] { return [...new Map(sites.map(s => [`${s.line}:${s.column}:${s.kind}:${s.via ?? ''}`, s])).values()]; }
export const diagnosticHost: ts.FormatDiagnosticsHost = { getCanonicalFileName: f => f, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n' };
export function analyzeFile(options: AnalysisOptions): AnalysisReport {
  const context = new AnalysisContext(options.filePath, options.projectPath);
  const region = context.select(options);
  const report = context.analyze(region);
  if (options.candidates) report.candidates = context.candidates(region);
  return report;
}
export function parseArgs(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) { const key = args[i]; if (!key.startsWith('--')) throw new Error(`Expected an option, got ${key}`); options[key.slice(2)] = args[i + 1]?.startsWith('--') || !args[i + 1] ? 'true' : args[++i]; }
  return options;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.file) throw new Error('Usage: node --import tsx/esm scripts/refactor/analyze-closure-captures.ts --file path --function name [--candidates] OR --start N --end N [--project tsconfig.json]');
    console.log(JSON.stringify(analyzeFile({ filePath: args.file, functionName: args.function, startLine: args.start ? Number(args.start) : undefined, endLine: args.end ? Number(args.end) : undefined, projectPath: args.project, candidates: args.candidates === 'true' }), null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
