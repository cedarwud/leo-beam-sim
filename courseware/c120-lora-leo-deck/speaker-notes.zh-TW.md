# C-120 opening checkpoint speaker notes

## S001 — 每一次 SEND、WAIT、SLEEP，都是能源決策

這堂課先從物聯網終端的能源決策開始，而不是從衛星術語開始。裝置選擇送、等或休眠時，同時改變封包服務與功率乘時間所累積的能量。LoRaEnergySim 讓這些終端後果可以被觀察；Leo 只提供一個會改變的服務窗口。

## S002 — 節能是一條可檢驗因果鏈

請沿著因果鏈由左到右讀。資料與狀態先進入策略，策略產生送、等、休眠或批次行動，接著才有封包與服務後果；功率經過時間才累積成焦耳。最後的證據必須能支持或推翻原先的預測。

## S003 — LoRa 證據邊界

LoRaEnergySim 的直接價值，是讓終端狀態、封包嘗試、重試、送達與能量結果成為可檢查事件。課程包裝層加入的假設必須另外標示，不能說成上游測量。終端能量也不能被改名成既有 C-120 的 canonical system energy。

## S004 — LEO：變動服務窗口範例

LEO 在這裡只負責把服務機會變成會開、會關、品質會改變的時間窗。這讓學員必須在現在送、等一下、批次或休眠之間做決策，並同時檢查服務與能量。學到的是 changing opportunity 下的控制思維，而不是衛星工程專業。

## S005 — 兩層 evidence 不互相冒充

兩層 replay 可以在同一個情境與時鐘上一起呈現，但各自負責不同證據。既有 replay 保留系統層欄位；新的終端 replay 只負責策略、佇列、封包、無線狀態與終端能量。這條界線讓課程可以前進，又不會把終端模型誤稱為 whole-system 真值。

## S006 — 從預測到驗證

學員先留下對佇列、服務、狀態時間與終端能量的預測，再只改 student_policy.py 的標記區域。Runner 產生 deterministic JSON，Leo 做 strict import 後呈現 replay；同一份凍結策略還要接受 withheld case。最後留下的是完整 evidence chain 與可重新開啟的 workbook。

## S007 — 操作與修改的五問框架

這五欄不是附加說明，而是每一個操作的教學契約。學員要知道自己做什麼、為什麼做、改變哪個機制、執行前期待看到什麼，以及意外結果該如何解讀與恢復。目前 release URL、commands、case names 與 line numbers 尚未凍結，所以本頁只展示 grammar，不冒充 final teaching page。

## S008 — 120 分鐘：setup 與 labs

這是 draft SDD 提出的 exact-120 新時鐘，仍需要 owner 接受。Runner setup 從第五分鐘開始，最晚第十三分鐘切到同情境 fallback，因此不能吞掉後面的三個 causal labs。任何 contingency branch 都必須在原本 protected clock 內回到 core path。

## S009 — Opening checkpoint

Owner 已在 2026-08-11 明確解除 checkpoint 後等待，授權直接繼續 full deck。原生 educate 模板、endpoint-first 敘事與 endpoint/system 邊界沿用；release、API、command、code line、browser 與 KPI 尚未凍結的頁面只能使用明示 placeholder。沒有另行授權時仍不 commit、不 push。
