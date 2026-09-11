import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CORE_BEAM_SURFACE_IDS,
  SCENE_SURFACE_IDS,
  SCENE_SURFACE_REGISTRY,
  type CoreBeamSurfaceId,
} from './sceneSurfaceRegistry';
import {
  resolveCoreSceneSurfacePlan,
  type CoreSceneSurfacePlanInput,
} from './sceneSurfacePlan';

function baseInput(): CoreSceneSurfacePlanInput {
  return {
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
      nonServingConeCount: 2,
      cinemaInterServingFanConeCount: 2,
      candidateConeCount: 1,
      pulseConeCount: 2,
      triggeredIntraConeCount: 2,
      cinemaPairConeCount: 2,
      authorityTransitionConeCount: 2,
      beamInfoCount: 7,
      teachingReady: false,
    },
  };
}

type InputPatch = {
  readonly [Key in keyof CoreSceneSurfacePlanInput]?:
    Partial<CoreSceneSurfacePlanInput[Key]>;
};
function withPatch(patch: InputPatch): CoreSceneSurfacePlanInput {
  const input = baseInput();
  return {
    stage: { ...input.stage, ...patch.stage },
    runtime: { ...input.runtime, ...patch.runtime },
    story: { ...input.story, ...patch.story },
    isolation: { ...input.isolation, ...patch.isolation },
    inventory: { ...input.inventory, ...patch.inventory },
  };
}

test('the top-level scene surface registry is exhaustive and uniquely keyed', () => {
  assert.equal(new Set(SCENE_SURFACE_IDS).size, SCENE_SURFACE_IDS.length);
  assert.deepEqual(Object.keys(SCENE_SURFACE_REGISTRY).sort(), [...SCENE_SURFACE_IDS].sort());
  for (const id of CORE_BEAM_SURFACE_IDS) {
    assert.equal(SCENE_SURFACE_REGISTRY[id].firstManagedPhase, 'R1');
  }
});

test('steady mode exposes the complete current core surface inventory', () => {
  const plan = resolveCoreSceneSurfacePlan(baseInput());
  assert.equal(plan.storyOwner, 'steady');
  assert.equal(plan.surfaces['beam.serving-cones'].mounted, true);
  assert.equal(plan.surfaces['beam.non-serving-cones'].mounted, true);
  assert.equal(plan.surfaces['beam.candidate-cones'].mounted, true);
  assert.equal(plan.surfaces['beam.callouts'].mounted, true);
  assert.equal(plan.surfaces['teaching.handover-cones'].mounted, false);
  assert.equal(
    plan.surfaces['teaching.handover-cones'].mountReason,
    'teaching-story-not-ready',
  );
});
test('story ownership has a deterministic priority', () => {
  const candidate = resolveCoreSceneSurfacePlan(withPatch({
    story: { candidateReviewActive: true },
  }));
  assert.equal(candidate.storyOwner, 'candidate-review');

  const handover = resolveCoreSceneSurfacePlan(withPatch({
    story: {
      candidateReviewActive: true,
      handoverPresentationActive: true,
    },
  }));
  assert.equal(handover.storyOwner, 'handover');

  const teaching = resolveCoreSceneSurfacePlan(withPatch({
    runtime: { teachingLectureActive: true },
    story: { handoverPresentationActive: true },
    inventory: { teachingReady: true },
  }));
  assert.equal(teaching.storyOwner, 'teaching');
});

test('candidate review suppresses broad fields but homepage retains serving context', () => {
  const legacy = resolveCoreSceneSurfacePlan(withPatch({
    story: {
      homepageVisualIdentity: false,
      multiCandidateSceneVisualActive: true,
      candidateReviewActive: true,
    },
  }));
  assert.equal(legacy.surfaces['beam.serving-cones'].mounted, false);
  assert.equal(legacy.surfaces['beam.non-serving-cones'].mounted, false);
  assert.equal(legacy.surfaces['beam.candidate-cones'].mounted, false);

  const homepage = resolveCoreSceneSurfacePlan(withPatch({
    story: {
      homepageVisualIdentity: true,
      multiCandidateSceneVisualActive: true,
      candidateReviewActive: true,
    },
  }));
  assert.equal(homepage.surfaces['beam.serving-cones'].mounted, true);
  assert.equal(homepage.surfaces['beam.serving-footprints'].mounted, true);
});
test('event-effect stage gate explains every suppressed handover cone', () => {
  const plan = resolveCoreSceneSurfacePlan(withPatch({
    stage: { eventEffects: false },
  }));
  for (const id of [
    'handover.pulse-cones',
    'handover.triggered-intra-cones',
    'handover.cinema-pair-cones',
    'handover.authority-transition-cones',
  ] as const) {
    assert.equal(plan.surfaces[id].mounted, false);
    assert.equal(plan.surfaces[id].mountReason, 'stage-hidden');
  }
});

