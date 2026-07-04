# P3 slice-2 mini-SDD — toggle-slam + 覆蓋/公平面板 + 誠實揭露

> **狀態**：草案，**待使用者過目後才 code**（plan-first，遵 final-plan §10 排程偏好）。
> 上游：[handover-simulator-final-plan.md](./handover-simulator-final-plan.md) §3 P3、
> [frontend-change-contract.md](./frontend-change-contract.md)（本 slice 全程走其 gate map）。
> 前序：P3 spine slice-1（`aeec1ec`，lane 已接 H2 a2 scene 窗 + producer served/starved 真相）。

---

## 0. 一段話

在已接好的 `modqn-replay-proof` replay 舞台上，加 **① a2↔b1 一鍵 toggle-slam**（紅海↔全綠）、
**② 覆蓋/Gini/Lorenz 指標面板**（純 scene-json 聚合、win 軸 lead coverage、Jain 標 diagnostic-only）、
**③ 誠實揭露 chip + provenance chip**（清償 one-page OPEN OBLIGATION）。全部資料自足或輕橋接、
一個 worktree、一次 `validate:ready`。self-check live 重算、nav-polish、cue-panel 接窗、
board clean-delete **明確拆出**（§7）。

---

## 1. 範圍

### IN（slice-2）

| # | 項目 | 淨新增 vs 重用 |
|---|---|---|
| A | a2↔b1 toggle（segmented-control，紅綠 slam） | 新 toggle 元件（模仿 `ModqnViewToggle` 慣例）+ App state 升級（常數→state） |
| B | 覆蓋/Gini/Lorenz 面板 | **全新**（repo 內零 fairness viz）：純函式 `coverageFairness.ts` + `CoverageFairnessPanel.tsx` |
| C | 誠實揭露 chip | 新內容 chip（可掛 `ClaimBoundaryBanner` 骨架或獨立小件） |
| D | provenance chip | manifest.json 輕橋接 + 新 chip（重用 `ProvenanceChip`/`ArtifactSourceBadge` 樣式） |

### OUT（明確拆出，§7 排序）

- **self-check live 重算 chip** → slice-3（需 dense-Q 大檔 stage + P1 引擎橋接；scene 窗無 dense-Q）
- **nav-polish**（解 `decision-overlay` 依賴）→ 獨立 slice
- **cue-panel 決策接窗**（現顯 baseline JSONL sat-0 ≠ window）→ 獨立 slice
- **board `ModqnReplaySceneLayer` clean-delete** → 獨立 slice（D1 收尾，過 validate:ready 後）

---

## 2. 資料地基（controller 親驗，rule-3，load-bearing）

`_p3-coverage-probe.mjs`（scratchpad throwaway）直讀兩窗 `visual-showcase-v1.json`：

| 窗 | frames×UE | served/starved 逐 frame | per-UE served-frac mean/min | **Gini** | frame0 |
|---|---|---|---|---|---|
| **a2 auction hero** | 96×100 | 96/96 carry flag | 0.997 / 0.979 | **0.0025** | 100 served / 0 starved |
| **b1 argmax baseline** | 96×100 | 96/96 carry flag | 0.260 / 0.000 | **0.7400** | 26 served / 74 starved |

**結論**：`served`/`starved` 已逐 frame 烤進 json（frame0 keys = `…, served, starved`），且已貫通
`NormalizedUe.served/starved`（slice-1）。→ **覆蓋/Gini/Lorenz 可純前端跨 96-frame 聚合，
無需 step-trace、無需 producer re-export。** Gini 數字獨立重算逐位對上 memory（a2 0.0025 / b1 0.74）
→ win-axis 敘事坐實。

**chip 資料源（scene 窗是 scene-only）**：
- provenance = `h2-dense-ablation-2026-07-04/{arm}/manifest.json`（2847B，keys: `arm/armWhy/
  trainedWeights/producerHead/eeDefinition/decodeParams/decouple/honestyGuard/catfish/selfChecks/
  READINESS_ONLY`）→ 輕橋接（§6-D）。
- self-check live 重算 = dense-Q（step-trace / 全量 252MB policyDiagnostics）→ **拆 slice-3**；
  slice-2 只顯示 `manifest.selfChecks` + `dense_q_self_check.json`（732B）的**靜態** server 結果
  「server 已驗 argmax==selected 9600/9600 ✓」。

---

## 3. A — a2↔b1 toggle-slam

### 資料流（親驗現成）

- App:287 `recordedReplayArtifactUrl` 現硬綁 a2 常數。fetch effect（App:1160-1210）**deps 含該 URL**
  → URL 變則自動重 fetch → `setShowcaseArtifact` → `ShowcaseReplayController` / `replaySceneFrame` /
  紅綠場全自動翻。已有 `cancelled` guard 防 in-flight race。
