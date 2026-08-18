import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { substrateOpacityForDensity } from './visualLabScenePresentation';

for (const density of ['clean', 'context', 'full'] as const) {
  assert.equal(
    substrateOpacityForDensity(density),
    1,
    `NTPU substrate must remain opaque in ${density} density`,
  );
}

const sceneSource = readFileSync('src/prototype/visual-lab-g0/VisualLabScene.tsx', 'utf8');
const routeSource = readFileSync('src/prototype/visual-lab-g0/UnifiedVisualLabPrototype.tsx', 'utf8');
const copySource = readFileSync('src/prototype/visual-lab-g0/presentation/visualLabCopy.ts', 'utf8');
const routeStyles = readFileSync('src/prototype/visual-lab-g0/UnifiedVisualLabPrototype.scss', 'utf8');
assert.doesNotMatch(sceneSource, /vlab-local-provenance|NTPU · 7 CELLS/, 'service provenance stays in the outer shell instead of overlapping the 3D scene');
assert.match(sceneSource, /label=\{false\}/, 'cell labels stay off so the beams remain legible');
assert.match(sceneSource, /angleRad=\{plan\.render\.beam\.offAxisAngleRad\}/, 'off-axis guide consumes the accepted local render DTO');
assert.match(sceneSource, /data-local-off-axis-angle-rad/, 'browser evidence exposes the accepted angle without recomputation');
assert.match(sceneSource, /data-local-system-power-w=\{props\.localScene\?\.render\.energy\.systemPowerW/, 'the scene root keeps canonical system power available to the result dock');
assert.match(sceneSource, /data-local-total-rate-bps=\{props\.localScene\?\.render\.energy\.totalRateBps/, 'the scene root keeps canonical throughput available to the result dock');
assert.match(sceneSource, /data-local-instantaneous-ee-bits-per-j=\{props\.localScene\?\.render\.energy\.instantaneousEeBitsPerJ/, 'the scene root keeps canonical EE available to the result dock');
assert.doesNotMatch(sceneSource, /EnergyOverlay|function Flow\(|<Flow\b/, 'duplicate in-scene energy overlays stay removed');
assert.match(sceneSource, /data-local-instantaneous-ee-bits-per-j/, 'browser evidence exposes the canonical scene-coupled EE value');
assert.match(sceneSource, /name="visual-lab-multi-ue"/, 'multi-UE mode has a dedicated visible point layer');
assert.match(sceneSource, /depthTest=\{false\}/, 'multi-UE points stay readable above the NTPU mesh');
assert.match(routeSource, /positionForVisualLabUeOffAxisAngle/, 'off-axis control changes the draft UE geometry rather than a derived theta value');
assert.doesNotMatch(routeSource, /vlab-ue-probe|代表 UE 位置/, 'the former central representative-UE overlay is removed');
assert.match(sceneSource, /plan\.candidateBeamLayout\.targets/, 'candidate layout preview consumes the accepted per-satellite candidate scenario');
assert.match(sceneSource, /data-local-candidate-beam-layout-count/, 'browser evidence exposes the candidate layout independently from the serving layout');
assert.match(sceneSource, /reuseGroup=\{plan\.render\.reuse\.groupByCell\[cellOrder\]\}/, 'frequency reuse groups are projected onto the accepted cell order');
assert.match(sceneSource, /showReuse=\{density !== 'clean' && focus === 'handover' && plan\.render\.reuse\.groups > 1\}/, 'the full/context modes reveal reuse groups without recoloring service/candidate beams');
assert.match(sceneSource, /data-local-beam-width-draft-scale/, 'beam-width edits expose a display draft while the accepted frame rebuilds');
assert.doesNotMatch(sceneSource, /cell\.index === activeBeamTarget\.beamId/, 'beam IDs are never compared directly with substrate cell indices');
assert.match(sceneSource, /new THREE\.Vector3\(0, 7\.35, 11\.65\)/, 'the default NTPU camera keeps the scene close enough to read');
assert.match(sceneSource, /view === 'sky' \? 4\.8 : 2\.55/, 'the NTPU camera target places the satellites above the scene center');
assert.doesNotMatch(routeSource, /<VisualLab(?:Story|CausalReplay)StageCue/, 'the route has no unreachable duplicate replay cue layer');
assert.doesNotMatch(
  routeSource,
  /setElapsedSec\(\(current\) => \{[\s\S]{0,260}session\.dispatch/,
  'timeline publication never mutates the external session from inside a React state updater',
);
assert.match(
  sceneSource,
  /targets\.find\(target => target\.beamId === storyCurrentBeamId\)/,
  'a source-backed intra story highlights its realized beam identity rather than the UE fixed cell',
);
assert.match(
  sceneSource,
  /data-story-current-beam-id/,
  'browser evidence exposes the realized story beam at each accepted beat',
);
assert.match(
  routeSource,
  /currentBeamId: storyState\.activeStep\.phase === 'before'[\s\S]*?storyBeamTrace\.from\.beamId[\s\S]*?storyBeamTrace\.to\.beamId/,
  'before uses the accepted source beam while decision and after use the accepted destination beam',
);
assert.match(routeSource, /const globalSceneComplete = lab\.phase === 'ready' \|\| timeline !== null/, 'the cache-first frame remains separate from the complete run readiness gate');
assert.match(routeSource, /globalSceneComplete \? globalSceneFrame : null/, 'the globe never presents a partial first-frame satellite set as the complete constellation');
assert.match(sceneSource, /onAssetStatusChange\?\.\(assetKey, 'ready'\)/, 'the renderer publishes satellite GLB readiness');
assert.match(sceneSource, /onAssetStatusChange\?\.\('ntpu-substrate', 'ready'\)/, 'the renderer publishes NTPU GLB readiness');
assert.match(routeSource, /requiredSceneAssetsReady/, 'the route owns one explicit figure-asset readiness gate');
assert.match(routeSource, /lab\.capture\.locked[\s\S]*?\|\| !requiredSceneAssetsReady/, 'the figure action stays disabled while required GLBs are loading or failed');
assert.match(routeSource, /圖稿不會使用替代模型/, 'asset failure explains why fallback geometry cannot be exported as evidence');
assert.match(routeSource, /setSelectedClipId\(target\.clipId\)/, 'a directly launched replay keeps its own clip identity for capture and download');
assert.match(routeSource, /downloadVisualLabClipArchive/, 'an active source-backed replay exposes a real WebM plus provenance download');
assert.match(routeSource, /<VisualLabGuidedReplayAnnotationOverlay/, 'annotated guided replay is mounted over the accepted scene');
assert.match(routeSource, /setClipShelfOpen\(false\);[\s\S]{0,120}guidedReplay\.openStory/, 'guided replay leaves the launcher before its real A\/B preparation completes');
assert.match(routeSource, /busy=\{guidedReplay\.busy\}/, 'the mounted replay rail reports its preparation state');
assert.match(
  routeSource,
  /if \(!playing \|\| replayFocusActive \|\| demoReplayActive\) return undefined;/,
  'the generic TLE timeline yields to guided, causal, or compact handover playback',
);
assert.match(
  routeSource,
  /advanceVisualLabPlayback\(/,
  'the generic timeline uses the pure playback clock',
);
assert.match(
  routeSource,
  /committedVisualSwitchWindow/,
  'automatic slow motion is scoped to the committed visual switch window',
);
assert.match(
  routeSource,
  /guidedReplayActive: replayFocusActive/,
  'the generic clock explicitly yields to guided replay ownership',
);
assert.match(
  routeSource,
  /playbackRate=\{playbackRate\}/,
  'the timeline UI continues to display the requested playback rate',
);
assert.doesNotMatch(
  routeSource,
  /elapsedSecRef\.current \+ 2 \* playbackRate/,
  'the former mislabeled 8x timeline clock is removed',
);
assert.match(
  sceneSource,
  /plan\.activeBeamTargets\.targets\.map/,
  'the visible serving fan follows the accepted active-beam mask',
);
assert.doesNotMatch(
  sceneSource,
  /candidateTargets\.map/,
  'candidate beams are not a permanent always-on fan',
);
assert.match(
  routeSource,
  /openModule\(target\.clipId === 'inter-handover' \? 'sinr' : 'power', false\);[\s\S]{0,100}setView\('service', false\);/,
  'guided launch changes the presentation view without restarting the generic timeline',
);
const causalReplaySource = readFileSync('src/prototype/visual-lab-g0/useVisualLabCausalReplay.ts', 'utf8');
assert.match(
  causalReplaySource,
  /const next = \{ \.\.\.stateRef\.current, \.\.\.patch \};[\s\S]{0,80}stateRef\.current = next;[\s\S]{0,80}setState\(next\);/,
  'causal replay command patches synchronously update the state ref before React rendering',
);
assert.match(
  causalReplaySource,
  /const openedState: VisualLabCausalReplayState[\s\S]{0,260}stateRef\.current = openedState;[\s\S]{0,80}setState\(openedState\);/,
  'a guided open-to-next chain publishes the causal baseline readiness to its ref synchronously',
);
assert.match(
  routeStyles,
  /\.vlab-app--progressive\.is-replay-focus \.vlab-left-control-stack,[\s\S]{0,180}display: none;/,
  'replay focus removes the whole control stack so its rail remains inside the viewport',
);
assert.match(routeSource, /anchors=\{GUIDED_REPLAY_ANNOTATION_ANCHORS\}/, 'the route owns one normalized replay anchor map');
assert.doesNotMatch(routeSource, /figureCapture\.figureMode/, 'the shell must not expose an unexplained figure-mode control');
assert.doesNotMatch(copySource, /論文圖模式|Figure mode/, 'figure-mode jargon must not be visible copy');
assert.match(
  routeStyles,
  /\.vlab-app--progressive \.vlab-module-button\.is-active[\s\S]*?color: var\(--vlab-ink\);/,
  'the selected progressive module keeps a readable foreground on the translucent dark surface',
);

console.log('visual-lab substrate opacity contract passed');
