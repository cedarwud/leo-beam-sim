import {
  MODQN_BEAM_CATALOG_ORDER,
  MODQN_PAPER_ID,
  MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
  type ModqnBeamReference,
  type ModqnClaimBoundary,
  type ModqnHandoverEventKind,
  type ModqnPolicyDiagnostics,
  type ModqnProducerOwnedObject,
  type ModqnReplayBundle,
  type ModqnReplayBundleContents,
  type ModqnReplayTimelineRow,
  type ModqnRewardVector,
} from './types';
import {
  MODQN_BASELINE_BEAMS_PER_SATELLITE,
  MODQN_BEAM_COUNT_CLAIM_LABELS,
  MODQN_TOTAL_BASELINE_BEAMS,
  SUPPORTED_MODQN_HANDOVER_EVENT_KINDS,
  adaptModqnHandoverEvent,
  createSelectedActionIdentity,
  createUserIdentity,
  type ModqnHandoverIdentity,
  type ModqnSelectedActionIdentity,
  type ModqnUserIdentity,
} from './identity';
import {
  createBeamLayoutBridgeCatalogByProducerId,
  getModqnBeamCountBridgeClaim,
  type ModqnBeamCountBridgeClaim,
  type ModqnBeamLayoutBridgeIdentity,
} from './beam-layout-bridge';
import { parseModqnReplayBundle } from './loader';

export const SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH =
  '/home/u24/papers/modqn-paper-reproduction/artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/phase-03a-replay-bundle-v1' as const;

export const MODQN_REPLAY_7BEAM_MODE_KEY = 'modqn-replay-7beam' as const;
export const MODQN_REPLAY_7BEAM_MODE_LABEL =
  'MODQN replay - 7-beam producer artifact' as const;
export const MODQN_REPLAY_7BEAM_EVIDENCE_STATUS = 'accepted-7beam-baseline' as const;
export const MODQN_FIXTURE_ONLY_EVIDENCE_STATUS = 'fixture-only' as const;

const EXPECTED_SATELLITE_COUNT = 4;
const EXPECTED_TIMELINE_ROWS = 1000;
const EXPECTED_SLOT_COUNT = 10;

export type ModqnReplayEvidenceStatus =
  | typeof MODQN_REPLAY_7BEAM_EVIDENCE_STATUS
  | typeof MODQN_FIXTURE_ONLY_EVIDENCE_STATUS;

export type ModqnReplayAdapterModeKey =
  | typeof MODQN_REPLAY_7BEAM_MODE_KEY
  | 'sensitivity-demo';

export type ModqnReplayAdapterModeLabel =
  | typeof MODQN_REPLAY_7BEAM_MODE_LABEL
  | 'Sensitivity/demo';

export type ModqnReplaySourceOwner =
  | 'modqn-paper-reproduction'
  | 'leo-beam-sim'
  | 'ntn-sim-core'
  | 'fixture';

export type ModqnReplayBundleSurfaceKey =
  | 'manifestJson'
  | 'provenanceMapJson'
  | 'timelineJsonl';

export interface ModqnReplayBundleRequiredSurface {
  readonly contentsKey: ModqnReplayBundleSurfaceKey;
  readonly relativePath: 'manifest.json' | 'provenance-map.json' | 'timeline/step-trace.jsonl';
  readonly absolutePath: string;
}

export interface ModqnReplayBundleOptionalSurface {
  readonly relativePath: 'evaluation/summary.json';
  readonly absolutePath: string;
}

export type ModqnReplayBundleSurface =
  | ModqnReplayBundleRequiredSurface
  | ModqnReplayBundleOptionalSurface;

export type ModqnReplayBundleSurfaceReader = (
  surface: ModqnReplayBundleSurface,
) => string | undefined;

export interface ModqnReplayBundleLoadOptions {
  readonly sourcePath?: string;
  readonly fixtureOnly?: boolean;
  readonly sourceOwner?: ModqnReplaySourceOwner;
}

export interface ModqnReplayBundleLoadPlan {
  readonly sourcePath: string;
  readonly sourceOwner: ModqnReplaySourceOwner;
  readonly evidenceStatus: ModqnReplayEvidenceStatus;
  readonly requiredSurfaces: readonly ModqnReplayBundleRequiredSurface[];
  readonly optionalSurfaces: readonly ModqnReplayBundleOptionalSurface[];
}

