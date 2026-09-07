import assert from 'node:assert/strict';
import test from 'node:test';

import type { HandoverPresentationView } from './handoverPresentationOwner';
import type { InterCinemaPairAnchor } from './handoverDisplayIsolation';
import type { SinrLiveCinemaHandoverCandidate } from '../viz/SinrLiveCellBeamCones';
import {
  resolveAuthorityPresentationCandidate,
  resolveCinemaDisplaySatelliteIds,
  resolveCinemaInterSatelliteWorldById,
  resolveCinemaPairCandidate,
  resolveHandoverPresentationDisplayPolicy,
  resolveManualHandoverDisplayMs,
  resolveManualHandoverDisplayState,
  resolveManualHandoverProgress,
  resolveSinrLiveCellTelemetry,
} from './handoverPresentationDisplayPolicy';

const pair: SinrLiveCinemaHandoverCandidate = {
  eventId: 'event-1',
  ueId: 'ue-1',
  kind: 'inter',
  sourceTimeSec: 12,
  fromSatId: 'sat-old',
  fromBeamId: null,
  fromCellId: 2,
  toSatId: 'sat-new',
  toBeamId: null,
  toCellId: 2,
};

function activePresentation(
  source: 'walker' | 'tle' | 'manual' | 'cinema' = 'cinema',
): HandoverPresentationView {
  return {
    active: true,
    event: {
      eventId: pair.eventId,
      source,
      kind: pair.kind,
      ueId: pair.ueId,
      sourceTimeSec: pair.sourceTimeSec,
      from: {
        satId: pair.fromSatId,
        cellId: pair.fromCellId ?? 0,
        beamId: pair.fromBeamId ?? null,
        drawable: true,
      },
      to: {
        satId: pair.toSatId,
        cellId: pair.toCellId ?? 0,
        beamId: pair.toBeamId ?? null,
        drawable: true,
      },
      durationMs: 6000,
    },
    phase: 'measuring',
    progress01: 0.3,
    autoSlowActive: true,
    sourceRole: 'serving',
    targetRole: 'candidate',
  };
}

test('manual display state maps the clock while preserving the event gate', () => {
  assert.deepEqual(resolveManualHandoverProgress({
    startedAtMs: 1000,
    nowMs: 4000,
    displayMs: 8000,
  }), {
    ageMs: 3000,
    progressSec: 3,
    progressRatio: 0.375,
  });
  const active = resolveManualHandoverDisplayState({
    startedAtMs: 1000,
    nowMs: 4000,
    displayMs: 8000,
    requestId: 4,
    kind: 'intra',
    eventPresent: true,
  });
  assert.equal(active.ageMs, 3000);
  assert.equal(active.progressSec, 3);
  assert.equal(active.progressRatio, 0.375);
  assert.equal(active.requested, true);
  assert.equal(active.active, true);

  const unresolved = resolveManualHandoverDisplayState({
    startedAtMs: 1000,
    nowMs: 4000,
    displayMs: 8000,
    requestId: 4,
    kind: 'intra',
    eventPresent: false,
  });
  assert.equal(unresolved.requested, true);
  assert.equal(unresolved.active, false);
  assert.equal(resolveManualHandoverDisplayMs({
    homepageVisualIdentity: true,
    kind: 'inter',
    homepageIntraMs: 8000,
    homepageInterMs: 6000,
    defaultMs: 5000,
  }), 6000);
});

test('presentation policy derives one owner, pair identity, and field isolation', () => {
  const result = resolveHandoverPresentationDisplayPolicy({
    presentation: activePresentation(),
    presentationMode: 'presenting',
    manualHandoverActive: false,
    manualHandoverRequested: false,
    handoverCinemaArmed: true,
    handoverCinemaReady: true,
    handoverCinemaKind: 'inter',
    recentAnyInterHandoverEventPresent: false,
    simSource: 'live',
    multiCandidateCentralOverlayActive: false,
    primaryServingRecord: {
      servingSatId: 'sat-old',
      pendingTargetSatId: 'sat-new',
    },
    preserveConfiguredServingFan: true,
    teachingLectureActive: false,
    peakOpacity: 0.8,
    fallbackSimTimeSec: 99,
    homepageVisualIdentity: true,
    multiCandidateIdentityTransitionActive: false,
  });

  assert.equal(result.source, 'cinema');
  assert.equal(result.presentedCinemaHandoverActive, true);
  assert.equal(result.presentedInterHandoverActive, true);
  assert.equal(result.concurrentIntraVisualSuppressed, true);
  assert.equal(result.naturalInterCandidatePending, true);
  assert.equal(result.handoverDisplayIsolation.hideNormalBeamField, true);
  assert.equal(result.handoverDisplayIsolation.preserveConfiguredServingFan, true);
  assert.deepEqual(result.presentedHandoverPairCandidate, pair);
  assert.equal(result.homepageEeProgressVisible, true);
});

