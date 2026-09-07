我是資深測試治理審查員 **PIN**。針對 `src/scene/multiCandidateMainSceneIntegration.test.ts` 中因重構而紅燈的 5 條原始碼文字 regex 斷言，審查報告如下：

---

### 處置判定總表

| # | 斷言 | 判定 | 具體做法 | 為什麼不是 re-pin |
|---|---|---|---|---|
| 1 | `/buildMultiCandidateScenePresentation\(handoverCandidatePresentationPlan\)/` | **B** | 改在整合測試中傳入 mock 的 `handoverCandidatePresentationPlan`，斷言**場景輸出（或投影狀態）中確實產生了對應候選波束的視覺物件/幾何屬性**。 | 若只將 regex 改指向 `multiCandidateSceneDisplayPolicy.ts` 的呼叫字面，未來若管線重構成 hook、pipeline 或函式內聯，測試又會假紅；直接驗證「輸入 Plan 產出 Presentation」才能解耦實作。 |
| 2 | `/const MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED = true/` | **B** | 若該 overlay 為必要功能，改為在場景渲染後斷言**中央覆蓋層（Central Overlay）在 DOM/Canvas 節點中確實存在且為可見狀態**。 | 文字 regex 即使搜到 `= true`，若該常數未傳入元件或下游渲染邏輯被短路，測試依然「假綠」；反之若未來移除 flag 常態啟用則會「假紅」。必須斷言功能真實運作。 |
| 3 | `/if \(authorityHandoverPresentationCandidate !== null\) \{\s*return authorityHandoverPresentationCandidate;\s*\}/` | **B** | 改為**優先權行為測試**：構造同時包含 `authority` 與一般候選者的情境，斷言最終選定/渲染的候選者**必須等於權威候選者**；另測 `authority === null` 時正常回退。 | 原斷言綁死語法字面。若工程師改寫為 Nullish Coalescing (`return authority ?? fallback`) 或抽成 guard clause 函式，文字斷言立刻假紅，但業務優先權邏輯根本未變。 |
| 4 | `/presentedInterHandoverActive[\s\S]{0,180}presentedCinemaHandoverActive[\s\S]{0,180}kind === 'intra'/` | **B** | 建立**切換決策真值表（Truth Table）行為測試**：輸入不同旗標布林組合（如 inter+cinema+intra 同時為 true），斷言輸出的 `kind` 是否嚴格依序解析（如 inter 優先於 cinema，cinema 優先於 intra）。 | 跨 180 字元視窗是極脆弱的實作耦合。重構搬家、Prettier 換行、加入註解或改為查表法/狀態機都會破壞字元距離。只有黑箱驗證輸入旗標與輸出 `kind` 的映射關係才守得住規則。 |
| 5 | `/renderReceipt=\{multiCandidateSceneRenderReceipt\}/` | **V** | **刪除此斷言**。`renderReceipt` 是內部 prop 傳遞/回執標記，畫面上無對應圖元；若其目的是供下游快照比對，應由快照測試直接驗證產物，父層整合測試不應審查 JSX 屬性字面。 | 若把 regex 改去新元件或新檔案搜 JSX 屬性字面，依然只是在新的邊界上重製語法綁定（若傳入 `undefined` 照樣假綠），對保護真實渲染毫無價值。 |

---

### 重點審查分析

#### 關於第 2 條（Feature Flag 常數斷言）
* **它屬於哪一類？**
  它**絕不屬於結構約束（S）**，因為 feature flag 具有直接的執行期行為意圖。在治理上它屬於 **B（轉行為斷言）**；若該功能已經成熟、flag 只是永遠為 true 的過渡殘留，則應直接清理程式碼並將測試判定為 **V（刪除）**。
* **正確的守法是文字 pin 還是別的？**
  **絕對不能用文字 pin。**
  文字 pin 斷言 `const ... = true` 是典型的**假綠溫床**——只要檔案裡寫著這行字，哪怕渲染流程根本沒讀取它、或者 JSX 被註解掉，測試照樣通過。如果這個 flag 控制的功能真的重要，**唯一正確的守法是行為斷言（B）**：掛載場景並檢驗 Central Overlay 是否如期被繪製。

#### 關於第 4 條（180 字元跨距正則）
* **那是在守什麼？**
  它在守護切換機制（Handover）的**優先權次序階層（Priority Precedence / Mutual Exclusivity）**——即強制規定程式碼評估順序必須是 `inter`（跨星切換）優先於 `cinema`（劇院/展示模式切換），兩者皆否時才落入 `intra`（星內切換）。
* **搬家後還守得住嗎？**
  **完全守不住。**
  180 字元是前人為了偷懶不寫場景狀態機測試而拼湊的「字元距離束縛」。只要在新模組中稍作排版、拆分輔助函式、或改用查表策略，這條斷言就會假紅。這類邏輯必須透過傳入旗標組合、斷言輸出 `kind` 的行為真值表來取代。

---

## 我最不確定的一條

### 第 5 條：`/renderReceipt=\{multiCandidateSceneRenderReceipt\}/`

**不確定原因與缺少的關鍵資訊：**
* **在 V（刪除）與 B（轉行為斷言）之間的邊界模糊**：
  * 若 `renderReceipt` 純粹是 React 元件樹內部的 props plumbing（將資料從父層傳給 `MultiCandidateBeamScene`），且終端快照已由 `acceptedHandoverPresentationSnapshot.ts` 自身驗證，那麼這條斷言純屬無效語法綁定，**即使被移除，終端使用者在畫面上也完全看不出任何差別**，應直接判定為 **V（刪除）**。
  * 但若 `renderReceipt` 是系統對外暴露的**資料回放/審計憑證契約**（例如 NTN 模擬輸出規範要求每次渲染必須產出包含 candidate ID 的 Receipt 物件，供外部回放工具或測試架構收集），那麼它就具有不可被破壞的合約價值，應該轉為 **B（行為斷言）**——在測試中監聽或檢查渲染後產出的 snapshot/receipt 物件是否具備完整的多候選結構。
* **判定依據缺口**：因無法直接檢視 `acceptedHandoverPresentationSnapshot.ts` 是如何被消費的（純測試輔助快照，抑或具備外部產物合約義務），目前基於使用者可觀察性先暫列為 **V**，但這是最需要對照系統資料合約確認的一條。
