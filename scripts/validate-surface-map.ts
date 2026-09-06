#!/usr/bin/env node
/**
 * validate:surface-map -- the owner-vocabulary table must still point somewhere.
 *
 * `docs/frontend-change-contract.md` carries a table mapping the phrases the
 * owner actually uses ("右欄的波束列表", "EE 閾值") to the file that owns that
 * behaviour. It exists because a cheap model, told to change the homepage right
 * rail, edited the handover-evaluation panel instead: its change was internally
 * consistent, every gate stayed green, and its own report called the region it
 * edited 「主比較區」-- so it had not found the real surface at all. No
 * assertion catches correct code in the wrong place; a signpost does.
 *
 * A signpost that rots is worse than none, because it is confidently wrong. So
 * every row is checked here: the file must exist, and the symbol must actually
 * be exported from it. Renaming a surface therefore forces the map to move with
 * it, which is the moment someone re-reads what the phrase is supposed to mean.
 *
 * The decoy list is checked too -- a decoy that no longer exists is a warning
 * about a file nobody will ever open again.
 *
 * Run: npm run validate:surface-map
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const docPath = 'docs/frontend-change-contract.md';
const doc = readFileSync(join(repoRoot, docPath), 'utf8');

// Bound the section at the next heading. Reading to end-of-file swept in
// bullets from later sections and reported them as decoys -- a check that reads
// more than it means to is a check whose GREEN means less than it claims.
const afterHeading = doc.split('## Surface map')[1];
const section = afterHeading === undefined ? undefined : afterHeading.split(/^## /m)[0];
if (section === undefined) {
  console.error(`FAIL: ${docPath} no longer has a "## Surface map" section. It is the only`
    + ' thing in this repo that maps the owner\'s words to a file; do not drop it silently.');
  process.exit(1);
}

/** Rows look like: | phrase | `path` | `symbol` | */
const rows = [...section.matchAll(/^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|$/gm)]
  .map(([, phrase, path, symbol]) => ({ phrase: phrase!.trim(), path: path!.trim(), symbol: symbol!.trim() }))
  .filter(row => row.phrase !== 'The owner says' && !/^-+$/.test(row.phrase));

// The doc uses an em dash. Matching only "--" silently found zero decoys and
// still reported GREEN, which is exactly the failure this script exists to stop.
const decoys = [...section.matchAll(/^-\s+`([^`]+)`\s+[-\u2014]/gm)].map(([, path]) => path!.trim());

let failed = false;
console.log(`surface-map rows: ${rows.length}, decoys: ${decoys.length}`);

if (decoys.length < 2) {
  console.error(`FAIL: only ${decoys.length} decoys parsed. The decoy list is the half of the map`
    + ' that says where NOT to go; a parse that quietly finds none reports GREEN on nothing.');
  failed = true;
}

if (rows.length < 5) {
  console.error(`FAIL: only ${rows.length} mapped phrases parsed. Either the table shrank or its`
    + ' format changed and this check silently stopped reading it.');
  failed = true;
}

for (const { phrase, path, symbol } of rows) {
  if (!existsSync(join(repoRoot, path))) {
    console.error(`FAIL: "${phrase}" points at ${path}, which does not exist.`);
    failed = true;
    continue;
  }
  const source = readFileSync(join(repoRoot, path), 'utf8');
  const exported = new RegExp(
    `export\\s+(?:async\\s+)?(?:function|const|class|type|interface)\\s+${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
  ).test(source);
  if (!exported) {
    console.error(`FAIL: "${phrase}" points at ${path}:${symbol}, which that file does not export.`
      + ' The surface was renamed or moved and the map was left behind.');
    failed = true;
  } else {
    console.log(`  ok ${phrase} -> ${path}:${symbol}`);
  }
}

for (const path of decoys) {
  if (!existsSync(join(repoRoot, path))) {
    console.error(`FAIL: the decoy ${path} no longer exists; remove its warning from the map.`);
    failed = true;
  } else {
    console.log(`  ok decoy still present: ${path}`);
  }
}

if (failed) {
  console.error('RED: the surface map points somewhere that is no longer true.');
  process.exit(1);
}
console.log('GREEN: every mapped surface still exists and still exports what the map claims.');
