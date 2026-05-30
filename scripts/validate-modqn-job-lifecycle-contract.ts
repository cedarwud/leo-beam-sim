#!/usr/bin/env node
// validate-modqn-job-lifecycle-contract.ts
//
// Acceptance validator:
//   (a) paused/completed lifecycle compatibility is client-visible
//   (b) pause/resume helpers call producer endpoints and fail closed on 501
//   (c) docs preserve done/completed, deleted, and paused contract boundaries

import * as fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  isActiveStatus,
  isDoneStatus,
} from '../src/modqn/training-trigger/jobsPolling';
import {
  postPauseJob,
  postResumeJob,
} from '../src/modqn/training-trigger/serviceClient';

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

async function check(label: string, action: () => void | Promise<void>): Promise<void> {
  try {
    await action();
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

console.log('\n(a) lifecycle status helpers');
await check('paused remains a non-terminal visible job state', () => {
  assert.equal(isActiveStatus('paused'), true);
});
await check('completed is accepted only as a done compatibility alias', () => {
  assert.equal(isDoneStatus('completed'), true);
  assert.equal(isDoneStatus('done'), true);
});

console.log('\n(b) pause/resume fail-closed helpers');
{
  const calls: Array<{ url: string; method: string | undefined }> = [];
  await withFetch(
    (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method });
      return {
        ok: false,
        status: 501,
        text: async () => JSON.stringify({
          detail: {
            jobId: 'job 1',
            status: 'running',
            supported: false,
            message: 'pause/resume is not implemented',
          },
        }),
      } as Response;
    }) as typeof fetch,
    async () => {
      await check('postPauseJob posts to /pause and surfaces HTTP 501', async () => {
        await assert.rejects(
          postPauseJob({ baseUrl: 'http://producer.local:8765/' }, 'job 1'),
          /postPauseJob: HTTP 501[\s\S]*supported/,
        );
        assert.equal(calls[0]?.url, 'http://producer.local:8765/jobs/job%201/pause');
        assert.equal(calls[0]?.method, 'POST');
      });
      await check('postResumeJob posts to /resume and surfaces HTTP 501', async () => {
        await assert.rejects(
          postResumeJob({ baseUrl: 'http://producer.local:8765/' }, 'job 1'),
          /postResumeJob: HTTP 501[\s\S]*supported/,
        );
        assert.equal(calls[1]?.url, 'http://producer.local:8765/jobs/job%201/resume');
        assert.equal(calls[1]?.method, 'POST');
      });
    },
  );
}

console.log('\n(c) docs and package dependency guard');
await check('backend SDD documents done/completed compatibility', () => {
  const backendSdd = fs.readFileSync('docs/modqn-training-trigger-backend-sdd.md', 'utf8');
  assert.match(backendSdd, /completed[\s\S]*alias[\s\S]*done|done[\s\S]*completed[\s\S]*alias/i);
});
await check('backend SDD documents pause/resume fail-closed 501', () => {
  const backendSdd = fs.readFileSync('docs/modqn-training-trigger-backend-sdd.md', 'utf8');
  assert.match(backendSdd, /\/jobs\/<id>\/pause[\s\S]*501/i);
  assert.match(backendSdd, /\/jobs\/<id>\/resume[\s\S]*501/i);
});
await check('phase-b SDD preserves leo orchestration-only lifecycle boundary', () => {
  const phaseB = fs.readFileSync('docs/phase-b-training-pipeline-mini-sdd.md', 'utf8');
  assert.match(phaseB, /pause\/resume[\s\S]*fail closed/i);
  assert.match(phaseB, /orchestration-only/i);
});
await check('ntn-sim-core is not a package dependency', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  assert.equal(Object.prototype.hasOwnProperty.call(deps, 'ntn-sim-core'), false);
});

console.log(`\n[validate-modqn-job-lifecycle-contract] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
