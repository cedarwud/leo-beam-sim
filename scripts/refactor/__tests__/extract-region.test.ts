import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ExtractionError,
  extractRegion,
  planHookExtraction,
  type TypecheckResult,
} from '../extract-region.ts';

interface FixtureProject {
  directory: string;
  projectPath: string;
  sourcePath: string;
}

function createProject(source: string, sourceName = 'source.tsx'): FixtureProject {
  const directory = mkdtempSync(join(tmpdir(), 'extract-region-'));
  const projectPath = join(directory, 'tsconfig.json');
  const sourcePath = join(directory, sourceName);
  writeFileSync(projectPath, JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noEmit: true,
      jsx: 'preserve',
      skipLibCheck: true,
    },
    include: ['*.ts', '*.tsx', 'components/*.ts', 'components/*.tsx'],
  }));
  writeFileSync(join(directory, 'globals.d.ts'), `
declare namespace JSX {
  interface IntrinsicElements {
    [name: string]: Record<string, unknown>;
  }
}
`);
  writeFileSync(sourcePath, source);
  return { directory, projectPath, sourcePath };
}

function linesFor(source: string, startText: string, endText = startText): { startLine: number; endLine: number } {
  const lines = source.split('\n');
  const startLine = lines.findIndex(line => line.includes(startText)) + 1;
  const endLine = lines.findIndex((line, index) => index >= startLine - 1 && line.includes(endText)) + 1;
  assert.ok(startLine > 0, `missing start marker: ${startText}`);
  assert.ok(endLine >= startLine, `missing end marker: ${endText}`);
  return { startLine, endLine };
}

function cleanup(project: FixtureProject): void {
  rmSync(project.directory, { recursive: true, force: true });
}

test('moves a stateless nested helper, preserves its local binding, and passes real tsc', () => {
  const source = `
export function Widget(value: number): number {
  function double(input: number): number { return input * 2; }
  return double(value);
}
`;
  const project = createProject(source, 'source.ts');
  const targetPath = join(project.directory, 'components', 'double.ts');
  try {
    const result = extractRegion({
      ...linesFor(source, 'function double'),
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'DoubleValue',
      projectPath: project.projectPath,
    });

    assert.equal(result.shape, 'helper');
    assert.equal(result.typecheck.status, 0);
    assert.match(readFileSync(project.sourcePath, 'utf8'), /import \{ DoubleValue as double \} from '\.\/components\/double';/);
    assert.match(readFileSync(targetPath, 'utf8'), /export \{ double as DoubleValue \};/);
  } finally {
    cleanup(project);
  }
});

test('moves a stateless top-level helper into a shared module and passes real tsc', () => {
  const source = `
import type { Snapshot } from './snapshot';

function resolveColour(snapshot: Snapshot | null, fallback: string): string {
  return snapshot?.colour ?? fallback;
}

export function Widget(snapshot: Snapshot | null): string {
  return resolveColour(snapshot, 'grey');
}
`;
  const project = createProject(source, 'source.ts');
  writeFileSync(join(project.directory, 'snapshot.ts'), 'export interface Snapshot { colour: string }\n');
  const targetPath = join(project.directory, 'components', 'resolveColour.ts');
  try {
    const result = extractRegion({
      ...linesFor(source, 'function resolveColour', '}'),
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'resolveColour',
      shape: 'helper',
      projectPath: project.projectPath,
    });

    assert.equal(result.typecheck.status, 0);
    assert.match(readFileSync(project.sourcePath, 'utf8'), /import \{ resolveColour \} from '\.\/components\/resolveColour';/);
    assert.match(readFileSync(targetPath, 'utf8'), /import \{ type Snapshot \} from '\.\.\/snapshot';/);
    assert.match(readFileSync(targetPath, 'utf8'), /export \{ resolveColour \};/);
  } finally {
    cleanup(project);
  }
});

test('supports a stateless const arrow helper as the same conservative shape', () => {
  const source = `
export function Widget(value: number): number {
  const double = (input: number): number => input * 2;
  return double(value);
}
`;
  const project = createProject(source, 'source.ts');
  const targetPath = join(project.directory, 'components', 'double.ts');
  try {
    const result = extractRegion({
      ...linesFor(source, 'const double'),
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'DoubleValue',
      projectPath: project.projectPath,
    });

    assert.equal(result.shape, 'helper');
    assert.equal(result.typecheck.status, 0);
    assert.match(readFileSync(targetPath, 'utf8'), /const double =/);
    assert.match(readFileSync(targetPath, 'utf8'), /export \{ double as DoubleValue \};/);
  } finally {
    cleanup(project);
  }
});

