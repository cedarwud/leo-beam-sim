#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LIVE_SIM_TIMELINE_DURATION_SEC } from '../src/app/appRuntimeConfig.ts';
import {
  clampTimelineTime,
  resolveTimelineRailDescriptor,
} from '../src/app/timelineRailAuthority.ts';
import { TimelineBar, formatTimelineTime } from '../src/ui/TimelineBar.tsx';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR_SCRIPT = 'node --import tsx/esm scripts/validate-timeline-scrubbing.tsx';
const TWO_HOUR_TIMELINE_SEC = 7200;

function readRepoFile(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function pass(label: string): void {
  console.log(`PASS: ${label}`);
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function renderTimelineBarMarkup(input?: {
  readonly currentTimeSec?: number;
  readonly durationSec?: number;
  readonly disabled?: boolean;
}): string {
  return renderToStaticMarkup(
    <TimelineBar
      currentTimeSec={input?.currentTimeSec ?? 7350.5}
      durationSec={input?.durationSec ?? TWO_HOUR_TIMELINE_SEC}
      paused={false}
      speed={10}
      onTogglePause={() => undefined}
      onSeek={() => undefined}
      onSpeedChange={() => undefined}
      disabled={input?.disabled ?? false}
      sourceOwner="live-walker"
      horizonKind="live-walker-window"
      horizonLabel="Live Walker timeline 2 h"
      horizonSec={TWO_HOUR_TIMELINE_SEC}
      claimKind="overlay-demo"
    />,
  );
}

function validatePackageScript(): void {
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['validate:timeline:scrubbing'],
    VALIDATOR_SCRIPT,
    'package.json must expose the timeline scrubbing validator',
  );
  pass('package exposes validate:timeline:scrubbing');
}

function validateTimelineClamp(): void {
  assert.equal(clampTimelineTime(-1, TWO_HOUR_TIMELINE_SEC), 0, 'negative seeks clamp to timeline start');
  assert.equal(clampTimelineTime(321.25, TWO_HOUR_TIMELINE_SEC), 321.25, 'in-range seeks pass through');
  assert.equal(clampTimelineTime(9000, TWO_HOUR_TIMELINE_SEC), TWO_HOUR_TIMELINE_SEC, 'overflow seeks clamp to duration');
  assert.equal(clampTimelineTime(Number.NaN, TWO_HOUR_TIMELINE_SEC), 0, 'NaN seek targets clamp to start');
  assert.equal(clampTimelineTime(10, Number.NaN), 0, 'NaN durations fail closed to zero');
  assert.equal(clampTimelineTime(10, -5), 0, 'negative durations fail closed to zero');
  pass('timeline clamping is bounded and fail-closed');
}

function validateTimelineAuthority(): void {
  const baseInput = {
    sceneSource: 'live-sim' as const,
    liveDurationSec: LIVE_SIM_TIMELINE_DURATION_SEC,
    liveCurrentTimeSec: 42,
    artifactDurationSec: 300,
    artifactCurrentTimeSec: 7,
    artifactHandoverEventCount: 1,
    producerTraceRange: {
      startSec: 1,
      endSec: 10,
      durationSec: 10,
      rangeLabel: '1s-10s',
    },
    producerTraceCurrentTimeSec: 4,
    producerTraceDisplayDurationSec: 60,
    producerTraceDisplayCurrentTimeSec: 24,
    bundleProvenanceKind: 'paper-faithful' as const,
  };

  const livePreview = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-live-cell-preview',
  });
  assert.equal(livePreview.timeline.sourceOwner, 'live-walker', 'MODQN live preview timeline is live Walker-owned');
  assert.equal(livePreview.timeline.durationSec, TWO_HOUR_TIMELINE_SEC, 'MODQN live preview timeline uses 7200s');
  assert.equal(livePreview.timeline.horizonKind, 'live-walker-window', 'MODQN live preview horizon is live Walker');
  assert.equal(livePreview.timeline.claimKind, 'overlay-demo', 'MODQN live preview stays overlay/demo');
  assert.equal(livePreview.timeline.axisKind, 'source-time', 'MODQN live preview timeline remains source-time');

  const proof = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-replay-proof',
  });
  assert.equal(proof.timeline.sourceOwner, 'modqn-producer-trace', 'MODQN replay proof timeline is producer-owned');
  assert.equal(proof.timeline.durationSec, 10, 'MODQN replay proof keeps the producer trace duration');
  assert.equal(proof.timeline.claimKind, 'producer-proof', 'MODQN replay proof remains producer proof');
  assert.notEqual(proof.timeline.durationSec, TWO_HOUR_TIMELINE_SEC, 'MODQN replay proof does not inherit the live Walker horizon');

  const artifact = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneSource: 'artifact-replay',
    sceneLane: 'artifact-replay',
  });
  assert.equal(artifact.timeline.sourceOwner, 'artifact-replay', 'artifact replay timeline is artifact-owned');
  assert.equal(artifact.timeline.durationSec, 300, 'artifact replay timeline uses artifact scenario duration');
  assert.equal(artifact.timeline.claimKind, 'artifact-proof', 'artifact replay timeline remains artifact proof');
  pass('timeline authority keeps live, producer, and artifact horizons separated');
}

