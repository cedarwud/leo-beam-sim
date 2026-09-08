/**
 * CHARACTERIZATION TEST — what the ground effect and marker sinks produce after convergence.
 *
 * This test pins the converged appearance of IntraGroundShockwave, ServingGroundRipple,
 * and renderedLiveSatelliteMarkers through the single appearance ladder (resolveBaseIdentityColor
 * and resolveSatelliteIdentityColor).
 *
 * In particular:
 * - Hit paths continue to honour accepted published snapshot / beam maps.
 * - Satellite-level hit paths honour the satellite accepted colour.
 * - Miss paths (empty maps or undefined maps) NO LONGER fall back to private hardcoded
 *   colours (INTRA_HANDOVER_SOURCE_COLOR / INTRA_HANDOVER_TARGET_COLOR or roleSpec.color),
 *   nor jump prematurely to neutral fallback. Instead, they resolve to the satellite's
 *   deterministic lightness rungs from colorForServingBeam.
 * - Unusable IDs fall back to HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR (#94a3b8).
 *
 * Style follows handoverAppearanceModifiers.test.ts: pure node:test, node:assert/strict,
 * no React, no canvas.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveIntraGroundShockwaveColors } from '../viz/IntraGroundShockwave';
import { resolveGroundRippleTargets } from '../viz/ServingGroundRipple';
import { resolveRenderedLiveSatelliteMarkers } from '../scene/renderedLiveSatelliteMarkers';
import type { BeamTarget } from '../scene/beamTargetTypes';
import type { BeamCodeRole } from '../constants/beamRoleTokens';

const createBeam = (beamId: number, role: string, isServing: boolean): BeamTarget => ({
  beamId,
  role: role as BeamCodeRole,
  isServing,
  isPrimary: isServing,
  showBeam: true,
  isScheduledActive: true,
  groundX: 0,
  groundZ: 0,
  frequencyIndex: 0,
  satelliteTintColor: '#ffffff',
  satelliteGlyph: 'circle',
  satelliteVisualIndex: 0,
});

test('IntraGroundShockwave: converged identity resolution across hits and miss paths', () => {
  // 1. Hit path: published beam map outranks all lower rungs
  const hit = resolveIntraGroundShockwaveColors({
    event: { satId: 'sat-serving', fromBeamId: 1, toBeamId: 2 },
    identityColorBySatelliteId: new Map([['sat-serving', '#111111']]),
    identityColorBySatelliteBeamId: new Map([
      ['sat-serving/1', '#222222'],
      ['sat-serving/2', '#333333'],
    ]),
  });
  assert.deepEqual(hit, { sourceColor: '#222222', targetColor: '#333333' });

  // 2. Satellite-only hit: satellite accepted colour used when beam map misses
  const satHit = resolveIntraGroundShockwaveColors({
    event: { satId: 'sat-serving', fromBeamId: 1, toBeamId: 2 },
    identityColorBySatelliteId: new Map([['sat-serving', '#111111']]),
    identityColorBySatelliteBeamId: new Map(),
  });
  assert.deepEqual(satHit, { sourceColor: '#111111', targetColor: '#111111' });

  // 3. Empty maps miss path:
  // Before convergence: returned '#94a3b8' for both sides
  // After convergence: returns deterministic beam lightness rungs from ladder
  const emptyMapsServing = resolveIntraGroundShockwaveColors({
    event: { satId: 'sat-serving', fromBeamId: 1, toBeamId: 2 },
    identityColorBySatelliteId: new Map(),
    identityColorBySatelliteBeamId: new Map(),
  });
  assert.deepEqual(emptyMapsServing, {
    sourceColor: '#bee561', // sat-serving beam 1 rung
    targetColor: '#cceb84', // sat-serving beam 2 rung
  });

  const emptyMapsBlue = resolveIntraGroundShockwaveColors({
    event: { satId: 'shell-a-P0-S3', fromBeamId: 1, toBeamId: 2 },
    identityColorBySatelliteId: new Map(),
    identityColorBySatelliteBeamId: new Map(),
  });
  assert.deepEqual(emptyMapsBlue, {
    sourceColor: '#9fbfef', // shell-a-P0-S3 beam 1 blue rung
    targetColor: '#b9d0f4', // shell-a-P0-S3 beam 2 blue rung
  });

  // 4. Undefined maps miss path:
  // Before convergence: returned hardcoded INTRA_HANDOVER_SOURCE_COLOR (#facc15) and INTRA_HANDOVER_TARGET_COLOR (#fb923c)
  // After convergence: returns deterministic beam lightness rungs identical to empty maps
  const undefMapsServing = resolveIntraGroundShockwaveColors({
    event: { satId: 'sat-serving', fromBeamId: 1, toBeamId: 2 },
  });
  assert.deepEqual(undefMapsServing, {
    sourceColor: '#bee561',
    targetColor: '#cceb84',
  });

  const undefMapsBlue = resolveIntraGroundShockwaveColors({
    event: { satId: 'shell-a-P0-S3', fromBeamId: 1, toBeamId: 2 },
  });
  assert.deepEqual(undefMapsBlue, {
    sourceColor: '#9fbfef',
    targetColor: '#b9d0f4',
  });

  // 5. Unusable satellite ID falls back to neutral
  const invalidId = resolveIntraGroundShockwaveColors({
    event: { satId: '', fromBeamId: 1, toBeamId: 2 },
  });
  assert.deepEqual(invalidId, {
    sourceColor: '#94a3b8',
    targetColor: '#94a3b8',
  });
});

test('ServingGroundRipple: converged identity resolution across hits and miss paths', () => {
  const satBeams = new Map([
    ['sat-serving', [createBeam(1, 'serving', true), createBeam(2, 'prepared', false)]],
  ]);

  // 1. Hit path: beam map takes precedence
  const hit = resolveGroundRippleTargets({
    satBeams,
    footprintRadius: 10,
    identityColorBySatelliteId: new Map([['sat-serving', '#111111']]),
    identityColorBySatelliteBeamId: new Map([
      ['sat-serving/1', '#222222'],
      ['sat-serving/2', '#333333'],
    ]),
  });
  assert.equal(hit[0]?.color, '#222222');
  assert.equal(hit[1]?.color, '#333333');

  // 2. Satellite-only hit: satellite accepted colour used on beam map miss
  const satHit = resolveGroundRippleTargets({
    satBeams,
    footprintRadius: 10,
    identityColorBySatelliteId: new Map([['sat-serving', '#111111']]),
    identityColorBySatelliteBeamId: new Map(),
  });
  assert.equal(satHit[0]?.color, '#111111');
  assert.equal(satHit[1]?.color, '#111111');

  // 3. Empty maps miss path:
  // Before convergence: returned '#94a3b8' for both
  // After convergence: returns deterministic beam lightness rungs
  const emptyMaps = resolveGroundRippleTargets({
    satBeams,
    footprintRadius: 10,
    identityColorBySatelliteId: new Map(),
    identityColorBySatelliteBeamId: new Map(),
  });
  assert.equal(emptyMaps[0]?.color, '#bee561');
  assert.equal(emptyMaps[1]?.color, '#cceb84');

  // 4. Undefined maps miss path:
  // Before convergence: returned '#facc15' (serving role) and '#38bdf8' (pending role)
  // After convergence: returns deterministic beam lightness rungs
  const undefMaps = resolveGroundRippleTargets({
    satBeams,
    footprintRadius: 10,
  });
  assert.equal(undefMaps[0]?.color, '#bee561');
  assert.equal(undefMaps[1]?.color, '#cceb84');

  // 5. Blue family satellite on undefined maps:
  const blueBeams = new Map([
    ['shell-a-P0-S3', [createBeam(1, 'serving', true), createBeam(2, 'prepared', false)]],
  ]);
  const blueUndef = resolveGroundRippleTargets({
    satBeams: blueBeams,
    footprintRadius: 10,
  });
  assert.equal(blueUndef[0]?.color, '#9fbfef');
  assert.equal(blueUndef[1]?.color, '#b9d0f4');
});

test('renderedLiveSatelliteMarkers: converged fallback routing', () => {
  const displaySats = [{ id: 'sat-serving', world: { x: 0, y: 100, z: 0 } as never }];

  // 1. Published accepted colour in identityColorBySatelliteId wins
  const hit = resolveRenderedLiveSatelliteMarkers({
    displaySats,
    handoverMarkerSatelliteIds: new Set(),
    identityColorBySatelliteId: new Map([['sat-serving', '#accepted']]),
    coneApexWorldById: new Map(),
    resolveFallbackColor: id => `fallback:${id}`,
  });
  assert.equal(hit[0]?.satelliteTintColor, '#accepted');

  // 2. Explicit fallback resolver honoured when provided
  const explicitFallback = resolveRenderedLiveSatelliteMarkers({
    displaySats,
    handoverMarkerSatelliteIds: new Set(),
    identityColorBySatelliteId: new Map(),
    coneApexWorldById: new Map(),
    resolveFallbackColor: id => `fallback:${id}`,
  });
  assert.equal(explicitFallback[0]?.satelliteTintColor, 'fallback:sat-serving');

  // 3. When fallback is omitted, routes through resolveSatelliteIdentityColor
  const ladderFallback = resolveRenderedLiveSatelliteMarkers({
    displaySats,
    handoverMarkerSatelliteIds: new Set(),
    identityColorBySatelliteId: new Map(),
    coneApexWorldById: new Map(),
  });
  assert.equal(ladderFallback[0]?.satelliteTintColor, '#abde35');
});
