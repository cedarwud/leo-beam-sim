import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  type CandidateDecisionState,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import type { CandidateOpportunitySet } from '../../engine/handover/candidateOpportunityProducer';
import type { CandidatePresentationLink } from '../../engine/handover/candidatePresentationPlan';
import type { LinkSample } from '../../engine/signal/types';
import { createEmptyFrame } from '../../scene/simulationHelpers';
import type { SinrLiveCandidateProbeEvidence } from '../../scene/sinrLiveCellModel';
import type { SimFrame } from '../../scene/types';
import type {
  HomepageAcceptedSnapshot,
  HomepageSourceFrame,
} from './contracts';
import { buildHomepageBeamMetrics } from './beamMetrics';
import { homepageSatelliteColorForBeam } from './homepageSatelliteVisualIdentity';

const SOURCE_FRAME_ID = 'homepage-beam-metrics-frame-1';
const SNAPSHOT_ID = 'homepage-beam-metrics-snapshot-1';

function cell(beamId: number) {
  return {
    beamId,
    offsetEastKm: 0,
    offsetNorthKm: 0,
    scanAngleDeg: 0,
  };
}

function angleAwareTerms(
  throughputBps: number,
  powerConsumptionW: number,
  gammaDb = 8,
  systemPowerW = powerConsumptionW,
  timeSec = 10,
) {
  return {
    timeSec,
    previousTimeSec: null,
    previousThetaRad: null,
    previousPowerW: null,
    previousTransmitGainLinear: null,
    segmentStartTimeSec: 10,
    segmentStartThetaRad: 0,
    segmentStartTransmitGainLinear: 1,
    segmentStartPowerW: powerConsumptionW,
    thetaRad: 0,
    distanceM: 1_000,
    powerW: powerConsumptionW,
    transmitGainLinear: 1,
    channelGainLinear: 1,
    desiredSignalW: 1,
    interferenceW: 0,
    noiseW: 1,
    gammaLinear: 1,
    gammaDb,
    bandwidthHz: 1,
    beamLoad: 1,
    throughputBps,
    conversionEfficiency: 1,
    powerConsumptionW,
    fixedPowerW: 0,
    systemPowerW,
    energyEfficiencyBitsPerJoule: throughputBps / Math.max(systemPowerW, 1e-30),
  };
}

function linkSample(
  ueId: string,
  satelliteId: string,
  beamId: number,
  throughputBps: number,
  powerConsumptionW: number,
  gammaDb = 8,
  systemPowerW = powerConsumptionW,
  timeSec = 10,
): LinkSample {
  return {
    ueId,
    satId: satelliteId,
    beamId,
    rsrpDbm: -80,
    sinrDb: gammaDb,
    signalDbm: -80,
    intraInterferenceDbm: -100,
    interInterferenceDbm: -100,
    noiseDbm: -110,
    denominatorDbm: -79,
    txPowerDbm: 20,
    pathLossDb: 100,
    beamGainDb: 10,
    steeringLossDb: 0,
    receiverGainDbi: 0,
    angleAware: angleAwareTerms(throughputBps, powerConsumptionW, gammaDb, systemPowerW, timeSec),
  };
}

function ueRecord(
  ueId: string,
  satelliteId: string,
  beamId: number,
  throughputBps: number,
  powerConsumptionW: number,
  gammaDb = 8,
  systemPowerW = powerConsumptionW,
) {
  return {
    ueId,
    cellId: 0,
    cellDistanceKm: 0,
    offAxisDeg: 0,
    servingSatId: satelliteId,
    servingBeamId: beamId,
    beamIdentity: `${satelliteId}#beam${beamId}`,
    frequencyIndex: 0,
    sinrDb: gammaDb,
    servingLinkSample: linkSample(
      ueId,
      satelliteId,
      beamId,
      throughputBps,
      powerConsumptionW,
      gammaDb,
      systemPowerW,
    ),
    handoverKind: 'none' as const,
  };
}

function opportunity(
  sourceFrameId: string,
  satelliteId: string,
  beamId: number,
  sinrDb = 12,
): CandidateOpportunity {
  return {
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-primary',
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: {} as CandidateOpportunity['elevation'],
    steering: {} as CandidateOpportunity['steering'],
    range: {} as CandidateOpportunity['range'],
    sinr: {
      status: 'available',
      value: sinrDb,
      unit: 'dB',
      sourceFrameId,
      reason: null,
    },
    predictedThroughput: {} as CandidateOpportunity['predictedThroughput'],
    remainingServiceTime: {} as CandidateOpportunity['remainingServiceTime'],
    forecastEe: null,
    gates: [],
  };
}

function opportunitySet(
  sourceFrameId: string,
  pairs: readonly [string, number][],
): CandidateOpportunitySet {
  return {
    primaryUeId: 'ue-primary',
    sourceFrameId,
    opportunities: pairs.map(([satelliteId, beamId]) => (
      opportunity(sourceFrameId, satelliteId, beamId)
    )),
    counts: {
      observed: pairs.length,
      geometricallyReachable: pairs.length,
      steeringValid: pairs.length,
      scheduledAndIlluminated: pairs.length,
      serviceEligible: pairs.length,
    },
  };
}

