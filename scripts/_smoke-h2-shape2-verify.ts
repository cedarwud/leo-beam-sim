#!/usr/bin/env node
// THROWAWAY smoke verifier (controller rule-3 re-run of the server self-check).
// NOT a permanent gate — if green, a compact shape-2 golden is distilled into
// src/modqn/decode/fixtures/goldens/ for the permanent validate:modqn:decode-parity.
//
// Verifies the H2 1-slot smoke (hero A2, t0=9000, slot=step177) on leo TS:
//   [acc1] dense-Q proof green/row via the REAL leo buildModqnDenseQProof consumer
//          + recomputed masked-argmax == selectedActionIndex (argmax-anchor).
//   [acc2] shape-2 auction re-decode [LOAD-BEARING]: stack 100 rows -> U×A V via
//          leo scalarizeRow -> decodeAfPhysicalAuction reproduces the recorded
//          auction serving (selectedServing.beamIndex + beamId) AND the audit
//          (openedPerSlot/demandedPerSlot/nFallback).
//   [acc3] new H2 fields present + well-formed (decodeKind/slotCell/decodeParams/auctionAudit).
// Run: node --import tsx/esm scripts/_smoke-h2-shape2-verify.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decodeAfPhysicalAuction,
  scalarizeRow,
  vMatrixFromNested,
} from '../src/modqn/decode/index.ts';
import { buildModqnDenseQProof } from '../src/modqn/replay-bundle/denseQProof.ts';

const SMOKE =
  '/tmp/leo-beam-sim/modqn-bundles/h2-smoke-a2-t0-9000-slot177/step-trace.jsonl';

interface Serving { beamId: string; beamIndex: number; }
interface Diag {
  candidateActionOrder: { beamId: string }[];
  decisionActionValidityMask: boolean[];
  objectiveQByAction: Record<string, number>[];
  objectiveWeights: Record<string, number>;
  scalarizedQByAction: number[];
  selectedActionIndex: number;
  tieBreak: string;
  invalidActionSentinel: number;
  slotCell: number[];
  decodeKind: string;
  decodeParams: { lW: number; kCap: number; gridCount: number; beamsPerSlot: number; shiftToNonneg: boolean };
  auctionAudit: { nFallback: number; openedPerSlot: number[]; demandedPerSlot: number[] };
}
interface Row { actionIndex: number; selectedServing: Serving; policyDiagnostics: Diag; }

