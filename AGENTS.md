# leo-beam-sim Agent Rules

This file is the Codex-facing workflow wrapper for `/home/u24/papers/project/leo-beam-sim/`.

## 1. Repo Role

`leo-beam-sim` is the **final visual-first showcase and live-demo platform** for the NTN Showcase Stack. Replay/offline stories should normally flow as `modqn-paper-reproduction -> visual-showcase-v1 -> leo-beam-sim`, with `ntn-sim-core` acting as the contract / validator oracle. Live-sim stories may vendor validated `ntn-sim-core/src/core` modules on demand. Cross-repo authority lives in [/home/u24/papers/ntn-showcase-stack/](/home/u24/papers/ntn-showcase-stack/).

Read the following before any cross-repo work:

- [/home/u24/papers/ntn-showcase-stack/README.md](/home/u24/papers/ntn-showcase-stack/README.md)
- [/home/u24/papers/ntn-showcase-stack/AGENTS.md](/home/u24/papers/ntn-showcase-stack/AGENTS.md)
- [/home/u24/papers/ntn-showcase-stack/docs/repo-roles.md](/home/u24/papers/ntn-showcase-stack/docs/repo-roles.md)
- [/home/u24/papers/ntn-sim-core/docs/modqn-paper-reproduction-to-leo-beam-sim-handoff.md](/home/u24/papers/ntn-sim-core/docs/modqn-paper-reproduction-to-leo-beam-sim-handoff.md)

## 2. Sibling Repos

| Repo | Role | Path |
|---|---|---|
| **modqn-paper-reproduction** | Python paper reproduction (PAP-2024-MORL-MULTIBEAM). Produces frozen MODQN bundle JSON and may emit producer-owned `visual-showcase-v1` artifacts. Do not edit from this repo. | [/home/u24/papers/modqn-paper-reproduction/](/home/u24/papers/modqn-paper-reproduction/) |
| **ntn-sim-core** | Frozen research-truth donor/reference simulator (TS). It owns `visual-showcase-v1` contract validation and is the vendor source-of-truth for rigor-critical `src/core/` modules. | [/home/u24/papers/ntn-sim-core/](/home/u24/papers/ntn-sim-core/) |
| **ntn-showcase-stack** | Cross-repo coordination, artifact contract, repo-role boundaries. No runtime. | [/home/u24/papers/ntn-showcase-stack/](/home/u24/papers/ntn-showcase-stack/) |

## 3. Replay / Offline Artifact Rule

For replay/offline MODQN stories, prefer `visual-showcase-v1` over direct
MODQN bundle UI wiring. Validate external artifacts in `ntn-sim-core` before
using them here:

```bash
cd /home/u24/papers/ntn-sim-core
npm run validate:visual-showcase:artifact -- /path/to/visual-showcase-v1.json
```

`leo-beam-sim` owns camera, materials, labels, panels, timeline controls, and
demo packaging. It must not infer or rewrite SINR, handover events, MODQN
actions, rewards, geometry truth, evidence status, or provenance from display
needs.

## 4. Vendor-on-Demand Engine Rule

When a live-sim feature here needs academic rigor (multi-beam SINR, Doppler, fading, CHO / Timer-CHO / MC-HO / DAPS, energy model, traffic generator, UE mobility, FRF, earth-fixed cells, etc.), do **NOT** rewrite from scratch. Vendor the corresponding module from `ntn-sim-core/src/core/{module}/`:

1. **Kill-switch audit first.** Verify the source module does not import React, Three.js, or any `viz/` / `app/` symbol. If contaminated, stop and reopen the relevant `scene-*-decoupling` plan in `ntn-sim-core/todo/` instead.
2. Run the source-side validator in `ntn-sim-core` (`npm run validate:*`) and record the baseline KPI from the relevant `baseline-kpi-*.json`.
3. Copy `src/core/{module}/` plus its `fixtures/` and tests into this repo.
4. Re-run the equivalent validator here. KPIs must not drift.
5. Commit one module per PR. No batched ports.
6. Log the port in `ntn-showcase-stack/README.md` Module Vendor Log.

