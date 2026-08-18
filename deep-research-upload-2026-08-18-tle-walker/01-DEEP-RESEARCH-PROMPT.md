# Web GPT Deep Research Prompt

你是一位熟悉 LEO 衛星軌道、TLE／SGP4、NTN handover、衛星鏈路預算、科學視覺化與教學模擬器設計的資深研究架構師。

請完整閱讀我上傳的六份專案文件，依文件的 authority 與 supersession 關係進行 Web Deep Research。研究目標是：

在所有真實衛星的 identity、位置與速度都來自 archived TLE 並由 SGP4 傳播、不以 Walker／Kepler 生成軌道替代的前提下，找出能呈現 Walker 類展示優點的可行架構，包括密集且可重播的 inter-satellite handover、可解釋的 intra-satellite beam switch、服務星與候選星之間明顯但合理的 SINR 差值、多個高仰角服務機會，以及適合講者操作的慢動作、停格、跳轉、運鏡、文字與箭頭。

必要時可評估時空錯置或跨時間片段合成，但必須區分教學展示與正式研究證據，不能把非同時狀態冒充同一 UTC 的 canonical frame。

## 已知專案條件

- Starlink／OneWeb archived TLE 與 SGP4 已存在。
- 固定觀測點為 NTPU，約緯度 24.9441667、經度 121.3713889。
- 現行分析常用共同 UTC 軸：兩小時、241 個 30 秒 anchors、一個 frozen publication。
- 已有 source-backed PassPlan、canonical SINR／Power／Throughput／EE frame。
- inter-handover 由相同 anchor 的 serving／candidate SINR 差值，經 3 dB Offset＋30 秒 TTT 狀態機判定。
- serving 星失去可見性時的切換屬 forced continuity，不得冒充 Offset／TTT handover。
- intra-handover 必須證明同一 UE、同一衛星、不同 beam identity。
- Visual Lab 已有 source-backed inter／intra before／decision／after replay。
- 不修改 canonical SINR、Power、Throughput 或 EE 公式；可研究合理的 scenario、association、beam、power-cap、handover-policy 與 presentation 設計。

目前困難是：真實 TLE 場景中的有效換手可能太少、forced continuity 比例過高、服務與候選 SINR 差異不明顯，或高仰角衛星沒有按照適合教學的時間順序出現。

## 研究問題

### 1. 共同 UTC 下的 Walker-like 效果

研究是否能透過下列方法，在完全不改造軌道的情況下提高事件密度：

- 從數天、數週或完整 TLE archive 搜尋 handover-rich windows；
- 延長真實 run，再把整體物理時間壓縮成短動畫；
- event-driven playback：略過無事件區間，事件附近放慢；
- 由完整 catalog 辨識 orbital shells、planes、RAAN、inclination 與 phase 結構；
- 搜尋同時具有多顆可見衛星、高仰角、candidate crossing 與有效 TTT 的時段；
- 評估固定 NTPU、其他固定觀測點、移動 UE 或多觀測點的差異。

請提出可計算的事件品質 objective function，至少考慮 valid Offset＋TTT handover 數量、forced-continuity 比例、SINR crossing、候選連續可見時間、事件仰角、同時可見衛星數、服務中斷與完整 before／decision／after anchors。

### 2. 物理合理的 SINR 差值

研究 fixed EIRP、adaptive power、power cap、off-axis gain、beam boresight、slant range、path loss、atmospheric loss、frequency reuse、intra／inter interference、beam load、active-beam ownership、association metric、Offset 與 TTT 如何影響 serving／candidate SINR。

如果 adaptive power 會把不同 link 拉到相同 target SINR，請分析：

- 是否應同時展示 required power、power headroom、link margin 與 capped／uncapped 狀態；
- 哪些 scenario 設定能合理產生 SINR 差值；
- 哪些只是視覺操弄，不能作為研究結果。

不得建議直接修改 canonical 公式製造差距。

### 3. 時空錯置的不同層級

分別評估：

A. 全星座共用同一 UTC，只改變整體播放速度。  
B. 同一真實 run 中跳過無事件區間，依序播放事件。  
C. 不同真實 UTC 的完整事件片段剪成 playlist。  
D. 不同 UTC 衛星以 ghost／reference overlay 顯示，但不加入共同計算。  
E. 每顆衛星使用不同時間映射，在同一場景形成 asynchronous constellation。  
F. 修改 mean anomaly、RAAN 或 phase 形成 TLE-derived Walker hybrid。  
G. 從 TLE 擬合 shells 後建立 synthetic Walker constellation。

