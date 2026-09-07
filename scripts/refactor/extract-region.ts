/** Conservative AST-aligned region extraction with TypeScript as a rollback net. */
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

import {
  AnalysisContext,
  isFunction,
  isReference,
  isTypeUse,
  parseArgs,
  unwrap,
  walk,
  type Capture,
  type Region,
} from './analyze-closure-captures.ts';

export type ExtractionShape = 'helper' | 'jsx' | 'hook';

export interface ExtractRegionOptions {
  sourceFile: string;
  startLine: number;
  endLine: number;
  targetFile: string;
  symbolName: string;
  shape?: ExtractionShape;
  projectPath?: string;
}

export interface TypecheckResult {
  command: string;
  status: number;
  stdout: string;
  stderr: string;
}

export interface ExtractionResult {
  shape: ExtractionShape;
  sourceFile: string;
  targetFile: string;
  symbolName: string;
  props: string[];
  parameters: string[];
  returns: string[];
  typecheck: TypecheckResult;
}

export interface HookExtractionPlan {
  shape: 'hook';
  sourceFile: string;
  targetFile: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  declarations: Array<{ hook: HookName; bindings: string[]; line: number }>;
  movedStatements: Array<{ line: number; endLine: number; text: string }>;
  parameters: Array<{ name: string; type: string }>;
  returns: Array<{ name: string; type: string; reason: string }>;
  rejectionReasons: Array<{ code: string; reason: string }>;
  ready: boolean;
}

export interface ExtractionDependencies {
  runTypecheck?: (projectPath: string) => TypecheckResult;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly rolledBack = false,
    readonly typecheck?: TypecheckResult,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

interface PlannedExtraction {
  shape: ExtractionShape;
  sourceText: string;
  targetText: string;
  props: string[];
  parameters: string[];
  returns: string[];
  hookPlan?: HookExtractionPlan;
}

type HookName = 'useState' | 'useRef' | 'useMemo' | 'useCallback';
type HookRole = 'state' | 'setter' | 'ref' | 'value';

interface HookBindingSelection {
  id: ts.Identifier;
  symbol: ts.Symbol;
  role: HookRole;
}

interface HookDeclarationSelection {
  statement: ts.VariableStatement;
  declaration: ts.VariableDeclaration;
  call: ts.CallExpression;
  hook: HookName;
  bindings: HookBindingSelection[];
}

interface HelperSelection {
  container: ts.FunctionDeclaration | ts.VariableStatement;
  functionNode: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;
  localName: string;
}

const require = createRequire(import.meta.url);

function defaultTypecheck(projectPath: string): TypecheckResult {
  const tscPath = require.resolve('typescript/bin/tsc');
  const args = [tscPath, '--noEmit', '--pretty', 'false', '--project', projectPath];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (result.error) {
    return {
      command: `${process.execPath} ${args.join(' ')}`,
      status: 1,
      stdout: result.stdout ?? '',
      stderr: `${result.stderr ?? ''}${result.error.message}\n`,
    };
  }
  return {
    command: `${process.execPath} ${args.join(' ')}`,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function typecheckFailure(stage: 'baseline' | 'post-extraction', result: TypecheckResult, rolledBack: boolean): ExtractionError {
  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
  const suffix = output ? `\n${output}` : '';
  return new ExtractionError(
    `${stage} tsc --noEmit failed with exit ${result.status}.${rolledBack ? ' Original source restored and new target removed.' : ' No files were changed.'}${suffix}`,
    stage === 'baseline' ? 'BASELINE_TSC_FAILED' : 'POST_TSC_FAILED',
    rolledBack,
    result,
  );
}

function importSpecifier(fromFile: string, toFile: string): string {
  let specifier = relative(dirname(fromFile), toFile).replaceAll('\\', '/').replace(/\.(?:tsx?|jsx?)$/, '');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier;
}

function isIdentifierText(value: string): boolean {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, value);
  return scanner.scan() === ts.SyntaxKind.Identifier
    && scanner.getTokenText() === value
    && scanner.scan() === ts.SyntaxKind.EndOfFileToken;
}

function rebaseModuleSpecifier(specifier: string, sourceFile: string, targetFile: string): string {
  if (!specifier.startsWith('.')) return specifier;
  const absoluteModule = resolve(dirname(sourceFile), specifier);
  let rebased = relative(dirname(targetFile), absoluteModule).replaceAll('\\', '/');
  if (!rebased.startsWith('.')) rebased = `./${rebased}`;
  return rebased;
}

function scriptKindForFileName(fileName: string): ts.ScriptKind {
  switch (extname(fileName).toLowerCase()) {
    case '.js':
    case '.cjs':
    case '.mjs':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.json':
      return ts.ScriptKind.JSON;
    case '.ts':
    case '.cts':
    case '.mts':
    default:
      return ts.ScriptKind.TS;
  }
}

type TargetImportKind = 'default' | 'named' | 'namespace';

interface TargetImportRequirement {
  moduleSpecifier: string;
  importedName: string;
  localName: string;
  kind: TargetImportKind;
  typeOnly: boolean;
  order: number;
}

function targetImportKey(requirement: TargetImportRequirement): string {
  return [requirement.moduleSpecifier, requirement.kind, requirement.importedName, requirement.localName].join('\0');
}

function addTargetImport(
  requirements: Map<string, TargetImportRequirement>,
  requirement: TargetImportRequirement,
): void {
  const key = targetImportKey(requirement);
  const existing = requirements.get(key);
  if (!existing) {
    requirements.set(key, requirement);
    return;
  }
  existing.typeOnly = existing.typeOnly && requirement.typeOnly;
  existing.order = Math.min(existing.order, requirement.order);
}

function targetImportForSymbol(
  symbol: ts.Symbol,
  sourceFile: string,
  targetFile: string,
  forceTypeOnly = false,
): TargetImportRequirement | undefined {
  const binding = symbol.declarations?.find(declaration =>
    ts.isImportSpecifier(declaration) || ts.isImportClause(declaration) || ts.isNamespaceImport(declaration),
  );
  if (!binding) return undefined;
  const declaration = nearestImport(binding);
  if (!declaration || !ts.isStringLiteral(declaration.moduleSpecifier)) return undefined;
  const clause = declaration.importClause;
  const moduleSpecifier = rebaseModuleSpecifier(declaration.moduleSpecifier.text, sourceFile, targetFile);
  if (ts.isImportSpecifier(binding)) {
    return {
      moduleSpecifier,
      importedName: (binding.propertyName ?? binding.name).text,
      localName: binding.name.text,
      kind: 'named',
      typeOnly: forceTypeOnly || Boolean(binding.isTypeOnly || clause?.isTypeOnly),
      order: binding.getStart(),
    };
  }
  if (ts.isImportClause(binding) && binding.name) {
    return {
      moduleSpecifier,
      importedName: 'default',
      localName: binding.name.text,
      kind: 'default',
      typeOnly: forceTypeOnly || binding.isTypeOnly,
      order: binding.getStart(),
    };
  }
  if (ts.isNamespaceImport(binding)) {
    return {
      moduleSpecifier,
      importedName: '*',
      localName: binding.name.text,
      kind: 'namespace',
      typeOnly: forceTypeOnly || Boolean(clause?.isTypeOnly),
      order: binding.getStart(),
    };
  }
  return undefined;
}

function sourceImportBindings(
  context: AnalysisContext,
  sourceFile: string,
  targetFile: string,
): Map<string, TargetImportRequirement> {
  const bindings = new Map<string, TargetImportRequirement>();
  for (const statement of context.sourceFile.statements.filter(ts.isImportDeclaration)) {
    const clause = statement.importClause;
    if (!clause) continue;
    const identifiers: ts.Identifier[] = [];
    if (clause.name) identifiers.push(clause.name);
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) identifiers.push(clause.namedBindings.name);
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      identifiers.push(...clause.namedBindings.elements.map(element => element.name));
    }
    for (const identifier of identifiers) {
      const symbol = context.symbol(identifier);
      if (!symbol) continue;
      const requirement = targetImportForSymbol(symbol, sourceFile, targetFile);
      if (requirement) bindings.set(requirement.localName, requirement);
    }
  }
  return bindings;
}

