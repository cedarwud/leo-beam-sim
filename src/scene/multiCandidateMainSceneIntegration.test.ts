import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Vector3 } from 'three';
import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverDecisionFrame,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateDecisionState,
  type CandidateGateResult,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import {
  buildCandidatePresentationPlan,
  type CandidatePresentationPlan,
} from '../engine/handover/candidatePresentationPlan';
import { homepageSatelliteColorForBeam } from '../homepage/controller/homepageSatelliteVisualIdentity';
import { resolveGroundRippleTargets } from '../viz/ServingGroundRipple';
import { resolveIntraGroundShockwaveColors } from '../viz/IntraGroundShockwave';
import type { BeamTarget } from './beamTargetTypes';
import { resolveCandidateConeItems } from './candidateConeItems';
import { resolveBeamInfoItems } from './beamInfoItems';
import {
  resolveAuthorityPairConeItems,
  resolveCinemaPairConeItems,
  resolvePulseConeItems,
  resolveTriggeredIntraConeItems,
} from './handoverConeResolvers';
import {
  resolveHandoverPresentationCandidate,
  type HandoverPresentationCandidateInput,
} from './handoverPresentationCandidate';
import { resolveMultiCandidateBeamColors } from './multiCandidateBeamColors';
import { resolveAuthoritySpineParticlePlans } from './multiCandidateAuthoritySpineParticlePlans';
import {
  resolveMultiCandidateComparisonPolicy,
  resolveMultiCandidatePresentationPolicy,
} from './multiCandidateSceneDisplayPolicy';
import { resolveSinrLiveCellTruthSpineParticlePlans } from './sinrLiveCellTruthSpineParticlePlans';
import { resolveServingConeItems } from './servingConeItems';
import {
  SceneMultiCandidateLayer,
  type SceneMultiCandidateLayerProps,
} from './SceneMultiCandidateLayer';
import {
  SceneSatelliteMarkerLayer,
  type SceneSatelliteMarkerLayerProps,
} from './SceneSatelliteMarkerLayer';
import type { SinrLiveCellHandoverEvent } from './sinrLiveCellModel';
import type {
  SinrLiveCellBeamConeRenderItem,
  SinrLiveCellPlacement,
  SinrLiveCinemaHandoverCandidate,
} from '../viz/SinrLiveCellBeamCones';
import type { WorldPoint } from '../viz/CellFootprints';
import { colorForServingBeam } from '../constants/servingColour';

const INTEGRATION_SOURCE_FRAME_ID = 'integration-scene-frame';

function integrationMetric(value: number, unit = 'unit') {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId: INTEGRATION_SOURCE_FRAME_ID,
    reason: null,
  });
}

function integrationGate(code: CandidateGateResult['code']): CandidateGateResult {
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result: code === 'ee-advantage' ? 'unavailable' : 'pass',
    measured: code === 'ee-advantage' ? null : 1,
    threshold: code === 'ee-advantage' ? null : 0,
    unit: code === 'ee-advantage' ? null : 'unit',
    reason: code === 'ee-advantage' ? 'fixture does not calculate EE' : null,
  });
}

function integrationOpportunity(
  satelliteId: string,
  beamId: number,
): CandidateOpportunity {
  const gateCodes: readonly CandidateGateResult['code'][] = [
    'elevation',
    'steering',
    'scheduled-illumination',
    'sinr',
    'throughput',
    'remaining-service-time',
    'ee-advantage',
  ];
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-integration',
    sourceFrameId: INTEGRATION_SOURCE_FRAME_ID,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: integrationMetric(55, 'deg'),
    steering: integrationMetric(3, 'deg'),
    range: integrationMetric(850, 'km'),
    sinr: integrationMetric(12, 'dB'),
    predictedThroughput: integrationMetric(100, 'bit/s'),
    remainingServiceTime: integrationMetric(120, 's'),
    forecastEe: null,
    gates: gateCodes.map(integrationGate),
  });
}

function integrationState(
  key: ReturnType<typeof candidateLinkKey>,
  rank: number,
): CandidateDecisionState {
  return {
    key,
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: 4,
    requiredTttSec: 3,
    stable: true,
    rank,
    rejectionCodes: [],
  };
}

function integrationDecision(
  phase: HandoverDecisionFrame['phase'] = 'evaluating',
): HandoverDecisionFrame {
  const serving = candidateLinkKey('sat-serving', 1);
  const candidate = candidateLinkKey('sat-candidate', 2);
  const secondCandidate = candidateLinkKey('sat-candidate-2', 3);
  const opportunities = [
    integrationOpportunity(serving.satelliteId, serving.beamId),
    integrationOpportunity(candidate.satelliteId, candidate.beamId),
    integrationOpportunity(secondCandidate.satelliteId, secondCandidate.beamId),
  ];
  return createHandoverDecisionFrame({
    episodeId: 'integration-scene-episode',
    epochToken: 'integration-epoch',
    sourceFrameId: INTEGRATION_SOURCE_FRAME_ID,
    simTimeMs: 10_000,
    phase,
    serving,
    opportunities,
    states: opportunities.map((item, index) => integrationState(item.key, index + 1)),
    provisionalLeader: candidate,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });
}

function integrationPlan(): CandidatePresentationPlan {
  return buildCandidatePresentationPlan(integrationDecision());
}

function integrationAcceptedSnapshot(
  plan: CandidatePresentationPlan,
): Parameters<typeof resolveMultiCandidatePresentationPolicy>[0]['acceptedPresentation'] {
  return {
    episodeId: plan.decision.episodeId,
    sourceFrameId: plan.decision.sourceFrameId,
    simTimeMs: plan.decision.simTimeMs,
    epochToken: 'integration-epoch',
    decision: plan.decision,
    plan,
  } as unknown as Parameters<typeof resolveMultiCandidatePresentationPolicy>[0]['acceptedPresentation'];
}

