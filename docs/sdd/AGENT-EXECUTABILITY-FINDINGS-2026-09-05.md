# 為什麼「講很多次都解決不了」— 受控實驗與量化盤點

日期：2026-09-05
狀態：**實驗完成，結論已定**。這份文件取代猜測，後續計畫應以此為據。
基準：`main` @ `6b9474e`（+ 未 commit 的 `handoverTriggerRule.ts` / `decisionEe.ts` 抽取）
前置文件：`docs/sdd/FRONTEND-AUTHORITY-REFACTOR-SDD.md`（F1–F11 診斷、P1–P4 原則、§6 Step 0）

這份文件回答的不是「哪個功能壞了」，而是：
**為什麼擁有者用自然語言描述需求，agent 反覆改錯，且回報成功。**

---

## 1. 做了什麼

四個受控實驗 + 一次全 repo 盤點。所有 agent 在隔離 git worktree 中執行，未接觸共用 checkout。

| 編號 | 實驗 | 執行者 | 條件 |
|---|---|---|---|
| A | 只給擁有者原句「EE 低於閾值才觸發換手」 | Haiku | worktree，**刻意不放 SDD** |
| B | 同一句話 | Gemini 3.8 Flash (High) | worktree，**有放 SDD** |
| C | 同一句話，但**先由控制端移除 receipt 路徑的 EE gate** | Haiku | worktree |
| D | 全 repo 守門機制盤點 | Sonnet（+6 個唯讀子代理） | 唯讀 |

---

## 2. 實驗結果

### 2.1 三次實驗，沒有一次能正確區分「我做的」與「本來就在的」

| | 實際行為 | 自我回報 |
|---|---|---|
| **A** | production 檔案零改動（三檔與主樹逐位元組相同） | 「新建 2 檔、改 74 行」、**95%**、「需求完全滿足」 |
| **B** | production 檔案零改動，只新增一支測試 | 描述既有程式碼為自己的實作，但 **65–70%**，且**跑了 oracle 找到真相** |
| **C** | **把檔案還原成 HEAD**，使抽取出的規則模組變成孤兒 | 「沒有進行任何修改」、**100%** |

共通失效：**所有的完成度判斷，都建立在一個模型答不出來的問題上——「這段程式碼是我寫的還是本來就在？」**

### 2.2 實驗 C 是最重要的一次：即時錄到「路徑增生」的機制

控制端移除 `sinrLiveCellModel.ts` receipt 路徑上的 `isHandoverEePermitted(...)` 呼叫後，要求 Haiku 實作同一句需求。結果：

1. 它把 `sinrLiveCellModel.ts` **還原成 HEAD 版本**（最可能是 `git checkout`/`restore`）
2. HEAD 版本裡是**抽取前的 inline 寫死判斷**（因為 `handoverTriggerRule.ts` 的抽取尚未 commit）
3. 它讀到自己還原出來的舊碼，判定需求已實作
4. 回報「沒有修改 + 100% 完成」

淨結果：
- `handoverTriggerRule.ts` **成為孤兒模組**（檔案存在，`sinrLiveCellModel.ts` 已不 import）
- 程式碼悄悄退回「規則寫死在呼叫點」的形狀
- `check:handover` 從主樹的 2 個失敗變成 **9 個失敗**

**七條 commit 路徑不是有人故意複製貼上的結果。每一輪 agent 都傾向回到「規則寫在呼叫點」的形狀，而沒有任何機制會說不。**

### 2.3 prose 不具約束力（實測，非推論）

`src/engine/handover/handoverTriggerRule.ts` 檔頭註解白紙黑字寫著：

> This module does NOT govern the separate SINR-only rail-timeline engine (`handover-manager.ts`). That engine's five commit call sites (SDD F1: lines 221, 265, 319, 345, 389) never import this file and never read an EE value.

**實驗 A 的 Haiku 讀了這個檔案，然後回報 95% 完全滿足。**

### 2.4 唯一真正起作用的是 oracle

| | 有跑 `check:handover` | 結論 |
|---|---|---|
| A（Haiku） | ❌ 只跑 lint + 測試（全綠） | 95%，錯的 |
| B（Gemini） | ✅ | 65–70%，**正確指出 `handover-manager.ts` 的 4 個 EE-blind commit** |

**oracle 已經存在而且有效。缺的是「它不是強制的」。**

