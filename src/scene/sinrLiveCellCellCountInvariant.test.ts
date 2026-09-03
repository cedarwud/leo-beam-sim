import assert from 'node:assert/strict';
import test from 'node:test';

import { sameCandidateLinkKey } from '../engine/handover/candidateDecisionContract';
import { loadProfile } from '../profiles/index';
import {
  SinrLiveCellModel,
  cellBeamIdentityForLink,
  cellIdFromLinkBudgetBeamId,
  cellLinkBudgetBeamId,
  intraCellLinkBudgetBeamId,
  resolveIntraCellBeamCenter,
  type CellModelSat,
  type SinrLiveCellFrame,
} from './sinrLiveCellModel';
import { buildSinrLiveCellLayout } from './sinrLiveCellRuntime';

const CELL_COUNTS = [1, 7, 19] as const;
type CellCount = typeof CELL_COUNTS[number];

const OBSERVER = { latDeg: 40, lonDeg: 116 };
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const PRIMARY_UE_ID = 'ue-primary';
const SATELLITE_ID = 'SAT-INTRA';

function makeSatellite(): CellModelSat {
  return {
    id: SATELLITE_ID,
    shellId: 'shell-intra-cell-count-invariant',
    altitudeKm: 550,
    latDeg: OBSERVER.latDeg,
    lonDeg: OBSERVER.lonDeg,
    topo: { azimuthDeg: 0, elevationDeg: 90 },
  };
}

function finiteMetric(value: number | null | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    assert.fail(`${label} must be a finite number`);
  }
  return value;
}

interface InvariantResult {
  readonly cellCount: CellCount;
  readonly frameCellCount: number;
  readonly decisionMode: string;
  readonly selectedKind: string | null;
  readonly commitKind: string;
  readonly servingHandoverKind: string;
  readonly sourceSatId: string;
  readonly targetSatId: string;
  readonly sourceCellId: number;
  readonly targetCellId: number;
  readonly sourceBeamId: number;
  readonly targetBeamId: number;
}