const integrationPlacementByCellId = new Map<number, SinrLiveCellPlacement>([
  [0, { cellId: 0, worldX: 10, worldZ: -20, radiusWorld: 4 }],
  [1, { cellId: 1, worldX: -30, worldZ: 15, radiusWorld: 4 }],
]);

const integrationSatelliteWorldById = new Map<string, WorldPoint>([
  ['sat-serving', { x: 0, y: 100, z: 0 }],
  ['sat-candidate', { x: 25, y: 110, z: -10 }],
]);

const integrationServingCellFrame = {
  simTimeSec: 10,
  cells: [],
  ues: [],
  illuminatedBeams: [{
    satId: 'sat-serving',
    cellId: 0,
    serving: true,
    beamId: 1,
    frequencyIndex: 0,
  }],
  servedCellCount: 1,
  servedUeCount: 0,
  servingSatCount: 1,
  intraHandoverCount: 0,
  interHandoverCount: 0,
  cumulativeIntraHandoverCount: 0,
  cumulativeInterHandoverCount: 0,
  recentHandoverEvents: [],
} as never;

const integrationCinemaCandidate: SinrLiveCinemaHandoverCandidate = {
  eventId: 'integration-cinema',
  ueId: 'ue-integration',
  kind: 'intra',
  sourceTimeSec: 10,
  fromSatId: 'sat-serving',
  fromBeamId: 1,
  fromCellId: 0,
  toSatId: 'sat-serving',
  toBeamId: 2,
  toCellId: 1,
};

function keepIntegrationConeItems(
  items: readonly SinrLiveCellBeamConeRenderItem[],
): readonly SinrLiveCellBeamConeRenderItem[] {
  return items;
}

function integrationChildElements(node: ReactElement | null): ReactElement[] {
  if (node === null) return [];
  const props = node.props as { readonly children?: ReactNode };
  return Children.toArray(props.children).filter(isValidElement) as ReactElement[];
}

function integrationElementProps<T extends object>(node: ReactElement): T {
  return node.props as T;
}

const source = await readFile(new URL('./MainScene.tsx', import.meta.url), 'utf8');
const railSource = await readFile(
  new URL('../ui/handover-evaluation/HandoverEvaluationPanel.tsx', import.meta.url),
  'utf8',
);
const publisherSource = await readFile(
  new URL('./useSimStatePublisher.ts', import.meta.url),
  'utf8',
);
const infoPanelSource = await readFile(
  new URL('../ui/InfoPanel.tsx', import.meta.url),
  'utf8',
);
const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const snapshotSource = await readFile(
  new URL('./acceptedHandoverPresentationSnapshot.ts', import.meta.url),
  'utf8',
);