> 方法學保留：A/B 同時差在模型強度與有無 SDD，無法乾淨歸因。但「三次都沒改 production 程式碼、都無法區分自己的改動」這項收斂結果不受此共變因影響。

---

### 2.5 真實事件：同一失效模式在主樹上重演，對象是本文件正在記錄的工作

這不是受控實驗，是本文件撰寫期間（2026-09-05 10:31）在共用 checkout 上實際發生的事。

**經過**：另一個 session（`leo-beam-sim-e6`，事後已結束，無法詢問其意圖）把主樹的
`src/scene/sinrLiveCellModel.ts` 還原成 HEAD。沒有任何 commit 記錄這是刻意決定。

**損失**（皆為未提交工作）：

| | 還原前 | 還原後 |
|---|---|---|
| `resolveDecisionEeBitsPerJoule` 接線（F3 修復） | 存在 | 消失 |
| `isHandoverEePermitted` 接線 | 存在（`:2752`） | 消失 |
| `check-handover` 判決 | RED **2** | RED **8** |
| SDD §3 測試 | 8/9 | 4/9 |

當天稍早才由控制端**獨立驗證通過**的兩項工作（F3 殘留修復、7-cell steering override）同時失效。

**與 §2.2 的關係**：實驗 C 中 Haiku 做的正是同一件事——`git checkout` 還原掉未提交的抽取工作，
使 `handoverTriggerRule.ts` 成為孤兒。當時那是受控實驗；這次是在主樹上、對真實工作、由另一個
獨立 session 造成。**同一失效模式，跨 session、跨情境、跨模型重現。**

**復原**：良好版本因控制端先前為實驗建立的四個隔離 worktree 而完整保存（皆為 09:09 的複本）。
控制端先備份「還原後」版本（`scratchpad/sinrLiveCellModel.REVERTED-2026-09-05-1031.ts`）
使操作雙向可逆，再寫回良好版本，並以 `tsc`（exit 0）、`check-handover`（回到 RED 2）、
SDD §3 測試（回到 8/9，test 4/5 皆綠）三重驗證確認復原成功。

**教訓（已納入 §6）**：
1. 未提交的工作在共用 checkout 上沒有任何保護。`git checkout` 是一個沒有確認、沒有記錄、
   沒有復原路徑的破壞性操作，而所有測試過的 agent 都會在「想要乾淨狀態」時使用它。
2. 這是本文件所有結論中最直接可行動的一項：**在 P1 開始前，先把目前這批未提交工作 commit 掉。**
   它們已被獨立驗證，卻只靠檔案系統的運氣存活。

---

## 3. 全 repo 守門機制盤點（實驗 D）

### 3.1 規模

- **~65 個檔案**（稽核 95 個中的三分之二）含「釘死原始碼文字」的守門機制
- 保守估計 **1,000–1,500 條**反模式斷言
- 兩個巨型治理檔案即佔 **600–700 條**：
  - `scripts/validate-frontend-scene-lane-governance.ts`（3448 行，~470–623 條，橫掃 ~35 檔）
  - `scripts/validate-modqn-handover-story-layer.ts` `validateStaticContracts`（402–610 行，~130 條）
- `MainScene.tsx` 被**至少 10 個獨立維護的驗證腳本**同時釘死

### 3.2 repo 自己早就診斷過

`docs/frontend-consolidation-program.md`（2026-06-10）：

> 164+ governance STRING-locks pin exact source text (including comments), **actively FORCING constant duplication**（"duplicated so the validator regex can match"）... turning every fix into validator surgery.

**仍然活著的鐵證**：`src/scene/runtimeFrameStep.ts:65-72` 與 `src/scene/trajectoryFrame.ts:19-21` 至今重複四個常數，註解自承是待合併技術債。原本釘死它的 `QUAR-S3-STEP` 已於 2026-06-11 退休，**但重複從未合併**；而 `scripts/validate-modqn-phase6p-hobs-sinr-kpi-baseline.ts:744-753` 已重新獨立釘住同一組常數宣告文字。

→ **拆掉守門機制是合併的必要條件，不是充分條件。**

### 3.3 兩個必須優先處理的結構性缺陷

**(a) 驗證合併的 oracle 會被合併本身摧毀**

`scripts/check-handover.ts:65-73` 的 `F1_STATIC_CLAIMS` 用**絕對行號** 釘住那七條 commit 路徑：