- **最小改動**：`MODQN_REPLAY_STAGE_WINDOW_URL`（單常數）→ `const REPLAY_ARM_WINDOWS = {a2:'…/h2-scene-a2…',
  b1:'…/h2-scene-b1…'}` + `const [replayArm, setReplayArm] = useState<'a2'|'b1'>('a2')`；
  `recordedReplayArtifactUrl = REPLAY_ARM_WINDOWS[replayArm]`（當 isRecordedReplayLane）。vite 兩窗已 serve
  （slice-1，都 `sceneOnly:true`）→ **不動 vite**。

### 載入權衡（§實測定，勿盲猜 — contract rule#1）

| 案 | 即時性 | 成本 | 判 |
|---|---|---|---|
| **fetch-on-toggle**（改常數→state，現有 effect 自動支援） | 切窗閃 loading（54MB 重 fetch+parse，localhost 估數百 ms–1s） | 幾乎零 | 起步 |
| 預載兩份（雙 state，toggle 只切 active） | 即時 slam 無閃 | 雙 fetch 108MB + 記憶體×2 + 啟動慢 | 若實測 fetch-on-toggle drama 不夠即時才升 |

**建議**：fetch-on-toggle 起步 + 進 lane 後 `requestIdleCallback` 背景預 fetch 另一窗 warm HTTP cache
（toggle 走 disk cache 秒回）→ code 階段 :3000 screenshot 實測翻窗延遲，不夠即時再升雙 state。

### 元件 + 掛點

- 新 `src/ui/ReplayArmToggle.tsx`：segmented-control，模仿 `ModqnViewToggle.tsx:54` 慣例
  （const options `[{key:'b1',label:'基本 argmax'},{key:'a2',label:'智慧 auction'}]` + `role=tablist` +
  `data-testid=replay-arm-toggle` + `data-active` + arrow-key）。**presentational-only**（props
  `{arm, onArmChange}`，App 持 state）。
- 掛點：頂 bar（wireframe §7「基本 argmax ⇄ 智慧 auction」）— 模仿 `SinrLiveQuickControls`（App:1764）
  或 `ModqnViewToggle` sub-nav row（App:1780）；gate `sceneLane==='modqn-replay-proof'`。
- **敘事順序**：b1（基本）在左、a2（智慧）在右 → 拖右 = 紅海翻綠（口試 runbook §5 節拍①→②）。

---

## 4. B — 覆蓋/Gini/Lorenz 面板（全新）

### 純函式 `src/showcase/coverageFairness.ts`（無 render dep）

從探針蒸餾（已驗演算法）：

```
currentFrameCoverage(frame: NormalizedSceneFrame): { served: number; total: number; pct: number }
  // 即時頂 bar：count served over frame.ues（served===true，或 !starved）

windowServedFractionStats(frames: readonly NormalizedSceneFrame[]): {
  perUeServedFraction: ReadonlyMap<string, number>;  // UE served 次數 / 出現次數
  meanServedFraction: number;
  minServedFraction: number;                          // worst-off UE（b1=0.000）
  gini: number;                                        // per-UE served-frac 的 Gini（↓=equal）
  lorenzPoints: readonly [number, number][];           // cumulative pop% → cumulative served%
}
  // gini: sorted fracs, cum Σ(i+1)·f_i, (2·cum)/(n·Σf) − (n+1)/n；全 0 → 0
```

- **輸入取現成 `NormalizedSceneFrame[]`**（timeline 全 96 frame，App 已有 `showcaseArtifact` →
  可 `showcaseArtifactToScene` 逐 frame 或直接讀 `showcaseArtifact.timeline[].ues[].served`）。
- memoize on `[showcaseArtifact]`（96×100 聚合輕，但避免每 render 重算）。

### 元件 `src/ui/CoverageFairnessPanel.tsx`（新）

- **頂 bar**：`覆蓋 ▓▓▓▓░░ NN%`（current-frame，隨 playback 即時）→ 掛頂 bar toggle 旁。
- **Expert 面板**（掛左 cue panel 內 or 右 modqn tab，Expert 掀開才顯）：
  - Lorenz 曲線（SVG，模仿 `RewardCurvePanel` SVG 樣式）+ 對角線 equality 參照。
  - Gini 讀數 + worst-off UE served-fraction（b1 = **0.000** 是最有力的 defense 數字）。
  - **Jain diagnostic-only 標註**（binding）：若顯 Jain，必標「Jain 獎勵 equal-misery 塌縮
    （b1 Jain 0.988 > a2 0.809 卻是 74 人餓死）→ **非 win 軸**」。win 軸 = coverage/served + EE。
- `countStarvedUes`（replayFieldColor.ts:108，**現無 render call site**）→ 這裡首次上螢幕「N starved」讀數。

---

## 5. C+D — 誠實揭露 chip + provenance chip

### C 誠實揭露 chip（清償 [[project_modqn_one_page_consolidation]] OPEN OBLIGATION）

binding 文字（從 manifest.honestyGuard + memory 抄準）：
- `selectedActionIndex` = **argmax-anchor（basic-mode counterfactual）非 served**；served 真相 =
  `servingBeamId` + `auctionAudit`（防委員把「selectedActionIndex」誤讀成「政策選了 argmax」）。
