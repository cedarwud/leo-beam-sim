import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveVisualLabDialogKeyAction } from './visualLabDialogKeyAction';

test('Escape closes the dialog even when there are no focusable controls', () => {
  assert.deepEqual(resolveVisualLabDialogKeyAction({
    key: 'Escape',
    shiftKey: false,
    activeIndex: -1,
    focusableCount: 0,
  }), { type: 'close' });
});

test('Tab wraps from either focusable endpoint', () => {
  assert.deepEqual(resolveVisualLabDialogKeyAction({
    key: 'Tab',
    shiftKey: true,
    activeIndex: 0,
    focusableCount: 3,
  }), { type: 'focus', index: 2 });
  assert.deepEqual(resolveVisualLabDialogKeyAction({
    key: 'Tab',
    shiftKey: false,
    activeIndex: 2,
    focusableCount: 3,
  }), { type: 'focus', index: 0 });
});

test('non-boundary and non-Tab keys do not intercept browser focus behavior', () => {
  assert.equal(resolveVisualLabDialogKeyAction({
    key: 'Tab',
    shiftKey: false,
    activeIndex: 1,
    focusableCount: 3,
  }), null);
  assert.equal(resolveVisualLabDialogKeyAction({
    key: 'Enter',
    shiftKey: false,
    activeIndex: 2,
    focusableCount: 3,
  }), null);
  assert.equal(resolveVisualLabDialogKeyAction({
    key: 'Tab',
    shiftKey: false,
    activeIndex: -1,
    focusableCount: 3,
  }), null);
});
