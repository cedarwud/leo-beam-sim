#!/usr/bin/env node

import type {
  VisualShowcaseArtifact,
  VisualShowcaseSeries,
  VisualShowcaseTruthOwnershipRecord,
} from '../../scene/visual-showcase-contract';
import {
  DASHBOARD_SERIES_CHANNEL_SPECS,
  buildDashboardSeriesModel,
  getDashboardSeriesChannelExpectedStatus,
  type DashboardSeriesChannelKey,
  type DashboardSeriesModel,
} from './seriesModel';

const assert = {
  equal<TValue>(actual: TValue, expected: TValue, label: string): void {
    if (!Object.is(actual, expected)) {
      throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown, label = 'deepEqual'): void {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
      throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
    }
  },
};

function series<TValue>(
  source: string,
  timesSec: readonly number[],
  values: readonly TValue[],
): VisualShowcaseSeries<TValue> {
  return {
    source,
    timesSec: [...timesSec],
    values: [...values],
  };
}

function truthRecord(note: string): VisualShowcaseTruthOwnershipRecord {
  return {
    owner: 'synthetic-validator-fixture',
    sourceArtifacts: ['fixture-artifact'],
    sourcePaths: ['seriesModel.test.ts'],
    note,
  };
}

function buildFixtureArtifact(): VisualShowcaseArtifact {
  const timesSec = [0, 1] as const;
  const actionScores: readonly number[][] = [
    [0.1, 0.2, 0.9],
    [0.3, 0.8, 0.4],
  ];

  return {
    schemaVersion: 'visual-showcase-v1',
    artifactId: 'dashboard-series-test',
    scenario: {
      id: 'dashboard-series-test',
      profile: 'baseline-one-ue',
      title: 'Dashboard series test',
      description: 'Minimal visual-showcase-v1 fixture for dashboard adapter tests.',
      durationSec: 60,
      defaultStartSec: 0,
      defaultPlaybackSpeed: 1,
      coordinateFrame: 'ecef-km',
      storyKind: 'dashboard-test',
      truthMode: 'producer-fixture',
    },
    provenance: {
      generatedAt: '2026-06-02T00:00:00.000Z',
      producer: {
        name: 'showcase-fixture',
        mode: 'fixture',
      },
      sourceRepos: [
        {
          repoId: 'showcase-fixture',
          path: 'fixture',
          commit: 'fixture',
        },
      ],
      ntnSimCoreCommit: 'fixture',
      sourceCommits: {
        'showcase-fixture': 'fixture',
      },
      sourceArtifactIds: ['fixture-artifact'],
      sourceArtifacts: [
        {
          id: 'fixture-artifact',
          repoId: 'showcase-fixture',
          path: 'fixture',
          role: 'test',
          truthFields: ['sinr', 'handover', 'reward', 'geometry', 'provenance', 'series', 'display'],
        },
      ],
      sourceSchemas: [
        {
          id: 'visual-showcase-v1',
          version: 'v1.1',
          role: 'contract',
          path: 'ntn-sim-core/src/core/contracts/visual-showcase-v1.ts',
        },
      ],
      validation: {
        validator: 'seriesModel.test.ts',
        status: 'test',
        checkedAt: '2026-06-02T00:00:00.000Z',
        notes: [],
      },
      claimBoundary: {
        storyKind: 'dashboard-test',
        allowedClaims: ['test fixture only'],
        forbiddenClaims: ['research result'],
        source: 'seriesModel.test.ts',
      },
      evidenceStatus: {
        status: 'validator-only',
        notes: ['test fixture only'],
      },
      assumptions: [],
    },
    truthOwnership: {
      sinr: truthRecord('SINR samples are fixture-owned.'),
      handover: truthRecord('Handover samples are fixture-owned.'),
      reward: truthRecord('Reward samples are fixture-owned.'),
      geometry: truthRecord('Geometry samples are fixture-owned.'),
      provenance: truthRecord('Provenance samples are fixture-owned.'),
      series: truthRecord('Series samples are fixture-owned.'),
      display: truthRecord('Display samples are fixture-owned.'),
    },
    timebase: {
      sampleHz: 1,
      startEpochIso: '2026-06-02T00:00:00.000Z',
      timesSec: [...timesSec],
      timeMode: 'fixture',
      sourceTimeOffsetSec: 0,
      sourceSlotIndexBySample: [10, 11],
    },
    entities: {
      satellites: [
        {
          id: 'sat-a',
          sourceId: 'producer-sat-a',
          label: 'SAT A',
          shellId: 'shell-a',
          roleHints: ['serving'],
        },
      ],
      ues: [
        {
          id: 'ue-a',
          sourceId: 'producer-ue-a',
          label: 'UE A',
          trajectoryKind: 'fixture',
        },
      ],
      beams: [
        {
          id: 'beam-a',
          sourceId: 'producer-beam-a',
          satelliteId: 'sat-a',
          localBeamIndex: 0,
          label: 'Beam A',
          frequencyReuseGroup: null,
          halfAngleDeg: 1,
        },
      ],
    },
    timeline: timesSec.map((tSec, index) => ({
      tSec,
      sourceRefs: {
        sourceSlotIndex: 10 + index,
        sources: [
          {
            sourceArtifactId: 'fixture-artifact',
            sourcePath: 'fixture',
            sourceSlotIndex: 10 + index,
          },
        ],
      },
      satellites: [
        {
          id: 'sat-a',
          positionEcefKm: [7000 + index, 0, 0],
          coordinateFrameKind: 'ecef-km',
          geo: { latDeg: 24, lonDeg: 121, altKm: 550 },
          visible: true,
          displayRole: 'serving',
        },
      ],
      ues: [
        {
          id: 'ue-a',
          geo: { latDeg: 24, lonDeg: 121 },
          servingSatelliteId: index === 0 ? 'sat-a' : 'sat-b',
          servingBeamId: index === 0 ? 'beam-a' : 'beam-b',
          targetSatelliteId: index === 0 ? 'sat-b' : null,
          targetBeamId: index === 0 ? 'beam-b' : null,
          sinrDb: 12 + index,
          decisionRef: `decision-${index}`,
        },
      ],
      beams: [
        {
          id: 'beam-a',
          satelliteId: 'sat-a',
          role: index === 0 ? 'serving' : 'context',
          center: { latDeg: 24, lonDeg: 121 },
          footprintKm: 16,
        },
      ],
      links: [
        {
          id: `link-${index}`,
          sourceId: 'sat-a',
          targetId: 'ue-a',
          beamId: 'beam-a',
          role: 'serving',
          sinrDb: 12 + index,
        },
      ],
      handoverState: {
        kind: index === 0 ? 'intra-satellite-beam-switch' : 'none',
        phase: index === 0 ? 'prepared' : 'committed',
        phaseSource: 'source',
        sourceHandoverOccurred: index === 0,
        servingSatelliteId: index === 0 ? 'sat-a' : 'sat-b',
        servingBeamId: index === 0 ? 'beam-a' : 'beam-b',
        targetSatelliteId: index === 0 ? 'sat-b' : null,
        targetBeamId: index === 0 ? 'beam-b' : null,
      },
      metrics: {
        primarySinrDb: 10 + index,
        servingSinrDb: 12 + index,
        servingSatelliteId: index === 0 ? 'sat-a' : 'sat-b',
        servingBeamId: index === 0 ? 'beam-a' : 'beam-b',
        throughputMbps: 100 + index * 10,
        rewardScalar: 9 + index,
        rewardVector: {
          throughput: 0.7 + index,
          handover: 0.2 + index,
          loadBalance: 0.1 + index,
        },
      },
    })),
    events: [
      {
        id: 'event-ho-0',
        type: 'handover-prepared',
        tSec: 0,
        title: 'HO prepared',
        entityRefs: ['ue-a', 'beam-a', 'beam-b'],
        truthRefs: ['decision-0'],
      },
      {
        id: 'event-action-1',
        type: 'rl-action',
        tSec: 1,
        title: 'Action selected',
        entityRefs: ['ue-a'],
        truthRefs: ['decision-1'],
      },
    ],
    series: {
      sinrDb: series('series.sinrDb', timesSec, [10, 11]),
      reward: series('series.reward', timesSec, [1.1, 1.2]),
      actionIndex: series('series.actionIndex', timesSec, [3, 4]),
      servingSatellite: series('series.servingSatellite', timesSec, ['sat-a', 'sat-b']),
      handoverPhase: series('series.handoverPhase', timesSec, ['prepared', 'committed']),
    },
    diagnostics: {
      policyName: 'fixture-policy',
      objectiveWeights: {
        throughput: 0.5,
        handover: 0.3,
        loadBalance: 0.2,
      },
      actionScoreKind: 'scalarized',
      stateFeatures: ['sinr'],
      actionLabels: ['a0', 'a1', 'a2', 'a3', 'a4'],
      actionScores: series('diagnostics.actionScores', timesSec, actionScores),
      selectedAction: series('diagnostics.selectedAction', timesSec, [3, 4]),
      rewardComponents: {
        throughput: series('diagnostics.rewardComponents.throughput', timesSec, [0.7, 1.7]),
        handover: series('diagnostics.rewardComponents.handover', timesSec, [0.2, 1.2]),
        loadBalance: series('diagnostics.rewardComponents.loadBalance', timesSec, [0.1, 1.1]),
      },
      decisionFrames: timesSec.map((tSec, index) => ({
        id: `decision-${index}`,
        tSec,
        ueId: 'ue-a',
        sourceUserIndex: 0,
        actionScores: [...actionScores[index]],
        selectedActionIndex: index === 0 ? 3 : 4,
        selectedActionScore: index === 0 ? 0.9 : 0.8,
        runnerUpActionScore: index === 0 ? 0.2 : 0.4,
        scoreMargin: index === 0 ? 0.7 : 0.4,
        decisionActionValidityMask: [true, true, true, true, true],
      })),
    },
    displayHints: {},
  } as unknown as VisualShowcaseArtifact;
}

