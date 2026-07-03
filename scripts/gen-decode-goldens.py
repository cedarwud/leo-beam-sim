#!/usr/bin/env python3
"""Golden generator for validate:modqn:decode-parity.

Imports the FROZEN producer decode (modqn-paper-reproduction/.../route_b_factorial/
auction_decode.py) READ-ONLY and emits per-case golden JSONs into
src/modqn/decode/fixtures/goldens/. Each golden carries a provenance header
(producer git rev + source path + timestamp + caseId) so the gate can reject a
hand-edited golden. This script never writes anything into the producer repo.

Manual step (NOT a CI step): the decode is frozen, so goldens are regenerated only
if the source decode changes (expected: never). Run:

    python3 scripts/gen-decode-goldens.py

-inf encoding: JSON has no Infinity, so an invalid/unreachable cell is written as
`null` (decoded back to -Infinity by the TS loader).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

import numpy as np

# ---- read-only import of the frozen producer decode ------------------------------
PRODUCER_REPO = "/home/u24/papers/modqn-paper-reproduction"
SOURCE_REL = "src/modqn_paper_reproduction/route_b_factorial/auction_decode.py"
SOURCE_DIR = os.path.join(PRODUCER_REPO, os.path.dirname(SOURCE_REL))
if not os.path.isfile(os.path.join(PRODUCER_REPO, SOURCE_REL)):
    sys.exit(f"producer decode source not found: {os.path.join(PRODUCER_REPO, SOURCE_REL)}")
sys.path.insert(0, SOURCE_DIR)  # import the module file directly (bypasses the package __init__)
import auction_decode  # noqa: E402  (read-only; never mutated)

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(REPO_ROOT, "src", "modqn", "decode", "fixtures", "goldens")

NEG_INF = -np.inf


def producer_rev() -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", PRODUCER_REPO, "rev-parse", "HEAD"], text=True
        ).strip()
    except Exception:  # pragma: no cover - defensive
        return "UNKNOWN"


PRODUCER_REV = producer_rev()
GENERATED_AT = datetime.now(timezone.utc).isoformat()


def jnum(x):
    """float64 -> JSON number, with -inf -> null (JSON has no Infinity)."""
    xf = float(x)
    if xf == float("-inf"):
        return None
    if xf != xf or xf == float("inf"):
        raise ValueError(f"unexpected non-(-inf) special value in golden: {xf}")
    return xf


def jvec(v):
    return [jnum(x) for x in np.asarray(v).ravel().tolist()]


def jmat(m):
    m = np.asarray(m)
    return [[jnum(x) for x in row] for row in m.tolist()]


def provenance(case_id: str, seed=None):
    p = {
        "producerRev": PRODUCER_REV,
        "sourcePath": SOURCE_REL,
        "generatedAt": GENERATED_AT,
        "caseId": case_id,
    }
    if seed is not None:
        p["generatorSeed"] = int(seed)
    return p


def write_case(case: dict):
    case_id = case["provenance"]["caseId"]
    path = os.path.join(OUT_DIR, f"{case_id}.json")
    with open(path, "w") as f:
        json.dump(case, f, indent=2, sort_keys=False)
        f.write("\n")
    kind = case["kind"]
    print(f"  wrote {case_id}.json ({kind})")


# ---- case builders ----------------------------------------------------------------


def valuation_case(case_id, channel_quality, masks, n_actions, note=""):
    class _State:
        def __init__(self, cq):
            self.channel_quality = cq

    class _Mask:
        def __init__(self, m):
            self.mask = np.asarray(m, dtype=bool)

    states = [_State(np.asarray(cq, dtype=np.float64)) for cq in channel_quality]
    ms = [_Mask(m) for m in masks]
    V = auction_decode.valuation(states, ms, n_actions)
    return {
        "provenance": provenance(case_id),
        "kind": "valuation",
        "note": note,
        "inputs": {
            "channelQuality": [list(map(float, cq)) for cq in channel_quality],
            "masks": [list(map(bool, m)) for m in masks],
            "nActions": int(n_actions),
        },
        "expected": {"V": jmat(V)},
    }


def argmax_case(case_id, V, note=""):
    V = np.asarray(V, dtype=np.float64)
    out = auction_decode.decode_a0_argmax(V)
    return {
        "provenance": provenance(case_id),
        "kind": "argmax",
        "note": note,
        "inputs": {"V": jmat(V)},
        "expected": {"argmaxOut": [int(x) for x in out.tolist()]},
    }


def scalarize_argmax_case(case_id, objective_q, weights, mask, sentinel, note=""):
    """weights: single dict (shared) or list of per-user dicts. Computes V = w.Q
    (masked -> -inf) with numpy, then decode_a0_argmax — validates the TS
    scalarize + argmax path against an independent numpy computation."""
    U = len(objective_q)
    A = len(objective_q[0])
    shared = isinstance(weights, dict)
    V = np.full((U, A), NEG_INF, dtype=np.float64)
    for u in range(U):
        w = weights if shared else weights[u]
        for a in range(A):
            if mask[u][a]:
                q = objective_q[u][a]
                V[u, a] = (
                    w["throughput"] * q["q1Throughput"]
                    + w["handover"] * q["q2Handover"]
                    + w["loadBalance"] * q["q3LoadBalance"]
                )
    out = auction_decode.decode_a0_argmax(V)
    return {
        "provenance": provenance(case_id),
        "kind": "scalarize-argmax",
        "note": note,
        "inputs": {
            "objectiveQByAction": objective_q,
            "objectiveWeights": weights,
            "mask": [[bool(x) for x in row] for row in mask],
            "invalidActionSentinel": sentinel,
        },
        "expected": {"scalarized": jmat(V), "argmaxOut": [int(x) for x in out.tolist()]},
    }


def auction_case(case_id, V, slot_cell, l_w, k_cap, grid_count, shift, note="", seed=None):
    V = np.asarray(V, dtype=np.float64)
    slot_cell = np.asarray(slot_cell, dtype=np.int64)
    out, audit = auction_decode.decode_af_physical_auction(
        V, slot_cell, l_w, k_cap, grid_count, shift_to_nonneg=shift, return_audit=True
    )
    return {
        "provenance": provenance(case_id, seed=seed),
        "kind": "auction",
        "note": note,
        "params": {
            "lW": int(l_w),
            "kCap": int(k_cap),
            "gridCount": int(grid_count),
            "beamsPerSlot": 7,  # source hardcodes a // 7
            "shiftToNonneg": bool(shift),
        },
        "inputs": {"V": jmat(V), "slotCell": [[int(x) for x in row] for row in slot_cell.tolist()]},
        "expected": {
            "auctionOut": [int(x) for x in out.tolist()],
            "audit": {
                "nFallback": int(audit["n_fallback"]),
                "openedPerSlot": [int(x) for x in audit["opened_per_slot"]],
                "demandedPerSlot": [int(x) for x in audit["demanded_per_slot"]],
            },
        },
    }


NI = None  # readability alias in literal V rows (JSON null == -inf)


def build_cases():
    cases = []

    # --- valuation (parity completeness) ---
    cases.append(valuation_case(
        "valuation-basic",
        channel_quality=[[3.0, 0.0, -2.0, 7.0], [1.0, 1.0, 1.0, 1.0], [0.5, 10.0, -1.0, 0.0]],
        masks=[[True, True, False, True], [True, False, True, False], [False, True, True, True]],
        n_actions=4,
        note="log2(1+max(cq,0)); masked-off -> -inf; negative cq clamps to 0",
    ))

    # --- per-user masked argmax (first-max tie + all-inf row) ---
    cases.append(argmax_case(
        "argmax-basic",
        V=[[1.0, 3.0, 3.0, NEG_INF], [NEG_INF, NEG_INF, 2.0, 2.0], [NEG_INF, NEG_INF, NEG_INF, NEG_INF]],
        note="first-max tie (row0 -> idx1, row1 -> idx2); all-inf row -> idx0",
    ))

    # --- scalarize + argmax under 3 NON-recorded omega (dense-q window omega is
    #     constant, so real fixture b cannot exercise omega variation: SDD §10) ---
    oq = [
        [
            {"q1Throughput": 10.0, "q2Handover": 1.0, "q3LoadBalance": 1.0},
            {"q1Throughput": 1.0, "q2Handover": 10.0, "q3LoadBalance": 1.0},
            {"q1Throughput": 1.0, "q2Handover": 1.0, "q3LoadBalance": 10.0},
            {"q1Throughput": 4.0, "q2Handover": 4.0, "q3LoadBalance": 4.0},
        ],
        [
            {"q1Throughput": 2.0, "q2Handover": 8.0, "q3LoadBalance": 5.0},
            {"q1Throughput": 9.0, "q2Handover": 1.0, "q3LoadBalance": 1.0},
            {"q1Throughput": 3.0, "q2Handover": 3.0, "q3LoadBalance": 9.0},
            {"q1Throughput": 5.0, "q2Handover": 5.0, "q3LoadBalance": 5.0},
        ],
    ]
    mask2 = [[True, True, True, True], [True, True, False, True]]  # user1 a2 invalid
    cases.append(scalarize_argmax_case(
        "scalarize-argmax-omega-throughput", oq,
        {"throughput": 1.0, "handover": 0.0, "loadBalance": 0.0}, mask2, -1_000_000_000,
        note="throughput-only omega",
    ))
    cases.append(scalarize_argmax_case(
        "scalarize-argmax-omega-handover", oq,
        {"throughput": 0.0, "handover": 1.0, "loadBalance": 0.0}, mask2, -1_000_000_000,
        note="handover-only omega (mask makes user1 a2 -inf, not sentinel-weighted)",
    ))
    cases.append(scalarize_argmax_case(
        "scalarize-argmax-omega-balanced", oq,
        {"throughput": 0.2, "handover": 0.3, "loadBalance": 0.5}, mask2, -1_000_000_000,
        note="loadBalance-heavy omega",
    ))

    # --- auction: basic 2-slot open, k_cap contrast (same V) ---
    # A=14 (2 window-slots at bps=7), C=3 cells. slotCell[u,a] = (a % 7) % 3.
    A = 14
    C = 3
    slot_cell_grid = [[(a % 7) % C for a in range(A)] for _ in range(6)]
    rs = np.random.RandomState(4242)
    base = rs.uniform(0.0, 5.0, size=(6, A))
    mask_basic = rs.uniform(size=(6, A)) < 0.6  # ~60% valid
    # guarantee each user has >= 2 valid actions
    for u in range(6):
        if mask_basic[u].sum() < 2:
            mask_basic[u][:2] = True
    Vb = np.where(mask_basic, base, NEG_INF)
    cases.append(auction_case(
        "auction-basic-kcap1", Vb, slot_cell_grid, l_w=2, k_cap=1, grid_count=C, shift=True,
        note="2 window-slots x 3 cells, U=6, k_cap=1", seed=4242,
    ))
    cases.append(auction_case(
        "auction-basic-kcap2", Vb, slot_cell_grid, l_w=2, k_cap=2, grid_count=C, shift=True,
        note="same V, k_cap=2 opens more cells", seed=4242,
    ))
    cases.append(auction_case(
        "auction-basic-kcap-unbounded", Vb, slot_cell_grid, l_w=2, k_cap=99, grid_count=C, shift=True,
        note="k_cap >= column count == effectively unbounded", seed=4242,
    ))
    cases.append(auction_case(
        "auction-basic-kcap0", Vb, slot_cell_grid, l_w=2, k_cap=0, grid_count=C, shift=True,
        note="k_cap=0 -> every column capped -> all fallback", seed=4242,
    ))

    # --- negative Q: shift ON opens, shift OFF collapses to all-fallback (FOLD-2) ---
    slot4 = [[0, 1, 0, 1], [0, 1, 0, 1]]  # C=2, single slot (bps=7 -> all slot0)
    Vneg = [[-1.0, -9.0, NEG_INF, NEG_INF], [-9.0, -1.0, NEG_INF, NEG_INF]]
    cases.append(auction_case(
        "auction-negq-shift-on", Vneg, slot4, l_w=1, k_cap=2, grid_count=2, shift=True,
        note="all-negative Q, shift ON: per-user row-min outside option opens cells",
    ))
    cases.append(auction_case(
        "auction-negq-shift-off", Vneg, slot4, l_w=1, k_cap=2, grid_count=2, shift=False,
        note="SAME V, shift OFF: outside option 0 >= every gain -> all fallback (the FOLD-2 bug)",
    ))

    # --- per-user additive offset invariance (shift ON) ---
    Vbaseoff = [[3.0, 1.0, NEG_INF, NEG_INF], [1.0, 3.0, NEG_INF, NEG_INF]]
    Voff = [[103.0, 101.0, NEG_INF, NEG_INF], [1.0, 3.0, NEG_INF, NEG_INF]]  # user0 += 100
    cases.append(auction_case(
        "auction-offset-base", Vbaseoff, slot4, l_w=1, k_cap=2, grid_count=2, shift=True,
        note="baseline for per-user offset invariance",
    ))
    cases.append(auction_case(
        "auction-offset-shifted", Voff, slot4, l_w=1, k_cap=2, grid_count=2, shift=True,
        note="user0 row += 100; assignment must equal auction-offset-base (shift-invariant)",
    ))

    # --- exact tie in gains -> first-max column (lower key) ---
    Vtie = [[10.0, 2.0, NEG_INF, NEG_INF], [2.0, 10.0, NEG_INF, NEG_INF]]
    cases.append(auction_case(
        "auction-tie-gains", Vtie, slot4, l_w=1, k_cap=2, grid_count=2, shift=True,
        note="col0 gain == col1 gain (exactly 8) -> argmax opens the lower-key column first",
    ))

    # --- one all-inf row (that user falls back) ---
    Vonerowinf = [
        [5.0, 1.0, NEG_INF, NEG_INF],
        [1.0, 5.0, NEG_INF, NEG_INF],
        [NEG_INF, NEG_INF, NEG_INF, NEG_INF],
    ]
    cases.append(auction_case(
        "auction-one-row-inf", Vonerowinf, [[0, 1, 0, 1]] * 3, l_w=1, k_cap=2, grid_count=2, shift=True,
        note="user2 all-inf -> masked-argmax fallback (idx0); n_fallback counts it",
    ))

    # --- whole table -inf (fu.size == 0 early-exit path) ---
    Vallinf = [[NEG_INF] * 4, [NEG_INF] * 4]
    cases.append(auction_case(
        "auction-all-inf", Vallinf, slot4, l_w=1, k_cap=2, grid_count=2, shift=True,
        note="fu.size==0 early exit: all fallback (idx0), audit vectors hardcoded to zero",
    ))

    # --- invalid key NOT in uniq (searchsorted insertion-point + clip path, SDD §10) ---
    # cell 2 appears ONLY on invalid actions, so it never enters uniq={0,1}.
    slot_gap = [[0, 1, 2, 2], [0, 1, 2, 2]]
    Vgap = [[5.0, 3.0, NEG_INF, NEG_INF], [3.0, 5.0, NEG_INF, NEG_INF]]
    cases.append(auction_case(
        "auction-searchsorted-gap", Vgap, slot_gap, l_w=1, k_cap=2, grid_count=3, shift=True,
        note="invalid actions map to cell2 (never in uniq) -> searchsorted insertion point + clip; masked out",
    ))

    # --- scale case: U=100, A=28 (4 slots), seeded random V ---
    U = 100
    A2 = 28
    Cs = 12
    slot_cell_big = [[(a % 7) % Cs + ((a // 7) * 0) for a in range(A2)] for _ in range(U)]
    rss = np.random.RandomState(90210)
    # per-user random cell layout for a bit more structure
    slot_cell_big = rss.randint(0, Cs, size=(U, A2)).tolist()
    bigbase = rss.normal(0.0, 3.0, size=(U, A2))
    bigmask = rss.uniform(size=(U, A2)) < 0.8
    for u in range(U):
        if bigmask[u].sum() < 2:
            bigmask[u][:2] = True
    Vbig = np.where(bigmask, bigbase, NEG_INF)
    cases.append(auction_case(
        "auction-scale-u100", Vbig, slot_cell_big, l_w=4, k_cap=2, grid_count=Cs, shift=True,
        note="U=100, A=28 (4 slots x 7 beams), random V/mask/slotCell, seed 90210", seed=90210,
    ))

    return cases


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"producer rev {PRODUCER_REV}  source {SOURCE_REL}")
    print(f"writing goldens -> {os.path.relpath(OUT_DIR, REPO_ROOT)}")
    cases = build_cases()
    for case in cases:
        write_case(case)
    print(f"done: {len(cases)} golden case(s)")


if __name__ == "__main__":
    main()
