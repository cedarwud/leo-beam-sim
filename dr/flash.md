# **低軌道衛星多波束交接優化演算法：互動式3D網頁模擬器設計、教育傳播與學術驗證技術報告**

本報告旨在針對雙重受眾（非專業大眾的科普教育，以及學術答辯委員會的即時演算法驗證）設計一套基於低軌道（LEO）衛星星座多波束交接（Handover）與強化學習（RL）資源配置演算法的互動式 3D 網頁模擬器。透過深入分析「可探索解釋（Explorable Explanations）」、電信級交接架構、可解釋性強化學習、教育遊戲化機制、學術現場去風險化設計、網頁端效能優化（特別是針對無 GPU 支援的軟體渲染環境），以及低軌星座波束足跡先前技術，本報告為該模擬器系統提供了具體的優化設計模式、實作指南與理論驗證依據。

## **1\. 可探索解釋（Explorable Explanations）之互動設計語言與認知傳播機制**

在建構一個同時服務非專家與學術委員的互動模擬器時，首要挑戰在於如何平衡資訊的「易懂性」與「嚴謹性」。本系統的理論根源可追溯至艾倫·凱（Alan Kay）提出的「主動式隨筆（Active Essays）」與布列特·維克多（Bret Victor）的「可探索解釋（Explorable Explanations）」理念，強調將靜態文本轉化為動態、互動且可深入探究的雙向學習體驗，以促進深層認知與系統性思考1。  
在現代優秀科普網站（如 Nicky Case、Bartosz Ciechanowski 的互動式部落格及學術期刊 *Distill.pub*）中，互動傳播機制通常依循以下三大核心維度2：

### **漸進式瀑布激活（Progressive Cascade Activation）與認知引導**

為了避免非專業使用者一進入系統即面對高維度 3D 空間與密集遙測數據而產生認知過載，介面應導入「漸進式瀑布激活」模式6。該模式主張將使用者界面分割為敘事層與數據層6。系統初始狀態僅呈現宏觀的地球球體與單一移動衛星波束，並透過「故事線」引導使用者逐步解鎖控制元件（例如：從「單一用戶交接」到「群體擁擠飢餓」），每次互動解鎖均須在 100 毫秒內產生視覺反饋，以確保使用者能直觀感知「參數調整」與「系統行為變遷」之間的因果關聯6。

### **脈絡化文字-數據表對齊（Multi-granular Text-to-Table Alignment）**

學術閱讀介面研究（如 TableTale）指出，將文字敘事與結構化數據表格進行多粒度對齊，能顯著降低使用者的注意力分散6。模擬器應在 2D 資訊面板中動態高亮當前 3D 場景中的對象。例如，當使用者鼠標懸停在特定波束公式或遙測數據行時，3D 場景中對應的衛星波束、地表投影橢圓以及受服務的終端群組應同步進行邊緣發光（Rim Glow）或色彩跳變6。

### **行為感知自適應 UI（Behavior-Aware Adaptive UI）**

模擬器可隱性監測使用者的探索行為（如捲動速度、鼠標懸停深度及互動密度），動態調整 UI 複雜度9。對於快速瀏覽的初訪者，介面保持極簡主義，僅顯示服務/飢餓狀態的色彩區塊；而當系統檢測到使用者在某一參數滑桿上停留超過 3 秒或進行反覆微調時，則自動揭示底層的 Q 值向量場、信噪比（SINR）變化曲線等專家級標籤9。  
下表總結了可探索解釋設計的核心 findings 及其學術可信度評估：

| 設計維度 | 核心 findings 與模式 | 來源憑證 \[cite: ID\] | 可信度註記 |
| :---- | :---- | :---- | :---- |
| **主動學習架構** | 互動式隨筆（Active Essays）優於傳統靜態說明，能激發深層認知建構。 | \[cite: 1\] | **極高**。奠定人機互動與教育傳播學術界十年發展的經典理論。 |
| **視覺與文本對齊** | 透過多粒度（Multi-granular）文本與表格數據動態對齊，顯著降低認知負荷。 | \[cite: 6\] | **高**。發表於 2026 年自然語言與可視化交叉領域之頂尖實證研究。 |
| **漸進式引導 (Onboarding)** | 脈絡化、原位引導（In-situ Guidance）比傳統集中式教學更具學習留存率。 | \[cite: 7\] | **高**。源自 ACM CHI 對深度學習可視化工具的用戶實證評估。 |
| **自適應介面** | 依據探索行為動態調節 UI 複雜度，可同時兼顧新手與專家的特定需求。 | \[cite: 9, 10\] | **中等**。源自前沿設計實踐與個性化人機介面工程原型。 |

## **2\. 電信網路、多波束覆蓋與動態衛星交接（Handover）之視覺化先前技術**

在低軌道（LEO）衛星星座（如 Starlink、OneWeb）中，衛星以約 ![][image1] 的超高速相對於地面運動，單個衛星的地面覆蓋時間僅維持數分鐘，導致地面用戶設備（UE）必須频繁進行交接（Handover）11。要在 3D 空間中精確且 legible 地呈現電信級交接，必須將其底層物理約束與 3GPP 標準化協議轉化為空間視覺符號。

### **交接模式分類與空間幾何對映**

根據 3GPP 第 18 版（Release 18）非地面網路（NTN）移動性規範，LEO 衛星交接主要分為兩大物理場景，其在視覺化設計中的對應模式如下14：

* **準地球固定波束（Quasi-Earth Fixed Beams）：** 衛星波束利用主動式相位陣列天線進行實時束形調整，使其指向地面固定的蜂窩小區14。在視覺化中，小區邊界應在地球表面投影為穩定的幾何網格，而衛星投射下來的圓錐波束隨著衛星移動而產生偏轉角度，直到達到仰角閾值（EAT）極限，觸發基於時間（Time-based）的軟切換（Soft Switch，此時 UE 同時與兩個小區的重疊載波保持連線）13。  
* **地球移動波束（Earth-Moving Beams）：** 波束與衛星姿態固定，在地表快速掃過14。此時交接是由地理位置（Location-driven）驅動14。在 3D 場景中，波束橢圓應在地表滑動，UE 位於橢圓邊緣時信號衰減，當 UE 距離波束中心 ![][image2] 滿足 ![][image3] 區間時，觸發硬切換（Hard Switch，瞬間斷開舊鏈接並同步至新波束）14。

### **物理層與協議層指標之空間視覺轉化**

為了向答辯委員會證明多目標 DQN 政策的優越性，模擬器不能只停留在卡通化的連線，必須將以下通訊參數進行空間幾何化11：

* **仰角閾值（Elevation Angle Threshold, EAT）與同頻干擾（CCI）：** EAT 是設備與衛星建立通訊的最小地平線夾角13。較低的 EAT 意味著更多衛星可視，但波束在地表掃過的路徑變長，大幅增加了多個相鄰小區使用相同頻率時的同頻干擾（CCI）13。模擬器應允許調整 EAT 滑桿，當 EAT 降低時，地表波束重疊區域應以亮紅色干擾波紋（Moiré pattern 著色器）呈現，直觀展現「寬覆蓋與高干擾」的折衷關係13。  
* **3GPP 信令可視化：** 在進行交接慢動作事件時，應動態呈現系統資訊塊 19（SIB19，包含衛星星曆與速度向量組件）的廣播電磁波漣漪15。接著呈現 UE 與衛星之間的 RRC 重配置（RRC Reconfiguration）信令線條流動，將複雜的協議握手轉化為具備方向感的粒子流15。

## **3\. 強化學習策略決策、價值地景與反事實軌軌跡之可解釋性視覺化**

強化學習（RL）常被學術界視為「黑盒子」16。在論文答辯中，僅展示累積獎勵（Reward）曲線通常不足以說服委員會，系統必須提供「可解釋強化學習（XRL）」視覺介面，讓委員看清 Policy 與 Q-Value 的即時動態16。

### **價值地景（Value Landscape）與 Q 值向量場**

在 3D 用戶終端周圍，可藉由二維著色器渲染「Q 值場」與「狀態價值地景（Value Landscape）」17。

* **狀態價值（State-Value, ![][image4]）熱圖：** 用戶地表的背景顏色應基於貝爾曼最優方程 ![][image5] 進行實時計算19。高價值狀態（信噪比高、波束餘裕度大、切換機率低）著色為深綠色，而瀕臨斷線或擁塞的區域則呈現紅色波動「能量浪潮」，生動展示價值回溯（Value Propagation）的過程17。  
* **Q 值動作向量：** 當使用者選中某個特定用戶終端（Protagonist User）時，系統從該終端向天空中所有可見衛星發射 3D 半透明雷達波束，波束的粗細與脈動頻率正比於該動作的即時 ![][image6] 值17。這能讓委員一目了然：演算法選擇連接 A 衛星而非 B 衛星，是因為當前動作在 Q-Table 中擁有最高的未來期望回報（如兼顧了 fairness 與能量效率）17。

### **反事實軌跡（Counterfactual Trajectories）與對比解釋**

為證明 RL 決策的必要性，必須向非專業用戶與學術委員展示「反事實（Counterfactual）」分析——即「如果當時沒有這樣配置，後果會如何？」21。系統可透過雙軌滾出（Rollout）機制達成此目標23：

                              \[當前時間步 t：交接決策點\]  
                                      /        \\  
                                     /          \\  
  \[RL 政策 π\_θ (智慧分流)\] \<─────────            ─────────\> \[幼稚基準/人工操作 (貪婪策略)\]  
            │                                                      │  
     持續最優多目標配置                                             波束過載與同頻干擾  
            │                                                      │  
  \[結果：100% 用戶綠色覆蓋\]                                       \[結果：大面積紅色飢餓與斷線\]

