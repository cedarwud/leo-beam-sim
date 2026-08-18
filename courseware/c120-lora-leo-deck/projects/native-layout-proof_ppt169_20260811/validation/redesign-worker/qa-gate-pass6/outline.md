# Deck Outline

- File: /home/u24/demo/leo-beam-sim/courseware/c120-lora-leo-deck/projects/native-layout-proof_ppt169_20260811/validation/redesign-worker/c120-native-layout-proof-redesign-pass6.pptx
- Slides: 6

## Slide 1: LoRaEnergySim × 智慧節能與物聯網應用

Body:
- 從 policy 變更，看見 service 與 endpoint energy 的因果
- policy
- radio state
- energy
- service

Notes:
- 這堂課從物聯網終端的能源決策開始。當終端選擇傳送、等待、批次或休眠時，封包服務與能量會一起改變；我們要學的是如何把操作連回可以驗證的因果，而不是背誦一個漂亮數字。

## Slide 2: 節能不是只看功率變小

Body:
- policy
- 選擇
- radio state
- 停留
- power × time
- endpoint energy
- service
- 判讀
- 功率只是狀態；能量還要乘上停留。

Notes:
- 請沿著這條因果鏈由上往下讀。策略先改變終端停在哪個無線狀態，以及停留多久；功率乘上時間才會累積為能量，最後還要回頭檢查必要服務是否守住。只看到功率下降，還不能直接下節能結論。

## Slide 3: LEO 只提供會改變的服務窗口

Body:
- 課程核心
- LoRa endpoint
- 資料從哪裡來
- policy / queue
- 怎麼排進服務
- radio state / energy
- 結果如何累積
- LEO 範例
- 只改服務窗口，不改核心因果
- 關閉
- 開啟
- 關閉
- 窗口會開、會關
- 品質會改變；等待會產生後果

Notes:
- 左側才是課程核心：終端策略、佇列、無線狀態與能量證據。右側的 LEO 只提供一個服務機會會改變的例子，讓現在送或稍後送產生可見差異。同一套思考可以移轉到智慧農場、空調控制、邊緣推論與物流感測。

## Slide 4: 先跑基準，再只改一個 policy block

Body:
- ①
- 驗證環境
- bash course.sh verify
- 先讓工具鏈可重現
- ②
- 保存基準
- bash course.sh run --lab A --case baseline
- 記下未改 policy 的 result
- ③
- 只改一個
- policy block
- bash course.sh run --lab A --case candidate --freeze
- policy = lab-a-pace-rest
- 比較時只歸因到這一個變更
- verify 失敗 → 修環境

Notes:
- 右側不是另一套任務，而是相對於左側控制線的一次變更。先讓基準留下可辨識的 result，再只修改指定 marked block；執行前先預測佇列、服務、狀態時間與終端能量會往哪個方向改變。若同時改了多個區域，結果就無法回答是哪個機制造成差異。

## Slide 5: 公式把操作連到證據

Body:
- radio state × 停留 → endpoint energy
- 送達資料量 ÷ 相同能量邊界 → 可比較的效率

Notes:
- 第一個式子把每個無線狀態的功率乘上停留時間，再累積成終端能量。第二個式子用成功送達的資料量除以同一個能量邊界；若 delivered-data 或 energy boundary 不同，就不能直接拿兩個效率值比較。這兩個式子不是裝飾，而是用來追問哪個操作改變了哪一段功率乘時間。

## Slide 6: 一筆 result，先看證據鏈

Body:
- 來源  /  lineage
- 服務  /  deadline / freshness
- 機制  /  queue / packet / state
- 能量  /  power × time
- 判讀
- 支持、反駁、待查
- 伺服器 preview：已驗證
- Windows native：待實機
- endpoint replay evidence

Notes:
- 這張畫面來自已驗證的 server preview 匯入流程；它證明目前的瀏覽器路徑能讀取同一份 result，但不代表 Windows 原生執行已通過。匯入之後先確認身份與 lineage，再檢查必要服務，接著用佇列、封包與狀態時間解釋能量差異。若身份不一致、服務證據缺失或機制沒有產生後果，結論就應保持證據不足。
