#!/usr/bin/env node
// validate-phase-d-banner-copy.tsx
//
// PR-xi / D-S6 acceptance validator:
//   (a) ClaimBoundaryBanner source keeps the chip and adds exactly one disclaimer
//   (b) rendered branch with omitted provenance has no user-trained copy
//   (c) rendered branch with paper-faithful provenance has no user-trained copy
//   (d) rendered branch with user-trained provenance has the chip + disclaimer
//   (e) fallback branch with user-trained provenance has no chip/disclaimer
//   (f) blocked branch with user-trained provenance has no chip/disclaimer
//   (g) decideClaimBoundaryBanner contract remains unchanged
//
// Run: node --import tsx/esm scripts/validate-phase-d-banner-copy.tsx

import * as fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ClaimBoundaryBanner,
  decideClaimBoundaryBanner,
  type ClaimBoundaryBannerInput,
} from '../src/ui/ClaimBoundaryBanner';

const DISCLAIMER_TEXT =
  'User-trained MODQN replay · paperFaithful: false · do not cite as PAP-2024 baseline evidence';
const DISCLAIMER_TESTID = 'data-testid="claim-boundary-banner-user-trained-disclaimer"';
const CHIP_TESTID = 'data-testid="claim-boundary-banner-user-trained-chip"';

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

function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let index = source.indexOf(needle);
  while (index >= 0) {
    count++;
    index = source.indexOf(needle, index + needle.length);
  }
  return count;
}

function renderedFrame(): ClaimBoundaryBannerInput {
  return {
    sceneSource: 'artifact-replay',
    claimBoundary: {
      storyKind: 'modqn-handover-baseline',
      allowedClaims: ['baseline MODQN multi-UE replay artifact'],
      forbiddenClaims: ['not paper-faithful evidence'],
      // VisualShowcaseClaimBoundary gained a required `source` field; the banner
      // decision function never reads it (storyKind/allowed/forbidden only).
      source: 'phase-d-banner-copy fixture',
    },
    evidenceStatus: {
      status: 'baseline',
      notes: ['producer validated replay artifact'],
    },
    provenance: {
      producer: {
        name: 'modqn-paper-reproduction',
      },
    },
  } as ClaimBoundaryBannerInput;
}

function fallbackFrame(): ClaimBoundaryBannerInput {
  return {
    ...renderedFrame(),
    claimBoundary: {
      storyKind: 'modqn-handover-baseline',
      allowedClaims: [],
      forbiddenClaims: ['not paper-faithful evidence'],
      source: 'phase-d-banner-copy fixture',
    },
  } as ClaimBoundaryBannerInput;
}

function blockedFrame(): ClaimBoundaryBannerInput {
  const title = 'baseline MODQN multi-UE replay artifact';
  return {
    ...renderedFrame(),
    claimBoundary: {
      storyKind: 'modqn-handover-baseline',
      allowedClaims: [title],
      forbiddenClaims: [title],
    },
  } as ClaimBoundaryBannerInput;
}

function renderBanner(
  frame: ClaimBoundaryBannerInput,
  bundleProvenanceKind?: 'paper-faithful' | 'user-trained',
): string {
  return renderToString(
    <ClaimBoundaryBanner
      frame={frame}
      bundleProvenanceKind={bundleProvenanceKind}
    />,
  );
}

// ---------------------------------------------------------------------------
// (a) Source grep on ClaimBoundaryBanner.tsx
// ---------------------------------------------------------------------------
console.log('\n(a) Source grep on ClaimBoundaryBanner.tsx');
{
  const source = fs.readFileSync('src/ui/ClaimBoundaryBanner.tsx', 'utf8');
  const importLines = source
    .split('\n')
    .filter((line) => line.startsWith('import '));
  assert(
    countOccurrences(source, DISCLAIMER_TEXT) === 1,
    'source contains the literal disclaimer text exactly once',
  );
  assert(
    countOccurrences(source, DISCLAIMER_TESTID) === 1,
    'source contains the disclaimer testid exactly once',
  );
  assert(source.includes(CHIP_TESTID), 'source still contains the existing user-trained chip testid');
  assert(importLines.length === 2, 'source does not introduce any new import');
  assert(
    importLines.includes("import type { ReactElement } from 'react';") &&
      importLines.includes("import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';"),
    'source imports remain the original two type-only imports',
  );
}

