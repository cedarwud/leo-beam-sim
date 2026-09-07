import assert from 'node:assert/strict';
import test from 'node:test';

import type { HomepageRailProjection } from '../homepage/controller/contracts';
import type { IntraHandoverPresentation, SimState } from '../scene/types';
import {
  deriveIntraTeachingDisplayState,
  deriveTeachingIdentityBinding,
  deriveTeachingInterRosterSatelliteIds,
  deriveTeachingSceneStoryCandidate,
  resolveTeachingIntraSatelliteId,
} from './teachingPresentationDerivations';

function projection(): HomepageRailProjection {
  return {
    snapshotId: 'snapshot-1',
    sourceFrameId: 'frame-1',
    phase: 'serving',
    serving: { satelliteId: 'sat-a', beamId: 1 } as unknown as HomepageRailProjection['serving'],
    candidates: [
      { satelliteId: 'sat-b', beamId: 2 },
      { satelliteId: 'sat-c', beamId: 3 },
    ] as unknown as HomepageRailProjection['candidates'],
    visibleCandidates: [
      { satelliteId: 'sat-b', beamId: 2 },
      { satelliteId: 'sat-c', beamId: 3 },
    ] as unknown as HomepageRailProjection['candidates'],
    overflowKeys: [],
    counts: { total: 2, visible: 2, hidden: 0 } as unknown as HomepageRailProjection['counts'],
    activeDataLinkCount: 1,
    beamMetrics: {
      sourceFrameId: 'frame-1',
      snapshotId: 'snapshot-1',
      simTimeSec: 10,
      metrics: [
        { satelliteId: 'sat-a', beamId: 1, energyEfficiencyBitsPerJoule: 80 },
        { satelliteId: 'sat-a', beamId: 2, energyEfficiencyBitsPerJoule: 90 },
        { satelliteId: 'sat-b', beamId: 2, energyEfficiencyBitsPerJoule: 20 },
        { satelliteId: 'sat-b', beamId: 5, energyEfficiencyBitsPerJoule: 40 },
        { satelliteId: 'sat-c', beamId: 3, energyEfficiencyBitsPerJoule: 30 },
      ] as unknown as NonNullable<HomepageRailProjection['beamMetrics']>['metrics'],
    },
  } as unknown as HomepageRailProjection;
}

test('derives ranked teaching roster and intra protagonist from one rail projection', () => {
  const rail = projection();
  const roster = deriveTeachingInterRosterSatelliteIds({ projection: rail });

  assert.deepEqual(roster, ['sat-b', 'sat-c']);
  assert.equal(resolveTeachingIntraSatelliteId({
    projection: rail,
    servingSatelliteId: 'sat-a',
    teachingInterRosterSatelliteIds: roster,
  }), 'sat-b');
});

test('binds intra and inter teaching rows to measured beams and live names', () => {
  const rail = projection();
  const roster = deriveTeachingInterRosterSatelliteIds({ projection: rail });
  const names = new Map([
    ['sat-a', 'Alpha'],
    ['sat-b', 'Beta'],
    ['sat-c', 'Gamma'],
  ]);
  const intra = deriveTeachingIdentityBinding({
    projection: rail,
    homepageSatelliteNameById: names,
    teachingStageKind: 'intra',
    teachingInterRosterSatelliteIds: roster,
    servingElevationDeg: 42,
    comparisonElevationDeg: 35,
  });
  const inter = deriveTeachingIdentityBinding({
    projection: rail,
    homepageSatelliteNameById: names,
    teachingStageKind: 'inter',
    teachingInterRosterSatelliteIds: roster,
    servingElevationDeg: 42,
    comparisonElevationDeg: 35,
  });

  assert.deepEqual(intra.serving, { satelliteLabel: 'Alpha', beamLabel: 'B1', elevationDeg: 42 });
  assert.deepEqual(intra.candidates, [{ satelliteLabel: 'Alpha', beamLabel: 'B2', elevationDeg: 42 }]);
  assert.deepEqual(inter.candidates, [
    { satelliteLabel: 'Beta', beamLabel: 'B5', elevationDeg: 35 },
    { satelliteLabel: 'Gamma', beamLabel: 'B3', elevationDeg: null },
  ]);
});

test('derives same-cell intra and cross-satellite inter scene stories', () => {
  const rail = projection();
  const roster = ['sat-b', 'sat-c'] as const;

  assert.deepEqual(deriveTeachingSceneStoryCandidate({
    teachingStageKind: 'inter',
    projection: rail,
    servingSatelliteId: 'sat-a',
    servingCellId: 2,
    teachingInterRosterSatelliteIds: roster,
    servingBeamCount: 7,
  }), {
    kind: 'inter',
    sourceSatelliteId: 'sat-a',
    sourceCellId: 2,
    targetSatelliteId: 'sat-b',
    targetCellId: null,
    storyKey: 'teaching-inter:sat-a:sat-b:2',
  });

  assert.deepEqual(deriveTeachingSceneStoryCandidate({
    teachingStageKind: 'intra',
    projection: rail,
    servingSatelliteId: 'sat-a',
    servingCellId: 9,
    teachingInterRosterSatelliteIds: roster,
    servingBeamCount: 7,
  }), {
    kind: 'intra',
    sourceSatelliteId: 'sat-a',
    sourceCellId: 0,
    targetSatelliteId: null,
    targetCellId: 0,
    storyKey: 'teaching-intra:sat-a:0',
  });
});

test('projects measured intra presentation into the panel state without a feedback write', () => {
  const simState = {
    panelPrimary: {
      role: 'none', satId: null, beamId: null, sinrDb: null,
      elevationDeg: null, rangeKm: null, status: 'none',
    },
    panelComparison: {
      role: 'none', satId: null, beamId: null, sinrDb: null,
      elevationDeg: null, rangeKm: null, status: 'none',
    },
    servingSatId: 'old-sat',
    servingBeamId: 3,
    servingCellId: 3,
    servingElevationDeg: 10,
    servingRangeKm: 100,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: null,
    comparisonBeamId: null,
    comparisonElevationDeg: null,
    comparisonRangeKm: null,
    comparisonSinrDb: null,
    comparisonKind: null,
    sinrDeltaDb: null,
    sinrDb: -4,
  } as unknown as SimState;
  const presentation: IntraHandoverPresentation = {
    ueId: 'ue-1',
    sourceSatId: 'sat-a',
    sourceCellId: 1,
    targetCellId: 1,
    servingSinrDb: -2,
    candidateSinrDb: 1,
    deltaSinrDb: 3,
    elevationDeg: 35,
    rangeKm: 550,
  };

  const projected = deriveIntraTeachingDisplayState({
    simState,
    visibleManualHandoverActive: true,
    manualHandoverRequest: { kind: 'intra', intraPresentation: presentation },
  });
  assert.equal(projected.panelPrimary.role, 'serving');
  assert.equal(projected.panelPrimary.satId, 'sat-a');
  assert.equal(projected.panelComparison.role, 'pending');
  assert.equal(projected.panelComparison.sinrDb, 1);
  assert.equal(projected.servingCellId, 1);
  assert.equal(projected.comparisonKind, 'pending');
  assert.equal(projected.sinrDb, -2);
  assert.equal(deriveIntraTeachingDisplayState({
    simState,
    visibleManualHandoverActive: false,
    manualHandoverRequest: null,
  }), simState);
});
