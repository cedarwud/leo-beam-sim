#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const srcRoot = path.join(repoRoot, 'src');

let passed = 0;
let failed = 0;

interface ImportEdge {
  readonly source: string;
  readonly specifier: string;
  readonly target: string | null;
}

interface BoundaryRule {
  readonly label: string;
  readonly sourcePrefix: string;
  readonly forbiddenTargetPrefixes: readonly string[];
  readonly allow?: (edge: ImportEdge) => boolean;
}

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed += 1;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
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
  const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  return walkFiles(srcRoot).flatMap(fullPath => {
    const source = toRepoPath(fullPath);
    const text = readFileSync(fullPath, 'utf8');
    const edges: ImportEdge[] = [];
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(text)) !== null) {
      const specifier = match[1];
      edges.push({
        source,
        specifier,
        target: normalizeTarget(source, specifier),
      });
    }
    return edges;
  });
}

function violatesPrefix(target: string | null, prefixes: readonly string[]): boolean {
  return target !== null && prefixes.some(prefix => target === prefix || target.startsWith(`${prefix}/`));
}

function checkRule(rule: BoundaryRule, edges: readonly ImportEdge[]): void {
  const violations = edges.filter(edge => (
    edge.source.startsWith(rule.sourcePrefix)
    && violatesPrefix(edge.target, rule.forbiddenTargetPrefixes)
    && rule.allow?.(edge) !== true
  ));

  if (violations.length === 0) {
    pass(rule.label);
    return;
  }

  fail(
    rule.label,
    violations
      .map(edge => `${edge.source} -> ${edge.specifier}${edge.target ? ` (${edge.target})` : ''}`)
      .join('\n    '),
  );
}

const rules: readonly BoundaryRule[] = [
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
];

console.log('[validate-architecture-boundaries]');
const edges = readImportEdges();
for (const rule of rules) {
  checkRule(rule, edges);
}

console.log('\n---');
console.log(`[validate-architecture-boundaries] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
