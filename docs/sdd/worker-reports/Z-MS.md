# Z-MS 第三輪：`SceneRenderContent` 下沉報告

## 分組與判斷

本輪採用的驗收口徑是「純輸入到明確輸出，且能用 `node:test` + `node:assert/strict` 在沒有 React、Three.js canvas 的情況下測試」。行數只作為交付盤點，不作為成功指標。

### A. Display-only cell-frame projection

把 `candidateDisplayCellFrame` 與 `cinemaInterDisplayCellFrame` 放在同一組。兩者都不改變 cell truth，只是在既有 `SinrLiveCellFrame` 上產生展示用的 `illuminatedBeams` 投影；缺少適用條件時保留原 frame reference。共同的 `beamsForSatellite` 也讓每個 cell 的 synthetic beam 規則只有一份。

### B. Recent handover presentation selection

把 `recentPrimaryHandoverEvent` 與 `recentAnyInterHandoverEvent` 放在同一組。兩者都只讀事件陣列與 sim time；共用 retention/future/endpoint 的 fail-closed 判斷。保留既有語意：主角事件在 retention window 內遇到 inter 時優先於較新的 intra；任意 UE 的 inter 事件則取最新有效項。

### C. Additive handover cone coloring

把三段 `additiveHandoverPulseConeItems`、`additiveTriggeredIntraConeItems`、`additiveCinemaHandoverPairConeItems` 合成一個純色彩轉換模組。模組集中處理 accepted beam-color map、serving-identity fallback、intra source/target 明暗，以及 committed inter source pulse 的過濾；元件只保留輸入組裝與 `useMemo` adapter。

## 每組結果

### A. `sceneDisplayCellFrames`

- 模組：[`src/scene/sceneDisplayCellFrames.ts`](../../src/scene/sceneDisplayCellFrames.ts)
- 模組介面：
  - `resolveCandidateDisplayCellFrame(input: CandidateDisplayCellFrameInput): SinrLiveCellFrame | undefined`
  - `resolveCinemaInterDisplayCellFrame(input: CinemaInterDisplayCellFrameInput): SinrLiveCellFrame | undefined`
- `MainScene.tsx` 只留下兩個 `useMemo` adapter；沒有把 React state 或 canvas 依賴帶進模組。
- 測試：[`src/scene/sceneDisplayCellFrames.test.ts`](../../src/scene/sceneDisplayCellFrames.test.ts)，5/5 通過。
- 驗證：`node --import tsx/esm --test src/scene/sceneDisplayCellFrames.test.ts` exit 0；本輪最終 `npx tsc --noEmit -p tsconfig.json` exit 0。
- 行數盤點：模組 57 行、測試 137 行；`MainScene.tsx` 最終 4,931 行。這些數字不是驗收指標。

### B. `recentHandoverPresentationEvent`

- 模組：[`src/scene/recentHandoverPresentationEvent.ts`](../../src/scene/recentHandoverPresentationEvent.ts)
- 模組介面：
  - `resolveRecentPrimaryHandoverEvent(input: RecentPrimaryHandoverEventInput): SinrLiveCellHandoverEvent | null`
  - `resolveRecentInterHandoverEvent(input: RecentInterHandoverEventInput): SinrLiveCellHandoverEvent | null`
- `MainScene.tsx` 只留下兩個 `useMemo` adapter；retention 常數留在 scene model，由純模組讀取同一 authority。
- 測試：[`src/scene/recentHandoverPresentationEvent.test.ts`](../../src/scene/recentHandoverPresentationEvent.test.ts)，5/5 通過。
- 驗證：`node --import tsx/esm --test src/scene/recentHandoverPresentationEvent.test.ts` exit 0；本輪最終 `npx tsc --noEmit -p tsconfig.json` exit 0。
- 行數盤點：模組 79 行、測試 119 行。這些數字不是驗收指標。

### C. `additiveHandoverConeColoring`

