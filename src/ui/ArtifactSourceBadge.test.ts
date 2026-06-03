#!/usr/bin/env node

/**
 * Unit coverage for the FIX-1 honesty decision `decideArtifactSourceBadge`.
 * Pure (no React) → runs under tsx:
 *   node --import tsx/esm src/ui/ArtifactSourceBadge.test.ts
 *
 * Provenance audit 2026-06-04 gap: the badge gate was previously backed only by
 * a string-grep governance assertion; the decision logic had no unit test. This
 * locks the silent-vs-loud contract so a regression cannot let a non-producer
 * source slip past the honesty surface (or, conversely, badge the real producer).
 */

import {
  decideArtifactSourceBadge,
  PRODUCER_PINNED_SOURCE,
  SYNTHETIC_FIXTURE_SOURCE,
  HEADER_ABSENT_SOURCE,
} from './ArtifactSourceBadge';

let passed = 0;

function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}

function assertTrue(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
}

// ── Silent paths: the real producer source and the loading/failed-closed null ──

check('null (loading / failed closed) → silent', () => {
  const d = decideArtifactSourceBadge(null);
  assertTrue(d.show === false, 'null must not show the badge');
});

check('producer-pinned → silent (the real producer source is never badged)', () => {
  const d = decideArtifactSourceBadge(PRODUCER_PINNED_SOURCE);
  assertTrue(d.show === false, 'producer-pinned must not show the badge');
});

// ── Loud paths: every non-producer / unverified source trips the honesty surface ──

check('synthetic-fixture-fallback → loud, named "synthetic"', () => {
  const d = decideArtifactSourceBadge(SYNTHETIC_FIXTURE_SOURCE);
  assertTrue(d.show === true, 'synthetic fixture must show the badge');
  assertTrue(d.show === true && /synthetic fixture/i.test(d.label), 'label calls out the synthetic fixture');
  assertTrue(d.show === true && /not producer data/i.test(d.label), 'label states it is not producer data');
});

check('header-absent → loud, reported as unknown/unverified (not "synthetic")', () => {
  const d = decideArtifactSourceBadge(HEADER_ABSENT_SOURCE);
  assertTrue(d.show === true, 'header-absent must show the badge');
  assertTrue(d.show === true && /unknown artifact source/i.test(d.label), 'label says unknown source');
  // Must NOT overclaim it as the synthetic fixture (the FIX-1 source-aware copy rule).
  assertTrue(d.show === true && !/synthetic/i.test(d.label), 'header-absent is not mislabeled "synthetic"');
});

check('unknown source string → loud, echoes the source, never overclaims', () => {
  const d = decideArtifactSourceBadge('external-artifact-path');
  assertTrue(d.show === true, 'unknown source must show the badge');
  assertTrue(d.show === true && /external-artifact-path/.test(d.label), 'label echoes the unknown source token');
  assertTrue(d.show === true && !/synthetic/i.test(d.label), 'unknown source is not mislabeled "synthetic"');
});

check('every loud decision carries a non-empty detail line', () => {
  for (const src of [SYNTHETIC_FIXTURE_SOURCE, HEADER_ABSENT_SOURCE, 'external-artifact-path']) {
    const d = decideArtifactSourceBadge(src);
    assertTrue(d.show === true && d.detail.length > 0, `${src} carries a detail line`);
  }
});

console.log(`\n[ArtifactSourceBadge] ${passed} passed`);
