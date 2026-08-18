import assert from 'node:assert/strict';

import { VISUAL_LAB_INPUT_KEYS } from '../../visualLab/experiment';
import { focusForVisualLabInput, VISUAL_LAB_INPUT_SCENE_FOCUS } from './visualLabInputFocus';

assert.deepEqual(
  Object.keys(VISUAL_LAB_INPUT_SCENE_FOCUS).sort(),
  [...VISUAL_LAB_INPUT_KEYS].sort(),
  'every canonical editable input has one central-scene focus',
);

for (const key of VISUAL_LAB_INPUT_KEYS) {
  assert.ok(['geometry', 'handover', 'energy'].includes(focusForVisualLabInput(key)));
}

for (const key of ['beamPowerCapW', 'satellitePowerCapW', 'etaMax', 'backoffDb', 'rfcPowerW', 'basebandPerSatelliteW'] as const) {
  assert.equal(focusForVisualLabInput(key), 'energy', `${key} reveals the energy layer`);
}

assert.equal(focusForVisualLabInput('theta3dbRad'), 'geometry');
assert.equal(focusForVisualLabInput('frequencyReuse'), 'handover');

console.log('visual-lab input-to-scene focus map covers all 17 canonical inputs');