function candidateProbe(
  sourceFrameId: string,
  simTimeSec: number,
  satelliteId: string,
  beamId: number,
  throughputBps = 240,
  powerConsumptionW = 3,
  gammaDb = 15,
  systemPowerW = powerConsumptionW,
): SinrLiveCandidateProbeEvidence {
  return {
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-primary',
    sourceFrameId,
    simTimeSec,
    provenance: 'primary-ue-same-frame-angle-aware-display-only',
    eeBasis: 'candidate-probe',
    status: 'available',
    sample: linkSample(
      'ue-primary',
      satelliteId,
      beamId,
      throughputBps,
      powerConsumptionW,
      gammaDb,
      systemPowerW,
      simTimeSec,
    ),
    reason: null,
  };
}

function snapshotLink(
  sourceFrameId: string,
  satelliteId: string,
  beamId: number,
  isCandidate: boolean,
): CandidatePresentationLink {
  const key = candidateLinkKey(satelliteId, beamId);
  const joinKey = `${sourceFrameId}/link/${satelliteId}|${beamId}`;
  return {
    joinKey,
    sceneJoinKey: joinKey,
    railJoinKey: joinKey,
    key,
    sourceFrameId,
    satelliteId,
    beamId,
    displayKey: `${satelliteId} / B${beamId}`,
    opportunity: null,
    state: null,
    role: 'observed',
    isServing: false,
    isCandidate,
    isPinned: false,
    satelliteIdentity: {} as CandidatePresentationLink['satelliteIdentity'],
    beamIdentity: null,
    visual: {
      role: 'observed',
      footprintStyle: 'dotted',
      coneStyle: 'hidden',
      dataLinkStyle: 'none',
      isMeasurementOnly: true,
      isActiveDataLink: false,
    },
  };
}

function snapshot(
  sourceFrameId = SOURCE_FRAME_ID,
  snapshotId = SNAPSHOT_ID,
  groups: readonly {
    satelliteId: string;
    beamIds: readonly number[];
    isCandidate?: boolean;
  }[] = [],
): HomepageAcceptedSnapshot {
  return {
    snapshotId,
    sourceFrameId,
    serving: null,
    candidates: [],
    plan: {
      groups: groups.map(group => ({
        satelliteId: group.satelliteId,
        links: group.beamIds.map(beamId => snapshotLink(
          sourceFrameId,
          group.satelliteId,
          beamId,
          group.isCandidate ?? true,
        )),
        beamRoster: group.beamIds.map(beamId => ({
          beamId,
          link: null,
          status: 'not-observed',
          observed: false,
          displayed: false,
        })),
      })),
    },
  } as unknown as HomepageAcceptedSnapshot;
}

interface SourceOptions {
  readonly sourceFrameId?: string;
  readonly simTimeSec?: number;
  readonly serving?: CandidateLinkKey | null;
  readonly opportunities?: CandidateOpportunitySet | null;
  readonly candidateProbes?: readonly SinrLiveCandidateProbeEvidence[] | null;
  readonly ues?: readonly ReturnType<typeof ueRecord>[];
  readonly cellsBySatellite?: ReadonlyMap<string, readonly number[]>;
  readonly activeAssignments?: readonly CandidateLinkKey[];
  readonly illuminated?: readonly { satId: string; cellId: number }[];
  readonly decision?: HandoverDecisionFrame | null;
}

function sourceFrame(options: SourceOptions = {}): HomepageSourceFrame {
  const sourceFrameId = options.sourceFrameId ?? SOURCE_FRAME_ID;
  const simTimeSec = options.simTimeSec ?? 10;
  const serving = options.serving === undefined
    ? candidateLinkKey('sat-serving', 2)
    : options.serving;
  const frame = createEmptyFrame(simTimeSec);
  const cellsBySatellite = options.cellsBySatellite ?? new Map<string, readonly number[]>([
    ['sat-serving', [1, 2, 3]],
  ]);
  frame.beamCellsBySatId = new Map(
    [...cellsBySatellite.entries()].map(([satelliteId, beamIds]) => [
      satelliteId,
      beamIds.map(cell),
    ]),
  );
  frame.activeAssignments = (options.activeAssignments ?? []).map(key => ({
    satId: key.satelliteId,
    beamId: key.beamId,
  }));
  frame.displayAssignments = [];
  frame.sinrLiveCells = {
    simTimeSec,
    sourceFrameId,
    cells: [],
    ues: options.ues ?? [],
    primaryUeId: 'ue-primary',
    primaryCandidateOpportunities: options.opportunities ?? null,
    primaryCandidateProbeEvidence: options.candidateProbes,
    illuminatedBeams: (options.illuminated ?? []).map(beam => ({
      ...beam,
      frequencyIndex: 0,
      serving: false,
    })),
    servedCellCount: 0,
    servedUeCount: options.ues?.length ?? 0,
    servingSatCount: 0,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
  };

  return Object.freeze({
    frame: frame as SimFrame,
    sourceFrameId,
    epochToken: `epoch:${sourceFrameId}`,
    simTimeMs: simTimeSec * 1_000,
    simTimeSec,
    dtSec: 0,
    primaryUeId: 'ue-primary',
    serving,
    opportunitySet: options.opportunities ?? null,
    decision: options.decision ?? null,
  });
}

function decisionState(
  key: CandidateLinkKey,
  hardEligibility: CandidateDecisionState['hardEligibility'],
): CandidateDecisionState {
  return {
    key,
    hardEligibility,
    triggerStatus: hardEligibility === 'eligible' ? 'not-satisfied' : 'unavailable',
    qualificationSec: 0,
    requiredTttSec: 1,
    stable: false,
    rank: null,
    rejectionCodes: [],
  };
}

