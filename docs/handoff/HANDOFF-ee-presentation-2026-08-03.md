# EE 面板呈現收工紀錄 — 2026-08-03

這份紀錄承接 `/home/u24/papers/beamshift/docs/HANDOFF-leo-beam-sim-ee.md`；交接檔已先讀，已確認的公式與邊界不在本輪重推。

## 開工基線

- donor repo: `/home/u24/demo/leo-beam-sim`
- `git rev-parse HEAD`: `e5a272c04133cb7534e4a770c34c50caf3e32c73`
- 開工 `git status --short --branch`: `## main...origin/main [ahead 1]`，無 dirty path
- `/home/u24/papers/beamshift` 的 `s1-render` worktree: `/home/u24/papers/beamshift-render`

## 先量：leo-beam-sim 自己場景的值

量測是 default `sinr-experiment`／`hobs-2024-candidate-rich`，100 UEs、uniform rectangle `200 × 90 km`、seed 7、profile start offset 450 s。cell model warm-up 42 s 後，在 `t=492…1092 s` 每 5 s 取一 frame，共 121 frames。量測 source 是 `SinrLiveCellFrame.ues`；每個 live UE 以實際 `(servingSatId, cellId)` 分組。

| 量 | 實測結果 |
|---|---:|
| cell link-budget `txPowerDbm` | 50 dBm = 100 W |
| beam-power override | none（`SinrLiveCellModel.linkBudgetOptions()` 沒有 override map） |
| per-serving-beam `U` observations | n=3,843；min=1；median=2；p95=8；max=12；mean≈2.91 |
| served-user SINR observations | n=11,194；median≈−6.12 dB；p95≈−2.93 dB；mean≈−6.49 dB |
| coverage | min=63%；median=95%；p95=100%；mean≈92.5% |

上游對話的假設數字 `590` 與 `162` 本輪均未使用；它們不是本場景量測值。

## source 決定

`ModqnServiceMap.ueCountByCellId` 保持 `source: 'profile-derived-demo'`、`claimKind: 'overlay-demo'`，不升格，也不接到 `src/utils/energyEfficiency.ts`。

新的 paper-style EE 讀值只消費 live cell truth：`sim.sinrLiveCells.ues`。每一個實際 serving `(satellite, earth-fixed cell)` group 產生 `U`，再套 profile-backed equation (3.37a) raw-power surface：

```text
B_beam = bandwidthMHz × 1e6 / frequencyReuse
P^{b,raw}_{s,v} = min(0.25 + 0.35 × U_{s,v}^0.5, 10) W
η_link = B_display × log2(1 + 10^(γ_u/10)) / P^{b,raw}_{s,v}
```

面板現在只顯示一個 `EE` primary readout：它重用同一批 live `U/γ`，只把顯示用 allocated bandwidth 投影到 profile-backed 的完整 500 MHz operating point；它是示意投影，不改 live serving truth，也不宣稱目前 live scene 已重現論文實驗。live coverage-weighted EE、served conditional value、coverage、`U p50/p95` 與 served `γ` median 仍留在 producer/data layer 作為後續正確版依據，但不在面板另列。`596.92 Mbits/J` 是 profile 中的 current Chapter 5 published comparison anchor。

既有 R1 EE 的 helper 與 model tests 保留，但不再與 paper-style EE 一起出現在面板；面板只留單一 `EE` readout，避免把 load-cancelled reward-surface link metric 與 paper power surface 混讀。

## 本輪變更