function channelProvenance(model: DashboardSeriesModel, key: DashboardSeriesChannelKey) {
  return model[key].provenance;
}

function assertChannelStatuses(model: DashboardSeriesModel): void {
  for (const spec of DASHBOARD_SERIES_CHANNEL_SPECS) {
    const provenance = channelProvenance(model, spec.key);
    assert.equal(provenance.plane, 'visual-showcase-v1', `${spec.key} plane`);
    assert.equal(provenance.inventoryField, spec.inventoryField, `${spec.key} inventory field`);
    assert.equal(
      provenance.status,
      getDashboardSeriesChannelExpectedStatus(spec.key),
      `${spec.key} inventory status`,
    );
  }
}

function assertSourceGapChannelsEmpty(model: DashboardSeriesModel): void {
  for (const spec of DASHBOARD_SERIES_CHANNEL_SPECS) {
    if (channelProvenance(model, spec.key).status !== 'source-gap') continue;
    switch (spec.key) {
      case 'rewardScalar':
        assert.equal(model.rewardScalar.primary.values.length, 0, 'source-gap rewardScalar primary is empty');
        assert.equal(model.rewardScalar.timeline.values.length, 0, 'source-gap rewardScalar timeline is empty');
        break;
      case 'rewardComponents':
        assert.equal(Object.keys(model.rewardComponents.byComponent).length, 0, 'source-gap rewardComponents is empty');
        break;
      case 'objectiveWeights':
        assert.equal(Object.keys(model.objectiveWeights.values).length, 0, 'source-gap objectiveWeights is empty');
        break;
      case 'selectedAction':
        assert.equal(model.selectedAction.actionIndex.values.length, 0, 'source-gap selectedAction actionIndex is empty');
        assert.equal(model.selectedAction.selectedAction.values.length, 0, 'source-gap selectedAction selectedAction is empty');
        assert.equal(model.selectedAction.timelineDecisions.length, 0, 'source-gap selectedAction timeline is empty');
        assert.equal(model.selectedAction.decisionFrames.length, 0, 'source-gap selectedAction decisionFrames is empty');
        break;
      case 'actionScores':
        assert.equal(model.actionScores.dense.values.length, 0, 'source-gap actionScores dense is empty');
        assert.equal(model.actionScores.decisionFrames.length, 0, 'source-gap actionScores decisionFrames is empty');
        break;
      case 'servingSatellite':
        assert.equal(model.servingSatellite.series.values.length, 0, 'source-gap servingSatellite is empty');
        break;
      case 'handover':
        assert.equal(model.handover.phase.values.length, 0, 'source-gap handover phase is empty');
        assert.equal(model.handover.states.length, 0, 'source-gap handover states is empty');
        assert.equal(model.handover.events.length, 0, 'source-gap handover events is empty');
        break;
      case 'sinr':
        assert.equal(model.sinr.primary.values.length, 0, 'source-gap sinr primary is empty');
        assert.equal(model.sinr.serving.values.length, 0, 'source-gap sinr serving is empty');
        break;
      case 'throughput':
        assert.equal(model.throughput.series.values.length, 0, 'source-gap throughput is empty');
        break;
    }
  }
}

