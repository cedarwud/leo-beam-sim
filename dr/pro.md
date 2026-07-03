# **低軌衛星資源分配互動式 3D 模擬器：教育與學術答辯雙軌設計之實踐與最佳化報告**

本報告針對低地球軌道（LEO）多波束衛星網路之強化學習（RL）資源分配模擬器，進行跨領域之深度文獻探討與架構分析。為同時滿足「非專業大眾之互動教育」與「專業學術答辯之實機展示」雙軌需求，本研究從可探索解釋、通訊視覺化、強化學習可解釋性、公平性數據呈現、教育遊戲機制、學術展示防禦策略、Three.js 底層渲染最佳化，以及特定領域（Starlink）視覺化等八大維度，萃取具體之設計模式、排雷指南與最佳實踐。

## **1\. 可探索解釋與互動教育模擬器之設計語言**

「可探索解釋」（Explorable Explanations）作為一種新興的數位媒介，其核心在於透過動態模型的互動，協助讀者建立對複雜系統運作機制的直覺。針對非專業大眾的衛星換手（Handover）教育，視覺化不僅是展示數據，更必須引導認知。

### **漸進式揭露與認知閘門機制**

根據具有高度公信力的互動設計研究（如 Nicky Case 的實踐與學術探討），教育型模擬器最忌諱在初始階段暴露過多參數1。系統應採用「認知閘門」（Cognitive Gates）與「漸進式揭露」（Progressive Disclosure）設計模式。

* **設計模式萃取：** 模擬器應遵循「觀察、建立模型、應用」（See, Model, Apply）的學習迴圈。例如，在 Nicky Case 的《Angry Physics》或《Earth A Primer》中，使用者必須先完成基礎任務（如手動操作單一變數），系統才會解鎖下一個複雜度層級2。  
* **具體應用：** 在衛星模擬器中，初期僅顯示單一「主角使用者」（Protagonist User）與單一衛星波束的連線。當使用者理解了「容量限制」後，再透過劇情推進引入大量人群，觸發「基礎演算法崩潰」的視覺震撼，最後才解鎖「基礎/智慧模式切換」開關與專家權重滑桿。

### **排名最佳之可探索解釋典範（Exemplars）**

以下根據其對於複雜系統視覺化、效能以及教學成效的指標進行評估與排名：

| 排名 | 典範名稱 / 創作者 | 核心價值與值得效仿之原因 | 公信力與相關性評估 |
| :---- | :---- | :---- | :---- |
| **1** | **Bartosz Ciechanowski 的互動文章** | 展現了極致的底層 WebGL 效能與無縫捲動互動（Scroll-driven）。其 3D 視覺化（如手錶齒輪、聲波）完全手寫，確保在低階設備上的流暢度，且與文字敘述完美嵌合。 | **極高。** 產業界公認的 3D 網頁技術與教育視覺化天花板1。 |
| **2** | **Nicky Case 的互動專案 (如 Parable of the Polygons)** | 確立了「做、展示、講述」（Do & Show & Tell）的互動節奏。證明了簡單的 2D/3D 圖形結合「生產性失敗」，能有效解釋資源分配與社會系統的不平等問題。 | **極高。** 其為「可探索解釋」一詞的主要推廣者，文獻廣泛引用2。 |
| **3** | **Distill.pub / Transformer Explainer** | 將極度複雜的深度學習神經網路黑盒子，轉化為可即時互動的架構圖。允許使用者輸入自訂資料並觀察每一層的權重變化，是學術答辯的絕佳參考。 | **高。** 來自頂尖機器學習社群與 ACM CHI 會議論文6。 |
| **4** | **PhET 互動模擬 (科羅拉多大學)** | 在教育介面設計上極為成熟，運用滑桿與即時反饋解釋熱力學或電磁場。其「錯誤友善」（Error-friendly）設計讓試錯成為學習的一部分。 | **高。** 經廣泛的教育心理學實證研究驗證7。 |

### **Do / Don't 執行指南：可探索解釋**

