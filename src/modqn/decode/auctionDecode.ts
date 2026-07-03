// Pure-TS port of route_b_factorial/auction_decode.py (frozen research truth).
//
// Ported semantics — every line here mirrors a numpy line; the parity gate
// (validate:modqn:decode-parity) locks bit-for-bit agreement against Python
// goldens. Where numpy vectorises, the port uses an explicit loop; the two agree
// exactly on integer decisions (argmax indices, audit counts) and the goldens
// avoid pathological sub-ULP gain ties (except EXACT-equal tie cases) so the
// linear-vs-pairwise summation order cannot flip a column (source SDD §10).
//
//   valuation                    — masked myopic rate-proxy log2(1+SNR); invalid -> -inf
//   decodeA0Argmax               — per-user masked argmax (B-column / collapse-class decode)
//   decodeAfPhysicalAuction      — greedy facility-location open-set over physical (l,c) cells
//   columnGreedyDecode           — dispatch {argmax | auction} (auction forces shiftToNonneg)

import type { AuctionAudit, DecodeParams, VMatrix } from './types';

/** numpy nan_to_num(neginf=-1e18) — the exact substitution decode_a0_argmax uses. */
const NEG_INF_FILL = -1e18;

/** float64 max — numpy nan_to_num default posinf (unreachable for our V, kept faithful). */
const POS_INF_FILL = 1.7976931348623157e308;

function nanToNumNegInf(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x === Infinity) return POS_INF_FILL;
  if (x === -Infinity) return NEG_INF_FILL;
  return x;
}

/**
 * numpy `searchsorted(sorted, key)` (side='left'): the leftmost index i in [0, n]
 * with `sorted[i] >= key`. For a key present in `sorted` this returns its index;
 * for an absent key it returns the insertion point. MUST be a sorted-array binary
 * search (NOT a Map): an invalid cell's key may be absent from `uniq`, and numpy
 * gives it an insertion point (then clipped) rather than "not found" (SDD §4-5).
 */
