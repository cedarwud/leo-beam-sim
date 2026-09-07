作為資深前端架構複核員（代號 **REV2**），我已審閱這份盤點報告第 3–5 節。這份報告診斷出「權威分散、多頭覆蓋」的病根非常精準，推翻了先前盲目拆分葉節點的徒勞；**然而，其提出的分階段遷移路徑在執行順序、責任歸屬與驗證手段上存在嚴重的「理想化偏誤」與「責任甩鍋」。**

以下是我的架構複核意見。

---

### 1. 階段順序對嗎？「拆大型 React shell 排最後」成立嗎？

#### 結論：原則成立，但報告對「拆檔」的定義自我矛盾且劃分過於僵化。

1. **為什麼「拆檔排最後」的大方向成立：**
   * Owner 已經拆了約 1,500 行純計算，痛點卻完全沒解決，這已經是血淋淋的實證：**把沒有決策權的葉節點抽成獨立檔案，只是「改善程式碼行數」，完全沒有收斂「權威（Authority）」**。
   * 如果在 P3（Identity）與 P4（Appearance）收斂前去拆解 `MainScene` 與 `App`，只會把原本在同一個閉包內的 36 個顏色函式與 4 個 memo，拆散到 10 個不同的 custom hook 或 child component 裡。這非但沒有解決覆蓋問題，反而創造出更難除錯的跨檔案 props drilling 與隱蔽 cycle。

2. **報告自我矛盾的致命盲點：**
   * 報告一邊主張「P6 最後才拆大型 React shell」，一邊卻在 P1 要求「移除 App ref/15秒 heuristic」、在 P4 要求「MainScene 不在 JSX 前組 color map」、在 P5 要求「App 移除 `visibleHandover` callback 與 continuity ref」。
   * **這些根本就是在對 `App` 與 `MainScene` 進行心臟手術！** 
   * 所謂的「拆檔」不能被窄化為「另開新檔叫 `SceneLayer.tsx`」。如果不在 P1–P5 階段逐步解開 `App` 與 `MainScene` 內部的反向控制通道（ref channel / callback cycle），新模組根本插不進去。如果硬插，就只能在 `MainScene` 裡塞更多 `if (useNewPolicy)` 分支，讓巨石檔案在 P6 之前膨脹到失控。

3. **順序上的嚴重錯置：**
   * 報告把 **P1（Transport: 時間軸/播放/Seek）** 排在最前面，是嚴重的**優先級倒置**。Owner 的核心痛點是「用 prompt 改渲染與顏色」，結果架構師叫他先去承擔改動播放核心（archived 15 秒 heuristic、dual-publish cursor）的高風險重構。這對解決改顏色問題毫無即時效益。

---

### 2. 每個階段真的能獨立驗證與回滾嗎？