function decisionFrame(sourceFrameId = SOURCE_FRAME_ID): HandoverDecisionFrame {
  const hardEligible = opportunity(sourceFrameId, 'sat-hard-eligible', 4);
  const observed = opportunity(sourceFrameId, 'sat-observed', 5);
  return {
    episodeId: 'homepage-beam-metrics-decision-1',
    sourceFrameId,
    epochToken: `epoch:${sourceFrameId}`,
    simTimeMs: 10_000,
    phase: 'qualifying',
    serving: candidateLinkKey('sat-serving', 2),
    opportunities: [hardEligible, observed],
    states: [
      decisionState(hardEligible.key, 'eligible'),
      decisionState(observed.key, 'ineligible'),
    ],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  };
}

function acceptedSnapshotForDecision(
  sourceFrameId: string,
  snapshotId: string,
  decision: HandoverDecisionFrame,
  groups: readonly { satelliteId: string; beamIds: readonly number[]; isCandidate?: boolean }[],
): HomepageAcceptedSnapshot {
  return {
    ...snapshot(sourceFrameId, snapshotId, groups),
    episodeId: decision.episodeId,
    primaryUeId: 'ue-primary',
    epochToken: decision.epochToken,
    simTimeMs: decision.simTimeMs,
    phase: decision.phase,
    policyMode: 'instantaneous-ee-optimization',
    activeTriggerObjective: 'instantaneous-ee-max',
    activeHardGateProfile: 'sinr-compatibility',
    eeActivationStatus: 'active',
    policyConfigHash: 'test-homepage-ee-hierarchy',
    serving: null,
    servingOrigin: 'bootstrap-serving-seed',
    candidates: [],
    overflowKeys: [],
    counts: {
      observed: decision.opportunities.length,
      hardEligible: decision.states.filter(state => state.hardEligibility === 'eligible').length,
      triggerSatisfied: decision.states.filter(state => state.triggerStatus === 'satisfied').length,
      tttStable: decision.states.filter(state => state.stable).length,
      displayed: decision.opportunities.length,
      overflow: 0,
    },
    activeDataLinkCount: 1,
    commit: null,
    handoverEvidence: null,
    decision,
  } as unknown as HomepageAcceptedSnapshot;
}

function metricFor(
  projection: ReturnType<typeof buildHomepageBeamMetrics>,
  satelliteId: string,
  beamId: number,
) {
  const metric = projection.metrics.find(item => (
    item.satelliteId === satelliteId && item.beamId === beamId
  ));
  assert.ok(metric, `expected ${satelliteId}|${beamId}`);
  return metric;
}

test('preserves same-frame identity and stable pair joins', () => {
  const input = {
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
      ues: [ueRecord('ue-primary', 'sat-serving', 2, 100, 2)],
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [4] }]),
    servingBeamCount: 3,
    candidateBeamCount: 1,
  };
  const first = buildHomepageBeamMetrics(input);
  const second = buildHomepageBeamMetrics(input);

  assert.deepEqual(first, second);
  assert.equal(first.sourceFrameId, SOURCE_FRAME_ID);
  assert.equal(first.snapshotId, SNAPSHOT_ID);
  for (const metric of first.metrics) {
    assert.equal(metric.sourceFrameId, SOURCE_FRAME_ID);
    assert.equal(metric.snapshotId, SNAPSHOT_ID);
    assert.equal(metric.joinKey, `${metric.satelliteId}|${metric.beamId}`);
    assert.equal(metric.key.satelliteId, metric.satelliteId);
    assert.equal(metric.key.beamId, metric.beamId);
  }
});

test('distinguishes the exact primary serving pair from same-satellite context', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      ues: [ueRecord('ue-primary', 'sat-serving', 2, 100, 2)],
      activeAssignments: [candidateLinkKey('sat-serving', 1)],
    }),
    snapshot: snapshot(),
    servingBeamCount: 3,
    candidateBeamCount: 1,
  });
  const serving = metricFor(projection, 'sat-serving', 2);
  const context = metricFor(projection, 'sat-serving', 1);

  assert.equal(serving.role, 'serving');
  assert.equal(serving.isPrimaryServing, true);
  assert.equal(context.role, 'observed');
  assert.equal(context.isPrimaryServing, false);
  assert.equal(serving.color.hueDegrees, context.color.hueDegrees);
  assert.notEqual(serving.color.color, context.color.color);
});

test('keeps the candidate primary on the primary identity tier across commit', () => {
  const candidate = candidateLinkKey('sat-candidate', 4);
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [4] }]),
    servingBeamCount: 3,
    candidateBeamCount: 1,
  });
  const metric = metricFor(projection, candidate.satelliteId, candidate.beamId);
  const primaryTier = homepageSatelliteColorForBeam(candidate.satelliteId, candidate.beamId, {
    isServing: true,
  });

  assert.equal(metric.role, 'candidate');
  assert.deepEqual(metric.color, primaryTier);
});

test('does not promote opportunity-only or observed records to candidate role', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-observed', 4]]),
      cellsBySatellite: new Map([
        ['sat-serving', [2]],
        ['sat-observed', [4]],
      ]),
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{
      satelliteId: 'sat-observed',
      beamIds: [4],
      isCandidate: false,
    }]),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });

  assert.equal(metricFor(projection, 'sat-observed', 4).role, 'observed');
});

