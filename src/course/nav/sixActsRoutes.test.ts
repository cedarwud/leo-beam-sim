#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SIX_ACTS_INDEX_HREF,
  SIX_ACTS_ROUTES,
  nextSixActsRoute,
  previousSixActsRoute,
  sixActsRouteFor,
} from './sixActsRoutes';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('every listed route is actually registered in the router', () => {
  // A nav entry pointing at an unrouted path is a dead link in a lecture.
  const main = readFileSync(join(REPO_ROOT, 'src/main.tsx'), 'utf8');
  for (const entry of SIX_ACTS_ROUTES) {
    assert.ok(main.includes(`'${entry.href}'`), `${entry.href} is not routed in main.tsx`);
  }
  assert.ok(main.includes(`'${SIX_ACTS_INDEX_HREF}'`));
});

test('every act carries the nav strip, so no page is a dead end', () => {
  const files = [
    'src/prototype/global-constellation/GlobalConstellationPrototype.tsx',
    'src/course/tle-journey/TleJourneyRoute.tsx',
    'src/course/angle-lab/AngleLabRoute.tsx',
    'src/course/handover-theatre/HandoverTheatreRoute.tsx',
    'src/course/energy-lab/EnergyLabRoute.tsx',
    'src/course/six-acts-index/SixActsIndexRoute.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(join(REPO_ROOT, file), 'utf8');
    assert.ok(source.includes('<SixActsNav'), `${file} has no nav strip`);
  }
});

test('every route render carries the way in, so none can be forgotten', () => {
  // Mounted at the router, not inside one root component: five different roots
  // serve "the app", and putting the entry in one of them left the other four
  // without it. This asserts the stronger property — every successful render
  // goes through the shell that adds it.
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

test('the homepage carries a visible top-band entry, not only the corner one', () => {
  // The corner launcher alone was dark-on-dark at the screen edge of a full
  // engineering dashboard and went unnoticed in review. The top band is where
  // the eye lands, so the entry lives there too.
  const app = readFileSync(join(REPO_ROOT, 'src/App.tsx'), 'utf8');
  assert.ok(app.includes('data-testid="six-acts-top-entry"'));
  assert.ok(app.includes(SIX_ACTS_INDEX_HREF));
});

test('the six-acts surfaces suppress the launcher, having their own nav', () => {
  const main = readFileSync(join(REPO_ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(main.includes('isSixActsSurface'));
  for (const entry of SIX_ACTS_ROUTES) {
    // Each act's route flag must feed the suppression check, or an act would
    // show both its nav strip and the corner launcher.
    assert.ok(main.includes(`'${entry.href}'`));
  }
});

test('the running order chains forwards and backwards', () => {
  const first = SIX_ACTS_ROUTES[0]!;
  const last = SIX_ACTS_ROUTES[SIX_ACTS_ROUTES.length - 1]!;

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
  assert.strictEqual(visited, SIX_ACTS_ROUTES.length);
});

test('every act except the last hands off with a bridge', () => {
  SIX_ACTS_ROUTES.forEach((entry, index) => {
    const isLast = index === SIX_ACTS_ROUTES.length - 1;
    assert.strictEqual(entry.bridgeZhHant === null, isLast, `${entry.id} bridge is wrong`);
  });
});

test('hrefs are unique and resolvable', () => {
  const hrefs = SIX_ACTS_ROUTES.map(entry => entry.href);
  assert.strictEqual(new Set(hrefs).size, hrefs.length);
  for (const href of hrefs) assert.strictEqual(sixActsRouteFor(href)?.href, href);
  assert.strictEqual(sixActsRouteFor('/nope'), null);
});

test('the index no longer keeps its own copy of the running order', () => {
  // Two lists for one running order is how they drift apart.
  const index = readFileSync(
    join(REPO_ROOT, 'src/course/six-acts-index/SixActsIndexRoute.tsx'), 'utf8');
  assert.ok(index.includes("from '../nav/sixActsRoutes'"));
  assert.ok(!index.includes('const ACTS'));
});
