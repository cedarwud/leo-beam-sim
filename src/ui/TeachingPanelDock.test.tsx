import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { SinrLiveDisplayDrawer } from './SinrLiveDisplayDrawer';
import { TeachingPanelDock } from './TeachingPanelDock';

const markup = renderToStaticMarkup(
  <TeachingPanelDock
    mode="teaching"
    onModeChange={() => undefined}
    engineeringContent={<div>engineering content</div>}
    linkSnapshot={{
      ueId: 'ue-0',
      servingSatelliteId: 'sat-serving',
      candidateSatelliteId: 'sat-candidate',
      timeSec: 12,
      thetaDeg: 1.5,
      transmitGainLinear: 123,
      sinrDb: 4.5,
      throughputMbps: 8,
      systemPowerW: 40,
      energyEfficiencyBitsPerJoule: 200,
    }}
  />,
);

assert.match(markup, /id="left-sidebar-tab-engineering"/);
assert.match(markup, /id="left-sidebar-tab-teaching"/);
for (const testId of [
  'teaching-panel-dock',
  'teaching-panel-inputs',
  'teaching-panel-causal-chain',
  'teaching-panel-policy',
  'teaching-panel-platform',
]) {
  assert.match(markup, new RegExp(`data-testid="${testId}"`));
}
assert.match(markup, /sat-serving/);
for (const token of ['θ', 'γ', 'R', 'η']) {
  assert.match(markup, new RegExp(token.replace(/[()]/g, '\\$&')));
}
assert.match(markup, /G<sup>T<\/sup>\(θ<sub>u,s,v<\/sub>, θ<sub>3dB<\/sub>\)/);

const restoredHomepageMarkup = renderToStaticMarkup(
  <SinrLiveDisplayDrawer
    parameterSection={<div data-testid="original-engineering-controls">engineering content</div>}
    teachingMode="teaching"
    campusVisible
    onCampusVisibleChange={() => undefined}
    showTeachingAuxiliaryUi={false}
  />,
);
assert.match(restoredHomepageMarkup, /data-testid="original-engineering-controls"/);
assert.match(restoredHomepageMarkup, /data-testid="engineering-panel-dock"/);
assert.doesNotMatch(restoredHomepageMarkup, /data-testid="teaching-surface-control"/);
assert.doesNotMatch(restoredHomepageMarkup, /data-testid="teaching-panel-dock"/);
assert.doesNotMatch(restoredHomepageMarkup, /left-sidebar-tab-teaching/);

console.log('Teaching dock remains reusable while the homepage can restore its engineering-only rail.');