1. **行為政策（Behavioral Policy, ![][image7]）軌跡：** 模擬器運行訓練好的多目標 DQN 政策，展現流暢的負載平衡與無縫交接23。  
2. **反事實分支點：** 使用者可在任意時間點暫停模擬，並手動拖動滑桿或強制更改某個 UE 的連接對象（例如強行接入已過載的衛星）21。  
3. **探索政策（Exploratory Policy, ![][image8]）仿真：** 系統以此干預狀態為起點，在背景或分屏中運行一條「反事實平行線」，在接下來的 ![][image9] 個時間步中，展示該錯誤決策如何導致相鄰波束發生連鎖過載、頻率衝突，最終引發區域性的「網絡飢餓崩塌」21。

## **4\. 政策干預效果之統計量化與結構公平性（Fairness）Legible 視覺呈現**

當多目標 DQN 政策介入時，系統會從「幼稚基準（Greedy/Max-SINR）」切換至「智慧分流」。此時，用戶狀態會發生整體重組。如何讓這種集體的、統計學上的「公平性提升」在 3D 空間中直觀可讀，是數據視覺化的核心任務24。

### **公平性衡量指標之空間映射**

系統應即時計算並呈現在線通訊公平性指標。多維度公平性度量的對比與視覺化策略如下表所示24：

| 公平性指標 | 數學定義式 | 視覺化呈現模式 | 對特定電信場景之敏感度 |
| :---- | :---- | :---- | :---- |
| **Jain's 公平指數 (Jain's Index)** \[cite: 24, 27\] | ![][image10] 其中 ![][image11] 為用戶歸一化吞吐量27。 | 渲染為一條動態彩色儀表板，數值範圍為 ![][image12]，其中 ![][image13] 代表絕對公平（所有用戶獲得均等服務）24。 | 對極端 starvation（尾部飢餓）不敏感。若 90% 用戶體驗良好，10% 徹底斷網，指數仍高達 0.927。 |
| **G's 公平指數 (G's Index)** \[cite: 24\] | 基於乘積（Product-based）的公平性度量，強調群體內部的一致性24。 | 渲染為高敏感度的「波動指針」，數值越低代表差異越劇烈24。 | 對極端值極度敏感。若有數個用戶吞吐量降至接近零，該指數會迅速崩塌至 ![][image14]，非常適合用於展示尾部用戶保障24。 |
| **吉尼係數 (Gini Coefficient)** \[cite: 25, 26, 30\] | ![][image15] 即完美等分線與勞倫茲曲線之間的面積佔比25。 | 即時繪製二維折線圖中的**勞倫茲曲線（Lorenz Curve）**，動態標註並填充面積 ![][image16] 與 ![][image17]25。 | 能精確量化整個 Constellation 覆蓋範圍內資源分配的相對不平等度26。 |

### **勞倫茲曲線與地表點分配（Dot-Distribution）的聯動設計**

在 3D 球體旁的 HUD 面板中，勞倫茲曲線的橫軸代表累計地面用戶比例（按吞吐量由低到高排序），縱軸代表累計獲得的總網絡帶寬比例25。

* **基準模式（模式 A \- 崩塌）：** 當運行貪婪演算法時，由於「用戶扎堆」，少數靠近波束中心的幸運 UE 搶佔了全部帶寬，勞倫茲曲線會深深向右下方彎曲，吉尼係數逼近 ![][image13]26。此時 3D 地球上的用戶終端點呈現極端的「兩極化」：少數核心點呈現亮綠色高頻脈動，而邊緣的大量用戶點則呈現暗紅色死亡狀態。  
* **RL 智慧介入（模式 B \- 平衡）：** 當使用者點擊切換至「智慧 RL 模式」，演算法通過拍賣機制重新分配資源，3D 地面上的暗紅點瞬間轉化為淡綠色穩定狀態。與此同時，勞倫茲曲線在地產生的彈性動畫中，平滑地向上彈起，逼近 45 度的「完美公平線」，吉尼係數迅速下降，直觀展現了演算法對於「網絡長尾用戶」的拯救26。

## **5\. 建設性失敗（Productive Failure）與「成為系統」之教育遊戲機制設計**

為了讓非專業大眾真正理解為什麼「簡單的貪婪算法會崩塌」以及「為什麼需要強化學習」，模擬器必須設計一個具備高參與度的遊戲關卡，讓玩家在主動的嘗試與失敗中建構正確的思維模型32。

### **建設性失敗（Productive Failure）的關卡設計**

基於 Manu Kapur 的「建設性失敗」教育理論，教學過程應拆分為兩個關鍵階段34：

  \[探索階段 (Generation Phase)\]           \[整合階段 (Consolidation Phase)\]  
  \- 玩家手動接管波束調配滑桿             \- 引入 RL 演算法的最優決策路徑  
  \- 面對高維度動態星群交接               \- 對比玩家手動歷史與演算法最優解  
  \- 經歷「必然的系統擁塞與崩塌」         \- 解釋多目標優化與拍賣機制的物理意義

* **探索階段（Generation Phase）：** 遊戲不提供任何預先指導34。關卡「You be the Algorithm」要求玩家手動控制 3 顆運動衛星的波束指向與頻率分配，嘗試為地表的 50 個移動用戶提供不中斷服務32。由於波束通道容量有限且存在頻率碰撞約束，玩家會迅速陷入手忙腳亂的「掙扎」中，並目睹系統大面積斷線崩塌32。這種失敗是有意設計的，它激活了使用者的先前知識，並使其清晰定位自身知識的邊界（即手動 heuristic 無法處理高維動態協調問題）32。  
* **整合階段（Consolidation Phase）：** 失敗發生後，系統即時介入，將玩家剛才手動調配的「歷史軌跡」與多目標 DQN 的「最優軌跡」進行側向對比，引導使用者發現多目標優化底層的科學邏輯34。

### **錯誤反思與元認知（Metacognitive）回饋循環**

為了防止使用者因單純的失敗而產生挫折感，遊戲必須內嵌 Alison Lee 的元認知三步反思機制36：

1. **錯誤精確化（Error Specification）：** 遊戲結束時，不只顯示 "Game Over"，而是用視覺指針明確指出崩塌原因（例如：「衛星 A 的 3 號波束因頻率衝突損失了 80% 容量，導致 15 個用戶因擁塞 starvation」）8。  
2. **資訊尋求（Information Seeking）：** 點擊錯誤節點時，彈出「互動式原理卡片」（如頻率複用與仰角折衷），引導使用者主動尋找解決方案8。  
3. **應用實踐（Application）：** 允許使用者帶著新獲取的微調參數重新挑戰相同軌跡，觀察系統吞吐量的提升，從而將失敗轉化為深刻的學習動能32。

### **人類直覺 vs. 機器策略之 fragile 與 robust 特性**

實證研究表明，雖然機器策略在簡單、靜態的環境中能實現遠超人類的反應速度（如 SonicDoom 測試中 AI 速度為人類三倍以上），但在動態、高威脅或未建模的複雜邊界場景中，機器的反應式 Policy 往往表現出脆弱性（Fragility）；相反，經驗豐富的人類專家則能展現出極強的認知遷移與魯棒性（Robustness）37。  
在模擬器中，應特意引入「突發極端天氣」或「地緣遮擋」等突發擾動，在此邊界場景下，展示 AI 策略如何通過重組機制快速調整，而幼稚基準算法則會徹底癱瘓，藉此向答辯委員會展示 RL 算法的環境適應彈性。

## **6\. 學術答辯現場（Live Demo）之去風險、確定性與質疑對抗控制架構**

學術答辯是一場高壓力的即時學術論證38。任何因瀏覽器相容性、網絡延遲或隨機數抖動導致的 Demo 異常，都可能對演算法的嚴謹性產生致命質疑38。因此，系統架構必須進行極其嚴格的「去風險化（De-risking）」設計38。

### **現場展示去風險化架構與控制**

  \[答辯委員會現場提問\] ───\> 激活「壓力測試控制面板 (Stress Controls)」  
                                    │  
          ┌─────────────────────────┼─────────────────────────┐  
          ▼                         ▼                         ▼  
  \[隨機星曆/星群故障\]        \[同頻干擾 EAT 滑桿\]       \[動態用戶湧入 (10x)\]  
          │                         │                         │  
  多目標 DQN 自動重新調度     即時 Moiré 紅色區域干擾      RL 解碼算法平滑分流  
          │                         │                         │  
  證明 Robust 容災能力      證明對物理限制之嚴謹考量    證明演算法多用戶拓展性

模擬器應整合以下工程化防禦性機制：

* **完全離線星曆沙盒（Headless Ephemeris Sandbox）：** 絕不依賴實時網絡 API（如 Celestrak 的 live TLE 抓取）15。系統應將一組經過驗證的 Starlink 歷史星曆（TLE 兩行軌道要素數據）直接硬編碼為靜態 JSON 檔案15。運行時，SGP4 星歷傳播器完全在本地執行，徹底杜絕現場斷網導致的渲染失敗42。  
* **硬核確定性 seed 鎖定：** 用戶設備（UE）的運動軌跡、通道衰落隨機過程（Rayleigh Fading）以及強化學習探索噪聲，必須全部使用帶有「種子鎖定（Seed Lock）」的偽隨機數生成器（PRNG）。這保證了在答辯現場，每一次切換「基本 ↔ 智能模式」時，對比的初始物理場景是 100% 一致的，消除了隨機性對演算法性能對比的干擾。  
* **答辯階段式耦合驗證（Staged Coupling Validation）：** 參考控制工程中硬體在環（HIL）的測試流程，模擬器的底層算法與 3D 渲染層應採用解耦架構40。

下表列出答辯展示中常見的突發風險、風險特徵及系統內嵌的對抗性設計方案39：

