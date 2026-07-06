# devkit 技能盤點決策表（採用／包裝／自建）— leo-beam-sim

> 這份文件是什麼：ai-devkit 藍圖 §15 安裝順序第 0 項的產出。逐一對照藍圖元件與本機既有能力，記錄「採用／包裝／自建／不採用」決策與理由。**先採用後建造**（藍圖核心原則 6）：環境已有的能力優先接線，只建缺的。
>
> 機器繫結：本表名冊部分（哪些工具存在）綁定本機 `LAPTOP-O8M86FNI`（WSL2，/home/u24）。Ubuntu server 端要用 devkit 時，名冊需按該機重核（見文末釘點）。
>
> 安裝日：2026-07-06 · ai-devkit 0.16 · 安裝模型 Fable 5 · repo HEAD `a7af62a`

## 上游審計的沿用與漂移

發佈 repo 的 `env-skill-inventory.md` v2（2026-07-05，產於另一台機器 /home/ubuntu）已對 gstack／codex-plugin／官方 marketplace 做過名實審計。本機沿用規則：

| 審計釘點 | v2 釘點 | 本機實況 | 處置 |
|---|---|---|---|
| gstack | `11de390`（v1.58.5.0） | `33cb4715`（v1.39.2.0，**較舊，漂移**） | 漂移項重審：本次僅採用 codex wrapper 一支，已於 2026-07-06 逐檔重讀本機 `~/.claude/skills/codex/SKILL.md` 並記入 [model-facts-challenger.md](./model-facts-challenger.md)。其餘 gstack skill 本安裝不採用，不需重審 |
| codex CLI | 0.142.5（plugin `80c31f9`） | CLI 0.142.5 ✅（plugin 未啟用，走 gstack wrapper） | 版本一致，結論沿用 |
| ARS plugin | v3.9.4.2 審計→不採用 | 本機已裝（使用者論文工作用） | 沿用「不進 devkit」結論；ARS 屬論文域工具，與 devkit 治理層無關 |
| serena（v2 建議取代 codegraph） | — | 本機**無** serena、**有** codegraph（MCP 已設定＋索引健康） | **決策反轉**：本機採用 codegraph，不裝 serena（新依賴＝§8 硬關卡，且無必要） |

## 決策表

「repo 原生」= leo-beam-sim 既有機制，優先序最高的「已有能力」。

### 治理核心（藍圖 caveat：無現貨，自建）

| 藍圖元件 | 決策 | 落點 | 理由 |
|---|---|---|---|
| §3 調度守則＋§7/§8 防護參數 | **自建** | [dispatch-rules.md](./dispatch-rules.md) | 預算分級／檢查點／AIMD／抽查無現貨 |
| §3 判斷 rubric | **自建** | [judgment-rubric.md](./judgment-rubric.md) | 同上 |
| §4 pipeline 狀態機 | **自建** | `.claude/skills/leo-pipeline/` | 同上 |
| §6 需求編譯器 | **自建** | `.claude/skills/leo-intake/` | 本機無 /spec（那是 v2 機器的 gstack 1.58 才有）；且 §6 選項式提問＋雛形＋假設帳無現貨 |
| §8 抽查亂數源 | **自建** | `.claude/hooks/devkit-session-start.sh` | hook 預生成骰子種子落狀態檔 |
| §13 租約 | **自建** | `pipeline-state.json` 內 `lease` 欄 | 無現貨 |

### 安全網／驗證（repo 原生為主）

| 藍圖元件 | 決策 | 落點 | 理由 |
|---|---|---|---|
| §5 事件迴圈「commit 前檢查」 | **採用 repo 原生** | `.githooks/pre-commit`（`validate:governance`，~16s） | 已存在且經實戰；devkit **不另加** git hook，避免雙 gate 互踩 |
| §10 fitness functions | **採用 repo 原生** | 204 支 `validate:*` script；curated 邊界=`validate:governance:full`（~165s）；全量=`validate:static:all`（~8min，自發現＋隔離區） | 這就是編譯好的 fitness functions；P2 只補缺口不重造 |
| 瀏覽器／render 驗證 | **採用 repo 原生** | `validate:ready`（需 vite＋APP_URL） | render 工作 DoD 的既有定義 |
| CI（唯一不可繞層） | **採用 repo 原生** | `.github/workflows/governance.yml` | 注意：要在 GitHub branch protection 把 `static-gates` 設 required check 才真正咬人（CLAUDE.md 既載） |
| §10 驗證不自驗 | **採用 builtin ＋自建合約** | fresh-context subagent（Agent tool）＋ `/verify`、`/code-review`（builtin） | 派工模板寫死「驗收另派 fresh agent」 |