| 階段 | 獨立驗證可行性 | 回滾可行性 | 審查意見（無法回頭的陷阱） |
|---|---|---|---|
| **P0 凍結合約** | **高**（靜態檢查、AST） | **完全可回滾**（刪除矩陣） | 純文檔與 fixture 工作。但報告要求 owner 在此階段拍板 6 大決策，若 owner 無法回答，P0 就無法閉環。 |
| **P1 Transport** | **中**（Parity logging） | **低至中**（雙軌競態） | **做到一半很難回頭**。舊 App 依賴 RAF 與 ref 寫回，若在新 adapter 建立 `CanonicalFrame` 並行發布，極易在 seek 或暫停時產生雙重狀態競態；若要回滾，舊的 15 秒 heuristic 與新事件流可能已經污染了 state。 |
| **P2 Handover Decision** | **中**（Trace invariant） | **低**（隱式依賴斷裂） | **高風險，無法平滑回滾**。報告要求將 `recentHandoverEvents` 降為 history，但現有 UI 動畫（如 ripple、shockwave）若依賴此事件，一旦降級畫面立即缺漏。若在未拆檔的 `MainScene` 內塞 feature flag 雙軌切換，只會讓狀態複雜度倍增。 |
| **P3 Visual Identity** | **低**（卡在 owner 決策） | **中** | **卡死風險高於回滾風險**。報告在此處不選 canonical key，若 owner 延遲決策，P3 就無法前進。若回滾到舊 identity map，舊的 36 個 color function 隨時會在 fallback 邏輯中反撲。 |
| **P4 Appearance & Plan** | **高**（純函式 Matrix test） | **低**（視覺撕裂） | 純函式本身最好測。但報告主張「RenderPlan 先接一個 layer 逐層切換回滾」，這在渲染上會產生**致命的視覺撕裂**（例如：波束套用新色，光圈與標記走舊色），這種中間狀態在產品上是不可接受的，根本算不上安全回滾。 |
| **P5 Scene/Rail 共享** | **極低**（無瀏覽器驗證） | **極低**（破壞既有通訊） | **報告已自招：「本輪不宣稱通過 browser/pixel review」**。在無法跑真實瀏覽器的前提下，宣稱能驗證 WebGL 與 DOM Rail 的跨 cadence 同步是自欺欺人。拔除 `visibleHandover` callback 會永久破壞舊通訊鏈，不可能「不恢復 callback 又能回滾」。 |
| **P6 拆檔與修 Gates** | **中**（`tsc` 與單元測試） | **中** | 舊專案有大量文字釘死測試（Text Pins，見 `APP-TSX-TEXT-PIN-TRIAGE.md`）。在 P6 一口氣刪除 legacy 函式與檔案時，測試會大面積噴紅，難以辨識是真正的邏輯迴歸還是單純字串消失。 |

---

### 3. 「做完這階段，改 X 只需要動 Y 一個檔案」這類承諾可信嗎？

#### 結論：不可信，這是典型的過度承諾。

* **檢視承諾 1（P4 做完）：「intra target 改色、source/target alpha 只需改 `HandoverAppearancePolicy` 一個模組，所有 scene sink 會拿同一個 output。」**
  * **不可信。** 
  * 理由一：在 WebGL / Three.js 系統中，最終顏色取決於「Policy Token」×「Material/Shader 著色邏輯（roughness, blending, opacity 疊加）」×「Scene Lighting」。即使 Policy 輸出了 `#ff0000`，若 leaf renderer 內部的 ShaderMaterial 或 MeshBasicMaterial 有自己的乘數，改 Policy 根本無法直接達成預期效果。
  * 理由二：報告在 P5 才能做到 Scene 與 Rail 共享同一個 Frame。若只做到 P4，Rail 依然使用舊的 projection，改了 `HandoverAppearancePolicy`，場景變了但側欄（Rail）沒變，Owner 依然會回報「改了但沒完全改對」。
* **檢視承諾 2（P2 做完）：「改 intra 何時進 selected/commit 只需改 `HandoverDecisionPolicy`。」**
  * **半可信但有暗坑。** 如果決策幀的觸發頻率（UI Cadence）與動畫幀率不匹配，抽掉 `recentHandoverEvents` 後，某些過渡動畫會直接被跳過（Drop frames）。

---

### 4. 有沒有階段順序錯了會白做的？

1. **P1（Transport）排在 P3/P4 前面，保證高機率白做：**
   * P1 耗費巨額精力去定義 `CanonicalFrame` 與 Transport Seam。但此時尚未定義 `RenderPlan`（P4）到底需要攜帶哪些視覺元資料（如 episodeId, appearance token, boundary phase）。
   * 等到 P4/P5 真正要接通渲染時，一定會發現 P1 的 `CanonicalFrame` 欄位不足，導致 P1 的 Adapter 與 Parity Logger 必須推翻重寫。
