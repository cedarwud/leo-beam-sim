import assert from 'node:assert/strict';

import { loadGoldenFlowTruth } from './goldenFlowDirector';
import {
  buildGoldenFlowCandidateComparisonFrame,
  buildGoldenFlowHandoverDecisionFrame,
} from './goldenFlowHandoverLesson';

const truth = loadGoldenFlowTruth('starlink');
const comparing = buildGoldenFlowHandoverDecisionFrame('candidate', 0, truth);
assert.equal(comparing.thresholdMet, false);
assert.equal(comparing.activeService, 'source');
assert.ok(comparing.servingLinkStrength > 0);
assert.equal(comparing.candidateLinkStrength, 0, 'candidate measurement must not render as a service link');
assert.ok(comparing.candidateMeasurementStrength > 0);

const candidatePool = buildGoldenFlowCandidateComparisonFrame(0.62, truth);
assert.deepEqual(candidatePool.entries.map(entry => entry.marker), ['B1', 'B2', 'B3']);
assert.equal(candidatePool.entries.filter(entry => entry.selected).length, 1);
assert.equal(candidatePool.entries[0]?.rank, 1);
assert.ok((candidatePool.entries[0]?.sinrDb ?? -Infinity) > (candidatePool.entries[1]?.sinrDb ?? Infinity));

const candidatePoolOpening = buildGoldenFlowCandidateComparisonFrame(0, truth);
assert.ok(
  (candidatePoolOpening.entries[0]?.sinrDb ?? -Infinity) > (candidatePoolOpening.entries[1]?.sinrDb ?? Infinity),
  'B1 must be the actual best candidate from the first visible comparison frame',
);

const qualified = buildGoldenFlowHandoverDecisionFrame('qualification', 1, truth);
assert.equal(qualified.thresholdMet, true);
assert.equal(qualified.tttElapsedSec, 0);

const tttHalf = buildGoldenFlowHandoverDecisionFrame('ttt', 0.5, truth);
assert.equal(tttHalf.thresholdMet, true);
assert.ok(tttHalf.tttElapsedSec > 0 && tttHalf.tttElapsedSec < truth.tttSec);
assert.equal(tttHalf.activeService, 'source');
assert.equal(tttHalf.candidateLinkStrength, 0, 'TTT must keep a single serving link');

for (let step = 0; step <= 100; step += 1) {
  const frame = buildGoldenFlowHandoverDecisionFrame('commit', step / 100, truth);
  assert.equal(
    frame.servingLinkStrength > 0 && frame.candidateLinkStrength > 0,
    false,
    `commit frame ${step} must never imply DAPS`,
  );
  assert.equal(
    Number(frame.servingLinkStrength > 0) + Number(frame.candidateLinkStrength > 0),
    1,
    `commit frame ${step} must have exactly one active service link`,
  );
}

const releasing = buildGoldenFlowHandoverDecisionFrame('commit', 0.35, truth);
assert.equal(releasing.transferStage, 'release-source');
assert.equal(releasing.activeService, 'source');
assert.ok(releasing.sourceReleaseProgress > 0);

const switched = buildGoldenFlowHandoverDecisionFrame('commit', 0.65, truth);
assert.equal(switched.activeService, 'target');
assert.ok(['switch-owner', 'establish-target'].includes(switched.transferStage));
assert.ok(switched.targetEstablishProgress > 0);

const established = buildGoldenFlowHandoverDecisionFrame('commit', 0.98, truth);
assert.equal(established.transferStage, 'stable-target');
assert.equal(established.activeService, 'target');

const sourceBackedTruth = loadGoldenFlowTruth('oneweb');
const sourceCandidate = buildGoldenFlowHandoverDecisionFrame('candidate', 0.2, sourceBackedTruth);
assert.equal(sourceCandidate.deltaDb, sourceBackedTruth.qualification[0]?.deltaDb);
const sourceTttEarly = buildGoldenFlowHandoverDecisionFrame('ttt', 0.2, sourceBackedTruth);
const sourceTttLate = buildGoldenFlowHandoverDecisionFrame('ttt', 0.8, sourceBackedTruth);
assert.equal(sourceTttEarly.deltaDb, sourceBackedTruth.qualification[0]?.deltaDb);
assert.equal(sourceTttLate.deltaDb, sourceBackedTruth.qualification[0]?.deltaDb);
assert.equal(buildGoldenFlowCandidateComparisonFrame(0.5, sourceBackedTruth).entries.length, 1);

const committed = buildGoldenFlowHandoverDecisionFrame('new-normal', 1, truth);
assert.equal(committed.tttComplete, true);
assert.equal(committed.committed, true);
assert.equal(committed.activeService, 'target');
assert.equal(committed.candidateMeasurementStrength, 0, 'measurement-only state ends when target becomes the service link');
assert.ok(committed.candidateLinkStrength > committed.servingLinkStrength);

console.log('goldenFlowHandoverLesson tests passed');