function renderTargetImports(requirements: Iterable<TargetImportRequirement>): string {
  const groups = new Map<string, TargetImportRequirement[]>();
  for (const requirement of requirements) {
    const group = groups.get(requirement.moduleSpecifier) ?? [];
    group.push(requirement);
    groups.set(requirement.moduleSpecifier, group);
  }
  return [...groups]
    .sort((left, right) => {
      const leftOrder = Math.min(...left[1].map(requirement => requirement.order));
      const rightOrder = Math.min(...right[1].map(requirement => requirement.order));
      return leftOrder - rightOrder || left[0].localeCompare(right[0]);
    })
    .flatMap(([moduleSpecifier, group]) => {
      const ordered = [...group].sort((left, right) => left.order - right.order || left.localName.localeCompare(right.localName));
      const statements: string[] = [];
      for (const requirement of ordered.filter(entry => entry.kind === 'default')) {
        statements.push(`import${requirement.typeOnly ? ' type' : ''} ${requirement.localName} from '${moduleSpecifier}';`);
      }
      for (const requirement of ordered.filter(entry => entry.kind === 'namespace')) {
        statements.push(`import${requirement.typeOnly ? ' type' : ''} * as ${requirement.localName} from '${moduleSpecifier}';`);
      }
      const named = ordered.filter(entry => entry.kind === 'named');
      if (named.length) {
        const bindings = named.map(requirement => {
          const imported = requirement.importedName === requirement.localName
            ? requirement.localName
            : `${requirement.importedName} as ${requirement.localName}`;
          return `${requirement.typeOnly ? 'type ' : ''}${imported}`;
        });
        statements.push(`import { ${bindings.join(', ')} } from '${moduleSpecifier}';`);
      }
      return statements;
    })
    .join('\n');
}

function importRequirementsForCaptures(
  context: AnalysisContext,
  captures: Capture[],
  sourceFile: string,
  targetFile: string,
): Map<string, TargetImportRequirement> {
  const available = sourceImportBindings(context, sourceFile, targetFile);
  const requirements = new Map<string, TargetImportRequirement>();
  for (const capture of captures.filter(capture => capture.origin === 'import')) {
    const requirement = available.get(capture.name);
    if (!requirement) continue;
    addTargetImport(requirements, { ...requirement, typeOnly: requirement.typeOnly || !capture.runtime });
  }
  return requirements;
}

function importForTarget(
  context: AnalysisContext,
  captures: Capture[],
  sourceFile: string,
  targetFile: string,
): string {
  return renderTargetImports(importRequirementsForCaptures(context, captures, sourceFile, targetFile).values());
}

function insertImport(sourceText: string, sourceFile: ts.SourceFile, importText: string): string {
  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  if (imports.length === 0) return `${importText}\n${sourceText}`;
  const insertion = imports[imports.length - 1].end;
  return `${sourceText.slice(0, insertion)}\n${importText}${sourceText.slice(insertion)}`;
}

function replaceRegion(sourceText: string, region: Region, replacement: string): string {
  return `${sourceText.slice(0, region.start)}${replacement}${sourceText.slice(region.end)}`;
}

function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (isFunction(parent)) return parent;
  }
  return undefined;
}

function formatCaptureList(captures: Capture[]): string {
  return captures.map(capture => {
    const sites = capture.writes.map(write => `${write.kind}@${write.line}`).join(', ');
    return `${capture.name}${sites ? ` (${sites})` : ''}`;
  }).join('; ');
}

function assertNoUnsupportedSyntax(node: ts.Node, shape: 'helper' | 'jsx'): void {
  const unsupported: string[] = [];
  walk(node, child => {
    if (child.kind === ts.SyntaxKind.ThisKeyword) unsupported.push('this');
    if (child.kind === ts.SyntaxKind.SuperKeyword) unsupported.push('super');
    if (ts.isIdentifier(child) && child.text === 'arguments') unsupported.push('arguments');
    if (shape === 'helper' && (ts.isAwaitExpression(child) || ts.isYieldExpression(child))) unsupported.push(ts.SyntaxKind[child.kind]);
  });
  if (unsupported.length) {
    throw new ExtractionError(`Region uses unsupported context-bound syntax: ${[...new Set(unsupported)].join(', ')}.`, 'UNSUPPORTED_SYNTAX');
  }
}

function parameterWrites(context: AnalysisContext, node: HelperSelection['functionNode']): string[] {
  const startLine = context.location(node).line;
  const endLine = context.location(node).endLine;
  return context.effects.filter(effect => {
    const declarationIsParameter = effect.symbol.declarations?.some(declaration =>
      ts.isParameter(declaration)
      && declaration.getStart() >= node.getStart()
      && declaration.end <= node.end,
    ) ?? false;
    return declarationIsParameter && effect.site.line >= startLine && effect.site.endLine <= endLine;
  }).map(effect => `${effect.symbol.name} (${effect.site.kind}@${effect.site.line})`);
}

