import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type {
  BeamCellState,
  BeamDensity,
  RuntimeConfig,
  SimFrame,
  VisibleSat,
  VizFrame,
} from '../src/scene/types.ts';
import {
  CORE_LAYOUT_FREQUENCY_REUSE_VALUES,
  type CoreLayoutFrequencyReuse,
} from '../src/scene/beam-layout.ts';
import { useBeamViz } from '../src/scene/useBeamViz.ts';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry.ts';
import { liveSimToScene } from '../src/showcase/liveSimToScene.ts';
import {
  getBeamFrequencyIndex,
  resolveBeamFrequencyIndex,
  type BeamFrequencyIndexResolution,
  type MetadataBackedFrequencyIndexSource,
} from '../src/utils/beamFrequency.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_ID = 'hobs-2024-candidate-rich';
const SAT_A = 'shell-pro-53-P0-S0';
const SAT_B = 'shell-pro-53-P0-S1';
const SAT_C = 'shell-pro-53-P0-S2';
const SAT_D = 'shell-pro-53-P0-S3';
const SAT_IDS = [SAT_A, SAT_B, SAT_C, SAT_D] as const;
const SERVING_BEAM_ID = 5;
const PENDING_BEAM_ID = 7;
const RECENT_SOURCE_BEAM_ID = 3;
const AMBIENT_BEAM_ID = 5;

type MetadataMode = 'core-layout' | 'runtime-frequency-reuse-compatibility' | 'none';

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function createRuntime(density: BeamDensity): RuntimeConfig {
  return {
    // RuntimeConfig.appMode became required after this fixture was written.
    // 'sinr-experiment' keeps useBeamViz's density/slice branches on the same
    // (non-modqn) path the fixture always exercised; the assertions read only
    // frequency metadata, which is appMode-independent.
    appMode: 'sinr-experiment',
    presentationMode: 'demo-readability',
    replay: {
      epochUtcMs: Date.UTC(2026, 0, 1, 0, 0, 0),
      startOffsetSec: 0,
      loop: true,
    },
    signalResetKey: 'phase5b-validation',
    handoverResetKey: 'phase5b-validation',
    beamDensity: density,
    effectsEnabled: {
      spineParticles: true,
      orbitTrail: true,
      servingRipple: true,
      pendingRipple: true,
    },
    cinematicMode: 'off',
    reducedMotion: false,
    viewport: { width: 1440, height: 900 },
  };
}

function profileWithFrequencyReuse(frequencyReuse: number): Profile {
  const base = loadProfile(PROFILE_ID);
  return {
    ...base,
    beams: {
      ...base.beams,
      frequencyReuse,
    },
  };
}

function createVisibleSat(id: string, shellId: string, index: number): VisibleSat {
  return {
    id,
    shellId,
    altitudeKm: 550,
    world: new THREE.Vector3(-120 + index * 85, 300 - index * 8, -90 + index * 45),
    topo: {
      eastKm: -90 + index * 25,
      northKm: 160 - index * 20,
      upKm: 810,
      rangeKm: 930 + index * 8,
      azimuthDeg: 25 + index * 12,
      elevationDeg: 72 - index * 2,
    },
    latDeg: 40 + index * 0.1,
    lonDeg: 116 + index * 0.1,
  };
}

function reuseGroupForBeam(
  beamId: number,
  frequencyReuse: number,
  mode: MetadataMode,
): number | null {
  if (mode === 'none') return null;
  if (mode === 'core-layout') {
    const coreReuseGroups = [0, 1, 2, 0, 2, 1, 0];
    return coreReuseGroups[beamId - 1] ?? 0;
  }
  return (beamId === PENDING_BEAM_ID)
    ? 3
    : (beamId - 1) % frequencyReuse;
}

/**
 * Runtime-checked narrow to the src contract `CoreLayoutFrequencyReuse` (1|3|7).
 * The core-layout fixture only ever feeds 3, so this never throws today; if a
 * future fixture feeds an illegal reuse it fails loudly instead of being cast over.
 */
