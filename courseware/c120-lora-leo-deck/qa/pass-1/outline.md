# Deck Outline

- File: /home/u24/demo/leo-beam-sim/courseware/c120-lora-leo-deck/build/c120-lora-leo-opening-checkpoint-zh-TW.pptx
- Slides: 9

## Slide 1: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 01
- 智慧節能與物聯網應用
- 每一次
- SEND、WAIT、SLEEP
- 都是能源決策
- LoRaEnergySim 讓 endpoint 後果可被檢查；LEO 只提供 changing-service-window。
- SEND
- WAIT
- SLEEP
- SERVICE WINDOW
- packet/service ↔ P × t ↔ energy
- OPENING CHECKPOINT / OWNER REVIEW / NOT FINAL TEACHING EVIDENCE
- Authority: ADR-004 lines 24–38 · platform/intro.md lines 6–12

Notes:
- 這堂課先從 IoT endpoint 的能源決策開始，而不是從衛星術語開始。裝置選擇送、等或休眠時，同時改變封包服務與功率乘時間所累積的能量。LoRaEnergySim 讓這些 endpoint 後果可以被觀察；Leo 只提供一個會改變的服務窗口，幫我們看清取捨。

## Slide 2: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 02
- 節能不是一個數字；它是一條可檢驗因果鏈
- 01
- STATE / DATA
- 裝置與情境
- 02
- POLICY
- 送、等、睡
- 03
- PACKET / SERVICE
- 嘗試與結果
- 04
- POWER × TIME
- 狀態累積
- 05
- ENERGY
- endpoint J
- 06
- EVIDENCE
- 支持或推翻
- 可檢驗的節能主張
- 每一段都有 receipt；動畫只能顯示，不能代替 evidence。
- TRANSFER → smart farm · HVAC · edge · logistics
- Authority: C120 integration SDD lines 1082–1096

Notes:
- 請沿著因果鏈由左到右讀。資料與狀態先進入 policy，policy 產生送、等、休眠或批次行動，接著才有 packet 與 service 後果；功率經過時間才累積成焦耳。最後的證據必須能支持或推翻原先的預測，並把機制轉移到其他 IoT 場景。

## Slide 3: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 03
- 為什麼是 LoRaEnergySim？因為它把 endpoint 後果露出來
- LoRaEnergySim 可觀察
- 不能因此宣稱
- SLEEP
- IDLE / WAKE
- PROCESS
- TX / RX
- packet attempt · retry · delivered · expired
- queue · service · endpoint energy
- ×
- NOT LIVE / MEASURED
- 課程輸出是 simulated teaching data
- ×
- NOT SYSTEM ENERGY
- endpoint J ≠ canonical system consumed J
- ×
- ASSUMPTIONS SEPARATE
- wrapper-added state 需另標示
- 價值 = causal evidence；不是 claim escalation
- Authority: ADR-004 lines 24–38 · C120 integration SDD lines 883–907

Notes:
- LoRaEnergySim 的直接價值，是讓 endpoint 的狀態、封包嘗試、重試、送達與能量結果成為可檢查的事件。課程 wrapper 加入的 awake-idle 或 wake 假設必須另外標示，不能說成 upstream 測量。更重要的是，endpoint energy 不能被改名成既有 C-120 的 canonical system energy。

## Slide 4: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 04
- 為什麼用 LEO？因為服務窗口會移動
- CHANGING
- SERVICE WINDOW
- open → quality shifts → closes
- 現在送
- 等待
- 批次
- 休眠
- LEO 只讓取捨更容易看見；它不是學習目標本身。
- SMART FARM
- HVAC
- EDGE
- LOGISTICS
- Authority: C120 integration SDD lines 14–37 and 1082–1096

Notes:
- LEO 在這裡只負責把服務機會變成一個會開、會關、品質會改變的時間窗。這讓學生必須在現在送、等一下、批次或休眠之間做決策，並同時檢查 service 與 energy。學到的是 changing opportunity 下的控制思維，而不是衛星工程專業。

## Slide 5: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 05
- 同一 scenario、同一 clock；兩層 evidence 不互相冒充
- SHARED ANCHOR · SAME SCENARIO · SAME TLE SOURCE · SAME CLOCK
- SYSTEM LAYER
- C120AuthoritativeReplay
- system power
- consumed J
- canonical bit/J
- 沿用既有 C-120 authority
- ENDPOINT LAYER
- C120LoraEndpointReplay
- policy · queue · packet
- radio state
- endpoint service + energy
- 新增、範圍受限的 evidence
- NO
- FIELD
- ALIASING
- endpoint J
- ≠ system J
- 共享時間軸；evidence scope 保持分離。
- Authority: C120 integration SDD lines 366–388

