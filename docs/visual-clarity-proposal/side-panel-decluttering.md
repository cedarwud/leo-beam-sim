# 懸浮面板（InfoPanel / SignalTuningPanel）精簡建議

> 這份對應 README §6。針對右側 InfoPanel、左側 SignalTuningPanel、頂部 ControlBar 提出減量與聚焦建議。**不修改現有程式**。

---

## 1. 現況盤點

從 `src/ui/InfoPanel.tsx`（844 行）、`src/ui/SignalTuningPanel.tsx`（1502 行）、`src/ui/ControlBar.tsx`（185 行）整理出目前的版面：

```
┌──────────────────────────────────────────────────────────────────┐
│  ControlBar (頂部) — Profile / Speed / Pause / Mode toggle        │
├──────────────────┬───────────────────────────────┬───────────────┤
│                  │                               │               │
│ SignalTuning     │   3D Canvas (MainScene)       │  InfoPanel    │
│ Panel (左)       │                               │  (右)         │
│ width 520px      │                               │  width 340px  │
│                  │                               │               │
│ - SINR 公式      │   - 衛星 / 波束 / 地面格網    │  - Signal     │
│ - 6 個分頁:      │                               │    Profile    │
│   power/loss/    │                               │  - ACTIVE     │
│   beam/recv/     │                               │    SERVING    │
│   interf/noise   │                               │  - PENDING    │
│ - 各 5-12 個      │                               │    TARGET     │
│   numeric        │                               │  - SINR       │
│   控制項         │                               │    Delta +    │
│ - Handover       │                               │    Trigger    │
│   policy 分頁     │                               │  - BEAM       │
│                  │                               │    HOPPING    │
│                  │                               │  - DEBUG/     │
│                  │                               │    VALIDATION │
│                  │                               │   (diag only) │
└──────────────────┴───────────────────────────────┴───────────────┘
```

**問題**：
1. SignalTuningPanel 在 1366×768 螢幕上吃掉 38% 寬度，3D Canvas 被擠到中間 < 700px。
2. InfoPanel 把 SERVING 和 PENDING 拆成兩張卡，視覺上是「並列」的兩件事；但故事上它們是「對戰」（誰勝出 → 觸發 handover），應該整合成一張卡。
3. SINR Delta + Trigger Time 是 SERVING vs PENDING 的衍生數據，現在被放在第三張卡，跟前兩張的關係要靠讀文字才知道。
4. BEAM HOPPING 卡只在說「Physical Serving Beam Active: yes/no」，資訊密度極低，不該佔一張完整卡的版面。
5. SIGNAL PROFILE 卡是設定資訊，看一次就夠，不需要每幀都在那邊。

---

## 2. 設計原則

### 2.1 「三層空間優先級」對應「三層資訊優先級」

**第一層（畫面的最強位置）**只放最重要的故事：
> 現在誰在服務 → 下一個會交給誰 → 還差多少（SINR delta）→ 還剩多久（trigger time）

**第二層（次要區）**放穩定但需要的數據：
> beam hopping 狀態 / handover counter / 公式 readout（tuning mode 才出來）

**第三層（折疊區）**放診斷與調參：
> 完整公式分頁 / runtime parameter table / DPC research policy / DEBUG/VALIDATION

### 2.2 「畫面 = canvas」必須是主角

3D Canvas 應佔 ≥ 60% 螢幕寬度。任何全寬永遠固定的面板都應該重新檢視。

---

## 3. InfoPanel（右側）建議改版

### 3.1 把 SERVING + PENDING 合併成「對戰卡」

現況：兩張並列卡，各自獨立。

建議：

```
┌───────────────────────────────────────┐
│  HANDOVER DUEL                        │
├──────────────┬────────────┬──────────┤
│  SERVING     │            │  PENDING │
│  R053·01·04  │   Δ +2.3 dB│  R053·02·07│
│  F2 B5       │            │  F1 B3   │
│  18.4 dB     │  ████░░  87%│ 14.8 dB  │
│  el 67° 720km│  trig 4.7/5.4│ el 49° 980km│
└──────────────┴────────────┴──────────┘
```

