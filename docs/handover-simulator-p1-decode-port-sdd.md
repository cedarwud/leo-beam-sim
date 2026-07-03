# P1 — Decode 引擎移植 mini-SDD（auction_decode.py → TS + parity gate）

> **狀態**：草案待過目（2026-07-03）。上游：[handover-simulator-final-plan.md](./handover-simulator-final-plan.md) §3-P1。
> **原則**：vendor-on-demand 的 decode 版——移植 + 來源側 golden + 零漂移 gate；**不是**重寫。
> 過目通過後才動 code；一個 PR 一個關注點（本 SDD = 一個 PR：decode 模組 + fixtures + gate）。

## 1. 目的與範圍

把 producer 的決策核心 `modqn-paper-reproduction/src/modqn_paper_reproduction/route_b_factorial/auction_decode.py`（148 行、純 numpy、per-frame 無狀態、frozen）逐語意移植成純 TS 模組，讓前端能在錄下的 dense Q 上**當場重跑** argmax / auction 兩種 decode（＋ω 重加權、k_cap 變更），並以 parity gate 鎖住「與 Python 原版 bit 級同判」。

**範圍內**：4 個函式移植、ω scalarizer、fixtures、golden 產生器、`validate:modqn:decode-parity` gate。
**範圍外（明確非目標）**：任何 render/lane/UI 接線（P2/P3）、任何對 producer repo 的修改、任何「改進」decode 行為。

## 2. 來源真相

| 項 | 值 |
|---|---|
| 來源檔 | `route_b_factorial/auction_decode.py`（唯讀；產 golden 時 import，不改動） |
| 函式 | `valuation(states, masks, n_actions)`、`decode_a0_argmax(V)`、`decode_af_physical_auction(V, slot_cell, l_w, k_cap, grid_count, *, shift_to_nonneg, return_audit)`、`column_greedy_decode(V_Q, slot_cell, l_w, k_cap, grid_count, *, decode)` |
| Provenance | golden 檔記 producer repo 的 `git rev-parse HEAD` + 來源相對路徑 + 產生時間 |

`valuation()` 是訓練側的 SNR rate-proxy 入口；前端輸入永遠是**錄下的 V**（= ω·objectiveQByAction 或匯出的 scalarized），所以 TS 版 `valuation` 只移植做 parity 完整性，不進前端資料流。

## 3. 模組佈局

```
src/modqn/decode/
  auctionDecode.ts    # 4 函式逐語意移植（唯一實作檔）
  scalarize.ts        # scalarizeQ(objectiveQByAction, ω, mask, sentinel) → V 列
  types.ts            # V 矩陣 / DecodeParams / AuctionAudit / golden 檔型別
  index.ts
  fixtures/
    goldens/*.json    # python 產（§6）；含 provenance 標頭
scripts/
  gen-decode-goldens.py          # golden 產生器（§7）
  validate-modqn-decode-parity.ts # gate（§8）
```

**純度鐵則**：`src/modqn/decode/` 禁 import React / three / `viz/` / `app/` / `scene/`（kill-switch audit 同款；gate 內含此斷言）。資料表示：`V: Float64Array` + `(U, A)` 尺寸欄位（列主序）；JS number 本即 IEEE-754 double，與 numpy float64 同精度。

## 4. 逐語意移植規格（本 SDD 的核心——每條都是 fixtures 要覆蓋的行為）

1. **無效動作表示**：V 中 invalid = `-Infinity`。argmax 前做 `neginf → -1e18` 替換（Python `np.nan_to_num(neginf=-1e18)` 同值）。
2. **argmax tie 語意 = first-max**：`np.argmax` 回傳第一個最大值 index。TS 迴圈用**嚴格大於**才更新（`v > best`），天然 first-max。
3. **slot 對映**：`l_of_a = floor(a / beamsPerSlot)`，`beamsPerSlot` 由 `DecodeParams` 帶入（route-b 常數 = 7；來源硬編碼 `a // 7`，參數化但預設 7，golden 全在 7 驗）。
4. **physical column key**：`key[u][a] = l_of_a[a] * gridCount + slotCell[u][a]`。
5. **uniq + searchsorted 語意**：Python 對 valid keys 做 `np.unique`（排序去重）→ `np.searchsorted` 對映。**注意 `all_j = searchsorted(uniq, key)` 作用在全部 (u,a)（含 invalid），不在 uniq 中的 key 得到插入點、再 `clip(0, n_lc-1)`**——invalid 的垃圾 index 無害（後續 `elig = valid && opened[all_j]`，valid=false 吃掉）。TS 必須用 **sorted array + 二分插入點 + clip** 重現，**不可**用 Map 查找（Map 對缺鍵無插入點語意）。
6. **outside option / shift（FOLD-2，兩模式）**：
   - `shiftToNonneg=false`（AF gate-control）：`best_val0 = 0`，`tol = 1e-12`（絕對）。
   - `shiftToNonneg=true`（learned 路徑，**前端預設**）：`best_val0[u] = min finite V[u,:]`（該 user 最差有限候選；全 -inf 列 → 0）；`tol = 1e-12 * max(1, span)`，span = 有限的 `V - best_val0` 的 (max−min)。
