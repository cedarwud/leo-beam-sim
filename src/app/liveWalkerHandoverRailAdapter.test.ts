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

// The cell-truth index bakes `primaryUeId: 'live-ue-0'` at build time, so the
// Director used to seek to cell 0's handovers whichever cell was focused. The
// focused-UE override is what unpins Show Intra / Show Inter.
const focused = selectDirectorHandoverEvents(
  { sourceOwner: 'sinr-live-cell-truth', primaryUeId: 'live-ue-0' },
  events,
  'live-ue-15',
);
assert.deepEqual(
  focused.map(event => event.id),
  ['secondary'],
  'a focused UE selects ITS handovers, not the index\'s baked-in primary',
);

const noOverride = selectDirectorHandoverEvents(
  { sourceOwner: 'sinr-live-cell-truth', primaryUeId: 'live-ue-0' },
  events,
  null,
);
assert.deepEqual(
  noOverride.map(event => event.id),
  ['primary'],
  'no focus falls back to the index primary (unchanged default)',
);

console.log('liveWalkerHandoverRailAdapter.test.ts: PASS');