Notes:
- 兩層 replay 可以在同一個 scenario 與 clock 上一起呈現，但各自負責不同 evidence。既有 replay 保留 system 層欄位；新的 endpoint replay 只負責 policy、queue、packet、radio state 與 endpoint energy。這條界線讓課程可以前進，又不會把 endpoint 模型誤稱為 whole-system 真值。

## Slide 6: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 06
- 學生不是照食譜：先預測，再 edit–run–import–observe
- 01
- PREDICT
- queue / service / state / J
- 02
- EDIT
- marked region only
- 03
- RUN
- deterministic JSON
- 04
- IMPORT
- strict schema + identity
- 05
- REPLAY
- same scenario / same clock
- 06
- WITHHELD + WORKBOOK
- freeze policy · preserve receipts
- BOUNDARY · student_policy.py marked region only
- Authority: ADR-004 lines 42–71 · C120 integration SDD lines 14–31 and 287–295

Notes:
- 學生先留下對 queue、service、state time 與 endpoint energy 的預測，再只改 student_policy.py 的標記區域。Runner 產生 deterministic JSON，Leo 做 strict import 後呈現 replay；同一份凍結 policy 還要接受 withheld case。最後留下的是完整 evidence chain 與可 reopen 的 workbook，不是一次成功畫面。

## Slide 7: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 07
- 每一個 command 與 code edit，都要回答五件事
- 01
- DO
- 實際動作
- 安裝／執行／改哪一行
- 02
- WHY
- 必要理由
- 它解開哪個學習 gate
- 03
- MECHANISM
- 作用機制
- 環境／policy／packet／state／energy
- 04
- EXPECT
- 事前預期
- 哪一個 receipt 或 evidence 會變
- 05
- INTERPRET
- 結果解讀
- 符合、意外、失敗與最小 recovery
- PLACEHOLDER — RELEASE URL / COMMAND / CASE / LINE NUMBERS PENDING C120-LORA-00 FREEZE
- Authority: C120 integration SDD lines 273–295 · C120 integration SDD lines 762–766

Notes:
- 這五欄不是附加說明，而是每一個 action 的教學契約。學生要知道自己做什麼、為什麼做、改變哪個機制、執行前期待看到什麼，以及意外結果該如何解讀與恢復。目前 release URL、commands、case names 與 line numbers 尚未凍結，所以本頁只展示 grammar，不冒充 final teaching page。

## Slide 8: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 08
- Exact 120：setup 有界，三個 causal labs 不能被吃掉
- 5
- 000
- SETUP
- 8
- 005
- MODEL
- 8
- 013
- ANCHOR
- 8
- 021
- LAB A
- 21
- 029
- LAB B
- 21
- 050
- 5
- 071
- LAB C
- 23
- 076
- CLINIC
- 10
- 099
- TRANSFER
- 11
- 109
- 120
- 00
- Why it matters
- 5m
- 01
- setup
- 8m
- 02
- model
- 8m
- 03
- anchor
- 8m
- 04
- Lab A
- 21m
- 05
- Lab B
- 21m
- 06
- recovery
- 5m
- 07
- Lab C
- 23m
- 08
- clinic
- 10m
- 09
- transfer
- 11m
- setup 有 fallback；三個 causal labs 的 protected clock 不可被吃掉
- PROPOSED IN DRAFT SDD / OWNER REVIEW REQUIRED
- Authority: C120 integration SDD lines 115–170

Notes:
- 這是 draft SDD 提出的 exact-120 新時鐘，仍需要 owner 接受。Runner setup 從第五分鐘開始，最晚第十三分鐘切到同 scenario fallback，因此不能吞掉後面的三個 causal labs。任何 contingency branch 都必須在原本 protected clock 內回到 core path，課程仍在第一百二十分鐘結束。

## Slide 9: (No title)

Body:
- C-120 · OPENING CHECKPOINT · OWNER REVIEW
- 09
- Owner checkpoint：先定四件事，再做完整 98–116 頁
- 01
- 敘事
- IoT endpoint first
- LEO = changing-window example
- 02
- 視覺
- dark evidence-lab
- 大字 · 一頁一個主視覺
- 03
- 證據邊界
- endpoint evidence
- ≠ system / canonical evidence
- 04
- 模板路徑
- 原生白底 fill？
- 或 exact-brand dark adaptation？
- STOP AFTER CHECKPOINT
- no final teaching pages · no commit · no push
- Authority: C120 integration SDD lines 1321–1352 · C120 integration SDD lines 1570–1585

Notes:
- 這一頁不是結論頁，而是 owner gate。請先裁決 opening narrative、dark evidence-lab 視覺、endpoint/system wording，以及 educate.pptx 的實際套用方式。未裁決前，我們不會進入 final setup、command、code、browser evidence 或完整 deck production。
