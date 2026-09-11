import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveHandoverStoryFrameSet,
  resolveTeachingHandoverStoryFrame,
} from './handoverStoryFrame';
import { resolveScenePresentationPlan } from './presentation/scenePresentation';
import {
  resolveCoreSceneSurfacePlan,
  type CoreSceneSurfacePlan,
} from './sceneSurfacePlan';
import {
  SCENE_SURFACE_IDS,
  type SceneSurfaceId,
} from './sceneSurfaceRegistry';
import {
  explainSceneRenderPlan,
  formatSceneRenderPlanIdentities,
  formatSceneRenderPlanOwners,
  formatSceneRenderPlanSources,
  formatSceneRenderPlanReasons,
  resolveSceneRenderPlan,
  type SceneRenderPlanInput,
} from './sceneRenderPlan';

function fullCorePlan(overrides: Partial<Parameters<typeof resolveCoreSceneSurfacePlan>[0]> = {}): CoreSceneSurfacePlan {
  const base: Parameters<typeof resolveCoreSceneSurfacePlan>[0] = {
    stage: {
      ambientBeams: true,
      servingBeams: true,
      candidateBeams: true,
      eventEffects: true,
      servingFootprints: true,
      candidateFootprints: true,
    },
    runtime: {
      showSinrLiveCellBeams: true,
      showBeamCallouts: true,
      teachingLectureActive: false,
    },
    story: {
      homepageVisualIdentity: true,
      multiCandidateSceneVisualActive: false,
      multiCandidateCentralOverlayActive: false,
      multiCandidateIdentityTransitionActive: false,
      handoverPresentationActive: false,
      candidateReviewActive: false,
    },
    isolation: {
      active: false,
      hideNormalBeamField: false,
      preserveConfiguredServingFan: false,
    },
    inventory: {
      nonServingConeCount: 1,
      cinemaInterServingFanConeCount: 0,
      candidateConeCount: 1,
      pulseConeCount: 0,
      triggeredIntraConeCount: 0,
      cinemaPairConeCount: 0,
      authorityTransitionConeCount: 0,
      beamInfoCount: 1,
      teachingReady: false,
    },
  };
  return resolveCoreSceneSurfacePlan({ ...base, ...overrides });
}

function baseInput(
  overrides: Partial<SceneRenderPlanInput> = {},
): SceneRenderPlanInput {
  const base: SceneRenderPlanInput = {
    lane: 'live',
    presentation: resolveScenePresentationPlan('full'),
    storyFrames: resolveHandoverStoryFrameSet({
      accepted: null,
      presentation: null,
      teaching: null,
      replay: null,
    }),
    corePlan: fullCorePlan(),
    controls: {
      campusVisible: true,
      showHorizonBoundary: true,
      showUav: true,
      afterFirstPaint: true,
      showOrbitTrail: true,
      showSpineParticles: true,
      showGroundRipple: true,
      showLiveSatelliteMarkers: true,
      showSinrLiveCellBeams: true,
      showLiveSceneEffects: true,
      showSceneOverlays: true,
      showHandoverToastOverlay: true,
      homepageVisualIdentity: false,
      showFpsCounter: true,
      cinematicSpotlightActive: false,
      narrativeCaptionEnabled: true,
    },
    story: {
      suppressNaturalHandoverLayers: false,
      hideTimelineEffects: false,
      concurrentIntraVisualSuppressed: false,
      multiCandidateSceneLayerVisible: false,
      candidateComparisonSceneActive: false,
      multiCandidateCentralOverlayActive: false,
      multiCandidateIdentityTransitionActive: false,
      acceptedCueHasTransition: false,
      handoverEventCueDrawable: false,
      handoverPresentationActive: false,
      handoverPresentationHasEvent: false,
      manualHandoverPresentationActive: false,
      manualHandoverHasEvent: false,
    },
    inventory: {
      visibleSatelliteCount: 12,
      visibleUeCount: 100,
      narrativeCaptionPresent: true,
    },
  };
  return {
    ...base,
    ...overrides,
    controls: { ...base.controls, ...overrides.controls },
    story: { ...base.story, ...overrides.story },
    inventory: { ...base.inventory, ...overrides.inventory },
  };
}

function reason(plan: ReturnType<typeof resolveSceneRenderPlan>, id: SceneSurfaceId): string {
  return plan.surfaces[id].reasonCode;
}

