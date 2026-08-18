# c120-lora-leo-opening-native_20260811_024300

- Source: `c120-lora-leo-opening-native_20260811_024300.pptx`
- Total slides: 9

## Slide 1

每一次 SEND、WAIT、SLEEP，都是能源決策

智慧節能與物聯網應用

> [SmartArt scan unavailable: Missing required PPTX part: ppt/slides/slide1.xml]

### Speaker Notes

這堂課先從物聯網終端的能源決策開始，而不是從衛星術語開始。裝置選擇送、等或休眠時，同時改變封包服務與功率乘時間所累積的能量。LoRaEnergySim 讓這些終端後果可以被觀察；Leo 只提供一個會改變的服務窗口。

## Slide 2

節能是一條可檢驗因果鏈

STATE / DATA → POLICY → PACKET / SERVICE
POWER × TIME → ENDPOINT ENERGY → EVIDENCE
LaTeX：E_{\mathit{endpoint}}=\sum_s P_s t_s

Authority｜C120 integration SDD 1082–1096

> [SmartArt scan unavailable: Missing required PPTX part: ppt/slides/slide2.xml]

### Speaker Notes

請沿著因果鏈由左到右讀。資料與狀態先進入策略，策略產生送、等、休眠或批次行動，接著才有封包與服務後果；功率經過時間才累積成焦耳。最後的證據必須能支持或推翻原先的預測。

## Slide 3

LoRa 證據邊界

可觀察
SLEEP / IDLE / WAKE / PROCESS / TX / RX
packet attempt / retry / delivered / expired
queue / service / endpoint energy
不能宣稱
NOT LIVE / NOT MEASURED / NOT SYSTEM ENERGY
wrapper-added assumptions 必須分開標示

Authority｜ADR-004 24–38；C120 integration SDD 883–907

### Speaker Notes

LoRaEnergySim 的直接價值，是讓終端狀態、封包嘗試、重試、送達與能量結果成為可檢查事件。課程包裝層加入的假設必須另外標示，不能說成上游測量。終端能量也不能被改名成既有 C-120 的 canonical system energy。

## Slide 4

LEO：變動服務窗口範例

CHANGING SERVICE WINDOW
OPEN → QUALITY SHIFTS → CLOSE
現在送｜等待｜批次｜休眠
LEO 只讓取捨更容易看見；不是學習目標。
可轉移：smart farm / HVAC / edge / logistics

Authority｜C120 integration SDD 14–37, 1082–1096

### Speaker Notes

LEO 在這裡只負責把服務機會變成會開、會關、品質會改變的時間窗。這讓學員必須在現在送、等一下、批次或休眠之間做決策，並同時檢查服務與能量。學到的是 changing opportunity 下的控制思維，而不是衛星工程專業。

## Slide 5

兩層 evidence 不互相冒充

同一 scenario / TLE source / clock
CANONICAL SYSTEM
power / consumed J / canonical bit/J
LORA ENDPOINT
policy / queue / packet / state / endpoint J
NO ALIASING｜endpoint J ≠ system J

Authority｜C120 integration SDD 366–388

### Speaker Notes

兩層 replay 可以在同一個情境與時鐘上一起呈現，但各自負責不同證據。既有 replay 保留系統層欄位；新的終端 replay 只負責策略、佇列、封包、無線狀態與終端能量。這條界線讓課程可以前進，又不會把終端模型誤稱為 whole-system 真值。

## Slide 6

從預測到驗證

PREDICT → EDIT → RUN → IMPORT
WITHHELD + WORKBOOK ← REPLAY
只改 student_policy.py marked region。
JSON strict import；同一 scenario / clock。
凍結 policy 後再跑 withheld case。

Authority｜ADR-004 42–71；C120 integration SDD 287–295

### Speaker Notes

學員先留下對佇列、服務、狀態時間與終端能量的預測，再只改 student_policy.py 的標記區域。Runner 產生 deterministic JSON，Leo 做 strict import 後呈現 replay；同一份凍結策略還要接受 withheld case。最後留下的是完整 evidence chain 與可重新開啟的 workbook。

## Slide 7

操作與修改的五問框架

DO｜做什麼
WHY｜為何做
MECHANISM｜改變哪個 policy / packet / state / energy
EXPECT｜預期哪個 receipt / evidence 改變
INTERPRET｜符合、意外、失敗、最小 recovery
EVIDENCE GAP｜release / command / case / line 尚未凍結

Authority｜C120 integration SDD 273–295, 762–766

### Speaker Notes

這五欄不是附加說明，而是每一個操作的教學契約。學員要知道自己做什麼、為什麼做、改變哪個機制、執行前期待看到什麼，以及意外結果該如何解讀與恢復。目前 release URL、commands、case names 與 line numbers 尚未凍結，所以本頁只展示 grammar，不冒充 final teaching page。

## Slide 8

120 分鐘：setup 與 labs

WHY 5｜SETUP 8｜MODEL 8｜ANCHOR 8
LAB A 21｜LAB B 21｜RECOVERY 5
LAB C 23｜CLINIC 10｜TRANSFER 11
合計 120 分鐘
保護：setup fallback；三個 causal labs 時鐘固定
DRAFT｜OWNER REVIEW REQUIRED

Authority｜C120 integration SDD 115–170

### Speaker Notes

這是 draft SDD 提出的 exact-120 新時鐘，仍需要 owner 接受。Runner setup 從第五分鐘開始，最晚第十三分鐘切到同情境 fallback，因此不能吞掉後面的三個 causal labs。任何 contingency branch 都必須在原本 protected clock 內回到 core path。

## Slide 9

Opening checkpoint

01 敘事｜IoT endpoint first；LEO 只是 changing-window example
02 視覺｜educate.pptx 原生背景與配色
03 邊界｜endpoint ≠ system / canonical
04 生產｜未凍結 evidence 只做明示 placeholder
DECISION｜CONTINUE AUTHORIZED
NEXT｜FULL DECK / NO COMMIT / NO PUSH

Authority｜C120 integration SDD 1321–1352, 1570–1585

### Speaker Notes

Owner 已在 2026-08-11 明確解除 checkpoint 後等待，授權直接繼續 full deck。原生 educate 模板、endpoint-first 敘事與 endpoint/system 邊界沿用；release、API、command、code line、browser 與 KPI 尚未凍結的頁面只能使用明示 placeholder。沒有另行授權時仍不 commit、不 push。