**Why:** 4 prior attempts to merge `leo-beam-sim` viz INTO `ntn-sim-core` all stopped at planning or shipped only thin contract slices, with the meat explicitly deferred (see `ntn-sim-core/todo/external-scene-integration/`, `pre-integration-phase0-boundary-map/`, `scene-consumer-contract-extraction/`, `scene-coordination-decoupling/`). Root cause: `ntn-sim-core/src/viz/scene/SceneShell.tsx` + `SceneDataLayers.tsx` conflate too many concerns. Reverse direction (engine → viz) avoids the shell tangle because `ntn-sim-core/src/core/` was designed to be externally consumable. Big-bang merge in either direction is forbidden by `ntn-showcase-stack/AGENTS.md`.

## 5. Boundaries

1. Do not become a second MODQN trainer or independently reimplemented NTN truth source. `leo-beam-sim` may host live simulation/runtime behavior for the final demo, but rigor-critical truth must come from vendored/validated `ntn-sim-core/src/core` modules or explicit provenance artifacts, not local rewrites.
2. Do not let display-only transforms alter SINR, handover events, policy decisions, rewards, deterministic path IDs, or provenance.
3. MODQN bundle JSON and `visual-showcase-v1` JSON are immutable replay inputs — do not edit consumed values, only display them.
4. `ntn-sim-core`'s 4 frozen `baseline-kpi-*.json` are authoritative. If a vendored module fails its baseline here, fix the port — do not adjust the baseline.

### Frontend Render Governance Rule

One viewport frame has one authoritative scene lane. Shared primitives are
allowed, but shared viewport proof ownership is not. Do not mount SINR live,
MODQN live-cell preview, MODQN replay proof, and artifact replay layers from
`appMode` alone. Use [docs/frontend-render-governance.md](./docs/frontend-render-governance.md)
and [docs/frontend-mode-lane-separation-sdd.md](./docs/frontend-mode-lane-separation-sdd.md)
before changing `scene/`, `viz/`, `ui/`, or runtime rendering boundaries, and
update `validate:frontend:scene-lane-governance` when a lane rule changes.

**Enforcement (layered — and honest about its limits).** Prose is advisory; the
executable layer is what catches an agent (esp. memory-less Codex) that did not
read or recall these rules. Three gates, fast→thorough:
- `.githooks/pre-commit` runs `npm run validate:governance` (lint +
  `scene-lane-governance` + `s0:connected-sat-has-beam` must-hold +
  `s0:geometry-trace` truth-zero-diff golden, ~15s) and BLOCKS a breaking commit.
  Kept fast on purpose so it is not bypass-bait.
- `npm run validate:governance:full` (~165s, MANUAL) adds the S1–S5 deterministic
  invariant gates — the full static boundary. Too slow to auto-hook (would breed
  `--no-verify`); run it before a handoff/PR.
- `npm run validate:ready` adds the browser/render smoke (`validate:live-render`;
  needs a running vite + `APP_URL`). Run before declaring render work done.
Activation is automatic: the `prepare` npm script sets git
`core.hooksPath=.githooks` on `npm install`, so any agent that installs deps is
bound (manual fallback `npm run setup:hooks`).