test('turns a read-only JSX subtree into a typed presentational component', () => {
  const source = `
import { format } from './format';

export function Card(title: string, count: number) {
  const label = title.toUpperCase();
  return (
    <section className="card">
      <span>{format(label)}</span>
      <span>{count}</span>
    </section>
  );
}
`;
  const project = createProject(source);
  writeFileSync(join(project.directory, 'format.ts'), 'export const format = (value: string): string => `[${value}]`;\n');
  const targetPath = join(project.directory, 'components', 'CardBody.tsx');
  try {
    const result = extractRegion({
      ...linesFor(source, '<section', '</section>'),
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'CardBody',
      projectPath: project.projectPath,
    });

    assert.equal(result.shape, 'jsx');
    assert.deepEqual(result.props, ['label', 'count']);
    assert.equal(result.typecheck.status, 0);
    assert.match(readFileSync(project.sourcePath, 'utf8'), /<CardBody label=\{label\} count=\{count\} \/>/);
    const target = readFileSync(targetPath, 'utf8');
    assert.match(target, /from '\.\.\/format'/);
    assert.match(target, /label: string;/);
    assert.match(target, /count: number;/);
  } finally {
    cleanup(project);
  }
});

test('JSX extraction prunes sibling imports and names a generated prop type import', () => {
  const source = `
import { format, unusedFormat } from './format';
import { type CardModel, type UnusedCardModel } from './card-model';

export function Card(model: CardModel, count: number) {
  return (
    <section className="card">
      <span>{format(model.title)}</span>
      <span>{count}</span>
    </section>
  );
}
`;
  const project = createProject(source);
  writeFileSync(join(project.directory, 'format.ts'), `
export const format = (value: string): string => \`[\${value}]\`;
export const unusedFormat = (value: string): string => value;
`);
  writeFileSync(join(project.directory, 'card-model.ts'), `
export interface CardModel { title: string }
export interface UnusedCardModel { ignored: true }
`);
  const targetPath = join(project.directory, 'components', 'CardBody.tsx');
  try {
    const result = extractRegion({
      ...linesFor(source, '<section', '</section>'),
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'CardBody',
      projectPath: project.projectPath,
    });

    assert.equal(result.typecheck.status, 0);
    const target = readFileSync(targetPath, 'utf8');
    assert.match(target, /import \{ format \} from '\.\.\/format';/);
    assert.match(target, /import \{ type CardModel \} from '\.\.\/card-model';/);
    assert.doesNotMatch(target, /unusedFormat|UnusedCardModel|import\(["']/);
  } finally {
    cleanup(project);
  }
});

test('plans and executes a hook extraction with parameters, returned bindings, and an owned ref write', () => {
  const source = `
import { useCallback, useMemo, useRef, useState } from './hooks';

export function Counter(step: number) {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  countRef.current = count;
  const doubled = useMemo(() => count * step, [count, step]);
  const increment = useCallback(() => setCount(current => current + step), [setCount, step]);
  return { count, setCount, countRef, doubled, increment };
}
`;
  const project = createProject(source);
  writeFileSync(join(project.directory, 'hooks.ts'), `
export declare function useState<T>(initial: T): [T, (next: T | ((current: T) => T)) => void];
export declare function useRef<T>(initial: T): { current: T };
export declare function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
export declare function useCallback<T extends (...args: never[]) => unknown>(callback: T, dependencies: readonly unknown[]): T;
`);
  const targetPath = join(project.directory, 'components', 'useCounterModel.ts');
  const range = linesFor(source, 'const [count', 'const increment');
  try {
    const plan = planHookExtraction({
      ...range,
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'useCounterModel',
      shape: 'hook',
      projectPath: project.projectPath,
    });

    assert.equal(plan.ready, true);
    assert.deepEqual(plan.declarations.map(declaration => declaration.hook), ['useState', 'useRef', 'useMemo', 'useCallback']);
    assert.deepEqual(plan.parameters.map(parameter => parameter.name), ['step']);
    assert.deepEqual(plan.returns.map(binding => binding.name), ['count', 'setCount', 'countRef', 'doubled', 'increment']);
    assert.equal(readFileSync(project.sourcePath, 'utf8'), source);
    assert.equal(existsSync(targetPath), false);

    const result = extractRegion({
      ...range,
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'useCounterModel',
      shape: 'hook',
      projectPath: project.projectPath,
    });

    assert.equal(result.shape, 'hook');
    assert.deepEqual(result.parameters, ['step']);
    assert.deepEqual(result.returns, ['count', 'setCount', 'countRef', 'doubled', 'increment']);
    assert.equal(result.typecheck.status, 0);
    assert.match(readFileSync(project.sourcePath, 'utf8'), /const \{ count, setCount, countRef, doubled, increment \} = useCounterModel\(\{ step \}\);/);
    const target = readFileSync(targetPath, 'utf8');
    assert.match(target, /export interface UseCounterModelResult/);
    assert.match(target, /export function useCounterModel/);
    assert.match(target, /countRef\.current = count;/);
  } finally {
    cleanup(project);
  }
});

test('hook extraction imports only referenced values and named signature types', () => {
  const source = `
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from './hooks';
import { type HandoverRailEvent, type UnusedEventType } from './events';
import { type SceneLane, type UnusedSceneType } from './scene-types';

export function Director(lane: SceneLane) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectEvent = useCallback((event: HandoverRailEvent) => {
    if (event.lane === lane) setSelectedId(event.id);
  }, [lane, setSelectedId]);
  return { selectedId, setSelectedId, selectEvent };
}
`;
  const project = createProject(source);
  writeFileSync(join(project.directory, 'hooks.ts'), `
export type SetStateAction<T> = T | ((current: T) => T);
export type Dispatch<T> = (next: T) => void;
export declare function useState<T>(initial: T): [T, Dispatch<SetStateAction<T>>];
export declare function useRef<T>(initial: T): { current: T };
export declare function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
export declare function useCallback<T extends (...args: never[]) => unknown>(callback: T, dependencies: readonly unknown[]): T;
export declare function useEffect(effect: () => void, dependencies: readonly unknown[]): void;
`);
  writeFileSync(join(project.directory, 'events.ts'), `
import type { SceneLane } from './scene-types';
export interface HandoverRailEvent { id: string; lane: SceneLane }
export interface UnusedEventType { ignored: true }
`);
  writeFileSync(join(project.directory, 'scene-types.ts'), `
export type SceneLane = 'live' | 'replay';
export interface UnusedSceneType { ignored: true }
`);
  const targetPath = join(project.directory, 'components', 'useDirector.ts');
  try {
    const result = extractRegion({
      ...linesFor(source, 'const [selectedId', '}, [lane, setSelectedId]);'),
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'useDirector',
      shape: 'hook',
      projectPath: project.projectPath,
    });

    assert.equal(result.typecheck.status, 0);
    const target = readFileSync(targetPath, 'utf8');
    assert.match(target, /import \{ useCallback, useState, type Dispatch, type SetStateAction \} from '\.\.\/hooks';/);
    assert.match(target, /import \{ type HandoverRailEvent \} from '\.\.\/events';/);
    assert.match(target, /import \{ type SceneLane \} from '\.\.\/scene-types';/);
    assert.doesNotMatch(target, /useEffect|useMemo|useRef|UnusedEventType|UnusedSceneType/);
    assert.doesNotMatch(target, /import\(["']/);
  } finally {
    cleanup(project);
  }
});

test('hook planning rejects a required signature type without an importable origin', () => {
  const source = `
import { useMemo } from './hooks';

interface HiddenLane { id: string }

export function Director(lane: HiddenLane) {
  const selectedId = useMemo(() => lane.id, [lane]);
  return selectedId;
}
`;
  const project = createProject(source);
  writeFileSync(join(project.directory, 'hooks.ts'), 'export declare function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;\n');
  const targetPath = join(project.directory, 'components', 'useDirector.ts');
  try {
    const plan = planHookExtraction({
      ...linesFor(source, 'const selectedId'),
      sourceFile: project.sourcePath,
      targetFile: targetPath,
      symbolName: 'useDirector',
      shape: 'hook',
      projectPath: project.projectPath,
    });

    assert.equal(plan.ready, false);
    assert.ok(plan.rejectionReasons.some(reason => reason.code === 'UNRESOLVED_IMPORT' && /HiddenLane/.test(reason.reason)));
    assert.equal(readFileSync(project.sourcePath, 'utf8'), source);
    assert.equal(existsSync(targetPath), false);
  } finally {
    cleanup(project);
  }
});

test('hook planning rejects an indirect ref write through an alias', () => {
  const source = `
import { useRef } from './hooks';

export function Counter() {
  const countRef = useRef({ value: 0 });
  const alias = countRef;
  alias.current.value += 1;
  return countRef.current.value;
}
`;
  const project = createProject(source);
  writeFileSync(join(project.directory, 'hooks.ts'), 'export declare function useRef<T>(initial: T): { current: T };\n');
  try {
    const plan = planHookExtraction({
      ...linesFor(source, 'const countRef', 'alias.current'),
      sourceFile: project.sourcePath,
      targetFile: join(project.directory, 'components', 'useCounter.ts'),
      symbolName: 'useCounter',
      shape: 'hook',
      projectPath: project.projectPath,
    });
    assert.equal(plan.ready, false);
    assert.ok(plan.rejectionReasons.some(reason => reason.code === 'INDIRECT_WRITE'));
  } finally {
    cleanup(project);
  }
});

test('hook planning rejects dependency cycles and non-contiguous hook order', () => {
  const cyclicSource = `
import { useMemo } from './hooks';
export function Cyclic() {
  const first = useMemo(() => second, [second]);
  const second = useMemo(() => first, [first]);
  return first;
}
`;
  const cyclicProject = createProject(cyclicSource);
  writeFileSync(join(cyclicProject.directory, 'hooks.ts'), 'export declare function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;\n');
  const orderSource = `
import { useEffect, useRef, useState } from './hooks';
export function Ordered() {
  const [count, setCount] = useState(0);
  useEffect(() => setCount(1), []);
  const countRef = useRef(count);
  return countRef;
}
`;
  const orderProject = createProject(orderSource);
  writeFileSync(join(orderProject.directory, 'hooks.ts'), `
export declare function useState<T>(initial: T): [T, (next: T) => void];
export declare function useRef<T>(initial: T): { current: T };
export declare function useEffect(effect: () => void, dependencies: readonly unknown[]): void;
`);
  try {
    const cyclicPlan = planHookExtraction({
      ...linesFor(cyclicSource, 'const first', 'const second'),
      sourceFile: cyclicProject.sourcePath,
      targetFile: join(cyclicProject.directory, 'components', 'useCyclic.ts'),
      symbolName: 'useCyclic',
      shape: 'hook',
      projectPath: cyclicProject.projectPath,
    });
    assert.ok(cyclicPlan.rejectionReasons.some(reason => reason.code === 'CYCLIC_DEPENDENCY'));

    const orderPlan = planHookExtraction({
      ...linesFor(orderSource, 'const [count', 'const countRef'),
      sourceFile: orderProject.sourcePath,
      targetFile: join(orderProject.directory, 'components', 'useOrdered.ts'),
      symbolName: 'useOrdered',
      shape: 'hook',
      projectPath: orderProject.projectPath,
    });
    assert.ok(orderPlan.rejectionReasons.some(reason => reason.code === 'HOOK_ORDER'));
  } finally {
    cleanup(cyclicProject);
    cleanup(orderProject);
  }
});

test('hook planning rejects a range that cuts through an AST node', () => {
  const source = `
import { useMemo } from './hooks';
export function Widget(value: number) {
  const doubled = useMemo(
    () => value * 2,
    [value],
  );
  return doubled;
}
`;
  const project = createProject(source);
  writeFileSync(join(project.directory, 'hooks.ts'), 'export declare function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;\n');
  try {
    const plan = planHookExtraction({
      ...linesFor(source, '() => value', '[value]'),
      sourceFile: project.sourcePath,
      targetFile: join(project.directory, 'components', 'useDoubled.ts'),
      symbolName: 'useDoubled',
      shape: 'hook',
      projectPath: project.projectPath,
    });
    assert.equal(plan.ready, false);
    assert.deepEqual(plan.rejectionReasons.map(reason => reason.code), ['AST_BOUNDARY']);
  } finally {
    cleanup(project);
  }
});

test('refuses JSX that captures a state setter and leaves both paths untouched', () => {
  const source = `
declare function useState<T>(initial: T): [T, (next: T) => void];

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      {count}
    </button>
  );
}
`;
  const project = createProject(source);
  const targetPath = join(project.directory, 'components', 'CounterButton.tsx');
  try {
    assert.throws(
      () => extractRegion({
        ...linesFor(source, '<button', '</button>'),
        sourceFile: project.sourcePath,
        targetFile: targetPath,
        symbolName: 'CounterButton',
        projectPath: project.projectPath,
      }),
      (error: unknown) => error instanceof ExtractionError
        && error.code === 'WRITE_CAPTURE'
        && /setCount/.test(error.message),
    );
    assert.equal(readFileSync(project.sourcePath, 'utf8'), source);
    assert.equal(existsSync(targetPath), false);
  } finally {
    cleanup(project);
  }
});

test('refuses a helper that mutates one of its parameters', () => {
  const source = `
export function Widget(value: { count: number }): number {
  function increment(input: { count: number }): number { input.count++; return input.count; }
  return increment(value);
}
`;
  const project = createProject(source, 'source.ts');
  const targetPath = join(project.directory, 'components', 'increment.ts');
  try {
    assert.throws(
      () => extractRegion({
        ...linesFor(source, 'function increment'),
        sourceFile: project.sourcePath,
        targetFile: targetPath,
        symbolName: 'Increment',
        projectPath: project.projectPath,
      }),
      (error: unknown) => error instanceof ExtractionError
        && error.code === 'PARAMETER_WRITE'
        && /input/.test(error.message),
    );
    assert.equal(readFileSync(project.sourcePath, 'utf8'), source);
    assert.equal(existsSync(targetPath), false);
  } finally {
    cleanup(project);
  }
});

test('uses real post-write tsc failure to trigger byte-exact rollback', () => {
  const source = `
type HiddenValue = { value: string };

export function Secret(value: HiddenValue) {
  return (
    <span>{value.value}</span>
  );
}
`;
  const project = createProject(source);
  const targetPath = join(project.directory, 'components', 'SecretValue.tsx');
  try {
    assert.throws(
      () => extractRegion({
        ...linesFor(source, '<span', '</span>'),
        sourceFile: project.sourcePath,
        targetFile: targetPath,
        symbolName: 'SecretValue',
        projectPath: project.projectPath,
      }),
      (error: unknown) => error instanceof ExtractionError
        && error.code === 'POST_TSC_FAILED'
        && error.rolledBack
        && /HiddenValue/.test(error.message),
    );
    assert.equal(readFileSync(project.sourcePath, 'utf8'), source);
    assert.equal(existsSync(targetPath), false);
  } finally {
    cleanup(project);
  }
});

test('restores the exact source and removes the target when post-write tsc fails', () => {
  const source = `
export function Widget(value: number): number {
  function double(input: number): number { return input * 2; }
  return double(value);
}
`;
  const project = createProject(source, 'source.ts');
  const targetPath = join(project.directory, 'generated', 'nested', 'double.ts');
  let calls = 0;
  const runTypecheck = (): TypecheckResult => {
    calls += 1;
    return calls === 1
      ? { command: 'synthetic tsc --noEmit', status: 0, stdout: '', stderr: '' }
      : { command: 'synthetic tsc --noEmit', status: 2, stdout: 'synthetic type error', stderr: '' };
  };
  try {
    assert.throws(
      () => extractRegion({
        ...linesFor(source, 'function double'),
        sourceFile: project.sourcePath,
        targetFile: targetPath,
        symbolName: 'DoubleValue',
        projectPath: project.projectPath,
      }, { runTypecheck }),
      (error: unknown) => error instanceof ExtractionError
        && error.code === 'POST_TSC_FAILED'
        && error.rolledBack
        && /synthetic type error/.test(error.message),
    );
    assert.equal(calls, 2);
    assert.equal(readFileSync(project.sourcePath, 'utf8'), source);
    assert.equal(existsSync(targetPath), false);
    assert.equal(existsSync(join(project.directory, 'generated')), false);
  } finally {
    cleanup(project);
  }
});