test('takes candidate role from hard-eligible decision state, not every decision opportunity', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      cellsBySatellite: new Map([
        ['sat-serving', [2]],
        ['sat-hard-eligible', [4]],
        ['sat-observed', [5]],
      ]),
      decision: decisionFrame(),
    }),
    snapshot: null,
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });

  assert.equal(metricFor(projection, 'sat-hard-eligible', 4).role, 'candidate');
  assert.equal(metricFor(projection, 'sat-observed', 5).role, 'observed');
});

test('uses the primary UE for serving-story values instead of mixing background UEs into candidates', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      ues: [
        ueRecord('ue-primary', 'sat-serving', 2, 100, 2),
        ueRecord('ue-secondary', 'sat-serving', 2, 50, 1),
      ],
    }),
    snapshot: snapshot(),
    servingBeamCount: 3,
    candidateBeamCount: 1,
  });
  const metric = metricFor(projection, 'sat-serving', 2);

  assert.equal(metric.availability, 'available');
  assert.equal(metric.sinrDb, 8);
  assert.equal(metric.throughputBps, 100);
  assert.equal(metric.powerW, 2);
  assert.equal(metric.energyEfficiencyBitsPerJoule, 50);
  assert.equal(metric.eeNormalized, 0.5);
  assert.equal(metric.eeBasis, 'active-assignment');
  assert.equal(projection.availableEeMinBitsPerJoule, 50);
  assert.equal(projection.availableEeMaxBitsPerJoule, 50);
});

test('uses the same frame-level system-power denominator for observed beam EE', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      ues: [
        ueRecord('ue-primary', 'sat-serving', 2, 100, 2, 8, 20),
        ueRecord('ue-secondary', 'sat-serving', 3, 50, 1, 8, 20),
      ],
    }),
    snapshot: snapshot(),
    servingBeamCount: 3,
    candidateBeamCount: 1,
  });
  const observed = metricFor(projection, 'sat-serving', 3);

  assert.equal(observed.role, 'observed');
  assert.equal(observed.throughputBps, 50);
  assert.equal(observed.powerW, 1);
  assert.equal(observed.energyEfficiencyBitsPerJoule, 2.5);
  assert.notEqual(observed.energyEfficiencyBitsPerJoule, 50);
});

test('uses configured per-satellite roster counts and stable configured beam ids', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 19]]),
      cellsBySatellite: new Map([
        ['sat-serving', Array.from({ length: 7 }, (_, index) => index + 1)],
        ['sat-candidate', Array.from({ length: 19 }, (_, index) => index + 1)],
      ]),
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{
      satelliteId: 'sat-candidate',
      beamIds: Array.from({ length: 19 }, (_, index) => index + 1),
    }]),
    servingBeamCount: 7,
    candidateBeamCount: 19,
  });

  assert.equal(projection.metrics.filter(metric => metric.satelliteId === 'sat-serving').length, 7);
  assert.equal(projection.metrics.filter(metric => metric.satelliteId === 'sat-candidate').length, 19);
  assert.deepEqual(
    projection.metrics
      .filter(metric => metric.satelliteId === 'sat-candidate')
      .map(metric => metric.beamId)
      .sort((left, right) => left - right),
    Array.from({ length: 19 }, (_, index) => index + 1),
  );
});

test('throws clearly when neither the satellite override nor the role budget is usable', () => {
  // `requestedCount` used to be nullable, and null meant "no cap, and skip the
  // roster completion". With a sparse source map that silently produced a rail
  // with a couple of rows and no error -- the shape of the reported "I only see
  // a few beams". The budget authority is the profile, upstream; this module
  // must not guess a default, so it says so instead.
  const sparse = {
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 2]]),
      cellsBySatellite: new Map([
        ['sat-serving', [1]],
        ['sat-candidate', [1, 2]],
      ]),
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [2] }]),
  };

  assert.throws(
    () => buildHomepageBeamMetrics({ ...sparse, servingBeamCount: 0, candidateBeamCount: 19 }),
    (error: unknown) => error instanceof TypeError
      && /no usable beam budget for sat-serving/.test((error as Error).message),
    'a serving budget of 0 is not a budget',
  );

  assert.throws(
    () => buildHomepageBeamMetrics({ ...sparse, servingBeamCount: 7, candidateBeamCount: 0 }),
    (error: unknown) => error instanceof TypeError
      && /no usable beam budget for sat-candidate/.test((error as Error).message),
    'the candidate role path must be protected too, not only the serving one',
  );

  // Non-finite and negative are the same class of unusable, and used to take
  // the same silent path.
  for (const unusable of [Number.NaN, Number.POSITIVE_INFINITY, -3]) {
    assert.throws(
      () => buildHomepageBeamMetrics({ ...sparse, servingBeamCount: unusable, candidateBeamCount: 19 }),
      TypeError,
      `serving budget ${String(unusable)} must be refused, not treated as "show what you have"`,
    );
  }

  // The error must name what was wrong, or it is not a usable red signal.
  try {
    buildHomepageBeamMetrics({ ...sparse, servingBeamCount: 0, candidateBeamCount: 19 });
    assert.fail('expected a throw');
  } catch (error) {
    assert.match((error as Error).message, /role count 0/);
    assert.match((error as Error).message, /finite number >= 1/);
  }
});

test('a per-satellite override rescues an unusable role budget rather than throwing', () => {
  // The throw is for "no budget at all". An explicit per-satellite budget is a
  // budget, so it must still win over an unusable role count.
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 2]]),
      cellsBySatellite: new Map([
        ['sat-serving', [1]],
        ['sat-candidate', [1, 2]],
      ]),
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [2] }]),
    servingBeamCount: 0,
    candidateBeamCount: 0,
    beamCountBySatellite: { 'sat-serving': 7, 'sat-candidate': 7 },
  });
  assert.equal(projection.metrics.filter(metric => metric.satelliteId === 'sat-serving').length, 7);
  assert.equal(projection.metrics.filter(metric => metric.satelliteId === 'sat-candidate').length, 7);
});