test('MainScene mounts the bounded multi-candidate presentation from one accepted snapshot', () => {
  assert.doesNotMatch(source, /useHomepageCandidatePresentationPlan/);
  assert.match(
    source,
    /const handoverCandidatePresentationPlan = multiCandidateAuthorityActive\s*\n\s*\? acceptedHandoverPresentation\?\.plan \?\? null\s*\n\s*: null/,
  );
  assert.match(publisherSource, /buildAcceptedHandoverPresentationSession\(\{/);
  assert.match(snapshotSource, /buildCandidatePresentationPlan\(input\.decision/);
  assert.match(
    publisherSource,
    /displayAllHardEligibleCandidates:\s*true,[\s\S]{0,240}displayOnlyTriggerSatisfiedCandidates:\s*true,/,
    'homepage rail must expose only hard-eligible alternatives that also satisfy the active trigger',
  );
  const plan = integrationPlan();
  const accepted = integrationAcceptedSnapshot(plan);
  const policy = resolveMultiCandidatePresentationPolicy({
    acceptedPresentation: accepted,
    candidatePresentationPlan: plan,
    homepageVisualIdentity: false,
    sceneLane: 'sinr-live',
    simSource: 'live',
    authorityActive: true,
    comparisonPhase: true,
    preSelectionComparisonPhase: true,
    showSinrLiveCellBeams: true,
    sceneLayerEnabled: true,
    previousHold: null,
    centralOverlayEnabled: true,
  });
  const scene = policy.scenePresentationForRender;
  assert.ok(scene !== null, 'the accepted presentation plan must produce a scene projection');
  assert.deepEqual(
    scene.instructions.map(instruction => instruction.joinKey),
    plan.displayedLinks.map(link => link.joinKey),
  );
  assert.equal(scene.candidates.length, 2);
  assert.equal(scene.activeDataLinkCount, 1);

  const onCandidateSelect = (_key: CandidateLinkKey): void => {};
  const layerProps: SceneMultiCandidateLayerProps = {
    context: {
      placementByCellId: integrationPlacementByCellId,
      satelliteWorldById: integrationSatelliteWorldById,
      primaryUeWorld: [0, 0, 0],
      reducedMotion: false,
      homepageVisualIdentity: false,
      satelliteNameById: new Map(),
      homepageBeamEeByKey: new Map(),
      homepageIdentityPaletteIndexBySatelliteId: new Map(),
      onCandidateSelect,
    },
    central: {
      active: true,
      presentation: scene,
      widthScale: 1,
      renderReceipt: null,
    },
    review: {
      active: true,
      presentation: scene,
      widthScale: 1,
      renderReceipt: null,
    },
  };
  const layerChildren = integrationChildElements(SceneMultiCandidateLayer(layerProps));
  assert.equal(layerChildren.length, 2);
  const centralProps = integrationElementProps<{
    readonly presentation: typeof scene;
    readonly onCandidateSelect?: (key: CandidateLinkKey) => void;
    readonly renderServingConeAndFootprint?: boolean;
    readonly renderSatelliteIdentityLabels?: boolean;
    readonly renderPairLabels?: boolean;
  }>(layerChildren[0]!);
  const reviewProps = integrationElementProps<{
    readonly presentation: typeof scene;
    readonly onCandidateSelect?: (key: CandidateLinkKey) => void;
    readonly renderServingConeAndFootprint?: boolean;
    readonly renderSatelliteIdentityLabels?: boolean;
    readonly renderPairLabels?: boolean;
  }>(layerChildren[1]!);
  assert.equal(centralProps.presentation, scene);
  assert.equal(reviewProps.presentation, scene);
  assert.equal(centralProps.onCandidateSelect, onCandidateSelect);
  assert.equal(reviewProps.onCandidateSelect, onCandidateSelect);
  assert.equal(centralProps.renderServingConeAndFootprint, true);
  assert.equal(reviewProps.renderServingConeAndFootprint, false);
  assert.equal(centralProps.renderSatelliteIdentityLabels, false);
  assert.equal(reviewProps.renderSatelliteIdentityLabels, false);
  assert.equal(centralProps.renderPairLabels, false);
  assert.equal(reviewProps.renderPairLabels, false);

  const markerLayerProps: SceneSatelliteMarkerLayerProps = {
    satellites: [{
      id: 'sat-candidate',
      world: new Vector3(20, 100, -10),
      satelliteTintColor: '#64748b',
    }],
    visibility: {
      mounted: true,
      selectedSatellite: true,
      candidateSatellite: true,
      contextSatellites: true,
      centralMarkerSatelliteIds: null,
    },
    identity: {
      constellation: 'starlink',
      eventRoles: new Map(),
      multiCandidateColorById: new Map([['sat-candidate', '#0ea5e9']]),
      homepageNameById: new Map([['sat-candidate', 'Candidate SAT']]),
    },
    labels: {
      candidateLabelActive: true,
      candidateOrdinalBySatelliteId: new Map([['sat-candidate', 1]]),
      candidateVisibleSatelliteIds: new Set(['sat-candidate']),
      teachingLabelSatelliteIds: null,
      selectedLayerSatelliteId: null,
      candidateLayerSatelliteId: null,
      homepageLabelActive: true,
      homepageEeProgressById: null,
      homepageEeProgressVisible: false,
      handoverMarkerSatelliteIds: new Set(),
      heroSatelliteId: null,
      candidateEeSatelliteId: null,
    },
    emphasis: {
      multiCandidateSceneVisualActive: true,
      candidateComparisonSceneActive: true,
      candidateComparisonVisibleSatelliteIds: new Set(['sat-candidate']),
      liveSource: true,
    },
  };
  const candidateMarker = integrationChildElements(SceneSatelliteMarkerLayer(markerLayerProps))[0]!;
  const candidateMarkerProps = integrationElementProps<{
    readonly label: string;
    readonly labelFontSize?: number;
    readonly labelColor?: string;
    readonly scaleMultiplier?: number;
    readonly satelliteTintColor?: string;
  }>(candidateMarker);
  assert.equal(candidateMarkerProps.label, 'Option R1 · Candidate SAT');
  assert.equal(candidateMarkerProps.labelFontSize, 22);
  assert.equal(candidateMarkerProps.labelColor, '#f8fafc');
  assert.equal(candidateMarkerProps.scaleMultiplier, 7);
  assert.equal(candidateMarkerProps.satelliteTintColor, '#0ea5e9');
  const servingMarker = integrationChildElements(SceneSatelliteMarkerLayer({
    ...markerLayerProps,
    labels: {
      ...markerLayerProps.labels,
      candidateLabelActive: false,
      candidateOrdinalBySatelliteId: new Map(),
      candidateVisibleSatelliteIds: null,
    },
    emphasis: {
      ...markerLayerProps.emphasis,
      multiCandidateSceneVisualActive: false,
      candidateComparisonSceneActive: false,
      candidateComparisonVisibleSatelliteIds: null,
    },
  }))[0]!;
  const servingMarkerProps = integrationElementProps<{
    readonly labelFontSize?: number;
    readonly labelColor?: string;
    readonly scaleMultiplier?: number;
  }>(servingMarker);
  assert.equal(servingMarkerProps.labelFontSize, 18);
  assert.equal(servingMarkerProps.labelColor, '#f8fafc');
  assert.equal(servingMarkerProps.scaleMultiplier, 1);
});

test('homepage transition colours stay on the accepted EE shade projection', () => {
  const resolverStart = source.indexOf('const resolveSceneAcceptedBeamColor');
  const resolverEnd = source.indexOf('const resolveSceneAcceptedCellColor', resolverStart);
  const resolver = source.slice(resolverStart, resolverEnd);
  assert.match(
    resolver,
    /homepageSatelliteColorForBeam\([\s\S]*eeNormalized:\s*homepageBeamEeByKey\?\.get\(/,
    'scene transition colours must not fall back to beam-slot shading when the homepage publishes EE',
  );
  const eeByKey = new Map([
    ['sat-a:2', 0.15],
    ['sat-a:5', 0.85],
  ]);
  const resolvedCalls: string[] = [];
  const colors = resolveMultiCandidateBeamColors({
    sceneInstructions: [{
      satelliteId: 'sat-a',
      beamId: 2,
      cellId: 0,
      isServing: true,
      isCandidate: false,
    }],
    authorityDisplayedLinks: [{
      satelliteId: 'sat-a',
      beamId: 5,
      isServing: false,
      isCandidate: true,
    }],
    authorityActive: true,
    resolveBeamColor: (satelliteId, beamId, highlighted) => {
      resolvedCalls.push(`${satelliteId}:${beamId}:${highlighted ? 'vivid' : 'plain'}`);
      return homepageSatelliteColorForBeam(satelliteId, beamId, {
        eeNormalized: eeByKey.get(`${satelliteId}:${beamId}`),
        isServing: highlighted,
      }).color;
    },
  });
  const sourceColor = homepageSatelliteColorForBeam('sat-a', 2, {
    eeNormalized: 0.15,
    isServing: true,
  }).color;
  const targetColor = homepageSatelliteColorForBeam('sat-a', 5, {
    eeNormalized: 0.85,
    isServing: true,
  }).color;
  assert.equal(colors.bySatelliteBeam.get('sat-a/2'), sourceColor);
  assert.equal(colors.bySatelliteBeam.get('sat-a/5'), targetColor);
  assert.notEqual(sourceColor, targetColor);
  assert.deepEqual(resolvedCalls, ['sat-a:2:vivid', 'sat-a:5:vivid']);
});

test('candidate authority is additive and cannot blanket-suppress the established carrier', () => {
  for (const carrier of [
    'OrbitTrail',
    'SpineParticles',
    'ServingGroundRipple',
  ]) {
    const blanketSuppression = new RegExp(
      `!multiCandidateAuthorityActive[\\s\\S]{0,320}${carrier}`,
    );
    assert.doesNotMatch(
      source,
      blanketSuppression,
      `${carrier} must not be disabled merely because a decision frame exists`,
    );
  }
  const authorityPlans = resolveAuthoritySpineParticlePlans({
    enabled: true,
    serving: {
      pairKey: 'sat-serving/1',
      satelliteId: 'sat-serving',
      beamId: 1,
      beamColor: '#0f9d58',
      apex: [10, 20, 30],
    },
    primaryUeWorld: [1, 2, 3],
    particlesPerBeam: 2,
  });
  assert.deepEqual(authorityPlans?.map(plan => plan.id), [
    'authority:sat-serving/1:P0',
    'authority:sat-serving/1:P1',
  ]);
  const liveCone = {
    serving: true,
    satId: 'sat-serving',
    cellId: 0,
    apex: new Vector3(10, 20, 30),
    baseCenter: new Vector3(1, 2, 3),
    color: '#abcdef',
  } as unknown as SinrLiveCellBeamConeRenderItem;
  const livePlans = resolveSinrLiveCellTruthSpineParticlePlans({
    enabled: true,
    multiCandidateCentralOverlayActive: false,
    displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0 },
    coneItems: [liveCone],
    restrictItems: items => items,
    particlesPerBeam: 2,
  });
  assert.deepEqual(livePlans.map(plan => plan.id), [
    'cell-truth:sat-serving:C0:P0',
    'cell-truth:sat-serving:C0:P1',
  ]);
  assert.deepEqual(
    resolveSinrLiveCellTruthSpineParticlePlans({
      enabled: true,
      multiCandidateCentralOverlayActive: true,
      displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0 },
      coneItems: [liveCone],
      restrictItems: items => items,
      particlesPerBeam: 2,
    }),
    [],
  );
  // The accepted comparison layer owns candidate geometry. The homepage keeps
  // the established serving fan as its additive carrier; handover-time mutual
  // exclusion is asserted by the homepage geometry policy instead of by this
  // candidate-scene mount.
  assert.match(source, /resolveMultiCandidateBeamScene\(\{/);
  assert.doesNotMatch(
    source,
    /\(!multiCandidateAuthorityActive \|\| !multiCandidateServingCarrierRenderable\)[\s\S]{0,180}presentationPlan\.visible\['serving-beams'\]/,
  );
  assert.doesNotMatch(
    source,
    /\(!multiCandidateAuthorityActive \|\| !multiCandidateServingCarrierRenderable\)[\s\S]{0,180}presentationPlan\.visible\['serving-footprints'\]/,
  );
  assert.match(source, /multiCandidateServingCarrierRenderable/);
  // Satellite/beam identity colour belongs only to the active serving pair and
  // explicitly presented candidate pairs. The rest of the serving satellite's
  // fan must retain the semantic neutral treatment.
  assert.match(source, /const multiCandidateServingBeamColor = multiCandidateSceneRenderPlan\?\.instructions\.find/);
  assert.match(source, /heroColor: multiCandidateServingBeamColor\s*\n\s*\?\? sinrLiveConePalette\.heroColor/);
  assert.doesNotMatch(source, /items\.map\(item => \{[\s\S]{0,500}beamIdentitiesBySatelliteId/);
  const servingItems = resolveServingConeItems({
    geometry: {
      cellFrame: integrationServingCellFrame,
      placementByCellId: integrationPlacementByCellId,
      satelliteWorldById: integrationSatelliteWorldById,
      focusSatIds: null,
      frequencyReuse: 3,
      servingBeamBudget: 1,
      allowHeroFallback: false,
      budgetServingFan: true,
      displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
    },
    presentation: {
      showSinrLiveCellBeams: true,
      renderServingField: true,
      showNonServingCones: false,
      hideNormalBeamField: false,
      hidePrimaryServingBeam: false,
      preserveConfiguredServingFan: false,
      teachingLectureFieldCleared: false,
      multiCandidateCentralOverlayActive: true,
      homepageVisualIdentity: false,
      homepageBeamVisibility: new Set(),
      homepageBeamFanSatelliteIds: new Set(),
      resolveSceneAcceptedBeamColor: () => '#accepted-serving-identity',
      restrictHomepageBeamItems: keepIntegrationConeItems,
    },
  });
  assert.equal(servingItems.length, 1);
  assert.equal(servingItems[0]?.color, '#accepted-serving-identity');
  // Beam Info is an explicit scene control and remains available while the
  // accepted candidate snapshot is active. It reads the same rendered cone
  // items, while the callout renderer filters geometry-only substrate entries
  // so the scene never presents synthetic measurement cards.
  const servingInfo = { satId: 'sat-serving', cellId: 0, beamId: 1 };
  const candidateInfo = { satId: 'sat-candidate', cellId: 1, beamId: 2 };
  const substrateInfo = {
    satId: 'sat-candidate',
    cellId: 2,
    beamId: 3,
    displayOnly: true,
  };
  const beamInfoItems = resolveBeamInfoItems({
    layers: {
      additiveCinemaHandoverPair: [],
      additiveTriggeredIntra: [servingInfo, substrateInfo],
      authorityHandoverPair: [candidateInfo],
      serving: [],
    },
    presentation: {
      homepageVisualIdentity: false,
      multiCandidateCentralOverlayActive: true,
      multiCandidateIdentityTransitionActive: false,
      active: true,
      event: null,
    },
  });
  assert.deepEqual(beamInfoItems, [servingInfo, candidateInfo]);
  assert.equal(
    servingItems.some(item => item.satId === 'sat-serving' && item.serving),
    true,
    'the established serving cone remains available while candidate authority is active',
  );
  // The established pulse/cross-fade carriers remain available while candidate
  // authority is active. Each resolver is pure and keeps its own display role.
  const pulseEvent: SinrLiveCellHandoverEvent = {
    ueId: 'ue-integration',
    kind: 'inter',
    sourceTimeSec: 10,
    fromSatId: 'sat-serving',
    fromCellId: 0,
    fromBeamId: 1,
    toSatId: 'sat-candidate',
    toCellId: 1,
    toBeamId: 2,
  };
  const pulseItems = resolvePulseConeItems({
    policy: {
      enabled: true,
      hideTimelinePulse: false,
      suppressNaturalHandoverLayers: false,
      renderNaturalPulse: true,
      homepageVisualIdentity: false,
      concurrentIntraVisualSuppressed: false,
      showOtherHandoverUes: true,
      pulseFocusFollowsScope: false,
    },
    frame: { recentHandoverEvents: [pulseEvent], simTimeSec: 10 },
    geometry: {
      placementByCellId: integrationPlacementByCellId,
      satelliteWorldById: integrationSatelliteWorldById,
      frequencyReuse: 3,
      focusSatIds: null,
      protagonistUeId: null,
    },
    output: {
      resolveSceneAcceptedBeamColor: (satelliteId, beamId) => colorForServingBeam(satelliteId, beamId).markerColor,
      restrictHomepageBeamItems: keepIntegrationConeItems,
    },
  });
  assert.equal(pulseItems.length, 2);

  const triggeredItems = resolveTriggeredIntraConeItems({
    policy: {
      enabled: true,
      renderTriggeredIntra: true,
      homepageVisualIdentity: false,
      presentedCinemaHandoverActive: false,
      handoverActive: true,
      handoverEventSource: 'manual',
      handoverEventKind: 'intra',
    },
    candidate: integrationCinemaCandidate,
    fallbackUeId: 'ue-integration',
    envelope: { fromOpacity: 0.4, phase: 'holding', toOpacity: 0.6 },
    triggeredIntraPeakOpacity: 0.8,
    geometry: {
      placementByCellId: integrationPlacementByCellId,
      satelliteWorldById: integrationSatelliteWorldById,
      frequencyReuse: 3,
      manualBaseCenterOverride: new Vector3(2, 0, 3),
    },
    output: {
      resolveSceneAcceptedBeamColor: (satelliteId, beamId) => colorForServingBeam(satelliteId, beamId).markerColor,
      restrictHomepageBeamItems: keepIntegrationConeItems,
    },
  });
  assert.equal(triggeredItems.length, 2);

  const authorityPairItems = resolveAuthorityPairConeItems({
    policy: {
      enabled: true,
      centralOverlayActive: true,
      identityTransitionActive: true,
      handoverActive: true,
      homepageVisualIdentity: true,
      renderAuthorityPair: true,
      authorityPresentationCommitObserved: false,
    },
    candidate: integrationCinemaCandidate,
    envelope: { fromOpacity: 0.4, phase: 'holding', toOpacity: 0.6 },
    beamColorBySatelliteBeam: new Map([
      ['sat-serving/1', '#111111'],
      ['sat-serving/2', '#222222'],
    ]),
    geometry: {
      placementByCellId: integrationPlacementByCellId,
      satelliteWorldById: integrationSatelliteWorldById,
      frequencyReuse: 3,
      homepageIntraCellAnchor: new Vector3(2, 0, 3),
      manualHandoverGroundTarget: new Vector3(4, 0, 5),
    },
    output: {
      resolveSceneAcceptedBeamColor: (satelliteId, beamId) => colorForServingBeam(satelliteId, beamId).markerColor,
      restrictHomepageBeamItems: keepIntegrationConeItems,
    },
  });
  assert.equal(authorityPairItems.length, 2);
});

test('central comparison is rendered from the accepted pre-selection projection', () => {
  // The established carrier stays mounted, while the accepted snapshot's
  // candidate projection is now visible during the real pre-selection phase.
  const plan = integrationPlan();
  const accepted = integrationAcceptedSnapshot(plan);
  assert.ok(accepted !== null);
  const comparison = resolveMultiCandidateComparisonPolicy({
    acceptedPresentation: accepted,
    simSource: 'live',
    sceneLane: 'sinr-live',
    previousLatch: null,
    centralOverlayEnabled: true,
  });
  assert.equal(comparison.centralOverlayActive, true);
  const enabled = resolveMultiCandidatePresentationPolicy({
    acceptedPresentation: accepted,
    candidatePresentationPlan: plan,
    homepageVisualIdentity: false,
    sceneLane: 'sinr-live',
    simSource: 'live',
    authorityActive: comparison.authorityActive,
    comparisonPhase: comparison.comparisonPhase,
    preSelectionComparisonPhase: comparison.preSelectionComparisonPhase,
    showSinrLiveCellBeams: true,
    sceneLayerEnabled: true,
    previousHold: null,
    centralOverlayEnabled: true,
  });
  assert.ok(enabled.scenePresentationForRender !== null);
  assert.equal(enabled.sceneVisualActive, true);
  assert.equal(enabled.sceneLayerVisible, true);
  const disabled = resolveMultiCandidatePresentationPolicy({
    acceptedPresentation: accepted,
    candidatePresentationPlan: plan,
    homepageVisualIdentity: false,
    sceneLane: 'sinr-live',
    simSource: 'live',
    authorityActive: comparison.authorityActive,
    comparisonPhase: comparison.comparisonPhase,
    preSelectionComparisonPhase: comparison.preSelectionComparisonPhase,
    showSinrLiveCellBeams: true,
    sceneLayerEnabled: true,
    previousHold: null,
    centralOverlayEnabled: false,
  });
  assert.equal(disabled.scenePresentationForRender, null);
  assert.equal(disabled.sceneVisualActive, false);
  assert.equal(disabled.sceneLayerVisible, false);
  const staleComparison = resolveMultiCandidateComparisonPolicy({
    acceptedPresentation: { ...accepted, epochToken: 'stale-epoch' },
    simSource: 'live',
    sceneLane: 'sinr-live',
    previousLatch: null,
    centralOverlayEnabled: true,
  });
  assert.equal(staleComparison.snapshotMatchesFrame, false);
  assert.equal(staleComparison.centralOverlayActive, false);
});

test('identity colours follow satellite hue and beam shade through intra-handover effects', () => {
  const satelliteColors = new Map([['sat-a', '#cc6677']]);
  const beamColors = new Map([
    ['sat-a/2', '#b95566'],
    ['sat-a/5', '#df8290'],
  ]);
  const colors = resolveIntraGroundShockwaveColors({
    event: { satId: 'sat-a', fromBeamId: 2, toBeamId: 5 },
    identityColorBySatelliteId: satelliteColors,
    identityColorBySatelliteBeamId: beamColors,
  });
  assert.deepEqual(colors, { sourceColor: '#b95566', targetColor: '#df8290' });
  assert.notEqual(colors.sourceColor, colors.targetColor);

  const servingBeam: BeamTarget = {
    beamId: 5,
    groundX: 0,
    groundZ: 0,
    isServing: true,
    isScheduledActive: true,
    isPrimary: true,
    showBeam: true,
    frequencyIndex: 0,
    satelliteTintColor: '#cc6677',
    satelliteGlyph: 'circle',
    satelliteVisualIndex: 0,
  };
  const ripple = resolveGroundRippleTargets({
    satBeams: new Map([['sat-a', [servingBeam]]]),
    footprintRadius: 10,
    identityColorBySatelliteId: satelliteColors,
    identityColorBySatelliteBeamId: beamColors,
  });
  assert.equal(ripple[0]?.color, '#df8290');
});

test('homepage candidate cones cannot fall back to the legacy pending-target stream', () => {
  const input = {
    geometry: {
      pendingTargetSatId: 'sat-candidate',
      servingSatId: 'sat-serving',
      primaryCellId: 1,
      placementByCellId: integrationPlacementByCellId,
      satelliteWorldById: integrationSatelliteWorldById,
      frequencyReuse: 3,
      maxFanCones: 2,
    },
    presentation: {
      candidateComparisonSceneActive: false,
      renderCandidateField: true,
      homepageVisualIdentity: true,
      showSinrLiveCellBeams: true,
      hideCandidateFan: false,
      showCinemaCandidateFan: false,
      isInterPresentation: false,
      handoverPhase: 'holding' as const,
      handoverToOpacity: 0.6,
      candidateFanConeOpacity: 0.7,
      triggeredIntraPeakOpacity: 0.8,
      targetRole: 'candidate' as const,
      acceptedHandoverPresentation: null,
      restrictHomepageBeamItems: keepIntegrationConeItems,
    },
  };
  const homepageItems = resolveCandidateConeItems(input);
  assert.deepEqual(
    homepageItems,
    [],
    'homepage candidate geometry must come from accepted SceneProjection/pair ownership, not legacy pendingTargetSatId',
  );
  const legacyItems = resolveCandidateConeItems({
    ...input,
    presentation: { ...input.presentation, homepageVisualIdentity: false },
  });
  assert.ok(legacyItems.length > 0, 'the legacy fan remains available only outside homepage identity mode');
});

test('scene telemetry exposes rendered-output recovery and one-link browser gates', () => {
  assert.match(source, /buildCandidateSceneRenderReceipt\(\{/);
  assert.match(
    source,
    /multiCandidateRenderedPairCount=\{String\(\s*multiCandidateSceneRenderPlan\?\.telemetry\.renderedPairCount \?\? 0\s*\)\}/,
  );
  assert.match(
    source,
    /multiCandidateSceneGlobalSolidDataLinkCount=\{String\(\s*multiCandidateSceneRenderPlan\?\.solidDataLinkCount[\s\S]{0,180}acceptedHandoverPresentation\?\.activeDataLinkCount[\s\S]{0,80}\)\}/,
  );
  assert.match(source, /multiCandidateSceneRenderStatus=\{multiCandidateSceneRenderStatus\}/);
  assert.match(
    source,
    /multiCandidateCarrierFallbackActive=\{\s*multiCandidateCentralOverlayActive && !multiCandidateServingCarrierRenderable \? '1' : '0'\s*\}/,
  );
  assert.match(source, /multiCandidateEventCueCount=\{String\(multiCandidateEventCueCount\)\}/);
  const telemetryServingItems = resolveServingConeItems({
    geometry: {
      cellFrame: integrationServingCellFrame,
      placementByCellId: integrationPlacementByCellId,
      satelliteWorldById: integrationSatelliteWorldById,
      focusSatIds: null,
      frequencyReuse: 3,
      servingBeamBudget: 1,
      allowHeroFallback: false,
      budgetServingFan: true,
      displayHeroRecord: { servingSatId: 'sat-serving', cellId: 0, beamId: 1 },
    },
    presentation: {
      showSinrLiveCellBeams: true,
      renderServingField: true,
      showNonServingCones: false,
      hideNormalBeamField: false,
      hidePrimaryServingBeam: false,
      preserveConfiguredServingFan: false,
      teachingLectureFieldCleared: false,
      multiCandidateCentralOverlayActive: false,
      homepageVisualIdentity: false,
      homepageBeamVisibility: new Set(),
      homepageBeamFanSatelliteIds: new Set(),
      resolveSceneAcceptedBeamColor: (satelliteId, beamId) => colorForServingBeam(satelliteId, beamId).markerColor,
      restrictHomepageBeamItems: keepIntegrationConeItems,
    },
  });
  assert.equal(telemetryServingItems.length, 1);
});

test('multi-candidate comparison does not take ownership of the homepage camera', () => {
  // The comparison projection no longer contains an auto-fit effect at all.
  // This is stronger than a runtime false flag: candidate updates cannot
  // accidentally regain camera ownership by flipping a constant.
  assert.doesNotMatch(source, /MULTI_CANDIDATE_AUTO_CAMERA_REFIT_ENABLED/);
  assert.doesNotMatch(source, /resolveMultiCandidateCameraFit/);
  assert.doesNotMatch(source, /areMultiCandidateFocusPointsWithinSafeFrame/);
  assert.doesNotMatch(source, /multiCandidateCameraRecoveryEpisodeRef/);
  assert.match(source, /Camera ownership is deliberately absent from the comparison projection/);
  assert.doesNotMatch(source, /multiCandidateCameraFitKeyRef/);
  assert.doesNotMatch(source, /multiCandidateCameraEpisodeRef/);
  assert.doesNotMatch(source, /multiCandidateCameraUserControlledRef/);
});

test('the paused producer keeps the established always-on render loop', () => {
  assert.match(
    source,
    /frameloop="always"/,
  );
});

test('scene and right rail consume the exact same accepted plan without rebuilding it', () => {
  assert.doesNotMatch(source, /useHomepageCandidatePresentationPlan/);
  assert.doesNotMatch(railSource, /useHomepageCandidatePresentationPlan/);
  assert.doesNotMatch(railSource, /buildCandidatePresentationPlan/);
  assert.match(railSource, /const plan = snapshot\.plan/);
  assert.match(infoPanelSource, /<HandoverEvaluationPanel snapshot=\{acceptedHandoverPresentation\}/);
  assert.match(appSource, /acceptedHandoverPresentation=\{isWalkerSceneActive[\s\S]{0,160}simState\.acceptedHandoverPresentation/);
  assert.match(
    source,
    /data-accepted-handover-snapshot-id=\{acceptedHandoverPresentation\?\.snapshotId \?\? ''\}/,
  );
  assert.match(source, /acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot \| null/);
  assert.doesNotMatch(source, /const acceptedHandoverPresentationSession = useSimStatePublisher/);
  assert.match(publisherSource, /acceptedHandoverPresentation:\s*acceptedHandoverPresentationSnapshotForRender/);
  assert.match(snapshotSource, /readonly plan: CandidatePresentationPlan/);
  assert.doesNotMatch(source, /multiCandidateIdentityRef/);
  assert.doesNotMatch(railSource, /previousIdentityAllocation/);
  assert.match(railSource, /data-satellite-identity-colors=/);
});

test('authority presentation prioritizes actual switching while admitting manual and cinema demos during evaluation', () => {
  const world = new Map([
    ['source', { x: 1, y: 2, z: 3 }],
    ['target', { x: 4, y: 5, z: 6 }],
  ]);
  const placements = new Map([[0, {}], [1, {}]]);
  const baseInput = (): HandoverPresentationCandidateInput => ({
    authority: {
      active: false,
      candidate: null,
      centralOverlayActive: false,
      decisionAuthorityPresent: false,
      acceptedPresentation: null,
    },
    manual: {
      active: false,
      requested: false,
      requestId: 7,
      displayMs: 8000,
      event: null,
      beamRecord: null,
    },
    natural: {
      event: null,
      source: 'live',
      satelliteWorldById: world,
    },
    cinema: {
      ready: false,
      armed: false,
      candidate: null,
      satelliteWorldById: world,
    },
    placementByCellId: placements,
    durations: {
      naturalIntraMs: 1000,
      naturalInterMs: 2000,
      cinemaIntraMs: 3000,
      cinemaInterMs: 4000,
    },
    teachingLectureActive: false,
  });
  const authorityCandidate = {
    eventId: 'authority-1',
    source: 'walker' as const,
    kind: 'inter' as const,
    from: { satId: 'source', cellId: 0, drawable: true },
    to: { satId: 'target', cellId: 1, drawable: true },
    durationMs: 2500,
  };
  const manualEvent = {
    ueId: 'ue-0',
    kind: 'intra' as const,
    sourceTimeSec: 1,
    fromSatId: 'source',
    fromCellId: 0,
    toSatId: 'source',
    toCellId: 1,
  };
  const authorityWins = resolveHandoverPresentationCandidate({
    ...baseInput(),
    authority: { ...baseInput().authority, candidate: authorityCandidate },
    manual: { ...baseInput().manual, active: true, event: manualEvent },
  });
  assert.deepEqual(authorityWins, authorityCandidate);

  const manualWinsWhenAuthorityHasNoCandidate = resolveHandoverPresentationCandidate({
    ...baseInput(),
    authority: { ...baseInput().authority, active: true },
    manual: { ...baseInput().manual, active: true, event: manualEvent },
  });
  assert.equal(manualWinsWhenAuthorityHasNoCandidate?.source, 'manual');
  assert.equal(manualWinsWhenAuthorityHasNoCandidate?.kind, 'intra');

  const cinemaCandidate: SinrLiveCinemaHandoverCandidate = {
    eventId: 'cinema-1',
    ueId: 'ue-0',
    kind: 'inter',
    sourceTimeSec: 1,
    fromSatId: 'source',
    fromBeamId: 11,
    fromCellId: 0,
    toSatId: 'target',
    toBeamId: 12,
    toCellId: 1,
  };
  const cinemaWinsWhenAuthorityHasNoCandidate = resolveHandoverPresentationCandidate({
    ...baseInput(),
    authority: { ...baseInput().authority, active: true },
    cinema: {
      ...baseInput().cinema,
      ready: true,
      candidate: cinemaCandidate,
    },
  });
  assert.equal(cinemaWinsWhenAuthorityHasNoCandidate?.source, 'cinema');
  assert.equal(cinemaWinsWhenAuthorityHasNoCandidate?.kind, 'inter');

  const naturalSuppressed = resolveHandoverPresentationCandidate({
    ...baseInput(),
    authority: {
      ...baseInput().authority,
      active: true,
      acceptedPresentation: { decision: {} as never } as never,
    },
    natural: {
      ...baseInput().natural,
      event: {
        ueId: 'ue-0',
        kind: 'inter',
        sourceTimeSec: 1,
        fromSatId: 'source',
        fromCellId: 0,
        toSatId: 'target',
        toCellId: 1,
      },
    },
  });
  assert.equal(naturalSuppressed, null);
});

test('homepage cinema pair render gate admits indexed intra handover', () => {
  const cases = [
    {
      name: 'presented inter handover',
      presentedInterHandoverActive: true,
      presentedCinemaHandoverActive: false,
      handoverEventKind: 'inter' as const,
      candidate: { ...integrationCinemaCandidate, kind: 'inter' as const, toSatId: 'sat-candidate' },
      expected: true,
    },
    {
      name: 'presented cinema intra handover',
      presentedInterHandoverActive: false,
      presentedCinemaHandoverActive: true,
      handoverEventKind: 'intra' as const,
      candidate: integrationCinemaCandidate,
      expected: true,
    },
    {
      name: 'presented cinema inter handover',
      presentedInterHandoverActive: false,
      presentedCinemaHandoverActive: true,
      handoverEventKind: 'inter' as const,
      candidate: { ...integrationCinemaCandidate, kind: 'inter' as const, toSatId: 'sat-candidate' },
      expected: false,
    },
    {
      name: 'inactive presentation',
      presentedInterHandoverActive: false,
      presentedCinemaHandoverActive: false,
      handoverEventKind: 'intra' as const,
      candidate: integrationCinemaCandidate,
      expected: false,
    },
    {
      name: 'inter presentation takes priority over cinema kind',
      presentedInterHandoverActive: true,
      presentedCinemaHandoverActive: true,
      handoverEventKind: 'inter' as const,
      candidate: { ...integrationCinemaCandidate, kind: 'inter' as const, toSatId: 'sat-candidate' },
      expected: true,
    },
  ];

  for (const scenario of cases) {
    const items = resolveCinemaPairConeItems({
      policy: {
        enabled: true,
        homepageVisualIdentity: false,
        renderCinemaPair: true,
        handoverActive: false,
        presentedInterHandoverActive: scenario.presentedInterHandoverActive,
        presentedCinemaHandoverActive: scenario.presentedCinemaHandoverActive,
        handoverEventKind: scenario.handoverEventKind,
      },
      candidate: scenario.candidate,
      envelope: { fromOpacity: 0.4, phase: 'holding', toOpacity: 0.6 },
      triggeredIntraPeakOpacity: 0.8,
      geometry: {
        placementByCellId: integrationPlacementByCellId,
        satelliteWorldById: integrationSatelliteWorldById,
        frequencyReuse: 3,
        homepageIntraCellAnchor: new Vector3(2, 0, 3),
        manualHandoverGroundTarget: new Vector3(4, 0, 5),
      },
      output: {
        resolveSceneAcceptedBeamColor: (satelliteId, beamId) => colorForServingBeam(satelliteId, beamId).markerColor,
        restrictHomepageBeamItems: keepIntegrationConeItems,
      },
    });
    assert.equal(items.length > 0, scenario.expected, scenario.name);
  }
});