function runCellCountCase(cellCount: CellCount): InvariantResult {
  const baseProfile = loadProfile('hobs-2024-candidate-rich');
  const profile = {
    ...baseProfile,
    handover: {
      ...baseProfile.handover,
      // Keep this deterministic fixture focused on the live EE authority path.
      sinrThresholdDb: -100,
    },
  };
  const layout = buildSinrLiveCellLayout(profile, cellCount);
  assert.equal(layout.count, cellCount, `${cellCount}-cell layout count must be preserved`);
  const selectedCellId = layout.centers[0]?.cellId;
  assert.equal(selectedCellId, 0, `${cellCount}-cell layout must retain selected cell 0`);
  const selectedCell = layout.centers[0]!;
  const satellite = makeSatellite();
  const variantCenter = resolveIntraCellBeamCenter(
    selectedCell,
    layout.cellRadiusKm,
    OBSERVER,
  );
  const ue = {
    id: PRIMARY_UE_ID,
    eastKm: variantCenter.localXKm,
    northKm: variantCenter.localYKm,
  };
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: layout,
    observer: OBSERVER,
    epochUtcMs: EPOCH_MS,
    candidateOpportunityMeasurementEnabled: true,
    multiCandidateDecisionEnabled: true,
    beamHoppingEnabled: false,
    beamsPerSat: Infinity,
  });

  const step = (simTimeSec: number, dtSec: number): SinrLiveCellFrame => model.step({
    visibleSats: [satellite],
    ues: [ue],
    simTimeSec,
    dtSec,
  });

  const normalBeamId = cellLinkBudgetBeamId(selectedCellId);
  const variantBeamId = intraCellLinkBudgetBeamId(selectedCellId);
  const initialFrame = step(0, 0);
  const initialDecision = model.getHandoverDecisionFrame();
  assert.ok(initialDecision, `${cellCount}-cell case must publish the decision frame`);
  const initialPrimary = initialFrame.ues.find(item => item.ueId === PRIMARY_UE_ID);
  assert.ok(initialPrimary, `${cellCount}-cell case must publish the primary UE`);
  assert.equal(initialPrimary.cellId, selectedCellId);
  assert.equal(initialPrimary.servingSatId, SATELLITE_ID);
  assert.equal(initialPrimary.servingBeamId, normalBeamId);
  assert.equal(initialDecision.mode, 'ee-optimization');
  assert.ok(initialDecision.serving);
  assert.equal(initialDecision.serving.satelliteId, SATELLITE_ID);
  assert.equal(initialDecision.serving.beamId, normalBeamId);

  const sourceOpportunity = initialDecision.opportunities.find(item => (
    item.key.satelliteId === SATELLITE_ID && item.key.beamId === normalBeamId
  ));
  const targetOpportunity = initialDecision.opportunities.find(item => (
    item.key.satelliteId === SATELLITE_ID && item.key.beamId === variantBeamId
  ));
  assert.ok(sourceOpportunity, `${cellCount}-cell case must measure the source link`);
  assert.ok(targetOpportunity, `${cellCount}-cell case must measure the same-cell target link`);
  assert.ok(
    initialDecision.opportunities.every(item => cellIdFromLinkBudgetBeamId(item.key.beamId) === selectedCellId),
    `${cellCount}-cell primary decision must not admit beams from another geographic cell`,
  );
  const sourceEe = finiteMetric(sourceOpportunity.instantaneousEe?.value, 'source instantaneous EE');
  const targetEe = finiteMetric(targetOpportunity.instantaneousEe?.value, 'target instantaneous EE');
  assert.ok(targetEe > sourceEe, `${cellCount}-cell target instantaneous EE must exceed source`);
  assert.equal(cellIdFromLinkBudgetBeamId(sourceOpportunity.key.beamId), selectedCellId);
  assert.equal(cellIdFromLinkBudgetBeamId(targetOpportunity.key.beamId), selectedCellId);
  assert.notEqual(
    cellBeamIdentityForLink(SATELLITE_ID, sourceOpportunity.key.beamId),
    cellBeamIdentityForLink(SATELLITE_ID, targetOpportunity.key.beamId),
    'source and target must have different beam identities',
  );

  const sourceProbe = initialFrame.primaryCandidateProbeEvidence?.find(item => (
    sameCandidateLinkKey(item.key, sourceOpportunity.key)
  ));
  const targetProbe = initialFrame.primaryCandidateProbeEvidence?.find(item => (
    sameCandidateLinkKey(item.key, targetOpportunity.key)
  ));
  assert.ok(sourceProbe?.sample?.angleAware, `${cellCount}-cell source must have angle-aware geometry evidence`);
  assert.ok(targetProbe?.sample?.angleAware, `${cellCount}-cell target must have angle-aware geometry evidence`);
  assert.notEqual(
    sourceProbe.sample.angleAware.thetaRad,
    targetProbe.sample.angleAware.thetaRad,
    `${cellCount}-cell source and target must have different measured geometry`,
  );
  assert.equal(sourceOpportunity.sourceFrameId, initialFrame.sourceFrameId);
  assert.equal(targetOpportunity.sourceFrameId, initialFrame.sourceFrameId);

  let selectedTarget: { readonly satelliteId: string; readonly beamId: number } | null = null;
  let selectedKind: string | null = null;
  let committedFrame: SinrLiveCellFrame | null = null;
  let committedDecision: NonNullable<ReturnType<SinrLiveCellModel['getHandoverDecisionFrame']>> | null = null;
  for (let index = 1; index <= 20 && committedFrame === null; index += 1) {
    const frame = step(index * 0.25, 0.25);
    const decision = model.getHandoverDecisionFrame();
    assert.ok(decision);
    if (decision.selectedTarget !== null && selectedTarget === null) {
      selectedTarget = decision.selectedTarget;
      selectedKind = decision.selectedKind;
    }
    if (decision.recentCommit !== null) {
      committedFrame = frame;
      committedDecision = decision;
    }
  }

  assert.ok(selectedTarget, `${cellCount}-cell case must expose selected target before commit`);
  assert.ok(committedFrame, `${cellCount}-cell case must commit the selected target`);
  assert.ok(committedDecision);
  assert.ok(committedDecision.recentCommit);
  const commit = committedDecision.recentCommit;
  assert.ok(commit.from);
  assert.equal(selectedKind, 'intra-satellite');
  assert.equal(selectedTarget.satelliteId, SATELLITE_ID);
  assert.equal(selectedTarget.beamId, variantBeamId);
  assert.equal(commit.kind, 'intra-satellite');
  assert.equal(commit.mode, 'ee-optimization');
  assert.equal(commit.from.satelliteId, SATELLITE_ID);
  assert.equal(commit.to.satelliteId, SATELLITE_ID);
  assert.equal(commit.from.beamId, normalBeamId);
  assert.equal(commit.to.beamId, variantBeamId);
  assert.equal(commit.sourceFrameId, committedFrame.sourceFrameId);
  assert.equal(committedDecision.sourceFrameId, committedFrame.sourceFrameId);
  assert.equal(commit.simTimeMs, EPOCH_MS + committedFrame.simTimeSec * 1000);

  const committedPrimary = committedFrame.ues.find(item => item.ueId === PRIMARY_UE_ID);
  assert.ok(committedPrimary);
  assert.equal(committedPrimary.cellId, selectedCellId, 'the geographic cell must not change');
  assert.equal(committedPrimary.servingSatId, SATELLITE_ID);
  assert.equal(committedPrimary.servingBeamId, variantBeamId);
  assert.equal(
    committedPrimary.beamIdentity,
    cellBeamIdentityForLink(SATELLITE_ID, variantBeamId),
  );
  assert.equal(committedPrimary.handoverKind, 'intra');
  assert.equal(committedFrame.intraHandoverCount, 1);
  assert.equal(committedFrame.interHandoverCount, 0);
  assert.equal(committedPrimary.servingLinkSample?.beamId, variantBeamId);

  const event = committedFrame.recentHandoverEvents.find(item => item.ueId === PRIMARY_UE_ID);
  assert.ok(event);
  assert.equal(event.kind, 'intra');
  assert.equal(event.sourceTimeSec, committedFrame.simTimeSec);
  assert.equal(event.fromSatId, SATELLITE_ID);
  assert.equal(event.toSatId, SATELLITE_ID);
  assert.equal(event.fromCellId, selectedCellId);
  assert.equal(event.toCellId, selectedCellId);

  const servingBeams = committedFrame.illuminatedBeams.filter(item => (
    item.cellId === selectedCellId && item.serving
  ));
  assert.equal(servingBeams.length, 1, 'same-frame commit must expose one serving beam for the selected cell');
  assert.equal(servingBeams[0]?.beamId, variantBeamId);

  return {
    cellCount,
    frameCellCount: committedFrame.cells.length,
    decisionMode: committedDecision.mode,
    selectedKind,
    commitKind: commit.kind,
    servingHandoverKind: committedPrimary.handoverKind,
    sourceSatId: commit.from.satelliteId,
    targetSatId: commit.to.satelliteId,
    sourceCellId: cellIdFromLinkBudgetBeamId(commit.from.beamId),
    targetCellId: cellIdFromLinkBudgetBeamId(commit.to.beamId),
    sourceBeamId: commit.from.beamId,
    targetBeamId: commit.to.beamId,
  };
}