**LIMITS — do not overclaim (codex-reviewed).** This is a COOPERATIVE gate, not
adversarial enforcement: (1) if `core.hooksPath` was never set the hook silently
does nothing — git gives no warning; (2) the hook + its scripts live in the
working tree, so a single commit can both regress AND defang the gate; (3)
browser/render coverage lives only in the MANUAL `validate:ready`, not the auto
hook. The threat model it binds is a forgetful / memory-less agent re-breaking a
solved lock — NOT an agent deliberately subverting governance. The only
UNBYPASSABLE layer is server-side CI on a PR; the repo has no remote/PR flow yet,
so when it gets one, wire `validate:governance:full` + `validate:ready` into
required CI. Do NOT normalize `git commit --no-verify`. When a gate's scope
changes, update the gate AND these aggregates together (Rule#9 atomic).

## 6. Local Docs

| Purpose | File |
|---|---|
| Repo entry | [README.md](./README.md) |
| Scene / sim / render design | [docs/SDD.md](./docs/SDD.md) |
| HOBS + TR 38.811 SINR baseline | [docs/hobs-tr38811-sinr-mini-sdd.md](./docs/hobs-tr38811-sinr-mini-sdd.md) |
| SINR runtime parameter contract | [docs/sinr-runtime-parameter-contract.md](./docs/sinr-runtime-parameter-contract.md) |
| Frontend UX / visual roadmap | [docs/frontend-ux-redesign-sdd.md](./docs/frontend-ux-redesign-sdd.md) |
| Frontend render governance | [docs/frontend-render-governance.md](./docs/frontend-render-governance.md) |
| Frontend mode/lane separation SDD | [docs/frontend-mode-lane-separation-sdd.md](./docs/frontend-mode-lane-separation-sdd.md) |
| Scene lane render boundary ADR | [docs/decisions/ADR-001-scene-lane-render-boundary.md](./docs/decisions/ADR-001-scene-lane-render-boundary.md) |
| Beam hopping mini-SDD | [docs/beam-hopping-mini-sdd.md](./docs/beam-hopping-mini-sdd.md) |
| MODQN ω-weighted handover mini-SDD | [docs/modqn-omega-handover-sdd.md](./docs/modqn-omega-handover-sdd.md) |
| MODQN training-trigger backend mini-SDD | [docs/modqn-training-trigger-backend-sdd.md](./docs/modqn-training-trigger-backend-sdd.md) |
| Research implementation backlog | [docs/research-implementation-backlog.md](./docs/research-implementation-backlog.md) |

## 7. Supplemental Engineering Skill Routing

These workspace-level skills are optional aids and must not override this
repo's final-renderer role, artifact immutability, or vendor-on-demand rules:

1. Use `/home/u24/papers/skill/module-boundary-design/SKILL.md` when changing
   `core/`, `engine/`, `modqn/replay-bundle/`, `scene/`, `viz/`, or UI/runtime
   boundaries.
2. Use `/home/u24/papers/skill/data-contract-review/SKILL.md` when consuming or
   adapting MODQN bundles, `visual-showcase-v1`, diagnostics, provenance, or
   source-gap fields.
3. Use `/home/u24/papers/skill/safe-refactor/SKILL.md` before restructuring
   scene, replay, UI, or vendored-module-adjacent code.
4. Use `/home/u24/papers/skill/demo-operability/SKILL.md` for Vite/browser
   smoke, visual capture, runtime degraded states, and demo validation; pair it
   with `/home/u24/papers/skill/papers-runtime-hygiene/SKILL.md` when starting
   servers or browser automation.

## 8. Sync Rule

When editing this file, mirror the same change set to [CLAUDE.md](./CLAUDE.md). The two files are kept symmetric except for the Claude/Codex header.

## 9. Agent Memory Bridge

This repo bridges its agent memory across tools (Claude Code, Codex CLI,
future agents). Both AGENTS.md and CLAUDE.md are loaded by respective agents.
The live, session-updated memory store lives at `.agent-memory/` (symlink
into Claude Code's user-private memory dir for this repo's slug; the symlink
itself is in `.gitignore`, the target is the source of truth).

**Read order at session start (any agent):**

1. `.agent-memory/MEMORY.md` — index of all current memory entries for this
   repo.
2. Open every `.agent-memory/feedback_*` and `.agent-memory/project_*` entry
   whose description matches the task at hand.
3. Then proceed to the workspace-level workflow rules at
   `/home/u24/papers/AGENTS.md` §7 (Multi-Tool Agent Convention) and §8
   (Memory Bridge Convention), and finally this repo's own rules above.

**Updating memory:**

- Only the Claude controller agent updates memory entries (writes to the
  symlink target). Codex CLI and other sub-agents treat `.agent-memory/` as
  read-only context.
- Memory entries that contradict current code or status are stale — surface
  the contradiction; do not act on stale memory.

**Why this bridge:** Claude memory is the controller's persistent state
ledger (project status, decisions, user preferences). Codex CLI has no
native memory store; without this bridge it would diverge from the
controller's decisions and reintroduce solved problems.

The canonical bridge implementation reference is
`modqn-paper-reproduction/AGENTS.md` §Agent Memory Bridge.
