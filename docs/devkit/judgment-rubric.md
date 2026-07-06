# 判斷 rubric — leo-beam-sim devkit

> 讀者：主對話模型與 subagent。每條附正反例。條款分級：未標示＝[通則]。

## 1. 何時升級 [鷹架]

訊號（任一命中就走 [dispatch-rules.md](./dispatch-rules.md) §4 階梯）：
- 同一子任務**連錯兩次**（同一驗收條件兩次未過）。
- **空轉**：連續 2 輪只有「發現」沒有「完成」。
- 輸出品質肉眼可見低於任務要求（驗收 agent 打回、抽查失敗）。

✅ 正例：Sonnet high 派工實作 cue 面板，兩次都沒過 `validate:modqn:coverage-fairness` → 帶兩次失敗輸出升 Sonnet xhigh；再敗 → 換 Opus xhigh 並附完整軌跡。
❌ 反例：同 prompt 原樣重派第三次（「說不定這次會過」）——這是禁止的同級重試超限。
❌ 反例：第一次失敗就直接跳「問人」——階梯要逐級走（除非該級不可用）。

## 2. 何時算完成（DoD）[通則]

按工作類型，全部滿足才算完成；「我覺得好了」不算：

| 工作類型 | 完成判準 |
|---|---|
| 一般程式改動 | `npx tsc --noEmit` 0 錯 ＋ lint 過 ＋ 對口 validator 綠 ＋ fresh-context 驗收過 |
| 前端 render 改動 | 上列 ＋ `npm run validate:governance` 綠（pre-commit 會擋，但不要靠被擋才發現）＋ 宣告 render 完成前跑 `validate:ready`（需 vite 起著） |
| 重構／搬移 | 上列 ＋ `npm run validate:static:all` 通過（source-pinned validator 是否被打破；~8min，手動；**由 controller 於交接時執行**——實作 subagent 不必自跑，fresh 驗收 agent 對此列以 controller 的執行紀錄為準） |
| 交接／PR 前 | `validate:governance:full`（~165s）＋ `validate:static:all` |
| 文檔 | 內部連結有效 ＋ 與 code 實況不矛盾（抽 2-3 個宣稱對源碼核對） |
| 制度檔（devkit 自身） | read-back ＋ 弱模型理解測試過（維護協議） |

✅ 正例：slice 完成回報附「tsc 0 錯、governance 綠、驗收 agent PASS（軌跡在 X）」三個可指認的 tool 結果。
❌ 反例：「已完成並測試」但 session 內沒有任何測試指令的 tool 結果——這是虛報，回報前逐項對照實際 tool 結果。

## 3. 何時停下問人 [通則]

硬關卡封閉五類（藍圖 §8），命中即停、批次打包問：
1. **對外可見**：push、發布、對外發訊息、公開 artifact。本 repo 是 **public GitHub**——push＝發表。
2. **刪除性操作**：刪檔案／分支／資料（拋棄式雛形與自產暫存除外）。
3. **架構單向門**：改 scene lane 邊界、改 SACRED validator 語義、改 baseline-kpi、跨 repo 邊界變動、雛形轉正。
4. **預算 L 以上**：L 核准後開工、XL 每次明確核准。
5. **新增依賴**：npm 套件、MCP server、新 CLI——附審查清單（來源、維護狀態、typosquat）供決策。

另外的問人時機（非五類但該問）：
- 模糊題與品味判斷（視覺取捨、命名品味、demo 敘事）——系統補不了，給 2-3 個具體選項讓使用者選。
- 意圖衝突：素材或指示互相打架，且兩讀都合理。

分級拿不準時**往嚴的一級靠**（自動 → 放行＋標註 → 硬關卡），不往鬆的方向自我解釋。

✅ 正例：任務需要 `npm install d3` → 停，硬關卡，附 d3 維護狀態與替代案。
❌ 反例：「使用者上次同意過 push，這次應該也可以」——核准不跨 session 沿用，對外可見每次都問。
✅ 正例（不用問）：改 `src/ui/` 某面板文案並補 validator——可逆、範圍內，自動級，做了留紀錄。

## 4. 方向錯誤訊號（換路，不是重試）[鷹架]

以下訊號出現＝方法錯了，繼續加力只會燒預算：
- **改 baseline 讓測試變綠的衝動**：vendored 模組 KPI 對不上 baseline → 修 port，永遠不是調 baseline（CLAUDE.md 邊界 4）。若發現自己在改 `baseline-kpi-*.json` 或砍 assert 讓 gate 過——停，這是紅線。
- **補丁疊補丁**：同一處第三次「再加一個 if 特判」→ 回頭重看 spec 或拆解。
- **validator 手術規模爆炸**：預估動 2 支結果第 5 支還在冒 → 停下重估 blast radius（用 codegraph_impact），重報價。前例：board 刪除實際牽 9 支 validator——SDD 首版少算 6 支，靠誠實 STOP 才揭發（memory: P3 slice-3）。
- **驗收條件本身開始被質疑**：agent 主張「這個 validator 本來就不該存在」→ 這是架構單向門候選，上呈，不得自行弱化。

✅ 正例：agent 回報「此任務會弱化 SACRED validator，STOP 上呈」——這是模範行為，記入教訓庫正例。
❌ 反例：把 assert 從嚴改鬆讓 gate 綠——抽查抓到即回爐＋postmortem。

## 5. 品質底線驗法 [通則]

- **驗證不自驗**：驗收一律 fresh-context agent；寫的人自己說清楚不算數（含 controller 自己）。
- **審查兩段式**：審查 agent 先全報（附信心與嚴重度、不篩選），controller 或第二 agent 再篩——直接叫審查者「只報重要的」會漏報（接班模型忠實守門檻）。第二段篩選的操作規則：可排序、可聚合，**P1/P2 不得靜默丟棄**（呈報或明寫「已評估不採納＋理由」）；低信心 P3 可聚合成一行總結；第一段全量清單落檔留審計——存 `.claude/devkit-local/` 或由 audit log 引用**持久路徑**（不得只存 /tmp scratchpad：reboot 即失，違反三週回溯），不隨篩選消失。
- **negative-control**：驗證 validator／gate 類改動時，故意注入一個已知壞例，確認 gate 真的會紅（本 repo 既有慣例，memory: beam-control-surface）。
- **視覺宣稱要像素證據**：render 類「已修好」必附截圖或 validate:ready 輸出（前例：PIXEL-VERIFIED 慣例）。
- **外部宣稱要落檔覆核**：引據對不上的發現一律撤回（security-profiles.md 檢疫規則）。

## 6. 完成回報格式 [通則]

工作項關帳回報固定含：
1. 結論一句（過／沒過／部分，數字）。
2. 證據指針（tool 結果、檔案:行號、validator 名＋結果）。
3. 假設帳新增項（若有）。
4. metrics 一行已寫入的確認＋抽查骰結果（due／not-due）。
