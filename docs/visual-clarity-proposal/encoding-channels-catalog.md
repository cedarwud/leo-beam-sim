# 視覺編碼通道完整目錄

> 對應 README §3。本檔把每一個可動用的視覺通道列成一張總表，標記**優缺**、**衝突風險**、**現況使用情形**、以及**建議用途**。
> 「現況使用」一欄是直接從 `src/viz/SatelliteBeams.tsx`、`beamRoleTokens.ts`、`SatelliteMarker.tsx`、`HandoverLinks.tsx`、`EarthFixedCells.tsx` 盤點而來。

---

## 1. 總表（依「故事優先順序」排）

下表中：
- ⭕ = 強烈推薦把這個通道用在指定的 Tier
- 🔶 = 可用但要小心（可能跟現況衝突）
- ❌ = 不建議在此 Tier 使用（已被別的 Tier 占用，或會壞事）

| # | 通道 | 現況使用 | Tier 1 角色 | Tier 2 衛星身分 | Tier 3 頻率 | 備註 |
|---|------|----------|:---:|:---:|:---:|------|
| 1 | 圓錐側壁填色 | 角色 ⊕ 頻率 | ⭕ | ❌ | 🔶 | 主色給角色用；非 event 波束才回退到頻率 |
| 2 | 地面 disc 填色 | 同上 | 🔶 | ❌ | ⭕ | 推薦讓 disc 內部填色穩定地表達「頻率」 |
| 3 | disc 外框（border / ring） | 弱（現在和填色同色） | ❌ | ⭕ | ❌ | **建議分配給「衛星身分」** |
| 4 | 圓錐 spine line（軸線） | 跟主色同色 | 🔶 | ⭕ | ❌ | 把 spine 改成衛星色，把空中圓錐拉回 apex |
| 5 | 端點 marker 形狀 | 一律 sphere | ❌ | ⭕ | ❌ | ▲ ■ ● ★ ◆ ✚ glyph 區分衛星 |
| 6 | 端點 marker 大小 | 角色決定 | ⭕ | ❌ | ❌ | 已用，OK |
| 7 | 端點實心 / 空心 | 角色 ⊕ 是否 active | ⭕ | ❌ | ❌ | 已用，但跟 Tier 1 共享，沒空間給衛星 |
| 8 | 連線粗細 | 角色 | ⭕ | ❌ | ❌ | 已用，OK |
| 9 | 連線實 / 虛線 | 角色 ⊕ 是否 active（雙重） | 🔶 | ❌ | ❌ | 建議簡化：**只有 inactive 才虛線**，approach 改用其他方式 |
| 10 | 透明度 (opacity) | 是否 active + 角色 | ⭕ | ❌ | ❌ | 已用，OK |
| 11 | callout 文字主體 | `SERVING F# B# SINR` | ⭕ | ❌ | ⭕ | 已用 |
| 12 | callout 衛星 ID chip | **無** | ❌ | ⭕ | ❌ | **建議新增**：`[R053·01·04]` 前綴 |
| 13 | callout 邊框 | 跟主色同色 | ⭕ | ❌ | ❌ | 跟著主色變化即可 |
| 14 | callout 左側粗條（borderLeft） | 跟主色同色 | ⭕ | ❌ | ❌ | 已用 |
| 15 | callout 內 frequency swatch | **無** | ❌ | ❌ | ⭕ | **建議新增**：3-4px 的色塊，把「F#」釘在視覺上 |
| 16 | 衛星模型 mesh tinting | **無** | ❌ | ⭕ | ❌ | 把 sat.glb clone 後上衛星色 |
| 17 | 衛星 pointLight 強度 | 角色 | ⭕ | 🔶 | ❌ | 已用；可額外給「衛星色光暈」 |
| 18 | 衛星模型旋轉 / 動畫 | 無 | ❌ | 🔶 | ❌ | 可選；但只在 active 時動較自然 |
| 19 | 衛星上方 text label | role accent + sat ID | ⭕ | ⭕ | ❌ | 已用，OK |
| 20 | spine 粒子流 / 流光 | 無 | 🔶 | ⭕ | ❌ | 動畫，最強 pre-attentive |
| 21 | 衛星軌道拖尾 | 無 | ❌ | ⭕ | ❌ | 衛星色拖尾，呼應 apex 識別 |
| 22 | 地面 hex grid 外框 | 一律藍 / 灰 | ❌ | ⭕ | ❌ | 重新利用：被覆蓋的格用衛星色描邊 |
| 23 | 地面 hex grid 填色 | served 時藍 | ❌ | ❌ | ⭕ | 重新利用：被覆蓋的格用頻率色填 |
| 24 | spatial halo / convex hull | 無 | ❌ | ⭕ | ❌ | 把同一衛星的 disc 群框起來 |
| 25 | UE→衛星 link 線（HandoverLinks）| 角色色 | ⭕ | 🔶 | ❌ | 可在外側加「衛星色 ribbon」雙層線 |
| 26 | UE 自身的視覺強調 | 無 | ❌ | ❌ | ❌ | 跟主題不直接相關，但 UAV 可加底座光圈 |
| 27 | 攝影機景深 / DOF | 無 | ❌ | ❌ | ❌ | 不建議；研究用途會看不清遠處 |