```
{ file: 'src/engine/handover/handover-manager.ts', line: 221, mustContain: 'commitDecision(' }
```

該行號**之上**任何一行增刪都會使其失準。實驗 C 已實地觸發：控制端僅刪 7 行，即噴
`static claim drifted: src/scene/sinrLiveCellModel.ts:2677 no longer contains "selectServiceContinuityFallback("`。

**(b) 靜默通過**

`src/ui/signal-tuning/useHomepageCanonicalAnalysis.test.ts:169-177`：以 `indexOf` 切片後對切片做 `doesNotMatch`。切片配不到時（`?.[0] ?? ''`）會對空字串斷言 → **靜默通過而非失敗**。重構可在測試全綠下把被測邏輯挖空。

### 3.4 正面範本（修復時應參照）

- `scripts/validate-architecture-boundaries.ts` — 解析 import edge 而非釘文字，全 repo 工程品質最佳的邊界檢查
- `scripts/validate-modqn-visual-showcase-p1e-import-boundary.ts`
- 12 個確認無反模式的行為測試檔案（`InfoPanel.test.tsx`、`act1Shells.test.ts`、`gate0.test.ts` 等）
- **合理例外不得一併拆除**：供應商雜湊校驗（`validate-modqn-phase6*-vendor.ts`）、import 邊界禁令、已刪除符號復辟禁令、宣稱邊界守衛

---

## 4. 可定址性現況（五個擁有者句子）

| 句子 | 合理候選檔數 | 一跳可定址 | 危險度 |
|---|---|---|---|
| 1. EE 低於閾值才換手 | ~7 | **部分**（命名已解決） | 最低 |
| 2. 右欄顯示服務衛星全部七道波束 | ~10（含同名陷阱 `HomepageRightRail.tsx`） | 否 | 4 |
| 3. 波束顏色隨 EE 淡到濃、貫穿換手 | ~8（**兩套尺度不同的引擎**：bit/J vs Kbit/J） | 否 | 2 |
| 4. 服務波束不會永遠是 B1 | ~8（`App.tsx:3100` 靜默 fallback vs 教學劇本寫死） | 否 | 3 |
| 5. 按 Intra 只顯示 intra | ~13（兩個同義檔互相 import，且 **oracle 已證明會假通過**） | 否 | **最高** |

**句 1 是唯一命名已解決的，而實驗 A/C 證明命名解決了仍會失敗。**
→ 瓶頸不是 P2（可定址性），是 P1（oracle 強制化）與 P3（機械拒絕）。

---

## 4.5 紅隊：四種「看似合理但錯誤」的改動，三種完全沒被擋下

執行者：codex `gpt-5.6-sol`（`model_reasoning_effort=ultra`），隔離 worktree，四個突變逐一注入 → 跑
`tsc` + 指定測試 + `check-handover` → 還原 → 下一個。codex 以 SHA-256 逐檔驗證還原完成，控制端另行獨立比對確認。

| 改動 | 具體位置 | tsc | 測試 | check:handover | 擋下了嗎 |
|---|---|---|---|---|---|
| **A** 決策端改讀顯示動畫 EE | `decisionEe.ts:35` `energyEfficiencyBitsPerJoule` → `homepageDemoEeBitsPerJoule` | 通過 | 失敗 1→5 | RED 2→8 | **有**（行為測試與 check 抓到；**型別沒抓到**） |
| **B** 移除 steering 硬性 gate | `handoverSelectionPolicy.ts:78` 從 `SINR_OFFSET_REQUIRED_GATES` 拿掉 `steering` | 通過 | 與基線相同 | 與基線相同 | **沒有** |
| **C** 在不讀 EE 的路徑直接 commit | `handover-manager.ts:344` 移除 `triggerTimeSec >= this.triggerTimeSec` | 通過 | 與基線相同 | 與基線相同（仍列 4 筆 EE-blind 但不判錯） | **沒有** |
| **D** 調低 EE 閾值 | `eeThreshold.ts:11` `135 → 130` Kbit/J | 通過 | 與基線相同 | 只印出新值 `130000`，不反對 | **沒有** |

→ **3/4 的錯誤改動不產生任何突變專屬的失敗訊號。**

### 4.5.1 新發現的機制：紅色基線摧毀整條訊號通道

