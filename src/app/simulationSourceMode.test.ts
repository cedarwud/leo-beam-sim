import assert from 'node:assert/strict';
import {
  DEFAULT_SIMULATION_SOURCE_MODE,
  HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE,
  SIMULATION_SOURCE_MODE_STORAGE_KEY,
  isSimulationSourceMode,
  persistSimulationSourceMode,
  readHomepageSimulationSourceMode,
  readPersistedSimulationSourceMode,
  type SimulationSourceMode,
} from './simulationSourceMode';

interface TestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface TestWindow {
  localStorage: TestStorage;
}

function withWindow<T>(localStorage: TestStorage, callback: () => T): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage } satisfies TestWindow,
  });
  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, 'window', previous);
    }
  }
}

function memoryStorage(initial: Record<string, string> = {}): TestStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

assert.equal(DEFAULT_SIMULATION_SOURCE_MODE, 'walker');
assert.equal(HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE, false);
assert.equal(isSimulationSourceMode('walker'), true);
assert.equal(isSimulationSourceMode('archived-tle'), true);
assert.equal(isSimulationSourceMode('tle'), false);
assert.equal(isSimulationSourceMode(null), false);

// SSR has no window and must use the checked-in Walker default.
assert.equal(readPersistedSimulationSourceMode(), 'walker');

const validStorage = memoryStorage({
  [SIMULATION_SOURCE_MODE_STORAGE_KEY]: 'archived-tle',
});
assert.equal(withWindow(validStorage, readPersistedSimulationSourceMode), 'archived-tle');
assert.equal(
  withWindow(validStorage, readHomepageSimulationSourceMode),
  'walker',
  'the hidden homepage source switch must keep the Walker producer active',
);

const invalidStorage = memoryStorage({
  [SIMULATION_SOURCE_MODE_STORAGE_KEY]: 'not-a-source',
});
assert.equal(withWindow(invalidStorage, readPersistedSimulationSourceMode), 'walker');

const emptyStorage = memoryStorage();
assert.equal(withWindow(emptyStorage, readPersistedSimulationSourceMode), 'walker');

const persistedValues = memoryStorage();
withWindow(persistedValues, () => {
  persistSimulationSourceMode('archived-tle');
  assert.equal(
    persistedValues.getItem(SIMULATION_SOURCE_MODE_STORAGE_KEY),
    'archived-tle',
  );
});

const unavailableStorage: TestStorage = {
  getItem: () => { throw new Error('storage unavailable'); },
  setItem: () => { throw new Error('storage unavailable'); },
};
assert.equal(withWindow(unavailableStorage, readPersistedSimulationSourceMode), 'walker');
assert.doesNotThrow(() => {
  withWindow(unavailableStorage, () => persistSimulationSourceMode('walker'));
});

// Keep the public union exercised by the test itself, so a future expansion
// cannot silently make this fixture's persisted value untyped.
const source: SimulationSourceMode = 'walker';
assert.equal(source, DEFAULT_SIMULATION_SOURCE_MODE);

console.log('Simulation source persistence is SSR-safe and the hidden homepage source gate defaults to Walker.');
