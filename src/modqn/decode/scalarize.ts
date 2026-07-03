// ω scalarizer — the front-end re-weighting entry point.
//
// V[u][a] = ω_thr·q1[a] + ω_ho·q2[a] + ω_lb·q3[a]  over the per-user
// objectiveQByAction. INVALID actions (mask=false) become `-Infinity` — driven by
// the MASK, NOT by the export sentinel value: the sentinel (-1e9) is only a JSON
// fill for an invalid slot; if it leaked into the weighted sum it would stay a
// finite, comparable number and could win an argmax. Mask is authoritative.
//
// Key aliases mirror src/modqn/replay-bundle/denseQProof.ts so this reads the real
// producer export shape (weights `r1Throughput/r2Handover/r3LoadBalance`, Q
// `q1Throughput/q2Handover/q3LoadBalance`) and the SDD canonical shape alike.

import type { ObjectiveQ, ObjectiveWeights, VMatrix } from './types';

function readNumber(
  source: Record<string, number> | undefined,
  keys: readonly string[],
  label: string,
): number {
  if (source) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
  }
  throw new Error(`scalarize: missing ${label} (tried keys ${keys.join(', ')})`);
}

/** Normalise a weight record to the canonical {throughput, handover, loadBalance}. */
export function normalizeWeights(weights: Record<string, number>): ObjectiveWeights {
  return {
    throughput: readNumber(weights, ['throughput', 'q1Throughput', 'r1Throughput'], 'throughput weight'),
    handover: readNumber(weights, ['handover', 'q2Handover', 'r2Handover'], 'handover weight'),
    loadBalance: readNumber(weights, ['loadBalance', 'q3LoadBalance', 'r3LoadBalance'], 'loadBalance weight'),
  };
}

/** Normalise a per-action Q record to the canonical {q1Throughput, q2Handover, q3LoadBalance}. */
export function normalizeObjectiveQ(objectiveQ: Record<string, number>): ObjectiveQ {
  return {
    q1Throughput: readNumber(objectiveQ, ['q1Throughput', 'r1Throughput', 'throughput'], 'q1Throughput'),
    q2Handover: readNumber(objectiveQ, ['q2Handover', 'r2Handover', 'handover'], 'q2Handover'),
    q3LoadBalance: readNumber(objectiveQ, ['q3LoadBalance', 'r3LoadBalance', 'loadBalance'], 'q3LoadBalance'),
  };
}

/**
 * Scalarize ONE user's dense per-action Q under a weight vector.
 * `mask[a] === false` -> -Infinity (mask authoritative; `sentinel` accepted for API
 * symmetry with the export but never entered into the weighted sum).
 */
export function scalarizeRow(
  objectiveQByAction: ReadonlyArray<Record<string, number>>,
  weights: Record<string, number>,
  mask: ReadonlyArray<boolean>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sentinel?: number,
): Float64Array {
  const a = objectiveQByAction.length;
  if (mask.length !== a) {
    throw new Error(`scalarize: mask length ${mask.length} != action count ${a}`);
  }
  const w = normalizeWeights(weights);
  const out = new Float64Array(a);
  for (let col = 0; col < a; col += 1) {
    if (!mask[col]) {
      out[col] = -Infinity;
      continue;
    }
    const q = normalizeObjectiveQ(objectiveQByAction[col]);
    out[col] = w.throughput * q.q1Throughput
      + w.handover * q.q2Handover
      + w.loadBalance * q.q3LoadBalance;
  }
  return out;
}

/**
 * Scalarize a (U × A) dense-Q matrix into a VMatrix. `weights` may be one shared
 * vector or one vector per user. `masks` is (U × A).
 */
export function scalarizeMatrix(
  objectiveQByActionRows: ReadonlyArray<ReadonlyArray<Record<string, number>>>,
  weights: Record<string, number> | ReadonlyArray<Record<string, number>>,
  masks: ReadonlyArray<ReadonlyArray<boolean>>,
  sentinel?: number,
): VMatrix {
  const u = objectiveQByActionRows.length;
  const a = u > 0 ? objectiveQByActionRows[0].length : 0;
  const perUser = Array.isArray(weights);
  const data = new Float64Array(u * a);
  for (let i = 0; i < u; i += 1) {
    const rowWeights = perUser
      ? (weights as ReadonlyArray<Record<string, number>>)[i]
      : (weights as Record<string, number>);
    const row = scalarizeRow(objectiveQByActionRows[i], rowWeights, masks[i], sentinel);
    if (row.length !== a) {
      throw new Error(`scalarize: row ${i} length ${row.length} != ${a}`);
    }
    data.set(row, i * a);
  }
  return { data, u, a };
}