export interface ModqnReplayEnvelopeClaimBoundary {
  readonly sourceClaimBoundary: ModqnClaimBoundary;
  readonly baselineModqnEvidence: boolean;
  readonly acceptedEvidenceShape: '7-beam producer baseline only' | 'none-fixture-only';
  readonly artifactStatus:
    | 'newly-regenerated-re-promoted-not-recovered-frozen-artifact'
    | 'fixture-only-non-evidence-not-producer-artifact';
  readonly allowedClaims: readonly string[];
  readonly forbiddenClaims: readonly string[];
  readonly beamCountBoundary: Readonly<Record<7 | 19 | 37, string>>;
}

export interface ModqnReplayEnvelopeIdentityMap {
  readonly producerBeamCatalogOrder: typeof MODQN_BEAM_CATALOG_ORDER;
  readonly beamCountBridgeClaim: ModqnBeamCountBridgeClaim;
  readonly beamBridges: readonly ModqnBeamLayoutBridgeIdentity[];
  readonly users: readonly ModqnUserIdentity[];
}

export interface ModqnReplayEnvelopeProducerTruth {
  readonly timestamps: {
    readonly slotIndex: number;
    readonly timeSec: number;
    readonly decisionTimeSec: number;
  };
  readonly userId: string;
  readonly userIndex: number;
  readonly previousServing: ModqnBeamReference;
  readonly selectedServing: ModqnBeamReference;
  readonly candidateActionOrder: readonly ModqnBeamReference[];
  readonly beamCatalogOrder: typeof MODQN_BEAM_CATALOG_ORDER;
  readonly visibilityMask: readonly boolean[];
  readonly actionValidityMask: readonly boolean[];
  readonly decisionVisibilityMask: readonly boolean[];
  readonly decisionActionValidityMask: readonly boolean[];
  readonly beamLoads: readonly number[];
  readonly beamThroughputs: readonly number[];
  readonly rewardVector: ModqnRewardVector;
  readonly scalarReward: number;
  readonly handoverEvent: ModqnReplayTimelineRow['handoverEvent'];
  readonly policyDiagnostics?: ModqnPolicyDiagnostics;
  readonly sourceRow: ModqnReplayTimelineRow;
}

export interface ModqnReplayEnvelopeRow {
  readonly sourceRowIndex: number;
  readonly slotRowIndex: number;
  readonly userIdentity: ModqnUserIdentity;
  readonly selectedActionIdentity: ModqnSelectedActionIdentity;
  readonly handoverIdentity: ModqnHandoverIdentity;
  readonly producerTruth: ModqnReplayEnvelopeProducerTruth;
}

export interface ModqnReplayEnvelopeSlot {
  readonly slotIndex: number;
  readonly sourceRowStartIndex: number;
  readonly sourceRowEndIndex: number;
  readonly rowCount: number;
  readonly rows: readonly ModqnReplayEnvelopeRow[];
}

export interface ModqnReplayEnvelopeDiagnostics {
  readonly adapter: {
    readonly status: 'accepted';
    readonly selectedPathMatchesDefault: boolean;
    readonly rowCount: number;
    readonly slotCount: number;
    readonly satelliteCount: number;
    readonly beamCountPerSatellite: number;
    readonly totalBeamCount: number;
    readonly rowsWithPolicyDiagnostics: number;
    readonly rowsWithoutPolicyDiagnostics: number;
    readonly eventCounts: Readonly<Record<ModqnHandoverEventKind, number>>;
    readonly bridgeStatus:
      | 'built-for-accepted-7beam-path'
      | 'skipped-fixture-only-non-evidence';
    readonly requiredSurfaces: readonly string[];
  };
  readonly producerPolicyDiagnostics: {
    readonly status: 'present-from-producer' | 'missing-from-producer';
    readonly sourceField: 'timeline/step-trace.jsonl.policyDiagnostics';
    readonly rowsWithDiagnostics: number;
    readonly rowsWithoutDiagnostics: number;
  };
}

export interface ModqnReplayEnvelope {
  readonly modeKey: ModqnReplayAdapterModeKey;
  readonly modeLabel: ModqnReplayAdapterModeLabel;
  readonly evidenceStatus: ModqnReplayEvidenceStatus;
  readonly sourceOwner: ModqnReplaySourceOwner;
  readonly sourcePath: string;
  readonly sourceSchemaVersion: typeof MODQN_REPLAY_BUNDLE_SCHEMA_VERSION;
  readonly paperId: typeof MODQN_PAPER_ID;
  readonly claimBoundary: ModqnReplayEnvelopeClaimBoundary;
  readonly provenanceMap: ModqnReplayBundle['provenanceMap'];
  readonly replaySummary?: ModqnProducerOwnedObject;
  readonly identityMap: ModqnReplayEnvelopeIdentityMap;
  readonly replaySlots: readonly ModqnReplayEnvelopeSlot[];
  readonly diagnostics: ModqnReplayEnvelopeDiagnostics;
}