- **左側欄**：青藍色 accent，serving 衛星 + 波束 + SINR + topo
- **右側欄**：金黃色 accent，pending 衛星 + 波束 + SINR + topo
- **中央**：直接顯示 SINR delta + trigger progress bar，**綠色**代表已超過 offset 門檻
- 衛星 ID 用各自的「衛星色 chip」呈現（呼應主畫面）

> 一張卡同時答了三個問題：誰在服務、誰在等、是不是要切過去了。

### 3.2 BEAM HOPPING 縮成狀態 pill

現況：一整張卡只說「physical serving beam active: yes」。

建議：把 beam-hopping 狀態壓成一行 pill：

```
[ BH SLOT 47 · 0.8s · ⬤ active ]
```

- 不啟用時：`[ BH OFF ]`
- 啟用且 serving beam 在當下 slot：綠點 active
- 啟用但 serving beam 在這個 slot 不亮：橙點 idle

放在「對戰卡」下方一行，或者更激進：移到 ControlBar 右側。

### 3.3 SIGNAL PROFILE 卡折疊

只在 profile 切換的瞬間以 toast 出現 3 秒，之後折成右上角小角落 chip：

```
[ HOBS · 2024 · TR 38.811 ]
```

點擊才展開細節。

### 3.4 DEBUG/VALIDATION 改為 floating pill

現況：佔了 InfoPanel 底部一整塊，diagnostics 模式才出現。

建議：把它做成獨立的「diagnostics drawer」，從右下角彈出/收起，不要疊進 InfoPanel。InfoPanel 在 diagnostics 模式應該保持「對戰卡 + BH pill」的精簡樣貌。

### 3.5 完整 InfoPanel 預期版面

```
┌─────────────────────────┐
│  [HOBS·2024·TR38811] ⓘ  │  ← 折疊的 profile chip
├─────────────────────────┤
│                         │
│   HANDOVER DUEL         │  ← 主卡（永遠在）
│   SERVING vs PENDING    │
│   含 Δ 和 trigger bar    │
│                         │
├─────────────────────────┤
│  [ BH SLOT 47 · ⬤ ]      │  ← BH pill
├─────────────────────────┤
│  γ 公式 readout（tuning │  ← Tuning/Diagnostics 才出來
│  / diagnostics 才顯示）  │
└─────────────────────────┘
```

寬度可以從 340px 收到 280px，騰出更多畫面空間給 3D Canvas。

---

## 4. SignalTuningPanel（左側）建議改版

### 4.1 預設摺疊為左緣抽屜

現況：520px 永遠開啟，吃掉螢幕近 4 成。

建議：

```
PRESENTATION mode  →  SignalTuningPanel 完全隱藏，左緣只留一條 "≪ Tuning" 把手
TUNING mode        →  抽屜展開 (520px)，3D Canvas letterbox 壓縮（不被遮，是 reflow）
DIAGNOSTICS mode   →  抽屜可開可關，預設只開到 360px
```

關鍵動作：**展開時讓 Canvas reflow**，而不是 absolute overlay 蓋在 Canvas 上面。這樣 OrbitControls 的滑鼠座標也不會被面板偷走。

### 4.2 公式分頁壓縮

現況：6 個 tuning tabs（power/loss/beam/recv/interference/noise）+ 公式 map disclosure + handover policy。

建議：
- 把 6 個分頁直接做成可滾動的 accordion，**不切分頁**：所有公式項目同時在一個長 list 裡，每個 group 預設摺疊只露 symbol + 當前值。
- 點 group 才展開該組的數值控制。
- 這樣不會逼使用者「先猜哪一頁」。