- [`src/utils/paperEnergyEfficiency.ts`](../../src/utils/paperEnergyEfficiency.ts)：live-cell source 的純函式、load/power/SINR/coverage summaries、fail-closed guards。
- [`src/utils/paperEnergyEfficiency.test.ts`](../../src/utils/paperEnergyEfficiency.test.ts)：(3.37)、coverage weighting、null SINR、settings guard、六個 shipped profile anchor gates。
- [`src/profiles/types.ts`](../../src/profiles/types.ts) 與六個 profile JSON：明列 power surface 與 `596.92` anchor。
- [`src/scene/useSimStatePublisher.ts`](../../src/scene/useSimStatePublisher.ts)、[`src/scene/types.ts`](../../src/scene/types.ts)、[`src/scene/panelState.ts`](../../src/scene/panelState.ts)：只把 live cell frame 的 aggregate 接入 `SimState`，並納入 publish change detection。
- [`src/app/liveClaimBoundary.ts`](../../src/app/liveClaimBoundary.ts) 與 [`src/showcase/liveSimToScene.ts`](../../src/showcase/liveSimToScene.ts)：同步允許 claim，但保留 `not paper reproduction` 與原有禁止宣稱。
- [`src/ui/InfoPanel.tsx`](../../src/ui/InfoPanel.tsx)、[`src/ui/info-panel/DuelCard.tsx`](../../src/ui/info-panel/DuelCard.tsx)、[`src/ui/info-panel/DuelSignalColumn.tsx`](../../src/ui/info-panel/DuelSignalColumn.tsx)：並列 fixed-power R1 與 paper-style headline／解釋欄位。

## 後續 UI 收斂：隱藏 public experience switch

左上角 `SINR / MODQN` 的 public `LaneExperienceBar` 已從 `App.tsx` 的 launch surface
移除；無 persisted mode 時仍由 `DEFAULT_APP_EXPERIENCE_MODE` 開啟 `sinr-experiment`，
所以一般畫面直接落在 SINR。SINR formula／handover controls 保留在左側 rail；
`LaneExperienceBar` 元件本身、`handleExperienceChange` 與 MODQN/replay proof transition
path 保留給內部 proof tooling，沒有刪 MODQN truth、資料或 frame contract。

左側 rail 現在可用右上角、捲軸左側的 `left-sidebar-toggle` 收合／展開：收合時左側
grid track 縮為 44px、內容向左淡出，主畫布取得釋放的寬度；按鈕保留 `aria-expanded`、
focus outline 與鍵盤可操作性。這是 display/layout state，不改 simulation、EE 或 frame contract。

## 快速示意版

為先縮短畫面與 Ch5 anchor 的視覺距離，新增 profile-backed `ch5DemoBandwidthMHz=500`
與 `ch5DemoFrequencyReuse=1`。publisher 仍從 `sim.sinrLiveCells.ues` 量 `U` 與 `γ`；
只另外計算一個 display-only projection，並在面板並列：

- `EE`：同一 live `U/γ`、完整 500 MHz 投影，面板唯一的 EE readout。
- live baseline：只保留在 data layer，不在面板顯示。

瀏覽器實測一幀：`EE=150.36 Mbits/J`；同幀 coverage
`99.0%`、`U p50=2.0 / p95=7.4`、served `γ` median `−8.7 dB`。畫面明確標示
`EE`，不再列 live 值或 `Ch5 demo` 字樣；`not paper reproduction` claim boundary 保留在
handoff，不以第二個面板數字呈現。

追問時以乾淨瀏覽器重新量得一幀：面板唯一的 `EE=176.18 Mbits/J`；同幀 coverage
`76.0%`、`U p50=2.0 / p95=5.1`、served `γ` median `−5.1 dB`。目前 source/UI 沒有固定的
`1.200` 字串；若畫面看到 `1.200`，必須先確認欄位／單位與瀏覽器是否仍在舊 bundle，不能
直接歸因為「沒有演算法」。

## 驗證

## 續測：直接切 Ch5 profile 的結果

為檢查「先把 live profile 調成接近 Ch5」是否是安全的第一步，使用同一套
live earth-fixed cell model、100 UE、seed 7、`t=492…1092 s` 取樣窗做 read-only
runtime probe：

