# Part C 教學可讀性稽核

Status: controller rejection of current REVIEW DRAFT. This file is production-only and must not be embedded in the PPTX.

## 判定

目前 P064–P099 雖可開啟且使用 `slideLayout2.xml`，但未達直接授課門檻。主要缺陷不是字體，而是英文 token、符號鏈、抽象 cards 與證據警語占據畫面，中文概念、操作用途與結果判讀不足。

## 全域重寫規則

1. 每個英文 field／constant／UI label 首次出現時，同頁附中文名稱、來源、值型態或單位、作用與判讀。
2. 每頁最多引入四個新欄位；超過即拆頁，不縮小 24 pt 正文。
3. 概念頁不得只靠兩個 boxes。至少包含一個主要視覺、中文機制說明與結果判讀區。
4. 比較頁的每個數值均附中文欄名、單位、source 類型與 gate 狀態；不只顯示 baseline／candidate 數字。
5. `/course` 頁優先使用 current screenshot crop，配三至五個編號 callout；每個 callout 說明按鈕或欄位的動作及畫面變化。
6. 移除每頁重複的紅色 `SIMULATED...` 警語列。證據分類集中在一頁說明；引用實際 result 的頁面只留簡短來源標籤。
7. 移除 503、WebGL／GLTF warning 等製作／QA 狀態；它們不是本課操作內容。
8. 標題以中文教學主題為主，限制長度以避免裁切；英文限實際欄位、按鈕或程式常數。
9. speaker notes 補足口頭銜接，但必要定義不得只存在 notes。
10. 既有 `formal-language-contract.md`、`field-explanation-contract.md` 與所有禁詞繼續適用。

## 頁面群組修訂