test('fills a sparse source roster to the requested count without inventing values', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 14]]),
      cellsBySatellite: new Map([
        ['sat-serving', [1]],
        ['sat-candidate', Array.from({ length: 14 }, (_, index) => index + 1)],
      ]),
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [14] }]),
    servingBeamCount: 1,
    candidateBeamCount: 19,
  });

  const candidateMetrics = projection.metrics.filter(metric => metric.satelliteId === 'sat-candidate');
  assert.equal(candidateMetrics.length, 19);
  assert.deepEqual(
    candidateMetrics.map(metric => metric.beamId).sort((left, right) => left - right),
    Array.from({ length: 19 }, (_, index) => index + 1),
  );
  for (const metric of candidateMetrics.filter(metric => metric.beamId > 14)) {
    assert.equal(metric.availability, 'idle');
    assert.equal(metric.powerW, null);
    assert.equal(metric.throughputBps, null);
    assert.equal(metric.energyEfficiencyBitsPerJoule, null);
  }
});

test('keeps missing candidate display-probe power, rate, and EE explicitly unavailable', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
      cellsBySatellite: new Map([['sat-candidate', [4]]]),
      ues: [ueRecord('ue-primary', 'sat-serving', 2, 100, 2)],
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [4] }]),
    servingBeamCount: 3,
    candidateBeamCount: 1,
  });
  const candidate = metricFor(projection, 'sat-candidate', 4);

  assert.equal(candidate.role, 'candidate');
  assert.equal(candidate.availability, 'unavailable');
  assert.equal(candidate.powerW, null);
  assert.equal(candidate.throughputBps, null);
  assert.equal(candidate.energyEfficiencyBitsPerJoule, null);
  assert.equal(candidate.eeNormalized, null);
  assert.match(candidate.reason ?? '', /candidate display-only power, rate, and instantaneous EE are unavailable/);
  assert.equal(Object.prototype.hasOwnProperty.call(candidate, 'forecastEe'), false);
});

test('retains finite values from the previous same-role projection with current identity', () => {
  const previousSourceFrame = sourceFrame({
    sourceFrameId: 'homepage-beam-metrics-frame-before',
    simTimeSec: 9,
    opportunities: opportunitySet('homepage-beam-metrics-frame-before', [['sat-candidate', 4]]),
    cellsBySatellite: new Map([
      ['sat-serving', [2]],
      ['sat-candidate', [4]],
    ]),
    candidateProbes: [candidateProbe(
      'homepage-beam-metrics-frame-before',
      9,
      'sat-candidate',
      4,
      1_200,
      4,
      15,
      20,
    )],
    ues: [ueRecord('ue-primary', 'sat-serving', 2, 100, 2)],
  });
  const previousMetrics = buildHomepageBeamMetrics({
    sourceFrame: previousSourceFrame,
    snapshot: snapshot(
      'homepage-beam-metrics-frame-before',
      'homepage-beam-metrics-snapshot-before',
      [{ satelliteId: 'sat-candidate', beamIds: [4] }],
    ),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });
  const currentSourceFrame = sourceFrame({
    sourceFrameId: 'homepage-beam-metrics-frame-after',
    simTimeSec: 10,
    cellsBySatellite: new Map([
      ['sat-serving', [2]],
      ['sat-candidate', [4]],
    ]),
  });
  const currentMetrics = buildHomepageBeamMetrics({
    sourceFrame: currentSourceFrame,
    snapshot: snapshot(
      'homepage-beam-metrics-frame-after',
      'homepage-beam-metrics-snapshot-after',
      [{ satelliteId: 'sat-candidate', beamIds: [4] }],
    ),
    servingBeamCount: 1,
    candidateBeamCount: 1,
    previousMetrics,
  });

  const serving = metricFor(currentMetrics, 'sat-serving', 2);
  assert.equal(serving.sinrDb, 8);
  assert.equal(serving.powerW, 2);
  assert.equal(serving.throughputBps, 100);
  assert.equal(serving.energyEfficiencyBitsPerJoule, 50);
  const candidate = metricFor(currentMetrics, 'sat-candidate', 4);
  assert.equal(candidate.role, 'candidate');
  assert.equal(candidate.sinrDb, 15);
  assert.equal(candidate.powerW, 4);
  assert.equal(candidate.throughputBps, 1_200);
  assert.equal(candidate.energyEfficiencyBitsPerJoule, 60);
  for (const metric of [serving, candidate]) {
    assert.equal(metric.sourceFrameId, 'homepage-beam-metrics-frame-after');
    assert.equal(metric.snapshotId, 'homepage-beam-metrics-snapshot-after');
  }
});

