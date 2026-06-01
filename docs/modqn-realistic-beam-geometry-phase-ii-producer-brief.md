# Phase II Producer Worker Brief — Realistic Beam Geometry (Earth-Fixed Cells)

**Date:** 2026-05-28
**Author:** leo-beam-sim controller (Claude), drafted read-only as a cross-repo handoff.
**Target repo / executor:** `/home/u24/papers/modqn-paper-reproduction` — run from a controller session **rooted in that repo**, NOT from leo-beam-sim.
**Parent SDD:** `leo-beam-sim/docs/modqn-realistic-beam-geometry-cross-repo-sdd.md` (read §2–§7, §9 Phase II block).
**Status of upstream:** Phase I (leo-beam-sim viz consumer) is COMPLETE (S1–S7b shipped on branch `modqn-visibility-fix`, commit 29d4fc6, not pushed). Phase II = producer Python. Phase III = heavy re-train (Ubuntu server). Phase IV = Multi-Catfish.

**2026-06-01 serving-authority update:** the serving-count and `K=28`
language below is superseded by
`leo-beam-sim/docs/modqn-walker-serving-authority-sdd.md`. Formal MODQN
serving count is `L=2..8`, `L=4` is the paper-faithful baseline, `L=8` is the
paper-supported sweep max / rich demo, and any 28-cell cap in the consumer is a
display-only cell-overlay cap unless the producer explicitly exports that
scheduler contract. Do not use this brief to introduce formal `L=12` or fixed
global `K=28` action truth.

---

## 0. Why this brief exists / how to use it

`leo-beam-sim/CLAUDE.md` §2 forbids editing `modqn-paper-reproduction` from the leo-beam-sim session, and the memory-bridge rule says only that repo's own controller updates its memory. So Phase II must be driven from a `modqn-paper-reproduction` session. This brief is the cross-repo handoff: it carries the parity contract and the corrected module map so the producer session does not have to rediscover them.

