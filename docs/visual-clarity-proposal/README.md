# 視覺辨識性與故事性改善建議（Visual Clarity Proposal）

> 本資料夾僅作建議，**不涉及任何程式或現有文件的修改**。
> 內容針對 `project/leo-beam-sim`（Omni Scope）目前的 3D 波束視覺化、衛星標記、地面格網、以及左右懸浮面板。

> **可執行的 SDD 計畫請見 [`visual-clarity-sdd/`](./visual-clarity-sdd/) 資料夾**：
> - [`README.md`](./visual-clarity-sdd/README.md) — Status / Goals / Cross-References / Phase Ordering / Risk Register / Definition of Done / Open Questions / Slice Summary
> - [`contracts.md`](./visual-clarity-sdd/contracts.md) — Validation Tiers / Mode &amp; Density Plumbing / Three-Tier Contract / Accessibility &amp; Motion / Performance Budget / Cross-cutting Conventions
> - [`phase-1-identity-first.md`](./visual-clarity-sdd/phase-1-identity-first.md) / [`phase-2-non-text-channels.md`](./visual-clarity-sdd/phase-2-non-text-channels.md) / [`phase-3-ground-cinematic.md`](./visual-clarity-sdd/phase-3-ground-cinematic.md) / [`phase-4-panel-restructure.md`](./visual-clarity-sdd/phase-4-panel-restructure.md)
>
> 本 README 與其餘三份文件是分析底稿（problem analysis、encoding catalog、panel decluttering、ASCII mockups），SDD 是把它們收斂成 4 個 phase / 18 個 slice 的執行計畫。SDD 已通過一輪獨立審查並重寫，r3 把單一 1972 行檔案拆成 6 個檔案（每檔 ≤ 454 行）。

---

## 0. 三句話摘要