---

## 2. 配色限制與衝突清單

### 2.1 必須避開的色衝突

下面這些色家族**不能拿來當衛星色**，否則會跟現有的 Tier 1 角色色撞色：

- 青藍 #38B6FF → SERVING
- 金黃 #FFB000 → PENDING / candidate
- 紫紅 #CF5CFF → APPROACH
- 灰青 #83A8C7 → RECENT-SOURCE

也不應該拿來當衛星色，因為 Tier 3 已用：

- `BEAM_FREQUENCY_COLORS` = `#63d471, #8ea2ff, #ff6f73, #6bc6a8, #b991ff, #d98564`

### 2.2 衛星色建議調色板（4 色）

對應 `MAX_BEAM_SATS = 3` + 1（保留 fallback / 未來擴充）：

| 角色（不是 Tier 1 角色，是「第幾顆衛星」的順位）| 推薦衛星色 | 為什麼這顆色 |
|---|---|---|
| Sat-1（通常是 serving 衛星）| `#FFFFFF` 純白外框 + 內描 #38B6FF | 跟 SERVING 視覺自然連接，但又有獨立識別性 |
| Sat-2（通常是 pending）| `#F2EFE5` 暖白 / 米色 | 跟 PENDING 金黃同溫但不撞 |
| Sat-3（通常是 approach）| `#D6CCFF` 淡薰衣草 | 跟 APPROACH 紫家族但更安靜 |
| Sat-4 / fallback | `#A4D9FF` 冰藍 | 跟既有色都離得遠 |

> 重點：衛星色**故意低飽和、偏白色家族**，這樣它們不會搶 Tier 1 的舞台，但仍然能彼此區分。

### 2.3 形狀調色板（4-6 衛星）

對應 #5「端點 glyph」與「衛星模型 silhouette」：

| 順位 | 形狀 | 渲染 |
|---|---|---|
| 1 | ▲ 三角 | `triangleGeometry` 或 plane + texture |
| 2 | ◆ 菱形 | `octahedronGeometry`（low-poly）|
| 3 | ● 圓形（保留現有 sphere）| sphere |
| 4 | ★ 星形 | shape geom |
| 5 | ✚ 十字 | shape geom |
| 6 | ◯ 雙環 | ringGeometry × 2 |

> 形狀區分性比顏色更穩定；六種以內人類能秒辨。

---

## 3. 通道相互替代性（如果你只想做一兩件事）

下面是 **「if-only」decision table**——如果只做某幾條，效果由高到低：

| 改動 | 預期效果 | 工程量 |
|---|---|---|
| **減少同時繪製的 beam 數**（只畫 event-role）| ★★★★★ | XS |
| **callout 加上衛星 ID chip** | ★★★★☆ | XS |
| **disc 外框 = 衛星色** | ★★★★☆ | S |
| **衛星模型 tinting** | ★★★★ | S |
| **端點 glyph 形狀** | ★★★ | M |
| **spine line = 衛星色** | ★★★ | S |
| **重用 hex 格網作 paint-by-numbers** | ★★★★（敘事性極高）| M-L |
| **spine 粒子流動畫** | ★★ | L |
| **衛星軌道拖尾** | ★★ | M |
| **重整 dash 規則** | ★ | XS（但會牽動現有 token）|

---