test('teaching owns the story, suppresses live callouts, and uses its own input adapter', () => {
  const plan = resolveCoreSceneSurfacePlan(withPatch({
    runtime: { teachingLectureActive: true },
    inventory: { teachingReady: true },
  }));
  assert.equal(plan.storyOwner, 'teaching');
  assert.equal(plan.surfaces['beam.callouts'].mounted, false);
  assert.equal(
    plan.surfaces['beam.callouts'].mountReason,
    'teaching-story-suppresses-callouts',
  );
  assert.equal(plan.surfaces['teaching.handover-cones'].mounted, true);
  assert.equal(
    plan.surfaces['teaching.handover-cones'].source,
    'teaching-fixture',
  );
  for (const id of [
    'handover.pulse-cones',
    'handover.triggered-intra-cones',
    'handover.cinema-pair-cones',
    'handover.authority-transition-cones',
  ] as const) {
    assert.equal(plan.surfaces[id].mounted, false);
    assert.equal(
      plan.surfaces[id].mountReason,
      'teaching-story-suppresses-live-effects',
    );
  }
});

test('empty item inventories fail closed with an explicit reason', () => {
  const plan = resolveCoreSceneSurfacePlan(withPatch({
    inventory: {
      candidateConeCount: 0,
      pulseConeCount: 0,
      triggeredIntraConeCount: 0,
      cinemaPairConeCount: 0,
      authorityTransitionConeCount: 0,
      beamInfoCount: 0,
    },
  }));
  assert.equal(plan.surfaces['beam.candidate-cones'].mountReason, 'inventory-empty');
  assert.equal(plan.surfaces['handover.pulse-cones'].mountReason, 'inventory-empty');
  assert.equal(plan.surfaces['beam.callouts'].mountReason, 'inventory-empty');
});
test('serving footprints preserve the existing mount and child-visibility split', () => {
  const hidden = resolveCoreSceneSurfacePlan(withPatch({
    isolation: {
      active: true,
      hideNormalBeamField: true,
      preserveConfiguredServingFan: false,
    },
  }));
  assert.equal(hidden.surfaces['beam.serving-footprints'].mounted, false);
  assert.equal(
    hidden.surfaces['beam.serving-footprints'].mountReason,
    'handover-isolation-hidden',
  );

  const retained = resolveCoreSceneSurfacePlan(withPatch({
    isolation: {
      active: true,
      hideNormalBeamField: true,
      preserveConfiguredServingFan: true,
    },
  }));
  assert.equal(retained.surfaces['beam.serving-footprints'].mounted, true);
  assert.equal(retained.surfaces['beam.serving-footprints'].visible, true);

  const mountedButHidden = resolveCoreSceneSurfacePlan(withPatch({
    isolation: {
      active: false,
      hideNormalBeamField: true,
      preserveConfiguredServingFan: false,
    },
  }));
  assert.equal(mountedButHidden.surfaces['beam.serving-footprints'].mounted, true);
  assert.equal(mountedButHidden.surfaces['beam.serving-footprints'].visible, false);
  assert.equal(
    mountedButHidden.surfaces['beam.serving-footprints'].visibilityReason,
    'handover-field-hidden',
  );
});

test('mounted and visible id lists are derived from the exhaustive core registry', () => {
  const plan = resolveCoreSceneSurfacePlan(baseInput());
  assert.deepEqual(
    plan.mountedSurfaceIds,
    CORE_BEAM_SURFACE_IDS.filter(id => plan.surfaces[id].mounted),
  );
  assert.deepEqual(
    plan.visibleSurfaceIds,
    CORE_BEAM_SURFACE_IDS.filter(id => plan.surfaces[id].visible),
  );
});

const SCENE_DIRECTORY = dirname(fileURLToPath(import.meta.url));

test('every registry entry points to an existing renderer export', () => {
  for (const definition of Object.values(SCENE_SURFACE_REGISTRY)) {
    const moduleBase = resolve(SCENE_DIRECTORY, definition.rendererModule);
    const modulePath = [`${moduleBase}.ts`, `${moduleBase}.tsx`]
      .find(candidate => existsSync(candidate));
    assert.ok(modulePath, `${definition.id} points to a missing renderer module`);

    const moduleSource = readFileSync(modulePath, 'utf8');
    const escapedSymbol = definition.rendererSymbol
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      moduleSource,
      new RegExp(`export\\s+(?:async\\s+)?(?:function|const|class)\\s+${escapedSymbol}\\b`),
      `${definition.id} points to a renderer symbol that is not exported`,
    );
  }
});

interface LegacySurfaceState {
  readonly mounted: boolean;
  readonly visible: boolean;
}

