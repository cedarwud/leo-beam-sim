#!/usr/bin/env node
// validate-phase-d-user-trained-mode.tsx
//
// PR-kappa / D-S2 acceptance validator:
//   (a) replay-state exports user-trained constants and widened load options
//   (b) playback-shell imports user-trained constants and switches by modeKey
//   (c) user-trained envelope accepts non-7beam shape
//   (d) 7-beam strict row-count gate remains active
//   (e) user-trained sourcePath prefix gate fail-closes
//   (f) user-trained envelope builds a valid playback shell model
//   (g) synthetic user-trained shell validation accepts/fails expected shapes
//   (h) fallback 7-beam shell model still validates
//
// Run: node --import tsx/esm scripts/validate-phase-d-user-trained-mode.tsx

import * as fs from 'node:fs';
import {
  MODQN_USER_TRAINED_EVIDENCE_STATUS,
  MODQN_USER_TRAINED_MODE_KEY,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  createModqnReplayEnvelopeFromContents,
} from '../src/modqn/replay-bundle/replay-state';
import {
  createModqnReplayPlaybackShellModel,
  getModqnReplayPlaybackFallbackShellModel,
  getModqnReplayPlaybackModelValidationIssue,
  type ModqnReplayPlaybackShellModel,
} from '../src/modqn/replay-bundle/playback-shell';
import type {
  ModqnBeamReference,
  ModqnHandoverEventKind,
} from '../src/modqn/replay-bundle/types';

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

function assertThrows(
  label: string,
  action: () => unknown,
  predicate: (error: Error) => boolean,
): void {
  try {
    action();
    fail(label, 'did not throw');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    assert(predicate(err), label, err.message);
  }
}

function beamReference(
  satIndex: number,
  localBeamIndex: number,
  beamCountPerSat: number,
): ModqnBeamReference {
  const satId = `sat-${satIndex}`;
  const beamIndex = (satIndex * beamCountPerSat) + localBeamIndex;
  return {
    beamId: `${satId}-beam-${localBeamIndex}`,
    beamIndex,
    satId,
    satIndex,
    localBeamIndex,
    validUnderDecisionMask: true,
    validUnderPostStepMask: true,
  };
}

function beamCatalog(satCount: number, beamCountPerSat: number): ModqnBeamReference[] {
  const beams = [];
  for (let satIndex = 0; satIndex < satCount; satIndex++) {
    for (let localBeamIndex = 0; localBeamIndex < beamCountPerSat; localBeamIndex++) {
      beams.push(beamReference(satIndex, localBeamIndex, beamCountPerSat));
    }
  }
  return beams;
}

function buildBundleSurfaces(params: {
  readonly sourcePath: string;
  readonly rowCount: number;
  readonly slotCount: number;
  readonly satCount: number;
  readonly beamCountPerSat: number;
  readonly intraCount: number;
}): Readonly<{
  sourcePath: string;
  manifestJson: string;
  provenanceMapJson: string;
  timelineJsonl: string;
  evaluationSummaryJson: string;
}> {
  const beams = beamCatalog(params.satCount, params.beamCountPerSat);
  const masks = Array.from({ length: beams.length }, () => true);
  const zeros = Array.from({ length: beams.length }, () => 0);
  const satellites = Array.from({ length: params.satCount }, (_value, satIndex) => ({
    satId: `sat-${satIndex}`,
    satIndex,
  }));
  const rows = [];

  for (let rowIndex = 0; rowIndex < params.rowCount; rowIndex++) {
    const slotIndex = (rowIndex % params.slotCount) + 1;
    const isIntra = rowIndex < params.intraCount;
    const previousServing = beamReference(0, 0, params.beamCountPerSat);
    const selectedServing = isIntra
      ? beamReference(0, 1, params.beamCountPerSat)
      : previousServing;
    rows.push(JSON.stringify({
      slotIndex,
      timeSec: rowIndex,
      decisionTimeSec: rowIndex,
      userId: `user-${rowIndex % 3}`,
      userIndex: rowIndex % 3,
      userPosition: { xKm: rowIndex, yKm: 0, zKm: 0 },
      decisionUserPosition: { xKm: rowIndex, yKm: 0, zKm: 0 },
      previousServing,
      selectedServing,
      handoverEvent: {
        kind: isIntra ? 'intra-satellite-beam-switch' : 'none',
        eventId: isIntra ? `evt-${rowIndex}` : null,
      },
      beamCatalogOrder: 'satellite-major-beam-minor',
      visibilityMask: masks,
      actionValidityMask: masks,
      decisionVisibilityMask: masks,
      decisionActionValidityMask: masks,
      beamLoads: zeros,
      beamThroughputs: zeros,
      rewardVector: {
        r1Throughput: 0,
        r2Handover: isIntra ? -1 : 0,
        r3LoadBalance: 0,
      },
      scalarReward: isIntra ? -1 : 0,
      satelliteStates: satellites,
      beamStates: beams,
      kpiOverlay: {},
    }));
  }

  return {
    sourcePath: params.sourcePath,
    manifestJson: JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      paperId: 'PAP-2024-MORL-MULTIBEAM',
      baselineSurface: {
        satelliteCount: params.satCount,
        beamCountPerSatellite: params.beamCountPerSat,
        totalBeamCount: params.satCount * params.beamCountPerSat,
        episodesCompleted: 1,
      },
      claimBoundary: {
        notFullPaperFaithfulReproduction: true,
        not19Or37BeamTrainedEvidence: true,
      },
      beamCatalogOrder: 'satellite-major-beam-minor',
      replaySummary: {
        rowCount: params.rowCount,
        slotCount: params.slotCount,
      },
    }),
    provenanceMapJson: JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      fields: {},
    }),
    timelineJsonl: rows.join('\n'),
    evaluationSummaryJson: JSON.stringify({
      bundle_schema_version: 'phase-03a-replay-bundle-v1',
      paper_id: 'PAP-2024-MORL-MULTIBEAM',
    }),
  };
}

