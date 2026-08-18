# BeamShift donor 附錄脈絡化重寫計畫

狀態：`APPROVED-BY-CONTINUATION-INSTRUCTION / DIRECT PPTX FALLBACK`

## 重寫原則

- 附錄從 LoRaEnergySim 的端點決策開始，不以衛星軌道名詞開場。
- LEO 僅說明 changing-service-window；TLE、SGP4 與座標轉換只保留追查情境來源所需的最小內容。
- 每頁先說明該概念在主流程中的位置，再呈現技術細節。
- Lab A、Lab B、Lab C、`student_policy.py`、JSON 匯入與 `/course` 欄位皆設置回到主流程的索引。
- 不沿用固定「判讀／恢復」列；依頁面目的改用流程、對照、矩陣、時間軸、帳本或索引。
- 未凍結的 current evidence 明示為 placeholder，不填 donor 數字、截圖或 KPI。
- 公式以可編輯 Office Math 表示；LaTeX source 寫入形狀 metadata 與 speaker notes。

## P098–P116 新頁序

| 頁碼 | 標題 | 在主流程中的作用 | 主視覺 | BeamShift donor／current authority |
|---|---|---|---|---|
| P098 | 這份附錄處理哪些問題 | 附錄入口；按問題返回來源、決策、結果或網站操作 | 四條查閱路徑 | donor disposition map；ADR-004／SDD |
| P099 | 從服務視窗到端點結果的完整鏈 | 說明 LEO 與 LoRaEnergySim 的直接關係 | source → window → observation → policy → state → service／energy | e2 2、4–6、38–39；ADR-004 |
| P100 | 情境資料從哪裡開始 | 以最少 TLE 內容說明固定輸入與來源紀錄 | source card＋中文欄位標註 | e2 7 或 98 |
| P101 | 固定來源如何形成服務視窗 | 把 TLE、時間、SGP4、座標與視窗串成一條流程 | 五節點推導鏈 | e2 8–10、107–109 |
| P102 | 可見、品質合格與完成服務是三件事 | 避免把角度或 quality 當作 delivery | 三層漏斗 | e2 5、11、30–31、110–111 |
| P103 | quality 欄位如何影響策略分支 | 對應 Lab B 的 enter／hold／exit | observation → threshold → action 決策表 | e2 13、15、22–24；current policy API |
| P104 | 速率、送達量與服務判定各自代表什麼 | 說明網站三類欄位的差異 | 同一傳輸時間軸上的三個讀值 | e2 14、32、37 |
| P105 | 狀態停留時間如何累積為端點能量 | 連結 SLEEP／WAIT／TX 等狀態與 J | 狀態帳本＋Office Math | e2 16／17、21、25–29、112；current endpoint boundary |
| P106 | 低能量結果的四種判定 | 結合 service 與 endpoint energy 避免單一數值結論 | 二乘二判定矩陣 | e2 70–75 |
| P107 | A／B 比較固定哪些條件 | 建立 baseline 與 candidate 的共同基準 | 四把鎖＋唯一修改區 | e2 20、36–37、70–75 |
| P108 | 程式修改後應出現哪些中介證據 | 連結程式、action、state、packet、service 與 energy | 因果證據鏈 | e2 38–39；current result／replay contract |
| P109 | Lab A 延伸：WAIT 與 SLEEP 的狀態帳本 | 回到 Lab A 的具體檢查項目 | 並列狀態時間帶 | current ADR／SDD；donor accounting concept |
| P110 | Lab B 延伸：切換太慢與過度往返 | 回到 Lab B 的門檻與 hold 機制 | 兩條 trace | e2 12 |
| P111 | Lab C 延伸：批次與緊急資料 | 回到 Lab C 的 queue／deadline／service／energy | queue 時間軸 | current ADR／SDD |
| P112 | 上傳 JSON 後網站執行哪些步驟 | 說明上傳、驗證、materialize 與顯示 | 四階段匯入流程 | e2 96–97；current SDD |
| P113 | `/course` 頁面欄位的閱讀順序 | 說明 identity、service、state、energy 與來源標記 | 編號畫面骨架；current screenshot 未凍結則使用 placeholder | current SDD／browser evidence gate |
| P114 | READY 記錄的目的 | 說明 READY 只確認可開始既定流程，不代表結果成功 | prerequisite → READY → RUN 的狀態圖 | current package contract |
| P115 | 資料來源與能量範圍要同時標記 | 合併 evidence class 與 endpoint／system boundary | 來源分類 × scope 二維表 | e2 19–21、96–97、113；ADR-004 |
| P116 | 依問題返回對應操作頁 | 附錄出口；把技術概念導回三個 Lab、JSON 匯入與網站欄位 | 五路返回索引 | donor disposition map；current deck route |

## 不再保留的原附錄語法

- 不以 `TLE：固定來源與情境錨點` 作為附錄第一頁。
- 不在每頁重複 `判讀｜`、`恢復｜`、`current evidence` 與 donor 聲明。
- 不以英文欄位牆代替中文機制說明。
- 不把 donor provenance 顯示為畫面主要內容；來源對照保留在 notes 與 source map。
- 不以交接紀錄作為教學結尾；最後一頁明確返回主操作流程。
