# C-120 欄位與英文術語解釋契約

本檔只供簡報製作與 QA 使用，不得直接複製到投影片或 speaker notes。

## 第一原則

任何英文欄位、介面標籤、程式常數或縮寫首次出現時，必須同頁提供中文名稱與技術用途。不得以一串英文欄位、箭頭鏈或縮寫代替教學說明。

## 欄位最小解釋

每個欄位至少交代：

1. 中文名稱。
2. 資料來源或產生位置。
3. 值的意義與單位；無單位時明示為識別碼、分類或布林狀態。
4. 在操作或因果鏈中的作用。
5. 判讀限制；以正向證據分類表述，不使用辯解式警語。

每頁欄位數超過可用的 24 pt 文字容量時拆頁。不得以縮小字體或只列欄位名稱處理。

## 介面控制項最小解釋

每個按鈕或選擇器至少交代：

- 執行的動作。
- 讀取或寫入的資料。
- 成功後畫面或 workbook 的變化。
- 驗證失敗時維持不變的資料。

## P036 修訂契約

標題：`執行結果如何進入重播與工作簿`

- `scenario_id`（情境識別碼）：指出使用哪一份固定 scenario 定義；屬於字串識別碼，不是能量值或執行結果。
- `RUN`（執行）：runner 以指定 scenario、case 與 policy 執行，輸出 `result.json` 及同目錄的 `endpoint-replay.json`。
- `REPLAY`（事件重播）：依同一次 run 的 events 顯示 action、radio state、queue 與 packet 時序；不重新執行 policy。
- `WORKBOOK`（比較紀錄）：保存 baseline、candidate、freeze 與 withheld 的 prediction、result/replay lineage 與 interpretation。
- 一致性核對使用 `scenario_id`、`run_id`、policy identity、units 與 provenance；不得宣稱單一 `scenario_id` 足以綁定整條鏈。

## P039 修訂契約

標題：`Lab A：等待空檔的 radio state 比較`

- 固定條件：scenario、case 工作量、service window、seed、endpoint energy model 與 `PACE_GAP_STEPS = 2`。
- Baseline：`REST_DURING_GAP = SLEEP`。
- Candidate 唯一修改：`REST_DURING_GAP = WAIT`。
- `SLEEP`（低功耗休息）：降低空檔功率，後續可能產生 `WAKE` transition cost 與 latency。
- `WAIT`（清醒閒置）：radio 維持 awake idle，減少部分喚醒轉換，但累積 awake-idle energy。
- 比較欄位：state duration、wake event／energy、packet outcome、service result 與 `endpoint_energy_j`。
- 結果敘述必須連結「唯一修改 → state 變化 → packet/service → endpoint energy」，不以單一 J 值代替機制解釋。

## QA

- 禁止無中文解釋的英文欄位牆。
- 禁止以 `A → B → C` 標題取代各節點定義。
- 禁止在未定義 `SLEEP`、`WAIT`、`RUN`、`REPLAY`、`WORKBOOK` 前直接提出比較問題。
- speaker notes 必須提供可直接朗讀的連貫解釋，不得只是重複欄位名稱。