function eventCounts(
  none: number,
  intra: number,
  inter: number,
): Readonly<Record<ModqnHandoverEventKind, number>> {
  return {
    none,
    'intra-satellite-beam-switch': intra,
    'inter-satellite-handover': inter,
  };
}

function syntheticUserTrainedShell(
  overrides: Partial<ModqnReplayPlaybackShellModel> = {},
): ModqnReplayPlaybackShellModel {
  const previousServing = beamReference(0, 0, 4);
  const selectedServing = beamReference(0, 1, 4);
  const slots: ModqnReplayPlaybackShellModel['slots'] = [1, 2].map(slotIndex => ({
    slotIndex,
    sourceRowStartIndex: (slotIndex - 1) * 5,
    sourceRowEndIndex: (slotIndex * 5) - 1,
    rowCount: 5,
    eventCounts: slotIndex === 1 ? eventCounts(3, 2, 0) : eventCounts(5, 0, 0),
    focusRow: {
      sourceRowIndex: (slotIndex - 1) * 5,
      slotRowIndex: 0,
      userId: 'user-0',
      userIndex: 0,
      timeSec: slotIndex,
      decisionTimeSec: slotIndex - 1,
      previousServing,
      selectedServing,
      handoverEventKind: 'intra-satellite-beam-switch',
      scalarReward: 0,
      rewardVector: {},
      diagnosticsStatus: 'missing-from-producer',
      availableActionCount: null,
    },
  }));

  return {
    modeKey: MODQN_USER_TRAINED_MODE_KEY,
    modeLabel: 'MODQN user-trained replay',
    evidenceStatus: MODQN_USER_TRAINED_EVIDENCE_STATUS,
    sourceOwner: 'modqn-paper-reproduction',
    sourcePath: 'user-trained:synthetic',
    stepKind: 'source-slot',
    rowCount: 10,
    slotCount: 2,
    eventCounts: eventCounts(8, 2, 0),
    diagnosticsStatus: 'missing-from-producer',
    slots,
    ...overrides,
  };
}

const replayStateSource = fs.readFileSync('src/modqn/replay-bundle/replay-state.ts', 'utf8');
const playbackShellSource = fs.readFileSync('src/modqn/replay-bundle/playback-shell.ts', 'utf8');

