// Decode-engine value types — the pure-TS port of the route-B factorial decode
// primitives (modqn-paper-reproduction/.../route_b_factorial/auction_decode.py).
//
// PURITY RULE (enforced by validate:modqn:decode-parity): NOTHING in
// src/modqn/decode/ may import React / three / viz/ / app/ / scene/. This module
// is decode-time arithmetic on RECORDED dense Q — no render, no runtime state.
//
// Numeric representation: the valuation matrix V is a row-major Float64Array with
// explicit (U, A) dims. JS `number` IS IEEE-754 float64, the same precision numpy
// uses for these arrays, so argmax / auction decisions reproduce bit-for-bit.
// Invalid (masked-off / unreachable) actions are represented as `-Infinity`
// (numpy `-np.inf`); the decode reproduces numpy's `nan_to_num(neginf=-1e18)`
// substitution internally before any argmax.

/** Row-major (U × A) valuation matrix. `data[u * a + col]` is V[u][col]. */
export interface VMatrix {
  readonly data: Float64Array;
  /** number of users (rows) */
  readonly u: number;
  /** number of actions (columns) */
  readonly a: number;
}

/** Read V[u][col]. No bounds check (hot path); callers stay in range. */
export function vAt(v: VMatrix, u: number, col: number): number {
  return v.data[u * v.a + col];
}

/**
 * Build a VMatrix from a nested array. JSON has no `Infinity`, so a golden encodes
 * an invalid cell as `null` — decoded here to `-Infinity`. Ragged rows throw.
 */
export function vMatrixFromNested(
  rows: ReadonlyArray<ReadonlyArray<number | null>>,
): VMatrix {
  const u = rows.length;
  const a = u > 0 ? rows[0].length : 0;
  const data = new Float64Array(u * a);
  for (let i = 0; i < u; i += 1) {
    if (rows[i].length !== a) {
      throw new Error(`VMatrix row ${i} has length ${rows[i].length}, expected ${a}`);
    }
    for (let j = 0; j < a; j += 1) {
      const x = rows[i][j];
      data[i * a + j] = x === null ? -Infinity : x;
    }
  }
  return { data, u, a };
}

/** Encode a VMatrix back to a nested `(number|null)[][]` (null = -Infinity) for goldens. */
export function vMatrixToNested(v: VMatrix): (number | null)[][] {
  const rows: (number | null)[][] = [];
  for (let u = 0; u < v.u; u += 1) {
    const row: (number | null)[] = [];
    for (let col = 0; col < v.a; col += 1) {
      const x = vAt(v, u, col);
      row.push(x === -Infinity ? null : x);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * The decode parameters carried by an export (H2 contract). `beamsPerSlot` is the
 * route-B constant 7 — the source hardcodes `a // 7`; it is parametrised here for
 * the H2 flexible-window future but every parity golden is generated at 7.
 */
export interface DecodeParams {
  /** number of window-slots l (length of the opened/demanded audit vectors) */
  readonly lW: number;
  /** max physical cells opened per window-slot */
  readonly kCap: number;
  /** grid cell count C (physical column key = l * C + slotCell) */
  readonly gridCount: number;
  /** beams per window-slot (route-B = 7) */
  readonly beamsPerSlot: number;
  /** FOLD-2: shift the finite valuation to per-user row-min = 0 before the auction */
  readonly shiftToNonneg: boolean;
}

/** Auction decode audit (parity-checked field-for-field against the numpy source). */
export interface AuctionAudit {
  /** users assigned via no-open fallback (masked argmax) */
  readonly nFallback: number;
  /** physical cells opened per window-slot l (length lW) */
  readonly openedPerSlot: number[];
  /** distinct chosen cells per window-slot l (length lW) */
  readonly demandedPerSlot: number[];
}

/** Canonical three-objective weight vector. */
export interface ObjectiveWeights {
  readonly throughput: number;
  readonly handover: number;
  readonly loadBalance: number;
}

/** Canonical per-action three-objective Q. */
export interface ObjectiveQ {
  readonly q1Throughput: number;
  readonly q2Handover: number;
  readonly q3LoadBalance: number;
}

// ---- golden-file schema (produced by scripts/gen-decode-goldens.py) --------------

export type JsonV = ReadonlyArray<ReadonlyArray<number | null>>;

export interface DecodeGoldenProvenance {
  /** producer repo `git rev-parse HEAD` at generation time */
  readonly producerRev: string;
  /** source module path relative to the producer repo root */
  readonly sourcePath: string;
  /** ISO-8601 generation timestamp */
  readonly generatedAt: string;
  /** stable case identifier (== filename stem) */
  readonly caseId: string;
  /** RNG seed for the random-scale case, else null */
  readonly generatorSeed?: number | null;
}

export type DecodeGoldenKind = 'valuation' | 'argmax' | 'auction' | 'scalarize-argmax';

export interface DecodeGolden {
  readonly provenance: DecodeGoldenProvenance;
  readonly kind: DecodeGoldenKind;
  readonly note?: string;
  /** auction only */
  readonly params?: DecodeParams;
  readonly inputs: {
    /** argmax / auction */
    readonly V?: JsonV;
    /** auction: (U × A) physical grid cell per action */
    readonly slotCell?: ReadonlyArray<ReadonlyArray<number>>;
    /** valuation: (U × A) channel quality */
    readonly channelQuality?: ReadonlyArray<ReadonlyArray<number>>;
    /** valuation: (U × A) validity mask */
    readonly masks?: ReadonlyArray<ReadonlyArray<boolean>>;
    /** valuation: action count */
    readonly nActions?: number;
    /** scalarize-argmax: (U × A) per-action three-objective Q */
    readonly objectiveQByAction?: ReadonlyArray<ReadonlyArray<Record<string, number>>>;
    /** scalarize-argmax: per-user weight vectors (or one shared vector) */
    readonly objectiveWeights?: Record<string, number> | ReadonlyArray<Record<string, number>>;
    /** scalarize-argmax: (U × A) validity mask */
    readonly mask?: ReadonlyArray<ReadonlyArray<boolean>>;
    /** scalarize-argmax: export sentinel fill value (mask stays authoritative) */
    readonly invalidActionSentinel?: number;
  };
  readonly expected: {
    /** argmax / scalarize-argmax */
    readonly argmaxOut?: number[];
    /** auction */
    readonly auctionOut?: number[];
    /** auction */
    readonly audit?: AuctionAudit;
    /** valuation expected V (null = -Infinity) */
    readonly V?: JsonV;
    /** scalarize-argmax expected V rows (null = -Infinity) */
    readonly scalarized?: JsonV;
  };
}
