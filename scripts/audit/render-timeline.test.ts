import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const REPO = new URL('../../', import.meta.url);

test('render timeline reports the accepted comparison-plan rung', () => {
  const output = execFileSync(
    'npm',
    ['run', 'audit:render-timeline', '--', '--at', '74'],
    { cwd: REPO, encoding: 'utf8' },
  );
  assert.match(output, /rung=0-plan/);
});

test('render timeline reports accepted-snapshot and deterministic fallbacks', () => {
  const output = execFileSync(
    'npm',
    ['run', 'audit:render-timeline', '--', '--surface', 'scene', '--at', '74'],
    { cwd: REPO, encoding: 'utf8' },
  );
  assert.match(output, /rung=2-accepted/);
  assert.match(output, /rung=3-deterministic/);
  assert.match(output, /eeNorm=-/);
});