2. **P3（Identity）卡在 P4（Appearance）前面，造成不必要的排隊空轉：**
   * Handover Appearance 的本質是**語意狀態映射**（誰是 Source、誰是 Target、Selected 還是 Committed 的 Alpha 規則）。它根本不需要知道底層實體是 `cellId` 還是 `beamId`！
   * 把 P3 硬擋在 P4 前面，等於讓最容易純函式化、最能快速解決 Owner 痛點的 Appearance 邏輯，去等待一個懸而未決的 Identity 爭議。
3. **P6「修 Text Pins」排在最後，導致 P1–P5 步步維艱：**
   * 現有 repo 存在大量以 AST 或字串比對為基礎的 Text Pins（測試只檢查檔案裡有沒有某段字）。
   * 如果不把「測試解毒」拉到最前面，在 P1 到 P5 進行任何 seam 抽取時，舊的 Text Pins 都會瘋狂報錯。工程師將被迫花費大量時間去維護注定要在 P6 刪除的 legacy 字串，產生巨量虛耗。

---

### 5. 需要 owner 產品決定的那些，真的是產品決定嗎？

**報告在此處嚴重缺乏架構決斷力，將多項「技術架構問題」偽裝成「產品契約」，向 Owner 甩鍋。**

| 報告列出的「產品決定」 | REV2 複核判定 | 真相與技術正確答案 |
|---|---|---|
| **1. 時間軸真值歸誰（`/` vs archived TLE vs `?sceneSource=`）** | **純技術架構問題（甩鍋）** | URL Query Params（`?sceneSource=`）作為宣告式入口輸入，本就是 Web 標準。`App.tsx` 忽略它是技術債缺陷，不是產品哲學。架構師應直接制定：路由解析器統一派發 source config 給 Transport，無效時 fallback。不需要 owner 拍板。 |
| **2. MODQN 的進場合約** | **半技術、半產品** | 應從架構上透過 Dynamic Route 或 Dev Feature Flag 予以沙盒隔離，阻斷其對主線 pipeline 的污染，而非停工等 owner 決定要不要退休測試。 |
| **3. selected 與 committed 的畫面語意** | **真正的產品/教學決定** | **同意保留給 Owner**。何時在畫面上 promote target、何時繪製 cue，牽涉通訊教學的語意準確性，非純技術能定。 |
| **4. cellId vs beamId 的 canonical key** | **最嚴重的偽產品決策（逃避責任）** | **技術上根本不需要二選一！** 物理波束（Beam）與幾何覆蓋（Cell）在通訊系統中本就是多對一（Many-to-Beam-to-Cell）的階層關係。正確的技術架構是：**以 `beamId` 為物理唯一識別，攜帶 `cellId` 為拓撲屬性**。幾何渲染讀 beam，區域統計讀 cell。逼不懂底層資料結構的 owner 去選「誰是 canonical key」，是架構師失職。 |
| **5. intra 是否改 UE/marker steady identity** | **真正的產品/視覺決定** | **同意保留給 Owner**。波束切換時地面 UE 標記是否變色，純屬視覺表達偏好。 |
| **6. 外部是否能指定進場 state（localStorage）** | **純技術債修復（甩鍋）** | 依賴 `localStorage` 導致 state 靜默重置是低級 Bug。標準解法必然是「URL Query > Explicit Props > Default」。這不是產品決策，請直接修復。 |

---

### 階段複核與調整總表

