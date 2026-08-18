import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { buildTleAnalysisRun } from '../../simulator/tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import {
  buildTleRunBundle,
  createTleRunBundleSnapshot,
  type TleRunBundleSnapshot,
} from './index';
import {
  createTleRunWorkerRuntime,
  type TleRunWorkerRuntimePort,
} from './workerRuntime';
import type { TleRunWorkerMessage, TleRunWorkerResponse } from './workerProtocol';

class FakeWorkerPort implements TleRunWorkerRuntimePort {
  readonly posted: Array<{ readonly message: TleRunWorkerResponse; readonly transfer: readonly Transferable[] }> = [];

  postMessage(message: TleRunWorkerResponse, transfer: Transferable[] = []): void {
    this.posted.push({ message, transfer });
  }

  addEventListener(): void {}

  removeEventListener(): void {}
}

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

async function waitForTerminal(
  port: FakeWorkerPort,
  requestId: string,
): Promise<Extract<TleRunWorkerResponse, { type: 'accepted' | 'error' }>> {
  for (;;) {
    const terminal = port.posted
      .map(item => item.message)
      .find((message): message is Extract<TleRunWorkerResponse, { type: 'accepted' | 'error' }> => (
        message.requestId === requestId && (message.type === 'accepted' || message.type === 'error')
      ));
    if (terminal !== undefined) return terminal;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const requestedInstantUtc = '2026-08-07T23:59:59.000Z';
const selection = await loadTleSnapshotSelection(catalog, requestedInstantUtc, fetchFromPublic);
const geometryRun = await buildTleRunBundle({
  selection,
  t0Utc: requestedInstantUtc,
  yieldEveryAnchors: 241,
});
const sourceAnalysis = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});

// A live RunBundle is never sent through structured clone.  The transport
// boundary receives this detached data-only snapshot instead.
const geometrySnapshot: TleRunBundleSnapshot = createTleRunBundleSnapshot(geometryRun);
const port = new FakeWorkerPort();
const runtime = createTleRunWorkerRuntime(port);
const request: TleRunWorkerMessage = {
  protocol: 'tle-run-worker-v1',
  type: 'rebuild-analysis',
  requestId: 'worker-analysis-only-1',
  selection,
  geometryRun: geometrySnapshot,
  passPlan: sourceAnalysis.passPlan,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
  frameOptions: { userPositionOverridesKm: [] },
};

const sourcePosition = geometryRun.readStateByIndex(0, 0).positionTemeKm;
runtime.handle(request);
const terminal = await waitForTerminal(port, request.requestId);
assert.equal(terminal.type, 'accepted');
if (terminal.type === 'accepted') {
  assert.equal(
    'geometry' in terminal,
    false,
    'accepted Worker payload must carry geometry only once at analysis.geometryRun',
  );
  assert.equal(terminal.geometryRunId, geometryRun.runId);
  assert.equal(terminal.analysis.geometryRunId, geometryRun.runId);
  assert.equal(terminal.analysis.passPlan.policyRevision, sourceAnalysis.passPlan.policyRevision);
  assert.equal(terminal.analysis.analysisRunId, terminal.analysis.runId);
  assert.equal(terminal.analysis.geometryRun.positionsTemeKm.byteLength > 0, true);
  // The source-backed result must still carry the exact geometry value; this
  // path cannot have silently made a fresh propagation run.
  assert.equal(terminal.analysis.geometryRun.positionsTemeKm[0], sourcePosition.x);
}

const phases = port.posted
  .map(item => item.message)
  .filter((message): message is Extract<TleRunWorkerResponse, { type: 'progress' }> => message.type === 'progress')
  .map(message => message.phase);
assert.ok(phases.includes('geometry'), 'analysis-only request publishes the reused geometry as complete');
assert.ok(phases.includes('analysis'), 'analysis-only request publishes analysis progress');

runtime.dispose();
console.log('TLE Worker analysis-only rebuild reuses detached geometry and accepted pass plan');
