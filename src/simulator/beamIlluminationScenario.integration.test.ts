import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  buildCanonicalSevenCellScenario,
} from './canonicalSevenCellScenario';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from './analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from './archive';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
} from './types';

const SELECTED_LINK = Object.freeze({
  distanceKm: 550,
  elevationDeg: 45,
});

function scenarioRequest(slotIndex: number, mode: 'fixed' | 'beam-hopping' = 'beam-hopping') {
  return {
    ...DEFAULT_SIMULATOR_PARAMETERS,
    selectedLink: SELECTED_LINK,
    beamLayoutCount: 7 as const,
    beamIllumination: { mode, slotIndex },
  };
}

test('fixed default keeps every complete-ring beam eligible and active', () => {
  const scenario = buildCanonicalSevenCellScenario({
    ...DEFAULT_SIMULATOR_PARAMETERS,
    selectedLink: SELECTED_LINK,
    beamLayoutCount: 7,
  });

  assert.equal(scenario.metadata.beamIllumination.mode, 'fixed');
  assert.deepEqual(scenario.metadata.beamIllumination.eligibleBeamIds, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(scenario.input.frame.beamLoadB, [15, 15, 14, 14, 14, 14, 14]);
  assert.deepEqual(scenario.input.frame.beamActiveB, [true, true, true, true, true, true, true]);
});

test('Beam Hopping exposes four eligible beams, rotates them, and derives inactive beams from zero load', () => {
  const slot0 = buildCanonicalSevenCellScenario(scenarioRequest(0));
  const slot1 = buildCanonicalSevenCellScenario(scenarioRequest(1));
  const slot2 = buildCanonicalSevenCellScenario(scenarioRequest(2));

  assert.equal(slot0.metadata.beamIllumination.eligibleBeamIds.length, 4);
  assert.equal(slot1.metadata.beamIllumination.eligibleBeamIds.length, 4);
  assert.equal(slot2.metadata.beamIllumination.eligibleBeamIds.length, 4);
  assert.deepEqual(slot0.metadata.beamIllumination.eligibleBeamIds, [0, 1, 2, 3]);
  assert.deepEqual(slot1.metadata.beamIllumination.eligibleBeamIds, [4, 5, 6, 0]);
  assert.deepEqual(slot2.metadata.beamIllumination.eligibleBeamIds, [1, 2, 3, 4]);

  for (const scenario of [slot0, slot1, slot2]) {
    const eligible = new Set(scenario.metadata.beamIllumination.eligibleBeamIds);
    assert.equal(scenario.metadata.beamIllumination.policyRevision, 'visual-lab-half-layout-round-robin-v1');
    assert.equal(scenario.input.frame.beamLoadB.reduce((sum, load) => sum + load, 0), 100);
    for (let beamId = 0; beamId < scenario.input.frame.beamLoadB.length; beamId += 1) {
      const load = scenario.input.frame.beamLoadB[beamId]!;
      const active = scenario.input.frame.beamActiveB[beamId];
      if (eligible.has(beamId)) {
        assert.ok(load > 0, `eligible beam ${beamId} must serve at least one UE in the canonical substrate`);
        assert.equal(active, true, `eligible beam ${beamId} must be active when it has load`);
      } else {
        assert.equal(load, 0, `ineligible beam ${beamId} must not receive load`);
        assert.equal(active, false, `ineligible beam ${beamId} must be inactive`);
      }
    }
    for (const servingBeam of scenario.input.frame.servingBeamU) {
      assert.ok(eligible.has(servingBeam), `UE association ${servingBeam} must stay inside the eligible set`);
    }
  }

  // The complete-ring geometry supports reassociation when the eligible
  // window moves. Keep a concrete pair as a guard against a display-only
  // schedule that leaves all UE ownership unchanged.
  assert.notDeepEqual(slot0.input.frame.servingBeamU, slot1.input.frame.servingBeamU);
  assert.equal(slot0.input.frame.servingBeamU[15], 1);
  assert.equal(slot1.input.frame.servingBeamU[15], 6);
});

test('accepted analysis frame identity and provenance distinguish fixed from Beam Hopping', async () => {
  const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
    new Response(await readFile(`public${String(path)}`), { status: 200 })
  );
  const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
  const selection = await loadTleSnapshotSelection(
    catalog,
    '2026-08-07T23:59:59.000Z',
    fetchFromPublic,
  );
  const state = createSimulatorTleState(selection, '2026-08-07T23:59:59.000Z');

  const fixed = buildSimulationAnalysisFrame(
    state,
    DEFAULT_SIMULATOR_PARAMETERS,
    undefined,
    { beamLayoutCount: 7, beamIlluminationMode: 'fixed' },
  );
  const hopping = buildSimulationAnalysisFrame(
    state,
    DEFAULT_SIMULATOR_PARAMETERS,
    undefined,
    { beamLayoutCount: 7, beamIlluminationMode: 'beam-hopping' },
  );

  assert.notEqual(fixed.frameId, hopping.frameId);
  assert.equal(fixed.scenario.beamIllumination.mode, 'fixed');
  assert.equal(hopping.scenario.beamIllumination.mode, 'beam-hopping');
  assert.deepEqual(fixed.scenario.beamIllumination.eligibleBeamIds, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(hopping.scenario.beamIllumination.eligibleBeamIds, [0, 1, 2, 3]);
  assert.equal(fixed.provenance.scenario, 'canonical-complete-hex-fixed-load');
  assert.equal(hopping.provenance.scenario, 'canonical-complete-hex-beam-hopping');
});