| 階段 | 可行性判定 | 風險 | 如果我來排，順序會怎麼改 |
|---|---|---|---|
| **P0：合約與測試凍結** | 部分可行 | 若等待 6 大決策將無法收尾；Text Pins 持續干擾。 | **第 1 步（P0）**：保留 Matrix 梳理；**立即將脆弱的 Text Pins 標記為放行或轉換為 contract test**；剔除偽產品決策。 |
| **P1：單一 Transport** | 可行但 ROI 極低 | 雙軌 cursor 競態；太早固定 frame 結構導致後續返工。 | **後移至第 5 步（P5）**：只要當前播放尚可運作，暫不動核心 cursor，先專注解決渲染覆蓋問題。 |
| **P2：單一 Handover Decision** | 可行但回滾難 | 降級 `recentHandoverEvents` 導致動畫缺漏；雙軌分支膨脹。 | **第 2 步（P1）**：鎖定 `HandoverDecisionFrame` 的 serving/target 語意，限縮在純資料流，不碰時間軸。 |
| **P3：Visual Identity** | 不可行（被卡死） | 偽產品決策阻礙進度；palette scope 混亂。 | **與 Appearance 合併（第 3 步）**：架構直接採用 `beamId` 階層映射；不等待 owner 拍板，先做 deterministic palette allocator。 |
| **P4：Appearance & RenderPlan** | **高度可行** | 逐層切換導致視覺撕裂；缺少端到端渲染驗證。 | **提前至第 3 步（P2）**：**最核心痛點所在！** 直接將 36 個顏色函式收斂為純函式 `resolveHandoverAppearance` 與 `RenderPlan`。 |
| **P5：Scene/Rail 共享 Frame** | 部分可行 | 無真實瀏覽器驗證環境；拔除 callback 導致事件斷裂。 | **第 4 步（P3）**：在 Scene/Rail 消費端實裝 RenderPlan；建立離線 DOM/Three state 契約快照以代補缺少的 Chromium 環境。 |
| **P6：拆大型 React Shell** | 原則成立 | 最後一次拆除 legacy 可能遭遇大面積非預期報警。 | **第 6 步（P6）**：主體搬檔維持在最後，但伴隨 P1–P4 過程中「逐步封閉內部 control channel」，而非最後才一次性清算。 |

---

## 我認為最該先做的一件事

**停止對 `App.tsx` 播放時間軸的動工計畫，立刻對 [`handoverPresentationDisplayPolicy.ts`](file:///home/u24/papers/handoverPresentationDisplayPolicy.ts) 與 [`handoverAuthorityJoin.ts`](file:///home/u24/papers/handoverAuthorityJoin.ts) 建立「純函式視覺外觀矩陣測試（Appearance Matrix Test）」，並將 [`multiCandidateBeamColors.ts`](file:///home/u24/papers/multiCandidateBeamColors.ts) 的覆蓋邏輯收斂進單一純函式。**

* **具體行動：**
  不要等 Transport 重構，也不要等 owner 決定 cell/beam。直接以純資料結構為輸入（給定 serving、target、phase、role），將目前分散在 [`MainScene.tsx`](file:///home/u24/papers/MainScene.tsx) 與 [`servingColour.ts`](file:///home/u24/papers/servingColour.ts) 裡的 36 個顏色判定規則，收斂成一個不依賴 React、不讀取 ref、無副作用的 `resolveHandoverAppearance()`。
* **效益：**
  這一步不需要改動 Three.js 渲染樹，可以在單元測試中 100% 驗證。一旦完成，Owner 想改 intra target 顏色時，**就有了全專案第一個真正具備「修改一個檔案、保證全域生效」特性的穩定落地點**。

---

## 這個計畫最大的執行風險

**「在缺乏真實視覺驗證工具（Chromium/Pixel Diff）的情況下，深陷次要模組（Transport 與偽產品決策）的過度工程（Yak Shaving），最終在巨石元件中引爆更難以察覺的視覺撕裂與競態條件。」**

報告承認目前環境無法啟動真實瀏覽器驗證（無 Chromium）。在這樣的前提下，如果按照報告原案先去做複雜的 Transport Dual-Publishing（P1），又因為不敢做技術決策而把架構卡在 Identity 爭議（P3），工程師將在最危險的 `App.tsx` 狀態泥潭中消耗殆盡；而真正需要解救的渲染邏輯（P4），則會因為前置路徑過長而遙遙無期。一旦在純靜態測試通過下貿然推向前端，極可能因為 WebGL Material 與 DOM Rail 節奏脫鉤，引發比現在更嚴重的畫面閃爍與破面。
