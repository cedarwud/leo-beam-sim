import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import {
  frequencyReuseColor,
  resolveBeamVisualEncoding,
  satelliteTint,
  type BeamCodeRole,
} from '../src/constants/beamRoleTokens.ts';
import { getFormulaFamilyLabel, loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import { deriveRuntimeVisualSettings } from '../src/scene/runtimeConfig.ts';
import type {
  BeamDensity,
  LinkBudgetTerms,
  RuntimeConfig,
  SimFrame,
  SimState,
  VisibleSat,
  VizFrame,
} from '../src/scene/types.ts';
import { useBeamViz } from '../src/scene/useBeamViz.ts';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry.ts';
import { liveSimToScene } from '../src/showcase/liveSimToScene.ts';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { BeamCalloutContent, type BeamTarget } from '../src/viz/SatelliteBeams.tsx';
import { satelliteGlyph } from '../src/viz/glyphs.ts';
import { formatBeamIdentity, formatBeamIdentityByIndex, formatSatelliteLabel } from '../src/utils/formatSatelliteLabel.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const SAT_A = 'shell-pro-53-P0-S3';
const SAT_B = 'shell-retro000-P4-S10';
const SAT_C = 'shell-polar-090-P0-S3';
const SAT_D = 'shell-pro-53-P1-S0';
const SAT_E = 'shell-pro-53-P2-S1';
const SAT_F = 'shell-pro-53-P2-S2';
const SAT_IDS = [SAT_A, SAT_B, SAT_C, SAT_D, SAT_E, SAT_F] as const;

const SERVING_BEAM_ID = 5;
const PENDING_BEAM_ID = 3;
const APPROACH_BEAM_ID = 11;

const BASE_RUNTIME: Omit<
  RuntimeConfig,
  'beamDensity' | 'viewport' | 'effectsEnabled' | 'cinematicMode' | 'reducedMotion'
> = {
  // RuntimeConfig.appMode became required after this fixture was written.
  // 'sinr-experiment' keeps useBeamViz's density/slice branches on the same
  // (non-modqn) path the fixture always exercised; the identity assertions
  // read tint/glyph propagation, which is appMode-independent.
  appMode: 'sinr-experiment',
  presentationMode: 'demo-readability',
  replay: {
    epochUtcMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    startOffsetSec: 0,
    loop: true,
  },
  signalResetKey: 'vc1d-validation',
  handoverResetKey: 'vc1d-validation',
};

interface EventCalloutFixture {
  name: string;
  satId: string;
  beamId: number;
  frequencyIndex: number;
  role: BeamCodeRole;
  isServing: boolean;
  sinrDb: number;
}

function decodeHtmlText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagByTestId(markup: string, testId: string): string {
  const match = markup.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`));
  assert.ok(match, `expected rendered markup to include data-testid="${testId}"`);
  return match[0];
}

function extractAttr(markup: string, attr: string): string {
  const match = markup.match(new RegExp(`${attr}="([^"]*)"`));
  assert.ok(match, `expected rendered markup to include ${attr}`);
  return match[1];
}

function createRuntime(density: BeamDensity, width: number, height: number): RuntimeConfig {
  return {
    ...BASE_RUNTIME,
    ...deriveRuntimeVisualSettings(false),
    beamDensity: density,
    viewport: { width, height },
  };
}

function createBudgetTerms(seed: number): LinkBudgetTerms {
  return {
    signalDbm: -92 + seed,
    intraInterferenceDbm: -118 + seed,
    interInterferenceDbm: -116 + seed,
    noiseDbm: -104,
    denominatorDbm: -103 + seed,
    txPowerDbm: 50,
    pathLossDb: 152 - seed,
    beamGainDb: 39,
    steeringLossDb: 1,
    receiverGainDbi: 0,
  };
}

