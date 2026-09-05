import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG,
  GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG,
  GOLDEN_FLOW_BEATS,
  GOLDEN_FLOW_SEGMENTS,
  GOLDEN_FLOW_DETERMINISTIC_TEACHING_OFFSET_DEG,
  GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG,
  goldenFlowSceneConstellationFromSearch,
} from './goldenFlowDirector';

const prototypeSource = readFileSync(new URL('./GoldenFlowPrototype.tsx', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('./GoldenFlowScene.tsx', import.meta.url), 'utf8');
const styleSource = readFileSync(new URL('./GoldenFlowPrototype.scss', import.meta.url), 'utf8');

const interaction = GOLDEN_FLOW_BEATS.find(beat => beat.id === 'interaction');
const consequence = GOLDEN_FLOW_BEATS.find(beat => beat.id === 'consequence');
const act3Beats = GOLDEN_FLOW_BEATS.slice(0, 5);
assert.ok(interaction);
assert.ok(consequence);
assert.deepEqual(
  act3Beats.map(beat => beat.camera),
  ['side-angle', 'side-angle', 'side-angle', 'side-angle', 'side-angle'],
  'Act 3 must keep one stable side camera so perspective does not impersonate a geometry change',
);
assert.ok(GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG > 10, 'Act 3 lesson elevation must not borrow the 10° contact threshold');
assert.equal(GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG, 55, 'Act 3 elevation must be visibly clear without lifting the satellite out of frame');
assert.equal(GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG, 0, 'Act 3 must begin with the service beam centred on the UE');
assert.equal(GOLDEN_FLOW_UE_TRAVEL_RANGE_DEG, 4, 'Act 3 UE travel must expose the wider pre-null main-lobe range');
assert.equal(GOLDEN_FLOW_DETERMINISTIC_TEACHING_OFFSET_DEG, 2, 'authored consequence must reach the visible canonical power/EE change');
assert.equal(GOLDEN_FLOW_SEGMENTS.act4.nextHref, null, 'hidden Acts 5/6 must not remain linked from the Act 4 finale');
assert.equal(GOLDEN_FLOW_SEGMENTS.act4.nextLabelZhHant, null);
assert.equal(goldenFlowSceneConstellationFromSearch(''), 'starlink');
assert.equal(goldenFlowSceneConstellationFromSearch('?constellation=oneweb'), 'oneweb');

assert.equal(interaction.eyebrow, '03 · 拖動 UE，觀察理想補償功率需求與相對 EE');
assert.equal(interaction.learningQuestion, 'UE 離開波束中心後，理想補償功率需求與相對 EE 如何改變？');
assert.equal(
  interaction.guidance.predictionPrompt,
  'UE 離開波束中心後，理想補償功率需求與相對 EE 會如何改變？',
);
assert.deepEqual(interaction.caption, [
  '固定衛星、波束中心與仰角。',
  '向右拖曳 UE，觀察離軸角、增益、理想補償功率需求與相對 EE。',
]);
assert.deepEqual(consequence.caption, [
  '離軸角增加，增益下降。',
  '理想補償功率需求上升，相對 EE 下降。',
]);

const visibleCopySources = [
  GOLDEN_FLOW_BEATS.flatMap(beat => [beat.eyebrow, ...beat.caption, beat.learningQuestion, beat.guidance.predictionPrompt ?? '']).join('\n'),
  prototypeSource,
  sceneSource,
].join('\n');

for (const bannedPhrase of ['受控比較', '波束準星', '仰角會變嗎', '幾何仰角是否改變', '先看後果', '兩個角，不同頂點']) {
  assert.equal(visibleCopySources.includes(bannedPhrase), false, `public copy still contains: ${bannedPhrase}`);
}

assert.match(prototypeSource, /data-testid="golden-flow-angle-elevation"/);
assert.match(prototypeSource, /data-testid="golden-flow-angle-teaching-rail"/);
assert.match(prototypeSource, /data-primary-angle-carrier="true"/);
assert.doesNotMatch(sceneSource, /className="golden-flow-angle-label/);
assert.match(sceneSource, /const targetInStory = beatIndex >= 5;/);
assert.match(sceneSource, /GOLDEN_FLOW_ANGLE_LESSON_ELEVATION_DEG/);
assert.match(sceneSource, /const heroConstellation: SimulatorConstellation = sceneConstellation/);
assert.match(prototypeSource, /data-layout-carrier="legacy-3d-event-dock"/);
assert.match(prototypeSource, /data-event-reveal="current-only"/);
assert.match(prototypeSource, /不進入 Offset\+TTT qualification/);
assert.match(prototypeSource, /forced-continuity/);
assert.match(prototypeSource, /loadGoldenFlowTruth\(sceneConstellation\)/);
assert.match(sceneSource, /\{targetInStory && \([\s\S]*?<Satellite[\s\S]*?role="candidate"/);
assert.match(prototypeSource, /data-motion-contract="single-clock-all-visible-satellites"/);
assert.match(prototypeSource, /data-satellite-trajectory="single-direction-local-flyby-schematic"/);
assert.match(prototypeSource, /data-motion-clock="segment-local-transport-time-sec"/);
assert.match(prototypeSource, /motionTimeSec=\{sceneMotionTimeSec\}/);
assert.match(prototypeSource, /data-motion-freeze-reason=\{motionFreezeReason\}/);
assert.match(prototypeSource, /data-serving-satellite-motion=\{satelliteMotionState\}/);
assert.match(prototypeSource, /data-candidate-satellite-motion=\{beatIndex >= 5 \? satelliteMotionState : 'not-present'\}/);
assert.match(sceneSource, /motionTimeSec=\{motionTimeSec\}/);
assert.match(sceneSource, /goldenFlowMotionState\(isPlaying, authoredMotionHold\)/);
assert.match(sceneSource, /centered \* 1\.65/);
assert.doesNotMatch(sceneSource, /Math\.sin\(phase\)|Math\.cos\(phase\)/);
assert.doesNotMatch(prototypeSource, /className="golden-flow-legacy-header"/);
assert.doesNotMatch(prototypeSource, /className="golden-flow-legacy-stepper"/);
assert.doesNotMatch(prototypeSource, /className="golden-flow-legacy-panel golden-flow-legacy-inputs"/);
assert.match(prototypeSource, /className="golden-flow-event-dock"/);
assert.doesNotMatch(sceneSource, /Math\.max\(actualAngle, THREE\.MathUtils\.degToRad/);
// Satellite identity must not be expressed by repainting the authored GLB
// material during normal playback (see the "Preserve the authored GLB
// material" comment in cloneSatelliteAsset). The one exception is the
// light-capture theme (src/course/nav/lightCapture.ts), a deliberate
// print/export rendering mode that swaps the whole scene to a light
// background and must desaturate the GLB to stay legible there. Assert that
// exception stays singular and stays inside its lightCapture guard, rather
// than banning the pattern outright.
const materialRepaintCalls = [...sceneSource.matchAll(/(?:color|emissive)\.lerp\(/g)];
assert.equal(
  materialRepaintCalls.length,
  1,
  'expected exactly one material colour/emissive lerp (the guarded light-capture satellite repaint)',
);
const repaintGuardWindow = sceneSource.slice(
  Math.max(0, materialRepaintCalls[0].index - 200),
  materialRepaintCalls[0].index,
);
assert.match(
  repaintGuardWindow,
  /if \(lightCapture && next instanceof THREE\.MeshStandardMaterial\) \{/,
  'the sole material colour/emissive lerp must stay guarded by the light-capture branch',
);
assert.match(sceneSource, /buildConstantElevationTerminalPosition/);
assert.match(sceneSource, /GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_RADIUS = 1\.8/);
assert.match(sceneSource, /GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_OPACITY = 0\.08/);
assert.match(sceneSource, /'side-angle': \{ position: \[8\.2, 5\.1, 8\.2\], target: \[-0\.9, 2\.55, 0\] \}/);
assert.match(sceneSource, /anglePose \? 2\.65 : 1\.72/);
assert.match(styleSource, /\.golden-flow-angle-teaching-rail figcaption strong[\s\S]*?1\.16rem/);
assert.match(styleSource, /\.golden-flow-angle-teaching-rail svg \.is-angle-symbol[\s\S]*?20px/);
assert.match(sceneSource, /GOLDEN_FLOW_HANDOVER_BEAM_DISPLAY_RADIUS = 1\.5/);
assert.match(sceneSource, /blending=\{THREE\.NormalBlending\}/);
assert.match(sceneSource, /data-testid="golden-flow-ue-handle"/);
assert.match(sceneSource, /position=\{\[-1\.45, 0\.78, 0\.38\]\}/);
assert.match(sceneSource, /UE 向右拖 →/);
assert.match(sceneSource, /radius: targetInStory[\s\S]*?GOLDEN_FLOW_HANDOVER_BEAM_DISPLAY_RADIUS[\s\S]*?GOLDEN_FLOW_ANGLE_BEAM_DISPLAY_RADIUS/);
assert.match(sceneSource, /Preserve the authored GLB material/);
assert.match(sceneSource, /ANGLE_TERMINAL_POSITION = new THREE\.Vector3\(1, 0, 0\)/);
assert.match(sceneSource, /ANGLE_SOURCE_HORIZONTAL_ANCHOR/);
assert.match(sceneSource, /HANDOVER_SOURCE_POSITION/);
assert.match(sceneSource, /HANDOVER_TARGET_POSITION/);
assert.match(sceneSource, /<cylinderGeometry args=\{\[4\.7, 4\.7, 0\.12, 72\]\} \/>/);
assert.match(sceneSource, /<planeGeometry args=\{\[14, 7\.8\]\} \/>/);
assert.doesNotMatch(sceneSource, /radius: targetInStory \? 0\.52 : 0\.11/);
assert.match(prototypeSource, /data-testid="golden-flow-angle-power-ee"/);
assert.match(prototypeSource, /方向圖 F\(θ\)/);
assert.match(prototypeSource, /增益變化 ΔGᵀ/);
assert.match(prototypeSource, /理想補償功率需求/);
assert.match(prototypeSource, /中心基準 P₀＝\{metrics\.baselinePowerW\.toFixed\(2\)\} W/);
assert.match(prototypeSource, /P′\/P₀＝\{metrics\.powerMultiplier\.toFixed\(2\)\}×/);
assert.match(prototypeSource, /理想補償後鏈路相對值/);
assert.doesNotMatch(prototypeSource, /中心值的/);
assert.match(prototypeSource, /不是衛星實際發射功率/);
assert.match(prototypeSource, /本區數值未套用功率上限/);
assert.match(prototypeSource, /理想補償功率需求；未套用功率上限/);
assert.doesNotMatch(prototypeSource, /提高所需功率|功率需求越高|觀察功率與 EE|所需功率上升/);
assert.match(prototypeSource, /相對 EE/);
assert.match(prototypeSource, /觀察變因/);
assert.match(prototypeSource, /固定條件/);
assert.match(prototypeSource, /data-testid="golden-flow-angle-formula"/);
assert.match(prototypeSource, /Gᵀ\(θ\).*G₀F\(θ\)/);
assert.doesNotMatch(prototypeSource, /data-testid="golden-flow-angle-magnifier"/);
assert.doesNotMatch(prototypeSource, /data-testid="golden-flow-offaxis-focus"/);
assert.match(prototypeSource, /data-testid="golden-flow-angle-teaching-rail"/);
assert.match(prototypeSource, /data-angle-visual-scale=\{OFF_AXIS_INSET_VISUAL_SCALE\}/);
assert.match(prototypeSource, /兩者皆由左往右量測/);
assert.match(prototypeSource, /圖形角距 ×\{OFF_AXIS_INSET_VISUAL_SCALE\}，計算仍用實際 θ/);
assert.match(prototypeSource, /半功率邊界 ±\{halfPowerDeg\.toFixed\(2\)\}°/);
assert.match(sceneSource, /readonly mode: 'elevation' \| 'off-axis'/);
assert.match(sceneSource, /beat === 'angles'[\s\S]*?'elevation' as const[\s\S]*?'off-axis' as const/);
assert.match(prototypeSource, /data-testid="golden-flow-handover-decision"/);
assert.match(prototypeSource, /data-active-service-count="1"/);
assert.match(prototypeSource, /data-dual-connectivity="false"/);
assert.match(prototypeSource, /single-owner-cutover/);
assert.match(prototypeSource, /source-only,candidate-measurement/);
assert.doesNotMatch(prototypeSource, /source-fading,candidate-taking-over/);
assert.match(sceneSource, /候選・未連線/);
assert.match(sceneSource, /function CandidateMeasurementLine/);
assert.match(sceneSource, /<CandidateMeasurementLine[\s\S]*?selected/);
assert.match(prototypeSource, /data-testid="golden-flow-candidate-comparison"/);
assert.match(prototypeSource, /data-testid="golden-flow-handover-transfer-banner"/);
assert.match(prototypeSource, /舊鏈路退出/);
assert.match(prototypeSource, /服務身分切換/);
assert.match(prototypeSource, /新鏈路建立/);
assert.match(sceneSource, /ServiceSwitchPulse/);
assert.doesNotMatch(sceneSource, /CommitArc/);

assert.match(
  styleSource,
  /\.golden-flow-subject-safe\s*\{[^}]*top:\s*22\.5%;[^}]*left:\s*20%;[^}]*width:\s*60%;[^}]*height:\s*55%;/s,
);
assert.doesNotMatch(styleSource, /\.golden-flow-subject-safe\s*\{[^}]*width:\s*16%;/s);
assert.doesNotMatch(styleSource, /\.golden-flow-consequence\s*\{[^}]*top:\s*(?:3[0-9]|4[0-9]|5[0-9]|6[0-9])%;/s);
assert.doesNotMatch(styleSource, /\.golden-flow-restore-marker\s*\{[^}]*top:\s*(?:3[0-9]|4[0-9]|5[0-9]|6[0-9])%;/s);

console.log('Golden flow presentation regression: horizontal Act 3 causal carrier, multi-candidate Act 4, single-owner transfer, opaque GLBs, and central safe area PASS.');