test('full render plan covers every registered surface exactly once', () => {
  const plan = resolveSceneRenderPlan(baseInput());
  assert.deepEqual(Object.keys(plan.surfaces), SCENE_SURFACE_IDS);
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.lane, 'live');
  assert.equal(plan.stage, 'full');
  assert.equal(plan.story.owner, 'steady');
  assert.equal(plan.story.storyId, null);

  for (const id of SCENE_SURFACE_IDS) {
    const surface = plan.surfaces[id];
    assert.equal(surface.id, id);
    assert.ok(surface.owner.length > 0);
    assert.ok(surface.source.length > 0);
    assert.ok(surface.reasonCode.length > 0);
    assert.ok(surface.renderIdentity.startsWith(`live:${id}:`));
  }
  assert.equal(formatSceneRenderPlanReasons(plan).split(';').length, SCENE_SURFACE_IDS.length);
  assert.equal(formatSceneRenderPlanIdentities(plan).split(';').length, SCENE_SURFACE_IDS.length);
  assert.equal(formatSceneRenderPlanOwners(plan).split(";").length, SCENE_SURFACE_IDS.length);
  assert.equal(formatSceneRenderPlanSources(plan).split(";").length, SCENE_SURFACE_IDS.length);
  assert.match(
    plan.surfaces["beam.serving-cones"].renderIdentity,
    /SceneSinrLiveBeamLayers#SceneSinrLiveBeamLayers/,
  );
  assert.equal(explainSceneRenderPlan(plan).length, SCENE_SURFACE_IDS.length);
});

test('steady live plan preserves stage, feature and inventory semantics', () => {
  const plan = resolveSceneRenderPlan(baseInput());
  assert.equal(plan.surfaces['scene.layout'].visible, true);
  assert.equal(plan.surfaces['ground.campus'].visible, true);
  assert.equal(plan.surfaces['ground.teaching-floor'].visible, false);
  assert.equal(plan.surfaces['ground.ues'].visible, true);
  assert.equal(plan.surfaces['satellite.markers'].visible, true);
  assert.equal(plan.surfaces['motion.orbit-trail'].visible, true);
  assert.equal(plan.surfaces['motion.spine-particles'].visible, true);
  assert.equal(plan.surfaces['motion.ground-ripple'].visible, true);
  assert.equal(plan.surfaces['motion.handover-links'].mounted, false);
  assert.equal(reason(plan, 'motion.handover-links'), 'retired-duplicate-grammar');
  assert.equal(plan.surfaces['candidate.central'].mounted, false);
  assert.equal(plan.surfaces['candidate.review'].mounted, false);
  assert.equal(plan.surfaces['annotation.narrative-caption'].visible, true);
  assert.equal(plan.surfaces['handover.intra-shockwave'].visible, true);
  assert.equal(plan.surfaces['handover.toast'].visible, true);
  assert.equal(plan.surfaces['diagnostics.fps'].visible, true);
});

test('ground stage uses the teaching floor and explains deferred or hidden surfaces', () => {
  const plan = resolveSceneRenderPlan(baseInput({
    presentation: resolveScenePresentationPlan('ground'),
    controls: {
      ...baseInput().controls,
      afterFirstPaint: false,
    },
  }));
  assert.equal(plan.surfaces['ground.campus'].visible, true);
  assert.equal(plan.surfaces['ground.teaching-floor'].visible, false);
  assert.equal(plan.surfaces['ground.uav'].mounted, false);
  assert.equal(reason(plan, 'ground.uav'), 'stage-hidden');
  assert.equal(plan.surfaces['satellite.markers'].visible, false);
  assert.equal(reason(plan, 'satellite.markers'), 'stage-hidden');
  assert.equal(plan.surfaces['diagnostics.fps'].mounted, false);
});

function teachingStoryFrames() {
  const teaching = resolveTeachingHandoverStoryFrame({
    story: {
      kind: 'intra',
      sourceSatelliteId: 'sat-a',
      sourceCellId: 0,
      targetSatelliteId: null,
      targetCellId: 1,
      storyKey: 'teaching-intra:sat-a:0',
    },
    frame: {
      phase: { id: 'switching' },
      phaseProgress01: 0.5,
      elapsedSec: 6,
      totalSec: 12,
      serving: {
        id: 'source', satelliteLabel: 'A', beamLabel: 'B1',
        eeKbitPerJoule: 100, elevationDeg: 40, role: 'serving',
      },
      winner: {
        id: 'target', satelliteLabel: 'A', beamLabel: 'B2',
        eeKbitPerJoule: 120, elevationDeg: 45, role: 'winner',
      },
      committed: false,
      switchProgress01: 0.5,
    },
  });
  assert.ok(teaching);
  return resolveHandoverStoryFrameSet({
    accepted: null,
    presentation: null,
    teaching,
    replay: null,
  });
}