- 現有 `modqn-4sat-7beam-paper-faithful`（500 MHz、K=1、20 GHz、33 dBm）：
  121 個取樣 frame 全部 `servedUeCount=0`，因此 paper EE 為 `null`。
- 以 `hobs-2024-candidate-rich` 的 live geometry 只覆寫 500 MHz／K=1／20 GHz／33
  dBm，結果同樣沒有可計算的 served frame。
- 即使保留 candidate-rich 的 50 dBm，只覆寫 500 MHz／K=1，仍因 live
  link-budget 的 noise/interference 同步改變而落到零服務。

結論：不能把既有 default profile 的 RF 欄位直接改成 Ch5 欄位來縮小數字；那會
改變 serving truth，甚至讓 EE 消失。若要讓 live 數字靠近 Ch5，下一步必須是
獨立的 Ch5 scene／runtime contract（同時鎖定幾何、噪聲、干擾、頻寬、load 與
平均軸），不能由目前 HOBS candidate-rich profile 做未標示的混合。

- `npm run lint` — PASS
- `npm run build` — PASS
- `npm run validate:paper-energy-efficiency:model` — 5 checks PASS
- `npm run validate:r1-energy-efficiency:model` — 7 checks PASS
- `npm run validate:phase-c:sinr-live-cells:model` — 24 checks PASS
- `npm run validate:phase-c:sinr-live-cells:runtime` — 11 checks PASS
- `npm run validate:architecture:boundaries` — 3 checks PASS
- `npm run validate:static:all` — PASS
- `npm run validate:phase-d:banner-copy` — 25 checks PASS
- `npm run validate:vc4a:duel-card` — PASS（啟動 Vite 後重跑）
- Playwright live DOM／viewport check — paper readout、`U`、`γ`、coverage、596.92 anchor 均可見；console 的 404 是既有 favicon，另有既有 WebGL／GLTF warnings，沒有本輪 EE exception。

## s1-render 通知邊界

已將 donor 狀態與這次變更記在本檔，供 `/home/u24/papers/beamshift-render`（branch `s1-render`）讀取：donor 的 panel／profile／SimState 有新增 paper EE readout，隱藏 public `SINR / MODQN` experience switch，並新增可收合的左側 layout rail，但沒有改 BeamShift truth files，也沒有把 `ueCountByCellId` 變成 live contract。若 s1-render 要做 parity，應把這些視為 donor-side presentation change，另行決定自己的 frame contract；不要回讀 overlay-demo map 當論文 load truth。

## 收工基線

- `git rev-parse HEAD`: `e5a272c04133cb7534e4a770c34c50caf3e32c73`（本輪未 commit）
- 收工 worktree: 預期只包含本紀錄列出的程式、profile、test、package 變更；沒有 stage、commit 或 push。

## 右側 EE 計算卡補充 — 2026-08-03

### 開工紀錄

- `git rev-parse HEAD`: `e5a272c04133cb7534e4a770c34c50caf3e32c73`
- worktree 已包含本檔前述 EE／版面／字級 WIP；本次只在該既有 WIP 上追加右側 EE 呈現，沒有 broad revert、stage、commit 或 push。

### 呈現決定

- aggregate EE 已從 `ACTIVE SERVING` 欄移除；它不再看起來像 selected link 或 serving satellite 的值。
- `BEAM DUEL` 與 `SIGNAL PATH` 之間新增獨立 `EE` card。headline 仍是把未服務 UE 以 0 計入的 all-UE average。
- 計算主線直接顯示 `Served UE average × Coverage = EE`；不是先把平均 `U`、平均 `γ` 代回非線性公式。
- card 顯示實際 producer 已提供的中間量：display bandwidth、total/served/unserved UE、per-beam `U_{s,v}` summary、served `γ_u` summary、equation (3.37a) `P^{b,raw}_{s,v}` 與 beam-power summary、finite-SINR count。
- `596.92 Mbits/J` 改標為 `Chapter 5 reference`，並明寫 `Static paper comparison only · not used in this frame calculation`。它是目前第五章發表值的靜態比較 anchor，不是本幀輸入或計算項。
- 沒有新增 100 個 UE 的 raw-number list，也沒有改 producer/data formula；`ModqnServiceMap.ueCountByCellId` 仍未被消費，live `U/γ` source boundary 不變。

