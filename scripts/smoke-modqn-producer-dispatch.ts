#!/usr/bin/env node
// smoke-modqn-producer-dispatch.ts
//
// Cross-repo smoke for a running modqn-paper-reproduction producer service.
// Start the producer with MODQN_SERVICE_DB set to a temp DB to disable the
// worker, then run:
//
//   PRODUCER_BASE_URL=http://127.0.0.1:8766 npm run smoke:modqn:producer-dispatch

import assert from 'node:assert/strict';
import {
  deleteJob,
  getJobDetail,
  getJobs,
  postCancelJob,
  postTrain,
} from '../src/modqn/training-trigger/serviceClient';
import {
  buildRequest,
  DEFAULT_FORM_STATE,
} from '../src/ui/modqn-training/trainingFormModel';
import type { TrainingRequest } from '../src/modqn/training-trigger/types';

const baseUrl = process.env.PRODUCER_BASE_URL ?? 'http://127.0.0.1:8766';
const request = buildRequest({
  ...DEFAULT_FORM_STATE,
  episodes: 100,
  nUsers: 10,
  submissionMode: 'single',
  requestMode: 'exploration',
});

function assertNormalizedRequestPreservesSubmission(
  actual: TrainingRequest | null | undefined,
  expected: TrainingRequest,
): void {
  assert.ok(actual, 'job detail includes normalized request');
  assert.equal(actual.trainingProfile, expected.trainingProfile);
  assert.equal(actual.trainerSubcommand, expected.trainerSubcommand);
  assert.deepEqual(actual.hyperparams, expected.hyperparams);
  assert.equal(actual.track2?.arm, expected.track2?.arm);
  assert.equal(actual.track2?.r1RewardMode, expected.track2?.r1RewardMode);
  assert.equal(actual.track2?.requestMode, expected.track2?.requestMode);
  assert.equal(actual.track2?.envAxes.nSatellites, expected.track2?.envAxes.nSatellites);
  assert.equal(actual.track2?.envAxes.altitudeKm, expected.track2?.envAxes.altitudeKm);
  assert.equal(actual.track2?.envAxes.satelliteSpeedKmS, expected.track2?.envAxes.satelliteSpeedKmS);
  assert.equal(actual.track2?.envAxes.nUsers, expected.track2?.envAxes.nUsers);
  assert.equal(actual.track2?.envAxes.userSpeedKmh, expected.track2?.envAxes.userSpeedKmh);
  assert.equal(
    actual.track2?.envAxes.antiCollapseMaxUsersPerBeam,
    expected.track2?.envAxes.antiCollapseMaxUsersPerBeam,
  );
  assert.equal(actual.track2?.envAxes.qosThresholdBps, expected.track2?.envAxes.qosThresholdBps);
  assert.equal(actual.track2?.envAxes.ueArea.distribution, expected.track2?.envAxes.ueArea.distribution);
  assert.equal(actual.track2?.envAxes.ueArea.widthKm, expected.track2?.envAxes.ueArea.widthKm);
  assert.equal(actual.track2?.envAxes.ueArea.heightKm, expected.track2?.envAxes.ueArea.heightKm);
  assert.equal(actual.track2?.envAxes.ueArea.mobilityModel, expected.track2?.envAxes.ueArea.mobilityModel);
  assert.equal(
    actual.track2?.envAxes.ueArea.randomWanderingMaxTurnRad,
    expected.track2?.envAxes.ueArea.randomWanderingMaxTurnRad,
  );
  assert.deepEqual(actual.track2?.envAxes.antenna, expected.track2?.envAxes.antenna);
  assert.deepEqual(actual.track2?.envAxes.channel, expected.track2?.envAxes.channel);
}

const created = await postTrain({ baseUrl }, request);
let cancelledStatus = 'not-run';
let deleteMessage = 'not-run';
let detailSubmissionSchema: unknown = null;

try {
  assert.equal(created.status, 'queued');
  assert.equal(created.dispatch?.status, 'accepted');
  assert.equal(created.dispatch?.schema, 'leo-modqn-producer-dispatch-request-v1');
  assert.equal(created.dispatch?.producerTruthOwner, 'modqn-paper-reproduction');
  assert.equal(created.dispatch?.consumerOwner, 'leo-beam-sim');
  assert.equal(created.dispatch?.truthMutation, 'none');
  assert.equal(created.dispatch?.ntnSimCoreRuntimeDependency, false);

  const listed = await getJobs({ baseUrl }, { limit: 10 });
  assert.ok(
    listed.jobs.some(job => (
      job.jobId === created.jobId
      && job.submissionSchema === 'leo-modqn-producer-dispatch-request-v1'
    )),
    'created job should be listed with leo submission schema',
  );

  const detail = await getJobDetail({ baseUrl }, created.jobId);
  detailSubmissionSchema = detail.submissionSchema;
  assert.equal(detail.jobId, created.jobId);
  assert.equal(detail.status, 'queued');
  assert.equal(detail.submissionSchema, 'leo-modqn-producer-dispatch-request-v1');
  assert.equal(detail.dispatchEnvelope?.schema, 'leo-modqn-producer-dispatch-request-v1');
  assert.equal(detail.dispatchEnvelope?.producerTruthOwner, 'modqn-paper-reproduction');
  assert.equal(detail.dispatchEnvelope?.consumerOwner, 'leo-beam-sim');
  assert.equal(detail.dispatchEnvelope?.ntnSimCoreRuntimeDependency, false);
  assert.equal(detail.dispatchEnvelope?.runConfig.orchestrator.role, 'job-orchestration-only');
  assert.deepEqual(detail.dispatchEnvelope?.runConfig.request, request);
  assertNormalizedRequestPreservesSubmission(detail.request, request);

  const cancelled = await postCancelJob({ baseUrl }, created.jobId);
  assert.equal(cancelled.jobId, created.jobId);
  assert.equal(cancelled.status, 'cancelled');
  cancelledStatus = cancelled.status;
} finally {
  const deleted = await deleteJob({ baseUrl }, created.jobId);
  assert.equal(deleted.jobId, created.jobId);
  deleteMessage = deleted.message;
}

console.log(JSON.stringify({
  ok: true,
  producerBaseUrl: baseUrl,
  jobId: created.jobId,
  dispatchSchema: created.dispatch?.schema,
  detailSubmissionSchema,
  cancelled: cancelledStatus,
  deleted: deleteMessage,
}, null, 2));
