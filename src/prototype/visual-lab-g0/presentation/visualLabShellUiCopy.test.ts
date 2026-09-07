import assert from 'node:assert/strict';
import test from 'node:test';
import { visualLabShellUiCopy } from './visualLabShellUiCopy';

test('shell copy selects the locale and keeps theme wording explicit', () => {
  const zh = visualLabShellUiCopy('zh-Hant', 'dark');
  const en = visualLabShellUiCopy('en', 'light');

  assert.equal(zh.replayLibrary, '情境回放');
  assert.equal(zh.switchTheme, '切換至淺色主題');
  assert.equal(en.replayLibrary, 'Scenario replay');
  assert.equal(en.switchTheme, 'Switch to dark theme');
});

test('shell copy returns an immutable presentation record', () => {
  const copy = visualLabShellUiCopy('en', 'dark');
  assert.equal(Object.isFrozen(copy), true);
  assert.equal(copy.skipScene, 'Skip to visualization scene');
});