| 建議執行 (DO) | 避免執行 (DON'T) |
| :---- | :---- |
| **使用隱式學習評估：** 讓使用者在「你來當演算法」的遊戲中實際解決擁塞，而非閱讀說明書2。 | **避免「資料傾印」（Data Dump）：** 不要一開始就將所有 RL 目標函數與 3D 波束網格全部顯示於畫面上8。 |
| **確保操作的即時反饋：** 任何滑桿調整（如容量上限）必須在 100 毫秒內引發覆蓋場域（紅/綠）的視覺重組9。 | **避免過度依賴文字：** 當互動能夠更好地展示系統模型時，不要試圖用文字解釋所有衛星換手機制2。 |
| **支援時間控制：** 提供暫停或慢動作（Time-dilation）功能，讓使用者能看清「換手」發生的瞬間5。 | **避免「幽靈列車」體驗：** 不要設計只能單向播放的動畫，必須賦予使用者打破現狀的代理權（Agency）10。 |

## **2\. 通訊網路與衛星換手之視覺化技術**

在多波束低軌衛星（Multi-beam LEO）系統中，如何向非專家視覺化「頻譜重用」、「負載平衡」與「換手」，需要精確的視覺隱喻。

### **換手與負載平衡之視覺隱喻**

蜂巢式網路的模擬工具（如 RANFusion 或基於 DEVS 的模型）在處理高密度使用者時，常面臨視覺擴展性的挑戰11。

* **視覺化模式：** 換手（Handover）本質上是為了維持服務連續性而進行的連線轉移。視覺上，除了利用連線的動態斷開與重建外，通訊品質的波動（Ping-pong effect）可以透過射頻錐體（RF Cone）或連線的透明度、顏色漸層（如綠色漸變為黃色再斷裂為紅色）來呈現12。  
* **同頻干擾與頻譜重用：** 在多波束衛星系統中，相鄰波束間的同頻干擾是致命的。傳統上採用四色頻譜重用（Four-color reuse）或全頻重用結合波束跳躍（Beam-hopping）來解決14。在視覺化上，可以賦予不同頻率的波束不同的發光色（Emission Color），讓大眾直觀看出相鄰波束如何透過顏色交錯來避免干擾；而在智慧 RL 演算法啟動時，展示波束如何根據地面負載動態改變足跡大小與照射時間（Beam-hopping 模式）16。

### **Do / Don't 執行指南：通訊視覺化**

| 建議執行 (DO) | 避免執行 (DON'T) |
| :---- | :---- |
| **視覺化波束形變：** 當衛星非處於天頂（Nadir）時，將波束投射至地表的形狀渲染為橢圓形，以反映真實物理現象17。 | **避免靜態連線圖：** 不要僅用靜態直線連接衛星與使用者。應展現連線建立前的「探索/競標」延遲與動畫11。 |
| **突顯資源耗盡狀態：** 使用高對比的警示色（如紅色閃爍）來標示陷入「飢餓」的邊緣使用者叢集17。 | **避免隱藏干擾：** 不要讓重疊的波束顯得完美融合。應在重疊區域加入視覺干擾波紋，解釋為何需要複雜的分配演算法14。 |

## **3\. 強化學習決策與反事實（Counterfactuals）之視覺解構**

在學術答辯中，證明「演算法為什麼做出這個決策」比單純展示結果更具說服力。可解釋強化學習（Explainable RL, XRL）的目標在於打破黑盒子，建立信任。

### **呈現代理人的觀測與決策依據**

研究指出，現有的機器學習視覺化工具多針對靜態資料集，不適用於具備時序性與動態回饋的強化學習19。為了向答辯委員會證明演算法的合理性：

* **狀態級與特徵級解釋（State-level & Feature-level）：** 模擬器應具備一個「代理人視角」（Agent's Eye View）的切換功能。透過顯著圖（Saliency Maps）或注意力分佈（Attention Distributions），在 3D 場景中打亮（Spotlight）影響演算法當前決策的特定使用者群體或過載的衛星節點，將抽象的狀態空間（State Space）具象化22。

### **反事實視覺化（Counterfactual Visualization）**

因果推理研究表明，人類傾向透過「反事實」（如果沒有這樣做，會發生什麼事？）來理解複雜系統25。

* **COViz（Counterfactual Outcome Visualization）模式：** 根據最新研究，提供並排對比（Side-by-side comparison）的結果是最有效的解釋方式27。在現場答辯時，展示者可利用權重滑桿（例如提高「能源效率」的權重，降低「公平性」的權重）。系統隨即計算並以半透明的「幽靈軌跡」（Ghost trajectories）或次要顏色，疊加顯示「在該反事實條件下，哪些使用者將會斷線」27。這種即時且具備視覺衝擊力的「What-if」分析，能直接回應委員會對於多目標權衡（Multi-objective trade-offs）的質疑。

### **Do / Don't 執行指南：RL 視覺化**

| 建議執行 (DO) | 避免執行 (DON'T) |
| :---- | :---- |
| **實作反事實預覽：** 允許拖拉權重滑桿時，即時顯示決策改變將導致的後果（誰會被犧牲）27。 | **避免僅顯示純量圖表：** 不要只用 Loss 曲線或 Reward 曲線來解釋 RL 模型，必須將數值與 3D 空間中的具體狀態（Images/States）綁定21。 |
| **揭示隱藏約束：** 視覺化安全約束（Safety constraints）或硬性容量限制，說明代理人為何不選擇看似最佳的捷徑20。 | **避免掩蓋不確定性：** 當演算法面臨信心度低（Action confidence low）的決策時，應以視覺抖動或透明度反映其內部發散性29。 |

## **4\. 介入效應與公平性之聚合統計視覺化**

演算法的優越性不僅在於提升總吞吐量，更在於資源分配的公平性（Fairness）與負載平衡。如何將統計上的改善「直觀且具備衝擊力地」呈現，是設計的關鍵。

### **【矛盾警示】Jain's Fairness Index 與 Gini/Lorenz 的視覺化衝突**

文獻在網路資源分配的公平性指標上存在顯著的學術觀點衝突，系統設計必須謹慎處理此矛盾：

* **演算法最佳化的首選 (Jain's Index)：** 通訊領域極度偏好 Jain's Fairness Index，因為它連續、可微分，且範圍界於 ![][image1] 到 1 之間。當系統追求 Alpha-fairness 或效能與公平的折衷時，Jain's Index 能提供穩定的數學梯度30。  
* **視覺傳達的盲點：** 然而，經濟學與社會學研究強烈指出，Jain's Index 只是一個均值平方的比例，它**掩蓋了資源分佈的真實形狀**。一個具有中等 Jain's Index 的網路，可能是一半人獲得滿載資源、另一半人完全飢餓；也可能是所有人皆獲得中等偏下的資源30。這對於強調「拯救被餓死的使用者」的教育敘事是致命的。  
* **解決方案（Lorenz Curve）：** 要讓大眾與委員「看見」邊緣使用者的困境，必須使用吉尼係數（Gini）背後的羅倫茲曲線（Lorenz Curve）。羅倫茲曲線將最匱乏的人口排在 X 軸前端，與絕對公平對角線之間的下凹面積，能完美且殘酷地呈現出「資源崩塌」時的長尾飢餓現象34。

### **不平等摩天大樓與點陣分佈**

除了平面的羅倫茲曲線，更具備視覺衝擊力的是將聚合數據（Aggregate Statistical）映射回 3D 空間。

* **視覺化模式：** 參考《The Economy》的「不平等摩天大樓」（Inequality Skyscrapers）設計36。在天真基準模型（Naive Baseline）下，多數使用者（點）被擠壓在底層（紅色），極少數被幸運分配到的使用者堆疊成極高聳的塔（綠色）。當切換至「智慧演算法模式」時，高塔瞬間崩解，重新洗牌（Re-shuffles）為一個寬廣、平緩的綠色高原。這種「化抽象數字為實體物理變化」的手法，能帶來強烈的「頓悟」體驗36。

### **Do / Don't 執行指南：公平性數據視覺化**

| 建議執行 (DO) | 避免執行 (DON'T) |
| :---- | :---- |
| **動態覆疊 A/B 曲線：** 在介面上同時顯示 Baseline 與 Smart Mode 的羅倫茲曲線對比，展現兩者面積的縮小35。 | **避免單純依賴 Jain's Index 數字：** 對非專家而言，Jain's Index 從 0.4 提升到 0.8 是無感的空洞數字30。 |
| **使用點陣分佈表現個體命運：** 將長條圖打散為由單一個體代表的粒子，讓大眾看見「群體是由個人組成」36。 | **避免忽略絕對資源量：** 吉尼/羅倫茲曲線是相對指標，必須同時結合顯示「系統總吞吐量」的絕對指標，避免陷入「均貧」的陷阱34。 |

## **5\. 教育遊戲機制：生產性失敗與系統代理**

將演算法決策過程轉化為遊戲化體驗，必須有堅實的學習理論作為支撐。

### **生產性失敗（Productive Failure）之實證效應**

教育心理學家 Manu Kapur 提出的「生產性失敗」理論強調，在給予直接指導前，讓學習者先在複雜的、結構不良的問題中掙扎並經歷失敗，能大幅提升其後續的學習遷移能力40。

* **學習成效證據：** 在針對教育遊戲《Virulent》的實證研究中，Anderson 等人發現，玩家在獲得初步成功前經歷越多次的「關卡失敗」（Level failures），其最終的學習成效與問題解決能力顯著高於僅是耗費時間的玩家。失敗能促發協作性對話與對底層機制的深層反思40。  
* **設計實踐：** 在模擬器中加入「你來當演算法」（You be the algorithm）的拼圖解謎環節。在有限的波束容量下，讓使用者嘗試手動連線。他們必然會發現：滿足了左區，右區就會斷線（這正是多目標最佳化的痛點）。這種低風險環境下的失敗體驗，能完美墊高隨後展示 AI 智慧演算法時的驚豔感（Aha moment）40。

### **Do / Don't 執行指南：教育遊戲機制**

| 建議執行 (DO) | 避免執行 (DON'T) |
| :---- | :---- |
| **建構人類與 AI 的對比評分：** 讓玩家手動分配後的覆蓋率分數與 AI 模型進行直觀對比（Human-vs-AI scoring），突顯機器的運算優勢43。 | **避免懲罰性的失敗：** 遊戲中的失敗不應帶有負面的扣分或冗長的重置懲罰，應將其框架為「發現了此路不通」的建設性回饋40。 |
| **賦予具意義的選擇權：** 確保使用者的每次點擊或拖拉，都能立即引起系統動態的連漪效應（Ripple effects）43。 | **避免線性強迫教學：** 不要強迫使用者看完冗長的新手教學才能操作。讓他們在「搞砸」中學習2。 |

## **6\. 學術答辯與現場實機展示（Live Demos）之防禦策略**

對於學術答辯委員會而言，他們關注的是演算法的邊界條件、強健性，以及展示者是否真正在掌控系統。根據 ACM CHI、UIST 等頂級人機互動研討會的互動展示（Interactive Demos）規範與實踐，成功的 Live Demo 需要極高的去風險（De-risking）設計45。

### **去風險設計與容錯機制（Fallbacks）**

* **確定性（Determinism）腳本：** 學術展示不容許意外的崩潰。雖然 RL 代理人在訓練時具備隨機性，但在 Live Demo 中，必須使用鎖定隨機亂數種子（Fixed Random Seeds）的推論模式。確保在特定的權重設定下，必然會重現論文中提及的特定擁塞情境與完美的解決軌跡46。  
* **無縫降級與預錄備案：** 根據國際研討會的強制要求，所有現場展示必須備有不超過 5 分鐘的「實機演練影片」（Walkthrough Video）。當現場的 Software WebGL 因硬體過熱而掉幀，或網路連線中斷時，展示者必須能一鍵將畫面無縫切換至預錄的、完美渲染的影片，並繼續口頭解說，此為最高級別的防禦策略46。

### **掌握敘事主導權：應對懷疑論的互動操作**

答辯的核心在於應對質疑。傳統的投影片只能被動防禦，而帶有 Live Sliders 的 3D 模擬器則是主動出擊的武器。

* **即時反駁挑戰：** 當委員會質疑：「如果該區域的容量瞬間減半，你的競標演算法會不會陷入死鎖？」展示者可以直接在 UI 上觸發該極端條件（例如點擊某顆衛星使其失效）。系統隨即在幾毫秒內重洗分配（Re-shuffles），並在側邊欄即時更新 Jain's Index 與吞吐量圖表，證明系統具備自癒與負載平衡能力50。這種 Live 實證能立即消除委員的疑慮，展現出無可辯駁的學術自信。

### **Do / Don't 執行指南：現場學術展示**

| 建議執行 (DO) | 避免執行 (DON'T) |
| :---- | :---- |
| **設計漸進式的敘事結構：** 遵循論文架構：動機（展示傳統崩潰） ![][image2] 問題定義 ![][image2] 演算法介入 ![][image2] 即時壓力測試50。 | **避免現場依賴雲端即時運算：** 若推論過程涉及大量運算，應將預先計算好的軌跡（Pre-computed trajectories）包裝為即時互動的錯覺，避免現場計算超時。 |
| **整合專家標籤切換：** 讓 UI 具備「專家模式」切換鍵。面對非專家時隱藏複雜參數；面對委員質疑時，一鍵展開包含超參數、Loss 等深度的控制台51。 | **避免過度花俏的動畫干擾：** 對於嚴謹的學術答辯，避免無意義的轉場特效，確保視覺焦點集中於數據的變化與效能提升50。 |

## **7\. 針對低端設備與 Software WebGL 之 Three.js 渲染最佳化**

使用者的目標設備可能僅能依賴軟體渲染（Software-rendered WebGL）且 FPS 極低。在這種嚴苛條件下，利用 Three.js / React-Three-Fiber 渲染數以千計的使用者與交疊波束，必須採取極端的底層最佳化手段。

### **【矛盾警示】InstancedMesh 的效能陷阱與手動視錐體剔除**

* **業界迷思與矛盾：** 官方文件與多數教學指出，利用 InstancedMesh 將大量物件合併為一次 Draw Call 是最佳化聖杯。然而，實務研究指出，**在低端 GPU 或軟體渲染設備上，單純使用 InstancedMesh 反而會導致效能下降**。這是因為原生機制的視錐體剔除（Frustum Culling）是在 CPU 針對整個群組判斷的；一旦群組可見，所有數千個實例（即使在攝影機後方）的矩陣資料都會被強制送入 GPU 頂點著色器運算53。  
* **解決方案（手動陣列洗牌）：** 必須在 CPU 端實作逐實例的視錐體剔除。每幀更新攝影機矩陣（Matrix4），將所有實例的邊界球（Bounding Sphere）與視錐體進行交集測試。透過高效率的陣列操作，將「可見」的實例矩陣搬移至 Float32Array 的前端，並動態將 InstancedMesh.count 縮減至僅包含可見實例的數量。這能徹底解放低端設備的頂點運算瓶頸53。

### **深度預先通道（Depth Pre-pass）消滅過度繪製**

衛星的波束覆蓋場域（Coverage fields）若呈現為半透明重疊，將造成毀滅性的片段著色器過度繪製（Fragment Overdraw）54。

* **最佳化模式：** 導入「深度預先通道」（Z Pre-pass）。在主渲染週期前，先以極低運算成本的 MeshBasicMaterial（且不寫入顏色 colorWrite: false）將場景的所有幾何體渲染一遍，以建立精確的深度緩衝區（Depth Buffer）56。  
* **實作細節：** 關閉 WebGLRenderer 的自動清除深度（autoClearDepth \= false），並在主渲染通道執行前，將 WebGL 上下文的深度測試函數設定為嚴格相等（gl.depthFunc(gl.EQUAL)）。如此一來，硬體層級的 Early-Z 測試會直接拋棄所有被遮擋的像素，完全跳過複雜片段著色器的執行，效能提升可達 30% 以上56。

### **Do / Don't 執行指南：Three.js 效能與清晰度**

| 建議執行 (DO) | 避免執行 (DON'T) |
| :---- | :---- |
| **混合 2D Overlay 介面：** 對於場景中大量浮動的使用者狀態標籤，不要使用 3D Text Geometry，應使用 HTML 2D Overlay (如 r3f 的 Html 元件) 並進行批次更新54。 | **避免使用高成本燈光與陰影：** 在軟體 WebGL 中，絕對禁止使用即時動態陰影與多光源。應依靠預先烘焙（Baked）的光照貼圖與 MatCap 材質59。 |
| **針對 LOD 使用多個 InstancedMesh：** 由於 InstancedMesh 缺乏原生 LOD 支援，應根據相機距離，將實例資料在代表不同細節層級的多個 InstancedMesh 之間動態轉移53。 | **避免不必要的 Render Loop：** 對於不需要持續動畫的解說階段，實作 frameloop="demand"，僅在滑桿拖拉或視角變化時觸發重新渲染59。 |

## **8\. LEO 星系視覺化領域先例與能量隱喻**

在具體的領域知識（Domain-specific）層面，現有的衛星追蹤器（如 starlink.sx 或 satellitemap.space）提供了成熟的視覺語言61。

### **波束足跡與 H3 網格映射**

* **網格化地理空間：** 為了視覺化波束容量與使用者分佈，採用 Uber 開源的 H3 六邊形單元系統（H3 Hexagonal Cell System）是最佳實踐。這允許將連續的地球表面離散化，便於將強化學習的指派矩陣（Assignment Matrix）映射為六邊形網格的顏色（例如綠色為滿載，灰色為無服務）17。  
* **機械傾斜與橢圓波束形變：** 真實的低軌衛星波束並非完美的圓形。當使用者終端（UT）為了避開對地靜止軌道（GSO）保護區而產生機械傾角（Tilt）時，以及當衛星以斜角（Slant angle）投射波束時，其在地面上的足跡會呈現拉長的橢圓形，且波束擴散（Beam spread）會導致訊號強度衰減17。在 3D 模擬器中，動態展示這個「波束足跡變形」的過程，能極大程度地增加專業性與說服力。

### **能源效率的隱喻**

多目標 DQN 的目標之一是「能源效率」。在視覺上，這可以被具象化為衛星本體的「發光強度」或射頻錐體的「粒子流密度」17。

* **視覺化轉換：** 當演算法決定關閉某些冗餘的波束以節省能源時，展示該波束的射頻圓錐緩緩變暗並收縮消失，同時介面上對應的「系統總能耗」儀表板數值隨之下降。將抽象的 Energy Penalty 轉換為視覺上的「光與暗」，能讓非專家立即理解演算法在「覆蓋率」與「省電」之間拔河的過程28。

### **領域視覺化典範評估**

| 參考專案 | 核心實踐分析 | 借鑒價值 |
| :---- | :---- | :---- |
| **starlink.sx** | 將衛星視角與地面使用者的可用視野（FOV）做精確計算，並利用 Uber H3 網格顯示容量耗盡狀態17。 | 極高。完美示範了如何將複雜的波束指派邏輯轉換為 2D/3D 地圖上的直觀覆蓋場域。 |
| **satellitemap.space** | 使用 TWGL.js (輕量級 WebGL) 與 NASA Blue Marble 紋理，實現了 3 萬顆以上衛星在低端瀏覽器上的即時軌跡追蹤61。 | 高。其處理海量座標更新的高效能架構，值得在處理模擬器內海量使用者時借鑒。 |

**總結：** 本互動式 3D 模擬器的成功關鍵，在於「抽象機制的實體化」與「互動的階層化」。對非專業大眾，利用「生產性失敗」與「不平等摩天大樓」重塑其對網路擁塞與公平性的認知；對學術委員會，透過反事實滑桿、無懈可擊的 3D 渲染效能（手動視錐體剔除與深度預先通道），以及兼具確定性與即時反應的防禦腳本，將介面轉化為強而有力的論證武器。此雙軌策略不僅能有效傳遞 LEO 衛星資源分配的科學價值，更設立了學術展示的新標竿。

#### **引用的著作**

1. Explorable explanations \- Andy Matuschak's notes, [https://notes.andymatuschak.org/zRXEyTA5YxgqiBP3UE3C6si](https://notes.andymatuschak.org/zRXEyTA5YxgqiBP3UE3C6si)  
2. Explorable Explanations \- Nicky's Blog\!, [https://blog.ncase.me/explorable-explanations/](https://blog.ncase.me/explorable-explanations/)  
3. Explorable Explanations \- Diva-portal.org, [https://www.diva-portal.org/smash/get/diva2:1483287/FULLTEXT01.pdf](https://www.diva-portal.org/smash/get/diva2:1483287/FULLTEXT01.pdf)  
4. Mechanical Watch | Hacker News, [https://news.ycombinator.com/item?id=31261533](https://news.ycombinator.com/item?id=31261533)  
5. Exploring “Explorable Explanations” | by Max Goldstein \- Medium, [https://medium.com/@Max\_Goldstein/exploring-explorable-explanations-92f865c8d6ba](https://medium.com/@Max_Goldstein/exploring-explorable-explanations-92f865c8d6ba)  
6. Transformer Explainer: Learning LLM Transformers with Interactive Visual Explanation and Experimentation \- Minsuk Kahng, [https://minsuk.com/papers/transformer\_explainer-chi26.pdf](https://minsuk.com/papers/transformer_explainer-chi26.pdf)  
7. The Science Playground – a list of interesting links, [https://thescienceplayground.com/](https://thescienceplayground.com/)  
8. Services \- Bang Industries, [https://www.bangindustries.co/services](https://www.bangindustries.co/services)  
9. geist-learning-lab | Agent Skills Library \- Awesome MCP Servers, [https://mcpservers.org/agent-skills/vercel/geist-learning-lab](https://mcpservers.org/agent-skills/vercel/geist-learning-lab)  
10. Lesson 21 \- Interactive Data Science and Visualization, [https://mooc.interactivedatascience.courses/lesson21.html](https://mooc.interactivedatascience.courses/lesson21.html)  
11. RANFusion: A Comprehensive Tool for Simulating Handover In Next-G RAN, [https://par.nsf.gov/servlets/purl/10598173](https://par.nsf.gov/servlets/purl/10598173)  
12. modeling and simulation of user mobility and handover in lte and beyond mobile networks using devs formalism \- CD++, [https://cell-devs-02.sce.carleton.ca/publications/2017/KWG17a/2017%20Modeling%20and%20Simulation%20of%20User%20Mobility%20and%20Handover%20in%20LTE%20and%20Beyond%20Mobile%20Networks%20Using%20DEVS%20Formalism.pdf](https://cell-devs-02.sce.carleton.ca/publications/2017/KWG17a/2017%20Modeling%20and%20Simulation%20of%20User%20Mobility%20and%20Handover%20in%20LTE%20and%20Beyond%20Mobile%20Networks%20Using%20DEVS%20Formalism.pdf)  
13. Multi-Tier Cellular Handover with Multi-Access Edge Computing and Deep Learning \- MDPI, [https://www.mdpi.com/2673-4001/2/4/26](https://www.mdpi.com/2673-4001/2/4/26)  
14. Interference Suppression via Joint Interference Alignment and Power Allocation in Integrated Communication and Navigation Systems \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12656175/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12656175/)  
15. Interference Situational Aware Beam Pointing Optimization for Dense LEO Satellite Communication System \- MDPI, [https://www.mdpi.com/2079-9292/13/6/1096](https://www.mdpi.com/2079-9292/13/6/1096)  
16. Beam-Hopping Pattern Design for Grant-Free Random Access in LEO Satellite Communications \- arXiv, [https://arxiv.org/html/2508.03391](https://arxiv.org/html/2508.03391)  
17. Modeling Starlink capacity \- Mike Puchol, [https://mikepuchol.com/modeling-starlink-capacity-843b2387f501](https://mikepuchol.com/modeling-starlink-capacity-843b2387f501)  
18. Major starlink.sx update, tilt adjustable Dishy field-of-view footprint \- Reddit, [https://www.reddit.com/r/Starlink/comments/mt0r40/major\_starlinksx\_update\_tilt\_adjustable\_dishy/](https://www.reddit.com/r/Starlink/comments/mt0r40/major_starlinksx_update_tilt_adjustable_dishy/)  
19. \[2008.07331\] Interactive Visualization for Debugging RL \- arXiv, [https://arxiv.org/abs/2008.07331](https://arxiv.org/abs/2008.07331)  
20. xSRL: Safety-Aware Explainable Reinforcement Learning \- Safety as a Product of Explainability \- arXiv, [https://arxiv.org/html/2412.19311v1](https://arxiv.org/html/2412.19311v1)  
21. towards interpretable reinforcement learning interactive visualizations to increase insight, [https://publications.ri.cmu.edu/storage/publications/2020/12/Magister\_Scientiae\_Thesis.pdf](https://publications.ri.cmu.edu/storage/publications/2020/12/Magister_Scientiae_Thesis.pdf)  
22. A Survey of Explainable Reinforcement Learning : Targets, Methods and Needs \- arXiv, [https://arxiv.org/html/2507.12599v1](https://arxiv.org/html/2507.12599v1)  
23. A Survey on Explainable Deep Reinforcement Learning \- arXiv, [https://arxiv.org/html/2502.06869v1](https://arxiv.org/html/2502.06869v1)  
24. A Survey on Explainable Reinforcement Learning: Concepts, Algorithms, and Challenges, [https://arxiv.org/html/2211.06665v5](https://arxiv.org/html/2211.06665v5)  
25. Explainable Reinforcement Learning through a Causal Lens, [https://ojs.aaai.org/index.php/AAAI/article/view/5631/5487](https://ojs.aaai.org/index.php/AAAI/article/view/5631/5487)  
26. Explainable Reinforcement Learning (XRL) \- Emergent Mind, [https://www.emergentmind.com/topics/explainable-reinforcement-learning-xrl](https://www.emergentmind.com/topics/explainable-reinforcement-learning-xrl)  
27. Explaining Reinforcement Learning Agents Through Counterfactual Action Outcomes \- arXiv, [https://arxiv.org/html/2312.11118v1](https://arxiv.org/html/2312.11118v1)  
28. Explainable Reinforcement Learning Agents Using World Models \- arXiv, [https://arxiv.org/html/2505.08073v1](https://arxiv.org/html/2505.08073v1)  
29. RLInspect: An Interactive Visual Approach to Assess Reinforcement Learning Algorithm, [https://arxiv.org/html/2411.08392v1](https://arxiv.org/html/2411.08392v1)  
30. Multi-Jain Fairness Index of Per-Entity Allocation Features for Fair and Efficient Allocation of Network Resources \- Mario Köppen, [http://science.mkoeppen.com/science/uploads/Publications/incos13.pdf](http://science.mkoeppen.com/science/uploads/Publications/incos13.pdf)  
31. Optimal Tradeoff Between Efficiency and Jain's Fairness Index in Resource Allocation \- Systems and Computer Engineering, [http://www.sce.carleton.ca/faculty/yanikomeroglu/Pub/PIMRC2012-absrghy.pdf](http://www.sce.carleton.ca/faculty/yanikomeroglu/Pub/PIMRC2012-absrghy.pdf)  
32. An Axiomatic Theory of Fairness in Network Resource Allocation, [https://www2.seas.gwu.edu/\~tlan/papers/fairness\_infocom.pdf](https://www2.seas.gwu.edu/~tlan/papers/fairness_infocom.pdf)  
33. TCP Fairness Measures \- GeeksforGeeks, [https://www.geeksforgeeks.org/computer-networks/tcp-fairness-measures/](https://www.geeksforgeeks.org/computer-networks/tcp-fairness-measures/)  
34. Income inequality: Gini coefficient \- Our World in Data, [https://ourworldindata.org/grapher/economic-inequality-gini-index](https://ourworldindata.org/grapher/economic-inequality-gini-index)  
35. 5\. Measuring inequality: Lorenz curves and Gini coefficients – Working in Google Sheets, [https://books.core-econ.org/doing-economics/book/text/05-05.html](https://books.core-econ.org/doing-economics/book/text/05-05.html)  
36. Visualizing global income inequality \- CORE Econ, [https://www.core-econ.org/inequality-skyscrapers/](https://www.core-econ.org/inequality-skyscrapers/)  
37. A Clearer View on Fairness: Visual and Formal Representations for Comparative Analysis, [https://ecp.ep.liu.se/index.php/sais/article/download/1005/913/1027](https://ecp.ep.liu.se/index.php/sais/article/download/1005/913/1027)  
38. Visualising wealth inequality using Lorenz curves \- Random Tech Thoughts, [https://randomtechthoughts.blog/2021/03/25/visualising-wealth-inequality-using-lorenz-curves/](https://randomtechthoughts.blog/2021/03/25/visualising-wealth-inequality-using-lorenz-curves/)  
39. Visualization Atlases: Explaining and Exploring Complex Topics through Data, Visualization, and Narration \- arXiv, [https://arxiv.org/html/2408.07483v1](https://arxiv.org/html/2408.07483v1)  
40. Embracing Failure: Games as a Safe Space for Learning and Growth, [https://agatelevelup.com/embracing-failure-games-as-a-safe-space-for-learning-and-growth/](https://agatelevelup.com/embracing-failure-games-as-a-safe-space-for-learning-and-growth/)  
41. (PDF) Productive Failure \- ResearchGate, [https://www.researchgate.net/publication/381913649\_Productive\_Failure](https://www.researchgate.net/publication/381913649_Productive_Failure)  
42. Failing up: How failure in a game environment promotes learning through discourse, [https://experts.umn.edu/en/publications/failing-up-how-failure-in-a-game-environment-promotes-learning-th/](https://experts.umn.edu/en/publications/failing-up-how-failure-in-a-game-environment-promotes-learning-th/)  
43. 5 Reasons to Use Game-Based Learning in Your Classroom \- Edutopia, [https://www.edutopia.org/article/5-reasons-to-use-game-based-learning-in-your-classroom/](https://www.edutopia.org/article/5-reasons-to-use-game-based-learning-in-your-classroom/)  
44. GitHub \- codergeek42/wordle-solver: A clever algorithm and automated tool to solve the NYTimes daily Wordle puzzle game., [https://github.com/codergeek42/wordle-solver](https://github.com/codergeek42/wordle-solver)  
45. UIST 2026 \- Home \- ACM, [https://uist.acm.org/2026/](https://uist.acm.org/2026/)  
46. Interactivity \- ACM CHI 2025, [https://chi2025.acm.org/for-authors/interactivity/](https://chi2025.acm.org/for-authors/interactivity/)  
47. CHI 2026 Call for Interactive Demos, [https://chi2026.acm.org/2025/12/10/chi-2026-call-for-interactive-demos/](https://chi2026.acm.org/2025/12/10/chi-2026-call-for-interactive-demos/)  
48. Interactive Demos \- ACM CHI 2026, [https://chi2026.acm.org/authors/interactive-demos/](https://chi2026.acm.org/authors/interactive-demos/)  
49. Interactive Demos \- CHI 2027 \- ACM, [https://chi2027.acm.org/authors/interactive-demos/](https://chi2027.acm.org/authors/interactive-demos/)  
50. Computer Science Defense Presentation Best Practices \- Presenti AI, [https://presenti.ai/blog/computer-graduation-defense-ppt/](https://presenti.ai/blog/computer-graduation-defense-ppt/)  
51. Thesis/Project Final Defense Schedule \- School of Science, Technology, Engineering & Mathematics \- UW Bothell, [https://www.uwb.edu/stem/graduate/defense-schedule](https://www.uwb.edu/stem/graduate/defense-schedule)  
52. Visual Model Selection using Feature Importance Clusters in Fairness-Performance Similarity Optimized Space, [https://ceur-ws.org/Vol-4147/paper11.pdf](https://ceur-ws.org/Vol-4147/paper11.pdf)  
53. Three.js InstancedMesh Performance Optimizations \- VR Me Up, [https://vrmeup.com/devlog/devlog\_10\_threejs\_instancedmesh\_performance\_optimizations.html](https://vrmeup.com/devlog/devlog_10_threejs_instancedmesh_performance_optimizations.html)  
54. WebGL vs Three.js: Which Technology for Your 3D Website? \- MDX.SO, [https://mdx.so/blog/webgl-vs-three-js-which-technology-for-your-3d-website](https://mdx.so/blog/webgl-vs-three-js-which-technology-for-your-3d-website)  
55. Speeding Up Three.JS with Depth-Based Fragment Culling \- Casey Primozic's Homepage, [https://cprimozic.net/blog/depth-based-fragment-culling-webgl/](https://cprimozic.net/blog/depth-based-fragment-culling-webgl/)  
56. Implementing Depth Pre-Pass Optimization for Three.JS \- Casey Primozic's Homepage, [https://cprimozic.net/blog/threejs-depth-pre-pass-optimization/](https://cprimozic.net/blog/threejs-depth-pre-pass-optimization/)  
57. Does anyone know how the "depth pre-pass" option of babylonjs is implemented?, [https://discourse.threejs.org/t/does-anyone-know-how-the-depth-pre-pass-option-of-babylonjs-is-implemented/20623](https://discourse.threejs.org/t/does-anyone-know-how-the-depth-pre-pass-option-of-babylonjs-is-implemented/20623)  
58. Depth Priming Advantages? \- Unity Discussions, [https://discussions.unity.com/t/depth-priming-advantages/846457](https://discussions.unity.com/t/depth-priming-advantages/846457)  
59. 100 Three.js Tips That Actually Improve Performance (2026) \- Utsubo, [https://www.utsubo.com/blog/threejs-best-practices-100-tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips)  
60. Building Efficient Three.js Scenes: Optimize Performance While Maintaining Quality, [https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/)  
61. Live Map of Starlink & 30000+ Satellites, [https://satellitemap.space/people](https://satellitemap.space/people)  
62. Satellite Tracker — Live Map of Starlink & 30,000+ Satellites, [https://satellitemap.space/](https://satellitemap.space/)  
63. How Motion Influences Persuasive UX | by Eve Weinberg \- Medium, [https://evejweinberg.medium.com/my-masters-thesis-uxmovesme-com-a514d46681b7](https://evejweinberg.medium.com/my-masters-thesis-uxmovesme-com-a514d46681b7)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAbCAYAAADyBeakAAABkElEQVR4Xu2VzStEYRTGj1CEUEqyEGsLJUpZWthgJyxZkKXEjlKK8hFLGzsrf4Slmo2NrBQ2YmFnY8PzOOc277zmfs3cZsj86tedOe907zP3vB8iNbKjGa7CJn+gXLphi18MYRCu+8UsqEqIDjgKT81nOFzwi3A24JhfLIUl0b7yH9F3SRaiXTQ0r5kxZSYNMQGX/WK5pAlRB3dE50QA59GCyYD1sEc0KOXnWNKE4OQ9kvzSZKgtOGvewQu4D/vgNrwWbV1k+9KEmIPzzvdeeCj6QPoAz2CjjfO+j6JvI/KNJA3RAA9gv1Pjw9iOcfNFCu+xC3Ow0wwlaYgBuCfaAp9N8xZ2Wa0VXokGieVPhViEk35RtE2X5rnkQ3Ize7XriDlkYz+IC8HDip6Irg4f1u5Nd/9YE50PHD823fn0zQp8gh/mJ3yzGtd7AINR7g/F4FgQwt0/puGN6GqZMUuG50TUWcHNqc304bygZRGcE5mfFWng2udBR6sGt1322e11xeFuyCVXbG+oGL8iRI3/wRc/W0uP0gEF/QAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAWCAYAAADNX8xBAAAAaElEQVR4XmNgGAWjgCTACsVs6BKkAh0oLkGXIBXAXNQBxLJocmQBNSDuBmJ+dAlSAYZBIGc6A3EIGbgWiE8DsRMQU88gcoE+EPcBMTe6BLGAE4onMFAYa8ZQXI4uQSqgWsqmmkFDBAAAejkRvH9ikEQAAAAASUVORK5CYII=>