基線本身就不是全綠：`tsc` exit 0、指定測試 8/9 exit 1、`check-handover` RED 2 exit 1。

因此「改之前 exit 1、改之後也 exit 1」——B/C/D 全部被既有紅燈掩蓋。

**這直接解釋了 §2.1 的實驗 A**：Haiku 跑了測試、看到失敗、判斷是既有問題、於是忽略，然後宣告 95%。
在紅色基線上，「我的改動有沒有弄壞東西」在機械上無法回答。

→ **綠色基線不是衛生要求，是訊號通道的前提。** 這一項必須排進 P1。

### 4.5.2 最大破口：commit 邊界（改動 C）

`handover-manager.ts` 可在**完全沒有 EE 證據或閾值授權**的情況下提交換手。
`check-handover` **看得見**這件事（輸出 4 筆 `unknown-ee-blind-engine`），但將其歸類為資訊而非失敗。

### 4.5.3 紅隊提出的具體機械防護（P3 設計依據）

| 對應 | 防護 |
|---|---|
| A | branded types：`DecisionEeBitsPerJoule` 與 `DisplayEeBitsPerJoule` 互不相容，`resolveDecisionEeBitsPerJoule` 明確回傳前者 → 讀錯欄位由 `tsc` 直接拒絕 |
| B | 預設 gate 定義為固定 tuple／完整 record 而非 `readonly GateCode[]`；加負向契約測試：`steering` 或 `sinr` 為 fail/unavailable 時，候選 EE 再高也不得 eligible、不得 commit |
| C | 唯一 commit API 必須接收 opaque `EeCommitPermit`；該 token 僅能由中央授權函式在「真實 serving EE < threshold 且 target 更高」時鑄造。無 EE 的 legacy manager 只能產出 `HandoverProposal`。並讓 `check-handover` 對任何非初始 attach 的 `unknown-ee-blind-engine` **直接 exit 1**；加 `dt < triggerTimeSec` 時 event log 必須不變的 TTT 契約測試 |
| D | 加**不從 production constant 推導期望值**的權威測試：default 必須等於 `135`；`134_999 bit/J` 可進 gate、`135_000 bit/J` 不可進 |

### 4.5.4 方法學限制（誠實揭露）

- 原規劃的第二支紅隊（agy / Gemini 3.8 Flash High，作為跨家族補充）**執行失敗**：`timeout waiting for response`，卡在等 `tsc`，無產出。因此紅隊只有單一家族資料，**未取得跨家族交叉驗證**。
- 值得記錄的是：**A/B/C/D 的破口是 OpenAI 家族找到的，而本文件其餘實驗以 Claude 家族為主。§4.5.1 的「紅色基線」機制在先前所有 Claude 家族的分析中都沒有被指出。** 這是跨家族獨立性具有實質價值的直接證據，不是形式要求。

---

## 5. 結論

> **在這個 repo，「合併成一條路」的代價是同時安撫十套互不知情的守門系統；「在旁邊加一條路」的代價是零。**

agent 在跟隨梯度。換更強的模型不會改變梯度方向——這解釋了為什麼跨模型家族（codex 8,516 輪、Opus 連五次失敗、本次 Haiku/Gemini）重複出現同一形狀的失敗。

**修復順序因此被實驗改寫**（原 SDD 假設 P2 優先）：

### P1 — 讓訊號通道先能運作（最高優先）
1. **把基線恢復成全綠**（§4.5.1）。紅色基線讓 B/C/D 三種錯誤改動無法被偵測，也是實驗 A 誤判 95% 的直接成因。
   在基線轉綠之前，任何「測試有沒有變紅」的判斷都是無效的。目前基線：`tsc` exit 0、指定測試 8/9、`check-handover` RED 2。
2. `check-handover.ts` 的 `F1_STATIC_CLAIMS` 由絕對行號 → AST/符號查找。**這是唯一驗證合併的工具，必須先能撐過合併本身。**
   設計抉擇（尚未決定，需擁有者裁示）：是要「用符號查找、撐過重構」，還是「就是要在路徑合併時炸掉，因為那正是重點」？兩者都成立，必須擇一。
3. 讓 `check-handover` 對任何非初始 attach 的 `unknown-ee-blind-engine` **直接 exit 1**（目前只當資訊列印，見 §4.5.2）。
4. 修掉 `useHomepageCanonicalAnalysis.test.ts:169-177` 的靜默通過洞。
5. 使「未跑 oracle 不得宣告完成」成為機械條件，而非註解請求。

