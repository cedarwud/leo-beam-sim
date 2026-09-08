/**
 * CHARACTERIZATION TEST — the legacy satelliteTintColor channel's consumers.
 *
 * The channel used to be populated by satelliteTint(), a four-colour hash. The
 * identity marker already used the satellite ladder, so one spacecraft could
 * draw as two unrelated colours across beam encoding, cell borders, particles,
 * links, and markers. These literals were produced by running the converged
 * paths for the representative grid; they are not recomputed expectations.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';

import { resolveBeamVisualEncoding } from '../constants/beamRoleTokens';
import { resolveSatelliteIdentityColor } from './resolveSatelliteAppearance';
import { resolveSatelliteMarkerAccent } from '../viz/SatelliteMarker';
import {
  createCellCoverCandidate,
  resolveHexCellCoverAssignments,
} from '../viz/EarthFixedCells';
import { identityColorForLink, markerColorForBeam } from '../viz/HandoverLinks';
import { resolveRenderedLiveSatelliteMarkers } from '../scene/renderedLiveSatelliteMarkers';
import { resolveSpineParticlePlans } from '../viz/SpineParticles';
import type { BeamTarget } from '../scene/beamTargetTypes';

const REPRESENTATIVE_SATELLITES = [
  ['sat-a', '#e2c550', '#ebd684'],
  ['sat-serving', '#abde35', '#cceb84'],
  ['shell-a-P0-S3', '#96b9ee', '#b9d0f4'],
  ['shell-pro-53-P0-S0', '#61e596', '#84ebad'],
] as const;

test('SatelliteMarker uses explicit tint first and stable identity colour otherwise', () => {
  assert.equal(resolveSatelliteMarkerAccent('#123456', 'sat-a'), '#123456');
  assert.equal(resolveSatelliteMarkerAccent(undefined, 'sat-a'), '#e2c550');
});

function beamFor(satelliteId: string, identityColor: string): BeamTarget {
  return {
    beamId: 2,
    groundX: 0,
    groundZ: 0,
    isServing: true,
    isScheduledActive: true,
    isPrimary: true,
    showBeam: true,
    frequencyIndex: 0,
    satelliteTintColor: identityColor,
    satelliteGlyph: 'circle',
    satelliteVisualIndex: 0,
    visualColorSource: 'satellite',
    loadRatio: 0,
    role: 'serving',
  };
}

test('every satelliteTintColor consumer receives the same identity token', () => {
  for (const [satelliteId, expected, expectedBeamRung] of REPRESENTATIVE_SATELLITES) {
    const identity = resolveSatelliteIdentityColor(satelliteId, {});
    assert.equal(identity, expected, `${satelliteId}: identity ladder photograph`);
    const beam = beamFor(satelliteId, identity);

    // SatelliteBeams' final identity paint.
    const beamEncoding = resolveBeamVisualEncoding({
      role: beam.role,
      isPrimary: beam.isPrimary,
      isServing: beam.isServing,
      isScheduledActive: beam.isScheduledActive,
      frequencyColor: '#frequency',
      identityColor: beam.satelliteTintColor,
      preferIdentityColor: true,
    });
    assert.equal(beamEncoding.color, expected, `${satelliteId}: SatelliteBeams`);

    // EarthFixedCells' footprint border source and the covering assignment that
    // the ring renderer consumes.
    const cover = createCellCoverCandidate({
      satelliteId,
      beam,
      footprintRadius: 10,
      displayOrder: 0,
    });
    assert.equal(cover?.satTintColor, expected, `${satelliteId}: EarthFixedCells candidate`);
    const assigned = resolveHexCellCoverAssignments({
      cells: [{ id: 0, position: { x: 0, z: 0 }, radius: 1, isServed: false, servingBeamId: null }],
      beams: cover === null ? [] : [cover],
      hysteresis: new Map(),
    });
    assert.equal(assigned[0]?.coveringBeam?.satTintColor, expected, `${satelliteId}: footprint border ring`);

    // SpineParticles copies the same channel into every particle plan.
    const particle = resolveSpineParticlePlans({
      satellites: [{ id: satelliteId, world: new THREE.Vector3(0, 100, 0) }],
      satBeams: new Map([[satelliteId, [beam]]]),
      enabled: true,
      paused: false,
      reducedMotion: false,
      particlesPerBeam: 2,
    })[0];
    assert.equal(particle?.color, expected, `${satelliteId}: SpineParticles`);

    // HandoverLinks uses the beam rung when a beam exists and the satellite
    // channel when its beam roster is absent.
    assert.equal(markerColorForBeam(satelliteId, 2), expectedBeamRung, `${satelliteId}: HandoverLinks beam rung`);
    assert.equal(identityColorForLink(satelliteId, undefined, expected), expected, `${satelliteId}: HandoverLinks channel fallback`);

    // SceneSatelliteMarkerLayer receives the rendered marker projection.
    const marker = resolveRenderedLiveSatelliteMarkers({
      displaySats: [{ id: satelliteId, world: new THREE.Vector3(0, 100, 0), satelliteTintColor: expected }],
      handoverMarkerSatelliteIds: new Set(),
      identityColorBySatelliteId: new Map(),
      coneApexWorldById: new Map(),
    })[0];
    assert.equal(marker?.satelliteTintColor, expected, `${satelliteId}: SceneSatelliteMarkerLayer`);
  }
});
