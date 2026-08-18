import assert from 'node:assert/strict';
import {
  selectDirectorHandoverEvents,
} from './liveWalkerHandoverRailAdapter';
import type { LiveWalkerHandoverEvent } from '../scene/liveWalkerHandoverEventIndex';

const events = [
  { id: 'secondary', ueId: 'live-ue-15' },
  { id: 'primary', ueId: 'live-ue-0' },
] as LiveWalkerHandoverEvent[];

const cellTruth = selectDirectorHandoverEvents(
  { sourceOwner: 'sinr-live-cell-truth', primaryUeId: 'live-ue-0' },
  events,
);
assert.deepEqual(cellTruth.map(event => event.id), ['primary']);

const liveWalker = selectDirectorHandoverEvents(
  { sourceOwner: 'live-walker', primaryUeId: 'live-ue-0' },
  events,
);
assert.deepEqual(liveWalker, events, 'legacy live-walker events keep their existing selection');

console.log('liveWalkerHandoverRailAdapter.test.ts: PASS');