function toCoreLayoutFrequencyReuse(value: number): CoreLayoutFrequencyReuse {
  if (!(CORE_LAYOUT_FREQUENCY_REUSE_VALUES as readonly number[]).includes(value)) {
    throw new Error(
      `fixture coreLayoutFrequencyReuse ${value} is outside the src contract (${CORE_LAYOUT_FREQUENCY_REUSE_VALUES.join('|')})`,
    );
  }
  return value as CoreLayoutFrequencyReuse;
}

function createBeamCells(
  frequencyReuse: number,
  mode: MetadataMode,
): BeamCellState[] {
  const source: MetadataBackedFrequencyIndexSource | null = mode === 'none' ? null : mode;

  return Array.from({ length: 7 }, (_, index) => {
    const beamId = index + 1;
    const angle = index === 0 ? 0 : ((index - 1) / 6) * Math.PI * 2;
    const reuseGroup = reuseGroupForBeam(beamId, frequencyReuse, mode);
    return {
      beamId,
      offsetEastKm: index === 0 ? 0 : Math.cos(angle) * 22,
      offsetNorthKm: index === 0 ? 0 : Math.sin(angle) * 22,
      scanAngleDeg: index === 0 ? 0 : 2.5,
      ...(reuseGroup !== null && source !== null
        ? {
          reuseGroup,
          reuseGroupSource: source,
          runtimeFrequencyReuse: frequencyReuse,
          coreLayoutFrequencyReuse: source === 'core-layout' ? toCoreLayoutFrequencyReuse(frequencyReuse) : 1,
        }
        : {}),
    };
  });
}

function createLinkSamples(
  satellites: VisibleSat[],
  frequencyReuse: number,
  mode: MetadataMode,
  activeBeamIdsBySat: Map<string, number[]>,
): SimFrame['linkSamples'] {
  return satellites.flatMap((sat, satIndex) =>
    createBeamCells(frequencyReuse, mode).map(beam => {
      const isActive = activeBeamIdsBySat.get(sat.id)?.includes(beam.beamId) ?? false;
      return {
        satId: sat.id,
        beamId: beam.beamId,
        rsrpDbm: -92 + satIndex - beam.beamId * 0.2,
        sinrDb: (isActive ? 20 : 8) - satIndex - beam.beamId * 0.05,
        signalDbm: -91 + satIndex,
        intraInterferenceDbm: -118,
        interInterferenceDbm: -117,
        noiseDbm: -104,
        denominatorDbm: -103,
        txPowerDbm: 50,
        pathLossDb: 152,
        beamGainDb: 39,
        steeringLossDb: 1,
        receiverGainDbi: 0,
      };
    }));
}

function createSimFrame(profile: Profile, mode: MetadataMode): SimFrame {
  const frequencyReuse = profile.beams.frequencyReuse;
  const shellId = profile.orbit.shells[0].id;
  const satellites = SAT_IDS.map((satId, index) => createVisibleSat(satId, shellId, index));
  const activeBeamIdsBySat = new Map<string, number[]>([
    [SAT_A, [SERVING_BEAM_ID]],
    [SAT_B, [PENDING_BEAM_ID]],
    [SAT_C, [RECENT_SOURCE_BEAM_ID]],
    [SAT_D, [AMBIENT_BEAM_ID]],
  ]);
  const beamCellsBySatId = new Map(
    satellites.map(sat => [sat.id, createBeamCells(frequencyReuse, mode)]),
  );
  const displayAssignments = [...activeBeamIdsBySat.entries()].flatMap(([satId, beamIds]) =>
    beamIds.map(beamId => ({ satId, beamId })));

  return {
    satellites,
    linkSamples: createLinkSamples(satellites, frequencyReuse, mode, activeBeamIdsBySat),
    activeAssignments: displayAssignments,
    displayAssignments,
    beamCellsBySatId,
    steeringBeamCellsBySatId: beamCellsBySatId,
    linkRangeKmBySatId: new Map(satellites.map(sat => [sat.id, sat.topo.rangeKm])),
    beamHopSlotIndex: 4,
    beamHopSlotStartSec: 12,
    beamHopSlotSec: profile.beamHopping.slotSec,
    beamHopEnabled: false,
    beamHopStatesBySatId: new Map([...activeBeamIdsBySat.entries()].map(([satId, activeBeamIds]) => [
      satId,
      {
        satId,
        slotIndex: 4,
        frameSlotIndex: 4,
        activeBeamIds,
        candidateBeamIds: activeBeamIds,
      },
    ])),
    serving: { satId: SAT_A, beamId: SERVING_BEAM_ID, sinrDb: 19.8 },
    pendingTargetSatId: SAT_B,
    pendingTargetBeamId: PENDING_BEAM_ID,
    pendingTargetSinrDb: 19.1,
    recentHoSourceSatId: SAT_C,
    recentHoTargetSatId: null,
    recentHoSourceBeamId: RECENT_SOURCE_BEAM_ID,
    recentHoTargetBeamId: null,
    recentHoSourceSinrDb: 17.4,
    recentHoTargetSinrDb: null,
    recentHoDeltaDb: null,
    handoverTriggerProgressSec: 1.2,
    hoCount: 1,
    lastHoReason: '',
    simTimeSec: 60,
    // SimFrame fields added after this fixture was written; inert "no event /
    // origin / no UEs" values — none are read by the frequency-metadata paths
    // this validator asserts on.
    lastHoEvent: null,
    intraHoCount: 0,
    intraHandoverEvent: null,
    intraHandoverPreview: null,
    intraHandoverWallClockStartMs: null,
    intraHandoverWallClockExpiresMs: null,
    interHandoverEvent: null,
    interHandoverWallClockStartMs: null,
    interHandoverWallClockExpiresMs: null,
    ueGroundX: 0,
    ueGroundZ: 0,
    perUePositions: [],
  };
}