**First actions in the producer session (before any code):**
1. Read `modqn-paper-reproduction/AGENTS.md` + `CLAUDE.md` + its `.agent-memory/MEMORY.md` (the producer's own memory store) + every active-priority entry.
2. Read the parent SDD in leo-beam-sim (read-only cross-repo is fine): `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md`.
3. Read the algorithm SDD chain it must integrate with: `docs/research/angle-aware-ee-multicatfish/00-architecture-sdd.md`, `01-v2.2-ee-objective-surface-sdd.md`, `03-multicatfish-role-specialist-integration-sdd.md`.
4. Read the **parity oracle** (the math Phase II must reproduce exactly — see §2).

---

## 1. Corrected module map (SDD §5.1 paths are STALE)

The SDD §5.1 guessed `runtime/cell_layout.py`, `runtime/cell_scheduler.py`, `runtime/channel_gain.py`, `state/state_encoder.py`. The real repo layout (verified 2026-05-28) is different. Use these real paths:

| SDD §5.1 guess | REAL target | Action |
|---|---|---|
| `runtime/cell_layout.py` (new) | `src/modqn_paper_reproduction/env/cell_layout.py` (new) | Create beside `env/channel.py`, `env/beam.py`, `env/orbit.py`. |
| `runtime/cell_scheduler.py` (new) | `src/modqn_paper_reproduction/env/cell_scheduler.py` (new) | Same dir. |
| `runtime/channel_gain.py` (modify) | `src/modqn_paper_reproduction/env/channel.py` (modify) | `compute_channel()` currently = `FSPL * A(d) * eta` (no off-axis term). Add `G_T(theta)` factor here. |
| `runtime/handover.py` (modify) | locate in producer (HO cost logic is in `env/step.py` / `objective_math.py` / contracts — grep `phi1`/`phi2`). | Add cell-reassignment HO trigger. |
| `state/state_encoder.py` (modify) | `src/modqn_paper_reproduction/runtime/state_encoding.py` (modify) | **EXTEND the existing encoder — do NOT create a new `state_encoder.py`.** |
| satellite positions | `src/modqn_paper_reproduction/env/orbit.py` (exists) | Source of sat lat/lon/alt + elevation for the serving-set + visibility. |
| `configs/...realistic-cells.resolved.yaml` (new) | `configs/modqn-paper-baseline.realistic-cells.resolved.yaml` (new) | New track; retire `ASSUME-MODQN-REP-002` with audit note. |
| `tests/test_cell_layout.py` (new) | `tests/test_cell_layout.py` + `tests/test_cell_scheduler.py` (new) | Repo uses flat `tests/test_*.py` + `tests/fixtures/`. |

Env package: `src/modqn_paper_reproduction/env/{beam,channel,orbit,power_surface,step,step_types}.py`. The repo uses `ASSUME-MODQN-REP-###` provenance tags + frozen-dataclass configs — match that style for all new geometry assumptions.

---

## 2. Parity contract — reproduce leo-beam-sim's shipped TS math EXACTLY

Phase I shipped the cell layout + scheduler in TypeScript already. The producer Python must produce **identical** cell centers and slot assignments for the same inputs, otherwise the consumer viz and the trained policy disagree. Read these two files as the authoritative oracle:

- `leo-beam-sim/src/engine/cells/cellLayout.ts`
- `leo-beam-sim/src/engine/cells/cellScheduler.ts`

### 2.1 Cell layout (port from cellLayout.ts)
- 37 cells default (`DEFAULT_CELL_COUNT = 37`), service area 200×90 km at (40°N, 116°E).
- `cellRadiusKm = altitudeKm * tan(beamwidth3dBRad / 2)`.
- Pointy-top **axial hex** rings expanding from center `(q=0, r=0)`; cell IDs assigned ring-then-direction. Ring start `(q=ring, r=0)`, direction order `[(-1,1),(-1,0),(0,-1),(1,-1),(1,0),(0,1)]`, `ring` steps per direction.
- `axialToLocalKm`: `localXkm = r_cell*sqrt(3)*(q + r/2)`, `localYkm = r_cell*1.5*r`.
- `localKmToLatLon`: `lat = centerLat + northKm/111.32`, `lon = centerLon + eastKm/(111.32*cos(centerLat))`.
- `elevationAngleRad`: spherical Earth R=6371 km, geodetic→ECEF for sat (alt) and cell (alt 0), elevation = `asin( dot(LOS, up)/|LOS| )`.
- Min elevation mask `15°` (`DEFAULT_MIN_ELEVATION_DEG`).

### 2.2 Scheduler (port from cellScheduler.ts)
- `displayActiveCellCap = min(layout.count, requestedDisplayCap)`. The consumer
  Phase I overlay uses **28** with 37 cells so the display shows 28 active and
  9 idle cells. This is a display/parity cap, not formal MODQN action truth for
  every `L`.
- `rotatedCells`: `startIndex = (slotIndex * activeLimit) % count`; take `activeLimit` consecutive cells mod count (round-robin rotation).
- Per chosen cell, candidate sats = visible (elev>mask) **sorted by elevation desc**, tie → `visualIndex` asc → `satId` lexical; assign first unused beam `0..beamsPerSat-1` (`usedBeamKeys` = `satId:beamIndex`).
- Assignments sorted `(satVisualIndex, beamIndex, cellId, satId)`. Idle = unused cellIds asc.
- Determinism: satellites normalized-sorted by `satId, visualIndex, lat, lon, alt` before scheduling.
- Serving cap **L ∈ {2,3,4,5,6,7,8}** = top-L visible sats by elevation to area
  center (Phase I `useCellSchedule` selection; `L=4` baseline, `L=8` paper
  sweep max / rich demo). Phase II should make `L` a config knob without
  introducing formal `L=12`.

**II-S1/S2 acceptance includes a cross-language parity test**: dump a few TS reference vectors (cell centers for a fixed config; slot assignments for fixed sat poses + slotIndex 0..3) and assert the Python matches to tight tolerance (1e-9 for centers; exact for assignment tuples).

---

## 3. Slice plan (one module/concern per slice, one commit, one validator)

Dispatch codex per slice (same recipe §6). Re-verify each in the producer main thread (re-run pytest + re-read diff) before committing — do not trust codex's self-report (producer's own subagent-verify rule applies).

