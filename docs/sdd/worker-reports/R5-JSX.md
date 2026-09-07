# R5-JSX：`SceneRenderContent` JSX 分組拆分報告

本報告的 props 數量都指元件 public interface 的「最外層 props」。巢狀 model 是按語意命名的資料邊界，不把它攤平成一長串參數。

## 分組

1. **Ground UE markers**：負責地面 UE marker 的位置、trail、homepage/SINR/ModQN 色彩與 contention 顯示。
   - 節點：原 `GroundScene` expression。
   - 元件：`SceneGroundUeLayer`；4 個 top-level props：`visible`、`ues`、`marker`、`appearance`。

2. **Cell presentation**：負責 ModQN 的 cell overlay、profile handover story、reassignment arcs 與 cell beam cones。
   - 節點：`CellOverlay`、`HandoverStoryLayer`、`CellHandoverArcs`、`CellBeamCones`。
   - 元件：`SceneCellPresentationLayers`；4 個 top-level props：`overlay`、`story`、`arcs`、`beamCones`。

3. **Beam-load overlays**：負責 load cylinder 與 upload particles 兩種負載視覺層，保留各自 mount/visibility gate。
   - 節點：`BeamLoadCylinder`、`BeamLoadUploadParticles`。
   - 元件：`SceneBeamLoadLayers`；2 個 top-level props：`cylinder`、`uploadParticles`。

4. **Satellite identity markers**：負責 world-following satellite marker 的候選標籤、EE progress、identity tint、scale 與 layer visibility。
   - 節點：原 `renderedLiveSatelliteMarkers.map(...)` expression 與其中的 `SatelliteMarker`。
   - 元件：`SceneSatelliteMarkerLayer`；5 個 top-level props：`satellites`、`visibility`、`identity`、`labels`、`emphasis`。

5. **Multi-candidate comparison**：負責 accepted central beat 與 additive review beat 的比較幾何，不取得 camera ownership。
   - 節點：central `MultiCandidateBeamScene`、review `MultiCandidateBeamScene`。
   - 元件：`SceneMultiCandidateLayer`；3 個 top-level props：`context`、`central`、`review`。

6. **SINR-live beam field**：負責 8 個 cone mounts、2 個 footprint mounts、Beam Info callouts 與 teaching cones 的共同 cell-truth render surface。
   - 節點：non-serving、serving、cinema inter-serving fan、candidate、pulse、triggered intra、cinema pair、authority transition cones；serving/candidate footprints；callouts；teaching cones。
   - 元件：`SceneSinrLiveBeamLayers`；5 個 top-level props：`appearance`、`cones`、`footprints`、`callouts`、`teaching`。

7. **Natural handover motion**：負責 links、pulse clock、orbit trail、spine particles 與 ground ripple 的動畫載體。
   - 節點：`HandoverLinks`、`BeamPulseClock`、`OrbitTrail`、`SpineParticles`、`ServingGroundRipple`。
   - 元件：`SceneHandoverMotionLayers`；5 個 top-level props：`reducedMotion`、`links`、`orbitTrail`、`spineParticles`、`groundRipple`。

8. **Accepted handover cue**：負責已接受 handover source-to-target transition cue 的 mount gate 與呈現。
   - 節點：`DecisionHandoverCue` expression。
   - 元件：`SceneAcceptedHandoverCue`；6 個 top-level props：`mounted`、`transition`、`placementByCellId`、`progress01`、`sourceColor`、`targetColor`。

9. **Intra ground shockwave**：負責 intra handover 的地面一次性 shockwave，不擁有事件 state。
   - 節點：`IntraGroundShockwave` expression。
   - 元件：`SceneIntraGroundShockwave`；5 個 top-level props：`mounted`、`vizFrame`、`runtime`、`identityColorBySatelliteId`、`identityColorBySatelliteBeamId`。

10. **Handover toast**：負責 screen/world overlay 的 handover toast 與其完整 toast model。
    - 節點：原 `showSceneOverlays` fragment 內的 `HandoverToastOverlay`。
    - 元件：`SceneHandoverToastLayer`；2 個 top-level props：`mounted`、`toast`。

## 每組結果

以下行數是用 `git show HEAD:src/scene/MainScene.tsx` 量原始 JSX，再對照目前 `MainScene.tsx` 的 adapter 區塊；不是以總行數作為唯一完成判準。每組接線後都通過 `./node_modules/.bin/tsc --noEmit -p tsconfig.json`，最後再次重跑亦為 exit 0。

