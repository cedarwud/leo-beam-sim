#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./AngleResponseDemoStage.tsx', import.meta.url), 'utf8');
const orbitInspectorSource = readFileSync(new URL('./ArtifactOrbitInspector.tsx', import.meta.url), 'utf8');

assert.match(source, /const stories = state\.artifact\.stories/);
assert.match(source, /stories\.serviceTargetStress/);
assert.match(source, /stories\.servingChange/);
assert.match(source, /point\.terms\[term\]/);
assert.match(source, /data-scene-layer="scientific-causal-lab"/);
assert.match(source, /角度、傳輸目標與換手/);
assert.match(source, /最低傳輸速率目標/);
assert.match(source, /eventEvidence/);
assert.match(source, /HandoverCutaway/);
assert.match(source, /功率下降，不代表 EE 必然上升/);
assert.match(source, /場景與結果共用目前 frame/);
assert.match(source, /createScientificExploreAnchor/);
assert.match(source, /exploreAnchor\.build\(/);
assert.match(source, /type="range"/);
assert.match(source, /自由探索/);
assert.match(source, /回到接受基準/);
assert.match(source, /中央空間關係和右側結果同步更新/);
assert.match(source, /CUTAWAY_CELLS/);
assert.match(source, /candidateSatelliteId/);
assert.match(source, /scientific-explore-hpbw/);
assert.match(source, /scientific-explore-rate/);
assert.match(source, /頻率重用因子/);
assert.match(source, /ArtifactOrbitInspector/);
assert.match(source, /查看軌道來源/);
assert.match(source, /UeDragSurface/);
assert.match(source, /onUeOffsetChange/);
assert.match(source, /OrbitControls/);
assert.match(source, /MAX_VISUAL_FOOTPRINT_RADIUS/);
assert.match(source, /視覺波束邊界已壓縮/);
assert.match(source, /angle-demo__scene-status/);
assert.match(source, /線寬不代表功率比例/);
assert.doesNotMatch(source, /49283|49307/);
assert.doesNotMatch(source, /calculateMetrics|DEFAULT_SIMULATOR_PARAMETERS|ScientificExplain3DPrototype|MainScene|Walker/);
assert.doesNotMatch(source, /selectCanonicalTermValue|TleAnalysisRun|buildTleRunBundle/);

assert.match(orbitInspectorSource, /data-scene-layer="artifact-orbit-source"/);
assert.match(orbitInspectorSource, /state\.source/);
assert.match(orbitInspectorSource, /selectedTrajectory/);
assert.match(orbitInspectorSource, /TLE record/);
assert.match(orbitInspectorSource, /SGP4 \/ TEME/);
assert.match(orbitInspectorSource, /Earth-fixed/);
assert.match(orbitInspectorSource, /NTPU topocentric/);
assert.match(orbitInspectorSource, /本地鏈路/);
assert.match(orbitInspectorSource, /OrbitControls/);
assert.doesNotMatch(orbitInspectorSource, /SimulatorOrbitScene|buildTleRunBundle|loadTleSnapshotSelection|Walker/);

console.log('Scientific causal-lab stage contract tests passed');