function main(): void {
  console.log('H2 shape-2 smoke verify (leo TS, controller rule-3)');
  const rows = readFileSync(SMOKE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);
  assert.equal(rows.length, 100, `expected 100 UE rows, got ${rows.length}`);

  // [acc3] field presence (structural) — do first so acc1/acc2 can trust shapes.
  for (let u = 0; u < rows.length; u += 1) {
    const pd = rows[u].policyDiagnostics;
    assert.equal(pd.decodeKind, 'auction', `row ${u}: decodeKind`);
    assert.equal(pd.slotCell.length, pd.candidateActionOrder.length, `row ${u}: slotCell len == A`);
    for (const k of ['lW', 'kCap', 'gridCount', 'beamsPerSlot', 'shiftToNonneg'] as const) {
      assert.ok(pd.decodeParams[k] !== undefined, `row ${u}: decodeParams.${k}`);
    }
    for (const k of ['nFallback', 'openedPerSlot', 'demandedPerSlot'] as const) {
      assert.ok(pd.auctionAudit[k] !== undefined, `row ${u}: auctionAudit.${k}`);
    }
  }
  console.log(`  [acc3] 100/100 rows carry decodeKind/slotCell/decodeParams/auctionAudit`);

  // [acc1] dense-Q proof green/row via the REAL leo consumer.
  let proofReady = 0;
  let argmaxAnchorMatch = 0;
  for (let u = 0; u < rows.length; u += 1) {
    const pd = rows[u].policyDiagnostics;
    const proof = buildModqnDenseQProof({
      policyDiagnostics: pd as never,
      actionOrder: pd.candidateActionOrder as never,
      decisionActionValidityMask: pd.decisionActionValidityMask,
    });
    if (proof.status === 'proof-ready') {
      proofReady += 1;
      if (proof.recomputedSelectedActionIndex === pd.selectedActionIndex) argmaxAnchorMatch += 1;
    } else if (u === 0) {
      console.error(`  [acc1] row0 source-gap: ${JSON.stringify(proof.sourceGapField)}`);
    }
  }
  assert.equal(proofReady, 100, `[acc1] ${proofReady}/100 proof-ready`);
  assert.equal(argmaxAnchorMatch, 100, `[acc1] ${argmaxAnchorMatch}/100 argmax-anchor == selectedActionIndex`);
  console.log(`  [acc1] 100/100 dense-Q proof-ready + recomputed argmax == selectedActionIndex`);

  // [acc2] shape-2 auction re-decode [LOAD-BEARING].
  const params = rows[0].policyDiagnostics.decodeParams;
  const nested: (number | null)[][] = rows.map((r) => {
    const pd = r.policyDiagnostics;
    const scal = scalarizeRow(pd.objectiveQByAction, pd.objectiveWeights, pd.decisionActionValidityMask, pd.invalidActionSentinel);
    return Array.from(scal, (x) => (x === -Infinity ? null : x));
  });
  const V = vMatrixFromNested(nested);
  const slotCell = rows.map((r) => r.policyDiagnostics.slotCell);

  const res = decodeAfPhysicalAuction(V, slotCell, params, { returnAudit: true });
  // determinism: a second run must be byte-identical.
  const res2 = decodeAfPhysicalAuction(V, slotCell, params, { returnAudit: true });
  assert.deepEqual(res2.out, res.out, '[acc2] non-deterministic auction out');
  assert.deepEqual(res2.audit, res.audit, '[acc2] non-deterministic auction audit');

  assert.equal(res.out.length, 100, '[acc2] out length');
  let servingIdxMatch = 0;
  let servingBeamIdMatch = 0;
  const firstMiss: string[] = [];
  for (let u = 0; u < rows.length; u += 1) {
    const pd = rows[u].policyDiagnostics;
    const recorded = rows[u].selectedServing;
    if (res.out[u] === recorded.beamIndex) servingIdxMatch += 1;
    else if (firstMiss.length < 5) firstMiss.push(`u${u}: TS=${res.out[u]} rec=${recorded.beamIndex}`);
    if (pd.candidateActionOrder[res.out[u]]?.beamId === recorded.beamId) servingBeamIdMatch += 1;
  }
  if (firstMiss.length) console.error(`  [acc2] serving-idx misses: ${firstMiss.join(' | ')}`);
  assert.equal(servingIdxMatch, 100, `[acc2] ${servingIdxMatch}/100 out[u] == selectedServing.beamIndex`);
  assert.equal(servingBeamIdMatch, 100, `[acc2] ${servingBeamIdMatch}/100 candidateActionOrder[out].beamId == servingBeamId`);

  const audit = res.audit!;
  assert.deepEqual(audit.openedPerSlot, [2, 3, 3, 3], `[acc2] openedPerSlot ${JSON.stringify(audit.openedPerSlot)}`);
  assert.deepEqual(audit.demandedPerSlot, [2, 3, 3, 3], `[acc2] demandedPerSlot ${JSON.stringify(audit.demandedPerSlot)}`);
  assert.equal(audit.nFallback, 0, `[acc2] nFallback ${audit.nFallback}`);
  console.log(`  [acc2] 100/100 auction re-decode reproduces serving (idx+beamId) + audit [2,3,3,3]/nFallback 0`);

  // load-bearing sanity: the decouple is real (argmax-anchor != auction-served for many UEs).
  const decoupled = rows.filter((r) => r.actionIndex !== r.selectedServing.beamIndex).length;
  console.log(`  [decouple] ${decoupled}/100 UEs argmax-anchor != auction-served (proves A is load-bearing, not decorative)`);

  console.log('PASS: leo TS reproduces the server smoke self-check bit-for-bit (acc1+acc2+acc3).');
}

main();