1. 目前畫面把「**頻率重用 (F#)**」與「**衛星身分**」全部塞到「波束顏色 + 文字編號」這一個通道上，所以兩顆衛星打下來的 `F2 B5` 在視覺上完全相同。
2. 解法不是再多疊一層顏色，而是**把「衛星身分」拆到一個與顏色正交的通道（外框 / 形狀 / 線型 / 標籤前綴）**，把「頻率」留給填色，把「角色（serving/pending/approach/source）」放在最高層覆蓋一切。
3. 同時必須**減少同時繪製的波束數**——目前最多 3 顆衛星 × 各 6 個波束 ≈ 18 條圓錐疊在一起，再怎麼配色都救不回來。先「減量」，再「分層」。

---

## 1. 為什麼現在難辨識？問題拆解

### 1.1 現況視覺通道使用情形

從程式碼盤點（`src/viz/SatelliteBeams.tsx`、`src/constants/beamRoleTokens.ts`、`src/scene/useBeamViz.ts`），波束目前同時動用了 8 個視覺通道：

| 通道 | 編碼了什麼 | 衝突狀況 |
|---|---|---|
| 圓錐 / 地面 disc 的填色 | 角色 ⊕ 頻率重用 | **A. 同色衝突** — 同一個 F2 出現在不同衛星上時完全分不開 |
| 圓錐 / disc 不透明度 | 是否在當下 slot 啟用 | OK，但與「角色強度」共用 |
| 連線粗細 | 角色強弱 | OK |
| 連線實 / 虛線 | 是否在啟用 slot ⊕ 是否屬於 approach/source/inactive | **B. 雙重含意** — 同樣是虛線可能是「非 active slot」也可能是「approach role」 |
| 端點實心 / 空心圓環 | 角色 + 是否在啟用 slot | OK |
| Callout 邊框顏色 | 跟著主色（= 角色色或頻率色） | 隨 A 一起壞掉 |
| Callout 文字 | 角色名稱 ＋ `F# B#` ＋ SINR | **C. 沒有衛星身分** — 文字裡只到「F2 B5」，不寫是哪顆衛星 |
| 衛星本體 GLB 模型 | 不分衛星，全部同一個模型同一個尺寸 | **D. 衛星本身沒有識別性**，只能靠頭頂的小字 `R053-01-04` |

> A、B、C、D 是當下「光看畫面分不出來」的四個根因。

### 1.2 故事斷層

要讓觀眾「不需要說明就能理解」，畫面必須能在 1–2 秒內回答這四個問題：

1. **誰在服務我？**（the serving beam — UE 現在連的是哪一個波束）
2. **接下來會交給誰？**（the pending / approach beam — 候選波束）
3. **這個波束是哪顆衛星打下來的？**（satellite attribution — 把空中的圓錐連回某個衛星身上）
4. **它的頻率是哪一組？**（frequency reuse class — 顏色語意）

目前 1、2 已經做得不錯（Serving 青藍、Pending 金黃、Approach 紫色都很顯眼），但 **3 完全失靈，4 在「非角色」波束上會吃掉 3**。所以螢幕上看起來像「三顆衛星在打彩虹」，不是「三顆衛星各自在做自己的事」。

---

## 2. 設計原則：三層視覺契約（Three-Tier Visual Contract）

把「同時想表達好幾件事」拆成三個正交層級，**每一層只用一組通道，不跨層搶資源**：

```
Tier 1  EVENT ROLE     ← 顏色（語意色：青/金/紫/灰）＋ 線粗 ＋ 光暈
        (覆蓋一切)        Serving > Pending > Approach > Recent-Source > Other > Inactive

Tier 2  SATELLITE ID   ← 與顏色「正交」的通道：外框色 / 形狀 glyph / 標籤前綴 / 線型紋路
        (在 Tier 1 之下，          ※ 重點：不能再用 fill color，否則一定會跟 Tier 1 / Tier 3 打架
         以非顏色或弱顏色表現)

Tier 3  FREQUENCY      ← 填色（已存在的 6 色配置），但**只有在 Tier 1 沒有覆蓋時才出來搶眼**
        (背景訊息層)       對 SERVING/PENDING/APPROACH 來說，頻率退到角落小色塊就好
```

> 規則：**愈關鍵的訊息，用愈強的通道**；**愈穩定的訊息（例如衛星身分），用愈持久但安靜的通道（例如形狀）**。

### 2.1 每一層應使用的通道（建議分配）

| 層 | 編碼資訊 | 推薦通道 | 不應使用 |
|---|---|---|---|
| Tier 1 角色 | serving / pending / approach / source | 主色 + 線粗 + 光暈 + 動畫脈動 | 形狀（要留給 Tier 2） |
| Tier 2 衛星身分 | sat A / sat B / sat C ... | **disc 外框色 + 端點 glyph 形狀 + callout 內衛星 chip + 圓錐的 satellite-tinted spine line** | 填色（會跟 Tier 3 打架） |
| Tier 3 頻率 | F1 / F2 / ... / F6 | disc 內部填色 + callout 內 `F#` 標籤 + 一個小色塊 | 端點形狀、外框 |

### 2.2 為什麼這樣分？

- **Tier 1 必須贏**，因為「serving / pending」是觀眾第一秒要抓的訊息。
- **Tier 2 用形狀+外框**，因為形狀是「穿越所有顏色」的識別通道；外框與填色是兩個獨立的色塊，不會互相搶。
- **Tier 3 用填色**，因為頻率變化是「持續存在但不需要警醒」的背景訊息。

---

## 3. 推薦的辨識通道（除了你已提到的）

你已經在問題裡列出：顏色強弱、外框/填色、文字編號。下面是其他**仍然「視覺直覺」**的通道，可以分開或組合使用：

### 3.1 端點 glyph（地面那個小圖示形狀）
- 給每顆當前可見衛星一個專屬幾何形狀：**▲ ■ ● ★ ◆ ✚**
- 這個 glyph 蓋在地面 disc 中央（或正上方一點）
- **優點**：跟顏色完全正交，灰階列印也分得開；認知成本低（人類辨識基本形狀比配色快）
- **缺點**：當衛星超過 6 顆（顯示上限是 12 顆，但 `MAX_BEAM_SATS = 3`）時形狀會用完
- **與現況契合度**：高，現有程式已經在 disc 中央畫 `sphereGeometry`，把它換成 glyph mesh 即可

### 3.2 圓錐側壁的「衛星脊線」（spine）
- 從衛星本體拉到地面端點的那條主線，**用衛星色（不是頻率色）**
- 圓錐的半透明側壁（lateral cone surface）保留頻率色
- 這樣一條清楚的 spine line 把空中圓錐「接回」它的衛星
- **優點**：解決了「圓錐脫離衛星」的問題；觀眾的眼睛會自然沿著 spine 找到 apex
- **缺點**：需要把現在「整支圓錐都同一個顏色」改成「外殼一色 + 內骨一色」

### 3.3 disc 外框 vs 填色（你已提到，但可以更激進）
- **外框**：衛星身分色（4-6 色高對比 accent palette）
- **填色**：頻率色（已存在）
- **內邊一道細線**：角色色（青/金/紫）只在 event-role 波束顯示
- 這樣同一個 disc 同時表達三層訊息，但每層各自有獨立色塊不互相蓋

### 3.4 衛星本體 tinting（給衛星模型上色）
- 目前所有衛星都是同一個 GLB 模型同一個樣子。把每顆衛星的 mesh 用 `MeshStandardMaterial.color` 染上「衛星色」（同 3.3 的外框色）
- 衛星上方的文字標籤本來就有 role accent，但如果加上「衛星色衝光（emissive 或 pointLight）」會更顯眼
- **優點**：apex 就有強烈衛星身分，視線從衛星 → spine → disc 是一條同色脈絡

### 3.5 標籤前綴 chip（方框內加上衛星 ID）
- callout 文字目前是 `SERVING F2 B5  18.3 dB`
- 改成 `[R053·01·04]  SERVING F2 B5  18.3 dB` 或者把衛星 ID 放在 callout 上方一行成為小色塊 chip
- **優點**：純文字，零歧義
- **缺點**：callout 變大，需要重新排版避免遮擋

### 3.6 線型紋路（dash pattern by satellite）
- 例如 sat A = 連續實線；sat B = `−−−−−`；sat C = `· · · ·`；sat D = `−·−·−`
- **慎用**：目前 dash 已經被「approach / inactive」使用。如果要加進來，必須把 dash 的「角色語意」改成只有「inactive 才虛線」，把 approach 改用其他方式（例如 fade-in 動畫）。否則就是製造新的雙重含意。

### 3.7 spine particle drift（粒子流動畫）
- 沿著 spine 從衛星 → 地面，有一條慢慢往下走的小光點，**粒子色 = 衛星色**，**速度 = 是否在 active slot**（active 較快、inactive 較慢或停住）
- **優點**：動態是人類最強的 pre-attentive 通道；觀眾立刻看出「資料正在從 A 衛星流到地面這一點」
- **缺點**：實作成本最高；需要 GPU 友善的實作（instanced points 或 shader）；過度使用會讓畫面變躁

### 3.8 Halo / 集合圈（spatial grouping）
- 在地面投影上，把同一顆衛星打下來的所有 disc 用一條淡淡的「集合圈」（凸包外框 hull outline）框起來
- **優點**：一眼看出「這四個 disc 都是 sat-A 打的」
- **缺點**：圈會跟其他 hull 重疊；只在波束分散時有效

### 3.9 重新利用地面 hex 格網（`EarthFixedCells`）
- 現在 4×5 hex grid 只表達「served / not served」（藍 vs 灰），資訊量極低
- 改成「**Paint-by-numbers**」：每一格只要被某個波束覆蓋，就把這一格的**外框畫成衛星色**、**填色畫成頻率色**
- 如果同一格被多個波束同時覆蓋（重疊區）→ 外框可以用衛星色「分段」（半圓 sat A、半圓 sat B），或者只取最強 SINR 那一個
- **優點**：地面變成一張即時更新的「歸屬地圖」，故事性極強
- **缺點**：需要計算每格屬於哪個波束（已有 disc 圓心 + 半徑，幾何很簡單）

### 3.10 衛星「軌道流光」（trail）
- 沿著衛星短期軌跡畫一條淡淡的拖尾，**拖尾色 = 衛星色**
- **優點**：解決「滿天都是同樣 sat 模型」的問題；軌道方向自然成為衛星身分的延伸
- **缺點**：需要保存近 N 秒的位置歷史

### 3.11 連結線分流（HandoverLinks 加上「衛星色 ribbon」）
- UE → 衛星的 handover link 線目前用「角色色」
- 改成：**外側包覆一條衛星色細線**（兩條平行線：內線角色色，外線衛星色）
- **優點**：handover link 同時告訴你「這是 serving」+「服務的是哪顆衛星」

---

## 4. 推薦組合（依工程量分三段）

### 階段一：最小可行（最大投資報酬率）

**目標**：先把「太雜」這一條解決，再來談精細編碼。

1. **減量**：非 event-role（即不是 serving/pending/approach/source）的「other active」波束，**預設不畫圓錐**，只在地面留一個「淡淡的環」（halo ring，不填色），同時 callout 縮成最小尺寸或完全不顯示。
2. **以衛星 ID chip 進入 callout**：所有 event-role 波束的 callout 第一行加上 `[R053·01·04]` 形式的衛星色 chip。立刻就能用文字辨識。
3. **衛星模型 tinting**：把現有的 sat.glb 用 `MeshStandardMaterial` clone 後染上「衛星色」（最多 4 色：serving 衛星 / pending 衛星 / approach 衛星 / 其他）。

> 即使只做這三件事，畫面雜訊就會降低 60-70%，故事性立刻浮現。

### 階段二：穩固版（建議的主推方案）

在階段一之上：

4. **disc 外框 = 衛星色，filling = 頻率色**：明確分離兩個訊息；對 event-role 波束再額外加一道「角色色」內描邊。
5. **端點 glyph 形狀**：每顆衛星一個專屬形狀（▲ ◆ ● ★），蓋在 disc 中央。
6. **spine line = 衛星色**：圓錐側壁保留頻率色，但「衛星 → 地面」這條中軸線改成衛星色，明確把空中錐體拉回衛星。
7. **線型 dash 規則重整**：目前 dash 同時表達「inactive」和「approach」，建議簡化成「**只有 inactive 才虛線**」，approach 改用「半透明慢速脈動」或低飽和度區隔。

### 階段三：故事化版（presentation 模式專用）

在階段二之上：

8. **地面 hex 格網改造**：每格自動讀取「哪個波束、哪顆衛星」，用衛星色外框 + 頻率色填色，地面變成歸屬地圖。
9. **spine 粒子流**：沿 spine 慢速光點，衛星色，active 時較快。
10. **衛星軌道流光**：每顆衛星拖一條短尾巴，衛星色。

---

## 5. 故事性檢核（Read-the-screen test）

在不依賴任何文字說明的前提下，觀眾應該能依下列順序在 5 秒內讀出畫面：

1. **誰在服務？** → 最亮的青藍色光柱，跟它連在一起的衛星本體也是青藍色，UE 上方有一條粗的青藍 link。
2. **下一個是誰？** → 第二亮的金黃色光柱，連到的衛星模型也鍍金，link 是金黃虛線並有 trigger progress 文字。
3. **這個波束是哪顆衛星？** → 沿著 spine 往上看，spine 顏色 = 衛星身體 = disc 外框 = callout chip = 同一個衛星色家族。
4. **頻率重用是哪一組？** → disc 內部填色 + callout 文字裡的 `F#`。
5. **其他衛星在做什麼？** → 角落幾顆「approach 紫色 / source 灰青」的衛星，安靜地存在，不搶戲。

如果哪一步斷掉，就回去看是哪個 Tier 的通道沒做好。

---

## 6. 同場加映：左右側邊欄與懸浮面板

詳見 [`side-panel-decluttering.md`](./side-panel-decluttering.md)。

簡述：
- **InfoPanel（右側）**：把 SERVING + PENDING 合併成一張「對戰卡」，SINR Delta 直接內嵌；BEAM HOPPING 縮成一顆狀態 pill；Profile metadata 折疊。
- **SignalTuningPanel（左側）**：520px 太寬，改成預設摺疊抽屜（drawer），只有進入 Tuning 模式才展開；展開時把 3D Canvas 自動 letterbox 而不是被遮住。
- **ControlBar（頂部）**：保持精簡，但加上一個「視覺密度」滑桿（few / normal / many beams）讓觀眾可以即時調整資訊量。

---

## 7. 附錄

- [`encoding-channels-catalog.md`](./encoding-channels-catalog.md)：可用視覺通道完整目錄表（含每一通道的優缺與衝突風險）。
- [`side-panel-decluttering.md`](./side-panel-decluttering.md)：右上 InfoPanel 與左側 SignalTuningPanel 的精簡建議。
- [`ascii-mockups.md`](./ascii-mockups.md)：幾種推薦組合的線框示意圖。

---

## 8. 我刻意「沒推薦」的方案（Rejected alternatives）

為避免後續再走回頭路，把幾個「乍看可行但其實會壞事」的方案記下來：

| 方案 | 為什麼不推薦 |
|---|---|
| 把頻率改用 hue 家族、衛星改用 lightness 階梯 | 6 頻率 × 3-4 衛星 = 18-24 個色塊，人類短期記憶分不開；而且 lightness 也會被「inactive 透明度」吃掉 |
| 把波束 ID 編號做成「全域唯一」（B1..B72） | 違反論文常用的「每顆衛星 19/37/61 beams 各自從 1 起跳」慣例，研究模式會看不懂 |
| 把所有衛星都顯示成不同 GLB 模型 | 美術成本高、視覺重量參差，反而失焦 |
| 用 3D 文字標籤把衛星 ID 做得很大 | 會把 3D 場景變成「滿天的字幕」，不是「能看的場景」 |
| 完全去掉頻率色，改用單一色階 | 會讓研究模式損失 frequency reuse 的科學語意 |
| 把 disc 改成 3D 厚片 | 視角變動時會穿插遮擋，地面感會破掉 |

---

**重點 takeaway**：**先減量，再分層，最後才是配色**。
顏色不是萬能；當你已經把六種顏色填進去了還是看不懂，那答案不是「再加第七種顏色」，而是「**換通道**」——形狀、外框、tag chip、紋路、動畫——任一個都比再硬塞一條色相更有效。