test('teaching ownership suppresses live effects across the full surface plan', () => {
  const teachingCore = fullCorePlan({
    runtime: {
      showSinrLiveCellBeams: true,
      showBeamCallouts: true,
      teachingLectureActive: true,
    },
    inventory: {
      nonServingConeCount: 1,
      cinemaInterServingFanConeCount: 1,
      candidateConeCount: 1,
      pulseConeCount: 2,
      triggeredIntraConeCount: 2,
      cinemaPairConeCount: 2,
      authorityTransitionConeCount: 2,
      beamInfoCount: 1,
      teachingReady: true,
    },
  });
  const plan = resolveSceneRenderPlan(baseInput({
    storyFrames: teachingStoryFrames(),
    corePlan: teachingCore,
    controls: {
      ...baseInput().controls,
      narrativeCaptionEnabled: false,
    },
    story: {
      ...baseInput().story,
      suppressNaturalHandoverLayers: true,
    },
  }));
  assert.equal(plan.story.owner, 'teaching');
  assert.equal(plan.story.activeSource, 'teaching');
  assert.equal(plan.surfaces['teaching.handover-cones'].visible, true);
  assert.equal(plan.surfaces['handover.pulse-cones'].mounted, false);
  assert.equal(reason(plan, 'handover.pulse-cones'), 'teaching-story-suppresses-live-effects');
  assert.equal(plan.surfaces['motion.spine-particles'].mounted, false);
  assert.equal(reason(plan, 'motion.spine-particles'), 'natural-layer-suppressed');
  assert.equal(plan.surfaces['motion.ground-ripple'].mounted, false);
  assert.equal(plan.surfaces['annotation.narrative-caption'].visible, false);
  assert.equal(reason(plan, 'annotation.narrative-caption'), 'caption-disabled');
  assert.equal(plan.surfaces['teaching.handover-cones'].storyId, 'teaching-intra:sat-a:0');
});

