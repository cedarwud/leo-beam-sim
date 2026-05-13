import {
  MODQN_BEAM_CATALOG_ORDER,
  MODQN_PAPER_ID,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  type ModqnBeamReference,
  type ModqnBeamState,
  type ModqnEvaluationSummary,
  type ModqnHandoverEvent,
  type ModqnHandoverEventKind,
  type ModqnPolicyCandidate,
  type ModqnPolicyDiagnostics,
  type ModqnProvenanceMap,
  type ModqnReplayBundle,
  type ModqnReplayBundleContents,
  type ModqnReplayBundleManifest,
  type ModqnReplayTimelineRow,
  type ModqnRewardVector,
  type ModqnSatelliteState,
} from './types';

function fail(label: string, expected: string): never {
  throw new Error(`${label}: expected ${expected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) fail(label, 'object');
  return value;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string') fail(label, 'string');
  return value;
}

function numberValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(label, 'finite number');
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(label, 'boolean');
  return value;
}

function numberArray(value: unknown, label: string): readonly number[] {
  if (!Array.isArray(value)) fail(label, 'number array');
  for (const [index, item] of value.entries()) {
    numberValue(item, `${label}[${index}]`);
  }
  return value as readonly number[];
}

function booleanArray(value: unknown, label: string): readonly boolean[] {
  if (!Array.isArray(value)) fail(label, 'boolean array');
  for (const [index, item] of value.entries()) {
    booleanValue(item, `${label}[${index}]`);
  }
  return value as readonly boolean[];
}

function parseJsonObject(json: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`${label}: invalid JSON: ${(error as Error).message}`);
  }
  return record(parsed, label);
}

function parseHandoverKind(value: unknown, label: string): ModqnHandoverEventKind {
  const kind = stringValue(value, label);
  if (
    kind !== 'none'
    && kind !== 'intra-satellite-beam-switch'
    && kind !== 'inter-satellite-handover'
  ) {
    fail(label, 'supported MODQN handover event kind');
  }
  return kind;
}

function parseRewardVector(value: unknown, label: string): ModqnRewardVector {
  const source = record(value, label);
  for (const [key, item] of Object.entries(source)) {
    numberValue(item, `${label}.${key}`);
  }
  return source as ModqnRewardVector;
}

function parseBeamReference(value: unknown, label: string): ModqnBeamReference {
  const source = record(value, label);
  stringValue(source.beamId, `${label}.beamId`);
  numberValue(source.beamIndex, `${label}.beamIndex`);
  stringValue(source.satId, `${label}.satId`);
  numberValue(source.satIndex, `${label}.satIndex`);
  numberValue(source.localBeamIndex, `${label}.localBeamIndex`);
  if (source.validUnderDecisionMask !== undefined) {
    booleanValue(source.validUnderDecisionMask, `${label}.validUnderDecisionMask`);
  }
  if (source.validUnderPostStepMask !== undefined) {
    booleanValue(source.validUnderPostStepMask, `${label}.validUnderPostStepMask`);
  }
  return source as unknown as ModqnBeamReference;
}

function parseHandoverEvent(value: unknown, label: string): ModqnHandoverEvent {
  const source = record(value, label);
  parseHandoverKind(source.kind, `${label}.kind`);
  if (source.eventId !== null) {
    stringValue(source.eventId, `${label}.eventId`);
  }
  return source as unknown as ModqnHandoverEvent;
}

function parseSatelliteState(value: unknown, label: string): ModqnSatelliteState {
  const source = record(value, label);
  stringValue(source.satId, `${label}.satId`);
  numberValue(source.satIndex, `${label}.satIndex`);
  return source as unknown as ModqnSatelliteState;
}

function parseBeamState(value: unknown, label: string): ModqnBeamState {
  return parseBeamReference(value, label) as ModqnBeamState;
}

function parsePolicyCandidate(value: unknown, label: string): ModqnPolicyCandidate {
  const candidate = parseBeamReference(value, label) as ModqnPolicyCandidate;
  const source = value as Record<string, unknown>;
  if (source.objectiveQ !== undefined) {
    parseRewardVector(source.objectiveQ, `${label}.objectiveQ`);
  }
  if (source.scalarizedQ !== undefined) {
    numberValue(source.scalarizedQ, `${label}.scalarizedQ`);
  }
  return candidate;
}

function parsePolicyDiagnostics(value: unknown, label: string): ModqnPolicyDiagnostics {
  const source = record(value, label);
  if (source.diagnosticsVersion !== undefined) {
    stringValue(source.diagnosticsVersion, `${label}.diagnosticsVersion`);
  }
  if (source.objectiveWeights !== undefined) {
    parseRewardVector(source.objectiveWeights, `${label}.objectiveWeights`);
  }
  for (const key of ['selectedScalarizedQ', 'runnerUpScalarizedQ', 'scalarizedMarginToRunnerUp']) {
    if (source[key] !== undefined) {
      numberValue(source[key], `${label}.${key}`);
    }
  }
  if (source.availableActionCount !== undefined) {
    numberValue(source.availableActionCount, `${label}.availableActionCount`);
  }
  if (source.topCandidates !== undefined) {
    if (!Array.isArray(source.topCandidates)) fail(`${label}.topCandidates`, 'array');
    source.topCandidates.forEach((candidate, index) => {
      parsePolicyCandidate(candidate, `${label}.topCandidates[${index}]`);
    });
  }
  return source as unknown as ModqnPolicyDiagnostics;
}

function parseTimelineRow(value: unknown, label: string): ModqnReplayTimelineRow {
  const source = record(value, label);

  numberValue(source.slotIndex, `${label}.slotIndex`);
  numberValue(source.timeSec, `${label}.timeSec`);
  numberValue(source.decisionTimeSec, `${label}.decisionTimeSec`);
  stringValue(source.userId, `${label}.userId`);
  numberValue(source.userIndex, `${label}.userIndex`);
  parseBeamReference(source.previousServing, `${label}.previousServing`);
  parseBeamReference(source.selectedServing, `${label}.selectedServing`);
  parseHandoverEvent(source.handoverEvent, `${label}.handoverEvent`);

  if (source.beamCatalogOrder !== MODQN_BEAM_CATALOG_ORDER) {
    fail(`${label}.beamCatalogOrder`, MODQN_BEAM_CATALOG_ORDER);
  }

  booleanArray(source.visibilityMask, `${label}.visibilityMask`);
  booleanArray(source.actionValidityMask, `${label}.actionValidityMask`);
  booleanArray(source.decisionVisibilityMask, `${label}.decisionVisibilityMask`);
  booleanArray(source.decisionActionValidityMask, `${label}.decisionActionValidityMask`);
  numberArray(source.beamLoads, `${label}.beamLoads`);
  numberArray(source.beamThroughputs, `${label}.beamThroughputs`);
  parseRewardVector(source.rewardVector, `${label}.rewardVector`);
  numberValue(source.scalarReward, `${label}.scalarReward`);

  if (!Array.isArray(source.satelliteStates)) fail(`${label}.satelliteStates`, 'array');
  source.satelliteStates.forEach((satellite, index) => {
    parseSatelliteState(satellite, `${label}.satelliteStates[${index}]`);
  });

  if (!Array.isArray(source.beamStates)) fail(`${label}.beamStates`, 'array');
  source.beamStates.forEach((beam, index) => {
    parseBeamState(beam, `${label}.beamStates[${index}]`);
  });

  if (source.policyDiagnostics !== undefined) {
    parsePolicyDiagnostics(source.policyDiagnostics, `${label}.policyDiagnostics`);
  }

  return source as unknown as ModqnReplayTimelineRow;
}

export function parseModqnManifest(manifestJson: string): ModqnReplayBundleManifest {
  const source = parseJsonObject(manifestJson, 'manifest.json');

  if (source.bundleSchemaVersion !== MODQN_REPLAY_BUNDLE_SCHEMA_VERSION) {
    fail('manifest.bundleSchemaVersion', MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  }
  if (source.paperId !== MODQN_PAPER_ID) {
    fail('manifest.paperId', MODQN_PAPER_ID);
  }

  const baselineSurface = record(source.baselineSurface, 'manifest.baselineSurface');
  numberValue(baselineSurface.beamCountPerSatellite, 'manifest.baselineSurface.beamCountPerSatellite');
  numberValue(baselineSurface.totalBeamCount, 'manifest.baselineSurface.totalBeamCount');
  numberValue(baselineSurface.episodesCompleted, 'manifest.baselineSurface.episodesCompleted');

  const claimBoundary = record(source.claimBoundary, 'manifest.claimBoundary');
  booleanValue(claimBoundary.notFullPaperFaithfulReproduction, 'manifest.claimBoundary.notFullPaperFaithfulReproduction');
  booleanValue(claimBoundary.not19Or37BeamTrainedEvidence, 'manifest.claimBoundary.not19Or37BeamTrainedEvidence');

  return source as unknown as ModqnReplayBundleManifest;
}

export function parseModqnProvenanceMap(provenanceMapJson: string): ModqnProvenanceMap {
  const source = parseJsonObject(provenanceMapJson, 'provenance-map.json');
  if (source.bundleSchemaVersion !== MODQN_REPLAY_BUNDLE_SCHEMA_VERSION) {
    fail('provenanceMap.bundleSchemaVersion', MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  }
  return source as unknown as ModqnProvenanceMap;
}

export function parseModqnEvaluationSummary(evaluationSummaryJson: string): ModqnEvaluationSummary {
  const source = parseJsonObject(evaluationSummaryJson, 'evaluation/summary.json');
  if (
    source.bundle_schema_version !== undefined
    && source.bundle_schema_version !== MODQN_REPLAY_BUNDLE_SCHEMA_VERSION
  ) {
    fail('evaluationSummary.bundle_schema_version', MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  }
  return source as unknown as ModqnEvaluationSummary;
}

export function parseModqnTimelineJsonl(timelineJsonl: string): readonly ModqnReplayTimelineRow[] {
  const lines = timelineJsonl
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(`timeline/step-trace.jsonl:${index + 1}: invalid JSON: ${(error as Error).message}`);
    }
    return parseTimelineRow(parsed, `timeline.rows[${index}]`);
  });
}

export function parseModqnReplayBundle(contents: ModqnReplayBundleContents): ModqnReplayBundle {
  return {
    sourcePath: contents.sourcePath,
    manifest: parseModqnManifest(contents.manifestJson),
    provenanceMap: parseModqnProvenanceMap(contents.provenanceMapJson),
    timelineRows: parseModqnTimelineJsonl(contents.timelineJsonl),
    evaluationSummary: contents.evaluationSummaryJson === undefined
      ? undefined
      : parseModqnEvaluationSummary(contents.evaluationSummaryJson),
  };
}
