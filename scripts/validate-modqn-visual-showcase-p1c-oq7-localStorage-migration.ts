#!/usr/bin/env node
// validate-modqn-visual-showcase-p1c-oq7-localStorage-migration.ts
//
// P1c OQ-7 validator: the legacy `'modqn-replay'` localStorage value is
// migrated to `'decision-overlay-on-live-sinr'` on first read; the migrated
// value is written back to localStorage so subsequent reads see the new key.
//
// Run: node --import tsx/esm scripts/validate-modqn-visual-showcase-p1c-oq7-localStorage-migration.ts

import { strict as assert } from 'node:assert';
import {
  HANDOVER_MODE_STORAGE_KEY,
  readPersistedHandoverMode,
} from '../src/ui/useModqnHandoverState';

console.log('validate-modqn-visual-showcase-p1c-oq7-localStorage-migration');

// Mock localStorage on globalThis. Vite-style scripts run under tsx without
// a DOM; we install a minimal in-memory store so `readPersistedHandoverMode`
// can observe it.
const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  },
};

// (1) Legacy `'modqn-replay'` migrates on read.
store.clear();
store.set(HANDOVER_MODE_STORAGE_KEY, 'modqn-replay');
const migrated = readPersistedHandoverMode();
assert.equal(
  migrated,
  'decision-overlay-on-live-sinr',
  '(1) legacy modqn-replay returns decision-overlay-on-live-sinr',
);
assert.equal(
  store.get(HANDOVER_MODE_STORAGE_KEY),
  'decision-overlay-on-live-sinr',
  '(1) legacy modqn-replay is rewritten to decision-overlay-on-live-sinr in localStorage',
);
console.log('  PASS  legacy modqn-replay migrates to decision-overlay-on-live-sinr (read + rewrite)');

// (2) New `'decision-overlay-on-live-sinr'` is accepted as-is.
store.clear();
store.set(HANDOVER_MODE_STORAGE_KEY, 'decision-overlay-on-live-sinr');
assert.equal(
  readPersistedHandoverMode(),
  'decision-overlay-on-live-sinr',
  '(2) new key accepted unchanged',
);
assert.equal(
  store.get(HANDOVER_MODE_STORAGE_KEY),
  'decision-overlay-on-live-sinr',
  '(2) new key untouched in localStorage',
);
console.log('  PASS  decision-overlay-on-live-sinr accepted unchanged');

// (3) `sinr-offset` is unaffected.
store.clear();
store.set(HANDOVER_MODE_STORAGE_KEY, 'sinr-offset');
assert.equal(readPersistedHandoverMode(), 'sinr-offset', '(3) sinr-offset accepted');
console.log('  PASS  sinr-offset accepted');

// (4) Unknown value falls back to default.
store.clear();
store.set(HANDOVER_MODE_STORAGE_KEY, 'omega-heuristic');
assert.equal(
  readPersistedHandoverMode(),
  'sinr-offset',
  '(4) unknown value (e.g. omega-heuristic) returns default sinr-offset',
);
console.log('  PASS  unknown value falls back to default');

console.log('OK');
