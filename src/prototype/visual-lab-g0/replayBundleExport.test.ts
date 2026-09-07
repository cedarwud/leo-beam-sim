import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync } from 'fflate';

import {
  buildVisualLabReplayProvenance,
  prepareVisualLabReplayBundle,
  serializeReplayBundle,
  type VisualLabReplayBundleInput,
  type VisualLabReplayProvenanceInput,
} from './replayBundleExport';
import type { CanvasWebmCaptureResult } from '../../visualLab/export/clipCapture';

const PROVENANCE_INPUT = {
  accepted: {
    analysisRunId: 'analysis-run-7',
    frameId: 'frame-42',
    constellation: 'starlink',
    selectedTlePath: '/tle/starlink.tle',
  },
  storyId: 'inter-handover',
  runtime: 'guided' as const,
  activeStoryId: 'inter-handover',
  storySource: {
    kind: 'inter-handover' as const,
    eventId: 'event-7',
    fromSatelliteId: 'sat-a',
    toSatelliteId: 'sat-b',
  },
  comparison: {
    baseline: null,
    candidate: null,
    parameterChange: {
      key: 'beamPowerCapW',
      label: 'Power cap',
      baseline: '1.0',
      candidate: '0.5',
    },
    classification: 'causal',
    frameGate: 'available',
    evaluationGate: 'available',
  },
  guided: {
    baselineStoryRuntimeId: 'baseline-runtime',
    candidateStoryRuntimeId: 'candidate-runtime',
    annotationMode: 'annotated',
  },
};

const PROVENANCE = buildVisualLabReplayProvenance(PROVENANCE_INPUT);
const CAPTURE: CanvasWebmCaptureResult<typeof PROVENANCE> = {
  status: 'completed',
  cancelled: false,
  bytes: Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]),
  mimeType: 'video/webm;codecs=vp8',
  durationMs: 250,
  durationSec: 0.25,
  duration: 0.25,
  fps: 10,
  frameCount: 3,
  capturedDurationMs: 250,
  provenance: PROVENANCE,
};

const INPUT: VisualLabReplayBundleInput = {
  capture: CAPTURE,
  clipId: 'inter-handover',
  title: 'Inter handover',
  locale: 'en',
  theme: 'dark',
  claimBoundary: 'Archived-TLE model projection only.',
  sourceLocators: ['/tle/starlink.tle'],
};

test('replay provenance is a stable explicit data contract', () => {
  assert.deepEqual(PROVENANCE, {
    analysisRunId: 'analysis-run-7',
    frame: 'frame-42',
    story: 'inter-handover',
    runtime: 'visual-lab-guided-replay-v1',
    identityScope: 'controlled-a-b-with-accepted-handover-sequence',
    constellation: 'starlink',
    source: '/tle/starlink.tle',
    runtimeStoryId: 'inter-handover',
    handoverKind: 'inter-handover',
    eventId: 'event-7',
    fromSatelliteId: 'sat-a',
    toSatelliteId: 'sat-b',
    changedParameterKey: 'beamPowerCapW',
    changedParameterBaseline: '1.0',
    changedParameterCandidate: '0.5',
    comparisonClassification: 'causal',
    frameComparisonGate: 'available',
    evaluationComparisonGate: 'available',
    baselineStoryRuntimeId: 'baseline-runtime',
    candidateStoryRuntimeId: 'candidate-runtime',
    annotationMode: 'annotated',
  });
});

test('replay archive has the schema, WebM bytes, and provenance manifest', async () => {
  const archive = prepareVisualLabReplayBundle(INPUT);
  const entries = unzipSync(archive.zipBytes);
  const manifest = JSON.parse(new TextDecoder().decode(entries['provenance.json'])) as Record<string, unknown>;

  assert.deepEqual(Object.keys(entries).sort(), ['clip.webm', 'provenance.json']);
  assert.deepEqual(entries['clip.webm'], CAPTURE.bytes);
  assert.equal(manifest.schema, 'visual-lab-clip-archive-v1');
  assert.deepEqual(manifest.provenance, PROVENANCE);
  assert.equal((manifest.webm as Record<string, unknown>).bytes, CAPTURE.bytes.length);

  const blob = await serializeReplayBundle(INPUT);
  assert.equal(blob.type, 'application/zip');
  assert.ok(blob.size > 0);
});

test('replay archive fails closed for cancelled, empty, and incomplete captures', () => {
  assert.throws(
    () => prepareVisualLabReplayBundle({ ...INPUT, capture: { ...CAPTURE, status: 'cancelled', cancelled: true } }),
    error => error instanceof Error && error.message.includes('completed WebM capture'),
  );
  assert.throws(
    () => prepareVisualLabReplayBundle({ ...INPUT, capture: { ...CAPTURE, bytes: new Uint8Array() } }),
    error => error instanceof Error && error.message.includes('contains no bytes'),
  );
  assert.throws(
    () => buildVisualLabReplayProvenance({ ...PROVENANCE_INPUT, accepted: { ...PROVENANCE_INPUT.accepted, frameId: '' } }),
    error => error instanceof Error && error.message.includes('provenance.frame'),
  );
  assert.throws(
    () => buildVisualLabReplayProvenance({
      ...PROVENANCE_INPUT,
      runtime: 'unsupported' as VisualLabReplayProvenanceInput['runtime'],
    }),
    error => error instanceof Error && error.message.includes('unsupported replay runtime'),
  );
});
