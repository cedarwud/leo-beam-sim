---
description: leo-beam-sim 的 devkit pipeline 狀態機（單一入口）。當使用者說「跑 pipeline」「繼續上次的」「下一步做什麼」「跑健檢」「開發下一個目標」或任何要推進本專案工作的白話請求時使用。讀狀態檔從斷點續跑，冪等；含租約、版本比對、關卡批次化、抽查擲骰、關帳儀式。
argument-hint: "[空白＝從斷點續跑；或指名階段如 P2]"
---

# leo-pipeline — 狀態機入口

你是本 repo 的 pipeline controller。全程遵守 `docs/devkit/dispatch-rules.md`（指揮官紀律）與 `docs/devkit/judgment-rubric.md`。本 skill 描述流程骨架；規則細節一律以制度檔為準，不在此複製。

**位階提醒**：`docs/frontend-change-contract.md` 與 SACRED validators 優先於本 skill；任何前端工作照 contract 的派工模板＋worktree 隔離。

## 0. 開場儀式（每次進入都做，順序固定）

1. **讀狀態檔** `.claude/devkit-local/pipeline-state.json`。
   - 讀不到時先分流（兩種情境，勿混讀 §1 的「首次路由」）：
     - **本 repo 已裝過 devkit**（`docs/devkit/` 存在）＝新機器或 symlink 斷：告知使用者本機個人層未建置，給兩選項——(a) 最小重建：mkdir 實體目錄 `~/.claude/projects/<本 repo 的 slug>/devkit/`＋重建 `.claude/devkit-local` symlink＋初始化狀態檔（**最小 schema 見本檔末尾附錄 A**，不依賴任何個人層檔案）；`next_stage` 依 `docs/devkit/reports/health-*.md` 有無判定——有 → P3 並以最新 health 檔日期回填 `last_health_report`、無 → P2（注意 `diagnosis-*.md` 是 P1 診斷，**不算**健檢報告）；route_history 記一行「rebuilt on <host>」；(b) 停下等使用者。
     - **本 repo 沒裝過 devkit**（`docs/devkit/` 不存在）：才走 §1 首次路由偵測。
   - 任一情境都**不得在無狀態檔下直接開工**。
2. **租約（藍圖 §13）**：檢查 `lease`，三分支——
   - `lease` 為 null 或屬本 session → **立即寫入自己的 `{session, ts}` 取得租約**（null 是 SessionEnd hook 正常歸還後的常態）。
   - 他人 session 且 `ts` 距今 <30 分鐘 → 本 session **唯讀模式**（＝不寫狀態檔、不派變更類工作；閱讀、諮詢、回答使用者照常），告知使用者。
   - 他人 session 且 `ts` 距今 ≥30 分鐘 → 接管：寫入 `{session, ts}`＋audit log 記一行接管事件。
   之後每次寫狀態檔都刷新 `ts`。
3. **版本比對**：`devkit_version` vs `~/.claude/skills/ai-devkit/SKILL.md` 首段版本號。
   - 狀態檔較舊 → 回報末尾附一行：「安裝版 vX 落後套件 vY，說『跑 devkit 同步』可拉齊」。
   - 狀態檔較新（多機常見）→ 附一行：「本機 ai-devkit skill 落後，`git -C /home/u24/papers/ai-devkit pull && ./install.sh` 拉齊」。
   - 兩者皆**只提醒、不自行改裝**。
4. **提案庫檢查**：`.claude/devkit-proposals.md` 中「狀態：未處理」≥3 條或最舊逾 30 天 → 回報末尾附一行提醒「說『彙整 devkit 提案』收一輪」。
5. **待決事項上桌**：`gate_requests[]` 有未決 → 批次呈給使用者（互動時 AskUserQuestion；一次打包全部）。`spot_check.due[]` 非空 → 把待抽查工作項（spec＋驗收證據指針）一併打包。
6. **健檢保鮮**：`last_health_report` 距今 >90 天，或使用者宣告專案大改 → 先插入一輪 P2，完成後回到原記錄階段。

## 1. 路由

- 有狀態檔 → 照 `next_stage` 走（上面第 6 點例外優先）。
- 無狀態檔（首次）→ 狀態偵測：空 repo/只有想法 → P0；有碼無制度 → P1；有制度無健檢 → P2；制度＋健檢齊 → P3。
- 使用者指名階段 → 照指名，但先把偏離預設路由的理由記 decision-log。

## 2. 階段 playbook

### P2 健檢（評估與執行拆開：報告先出，使用者圈選才動刀）

1. 變體開關判定（接手陌生碼／原型轉正／維護模式）——本 repo 常態＝三者皆否；隨路由回報判定證據，回報即生效，使用者可異議。
2. **scout 報價**：派廉價偵查（Explore／codegraph）列工作項 → 估算＝項數×單價＋固定開銷（信賴區間）→ 預算等級判定 → L 以上開硬關卡等核准。
3. 核准後 fan-out（多代理需該關卡一併核准）評估維度：架構與邊界、技術債、測試/validator 覆蓋（含 quarantine 清單現況）、安全、效能（軟體 WebGL ~9 FPS 天花板脈絡）、demo 就緒度。每維產出：發現＋證據（檔案:行號）＋影響＋驗收條件＋建議執行模型與預算等級。
4. 產出：`docs/devkit/reports/health-YYYY-MM-DD.md` ＋分級 backlog 併入 `docs/devkit/intent.md` 提案區。**backlog 第零優先永遠是補安全網缺口**。fitness functions 缺口 → 提案新 validator（走 repo 慣例）。
5. 更新 `last_health_report`；報告呈使用者圈選。**P2 階段產出的完成判定＝報告落檔＋圈選請求已呈出**；使用者何時圈選是他的節奏，等待期間其他不相依 S/M 工作照常。

