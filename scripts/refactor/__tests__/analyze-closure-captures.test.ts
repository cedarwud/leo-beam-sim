import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { analyzeFile } from '../analyze-closure-captures.ts';

const source = `
declare function useState<T>(initial: T): [T, (next: T) => void];
declare function useRef<T>(initial: T): { current: T };

export function Fixture() {
  const [count, setCount] = useState(0);
  const ref = useRef({ value: 0 });
  const read = () => count + 1;
  const write = () => setCount(count + 1);
  const alias = setCount;
  const writeThroughAlias = () => alias(2);
  const mutate = () => ref.current.value++;
  const wait = () => setTimeout(() => undefined, 1);
  return { read, write, writeThroughAlias, mutate, wait };
}
`;

function withFixture(run: (filePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'closure-analysis-'));
  const filePath = join(directory, 'fixture.ts');
  writeFileSync(filePath, source);
  try {
    run(filePath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('counts hook-owned state and refs without reporting owned setters as captures', () => {
  withFixture(filePath => {
    const report = analyzeFile({ filePath, functionName: 'Fixture' });

    assert.equal(report.summary.stateCount, 1);
    assert.equal(report.summary.refCount, 1);
    assert.equal(report.summary.writeCaptures, 0);
    assert.ok(report.summary.ownedWrittenBindings >= 3);
  });
});

test('tracks direct, aliased, and object-mutation write capabilities', () => {
  withFixture(filePath => {
    const direct = analyzeFile({ filePath, functionName: 'write' });
    const alias = analyzeFile({ filePath, functionName: 'writeThroughAlias' });
    const mutation = analyzeFile({ filePath, functionName: 'mutate' });

    assert.equal(direct.captures.find(capture => capture.name === 'setCount')?.classification, 'written');
    assert.equal(alias.captures.find(capture => capture.name === 'alias')?.classification, 'written');
    assert.equal(mutation.captures.find(capture => capture.name === 'ref')?.classification, 'written');
  });
});

test('does not mistake ambient setTimeout for a React-style setter', () => {
  withFixture(filePath => {
    const report = analyzeFile({ filePath, functionName: 'wait' });
    const timer = report.captures.find(capture => capture.name === 'setTimeout');

    assert.ok(timer);
    assert.equal(timer.origin, 'global');
    assert.equal(timer.classification, 'read-only');
    assert.equal(report.summary.writeCaptures, 0);
  });
});