function searchsortedLeft(sorted: ReadonlyArray<number>, key: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** numpy `np.unique` — sorted ascending, de-duplicated (keys are exact integers). */
function uniqueSorted(keys: ReadonlyArray<number>): number[] {
  const arr = keys.slice().sort((a, b) => a - b);
  const out: number[] = [];
  for (const k of arr) {
    if (out.length === 0 || out[out.length - 1] !== k) out.push(k);
  }
  return out;
}

/**
 * valuation(states, masks, n_actions): V[u,a] = log2(1 + max(cq,0)) for masked-in
 * actions, else -inf. Ported for parity completeness only — the front-end always
 * feeds RECORDED V, never re-derives it here.
 */
export function valuation(
  channelQuality: ReadonlyArray<ReadonlyArray<number>>,
  masks: ReadonlyArray<ReadonlyArray<boolean>>,
  nActions: number,
): VMatrix {
  const u = channelQuality.length;
  const data = new Float64Array(u * nActions).fill(-Infinity);
  for (let i = 0; i < u; i += 1) {
    const cq = channelQuality[i];
    const m = masks[i];
    for (let col = 0; col < nActions; col += 1) {
      if (m[col]) data[i * nActions + col] = Math.log2(1 + Math.max(cq[col], 0));
    }
  }
  return { data, u, a: nActions };
}

/**
 * decode_a0_argmax: per-user argmax of nan_to_num(V, neginf=-1e18). Tie = first-max
 * (numpy np.argmax returns the FIRST maximum) — reproduced by the strict-`>` update.
 */
export function decodeA0Argmax(v: VMatrix): number[] {
  const out = new Array<number>(v.u);
  for (let u = 0; u < v.u; u += 1) {
    let best = -Infinity;
    let bestIdx = 0;
    const base = u * v.a;
    for (let col = 0; col < v.a; col += 1) {
      const val = nanToNumNegInf(v.data[base + col]);
      if (val > best) {
        best = val;
        bestIdx = col;
      }
    }
    out[u] = bestIdx;
  }
  return out;
}

export interface AuctionResult {
  readonly out: number[];
  readonly audit?: AuctionAudit;
}

/**
 * decode_af_physical_auction: greedy facility-location open-set over physical
 * (l = a // beamsPerSlot, c = slotCell[u,a]) cells. Opens <= kCap cells per
 * window-slot by greedy value-gain; assigns each user to its best masked action in
 * an opened cell; no-open fallback = masked argmax (env cap-bumps it).
 *
 * FOLD-2: when shiftToNonneg, the per-user outside option is the row-min finite
 * value (worst finite candidate) so the gains are invariant to per-user additive Q
 * offsets — a negative/offset learned Q cannot collapse the auction to all-fallback.
 */
export function decodeAfPhysicalAuction(
  v: VMatrix,
  slotCell: ReadonlyArray<ReadonlyArray<number>>,
  params: DecodeParams,
  opts: { returnAudit?: boolean } = {},
): AuctionResult {
  const U = v.u;
  const A = v.a;
  const C = Math.trunc(params.gridCount);
  const lW = params.lW;
  const kCap = params.kCap;
  const bps = params.beamsPerSlot;
  const returnAudit = opts.returnAudit ?? false;

  // valid = isfinite(V)
  const valid = new Uint8Array(U * A);
  let anyValid = false;
  for (let i = 0; i < U * A; i += 1) {
    if (Number.isFinite(v.data[i])) {
      valid[i] = 1;
      anyValid = true;
    }
  }

  // FOLD-2 outside option (best_val0) + stop tolerance (tol).
  const bestVal0 = new Float64Array(U); // AF branch: zeros
  let tol: number;
  if (params.shiftToNonneg && anyValid) {
    // per-user row-min over finite candidates; all-invalid row -> 0.
    for (let u = 0; u < U; u += 1) {
      let rowMin = Infinity;
      const base = u * A;
      for (let col = 0; col < A; col += 1) {
        if (valid[base + col]) {
          const val = v.data[base + col];
          if (val < rowMin) rowMin = val;
        }
      }
      bestVal0[u] = Number.isFinite(rowMin) ? rowMin : 0;
    }
    // tol from the per-user gains (V - best_val0), invariant to per-user offsets.
    let spanMax = -Infinity;
    let spanMin = Infinity;
    let anyRel = false;
    for (let u = 0; u < U; u += 1) {
      const base = u * A;
      for (let col = 0; col < A; col += 1) {
        if (valid[base + col]) {
          const rel = v.data[base + col] - bestVal0[u];
          if (Number.isFinite(rel)) {
            anyRel = true;
            if (rel > spanMax) spanMax = rel;
            if (rel < spanMin) spanMin = rel;
          }
        }
      }
    }
    const span = anyRel ? spanMax - spanMin : 1.0;
    tol = 1e-12 * Math.max(1.0, span);
  } else {
    // bestVal0 already zero-filled (AF outside option = 0)
    tol = 1e-12;
  }

  // physical column key[u,a] = (a // bps) * C + slotCell[u,a]
  const lOfA = new Int32Array(A);
  for (let col = 0; col < A; col += 1) lOfA[col] = Math.trunc(col / bps);
  const keyArr = new Array<number>(U * A);
  for (let u = 0; u < U; u += 1) {
    const row = slotCell[u];
    const base = u * A;
    for (let col = 0; col < A; col += 1) keyArr[base + col] = lOfA[col] * C + row[col];
  }

  // fu.size == 0 early exit: all users fall back to masked argmax; audit all-zero
  // (the frozen source hardcodes the zero audit vectors on this path).
  if (!anyValid) {
    const out = decodeA0Argmax(v);
    if (!returnAudit) return { out };
    return {
      out,
      audit: {
        nFallback: U,
        openedPerSlot: new Array<number>(lW).fill(0),
        demandedPerSlot: new Array<number>(lW).fill(0),
      },
    };
  }

  // uniq = unique valid keys; column -> its window-slot l.
  const validKeys: number[] = [];
  for (let i = 0; i < U * A; i += 1) if (valid[i]) validKeys.push(keyArr[i]);
  const uniq = uniqueSorted(validKeys);
  const nLc = uniq.length;
  const colsL = new Int32Array(nLc);
  for (let j = 0; j < nLc; j += 1) colsL[j] = Math.trunc(uniq[j] / C);

  // best_on[u,j] = max masked value of user u reaching physical column j (maximum.at)
  const bestOn = new Float64Array(U * nLc).fill(-Infinity);
  for (let u = 0; u < U; u += 1) {
    const base = u * A;
    for (let col = 0; col < A; col += 1) {
      if (valid[base + col]) {
        const j = searchsortedLeft(uniq, keyArr[base + col]); // exact (key in uniq)
        const idx = u * nLc + j;
        const val = v.data[base + col];
        if (val > bestOn[idx]) bestOn[idx] = val;
      }
    }
  }

  // greedy open loop
  const bestVal = Float64Array.from(bestVal0);
  const opened = new Uint8Array(nLc);
  const openCount = new Int32Array(lW);
  const gains = new Float64Array(nLc);
  for (;;) {
    for (let j = 0; j < nLc; j += 1) {
      let s = 0;
      for (let u = 0; u < U; u += 1) {
        const d = bestOn[u * nLc + j] - bestVal[u]; // -inf cell -> -inf, excluded below
        if (d > 0) s += d; // sum of max(d, 0)
      }
      gains[j] = s;
    }
    for (let j = 0; j < nLc; j += 1) {
      if (opened[j]) gains[j] = -1.0;
      else if (openCount[colsL[j]] >= kCap) gains[j] = -1.0;
    }
    // jstar = argmax(gains), first-max
    let jstar = 0;
    let best = -Infinity;
    for (let j = 0; j < nLc; j += 1) {
      if (gains[j] > best) {
        best = gains[j];
        jstar = j;
      }
    }
    if (gains[jstar] <= tol) break;
    opened[jstar] = 1;
    openCount[colsL[jstar]] += 1;
    // non-reachable users (best_on = -inf) keep their current best_val (NOT reset to 0).
    for (let u = 0; u < U; u += 1) {
      const b = bestOn[u * nLc + jstar];
      if (Number.isFinite(b) && b > bestVal[u]) bestVal[u] = b;
    }
  }

  // assignment: best masked action whose physical column is opened; else fallback.
  const fallback = decodeA0Argmax(v);
  const out = new Array<number>(U);
  const hasEligible = new Uint8Array(U);
  for (let u = 0; u < U; u += 1) {
    const base = u * A;
    let best = -Infinity;
    let bestIdx = 0;
    let has = false;
    for (let col = 0; col < A; col += 1) {
      if (!valid[base + col]) continue;
      let aj = searchsortedLeft(uniq, keyArr[base + col]);
      if (aj > nLc - 1) aj = nLc - 1; // clip(0, n_lc - 1)
      if (aj < 0) aj = 0;
      if (!opened[aj]) continue; // elig = valid & opened[all_j]
      const val = v.data[base + col]; // finite (valid)
      if (!has || val > best) {
        has = true;
        best = val;
        bestIdx = col;
      }
    }
    hasEligible[u] = has ? 1 : 0;
    out[u] = has ? bestIdx : fallback[u];
  }

  if (!returnAudit) return { out };

  // audit
  let nFallback = 0;
  for (let u = 0; u < U; u += 1) if (!hasEligible[u]) nFallback += 1;
  const openedPerSlot = Array.from(openCount);
  const perSlotCells: Set<number>[] = Array.from({ length: lW }, () => new Set<number>());
  for (let u = 0; u < U; u += 1) {
    const chosen = out[u];
    const l = Math.trunc(chosen / bps);
    if (l >= 0 && l < lW) perSlotCells[l].add(slotCell[u][chosen]);
  }
  const demandedPerSlot = perSlotCells.map((set) => set.size);
  return { out, audit: { nFallback, openedPerSlot, demandedPerSlot } };
}

/**
 * column_greedy_decode: dispatch the learned scalarized Q decode.
 * 'argmax' -> per-user argmax (B-column); 'auction' -> physical-cell auction with
 * shiftToNonneg forced true (the A-column, as the source hardcodes).
 */
export function columnGreedyDecode(
  v: VMatrix,
  slotCell: ReadonlyArray<ReadonlyArray<number>>,
  params: DecodeParams,
  decode: 'argmax' | 'auction',
): number[] {
  if (decode === 'argmax') return decodeA0Argmax(v);
  if (decode === 'auction') {
    return decodeAfPhysicalAuction(v, slotCell, { ...params, shiftToNonneg: true }).out;
  }
  throw new Error(`unknown decode=${JSON.stringify(decode)} (expected 'argmax' or 'auction')`);
}