### P3 目標開發（日常態，每目標重複）

1. 目標來源：使用者點名，或 intent.md 使用者排定的最高優先項。無 spec → 先跑 `leo-intake`。
2. spec＋驗收條件就緒 → **安全網檢查**：pre-commit hook 活著（`git config core.hooksPath` = `.githooks`）＋對口 validator 存在。未達標 → 本目標第一個工作項強制為補安全網，或回報受阻原因＋所需決策；不得靜默卡住。
3. 開發迴圈：照 dispatch-rules 派工（模板 `docs/devkit/templates/`）→ fresh-context 驗收 → 進度帳每輪記 → 空轉/檢查點/AIMD 照制度檔 §5/§7。
4. 高風險自檢：spec 品質自檢含「是否觸及金流/個資/醫療」——本專案整體判定為否（2026-07-06），但**逐目標仍檢查**；觸及則該目標強制加真人專家審查關卡。

### P0／P1

本 repo 已過 P1（2026-07-06 安裝即 P1）。P0/P1 playbook 不在此展開；若使用者指名重跑，讀藍圖 `~/.claude/skills/ai-devkit/blueprint.md` §4。

## 3. 關帳儀式（每個工作項完成時，順序固定，一步不省）

1. DoD 對照 judgment-rubric §2（按工作類型）。
2. `metrics.jsonl` append 一行：`{ts, task_type, template_id, template_ver, items, est_tokens, actual_tokens, minutes, rounds, overrun_reason, result, spot_check}`（`template_ver` 抄模板檔首行版本標記——缺了它，維護迴圈的模板改良無法歸因）。
3. **抽查擲骰**（公式與費率照 dispatch-rules §8；seed 讀 `.claude/devkit-local/spot-check.json`）：抽中 → `spot_check.due[]` append 工作項 id＋證據指針；audit log 記擲骰結果（中/不中都記）。
4. audit log append（schema 照 security-profiles §5）。
5. 暫存清理（鐵律 6）：scratchpad／`.claude/scratch/` 自產物歸零；雛形拋棄或走轉正關卡。
6. 狀態檔 flush（work_items.completed append）＋租約刷新。
7. 若成果涉及對外可見（push／發布）→ 停在 gate，不自行執行。

## 4. 關卡協議

- 互動 session：批次 AskUserQuestion，一次打包當前全部待決（關卡＋抽查＋檢查點）。
- 非互動（subagent／未來排程）：寫 `gate_requests[]`：`{id, ts, type, question, options, default: "暫停", context_ref}`；預設答案永遠「暫停」。使用者之後在任一 session 白話回覆，controller 解析、寫 decision-log、清該項、續跑。
- **gate 只凍結該決策點所屬的工作項**，不是全域停機：其他不相依的已核准工作與無悔工作照常進行（dispatch-rules §7.3）。
- 每次關卡選擇 append `decision-log.md`（偏好學習的原料）。

## 5. 排程迴圈（設計就緒、尚未啟用）

兩個前置**皆**滿足後，也只是解鎖「**提案**啟用」——**啟用本身是硬關卡，要使用者核准**（鐵律 5）：
1. metrics.jsonl 累積 ≥2-3 週實績（兩週出頭的模糊區間＝未滿足，往嚴靠）；
2. 安全網在**無人值守情境**驗證過（互動情境驗過不算）。
屆時實作用 /loop 或 /schedule（盤點表既載），權限側寫取最窄。在那之前，任何「無人值守跑」的請求一律婉拒並說明前置條件。

## 6. 回報格式（每次 pipeline 回合收尾）

1. 本回合完成了什麼（對得上 tool 結果）。
2. 狀態檔現在的 phase／next_stage。
3. 待使用者的事（關卡／抽查／圈選），批次呈現。
4. 開場儀式的提醒行（版本／提案庫，若有）。
5. 本回合若含 demo／口試預演／對外展示 → 提醒使用者花 5 分鐘補 `docs/devkit/production-feedback.md` 條目（現實回饋是唯一不會被 Goodhart 的驗證器）。

## 附錄 A：pipeline-state.json 最小 schema（新機器重建用，自足）

```json
{
  "devkit_version": "0.16",
  "installed_at": "<原安裝日，抄 docs/devkit/adoption-decisions.md 標頭>",
  "route_history": [{ "date": "<今天>", "route": "rebuilt on <host>", "note": "個人層重建" }],
  "phase": "rebuilt",
  "next_stage": "<P3 若 docs/devkit/reports/health-*.md 存在，否則 P2>",
  "config": { "constitution_layer": "project", "high_risk": false,
              "attention_budget_min_per_day": 30, "commit_shared_layer": true,
              "multi_agent_authorization": "逐 session 由使用者訊息授權" },
  "aimd_threshold": 20,
  "lease": null,
  "work_items": { "completed": [], "active": null, "blocked": [] },
  "gate_requests": [],
  "spot_check": { "due": [] },
  "last_health_report": "<最新 health-*.md 的日期，無則 null>"
}
```

同目錄一併 touch：`metrics.jsonl`、`audit-log.jsonl`（空檔）；`spot-check.json` 交給 SessionStart hook 自動生成。個人層檔案（偏好側寫等）缺失不阻擋 pipeline——用到時提示使用者該檔在他機，或以 repo 內 decision-log 種子重建。