| 組 | 檔案 | public props | MainScene 原 JSX → adapter | 新檔行數 | tsc |
|---|---|---:|---:|---:|---|
| Ground UE | `src/scene/SceneGroundUeLayer.tsx` | 4 | 52 → 28（-24） | 110 | green |
| Cell presentation | `src/scene/SceneCellPresentationLayers.tsx` | 4 | 33 → 37（+4） | 82 | green |
| Beam load | `src/scene/SceneBeamLoadLayers.tsx` | 2 | 18 → 21（+3） | 53 | green |
| Satellite markers | `src/scene/SceneSatelliteMarkerLayer.tsx` | 5 | 77 → 36（-41） | 156 | green |
| Multi-candidate | `src/scene/SceneMultiCandidateLayer.tsx` | 3 | 86 → 27（-59） | 110 | green |
| SINR-live beams | `src/scene/SceneSinrLiveBeamLayers.tsx` | 5 | 225 → 182（-43） | 210 | green |
| Handover motion | `src/scene/SceneHandoverMotionLayers.tsx` | 5 | 48 → 43（-5） | 97 | green |
| Accepted cue | `src/scene/SceneAcceptedHandoverCue.tsx` | 6 | 39 → 41（+2） | 36 | green |
| Intra shockwave | `src/scene/SceneIntraGroundShockwave.tsx` | 5 | 13 → 11（-2） | 33 | green |
| Handover toast | `src/scene/SceneHandoverToastLayer.tsx` | 2 | 77 → 74（-3） | 20 | green |

10 組合計從 668 行原始 JSX 降為 500 行 MainScene adapter；增加的少數行是為了把 mount gate、visibility gate 與跨層共用 appearance 明確命名。整個 `SceneRenderContent` return 從 HEAD 的 860 行變為目前的 655 行；目前 checkout 的 `MainScene.tsx` 總行數是 4,419，與 HEAD 的 4,915 相差 496 行，但其中約 37 行差額來自同時進行的 R5-MS 計算重構，不能歸給本 worker。

render 測試新增於 `src/scene/sceneRenderLayers.test.tsx`（335 行），涵蓋 4 個 Node test：Ground UE resolver/element、satellite marker element、各 layer 的 mount gate/active child tree，以及 motion/multi-candidate child tree。測試直接呼叫元件取得 React element tree，不建立真實 Canvas；`useThree`、`useFrame` 等 R3F child 不在 Node 中執行，因此這是 parent composition/gate 測試，不宣稱 GPU 或瀏覽器視覺驗收。

另外，`src/scene/presentation/scenePresentationBoundary.test.ts` 已改為檢查 `SceneGroundUeLayer` 的新 seam；`src/scene/archivedTleMainSceneSource.test.ts` 改為檢查 `sceneFrameResolver` 與抽出的 layer surfaces；`package.json` 的 `test:scene-presentation` 已登錄新增測試。

## props 超過 15 個因此改變切法或放棄的

- **Satellite identity markers**：若把每個 label、EE、identity、候選 layer gate 和 marker visibility 攤平，會超過 15 個且把每個顯示決策重新綁回 `MainScene`。改成 `visibility`、`identity`、`labels`、`emphasis` 四個語意 model，加上 `satellites`，public interface 為 5 個 props。
- **SINR-live beam field**：12 個重複 renderer mount 若各自攤平 appearance、palette、EE、dimming、primary identity 與 telemetry，會形成 20+ 參數的 prop wall。改成共用 `appearance` 加上 `cones[]`、`footprints[]`、`callouts`、`teaching`，每個 layer item 保留自己的 gate 與資料；public interface 為 5 個 props。
- **Natural handover motion**：若把五個動畫 child 的欄位攤平，會超過 15 個且難以看出哪個 gate 屬於哪個載體。改成五個 named layer models；public interface 為 5 個 props。
- **Handover toast**：沒有超過 15 個，但把 toast 欄位攤平會讓 screen-overlay 的 model 失去邊界，因此保留單一 `toast` aggregate，避免用數量換取假的簡潔。
- 本輪沒有因為 props 過寬而完全放棄一個「有獨立畫面職責」的組；不適合抽取的既有 component/root boundary 列在下一節。

## 我判斷不該拆的

- **`SceneTelemetry`**：它本身已是命名明確的 telemetry component；118 行主要是把多個既有 dataset contract 傳入。再包一層只會複製 20+ 欄位，沒有新的畫面職責或可測性收益，因此保留。
- **`BaseSceneLayout`**：它是整個 R3F scene root，擁有 camera/controls、lighting/campus 與 child composition boundary。把 root 再包一層會把生命週期與 context 邊界藏起來，不是 presentational domain split。
- **`ScenePresentationCanvasTelemetry`**：已是單一職責且只有一行使用點，不需要再加 adapter。
- **`TeachingFloor`、`UAV`、`FPSCounter` 與 `Suspense` loading boundary**：各自是 atomic decoration/loading boundary；彼此沒有共同語意，硬湊會增加耦合而非改善閱讀。
- **retired `SatelliteBeams` 區塊**：目前只是說明 retired path 的 comment，沒有 active JSX node；沒有建立一個假的 renderer wrapper。
- 本輪沒有改動 `check:ee`、`check:visual`，沒有選擇 `cellId` 或 `beamId` 的 canonical owner，也沒有執行任何 `*:browser` validator。