| 答辯現場突發風險 | 發生機率 | 衝擊程度 | 系統去風險化與對抗性設計方案 \[cite: ID\] |
| :---- | :---- | :---- | :---- |
| **現場網絡連接中斷** \[cite: 38, 39\] | 中等 | 致命 | **離線資料沙盒化**：將 TLE 軌道數據、地圖瓦片（Tile Map）全部本地封裝，利用 Service Worker 實現完全離線 PWA 運行42。 |
| **瀏覽器 WebGL 上下文丟失** \[cite: 44\] | 低 | 高 | **上下文重建監聽**：註冊 webglcontextlost 事件，一旦觸發，自動暫停動態計算並平滑重啟 WebGLRenderer，重載紋理資源44。 |
| **軟體渲染幀率過低 (CPU 暴增)** \[cite: 45, 46\] | 高 | 高 | **Drei PerformanceMonitor 降級**：檢測到幀率低於 15fps 超過 3 秒，自動將 DPR 砍至 0.5，關閉 postprocessing 效果並將 3D 模型強制降級為 billboard 2D 精靈圖47。 |
| **委員會質疑演算法的魯棒性** \[cite: 23\] | 高 | 中 | **委員會「壓力測試面板」**：現場一鍵觸發「50% 衛星節點瞬間失效」、「極端暴雨信號衰減滑桿」或「10 倍群眾大流量湧入」，即時證明 RL 的自適應彈性40。 |

## **7\. WebGL 與 React-Three-Fiber 於低端及軟體渲染環境之 legible 高效能渲染策略**

本系統的部署環境面臨嚴苛限制：目標演示機器缺乏獨立 GPU 晶片，完全依賴 CPU 執行 WebGL 軟體渲染（如 SwiftShader 模擬層）45。在這種環境下，CPU 同時承擔了星曆計算、RL 推理以及像素光柵化的繁重任務，極易出現幀率崩塌45。必須在 React-Three-Fiber（R3F）與 Three.js 中實施極限效能優化策略44。

### **消除繪製呼叫（Draw Call）的極限優化**

在軟體渲染中，Draw Call 引起的 CPU 驅動切換開銷是第一殺手44。系統必須將總 Draw Call 控制在 50 次以內44：

* **針對大量用戶 terminal（UE）與波束投影點：** 嚴禁使用個別的 new Mesh() 組件44。必須使用一個單一的 InstancedMesh 來渲染所有地面用戶，並通過動態變更實例矩陣（Instance Matrix）與實例色彩（Instance Color）Buffer 來更動其位置和狀態（服務/飢餓）44。  
* **針對多樣幾何體整合：** 若需要渲染多個不同外觀的衛星，可採用 BatchedMesh（r156+），在共享同一材質的前提下，將多個不同的幾何體打包入單次 Draw Call，同時保持各個實體的可獨立定址與遮罩（Show/Hide）特性44。  
* **動態空間包圍體層次結構（BVH）：** 對於高密度用戶點的射線檢測（Raycasting）和視錐裁剪（Frustum Culling），應調用 three-mesh-bvh 或在 InstancedMesh 上建立動態包圍盒層次結構44。這能將射線與十萬個用戶點的碰撞複雜度由 ![][image18] 降至 ![][image19]，避免滑鼠滑過場景時產生嚴重的畫面卡頓49。

### **克服 iOS/Safari 及 Metal 模擬層編譯卡頓（Shader Warmup）**

在 Safari 瀏覽器（或 iOS 設備）中，WebGL 會被轉化為 Metal 指令執行51。Safari 的 webglPrepareUniformLocationsBeforeFirstDraw 機制會在首個動態組件渲染時強制遍歷並緩存所有著色器 Uniform 變數，每次 WebGL API 呼叫耗時高達 3 毫秒51。

* **解決方案：** 必須建立「著色器預熱（Shader Warmup）」機制51。在加載黑屏（Splash Screen）階段，預先創建全套自定義材質（包括 Moiré 同頻干擾材質、波束流動線條材質），並使用 renderer.compile() 將其繪製在一個像素大小的隱藏 Canvas 上，強制 WebKit 在初始階段完成著色器編譯，徹底消除交接動畫觸發時的「3 秒首畫面凍結」現象51。

### **避免 R3F 狀態更新陷阱：零 React 狀態渲染迴圈**

在 R3F 中，任何以 React State（如 useState 或 Redux/Zustand 訂閱）形式驅動 60fps 動態更新的嘗試，都會因 React 虛擬 DOM 的調和（Reconciliation）開銷而摧毀效能52。

* **優化模式：** 所有的運動物體更新必須直接在 R3F 的 useFrame 鉤子中執行44。透過直接修改 3D 對象的原生 Object3D.position 或 Material 的 uniforms.value 引用來實現「零 React 狀態更新」52。網頁的 2D UI 組件僅在發生「切換演算法、手動滑桿釋放」等離散事件時，才接收單次 React 狀態更新52。

JavaScript  
// 效能優化示例：直接變更引用以避免 React 渲染開銷  
const userGroupRef \= useRef();

useFrame((state) \=\> {  
  if (\!userGroupRef.current) return;  
    
  // 直接讀取 pre-computed 軌道 Float32Array，繞過 React State  
  const positions \= OrbitCalculator.getPositionsAtTime(state.clock.getElapsedTime());  
    
  // 零 React 調和開銷的矩陣直接更新  
  for (let i \= 0; i \< positions.length; i++) {  
    tempMatrix.setPosition(positions\[i\].x, positions\[i\].y, positions\[i\].z);  
    userGroupRef.current.setMatrixAt(i, tempMatrix);  
  }  
  userGroupRef.current.instanceMatrix.needsUpdate \= true;  
});

## **8\. LEO 星座足跡與能量效率視覺隱喻先前技術（Starlink Prior Art）**

建構 LEO 模擬器時，我們必須站立在巨人的肩膀上。目前在太空中星群與波束邊界的可視化領域，已存在具備高度學術與工業參考價值的先前技術。

### **空間-天空雙視角投影先前技術（The Space-Sky Dualism）**

Julien Simon 開源的 starlink-viz 項目展示了極其成熟的雙重視角轉換架構42：

* **空間視角（Space View）：** 地球處於三維世界座標系中心，約 10,000 顆衛星在五個軌道殼（Shells）中運行，利用 SGP4 軌道力學引擎動態更新位置42。其優化亮點在於：所有的軌道傳播計算全部在一台無頭（Headless）傳播器組件中完成，並將計算結果寫入一個共享的 Float32Array 中42。  
* **天空視角（Sky View）：** 系統基於用戶所在的東-北-天（ENU, East-North-Up）地平參考系，將 geocentric 3D 座標投影至本地觀測穹頂上（Stellarium 模式）42。在穹頂上，正在為該用戶服務的衛星被包圍在一個動態發光的「光環（Glow Halo）」中，當交接發生時，光環平滑地淡出，並在目標衛星上淡入，同時渲染一條高對比度的彩色連線代表上行（Cyan）、雷射星間鏈路（Green ISL）與下行（Orange）通道42。模擬器應完全繼承此「共享緩衝區雙視角」模式，以實現零負擔的視角切換42。

### **星間波束與能量效率優化的視覺隱喻**

在多目標 DQN 中，除了最大化覆蓋度與公平性外，另一大核心優化指標是**降低衛星能耗**（即在無用戶覆蓋需求或相鄰波束重疊時，動態關閉波束發射機或使其進入低功耗休眠態）53。  
如何將抽象的「能量效率優化」轉化為直觀的視覺隱喻？

* **動態錐形發光著色器：** 波束不應是靜態的實心幾何體，而應設計為半透明的、帶有漸變粒子流的圓錐體（Cone Shaders）53。當衛星將波束功率調低或關閉時，圓錐體的邊緣發光（Emissive Glow）強度和粒子流動速度平滑降低，最終轉為一條極細的冷色（如深藍）虛線框。  
* **能量消耗實時計量盤：** 在衛星頭頂上方，利用 HTML-3D 混合組件（R3F 的 \<Html /\> 組件）渲染微型電池計量條。當演算法實施智能波束合併、關閉冗餘發射機時，能耗計量條明顯縮短，伴隨著發熱紅色向節能綠色的轉變，直觀證明「多目標優化」在節省空間能源上的卓越成效。

## **9\. 關鍵設計範例（Shortlist of Exemplars）之分級評估與選型依據**

基於本項目的雙重定位，以下篩選出四個最具 emulate（效仿）價值的經典先前技術項目，並進行深度的學術與工程評級：

### **1\. starlink-viz (Julien Simon)**

42

* **技術定位：** 開源高密度 LEO 衛星與地面站實時追蹤可視化平台。  
* **選型理由：** 這是目前市面上與 LEO 星群波束交接最契合的先前技術42。它完整解決了「萬級實體 propagation 與 legible 渲染」的效能痛點，且其實時追蹤下行/上行/ISL 鏈路與手動 handover 事件日誌的 UI 佈局，是答辯委員會極其欣賞的「系統級嚴謹介面」42。  
* **借鑒模式：** 共享 Float32Array 星曆傳播緩衝區42；ENU 本地觀測穹頂投影算法42。

### **2\. Transformer Explainer (Georgia Tech / 2026 ACM CHI)**

7

* **技術定位：** 互動式深度學習 Transformer 架構可探索解釋器。  
* **選型理由：** 它展示了如何將枯燥的「張量乘法、參數配置」轉化為極其平滑、現代的漸進式故事線7。其原位引導（In-situ Guidance）機制能讓非專業大眾在滑鼠滑過時，瞬間看懂底層多頭自注意力機制的物理對應，是本系統設計「Onboarding」與「專家標籤切換」的最佳參考對象7。  
* **借鑒模式：** 文本與 3D 著色器變量實時聯動綁定7；多層次 UI 漸進式展開。

### **3\. exploRNN (Alex Bäuerle / The Visual Computer)**

55

