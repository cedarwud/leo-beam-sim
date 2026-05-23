/**
 * Test: loadShowcaseArtifact schema gate.
 *
 * Verifies:
 *   - Valid artifact loads (drives the trigger artifact at the SDD-specified path).
 *   - Wrong schemaVersion throws.
 *   - Missing provenance.claimBoundary throws.
 *   - Any timeline frame with absent handoverState.kind throws.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ShowcaseLoadError,
  loadShowcaseArtifact,
} from '../src/showcase/loadShowcaseArtifact';

const TRIGGER_ARTIFACT_PATH =
  '/home/u24/papers/modqn-paper-reproduction/artifacts/phase-01h-mp5-visual-showcase-cli-smoke-2026-05-22/visual-showcase-v1.json';

function test(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (err) {
    console.error(`  FAIL  ${label}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('validate-modqn-visual-showcase-p1ab-load-showcase-artifact');

const triggerRaw = readFileSync(TRIGGER_ARTIFACT_PATH, 'utf8');
const triggerJson = JSON.parse(triggerRaw) as unknown;

test('trigger artifact loads cleanly', () => {
  const a = loadShowcaseArtifact(triggerJson);
  assert.strictEqual(a.schemaVersion, 'visual-showcase-v1');
  assert.strictEqual(a.scenario.profile, 'modqn-multi-ue');
  assert.strictEqual(a.timeline.length, 61);
  assert.strictEqual(a.entities.satellites.length, 4);
  assert.strictEqual(a.entities.ues.length, 100);
  assert.strictEqual(a.entities.beams.length, 28);
  assert.strictEqual(a.truthOwnership.sinr.channelMetricKind, 'snr-no-interference');
});

test('wrong schemaVersion throws ShowcaseLoadError(schema-version)', () => {
  const bad = { ...(triggerJson as Record<string, unknown>), schemaVersion: 'v0-wrong' };
  try {
    loadShowcaseArtifact(bad);
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof ShowcaseLoadError);
    assert.strictEqual((err as ShowcaseLoadError).kind, 'schema-version');
  }
});

test('missing provenance.claimBoundary throws', () => {
  const obj = JSON.parse(triggerRaw) as Record<string, unknown>;
  const prov = obj.provenance as Record<string, unknown>;
  delete prov.claimBoundary;
  try {
    loadShowcaseArtifact(obj);
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof ShowcaseLoadError);
    assert.strictEqual((err as ShowcaseLoadError).kind, 'claim-boundary-missing');
  }
});

test('timeline[0].handoverState.kind undefined throws (Q5)', () => {
  const obj = JSON.parse(triggerRaw) as { timeline: Array<{ handoverState: { kind?: unknown } }> };
  delete obj.timeline[0].handoverState.kind;
  try {
    loadShowcaseArtifact(obj as unknown);
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof ShowcaseLoadError);
    assert.strictEqual((err as ShowcaseLoadError).kind, 'handover-kind-absent');
  }
});

test('non-object root throws shape-invalid', () => {
  try {
    loadShowcaseArtifact(null);
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof ShowcaseLoadError);
    assert.strictEqual((err as ShowcaseLoadError).kind, 'shape-invalid');
  }
});

test('unknown channelMetricKind throws', () => {
  const obj = JSON.parse(triggerRaw) as {
    truthOwnership: { sinr: { channelMetricKind: string } };
  };
  obj.truthOwnership.sinr.channelMetricKind = 'made-up-kind';
  try {
    loadShowcaseArtifact(obj as unknown);
    assert.fail('expected throw');
  } catch (err) {
    assert.ok(err instanceof ShowcaseLoadError);
    assert.strictEqual((err as ShowcaseLoadError).kind, 'channel-metric-kind-unknown');
  }
});

console.log('OK');