function createVisibleSat(id: string, shellId: string, index: number): VisibleSat {
  return {
    id,
    shellId,
    altitudeKm: 550,
    world: new THREE.Vector3(-240 + index * 90, 260 + index * 18, -180 + index * 42),
    topo: {
      eastKm: -160 + index * 35,
      northKm: 220 - index * 18,
      upKm: 780,
      rangeKm: 920 + index * 5,
      azimuthDeg: 28 + index * 7,
      elevationDeg: 64 - index,
    },
    latDeg: 40 + index * 0.1,
    lonDeg: 116 + index * 0.1,
  };
}

function createBeamCells(maxBeamId = APPROACH_BEAM_ID): NonNullable<SimFrame['steeringBeamCellsBySatId'] extends Map<string, infer T> ? T : never> {
  return Array.from({ length: maxBeamId }, (_, index) => {
    const beamId = index + 1;
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      beamId,
      offsetEastKm: (column - 1.5) * 18,
      offsetNorthKm: (row - 1) * 18,
      scanAngleDeg: 2 + (beamId % 3),
    };
  });
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

function createForcedSimFrame(profile: Profile): SimFrame {
  const shellIds = profile.orbit.shells.map(shell => shell.id);
  const satellites = SAT_IDS.map((satId, index) => createVisibleSat(satId, shellIds[index % shellIds.length], index));
  const activeBeamIdsBySat = new Map<string, number[]>([
    [SAT_A, [SERVING_BEAM_ID, 1]],
    [SAT_B, [PENDING_BEAM_ID, 6]],
    [SAT_C, [APPROACH_BEAM_ID, 7]],
    [SAT_D, [4]],
    [SAT_E, [5]],
    [SAT_F, [6]],
  ]);
  const beamCellsBySatId = new Map(satellites.map(sat => [sat.id, createBeamCells()]));
  const displayAssignments = [...activeBeamIdsBySat.entries()].flatMap(([satId, beamIds]) =>
    beamIds.map(beamId => ({ satId, beamId })));
  const linkSamples = satellites.flatMap((sat, satIndex) =>
    createBeamCells().map(beam => {
      const isScheduled = activeBeamIdsBySat.get(sat.id)?.includes(beam.beamId) ?? false;
      return {
        satId: sat.id,
        beamId: beam.beamId,
        rsrpDbm: -90 + satIndex - beam.beamId,
        sinrDb: (isScheduled ? 20 : 8) - satIndex - beam.beamId * 0.1,
        signalDbm: -92 + satIndex,
        intraInterferenceDbm: -118,
        interInterferenceDbm: -116,
        noiseDbm: -104,
        denominatorDbm: -103,
        txPowerDbm: 50,
        pathLossDb: 152,
        beamGainDb: 39,
        steeringLossDb: 1,
        receiverGainDbi: 0,
      };
    }));

  return {
    satellites,
    linkSamples,
    activeAssignments: displayAssignments,
    displayAssignments,
    beamCellsBySatId,
    steeringBeamCellsBySatId: beamCellsBySatId,
    linkRangeKmBySatId: new Map(satellites.map(sat => [sat.id, sat.topo.rangeKm])),
    beamHopSlotIndex: 12,
    beamHopSlotStartSec: 30,
    beamHopSlotSec: profile.beamHopping.slotSec,
    beamHopEnabled: true,
    beamHopStatesBySatId: new Map([...activeBeamIdsBySat.entries()].map(([satId, activeBeamIds]) => [
      satId,
      {
        satId,
        slotIndex: 12,
        frameSlotIndex: 5,
        activeBeamIds,
        candidateBeamIds: activeBeamIds,
      },
    ])),
    serving: { satId: SAT_A, beamId: SERVING_BEAM_ID, sinrDb: 18.7 },
    pendingTargetSatId: SAT_B,
    pendingTargetBeamId: PENDING_BEAM_ID,
    pendingTargetSinrDb: 19.2,
    recentHoSourceSatId: SAT_C,
    recentHoTargetSatId: null,
    recentHoSourceBeamId: APPROACH_BEAM_ID,
    recentHoTargetBeamId: null,
    recentHoSourceSinrDb: 15.4,
    recentHoTargetSinrDb: null,
    recentHoDeltaDb: null,
    handoverTriggerProgressSec: 1.6,
    hoCount: 1,
    lastHoReason: '',
    simTimeSec: 90,
    // SimFrame fields added after this fixture was written; inert "no event /
    // origin / no UEs" values — none are read by the identity-propagation paths
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

function createPanelState(profile: Profile): SimState {
  const satelliteVisualIdentityById = Object.fromEntries(SAT_IDS.map((satId, index) => [
    satId,
    {
      satelliteTintColor: satelliteTint(satId, index),
      satelliteGlyph: satelliteGlyph(index),
      satelliteVisualIndex: index,
    },
  ]));

  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
    satelliteVisualIdentityById,
    physicalServing: {
      satId: SAT_A,
      beamId: SERVING_BEAM_ID,
      sinrDb: 18.7,
      elevationDeg: 54.2,
      rangeKm: 870,
      status: 'live',
    },
    panelPrimary: {
      role: 'serving',
      satId: SAT_A,
      beamId: SERVING_BEAM_ID,
      sinrDb: 18.7,
      elevationDeg: 54.2,
      rangeKm: 870,
      status: 'live',
    },
    panelComparison: {
      role: 'pending',
      satId: SAT_B,
      beamId: PENDING_BEAM_ID,
      sinrDb: 19.2,
      elevationDeg: 56.4,
      rangeKm: 820,
      status: 'live',
    },
    servingSatId: SAT_A,
    servingBeamId: SERVING_BEAM_ID,
    servingElevationDeg: 54.2,
    servingRangeKm: 870,
    pendingTargetSatId: SAT_B,
    pendingTargetBeamId: PENDING_BEAM_ID,
    pendingTargetSinrDb: 19.2,
    comparisonSatId: SAT_B,
    comparisonBeamId: PENDING_BEAM_ID,
    comparisonElevationDeg: 56.4,
    comparisonRangeKm: 820,
    comparisonSinrDb: 19.2,
    comparisonKind: 'pending',
    sinrDeltaDb: 0.5,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    // SimState fields added after this fixture was written; inert values —
    // InfoPanel never destructures these, and servingCellId is short-circuited
    // behind the non-null servingBeamId/comparisonBeamId here.
    servingCellId: null,
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoDeltaDb: null,
    lastHoEvent: null,
    simTimeSec: 0,
    intraHoCount: 0,
    sinrDb: 18.7,
    physicalServingBudget: createBudgetTerms(0),
    servingBudget: createBudgetTerms(1),
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: 1.6,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: 0,
    lastHoReason: `inter-HO: ${SAT_B} B${PENDING_BEAM_ID}, 1.6/${profile.handover.triggerTimeSec.toFixed(1)}s`,
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: 12,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: [SERVING_BEAM_ID],
    pendingTargetActiveBeamIds: [PENDING_BEAM_ID],
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
    return <div data-testid="viz-probe" />;
  }

  renderToStaticMarkup(<Probe />);
  assert.ok(captured, 'useBeamViz probe did not capture a VizFrame');
  return captured;
}

function renderCallout(input: {
  satId: string;
  beamId: number;
  frequencyIndex: number;
  role?: BeamCodeRole;
  isServing: boolean;
  isPrimary: boolean;
  isScheduledActive: boolean;
  sinrDb: number | null;
}): { markup: string; text: string } {
  const style = resolveBeamVisualEncoding({
    role: input.role,
    isPrimary: input.isPrimary,
    isServing: input.isServing,
    isScheduledActive: input.isScheduledActive,
    frequencyColor: frequencyReuseColor(input.frequencyIndex),
  });
  const beam: Pick<BeamTarget, 'beamId' | 'frequencyIndex'> = {
    beamId: input.beamId,
    frequencyIndex: input.frequencyIndex,
  };
  const markup = renderToStaticMarkup(
    <BeamCalloutContent
      satelliteId={input.satId}
      satelliteGlyph={satelliteGlyph(SAT_IDS.indexOf(input.satId as typeof SAT_IDS[number]))}
      beam={beam}
      style={style}
      color={style.color}
      sinrLabel={input.sinrDb === null ? '-- dB' : `${input.sinrDb.toFixed(1)} dB`}
      isEmphasized={style.isEmphasized}
    />,
  );

  return { markup, text: decodeHtmlText(markup) };
}

function countConeBeams(viz: VizFrame): number {
  return [...viz.satBeams.values()].reduce((total, beams) => total + beams.length, 0);
}

function assertEventCalloutIdentityScaffold(): void {
  const fixtures: EventCalloutFixture[] = [
    {
      name: 'serving Sat-A Beam 5 F2',
      satId: SAT_A,
      beamId: SERVING_BEAM_ID,
      frequencyIndex: 1,
      role: 'serving',
      isServing: true,
      sinrDb: 18.7,
    },
    {
      name: 'pending Sat-B Beam 3 F1',
      satId: SAT_B,
      beamId: PENDING_BEAM_ID,
      frequencyIndex: 0,
      role: 'prepared',
      isServing: false,
      sinrDb: 19.2,
    },
    {
      name: 'approach Sat-C Beam 11 F3',
      satId: SAT_C,
      beamId: APPROACH_BEAM_ID,
      frequencyIndex: 2,
      role: 'approach',
      isServing: false,
      sinrDb: 15.4,
    },
  ];

  for (const fixture of fixtures) {
    const { markup, text } = renderCallout({
      ...fixture,
      isPrimary: true,
      isScheduledActive: true,
    });
    const satelliteLabel = formatSatelliteLabel(fixture.satId);
    const identity = formatBeamIdentityByIndex({
      satId: fixture.satId,
      beamId: fixture.beamId,
      frequencyIndex: fixture.frequencyIndex,
    });
    const style = resolveBeamVisualEncoding({
      role: fixture.role,
      isPrimary: true,
      isServing: fixture.isServing,
      isScheduledActive: true,
      frequencyColor: frequencyReuseColor(fixture.frequencyIndex),
    });

    assert.equal(
      extractAttr(markup, 'data-satellite-label'),
      satelliteLabel,
      `${fixture.name} did not expose the satellite owner chip label`,
    );
    assert.equal(
      extractAttr(markup, 'data-beam-identity'),
      identity,
      `${fixture.name} did not expose the canonical identity`,
    );
    assert.ok(text.includes(satelliteLabel), `${fixture.name} callout did not include ${satelliteLabel}: ${text}`);
    assert.ok(text.includes(style.operatorLabel!), `${fixture.name} did not include ${style.operatorLabel}: ${text}`);
    assert.ok(
      text.indexOf(satelliteLabel) < text.indexOf(style.operatorLabel!),
      `${fixture.name} owner chip did not precede the identity line: ${text}`,
    );
  }
}

function assertVizDensityAndIdentityParity(): void {
  const profile = profileWithFrequencyReuse(3);
  const sim = createForcedSimFrame(profile);

  const eventOnly = renderViz(profile, sim, createRuntime('event-only', 1440, 900));
  assert.equal(countConeBeams(eventOnly), 3, 'event-only should keep the three event-role callouts');
  assert.equal(eventOnly.ambientRings.length, 0, 'event-only must not emit ambient rings');

  const eventPlusDesktop = renderViz(profile, sim, createRuntime('event-plus-1', 1440, 900));
  assert.equal(countConeBeams(eventPlusDesktop), 6, 'event-plus-1 desktop should keep three event roles plus three ambient floor callouts');
  assert.equal(
    eventPlusDesktop.ambientRings.length,
    eventPlusDesktop.displaySats.length - eventPlusDesktop.satBeams.size,
    'event-plus-1 desktop should emit one ambient ring per visible satellite outside beamSatIds',
  );

  const eventPlusCompact = renderViz(profile, sim, createRuntime('event-plus-1', 1366, 768));
  assert.equal(countConeBeams(eventPlusCompact), 4, 'event-plus-1 compact should enforce the four-callout cap');
  assert.equal(eventPlusCompact.ambientRings.length, 5, 'event-plus-1 compact should downgrade excess desktop callouts to ambient rings');

  const all = renderViz(profile, sim, createRuntime('all', 1440, 900));
  assert.equal(all.ambientRings.length, 0, 'all density must not emit Phase 1B ambient rings');
  assert.ok(countConeBeams(all) >= 6, 'all density should keep the uncapped cone-beam set');

  const calloutIdentityByKey = new Map<string, string>();
  for (const [satId, beams] of eventPlusDesktop.satBeams.entries()) {
    for (const beam of beams) {
      const { markup, text } = renderCallout({
        satId,
        beamId: beam.beamId,
        frequencyIndex: beam.frequencyIndex,
        role: beam.role,
        isServing: beam.isServing,
        isPrimary: beam.isPrimary,
        isScheduledActive: beam.isScheduledActive,
        sinrDb: beam.sinrDb ?? null,
      });
      const satelliteLabel = formatSatelliteLabel(satId);
      const identity = formatBeamIdentityByIndex({
        satId,
        beamId: beam.beamId,
        frequencyIndex: beam.frequencyIndex,
      });

      assert.ok(text.includes(satelliteLabel), `${satId} B${beam.beamId} callout did not include owner chip`);
      assert.equal(extractAttr(markup, 'data-satellite-label'), satelliteLabel);
      assert.equal(extractAttr(markup, 'data-beam-identity'), identity);
      calloutIdentityByKey.set(`${satId}:B${beam.beamId}`, identity);
    }
  }

  const panelMarkup = renderToStaticMarkup(
    <InfoPanel {...createPanelState(profile)} showFormulaTerms profile={profile} />,
  );
  const servingPanelIdentity = extractAttr(
    extractTagByTestId(panelMarkup, 'info-panel-primary-beam-identity'),
    'data-beam-identity',
  );
  const pendingPanelIdentity = extractAttr(
    extractTagByTestId(panelMarkup, 'info-panel-comparison-beam-identity'),
    'data-beam-identity',
  );
  const servingCalloutIdentity = calloutIdentityByKey.get(`${SAT_A}:B${SERVING_BEAM_ID}`);
  const pendingCalloutIdentity = calloutIdentityByKey.get(`${SAT_B}:B${PENDING_BEAM_ID}`);

  assert.equal(servingPanelIdentity, servingCalloutIdentity, 'serving panel identity drifted from scene callout identity');
  assert.equal(pendingPanelIdentity, pendingCalloutIdentity, 'pending panel identity drifted from scene callout identity');
  assert.equal(
    servingPanelIdentity,
    formatBeamIdentity({ satId: SAT_A, beamId: SERVING_BEAM_ID, frequencyReuse: profile.beams.frequencyReuse }),
  );
  assert.equal(
    pendingPanelIdentity,
    formatBeamIdentity({ satId: SAT_B, beamId: PENDING_BEAM_ID, frequencyReuse: profile.beams.frequencyReuse }),
  );
}

function run(): void {
  assertEventCalloutIdentityScaffold();
  assertVizDensityAndIdentityParity();

  console.log('Visual Clarity Phase 1D identity-match validation passed.');
  console.log(JSON.stringify({
    v2: {
      eventCalloutScaffold: ['serving Sat-A Beam 5 F2', 'pending Sat-B Beam 3 F1', 'approach Sat-C Beam 11 F3'],
      densityFixtures: ['event-only', 'event-plus-1 desktop', 'event-plus-1 compact', 'all'],
      panelSceneIdentityParity: ['serving', 'pending'],
      pixelAssertions: 'delegated to validate:vc1c:freq-color-demotion',
    },
    result: 'PASS',
  }, null, 2));
}

run();
