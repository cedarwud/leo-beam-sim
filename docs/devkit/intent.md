# 意圖檔（backlog）— leo-beam-sim

> 所有工作的源頭。每項帶 why 與 non-goals。**只有使用者能改優先序**；agent 可補充事實欄位、可提案新項（狀態＝proposed）。北極星脈絡見 `.agent-memory/`（教學/口試雙用途換手模擬器；最終方案 `docs/handover-simulator-final-plan.md`）。
>
> 種子建檔：2026-07-06 安裝 session，內容取自 controller memory 的 NEXT 清單；優先序沿用 memory 記載，使用者可隨時重排。

## 進行中軸線：P3 spine 剩餘（slice-1/2/3 已 DONE+MERGED @ `a7af62a`）

### 1. self-check live 重算 chip（memory 記載 NEXT 候選①）
- **why**：清償誠實揭露 chip「self-check not yet re-run in-browser」TODO——口試時「重播結果可在瀏覽器重算驗證」是 defense 主張的最後一塊。
- **內容**：dense-Q 瀏覽器 re-decode；需 dense-Q（全量 252MB policyDiagnostics）stage ＋ P1 decode 引擎橋接。
- **non-goals**：不重訓、不改 producer 數據、不動 replay 輸入 JSON。
- **前置**：`/tmp` staged 資料 reboot 會消失——重跑 `node scripts/build-h2-scene-payload.mjs`（含 manifest copy）。

### 2. Jain live 讀 manifest（slice-2 遺留 TODO；NEXT 候選②）
- **why**：Jain 值目前非 live 讀取；diagnostic-only 定位（獎 equal-misery 塌縮）但顯示值要有 provenance。
- **non-goals**：不把 Jain 升格為 win 軸（win 軸＝coverage/served＋EE＋Gini/Lorenz，紅線）。

### 3. EE 子專案（angle-aware EE/power 旋鈕；NEXT 候選③，**blocked**）
- **why**：defense＝旋鈕反駁、education＝live meter。producer `angle_aware_ee.py` 的 G_T(θ) J1/J3 是正確的角度依賴 power。
- **硬 blocker**：H2 export 無 `H`（+I_hat/σ²）→ 純 leo live EE 不可能 → **等使用者發 producer relay**。
- **non-goals**：不在 leo 側重算物理真值（違反 repo 邊界 1）。
- 詳：memory `project_angle_aware_ee_display_plan_2026-07-04`。

### 4. 紅綠場視覺殘留（P3 紅綠場決）
- 亮地面過曝、AA-off 鋸齒（與 hex 邊緣一起決）、full-grid scope。
- **why**：口試投影可讀性。non-goals：不回開 AA 犧牲 FPS（軟體 WebGL ~9 FPS 天花板）。

### 5. artifact-replay lane 的 Proof segment dead-click（cosmetic edge，低優先）

## 較舊 OPEN（未排程，使用者圈選才動）

- W8 spotlight（right-sidebar restore 遺留）。
- Beam control surface Phase B：footprint/mosaic/callout 常數 → spec；統一 rainbow hex/dots。
- perf 續攻：terrain MeshStandard→Lambert、texture downscale、cone overdraw、reduced-motion。
- `shouldRenderModqnReplayScene` validator-only orphan 清理（動 scene-lane-governance:107-122，架構單向門級謹慎）。
- handover-pulse flake（sinr-live timing，非 regression；觀察名單→ production-feedback）。

## 新項提案區（agent 寫入，使用者裁決）

- **P2 健檢 backlog（2026-07-07）**：完整分級清單見 [reports/health-2026-07-07.md](./reports/health-2026-07-07.md)。**安全網包 SN-1..5＋W-1 已全數完成（2026-07-07，commits f07bba9..16a5268）**；剩餘圈選項＝P1（北極星鏈補路由、sdd-index 修真）＋P2/P3 各項。
- **SN-5 獵物清單（slice B 發現，待圈選）**：①`vc4a-duel-card` 既有紅（瀏覽器級孤兒，InfoPanel duel 演化 vs 殭屍 mock，修 PASS 需行為變更）；②`wall-clock-latch` 既有紅（同族——speed slider DOM 移位）；③omega-s1/s2 validator 檔無 npm key（static:all 永掃不到＝recurrence-guard 盲區；三擇一：補 key/移 parked/刪）；④phase6o/p/r/u/v changed-files 掃描×髒樹×字面量的結構隱患（已拆當前雷、根治待議）；⑤s0-connected 的 profile stub 幾何 NaN 已顯式化（檔頭註解與 MainScene 不一致，要不要補 stub 預設值待議）。