// ---------------------------------------------------------------------------
// (a) Source grep: replay-state user-trained constants + widened options
// ---------------------------------------------------------------------------
console.log('\n(a) replay-state source wiring');
{
  assert(
    /export\s+const\s+MODQN_USER_TRAINED_MODE_KEY\s*=\s*'modqn-user-trained'/.test(replayStateSource),
    "exports MODQN_USER_TRAINED_MODE_KEY = 'modqn-user-trained'",
  );
  assert(
    /export\s+const\s+MODQN_USER_TRAINED_MODE_LABEL\s*=\s*'MODQN user-trained replay'/.test(replayStateSource),
    "exports MODQN_USER_TRAINED_MODE_LABEL = 'MODQN user-trained replay'",
  );
  assert(
    /export\s+const\s+MODQN_USER_TRAINED_EVIDENCE_STATUS\s*=\s*'user-trained'/.test(replayStateSource),
    "exports MODQN_USER_TRAINED_EVIDENCE_STATUS = 'user-trained'",
  );
  assert(
    /export\s+type\s+ModqnReplayAdapterModeKey[\s\S]*typeof\s+MODQN_USER_TRAINED_MODE_KEY/.test(replayStateSource),
    'ModqnReplayAdapterModeKey includes typeof MODQN_USER_TRAINED_MODE_KEY',
  );
  assert(
    /export\s+type\s+ModqnReplayEvidenceStatus[\s\S]*typeof\s+MODQN_USER_TRAINED_EVIDENCE_STATUS/.test(replayStateSource),
    'ModqnReplayEvidenceStatus includes typeof MODQN_USER_TRAINED_EVIDENCE_STATUS',
  );
  assert(
    /readonly\s+modeKey\?:\s*ModqnReplayAdapterModeKey;/.test(replayStateSource),
    'ModqnReplayBundleLoadOptions.modeKey optional field present',
  );
}

// ---------------------------------------------------------------------------
// (b) Source grep: playback-shell widened model + per-mode branches
// ---------------------------------------------------------------------------
console.log('\n(b) playback-shell source wiring');
{
  assert(
    playbackShellSource.includes('MODQN_USER_TRAINED_MODE_KEY')
      && playbackShellSource.includes('MODQN_USER_TRAINED_MODE_LABEL')
      && playbackShellSource.includes('MODQN_USER_TRAINED_EVIDENCE_STATUS'),
    'playback-shell imports user-trained mode constants',
  );
  assert(
    /model\.modeKey\s*===\s*MODQN_REPLAY_7BEAM_MODE_KEY/.test(playbackShellSource)
      && /model\.modeKey\s*===\s*MODQN_USER_TRAINED_MODE_KEY/.test(playbackShellSource),
    'getModqnReplayPlaybackModelValidationIssue switches on model.modeKey',
  );
  assert(
    /interface\s+ModqnReplayPlaybackShellModel[\s\S]*readonly\s+modeKey:\s*ModqnReplayAdapterModeKey;/.test(playbackShellSource),
    'ModqnReplayPlaybackShellModel.modeKey widened to ModqnReplayAdapterModeKey',
  );
  assert(
    /interface\s+ModqnReplayPlaybackShellModel[\s\S]*readonly\s+sourcePath:\s*string;/.test(playbackShellSource),
    'ModqnReplayPlaybackShellModel.sourcePath widened to string',
  );
}

// ---------------------------------------------------------------------------
// (c) Behavioral: user-trained envelope accepts non-7beam shape
// ---------------------------------------------------------------------------
console.log('\n(c) user-trained envelope non-7beam shape');
const userTrainedEnvelope = createModqnReplayEnvelopeFromContents(
  buildBundleSurfaces({
    sourcePath: 'user-trained:job-1',
    rowCount: 5,
    slotCount: 2,
    satCount: 3,
    beamCountPerSat: 4,
    intraCount: 2,
  }),
  {
    modeKey: MODQN_USER_TRAINED_MODE_KEY,
    sourcePath: 'user-trained:job-1',
    sourceOwner: 'modqn-paper-reproduction',
  },
);
{
  assert(userTrainedEnvelope.modeKey === MODQN_USER_TRAINED_MODE_KEY, 'envelope.modeKey is modqn-user-trained');
  assert(userTrainedEnvelope.evidenceStatus === 'user-trained', "envelope.evidenceStatus is 'user-trained'");
  assert(userTrainedEnvelope.replaySlots.length === 2, 'envelope.replaySlots.length === 2');
  assert(userTrainedEnvelope.diagnostics.adapter.rowCount === 5, 'diagnostics.adapter.rowCount === 5');
  assert(userTrainedEnvelope.diagnostics.adapter.slotCount === 2, 'diagnostics.adapter.slotCount === 2');
  assert(
    userTrainedEnvelope.diagnostics.adapter.bridgeStatus === 'skipped-user-trained-bundle',
    "diagnostics.adapter.bridgeStatus === 'skipped-user-trained-bundle'",
  );
  assert(userTrainedEnvelope.identityMap.beamBridges.length === 0, 'identityMap.beamBridges.length === 0');
}

