import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { C120ResetDialog, getC120ResetDialogFocusIndex } from './C120ResetDialog';
import { C120LocaleProvider } from './i18n';

const noop = () => undefined;

test('closed reset dialog renders no modal structure', () => {
  assert.equal(renderToStaticMarkup(
    <C120ResetDialog open={false} onCancel={noop} onConfirm={noop} />,
  ), '');
});

test('open reset dialog exposes an accessible Chinese-first labelled confirmation surface', () => {
  const html = renderToStaticMarkup(
    <C120ResetDialog open onCancel={noop} onConfirm={noop} />,
  );

  assert.match(html, /class="c120-dialog-backdrop"/);
  assert.match(html, /data-testid="c120-reset-dialog"/);
  assert.match(html, /<dialog[^>]*role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="c120-reset-title"/);
  assert.match(html, /aria-describedby="c120-reset-description"/);
  assert.match(html, /<h2 id="c120-reset-title">要重設這台裝置上的 C-120 進度嗎？<\/h2>/);
  assert.match(html, /<p id="c120-reset-description">/);
  assert.match(html, /<button[^>]*type="button">取消<\/button>/);
  assert.match(html, /<button[^>]*class="c120-danger"[^>]*type="button">確認重設<\/button>/);
});

test('reset dialog follows the explicit English locale', () => {
  const html = renderToStaticMarkup(
    <C120LocaleProvider initialLocale="en">
      <C120ResetDialog open onCancel={noop} onConfirm={noop} />
    </C120LocaleProvider>,
  );

  assert.match(html, /Reset this local C-120 session\?/);
  assert.match(html, />Cancel<\/button>/);
  assert.match(html, />Confirm reset<\/button>/);
});

test('focus navigation wraps for Tab and Shift-Tab and handles entry', () => {
  assert.equal(getC120ResetDialogFocusIndex(0, 2, false), 1);
  assert.equal(getC120ResetDialogFocusIndex(1, 2, false), 0);
  assert.equal(getC120ResetDialogFocusIndex(0, 2, true), 1);
  assert.equal(getC120ResetDialogFocusIndex(1, 2, true), 0);
  assert.equal(getC120ResetDialogFocusIndex(-1, 2, false), 0);
  assert.equal(getC120ResetDialogFocusIndex(-1, 2, true), 1);
  assert.equal(getC120ResetDialogFocusIndex(0, 0, false), -1);
});

console.log('C-120 reset dialog tests passed');