| 頁面 | 目前缺陷 | 必要修訂 |
|---|---|---|
| P064 | `queue age`、`deadline`、`endpoint J` 直接進標題與 cards | 改為「Lab C：資料等待、期限與耗能的取捨」；先用一個 IoT queue 時序圖定義一般資料、急件、批次、期限與 endpoint energy。 |
| P065 | 程式 branch 名稱多，中文作用不足 | 使用真實 marked block 放大圖；逐行 callout 解釋窗口、急件、節奏、批次與等待分支，明示判斷順序。 |
| P066 | compact run／receipt 抽象 | 每條命令附中文用途、使用的 policy 狀態、產生的 `result.json`／replay 與下一頁使用位置。 |
| P067–P068 | `URGENT_MARGIN_S`、prediction lock 未定義 | 定義為「距離期限剩餘秒數門檻」；顯示 baseline 值、candidate 值、唯一修改與對 action timing 的預測。 |
| P069 | 兩個數字 boxes，欄名與判讀不足 | 加入已交付資料、endpoint energy、energy efficiency、service result、deadline result 的中文欄名與單位；使用 gate-first 閱讀順序。 |
| P070–P072 | revision、freeze、surprise 仍是英文流程詞 | 分別定義修訂值、凍結的 policy 狀態、withheld case 的用途及每條命令輸出；不可用箭頭鏈代替說明。 |
| P073 | 三筆結果同頁資訊密度過高 | 拆成「服務／期限結果」與「能量／效率結果」兩頁，再以第三頁連回唯一修改與 state／packet 機制。 |
| P074–P075 | surprise／debrief 使用抽象 claim 語言 | 以具體 state、retry、expired、delivered、service 與 J 欄位完成條件式結論；移除「共同句」等現場口吻。 |
| P076 | 網站／terminal 責任仍以英文三詞呈現 | 使用 runner → result files → `/course` screenshot → workbook 的中文流程，逐站說明輸入、動作與輸出。 |
| P077 | source、schema、identity、lineage、hash 同頁堆疊 | 移除 SHA/checksum；拆成「檔案格式與單位」及「情境／run／policy lineage」兩頁，每個 gate 各有中文解釋。 |
| P078 | selector、八欄、queue、event、timeline 一頁過量 | 保留 selector＋frame 概念；八欄移至 P087/P098 分頁，queue/event/timeline 另頁。 |
| P079–P080 | workbook 欄位與 controls 混雜 | 先說明 workbook 保存哪些紀錄，再分頁講 save/export/open/reopen 與 checkpoint/restore/reset/undo。 |
| P081–P084 | transfer 頁仍是英文因果句與 boxes | 每個領域使用具體中文四段：情境條件、policy 決策、服務指標、能源範圍；若無 current domain evidence，不顯示 KPI。 |
| P085 | 實際執行與 fallback 對照缺乏畫面指示 | 使用 current import/source screenshot crop，加編號說明 artifact source、experiment/case、import state 與 fallback 標籤。 |
| P086 | 四個 summary 數字缺少完整中文定義 | 一欄一個中文名稱、單位、計算來源與判讀；`service FAIL` 必須在數值前建立閱讀順序。 |
| P087/P098 | 八個 replay fields 一次仍過多 | 固定拆成四欄＋四欄；每欄附中文名稱、來源、值型態／單位、frame 切換時的變化。 |
| P088 | queue/event 英文事件鏈 | 使用 current frame 示例，逐步標出 queue item、event type、packet identity 與結果，連回 service summary。 |
| P089 | timeline 與 policy branch 關係抽象 | 畫出一個實際 frame sequence，中文標示 contact、quality、state、action 與對應 branch。 |
| P090 | ledger 欄位牆 | 使用一列實際 ledger crop；以 callout 解釋 experiment、case、role、service、J、source 與 selection state。必要時拆頁。 |
| P091 | provider／endpoint 對照加上 browser warnings | 刪除 503/WebGL/GLTF 文字；以「情境輸入」與「endpoint 執行結果」正向定義兩層資料及其欄位。 |
| P092 | workbook controls 太多 | 拆成保存／重開與 checkpoint／復原兩頁；每個按鈕說明讀寫資料、成功畫面與失敗時不變項。 |
| P093 | rejection/recovery 只列抽象錯誤類型 | 使用一個 current rejection example；說明錯誤訊息、workbook 狀態、應選 matching artifact 或 fallback 的條件。 |
| P094 | READY 定義仍過度抽象 | 使用 Prepare screenshot crop；明確說明「記錄 READY」寫入 browser-local setup status、按下後哪個狀態改變，以及與 verify/run/upload 的分工。 |
| P095 | 全站導覽與 fallback controls 一頁過多 | 導覽／語言／Lab tabs 與 fallback loader 分成兩頁，逐一說明功能；不以欄位清單代替。 |
| P096 | task lock／evidence buttons 含多個未定義狀態 | 使用 actual control crop；定義任務勾選、證據鎖定、檢查後繼續的資料用途與狀態變化。 |
| P097 | provider replay controls 為多個 cards | 使用 actual control strip；直接在按鈕附近標註播放、暫停、slider、前後 frame 的行為，再另區比較 endpoint selector。 |
| P099 | 全控制項契約在單頁無法容納 | 改成 appendix index 或拆成 Prepare、Import、Replay、Workbook、Task 五頁；每頁最多四個 controls。 |

## 視覺 QA 必查

- P069、P083、P097 的標題目前裁切，必須縮短文字或重排，不得縮小至低於標題規格。
- Screenshot 頁的文字不得小到無法投影閱讀；應使用 crop 而非縮放完整頁面。
- Native footer 保留；自訂 claim/footer row 移除。
- 每頁檢查線條與文字重疊、cards 內文垂直置中造成的空白、英文欄位與中文解釋比例。

## 新版交付門檻

- 逐頁 audit 表完成。
- 所有新 term 的中文解釋可從 PPTX readback 取得。
- 36 頁不是固定上限；為維持 24 pt 與完整解釋可增加頁數。
- 產生新檔 `courseware/LoRaEnergySim-LEO-Part-C-TEACHING-REWRITE-REVIEW.pptx`，不覆寫既有缺陷樣本。
- 至少完成一次 render → 問題清單 → 修正 → affected slides 重驗。
