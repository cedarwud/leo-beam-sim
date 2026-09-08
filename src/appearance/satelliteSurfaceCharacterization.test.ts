/**
 * CHARACTERIZATION TEST — what every SATELLITE SURFACE draws.
 *
 * This is a photograph, not a specification. Every literal below was produced by
 * running the code, never by re-deriving the expected value from the function
 * under test.
 *
 * ## The blind spot this closes
 *
 * The appearance drill board reported 12 converged decisions while THREE render
 * lanes were still bypassing the identity ladder entirely. It did not catch
 * them because the characterization it measures did not cover the orbit trail
 * or the artifact-replay marker: the measurement tool and the thing measured
 * shared a blind spot, so a lane could be as divergent as it liked and every
 * board stayed green.
 *
 * What was measured, before the convergence, for ONE satellite:
 *
 *     sat-a   live marker            #e2c550   <- the identity ladder
 *             orbit trail            #f2d7a0   <- satelliteTint, a 4-colour hash
 *             artifact replay marker #f2d7a0   <- satelliteTint, the same hash
 *
 * Two authorities, one satellite. Changing the identity palette in
 * `constants/servingColour.ts` moved the first and left the other two behind.
 *
 * ## What is pinned here
 *
 *   1. Every surface derives from the SAME identity colour. This is the
 *      property that broke; it is asserted directly, by hue, not implied.
 *   2. The `marker` row draws the identity colour untouched — so the live and
 *      replay markers now agree, which they did not before.
 *   3. The `orbitTrail` row draws a PALED variant. That paleness is intentional
 *      and is preserved from the legacy tint's character, but it is now derived
 *      from the identity rather than looked up in a second palette.
 *   4. The paling never invents a hue and never reaches grey — the invariant
 *      that makes it a modifier rather than a replacement.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { hexToHsl } from '../constants/hsl';
import { colorForServingSatellite } from '../constants/servingColour';
import { SATELLITE_TINT_PALETTE } from '../constants/beamRoleTokens';
import {
  paleSatelliteSurfaceColor,
  resolveSatelliteSurfaceColor,
  SATELLITE_SURFACE_MODIFIERS,
  SATELLITE_TRAIL_LIGHTNESS_CEILING,
  SATELLITE_TRAIL_LIGHTNESS_FLOOR,
} from './satelliteSurfaceModifiers';
import { resolveSatelliteIdentityColor } from './resolveSatelliteAppearance';
import { resolveRenderedLiveSatelliteMarkers } from '../scene/renderedLiveSatelliteMarkers';
import { resolveOrbitTrailPlans } from '../viz/OrbitTrail';

const GRID = ['sat-a', 'sat-serving', 'shell-a-P0-S3', 'shell-pro-53-P0-S0'] as const;

/** Exactly what MainScene now hands the orbit trail layer. */
function orbitTrailColorFor(satelliteId: string): string | undefined {
  return resolveOrbitTrailPlans({
    satellites: [{
      id: satelliteId,
      satelliteTintColor: resolveSatelliteSurfaceColor(satelliteId, 'orbitTrail'),
    } as never],
  })[0]?.color;
}

/** Exactly what MainScene now hands a live satellite marker. */
function liveMarkerColorFor(satelliteId: string): string | undefined {
  return resolveRenderedLiveSatelliteMarkers({
    displaySats: [{
      id: satelliteId,
      world: new THREE.Vector3(0, 0, 0),
      satelliteTintColor: undefined,
    }],
    handoverMarkerSatelliteIds: new Set(),
    identityColorBySatelliteId: new Map(),
    coneApexWorldById: new Map(),
  })[0]?.satelliteTintColor;
}

/** Exactly what MainScene's artifact-replay branch now hands SatelliteMarker. */
function replayMarkerColorFor(satelliteId: string): string {
  return resolveSatelliteSurfaceColor(satelliteId, 'marker');
}

test('the marker row draws the identity colour, so live and replay markers agree', () => {
  // Pinned literals, produced by running the code.
  assert.equal(replayMarkerColorFor('sat-a'), '#e2c550');
  assert.equal(replayMarkerColorFor('sat-serving'), '#abde35');
  assert.equal(replayMarkerColorFor('shell-a-P0-S3'), '#96b9ee');
  assert.equal(replayMarkerColorFor('shell-pro-53-P0-S0'), '#61e596');

  for (const satelliteId of GRID) {
    assert.equal(
      replayMarkerColorFor(satelliteId),
      liveMarkerColorFor(satelliteId),
      `${satelliteId}: the replay marker and the live marker are one surface and must not diverge`,
    );
  }
});

test('the orbit trail row draws a paled variant of the SAME identity colour', () => {
  // Pinned literals, produced by running the code.
  assert.equal(orbitTrailColorFor('sat-a'), '#dace9f');
  assert.equal(orbitTrailColorFor('sat-serving'), '#c4d798');
  assert.equal(orbitTrailColorFor('shell-a-P0-S3'), '#b4c6e2');
  assert.equal(orbitTrailColorFor('shell-pro-53-P0-S0'), '#a4dcbb');
});

