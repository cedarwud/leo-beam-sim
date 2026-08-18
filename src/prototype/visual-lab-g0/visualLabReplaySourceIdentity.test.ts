import assert from 'node:assert/strict';

import type { LabSnapshot } from '../../visualLab/session';
import { visualLabReplaySourceIdentity } from './visualLabReplaySourceIdentity';

function snapshot(input: {
  readonly constellation?: 'starlink' | 'oneweb';
  readonly geometryRunId?: string | null;
  readonly tleFrameId?: string;
  readonly archiveDate?: string;
}): LabSnapshot {
  return {
    accepted: {
      identity: {
        constellation: input.constellation ?? 'starlink',
        geometryRunId: input.geometryRunId === undefined ? 'geometry-a' : input.geometryRunId,
        tleFrameId: input.tleFrameId ?? 'frame-a',
        archiveId: 'archive-a',
        archiveDate: input.archiveDate ?? '20260812',
        tleEpochUtc: '2026-08-12T00:00:00.000Z',
      },
    },
  } as unknown as LabSnapshot;
}

assert.equal(
  visualLabReplaySourceIdentity(snapshot({ tleFrameId: 'frame-a' })),
  visualLabReplaySourceIdentity(snapshot({ tleFrameId: 'frame-b' })),
  'timeline seeks inside one geometry run do not change replay source identity',
);
assert.notEqual(
  visualLabReplaySourceIdentity(snapshot({ geometryRunId: 'geometry-a' })),
  visualLabReplaySourceIdentity(snapshot({ geometryRunId: 'geometry-b' })),
  'a rebuilt orbit geometry invalidates the replay',
);
assert.notEqual(
  visualLabReplaySourceIdentity(snapshot({ constellation: 'starlink' })),
  visualLabReplaySourceIdentity(snapshot({ constellation: 'oneweb' })),
  'a constellation switch invalidates the replay',
);
assert.notEqual(
  visualLabReplaySourceIdentity(snapshot({ geometryRunId: null, archiveDate: '20260811' })),
  visualLabReplaySourceIdentity(snapshot({ geometryRunId: null, archiveDate: '20260812' })),
  'legacy snapshots fall back to archived-TLE provenance',
);

console.log('visual-lab replay source identity contract passed');