function appendBundlePath(bundlePath: string, relativePath: string): string {
  return `${bundlePath.replace(/\/+$/, '')}/${relativePath}`;
}

function fail(label: string, expected: string): never {
  throw new Error(`MODQN Phase 7C replay adapter fail-closed: ${label}: expected ${expected}`);
}

function numberRecordValue(
  source: ModqnProducerOwnedObject | undefined,
  key: string,
  label: string,
): number | undefined {
  const value = source?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${label}.${key}`, 'finite number');
  return value;
}

function booleanRecordValue(
  source: ModqnProducerOwnedObject | undefined,
  key: string,
  label: string,
): boolean | undefined {
  const value = source?.[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') fail(`${label}.${key}`, 'boolean');
  return value;
}

function assertArrayLength(value: readonly unknown[], expected: number, label: string): void {
  if (value.length !== expected) fail(label, `${expected} entries`);
}

function assertSameJson(a: unknown, b: unknown, label: string): void {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail(label, 'producer truth preserved without mutation');
  }
}

function createEmptyEventCounts(): Record<ModqnHandoverEventKind, number> {
  return {
    none: 0,
    'intra-satellite-beam-switch': 0,
    'inter-satellite-handover': 0,
  };
}

function assertRequiredSurfaceText(contents: ModqnReplayBundleContents): void {
  const required = [
    ['manifestJson', 'manifest.json', contents.manifestJson],
    ['provenanceMapJson', 'provenance-map.json', contents.provenanceMapJson],
    ['timelineJsonl', 'timeline/step-trace.jsonl', contents.timelineJsonl],
  ] as const;

  for (const [, relativePath, text] of required) {
    if (typeof text !== 'string' || text.trim().length === 0) {
      fail(`required surface ${relativePath}`, 'present non-empty file contents');
    }
  }
}

function assertReferenceMatchesBeamCatalog(
  ref: ModqnBeamReference,
  catalog: ReadonlyMap<string, ModqnBeamReference>,
  label: string,
): void {
  const beam = catalog.get(ref.beamId);
  if (beam === undefined) fail(`${label} ${ref.beamId}`, 'reference present in beamStates catalog');
  if (beam.beamIndex !== ref.beamIndex) fail(`${label}.beamIndex`, `producer value ${beam.beamIndex}`);
  if (beam.satId !== ref.satId) fail(`${label}.satId`, `producer value ${beam.satId}`);
  if (beam.satIndex !== ref.satIndex) fail(`${label}.satIndex`, `producer value ${beam.satIndex}`);
  if (beam.localBeamIndex !== ref.localBeamIndex) {
    fail(`${label}.localBeamIndex`, `producer value ${beam.localBeamIndex}`);
  }
}

function assertHandoverEventMatchesServingTruth(row: ModqnReplayTimelineRow, label: string): void {
  const sameSatellite = row.previousServing.satId === row.selectedServing.satId;
  const sameBeam = row.previousServing.beamId === row.selectedServing.beamId;

  if (sameSatellite && sameBeam && row.handoverEvent.kind !== 'none') {
    fail(`${label}.handoverEvent.kind`, 'none for same-satellite same-beam row');
  }
  if (sameSatellite && !sameBeam && row.handoverEvent.kind !== 'intra-satellite-beam-switch') {
    fail(`${label}.handoverEvent.kind`, 'intra-satellite-beam-switch for same-satellite beam change');
  }
  if (!sameSatellite && row.handoverEvent.kind !== 'inter-satellite-handover') {
    fail(`${label}.handoverEvent.kind`, 'inter-satellite-handover for satellite change');
  }
}

function assertPolicyDiagnosticsPreserved(row: ModqnReplayTimelineRow, label: string): void {
  if (row.policyDiagnostics === undefined) fail(`${label}.policyDiagnostics`, 'producer policy diagnostics');
  if (row.policyDiagnostics.topCandidates !== undefined) {
    for (const [candidateIndex, candidate] of row.policyDiagnostics.topCandidates.entries()) {
      if (candidate.beamIndex < 0 || candidate.beamIndex >= MODQN_TOTAL_BASELINE_BEAMS) {
        fail(`${label}.policyDiagnostics.topCandidates[${candidateIndex}].beamIndex`, 'valid action index');
      }
    }
  }
}

function validateEvidenceCapableBundleShape(bundle: ModqnReplayBundle): void {
  if (bundle.sourcePath !== SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH) {
    fail('sourcePath', `selected producer bundle path ${SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH}`);
  }
  if (bundle.manifest.bundleSchemaVersion !== MODQN_REPLAY_BUNDLE_SCHEMA_VERSION) {
    fail('manifest.bundleSchemaVersion', MODQN_REPLAY_BUNDLE_SCHEMA_VERSION);
  }
  if (bundle.manifest.paperId !== MODQN_PAPER_ID) fail('manifest.paperId', MODQN_PAPER_ID);
  if (bundle.manifest.baselineSurface.satelliteCount !== EXPECTED_SATELLITE_COUNT) {
    fail('manifest.baselineSurface.satelliteCount', `${EXPECTED_SATELLITE_COUNT}`);
  }
  if (bundle.manifest.baselineSurface.beamCountPerSatellite !== MODQN_BASELINE_BEAMS_PER_SATELLITE) {
    fail('manifest.baselineSurface.beamCountPerSatellite', `${MODQN_BASELINE_BEAMS_PER_SATELLITE}`);
  }
  if (bundle.manifest.baselineSurface.totalBeamCount !== MODQN_TOTAL_BASELINE_BEAMS) {
    fail('manifest.baselineSurface.totalBeamCount', `${MODQN_TOTAL_BASELINE_BEAMS}`);
  }
  if (bundle.manifest.claimBoundary.notFullPaperFaithfulReproduction !== true) {
    fail('manifest.claimBoundary.notFullPaperFaithfulReproduction', 'true');
  }
  if (bundle.manifest.claimBoundary.not19Or37BeamTrainedEvidence !== true) {
    fail('manifest.claimBoundary.not19Or37BeamTrainedEvidence', 'true');
  }

  const manifestRowCount = numberRecordValue(bundle.manifest.replaySummary, 'rowCount', 'manifest.replaySummary');
  if (manifestRowCount !== undefined && manifestRowCount !== EXPECTED_TIMELINE_ROWS) {
    fail('manifest.replaySummary.rowCount', `${EXPECTED_TIMELINE_ROWS}`);
  }
  const manifestSlotCount = numberRecordValue(bundle.manifest.replaySummary, 'slotCount', 'manifest.replaySummary');
  if (manifestSlotCount !== undefined && manifestSlotCount !== EXPECTED_SLOT_COUNT) {
    fail('manifest.replaySummary.slotCount', `${EXPECTED_SLOT_COUNT}`);
  }
  if (bundle.timelineRows.length !== EXPECTED_TIMELINE_ROWS) {
    fail('timeline/step-trace.jsonl row count', `${EXPECTED_TIMELINE_ROWS}`);
  }

  const slots = new Set<number>();
  let previousSlotIndex = -Infinity;
  const expectsPolicyDiagnostics =
    booleanRecordValue(bundle.manifest.optionalPolicyDiagnostics, 'present', 'manifest.optionalPolicyDiagnostics') === true;

  for (const [rowIndex, row] of bundle.timelineRows.entries()) {
    const label = `timeline.rows[${rowIndex}]`;
    if (row.slotIndex < previousSlotIndex) fail(`${label}.slotIndex`, 'nondecreasing producer row order');
    previousSlotIndex = row.slotIndex;
    slots.add(row.slotIndex);

    if (row.beamCatalogOrder !== MODQN_BEAM_CATALOG_ORDER) fail(`${label}.beamCatalogOrder`, MODQN_BEAM_CATALOG_ORDER);
    assertArrayLength(row.satelliteStates, EXPECTED_SATELLITE_COUNT, `${label}.satelliteStates`);
    assertArrayLength(row.beamStates, MODQN_TOTAL_BASELINE_BEAMS, `${label}.beamStates`);
    assertArrayLength(row.visibilityMask, MODQN_TOTAL_BASELINE_BEAMS, `${label}.visibilityMask`);
    assertArrayLength(row.actionValidityMask, MODQN_TOTAL_BASELINE_BEAMS, `${label}.actionValidityMask`);
    assertArrayLength(row.decisionVisibilityMask, MODQN_TOTAL_BASELINE_BEAMS, `${label}.decisionVisibilityMask`);
    assertArrayLength(row.decisionActionValidityMask, MODQN_TOTAL_BASELINE_BEAMS, `${label}.decisionActionValidityMask`);
    assertArrayLength(row.beamLoads, MODQN_TOTAL_BASELINE_BEAMS, `${label}.beamLoads`);
    assertArrayLength(row.beamThroughputs, MODQN_TOTAL_BASELINE_BEAMS, `${label}.beamThroughputs`);

    const catalog = new Map(row.beamStates.map(beam => [beam.beamId, beam]));
    if (catalog.size !== MODQN_TOTAL_BASELINE_BEAMS) fail(`${label}.beamStates`, 'unique producer beam IDs');
    for (const [beamOffset, beam] of row.beamStates.entries()) {
      if (beam.beamIndex !== beamOffset) fail(`${label}.beamStates[${beamOffset}].beamIndex`, `${beamOffset}`);
    }
    assertReferenceMatchesBeamCatalog(row.previousServing, catalog, `${label}.previousServing`);
    assertReferenceMatchesBeamCatalog(row.selectedServing, catalog, `${label}.selectedServing`);

    const selectedIndex = row.selectedServing.beamIndex;
    if (row.decisionActionValidityMask[selectedIndex] !== row.selectedServing.validUnderDecisionMask) {
      fail(`${label}.decisionActionValidityMask[selectedServing.beamIndex]`, 'selectedServing.validUnderDecisionMask');
    }
    if (row.actionValidityMask[selectedIndex] !== row.selectedServing.validUnderPostStepMask) {
      fail(`${label}.actionValidityMask[selectedServing.beamIndex]`, 'selectedServing.validUnderPostStepMask');
    }

    assertHandoverEventMatchesServingTruth(row, label);
    if (expectsPolicyDiagnostics) assertPolicyDiagnosticsPreserved(row, label);
  }

  if (slots.size !== EXPECTED_SLOT_COUNT) fail('timeline slot count', `${EXPECTED_SLOT_COUNT}`);
}

function createClaimBoundary(
  sourceClaimBoundary: ModqnClaimBoundary,
  evidenceStatus: ModqnReplayEvidenceStatus,
): ModqnReplayEnvelopeClaimBoundary {
  const baselineModqnEvidence = evidenceStatus === MODQN_REPLAY_7BEAM_EVIDENCE_STATUS;

  return {
    sourceClaimBoundary,
    baselineModqnEvidence,
    acceptedEvidenceShape: baselineModqnEvidence ? '7-beam producer baseline only' : 'none-fixture-only',
    artifactStatus: baselineModqnEvidence
      ? 'newly-regenerated-re-promoted-not-recovered-frozen-artifact'
      : 'fixture-only-non-evidence-not-producer-artifact',
    allowedClaims: baselineModqnEvidence
      ? [
          'Producer-owned regenerated 7-beam baseline MODQN replay bundle for PAP-2024-MORL-MULTIBEAM.',
          'Evidence-capable replay of selected producer rows after Phase 7C shape validation.',
          '7 beams per satellite is the only accepted baseline MODQN evidence shape for this selected path.',
        ]
      : [
          'Fixture-only parser and replay-state exercise.',
          'No baseline MODQN evidence claim is emitted for fixture-only paths.',
        ],
    forbiddenClaims: [
      'No recovered frozen artifact claim.',
      'No full paper-faithful reproduction claim.',
      'No 19-beam or 37-beam trained baseline MODQN evidence claim.',
      'No EE/HEA/Catfish/Multi-Catfish/Catfish-over-HEA scope claim.',
      'No HOBS/SINR live output as MODQN replay evidence claim.',
    ],
    beamCountBoundary: {
      7: MODQN_BEAM_COUNT_CLAIM_LABELS[7],
      19: MODQN_BEAM_COUNT_CLAIM_LABELS[19],
      37: MODQN_BEAM_COUNT_CLAIM_LABELS[37],
    },
  };
}

function createIdentityMap(
  bundle: ModqnReplayBundle,
  evidenceStatus: ModqnReplayEvidenceStatus,
  users: readonly ModqnUserIdentity[],
): ModqnReplayEnvelopeIdentityMap {
  const claim = getModqnBeamCountBridgeClaim(bundle.manifest.baselineSurface.beamCountPerSatellite);
  if (evidenceStatus !== MODQN_REPLAY_7BEAM_EVIDENCE_STATUS) {
    return {
      producerBeamCatalogOrder: MODQN_BEAM_CATALOG_ORDER,
      beamCountBridgeClaim: claim,
      beamBridges: [],
      users,
    };
  }

  const firstRow = bundle.timelineRows[0];
  if (firstRow === undefined) fail('timeline/step-trace.jsonl', 'at least one row');
  const bridgeCatalog = createBeamLayoutBridgeCatalogByProducerId(firstRow.beamStates, {
    beamCountPerSatellite: MODQN_BASELINE_BEAMS_PER_SATELLITE,
  });

  return {
    producerBeamCatalogOrder: MODQN_BEAM_CATALOG_ORDER,
    beamCountBridgeClaim: claim,
    beamBridges: [...bridgeCatalog.values()],
    users,
  };
}

function createEnvelopeRow(
  row: ModqnReplayTimelineRow,
  sourceRowIndex: number,
  slotRowIndex: number,
): ModqnReplayEnvelopeRow {
  const before = JSON.stringify(row);
  const userIdentity = createUserIdentity(row.userId, row.userIndex);
  const selectedActionIdentity = createSelectedActionIdentity(row);
  const handoverIdentity = adaptModqnHandoverEvent(
    row.handoverEvent,
    row.previousServing,
    row.selectedServing,
  );
  assertSameJson(row, JSON.parse(before), `timeline.rows[${sourceRowIndex}]`);

  return {
    sourceRowIndex,
    slotRowIndex,
    userIdentity,
    selectedActionIdentity,
    handoverIdentity,
    producerTruth: {
      timestamps: {
        slotIndex: row.slotIndex,
        timeSec: row.timeSec,
        decisionTimeSec: row.decisionTimeSec,
      },
      userId: row.userId,
      userIndex: row.userIndex,
      previousServing: row.previousServing,
      selectedServing: row.selectedServing,
      candidateActionOrder: row.beamStates,
      beamCatalogOrder: row.beamCatalogOrder,
      visibilityMask: row.visibilityMask,
      actionValidityMask: row.actionValidityMask,
      decisionVisibilityMask: row.decisionVisibilityMask,
      decisionActionValidityMask: row.decisionActionValidityMask,
      beamLoads: row.beamLoads,
      beamThroughputs: row.beamThroughputs,
      rewardVector: row.rewardVector,
      scalarReward: row.scalarReward,
      handoverEvent: row.handoverEvent,
      policyDiagnostics: row.policyDiagnostics,
      sourceRow: row,
    },
  };
}

function groupRowsBySlot(rows: readonly ModqnReplayTimelineRow[]): readonly ModqnReplayEnvelopeSlot[] {
  const groups = new Map<number, ModqnReplayEnvelopeRow[]>();
  for (const [rowIndex, row] of rows.entries()) {
    const group = groups.get(row.slotIndex) ?? [];
    group.push(createEnvelopeRow(row, rowIndex, group.length));
    groups.set(row.slotIndex, group);
  }

  return [...groups.entries()].map(([slotIndex, slotRows]) => {
    const firstRow = slotRows[0];
    const lastRow = slotRows[slotRows.length - 1];
    if (firstRow === undefined || lastRow === undefined) fail(`slot ${slotIndex}`, 'at least one row');
    return {
      slotIndex,
      sourceRowStartIndex: firstRow.sourceRowIndex,
      sourceRowEndIndex: lastRow.sourceRowIndex,
      rowCount: slotRows.length,
      rows: slotRows,
    };
  });
}

function collectUserIdentities(rows: readonly ModqnReplayTimelineRow[]): readonly ModqnUserIdentity[] {
  const users = new Map<string, ModqnUserIdentity>();
  for (const row of rows) {
    const identity = createUserIdentity(row.userId, row.userIndex);
    if (!users.has(identity.deterministicUserKey)) {
      users.set(identity.deterministicUserKey, identity);
    }
  }
  return [...users.values()];
}

function createDiagnostics(
  bundle: ModqnReplayBundle,
  evidenceStatus: ModqnReplayEvidenceStatus,
  loadPlan: ModqnReplayBundleLoadPlan,
): ModqnReplayEnvelopeDiagnostics {
  const eventCounts = createEmptyEventCounts();
  let rowsWithPolicyDiagnostics = 0;
  let rowsWithoutPolicyDiagnostics = 0;

  for (const row of bundle.timelineRows) {
    eventCounts[row.handoverEvent.kind] += 1;
    if (row.policyDiagnostics === undefined) {
      rowsWithoutPolicyDiagnostics += 1;
    } else {
      rowsWithPolicyDiagnostics += 1;
    }
  }

  return {
    adapter: {
      status: 'accepted',
      selectedPathMatchesDefault: bundle.sourcePath === SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
      rowCount: bundle.timelineRows.length,
      slotCount: new Set(bundle.timelineRows.map(row => row.slotIndex)).size,
      satelliteCount: bundle.manifest.baselineSurface.satelliteCount ?? 0,
      beamCountPerSatellite: bundle.manifest.baselineSurface.beamCountPerSatellite,
      totalBeamCount: bundle.manifest.baselineSurface.totalBeamCount,
      rowsWithPolicyDiagnostics,
      rowsWithoutPolicyDiagnostics,
      eventCounts,
      bridgeStatus: evidenceStatus === MODQN_REPLAY_7BEAM_EVIDENCE_STATUS
        ? 'built-for-accepted-7beam-path'
        : 'skipped-fixture-only-non-evidence',
      requiredSurfaces: loadPlan.requiredSurfaces.map(surface => surface.relativePath),
    },
    producerPolicyDiagnostics: {
      status: rowsWithPolicyDiagnostics > 0 ? 'present-from-producer' : 'missing-from-producer',
      sourceField: 'timeline/step-trace.jsonl.policyDiagnostics',
      rowsWithDiagnostics: rowsWithPolicyDiagnostics,
      rowsWithoutDiagnostics: rowsWithoutPolicyDiagnostics,
    },
  };
}

export function createModqnReplayBundleLoadPlan(
  options: ModqnReplayBundleLoadOptions = {},
): ModqnReplayBundleLoadPlan {
  const sourcePath = options.sourcePath ?? SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH;
  const fixtureOnly = options.fixtureOnly === true;

  if (!fixtureOnly && sourcePath !== SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH) {
    fail('sourcePath', 'selected path or explicit fixtureOnly=true for non-evidence paths');
  }
  if (!fixtureOnly && options.sourceOwner !== undefined && options.sourceOwner !== 'modqn-paper-reproduction') {
    fail('sourceOwner', 'modqn-paper-reproduction for evidence-capable replay');
  }

  return {
    sourcePath,
    sourceOwner: fixtureOnly
      ? (options.sourceOwner ?? 'fixture')
      : 'modqn-paper-reproduction',
    evidenceStatus: fixtureOnly ? MODQN_FIXTURE_ONLY_EVIDENCE_STATUS : MODQN_REPLAY_7BEAM_EVIDENCE_STATUS,
    requiredSurfaces: [
      {
        contentsKey: 'manifestJson',
        relativePath: 'manifest.json',
        absolutePath: appendBundlePath(sourcePath, 'manifest.json'),
      },
      {
        contentsKey: 'provenanceMapJson',
        relativePath: 'provenance-map.json',
        absolutePath: appendBundlePath(sourcePath, 'provenance-map.json'),
      },
      {
        contentsKey: 'timelineJsonl',
        relativePath: 'timeline/step-trace.jsonl',
        absolutePath: appendBundlePath(sourcePath, 'timeline/step-trace.jsonl'),
      },
    ],
    optionalSurfaces: [
      {
        relativePath: 'evaluation/summary.json',
        absolutePath: appendBundlePath(sourcePath, 'evaluation/summary.json'),
      },
    ],
  };
}

export function createModqnReplayEnvelopeFromBundle(
  bundle: ModqnReplayBundle,
  options: ModqnReplayBundleLoadOptions = {},
): ModqnReplayEnvelope {
  const loadPlan = createModqnReplayBundleLoadPlan({
    ...options,
    sourcePath: options.sourcePath ?? bundle.sourcePath,
  });

  if (bundle.sourcePath !== loadPlan.sourcePath) {
    fail('bundle.sourcePath', `load-plan path ${loadPlan.sourcePath}`);
  }
  if (loadPlan.evidenceStatus === MODQN_REPLAY_7BEAM_EVIDENCE_STATUS) {
    validateEvidenceCapableBundleShape(bundle);
  }

  const replaySlots = groupRowsBySlot(bundle.timelineRows);
  const users = collectUserIdentities(bundle.timelineRows);

  return {
    modeKey: loadPlan.evidenceStatus === MODQN_REPLAY_7BEAM_EVIDENCE_STATUS
      ? MODQN_REPLAY_7BEAM_MODE_KEY
      : 'sensitivity-demo',
    modeLabel: loadPlan.evidenceStatus === MODQN_REPLAY_7BEAM_EVIDENCE_STATUS
      ? MODQN_REPLAY_7BEAM_MODE_LABEL
      : 'Sensitivity/demo',
    evidenceStatus: loadPlan.evidenceStatus,
    sourceOwner: loadPlan.sourceOwner,
    sourcePath: loadPlan.sourcePath,
    sourceSchemaVersion: bundle.manifest.bundleSchemaVersion,
    paperId: bundle.manifest.paperId,
    claimBoundary: createClaimBoundary(bundle.manifest.claimBoundary, loadPlan.evidenceStatus),
    provenanceMap: bundle.provenanceMap,
    replaySummary: bundle.manifest.replaySummary,
    identityMap: createIdentityMap(bundle, loadPlan.evidenceStatus, users),
    replaySlots,
    diagnostics: createDiagnostics(bundle, loadPlan.evidenceStatus, loadPlan),
  };
}

export function createModqnReplayEnvelopeFromContents(
  contents: ModqnReplayBundleContents,
  options: ModqnReplayBundleLoadOptions = {},
): ModqnReplayEnvelope {
  assertRequiredSurfaceText(contents);
  const loadPlan = createModqnReplayBundleLoadPlan({
    ...options,
    sourcePath: options.sourcePath ?? contents.sourcePath,
  });
  if (contents.sourcePath !== loadPlan.sourcePath) {
    fail('contents.sourcePath', `load-plan path ${loadPlan.sourcePath}`);
  }
  return createModqnReplayEnvelopeFromBundle(parseModqnReplayBundle(contents), {
    ...options,
    sourcePath: loadPlan.sourcePath,
    sourceOwner: loadPlan.sourceOwner,
    fixtureOnly: loadPlan.evidenceStatus === MODQN_FIXTURE_ONLY_EVIDENCE_STATUS,
  });
}

export function loadModqnReplayEnvelopeFromSurfaceReader(
  readSurface: ModqnReplayBundleSurfaceReader,
  options: ModqnReplayBundleLoadOptions = {},
): ModqnReplayEnvelope {
  const loadPlan = createModqnReplayBundleLoadPlan(options);
  const contents: {
    sourcePath: string;
    manifestJson: string;
    provenanceMapJson: string;
    timelineJsonl: string;
    evaluationSummaryJson?: string;
  } = {
    sourcePath: loadPlan.sourcePath,
    manifestJson: '',
    provenanceMapJson: '',
    timelineJsonl: '',
  };

  for (const surface of loadPlan.requiredSurfaces) {
    let text: string | undefined;
    try {
      text = readSurface(surface);
    } catch (error) {
      throw new Error(
        `MODQN Phase 7C replay adapter fail-closed: required surface ${surface.relativePath}: ` +
          `${(error as Error).message}`,
      );
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      fail(`required surface ${surface.relativePath}`, 'present non-empty file contents');
    }
    contents[surface.contentsKey] = text;
  }

  for (const surface of loadPlan.optionalSurfaces) {
    try {
      const text = readSurface(surface);
      if (typeof text === 'string' && text.trim().length > 0) {
        contents.evaluationSummaryJson = text;
      }
    } catch {
      // Optional producer support surfaces are absence-honest diagnostics only.
    }
  }

  return createModqnReplayEnvelopeFromContents(contents, {
    ...options,
    sourcePath: loadPlan.sourcePath,
    sourceOwner: loadPlan.sourceOwner,
    fixtureOnly: loadPlan.evidenceStatus === MODQN_FIXTURE_ONLY_EVIDENCE_STATUS,
  });
}

export function getModqnPhase7cExpectedShape(): Readonly<{
  schema: typeof MODQN_REPLAY_BUNDLE_SCHEMA_VERSION;
  paperId: typeof MODQN_PAPER_ID;
  satelliteCount: typeof EXPECTED_SATELLITE_COUNT;
  beamCountPerSatellite: typeof MODQN_BASELINE_BEAMS_PER_SATELLITE;
  totalBeamCount: typeof MODQN_TOTAL_BASELINE_BEAMS;
  timelineRows: typeof EXPECTED_TIMELINE_ROWS;
  slotCount: typeof EXPECTED_SLOT_COUNT;
  requiredHandoverEventKinds: readonly ModqnHandoverEventKind[];
}> {
  return {
    schema: MODQN_REPLAY_BUNDLE_SCHEMA_VERSION,
    paperId: MODQN_PAPER_ID,
    satelliteCount: EXPECTED_SATELLITE_COUNT,
    beamCountPerSatellite: MODQN_BASELINE_BEAMS_PER_SATELLITE,
    totalBeamCount: MODQN_TOTAL_BASELINE_BEAMS,
    timelineRows: EXPECTED_TIMELINE_ROWS,
    slotCount: EXPECTED_SLOT_COUNT,
    requiredHandoverEventKinds: SUPPORTED_MODQN_HANDOVER_EVENT_KINDS,
  };
}