function helperSelection(node: ts.Node | undefined): HelperSelection | undefined {
  if (node && ts.isFunctionDeclaration(node) && node.name) {
    return { container: node, functionNode: node, localName: node.name.text };
  }
  if (!node || !ts.isVariableStatement(node) || !(node.declarationList.flags & ts.NodeFlags.Const) || node.declarationList.declarations.length !== 1) {
    return undefined;
  }
  const declaration = node.declarationList.declarations[0];
  if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return undefined;
  let initializer: ts.Node = declaration.initializer;
  while (ts.isParenthesizedExpression(initializer) || ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer)) initializer = initializer.expression;
  if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) return undefined;
  return { container: node, functionNode: initializer, localName: declaration.name.text };
}

function inlineImportModuleSpecifier(modulePath: string, targetFile: string): string {
  if (!modulePath.startsWith('/')) return modulePath;
  const nodeModulesMarker = '/node_modules/';
  const nodeModulesIndex = modulePath.lastIndexOf(nodeModulesMarker);
  if (nodeModulesIndex >= 0) {
    const packagePath = modulePath.slice(nodeModulesIndex + nodeModulesMarker.length).replace(/\/index$/, '');
    if (!packagePath.startsWith('@types/')) return packagePath;
    const typePackage = packagePath.slice('@types/'.length);
    const [scopeOrName, ...rest] = typePackage.split('/');
    const runtimePackage = scopeOrName.includes('__') ? `@${scopeOrName.replace('__', '/')}` : scopeOrName;
    return [runtimePackage, ...rest].filter(Boolean).join('/');
  }
  let specifier = relative(dirname(targetFile), modulePath).replaceAll('\\', '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier;
}

function rootEntityName(name: ts.EntityName | ts.Expression): string | undefined {
  let current: ts.Node = name;
  while (ts.isQualifiedName(current) || ts.isPropertyAccessExpression(current)) {
    current = ts.isQualifiedName(current) ? current.left : current.expression;
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

function referencedTypeNames(typeText: string): Set<string> {
  const parsed = ts.createSourceFile(
    '__extract_region_type.ts',
    `type __ExtractRegionType = ${typeText};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set<string>();
  walk(parsed, node => {
    if (ts.isTypeReferenceNode(node)) {
      const name = rootEntityName(node.typeName);
      if (name) names.add(name);
    } else if (ts.isTypeQueryNode(node)) {
      const name = rootEntityName(node.exprName);
      if (name) names.add(name);
    } else if (ts.isExpressionWithTypeArguments(node)) {
      const name = rootEntityName(node.expression);
      if (name) names.add(name);
    }
  });
  return names;
}

interface PortableTypeText {
  text: string;
  imports: TargetImportRequirement[];
  unresolvedLocalTypes: string[];
}

function portableTypeText(
  context: AnalysisContext,
  node: ts.Node,
  sourceFile: string,
  targetFile: string,
): PortableTypeText {
  const type = context.checker.getTypeAtLocation(node);
  const baseFlags = ts.TypeFormatFlags.NoTruncation;
  const aliasText = context.checker.typeToString(
    type,
    node,
    baseFlags | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
  );
  const qualifiedText = context.checker.typeToString(
    type,
    node,
    baseFlags | ts.TypeFormatFlags.UseFullyQualifiedType,
  );
  const inlinePattern = /import\((["'])([^"']+)\1\)\.([A-Za-z_$][\w$]*)/g;
  const text = aliasText.replace(inlinePattern, (_whole, _quote: string, _modulePath: string, importedName: string) => importedName);
  const names = referencedTypeNames(text);
  const available = sourceImportBindings(context, sourceFile, targetFile);
  const imports = new Map<string, TargetImportRequirement>();

  for (const name of names) {
    const direct = available.get(name);
    if (direct) addTargetImport(imports, { ...direct, typeOnly: true });
  }

  for (const candidate of [qualifiedText, aliasText]) {
    for (const match of candidate.matchAll(inlinePattern)) {
      const moduleSpecifier = inlineImportModuleSpecifier(match[2], targetFile);
      const importedName = match[3];
      const direct = [...available.values()].find(requirement =>
        requirement.kind === 'named'
        && requirement.importedName === importedName
        && requirement.moduleSpecifier === moduleSpecifier,
      );
      const requirement: TargetImportRequirement = direct
        ? { ...direct, typeOnly: true }
        : {
            moduleSpecifier,
            importedName,
            localName: importedName,
            kind: 'named',
            typeOnly: true,
            order: Number.MAX_SAFE_INTEGER,
          };
      if (names.has(requirement.localName)) addTargetImport(imports, requirement);
    }
  }

  const importedNames = new Set([...imports.values()].map(requirement => requirement.localName));
  const unresolvedLocalTypes: string[] = [];
  for (const name of names) {
    if (importedNames.has(name)) continue;
    const symbol = context.checker.resolveName(
      name,
      node,
      ts.SymbolFlags.Type | ts.SymbolFlags.Value | ts.SymbolFlags.Namespace,
      false,
    );
    if (symbol?.declarations?.some(declaration =>
      declaration.getSourceFile() === context.sourceFile && !nearestImport(declaration),
    )) {
      unresolvedLocalTypes.push(name);
    }
  }

  return { text, imports: [...imports.values()], unresolvedLocalTypes };
}

function virtualTargetDiagnostics(
  context: AnalysisContext,
  targetFile: string,
  targetText: string,
): ts.Diagnostic[] {
  const options = context.program.getCompilerOptions();
  const canonicalTarget = resolve(targetFile);
  const host = ts.createCompilerHost(options);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const isTarget = (fileName: string): boolean => resolve(fileName) === canonicalTarget;
  host.fileExists = fileName => isTarget(fileName) || originalFileExists(fileName);
  host.readFile = fileName => isTarget(fileName) ? targetText : originalReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (isTarget(fileName)) {
      return ts.createSourceFile(fileName, targetText, languageVersion, true, scriptKindForFileName(fileName));
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const program = ts.createProgram({
    rootNames: [...new Set([...context.program.getRootFileNames(), canonicalTarget])],
    options,
    host,
  });
  const target = program.getSourceFile(canonicalTarget);
  if (!target) return [{
    category: ts.DiagnosticCategory.Error,
    code: 6053,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: `Virtual target was not added to the TypeScript program: ${canonicalTarget}`,
  }];
  return [...program.getSyntacticDiagnostics(target), ...program.getSemanticDiagnostics(target)];
}

function formatTargetDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  if (!diagnostic.file || diagnostic.start === undefined) return `TS${diagnostic.code}: ${message}`;
  const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `TS${diagnostic.code} at ${location.line + 1}:${location.character + 1}: ${message}`;
}
function planHelper(
  context: AnalysisContext,
  region: Region,
  helper: HelperSelection,
  sourceFile: string,
  targetFile: string,
  symbolName: string,
): PlannedExtraction {
  const isTopLevelHelper = helper.container.parent === context.sourceFile;
  if (!enclosingFunction(helper.container) && !isTopLevelHelper) {
    throw new ExtractionError('Helper extraction requires a function declared at module scope or inside a component/function.', 'UNSUPPORTED_SHAPE');
  }
  assertNoUnsupportedSyntax(helper.functionNode, 'helper');
  const report = context.analyze(region);
  const written = report.captures.filter(capture => capture.classification === 'written');
  if (written.length) {
    throw new ExtractionError(`Refusing helper extraction because the region has write captures: ${formatCaptureList(written)}.`, 'WRITE_CAPTURE');
  }
  if (report.hooks.length) {
    throw new ExtractionError(`Refusing helper extraction because it contains hook calls: ${report.hooks.map(hook => `${hook.hook}@${hook.line}`).join(', ')}.`, 'HOOK_BOUNDARY');
  }
  const writesToParameters = parameterWrites(context, helper.functionNode);
  if (writesToParameters.length) {
    throw new ExtractionError(`Refusing helper extraction because a pure helper cannot mutate its parameters: ${[...new Set(writesToParameters)].join(', ')}.`, 'PARAMETER_WRITE');
  }
  const unavailable = report.captures.filter(capture => (
    capture.origin === 'closure'
    || capture.origin === 'module'
    || (capture.origin === 'unresolved' && capture.name !== 'undefined')
  ));
  if (unavailable.length) {
    throw new ExtractionError(`Stateless helper extraction supports only imports and ambient globals; unavailable captures: ${unavailable.map(capture => `${capture.name} (${capture.origin})`).join(', ')}.`, 'UNAVAILABLE_CAPTURE');
  }

  const imports = importForTarget(context, report.captures, sourceFile, targetFile);
  const helperText = helper.container.getText(context.sourceFile);
  const exportText = helper.localName === symbolName
    ? `export { ${helper.localName} };`
    : `export { ${helper.localName} as ${symbolName} };`;
  const targetText = `${imports ? `${imports}\n\n` : ''}${helperText}\n\n${exportText}\n`;
  const localBinding = helper.localName === symbolName ? symbolName : `${symbolName} as ${helper.localName}`;
  const sourceImport = `import { ${localBinding} } from '${importSpecifier(sourceFile, targetFile)}';`;
  const withoutHelper = replaceRegion(context.sourceFile.text, region, '');
  return {
    shape: 'helper',
    sourceText: insertImport(withoutHelper, context.sourceFile, sourceImport),
    targetText,
    props: [],
    parameters: [],
    returns: [],
  };
}

function planJsx(
  context: AnalysisContext,
  region: Region,
  sourceFile: string,
  targetFile: string,
  symbolName: string,
): PlannedExtraction {
  const node = region.node;
  if (!node || !(ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))) {
    throw new ExtractionError('JSX extraction requires one complete JSX element or fragment.', 'UNSUPPORTED_SHAPE');
  }
  if (extname(targetFile).toLowerCase() !== '.tsx') {
    throw new ExtractionError('JSX extraction requires a .tsx target module.', 'UNSUPPORTED_TARGET');
  }
  if (!enclosingFunction(node)) {
    throw new ExtractionError('JSX extraction requires a subtree inside a component/function.', 'UNSUPPORTED_SHAPE');
  }
  assertNoUnsupportedSyntax(node, 'jsx');
  const report = context.analyze(region);
  const written = report.captures.filter(capture => capture.classification === 'written');
  if (written.length) {
    throw new ExtractionError(`Refusing JSX extraction because all captures must be read-only: ${formatCaptureList(written)}.`, 'WRITE_CAPTURE');
  }
  const unresolved = report.captures.filter(capture => capture.origin === 'unresolved');
  if (unresolved.length) {
    throw new ExtractionError(`Refusing JSX extraction because captures are unresolved: ${unresolved.map(capture => capture.name).join(', ')}.`, 'UNRESOLVED_CAPTURE');
  }
  const unavailableTypes = report.captures.filter(capture => !capture.runtime && (capture.origin === 'closure' || capture.origin === 'module'));
  if (unavailableTypes.length) {
    throw new ExtractionError(`Refusing JSX extraction because local type captures cannot be expressed as props: ${unavailableTypes.map(capture => capture.name).join(', ')}.`, 'UNAVAILABLE_TYPE_CAPTURE');
  }
  const propCaptures = report.captures.filter(capture => capture.runtime && (capture.origin === 'closure' || capture.origin === 'module'));
  if (propCaptures.some(capture => !isIdentifierText(capture.name))) {
    throw new ExtractionError('JSX extraction encountered a capture that is not a legal prop identifier.', 'UNSUPPORTED_CAPTURE_NAME');
  }

  const props = propCaptures.map(capture => capture.name);
  const importRequirements = importRequirementsForCaptures(context, report.captures, sourceFile, targetFile);
  const renderedPropTypes = propCaptures.map(capture => {
    const reference = [...context.references]
      .filter(([symbol]) => symbol.name === capture.name)
      .flatMap(([, references]) => references)
      .find(candidate => candidate.getStart() >= region.start && candidate.end <= region.end);
    if (!reference) throw new ExtractionError(`Cannot resolve the prop type source for ${capture.name}.`, 'UNRESOLVED_IMPORT');
    const rendered = portableTypeText(context, reference, sourceFile, targetFile);
    for (const requirement of rendered.imports) addTargetImport(importRequirements, requirement);
    return { name: capture.name, type: rendered.text };
  });
  const imports = renderTargetImports(importRequirements.values());
  const propType = propCaptures.length
    ? `interface ${symbolName}Props {\n${renderedPropTypes.map(prop => `  ${prop.name}: ${prop.type};`).join('\n')}\n}\n\n`
    : '';
  const parameters = propCaptures.length ? `{ ${props.join(', ')} }: ${symbolName}Props` : '';
  const targetText = `${imports ? `${imports}\n\n` : ''}${propType}export function ${symbolName}(${parameters}) {\n  return (\n${node.getText(context.sourceFile)}\n  );\n}\n`;
  const replacement = props.length
    ? `<${symbolName} ${props.map(prop => `${prop}={${prop}}`).join(' ')} />`
    : `<${symbolName} />`;
  const sourceImport = `import { ${symbolName} } from '${importSpecifier(sourceFile, targetFile)}';`;
  const replaced = replaceRegion(context.sourceFile.text, region, replacement);
  return {
    shape: 'jsx',
    sourceText: insertImport(replaced, context.sourceFile, sourceImport),
    targetText,
    props,
    parameters: props,
    returns: [],
  };
}

function bindingIdentifiers(name: ts.BindingName): ts.Identifier[] {
  if (ts.isIdentifier(name)) return [name];
  return name.elements.flatMap(element => ts.isOmittedExpression(element) ? [] : bindingIdentifiers(element.name));
}

function nearestFunction(node: ts.Node): ts.Node | undefined {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (isFunction(current)) return current;
  }
  return undefined;
}

function nearestImport(node: ts.Node | undefined): ts.ImportDeclaration | undefined {
  for (let current = node; current; current = current.parent) {
    if (ts.isImportDeclaration(current)) return current;
  }
  return undefined;
}

function regionStatements(context: AnalysisContext, region: Region): ts.Statement[] {
  if (region.node && ts.isStatement(region.node)) return [region.node];
  const statements: ts.Statement[] = [];
  walk(context.sourceFile, node => {
    if (ts.isStatement(node) && node.getStart() >= region.start && node.end <= region.end) statements.push(node);
  });
  return statements
    .filter(statement => !statements.some(parent => parent !== statement && parent.getStart() <= statement.getStart() && parent.end >= statement.end))
    .sort((left, right) => left.getStart() - right.getStart());
}

function selectHookDeclaration(context: AnalysisContext, statement: ts.Statement): HookDeclarationSelection | undefined {
  if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) return undefined;
  const declaration = statement.declarationList.declarations[0];
  if (!declaration.initializer) return undefined;
  const initializer = unwrap(declaration.initializer);
  if (!ts.isCallExpression(initializer)) return undefined;
  const hook = context.hookName(initializer);
  if (hook !== 'useState' && hook !== 'useRef' && hook !== 'useMemo' && hook !== 'useCallback') return undefined;
  const ids = bindingIdentifiers(declaration.name);
  if (!ids.length) return undefined;
  if ((hook === 'useState' && ids.length !== 2) || (hook !== 'useState' && ids.length !== 1)) {
    throw new ExtractionError(`Unsupported ${hook} binding pattern at line ${context.location(statement).line}.`, 'UNSUPPORTED_HOOK_BINDING');
  }
  const bindings = ids.map((id, index): HookBindingSelection => {
    const symbol = context.symbol(id);
    if (!symbol) throw new ExtractionError(`Cannot resolve hook binding ${id.text}.`, 'UNRESOLVED_HOOK_BINDING');
    const role: HookRole = hook === 'useState' ? (index === 0 ? 'state' : 'setter') : hook === 'useRef' ? 'ref' : 'value';
    return { id, symbol, role };
  });
  return { statement, declaration, call: initializer, hook, bindings };
}

function containsPosition(node: ts.Node, position: number): boolean {
  return node.getStart() <= position && position < node.end;
}

function containsNode(nodes: readonly ts.Node[], node: ts.Node): boolean {
  return nodes.some(candidate => candidate.getStart() <= node.getStart() && candidate.end >= node.end);
}

function dependencySymbols(context: AnalysisContext, node: ts.Node): Set<ts.Symbol> {
  const symbols = new Set<ts.Symbol>();
  walk(node, child => {
    if (!ts.isIdentifier(child) || !isReference(child)) return;
    const symbol = context.symbol(child);
    if (symbol) symbols.add(symbol);
  });
  return symbols;
}

function declarationInitializer(symbol: ts.Symbol): ts.Expression | undefined {
  for (const declaration of symbol.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) return declaration.initializer;
    if (ts.isBindingElement(declaration) && ts.isVariableDeclaration(declaration.parent.parent) && declaration.parent.parent.initializer) {
      return declaration.parent.parent.initializer;
    }
  }
  return undefined;
}

function dependsOnAny(
  context: AnalysisContext,
  symbol: ts.Symbol,
  targets: ReadonlySet<ts.Symbol>,
  owner: ts.Node,
  visited = new Set<ts.Symbol>(),
): boolean {
  if (targets.has(symbol)) return true;
  if (visited.has(symbol)) return false;
  visited.add(symbol);
  const initializer = declarationInitializer(symbol);
  if (!initializer) return false;
  return [...dependencySymbols(context, initializer)].some(dependency => {
    if (targets.has(dependency)) return true;
    const declaration = dependency.declarations?.[0];
    return declaration?.getSourceFile() === context.sourceFile
      && nearestFunction(declaration) === owner
      && dependsOnAny(context, dependency, targets, owner, visited);
  });
}

function hasCycle(graph: ReadonlyMap<ts.Symbol, ReadonlySet<ts.Symbol>>): boolean {
  const active = new Set<ts.Symbol>();
  const complete = new Set<ts.Symbol>();
  const visit = (symbol: ts.Symbol): boolean => {
    if (active.has(symbol)) return true;
    if (complete.has(symbol)) return false;
    active.add(symbol);
    for (const dependency of graph.get(symbol) ?? []) if (visit(dependency)) return true;
    active.delete(symbol);
    complete.add(symbol);
    return false;
  };
  return [...graph.keys()].some(visit);
}

function indent(text: string): string {
  return text.split('\n').map(line => `  ${line}`).join('\n');
}

function editSource(sourceText: string, edits: Array<{ start: number; end: number; text: string }>): string {
  return [...edits].sort((left, right) => right.start - left.start).reduce(
    (text, edit) => `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`,
    sourceText,
  );
}

function buildHookPlan(
  context: AnalysisContext,
  region: Region,
  sourceFile: string,
  targetFile: string,
  symbolName: string,
): PlannedExtraction {
  const statements = regionStatements(context, region);
  const rejectionReasons: HookExtractionPlan['rejectionReasons'] = [];
  const reject = (code: string, reason: string): void => {
    if (!rejectionReasons.some(entry => entry.code === code && entry.reason === reason)) rejectionReasons.push({ code, reason });
  };
  const declarations: HookDeclarationSelection[] = [];
  for (const statement of statements) {
    try {
      const selection = selectHookDeclaration(context, statement);
      if (selection) declarations.push(selection);
    } catch (error) {
      if (error instanceof ExtractionError) reject(error.code, error.message);
      else throw error;
    }
  }
  if (!declarations.length) reject('UNSUPPORTED_SHAPE', 'Hook extraction requires at least one top-level useState/useRef/useMemo/useCallback declaration in the selected range.');

  const owner = declarations[0] ? nearestFunction(declarations[0].statement) : undefined;
  const ownerBody = owner && isFunction(owner) && owner.body && ts.isBlock(owner.body) ? owner.body : undefined;
  if (!ownerBody) {
    reject('HOOK_ORDER', 'Selected hooks must be direct statements in one component or custom-hook body.');
  }
  for (const declaration of declarations) {
    if (nearestFunction(declaration.statement) !== owner || declaration.statement.parent !== ownerBody) {
      reject('HOOK_ORDER', `Hook at line ${context.location(declaration.statement).line} is conditional, nested, or belongs to another function.`);
    }
  }

  const selectedSymbols = new Set(declarations.flatMap(declaration => declaration.bindings.map(binding => binding.symbol)));
  const declarationStatements = new Set<ts.Statement>(declarations.map(declaration => declaration.statement));
  const movedWriteStatements = new Set<ts.Statement>();
  for (const effect of context.effects) {
    if (!selectedSymbols.has(effect.symbol)) continue;
    if (effect.site.via) {
      reject('INDIRECT_WRITE', `Binding ${effect.symbol.name} has an indirectly propagated write at line ${effect.site.line} via ${effect.site.via}; static ownership is not exact.`);
      continue;
    }
    const position = context.sourceFile.getPositionOfLineAndCharacter(effect.site.line - 1, effect.site.column - 1);
    if (position < region.start || position >= region.end) continue;
    const statement = statements.find(candidate => containsPosition(candidate, position));
    if (!statement || declarationStatements.has(statement)) continue;
    if (!ts.isExpressionStatement(statement)) {
      reject('UNSUPPORTED_WRITE_SITE', `Write to ${effect.symbol.name} at line ${effect.site.line} is not a complete top-level expression statement.`);
      continue;
    }
    movedWriteStatements.add(statement);
  }

  const movedNodes: ts.Statement[] = [...declarationStatements, ...movedWriteStatements].sort((left, right) => left.getStart() - right.getStart());
  const selectedCalls = new Set(declarations.map(declaration => declaration.call));
  if (owner) {
    const directHooks = [...context.hookCalls.keys()]
      .filter(call => nearestFunction(call) === owner)
      .sort((left, right) => left.getStart() - right.getStart());
    const selectedIndices = directHooks.map((call, index) => selectedCalls.has(call) ? index : -1).filter(index => index >= 0);
    if (selectedIndices.length && selectedIndices[selectedIndices.length - 1] - selectedIndices[0] + 1 !== selectedIndices.length) {
      reject('HOOK_ORDER', 'Selected hook calls are not contiguous in React hook order; collapsing them would reorder an unselected hook.');
    }
  }

  const internalGraph = new Map<ts.Symbol, Set<ts.Symbol>>();
  for (const declaration of declarations) {
    const dependencies = dependencySymbols(context, declaration.call);
    for (const binding of declaration.bindings) {
      internalGraph.set(binding.symbol, new Set([...dependencies].filter(symbol => selectedSymbols.has(symbol))));
    }
  }
  if (hasCycle(internalGraph)) reject('CYCLIC_DEPENDENCY', 'Selected hook bindings contain a dependency cycle.');

  const externalReferences = new Map<ts.Symbol, ts.Identifier>();
  const importRequirements = new Map<string, TargetImportRequirement>();
  for (const node of movedNodes) {
    walk(node, child => {
      if (!ts.isIdentifier(child) || !isReference(child)) return;
      const symbol = context.symbol(child);
      if (!symbol || selectedSymbols.has(symbol) || containsNode(movedNodes, symbol.declarations?.[0] ?? context.sourceFile)) return;
      const imported = targetImportForSymbol(symbol, sourceFile, targetFile, isTypeUse(child));
      if (imported) addTargetImport(importRequirements, imported);
      else externalReferences.set(symbol, child);
    });
  }

  const parameters: HookExtractionPlan['parameters'] = [];
  for (const [symbol, reference] of externalReferences) {
    const declaration = symbol.declarations?.[0];
    if (!declaration || declaration.getSourceFile() !== context.sourceFile) continue;
    if (nearestFunction(declaration) !== owner) {
      reject('UNAVAILABLE_CAPTURE', `Module-local capture ${symbol.name} is not exported and cannot be moved or passed safely.`);
      continue;
    }
    const renderedType = portableTypeText(context, reference, sourceFile, targetFile);
    for (const requirement of renderedType.imports) addTargetImport(importRequirements, requirement);
    for (const typeName of renderedType.unresolvedLocalTypes) {
      reject('UNRESOLVED_IMPORT', `Required parameter type ${typeName} for ${symbol.name} is module-local and has no importable origin.`);
    }
    parameters.push({ name: symbol.name, type: renderedType.text });
  }
  parameters.sort((left, right) => left.name.localeCompare(right.name));

  const parameterSymbols = new Map(parameters.map(parameter => [parameter.name, [...externalReferences.keys()].find(symbol => symbol.name === parameter.name)!]));
  const earliestDeclaration = declarations.length ? Math.min(...declarations.map(declaration => declaration.statement.getStart())) : region.start;
  for (const [name, symbol] of parameterSymbols) {
    if (owner && dependsOnAny(context, symbol, selectedSymbols, owner)) {
      reject('CYCLIC_DEPENDENCY', `Parameter ${name} depends on a selected hook return, so no legal call site can satisfy both declarations.`);
      continue;
    }
    const declaration = symbol.declarations?.[0];
    if (declaration && declaration.getStart() > earliestDeclaration) {
      reject('HOOK_ORDER', `Parameter ${name} is declared after the first selected hook; moving the custom-hook call would change hook order or use it before declaration.`);
    }
  }

  const returns: HookExtractionPlan['returns'] = [];
  for (const declaration of declarations) {
    for (const binding of declaration.bindings) {
      const references = context.references.get(binding.symbol) ?? [];
      const outside = references.filter(reference => !containsNode(movedNodes, reference));
      const outsideWrites = context.effects.filter(effect => effect.symbol === binding.symbol).filter(effect => {
        const position = context.sourceFile.getPositionOfLineAndCharacter(effect.site.line - 1, effect.site.column - 1);
        return !movedNodes.some(node => containsPosition(node, position));
      });
      if (!outside.length && !outsideWrites.length) continue;
      const reason = outsideWrites.length
        ? `written outside selected range at ${outsideWrites.map(effect => `L${effect.site.line}`).join(', ')}`
        : `used outside selected range at ${outside.map(reference => `L${context.location(reference).line}`).join(', ')}`;
      const renderedType = portableTypeText(context, binding.id, sourceFile, targetFile);
      for (const requirement of renderedType.imports) addTargetImport(importRequirements, requirement);
      for (const typeName of renderedType.unresolvedLocalTypes) {
        reject('UNRESOLVED_IMPORT', `Required return type ${typeName} for ${binding.id.text} is module-local and has no importable origin.`);
      }
      returns.push({ name: binding.id.text, type: renderedType.text, reason });
    }
  }

  const parameterTypeName = `${symbolName[0].toUpperCase()}${symbolName.slice(1)}Parameters`;
  const resultTypeName = `${symbolName[0].toUpperCase()}${symbolName.slice(1)}Result`;
  const parameterType = parameters.length
    ? `export interface ${parameterTypeName} {\n${parameters.map(parameter => `  ${parameter.name}: ${parameter.type};`).join('\n')}\n}\n\n`
    : '';
  const resultType = `export interface ${resultTypeName} {\n${returns.map(binding => `  ${binding.name}: ${binding.type};`).join('\n')}\n}\n\n`;
  const signature = parameters.length
    ? `{ ${parameters.map(parameter => parameter.name).join(', ')} }: ${parameterTypeName}`
    : '';
  const bodyText = movedNodes.map(statement => statement.getText(context.sourceFile)).join('\n');
  const returnText = returns.length ? `\n  return { ${returns.map(binding => binding.name).join(', ')} };` : '';
  const imports = renderTargetImports(importRequirements.values());
  const targetText = `${imports ? `${imports}\n\n` : ''}${parameterType}${resultType}export function ${symbolName}(${signature}): ${resultTypeName} {\n${indent(bodyText)}${returnText}\n}\n`;
  if (rejectionReasons.length === 0) {
    const diagnostics = virtualTargetDiagnostics(context, targetFile, targetText);
    const unresolvedCodes = new Set([2304, 2305, 2307, 2614, 2694, 2724]);
    for (const diagnostic of diagnostics) {
      reject(
        unresolvedCodes.has(diagnostic.code) ? 'UNRESOLVED_IMPORT' : 'TARGET_TYPECHECK',
        `Generated target failed virtual typecheck: ${formatTargetDiagnostic(diagnostic)}`,
      );
    }
  }

  const hookPlan: HookExtractionPlan = {
    shape: 'hook',
    sourceFile,
    targetFile,
    symbolName,
    startLine: context.sourceFile.getLineAndCharacterOfPosition(region.start).line + 1,
    endLine: context.sourceFile.getLineAndCharacterOfPosition(Math.max(region.start, region.end - 1)).line + 1,
    declarations: declarations.map(declaration => ({
      hook: declaration.hook,
      bindings: declaration.bindings.map(binding => binding.id.text),
      line: context.location(declaration.statement).line,
    })),
    movedStatements: movedNodes.map(statement => ({
      line: context.location(statement).line,
      endLine: context.location(statement).endLine,
      text: statement.getText(context.sourceFile).slice(0, 160),
    })),
    parameters,
    returns,
    rejectionReasons,
    ready: rejectionReasons.length === 0,
  };

  if (!hookPlan.ready) {
    return { shape: 'hook', sourceText: context.sourceFile.text, targetText: '', props: [], parameters: parameters.map(parameter => parameter.name), returns: returns.map(binding => binding.name), hookPlan };
  }
  const callArguments = parameters.length ? `{ ${parameters.map(parameter => parameter.name).join(', ')} }` : '';
  const call = returns.length
    ? `const { ${returns.map(binding => binding.name).join(', ')} } = ${symbolName}(${callArguments});`
    : `${symbolName}(${callArguments});`;
  const first = declarations[0].statement;
  const edits = movedNodes.map(statement => ({
    start: statement.getStart(context.sourceFile),
    end: statement.end,
    text: statement === first ? call : '',
  }));
  const edited = editSource(context.sourceFile.text, edits);
  const sourceImport = `import { ${symbolName} } from '${importSpecifier(sourceFile, targetFile)}';`;
  return {
    shape: 'hook',
    sourceText: insertImport(edited, context.sourceFile, sourceImport),
    targetText,
    props: [],
    parameters: parameters.map(parameter => parameter.name),
    returns: returns.map(binding => binding.name),
    hookPlan,
  };
}

export function planHookExtraction(options: ExtractRegionOptions): HookExtractionPlan {
  const sourceFile = resolve(options.sourceFile);
  const targetFile = resolve(options.targetFile);
  if (!existsSync(sourceFile)) throw new ExtractionError(`Source file not found: ${sourceFile}`, 'SOURCE_NOT_FOUND');
  if (!isIdentifierText(options.symbolName)) throw new ExtractionError(`Invalid exported symbol name: ${options.symbolName}`, 'INVALID_SYMBOL');
  const projectPath = options.projectPath ? resolve(options.projectPath) : ts.findConfigFile(dirname(sourceFile), ts.sys.fileExists);
  const context = new AnalysisContext(sourceFile, projectPath);
  let region: Region;
  try {
    region = context.select({ startLine: options.startLine, endLine: options.endLine });
  } catch (error) {
    return {
      shape: 'hook', sourceFile, targetFile, symbolName: options.symbolName,
      startLine: options.startLine, endLine: options.endLine, declarations: [], movedStatements: [], parameters: [], returns: [],
      rejectionReasons: [{ code: 'AST_BOUNDARY', reason: error instanceof Error ? error.message : String(error) }], ready: false,
    };
  }
  return buildHookPlan(context, region, sourceFile, targetFile, options.symbolName).hookPlan!;
}

function createdDirectoriesFor(targetFile: string): string[] {
  const created: string[] = [];
  for (let current = dirname(targetFile); !existsSync(current); current = dirname(current)) created.push(current);
  return created;
}

function cleanCreatedDirectories(createdDirectories: string[]): void {
  for (const directory of createdDirectories) {
    try {
      rmdirSync(directory);
    } catch {
      // Preserve non-empty directories or directories concurrently claimed by another writer.
    }
  }
}

function rollback(sourceFile: string, originalSource: string, targetFile: string, createdDirectories: string[]): void {
  const failures: string[] = [];
  try {
    writeFileSync(sourceFile, originalSource);
  } catch (error) {
    failures.push(`restore source: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    if (existsSync(targetFile)) unlinkSync(targetFile);
  } catch (error) {
    failures.push(`remove target: ${error instanceof Error ? error.message : String(error)}`);
  }
  cleanCreatedDirectories(createdDirectories);
  if (failures.length) {
    throw new ExtractionError(`Automatic rollback was incomplete: ${failures.join('; ')}`, 'ROLLBACK_FAILED');
  }
}

export function extractRegion(options: ExtractRegionOptions, dependencies: ExtractionDependencies = {}): ExtractionResult {
  const sourceFile = resolve(options.sourceFile);
  const targetFile = resolve(options.targetFile);
  if (sourceFile === targetFile) throw new ExtractionError('Source and target files must differ.', 'SAME_FILE');
  if (!existsSync(sourceFile)) throw new ExtractionError(`Source file not found: ${sourceFile}`, 'SOURCE_NOT_FOUND');
  if (existsSync(targetFile)) throw new ExtractionError(`Target already exists; refusing to overwrite: ${targetFile}`, 'TARGET_EXISTS');
  if (!isIdentifierText(options.symbolName)) throw new ExtractionError(`Invalid exported symbol name: ${options.symbolName}`, 'INVALID_SYMBOL');

  const projectPath = options.projectPath
    ? resolve(options.projectPath)
    : ts.findConfigFile(dirname(sourceFile), ts.sys.fileExists);
  if (!projectPath) throw new ExtractionError('No tsconfig.json found; tsc rollback net cannot be established.', 'PROJECT_NOT_FOUND');
  const runTypecheck = dependencies.runTypecheck ?? defaultTypecheck;
  const baseline = runTypecheck(projectPath);
  if (baseline.status !== 0) throw typecheckFailure('baseline', baseline, false);

  const context = new AnalysisContext(sourceFile, projectPath);
  let region: Region;
  try {
    region = context.select({ startLine: options.startLine, endLine: options.endLine });
  } catch (error) {
    throw new ExtractionError(error instanceof Error ? error.message : String(error), 'AST_BOUNDARY');
  }
  const node = region.node;
  const helper = helperSelection(node);
  let plan: PlannedExtraction;
  if (options.shape === 'hook') {
    plan = buildHookPlan(context, region, sourceFile, targetFile, options.symbolName);
    if (!plan.hookPlan?.ready) {
      const reasons = plan.hookPlan?.rejectionReasons ?? [{ code: 'HOOK_PLAN_REJECTED', reason: 'Hook plan was rejected.' }];
      const message = reasons.length === 1
        ? reasons[0].reason
        : reasons.map(reason => `[${reason.code}] ${reason.reason}`).join('\n');
      throw new ExtractionError(message, reasons[0].code);
    }
  } else if (options.shape === 'helper') {
    if (!helper) throw new ExtractionError('Explicit helper extraction requires one complete nested function declaration.', 'UNSUPPORTED_SHAPE');
    plan = planHelper(context, region, helper, sourceFile, targetFile, options.symbolName);
  } else if (options.shape === 'jsx') {
    plan = planJsx(context, region, sourceFile, targetFile, options.symbolName);
  } else {
    plan = helper
      ? planHelper(context, region, helper, sourceFile, targetFile, options.symbolName)
      : planJsx(context, region, sourceFile, targetFile, options.symbolName);
  }

  const originalSource = readFileSync(sourceFile, 'utf8');
  const createdDirectories = createdDirectoriesFor(targetFile);
  let mutationStarted = false;
  try {
    mkdirSync(dirname(targetFile), { recursive: true });
    const targetDescriptor = openSync(targetFile, 'wx');
    mutationStarted = true;
    try {
      writeFileSync(targetDescriptor, plan.targetText);
    } finally {
      closeSync(targetDescriptor);
    }
    writeFileSync(sourceFile, plan.sourceText);
    const post = runTypecheck(projectPath);
    if (post.status !== 0) {
      rollback(sourceFile, originalSource, targetFile, createdDirectories);
      throw typecheckFailure('post-extraction', post, true);
    }
    return {
      shape: plan.shape,
      sourceFile,
      targetFile,
      symbolName: options.symbolName,
      props: plan.props,
      parameters: plan.parameters,
      returns: plan.returns,
      typecheck: post,
    };
  } catch (error) {
    if (mutationStarted && !(error instanceof ExtractionError && (error.rolledBack || error.code === 'ROLLBACK_FAILED'))) {
      rollback(sourceFile, originalSource, targetFile, createdDirectories);
    } else if (!mutationStarted) {
      cleanCreatedDirectories(createdDirectories);
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.file || !args.start || !args.end || !args.target || !args.symbol) {
      throw new Error('Usage: node --import tsx/esm scripts/refactor/extract-region.ts --file path --start N --end N --target path --symbol Name [--shape helper|jsx|hook] [--plan] [--project tsconfig.json]');
    }
    const options: ExtractRegionOptions = {
      sourceFile: args.file,
      startLine: Number(args.start),
      endLine: Number(args.end),
      targetFile: args.target,
      symbolName: args.symbol,
      shape: args.shape as ExtractionShape | undefined,
      projectPath: args.project,
    };
    if (args.plan === 'true' && options.shape !== 'hook') {
      throw new Error('--plan currently requires --shape hook.');
    }
    const result = args.plan === 'true' ? planHookExtraction(options) : extractRegion(options);
    console.log(JSON.stringify(result, null, 2));
    if ('ready' in result && !result.ready) process.exitCode = 2;
  } catch (error) {
    if (error instanceof ExtractionError) {
      console.error(`${error.code}: ${error.message}`);
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  }
}
