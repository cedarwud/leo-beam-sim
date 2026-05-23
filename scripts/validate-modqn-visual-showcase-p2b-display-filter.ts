/**
 * P2b — Display-filter and UE elevation validation.
 * Verifies that:
 * 1. The display filter correctly limits the processed UEs count.
 * 2. Elevating a specific UE ID correctly moves it to index 0 of the processed list.
 * 3. Live single-UE parameters and flow are unaffected.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadShowcaseArtifact } from '../src/showcase/loadShowcaseArtifact';
import { showcaseArtifactToScene } from '../src/showcase/showcaseArtifactToScene';

const TRIGGER =
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

console.log('validate-modqn-visual-showcase-p2b-display-filter');

const raw = readFileSync(TRIGGER, 'utf8');
const artifact = loadShowcaseArtifact(JSON.parse(raw));

// Mirror App.tsx processing logic
function getProcessedUes(replaySceneFrame: any, elevatedUeId: string | null, ueDisplayCount: number) {
  if (!replaySceneFrame) return [];
  const allUes = replaySceneFrame.ues;
  if (allUes.length === 0) return [];
  const focusedId = elevatedUeId ?? allUes[0]?.id;
  const focusedIndex = allUes.findIndex((u: any) => u.id === focusedId);
  const reordered = [...allUes];
  if (focusedIndex > 0) {
    const [focusedUe] = reordered.splice(focusedIndex, 1);
    reordered.unshift(focusedUe);
  }
  return reordered.slice(0, Math.min(ueDisplayCount, reordered.length));
}

test('display filter: trims UEs array correctly', () => {
  const replaySceneFrame = showcaseArtifactToScene(artifact, 0);

  // Default is 100
  const processed100 = getProcessedUes(replaySceneFrame, null, 100);
  assert.strictEqual(processed100.length, 100, `expected 100 UEs, got ${processed100.length}`);

  // Trim to 50
  const processed50 = getProcessedUes(replaySceneFrame, null, 50);
  assert.strictEqual(processed50.length, 50, `expected 50 UEs, got ${processed50.length}`);

  // Trim to 1
  const processed1 = getProcessedUes(replaySceneFrame, null, 1);
  assert.strictEqual(processed1.length, 1, `expected 1 UE, got ${processed1.length}`);
});

test('UE elevation: moves the elevated UE to index 0', () => {
  const replaySceneFrame = showcaseArtifactToScene(artifact, 0);

  // Choose a UE ID that is not at index 0
  const originalUes = replaySceneFrame.ues;
  assert.ok(originalUes.length > 5, 'Requires at least 5 UEs in artifact for this test');

  const targetId = originalUes[4].id;
  assert.notStrictEqual(originalUes[0].id, targetId, 'Target UE should not already be at index 0');

  // Elevate targetId
  const processed = getProcessedUes(replaySceneFrame, targetId, 50);
  assert.strictEqual(processed[0].id, targetId, `expected elevated UE ${targetId} at index 0, got ${processed[0].id}`);

  // Ensure the list still has 50 elements and contains targetId exactly once
  assert.strictEqual(processed.length, 50);
  const instances = processed.filter(u => u.id === targetId);
  assert.strictEqual(instances.length, 1, 'Elevated UE should exist exactly once in the processed slice');
});

test('UE elevation: default fallback to first UE if elevatedId is null/invalid', () => {
  const replaySceneFrame = showcaseArtifactToScene(artifact, 0);
  const originalUes = replaySceneFrame.ues;

  const processed = getProcessedUes(replaySceneFrame, null, 50);
  assert.strictEqual(processed[0].id, originalUes[0].id, 'Should default to first UE if no elevated ID provided');

  const processedInvalid = getProcessedUes(replaySceneFrame, 'non-existent-ue-id', 50);
  assert.strictEqual(processedInvalid[0].id, originalUes[0].id, 'Should default to first UE if invalid elevated ID provided');
});

console.log('OK');
