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

- [x] **FIX-2 — Regenerate producer `visual-showcase-v1.json`** · **NON-HEAVY (in-environment, ~60s)** · **DONE `555ba6a` (2026-06-03)**
  - **STEP 0 verdict (reversed the "likely HEAVY" guess):** the CLI `modqn-visual-showcase --bundle <dir> --output <json>` is a pure JSON transform (no training). BUT the on-disk baseline run is a **10s episode** (`run_metadata: episode_duration_s=10, slot_duration_s=1`) and `visual_showcase_exporter.py:82` hard-requires a deterministic **60-120s window** → a plain re-export from the existing 10s bundle is `BLOCK_WITH_GAPS`.
  - **Cheap path that works (user-picked "investigate extended-replay"):** `modqn-export --input <baseline-run> --output-dir <bundle> --replay-slot-count 90` (40s, env keeps stepping past the 10s training horizon on the continuous orbital sim → 89s bundle) → `modqn-visual-showcase --bundle <bundle> --output visual-showcase-v1.json --modqn-commit <40hex> --ntn-sim-core-commit <40hex> --artifact-id visual-showcase-v1-baseline-89s-2026-06-03` (20s, 46MB). **ntn-sim-core `validate:visual-showcase:artifact` = OK** (commits MUST be full 40-hex or it fails `PROVENANCE_COMMIT_FORMAT`).
  - **Artifact path (persistent, clean-named):** `modqn-paper-reproduction/artifacts/visual-showcase-v1-baseline-89s-2026-06-03/{bundle/,visual-showcase-v1.json}` (lives on producer disk, NOT committed to leo; regenerate with the two commands above if wiped).
  - **leo change = ONE line:** `vite.config.ts` pins the new path; `fs.stat` first-branch finds it → serves `producer-pinned` → FIX-1 badge correctly disappears. Loader `PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH`/`SHA256` left unchanged on purpose (static-frame validator's frozen trigger concept; the regen carries env RNG, not byte-pinned).
  - **Verified (DATA SOURCE = REAL producer artifact — FIRST real-data check):** tsc 0; scene-lane-governance green; curl emitter → `producer-pinned` (46MB); playwright real-data smoke = **NO honesty badge** (FIX-1 no-badge path now real-data verified, was logic-only), shell `data-artifact-source=producer-pinned`, no warn, artifact-loaded, scene not fail-closed, real scenario "Phase 01H Baseline MODQN Multi-UE Replay"; **screenshot eyes-on = real 100-UE ground distribution + populated dashboard/flowchart dock** (the audit's "one orange dot meaningless" is gone). codex review CLEAN.
  - **⚠️ Producer-contract caveat (surfaced, not resolved):** slots 11-90 are an OOD extrapolation of a policy trained on 10s episodes — deterministic + real geometry, and the producer exporter treats a 60-120s greedy replay as valid `evidenceStatus=baseline`, but it is replay past the training horizon. leo only displays the status faithfully.
  - **➡ FIX-6 follow-ups found:** real artifact has top-level `claimBoundary: undefined` (synthetic fixture had one) → `ClaimBoundaryBanner` takes its graceful fallback path; satellites still off-frame (C2) + no beams in artifact lane (C3) = FIX-5 design calls; the real artifact is intra/inter-HO content not yet eyes-on verified for Director cinematic (FIX-4).

- [ ] **FIX-3 — Decide the demo's PRIMARY lane** · decision (user) · non-heavy
  - If `modqn-live-cell-preview` (real bundle on disk, cells + 100 UEs) is the
    centerpiece, artifact-replay emptiness is lower priority. If artifact-replay
    is the showcase, FIX-2 is mandatory. Drives the rest of the sequence.
  - **Update (post-FIX-2):** the forcing function is gone — artifact-replay now
    carries REAL producer data (89s, 4 sats / 100 UEs), so BOTH lanes are viable
    showcases. This is now a pure preference call, not a "fix the empty lane" call.

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