test('cinema pair anchoring and display identities stay presentation-only', () => {
  const anchor: InterCinemaPairAnchor = {
    eventId: pair.eventId,
    fromSatId: 'latched-old',
    fromCellId: 4,
    toSatId: 'latched-new',
    toCellId: 4,
    fromApexWorld: { x: 1, y: 2, z: 3 },
    toApexWorld: { x: 4, y: 5, z: 6 },
  };
  const latchedPair = resolveCinemaPairCandidate({ candidate: pair, anchor });
  assert.equal(latchedPair?.fromSatId, 'latched-old');
  assert.equal(latchedPair?.toSatId, 'latched-new');

  const worlds = resolveCinemaInterSatelliteWorldById({
    current: new Map([['sat-old', { x: 0, y: 0, z: 0 }]]),
    anchor,
  });
  assert.deepEqual(worlds.get('latched-old'), { x: 1, y: 2, z: 3 });
  assert.deepEqual(worlds.get('latched-new'), { x: 4, y: 5, z: 6 });

  const ids = resolveCinemaDisplaySatelliteIds({
    presentedInterHandoverActive: true,
    presentedHandoverPairCandidate: latchedPair,
    targetRole: 'candidate',
    servingSatelliteId: 'ambient-serving',
    renderedCandidateSatelliteId: 'ambient-candidate',
  });
  assert.equal(ids.servingSatelliteId, 'latched-old');
  assert.equal(ids.candidateSatelliteId, 'latched-new');
});

test('telemetry and authority projection preserve explicit display boundaries', () => {
  const telemetry = resolveSinrLiveCellTelemetry({
    showSinrLiveCellBeams: true,
    servedCellCount: 7,
    ues: [
      { servingSatId: 'sat-a', offAxisDeg: 2 },
      { servingSatId: null, offAxisDeg: 80 },
      { servingSatId: 'sat-b', offAxisDeg: 4.5 },
    ],
  });
  assert.deepEqual(telemetry, { servedCellCount: 7, ueOffAxisMaxDeg: 4.5 });
  assert.deepEqual(resolveSinrLiveCellTelemetry({
    showSinrLiveCellBeams: false,
    servedCellCount: 7,
    ues: [{ servingSatId: 'sat-a', offAxisDeg: 4 }],
  }), { servedCellCount: 0, ueOffAxisMaxDeg: 0 });

  const transition = {
    eventId: 'authority-event',
    episodeId: 'episode-1',
    sourceFrameId: 'frame-1',
    simTimeMs: 1000,
    kind: 'inter' as const,
    boundary: 'committed' as const,
    from: { satelliteId: 'sat-old', beamId: 5 },
    to: { satelliteId: 'sat-new', beamId: 12 },
  };
  const authorityEvent = resolveAuthorityPresentationCandidate({
    enabled: true,
    homepageVisualIdentity: false,
    authorityJoin: {
      phase: 'switching',
      serving: transition.to,
      transition,
      solidDataLinkKey: transition.to,
      solidDataLinkCount: 1,
      showTransitionCue: true,
    },
    simSource: 'live',
    hasCellPlacement: () => true,
    hasSatelliteWorld: () => true,
    durationMs: { intra: 8000, inter: 6000 },
  });
  assert.equal(authorityEvent?.source, 'walker');
  assert.equal(authorityEvent?.kind, 'inter');
  assert.equal(authorityEvent?.eventId, 'authority-event');

  const selectedBoundary = resolveAuthorityPresentationCandidate({
    enabled: true,
    homepageVisualIdentity: true,
    authorityJoin: {
      phase: 'switching',
      serving: transition.from,
      transition: { ...transition, boundary: 'selected' },
      solidDataLinkKey: transition.from,
      solidDataLinkCount: 1,
      showTransitionCue: true,
    },
    simSource: 'live',
    hasCellPlacement: () => true,
    hasSatelliteWorld: () => true,
    durationMs: { intra: 8000, inter: 6000 },
  });
  assert.equal(selectedBoundary, null);
});
