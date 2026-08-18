import assert from 'node:assert/strict';

import {
  VISUAL_LAB_COPY,
  visualLabCopy,
  visualLabExperienceCopy,
} from './visualLabCopy';
import {
  resolveVisualLabThemeProfile,
  VISUAL_LAB_THEME_TOKENS,
  type VisualLabSemanticColorKey,
} from './visualLabTheme';

const sections = [
  'shell',
  'source',
  'sceneScale',
  'moduleLabels',
  'resultGroups',
  'timelineTransport',
  'storyControls',
  'figureCapture',
  'unavailable',
  'error',
] as const;

for (const locale of ['zh-Hant', 'en'] as const) {
  const copy = visualLabCopy(locale);
  assert.equal(copy, VISUAL_LAB_COPY[locale]);
  for (const section of sections) {
    assert.ok(Object.keys(copy[section]).length > 0, `${locale}.${section} must not be empty`);
    for (const [key, value] of Object.entries(copy[section])) {
      assert.equal(typeof value, 'string', `${locale}.${section}.${key} must be copy`);
      assert.ok(value.length > 0, `${locale}.${section}.${key} must not be blank`);
    }
  }
}

assert.notEqual(visualLabCopy('zh-Hant').shell.title, visualLabCopy('en').shell.title);
assert.equal(
  visualLabExperienceCopy('en', 'figure').figureCapture.publicationView,
  'Warm-white publication view',
);
assert.equal(
  visualLabExperienceCopy('zh-Hant', 'guided').figureCapture.publicationView,
  '出版用暖白視圖',
);

const colorKeys: readonly VisualLabSemanticColorKey[] = [
  'service',
  'candidate',
  'context',
  'energy',
  'error',
  'background',
  'surface',
  'ink',
  'line',
];
for (const theme of ['dark', 'light'] as const) {
  const tokens = resolveVisualLabThemeProfile(theme);
  assert.equal(tokens, VISUAL_LAB_THEME_TOKENS[theme]);
  for (const key of colorKeys) {
    assert.match(tokens.colors[key], /^#[0-9a-f]{6}$/i, `${theme}.${key} must be a hex color`);
  }
}

const lightProfileTokens = resolveVisualLabThemeProfile({ theme: 'light' });
assert.equal(lightProfileTokens.surfaceMode, 'warm-light');
assert.equal(lightProfileTokens.colors.background, '#f5efe4');
assert.equal(lightProfileTokens.colors.surface, '#fffaf1');
assert.notEqual(lightProfileTokens.colors.ink, VISUAL_LAB_THEME_TOKENS.dark.colors.ink);
assert.equal(resolveVisualLabThemeProfile({ theme: 'dark' }).surfaceMode, 'dark');

console.log('visual-lab copy and theme contract passed');