function renderViz(profile: Profile, sim: SimFrame, runtime: RuntimeConfig): VizFrame {
  let captured: VizFrame | null = null;

  function Probe() {
    const geometry = sceneGeometryFromProfile({
      shell: { altitudeKm: profile.orbit.shells[0]?.altitudeKm },
      antenna: { beamwidth3dBRad: profile.antenna.beamwidth3dBRad },
      handover: { triggerTimeSec: profile.handover.triggerTimeSec },
      orbit: { shells: profile.orbit.shells.map(s => ({ id: s.id, altitudeKm: s.altitudeKm })) },
      beams: { frequencyReuse: profile.beams.frequencyReuse },
    });
    const frame = liveSimToScene(sim, geometry);
    captured = useBeamViz(frame, geometry, runtime, undefined, undefined, profile.beamHopping);
    return React.createElement('div', { 'data-testid': 'viz-probe' });
  }

  renderToStaticMarkup(React.createElement(Probe));
  assert.ok(captured, 'useBeamViz probe did not capture a VizFrame');
  return captured;
}

function beamKey(satId: string, beamId: number): string {
  return `${satId}:B${beamId}`;
}

function getVizBeam(viz: VizFrame, satId: string, beamId: number): {
  frequencyIndex: number;
  frequencyIndexSource?: string;
} {
  const beam = viz.satBeams.get(satId)?.find(entry => entry.beamId === beamId);
  assert.ok(beam, `missing visual beam ${beamKey(satId, beamId)}`);
  return beam as typeof beam & { frequencyIndexSource?: string };
}

function assertFrequencyResolution(
  actual: BeamFrequencyIndexResolution | undefined,
  expected: {
    frequencyIndex: number;
    frequencyIndexSource: BeamFrequencyIndexResolution['frequencyIndexSource'];
  },
  label: string,
): void {
  assert.ok(actual, `${label} missing visual frequency metadata`);
  assert.equal(actual.frequencyIndex, expected.frequencyIndex, `${label} frequencyIndex drifted`);
  assert.equal(actual.frequencyIndexSource, expected.frequencyIndexSource, `${label} frequencyIndexSource drifted`);
}

