import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { chromium, type Browser } from '@playwright/test';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import {
  deriveRuntimeVisualSettings,
  REDUCED_MOTION_QUERY,
  subscribeToReducedMotionPreference,
} from '../src/scene/runtimeConfig.ts';
import type {
  BeamDensity,
  RuntimeConfig,
  SimFrame,
  VizFrame,
  VisibleSat,
} from '../src/scene/types.ts';
import { useBeamViz } from '../src/scene/useBeamViz.ts';
import { sceneGeometryFromProfile } from '../src/scene/SceneGeometry.ts';
import { liveSimToScene } from '../src/showcase/liveSimToScene.ts';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const SAT_IDS = [
  'shell-pro-53-P0-S0',
  'shell-pro-53-P0-S1',
  'shell-pro-53-P0-S2',
  'shell-pro-53-P0-S3',
  'shell-pro-53-P0-S4',
  'shell-pro-53-P0-S5',
] as const;

const BASE_RUNTIME: Omit<RuntimeConfig, 'beamDensity' | 'viewport' | 'effectsEnabled' | 'cinematicMode' | 'reducedMotion'> = {
  presentationMode: 'demo-readability',
  replay: {
    epochUtcMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    startOffsetSec: 0,
    loop: true,
  },
  signalResetKey: 'vc1b-validation',
  handoverResetKey: 'vc1b-validation',
};