test('does not retain a prior story sample across a seek while the pair remains present', () => {
  const previousSourceFrame = sourceFrame({
    sourceFrameId: 'homepage-beam-metrics-frame-before-seek',
    simTimeSec: 9,
    opportunities: opportunitySet('homepage-beam-metrics-frame-before-seek', [['sat-candidate', 4]]),
    cellsBySatellite: new Map([
      ['sat-serving', [2]],
      ['sat-candidate', [4]],
    ]),
    candidateProbes: [candidateProbe(
      'homepage-beam-metrics-frame-before-seek',
      9,
      'sat-candidate',
      4,
    )],
    ues: [ueRecord('ue-primary', 'sat-serving', 2, 100, 2)],
  });
  const previousMetrics = buildHomepageBeamMetrics({
    sourceFrame: previousSourceFrame,
    snapshot: snapshot(
      'homepage-beam-metrics-frame-before-seek',
      'homepage-beam-metrics-snapshot-before-seek',
      [{ satelliteId: 'sat-candidate', beamIds: [4] }],
    ),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });
  const currentMetrics = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      sourceFrameId: 'homepage-beam-metrics-frame-after-seek',
      simTimeSec: 2,
      cellsBySatellite: new Map([
        ['sat-serving', [2]],
        ['sat-candidate', [4]],
      ]),
    }),
    snapshot: snapshot(
      'homepage-beam-metrics-frame-after-seek',
      'homepage-beam-metrics-snapshot-after-seek',
      [{ satelliteId: 'sat-candidate', beamIds: [4] }],
    ),
    servingBeamCount: 1,
    candidateBeamCount: 1,
    previousMetrics,
  });

  const candidate = metricFor(currentMetrics, 'sat-candidate', 4);
  assert.equal(candidate.role, 'candidate');
  assert.equal(candidate.availability, 'unavailable');
  assert.equal(candidate.sinrDb, null);
  assert.equal(candidate.powerW, null);
  assert.equal(candidate.throughputBps, null);
  assert.equal(candidate.energyEfficiencyBitsPerJoule, null);
});

test('does not retain values across a role change or fabricate a missing pair', () => {
  const previousMetrics = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      sourceFrameId: 'homepage-beam-metrics-frame-before-role',
      simTimeSec: 9,
      opportunities: opportunitySet('homepage-beam-metrics-frame-before-role', [['sat-candidate', 4]]),
      cellsBySatellite: new Map([
        ['sat-serving', [2]],
        ['sat-candidate', [4]],
      ]),
      candidateProbes: [candidateProbe(
        'homepage-beam-metrics-frame-before-role',
        9,
        'sat-candidate',
        4,
      )],
    }),
    snapshot: snapshot(
      'homepage-beam-metrics-frame-before-role',
      'homepage-beam-metrics-snapshot-before-role',
      [{ satelliteId: 'sat-candidate', beamIds: [4] }],
    ),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });
  const currentMetrics = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      sourceFrameId: 'homepage-beam-metrics-frame-after-role',
      cellsBySatellite: new Map([
        ['sat-serving', [2]],
        ['sat-candidate', [4]],
        ['sat-new', [7]],
      ]),
    }),
    snapshot: snapshot(
      'homepage-beam-metrics-frame-after-role',
      'homepage-beam-metrics-snapshot-after-role',
      [
        { satelliteId: 'sat-candidate', beamIds: [4], isCandidate: false },
        { satelliteId: 'sat-new', beamIds: [7], isCandidate: true },
      ],
    ),
    servingBeamCount: 1,
    candidateBeamCount: 1,
    previousMetrics,
  });

  const observed = metricFor(currentMetrics, 'sat-candidate', 4);
  assert.equal(observed.role, 'observed');
  assert.equal(observed.sinrDb, null);
  assert.equal(observed.powerW, null);
  assert.equal(observed.throughputBps, null);
  assert.equal(observed.energyEfficiencyBitsPerJoule, null);
  const newCandidate = metricFor(currentMetrics, 'sat-new', 7);
  assert.equal(newCandidate.role, 'candidate');
  assert.equal(newCandidate.sinrDb, null);
  assert.equal(newCandidate.powerW, null);
  assert.equal(newCandidate.throughputBps, null);
  assert.equal(newCandidate.energyEfficiencyBitsPerJoule, null);
});

test('projects same-frame candidate probe Power, Throughput, and instantaneous EE', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
      cellsBySatellite: new Map([
        ['sat-serving', [2]],
        ['sat-candidate', [4]],
      ]),
      candidateProbes: [candidateProbe(SOURCE_FRAME_ID, 10, 'sat-candidate', 4, 1200, 4, 15, 20)],
      ues: [ueRecord('ue-primary', 'sat-serving', 2, 100, 2)],
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [4] }]),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });
  const candidate = metricFor(projection, 'sat-candidate', 4);

  assert.equal(candidate.availability, 'available');
  assert.equal(candidate.powerW, 4);
  assert.equal(candidate.throughputBps, 1200);
  assert.equal(candidate.energyEfficiencyBitsPerJoule, 60);
  assert.equal(candidate.eeBasis, 'candidate-probe');
  assert.equal(candidate.provenance, 'primary-ue-same-frame-angle-aware-display-only');
  assert.equal(candidate.eeNormalized, 1);
});

