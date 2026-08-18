# Part B 欄位與術語教學稽核

Status: required rewrite input. This file is production-only and must not be embedded in the PPTX.

## 全域判定

目前 Part B 多頁以英文 token、欄位鏈與箭頭承擔主要敘事，正文定義不足。以下頁面全部依 `field-explanation-contract.md` 重寫；24 pt 文字無法容納時拆頁，不縮小字體。

| 頁面 | 目前理解障礙 | 重寫要求 |
|---|---|---|
| P028 | `SLEEP/WAIT/WAKE/PROCESS/TX/RX` 集中出現 | 每個 state 提供中文名稱、觸發條件、duration 與 energy bucket；說明 action 與 state 的差異。 |
| P029 | 以問題句要求自行推論 | 改為 Lab A 機制總覽；列出固定條件、SLEEP/WAIT 成本來源、service 與 energy 比較順序。 |
| P030 | packet lifecycle 為英文事件鏈 | 定義 generated、queued、attempt、retry、delivered、expired 與 service verdict；至少分成產生、傳輸、結果三段。 |
| P031 | `service gate` 與多個欄位未定義 | 定義 delivered data、deadline、freshness 與 `service_pass`；再說明 endpoint J 的比較條件。 |
| P032–P034 | W、J、state bucket、效率公式集中出現 | 各變數附中文名稱、單位、分子／分母來源；公式使用 editable Office Math；公式後接一個欄位對照示例。 |
| P035 | source/model/assumption/result 為抽象英文字 | 逐層說明資料來源、scenario model、固定假設與 coherent simulated result；provenance 只描述連結內容。 |
| P036 | 單一 `scenario_id` 被說成綁定 RUN/REPLAY/WORKBOOK | 依 `field-explanation-contract.md` 重做；分別定義四個物件，並列出完整 identity 核對欄位。 |
| P037 | baseline/control 與舊截圖形成錯誤對照 | 改為 baseline 技術定義；列固定條件、原始 policy、唯一修改與比較輸出。 |
| P038 | 以「不推導」描述範圍 | 改為 changing-service-window trace 的輸入、欄位與 policy 作用；`contact_open` 等欄位逐一解釋。 |
| P039 | Lab A 標題仍是未定義的 SLEEP/WAIT 問題 | 依 `field-explanation-contract.md` 重做；英文常數與 state 都附中文定義。 |
| P040 | decision chain 欄位密集 | 定義 `contact_open`、`steps_since_send`、`PACE_GAP_STEPS`、`REST_DURING_GAP`，並畫出 baseline 分支。 |
| P041 | 程式常數與命令多於解釋 | 逐行解釋兩個常數；明示唯一修改與對 state 的預期作用；備份、編譯命令分列用途。 |
| P042 | 三個 run 僅以 command ribbon 呈現 | 每條命令附 case 中文用途、輸出檔案與下一步；`result_path` 定義為 stdout 提供的結果路徑。 |
| P043–P045 | identity、ledger 與 packet 欄位牆 | 分頁定義 identity check、energy buckets、packet/service fields；數值附來源標籤與單位。 |
| P046 | freeze/checkpoint/predecessor/active block 未建立 | 定義 freeze receipt、policy checkpoint、predecessor 與 active block；移除 SHA/checksum 教學。 |
| P047–P048 | hidden/counterexample/claim ceiling 抽象 | 定義 withheld case 與 frozen policy；結論使用條件、state mechanism、packet/service、energy 四段客觀句。 |
| P049 | Lab B 以問題句與英文字段開場 | 改為 service-window transition 實驗總覽；先定義 quality trace、enter、hold、exit。 |
| P050–P052 | `ENTER_QUALITY/EXIT_QUALITY/STABLE_STEPS` 與 hysteresis 未完整解釋 | 每頁只處理一組概念；提供中文名稱、值域、比較條件、對 `send_mode_active` 的作用。 |
| P053–P057 | prediction、baseline、edit、run、transition 分散且詞彙未承接 | 明示前頁定義的欄位；各頁列出固定項、唯一修改、輸出位置與事件判讀。 |
| P058 | B freeze 欄位密集 | 沿用 P046 定義，不重複欄位牆；只列 A predecessor、B checkpoint 與 Trace B entry 的關係。 |
| P059–P061 | Trace B、too-slow、ping-pong、claim boundary 抽象 | 定義兩種 failure mode 的事件特徵；結論連結 transition、packet/service 與 endpoint energy。 |
| P062 | lineage/recovery/checkpoint/result_path 混在命令頁 | 以「復原 policy → 編譯檢查 → 重跑 exact case → 取得新 result_path」四步呈現，每步解釋資料變化。 |
| P063 | validator/replay/workbook 為英文流程鏈 | 定義上傳的輸入、網站驗證項、replay 顯示內容與 workbook 寫入內容；逐一說明成功／拒絕後的資料狀態。 |

## 標題規則

- 標題以中文技術主題為主，英文限實際欄位或程式常數。
- 不以問句、對話、命令或辯解式否定當標題。
- 不以未解釋的 `A → B → C` 鏈當標題。

## 驗收

1. 每頁 readback 可找到術語的中文解釋，而非只存在於 speaker notes。
2. speaker notes 可直接朗讀，補足因果與頁面銜接。
3. 每個數值標示 unit 與 artifact source；缺少 current evidence 時以中性狀態標示。
4. 所有文字維持既定 24 pt 基準；需要更多內容時拆頁。
