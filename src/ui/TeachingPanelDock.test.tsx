import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
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
for (const token of ['θ', 'Gᵀ(θ)', 'γ', 'R', 'η']) {
  assert.match(markup, new RegExp(token.replace(/[()]/g, '\\$&')));
}

console.log('TeachingPanelDock exposes one engineering/teaching switch and the four teaching sections.');