### 驗證與目視

- `npm run validate:paper-energy-efficiency:ui` — PASS
- `npm run validate:paper-energy-efficiency:model` — 6 checks PASS
- `npm run lint` — PASS
- `npm run build` — PASS（最終垂直 aggregation layout）
- `npm run validate:architecture:boundaries` — 3 checks PASS
- `npm run validate:vc4a:duel-card` — PASS；validator 產生的四張 tracked checkpoint PNG 已精確還原到開工 HEAD，未混入功能 diff。
- Playwright 1440×900：確認 `ACTIVE SERVING` 無 EE、獨立 card 可捲動讀完、三段 aggregation 無重疊、`Mbits/J` 維持較小字級、reference 與 `SIGNAL PATH` 順序清楚。console 只有既有 favicon 404、WebGL readback 與 GLTF extension warning，沒有 EE exception。

### s1-render 通知

供 `/home/u24/papers/beamshift-render` branch `s1-render` 讀取：donor 右欄的 presentation baseline 已改為 `BEAM DUEL → EE calculation card → SIGNAL PATH`。這是 donor-side UI hierarchy change；沒有改 BeamShift truth、live source contract 或論文 reproduction claim。若 s1-render 做畫面 parity，應更新對照構圖，但不可把 `Chapter 5 reference` 當成本幀 producer value。

### 收工紀錄

- 收工 `git rev-parse HEAD`: `e5a272c04133cb7534e4a770c34c50caf3e32c73`（本次未 commit）
- 原有 unrelated dirty WIP 保留；本次新增／修改範圍另見本節與 `git diff`，沒有 stage 或 push。

## EE 卡符號表稽核與呈現修正 — 2026-08-03

### HEAD 與權威來源

- 本段開工 `git rev-parse HEAD`: `e5a272c04133cb7534e4a770c34c50caf3e32c73`。
- 符號以 `/home/u24/papers/modqn-paper-reproduction/thesis-mc/mc-modqn-base.md` 式 (3.37a)–(3.39a) 為最高權威，並逐項對照 `thesis-mc/notation-table.md`。
- 稽核發現原卡片的裸 `K`、`N`、`U_b`、`γ_valid` 與 `P^b(U_b)` 是 UI 簡寫，不是論文符號表的正式寫法；不得再把它們宣稱為符號表一致。

### 修正後呈現

- UE 總數改用 `|𝒰|`；波束負載改用 `U_{s,v}`；實際服務 SINR 使用 `γ_u`；目前 power helper 明確標為 raw beam power `P^{b,raw}_{s,v}`。
- `p50`／`p95` 改成 `Median`／`95th percentile`；`Valid SINR` 改成白話 `SINR values available`，並說明它只計 finite numeric values，不是品質門檻。
- 公式卡以式 (3.39) 的 `η̃_u^EE=R_u/p_u^alloc` 為論文定義，再列式 (3.37a) raw-power surface。`min` 明寫為「負載功率與單束 cap 取較小者」，並用當前 median load 動態列出代入值。
- 上標 `b, raw`／`alloc` 明寫為 power-family labels，下標 `u`／`s,v` 為 UE／衛星－波束索引，不是乘冪。
- 已刪除整個 `Chapter 5 reference` block、`596.92 Mbits/J` 靜態 anchor 的 UI 呈現，以及 `Each UE is calculated first...` 段落；profile/data layer 的 anchor 未刪。
- EE 卡標題、說明、aggregation、公式、metric value/unit/detail 均提高字級；`Mbits/J` 仍比主數值小一級。

### 重要真值邊界