- 模組：[`src/scene/additiveHandoverConeColoring.ts`](../../src/scene/additiveHandoverConeColoring.ts)
- 模組介面：
  - `resolveAdditiveHandoverConeColoring<TItem extends HandoverConeColorItem>(input: AdditiveHandoverConeColoringInput<TItem>): AdditiveHandoverConeColoringResult<TItem>`
- `MainScene.tsx` 只留下單一 `useMemo` adapter，輸出仍分別提供給原本三個 render layers。
- 測試：[`src/scene/additiveHandoverConeColoring.test.ts`](../../src/scene/additiveHandoverConeColoring.test.ts)，4/4 通過。
- 驗證：`node --import tsx/esm --test src/scene/additiveHandoverConeColoring.test.ts` exit 0；本輪最終 `npx tsc --noEmit -p tsconfig.json` exit 0。
- 行數盤點：模組 82 行、測試 120 行。這些數字不是驗收指標。

### 本輪總驗證

- 三個新測試檔合併執行：14/14 通過。
- 全域 TypeScript：`npx tsc --noEmit -p tsconfig.json` exit 0。
- 中途第一次全域 `tsc` 曾被並行 Z-VL worker 的未完成 `visualLabStoryInspectPlan.ts` 型別變更擋住；未修改該 WIP，待其狀態穩定後重跑，最終 exit 0。
- `git diff --check` exit 0。
- 沒有執行任何 `*:browser` validator，也沒有執行或修改 `check:ee` / `check:visual`。
- 沒有執行任何 git 寫入指令；其他 worker 的 dirty WIP 保留原狀。

## 我判斷不該抽的

以下逐項對照任務材料；「不抽」代表目前沒有一個更深、可獨立驗收的純模組 seam，不代表功能無效。

