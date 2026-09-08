#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  HANDOVER_RAIL_FOCUS_DISPLAY_SEC,
  HandoverEventRail,
  deriveHandoverRailSlowMotionFocus,
  type HandoverRailEvent,
} from '../src/ui/HandoverEventRail.tsx';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-live-walker-handover-event-focus.tsx';
const BROWSER_VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-live-walker-handover-event-focus-browser.ts';
const LIVE_DURATION_SEC = 7200;
const FOCUSED_CLUSTER_ID = 'cluster-20_000_intra';

function readRepoFile(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function assertContains(text: string, expected: string, label: string): void {
  assert.ok(text.includes(expected), `${label} missing ${expected}`);
}

function assertNotContains(text: string, unexpected: string, label: string): void {
  assert.ok(!text.includes(unexpected), `${label} unexpectedly contains ${unexpected}`);
}

function liveWalkerEvents(): readonly HandoverRailEvent[] {
  return [
    {
      id: 'live-intra-20',
      timeSec: 20,
      sourceTimeSec: 20,
      clickTargetSec: 20,
      kind: 'intra',
      title: 'INTRA handover',
      fromLabel: 'sat-a/B1',
      toLabel: 'sat-a/B2',
      detail: 'primary-ue-only; not-100-ue-aggregate',
      source: 'live-walker',
      count: 1,
    },
    {
      id: 'live-inter-45',
      timeSec: 45,
      sourceTimeSec: 45,
      clickTargetSec: 45,
      kind: 'inter',
      title: 'INTER handover',
      fromLabel: 'sat-a/B2',
      toLabel: 'sat-b/B4',
      detail: 'primary-ue-only; not-100-ue-aggregate',
      source: 'live-walker',
      count: 1,
    },
  ];
}

function renderRail(input?: {
  readonly sourceOwner?: 'live-walker' | 'sinr-live-cell-truth';
  readonly horizonKind?: 'live-walker-window' | 'producer-trace';
  readonly claimKind?: 'live-truth' | 'overlay-demo' | 'producer-proof';
  readonly durationSec?: number;
}): string {
  const sourceOwner = input?.sourceOwner ?? 'live-walker';
  const horizonKind = input?.horizonKind ?? 'live-walker-window';
  const claimKind = input?.claimKind ?? 'overlay-demo';
  const durationSec = input?.durationSec ?? LIVE_DURATION_SEC;
  const isSinrCellTruth = sourceOwner === 'sinr-live-cell-truth';
  return renderToStaticMarkup(
    <HandoverEventRail
      events={liveWalkerEvents()}
      currentTimeSec={20}
      durationSec={durationSec}
      onSeek={() => undefined}
      disabled={false}
      sourceLabel={
        isSinrCellTruth
          ? 'sinrLiveCells event index - cell truth'
          : sourceOwner === 'live-walker'
            ? 'MODQN overlay on live Walker - demo'
          : 'Live Walker timeline'
      }
      sourceOwner={sourceOwner}
      horizonKind={horizonKind}
      horizonLabel={
        'Live Walker timeline 2 h'
      }
      claimKind={claimKind}
      sourceStartSec={0}
      sourceEndSec={durationSec}
      axisKind="source-time"
      axisLabel="source time axis"
      axisDurationSec={durationSec}
      axisCurrentTimeSec={20}
      initialFocusedEventId={FOCUSED_CLUSTER_ID}
    />,
  );
}

function validatePackageScript(): void {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['validate:live-walker:handover-event-focus'],
    VALIDATOR_SCRIPT,
    'package.json must expose the live Walker handover event focus validator',
  );
  assert.equal(
    packageJson.scripts?.['validate:live-walker:handover-event-focus:browser'],
    BROWSER_VALIDATOR_SCRIPT,
    'package.json must expose the live Walker handover event focus browser validator',
  );
  console.log('PASS: package exposes validate:live-walker:handover-event-focus');
}

function validateFocusMath(): void {
  const focus = deriveHandoverRailSlowMotionFocus({
    eventId: FOCUSED_CLUSTER_ID,
    eventTimeSec: 20,
    clickTargetSec: 20,
    currentTimeSec: 20,
    durationSec: LIVE_DURATION_SEC,
  });
  assert.ok(focus, 'expected focus math for valid live event');
  assert.equal(focus.sourceStartSec, 10, 'focus source window starts 10s before event');
  assert.equal(focus.sourceEndSec, 40, 'focus source window ends 20s after event');
  assert.equal(focus.sourceDurationSec, 30, 'focus source window spans 30 source seconds');
  assert.equal(focus.displayDurationSec, HANDOVER_RAIL_FOCUS_DISPLAY_SEC, 'focus display lens is 60s');
  assert.equal(focus.displayCurrentSec, 20, 'event-at-window+10s maps to 20s on the 60s display lens');
  assert.equal(focus.clickTargetSec, 20, 'focus click target remains source seconds');
  assert.equal(focus.axisKind, 'display-stretched', 'focus uses a display-stretched axis');

  const edgeFocus = deriveHandoverRailSlowMotionFocus({
    eventId: 'edge',
    eventTimeSec: 3,
    clickTargetSec: 3,
    currentTimeSec: 0,
    durationSec: LIVE_DURATION_SEC,
  });
  assert.ok(edgeFocus, 'expected edge focus math');
  assert.equal(edgeFocus.sourceStartSec, 0, 'edge focus clamps source start to zero');
  assert.equal(edgeFocus.sourceEndSec, 23, 'edge focus keeps the source trail');
  console.log('PASS: slow-motion focus derives source and display axes separately');
}