## 4. 與現有 `BEAM_ROLE_TOKENS` 對照

下面把建議落到現有 token 結構上，標出「哪個欄位拿來表達哪一層」：

```
BeamRoleToken {
  // === Tier 1 角色 ===
  color                ← 主色（serving 青 / pending 金 / approach 紫 / source 灰）
  lineWidth, linkLineWidth, coneOpacity, discOpacity, lineOpacity,
  endpointRadius, endpointOpacity, endpointFilled, dashed (簡化後),
  calloutGlowPx, markerScale, markerLightIntensity

  // === Tier 2 衛星身分（建議新增欄位 / 從外部 prop 注入）===
  satelliteId          ← 已有
  satelliteColor       ← 新（從 4 色調色板取）
  satelliteGlyph       ← 新（▲ ◆ ● ★）

  // === Tier 3 頻率 ===
  frequencyIndex       ← 已有
  frequencyColor       ← 已有（由 frequencyReuseColor() 產生）

  // === 標籤 ===
  operatorLabel        ← Tier 1
  markerLabel          ← Tier 1
  // 新增：
  satelliteChipLabel   ← Tier 2（"R053·01·04"）
  frequencySwatchColor ← Tier 3
}
```

> 這個欄位增補只是建議結構；具體實作時需要 `useBeamViz` 在組裝 `BeamTarget` 時把 `satelliteId` → `satelliteColor` / `satelliteGlyph` 的查表帶進來。

---

## 5. 衝突再檢查（防止新加的東西又打架）

把所有「層」的通道列成一張交叉表：

|  | Tier 1 用 | Tier 2 用 | Tier 3 用 | 衝突？ |
|---|---|---|---|---|
| 圓錐填色 | ✓ |  |  | OK |
| disc 填色 |  |  | ✓ | OK |
| disc 外框 |  | ✓ |  | OK |
| spine line |  | ✓ |  | OK |
| 端點 size | ✓ |  |  | OK |
| 端點 shape |  | ✓ |  | OK |
| 端點 fill 實/空心 | ✓ |  |  | OK |
| 連線粗細 | ✓ |  |  | OK |
| 連線虛實 | ✓（簡化後）|  |  | OK |
| opacity | ✓ |  |  | OK |
| callout 邊框 | ✓ |  |  | OK |
| callout sat chip |  | ✓ |  | OK |
| callout F# 文字 |  |  | ✓ | OK |
| callout F# swatch |  |  | ✓ | OK |
| 衛星模型 tint |  | ✓ |  | OK |
| 衛星 pointLight | ✓ + ✓（雙倍）|  |  | 共用，但不衝突 |
| 軌道拖尾 |  | ✓ |  | OK |
| hex grid 外框 |  | ✓ |  | OK |
| hex grid 填色 |  |  | ✓ | OK |

> 整張表沒有同一個通道同時被兩層使用 → **沒有 channel double-booking**，這是視覺契約最重要的條件。

---

## 6. 灰階檢查（Grayscale-safe）

如果列印出來只有灰階，下列五種角色仍要區別開——這條已被現有 SDD 的 Phase 2C/2D 規範要求。把每一層在灰階下的識別性對齊一下：

| 層 | 灰階下還能讀出嗎？ | 為什麼 |
|---|---|---|
| Tier 1 角色 | ✅ | line width + dash + endpoint fill 都不靠顏色 |
| Tier 2 衛星身分 | ✅ | 形狀 glyph 在灰階下完全 ok；外框色雖然會褪成灰階但相對亮度仍可區分 |
| Tier 3 頻率 | 🔶 | 顏色變灰階會變成接近的階；callout 的 `F#` 文字補上去就 ok |

---

## 7. 我建議**先做** vs **後做**的清單

### 先做（兩週內可以全部上）
1. 限制同時顯示的 beam 數（只 event-role + 1 condition：「該顆衛星最強的一個 active beam」）
2. callout 衛星 ID chip
3. 衛星模型 tinting（最多 4 色）
4. disc 外框 = 衛星色
5. dash 規則簡化（只有 inactive 才虛線）

### 後做（presentation 模式或下一階段）
6. 端點 glyph 形狀
7. spine line = 衛星色
8. hex grid paint-by-numbers
9. spine 粒子流
10. 衛星軌道拖尾