console.log('seriesModel.test');

{
  const model = buildDashboardSeriesModel(null);
  for (const spec of DASHBOARD_SERIES_CHANNEL_SPECS) {
    const provenance = channelProvenance(model, spec.key);
    assert.equal(provenance.plane, 'visual-showcase-v1', `${spec.key} null plane`);
    assert.equal(provenance.status, 'source-gap', `${spec.key} null source-gap`);
  }
  assertSourceGapChannelsEmpty(model);
}

{
  const artifact = buildFixtureArtifact();
  const model = buildDashboardSeriesModel(artifact);

  assertChannelStatuses(model);
  assert.deepEqual(model.rewardScalar.primary.values, [1.1, 1.2]);
  assert.deepEqual(model.rewardScalar.timeline.values, [9, 10]);
  assert.deepEqual(model.rewardComponents.byComponent.throughput?.values, [0.7, 1.7]);
  assert.deepEqual(model.objectiveWeights.values, { throughput: 0.5, handover: 0.3, loadBalance: 0.2 });
  assert.deepEqual(model.selectedAction.actionIndex.values, [3, 4]);
  assert.deepEqual(model.selectedAction.selectedAction.values, [3, 4]);
  assert.equal(model.selectedAction.timelineDecisions.length, 0, 'retired decision timeline is not consumed');
  assert.equal(model.selectedAction.decisionFrames[1]?.selectedActionIndex, 4, 'decision frame selected action');
  assert.deepEqual(model.actionScores.dense.values, [[0.1, 0.2, 0.9], [0.3, 0.8, 0.4]]);
  assert.deepEqual(model.actionScores.decisionFrames[0]?.actionScores, [0.1, 0.2, 0.9]);
  assert.deepEqual(model.servingSatellite.series.values, ['sat-a', 'sat-b']);
  assert.deepEqual(model.handover.phase.values, ['prepared', 'committed']);
  assert.equal(model.handover.states[0]?.phase, 'prepared', 'handover state phase');
  // Handover channel carries ONLY handover-typed events; the fixture's
  // rl-action event must be filtered out (it is a flowchart event, not a HO).
  assert.deepEqual(
    model.handover.events.map(event => ({ id: event.id, type: event.type, tSec: event.tSec })),
    [
      { id: 'event-ho-0', type: 'handover-prepared', tSec: 0 },
    ],
  );
  assert.equal(
    model.handover.events.some(event => event.type === 'rl-action'),
    false,
    'handover channel excludes non-handover events',
  );
  assert.deepEqual(model.sinr.primary.values, [10, 11]);
  assert.deepEqual(model.sinr.serving.values, [12, 13]);
  assert.deepEqual(model.throughput.series.values, [100, 110]);
  assertSourceGapChannelsEmpty(model);
}

{
  const artifact = buildFixtureArtifact();
  const missingActionScores = {
    ...artifact,
    diagnostics: {
      ...artifact.diagnostics,
      actionScores: undefined,
      decisionFrames: [],
    },
  } as unknown as VisualShowcaseArtifact;
  const model = buildDashboardSeriesModel(missingActionScores);
  assert.equal(model.actionScores.provenance.status, 'source-gap', 'missing actionScores resolves to source-gap');
  assert.equal(model.actionScores.dense.values.length, 0, 'missing actionScores has no dense values');
  assert.equal(model.actionScores.decisionFrames.length, 0, 'missing actionScores has no decisionFrames');
  assertSourceGapChannelsEmpty(model);
}

console.log('[seriesModel.test] PASS');