- **II-S1 `env/cell_layout.py` + `tests/test_cell_layout.py`** — port §2.1. Deterministic 37-cell centers, radius formula, visibility/elevation, cross-lang parity vs TS. ~150 LOC.
- **II-S2 `env/cell_scheduler.py` + `tests/test_cell_scheduler.py`** — port §2.2. Display active-cell cap, round-robin, visibility constraint, no double-beam, determinism, cross-lang parity vs TS. ~180 LOC.
- **II-S3 `env/channel.py` (extend) + `tests/test_channel.py`** — add `G_T(theta_off_axis)` Bessel J1/J3 factor (SDD §4.5) into `compute_channel`: `G = FSPL*A(d)*eta*G_T(theta)*G_R`. θ = angle between sat→assigned-cell-center boresight and sat→user line. **Gate behind a config flag** (`antenna.off_axis_enabled`) defaulting OFF so existing baselines do not drift; realistic-cells track turns it ON. Keep nadir path intact.
- **II-S4 env wiring (`env/orbit.py` consumer + `env/step.py`)** — per-slot serving set = top-L visible sats (elev>15°) from the constellation; cell schedule maps (sat,beam)→cell each slot; user→serving (sat,beam) = the assignment of the cell containing the user. Slant range from sat to user (in cell) for channel; `+inf`/invalid when user not in any active cell.
- **II-S5 `runtime/state_encoding.py` (extend) + test** — append `cellSchedule[t]` (28 active `(cellId,satId,beamId)` tuples) plus lookahead `[t+1]`,`[t+2]` (SDD §5.5.1 Tier 1). **Extend the existing state vector; preserve current fields + their order**; bump any state-dim constant + the consumers (q_network input dim). Add a test asserting old fields unchanged + new fields present.
- **II-S6 cell-driven handover trigger** — locate producer HO cost path (grep `phi1`/`phi2`); add intra-HO (same-sat beam reassignment of a cell, or user crossing cells within same sat) and inter-HO (cross-sat cell reassignment) per SDD §4.6. Cost magnitudes unchanged in Phase II (algorithm-favorable φ values are a Phase III training-config choice, §5.5.1 — do NOT bake them into env defaults).
- **II-S7 `configs/modqn-paper-baseline.realistic-cells.resolved.yaml`** — new track: `cells:{count:37}`, serving `L` knob (baseline 4; sweep set 2..8 with 8 as paper-supported max), display active-cell cap explicitly separated from `L x 7` action truth, `antenna.model: bessel-j1-j3`, `antenna.off_axis_enabled: true`. Retire `ASSUME-MODQN-REP-002` with an audit note pointing at the parent SDD §1.2/§2. Validate via `config_loader` round-trip.
- **II-S8 dry-run gate (Phase II exit)** — `python -m modqn_paper_reproduction.cli train --config realistic-cells --episodes 10` runs clean; per-episode throughput / HO-count / load-balance within sane ranges; no NaN. This is a **pipeline smoke, not training**. Optionally scaffold replay-bundle-v2 cell-schedule fields (SDD §5.4) but full v2 emission + re-train is Phase III.

---

## 4. Guardrails

- **KPI fail-safe (leo-beam-sim/CLAUDE.md §4 / SDD §11):** `ntn-sim-core`'s 4 frozen `baseline-kpi-*.json` are authoritative. If a vendored/ported module fails its baseline, fix the **port**, never adjust the baseline. The off-axis term is config-gated (II-S3) precisely so the existing paper-faithful baselines keep passing with the flag OFF.
- **Don't bake §5.5 tuning into env defaults.** §5.5 (φ1=0.3, φ2=2.0, slot 0.5s, episode 20s, Rician K=10dB, hotspot UE, parabolic antenna) are Phase III **training-config** levers. Phase II builds the mechanism + paper-faithful defaults; the favorable values live in Phase III configs only.
- **Replay immutability:** Phase II must not retro-edit v1 replay bundles. v2 schema is additive (SDD §5.4).
- **No training in Phase II.** Max 10–50 episode dry-run. Real 1500-ep × 7-weight × 3-seed run is Phase III.

---

## 5. Routing — Phase III is heavy-compute

Per `~/.claude/CLAUDE.md` worker-compute routing: Phase III re-training (1500 ep × 7 weights × 3 seeds for baseline MODQN + angle-aware-EE + W-HOBS arms; est. 2–4 hr wall) and Phase IV Multi-Catfish must run on the **Ubuntu server** (SSH, no GUI overhead, unattended), NOT on local WSL2. Phase II module dev + 10-ep dry-run are light and can run locally. Tag the Phase III worker prompt **heavy** when you write it.

---

## 6. Codex dispatch recipe (per slice, from the producer repo root)

```bash
cd /home/u24/papers/modqn-paper-reproduction
codex exec --sandbox workspace-write --skip-git-repo-check \
  -c 'model_reasoning_effort="high"' "$(cat /path/to/slice-brief.md)"
```
Background-poll without self-match: `pgrep -f '[c]odex-linux-x64/vendor.*bin/codex exec'`. After each slice: re-run the relevant `pytest tests/test_*.py`, re-read the diff, then commit one module per PR (no batched ports). Update the producer's own `.agent-memory` from its controller only.

---

## 7. Phase II exit criteria (SDD §9 Phase II)

1. `cli train --config realistic-cells --episodes 10` runs without error.
2. Per-episode metrics within expected ranges; no NaN.
3. New cell modules + channel off-axis + state encoder + handover tests all green (`pytest`).
4. Existing baselines still pass with off-axis flag OFF (no drift).
5. Cross-language parity tests (II-S1/S2) green against the TS oracle.

On exit, hand back to a Phase III server-worker prompt (heavy).
