#!/usr/bin/env node
// Golden-provenance extractor (committed 2026-07-07: birth tool of the frozen
// shape-2 auction golden — kept for provenance/re-extraction) — distils ONE representative decision slot
// from the leo-verified H2 a2-hero window into a PERMANENT shape-2 auction golden
// for validate:modqn:decode-parity. Extract-and-freeze from the frozen step-trace;
// no producer Python import. Verifies leo's own decode reproduces the RECORDED
// serving + audit + argmax-anchor BEFORE writing (so the frozen expected is the
// recorded ground truth, not a tautology of the TS output).
//
// Run: node --import tsx/esm scripts/_shape2-golden-extract.ts [slotIndex] [--compact]

import assert from 'node:assert/strict';
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeA0Argmax,
  decodeAfPhysicalAuction,
  scalarizeMatrix,
  vMatrixToNested,
} from '../src/modqn/decode/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);
const GOLDENS_DIR = join(REPO_ROOT, 'src/modqn/decode/fixtures/goldens');

const ARM_DIR =
  '/tmp/leo-beam-sim/modqn-bundles/h2-dense-ablation-2026-07-04/a2-t0_9000-w117_213';
const TRACE = join(ARM_DIR, 'timeline/step-trace.jsonl');
const PRODUCER_REV = '33cc302'; // manifest.producerHead (H2 export)
const SOURCE_PATH = 'src/modqn_paper_reproduction/route_b_factorial/auction_decode.py';

const TARGET_SLOT = Number(process.argv[2] ?? '30');
const COMPACT = process.argv.includes('--compact');
const CASE_ID = `shape2-auction-h2-a2-slot${TARGET_SLOT}`;

interface Diag {
  objectiveQByAction: Record<string, number>[];
  objectiveWeights: Record<string, number>;
  decisionActionValidityMask: boolean[];
  slotCell: number[];
  invalidActionSentinel: number;
  decodeParams: { lW: number; kCap: number; gridCount: number; beamsPerSlot: number; shiftToNonneg: boolean };
  auctionAudit: { nFallback: number; openedPerSlot: number[]; demandedPerSlot: number[] };
  selectedActionIndex: number;
  decodeKind: string;
}
interface Row {
  slotIndex: number;
  userIndex: number;
  selectedServing: { beamIndex: number; beamId: string };
  policyDiagnostics: Diag;
}

async function collectSlot(): Promise<Row[]> {
  const rl = createInterface({ input: createReadStream(TRACE), crlfDelay: Infinity });
  const rows: Row[] = [];
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    const r = JSON.parse(t) as Row;
    if (r.slotIndex === TARGET_SLOT) rows.push(r);
  }
  rows.sort((a, b) => a.userIndex - b.userIndex);
  return rows;
}

async function main(): Promise<void> {
  const rows = await collectSlot();
  assert.equal(rows.length, 100, `slot ${TARGET_SLOT}: expected 100 UE rows, got ${rows.length}`);

  const d0 = rows[0].policyDiagnostics;
  const A = d0.objectiveQByAction.length;
  assert.equal(A, 28, `A=${A}`);
  const weights = d0.objectiveWeights;
  const params = d0.decodeParams;
  const sentinel = d0.invalidActionSentinel;
  const recordedAudit = d0.auctionAudit;
  assert.equal(d0.decodeKind, 'auction', 'decodeKind must be auction');

  // slot-level invariants: weights / params / sentinel / audit identical across the 100 rows.
  for (let u = 0; u < rows.length; u += 1) {
    const d = rows[u].policyDiagnostics;
    assert.deepEqual(d.objectiveWeights, weights, `row ${u}: objectiveWeights drift`);
    assert.deepEqual(d.decodeParams, params, `row ${u}: decodeParams drift`);
    assert.equal(d.invalidActionSentinel, sentinel, `row ${u}: sentinel drift`);
    assert.deepEqual(d.auctionAudit, recordedAudit, `row ${u}: auctionAudit drift`);
    assert.equal(d.objectiveQByAction.length, A, `row ${u}: Q length`);
    assert.equal(d.decisionActionValidityMask.length, A, `row ${u}: mask length`);
    assert.equal(d.slotCell.length, A, `row ${u}: slotCell length`);
  }

  const objectiveQByAction = rows.map((r) => r.policyDiagnostics.objectiveQByAction);
  const mask = rows.map((r) => r.policyDiagnostics.decisionActionValidityMask);
  const slotCell = rows.map((r) => r.policyDiagnostics.slotCell);
  const recordedServing = rows.map((r) => r.selectedServing.beamIndex);
  const recordedSelected = rows.map((r) => r.policyDiagnostics.selectedActionIndex);

  // leo decode: scalarize (shape-2) -> auction + argmax.
  const V = scalarizeMatrix(objectiveQByAction, weights, mask, sentinel);
  const scalarizedNested = vMatrixToNested(V);
  const argmaxOut = decodeA0Argmax(V);
  const res = decodeAfPhysicalAuction(V, slotCell, params, { returnAudit: true });

  // VERIFY leo reproduces the RECORDED ground truth before freezing.
  assert.deepEqual(res.out, recordedServing, 'leo auction out != recorded selectedServing.beamIndex');
  assert.deepEqual(res.audit, recordedAudit, 'leo auction audit != recorded auctionAudit');
  assert.deepEqual(argmaxOut, recordedSelected, 'leo masked-argmax != recorded selectedActionIndex');

  const decouple = recordedServing.filter((s, u) => s !== recordedSelected[u]).length;
  console.log(`slot ${TARGET_SLOT}: 100 rows, A=${A}`);
  console.log(`  recorded audit: ${JSON.stringify(recordedAudit)}`);
  console.log(`  leo reproduces serving + audit + argmax-anchor: OK`);
  console.log(`  decouple (argmax-anchor != auction-served): ${decouple}/100`);

  const golden = {
    provenance: {
      producerRev: PRODUCER_REV,
      sourcePath: SOURCE_PATH,
      generatedAt: new Date().toISOString(),
      caseId: CASE_ID,
      sourceArtifact: 'h2-dense-ablation-2026-07-04/a2-t0_9000-w117_213 (leo-verified 2026-07-04)',
      sourceSlotIndex: TARGET_SLOT,
      leoVerified: 'scalarize->auction reproduces recorded selectedServing.beamIndex + auctionAudit; scalarize->argmax reproduces recorded selectedActionIndex',
    },
    kind: 'scalarize-argmax',
    note: `H2 a2-hero (auction) slot ${TARGET_SLOT}: 100 UE x 28 actions real dense-Q. Generic scalarize-argmax path locks the argmax-anchor; the shape-2 auction block locks scalarize->decodeAfPhysicalAuction. Audit ${JSON.stringify(recordedAudit.openedPerSlot)} (opened not all-equal), nFallback ${recordedAudit.nFallback}, decouple ${decouple}/100.`,
    params,
    inputs: {
      objectiveQByAction,
      objectiveWeights: weights,
      mask,
      invalidActionSentinel: sentinel,
      slotCell,
    },
    expected: {
      scalarized: scalarizedNested,
      argmaxOut,
      auctionOut: res.out,
      audit: res.audit,
    },
  };

  const outPath = join(GOLDENS_DIR, `${CASE_ID}.json`);
  const json = COMPACT ? JSON.stringify(golden) : JSON.stringify(golden, null, 2);
  writeFileSync(outPath, `${json}\n`, 'utf8');
  console.log(`WROTE ${outPath} (${(json.length / 1024).toFixed(1)} KiB, ${COMPACT ? 'compact' : 'indent=2'})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