目前 `computePaperBeamPowerW()` 只實作式 (3.37a) 的 raw power 與單束 cap。論文完整式 (3.37) 還會用 `α_s^b(t)` 對同一衛星所有波束做 `P_sat,max` 預算縮放，得到 `P̃^b_{s,v}(t)`；donor 現在沒有這個 satellite-budget aggregation，因此卡片明示此限制，不把 current-frame readout 稱為完整 Chapter 5 reproduction。display bandwidth 仍是快速示意投影，也沒有冒用符號表中固定意義為 `B_sys/3` 的 `B_beam`。

### 驗證與 s1-render 通知

- `npm run validate:paper-energy-efficiency:ui` — PASS。
- `npm run validate:paper-energy-efficiency:model` — PASS（test 名稱同步修正為式 (3.37a)）。
- Playwright 1440×900 live DOM／目視：新版正式符號與限制文案已出現在 localhost；EE card `scrollWidth === clientWidth === 405px`，沒有水平溢位。時間軸僅在測試 browser session 暫停以取得穩定截圖。
- 給 `/home/u24/papers/beamshift-render` branch `s1-render`：donor 右欄 baseline 已移除 Chapter 5 靜態 reference block，改用正式符號與 raw-power truth boundary，並放大 EE card 字級。parity 時不得沿用舊 `K/U_b/P^b(U_b)` 簡寫，也不得把 raw power 當成 satellite-scaled `P̃^b`。
- 本段收工 `git rev-parse HEAD`: `e5a272c04133cb7534e4a770c34c50caf3e32c73`（未 commit、未 stage、未 push；既有 dirty WIP 保留）。

### 使用者後續收斂：先移除公式區

- 依使用者指示，整個 `energy-efficiency-formula` 區塊已先刪除；不在面板列式 (3.37a)、式 (3.38)、式 (3.39)、參數代入或 `min` 範例。
- `EE` headline、`Served UE average × Coverage = EE` 與六個實測摘要欄位保留；正式符號只留在欄位標籤，不再形成整段公式說明。
- s1-render donor baseline 同步以「無公式區」為準；真值邊界仍由本交接檔保留，不以右欄長文呈現。

### 使用者後續收斂：隱藏 reuse 投影文案

- EE bandwidth 欄位只移除可見文字 `÷ reuse factor 1`；底層 reuse、SINR 與 EE 計算均未變更。開工／收工 HEAD 皆為 `e5a272c04133cb7534e4a770c34c50caf3e32c73`，供 s1-render 以此 donor copy baseline 對照。
- EE 標題下方的重複說明列也已移除；UE population 與 served/unserved 實際數字仍保留在下方欄位，計算不變。
- aggregation labels now distinguish `Served-UE EE mean` and `Service coverage`; the duplicate bottom `= EE` result tile is removed because the headline `Overall EE (all UEs)` is the single final EE value.
- `SINR values available` now shows one UE count only; the redundant served-UE denominator was removed from that tile, with the finite-SINR meaning retained in its detail text.
- The `SINR values available` tile is now removed from the EE card entirely; served SINR distribution remains in `Served UE SINR`, while existing bandwidth/load/raw-beam-power summaries remain visible.
- Added producer-backed summaries for `Served-UE throughput` (`R_u`) and `Raw power share per UE` (`P^{b,raw}_{s,v}/U_{s,v}`); the latter is explicitly raw power share, not satellite-scaled `p^{alloc}_u`.
- Distribution display is intentionally simplified to mean-only for load, throughput, SINR, raw beam power, and raw per-UE power share; 5th/95th percentile and range text are hidden. The bandwidth detail `Profile bandwidth 500.0 MHz` is also hidden; calculations remain unchanged.
- Removed the duplicate `P^{b,raw}_{s,v}` symbol from `Raw power share per UE`; the beam-level raw-power tile retains the formal symbol, while the per-UE tile keeps its plain-language label and explanatory text. No calculation change.
