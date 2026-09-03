#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SIX_ACTS_ACT3_HREF,
  SIX_ACTS_ACT4_HREF,
  SIX_ACTS_ACT5_HREF,
  SIX_ACTS_ACT6_HREF,
  SIX_ACTS_INDEX_HREF,
  SIX_ACTS_ROUTES,
  SIX_ACTS_VISIBLE_ROUTES,
  nextSixActsRoute,
  previousSixActsRoute,
  sixActsRouteFor,
} from './sixActsRoutes';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('every listed route is actually registered in the router', () => {
  // A nav entry pointing at an unrouted path is a dead link in a lecture.
  const main = readFileSync(join(REPO_ROOT, 'src/main.tsx'), 'utf8');
  for (const entry of SIX_ACTS_ROUTES) {
    assert.ok(main.includes(`'${entry.href.split('?')[0]}'`), `${entry.href} is not routed in main.tsx`);
  }
  assert.ok(main.includes(`'${SIX_ACTS_INDEX_HREF}'`));
});

test('every released teaching surface carries persistent direct navigation', () => {
  const files = [
    'src/prototype/global-constellation/GlobalConstellationPrototype.tsx',
    'src/course/tle-journey/TleJourneyRoute.tsx',
    'src/prototype/golden-flow/GoldenFlowPrototype.tsx',
    'src/course/contact-window-labs/ContactWindowLabRoute.tsx',
    'src/course/six-acts-index/SixActsIndexRoute.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(join(REPO_ROOT, file), 'utf8');
    assert.ok(source.includes('<SixActsNav'), `${file} has no nav strip`);
  }

  const stageFiles = files.slice(0, 4);
  for (const file of stageFiles) {
    const source = readFileSync(join(REPO_ROOT, file), 'utf8');
    assert.ok(source.includes('variant="stage"'), `${file} has no persistent stage navigation`);
  }
});

