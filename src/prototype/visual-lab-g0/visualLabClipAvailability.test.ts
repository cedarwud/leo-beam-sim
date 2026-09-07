import assert from 'node:assert/strict';
import test from 'node:test';
import { createVisualLabClipEntries } from '../../visualLab/clipReplay/model';
import { deriveVisualLabClipAvailability } from './visualLabClipAvailability';

const baseInput = {
  locale: 'zh-Hant' as const,
  sourceLabel: 'Starlink · 2026-08-12 20:00',
  causalReplayAvailable: false,
  acceptedRunReady: true,
  hasSnapshot: true,
  phaseReady: true,
  interHandover: { status: 'available' as const, selectedStoryId: 'event-7' },
  intraHandover: { status: 'unavailable' as const },
};

test('clip availability preserves pending causal work and preparation semantics', () => {
  const availability = deriveVisualLabClipAvailability(baseInput);
  const entries = createVisualLabClipEntries(availability);

  assert.equal(entries.find(entry => entry.id === 'inter-handover')?.status, 'pending');
  assert.equal(entries.find(entry => entry.id === 'intra-beam-handover')?.status, 'preparing');
  assert.equal(entries.find(entry => entry.id === 'link-gain-ab')?.status, 'pending');
  assert.equal(entries.find(entry => entry.id === 'intra-beam-handover')?.runtimeId, 'intra-handover');
});

test('clip availability only publishes launchable inter stories when a runtime id exists', () => {
  const availability = deriveVisualLabClipAvailability({
    ...baseInput,
    locale: 'en',
    causalReplayAvailable: true,
    interHandover: { status: 'available', selectedStoryId: null },
    intraHandover: { status: 'available' },
  });
  const entries = createVisualLabClipEntries(availability);

  assert.equal(entries.find(entry => entry.id === 'inter-handover')?.status, 'unavailable');
  assert.equal(entries.find(entry => entry.id === 'intra-beam-handover')?.status, 'available');
  assert.equal(entries.find(entry => entry.id === 'power-cap-ab')?.status, 'available');
  assert.equal(entries.find(entry => entry.id === 'power-cap-ab')?.sourceLabel, baseInput.sourceLabel);
});

test('clip availability stays unavailable before the accepted scene is ready', () => {
  const availability = deriveVisualLabClipAvailability({
    ...baseInput,
    phaseReady: false,
    acceptedRunReady: false,
    hasSnapshot: false,
    interHandover: { status: 'unavailable', selectedStoryId: null },
  });

  assert.equal(availability['intra-beam-handover']?.status, 'unavailable');
  assert.match(availability['intra-beam-handover']?.reason ?? '', /尚未完成/);
  assert.equal(availability['link-gain-ab']?.status, 'pending');
});
