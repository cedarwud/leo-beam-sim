# Claude Code Instructions — leo-beam-sim

This file is the Claude-facing workflow wrapper for `/home/u24/papers/project/leo-beam-sim/`.

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
`appMode` alone. **Before changing `scene/`, `viz/`, `ui/`, `app/`, or any runtime
rendering boundary, read and follow [docs/frontend-change-contract.md](./docs/frontend-change-contract.md)**
— the ENFORCED protocol (7 rules + the SACRED invariants + the gate map + a
dispatch-prompt template). Background: [docs/frontend-render-governance.md](./docs/frontend-render-governance.md)
and [docs/frontend-mode-lane-separation-sdd.md](./docs/frontend-mode-lane-separation-sdd.md);
update `validate:frontend:scene-lane-governance` when a lane rule changes. When
DISPATCHING an agent to do frontend work, paste the contract's dispatch-prompt
template, isolate the agent in a git worktree, and review its diff before accepting.

**Enforcement (layered — and honest about its limits).** Prose is advisory; the
executable layer is what catches an agent (esp. memory-less Codex) that did not
read or recall these rules. Three gates, fast→thorough:
- `.githooks/pre-commit` runs `npm run validate:governance` (lint +
  `scene-lane-governance` + `s0:connected-sat-has-beam` must-hold +
  `s0:geometry-trace` truth-zero-diff golden + `beam:colour-match` VISUAL-truth
  invariant, ~16s) and BLOCKS a breaking commit. Kept fast on purpose so it is not
  bypass-bait. (`colour-match` was folded in 2026-06-18 to close the loop-3
  gate↔visual gap before dispatching frontend agents.)
- `npm run validate:governance:full` (~165s, MANUAL) adds the S1–S5 deterministic
  invariant gates — the CURATED render-invariant boundary (NOT every static
  validator; ~16 of ~144). Too slow to auto-hook (would breed `--no-verify`); run
  it before a handoff/PR.