function legacySurfaceState(
  input: CoreSceneSurfacePlanInput,
): Readonly<Record<CoreBeamSurfaceId, LegacySurfaceState>> {
  const candidateActive = input.story.multiCandidateSceneVisualActive;
  const servingContextAllowed = !candidateActive
    || input.story.homepageVisualIdentity;
  const servingFootprintMounted = input.stage.servingFootprints
    && input.runtime.showSinrLiveCellBeams
    && servingContextAllowed
    && (
      !input.isolation.active
      || input.story.multiCandidateCentralOverlayActive
      || input.isolation.preserveConfiguredServingFan
    );
  const state = (mounted: boolean, visible = mounted): LegacySurfaceState => ({
    mounted,
    visible: mounted && visible,
  });

  return {
    'beam.non-serving-cones': state(
      input.stage.ambientBeams
        && !candidateActive
        && input.inventory.nonServingConeCount > 0,
    ),
    'beam.serving-cones': state(
      input.stage.servingBeams
        && input.runtime.showSinrLiveCellBeams
        && servingContextAllowed,
    ),
    'beam.cinema-inter-serving-fan': state(
      input.stage.servingBeams
        && input.runtime.showSinrLiveCellBeams
        && !candidateActive
        && input.inventory.cinemaInterServingFanConeCount > 0,
    ),
    'beam.candidate-cones': state(
      input.stage.candidateBeams
        && input.runtime.showSinrLiveCellBeams
        && !candidateActive
        && input.inventory.candidateConeCount > 0,
    ),
    'handover.pulse-cones': state(
      input.stage.eventEffects
        && !input.runtime.teachingLectureActive
        && input.inventory.pulseConeCount > 0,
    ),
    'handover.triggered-intra-cones': state(
      input.stage.eventEffects
        && !input.runtime.teachingLectureActive
        && input.inventory.triggeredIntraConeCount > 0,
    ),
    'handover.cinema-pair-cones': state(
      input.stage.eventEffects
        && !input.runtime.teachingLectureActive
        && input.inventory.cinemaPairConeCount > 0,
    ),
    'handover.authority-transition-cones': state(
      input.stage.eventEffects
        && !input.runtime.teachingLectureActive
        && input.inventory.authorityTransitionConeCount > 0,
    ),
    'beam.serving-footprints': state(
      servingFootprintMounted,
      !input.isolation.hideNormalBeamField
        || input.isolation.preserveConfiguredServingFan,
    ),
    'beam.candidate-footprints': state(
      input.stage.candidateFootprints
        && input.runtime.showSinrLiveCellBeams
        && !candidateActive
        && input.inventory.candidateConeCount > 0,
    ),
    'beam.callouts': state(
      input.runtime.showBeamCallouts
        && !input.runtime.teachingLectureActive
        && input.inventory.beamInfoCount > 0,
    ),
    'teaching.handover-cones': state(
      input.inventory.teachingReady && input.stage.eventEffects,
    ),
  };
}

function matrixInput(index: number): CoreSceneSurfacePlanInput {
  const sample = Math.imul(index + 1, 0x45d9f3b);
  const bit = (position: number): boolean => ((sample >>> position) & 1) !== 0;
  const count = (position: number): number => bit(position) ? 1 : 0;
  return withPatch({
    stage: {
      ambientBeams: bit(0),
      servingBeams: bit(1),
      candidateBeams: bit(2),
      eventEffects: bit(3),
      servingFootprints: bit(4),
      candidateFootprints: bit(5),
    },
    runtime: {
      showSinrLiveCellBeams: bit(6),
      showBeamCallouts: bit(7),
      teachingLectureActive: bit(8),
    },
    story: {
      homepageVisualIdentity: bit(9),
      multiCandidateSceneVisualActive: bit(10),
      multiCandidateCentralOverlayActive: bit(11),
      multiCandidateIdentityTransitionActive: bit(12),
      handoverPresentationActive: bit(13),
      candidateReviewActive: bit(14),
    },
    isolation: {
      active: bit(15),
      hideNormalBeamField: bit(16),
      preserveConfiguredServingFan: bit(17),
    },
    inventory: {
      nonServingConeCount: count(18),
      cinemaInterServingFanConeCount: count(19),
      candidateConeCount: count(20),
      pulseConeCount: count(21),
      triggeredIntraConeCount: count(22),
      cinemaPairConeCount: count(23),
      authorityTransitionConeCount: count(24),
      beamInfoCount: count(25),
      teachingReady: bit(26),
    },
  });
}

test('the R1 plan remains byte-for-byte equivalent to the migrated JSX gates', () => {
  for (let index = 0; index < 4_096; index += 1) {
    const input = matrixInput(index);
    const plan = resolveCoreSceneSurfacePlan(input);
    const legacy = legacySurfaceState(input);
    for (const id of CORE_BEAM_SURFACE_IDS) {
      assert.deepEqual(
        {
          mounted: plan.surfaces[id].mounted,
          visible: plan.surfaces[id].visible,
        },
        legacy[id],
        `surface parity mismatch at sample ${index}: ${id}`,
      );
    }
  }
});