對每項說明：

- 是否仍能稱為完整使用 TLE；
- 是否存在可實現的共同物理狀態；
- SINR、interference、Offset／TTT、Power 與 EE 是否仍有效；
- 能否用於教學、論文圖或定量實驗；
- 必須顯示的標籤與 provenance；
- 是否需要獨立 Teaching／Composed Mode 或新 ADR。

### 4. 必須比較的候選架構

至少比較：

1. Common-UTC handover-rich window mining；
2. Longer real run＋whole-timeline compression；
3. Event-driven seek／slow-motion replay；
4. Real-event playlist／montage；
5. Real TLE shell／orbital-plane clustering；
6. Scenario-policy tuning while preserving TLE geometry；
7. True multi-satellite active-beam assignment and interference；
8. Moving-UE or multi-observer scenario；
9. Presentation-only asynchronous TLE composition；
10. TLE-fitted Walker／phase-shifted hybrid。

若研究發現其他方法，也請加入。不要預設任何方案一定最好。

## 來源與證據要求

優先使用：

- CelesTrak／Vallado 的 TLE、SGP4、座標與時間資料；
- 3GPP TR 38.811、TR 38.821 或相關 NTN 標準；
- peer-reviewed LEO handover、beam management、mobility、link-budget、event detection 與 constellation-design 論文；
- NASA、ESA、Orekit、GMAT、STK 等官方技術文件。

搜尋可使用英文，報告以繁體中文撰寫並保留必要英文術語。每個重要主張都要附直接來源連結與章節、表格、公式或頁碼定位。不要把搜尋摘要當證據；來源衝突時列出衝突；找不到證據時標示 UNVERIFIED。

使用以下分級：

- VERIFIED：標準、官方資料或可靠論文直接支持。
- PLAUSIBLE：工程上合理，但尚未在本情境驗證。
- REJECTED：違反共同時間、TLE provenance、handover state machine 或 canonical-frame 條件。

## 必要輸出

### A. 結論摘要

回答是否能在完整真實 TLE 下達成 Walker-like 教學效果、哪些特性可以完全 source-backed、哪些只能做教學合成，以及最推薦方向。

### B. 候選方案比較表

欄位至少包含：方法、TLE identity、SGP4 完整性、共同 UTC、有效換手密度、高仰角、SINR 差值、Offset／TTT、interference／EE 有效性、教學清晰度、學術可辯護性、實作複雜度、UI 標籤與風險。

### C. 最推薦的三個架構

每個架構說明資料流、scientific clock 與 presentation clock、handover 來源、數值有效範圍、多事件／高仰角取得方式、畫面呈現、適用場合、優缺點、工作量與未知數。

### D. Offline event-mining 演算法

提出可實作流程：

TLE archive → freeze publication → common-UTC SGP4 → visibility/pass extraction → serving/candidate link samples → Offset/TTT trace → event-quality scoring → ranked teaching clips。

具體說明搜尋跨度、滑動視窗、anchor 粒度、事件附近是否需 finer sampling、scoring features、避免 forced continuity 的方法、索引／剪枝、provenance 與計算成本。

### E. 最小驗證實驗

設計一個不先改前端的實驗，使用實際 Starlink／OneWeb TLE 回答：

1. 固定 NTPU 時，多長搜尋範圍可找到多少 valid inter handover？
2. 多少事件達到高仰角門檻？
3. SINR 差值是否足以教學？
4. 哪些參數可合理提高事件密度？
5. 是否真的需要跨時間合成？

列出輸入、輸出、指標、成功門檻與失敗後的下一方案。

### F. ADR／模式邊界

提供可改寫成 ADR 的規範，區分 Canonical／Research Replay、Source-backed Event Playlist、Teaching／Composed Replay 與禁止的偽造情況。

若 Teaching Mode 允許跨時間，至少要求：

- 顯示「教學合成／非同時星座狀態」；
- 保存每個片段或物件的原始 UTC；
- 異步物件不加入共同 interference；
- 不從混合時間畫面產生 handover、SINR 或 EE；
- composed sequence 不匯出為正式研究證據；
- canonical state 與 presentation state 完全分離。

### G. 最終決策

給出首選、次選、不建議方案、第一個最小實驗、仍需由目前程式或 archive 實測的資訊，以及在實測前不能下的結論。

整份報告必須能讓研究者直接決定下一步架構與驗證工作，不要寫成一般性的衛星通訊介紹，也不要修改、重寫或產生專案程式碼。