- `npm run validate:static:all` (~8min, MANUAL) is the COMPLETE static gate +
  recurrence guard: a self-discovering runner (`scripts/validate-static-all.mjs`)
  that runs EVERY static `validate:*` leaf, so a new validator can never silently
  orphan and a refactor that breaks any source-pinned validator is caught. It
  carries a QUARANTINE list of the known-rotted reds (visible debt, one TODO each)
  and FAILS if a quarantined validator starts passing (forces cleanup). Run before
  a handoff/PR alongside governance:full. (Background: a 2026-06-14 triage found 20
  of the ~128 orphaned static validators had silently rotted — source-pinned
  asserts that broke when code moved and nobody re-ran them. This is the structural
  fix for that recurrence.)
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
UNBYPASSABLE layer is server-side CI on a PR. The GitHub remote exists and
`.github/workflows/governance.yml` (added 2026-06-18) runs `validate:governance:full`
+ `validate:static:all` (+ the browser visual gates, director-cinematic excluded)
on push/PR — but it only BITES once you mark its `static-gates` job a REQUIRED
status check in branch protection (Settings → Branches). Do NOT normalize `git commit --no-verify`. When a gate's scope
changes, update the gate AND these aggregates together (Rule#9 atomic).

## 6. Local Docs

| Purpose | File |
|---|---|
| Repo entry | [README.md](./README.md) |
| Scene / sim / render design | [docs/SDD.md](./docs/SDD.md) |
| HOBS + TR 38.811 SINR baseline | [docs/hobs-tr38811-sinr-mini-sdd.md](./docs/hobs-tr38811-sinr-mini-sdd.md) |
| SINR runtime parameter contract | [docs/sinr-runtime-parameter-contract.md](./docs/sinr-runtime-parameter-contract.md) |
| Frontend UX / visual roadmap | [docs/frontend-ux-redesign-sdd.md](./docs/frontend-ux-redesign-sdd.md) |
| **Frontend change contract (read before ANY frontend edit)** | [docs/frontend-change-contract.md](./docs/frontend-change-contract.md) |
| Frontend render governance | [docs/frontend-render-governance.md](./docs/frontend-render-governance.md) |
| Frontend mode/lane separation SDD | [docs/frontend-mode-lane-separation-sdd.md](./docs/frontend-mode-lane-separation-sdd.md) |
| Scene lane render boundary ADR | [docs/decisions/ADR-001-scene-lane-render-boundary.md](./docs/decisions/ADR-001-scene-lane-render-boundary.md) |
| Beam hopping mini-SDD | [docs/beam-hopping-mini-sdd.md](./docs/beam-hopping-mini-sdd.md) |
| MODQN ω-weighted handover mini-SDD | [docs/modqn-omega-handover-sdd.md](./docs/modqn-omega-handover-sdd.md) |
| MODQN training-trigger backend mini-SDD | [docs/modqn-training-trigger-backend-sdd.md](./docs/modqn-training-trigger-backend-sdd.md) |
| Research implementation backlog | [docs/research-implementation-backlog.md](./docs/research-implementation-backlog.md) |
| AI DevKit governance layer（調度守則／判斷 rubric／安全側寫／維護協議／模板） | [docs/devkit/](./docs/devkit/) |

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

When editing this file, mirror the same change set to [AGENTS.md](./AGENTS.md). The two files are kept symmetric except for the Claude/Codex header.

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

## 10. AI DevKit（制度層＋pipeline）

本 repo 於 2026-07-06 安裝 ai-devkit 0.16（P1 路由；2026-07-07 同步至 0.24——含 §16 接班交接、狀態檔三性質 schema、租約 hooks 獨佔、多版本評審選優階梯、失敗分類前置、按軌計費勾稽、種子 per-session、產物送達慣例、同根因全掃、pkill/heredoc hook 坑；2026-07-08 對齊套件 v1.1＝v0.25 彙整 ping-fix＋v0.26–v1.1 套件 repo 整備／匿名化＋成對 ai-rethink＋prose，無專案制度差異；2026-07-09 同步至 1.23——通則3 對稱上限〔judgment-rubric §5「驗證不自驗」加對稱上限：低風險例行檢查從已知狀態下結論、不過度查證〕＋v1.22/1.23 側庫線／機器層可分離性〔套件 attach／彙整機制，本次轉側庫即應用，無專案制度差異〕）。本節只做路由與速查；規則本體在 `docs/devkit/`。**接手模型（Opus/Sonnet 檔位）先讀 [docs/devkit/succession-handbook.md](./docs/devkit/succession-handbook.md)**——判斷分工位階、品味兩清單、data-blind playbook 都在那。個人層與狀態檔（偏好側寫、決策日誌、metrics、假設帳、pipeline-state）實體在 repo 外、**永不 commit**（`.claude/devkit-local` symlink，見該目錄 README）；共享制度層（docs/devkit/、兩支 skill、hooks、settings.json）**已轉私有側庫 devkit-vault、symlink 回本機、.gitignore 不進 leo git**（交付準備：對外交付版不含 AI 鷹架；跨機同步靠側庫 clone＋symlink 還原）。

### 人類速查（白話即可，不用記指令）

- 「**跑 pipeline**」／「繼續上次的」→ 用 `leo-pipeline` skill：讀狀態檔、從斷點續跑（冪等，重跑不重做）。
- 「**我要做 X**」／模糊新需求＋素材 → 用 `leo-intake` skill：先復述再選項式提問（每輪 ≤5 題、給具體選項不問抽象題）→ 產出 spec＋假設帳 → 進 `docs/devkit/intent.md`。
- **關卡怎麼答**：系統批次打包問（互動時 AskUserQuestion；非互動時寫入狀態檔 `gate_requests`，之後任一 session 白話回覆即可續跑）。無人值守時所有詢問預設答案＝「暫停」。
- **報告在哪**：健檢／診斷報告落 `docs/devkit/reports/`；抽查與決策紀錄在 `.claude/devkit-local/`。
- 「**彙整 devkit 提案**」→ 收一輪套件修訂提案（流程在 `~/.claude/skills/ai-devkit/SKILL.md`）。
- 「**跑 devkit 同步**」→ 套件版本智能合併（系統只提醒、永不自動改裝）。

### Agent 路由（開工前按任務讀）

| 情境 | 讀 |
|---|---|
| 任何派工／預算／抽查／升降級／重活路由 | [docs/devkit/dispatch-rules.md](./docs/devkit/dispatch-rules.md) |
| 判斷完成／升級／停下問人／換路訊號 | [docs/devkit/judgment-rubric.md](./docs/devkit/judgment-rubric.md) |
| 權限側寫／外部內容檢疫／新依賴／audit | [docs/devkit/security-profiles.md](./docs/devkit/security-profiles.md) |
| 改制度檔／教訓分流／postmortem／棘輪 | [docs/devkit/maintenance-protocol.md](./docs/devkit/maintenance-protocol.md) |
| Claude 系模型行為（含 effort） | [docs/devkit/model-facts-successor.md](./docs/devkit/model-facts-successor.md) |
| Codex／Gemini 派工 | [docs/devkit/model-facts-challenger.md](./docs/devkit/model-facts-challenger.md) |
| 派工模板 ×5＋eval | [docs/devkit/templates/](./docs/devkit/templates/) |
| backlog（優先序只有使用者能改） | [docs/devkit/intent.md](./docs/devkit/intent.md) |
| 採用／包裝／自建盤點 | [docs/devkit/adoption-decisions.md](./docs/devkit/adoption-decisions.md) |
| 專案級教訓 | [docs/devkit/lessons/](./docs/devkit/lessons/) |
| 生產回饋（demo 場次觀察／flake 名單） | [docs/devkit/production-feedback.md](./docs/devkit/production-feedback.md) |
| 接班手冊（接手模型第一讀；判斷分工／品味清單／playbook） | [docs/devkit/succession-handbook.md](./docs/devkit/succession-handbook.md) |

### 不變量與誠實條款

- **條款分級**：`[通則]`＝任何等級模型遵守；`[鷹架]`＝為較弱模型而設。未標示＝[通則]。頂級模型（官方定位高於 Opus 檔位，如 Fable/Mythos）可憑判斷偏離鷹架但要說明理由；模型拿不準自己等級就當非頂級。
- **位階**：`docs/frontend-change-contract.md` 與 SACRED validators 是本 repo 原生憲法，**優先於 devkit 模板與守則**；衝突時走 frontend contract 並回報衝突。
- **系統極限**：拆解、驗證、多樣本評審補得了執行品質；模糊題與品味判斷補不了——遇到時升級模型、外部第二意見、或明說做不到。三個殘差只對沖不消除：閘門評估力（每個建議附「何時會被證明是錯的＋逃生路線＋更無聊可逆的替代案」）、未知的未知（縮短到現實的距離、真的用）、系統自身故障（break-glass：回滾到已知良好狀態＋完整失敗軌跡落檔＋帶去 fresh session 問最強模型）。
- **context 安心語＋換 session 正面規則**：context 會被 harness 自動摘要壓縮——不要因對話變長而提前收尾或精簡工作；**換 session 的唯一正確時機＝里程碑關帳**（工作項關帳／驗收裁決落檔／階段交付完成），屆時由 controller 主動建議——安心語防「提早收尾」、此句防「永不收尾」（v0.22）。