* **技術定位：** 互動式循環神經網絡（RNN）與 LSTM 內部數據流可探索教學模擬器。  
* **選型理由：** 該項目提供了如何引導非專家學習「具備時間序列特性的動態演算法」的實證範本55。它巧妙地將動態圖表、網絡結構拓撲與文字高亮氣泡結合，經用戶研究證實，對於促進「深層概念理解」有顯著成效55。  
* **借鑒模式：** 帶定位箭頭的脈絡化提示氣泡55；動態時序流中穿插反事實「暫停與重試」機制55。

### **4\. MDP Simulator Basic (Thiruthanigesan)**

19

* **技術定位：** 互動式馬可夫決策過程與動態規劃（值疊代/策略疊代）可視化器。  
* **選型理由：** 直觀呈現了強化學習在網格世界中的「收斂動態」19。它將 Bellman 方程的動態回溯波（Value wave）轉化為直觀的綠色漸變能量波擴散過程，極具視覺衝擊力19。  
* **借鑒模式：** 值疊代（Value Iteration）與策略疊代（Policy Iteration）的側向分屏對比19；動態箭頭指示矩陣策略17。

## **10\. 實作指南：關鍵實踐（Do）與設計避坑（Don't）清單**

本節為互動式模擬器的實際前端代碼開發提供高度精確的實踐指南。

### **研發與演示關鍵實踐 (DOs)**

* **DO 在演示加載階段實施著色器預熱（Shader Warmup）：** 將所有自定義 Moiré 干擾、波束 Cone 流動等著色器在微型離線畫布上先行編譯，避免在答辯現場切換模式時出現卡頓51。  
* **DO 採用無 React 狀態（Ref-driven）的 useFrame 循環更新：** 衛星與用戶點的位移、信號連線、Q 值向量箭頭等高頻更新，必須直接修改底層 Object3D 的實例屬性，徹底繞過 React Virtual DOM 渲染52。  
* **DO 導入 Bounding Volume Hierarchy (BVH) 包圍體空間索引：** 用於處理滑鼠指針與數百個地面用戶之間的動態 Hover 射線檢測，避免在軟體渲染環境中造成 CPU 主執行緒阻塞44。  
* **DO 硬編碼一組完全確定且本地封裝的 TLE 數據快照：** 作為現場演示的沙盒依據，杜絕現場調用外部 API 發生斷網、或動態數據產生異常抖動15。  
* **DO 提供答辯專用「壓力測試面板」：** 現場一鍵點擊可動態注入超高載流量、模擬暴雨造成的多徑衰落（Multipath Fading），或人工殺死特定的衛星節點，強烈對比出 RL 的自動容災自癒能力23。

### **研發與演示設計避坑 (DON'Ts)**

* **DON'T 在 R3F 更新循環中創建臨時對象：** 嚴禁在 useFrame 內部寫入 new Vector3()、new Matrix4()，這會引發頻繁的垃圾回收（GC），在無 GPU 支援的 CPU 軟體渲染器中會造成嚴重的畫面微小卡頓（Jank）44。  
* **DON'T 允許模擬器在瀏覽器標籤頁切換到後台時繼續渲染：** 必須監聽頁面可見性 API（Visibility API），一旦使用者切換至 PPT 或其他標籤，立即暫停 3D 渲染與演算法疊代，以防止答辯筆記型電腦過熱風扇暴轉，甚至導致瀏覽器崩潰47。  
* **DON'T 在多用戶高頻更新中採用傳統的個別 React \<mesh\> 組件：** 用戶點、波束等必須打包在統一的 InstancedMesh 中，否則會使 Draw Call 超過 500 次，直接摧毀低端機型的渲染幀率44。  
* **DON'T 在遊戲失敗時僅顯示無建設性的 "Game Over"：** 避免讓非專業大眾使用者陷入純粹的挫折。必須精確指出崩塌瓶頸（如同頻干擾過高），並給予立即的反思性資訊提示34。  
* **DON'T 依賴即時動態 Q-learning 推理作為前端高頻運行的唯一管道：** 在軟體渲染環境中，如果前向推理過慢，應考慮「預先計算好最優 RL 配置矩陣（預烘焙軌跡）」，現場僅進行插值播放，而將「即時推理」限制在特定單個用戶手動微調的交互分支上。

## **11\. 系統設計之核心矛盾與權衡機制（Design Contradictions）**

在建構此模擬器時，存在三個根深蒂固的核心矛盾。設計團隊必須理解這些矛盾，並在開發中實施具體的權衡方案：

### **矛盾 1：低延遲網頁渲染（60fps）與複雜軌跡/RL即時計算的 CPU 資源爭奪**

* **理論衝突：** 為了保證非專業用戶的沉浸感與流暢體驗，模擬器必須穩定在 60fps（每幀僅 16.67 毫秒預算）49。然而，LEO 多波束星座的 SGP4 軌道外推、多個小區通道衰落計算、以及多目標 DQN（包含 coordinated 拍賣解碼程序）的前向推理，需要密集的浮點數運算11。在缺乏 GPU 的 CPU 軟體渲染環境中，兩者在同一主執行緒上競爭 CPU 週期，必然導致幀率雪崩45。  
* **權衡方案：** 實施**計算-渲染時間解耦與 Worker 執行緒分流**。星曆外推與拍賣解碼演算法完全移入獨立的 Web Workers 中執行，以較低的頻率（如 20Hz）進行計算，計算結果通過 Transferable Objects 零拷貝傳遞回主執行緒44。主執行緒的 R3F 渲染層則以 60fps 執行，並在兩個計算幀之間使用高階 Hermite 樣條曲線（Spline Interpolation）對衛星與用戶的動態位置進行平滑插值，實現「輕量級計算、高流暢度表現」的完美平衡42。

### **矛盾 2：Jain 公平指數的宏觀「假平滑」與尾部用戶極端「餓死」的視覺真實性**

* **理論衝突：** Jain's Fairness Index 是一個對稱公平度量，在統計學上被廣泛採用，但它具有「平均化」特點24。例如，在多用戶配置中，若 90% 用戶完美服務，10% 用戶完全 starvation（零帶寬，極端飢餓），Jain 指數依然能高達 0.927。這會與 3D 地面上「大片用戶呈現亮紅色飢餓點」的淒慘視覺畫面產生嚴重的「認知失調」：數值顯示 "Excellent Fairness (0.9)"，而視覺畫面上卻是大規模崩塌，這在答辯中會招致委員對於演算法公平度量嚴謹性的質疑。  
* **權衡方案：** 系統應採用**雙指標並行及非對稱公平測度**28。在 2D HUD 面板中，將 Jain 公平指數（宏觀效率）與 G's 公平指數（微觀尾部保障）進行雙線繪製，並在吉尼係數折線圖中對「長尾用戶段（底部的 10% 區間）」進行特殊的橙色警示高亮24。同時，介面導入「Per-user Perception of Fairness」（個人公平感知）指標27。這向委員證明：我們的 RL 演算法不僅優化了宏觀的 Jain 指數，而且通過非對稱優化函數特別保障了尾部用戶的最低服務水平（即將 G's 指數從 0.0 提升至 0.85）24。

### **矛盾 3：引導性提示（Scaffolding）與建設性失敗（Productive Struggle）的認知衝突**

* **理論衝突：** 互動設計通常追求「無縫引導」，即在使用者遇到任何障礙前即時提供操作提示或自動修正（Scaffolding），以減少挫折感並降低流失率34。然而，建構主義教育理論（Productive Failure）明確指出：如果過早提供引導、或者直接給予最優算法的自動配置，使用者將失去主動探索系統底層約束的「認知掙扎」機會，導致其無法真正建立「為什麼 greedy 算法會崩塌、為什麼需要 RL 協調」的深層概念理解32。  
* **權衡方案：** 實施**階段隔離與「挫折沙盒」模式**34。將系統明確劃分為「遊戲/挑戰模式（挑戰失敗）」與「智能展示模式」35。在挑戰模式中，系統關閉所有主動引導與 RL 協調，放手讓使用者去體驗「必然的系統過載與崩塌」，僅在崩塌發生後，才激活元認知反思工具箱（解鎖 SIB19 信令分析與干擾 Moiré 紋理），引導使用者進入「智能 RL 模式」進行概念整合15。這既保護了非專家的探索 agency（自主性），又完美符合了高階學習機制的科學規律35。

#### **引用的著作**

