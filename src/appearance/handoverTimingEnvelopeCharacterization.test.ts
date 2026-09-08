/**
 * Characterization for the handover timing/envelope decision.
 *
 * Pure by construction: no React, no canvas, no clock. The expected values
 * below are literals read from the running implementation before the timing
 * decision is moved. They intentionally do not call the implementation to
 * build expectations; this test must turn red when the decision changes.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HANDOVER_CONE_PHASE_END,
  resolveHandoverConeEnvelope,
  HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
  HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
  INTER_HANDOVER_CINEMA_DISPLAY_MS,
  INTER_HANDOVER_CINEMA_PHASE_END,
  INTRA_HANDOVER_CINEMA_DISPLAY_MS,
  MANUAL_HANDOVER_DISPLAY_MS,
  resolveInterHandoverCinemaEnvelope,
} from './handoverTimingEnvelope';

const PROBE_PROGRESS = [0, 0.1, 0.1875, 0.28125, 0.375, 0.46875, 0.5625, 0.65625, 0.75, 0.875, 1];

test('handover timing constants remain the current display windows', () => {
  assert.deepEqual(
    {
      homepageIntra: HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
      homepageInter: HOMEPAGE_INTER_HANDOVER_DISPLAY_MS,
      manual: MANUAL_HANDOVER_DISPLAY_MS,
      cinemaIntra: INTRA_HANDOVER_CINEMA_DISPLAY_MS,
      cinemaInter: INTER_HANDOVER_CINEMA_DISPLAY_MS,
    },
    {
      homepageIntra: 16000,
      homepageInter: 12000,
      manual: 8000,
      cinemaIntra: 8000,
      cinemaInter: 6000,
    },
  );
});

test('handover timing constants retain the current phase boundaries', () => {
  assert.deepEqual(HANDOVER_CONE_PHASE_END, {
    serving: 0.1875,
    measuring: 0.375,
    holding: 0.5625,
    releasing: 0.75,
  });
  assert.deepEqual(INTER_HANDOVER_CINEMA_PHASE_END, {
    serving: 0.16666666666666666,
    measuring: 0.42424242424242425,
    holding: 0.5757575757575758,
    releasing: 0.8181818181818182,
  });
});

test('intra envelope stays identical across the phase-boundary grid', () => {
  const expected = [
    { fromOpacity: 0.95, toOpacity: 0, phase: 'serving' },
    { fromOpacity: 0.95, toOpacity: 0, phase: 'serving' },
    { fromOpacity: 0.95, toOpacity: 0, phase: 'measuring' },
    { fromOpacity: 0.95, toOpacity: 0.475, phase: 'measuring' },
    { fromOpacity: 0.95, toOpacity: 0.95, phase: 'holding' },
    { fromOpacity: 0.95, toOpacity: 0.95, phase: 'holding' },
    { fromOpacity: 0.95, toOpacity: 0.95, phase: 'releasing' },
    { fromOpacity: 0.475, toOpacity: 0.95, phase: 'releasing' },
    { fromOpacity: 0, toOpacity: 0.95, phase: 'settled' },
    { fromOpacity: 0, toOpacity: 0.95, phase: 'settled' },
    { fromOpacity: 0, toOpacity: 0.95, phase: 'settled' },
  ];

  assert.deepEqual(
    PROBE_PROGRESS.map(progress => resolveHandoverConeEnvelope(progress, 0.95)),
    expected,
  );
});

test('inter envelope stays identical across the phase-boundary grid', () => {
  const expected = [
    { fromOpacity: 0.95, toOpacity: 0, phase: 'serving' },
    { fromOpacity: 0.95, toOpacity: 0, phase: 'serving' },
    { fromOpacity: 0.95, toOpacity: 0.017639227241502152, phase: 'measuring' },
    { fromOpacity: 0.95, toOpacity: 0.39673409612412225, phase: 'measuring' },
    { fromOpacity: 0.95, toOpacity: 0.8591126221249746, phase: 'measuring' },
    { fromOpacity: 0.95, toOpacity: 0.95, phase: 'holding' },
    { fromOpacity: 0.95, toOpacity: 0.95, phase: 'holding' },
    { fromOpacity: 0.7053513944149019, toOpacity: 0.95, phase: 'releasing' },
    { fromOpacity: 0.18316955566406282, toOpacity: 0.95, phase: 'releasing' },
    { fromOpacity: 0, toOpacity: 0.95, phase: 'settled' },
    { fromOpacity: 0, toOpacity: 0.95, phase: 'settled' },
  ];

  assert.deepEqual(
    PROBE_PROGRESS.map(progress => resolveInterHandoverCinemaEnvelope(progress, 0.95)),
    expected,
  );
});
