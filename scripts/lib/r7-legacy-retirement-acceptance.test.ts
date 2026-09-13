import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  validateR7LegacyRetirement,
  type R7LegacyRetirementSources,
} from './r7-legacy-retirement-acceptance';

async function readSources(): Promise<R7LegacyRetirementSources> {
  const base = new URL('../../', import.meta.url);
  const read = (path: string) => readFile(new URL(path, base), 'utf8');
  const [app, main, mainScene, telemetry, frameSet, teachingStage, surfaceRuntime] =
    await Promise.all([
      read('src/App.tsx'),
      read('src/main.tsx'),
      read('src/scene/MainScene.tsx'),
      read('src/scene/SceneHandoverStoryCanvasTelemetry.tsx'),
      read('src/scene/sceneHandoverStoryFrameSet.ts'),
      read('src/app/useAppHandoverTeachingStage.ts'),
      read('src/app/useAppHandoverSurfaceRuntime.ts'),
    ]);
  return { app, main, mainScene, telemetry, frameSet, teachingStage, surfaceRuntime };
}

test('R7 production sources satisfy the independent retirement contract', async () => {
  const sources = await readSources();
  assert.deepEqual(validateR7LegacyRetirement(sources), []);
});

test('the retired renderer, stylesheet, and private browser gate are deleted', async () => {
  const base = new URL('../../', import.meta.url);
  for (const path of [
    'src/prototype/intra-handover-teaching/IntraHandoverTeachingPrototype.tsx',
    'src/prototype/intra-handover-teaching/IntraHandoverTeachingPrototype.scss',
    'scripts/validate-intra-handover-teaching-browser.ts',
  ]) {
    await assert.rejects(access(new URL(path, base)), undefined, path);
  }
});

test('every R7 ownership regression turns the oracle red', async () => {
  const clean = await readSources();
  const mutations: readonly [keyof R7LegacyRetirementSources, string, string][] = [
    ['main', clean.main, `${clean.main}\nIntraHandoverTeachingPrototype`],
    ['app', clean.app, clean.app.replace('useAppHandoverTeachingStage({', 'legacyTeachingStage({')],
    ['app', clean.app, `${clean.app}\nteachingFixtureLatchRef`],
    ['mainScene', clean.mainScene, `${clean.mainScene}\nresolveHandoverSurfaceBindings(frameSet)`],
    [
      'mainScene',
      clean.mainScene,
      clean.mainScene.replace(
        'handoverSurfaceBindingsRef: MutableRefObject<HandoverSurfaceBindingSet>',
        'handoverSurfaceBindingsRef?: MutableRefObject<HandoverSurfaceBindingSet>',
      ),
    ],
    ['telemetry', clean.telemetry, `${clean.telemetry}\nsharedBindingsRef?.current`],
    [
      'frameSet',
      clean.frameSet,
      clean.frameSet.replace(
        'readonly sharedBindings: HandoverSurfaceBindingSet;',
        'readonly sharedBindings: HandoverSurfaceBindingSet | null;',
      ),
    ],
    ['teachingStage', clean.teachingStage, `${clean.teachingStage}\nuseState(0)`],
    ['surfaceRuntime', clean.surfaceRuntime, `${clean.surfaceRuntime}\nrequestAnimationFrame(() => {})`],
  ];
  for (const [field, before, after] of mutations) {
    assert.notEqual(before, after, `${field} mutation was vacuous`);
    const mutated = { ...clean, [field]: after };
    assert.ok(validateR7LegacyRetirement(mutated).length > 0, `${field} stayed green`);
  }
});

test('acceptance oracle imports no production implementation', async () => {
  const source = await readFile(
    new URL('./r7-legacy-retirement-acceptance.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /from ['"]\.\.\/\.\.\/src\//);
});
