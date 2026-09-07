# W-MS `SceneRenderContent` 第三輪下沉報告

本輪驗收口徑仍是：公開函式接受命名輸入型別、回傳明確結果，且可用 `node:test` + `node:assert/strict` 在不掛 React、不啟動 canvas 的情況下測試。行數只作交付盤點，不作成功指標。

## 分組與判斷

- A：authority spine particle projection。`multiCandidateAuthoritySpineParticlePlans` 同時包含中央 overlay gate、serving pair 選擇、UE 端點投影、粒子 identity/phase 與 immutable row 建構；這是一個完整的 display projection，抽成純模組。
- B：multi-candidate render status。`multiCandidateSceneRenderStatus` 是有固定優先序的 diagnostics policy，讀取 accepted snapshot/source join、decision phase、eligible count、comparison phase 與 mounted plan 狀態；抽成純模組，並讓 `SceneTelemetry` 共用它的 status type。
- 其他候選逐項檢查後，若已有被測 pure resolver、只是輸入 adapter、只是資料重排，或依賴 React/ref/Three feedback edge，均保留在 owner。沒有用 custom hook 包裝大型 input bag。

## 每組結果

### A. authority spine particle projection

- 模組：`src/scene/multiCandidateAuthoritySpineParticlePlans.ts`
- 模組介面：
  - `resolveAuthoritySpineParticlePlans(input: AuthoritySpineParticlePlansInput): readonly SpineParticlePlan[] | undefined`
  - input 內含 `enabled`、renderer-neutral 的 serving `{ pairKey, satelliteId, beamId, beamColor, apex }`、`primaryUeWorld` tuple 與 `particlesPerBeam`。
- adapter：`MainScene.tsx` 只在 `useMemo` 內找 serving instruction，轉交 tuple/record，未把 React state 或 canvas 帶入模組。
- 測試：`src/scene/multiCandidateAuthoritySpineParticlePlans.test.ts`，2 tests；覆蓋 accepted serving row、stable id/phase/端點 clone，以及 disabled/missing serving/missing UE fail-closed。
- 驗證：`node --import tsx/esm --test src/scene/multiCandidateAuthoritySpineParticlePlans.test.ts` exit 0；`npx tsc --noEmit -p tsconfig.json` exit 0。
- 行數：模組 42 行、測試 45 行；目前 `MainScene.tsx` 4,915 行。原本 inline particle 計算改為 8 行 adapter；這些數字不是驗收指標。

### B. multi-candidate render status

- 模組：`src/scene/multiCandidateSceneRenderStatus.ts`
- 模組介面：
  - `resolveMultiCandidateSceneRenderStatus(input: MultiCandidateSceneRenderStatusInput): MultiCandidateSceneRenderStatus`
  - status precedence 為 accepted snapshot → source-frame join → switching → hard-eligible threshold → comparison phase → mounted plan → unmapped pair → active。
- adapter：`MainScene.tsx` 只組 7 個已命名的 primitive/count inputs；`SceneTelemetry.tsx` 改由同一 pure module 讀取 status type，保留非 candidate fallback 的 `inactive`。
- 測試：`src/scene/multiCandidateSceneRenderStatus.test.ts`，3 tests；覆蓋 snapshot/join 優先序、decision/comparison 優先序，以及 missing/unmapped/active 三種 scene projection 結果。
- 驗證：`node --import tsx/esm --test src/scene/multiCandidateSceneRenderStatus.test.ts` exit 0；`npx tsc --noEmit -p tsconfig.json` exit 0。
- 行數：模組 34 行、測試 59 行；目前 `MainScene.tsx` 4,915 行。原本 status 梯式判斷改為 9 行 adapter；這些數字不是驗收指標。

### 本輪總結