// ---------------------------------------------------------------------------
// (b) SSR rendered branch, bundleProvenanceKind omitted
// ---------------------------------------------------------------------------
console.log('\n(b) SSR rendered branch, bundleProvenanceKind omitted');
{
  const html = renderBanner(renderedFrame());
  assert(html.includes('data-claim-boundary-state="rendered"'), 'SSR output is rendered');
  assert(!html.includes('claim-boundary-banner-user-trained-chip'), 'SSR output omits chip');
  assert(!html.includes('claim-boundary-banner-user-trained-disclaimer'), 'SSR output omits disclaimer testid');
  assert(!html.includes(DISCLAIMER_TEXT), 'SSR output omits disclaimer text');
}

// ---------------------------------------------------------------------------
// (c) SSR rendered branch, bundleProvenanceKind='paper-faithful'
// ---------------------------------------------------------------------------
console.log("\n(c) SSR rendered branch, bundleProvenanceKind='paper-faithful'");
{
  const html = renderBanner(renderedFrame(), 'paper-faithful');
  assert(html.includes('data-claim-boundary-state="rendered"'), 'SSR output is rendered');
  assert(!html.includes('claim-boundary-banner-user-trained-chip'), 'SSR output omits chip');
  assert(!html.includes('claim-boundary-banner-user-trained-disclaimer'), 'SSR output omits disclaimer testid');
}

// ---------------------------------------------------------------------------
// (d) SSR rendered branch, bundleProvenanceKind='user-trained'
// ---------------------------------------------------------------------------
console.log("\n(d) SSR rendered branch, bundleProvenanceKind='user-trained'");
{
  const html = renderBanner(renderedFrame(), 'user-trained');
  assert(html.includes('data-claim-boundary-state="rendered"'), 'SSR output is rendered');
  assert(html.includes('claim-boundary-banner-user-trained-chip'), 'SSR output includes chip');
  assert(html.includes('claim-boundary-banner-user-trained-disclaimer'), 'SSR output includes disclaimer testid');
  assert(html.includes(DISCLAIMER_TEXT), 'SSR output includes exact disclaimer text');
}

// ---------------------------------------------------------------------------
// (e) SSR fallback branch, bundleProvenanceKind='user-trained'
// ---------------------------------------------------------------------------
console.log("\n(e) SSR fallback branch, bundleProvenanceKind='user-trained'");
{
  const html = renderBanner(fallbackFrame(), 'user-trained');
  assert(html.includes('data-claim-boundary-state="fallback"'), 'SSR output is fallback');
  assert(!html.includes('claim-boundary-banner-user-trained-chip'), 'SSR output omits chip');
  assert(!html.includes('claim-boundary-banner-user-trained-disclaimer'), 'SSR output omits disclaimer testid');
}

// ---------------------------------------------------------------------------
// (f) SSR blocked branch, bundleProvenanceKind='user-trained'
// ---------------------------------------------------------------------------
console.log("\n(f) SSR blocked branch, bundleProvenanceKind='user-trained'");
{
  const html = renderBanner(blockedFrame(), 'user-trained');
  assert(html.includes('data-claim-boundary-state="blocked"'), 'SSR output is blocked');
  assert(!html.includes('claim-boundary-banner-user-trained-chip'), 'SSR output omits chip');
  assert(!html.includes('claim-boundary-banner-user-trained-disclaimer'), 'SSR output omits disclaimer testid');
}

// ---------------------------------------------------------------------------
// (g) D8 contract regression: decideClaimBoundaryBanner output kind unchanged
// ---------------------------------------------------------------------------
console.log('\n(g) D8 contract regression');
{
  assert(
    decideClaimBoundaryBanner(renderedFrame()).kind === 'rendered',
    'rendered input still decides rendered',
  );
  assert(
    decideClaimBoundaryBanner(fallbackFrame()).kind === 'fallback',
    'fallback input still decides fallback',
  );
  assert(
    decideClaimBoundaryBanner(blockedFrame()).kind === 'blocked',
    'blocked input still decides blocked',
  );
}

console.log(`\n[validate-phase-d-banner-copy] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