test('canonical SINR live-cell intra authority is invariant for cellCount 1, 7, and 19', () => {
  const results = CELL_COUNTS.map(runCellCountCase);

  // The observed cell/display cardinality changes, but the selected-cell
  // authority signature must not fork with that cardinality.
  assert.deepEqual(results.map(result => result.frameCellCount), [...CELL_COUNTS]);
  assert.deepEqual(
    results.map(({
      cellCount: _cellCount,
      frameCellCount: _frameCellCount,
      ...authoritySignature
    }) => authoritySignature),
    [
      {
        decisionMode: 'ee-optimization',
        selectedKind: 'intra-satellite',
        commitKind: 'intra-satellite',
        servingHandoverKind: 'intra',
        sourceSatId: SATELLITE_ID,
        targetSatId: SATELLITE_ID,
        sourceCellId: 0,
        targetCellId: 0,
        sourceBeamId: 1,
        targetBeamId: 421,
      },
      {
        decisionMode: 'ee-optimization',
        selectedKind: 'intra-satellite',
        commitKind: 'intra-satellite',
        servingHandoverKind: 'intra',
        sourceSatId: SATELLITE_ID,
        targetSatId: SATELLITE_ID,
        sourceCellId: 0,
        targetCellId: 0,
        sourceBeamId: 1,
        targetBeamId: 421,
      },
      {
        decisionMode: 'ee-optimization',
        selectedKind: 'intra-satellite',
        commitKind: 'intra-satellite',
        servingHandoverKind: 'intra',
        sourceSatId: SATELLITE_ID,
        targetSatId: SATELLITE_ID,
        sourceCellId: 0,
        targetCellId: 0,
        sourceBeamId: 1,
        targetBeamId: 421,
      },
    ],
  );
});
