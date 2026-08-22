#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SCENE_TOPOLOGY_OVERRIDES_KEY } from '../../sceneTopology';
import { SCENE_VISUAL_SCALE_OVERRIDES_KEY } from '../../sceneVisualScale';
import {
  SIX_ACTS_TEACHING_HIDDEN_SURFACES,
  SIX_ACTS_TEACHING_VISIBLE_CONTROLS,
  SixActsScopedStore,
  isSixActsTeachingSurfaceHidden,
  readSixActsTeachingModeFromSearch,
  sixActsScopedStorageKey,
  withSixActsTeachingMode,
  type SixActsKeyValueStore,
} from './teachingMode';

function memoryStore(): SixActsKeyValueStore & { readonly entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: key => { entries.delete(key); },
  };
}

test('the teaching flag is read from the URL, and anything else is engineering', () => {
  assert.strictEqual(readSixActsTeachingModeFromSearch('?teaching=1'), 'teaching');
  assert.strictEqual(readSixActsTeachingModeFromSearch('?teaching=true'), 'teaching');
  assert.strictEqual(readSixActsTeachingModeFromSearch(''), 'engineering');
  assert.strictEqual(readSixActsTeachingModeFromSearch('?teaching=0'), 'engineering');
  assert.strictEqual(readSixActsTeachingModeFromSearch('?teaching'), 'engineering');
});

test('the flag round-trips through a URL without disturbing other params', () => {
  const teaching = withSixActsTeachingMode('http://localhost:3000/?sceneSource=live-sim', 'teaching');
  assert.match(teaching, /teaching=1/);
  assert.match(teaching, /sceneSource=live-sim/);

  const back = withSixActsTeachingMode(teaching, 'engineering');
  assert.ok(!back.includes('teaching'));
  assert.match(back, /sceneSource=live-sim/);
});

test('engineering keys are returned untouched so existing setups survive', () => {
  assert.strictEqual(
    sixActsScopedStorageKey(SCENE_TOPOLOGY_OVERRIDES_KEY, 'engineering'),
    SCENE_TOPOLOGY_OVERRIDES_KEY,
  );
});

test('no teaching key can equal an engineering key', () => {
  const baseKeys = [SCENE_TOPOLOGY_OVERRIDES_KEY, SCENE_VISUAL_SCALE_OVERRIDES_KEY];
  const engineering = new Set(baseKeys.map(key => sixActsScopedStorageKey(key, 'engineering')));

  for (const key of baseKeys) {
    const teachingKey = sixActsScopedStorageKey(key, 'teaching');
    assert.ok(!engineering.has(teachingKey));
    assert.ok(teachingKey.startsWith(key));
  }
});

test('double-scoping a key is refused rather than silently nested', () => {
  const once = sixActsScopedStorageKey(SCENE_TOPOLOGY_OVERRIDES_KEY, 'teaching');
  assert.throws(() => sixActsScopedStorageKey(once, 'teaching'), RangeError);
});

test('a classroom write cannot reach the engineering namespace', () => {
  const backing = memoryStore();
  const engineering = new SixActsScopedStore(backing, 'engineering');
  const teaching = new SixActsScopedStore(backing, 'teaching');

  engineering.write(SCENE_TOPOLOGY_OVERRIDES_KEY, 'research-setup');
  teaching.write(SCENE_TOPOLOGY_OVERRIDES_KEY, 'classroom-setup');

  assert.strictEqual(engineering.read(SCENE_TOPOLOGY_OVERRIDES_KEY), 'research-setup');
  assert.strictEqual(teaching.read(SCENE_TOPOLOGY_OVERRIDES_KEY), 'classroom-setup');
  assert.strictEqual(backing.entries.size, 2);
});

test('clearing one mode leaves the other intact', () => {
  const backing = memoryStore();
  const engineering = new SixActsScopedStore(backing, 'engineering');
  const teaching = new SixActsScopedStore(backing, 'teaching');
  engineering.write(SCENE_TOPOLOGY_OVERRIDES_KEY, 'research-setup');
  teaching.write(SCENE_TOPOLOGY_OVERRIDES_KEY, 'classroom-setup');

  teaching.clear(SCENE_TOPOLOGY_OVERRIDES_KEY);

  assert.strictEqual(teaching.read(SCENE_TOPOLOGY_OVERRIDES_KEY), null);
  assert.strictEqual(engineering.read(SCENE_TOPOLOGY_OVERRIDES_KEY), 'research-setup');
});

test('a store that throws leaves the session usable', () => {
  const hostile: SixActsKeyValueStore = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  const store = new SixActsScopedStore(hostile, 'teaching');

  assert.doesNotThrow(() => store.write(SCENE_TOPOLOGY_OVERRIDES_KEY, 'x'));
  assert.strictEqual(store.read(SCENE_TOPOLOGY_OVERRIDES_KEY), null);
  assert.doesNotThrow(() => store.clear(SCENE_TOPOLOGY_OVERRIDES_KEY));
});

test('the classroom hides engineering surfaces only in teaching mode', () => {
  assert.strictEqual(isSixActsTeachingSurfaceHidden('signal-tuning-tabs', 'teaching'), true);
  assert.strictEqual(isSixActsTeachingSurfaceHidden('signal-tuning-tabs', 'engineering'), false);
  assert.strictEqual(isSixActsTeachingSurfaceHidden('timeline-transport', 'teaching'), false);
});

test('the ping-pong knobs stay visible: the guard is the lesson', () => {
  const visible = SIX_ACTS_TEACHING_VISIBLE_CONTROLS.map(control => control.id);
  assert.ok(visible.includes('handover-offset-db'));
  assert.ok(visible.includes('handover-ping-pong-guard'));
  for (const id of visible) {
    assert.ok(!SIX_ACTS_TEACHING_HIDDEN_SURFACES.includes(id));
  }
  for (const control of SIX_ACTS_TEACHING_VISIBLE_CONTROLS) {
    assert.ok(control.whyZhHant.length > 0);
  }
});