test('homepage handover hierarchy keeps ordinary beams below service and raises only accepted targets', () => {
  const intraTarget = candidateLinkKey('sat-serving', 4);
  const intraDecision: HandoverDecisionFrame = {
    ...decisionFrame(SOURCE_FRAME_ID),
    opportunities: [opportunity(SOURCE_FRAME_ID, intraTarget.satelliteId, intraTarget.beamId)],
    states: [{
      ...decisionState(intraTarget, 'eligible'),
      triggerStatus: 'satisfied',
      stable: true,
      rank: 1,
    }],
    provisionalLeader: intraTarget,
    selectedTarget: intraTarget,
    selectedKind: 'intra-satellite',
    phase: 'selection-hold',
    mode: 'ee-optimization',
  };
  const intra = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-serving', 4]]),
      decision: intraDecision,
      cellsBySatellite: new Map([['sat-serving', [2, 3, 4]]]),
      candidateProbes: [candidateProbe(SOURCE_FRAME_ID, 10, 'sat-serving', 4, 80, 2)],
      ues: [
        ueRecord('ue-primary', 'sat-serving', 2, 100, 2),
        ueRecord('ue-background', 'sat-serving', 3, 2_000, 1),
      ],
    }),
    snapshot: acceptedSnapshotForDecision(
      SOURCE_FRAME_ID,
      SNAPSHOT_ID,
      intraDecision,
      [{ satelliteId: 'sat-serving', beamIds: [4], isCandidate: true }],
    ),
    servingBeamCount: 3,
    candidateBeamCount: 1,
    eeDisplayPolicy: 'handover-hierarchy',
  });
  const intraServing = metricFor(intra, 'sat-serving', 2);
  const intraOther = metricFor(intra, 'sat-serving', 3);
  const intraTargetMetric = metricFor(intra, 'sat-serving', 4);
  assert.ok(intraOther.energyEfficiencyBitsPerJoule! < intraServing.energyEfficiencyBitsPerJoule!);
  assert.ok(intraTargetMetric.energyEfficiencyBitsPerJoule! > intraServing.energyEfficiencyBitsPerJoule!);
  assert.equal(intraTargetMetric.eeBasis, 'homepage-handover-hierarchy-display');
  assert.equal(intraTargetMetric.provenance, 'homepage-ee-hierarchy-display-only');

  const interTarget = candidateLinkKey('sat-next', 4);
  const interOther = candidateLinkKey('sat-other', 5);
  const interDecision: HandoverDecisionFrame = {
    ...decisionFrame(SOURCE_FRAME_ID),
    opportunities: [
      opportunity(SOURCE_FRAME_ID, interTarget.satelliteId, interTarget.beamId),
      opportunity(SOURCE_FRAME_ID, interOther.satelliteId, interOther.beamId),
    ],
    states: [
      { ...decisionState(interTarget, 'eligible'), triggerStatus: 'satisfied', stable: true, rank: 1 },
      { ...decisionState(interOther, 'eligible'), triggerStatus: 'satisfied', stable: true, rank: 2 },
    ],
    provisionalLeader: interTarget,
    selectedTarget: interTarget,
    selectedKind: 'inter-satellite',
    phase: 'selection-hold',
    mode: 'ee-optimization',
  };
  const inter = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [
        ['sat-next', 4],
        ['sat-other', 5],
      ]),
      decision: interDecision,
      cellsBySatellite: new Map([
        ['sat-serving', [2, 3]],
        ['sat-next', [4]],
        ['sat-other', [5]],
      ]),
      candidateProbes: [
        candidateProbe(SOURCE_FRAME_ID, 10, 'sat-next', 4, 80, 2),
        candidateProbe(SOURCE_FRAME_ID, 10, 'sat-other', 5, 60, 2),
      ],
      ues: [
        ueRecord('ue-primary', 'sat-serving', 2, 100, 2),
        ueRecord('ue-background', 'sat-serving', 3, 2_000, 1),
      ],
    }),
    snapshot: acceptedSnapshotForDecision(
      SOURCE_FRAME_ID,
      SNAPSHOT_ID,
      interDecision,
      [
        { satelliteId: 'sat-next', beamIds: [4], isCandidate: true },
        { satelliteId: 'sat-other', beamIds: [5], isCandidate: true },
      ],
    ),
    servingBeamCount: 2,
    candidateBeamCount: 1,
    eeDisplayPolicy: 'handover-hierarchy',
  });
  const interServing = metricFor(inter, 'sat-serving', 2);
  const interOtherServingBeam = metricFor(inter, 'sat-serving', 3);
  const interTargetMetric = metricFor(inter, 'sat-next', 4);
  const interOtherCandidateMetric = metricFor(inter, 'sat-other', 5);
  assert.ok(interOtherServingBeam.energyEfficiencyBitsPerJoule! < interServing.energyEfficiencyBitsPerJoule!);
  assert.ok(interTargetMetric.energyEfficiencyBitsPerJoule! > interServing.energyEfficiencyBitsPerJoule!);
  assert.ok(interOtherCandidateMetric.energyEfficiencyBitsPerJoule! > interServing.energyEfficiencyBitsPerJoule!);
  assert.ok(interTargetMetric.energyEfficiencyBitsPerJoule! > interOtherCandidateMetric.energyEfficiencyBitsPerJoule!);
});

test('keeps an explicitly published unavailable candidate probe fail-closed', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
      cellsBySatellite: new Map([['sat-candidate', [4]]]),
      candidateProbes: [{
        ...candidateProbe(SOURCE_FRAME_ID, 10, 'sat-candidate', 4),
        status: 'unavailable',
        sample: null,
        reason: 'candidate probe is not finite',
      }],
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [4] }]),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });
  const candidate = metricFor(projection, 'sat-candidate', 4);

  assert.equal(candidate.availability, 'unavailable');
  assert.equal(candidate.powerW, null);
  assert.equal(candidate.throughputBps, null);
  assert.equal(candidate.energyEfficiencyBitsPerJoule, null);
  assert.equal(candidate.eeBasis, 'not-available');
  assert.equal(candidate.reason, 'candidate probe is not finite');
});

