import assert from 'node:assert/strict';

import {
  selectHandoverEventsForDisplay,
} from './handoverDisplayIsolation';
import {
  advanceHandoverPresentation,
  createHandoverPresentationState,
  type HandoverPresentationEvent,
} from './handoverPresentationOwner';
import {
  resolveNaturalHandoverProtagonistId,
} from './naturalHandoverProtagonist';
import type { SinrLiveCellHandoverEvent } from './sinrLiveCellModel';
import {
  resolveSinrLiveHandoverPulseConeItems,
  type SinrLiveCellPlacement,
} from '../viz/SinrLiveCellBeamCones';

const archivedEvent: SinrLiveCellHandoverEvent = {
  ueId: 'ue-16',
  kind: 'inter',
  sourceTimeSec: 390,
  fromSatId: '66446',
  fromCellId: 0,
  toSatId: '56708',
  toCellId: 0,
};

const placementByCellId = new Map<number, SinrLiveCellPlacement>([
  [0, { cellId: 0, worldX: 0, worldZ: 0, radiusWorld: 10 }],
]);
const satelliteWorldById = new Map([
  ['66446', { x: -20, y: 100, z: 0 }],
  ['56708', { x: 20, y: 100, z: 0 }],
]);

function presentationEvent(event: SinrLiveCellHandoverEvent): HandoverPresentationEvent {
  const drawable = (
    satId: string,
    cellId: number,
  ) => placementByCellId.has(cellId) && satelliteWorldById.has(satId);
  return {
    eventId: `tle:${event.ueId}:${event.sourceTimeSec}:${event.kind}`,
    source: 'tle',
    kind: event.kind,
    ueId: event.ueId,
    sourceTimeSec: event.sourceTimeSec,
    from: { satId: event.fromSatId!, cellId: event.fromCellId!, drawable: drawable(event.fromSatId!, event.fromCellId!) },
    to: { satId: event.toSatId, cellId: event.toCellId, drawable: drawable(event.toSatId, event.toCellId) },
    durationMs: 6000,
  };
}

const archivedProtagonist = resolveNaturalHandoverProtagonistId({
  simSource: 'archived-tle',
  canonicalPrimaryUeId: 'ue-16',
  sceneFrameFirstUeId: 'ue-1',
});
assert.equal(archivedProtagonist, 'ue-16', 'archived TLE prefers the canonical primary over scene-frame UE 0');

const selectedArchivedEvents = selectHandoverEventsForDisplay(
  [archivedEvent, { ...archivedEvent, ueId: 'ue-99' }],
  archivedProtagonist,
  false,
);
assert.deepEqual(selectedArchivedEvents, [archivedEvent], 'presentation filtering keeps the canonical UE event');

const started = advanceHandoverPresentation(createHandoverPresentationState(), {
  nowMs: 0,
  candidate: presentationEvent(selectedArchivedEvents[0]!),
});
assert.equal(started.view.active, true, 'the canonical archived-TLE event is a drawable presentation owner');
assert.equal(started.view.event?.ueId, 'ue-16');
assert.equal(started.view.event?.from.drawable, true);
assert.equal(started.view.event?.to.drawable, true);

const pulseItems = resolveSinrLiveHandoverPulseConeItems({
  recentHandoverEvents: selectedArchivedEvents,
  simTimeSec: 390,
  retentionSec: 4,
  placementByCellId,
  satelliteWorldById,
  frequencyReuse: 3,
  focusSatIds: new Set(['56708']),
  protagonistUeId: archivedProtagonist,
});
assert.equal(pulseItems.length, 2, 'the canonical archived-TLE event paints both pulse endpoints');
assert.deepEqual(
  new Set(pulseItems.map(item => item.satId)),
  new Set(['66446', '56708']),
  'the pulse contains the source and target satellites',
);

const walkerProtagonist = resolveNaturalHandoverProtagonistId({
  simSource: 'live',
  canonicalPrimaryUeId: 'ue-16',
  sceneFrameFirstUeId: 'ue-1',
});
assert.equal(walkerProtagonist, 'ue-1', 'Walker keeps the existing scene-frame first-UE behavior');
assert.deepEqual(
  selectHandoverEventsForDisplay([archivedEvent], walkerProtagonist, false),
  [],
  'Walker does not adopt an archived canonical primary identity',
);

assert.equal(
  resolveNaturalHandoverProtagonistId({
    simSource: 'archived-tle',
    canonicalPrimaryUeId: null,
    sceneFrameFirstUeId: 'ue-1',
  }),
  'ue-1',
  'archived TLE safely falls back when no canonical primary is published',
);

console.log('natural handover protagonist regression checks passed');
