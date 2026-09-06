import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SCENE_TOPOLOGY_OVERRIDES_KEY, applySceneTopology, createSceneTopologyState } from '../sceneTopology';
import { loadProfile } from '../profiles';

/**
 * A persisted beam count must not become the physical satellite layout.
 *
 * `applySceneTopology` writes `servingBeamCount ?? beamCountPerSatellite` into
 * `profile.beams.perSatellite` with no validation, and the homepage publisher
 * falls back to that profile value for its roster budget. So whatever survives
 * `readSceneTopologyOverrides` IS the beam count the user sees. Its two sibling
 * role counts were always checked against [1, 7, 19]; `beamCountPerSatellite`
 * was not, so a stored 2 rendered two beams -- a plausible cause of the
 * reported "I only see a few beams", found by a cross-family review.
 *
 * Measured before the fix, via applySceneTopology on the default profile:
 *   2 -> 2, 3 -> 3, 0 -> 0, -5 -> -5   (baseline perSatellite is 7)
 */
const SUPPORTED = [1, 7, 19] as const;
const UNSUPPORTED = [2, 3, 6, 0, -5, 37, 0.5] as const;

function withStoredTopology<T>(record: unknown, run: () => T): T {
  const store = new Map<string, string>([[SCENE_TOPOLOGY_OVERRIDES_KEY, JSON.stringify(record)]]);
  const previous = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string): string | null => store.get(key) ?? null,
      setItem: (key: string, value: string): void => void store.set(key, value),
    },
    location: { search: '' },
  };
  try {
    return run();
  } finally {
    if (previous === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previous;
  }
}

async function readTopology(record: unknown): Promise<ReturnType<typeof createSceneTopologyState>> {
  const { readSceneTopologyOverrides } = await import('./appPersistence');
  return withStoredTopology(record, () => readSceneTopologyOverrides());
}

test('an unsupported persisted beamCountPerSatellite is rejected, not carried into the profile', async () => {
  const profile = loadProfile('hobs-2024-paper-default');
  assert.equal(profile.beams.perSatellite, 7, 'the default profile is the seven-beam layout');

  for (const count of UNSUPPORTED) {
    const topology = await readTopology({ beamCountPerSatellite: count });
    assert.equal(
      topology.beamCountPerSatellite,
      null,
      `${count} is not a supported beam layout and must not survive persistence`,
    );
    // The point of rejecting it: the profile keeps its own layout.
    assert.equal(
      applySceneTopology(profile, topology).beams.perSatellite,
      7,
      `a stored ${count} must not become the physical beam layout`,
    );
  }
});

test('a supported persisted beamCountPerSatellite still applies', async () => {
  const profile = loadProfile('hobs-2024-paper-default');
  for (const count of SUPPORTED) {
    const topology = await readTopology({ beamCountPerSatellite: count });
    assert.equal(topology.beamCountPerSatellite, count, `${count} is supported and must survive`);
    const applied = applySceneTopology(profile, topology).beams.perSatellite;
    // 1 is the focused-cell count: the physical layout deliberately stays at 7
    // so the model can still evaluate B1..B7 on the focused cell.
    assert.equal(applied, count === 1 ? 7 : count, `${count} must reach the profile as the layout it names`);
  }
});

test('a non-numeric or absent persisted value falls back to no override', async () => {
  for (const value of ['7', null, undefined, {}, [7], true, Number.NaN]) {
    const topology = await readTopology({ beamCountPerSatellite: value });
    assert.equal(topology.beamCountPerSatellite, null, `${String(value)} is not a beam count`);
  }
});

test('rejecting the global count leaves the validated role counts alone', async () => {
  // The fix must not widen into its siblings: a stored serving/candidate count
  // that IS supported has to keep working.
  const topology = await readTopology({
    beamCountPerSatellite: 2,
    servingBeamCount: 19,
    candidateBeamCount: 7,
  });
  assert.equal(topology.beamCountPerSatellite, null);
  assert.equal(topology.servingBeamCount, 19);
  assert.equal(topology.candidateBeamCount, 7);
  // servingBeamCount wins over the rejected global count anyway, but the
  // rejection is what stops the 2 from being the fallback when serving is null.
  assert.equal(
    applySceneTopology(loadProfile('hobs-2024-paper-default'), topology).beams.perSatellite,
    19,
  );
});