test('fails closed when an available candidate probe contains a non-finite term', () => {
  const probe = candidateProbe(SOURCE_FRAME_ID, 10, 'sat-candidate', 4);
  const malformedSample = {
    ...probe.sample!,
    angleAware: {
      ...probe.sample!.angleAware!,
      throughputBps: Number.NaN,
    },
  };
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
      cellsBySatellite: new Map([['sat-candidate', [4]]]),
      candidateProbes: [{ ...probe, sample: malformedSample }],
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [4] }]),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });
  const candidate = metricFor(projection, 'sat-candidate', 4);

  assert.equal(candidate.availability, 'unavailable');
  assert.equal(candidate.powerW, null);
  assert.equal(candidate.throughputBps, null);
  assert.equal(candidate.energyEfficiencyBitsPerJoule, null);
  assert.equal(candidate.provenance, 'primary-ue-same-frame-angle-aware-display-only');
  assert.equal(candidate.eeBasis, 'not-available');
});

test('does not create a metric or role from a candidate probe without an accepted pair join', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
      candidateProbes: [candidateProbe(SOURCE_FRAME_ID, 10, 'sat-ghost', 99)],
      cellsBySatellite: new Map([['sat-candidate', [4]]]),
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [4] }]),
    servingBeamCount: 1,
    candidateBeamCount: 1,
  });

  assert.equal(projection.metrics.some(metric => metric.satelliteId === 'sat-ghost'), false);
  const candidate = metricFor(projection, 'sat-candidate', 4);
  assert.equal(candidate.role, 'candidate');
  assert.equal(candidate.availability, 'unavailable');
  assert.equal(candidate.powerW, null);
  assert.equal(candidate.throughputBps, null);
  assert.equal(candidate.energyEfficiencyBitsPerJoule, null);
  assert.equal(candidate.eeBasis, 'not-available');
});

test('rejects candidate probe evidence from another source frame', () => {
  assert.throws(
    () => buildHomepageBeamMetrics({
      sourceFrame: sourceFrame({
        opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
        candidateProbes: [candidateProbe('stale-source-frame', 10, 'sat-candidate', 4)],
      }),
      snapshot: null,
      servingBeamCount: 3,
      candidateBeamCount: 1,
    }),
    /candidate probe\[0\]\/sourceFrameId mismatch/,
  );

  assert.throws(
    () => buildHomepageBeamMetrics({
      sourceFrame: sourceFrame({
        opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
        candidateProbes: [candidateProbe(SOURCE_FRAME_ID, 11, 'sat-candidate', 4)],
      }),
      snapshot: null,
      servingBeamCount: 3,
      candidateBeamCount: 1,
    }),
    /candidate probe\[0\]\/simTimeSec mismatch/,
  );
});

test('normalizes available EE over the current active frame only', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      opportunities: opportunitySet(SOURCE_FRAME_ID, [
        ['sat-candidate', 3],
        ['sat-candidate', 4],
      ]),
      cellsBySatellite: new Map([
        ['sat-serving', [2]],
        ['sat-candidate', [3, 4]],
      ]),
      ues: [
        ueRecord('ue-primary', 'sat-serving', 2, 10, 1),
        ueRecord('ue-two', 'sat-candidate', 3, 20, 1),
        ueRecord('ue-three', 'sat-candidate', 4, 40, 1),
      ],
    }),
    snapshot: snapshot(SOURCE_FRAME_ID, SNAPSHOT_ID, [{ satelliteId: 'sat-candidate', beamIds: [3, 4] }]),
    servingBeamCount: 1,
    candidateBeamCount: 2,
  });

  assert.equal(projection.availableEeMinBitsPerJoule, 10);
  assert.equal(projection.availableEeMaxBitsPerJoule, 40);
  assert.equal(metricFor(projection, 'sat-serving', 2).eeNormalized, 0);
  assert.equal(metricFor(projection, 'sat-candidate', 3).eeNormalized, 1 / 3);
  assert.equal(metricFor(projection, 'sat-candidate', 4).eeNormalized, 1);
});

test('freezes the projection, metric objects, keys, colors, and arrays', () => {
  const projection = buildHomepageBeamMetrics({
    sourceFrame: sourceFrame({
      ues: [ueRecord('ue-primary', 'sat-serving', 2, 100, 2)],
    }),
    snapshot: snapshot(),
    servingBeamCount: 3,
    candidateBeamCount: 1,
  });

  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.metrics));
  for (const metric of projection.metrics) {
    assert.ok(Object.isFrozen(metric));
    assert.ok(Object.isFrozen(metric.key));
    assert.ok(Object.isFrozen(metric.color));
  }
  assert.throws(() => (projection.metrics as unknown as unknown[]).push({}), TypeError);
});

test('rejects a snapshot or opportunity set from another source frame', () => {
  const source = sourceFrame({
    opportunities: opportunitySet(SOURCE_FRAME_ID, [['sat-candidate', 4]]),
  });

  assert.throws(
    () => buildHomepageBeamMetrics({
      sourceFrame: source,
      snapshot: snapshot('stale-source-frame'),
      servingBeamCount: 3,
      candidateBeamCount: 1,
    }),
    /snapshot\/sourceFrameId mismatch/,
  );

  assert.throws(
    () => buildHomepageBeamMetrics({
      sourceFrame: sourceFrame({
        opportunities: opportunitySet('stale-source-frame', [['sat-candidate', 4]]),
      }),
      snapshot: null,
      servingBeamCount: 3,
      candidateBeamCount: 1,
    }),
    /opportunitySet\/sourceFrameId mismatch/,
  );
});
