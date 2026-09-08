import assert from 'node:assert/strict';
import test from 'node:test';

import { cellLinkBudgetBeamId } from './sinrLiveCellModel';
import { colorForServingBeam } from '../constants/servingColour';
import { emphasizeIntraHandoverColor } from '../appearance/intraHandoverShade';
import { resolveAdditiveHandoverConeColoring, type HandoverConeColorItem } from './additiveHandoverConeColoring';

type TestItem = HandoverConeColorItem & { readonly label: string };

function item(overrides: Partial<TestItem> = {}): TestItem {
  return {
    label: 'item',
    satId: 'sat-a',
    cellId: 0,
    color: 'original',
    ...overrides,
  };
}

test('keeps the established layers when the additive overlay is inactive', () => {
  const pulseItems = [item({ label: 'pulse' })];
  const triggeredIntraItems = [item({ label: 'triggered' })];
  const cinemaPairItems = [item({ label: 'cinema' })];

  const result = resolveAdditiveHandoverConeColoring({
    pulseItems,
    triggeredIntraItems,
    cinemaPairItems,
    centralOverlayActive: false,
    authorityPresentationCommitObserved: false,
    beamColorBySatelliteCell: new Map(),
    presentationPairKind: null,
  });

  assert.notStrictEqual(result.pulseItems, pulseItems);
  assert.strictEqual(result.triggeredIntraItems, triggeredIntraItems);
  assert.strictEqual(result.cinemaPairItems, cinemaPairItems);
  assert.deepEqual(result.pulseItems, pulseItems);
});

test('uses the accepted pair colour and preserves intra source/target distinction', () => {
  const beamColorBySatelliteCell = new Map([
    ['sat-a/0', '#112233'],
  ]);
  const result = resolveAdditiveHandoverConeColoring({
    pulseItems: [item({ label: 'pulse', satId: 'sat-a', cellId: 0 })],
    triggeredIntraItems: [
      item({ label: 'from', satId: 'sat-a', cellId: 0, renderKey: 'event-trig-from' }),
      item({ label: 'to', satId: 'sat-b', cellId: 1, renderKey: 'event-trig-to' }),
    ],
    cinemaPairItems: [
      item({ label: 'pair-from', satId: 'sat-a', cellId: 0, renderKey: 'event-from' }),
      item({ label: 'pair-to', satId: 'sat-b', cellId: 1, renderKey: 'event-to' }),
    ],
    centralOverlayActive: true,
    authorityPresentationCommitObserved: false,
    beamColorBySatelliteCell,
    presentationPairKind: 'intra',
  });

  // The fallback for a map MISS is now derived from the item's link-budget beam
  // id, not from its cell id. Written as the rule rather than as the number: the
  // point of the convergence is that one function decides which id identifies a
  // beam, so a test that hard-codes the other id would re-create the drift it is
  // meant to guard. (Before the convergence this read `colorForServingBeam(…, 1)`
  // — the CELL id — while the lookup key was the BEAM id, which is exactly the
  // mismatch that made one beam render in two shades.)
  const fallback = colorForServingBeam('sat-b', cellLinkBudgetBeamId(1)).markerColor;
  assert.equal(result.pulseItems[0]?.color, '#112233');
  assert.equal(
    result.triggeredIntraItems[0]?.color,
    emphasizeIntraHandoverColor('#112233', 'source'),
  );
  assert.equal(
    result.triggeredIntraItems[1]?.color,
    emphasizeIntraHandoverColor(fallback, 'target'),
  );
  assert.equal(
    result.cinemaPairItems[0]?.color,
    emphasizeIntraHandoverColor('#112233', 'source'),
  );
  assert.equal(
    result.cinemaPairItems[1]?.color,
    emphasizeIntraHandoverColor(fallback, 'target'),
  );
});

test('filters the committed inter source pulse and does not recolour the remaining pulse when inactive', () => {
  const committedSource = item({
    label: 'committed-source',
    kind: 'inter',
    role: 'handoverSource',
  });
  const remaining = item({ label: 'remaining', kind: 'inter', role: 'handoverTarget' });

  const result = resolveAdditiveHandoverConeColoring({
    pulseItems: [committedSource, remaining],
    triggeredIntraItems: [],
    cinemaPairItems: [],
    centralOverlayActive: true,
    authorityPresentationCommitObserved: true,
    beamColorBySatelliteCell: new Map([['sat-a/0', '#445566']]),
    presentationPairKind: 'inter',
  });

  assert.deepEqual(result.pulseItems.map(cone => cone.label), ['remaining']);
  assert.equal(result.pulseItems[0]?.color, '#445566');
});

test('uses identity colour rather than intra emphasis for an inter cinema pair', () => {
  const result = resolveAdditiveHandoverConeColoring({
    pulseItems: [],
    triggeredIntraItems: [],
    cinemaPairItems: [
      item({ satId: 'sat-a', cellId: 0, renderKey: 'event-from' }),
      item({ satId: 'sat-b', cellId: 1, renderKey: 'event-to' }),
    ],
    centralOverlayActive: true,
    authorityPresentationCommitObserved: false,
    beamColorBySatelliteCell: new Map([
      ['sat-a/0', '#112233'],
      ['sat-b/1', '#778899'],
    ]),
    presentationPairKind: 'inter',
  });

  assert.deepEqual(result.cinemaPairItems.map(cone => cone.color), ['#112233', '#778899']);
});