// ---------------------------------------------------------------------------
// (d) Behavioral regression: 7-beam strict row-count gate remains active
// ---------------------------------------------------------------------------
console.log('\n(d) 7-beam strict row-count gate');
assertThrows(
  'default 7-beam mode rejects 999 timeline rows',
  () => createModqnReplayEnvelopeFromContents(
    buildBundleSurfaces({
      sourcePath: SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
      rowCount: 999,
      slotCount: 10,
      satCount: 4,
      beamCountPerSat: 7,
      intraCount: 82,
    }),
  ),
  error => error.message.includes('timeline/step-trace.jsonl row count')
    || error.message.includes('1000'),
);

// ---------------------------------------------------------------------------
// (e) Behavioral regression: user-trained sourcePath prefix gate
// ---------------------------------------------------------------------------
console.log('\n(e) user-trained sourcePath gate');
assertThrows(
  'user-trained mode rejects sourcePath without user-trained: prefix',
  () => createModqnReplayEnvelopeFromContents(
    buildBundleSurfaces({
      sourcePath: 'not-a-prefix:foo',
      rowCount: 5,
      slotCount: 2,
      satCount: 3,
      beamCountPerSat: 4,
      intraCount: 2,
    }),
    {
      modeKey: MODQN_USER_TRAINED_MODE_KEY,
      sourcePath: 'not-a-prefix:foo',
      sourceOwner: 'modqn-paper-reproduction',
    },
  ),
  error => error.message.includes('sourcePath') && error.message.includes('user-trained:'),
);

// ---------------------------------------------------------------------------
// (f) Behavioral: user-trained envelope builds a valid playback shell model
// ---------------------------------------------------------------------------
console.log('\n(f) user-trained playback model from envelope');
{
  const model = createModqnReplayPlaybackShellModel(userTrainedEnvelope);
  assert(
    getModqnReplayPlaybackModelValidationIssue(model) === null,
    'createModqnReplayPlaybackShellModel(user-trained envelope) validates',
  );
}

// ---------------------------------------------------------------------------
// (g) Behavioral regression: synthetic user-trained shell validation
// ---------------------------------------------------------------------------
console.log('\n(g) synthetic user-trained playback validation');
{
  const valid = syntheticUserTrainedShell();
  assert(
    getModqnReplayPlaybackModelValidationIssue(valid) === null,
    'synthetic user-trained shell with eventCounts sum=rowCount validates',
  );

  const eventCountIssue = getModqnReplayPlaybackModelValidationIssue(
    syntheticUserTrainedShell({ eventCounts: eventCounts(9, 2, 0) }),
  );
  assert(
    eventCountIssue?.code === 'unexpected-event-counts',
    "eventCounts sum=11 fails with 'unexpected-event-counts'",
    eventCountIssue?.code,
  );

  const shapeIssue = getModqnReplayPlaybackModelValidationIssue(
    syntheticUserTrainedShell({ rowCount: 0 }),
  );
  assert(
    shapeIssue?.code === 'unexpected-shape',
    "rowCount=0 fails with 'unexpected-shape'",
    shapeIssue?.code,
  );

  const sourceIssue = getModqnReplayPlaybackModelValidationIssue(
    syntheticUserTrainedShell({ sourcePath: 'wrong:foo' }),
  );
  assert(
    sourceIssue?.code === 'unexpected-source',
    "sourcePath='wrong:foo' fails with 'unexpected-source'",
    sourceIssue?.code,
  );
}

// ---------------------------------------------------------------------------
// (h) Behavioral regression: fallback 7-beam shell model still validates
// ---------------------------------------------------------------------------
console.log('\n(h) fallback shell validation');
{
  assert(
    getModqnReplayPlaybackModelValidationIssue(getModqnReplayPlaybackFallbackShellModel()) === null,
    'fallback shell model still validates',
  );
}

console.log(`\n[validate-phase-d-user-trained-mode] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
