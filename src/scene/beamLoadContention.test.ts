#!/usr/bin/env node

import {
  beamKeyOf,
  deriveBeamLoadContention,
  EMPTY_BEAM_LOAD_CONTENTION,
  type UeServingAssignment,
} from './beamLoadContention';

const assert = {
  equal<TValue>(actual: TValue, expected: TValue, label: string): void {
    if (!Object.is(actual, expected)) {
      throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

let passed = 0;

function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}

function ue(
  ueId: string,
  servingSatId: string | null,
  servingBeamId: number | string | null,
): UeServingAssignment {
  return { ueId, servingSatId, servingBeamId };
}

console.log('beamLoadContention.test');

check('served UE load = #UEs on its authoritative serving beam, normalized by maxLoad', () => {
  const model = deriveBeamLoadContention([
    ue('ue-a', 'sat-a', 3),
    ue('ue-b', 'sat-a', 3),
    ue('ue-c', 'sat-a', 4),
  ]);

  assert.equal(model.byUeId.get('ue-a')?.beamKey, 'sat-a|3', 'ue-a beamKey');
  assert.equal(model.byUeId.get('ue-a')?.load, 2, 'ue-a load');
  assert.equal(model.byUeId.get('ue-a')?.normalizedLoad, 1, 'ue-a normalized');
  assert.equal(model.byUeId.get('ue-c')?.load, 1, 'ue-c load');
  assert.equal(model.byUeId.get('ue-c')?.normalizedLoad, 0.5, 'ue-c normalized');
});

check('codex [P2]: two UEs on the same serving beam count as one beam load, not two', () => {
  // The exact scenario codex flagged: same authoritative serving beam, but a
  // nearest-display-cell aggregation would have split them. Authoritative
  // keying counts them as a single beam load of 2.
  const model = deriveBeamLoadContention([
    ue('ue-a', 'sat-a', 7),
    ue('ue-b', 'sat-a', 7),
  ]);

  assert.equal(model.loadByBeamKey.get('sat-a|7'), 2, 'beam holds both UEs');
  assert.equal(model.loadedBeamCount, 1, 'one loaded beam, not two');
  assert.equal(model.maxLoad, 2, 'maxLoad is the real beam load');
  assert.equal(model.byUeId.get('ue-a')?.load, 2, 'ue-a sees beam load 2');
  assert.equal(model.byUeId.get('ue-b')?.load, 2, 'ue-b sees beam load 2');
});

check('replay string producer beam IDs aggregate without coercion (lane-agnostic seam)', () => {
  // visual-showcase-v1 emits servingBeamId as producer strings like sat-0-beam-4.
  const model = deriveBeamLoadContention([
    ue('ue-a', 'sat-0', 'sat-0-beam-4'),
    ue('ue-b', 'sat-0', 'sat-0-beam-4'),
    ue('ue-c', 'sat-0', 'sat-0-beam-9'),
  ]);

  assert.equal(model.byUeId.get('ue-a')?.beamKey, 'sat-0|sat-0-beam-4', 'string beamKey preserved');
  assert.equal(model.loadByBeamKey.get('sat-0|sat-0-beam-4'), 2, 'string beam load');
  assert.equal(model.byUeId.get('ue-a')?.load, 2, 'ue-a sees string-beam load 2');
  assert.equal(model.byUeId.get('ue-c')?.load, 1, 'ue-c load');
  assert.equal(model.loadedBeamCount, 2, 'two string beams');
});

check('same beamId on different satellites are distinct beams', () => {
  const model = deriveBeamLoadContention([
    ue('ue-a', 'sat-a', 1),
    ue('ue-b', 'sat-b', 1),
  ]);

  assert.equal(model.loadByBeamKey.get('sat-a|1'), 1, 'sat-a beam load');
  assert.equal(model.loadByBeamKey.get('sat-b|1'), 1, 'sat-b beam load');
  assert.equal(model.loadedBeamCount, 2, 'two distinct beams');
  assert.equal(model.maxLoad, 1, 'maxLoad');
});

check('unserved UEs (missing sat OR beam) carry zero load and served=false', () => {
  const model = deriveBeamLoadContention([
    ue('ue-served', 'sat-a', 2),
    ue('ue-no-sat', null, 2),
    ue('ue-no-beam', 'sat-a', null),
    ue('ue-none', null, null),
  ]);

  assert.equal(model.byUeId.get('ue-served')?.served, true, 'served flag');
  for (const id of ['ue-no-sat', 'ue-no-beam', 'ue-none']) {
    assert.equal(model.byUeId.get(id)?.served, false, `${id} served`);
    assert.equal(model.byUeId.get(id)?.beamKey, null, `${id} beamKey`);
    assert.equal(model.byUeId.get(id)?.load, 0, `${id} load`);
    assert.equal(model.byUeId.get(id)?.normalizedLoad, 0, `${id} normalized`);
  }
  assert.equal(model.servedUeCount, 1, 'only one served');
});

check('model summary mirrors authoritative serving counts', () => {
  const model = deriveBeamLoadContention([
    ue('ue-a', 'sat-a', 0),
    ue('ue-b', 'sat-a', 1),
    ue('ue-c', 'sat-a', 1),
    ue('ue-d', 'sat-b', 0),
  ]);

  assert.equal(model.maxLoad, 2, 'maxLoad');
  assert.equal(model.loadedBeamCount, 3, 'loadedBeamCount');
  assert.equal(model.servedUeCount, 4, 'servedUeCount');
});

check('empty input returns the empty beam-load contention model', () => {
  const model = deriveBeamLoadContention([]);

  assert.equal(model, EMPTY_BEAM_LOAD_CONTENTION, 'empty model identity');
  assert.equal(model.maxLoad, 0, 'empty maxLoad');
  assert.equal(model.byUeId.size, 0, 'empty byUeId');
});

check('all-unserved input produces zero normalizedLoad without NaN/divide-by-zero', () => {
  const model = deriveBeamLoadContention([
    ue('ue-a', null, null),
    ue('ue-b', 'sat-a', null),
  ]);

  assert.equal(model.maxLoad, 0, 'maxLoad');
  assert.equal(model.servedUeCount, 0, 'servedUeCount');
  assert.equal(model.byUeId.get('ue-a')?.normalizedLoad, 0, 'a normalized');
  assert.equal(Number.isNaN(model.byUeId.get('ue-a')?.normalizedLoad ?? NaN), false, 'a not NaN');
  assert.equal(model.byUeId.get('ue-b')?.normalizedLoad, 0, 'b normalized');
});

check('beamKeyOf returns null unless both sat and beam are present', () => {
  assert.equal(beamKeyOf('sat-a', 5), 'sat-a|5', 'both present');
  assert.equal(beamKeyOf(null, 5), null, 'no sat');
  assert.equal(beamKeyOf('sat-a', null), null, 'no beam');
  assert.equal(beamKeyOf('sat-a', 0), 'sat-a|0', 'beam 0 is valid (not falsy-dropped)');
});

check('empty-string serving sentinel is treated as unserved, no fabricated load', () => {
  // Existing normalized-scene adapters use '' (not null) for "no serving".
  assert.equal(beamKeyOf('', ''), null, 'both empty');
  assert.equal(beamKeyOf('', 5), null, 'empty sat');
  assert.equal(beamKeyOf('sat-a', ''), null, 'empty beam');
  assert.equal(beamKeyOf('', 0), null, 'empty sat with numeric beam 0');

  const model = deriveBeamLoadContention([
    ue('ue-empty', '', ''),
    ue('ue-empty-beam', 'sat-a', ''),
    ue('ue-real', 'sat-a', 2),
  ]);
  assert.equal(model.byUeId.get('ue-empty')?.served, false, 'empty-sentinel UE unserved');
  assert.equal(model.byUeId.get('ue-empty')?.beamKey, null, 'empty-sentinel beamKey null');
  assert.equal(model.byUeId.get('ue-empty')?.load, 0, 'empty-sentinel load 0');
  assert.equal(model.byUeId.get('ue-empty-beam')?.served, false, 'empty-beam UE unserved');
  assert.equal(model.servedUeCount, 1, 'only the real UE is served');
  assert.equal(model.loadByBeamKey.has('|'), false, 'no fabricated | beam key');
});

console.log(`[beamLoadContention.test] PASS ${passed}/0`);
