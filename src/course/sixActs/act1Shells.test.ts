#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SIX_ACTS_ACT1_ARCHIVE_DATES,
  SIX_ACTS_POLAR_INCLINATION_DEG,
  SIX_ACTS_SHELL_BANDS,
  censusSixActsShells,
  classifySixActsShell,
  describeSixActsShellHonesty,
  readInclinationDegFromTleLine2,
  tallySixActsShells,
} from './act1Shells';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function archiveInclinations(constellation: 'starlink' | 'oneweb'): readonly number[] {
  const path = join(
    REPO_ROOT,
    'public/tle-archive',
    constellation,
    `${constellation}_${SIX_ACTS_ACT1_ARCHIVE_DATES[constellation]}.tle`,
  );
  const lines = readFileSync(path, 'utf8').split('\n').map(line => line.trimEnd()).filter(line => line !== '');
  const inclinations: number[] = [];
  for (let index = 0; index + 2 < lines.length; index += 3) {
    if (!lines[index + 1].startsWith('1 ') || !lines[index + 2].startsWith('2 ')) continue;
    inclinations.push(readInclinationDegFromTleLine2(lines[index + 2]));
  }
  return inclinations;
}

test('the bands partition without gaps a real orbit can fall into', () => {
  // Boundaries sit between the measured clusters, so nothing lands in 'other'.
  const starlink = censusSixActsShells(archiveInclinations('starlink'));
  assert.strictEqual(starlink.byShell.other, 0);

  const summed = Object.values(starlink.byShell).reduce((sum, count) => sum + count, 0);
  assert.strictEqual(summed, starlink.total);
});

test('the measured Starlink shells match the published archive', () => {
  const census = censusSixActsShells(archiveInclinations('starlink'));

  assert.strictEqual(census.total, 10_739);
  assert.strictEqual(census.byShell['main-53'], 5_039);
  assert.strictEqual(census.byShell['mid-43'], 3_622);
  assert.strictEqual(census.byShell['high-70'], 710);
  assert.strictEqual(census.byShell.polar, 1_368);
  assert.ok(Math.abs(census.minInclinationDeg - 42.96) < 0.01);
  assert.ok(Math.abs(census.maxInclinationDeg - 97.63) < 0.01);
});

test('43 deg is not a rounding artefact: it is the second largest group', () => {
  // The proposal named a 53 / 70 / polar / all filter. Measurement says the
  // 43 deg group outnumbers both 70 deg and the polar group, so it earns a band.
  const census = censusSixActsShells(archiveInclinations('starlink'));

  assert.ok(census.byShell['mid-43'] > census.byShell['high-70']);
  assert.ok(census.byShell['mid-43'] > census.byShell.polar);
  assert.ok(census.byShell['mid-43'] < census.byShell['main-53']);
});

test('the polar share is the number the honesty pairing needs', () => {
  const census = censusSixActsShells(archiveInclinations('starlink'));

  assert.strictEqual(census.polarCount, 1_368);
  assert.ok(Math.abs(census.polarFraction - 0.127) < 0.001);
});

test('OneWeb is effectively one polar shell', () => {
  const census = censusSixActsShells(archiveInclinations('oneweb'));

  assert.strictEqual(census.total, 651);
  assert.strictEqual(census.polarCount, 651);
  assert.strictEqual(census.byShell['main-53'], 0);
});

test('the honesty caption follows the data, not a fixed sentence', () => {
  const starlink = describeSixActsShellHonesty(
    censusSixActsShells(archiveInclinations('starlink')),
    'Starlink',
  );
  const oneweb = describeSixActsShellHonesty(
    censusSixActsShells(archiveInclinations('oneweb')),
    'OneWeb',
  );

  assert.match(starlink, /1368|1,368/);
  assert.match(starlink, /只對 53° 主力殼/);
  assert.match(oneweb, /完全不成立/);
  assert.notStrictEqual(starlink, oneweb);
});

test('the 53 deg shell is the only one allowed the polar-hole claim', () => {
  const withClaim = SIX_ACTS_SHELL_BANDS.filter(band => band.claimZhHant.includes('只有對這一殼成立'));
  assert.strictEqual(withClaim.length, 1);
  assert.strictEqual(withClaim[0].id, 'main-53');
});

test('classification names an out-of-band orbit instead of forcing it into one', () => {
  assert.strictEqual(classifySixActsShell(53.16), 'main-53');
  assert.strictEqual(classifySixActsShell(43.0), 'mid-43');
  assert.strictEqual(classifySixActsShell(70.0), 'high-70');
  assert.strictEqual(classifySixActsShell(97.6), 'polar');
  assert.strictEqual(classifySixActsShell(SIX_ACTS_POLAR_INCLINATION_DEG), 'polar');
  assert.strictEqual(classifySixActsShell(10), 'other');
  assert.strictEqual(classifySixActsShell(Number.NaN), 'other');
});

test('inclination is read from the documented TLE columns', () => {
  // ONEWEB-0325 line 2 from the pinned teaching window.
  const line2 = '2 49194  87.9202 324.6537 0001941 103.3463 256.7886 13.18683671237178';
  assert.strictEqual(readInclinationDegFromTleLine2(line2), 87.9202);
});

test('the tally and the census agree on the same orbits', () => {
  // The page tallies classified shells; the archive test censuses inclinations.
  // Two paths to one fact must not disagree, or the panel and the caption show
  // different numbers for the same thing.
  const inclinations = archiveInclinations('starlink');
  const census = censusSixActsShells(inclinations);
  const tally = tallySixActsShells(inclinations.map(classifySixActsShell));

  assert.deepStrictEqual(tally.byShell, census.byShell);
  assert.strictEqual(tally.polarCount, census.polarCount);
  assert.strictEqual(tally.total, census.total);
});

test('polar membership has exactly one rule, including at the boundary', () => {
  const boundary = SIX_ACTS_POLAR_INCLINATION_DEG;
  assert.strictEqual(classifySixActsShell(boundary), 'polar');
  assert.strictEqual(censusSixActsShells([boundary]).polarCount, 1);
  assert.strictEqual(tallySixActsShells([classifySixActsShell(boundary)]).polarCount, 1);
});
