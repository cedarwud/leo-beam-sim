#!/usr/bin/env node
// THROWAWAY H2 full-window leo-side verifier (controller rule-3, non-permanent).
// Generalizes _smoke-h2-shape2-verify.ts to a 9600-row arm (96 decision slots x 100 UE):
//   [acc1] dense-Q proof green/row (real leo buildModqnDenseQProof) + argmax-anchor.
//   [acc2] per-slot shape-2 auction re-decode [LOAD-BEARING]: group by slotIndex,
//          build U×A V via leo scalarizeRow -> decodeAfPhysicalAuction reproduces the
//          recorded serving (selectedServing.beamIndex + beamId) AND per-slot audit.
//   [acc3] new fields present.
// Run: node --import tsx/esm scripts/_h2-full-verify.ts <arm-dir>

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decodeAfPhysicalAuction,
  scalarizeRow,
  vMatrixFromNested,
} from '../src/modqn/decode/index.ts';
import { buildModqnDenseQProof } from '../src/modqn/replay-bundle/denseQProof.ts';

const ARM_DIR = process.argv[2];
if (!ARM_DIR) { console.error('usage: _h2-full-verify.ts <arm-dir>'); process.exit(2); }
const TRACE = join(ARM_DIR, 'timeline/step-trace.jsonl');

interface Row {
  slotIndex: number; userIndex: number;
  selectedServing: { beamId: string; beamIndex: number };
  policyDiagnostics: any;
}

function eqArr(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function main(): void {
  const rows: Row[] = readFileSync(TRACE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l));
  const decodeKind = rows[0]?.policyDiagnostics?.decodeKind ?? '(none)';
  console.log(`\n== ${ARM_DIR.split('/').pop()} == rows=${rows.length} decodeKind=${decodeKind}`);

  // group by decision slot
  const bySlot = new Map<number, Row[]>();
  for (const r of rows) { const g = bySlot.get(r.slotIndex) ?? []; g.push(r); bySlot.set(r.slotIndex, g); }
  const slots = [...bySlot.keys()].sort((a, b) => a - b);

  let proofReady = 0, argmaxMatch = 0, denseRows = 0;
  let acc3ok = 0;
  let slotServingMatch = 0, slotBeamIdMatch = 0, slotAuditMatch = 0, auctionSlots = 0;
  const misses: string[] = [];

  for (const s of slots) {
    const g = bySlot.get(s)!.sort((a, b) => a.userIndex - b.userIndex);
    const hasDense = g[0].policyDiagnostics?.objectiveQByAction && g[0].policyDiagnostics?.selectedActionIndex !== undefined;

    // acc3 presence
    if (decodeKind === 'auction') {
      const pd = g[0].policyDiagnostics;
      if (pd.slotCell && pd.decodeParams && pd.auctionAudit) acc3ok += 1;
    }

    // acc1 dense proof per row
    if (hasDense) {
      for (const r of g) {
        const pd = r.policyDiagnostics;
        denseRows += 1;
        const proof = buildModqnDenseQProof({ policyDiagnostics: pd, actionOrder: pd.candidateActionOrder, decisionActionValidityMask: pd.decisionActionValidityMask });
        if (proof.status === 'proof-ready') { proofReady += 1; if (proof.recomputedSelectedActionIndex === pd.selectedActionIndex) argmaxMatch += 1; }
      }
    }

    // acc2 auction re-decode per slot
    if (decodeKind === 'auction') {
      auctionSlots += 1;
      const params = g[0].policyDiagnostics.decodeParams;
      const nested = g.map(r => { const pd = r.policyDiagnostics; const sc = scalarizeRow(pd.objectiveQByAction, pd.objectiveWeights, pd.decisionActionValidityMask, pd.invalidActionSentinel); return Array.from(sc, x => (x === -Infinity ? null : x)); });
      const V = vMatrixFromNested(nested);
      const slotCell = g.map(r => r.policyDiagnostics.slotCell);
      const res = decodeAfPhysicalAuction(V, slotCell, params, { returnAudit: true });
      const idxOk = g.every((r, u) => res.out[u] === r.selectedServing.beamIndex);
      const beamOk = g.every((r, u) => r.policyDiagnostics.candidateActionOrder[res.out[u]]?.beamId === r.selectedServing.beamId);
      if (idxOk) slotServingMatch += 1; else if (misses.length < 4) misses.push(`slot${s}`);
      if (beamOk) slotBeamIdMatch += 1;
      const rec = g[0].policyDiagnostics.auctionAudit;
      if (eqArr(res.audit!.openedPerSlot, rec.openedPerSlot) && eqArr(res.audit!.demandedPerSlot, rec.demandedPerSlot) && res.audit!.nFallback === rec.nFallback) slotAuditMatch += 1;
    }
  }

  console.log(`  [acc1] dense proof-ready ${proofReady}/${denseRows}  argmax-anchor==selected ${argmaxMatch}/${denseRows}` + (denseRows === 0 ? '  (no dense fields — heuristic arm)' : ''));
  if (decodeKind === 'auction') {
    console.log(`  [acc2] slots=${auctionSlots}  serving-idx ${slotServingMatch}/${auctionSlots}  beamId ${slotBeamIdMatch}/${auctionSlots}  audit ${slotAuditMatch}/${auctionSlots}` + (misses.length ? `  MISS:${misses.join(',')}` : ''));
    console.log(`  [acc3] slots with slotCell+decodeParams+auctionAudit ${acc3ok}/${auctionSlots}`);
  }
  const ok = (denseRows === 0 || (proofReady === denseRows && argmaxMatch === denseRows))
    && (decodeKind !== 'auction' || (slotServingMatch === auctionSlots && slotBeamIdMatch === auctionSlots && slotAuditMatch === auctionSlots && acc3ok === auctionSlots));
  console.log(`  ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

main();
