我是資深前端架構複核員 **REV1**。以下針對盤點報告第 1 節（真值擁有權地圖）進行獨立架構複核。

---

### 綜合檢驗表

| 檢查項 | 判定 | 理由 |
|---|---|---|
| **分叉 1：Decision（決策分叉）** | **成立** | **證據充分**。報告具體給出 `sinrLiveCellModel.ts:2410-2457` 與 `useSimulation.ts:518-528`，證實系統同時存在 immutable decision frame 與 cell-level manager / legacy event 兩套並行決策路徑。 |
| **分叉 2：Time（時間分叉）** | **證據不足** | **只是推測**。決策表聲稱「legacy derive 使用 wall clock」且「archived ref 是外部控制通道」，但全文**未提供任何 `file:line` 或時鐘漂移的代碼實證**。在缺乏 code trace 下，無法判定這是真實的渲染分叉還是撰寫者的印象雜談。 |
| **分叉 3：Palette Index（色盤分叉）** | **成立** | **證據充分**。明確指出 `src/homepage/controller/homepageSatelliteVisualIdentity.ts:185-197`（16-slot 壓成 compact family）與 `handoverVisualIdentity.ts:654-720`（candidate allocation）是不同演算法，不是單純別名。 |
| **分叉 4：Cell/Beam Key（鍵值分叉）** | **成立** | **證據充分**。`src/viz/SinrLiveCellBeamCones.tsx:162-169` 證實缺少 beamId 時由 cell 推導；`src/scene/multiCandidateBeamColors.ts:1-68` 證實資料結構同時維護兩套索引，未收斂唯一 key。 |
| **分叉 5：Handover Phase（相位分叉）** | **證據不足** | **只是推測**。報告在表格列出「selected 在 homepage 可被隱藏，committed/guard 又有 retained commit」，但內文引用的 `handoverAuthorityJoin.ts:29-38, 106-120` 僅規範「solid data link 最多一條」，完全**未出示相位狀態機在不同渲染層被分叉解讀的具體代碼證據**。 |
| **分叉 6：Render Override（渲染覆寫分叉）** | **成立** | **證據充分**。`beamRoleTokens.ts:52-66`、`servingColour.ts:39-67`、`useBeamViz.ts:435-489` 與 `handoverConeResolvers.ts:66-318` 證實下游多個組件能自行生成 tint 或依路徑重組顏色，覆寫上游意圖。 |
| **主張：「MainScene 不是唯一權威」** | **成立（屬「失控」）** | 判定為**失控**。下游 resolver 與 hook 擁有自主的業務重算與 fallback 邏輯，且無單向優先級階層契約，導致上游無法保證最終畫面輸出。 |
| **遺漏權威審查** | **成立（確有遺漏）** | 決策表完全漏掉了 **`App.tsx` 自身的互動與過濾狀態機**（62 個 useState、view flags、selection），以及 **快取/生命週期殘留（useRef / memo）**。 |
| **診斷範疇：是否過度診斷** | **成立（確有過度擴張）** | 報告將局部的「色彩語意衝突（Identity vs State）」硬擴張成需要重寫全鏈路的「8 階層全管線架構病」。 |

---

### 詳細覆核意見

#### 1. 這條鏈的分叉是真的嗎？
- **證據充分（3 處）**：
  - **Decision**、**Palette Index**、**Cell/Beam Key**：這三處均附有精確的檔案與行號錨點，且清楚指出兩套邏輯實作的差異（如 compact mapping vs contrast allocation、dual dictionary map），非空穴來風。
  - **Render Override**：行號與引用完整，下游有多個 resolver 自作主張。
- **只是推測 / 資訊不足（2 處）**：
  - **Time 分叉**：報告聲稱 legacy derive 使用 wall clock。這需要具體指出哪個檔案調用了 `performance.now()`、`Date.now()` 或獨立的 `requestAnimationFrame` 繞過 simulation tick。缺此證據，不能列為已查證分叉。
  - **Handover Phase 分叉**：報告僅用文字敘述「retained commit」與「homepage 隱藏」，但引用的代碼段落只能證明 link 數量限制，沒有任何證據展示 Phase enum 或狀態機如何在不同模組中產生認知歧義。

#### 2. 「MainScene 不是唯一權威」這個主張成立嗎？是「設計如此」還是「失控」？
**主張完全成立，且現況判定為「失控」。**

*判準如下：*
- **合法的架構覆寫（設計如此）**：應具備「單向資料流」與「顯式優先級定義」（如 CSS Cascade 或明確的 prop fallback）。底層渲染器（sink）應為純粹的展示元件，僅負責套用樣式，不具備業務判斷能力。
- **架構失控**：下游渲染器或中介層（如 `SinrLiveCellBeamCones`、`useBeamViz`、`handoverConeResolvers`）**自行引入領域計算、各自引入不同 token 字典，甚至擁有自己的 fallback 分支**。

