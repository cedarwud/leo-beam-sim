# 維護協議 — leo-beam-sim devkit

> 藍圖 §12 的執行手冊。條款未標示＝[通則]。

## 1. 誰能改什麼

| 對象 | 可改 | 不可改 |
|---|---|---|
| 使用者 | 一切；意圖檔優先序與提案採納**只有使用者能決定** | — |
| Claude controller（主對話） | 制度檔（過理解測試後）、狀態檔、個人層檔案、Claude memory bridge | ai-devkit skill 資料夾（唯讀；修訂走提案）；MODQN bundle／visual-showcase JSON（重播輸入不可變）；`baseline-kpi-*.json` |
| Claude subagent | 交付物（派工範圍內的 code／docs） | 制度檔（提案經 controller）；`.agent-memory/`（唯讀 context） |
| 非 Claude 模型（Codex/Gemini） | 無（**只出審查意見、不執筆修改制度檔**——Claude 行為規格由它家執筆會滲入它家先驗） | 一切制度檔 |

補充：非使用者提出的「制度檔修改建議」（不論來自挑戰者或 Claude subagent）＝提案，不是修改授權——**本 repo 制度**的提案寫成 pipeline `gate_requests[]` 一筆（type=`institution-change`）或 intent.md 提案區（這兩處才有開場上桌機制）；**套件層**的記入 devkit-proposals.md。**decision-log 只收已裁決的紀錄，不當待辦佇列**（放進去的待決事項沒有任何機制會再浮上來）。使用者核准後由 Claude controller 執筆＋過理解測試才生效。

## 2. 教訓的三個去處（判準）

**第 0 步（先於分流表）：查是否已載明。** 制度檔（docs/devkit/ 各檔，含 model-facts×2）、既有 lessons/、memory bridge 已寫的，不重複記——已載明的教訓沒有第二個去處。例：「codex 千行 diff 會 timeout」已載於 model-facts-challenger.md → 不再記任何一處。

| 去處 | 收什麼 | 例 |
|---|---|---|
| `docs/devkit/lessons/`（repo 共享，一課一檔） | 專案級操作教訓：任何在此 repo 工作的 agent 都該知道 | 「validator 手術先用 codegraph_impact 估 blast radius」 |
| Claude memory bridge（`.agent-memory/`，使用者私有） | 使用者偏好、跨 repo 戰略、專案狀態帳（既有規約：僅 controller 寫入） | 「回覆一律繁中」「P3 NEXT=self-check chip」 |
| `.claude/devkit-local/devkit-proposals.md`（套件提案） | 套件級洞察：與本專案業務無關、**任何專案都會遇到** | 「subagent git stash 吃掉並行工作」 |

教訓格式（lessons/）：一課一檔、檔名 `YYYY-MM-DD-slug.md`、檔首一行摘要、正文寫明為什麼重要＋怎麼應用。已在制度檔載明的不重複記；錯了就刪。分類拿不準：先放 lessons/，「彙整 devkit 提案」時會順掃升格。

## 3. 維護迴圈（排程間隔：每月一次，或 metrics.jsonl 新增 ≥20 行時；現階段手動觸發）

檢查清單（產出是報告＋制度變更 diff，過關卡後生效）：
1. 健檢差異：距上次 P2 報告 >90 天或專案大改 → 觸發 pipeline 健檢保鮮（**強制插入**一輪 P2，語義同 leo-pipeline §0.6，此處非「僅建議」）。
2. 教訓庫膨脹：lessons/ >20 檔 → 精簡（合併、刪過時）。
3. 單價漂移：metrics.jsonl 的估算 vs 實花比對 → 更新 dispatch-rules 的單價註記。
4. 模板 eval：metrics 顯示某模板反覆產出爛結果 → 跑模板改良四步（萃取範例→XML 結構化→補推理引導→強化範例），改後先過 eval 才上線。
5. 偏好側寫編譯：決策日誌新條目 → 更新 preference-profile.md。
6. **制度保鮮**：模型換代（新模型上線／CLI 大版本）→ 重驗 model-facts-*.md 的出處版本，過期條目重查官方文件。官方文件也會過期（實例：prefill 建議已失效）。
7. ROI 淘汰：哪些規則/迴圈成本明顯大於收益 → 提案砍掉（使用者核准）。制度也要能死。
8. 提案庫檢查：devkit-proposals.md 未處理 ≥3 條或最舊 >30 天 → 回報提醒「說『彙整 devkit 提案』收一輪」。

## 4. postmortem 儀式

- 觸發：燒錢超標（熔斷）、出包（逃逸 bug、抽查失敗）、方向性返工。
- blameless：找機制缺口不找戰犯。根因紀律：**無根因不修**——先重現／定位，假說要先驗證再動刀。
- **產出必須是制度變更**：新測試（逃逸 bug 變永久回歸測試——品質棘輪）、新規則、新關卡、單價修正，四選一以上。報告文學不算產出。
- 落點：教訓一課一檔＋制度 diff＋audit log 一行。

## 5. 品質棘輪

- 覆蓋率與 lint 門檻只緊不鬆；每個逃逸 bug 變成永久回歸測試（本 repo 慣例：新 validator）。
- 例外唯一路徑：metrics 證據顯示某門檻成本明顯大於收益，經使用者核准下修並記錄理由——棘輪例外本身視同硬關卡決策。
- 本 repo 既有紅線重申：quarantine 清單裡的 validator 開始通過會讓 `validate:static:all` FAIL（強迫清理）——這是棘輪的一部分，不得為了綠而把 validator 移出 quarantine 卻不修根因。

## 6. devkit 版本同步

- 狀態檔 `devkit_version` 對照 `~/.claude/skills/ai-devkit/SKILL.md` 版本；落後時 pipeline 開場提醒一行，**不自行改裝**。
- 同步永遠由使用者明說觸發（「跑 devkit 同步」）＝智能合併：把版本差異融進本專案客製過的制度檔、過理解測試、更新狀態檔版本。