### 4.3 公式 map（`SinrFormulaMap`）的視覺化用法

`SinrFormulaMap` 是把分子/分母項目對應到顏色的視覺地圖（依現有 disclosure 結構）。建議：

- 把這張 map **同時掛在 InfoPanel 的對戰卡上**（小縮圖，hover 才放大），這樣 tuning 時不需要左右兩個面板來回對。
- 公式項目顏色與「對戰卡」中對應 SINR readout 的小色塊**保持一致**，建立色彩 → 公式項的長期記憶。

---

## 5. ControlBar（頂部）建議改版

現況：Profile selector / Speed / Pause / UI mode toggle。

建議新增：

| 位置 | 控制項 | 用途 |
|---|---|---|
| 中段 | **「視覺密度」滑桿（few / normal / many）** | 即時調整同時繪製的 beam 數 |
| 中段 | **「攝影機預設」按鈕**（zenith / oblique / chase）| 一鍵切換相機視角 |
| 右段 | **BH 狀態 pill**（同 §3.2）| 把 BH 從 InfoPanel 拉到頂部 |

### 5.1 視覺密度滑桿的具體建議

- `few`：只畫 SERVING + PENDING + APPROACH primary（3 條 spine + 3 disc）
- `normal`：再加 RECENT-SOURCE + 每顆衛星最強的 1 條 active beam
- `many`：當前行為（最多 3 衛星 × 6 beams）

預設 `normal`。研究模式（`tuning` / `diagnostics`）允許切到 `many`，presentation 預設 `few`。

---

## 6. 完整三模式對照

| 元件 | Presentation | Tuning | Diagnostics |
|---|---|---|---|
| InfoPanel — Profile chip | ✅ 折疊 | ✅ 折疊 | ✅ 折疊 |
| InfoPanel — 對戰卡 | ✅ | ✅ | ✅ |
| InfoPanel — BH pill | ✅ | ✅ | ✅ |
| InfoPanel — γ 公式 readout | ❌ | ✅ | ✅ |
| InfoPanel — 完整 LinkBudget tile grid | ❌ | ✅ | ✅ |
| SignalTuningPanel | 收起（把手） | 展開 520px | 半開 360px |
| Diagnostics drawer | ❌ | ❌ | ✅（右下） |
| ControlBar — 視覺密度 | `few` | `normal` 可改 | `normal` 可改 |
| ControlBar — 相機預設 | ✅ | ✅ | ✅ |

---

## 7. 具體尺寸建議（1440×900）

```
ControlBar          高度 56px
InfoPanel           寬 280px（presentation） / 320px（tuning/diagnostics）
SignalTuningPanel   寬 0px / 520px / 360px（依模式）
3D Canvas           剩餘空間，至少 720px 寬

縱向：InfoPanel 可滾動，最高 calc(100vh - 88px)
```

---

## 8. 「故事性」優先順序最終總結

從觀眾打開畫面的 0 秒到 5 秒，視覺與面板要回答的順序：

| 秒 | 觀眾的問題 | 畫面要給的東西 | 面板要給的東西 |
|---|---|---|---|
| 0–1s | 誰在服務？ | 最亮的青藍色光柱 | 對戰卡左欄高亮 |
| 1–2s | 訊號好不好？ | spine 上方衛星青藍光暈 | SINR readout 顏色（綠 / 黃 / 紅） |
| 2–3s | 接下來會怎樣？ | 金黃色光柱在側 | 對戰卡中間 Δ + trigger bar |
| 3–4s | 哪些衛星參與？ | 衛星身體上色 + spine 衛星色 + disc 外框 | 對戰卡 chip 衛星色與畫面一致 |
| 4–5s | 還有誰在 idle？ | 邊緣紫色 / 灰青小光柱 | （無，畫面已自帶） |

如果哪一秒讀不到對應資訊 → 那層 Tier 沒做好；不必再加任何細節。