function assertResolverBehavior(): void {
  assertFrequencyResolution(
    resolveBeamFrequencyIndex({
      beamId: SERVING_BEAM_ID,
      frequencyReuse: 3,
      reuseGroup: 2,
      reuseGroupSource: 'core-layout',
      runtimeFrequencyReuse: 3,
      coreLayoutFrequencyReuse: 3,
    }),
    { frequencyIndex: 2, frequencyIndexSource: 'core-layout' },
    'core resolver',
  );
  assert.notEqual(
    2,
    getBeamFrequencyIndex(SERVING_BEAM_ID, 3),
    'core resolver fixture no longer distinguishes metadata from numeric modulo',
  );

  assertFrequencyResolution(
    resolveBeamFrequencyIndex({
      beamId: PENDING_BEAM_ID,
      frequencyReuse: 4,
      reuseGroup: 3,
      reuseGroupSource: 'runtime-frequency-reuse-compatibility',
      runtimeFrequencyReuse: 4,
      coreLayoutFrequencyReuse: 1,
    }),
    { frequencyIndex: 3, frequencyIndexSource: 'runtime-frequency-reuse-compatibility' },
    'compatibility resolver',
  );
  assert.notEqual(
    3,
    getBeamFrequencyIndex(PENDING_BEAM_ID, 4),
    'compatibility resolver fixture no longer distinguishes metadata from numeric modulo',
  );

  assertFrequencyResolution(
    resolveBeamFrequencyIndex({
      beamId: PENDING_BEAM_ID,
      frequencyReuse: 4,
    }),
    { frequencyIndex: getBeamFrequencyIndex(PENDING_BEAM_ID, 4), frequencyIndexSource: 'fallback-numeric-modulo' },
    'fallback resolver',
  );
}

function assertVizUsesCoreReuseMetadata(): void {
  const profile = profileWithFrequencyReuse(3);
  const viz = renderViz(
    profile,
    createSimFrame(profile, 'core-layout'),
    createRuntime('event-plus-1'),
  );
  const servingBeam = getVizBeam(viz, SAT_A, SERVING_BEAM_ID);
  assert.equal(servingBeam.frequencyIndex, 2, 'serving visual beam did not consume core reuseGroup');
  assert.equal(servingBeam.frequencyIndexSource, 'core-layout', 'serving visual beam did not expose core-layout source');
  assertFrequencyResolution(
    viz.visualFrequencyByBeamKey.get(beamKey(SAT_A, SERVING_BEAM_ID)),
    { frequencyIndex: 2, frequencyIndexSource: 'core-layout' },
    'serving visual-frequency map',
  );

  const ambientRing = viz.ambientRings.find(ring =>
    ring.satelliteId === SAT_D && ring.beamId === AMBIENT_BEAM_ID);
  assert.ok(ambientRing, 'event-plus-1 did not emit the expected ambient ring');
  assert.equal(ambientRing.frequencyIndex, 2, 'ambient ring did not consume core reuseGroup');
  assert.equal(ambientRing.frequencyIndexSource, 'core-layout', 'ambient ring did not expose core-layout source');
  assert.equal(
    ambientRing.frequencyIndex,
    viz.visualFrequencyByBeamKey.get(beamKey(SAT_D, AMBIENT_BEAM_ID))?.frequencyIndex,
    'ambient ring metadata drifted from visual-frequency map',
  );
}

function assertVizUsesCompatibilityReuseMetadata(): void {
  const profile = profileWithFrequencyReuse(4);
  const viz = renderViz(
    profile,
    createSimFrame(profile, 'runtime-frequency-reuse-compatibility'),
    createRuntime('event-only'),
  );
  const pendingBeam = getVizBeam(viz, SAT_B, PENDING_BEAM_ID);
  assert.equal(pendingBeam.frequencyIndex, 3, 'pending visual beam did not consume compatibility reuseGroup');
  assert.equal(
    pendingBeam.frequencyIndexSource,
    'runtime-frequency-reuse-compatibility',
    'pending visual beam mislabeled compatibility reuse metadata',
  );
  assertFrequencyResolution(
    viz.visualFrequencyByBeamKey.get(beamKey(SAT_B, PENDING_BEAM_ID)),
    { frequencyIndex: 3, frequencyIndexSource: 'runtime-frequency-reuse-compatibility' },
    'pending compatibility visual-frequency map',
  );
}

