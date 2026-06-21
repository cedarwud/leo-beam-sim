/**
 * Consolidation S4-2 — servingBeamId↔cellId pun retirement gate.
 *
 * The disease (s4-one-serving-truth-plan.md §1 problem 2): on sinr-live the
 * published per-UE record set `servingBeamId := ue.cellId` — a cellId
 * masquerading as a beamId — at the publisher (useSimStatePublisher) and the
 * cell handover event index (from/toBeamId), making the aggregate's "serving
 * beams" and the steered serving beam incomparable.
 *
 * The cut (ADDITIVE, Decision D2): a typed `servingCellId` carries the cell
 * identity; `servingBeamId` is null on the cell lane (no steered beam exists
 * under the cell model); cell-truth events null from/toBeamId and keep the
 * typed from/toCellId. "Cell drives display" stays legitimate — consumers key
 * the serving unit on the TYPED cell field; no field masquerades as another.
 *
 * Sections:
 *   S. STRUCTURAL — no source line in src/ (or scripts/) assigns a *BeamId
 *      field from a cellId; the historical pun sites expose the typed
 *      replacement markers.
 *   B. BEHAVIOR — the mosaic aggregate accepts cell-lane records (servingBeamId
 *      null + servingCellId set): served counting, the `${satId}:${cellId}`
 *      keying, and the beam-load colour all agree with the 3D cell colour map
 *      (`buildSinrServingUeColorMapFromCells`) — the HUD and the 3D mosaic read
 *      ONE typed serving unit. Steered records (servingCellId null) are
 *      byte-identical to the pre-S4-2 behaviour.
 *   E. EVENT BUILDER — a cell-truth handover event carries null from/toBeamId
 *      and the typed from/toCellId (the site-3 de-pun, asserted on behaviour).
 *   Determinism: run-twice A==B on the aggregate output.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildSinrServingUeColorMapFromCells,
  deriveSinrServingMosaicAggregate,
  mosaicColorForServingBeam,
} from '../src/scene/sinrServingMosaic.ts';
import { createSinrLiveCellHandoverEventFromUeTransition } from '../src/scene/sinrLiveCellHandoverEventIndex.ts';

const GATE = 'validate:s4:pun-retired';
const REPO_ROOT = join(import.meta.dirname, '..');

function log(line: string): void {
  console.log(`[${GATE}] ${line}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// S. STRUCTURAL — the pun assignment shape is extinct in source.
// Matches `servingBeamId:`/`fromBeamId:`/`toBeamId:` whose right-hand side
// (up to the comma/newline) ends in a `cellId` member — the exact pun shape
// `servingBeamId: ue.servingSatId === null ? null : ue.cellId`. The \b after
// BeamId keeps `toBeamIdentity:` out; `servingCellId: …cellId` never matches
// because the left side must be a *BeamId field.
// ─────────────────────────────────────────────────────────────────────────────
const PUN_ASSIGNMENT = /(?:serving|from|to)BeamId\b\s*:\s*[^,\n]*\bcellId\b/;

/**
 * Strip comments before the sweep — doc comments may NAME the retired pun
 * (e.g. "the old `fromBeamId := cellId` pun") without being an assignment.
 * Crude (a `//` inside a string literal truncates that line; a `/*` inside a
 * string literal would swallow code until the next `*​/`) but a sweep
 * false-negative on such a line is acceptable — the publisher-shape governance
 * needle and section B's behavioural asserts are the redundant layers, and an
 * alias-laundered re-pun (`const cid = ue.cellId; servingBeamId: cid`) is
 * likewise only caught by those layers (S4-3's equivalence gate must keep a
 * behavioural publisher-shape assert when the needles retire).
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

{
  const files = [
    ...listSourceFiles(join(REPO_ROOT, 'src')),
    // scripts/ too: a validator/fixture that re-constructs punned cell-lane
    // records is the same disease (the gate's own regex literal never
    // self-matches — its alternation is interrupted by the group syntax).
    ...listSourceFiles(join(REPO_ROOT, 'scripts')),
  ];
  assert.ok(files.length > 100, `S: source sweep is non-vacuous (saw ${files.length} files)`);
  const offenders: string[] = [];
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    const match = text.match(PUN_ASSIGNMENT);
    if (match !== null) offenders.push(`${file}: ${match[0]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `S: no source assigns a *BeamId field from a cellId (pun retired). Offenders:\n${offenders.join('\n')}`,
  );

  // The three historical pun sites expose the typed replacement (catches a
  // silent revert that also deletes the typed field instead of re-punning).
  const publisher = readFileSync(join(REPO_ROOT, 'src/scene/useSimStatePublisher.ts'), 'utf8');
  assert.ok(
    publisher.includes('servingCellId: ue.servingSatId === null ? null : ue.cellId,'),
    'S: publisher cell branch publishes the typed servingCellId',
  );
  assert.ok(
    publisher.includes('servingCellId: null,'),
    'S: publisher steered branch publishes an explicit null servingCellId',
  );
  const eventIndex = readFileSync(join(REPO_ROOT, 'src/scene/sinrLiveCellHandoverEventIndex.ts'), 'utf8');
  assert.ok(
    eventIndex.includes('fromBeamId: null,') && eventIndex.includes('toBeamId: null,'),
    'S: cell event builder carries null steered beam ids (cell ids are the identity)',
  );
  const typesSource = readFileSync(join(REPO_ROOT, 'src/scene/types.ts'), 'utf8');
  assert.ok(
    typesSource.includes('servingCellId: number | null;'),
    'S: the published per-UE record type declares the typed servingCellId',
  );
  log(`S structural: ${files.length} files swept, 0 pun assignments; typed markers present at the publisher + event-index sites`);
}

// ─────────────────────────────────────────────────────────────────────────────
// B. BEHAVIOR — one typed serving unit drives HUD aggregate == 3D map.
// ─────────────────────────────────────────────────────────────────────────────
const CELL_LANE_UES = [
  // served cell records: NO steered beam id (null), typed cell id set.
  { id: 'ue-0', servingSatId: 'SAT-7', servingBeamId: null, servingCellId: 12, sinrDb: 4.5 },
  { id: 'ue-1', servingSatId: 'SAT-7', servingBeamId: null, servingCellId: 12, sinrDb: -1.0 },
  { id: 'ue-2', servingSatId: 'SAT-7', servingBeamId: null, servingCellId: 30, sinrDb: 2.0 },
  { id: 'ue-3', servingSatId: 'SAT-9', servingBeamId: null, servingCellId: 12, sinrDb: 7.5 },
  // unserved cell record (cell idle this slot): both unit fields null.
  { id: 'ue-4', servingSatId: null, servingBeamId: null, servingCellId: null, sinrDb: null },
] as const;

{
  const aggregate = deriveSinrServingMosaicAggregate(CELL_LANE_UES);
  assert.equal(aggregate.totalCount, 5, 'B: aggregate sees all cell-lane records');
  assert.equal(aggregate.servedCount, 4, 'B: cell-lane records with a typed servingCellId COUNT as served (servingBeamId is null)');
  assert.equal(aggregate.servingBeamCount, 3, 'B: distinct serving units = distinct (satId, cellId) pairs');
  const keys = aggregate.beamLoads.map(load => load.key).sort();
  assert.deepEqual(
    keys,
    ['SAT-7:12', 'SAT-7:30', 'SAT-9:12'],
    'B: beam-load keying is (satId, cellId) via the typed field',
  );
  const busiest = aggregate.beamLoads[0];
  assert.equal(busiest.key, 'SAT-7:12', 'B: busiest serving unit is the 2-UE cell');
  assert.equal(busiest.count, 2, 'B: per-unit UE counts aggregate on the typed cell id');

  // HUD beam-load colour == 3D mosaic colour for the SAME (satId, cellId): the
  // cross-surface "one typed serving unit" promise (pre-figures S4-3 equivalence).
  const cellMapColors = buildSinrServingUeColorMapFromCells(
    CELL_LANE_UES.map(ue => ({ ueId: ue.id, servingSatId: ue.servingSatId, cellId: ue.servingCellId })),
  );
  for (const load of aggregate.beamLoads) {
    const expected = mosaicColorForServingBeam(load.satId, load.beamId).markerColor;
    assert.equal(load.color, expected, `B: aggregate colour for ${load.key} derives from the typed unit`);
    const carrier = CELL_LANE_UES.find(ue => ue.servingSatId === load.satId && ue.servingCellId === load.beamId);
    assert.ok(carrier !== undefined, `B: a cell record carries ${load.key}`);
    assert.equal(
      cellMapColors.get(carrier.id)?.markerColor,
      expected,
      `B: 3D cell colour map agrees with the HUD beam-load colour for ${load.key}`,
    );
  }

  // Steered-lane records are UNAFFECTED (servingCellId null → the steered beam id keys).
  const steeredUes = [
    { id: 'ue-0', servingSatId: 'SAT-3', servingBeamId: 5, servingCellId: null, sinrDb: 9 },
    { id: 'ue-1', servingSatId: null, servingBeamId: null, servingCellId: null, sinrDb: null },
  ] as const;
  const steeredAggregate = deriveSinrServingMosaicAggregate(steeredUes);
  assert.equal(steeredAggregate.servedCount, 1, 'B: steered record still counts');
  assert.equal(steeredAggregate.beamLoads[0]?.key, 'SAT-3:5', 'B: steered keying stays (satId, beamId)');
  // …and the legacy shape WITHOUT the field at all behaves identically (additive).
  const legacyAggregate = deriveSinrServingMosaicAggregate([
    { servingSatId: 'SAT-3', servingBeamId: 5, sinrDb: 9 },
    { servingSatId: null, servingBeamId: null, sinrDb: null },
  ]);
  assert.equal(legacyAggregate.beamLoads[0]?.key, 'SAT-3:5', 'B: absent servingCellId === null servingCellId (additive)');
  assert.equal(legacyAggregate.servedCount, steeredAggregate.servedCount, 'B: legacy shape counts identically');

  // Determinism: run-twice A==B.
  const second = deriveSinrServingMosaicAggregate(CELL_LANE_UES);
  assert.deepEqual(JSON.parse(JSON.stringify(second)), JSON.parse(JSON.stringify(aggregate)), 'B: aggregate is deterministic (A==B)');
  log(`B behavior: served ${aggregate.servedCount}/${aggregate.totalCount}, units ${keys.join(' ')}, HUD==3D colours, steered+legacy unaffected`);
}

// ─────────────────────────────────────────────────────────────────────────────
// E. EVENT BUILDER — cell-truth events carry typed cell ids, null beam ids.
// ─────────────────────────────────────────────────────────────────────────────
{
  const base = {
    ueId: 'ue-42',
    beamIdentity: 'SAT-7#cell12',
    frequencyIndex: 1,
    sinrDb: 3.5,
    offAxisDeg: 0.8,
  };
  const inter = createSinrLiveCellHandoverEventFromUeTransition({
    previous: { ...base, cellId: 12, servingSatId: 'SAT-7' },
    current: { ...base, cellId: 30, servingSatId: 'SAT-9', beamIdentity: 'SAT-9#cell30', sinrDb: 6.0 },
    handoverKind: 'inter',
    sourceTimeSec: 120,
    offsetDb: 2,
    sequence: 1,
  });
  assert.ok(inter !== null, 'E: inter cell event builds');
  assert.equal(inter.fromBeamId, null, 'E: cell event fromBeamId is null (pun retired)');
  assert.equal(inter.toBeamId, null, 'E: cell event toBeamId is null (pun retired)');
  assert.equal(inter.fromCellId, 12, 'E: typed fromCellId carries the cell identity');
  assert.equal(inter.toCellId, 30, 'E: typed toCellId carries the cell identity');

  const intra = createSinrLiveCellHandoverEventFromUeTransition({
    previous: { ...base, cellId: 12, servingSatId: 'SAT-7' },
    current: { ...base, cellId: 13, servingSatId: 'SAT-7', sinrDb: 5.0 },
    handoverKind: 'intra',
    sourceTimeSec: 240,
    offsetDb: 2,
    sequence: 2,
  });
  assert.ok(intra !== null, 'E: intra cell event builds');
  assert.equal(intra.fromBeamId, null, 'E: intra fromBeamId null');
  assert.equal(intra.toBeamId, null, 'E: intra toBeamId null');
  assert.equal(intra.fromCellId, 12, 'E: intra fromCellId');
  assert.equal(intra.toCellId, 13, 'E: intra toCellId');
  log('E event builder: cell events expose typed cellIds, null beam ids (inter + intra)');
}

log('PASS — servingBeamId↔cellId pun retired (structural sweep + typed-unit behavior + event builder)');
