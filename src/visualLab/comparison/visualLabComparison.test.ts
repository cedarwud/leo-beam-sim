import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../simulator/analysis';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import {
  captureComparisonEvidence,
  buildComparisonView,
} from './visualLabComparison';
import { adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot } from '../../prototype/visual-lab-g0/visualLabCanonicalSnapshotAdapter';
import type { AcceptedEvidenceView, PresentationView } from '../session/visualLabSession';
import { DEFAULT_VISUAL_LAB_PRESENTATION_STATE } from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, '2026-08-08T12:00:00.000Z', fetchFromPublic);
const frame = buildSimulationAnalysisFrame(
  createSimulatorTleState(selection, '2026-08-08T12:00:00.000Z'),
  DEFAULT_SIMULATOR_PARAMETERS,
);

const accepted = {
  identity: {
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    runId: 'run-a',
    analysisRunId: 'analysis-a',
    geometryRunId: 'geometry-a',
    instantUtc: frame.instantUtc,
    instantTaipei: frame.instantTaipei,
    tleEpochUtc: frame.tleEpochUtc,
    constellation: frame.provenance.constellation,
    archiveId: frame.provenance.archiveId,
    archiveDate: frame.provenance.archiveDate,
    selectedSatelliteId: frame.selectedSatelliteId,
    candidateSatelliteId: frame.candidateComparison.satelliteId,
    selectedTlePath: frame.provenance.selectedTlePath,
    sourceKind: frame.provenance.sourceKind,
    propagationModel: frame.provenance.propagationModel,
    contractVersion: frame.contractVersion,
  },
  frameId: frame.frameId,
  tleFrameId: frame.tleFrameId,
  runId: 'run-a',
  analysisRunId: 'analysis-a',
  geometryRunId: 'geometry-a',
  instantUtc: frame.instantUtc,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
  frameOptions: { userPositionOverridesKm: [] },
  canonical: adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot({ frame, evaluation: null }),
  timeline: null,
  global: null,
  local: null,
  runReady: false,
} as unknown as AcceptedEvidenceView;

const presentation = Object.freeze({
  ...DEFAULT_VISUAL_LAB_PRESENTATION_STATE,
  view: 'earth' as const,
  density: 'context' as const,
  focus: 'none' as const,
}) satisfies PresentationView;

const baseline = captureComparisonEvidence({
  accepted,
  parameters: accepted.parameters!,
  frameOptions: accepted.frameOptions!,
  presentation,
  runEvaluation: null,
});

const changedCanonical = {
  ...baseline.canonical,
  throughput: {
    ...baseline.canonical.throughput,
    servingRateBps: (baseline.canonical.throughput.servingRateBps ?? 0) + 1,
    totalRateBps: (baseline.canonical.throughput.totalRateBps ?? 0) + 1,
  },
  power: {
    ...baseline.canonical.power,
    systemPowerW: (baseline.canonical.power.systemPowerW ?? 0) + 1,
  },
};
const changedCandidate = {
  ...baseline,
  frameId: 'frame-b',
  identity: { ...baseline.identity, frameId: 'frame-b' },
  parameters: { ...baseline.parameters, etaMax: baseline.parameters.etaMax + 0.01 },
  canonical: changedCanonical,
};

const causal = buildComparisonView(baseline, changedCandidate);
assert.equal(causal.frame.availability, 'available');
assert.equal(causal.classification, 'causal');
assert.deepEqual(causal.changedParameterKeys, ['etaMax']);
assert.equal(causal.frame.deltas.systemPowerW.delta, 1);
assert.equal(causal.evaluation.availability, 'unavailable');
assert.match(causal.evaluation.reason ?? '', /complete accepted evaluation/);

const exploratory = buildComparisonView(baseline, {
  ...changedCandidate,
  parameters: { ...changedCandidate.parameters, rfcPowerW: changedCandidate.parameters.rfcPowerW + 0.1 },
});
assert.equal(exploratory.classification, 'exploratory');
assert.deepEqual(exploratory.changedParameterKeys, ['etaMax', 'rfcPowerW']);

const sourceMismatch = buildComparisonView(baseline, {
  ...changedCandidate,
  identity: { ...changedCandidate.identity, instantUtc: '2026-08-08T12:00:30.000Z' },
});
assert.equal(sourceMismatch.availability, 'unavailable');
assert.equal(sourceMismatch.gates.instantUtc.status, 'mismatch');
assert.equal(sourceMismatch.frame.deltas.systemPowerW.delta, 1, 'raw frame deltas stay inspectable for a failed gate');

const identical = buildComparisonView(baseline, {
  ...baseline,
  frameId: 'frame-same-copy',
  identity: { ...baseline.identity, frameId: 'frame-same-copy' },
});
assert.equal(identical.classification, 'identical');
assert.deepEqual(identical.changedParameterKeys, []);
assert.equal(identical.frame.deltas.systemPowerW.delta, 0);

console.log('visual-lab comparison seam passed');