function createRuntime(density: BeamDensity, width: number, height: number): RuntimeConfig {
  return {
    ...BASE_RUNTIME,
    ...deriveRuntimeVisualSettings(false),
    beamDensity: density,
    viewport: { width, height },
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

function createBeamCells(): SimFrame['steeringBeamCellsBySatId'] extends Map<string, infer T> ? T : never {
  return [
    { beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
    { beamId: 2, offsetEastKm: 18, offsetNorthKm: 0, scanAngleDeg: 2 },
    { beamId: 3, offsetEastKm: 0, offsetNorthKm: 18, scanAngleDeg: 2 },
    { beamId: 4, offsetEastKm: -18, offsetNorthKm: 0, scanAngleDeg: 2 },
    { beamId: 5, offsetEastKm: 0, offsetNorthKm: -18, scanAngleDeg: 2 },
    { beamId: 6, offsetEastKm: 18, offsetNorthKm: 18, scanAngleDeg: 3 },
    { beamId: 7, offsetEastKm: -18, offsetNorthKm: -18, scanAngleDeg: 3 },
  ];
}

function createForcedSimFrame(profile: Profile): SimFrame {
  const shellId = profile.orbit.shells[0].id;
  const satellites = SAT_IDS.map((satId, index) => createVisibleSat(satId, shellId, index));
  const activeBeamIdsBySat = new Map<string, number[]>([
    [SAT_IDS[0], [1, 5]],
    [SAT_IDS[1], [2, 6]],
    [SAT_IDS[2], [3, 7]],
    [SAT_IDS[3], [4]],
    [SAT_IDS[4], [5]],
    [SAT_IDS[5], [6]],
  ]);
  const beamCellsBySatId = new Map(satellites.map(sat => [sat.id, createBeamCells()]));
  const displayAssignments = [...activeBeamIdsBySat.entries()].flatMap(([satId, beamIds]) =>
    beamIds.map(beamId => ({ satId, beamId })));
  const linkSamples = satellites.flatMap((sat, satIndex) =>
    createBeamCells().map(beam => {
      const isPreferredAmbient = activeBeamIdsBySat.get(sat.id)?.includes(beam.beamId) ?? false;
      return {
        satId: sat.id,
        beamId: beam.beamId,
        rsrpDbm: -90 + satIndex - beam.beamId,
        sinrDb: (isPreferredAmbient ? 18 : 8) - satIndex - beam.beamId * 0.1,
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
    serving: { satId: SAT_IDS[0], beamId: 1, sinrDb: 18.7 },
    pendingTargetSatId: SAT_IDS[1],
    pendingTargetBeamId: 2,
    pendingTargetSinrDb: 19.2,
    recentHoSourceSatId: SAT_IDS[2],
    recentHoTargetSatId: null,
    recentHoSourceBeamId: 3,
    recentHoTargetBeamId: null,
    recentHoSourceSinrDb: 15.4,
    recentHoTargetSinrDb: null,
    recentHoDeltaDb: null,
    handoverTriggerProgressSec: 1.6,
    hoCount: 1,
    lastHoReason: '',
    simTimeSec: 90,
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

function countConeBeams(viz: VizFrame): number {
  return [...viz.satBeams.values()].reduce((total, beams) => total + beams.length, 0);
}

function beamFingerprint(viz: VizFrame): Array<{ satId: string; beams: Array<{ beamId: number; role: string | null }> }> {
  return [...viz.satBeams.entries()].map(([satId, beams]) => ({
    satId,
    beams: beams.map(beam => ({ beamId: beam.beamId, role: beam.role ?? null })),
  }));
}

function assertV2DensityFixtures(): void {
  const profile = loadProfile(PROFILE_ID);
  const sim = createForcedSimFrame(profile);

  const eventOnly = renderViz(profile, sim, createRuntime('event-only', 1440, 900));
  assert.ok(countConeBeams(eventOnly) <= 4, 'event-only exceeded the 4-callout cap');
  assert.equal(countConeBeams(eventOnly), 3, 'event-only should keep the three event primaries inside MAX_BEAM_SATS');
  assert.equal(eventOnly.ambientRings.length, 0, 'event-only must not emit ambient rings');
  for (const beams of eventOnly.satBeams.values()) {
    assert.equal(beams.length, 1, 'event-only should keep one primary beam per event satellite');
    assert.ok(beams[0].role, 'event-only kept a non-event cone beam');
  }

  const eventPlusDesktop = renderViz(profile, sim, createRuntime('event-plus-1', 1440, 900));
  assert.equal(countConeBeams(eventPlusDesktop), 6, 'event-plus-1 desktop should keep event primaries plus one ambient per cone satellite');
  assert.equal(
    eventPlusDesktop.ambientRings.length,
    eventPlusDesktop.displaySats.length - eventPlusDesktop.satBeams.size,
    'event-plus-1 desktop should emit one ambient ring per visible satellite outside beamSatIds',
  );

  const eventPlusCompact = renderViz(profile, sim, createRuntime('event-plus-1', 1366, 768));
  const eventPlusCompactRepeat = renderViz(profile, sim, createRuntime('event-plus-1', 1366, 768));
  assert.equal(countConeBeams(eventPlusCompact), 4, 'event-plus-1 compact should enforce the 4-callout cap');
  assert.equal(eventPlusCompact.ambientRings.length, 5, 'event-plus-1 compact should downgrade two excess cone beams to rings');
  assert.deepEqual(
    beamFingerprint(eventPlusCompactRepeat),
    beamFingerprint(eventPlusCompact),
    'event-plus-1 compact capping must be deterministic',
  );

  const all = renderViz(profile, sim, createRuntime('all', 1366, 768));
  assert.equal(all.ambientRings.length, 0, 'all density must not emit Phase 1B ambient rings');
  // Re-baselined 2026-06-14: the test config now uses the real app runtime visual
  // settings (effects ON — the former "all"=>tuning=>effects-off path went away with
  // the UI-mode switch). useBeamViz's grouping orders the prepared/secondary sats
  // differently under effects-on; the selected beams + roles are unchanged (S1/S2
  // entries swap position only). leo's own display fixture, not a Rule#4 KPI.
  assert.deepEqual(
    beamFingerprint(all),
    [
      { satId: SAT_IDS[0], beams: [{ beamId: 1, role: 'serving' }, { beamId: 5, role: 'serving' }] },
      { satId: SAT_IDS[2], beams: [{ beamId: 3, role: 'secondary' }, { beamId: 7, role: 'secondary' }] },
      { satId: SAT_IDS[1], beams: [{ beamId: 2, role: 'prepared' }, { beamId: 6, role: 'prepared' }] },
    ],
    'all density changed the pre-Phase-1B cone-beam selection fingerprint',
  );
}

function assertReducedMotionSubscription(): void {
  const listeners: Array<(event: { matches: boolean }) => void> = [];
  const observed: boolean[] = [];
  const fakeMediaQuery = {
    matches: false,
    addEventListener: (type: 'change', listener: (event: { matches: boolean }) => void) => {
      assert.equal(type, 'change');
      listeners.push(listener);
    },
    removeEventListener: (type: 'change', listener: (event: { matches: boolean }) => void) => {
      assert.equal(type, 'change');
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  const fakeWindow = {
    matchMedia: (query: string) => {
      assert.equal(query, REDUCED_MOTION_QUERY);
      return fakeMediaQuery;
    },
  };

  const unsubscribe = subscribeToReducedMotionPreference(value => observed.push(value), fakeWindow);
  assert.deepEqual(observed, [false], 'reduced-motion subscription should publish initial media state');
  assert.equal(listeners.length, 1, 'reduced-motion subscription did not register a change listener');

  fakeMediaQuery.matches = true;
  listeners[0]({ matches: true });
  assert.equal(observed.at(-1), true, 'mocked reduced-motion change did not publish true');
  assert.deepEqual(
    deriveRuntimeVisualSettings(true).effectsEnabled,
    { spineParticles: false, orbitTrail: false, servingRipple: false, pendingRipple: false },
    'reducedMotion=true must force all effects off',
  );

  fakeMediaQuery.matches = false;
  listeners[0]({ matches: false });
  assert.equal(observed.at(-1), false, 'mocked reduced-motion recovery did not publish false');
  assert.deepEqual(
    deriveRuntimeVisualSettings(false).effectsEnabled,
    { spineParticles: true, orbitTrail: true, servingRipple: true, pendingRipple: true },
    'reducedMotion recovery must re-derive presentation defaults',
  );

  unsubscribe();
  assert.equal(listeners.length, 0, 'reduced-motion unsubscribe did not remove the listener');
}

async function detectAppUrl(): Promise<string> {
  const explicit = process.env.APP_URL ?? process.argv[2];
  const candidates = explicit
    ? [explicit]
    : [
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4173',
      'http://127.0.0.1:4174',
    ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) continue;
      const html = await response.text();
      if (html.includes('<title>LEO Beam Sim</title>') || html.includes('/src/main')) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(`Could not find a running LEO Beam Sim dev server. Tried: ${candidates.join(', ')}`);
}

async function assertBrowserCalloutCap(
  browser: Browser,
  appUrl: string,
  viewport: { width: number; height: number },
  expectedCap: number,
): Promise<number> {
  const page = await bootDeterministicPage({ chromium }, {
    url: appUrl,
    browser,
    seed: 20261 + viewport.width,
    rafMs: 1000,
    viewport,
    waitForSelector: '[data-testid="info-panel-primary-sinr-status"]',
  });

  try {
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="beam-callout"]').length > 0);
    await page.waitForTimeout(500);
    const count = await page.locator('[data-testid="beam-callout"]').count();
    const screenshot = await page.screenshot();
    assert.ok(count <= expectedCap, `${viewport.width}x${viewport.height} rendered ${count} callouts, expected <= ${expectedCap}`);
    assert.ok(screenshot.length > 5000, `${viewport.width}x${viewport.height} screenshot looked blank`);
    return count;
  } finally {
    await page.context().close();
  }
}

async function assertV3BrowserCaps(): Promise<{ appUrl: string; desktopCount: number; compactCount: number }> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();

  try {
    const desktopCount = await assertBrowserCalloutCap(browser, appUrl, { width: 1440, height: 900 }, 6);
    const compactCount = await assertBrowserCalloutCap(browser, appUrl, { width: 1366, height: 768 }, 4);
    return { appUrl, desktopCount, compactCount };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  assertV2DensityFixtures();
  assertReducedMotionSubscription();
  const browserResult = await assertV3BrowserCaps();

  console.log('Visual Clarity Phase 1B presentation-density validation passed.');
  console.log(JSON.stringify({
    v2: {
      densityFixtures: ['event-only', 'event-plus-1 desktop', 'event-plus-1 compact', 'all regression guard'],
      reducedMotionListener: 'passed',
    },
    v3: browserResult,
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
