#!/usr/bin/env node
// validate-modqn-producer-dispatch-envelope.ts
//
// Acceptance validator:
//   (a) leo service client wraps POST /train in a producer dispatch envelope
//   (b) envelope preserves the producer TrainingRequest without mutation
//   (c) ntn-sim-core is not introduced as a runtime dependency
//
// Run: node --import tsx/esm scripts/validate-modqn-producer-dispatch-envelope.ts

import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  buildProducerDispatchEnvelope,
  LEO_PRODUCER_DISPATCH_SCHEMA,
  LEO_RUN_CONFIG_SCHEMA,
  postTrain,
} from '../src/modqn/training-trigger/serviceClient';
import type {
  LeoProducerDispatchEnvelope,
  TrainingRequest,
} from '../src/modqn/training-trigger/types';

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed++;
}

function check(label: string, action: () => void): void {
  try {
    action();
    pass(label);
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

function withFetch<T>(stub: typeof fetch, action: () => Promise<T> | T): Promise<T> {
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = stub;
  return Promise.resolve(action()).finally(() => {
    if (original === undefined) {
      delete (globalThis as any).fetch;
    } else {
      (globalThis as any).fetch = original;
    }
  });
}

const track2Request: TrainingRequest = {
  trainingProfile: 'track2',
  trainerSubcommand: 'baseline',
  hyperparams: {
    episodes: 100,
    learningRate: 0.001,
    discountGamma: 0.9,
    hiddenDim: 100,
    batchSize: 128,
    objectiveWeights: {
      throughput: 0.4,
      handover: 0.3,
      loadBalance: 0.3,
    },
    seedTriplet: [42, 1337, 7],
  },
  track2: {
    arm: 'a1',
    r1RewardMode: 'angle_aware_ee',
    requestMode: 'exploration',
    envAxes: {
      nSatellites: 4,
      altitudeKm: 780,
      satelliteSpeedKmS: 7.4,
      nUsers: 10,
      userSpeedKmh: 30,
      antiCollapseMaxUsersPerBeam: 25,
      qosThresholdBps: 1_000_000,
      ueArea: {
        distribution: 'uniform-rectangle',
        widthKm: 200,
        heightKm: 90,
        mobilityModel: 'deterministic-heading',
        randomWanderingMaxTurnRad: 0.7853981633974483,
      },
      antenna: {
        beamsPerSatellite: 7,
        theta3dbDeg: 2,
      },
      channel: {
        carrierFrequencyGhz: 20,
        bandwidthMhz: 500,
        txPowerW: 2,
        ricianKDb: 20,
        atmosphericAttenuationDbPerKm: 0.05,
      },
    },
  },
};

console.log('\n(a) buildProducerDispatchEnvelope contract');
{
  const envelope = buildProducerDispatchEnvelope(
    { baseUrl: 'http://producer.local:8765/' },
    track2Request,
    { createdAtMs: 123456, clientJobId: 'leo-client-job-1' },
  );
  check('envelope has leo dispatch schema', () => {
    assert.equal(envelope.schema, LEO_PRODUCER_DISPATCH_SCHEMA);
  });
  check('envelope declares producer truth owner', () => {
    assert.equal(envelope.producerTruthOwner, 'modqn-paper-reproduction');
  });
  check('envelope declares leo consumer owner only', () => {
    assert.equal(envelope.consumerOwner, 'leo-beam-sim');
  });
  check('envelope rejects ntn-sim-core runtime dependency', () => {
    assert.equal(envelope.ntnSimCoreRuntimeDependency, false);
    assert.equal(envelope.runConfig.orchestrator.ntnSimCoreRuntimeDependency, false);
  });
  check('run config declares orchestration-only role', () => {
    assert.equal(envelope.runConfig.schema, LEO_RUN_CONFIG_SCHEMA);
    assert.equal(envelope.runConfig.orchestrator.owner, 'leo-beam-sim');
    assert.equal(envelope.runConfig.orchestrator.role, 'job-orchestration-only');
  });
  check('run config stores normalized producer base URL', () => {
    assert.equal(envelope.runConfig.orchestrator.producerServiceBaseUrl, 'http://producer.local:8765');
  });
  check('run config preserves TrainingRequest without mutation', () => {
    assert.deepEqual(envelope.runConfig.request, track2Request);
  });
}

console.log('\n(b) postTrain sends dispatch envelope');
{
  let capturedUrl = '';
  let capturedBody: LeoProducerDispatchEnvelope | null = null;

  await withFetch(
    (async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body ?? 'null')) as LeoProducerDispatchEnvelope;
      return {
        ok: true,
        status: 202,
        json: async () => ({
          jobId: 'producer-job-1',
          status: 'queued',
          estimatedStartAtMs: null,
          dispatch: {
            status: 'accepted',
            schema: LEO_PRODUCER_DISPATCH_SCHEMA,
            producerTruthOwner: 'modqn-paper-reproduction',
            consumerOwner: 'leo-beam-sim',
            truthMutation: 'none',
            ntnSimCoreRuntimeDependency: false,
          },
        }),
        text: async () => '',
      } as Response;
    }) as typeof fetch,
    async () => {
      const response = await postTrain({ baseUrl: 'http://producer.local:8765/' }, track2Request);
      check('postTrain targets /train on normalized base URL', () => {
        assert.equal(capturedUrl, 'http://producer.local:8765/train');
      });
      check('postTrain request body is dispatch envelope', () => {
        assert.equal(capturedBody?.schema, LEO_PRODUCER_DISPATCH_SCHEMA);
        assert.deepEqual(capturedBody?.runConfig.request, track2Request);
      });
      check('postTrain exposes producer dispatch ack', () => {
        assert.equal(response.dispatch?.status, 'accepted');
        assert.equal(response.dispatch?.truthMutation, 'none');
      });
    },
  );
}

console.log('\n(c) runtime dependency guard');
{
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  check('package.json registers producer dispatch validator', () => {
    assert.ok(packageJson.scripts?.['validate:modqn:producer-dispatch-envelope']);
  });
  check('ntn-sim-core is not a runtime package dependency', () => {
    assert.equal(Object.prototype.hasOwnProperty.call(deps, 'ntn-sim-core'), false);
  });
}

console.log('\n(d) docs describe dispatch envelope boundary');
{
  const backendSdd = fs.readFileSync('docs/modqn-training-trigger-backend-sdd.md', 'utf8');
  const pipelineSdd = fs.readFileSync('docs/phase-b-training-pipeline-mini-sdd.md', 'utf8');
  for (const [label, source] of [
    ['backend SDD', backendSdd],
    ['phase-b pipeline SDD', pipelineSdd],
  ] as const) {
    check(`${label} names leo dispatch schema`, () => {
      assert.match(source, /leo-modqn-producer-dispatch-request-v1/);
    });
    check(`${label} keeps producer truth owner explicit`, () => {
      assert.match(source, /modqn-paper-reproduction/);
    });
    check(`${label} keeps leo orchestration-only boundary explicit`, () => {
      assert.match(source, /orchestration-only|job-orchestration-only/);
    });
    check(`${label} forbids ntn-sim-core runtime dependency`, () => {
      assert.match(source, /ntn-sim-core[\s\S]*runtime dependency|runtime dependency[\s\S]*ntn-sim-core|ntnSimCoreRuntimeDependency/i);
    });
  }
}

console.log(`\n[validate-modqn-producer-dispatch-envelope] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
