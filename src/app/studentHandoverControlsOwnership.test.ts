import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex + end.length);
}

test('student mode mounts only the allow-listed surface and hides unsafe shell controls', async () => {
  const [appSource, panelSource] = await Promise.all([
    readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../ui/homepage/StudentHandoverActivityPanel.tsx', import.meta.url), 'utf8'),
  ]);

  const guardedTopControls = between(appSource, '{!studentModeActive && (<>', '</>)}');
  for (const unsafeComponent of [
    '<SixActsTopEntry',
    '<SimulationSourceToggle',
    '<SinrLiveQuickControls',
  ]) {
    assert.match(guardedTopControls, new RegExp(unsafeComponent.replace('<', '\\<')));
  }
  assert.match(appSource, /!studentModeActive && \(\s*<ShellChromeControls/);
  assert.match(appSource, /shellVisible=\{shellChromeVisibility\.leftSidebar && !studentModeActive\}/);
  assert.match(appSource, /!studentModeActive && \(\s*<ControlBar/);
  assert.match(appSource, /teachingRail=\{studentModeActive \? \(\s*<StudentHandoverActivityPanel/);
  assert.match(appSource, /studentHandoverCheckpoint\(pendingCheckpointId\)/);
  assert.match(appSource, /instructorHandoverTransport\.seek\(checkpoint\.sourceTimeSec\)/);
  assert.doesNotMatch(panelSource, /setPower|setTtt|setOffset|candidateRanking|topologyMutation/);
  assert.doesNotMatch(panelSource, /teaching-seek|teaching-speed|director-inter-focus/);
});