test('standalone routes share the router-owned launcher mount', () => {
  // The homepage intentionally suppresses this corner launcher and keeps its
  // visible top-band entry. Other standalone roots still share one mount.
  const main = readFileSync(join(REPO_ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(main.includes('<SixActsLauncher />'), 'main.tsx does not mount the launcher');

  const bootstrap = main.slice(
    main.indexOf('async function bootstrap()'),
    main.indexOf('void bootstrap().catch('),
  );
  const renders = bootstrap.match(/createRoot\(container\)\.render\(/g) ?? [];
  assert.ok(renders.length >= 6, `expected several route renders, found ${renders.length}`);
  assert.strictEqual(
    (bootstrap.match(/<Shell>/g) ?? []).length,
    renders.length,
    'a route renders without the shell that carries the teaching entry',
  );
});

test('the homepage keeps its visible top-band entry and suppresses the corner launcher', () => {
  const app = readFileSync(join(REPO_ROOT, 'src/App.tsx'), 'utf8');
  const main = readFileSync(join(REPO_ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(app.includes('data-testid="six-acts-top-entry"'));
  assert.ok(app.includes(SIX_ACTS_INDEX_HREF));
  assert.ok(main.includes("const isHomepageRoute = window.location.pathname === '/';"));
  assert.ok(main.includes('isHomepageRoute || isSixActsSurface || isSixActsTeachingStage'));
});

test('the six-acts surfaces suppress the launcher, having their own nav', () => {
  const main = readFileSync(join(REPO_ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(main.includes('isSixActsSurface'));
  for (const entry of SIX_ACTS_ROUTES) {
    // Each act's route flag must feed the suppression check, or an act would
    // show both its nav strip and the corner launcher.
    assert.ok(main.includes(`'${entry.href.split('?')[0]}'`));
  }
});

test('the running order chains forwards and backwards', () => {
  const first = SIX_ACTS_VISIBLE_ROUTES[0]!;
  const last = SIX_ACTS_VISIBLE_ROUTES[SIX_ACTS_VISIBLE_ROUTES.length - 1]!;

  assert.strictEqual(previousSixActsRoute(first.href), null);
  assert.strictEqual(nextSixActsRoute(last.href), null);

  let cursor = first;
  let visited = 1;
  while (true) {
    const next = nextSixActsRoute(cursor.href);
    if (next === null) break;
    assert.strictEqual(previousSixActsRoute(next.href)?.href, cursor.href);
    cursor = next;
    visited += 1;
  }
  assert.strictEqual(visited, new Set(SIX_ACTS_VISIBLE_ROUTES.map(entry => entry.href)).size);
});

test('every visible act except the last hands off with a bridge', () => {
  SIX_ACTS_VISIBLE_ROUTES.forEach((entry, index) => {
    const isLast = index === SIX_ACTS_VISIBLE_ROUTES.length - 1;
    assert.strictEqual(entry.bridgeZhHant === null, isLast, `${entry.id} bridge is wrong`);
  });
});

test('Acts 3 and 4 use distinct scene-first Golden Flow segment hrefs', () => {
  const hrefs = SIX_ACTS_ROUTES.map(entry => entry.href);
  assert.strictEqual(new Set(hrefs).size, hrefs.length, 'every act has a distinct stable href');
  assert.strictEqual(SIX_ACTS_ROUTES.find(entry => entry.id === 'act3')?.href, SIX_ACTS_ACT3_HREF);
  assert.strictEqual(SIX_ACTS_ROUTES.find(entry => entry.id === 'act4')?.href, SIX_ACTS_ACT4_HREF);
  assert.notStrictEqual(SIX_ACTS_ACT3_HREF, SIX_ACTS_ACT4_HREF);
  for (const href of hrefs) assert.strictEqual(sixActsRouteFor(href)?.href, href);
  assert.strictEqual(sixActsRouteFor('/nope'), null);
});

test('released sequential navigation stops at Act 4 while hidden routes remain directly addressable', () => {
  assert.strictEqual(nextSixActsRoute(SIX_ACTS_ACT3_HREF)?.href, SIX_ACTS_ACT4_HREF);
  assert.strictEqual(previousSixActsRoute(SIX_ACTS_ACT4_HREF)?.href, SIX_ACTS_ACT3_HREF);
  assert.strictEqual(nextSixActsRoute(SIX_ACTS_ACT4_HREF), null);
  assert.strictEqual(previousSixActsRoute(SIX_ACTS_ACT5_HREF), null);
  assert.strictEqual(nextSixActsRoute(SIX_ACTS_ACT5_HREF), null);
  assert.strictEqual(previousSixActsRoute(SIX_ACTS_ACT6_HREF), null);
  assert.strictEqual(sixActsRouteFor(SIX_ACTS_ACT5_HREF)?.hiddenFromNavigation, true);
  assert.strictEqual(sixActsRouteFor(SIX_ACTS_ACT6_HREF)?.hiddenFromNavigation, true);
});

test('the registry preserves six direct routes but releases only Acts 1–4', () => {
  assert.deepStrictEqual(SIX_ACTS_ROUTES.map(entry => entry.actLabel), ['1', '2', '3', '4', '5', '6']);
  assert.strictEqual(new Set(SIX_ACTS_ROUTES.map(entry => entry.href)).size, 6);
  assert.deepStrictEqual(SIX_ACTS_VISIBLE_ROUTES.map(entry => entry.actLabel), ['1', '2', '3', '4']);
});

test('the index no longer keeps its own copy of the running order', () => {
  // Two lists for one running order is how they drift apart.
  const index = readFileSync(
    join(REPO_ROOT, 'src/course/six-acts-index/SixActsIndexRoute.tsx'), 'utf8');
  assert.ok(index.includes("from '../nav/sixActsRoutes'"));
  assert.ok(!index.includes('const ACTS'));
});