function validateTimelineBarMarkup(): void {
  const markup = renderTimelineBarMarkup();
  assertContains(markup, 'data-testid="timeline-bar"', 'timeline bar root');
  assertContains(markup, 'data-current-time-sec="7200.000"', 'timeline current time dataset clamps to duration');
  assertContains(markup, 'data-duration-sec="7200.000"', 'timeline duration dataset');
  assertContains(markup, 'data-source-owner="live-walker"', 'timeline source owner dataset');
  assertContains(markup, 'data-horizon-kind="live-walker-window"', 'timeline horizon kind dataset');
  assertContains(markup, 'data-horizon-sec="7200.000"', 'timeline horizon seconds dataset');
  assertContains(markup, 'data-claim-kind="overlay-demo"', 'timeline claim kind dataset');
  assertContains(markup, 'data-progress-pct="100.000"', 'timeline progress dataset');
  assertContains(markup, 'data-testid="timeline-scrubber"', 'timeline scrubber test id');
  assertContains(markup, 'data-testid="timeline-jump-start"', 'jump start control test id');
  assertContains(markup, 'data-testid="timeline-jump-end"', 'jump end control test id');
  assert.equal(formatTimelineTime(TWO_HOUR_TIMELINE_SEC), '2:00:00', 'timeline formats 7200s as 2:00:00');
  pass('TimelineBar exposes source, horizon, time, and control telemetry');
}

function validateAppWiring(): void {
  const appSource = readRepoFile('src/App.tsx');
  assertContains(appSource, 'const target = clampTimelineTime(targetSec, timelineDurationSec);', 'timeline seek target clamp');
  assertContains(appSource, 'replayController?.seek(target);', 'artifact replay seek wiring');
  assertContains(appSource, 'const absoluteTargetSec = liveTimelineWindowStartSec + target;', 'live seek absolute time mapping');
  assertContains(appSource, 'setLiveTimelineSeekRequest({', 'live seek request state');
  assertContains(appSource, 'setLiveObservedHandoverRailEvents([]);', 'live seek clears observed handover rail events');
  assertContains(appSource, 'data-timeline-current-time-sec={timelineCurrentTimeSec.toFixed(3)}', 'app shell current time dataset');
  assertContains(appSource, 'data-timeline-duration-sec={timelineDurationSec.toFixed(3)}', 'app shell duration dataset');
  assertContains(appSource, 'data-timeline-source-owner={timelineRailDescriptor.timeline.sourceOwner}', 'app shell source owner dataset');
  assertContains(appSource, 'data-timeline-horizon-kind={timelineRailDescriptor.timeline.horizonKind}', 'app shell horizon kind dataset');
  assertContains(appSource, 'data-timeline-claim-kind={timelineRailDescriptor.timeline.claimKind}', 'app shell claim kind dataset');
  assertContains(appSource, 'liveTimelineSeekTargetSec: liveTimelineSeekRequest?.targetSec', 'runtime config receives live seek target');
  assertContains(appSource, 'liveTimelineSeekRequestKey: liveTimelineSeekRequest?.requestKey', 'runtime config receives live seek key');
  pass('App wires artifact seek, live seek, and app-shell timeline metadata');
}

function validateLiveSimulationResetPath(): void {
  const useSimulationSource = readRepoFile('src/scene/useSimulation.ts');
  assertContains(useSimulationSource, 'const seekToTimelineFrame = useCallback((targetSec: number) => {', 'live seek helper declaration');
  assertContains(useSimulationSource, 'const targetOffset = normalizeReplayOffset(targetSec, maxTimeSec, replay.loop);', 'live seek normalizes target');
  assertContains(useSimulationSource, 'resetAllHoManagers();', 'live seek resets primary and secondary HO managers');
  assertContains(useSimulationSource, 'resetMobilityStates();', 'live seek resets UE mobility states');
  assertContains(useSimulationSource, 'runtimeStateRef.current = createRuntimeFrameStepState(targetOffset);', 'live seek resets runtime state at target');
  assertContains(useSimulationSource, 'installDecisionOverride();', 'live seek reinstalls MODQN overlay decision override');
  assertContains(useSimulationSource, 'paused: true,', 'live seek renders a paused target frame');
  assertContains(useSimulationSource, 'publishNextFrameRef.current = true;', 'live seek forces next frame publication');
  assertContains(useSimulationSource, 'setVersion(v => v + 1);', 'live seek triggers a React update');
  assertContains(useSimulationSource, 'if (replay.seekRequestKey === undefined || replay.seekTargetSec === undefined) return;', 'live seek effect requires an explicit request');
  assertContains(useSimulationSource, 'seekToTimelineFrame(replay.seekTargetSec);', 'live seek effect dispatches the requested target');
  pass('useSimulation seek path resets state machines before rendering target frame');
}

function validateDocs(): void {
  const docsSource = readRepoFile('docs/timeline-controls-sdd.md');
  assertContains(docsSource, 'Slice T4: Final Visual QA & Telemetry Validation', 'timeline SDD keeps T4 heading');
  assertContains(docsSource, '`validate:timeline:scrubbing`', 'timeline SDD records the dedicated validator');
  assertContains(docsSource, 'app shell and TimelineBar datasets', 'timeline SDD records telemetry implementation surface');
  pass('timeline SDD records T4 validation closure');
}

validatePackageScript();
validateTimelineClamp();
validateTimelineAuthority();
validateTimelineBarMarkup();
validateAppWiring();
validateLiveSimulationResetPath();
validateDocs();