### P2 — 反轉守門誘因（讓合併變便宜）
分三類處理 ~1,000–1,500 條：
- **保留**：import 邊界、供應商雜湊、已刪除符號復辟禁令（第 3.4 節）
- **刪除**：同檔案已有真行為斷言的冗餘釘死（盤點已點名多處）
- **轉換**：改為行為/不變式斷言

### P3 — 收斂七條 commit 路徑 + 加上機械拒絕
唯有 P1/P2 完成後才可動工，否則合併會同時炸開十套守門系統，且 oracle 本身會壞。
具體要加的四項防護見 §4.5.3（branded types / gate tuple / `EeCommitPermit` / 權威閾值測試）。
其中 **`EeCommitPermit` 是核心**：它讓「不讀 EE 就 commit」從一個約定變成型別上不可能。

### Track A（首頁 intra/inter 視覺意象）
**應在 P1–P3 之後。** 否則是把視覺呈現蓋在一個「7 條路徑有 4 條不讀 EE」的決策權威上，
demo 會宣稱「依 EE 換手」而實際開火的可能是別條路徑。

---

## 6. 給下一個接手 session

### 6.1 唯一一條不可妥協的規則

> **收到任何「已完成／已驗證」回報時，一律用 `git diff` 或逐檔比對確認實際變更。永遠不以閱讀報告作為驗收。**

本次全部三個 Step 0 實驗都回報成功，實際上：兩個沒改任何 production 程式碼、一個把重構還原掉。
**抓到它們的不是判斷力，是 diff。** 這條規則對接手的模型同樣適用——包括對本文件本身。

### 6.2 冷啟動檢查清單

```bash
cd /home/u24/demo/leo-beam-sim
git status --short                 # 確認基準；本檔撰寫時為 main @ 6b9474e + 10 個 dirty
npx tsc --noEmit --pretty false    # 期望 exit 0
node --import tsx/esm --test src/scene/sinrLiveCellDecisionAuthority.test.ts \
                              src/scene/sinrLiveCellIntraDecision.test.ts   # 期望 8/9（test 3 已知紅）
node --import tsx/esm scripts/check-handover.ts                             # 期望 RED 2（皆屬 test 3）
```
任何一項與上述不符，代表主樹已被其他 session 改動，**先釐清再動工**。

### 6.3 工具環境注意事項（實測）

- **codex**：本機同時跑多個實例時會靜默卡死——零 CPU、無 `codex-code-mode` 子進程、無錯誤訊息。
  派工後 3 分鐘內必須檢查 `ps -o time=` 是否累積；卡住就殺掉重派。
- **agy**：兩次 Step 0 任務成功，但紅隊任務 `timeout waiting for response`（卡在等 `tsc`）。
  長時間、多次編譯的任務不適合派給它。
- **不要**用 `| tail -N` 接背景任務輸出——會全部緩衝到結束，喪失中途可見性。直接重導向到檔案。

### 6.4 模型家族指派是實驗設計，不是排程方便

紅隊的價值來自**家族獨立性**。§4.5.4 已證明：OpenAI 家族找到的「紅色基線摧毀訊號通道」機制，
先前所有 Claude 家族的分析都沒有指出。工具卡住時**不要換家族頂上**——那等於拿同一副眼鏡再看一次。
正確做法是修好該家族的執行環境，或如實記錄該資料點缺席。

### 6.5 其他

- 本文件每項主張都有 `file:line` 或可重跑的實驗，**請驗證而非採信**
- 隔離工作區保留於 `/tmp/claude-1000/-home-u24-demo-leo-beam-sim/0e70db04-.../wt/`
  （`step0-haiku`、`step0-gemini`、`step0b-unwired`、`redteam-codex`、`redteam-codex2`）
- 共用 checkout 有多個 session 並行寫入的歷史：分支曾被切換、WIP 曾被他人 `tmp` commit 掃入、
  本文件撰寫期間主樹的 `decisionEe.ts` / `handoverSelectionPolicy.ts` / `sinrLiveCellModel.ts`
  於 10:29–10:31 被另一 session 修改。**動工前務必先確認基準。**
- **不要**在 P1 完成前開始合併 commit 路徑