7. **greedy open 迴圈**：`gains[j] = Σ_u max(best_on[u][j] − best_val[u], 0)`（-inf → 貢獻 0）；已開 column 與 `open_count[l] ≥ kCap` 的 column 設 gains = −1（排除底板）；`jstar = argmax(gains)`（first-max）；`gains[jstar] ≤ tol` → 停；否則開 jstar、`open_count[l]++`、`best_val[u] = max(best_val[u], best_on[u][jstar] if finite else −inf 不變)`（**不 reset 向 0**）。
8. **指派**：`elig = valid && opened[all_j]`；有 elig → 該列 elig 內 argmax（同條 1/2 規則）；無 elig → **fallback = 全列 masked argmax**（`decode_a0_argmax` 同款；cap-bump 是 env 的事，前端只計數）。
9. **audit**：`nFallback`、`openedPerSlot[l_w]`、`demandedPerSlot[l]`＝該 slot 被選中 action 的 distinct cell 數（`cell_ids[u] = slotCell[u][out[u]]`）。
10. **`column_greedy_decode` dispatch**：`'argmax'` → 條 1/2；`'auction'` → 條 3–9 with `shiftToNonneg=true`；未知值 throw。
11. **決定性**：無隨機源；同輸入重跑輸出逐 index 相等（gate 驗兩次呼叫）。

### ω scalarizer（前端重加權入口）

`scalarize.ts`：`V[u][a] = ω_thr·q1[a] + ω_ho·q2[a] + ω_lb·q3[a]`（per user 的 objectiveQByAction），invalid（mask=false）→ `-Infinity`（**不是** sentinel 值：sentinel `-1e9` 是 export 的填充表示，讀入時以 mask 為準轉 -inf，避免 sentinel 參與加權後仍可比大小的假象）。對「錄下 ω」的 scalarize 結果須與匯出的 `scalarizedQByAction` 在 `1e-6` 相對容差內一致（fixtures b 驗）。

## 5. 兩種資料形狀（adapter 邊界，寫死避免 P2/P3 誤用）

| 形狀 | 來源 | 能重跑 |
|---|---|---|
| **per-user 列**（現有 `dense-q-proof-window-600-130` JSONL：每列 = 1 user 1 slot 的 A=28 dense Q） | Family-B argmax 家族 | argmax + ω 重加權（per-user 獨立）✓；**auction ✗**（缺 slotCell/decodeParams，且 auction 需同 slot 全 U 聯合） |
| **per-slot 矩陣**（U×A + slotCell + decodeParams；H2 新契約） | route-b arms | argmax + auction + ω + k_cap 全部 ✓ |

P1 以形狀一驗 argmax/scalarize（真資料），以合成 + Python golden 驗 auction；形狀二的真資料 parity 在 H2 落地後補一組 fixtures（同 gate，加檔即可）。

## 6. Fixtures 矩陣（全部進 `validate:modqn:decode-parity`）

**a. argmax self-check（真資料，1000 列）**：對 dense-q window 每列斷言 `argmax(masked scalarizedQByAction) === selectedActionIndex`（tieBreak = `scalarizedQ-desc-actionOrder-asc` = first-max 語意）。資料自身帶 `selectedActionCrossCheck` 欄，雙重印證。
   **資料路徑 = 既有 staging 慣例**：`/tmp/leo-beam-sim/modqn-bundles/dense-q-proof-window-600-130`（與 `phase7e-dense-q-proof-replay-state` 同一 symlink；缺檔 → gate FAIL 並印重建指令，不 silent skip）。⚠️ /tmp 重開機會被清（P0.5 實測 phase7e 因此紅過一次）——gate 錯誤訊息必須自帶 `ln -sfn` 修復指令。