1. Augmented Text, [https://www.augmented-text.com/](https://www.augmented-text.com/)  
2. Moonshine — Interactive Technical Explanations, [https://enjalot.github.io/moonshine/?utm\_campaign=ai-tinkerers-atlanta-community-demos-technical-deep-dives\&utm\_content=link1\&utm\_medium=ai-tinkerers\&utm\_source=atlanta](https://enjalot.github.io/moonshine/?utm_campaign=ai-tinkerers-atlanta-community-demos-technical-deep-dives&utm_content=link1&utm_medium=ai-tinkerers&utm_source=atlanta)  
3. deyaa1251/Awesome-tech-resource: Top notch tech ... \- GitHub, [https://github.com/deyaa1251/Awesome-tech-resource](https://github.com/deyaa1251/Awesome-tech-resource)  
4. Mechanical Watch | Hacker News, [https://news.ycombinator.com/item?id=31261533](https://news.ycombinator.com/item?id=31261533)  
5. pyxelr/recommendations-for-engineers \- GitHub, [https://github.com/pyxelr/recommendations-for-engineers](https://github.com/pyxelr/recommendations-for-engineers)  
6. TableTale: Reviving the Narrative Interplay Between Data Tables and Text in Scientific Papers \- arXiv, [https://arxiv.org/html/2602.22908v1](https://arxiv.org/html/2602.22908v1)  
7. Transformer Explainer: Learning LLM Transformers with Interactive Visual Explanation and Experimentation \- Minsuk Kahng, [https://minsuk.com/papers/transformer\_explainer-chi26.pdf](https://minsuk.com/papers/transformer_explainer-chi26.pdf)  
8. geist-learning-lab | Agent Skills Library \- Awesome MCP Servers, [https://mcpservers.org/agent-skills/vercel/geist-learning-lab](https://mcpservers.org/agent-skills/vercel/geist-learning-lab)  
9. anantham/portfolio: Personal portfolio website \- Building bridges to niche subcultures with zen-inspired design and contemplative content \- GitHub, [https://github.com/anantham/portfolio](https://github.com/anantham/portfolio)  
10. Real-Time Handover in LEO Satellite Networks via Markov Chain-Guided Simulated Annealing \- MDPI, [https://www.mdpi.com/2673-8732/5/4/49](https://www.mdpi.com/2673-8732/5/4/49)  
11. Handover schemes in satellite networks: state-of-the-art and future research directions \- SciSpace, [https://scispace.com/pdf/handover-schemes-in-satellite-networks-state-of-the-art-and-35yj2eb8ap.pdf](https://scispace.com/pdf/handover-schemes-in-satellite-networks-state-of-the-art-and-35yj2eb8ap.pdf)  
12. Seamless Handover in Direct-to-Device Satellite Networks: From an Interference-Aware Perspective \- arXiv, [https://arxiv.org/html/2603.00470v1](https://arxiv.org/html/2603.00470v1)  
13. NTN \- Mobility | 5G-MAG \- Tech, [https://hub.5g-mag.com/Tech/pages/NTN/Analysis\_Mobility\_NTN.html](https://hub.5g-mag.com/Tech/pages/NTN/Analysis_Mobility_NTN.html)  
14. Integrated Handover Simulation Framework for Non-Terrestrial Network \- Cloudfront.net, [https://d2j16w31g89z0j.cloudfront.net/site/ictc2025/abs/P06-2.pdf](https://d2j16w31g89z0j.cloudfront.net/site/ictc2025/abs/P06-2.pdf)  
15. Synthesising Reinforcement Learning Policies through Set-Valued Inductive Rule Learning? \- ida.liu.se, [https://www.ida.liu.se/\~frehe08/tailor2020/TAILOR\_2020\_paper\_48.pdf](https://www.ida.liu.se/~frehe08/tailor2020/TAILOR_2020_paper_48.pdf)  
16. Visualizing Policies and Value Functions in Reinforcement Learning \- CodeSignal, [https://codesignal.com/learn/courses/game-on-integrating-rl-agents-with-environments/lessons/visualizing-policies-and-value-functions-in-reinforcement-learning](https://codesignal.com/learn/courses/game-on-integrating-rl-agents-with-environments/lessons/visualizing-policies-and-value-functions-in-reinforcement-learning)  
17. VISUALIZING AND UNDERSTANDING DEEP REIN- FORCEMENT LEARNING POLICIES \- UBC Computer Science, [https://www.cs.ubc.ca/\~setarehc/data/understanding\_policies.pdf](https://www.cs.ubc.ca/~setarehc/data/understanding_policies.pdf)  
18. Visualizing Reinforcement Learning: A Hands-On Guide to Value and Policy Iteration with the MDP Simulator | by Thiruthanigesan | Medium, [https://medium.com/@thiru.sliit/visualizing-reinforcement-learning-a-hands-on-guide-to-value-and-policy-iteration-with-the-mdp-0558851de8b3](https://medium.com/@thiru.sliit/visualizing-reinforcement-learning-a-hands-on-guide-to-value-and-policy-iteration-with-the-mdp-0558851de8b3)  
19. Navigating the Grid: A SARSA Reinforcement Learning Journey with PyQt5 Visualization | by Engin Deniz TANGUT | Medium, [https://medium.com/@EnginDenizTangut/navigating-the-grid-a-sarsa-reinforcement-learning-journey-with-pyqt5-visualization-58d41c4cb697](https://medium.com/@EnginDenizTangut/navigating-the-grid-a-sarsa-reinforcement-learning-journey-with-pyqt5-visualization-58d41c4cb697)  
20. Counterfactual-Based Action Evaluation Algorithm in Multi-Agent Reinforcement Learning, [https://www.mdpi.com/2076-3417/12/7/3439](https://www.mdpi.com/2076-3417/12/7/3439)  
21. Contrastive Visual Explanations for Reinforcement Learning via Counterfactual Rewards \- University of Bristol Research Portal, [https://research-information.bris.ac.uk/en/publications/contrastive-visual-explanations-for-reinforcement-learning-via-co/](https://research-information.bris.ac.uk/en/publications/contrastive-visual-explanations-for-reinforcement-learning-via-co/)  
22. \[2201.12462\] Explaining Reinforcement Learning Policies through Counterfactual Trajectories \- arXiv, [https://arxiv.org/abs/2201.12462](https://arxiv.org/abs/2201.12462)  
23. Fairness measure \- Wikipedia, [https://en.wikipedia.org/wiki/Fairness\_measure](https://en.wikipedia.org/wiki/Fairness_measure)  
24. Gini index \- Glossary | DataBank, [https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SI.POV.GINI](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SI.POV.GINI)  
25. Understanding Lorenz Curve & Gini Coefficient | PDF \- Scribd, [https://www.scribd.com/presentation/685157354/Lorenz-Curve-and-Gini-Coefficient-3](https://www.scribd.com/presentation/685157354/Lorenz-Curve-and-Gini-Coefficient-3)  
26. 99-0045 Throughput Fairness Index: An Explaination, [https://www.cse.wustl.edu/\~jain/atmf/ftp/af\_fair.pdf](https://www.cse.wustl.edu/~jain/atmf/ftp/af_fair.pdf)  
27. An Axiomatic Theory of Fairness in Resource Allocation \- Princeton University, [https://www.princeton.edu/\~chiangm/fairness.pdf](https://www.princeton.edu/~chiangm/fairness.pdf)  
28. Fairness index | PPT, [https://pt.slideshare.net/slideshow/fairness-index/17407150](https://pt.slideshare.net/slideshow/fairness-index/17407150)  
29. Analysis of global inequality in research outcome using the Gini coefficient \- Emerald Insight, [https://www.emerald.com/pmm/article/22/1/25/321837/Analysis-of-global-inequality-in-research-outcome](https://www.emerald.com/pmm/article/22/1/25/321837/Analysis-of-global-inequality-in-research-outcome)  
30. The Lorenz Curve: A Great Way to Visualize Inequality \- DataCamp, [https://www.datacamp.com/tutorial/lorenz-curve](https://www.datacamp.com/tutorial/lorenz-curve)  
31. (PDF) Productive struggle and simulation design: actionable insights for designing engaging simulations \- ResearchGate, [https://www.researchgate.net/publication/397343475\_Productive\_struggle\_and\_simulation\_design\_actionable\_insights\_for\_designing\_engaging\_simulations](https://www.researchgate.net/publication/397343475_Productive_struggle_and_simulation_design_actionable_insights_for_designing_engaging_simulations)  
32. Cognitive Load and Situational Interest in Physics Laboratories: A Comparative Study Across Three Instructional Modalities \- arXiv, [https://arxiv.org/html/2602.06143v1](https://arxiv.org/html/2602.06143v1)  
33. Exploring students' behavioral patterns when playing educational games with learning supports at different timings \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC9161658/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9161658/)  
34. (PDF) Productive Failure \- ResearchGate, [https://www.researchgate.net/publication/381913649\_Productive\_Failure](https://www.researchgate.net/publication/381913649_Productive_Failure)  
35. Productive Responses to Failure for Future Learning \- Columbia Academic Commons, [https://academiccommons.columbia.edu/doi/10.7916/D88G8Z2V/download](https://academiccommons.columbia.edu/doi/10.7916/D88G8Z2V/download)  
36. The Novice, the Expert, and the Algorithm: A Comparative Analysis of Human Expertise Transfer and AI Performance in Audio-Only Gaming Environments \- MDPI, [https://www.mdpi.com/2076-3417/15/21/11594](https://www.mdpi.com/2076-3417/15/21/11594)  
37. Doing an MSc Thesis \- Jakob E. Bardram, MSc, PhD, [https://www.bardram.net/msc-thesis/](https://www.bardram.net/msc-thesis/)  
38. Development of a risk assessment and risk management tool for an academic research organization \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC10388373/](https://pmc.ncbi.nlm.nih.gov/articles/PMC10388373/)  
39. Comprehensive guide to real-time simulation for academic research \- OPAL-RT, [https://www.opal-rt.com/blog/comprehensive-guide-to-real-time-simulation-for-academic-research/](https://www.opal-rt.com/blog/comprehensive-guide-to-real-time-simulation-for-academic-research/)  
40. GitHub \- asyntes/starmonitor: 3D visualization of Starlink satellites orbiting Earth using Next.js, Three.js and CelesTrak live satellite data., [https://github.com/asyntes/starmonitor](https://github.com/asyntes/starmonitor)  
41. juliensimon/starlink-viz: Real-time 3D Starlink satellite tracker with Space view, Sky view, live dish telemetry, SGP4 propagation, and ISL routing. Track \- GitHub, [https://github.com/juliensimon/starlink-viz](https://github.com/juliensimon/starlink-viz)  
42. satellite-visualization · GitHub Topics, [https://github.com/topics/satellite-visualization](https://github.com/topics/satellite-visualization)  
43. 100 Three.js Tips That Actually Improve Performance (2026) \- Utsubo, [https://www.utsubo.com/blog/threejs-best-practices-100-tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips)  
44. ThreeJS SSR in AWS Lambda \- Reddit, [https://www.reddit.com/r/threejs/comments/micyk3/threejs\_ssr\_in\_aws\_lambda/](https://www.reddit.com/r/threejs/comments/micyk3/threejs_ssr_in_aws_lambda/)  
45. Rendering WebGL image in headless chrome without a GPU \- Stack Overflow, [https://stackoverflow.com/questions/48011613/rendering-webgl-image-in-headless-chrome-without-a-gpu](https://stackoverflow.com/questions/48011613/rendering-webgl-image-in-headless-chrome-without-a-gpu)  
46. Scaling performance \- Introduction \- React Three Fiber, [https://r3f.docs.pmnd.rs/advanced/scaling-performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)  
47. Building Efficient Three.js Scenes: Optimize Performance While Maintaining Quality, [https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)  
48. Three.js Performance Optimisation: 60fps Patterns | IGC \- Intelligent Graphic & Code, [https://www.intelligentgraphicandcode.com/development/threejs-interfaces/performance](https://www.intelligentgraphicandcode.com/development/threejs-interfaces/performance)  
49. GitHub \- agargaro/instanced-mesh: Enhanced InstancedMesh with frustum culling, fast raycasting (using a BVH), sorting, visibility, LOD, skinning and more., [https://github.com/agargaro/instanced-mesh](https://github.com/agargaro/instanced-mesh)  
50. Unity WebGL Safari Hang: The First-Draw Shader Stall \- Richard Fu, [https://www.richardfu.net/unity-webgl-safari-hang-shader-warmup/](https://www.richardfu.net/unity-webgl-safari-hang-shader-warmup/)  
51. From Flat to Spatial: Creating a 3D Product Grid with React Three Fiber \- Codrops, [https://tympanus.net/codrops/2026/02/24/from-flat-to-spatial-creating-a-3d-product-grid-with-react-three-fiber/](https://tympanus.net/codrops/2026/02/24/from-flat-to-spatial-creating-a-3d-product-grid-with-react-three-fiber/)  
52. quantumscript/beam-planner-spacex: Optimize Starlink beam formation between users and LEO satellite constellations \- GitHub, [https://github.com/quantumscript/beam-planner-spacex](https://github.com/quantumscript/beam-planner-spacex)  
53. Julien Simon juliensimon \- GitHub, [https://github.com/juliensimon](https://github.com/juliensimon)  
54. exploRNN: teaching recurrent neural networks through visual exploration \- ResearchGate, [https://www.researchgate.net/publication/361999354\_exploRNN\_teaching\_recurrent\_neural\_networks\_through\_visual\_exploration](https://www.researchgate.net/publication/361999354_exploRNN_teaching_recurrent_neural_networks_through_visual_exploration)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAYCAYAAABUfcv3AAADRElEQVR4Xu2XW6iNQRTH1wnlTsglyiWSkKRIIUmiEPFAlKLkScil5NLhSeRaFFJHiSh5UEoeTpQo4YEID8illJR4IfH/NTPOnPHtvb+zz+ak8/3r197f2rO/mVkza60Zs0KFCv19jRGLPK3SKDEoNeZUJ9EvsfUSPRNbrDXiirgl+ie//QvR/zRPq9QgfpZhXlPTPzRJfBVfxGvxQTwRQ+NGiXqL3eKVVb9g1YpFPeo/oWp1E5fFWXEyodF/sqtKCce9N+e0p6Leyu+2oAXWNo6bKramxmpUOK5KDRD7RcfETu65KIYk9lQ47lhqzKG2chwpYlxqrEYdRI/omd0FB8SUyF5KwXF1oo+V352xYsfxPxjtnylWA831v1TMNTfGWZ7tYqa5sfcVK8UmMdLKi01yRHRJ7DzTz3GxUywWw+IGebTEs8OcMyqJ0n7TXLgT1nfEFqvswNhxgQfmiss+MVjMMFd5X4jT5hYJJorn4ow4bK4QrRJvxVgrLRZgdWIj0igWy83Nl0i7aq6f3GL1rnvy/pGOyGvBUSPEO7Hud4tsxY6b7TllbufF2ia+W/OjAxM8J+6bGzPiPbxvRWiUCAcdMje+WIz/kZgf2XjH+Oi5opaZewmkZ7O86m6uqADfIUs47o3YIB570kkhHJeVCxvMOS9ERXAc7bM03Fz6SXM5zyfMHbtemgtlUkZu8YLz4oaHaptHOGCjNe244Lg4DLPE/xgseeWZJ6uCl3McBFVyHKG4MDV6kePWirvih/gkJjdrUUbsMFY9HVAphd3UKD6ay3XBjg0q7bjgkOkeBkx+jVULx3UWB80Vh1SEOpWWNogNQ44jp+YSE8cB6YCCOJZwI7hkTZ2gejEneqYicq5rSY6r8+w1t/PiW0ctHMfxY49lFzv+d8+aH1Go2lnvydQE8dmcp7O8HRxHPojzBB1fM3cc4A740FxVTEMuFqvPFY1QpYpynAByK7Zvvk2pdrfNhRTwHRu/0472Fzwh3ZBKKD5ZYvwUGQrierHL3HyYby6xGsQ1IdvSwsB5iirMLsoKh7ZUfDfNEmPvam7+hC336EJWwytWe1PhuCq12Wp0N21PIldzJUvvpoUqKCT+QoX+c/0CP6G3hHiLsAEAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAdCAYAAAB8I5agAAAA3klEQVR4Xu3SwYpBcRgF8E+oIWIhWcyGtZ28gFA2VlMWZqfMIyhZzhNMykIpCyv2Soqymv00eQAbnsI57rnX3GtjtnLqV7f7nfrX9/+bPVY6sJYZxP1jf9Iwl6/A7CZJ2Ek7MLtJAfZSDswsKnXoQgt+JPOnd8nd5Rys5B0qcIKFRNwiP0YwlBDEYAl98VKEI1SF4bE8viFePuAAr8KU4NecjZCXf5V7sIWEMLwEXkZeavpvTdjYtZwy5z1MzdkKvbllDrmegYzhE75hIlm3zITN2QDxYhg+pBd55iFyBoSlKkPyvbz+AAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHQAAAAbCAYAAACtOKuoAAAD3klEQVR4Xu2ZW6hMURiAf7lE7lES5bgUHlxySeRSUsitUIQ8UCSiKEJxKIW88CA5Sh6QKE9CpFMe5JInUi6RXIqkFA8U/u+stc7sWWdm9mX2nONoffXVnFl7Zu/517//9a99RAKBQCDQRqxXT1fwgDqi+ej2wUz1kvpKneONtQZ16nFpGUvnSXW52s0enythQvOnTtpwQvuoc60/1KPqQOsQdZ99f4e1g/lYzeiublO3+wMp6KGuVb+oo72xtHRWV4qJSxdvrBx8ZoB6Wf1gnSyFuM5QH6hPxMQ4d1Zbf0vpjF4jZlJxqjeWF/3UveoNdYpUnzh71IdqX38gISQW1euOukTtWDwcC+fl/NesXYuHm34vk3pR7WTNjRPWN+qg4qEmhqkfrQQqT8hYzn1VHSvVTyQQPILI96ahl5ikwlvqbEk/kQ4qAxVil7UUh9R36mBrLvRU71pLZRJEJ/ScN5aFoWpDRP6uBu4mXKRuFlPeCBRVJwncLUekkFR5JNZSKVS8UlUPmNDv6kRrLrhMctlUiunqL2varI8yUkyJ4TvcelIt49XH1oXqOPWp+tW+roSrDlwT15Yn0YpXqupRYq9IYZ2vdq1vxmVSufUTNqp/rEmz3oeMXyGmErg1KWs5c1CmnqlbrI79kmz9nCXmetZJvh2nq3qu4pWqev3FJJ67zrhrTYzLJCyVSW49ooRhtDwyIXRzaXBdY6OV17yXhXoxywBLAoK73jP27zj4DayVrJl01658V0N0/SwHNw83Ub33PtdPRayTDGU/rhMDavs3daeVk5CBvL4n2ddUd4cuUK+L6SjTBJKtSaO0vAu4a9Osnw5+F901ZRBpjFhbs8C5K1U8yi0J91yKty0TxCTVcPW8mD1rqmQPE1rgv5jQuNa6t3pbzAaZ1xiFz2Sd0CgumOxBCSTbhzgo9TwJolOMQhA/i2mISJa0S4LDb+DSUGkLCMvExJ3ri0I8iTeJzdww4XGNXRHRTIpmEwGmdadzPCvl75y8JtThzsv2YYM35uPWyui+mGzmeqk6rPXHxNzJ1cD3NKgHJdnmP1r1/IpHHHeLqSCs2z4cz5M7oDK+kITd7zz1rfpTTOf6ycp7+F69KeaZaKWFOe8JTcsk9b661XpB3SQmsylpiwuH1hwSh0pGHIkpsXXxRCbxpZhn43EViMQ8JaZzrxT/3GnrCQV+PFsAdNugaKa3N/g9PDOf7w+0BmkndIyY/zIkkWNrDQ2Jf95yTpPa3y0k5Cp1lP3bPSipOWT/YfWR+lrMv4rqogeUIUxoZej03QMcpOnL2tQFAoFAIBAIBAKBwL/CX46+8nEmvO16AAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAbCAYAAAAK5R1TAAACU0lEQVR4Xu2Wz4tOURjHH6GIGiLSqBmSEpIGZTG7UTYzC6UkpVjYSChksrCgxsKGQsJEkYWymo0pXhuxsrK0sLDwB7CRH9+Pc07O+9z7vvdezcjo/dRn8Z7n3Pc855znnHvNevzbLJbj0XUu1on18pRc6AOeFfKKvO08mvVZJM+4+IRclvVhoOtyLNqEffKknOcDOXMm0flylXwkv0ZH5dKsD3/AFr2W56NrLDybYLAbckG0CUzygdWc4Dn5JbrTxWBYXrKQtJ95n5yWu117E/bKZ9a+QKWwIj+irGgOibDda117YkS+kst9oAEr5RurMVkG+x497WIn5H7XlnNZ3vGNDkrlmDwb3dAe/rVLD604doEh+TnKwInNFpLg6imDenxioXQ6sUtOyU1yW/SFFa+wcXnftRVgxh+iqTNFfktuT51KoKZaViyXBCs1aSEJYGfwnRVLicm2LPxnx1qlRngYWxY6cgrZCn94cqoSTSv+TT6XB6NlO1Qr0TQgkixbfs/CPduNqkRho3xpIdl0YC/mHSL/V6JAbeJHeVfuaQ+XkhLlRHuocWrzSPabesWyQ0OilEnlS4PTjsz4plV0zmDQdFhyWMlP8kL8zf+lV/CB1CmD2+WabyyDVcH3crA91BWeSSuRwwpetXBzHJaP7fdiEMtZYuHNVOs12h/d6gMVbJFvrXgvJiiP1VZMLoc7lm8Jxp810pYe8oEGHLfyAzbjDFjYfr7EsAmD8qk1f+6P4VXJty122+YcapPv2B0+MNswMNZNlH70/+vMmUR79JhJfgK/VXkLDbxYawAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAbCAYAAAAkoDzBAAADVElEQVR4Xu2XS6hNURjHP6EIeUaKRAxESUKK3DyKPAolxYAkjyRRlMdAMZCBMlHIa4BQFFIyuB6FCAOPIgMlklIURXn8f9Za96yz7t737HPlXHXPv37d7lrnnL2+9T23WV11/Y36iF2il6eW4nnbRM90oxp1EBPFRXFPPBCPxWLR0ZOKB54VY9ONGmqC2Cs6pxtF1e4MJ1QBAy6IQdHecPFcbPFwObG2etpSnIlU25xutCQ8dt1zyLJvbbn45pkUrQ8Vt/3fttZocUcMTjeyhJEYi0ch9nSs8eKrZ1O0vlqcF52itbZSF3FJLEk3srRQ/BTrPXkaJ754QlhjLEbHF5ElUoUU4ZIGJntF1VcsEHNFN9GjfLtJVPcj6WIqbuiKeCeGefI0W/zyBMN7i/tiXvhQhhaJk2KImC6umkutalrPHPHQXNGdJt6KJ6KfJxaObBTdk/UyEdZvzOU2twh52mMlw+f7NbxHxScassTDG80dBu0U1/x6iweLRKd4L2b5/+kqZ6yUXmmK4YTXViGyQvieSDcS4Z27VqoDA/x6JcNDRHw3d1A8l9UOsxSMOm3uN/gthIefmkubLBUyfIz4bJUNx2M/xDJPUCXD0VTxyErRUqjwmLtceCUOROs8iwiYHK3FqhuebsQKoRjnC6FELq4y1+ooSi+s1N/jHs+PvxQzorUg0mO/mBn9f9OKDzo4JThmabROiHMZ1CccAnFtwvA4NXK1Rnw05xnYbm6Co5jgnRvimGUXvrR4xWowl9uMuojP0kHi4YeLpuJ/EKOidRQqNvkcfp9z3TLnqBFityeeJGmtPIeO1aLw4A7xycMUhsH7zHkzzOh8LmtWJwyp+Knw8Clz8/NKcVmstfJDYvhBc3MEhS9LGI2xG8xdEoY9E4fNzecQix5eNKr+KLSYBnPhQss6au5wGLvCsvsvkUEIp+tBvDL2t+YXFosZIc9whPcYYMKl5bVDIgTHtVRzKoovE4KEFcVpXfl2k0IIT0k3CgpjmOpGphutEE6gUKe9vSrx0sFwQyUO01aeCLfjomuyXkR8lzeqOAVaI853zprXilapSJgGkYsbzRlQjREUzay3wWrE95nRs4psTcSLQ1YB/NfieXkvLTVRuzW8rrrq+n/0G60npFvgrvzKAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAcCAYAAABh2p9gAAABFUlEQVR4XmNgGAWjYPAAZiDWhOIQLNgVijlhGvABViCeDsT/8eBbUKwG1YMXUN3AJCCOA2JGKC4HYmMgdoHKkQy4GSAG8UAxyLUiQFwExL5I6pCBBBBXA3EpAyRcsYatJRTPZIBYMIcBu4H8QDwJiMWAuJAB4hMQRgEgA6ZAcTpUbCEQB8FVIEAGEGdB2aDgAVmKYbEiEF+CYlD4gQDIQJAFIMtgAOS6HQwQNSDxpQw4DAQF/gkoBmkCgQYg3sMACWMY0AfiY0AcA8SpQHyNAZF+UQDVDQSlRZBGZM0wMWTgCcSLGCDetQHilQx4YpkYADJkBgPEwC4gtkWVJh0IA3E3AySmIxhQI4xsACpIQMExCkYsAADeVTj1QkYavwAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAcCAYAAACOGPReAAABGklEQVR4Xu3TMUvDQBgG4E9KwdJKQboVxC6Ck0IXhbrZDgUXcZSCXVxLhwouFjo7KVihi7P0H/QHdHb0z+j7eu/JQUIDaTIofeEZcrn7kny5M9tkk7+TAhzKVYy2lPyCpBThBb5W+JQDrUlMLkX70IMtuYMmnOteqpTNFasI37oGQ7gI5sVlD/YlNqfyau4hM0su2oW6RMIiz3KrsTe4/J0RDdfcwLZE0oAPYT8ZFuVDuDgMrzvwBHN4kN1wEsMfspSqxsawMNdzHxYcmPuCYziBlkyCeT/JpSj3KheHBfxYGJ64d3O7xP8kbj3irkmVI3N95rG+hh2YCo9xqvDt72EEj+ZadCZrh/1kHzON72em8Uc70+RS9J/kGzuROAzgoctcAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAbCAYAAACeA7ShAAABFUlEQVR4Xu3SMUsCcRgG8DcqKBwqWnJo0DlwkL6BQ4IQNLi4ODW5K67REA6CSEO4Rx/A2VXwKzSFILQIYkMO1fPwf+76d4re4NY98Bu89/W9+793Zv8uO3ALTysU1XMIjUitDeeqh9nqMObY3B/p01xjGg5U5w3L8CpV1XdVX0pFvqDgXeegEnQgJRvTkwlkdW0f6lCzNU8RzQmMpG/ueGfQhUuvL1ZyMJN7cwPeYAhHXl+sBLuiF7iDln5feX2xwl3xLdK1uaVfwBSeYe+3dX2CfXFXwb4YDuAgDuTgWNnqsDx8QFP8cF/cG3fIo2+M/6H6HysTPPUYMpHan9yYe/0L+IZ3eTR3xFMYqEZzeJAkSZKE+QG9wUROtS2trQAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAAAYCAYAAABk8drWAAABRElEQVR4Xu3WvStFcRzH8a885KnokrpJMhgsHiZRymCgazBYZGRQBrtiM4jJhM1dLBaDshkNJv8BVv+DfL5+n+Mct9T5dbrp5POuV517HpbvPef8jplSSimllFJ/2wjswhK1wSz3VTPnqRytwRGMQp0eYRv24R56vs/OVy/5n5FX/9eVJW8ATqGLv32A7gnG4RmuLdyxMU3QeoR5aPGLy1y7pXdfJ9zRWeZ4K7eT+siPqYY00CY2DC+0+eNIWgVuaKrhmLJwly3CoIXV/Z2SYfliscDtmDboLYI/FR1+cZlbgQ+owTG8kg/SF4g9mOO5k3AOBxS7UP2LZuABDi0M6ZZO4MLCo++D9ffrFqzCFWmgv+TDSr4BfQFyQ9yfzQd7CcukCjZm4SN/mrQoFczfpf6Rv0P+6aQKpIE2oW5L37NKqVL1CTb1OasbyLp0AAAAAElFTkSuQmCC>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEYAAAAYCAYAAABHqosDAAAC5UlEQVR4Xu2YTchMURjHH6F8hl75CAkrochHvWUp2fhIUlgoFiQpH7GjSFK+s7IRyspONnoXb9koGylRUi8psbBjocTzm/Mcc+6Ze+/cO3PvaDS/+jXTuTNzz/3fc55z7ogMGNAJc9Rn6kdzU/JwaZabO+IDfQDXTgYN5qsXmsdSWaROjBszOGhujA/UxFx1atyYw3h1mbj+TYuOJRgEk0FaMOPUIXFD6776Xtzn2jFDvWXyvg5mqhukeZ7P6trEJ7KZpz5RL6n7xJWQnWYLacFMUo+r+8Wd/IMUC2ZYPW3WBaPxiHrK/C7FguFm31Bv23tYqb42V1jbX9KCCTkjxYM5J+5kWDdbzaLBLFDHxI0Uz2xpBnMiaG9QVTDM9ZvqZNPD/N8rbloyv/mdQ4HtfjeLssGsV3+I+46HGjNq3gvaG1QVzBb1QNTGkD2r7lbfqA/Vy+pikxH2XDqrR2WD4bO/7dUTBjMiURGvIpgJ6nV1adTO8L0qLoQx9Y4kVzc62e63s6g6GEysUlUEs0S9Ii6gEELgLrA0fpHWC7iovlBnRe1FGASTQV8Es0fdFjcG8BtUflYBoAO+U4TTCWWD6XnxZc9zTdyqlAaj6JF6V5r7h2Hzq73S6dV2rChlg/HLNSuhhz6zeUWuM0G3wbBnOS/Ni47xJw87xJ4BmUYcp3AzHX2RfmyGy35MXjBr1G/iVkAE+sfmLt7gvTV5nyArGEbBJ/WXuLnJ3X1lrgo+xw4574mcThNMeGKmHb4Ut1Jtt/aF4pb1d2bazTgs7gn4p0nfCCH8Z8AHc9L0EDw345i4fj0Vt4vGlhubFUwR/LNR3j6ETd30uNHwtSaGvQ+mBdMtLAjr1M2S3++ugqE+VP1cNCSuICP165/RTTA8xLXMzS5gOB8Vt7z36m+LTAbBZEAwD9RdJstaEdiT8Bift3KUhWCoR7y2FMMewLWTQQOKI//7EhAWndd8b0rc2Odw7XUU/P+DP9NCqyyeW6WYAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAZCAYAAAAv3j5gAAABDUlEQVR4XmNgGAVUBuJAzI0uiAcwA7EyENsAMQ+aHF5AM4sEgNgMiCdB8XMgNkZRgRtIAPFWIG4H4mggPgzEQVCMAZKBOAuIS6D4KwNxFjEC8QQgngJlg4AOEF+FYm2oGAbwhWJiLZIG4gcMEJ/AgAgDwqIiJHEUQKpFpkD8jQGiBwZAcXQAihciiaMAUi0Cqf0PpWEA2aI9DDgSFbUtAmGsqXDUIrolBljyTkcSA5Uqd6G4HEkcBeCzyBCI3wFxJxSDACiTgjIreoa9AcUgNgrIAOJHQPwLikHhDjIUJOYCVQOzqBiKYUAeiE8DcR4DxHG7GCClDAjDLKcaYAViEyB2A2J+NLlRMAqGOwAAENpMK2m+p0EAAAAASUVORK5CYII=>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAWCAYAAAArdgcFAAABM0lEQVR4Xu2UPyuHURTHr6SYlEEpi1hMlH+LwSCRLBSDtyCDgfISTJIM3oAXYLCZDEoZlNGgsIhBMft+3HN/nXtzmSx6vvXpd8/3nOfc+3s69wmh0b9Um5gSB47xrKKudrEojow9MegLVsSZ6HEQ4/8kDrUtjkWXMSQuxCQF3eJSLNsDScT45GsaELdiovB3xQkLEo/26zUtnsRI4XtxgAfRX/jr4o7FkngXY1k6xvjka9oR96Kv8FPPpnmmVvMF8Ra+b/4qZgvfayvUm7+wGBbPIW7ilQrI18TGPFtOFP+IEf0a/FOxkaVjjE8ecYOB0Uuvqldci3mLERfrUOwng6t+I1aNtRAv0GgqCPGU8GE1Scz6lctvivNQzH6nmDHYrMMnfxG3eM7gNfK9yfSnzRu19AlyyEUGfv+lbwAAAABJRU5ErkJggg==>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAZCAYAAAAFbs/PAAAAu0lEQVR4Xu3QMQuBURTG8degJIUMUsqiZLJY7GSyyG4wKJMMrBaD1aqUj2CwW2VisButPoD8Tz1XlyQ2g6d+9XbOe+7tniD451eTRw8dpJ56L/PRQBhTWSKHKrb6NjZcs59DGGIjcSuSCNYYSx0taxRwRlf82G0rmSBtxSYuKImfGa5yP2yAEzLiZ4SdJF2xgiOy4lLEIXh8W9QaXw+4lbrHtbFAH2XsZY6GDbjExDZhh7jYek3Cq/3zNjeEJSS9PkyAgwAAAABJRU5ErkJggg==>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAaCAYAAABhJqYYAAAA80lEQVR4Xt3SPYrCUBQF4CfaCDOMoCBT+YMIVhZiI5aCIgy2gq1gM62IP9iIGxCx0g0oWLkBV6CFS7BzE56bnBcvgcCkmMYDX+HJNcl7eca8T7JwgCPt4EsP2GRgDHHVTWCgfpsIjaCgL7Bb6SJHchf5kyRGe+iycxJquEVt4y6wDg2SxX54k0ifmnCDB9yppuacRw3pU/VydyHb5+1OGmakU6ErfNsy1HAVOqRjF3iBlC178EM6S1qb13aaLfySTRnOJEfAiax+ARuawxROUCQvoYbzxv0Y9iAlIaEHdOxn/lPknJb8ZVDknaP+Miihhv8nTwZwKSAXkqKBAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAbCAYAAAAzgqwIAAAC3klEQVR4Xu2WS6hNURjHP6EISZR33gOPUESKGTLxiAFiZmBiQiFS7kSRPPJIHiUDeWQikYxuDDwHSBkZKDFQjAwoj/+vtdbd31l3n33OzTkG7v3Vr93Za+111rce31pmffQu+sl1zlaxVq7KX/aEwXKPPCanyIvyh/wtb0bHdNUu2CBPygFRz3x5IXoqOs2VD5K7XZ0k3w2UR+Sirto95L8JaEL0kdwmF8uncpmcKW9bCAqvWW2nJ8q78VkGHZ4hH1vRBsGzTIHnSHlQ3oh1ke9gunxgoX9NMUk+jzLS/H4lV7g6/OGz6Cc51ZV1RKug/mkLHcMPFlaAZ5dcmr0DAj4j9+YFZTCll+WlKEuOJ0uLMs+h6De5IL4bZSHIso541sjNclOUWdrhypmNs3K8e+dZLh/K4XlBDrPw2UIHkWVzXE52dRKMEPqACOS1HJ0q1YHv+IZ6+FY+saKDLKe0B8ug/KWclxd4mEpmh30zLFrF/ijLJa3nLbJTDo2/y6DshBzh3nXIX1akZGZgZ1dpd+gb/VydF3j4A/bNlbygBEbuljONJCPf6Hv2z2ErkgDMkV+tSDD19k+CQem0BvtorHxvjTsEZB1mBte7980ElPaPhyAIhqAWWvX+gR4F1GjJMbKsb5Yn+mTRTEBp/+RwJHyX1y1kwHr7B3pnQKRKDkQapXEsg7OJoNPh6+EPaCMdgjl05JyF9J7DEXHfQgpnD1WRAiIJVbLVQoPvonNd2RC5z0KHy647QNZJM1wG1xf2R/+8IMKZxIBWJQRIqZ5sWAnL54AVVxL8Ij9G2cz1OgNcizgf/M0B0u3jp4U238hZNTUCdPROfFbB+fPCqhNHDRxwuNLCqI+z2jRbD5bNPQsj3U62W9i/zfTpryGNX7XuV6VWwaBx9i3JC9oFgZCl/GW2lWyUR+0fzU6C5Uo2Y+9gq5gtz1sTl9J2wEyRGbFV0Fa7lnJD/ruA+uijN/EHqmCeTogwM9oAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAAAbCAYAAADve9g/AAAEP0lEQVR4Xu2YXYhVVRTHV2jgR2aS2jdNoUE4qBAaQb1V1IMVRZkoPijRSxj0kB9YDIWQll8lRl9ID5FYET3URPgwKIiWmEUyL/kQpEGRQdRDgtX/197Ls+/23HPm3u6MKOcPP+7cc/acs89/rb3WPtesUaOLWZeIhyIXsh4U9+UHO9XEyLNis7hJvCVOi3/EHnF1JNcjYpsYL66IvCQOii3JuLHQSvFmZI0Vz+XqE9uTMczT53yp2CgW+uBu1BjZAyOvF/sjTOR2cUjcJW4Vn1gw8/0IhrluEJ/GTzQuMlt8Ld6Nx8dKGHK/+F2cEfdEXJhFkuwVq8Q1VswZzRJfWPCkI90ovrKQVcD3b6z15leKL8VPkZuTcwORMmHiWBuJlojnxW9WHvwp4lUxLTnmot7vEKvzE1UiOrvE21YsAf5mGXMu1QbxZ+S2eGy6BYPv9EGZzoeRGMFyvcWCgZgJ/ckYVtkrFsaW6W6xT0zNT7QTWfeLBWNYmkBN60vGuIhQbiQGfiuu8kGZyoxkKT0X2SkW2blBu1w8Glkn5lkoM++Ipcm4MpFlW8VlFjrw35GBZMzDVn0dlvVRC/etFdEgG6mLpHqdeKAfI14/mMyQhUmXKTeSBxi0UKMAA58QH1sRfS8tyyJ8pwZ/IFaITVbUszIRZF+WXJOGB8NWBPyFOK6d8ANfCHKtiBy1Mc+YMlFfPkzwesOEq/4/NXKOOGHn7tMIwpAVGcPnMQtlAxAB+NXCkqwT9fGB5PtTEZrl41ZdH10+pxHVSZbYD1ZthIsOTCbyQODqxMgnrbUspGKMm0ct7tZIVhn1MW2Gnv3M/3ML96+qj6grI+uWNjdkj0gZYCmm9awTI73GtjOSuTAnTPjOil0E+1aa3+vW2nnLlNZHF/OHF8VfFvaOVfURNUbaeTBygoUizsXpiO3Ew2B22QaVG3ENrlWm1Ejq0x9iQXH6P3n9HbLwAGw9uC4vBkA941hVg3ERJBpJmfotbIPYqNd1YzeyzvCzoitShI+LuRHXZLHWglFlr4WIrtYuoz1QbiQdlLcJrulZgmZZuD8BQ7yV7LbQrYEshTTLysT1nhaP5SeiCBj7ShpsVaNBdPdhCwEckVim6y2Y6ZwSJyN0wKpMoPiz30qL+8zIAQuvaMDfHCMgn1l45QT2hUfEYiuMZS+LsemcHMoLAc5FM/rZwhh+G3hPTGoZEcSOgRJRJzL2sLguP1EnsuXeCFl2rVV3NRdvQhjDsu1EZBdgbhoorveRhQCmWcvnfPG9dX6vbsQOg6CNxIOeiWwgA/K3k27EkiJD8zqKeCju80x+oscimNTsO/IToy0MfM1af+ToVpi13ELdpQEC9ZF9LEtyUMw4O3p0RJl52cY4G12UBh6U5tALUQe91NA5Wc7U46p63Qvx9vWGdfBjxWiIzCxrBBeSmH8vStT/UmNko0aNGjVq0b/62fD01jxnqwAAAABJRU5ErkJggg==>