function validateLiveWalkerFocusMarkup(): void {
  const markup = renderRail();
  assertContains(markup, 'data-focus-enabled="true"', 'live Walker rail root');
  assertContains(markup, 'data-focus-open="true"', 'live Walker rail root');
  assertContains(markup, 'data-focus-axis-kind="display-stretched"', 'live Walker rail root');
  assertContains(markup, 'data-focus-source-start-sec="10.000"', 'live Walker rail root');
  assertContains(markup, 'data-focus-source-end-sec="40.000"', 'live Walker rail root');
  assertContains(markup, 'data-focus-display-sec="60.000"', 'live Walker rail root');
  assertContains(markup, 'data-focus-click-target-sec="20.000"', 'live Walker rail root');
  assertContains(markup, 'data-axis-kind="source-time"', 'master rail axis');
  assertContains(markup, 'data-testid="handover-event-slow-focus"', 'slow focus panel');
  assertContains(markup, 'data-axis-kind="display-stretched"', 'slow focus panel');
  assertContains(markup, 'data-display-current-sec="20.000"', 'slow focus display cursor');
  assertContains(markup, 'data-click-target-sec="20.000"', 'slow focus source click target');
  assertContains(markup, 'data-testid="handover-event-slow-focus-seek"', 'slow focus seek button');
  assertContains(markup, 'data-selected="true"', 'selected marker/list telemetry');
  console.log('PASS: live Walker rail opens source-backed slow-motion focus panel');
}

function validateSinrCellTruthFocusMarkup(): void {
  const markup = renderRail({
    sourceOwner: 'sinr-live-cell-truth',
    horizonKind: 'live-walker-window',
    claimKind: 'live-truth',
  });
  assertContains(markup, 'data-focus-enabled="true"', 'SINR cell-truth rail root');
  assertContains(markup, 'data-focus-open="true"', 'SINR cell-truth rail root');
  assertContains(markup, 'data-source-owner="sinr-live-cell-truth"', 'SINR cell-truth rail source telemetry');
  assertContains(markup, 'data-claim-kind="live-truth"', 'SINR cell-truth rail claim telemetry');
  assertContains(markup, 'data-focus-axis-kind="display-stretched"', 'SINR cell-truth rail root');
  assertContains(markup, 'data-testid="handover-event-slow-focus"', 'SINR cell-truth slow focus panel');
  console.log('PASS: SINR cell-truth rail can open the live-window slow-motion focus panel');
}

function validateStaticBoundaries(): void {
  const railSource = readRepoFile('src/ui/HandoverEventRail.tsx');
  const sddSource = readRepoFile('docs/live-walker-handover-event-map-sdd.md');
  assertContains(
    railSource,
    "sourceOwner === 'live-walker'",
    'rail live Walker source boundary',
  );
  assertContains(
    railSource,
    "sourceOwner === 'sinr-live-cell-truth'",
    'rail SINR cell-truth source boundary',
  );
  assertContains(
    railSource,
    "horizonKind === 'live-walker-window'",
    'rail live-window horizon boundary',
  );
  assertContains(railSource, 'setFocusedEventId(cluster.id)', 'rail marker selection');
  assertContains(railSource, 'onClick={() => selectClusterAndSeek(cluster)}', 'rail click handler');
  assertContains(railSource, 'data-focus-axis-kind={slowMotionFocus?.axisKind ?? \'\'}', 'root focus axis telemetry');
  assertContains(railSource, 'data-click-target-sec={slowMotionFocus.clickTargetSec.toFixed(3)}', 'focus click target telemetry');
  assertContains(sddSource, 'Slow motion is a display lens, not a new source horizon.', 'source policy SDD');
  assertContains(sddSource, 'bottom timeline seek target is always `sourceTimeSec`', 'source seek SDD');
  const appSource = readRepoFile('src/App.tsx');
  assertContains(
    appSource,
    "timelineRailDescriptor.rail.sourceOwner === 'live-walker'",
    'App live Walker rail seek source-owner guard',
  );
  assertContains(
    appSource,
    "timelineRailDescriptor.rail.sourceOwner === 'sinr-live-cell-truth'",
    'App SINR cell-truth rail seek source-owner guard',
  );
  assertContains(
    appSource,
    "timelineRailDescriptor.rail.horizonKind === 'live-walker-window'",
    'App live-window rail seek horizon guard',
  );
  // Removed source-text pin: an internal React setter call does not protect source-time seek behavior.
  console.log('PASS: static source-time and live-window focus boundaries are present');
}

validatePackageScript();
validateFocusMath();
validateLiveWalkerFocusMarkup();
validateSinrCellTruthFocusMarkup();
validateStaticBoundaries();