**b. ω-rescalarize 一致性（真資料）**：以每列錄下的 `objectiveWeights` 重算 scalarize，與 `scalarizedQByAction` 逐 action 比（相對 1e-6；invalid 位置跳過）；再驗 argmax 同選。

**c. auction goldens（Python 產，合成案例——每條規格至少一案例）**：
   - 基本開櫃：2 slot × 3 cell、U=6，k_cap=1/2 對比
   - **負 Q** 全域（shift on 開得出 column；shift off 全 fallback）— FOLD-2 的存在理由
   - **per-user 偏移不變性**：對某 user 全列 +C，選擇不變（shift on）
   - **tie gains**：兩 column 同 gain → first-max column
   - 全 -inf 列（該 user fallback）＋**全表 -inf**（`fu.size==0` 早退路徑：全員 fallback argmax + audit 全 0）
   - k_cap ≥ column 數（等效不設限）；k_cap=0（全 fallback）
   - `demandedPerSlot`/`openedPerSlot`/`nFallback` audit 全比對
   - shift on/off 同 V 對照
   - 規模案例：U=100、A=28、隨機 V（固定 seed 由 golden 產生器持有；TS 側只讀 golden，不生隨機）
   
**d. 決定性**：任一 golden 重跑第二次，輸出（含 audit）deep-equal。

## 7. Golden 產生器（`scripts/gen-decode-goldens.py`）

- `sys.path` 指向 producer `src/`，`import auction_decode`（**唯讀**；不寫任何檔到 producer repo——遵守「不從 leo 改 producer」規則）。
- 每個案例輸出 `{provenance:{producerRev, sourcePath, generatedAt, caseId}, params, inputs:{V(以 null 表 -inf), slotCell, ...}, expected:{argmaxOut, auctionOut, audit}}`。
- JSON 的 -inf 表示：`null` → 讀入還原 `-Infinity`（JSON 無 Infinity；寫死在 types.ts 註解 + loader）。
- 手動執行（非 CI 步驟）：golden 是 committed fixtures，重生只在來源 decode 變動時（它是 frozen，預期 = 永不）；gate 檢查 provenance 欄存在，防「手改 golden」。

## 8. Gate：`validate:modqn:decode-parity`

- `package.json` key + `scripts/validate-modqn-decode-parity.ts`（`node --import tsx/esm` 同現行 pattern）→ `validate:static:all` 自發現名冊自動涵蓋，不會 orphan。
- 斷言**行為不 source-pin**（contract Rule 4）：跑 fixtures 比輸出，不 grep 實作字串。唯二結構性斷言：decode 模組不 import React/three/viz/app/scene（純度）；golden 檔帶 provenance 欄。
- 秒級（純計算），可日後併入 pre-commit `validate:governance`——P1 先只掛 static:all，避免動 governance 聚合（Rule#9 atomic 另議）。

## 9. 驗收（過目點）

1. `validate:modqn:decode-parity` 全綠（a–d 全套）。
2. 1000/1000 真資料 argmax self-check。
3. `tsc` + lint 過；pre-commit gate 綠。
4. 純度斷言過（無 render 相依）。
5. **不碰**：render plan、lane、UI、`s0:geometry-trace` golden、任何 producer 檔。

## 10. 風險備忘

- **searchsorted 插入點**（§4-5）是最易錯點——合成案例特別含「invalid key 不在 uniq」的列。
- **浮點順序差**：Σ gains 的累加順序 Python（np.sum 成對/向量化）vs TS（線性迴圈）理論上可差 ULP → tie 邊界翻 column。緩解：golden 案例避免「gain 差 < 1e-9」的病態構造（除了顯式 tie 案例，其 tie 是精確相等）；真資料形狀二 fixtures 落地時若見 ULP 翻案，升級成 Kahan 求和再議（先不預付）。
- dense-q window 的 `objectiveWeights` 若全窗同值，fixtures b 對 ω 變化的覆蓋弱 → 合成案例補 3 組非錄下 ω 的 argmax 對照（Python golden 產）。