test('artifact replay uses the same plan vocabulary without mounting live-only surfaces', () => {
  const plan = resolveSceneRenderPlan(baseInput({
    lane: 'artifact-replay',
    corePlan: null,
    controls: {
      ...baseInput().controls,
      showUav: false,
      showLiveSatelliteMarkers: false,
      showFpsCounter: true,
    },
  }));
  assert.equal(plan.story.owner, 'replay');
  assert.equal(plan.surfaces['ground.ues'].source, 'artifact-replay');
  assert.equal(plan.surfaces['satellite.markers'].source, 'artifact-replay');
  assert.match(plan.surfaces['ground.ues'].renderIdentity, /GroundScene#GroundScene/);
  assert.match(plan.surfaces['satellite.markers'].renderIdentity, /SatelliteMarker#SatelliteMarker/);
  assert.equal(plan.surfaces['ground.ues'].visible, true);
  assert.equal(plan.surfaces['satellite.markers'].visible, true);
  assert.equal(plan.surfaces['motion.orbit-trail'].mounted, false);
  assert.equal(reason(plan, 'motion.orbit-trail'), 'lane-incompatible');
  assert.equal(plan.surfaces['beam.serving-cones'].mounted, false);
  assert.equal(plan.surfaces['diagnostics.fps'].visible, true);
});

test('R3 full-plan mounts remain equivalent to the pre-plan JSX gates', () => {
  const basePresentation = resolveScenePresentationPlan('full');
  let seed = 0x5eed1234;
  const next = (): boolean => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed & 0x80000000) !== 0;
  };

  for (let sample = 0; sample < 4096; sample += 1) {
    const stageCampus = next();
    const stageUes = next();
    const stageUav = next();
    const stageMotion = next();
    const stageEvents = next();
    const stageSatellites = next();
    const stageContext = next();
    const stageDiagnostics = next();
    const campusVisible = next();
    const showHorizonBoundary = next();
    const showUav = next();
    const afterFirstPaint = next();
    const showOrbitTrail = next();
    const showSpineParticles = next();
    const showGroundRipple = next();
    const showMarkers = next();
    const suppressNatural = next();
    const hideTimeline = next();
    const central = next();
    const review = next();
    const showBeams = next();
    const acceptedVisual = next();
    const acceptedTransition = next();
    const eventDrawable = next();
    const showLiveEffects = next();
    const concurrentIntra = next();
    const showOverlays = next();
    const showToast = next();
    const homepageIdentity = next();
    const manualActive = next();
    const manualEvent = next();
    const presentationActive = next();
    const presentationEvent = next();
    const narrativeEnabled = next();
    const narrativePresent = next();
    const showFps = next();
    const cinematic = next();
    const satelliteCount = next() ? 3 : 0;
    const ueCount = next() ? 5 : 0;

    const presentation = {
      stage: basePresentation.stage,
      visible: Object.freeze({
        ...basePresentation.visible,
        campus: stageCampus,
        ues: stageUes,
        uav: stageUav,
        'motion-guides': stageMotion,
        'event-effects': stageEvents,
        'selected-satellite': stageSatellites,
        'candidate-satellite': false,
        'context-satellites': stageContext,
        diagnostics: stageDiagnostics,
      }),
    } as const;
    const plan = resolveSceneRenderPlan(baseInput({
      presentation,
      controls: {
        ...baseInput().controls,
        campusVisible,
        showHorizonBoundary,
        showUav,
        afterFirstPaint,
        showOrbitTrail,
        showSpineParticles,
        showGroundRipple,
        showLiveSatelliteMarkers: showMarkers,
        showSinrLiveCellBeams: showBeams,
        showLiveSceneEffects: showLiveEffects,
        showSceneOverlays: showOverlays,
        showHandoverToastOverlay: showToast,
        homepageVisualIdentity: homepageIdentity,
        showFpsCounter: showFps,
        cinematicSpotlightActive: cinematic,
        narrativeCaptionEnabled: narrativeEnabled,
      },
      story: {
        ...baseInput().story,
        suppressNaturalHandoverLayers: suppressNatural,
        hideTimelineEffects: hideTimeline,
        concurrentIntraVisualSuppressed: concurrentIntra,
        multiCandidateSceneLayerVisible: central,
        candidateComparisonSceneActive: review,
        multiCandidateCentralOverlayActive: acceptedVisual,
        acceptedCueHasTransition: acceptedTransition,
        handoverEventCueDrawable: eventDrawable,
        handoverPresentationActive: presentationActive,
        handoverPresentationHasEvent: presentationEvent,
        manualHandoverPresentationActive: manualActive,
        manualHandoverHasEvent: manualEvent,
      },
      inventory: {
        visibleSatelliteCount: satelliteCount,
        visibleUeCount: ueCount,
        narrativeCaptionPresent: narrativePresent,
      },
    }));

    const campus = campusVisible && stageCampus;
    const satelliteStage = stageSatellites || stageContext;
    const hasToastEvent = (manualActive && manualEvent)
      || (presentationActive && presentationEvent)
      || (!hideTimeline && !suppressNatural);

    assert.equal(plan.surfaces['ground.campus'].mounted, campus);
    assert.equal(plan.surfaces['ground.teaching-floor'].mounted, !campus);
    assert.equal(
      plan.surfaces['ground.horizon-boundary'].visible,
      showHorizonBoundary && stageContext && satelliteCount > 0,
    );
    assert.equal(plan.surfaces['ground.uav'].mounted, stageUav && showUav && afterFirstPaint);
    assert.equal(plan.surfaces['ground.ues'].mounted, true);
    assert.equal(plan.surfaces['ground.ues'].visible, stageUes && ueCount > 0);
    assert.equal(plan.surfaces['motion.orbit-trail'].mounted, stageMotion && showOrbitTrail);
    assert.equal(
      plan.surfaces['motion.spine-particles'].mounted,
      stageMotion && showSpineParticles && !suppressNatural,
    );
    assert.equal(
      plan.surfaces['motion.ground-ripple'].mounted,
      stageEvents && showGroundRipple && !suppressNatural,
    );
    assert.equal(plan.surfaces['satellite.markers'].mounted, showMarkers);
    assert.equal(
      plan.surfaces['satellite.markers'].visible,
      showMarkers && satelliteStage && satelliteCount > 0,
    );
    assert.equal(plan.surfaces['candidate.central'].mounted, central);
    assert.equal(
      plan.surfaces['candidate.review'].mounted,
      review && showBeams && !central,
    );
    assert.equal(
      plan.surfaces['handover.accepted-cue'].mounted,
      acceptedVisual && stageEvents && acceptedTransition && eventDrawable,
    );
    assert.equal(
      plan.surfaces['annotation.narrative-caption'].visible,
      narrativeEnabled && narrativePresent,
    );
    assert.equal(
      plan.surfaces['handover.intra-shockwave'].mounted,
      stageEvents && showLiveEffects && !hideTimeline
        && !suppressNatural && !concurrentIntra,
    );
    assert.equal(
      plan.surfaces['handover.toast'].mounted,
      showOverlays && stageEvents && showToast && !homepageIdentity && hasToastEvent,
    );
    assert.equal(plan.surfaces['diagnostics.fps'].mounted, stageDiagnostics && showFps);
    assert.equal(
      plan.surfaces['scene.cinematic-spotlight'].mounted,
      stageEvents && cinematic,
    );
  }
});