- 本輪新增 2 個純模組、2 個 `node:test` 測試檔、5 個測試案例，均不依賴 React/canvas。
- 沒有執行任何 git 寫入指令；沒有執行 `*:browser` validator，也沒有執行或修改 `check:ee` / `check:visual`。
- 兩個標的各自完成時的 `npx tsc --noEmit -p tsconfig.json` 均為 exit 0；最後合併測試為 5/5。之後重新取得的共享 checkout 全域 `tsc` 為 exit 2，唯一錯誤在其他 worker 的 `src/prototype/visual-lab-g0/UnifiedVisualLabPrototype.tsx:1068`：`VisualLabClipId` 不能傳給 `VisualLabGuidedReplayId`。本輪未修改該檔案，也不把這個現況宣稱為本輪 regression。
- 共享 checkout 另有其他 worker 的 `App.tsx`、`UnifiedVisualLabPrototype.tsx` 與未追蹤 WIP；本輪只修改本報告、兩個新純模組/測試，以及 `MainScene.tsx` / `SceneTelemetry.tsx` 的必要接線，未碰其他 dirty WIP。

## 我判斷不該抽的

- `cameraPresets`：固定 pose data table，只有 camera owner 一個 caller；抽出後測試只會重複驗證 literal，沒有足夠行為深度。
- `sceneGeometry`：已有 `sceneGeometryFromProfile` pure module；這裡只是 `propSceneFrame` 與 profile fallback 的來源選擇，新增模組會是淺 adapter。
- `cellSchedule`：真正的 scheduler/geometry 計算由 `useCellSchedule` 持有；此處是 hook 呼叫與輸入組裝，不是 React-free 計算。
- L1543 的 anonymous render-plan destructuring：只是解構既有 `resolveSceneLaneRenderPlan` 結果，沒有新的 policy。
- L1703 的 `useSimStatePublisher`：會發布 state、讀寫 ref、觸發 callback，是 side-effect seam，不應偽裝成純函式。
- `handoverStoryModel`：核心已是 `deriveProfileHandoverStoryModel` pure resolver；這裡只做 layer gate 與輸入接線。
- `displayHeroRecord`：核心已是 `resolveDisplayHeroRecord` 並有測試；元件內只收集 drawable geometry，且該 resolver 明確不以其他 UE 重標 primary hero。
- `multiCandidateSceneRenderPlan`：核心已是被測的 `resolveMultiCandidateBeamScene`；本段只做 render gate、world map 與 UE 輸入組裝。
- `multiCandidateCandidateReviewRenderPlan`：與上一項共用同一 pure resolver，只差 review gate/width/presentation；另抽會複製 adapter。
- `resolveSceneAcceptedBeamColor`：accepted snapshot、homepage palette 與 fallback 的 render-local callback composition；底層 identity color resolver 已存在。
- `multiCandidateSatelliteColorsInput`：已有 `resolveMultiCandidateSatelliteColors` / `useMultiCandidateSatelliteColors`；這裡只是接線。
- `liveBeamIdentityColorBySatelliteBeam`：逐項把 `viz.satBeams` 送進既有 color callback 建 map；測試只會驗證 callback wiring，不會形成更深 interface。
- `multiCandidateCentralMarkerSatelliteIds`：依賴 render-time `useRef` latch、episode key 與 publication gap；抽其中一段會丟失歷史語意。
- `handoverMarkerSatelliteIds`：已由 `resolveHandoverMarkerSatelliteIds` 純模組承擔並有測試，不再建立第二個 seam。
- `renderedLiveSatelliteMarkersInput`：已有 `resolveRenderedLiveSatelliteMarkers` / hook；此處只是組 display sats、identity map、apex map 與 fallback。
- `manualHandoverEvent`：核心已是 `resolveManualHandoverDemoEvent` pure module；此處只接 runtime options、primary UE 與 apex keys。
- manual/cinema `nowMs` 段：`useFrame` 同時寫 tick refs、發布 React state、處理 request lifecycle；把 clock 拆成 hook 仍是搬移 feedback edge。
- `readApexWorld`：單次 `Map.get` 加三欄 copy，且只存在 ref latch 初始化內；獨立測試沒有有效行為深度。
- `authorityHandoverPresentationCandidate`：核心事件判斷已有 `resolveAuthorityHandoverPresentationEvent`；此處只做 homepage selected gate 與 geometry availability callback。
- `handoverPresentationCandidateInput`：大型 input bag 組裝給既有 `useHandoverPresentationCandidate`，不是新的 domain calculation。
- `handoverDisplayIsolation`：核心已是 `resolveHandoverDisplayIsolation` pure module；此處只是 owner state 接線。
- `homepageIntraCellAnchor`：核心已是 `resolveHomepageIntraCellAnchor` 並有測試；`THREE.Vector3` 只在元件 adapter 建立。
- `homepageSceneBeamVisibilityInput`：核心已是 `resolveHomepageSceneBeamVisibility`；這裡只收集 presentation candidates。
- `sinrLiveConePalette`：只是 `BeamDisplaySpec` 欄位的 rename/reorder，沒有 precedence、selection 或 normalization policy。
- anonymous `useSinrLiveCellBeamConeItems` adapter：既有 hook 已封裝 geometry/presentation resolver；輸入含 maps、callbacks、layer gates，抽出只會再造大型 wrapper。
- anonymous `useSinrLiveCandidateBeamConeItems` adapter：`selectCandidateConeGeometry` 與既有 hook 已是可測 seam；此處是候選 geometry 與 presentation gate 的接線。
- anonymous `useHandoverConeItems` adapter：同時協調 pulse、triggered intra、cinema pair、authority pair 四條展示管線；沒有小而深的 pure interface。
- additive handover coloring block：本輪前已由 `resolveAdditiveHandoverConeColoring` 承擔並有測試，不再重抽。
- `beamInfoItemsInput`：`resolveBeamInfoItems` 已有 pure module/測試；這裡只將多層 cone arrays 與 presentation flags 組成 input。
- `multiCandidateSceneRenderReceipt`：`isCandidateSceneRenderReceiptReady` 與 `buildCandidateSceneRenderReceipt` 已提供 pure seam；此處只選 mounted plan 並呼叫 builder。
- `multiCandidateCandidateReviewSceneRenderReceipt`：同上，只是 review plan 與 `eventCueCount: 0` 的另一個 adapter。
- `candidateComparisonVisibleSatelliteIds` / `candidateComparisonOrdinalBySatelliteId`：依賴既有 central/homepage instruction selectors；剩餘只是 Set/Map projection，沒有新增 selection policy。
- camera `command`、Director `command` 與 `tween`：直接讀寫 camera、OrbitControls、refs、transition state；這是 imperative render-loop owner，不是 React-free pure calculation。

## 寫不出測試因此退回的

本輪沒有「已抽出但測試失敗後退回」的模組；兩個已抽 seam 都先建立測試再接回元件。

以下項目若要求在不啟動 React/canvas 的前提下抽出，目前只能測到 wiring 或需要重建 lifecycle，故明確退回、不當作待辦：

- `useCellSchedule` 呼叫與 `useSimStatePublisher` publisher：依賴 hook lifecycle、ref 寫回與 callback side effects。
- manual/cinema `nowMs` 與 tick publication：依賴 R3F `useFrame`、request identity、React state 發布與時間 feedback。
- `multiCandidateCentralMarkerSatelliteIds`：依賴 render-time latch，單獨抽值會失去 episode/publication-gap 語意。
- `useSinrLiveCellBeamConeItems`、`useSinrLiveCandidateBeamConeItems`、`useHandoverConeItems`：目前是 geometry/render orchestration；測試它們的 wrapper 不會比既有 resolver tests 更有意義。
- camera preset/Director effects 與 `tween`：必須操作 Three camera、controls、refs；若不引入新的 camera lifecycle seam，無法寫出符合本輪驗收的純單元測試。