test('every satellite surface derives from ONE identity colour', () => {
  for (const satelliteId of GRID) {
    const identity = resolveSatelliteIdentityColor(satelliteId, {});
    assert.equal(
      identity,
      colorForServingSatellite(satelliteId).markerColor,
      `${satelliteId}: the ladder must reach the identity palette, not a second table`,
    );

    const identityHue = hexToHsl(identity)?.hue;
    const markerHue = hexToHsl(replayMarkerColorFor(satelliteId))?.hue;
    const trailHue = hexToHsl(orbitTrailColorFor(satelliteId) ?? '')?.hue;

    assert.ok(identityHue !== undefined && markerHue !== undefined && trailHue !== undefined);
    // Hue is IDENTITY. A surface may make a satellite quieter; it may never make
    // it a different satellite.
    //
    // The marker is EXACT: its row applies no shade at all, so any drift there
    // is a real defect. The trail is checked to a tolerance because the paling
    // round-trips through 8-bit hex channels, and the largest quantisation error
    // measured across the grid is 0.0015 of a turn (~0.55 degrees) — far below
    // the ~14-degree minimum gap between two neighbouring identity families, so
    // the tolerance cannot hide a satellite wearing the wrong hue.
    assert.equal(markerHue, identityHue, `${satelliteId}: marker hue drifted`);
    assert.ok(
      Math.abs(trailHue - identityHue) < 0.004,
      `${satelliteId}: trail hue ${trailHue} left the identity hue ${identityHue}`,
    );
  }
});

test('no satellite surface reads the legacy 4-colour tint palette any more', () => {
  const legacy = new Set<string>(SATELLITE_TINT_PALETTE as readonly string[]);
  for (const satelliteId of GRID) {
    assert.ok(
      !legacy.has(replayMarkerColorFor(satelliteId)),
      `${satelliteId}: the replay marker fell back into the legacy tint palette`,
    );
    assert.ok(
      !legacy.has(orbitTrailColorFor(satelliteId) ?? ''),
      `${satelliteId}: the orbit trail fell back into the legacy tint palette`,
    );
  }
});

test('the paling recedes but never washes out the identity', () => {
  for (const satelliteId of GRID) {
    const identity = resolveSatelliteIdentityColor(satelliteId, {});
    const paled = paleSatelliteSurfaceColor(identity);
    const identityHsl = hexToHsl(identity)!;
    const paledHsl = hexToHsl(paled)!;

    assert.ok(
      paledHsl.lightness >= SATELLITE_TRAIL_LIGHTNESS_FLOOR - 0.02
      && paledHsl.lightness <= SATELLITE_TRAIL_LIGHTNESS_CEILING + 0.02,
      `${satelliteId}: paled lightness ${paledHsl.lightness} left the trail band`,
    );
    assert.ok(
      paledHsl.saturation < identityHsl.saturation,
      `${satelliteId}: paling must desaturate`,
    );
    // Below ~0.20 a colour carries no usable hue; the trail must stay chromatic
    // or it stops naming a satellite at all.
    assert.ok(
      paledHsl.saturation > 0.25,
      `${satelliteId}: paled saturation ${paledHsl.saturation} is too close to grey to carry identity`,
    );
  }
});

test('an unparseable colour is passed through rather than guessed at', () => {
  assert.equal(paleSatelliteSurfaceColor('not-a-colour'), 'not-a-colour');
  // An unusable satellite id has no identity; the ladder answers neutral and the
  // marker row leaves it alone.
  assert.equal(resolveSatelliteSurfaceColor('', 'marker'), '#94a3b8');
});

test('the surface table has one row per surface and only the trail is shaded', () => {
  assert.equal(SATELLITE_SURFACE_MODIFIERS.marker.shade, null);
  assert.equal(SATELLITE_SURFACE_MODIFIERS.orbitTrail.shade, 'pale');
});

test('a published identity outranks the deterministic one on every surface', () => {
  const sources = { acceptedColorFor: () => '#ff00aa' };
  assert.equal(resolveSatelliteSurfaceColor('sat-a', 'marker', sources), '#ff00aa');
  assert.equal(resolveSatelliteSurfaceColor('sat-a', 'orbitTrail', sources), '#e48bc6');
});

/**
 * WIRING, not just the owner.
 *
 * `MainScene.tsx` is the one place both lanes are mounted and it is not
 * unit-testable, so the wiring is pinned by source instead of left unpinned.
 * A seam nobody calls is the same as no seam — the whole reason the previous
 * board could report 12 converged decisions while three lanes bypassed the
 * ladder. (`viz/SatelliteMarker.test.ts` pins its own mount the same way.)
 */
test('MainScene routes both satellite surfaces through the table', () => {
  const source = readFileSync(
    new URL('../scene/MainScene.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source, /satelliteTint\s*\(/,
    'MainScene must not call the legacy 4-colour tint hash for any surface',
  );
  assert.match(
    source, /satelliteTintColor=\{resolveSatelliteSurfaceColor\(satellite\.id, 'marker'\)\}/,
    'the artifact-replay marker must ask the marker row',
  );
  assert.match(
    source, /resolveSatelliteSurfaceColor\(\s*satellite\.id,\s*'orbitTrail',/,
    'the orbit trail layer must ask the orbitTrail row',
  );
  assert.match(
    source, /satellites: orbitTrailSatellites,/,
    'the orbit trail mount must receive the table-resolved satellites',
  );
});