function assertVizFallsBackOnlyWhenMetadataIsAbsent(): void {
  const profile = profileWithFrequencyReuse(4);
  const viz = renderViz(
    profile,
    createSimFrame(profile, 'none'),
    createRuntime('event-only'),
  );
  const expectedFallback = getBeamFrequencyIndex(PENDING_BEAM_ID, 4);
  const pendingBeam = getVizBeam(viz, SAT_B, PENDING_BEAM_ID);
  assert.equal(pendingBeam.frequencyIndex, expectedFallback, 'fallback visual beam did not use numeric modulo');
  assert.equal(pendingBeam.frequencyIndexSource, 'fallback-numeric-modulo', 'fallback visual beam source drifted');
  assertFrequencyResolution(
    viz.visualFrequencyByBeamKey.get(beamKey(SAT_B, PENDING_BEAM_ID)),
    { frequencyIndex: expectedFallback, frequencyIndexSource: 'fallback-numeric-modulo' },
    'pending fallback visual-frequency map',
  );
}

function assertStaticWiringAndBoundaries(): void {
  const useBeamVizSource = readRepoFile('src/scene/useBeamViz.ts');
  const typesSource = readRepoFile('src/scene/types.ts');
  const beamFrequencySource = readRepoFile('src/utils/beamFrequency.ts');
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };

  assert.match(
    useBeamVizSource,
    /resolveBeamFrequencyIndex/,
    'useBeamViz no longer resolves visual frequency labels through the metadata-aware resolver',
  );
  assert.doesNotMatch(
    useBeamVizSource,
    /getBeamFrequencyIndex/,
    'useBeamViz reintroduced direct numeric modulo visual frequency labels',
  );
  assert.match(
    typesSource,
    /visualFrequencyByBeamKey: Map<string, BeamFrequencyIndexResolution>/,
    'VizFrame lost diagnostic visual frequency metadata',
  );
  assert.match(
    typesSource,
    /interface AmbientRing extends BeamFrequencyIndexResolution/,
    'AmbientRing lost frequency label source metadata',
  );
  assert.match(
    beamFrequencySource,
    /fallback-numeric-modulo/,
    'beam frequency resolver lost explicit fallback source labeling',
  );
  assert.equal(
    packageJson.scripts?.['validate:modqn:phase5b-visual-reuse-metadata'],
    'node --import tsx/esm scripts/validate-modqn-phase5b-visual-reuse-metadata.ts',
    'package.json lost the Phase 5B validator script',
  );

  for (const relativePath of [
    'src/scene/useBeamViz.ts',
    'src/scene/types.ts',
    'src/utils/beamFrequency.ts',
  ]) {
    const source = readRepoFile(relativePath);
    assert.doesNotMatch(source, /parseModqnReplayBundle|createBeamLayoutBridgeIdentity/, `${relativePath} derived producer replay identity`);
    assert.doesNotMatch(source, /MODQN replay evidence/i, `${relativePath} presented live visual frequency labels as MODQN replay evidence`);
  }
}

function assertClaimBoundaryText(): void {
  for (const relativePath of [
    'docs/modqn-baseline-phase5b-visual-reuse-metadata.md',
    'scripts/validate-modqn-phase5b-visual-reuse-metadata.ts',
  ]) {
    const text = readRepoFile(relativePath);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37)/i.test(normalized);
      const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary)\b/i.test(normalized);

      assert.equal(
        referencesExtendedCounts && referencesEvidence && !isNegatedBoundary,
        false,
        `${relativePath}:${lineIndex + 1} leaks an unsupported 19/37 evidence claim`,
      );
    }
  }
}

function run(): void {
  assertResolverBehavior();
  assertVizUsesCoreReuseMetadata();
  assertVizUsesCompatibilityReuseMetadata();
  assertVizFallsBackOnlyWhenMetadataIsAbsent();
  assertStaticWiringAndBoundaries();
  assertClaimBoundaryText();

  console.log('MODQN Phase 5B visual reuse metadata validation passed.');
  console.log(JSON.stringify({
    visualFrequencyResolver: 'metadata-first',
    metadataBackedSources: ['core-layout', 'runtime-frequency-reuse-compatibility'],
    fallbackSource: 'fallback-numeric-modulo',
    visualTargetsUseReuseGroupWhenPresent: true,
    ambientRingsUseReuseGroupWhenPresent: true,
    numericBeamIdsChanged: false,
    producerReplayIdentityDerivedInSceneViz: false,
    hobsSinrPresentedAsModqnReplayEvidence: false,
    uiBeamCountControlsAdded: false,
    result: 'PASS',
  }, null, 2));
}

run();