從材料看，`handoverConeResolvers.ts` 竟分散在多個行段（`:66-124`、`:127-225`、`:258-318`）私自組合 semantic 與 identity，且 `useBeamViz` 還能跳過主流程直接發放 4-color tint。這意味著在 `MainScene` 傳入相同的屬性下，畫面結果會隨 mount 方式或 resolver 分支而改變。這是標準的**無人知道最後誰會贏（Unpredictable Precedence）的架構失控**。

#### 3. 有沒有被漏掉的權威？
**有，報告嚴重漏掉了兩個關鍵權威：**
1. **`App.tsx` 的互動與過濾狀態機（Interaction Authority）**：
   報告分析了 `App.tsx` 擁有 4215 行、62 個 `useState`、29 個 `useRef`，但決策表卻只把它當作「時間消費端」。在真實前端系統中，使用者的點擊、選取（Selection）、圖層開關（Layer Toggles）、過濾模式（Filter/Inspection Mode）直接決定哪些波束進入渲染。**`App.tsx` 才是最大的 gatekeeper**，決策表卻假裝資料是從仿真層一路平靜地流向 `MainScene`。
2. **快取與延遲狀態權威（Temporal/Stale Authority）**：
   `useRef: 29` 與決策表中提及的「retained commit」暗示系統存在大量逃脫 React 渲染週期的 mutable refs。當新 frame 到達時，舊 frame 的物件是否因 ref 或 memo 未被正確 invalidate 而殘留在場景中？這也是造成「改了沒反應」的隱形權威，報告完全未立案審查。

#### 4. 這個診斷會不會過度診斷？
**顯然過度診斷。**

報告把問題描繪成一條包含 8 個階層、多處分叉的「全管線系統性崩壞」，並要求「先收斂真值、再收斂 identity、再收斂 appearance、最後拆 shell」。這是架構師面對 4000 行大檔案時常見的「大一統重構衝動」。

但細看 owner 的原始痛點與材料中的核心矛盾：
> 「把 intra 換手的波束顏色改成某種變化時改三次都壞」

材料中揭露的核心真相其實非常聚焦：**「Identity（身分固有色）」與「Semantic Role（狀態/事件脈衝色）」在下游的混色職責未清**（`servingColour.ts` 在算亮度，`sinrLiveConeStyle` 在給狀態色，`handoverConeResolvers` 在和稀泥）。這是一個**局部色彩合成策略（Color Composition Policy）的缺失**。只要這個混色合約沒訂清楚，就算你把時鐘同步、把決策框架 immutable 化、把 key 全部收斂，owner 用 prompt 去改 intra 顏色依然會改壞。報告把一個局部的 Token 語意衝突，過度包裝成了整條模擬到渲染管線的架構性原罪。

---

## 我認為這份診斷最可能錯的一點

**它預設「必須先收斂上游的真值管線（Simulation & Handover Truth），才能解決 owner 的渲染修改痛點」。**

這在工程因果上是倒置的。Owner 遇到的失敗不是因為仿真演算法算錯，也不是因為不知道誰是 primary cell，而是因為**終端渲染層根本沒有定義清楚「波束外觀的合成公式」**。當 prompt 說「改 intra 顏色」時，到底是改 Base Color、改 Highlight Tint、改 Pulse Frequency 還是改 Ripple Alpha？報告把問題推給「決策有兩套、時鐘有兩套、key 有兩套」，但即使上游 100% 純淨單一，只要終端的 Resolver 依然隨意將 Identity 與 Role 攪在一起，owner 下 prompt 依然會猜錯語意並改壞畫面。

## 如果只能修一個地方，我會修哪裡

**強制收斂 `handoverConeResolvers.ts` 與著色入口，實施「兩層色彩混合管線（Two-Layer Appearance Contract）」，並徹底閹割下游所有的自主 fallback。**

1. **定義唯一不可覆寫的著色公式**：
   $$\text{FinalColor} = \text{Compose}(\text{BaseIdentityColor}, \text{HandoverStateModifier})$$
   - **Base Layer**：純粹由衛星/小區身分決定（由 `servingColour` 唯一提供，嚴禁包含事件狀態）。
   - **Modifier Layer**：純粹由換手事件狀態決定（由 `sinrLiveConeStyle` / `beamRoleTokens` 提供 pulse、alpha 或 target highlight）。
2. **拔除 `handoverConeResolvers.ts` 的分支與 `useBeamViz` 的自選色能力**：
   禁止下游元件依據「是不是 homepage mount」或「有沒有 beamId」私自改寫色彩計算，下游只能接收合成完畢的最終色彩結構。

修這一個地方，就能立刻終結「猜測這個詞落在哪一組語意」的困境，owner 未來用 prompt 下達「改 intra 換手波束顏色」時，目標就只有唯一的 `HandoverStateModifier`，改動立即見效且絕不污染基礎身分色，完全不需要冒險動到 4000 行的 `App.tsx` 或重寫底層仿真邏輯。