- **catfish present-but-inert**（`catfish_enabled=false` + intervention=0，四臂一致）→ 翻盤純 coordinated
  auction decode（別說 catfish「不存在」，說「掛著但沒作用」）。
- **win 軸 = coverage/served(0.26→0.997) + EE、非 Jain**（Jain diagnostic-only）。
- **decode-time counterfactual 非 retrained**（同一份估值換分配器，非 per-arm 重訓）。
- `READINESS_ONLY`。

實作：可掛 `ClaimBoundaryBanner`（App:1979，consumes NormalizedSceneFrame subset）擴充，或新建
獨立小 chip。**傾向獨立小件**（內容特定、避免污染 claim-boundary 決策邏輯）；`DegenerateDataBanner`
（存在但未 mount）可當樣式參考。**contract rule#6**：文字即真相、不得 lie。

### D provenance chip（manifest 輕橋接）

- **資料橋接**：stage `manifest.json` 進 scene route（vite `sceneOnly` bundle 加 optional `manifest.json`
  surface）→ App fetch。⚠️ **動 vite.config = 治理**，但同 slice-1 sceneOnly 模式擴充、小改。
  替代 = build-time inject（但違「producer artifact 該從檔讀」精神）→ 選 stage。
- 顯：arm / armWhy / trainedWeights path / producerHead（966fd87→33cc302，data-only mid-run，已驗）/
  eeDefinition（EE@33cc302 gated）/ decodeParams / decouple(80%) / **server selfChecks 9600/9600 ✓靜態** /
  READINESS_ONLY。
- 重用 `ProvenanceChip`（AlgorithmDashboard:73）/ `ArtifactSourceBadge`（:83）視覺樣式。

> C+D **可合成一個「誠實/來源」面板**（減元件數 + flag budget，contract rule#5）：disclosure 文字 +
> manifest provenance + server self-check 靜態結果三段。code 階段定合併或分離。

---

## 6. 治理 / gate（frontend-change-contract 全流程）

- **worktree isolation** + dispatch-prompt template（contract §dispatch）+ controller 親 review diff 才 apply。
- **flag budget**（rule#5）：toggle 只換 artifact URL（同 lane、**不加 render-plan flag/layer**）；面板/chip
  = DOM-only（不佔 render-plan budget）。記帳：+1 UI state（replayArm）、+1 純函式模組、+2–3 UI 元件。
- **新 validator**（rule#4 invariant-pin 非 source-pin，進 static:all 自發現名冊）：
  `validate:modqn:coverage-fairness` — 對兩窗 assert `coverageFairness` 聚合正確性 + win-axis invariant
  （a2 Gini < 0.01 且 mean > 0.99；b1 Gini > 0.5 且 min == 0）→ 鎖 win-axis 數字不漂 + 面板算法正確。
- **truth 不動**（rule#7）：全 display-only 聚合/顯示，不碰 SINR/serving/decode/geometry/provenance 值。
  coverageFairness 只**讀** producer served/starved，不計算覆蓋真相。
- **gate 分級**：面板/chip/toggle = **STRUCTURAL**（新 mount + lane 行為）→ 跑**完整 `validate:ready`**
  （非 fast-path）。

---

## 7. 驗收準則（worker 回報，controller 親驗才 accept）

1. **toggle 實拍**：before(a2 全綠場)/after(b1 紅海 74 紅) screenshot，翻窗 drama 成立。
2. **覆蓋/Gini/Lorenz 實拍**：頂 bar coverage% 隨 playback 動；Expert 面板 Gini/Lorenz 數字**對上親驗**
   （a2 0.997/Gini 0.0025；b1 0.26/Gini 0.74/worst-off 0.000）；Jain diagnostic-only 標註在。
3. **chip 實拍**：誠實揭露文字（5 條 binding）+ provenance（manifest 欄位）+ server self-check 靜態 ✓。
4. `validate:governance:full` + `validate:static:all` + `validate:ready` **全綠**（非只 governance）。
5. 新 `validate:modqn:coverage-fairness` 綠 + 進 static:all 自發現。
6. `tsc --noEmit` 綠。negative-control / 既有 lane（sinr-live 6 browser gate）未 regress。
7. **不 push**、worktree diff controller review。

---

## 8. 風險

- **R1 fetch-on-toggle drama 不夠即時**：§3 實測 → 升雙 state 預載。
- **R2 /tmp scene 窗 ephemeral**：reboot 清 → 需重 stage（source `h2-dense-ablation-2026-07-04` +
  `scripts/build-h2-scene-payload.mjs`）；toggle/面板 fail-close 於窗缺（現有 showcaseError 路徑）。
- **R3 vite.config 動（provenance manifest surface）= 治理**：小改、同 slice-1 sceneOnly 模式；
  替代 build-time inject 避開但較不誠實。
- **R4 面板掛點**（cue panel 在左、modqn proof stack 在右）：實際佈局非 wireframe 理想 →
  code 階段依現實佈局定，頂 bar（toggle+coverage%）+ Expert 面板（Gini/Lorenz）分離掛。