- `cameraPresets`：只是四個固定 pose 的資料表，只有一個 caller；抽出後測試只會重複驗證常數，沒有足夠行為深度。
- `sceneGeometry`：profile 轉換本身已有 `sceneGeometryFromProfile` 純模組；這一段只在 `propSceneFrame` 與 profile adapter 之間選擇來源，抽出會是淺 adapter。
- `cellSchedule`：真正的計算由 `useCellSchedule` hook 管理；目前這段是 hook 呼叫與輸入組裝，不是 React-free 的衍生計算。
- L1536-L1556 的 anonymous `renderPlan` 解構：不是計算，只是將既有 render plan 欄位展開。
- L1696-L1716 的 `useSimStatePublisher` 呼叫：會發布 state、讀寫 ref 並觸發 callback，屬 side-effect seam，不應偽裝成純模組。
- `multiCandidateSceneRenderPlan`：核心已在 `resolveMultiCandidateBeamScene`；本段只做 scene-layer gate、UE/world map 與 runtime display inputs 的 adapter 組裝。
- `multiCandidateCandidateReviewRenderPlan`：與上一項共用同一 pure resolver；另外抽只會複製 gate 與 adapter。
- `resolveSceneAcceptedBeamColor`：底層已有 `resolveAcceptedBeamIdentityColor` 與 homepage color resolver；這個 callback 是 accepted snapshot、homepage flag、fallback 的 render-local composition。
- `multiCandidateSatelliteColorsInput`：底層已有 `resolveMultiCandidateSatelliteColors` 與 `useMultiCandidateSatelliteColors`；這段只是把目前 render scope 的 callbacks 和 arrays 接線。
- `liveBeamIdentityColorBySatelliteBeam`：只有一次 consumer，主要是把 `viz.satBeams` 逐項送進現有 color resolver；單元測試會變成 mock map/callback wiring test。
- `multiCandidateCentralMarkerSatelliteIds`：依賴 render-time `useRef` latch、episode key 與 publication gap；抽出其中一段無法保留完整歷史語意。
- `manualHandoverEvent`：核心 `resolveManualHandoverDemoEvent` 已是純模組且已有測試；此處只把 runtime options、primary UE 和 apex key 接到既有 resolver。
- `nowMs` / manual-cinema clock 段：依賴 `useFrame`、`performance.now()`、`useState`、request lifecycle；不能把 clock state 當成無狀態計算搬走。
- `readApexWorld`：只是 ref latch 內的一次 `Map.get` + shape copy，沒有值得命名的獨立行為。
- `authorityHandoverPresentationCandidate`：實際事件判斷已有 `resolveAuthorityHandoverPresentationEvent`；homepage selected boundary 是此 render adapter 的局部 gate。
- `handoverPresentationCandidateInput`：是跨多個 presentation owner 的大型 input bag 組裝，抽出會重新製造高參數、低深度的工具網。
- `handoverDisplayIsolation`：核心 `resolveHandoverDisplayIsolation` 已是純模組且已有測試；此處只是把當前 owner state 接線。
- `homepageIntraCellAnchor`：核心 `resolveHomepageIntraCellAnchor` 已是純模組且已有測試；`THREE.Vector3` 只在元件 adapter 中建立。
- `homepageSceneBeamVisibilityInput`：核心 `resolveHomepageSceneBeamVisibility` 已是純模組；這段只是收集現有 presentation candidates。
- `sinrLiveConePalette`：只是 `BeamDisplaySpec` 欄位的平面投影，沒有 policy 或選擇行為；測試只會與 object literal 同構。
- L3154-L3183 的 anonymous `useSinrLiveCellBeamConeItems` 呼叫：是 geometry/presentation hook orchestration，輸入包含 maps、callbacks、layer gates，沒有 React-free 的小 interface。
- L3278-L3394 的 anonymous `useHandoverConeItems` 呼叫：同時協調 pulse、triggered pair、cinema pair、authority pair 四條展示管線；抽走會產生大參數 hook wrapper，而不是深模組。
- `beamInfoItemsInput`：底層已有 `resolveBeamInfoItems` 與 hook；本段是 layer input assembly，不再建立第二個 seam。
- `multiCandidateSceneRenderReceipt`：`isCandidateSceneRenderReceiptReady` 與 `buildCandidateSceneRenderReceipt` 已提供可測純邏輯；這裡只選擇 mounted plan 並呼叫既有 builder。
- L3677-L3710 的 camera `command`：`useLayoutEffect` 會改 Three camera、controls 與 refs；不是 React-free 純衍生值。
- L3712-L3765 的 Director `command`：`applyDirectorFocusCommand` 已是 camera FSM helper，但本段負責 lane gate、ref 與 transition telemetry side effects，抽出會把 adapter 變成另一個 hook。
- L3779-L3843 的 `tween`：直接操作 `THREE.Vector3`、OrbitControls、camera tween ref 與 director orbit ref；這是 imperative render loop，不符合本輪純模組驗收。

## 寫不出測試因此退回的

本輪沒有「已抽出、測試失敗後再退回」的模組；三個已抽目標都先建立了 React-free test seam，且 14 個測試全綠。

下列項目因無法在不啟動 React/canvas、且不重寫產品生命週期的前提下寫出有意義的純單元測試，因此留在元件內：

- `cellSchedule` 的 hook/state scheduler。
- `useSimStatePublisher` 的 publisher/callback/ref side effect。
- manual/cinema `nowMs` clock 與 `useFrame` state publication。
- `multiCandidateCentralMarkerSatelliteIds` 的 render-time ref latch。
- `useSinrLiveCellBeamConeItems` 與 `useHandoverConeItems` 的 geometry/render orchestration。
- 三段 camera `command` / Director `command` / `tween` 的 Three.js imperative loop。

這些不是待辦的「先搬出去再想測試」，而是本輪依照驗收條件明確退回的邊界；若要處理，必須先有新的產品/渲染生命週期 seam，而不是把大型 hook 或 ref 網包成另一個模組。