### 跨模型挑戰者

| 藍圖元件 | 決策 | 落點 | 理由 |
|---|---|---|---|
| §10 跨模型審查主力 | **包裝採用**：codex CLI 0.142.5 | 經 gstack `/codex` wrapper 或直接 `codex exec`（模板見 [templates/review.md](./templates/review.md)） | 使用者既有偏好（memory：consult/review 可靠、重 exec 會 timeout）；範圍限定照 §10：只審邏輯矛盾／流程漏洞／模糊語句 |
| 第二挑戰者 | **備援採用**：gemini CLI 0.45.3、agy 1.0.16 | 品味／設計類第二意見；派工照 Gemini 官方指南（**必附 few-shot**，與 Codex 相反） | 兩 CLI 皆在本機；非主力，用於 Codex 不適任的模糊題 |
| §3 挑戰者行為事實 | **自建（已含實測）** | [model-facts-challenger.md](./model-facts-challenger.md) | 含本機版本釘點與 WSL2 timeout 血淚 |

### 基礎設施

| 藍圖元件 | 決策 | 落點 | 理由 |
|---|---|---|---|
| §15.0 語意索引 | **採用**：codegraph MCP | 全域 settings 已授權 7 個唯讀工具；索引健康（537 檔／10578 節點／26MB，2026-07-06 實測） | scout 影響範圍、搜尋派工、P2 健檢後端。v2 的 serena 建議在本機反轉（見上） |
| §5 排程迴圈 | **設計不啟用**：/loop、/schedule（builtin） | dispatch-rules.md 記載啟用條件 | 鐵律 5：metrics 累積 2-3 週＋安全網驗證過才開無人值守 |
| 狀態外部化 | **自建** | `pipeline-state.json` ＋ `.claude/devkit-local/`（symlink 至 Claude memory 旁目錄） | gstack context-save 落 `~/.gstack`（跨機不可攜＋格式不符）；且本環境有「untracked 檔案被吃」前科，個人層放 repo 外最穩（同 `.agent-memory` 既有模式） |
| §12 教訓庫 | **自建＋分工** | repo 共享層：[lessons/](./lessons/)（一課一檔）；使用者私有層：Claude memory bridge（`.agent-memory/`，僅 controller 可寫，既有規約） | gstack /learn 是單一 JSONL＋落 ~/.gstack，格式與歸屬皆不符。分工判準見 [maintenance-protocol.md](./maintenance-protocol.md) |
| 機制文件查詢 | **採用 builtin** | claude-code-guide agent、`/claude-api` skill | 寫 skill/hooks 前查現行規格 |
| 並行派工 | **採用 harness 原生** | Agent tool（general-purpose／Explore／Plan／caveman 三件套；同回合多呼叫＝並行。Workflow 型編排工具是否可用依 harness 版本而定，用前查） | 多代理授權由使用者訊息逐 session 給；本安裝已獲授權 |
| P2 健檢工具 | **不採用** gstack /health | P2 自建報告（repo validators 已是更強的健檢面） | knip 四維 vs 204 支專案特化 validator，後者壓倒性 |
| 毀滅性防護 | **備考不接線** gstack /careful /guard | — | repo 已有 pre-commit gate＋permission mode；PreToolUse git 字串攔截有已知誤匹配坑（藍圖 §15） |
| 供應鏈審計 | **備考** gstack /cso | §8 新依賴關卡需要審查清單時派用（去自家豁免＋禁自驗降級，照 v2 包裝條件） | 低頻需求 |

### 域內工具（不歸 devkit 管，照既有 CLAUDE.md 路由）

`module-boundary-design`／`safe-refactor`／`data-contract-review`／`demo-operability`（papers workspace 4 支，CLAUDE.md §7 既有路由）、frontend-design、ARS 論文系、academic-ppt、browse/browser-use。devkit 模板遇到對口任務時**引用**它們，不重複其內容。前端工作一律先過 `docs/frontend-change-contract.md`（repo 原生 SACRED，優先序高於 devkit 模板）。

## 本機釘點（沿用前先核對，漂移即重審）

- Claude Code CLI `2.1.201`；預設模型 Fable 5（全域 settings）；effortLevel：全域 medium、本專案 local xhigh
- gstack `33cb4715` v1.39.2.0（/home/u24/papers/skill/gstack）
- codex-cli `0.142.5`、gemini-cli `0.45.3`、agy `1.0.16`
- codegraph MCP：全域 settings 授權；索引 537 檔（2026-07-06）
- ai-devkit skill `0.16`；發佈 repo `/home/u24/papers/ai-devkit`
- repo 原生 gate：pre-commit=`validate:governance`；CI=`governance.yml`；HEAD `a7af62a`
