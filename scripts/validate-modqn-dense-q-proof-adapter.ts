#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MODQN_DENSE_Q_PROOF_SOURCE_GAP_FIELD,
  MODQN_DENSE_Q_REQUIRED_TIE_BREAK,
  buildModqnDenseQProof,
  denseQProofSourceGapField,
  rerankModqnDenseQProof,
  type ModqnPolicyDiagnostics,
} from '../src/modqn/replay-bundle';
import type { ModqnBeamReference } from '../src/modqn/replay-bundle';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function beamReference(beamIndex: number): ModqnBeamReference {
  return {
    beamId: `sat-0-beam-${beamIndex}`,
    beamIndex,
    satId: 'sat-0',
    satIndex: 0,
    localBeamIndex: beamIndex,
    validUnderDecisionMask: true,
    validUnderPostStepMask: true,
  };
}

const actionOrder = [0, 1, 2].map(beamReference);
const mask = [true, true, false] as const;

function completeDiagnostics(
  extension: Partial<ModqnPolicyDiagnostics> = {},
): ModqnPolicyDiagnostics {
  return {
    objectiveWeights: {
      throughput: 0.5,
      handover: 0.3,
      loadBalance: 0.2,
    },
    objectiveQByAction: [
      { q1Throughput: 4, q2Handover: 1, q3LoadBalance: 1 },
      { q1Throughput: 3, q2Handover: 4, q3LoadBalance: 3 },
      { q1Throughput: 9, q2Handover: 9, q3LoadBalance: 9 },
    ],
    scalarizedQByAction: [2.5, 3.3, '-inf'],
    selectedActionIndex: 1,
    tieBreak: MODQN_DENSE_Q_REQUIRED_TIE_BREAK,
    invalidActionSentinel: '-inf',
    ...extension,
  };
}

console.log('validate-modqn-dense-q-proof-adapter');

{
  const result = buildModqnDenseQProof({
    policyDiagnostics: undefined,
    actionOrder,
    decisionActionValidityMask: mask,
  });
  assert.equal(result.status, 'source-gap', 'missing diagnostics fail closed');
  assert.equal(result.sourceGapField, MODQN_DENSE_Q_PROOF_SOURCE_GAP_FIELD);
  assert.ok(result.reasons.some(reason => reason.includes('policyDiagnostics')), 'gap names missing diagnostics');
}

{
  const result = buildModqnDenseQProof({
    policyDiagnostics: {
      objectiveWeights: { throughput: 0.5, handover: 0.3, loadBalance: 0.2 },
      topCandidates: [
        { ...beamReference(1), objectiveQ: { throughput: 3, handover: 4, loadBalance: 3 } },
      ],
    },
    actionOrder,
    decisionActionValidityMask: mask,
  });
  assert.equal(result.status, 'source-gap', 'top-K objectiveQ does not unlock dense-Q proof');
  assert.equal(result.topKObjectiveQAvailable, true, 'top-K availability is only diagnostic metadata');
  assert.equal(result.legacyScalarizedDenseAvailable, false);
}

{
  const result = buildModqnDenseQProof({
    policyDiagnostics: {
      objectiveWeights: { throughput: 0.5, handover: 0.3, loadBalance: 0.2 },
      denseActionScores: [2.5, 3.3, -1e9],
      actionScoreValidityMask: [true, true, false],
    },
    actionOrder,
    decisionActionValidityMask: mask,
  });
  assert.equal(result.status, 'source-gap', 'scalarized dense scores alone do not unlock proof');
  assert.equal(result.legacyScalarizedDenseAvailable, true, 'legacy scalarized dense availability is tracked');
}

{
  const result = buildModqnDenseQProof({
    policyDiagnostics: completeDiagnostics(),
    actionOrder,
    decisionActionValidityMask: mask,
  });
  assert.equal(result.status, 'proof-ready', 'complete dense-Q diagnostics unlock proof');
  if (result.status !== 'proof-ready') throw new Error('proof should be ready');
  assert.equal(result.selfCheck.status, 'passed');
  assert.equal(result.selectedActionIndex, 1);
  assert.equal(result.recomputedSelectedActionIndex, 1);
  assert.equal(result.validActionCount, 2);
  assert.equal(result.actions[1]?.objectiveQ.q1Throughput, 3);

  const counterfactual = rerankModqnDenseQProof(result, {
    throughput: 0.95,
    handover: 0.03,
    loadBalance: 0.02,
  });
  assert.equal(counterfactual.selectedActionIndex, 0, 'counterfactual can re-rank exported Q');
  assert.equal(counterfactual.isRecordedSelection, false, 'counterfactual does not rewrite recorded decision');
  assert.equal(result.selectedActionIndex, 1, 'recorded selected action remains immutable');
}

{
  const result = buildModqnDenseQProof({
    policyDiagnostics: completeDiagnostics({ selectedActionIndex: 0 }),
    actionOrder,
    decisionActionValidityMask: mask,
  });
  assert.equal(result.status, 'source-gap', 'original-weight mismatch blocks proof');
  assert.ok(
    result.reasons.some(reason => reason.includes('self-check')),
    'self-check failure is named as the source gap reason',
  );
}

{
  const result = buildModqnDenseQProof({
    policyDiagnostics: completeDiagnostics({ objectiveQByAction: completeDiagnostics().objectiveQByAction?.slice(0, 2) }),
    actionOrder,
    decisionActionValidityMask: mask,
  });
  assert.equal(result.status, 'source-gap', 'partial dense-Q action coverage blocks proof');
}

assert.equal(denseQProofSourceGapField(), 'diagnostics.denseQPolicy');

const denseQSource = read('src/modqn/replay-bundle/denseQProof.ts');
assert.ok(
  denseQSource.includes('objectiveQByAction does not cover the full action order'),
  'adapter hard-fails partial objectiveQ coverage',
);
assert.ok(
  denseQSource.includes('original-weight self-check does not reproduce selectedActionIndex'),
  'adapter names original-weight self-check failure',
);
assert.ok(
  !denseQSource.includes('reScalarize('),
  'dense-Q proof adapter must not use legacy top-K reScalarize',
);

const decisionVizSource = read('src/ui/modqn-training/DecisionVizPanel.tsx');
assert.ok(
  decisionVizSource.includes('buildModqnDenseQProofFromReplayRow'),
  'DecisionVizPanel consumes dense-Q proof adapter',
);
assert.ok(
  decisionVizSource.includes('data-dense-q-proof-status="source-gap"'),
  'DecisionVizPanel renders dense-Q source-gap state',
);
assert.ok(
  decisionVizSource.includes('dense scalarized scores (not proof)'),
  'DecisionVizPanel labels scalarized dense scores as not proof',
);

const sourceGaps = read('src/modqn/replay-source-gaps/sourceGaps.ts');
assert.ok(sourceGaps.includes('diagnostics.denseQPolicy'), 'dense-Q source gap is registered');
assert.ok(sourceGaps.includes('traffic.queueRows'), 'producer queue rows source gap is registered');

console.log('PASS: MODQN dense-Q proof adapter fails closed unless full dense per-action Q passes self-check');
