import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
const walkerSandboxSource = await readFile(new URL('../AppWalkerSandbox.tsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../ui/SignalTuningPanel.tsx', import.meta.url), 'utf8');
const quickControlsSource = await readFile(new URL('../ui/SinrLiveQuickControls.tsx', import.meta.url), 'utf8');

test('Walker handover policy controls are reachable from the visible left rail', () => {
  assert.match(
    appSource,
    /<SignalTuningPanel[\s\S]*?handoverPolicySection=\{\([\s\S]*?<HandoverPolicyControls/,
  );
  assert.match(panelSource, /showHandoverTab=\{handoverPolicySection != null\}/);
  assert.match(panelSource, /mainTab === 'handover'[\s\S]*?\{handoverPolicySection\}/);
  assert.match(panelSource, /data-testid="sinr-formula-page"/);
});

test('homepage starts playing immediately without freezing at comparison', () => {
  assert.match(appSource, /isMultiCandidatePlaybackSlowDecisionFrame\(/);
  assert.match(
    appSource,
    /usePlaybackControls\([\s\S]*?multiCandidateComparisonActive,\s*\/\/ The homepage must start in motion\.[\s\S]*?false,\s*\n\s*\);/,
    'the homepage does not pass its Walker/live-lane condition as startPaused',
  );
  assert.doesNotMatch(
    appSource,
    /usePlaybackControls\([\s\S]*?sceneLane === 'sinr-live' && isWalkerSceneActive,\s*\n\s*\);/,
    'scene source selection must not pause the initial homepage frame',
  );
  assert.doesNotMatch(appSource, /MULTI_CANDIDATE_OPENING_HOLD_MS|multiCandidateOpeningHold|multiCandidateComparisonWasActiveRef/);
});

test('live timeline transport is not blocked by the background event-index build', () => {
  const timelineDisabledBlock = appSource.slice(
    appSource.indexOf('const timelineDisabled ='),
    appSource.indexOf('// Archived-TLE homepage playback advances', appSource.indexOf('const timelineDisabled =')),
  );
  assert.doesNotMatch(
    timelineDisabledBlock,
    /liveWalkerHandoverEventIndexBuilding/,
    'index readiness gates quick-jump controls, not initial live playback',
  );
  assert.match(appSource, /handoverIndexBuilding=\{liveWalkerHandoverEventIndexBuilding\}/);
  assert.match(
    quickControlsSource,
    /showHandoverIndexStatus = false/,
    'the initial control row stays quiet while the index builds in the background',
  );
});

test('Next Intra remains actionable when the current index has no intra row', () => {
  assert.match(
    appSource,
    /const liveIntraFallbackEnabled = sceneSource === 'live-sim' && isWalkerSceneActive;/,
  );
  assert.match(
    appSource,
    /const directorNextIntraEnabled = homepageIndexedStoryRoute[\s\S]*?directorIntraIndexedEnabled \|\| directorIntraQueueable[\s\S]*?: directorIntraIndexedEnabled \|\| liveIntraFallbackEnabled;/,
  );
  assert.match(
    appSource,
    /if \(!requestMovingIntraDemo\('button'\)\) triggerPrimaryIntra\(\);/,
    'the homepage must retain a real same-satellite trigger fallback behind the existing presentation owner',
  );
  assert.match(
    appSource,
    /const directorNextIntraMode:[\s\S]*?liveIntraFallbackEnabled && !directorIntraIndexedEnabled\s*\? 'real-trigger'\s*:\s*'indexed';/,
  );
});

test('topology rebuild releases stale homepage presentation locks before new controls act', () => {
  assert.match(
    appSource,
    /const sceneTopologyResetKey = useMemo\(\s*\(\) => getSceneTopologyResetKey\(activeSceneTopology\)/,
  );
  assert.match(
    appSource,
    /const previousSceneTopologyResetKeyRef = useRef\(sceneTopologyResetKey\)/,
  );
  assert.match(
    appSource,
    /previousKey === sceneTopologyResetKey[\s\S]*?pendingDirectorJumpKindRef\.current = null[\s\S]*?cancelPendingLiveFocus\(\)[\s\S]*?handoverCinema\.exit\(\)[\s\S]*?handoverPresentationBusyRef\.current = false[\s\S]*?handoverControlBusyRef\.current = false[\s\S]*?handoverBusyRef\.current = false/,
    'a topology rebuild must not inherit the old epoch\'s Director/presentation lock',
  );
});

test('homepage queues Next Intra/Inter while the replacement index is building', () => {
  assert.match(
    appSource,
    /const homepageHandoverQueueOpen = isRootHomepage[\s\S]*directorIntraQueueable \|\| directorInterQueueable/,
    'the rebuild queue must be restricted to the homepage and the existing indexed command paths',
  );
  assert.match(
    appSource,
    /handoverBusyRef\.current && !homepageHandoverQueueOpen/,
    'a stale presentation lock must not discard a homepage command that can be queued for the new index',
  );
  assert.match(
    appSource,
    /nextIntraEnabled=\{manualHandoverRequest === null[\s\S]*!handoverCommandBusy\}/,
  );
  assert.match(
    appSource,
    /nextInterEnabled=\{manualHandoverRequest === null[\s\S]*!handoverCommandBusy\}/,
  );
});

test('legacy Walker entry uses the same real Next Intra fallback', () => {
  assert.match(
    walkerSandboxSource,
    /const liveIntraFallbackEnabled = sceneSource === 'live-sim';/,
  );
  assert.match(
    walkerSandboxSource,
    /if \(liveIntraFallbackEnabled\) triggerPrimaryIntra\(\);/,
  );
  assert.doesNotMatch(
    walkerSandboxSource,
    /const handleQuickIntra[\s\S]*?requestMovingIntraDemo\(\)/,
    'the quick button must not fall back to a display-only moving-beam cue',
  );
  assert.match(
    walkerSandboxSource,
    /nextIntraMode=\{directorIntraIndexedEnabled \? 'indexed' : 'real-trigger'\}/,
  );
});
