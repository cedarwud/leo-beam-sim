# Showcase Render-Truth Fix Backlog

Driven by `docs/showcase-render-truth-audit-2026-06-03.md` (the read-only audit).
Work items, sequenced. Each is a focused slice; follow the proven loop
(impl → main-thread re-verify → codex review --base main → fix → ff-merge → push).
**New rule for THIS backlog: every "verified" claim must state the DATA SOURCE
(real producer / fixture / route-mock). No more "browser-verified" without it.**

State at backlog creation: leo-beam-sim HEAD `4d9be1a`; audit was read-only, no
code changed. Untracked: this file + the audit doc + the flowchart SDD.

---

## Sequenced items

- [x] **FIX-1 — Make the synthetic-fixture fallback LOUD** · non-heavy · in-environment · **DONE `b9964af` (2026-06-03)**
  - App now reads `X-Showcase-Artifact-Source` on the replay fetch into state;
    `console.warn` + `data-artifact-source` shell attribute + a visible
    `ArtifactSourceBadge` banner fire for any non-producer source. Display-only
    (reads a transport header, never SINR/handover/MODQN/reward/geometry truth).
  - A completed 200 with NO header (static/preview server, route mock) maps to a
    distinct `HEADER_ABSENT_SOURCE` sentinel (not the loading `null`) so it still
    trips the badge — caught by codex review (would otherwise be silently
    bypassed). Warn copy is source-aware: only the synthetic fixture is called
    "synthetic"; header-absent / unknown is reported as unverified, never
    overclaimed.
  - **Emitter fix (codex-caught):** `vite.config.ts` no longer hardcodes
    `synthetic-fixture-fallback` on the loader fallback path — it derives the
    header from the loader's resolved source, so an env-provided real artifact
    (`VISUAL_SHOWCASE_ARTIFACT_PATH`) stamps `external-artifact-path`, not fake.
    Only the canonical pinned path earns `producer-pinned` (§3: an unvalidated
    external artifact must not silently pass as proof).
  - **Verified (DATA SOURCE explicit):** tsc 0; governance/app-wire 41-0/
    banner-copy 25-0 green; playwright smoke on the **synthetic-fixture-fallback**
    dev path + a **route-mocked header-absent** 200 (badge+warn+attr, no live-lane
    leak); curl on the emitter (default→synthetic; env real artifact→external,
    5.9MB/200). `producer-pinned` no-badge path is logic-verified
    (`decideArtifactSourceBadge` + emitter ternary) — **no real producer artifact
    on disk yet (FIX-2)**, so it was NOT browser-verified on real data. codex
    review 4 rounds → CLEAN (3 real P2s fixed, round-4 no findings).

- [ ] **FIX-2 — Regenerate producer `visual-showcase-v1.json`** · likely HEAVY · cross-repo (modqn-paper-reproduction) → route to Ubuntu server if it needs a replay pass
  - Producer CLI `.venv/bin/modqn-visual-showcase` + `src/modqn_paper_reproduction/export/visual_showcase_*.py` exist; baseline run dir on disk
    (`artifacts/baseline-modqn-pilot02-rerun-2026-05-15/run`).
  - Step 0: read the producer CLI `--help` + `visual_showcase_main.py` to learn
    inputs (does it need a trained model + a replay rollout, or just re-export
    from the existing baseline run?). Classify heavy-vs-not from that.
  - Output a `visual-showcase-v1.json`; validate it in ntn-sim-core
    (`npm run validate:visual-showcase:artifact -- <path>`) per CLAUDE.md §3.
  - Place where `vite.config.ts:93` expects it (or update the pinned path), so
    artifact-replay loads REAL data: real satellites, UEs, handover events,
    intra AND inter (the synthetic fixture is intra-only).
  - Re-verify the dashboard/flowchart/director-cinematic ON THIS REAL artifact
    (closes the audit B-block gap for the artifact lane).

- [ ] **FIX-3 — Decide the demo's PRIMARY lane** · decision (user) · non-heavy
  - If `modqn-live-cell-preview` (real bundle on disk, cells + 100 UEs) is the
    centerpiece, artifact-replay emptiness is lower priority. If artifact-replay
    is the showcase, FIX-2 is mandatory. Drives the rest of the sequence.

- [ ] **FIX-4 — Durable Director/cinematic browser validator** · non-heavy · in-environment
  - No `scripts/*director*`/`*cinematic*` browser script exists; camera tween /
    0.05× slow-mo / dim-fade were only ad-hoc manual. Add a playwright gate that
    asserts the camera pose ACTUALLY changes on intra-focus + speed drops + fade
    fires + auto-restore. (Needs a lane with a real intra event — artifact-replay
    fixture has one today; after FIX-2 test inter too.)

- [ ] **FIX-5 (design) — artifact-replay scene richness + camera framing** · non-heavy · design + impl
  - C2: satellites are never framed (camera ground-focused) — decide if a default
    or a preset camera should show the orbiting sats. C3: artifact-replay renders
    only sats + UE dots (no beams/cells by governance) — decide if the showcase
    wants more there. Both are design calls, then small impl.

- [ ] **FIX-6 — Re-verify the "COMPLETE" surfaces on REAL data** · mixed
  - After FIX-2, re-run dashboard:browser + a real-data eyes-on of: flowchart
    pulse on real handover events, director cinematic on a real inter event,
    Phase-3 overlays on real beam-load. Replace each memory "verified-on-fixture"
    note with "verified-on-real-data" (or log the gap).
  - P3b Tier-2 server E2E (the pre-existing open item) folds in here: real
    training run → dock MiniRewardCurve fills live (HEAVY → server; push producer
    `4c03665` to origin first).

---

## Resume prompt for a fresh conversation

> Continue the leo-beam-sim render-truth FIX campaign. Read first:
> `docs/showcase-render-truth-audit-2026-06-03.md`,
> `docs/showcase-render-truth-fix-backlog.md`, and `.agent-memory/MEMORY.md`
> (the RENDER-TRUTH AUDIT block). Confirm git sync (HEAD should be `4d9be1a`).
> Then start FIX-1 (loud synthetic fallback). 繁中對話.
