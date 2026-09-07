import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVisualLabFigureExportModel } from './visualLabFigureExportModel';

const baseInput = {
  locale: 'zh-Hant' as const,
  theme: 'dark' as const,
  view: 'service' as const,
  density: 'clean' as const,
  focus: 'energy' as const,
  title: 'Multi-Beam LEO Energy Visual Lab',
  constellation: 'starlink' as const,
  instantTaipei: '2026-08-12T20:00:00+08:00',
  selectedSatelliteId: 'STARLINK-1',
  candidateSatelliteId: 'STARLINK-2',
  selectedTlePath: 'archives/starlink.txt',
  metrics: {
    sinrDb: 12.345,
    systemPowerW: 4.5678,
    totalThroughputBps: 2_500_000,
    instantaneousEeBitsPerJ: 3_500_000,
  },
  offAxisAngleRad: Math.PI / 18,
};

test('figure export model keeps profile presets and scientific display formatting explicit', () => {
  const model = buildVisualLabFigureExportModel(baseInput);

  assert.equal(model.profileId, 'visual-lab-service-dark-zh-Hant');
  assert.equal(model.figureProfile.cameraPreset, 'ntpu-focus');
  assert.equal(model.figureProfile.layerPreset, 'energy-story');
  assert.match(model.metricText, /SINR 12\.35 dB/);
  assert.match(model.metricText, /總吞吐量 2\.50 Mbit\/s/);
  assert.match(model.footerText, /離軸角 θ 10\.00°/);
  assert.deepEqual(model.sourceLocators, ['archives/starlink.txt']);
});

test('figure export model is deterministic for missing metrics and English copy', () => {
  const model = buildVisualLabFigureExportModel({
    ...baseInput,
    locale: 'en',
    theme: 'light',
    view: 'earth',
    density: 'full',
    focus: 'geometry',
    constellation: 'oneweb',
    selectedSatelliteId: null,
    candidateSatelliteId: null,
    metrics: null,
    offAxisAngleRad: null,
  });

  assert.equal(model.profileId, 'visual-lab-earth-light-en');
  assert.equal(model.figureProfile.cameraPreset, 'global-overview');
  assert.equal(model.figureProfile.layerPreset, 'full');
  assert.equal(model.metricText, '');
  assert.equal(model.footerText, '— → —   ·   archived TLE / SGP4');
  assert.match(model.caption, /^OneWeb archived-TLE\/SGP4/);
});
