#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OrbitSourceStage.tsx', import.meta.url), 'utf8');

assert.match(source, /SimulatorOrbitSceneContents/);
assert.match(source, /data-scene-layer="orbit-source"/);
assert.match(source, /TLE record/);
assert.match(source, /SGP4 \/ TEME/);
assert.match(source, /Earth-fixed/);
assert.match(source, /NTPU topocentric/);
assert.match(source, /method\.frame/);
assert.match(source, /method\.run\.analysisRunId/);
assert.doesNotMatch(source, /ScientificExplainPrototype|MainScene|SimulatorRoute|Walker/);

console.log('Orbit source stage contract tests passed');
